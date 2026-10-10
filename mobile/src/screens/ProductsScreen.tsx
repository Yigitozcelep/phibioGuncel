import React, { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import type { Bundle, Product } from '../api/types';
import { CardSkeleton, Chips, EmptyState, ProductCard, type ChipOption } from '../components';
import { useL, useT } from '../i18n';
import { Header, useNavigation, type ProductsFilter } from '../navigation';
import { AREA_KEYS, areaColor, isAreaKey, spacing } from '../theme';
import { ContentGate, OfflineNotice, screenStyles, useRefreshControl } from './shared';

function ProductList({ bundle }: { bundle: Bundle }) {
  const t = useT();
  const l = useL();
  const nav = useNavigation();
  const refreshControl = useRefreshControl();
  const { productsFilter, setProductsFilter } = nav;

  const options = useMemo<ChipOption<ProductsFilter>[]>(() => {
    const fromSite = bundle.site.areas.filter((a) => isAreaKey(a.key));
    const keys = fromSite.length > 0 ? fromSite.map((a) => a.key) : [...AREA_KEYS];
    const areaOptions = keys.filter(isAreaKey).map<ChipOption<ProductsFilter>>((key) => ({
      key,
      label: l(bundle.site.areas.find((a) => a.key === key)?.name) || t.products.areaNames[key] || key,
      color: areaColor(key),
    }));
    return [{ key: 'all', label: t.products.allAreas }, ...areaOptions];
  }, [bundle.site.areas, l, t]);

  const products = useMemo(
    () => (productsFilter === 'all' ? bundle.products : bundle.products.filter((p) => p.area === productsFilter)),
    [bundle.products, productsFilter],
  );

  const areaName = (key: string) => l(bundle.site.areas.find((a) => a.key === key)?.name);

  const renderItem = ({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      areaName={areaName(item.area)}
      onPress={() => nav.push({ name: 'productDetail', slug: item.slug })}
    />
  );

  const empty =
    bundle.products.length === 0 ? (
      <EmptyState title={t.empty.products} hint={t.empty.productsHint} icon="cube-outline" />
    ) : (
      <EmptyState title={t.empty.productsArea} hint={t.empty.productsAreaHint} icon="cube-outline" />
    );

  return (
    <View style={screenStyles.screen}>
      <Chips options={options} value={productsFilter} onChange={setProductsFilter} accessibilityLabel={t.products.filterLabel} />
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={empty}
        refreshControl={refreshControl}
        extraData={productsFilter}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

export function ProductsScreen() {
  const t = useT();
  return (
    <View style={screenStyles.screen}>
      <Header title={t.products.title} />
      <OfflineNotice />
      <ContentGate skeleton={<CardSkeleton count={3} />}>{(bundle) => <ProductList bundle={bundle} />}</ContentGate>
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
    height: spacing.lg,
  },
});
