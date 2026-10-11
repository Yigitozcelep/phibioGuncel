package api

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"phibio/backend/internal/model"
)

func TestLegalPages(t *testing.T) {
	e := newEnv(t)
	site := e.store.Site()
	site.CompanyName = "Phibio GmbH"
	site.Privacy = []model.Block{
		{Type: model.BlockHeading, Text: model.LocalizedString{TR: "Veri toplama", EN: "Data collection"}},
		{Type: model.BlockParagraph, Text: model.LocalizedString{TR: "Uygulama kişisel veri toplamaz.", EN: "The app collects no personal data."}},
		{Type: model.BlockList, Items: []model.LocalizedString{{TR: "madde", EN: "item"}}},
		{Type: model.BlockButton, URL: "mailto:info@phibio.de", Label: model.LocalizedString{TR: "Yaz", EN: "Write"}},
	}
	site.Imprint = []model.Block{{Type: model.BlockParagraph, Text: model.LocalizedString{EN: "Only English <b>here</b>"}}}
	if err := e.store.SetSite(site); err != nil {
		t.Fatal(err)
	}
	get := func(path, accept string) (int, string, string) {
		req, _ := http.NewRequest("GET", e.ts.URL+path, nil)
		if accept != "" {
			req.Header.Set("Accept-Language", accept)
		}
		res, err := e.client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		var sb strings.Builder
		if _, err := io.Copy(&sb, res.Body); err != nil {
			t.Fatal(err)
		}
		return res.StatusCode, res.Header.Get("Content-Type"), sb.String()
	}

	code, ct, body := get("/privacy?lang=tr", "")
	if code != http.StatusOK || !strings.HasPrefix(ct, "text/html") {
		t.Fatalf("privacy tr: %d %s", code, ct)
	}
	for _, want := range []string{"Gizlilik Politikası", "Veri toplama", "kişisel veri toplamaz", "<li>madde</li>", "mailto:info@phibio.de", "?lang=en"} {
		if !strings.Contains(body, want) {
			t.Errorf("privacy tr missing %q", want)
		}
	}

	if _, _, b := get("/privacy", "en-US,en;q=0.9"); !strings.Contains(b, "Privacy Policy") || !strings.Contains(b, "collects no personal data") {
		t.Fatalf("privacy en body: %s", b)
	}

	// Turkish request falls back to English text and escapes HTML.
	if _, _, b := get("/imprint?lang=tr", ""); !strings.Contains(b, "Künye") || !strings.Contains(b, "Only English &lt;b&gt;here&lt;/b&gt;") {
		t.Fatalf("imprint fallback/escaping body: %s", b)
	}
}
