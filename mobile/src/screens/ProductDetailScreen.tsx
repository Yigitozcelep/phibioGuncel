import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useContent, useProduct } from '../api/store';
import type { ImageRef, Product } from '../api/types';
import {
  AreaBadge,
  ArticleSkeleton,
  Blocks,
  Button,
  ErrorState,
  imageAspect,
  ImageViewer,
  mailto,
  openExternal,
  RemoteImage,
} from '../components';
import { useL, useT } from '../i18n';
import { Header } from '../navigation';
import { colors, radii, spacing, type } from '../theme';
import { ScreenScroll, screenStyles } from './shared';

function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

function ProductBody({ product }: { product: Product }) {
  const t = useT();
  const l = useL();
  const { bundle } = useContent();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const areaName = l(bundle?.site.areas.find((a) => a.key === product.area)?.name);
  const tagline = l(product.tagline);
  const summary = l(product.summary);
  const features = product.features.map(l).filter(Boolean);
  const specs = product.specs.filter((s) => l(s.label) || l(s.value));
  const gallery = useMemo(() => product.gallery.filter((g): g is ImageRef => g !== null), [product.gallery]);
  const documents = product.documents.filter((d) => d.url.trim());
  const email = bundle?.site.contact.email.trim() ?? '';

  return (
    <ScreenScroll>
      <RemoteImage image={product.cover} aspectRatio={Math.min(Math.max(imageAspect(product.cover), 1), 16 / 9)} />
      <View style={styles.body}>
        <AreaBadge area={product.area} name={areaName} />
        <Text style={styles.name} accessibilityRole="header">
          {product.name}
        </Text>
        {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
        {summary ? <Text style={styles.summary}>{summary}</Text> : null}

        {features.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>{t.products.features}</SectionTitle>
            <View style={styles.featureList} accessibilityRole="list">
              {features.map((feature, i) => (
                <View key={i} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} style={styles.featureIcon} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {specs.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>{t.products.specs}</SectionTitle>
            <View style={styles.table}>
              {specs.map((spec, i) => (
                <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                  <Text style={styles.tableLabel}>{l(spec.label)}</Text>
                  <Text style={styles.tableValue}>{l(spec.value)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {product.blocks.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>{t.products.description}</SectionTitle>
            <Blocks blocks={product.blocks} />
          </View>
        )}

        {gallery.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>{t.products.gallery}</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
              {gallery.map((img, i) => (
                <Pressable
                  key={img.id || i}
                  onPress={() => setViewerIndex(i)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={l(img.alt) || t.common.imageOf(i + 1, gallery.length)}
                  accessibilityHint={t.products.openGalleryImage}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <RemoteImage image={img} variant="thumb" style={styles.galleryThumb} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {documents.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>{t.products.documents}</SectionTitle>
            <View style={styles.docList}>
              {documents.map((doc, i) => {
                const title = l(doc.title) || doc.url;
                return (
                  <Button
                    key={i}
                    label={title}
                    icon="document-text-outline"
                    iconRight="open-outline"
                    variant="outline"
                    block
                    onPress={() => void openExternal(doc.url, t)}
                    accessibilityLabel={t.products.openDocument(title)}
                  />
                );
              })}
            </View>
          </View>
        )}

        {email ? (
          <View style={styles.section}>
            <Button
              label={t.products.contactAbout}
              icon="mail-outline"
              block
              onPress={() => void openExternal(mailto(email, t.products.mailSubject(product.name)), t)}
            />
          </View>
        ) : null}
      </View>
      <ImageViewer images={gallery} index={viewerIndex} onClose={() => setViewerIndex(null)} />
    </ScreenScroll>
  );
}

export function ProductDetailScreen({ slug }: { slug: string }) {
  const t = useT();
  const product = useProduct(slug);
  const { refresh, refreshing, status, error } = useContent();

  let content: React.ReactNode;
  if (product === undefined) {
    content =
      status === 'error' ? (
        <ErrorState error={error} onRetry={() => void refresh()} retrying={refreshing} />
      ) : (
        <ArticleSkeleton />
      );
  } else if (product === null) {
    content = <ErrorState message={t.errors.notFound} onRetry={() => void refresh()} retrying={refreshing} />;
  } else {
    content = <ProductBody product={product} />;
  }

  return (
    <View style={screenStyles.screen}>
      <Header title={product?.name ?? t.products.title} back />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  name: {
    ...type.h1,
    color: colors.text,
  },
  tagline: {
    ...type.h3,
    fontWeight: '500',
    color: colors.primaryDark,
    marginTop: -spacing.xs,
  },
  summary: {
    ...type.body,
    color: colors.text,
  },
  section: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    ...type.h2,
    color: colors.text,
  },
  featureList: {
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  featureIcon: {
    marginTop: 1,
  },
  featureText: {
    ...type.body,
    color: colors.text,
    flex: 1,
  },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  tableRowAlt: {
    backgroundColor: colors.mint,
  },
  tableLabel: {
    ...type.small,
    fontWeight: '600',
    color: colors.muted,
    flex: 2,
  },
  tableValue: {
    ...type.small,
    color: colors.text,
    flex: 3,
  },
  gallery: {
    gap: spacing.sm,
  },
  galleryThumb: {
    width: 150,
    height: 150,
    borderRadius: radii.md,
  },
  docList: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
});
