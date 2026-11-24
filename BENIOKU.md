# YouTube Yazma Pratiği

YouTube videosu izlerken altyazı metnini, videonun alt kısmındaki şeffaf bir katmana yazarak hızlı yazma pratiği yaparsın. Harfleri doğru yazdıkça yeşil, yanlış yazdıkça kırmızı görünür; video yazdığın hıza göre ilerler. Sonunda dakikada kaç kelime yazdığın (DKS) ve doğruluk oranın gösterilir.

## Kurulum (adım adım)

1. Chrome'u aç. Adres çubuğuna `chrome://extensions` yaz ve Enter'a bas.
2. Sağ üstteki **Geliştirici modu** düğmesini aç.
3. Sol üstte beliren **Paketlenmemiş öğe yükle** düğmesine tıkla.
4. Masaüstündeki **YouTube-Yazma-Pratigi** klasörünü seç ve **Klasör Seç** de.
5. Eklenti listesinde "YouTube Yazma Pratiği" göründüğünden emin ol.
6. Açık bir YouTube sekmesi varsa sayfayı yenile (klavyede **F5**).

## Kullanım

1. Altyazısı olan bir YouTube videosu aç (adres çubuğunda `youtube.com/watch` olmalı).
2. Yazma katmanı her videoda **kapalı** başlar. Açmak için:
   - klavyede **Alt+Y**, ya da
   - oynatıcının sağ alt kontrol çubuğundaki **Yaz** düğmesine tıkla.
3. Katman açılınca altyazı satırı videonun alt kısmında belirir. Yazmaya başlamak için satıra tıkla; yazma alanı odaklanır.
4. Katmanı kapatmak için **Alt+Y**, **Yaz** düğmesi ya da satırdaki **✕** düğmesini kullan.

### Kısayollar ve düğmeler

| Tuş / düğme | Ne yapar |
| --- | --- |
| Alt+Y | Katmanı aç / kapat (katman kapalıyken yazma alanını da açar) |
| Yaz düğmesi | Katmanı aç / kapat (kontrol çubuğunda) |
| ✕ düğmesi | Katmanı kapat (şerit üzerinde) |
| Alt+S | Sonuç kartını aç / kapat (katman açıkken) |
| Alt+R | Altyazıyı yeniden yükle (katman açıkken) |
| Esc | Yalnızca yazma modundan çıkar; katman açık kalır |
| Satıra tıklama | Yazma moduna geri döner |

Alt+Y, yorum ya da arama kutusu gibi başka bir yazı alanına odaklıyken çalışmaz.

Katmandaki **Ayarlar** ve **Sonuç** düğmeleriyle de Alt+S ve ayar işlemleri yapılır.

### Yazma kuralları

- **Video beni bekler:** Yalnızca katman açık ve yazma modundayken geçerlidir. Yazarken video, yazdığın satırın sonuna gelirse video kendiliğinden durur. Satırı bitirdiğinde video otomatik devam eder.
- **Yazma modu kapalıyken video durmaz.** Esc ile yazma modundan çıkınca ya da katman kapalıyken altyazı yalnızca videoyla birlikte ilerler. Video seni beklerken başka bir pencereye ya da sekmeye geçersen de yazma modundan çıkılır ve video kendiliğinden devam eder.
- **Oynatma hızı:** 0.75x, 1x, 1.5x gibi hızları YouTube'un kendi hız ayarından değiştirirsin. Katman videonun gerçek konumuna göre ilerlediği için hıza kendiliğinden uyum sağlar.
- **Renkler:**
  - Gri: henüz yazılmamış harf.
  - Açık yeşil: doğru yazılmış harf.
  - Kırmızı ve altı çizili: yanlış yazılmış harf. Yanlış harfi silip doğrusunu yazabilirsin.
  - Soluk gri nokta / virgül: henüz geçilmemiş noktalama işareti. Yazman gerekmez.
  - Soluk yeşil noktalama: geçilmiş noktalama işareti; kendiliğinden işaretlenir.
- **Satır özgün yazımıyla görünür:** Büyük harfler, virgül ve nokta satırda aynen yazılır. Yazarken bunları zorunlu olarak yazmazsın.
- **Büyük-küçük harf sayılmaz.** "merhaba" ile "Merhaba" aynı kabul edilir. Türkçe harfler (ı, i, ş, ğ, ü, ö, ç) doğru işlenir. Türkçe altyazıda büyük "I" için "ı", İngilizce gibi diğer dillerde "i" yazılır.
- **Altyazı dili:** Türkçe altyazı varsa o kullanılır; yoksa videodaki mevcut altyazı (ör. İngilizce) gelir.
- **Boşluklar:** Kelimeler arasında boşluk tuşuna bir kez bas. Virgül ve nokta yazmana gerek yok; boşluk, aradaki noktalamanın yerine geçer.

### Ayarlar

Katmandaki **Ayarlar** düğmesine tıkla:

- **Yazı boyutu:** Küçük / Orta / Büyük
- **Konum:** Alt / Orta / Üst
- **YouTube altyazısını gizle:** Evet / Hayır (Evet ise YouTube'un kendi altyazı kutusu gizlenir.)

Ayarlar tarayıcında saklanır; bir sonraki açılışta da geçerlidir.

### Sonuç kartı ve geçmiş

- Altyazının sonuna gelince, ya da katman açıkken **Alt+S** / **Sonuç** düğmesiyle sonuç kartı açılır.
- Kartta DKS, doğruluk, süre, tuş sayısı, en çok yanlış yapılan harfler ve son oturumların listesi bulunur.
- **DKS**, dakikadaki kelime sayısıdır: 5 doğru tuş bir kelime sayılır. 3 saniyeden uzun duraklamalar süreye katılmaz.
- Bir oturum en az 5 tuş vuruşu içeriyorsa geçmişe kaydedilir: katmanı kapatınca, video bitince, başka videoya geçince ya da sekmeyi kapatınca. En son 20 kayıt tutulur.
- Videoyu bitirdikten sonra geri sarıp yeniden yazarsan bu yeni bir oturum sayılır ve ayrıca kaydedilir.
- Geçmiş bu tarayıcıda, YouTube'un site verileri içinde saklanır. Tarayıcıdan YouTube site verilerini silersen geçmiş ve ayarlar da silinir.

## Sorun giderme

| Belirti | Ne yapmalı |
| --- | --- |
| Katman görünmüyor | Önce **Alt+Y** ya da **Yaz** düğmesine bas; katman her videoda kapalı başlar. Hâlâ yoksa sayfayı yenile (F5). Adresin `youtube.com/watch` ile başladığından emin ol. |
| **Yaz** düğmesi kontrol çubuğunda yok | Sayfayı yenile (F5). Düğme yalnızca video sayfasında görünür. |
| Alt+Y çalışmıyor | Yorum ya da arama kutusuna yazı yazıyor olabilirsin; önce o alanın dışına tıkla. |
| "Bu videoda altyazı yok" yazıyor | Video altyazı içermiyor. Başka bir video dene. |
| "Altyazı alınamadı" yazıyor | Alt+R ile tekrar dene (katman açıkken). Olmazsa sayfayı yenile. |
| Reklam sırasında katman kayboldu | Bu normal. Reklam bitince katman geri gelir. |
| Yazma sırasında bir şey tuhaf davranıyor | Sayfayı yenile; sorun sürerse eklentiyi yeniden yükle (aşağıdaki "Kod değişince" bölümü). |

## Kod değişince

Dosyalarda değişiklik yaptıysan:

1. `chrome://extensions` sayfasına git.
2. "YouTube Yazma Pratiği" kartındaki **yenile (↻)** düğmesine tıkla.
3. Açık YouTube sekmelerini yenile (F5).

## Klasör yapısı

```
YouTube-Yazma-Pratigi/
├── manifest.json        Eklentinin tanımı (hangi dosyaların, hangi sitede çalışacağı)
├── BENIOKU.md           Bu belge
├── PROGRESS.md          Hangi özellik ne durumda, neyle doğrulandı
├── AGENTS.md            Projede çalışacak yapay zekâ araçları için giriş notu
├── test/run.js          Otomatik testler (çalıştırma: node test/run.js)
├── .claude/agents/      Alt ajan tanımları (kullanıcı için gerekmez)
├── src/
│   ├── transcript.js    Video altyazısını bulur ve indirir
│   ├── engine.js        Yazma mantığı: karşılaştırma, DKS, doğruluk
│   ├── overlay.js       Ekrandaki yazma katmanı ve ayar paneli
│   ├── overlay.css      Katmanın görünümü
│   └── main.js          Video ile senkron, Yaz düğmesi ve sayfa geçişleri
└── ajanlar/             Geliştirme ekibinin notları (kullanıcı için gerekmez)
```
