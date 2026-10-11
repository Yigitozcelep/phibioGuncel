import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ContentProvider, useContent } from './src/api/store';
import { SPLASH_MAX_WAIT_MS } from './src/config';
import { LanguageProvider, useLang } from './src/i18n';
import { Navigator } from './src/navigation';
import {
  AboutScreen,
  ContactScreen,
  HomeScreen,
  LegalScreen,
  NewsDetailScreen,
  NewsScreen,
  ProductDetailScreen,
  ProductsScreen,
} from './src/screens';

// Keep the native splash visible until the cached bundle has been read.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 300, fade: true });

const TABS = {
  home: HomeScreen,
  products: ProductsScreen,
  news: NewsScreen,
  about: AboutScreen,
  contact: ContactScreen,
} as const;

const ROUTES = {
  productDetail: ProductDetailScreen,
  newsDetail: NewsDetailScreen,
  legal: LegalScreen,
} as const;

function hideSplash(): void {
  SplashScreen.hideAsync().catch(() => undefined);
}

function Root() {
  const { cacheChecked } = useContent();
  const { ready: langReady } = useLang();
  const hidden = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hidden.current) {
        hidden.current = true;
        hideSplash();
      }
    }, SPLASH_MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (cacheChecked && langReady && !hidden.current) {
      hidden.current = true;
      hideSplash();
    }
  }, [cacheChecked, langReady]);

  return <Navigator tabs={TABS} routes={ROUTES} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ContentProvider>
          <StatusBar style="light" />
          <Root />
        </ContentProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
