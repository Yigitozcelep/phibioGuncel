# Mağazalara Yayınlama Rehberi / Store Publishing Guide

> Türkçe bölüm önce, İngilizce bölüm aşağıda. / Turkish first, English below.

---

## 🇹🇷 Türkçe

### 1. Gerekli hesaplar
| Hesap | Ücret | Ne için |
|---|---|---|
| Apple Developer Program (developer.apple.com) | 99 USD / yıl | App Store'a yükleme. Şirket adına **Organization** tipi hesap açın (D-U-N-S numarası gerekir, Phibio GmbH için ücretsiz alınır). |
| Google Play Console (play.google.com/console) | 25 USD (tek sefer) | Play Store'a yükleme. Şirket hesabı için **Organization** seçin. |
| Expo hesabı (expo.dev) | Ücretsiz (EAS Build ücretsiz kotası vardır) | Mac'e ihtiyaç duymadan iOS ve Android derlemesi (EAS Build) ve mağazalara gönderim (EAS Submit). |

### 2. Backend'i yayına alın
Mobil uygulama içeriği `backend/` sunucusundan çeker. Yayından önce sunucu internette **HTTPS** ile erişilebilir olmalıdır (ör. `https://api.phibio.de`). Kurulum için `backend/README.md`'ye bakın. Apple, HTTP (şifresiz) bağlantıları reddeder; HTTPS zorunludur.

Mağazalar bir **gizlilik politikası URL'si** ister. Backend bu sayfayı otomatik sunar:
`https://api.phibio.de/privacy` (Türkçe/İngilizce, içerik admin panelindeki "Site Ayarları → Gizlilik" alanından gelir). Künye için `https://api.phibio.de/imprint`.

### 3. Uygulamayı yapılandırın
`mobile/app.json` içinde kontrol edin:
* `expo.name` → mağazada görünen ad: **Phibio**
* `expo.ios.bundleIdentifier` ve `expo.android.package` → `de.phibio.app` (ilk yayından sonra **değiştirilemez**)
* `expo.version` → kullanıcıya görünen sürüm (1.0.0). Her mağaza gönderiminde `ios.buildNumber` ve `android.versionCode` artmalıdır (EAS `autoIncrement` bunu production profilinde otomatik yapar).

Üretim API adresi `mobile/eas.json` içindeki `preview` ve `production` profillerinin `env.EXPO_PUBLIC_API_URL` alanında tanımlıdır (`https://api.phibio.de`); farklı bir alan adı kullanıyorsanız orayı değiştirin. `mobile/.env` yalnızca yerel geliştirme içindir (localhost).

### 4. EAS ile derleme
```bash
cd mobile
npm install
npx eas-cli@latest login            # Expo hesabınızla giriş
npx eas-cli@latest init             # projeyi Expo hesabına bağlar (app.json'a projectId yazar)
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform android --profile production
```
İlk iOS derlemesinde EAS, Apple hesabınıza girip sertifika ve profil oluşturmayı önerir; **Evet** deyin. Android için imza anahtarını EAS üretir ve saklar (yedeğini `eas credentials` ile indirin).

Önce test etmek isterseniz: `--profile preview` ile Android `.apk` ve iOS "internal" derlemesi alın; APK'yı telefona kurabilirsiniz, iOS için TestFlight kullanın.

### 5. Mağazalara gönderim
```bash
npx eas-cli@latest submit --platform ios --latest
npx eas-cli@latest submit --platform android --latest
```
* **iOS:** `eas.json` içindeki `submit.production.ios` alanlarını doldurun (`appleId`, `ascAppId` = App Store Connect'te uygulamayı oluşturduğunuzda verilen sayısal ID, `appleTeamId`). App Store Connect'te önce uygulamayı oluşturun: *My Apps → + → New App* (Bundle ID: de.phibio.app).
* **Android:** Play Console'da uygulamayı oluşturun, *Setup → API access* altından bir **service account** anahtarı (JSON) indirin ve `mobile/google-service-account.json` olarak kaydedin (git'e eklenmez). İlk yüklemeyi Play Console web arayüzünden elle yapmanız gerekir (Google kuralı); sonraki sürümler `eas submit` ile gider.

### 6. Mağaza sayfası için gerekenler
| Öğe | App Store | Google Play |
|---|---|---|
| Uygulama adı | Phibio | Phibio |
| Alt başlık / kısa açıklama | "Inspired by Nature" (App Store alt başlığı en fazla 30 karakter) | "Biotechnology Inspired by Nature" (en fazla 80 karakter) |
| Açıklama | TR ve EN (mağaza dillerini ikisi için de ekleyin) | TR ve EN |
| Kategori | Medical (veya Business) | Medical |
| Ekran görüntüleri | 6.7" (1290×2796) ve 6.5" (1284×2778) zorunlu; iPad 13" (2064×2752) `supportsTablet` açık olduğu için zorunlu | Telefon en az 2 adet (1080×1920 uygun), 512×512 ikon, 1024×500 özellik grafiği |
| Gizlilik politikası URL | https://api.phibio.de/privacy | https://api.phibio.de/privacy |
| Veri toplama beyanı | "Data Not Collected" (uygulama kişisel veri toplamaz, analitik yok) | Data safety: veri toplanmıyor |
| Yaş derecelendirmesi | 4+ (tıbbi bilgi içerir; "Medical/Treatment Information" sorusunda "Infrequent/Mild" seçilebilir) | Anket doldurulur; IARC |
| İletişim | info@phibio.de, 069 40767397 | info@phibio.de |

Ekran görüntüsü almak için uygulamayı iOS Simulator / Android Emulator'da açıp sistem ekran görüntüsü alın; her iki dilde de birkaç görüntü hazırlayın.

### 7. Sürüm güncelleme
1. İçerik değişiklikleri (haber, ürün, metin, görsel) için **uygulama güncellemesi gerekmez** – admin panelinden yapılır, uygulama bir sonraki açılışta çeker.
2. Kod değişikliklerinde `expo.version`'ı artırın, `eas build` + `eas submit` tekrar çalıştırın.

### 8. Sık karşılaşılan reddedilme nedenleri
* HTTPS olmayan API → App Transport Security hatası. Çözüm: sunucuda geçerli TLS sertifikası.
* Gizlilik URL'si açılmıyor → backend'in `/privacy` adresinin dışarıdan erişilebilir olduğunu doğrulayın.
* Boş/çalışmayan içerik → inceleme sırasında sunucu çalışır ve içerik dolu olmalı.
* Apple "minimum functionality": uygulama yalnızca web sitesi sarmalayıcı olmamalı. Bu uygulama yerel (native) ekranlar, çevrimdışı önbellek ve iki dil sunduğu için uygundur.

---

## 🇬🇧 English

### 1. Accounts
| Account | Cost | Purpose |
|---|---|---|
| Apple Developer Program | 99 USD / year | App Store distribution. Enrol as an **Organization** (needs a D-U-N-S number, free for Phibio GmbH). |
| Google Play Console | 25 USD once | Play Store distribution; choose an **Organization** account. |
| Expo (expo.dev) | Free tier available | EAS Build (cloud builds, no Mac needed) and EAS Submit. |

### 2. Deploy the backend
The app loads all content from the Go server in `backend/`. It must be reachable over **HTTPS** (e.g. `https://api.phibio.de`) before release – Apple rejects plain HTTP. See `backend/README.md`.
The stores require a privacy policy URL; the server serves `https://api.phibio.de/privacy` (and `/imprint`) from the texts edited in the admin panel.

### 3. Configure the app
In `mobile/app.json`: `name` = Phibio, `ios.bundleIdentifier` / `android.package` = `de.phibio.app` (cannot change after the first release), `version` 1.0.0; build numbers auto-increment with the production profile.
The production API URL lives in `mobile/eas.json` (`env.EXPO_PUBLIC_API_URL` of the `preview` and `production` profiles); `mobile/.env` is for local development only.

### 4. Build with EAS
```bash
cd mobile && npm install
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform android --profile production
```
Let EAS create the iOS certificates/profiles and the Android keystore (back it up with `eas credentials`). Use `--profile preview` for test builds (Android APK, iOS internal/TestFlight).

### 5. Submit
```bash
npx eas-cli@latest submit --platform ios --latest
npx eas-cli@latest submit --platform android --latest
```
Fill `submit.production` in `eas.json` (Apple ID, App Store Connect app ID, team ID; Google service-account JSON saved as `mobile/google-service-account.json`, git-ignored). Create the app records first in App Store Connect and Play Console; Google requires the very first upload to be done manually in the console.

### 6. Store listing checklist
Name "Phibio"; App Store subtitle "Inspired by Nature" (30-character limit), Play short description "Biotechnology Inspired by Nature"; descriptions in EN and TR; category Medical; screenshots (iPhone 6.7" + 6.5", iPad 13" because tablets are supported; Android phone ≥ 2, 512×512 icon, 1024×500 feature graphic); privacy policy URL `https://api.phibio.de/privacy`; data collection: none (no analytics, no tracking); age rating 4+ / IARC questionnaire; contact info@phibio.de.

### 7. Updates
Content changes never need a new build – they are made in the admin panel. For code changes bump `expo.version`, then build and submit again.

### 8. Common rejection causes
Non-HTTPS API (App Transport Security), unreachable privacy URL, empty content during review, or an app that is only a web wrapper (this app has native screens, offline cache and two languages, which satisfies Apple's minimum-functionality rule).
