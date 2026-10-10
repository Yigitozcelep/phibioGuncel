import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing, TOUCH_TARGET, type } from '../theme';

export interface ChipOption<K extends string> {
  key: K;
  label: string;
  color?: string;
}

interface Props<K extends string> {
  options: ChipOption<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
}

/** Horizontal scrollable filter chips (single select). */
export function Chips<K extends string>({ options, value, onChange, accessibilityLabel }: Props<K>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((opt) => {
        const active = opt.key === value;
        const color = opt.color ?? colors.primary;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, selected: active }}
            accessibilityLabel={opt.label}
            style={({ pressed }) => [
              styles.chip,
              active ? { backgroundColor: color, borderColor: color } : null,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, { color: active ? colors.white : colors.text }]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    minHeight: TOUCH_TARGET - 6,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    ...type.small,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
