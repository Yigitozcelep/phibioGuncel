/**
 * Type mirror of docs/API.md and docs/ARCHITECTURE.md §4.
 * All images arrive resolved as `ImageRef` (or `null`).
 */

export type Lang = 'tr' | 'en';

export interface LocalizedString {
  tr: string;
  en: string;
}

export interface ImageRef {
  id: string;
  url: string;
  thumb: string;
  orig: string;
  width: number;
  height: number;
  alt: LocalizedString;
}

export type BlockType = 'heading' | 'paragraph' | 'image' | 'list' | 'quote' | 'button';

export interface Block {
  type: BlockType;
  text?: LocalizedString;
  items?: LocalizedString[];
  image?: ImageRef | null;
  caption?: LocalizedString;
  url?: string;
  label?: LocalizedString;
}

export type NewsCategory = 'news' | 'event' | 'press' | 'product';

export const NEWS_CATEGORIES: readonly NewsCategory[] = ['news', 'event', 'press', 'product'];

export interface NewsSummary {
  id: string;
  slug: string;
  title: LocalizedString;
  summary: LocalizedString;
  cover: ImageRef | null;
  category: NewsCategory | string;
  tags: string[];
  featured: boolean;
  publishedAt: string;
}

export interface News extends NewsSummary {
  blocks: Block[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NewsPage {
  items: NewsSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface Spec {
  label: LocalizedString;
  value: LocalizedString;
}

export interface Document {
  title: LocalizedString;
  url: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  area: string;
  tagline: LocalizedString;
  summary: LocalizedString;
  blocks: Block[];
  features: LocalizedString[];
  specs: Spec[];
  cover: ImageRef | null;
  gallery: (ImageRef | null)[];
  documents: Document[];
  order: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Area {
  key: string;
  name: LocalizedString;
  description: LocalizedString;
  image: ImageRef | null;
}

export interface Stat {
  value: string;
  label: LocalizedString;
}

export interface Contact {
  email: string;
  phone: string;
  phoneDisplay: string;
  addressLines: string[];
  mapUrl: string;
  hours: LocalizedString;
  website: string;
}

export type SocialKind = 'linkedin' | 'instagram' | 'facebook' | 'x' | 'youtube';

export interface SocialLink {
  kind: SocialKind | string;
  url: string;
}

export interface SiteSettings {
  companyName: string;
  slogan: LocalizedString;
  heroTitle: LocalizedString;
  heroSubtitle: LocalizedString;
  heroImage: ImageRef | null;
  aboutTitle: LocalizedString;
  aboutBlocks: Block[];
  stats: Stat[];
  areas: Area[];
  contact: Contact;
  social: SocialLink[];
  imprint: Block[];
  privacy: Block[];
  updatedAt: string;
}

export interface Bundle {
  version: string;
  generatedAt: string;
  site: SiteSettings;
  products: Product[];
  news: NewsSummary[];
  newsTotal: number;
}

export interface ApiErrorBody {
  error: string;
  code: string;
}

/** Bundle as persisted in AsyncStorage, with the time it was fetched. */
export interface CachedBundle {
  bundle: Bundle;
  fetchedAt: string;
}
