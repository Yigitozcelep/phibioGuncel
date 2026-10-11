package api

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"phibio/backend/internal/auth"
	"phibio/backend/internal/media"
	"phibio/backend/internal/model"
	"phibio/backend/internal/store"
)

type ctxKey int

const ctxUser ctxKey = 1

// requireSession checks the cookie and, for mutating methods, the CSRF header.
func (s *Server) requireSession(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		c, err := r.Cookie(SessionCookie)
		if err != nil {
			s.fail(w, r, http.StatusUnauthorized, "unauthorized", M("Oturum açmanız gerekiyor.", "You need to sign in."))
			return
		}
		username, ok := s.sessions.Lookup(c.Value)
		if !ok {
			s.clearSessionCookie(w, r)
			s.fail(w, r, http.StatusUnauthorized, "unauthorized", M("Oturumunuzun süresi doldu, lütfen yeniden giriş yapın.", "Your session has expired, please sign in again."))
			return
		}
		switch r.Method {
		case http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch:
			if r.Header.Get(CSRFHeader) != CSRFValue {
				s.fail(w, r, http.StatusForbidden, "forbidden", M("İstek reddedildi (eksik güvenlik başlığı).", "Request refused (missing security header)."))
				return
			}
		}
		r.Header.Set("X-Phibio-User", username)
		next(w, r)
	})
}

func currentUser(r *http.Request) string { return r.Header.Get("X-Phibio-User") }

func (s *Server) setSessionCookie(w http.ResponseWriter, r *http.Request, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Secure:   isSecure(r),
		MaxAge:   int(auth.SessionIdle / time.Second),
	})
}

func (s *Server) clearSessionCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Secure:   isSecure(r),
		MaxAge:   -1,
	})
}

// ---- auth ----------------------------------------------------------------

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	ip := clientIP(r, s.cfg.TrustProxy)
	if ok, retry := s.limiter.Allowed(ip); !ok {
		w.Header().Set("Retry-After", fmt.Sprint(int(retry/time.Second)+1))
		s.fail(w, r, http.StatusTooManyRequests, "rate_limited", M("Çok fazla başarısız deneme. Lütfen bir süre sonra tekrar deneyin.", "Too many failed attempts. Please try again later."))
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if !s.decodeJSON(w, r, &body, MaxJSONBody) {
		return
	}
	body.Username = strings.TrimSpace(body.Username)
	user, found := s.store.GetUser(body.Username)
	// Always run the hash to keep timing similar for unknown users.
	salt, hash := user.Salt, user.Hash
	if !found {
		salt, hash = dummySalt, dummyHash
	}
	if !found || body.Password == "" || !auth.VerifyPassword(body.Password, salt, hash) {
		s.limiter.Fail(ip)
		s.fail(w, r, http.StatusUnauthorized, "unauthorized", M("Kullanıcı adı veya parola hatalı.", "Incorrect username or password."))
		return
	}
	s.limiter.Reset(ip)
	token, err := s.sessions.Create(user.Username)
	if err != nil {
		s.fail(w, r, http.StatusInternalServerError, "internal", M("Oturum oluşturulamadı.", "Could not create a session."))
		return
	}
	s.setSessionCookie(w, r, token)
	writeJSON(w, http.StatusOK, map[string]string{"username": user.Username})
}

// Dummy credentials used to equalise timing for unknown usernames.
var dummySalt, dummyHash = func() (string, string) {
	s, h, err := auth.HashPassword("phibio-dummy")
	if err != nil {
		return "", ""
	}
	return s, h
}()

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(SessionCookie); err == nil {
		s.sessions.Delete(c.Value)
	}
	s.clearSessionCookie(w, r)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"username": currentUser(r)})
}

func (s *Server) handlePassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Current string `json:"current"`
		New     string `json:"new"`
	}
	if !s.decodeJSON(w, r, &body, MaxJSONBody) {
		return
	}
	user, ok := s.store.GetUser(currentUser(r))
	if !ok {
		s.fail(w, r, http.StatusUnauthorized, "unauthorized", M("Kullanıcı bulunamadı.", "User not found."))
		return
	}
	if !auth.VerifyPassword(body.Current, user.Salt, user.Hash) {
		s.fail(w, r, http.StatusBadRequest, "bad_request", M("current: mevcut parola hatalı.", "current: the current password is incorrect."))
		return
	}
	if len([]rune(body.New)) < 8 {
		s.fail(w, r, http.StatusBadRequest, "bad_request", M("new: yeni parola en az 8 karakter olmalı.", "new: the new password must be at least 8 characters."))
		return
	}
	salt, hash, err := auth.HashPassword(body.New)
	if err != nil {
		s.fail(w, r, http.StatusInternalServerError, "internal", M("Parola kaydedilemedi.", "Could not save the password."))
		return
	}
	user.Salt, user.Hash = salt, hash
	if err := s.store.PutUser(user); err != nil {
		s.logger.Printf("save user: %v", err)
		s.fail(w, r, http.StatusInternalServerError, "internal", M("Parola kaydedilemedi.", "Could not save the password."))
		return
	}
	if c, err := r.Cookie(SessionCookie); err == nil {
		s.sessions.DeleteOthers(user.Username, c.Value)
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- site ----------------------------------------------------------------

func (s *Server) handleAdminSiteGet(w http.ResponseWriter, r *http.Request) {
	res := s.resolverFor(s.baseURL(r))
	writeJSON(w, http.StatusOK, res.site(s.store.Site()))
}

func (s *Server) handleAdminSitePut(w http.ResponseWriter, r *http.Request) {
	var site model.SiteSettings
	if !s.decodeJSON(w, r, &site, MaxJSONBody) {
		return
	}
	site.Normalize()
	if err := validateSite(&site, s.store.MediaExists); err != nil {
		s.writeAPIError(w, r, err)
		return
	}
	if err := s.store.SetSite(site); err != nil {
		s.storeError(w, r, err)
		return
	}
	res := s.resolverFor(s.baseURL(r))
	writeJSON(w, http.StatusOK, res.site(s.store.Site()))
}

func (s *Server) storeError(w http.ResponseWriter, r *http.Request, err error) {
	s.logger.Printf("store error: %v", err)
	s.fail(w, r, http.StatusInternalServerError, "internal", M("Veri kaydedilemedi: "+err.Error(), "Could not save data: "+err.Error()))
}

// ---- news ----------------------------------------------------------------

func (s *Server) handleAdminNewsList(w http.ResponseWriter, r *http.Request) {
	status := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status")))
	if status == "" {
		status = "all"
	}
	if status != "all" && !model.Contains(model.Statuses, status) {
		s.fail(w, r, http.StatusBadRequest, "bad_request", M("status: all, draft veya published olmalı.", "status: must be all, draft or published."))
		return
	}
	list := s.store.ListNews()
	sort.SliceStable(list, func(i, j int) bool {
		if !list[i].UpdatedAt.Equal(list[j].UpdatedAt.Time) {
			return list[i].UpdatedAt.After(list[j].UpdatedAt.Time)
		}
		return list[i].ID < list[j].ID
	})
	res := s.resolverFor(s.baseURL(r))
	out := []NewsOut{}
	for _, n := range list {
		if status != "all" && n.Status != status {
			continue
		}
		out = append(out, res.news(n))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleAdminNewsGet(w http.ResponseWriter, r *http.Request) {
	n, ok := s.store.GetNews(r.PathValue("id"))
	if !ok {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Haber bulunamadı.", "Article not found."))
		return
	}
	res := s.resolverFor(s.baseURL(r))
	writeJSON(w, http.StatusOK, res.news(n))
}

// prepareNews validates and completes an incoming article. existing is nil
// on create.
func (s *Server) prepareNews(in *model.News, existing *model.News) *apiError {
	in.Normalize()
	if in.Status == "" {
		in.Status = model.StatusDraft
	}
	if err := validateNews(in, s.store.MediaExists); err != nil {
		return err
	}
	now := model.Now()
	exceptID := ""
	if existing != nil {
		exceptID = existing.ID
	}
	var slug string
	if existing == nil {
		base := model.Slugify(in.Slug)
		if base == "" {
			base = model.Slugify(in.Title.EN)
		}
		if base == "" {
			base = model.Slugify(in.Title.TR)
		}
		if base == "" {
			base = "haber"
		}
		slug = s.store.UniqueNewsSlug(base, "")
	} else {
		slug = model.Slugify(in.Slug)
		if slug == "" {
			slug = existing.Slug
		}
		if slug == "" {
			slug = s.store.UniqueNewsSlug(firstNonEmpty(model.Slugify(in.Title.EN), model.Slugify(in.Title.TR), "haber"), exceptID)
		}
		if slug != existing.Slug && s.store.NewsSlugTaken(slug, exceptID) {
			return conflict("slug: bu adres zaten başka bir haberde kullanılıyor.", "slug: this slug is already used by another article.")
		}
	}
	in.Slug = slug
	if in.Status == model.StatusPublished && in.PublishedAt.IsZero() {
		in.PublishedAt = now
	}
	if existing != nil {
		in.ID = existing.ID
		in.CreatedAt = existing.CreatedAt
		if in.CreatedAt.IsZero() {
			in.CreatedAt = now
		}
	} else {
		in.ID = store.NewID()
		in.CreatedAt = now
	}
	in.UpdatedAt = now
	return nil
}

func (s *Server) handleAdminNewsCreate(w http.ResponseWriter, r *http.Request) {
	var in model.News
	if !s.decodeJSON(w, r, &in, MaxJSONBody) {
		return
	}
	if err := s.prepareNews(&in, nil); err != nil {
		s.writeAPIError(w, r, err)
		return
	}
	if err := s.store.PutNews(in); err != nil {
		s.storeError(w, r, err)
		return
	}
	res := s.resolverFor(s.baseURL(r))
	writeJSON(w, http.StatusCreated, res.news(in))
}

func (s *Server) handleAdminNewsUpdate(w http.ResponseWriter, r *http.Request) {
	existing, ok := s.store.GetNews(r.PathValue("id"))
	if !ok {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Haber bulunamadı.", "Article not found."))
		return
	}
	var in model.News
	if !s.decodeJSON(w, r, &in, MaxJSONBody) {
		return
	}
	if err := s.prepareNews(&in, &existing); err != nil {
		s.writeAPIError(w, r, err)
		return
	}
	if err := s.store.PutNews(in); err != nil {
		s.storeError(w, r, err)
		return
	}
	res := s.resolverFor(s.baseURL(r))
	writeJSON(w, http.StatusOK, res.news(in))
}

func (s *Server) handleAdminNewsDelete(w http.ResponseWriter, r *http.Request) {
	err := s.store.DeleteNews(r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Haber bulunamadı.", "Article not found."))
		return
	}
	if err != nil {
		s.storeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- products ------------------------------------------------------------

func (s *Server) handleAdminProductList(w http.ResponseWriter, r *http.Request) {
	list := s.store.ListProducts()
	sort.SliceStable(list, func(i, j int) bool {
		if list[i].Order != list[j].Order {
			return list[i].Order < list[j].Order
		}
		if list[i].Name != list[j].Name {
			return strings.ToLower(list[i].Name) < strings.ToLower(list[j].Name)
		}
		return list[i].ID < list[j].ID
	})
	res := s.resolverFor(s.baseURL(r))
	out := []ProductOut{}
	for _, p := range list {
		out = append(out, res.product(p))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleAdminProductGet(w http.ResponseWriter, r *http.Request) {
	p, ok := s.store.GetProduct(r.PathValue("id"))
	if !ok {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Ürün bulunamadı.", "Product not found."))
		return
	}
	res := s.resolverFor(s.baseURL(r))
	writeJSON(w, http.StatusOK, res.product(p))
}

func (s *Server) prepareProduct(in *model.Product, existing *model.Product) *apiError {
	in.Normalize()
	if in.Status == "" {
		in.Status = model.StatusDraft
	}
	if err := validateProduct(in, s.store.MediaExists); err != nil {
		return err
	}
	now := model.Now()
	exceptID := ""
	if existing != nil {
		exceptID = existing.ID
	}
	var slug string
	if existing == nil {
		slug = s.store.UniqueProductSlug(firstNonEmpty(model.Slugify(in.Slug), model.Slugify(in.Name), "urun"), "")
	} else {
		slug = model.Slugify(in.Slug)
		if slug == "" {
			slug = existing.Slug
		}
		if slug == "" {
			slug = s.store.UniqueProductSlug(firstNonEmpty(model.Slugify(in.Name), "urun"), exceptID)
		}
		if slug != existing.Slug && s.store.ProductSlugTaken(slug, exceptID) {
			return conflict("slug: bu adres zaten başka bir üründe kullanılıyor.", "slug: this slug is already used by another product.")
		}
	}
	in.Slug = slug
	if existing != nil {
		in.ID = existing.ID
		in.CreatedAt = existing.CreatedAt
		if in.CreatedAt.IsZero() {
			in.CreatedAt = now
		}
	} else {
		in.ID = store.NewID()
		in.CreatedAt = now
	}
	in.UpdatedAt = now
	return nil
}

func (s *Server) handleAdminProductCreate(w http.ResponseWriter, r *http.Request) {
	var in model.Product
	if !s.decodeJSON(w, r, &in, MaxJSONBody) {
		return
	}
	if err := s.prepareProduct(&in, nil); err != nil {
		s.writeAPIError(w, r, err)
		return
	}
	if err := s.store.PutProduct(in); err != nil {
		s.storeError(w, r, err)
		return
	}
	res := s.resolverFor(s.baseURL(r))
	writeJSON(w, http.StatusCreated, res.product(in))
}

func (s *Server) handleAdminProductUpdate(w http.ResponseWriter, r *http.Request) {
	existing, ok := s.store.GetProduct(r.PathValue("id"))
	if !ok {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Ürün bulunamadı.", "Product not found."))
		return
	}
	var in model.Product
	if !s.decodeJSON(w, r, &in, MaxJSONBody) {
		return
	}
	if err := s.prepareProduct(&in, &existing); err != nil {
		s.writeAPIError(w, r, err)
		return
	}
	if err := s.store.PutProduct(in); err != nil {
		s.storeError(w, r, err)
		return
	}
	res := s.resolverFor(s.baseURL(r))
	writeJSON(w, http.StatusOK, res.product(in))
}

func (s *Server) handleAdminProductDelete(w http.ResponseWriter, r *http.Request) {
	err := s.store.DeleteProduct(r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Ürün bulunamadı.", "Product not found."))
		return
	}
	if err != nil {
		s.storeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- media ---------------------------------------------------------------

func (s *Server) handleAdminMediaList(w http.ResponseWriter, r *http.Request) {
	res := s.resolverFor(s.baseURL(r))
	out := []MediaOut{}
	for _, m := range s.store.ListMedia() {
		out = append(out, res.mediaOut(m))
	}
	writeJSON(w, http.StatusOK, out)
}

var unsafeFileChars = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

// sanitizeFileName keeps a readable original name for display only; it is
// never used as a path.
func sanitizeFileName(name, ext string) string {
	name = filepath.Base(strings.ReplaceAll(name, "\\", "/"))
	name = unsafeFileChars.ReplaceAllString(name, "-")
	name = strings.Trim(name, "-.")
	if name == "" || name == "." || name == ".." {
		name = "upload." + ext
	}
	if len(name) > 100 {
		name = name[len(name)-100:]
	}
	return name
}

func (s *Server) handleAdminMediaUpload(w http.ResponseWriter, r *http.Request) {
	// Allow a little overhead for the multipart envelope and the alt fields.
	r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxUploadBytes+(1<<20))
	tooLarge := func() {
		s.fail(w, r, http.StatusRequestEntityTooLarge, "too_large",
			M(fmt.Sprintf("Dosya çok büyük (en fazla %d MB).", s.cfg.MaxUploadBytes>>20),
				fmt.Sprintf("File is too large (maximum %d MB).", s.cfg.MaxUploadBytes>>20)))
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			tooLarge()
			return
		}
		s.fail(w, r, http.StatusBadRequest, "bad_request", M("Yükleme formu okunamadı: "+err.Error(), "Could not read the upload form: "+err.Error()))
		return
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()
	file, header, err := r.FormFile("file")
	if err != nil {
		s.fail(w, r, http.StatusBadRequest, "bad_request", M("file: dosya alanı eksik.", "file: the file field is missing."))
		return
	}
	defer file.Close()
	if header.Size > s.cfg.MaxUploadBytes {
		tooLarge()
		return
	}
	data, err := io.ReadAll(io.LimitReader(file, s.cfg.MaxUploadBytes+1))
	if err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			tooLarge()
			return
		}
		s.fail(w, r, http.StatusBadRequest, "bad_request", M("Dosya okunamadı.", "Could not read the file."))
		return
	}
	if int64(len(data)) > s.cfg.MaxUploadBytes {
		tooLarge()
		return
	}
	result, err := media.Process(data)
	if errors.Is(err, media.ErrUnsupported) {
		s.fail(w, r, http.StatusBadRequest, "bad_request", M("Yalnızca JPEG, PNG, WebP ve GIF görselleri yüklenebilir.", "Only JPEG, PNG, WebP and GIF images can be uploaded."))
		return
	}
	if err != nil {
		s.fail(w, r, http.StatusBadRequest, "bad_request", M("Görsel çözümlenemedi; dosya bozuk olabilir.", "The image could not be decoded; the file may be corrupt."))
		return
	}
	id := store.NewID()
	variants, err := result.Save(s.store.UploadsPath(), id)
	if err != nil {
		s.logger.Printf("save upload: %v", err)
		s.fail(w, r, http.StatusInternalServerError, "internal", M("Dosya diske yazılamadı.", "Could not write the file to disk."))
		return
	}
	m := model.Media{
		ID:       id,
		FileName: sanitizeFileName(header.Filename, result.Ext),
		Mime:     result.Mime,
		Width:    result.Width,
		Height:   result.Height,
		Size:     result.Size,
		Variants: variants,
		Alt: model.LocalizedString{
			TR: strings.TrimSpace(r.FormValue("altTr")),
			EN: strings.TrimSpace(r.FormValue("altEn")),
		},
		CreatedAt: model.Now(),
	}
	if err := s.store.PutMedia(m); err != nil {
		_ = media.RemoveFiles(s.store.UploadsPath(), variants)
		s.storeError(w, r, err)
		return
	}
	res := s.resolverFor(s.baseURL(r))
	writeJSON(w, http.StatusCreated, res.mediaOut(m))
}

func (s *Server) handleAdminMediaUpdate(w http.ResponseWriter, r *http.Request) {
	m, ok := s.store.GetMedia(r.PathValue("id"))
	if !ok {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Görsel bulunamadı.", "Image not found."))
		return
	}
	var body struct {
		Alt model.LocalizedString `json:"alt"`
	}
	if !s.decodeJSON(w, r, &body, MaxJSONBody) {
		return
	}
	m.Alt = body.Alt.Trim()
	if err := s.store.PutMedia(m); err != nil {
		s.storeError(w, r, err)
		return
	}
	res := s.resolverFor(s.baseURL(r))
	writeJSON(w, http.StatusOK, res.mediaOut(m))
}

func (s *Server) handleAdminMediaDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	m, ok := s.store.GetMedia(id)
	if !ok {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Görsel bulunamadı.", "Image not found."))
		return
	}
	usage := s.store.MediaUsageOf(id)
	if usage.Used() {
		var tr, en []string
		if usage.Site {
			tr = append(tr, "site ayarları")
			en = append(en, "site settings")
		}
		for _, t := range usage.News {
			tr = append(tr, "haber “"+t+"”")
			en = append(en, "article “"+t+"”")
		}
		for _, p := range usage.Products {
			tr = append(tr, "ürün “"+p+"”")
			en = append(en, "product “"+p+"”")
		}
		s.fail(w, r, http.StatusConflict, "conflict", M(
			"Bu görsel kullanımda olduğu için silinemez: "+strings.Join(tr, ", ")+".",
			"This image is in use and cannot be deleted: "+strings.Join(en, ", ")+"."))
		return
	}
	if err := s.store.DeleteMedia(id); err != nil {
		s.storeError(w, r, err)
		return
	}
	if err := media.RemoveFiles(s.store.UploadsPath(), m.Variants); err != nil {
		s.logger.Printf("remove files for media %s: %v", id, err)
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- stats / backup ------------------------------------------------------

func (s *Server) handleAdminStats(w http.ResponseWriter, r *http.Request) {
	news := s.store.ListNews()
	published := 0
	for _, n := range news {
		if n.Status == model.StatusPublished {
			published++
		}
	}
	sort.SliceStable(news, func(i, j int) bool {
		if !news[i].UpdatedAt.Equal(news[j].UpdatedAt.Time) {
			return news[i].UpdatedAt.After(news[j].UpdatedAt.Time)
		}
		return news[i].ID < news[j].ID
	})
	if len(news) > 5 {
		news = news[:5]
	}
	res := s.resolverFor(s.baseURL(r))
	latest := []AdminNewsSummary{}
	for _, n := range news {
		latest = append(latest, AdminNewsSummary{NewsSummary: res.newsSummary(n), Status: n.Status, UpdatedAt: n.UpdatedAt})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"news":       len(s.store.ListNews()),
		"published":  published,
		"products":   len(s.store.ListProducts()),
		"media":      len(s.store.ListMedia()),
		"latestNews": latest,
	})
}

func (s *Server) handleAdminExport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Disposition", `attachment; filename="phibio-backup-`+s.now().UTC().Format("2006-01-02")+`.json"`)
	writeJSON(w, http.StatusOK, s.store.Export())
}

func (s *Server) handleAdminImport(w http.ResponseWriter, r *http.Request) {
	var b store.Backup
	if !s.decodeJSON(w, r, &b, MaxImportBody) {
		return
	}
	known := map[string]bool{}
	for i := range b.Media {
		m := &b.Media[i]
		if m.ID == "" || m.Variants == nil || m.Variants["orig"] == "" {
			s.fail(w, r, http.StatusBadRequest, "bad_request", M(fmt.Sprintf("media[%d]: kimlik veya dosya bilgisi eksik.", i+1), fmt.Sprintf("media[%d]: id or file information missing.", i+1)))
			return
		}
		known[m.ID] = true
	}
	exists := func(id string) bool { return known[id] }
	b.Site.Normalize()
	if err := validateSite(&b.Site, exists); err != nil {
		err.Msg = M("site: "+err.Msg.TR, "site: "+err.Msg.EN)
		s.writeAPIError(w, r, err)
		return
	}
	seenNews, seenNewsSlug := map[string]bool{}, map[string]bool{}
	for i := range b.News {
		n := &b.News[i]
		n.Normalize()
		if n.Status == "" {
			n.Status = model.StatusDraft
		}
		if err := validateNews(n, exists); err != nil {
			err.Msg = M(fmt.Sprintf("news[%d]: %s", i+1, err.Msg.TR), fmt.Sprintf("news[%d]: %s", i+1, err.Msg.EN))
			s.writeAPIError(w, r, err)
			return
		}
		if n.ID == "" {
			n.ID = store.NewID()
		}
		if n.Slug == "" {
			n.Slug = model.Slugify(n.Title.EN)
			if n.Slug == "" {
				n.Slug = model.Slugify(n.Title.TR)
			}
		}
		base := n.Slug
		for k := 2; seenNewsSlug[n.Slug] || n.Slug == ""; k++ {
			n.Slug = fmt.Sprintf("%s-%d", base, k)
		}
		if seenNews[n.ID] {
			s.fail(w, r, http.StatusBadRequest, "bad_request", M(fmt.Sprintf("news[%d]: yinelenen kimlik %s.", i+1, n.ID), fmt.Sprintf("news[%d]: duplicate id %s.", i+1, n.ID)))
			return
		}
		seenNews[n.ID], seenNewsSlug[n.Slug] = true, true
		if n.Status == model.StatusPublished && n.PublishedAt.IsZero() {
			n.PublishedAt = model.Now()
		}
		if n.CreatedAt.IsZero() {
			n.CreatedAt = model.Now()
		}
		if n.UpdatedAt.IsZero() {
			n.UpdatedAt = n.CreatedAt
		}
	}
	seenProd, seenProdSlug := map[string]bool{}, map[string]bool{}
	for i := range b.Products {
		p := &b.Products[i]
		p.Normalize()
		if p.Status == "" {
			p.Status = model.StatusDraft
		}
		if err := validateProduct(p, exists); err != nil {
			err.Msg = M(fmt.Sprintf("products[%d]: %s", i+1, err.Msg.TR), fmt.Sprintf("products[%d]: %s", i+1, err.Msg.EN))
			s.writeAPIError(w, r, err)
			return
		}
		if p.ID == "" {
			p.ID = store.NewID()
		}
		if p.Slug == "" {
			p.Slug = model.Slugify(p.Name)
		}
		base := p.Slug
		for k := 2; seenProdSlug[p.Slug] || p.Slug == ""; k++ {
			p.Slug = fmt.Sprintf("%s-%d", base, k)
		}
		if seenProd[p.ID] {
			s.fail(w, r, http.StatusBadRequest, "bad_request", M(fmt.Sprintf("products[%d]: yinelenen kimlik %s.", i+1, p.ID), fmt.Sprintf("products[%d]: duplicate id %s.", i+1, p.ID)))
			return
		}
		seenProd[p.ID], seenProdSlug[p.Slug] = true, true
		if p.CreatedAt.IsZero() {
			p.CreatedAt = model.Now()
		}
		if p.UpdatedAt.IsZero() {
			p.UpdatedAt = p.CreatedAt
		}
	}
	if err := s.store.Import(b); err != nil {
		s.storeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
