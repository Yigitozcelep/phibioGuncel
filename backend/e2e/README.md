# Admin panel end-to-end test

`admin.e2e.js` drives the real admin panel in headless Chromium with
[Playwright](https://playwright.dev) against a running backend. It signs in,
checks the dashboard, creates an article with every block type (including an
image upload and a cover made with the composer), saves, reloads, publishes,
verifies the public API, exercises the media library (upload, alt text, the
409 "in use" answer), the product editor, site settings, the JSON export, the
language toggle and finally deletes the article. Browser console errors fail
the run. Screenshots are written for a visual check.

The script is plain Node (no test runner) and is not part of `go test`.

## Run

```bash
# 1. backend with a throw-away data dir
cd backend && go build -o /tmp/phibio-server . && \
  PORT=8090 DATA_DIR=/tmp/phibio-e2e-data ADMIN_PASSWORD=test1234 \
  BASE_URL=http://localhost:8090 /tmp/phibio-server &

# 2. Playwright + Chromium (once)
npm i playwright@1.56.0 && npx playwright install chromium

# 3. the walk
PW_MODULE=$(pwd)/node_modules/playwright BASE=http://localhost:8090 \
  ADMIN_PASSWORD=test1234 SHOTS=/tmp/phibio-shots node backend/e2e/admin.e2e.js
```

Environment variables:

| Var | Default | Meaning |
|---|---|---|
| `PW_MODULE` | `playwright` | path (or module name) of the Playwright package to `require` |
| `BASE` | `http://localhost:8080` | backend origin |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `admin` / – | panel credentials (password required) |
| `SHOTS` | `<tmp>/phibio-e2e` | screenshot directory |
| `IMAGE` | `backend/seed/images/news-app.jpg` | image used for the uploads |
| `HEADLESS` | `1` | set `0` to watch the browser |

The walk creates and deletes its own article (`playwright-test-article-<n>`),
but the uploaded images stay in the media library of the data dir you point
it at, so use a scratch `DATA_DIR`.
