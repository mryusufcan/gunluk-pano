# Günün Panosu · Radyoloji

Radyoloji departmanının günlük operasyon panosu: **günün ekibi**, **günün yemeği** ve **notlar**. Veri artık tarayıcıda değil, sitenin yanındaki **`content.json`** dosyasında tutulur.

- **Ekip** normal adresi açar, sadece **görüntüler**; düzenleme düğmesi görmez.
- **Yönetici** (`?admin=1`) düzenler, listeyi içe aktarır ve **Yayınla** ile `content.json` dosyasını GitHub'a yazar. GitHub Pages 1-2 dakikada yeni hâli yayınlar.

**Canlı site:** [mryusufcan.github.io/gunluk-pano](https://mryusufcan.github.io/gunluk-pano/) · **Yönetim:** [../?admin=1](https://mryusufcan.github.io/gunluk-pano/?admin=1) · **Depo:** [github.com/mryusufcan/gunluk-pano](https://github.com/mryusufcan/gunluk-pano)

Kurulum, hesap veya uygulama mağazası gerekmez; iPhone ve Android tarayıcısında açılır, masaüstünde düzenli bir sürümü vardır.

## Nasıl çalışır

```
Yönetici (telefon)                      GitHub                        Ekip (telefon)
?admin=1  ──düzenle──▶  taslak  ──Yayınla──▶  content.json  ──▶  GitHub Pages  ──▶  index.html
                                                                        (salt görüntüleme)
```

- İçerik tek kaynaktan gelir: `content.json`.
- Tarayıcıda kalıcı veri tutulmaz; yalnızca yöneticinin **taslağı** ve son içeriğin **çevrimdışı önbelleği** cihazda durur.
- Görüntüleyicide yazma yolu yoktur; düzenleme düğmeleri hiç gösterilmez.

## Özellikler

- **Günün ekibi:** vardiyaya göre gruplu liste (08–16, 16–24, 24–08, icap, idari, izinli), görev etiketi, telefon/dahili için `tel:` bağlantısı, kişi notu.
- **Günün yemeği:** çok satırlı menü; dünkü menüyü kopyalama.
- **Notlar:** yazar, saat, sabitleme, tamamlandı işareti, Tümü / Bugün / Sabitlenen / Açık filtreleri.
- **Hızlı erişim:** PACS, RIS veya ekip grubu bağlantıları.
- **Liste içe aktarma (yönetici):** haftalık/aylık çalışma listesini veya yemek listesini yapıştırın ya da `.xlsx` / `.docx` seçin; tarih, gün adı, vardiya, isim ve cihaz otomatik ayrılır, aktarmadan önce önizleme gösterilir.
- **Aylık ızgara:** üst satırı gün numaraları (`1 2 3 … 30`) olan tablolar ve dikey gün numaralı listeler desteklenir.
- **Duyuru şeridi:** acil bilgi (ör. "BT 14:00–16:00 arası bakımda") panonun üstünde bant olarak; bilgi veya uyarı tonu seçilebilir.
- **Son güncelleme satırı:** ekip, gördüğü içeriğin ne zaman yayınlandığını görür.
- **Canlı yayın kontrolü:** yönetici yayından sonra tek düğmeyle canlı sürümün çıkıp çıkmadığını doğrular.
- **Otomatik tazelik:** gece yarısı kendiliğinden yeni güne geçer, açık kalan ekran 5 dakikada bir sessizce yenilenir.
- **Paylaşım:** günün özeti (duyuru dahil) WhatsApp metni olarak gönderilir.
- **Çevrimdışı:** son içerik önbellekte; internet yokken gösterilir, gelince yenilenir.
- Aydınlık / gece teması (cihaz başına).

## Kurulum

Bu depo için kurulum tamamlandı (Pages açık, `main` dalına push otomatik yayınlanır). Sıfırdan kurmak isterseniz:

1. Bu klasörün içeriğini yeni bir GitHub deposuna koyun (örnek: `gunluk-pano`).
2. Depo → **Settings → Pages → Build and deployment → Source: GitHub Actions**. `main` dalına her push'ta yayınlanır.
3. Adres: `https://<kullanıcı>.github.io/gunluk-pano/`
4. Yönetici anahtarı: GitHub → **Settings → Developer settings → Fine-grained tokens → Generate new token**
   - Repository access: **Only select repositories** → bu depo
   - Permissions → **Contents: Read and write**
   - Süre: ihtiyacınız kadar (ör. 1 yıl). Anahtarı not edin; bir daha gösterilmez.
5. Telefonda `https://<kullanıcı>.github.io/gunluk-pano/?admin=1` açın → **Ayarlar → GitHub yayını**:
   - Depo: `kullanıcı/gunluk-pano`, Dal: `main`, Dosya: `content.json`
   - Anahtarı yapıştırın → **Ayarları kaydet** → **Bağlantıyı dene**.
6. Artık her düzenlemeden sonra **Yayınla**. Ekip normal adresi açtığında son hâli görür.

> Anahtarı olmayan biri `?admin=1` sayfasını açsa bile yalnızca kendi tarayıcısında taslak oluşturabilir; yayınlayamaz.

### Anahtar oluşturmadan yayınlama

Anahtar istemiyorsanız: düzenleyin → **Veri → content.json kopyala** → **GitHub'da content.json'u düzenle** bağlantısına dokunun → dosyadaki metni silip kopyaladığınızı yapıştırın → **Commit changes**. Yayın yine 1-2 dakikada görünür.

## Yönetici kullanımı

1. `?admin=1` adresini açın (yer imine ekleyin). Duyuruları **Ayarlar → Duyuru şeridi**'nden yazın; üstteki düzenle düğmesi de oraya götürür.
2. Üstteki turuncu/kırmızı yazı **"Yayınlanmamış değişiklikler var"** olduğunda değişiklikler yalnızca sizde demektir.
3. Ekip / Yemek / Notlar sekmelerinde düzenleyin. **Listeden içe aktar** ile Excel, Word veya WhatsApp metnini kullanın.
4. **Yayınla** → "Yayınlandı" yazısı çıkar. GitHub Pages 1-2 dakika içinde güncellenir.
5. Ekip sayfayı yenilediğinde (ya da birkaç dakika sonra kendiliğinden) yeni içeriği görür.

Yarım kalan işler kaybolmaz: değişiklikler taslak olarak cihazda durur, sayfayı kapatıp açsanız da geri gelir. Taslağı atmak için tarayıcı verilerini temizlemek yerine **Ayarlar → Veri → Tüm verileri sil** (yalnızca taslağı ve önbelleği siler, yayındaki içeriğe dokunmaz) kullanılabilir.

## Yedekleme ve geri alma

- **Ayarlar → Veri → Yedek al**: o anki içeriği `.json` olarak indirir.
- Yayınlanan her sürüm GitHub'da commit geçmişinde durur: `content.json → History` ile eski hâle dönüp yeni commit atabilirsiniz.
- Anahtar olmadan da yayın yapmak isterseniz: **Veri → content.json indir** ile dosyayı indirip GitHub'da `content.json` dosyasını düzenleyip yapıştırabilirsiniz.

## Yerel önizleme

`index.html` dosyasını doğrudan açmak çalışmaz (tarayıcı `content.json` isteğini engeller). Basit bir sunucu kullanın:

```bash
cd gunluk-pano
python3 -m http.server 8080
```

- Görüntüleme: http://localhost:8080/
- Yönetim: http://localhost:8080/?admin=1

Yayın ayarları olmadan da düzenleyip `content.json` indirebilirsiniz.

## Dosya yapısı

```
index.html            arayüz (görüntüleme + yönetici modu)
styles.css            mobil + masaüstü stilleri
app.js                tüm işlevler (bağımlılık yok)
content.json          YAYINLANAN İÇERİK — tek veri kaynağı
manifest.webmanifest  uygulama bilgileri
sw.js                 çevrimdışı kabuk; content.json her zaman ağdan
assets/               simgeler
tests/                uçtan uca testler ve örnek dosyalar
tools/                simge ve test dosyası üreticileri
```

## Test

```bash
npm install          # yalnızca jsdom, geliştirme bağımlılığı
npm test             # 80 kontrol: görüntüleme, yönetici, yayın API'si,
                     # duyuru, içe aktarma, önbellek, bozuk içerik
```

## Sınırlar

- Yayın sonrası görünüm GitHub Pages'in önbelleğine bağlıdır; genelde 1-2 dakika, bazen 5 dakika sürebilir.
- Arayüz dosyalarını (`index.html`, `app.js`, `styles.css`) değiştirirseniz `sw.js` içindeki `CACHE` sürümünü artırın; statik dosyalar önce ağdan denense de eski sekme açık kalabilir.
- Ekip not ekleyemez; notlar yönetici tarafından yazılır (talep edilirse ayrı bir yazma servisi gerekir).
- Fotoğraf/PDF listeler tarayıcıda okunamaz (OCR yok); metin, Excel veya Word kullanılmalı.
- Anahtar cihazda saklanır; ortak kullanılan bir telefonda tarayıcı verilerini paylaşmayın.

## Lisans

MIT
