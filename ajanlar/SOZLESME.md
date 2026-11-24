# Ortak Sözleşme (tüm ajanlar okur)

Proje: Chrome MV3 eklentisi. YouTube videosu oynarken oynatıcının alt kısmında şeffaf bir katmanda
altyazı metni görünür; kullanıcı bunu yazar, doğru/yanlış harfler renklenir, video hızına (0.75x, 1x…)
göre metin videoyla senkron ilerler. Tam ekranda da çalışmalı.

## Kullanıcı kararları
- Tarayıcı: Chrome. Dil: Türkçe altyazı öncelikli (yoksa mevcut olan).
- "Video beni beklesin": kullanıcı geçerli satırı bitirmeden video o satırın sonuna gelirse video
  otomatik DURUR; satır bitince otomatik DEVAM eder.
- Toleranslı karşılaştırma: büyük/küçük harf ve noktalama yok sayılır. Türkçe harfler (ı/İ, i/I, ş, ğ, ü, ö, ç)
  doğru işlenmeli → `toLocaleLowerCase('tr')`. Altyazı Türkçe değilse (ör. İngilizce) I→i kuralı uygulanır;
  yoksa "I think" yazan kullanıcı hata almış olur.
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
  İstisna: `transcript.js` içindeki ağ kancası (XHR/fetch sarmalayıcısı) her YouTube sayfasında ve eklenti
  kapalıyken de kuruludur; oynatıcının altyazı isteğini kaçırmamak için `document_start`'ta kurulması gerekir.
  Kanca yanıtı değiştirmez, yalnızca `/api/timedtext` isteklerinin son 8'ini saklar.
- Eklenti varsayılan olarak KAPALIDIR: katman yalnızca Alt+Y ya da oynatıcıdaki "Yaz" düğmesiyle açılır,
  yeni videoya geçince yeniden kapanır.
- Sürüm: `manifest.json` içindeki `version` ile `transcript.js` içindeki `VERSION` aynı tutulur.
- Sahiplik: her ajan YALNIZCA kendi dosyalarına yazar. Sahipsiz dosya yoktur:
  `manifest.json` ve `test/` → Usta (Mimar kendi modülünün testini `test/` altına ekleyebilir);
  `BENIOKU.md` ve `.claude/agents/` → Kâtip; `ajanlar/SOZLESME.md`, `PROGRESS.md`, `AGENTS.md` → Orkestratör.
- Kod değişince aynı turda: `node test/run.js` geçmeli, `BENIOKU.md` ve `PROGRESS.md` güncellenmeli.

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

Aralarındaki arayüzler (özet; ayrıntı için dosyaların sonundaki dışa aktarım satırına bak):
```js
// engine — DOM'a dokunmaz, Node'da test edilir.
YTYaz.engine.createSession(cues, lang?)  // lang: altyazı dili; 'tr'/'az' ise I→ı, diğerlerinde I→i. Verilmezse Türkçe.
//   oturum: setTyped(ham, şimdiMs?) → { changed, done } · advance() · seekTime(sn) · indexAt(sn) · idle()
//           clean(ham) · quick() → { dks, accuracy } · stats() → { correct, wrong, total, accuracy, dks, activeMs, lines, topMisses }
//   dks = (doğru tuş / 5) / aktif dakika. 3 sn'den uzun boşluklar aktif süreye sayılmaz.
YTYaz.engine.normalize(metin, lang?) · clean(ham, lang?) · findCueIndex(cues, sn)

// overlay — yalnızca görünüm ve girdi; karar vermez. main, setHandlers ile bağlanır.
YTYaz.overlay.mount(player) · unmount() · setHandlers({ onInput, onFocus, onResult, onReload, onClose })
//   setLine(cue, sonrakiMetin) · updateLine(changed, states, imleç) · setMessage · setStats · setMode · setDone
//   setInputValue · clearInput · focusInput · setHidden · showResult(stats, geçmiş, başlık) · hideResult
//   getHistory() · pushHistory(kayıt)   // localStorage 'ytyaz:history', son 20 kayıt

// main — video olaylarını dinler, engine ile overlay'i bağlar.
YTYaz.main.toggle() · enable() · disable() · isEnabled()
```
