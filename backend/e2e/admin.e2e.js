#!/usr/bin/env node
// End-to-end walk through the admin panel with Playwright (headless Chromium).
//
//   PW_MODULE=/path/to/node_modules/playwright BASE=http://localhost:8090 \
//   ADMIN_PASSWORD=test1234 node backend/e2e/admin.e2e.js
//
// Optional: ADMIN_USER (default admin), SHOTS (directory for screenshots,
// default <os tmpdir>/phibio-e2e), IMAGE (image to upload, default
// backend/seed/images/news-app.jpg), HEADLESS=0 to watch the browser.

const fs = require('fs');
const os = require('os');
const path = require('path');

const PW_MODULE = process.env.PW_MODULE || 'playwright';
const BASE = (process.env.BASE || 'http://localhost:8080').replace(/\/$/, '');
const USER = process.env.ADMIN_USER || 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || '';
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'phibio-e2e');
const IMAGE = process.env.IMAGE || path.join(__dirname, '..', 'seed', 'images', 'news-app.jpg');
const HEADLESS = process.env.HEADLESS !== '0';

if (!PASSWORD) {
  console.error('ADMIN_PASSWORD is required');
  process.exit(2);
}
const { chromium } = require(PW_MODULE);

function assert(cond, message) {
  if (!cond) throw new Error('Assertion failed: ' + message);
}

const consoleErrors = [];
const stamp = Date.now();
const uniq = String(stamp).slice(-6);

/**
 * Reorder a block with a real HTML5 drag (grip → card). Both cards are
 * scrolled into view first: Chromium only starts a drag when no scrolling
 * happens between mouse-down and the first moves.
 */
async function dragBlock(page, from, to) {
  await page.evaluate((i) => {
    const el = document.querySelectorAll('#blocks .block')[i];
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 160);
  }, Math.min(from, to));
  await page.waitForTimeout(100);
  const blocks = page.locator('#blocks .block');
  const src = await blocks.nth(from).locator('.block-grip').boundingBox();
  const dst = await blocks.nth(to).boundingBox();
  const after = to > from;
  const sx = src.x + src.width / 2;
  const sy = src.y + src.height / 2;
  const tx = dst.x + dst.width / 2;
  const ty = after ? dst.y + dst.height - 8 : dst.y + 8;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 2, sy + 6);
  await page.mouse.move(sx + 4, sy + 12);
  await page.mouse.move(tx, ty, { steps: 12 });
  await page.mouse.move(tx, ty + (after ? -1 : 1));
  await page.mouse.up();
  await page.waitForTimeout(150);
}

async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, name + '.png');
  await page.screenshot({ path: file, fullPage: false });
  console.log('  screenshot:', file);
}

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'tr-TR' });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    // Responses this walk provokes on purpose: the session probe before login and the wrong
    // password (401), the delete of an image that is in use (409), the invalid button URL (400).
    if (/Failed to load resource: .*(401|409|400)/.test(msg.text())) return;
    consoleErrors.push('console.error: ' + msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  // ---- 1. login ---------------------------------------------------------
  console.log('1. login');
  await page.goto(BASE + '/admin/');
  await page.waitForSelector('#login-user');
  await shot(page, '00-login');
  await page.fill('#login-user', USER);
  await page.fill('#login-pass', 'wrong-password');
  await page.press('#login-pass', 'Enter');
  await page.waitForSelector('#login-error', { state: 'visible' });
  await page.fill('#login-pass', PASSWORD);
  await page.press('#login-pass', 'Enter');
  await page.waitForSelector('.stat-grid');
  assert(page.url().endsWith('#/dashboard'), 'dashboard route after login');

  // ---- 2. dashboard -----------------------------------------------------
  console.log('2. dashboard');
  const statValues = await page.$$eval('.stat-value', (els) => els.map((e) => e.textContent.trim()));
  console.log('  stats:', statValues.join(' / '));
  assert(Number(statValues[0]) >= 3, 'dashboard shows at least 3 news');
  const latestRows = await page.$$eval('.card-table tbody tr', (rows) => rows.length);
  assert(latestRows >= 3, 'latest news list has >= 3 rows');
  assert((await page.$('#dash-new-article')) !== null, 'new article button');
  const bundleHref = await page.getAttribute('#dash-bundle', 'href');
  assert(bundleHref === '/api/v1/bundle', 'bundle link');
  await shot(page, '01-dashboard');

  // ---- 3. news list + editor -------------------------------------------
  console.log('3. news list');
  await page.click('a[data-nav="news"]');
  await page.waitForSelector('#news-search');
  await page.waitForSelector('.table tbody tr');
  const newsRows = await page.$$eval('.table tbody tr', (rows) => rows.length);
  assert(newsRows >= 3, 'news list has rows');
  await page.fill('#news-search', 'viscophi');
  await page.waitForTimeout(200);
  const filtered = await page.$$eval('.table tbody tr', (rows) => rows.length);
  assert(filtered >= 1 && filtered < newsRows, 'search filters the list');
  await shot(page, '02-news-list');

  console.log('4. create article');
  await page.click('#news-new');
  await page.waitForSelector('#editor-save');
  const titleTr = 'Playwright test haberi ' + uniq;
  const titleEn = 'Playwright test article ' + uniq;
  await page.fill('.loc-field input[lang="tr"]', titleTr);
  await page.fill('.loc-field input[lang="en"]', titleEn);
  const slugValue = await page.inputValue('#news-slug');
  assert(slugValue === 'playwright-test-article-' + uniq, 'slug auto-generated from EN title: ' + slugValue);
  await page.fill('.loc-field textarea[lang="tr"]', 'Bu haber otomatik testle oluşturuldu.');
  await page.click('.loc-field .copy-tr >> nth=1');
  const enSummary = await page.inputValue('.loc-field textarea[lang="en"]');
  assert(enSummary === 'Bu haber otomatik testle oluşturuldu.', 'copy TR → EN fills empty EN summary');
  await page.fill('.loc-field textarea[lang="en"]', 'This article was created by an automated test.');

  // unsaved-changes guard
  await page.click('a[data-nav="news"]');
  await page.waitForSelector('.modal-confirm');
  await page.click('.modal-confirm .btn-secondary');
  await page.waitForSelector('.modal-confirm', { state: 'detached' });
  assert(page.url().endsWith('#/news/new'), 'stayed on the editor after cancelling the guard');

  // blocks
  const blocks = page.locator('#blocks');
  await blocks.locator('.add-heading').click();
  await blocks.locator('.block-heading input[lang="tr"]').fill('Test başlığı');
  await blocks.locator('.block-heading input[lang="en"]').fill('Test heading');
  await blocks.locator('.add-paragraph').click();
  await blocks.locator('.block-paragraph textarea[lang="tr"]').fill('Birinci paragraf. Türkçe metin içerir: ş, ğ, ı, ö, ç, ü.');
  await blocks.locator('.block-paragraph textarea[lang="en"]').fill('First paragraph of the article body.');
  await blocks.locator('.add-image').click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), blocks.locator('.block-image .drop-zone').click()]);
  await chooser.setFiles(IMAGE);
  await blocks.locator('.block-image .image-thumb img').waitFor({ timeout: 20000 });
  await blocks.locator('.block-image input[lang="tr"]').fill('Görsel açıklaması');
  await blocks.locator('.block-image input[lang="en"]').fill('Image caption');
  await blocks.locator('.add-list').click();
  await blocks.locator('.block-list textarea[lang="tr"]').fill('Birinci madde\nİkinci madde\nÜçüncü madde');
  await blocks.locator('.block-list textarea[lang="en"]').fill('First item\nSecond item\nThird item');
  await blocks.locator('.add-button').click();
  await blocks.locator('.block-button input[lang="tr"]').fill('Web sitesini ziyaret et');
  await blocks.locator('.block-button input[lang="en"]').fill('Visit the website');
  await blocks.locator('.block-button input.mono').fill('www.phibio.de');
  await page.click('#editor-save');
  await page.waitForSelector('.toast-error');
  assert(page.url().endsWith('#/news/new'), 'invalid button URL blocks save');
  await blocks.locator('.block-button input.mono').fill('https://www.phibio.de');

  // reorder: move the list block (index 3) above the image block via button, then back via drag
  await blocks.locator('.block').nth(3).locator('.block-up').click();
  let order = await blocks.locator('.block').evaluateAll((els) => els.map((e) => e.dataset.type));
  assert(order.join(',') === 'heading,paragraph,list,image,button', 'move up reorders: ' + order.join(','));
  await dragBlock(page, 2, 3);
  order = await blocks.locator('.block').evaluateAll((els) => els.map((e) => e.dataset.type));
  assert(order.join(',') === 'heading,paragraph,image,list,button', 'final block order: ' + order.join(','));

  // preview reflects the content (TR), then EN toggle
  const previewText = await page.textContent('.phone-screen');
  assert(previewText.includes(titleTr) && previewText.includes('Test başlığı') && previewText.includes('İkinci madde'), 'preview shows TR content');
  await page.click('.preview-head .seg-btn[data-lang="en"]');
  await page.waitForTimeout(100);
  const previewEn = await page.textContent('.phone-screen');
  assert(previewEn.includes(titleEn) && previewEn.includes('Visit the website'), 'preview shows EN content');
  await page.click('.preview-head .seg-btn[data-lang="tr"]');

  // ---- 5. composer ------------------------------------------------------
  console.log('5. cover composer');
  await page.click('.cover-create');
  await page.waitForSelector('.modal-composer canvas');
  await page.fill('.modal-composer textarea', 'Phibio mobil uygulaması yayında – yeni dönem başlıyor');
  await page.fill('.modal-composer input[type="text"]', 'Haberler, ürünler ve iletişim tek uygulamada');
  await page.click('.gradient-swatch >> nth=4');
  await page.waitForTimeout(150);
  await shot(page, '03-composer');
  await page.click('#composer-use');
  await page.waitForSelector('.modal-composer', { state: 'detached', timeout: 20000 });
  await page.waitForSelector('.cover-preview.has-image img');
  const coverSrc = await page.getAttribute('.cover-preview.has-image img', 'src');
  assert(coverSrc.includes('/uploads/'), 'cover assigned from composer: ' + coverSrc);
  await shot(page, '04-editor-preview');
  await page.locator('#blocks .block').nth(2).scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await shot(page, '04b-editor-blocks');

  // ---- 6. save, reload, verify --------------------------------------------
  console.log('6. save + reload');
  await page.click('#editor-save');
  await page.waitForURL(/#\/news\/[0-9a-f]{16}$/, { timeout: 15000 });
  const newsId = page.url().split('/').pop();
  console.log('  created id', newsId);
  await page.waitForSelector('#editor-delete');
  await page.reload();
  await page.waitForSelector('#editor-save');
  assert((await page.inputValue('.loc-field input[lang="tr"]')) === titleTr, 'title TR persisted');
  assert((await page.inputValue('.loc-field input[lang="en"]')) === titleEn, 'title EN persisted');
  assert((await page.inputValue('#news-slug')) === 'playwright-test-article-' + uniq, 'slug persisted');
  order = await page.locator('#blocks .block').evaluateAll((els) => els.map((e) => e.dataset.type));
  assert(order.join(',') === 'heading,paragraph,image,list,button', 'blocks persisted: ' + order.join(','));
  assert((await page.inputValue('#blocks .block-list textarea[lang="en"]')) === 'First item\nSecond item\nThird item', 'list items persisted');
  assert((await page.inputValue('#blocks .block-button input.mono')) === 'https://www.phibio.de', 'button url persisted');
  assert((await page.$('#blocks .block-image .image-thumb img')) !== null, 'image block persisted');
  assert((await page.$('.cover-preview.has-image img')) !== null, 'cover persisted');
  assert((await page.inputValue('#editor-status')) === 'draft', 'status is draft');
  const dirtyText = await page.textContent('.dirty-indicator');
  assert(!(await page.$('.dirty-indicator.is-dirty')), 'not dirty after reload: ' + dirtyText);

  // Ctrl+S with no changes still saves fine; then publish.
  console.log('7. publish');
  await page.selectOption('#editor-status', 'published');
  assert((await page.$('.dirty-indicator.is-dirty')) !== null, 'dirty after status change');
  await page.keyboard.press('Control+s');
  await page.waitForSelector('.toast-success');
  await page.waitForTimeout(300);
  const publishedAt = await page.inputValue('#news-publishedAt');
  assert(publishedAt !== '', 'publishedAt filled by server after publish');

  const slug = 'playwright-test-article-' + uniq;
  const res = await fetch(BASE + '/api/v1/news/' + slug);
  assert(res.status === 200, 'public GET /api/v1/news/' + slug + ' → ' + res.status);
  const pub = await res.json();
  assert(pub.title.en === titleEn, 'public article title');
  assert(pub.cover && pub.cover.url && pub.cover.url.includes('/uploads/'), 'public article cover resolved');
  assert(pub.blocks.length === 5 && pub.blocks[2].type === 'image' && pub.blocks[2].image && pub.blocks[2].image.thumb, 'public article image block resolved');
  console.log('  public article OK:', pub.cover.url);

  // ---- 8. media library ---------------------------------------------------
  console.log('8. media library');
  await page.click('a[data-nav="media"]');
  await page.waitForSelector('.media-card');
  const mediaCount = await page.$$eval('.media-card', (els) => els.length);
  assert(mediaCount >= 11, 'media library lists seed images + uploads: ' + mediaCount);
  await page.click('.media-card >> nth=0');
  await page.waitForSelector('#media-delete');
  await shot(page, '05-media-library');
  await page.click('#media-delete');
  await page.waitForSelector('.modal-confirm');
  await page.click('.modal-confirm .btn-danger');
  await page.waitForSelector('.toast-error');
  const errText = await page.textContent('.toast-error .toast-text');
  console.log('  409 message:', errText);
  assert(/kullanımda|in use/i.test(errText), 'in-use image delete shows the 409 message');
  // upload through the button
  const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#media-upload')]);
  await chooser2.setFiles(IMAGE);
  await page.waitForSelector('.toast-success');
  // alt text save
  await page.fill('.media-panel input[lang="en"]', 'Uploaded by e2e');
  await page.click('.media-panel .btn-primary');
  await page.waitForSelector('.toast-success >> nth=1');

  // ---- 9. products --------------------------------------------------------
  console.log('9. products');
  await page.click('a[data-nav="products"]');
  await page.waitForSelector('.table tbody tr');
  await page.click('.table tbody tr >> nth=0');
  await page.waitForSelector('#product-name');
  const prodName = await page.inputValue('#product-name');
  assert(prodName.length > 0, 'product editor loaded ' + prodName);
  const prodPreview = await page.textContent('.phone-screen');
  assert(prodPreview.includes(prodName), 'product preview shows the name');
  await shot(page, '06-product-editor');

  // ---- 10. site settings --------------------------------------------------
  console.log('10. site settings');
  await page.click('a[data-nav="site"]');
  await page.waitForSelector('#site-company');
  await page.waitForSelector('#site-hero .cover-preview');
  assert((await page.inputValue('#site-company')).length > 0, 'site company loaded');
  const areaRows = await page.$$eval('.area-row', (els) => els.length);
  assert(areaRows === 3, 'three areas');
  await shot(page, '07-site-settings');
  await page.fill('#site-company', 'Phibio GmbH');
  await page.click('#editor-save');
  await page.waitForSelector('.toast-success');

  // ---- 11. account: export ----------------------------------------------
  console.log('11. account');
  await page.click('a[data-nav="account"]');
  await page.waitForSelector('#export-btn');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  const dlPath = await download.path();
  const exported = JSON.parse(fs.readFileSync(dlPath, 'utf8'));
  assert(Array.isArray(exported.news) && exported.news.some((n) => n.id === newsId), 'export contains the new article');

  // ---- 12. language toggle + cleanup ------------------------------------
  console.log('12. language toggle, delete article');
  await page.click('.topbar .lang-toggle .seg-btn[data-lang="en"]');
  await page.waitForSelector('text=Account');
  assert((await page.textContent('a[data-nav="news"]')).trim() === 'News', 'UI switched to English');
  await page.click('.topbar .lang-toggle .seg-btn[data-lang="tr"]');
  await page.waitForSelector('text=Hesap');

  await page.goto(BASE + '/admin/#/news/' + newsId);
  await page.waitForSelector('#editor-delete');
  await page.click('#editor-delete');
  await page.waitForSelector('.modal-confirm');
  await page.click('.modal-confirm .btn-danger');
  await page.waitForURL(/#\/news$/);
  const gone = await fetch(BASE + '/api/v1/news/' + slug);
  assert(gone.status === 404, 'deleted article is gone from the public API');

  await browser.close();

  if (consoleErrors.length) {
    console.error('Browser console errors:');
    consoleErrors.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }
  console.log('ALL OK');
}

main().catch((err) => {
  console.error(err);
  if (consoleErrors.length) {
    console.error('Browser console errors:');
    consoleErrors.forEach((e) => console.error('  ' + e));
  }
  process.exit(1);
});
