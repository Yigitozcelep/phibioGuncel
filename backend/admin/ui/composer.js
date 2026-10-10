// Cover composer: a fully client-side <canvas> tool that produces a
// 1200×675 PNG cover image from a photo or a brand gradient, a layout preset
// and the article title. The result is uploaded to /api/admin/media.

import { upload, errorMessage } from './api.js';
import { getLang, t } from './i18n.js';
import { el, button, field, input, textarea, select, toast, openModal, withBusy, isImageFile, slugify, imageRef, clear } from './ui.js';

export const CANVAS_W = 1200;
export const CANVAS_H = 675;

const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const GRADIENTS = {
  teal: ['#1C9DA3', '#0A5C63'],
  deepTeal: ['#0E7C86', '#052F33'],
  blue: ['#3B82F6', '#1E3A8A'],
  rose: ['#EC4899', '#9D174D'],
  tealBlue: ['#0E7C86', '#2563EB'],
  dark: ['#334155', '#0F172A'],
};

/**
 * Break text into lines that fit maxWidth using ctx's current font.
 * Explicit newlines are honoured and over-long words are split by character.
 */
export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const words = rawLine.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      if (rawLine.trim() === '' && lines.length) lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
        continue;
      }
      // Split a single word that is wider than the line.
      let chunk = '';
      for (const ch of word) {
        if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      line = chunk;
    }
    if (line) lines.push(line);
  }
  // Drop trailing blank lines.
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function drawCoverFit(ctx, img, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function drawDecor(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.28, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.arc(w * 0.12, h * 0.86, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.68, h * 1.02, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPhiRing(ctx, cx, cy, rx, ry, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(10, rx * 0.085);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry * 1.42);
  ctx.lineTo(cx, cy + ry * 1.42);
  ctx.stroke();
  ctx.restore();
}

/** Render the composition into ctx (1200×675). Pure function of state. */
export function renderCover(ctx, state) {
  const w = CANVAS_W;
  const h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);

  // 1. Background.
  if (state.bg === 'photo' && state.photo) {
    drawCoverFit(ctx, state.photo, w, h);
  } else {
    const [c1, c2] = GRADIENTS[state.gradient] || GRADIENTS.teal;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    drawDecor(ctx, w, h);
  }

  // 2. Overlay darkness.
  if (state.overlay > 0) {
    ctx.fillStyle = `rgba(3, 20, 24, ${state.overlay / 100})`;
    ctx.fillRect(0, 0, w, h);
  }

  const light = state.textColor === 'white';
  const textColor = light ? '#FFFFFF' : '#0F172A';
  const ringColor = light ? '#FFFFFF' : '#0F172A';

  // 3. Decorative phi ring.
  if (state.ring) {
    if (state.layout === 'center') drawPhiRing(ctx, w * 0.5, h * 0.5, 300, 210, ringColor, 0.12);
    else if (state.layout === 'topLeft') drawPhiRing(ctx, w * 0.8, h * 0.72, 190, 130, ringColor, 0.2);
    else drawPhiRing(ctx, w * 0.79, h * 0.38, 190, 130, ringColor, 0.2);
  }

  // 4. Brand tag.
  const pad = 80;
  if (state.brandTag) {
    ctx.save();
    ctx.fillStyle = textColor;
    ctx.globalAlpha = 0.92;
    ctx.font = `700 26px ${FONT_FAMILY}`;
    ctx.textBaseline = 'alphabetic';
    const tag = 'P H I B I O';
    if (state.layout === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(tag, w / 2, pad + 10);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(tag, pad, pad + 10);
    }
    ctx.restore();
  }

  // 5. Title + subtitle.
  const titleSize = Math.max(24, Math.round(state.fontSize));
  const subSize = Math.max(18, Math.round(titleSize * 0.46));
  const maxWidth = state.layout === 'center' ? w - pad * 2 - 80 : w - pad * 2 - 160;
  ctx.font = `700 ${titleSize}px ${FONT_FAMILY}`;
  const titleLines = wrapText(ctx, state.title, maxWidth);
  ctx.font = `400 ${subSize}px ${FONT_FAMILY}`;
  const subLines = state.subtitle ? wrapText(ctx, state.subtitle, maxWidth) : [];
  const titleLH = Math.round(titleSize * 1.14);
  const subLH = Math.round(subSize * 1.35);
  const gap = subLines.length ? Math.round(titleSize * 0.35) : 0;
  const total = titleLines.length * titleLH + gap + subLines.length * subLH;

  let x = pad;
  let y;
  ctx.textAlign = 'left';
  if (state.layout === 'center') {
    ctx.textAlign = 'center';
    x = w / 2;
    y = (h - total) / 2;
  } else if (state.layout === 'topLeft') {
    y = pad + (state.brandTag ? 64 : 0);
  } else {
    y = h - pad - total;
  }
  ctx.textBaseline = 'top';
  ctx.save();
  if (light) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
  }
  ctx.fillStyle = textColor;
  ctx.font = `700 ${titleSize}px ${FONT_FAMILY}`;
  for (const line of titleLines) {
    ctx.fillText(line, x, y);
    y += titleLH;
  }
  y += gap;
  ctx.font = `400 ${subSize}px ${FONT_FAMILY}`;
  ctx.globalAlpha = 0.9;
  for (const line of subLines) {
    ctx.fillText(line, x, y);
    y += subLH;
  }
  ctx.restore();
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}

/**
 * openComposer({ title: {tr,en}, subtitle: {tr,en}, slug, lang, onDone(mediaRef) })
 * Opens the modal; resolves nothing, calls onDone when a cover was uploaded.
 */
export function openComposer({ title = {}, subtitle = {}, slug = '', lang, onDone }) {
  const textLang = lang || getLang();
  const state = {
    bg: 'gradient',
    photo: null,
    photoName: '',
    gradient: 'teal',
    overlay: 20,
    layout: 'bottomLeft',
    title: (title[textLang] || title[textLang === 'tr' ? 'en' : 'tr'] || '').trim(),
    subtitle: (subtitle[textLang] || '').trim(),
    textColor: 'white',
    fontSize: 64,
    brandTag: true,
    ring: true,
    lang: textLang,
  };

  const canvas = el('canvas.composer-canvas', { width: CANVAS_W, height: CANVAS_H });
  const ctx = canvas.getContext('2d');
  let raf = 0;
  const redraw = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      renderCover(ctx, state);
    });
  };

  // ---- controls ----
  const bgChoice = el('div.seg');
  const bgBtns = {};
  for (const key of ['gradient', 'photo']) {
    const b = el('button.seg-btn', { type: 'button', dataset: { key } }, t('composer.' + key));
    b.addEventListener('click', () => {
      state.bg = key;
      syncBg();
      redraw();
    });
    bgBtns[key] = b;
    bgChoice.appendChild(b);
  }

  const gradientGrid = el('div.gradient-grid');
  const gradientBtns = {};
  for (const [key, [c1, c2]] of Object.entries(GRADIENTS)) {
    const b = el('button.gradient-swatch', { type: 'button', title: t('composer.gradients.' + key), 'aria-label': t('composer.gradients.' + key), style: { background: `linear-gradient(135deg, ${c1}, ${c2})` } });
    b.addEventListener('click', () => {
      state.gradient = key;
      state.bg = 'gradient';
      syncBg();
      redraw();
    });
    gradientBtns[key] = b;
    gradientGrid.appendChild(b);
  }

  const photoName = el('span.photo-name.muted', t('composer.photoHint'));
  const photoBtn = button({ label: t('composer.choosePhoto'), icon: 'upload', variant: 'secondary', small: true });
  const photoRemove = button({ label: t('composer.removePhoto'), icon: 'x', variant: 'ghost', small: true });
  const photoInput = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', style: { display: 'none' } });
  photoBtn.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files && photoInput.files[0];
    photoInput.value = '';
    if (!file) return;
    if (!isImageFile(file)) {
      toast(t('common.notAnImage', { name: file.name }), 'error');
      return;
    }
    try {
      state.photo = await loadImageFile(file);
      state.photoName = file.name;
      state.bg = 'photo';
      if (state.overlay < 30) state.overlay = 35;
      overlaySlider.value = String(state.overlay);
      overlayValue.textContent = state.overlay + ' %';
      syncBg();
      redraw();
    } catch {
      toast(t('common.notAnImage', { name: file.name }), 'error');
    }
  });
  photoRemove.addEventListener('click', () => {
    state.photo = null;
    state.photoName = '';
    state.bg = 'gradient';
    syncBg();
    redraw();
  });
  const photoRow = el('div.photo-row', photoBtn, photoRemove, photoInput);

  function syncBg() {
    for (const [k, b] of Object.entries(bgBtns)) b.classList.toggle('is-active', state.bg === k);
    for (const [k, b] of Object.entries(gradientBtns)) b.classList.toggle('is-active', state.gradient === k && state.bg === 'gradient');
    gradientGrid.style.display = state.bg === 'gradient' ? '' : 'none';
    photoRow.style.display = state.bg === 'photo' ? '' : 'none';
    photoName.style.display = state.bg === 'photo' ? '' : 'none';
    photoRemove.style.display = state.photo ? '' : 'none';
    photoName.textContent = state.photoName || t('composer.photoHint');
    if (state.bg === 'photo' && !state.photo) {
      // No photo yet: prompt directly.
      photoInput.click();
    }
  }

  const overlayValue = el('span.slider-value', state.overlay + ' %');
  const overlaySlider = el('input.slider', { type: 'range', min: 0, max: 70, step: 1, value: state.overlay });
  overlaySlider.addEventListener('input', () => {
    state.overlay = Number(overlaySlider.value);
    overlayValue.textContent = state.overlay + ' %';
    redraw();
  });

  const layoutSel = select(
    ['bottomLeft', 'center', 'topLeft'].map((k) => ({ value: k, label: t('composer.layouts.' + k) })),
    { value: state.layout },
  );
  layoutSel.addEventListener('change', () => {
    state.layout = layoutSel.value;
    redraw();
  });

  const langSel = select(
    [
      { value: 'tr', label: 'TR' },
      { value: 'en', label: 'EN' },
    ],
    { value: state.lang },
  );
  langSel.addEventListener('change', () => {
    state.lang = langSel.value;
    const other = state.lang === 'tr' ? 'en' : 'tr';
    state.title = (title[state.lang] || title[other] || '').trim();
    state.subtitle = (subtitle[state.lang] || '').trim();
    titleTa.value = state.title;
    subtitleIn.value = state.subtitle;
    if (titleTa._fit) titleTa._fit();
    redraw();
  });

  const titleTa = textarea({ value: state.title, rows: 2, placeholder: t('composer.titlePlaceholder') });
  titleTa.addEventListener('input', () => {
    state.title = titleTa.value;
    redraw();
  });
  const subtitleIn = input({ value: state.subtitle, placeholder: t('composer.subtitlePlaceholder') });
  subtitleIn.addEventListener('input', () => {
    state.subtitle = subtitleIn.value;
    redraw();
  });

  const colorSeg = el('div.seg');
  const colorBtns = {};
  for (const key of ['white', 'dark']) {
    const b = el('button.seg-btn', { type: 'button' }, el('span.color-dot', { style: { background: key === 'white' ? '#fff' : '#0F172A' } }), t('composer.' + key));
    b.addEventListener('click', () => {
      state.textColor = key;
      for (const [k, bb] of Object.entries(colorBtns)) bb.classList.toggle('is-active', k === key);
      redraw();
    });
    colorBtns[key] = b;
    colorSeg.appendChild(b);
  }
  colorBtns.white.classList.add('is-active');

  const sizeValue = el('span.slider-value', state.fontSize + ' px');
  const sizeSlider = el('input.slider', { type: 'range', min: 36, max: 110, step: 2, value: state.fontSize });
  sizeSlider.addEventListener('input', () => {
    state.fontSize = Number(sizeSlider.value);
    sizeValue.textContent = state.fontSize + ' px';
    redraw();
  });

  const toggle = (key, label) => {
    const cb = el('input', { type: 'checkbox', checked: state[key] });
    cb.addEventListener('change', () => {
      state[key] = cb.checked;
      redraw();
    });
    return el('label.check', cb, el('span', label));
  };

  const controls = el(
    'div.composer-controls',
    el('h3.composer-group', t('composer.background')),
    bgChoice,
    gradientGrid,
    photoRow,
    photoName,
    field({ label: t('composer.overlay'), control: el('div.slider-row', overlaySlider, overlayValue) }),
    el('h3.composer-group', t('composer.textGroup')),
    el('div.row-2', field({ label: t('composer.language'), control: langSel }), field({ label: t('composer.layout'), control: layoutSel })),
    field({ label: t('composer.titleText'), control: titleTa }),
    field({ label: t('composer.subtitleText'), control: subtitleIn }),
    el('h3.composer-group', t('composer.styleGroup')),
    field({ label: t('composer.textColor'), control: colorSeg }),
    field({ label: t('composer.fontSize'), control: el('div.slider-row', sizeSlider, sizeValue) }),
    el('div.check-row', toggle('brandTag', t('composer.brandTag')), toggle('ring', t('composer.ring'))),
  );

  const stage = el('div.composer-stage', el('div.composer-canvas-wrap', canvas), el('p.muted.small', t('composer.subtitle')));
  const content = el('div.composer-layout', stage, controls);

  const toBlob = () =>
    new Promise((resolve, reject) => {
      renderCover(ctx, state);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/png');
    });

  const fileBase = () => 'cover-' + (slugify(slug) || slugify(state.title) || 'phibio') + '.png';

  const downloadBtn = button({ label: t('composer.downloadPng'), icon: 'download', variant: 'secondary' });
  downloadBtn.addEventListener('click', () =>
    withBusy(downloadBtn, t('composer.working'), async () => {
      const blob = await toBlob();
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: fileBase() });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }),
  );
  const useBtn = button({ label: t('composer.useAsCover'), icon: 'check', variant: 'primary', id: 'composer-use' });
  useBtn.addEventListener('click', () =>
    withBusy(useBtn, t('composer.working'), async () => {
      try {
        const blob = await toBlob();
        const file = new File([blob], fileBase(), { type: 'image/png' });
        const media = await upload(file, { altTr: title.tr || state.title, altEn: title.en || state.title, fileName: fileBase() });
        const ref = imageRef(media);
        modal.close('done');
        toast(t('composer.done'), 'success');
        if (onDone) onDone(ref, media);
      } catch (err) {
        toast(errorMessage(err), 'error');
      }
    }),
  );
  const cancelBtn = button({ label: t('common.cancel'), variant: 'ghost', onClick: () => modal.close() });

  const modal = openModal({
    title: t('composer.title'),
    content,
    width: 1060,
    className: 'modal-composer',
    footer: [cancelBtn, el('span.spacer'), downloadBtn, useBtn],
  });
  clear(modal.body);
  modal.body.appendChild(content);
  syncBgInitial();
  redraw();
  setTimeout(() => titleTa.focus(), 50);

  function syncBgInitial() {
    for (const [k, b] of Object.entries(bgBtns)) b.classList.toggle('is-active', state.bg === k);
    for (const [k, b] of Object.entries(gradientBtns)) b.classList.toggle('is-active', state.gradient === k);
    photoRow.style.display = 'none';
    photoName.style.display = 'none';
    photoRemove.style.display = 'none';
  }
  return modal;
}
