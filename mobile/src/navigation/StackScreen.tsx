import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions } from 'react-native';

import { colors, USE_NATIVE_DRIVER } from '../theme';

const DURATION_MS = 250;

interface Props {
  closing: boolean;
  onClosed: () => void;
  children: React.ReactNode;
}

/**
 * Wraps a pushed screen: slides in from the right on mount and slides out
 * again when `closing` becomes true, then reports `onClosed`.
 */
export function StackScreen({ closing, onClosed, children }: Props) {
  const { width } = useWindowDimensions();
  const progress = useRef(new Animated.Value(1)).current;
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: closing ? 1 : 0,
      duration: DURATION_MS,
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start(({ finished }) => {
      if (closing && finished) onClosedRef.current();
    });
    return () => animation.stop();
  }, [closing, progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, width] });

  return (
    <Animated.View
      style={[styles.screen, { transform: [{ translateX }] }]}
      pointerEvents={closing ? 'none' : 'auto'}
      accessibilityViewIsModal
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
  },
});
