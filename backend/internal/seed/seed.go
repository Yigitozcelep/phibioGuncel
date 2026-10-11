// Package seed imports the first-run content: it uploads the embedded images
// as media, replaces "@image:<name>" tokens with the generated media ids and
// stores the site settings, products and news.
package seed

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"strings"

	"phibio/backend/internal/media"
	"phibio/backend/internal/model"
	"phibio/backend/internal/store"
)

// ImageToken is the prefix used in seed.json image fields.
const ImageToken = "@image:"

type seedImage struct {
	File string                `json:"file"`
	Alt  model.LocalizedString `json:"alt"`
}

type seedFile struct {
	Images   map[string]seedImage `json:"images"`
	Site     model.SiteSettings   `json:"site"`
	Products []model.Product      `json:"products"`
	News     []model.News         `json:"news"`
}

// Summary describes what was imported.
type Summary struct {
	Media    int
	Products int
	News     int
}

// Run imports the seed from files (seed.json + images/<file>) into st.
func Run(st *store.Store, files fs.FS, logger *log.Logger) (Summary, error) {
	if logger == nil {
		logger = log.Default()
	}
	var sum Summary
	raw, err := fs.ReadFile(files, "seed.json")
	if err != nil {
		return sum, fmt.Errorf("read seed.json: %w", err)
	}
	var sf seedFile
	if err := json.Unmarshal(raw, &sf); err != nil {
		return sum, fmt.Errorf("parse seed.json: %w", err)
	}

	// 1. Images → media.
	ids := map[string]string{}
	for name, img := range sf.Images {
		data, err := fs.ReadFile(files, "images/"+img.File)
		if err != nil {
			return sum, fmt.Errorf("seed image %q: %w", name, err)
		}
		res, err := media.Process(data)
		if err != nil {
			return sum, fmt.Errorf("seed image %q: %w", name, err)
		}
		id := store.NewID()
		variants, err := res.Save(st.UploadsPath(), id)
		if err != nil {
			return sum, fmt.Errorf("seed image %q: %w", name, err)
		}
		m := model.Media{
			ID: id, FileName: img.File, Mime: res.Mime, Width: res.Width, Height: res.Height,
			Size: res.Size, Variants: variants, Alt: img.Alt, CreatedAt: model.Now(),
		}
		if err := st.PutMedia(m); err != nil {
			return sum, fmt.Errorf("seed media %q: %w", name, err)
		}
		ids[name] = id
		sum.Media++
	}

	resolve := func(where string, refs []*model.MediaID) error {
		for _, ref := range refs {
			v := string(*ref)
			if v == "" {
				continue
			}
			if !strings.HasPrefix(v, ImageToken) {
				return fmt.Errorf("%s: image field %q is not a seed token", where, v)
			}
			id, ok := ids[strings.TrimPrefix(v, ImageToken)]
			if !ok {
				return fmt.Errorf("%s: unknown seed image %q", where, v)
			}
			*ref = model.MediaID(id)
		}
		return nil
	}

	// 2. Site.
	site := sf.Site
	site.Normalize()
	if err := resolve("site", site.ImageFields()); err != nil {
		return sum, err
	}
	if err := st.SetSite(site); err != nil {
		return sum, fmt.Errorf("seed site: %w", err)
	}

	// 3. Products.
	now := model.Now()
	for i := range sf.Products {
		p := sf.Products[i]
		p.Normalize()
		if err := resolve("product "+p.Name, p.ImageFields()); err != nil {
			return sum, err
		}
		if p.Slug == "" {
			p.Slug = model.Slugify(p.Name)
		}
		p.Slug = st.UniqueProductSlug(p.Slug, "")
		if p.Status == "" {
			p.Status = model.StatusPublished
		}
		p.ID = store.NewID()
		p.CreatedAt, p.UpdatedAt = now, now
		if err := st.PutProduct(p); err != nil {
			return sum, fmt.Errorf("seed product %q: %w", p.Name, err)
		}
		sum.Products++
	}

	// 4. News.
	for i := range sf.News {
		n := sf.News[i]
		n.Normalize()
		if err := resolve("news "+n.Title.EN, n.ImageFields()); err != nil {
			return sum, err
		}
		if n.Slug == "" {
			n.Slug = model.Slugify(n.Title.EN)
			if n.Slug == "" {
				n.Slug = model.Slugify(n.Title.TR)
			}
		}
		n.Slug = st.UniqueNewsSlug(n.Slug, "")
		if n.Status == "" {
			n.Status = model.StatusPublished
		}
		if n.Category == "" {
			n.Category = "news"
		}
		if n.PublishedAt.IsZero() {
			n.PublishedAt = now
		}
		n.ID = store.NewID()
		n.CreatedAt, n.UpdatedAt = n.PublishedAt, n.PublishedAt
		if err := st.PutNews(n); err != nil {
			return sum, fmt.Errorf("seed news %q: %w", n.Title.EN, err)
		}
		sum.News++
	}
	logger.Printf("seed: imported %d media, %d products, %d news", sum.Media, sum.Products, sum.News)
	return sum, nil
}
