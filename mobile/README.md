# Phibio Mobile (Expo)

Türkçe açıklama aşağıda · English version below.

---

## 🇹🇷 Türkçe

Phibio GmbH'nin App Store ve Google Play için hazırlanmış, Türkçe/İngilizce
mobil uygulaması. İçerik (haberler, ürünler, site metinleri, görseller) Go
arka ucundan (`backend/`) gelir ve yönetim panelinden kod yazmadan düzenlenir.

### Teknoloji

* Expo SDK 57 · React Native 0.86 · TypeScript (strict)
* Ek paket yok: navigasyon, çeviri ve durum yönetimi `src/` içinde elle yazıldı.
  İzinli bağımlılıklar `package.json` içindekilerden ibarettir (`expo`,
  `expo-status-bar`, `expo-splash-screen`, `expo-localization`,
  `react-native-safe-area-context`, `@react-native-async-storage/async-storage`,
  `@expo/vector-icons`).

### Klasör yapısı

```
mobile/
├── App.tsx               sağlayıcılar + splash yönetimi
├── app.json              mağaza ayarları (isim, bundle id, ikon, splash)
├── eas.json              EAS build / submit profilleri
├── .env                  EXPO_PUBLIC_API_URL (commit edilir)
├── .env.local            yerel geçersiz kılma (git-ignored, isteğe bağlı)
├── assets/               ikon, adaptive icon, splash, favicon
├── locales/              iOS görünen ad çevirileri
└── src/
    ├── api/              types.ts (API şekilleri), client.ts (fetch), store.tsx (önbellek + bundle)
    ├── components/       Blocks, Card, Badge, Button, Skeleton, durumlar, RemoteImage …
    ├── i18n/             tr.ts, en.ts, LanguageProvider, useT(), L(), formatDate()
    ├── navigation/       sekmeler + sekme başına yığın, animasyonlu geçiş, Android geri tuşu
    ├── screens/          Home, Products, ProductDetail, News, NewsDetail, About, Contact, Legal
    ├── config.ts         API adresi, zaman aşımı, depolama anahtarları
    └── theme.ts          renk paleti, boşluk/yazı ölçekleri, gölgeler
```

### Çalıştırma (Expo Go)

```bash
cd mobile
npm install
npm start            # QR kodu Expo Go ile okutun
npm run android      # Android emülatörü
npm run ios          # iOS simülatörü (macOS)
```

Arka ucun çalışıyor olması gerekir (`cd backend && go run .`, varsayılan
`http://localhost:8080`). Uygulama açılışta `GET /api/v1/bundle` çağırır,
sonucu AsyncStorage'a yazar ve bir sonraki açılışta önce önbelleği gösterir.

### Ortam değişkenleri

`.env` dosyasındaki `EXPO_PUBLIC_API_URL` arka ucun adresidir. Metro bu değeri
paketleme sırasında gömer; değiştirdikten sonra `npm start`'ı yeniden başlatın.

| Senaryo | Değer |
|---|---|
| iOS simülatörü / aynı bilgisayarda Expo Go | `http://localhost:8080` |
| Android emülatörü | `http://10.0.2.2:8080` |
| Aynı Wi-Fi'daki gerçek cihaz | `http://<bilgisayar-ip>:8080` |
| Üretim | `https://api.phibio.de` |

Yerel değişiklikleri `.env.local` dosyasına yazın (git'e girmez). EAS
derlemeleri için değer `eas.json` içindeki `build.<profil>.env` alanından gelir.

### Dil

İlk açılışta cihaz dili Türkçe ise TR, değilse EN seçilir. Kullanıcı sağ
üstteki TR/EN düğmesiyle dili değiştirir; seçim `phibio.lang` anahtarıyla
saklanır. İçerik alanlarında aktif dil boşsa diğer dile düşülür (`L()`).

### Uygulamanın içeriği nereden alır

* `GET /api/v1/bundle` → site ayarları, yayınlanmış ürünler, en yeni 20 haber.
* Haber detayı `GET /api/v1/news/{slug}` ile istenir ve bellekte tutulur.
* Haber listesinde "Daha fazla göster" `GET /api/v1/news?offset=` çağırır.
* Ağ yoksa önbellek gösterilir ve üstte sarı bir uyarı şeridi çıkar.
* Mağaza listelerindeki gizlilik/künye bağlantıları için arka uç
  `/privacy` ve `/imprint` HTML sayfalarını sunar.

### Mağaza derlemesi (EAS)

```bash
npm install -g eas-cli
eas login
eas init                       # projectId'yi app.json'a yazar (extra.eas.projectId)
eas build --profile preview --platform android   # dağıtılabilir APK
eas build --profile production --platform all    # AAB + IPA
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

* Bundle id / package: `app.json` → `ios.bundleIdentifier`, `android.package`
  (şu an `de.phibio.app`). Sürüm: `version`, `ios.buildNumber`,
  `android.versionCode` (`production` profili `autoIncrement` ile artırır).
* `eas.json` → `submit.production` içindeki `appleId`, `ascAppId`,
  `appleTeamId` yer tutucudur; Apple Developer hesabınızdaki değerlerle
  değiştirin. Google Play için servis hesabı anahtarını
  `mobile/google-service-account.json` olarak kaydedin (git-ignored).
* Uygulama şifreleme kullanmadığından `ITSAppUsesNonExemptEncryption: false`
  ayarlıdır; Android'de ek izin istenmez.

### Doğrulama

```bash
npm run typecheck        # tsc --noEmit
npm run export:android   # Metro ile üretim paketi
npx expo config --type public
```

---

## 🇬🇧 English

Bilingual (Turkish/English) mobile app of Phibio GmbH for the App Store and
Google Play. Content (news, products, site texts, images) comes from the Go
backend (`backend/`) and is edited in the admin panel without any coding.

### Stack

* Expo SDK 57 · React Native 0.86 · TypeScript (strict)
* No extra packages: navigation, i18n and state live in `src/`. The allowed
  dependencies are exactly those in `package.json` (`expo`, `expo-status-bar`,
  `expo-splash-screen`, `expo-localization`, `react-native-safe-area-context`,
  `@react-native-async-storage/async-storage`, `@expo/vector-icons`).

### Layout

See the tree above: `src/api` (types, fetch client, cached store),
`src/components` (block renderer, cards, buttons, skeletons, states),
`src/i18n` (strings + provider), `src/navigation` (tabs + per-tab stacks with
animated transitions and Android back handling), `src/screens`, `src/theme.ts`.

### Run with Expo Go

```bash
cd mobile
npm install
npm start            # scan the QR code with Expo Go
npm run android      # Android emulator
npm run ios          # iOS simulator (macOS)
```

The backend must be running (`cd backend && go run .`, default
`http://localhost:8080`). On start the app calls `GET /api/v1/bundle`, caches
the result in AsyncStorage and renders the cache first on the next launch.

### Environment

`EXPO_PUBLIC_API_URL` in `.env` is the backend origin. Metro inlines it at
bundle time, so restart `npm start` after changing it.

| Scenario | Value |
|---|---|
| iOS simulator / Expo Go on the same machine | `http://localhost:8080` |
| Android emulator | `http://10.0.2.2:8080` |
| Physical device on the same Wi-Fi | `http://<computer-ip>:8080` |
| Production | `https://api.phibio.de` |

Put local overrides in `.env.local` (git-ignored). EAS builds take the value
from `build.<profile>.env` in `eas.json`.

### Language

On first launch the device language decides (Turkish → TR, otherwise EN). The
TR/EN pill in the header switches languages; the choice is stored under
`phibio.lang`. Content fields fall back to the other language when the active
one is empty (`L()`).

### Where content comes from

* `GET /api/v1/bundle` → site settings, published products, 20 newest news.
* Article bodies are fetched with `GET /api/v1/news/{slug}` and cached in memory.
* "Load more" in the news list calls `GET /api/v1/news?offset=`.
* Without network the cache is shown with a yellow notice bar on top.
* The backend serves `/privacy` and `/imprint` HTML pages for the store listings.

### Store builds (EAS)

```bash
npm install -g eas-cli
eas login
eas init                       # writes extra.eas.projectId into app.json
eas build --profile preview --platform android   # shareable APK
eas build --profile production --platform all    # AAB + IPA
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

* Bundle id / package: `app.json` → `ios.bundleIdentifier`, `android.package`
  (currently `de.phibio.app`). Version: `version`, `ios.buildNumber`,
  `android.versionCode` (the `production` profile auto-increments).
* `eas.json` → `submit.production`: replace the `appleId`, `ascAppId` and
  `appleTeamId` placeholders with your Apple Developer values. For Google Play
  save the service-account key as `mobile/google-service-account.json`
  (git-ignored).
* `ITSAppUsesNonExemptEncryption: false` is set (no custom encryption); the
  Android build requests no extra permissions.

### Verification

```bash
npm run typecheck        # tsc --noEmit
npm run export:android   # production bundle through Metro
npx expo config --type public
```
