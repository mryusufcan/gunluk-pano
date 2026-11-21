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

## Cep numaraları ve şifre

Rehberdeki cep numaraları yayınlanan `content.json` içinde **düz metin olarak durmaz**. Depo public olduğu için bu bilinçli bir tercih:

- `content.json` yalnızca `hasMobile: true` bayrağını taşır; numaranın kendisi yok.
- Numaralar `phones.enc` dosyasında AES-GCM-256 ile şifreli durur. Anahtar, girilen şifreden PBKDF2-SHA256 (100.000 tur, rastgele salt) ile türetilir.
- Şifre kodda saklanmaz. Tarayıcı girilen şifreyi doğrudan çözme anahtarı olarak dener; yanlışsa AES-GCM doğrulaması düşer ve "Şifre yanlış" görünür.
- Doğru şifre cihazda hatırlanır (`localStorage`); kilit çubuğu kaybolur, cep numaraları `tel:` düğmesi olur.

Şifre değiştirme (depoda `tools/cep_yedek.json` yedeği gerekiyor):

```bash
node tools/encrypt_phones.mjs "yeni-sifre"   # phones.enc yeniden üretilir
```

Sonra `phones.enc` commit'lenip push edilir; `sw.js` önbellek adı commit ile değiştiği için eski şifreli dosya tarayıcıda kalmaz.

## Özellikler


- **Günün ekibi:** vardiyaya göre gruplu liste (08–16, 16–24, 24–08, idari, izinli); geçerli vardiya açık, diğerleri tek satıra katlanmış. Telefon/dahili için `tel:` bağlantısı, kişi notu.
- **Günün yemeği:** ekip ekranının altında kart; çok satırlı menü, dünkü menüyü kopyalama.
- **Notlar:** etiketli (Sabit / Arıza / Duyuru / Hatırlatma), durum noktalı (Açık / Tamamlandı), yazar, saat, sabitleme; Tümü / Bugün / Sabit / Açık filtreleri.
- **Telefon rehberi:** ayrı sekme; arama kutusu üst başlıkta (kelime kelime de bulur, "kaya ece" → Ece Kaya), sık kullanılanlar kutucuk olarak, sonuçlarda arama düğmesi. Cep ve dahili tek satırda iki ayrı `tel:` düğmesi. Yönetici Ayarlar'dan satır ekleyip düzenler, yıldızla sık kullanılana alır.
- **Cep numarası kilidi:** rehberdeki cep numaraları `phones.enc` dosyasında şifreli durur. Şifre girilmeden maskeli görünür; doğru şifre girilince tıklanabilir olur ve cihazda hatırlanır.
- **Liste içe aktarma (yönetici):** haftalık/aylık çalışma listesini veya yemek listesini yapıştırın, `.xlsx` / `.docx` seçin ya da çizelgenin **fotoğrafını** verin; tarih, gün adı, vardiya, isim ve cihaz otomatik ayrılır, aktarmadan önce önizleme gösterilir.
- **Aylık ızgara:** üst satırı gün numaraları (`1 2 3 … 30`) olan tablolar ve dikey gün numaralı listeler desteklenir.
- **Duyuru şeridi:** acil bilgi (ör. "BT 14:00–16:00 arası bakımda") panonun üstünde bant olarak; bilgi veya uyarı tonu seçilebilir.
- **Son güncelleme satırı:** ekip, gördüğü içeriğin ne zaman yayınlandığını görür.
- **Canlı yayın kontrolü:** yönetici yayından sonra tek düğmeyle canlı sürümün çıkıp çıkmadığını doğrular.
- **Otomatik tazelik:** açık kalan ekran 5 dakikada bir sessizce yenilenir. Saat 08:00'de yeni güne geçer; gece 00:00-08:00 arası dünün panosu açılır ve 24–08 vardiyası "şu an" olarak işaretlenir.
- **Paylaşım:** günün özeti (duyuru ve gece nöbeti dahil) WhatsApp metni olarak gönderilir.
- **Çevrimdışı:** son içerik önbellekte; internet yokken gösterilir, bağlantı gelince kendiliğinden yenilenir. `phones.enc` de önbellekte olduğu için çevrimdışıyken şifre girilip cep numaraları açılabilir. Yöneticide önce **taslak** yüklenir, yayın düğmesi kapanır; bağlantı gelince "Yayınla" yeniden açılır.
- **Sakin Klinik teması:** tek turkuaz vurgu, yumuşak kartlar, hap biçimli düğmeler; açık ve gece modu (cihaz başına hatırlanır). Kayıtlı tercih yoksa 20:00-08:00 arası gece modu kendiliğinden açılır; elle seçim bunu sabitler. Yazı tipi Inter, uygulamayla birlikte gelir (internet gerekmez).

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
- `.github/workflows/sync-schedule.yml` bu betiği **her gün 08:00'de** (Türkiye saati) çalıştırır. Değişiklik varsa commit eder, Pages kendiliğinden yayınlar.
- Elle çalıştırmak için: GitHub → **Actions → Çizelgeyi senkronla → Run workflow**.
- Yemek, not, duyuru ve ayarlara dokunulmaz. Telefon numaraları isim eşleşmesiyle korunur.
- Aynı günün ekibini yönetici olarak elle düzenlediyseniz ertesi pazar senkron o günü tablodan yeniden yazar; kalıcı istisna için tabloyu düzeltin.
- Çizelge okunamazsa (sayfa adı veya tablo düzeni değişirse) iş akışı **kırmızı** olur ve yayınlanmış ekip korunur; sessizce boş kadro yayınlanmaz.
- Otomatik senkron istenmiyorsa workflow dosyasını silin; her şey elle de çalışır (`python3 tools/sync_schedule.py`).

## Fotoğraftan liste

E-Tablo'ya giremeden, çizelgenin fotoğrafından da liste çıkarılabilir:

- Yönetici → **Ayarlar → Fotoğraftan liste** bölümüne Google AI Studio (Gemini) anahtarını yapıştırıp **Anahtarı kaydet** deyin. Anahtar yalnızca o cihazda (`localStorage`) durur.
- **Listeden içe aktar → Dosya seç** ile fotoğrafı seçin. Fotoğraf 1600 px'e küçültülüp Gemini'ye gönderilir, dönen JSON aynı içe aktarma metnine çevrilir; **önizlemeyi siz onaylamadan** panoya yazılmaz.
- Ücretsiz kota bu iş için fazlasıyla yeter: ayda 4-5 fotoğraf, ücretsiz katmanın günlük istek sınırının çok altında. Kota/fiyat değişirse `app.js` içindeki `OCR_MODEL` satırından model seçilebilir.
- Anahtar yoksa düğme çalışmaz, uyarı çıkar; yapıştırma, Excel/Word ve E-Tablo senkronu aynen durur.
- Fotoğraf yalnızca Google'ın Gemini servisine gider; başka bir yere yüklenmez, depoya girmez.

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
phones.enc            şifreli cep numaraları (AES-GCM)
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
npm test                   # 134 kontrol: görüntüleme, yönetici, yayın API'si,
                           # duyuru, içe aktarma, önbellek, bozuk içerik,
                           # gece vardiyası, cep şifresi
python -m unittest discover tests   # çizelge ayrıştırıcısı (openpyxl gerekir)
```

Her iki test de `main` dalına gelen her push'ta yayından **önce** çalışır; test kırılırsa site yayınlanmaz.

## Sınırlar

- Yayın sonrası görünüm GitHub Pages'in önbelleğine bağlıdır; genelde 1-2 dakika, bazen 5 dakika sürebilir.
- `sw.js` içindeki `CACHE` adı yayın sırasında commit SHA'sıyla otomatik değiştirilir; elle sürüm artırmak gerekmez. `ASSETS` listesine yeni dosya eklemeyi unutmayın.
- Yayınlanan `content.json` yalnızca son 90 günün günlerini tutar; daha eskisi yönetici kaydettiğinde düşer (arşiv GitHub commit geçmişindedir).
- Yönetici telefonu dışındaki cihazlar yalnızca görüntüler; `?admin=1` ile açılan cihazda anahtar yoksa yayın yapılamaz.
- Ekip not ekleyemez; notlar yönetici tarafından yazılır (talep edilirse ayrı bir yazma servisi gerekir).
- Fotoğraf okuma Gemini anahtarına ve ücretsiz kotaya bağlıdır; anahtar yokken, kota dolduğunda ya da internet yokken metin/Excel/Word kullanılmalı. PDF hâlâ okunamaz.
- Anahtar cihazda saklanır; ortak kullanılan bir telefonda tarayıcı verilerini paylaşmayın.
- Cep şifresi yalnızca gizlilik perdesi sağlar: `phones.enc` herkese açıktır, şifreyi bilen herkes numaraları çözebilir. Şifre kısa veya tahmin edilebilirse dosyayı indirip deneme yapılabilir; güçlü bir şifre seçin. Şifre unutulursa `tools/cep_yedek.json` (depoda değil, yalnızca yönetici makinesinde) ile yeniden üretilir.

## Lisans

MIT
