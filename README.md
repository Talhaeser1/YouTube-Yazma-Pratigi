# YouTube Yazma Pratiği

YouTube videosu izlerken altyazıyı, videonun üzerindeki şeffaf bir katmanda yazarak hızlı yazma pratiği yapmanı sağlayan bir Chrome eklentisi.

- Doğru harfler yeşil, yanlış harfler kırmızı görünür.
- Sen yazdığın satırı bitirene kadar video bekler; satır bitince devam eder.
- Büyük-küçük harf ve noktalama sayılmaz. Türkçe harfler doğru işlenir.
- Sonunda dakikadaki kelime sayın (DKS), doğruluk oranın ve en çok yanlış yaptığın harfler gösterilir.
- Derleme adımı ve bağımlılık yoktur; eklenti hiçbir veriyi dışarı göndermez. Geçmiş ve ayarlar yalnızca tarayıcında saklanır.

## Kurulum

1. Bu depoyu indir: yeşil **Code** düğmesi → **Download ZIP**, sonra ZIP'i bir klasöre çıkar.
2. Chrome'da `chrome://extensions` adresini aç ve sağ üstten **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle** düğmesine tıkla ve çıkardığın klasörü seç.
4. Açık YouTube sekmelerini yenile (F5).

## Kullanım

Altyazısı olan bir YouTube videosu aç ve **Alt+Y** tuşuna bas (ya da oynatıcının kontrol çubuğundaki **Yaz** düğmesine tıkla). Satır belirince yazmaya başla.

| Tuş | Ne yapar |
| --- | --- |
| Alt+Y | Yazma katmanını aç / kapat |
| Esc | Yazmaya ara ver (katman açık kalır) |
| Alt+S | Sonuç kartını aç / kapat |
| Alt+R | Altyazıyı yeniden yükle |

Ayarlar, kurallar ve sorun giderme için ayrıntılı rehber: [BENIOKU.md](BENIOKU.md).

## Geliştirme

```
node test/run.js
```

Testler Node.js ile, tarayıcı açmadan çalışır. Proje yapısı ve kurallar için [AGENTS.md](AGENTS.md), özelliklerin doğrulama durumu için [PROGRESS.md](PROGRESS.md).

## Durum

Sürüm 1.1.0. Otomatik testler geçiyor; bu sürüm henüz gerçek tarayıcıda elle doğrulanmadı (ayrıntı: [PROGRESS.md](PROGRESS.md)). Eklenti YouTube'un belgelenmemiş iç davranışına dayandığı için YouTube değişikliklerinden sonra altyazı çekme bozulabilir.
