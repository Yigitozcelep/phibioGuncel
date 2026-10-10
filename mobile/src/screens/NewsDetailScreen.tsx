import { Ionicons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { useContent, useNews } from '../api/store';
import type { NewsSummary } from '../api/types';
import { ArticleSkeleton, Badge, Blocks, ErrorState, imageAspect, RemoteImage, Skeleton } from '../components';
import { useFormatDate, useL, useT } from '../i18n';
import { Header } from '../navigation';
import { colors, radii, spacing, TOUCH_TARGET, type } from '../theme';
import { ScreenScroll, screenStyles } from './shared';

function ArticleHead({ item }: { item: NewsSummary }) {
  const t = useT();
  const l = useL();
  const formatDate = useFormatDate();
  const title = l(item.title) || t.common.untitled;
  const summary = l(item.summary);
  const date = formatDate(item.publishedAt);
  const category = t.news.categories[item.category] ?? item.category;
  return (
    <>
      {item.cover ? <RemoteImage image={item.cover} aspectRatio={Math.max(imageAspect(item.cover), 1.2)} /> : null}
      <View style={styles.head}>
        <View style={styles.metaRow}>
          <Badge label={category} />
          {item.featured ? <Badge label={t.news.featured} color={colors.warning} /> : null}
          {date ? <Text style={styles.date}>{date}</Text> : null}
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {summary ? <Text style={styles.lead}>{summary}</Text> : null}
      </View>
    </>
  );
}

export function NewsDetailScreen({ slug }: { slug: string }) {
  const t = useT();
  const l = useL();
  const { bundle } = useContent();
  const { summary, news, status, error, retry } = useNews(slug);
  const item = news ?? summary;

  const share = useCallback(async () => {
    if (!item) return;
    const title = l(item.title) || t.common.untitled;
    const website = bundle?.site.contact.website.trim() ?? '';
    try {
      await Share.share({ title, message: t.news.shareMessage(title, website) }, { subject: title, dialogTitle: title });
    } catch {
      Alert.alert(t.errors.title, t.errors.shareFailed);
    }
  }, [item, l, t, bundle]);

  const shareButton = item ? (
    <Pressable
      onPress={() => void share()}
      accessibilityRole="button"
      accessibilityLabel={t.news.shareLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
    >
      <Ionicons name="share-social-outline" size={22} color={colors.white} />
    </Pressable>
  ) : null;

  let content: React.ReactNode;
  if (news) {
    content = (
      <ScreenScroll>
        <ArticleHead item={news} />
        <View style={styles.body}>
          <Blocks blocks={news.blocks} />
        </View>
      </ScreenScroll>
    );
  } else if (status === 'error') {
    content = summary ? (
      <ScreenScroll>
        <ArticleHead item={summary} />
        <ErrorState error={error} onRetry={retry} compact />
      </ScreenScroll>
    ) : (
      <ErrorState error={error} onRetry={retry} />
    );
  } else {
    content = summary ? (
      <ScreenScroll>
        <ArticleHead item={summary} />
        <View style={[styles.body, { gap: spacing.sm }]}>
          <Skeleton width="100%" height={14} />
          <Skeleton width="100%" height={14} />
          <Skeleton width="70%" height={14} />
        </View>
      </ScreenScroll>
    ) : (
      <ArticleSkeleton />
    );
  }

  return (
    <View style={screenStyles.screen}>
      <Header title={t.news.title} back right={shareButton} />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  date: {
    ...type.caption,
    color: colors.muted,
  },
  title: {
    ...type.h1,
    color: colors.text,
  },
  lead: {
    ...type.body,
    fontSize: 17,
    lineHeight: 26,
    fontStyle: 'italic',
    color: colors.muted,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  shareButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
