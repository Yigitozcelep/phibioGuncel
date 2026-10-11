# Phibio Mobile – Architecture Contract

This document is the single source of truth that all three components follow.
Anything not covered here is decided by the component owner, but **the data
model, the API, and the conventions below must not drift**.

## 1. Goal

A bilingual (Turkish / English) mobile app for App Store and Google Play that
mirrors the structure of https://www.phibio.de, backed by a Go server whose
content (news, products, site texts, images) is edited by non-technical staff
through a desktop web admin panel.

```
phibioGuncel/
├── backend/            Go 1.24, standard library only (no third-party modules)
│   ├── main.go         entry point: config, store, routes, server
│   ├── internal/...    packages (store, model, api, auth, media, seed)
│   ├── admin/          vanilla HTML/CSS/JS admin panel, embedded into the binary (go:embed)
│   ├── seed/seed.json  initial content (phibio.de content, TR + EN)
│   ├── Dockerfile
│   └── data/           runtime data dir (git-ignored): *.json + uploads/
├── mobile/             Expo SDK 57 / React Native 0.86, TypeScript, minimal deps
│   ├── App.tsx
│   ├── src/            app code (navigation, i18n, api, screens, components, theme)
│   ├── assets/         icon, adaptive icon, splash, favicon
│   ├── app.json        store-ready config
│   └── eas.json        EAS build/submit profiles
└── docs/               this contract, API spec, publishing + admin guides
```

## 2. Site structure being mirrored (from phibio.de)

| Website section | Content | Mobile screen |
|---|---|---|
| Hero | "Biotechnology Inspired by Nature", slogan "Pure and Cure" | Home (top) |
| About Us | "Our Commitment and Focus", "Quality and Global Presence", est. 2012, Frankfurt am Main, ISO + MDR-approved CE certificates | About tab, Home teaser |
| Stats | 14+ years production & research · 1 patented formulation · 100+ scientific studies | Home stats row |
| Areas | Orthopaedics · Ophthalmology · Dermatology | Home area cards, Products filter |
| Innovative Products | ViscoPhi™ (intra-articular, Class III), VisOcu™ (ophthalmic OVD, Class IIb, HA + HPMC, 8 dosages), PhilExir™ (dermal fillers) | Products tab + Product detail |
| News (new for the app) | Articles created in the admin panel | News tab + News detail |
| Contact – "Let's Start a Conversation" / "Get in touch" | info@phibio.de · 069 40767397 · Klingerstraße 24, 60313 Frankfurt am Main · weekday business hours | Contact tab (call / mail / map actions) |
| Legal | Imprint, privacy policy (required by stores) | About → Legal |

## 3. Localisation model

* Every human-readable content field is a **LocalizedString**:
  `{"tr": "...", "en": "..."}`. Both keys are always present (may be empty).
* The app picks the active language; if the active language string is empty it
  falls back to the other language, then to an empty string. The backend never
  does the fallback – it always returns both languages.
* Brand/product names (ViscoPhi™, VisOcu™, PhilExir™, Phibio) are plain
  strings, not localized.
* Static UI strings of the app (tab titles, buttons, errors) live in the app
  (`src/i18n/`), not in the backend.

## 4. Data model (JSON on disk, `DATA_DIR`)

```
data/
├── site.json       SiteSettings
├── news.json       News[]
├── products.json   Product[]
├── media.json      Media[]
├── users.json      AdminUser[]  (PBKDF2-SHA256 hashes, never plaintext)
└── uploads/        <mediaId>.<ext> original + <mediaId>_w1200.jpg + <mediaId>_w400.jpg
```

Writes are **atomic** (write temp file in the same dir, fsync, rename) and
serialised through a mutex. The whole store is small (a company site), so
each collection is loaded in memory and persisted as a whole file.

IDs: 16 lowercase hex chars from `crypto/rand`. Slugs: ASCII-lowercased,
`[a-z0-9-]`, unique per collection, auto-generated from the English title
(fallback Turkish) if empty; Turkish characters are transliterated
(ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u).

Times: RFC 3339 UTC strings in JSON (`"2026-10-10T12:00:00Z"`).

### 4.1 Types (canonical Go names; JSON tags in parentheses)

```go
type LocalizedString struct { TR string `json:"tr"`; EN string `json:"en"` }

// A content block. Only the fields relevant to Type are used.
type Block struct {
    Type    string            `json:"type"`              // "heading" | "paragraph" | "image" | "list" | "quote" | "button"
    Text    LocalizedString   `json:"text"`              // heading, paragraph, quote
    Items   []LocalizedString `json:"items,omitempty"`   // list
    Image   string            `json:"image,omitempty"`   // media id (image)
    Caption LocalizedString   `json:"caption"`           // image
    URL     string            `json:"url,omitempty"`     // button (https://, mailto:, tel:)
    Label   LocalizedString   `json:"label"`             // button
}

type News struct {
    ID          string          `json:"id"`
    Slug        string          `json:"slug"`
    Title       LocalizedString `json:"title"`
    Summary     LocalizedString `json:"summary"`
    Cover       string          `json:"cover"`            // media id, may be ""
    Blocks      []Block         `json:"blocks"`
    Category    string          `json:"category"`         // "news" | "event" | "press" | "product"
    Tags        []string        `json:"tags"`
    Featured    bool            `json:"featured"`
    Status      string          `json:"status"`           // "draft" | "published"
    PublishedAt time.Time       `json:"publishedAt"`
    CreatedAt   time.Time       `json:"createdAt"`
    UpdatedAt   time.Time       `json:"updatedAt"`
}

type Product struct {
    ID          string          `json:"id"`
    Slug        string          `json:"slug"`
    Name        string          `json:"name"`             // "ViscoPhi™"
    Area        string          `json:"area"`             // "orthopaedics" | "ophthalmology" | "dermatology"
    Tagline     LocalizedString `json:"tagline"`          // one line under the name
    Summary     LocalizedString `json:"summary"`          // 1–2 sentences (cards)
    Blocks      []Block         `json:"blocks"`           // long description
    Features    []LocalizedString `json:"features"`       // bullet highlights
    Specs       []Spec          `json:"specs"`            // label/value table
    Cover       string          `json:"cover"`            // media id
    Gallery     []string        `json:"gallery"`          // media ids
    Documents   []Document      `json:"documents"`        // brochures etc.
    Order       int             `json:"order"`
    Status      string          `json:"status"`           // "draft" | "published"
    CreatedAt   time.Time       `json:"createdAt"`
    UpdatedAt   time.Time       `json:"updatedAt"`
}
type Spec     struct { Label LocalizedString `json:"label"`; Value LocalizedString `json:"value"` }
type Document struct { Title LocalizedString `json:"title"`; URL string `json:"url"` }

type Area struct {
    Key         string          `json:"key"`              // "orthopaedics" | "ophthalmology" | "dermatology"
    Name        LocalizedString `json:"name"`
    Description LocalizedString `json:"description"`
    Image       string          `json:"image"`            // media id, may be ""
}
type Stat struct { Value string `json:"value"`; Label LocalizedString `json:"label"` }  // "14+", {"tr":"Yıl Üretim ve Araştırma","en":"Years of Production & Research"}

type Contact struct {
    Email        string          `json:"email"`
    Phone        string          `json:"phone"`           // E.164 for tel: links, e.g. "+496940767397"
    PhoneDisplay string          `json:"phoneDisplay"`    // "069 40767397"
    AddressLines []string        `json:"addressLines"`    // ["Klingerstraße 24", "60313 Frankfurt am Main", "Germany"]
    MapURL       string          `json:"mapUrl"`          // https://maps.google.com/?q=...
    Hours        LocalizedString `json:"hours"`
    Website      string          `json:"website"`         // https://www.phibio.de
}
type SocialLink struct { Kind string `json:"kind"`; URL string `json:"url"` }  // kind: linkedin|instagram|facebook|x|youtube

type SiteSettings struct {
    CompanyName   string          `json:"companyName"`    // "Phibio GmbH"
    Slogan        LocalizedString `json:"slogan"`         // "Pure and Cure"
    HeroTitle     LocalizedString `json:"heroTitle"`      // "Biotechnology Inspired by Nature"
    HeroSubtitle  LocalizedString `json:"heroSubtitle"`
    HeroImage     string          `json:"heroImage"`      // media id
    AboutTitle    LocalizedString `json:"aboutTitle"`
    AboutBlocks   []Block         `json:"aboutBlocks"`
    Stats         []Stat          `json:"stats"`
    Areas         []Area          `json:"areas"`
    Contact       Contact         `json:"contact"`
    Social        []SocialLink    `json:"social"`
    Imprint       []Block         `json:"imprint"`        // legal notice
    Privacy       []Block         `json:"privacy"`        // privacy policy
    UpdatedAt     time.Time       `json:"updatedAt"`
}

type Media struct {
    ID        string            `json:"id"`
    FileName  string            `json:"fileName"`         // original name (sanitised)
    Mime      string            `json:"mime"`             // image/jpeg | image/png | image/webp(stored as-is, no variants)
    Width     int               `json:"width"`
    Height    int               `json:"height"`
    Size      int64             `json:"size"`
    Variants  map[string]string `json:"variants"`         // {"orig":"abc.jpg","w1200":"abc_w1200.jpg","w400":"abc_w400.jpg"}
    Alt       LocalizedString   `json:"alt"`
    CreatedAt time.Time         `json:"createdAt"`
}

type AdminUser struct {
    Username  string `json:"username"`
    Salt      string `json:"salt"`        // base64
    Hash      string `json:"hash"`        // base64, PBKDF2-HMAC-SHA256, 210000 iterations, 32 bytes
    CreatedAt time.Time `json:"createdAt"`
}
```

### 4.2 Image resolution in API output

Stored documents reference images by **media id**. Every public and admin API
response **resolves** these into `ImageRef` objects so that clients never build
URLs themselves:

```json
{ "id": "a1b2c3d4e5f60718", "url": "https://api.example.com/uploads/a1b2c3d4e5f60718_w1200.jpg",
  "thumb": "https://api.example.com/uploads/a1b2c3d4e5f60718_w400.jpg",
  "orig": "https://api.example.com/uploads/a1b2c3d4e5f60718.png",
  "width": 1600, "height": 900, "alt": {"tr": "", "en": ""} }
```

Resolution applies to: `News.cover`, `Product.cover`, `Product.gallery[]`,
`Area.image`, `SiteSettings.heroImage`, and `Block.image` (for `type:"image"`).
A missing/unknown id resolves to `null`. The admin panel sends media **ids**
when saving (the `id` field of the ImageRef). `url` points at the w1200
variant (or the original for webp/small images), `thumb` at w400.

Absolute URLs use `BASE_URL` if configured, otherwise the request's
`X-Forwarded-Proto`/`Host` (fallback `http://` + `Host`).

## 5. Backend (Go, stdlib only)

* Go 1.24, `net/http` with method+pattern routing (`mux.HandleFunc("GET /api/v1/news/{slug}", ...)`).
* **No third-party modules.** `go.mod` has no `require` lines.
* Packages: `internal/model` (types above), `internal/store` (JSON persistence),
  `internal/auth` (PBKDF2 via `crypto/pbkdf2`, sessions, rate limit),
  `internal/media` (decode, resize with stdlib `image`, encode JPEG),
  `internal/api` (handlers, JSON helpers, CORS, ImageRef resolution),
  `internal/seed` (first-run content).
* Configuration (env vars, all optional):

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | listen port |
| `DATA_DIR` | `./data` | storage dir (created if missing) |
| `BASE_URL` | `` | public origin for absolute media URLs, e.g. `https://api.phibio.de` |
| `ADMIN_USER` | `admin` | initial admin username (first run only) |
| `ADMIN_PASSWORD` | `` | initial admin password; if empty on first run a random one is generated and **printed to the log once** |
| `MAX_UPLOAD_MB` | `20` | upload size limit |
| `CORS_ORIGINS` | `*` | allowed origins for `/api/v1` (public API) |
| `SEED` | `1` | seed content on first run (`0` to start empty) |

* Logging: one line per request (`method path status duration`) with `log`.
* Graceful shutdown on SIGINT/SIGTERM.
* Security: admin cookie `phibio_session` (HttpOnly, SameSite=Strict, Secure when
  the request is https or `X-Forwarded-Proto: https`), sessions in memory with
  24h idle expiry, login rate limiting (5 failures / 15 min per IP), mutating
  admin requests must carry header `X-Requested-With: phibio-admin` (CSRF
  defence on top of SameSite), upload content sniffed with
  `http.DetectContentType` and only image types accepted, file names never
  taken from the client, path traversal impossible (ids are hex only).
* Public API responses carry `Cache-Control: public, max-age=60` and an
  `ETag` (sha256 of body) with `If-None-Match` → 304 support. Uploads are
  served with `Cache-Control: public, max-age=31536000, immutable`.
* Tests: `go test ./...` must pass; cover store atomicity, slugify, auth
  hashing, resize, and an httptest walk through login → create news → public read.

## 6. Admin panel (vanilla web, embedded in Go)

Served at `/admin/` from `backend/admin/` via `go:embed`. **No frameworks, no
build step, no CDN** – plain `index.html`, `app.js` (ES modules allowed),
`styles.css`. Works in current Chrome/Edge/Safari/Firefox on desktop.

Features required:
1. Login screen; session persists via cookie.
2. Dashboard: counts, latest news, quick "New article" button.
3. News list (status, date, cover thumb, search) and editor:
   * Turkish and English fields **side by side** for every text (TR left, EN right),
     with a "Copy TR → EN" helper per field.
   * Block editor: add / reorder (up/down + drag) / delete blocks of type heading,
     paragraph, image, list, quote, button. Images are added by drag-and-drop or
     file picker onto the block, uploaded immediately via `/api/admin/media`,
     thumbnail shown.
   * Cover picker (upload or choose from media library).
   * **Cover composer** ("Görsel Oluştur"): canvas-based tool where a
     non-technical user picks a background (uploaded photo or brand gradient
     preset), a layout preset, types the title text (TR or EN), picks text
     colour, and exports a 1200×675 PNG that is uploaded as media and set as
     cover. Must work fully client-side with `<canvas>`.
   * Live preview: a phone-shaped frame on the right that renders the article
     exactly like the mobile app (same block → layout mapping and colours), with
     a TR/EN toggle.
   * Status draft/published, publish date, category, featured, slug (auto).
   * Save (PUT), Delete with confirm.
4. Products list/editor (same block editor, plus features, specs, gallery, area, order).
5. Site settings editor: hero, about blocks, stats, areas, contact, social, imprint, privacy.
6. Media library: grid, upload, alt text, delete (refuses if in use – backend returns 409).
7. Account: change password; Export/Import JSON backup.
8. UI language of the admin itself: Turkish by default with an EN toggle (strings in one object).
9. All API errors are shown as toast messages in plain language.

## 7. Mobile app (Expo SDK 57, TypeScript, minimal deps)

Allowed runtime dependencies (nothing else without a very good reason):
`expo`, `expo-status-bar`, `expo-splash-screen`, `expo-localization`,
`react`, `react-native`, `react-native-safe-area-context`,
`@react-native-async-storage/async-storage`, and `@expo/vector-icons`
(ships inside `expo`). **No expo-router, no react-navigation, no state
library, no i18n library, no UI kit.**

* Navigation: a small in-house navigator in `src/navigation/` – bottom tabs
  (Home, Products, News, About, Contact) + a per-tab stack for detail screens,
  with `Animated` slide transition, Android hardware back support, and screens
  kept mounted so scroll position is retained.
* i18n: `src/i18n/{tr,en}.ts` + `useT()` hook; device language from
  `expo-localization` on first start, user toggle in header persisted in
  AsyncStorage; `L(ls: LocalizedString)` helper applies the fallback rule in §3.
* Data: `src/api/client.ts` fetches `GET /api/v1/bundle` on start (and on
  pull-to-refresh), stores it in AsyncStorage as the offline cache, and renders
  cached data immediately on cold start. Detail screens use the bundle data
  (news beyond the bundle's 20 latest are fetched via `/api/v1/news?offset=`).
  Base URL from `process.env.EXPO_PUBLIC_API_URL` (`.env` committed with a
  placeholder; `.env.local` git-ignored).
* Screens mirror §2. Block renderer in `src/components/Blocks.tsx` maps block
  types to native views (headings, paragraphs, images with caption, bullet
  lists, quotes, link buttons via `Linking`).
* Theme in `src/theme.ts`: primary teal `#0E7C86`, primary dark `#0A5C63`,
  mint surface `#E8F4F2`, background `#FFFFFF`, text `#0F172A`, muted
  `#64748B`, border `#E2E8F0`; area colours orthopaedics `#2563EB`,
  ophthalmology `#0E7C86`, dermatology `#DB2777`. Light theme only
  (`userInterfaceStyle: "light"`).
* Store readiness: `app.json` with name "Phibio", slug `phibio`, scheme
  `phibio`, `ios.bundleIdentifier` `de.phibio.app`, `android.package`
  `de.phibio.app`, version `1.0.0`, `ios.buildNumber`/`android.versionCode`,
  icons + adaptive icon + splash (brand teal background), `ios.infoPlist`
  with `ITSAppUsesNonExemptEncryption: false`, no unnecessary permissions,
  `eas.json` with development / preview / production profiles and `submit`
  config placeholders. `npx tsc --noEmit` and `npx expo export --platform
  android` must succeed.

## 8. Conventions

* Commit messages: imperative, English.
* Everything user-facing in the app and admin exists in both TR and EN.
* No TODOs left in code for required features; stubs are not acceptable.
* Secrets never committed. `backend/data/` and `mobile/.env.local` are git-ignored.
