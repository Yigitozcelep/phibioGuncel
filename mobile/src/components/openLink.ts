import { Alert, Linking } from 'react-native';

import type { Strings } from '../i18n';

/**
 * Opens an external URL (https, mailto, tel, maps…). `canOpenURL` can report
 * false negatives on Android 11+ (package visibility), so a failed check still
 * attempts `openURL`; only a real failure shows the translated alert.
 */
export async function openExternal(url: string, t: Strings): Promise<boolean> {
  const target = url.trim();
  if (!target) {
    Alert.alert(t.errors.cannotOpenLinkTitle, t.errors.cannotOpenLink);
    return false;
  }
  const supported = await Linking.canOpenURL(target).catch(() => false);
  try {
    await Linking.openURL(target);
    return true;
  } catch {
    // `supported === false` here is a genuine "no handler"; `true` means the
    // handler itself failed. Both end the same way for the user.
    Alert.alert(t.errors.cannotOpenLinkTitle, supported ? t.errors.unknown : t.errors.cannotOpenLink);
    return false;
  }
}

export function mailto(email: string, subject?: string): string {
  const base = `mailto:${email.trim()}`;
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
}

export function tel(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** Map URL from the site settings, or a maps search built from the address. */
export function mapsUrl(mapUrl: string, addressLines: string[]): string {
  if (mapUrl.trim()) return mapUrl.trim();
  const query = addressLines.map((l) => l.trim()).filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Website for display: strips protocol and trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}
