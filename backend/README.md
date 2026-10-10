# Phibio backend (Go, standard library only)

The content server behind the Phibio mobile app and the admin panel.

* Public, read-only JSON API for the app (`/api/v1/...`, see `docs/API.md`)
* Admin API with cookie sessions (`/api/admin/...`)
* Admin panel served from the binary at `/admin/` (embedded with `go:embed`)
* Image uploads with automatic `w1200` / `w400` JPEG variants (`/uploads/...`)
* Storage: plain JSON files + an `uploads/` folder in `DATA_DIR` – no database

Go 1.24, **no third-party modules** (`go.mod` has no `require` lines).

## Build and run

```sh
cd backend
go build -o phibio-server .
ADMIN_PASSWORD='choose-a-strong-password' ./phibio-server
```

Then open <http://localhost:8080/admin/> and sign in with `admin` and the
password you set. If you start without `ADMIN_PASSWORD`, a random password is
generated on the very first start and printed **once** in the log:

```
Initial admin password: Xk9...
```

On the first start the server also imports the seed content (phibio.de texts
in Turkish and English, three products, three news articles and their
images). Set `SEED=0` to start empty instead.

Stop the server with Ctrl-C (SIGINT) or SIGTERM; in-flight requests get up to
10 seconds to finish.

### Development loop

```sh
gofmt -l .        # must print nothing
go vet ./...
go test ./...
go run .
```

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | listen port |
| `DATA_DIR` | `./data` | storage directory (created if missing) |
| `BASE_URL` | *(empty)* | public origin for absolute media URLs, e.g. `https://api.phibio.de`; empty = derived from the request (`X-Forwarded-Proto` / `X-Forwarded-Host` / `Host`) |
| `ADMIN_USER` | `admin` | initial admin username (first run only) |
| `ADMIN_PASSWORD` | *(empty)* | initial admin password (first run only); empty = generated and logged once |
| `MAX_UPLOAD_MB` | `20` | upload size limit |
| `CORS_ORIGINS` | `*` | allowed origins for `/api/v1` and `/uploads` (comma-separated) |
| `SEED` | `1` | import seed content on first run (`0` = start empty) |

The effective configuration (without the password) is printed at start.
`.env.example` documents the same variables.

## Data directory and backups

```
DATA_DIR/
├── site.json       site settings
├── news.json       articles
├── products.json   products
├── media.json      image metadata
├── users.json      admin accounts (PBKDF2-SHA256 hashes, never plaintext)
└── uploads/        <id>.<ext>  <id>_w1200.jpg  <id>_w400.jpg
```

Every write is atomic (temp file in the same directory, fsync, rename), so a
crash never leaves a half-written file. **A backup is simply a copy of
`DATA_DIR`** – for example:

```sh
tar czf phibio-backup-$(date +%F).tgz -C /path/to data
```

To restore, stop the server, put the folder back and start again. The admin
panel's *Export / Import* feature covers the JSON part only (texts and image
metadata); the `uploads/` folder must be copied separately.

If a JSON file is corrupt the server refuses to start and names the file in
the log; fix or remove it (or restore from backup) and start again.

## Running with Docker

```sh
cd backend
docker build -t phibio-server .
docker run -d --name phibio \
  -p 8080:8080 \
  -v phibio-data:/data \
  -e ADMIN_PASSWORD='choose-a-strong-password' \
  -e BASE_URL=https://api.phibio.de \
  phibio-server
```

The image is a static binary running as a non-root user with `/data` as a
volume. Back up the volume to back up everything.

## Behind a reverse proxy (recommended for production)

Terminate TLS in nginx/Caddy/Traefik and forward to the server. Make sure the
proxy sends `X-Forwarded-Proto: https` (so the session cookie is marked
`Secure`) and `X-Forwarded-For` (for login rate limiting). Set `BASE_URL` to
the public origin so image URLs are correct even for cached responses.

## Security notes

* Admin cookie `phibio_session`: HttpOnly, SameSite=Strict, Secure on HTTPS,
  24 h idle expiry, kept in memory (a restart signs everyone out).
* Mutating admin requests must send `X-Requested-With: phibio-admin`
  (CSRF defence in addition to SameSite). Login itself is exempt.
* Login: 5 failed attempts per IP → `429` for 15 minutes.
* Uploads: content is sniffed (`http.DetectContentType`); only JPEG, PNG,
  WebP and GIF are accepted; file names are never taken from the client; the
  `/uploads/{file}` route validates the name with a strict pattern before
  touching the disk.
* Error messages are returned in Turkish when the request carries
  `Accept-Language: tr…` or `X-Lang: tr`, otherwise in English. The shape is
  always `{"error": "...", "code": "..."}`.

## Images

JPEG/PNG uploads get two JPEG variants (quality 85): `w1200` and `w400`,
downscaled with an area-averaging filter, aspect ratio preserved, never
upscaled (a narrower source is simply re-encoded). Transparent PNG areas are
composited over white. WebP and GIF are stored as-is without variants
(`url` and `thumb` then point at the original); for WebP the width/height
are read from the file header and may be `0` for unusual containers. EXIF
orientation is not applied – export photos already rotated.

## Layout

```
backend/
├── main.go                 config, store, seed, admin bootstrap, server, shutdown
├── admin/embed.go          go:embed of admin/ui (the panel itself)
├── seed/embed.go           go:embed of seed.json + images/
├── internal/model          types, slugify, lenient JSON input types
├── internal/store          in-memory collections + atomic JSON persistence
├── internal/auth           PBKDF2 hashing, sessions, login rate limiter
├── internal/media          sniff, decode, box-filter resize, JPEG encode
├── internal/api            routes, middleware, handlers, ImageRef resolution
└── internal/seed           first-run importer
```
