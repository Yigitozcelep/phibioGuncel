// Media: upload helpers, the "choose from library" modal, the cover picker
// and gallery editor used by the editors, and the media library page.

import * as api from './api.js';
import { getLang, t, formatDate } from './i18n.js';
import { el, clear, button, icon, toast, confirmDialog, openModal, field, input, fmtBytes, isImageFile, pickFiles, imageRef, copyText, spinner, emptyState, withBusy, badge } from './ui.js';
import { openComposer } from './composer.js';

/**
 * Upload several files one after another. Non-image files are skipped with a
 * toast. Returns the MediaResolved objects of the successful uploads.
 */
export async function uploadMany(files, { onProgress, onEach } = {}) {
  const list = Array.from(files || []).filter((f) => {
    if (isImageFile(f)) return true;
    toast(t('common.notAnImage', { name: f.name }), 'error');
    return false;
  });
  const results = [];
  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    try {
      const media = await api.upload(file, {
        onProgress: (pct) => onProgress && onProgress({ index: i, total: list.length, pct, file }),
      });
      results.push(media);
      if (onEach) onEach(media, i, list.length);
    } catch (err) {
      toast(t('media.uploadFailed', { name: file.name, error: api.errorMessage(err) }), 'error');
      if (err instanceof api.ApiError && err.status === 401) break;
    }
  }
  return results;
}

function mediaCard(m, { selected = false, onClick } = {}) {
  const card = el('button.media-card' + (selected ? '.is-selected' : ''), { type: 'button', title: m.fileName, dataset: { id: m.id } });
  card.appendChild(el('div.media-thumb', el('img', { src: m.thumb || m.url, alt: m.alt?.[getLang()] || m.fileName, loading: 'lazy' })));
  card.appendChild(el('div.media-meta', el('span.media-name', m.fileName), el('span.media-dim', `${m.width}×${m.height} · ${fmtBytes(m.size)}`)));
  card.appendChild(el('span.media-check', icon('check', 14)));
  if (onClick) card.addEventListener('click', () => onClick(m, card));
  return card;
}

/**
 * chooseFromLibrary({ multiple }) → Promise<MediaResolved | MediaResolved[] | null>
 */
export function chooseFromLibrary({ multiple = false } = {}) {
  return new Promise((resolve) => {
    let items = [];
    const selected = new Map();
    let query = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const grid = el('div.media-grid.media-grid-modal');
    const status = el('span.muted', '');
    const renderGrid = () => {
      clear(grid);
      const q = query.trim().toLowerCase();
      const shown = items.filter((m) => !q || m.fileName.toLowerCase().includes(q) || (m.alt?.tr || '').toLowerCase().includes(q) || (m.alt?.en || '').toLowerCase().includes(q));
      if (!items.length) {
        grid.appendChild(emptyState(t('media.empty')));
      } else if (!shown.length) {
        grid.appendChild(emptyState(t('common.noResults')));
      }
      for (const m of shown) {
        grid.appendChild(
          mediaCard(m, {
            selected: selected.has(m.id),
            onClick: (media, card) => {
              if (!multiple) {
                finish(media);
                modal.close();
                return;
              }
              if (selected.has(media.id)) selected.delete(media.id);
              else selected.set(media.id, media);
              card.classList.toggle('is-selected', selected.has(media.id));
              selectBtn.disabled = selected.size === 0;
              status.textContent = selected.size ? t('media.selected', { n: selected.size }) : '';
            },
          }),
        );
      }
    };

    const search = input({ placeholder: t('media.search'), class: 'search-input' });
    search.addEventListener('input', () => {
      query = search.value;
      renderGrid();
    });
    const uploadBtn = button({ label: t('media.uploadNew'), icon: 'upload', variant: 'secondary', small: true });
    uploadBtn.addEventListener('click', async () => {
      const files = await pickFiles({ multiple });
      if (!files.length) return;
      await withBusy(uploadBtn, t('common.uploading'), async () => {
        const uploaded = await uploadMany(files);
        if (!uploaded.length) return;
        if (!multiple) {
          finish(uploaded[0]);
          modal.close();
          return;
        }
        items = [...uploaded.slice().reverse(), ...items];
        for (const m of uploaded) selected.set(m.id, m);
        selectBtn.disabled = false;
        status.textContent = t('media.selected', { n: selected.size });
        renderGrid();
      });
    });

    const toolbar = el('div.toolbar', el('div.toolbar-left', icon('search', 16), search), el('div.toolbar-right', status, uploadBtn));
    const body = el('div', toolbar, el('div.media-modal-body', spinner()));
    const selectBtn = button({ label: t('media.select'), icon: 'check', variant: 'primary', disabled: true });
    selectBtn.addEventListener('click', () => {
      finish(Array.from(selected.values()));
      modal.close();
    });
    const cancelBtn = button({ label: t('common.cancel'), variant: 'ghost', onClick: () => modal.close() });
    const modal = openModal({
      title: multiple ? t('media.chooseMultiple') : t('media.choose'),
      content: body,
      width: 960,
      className: 'modal-media',
      footer: multiple ? [cancelBtn, el('span.spacer'), selectBtn] : [cancelBtn],
      onClose: () => finish(multiple ? [] : null),
    });

    api
      .get('/api/admin/media')
      .then((list) => {
        items = list || [];
        const host = body.querySelector('.media-modal-body');
        clear(host);
        host.appendChild(grid);
        renderGrid();
      })
      .catch((err) => {
        const host = body.querySelector('.media-modal-body');
        clear(host);
        host.appendChild(emptyState(api.errorMessage(err)));
      });
  });
}

/**
 * Cover picker used for news/product covers, hero image and area images.
 * coverPicker({ value: ImageRef|null, onChange(ref|null), composer: { title(lang), subtitle(lang), slug() }, aspect })
 */
export function coverPicker({ value, onChange, composer, label, compact = false }) {
  let current = imageRef(value);
  const root = el('div.cover-picker' + (compact ? '.cover-compact' : ''));
  const preview = el('div.cover-preview');
  const actions = el('div.cover-actions');
  const progress = el('div.progress', el('div.progress-bar'));
  progress.style.display = 'none';

  const render = () => {
    clear(preview);
    if (current) {
      preview.classList.add('has-image');
      preview.appendChild(el('img', { src: current.url || current.thumb, alt: current.alt?.[getLang()] || '' }));
      if (current.width) preview.appendChild(el('span.cover-dim', `${current.width}×${current.height}`));
    } else {
      preview.classList.remove('has-image');
      preview.appendChild(el('div.cover-empty', icon('image', 28), el('span', t('common.dropHere')), el('span.muted.small', t('common.orClick'))));
    }
    removeBtn.style.display = current ? '' : 'none';
  };

  const set = (ref) => {
    current = imageRef(ref);
    render();
    onChange(current);
  };

  const doUpload = async (file) => {
    if (!isImageFile(file)) {
      toast(t('common.notAnImage', { name: file.name }), 'error');
      return;
    }
    progress.style.display = '';
    const bar = progress.firstChild;
    bar.style.width = '0%';
    try {
      const media = await api.upload(file, { onProgress: (p) => (bar.style.width = p + '%') });
      set(media);
      toast(t('media.uploaded1'), 'success');
    } catch (err) {
      toast(api.errorMessage(err), 'error');
    } finally {
      progress.style.display = 'none';
    }
  };

  const uploadBtn = button({ label: t('common.upload'), icon: 'upload', small: true });
  uploadBtn.addEventListener('click', async () => {
    const files = await pickFiles();
    if (files[0]) doUpload(files[0]);
  });
  const chooseBtn = button({ label: t('common.chooseFromLibrary'), icon: 'media', small: true });
  chooseBtn.addEventListener('click', async () => {
    const m = await chooseFromLibrary();
    if (m) set(m);
  });
  const createBtn = button({ label: t('common.createCover'), icon: 'sparkle', small: true, variant: 'accent', className: 'cover-create' });
  createBtn.addEventListener('click', () => {
    const c = composer || {};
    openComposer({
      title: c.title ? c.title() : {},
      subtitle: c.subtitle ? c.subtitle() : {},
      slug: c.slug ? c.slug() : '',
      onDone: (ref) => set(ref),
    });
  });
  const removeBtn = button({ label: t('common.remove'), icon: 'x', small: true, variant: 'ghost', className: 'cover-remove' });
  removeBtn.addEventListener('click', () => set(null));
  actions.append(uploadBtn, chooseBtn, createBtn, removeBtn);

  // Drop zone / click on the preview.
  preview.addEventListener('click', async () => {
    const files = await pickFiles();
    if (files[0]) doUpload(files[0]);
  });
  preview.addEventListener('dragover', (e) => {
    e.preventDefault();
    preview.classList.add('is-drag');
  });
  preview.addEventListener('dragleave', () => preview.classList.remove('is-drag'));
  preview.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    preview.classList.remove('is-drag');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) doUpload(file);
  });

  if (label) root.appendChild(el('div.field-label', label));
  root.append(preview, progress, actions);
  render();
  root.setValue = (ref) => {
    current = imageRef(ref);
    render();
  };
  return root;
}

/**
 * Gallery editor (products): multi-upload, choose from library, reorder
 * (buttons + drag), remove. items is an array of ImageRef; mutated in place.
 */
export function galleryEditor({ items, onChange }) {
  const root = el('div.gallery-editor');
  const list = el('div.gallery-list');
  const progress = el('div.progress', el('div.progress-bar'));
  progress.style.display = 'none';
  let dragIndex = -1;

  const render = () => {
    clear(list);
    if (!items.length) {
      list.appendChild(el('p.muted.small', t('common.noImage')));
    }
    items.forEach((ref, i) => {
      const tile = el('div.gallery-tile', { draggable: true, dataset: { index: i } });
      tile.appendChild(el('img', { src: ref.thumb || ref.url, alt: '' }));
      tile.appendChild(el('span.gallery-index', String(i + 1)));
      const tools = el('div.gallery-tools');
      tools.appendChild(button({ icon: 'left', title: t('common.moveUp'), small: true, variant: 'ghost', disabled: i === 0, onClick: () => move(i, i - 1) }));
      tools.appendChild(button({ icon: 'right', title: t('common.moveDown'), small: true, variant: 'ghost', disabled: i === items.length - 1, onClick: () => move(i, i + 1) }));
      tools.appendChild(button({ icon: 'trash', title: t('common.remove'), small: true, variant: 'ghost', className: 'danger-text', onClick: () => { items.splice(i, 1); render(); onChange(); } }));
      tile.appendChild(tools);
      tile.addEventListener('dragstart', (e) => {
        dragIndex = i;
        tile.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* ignore */ }
      });
      tile.addEventListener('dragend', () => { dragIndex = -1; tile.classList.remove('is-dragging'); list.querySelectorAll('.is-over').forEach((n) => n.classList.remove('is-over')); });
      tile.addEventListener('dragover', (e) => { if (dragIndex < 0) return; e.preventDefault(); tile.classList.add('is-over'); });
      tile.addEventListener('dragleave', () => tile.classList.remove('is-over'));
      tile.addEventListener('drop', (e) => {
        if (dragIndex < 0) return;
        e.preventDefault();
        e.stopPropagation();
        move(dragIndex, i);
        dragIndex = -1;
      });
      list.appendChild(tile);
    });
  };
  const move = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return;
    const [m] = items.splice(from, 1);
    items.splice(to, 0, m);
    render();
    onChange();
  };

  const addFiles = async (files) => {
    if (!files.length) return;
    progress.style.display = '';
    const bar = progress.firstChild;
    const uploaded = await uploadMany(files, { onProgress: ({ index, total, pct }) => (bar.style.width = Math.round(((index + pct / 100) / total) * 100) + '%') });
    progress.style.display = 'none';
    if (uploaded.length) {
      uploaded.forEach((m) => items.push(imageRef(m)));
      toast(uploaded.length === 1 ? t('media.uploaded1') : t('media.uploadedN', { n: uploaded.length }), 'success');
      render();
      onChange();
    }
  };

  const uploadBtn = button({ label: t('common.upload'), icon: 'upload', small: true, onClick: async () => addFiles(await pickFiles({ multiple: true })) });
  const chooseBtn = button({
    label: t('products.addToGallery'),
    icon: 'media',
    small: true,
    onClick: async () => {
      const picked = await chooseFromLibrary({ multiple: true });
      if (picked && picked.length) {
        picked.forEach((m) => items.push(imageRef(m)));
        render();
        onChange();
      }
    },
  });
  root.append(list, progress, el('div.gallery-actions', uploadBtn, chooseBtn));
  root.addEventListener('dragover', (e) => {
    if (dragIndex >= 0) return;
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      root.classList.add('is-drag');
    }
  });
  root.addEventListener('dragleave', () => root.classList.remove('is-drag'));
  root.addEventListener('drop', (e) => {
    root.classList.remove('is-drag');
    if (dragIndex >= 0) return;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      e.preventDefault();
      e.stopPropagation();
      addFiles(Array.from(e.dataTransfer.files));
    }
  });
  render();
  return root;
}

// ---- media library page ---------------------------------------------------

export function renderMediaPage(container) {
  let items = [];
  let selectedId = null;
  let query = '';

  const countEl = el('span.muted', '');
  const search = input({ placeholder: t('media.search'), class: 'search-input' });
  search.addEventListener('input', () => {
    query = search.value;
    renderGrid();
  });
  const uploadBtn = button({ label: t('media.upload'), icon: 'upload', variant: 'primary', id: 'media-upload' });
  uploadBtn.addEventListener('click', async () => addFiles(await pickFiles({ multiple: true })));

  const grid = el('div.media-grid');
  const panel = el('aside.media-panel');
  const progress = el('div.progress.progress-page', el('div.progress-bar'));
  progress.style.display = 'none';
  const progressText = el('span.muted.small', '');

  const page = el(
    'div.page.page-media',
    el('div.page-head', el('div', el('h1', t('media.title')), el('p.muted', t('media.dropHint'))), el('div.page-actions', uploadBtn)),
    el('div.toolbar', el('div.toolbar-left', icon('search', 16), search), el('div.toolbar-right', progressText, countEl)),
    progress,
    el('div.media-layout', grid, panel),
  );
  clear(container);
  container.appendChild(page);

  const visible = () => {
    const q = query.trim().toLowerCase();
    return items.filter((m) => !q || m.fileName.toLowerCase().includes(q) || (m.alt?.tr || '').toLowerCase().includes(q) || (m.alt?.en || '').toLowerCase().includes(q));
  };

  function renderGrid() {
    clear(grid);
    countEl.textContent = t('media.count', { n: items.length });
    const shown = visible();
    if (!items.length) {
      grid.appendChild(emptyState(t('media.empty')));
      return;
    }
    if (!shown.length) {
      grid.appendChild(emptyState(t('common.noResults')));
      return;
    }
    for (const m of shown) {
      grid.appendChild(mediaCard(m, { selected: m.id === selectedId, onClick: (media) => select(media.id) }));
    }
  }

  function select(id) {
    selectedId = id;
    grid.querySelectorAll('.media-card').forEach((c) => c.classList.toggle('is-selected', c.dataset.id === id));
    renderPanel();
  }

  function renderPanel() {
    clear(panel);
    const m = items.find((x) => x.id === selectedId);
    if (!m) {
      panel.appendChild(el('div.panel-empty', icon('image', 30), el('p.muted', t('media.details'))));
      return;
    }
    const altTr = input({ value: m.alt?.tr || '', lang: 'tr' });
    const altEn = input({ value: m.alt?.en || '', lang: 'en' });
    const saveAltBtn = button({ label: t('media.saveAlt'), icon: 'save', variant: 'primary', small: true });
    saveAltBtn.addEventListener('click', () =>
      withBusy(saveAltBtn, t('common.saving'), async () => {
        try {
          const updated = await api.put('/api/admin/media/' + m.id, { alt: { tr: altTr.value, en: altEn.value } });
          Object.assign(m, updated);
          toast(t('media.altSaved'), 'success');
        } catch (err) {
          toast(api.errorMessage(err), 'error');
        }
      }),
    );
    const copyBtn = button({ label: t('media.copyUrl'), icon: 'copy', small: true });
    copyBtn.addEventListener('click', async () => {
      try {
        await copyText(m.url);
        toast(t('common.copied'), 'success', 2000);
      } catch {
        toast(t('common.unexpectedError'), 'error');
      }
    });
    const openBtn = el('a.btn.btn-secondary.btn-sm', { href: m.orig || m.url, target: '_blank', rel: 'noopener' }, icon('external', 15), el('span', t('media.openOriginal')));
    const delBtn = button({ label: t('media.delete'), icon: 'trash', variant: 'danger', small: true, id: 'media-delete' });
    delBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: t('media.deleteTitle'), message: t('media.deleteMessage', { name: m.fileName }), okLabel: t('common.delete'), danger: true });
      if (!ok) return;
      try {
        await api.del('/api/admin/media/' + m.id);
        items = items.filter((x) => x.id !== m.id);
        selectedId = null;
        toast(t('media.deleted'), 'success');
        renderGrid();
        renderPanel();
      } catch (err) {
        if (err instanceof api.ApiError && err.status === 409) {
          toast(err.message || t('media.inUse'), 'error', 9000);
        } else {
          toast(api.errorMessage(err), 'error');
        }
      }
    });
    const variants = Object.entries(m.variants || {}).map(([k, v]) => badge(k + ': ' + v, 'neutral'));
    panel.append(
      el('div.panel-img', el('img', { src: m.url, alt: m.alt?.[getLang()] || m.fileName })),
      el('h3.panel-title', m.fileName),
      el(
        'dl.kv',
        el('dt', t('media.dimensions')), el('dd', `${m.width} × ${m.height} px`),
        el('dt', t('media.size')), el('dd', fmtBytes(m.size)),
        el('dt', t('media.type')), el('dd', m.mime),
        el('dt', t('media.uploaded')), el('dd', formatDate(m.createdAt)),
        el('dt', t('media.variants')), el('dd.variant-list', variants.length ? variants : '–'),
      ),
      el('div.field', el('div.field-label', t('media.alt')), el('div.loc-cols', el('div.loc-col', el('span.lang-tag', 'TR'), altTr), el('div.loc-col', el('span.lang-tag', 'EN'), altEn)), el('p.field-hint', t('media.altHint'))),
      el('div.panel-actions', saveAltBtn, copyBtn, openBtn),
      el('div.panel-actions.panel-danger', delBtn),
    );
  }

  async function addFiles(files) {
    if (!files.length) return;
    progress.style.display = '';
    const bar = progress.firstChild;
    bar.style.width = '0%';
    const uploaded = await uploadMany(files, {
      onProgress: ({ index, total, pct }) => {
        bar.style.width = Math.round(((index + pct / 100) / total) * 100) + '%';
        progressText.textContent = t('media.progress', { done: index + 1, total });
      },
    });
    progress.style.display = 'none';
    progressText.textContent = '';
    if (uploaded.length) {
      items = [...uploaded.slice().reverse(), ...items];
      toast(uploaded.length === 1 ? t('media.uploaded1') : t('media.uploadedN', { n: uploaded.length }), 'success');
      renderGrid();
      if (uploaded.length === 1) select(uploaded[0].id);
    }
  }

  // Drag-and-drop anywhere on the page.
  let dragDepth = 0;
  const onDragEnter = (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    dragDepth++;
    page.classList.add('is-drag');
  };
  const onDragOver = (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
  };
  const onDragLeave = () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) page.classList.remove('is-drag');
  };
  const onDrop = (e) => {
    dragDepth = 0;
    page.classList.remove('is-drag');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      e.preventDefault();
      addFiles(Array.from(e.dataTransfer.files));
    }
  };
  document.addEventListener('dragenter', onDragEnter);
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('dragleave', onDragLeave);
  document.addEventListener('drop', onDrop);
  page.appendChild(el('div.drop-overlay', icon('upload', 40), el('span', t('common.dropHere'))));

  grid.appendChild(spinner());
  renderPanel();
  api
    .get('/api/admin/media')
    .then((list) => {
      items = list || [];
      renderGrid();
    })
    .catch((err) => {
      clear(grid);
      grid.appendChild(emptyState(api.errorMessage(err), button({ label: t('common.retry'), icon: 'refresh', onClick: () => renderMediaPage(container) })));
    });

  return () => {
    document.removeEventListener('dragenter', onDragEnter);
    document.removeEventListener('dragover', onDragOver);
    document.removeEventListener('dragleave', onDragLeave);
    document.removeEventListener('drop', onDrop);
  };
}
