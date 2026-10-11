import { createContext, useContext } from 'react';

import type { ProductsFilter, Route, Tab, TabParams } from './types';

export interface NavigationApi {
  activeTab: Tab;
  /** Pushes a detail screen onto the active tab's stack. */
  push: (route: Route) => void;
  /** Pops the active tab's top screen. Returns false when there is nothing to pop. */
  pop: () => boolean;
  /** Switches the bottom tab; optional params are applied to the target tab. */
  switchTab: <T extends Tab>(tab: T, params?: T extends keyof TabParams ? TabParams[T] : undefined) => void;
  canGoBack: boolean;
  /** Current area filter of the Products tab (set via chips or `switchTab`). */
  productsFilter: ProductsFilter;
  setProductsFilter: (filter: ProductsFilter) => void;
}

export const NavigationContext = createContext<NavigationApi | null>(null);

export function useNavigation(): NavigationApi {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used inside <Navigator>');
  return ctx;
}
