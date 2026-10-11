// Phibio admin panel – entry point: shell, hash router, and the pages
// (login, dashboard, news, products, site settings, media, account).

import * as api from './api.js';
import { getLang, setLang, onLangChange, t, L, formatDate } from './i18n.js';
import {
  el, clear, button, icon, toast, confirmDialog, field, input, textarea, select, localizedField,
  statusBadge, badge, spinner, emptyState, slugify, isValidLink, toLocalInput, fromLocalInput, withBusy,
  imageRef, refId, fitTextareas, debounce,
} from './ui.js';
import { createBlockEditor, fromApiBlock, toApiBlock, validateBlocks } from './blocks.js';
import { createPhonePreview, renderNewsPreview, renderProductPreview } from './preview.js';
import { coverPicker, galleryEditor, renderMediaPage } from './media.js';

const CATEGORIES = ['news', 'event', 'press', 'product'];
const AREAS = ['orthopaedics', 'ophthalmology', 'dermatology'];
const SOCIAL_KINDS = ['linkedin', 'instagram', 'facebook', 'x', 'youtube'];

// ---- app state ------------------------------------------------------------

const app = {
  user: null,
  root: document.getElementById('app'),
  main: null,
  cleanup: null,
  guard: null, // { isDirty() } set by editors
  lastHash: '#/dashboard',
  intended: null,
  editorCache: null, // { hash, state } reused when the UI language changes or after a session expiry
  preserveEditor: false, // set by the 401 handler so the login redirect does not drop editorCache
  siteAreas: [],
};

// ---- navigation -----------------------------------------------------------

export function navigate(hash, { bypassGuard = false } = {}) {
  if (bypassGuard) app.guard = null;
  if (location.hash === hash) renderRoute();
  else location.hash = hash;
}

let suppressHashChange = false;

window.addEventListener('hashchange', () => {
  if (suppressHashChange) {
    suppressHashChange = false;
    return;
  }
  const target = location.hash;
  if (app.guard && app.guard.isDirty()) {
    suppressHashChange = true;
    location.hash = app.lastHash;
    confirmDialog({ title: t('common.unsavedTitle'), message: t('common.unsavedMessage'), okLabel: t('common.leave'), cancelLabel: t('common.stay'), danger: true }).then((ok) => {
      if (ok) {
        app.guard = null;
        app.editorCache = null;
        location.hash = target;
      }
    });
    return;
  }
  renderRoute();
});

window.addEventListener('beforeunload', (e) => {
  if (app.guard && app.guard.isDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

api.onUnauthorized(() => {
  if (!app.user) return;
  app.user = null;
  app.guard = null;
  app.intended = location.hash && location.hash !== '#/login' ? location.hash : null;
  // Keep the open editor's state so nothing is lost: after signing in again the
  // intended hash is restored and the editor reuses app.editorCache.
  app.preserveEditor = Boolean(app.editorCache);
  toast(t('common.sessionExpired'), 'error');
  renderShell();
  navigate('#/login');
});

onLangChange(() => {
  document.title = t('app.name');
  renderShell();
  renderRoute({ keepState: true });
});

// Avoid the browser opening dropped files that miss a drop zone.
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

// ---- shell ----------------------------------------------------------------

const NAV = [
  ['dashboard', '#/dashboard', 'dashboard'],
  ['news', '#/news', 'news'],
  ['products', '#/products', 'products'],
  ['site', '#/site', 'site'],
  ['media', '#/media', 'media'],
  ['account', '#/account', 'account'],
];

function langToggle() {
  const seg = el('div.seg.seg-sm.lang-toggle', { title: t('app.language') });
  for (const l of ['tr', 'en']) {
    seg.appendChild(el('button.seg-btn' + (getLang() === l ? '.is-active' : ''), { type: 'button', dataset: { lang: l }, onClick: () => setLang(l) }, l.toUpperCase()));
  }
  return seg;
}

function renderShell() {
  clear(app.root);
  if (!app.user) {
    app.main = el('main.login-main');
    app.root.appendChild(app.main);
    return;
  }
  const top = el(
    'header.topbar',
    el('a.brand', { href: '#/dashboard' }, el('img.brand-logo', { src: 'static/logo.png', alt: '' }), el('span.brand-name', t('app.name'))),
    el('div.topbar-right', langToggle(), el('span.topbar-user', icon('account', 16), app.user.username), button({ label: t('app.logout'), icon: 'logout', variant: 'topbar', small: true, onClick: logout })),
  );
  const nav = el('nav.sidebar');
  for (const [key, href, ic] of NAV) {
    nav.appendChild(el('a.nav-item', { href, dataset: { nav: key } }, icon(ic, 19), el('span', t('nav.' + key))));
  }
  nav.appendChild(el('div.sidebar-foot', el('a.nav-link', { href: '/api/v1/bundle', target: '_blank', rel: 'noopener' }, icon('external', 15), el('span', t('app.openPublicApi')))));
  app.main = el('main.main');
  app.root.append(top, el('div.layout', nav, app.main));
}

function markNav(key) {
  app.root.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === key));
}

async function logout() {
  if (app.guard && app.guard.isDirty()) {
    const ok = await confirmDialog({ title: t('common.unsavedTitle'), message: t('common.unsavedMessage'), okLabel: t('common.leave'), cancelLabel: t('common.stay'), danger: true });
    if (!ok) return;
  }
  app.guard = null;
  app.editorCache = null;
  try {
    await api.post('/api/admin/logout');
  } catch {
    /* ignore */
  }
  app.user = null;
  renderShell();
  navigate('#/login');
}

// ---- router ---------------------------------------------------------------

const ROUTES = [
  [/^#\/login$/, 'login'],
  [/^#\/dashboard$/, 'dashboard'],
  [/^#\/news$/, 'news'],
  [/^#\/news\/new$/, 'newsEditor'],
  [/^#\/news\/([0-9a-f]+)$/, 'newsEditor'],
  [/^#\/products$/, 'products'],
  [/^#\/products\/new$/, 'productEditor'],
  [/^#\/products\/([0-9a-f]+)$/, 'productEditor'],
  [/^#\/site$/, 'site'],
  [/^#\/media$/, 'media'],
  [/^#\/account$/, 'account'],
];

function renderRoute({ keepState = false } = {}) {
  let hash = location.hash || '#/dashboard';
  if (hash === '#' || hash === '#/') hash = '#/dashboard';
  let page = null;
  let param = null;
  for (const [re, name] of ROUTES) {
    const m = re.exec(hash);
    if (m) {
      page = name;
      param = m[1] || null;
      break;
    }
  }
  if (!app.user && page !== 'login') {
    app.intended = hash;
    navigate('#/login');
    return;
  }
  if (app.user && page === 'login') {
    navigate(app.intended || '#/dashboard');
    app.intended = null;
    return;
  }
  if (app.cleanup) {
    try {
      app.cleanup();
    } catch {
      /* ignore */
    }
    app.cleanup = null;
  }
  if (!keepState) {
    app.guard = null;
    if (app.preserveEditor && hash === '#/login') {
      app.preserveEditor = false;
    } else if (app.editorCache && app.editorCache.hash !== hash) {
      app.editorCache = null;
    }
  }
  app.lastHash = hash;
  window.scrollTo(0, 0);
  const main = app.main;
  clear(main);
  switch (page) {
    case 'login':
      renderLogin(main);
      break;
    case 'dashboard':
      markNav('dashboard');
      renderDashboard(main);
      break;
    case 'news':
      markNav('news');
      renderNewsList(main);
      break;
    case 'newsEditor':
      markNav('news');
      renderNewsEditor(main, param);
      break;
    case 'products':
      markNav('products');
      renderProductList(main);
      break;
    case 'productEditor':
      markNav('products');
      renderProductEditor(main, param);
      break;
    case 'site':
      markNav('site');
      renderSite(main);
      break;
    case 'media':
      markNav('media');
      app.cleanup = renderMediaPage(main);
      break;
    case 'account':
      markNav('account');
      renderAccount(main);
      break;
    default:
      markNav('');
      main.appendChild(el('div.page', emptyState(t('app.notFound'), el('a.btn.btn-primary', { href: '#/dashboard' }, t('app.backHome')))));
  }
}

// ---- login ----------------------------------------------------------------

function renderLogin(main) {
  document.body.classList.add('is-login');
  const user = input({ placeholder: t('login.username'), autocomplete: 'username', id: 'login-user', autofocus: true });
  const pass = input({ type: 'password', placeholder: t('login.password'), autocomplete: 'current-password', id: 'login-pass' });
  const error = el('p.form-error', { id: 'login-error' });
  error.style.display = 'none';
  const submit = button({ label: t('login.submit'), icon: 'lock', variant: 'primary', type: 'submit', id: 'login-submit', className: 'btn-block' });
  const form = el(
    'form.login-form',
    { onSubmit: onSubmit },
    field({ label: t('login.username'), control: user }),
    field({ label: t('login.password'), control: pass }),
    error,
    submit,
  );
  async function onSubmit(e) {
    e.preventDefault();
    error.style.display = 'none';
    const username = user.value.trim();
    const password = pass.value;
    if (!username || !password) {
      error.textContent = t('login.required');
      error.style.display = '';
      return;
    }
    await withBusy(submit, t('login.submitting'), async () => {
      try {
        const res = await api.post('/api/admin/login', { username, password }, { noRedirect: true });
        app.user = { username: res.username };
        document.body.classList.remove('is-login');
        renderShell();
        navigate(app.intended || '#/dashboard');
        app.intended = null;
      } catch (err) {
        error.textContent = err instanceof api.ApiError && err.status === 401 ? t('login.failed') : api.errorMessage(err);
        error.style.display = '';
        pass.focus();
        pass.select();
      }
    });
  }
  main.appendChild(
    el(
      'div.login-card',
      el('div.login-brand', el('img', { src: 'static/logo.png', alt: 'Phibio' }), el('div', el('h1', t('login.title')), el('p.muted', t('login.subtitle')))),
      form,
      el('div.login-foot', langToggle()),
    ),
  );
  setTimeout(() => user.focus(), 30);
}

// ---- dashboard ------------------------------------------------------------

function renderDashboard(main) {
  const page = el('div.page.page-dashboard');
  page.appendChild(el('div.page-head', el('div', el('h1', t('dashboard.title')), el('p.muted', t('dashboard.welcome', { name: app.user.username })))));
  const content = el('div', spinner());
  page.appendChild(content);
  main.appendChild(page);

  api
    .get('/api/admin/stats')
    .then((stats) => {
      clear(content);
      const statCard = (label, value, ic, href) => el('a.stat-card', { href }, icon(ic, 22, 'stat-icon'), el('div', el('div.stat-value', String(value)), el('div.stat-label', label)));
      content.appendChild(
        el(
          'div.stat-grid',
          statCard(t('dashboard.newsCount'), stats.news, 'news', '#/news'),
          statCard(t('dashboard.publishedCount'), stats.published, 'checkCircle', '#/news'),
          statCard(t('dashboard.productsCount'), stats.products, 'products', '#/products'),
          statCard(t('dashboard.mediaCount'), stats.media, 'media', '#/media'),
        ),
      );
      const cta = el(
        'div.cta-card',
        el('div', el('h2', t('dashboard.newArticle')), el('p', t('dashboard.newArticleHint'))),
        el('a.btn.btn-primary.btn-lg', { href: '#/news/new', id: 'dash-new-article' }, icon('plus', 20), el('span', t('dashboard.newArticle'))),
      );
      const latest = el('div.card.card-table');
      latest.appendChild(el('div.card-head', el('h2.card-title', t('dashboard.latest')), el('a.link', { href: '#/news' }, t('dashboard.allNews'), icon('right', 14))));
      const list = stats.latestNews || [];
      if (!list.length) {
        latest.appendChild(emptyState(t('dashboard.noNews')));
      } else {
        const table = el('table.table.table-click', el('thead', el('tr', el('th'), el('th', t('news.colTitle')), el('th', t('news.colStatus')), el('th', t('news.colCategory')), el('th', t('news.colUpdated')))));
        const tbody = el('tbody');
        for (const n of list) {
          const row = el(
            'tr',
            { dataset: { id: n.id }, onClick: () => navigate('#/news/' + n.id) },
            el('td.td-thumb', n.cover ? el('img.thumb', { src: n.cover.thumb, alt: '' }) : el('span.thumb.thumb-empty', icon('image', 16))),
            el('td', el('div.td-title', L(n.title) || t('common.untitled')), el('div.muted.small', n.slug)),
            el('td', statusBadge(n.status)),
            el('td', t('news.categories.' + n.category)),
            el('td.muted', formatDate(n.updatedAt)),
          );
          tbody.appendChild(row);
        }
        table.appendChild(tbody);
        latest.appendChild(table);
      }
      const links = el(
        'div.card',
        el('h2.card-title', t('dashboard.quickLinks')),
        el('div.quick-links',
          el('a.quick-link', { href: '/api/v1/bundle', target: '_blank', rel: 'noopener', id: 'dash-bundle' }, icon('external', 18), el('div', el('strong', t('dashboard.publicApi')), el('span.muted.small', t('dashboard.publicApiHint')))),
          el('a.quick-link', { href: '#/products' }, icon('products', 18), el('div', el('strong', t('nav.products')))),
          el('a.quick-link', { href: '#/site' }, icon('site', 18), el('div', el('strong', t('nav.site')))),
          el('a.quick-link', { href: '#/media' }, icon('media', 18), el('div', el('strong', t('nav.media')))),
        ),
        el('h2.card-title.mt', t('dashboard.tips')),
        el('ul.tips', el('li', t('dashboard.tip1')), el('li', t('dashboard.tip2')), el('li', t('dashboard.tip3'))),
      );
      content.appendChild(el('div.dash-grid', el('div.dash-main', cta, latest), el('div.dash-side', links)));
    })
    .catch((err) => {
      clear(content);
      content.appendChild(emptyState(api.errorMessage(err), button({ label: t('common.retry'), icon: 'refresh', onClick: () => renderDashboard(clear(main)) })));
    });
}

// ---- generic list page ----------------------------------------------------

function listPage({ title, newLabel, newHref, searchPlaceholder, load, columns, rowOf, countKey, filter, idPrefix }) {
  const page = el('div.page');
  const search = input({ placeholder: searchPlaceholder, class: 'search-input', id: idPrefix + '-search' });
  const countEl = el('span.muted', '');
  page.appendChild(el('div.page-head', el('div', el('h1', title)), el('div.page-actions', el('a.btn.btn-primary', { href: newHref, id: idPrefix + '-new' }, icon('plus', 17), el('span', newLabel)))));
  page.appendChild(el('div.toolbar', el('div.toolbar-left', icon('search', 16), search), el('div.toolbar-right', countEl)));
  const host = el('div.card.card-table', spinner());
  page.appendChild(host);
  let items = [];
  const render = () => {
    clear(host);
    const q = search.value.trim().toLowerCase();
    const shown = q ? items.filter((it) => filter(it, q)) : items;
    countEl.textContent = t(countKey, { n: items.length });
    if (!items.length) {
      host.appendChild(emptyState(t('common.empty'), el('a.btn.btn-primary', { href: newHref }, icon('plus', 16), el('span', newLabel))));
      return;
    }
    if (!shown.length) {
      host.appendChild(emptyState(t('common.noResults')));
      return;
    }
    const table = el('table.table.table-click', el('thead', el('tr', columns.map((c) => el('th', c)))));
    const tbody = el('tbody');
    shown.forEach((it) => tbody.appendChild(rowOf(it)));
    table.appendChild(tbody);
    host.appendChild(table);
  };
  search.addEventListener('input', debounce(render, 80));
  load()
    .then((list) => {
      items = list || [];
      render();
    })
    .catch((err) => {
      clear(host);
      host.appendChild(emptyState(api.errorMessage(err), button({ label: t('common.retry'), icon: 'refresh', onClick: () => renderRoute() })));
    });
  return page;
}

function thumbCell(ref) {
  return el('td.td-thumb', ref ? el('img.thumb', { src: ref.thumb || ref.url, alt: '' }) : el('span.thumb.thumb-empty', icon('image', 16)));
}

function renderNewsList(main) {
  main.appendChild(
    listPage({
      title: t('news.title'),
      newLabel: t('news.new'),
      newHref: '#/news/new',
      searchPlaceholder: t('news.searchPlaceholder'),
      load: () => api.get('/api/admin/news?status=all'),
      columns: ['', t('news.colTitle'), t('news.colStatus'), t('news.colCategory'), t('news.colPublished'), t('news.colUpdated')],
      countKey: 'news.count',
      idPrefix: 'news',
      filter: (n, q) => [n.title?.tr, n.title?.en, n.slug, ...(n.tags || [])].some((s) => (s || '').toLowerCase().includes(q)),
      rowOf: (n) =>
        el(
          'tr',
          { dataset: { id: n.id }, onClick: () => navigate('#/news/' + n.id) },
          thumbCell(n.cover),
          el('td', el('div.td-title', L(n.title) || t('common.untitled')), el('div.muted.small', n.slug)),
          el('td', statusBadge(n.status), n.featured ? badge(t('preview.featured'), 'accent') : null),
          el('td', t('news.categories.' + n.category)),
          el('td.muted', formatDate(n.publishedAt) || '–'),
          el('td.muted', formatDate(n.updatedAt)),
        ),
    }),
  );
}

function renderProductList(main) {
  main.appendChild(
    listPage({
      title: t('products.title'),
      newLabel: t('products.new'),
      newHref: '#/products/new',
      searchPlaceholder: t('products.searchPlaceholder'),
      load: () => api.get('/api/admin/products'),
      columns: ['', t('products.colName'), t('products.colArea'), t('products.colOrder'), t('products.colStatus'), t('products.colUpdated')],
      countKey: 'products.count',
      idPrefix: 'products',
      filter: (p, q) => [p.name, p.slug, p.tagline?.tr, p.tagline?.en].some((s) => (s || '').toLowerCase().includes(q)),
      rowOf: (p) =>
        el(
          'tr',
          { dataset: { id: p.id }, onClick: () => navigate('#/products/' + p.id) },
          thumbCell(p.cover),
          el('td', el('div.td-title', p.name || t('common.untitled')), el('div.muted.small', p.slug)),
          el('td', badge(t('products.areas.' + p.area), 'area-' + p.area)),
          el('td', String(p.order ?? 0)),
          el('td', statusBadge(p.status)),
          el('td.muted', formatDate(p.updatedAt)),
        ),
    }),
  );
}

// ---- editor scaffolding ---------------------------------------------------

/**
 * Common editor frame: sticky action bar, dirty tracking, Ctrl+S, guard.
 * Returns helpers; the caller builds the body.
 */
function editorFrame({ main, title, backHref, backLabel, state, serialize, onSave, onDelete, deleteLabel, statusControl, isNew }) {
  const cached = app.editorCache && app.editorCache.hash === location.hash ? app.editorCache : null;
  let snapshot = (cached && cached.snapshot) || JSON.stringify(serialize());
  if (cached) cached.snapshot = snapshot;
  const dirtyEl = el('span.dirty-indicator', t('common.clean'));
  const isDirty = () => JSON.stringify(serialize()) !== snapshot;
  const refreshDirty = () => {
    const d = isDirty();
    dirtyEl.textContent = d ? t('common.dirty') : t('common.clean');
    dirtyEl.classList.toggle('is-dirty', d);
  };
  const markSaved = () => {
    snapshot = JSON.stringify(serialize());
    if (app.editorCache) app.editorCache.snapshot = snapshot;
    refreshDirty();
  };
  app.guard = { isDirty };

  const saveBtn = button({ label: t('common.save'), icon: 'save', variant: 'primary', id: 'editor-save', title: t('common.shortcutSave') });
  const doSave = () =>
    withBusy(saveBtn, t('common.saving'), async () => {
      try {
        await onSave();
      } catch (err) {
        toast(api.errorMessage(err), 'error');
      }
    });
  saveBtn.addEventListener('click', doSave);
  const bar = el(
    'div.action-bar',
    el('div.action-left', el('a.back-link', { href: backHref }, icon('left', 18), el('span', backLabel)), el('h1.action-title', title)),
    el('div.action-right', dirtyEl, statusControl || null, onDelete && !isNew ? button({ label: deleteLabel || t('common.delete'), icon: 'trash', variant: 'danger', id: 'editor-delete', onClick: onDelete }) : null, saveBtn),
  );
  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (!saveBtn.disabled) doSave();
    }
  };
  document.addEventListener('keydown', onKey);
  app.cleanup = () => document.removeEventListener('keydown', onKey);
  const page = el('div.page.page-editor', bar);
  main.appendChild(page);
  return { page, refreshDirty, markSaved, isDirty, saveBtn, doSave };
}

function statusSelect(state, onChange) {
  const s = select(
    [
      { value: 'draft', label: t('common.draft') },
      { value: 'published', label: t('common.published') },
    ],
    { value: state.status, id: 'editor-status', class: 'status-select status-' + state.status },
  );
  s.addEventListener('change', () => {
    state.status = s.value;
    s.className = 'input select status-select status-' + state.status;
    onChange();
  });
  return s;
}

function slugField(state, { titleSource, onChange, idPrefix }) {
  const slugIn = input({ value: state.slug, class: 'mono', id: idPrefix + '-slug', spellcheck: false, placeholder: getLang() === 'tr' ? 'adres-adi' : 'url-name' });
  slugIn.addEventListener('input', () => {
    state.slug = slugIn.value;
    state.slugTouched = true;
    onChange();
  });
  slugIn.addEventListener('blur', () => {
    const clean = slugify(slugIn.value);
    if (clean !== slugIn.value) {
      slugIn.value = clean;
      state.slug = clean;
      onChange();
    }
  });
  const regen = button({ label: t('common.regenerate'), icon: 'refresh', small: true, title: t('common.regenerateTitle'), id: idPrefix + '-slug-regen' });
  regen.addEventListener('click', () => {
    state.slug = slugify(titleSource());
    state.slugTouched = false;
    slugIn.value = state.slug;
    onChange();
  });
  const wrap = el('div.slug-row', slugIn, regen);
  wrap.sync = () => {
    if (!state.slugTouched) {
      state.slug = slugify(titleSource());
      slugIn.value = state.slug;
    }
  };
  wrap.setValue = (v) => {
    slugIn.value = v;
  };
  return wrap;
}

function publishedAtField(state, onChange) {
  const inp = input({ type: 'datetime-local', value: toLocalInput(state.publishedAt), id: 'news-publishedAt' });
  inp.addEventListener('change', () => {
    state.publishedAt = fromLocalInput(inp.value);
    onChange();
  });
  const nowBtn = button({ label: t('common.now'), small: true, icon: 'calendar', onClick: () => { state.publishedAt = fromLocalInput(toLocalInput(new Date().toISOString())); inp.value = toLocalInput(state.publishedAt); onChange(); } });
  const clearBtn = button({ label: t('common.clear'), small: true, variant: 'ghost', onClick: () => { state.publishedAt = ''; inp.value = ''; onChange(); } });
  const wrap = el('div.slug-row', inp, nowBtn, clearBtn);
  wrap.setValue = (v) => {
    inp.value = toLocalInput(v);
  };
  return wrap;
}

async function ensureSiteAreas() {
  if (app.siteAreas.length) return app.siteAreas;
  try {
    const site = await api.get('/api/admin/site');
    app.siteAreas = site.areas || [];
  } catch {
    app.siteAreas = [];
  }
  return app.siteAreas;
}

// ---- news editor ----------------------------------------------------------

function newsFromApi(n) {
  return {
    id: n.id || '',
    slug: n.slug || '',
    title: { tr: n.title?.tr || '', en: n.title?.en || '' },
    summary: { tr: n.summary?.tr || '', en: n.summary?.en || '' },
    cover: imageRef(n.cover),
    blocks: (n.blocks || []).map(fromApiBlock),
    category: CATEGORIES.includes(n.category) ? n.category : 'news',
    tags: (n.tags || []).join(', '),
    featured: !!n.featured,
    status: n.status === 'published' ? 'published' : 'draft',
    publishedAt: n.publishedAt || '',
    createdAt: n.createdAt || '',
    updatedAt: n.updatedAt || '',
    slugTouched: !!n.id,
  };
}

function newsToApi(s) {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    summary: s.summary,
    cover: refId(s.cover),
    blocks: s.blocks.map(toApiBlock),
    category: s.category,
    tags: s.tags.split(',').map((x) => x.trim()).filter(Boolean),
    featured: s.featured,
    status: s.status,
    publishedAt: s.publishedAt || '',
  };
}

async function renderNewsEditor(main, id) {
  const isNew = !id;
  const hash = location.hash;
  main.appendChild(spinner());
  let state;
  if (app.editorCache && app.editorCache.hash === hash) {
    state = app.editorCache.state;
  } else {
    try {
      const data = isNew ? { category: 'news', status: 'draft' } : await api.get('/api/admin/news/' + id);
      state = newsFromApi(data);
    } catch (err) {
      clear(main);
      main.appendChild(el('div.page', emptyState(err instanceof api.ApiError && err.status === 404 ? t('news.notFound') : api.errorMessage(err), el('a.btn.btn-secondary', { href: '#/news' }, t('news.title')))));
      return;
    }
    app.editorCache = { hash, state };
  }
  if (location.hash !== hash) return;
  clear(main);

  const preview = createPhonePreview({ render: (lang) => renderNewsPreview(state, lang), initialLang: getLang() });
  const touch = () => {
    preview.update();
    frame.refreshDirty();
  };

  const frame = editorFrame({
    main,
    title: isNew ? t('news.createTitle') : t('news.editTitle'),
    backHref: '#/news',
    backLabel: t('news.title'),
    state,
    isNew,
    serialize: () => newsToApi(state),
    statusControl: statusSelect(state, touch),
    onSave: async () => {
      if (!state.title.tr.trim() && !state.title.en.trim()) {
        toast(t('news.titleRequired'), 'error');
        return;
      }
      const blockErr = validateBlocks(state.blocks, t('news.content'));
      if (blockErr) {
        toast(blockErr, 'error');
        return;
      }
      const payload = newsToApi(state);
      const res = isNew ? await api.post('/api/admin/news', payload) : await api.put('/api/admin/news/' + state.id, payload);
      const fresh = newsFromApi(res);
      Object.assign(state, { id: fresh.id, slug: fresh.slug, publishedAt: fresh.publishedAt, createdAt: fresh.createdAt, updatedAt: fresh.updatedAt, slugTouched: true });
      slug.setValue(state.slug);
      published.setValue(state.publishedAt);
      frame.markSaved();
      preview.update();
      toast(isNew ? t('news.created') : t('news.saved'), 'success');
      if (isNew) {
        app.editorCache = { hash: '#/news/' + state.id, state };
        navigate('#/news/' + state.id, { bypassGuard: true });
      }
    },
    onDelete: async () => {
      const ok = await confirmDialog({ title: t('news.deleteTitle'), message: t('news.deleteMessage', { title: L(state.title) || t('common.untitled') }), okLabel: t('common.delete'), danger: true });
      if (!ok) return;
      try {
        await api.del('/api/admin/news/' + state.id);
        toast(t('news.deleted'), 'success');
        app.editorCache = null;
        navigate('#/news', { bypassGuard: true });
      } catch (err) {
        toast(api.errorMessage(err), 'error');
      }
    },
  });

  // --- form ---
  const slug = slugField(state, { titleSource: () => state.title.en || state.title.tr, onChange: touch, idPrefix: 'news' });
  const titleField = localizedField({
    label: t('news.fieldTitle'),
    required: true,
    value: state.title,
    placeholder: t('news.titlePlaceholder'),
    onInput: (v) => {
      state.title = v;
      slug.sync();
      touch();
    },
  });
  const summaryField = localizedField({ label: t('news.fieldSummary'), hint: t('news.fieldSummaryHint'), value: state.summary, multiline: true, placeholder: t('news.summaryPlaceholder'), onInput: (v) => { state.summary = v; touch(); } });

  const cover = coverPicker({
    value: state.cover,
    onChange: (ref) => {
      state.cover = ref;
      touch();
    },
    composer: { title: () => state.title, subtitle: () => state.summary, slug: () => state.slug || slugify(state.title.en || state.title.tr) },
  });

  const blocksEditor = createBlockEditor({ blocks: state.blocks, onChange: touch, title: t('blocks.title') });

  const categorySel = select(CATEGORIES.map((c) => ({ value: c, label: t('news.categories.' + c) })), { value: state.category, id: 'news-category' });
  categorySel.addEventListener('change', () => { state.category = categorySel.value; touch(); });
  const featuredCb = el('input', { type: 'checkbox', checked: state.featured, id: 'news-featured' });
  featuredCb.addEventListener('change', () => { state.featured = featuredCb.checked; touch(); });
  const published = publishedAtField(state, touch);
  const tagsIn = input({ value: state.tags, placeholder: t('news.fieldTagsHint'), id: 'news-tags' });
  tagsIn.addEventListener('input', () => { state.tags = tagsIn.value; touch(); });

  const form = el(
    'div.editor-main',
    el('section.card', titleField, summaryField, field({ label: t('news.fieldSlug'), hint: t('common.slugHint'), control: slug })),
    el('section.card', el('h3.section-title', t('news.fieldCover')), cover),
    el('section.card', blocksEditor),
    el(
      'section.card',
      el('h3.section-title', t('news.meta')),
      el('div.row-2', field({ label: t('news.fieldCategory'), control: categorySel }), field({ label: t('news.fieldPublishedAt'), hint: t('news.fieldPublishedAtHint'), control: published })),
      el('div.row-2', field({ label: t('news.fieldTags'), hint: t('news.fieldTagsHint'), control: tagsIn }), field({ label: t('news.fieldFeatured'), control: el('label.check', featuredCb, el('span', t('news.fieldFeaturedHint'))) })),
    ),
  );
  frame.page.appendChild(el('div.editor-layout', form, preview.root));
  fitTextareas(form);
  frame.refreshDirty();
}

// ---- product editor -------------------------------------------------------

function productFromApi(p) {
  return {
    id: p.id || '',
    slug: p.slug || '',
    name: p.name || '',
    area: AREAS.includes(p.area) ? p.area : 'orthopaedics',
    tagline: { tr: p.tagline?.tr || '', en: p.tagline?.en || '' },
    summary: { tr: p.summary?.tr || '', en: p.summary?.en || '' },
    blocks: (p.blocks || []).map(fromApiBlock),
    features: (p.features || []).map((f) => ({ tr: f?.tr || '', en: f?.en || '' })),
    specs: (p.specs || []).map((s) => ({ label: { tr: s.label?.tr || '', en: s.label?.en || '' }, value: { tr: s.value?.tr || '', en: s.value?.en || '' } })),
    cover: imageRef(p.cover),
    gallery: (p.gallery || []).map(imageRef).filter(Boolean),
    documents: (p.documents || []).map((d) => ({ title: { tr: d.title?.tr || '', en: d.title?.en || '' }, url: d.url || '' })),
    order: Number.isFinite(p.order) ? p.order : 0,
    status: p.status === 'published' ? 'published' : 'draft',
    createdAt: p.createdAt || '',
    updatedAt: p.updatedAt || '',
    slugTouched: !!p.id,
  };
}

function productToApi(s) {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    area: s.area,
    tagline: s.tagline,
    summary: s.summary,
    blocks: s.blocks.map(toApiBlock),
    features: s.features.filter((f) => f.tr.trim() || f.en.trim()),
    specs: s.specs.filter((sp) => sp.label.tr.trim() || sp.label.en.trim() || sp.value.tr.trim() || sp.value.en.trim()),
    cover: refId(s.cover),
    gallery: s.gallery.map(refId).filter(Boolean),
    documents: s.documents.filter((d) => d.url.trim() || d.title.tr.trim() || d.title.en.trim()).map((d) => ({ title: d.title, url: d.url.trim() })),
    order: Number(s.order) || 0,
    status: s.status,
  };
}

/** Generic row editor for small tables (specs, documents, stats, social). */
function rowsEditor({ rows, columns, makeRow, onChange, addLabel, idPrefix }) {
  const root = el('div.rows-editor', { id: idPrefix });
  const table = el('div.rows');
  const render = () => {
    clear(table);
    if (rows.length) table.appendChild(el('div.rows-head', columns.map((c) => el('span', c)), el('span')));
    rows.forEach((row, i) => {
      const cells = makeRow(row, i).map((c) => el('div.rows-cell', c));
      const line = el('div.rows-row', cells, el('div.rows-cell.rows-tools', button({ icon: 'trash', title: t('common.remove'), small: true, variant: 'ghost', className: 'danger-text', onClick: () => { rows.splice(i, 1); render(); onChange(); } })));
      table.appendChild(line);
    });
    fitTextareas(table);
  };
  const addBtn = button({ label: addLabel, icon: 'plus', small: true, onClick: () => { rows.push(makeRow.empty()); render(); onChange(); const last = table.querySelector('.rows-row:last-child input, .rows-row:last-child textarea'); if (last) last.focus(); } });
  root.append(table, el('div.add-row', addBtn));
  render();
  return root;
}

function textCell(obj, key, { placeholder = '', lang, onChange, type = 'text', mono = false } = {}) {
  const i = input({ value: obj[key] || '', placeholder, lang: lang || null, type, class: mono ? 'mono' : null });
  i.addEventListener('input', () => {
    obj[key] = i.value;
    onChange();
  });
  return i;
}

function urlCell(obj, key, { onChange, webOnly = true, placeholder = 'https://' }) {
  const i = input({ value: obj[key] || '', placeholder, class: 'mono', spellcheck: false });
  const check = () => i.classList.toggle('is-invalid', i.value.trim() !== '' && !isValidLink(i.value, webOnly));
  i.addEventListener('input', () => {
    obj[key] = i.value;
    check();
    onChange();
  });
  check();
  return i;
}

async function renderProductEditor(main, id) {
  const isNew = !id;
  const hash = location.hash;
  main.appendChild(spinner());
  let state;
  const areas = await ensureSiteAreas();
  if (app.editorCache && app.editorCache.hash === hash) {
    state = app.editorCache.state;
  } else {
    try {
      const data = isNew ? { area: 'orthopaedics', status: 'draft', order: 0 } : await api.get('/api/admin/products/' + id);
      state = productFromApi(data);
    } catch (err) {
      clear(main);
      main.appendChild(el('div.page', emptyState(err instanceof api.ApiError && err.status === 404 ? t('products.notFound') : api.errorMessage(err), el('a.btn.btn-secondary', { href: '#/products' }, t('products.title')))));
      return;
    }
    app.editorCache = { hash, state };
  }
  if (location.hash !== hash) return;
  clear(main);

  const preview = createPhonePreview({ render: (lang) => renderProductPreview(state, lang, areas), initialLang: getLang() });
  const touch = () => {
    preview.update();
    frame.refreshDirty();
  };

  const frame = editorFrame({
    main,
    title: isNew ? t('products.createTitle') : t('products.editTitle'),
    backHref: '#/products',
    backLabel: t('products.title'),
    state,
    isNew,
    serialize: () => productToApi(state),
    statusControl: statusSelect(state, touch),
    onSave: async () => {
      if (!state.name.trim()) {
        toast(t('products.nameRequired'), 'error');
        return;
      }
      const blockErr = validateBlocks(state.blocks, t('products.fieldBlocks'));
      if (blockErr) {
        toast(blockErr, 'error');
        return;
      }
      for (const d of state.documents) {
        if ((d.url.trim() || d.title.tr.trim() || d.title.en.trim()) && !isValidLink(d.url, true)) {
          toast(t('products.fieldDocuments') + ': ' + t('common.invalidWebUrl'), 'error');
          return;
        }
      }
      const payload = productToApi(state);
      const res = isNew ? await api.post('/api/admin/products', payload) : await api.put('/api/admin/products/' + state.id, payload);
      const fresh = productFromApi(res);
      Object.assign(state, { id: fresh.id, slug: fresh.slug, createdAt: fresh.createdAt, updatedAt: fresh.updatedAt, slugTouched: true });
      slug.setValue(state.slug);
      frame.markSaved();
      preview.update();
      toast(isNew ? t('products.created') : t('products.saved'), 'success');
      if (isNew) {
        app.editorCache = { hash: '#/products/' + state.id, state };
        navigate('#/products/' + state.id, { bypassGuard: true });
      }
    },
    onDelete: async () => {
      const ok = await confirmDialog({ title: t('products.deleteTitle'), message: t('products.deleteMessage', { name: state.name || t('common.untitled') }), okLabel: t('common.delete'), danger: true });
      if (!ok) return;
      try {
        await api.del('/api/admin/products/' + state.id);
        toast(t('products.deleted'), 'success');
        app.editorCache = null;
        navigate('#/products', { bypassGuard: true });
      } catch (err) {
        toast(api.errorMessage(err), 'error');
      }
    },
  });

  const slug = slugField(state, { titleSource: () => state.name, onChange: touch, idPrefix: 'product' });
  const nameIn = input({ value: state.name, placeholder: t('products.namePlaceholder'), id: 'product-name' });
  nameIn.addEventListener('input', () => {
    state.name = nameIn.value;
    slug.sync();
    touch();
  });
  const areaSel = select(AREAS.map((a) => ({ value: a, label: t('products.areas.' + a) })), { value: state.area, id: 'product-area' });
  areaSel.addEventListener('change', () => { state.area = areaSel.value; touch(); });
  const orderIn = input({ type: 'number', value: String(state.order), min: 0, step: 1, id: 'product-order' });
  orderIn.addEventListener('input', () => { state.order = Number(orderIn.value) || 0; touch(); });

  const taglineField = localizedField({ label: t('products.fieldTagline'), hint: t('products.fieldTaglineHint'), value: state.tagline, onInput: (v) => { state.tagline = v; touch(); } });
  const summaryField = localizedField({ label: t('products.fieldSummary'), hint: t('products.fieldSummaryHint'), value: state.summary, multiline: true, onInput: (v) => { state.summary = v; touch(); } });

  const featuresField = localizedField({
    label: t('products.fieldFeatures'),
    hint: t('products.fieldFeaturesHint'),
    value: { tr: state.features.map((f) => f.tr).join('\n'), en: state.features.map((f) => f.en).join('\n') },
    multiline: true,
    syncScroll: true,
    onInput: (v) => {
      const tr = v.tr.split('\n');
      const en = v.en.split('\n');
      const n = Math.max(tr.length, en.length);
      state.features = [];
      for (let i = 0; i < n; i++) state.features.push({ tr: tr[i] || '', en: en[i] || '' });
      touch();
    },
  });

  const specsEditor = rowsEditor({
    rows: state.specs,
    idPrefix: 'product-specs',
    columns: [t('products.specLabel') + ' (TR)', t('products.specLabel') + ' (EN)', t('products.specValue') + ' (TR)', t('products.specValue') + ' (EN)'],
    addLabel: t('products.addSpec'),
    onChange: touch,
    makeRow: Object.assign(
      (row) => [textCell(row.label, 'tr', { lang: 'tr', onChange: touch }), textCell(row.label, 'en', { lang: 'en', onChange: touch }), textCell(row.value, 'tr', { lang: 'tr', onChange: touch }), textCell(row.value, 'en', { lang: 'en', onChange: touch })],
      { empty: () => ({ label: { tr: '', en: '' }, value: { tr: '', en: '' } }) },
    ),
  });

  const cover = coverPicker({
    value: state.cover,
    onChange: (ref) => { state.cover = ref; touch(); },
    composer: { title: () => ({ tr: state.name, en: state.name }), subtitle: () => state.tagline, slug: () => state.slug || slugify(state.name) },
  });
  const gallery = galleryEditor({ items: state.gallery, onChange: touch });

  const docsEditor = rowsEditor({
    rows: state.documents,
    idPrefix: 'product-docs',
    columns: [t('products.docTitle') + ' (TR)', t('products.docTitle') + ' (EN)', t('products.docUrl')],
    addLabel: t('products.addDocument'),
    onChange: touch,
    makeRow: Object.assign(
      (row) => [textCell(row.title, 'tr', { lang: 'tr', onChange: touch }), textCell(row.title, 'en', { lang: 'en', onChange: touch }), urlCell(row, 'url', { onChange: touch })],
      { empty: () => ({ title: { tr: '', en: '' }, url: '' }) },
    ),
  });

  const blocksEditor = createBlockEditor({ blocks: state.blocks, onChange: touch, title: t('products.fieldBlocks') });

  const form = el(
    'div.editor-main',
    el(
      'section.card',
      el('div.row-3', field({ label: t('products.fieldName'), hint: t('products.fieldNameHint'), required: true, control: nameIn }), field({ label: t('products.fieldArea'), control: areaSel }), field({ label: t('products.fieldOrder'), hint: t('products.fieldOrderHint'), control: orderIn })),
      taglineField,
      summaryField,
      field({ label: t('products.fieldSlug'), hint: t('common.slugHint'), control: slug }),
    ),
    el('section.card', el('h3.section-title', t('products.fieldCover')), cover),
    el('section.card', featuresField),
    el('section.card', el('h3.section-title', t('products.fieldSpecs')), el('p.muted.small', t('products.fieldSpecsHint')), specsEditor),
    el('section.card', blocksEditor),
    el('section.card', el('h3.section-title', t('products.fieldGallery')), el('p.muted.small', t('products.fieldGalleryHint')), gallery),
    el('section.card', el('h3.section-title', t('products.fieldDocuments')), el('p.muted.small', t('products.fieldDocumentsHint')), docsEditor),
  );
  frame.page.appendChild(el('div.editor-layout', form, preview.root));
  fitTextareas(form);
  frame.refreshDirty();
}

// ---- site settings --------------------------------------------------------

function siteFromApi(s) {
  const ls = (x) => ({ tr: x?.tr || '', en: x?.en || '' });
  const areas = AREAS.map((key) => {
    const a = (s.areas || []).find((x) => x.key === key) || {};
    return { key, name: ls(a.name), description: ls(a.description), image: imageRef(a.image) };
  });
  return {
    companyName: s.companyName || '',
    slogan: ls(s.slogan),
    heroTitle: ls(s.heroTitle),
    heroSubtitle: ls(s.heroSubtitle),
    heroImage: imageRef(s.heroImage),
    aboutTitle: ls(s.aboutTitle),
    aboutBlocks: (s.aboutBlocks || []).map(fromApiBlock),
    stats: (s.stats || []).map((st) => ({ value: st.value || '', label: ls(st.label) })),
    areas,
    contact: {
      email: s.contact?.email || '',
      phone: s.contact?.phone || '',
      phoneDisplay: s.contact?.phoneDisplay || '',
      addressLines: (s.contact?.addressLines || []).join('\n'),
      mapUrl: s.contact?.mapUrl || '',
      hours: ls(s.contact?.hours),
      website: s.contact?.website || '',
    },
    social: (s.social || []).map((so) => ({ kind: SOCIAL_KINDS.includes(so.kind) ? so.kind : 'linkedin', url: so.url || '' })),
    imprint: (s.imprint || []).map(fromApiBlock),
    privacy: (s.privacy || []).map(fromApiBlock),
    updatedAt: s.updatedAt || '',
  };
}

function siteToApi(s) {
  return {
    companyName: s.companyName,
    slogan: s.slogan,
    heroTitle: s.heroTitle,
    heroSubtitle: s.heroSubtitle,
    heroImage: refId(s.heroImage),
    aboutTitle: s.aboutTitle,
    aboutBlocks: s.aboutBlocks.map(toApiBlock),
    stats: s.stats.filter((st) => st.value.trim() || st.label.tr.trim() || st.label.en.trim()).map((st) => ({ value: st.value.trim(), label: st.label })),
    areas: s.areas.map((a) => ({ key: a.key, name: a.name, description: a.description, image: refId(a.image) })),
    contact: {
      email: s.contact.email.trim(),
      phone: s.contact.phone.trim(),
      phoneDisplay: s.contact.phoneDisplay.trim(),
      addressLines: s.contact.addressLines.split('\n').map((x) => x.trim()).filter(Boolean),
      mapUrl: s.contact.mapUrl.trim(),
      hours: s.contact.hours,
      website: s.contact.website.trim(),
    },
    social: s.social.filter((so) => so.url.trim()).map((so) => ({ kind: so.kind, url: so.url.trim() })),
    imprint: s.imprint.map(toApiBlock),
    privacy: s.privacy.map(toApiBlock),
  };
}

async function renderSite(main) {
  const hash = location.hash;
  main.appendChild(spinner());
  let state;
  if (app.editorCache && app.editorCache.hash === hash) {
    state = app.editorCache.state;
  } else {
    try {
      state = siteFromApi(await api.get('/api/admin/site'));
    } catch (err) {
      clear(main);
      main.appendChild(el('div.page', emptyState(api.errorMessage(err), button({ label: t('common.retry'), icon: 'refresh', onClick: () => renderRoute() }))));
      return;
    }
    app.editorCache = { hash, state };
  }
  if (location.hash !== hash) return;
  clear(main);

  const frame = editorFrame({
    main,
    title: t('site.title'),
    backHref: '#/dashboard',
    backLabel: t('nav.dashboard'),
    state,
    isNew: true,
    serialize: () => siteToApi(state),
    onSave: async () => {
      const c = state.contact;
      if (c.phone.trim() && !/^\+[1-9][0-9]{5,14}$/.test(c.phone.trim())) {
        toast(t('site.phoneInvalid'), 'error');
        return;
      }
      if (c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) {
        toast(t('site.emailInvalid'), 'error');
        return;
      }
      for (const [blocks, name] of [[state.aboutBlocks, t('site.about')], [state.imprint, t('site.imprint')], [state.privacy, t('site.privacy')]]) {
        const err = validateBlocks(blocks, name);
        if (err) {
          toast(err, 'error');
          return;
        }
      }
      for (const so of state.social) {
        if (so.url.trim() && !isValidLink(so.url, true)) {
          toast(t('site.social') + ': ' + t('common.invalidWebUrl'), 'error');
          return;
        }
      }
      const res = await api.put('/api/admin/site', siteToApi(state));
      state.updatedAt = res.updatedAt || '';
      app.siteAreas = res.areas || [];
      frame.markSaved();
      toast(t('site.saved'), 'success');
    },
  });
  const touch = () => frame.refreshDirty();
  const ls = (label, key, obj, opts = {}) => localizedField({ label, value: obj[key], onInput: (v) => { obj[key] = v; touch(); }, ...opts });

  const companyIn = input({ value: state.companyName, id: 'site-company' });
  companyIn.addEventListener('input', () => { state.companyName = companyIn.value; touch(); });

  const heroCard = el(
    'section.card',
    el('h2.card-title', t('site.hero')),
    el('p.muted.small', t('site.heroHint')),
    field({ label: t('site.companyName'), control: companyIn }),
    ls(t('site.slogan'), 'slogan', state),
    ls(t('site.heroTitle'), 'heroTitle', state),
    ls(t('site.heroSubtitle'), 'heroSubtitle', state, { multiline: true }),
    coverPicker({ label: t('site.heroImage'), value: state.heroImage, onChange: (ref) => { state.heroImage = ref; touch(); }, composer: { title: () => state.heroTitle, subtitle: () => state.slogan, slug: () => 'hero' } }),
  );

  const aboutCard = el('section.card', el('h2.card-title', t('site.about')), ls(t('site.aboutTitle'), 'aboutTitle', state), createBlockEditor({ blocks: state.aboutBlocks, onChange: touch, title: t('site.aboutBlocks'), idPrefix: 'about-blocks' }));

  const statsCard = el(
    'section.card',
    el('h2.card-title', t('site.stats')),
    el('p.muted.small', t('site.statsHint')),
    rowsEditor({
      rows: state.stats,
      idPrefix: 'site-stats',
      columns: [t('site.statValue'), t('site.statLabel') + ' (TR)', t('site.statLabel') + ' (EN)'],
      addLabel: t('site.addStat'),
      onChange: touch,
      makeRow: Object.assign((row) => [textCell(row, 'value', { onChange: touch, placeholder: '14+' }), textCell(row.label, 'tr', { lang: 'tr', onChange: touch }), textCell(row.label, 'en', { lang: 'en', onChange: touch })], { empty: () => ({ value: '', label: { tr: '', en: '' } }) }),
    }),
  );

  const areasCard = el('section.card', el('h2.card-title', t('site.areas')), el('p.muted.small', t('site.areasHint')));
  for (const a of state.areas) {
    areasCard.appendChild(
      el(
        'div.area-row',
        el('div.area-head', badge(t('products.areas.' + a.key), 'area-' + a.key), el('code.muted.small', a.key)),
        el('div.area-grid', el('div', ls(t('site.areaName'), 'name', a), ls(t('site.areaDescription'), 'description', a, { multiline: true })), coverPicker({ label: t('site.areaImage'), value: a.image, compact: true, onChange: (ref) => { a.image = ref; touch(); }, composer: { title: () => a.name, subtitle: () => a.description, slug: () => 'area-' + a.key } })),
      ),
    );
  }

  const c = state.contact;
  const addr = textarea({ value: c.addressLines, rows: 3, id: 'site-address' });
  addr.addEventListener('input', () => { c.addressLines = addr.value; touch(); });
  const contactCard = el(
    'section.card',
    el('h2.card-title', t('site.contact')),
    el('div.row-2', field({ label: t('site.email'), control: textCell(c, 'email', { onChange: touch, type: 'email' }) }), field({ label: t('site.website'), control: urlCell(c, 'website', { onChange: touch }) })),
    el('div.row-2', field({ label: t('site.phone'), hint: t('site.phoneHint'), control: textCell(c, 'phone', { onChange: touch, mono: true, placeholder: '+49…' }) }), field({ label: t('site.phoneDisplay'), hint: t('site.phoneDisplayHint'), control: textCell(c, 'phoneDisplay', { onChange: touch }) })),
    el('div.row-2', field({ label: t('site.addressLines'), hint: t('site.addressLinesHint'), control: addr }), field({ label: t('site.mapUrl'), control: urlCell(c, 'mapUrl', { onChange: touch, placeholder: 'https://maps.google.com/?q=…' }) })),
    ls(t('site.hours'), 'hours', c),
  );

  const socialCard = el(
    'section.card',
    el('h2.card-title', t('site.social')),
    rowsEditor({
      rows: state.social,
      idPrefix: 'site-social',
      columns: [t('site.socialKind'), t('site.socialUrl')],
      addLabel: t('site.addSocial'),
      onChange: touch,
      makeRow: Object.assign(
        (row) => {
          const sel = select(SOCIAL_KINDS.map((k) => ({ value: k, label: k === 'x' ? 'X (Twitter)' : k.charAt(0).toUpperCase() + k.slice(1) })), { value: row.kind });
          sel.addEventListener('change', () => { row.kind = sel.value; touch(); });
          return [sel, urlCell(row, 'url', { onChange: touch })];
        },
        { empty: () => ({ kind: 'linkedin', url: '' }) },
      ),
    }),
  );

  const imprintCard = el('section.card', el('h2.card-title', t('site.imprint')), el('p.muted.small', t('site.imprintHint')), createBlockEditor({ blocks: state.imprint, onChange: touch, title: t('blocks.title'), idPrefix: 'imprint-blocks' }));
  const privacyCard = el('section.card', el('h2.card-title', t('site.privacy')), el('p.muted.small', t('site.privacyHint')), createBlockEditor({ blocks: state.privacy, onChange: touch, title: t('blocks.title'), idPrefix: 'privacy-blocks' }));

  const sections = [
    ['hero', t('site.hero'), heroCard],
    ['about', t('site.about'), aboutCard],
    ['stats', t('site.stats'), statsCard],
    ['areas', t('site.areas'), areasCard],
    ['contact', t('site.contact'), contactCard],
    ['social', t('site.social'), socialCard],
    ['imprint', t('site.imprint'), imprintCard],
    ['privacy', t('site.privacy'), privacyCard],
  ];
  const toc = el('nav.site-toc');
  const body = el('div.site-main');
  for (const [key, label, card] of sections) {
    card.id = 'site-' + key;
    toc.appendChild(el('a.toc-link', { href: '#/site', dataset: { target: 'site-' + key }, onClick: (e) => { e.preventDefault(); card.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, label));
    body.appendChild(card);
  }
  frame.page.appendChild(el('div.site-layout', body, el('aside.site-side', toc)));
  fitTextareas(body);
  frame.refreshDirty();
}

// ---- account --------------------------------------------------------------

function renderAccount(main) {
  const page = el('div.page.page-account');
  page.appendChild(el('div.page-head', el('div', el('h1', t('account.title')), el('p.muted', t('account.signedInAs', { name: app.user.username })))));

  const cur = input({ type: 'password', autocomplete: 'current-password', id: 'pw-current' });
  const nw = input({ type: 'password', autocomplete: 'new-password', id: 'pw-new' });
  const rep = input({ type: 'password', autocomplete: 'new-password', id: 'pw-repeat' });
  const submit = button({ label: t('account.changePassword'), icon: 'lock', variant: 'primary', type: 'submit', id: 'pw-submit' });
  const form = el(
    'form.stack',
    {
      onSubmit: async (e) => {
        e.preventDefault();
        if (nw.value.length < 8) {
          toast(t('account.tooShort'), 'error');
          nw.focus();
          return;
        }
        if (nw.value !== rep.value) {
          toast(t('account.mismatch'), 'error');
          rep.focus();
          return;
        }
        await withBusy(submit, t('common.saving'), async () => {
          try {
            await api.put('/api/admin/password', { current: cur.value, new: nw.value });
            toast(t('account.changed'), 'success');
            cur.value = nw.value = rep.value = '';
          } catch (err) {
            toast(api.errorMessage(err), 'error');
          }
        });
      },
    },
    field({ label: t('account.current'), control: cur }),
    el('div.row-2', field({ label: t('account.new'), hint: t('account.passwordHint'), control: nw }), field({ label: t('account.confirm'), control: rep })),
    el('div', submit),
  );
  const pwCard = el('section.card', el('h2.card-title', t('account.changePassword')), form);

  const exportBtn = button({ label: t('account.export'), icon: 'download', variant: 'primary', id: 'export-btn' });
  exportBtn.addEventListener('click', () =>
    withBusy(exportBtn, t('app.loading'), async () => {
      try {
        await api.downloadExport();
        toast(t('account.exported'), 'success');
      } catch (err) {
        toast(api.errorMessage(err), 'error');
      }
    }),
  );
  const importInput = el('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' }, id: 'import-file' });
  const importBtn = button({ label: t('account.import'), icon: 'upload', variant: 'secondary', id: 'import-btn', onClick: () => importInput.click() });
  importInput.addEventListener('change', async () => {
    const file = importInput.files && importInput.files[0];
    importInput.value = '';
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      toast(t('account.importInvalid'), 'error');
      return;
    }
    if (!data || typeof data !== 'object' || !data.site || !Array.isArray(data.news) || !Array.isArray(data.products) || !Array.isArray(data.media)) {
      toast(t('account.importInvalid'), 'error');
      return;
    }
    const summary = t('account.importSummary', { news: data.news.length, products: data.products.length, media: data.media.length });
    const ok = await confirmDialog({ title: t('account.importTitle'), message: t('account.importMessage', { name: file.name }) + ' (' + summary + ')', okLabel: t('account.import'), danger: true });
    if (!ok) return;
    await withBusy(importBtn, t('app.loading'), async () => {
      try {
        await api.post('/api/admin/import', data);
        app.siteAreas = [];
        toast(t('account.imported'), 'success');
      } catch (err) {
        toast(api.errorMessage(err), 'error');
      }
    });
  });
  const backupCard = el('section.card', el('h2.card-title', t('account.backup')), el('p.muted', t('account.backupHint')), el('div.btn-row', exportBtn, importBtn, importInput));
  page.appendChild(el('div.account-grid', pwCard, backupCard));
  main.appendChild(page);
}

// ---- boot -----------------------------------------------------------------

async function boot() {
  document.title = t('app.name');
  try {
    const me = await api.get('/api/admin/me', { noRedirect: true });
    app.user = { username: me.username };
  } catch {
    app.user = null;
  }
  if (!app.user && location.hash && location.hash !== '#/login') app.intended = location.hash;
  renderShell();
  if (!location.hash) location.hash = app.user ? '#/dashboard' : '#/login';
  else renderRoute();
}

boot();
