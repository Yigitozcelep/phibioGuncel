import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { Lang, LocalizedString } from '../api/types';
import { STORAGE_KEYS } from '../config';
import { en, type Strings } from './en';
import { tr } from './tr';

export type { Strings } from './en';

const STRINGS: Record<Lang, Strings> = { tr, en };

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  /** True once the persisted choice (or the device default) has been resolved. */
  ready: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLang(value: unknown): value is Lang {
  return value === 'tr' || value === 'en';
}

/** Device language on first launch: Turkish devices get TR, everyone else EN. */
export function detectDeviceLang(): Lang {
  try {
    const code = getLocales()[0]?.languageCode;
    return code && code.toLowerCase().startsWith('tr') ? 'tr' : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectDeviceLang);
  const [ready, setReady] = useState(false);
  const userChoiceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEYS.language)
      .then((stored) => {
        if (cancelled) return;
        // A toggle made before the read resolved wins over the stored value.
        if (isLang(stored) && !userChoiceRef.current) setLangState(stored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    userChoiceRef.current = true;
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEYS.language, next).catch(() => undefined);
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'tr' ? 'en' : 'tr');
  }, [lang, setLang]);

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, toggleLang, ready }),
    [lang, setLang, toggleLang, ready],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function useLanguageContext(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>');
  return ctx;
}

/** Active language and the setters. */
export function useLang(): LanguageContextValue {
  return useLanguageContext();
}

/** UI strings for the active language. */
export function useT(): Strings {
  return STRINGS[useLanguageContext().lang];
}

/**
 * Picks the active language from a LocalizedString, falling back to the other
 * language and finally to an empty string (ARCHITECTURE.md §3).
 */
export function L(ls: LocalizedString | null | undefined, lang: Lang): string {
  if (!ls) return '';
  const primary = (ls[lang] ?? '').trim();
  if (primary) return primary;
  const other: Lang = lang === 'tr' ? 'en' : 'tr';
  return (ls[other] ?? '').trim();
}

/** `L` bound to the active language. */
export function useL(): (ls: LocalizedString | null | undefined) => string {
  const { lang } = useLanguageContext();
  return useCallback((ls: LocalizedString | null | undefined) => L(ls, lang), [lang]);
}

const INTL_LOCALE: Record<Lang, string> = { tr: 'tr-TR', en: 'en-GB' };

/**
 * Upper-cases a label for the active language. CSS/`textTransform` upper-casing
 * is locale-blind and turns Turkish "i" into "I" ("Ortopedi" → "ORTOPEDI");
 * the Turkish rule needs "İ" ("ORTOPEDİ").
 */
export function upper(text: string, lang: Lang): string {
  try {
    return text.toLocaleUpperCase(INTL_LOCALE[lang]);
  } catch {
    return text.toUpperCase();
  }
}

/** `upper` bound to the active language. */
export function useUpper(): (text: string) => string {
  const { lang } = useLanguageContext();
  return useCallback((text: string) => upper(text, lang), [lang]);
}
const formatterCache: Partial<Record<Lang, Intl.DateTimeFormat | null>> = {};

function getFormatter(lang: Lang): Intl.DateTimeFormat | null {
  if (lang in formatterCache) return formatterCache[lang] ?? null;
  let formatter: Intl.DateTimeFormat | null = null;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
      formatter = new Intl.DateTimeFormat(INTL_LOCALE[lang], {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
  } catch {
    formatter = null;
  }
  formatterCache[lang] = formatter;
  return formatter;
}

/** Formats an RFC 3339 timestamp as a long date ("10 Ekim 2026" / "10 October 2026"). */
export function formatDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const formatter = getFormatter(lang);
  if (formatter) {
    try {
      return formatter.format(date);
    } catch {
      // fall through to the manual format
    }
  }
  const strings = STRINGS[lang];
  const month = strings.date.months[date.getMonth()] ?? '';
  return strings.date.format(date.getDate(), month, date.getFullYear());
}

/** `formatDate` bound to the active language. */
export function useFormatDate(): (iso: string | null | undefined) => string {
  const { lang } = useLanguageContext();
  return useCallback((iso: string | null | undefined) => formatDate(iso, lang), [lang]);
}
