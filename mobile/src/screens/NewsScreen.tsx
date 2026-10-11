import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { useContent } from '../api/store';
import { NEWS_CATEGORIES, type NewsSummary } from '../api/types';
import { Button, CardSkeleton, Chips, EmptyState, errorMessage, NewsCard, type ChipOption } from '../components';
import { useT } from '../i18n';
import { Header, useNavigation } from '../navigation';
import { colors, spacing, type } from '../theme';
import { ContentGate, OfflineNotice, screenStyles, useRefreshControl } from './shared';

type CategoryFilter = 'all' | (typeof NEWS_CATEGORIES)[number];

function NewsList() {
  const t = useT();
  const nav = useNavigation();
  const refreshControl = useRefreshControl();
  const { newsList, newsTotal, hasMoreNews, loadMoreNews, loadingMore, loadMoreError } = useContent();
  const [category, setCategory] = useState<CategoryFilter>('all');

  const options = useMemo<ChipOption<CategoryFilter>[]>(
    () => [
      { key: 'all', label: t.common.all },
      ...NEWS_CATEGORIES.map<ChipOption<CategoryFilter>>((key) => ({ key, label: t.news.categories[key] ?? key })),
    ],
    [t],
  );

  const items = useMemo(
    () => (category === 'all' ? newsList : newsList.filter((n) => n.category === category)),
    [newsList, category],
  );

  const renderItem = ({ item }: { item: NewsSummary }) => (
    <NewsCard item={item} onPress={() => nav.push({ name: 'newsDetail', slug: item.slug })} />
  );

  const empty =
    newsList.length === 0 ? (
      <EmptyState title={t.empty.news} hint={t.empty.newsHint} icon="newspaper-outline" />
    ) : (
      <EmptyState title={t.empty.newsCategory} hint={t.empty.newsCategoryHint} icon="newspaper-outline" />
    );

  const footer =
    newsList.length > 0 ? (
      <View style={styles.footer}>
        {newsTotal > 0 ? <Text style={styles.count}>{t.news.loadedOf(newsList.length, newsTotal)}</Text> : null}
        {loadMoreError ? <Text style={styles.footerError}>{errorMessage(loadMoreError, t)}</Text> : null}
        {hasMoreNews ? (
          loadingMore ? (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          ) : (
            <Button
              label={loadMoreError ? t.common.retry : t.common.loadMore}
              variant="outline"
              icon={loadMoreError ? 'refresh' : 'chevron-down'}
              onPress={() => void loadMoreNews()}
              style={styles.loadMore}
              testID="news-load-more"
            />
          )
        ) : null}
      </View>
    ) : null;

  return (
    <View style={screenStyles.screen}>
      <Chips options={options} value={category} onChange={setCategory} accessibilityLabel={t.news.filterLabel} />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        refreshControl={refreshControl}
        onEndReached={() => {
          if (hasMoreNews && !loadingMore && !loadMoreError) void loadMoreNews();
        }}
        onEndReachedThreshold={0.4}
        extraData={category}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

export function NewsScreen() {
  const t = useT();
  return (
    <View style={screenStyles.screen}>
      <Header title={t.news.title} />
      <OfflineNotice />
      <ContentGate skeleton={<CardSkeleton count={4} cover={false} />}>{() => <NewsList />}</ContentGate>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  separator: {
    height: spacing.md,
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  count: {
    ...type.caption,
    color: colors.muted,
  },
  footerError: {
    ...type.small,
    color: colors.danger,
    textAlign: 'center',
  },
  spinner: {
    marginVertical: spacing.md,
  },
  loadMore: {
    marginTop: spacing.xs,
  },
});
