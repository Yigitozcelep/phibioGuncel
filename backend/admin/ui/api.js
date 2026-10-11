// Thin fetch wrapper for /api/admin (docs/API.md). Same-origin cookies,
// the CSRF header on mutating requests, X-Lang so the server answers with
// error messages in the panel's language, and a 401 → login redirect.

import { getLang, t } from './i18n.js';

export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_VALUE = 'phibio-admin';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'internal';
  }
}

const unauthorizedListeners = new Set();

/** Register a callback that runs whenever the API answers 401. */
export function onUnauthorized(fn) {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

function notifyUnauthorized() {
  unauthorizedListeners.forEach((fn) => fn());
}

/** Human-readable text for any error thrown by this module. */
export function errorMessage(err) {
  if (err instanceof ApiError) {
    if (err.message) return err.message;
    return t('errors.' + err.code) || t('common.unexpectedError');
  }
  if (err instanceof TypeError) return t('common.networkError');
  return (err && err.message) || t('common.unexpectedError');
}

async function parseError(res) {
  let code = 'internal';
  let message = '';
  try {
    const data = await res.json();
    if (data && typeof data === 'object') {
      code = data.code || code;
      message = data.error || '';
    }
  } catch {
    /* non-JSON body */
  }
  if (!message) message = t('errors.' + code) || res.statusText;
  return new ApiError(res.status, code, message);
}

export async function request(method, path, body, options = {}) {
  const headers = { Accept: 'application/json', 'X-Lang': getLang() };
  if (method !== 'GET' && method !== 'HEAD') headers[CSRF_HEADER] = CSRF_VALUE;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
    payload = JSON.stringify(body);
  }
  const res = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' });
  if (res.status === 401 && !options.noRedirect) {
    const err = await parseError(res);
    notifyUnauthorized();
    throw err;
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

export const get = (path, options) => request('GET', path, undefined, options);
export const post = (path, body, options) => request('POST', path, body, options);
export const put = (path, body, options) => request('PUT', path, body, options);
export const del = (path, options) => request('DELETE', path, undefined, options);

/**
 * Upload one image via multipart with progress reporting (XHR, because fetch
 * has no upload progress). Resolves with the MediaResolved object.
 */
export function upload(file, { altTr = '', altEn = '', onProgress, fileName } = {}) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file, fileName || file.name || 'upload.png');
    if (altTr) form.append('altTr', altTr);
    if (altEn) form.append('altEn', altEn);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/media');
    xhr.withCredentials = true;
    xhr.setRequestHeader(CSRF_HEADER, CSRF_VALUE);
    xhr.setRequestHeader('X-Lang', getLang());
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.responseType = 'text';
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }
    xhr.addEventListener('load', () => {
      let data = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve(data);
        return;
      }
      const code = (data && data.code) || 'internal';
      const message = (data && data.error) || t('errors.' + code);
      if (xhr.status === 401) notifyUnauthorized();
      reject(new ApiError(xhr.status, code, message));
    });
    xhr.addEventListener('error', () => reject(new TypeError('network')));
    xhr.addEventListener('abort', () => reject(new ApiError(0, 'internal', t('common.unexpectedError'))));
    xhr.send(form);
  });
}

/** Download a JSON export with the session cookie and trigger a save dialog. */
export async function downloadExport() {
  const res = await fetch('/api/admin/export', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'X-Lang': getLang() },
  });
  if (res.status === 401) {
    const err = await parseError(res);
    notifyUnauthorized();
    throw err;
  }
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  let name = 'phibio-backup.json';
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename="?([^";]+)"?/.exec(cd);
  if (m) name = m[1];
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return name;
}
