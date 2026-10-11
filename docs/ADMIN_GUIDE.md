# Phibio Yönetim Paneli – Kullanım Kılavuzu / Admin Panel User Guide

> **Türkçe** bölüm aşağıda başlar. The **English** section starts at
> [English – Admin Panel User Guide](#english--admin-panel-user-guide).

---

# Türkçe – Yönetim Paneli Kullanım Kılavuzu

Bu kılavuz, Phibio mobil uygulamasının içeriğini (haberler, ürünler, site
metinleri ve görseller) yöneten Phibio çalışanları için yazılmıştır. Teknik
bilgi gerektirmez. Panelde gördüğünüz düğme ve alan adları bu kılavuzda
**kalın** yazılmıştır; böylece ekranda kolayca bulabilirsiniz.

## İçindekiler

1. [Başlamadan önce](#1-başlamadan-önce)
2. [Panele giriş yapma](#2-panele-giriş-yapma)
3. [Genel bakış sayfası](#3-genel-bakış-sayfası)
4. [Haber oluşturma – adım adım](#4-haber-oluşturma--adım-adım)
5. [Canlı telefon önizlemesi](#5-canlı-telefon-önizlemesi)
6. [Kaydetmek ve yayınlamak arasındaki fark](#6-kaydetmek-ve-yayınlamak-arasındaki-fark)
7. [Haberi düzenleme ve silme](#7-haberi-düzenleme-ve-silme)
8. [Ürünler](#8-ürünler)
9. [Site ayarları](#9-site-ayarları)
10. [Görsel kütüphanesi](#10-görsel-kütüphanesi)
11. [Hesap: parola ve yedekleme](#11-hesap-parola-ve-yedekleme)
12. [İyi görseller için ipuçları](#12-iyi-görseller-için-ipuçları)
13. [Uygulama neyi, ne zaman gösterir?](#13-uygulama-neyi-ne-zaman-gösterir)
14. [Sorun giderme](#14-sorun-giderme)
15. [Küçük sözlük](#15-küçük-sözlük)

---

## 1. Başlamadan önce

* Panel **masaüstü bilgisayar** için tasarlanmıştır. Güncel bir Chrome, Edge,
  Safari ya da Firefox kullanın. Tarayıcı penceresi çok darsa (1100 pikselden
  az) panel yerine "Bu panel masaüstü bilgisayarlar için tasarlandı…" uyarısı
  görürsünüz; pencereyi genişletmeniz yeterlidir.
* Panelin kendi dili varsayılan olarak **Türkçe**'dir. Sağ üstteki **TR / EN**
  düğmesiyle İngilizceye geçebilirsiniz. Bu seçim yalnızca panelin menülerini
  değiştirir; içeriğin kendisi her zaman iki dilde girilir.
* Her metin alanı iki sütun hâlindedir: solda **TR** (Türkçe), sağda **EN**
  (İngilizce). Bir dili boş bırakırsanız uygulama o alanda otomatik olarak
  diğer dili gösterir. Yine de her iki dili de doldurmanızı öneririz.
* Alanların sağ üstündeki **TR → EN kopyala** düğmesi, Türkçe metni *boş olan*
  İngilizce alana kopyalar. İngilizce alan doluysa hiçbir şey yapmaz. Çeviriyi
  elle düzeltmeden önce taslak olarak kullanmak için pratiktir.

## 2. Panele giriş yapma

### Giriş adımları

1. Tarayıcınızda panel adresini açın. Adres, sunucu adresinin sonuna
   `/admin/` eklenmiş hâlidir; örneğin `https://api.phibio.de/admin/`.
   (Tam adresi BT sorumlunuzdan alın ve yer imlerinize ekleyin.)
2. **Kullanıcı adı** alanına kullanıcı adınızı yazın. Kurulumda belirlenen
   varsayılan kullanıcı adı `admin`'dir.
3. **Parola** alanına parolanızı yazın.
4. **Giriş yap** düğmesine basın. Başarılı girişten sonra **Genel bakış**
   sayfası açılır.

Giriş kartının altındaki **TR / EN** düğmesiyle daha giriş yapmadan panel
dilini seçebilirsiniz.

### Bilmeniz gereken kurallar

* Beş kez üst üste yanlış parola girilirse, aynı bilgisayardan 15 dakika
  boyunca giriş denemesi yapılamaz ("Çok fazla deneme yaptınız" mesajı).
* Oturumunuz 24 saat boyunca hiçbir işlem yapılmazsa kendiliğinden kapanır.
  Sunucu yeniden başlatıldığında da herkesin oturumu kapanır; yeniden giriş
  yapmanız yeterlidir.
* İşiniz bitince sağ üstteki **Çıkış** düğmesini kullanın. Kaydedilmemiş
  değişiklikleriniz varsa panel sizi uyarır.

### Parolanızı unuttuysanız

Panelde "parolamı unuttum" bağlantısı yoktur; e-posta ile sıfırlama da yoktur.
Parolayı yalnızca sunucuya erişimi olan kişi (BT sorumlunuz) yenileyebilir.
BT sorumlunuza aşağıdakini iletin:

1. Sunucu programı durdurulur.
2. Veri klasöründeki (`DATA_DIR`, genellikle `data/`) `users.json` dosyası
   silinmez, **yeniden adlandırılır** (örneğin `users.json.eski`). Bu dosyada
   yalnızca yönetici hesabı bulunur; haberler ve görseller başka dosyalardadır
   ve bu işlemden etkilenmez.
3. Sunucu, `ADMIN_PASSWORD` ortam değişkenine yeni parola yazılarak yeniden
   başlatılır. Örneğin:
   `ADMIN_PASSWORD='yeni-guclu-parola' ./phibio-server`
   (Docker kullanılıyorsa `-e ADMIN_PASSWORD='…'` ile.)
4. Sunucu, `users.json` dosyasını bulamadığı için `admin` kullanıcısını bu
   parolayla yeniden oluşturur. `ADMIN_PASSWORD` verilmezse sunucu rastgele
   bir parola üretir ve bunu **yalnızca bir kez** başlangıç günlüğüne yazar
   ("Initial admin password: …").
5. Yeni parolayla giriş yapın ve isterseniz **Hesap** sayfasından kendi
   seçtiğiniz bir parolaya değiştirin.

## 3. Genel bakış sayfası

Giriş yaptıktan sonra karşınıza çıkan sayfadır. Soldaki menüden
(**Genel bakış**, **Haberler**, **Ürünler**, **Site ayarları**,
**Görsel kütüphanesi**, **Hesap**) her zaman buraya dönebilirsiniz.

Sayfada şunlar bulunur:

1. **Sayaç kartları** – toplam **Haber** sayısı, bunların kaçının **Yayında**
   olduğu, **Ürün** sayısı ve kütüphanedeki **Görsel** sayısı. Karta
   tıklayınca ilgili listeye gidersiniz.
2. **Yeni haber** kartı – büyük **+ Yeni haber** düğmesiyle doğrudan haber
   editörünü açar. En sık kullanacağınız kısayol budur.
3. **Son düzenlenen haberler** – en son üzerinde çalışılan haberler; satıra
   tıklayınca haber açılır. **Tüm haberler** bağlantısı listeye götürür.
4. **Hızlı erişim** – **Genel API paketi** (uygulamanın sunucudan indirdiği
   içeriği yeni sekmede ham hâliyle gösterir; merak için bakabilirsiniz,
   değiştirmeniz gereken bir şey yoktur), **Ürünler**, **Site ayarları**,
   **Görsel kütüphanesi**.
5. **İpuçları** – panelin en önemli üç kuralını hatırlatır.

## 4. Haber oluşturma – adım adım

### 4.1 Editörü açma

1. Sol menüden **Haberler**'e tıklayın. Liste, her haberin kapak küçük
   resmini, başlığını, **Durum**unu (Taslak / Yayında), **Kategori**sini,
   **Yayın tarihi**ni ve **Güncellendi** tarihini gösterir. Üstteki arama
   kutusuna başlık, adres adı ya da etiket yazarak listeyi süzebilirsiniz.
2. Sağ üstteki **+ Yeni haber** düğmesine basın. Editör açılır: solda form,
   sağda telefon şeklinde **Canlı önizleme**.
3. Editörün üst çubuğunda soldan sağa şunları görürsünüz: **< Haberler** geri
   bağlantısı, sayfa başlığı (**Yeni haber** ya da **Haberi düzenle**),
   kayıt durumu göstergesi (**Kaydedilmedi** / **Tüm değişiklikler
   kaydedildi**), **Taslak / Yayında** açılır listesi, (mevcut haberlerde)
   **Sil** düğmesi ve **Kaydet** düğmesi.

### 4.2 Başlık, özet ve adres adı

1. **Başlık** – zorunlu alandır; en az bir dilde yazılmalıdır. TR ve EN
   sütunlarını doldurun. Uygulamada haber kartlarında ve haberin en üstünde
   görünür.
2. **Özet** – haber kartlarında ve haberin başında görünen 1–2 cümle. Kısa ve
   çekici tutun; detaylar aşağıdaki bloklara yazılır.
3. **Adres adı (slug)** – haberin internet adresinde kullanılan kısa ad
   (örneğin `phibio-mobil-uygulamasi-yayinda`). Başlığı yazdıkça otomatik
   üretilir; Türkçe karakterler çevrilir, yalnızca küçük harf, rakam ve tire
   kullanılır. Normalde dokunmanız gerekmez. Elle değiştirdiyseniz ve yeniden
   başlıktan üretmek isterseniz **Yeniden üret**'e basın. İki haber aynı adres
   adını taşıyamaz; kaydederken "Çakışma" uyarısı alırsanız adres adını
   değiştirin.

### 4.3 Kapak görseli

**Kapak görseli** kartı, haberin uygulamadaki kartında ve haber sayfasının en
üstünde görünecek büyük görseli belirler. Üç yoldan biriyle ekleyebilirsiniz:

* **Yükle** – bilgisayarınızdan bir JPEG, PNG, WebP ya da GIF dosyası seçin.
  Dosyayı doğrudan gri kutunun üstüne sürükleyip bırakabilir ya da kutuya
  tıklayabilirsiniz. Yükleme ilerleme çubuğuyla gösterilir, bitince "Görsel
  yüklendi." mesajı çıkar. Yüklenen görsel aynı anda **Görsel kütüphanesi**'ne
  de eklenir.
* **Kütüphaneden seç** – daha önce yüklenmiş görsellerin listesi açılır.
  Arama kutusuyla dosya adına göre süzebilir, bir görsele tıklayarak
  seçebilirsiniz. Pencere içindeki **Yeni yükle** düğmesi de vardır.
* **Görsel oluştur** – (mor ✦ düğme) markaya uygun bir kapak görselini
  kendiniz, hiçbir tasarım programı kullanmadan hazırlarsınız. Ayrıntı için
  bir sonraki bölüme bakın.

Seçilen görselin köşesinde boyutu (örneğin **1200×675**) görünür. **Kaldır**
düğmesi görseli haberden çıkarır (kütüphaneden silmez).

### 4.4 "Görsel oluştur" penceresi – bütün ayarlar

**Görsel oluştur**'a basınca **Kapak görseli oluştur** penceresi açılır. Solda
görselin canlı hâli, sağda ayarlar vardır. Her ayarı değiştirdiğinizde soldaki
görsel anında güncellenir. Sonuç her zaman 1200 × 675 piksel, PNG biçiminde
olur ve tüm işlem kendi tarayıcınızda yapılır.

**Arka plan**

1. **Marka deseni / Fotoğraf** – arka planın türünü seçin.
2. **Marka deseni** seçiliyken altı renk kutucuğundan birine tıklayın:
   **Turkuaz**, **Koyu turkuaz**, **Mavi**, **Pembe**, **Turkuaz → Mavi**,
   **Koyu**. Renkler Phibio ve uzmanlık alanlarının renkleridir (ortopedi
   için mavi, oftalmoloji için turkuaz, dermatoloji için pembe uygundur).
   Desenin üzerine yumuşak daireler otomatik eklenir.
3. **Fotoğraf** seçince dosya seçme penceresi açılır (**Fotoğraf seç**).
   Fotoğraf, alanı tamamen kaplayacak biçimde ortalanıp kırpılır. Yatay bir
   fotoğraf seçin. **Fotoğrafı kaldır** ile marka desenine geri dönersiniz.
4. **Karartma** (0–70 %) – arka planın üzerine koyu bir perde ekler; yazının
   okunmasını kolaylaştırır. Fotoğraf seçtiğinizde panel bunu kendiliğinden
   %35'e çıkarır; isterseniz kaydırıcıyla ayarlayın.

**Metin**

5. **Metin dili** (**TR / EN**) – başlık ve alt başlık, haberin hangi dilindeki
   metinden alınsın? Kapak görseli tek bir görseldir ve tek dilde yazı taşır;
   genellikle Türkçe yeterlidir. Dil değiştirince metin alanları o dilin
   başlık/özetiyle yeniden doldurulur.
6. **Yerleşim** – yazının yeri: **Sol alt** (varsayılan), **Ortalı**,
   **Sol üst**.
7. **Başlık** – haberin başlığı otomatik gelir; burada görsele özel olarak
   kısaltabilir ya da değiştirebilirsiniz. Satır sonları korunur; uzun
   başlıklar kendiliğinden alt satıra sarılır.
8. **Alt başlık** – isteğe bağlı küçük satır; haberin özeti otomatik gelir.
   Boş bırakabilirsiniz.

**Stil**

9. **Metin rengi** – **Beyaz** (koyu arka planlar için, hafif gölgeyle) ya da
   **Koyu** (açık fotoğraflar için).
10. **Yazı boyutu** (36–110 px) – başlığın büyüklüğü. Alt başlık orantılı
    olarak küçültülür. Başlık üç satırı geçiyorsa boyutu küçültün ya da
    başlığı kısaltın.
11. **"PHIBIO" etiketi** – görselin üstünde küçük "P H I B I O" yazısı.
12. **Phi halkası** – arka planda yarı saydam Φ işareti (marka simgesi).

**Bitirme**

13. **Kapak olarak kullan** – görsel PNG olarak kütüphaneye yüklenir ve bu
    haberin kapak görseli olarak atanır. "Kapak görseli oluşturuldu ve
    atandı." mesajını görürsünüz. Bu, haberi **henüz kaydetmez** – editörde
    **Kaydet**'e basmayı unutmayın.
14. **PNG indir** – aynı görseli bilgisayarınıza indirir (örneğin sosyal
    medyada paylaşmak için). Haberi değiştirmez.
15. **Vazgeç** (ya da sağ üstteki ×, ya da Esc tuşu) – hiçbir şey yapmadan
    kapatır.

### 4.5 İçerik blokları – türler ve ne zaman kullanılır

Haberin gövdesi, alt alta dizilen **bloklardan** oluşur. **İçerik blokları**
kartının altındaki **Blok ekle** satırında altı düğme vardır; birine basınca
listenin sonuna yeni bir blok eklenir ve imleç otomatik olarak o bloğa gider.

| Blok | Ne işe yarar | Ne zaman kullanılır |
|---|---|---|
| **Başlık** | Kalın bölüm başlığı (tek satır, TR/EN). | Uzun haberi bölümlere ayırmak için: "Ürün özellikleri", "Fuar programı" gibi. |
| **Paragraf** | Düz metin (çok satırlı, TR/EN). | Haberin asıl anlatımı. Her düşünce için ayrı bir paragraf bloğu ekleyin; tek bloğa her şeyi yığmayın. |
| **Görsel** | Metnin arasına yerleşen fotoğraf, altında **Açıklama (resim altı)**. | Ürün fotoğrafı, fuar standı, ekip fotoğrafı. |
| **Liste** | Madde işaretli liste. **Liste öğeleri** alanına **her satıra bir madde** yazılır; TR sütunundaki 1. satır, EN sütunundaki 1. satırın karşılığıdır. | Özellik listeleri, adımlar, kısa maddeler. |
| **Alıntı** | Vurgulu, kenar çizgili metin. | Yönetici görüşü, müşteri/doktor yorumu, önemli bir cümle. |
| **Düğme** | Tıklanabilir bağlantı düğmesi: **Düğme metni** (zorunlu, TR/EN) ve **Bağlantı**. | Web sitesine, kayıt formuna, PDF'e yönlendirme; e-posta ya da telefon. |

**Düğme bağlantısı kuralları:** bağlantı şu dört biçimden biriyle başlamalıdır:
`https://…` (web sayfası), `http://…`, `mailto:info@phibio.de` (e-posta
yazdırır) ya da `tel:+496940767397` (arama başlatır). Aksi hâlde alan kırmızı
çerçeveyle işaretlenir ve kaydederken "Bağlantı https://, http://, mailto:
veya tel: ile başlamalı." uyarısı çıkar.

**Görsel bloğuna resim ekleme:**

1. Boş görsel bloğunda **Görseli buraya bırakın / ya da seçmek için tıklayın**
   kutusu vardır. Dosyayı bu kutuya sürükleyip bırakın ya da tıklayıp seçin.
   Yükleme ilerlemesi yüzde olarak gösterilir.
2. Alternatif olarak **Kütüphaneden seç** ile mevcut bir görseli alın.
3. Görsel eklendikten sonra **Değiştir** (yeni dosya yükler),
   **Kütüphaneden seç** ve **Kaldır** düğmeleri görünür.
4. **Açıklama (resim altı)** alanı isteğe bağlıdır; boşsa uygulama, görselin
   kütüphanedeki alternatif metnini gösterir.

**Bir bloğu silme:** blok başlığındaki çöp kutusu simgesine basın. "Blok
silinsin mi?" sorusunu **Sil** ile onaylayın. Blok hemen listeden kalkar;
yine de haber **Kaydet**'e basana kadar sunucuda değişmez.

### 4.6 Blokları sıralama

Her blok kartının başlık satırında şunlar vardır: solda tutma noktası (⋮⋮),
blok türü ve numarası (**Blok 1**, **Blok 2**…), sağda **Yukarı taşı** (˄),
**Aşağı taşı** (˅) ve sil (çöp kutusu) düğmeleri.

* **Oklarla:** ˄ bloğu bir üst sıraya, ˅ bir alt sıraya alır. İlk bloğun ˄,
  son bloğun ˅ düğmesi pasiftir.
* **Sürükleyerek:** tutma noktasına (⋮⋮) basılı tutup bloğu yukarı ya da aşağı
  sürükleyin. Gideceği yer mavi bir çizgiyle gösterilir; bırakınca blok oraya
  yerleşir.

Önizleme her sıralama değişikliğinde yenilenir.

### 4.7 Yayın bilgileri

En alttaki **Yayın bilgileri** kartı:

1. **Kategori** – **Haber**, **Etkinlik**, **Basın** ya da **Ürün**.
   Uygulamada haberin üstünde küçük bir etiket olarak görünür.
2. **Yayın tarihi** – haberin uygulamadaki tarihi ve sıralaması bu alana göre
   belirlenir (en yeni üstte). Boş bırakırsanız, haber ilk kez "Yayında"
   olarak kaydedildiği anda otomatik atanır. **Şimdi** düğmesi şu anki
   tarih-saati yazar, **Temizle** alanı boşaltır. Geçmiş bir tarih girerek
   haberi listede aşağıya alabilirsiniz.
3. **Etiketler** – virgülle ayrılmış anahtar kelimeler (örn. `ortopedi, fuar`).
   Panelde arama yaparken işe yarar.
4. **Öne çıkan haber** – işaretlenirse haber uygulamanın ana sayfasında
   vurgulanır ve "Öne çıkan" rozeti alır. Aynı anda yalnızca bir-iki haberi
   öne çıkarmanız önerilir.

## 5. Canlı telefon önizlemesi

Editörün sağındaki telefon çerçevesi, haberin (ya da ürünün) mobil
uygulamadaki görünümünü gösterir: aynı renkler, aynı yazı tipleri, aynı blok
düzeni. Yazdığınız her harfte kendiliğinden yenilenir.

* Çerçevenin üstündeki **TR / EN** düğmesi, önizlemenin dilini değiştirir.
  Bu, panelin sağ üstündeki dil düğmesinden bağımsızdır: panel Türkçe kalırken
  haberin İngilizce hâlini kontrol edebilirsiniz.
* Önizlemenin içinde kaydırabilirsiniz; değişiklik yaptığınızda kaydırma
  konumu korunur.
* Boş bırakılan bir dilde diğer dilin metninin gösterildiğini burada
  görebilirsiniz.
* Önizleme yalnızca sizin ekranınızdadır; uygulama kullanıcıları ancak
  **Kaydet** + **Yayında** sonrasında görür.

## 6. Kaydetmek ve yayınlamak arasındaki fark

Bu iki kavram birbirinden ayrıdır:

| | Ne yapar | Uygulamada görünür mü? |
|---|---|---|
| **Kaydet** | Formdaki her şeyi sunucuya yazar. | Yalnızca durum **Yayında** ise. |
| Durum **Taslak** | Haber panelde saklanır, listede sarı **Taslak** rozetiyle görünür. | **Hayır.** Uygulama taslakları hiç indirmez. |
| Durum **Yayında** | Haber herkese açıktır. | **Evet** (uygulamanın yenilenmesiyle; bkz. bölüm 13). |

Adımlar:

1. Haberi hazırlarken durum açılır listesinde **Taslak** bırakın ve dilediğiniz
   kadar **Kaydet**'e basın (klavyeden **Ctrl+S**, Mac'te **⌘S** de çalışır).
   Yeni bir haber ilk kez kaydedildiğinde adres çubuğu haberin kalıcı adresine
   geçer ve **Sil** düğmesi belirir.
2. Haber hazır olunca üst çubuktaki açılır listeden **Yayında**'yı seçin.
3. **Kaydet**'e basın. "Haber kaydedildi." mesajını görürsünüz.
4. **Yayın tarihi** boşsa sunucu o anı yazar; dolu ise girdiğiniz tarih
   kullanılır.
5. Bir haberi geri çekmek için durumu **Taslak** yapıp yeniden **Kaydet**'e
   basın; uygulama bir sonraki yenilemede haberi kaldırır.

Üst çubuktaki gösterge size yardımcı olur: **Kaydedilmedi** (sarı) ekranda
sunucuya yazılmamış değişiklik olduğunu, **Tüm değişiklikler kaydedildi**
her şeyin güvende olduğunu söyler. Kaydedilmemiş değişiklik varken başka
sayfaya geçmeye ya da sekmeyi kapatmaya çalışırsanız "Kaydedilmemiş
değişiklikler" uyarısı alırsınız; **Sayfada kal** deyip kaydedin ya da
**Ayrıl** ile değişiklikleri bırakın.

Kaydetme sırasında eksik varsa panel kaydetmez ve nedenini söyler: örneğin
"Başlık en az bir dilde yazılmalı." ya da "İçerik · Blok 5: Bağlantı
https://… ile başlamalı." İlgili alanı düzeltip tekrar deneyin.

## 7. Haberi düzenleme ve silme

**Düzenleme**

1. **Haberler** listesinde satıra tıklayın (ya da **Genel bakış**'taki **Son
   düzenlenen haberler**'den seçin).
2. Dilediğiniz alanı değiştirin; önizleme anında güncellenir.
3. **Kaydet**'e basın. Yayındaki bir haberi düzenleyip kaydettiğinizde
   değişiklik doğrudan yayına girer – büyük değişikliklerde önce önizlemeyi
   iki dilde de kontrol edin.

**Silme**

1. Haberi açın ve üst çubuktaki kırmızı **Sil** düğmesine basın.
2. "Haber silinsin mi?" penceresinde haberin adı gösterilir. **Sil** ile
   onaylayın; **Vazgeç** ile iptal edin.
3. Silme **geri alınamaz**. Haberi yalnızca geçici olarak gizlemek
   istiyorsanız silmek yerine durumunu **Taslak** yapın.
4. Haberde kullanılan görseller kütüphanede kalır; isterseniz oradan ayrıca
   silebilirsiniz.

## 8. Ürünler

Sol menüden **Ürünler**'e girin. Liste her ürünün kapağını, adını, **Alan**ını,
**Sıra** numarasını, **Durum**unu ve güncellenme tarihini gösterir. **+ Yeni
ürün** ile yeni ürün ekler, satıra tıklayarak mevcut ürünü açarsınız. Editör
haber editörüyle aynı mantıkta çalışır (sağda telefon önizlemesi, üstte
**Taslak / Yayında**, **Sil**, **Kaydet**).

Ürün formu yukarıdan aşağıya:

1. **Ürün adı** (zorunlu) – marka adı tüm dillerde aynıdır, örn. `ViscoPhi™`.
   Tek alandır, TR/EN sütunu yoktur.
2. **Alan** – **Ortopedi**, **Oftalmoloji** ya da **Dermatoloji**. Uygulamada
   ürünün renkli alan etiketini ve "alana göre süz" davranışını belirler.
3. **Sıra numarası** – ürün listesindeki sıralama; **küçük sayı önce
   gösterilir** (1, 2, 3…). Aynı sayıdaki ürünler ada göre sıralanır.
4. **Alt başlık** – ürün adının altındaki tek satır (örn. "İntra-artiküler
   viskoelastik implant").
5. **Özet** – kartlarda görünen 1–2 cümle.
6. **Adres adı (slug)** – haberlerdeki gibi otomatik üretilir.
7. **Kapak görseli** – haberlerdeki üç yöntemle aynı (**Yükle**,
   **Kütüphaneden seç**, **Görsel oluştur**). Görsel oluşturucuda başlık
   olarak ürün adı, alt başlık olarak **Alt başlık** gelir.
8. **Öne çıkan özellikler** – her satıra bir özellik yazın. Sol (TR) ve sağ
   (EN) sütundaki satırlar birbirinin karşılığıdır: 3. Türkçe satır ile 3.
   İngilizce satır aynı özelliktir. Uygulamada yeşil onay işaretli liste
   olarak görünür.
9. **Teknik özellikler** – etiket/değer tablosu. **Satır ekle** ile satır
   açılır; her satırda **Etiket (TR)**, **Etiket (EN)**, **Değer (TR)**,
   **Değer (EN)** vardır (örn. Etiket: "Sınıf", Değer: "Sınıf III tıbbi
   cihaz"). Çöp kutusu satırı kaldırır. Tamamen boş satırlar kaydedilmez.
10. **Açıklama** – haberlerdeki blok editörünün aynısı (bölüm 4.5 ve 4.6).
11. **Galeri** – birden fazla görsel. **Yükle** ile birden çok dosyayı aynı
    anda seçebilir, **Görsel ekle** ile kütüphaneden birden çok görsel
    işaretleyip **Seç** diyebilirsiniz. Dosyaları doğrudan galeri alanına
    sürükleyip bırakmak da olur. Her küçük resmin üstünde sırası yazar; ‹ ›
    düğmeleriyle ya da sürükleyerek sırayı değiştirin, çöp kutusuyla
    galeriden çıkarın. Sıra uygulamada aynen korunur.
12. **Belgeler** – broşür, teknik doküman gibi bağlantılar. **Belge ekle** ile
    satır açılır: **Belge başlığı (TR)**, **Belge başlığı (EN)** ve
    **Bağlantı (https://…)**. Belgeler panelden yüklenmez; bir web adresi
    verilir (örneğin web sitenizdeki PDF). Bağlantı `https://` ya da
    `http://` ile başlamalıdır.

Önizlemede ürünün en altında otomatik olarak **Bu ürün hakkında bilgi alın**
düğmesi görünür; bu düğme uygulamada **Site ayarları › İletişim**'deki
e-posta adresine yazdırır, ayrıca eklemeniz gerekmez.

## 9. Site ayarları

Sol menüden **Site ayarları**'na girin. Bu tek sayfa, uygulamanın haber ve
ürün dışındaki bütün metinlerini içerir. Sağdaki içindekiler listesi
(**Giriş bölümü (Hero)**, **Hakkımızda**, **İstatistikler**, **Uzmanlık
alanları**, **İletişim**, **Sosyal medya**, **Künye (Impressum)**, **Gizlilik
politikası**) tıklayınca ilgili bölüme kaydırır. Sayfanın tamamı tek
**Kaydet** düğmesiyle kaydedilir; burada taslak/yayın ayrımı yoktur –
kaydettiğiniz anda geçerlidir.

### Giriş bölümü (Hero)

Ana sayfanın en üstü.

1. **Şirket adı** – örn. `Phibio GmbH` (tek dil).
2. **Slogan** – örn. "Pure and Cure".
3. **Başlık** – örn. "Doğadan İlham Alan Biyoteknoloji" / "Biotechnology
   Inspired by Nature".
4. **Alt başlık** – bir-iki cümle.
5. **Giriş görseli** – ana sayfanın büyük görseli; kapak görseliyle aynı
   şekilde seçilir. **Görsel oluştur**'da başlık ve slogan otomatik gelir.

### Hakkımızda

1. **Bölüm başlığı** – "Hakkımızda" sekmesinin başlığı.
2. **Hakkımızda içeriği** – blok editörü. Şirket tanıtım metni, kalite ve
   sertifika bilgileri için başlık + paragraf blokları kullanın.

### İstatistikler

Ana sayfadaki sayı satırı (örn. **14+** · Yıllık üretim ve araştırma).
**İstatistik ekle** ile satır açılır: **Değer** (kısa, örn. `14+`, `100+`),
**Etiket (TR)**, **Etiket (EN)**. Üç-dört satır idealdir.

### Uzmanlık alanları

Üç alan sabittir: **Ortopedi**, **Oftalmoloji**, **Dermatoloji**. Her biri için
**Alan adı**, **Açıklama** (TR/EN) ve **Alan görseli** düzenlenir. Alan
eklenemez ya da silinemez; ürünler bu üç alandan birine bağlanır.

### İletişim

1. **E-posta** – geçerli bir adres (örn. `info@phibio.de`). Uygulamadaki
   "E-posta gönder" düğmesi bunu kullanır.
2. **Web sitesi** – `https://www.phibio.de` gibi.
3. **Telefon (uluslararası biçim)** – **mutlaka `+` ile başlayan, boşluksuz,
   yalnızca rakamlardan oluşan** numara: `+496940767397`. Uygulamadaki
   "Ara" düğmesi bu numarayı çevirir. Boşluk, parantez ya da `0049`
   yazarsanız panel kaydetmez ve "Telefon numarası + ile başlayıp yalnızca
   rakam içermeli" uyarısı verir.
4. **Telefon (görünen)** – ekranda gösterilen biçim, dilediğiniz gibi:
   `069 40767397`.
5. **Adres** – her satıra bir adres satırı: sokak, posta kodu + şehir, ülke.
6. **Harita bağlantısı** – `https://maps.google.com/?q=…` gibi bir bağlantı;
   uygulamadaki "Haritada göster" düğmesi bunu açar.
7. **Çalışma saatleri** – serbest metin, TR/EN (örn. "Hafta içi 09:00–17:00").

### Sosyal medya

**Bağlantı ekle** ile satır açılır: **Platform** (LinkedIn, Instagram,
Facebook, X (Twitter), YouTube) ve **Profil bağlantısı** (`https://` ile
başlamalı). Bağlantısı boş satırlar kaydedilmez.

### Künye (Impressum) ve Gizlilik politikası

İkisi de blok editörüyle düzenlenir (başlık, paragraf, liste, düğme). Bu iki
metin yalnızca uygulamada değil, mağaza kayıtlarında da kullanılır: sunucu
aynı içeriği `…/privacy` ve `…/imprint` adreslerinde (örn.
`https://api.phibio.de/privacy`) herkese açık web sayfası olarak sunar. App
Store ve Google Play'deki uygulama sayfalarında "Gizlilik politikası" ve
"Yasal bildirim" bağlantıları bu adreslere verilmiştir. Bu nedenle:

* Bu metinleri hukuk danışmanınızla gözden geçirin ve güncel tutun.
* Her iki dili de doldurun; sayfa, ziyaretçinin diline göre gösterilir ve
  üstünde TR/EN geçiş bağlantıları bulunur.
* Bir web adresi olduğundan, kaydeder kaydetmez internette görünür olur.

## 10. Görsel kütüphanesi

Sol menüden **Görsel kütüphanesi**'ne girin. Buraya yüklenen her görsel
haberlerde, ürünlerde ve site ayarlarında tekrar tekrar kullanılabilir.
Editörlerden yüklediğiniz görseller de otomatik olarak burada listelenir.

**Yükleme**

1. Sağ üstteki **Görsel yükle** düğmesine basın ve bir ya da birden çok dosya
   seçin; ya da dosyaları sayfanın **herhangi bir yerine** sürükleyip
   bırakın.
2. İlerleme çubuğu "1/3 yükleniyor…" biçiminde gösterilir; bitince "3 görsel
   yüklendi." mesajı çıkar.
3. Sunucu, JPEG ve PNG dosyalardan otomatik olarak iki küçültülmüş sürüm
   üretir (genişliği 1200 ve 400 piksel); uygulama bunları kullanır, böylece
   büyük orijinal dosya telefonlara indirilmez. WebP ve GIF olduğu gibi
   saklanır.

**Bir görselin bilgileri**

Bir karta tıklayınca sağdaki panelde görünür: büyük önizleme, dosya adı,
**Boyut** (piksel), **Dosya boyutu**, **Tür**, **Yüklendi** tarihi ve
**Sürümler** (orig / w1200 / w400 dosya adları – bilgi amaçlıdır).

**Alternatif metin**

**Alternatif metin** (TR ve EN) görselin kısa sözlü açıklamasıdır; görme
engelli kullanıcıların ekran okuyucuları bunu seslendirir ve görsel bloklarında
resim altı yazısı boşsa bu metin gösterilir. Örneğin "ViscoPhi™ önceden
doldurulmuş şırınga". Yazdıktan sonra **Metni kaydet**'e basın; "Alternatif
metin kaydedildi." mesajı çıkar. Üstteki arama kutusu dosya adında ve
alternatif metinde arar.

**Diğer düğmeler**

* **Bağlantıyı kopyala** – görselin web adresini panoya kopyalar (örneğin
  bir e-postada paylaşmak için).
* **Orijinali aç** – yüklediğiniz dosyayı yeni sekmede tam boyutuyla açar.

**Silme kuralları**

1. **Görseli sil**'e basın ve "Görsel silinsin mi?" sorusunu **Sil** ile
   onaylayın.
2. Görsel bir haberde, üründe ya da site ayarlarında kullanılıyorsa sunucu
   silmeyi **reddeder** ve nerede kullanıldığını söyler, örneğin: "Bu görsel
   kullanımda olduğu için silinemez: haber "Phibio mobil uygulaması
   yayında"." Önce o kayıtta görseli kaldırıp (**Kaldır**) kaydedin, sonra
   tekrar silin.
3. Silme geri alınamaz; dosya sunucudan tamamen kaldırılır.

## 11. Hesap: parola ve yedekleme

Sol menüden **Hesap**'a girin. Üstte "Oturum: admin" yazar.

### Parolayı değiştir

1. **Mevcut parola** alanına şu anki parolanızı yazın.
2. **Yeni parola** ve **Yeni parola (tekrar)** alanlarına yeni parolayı yazın.
   En az 8 karakter olmalı; harf, rakam ve işaret karışımı öneririz.
3. **Parolayı değiştir**'e basın. "Parola değiştirildi." mesajını görürsünüz.
4. Güvenlik için diğer bilgisayar ve tarayıcılardaki oturumlar kapatılır;
   oradaki kişiler yeni parolayla tekrar giriş yapmalıdır. Sizin oturumunuz
   açık kalır.

Tek bir yönetici hesabı vardır; panelden yeni kullanıcı eklenemez. Parolayı
yalnızca içerik girmesi gereken kişilerle paylaşın.

### Yedekleme

**Yedekleme** kartı iki düğme içerir:

* **JSON dışa aktar** – tüm içeriği (site ayarları, haberler, ürünler ve
  görsel kayıtları) tek bir `.json` dosyası olarak bilgisayarınıza indirir.
  Büyük değişikliklerden ya da içe aktarmadan önce mutlaka alın. Dosyayı
  güvenli bir yerde (şirket sürücüsü, bulut) saklayın.
* **JSON içe aktar** – daha önce dışa aktarılmış bir dosyayı seçin. Panel
  dosyada kaç haber, ürün ve görsel kaydı olduğunu gösterir ve "Yedek içe
  aktarılsın mı?" diye sorar. Onaylarsanız **mevcut bütün içerik bu dosyadaki
  içerikle değiştirilir**; bu işlem geri alınamaz. Yanlışlıkla silinen
  içeriği geri getirmek ya da bir sunucudan diğerine taşımak için kullanılır.

**Önemli – görsel dosyaları:** Dışa aktarılan JSON dosyasında görsellerin
yalnızca *kayıtları* (adı, boyutu, alternatif metni) bulunur; fotoğrafların
kendisi **bulunmaz**. Görsel dosyaları sunucudaki veri klasörünün (`DATA_DIR`)
içindeki `uploads/` klasöründedir. Tam bir yedek için BT sorumlunuzun bu
klasörü (en kolayı: veri klasörünün tamamını) düzenli olarak kopyalaması
gerekir. İçe aktarma yaptığınızda da `uploads/` klasörü aynı sunucuda
yerinde durmalıdır; aksi hâlde görsel kayıtları var ama resimler yok olur.

## 12. İyi görseller için ipuçları

* **Yatay (geniş) görseller kullanın.** Uygulamadaki kapak alanları 16:9
  oranındadır; **1200 × 675 piksel ya da daha büyük** görseller idealdir.
  Dikey (portre) fotoğraflar üstten ve alttan kırpılır.
* **20 MB'tan küçük** dosyalar yükleyin; daha büyük dosyalar "Dosya çok
  büyük." uyarısıyla reddedilir. Telefon fotoğrafları genellikle 2–6 MB'tır,
  sorun olmaz.
* Kabul edilen biçimler: JPEG, PNG, WebP, GIF. Fotoğraflar için JPEG, yazı ya
  da logo içeren grafikler için PNG en iyisidir.
* **Fotoğrafı yüklemeden önce doğru yöne çevirin.** Telefonlar bazen
  fotoğrafı yan kaydedip "döndürülmüş" bilgisini dosyaya not düşer. Sunucu bu
  notu uygulamaz; böyle bir fotoğraf uygulamada yan görünür. Fotoğrafı
  bilgisayarınızda açıp gerektiği gibi döndürüp yeniden kaydedin (dışa
  aktarın), sonra yükleyin. Önizlemede yan görünüyorsa sorun budur.
* Fazla büyük görselleri sunucu kendiliğinden küçültür; ama 20–40 megapiksel
  bir fotoğrafı önce 2000 piksel genişliğe indirmek yüklemeyi hızlandırır.
* Her görsele **alternatif metin** yazın (bölüm 10).
* Kapak görsellerinde yazı kullanacaksanız **Görsel oluştur** aracını tercih
  edin: yazı tipleri ve renkler markayla uyumlu olur ve TR/EN için ayrı
  görsel üretmek saniyeler sürer.
* Logolu ya da saydam arka planlı PNG dosyalarında saydam alanlar beyaz
  olarak kaydedilir.

## 13. Uygulama neyi, ne zaman gösterir?

* Uygulama yalnızca durumu **Yayında** olan haber ve ürünleri gösterir.
  Taslaklar hiçbir biçimde telefona gitmez.
* Uygulama **her açılışta** sunucudan güncel içeriği indirir; ayrıca
  kullanıcılar listeleri **aşağı çekerek** (pull-to-refresh) yenileyebilir.
  Uygulama açıkken arka planda kendiliğinden yenilenmez; kullanıcı kapatıp
  açtığında ya da aşağı çektiğinde yeni içerik gelir.
* Sunucu, hız için içeriği **yaklaşık 1 dakika** önbellekte tutar. Yani
  "Kaydet"e bastıktan sonra uygulamanın yeni içeriği görmesi en fazla bir
  dakika sürebilir. Bu normaldir; tekrar kaydetmenize gerek yoktur.
* İnternet yoksa uygulama en son indirdiği içeriği gösterir (çevrimdışı
  kopya). Bu yüzden eski bir telefon, siz sildikten sonra da bir süre eski
  haberi gösterebilir; internete bağlanınca güncellenir.
* Haber listesi en yeni **Yayın tarihi** üstte olacak şekilde sıralanır;
  ürünler **Sıra numarası**na göre sıralanır.
* Uygulamanın dili telefonun diline göre seçilir (Türkçe değilse İngilizce);
  kullanıcı üst çubuktan değiştirebilir. Bir alanda yalnızca tek dil
  doluysa, diğer dilde de o metin gösterilir.

## 14. Sorun giderme

**Giriş yapamıyorum – "Kullanıcı adı veya parola hatalı."**
Büyük/küçük harfe ve klavye diline (Türkçe Q/F) dikkat edin; parolayı önce
bir metin alanına yazıp görerek kopyalamak yardımcı olur. Kullanıcı adı
genellikle `admin`'dir. Beş hatalı denemeden sonra 15 dakika beklemeniz
gerekir ("Çok fazla deneme yaptınız"). Parola gerçekten unutulduysa bölüm
2'deki yenileme adımlarını BT sorumlunuza iletin.

**Giriş sayfası hiç açılmıyor / "Sunucuya ulaşılamadı."**
Adresin sonunda `/admin/` olduğundan emin olun. İnternet bağlantınızı kontrol
edin. Sayfa yine açılmıyorsa sunucu kapalı olabilir; BT sorumlunuza bildirin.

**"Oturumunuz sona erdi, lütfen yeniden giriş yapın."**
24 saat işlem yapılmamış ya da sunucu yeniden başlatılmış. Yeniden giriş
yapın; panel sizi kaldığınız sayfaya götürür. Kaydedilmemiş değişiklikler
kaybolmuş olabilir – uzun yazılarda ara ara **Kaydet**'e basın.

**Görsel yüklenmiyor.**
* "… bir görsel dosyası değil" – yalnızca JPEG, PNG, WebP ve GIF kabul edilir.
  PDF, HEIC (iPhone'un varsayılan biçimi) ya da Word dosyası yüklenemez.
  HEIC fotoğrafı önce JPEG olarak dışa aktarın.
* "Dosya çok büyük." – 20 MB sınırı. Fotoğrafı küçültün.
* Yükleme yarıda kalıyor – bağlantı zayıf olabilir; tekrar deneyin ya da
  daha küçük dosya kullanın.
* Görsel yan görünüyor – bölüm 12'deki döndürme notuna bakın.

**Kaydettim ama uygulamada görünmüyor.**
1. Haberin durumu **Yayında** mı? Listedeki rozet yeşil olmalı.
2. Üst çubukta **Tüm değişiklikler kaydedildi** yazıyor mu? **Kaydedilmedi**
   yazıyorsa henüz sunucuya gitmedi.
3. 1 dakika bekleyin (önbellek), sonra uygulamayı tamamen kapatıp açın ya da
   listeyi aşağı çekerek yenileyin.
4. **Yayın tarihi** ileri bir tarih mi? Haber listede o tarihe göre
   sıralanır; çok geçmiş tarihli bir haber listenin en altına düşer.
5. Hâlâ görünmüyorsa **Genel bakış › Genel API paketi** bağlantısını açın;
   haberin başlığı bu sayfada geçiyorsa sunucu tarafı doğrudur, sorun
   telefondadır (internet, eski sürüm).

**"Kaydedilmemiş değişiklikler" uyarısı çıkıyor.**
Bir editörde değişiklik yaptınız ve kaydetmeden başka sayfaya geçmek,
çıkış yapmak ya da sekmeyi kapatmak üzeresiniz. **Sayfada kal** deyip
**Kaydet**'e basın; değişiklikleri istemiyorsanız **Ayrıl**. Hiçbir şey
değiştirmediğinizi düşünüyorsanız bile bir alana yanlışlıkla boşluk yazılmış
olabilir; kaydetmek zararsızdır.

**Kaydederken "Çakışma" uyarısı alıyorum.**
Aynı **Adres adı (slug)** başka bir haberde/üründe kullanılıyor. Adres adını
değiştirin (örneğin sonuna `-2` ekleyin) ve tekrar kaydedin.

**Görseli silemiyorum – "Bu görsel kullanımda olduğu için silinemez".**
Mesaj, görselin kullanıldığı kayıtları sayar. Önce o haber/ürün/site
ayarından görseli **Kaldır**'ıp kaydedin, sonra silin.

**Panel yerine "Bu panel masaüstü bilgisayarlar için tasarlandı" yazısı var.**
Tarayıcı penceresi çok dar. Pencereyi büyütün ya da bilgisayardan açın;
telefon ve tabletlerde panel çalışmaz.

**Düğme bloğu kırmızı çerçeveli.**
Bağlantı `https://`, `http://`, `mailto:` ya da `tel:` ile başlamıyor ya da
boş. Tam adresi yazın (örn. `https://www.phibio.de`).

## 15. Küçük sözlük

* **Blok** – Haber ya da ürün metnini oluşturan yapı taşı: Başlık, Paragraf,
  Görsel, Liste, Alıntı ya da Düğme. Bloklar alt alta dizilir ve sıraları
  değiştirilebilir.
* **Slug (adres adı)** – Bir haberin/ürünün internet adresinde kullanılan
  kısa, Türkçe karaktersiz ad; örn. `viscophi`. Başlıktan otomatik üretilir
  ve her kayıt için benzersiz olmalıdır.
* **Taslak** – Panelde kayıtlı ama uygulamada **görünmeyen** haber ya da
  ürün. Üzerinde çalışmaya devam edebilirsiniz.
* **Yayında** – Herkese açık, uygulamada görünen haber ya da ürün.
* **Kapak görseli** – Haber/ürün kartında ve sayfanın en üstünde görünen
  büyük, yatay (16:9) görsel. Yüklenebilir, kütüphaneden seçilebilir ya da
  **Görsel oluştur** ile hazırlanabilir.
* **Alternatif metin** – Görselin bir-iki kelimelik sözlü açıklaması; ekran
  okuyucular için ve resim altı yazısı yoksa yedek olarak kullanılır.
* **Öne çıkan** – Ana sayfada vurgulanan haber.
* **Görsel kütüphanesi** – Yüklenen tüm görsellerin saklandığı ortak alan.
* **Dışa / içe aktarma** – İçeriğin tek bir JSON dosyası olarak yedeklenmesi
  / geri yüklenmesi (görsel dosyaları hariç).

---

# English – Admin Panel User Guide

This guide is for Phibio staff who maintain the content of the Phibio mobile
app (news, products, site texts and images). No technical knowledge is
needed. Names of buttons and fields exactly as they appear in the panel are
written in **bold** so you can find them on screen. The panel's interface is
Turkish by default; the English labels below are what you see after
switching the panel to **EN** (top-right corner).

## Contents

1. [Before you start](#1-before-you-start)
2. [Signing in](#2-signing-in)
3. [The Dashboard](#3-the-dashboard)
4. [Creating a news article – step by step](#4-creating-a-news-article--step-by-step)
5. [The live phone preview](#5-the-live-phone-preview)
6. [Saving versus publishing](#6-saving-versus-publishing)
7. [Editing and deleting an article](#7-editing-and-deleting-an-article)
8. [Products](#8-products)
9. [Site settings](#9-site-settings)
10. [Media library](#10-media-library)
11. [Account: password and backups](#11-account-password-and-backups)
12. [Tips for good images](#12-tips-for-good-images)
13. [What the app shows, and when](#13-what-the-app-shows-and-when)
14. [Troubleshooting](#14-troubleshooting)
15. [Short glossary](#15-short-glossary)

---

## 1. Before you start

* The panel is made for **desktop computers**. Use a current Chrome, Edge,
  Safari or Firefox. If the browser window is too narrow (less than 1100
  pixels) you see the notice "This panel is designed for desktop computers…"
  instead of the panel; simply widen the window.
* The panel's own language is Turkish by default. The **TR / EN** switch in
  the top-right corner changes it to English. This only affects the menus;
  the content itself is always entered in both languages.
* Every text field has two columns: **TR** (Turkish) on the left, **EN**
  (English) on the right. If you leave one language empty, the app shows the
  other language in its place. We still recommend filling in both.
* The **Copy TR → EN** button above a field copies the Turkish text into the
  English field *if the English field is empty*. It does nothing when the
  English field already has text. Handy as a starting point before you
  translate by hand.

## 2. Signing in

### Steps

1. Open the panel address in your browser. It is the server address followed
   by `/admin/`, for example `https://api.phibio.de/admin/`. (Ask your IT
   contact for the exact address and bookmark it.)
2. Type your user name into **Username**. The default user created during
   setup is `admin`.
3. Type your password into **Password**.
4. Press **Sign in**. After a successful sign-in the **Dashboard** opens.

The **TR / EN** switch under the sign-in card changes the panel language
before you sign in.

### Rules worth knowing

* After five wrong passwords in a row, sign-in from the same computer is
  blocked for 15 minutes ("Too many attempts. Please wait a moment.").
* A session ends by itself after 24 hours without activity. A server restart
  also signs everyone out; just sign in again.
* When you are done, use **Sign out** in the top-right corner. The panel
  warns you if you still have unsaved changes.

### If the password is lost

There is no "forgot password" link and no e-mail reset. Only the person with
access to the server (your IT contact) can reset the password. Pass the
following on to them:

1. Stop the server program.
2. In the data folder (`DATA_DIR`, usually `data/`) **rename** the file
   `users.json` (for example to `users.json.old`); do not delete it. This
   file only holds the admin account; news, products and images live in other
   files and are not affected.
3. Start the server again with the new password in the `ADMIN_PASSWORD`
   environment variable, for example:
   `ADMIN_PASSWORD='new-strong-password' ./phibio-server`
   (with Docker: `-e ADMIN_PASSWORD='…'`).
4. Because `users.json` is missing, the server recreates the `admin` user
   with that password. If `ADMIN_PASSWORD` is not set, the server generates a
   random password and prints it **once** in its start-up log
   ("Initial admin password: …").
5. Sign in with the new password and, if you like, change it on the
   **Account** page to one of your own choosing.

## 3. The Dashboard

This is the page you land on after signing in. The menu on the left
(**Dashboard**, **News**, **Products**, **Site settings**, **Media library**,
**Account**) brings you back here at any time.

The page contains:

1. **Counter cards** – total number of **News** articles, how many are
   **Published**, the number of **Products** and of **Images** in the
   library. Clicking a card opens the matching list.
2. **New article** card – the large **+ New article** button opens the news
   editor directly. This is the shortcut you will use most.
3. **Recently edited articles** – the articles worked on last; click a row to
   open it. **All news** opens the full list.
4. **Quick links** – **Public API bundle** (opens, in a new tab, the raw
   content the app downloads from the server; only for the curious, there is
   nothing to change there), **Products**, **Site settings**, **Media
   library**.
5. **Tips** – the three most important rules of the panel.

## 4. Creating a news article – step by step

### 4.1 Opening the editor

1. Click **News** in the left menu. The list shows each article's cover
   thumbnail, title, **Status** (Draft / Published), **Category**,
   **Published** date and **Updated** date. The search box at the top filters
   by title, URL name or tag.
2. Press **+ New article** in the top-right corner. The editor opens: the form
   on the left, a phone-shaped **Live preview** on the right.
3. The editor's top bar shows, from left to right: the **< News** back link,
   the page title (**New article** or **Edit article**), the save indicator
   (**Unsaved** / **All changes saved**), the **Draft / Published** dropdown,
   a **Delete** button (existing articles only) and **Save**.

### 4.2 Title, summary and URL name

1. **Title** – required; at least one language must be filled. Fill in both
   TR and EN. It appears on the article cards and at the top of the article.
2. **Summary** – one or two sentences shown on the cards and at the start of
   the article. Keep it short and inviting; details go into the blocks below.
3. **URL name (slug)** – the short name used in the article's web address
   (for example `phibio-mobile-app-is-live`). It is generated automatically
   as you type the title; Turkish characters are converted and only
   lower-case letters, digits and hyphens are used. Normally you never touch
   it. If you changed it by hand and want it generated from the title again,
   press **Regenerate**. Two articles cannot share a URL name; if saving
   reports a "Conflict", change the URL name.

### 4.3 Cover image

The **Cover image** card sets the large picture shown on the article's card
and at the top of the article. You can add one in three ways:

* **Upload** – pick a JPEG, PNG, WebP or GIF file from your computer. You can
  also drag the file onto the grey box or click the box. A progress bar shows
  the upload; "Image uploaded." appears when done. The image is also added to
  the **Media library**.
* **Choose from library** – opens the list of previously uploaded images.
  Filter by file name with the search box and click an image to select it.
  The dialog also has an **Upload new** button.
* **Create cover** – (the purple ✦ button) lets you make an on-brand cover
  yourself, with no design software. See the next section.

The selected image shows its size in the corner (for example **1200×675**).
**Remove** takes the image off the article (it stays in the library).

### 4.4 The "Create cover" dialog – every control

Pressing **Create cover** opens the **Create cover image** dialog. The live
result is on the left, the controls on the right. Every change is reflected
immediately. The result is always 1200 × 675 pixels, PNG, and everything is
done inside your browser.

**Background**

1. **Brand pattern / Photo** – choose the kind of background.
2. With **Brand pattern** selected, click one of the six colour swatches:
   **Teal**, **Deep teal**, **Blue**, **Rose**, **Teal → Blue**, **Dark**.
   These are the Phibio and specialty-area colours (blue suits orthopaedics,
   teal ophthalmology, rose dermatology). Soft circles are added
   automatically.
3. Choosing **Photo** opens the file picker (**Choose photo**). The photo is
   centred and cropped to fill the whole area, so pick a landscape photo.
   **Remove photo** returns to the brand pattern.
4. **Darkening** (0–70 %) – lays a dark veil over the background so the text
   stays readable. When you pick a photo the panel raises it to 35 % by
   itself; adjust with the slider as you like.

**Text**

5. **Text language** (**TR / EN**) – which language's title and summary the
   text is taken from. A cover is one picture with text in one language;
   Turkish is usually enough. Switching the language refills the text fields
   with that language's title/summary.
6. **Layout** – where the text sits: **Bottom left** (default), **Centred**,
   **Top left**.
7. **Title** – prefilled with the article title; shorten or change it here
   for the picture only. Line breaks are kept; long titles wrap by
   themselves.
8. **Subtitle** – optional small line, prefilled with the summary. May be
   left empty.

**Style**

9. **Text colour** – **White** (for dark backgrounds, with a soft shadow) or
   **Dark** (for light photos).
10. **Font size** (36–110 px) – size of the title; the subtitle scales with
    it. If the title runs past three lines, reduce the size or shorten the
    title.
11. **"PHIBIO" tag** – the small "P H I B I O" label at the top.
12. **Phi ring** – the translucent Φ mark (brand symbol) in the background.

**Finishing**

13. **Use as cover** – uploads the picture as a PNG to the library and sets
    it as this article's cover. You see "Cover image created and assigned."
    This does **not** save the article yet – remember to press **Save** in
    the editor.
14. **Download PNG** – downloads the same picture to your computer (for
    example to post on social media). The article is not changed.
15. **Cancel** (or the × in the corner, or the Esc key) – closes without
    doing anything.

### 4.5 Content blocks – the types and when to use them

The body of an article is a stack of **blocks**. The **Add block** row under
the **Content blocks** card has six buttons; pressing one adds a new block at
the end of the list and puts the cursor into it.

| Block | What it is | When to use it |
|---|---|---|
| **Heading** | A bold section heading (one line, TR/EN). | To split a long article into sections: "Product features", "Exhibition programme". |
| **Paragraph** | Plain text (multi-line, TR/EN). | The actual story. Use a separate paragraph block for each thought instead of one giant block. |
| **Image** | A photo in the flow of the text with a **Caption** underneath. | Product photo, exhibition stand, team photo. |
| **List** | A bulleted list. In **List items** write **one item per line**; line 1 of the TR column matches line 1 of the EN column. | Feature lists, steps, short points. |
| **Quote** | Emphasised text with a side rule. | A statement by management, a doctor's or customer's comment, one important sentence. |
| **Button** | A tappable link button: **Button label** (required, TR/EN) and **Link**. | Pointing to the website, a registration form, a PDF; e-mail or phone. |

**Button link rules:** the link must start with one of four prefixes:
`https://…` (web page), `http://…`, `mailto:info@phibio.de` (opens the mail
app) or `tel:+496940767397` (starts a call). Otherwise the field gets a red
border and saving reports "The link must start with https://, http://,
mailto: or tel:".

**Adding a picture to an Image block:**

1. An empty image block shows the box **Drop the image here / or click to
   choose**. Drag the file onto it or click and choose. Progress is shown in
   percent.
2. Alternatively use **Choose from library** for an existing image.
3. Once an image is set you see **Replace** (uploads a new file), **Choose
   from library** and **Remove**.
4. **Caption** is optional; when empty the app shows the image's alt text from
   the library.

**Deleting a block:** press the bin icon in the block's header and confirm
"Delete this block?" with **Delete**. The block disappears at once, but nothing
changes on the server until you press **Save**.

### 4.6 Reordering blocks

Every block card's header has: the drag handle (⋮⋮) on the left, the block
type and number (**Block 1**, **Block 2**…), and on the right **Move up** (˄),
**Move down** (˅) and delete (bin).

* **With the arrows:** ˄ moves the block one place up, ˅ one place down. The
  first block's ˄ and the last block's ˅ are disabled.
* **By dragging:** press and hold the handle (⋮⋮) and drag the block up or
  down. A blue line shows where it will land; release to drop it there.

The preview refreshes after every move.

### 4.7 Publishing

The **Publishing** card at the bottom:

1. **Category** – **News**, **Event**, **Press** or **Product**. Shown as a
   small label above the article in the app.
2. **Publish date** – decides the date shown in the app and the order of the
   list (newest first). If you leave it empty, it is set automatically the
   first time the article is saved as "Published". **Now** inserts the
   current date and time, **Clear** empties the field. Entering an older date
   moves the article further down the list.
3. **Tags** – comma-separated keywords (for example `orthopaedics, fair`).
   Useful when searching in the panel.
4. **Featured article** – when ticked, the article is highlighted on the
   app's home screen and gets a "Featured" badge. Feature only one or two
   articles at a time.

## 5. The live phone preview

The phone frame on the right of the editor shows the article (or product)
exactly as the mobile app renders it: the same colours, fonts and block
layout. It refreshes with every keystroke.

* The **TR / EN** switch above the frame changes the preview language. It is
  independent of the panel language switch in the top-right corner, so you
  can keep the panel in Turkish and still check the English version.
* You can scroll inside the preview; the scroll position is kept while you
  edit.
* You can see here how an empty language falls back to the other language.
* The preview exists only on your screen; app users only see the article
  after **Save** with the status **Published**.

## 6. Saving versus publishing

These are two different things:

| | What it does | Visible in the app? |
|---|---|---|
| **Save** | Writes everything in the form to the server. | Only if the status is **Published**. |
| Status **Draft** | The article is stored in the panel and shows a yellow **Draft** badge in the list. | **No.** The app never downloads drafts. |
| Status **Published** | The article is public. | **Yes** (once the app refreshes; see section 13). |

Steps:

1. While writing, keep the status dropdown on **Draft** and press **Save** as
   often as you like (**Ctrl+S**, or **⌘S** on a Mac, works too). When a new
   article is saved for the first time the address bar switches to its
   permanent address and the **Delete** button appears.
2. When the article is ready, choose **Published** in the dropdown in the top
   bar.
3. Press **Save**. You see "Article saved."
4. If **Publish date** was empty the server fills in the current time;
   otherwise your date is used.
5. To withdraw an article, set the status back to **Draft** and **Save**
   again; the app removes it at its next refresh.

The indicator in the top bar helps: **Unsaved** (yellow) means there are
changes not yet written to the server; **All changes saved** means everything
is safe. If you try to leave the page, sign out or close the tab with unsaved
changes, the "Unsaved changes" dialog appears: choose **Stay on page** and
save, or **Leave** to discard.

If something is missing the panel refuses to save and tells you why, for
example "The title must be filled in at least one language." or "Content ·
Block 5: The link must start with https://…". Fix the field and try again.

## 7. Editing and deleting an article

**Editing**

1. Click a row in the **News** list (or pick one under **Recently edited
   articles** on the Dashboard).
2. Change what you need; the preview updates immediately.
3. Press **Save**. When you edit and save a published article, the change goes
   live directly – for larger edits, check the preview in both languages
   first.

**Deleting**

1. Open the article and press the red **Delete** button in the top bar.
2. The "Delete this article?" dialog shows the article's title. Confirm with
   **Delete** or back out with **Cancel**.
3. Deleting **cannot be undone**. If you only want to hide an article for a
   while, set its status to **Draft** instead.
4. Images used by the article stay in the library; delete them there
   separately if you wish.

## 8. Products

Open **Products** from the left menu. The list shows each product's cover,
name, **Area**, **Order** number, **Status** and update date. **+ New product**
adds a product; clicking a row opens an existing one. The editor works just
like the news editor (phone preview on the right, **Draft / Published**,
**Delete** and **Save** in the top bar).

The product form from top to bottom:

1. **Product name** (required) – the brand name is the same in every
   language, for example `ViscoPhi™`. It is a single field without TR/EN
   columns.
2. **Area** – **Orthopaedics**, **Ophthalmology** or **Dermatology**. Sets
   the coloured area label in the app and the "filter by area" behaviour.
3. **Order number** – position in the product list; **lower numbers are shown
   first** (1, 2, 3…). Products with the same number are sorted by name.
4. **Tagline** – the single line under the product name (for example
   "Intra-articular viscoelastic implant").
5. **Summary** – one or two sentences shown on the cards.
6. **URL name (slug)** – generated automatically, as for news.
7. **Cover image** – the same three methods as for news (**Upload**,
   **Choose from library**, **Create cover**). In the cover dialog the product
   name is used as the title and the **Tagline** as the subtitle.
8. **Key features** – one feature per line. The lines in the left (TR) and
   right (EN) columns correspond: Turkish line 3 and English line 3 are the
   same feature. Shown in the app as a list with green check marks.
9. **Specifications** – a label/value table. **Add row** opens a row with
   **Label (TR)**, **Label (EN)**, **Value (TR)**, **Value (EN)** (for
   example Label: "Class", Value: "Class III medical device"). The bin icon
   removes a row. Completely empty rows are not saved.
10. **Description** – the same block editor as for news (sections 4.5 and
    4.6).
11. **Gallery** – several images. **Upload** lets you pick several files at
    once; **Add images** opens the library where you can tick several images
    and press **Select**. You can also drop files straight onto the gallery
    area. Each thumbnail shows its position; use the ‹ › buttons or drag to
    reorder, and the bin to remove from the gallery. The order is kept in the
    app.
12. **Documents** – links to brochures, technical documents and so on. **Add
    document** opens a row with **Document title (TR)**, **Document title
    (EN)** and **Link (https://…)**. Documents are not uploaded through the
    panel; you enter a web address (for example a PDF on your website). The
    link must start with `https://` or `http://`.

At the bottom of the preview the app automatically shows a **Ask about this
product** button; in the app it opens an e-mail to the address under **Site
settings › Contact**. You do not need to add it yourself.

## 9. Site settings

Open **Site settings** from the left menu. This single page holds every text
of the app that is not a news article or product. The table of contents on
the right (**Hero section**, **About us**, **Statistics**, **Areas of
expertise**, **Contact**, **Social media**, **Imprint (legal notice)**, **Privacy policy**)
scrolls to the matching section. The whole page is saved with one **Save**
button; there is no draft/published distinction here – changes take effect as
soon as you save.

### Hero section

The very top of the home screen.

1. **Company name** – for example `Phibio GmbH` (one language).
2. **Slogan** – for example "Pure and Cure".
3. **Title** – for example "Biotechnology Inspired by Nature".
4. **Subtitle** – one or two sentences.
5. **Hero image** – the large home-screen picture; chosen like a cover image.
   In **Create cover** the title and slogan are prefilled.

### About us

1. **Section title** – the heading of the "About" tab.
2. **About content** – a block editor. Use heading + paragraph blocks for the
   company story, quality and certificate information.

### Statistics

The row of numbers on the home screen (for example **14+** · Years of
production and research). **Add statistic** opens a row with **Value**
(short, e.g. `14+`, `100+`), **Label (TR)**, **Label (EN)**. Three or four
rows look best.

### Areas of expertise

The three areas are fixed: **Orthopaedics**, **Ophthalmology**,
**Dermatology**. For each you edit **Area name**, **Description** (TR/EN) and
**Area image**. Areas cannot be added or removed; every product belongs to one
of these three.

### Contact

1. **E-mail** – a valid address (for example `info@phibio.de`). The app's
   "Send e-mail" button uses it.
2. **Website** – for example `https://www.phibio.de`.
3. **Phone (international format)** – **must start with `+`, contain no
   spaces and only digits**: `+496940767397`. The app's "Call" button dials
   this number. If you type spaces, brackets or `0049`, the panel refuses to
   save and shows "The phone number must start with + and contain only
   digits".
4. **Phone (display)** – the format shown on screen, any way you like:
   `069 40767397`.
5. **Address** – one address line per line: street, postcode + city, country.
6. **Map link** – a link such as `https://maps.google.com/?q=…`; the app's
   "Show on map" button opens it.
7. **Opening hours** – free text, TR/EN (for example "Weekdays 9:00–17:00").

### Social media

**Add link** opens a row with **Platform** (LinkedIn, Instagram, Facebook,
X (Twitter), YouTube) and **Profile link** (must start with `https://`).
Rows with an empty link are not saved.

### Imprint (legal notice) and Privacy policy

Both are edited with the block editor (heading, paragraph, list, button).
These two texts are used not only in the app but also for the store
listings: the server publishes the same content as public web pages at
`…/privacy` and `…/imprint` (for example `https://api.phibio.de/privacy`).
The "Privacy policy" and "Legal notice" links on the App Store and Google
Play listings point to these addresses. Therefore:

* Have these texts reviewed by your legal adviser and keep them up to date.
* Fill in both languages; the page is shown in the visitor's language and has
  TR/EN links at the top.
* Because it is a web address, the text is visible on the internet the moment
  you save.

## 10. Media library

Open **Media library** from the left menu. Every image uploaded here can be
reused in news, products and site settings. Images uploaded from the editors
are listed here automatically as well.

**Uploading**

1. Press **Upload images** in the top-right corner and choose one or more
   files; or drag files **anywhere onto the page**.
2. A progress bar shows "Uploading 1/3…"; when done, "3 images uploaded."
   appears.
3. For JPEG and PNG files the server automatically produces two smaller
   versions (1200 and 400 pixels wide); the app uses these so the large
   original is never sent to phones. WebP and GIF files are stored as they
   are.

**An image's details**

Click a card and the panel on the right shows: a large preview, the file
name, **Dimensions** (pixels), **File size**, **Type**, **Uploaded** date and
**Variants** (the orig / w1200 / w400 file names – for information only).

**Alternative text**

**Alternative text** (TR and EN) is a short spoken description of the image; screen
readers for visually impaired users read it aloud, and it is used in image
blocks when the caption is empty. For example "ViscoPhi™ prefilled syringe".
After typing, press **Save text**; "Alternative text saved." appears. The search box
at the top searches file names and alt texts.

**Other buttons**

* **Copy link** – copies the image's web address to the clipboard (for
  example to share in an e-mail).
* **Open original** – opens the file you uploaded in a new tab at full size.

**Deletion rules**

1. Press **Delete image** and confirm "Delete this image?" with **Delete**.
2. If the image is used by an article, a product or the site settings, the
   server **refuses** and tells you where it is used, for example: "This
   image is in use and cannot be deleted: news "Phibio mobile app is live"."
   First **Remove** the image from that record and save, then delete again.
3. Deletion cannot be undone; the file is removed from the server completely.

## 11. Account: password and backups

Open **Account** from the left menu. The header says "Signed in as admin".

### Change password

1. Type your current password into **Current password**.
2. Type the new password into **New password** and **New password (repeat)**.
   At least 8 characters; we recommend a mix of letters, digits and symbols.
3. Press **Change password**. You see "Password changed."
4. For safety, sessions on other computers and browsers are signed out; people
   there must sign in again with the new password. Your own session stays
   open.

There is a single administrator account; new users cannot be added from the
panel. Share the password only with people who need to enter content.

### Backup

The **Backup** card has two buttons:

* **Export JSON** – downloads all content (site settings, news, products and
  image records) as one `.json` file. Always take one before big changes or
  before importing. Keep the file in a safe place (company drive, cloud).
* **Import JSON** – choose a previously exported file. The panel shows how
  many articles, products and image records it contains and asks "Import
  this backup?". If you confirm, **all current content is replaced by the content
  of that file**; this cannot be undone. Use it to restore accidentally
  deleted content or to move content from one server to another.

**Important – image files:** the exported JSON file contains only the
*records* of the images (name, size, alt text); the pictures themselves are
**not** included. The image files live in the `uploads/` folder inside the
server's data folder (`DATA_DIR`). For a complete backup your IT contact must
copy that folder (easiest: the whole data folder) regularly. When you import,
the `uploads/` folder must still be in place on the same server; otherwise
the image records exist but the pictures are missing.

## 12. Tips for good images

* **Use landscape (wide) images.** Cover areas in the app have a 16:9 ratio;
  **1200 × 675 pixels or larger** is ideal. Portrait photos are cropped at
  the top and bottom.
* Upload files **smaller than 20 MB**; larger files are rejected with "The
  file is too large." Phone photos are usually 2–6 MB, which is fine.
* Accepted formats: JPEG, PNG, WebP, GIF. JPEG is best for photos, PNG for
  graphics with text or logos.
* **Rotate photos the right way up before uploading.** Phones sometimes save
  a photo sideways and only note "rotated" inside the file. The server does
  not apply that note, so such a photo appears sideways in the app. Open the
  photo on your computer, rotate it as needed, save (export) it again, then
  upload. If it looks sideways in the preview, this is the cause.
* The server shrinks oversized images by itself, but reducing a 20–40
  megapixel photo to about 2000 pixels wide first makes uploads faster.
* Give every image an **alternative text** (section 10).
* For covers with text on them, prefer the **Create cover** tool: fonts and
  colours match the brand, and making separate TR and EN versions takes
  seconds.
* In PNG files with transparent areas, the transparent parts are saved as
  white.

## 13. What the app shows, and when

* The app only shows news and products whose status is **Published**. Drafts
  never reach the phone in any form.
* The app downloads the current content from the server **every time it is
  opened**; users can also **pull down** a list to refresh. While the app
  stays open it does not refresh by itself; new content arrives when the user
  reopens the app or pulls to refresh.
* For speed, the server keeps content in a cache for **about 1 minute**. So
  after pressing Save it can take up to a minute before the app sees the new
  content. This is normal; there is no need to save again.
* Without internet the app shows the content it downloaded last (offline
  copy). An older phone may therefore still show an article for a while after
  you deleted it; it updates once it is online.
* The news list is ordered by **Publish date**, newest first; products are
  ordered by **Order number**.
* The app's language follows the phone's language (English unless the phone
  is in Turkish); the user can switch it in the header. When only one
  language of a field is filled, that text is shown in the other language
  too.

## 14. Troubleshooting

**I cannot sign in – "Incorrect username or password."**
Check upper/lower case and the keyboard layout; typing the password into a
visible text field first and copying it helps. The user name is usually
`admin`. After five failed attempts you must wait 15 minutes ("Too many
attempts"). If the password is really lost, pass the reset steps from
section 2 to your IT contact.

**The sign-in page does not open / "The server could not be reached."**
Make sure the address ends in `/admin/`. Check your internet connection. If
the page still does not open the server may be down; tell your IT contact.

**"Your session has ended, please sign in again."**
24 hours passed without activity, or the server was restarted. Sign in again;
the panel brings you back to the page you were on. Unsaved changes may be
lost – press **Save** now and then while writing long texts.

**An image will not upload.**
* "… is not an image file" – only JPEG, PNG, WebP and GIF are accepted. PDF,
  HEIC (the iPhone default) or Word files cannot be uploaded. Export HEIC
  photos as JPEG first.
* "The file is too large." – the limit is 20 MB. Shrink the photo.
* The upload stops halfway – the connection may be weak; try again or use a
  smaller file.
* The image appears sideways – see the rotation note in section 12.

**I saved, but the app does not show it.**
1. Is the status **Published**? The badge in the list must be green.
2. Does the top bar say **All changes saved**? If it says **Unsaved**, the
   change has not reached the server yet.
3. Wait one minute (cache), then close the app completely and reopen it, or
   pull the list down to refresh.
4. Is the **Publish date** in the future or far in the past? The list is
   ordered by this date; an article with an old date sinks to the bottom.
5. If it still does not appear, open **Dashboard › Public API bundle**. If
   the article's title appears on that page, the server side is correct and
   the problem is on the phone (internet, old version).

**The "Unsaved changes" warning appears.**
You changed something in an editor and are about to leave the page, sign
out or close the tab without saving. Choose **Stay on page** and press
**Save**; if you do not want the changes, choose **Leave**. Even if you think
you changed nothing, a stray space may have been typed into a field; saving
is harmless.

**Saving reports a "Conflict".**
The same **URL name (slug)** is used by another article/product. Change the
URL name (for example add `-2`) and save again.

**I cannot delete an image – "This image is in use and cannot be deleted".**
The message lists the records using the image. First **Remove** the image
from that article/product/site setting and save, then delete it.

**Instead of the panel I see "This panel is designed for desktop computers".**
The browser window is too narrow. Enlarge the window or open the panel on a
computer; it does not work on phones and tablets.

**A button block has a red border.**
The link does not start with `https://`, `http://`, `mailto:` or `tel:`, or
it is empty. Type the full address (for example `https://www.phibio.de`).

## 15. Short glossary

* **Block (blok)** – a building brick of an article or product text: Heading,
  Paragraph, Image, List, Quote or Button. Blocks are stacked and can be
  reordered.
* **Slug (URL name, adres adı)** – the short name without special characters
  used in an article's or product's web address, e.g. `viscophi`. Generated
  from the title; must be unique.
* **Draft (taslak)** – an article or product stored in the panel but **not
  visible** in the app. You can keep working on it.
* **Published (yayında)** – public; visible in the app.
* **Cover image (kapak görseli)** – the large landscape (16:9) picture on an
  article/product card and at the top of its page. Uploaded, chosen from the
  library or made with **Create cover**.
* **Alt text** – a few words describing an image; used by screen readers and
  as a fallback caption.
* **Featured** – an article highlighted on the home screen.
* **Media library** – the shared store of every uploaded image.
* **Export / Import** – backing up / restoring the content as one JSON file
  (image files not included).
