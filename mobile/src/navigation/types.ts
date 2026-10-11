import type { AreaKey } from '../theme';

export type Tab = 'home' | 'products' | 'news' | 'about' | 'contact';

export const TABS: readonly Tab[] = ['home', 'products', 'news', 'about', 'contact'];

export type LegalKind = 'imprint' | 'privacy';

export type Route =
  | { name: 'productDetail'; slug: string }
  | { name: 'newsDetail'; slug: string }
  | { name: 'legal'; kind: LegalKind };

export type RouteName = Route['name'];

export type ProductsFilter = AreaKey | 'all';

export interface TabParams {
  products: { area: ProductsFilter };
}

export interface StackEntry {
  key: string;
  route: Route;
  closing: boolean;
}
