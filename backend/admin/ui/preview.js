// Live phone preview. Mirrors mobile/src/components/Blocks.tsx and the news /
// product detail screens: same block → layout mapping and the §7 palette.
// The TR/EN toggle above the frame is independent from the panel language.

import { L, formatDate, t, tl } from './i18n.js';
import { el, clear, icon } from './ui.js';

const AREA_COLORS = { orthopaedics: '#2563EB', ophthalmology: '#0E7C86', dermatology: '#DB2777' };

function tint(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#E8F4F2';
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.14)`;
}

function pill(label, color = '#0E7C86', solid = false) {
  return el('span.pv-pill', { style: solid ? { background: color, color: '#fff' } : { background: tint(color), color } }, label);
}

/** Render content blocks exactly like the app's Blocks component. */
export function renderBlocks(blocks, lang) {
  const out = el('div.pv-blocks');
  let count = 0;
  for (const b of blocks || []) {
    switch (b.type) {
      case 'heading': {
        const text = L(b.text, lang);
        if (!text) break;
        out.appendChild(el('h2.pv-h2', text));
        count++;
        break;
      }
      case 'paragraph': {
        const text = L(b.text, lang);
        if (!text) break;
        out.appendChild(el('p.pv-p', text));
        count++;
        break;
      }
      case 'image': {
        if (!b.image) break;
        const caption = L(b.caption, lang) || L(b.image.alt, lang);
        const ratio = b.image.width && b.image.height ? b.image.width / b.image.height : 16 / 9;
        out.appendChild(el('figure.pv-figure', el('img.pv-img', { src: b.image.url || b.image.thumb, alt: caption, style: { aspectRatio: String(ratio) } }), caption ? el('figcaption.pv-caption', caption) : null));
        count++;
        break;
      }
      case 'list': {
        const items = (b.items || []).map((it) => L(it, lang)).filter(Boolean);
        if (!items.length) break;
        out.appendChild(el('ul.pv-list', items.map((it) => el('li.pv-li', el('span.pv-bullet'), el('span', it)))));
        count++;
        break;
      }
      case 'quote': {
        const text = L(b.text, lang);
        if (!text) break;
        out.appendChild(el('blockquote.pv-quote', text));
        count++;
        break;
      }
      case 'button': {
        const label = L(b.label, lang) || b.url || '';
        if (!label || !b.url) break;
        out.appendChild(el('div.pv-button-wrap', el('span.pv-button', icon('open', 18), el('span', label))));
        count++;
        break;
      }
      default:
        break;
    }
  }
  return count ? out : null;
}

function statusBar() {
  return el('div.pv-status', el('span', '9:41'), el('span.pv-status-icons', '▲ ◆ ▮'));
}

function header(title, { back = true, share = false } = {}) {
  return el('div.pv-header', back ? el('span.pv-hbtn', icon('left', 24)) : el('span.pv-hbtn'), el('span.pv-htitle', title), share ? el('span.pv-hbtn', icon('share', 22)) : el('span.pv-hbtn'));
}

function tabBar(active, lang) {
  const tabs = [
    ['home', 'home'],
    ['products', 'products'],
    ['news', 'news'],
    ['about', 'info'],
    ['contact', 'phone'],
  ];
  return el(
    'div.pv-tabbar',
    tabs.map(([key, ic]) => el('div.pv-tab' + (key === active ? '.is-active' : ''), icon(ic, 22), el('span', tl(lang, 'preview.tabs.' + key)))),
  );
}

function coverImg(ref, ratio = '16 / 9') {
  if (!ref) return null;
  return el('img.pv-cover', { src: ref.url || ref.thumb, alt: '', style: { aspectRatio: ratio } });
}

export function renderNewsPreview(news, lang) {
  const title = L(news.title, lang);
  const summary = L(news.summary, lang);
  const date = formatDate(news.publishedAt, lang, false);
  const category = tl(lang, 'news.categories.' + (news.category || 'news'));
  const body = el('div.pv-body');
  const cover = coverImg(news.cover);
  if (cover) body.appendChild(cover);
  body.appendChild(
    el(
      'div.pv-head',
      el('div.pv-meta', pill(category), news.featured ? pill(tl(lang, 'preview.featured'), '#B45309') : null, date ? el('span.pv-date', date) : null),
      el('h1.pv-h1' + (title ? '' : '.pv-placeholder'), title || tl(lang, 'preview.noTitle')),
      summary ? el('p.pv-lead', summary) : null,
    ),
  );
  const blocks = renderBlocks(news.blocks, lang);
  body.appendChild(el('div.pv-content', blocks || el('p.pv-empty', tl(lang, 'preview.emptyBlocks'))));
  return el('div.pv-screen', statusBar(), header(tl(lang, 'preview.newsHeader'), { share: true }), body, tabBar('news', lang));
}

export function renderProductPreview(product, lang, areas) {
  const areaColor = AREA_COLORS[product.area] || '#0E7C86';
  const areaDef = (areas || []).find((a) => a.key === product.area);
  const areaName = (areaDef && L(areaDef.name, lang)) || tl(lang, 'products.areas.' + product.area) || product.area;
  const tagline = L(product.tagline, lang);
  const summary = L(product.summary, lang);
  const features = (product.features || []).map((f) => L(f, lang)).filter(Boolean);
  const specs = (product.specs || []).filter((s) => L(s.label, lang) || L(s.value, lang));
  const gallery = (product.gallery || []).filter(Boolean);
  const documents = (product.documents || []).filter((d) => (d.url || '').trim());

  const body = el('div.pv-body');
  const cover = coverImg(product.cover);
  if (cover) body.appendChild(cover);
  const inner = el('div.pv-head.pv-product');
  inner.appendChild(el('div.pv-meta', pill(areaName, areaColor)));
  inner.appendChild(el('h1.pv-h1' + (product.name ? '' : '.pv-placeholder'), product.name || tl(lang, 'preview.noTitle')));
  if (tagline) inner.appendChild(el('p.pv-tagline', tagline));
  if (summary) inner.appendChild(el('p.pv-p', summary));

  const section = (title, ...children) => el('section.pv-section', el('h2.pv-h2', title), ...children);
  if (features.length) {
    inner.appendChild(section(tl(lang, 'products.previewFeatures'), el('div.pv-features', features.map((f) => el('div.pv-feature', icon('checkCircle', 22), el('span', f))))));
  }
  if (specs.length) {
    inner.appendChild(section(tl(lang, 'products.previewSpecs'), el('div.pv-table', specs.map((s, i) => el('div.pv-row' + (i % 2 ? '.alt' : ''), el('span.pv-td-label', L(s.label, lang)), el('span.pv-td-value', L(s.value, lang)))))));
  }
  const blocks = renderBlocks(product.blocks, lang);
  if (blocks) inner.appendChild(section(tl(lang, 'products.previewDescription'), blocks));
  if (gallery.length) {
    inner.appendChild(section(tl(lang, 'products.previewGallery'), el('div.pv-gallery', gallery.map((g) => el('img.pv-gallery-img', { src: g.thumb || g.url, alt: '' })))));
  }
  if (documents.length) {
    inner.appendChild(section(tl(lang, 'products.previewDocuments'), el('div.pv-docs', documents.map((d) => el('span.pv-button.pv-outline', icon('doc', 18), el('span', L(d.title, lang) || d.url), icon('open', 16))))));
  }
  inner.appendChild(el('div.pv-section', el('span.pv-button.pv-block', icon('mail', 18), el('span', tl(lang, 'products.previewContact')))));
  body.appendChild(inner);
  return el('div.pv-screen', statusBar(), header(product.name || tl(lang, 'preview.productsHeader')), body, tabBar('products', lang));
}

/**
 * createPhonePreview({ render(lang) → element }) → { root, update() }
 * The TR/EN toggle re-renders with the chosen language; scroll position is
 * preserved across updates.
 */
export function createPhonePreview({ render, initialLang = 'tr' }) {
  let lang = initialLang;
  const screenHost = el('div.phone-screen');
  const phone = el('div.phone', el('div.phone-notch'), screenHost);
  const langBtns = {};
  const seg = el('div.seg.seg-sm');
  for (const l of ['tr', 'en']) {
    const b = el('button.seg-btn' + (l === lang ? '.is-active' : ''), { type: 'button', dataset: { lang: l } }, l.toUpperCase());
    b.addEventListener('click', () => {
      lang = l;
      Object.entries(langBtns).forEach(([k, bb]) => bb.classList.toggle('is-active', k === l));
      update();
    });
    langBtns[l] = b;
    seg.appendChild(b);
  }
  const root = el('div.preview-col', el('div.preview-head', el('div', el('h3.section-title', t('preview.title')), el('p.muted.small', t('preview.hint'))), seg), el('div.phone-wrap', phone));
  let raf = 0;
  const update = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const old = screenHost.querySelector('.pv-body');
      const scrollTop = old ? old.scrollTop : 0;
      clear(screenHost);
      const screen = render(lang);
      screenHost.appendChild(screen);
      const body = screen.querySelector('.pv-body');
      if (body) body.scrollTop = scrollTop;
    });
  };
  update();
  return { root, update, getLang: () => lang };
}
