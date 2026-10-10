// Package api wires the HTTP routes: public read-only API, admin API with
// cookie sessions, media uploads and the embedded admin panel.
package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"phibio/backend/internal/auth"
	"phibio/backend/internal/store"
)

// Limits.
const (
	MaxJSONBody   = 2 << 20  // 2 MB for ordinary JSON requests
	MaxImportBody = 64 << 20 // 64 MB for a full backup import
	SessionCookie = "phibio_session"
	CSRFHeader    = "X-Requested-With"
	CSRFValue     = "phibio-admin"
)

// Config holds the runtime options the API needs.
type Config struct {
	BaseURL        string   // public origin for absolute media URLs ("" = derive from request)
	CORSOrigins    []string // allowed origins for /api/v1 and /uploads; ["*"] = any
	MaxUploadBytes int64
	AdminUI        fs.FS // files served at /admin/ (index.html required)
}

// Server holds the dependencies of every handler.
type Server struct {
	cfg      Config
	store    *store.Store
	sessions *auth.Sessions
	limiter  *auth.RateLimiter
	logger   *log.Logger
	now      func() time.Time
}

// New builds the handler tree.
func New(cfg Config, st *store.Store, sessions *auth.Sessions, limiter *auth.RateLimiter, logger *log.Logger) *Server {
	if logger == nil {
		logger = log.Default()
	}
	if len(cfg.CORSOrigins) == 0 {
		cfg.CORSOrigins = []string{"*"}
	}
	if cfg.MaxUploadBytes <= 0 {
		cfg.MaxUploadBytes = 20 << 20
	}
	cfg.BaseURL = strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	return &Server{cfg: cfg, store: st, sessions: sessions, limiter: limiter, logger: logger, now: time.Now}
}

// Handler returns the fully wrapped http.Handler.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", s.handleHealth)

	// Public API.
	mux.HandleFunc("GET /api/v1/site", s.handlePublicSite)
	mux.HandleFunc("GET /api/v1/news", s.handlePublicNewsList)
	mux.HandleFunc("GET /api/v1/news/{slug}", s.handlePublicNewsItem)
	mux.HandleFunc("GET /api/v1/products", s.handlePublicProductList)
	mux.HandleFunc("GET /api/v1/products/{slug}", s.handlePublicProductItem)
	mux.HandleFunc("GET /api/v1/bundle", s.handlePublicBundle)
	mux.HandleFunc("GET /uploads/{file}", s.handleUpload)
	mux.HandleFunc("/api/v1/", s.notFound)
	mux.HandleFunc("/uploads/", s.notFound)

	// Admin API.
	mux.HandleFunc("POST /api/admin/login", s.handleLogin)
	admin := func(pattern string, h http.HandlerFunc) {
		mux.Handle(pattern, s.requireSession(h))
	}
	admin("POST /api/admin/logout", s.handleLogout)
	admin("GET /api/admin/me", s.handleMe)
	admin("PUT /api/admin/password", s.handlePassword)
	admin("GET /api/admin/site", s.handleAdminSiteGet)
	admin("PUT /api/admin/site", s.handleAdminSitePut)
	admin("GET /api/admin/news", s.handleAdminNewsList)
	admin("POST /api/admin/news", s.handleAdminNewsCreate)
	admin("GET /api/admin/news/{id}", s.handleAdminNewsGet)
	admin("PUT /api/admin/news/{id}", s.handleAdminNewsUpdate)
	admin("DELETE /api/admin/news/{id}", s.handleAdminNewsDelete)
	admin("GET /api/admin/products", s.handleAdminProductList)
	admin("POST /api/admin/products", s.handleAdminProductCreate)
	admin("GET /api/admin/products/{id}", s.handleAdminProductGet)
	admin("PUT /api/admin/products/{id}", s.handleAdminProductUpdate)
	admin("DELETE /api/admin/products/{id}", s.handleAdminProductDelete)
	admin("GET /api/admin/media", s.handleAdminMediaList)
	admin("POST /api/admin/media", s.handleAdminMediaUpload)
	admin("PUT /api/admin/media/{id}", s.handleAdminMediaUpdate)
	admin("DELETE /api/admin/media/{id}", s.handleAdminMediaDelete)
	admin("GET /api/admin/stats", s.handleAdminStats)
	admin("GET /api/admin/export", s.handleAdminExport)
	admin("POST /api/admin/import", s.handleAdminImport)
	mux.Handle("/api/admin/", s.requireSession(s.notFound))

	// Admin panel UI.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" && (r.Method == http.MethodGet || r.Method == http.MethodHead) {
			http.Redirect(w, r, "/admin/", http.StatusFound)
			return
		}
		s.notFound(w, r)
	})
	mux.HandleFunc("GET /admin", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/admin/", http.StatusFound)
	})
	mux.HandleFunc("GET /admin/", s.handleAdminUI)

	return s.recoverer(s.logging(s.cors(mux)))
}

// ---- middleware ---------------------------------------------------------

type statusWriter struct {
	http.ResponseWriter
	status int
	bytes  int64
}

func (w *statusWriter) WriteHeader(code int) {
	if w.status == 0 {
		w.status = code
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	n, err := w.ResponseWriter.Write(b)
	w.bytes += int64(n)
	return n, err
}

// Unwrap lets http.ResponseController reach the underlying writer.
func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func (s *Server) logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := s.now()
		sw := &statusWriter{ResponseWriter: w}
		next.ServeHTTP(sw, r)
		if sw.status == 0 {
			sw.status = http.StatusOK
		}
		s.logger.Printf("%s %s %d %s", r.Method, r.URL.RequestURI(), sw.status, s.now().Sub(start).Round(time.Microsecond))
	})
}

func (s *Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				if err, ok := rec.(error); ok && errors.Is(err, http.ErrAbortHandler) {
					panic(rec)
				}
				s.logger.Printf("panic serving %s %s: %v\n%s", r.Method, r.URL.Path, rec, debug.Stack())
				s.fail(w, r, http.StatusInternalServerError, "internal", M("Sunucuda beklenmeyen bir hata oluştu.", "An unexpected server error occurred."))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// cors adds Access-Control headers for the public API and uploads and
// answers preflight requests.
func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if strings.HasPrefix(p, "/api/v1/") || strings.HasPrefix(p, "/uploads/") || p == "/healthz" {
			if origin := s.allowedOrigin(r.Header.Get("Origin")); origin != "" {
				h := w.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				if origin != "*" {
					h.Add("Vary", "Origin")
				}
				h.Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "Accept, Accept-Language, Content-Type, If-None-Match, X-Lang")
				h.Set("Access-Control-Expose-Headers", "ETag, Cache-Control")
				h.Set("Access-Control-Max-Age", "86400")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// allowedOrigin returns the value for Access-Control-Allow-Origin, or "".
func (s *Server) allowedOrigin(origin string) string {
	for _, o := range s.cfg.CORSOrigins {
		if o == "*" {
			return "*"
		}
	}
	if origin == "" {
		return ""
	}
	for _, o := range s.cfg.CORSOrigins {
		if strings.EqualFold(strings.TrimRight(o, "/"), strings.TrimRight(origin, "/")) {
			return origin
		}
	}
	return ""
}

// ---- helpers -------------------------------------------------------------

// Msg is a bilingual error message.
type Msg struct {
	TR string
	EN string
}

// M builds a Msg.
func M(tr, en string) Msg { return Msg{TR: tr, EN: en} }

// language picks "tr" or "en" for error messages from X-Lang, then
// Accept-Language. English is the default.
func language(r *http.Request) string {
	if l := strings.ToLower(strings.TrimSpace(r.Header.Get("X-Lang"))); l == "tr" || l == "en" {
		return l
	}
	al := strings.ToLower(r.Header.Get("Accept-Language"))
	for _, part := range strings.Split(al, ",") {
		tag := strings.TrimSpace(strings.SplitN(part, ";", 2)[0])
		if tag == "tr" || strings.HasPrefix(tag, "tr-") {
			return "tr"
		}
		if tag == "en" || strings.HasPrefix(tag, "en-") {
			return "en"
		}
	}
	return "en"
}

type errorBody struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

// fail writes the standard error shape.
func (s *Server) fail(w http.ResponseWriter, r *http.Request, status int, code string, m Msg) {
	text := m.EN
	if language(r) == "tr" {
		text = m.TR
	}
	if text == "" {
		text = m.EN
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, status, errorBody{Error: text, Code: code})
}

func (s *Server) notFound(w http.ResponseWriter, r *http.Request) {
	s.fail(w, r, http.StatusNotFound, "not_found", M("Kayıt bulunamadı.", "Not found."))
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	data, err := json.Marshal(v)
	if err != nil {
		http.Error(w, `{"error":"encoding failed","code":"internal"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Length", fmt.Sprint(len(data)))
	w.WriteHeader(status)
	_, _ = w.Write(data)
}

// decodeJSON reads a JSON body with a size limit. It returns false after
// having written the error response.
func (s *Server) decodeJSON(w http.ResponseWriter, r *http.Request, v any, limit int64) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(v); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			s.fail(w, r, http.StatusRequestEntityTooLarge, "too_large", M("İstek gövdesi çok büyük.", "Request body is too large."))
			return false
		}
		s.fail(w, r, http.StatusBadRequest, "bad_request", M("Geçersiz JSON: "+err.Error(), "Invalid JSON: "+err.Error()))
		return false
	}
	if dec.More() {
		s.fail(w, r, http.StatusBadRequest, "bad_request", M("İstek gövdesinde fazladan veri var.", "Unexpected trailing data in request body."))
		return false
	}
	_, _ = io.Copy(io.Discard, r.Body)
	return true
}

// etagFor returns a strong ETag for a body.
func etagFor(body []byte) string {
	sum := sha256.Sum256(body)
	return `"` + hex.EncodeToString(sum[:16]) + `"`
}

// writePublicJSON writes a cacheable JSON response with an ETag and honours
// If-None-Match.
func (s *Server) writePublicJSON(w http.ResponseWriter, r *http.Request, v any) {
	data, err := json.Marshal(v)
	if err != nil {
		s.fail(w, r, http.StatusInternalServerError, "internal", M("Yanıt oluşturulamadı.", "Could not build the response."))
		return
	}
	h := w.Header()
	etag := h.Get("ETag") // a handler may pre-set a content-derived tag
	if etag == "" {
		etag = etagFor(data)
	}
	h.Set("Content-Type", "application/json; charset=utf-8")
	h.Set("Cache-Control", "public, max-age=60")
	h.Set("ETag", etag)
	if etagMatches(r.Header.Get("If-None-Match"), etag) {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	h.Set("Content-Length", fmt.Sprint(len(data)))
	w.WriteHeader(http.StatusOK)
	if r.Method != http.MethodHead {
		_, _ = w.Write(data)
	}
}

func etagMatches(header, etag string) bool {
	if header == "" {
		return false
	}
	for _, part := range strings.Split(header, ",") {
		part = strings.TrimSpace(part)
		if part == "*" {
			return true
		}
		part = strings.TrimPrefix(part, "W/")
		if part == etag {
			return true
		}
	}
	return false
}

// baseURL returns the public origin used for absolute media URLs.
func (s *Server) baseURL(r *http.Request) string {
	if s.cfg.BaseURL != "" {
		return s.cfg.BaseURL
	}
	scheme := "http"
	if proto := strings.ToLower(strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Proto"), ",")[0])); proto == "https" || proto == "http" {
		scheme = proto
	} else if r.TLS != nil {
		scheme = "https"
	}
	host := r.Host
	if fh := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Host"), ",")[0]); fh != "" {
		host = fh
	}
	if host == "" {
		host = "localhost"
	}
	return scheme + "://" + host
}

// isSecure reports whether the request arrived over TLS (directly or through
// a proxy that set X-Forwarded-Proto).
func isSecure(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	proto := strings.ToLower(strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Proto"), ",")[0]))
	return proto == "https"
}

// clientIP returns the caller's IP. X-Forwarded-For / X-Real-IP are honoured
// only when the direct peer is a loopback or private address (i.e. a reverse
// proxy on the same host or network), so clients cannot forge them.
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip := net.ParseIP(host)
	if ip != nil && (ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified()) {
		if xff := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0]); xff != "" {
			return xff
		}
		if xr := strings.TrimSpace(r.Header.Get("X-Real-IP")); xr != "" {
			return xr
		}
	}
	return host
}
