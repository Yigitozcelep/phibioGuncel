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

# Mobile app smoke walk (web build)

`mobile-web.smoke.js` renders the Expo app as a **web build** in headless
Chromium (phone viewport, 390×844 @2x, touch) against a running backend and
walks every screen: Home, Products, News, About, Contact, a product detail
with the gallery viewer, a news detail, "load more", the imprint and privacy
pages, everything again in English, the offline banner (cached bundle with
the API blocked) and the cold-start error state with retry. Any console
warning/error or uncaught page error fails the run; a screenshot of each
screen is written to `SHOTS`. It is a developer tool, not part of the app or
of `go test`.

The app does not ship a web target, so the web renderer is installed
**temporarily and without touching `package.json`/`package-lock.json`**
(`--no-save`), with the versions Expo pins for the SDK
(`node_modules/expo/bundledNativeModules.json`). Afterwards `npm prune`
removes the two packages again. Export with `--dev` so that React's
development warnings (missing keys, state updates on unmounted components,
invalid props) reach the console; a production export strips them.

```bash
# 1. backend (see above), e.g. on port 8095
# 2. temporary web renderer + export
cd mobile
npm install --no-save react-native-web@~0.21.0 react-dom@19.2.3
EXPO_PUBLIC_API_URL=http://localhost:8095 EXPO_NO_TELEMETRY=1 CI=1 \
  npx expo export --platform web --dev --output-dir /tmp/phibio-web
# 3. static server for the export
python3 -m http.server 8096 --directory /tmp/phibio-web &
# 4. the walk (ADMIN_PASSWORD is optional: it adds 22 published articles so
#    "load more" has a second page, and deletes them again)
PW_MODULE=$(pwd)/node_modules/playwright APP_URL=http://localhost:8096 \
  API_URL=http://localhost:8095 ADMIN_PASSWORD=test1234 \
  SHOTS=/tmp/phibio-mobile-shots node backend/e2e/mobile-web.smoke.js
# 5. clean up
cd mobile && git checkout -- package.json package-lock.json && npm prune
```

| Var | Default | Meaning |
|---|---|---|
| `PW_MODULE` | `playwright` | path (or module name) of the Playwright package to `require` |
| `APP_URL` | `http://localhost:8096` | origin serving the web export |
| `API_URL` | `http://localhost:8095` | backend origin (must match `EXPO_PUBLIC_API_URL` of the export) |
| `SHOTS` | `<tmp>/phibio-mobile-web` | screenshot directory |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `admin` / – | optional; enables the "load more" check |
| `HEADLESS` | `1` | set `0` to watch the browser |

Stable selectors come from `testID` props in the app (`tab-<name>`,
`lang-<code>`, `header-back`, `product-<slug>`, `news-<slug>`, `gallery-<i>`,
`image-viewer`, `viewer-close`, `legal-<kind>`, `news-load-more`,
`offline-banner`, `offline-retry`, `error-state`, `error-retry`), which
react-native-web renders as `data-testid`.
