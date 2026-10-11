// Shared block editor (news, products, site about/imprint/privacy).
// Blocks are edited in place; onChange() is called after every edit so the
// owner can refresh the preview and the dirty flag.

import * as api from './api.js';
import { getLang, t } from './i18n.js';
import { el, clear, button, icon, toast, confirmDialog, localizedField, field, input, isValidLink, isImageFile, pickFiles, imageRef, fitTextareas, badge } from './ui.js';
import { chooseFromLibrary } from './media.js';

export const BLOCK_TYPES = ['heading', 'paragraph', 'image', 'list', 'quote', 'button'];

export function newBlock(type) {
  const b = { type, text: { tr: '', en: '' }, caption: { tr: '', en: '' }, label: { tr: '', en: '' }, items: [], image: null, url: '' };
  return b;
}

/** Convert an API block (resolved image) into the editor's shape. */
export function fromApiBlock(b) {
  return {
    type: BLOCK_TYPES.includes(b.type) ? b.type : 'paragraph',
    text: { tr: b.text?.tr || '', en: b.text?.en || '' },
    caption: { tr: b.caption?.tr || '', en: b.caption?.en || '' },
    label: { tr: b.label?.tr || '', en: b.label?.en || '' },
    items: (b.items || []).map((it) => ({ tr: it?.tr || '', en: it?.en || '' })),
    image: imageRef(b.image),
    url: b.url || '',
  };
}

/** Serialise for the API: media ids instead of ImageRef objects. */
export function toApiBlock(b) {
  const out = { type: b.type, text: { tr: '', en: '' }, caption: { tr: '', en: '' }, label: { tr: '', en: '' } };
  switch (b.type) {
    case 'heading':
    case 'paragraph':
    case 'quote':
      out.text = { tr: b.text.tr, en: b.text.en };
      break;
    case 'image':
      out.image = b.image ? b.image.id : '';
      out.caption = { tr: b.caption.tr, en: b.caption.en };
      break;
    case 'list':
      out.items = b.items.map((it) => ({ tr: it.tr, en: it.en })).filter((it) => it.tr.trim() || it.en.trim());
      break;
    case 'button':
      out.label = { tr: b.label.tr, en: b.label.en };
      out.url = b.url.trim();
      break;
    default:
      break;
  }
  return out;
}

/** Client-side validation; returns a message or null. */
export function validateBlocks(blocks, where) {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === 'button') {
      if (!isValidLink(b.url)) return `${where} · ${t('blocks.blockN', { n: i + 1 })}: ${t('common.invalidUrl')}`;
      if (!b.label.tr.trim() && !b.label.en.trim()) return `${where} · ${t('blocks.blockN', { n: i + 1 })}: ${t('blocks.label')}`;
    }
  }
  return null;
}

// Items of a list block are edited as newline-separated text per language.
function itemsToText(items, lang) {
  return items.map((it) => it[lang] || '').join('\n');
}

function textToItems(trText, enText) {
  const tr = trText.split('\n');
  const en = enText.split('\n');
  const n = Math.max(tr.length, en.length);
  const items = [];
  for (let i = 0; i < n; i++) items.push({ tr: tr[i] || '', en: en[i] || '' });
  return items;
}

/**
 * createBlockEditor({ blocks, onChange, title, hint }) → element
 */
export function createBlockEditor({ blocks, onChange, title, hint, idPrefix = 'blocks' }) {
  const root = el('div.block-editor', { id: idPrefix });
  const list = el('div.block-items');
  const countEl = el('span.muted.small', '');
  let dragFrom = -1;

  const changed = () => {
    countEl.textContent = blocks.length ? `${blocks.length} ${t('common.items')}` : '';
    onChange();
  };

  const addMenu = el('div.add-menu');
  for (const type of BLOCK_TYPES) {
    addMenu.appendChild(
      button({
        label: t('blocks.types.' + type),
        icon: type,
        small: true,
        className: 'add-' + type,
        onClick: () => {
          blocks.push(newBlock(type));
          renderList();
          changed();
          const last = list.lastElementChild;
          if (last) {
            last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            const first = last.querySelector('input, textarea');
            if (first) first.focus();
          }
        },
      }),
    );
  }

  const head = el('div.block-editor-head', el('div', el('h3.section-title', title || t('blocks.title')), hint ? el('p.muted.small', hint) : null), countEl);
  root.append(head, list, el('div.add-row', el('span.add-label', icon('plus', 15), t('blocks.add')), addMenu));

  function move(from, to) {
    if (to < 0 || to >= blocks.length || from === to) return;
    const [b] = blocks.splice(from, 1);
    blocks.splice(to, 0, b);
    renderList();
    changed();
  }

  function renderList() {
    clear(list);
    if (!blocks.length) {
      list.appendChild(el('div.block-empty', icon('info', 20), el('span', t('blocks.empty'))));
    }
    blocks.forEach((b, i) => list.appendChild(renderBlock(b, i)));
    fitTextareas(list);
  }

  function renderBlock(b, i) {
    const card = el('div.block.block-' + b.type, { dataset: { index: i, type: b.type } });
    const grip = el('span.block-grip', { title: t('common.dragToReorder'), draggable: true }, icon('grip', 18));
    const headRow = el(
      'div.block-head',
      grip,
      el('span.block-type', icon(b.type, 16), el('span', t('blocks.types.' + b.type))),
      el('span.block-n.muted.small', t('blocks.blockN', { n: i + 1 })),
      el('span.spacer'),
      el(
        'div.block-actions',
        button({ icon: 'up', title: t('common.moveUp'), small: true, variant: 'ghost', disabled: i === 0, className: 'block-up', onClick: () => move(i, i - 1) }),
        button({ icon: 'down', title: t('common.moveDown'), small: true, variant: 'ghost', disabled: i === blocks.length - 1, className: 'block-down', onClick: () => move(i, i + 1) }),
        button({
          icon: 'trash',
          title: t('common.delete'),
          small: true,
          variant: 'ghost',
          className: 'danger-text block-delete',
          onClick: async () => {
            const ok = await confirmDialog({ title: t('blocks.deleteTitle'), message: t('blocks.deleteMessage', { type: t('blocks.types.' + b.type).toLowerCase() }), okLabel: t('common.delete'), danger: true });
            if (!ok) return;
            blocks.splice(i, 1);
            renderList();
            changed();
          },
        }),
      ),
    );
    card.appendChild(headRow);
    card.appendChild(renderBody(b));

    // Drag-and-drop reorder (HTML5). The grip starts the drag; the card is the target.
    grip.addEventListener('dragstart', (e) => {
      dragFrom = i;
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', 'block:' + i);
      } catch {
        /* ignore */
      }
    });
    grip.addEventListener('dragend', () => {
      dragFrom = -1;
      card.classList.remove('is-dragging');
      list.querySelectorAll('.drop-before, .drop-after').forEach((n) => n.classList.remove('drop-before', 'drop-after'));
    });
    card.addEventListener('dragover', (e) => {
      if (dragFrom < 0) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = card.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      card.classList.toggle('drop-before', before);
      card.classList.toggle('drop-after', !before);
    });
    card.addEventListener('dragleave', () => card.classList.remove('drop-before', 'drop-after'));
    card.addEventListener('drop', (e) => {
      if (dragFrom < 0) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = card.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      let to = before ? i : i + 1;
      if (dragFrom < to) to -= 1;
      const from = dragFrom;
      dragFrom = -1;
      move(from, to);
    });
    return card;
  }

  function renderBody(b) {
    const body = el('div.block-body');
    switch (b.type) {
      case 'heading':
        body.appendChild(localizedField({ label: t('blocks.text'), value: b.text, placeholder: t('blocks.headingPlaceholder'), onInput: (v) => { b.text = v; changed(); } }));
        break;
      case 'paragraph':
        body.appendChild(localizedField({ label: t('blocks.text'), value: b.text, multiline: true, placeholder: t('blocks.paragraphPlaceholder'), onInput: (v) => { b.text = v; changed(); } }));
        break;
      case 'quote':
        body.appendChild(localizedField({ label: t('blocks.text'), value: b.text, multiline: true, placeholder: t('blocks.quotePlaceholder'), onInput: (v) => { b.text = v; changed(); } }));
        break;
      case 'list': {
        const lf = localizedField({
          label: t('blocks.items'),
          hint: t('blocks.itemsHint'),
          value: { tr: itemsToText(b.items, 'tr'), en: itemsToText(b.items, 'en') },
          multiline: true,
          syncScroll: true,
          placeholder: t('blocks.itemPlaceholder'),
          onInput: (v) => {
            b.items = textToItems(v.tr, v.en);
            changed();
          },
        });
        body.appendChild(lf);
        break;
      }
      case 'button': {
        body.appendChild(localizedField({ label: t('blocks.label'), value: b.label, placeholder: t('blocks.labelPlaceholder'), required: true, onInput: (v) => { b.label = v; changed(); } }));
        const urlIn = input({ value: b.url, placeholder: t('blocks.urlPlaceholder'), class: 'mono', spellcheck: false });
        const err = el('p.field-error', t('common.invalidUrl'));
        const check = () => {
          const bad = urlIn.value.trim() !== '' && !isValidLink(urlIn.value);
          urlIn.classList.toggle('is-invalid', bad || urlIn.value.trim() === '');
          err.style.display = bad ? '' : 'none';
        };
        urlIn.addEventListener('input', () => {
          b.url = urlIn.value;
          check();
          changed();
        });
        body.appendChild(field({ label: t('blocks.url'), required: true, control: [urlIn, err] }));
        check();
        break;
      }
      case 'image':
        body.appendChild(renderImageBlock(b));
        body.appendChild(localizedField({ label: t('blocks.caption'), value: b.caption, onInput: (v) => { b.caption = v; changed(); } }));
        break;
      default:
        break;
    }
    return body;
  }

  function renderImageBlock(b) {
    const zone = el('div.image-zone');
    const progress = el('div.progress', el('div.progress-bar'));
    progress.style.display = 'none';
    const progressLabel = el('span.muted.small', '');

    const render = () => {
      clear(zone);
      if (b.image) {
        zone.classList.add('has-image');
        zone.appendChild(el('div.image-thumb', el('img', { src: b.image.thumb || b.image.url, alt: b.image.alt?.[getLang()] || '' })));
        const info = el('div.image-info');
        if (b.image.width) info.appendChild(badge(`${b.image.width}×${b.image.height}`, 'neutral'));
        if (b.image.alt && (b.image.alt.tr || b.image.alt.en)) info.appendChild(el('span.muted.small', t('common.imageAlt') + ': ' + (b.image.alt[getLang()] || b.image.alt.tr || b.image.alt.en)));
        info.appendChild(
          el(
            'div.image-actions',
            button({ label: t('blocks.replaceImage'), icon: 'upload', small: true, onClick: async () => { const f = await pickFiles(); if (f[0]) doUpload(f[0]); } }),
            button({ label: t('common.chooseFromLibrary'), icon: 'media', small: true, onClick: async () => { const m = await chooseFromLibrary(); if (m) { b.image = imageRef(m); render(); changed(); } } }),
            button({ label: t('common.remove'), icon: 'x', small: true, variant: 'ghost', onClick: () => { b.image = null; render(); changed(); } }),
          ),
        );
        zone.appendChild(info);
      } else {
        zone.classList.remove('has-image');
        const drop = el('div.drop-zone', { tabIndex: 0, role: 'button' }, icon('upload', 26), el('strong', t('common.dropHere')), el('span.muted.small', t('common.orClick')));
        drop.addEventListener('click', async () => {
          const f = await pickFiles();
          if (f[0]) doUpload(f[0]);
        });
        drop.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            drop.click();
          }
        });
        zone.appendChild(drop);
        zone.appendChild(el('div.image-actions', button({ label: t('common.chooseFromLibrary'), icon: 'media', small: true, onClick: async () => { const m = await chooseFromLibrary(); if (m) { b.image = imageRef(m); render(); changed(); } } })));
      }
      zone.appendChild(progress);
      zone.appendChild(progressLabel);
    };

    const doUpload = async (file) => {
      if (!isImageFile(file)) {
        toast(t('common.notAnImage', { name: file.name }), 'error');
        return;
      }
      progress.style.display = '';
      const bar = progress.firstChild;
      bar.style.width = '0%';
      progressLabel.textContent = t('blocks.uploadProgress', { pct: 0 });
      try {
        const media = await api.upload(file, {
          onProgress: (p) => {
            bar.style.width = p + '%';
            progressLabel.textContent = t('blocks.uploadProgress', { pct: p });
          },
        });
        b.image = imageRef(media);
        render();
        changed();
        toast(t('media.uploaded1'), 'success', 2500);
      } catch (err) {
        toast(api.errorMessage(err), 'error');
      } finally {
        progress.style.display = 'none';
        progressLabel.textContent = '';
      }
    };

    zone.addEventListener('dragover', (e) => {
      if (dragFrom >= 0) return;
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('is-drag');
      }
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-drag'));
    zone.addEventListener('drop', (e) => {
      zone.classList.remove('is-drag');
      if (dragFrom >= 0) return;
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        e.preventDefault();
        e.stopPropagation();
        doUpload(file);
      }
    });
    render();
    return zone;
  }

  renderList();
  countEl.textContent = blocks.length ? `${blocks.length} ${t('common.items')}` : '';
  root.refresh = renderList;
  return root;
}
