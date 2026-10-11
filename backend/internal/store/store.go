// Package store keeps every collection in memory, guarded by a RWMutex, and
// persists each collection as a pretty-printed JSON file in DATA_DIR using an
// atomic write (temp file in the same directory, fsync, rename).
package store

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"phibio/backend/internal/model"
)

// File names inside DATA_DIR.
const (
	SiteFile     = "site.json"
	NewsFile     = "news.json"
	ProductsFile = "products.json"
	MediaFile    = "media.json"
	UsersFile    = "users.json"
	UploadsDir   = "uploads"
)

// ErrNotFound is returned when a document does not exist.
var ErrNotFound = errors.New("not found")

// Store is the in-memory database with JSON persistence.
type Store struct {
	dir string

	mu       sync.RWMutex
	site     model.SiteSettings
	siteSet  bool
	anyData  bool
	news     []model.News
	products []model.Product
	media    []model.Media
	users    []model.AdminUser
}

// Open creates the data directory (and uploads/) if needed and loads every
// collection. A corrupt file is a fatal error; a missing file means empty.
func Open(dir string) (*Store, error) {
	if err := os.MkdirAll(filepath.Join(dir, UploadsDir), 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	s := &Store{dir: dir}
	if err := s.load(); err != nil {
		return nil, err
	}
	return s, nil
}

// Dir returns the data directory.
func (s *Store) Dir() string { return s.dir }

// UploadsPath returns the absolute uploads directory.
func (s *Store) UploadsPath() string { return filepath.Join(s.dir, UploadsDir) }

// IsFirstRun reports whether site.json did not exist when the store was opened.
func (s *Store) IsFirstRun() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return !s.siteSet
}

// HasAnyData reports whether any other collection file (news, products, media,
// users) existed when the store was opened. Used to refuse re-seeding into a
// data directory that only lost its site.json.
func (s *Store) HasAnyData() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.anyData
}

func (s *Store) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	ok, err := readJSON(filepath.Join(s.dir, SiteFile), &s.site)
	if err != nil {
		return err
	}
	s.siteSet = ok
	s.site.Normalize()

	okNews, err := readJSON(filepath.Join(s.dir, NewsFile), &s.news)
	if err != nil {
		return err
	}
	okProducts, err := readJSON(filepath.Join(s.dir, ProductsFile), &s.products)
	if err != nil {
		return err
	}
	okMedia, err := readJSON(filepath.Join(s.dir, MediaFile), &s.media)
	if err != nil {
		return err
	}
	okUsers, err := readJSON(filepath.Join(s.dir, UsersFile), &s.users)
	if err != nil {
		return err
	}
	s.anyData = okNews || okProducts || okMedia || okUsers
	for i := range s.news {
		s.news[i].Normalize()
	}
	for i := range s.products {
		s.products[i].Normalize()
	}
	for i := range s.media {
		if s.media[i].Variants == nil {
			s.media[i].Variants = map[string]string{}
		}
	}
	if s.news == nil {
		s.news = []model.News{}
	}
	if s.products == nil {
		s.products = []model.Product{}
	}
	if s.media == nil {
		s.media = []model.Media{}
	}
	if s.users == nil {
		s.users = []model.AdminUser{}
	}
	return nil
}

// readJSON loads a file into v. It returns (false, nil) when the file does not
// exist and a descriptive error when the file cannot be parsed.
func readJSON(path string, v any) (bool, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("read %s: %w", path, err)
	}
	if len(strings.TrimSpace(string(data))) == 0 {
		return false, nil
	}
	if err := json.Unmarshal(data, v); err != nil {
		return false, fmt.Errorf("data file %s is corrupt (%v); fix or remove the file and restart", path, err)
	}
	return true, nil
}

// WriteJSONAtomic writes v as pretty JSON to path via temp file + fsync +
// rename, so readers never observe a partially written file.
func WriteJSONAtomic(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("encode %s: %w", path, err)
	}
	data = append(data, '\n')
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, "."+filepath.Base(path)+".*.tmp")
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	tmpName := tmp.Name()
	cleanup := func() { _ = os.Remove(tmpName) }
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		cleanup()
		return fmt.Errorf("write %s: %w", tmpName, err)
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		cleanup()
		return fmt.Errorf("fsync %s: %w", tmpName, err)
	}
	if err := tmp.Close(); err != nil {
		cleanup()
		return fmt.Errorf("close %s: %w", tmpName, err)
	}
	if err := os.Chmod(tmpName, 0o644); err != nil {
		cleanup()
		return fmt.Errorf("chmod %s: %w", tmpName, err)
	}
	if err := os.Rename(tmpName, path); err != nil {
		cleanup()
		return fmt.Errorf("rename %s: %w", path, err)
	}
	// fsync the directory so the rename itself is durable.
	if d, err := os.Open(dir); err == nil {
		_ = d.Sync()
		d.Close()
	}
	return nil
}

func (s *Store) persistSite() error {
	return WriteJSONAtomic(filepath.Join(s.dir, SiteFile), s.site)
}
func (s *Store) persistNews() error {
	return WriteJSONAtomic(filepath.Join(s.dir, NewsFile), s.news)
}
func (s *Store) persistProducts() error {
	return WriteJSONAtomic(filepath.Join(s.dir, ProductsFile), s.products)
}
func (s *Store) persistMedia() error {
	return WriteJSONAtomic(filepath.Join(s.dir, MediaFile), s.media)
}
func (s *Store) persistUsers() error {
	return WriteJSONAtomic(filepath.Join(s.dir, UsersFile), s.users)
}

// NewID returns 16 lowercase hex characters from crypto/rand.
func NewID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic("crypto/rand unavailable: " + err.Error())
	}
	return hex.EncodeToString(b[:])
}

// ---- Site --------------------------------------------------------------

// Site returns a copy of the site settings.
func (s *Store) Site() model.SiteSettings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return cloneSite(s.site)
}

// SetSite replaces the site settings and persists them.
func (s *Store) SetSite(site model.SiteSettings) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	site.Normalize()
	site.UpdatedAt = model.Now()
	prev, prevSet := s.site, s.siteSet
	s.site, s.siteSet = site, true
	if err := s.persistSite(); err != nil {
		s.site, s.siteSet = prev, prevSet
		return err
	}
	return nil
}

// ---- News --------------------------------------------------------------

// ListNews returns copies of all articles (unordered, as stored).
func (s *Store) ListNews() []model.News {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]model.News, len(s.news))
	for i := range s.news {
		out[i] = cloneNews(s.news[i])
	}
	return out
}

// GetNews returns an article by id.
func (s *Store) GetNews(id string) (model.News, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for i := range s.news {
		if s.news[i].ID == id {
			return cloneNews(s.news[i]), true
		}
	}
	return model.News{}, false
}

// GetNewsBySlug returns an article by slug.
func (s *Store) GetNewsBySlug(slug string) (model.News, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for i := range s.news {
		if s.news[i].Slug == slug {
			return cloneNews(s.news[i]), true
		}
	}
	return model.News{}, false
}

// NewsSlugTaken reports whether another article (id != exceptID) owns slug.
func (s *Store) NewsSlugTaken(slug, exceptID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.newsSlugTakenLocked(slug, exceptID)
}

func (s *Store) newsSlugTakenLocked(slug, exceptID string) bool {
	for i := range s.news {
		if s.news[i].Slug == slug && s.news[i].ID != exceptID {
			return true
		}
	}
	return false
}

// UniqueNewsSlug returns base, or base-2, base-3 ... until free.
func (s *Store) UniqueNewsSlug(base, exceptID string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return uniqueSlug(base, func(c string) bool { return s.newsSlugTakenLocked(c, exceptID) })
}

// PutNews inserts or replaces an article (matched by ID) and persists.
func (s *Store) PutNews(n model.News) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	n.Normalize()
	prev := s.news
	next := make([]model.News, 0, len(prev)+1)
	replaced := false
	for _, existing := range prev {
		if existing.ID == n.ID {
			next = append(next, n)
			replaced = true
		} else {
			next = append(next, existing)
		}
	}
	if !replaced {
		next = append(next, n)
	}
	s.news = next
	if err := s.persistNews(); err != nil {
		s.news = prev
		return err
	}
	return nil
}

// DeleteNews removes an article by id.
func (s *Store) DeleteNews(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	prev := s.news
	next := make([]model.News, 0, len(prev))
	found := false
	for _, n := range prev {
		if n.ID == id {
			found = true
			continue
		}
		next = append(next, n)
	}
	if !found {
		return ErrNotFound
	}
	s.news = next
	if err := s.persistNews(); err != nil {
		s.news = prev
		return err
	}
	return nil
}

// ---- Products ----------------------------------------------------------

// ListProducts returns copies of all products.
func (s *Store) ListProducts() []model.Product {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]model.Product, len(s.products))
	for i := range s.products {
		out[i] = cloneProduct(s.products[i])
	}
	return out
}

// GetProduct returns a product by id.
func (s *Store) GetProduct(id string) (model.Product, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for i := range s.products {
		if s.products[i].ID == id {
			return cloneProduct(s.products[i]), true
		}
	}
	return model.Product{}, false
}

// GetProductBySlug returns a product by slug.
func (s *Store) GetProductBySlug(slug string) (model.Product, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for i := range s.products {
		if s.products[i].Slug == slug {
			return cloneProduct(s.products[i]), true
		}
	}
	return model.Product{}, false
}

// ProductSlugTaken reports whether another product owns slug.
func (s *Store) ProductSlugTaken(slug, exceptID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.productSlugTakenLocked(slug, exceptID)
}

func (s *Store) productSlugTakenLocked(slug, exceptID string) bool {
	for i := range s.products {
		if s.products[i].Slug == slug && s.products[i].ID != exceptID {
			return true
		}
	}
	return false
}

// UniqueProductSlug returns base, or base-2, base-3 ... until free.
func (s *Store) UniqueProductSlug(base, exceptID string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return uniqueSlug(base, func(c string) bool { return s.productSlugTakenLocked(c, exceptID) })
}

// PutProduct inserts or replaces a product and persists.
func (s *Store) PutProduct(p model.Product) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	p.Normalize()
	prev := s.products
	next := make([]model.Product, 0, len(prev)+1)
	replaced := false
	for _, existing := range prev {
		if existing.ID == p.ID {
			next = append(next, p)
			replaced = true
		} else {
			next = append(next, existing)
		}
	}
	if !replaced {
		next = append(next, p)
	}
	s.products = next
	if err := s.persistProducts(); err != nil {
		s.products = prev
		return err
	}
	return nil
}

// DeleteProduct removes a product by id.
func (s *Store) DeleteProduct(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	prev := s.products
	next := make([]model.Product, 0, len(prev))
	found := false
	for _, p := range prev {
		if p.ID == id {
			found = true
			continue
		}
		next = append(next, p)
	}
	if !found {
		return ErrNotFound
	}
	s.products = next
	if err := s.persistProducts(); err != nil {
		s.products = prev
		return err
	}
	return nil
}

// ---- Media -------------------------------------------------------------

// ListMedia returns copies of all media, newest first.
func (s *Store) ListMedia() []model.Media {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]model.Media, len(s.media))
	for i := range s.media {
		out[i] = cloneMedia(s.media[i])
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt.Time) })
	return out
}

// GetMedia returns a media document by id.
func (s *Store) GetMedia(id string) (model.Media, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for i := range s.media {
		if s.media[i].ID == id {
			return cloneMedia(s.media[i]), true
		}
	}
	return model.Media{}, false
}

// MediaMap returns id → media for fast resolution.
func (s *Store) MediaMap() map[string]model.Media {
	s.mu.RLock()
	defer s.mu.RUnlock()
	m := make(map[string]model.Media, len(s.media))
	for i := range s.media {
		m[s.media[i].ID] = cloneMedia(s.media[i])
	}
	return m
}

// MediaExists reports whether id is a known media document.
func (s *Store) MediaExists(id string) bool {
	_, ok := s.GetMedia(id)
	return ok
}

// PutMedia inserts or replaces a media document and persists.
func (s *Store) PutMedia(m model.Media) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if m.Variants == nil {
		m.Variants = map[string]string{}
	}
	prev := s.media
	next := make([]model.Media, 0, len(prev)+1)
	replaced := false
	for _, existing := range prev {
		if existing.ID == m.ID {
			next = append(next, m)
			replaced = true
		} else {
			next = append(next, existing)
		}
	}
	if !replaced {
		next = append(next, m)
	}
	s.media = next
	if err := s.persistMedia(); err != nil {
		s.media = prev
		return err
	}
	return nil
}

// DeleteMedia removes a media document (not the files) by id.
func (s *Store) DeleteMedia(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	prev := s.media
	next := make([]model.Media, 0, len(prev))
	found := false
	for _, m := range prev {
		if m.ID == id {
			found = true
			continue
		}
		next = append(next, m)
	}
	if !found {
		return ErrNotFound
	}
	s.media = next
	if err := s.persistMedia(); err != nil {
		s.media = prev
		return err
	}
	return nil
}

// MediaUsage describes where a media id is referenced.
type MediaUsage struct {
	Site     bool
	News     []string // titles (EN, fallback TR)
	Products []string // names
}

// Used reports whether the media id is referenced anywhere.
func (u MediaUsage) Used() bool { return u.Site || len(u.News) > 0 || len(u.Products) > 0 }

// MediaUsageOf scans every document for references to id.
func (s *Store) MediaUsageOf(id string) MediaUsage {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var u MediaUsage
	site := s.site
	for _, ref := range site.ImageFields() {
		if string(*ref) == id {
			u.Site = true
			break
		}
	}
	for i := range s.news {
		n := s.news[i]
		for _, ref := range n.ImageFields() {
			if string(*ref) == id {
				title := n.Title.EN
				if title == "" {
					title = n.Title.TR
				}
				u.News = append(u.News, title)
				break
			}
		}
	}
	for i := range s.products {
		p := s.products[i]
		for _, ref := range p.ImageFields() {
			if string(*ref) == id {
				u.Products = append(u.Products, p.Name)
				break
			}
		}
	}
	return u
}

// ---- Users -------------------------------------------------------------

// Users returns copies of all admin users.
func (s *Store) Users() []model.AdminUser {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]model.AdminUser(nil), s.users...)
}

// GetUser returns a user by name.
func (s *Store) GetUser(username string) (model.AdminUser, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, u := range s.users {
		if u.Username == username {
			return u, true
		}
	}
	return model.AdminUser{}, false
}

// PutUser inserts or replaces a user by username and persists.
func (s *Store) PutUser(u model.AdminUser) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	prev := s.users
	next := make([]model.AdminUser, 0, len(prev)+1)
	replaced := false
	for _, existing := range prev {
		if existing.Username == u.Username {
			next = append(next, u)
			replaced = true
		} else {
			next = append(next, existing)
		}
	}
	if !replaced {
		next = append(next, u)
	}
	s.users = next
	if err := s.persistUsers(); err != nil {
		s.users = prev
		return err
	}
	return nil
}

// ---- Backup ------------------------------------------------------------

// Backup is the export/import shape (ids, not resolved).
type Backup struct {
	Site     model.SiteSettings `json:"site"`
	News     []model.News       `json:"news"`
	Products []model.Product    `json:"products"`
	Media    []model.Media      `json:"media"`
}

// Export returns a copy of the content collections.
func (s *Store) Export() Backup {
	s.mu.RLock()
	defer s.mu.RUnlock()
	b := Backup{Site: cloneSite(s.site)}
	b.News = make([]model.News, len(s.news))
	for i := range s.news {
		b.News[i] = cloneNews(s.news[i])
	}
	b.Products = make([]model.Product, len(s.products))
	for i := range s.products {
		b.Products[i] = cloneProduct(s.products[i])
	}
	b.Media = make([]model.Media, len(s.media))
	for i := range s.media {
		b.Media[i] = cloneMedia(s.media[i])
	}
	return b
}

// Import replaces all content collections and persists each file. Users are
// never touched by an import. If a write fails the in-memory state is rolled
// back; files written before the failure are left as they are (they are
// internally consistent on their own).
func (s *Store) Import(b Backup) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	b.Site.Normalize()
	if b.News == nil {
		b.News = []model.News{}
	}
	if b.Products == nil {
		b.Products = []model.Product{}
	}
	if b.Media == nil {
		b.Media = []model.Media{}
	}
	for i := range b.News {
		b.News[i].Normalize()
	}
	for i := range b.Products {
		b.Products[i].Normalize()
	}
	for i := range b.Media {
		if b.Media[i].Variants == nil {
			b.Media[i].Variants = map[string]string{}
		}
	}
	prevSite, prevSiteSet, prevNews, prevProducts, prevMedia := s.site, s.siteSet, s.news, s.products, s.media
	s.site, s.siteSet, s.news, s.products, s.media = b.Site, true, b.News, b.Products, b.Media
	var err error
	if err = s.persistSite(); err == nil {
		if err = s.persistNews(); err == nil {
			if err = s.persistProducts(); err == nil {
				err = s.persistMedia()
			}
		}
	}
	if err != nil {
		s.site, s.siteSet, s.news, s.products, s.media = prevSite, prevSiteSet, prevNews, prevProducts, prevMedia
		return err
	}
	return nil
}

// ---- helpers -----------------------------------------------------------

func uniqueSlug(base string, taken func(string) bool) string {
	if base == "" {
		base = "item"
	}
	if !taken(base) {
		return base
	}
	for i := 2; ; i++ {
		candidate := fmt.Sprintf("%s-%d", base, i)
		if !taken(candidate) {
			return candidate
		}
	}
}

func cloneBlocks(in []Block) []Block {
	out := make([]Block, len(in))
	for i, b := range in {
		if b.Items != nil {
			b.Items = append([]model.LocalizedString(nil), b.Items...)
		}
		out[i] = b
	}
	return out
}

// Block is an alias to keep the clone helpers readable.
type Block = model.Block

func cloneNews(n model.News) model.News {
	n.Blocks = cloneBlocks(n.Blocks)
	n.Tags = append([]string{}, n.Tags...)
	return n
}

func cloneProduct(p model.Product) model.Product {
	p.Blocks = cloneBlocks(p.Blocks)
	p.Features = append([]model.LocalizedString{}, p.Features...)
	p.Specs = append([]model.Spec{}, p.Specs...)
	p.Gallery = append([]model.MediaID{}, p.Gallery...)
	p.Documents = append([]model.Document{}, p.Documents...)
	return p
}

func cloneSite(s model.SiteSettings) model.SiteSettings {
	s.AboutBlocks = cloneBlocks(s.AboutBlocks)
	s.Imprint = cloneBlocks(s.Imprint)
	s.Privacy = cloneBlocks(s.Privacy)
	s.Stats = append([]model.Stat{}, s.Stats...)
	s.Areas = append([]model.Area{}, s.Areas...)
	s.Social = append([]model.SocialLink{}, s.Social...)
	s.Contact.AddressLines = append([]string{}, s.Contact.AddressLines...)
	return s
}

func cloneMedia(m model.Media) model.Media {
	v := make(map[string]string, len(m.Variants))
	for k, val := range m.Variants {
		v[k] = val
	}
	m.Variants = v
	return m
}
