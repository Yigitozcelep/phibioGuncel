import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '../i18n';
import { colors, spacing, TAB_BAR_HEIGHT, type } from '../theme';
import { TABS, type Tab } from './types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<Tab, { active: IconName; inactive: IconName }> = {
  home: { active: 'home', inactive: 'home-outline' },
  products: { active: 'cube', inactive: 'cube-outline' },
  news: { active: 'newspaper', inactive: 'newspaper-outline' },
  about: { active: 'information-circle', inactive: 'information-circle-outline' },
  contact: { active: 'mail', inactive: 'mail-outline' },
};

interface Props {
  activeTab: Tab;
  onPress: (tab: Tab) => void;
}

export function TabBar({ activeTab, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const t = useT();
  return (
    <View
      style={[styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}
      accessibilityRole="tablist"
    >
      {TABS.map((tab) => {
        const active = tab === activeTab;
        const color = active ? colors.primary : colors.muted;
        return (
          <Pressable
            key={tab}
            onPress={() => onPress(tab)}
            testID={`tab-${tab}`}
            accessibilityRole="tab"
            accessibilityLabel={t.tabs[tab]}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Ionicons name={active ? ICONS[tab].active : ICONS[tab].inactive} size={24} color={color} />
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {t.tabs[tab]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  item: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xxs,
  },
  label: {
    ...type.caption,
    fontSize: 11,
  },
  pressed: {
    opacity: 0.6,
  },
});
