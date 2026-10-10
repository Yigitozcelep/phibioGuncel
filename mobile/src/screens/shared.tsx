import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useContent } from '../api/store';
import type { Bundle } from '../api/types';
import { ErrorState, OfflineBanner } from '../components';
import { useT } from '../i18n';
import { colors, spacing } from '../theme';

/** Shows the offline banner when cached data is displayed after a failed refresh. */
export function OfflineNotice() {
  const { isOffline, refresh, refreshing } = useContent();
  if (!isOffline) return null;
  return <OfflineBanner onRetry={() => void refresh()} retrying={refreshing} />;
}

interface GateProps {
  skeleton: React.ReactNode;
  children: (bundle: Bundle) => React.ReactNode;
}

/**
 * Renders the skeleton until the bundle is known, a retryable error when the
 * very first load failed, and otherwise the content.
 */
export function ContentGate({ skeleton, children }: GateProps) {
  const { bundle, status, error, refresh, refreshing } = useContent();
  const t = useT();
  if (bundle) return <>{children(bundle)}</>;
  if (status === 'error') {
    return (
      <View style={styles.fill}>
        <ErrorState
          error={error}
          message={error?.kind === 'network' ? t.errors.noCache : undefined}
          onRetry={() => void refresh()}
          retrying={refreshing}
        />
      </View>
    );
  }
  return <View style={styles.fill}>{skeleton}</View>;
}

/** Pull-to-refresh control bound to the content store. */
export function useRefreshControl(): React.ReactElement<RefreshControlProps> {
  const { bundle, refreshing, refresh } = useContent();
  return (
    <RefreshControl
      refreshing={refreshing && bundle !== null}
      onRefresh={() => void refresh()}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.white}
    />
  );
}

interface ScreenScrollProps {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refresh?: boolean;
}

/** Vertical scroll container with optional pull-to-refresh. */
export function ScreenScroll({ children, contentStyle, refresh = false }: ScreenScrollProps) {
  const refreshControl = useRefreshControl();
  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      refreshControl={refresh ? refreshControl : undefined}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
    >
      {children}
    </ScrollView>
  );
}

export const screenStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    paddingVertical: spacing.xl,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
});

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
});
