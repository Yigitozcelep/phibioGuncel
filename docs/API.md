# Phibio Backend – HTTP API

Base path for the mobile app: `/api/v1` (public, read-only, CORS `*`).
Base path for the admin panel: `/api/admin` (cookie session, same origin).
All bodies are JSON (`Content-Type: application/json; charset=utf-8`) except
media upload (multipart). Errors use one shape:

```json
{ "error": "human readable message", "code": "not_found" }
```

Codes: `bad_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`,
`too_large`, `rate_limited`, `internal`.

`ImageRef` (see ARCHITECTURE §4.2) is returned wherever the stored document holds a media id;
`null` when empty.

## Public API

| Method & path | Response |
|---|---|
| `GET /healthz` | `{"ok":true,"time":"..."}` |
| `GET /api/v1/site` | `SiteSettings` (images resolved) |
| `GET /api/v1/news?limit=20&offset=0&category=news` | `{"items":[NewsSummary],"total":N,"limit":20,"offset":0}` – published only, newest `publishedAt` first. `limit` 1..100 (default 20). |
| `GET /api/v1/news/{slug}` | `News` (published only; images resolved) – 404 otherwise |
| `GET /api/v1/products?area=orthopaedics` | `[Product]` published, sorted by `order` then name |
| `GET /api/v1/products/{slug}` | `Product` |
| `GET /api/v1/bundle` | `{"version":"<sha256 prefix>","generatedAt":"...","site":SiteSettings,"products":[Product],"news":[NewsSummary],"newsTotal":N}` – everything the app needs at boot; `news` = 20 newest published summaries |
| `GET /uploads/{file}` | media file, `Cache-Control: public, max-age=31536000, immutable` |

`NewsSummary` = `News` without `blocks`:
`{id, slug, title, summary, cover, category, tags, featured, publishedAt}`.

Public GET responses: `Cache-Control: public, max-age=60`, `ETag`, honour
`If-None-Match` with `304`.

## Public HTML pages (for store listings)

| Path | Response |
|---|---|
| `GET /privacy` | Server-rendered HTML page of `SiteSettings.privacy` blocks. `?lang=tr` or `?lang=en` (default: `Accept-Language`, fallback en). Both languages linked at the top. No JavaScript, inline CSS only. |
| `GET /imprint` | Same for `SiteSettings.imprint`. |

These URLs are what the App Store / Play Store listings use as the privacy
policy and legal notice links.

## Admin API

Authentication: `POST /api/admin/login` sets cookie `phibio_session`.
Every other `/api/admin/*` route requires the cookie (else `401`).
Every mutating request (`POST`, `PUT`, `DELETE`) must also send header
`X-Requested-With: phibio-admin` (else `403`).

| Method & path | Body | Response |
|---|---|---|
| `POST /api/admin/login` | `{"username","password"}` | `200 {"username"}` / `401` / `429` |
| `POST /api/admin/logout` | – | `204` |
| `GET /api/admin/me` | – | `{"username"}` |
| `PUT /api/admin/password` | `{"current","new"}` (new ≥ 8 chars) | `204` |
| `GET /api/admin/site` | – | `SiteSettings` (resolved) |
| `PUT /api/admin/site` | `SiteSettings` with media **ids** in image fields (ImageRef objects are also accepted – the server takes `.id`) | `SiteSettings` (resolved) |
| `GET /api/admin/news?status=all` | – | `[News]` all statuses, newest `updatedAt` first |
| `POST /api/admin/news` | `News` (id ignored) | `201 News` |
| `GET /api/admin/news/{id}` | – | `News` |
| `PUT /api/admin/news/{id}` | `News` | `News` |
| `DELETE /api/admin/news/{id}` | – | `204` |
| `GET/POST /api/admin/products`, `GET/PUT/DELETE /api/admin/products/{id}` | same pattern as news | |
| `GET /api/admin/media` | – | `[MediaResolved]` newest first |
| `POST /api/admin/media` | multipart: `file` (required), `altTr`, `altEn` | `201 MediaResolved` |
| `PUT /api/admin/media/{id}` | `{"alt":{"tr","en"}}` | `MediaResolved` |
| `DELETE /api/admin/media/{id}` | – | `204`, or `409` if referenced by any document |
| `GET /api/admin/stats` | – | `{"news":N,"published":N,"products":N,"media":N,"latestNews":[NewsSummary]}` |
| `GET /api/admin/export` | – | `{"site","news","products","media"}` full backup (ids, not resolved) |
| `POST /api/admin/import` | the export shape | `204` – replaces collections (uploads must be copied separately) |

`MediaResolved` = `Media` + `url`, `thumb`, `orig` (absolute URLs).

Validation on save (400 with a message naming the field):
* news/product: `title`/`name` must have at least one non-empty language;
  `status` ∈ {draft, published}; `category` ∈ {news, event, press, product};
  `area` ∈ {orthopaedics, ophthalmology, dermatology}; block `type` valid;
  `button.url` must start with `https://`, `http://`, `mailto:` or `tel:`;
  slug uniqueness (`409`).
* `publishedAt` empty → set to now when status becomes published.
* Unknown media ids in image fields are rejected (`400`).

Upload rules: ≤ `MAX_UPLOAD_MB`; content sniffed; accepted `image/jpeg`,
`image/png`, `image/webp`, `image/gif` (gif/webp stored as-is, no resized
variants; `url`/`thumb` then point at the original). JPEG/PNG get `w1200` and
`w400` JPEG variants (quality 85, only downscaled, aspect preserved; if the
source is narrower than the variant width the variant is a plain re-encode).
EXIF orientation is not applied (stdlib limitation) – documented in the admin
guide (export photos already rotated).
