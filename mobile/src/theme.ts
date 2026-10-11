import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/** Brand palette (ARCHITECTURE.md §7). Light theme only. */
export const colors = {
  primary: '#0E7C86',
  primaryDark: '#0A5C63',
  primarySoft: '#D6EBEA',
  mint: '#E8F4F2',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  white: '#FFFFFF',
  black: '#000000',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  overlay: 'rgba(5, 32, 36, 0.55)',
  overlayLight: 'rgba(5, 32, 36, 0.25)',
  skeleton: '#E9EEF2',
  areas: {
    orthopaedics: '#2563EB',
    ophthalmology: '#0E7C86',
    dermatology: '#DB2777',
  },
} as const;

export type AreaKey = keyof typeof colors.areas;

export const AREA_KEYS: readonly AreaKey[] = ['orthopaedics', 'ophthalmology', 'dermatology'];

export function isAreaKey(value: string): value is AreaKey {
  return (AREA_KEYS as readonly string[]).includes(value);
}

/** Colour for an area badge; unknown keys fall back to the primary teal. */
export function areaColor(key: string): string {
  return isAreaKey(key) ? colors.areas[key] : colors.primary;
}

/** Spacing scale in points. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/** Type scale. Line heights keep long Turkish words readable. */
export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' } satisfies TextStyle,
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '800' } satisfies TextStyle,
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '700' } satisfies TextStyle,
  h3: { fontSize: 17, lineHeight: 22, fontWeight: '700' } satisfies TextStyle,
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' } satisfies TextStyle,
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' } satisfies TextStyle,
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' } satisfies TextStyle,
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' } satisfies TextStyle,
  label: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.6 } satisfies TextStyle,
} as const;

/** Shadows (iOS) with Android elevation equivalents. */
export const shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }) as ViewStyle,
  raised: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.14,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 6 },
    default: {},
  }) as ViewStyle,
} as const;

/**
 * `useNativeDriver` for Animated: true on iOS/Android; the web renderer has
 * no native animated module and would log a warning for every animation.
 */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Minimum touch-target size (Apple HIG / Material). */
export const TOUCH_TARGET = 44;

/** Height of the bottom tab bar, excluding the safe-area inset. */
export const TAB_BAR_HEIGHT = 56;

/** Height of the screen header, excluding the status-bar inset. */
export const HEADER_HEIGHT = 56;
