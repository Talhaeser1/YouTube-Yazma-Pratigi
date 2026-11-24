# Ajan Ekibi Özeti

Bu klasör, YouTube Yazma Pratiği projesinde kullanılan ajan ekibini tanımlar. Her ajanın ayrıntılı görev tanımı kendi klasöründeki `SKILL.md` dosyasındadır.

| Ajan | Model | Görev | Skill dosyası |
| --- | --- | --- | --- |
| orkestrator | Fable (ana oturum) | Soruları netleştirir, mimariyi ve ortak sözleşmeyi (SOZLESME.md) yazar, ajanları paralel başlatır, bulguları yönlendirir, canlı doğrulamayı takip eder | `ajanlar\orkestrator\SKILL.md` |
| mimar | Opus | En riskli teknik parçayı (altyazı çekme) araştırır, gerçek ortamda kanıtlar, uçtan uca entegrasyon testini yapar | `ajanlar\mimar\SKILL.md` |
| usta | Sonnet | Sözleşmesi net olan arayüz ve mantığı uygular (yazma motoru, katman, video senkronu) | `ajanlar\usta\SKILL.md` |
| denetci | Sonnet | Salt-okunur bağımsız kod incelemesi yapar; iddiaları çalıştırarak doğrular | `ajanlar\denetci\SKILL.md` |
| katip | Haiku | Kodu okuyarak kullanıcı rehberlerini ve skill dosyalarını yazar | `ajanlar\katip\SKILL.md` |

Ortak sözleşme: `ajanlar\SOZLESME.md`. Kullanıcı rehberi: `BENIOKU.md` (proje kökü).

## Bu düzen başka projede nasıl kurulur

1. **Soru sor.** Kullanıcıya birkaç netleştirme sorusu sor; her biri tek karar olsun (tarayıcı, dil, hata toleransı gibi).
2. **Sözleşme yaz.** Dosya sahipliğini ve ajanların birbirine bağlandığı arayüzleri tek bir dosyada tanımla. Ajanlar başlamadan önce hazır olsun.
3. **Paralel başlat.** Birbirinden bağımsız işleri aynı anda başlat. Her ajan yalnızca kendi dosyasına yazsın.
4. **Bağımsız incele.** Bir uygulama ajanı bitince incelemeciye kodu ver (sonucu değil); bulguları çalıştırarak doğrulat.
5. **Düzeltmeyi sahibine yolla.** Bulguyu üreten ajana, bağlamı olduğu için geri gönder; yeni ajan açma.
6. **Canlı doğrula.** "Bitti" demeden önce gerçek ortamda kullanıcı senaryosunu çalıştır. Doğrulanmayan maddeleri ayrı takip et.

Model seçimi kabaca işin zorluğuna göre yapılır: belirsiz ve riskli işe güçlü model, net tanımlı işe orta model, belge ve kaynak okuma işine hafif model.
