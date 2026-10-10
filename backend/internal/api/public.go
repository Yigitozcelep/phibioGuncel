package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"phibio/backend/internal/model"
)

const bundleNewsLimit = 20

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "time": s.now().UTC().Format(time.RFC3339)})
}

func (s *Server) handlePublicSite(w http.ResponseWriter, r *http.Request) {
	res := s.resolverFor(s.baseURL(r))
	s.writePublicJSON(w, r, res.site(s.store.Site()))
}

// publishedNews returns published articles, newest publishedAt first,
// optionally filtered by category.
func (s *Server) publishedNews(category string) []model.News {
	all := s.store.ListNews()
	out := make([]model.News, 0, len(all))
	for _, n := range all {
		if n.Status != model.StatusPublished {
			continue
		}
		if category != "" && n.Category != category {
			continue
		}
		out = append(out, n)
	}
	sortNewsByPublished(out)
	return out
}

func sortNewsByPublished(list []model.News) {
	sort.SliceStable(list, func(i, j int) bool {
		a, b := list[i], list[j]
		if !a.PublishedAt.Equal(b.PublishedAt.Time) {
			return a.PublishedAt.After(b.PublishedAt.Time)
		}
		if !a.UpdatedAt.Equal(b.UpdatedAt.Time) {
			return a.UpdatedAt.After(b.UpdatedAt.Time)
		}
		return a.ID < b.ID
	})
}

// publishedProducts returns published products sorted by order then name.
func (s *Server) publishedProducts(area string) []model.Product {
	all := s.store.ListProducts()
	out := make([]model.Product, 0, len(all))
	for _, p := range all {
		if p.Status != model.StatusPublished {
			continue
		}
		if area != "" && p.Area != area {
			continue
		}
		out = append(out, p)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Order != out[j].Order {
			return out[i].Order < out[j].Order
		}
		if out[i].Name != out[j].Name {
			return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
		}
		return out[i].ID < out[j].ID
	})
	return out
}

type newsPage struct {
	Items  []NewsSummary `json:"items"`
	Total  int           `json:"total"`
	Limit  int           `json:"limit"`
	Offset int           `json:"offset"`
}

func (s *Server) handlePublicNewsList(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := 20
	if v := strings.TrimSpace(q.Get("limit")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 100 {
			s.fail(w, r, http.StatusBadRequest, "bad_request", M("limit 1 ile 100 arasında olmalı.", "limit must be between 1 and 100."))
			return
		}
		limit = n
	}
	offset := 0
	if v := strings.TrimSpace(q.Get("offset")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 0 {
			s.fail(w, r, http.StatusBadRequest, "bad_request", M("offset 0 veya daha büyük olmalı.", "offset must be 0 or greater."))
			return
		}
		offset = n
	}
	category := strings.ToLower(strings.TrimSpace(q.Get("category")))
	if category != "" && !model.Contains(model.Categories, category) {
		s.fail(w, r, http.StatusBadRequest, "bad_request", M("Geçersiz kategori.", "Invalid category."))
		return
	}
	list := s.publishedNews(category)
	res := s.resolverFor(s.baseURL(r))
	page := newsPage{Items: []NewsSummary{}, Total: len(list), Limit: limit, Offset: offset}
	if offset < len(list) {
		end := offset + limit
		if end > len(list) {
			end = len(list)
		}
		for _, n := range list[offset:end] {
			page.Items = append(page.Items, res.newsSummary(n))
		}
	}
	s.writePublicJSON(w, r, page)
}

func (s *Server) handlePublicNewsItem(w http.ResponseWriter, r *http.Request) {
	n, ok := s.store.GetNewsBySlug(r.PathValue("slug"))
	if !ok || n.Status != model.StatusPublished {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Haber bulunamadı.", "Article not found."))
		return
	}
	res := s.resolverFor(s.baseURL(r))
	s.writePublicJSON(w, r, res.news(n))
}

func (s *Server) handlePublicProductList(w http.ResponseWriter, r *http.Request) {
	area := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("area")))
	if area != "" && !model.Contains(model.Areas, area) {
		s.fail(w, r, http.StatusBadRequest, "bad_request", M("Geçersiz alan.", "Invalid area."))
		return
	}
	res := s.resolverFor(s.baseURL(r))
	out := []ProductOut{}
	for _, p := range s.publishedProducts(area) {
		out = append(out, res.product(p))
	}
	s.writePublicJSON(w, r, out)
}

func (s *Server) handlePublicProductItem(w http.ResponseWriter, r *http.Request) {
	p, ok := s.store.GetProductBySlug(r.PathValue("slug"))
	if !ok || p.Status != model.StatusPublished {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Ürün bulunamadı.", "Product not found."))
		return
	}
	res := s.resolverFor(s.baseURL(r))
	s.writePublicJSON(w, r, res.product(p))
}

// bundleBody is hashed for the version (no generatedAt, no version).
type bundleBody struct {
	Site      SiteOut       `json:"site"`
	Products  []ProductOut  `json:"products"`
	News      []NewsSummary `json:"news"`
	NewsTotal int           `json:"newsTotal"`
}

type bundleOut struct {
	Version     string        `json:"version"`
	GeneratedAt string        `json:"generatedAt"`
	Site        SiteOut       `json:"site"`
	Products    []ProductOut  `json:"products"`
	News        []NewsSummary `json:"news"`
	NewsTotal   int           `json:"newsTotal"`
}

func (s *Server) handlePublicBundle(w http.ResponseWriter, r *http.Request) {
	res := s.resolverFor(s.baseURL(r))
	body := bundleBody{Site: res.site(s.store.Site()), Products: []ProductOut{}, News: []NewsSummary{}}
	for _, p := range s.publishedProducts("") {
		body.Products = append(body.Products, res.product(p))
	}
	news := s.publishedNews("")
	body.NewsTotal = len(news)
	if len(news) > bundleNewsLimit {
		news = news[:bundleNewsLimit]
	}
	for _, n := range news {
		body.News = append(body.News, res.newsSummary(n))
	}
	raw, err := json.Marshal(body)
	if err != nil {
		s.fail(w, r, http.StatusInternalServerError, "internal", M("Paket oluşturulamadı.", "Could not build the bundle."))
		return
	}
	sum := sha256.Sum256(raw)
	// The ETag is derived from the content hash (not generatedAt) so clients
	// get a 304 whenever the content is unchanged.
	w.Header().Set("ETag", `"`+hex.EncodeToString(sum[:16])+`"`)
	out := bundleOut{
		Version:     hex.EncodeToString(sum[:8]),
		GeneratedAt: s.now().UTC().Format(time.RFC3339),
		Site:        body.Site,
		Products:    body.Products,
		News:        body.News,
		NewsTotal:   body.NewsTotal,
	}
	s.writePublicJSON(w, r, out)
}
