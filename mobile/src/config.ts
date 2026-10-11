/**
 * Runtime configuration. `EXPO_PUBLIC_*` variables are inlined by Metro at
 * bundle time (see `.env`), so a rebuild is needed after changing them.
 */

const DEFAULT_API_URL = 'http://localhost:8080';

function normaliseBaseUrl(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return DEFAULT_API_URL;
  return trimmed.replace(/\/+$/, '');
}

/** Base URL of the Phibio backend, without a trailing slash. */
export const API_URL: string = normaliseBaseUrl(process.env.EXPO_PUBLIC_API_URL);

/** Network timeout for a single API request, in milliseconds. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** AsyncStorage keys. Bump the bundle key when the cached shape changes. */
export const STORAGE_KEYS = {
  language: 'phibio.lang',
  bundle: 'phibio.bundle.v1',
} as const;

/** Number of news summaries requested per "load more" page. */
export const NEWS_PAGE_SIZE = 20;

/** Maximum time the native splash screen stays up while the cache is read. */
export const SPLASH_MAX_WAIT_MS = 1_500;
