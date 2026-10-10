import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useContent } from '../api/store';
import type { Bundle } from '../api/types';
import {
  AreaCard,
  Button,
  displayUrl,
  EmptyState,
  mailto,
  mapsUrl,
  NewsCard,
  openExternal,
  ProductCard,
  RemoteImage,
  SectionHeader,
  Skeleton,
  tel,
} from '../components';
import { useL, useT } from '../i18n';
import { Header, useNavigation } from '../navigation';
import { colors, isAreaKey, radii, spacing, type } from '../theme';
import { ContentGate, OfflineNotice, ScreenScroll, screenStyles } from './shared';

const CARD_GAP = spacing.md;

function HomeSkeleton() {
  return (
    <View>
      <Skeleton height={300} radius={0} />
      <View style={styles.statsRow}>
        <Skeleton height={88} style={styles.statSkeleton} />
        <Skeleton height={88} style={styles.statSkeleton} />
        <Skeleton height={88} style={styles.statSkeleton} />
      </View>
      <View style={[screenStyles.padded, { gap: spacing.md }]}>
        <Skeleton width="50%" height={22} />
        <Skeleton height={180} radius={radii.lg} />
        <Skeleton width="60%" height={22} />
        <Skeleton height={180} radius={radii.lg} />
      </View>
    </View>
  );
}

function Hero({ bundle }: { bundle: Bundle }) {
  const l = useL();
  const t = useT();
  const nav = useNavigation();
  const { site } = bundle;
  const slogan = l(site.slogan);
  const title = l(site.heroTitle) || site.companyName;
  const subtitle = l(site.heroSubtitle);
  return (
    <RemoteImage image={site.heroImage} style={styles.hero} iconSize={0}>
      <View style={styles.heroOverlay} />
      <View style={styles.heroContent}>
        {slogan ? <Text style={styles.heroSlogan}>{slogan}</Text> : null}
        <Text style={styles.heroTitle} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
        <Button
          label={t.home.heroCta}
          variant="light"
          iconRight="chevron-forward"
          onPress={() => nav.switchTab('products', { area: 'all' })}
          style={styles.heroButton}
        />
      </View>
    </RemoteImage>
  );
}

function Stats({ bundle }: { bundle: Bundle }) {
  const l = useL();
  const t = useT();
  const stats = bundle.site.stats.filter((s) => s.value.trim() || l(s.label));
  if (stats.length === 0) return null;
  return (
    <View style={styles.statsRow}>
      {stats.slice(0, 3).map((stat, i) => (
        <View
          key={i}
          style={styles.statCard}
          accessible
          accessibilityLabel={t.home.statsAccessibility(stat.value, l(stat.label))}
        >
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {stat.value}
          </Text>
          <Text style={styles.statLabel}>{l(stat.label)}</Text>
        </View>
      ))}
    </View>
  );
}

function Areas({ bundle }: { bundle: Bundle }) {
  const t = useT();
  const nav = useNavigation();
  const areas = bundle.site.areas;
  if (areas.length === 0) return null;
  return (
    <View style={screenStyles.section}>
      <SectionHeader title={t.home.areasTitle} subtitle={t.home.areasSubtitle} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
        {areas.map((area) => (
          <AreaCard
            key={area.key}
            area={area}
            horizontal
            onPress={() => nav.switchTab('products', { area: isAreaKey(area.key) ? area.key : 'all' })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Products({ bundle }: { bundle: Bundle }) {
  const t = useT();
  const l = useL();
  const nav = useNavigation();
  const products = bundle.products;
  const areaName = (key: string) => l(bundle.site.areas.find((a) => a.key === key)?.name);
  return (
    <View style={[screenStyles.section, styles.tinted]}>
      <SectionHeader
        title={t.home.productsTitle}
        subtitle={t.home.productsSubtitle}
        actionLabel={products.length > 0 ? t.common.viewAll : undefined}
        onAction={() => nav.switchTab('products', { area: 'all' })}
      />
      {products.length === 0 ? (
        <EmptyState title={t.empty.products} hint={t.empty.productsHint} icon="cube-outline" compact />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              areaName={areaName(product.area)}
              style={styles.productCard}
              onPress={() => nav.push({ name: 'productDetail', slug: product.slug })}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function LatestNews() {
  const t = useT();
  const nav = useNavigation();
  const { newsList } = useContent();
  const latest = newsList.slice(0, 3);
  return (
    <View style={screenStyles.section}>
      <SectionHeader
        title={t.home.newsTitle}
        actionLabel={newsList.length > 0 ? t.home.allNews : undefined}
        onAction={() => nav.switchTab('news')}
      />
      {latest.length === 0 ? (
        <EmptyState title={t.empty.news} hint={t.empty.newsHint} icon="newspaper-outline" compact />
      ) : (
        <View style={[screenStyles.padded, { gap: CARD_GAP }]}>
          {latest.map((item) => (
            <NewsCard key={item.id} item={item} onPress={() => nav.push({ name: 'newsDetail', slug: item.slug })} />
          ))}
        </View>
      )}
    </View>
  );
}

function ContactStrip({ bundle }: { bundle: Bundle }) {
  const t = useT();
  const nav = useNavigation();
  const { contact } = bundle.site;
  const hasAddress = contact.mapUrl.trim().length > 0 || contact.addressLines.some((l) => l.trim());
  return (
    <View style={styles.contactStrip}>
      <SectionHeader title={t.home.contactTitle} subtitle={t.home.contactSubtitle} onDark />
      <View style={styles.contactButtons}>
        {contact.phone.trim() ? (
          <Button
            label={t.home.call}
            icon="call-outline"
            variant="light"
            style={styles.contactButton}
            onPress={() => void openExternal(tel(contact.phone), t)}
            accessibilityLabel={`${t.home.call} ${contact.phoneDisplay || contact.phone}`}
          />
        ) : null}
        {contact.email.trim() ? (
          <Button
            label={t.home.email}
            icon="mail-outline"
            variant="light"
            style={styles.contactButton}
            onPress={() => void openExternal(mailto(contact.email), t)}
            accessibilityLabel={`${t.home.email} ${contact.email}`}
          />
        ) : null}
        {hasAddress ? (
          <Button
            label={t.home.map}
            icon="navigate-outline"
            variant="light"
            style={styles.contactButton}
            onPress={() => void openExternal(mapsUrl(contact.mapUrl, contact.addressLines), t)}
          />
        ) : null}
      </View>
      <Button
        label={t.tabs.contact}
        variant="ghost"
        iconRight="chevron-forward"
        onPress={() => nav.switchTab('contact')}
        style={styles.contactMore}
        accessibilityLabel={t.tabs.contact}
      />
      <Text style={styles.footer}>
        {bundle.site.companyName}
        {contact.website.trim() ? ` · ${displayUrl(contact.website)}` : ''}
      </Text>
    </View>
  );
}

export function HomeScreen() {
  const t = useT();
  return (
    <View style={screenStyles.screen}>
      <Header title={t.common.appName} />
      <OfflineNotice />
      <ContentGate skeleton={<HomeSkeleton />}>
        {(bundle) => (
          <ScreenScroll refresh contentStyle={styles.scroll}>
            <Hero bundle={bundle} />
            <Stats bundle={bundle} />
            <Areas bundle={bundle} />
            <Products bundle={bundle} />
            <LatestNews />
            <ContactStrip bundle={bundle} />
          </ScreenScroll>
        )}
      </ContentGate>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 0,
  },
  hero: {
    minHeight: 320,
    justifyContent: 'flex-end',
    backgroundColor: colors.primaryDark,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  heroContent: {
    padding: spacing.xxl,
    paddingTop: spacing.huge,
    gap: spacing.sm,
  },
  heroSlogan: {
    ...type.label,
    fontSize: 13,
    color: colors.mint,
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...type.display,
    color: colors.white,
  },
  heroSubtitle: {
    ...type.body,
    color: 'rgba(255,255,255,0.88)',
  },
  heroButton: {
    marginTop: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.xl,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: 88,
  },
  statSkeleton: {
    flex: 1,
  },
  statValue: {
    ...type.h1,
    color: colors.primary,
  },
  statLabel: {
    ...type.caption,
    color: colors.muted,
    textAlign: 'center',
  },
  hList: {
    paddingHorizontal: spacing.lg,
    gap: CARD_GAP,
  },
  tinted: {
    backgroundColor: colors.mint,
  },
  productCard: {
    width: 260,
  },
  contactStrip: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.xxl,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  contactButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  contactButton: {
    flexGrow: 1,
    flexBasis: 100,
  },
  contactMore: {
    marginHorizontal: spacing.sm,
  },
  footer: {
    ...type.caption,
    color: 'rgba(255,255,255,0.75)',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
});
