package api

import (
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"phibio/backend/internal/media"
)

// handleUpload serves a media file. The name is validated with a strict
// pattern before the disk is touched, so traversal is impossible.
func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("file")
	if !media.FileNamePattern.MatchString(name) {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Dosya bulunamadı.", "File not found."))
		return
	}
	f, err := os.Open(filepath.Join(s.store.UploadsPath(), name))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			s.fail(w, r, http.StatusNotFound, "not_found", M("Dosya bulunamadı.", "File not found."))
			return
		}
		s.fail(w, r, http.StatusInternalServerError, "internal", M("Dosya okunamadı.", "Could not read the file."))
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || info.IsDir() {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Dosya bulunamadı.", "File not found."))
		return
	}
	h := w.Header()
	h.Set("Content-Type", media.ContentTypeFor(name))
	h.Set("Cache-Control", "public, max-age=31536000, immutable")
	h.Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, name, info.ModTime(), f)
}

// handleAdminUI serves the embedded single-page admin panel. Unknown paths
// fall back to index.html (hash routing makes this only a safety net).
func (s *Server) handleAdminUI(w http.ResponseWriter, r *http.Request) {
	if s.cfg.AdminUI == nil {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Yönetim paneli bu derlemede yok.", "The admin panel is not included in this build."))
		return
	}
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Referrer-Policy", "same-origin")

	rel := strings.TrimPrefix(r.URL.Path, "/admin/")
	rel = path.Clean("/" + rel)
	rel = strings.TrimPrefix(rel, "/")
	if rel == "" || rel == "." {
		rel = "index.html"
	}
	if rel != "index.html" {
		if info, err := fs.Stat(s.cfg.AdminUI, rel); err == nil && !info.IsDir() {
			http.ServeFileFS(w, r, s.cfg.AdminUI, rel)
			return
		}
	}
	data, err := fs.ReadFile(s.cfg.AdminUI, "index.html")
	if err != nil {
		s.fail(w, r, http.StatusNotFound, "not_found", M("Yönetim paneli bulunamadı.", "Admin panel not found."))
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}
