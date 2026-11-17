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

- **Günün ekibi:** vardiyaya göre gruplu liste (08–16, 16–24, 24–08, idari, izinli); geçerli vardiya açık, diğerleri tek satıra katlanmış. Telefon/dahili için `tel:` bağlantısı, kişi notu.
- **Günün yemeği:** ekip ekranının altında kart; çok satırlı menü, dünkü menüyü kopyalama.
- **Notlar:** etiketli (Sabit / Arıza / Duyuru / Hatırlatma), durum noktalı (Açık / Tamamlandı), yazar, saat, sabitleme; Tümü / Bugün / Sabit / Açık filtreleri.
- **Telefon rehberi:** ayrı sekme; arama kutusu üst başlıkta, sık kullanılanlar kutucuk olarak, sonuçlarda arama düğmesi. Yönetici Ayarlar'dan satır ekleyip düzenler, yıldızla sık kullanılana alır.
- **Liste içe aktarma (yönetici):** haftalık/aylık çalışma listesini veya yemek listesini yapıştırın ya da `.xlsx` / `.docx` seçin; tarih, gün adı, vardiya, isim ve cihaz otomatik ayrılır, aktarmadan önce önizleme gösterilir.
- **Aylık ızgara:** üst satırı gün numaraları (`1 2 3 … 30`) olan tablolar ve dikey gün numaralı listeler desteklenir.
- **Duyuru şeridi:** acil bilgi (ör. "BT 14:00–16:00 arası bakımda") panonun üstünde bant olarak; bilgi veya uyarı tonu seçilebilir.
- **Son güncelleme satırı:** ekip, gördüğü içeriğin ne zaman yayınlandığını görür.
- **Canlı yayın kontrolü:** yönetici yayından sonra tek düğmeyle canlı sürümün çıkıp çıkmadığını doğrular.
- **Otomatik tazelik:** gece yarısı kendiliğinden yeni güne geçer, açık kalan ekran 5 dakikada bir sessizce yenilenir.
- **Paylaşım:** günün özeti (duyuru dahil) WhatsApp metni olarak gönderilir.
- **Çevrimdışı:** son içerik önbellekte; internet yokken gösterilir, bağlantı gelince kendiliğinden yenilenir. Yöneticide önce **taslak** yüklenir, yayın düğmesi kapanır; bağlantı gelince "Yayınla" yeniden açılır.
- **Sakin Klinik teması:** tek turkuaz vurgu, yumuşak kartlar, hap biçimli düğmeler; açık ve gece modu (cihaz başına hatırlanır). Yazı tipi Inter, uygulamayla birlikte gelir (internet gerekmez).

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

## Haftalık çizelge senkronu

Ekip listesi, departmanın Google E-Tablo'sundaki haftalık çalışma listesinden otomatik gelir:

- Google E-Tablo: haftalık çalışma listesi (`10-i9GB...JT-5I`), herkese açık bağlantı.
- `tools/sync_schedule.py` çizelgeyi indirir, günleri/kişileri/vardiyaları ayrıştırır ve **yalnızca ekip alanlarını** `content.json`'a yazar.
- `.github/workflows/sync-schedule.yml` bu betiği **her pazar 21:00'de** (Türkiye saati) çalıştırır; liste cumartesi kesinleştiği için haftada bir yeterli. Değişiklik varsa commit eder, Pages kendiliğinden yayınlar.
- Elle çalıştırmak için: GitHub → **Actions → Çizelgeyi senkronla → Run workflow**.
- Yemek, not, duyuru ve ayarlara dokunulmaz. Telefon numaraları isim eşleşmesiyle korunur.
- Aynı günün ekibini yönetici olarak elle düzenlediyseniz ertesi pazar senkron o günü tablodan yeniden yazar; kalıcı istisna için tabloyu düzeltin.
- Çizelge okunamazsa (sayfa adı veya tablo düzeni değişirse) iş akışı **kırmızı** olur ve yayınlanmış ekip korunur; sessizce boş kadro yayınlanmaz.
- Otomatik senkron istenmiyorsa workflow dosyasını silin; her şey elle de çalışır (`python3 tools/sync_schedule.py`).

## Yönetici kullanımı

1. `?admin=1` adresini açın (yer imine ekleyin). Duyuruları **Ayarlar → Duyuru şeridi**'nden yazın; üstteki düzenle düğmesi de oraya götürür.
2. Üstteki turuncu/kırmızı yazı **"Yayınlanmamış değişiklikler var"** olduğunda değişiklikler yalnızca sizde demektir.
3. Ekip / Rehber / Notlar sekmelerinde düzenleyin. **Listeden içe aktar** ile Excel, Word veya WhatsApp metnini kullanın.
4. **Yayınla** → "Yayınlandı" yazısı çıkar. GitHub Pages 1-2 dakika içinde güncellenir.
5. Ekip sayfayı yenilediğinde (ya da birkaç dakika sonra kendiliğinden) yeni içeriği görür.

Yarım kalan işler kaybolmaz: değişiklikler taslak olarak cihazda durur, sayfayı kapatıp açsanız da geri gelir. Taslağı atmak için tarayıcı verilerini temizlemek yerine **Ayarlar → Veri → Tüm verileri sil** (yalnızca taslağı ve önbelleği siler, yayındaki içeriğe dokunmaz) kullanılabilir.

## Yedekleme ve geri alma

- **Ayarlar → Veri → Yedek al**: o anki içeriği `.json` olarak indirir.
- Yayınlanan her sürüm GitHub'da commit geçmişinde durur: `content.json → History` ile eski hâle dönüp yeni commit atabilirsiniz.
- Anahtar olmadan da yayın yapmak isterseniz: **Veri → content.json indir** ile dosyayı indirip GitHub'da `content.json` dosyasını düzenleyip yapıştırabilirsiniz.

## Bağlantı önizlemesi

WhatsApp, Telegram, X, LinkedIn, Slack gibi uygulamalarda link kartı görünmesi için `index.html` içinde OG/Twitter etiketleri ve `assets/onizleme.png` (1200×630) bulunur. Görseli değiştirmek için `python3 tools/make_preview.py` çalıştırın.

Uygulamalar önizlemeyi önbelleğe alır; yeni kartı görmek için bağlantıyı `?v=2` gibi bir ekle paylaşın (WhatsApp eski kartı göstermeye devam edebilir).

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
tests/                uçtan uca testler (jsdom + Python ayrıştırıcı testi)
tools/                simge ve test dosyası üreticileri
LICENSE               MIT lisansı
```

## Test

```bash
npm ci                     # yalnızca jsdom, geliştirme bağımlılığı
npm test                   # 80 kontrol: görüntüleme, yönetici, yayın API'si,
                           # duyuru, içe aktarma, önbellek, bozuk içerik
python -m unittest discover tests   # çizelge ayrıştırıcısı (openpyxl gerekir)
```

Her iki test de `main` dalına gelen her push'ta yayından **önce** çalışır; test kırılırsa site yayınlanmaz.

## Sınırlar

- Yayın sonrası görünüm GitHub Pages'in önbelleğine bağlıdır; genelde 1-2 dakika, bazen 5 dakika sürebilir.
- `sw.js` içindeki `CACHE` adı yayın sırasında commit SHA'sıyla otomatik değiştirilir; elle sürüm artırmak gerekmez. `ASSETS` listesine yeni dosya eklemeyi unutmayın.
- Yayınlanan `content.json` yalnızca son 90 günün günlerini tutar; daha eskisi yönetici kaydettiğinde düşer (arşiv GitHub commit geçmişindedir).
- Yönetici telefonu dışındaki cihazlar yalnızca görüntüler; `?admin=1` ile açılan cihazda anahtar yoksa yayın yapılamaz.
- Ekip not ekleyemez; notlar yönetici tarafından yazılır (talep edilirse ayrı bir yazma servisi gerekir).
- Fotoğraf/PDF listeler tarayıcıda okunamaz (OCR yok); metin, Excel veya Word kullanılmalı.
- Anahtar cihazda saklanır; ortak kullanılan bir telefonda tarayıcı verilerini paylaşmayın.

## Lisans

MIT
