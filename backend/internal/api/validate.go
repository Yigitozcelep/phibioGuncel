package api

import (
	"fmt"
	"net/http"
	"strings"

	"phibio/backend/internal/model"
)

// apiError is a validation/business error carrying status, code and text.
type apiError struct {
	Status int
	Code   string
	Msg    Msg
}

func badRequest(tr, en string) *apiError {
	return &apiError{Status: http.StatusBadRequest, Code: "bad_request", Msg: M(tr, en)}
}

func conflict(tr, en string) *apiError {
	return &apiError{Status: http.StatusConflict, Code: "conflict", Msg: M(tr, en)}
}

func (s *Server) writeAPIError(w http.ResponseWriter, r *http.Request, e *apiError) {
	s.fail(w, r, e.Status, e.Code, e.Msg)
}

// mediaChecker reports whether a media id exists (store or import set).
type mediaChecker func(id string) bool

func validateBlocks(field string, blocks []model.Block, exists mediaChecker) *apiError {
	for i, b := range blocks {
		at := fmt.Sprintf("%s[%d]", field, i+1)
		if !model.Contains(model.BlockTypes, b.Type) {
			return badRequest(
				fmt.Sprintf("%s: geçersiz blok türü %q.", at, b.Type),
				fmt.Sprintf("%s: invalid block type %q.", at, b.Type))
		}
		switch b.Type {
		case model.BlockButton:
			if b.URL == "" {
				return badRequest(at+": buton bağlantısı boş olamaz.", at+": button URL must not be empty.")
			}
			if !validLinkURL(b.URL) {
				return badRequest(
					at+": buton bağlantısı https://, http://, mailto: veya tel: ile başlamalı.",
					at+": button URL must start with https://, http://, mailto: or tel:.")
			}
			if b.Label.IsEmpty() {
				return badRequest(at+": buton metni en az bir dilde yazılmalı.", at+": button label must be filled in at least one language.")
			}
		case model.BlockImage:
			if b.Image != "" && !exists(string(b.Image)) {
				return badRequest(at+": görsel bulunamadı (silinmiş olabilir).", at+": image not found (it may have been deleted).")
			}
		}
	}
	return nil
}

func validLinkURL(u string) bool {
	lu := strings.ToLower(u)
	return strings.HasPrefix(lu, "https://") || strings.HasPrefix(lu, "http://") || strings.HasPrefix(lu, "mailto:") || strings.HasPrefix(lu, "tel:")
}

func validateMediaIDs(field string, ids []*model.MediaID, exists mediaChecker) *apiError {
	for _, id := range ids {
		if *id != "" && !exists(string(*id)) {
			return badRequest(
				fmt.Sprintf("%s: görsel bulunamadı (%s).", field, *id),
				fmt.Sprintf("%s: image not found (%s).", field, *id))
		}
	}
	return nil
}

func validateNews(n *model.News, exists mediaChecker) *apiError {
	if n.Title.IsEmpty() {
		return badRequest("title: başlık en az bir dilde yazılmalı.", "title: the title must be filled in at least one language.")
	}
	if !model.Contains(model.Statuses, n.Status) {
		return badRequest("status: taslak (draft) veya yayında (published) olmalı.", "status: must be draft or published.")
	}
	if n.Category == "" {
		n.Category = "news"
	}
	if !model.Contains(model.Categories, n.Category) {
		return badRequest("category: news, event, press veya product olmalı.", "category: must be news, event, press or product.")
	}
	if n.Cover != "" && !exists(string(n.Cover)) {
		return badRequest("cover: kapak görseli bulunamadı.", "cover: cover image not found.")
	}
	return validateBlocks("blocks", n.Blocks, exists)
}

func validateProduct(p *model.Product, exists mediaChecker) *apiError {
	if strings.TrimSpace(p.Name) == "" {
		return badRequest("name: ürün adı boş olamaz.", "name: product name must not be empty.")
	}
	if !model.Contains(model.Statuses, p.Status) {
		return badRequest("status: taslak (draft) veya yayında (published) olmalı.", "status: must be draft or published.")
	}
	if !model.Contains(model.Areas, p.Area) {
		return badRequest("area: orthopaedics, ophthalmology veya dermatology olmalı.", "area: must be orthopaedics, ophthalmology or dermatology.")
	}
	if p.Cover != "" && !exists(string(p.Cover)) {
		return badRequest("cover: kapak görseli bulunamadı.", "cover: cover image not found.")
	}
	ids := make([]*model.MediaID, 0, len(p.Gallery))
	for i := range p.Gallery {
		ids = append(ids, &p.Gallery[i])
	}
	if err := validateMediaIDs("gallery", ids, exists); err != nil {
		return err
	}
	for i, d := range p.Documents {
		at := fmt.Sprintf("documents[%d]", i+1)
		if d.Title.IsEmpty() {
			return badRequest(at+": belge başlığı en az bir dilde yazılmalı.", at+": document title must be filled in at least one language.")
		}
		if !validLinkURL(d.URL) {
			return badRequest(at+": belge bağlantısı https:// veya http:// ile başlamalı.", at+": document URL must start with https:// or http://.")
		}
	}
	return validateBlocks("blocks", p.Blocks, exists)
}

func validateSite(site *model.SiteSettings, exists mediaChecker) *apiError {
	if site.HeroImage != "" && !exists(string(site.HeroImage)) {
		return badRequest("heroImage: görsel bulunamadı.", "heroImage: image not found.")
	}
	for i := range site.Areas {
		a := &site.Areas[i]
		at := fmt.Sprintf("areas[%d]", i+1)
		if !model.Contains(model.Areas, a.Key) {
			return badRequest(at+": alan anahtarı orthopaedics, ophthalmology veya dermatology olmalı.", at+": area key must be orthopaedics, ophthalmology or dermatology.")
		}
		if a.Image != "" && !exists(string(a.Image)) {
			return badRequest(at+": görsel bulunamadı.", at+": image not found.")
		}
	}
	for i, so := range site.Social {
		at := fmt.Sprintf("social[%d]", i+1)
		if !model.Contains(model.SocialKinds, so.Kind) {
			return badRequest(at+": tür linkedin, instagram, facebook, x veya youtube olmalı.", at+": kind must be linkedin, instagram, facebook, x or youtube.")
		}
		if !strings.HasPrefix(strings.ToLower(so.URL), "https://") && !strings.HasPrefix(strings.ToLower(so.URL), "http://") {
			return badRequest(at+": bağlantı https:// ile başlamalı.", at+": URL must start with https://.")
		}
	}
	if u := site.Contact.MapURL; u != "" && !validLinkURL(u) {
		return badRequest("contact.mapUrl: bağlantı https:// ile başlamalı.", "contact.mapUrl: URL must start with https://.")
	}
	if u := site.Contact.Website; u != "" && !validLinkURL(u) {
		return badRequest("contact.website: bağlantı https:// ile başlamalı.", "contact.website: URL must start with https://.")
	}
	if err := validateBlocks("aboutBlocks", site.AboutBlocks, exists); err != nil {
		return err
	}
	if err := validateBlocks("imprint", site.Imprint, exists); err != nil {
		return err
	}
	return validateBlocks("privacy", site.Privacy, exists)
}
