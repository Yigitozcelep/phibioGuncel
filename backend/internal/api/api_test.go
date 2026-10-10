package api

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"phibio/backend/internal/auth"
	"phibio/backend/internal/model"
	"phibio/backend/internal/seed"
	"phibio/backend/internal/store"
	seedfiles "phibio/backend/seed"
)

type env struct {
	t      *testing.T
	ts     *httptest.Server
	client *http.Client
	store  *store.Store
	dir    string
}

func newEnv(t *testing.T) *env {
	t.Helper()
	dir := t.TempDir()
	st, err := store.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := seed.Run(st, seedfiles.Files, log.New(io.Discard, "", 0)); err != nil {
		t.Fatalf("seed: %v", err)
	}
	salt, hash, err := auth.HashPassword("test1234")
	if err != nil {
		t.Fatal(err)
	}
	if err := st.PutUser(model.AdminUser{Username: "admin", Salt: salt, Hash: hash, CreatedAt: model.Now()}); err != nil {
		t.Fatal(err)
	}
	ui := fstest.MapFS{
		"index.html":      {Data: []byte("<!doctype html><title>Phibio Admin</title>")},
		"app.js":          {Data: []byte("console.log('ok')")},
		"static/logo.png": {Data: []byte{0x89, 'P', 'N', 'G'}},
	}
	srv := New(Config{CORSOrigins: []string{"*"}, MaxUploadBytes: 5 << 20, AdminUI: ui}, st, auth.NewSessions(time.Hour), auth.NewRateLimiter(5, 15*time.Minute), log.New(io.Discard, "", 0))
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar, CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }}
	return &env{t: t, ts: ts, client: client, store: st, dir: dir}
}

func (e *env) do(method, path string, body any, headers map[string]string) (*http.Response, []byte) {
	e.t.Helper()
	var rdr io.Reader
	if body != nil {
		switch b := body.(type) {
		case []byte:
			rdr = bytes.NewReader(b)
		case string:
			rdr = strings.NewReader(b)
		default:
			data, err := json.Marshal(body)
			if err != nil {
				e.t.Fatal(err)
			}
			rdr = bytes.NewReader(data)
		}
	}
	req, err := http.NewRequest(method, e.ts.URL+path, rdr)
	if err != nil {
		e.t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := e.client.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	return resp, data
}

// admin performs a mutating admin request with the CSRF header.
func (e *env) admin(method, path string, body any) (*http.Response, []byte) {
	e.t.Helper()
	return e.do(method, path, body, map[string]string{CSRFHeader: CSRFValue})
}

func (e *env) login() {
	e.t.Helper()
	resp, body := e.do("POST", "/api/admin/login", map[string]string{"username": "admin", "password": "test1234"}, nil)
	if resp.StatusCode != 200 {
		e.t.Fatalf("login: %d %s", resp.StatusCode, body)
	}
}

func decode(t *testing.T, data []byte, v any) {
	t.Helper()
	if err := json.Unmarshal(data, v); err != nil {
		t.Fatalf("decode %v: %s", err, data)
	}
}

func pngBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x), uint8(y), 200, 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestEndToEnd(t *testing.T) {
	e := newEnv(t)

	// --- public bundle after seed ---
	resp, body := e.do("GET", "/api/v1/bundle", nil, nil)
	if resp.StatusCode != 200 {
		t.Fatalf("bundle: %d %s", resp.StatusCode, body)
	}
	if cc := resp.Header.Get("Cache-Control"); cc != "public, max-age=60" {
		t.Fatalf("cache-control %q", cc)
	}
	if resp.Header.Get("Access-Control-Allow-Origin") != "*" {
		t.Fatal("missing CORS header")
	}
	var bundle struct {
		Version     string        `json:"version"`
		GeneratedAt string        `json:"generatedAt"`
		Site        SiteOut       `json:"site"`
		Products    []ProductOut  `json:"products"`
		News        []NewsSummary `json:"news"`
		NewsTotal   int           `json:"newsTotal"`
	}
	decode(t, body, &bundle)
	if len(bundle.Products) != 3 || len(bundle.News) != 3 || bundle.NewsTotal != 3 {
		t.Fatalf("bundle counts: %d products %d news", len(bundle.Products), len(bundle.News))
	}
	if bundle.Version == "" || bundle.GeneratedAt == "" {
		t.Fatal("bundle version/generatedAt missing")
	}
	if bundle.Site.HeroImage == nil || !strings.HasPrefix(bundle.Site.HeroImage.URL, e.ts.URL+"/uploads/") || !strings.HasSuffix(bundle.Site.HeroImage.URL, "_w1200.jpg") {
		t.Fatalf("hero image not resolved to absolute w1200 url: %+v", bundle.Site.HeroImage)
	}
	if bundle.Site.HeroImage.Width != 1200 || bundle.Site.HeroImage.Height != 675 {
		t.Fatalf("hero dims %dx%d", bundle.Site.HeroImage.Width, bundle.Site.HeroImage.Height)
	}
	if bundle.Site.Contact.Phone != "+496940767397" || len(bundle.Site.Areas) != 3 || len(bundle.Site.Stats) != 3 {
		t.Fatalf("site content: %+v", bundle.Site.Contact)
	}
	if bundle.Products[0].Slug != "viscophi" || bundle.Products[0].Cover == nil || len(bundle.Products[0].Gallery) != 2 {
		t.Fatalf("product 0: %+v", bundle.Products[0])
	}
	// newest first: events (Oct 5), viscophi (Sep 20), app (Sep 1)
	if bundle.News[0].Slug != "phibio-at-international-medical-exhibitions" || bundle.News[2].Slug != "phibio-mobile-app-is-live" {
		t.Fatalf("news order: %s, %s, %s", bundle.News[0].Slug, bundle.News[1].Slug, bundle.News[2].Slug)
	}
	for _, n := range bundle.News {
		if n.Cover == nil || n.Title.TR == "" || n.Title.EN == "" {
			t.Fatalf("news summary incomplete: %+v", n)
		}
	}

	// --- ETag round trip ---
	etag := resp.Header.Get("ETag")
	if etag == "" {
		t.Fatal("no ETag")
	}
	resp, _ = e.do("GET", "/api/v1/bundle", nil, map[string]string{"If-None-Match": etag})
	if resp.StatusCode != 304 {
		t.Fatalf("expected 304, got %d", resp.StatusCode)
	}
	resp, _ = e.do("GET", "/api/v1/site", nil, nil)
	siteEtag := resp.Header.Get("ETag")
	resp, _ = e.do("GET", "/api/v1/site", nil, map[string]string{"If-None-Match": `W/` + siteEtag})
	if resp.StatusCode != 304 {
		t.Fatalf("expected 304 for weak match, got %d", resp.StatusCode)
	}

	// --- news detail + image blocks resolved ---
	resp, body = e.do("GET", "/api/v1/news/viscophi-non-animal-hyaluronic-acid-for-joint-health", nil, nil)
	if resp.StatusCode != 200 {
		t.Fatalf("news detail %d %s", resp.StatusCode, body)
	}
	var article NewsOut
	decode(t, body, &article)
	foundImage := false
	for _, b := range article.Blocks {
		if b.Type == "image" {
			foundImage = true
			if b.Image == nil || b.Image.Thumb == "" {
				t.Fatalf("image block not resolved: %+v", b)
			}
		}
	}
	if !foundImage {
		t.Fatal("seed article has no image block")
	}
	// Public lists and filters.
	resp, body = e.do("GET", "/api/v1/news?limit=2&offset=1&category=product", nil, nil)
	var page newsPage
	decode(t, body, &page)
	if page.Total != 1 || len(page.Items) != 0 || page.Limit != 2 || page.Offset != 1 {
		t.Fatalf("page: %+v", page)
	}
	resp, _ = e.do("GET", "/api/v1/news?limit=0", nil, nil)
	if resp.StatusCode != 400 {
		t.Fatalf("limit=0 should be 400, got %d", resp.StatusCode)
	}
	resp, body = e.do("GET", "/api/v1/products?area=dermatology", nil, nil)
	var products []ProductOut
	decode(t, body, &products)
	if len(products) != 1 || products[0].Name != "PhilExir™" {
		t.Fatalf("area filter: %+v", products)
	}
	resp, _ = e.do("GET", "/api/v1/products/nope", nil, nil)
	if resp.StatusCode != 404 {
		t.Fatalf("unknown product: %d", resp.StatusCode)
	}

	// --- uploads: variant served, traversal blocked ---
	resp, body = e.do("GET", strings.TrimPrefix(bundle.Site.HeroImage.Thumb, e.ts.URL), nil, nil)
	if resp.StatusCode != 200 || resp.Header.Get("Content-Type") != "image/jpeg" || !strings.Contains(resp.Header.Get("Cache-Control"), "immutable") {
		t.Fatalf("thumb: %d %s %s", resp.StatusCode, resp.Header.Get("Content-Type"), resp.Header.Get("Cache-Control"))
	}
	if cfg, err := png.DecodeConfig(bytes.NewReader(body)); err == nil && cfg.Width > 0 {
		t.Fatal("thumb should be jpeg, decoded as png")
	}
	for _, bad := range []string{"/uploads/..%2F..%2Fetc%2Fpasswd", "/uploads/users.json", "/uploads/ZZZZ.jpg"} {
		resp, _ = e.do("GET", bad, nil, nil)
		if resp.StatusCode != 404 {
			t.Fatalf("%s: expected 404 got %d", bad, resp.StatusCode)
		}
	}

	// --- admin UI ---
	resp, body = e.do("GET", "/admin/", nil, nil)
	if resp.StatusCode != 200 || !strings.Contains(resp.Header.Get("Content-Type"), "text/html") || !strings.Contains(string(body), "Phibio Admin") {
		t.Fatalf("admin ui: %d %s", resp.StatusCode, body)
	}
	if resp.Header.Get("Cache-Control") != "no-cache" {
		t.Fatalf("admin cache-control %q", resp.Header.Get("Cache-Control"))
	}
	resp, body = e.do("GET", "/admin/app.js", nil, nil)
	if resp.StatusCode != 200 || !strings.Contains(string(body), "console.log") {
		t.Fatalf("admin static: %d", resp.StatusCode)
	}
	resp, body = e.do("GET", "/admin/news/123", nil, nil)
	if resp.StatusCode != 200 || !strings.Contains(string(body), "Phibio Admin") {
		t.Fatalf("admin fallback: %d", resp.StatusCode)
	}
	for _, p := range []string{"/", "/admin"} {
		resp, _ = e.do("GET", p, nil, nil)
		if resp.StatusCode != 302 || resp.Header.Get("Location") != "/admin/" {
			t.Fatalf("%s redirect: %d %s", p, resp.StatusCode, resp.Header.Get("Location"))
		}
	}

	// --- auth ---
	resp, _ = e.do("GET", "/api/admin/me", nil, nil)
	if resp.StatusCode != 401 {
		t.Fatalf("me without session: %d", resp.StatusCode)
	}
	resp, body = e.do("POST", "/api/admin/login", map[string]string{"username": "admin", "password": "wrong"}, nil)
	if resp.StatusCode != 401 {
		t.Fatalf("wrong password: %d %s", resp.StatusCode, body)
	}
	var errBody errorBody
	decode(t, body, &errBody)
	if errBody.Code != "unauthorized" || errBody.Error == "" {
		t.Fatalf("error shape: %+v", errBody)
	}
	e.login()
	resp, body = e.do("GET", "/api/admin/me", nil, nil)
	if resp.StatusCode != 200 || !strings.Contains(string(body), `"admin"`) {
		t.Fatalf("me: %d %s", resp.StatusCode, body)
	}
	// Missing CSRF header → 403.
	resp, _ = e.do("POST", "/api/admin/news", map[string]any{"title": map[string]string{"en": "x"}}, nil)
	if resp.StatusCode != 403 {
		t.Fatalf("missing csrf header: %d", resp.StatusCode)
	}

	// --- create draft news ---
	draft := map[string]any{
		"title":    map[string]string{"tr": "Yeni duyuru", "en": "New announcement"},
		"summary":  map[string]string{"tr": "Özet", "en": "Summary"},
		"category": "news",
		"status":   "draft",
		"blocks": []map[string]any{
			{"type": "paragraph", "text": map[string]string{"tr": "Merhaba", "en": "Hello"}},
			{"type": "button", "url": "https://www.phibio.de", "label": map[string]string{"tr": "Site", "en": "Site"}},
		},
	}
	resp, body = e.admin("POST", "/api/admin/news", draft)
	if resp.StatusCode != 201 {
		t.Fatalf("create news: %d %s", resp.StatusCode, body)
	}
	var created NewsOut
	decode(t, body, &created)
	if created.ID == "" || created.Slug != "new-announcement" || created.Status != "draft" || !created.PublishedAt.IsZero() {
		t.Fatalf("created: %+v", created)
	}
	// Draft is not public.
	resp, _ = e.do("GET", "/api/v1/news/new-announcement", nil, nil)
	if resp.StatusCode != 404 {
		t.Fatalf("draft visible publicly: %d", resp.StatusCode)
	}
	resp, body = e.do("GET", "/api/v1/news", nil, nil)
	decode(t, body, &page)
	if page.Total != 3 {
		t.Fatalf("draft counted publicly: %d", page.Total)
	}
	// Same title again → slug gets -2.
	resp, body = e.admin("POST", "/api/admin/news", draft)
	var second NewsOut
	decode(t, body, &second)
	if resp.StatusCode != 201 || second.Slug != "new-announcement-2" {
		t.Fatalf("second slug: %d %s", resp.StatusCode, second.Slug)
	}
	// Update to an existing slug → 409.
	upd := draft
	upd["slug"] = "new-announcement"
	resp, body = e.admin("PUT", "/api/admin/news/"+second.ID, upd)
	if resp.StatusCode != 409 {
		t.Fatalf("duplicate slug on update: %d %s", resp.StatusCode, body)
	}
	resp, _ = e.admin("DELETE", "/api/admin/news/"+second.ID, nil)
	if resp.StatusCode != 204 {
		t.Fatalf("delete second: %d", resp.StatusCode)
	}
	// Validation errors.
	bad := map[string]any{"title": map[string]string{"tr": "", "en": ""}, "status": "draft"}
	resp, body = e.admin("POST", "/api/admin/news", bad)
	if resp.StatusCode != 400 || !strings.Contains(string(body), "title") {
		t.Fatalf("empty title: %d %s", resp.StatusCode, body)
	}
	bad = map[string]any{"title": map[string]string{"en": "x"}, "status": "draft", "cover": "0000000000000000"}
	resp, body = e.admin("POST", "/api/admin/news", bad)
	if resp.StatusCode != 400 || !strings.Contains(string(body), "cover") {
		t.Fatalf("unknown cover: %d %s", resp.StatusCode, body)
	}
	bad = map[string]any{"title": map[string]string{"en": "x"}, "status": "draft", "blocks": []map[string]any{{"type": "button", "url": "javascript:alert(1)", "label": map[string]string{"en": "x"}}}}
	resp, body = e.admin("POST", "/api/admin/news", bad)
	if resp.StatusCode != 400 || !strings.Contains(string(body), "blocks[1]") {
		t.Fatalf("bad button url: %d %s", resp.StatusCode, body)
	}
	// Turkish error message via Accept-Language.
	resp, body = e.do("POST", "/api/admin/news", bad, map[string]string{CSRFHeader: CSRFValue, "Accept-Language": "tr-TR,tr;q=0.9"})
	if resp.StatusCode != 400 || !strings.Contains(string(body), "başlamalı") {
		t.Fatalf("turkish message: %d %s", resp.StatusCode, body)
	}

	// --- publish ---
	published := draft
	delete(published, "slug")
	published["status"] = "published"
	resp, body = e.admin("PUT", "/api/admin/news/"+created.ID, published)
	if resp.StatusCode != 200 {
		t.Fatalf("publish: %d %s", resp.StatusCode, body)
	}
	var pub NewsOut
	decode(t, body, &pub)
	if pub.Status != "published" || pub.PublishedAt.IsZero() || pub.Slug != "new-announcement" {
		t.Fatalf("published: %+v", pub)
	}
	resp, body = e.do("GET", "/api/v1/news/new-announcement", nil, nil)
	if resp.StatusCode != 200 {
		t.Fatalf("published article not public: %d %s", resp.StatusCode, body)
	}
	resp, body = e.do("GET", "/api/v1/bundle", nil, nil)
	decode(t, body, &bundle)
	if bundle.NewsTotal != 4 || bundle.News[0].Slug != "new-announcement" {
		t.Fatalf("bundle after publish: total %d first %s", bundle.NewsTotal, bundle.News[0].Slug)
	}

	// --- upload PNG ---
	var mp bytes.Buffer
	mw := multipart.NewWriter(&mp)
	fw, _ := mw.CreateFormFile("file", "Test Photo (1).png")
	_, _ = fw.Write(pngBytes(t, 1600, 900))
	_ = mw.WriteField("altTr", "Test görseli")
	_ = mw.WriteField("altEn", "Test image")
	_ = mw.Close()
	req, _ := http.NewRequest("POST", e.ts.URL+"/api/admin/media", &mp)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set(CSRFHeader, CSRFValue)
	r2, err := e.client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body, _ = io.ReadAll(r2.Body)
	r2.Body.Close()
	if r2.StatusCode != 201 {
		t.Fatalf("upload: %d %s", r2.StatusCode, body)
	}
	var uploaded MediaOut
	decode(t, body, &uploaded)
	if uploaded.Width != 1600 || uploaded.Height != 900 || uploaded.Mime != "image/png" || uploaded.FileName != "Test-Photo-1-.png" || uploaded.Alt.TR != "Test görseli" {
		t.Fatalf("uploaded meta: %+v", uploaded)
	}
	for _, k := range []string{"orig", "w1200", "w400"} {
		name := uploaded.Variants[k]
		if name == "" {
			t.Fatalf("variant %s missing", k)
		}
		if _, err := os.Stat(filepath.Join(e.dir, "uploads", name)); err != nil {
			t.Fatalf("variant file %s missing", name)
		}
	}
	if !strings.HasSuffix(uploaded.URL, "_w1200.jpg") || !strings.HasSuffix(uploaded.Thumb, "_w400.jpg") || !strings.HasSuffix(uploaded.Orig, ".png") {
		t.Fatalf("urls: %s %s %s", uploaded.URL, uploaded.Thumb, uploaded.Orig)
	}
	resp, body = e.do("GET", strings.TrimPrefix(uploaded.Orig, e.ts.URL), nil, nil)
	if resp.StatusCode != 200 || resp.Header.Get("Content-Type") != "image/png" {
		t.Fatalf("orig png: %d %s", resp.StatusCode, resp.Header.Get("Content-Type"))
	}
	// Non-image upload rejected.
	mp.Reset()
	mw = multipart.NewWriter(&mp)
	fw, _ = mw.CreateFormFile("file", "evil.png")
	_, _ = fw.Write([]byte("<html><script>alert(1)</script></html>"))
	_ = mw.Close()
	req, _ = http.NewRequest("POST", e.ts.URL+"/api/admin/media", &mp)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set(CSRFHeader, CSRFValue)
	r2, _ = e.client.Do(req)
	r2.Body.Close()
	if r2.StatusCode != 400 {
		t.Fatalf("html upload accepted: %d", r2.StatusCode)
	}

	// Use the upload as cover (ImageRef object form) → media delete is 409.
	published["cover"] = map[string]any{"id": uploaded.ID, "url": uploaded.URL}
	resp, body = e.admin("PUT", "/api/admin/news/"+created.ID, published)
	if resp.StatusCode != 200 {
		t.Fatalf("set cover: %d %s", resp.StatusCode, body)
	}
	decode(t, body, &pub)
	if pub.Cover == nil || pub.Cover.ID != uploaded.ID {
		t.Fatalf("cover not resolved: %+v", pub.Cover)
	}
	resp, body = e.admin("DELETE", "/api/admin/media/"+uploaded.ID, nil)
	if resp.StatusCode != 409 {
		t.Fatalf("delete used media: %d %s", resp.StatusCode, body)
	}
	// Alt update.
	resp, body = e.admin("PUT", "/api/admin/media/"+uploaded.ID, map[string]any{"alt": map[string]string{"tr": "Yeni", "en": "New"}})
	if resp.StatusCode != 200 || !strings.Contains(string(body), `"Yeni"`) {
		t.Fatalf("alt update: %d %s", resp.StatusCode, body)
	}
	// Stats.
	resp, body = e.do("GET", "/api/admin/stats", nil, nil)
	var stats struct {
		News, Published, Products, Media int
		LatestNews                       []AdminNewsSummary `json:"latestNews"`
	}
	decode(t, body, &stats)
	if stats.News != 4 || stats.Published != 4 || stats.Products != 3 || stats.Media != 11 || len(stats.LatestNews) != 4 || stats.LatestNews[0].ID != created.ID {
		t.Fatalf("stats: %s", body)
	}
	// Delete news → media delete ok → files gone.
	resp, _ = e.admin("DELETE", "/api/admin/news/"+created.ID, nil)
	if resp.StatusCode != 204 {
		t.Fatalf("delete news: %d", resp.StatusCode)
	}
	resp, body = e.admin("DELETE", "/api/admin/media/"+uploaded.ID, nil)
	if resp.StatusCode != 204 {
		t.Fatalf("delete media: %d %s", resp.StatusCode, body)
	}
	if _, err := os.Stat(filepath.Join(e.dir, "uploads", uploaded.Variants["orig"])); err == nil {
		t.Fatal("media file not removed")
	}
	resp, _ = e.do("GET", "/api/v1/news/new-announcement", nil, nil)
	if resp.StatusCode != 404 {
		t.Fatalf("deleted article still public: %d", resp.StatusCode)
	}

	// --- products: create, slug, 409 ---
	prod := map[string]any{"name": "ViscoPhi™", "area": "orthopaedics", "status": "draft", "order": 9}
	resp, body = e.admin("POST", "/api/admin/products", prod)
	var newProd ProductOut
	decode(t, body, &newProd)
	if resp.StatusCode != 201 || newProd.Slug != "viscophi-2" {
		t.Fatalf("product create: %d %s", resp.StatusCode, body)
	}
	prod["slug"] = "viscophi"
	resp, _ = e.admin("PUT", "/api/admin/products/"+newProd.ID, prod)
	if resp.StatusCode != 409 {
		t.Fatalf("product duplicate slug: %d", resp.StatusCode)
	}
	prod["area"] = "cardiology"
	delete(prod, "slug")
	resp, body = e.admin("PUT", "/api/admin/products/"+newProd.ID, prod)
	if resp.StatusCode != 400 || !strings.Contains(string(body), "area") {
		t.Fatalf("bad area: %d %s", resp.StatusCode, body)
	}
	resp, body = e.do("GET", "/api/v1/products", nil, nil)
	decode(t, body, &products)
	if len(products) != 3 {
		t.Fatalf("draft product public: %d", len(products))
	}
	resp, _ = e.admin("DELETE", "/api/admin/products/"+newProd.ID, nil)
	if resp.StatusCode != 204 {
		t.Fatalf("product delete: %d", resp.StatusCode)
	}

	// --- site settings round trip with ImageRef objects ---
	resp, body = e.do("GET", "/api/admin/site", nil, nil)
	var site map[string]any
	decode(t, body, &site)
	site["companyName"] = "Phibio GmbH (test)"
	resp, body = e.admin("PUT", "/api/admin/site", site)
	if resp.StatusCode != 200 {
		t.Fatalf("site put: %d %s", resp.StatusCode, body)
	}
	var siteOut SiteOut
	decode(t, body, &siteOut)
	if siteOut.CompanyName != "Phibio GmbH (test)" || siteOut.HeroImage == nil || len(siteOut.Areas) != 3 || siteOut.Areas[0].Image == nil {
		t.Fatalf("site round trip lost images: %+v", siteOut.HeroImage)
	}

	// --- export / import ---
	resp, body = e.do("GET", "/api/admin/export", nil, nil)
	if resp.StatusCode != 200 {
		t.Fatalf("export: %d", resp.StatusCode)
	}
	var backup store.Backup
	decode(t, body, &backup)
	if len(backup.News) != 3 || len(backup.Products) != 3 || len(backup.Media) != 10 || string(backup.Site.HeroImage) == "" {
		t.Fatalf("export shape: news %d products %d media %d", len(backup.News), len(backup.Products), len(backup.Media))
	}
	backup.News = backup.News[:1]
	resp, body = e.admin("POST", "/api/admin/import", backup)
	if resp.StatusCode != 204 {
		t.Fatalf("import: %d %s", resp.StatusCode, body)
	}
	resp, body = e.do("GET", "/api/v1/news", nil, nil)
	decode(t, body, &page)
	if page.Total != 1 {
		t.Fatalf("after import total %d", page.Total)
	}
	// Reload from disk → same data.
	st2, err := store.Open(e.dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(st2.ListNews()) != 1 || len(st2.ListProducts()) != 3 || st2.Site().CompanyName != "Phibio GmbH (test)" {
		t.Fatal("persisted state mismatch after reload")
	}

	// --- password change ---
	resp, body = e.admin("PUT", "/api/admin/password", map[string]string{"current": "test1234", "new": "short"})
	if resp.StatusCode != 400 {
		t.Fatalf("short password: %d %s", resp.StatusCode, body)
	}
	resp, body = e.admin("PUT", "/api/admin/password", map[string]string{"current": "nope", "new": "longenough1"})
	if resp.StatusCode != 400 {
		t.Fatalf("wrong current: %d %s", resp.StatusCode, body)
	}
	resp, _ = e.admin("PUT", "/api/admin/password", map[string]string{"current": "test1234", "new": "longenough1"})
	if resp.StatusCode != 204 {
		t.Fatalf("password change: %d", resp.StatusCode)
	}
	resp, _ = e.admin("POST", "/api/admin/logout", nil)
	if resp.StatusCode != 204 {
		t.Fatalf("logout: %d", resp.StatusCode)
	}
	resp, _ = e.do("GET", "/api/admin/me", nil, nil)
	if resp.StatusCode != 401 {
		t.Fatalf("after logout: %d", resp.StatusCode)
	}
	resp, _ = e.do("POST", "/api/admin/login", map[string]string{"username": "admin", "password": "longenough1"}, nil)
	if resp.StatusCode != 200 {
		t.Fatalf("login with new password: %d", resp.StatusCode)
	}
}

func TestLoginRateLimit(t *testing.T) {
	e := newEnv(t)
	for i := 0; i < 5; i++ {
		resp, _ := e.do("POST", "/api/admin/login", map[string]string{"username": "admin", "password": "bad"}, nil)
		if resp.StatusCode != 401 {
			t.Fatalf("attempt %d: %d", i, resp.StatusCode)
		}
	}
	resp, body := e.do("POST", "/api/admin/login", map[string]string{"username": "admin", "password": "test1234"}, nil)
	if resp.StatusCode != 429 || resp.Header.Get("Retry-After") == "" {
		t.Fatalf("expected 429, got %d %s", resp.StatusCode, body)
	}
}

func TestPanicRecoveryAndCORSPreflight(t *testing.T) {
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	srv := New(Config{CORSOrigins: []string{"https://app.example"}}, st, auth.NewSessions(0), auth.NewRateLimiter(0, 0), log.New(io.Discard, "", 0))
	h := srv.recoverer(srv.logging(srv.cors(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/boom" {
			panic("boom")
		}
		w.WriteHeader(200)
	}))))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/boom", nil))
	if rec.Code != 500 || !strings.Contains(rec.Body.String(), `"internal"`) {
		t.Fatalf("panic: %d %s", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	req := httptest.NewRequest("OPTIONS", "/api/v1/site", nil)
	req.Header.Set("Origin", "https://app.example")
	h.ServeHTTP(rec, req)
	if rec.Code != 204 || rec.Header().Get("Access-Control-Allow-Origin") != "https://app.example" {
		t.Fatalf("preflight: %d %v", rec.Code, rec.Header())
	}
	rec = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/api/v1/site", nil)
	req.Header.Set("Origin", "https://evil.example")
	h.ServeHTTP(rec, req)
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("disallowed origin got CORS header")
	}
}

func TestBaseURLAndSecureCookie(t *testing.T) {
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	srv := New(Config{}, st, auth.NewSessions(0), auth.NewRateLimiter(0, 0), log.New(io.Discard, "", 0))
	req := httptest.NewRequest("GET", "/api/v1/site", nil)
	req.Host = "api.phibio.de"
	req.Header.Set("X-Forwarded-Proto", "https")
	if got := srv.baseURL(req); got != "https://api.phibio.de" {
		t.Fatalf("baseURL %q", got)
	}
	if !isSecure(req) {
		t.Fatal("forwarded https should be secure")
	}
	srv2 := New(Config{BaseURL: "https://cdn.example/"}, st, auth.NewSessions(0), auth.NewRateLimiter(0, 0), nil)
	if got := srv2.baseURL(req); got != "https://cdn.example" {
		t.Fatalf("configured baseURL %q", got)
	}
	plain := httptest.NewRequest("GET", "/", nil)
	plain.Host = "localhost:8080"
	if got := srv.baseURL(plain); got != "http://localhost:8080" {
		t.Fatalf("plain baseURL %q", got)
	}
	plain.RemoteAddr = "127.0.0.1:1234"
	plain.Header.Set("X-Forwarded-For", "203.0.113.5, 10.0.0.1")
	if ip := clientIP(plain); ip != "203.0.113.5" {
		t.Fatalf("clientIP via proxy %q", ip)
	}
	plain.RemoteAddr = "198.51.100.7:1234"
	if ip := clientIP(plain); ip != "198.51.100.7" {
		t.Fatalf("clientIP direct %q (XFF must be ignored)", ip)
	}
}
