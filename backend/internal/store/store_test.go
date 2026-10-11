package store

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"phibio/backend/internal/model"
)

func TestAtomicWriteAndReload(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !s.IsFirstRun() {
		t.Fatal("expected first run")
	}
	n := model.News{ID: NewID(), Slug: "hello", Title: model.LocalizedString{EN: "Hello"}, Status: model.StatusDraft}
	if err := s.PutNews(n); err != nil {
		t.Fatal(err)
	}
	site := model.SiteSettings{CompanyName: "Phibio GmbH"}
	if err := s.SetSite(site); err != nil {
		t.Fatal(err)
	}
	// No temp files may be left behind and the file must be valid JSON.
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".tmp") {
			t.Fatalf("temp file left behind: %s", e.Name())
		}
	}
	data, err := os.ReadFile(filepath.Join(dir, NewsFile))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `"slug": "hello"`) {
		t.Fatalf("news.json not pretty-printed or missing content: %s", data)
	}

	// Reload into a fresh store.
	s2, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if s2.IsFirstRun() {
		t.Fatal("expected site.json to exist")
	}
	got, ok := s2.GetNews(n.ID)
	if !ok || got.Slug != "hello" || got.Title.EN != "Hello" {
		t.Fatalf("reload mismatch: %+v", got)
	}
	if got.Tags == nil || got.Blocks == nil {
		t.Fatal("slices must be non-nil after reload")
	}
	if s2.Site().CompanyName != "Phibio GmbH" {
		t.Fatal("site not reloaded")
	}

	// Unique slug generation.
	if got := s2.UniqueNewsSlug("hello", ""); got != "hello-2" {
		t.Fatalf("UniqueNewsSlug = %q", got)
	}
	if got := s2.UniqueNewsSlug("hello", n.ID); got != "hello" {
		t.Fatalf("UniqueNewsSlug with exclusion = %q", got)
	}
	if got := s2.UniqueNewsSlug("", ""); got != "item" {
		t.Fatalf("UniqueNewsSlug empty = %q", got)
	}

	// Delete.
	if err := s2.DeleteNews(n.ID); err != nil {
		t.Fatal(err)
	}
	if err := s2.DeleteNews(n.ID); err != ErrNotFound {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestCorruptFileFailsFast(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, NewsFile), []byte("{not json"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, err := Open(dir)
	if err == nil || !strings.Contains(err.Error(), "corrupt") {
		t.Fatalf("expected corrupt error, got %v", err)
	}
}

func TestMediaUsage(t *testing.T) {
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	m := model.Media{ID: "aaaaaaaaaaaaaaaa", Variants: map[string]string{}}
	if err := s.PutMedia(m); err != nil {
		t.Fatal(err)
	}
	if s.MediaUsageOf(m.ID).Used() {
		t.Fatal("unused media reported as used")
	}
	p := model.Product{ID: NewID(), Name: "X", Blocks: []model.Block{{Type: "image", Image: model.MediaID(m.ID)}}}
	if err := s.PutProduct(p); err != nil {
		t.Fatal(err)
	}
	u := s.MediaUsageOf(m.ID)
	if !u.Used() || len(u.Products) != 1 {
		t.Fatalf("expected product usage, got %+v", u)
	}
}

func TestNewID(t *testing.T) {
	id := NewID()
	if len(id) != 16 {
		t.Fatalf("id length %d", len(id))
	}
	for _, c := range id {
		if !strings.ContainsRune("0123456789abcdef", c) {
			t.Fatalf("non-hex char in id %q", id)
		}
	}
}
