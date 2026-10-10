import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type ImageResizeMode, type StyleProp, type ViewStyle } from 'react-native';

import type { ImageRef } from '../api/types';
import { useL } from '../i18n';
import { colors } from '../theme';

interface Props {
  image: ImageRef | null | undefined;
  /** Which variant to load. */
  variant?: 'url' | 'thumb' | 'orig';
  style?: StyleProp<ViewStyle>;
  resizeMode?: ImageResizeMode;
  /** Aspect ratio applied when the style does not set a height. */
  aspectRatio?: number;
  /** Placeholder icon size. */
  iconSize?: number;
  children?: React.ReactNode;
}

/** Aspect ratio from the image metadata, with a 16:9 fallback. */
export function imageAspect(image: ImageRef | null | undefined, fallback = 16 / 9): number {
  if (image && image.width > 0 && image.height > 0) return image.width / image.height;
  return fallback;
}

/**
 * Network image with a tinted placeholder while loading and a graceful icon
 * when the URL is missing or fails to load.
 */
export function RemoteImage({
  image,
  variant = 'url',
  style,
  resizeMode = 'cover',
  aspectRatio,
  iconSize = 28,
  children,
}: Props) {
  const l = useL();
  const uri = image ? image[variant] || image.url || image.orig : '';
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [uri]);

  const showImage = uri.length > 0 && !failed;
  const alt = image ? l(image.alt) : '';

  return (
    <View style={[styles.container, aspectRatio ? { aspectRatio } : null, style]}>
      {showImage && (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { opacity: loaded ? 1 : 0 }]}
          resizeMode={resizeMode}
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          accessible={alt.length > 0}
          accessibilityLabel={alt || undefined}
          accessibilityIgnoresInvertColors
        />
      )}
      {!showImage && (
        <View style={styles.placeholder} accessible={false}>
          <Ionicons name="image-outline" size={iconSize} color={colors.primary} style={styles.placeholderIcon} />
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.mint,
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    opacity: 0.45,
  },
});
