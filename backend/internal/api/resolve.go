package api

import (
	"phibio/backend/internal/model"
)

// ImageRef is the resolved form of a media id (ARCHITECTURE §4.2).
type ImageRef struct {
	ID     string                `json:"id"`
	URL    string                `json:"url"`
	Thumb  string                `json:"thumb"`
	Orig   string                `json:"orig"`
	Width  int                   `json:"width"`
	Height int                   `json:"height"`
	Alt    model.LocalizedString `json:"alt"`
}

// BlockOut is a Block with its image resolved.
type BlockOut struct {
	Type    string                  `json:"type"`
	Text    model.LocalizedString   `json:"text"`
	Items   []model.LocalizedString `json:"items,omitempty"`
	Image   *ImageRef               `json:"image"`
	Caption model.LocalizedString   `json:"caption"`
	URL     string                  `json:"url,omitempty"`
	Label   model.LocalizedString   `json:"label"`
}

// NewsOut is a resolved article.
type NewsOut struct {
	ID          string                `json:"id"`
	Slug        string                `json:"slug"`
	Title       model.LocalizedString `json:"title"`
	Summary     model.LocalizedString `json:"summary"`
	Cover       *ImageRef             `json:"cover"`
	Blocks      []BlockOut            `json:"blocks"`
	Category    string                `json:"category"`
	Tags        []string              `json:"tags"`
	Featured    bool                  `json:"featured"`
	Status      string                `json:"status"`
	PublishedAt model.Timestamp       `json:"publishedAt"`
	CreatedAt   model.Timestamp       `json:"createdAt"`
	UpdatedAt   model.Timestamp       `json:"updatedAt"`
}

// NewsSummary is NewsOut without blocks (public lists).
type NewsSummary struct {
	ID          string                `json:"id"`
	Slug        string                `json:"slug"`
	Title       model.LocalizedString `json:"title"`
	Summary     model.LocalizedString `json:"summary"`
	Cover       *ImageRef             `json:"cover"`
	Category    string                `json:"category"`
	Tags        []string              `json:"tags"`
	Featured    bool                  `json:"featured"`
	PublishedAt model.Timestamp       `json:"publishedAt"`
}

// AdminNewsSummary adds the fields the dashboard needs.
type AdminNewsSummary struct {
	NewsSummary
	Status    string          `json:"status"`
	UpdatedAt model.Timestamp `json:"updatedAt"`
}

// ProductOut is a resolved product.
type ProductOut struct {
	ID        string                  `json:"id"`
	Slug      string                  `json:"slug"`
	Name      string                  `json:"name"`
	Area      string                  `json:"area"`
	Tagline   model.LocalizedString   `json:"tagline"`
	Summary   model.LocalizedString   `json:"summary"`
	Blocks    []BlockOut              `json:"blocks"`
	Features  []model.LocalizedString `json:"features"`
	Specs     []model.Spec            `json:"specs"`
	Cover     *ImageRef               `json:"cover"`
	Gallery   []ImageRef              `json:"gallery"`
	Documents []model.Document        `json:"documents"`
	Order     int                     `json:"order"`
	Status    string                  `json:"status"`
	CreatedAt model.Timestamp         `json:"createdAt"`
	UpdatedAt model.Timestamp         `json:"updatedAt"`
}

// AreaOut is a resolved area.
type AreaOut struct {
	Key         string                `json:"key"`
	Name        model.LocalizedString `json:"name"`
	Description model.LocalizedString `json:"description"`
	Image       *ImageRef             `json:"image"`
}

// SiteOut is resolved site settings.
type SiteOut struct {
	CompanyName  string                `json:"companyName"`
	Slogan       model.LocalizedString `json:"slogan"`
	HeroTitle    model.LocalizedString `json:"heroTitle"`
	HeroSubtitle model.LocalizedString `json:"heroSubtitle"`
	HeroImage    *ImageRef             `json:"heroImage"`
	AboutTitle   model.LocalizedString `json:"aboutTitle"`
	AboutBlocks  []BlockOut            `json:"aboutBlocks"`
	Stats        []model.Stat          `json:"stats"`
	Areas        []AreaOut             `json:"areas"`
	Contact      model.Contact         `json:"contact"`
	Social       []model.SocialLink    `json:"social"`
	Imprint      []BlockOut            `json:"imprint"`
	Privacy      []BlockOut            `json:"privacy"`
	UpdatedAt    model.Timestamp       `json:"updatedAt"`
}

// MediaOut is Media plus absolute URLs.
type MediaOut struct {
	model.Media
	URL   string `json:"url"`
	Thumb string `json:"thumb"`
	Orig  string `json:"orig"`
}

// resolver turns media ids into ImageRefs using a snapshot of the media
// collection and the request's base URL.
type resolver struct {
	base  string
	media map[string]model.Media
}

func (s *Server) resolverFor(base string) *resolver {
	return &resolver{base: base, media: s.store.MediaMap()}
}

func (r *resolver) urls(m model.Media) (url, thumb, orig string) {
	orig = r.base + "/uploads/" + m.Variants["orig"]
	url, thumb = orig, orig
	if v, ok := m.Variants["w1200"]; ok && v != "" {
		url = r.base + "/uploads/" + v
	}
	if v, ok := m.Variants["w400"]; ok && v != "" {
		thumb = r.base + "/uploads/" + v
	}
	return
}

func (r *resolver) ref(id model.MediaID) *ImageRef {
	if id == "" {
		return nil
	}
	m, ok := r.media[string(id)]
	if !ok || m.Variants["orig"] == "" {
		return nil
	}
	url, thumb, orig := r.urls(m)
	return &ImageRef{ID: m.ID, URL: url, Thumb: thumb, Orig: orig, Width: m.Width, Height: m.Height, Alt: m.Alt}
}

func (r *resolver) mediaOut(m model.Media) MediaOut {
	url, thumb, orig := r.urls(m)
	if m.Variants == nil {
		m.Variants = map[string]string{}
	}
	return MediaOut{Media: m, URL: url, Thumb: thumb, Orig: orig}
}

func (r *resolver) blocks(in []model.Block) []BlockOut {
	out := make([]BlockOut, 0, len(in))
	for _, b := range in {
		o := BlockOut{Type: b.Type, Text: b.Text, Items: b.Items, Caption: b.Caption, URL: b.URL, Label: b.Label}
		if b.Type == model.BlockList && o.Items == nil {
			o.Items = []model.LocalizedString{}
		}
		if b.Type == model.BlockImage {
			o.Image = r.ref(b.Image)
		}
		out = append(out, o)
	}
	return out
}

func (r *resolver) news(n model.News) NewsOut {
	return NewsOut{
		ID: n.ID, Slug: n.Slug, Title: n.Title, Summary: n.Summary,
		Cover: r.ref(n.Cover), Blocks: r.blocks(n.Blocks), Category: n.Category,
		Tags: nonNil(n.Tags), Featured: n.Featured, Status: n.Status,
		PublishedAt: n.PublishedAt, CreatedAt: n.CreatedAt, UpdatedAt: n.UpdatedAt,
	}
}

func (r *resolver) newsSummary(n model.News) NewsSummary {
	return NewsSummary{
		ID: n.ID, Slug: n.Slug, Title: n.Title, Summary: n.Summary, Cover: r.ref(n.Cover),
		Category: n.Category, Tags: nonNil(n.Tags), Featured: n.Featured, PublishedAt: n.PublishedAt,
	}
}

func (r *resolver) product(p model.Product) ProductOut {
	gallery := make([]ImageRef, 0, len(p.Gallery))
	for _, g := range p.Gallery {
		if ref := r.ref(g); ref != nil {
			gallery = append(gallery, *ref)
		}
	}
	features := p.Features
	if features == nil {
		features = []model.LocalizedString{}
	}
	specs := p.Specs
	if specs == nil {
		specs = []model.Spec{}
	}
	docs := p.Documents
	if docs == nil {
		docs = []model.Document{}
	}
	return ProductOut{
		ID: p.ID, Slug: p.Slug, Name: p.Name, Area: p.Area, Tagline: p.Tagline, Summary: p.Summary,
		Blocks: r.blocks(p.Blocks), Features: features, Specs: specs, Cover: r.ref(p.Cover),
		Gallery: gallery, Documents: docs, Order: p.Order, Status: p.Status,
		CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}
}

func (r *resolver) site(s model.SiteSettings) SiteOut {
	areas := make([]AreaOut, 0, len(s.Areas))
	for _, a := range s.Areas {
		areas = append(areas, AreaOut{Key: a.Key, Name: a.Name, Description: a.Description, Image: r.ref(a.Image)})
	}
	stats := s.Stats
	if stats == nil {
		stats = []model.Stat{}
	}
	social := s.Social
	if social == nil {
		social = []model.SocialLink{}
	}
	contact := s.Contact
	contact.AddressLines = nonNil(contact.AddressLines)
	return SiteOut{
		CompanyName: s.CompanyName, Slogan: s.Slogan, HeroTitle: s.HeroTitle, HeroSubtitle: s.HeroSubtitle,
		HeroImage: r.ref(s.HeroImage), AboutTitle: s.AboutTitle, AboutBlocks: r.blocks(s.AboutBlocks),
		Stats: stats, Areas: areas, Contact: contact, Social: social,
		Imprint: r.blocks(s.Imprint), Privacy: r.blocks(s.Privacy), UpdatedAt: s.UpdatedAt,
	}
}

func nonNil(in []string) []string {
	if in == nil {
		return []string{}
	}
	return in
}
