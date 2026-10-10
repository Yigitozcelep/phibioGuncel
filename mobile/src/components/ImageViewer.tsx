import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ImageRef } from '../api/types';
import { useL, useT } from '../i18n';
import { colors, radii, spacing, TOUCH_TARGET, type } from '../theme';

interface Props {
  images: ImageRef[];
  index: number | null;
  onClose: () => void;
}

/** Full-screen paged gallery viewer. */
export function ImageViewer({ images, index, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const t = useT();
  const l = useL();
  const [current, setCurrent] = useState(index ?? 0);
  const scrollRef = useRef<ScrollView>(null);
  const visible = index !== null && images.length > 0;

  useEffect(() => {
    if (index !== null) setCurrent(index);
  }, [index]);

  // `contentOffset` only works on iOS; Android needs an explicit scrollTo once the modal is shown.
  const jumpToIndex = () => {
    scrollRef.current?.scrollTo({ x: (index ?? 0) * width, y: 0, animated: false });
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrent(Math.max(0, Math.min(images.length - 1, page)));
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} onShow={jumpToIndex} statusBarTranslucent>
      <View style={styles.backdrop}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: (index ?? 0) * width, y: 0 }}
          onMomentumScrollEnd={onMomentumEnd}
        >
          {images.map((img, i) => (
            <View key={img.id || i} style={{ width, height }}>
              <Image
                source={{ uri: img.orig || img.url }}
                style={styles.image}
                resizeMode="contain"
                accessible
                accessibilityLabel={l(img.alt) || t.common.imageOf(i + 1, images.length)}
                accessibilityIgnoresInvertColors
              />
            </View>
          ))}
        </ScrollView>
        <View style={[styles.topBar, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
          <Text style={styles.counter}>{t.common.imageOf(current + 1, images.length)}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            hitSlop={8}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={26} color={colors.white} />
          </Pressable>
        </View>
        {images[current] && l(images[current].alt) ? (
          <View style={[styles.captionWrap, { bottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.captionText}>{l(images[current].alt)}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.black,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    ...type.small,
    color: colors.white,
    fontWeight: '600',
  },
  closeButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  captionText: {
    ...type.small,
    color: colors.white,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
