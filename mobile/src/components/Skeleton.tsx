import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '../theme';

interface Props {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Pulsing grey block used while content loads. */
export function Skeleton({ width = '100%', height = 16, radius = radii.sm, style }: Props) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[styles.block, { width, height, borderRadius: radius, opacity }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Skeleton shaped like a list card with a cover image and two text lines. */
export function CardSkeleton({ count = 3, cover = true }: { count?: number; cover?: boolean }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.card}>
          {cover && <Skeleton height={150} radius={0} />}
          <View style={styles.cardBody}>
            <Skeleton width="40%" height={12} />
            <Skeleton width="90%" height={18} />
            <Skeleton width="70%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Skeleton for a long-form page (title + paragraphs). */
export function ArticleSkeleton() {
  return (
    <View style={styles.article}>
      <Skeleton height={200} radius={0} />
      <View style={styles.cardBody}>
        <Skeleton width="30%" height={12} />
        <Skeleton width="95%" height={24} />
        <Skeleton width="80%" height={24} />
        <View style={{ height: spacing.sm }} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="60%" height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.skeleton,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  article: {
    gap: spacing.sm,
  },
});
