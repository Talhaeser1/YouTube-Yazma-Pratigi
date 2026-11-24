/*
 * Kalıcı testler — bağımlılık yok. Çalıştırma:  node test/run.js
 * Kapsam: engine.js (saf mantık), transcript.js ayrıştırıcısı, main.js oturum akışı (sahte video/katman ile).
 * Kapsam DIŞI: YouTube'dan altyazı çekme, gerçek DOM/görünüm — bunlar tarayıcıda elle doğrulanır (PROGRESS.md).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const SRC = path.join(__dirname, '..', 'src');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

// ---------- sahte tarayıcı ortamı ----------
const winEvents = new EventTarget();
const docEvents = new EventTarget();
global.window = global;
global.addEventListener = winEvents.addEventListener.bind(winEvents);
global.location = { pathname: '/watch', search: '?v=abc', href: 'https://www.youtube.com/watch?v=abc' };
global.XMLHttpRequest = function () {};
global.XMLHttpRequest.prototype.open = function () {};
global.MutationObserver = class { observe() {} disconnect() {} };

class FakeVideo extends EventTarget {
  constructor() { super(); this.paused = false; this.currentTime = 0; this.seeking = false; }
  fire(t) { this.dispatchEvent(new Event(t)); }
  play() { this.paused = false; this.fire('play'); return Promise.resolve(); }
  pause() { this.paused = true; this.fire('pause'); }
  seek(t) { this.currentTime = t; this.fire('seeked'); }
}
const video = new FakeVideo();
const playerClasses = new Set();
const player = {
  classList: { contains: (c) => playerClasses.has(c) },
  querySelector: (sel) => (sel === 'video.html5-main-video' ? video : null),
};
global.document = {
  title: 'Deneme Videosu - YouTube',
  readyState: 'complete',
  activeElement: null,
  documentElement: { classList: { toggle() {} } },
  addEventListener: docEvents.addEventListener.bind(docEvents),
  getElementById: (id) => (id === 'movie_player' ? player : null),
  querySelector: () => null,
};

eval(read('engine.js'));
eval(read('transcript.js'));
const E = YTYaz.engine;
const parse = YTYaz.transcript._parseJson3;

// Testler kuyruğa alınır ve SIRAYLA çalışır (main.js testleri ortak sahte videoyu kullanır).
const queue = [];
function section(title) { queue.push({ title }); }
function test(name, fn) { queue.push({ name, fn }); }
// Metni tuş tuş yazar; her tuş arası `ms`. Dönüş: son zaman.
function type(s, text, t, ms) {
  let typed = '';
  for (const ch of text) { typed += ch; s.setTyped(typed, (t += ms)); typed = s.typed; }
  return t;
}

// ---------- engine ----------
section('engine.js');
test('Türkçe: büyük/küçük harf, noktalama, kesme işareti', () => {
  assert.strictEqual(E.normalize("Merhaba, DÜNYA! Ali'nin IŞIĞI 3.5 İyi"), 'merhaba dünya alinin ışığı 3 5 iyi');
  assert.strictEqual(E.normalize('IŞIK', 'tr'), 'ışık');
});
test('İngilizce altyazıda I → i (D1)', () => {
  assert.strictEqual(E.normalize('I think It Is', 'en'), 'i think it is');
  assert.strictEqual(E.normalize('İstanbul', 'en'), 'istanbul');
  const s = E.createSession([{ start: 0, end: 2, text: 'I think it is' }], 'en');
  type(s, 'i think it is', 0, 200);
  assert.strictEqual(s.stats().wrong, 0);
  assert.strictEqual(s.done, true);
});
test('dil verilmezse Türkçe kuralı geçerli (sözleşme)', () => {
  assert.strictEqual(E.normalize('I'), 'ı');
});
test('noktalama yazılsa da yazılmasa da kabul edilir', () => {
  for (const input of ['Evet, 3.5 oldu.', 'evet 3 5 oldu']) {
    const s = E.createSession([{ start: 0, end: 2, text: 'Evet, 3.5 oldu.' }], 'tr');
    type(s, input, 0, 200);
    assert.strictEqual(s.stats().wrong, 0, input);
    assert.strictEqual(s.done, true, input);
  }
});
test('yanlış harf sayılır, silinip düzeltilebilir', () => {
  const s = E.createSession([{ start: 0, end: 2, text: 'kedi' }], 'tr');
  s.setTyped('kx', 100);
  assert.deepStrictEqual(Array.from(s.states), [1, 2, 0, 0]);
  s.setTyped('k', 200);
  s.setTyped('kedi', 300);
  const x = s.stats();
  assert.strictEqual(x.wrong, 1);
  assert.strictEqual(x.topMisses[0].ch, 'e');
  assert.strictEqual(s.done, true);
});
test('DKS: satır geçişindeki süre de sayılır (D5)', () => {
  const line = 'abcd efgh ijkl mnopq'; // 20 tuş, 200 ms aralık → 60 kelime/dk
  const s = E.createSession([0, 1, 2].map((i) => ({ start: i, end: i + 1, text: line })), 'tr');
  let t = 0;
  for (let i = 0; i < 3; i++) { t = type(s, line, t, 200); s.advance(); }
  const x = s.stats();
  assert.strictEqual(x.activeMs, 59 * 200);
  assert.ok(Math.abs(x.dks - 61.0) < 0.1, 'dks=' + x.dks); // 60 tuş / 59 aralık
});
test('DKS: 3 sn üstü boşluk aktif süreye sayılmaz', () => {
  const s = E.createSession([{ start: 0, end: 1, text: 'abcdef' }], 'tr');
  s.setTyped('a', 0); s.setTyped('ab', 200); s.setTyped('abc', 10200); s.setTyped('abcd', 10400);
  assert.strictEqual(s.stats().activeMs, 400);
});
test('findCueIndex: ikili arama', () => {
  const cues = [{ end: 1 }, { end: 2 }, { end: 3 }];
  assert.deepStrictEqual([0, 1, 2.5, 3].map((t) => E.findCueIndex(cues, t)), [0, 1, 2, 3]);
});

// ---------- transcript ayrıştırıcı ----------
section('transcript.js (ayrıştırıcı)');
test('elle yazılmış: etiket atılır, uzun satır bölünür, çakışma olmaz', () => {
  const cues = parse({ events: [
    { tStartMs: 0, dDurationMs: 4000, segs: [{ utf8: '[Müzik]' }] },
    { tStartMs: 1000, dDurationMs: 6000, segs: [{ utf8: 'Bu çok uzun bir altyazı satırıdır ve yetmiş karakterden fazla olduğu için kelime sınırından ikiye bölünmesi gerekir değil mi' }] },
    { tStartMs: 5000, dDurationMs: 3000, segs: [{ utf8: 'İkinci\nsatır ♪' }] },
  ] });
  assert.strictEqual(cues.length, 3);
  assert.ok(cues.every((c) => c.text.length <= 70));
  assert.ok(cues.every((c, i) => !i || c.start >= cues[i - 1].end));
  assert.strictEqual(cues[2].text, 'İkinci satır');
  assert.ok(!cues.some((c) => /[\[\]♪]/.test(c.text)));
});
test('otomatik (asr): kelime zamanlarından satır kurulur', () => {
  const cues = parse({ events: [
    { tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: 'merhaba' }, { utf8: ' arkadaşlar', tOffsetMs: 500 }, { utf8: ' bugün', tOffsetMs: 1000 }] },
    { tStartMs: 2990, dDurationMs: 10, aAppend: 1, segs: [{ utf8: '\n' }] },
    { tStartMs: 3000, dDurationMs: 3000, segs: [{ utf8: 'size' }, { utf8: ' bir', tOffsetMs: 400 }, { utf8: ' şey', tOffsetMs: 800 }] },
  ] });
  assert.deepStrictEqual(cues, [
    { start: 0, end: 3, text: 'merhaba arkadaşlar bugün' },
    { start: 3, end: 6, text: 'size bir şey' },
  ]);
});

// ---------- main.js oturum akışı ----------
section('main.js (sahte video ve katman ile)');
const history = [];
const shown = [];
let handlers = {};
let focused = false;
let inputValue = '';
// Gerçek katman gibi: zaten odaktaki yazma alanı yeniden focus olayı üretmez; kapatınca odak gider.
YTYaz.overlay = new Proxy({
  mount: () => true,
  unmount() { focused = false; inputValue = ''; },
  setHandlers(h) { handlers = h || {}; },
  focusInput() { if (!focused) { focused = true; handlers.onFocus && handlers.onFocus(true); } },
  isFocused: () => focused,
  setInputValue(v) { inputValue = v; },
  clearInput() { inputValue = ''; },
  getHistory: () => history.slice(),
  pushHistory: (r) => history.push(r),
  showResult: (st) => shown.push(st),
  isResultOpen: () => false,
}, { get: (o, k) => (k in o ? o[k] : () => {}) });

const CUES = [{ start: 0, end: 2, text: 'I am here' }, { start: 2, end: 4, text: 'It is done' }];
const DATA = { videoId: 'abc', lang: 'en', kind: 'manual', cues: CUES };
let loadImpl = () => Promise.resolve(DATA);
YTYaz.transcript.load = () => loadImpl();
eval(read('main.js'));

const tickAsync = () => new Promise((r) => setTimeout(r, 0));
async function start() {
  if (YTYaz.main.isEnabled()) YTYaz.main.disable();
  history.length = 0; shown.length = 0;
  playerClasses.clear();
  video.paused = false; video.currentTime = 0;
  YTYaz.main.enable();
  await tickAsync(); // altyazı yüklemesi
  assert.ok(focused);
}
// Katmandaki textarea'nın yaptığı gibi: her tuşta biriken ham metni bildirir.
// Motor yazma alanını normalleştirilmiş metinle günceller; bir sonraki tuş onun üstüne eklenir.
function typeLine(text) { for (const ch of text) { inputValue += ch; handlers.onInput(inputValue); } }

test('video satır sonunda bekler, satır bitince devam eder', async () => {
  await start();
  video.currentTime = 2.2; video.fire('timeupdate');
  assert.strictEqual(video.paused, true, 'video durmalıydı');
  typeLine('i am here');
  assert.strictEqual(video.paused, false, 'video devam etmeliydi');
});
test('İngilizce altyazı dili motora iletilir (D1)', async () => {
  await start();
  typeLine('i am here');
  assert.strictEqual(shown.length, 0);
  video.currentTime = 2.1;
  typeLine('it is done');
  assert.strictEqual(shown.length, 1, 'son satırda sonuç kartı açılmalı');
  assert.strictEqual(shown[0].wrong, 0);
  assert.strictEqual(history.length, 1);
});
test('bitirip geri sarınca ikinci deneme ayrı kaydedilir (D3)', async () => {
  await start();
  typeLine('i am here'); video.currentTime = 2.1; typeLine('it is done');
  assert.strictEqual(history.length, 1);
  video.seek(0);
  typeLine('i am here');
  YTYaz.main.disable();
  assert.strictEqual(history.length, 2, 'ikinci deneme kaydedilmeliydi');
});
test('sekme kapanınca oturum kaydedilir, iki kez yazılmaz (D2)', async () => {
  await start();
  typeLine('i am here');
  winEvents.dispatchEvent(new Event('pagehide'));
  assert.strictEqual(history.length, 1);
  YTYaz.main.disable();
  assert.strictEqual(history.length, 1);
});
test('reklamın bitişi oturumu bitirmez (D4)', async () => {
  await start();
  typeLine('i am here');
  playerClasses.add('ad-showing');
  video.fire('ended');
  assert.strictEqual(shown.length, 0);
  assert.strictEqual(history.length, 0);
  playerClasses.clear();
  video.fire('ended');
  assert.strictEqual(shown.length, 1);
  assert.strictEqual(history.length, 1);
});
test('Alt+Y sonrası altyazı yüklenirken basılan tuşlar kaybolmaz', async () => {
  if (YTYaz.main.isEnabled()) YTYaz.main.disable();
  history.length = 0; shown.length = 0; playerClasses.clear();
  video.paused = false; video.currentTime = 0;
  let resolve;
  loadImpl = () => new Promise((r) => { resolve = r; });
  try {
    YTYaz.main.enable();
    await tickAsync();
    typeLine('I a'); // henüz satır yok
    resolve(DATA);
    await tickAsync();
    assert.strictEqual(inputValue, 'i a', 'yükleme sırasında yazılanlar satıra uygulanmalıydı');
    typeLine('m here');
    video.currentTime = 2.1;
    typeLine('it is done');
    assert.strictEqual(shown.length, 1);
    assert.strictEqual(shown[0].wrong, 0);
    assert.strictEqual(shown[0].total, 19);
  } finally { loadImpl = () => Promise.resolve(DATA); }
});
test('Alt+R sonrası yazma sürer', async () => {
  await start();
  typeLine('i a');
  handlers.onReload();
  await tickAsync();
  assert.strictEqual(inputValue, '', 'yeniden yüklemede yazma alanı temizlenmeli');
  typeLine('I');
  assert.strictEqual(inputValue, 'i', 'tuş motor tarafından işlenmeliydi');
  typeLine(' am here');
  video.currentTime = 2.1;
  typeLine('it is done');
  assert.strictEqual(shown.length, 1);
  assert.strictEqual(shown[0].wrong, 0);
});
test('5 tuştan kısa oturum kaydedilmez', async () => {
  await start();
  typeLine('i am');
  YTYaz.main.disable();
  assert.strictEqual(history.length, 0);
});

(async () => {
  let passed = 0, failed = 0;
  for (const q of queue) {
    if (q.title) { console.log(q.title); continue; }
    try { await q.fn(); passed++; console.log('  tamam ' + q.name); }
    catch (e) { failed++; console.log('  HATA  ' + q.name + '\n        ' + String(e.message).split('\n')[0]); }
  }
  console.log('\n' + passed + ' geçti, ' + failed + ' kaldı');
  process.exit(failed ? 1 : 0);
})();
