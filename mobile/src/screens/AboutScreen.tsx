import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Bundle } from '../api/types';
import { AreaCard, ArticleSkeleton, Blocks, Button, displayUrl, EmptyState, openExternal, SectionHeader } from '../components';
import { useFormatDate, useL, useT } from '../i18n';
import { Header, useNavigation, type LegalKind } from '../navigation';
import { colors, isAreaKey, radii, spacing, TOUCH_TARGET, type } from '../theme';
import { ContentGate, OfflineNotice, ScreenScroll, screenStyles } from './shared';

function LegalRow({ kind, label, last = false }: { kind: LegalKind; label: string; last?: boolean }) {
  const nav = useNavigation();
  return (
    <Pressable
      onPress={() => nav.push({ name: 'legal', kind })}
      testID={`legal-${kind}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.legalRow, !last && styles.legalRowBorder, pressed && styles.pressed]}
    >
      <Ionicons name={kind === 'imprint' ? 'business-outline' : 'shield-checkmark-outline'} size={22} color={colors.primary} />
      <Text style={styles.legalLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

function AboutBody({ bundle }: { bundle: Bundle }) {
  const t = useT();
  const l = useL();
  const nav = useNavigation();
  const formatDate = useFormatDate();
  const { site } = bundle;
  const title = l(site.aboutTitle) || t.about.title;
  const website = site.contact.website.trim();
  const stats = site.stats.filter((s) => s.value.trim() || l(s.label));
  const updated = formatDate(site.updatedAt);

  return (
    <ScreenScroll refresh>
      <View style={styles.intro}>
        {/* Brand name: locale-independent casing (Turkish rules would give "PHİBİO"). */}
        <Text style={styles.kicker}>{site.companyName.toUpperCase()}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>

      <View style={screenStyles.padded}>
        <Blocks blocks={site.aboutBlocks} empty={<EmptyState title={t.empty.content} compact />} />
      </View>

      {stats.length > 0 && (
        <View style={screenStyles.section}>
          <SectionHeader title={t.about.statsTitle} />
          <View style={[screenStyles.padded, styles.statsGrid]}>
            {stats.map((stat, i) => (
              <View key={i} style={styles.statCard} accessible accessibilityLabel={t.home.statsAccessibility(stat.value, l(stat.label))}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{l(stat.label)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {site.areas.length > 0 && (
        <View style={screenStyles.section}>
          <SectionHeader title={t.about.areasTitle} />
          <View style={[screenStyles.padded, styles.areaList]}>
            {site.areas.map((area) => (
              <AreaCard
                key={area.key}
                area={area}
                onPress={() => nav.switchTab('products', { area: isAreaKey(area.key) ? area.key : 'all' })}
              />
            ))}
          </View>
        </View>
      )}

      <View style={screenStyles.section}>
        <SectionHeader title={t.about.legalTitle} />
        <View style={[screenStyles.padded]}>
          <View style={styles.legalCard}>
            <LegalRow kind="imprint" label={t.about.imprint} />
            <LegalRow kind="privacy" label={t.about.privacy} last />
          </View>
        </View>
      </View>

      {website ? (
        <View style={[screenStyles.padded, styles.websiteWrap]}>
          <Button
            label={t.common.openWebsite}
            icon="globe-outline"
            iconRight="open-outline"
            variant="outline"
            block
            onPress={() => void openExternal(website, t)}
            accessibilityLabel={`${t.common.openWebsite}: ${displayUrl(website)}`}
          />
        </View>
      ) : null}

      <Text style={styles.footer}>
        {site.companyName}
        {updated ? ` · ${t.common.lastUpdated(updated)}` : ''}
      </Text>
    </ScreenScroll>
  );
}

export function AboutScreen() {
  const t = useT();
  return (
    <View style={screenStyles.screen}>
      <Header title={t.about.title} />
      <OfflineNotice />
      <ContentGate skeleton={<ArticleSkeleton />}>{(bundle) => <AboutBody bundle={bundle} />}</ContentGate>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    backgroundColor: colors.mint,
    padding: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  kicker: {
    ...type.label,
    color: colors.primary,
  },
  title: {
    ...type.h1,
    color: colors.text,
  },
  founded: {
    ...type.small,
    color: colors.muted,
  },
  certCard: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: radii.lg,
  },
  certText: {
    ...type.small,
    fontWeight: '600',
    color: colors.primaryDark,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 100,
    backgroundColor: colors.mint,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xxs,
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
  areaList: {
    gap: spacing.md,
  },
  legalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TOUCH_TARGET + 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  legalRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  legalLabel: {
    ...type.bodyStrong,
    color: colors.text,
    flex: 1,
  },
  websiteWrap: {
    marginTop: spacing.sm,
  },
  footer: {
    ...type.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
});
