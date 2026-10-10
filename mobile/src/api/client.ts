import { API_URL, NEWS_PAGE_SIZE, REQUEST_TIMEOUT_MS } from '../config';
import type { ApiErrorBody, Bundle, News, NewsPage, Product, SiteSettings } from './types';

export type ApiErrorKind = 'network' | 'timeout' | 'notFound' | 'server' | 'parse' | 'unknown';

/** Typed error so screens can pick a translated message by `kind`. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string | null;

  constructor(kind: ApiErrorKind, message: string, status: number | null = null, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) {
    if (error.name === 'AbortError') return new ApiError('timeout', error.message);
    if (/network request failed|failed to fetch|network error/i.test(error.message)) {
      return new ApiError('network', error.message);
    }
    return new ApiError('unknown', error.message);
  }
  return new ApiError('unknown', String(error));
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { error?: unknown }).error === 'string' &&
    typeof (value as { code?: unknown }).code === 'string'
  );
}

async function request<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    const apiError = toApiError(error);
    // A fetch that fails before any response is almost always connectivity.
    throw apiError.kind === 'unknown' ? new ApiError('network', apiError.message) : apiError;
  }
  clearTimeout(timer);

  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    throw new ApiError('network', toApiError(error).message, response.status);
  }

  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      if (response.ok) throw new ApiError('parse', 'Invalid JSON in response', response.status);
    }
  }

  if (!response.ok) {
    const code = isApiErrorBody(body) ? body.code : null;
    const message = isApiErrorBody(body) ? body.error : `HTTP ${response.status}`;
    const kind: ApiErrorKind = response.status === 404 ? 'notFound' : 'server';
    throw new ApiError(kind, message, response.status, code);
  }
  if (body === null) throw new ApiError('parse', 'Empty response', response.status);
  return body as T;
}

export const api = {
  bundle: () => request<Bundle>('/api/v1/bundle'),
  site: () => request<SiteSettings>('/api/v1/site'),
  products: (area?: string) =>
    request<Product[]>(`/api/v1/products${area ? `?area=${encodeURIComponent(area)}` : ''}`),
  product: (slug: string) => request<Product>(`/api/v1/products/${encodeURIComponent(slug)}`),
  newsPage: (offset: number, limit: number = NEWS_PAGE_SIZE, category?: string) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (category) params.set('category', category);
    return request<NewsPage>(`/api/v1/news?${params.toString()}`);
  },
  news: (slug: string) => request<News>(`/api/v1/news/${encodeURIComponent(slug)}`),
};
