package model

import "testing"

func TestSlugify(t *testing.T) {
	cases := map[string]string{
		"Hello World": "hello-world",
		"ViscoPhi™: Eklem Sağlığı İçin Hyalüronik Asit": "viscophi-eklem-sagligi-icin-hyaluronik-asit",
		"Çağrı Şöför Üzüm Iğdır":                        "cagri-sofor-uzum-igdir",
		"  --Leading and trailing--  ":                  "leading-and-trailing",
		"Äpfel & Öl / Straße":                           "apfel-ol-strasse",
		"":                                              "",
		"!!!":                                           "",
		"Phibio mobile app is live":                     "phibio-mobile-app-is-live",
		"İSTANBUL":                                      "istanbul",
		"a___b...c":                                     "a-b-c",
	}
	for in, want := range cases {
		if got := Slugify(in); got != want {
			t.Errorf("Slugify(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestMediaIDUnmarshal(t *testing.T) {
	var n News
	in := `{"cover":{"id":"abc","url":"x"},"blocks":[{"type":"image","image":"def"},{"type":"image","image":null}],"title":{"tr":"a","en":""}}`
	if err := jsonUnmarshal([]byte(in), &n); err != nil {
		t.Fatal(err)
	}
	if n.Cover != "abc" || n.Blocks[0].Image != "def" || n.Blocks[1].Image != "" {
		t.Fatalf("unexpected: %+v", n)
	}
}

func TestTimestampUnmarshal(t *testing.T) {
	var n News
	for _, in := range []string{`{"publishedAt":""}`, `{"publishedAt":null}`, `{}`} {
		if err := jsonUnmarshal([]byte(in), &n); err != nil {
			t.Fatalf("%s: %v", in, err)
		}
		if !n.PublishedAt.IsZero() {
			t.Fatalf("%s: expected zero", in)
		}
	}
	if err := jsonUnmarshal([]byte(`{"publishedAt":"2026-09-01T09:00:00Z"}`), &n); err != nil {
		t.Fatal(err)
	}
	if n.PublishedAt.Year() != 2026 || n.PublishedAt.Month() != 9 {
		t.Fatalf("bad parse: %v", n.PublishedAt)
	}
	if err := jsonUnmarshal([]byte(`{"publishedAt":"not a date"}`), &n); err == nil {
		t.Fatal("expected error for invalid date")
	}
}
