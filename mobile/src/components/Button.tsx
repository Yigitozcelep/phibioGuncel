import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, TOUCH_TARGET, type } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  label: string;
  onPress: () => void;
  /** `ghostLight` is the transparent variant for dark/teal backgrounds. */
  variant?: 'primary' | 'outline' | 'ghost' | 'ghostLight' | 'light';
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  /** Full-width block button. */
  block?: boolean;
  small?: boolean;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  block = false,
  small = false,
  testID,
}: Props) {
  const textColor =
    variant === 'primary' || variant === 'ghostLight'
      ? colors.white
      : variant === 'light'
        ? colors.primaryDark
        : colors.primary;
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        (variant === 'ghost' || variant === 'ghostLight') && styles.ghost,
        variant === 'light' && styles.light,
        small && styles.small,
        block && styles.block,
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={textColor} />}
          <Text style={[styles.label, small && styles.labelSmall, { color: textColor }]} numberOfLines={2}>
            {label}
          </Text>
          {iconRight && <Ionicons name={iconRight} size={small ? 16 : 18} color={textColor} />}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignSelf: 'flex-start',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.sm,
  },
  light: {
    backgroundColor: colors.mint,
  },
  small: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  block: {
    alignSelf: 'stretch',
  },
  label: {
    ...type.bodyStrong,
    textAlign: 'center',
    flexShrink: 1,
  },
  labelSmall: {
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.55,
  },
});
