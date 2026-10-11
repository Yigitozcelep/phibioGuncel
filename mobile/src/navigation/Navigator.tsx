import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { colors } from '../theme';
import { NavigationContext, type NavigationApi } from './context';
import { StackScreen } from './StackScreen';
import { TabBar } from './TabBar';
import { TABS, type ProductsFilter, type Route, type StackEntry, type Tab } from './types';

type RouteComponents = {
  productDetail: React.ComponentType<{ slug: string }>;
  newsDetail: React.ComponentType<{ slug: string }>;
  legal: React.ComponentType<{ kind: 'imprint' | 'privacy' }>;
};

interface Props {
  tabs: Record<Tab, React.ComponentType>;
  routes: RouteComponents;
  initialTab?: Tab;
}

type Stacks = Record<Tab, StackEntry[]>;

const EMPTY_STACKS: Stacks = { home: [], products: [], news: [], about: [], contact: [] };

function renderRoute(route: Route, routes: RouteComponents): React.ReactElement {
  switch (route.name) {
    case 'productDetail': {
      const Screen = routes.productDetail;
      return <Screen slug={route.slug} />;
    }
    case 'newsDetail': {
      const Screen = routes.newsDetail;
      return <Screen slug={route.slug} />;
    }
    case 'legal': {
      const Screen = routes.legal;
      return <Screen kind={route.kind} />;
    }
  }
}

/**
 * Bottom tabs with one stack per tab. All tabs stay mounted (hidden with
 * `display: none`) so scroll positions survive tab switches.
 */
export function Navigator({ tabs, routes, initialTab = 'home' }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [stacks, setStacks] = useState<Stacks>(EMPTY_STACKS);
  const [productsFilter, setProductsFilter] = useState<ProductsFilter>('all');
  const keyCounter = useRef(0);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const stacksRef = useRef(stacks);
  stacksRef.current = stacks;

  const push = useCallback((route: Route) => {
    const tab = activeTabRef.current;
    keyCounter.current += 1;
    const entry: StackEntry = { key: `${tab}-${keyCounter.current}`, route, closing: false };
    setStacks((prev) => ({ ...prev, [tab]: [...prev[tab], entry] }));
  }, []);

  const pop = useCallback((): boolean => {
    const tab = activeTabRef.current;
    const stack = stacksRef.current[tab];
    const open = stack.filter((e) => !e.closing);
    if (open.length === 0) return false;
    const top = open[open.length - 1];
    setStacks((prev) => ({
      ...prev,
      [tab]: prev[tab].map((e) => (e.key === top.key ? { ...e, closing: true } : e)),
    }));
    return true;
  }, []);

  const removeEntry = useCallback((tab: Tab, key: string) => {
    setStacks((prev) => ({ ...prev, [tab]: prev[tab].filter((e) => e.key !== key) }));
  }, []);

  /** Marks every open screen of a tab as closing (used when re-tapping the active tab). */
  const popToRoot = useCallback((tab: Tab) => {
    if (stacksRef.current[tab].some((e) => !e.closing)) {
      setStacks((prev) => ({ ...prev, [tab]: prev[tab].map((e) => ({ ...e, closing: true })) }));
    }
  }, []);

  const switchTab = useCallback<NavigationApi['switchTab']>((tab, params) => {
    if (tab === 'products' && params && 'area' in params) {
      setProductsFilter(params.area);
    }
    setActiveTab(tab);
  }, []);

  const onTabPress = useCallback(
    (tab: Tab) => {
      if (tab === activeTabRef.current) popToRoot(tab);
      else switchTab(tab);
    },
    [popToRoot, switchTab],
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pop()) return true;
      if (activeTabRef.current !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false; // home root: let the OS handle it
    });
    return () => subscription.remove();
  }, [pop]);

  const canGoBack = stacks[activeTab].some((e) => !e.closing);

  const api = useMemo<NavigationApi>(
    () => ({ activeTab, push, pop, switchTab, canGoBack, productsFilter, setProductsFilter }),
    [activeTab, push, pop, switchTab, canGoBack, productsFilter],
  );

  return (
    <NavigationContext.Provider value={api}>
      <View style={styles.root}>
        <View style={styles.content}>
          {TABS.map((tab) => {
            const Root = tabs[tab];
            const active = tab === activeTab;
            return (
              <View
                key={tab}
                style={[styles.tabPane, !active && styles.hidden]}
                pointerEvents={active ? 'auto' : 'none'}
                accessibilityElementsHidden={!active}
                importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
              >
                <Root />
                {stacks[tab].map((entry) => (
                  <StackScreen
                    key={entry.key}
                    closing={entry.closing}
                    onClosed={() => removeEntry(tab, entry.key)}
                  >
                    {renderRoute(entry.route, routes)}
                  </StackScreen>
                ))}
              </View>
            );
          })}
        </View>
        <TabBar activeTab={activeTab} onPress={onTabPress} />
      </View>
    </NavigationContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  tabPane: {
    ...StyleSheet.absoluteFill,
  },
  hidden: {
    display: 'none',
  },
});
