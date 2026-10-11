import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, TOUCH_TARGET, type } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Rendered on a dark/teal background. */
  onDark?: boolean;
}

export function SectionHeader({ title, subtitle, actionLabel, onAction, onDark = false }: Props) {
  const titleColor = onDark ? colors.white : colors.text;
  const subColor = onDark ? 'rgba(255,255,255,0.8)' : colors.muted;
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: titleColor }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[styles.subtitle, { color: subColor }]}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          accessibilityRole="link"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={[styles.actionText, onDark && { color: colors.white }]}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={16} color={onDark ? colors.white : colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...type.h2,
  },
  subtitle: {
    ...type.small,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET - 8,
    paddingLeft: spacing.sm,
  },
  actionText: {
    ...type.bodyStrong,
    fontSize: 14,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
