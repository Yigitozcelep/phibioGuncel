import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Area, NewsSummary, Product } from '../api/types';
import { useFormatDate, useL, useT } from '../i18n';
import { colors, spacing, type } from '../theme';
import { AreaBadge, Badge } from './Badge';
import { Card } from './Card';
import { RemoteImage } from './RemoteImage';

interface ProductCardProps {
  product: Product;
  areaName?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ProductCard({ product, areaName, onPress, style }: ProductCardProps) {
  const l = useL();
  const t = useT();
  const tagline = l(product.tagline);
  return (
    <Card
      onPress={onPress}
      style={style}
      accessibilityLabel={`${product.name}${tagline ? `, ${tagline}` : ''}`}
      accessibilityHint={t.common.details}
    >
      <RemoteImage image={product.cover} aspectRatio={16 / 9} />
      <View style={styles.body}>
        <AreaBadge area={product.area} name={areaName} />
        <Text style={styles.title} numberOfLines={2}>
          {product.name}
        </Text>
        {tagline ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {tagline}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

interface NewsCardProps {
  item: NewsSummary;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function NewsCard({ item, onPress, style }: NewsCardProps) {
  const l = useL();
  const t = useT();
  const formatDate = useFormatDate();
  const title = l(item.title) || t.common.untitled;
  const summary = l(item.summary);
  const date = formatDate(item.publishedAt);
  const category = t.news.categories[item.category] ?? item.category;
  return (
    <Card
      onPress={onPress}
      style={[styles.newsCard, style]}
      accessibilityLabel={`${title}. ${category}${date ? `, ${date}` : ''}`}
      accessibilityHint={t.common.readMore}
    >
      <RemoteImage image={item.cover} variant="thumb" style={styles.thumb} iconSize={22} />
      <View style={styles.newsBody}>
        <View style={styles.metaRow}>
          <Badge label={category} />
          {item.featured ? <Badge label={t.news.featured} color={colors.warning} /> : null}
        </View>
        <Text style={styles.newsTitle} numberOfLines={2}>
          {title}
        </Text>
        {summary ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {summary}
          </Text>
        ) : null}
        {date ? <Text style={styles.date}>{date}</Text> : null}
      </View>
    </Card>
  );
}

interface AreaCardProps {
  area: Area;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  horizontal?: boolean;
}

export function AreaCard({ area, onPress, style, horizontal = false }: AreaCardProps) {
  const l = useL();
  const t = useT();
  const name = l(area.name) || t.products.areaNames[area.key] || area.key;
  const description = l(area.description);
  return (
    <Card
      onPress={onPress}
      style={[horizontal ? styles.areaCardHorizontal : styles.areaCard, style]}
      accessibilityLabel={name}
      accessibilityHint={t.tabs.products}
    >
      <RemoteImage image={area.image} aspectRatio={horizontal ? 16 / 10 : 2.4} />
      <View style={styles.body}>
        <AreaBadge area={area.key} name={name} solid />
        {description ? (
          <Text style={styles.subtitle} numberOfLines={horizontal ? 3 : 4}>
            {description}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...type.h3,
    color: colors.text,
  },
  subtitle: {
    ...type.small,
    color: colors.muted,
  },
  newsCard: {
    flexDirection: 'row',
  },
  thumb: {
    width: 108,
    alignSelf: 'stretch',
    minHeight: 108,
  },
  newsBody: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  newsTitle: {
    ...type.bodyStrong,
    color: colors.text,
  },
  date: {
    ...type.caption,
    color: colors.muted,
    marginTop: spacing.xxs,
  },
  areaCard: {},
  areaCardHorizontal: {
    width: 240,
  },
});
