import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ApiError } from '../api/client';
import { useT, type Strings } from '../i18n';
import { colors, radii, spacing, TOUCH_TARGET, type } from '../theme';
import { Button } from './Button';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Translated message for an API error. */
export function errorMessage(error: ApiError | null | undefined, t: Strings): string {
  if (!error) return t.errors.unknown;
  switch (error.kind) {
    case 'network':
      return t.errors.network;
    case 'timeout':
      return t.errors.timeout;
    case 'notFound':
      return t.errors.notFound;
    case 'server':
    case 'parse':
      return t.errors.server;
    default:
      return t.errors.unknown;
  }
}

interface ErrorStateProps {
  error?: ApiError | null;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}

export function ErrorState({ error, message, onRetry, retrying = false, compact = false }: ErrorStateProps) {
  const t = useT();
  return (
    <View style={[styles.state, compact && styles.stateCompact]} accessibilityRole="alert">
      <View style={[styles.iconCircle, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
      </View>
      <Text style={styles.title}>{t.errors.title}</Text>
      <Text style={styles.message}>{message ?? errorMessage(error, t)}</Text>
      {onRetry && <Button label={t.common.retry} icon="refresh" onPress={onRetry} loading={retrying} />}
    </View>
  );
}

interface EmptyStateProps {
  title: string;
  hint?: string;
  icon?: IconName;
  compact?: boolean;
}

export function EmptyState({ title, hint, icon = 'file-tray-outline', compact = false }: EmptyStateProps) {
  return (
    <View style={[styles.state, compact && styles.stateCompact]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.message}>{hint}</Text> : null}
    </View>
  );
}

interface OfflineBannerProps {
  onRetry: () => void;
  retrying?: boolean;
}

/** Shown above content when cached data is displayed after a failed refresh. */
export function OfflineBanner({ onRetry, retrying = false }: OfflineBannerProps) {
  const t = useT();
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={20} color={colors.warning} />
      <Text style={styles.bannerText}>{t.offline.banner}</Text>
      <Pressable
        onPress={onRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityLabel={t.offline.retry}
        hitSlop={6}
        style={({ pressed }) => [styles.bannerButton, pressed && styles.pressed]}
      >
        <Text style={styles.bannerButtonText}>{t.offline.retry}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
    gap: spacing.md,
    minHeight: 280,
  },
  stateCompact: {
    minHeight: 0,
    padding: spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
  },
  title: {
    ...type.h3,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...type.small,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 320,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bannerText: {
    ...type.caption,
    color: colors.warning,
    flex: 1,
  },
  bannerButton: {
    minHeight: 32,
    minWidth: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(180, 83, 9, 0.12)',
  },
  bannerButtonText: {
    ...type.caption,
    color: colors.warning,
  },
  pressed: {
    opacity: 0.7,
  },
});
