import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Block } from '../api/types';
import { useL, useT } from '../i18n';
import { colors, radii, spacing, type } from '../theme';
import { Button } from './Button';
import { openExternal } from './openLink';
import { imageAspect, RemoteImage } from './RemoteImage';

interface Props {
  blocks: Block[] | null | undefined;
  /** Rendered when there are no blocks (or all are empty). */
  empty?: React.ReactNode;
}

/**
 * Renders content blocks (ARCHITECTURE.md §4.1) as native views. The admin
 * panel's phone preview mirrors this mapping, so keep the two in sync.
 */
export function Blocks({ blocks, empty = null }: Props) {
  const l = useL();
  const t = useT();
  const rendered: React.ReactNode[] = [];

  (blocks ?? []).forEach((block, index) => {
    const key = `${block.type}-${index}`;
    switch (block.type) {
      case 'heading': {
        const text = l(block.text);
        if (!text) return;
        rendered.push(
          <Text key={key} style={styles.heading} accessibilityRole="header">
            {text}
          </Text>,
        );
        return;
      }
      case 'paragraph': {
        const text = l(block.text);
        if (!text) return;
        rendered.push(
          <Text key={key} style={styles.paragraph}>
            {text}
          </Text>,
        );
        return;
      }
      case 'image': {
        if (!block.image) return;
        const caption = l(block.caption) || l(block.image.alt);
        rendered.push(
          <View key={key} style={styles.figure}>
            <RemoteImage image={block.image} aspectRatio={imageAspect(block.image)} style={styles.image} />
            {caption ? <Text style={styles.caption}>{caption}</Text> : null}
          </View>,
        );
        return;
      }
      case 'list': {
        const items = (block.items ?? []).map(l).filter((s) => s.length > 0);
        if (items.length === 0) return;
        rendered.push(
          <View key={key} style={styles.list} accessibilityRole="list">
            {items.map((item, i) => (
              <View key={i} style={styles.listItem}>
                <View style={styles.bullet} />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>,
        );
        return;
      }
      case 'quote': {
        const text = l(block.text);
        if (!text) return;
        rendered.push(
          <View key={key} style={styles.quote}>
            <Text style={styles.quoteText}>{text}</Text>
          </View>,
        );
        return;
      }
      case 'button': {
        const label = l(block.label) || block.url || '';
        const url = block.url ?? '';
        if (!label || !url) return;
        rendered.push(
          <View key={key} style={styles.buttonWrap}>
            <Button label={label} icon="open-outline" onPress={() => void openExternal(url, t)} />
          </View>,
        );
        return;
      }
      default:
        return;
    }
  });

  if (rendered.length === 0) return <>{empty}</>;
  return <View style={styles.container}>{rendered}</View>;
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  heading: {
    ...type.h2,
    color: colors.text,
    marginTop: spacing.sm,
  },
  paragraph: {
    ...type.body,
    color: colors.text,
  },
  figure: {
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  image: {
    width: '100%',
    borderRadius: radii.md,
  },
  caption: {
    ...type.caption,
    color: colors.muted,
    textAlign: 'center',
  },
  list: {
    gap: spacing.sm,
    paddingLeft: spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 9,
  },
  listText: {
    ...type.body,
    color: colors.text,
    flex: 1,
  },
  quote: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: colors.mint,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopRightRadius: radii.md,
    borderBottomRightRadius: radii.md,
  },
  quoteText: {
    ...type.body,
    fontStyle: 'italic',
    color: colors.primaryDark,
  },
  buttonWrap: {
    marginVertical: spacing.xs,
  },
});
