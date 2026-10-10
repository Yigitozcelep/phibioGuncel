// Small DOM toolkit shared by every page: element builder, inline SVG icons,
// toasts, confirm dialogs, modals, localized (TR/EN) fields, helpers.

import { t } from './i18n.js';

// ---- element builder ------------------------------------------------------

/**
 * el('div.card.pad', { onClick, dataset: {...}, style: {...} }, ...children)
 * Children may be strings, nodes, arrays or null/false (skipped).
 */
export function el(spec, attrs, ...children) {
  if (attrs && (attrs instanceof Node || typeof attrs !== 'object' || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className += (node.className ? ' ' : '') + value;
      else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'html') node.innerHTML = value;
      else if (key in node && key !== 'list' && key !== 'form') {
        try {
          node[key] = value;
        } catch {
          node.setAttribute(key, value);
        }
      } else node.setAttribute(key, value === true ? '' : value);
    }
  }
  append(node, children);
  return node;
}

export function append(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (Array.isArray(child)) append(node, child);
    else if (child instanceof Node) node.appendChild(child);
    else node.appendChild(document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function frag(...children) {
  return append(document.createDocumentFragment(), children);
}

// ---- icons ----------------------------------------------------------------

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  news: '<path d="M4 5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 1-2z"/><path d="M19 9h2v9a2 2 0 0 1-2 2"/><path d="M7 9h6M7 13h8M7 17h5"/>',
  products: '<path d="M21 8 12 3 3 8l9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  site: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="#fff"/><circle cx="15" cy="12" r="2" fill="#fff"/><circle cx="8" cy="18" r="2" fill="#fff"/>',
  media: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  grip: '<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
  upload: '<path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 20h16"/>',
  download: '<path d="M12 4v12M6 10l6 6 6-6"/><path d="M4 20h16"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  alert: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
  heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
  paragraph: '<path d="M4 6h16M4 10h16M4 14h16M4 18h10"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="5" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
  quote: '<path d="M7 7h4v4H7zM13 7h4v4h-4z"/><path d="M11 11c0 3-1 4-4 5M17 11c0 3-1 4-4 5"/>',
  button: '<rect x="3" y="8" width="18" height="8" rx="3"/><path d="M8 12h8"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
  logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  map: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3z"/>',
  home: '<path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8-9-9z"/><circle cx="7.5" cy="8.5" r="1.3" fill="currentColor" stroke="none"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-.8 2-1.7 0-.9-.7-1.3-.7-2.3a2 2 0 0 1 2-2h2a4.7 4.7 0 0 0 4.7-4.7C22 6.5 17.5 3 12 3z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="7" r="1.2" fill="currentColor" stroke="none"/>',
  spinner: '<path d="M12 3a9 9 0 1 0 9 9"/>',
};

export function icon(name, size = 18, extraClass = '') {
  const path = ICONS[name] || ICONS.info;
  const span = document.createElement('span');
  span.className = 'icon' + (extraClass ? ' ' + extraClass : '');
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  return span;
}

// ---- buttons --------------------------------------------------------------

/** button({label, icon, variant, onClick, type, title, small, disabled}) */
export function button(opts) {
  const { label, icon: ic, variant = 'secondary', onClick, type = 'button', title, small, disabled, className = '', id } = opts;
  const b = el('button.btn.btn-' + variant + (small ? '.btn-sm' : '') + (!label ? '.btn-icon' : ''), {
    type,
    title: title || (label ? null : undefined),
    'aria-label': !label && title ? title : null,
    disabled: disabled || null,
    id,
  });
  if (className) b.className += ' ' + className;
  if (ic) b.appendChild(icon(ic, small ? 15 : 17));
  if (label) b.appendChild(el('span', label));
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

/** Show a busy state on a button while an async action runs. */
export async function withBusy(btn, labelWhileBusy, fn) {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('is-busy');
  if (labelWhileBusy) {
    clear(btn);
    btn.appendChild(icon('spinner', 16, 'spin'));
    btn.appendChild(el('span', labelWhileBusy));
  }
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.classList.remove('is-busy');
    if (labelWhileBusy) btn.innerHTML = original;
  }
}

// ---- toasts ---------------------------------------------------------------

let toastHost = null;

export function toast(message, kind = 'info', timeout = 4500) {
  if (!toastHost) {
    toastHost = el('div.toast-host', { role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastHost);
  }
  const iconName = kind === 'success' ? 'checkCircle' : kind === 'error' ? 'alert' : 'info';
  const node = el('div.toast.toast-' + kind, icon(iconName, 18), el('span.toast-text', message));
  const closeBtn = el('button.toast-close', { type: 'button', 'aria-label': t('common.close') }, icon('x', 14));
  node.appendChild(closeBtn);
  let timer = null;
  const dismiss = () => {
    if (timer) clearTimeout(timer);
    node.classList.add('toast-out');
    setTimeout(() => node.remove(), 200);
  };
  closeBtn.addEventListener('click', dismiss);
  toastHost.appendChild(node);
  requestAnimationFrame(() => node.classList.add('toast-in'));
  timer = setTimeout(dismiss, kind === 'error' ? Math.max(timeout, 7000) : timeout);
  return dismiss;
}

// ---- modal & confirm ------------------------------------------------------

const modalStack = [];

/**
 * openModal({ title, content, width, footer, onClose, closable }) → { close, root, body }
 */
export function openModal({ title, subtitle, content, width, footer, onClose, closable = true, className = '' }) {
  const backdrop = el('div.modal-backdrop');
  const modal = el('div.modal' + (className ? '.' + className : ''), { role: 'dialog', 'aria-modal': 'true', style: width ? { width: typeof width === 'number' ? width + 'px' : width } : null });
  const head = el('div.modal-head', el('div', el('h2.modal-title', title), subtitle ? el('p.modal-subtitle', subtitle) : null));
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    const idx = modalStack.indexOf(handle);
    if (idx >= 0) modalStack.splice(idx, 1);
    backdrop.classList.add('modal-out');
    setTimeout(() => backdrop.remove(), 150);
    if (!modalStack.length) document.body.classList.remove('has-modal');
    if (onClose) onClose(result);
  };
  if (closable) {
    head.appendChild(el('button.btn.btn-ghost.btn-icon.modal-close', { type: 'button', 'aria-label': t('common.close'), onClick: () => close(undefined) }, icon('x', 18)));
  }
  const body = el('div.modal-body');
  append(body, [content]);
  modal.appendChild(head);
  modal.appendChild(body);
  let foot = null;
  if (footer) {
    foot = el('div.modal-foot');
    append(foot, [footer]);
    modal.appendChild(foot);
  }
  backdrop.appendChild(modal);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop && closable) close(undefined);
  });
  const handle = { close, root: modal, body, foot, closable };
  modalStack.push(handle);
  document.body.classList.add('has-modal');
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('modal-in'));
  const focusable = modal.querySelector('input, textarea, select, button:not(.modal-close)');
  if (focusable) setTimeout(() => focusable.focus(), 30);
  return handle;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalStack.length) {
    const top = modalStack[modalStack.length - 1];
    if (top.closable) {
      e.preventDefault();
      top.close(undefined);
    }
  }
});

/** confirmDialog({title, message, okLabel, cancelLabel, danger}) → Promise<boolean> */
export function confirmDialog({ title, message, okLabel, cancelLabel, danger = false }) {
  return new Promise((resolve) => {
    let decided = false;
    const decide = (value) => {
      if (decided) return;
      decided = true;
      resolve(value);
    };
    const okBtn = button({ label: okLabel || t('common.confirm'), variant: danger ? 'danger' : 'primary', onClick: () => { decide(true); handle.close(true); } });
    const cancelBtn = button({ label: cancelLabel || t('common.cancel'), variant: 'secondary', onClick: () => { decide(false); handle.close(false); } });
    const handle = openModal({
      title,
      content: el('p.confirm-text', message),
      width: 460,
      footer: [cancelBtn, okBtn],
      className: 'modal-confirm',
      onClose: () => decide(false),
    });
    setTimeout(() => okBtn.focus(), 40);
  });
}

// ---- form helpers ---------------------------------------------------------

export function autoGrow(textarea) {
  const fit = () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(textarea.scrollHeight + 2, 40) + 'px';
  };
  textarea.addEventListener('input', fit);
  textarea.classList.add('auto-grow');
  requestAnimationFrame(fit);
  textarea._fit = fit;
  return textarea;
}

/** Re-measure every auto-grow textarea inside a node (after it is attached). */
export function fitTextareas(node) {
  node.querySelectorAll('textarea.auto-grow').forEach((ta) => ta._fit && ta._fit());
}

export function field({ label, hint, control, required, className = '', id }) {
  const wrap = el('div.field' + (className ? '.' + className : ''));
  if (label) {
    const lab = el('label.field-label', { for: id || null }, label);
    if (required) lab.appendChild(el('span.req', ' *'));
    wrap.appendChild(lab);
  }
  append(wrap, [control]);
  if (hint) wrap.appendChild(el('p.field-hint', hint));
  return wrap;
}

export function input(attrs = {}) {
  const i = el('input.input', { type: 'text', ...attrs });
  return i;
}

export function textarea(attrs = {}) {
  const ta = el('textarea.input.textarea', attrs);
  if (attrs.autoGrow !== false) autoGrow(ta);
  return ta;
}

export function select(options, attrs = {}) {
  const s = el('select.input.select', attrs);
  for (const o of options) s.appendChild(el('option', { value: o.value, selected: o.value === attrs.value || null }, o.label));
  if (attrs.value !== undefined) s.value = attrs.value;
  return s;
}

/**
 * Localized text field: TR on the left, EN on the right, with a small
 * "copy TR → EN" helper that fills an empty EN field.
 *
 * localizedField({ label, hint, value: {tr,en}, onInput(value), multiline, rows, placeholder, required })
 */
export function localizedField({ label, hint, value, onInput, multiline = false, placeholder, required = false, mono = false, compact = false, syncScroll = false }) {
  const current = { tr: value?.tr || '', en: value?.en || '' };
  const make = (lang) => {
    const attrs = { value: current[lang], placeholder: placeholder || '', lang, 'aria-label': (label || '') + ' (' + lang.toUpperCase() + ')' };
    if (mono) attrs.class = 'mono';
    const ctrl = multiline ? textarea(attrs) : input(attrs);
    ctrl.addEventListener('input', () => {
      current[lang] = ctrl.value;
      onInput({ ...current });
    });
    return ctrl;
  };
  const trCtrl = make('tr');
  const enCtrl = make('en');
  if (syncScroll && multiline) {
    // Keep both columns the same height so line N on the left sits next to line N on the right.
    let lock = false;
    const link = (a, b) => a.addEventListener('scroll', () => { if (lock) return; lock = true; b.scrollTop = a.scrollTop; lock = false; });
    link(trCtrl, enCtrl);
    link(enCtrl, trCtrl);
    const equalize = () => {
      trCtrl.style.height = 'auto';
      enCtrl.style.height = 'auto';
      const h = Math.max(trCtrl.scrollHeight, enCtrl.scrollHeight, 38) + 2;
      trCtrl.style.height = h + 'px';
      enCtrl.style.height = h + 'px';
    };
    trCtrl._fit = equalize;
    enCtrl._fit = equalize;
    trCtrl.addEventListener('input', equalize);
    enCtrl.addEventListener('input', equalize);
    requestAnimationFrame(equalize);
  }
  const copyBtn = el('button.btn.btn-ghost.btn-xs.copy-tr', { type: 'button', title: t('common.copyTrToEnTitle') }, icon('copy', 13), el('span', t('common.copyTrToEn')));
  copyBtn.addEventListener('click', () => {
    if (!current.tr.trim()) return;
    if (enCtrl.value.trim()) return;
    enCtrl.value = current.tr;
    current.en = current.tr;
    if (enCtrl._fit) enCtrl._fit();
    onInput({ ...current });
    enCtrl.focus();
  });
  const wrap = el('div.loc-field' + (compact ? '.loc-compact' : ''));
  if (label) {
    const lab = el('div.field-label', label);
    if (required) lab.appendChild(el('span.req', ' *'));
    wrap.appendChild(el('div.loc-head', lab, copyBtn));
  } else {
    wrap.appendChild(el('div.loc-head.loc-head-bare', el('span'), copyBtn));
  }
  wrap.appendChild(el('div.loc-cols', el('div.loc-col', el('span.lang-tag', 'TR'), trCtrl), el('div.loc-col', el('span.lang-tag', 'EN'), enCtrl)));
  if (hint) wrap.appendChild(el('p.field-hint', hint));
  wrap.controls = { tr: trCtrl, en: enCtrl };
  wrap.setValue = (v) => {
    current.tr = v?.tr || '';
    current.en = v?.en || '';
    trCtrl.value = current.tr;
    enCtrl.value = current.en;
    if (trCtrl._fit) trCtrl._fit();
    if (enCtrl._fit) enCtrl._fit();
  };
  return wrap;
}

// ---- misc helpers ---------------------------------------------------------

export function debounce(fn, ms = 120) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function fmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

/** Turkish-aware slug, mirroring the backend's Slugify. */
export function slugify(text) {
  const map = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', İ: 'i', I: 'i', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u', ß: 'ss', æ: 'ae', ø: 'o', '™': '', '®': '', '©': '' };
  let s = String(text || '');
  s = s.replace(/[çğıöşüİIÇĞÖŞÜßæø™®©]/g, (c) => (c in map ? map[c] : c));
  s = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s;
}

export const LINK_PREFIXES = ['https://', 'http://', 'mailto:', 'tel:'];

export function isValidLink(url, webOnly = false) {
  const u = String(url || '').trim().toLowerCase();
  if (!u) return false;
  const allowed = webOnly ? ['https://', 'http://'] : LINK_PREFIXES;
  return allowed.some((p) => u.startsWith(p));
}

export function isImageFile(file) {
  if (!file) return false;
  if (/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name || '');
}

export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  d.setSeconds(0, 0);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function badge(text, kind = 'neutral') {
  return el('span.badge.badge-' + kind, text);
}

export function statusBadge(status) {
  return badge(status === 'published' ? t('common.published') : t('common.draft'), status === 'published' ? 'success' : 'warning');
}

export function spinner(label) {
  return el('div.loading', icon('spinner', 22, 'spin'), el('span', label || t('app.loading')));
}

export function emptyState(message, action) {
  return el('div.empty-state', icon('info', 28), el('p', message), action || null);
}

export function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (e) {
      reject(e);
    } finally {
      ta.remove();
    }
  });
}

/** Pick files with a hidden input. Resolves with File[] (possibly empty). */
export function pickFiles({ multiple = false, accept = 'image/jpeg,image/png,image/webp,image/gif' } = {}) {
  return new Promise((resolve) => {
    const inp = el('input', { type: 'file', accept, multiple: multiple || null, style: { display: 'none' } });
    inp.className = 'hidden-file-input';
    document.body.appendChild(inp);
    let done = false;
    const finish = (files) => {
      if (done) return;
      done = true;
      inp.remove();
      resolve(files);
    };
    inp.addEventListener('change', () => finish(Array.from(inp.files || [])));
    // If the dialog is cancelled no event fires in some browsers; clean up on focus return.
    window.addEventListener('focus', () => setTimeout(() => finish(Array.from(inp.files || [])), 400), { once: true });
    inp.click();
  });
}

export function imageRef(x) {
  if (!x || typeof x !== 'object' || !x.id) return null;
  return { id: x.id, url: x.url || x.orig || '', thumb: x.thumb || x.url || '', orig: x.orig || x.url || '', width: x.width || 0, height: x.height || 0, alt: { tr: x.alt?.tr || '', en: x.alt?.en || '' } };
}

export function refId(x) {
  return x && x.id ? x.id : '';
}
