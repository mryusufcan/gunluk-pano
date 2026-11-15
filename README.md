# Günün Panosu · Radyoloji

Radyoloji departmanının günlük operasyon panosu: **günün ekibi**, **günün yemeği** ve **notlar** tek ekranda. Kurulum, hesap veya uygulama mağazası gerekmez; iPhone ve Android tarayıcısında açılır, masaüstünde de düzenli bir sürümü vardır.

[![Yayınla](https://img.shields.io/badge/yayınla-GitHub%20Pages-0f6f66)](https://mryusufcan.github.io/gunluk-pano/)

## Özellikler

- **Mobil öncelikli arayüz:** alt sekme çubuğu, büyük dokunma hedefleri, güvenli alan (çentik) desteği, alt sayfa (bottom sheet) diyalogları, 16 px giriş alanları (iOS'ta yakınlaştırma yapmaz).
- **Masaüstünde gerçek düzen:** üst başlık, yatay bölüm sekmeleri, iki sütunlu paneller, klavye kısayolları.
- **Günün ekibi:** vardiyaya göre gruplu liste (08–16, 16–24, 24–08, icap, idari, izinli), görev etiketi, telefon/dahili için `tel:` bağlantısı, kişi notu.
- **Liste içe aktarma:** haftalık/aylık çalışma listesini yapıştırın veya `.xlsx` / `.docx` dosyası seçin; tarih, gün adı, vardiya, isim ve cihaz otomatik ayrılır, aktarmadan önce önizleme gösterilir. Yemek listesi için de aynısı geçerli.
- **Günün yemeği:** çok satırlı menü; "dünkü menüyü kopyala" ile her gün sıfırdan yazma yok.
- **Notlar:** yazar, saat, sabitleme, "tamamlandı" işareti, Tümü / Bugün / Sabitlenen / Açık filtreleri.
- **Hızlı erişim:** PACS, RIS veya ekip grubu gibi bağlantılar panonun üstünde kısayol olur.
- **Nöbet Listesi ile entegrasyon:** aynı alan adında yayınlanmışsa ([Nöbet Listesi](https://mryusufcan.github.io/nobet-listesi/)) seçili günün çizelgesi tek düğmeyle ekibe aktarılır.
- **Paylaşım:** günün özeti WhatsApp metni olarak veya tüm günü taşıyan bağlantı olarak gönderilir; karşı taraf "Ekle" dediğinde kendi panosuna işler.
- **Veri sizinle kalır:** sunucu, veritabanı ve hesap yok; kayıtlar `localStorage` içinde. Yedek alıp başka cihaza taşıyabilirsiniz.
- **Çevrimdışı:** ana ekrana eklenince servis çalışanı sayfa kabuğunu önbelleğe alır, internet olmadan da açılır.
- Aydınlık / gece teması.

## Liste içe aktarma

Ekip ve yemek listelerini elle yazmak gerekmez. **Listeden içe aktar** düğmesi şu yolları kabul eder:

- Excel'den kopyalanan tablo (sekme/`;` ayrımlı), WhatsApp veya Word metni yapıştırma.
- `.txt`, `.csv`, `.tsv`, `.xlsx`, `.docx` dosyası seçme. Excel ve Word dosyaları tarayıcıda açılır; sunucuya gitmez.

Ayrıştırıcı şu biçimleri tanır:

```
Tarih            Vardiya        Personel
15.11.2026       08:00-16:00    Dr. Ayşe Yılmaz (MR)
15.11.2026       16:00-24:00    Ali Şahin

15 Kasım Cumartesi
08-16: Ayşe Yılmaz, Murat Demir (BT)
Akşam: Zeynep Ak

Tarih        08:00-16:00        16:00-24:00   24:00-08:00
16.11.2026   Dr. Ece Kaya, ...  Ali Şahin     Emre Yıldız

Pazartesi    Ayşe    Mehmet    Ali        (gün adı, seçili haftaya göre)
Sabah 08-16 Ayşe, Mehmet 16-24 Ali         (tek satırda birden fazla vardiya)
MR: Ayşe Yılmaz · BT: Murat Demir         (cihaz etiketleri)

KASIM 2026
Vardiya   1        2          3          (aylık ızgara: üstte gün numaraları)
08-16     Dr. Ayşe  Mehmet     Ali
16-24     Zeynep    Ali        Emre
```

- Tarih yazılmamışsa liste seçili güne yazılır; gün adları "Bu hafta / Gelecek hafta / Geçen hafta" seçimine göre hesaplanır.
- Yıl yazılmamışsa (`15.11`) seçili tarihin yılı kullanılır, geçmiş tarihler bir sonraki yıla taşınır.
- Aylık çizelgede üst satır gün numaralarıysa (`1 2 3 … 30`) ay bilgisi metindeki "KASIM 2026" satırından alınır; dikey tabloda gün numarası tek başına hücredeyse de aynı şekilde çözülür.
- Aynı isim ve vardiya ikinci kez eklenmez; "mevcut ekibi sil" kutusu işaretlenirse o günün kadrosu önce temizlenir.
- Yemek listesinde tarih satırlarının altındaki satırlar menü kabul edilir, `·` ve virgülle ayrılan yemekler ayrı satıra bölünür.
- Anlaşılamayan satırlar önizlemede "atlandı" olarak listelenir; sonuç her zaman aktarmadan önce gösterilir.

## Kullanım

### Doğrudan açma

`index.html` dosyasını telefonda veya bilgisayarda tarayıcıda açın. Dosyadan açıldığında veri yine tarayıcıda saklanır; paylaşım bağlantısı üretmek için site bir adresten (http/https) servis edilmelidir.

### Ana ekrana eklemek (isteğe bağlı)

- **iPhone:** Safari → Paylaş → *Ana Ekrana Ekle*
- **Android:** Chrome → ⋮ → *Ana ekrana ekle*

Simge eklenince site tam ekran, uygulama gibi açılır ve çevrimdışı çalışır.

### Klavye kısayolları (masaüstü)

| Kısayol | İşlev |
| --- | --- |
| `1` – `4` | Ekip / Yemek / Notlar / Ayarlar |
| `n` | Yeni not alanına git |
| `←` `→` | Önceki / sonraki gün |

## Yayınlama (GitHub Pages)

1. Bu klasörün içeriğini yeni bir depoya koyun (örnek: `gunluk-pano`).
2. Depo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. `.github/workflows/pages.yml` dosyasını `nobet-listesi` deposundakiyle aynı şekilde ekleyin; `main` dalına her push'ta site yayınlanır.
4. Adres: `https://<kullanıcı>.github.io/gunluk-pano/`

Statik olduğu için Netlify, Cloudflare Pages veya herhangi bir web sunucusuna da doğrudan yüklenebilir.

> Servis çalışanı dosyaları önbelleğe alır. Arayüzü güncelledikten sonra `sw.js` içindeki `CACHE` sürümünü artırın (`gunluk-pano-v1` → `v2`), aksi hâlde eski sürüm görünmeye devam eder.

## Nöbet Listesi ile entegrasyon

İki site de `mryusufcan.github.io` alan adında yayınlandığında tarayıcı deposu ortaktır. Günün ekibi boşsa ve Nöbet Listesi'nde o ay için çizelge üretilmişse **Nöbet listesinden al** düğmesi görünür; sabah modalite atamaları, akşam ve gece nöbetçileri isimleriyle eklenir. Veri yoksa düğme hiç çıkmaz.

## Veri ve yedekleme

- Her tarayıcı kendi kaydını tutar. Aynı telefonun Safari'si ile Chrome'u bile ayrı veri görür.
- **Ayarlar → Yedek al** bir `.json` dosyası indirir; **Yedeği yükle** başka cihaza taşır.
- Kayıtlar boş günlerde otomatik temizlenir; yalnızca ekip veya menü girilmiş günler saklanır.
- Tarayıcı verilerini temizlemek panoyu da siler. Düzenli yedek alın.

## Dosya yapısı

```
index.html            arayüz iskeleti
styles.css            mobil + masaüstü stilleri
app.js                tüm işlevler (bağımlılık yok)
manifest.webmanifest  uygulama bilgileri
sw.js                 çevrimdışı önbellek
assets/               simgeler (svg + png)
tools/make_icons.py   simgeleri yeniden üretir (Pillow)
```

## Test

```bash
npm install          # yalnızca jsdom, geliştirme bağımlılığı
npm test             # 81 kontrol: ekip, menü, not, tema, kalıcılık, içe aktarma, aylık tablo, bozuk veri
```

## Yol haritası

- Ortak (tek) veri: bugünkü yapı cihaz başınadır. Departmanın aynı panoyu aynı anda görmesi istenirse küçük bir API eklenebilir: Cloudflare Worker + Durable Object, Supabase veya mevcut sunucuda bir Node/PHP uç noktası. Arayüz `state` nesnesi ve `save()` üzerinden çalıştığı için bu geçiş tek dosyada yapılabilir.
- PDF ve fotoğraf (menü tabelası) okuma: tarayıcıda OCR olmadığı için şimdilik metin/Excel/Word ile sınırlı.
- Aylık menü takvimi, PACS/RIS derin bağlantıları, ekip üyelerini Nöbet Listesi kadrosundan tek tıkla doldurma.

## Lisans

MIT
