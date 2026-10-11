import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ArticleSkeleton, Blocks, EmptyState } from '../components';
import { useFormatDate, useL, useT } from '../i18n';
import { Header, type LegalKind } from '../navigation';
import { colors, spacing, type } from '../theme';
import { ContentGate, ScreenScroll, screenStyles } from './shared';

export function LegalScreen({ kind }: { kind: LegalKind }) {
  const t = useT();
  const l = useL();
  const formatDate = useFormatDate();
  const title = kind === 'imprint' ? t.legal.imprint : t.legal.privacy;
  return (
    <View style={screenStyles.screen}>
      <Header title={title} back />
      <ContentGate skeleton={<ArticleSkeleton />}>
        {(bundle) => {
          const blocks = kind === 'imprint' ? bundle.site.imprint : bundle.site.privacy;
          const updated = formatDate(bundle.site.updatedAt);
          // Editors usually start the text with its own heading; the header bar
          // already names the page, so avoid "Künye / Künye" at the top.
          const startsWithHeading = blocks.length > 0 && blocks[0].type === 'heading' && l(blocks[0].text).length > 0;
          return (
            <ScreenScroll contentStyle={styles.content}>
              {startsWithHeading ? null : (
                <Text style={styles.title} accessibilityRole="header">
                  {title}
                </Text>
              )}
              <Blocks blocks={blocks} empty={<EmptyState title={t.empty.legal} icon="document-text-outline" />} />
              {updated ? <Text style={styles.footer}>{t.common.lastUpdated(updated)}</Text> : null}
            </ScreenScroll>
          );
        }}
      </ContentGate>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  title: {
    ...type.h1,
    color: colors.text,
  },
  footer: {
    ...type.caption,
    color: colors.muted,
    marginTop: spacing.lg,
  },
});
