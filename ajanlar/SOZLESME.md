# Ortak Sözleşme (tüm ajanlar okur)

Proje: Chrome MV3 eklentisi. YouTube videosu oynarken oynatıcının alt kısmında şeffaf bir katmanda
altyazı metni görünür; kullanıcı bunu yazar, doğru/yanlış harfler renklenir, video hızına (0.75x, 1x…)
göre metin videoyla senkron ilerler. Tam ekranda da çalışmalı.

## Kullanıcı kararları
- Tarayıcı: Chrome. Dil: Türkçe altyazı öncelikli (yoksa mevcut olan).
- "Video beni beklesin": kullanıcı geçerli satırı bitirmeden video o satırın sonuna gelirse video
  otomatik DURUR; satır bitince otomatik DEVAM eder.
- Toleranslı karşılaştırma: büyük/küçük harf ve noktalama yok sayılır. Türkçe harfler (ı/İ, i/I, ş, ğ, ü, ö, ç)
  doğru işlenmeli → `toLocaleLowerCase('tr')`.
- Arka plan şeffaf; video rahat izlenmeli. Performans sorunu OLMAMALI.

## Teknik kurallar (hepsi zorunlu)
- Tüm scriptler `"world": "MAIN"`, `document_start`'ta, şu sırayla yüklenir:
  `src/transcript.js`, `src/engine.js`, `src/overlay.js`, `src/main.js` (+ `src/overlay.css`).
  Derleme adımı YOK, bağımlılık YOK, düz ES2020 IIFE dosyaları.
- Tek global: `window.YTYaz = window.YTYaz || {}`. Her dosya kendi alt nesnesini ekler.
- Dosyalar idempotent olmalı: aynı script sayfaya ikinci kez enjekte edilirse çift kurulum yapmamalı
  (test sırasında scriptler konsoldan enjekte edilecek).
- YouTube **Trusted Types** uygular: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` YASAK.
  Yalnızca `createElement` / `textContent` / `append`.
- YouTube tek sayfa uygulamasıdır: `yt-navigate-finish` olayında (video değişince) durum sıfırlanmalı.
  Yalnızca `/watch` sayfalarında etkin ol.
- Sahiplik: her ajan YALNIZCA kendi dosyalarına yazar.

## Arayüz: `YTYaz.transcript` (sahibi: Mimar — `src/transcript.js`)
```js
// Geçerli video için altyazıyı yükler. Türkçe ('tr') tercih edilir; elle yazılmış > otomatik (asr).
YTYaz.transcript.load(): Promise<{
  videoId: string,
  lang: string,            // örn. 'tr'
  kind: 'manual' | 'asr',
  cues: Array<{ start: number, end: number, text: string }>  // saniye; start'a göre sıralı, ÇAKIŞMAYAN
}>
// Hata: Error nesnesi, err.code = 'NO_CAPTIONS' | 'FETCH_FAILED'
YTYaz.transcript.hideNativeCaptions(hide: boolean): void   // YouTube'un kendi altyazı kutusunu gizle/göster
```
Cue kuralları: `text` tek satır, boşlukları sadeleştirilmiş, `[Müzik]` / `[Alkış]` gibi köşeli parantezli
etiketler ve boş cue'lar atılmış; bir cue en fazla ~70 karakter (uzunsa kelime sınırından bölünür, süre
karakter sayısıyla orantılı paylaştırılır). Ham metin korunur (büyük harf/noktalama silinmez — bunu engine yapar).

## Diğer dosyalar (sahibi: Usta)
`src/engine.js` (saf mantık, DOM yok), `src/overlay.js` + `src/overlay.css` (arayüz),
`src/main.js` (video senkronu ve yapıştırıcı kod).
