// Package model holds the canonical data types shared by the store, the API
// and the seed importer. JSON tags follow docs/ARCHITECTURE.md §4.1 exactly.
package model

import (
	"bytes"
	"encoding/json"
	"strings"
	"time"
)

// LocalizedString carries both languages. Both keys are always serialised.
type LocalizedString struct {
	TR string `json:"tr"`
	EN string `json:"en"`
}

// IsEmpty reports whether neither language has content.
func (l LocalizedString) IsEmpty() bool {
	return strings.TrimSpace(l.TR) == "" && strings.TrimSpace(l.EN) == ""
}

// Trim returns a copy with surrounding whitespace removed in both languages.
func (l LocalizedString) Trim() LocalizedString {
	return LocalizedString{TR: strings.TrimSpace(l.TR), EN: strings.TrimSpace(l.EN)}
}

// MediaID is a reference to a Media document. On input it accepts either a
// plain string id or an ImageRef-like object ({"id": "..."}), because the
// admin panel may send back the resolved objects it received. It always
// marshals as a plain string.
type MediaID string

// UnmarshalJSON accepts null, a string, or an object with an "id" field.
func (m *MediaID) UnmarshalJSON(data []byte) error {
	data = bytes.TrimSpace(data)
	if len(data) == 0 || bytes.Equal(data, []byte("null")) {
		*m = ""
		return nil
	}
	if data[0] == '{' {
		var obj struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(data, &obj); err != nil {
			return err
		}
		*m = MediaID(strings.TrimSpace(obj.ID))
		return nil
	}
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	*m = MediaID(strings.TrimSpace(s))
	return nil
}

// Timestamp wraps time.Time so that an empty string or null on input is
// accepted as "unset" (zero). It marshals as RFC 3339 UTC, or null when zero.
type Timestamp struct {
	time.Time
}

// Now returns the current time in UTC, truncated to seconds.
func Now() Timestamp {
	return Timestamp{time.Now().UTC().Truncate(time.Second)}
}

// At wraps a time.Time.
func At(t time.Time) Timestamp {
	return Timestamp{t.UTC()}
}

// MarshalJSON writes RFC 3339 UTC or null.
func (t Timestamp) MarshalJSON() ([]byte, error) {
	if t.IsZero() {
		return []byte("null"), nil
	}
	return json.Marshal(t.UTC().Format(time.RFC3339))
}

// UnmarshalJSON accepts null, "" or an RFC 3339 string (with or without
// fractional seconds; a date-only value is accepted as midnight UTC).
func (t *Timestamp) UnmarshalJSON(data []byte) error {
	data = bytes.TrimSpace(data)
	if len(data) == 0 || bytes.Equal(data, []byte("null")) {
		t.Time = time.Time{}
		return nil
	}
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	s = strings.TrimSpace(s)
	if s == "" {
		t.Time = time.Time{}
		return nil
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02T15:04", "2006-01-02"} {
		if parsed, err := time.Parse(layout, s); err == nil {
			t.Time = parsed.UTC()
			return nil
		}
	}
	return &time.ParseError{Layout: time.RFC3339, Value: s, Message: ": not an RFC 3339 time"}
}

// Block types.
const (
	BlockHeading   = "heading"
	BlockParagraph = "paragraph"
	BlockImage     = "image"
	BlockList      = "list"
	BlockQuote     = "quote"
	BlockButton    = "button"
)

// BlockTypes lists every valid block type.
var BlockTypes = []string{BlockHeading, BlockParagraph, BlockImage, BlockList, BlockQuote, BlockButton}

// Block is one content block. Only the fields relevant to Type are used.
type Block struct {
	Type    string            `json:"type"`
	Text    LocalizedString   `json:"text"`
	Items   []LocalizedString `json:"items,omitempty"`
	Image   MediaID           `json:"image,omitempty"`
	Caption LocalizedString   `json:"caption"`
	URL     string            `json:"url,omitempty"`
	Label   LocalizedString   `json:"label"`
}

// Statuses, categories and areas.
const (
	StatusDraft     = "draft"
	StatusPublished = "published"
)

var Statuses = []string{StatusDraft, StatusPublished}
var Categories = []string{"news", "event", "press", "product"}
var Areas = []string{"orthopaedics", "ophthalmology", "dermatology"}
var SocialKinds = []string{"linkedin", "instagram", "facebook", "x", "youtube"}

// News is an article.
type News struct {
	ID          string          `json:"id"`
	Slug        string          `json:"slug"`
	Title       LocalizedString `json:"title"`
	Summary     LocalizedString `json:"summary"`
	Cover       MediaID         `json:"cover"`
	Blocks      []Block         `json:"blocks"`
	Category    string          `json:"category"`
	Tags        []string        `json:"tags"`
	Featured    bool            `json:"featured"`
	Status      string          `json:"status"`
	PublishedAt Timestamp       `json:"publishedAt"`
	CreatedAt   Timestamp       `json:"createdAt"`
	UpdatedAt   Timestamp       `json:"updatedAt"`
}

// Normalize makes slices non-nil and trims text so the JSON shape is stable.
func (n *News) Normalize() {
	n.Slug = strings.TrimSpace(n.Slug)
	n.Title = n.Title.Trim()
	n.Summary = n.Summary.Trim()
	n.Category = strings.TrimSpace(strings.ToLower(n.Category))
	n.Status = strings.TrimSpace(strings.ToLower(n.Status))
	n.Blocks = NormalizeBlocks(n.Blocks)
	n.Tags = normalizeTags(n.Tags)
}

// ImageFields returns pointers to every media reference held by the article.
func (n *News) ImageFields() []*MediaID {
	refs := []*MediaID{&n.Cover}
	return append(refs, blockImageFields(n.Blocks)...)
}

// Spec is one row of the product specification table.
type Spec struct {
	Label LocalizedString `json:"label"`
	Value LocalizedString `json:"value"`
}

// Document is a downloadable file (brochure, data sheet).
type Document struct {
	Title LocalizedString `json:"title"`
	URL   string          `json:"url"`
}

// Product is a product page.
type Product struct {
	ID        string            `json:"id"`
	Slug      string            `json:"slug"`
	Name      string            `json:"name"`
	Area      string            `json:"area"`
	Tagline   LocalizedString   `json:"tagline"`
	Summary   LocalizedString   `json:"summary"`
	Blocks    []Block           `json:"blocks"`
	Features  []LocalizedString `json:"features"`
	Specs     []Spec            `json:"specs"`
	Cover     MediaID           `json:"cover"`
	Gallery   []MediaID         `json:"gallery"`
	Documents []Document        `json:"documents"`
	Order     int               `json:"order"`
	Status    string            `json:"status"`
	CreatedAt Timestamp         `json:"createdAt"`
	UpdatedAt Timestamp         `json:"updatedAt"`
}

// Normalize makes slices non-nil and trims text.
func (p *Product) Normalize() {
	p.Slug = strings.TrimSpace(p.Slug)
	p.Name = strings.TrimSpace(p.Name)
	p.Area = strings.TrimSpace(strings.ToLower(p.Area))
	p.Status = strings.TrimSpace(strings.ToLower(p.Status))
	p.Tagline = p.Tagline.Trim()
	p.Summary = p.Summary.Trim()
	p.Blocks = NormalizeBlocks(p.Blocks)
	if p.Features == nil {
		p.Features = []LocalizedString{}
	}
	if p.Specs == nil {
		p.Specs = []Spec{}
	}
	if p.Documents == nil {
		p.Documents = []Document{}
	}
	for i := range p.Documents {
		p.Documents[i].URL = strings.TrimSpace(p.Documents[i].URL)
	}
	gallery := make([]MediaID, 0, len(p.Gallery))
	for _, g := range p.Gallery {
		if g != "" {
			gallery = append(gallery, g)
		}
	}
	p.Gallery = gallery
}

// ImageFields returns pointers to every media reference held by the product.
func (p *Product) ImageFields() []*MediaID {
	refs := []*MediaID{&p.Cover}
	for i := range p.Gallery {
		refs = append(refs, &p.Gallery[i])
	}
	return append(refs, blockImageFields(p.Blocks)...)
}

// Area is one of the three medical device areas shown on the home screen.
type Area struct {
	Key         string          `json:"key"`
	Name        LocalizedString `json:"name"`
	Description LocalizedString `json:"description"`
	Image       MediaID         `json:"image"`
}

// Stat is one entry of the statistics row.
type Stat struct {
	Value string          `json:"value"`
	Label LocalizedString `json:"label"`
}

// Contact holds the company contact details.
type Contact struct {
	Email        string          `json:"email"`
	Phone        string          `json:"phone"`
	PhoneDisplay string          `json:"phoneDisplay"`
	AddressLines []string        `json:"addressLines"`
	MapURL       string          `json:"mapUrl"`
	Hours        LocalizedString `json:"hours"`
	Website      string          `json:"website"`
}

// SocialLink is a social network profile.
type SocialLink struct {
	Kind string `json:"kind"`
	URL  string `json:"url"`
}

// SiteSettings is the single site document.
type SiteSettings struct {
	CompanyName  string          `json:"companyName"`
	Slogan       LocalizedString `json:"slogan"`
	HeroTitle    LocalizedString `json:"heroTitle"`
	HeroSubtitle LocalizedString `json:"heroSubtitle"`
	HeroImage    MediaID         `json:"heroImage"`
	AboutTitle   LocalizedString `json:"aboutTitle"`
	AboutBlocks  []Block         `json:"aboutBlocks"`
	Stats        []Stat          `json:"stats"`
	Areas        []Area          `json:"areas"`
	Contact      Contact         `json:"contact"`
	Social       []SocialLink    `json:"social"`
	Imprint      []Block         `json:"imprint"`
	Privacy      []Block         `json:"privacy"`
	UpdatedAt    Timestamp       `json:"updatedAt"`
}

// Normalize makes slices non-nil and trims text.
func (s *SiteSettings) Normalize() {
	s.CompanyName = strings.TrimSpace(s.CompanyName)
	s.AboutBlocks = NormalizeBlocks(s.AboutBlocks)
	s.Imprint = NormalizeBlocks(s.Imprint)
	s.Privacy = NormalizeBlocks(s.Privacy)
	if s.Stats == nil {
		s.Stats = []Stat{}
	}
	if s.Areas == nil {
		s.Areas = []Area{}
	}
	for i := range s.Areas {
		s.Areas[i].Key = strings.TrimSpace(strings.ToLower(s.Areas[i].Key))
	}
	if s.Social == nil {
		s.Social = []SocialLink{}
	}
	for i := range s.Social {
		s.Social[i].Kind = strings.TrimSpace(strings.ToLower(s.Social[i].Kind))
		s.Social[i].URL = strings.TrimSpace(s.Social[i].URL)
	}
	if s.Contact.AddressLines == nil {
		s.Contact.AddressLines = []string{}
	}
	s.Contact.Email = strings.TrimSpace(s.Contact.Email)
	s.Contact.Phone = strings.TrimSpace(s.Contact.Phone)
	s.Contact.PhoneDisplay = strings.TrimSpace(s.Contact.PhoneDisplay)
	s.Contact.MapURL = strings.TrimSpace(s.Contact.MapURL)
	s.Contact.Website = strings.TrimSpace(s.Contact.Website)
}

// ImageFields returns pointers to every media reference held by the settings.
func (s *SiteSettings) ImageFields() []*MediaID {
	refs := []*MediaID{&s.HeroImage}
	for i := range s.Areas {
		refs = append(refs, &s.Areas[i].Image)
	}
	refs = append(refs, blockImageFields(s.AboutBlocks)...)
	refs = append(refs, blockImageFields(s.Imprint)...)
	refs = append(refs, blockImageFields(s.Privacy)...)
	return refs
}

// Media is an uploaded image.
type Media struct {
	ID        string            `json:"id"`
	FileName  string            `json:"fileName"`
	Mime      string            `json:"mime"`
	Width     int               `json:"width"`
	Height    int               `json:"height"`
	Size      int64             `json:"size"`
	Variants  map[string]string `json:"variants"`
	Alt       LocalizedString   `json:"alt"`
	CreatedAt Timestamp         `json:"createdAt"`
}

// AdminUser is a panel account. Passwords are never stored in clear text.
type AdminUser struct {
	Username  string    `json:"username"`
	Salt      string    `json:"salt"`
	Hash      string    `json:"hash"`
	CreatedAt Timestamp `json:"createdAt"`
}

// NormalizeBlocks trims block text, lower-cases the type and makes the slice
// non-nil. Fields that do not belong to the block type are cleared so the
// stored document stays tidy.
func NormalizeBlocks(blocks []Block) []Block {
	out := make([]Block, 0, len(blocks))
	for _, b := range blocks {
		b.Type = strings.TrimSpace(strings.ToLower(b.Type))
		b.Text = b.Text.Trim()
		b.Caption = b.Caption.Trim()
		b.Label = b.Label.Trim()
		b.URL = strings.TrimSpace(b.URL)
		switch b.Type {
		case BlockList:
			items := make([]LocalizedString, 0, len(b.Items))
			for _, it := range b.Items {
				it = it.Trim()
				if !it.IsEmpty() {
					items = append(items, it)
				}
			}
			b.Items = items
			b.Image, b.URL = "", ""
		case BlockImage:
			b.Items, b.URL = nil, ""
		case BlockButton:
			b.Items, b.Image = nil, ""
		default:
			b.Items, b.Image, b.URL = nil, "", ""
		}
		out = append(out, b)
	}
	return out
}

func blockImageFields(blocks []Block) []*MediaID {
	var refs []*MediaID
	for i := range blocks {
		if blocks[i].Type == BlockImage {
			refs = append(refs, &blocks[i].Image)
		}
	}
	return refs
}

func normalizeTags(tags []string) []string {
	out := make([]string, 0, len(tags))
	seen := map[string]bool{}
	for _, t := range tags {
		t = strings.TrimSpace(t)
		if t == "" || seen[strings.ToLower(t)] {
			continue
		}
		seen[strings.ToLower(t)] = true
		out = append(out, t)
	}
	return out
}

// Contains reports whether list holds value.
func Contains(list []string, value string) bool {
	for _, v := range list {
		if v == value {
			return true
		}
	}
	return false
}
