import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Bundle, SocialLink } from '../api/types';
import { Button, Card, CardSkeleton, displayUrl, EmptyState, mailto, mapsUrl, openExternal, tel } from '../components';
import { useL, useT, useUpper } from '../i18n';
import { Header } from '../navigation';
import { colors, radii, spacing, TOUCH_TARGET, type } from '../theme';
import { ContentGate, OfflineNotice, ScreenScroll, screenStyles } from './shared';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SOCIAL_ICONS: Record<string, IconName> = {
  linkedin: 'logo-linkedin',
  instagram: 'logo-instagram',
  facebook: 'logo-facebook',
  x: 'logo-x',
  youtube: 'logo-youtube',
};

interface RowProps {
  icon: IconName;
  label: string;
  lines: string[];
  action?: { label: string; url: string; icon: IconName };
}

function ContactRow({ icon, label, lines, action }: RowProps) {
  const t = useT();
  const upper = useUpper();
  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={22} color={colors.primary} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardLabel}>{upper(label)}</Text>
          {lines.map((line, i) => (
            <Text key={i} style={styles.cardValue} selectable>
              {line}
            </Text>
          ))}
        </View>
      </View>
      {action ? (
        <Button
          label={action.label}
          icon={action.icon}
          variant="light"
          small
          onPress={() => void openExternal(action.url, t)}
          style={styles.cardAction}
          accessibilityLabel={`${action.label}: ${lines.join(', ')}`}
        />
      ) : null}
    </Card>
  );
}

function SocialRow({ links }: { links: SocialLink[] }) {
  const t = useT();
  return (
    <View style={styles.socialRow}>
      {links.map((link, i) => {
        const name = t.contact.socialNames[link.kind] ?? link.kind;
        return (
          <Pressable
            key={`${link.kind}-${i}`}
            onPress={() => void openExternal(link.url, t)}
            accessibilityRole="link"
            accessibilityLabel={name}
            style={({ pressed }) => [styles.socialButton, pressed && styles.pressed]}
          >
            <Ionicons name={SOCIAL_ICONS[link.kind] ?? 'link-outline'} size={24} color={colors.primary} />
            <Text style={styles.socialLabel} numberOfLines={1}>
              {name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ContactBody({ bundle }: { bundle: Bundle }) {
  const t = useT();
  const l = useL();
  const upper = useUpper();
  const { contact, social } = bundle.site;
  const email = contact.email.trim();
  const phone = contact.phone.trim();
  const address = contact.addressLines.map((a) => a.trim()).filter(Boolean);
  const hours = l(contact.hours);
  const website = contact.website.trim();
  const links = social.filter((s) => s.url.trim());
  const hasAnything = email || phone || address.length > 0 || hours || website || links.length > 0;

  return (
    <ScreenScroll refresh contentStyle={styles.scroll}>
      <View style={styles.intro}>
        <Text style={styles.heading} accessibilityRole="header">
          {t.contact.heading}
        </Text>
        <Text style={styles.introText}>{t.contact.intro}</Text>
      </View>

      {!hasAnything ? <EmptyState title={t.empty.content} /> : null}

      {email ? (
        <ContactRow
          icon="mail-outline"
          label={t.contact.email}
          lines={[email]}
          action={{ label: t.contact.writeEmail, url: mailto(email), icon: 'send-outline' }}
        />
      ) : null}
      {phone ? (
        <ContactRow
          icon="call-outline"
          label={t.contact.phone}
          lines={[contact.phoneDisplay.trim() || phone]}
          action={{ label: t.contact.callNow, url: tel(phone), icon: 'call' }}
        />
      ) : null}
      {address.length > 0 || contact.mapUrl.trim() ? (
        <ContactRow
          icon="location-outline"
          label={t.contact.address}
          lines={address.length > 0 ? address : [bundle.site.companyName]}
          action={{ label: t.contact.openMaps, url: mapsUrl(contact.mapUrl, address), icon: 'navigate-outline' }}
        />
      ) : null}
      {hours ? <ContactRow icon="time-outline" label={t.contact.hours} lines={hours.split('\n')} /> : null}
      {website ? (
        <ContactRow
          icon="globe-outline"
          label={t.contact.website}
          lines={[displayUrl(website)]}
          action={{ label: t.common.openWebsite, url: website, icon: 'open-outline' }}
        />
      ) : null}
      {links.length > 0 ? (
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>{upper(t.contact.social)}</Text>
          <SocialRow links={links} />
        </Card>
      ) : null}
    </ScreenScroll>
  );
}

export function ContactScreen() {
  const t = useT();
  return (
    <View style={screenStyles.screen}>
      <Header title={t.contact.title} />
      <OfflineNotice />
      <ContentGate skeleton={<CardSkeleton count={4} cover={false} />}>{(bundle) => <ContactBody bundle={bundle} />}</ContentGate>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  intro: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  heading: {
    ...type.h1,
    color: colors.text,
  },
  introText: {
    ...type.body,
    color: colors.muted,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: spacing.xxs,
  },
  cardLabel: {
    ...type.label,
    color: colors.muted,
    marginBottom: spacing.xxs,
  },
  cardValue: {
    ...type.body,
    color: colors.text,
  },
  cardAction: {
    alignSelf: 'flex-start',
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.mint,
  },
  socialLabel: {
    ...type.small,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.7,
  },
});
