# İlerleme ve doğrulama kaydı

Son güncelleme: 2026-11-25 · Sürüm: 1.1.0

Bu dosya her özelliğin durumunu ve **neyle doğrulandığını** tutar. Kural: depoda testi ya da tarihli bir elle
doğrulama notu olmayan özellik "doğrulandı" sayılmaz.

Durumlar: **Otomatik test** = `node test/run.js` içinde testi var ve geçiyor · **Elle doğrulanmalı** = yalnızca
gerçek tarayıcıda görülebilir, bu sürüm için kayıtlı doğrulama yok · **Kayıt yok** = önceki ekip "test edildi"
demiş ama kanıt saklanmamış.

## Özellikler

| Özellik | Dosya | Durum | Kanıt |
| --- | --- | --- | --- |
| Türkçe karşılaştırma (büyük/küçük harf, noktalama, kesme işareti) | `src/engine.js` | Otomatik test | engine: ilk ve dördüncü test |
| İngilizce ve diğer dillerde I→i | `src/engine.js`, `src/main.js` | Otomatik test | engine "İngilizce altyazıda I → i"; main "dil motora iletilir" |
| Yanlış harfi silip düzeltme, en çok yanlış yapılan harfler | `src/engine.js` | Otomatik test | engine "yanlış harf sayılır" |
| DKS ve aktif süre hesabı | `src/engine.js` | Otomatik test | engine iki DKS testi |
| Altyazı ayrıştırma (elle yazılmış ve otomatik) | `src/transcript.js` | Otomatik test | transcript iki test |
| Video satır sonunda bekler, satır bitince devam eder | `src/main.js` | Otomatik test (sahte video) | main ilk test; gerçek oynatıcıda elle doğrulanmalı |
| Sonuç kartı ve geçmişe kayıt | `src/main.js` | Otomatik test (sahte katman) | main "dil motora iletilir", "5 tuştan kısa" |
| Sekme kapanınca kayıt | `src/main.js` | Otomatik test | main "sekme kapanınca" |
| Geri sarınca yeni oturum | `src/main.js` | Otomatik test | main "ikinci deneme" |
| Altyazı yüklenirken basılan tuşlar saklanır ve satıra uygulanır | `src/main.js` | Otomatik test | main "yüklenirken basılan tuşlar kaybolmaz"; gerçek tarayıcıda elle doğrulanmalı |
| Alt+R sonrası yazma sürer | `src/main.js` | Otomatik test | main "Alt+R sonrası yazma sürer"; gerçek odak davranışı elle doğrulanmalı |
| Reklam bitişi oturumu bitirmez | `src/main.js` | Otomatik test (varsayım) | Test, reklamın `ended` olayı tetiklediğini varsayar; gerçek reklamda elle doğrulanmalı |
| YouTube'dan altyazı çekme (belirteç yakalama, üç aşamalı yedek) | `src/transcript.js` | Kayıt yok | Önceki ekip "canlı doğrulandı" demiş; kanıt saklanmamış |
| Katmanın görünümü, tam ekran, konum ve boyut ayarları | `src/overlay.js`, `src/overlay.css` | Kayıt yok | — |
| Girdi işleme (Türkçe klavye, ölü tuşlar, yapıştırma engeli) | `src/overlay.js` | Kayıt yok | — |
| Varsayılan kapalı, "Yaz" düğmesi, ✕ düğmesi | `src/main.js`, `src/overlay.js` | Kayıt yok | — |
| Gezinme başlar başlamaz kapatma (`yt-navigate-start`) | `src/main.js` | Kayıt yok | 2026-11-25'te başka bir oturumda eklendi; koddaki yorum "canlı test" diyor, kayıt yok |
| Reklam sırasında katmanı gizleme | `src/main.js` | Kayıt yok | — |

## Elle doğrulama listesi (her sürümde tarayıcıda)

Sonucu tarihle birlikte aşağıdaki "Doğrulama geçmişi" bölümüne yaz.

1. Türkçe altyazılı bir videoda Alt+Y ile aç, iki satır yaz: renkler, video bekleme ve devam.
2. Yalnızca İngilizce altyazılı bir videoda "I" içeren bir satırı küçük "i" ile yaz: hata sayılmamalı.
3. Birkaç satır yazıp sekmeyi kapat; videoyu yeniden açıp Alt+S ile geçmişte kaydı gör.
4. Kısa bir videoyu bitir, başa sar, birkaç satır daha yaz, katmanı kapat: geçmişte iki ayrı kayıt.
5. Video ortasında reklam çıkan bir videoda reklam bitince sonuç kartı kendiliğinden açılmamalı.
6. Tam ekranda katmanın konumu; yeni videoya geçince katmanın kapanması.
7. Yeni bir videoda Alt+Y'ye basıp hemen yazmaya başla: satır gelince ilk tuşlar satırda görünmeli.
8. Yazarken Alt+R'ye bas, tıklamadan yazmaya devam et: tuşlar işlenmeli.
9. Tam ekranda Alt+Y ile aç, yaz, kontrol çubuğu gizlenince satırın yerini ve odağın korunduğunu gör.

## Doğrulama geçmişi

| Tarih | Sürüm | Ne | Sonuç |
| --- | --- | --- | --- |
| 2026-11-25 | 1.1.0 | `node test/run.js` (Node 26) | 18 testin 18'i geçti |
| 2026-11-25 | 1.1.0 | Tarayıcıda elle doğrulama | Yapılmadı |

## Değişiklik günlüğü

### 1.1.0 — 2026-11-25 (bağımsız denetim sonrası)

- Git deposu kuruldu; denetim öncesi hal `main` dalında ilk commit olarak duruyor.
- Düzeltme: Türkçe olmayan altyazıda büyük "I" artık "i" olarak bekleniyor.
- Düzeltme: sekme kapanınca ya da sayfa yenilenince oturum geçmişe yazılıyor.
- Düzeltme: bitirip geri sarınca yeni oturum başlıyor ve ayrıca kaydediliyor.
- Düzeltme: reklamın bitişi sonuç kartını açmıyor.
- Düzeltme: DKS hesabında satırlar arası süre de sayılıyor (önceden yaklaşık %5 yüksek çıkıyordu).
- Düzeltme: Alt+Y'den sonra altyazı yüklenirken basılan tuşlar artık kaybolmuyor; satır gelince uygulanıyor.
- Düzeltme: Alt+R'den sonra yazma alanı ölü kalmıyor (önceden Esc + tıklama gerekiyordu).
- Kalıcı testler eklendi (`test/run.js`).
- Alt ajan tanımları `.claude/agents/` altına taşındı; `model` ve `tools` üst bilgiye alındı.
- Sözleşmeye dosya sahipliği, modüller arası arayüzler ve sürüm kuralı eklendi.
- Sürüm numaraları eşitlendi (manifest ve `transcript.js`: 1.1.0).

## Bilinen açık konular

- Tam ekranda Esc hem yazma modundan hem tam ekrandan çıkarır (tarayıcı davranışı, sayfa engelleyemez). Rehberde yazmıyor; tam ekranda yazmaya ara vermenin başka bir yolu yok.
- Rehber "yazmaya başlamak için satıra tıkla" diyor; kodda Alt+Y yazma alanını kendiliğinden odaklıyor (`BENIOKU.md`, Kullanım 3. adım).

- Oynatıcı 20 saniyede bulunamazsa düğme yanık kalıyor, mesaj çıkmıyor (`src/main.js`, `find`).
- "YouTube altyazısını gizle: Hayır" seçiliyken altyazı yüklenirken kısa süre titreyebilir (doğrulanmadı).
- Küçük kod tekrarları: "başka yerde yazıyor mu" kontrolü ve video kimliği okuma iki dosyada ayrı ayrı var.
- Sayfa geri/ileri önbelleğinden dönülürse, sekme kapanırken kaydedilen oturumun devamı ayrıca kaydedilmez.
