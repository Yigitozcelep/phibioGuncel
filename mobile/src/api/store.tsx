import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { NEWS_PAGE_SIZE, STORAGE_KEYS } from '../config';
import { api, ApiError, toApiError } from './client';
import type { Bundle, CachedBundle, News, NewsSummary, Product } from './types';

export type ContentStatus = 'loading' | 'ready' | 'error';

interface ContentContextValue {
  bundle: Bundle | null;
  /** `loading` until either the cache or the network produced a bundle. */
  status: ContentStatus;
  /** True while a refresh is in flight (also during the very first fetch). */
  refreshing: boolean;
  /** Last error from the network, or null. */
  error: ApiError | null;
  /** True when cached data is shown because the last refresh failed. */
  isOffline: boolean;
  /** When the displayed bundle was fetched (ISO), or null. */
  fetchedAt: string | null;
  /** True once the cache has been read (used to hide the splash screen). */
  cacheChecked: boolean;
  refresh: () => Promise<void>;
  /** All news summaries known so far: bundle news plus "load more" pages. */
  newsList: NewsSummary[];
  newsTotal: number;
  loadingMore: boolean;
  loadMoreError: ApiError | null;
  hasMoreNews: boolean;
  loadMoreNews: () => Promise<void>;
  getNews: (slug: string) => Promise<News>;
}

const ContentContext = createContext<ContentContextValue | null>(null);

function isBundle(value: unknown): value is Bundle {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<Bundle>;
  return (
    typeof v.site === 'object' &&
    v.site !== null &&
    Array.isArray(v.products) &&
    Array.isArray(v.news) &&
    typeof v.newsTotal === 'number'
  );
}

function isCachedBundle(value: unknown): value is CachedBundle {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<CachedBundle>;
  return typeof v.fetchedAt === 'string' && isBundle(v.bundle);
}

async function readCachedBundle(): Promise<CachedBundle | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.bundle);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCachedBundle(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCachedBundle(cached: CachedBundle): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.bundle, JSON.stringify(cached));
  } catch {
    // Cache is best effort; the app keeps working from memory.
  }
}

function mergeNews(base: NewsSummary[], extra: NewsSummary[]): NewsSummary[] {
  const seen = new Set(base.map((n) => n.id));
  const merged = [...base];
  for (const item of extra) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const [extraNews, setExtraNews] = useState<NewsSummary[]>([]);
  const [newsTotalOverride, setNewsTotalOverride] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<ApiError | null>(null);

  const bundleRef = useRef<Bundle | null>(null);
  const refreshPromise = useRef<Promise<void> | null>(null);
  const loadMorePromise = useRef<Promise<void> | null>(null);
  const newsCache = useRef(new Map<string, News>());
  const newsInflight = useRef(new Map<string, Promise<News>>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applyBundle = useCallback((next: Bundle, at: string) => {
    bundleRef.current = next;
    setBundle(next);
    setFetchedAt(at);
  }, []);

  const refresh = useCallback((): Promise<void> => {
    newsCache.current.clear(); // detail screens must not keep stale articles after a refresh
    if (refreshPromise.current) return refreshPromise.current;
    const run = (async () => {
      setRefreshing(true);
      try {
        const fresh = await api.bundle();
        if (!isBundle(fresh)) throw new ApiError('parse', 'Unexpected bundle shape');
        const at = new Date().toISOString();
        if (!mounted.current) return;
        applyBundle(fresh, at);
        setError(null);
        setIsOffline(false);
        // The bundle carries the newest 20; drop stale "load more" pages so
        // the list is consistent with the fresh total.
        setExtraNews([]);
        setNewsTotalOverride(null);
        void writeCachedBundle({ bundle: fresh, fetchedAt: at });
      } catch (err) {
        if (!mounted.current) return;
        const apiError = toApiError(err);
        setError(apiError);
        setIsOffline(bundleRef.current !== null);
      } finally {
        if (mounted.current) setRefreshing(false);
        refreshPromise.current = null;
      }
    })();
    refreshPromise.current = run;
    return run;
  }, [applyBundle]);

  // Cold start: cache first (instant paint), then the network.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await readCachedBundle();
      if (cancelled) return;
      if (cached) applyBundle(cached.bundle, cached.fetchedAt);
      setCacheChecked(true);
      void refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [applyBundle, refresh]);

  const newsList = useMemo(
    () => (bundle ? mergeNews(bundle.news, extraNews) : extraNews),
    [bundle, extraNews],
  );
  const newsTotal = newsTotalOverride ?? bundle?.newsTotal ?? 0;
  const hasMoreNews = newsList.length < newsTotal;

  const loadMoreNews = useCallback((): Promise<void> => {
    if (loadMorePromise.current) return loadMorePromise.current;
    const run = (async () => {
      setLoadingMore(true);
      setLoadMoreError(null);
      try {
        const offset = newsList.length;
        const page = await api.newsPage(offset, NEWS_PAGE_SIZE);
        if (!mounted.current) return;
        setExtraNews((prev) => mergeNews(prev, page.items));
        setNewsTotalOverride(page.total);
      } catch (err) {
        if (mounted.current) setLoadMoreError(toApiError(err));
      } finally {
        if (mounted.current) setLoadingMore(false);
        loadMorePromise.current = null;
      }
    })();
    loadMorePromise.current = run;
    return run;
  }, [newsList.length]);

  const getNews = useCallback((slug: string): Promise<News> => {
    const cached = newsCache.current.get(slug);
    if (cached) return Promise.resolve(cached);
    const inflight = newsInflight.current.get(slug);
    if (inflight) return inflight;
    const promise = api
      .news(slug)
      .then((news) => {
        newsCache.current.set(slug, news);
        return news;
      })
      .finally(() => {
        newsInflight.current.delete(slug);
      });
    newsInflight.current.set(slug, promise);
    return promise;
  }, []);

  const status: ContentStatus = bundle ? 'ready' : error ? 'error' : 'loading';

  const value = useMemo<ContentContextValue>(
    () => ({
      bundle,
      status,
      refreshing,
      error,
      isOffline,
      fetchedAt,
      cacheChecked,
      refresh,
      newsList,
      newsTotal,
      loadingMore,
      loadMoreError,
      hasMoreNews,
      loadMoreNews,
      getNews,
    }),
    [
      bundle, status, refreshing, error, isOffline, fetchedAt, cacheChecked, refresh,
      newsList, newsTotal, loadingMore, loadMoreError, hasMoreNews, loadMoreNews, getNews,
    ],
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentContextValue {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used inside <ContentProvider>');
  return ctx;
}

/** A product from the bundle; `undefined` while the bundle is loading, `null` if unknown. */
export function useProduct(slug: string): Product | null | undefined {
  const { bundle } = useContent();
  return useMemo(() => {
    if (!bundle) return undefined;
    return bundle.products.find((p) => p.slug === slug) ?? null;
  }, [bundle, slug]);
}

export interface NewsDetailState {
  /** The summary from the list (available immediately when known). */
  summary: NewsSummary | null;
  news: News | null;
  status: 'loading' | 'ready' | 'error';
  error: ApiError | null;
  retry: () => void;
}

/** Full article: summary from the list immediately, blocks fetched on demand and cached. */
export function useNews(slug: string): NewsDetailState {
  const { newsList, getNews } = useContent();
  const summary = useMemo(() => newsList.find((n) => n.slug === slug) ?? null, [newsList, slug]);
  const [news, setNews] = useState<News | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getNews(slug)
      .then((result) => {
        if (!cancelled) setNews(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toApiError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [slug, attempt, getNews]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const status: NewsDetailState['status'] = news ? 'ready' : error ? 'error' : 'loading';
  return { summary, news, status, error, retry };
}
