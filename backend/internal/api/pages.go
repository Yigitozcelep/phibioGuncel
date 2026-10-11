package api

import (
	"html/template"
	"net/http"
	"strings"

	"phibio/backend/internal/model"
)

// Public HTML pages for the store listings (privacy policy, imprint).
// Rendered server-side from SiteSettings.privacy / .imprint blocks.

type legalBlock struct {
	Type     string
	Text     string
	Items    []string
	ImageURL string
	ImageAlt string
	Caption  string
	URL      string
	Label    string
}

type legalPage struct {
	Lang      string
	OtherLang string
	OtherHref string
	OtherName string
	Title     string
	Company   string
	Blocks    []legalBlock
	Empty     string
}

var legalTmpl = template.Must(template.New("legal").Parse(`<!doctype html>
<html lang="{{.Lang}}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{.Title}} – {{.Company}}</title>
<style>
body{margin:0;background:#f8fafc;color:#0f172a;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header{background:#0E7C86;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
header a{color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.6);border-radius:999px;padding:4px 12px;font-size:14px}
main{max-width:760px;margin:0 auto;padding:24px 20px 48px}
h1{font-size:28px;margin:0 0 20px}h2{font-size:20px;margin:28px 0 8px}
p{margin:0 0 14px}ul{margin:0 0 14px 22px}
blockquote{margin:0 0 14px;padding:10px 16px;border-left:4px solid #0E7C86;background:#E8F4F2;font-style:italic}
figure{margin:0 0 16px}img{max-width:100%;height:auto;border-radius:8px}figcaption{font-size:13px;color:#64748b}
.btn{display:inline-block;background:#0E7C86;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;margin:0 0 14px}
footer{text-align:center;color:#64748b;font-size:13px;padding:0 20px 32px}
</style></head><body>
<header><strong>{{.Company}}</strong><a href="{{.OtherHref}}" hreflang="{{.OtherLang}}">{{.OtherName}}</a></header>
<main><h1>{{.Title}}</h1>
{{if not .Blocks}}<p>{{.Empty}}</p>{{end}}
{{range .Blocks}}{{if eq .Type "heading"}}<h2>{{.Text}}</h2>
{{else if eq .Type "paragraph"}}<p>{{.Text}}</p>
{{else if eq .Type "list"}}<ul>{{range .Items}}<li>{{.}}</li>{{end}}</ul>
{{else if eq .Type "quote"}}<blockquote>{{.Text}}</blockquote>
{{else if eq .Type "image"}}{{if .ImageURL}}<figure><img src="{{.ImageURL}}" alt="{{.ImageAlt}}">{{if .Caption}}<figcaption>{{.Caption}}</figcaption>{{end}}</figure>{{end}}
{{else if eq .Type "button"}}{{if .URL}}<a class="btn" href="{{.URL}}">{{.Label}}</a>{{end}}
{{end}}{{end}}
</main><footer>© {{.Company}}</footer></body></html>
`))

// pickLang returns "tr" or "en" from ?lang= or Accept-Language (default en).
func pickLang(r *http.Request) string {
	switch strings.ToLower(r.URL.Query().Get("lang")) {
	case "tr":
		return "tr"
	case "en":
		return "en"
	}
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(r.Header.Get("Accept-Language"))), "tr") {
		return "tr"
	}
	return "en"
}

// pickText applies the localisation fallback rule (ARCHITECTURE §3).
func pickText(ls model.LocalizedString, lang string) string {
	a, b := ls.EN, ls.TR
	if lang == "tr" {
		a, b = ls.TR, ls.EN
	}
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}

func (s *Server) handleLegalPage(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		lang := pickLang(r)
		site := s.store.Site()
		res := s.resolverFor(s.baseURL(r))
		var src []model.Block
		title := map[string]string{"tr": "Künye", "en": "Imprint"}
		if kind == "privacy" {
			src = site.Privacy
			title = map[string]string{"tr": "Gizlilik Politikası", "en": "Privacy Policy"}
		} else {
			src = site.Imprint
		}
		page := legalPage{Lang: lang, Title: title[lang], Company: site.CompanyName}
		if page.Company == "" {
			page.Company = "Phibio"
		}
		if lang == "tr" {
			page.OtherLang, page.OtherName, page.Empty = "en", "English", "Bu sayfanın içeriği henüz girilmedi."
		} else {
			page.OtherLang, page.OtherName, page.Empty = "tr", "Türkçe", "This page has no content yet."
		}
		page.OtherHref = r.URL.Path + "?lang=" + page.OtherLang
		for _, b := range res.blocks(src) {
			lb := legalBlock{Type: b.Type, Text: pickText(b.Text, lang), Caption: pickText(b.Caption, lang), URL: b.URL, Label: pickText(b.Label, lang)}
			for _, it := range b.Items {
				if v := pickText(it, lang); v != "" {
					lb.Items = append(lb.Items, v)
				}
			}
			if b.Image != nil {
				lb.ImageURL, lb.ImageAlt = b.Image.URL, pickText(b.Image.Alt, lang)
			}
			page.Blocks = append(page.Blocks, lb)
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=60")
		w.Header().Set("Content-Language", lang)
		if err := legalTmpl.Execute(w, page); err != nil {
			s.logger.Printf("legal page %s: %v", kind, err)
		}
	}
}
