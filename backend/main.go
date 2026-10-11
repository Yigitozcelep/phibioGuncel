// Command phibio-server is the Phibio content server: public JSON API for the
// mobile app, admin API and embedded admin panel. Standard library only.
package main

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"phibio/backend/admin"
	"phibio/backend/internal/api"
	"phibio/backend/internal/auth"
	"phibio/backend/internal/model"
	"phibio/backend/internal/seed"
	"phibio/backend/internal/store"
	seedfiles "phibio/backend/seed"
)

type config struct {
	Port          string
	DataDir       string
	BaseURL       string
	TrustProxy    bool
	AdminUser     string
	AdminPassword string
	MaxUploadMB   int
	CORSOrigins   []string
	Seed          bool
}

func loadConfig() (config, error) {
	c := config{
		Port:        env("PORT", "8080"),
		DataDir:     env("DATA_DIR", "./data"),
		BaseURL:     strings.TrimRight(env("BASE_URL", ""), "/"),
		TrustProxy:  env("TRUST_PROXY", "0") == "1",
		AdminUser:   env("ADMIN_USER", "admin"),
		MaxUploadMB: 20,
		Seed:        true,
	}
	c.AdminPassword = os.Getenv("ADMIN_PASSWORD")
	if v := strings.TrimSpace(os.Getenv("MAX_UPLOAD_MB")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 500 {
			return c, fmt.Errorf("MAX_UPLOAD_MB must be a number between 1 and 500, got %q", v)
		}
		c.MaxUploadMB = n
	}
	origins := env("CORS_ORIGINS", "*")
	for _, o := range strings.Split(origins, ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.CORSOrigins = append(c.CORSOrigins, o)
		}
	}
	if len(c.CORSOrigins) == 0 {
		c.CORSOrigins = []string{"*"}
	}
	if v := strings.TrimSpace(os.Getenv("SEED")); v != "" {
		switch strings.ToLower(v) {
		case "0", "false", "no", "off":
			c.Seed = false
		case "1", "true", "yes", "on":
			c.Seed = true
		default:
			return c, fmt.Errorf("SEED must be 0 or 1, got %q", v)
		}
	}
	if _, err := strconv.Atoi(c.Port); err != nil {
		return c, fmt.Errorf("PORT must be a number, got %q", c.Port)
	}
	if strings.TrimSpace(c.AdminUser) == "" {
		return c, errors.New("ADMIN_USER must not be empty")
	}
	return c, nil
}

func env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	return def
}

func main() {
	logger := log.New(os.Stdout, "", log.LstdFlags|log.LUTC)
	if err := run(logger); err != nil {
		logger.Printf("fatal: %v", err)
		os.Exit(1)
	}
}

func run(logger *log.Logger) error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}
	logger.Printf("phibio-server starting: PORT=%s DATA_DIR=%s BASE_URL=%q ADMIN_USER=%s MAX_UPLOAD_MB=%d CORS_ORIGINS=%s SEED=%t",
		cfg.Port, cfg.DataDir, cfg.BaseURL, cfg.AdminUser, cfg.MaxUploadMB, strings.Join(cfg.CORSOrigins, ","), cfg.Seed)

	st, err := store.Open(cfg.DataDir)
	if err != nil {
		return err
	}

	// First run: seed content.
	if st.IsFirstRun() {
		if st.HasAnyData() {
			logger.Printf("warning: %s has content files but no site.json; keeping the existing content and creating an empty site (seed skipped)", cfg.DataDir)
			if err := st.SetSite(emptySite()); err != nil {
				return err
			}
		} else if cfg.Seed {
			logger.Printf("first run: no site.json in %s, importing seed content", cfg.DataDir)
			if _, err := seed.Run(st, seedfiles.Files, logger); err != nil {
				return fmt.Errorf("seed: %w", err)
			}
		} else {
			logger.Printf("first run: SEED=0, starting with empty content")
			if err := st.SetSite(emptySite()); err != nil {
				return err
			}
		}
	}

	// First run: admin user.
	if len(st.Users()) == 0 {
		password := cfg.AdminPassword
		generated := false
		if password == "" {
			password, err = auth.RandomPassword(16)
			if err != nil {
				return fmt.Errorf("generate password: %w", err)
			}
			generated = true
		}
		salt, hash, err := auth.HashPassword(password)
		if err != nil {
			return fmt.Errorf("hash password: %w", err)
		}
		if err := st.PutUser(model.AdminUser{Username: cfg.AdminUser, Salt: salt, Hash: hash, CreatedAt: model.Now()}); err != nil {
			return fmt.Errorf("create admin user: %w", err)
		}
		if generated {
			logger.Printf("Initial admin password: %s", password)
			logger.Printf("Admin user %q created with a generated password (shown once above). Change it in the admin panel.", cfg.AdminUser)
		} else {
			logger.Printf("Admin user %q created from ADMIN_PASSWORD.", cfg.AdminUser)
		}
	}

	ui, err := fs.Sub(admin.Files, "ui")
	if err != nil {
		return fmt.Errorf("admin ui: %w", err)
	}

	sessions := auth.NewSessions(auth.SessionIdle)
	limiter := auth.NewRateLimiter(5, 15*time.Minute)
	srv := api.New(api.Config{
		BaseURL:        cfg.BaseURL,
		TrustProxy:     cfg.TrustProxy,
		CORSOrigins:    cfg.CORSOrigins,
		MaxUploadBytes: int64(cfg.MaxUploadMB) << 20,
		AdminUI:        ui,
	}, st, sessions, limiter, logger)

	httpServer := &http.Server{
		Addr:              net.JoinHostPort("", cfg.Port),
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
		MaxHeaderBytes:    64 << 10,
		ErrorLog:          logger,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Housekeeping: expire sessions and prune the rate limiter.
	go func() {
		t := time.NewTicker(10 * time.Minute)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				sessions.Sweep()
				limiter.Sweep()
			}
		}
	}()

	errCh := make(chan error, 1)
	go func() {
		logger.Printf("listening on http://localhost:%s (admin panel at /admin/)", cfg.Port)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		if err != nil {
			return fmt.Errorf("listen: %w", err)
		}
		return nil
	case <-ctx.Done():
	}
	logger.Printf("shutting down (waiting up to 10s for in-flight requests)")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}
	logger.Printf("bye")
	return nil
}

// emptySite is used when SEED=0 so every field has a stable shape.
func emptySite() model.SiteSettings {
	s := model.SiteSettings{
		CompanyName: "Phibio GmbH",
		Slogan:      model.LocalizedString{TR: "Pure and Cure", EN: "Pure and Cure"},
		Contact: model.Contact{
			Email: "info@phibio.de", Phone: "+496940767397", PhoneDisplay: "069 40767397",
			AddressLines: []string{"Klingerstraße 24", "60313 Frankfurt am Main", "Germany"},
			Website:      "https://www.phibio.de",
		},
	}
	s.Normalize()
	return s
}
