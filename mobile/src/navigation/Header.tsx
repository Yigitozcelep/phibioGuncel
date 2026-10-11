import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLang, useT } from '../i18n';
import { colors, HEADER_HEIGHT, radii, spacing, TOUCH_TARGET, type } from '../theme';
import { useNavigation } from './context';

interface Props {
  title: string;
  /** Show a back button (detail screens). */
  back?: boolean;
  /** Extra element rendered right of the title, before the language toggle. */
  right?: React.ReactNode;
  /** Hide the TR/EN pill. */
  hideLanguage?: boolean;
}

export function LanguageToggle({ onDark = true }: { onDark?: boolean }) {
  const { lang, setLang } = useLang();
  const t = useT();
  const pillBg = onDark ? 'rgba(255,255,255,0.18)' : colors.mint;
  return (
    <View
      style={[styles.pill, { backgroundColor: pillBg }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={t.language.toggleLabel}
    >
      {(['tr', 'en'] as const).map((code) => {
        const active = lang === code;
        return (
          <Pressable
            key={code}
            onPress={() => setLang(code)}
            testID={`lang-${code}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, selected: active }}
            accessibilityLabel={code === 'tr' ? 'Türkçe' : 'English'}
            hitSlop={6}
            style={({ pressed }) => [
              styles.pillItem,
              active && (onDark ? styles.pillItemActiveDark : styles.pillItemActiveLight),
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: active ? (onDark ? colors.primary : colors.white) : onDark ? colors.white : colors.primaryDark },
              ]}
            >
              {t.language[code]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Header({ title, back = false, right, hideLanguage = false }: Props) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const t = useT();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {back ? (
          <Pressable
            onPress={() => nav.pop()}
            testID="header-back"
            accessibilityRole="button"
            accessibilityLabel={t.common.back}
            hitSlop={8}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </Pressable>
        ) : (
          <View style={styles.brandMark} accessible={false}>
            <Text style={styles.brandText}>Φ</Text>
          </View>
        )}
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {right}
        {!hideLanguage && <LanguageToggle />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
  },
  row: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  iconButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMark: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '800',
  },
  title: {
    ...type.h3,
    fontSize: 18,
    color: colors.white,
    flex: 1,
  },
  pill: {
    flexDirection: 'row',
    borderRadius: radii.pill,
    padding: 3,
    marginLeft: spacing.xs,
  },
  pillItem: {
    minWidth: 38,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  pillItemActiveDark: {
    backgroundColor: colors.white,
  },
  pillItemActiveLight: {
    backgroundColor: colors.primary,
  },
  pillText: {
    ...type.label,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});
