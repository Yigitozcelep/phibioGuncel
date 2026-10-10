import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useT } from '../i18n';
import { areaColor, colors, radii, spacing, type } from '../theme';

interface Props {
  label: string;
  color?: string;
  /** Solid background instead of tinted. */
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}

function tint(hex: string): string {
  // Expand #RGB / #RRGGBB to an rgba with low alpha.
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return colors.mint;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.14)`;
}

export function Badge({ label, color = colors.primary, solid = false, style }: Props) {
  return (
    <View
      style={[styles.badge, { backgroundColor: solid ? color : tint(color) }, style]}
      accessibilityRole="text"
    >
      <Text style={[styles.text, { color: solid ? colors.white : color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Badge for a product/area key, with translated name and area colour. */
export function AreaBadge({ area, name, solid, style }: { area: string; name?: string; solid?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const label = name && name.trim() ? name : (t.products.areaNames[area] ?? area);
  return <Badge label={label} color={areaColor(area)} solid={solid} style={style} />;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    maxWidth: '100%',
  },
  text: {
    ...type.label,
    textTransform: 'uppercase',
  },
});
