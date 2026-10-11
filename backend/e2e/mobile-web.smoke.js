#!/usr/bin/env node
// Smoke walk through the Expo mobile app rendered as a web build (react-native-web)
// with Playwright (headless Chromium, phone viewport), against a running backend.
//
//   PW_MODULE=/path/to/node_modules/playwright APP_URL=http://localhost:8096 \
//   API_URL=http://localhost:8095 SHOTS=/tmp/phibio-mobile-shots \
//   node backend/e2e/mobile-web.smoke.js
//
// See backend/e2e/README.md for how to produce the web build. The walk opens
// every tab and detail screen in Turkish and English, exercises the gallery
// viewer, "load more", the legal pages, the offline banner (cached bundle
// with the API blocked) and the cold-start error state with retry. Any
// browser console warning/error or uncaught page error fails the run.
//
// Optional: ADMIN_USER / ADMIN_PASSWORD – when set, the walk creates extra
// published articles through the admin API so that "load more" has a second
// page, and deletes them again at the end. HEADLESS=0 shows the browser.

const fs = require('fs');
const os = require('os');
const path = require('path');

const PW_MODULE = process.env.PW_MODULE || 'playwright';
const APP_URL = (process.env.APP_URL || 'http://localhost:8096').replace(/\/$/, '');
const API_URL = (process.env.API_URL || 'http://localhost:8095').replace(/\/$/, '');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'phibio-mobile-web');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const HEADLESS = process.env.HEADLESS !== '0';
const EXTRA_ARTICLES = 22; // bundle carries 20 → with the 3 seeded ones there is a second page

const { chromium } = require(PW_MODULE);

function assert(cond, message) {
  if (!cond) throw new Error('Assertion failed: ' + message);
}

const consoleIssues = [];
const pageErrors = [];
// True while the walk itself blocks the API: Chromium then logs
// "Failed to load resource: net::ERR_INTERNET_DISCONNECTED" for each aborted request.
let expectNetworkFailures = false;

async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, name + '.png');
  await page.screenshot({ path: file, fullPage: false });
  console.log('  screenshot:', file);
}

/** Visible element by testID (hidden tab panes use display:none, so :visible skips them). */
function byId(page, id) {
  return page.locator(`[data-testid="${id}"]:visible`).first();
}

/** Scrolls the top-most visible vertical scroll container (ScrollView / FlatList). */
async function scrollActive(page, to) {
  return page.evaluate((to) => {
    const scrollers = Array.from(document.querySelectorAll('div')).filter((el) => {
      const cs = getComputedStyle(el);
      return (
        (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight + 2 &&
        el.getClientRects().length > 0
      );
    });
    const el = scrollers[scrollers.length - 1];
    if (!el) return null;
    const max = el.scrollHeight - el.clientHeight;
    if (to === 'bottom') el.scrollTop = max;
    else if (to === 'top') el.scrollTop = 0;
    else el.scrollTop = Math.min(max, to);
    el.dispatchEvent(new Event('scroll'));
    return { scrollTop: el.scrollTop, max };
  }, to);
}

const settle = (page, ms = 400) => page.waitForTimeout(ms);

async function tapTab(page, tab) {
  await byId(page, `tab-${tab}`).click();
  await settle(page, 200);
}

async function goBack(page) {
  const back = byId(page, 'header-back');
  await back.click();
  // The screen slides out and is unmounted afterwards.
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="header-back"]') ||
      !Array.from(document.querySelectorAll('[data-testid="header-back"]')).some((el) => el.getClientRects().length > 0),
    null,
    { timeout: 5000 },
  );
  await settle(page, 150);
}

async function setLang(page, code) {
  await byId(page, `lang-${code}`).click();
  await settle(page, 200);
}

// ---------- optional admin helpers (extra articles for "load more") ----------

async function adminLogin() {
  const res = await fetch(`${API_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'phibio-admin' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASSWORD }),
  });
  assert(res.ok, `admin login failed: HTTP ${res.status}`);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  assert(cookie.startsWith('phibio_session='), 'no session cookie');
  return cookie;
}

async function createExtraArticles(cookie) {
  const ids = [];
  const stamp = Date.now();
  for (let i = 0; i < EXTRA_ARTICLES; i++) {
    const n = i + 1;
    const body = {
      slug: `smoke-article-${stamp}-${n}`,
      title: { tr: `Deneme haberi ${n}`, en: `Smoke test article ${n}` },
      summary: { tr: `Yükleme testi için oluşturulan ${n}. haber.`, en: `Article ${n} created for the load-more test.` },
      cover: null,
      category: ['news', 'event', 'press', 'product'][i % 4],
      tags: ['smoke'],
      featured: false,
      status: 'published',
      publishedAt: new Date(Date.UTC(2020, 0, 1 + i)).toISOString(),
      blocks: [{ type: 'paragraph', text: { tr: `Bu ${n}. deneme haberinin metnidir.`, en: `This is the body of smoke article ${n}.` } }],
    };
    const res = await fetch(`${API_URL}/api/admin/news`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'phibio-admin', Cookie: cookie },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    assert(res.status === 201, `create article ${n}: HTTP ${res.status} ${text}`);
    ids.push(JSON.parse(text).id);
  }
  return ids;
}

async function deleteArticles(cookie, ids) {
  for (const id of ids) {
    await fetch(`${API_URL}/api/admin/news/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'phibio-admin', Cookie: cookie },
    }).catch(() => undefined);
  }
}

// ---------- the walk ----------

async function walkTabs(page, lang, t) {
  // Home: wait for real content (hero + a product card), then scroll to the bottom.
  await tapTab(page, 'home');
  await byId(page, 'product-viscophi').waitFor({ timeout: 20000 });
  await page.getByText(t.heroCta, { exact: true }).first().waitFor();
  await scrollActive(page, 'top');
  await shot(page, `home-${lang}-top`);
  await scrollActive(page, 'bottom');
  await settle(page);
  assert(await page.getByText(t.contactTitle, { exact: true }).first().isVisible(), `home contact strip (${lang})`);
  await shot(page, `home-${lang}-bottom`);
  await scrollActive(page, 'top');

  // Products.
  await tapTab(page, 'products');
  await byId(page, 'product-viscophi').waitFor();
  assert(await page.getByText(t.products, { exact: true }).first().isVisible(), `products header (${lang})`);
  await shot(page, `products-${lang}`);

  // News.
  await tapTab(page, 'news');
  await byId(page, 'news-phibio-mobile-app-is-live').waitFor();
  await shot(page, `news-${lang}`);

  // About.
  await tapTab(page, 'about');
  await byId(page, 'legal-imprint').waitFor();
  await scrollActive(page, 'top');
  await shot(page, `about-${lang}-top`);
  await scrollActive(page, 'bottom');
  await settle(page);
  await shot(page, `about-${lang}-bottom`);
  await scrollActive(page, 'top');

  // Contact.
  await tapTab(page, 'contact');
  await page.getByText(t.contactHeading, { exact: true }).first().waitFor();
  await shot(page, `contact-${lang}`);
}

async function main() {
  let cookie = null;
  let extraIds = [];
  if (ADMIN_PASSWORD) {
    cookie = await adminLogin();
    extraIds = await createExtraArticles(cookie);
    console.log(`created ${extraIds.length} extra articles for the load-more test`);
  } else {
    console.log('ADMIN_PASSWORD not set: skipping the extra articles (load more is only checked when present)');
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'tr-TR',
  });
  const page = await context.newPage();
  // Linking.openURL on web calls window.open: close whatever pops up.
  context.on('page', (p) => { if (p !== page) p.close().catch(() => undefined); });
  // A `--dev` web export ships Metro's HMR client, which tries to open
  // ws://<host>/hot and /message against the static file server. Not app code.
  const HMR_NOISE = /WebSocket connection to 'ws:\/\/[^']*\/(hot|message)' failed/;
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (HMR_NOISE.test(text)) return;
    if (expectNetworkFailures && /ERR_INTERNET_DISCONNECTED/.test(text)) return;
    if (type === 'error' || type === 'warning' || /^Warning:/.test(text)) {
      consoleIssues.push(`[${type}] ${text}`);
      console.log('  console', type + ':', text.split('\n')[0].slice(0, 300));
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err && err.stack ? err.stack : err));
    console.log('  PAGE ERROR:', String(err).split('\n')[0]);
  });

  const TR = { heroCta: 'Ürünleri keşfedin', contactTitle: 'Hadi konuşmaya başlayalım', products: 'Ürünler', contactHeading: 'Bize ulaşın' };
  const EN = { heroCta: 'Discover products', contactTitle: "Let's start a conversation", products: 'Products', contactHeading: 'Get in touch' };

  try {
    console.log('1. cold start (TR)');
    await page.goto(APP_URL + '/', { waitUntil: 'load' });
    await byId(page, 'tab-home').waitFor({ timeout: 30000 });
    await byId(page, 'product-viscophi').waitFor({ timeout: 30000 });
    // The device locale is tr-TR, so the app must start in Turkish.
    assert(await page.getByText('Ana Sayfa', { exact: true }).first().isVisible(), 'starts in Turkish');
    await walkTabs(page, 'tr', TR);

    console.log('2. product detail + gallery viewer');
    await tapTab(page, 'products');
    await byId(page, 'product-viscophi').click();
    await byId(page, 'header-back').waitFor();
    await byId(page, 'gallery-0').waitFor();
    await settle(page);
    await shot(page, 'product-detail-tr-top');
    await byId(page, 'gallery-0').scrollIntoViewIfNeeded();
    await settle(page, 200);
    await byId(page, 'gallery-0').click();
    await byId(page, 'image-viewer').waitFor();
    await settle(page, 500);
    await shot(page, 'product-gallery-viewer-tr');
    await byId(page, 'viewer-close').click();
    await page.locator('[data-testid="image-viewer"]').waitFor({ state: 'hidden' });
    await scrollActive(page, 'bottom');
    await settle(page);
    await shot(page, 'product-detail-tr-bottom');
    // Linking action: the "contact about this product" mailto must not throw.
    await page.getByText('Bu ürün hakkında bize ulaşın', { exact: true }).first().click();
    await settle(page, 300);
    await goBack(page);
    assert(await byId(page, 'product-viscophi').isVisible(), 'back to the products list');

    console.log('3. news detail, share, load more');
    await tapTab(page, 'news');
    await byId(page, 'news-phibio-mobile-app-is-live').click();
    await byId(page, 'news-article').waitFor({ timeout: 15000 });
    await settle(page);
    await shot(page, 'news-detail-tr-top');
    await scrollActive(page, 'bottom');
    await settle(page);
    await shot(page, 'news-detail-tr-bottom');
    await byId(page, 'news-share').click(); // Share.share: must not crash where unsupported
    await settle(page, 300);
    await goBack(page);
    if (extraIds.length > 0) {
      // Before scrolling only the bundle's 20 items are shown.
      assert((await page.locator('[data-testid^="news-smoke-article-"]').count()) < extraIds.length, 'second page not loaded yet');
      await scrollActive(page, 'bottom');
      await settle(page);
      await shot(page, 'news-tr-load-more');
      // Reaching the end starts the next page automatically; if the button is
      // still there (no auto-load, or it failed), tap it.
      const more = page.locator('[data-testid="news-load-more"]:visible');
      if ((await more.count()) > 0) await more.first().click();
      await page.waitForFunction(
        (n) => document.querySelectorAll('[data-testid^="news-smoke-article-"]').length >= n,
        extraIds.length,
        { timeout: 15000 },
      );
      await scrollActive(page, 'bottom');
      await settle(page);
      assert((await page.locator('[data-testid="news-load-more"]').count()) === 0, 'load more disappears once everything is loaded');
      await shot(page, 'news-tr-all-loaded');
      await scrollActive(page, 'top');
    }

    console.log('4. legal pages');
    await tapTab(page, 'about');
    await byId(page, 'legal-imprint').scrollIntoViewIfNeeded();
    await byId(page, 'legal-imprint').click();
    await byId(page, 'header-back').waitFor();
    await page.getByText('Künye', { exact: true }).nth(1).waitFor();
    await settle(page);
    await shot(page, 'legal-imprint-tr');
    await goBack(page);
    await byId(page, 'legal-privacy').click();
    await byId(page, 'header-back').waitFor();
    await settle(page);
    await shot(page, 'legal-privacy-tr');
    await scrollActive(page, 'bottom');
    await settle(page);
    await shot(page, 'legal-privacy-tr-bottom');
    await goBack(page);
    await scrollActive(page, 'top');

    console.log('5. English');
    await setLang(page, 'en');
    await page.getByText('Home', { exact: true }).first().waitFor();
    await walkTabs(page, 'en', EN);
    await tapTab(page, 'products');
    await byId(page, 'product-viscophi').click();
    await byId(page, 'gallery-0').waitFor();
    await settle(page);
    await shot(page, 'product-detail-en');
    await goBack(page);
    await tapTab(page, 'news');
    await byId(page, 'news-phibio-mobile-app-is-live').click();
    await byId(page, 'news-article').waitFor();
    await settle(page);
    await shot(page, 'news-detail-en');
    await goBack(page);
    await tapTab(page, 'about');
    await byId(page, 'legal-privacy').scrollIntoViewIfNeeded();
    await byId(page, 'legal-privacy').click();
    await byId(page, 'header-back').waitFor();
    await settle(page);
    await shot(page, 'legal-privacy-en');
    await goBack(page);
    await scrollActive(page, 'top');
    // The choice persists across a reload.
    await page.reload({ waitUntil: 'load' });
    await byId(page, 'product-viscophi').waitFor({ timeout: 30000 });
    assert(await page.getByText('Home', { exact: true }).first().isVisible(), 'language persisted after reload');
    await setLang(page, 'tr');
    await page.getByText('Ana Sayfa', { exact: true }).first().waitFor();

    console.log('6. offline: cached bundle + banner');
    expectNetworkFailures = true;
    await page.route('**/api/v1/bundle*', (route) => route.abort('internetdisconnected'));
    await page.reload({ waitUntil: 'load' });
    await byId(page, 'offline-banner').waitFor({ timeout: 30000 });
    await byId(page, 'product-viscophi').waitFor();
    await shot(page, 'offline-banner-tr');
    await page.unroute('**/api/v1/bundle*');
    await byId(page, 'offline-retry').click();
    await page.locator('[data-testid="offline-banner"]').waitFor({ state: 'hidden', timeout: 15000 });
    await settle(page);
    expectNetworkFailures = false;

    console.log('7. first start with the API down → error state → retry');
    await page.evaluate(() => localStorage.clear());
    expectNetworkFailures = true;
    await page.route('**/api/v1/**', (route) => route.abort('internetdisconnected'));
    await page.reload({ waitUntil: 'load' });
    await byId(page, 'error-state').waitFor({ timeout: 30000 });
    await shot(page, 'error-state-tr');
    await tapTab(page, 'products');
    await byId(page, 'error-state').waitFor();
    await shot(page, 'error-state-products-tr');
    await page.unroute('**/api/v1/**');
    await byId(page, 'error-retry').click();
    await byId(page, 'product-viscophi').waitFor({ timeout: 20000 });
    assert((await page.locator('[data-testid="error-state"]:visible').count()) === 0, 'error state cleared after retry');
    expectNetworkFailures = false;
    await tapTab(page, 'home');
    await byId(page, 'product-viscophi').waitFor();
    await shot(page, 'recovered-home-tr');
  } finally {
    await browser.close();
    if (cookie && extraIds.length > 0) {
      await deleteArticles(cookie, extraIds);
      console.log(`deleted ${extraIds.length} extra articles`);
    }
  }

  console.log('');
  console.log(`console warnings/errors: ${consoleIssues.length}, page errors: ${pageErrors.length}`);
  if (consoleIssues.length > 0 || pageErrors.length > 0) {
    for (const line of consoleIssues) console.log(' -', line);
    for (const line of pageErrors) console.log(' -', line);
    process.exitCode = 1;
    return;
  }
  console.log('OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
