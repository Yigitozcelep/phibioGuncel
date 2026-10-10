# Phibio Mobile

Phibio GmbH (https://www.phibio.de) için iki dilli (Türkçe / İngilizce) mobil uygulama, içerik yönetim sunucusu ve kodlama bilmeyen kullanıcılar için masaüstü yönetim paneli.
Bilingual (Turkish / English) mobile app for Phibio GmbH, its content server, and a desktop admin panel for non-technical editors.

```
backend/   Go 1.24 – yalnızca standart kütüphane / standard library only. API + gömülü admin paneli
backend/admin/ui/   Yönetim paneli – saf HTML/CSS/JS, framework yok / vanilla, no framework
mobile/    Expo SDK 57 + React Native + TypeScript – App Store & Google Play için
docs/      Mimari sözleşme, API, yayınlama ve kullanım rehberleri
```

## Hızlı başlangıç / Quick start

### 1. Sunucu / Server
```bash
cd backend
ADMIN_PASSWORD=degistir-beni go run .          # http://localhost:8080
```
* Admin paneli: http://localhost:8080/admin/ (kullanıcı `admin`, şifre yukarıdaki)
* Herkese açık API: http://localhost:8080/api/v1/bundle
* İlk çalıştırmada `backend/data/` klasörü oluşturulur ve phibio.de içeriğiyle (TR+EN) doldurulur.
* Tüm ayarlar ortam değişkenleriyle: `PORT`, `DATA_DIR`, `BASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD`, `MAX_UPLOAD_MB`, `CORS_ORIGINS`, `SEED` (bkz. `backend/README.md`).

### 2. Mobil uygulama / Mobile app
```bash
cd mobile
npm install
# .env içindeki EXPO_PUBLIC_API_URL sunucunuzu göstermeli (Android emülatör: http://10.0.2.2:8080)
npx expo start
```
Telefonda **Expo Go** ile QR kodu okutun. Mağaza derlemeleri için `docs/PUBLISHING.md`.

## Belgeler / Docs
| Dosya | İçerik |
|---|---|
| `docs/ARCHITECTURE.md` | Veri modeli, bileşen sorumlulukları, kurallar (EN) |
| `docs/API.md` | HTTP API (EN) |
| `docs/ADMIN_GUIDE.md` | Yönetim paneli kullanım kılavuzu – kodlama bilmeyenler için (TR + EN) |
| `docs/PUBLISHING.md` | App Store / Google Play yayınlama adımları (TR + EN) |
| `docs/SITE_CONTENT.md` | phibio.de içerik envanteri (seed kaynağı) |
| `backend/README.md` | Sunucu kurulumu, Docker, yedekleme |
| `mobile/README.md` | Uygulama geliştirme ve EAS komutları |

## Tasarım kararları / Design decisions
* **Framework yok:** Go tarafında üçüncü parti modül yok (`go.mod` bağımlılıksız); veri JSON dosyalarında atomik yazımla tutulur, görseller diske kaydedilir ve stdlib ile küçültülür. Admin paneli saf JS'dir ve sunucu ikili dosyasına gömülüdür (tek dosya dağıtım).
* **Mobilde minimum bağımlılık:** expo-router / react-navigation yerine küçük bir yerleşik gezinti; i18n ve durum yönetimi elle yazıldı. Kullanılan paketler: expo, expo-status-bar, expo-splash-screen, expo-localization, react-native-safe-area-context, async-storage, @expo/vector-icons.
* **İçerik modeli:** Her metin `{tr, en}` çiftidir; haberler ve ürünler blok (başlık, paragraf, görsel, liste, alıntı, buton) listesidir. Mobil uygulama ve admin önizlemesi aynı blok → görünüm eşlemesini kullanır.
* **Çevrimdışı:** Uygulama son içeriği cihazda saklar; açılışta anında gösterir, arka planda yeniler.
