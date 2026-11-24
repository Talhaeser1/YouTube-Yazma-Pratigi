/*
 * YTYaz.transcript — YouTube altyazı yükleyicisi (sahibi: Mimar)
 *
 * Çalışma ortamı: MAIN world, document_start. Düz ES2020 IIFE, bağımlılık yok.
 *
 * Yöntem (2025+ YouTube'da doğrulandı):
 *  1. Altyazı listesi oynatıcı yanıtından (captionTracks) okunur; videoId URL'deki `v` ile eşleştirilir.
 *  2. `baseUrl` doğrudan fetch edilir. YouTube artık PO token (`pot`) istediği için bu genelde
 *     200 + BOŞ gövde döner; boş değilse doğrudan kullanılır.
 *  3. Boşsa: XHR/fetch sarmalayıcısının yakaladığı, oynatıcının KENDİ /api/timedtext isteğindeki
 *     `pot` + istemci parametreleri (c, cver, ...) seçilen izin baseUrl'sine eklenip yeniden istenir.
 *  4. Henüz yakalanmış istek yoksa (altyazı kapalı ya da script geç enjekte edildi) oynatıcıya
 *     altyazıyı programatik olarak açtırıp isteği tetikleriz; parça önbellekteyse geçici bir
 *     "çeviri dili" seçerek taze istek zorlarız; sonra kullanıcının önceki altyazı durumu geri yüklenir.
 */
(function () {
  'use strict';

  const VERSION = '1.0.4';
  const YTYaz = (window.YTYaz = window.YTYaz || {});
  if (YTYaz.transcript && YTYaz.transcript.__version === VERSION) return; // idempotent

  const MAX_CUE_CHARS = 70;
  const TIMEDTEXT_RE = /\/api\/timedtext/;

  // ---------------------------------------------------------------------------
  // 1) Ağ kancaları — sayfa ömrü boyunca TEK kez kurulur (ikinci enjeksiyonda çift sarmalama yok)
  // ---------------------------------------------------------------------------
  const HOOK_KEY = '__ytyazTimedtextHook';
  let hook = window[HOOK_KEY];
  if (!hook) {
    hook = {
      captures: [], // { videoId, url, body, at } — en yeni sonda
      listeners: new Set(),
    };
    try {
      Object.defineProperty(window, HOOK_KEY, { value: hook, configurable: false, enumerable: false });
    } catch (_) {
      window[HOOK_KEY] = hook;
    }

    const record = (url, body) => {
      try {
        const u = new URL(url, location.href);
        if (!u.searchParams.get('pot')) return; // pot'suz URL bizim için değersiz
        const entry = { videoId: u.searchParams.get('v') || '', url: u.href, body: body || '', at: Date.now() };
        hook.captures.push(entry);
        if (hook.captures.length > 8) hook.captures.splice(0, hook.captures.length - 8);
        hook.listeners.forEach((fn) => {
          try { fn(entry); } catch (_) { /* dinleyici hatası sayfayı etkilemesin */ }
        });
      } catch (_) { /* yut */ }
    };

    // --- XMLHttpRequest (oynatıcı altyazıyı XHR ile çekiyor — 2026-11'de doğrulandı)
    try {
      const XHR = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
      const origOpen = XHR && XHR.open;
      if (origOpen) {
        XHR.open = function open(method, url) {
          try {
            if (url != null && TIMEDTEXT_RE.test(String(url))) {
              const reqUrl = String(url);
              this.addEventListener('load', function () {
                try {
                  if (this.status !== 200) return;
                  const rt = this.responseType;
                  const body = rt === '' || rt === 'text' ? this.responseText : '';
                  record(reqUrl, body);
                } catch (_) { /* yut */ }
              });
            }
          } catch (_) { /* yut */ }
          return origOpen.apply(this, arguments);
        };
      }
    } catch (_) { /* yut */ }

    // --- fetch (yedek: ileride fetch'e geçerlerse). Yanıt gövdesine DOKUNMAYIZ, aynı promise döner.
    try {
      const origFetch = window.fetch;
      if (typeof origFetch === 'function') {
        window.fetch = function fetch(input, init) {
          const p = origFetch.apply(this, arguments);
          try {
            const url = typeof input === 'string' ? input : input && (input.url || input.href || String(input));
            if (url && TIMEDTEXT_RE.test(url)) {
              p.then((r) => { if (r && r.ok) record(url, ''); }, () => {});
            }
          } catch (_) { /* yut */ }
          return p;
        };
      }
    } catch (_) { /* yut */ }
  }

  // ---------------------------------------------------------------------------
  // 2) Yardımcılar
  // ---------------------------------------------------------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function makeError(code, message) {
    const e = new Error(message || code);
    e.code = code;
    return e;
  }

  function currentVideoId() {
    if (location.pathname !== '/watch') return '';
    return new URLSearchParams(location.search).get('v') || '';
  }

  function getPlayer() {
    return document.querySelector('#movie_player');
  }

  function getMatchingPlayerResponse(videoId) {
    const candidates = [];
    try {
      const p = getPlayer();
      if (p && typeof p.getPlayerResponse === 'function') candidates.push(p.getPlayerResponse());
    } catch (_) { /* yut */ }
    try {
      const flexy = document.querySelector('ytd-watch-flexy');
      if (flexy && flexy.playerData) candidates.push(flexy.playerData);
    } catch (_) { /* yut */ }
    candidates.push(window.ytInitialPlayerResponse);
    for (const pr of candidates) {
      if (pr && pr.videoDetails && pr.videoDetails.videoId === videoId) return pr;
    }
    return null;
  }

  async function waitForPlayerResponse(videoId, timeoutMs) {
    const until = Date.now() + timeoutMs;
    for (;;) {
      const pr = getMatchingPlayerResponse(videoId);
      if (pr) return pr;
      if (Date.now() > until) return null;
      await sleep(250);
    }
  }

  // Türkçe: elle yazılmış > otomatik. Yoksa: konuşma dilindeki elle yazılmış > otomatik > herhangi bir elle yazılmış.
  function pickTrack(tracks) {
    const isTr = (t) => /^tr(-|$)/i.test(t.languageCode || '');
    const isAsr = (t) => t.kind === 'asr';
    const byOrder = [
      (t) => isTr(t) && !isAsr(t),
      (t) => isTr(t) && isAsr(t),
    ];
    const asr = tracks.find(isAsr);
    if (asr) {
      const base = (asr.languageCode || '').split('-')[0];
      byOrder.push((t) => !isAsr(t) && (t.languageCode || '').split('-')[0] === base);
      byOrder.push((t) => t === asr);
    }
    byOrder.push((t) => !isAsr(t));
    byOrder.push(() => true);
    for (const pred of byOrder) {
      const t = tracks.find(pred);
      if (t) return t;
    }
    return null;
  }

  const EXCLUDED_COPY = new Set(['lang', 'kind', 'tlang', 'name', 'variant', 'fmt', 'v']);

  function buildUrlWithPot(baseUrl, capturedUrl) {
    const u = new URL(baseUrl, location.href);
    const c = new URL(capturedUrl, location.href);
    c.searchParams.forEach((val, key) => {
      if (!EXCLUDED_COPY.has(key) && !u.searchParams.has(key)) u.searchParams.set(key, val);
    });
    u.searchParams.set('fmt', 'json3');
    return u.href;
  }

  async function fetchText(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) return '';
    return r.text();
  }

  function parseJson(text) {
    if (!text) return null;
    try {
      const j = JSON.parse(text);
      return j && Array.isArray(j.events) ? j : null;
    } catch (_) {
      return null;
    }
  }

  function latestCapture(videoId) {
    for (let i = hook.captures.length - 1; i >= 0; i--) {
      if (hook.captures[i].videoId === videoId) return hook.captures[i];
    }
    return null;
  }

  function waitForCapture(videoId, sinceMs, timeoutMs) {
    return new Promise((resolve) => {
      const existing = hook.captures.find((c) => c.videoId === videoId && c.at >= sinceMs);
      if (existing) return resolve(existing);
      let done = false;
      const fn = (entry) => {
        if (done || entry.videoId !== videoId) return;
        done = true;
        hook.listeners.delete(fn);
        clearTimeout(timer);
        resolve(entry);
      };
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        hook.listeners.delete(fn);
        resolve(null);
      }, timeoutMs);
      hook.listeners.add(fn);
    });
  }

  function isAdShowing(player) {
    return !!(player && player.classList && player.classList.contains('ad-showing'));
  }

  // Oynatıcıya altyazı isteği attırır; pot içeren isteği yakalar; önceki altyazı durumunu geri yükler.
  async function triggerPlayerRequest(videoId, track, pr) {
    const player = getPlayer();
    if (!player || typeof player.setOption !== 'function') return null;

    // Reklam bitene kadar bekle (reklam sırasında altyazı seçenekleri reklama uygulanır).
    const adUntil = Date.now() + 120000;
    while (isAdShowing(player) && Date.now() < adUntil) {
      if (currentVideoId() !== videoId) return null;
      await sleep(500);
    }

    let prevTrack = null;
    try { prevTrack = player.getOption('captions', 'track'); } catch (_) { /* yut */ }
    const wasOn = !!(prevTrack && prevTrack.languageCode);

    const since = Date.now();
    const got = (ms) => waitForCapture(videoId, since, ms);
    let capture = null;

    try {
      try { player.loadModule('captions'); } catch (_) { /* yut */ }
      await sleep(300);

      // a) Hedef izi seç (önbellekte değilse oynatıcı istek atar).
      let target = null;
      try {
        const list = player.getOption('captions', 'tracklist', { includeAsr: true }) || [];
        target = list.find((t) => t.vss_id === track.vssId) ||
          list.find((t) => t.languageCode === track.languageCode && (t.kind || '') === (track.kind || ''));
      } catch (_) { /* yut */ }
      const targetOpt = target || { languageCode: track.languageCode, kind: track.kind || '' };
      // Hedef iz zaten etkinse oynatıcı onu önbellekten kullanır, istek gitmez → beklemeden (b)'ye geç.
      const alreadyActive = wasOn && !prevTrack.translationLanguage &&
        prevTrack.vss_id === (targetOpt.vss_id || track.vssId);
      if (!alreadyActive) {
        try { player.setOption('captions', 'track', targetOpt); } catch (_) { /* yut */ }
        capture = await got(2500);
      }

      // b) İz önbellekteyse istek gitmez → geçici çeviri dili seçerek taze istek zorla.
      if (!capture) {
        const langs = ((pr.captions && pr.captions.playerCaptionsTracklistRenderer &&
          pr.captions.playerCaptionsTracklistRenderer.translationLanguages) || [])
          .map((l) => l.languageCode);
        const pref = ['is', 'eu', 'gl', 'cy', 'mt', 'lb', 'af'];
        const tl = pref.find((c) => langs.includes(c)) || langs.find((c) => c !== track.languageCode) || 'is';
        let cur = null;
        try { cur = player.getOption('captions', 'track'); } catch (_) { /* yut */ }
        const base = cur && cur.languageCode ? cur : targetOpt;
        try {
          player.setOption('captions', 'track',
            Object.assign({}, base, { translationLanguage: { languageCode: tl, languageName: tl } }));
        } catch (_) { /* yut */ }
        capture = await got(3500);
      }

      // c) Son çare: modülü kapat/aç.
      if (!capture) {
        try { player.unloadModule('captions'); } catch (_) { /* yut */ }
        await sleep(300);
        try { player.loadModule('captions'); } catch (_) { /* yut */ }
        try { player.setOption('captions', 'track', targetOpt); } catch (_) { /* yut */ }
        capture = await got(3500);
      }
    } finally {
      // Kullanıcının önceki altyazı durumunu geri yükle.
      try {
        if (wasOn) {
          const restore = Object.assign({}, prevTrack);
          if (!restore.translationLanguage) delete restore.translationLanguage;
          player.setOption('captions', 'track', restore);
        } else {
          player.unloadModule('captions');
        }
      } catch (_) { /* yut */ }
    }
    return capture;
  }

  // ---------------------------------------------------------------------------
  // 3) json3 → temiz, çakışmayan cue'lar
  // ---------------------------------------------------------------------------
  function cleanText(s) {
    return s
      .replace(/\[[^\]]*\]/g, ' ') // [Müzik], [Alkış] ...
      .replace(/[♪♫♬]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Her olay → { start, end, tokens: [{ text, t|null }] }   (zamanlar ms)
  function eventsToLines(events) {
    const lines = [];
    for (const ev of events) {
      if (!ev || !Array.isArray(ev.segs) || ev.aAppend) continue;
      const start = ev.tStartMs || 0;
      const dur = ev.dDurationMs || 0;
      const tokens = [];
      let hasWordTimes = false;
      for (const seg of ev.segs) {
        const txt = (seg && seg.utf8) || '';
        if (!txt) continue;
        const segTime = start + (seg.tOffsetMs || 0);
        if (seg.tOffsetMs != null) hasWordTimes = true;
        const parts = txt.split(/\s+/).filter(Boolean);
        // asr'de her seg bir kelime (önünde boşluk); manuel seg'ler çok kelimeli olabilir.
        parts.forEach((p, i) => tokens.push({ text: p, t: i === 0 ? segTime : null }));
      }
      if (!tokens.length) continue;
      // Kelime zamanı yoksa yalnızca ilk kelimenin zamanı (satır başı) bilinir.
      if (!hasWordTimes) tokens.forEach((tk, i) => { if (i) tk.t = null; });
      tokens[0].t = start;
      lines.push({ start, end: start + dur, tokens });
    }
    lines.sort((a, b) => a.start - b.start);

    // Aynı başlangıçlı satırları birleştir.
    const merged = [];
    for (const l of lines) {
      const prev = merged[merged.length - 1];
      if (prev && l.start === prev.start) {
        prev.tokens = prev.tokens.concat(l.tokens);
        prev.end = Math.max(prev.end, l.end);
      } else merged.push(l);
    }
    // Çakışma giderme: bir satır bir sonrakinin başında biter (asr kayan pencereleri dahil).
    for (let i = 0; i < merged.length - 1; i++) {
      if (merged[i].end > merged[i + 1].start) merged[i].end = merged[i + 1].start;
    }
    return merged;
  }

  // Köşeli parantezli etiketleri token düzeyinde at (birden çok kelimeye yayılabilir).
  function stripBracketTokens(tokens) {
    const out = [];
    let depth = 0;
    for (const tk of tokens) {
      let text = '';
      for (const ch of tk.text) {
        if (ch === '[') depth++;
        else if (ch === ']') { if (depth > 0) depth--; }
        else if (depth === 0) text += ch;
      }
      text = text.replace(/[♪♫♬]+/g, '');
      if (text) out.push({ text, t: tk.t });
    }
    return out;
  }

  // Kelime sınırından dengeli parçala: her parça <= MAX_CUE_CHARS (tek kelime daha uzunsa tek başına),
  // parçalar yaklaşık eşit uzunlukta (sonda tek kelimelik "yetim" parça kalmasın).
  function chunkTokens(tokens) {
    const totalChars = tokens.reduce((s, t, i) => s + t.text.length + (i ? 1 : 0), 0);
    if (totalChars <= MAX_CUE_CHARS) return [tokens];
    const chunks = [];
    let cur = [];
    let curLen = 0;
    let remaining = totalChars; // geçerli parçanın başından metnin sonuna kadar karakter
    let left = Math.ceil(remaining / MAX_CUE_CHARS);
    let target = remaining / left;
    for (const tk of tokens) {
      const add = (cur.length ? 1 : 0) + tk.text.length;
      if (cur.length) {
        const hard = curLen + add > MAX_CUE_CHARS;
        const soft = left > 1 && curLen + add > target && curLen + add - target > target - curLen;
        if (hard || soft) {
          chunks.push(cur);
          remaining -= curLen + 1;
          left = Math.max(1, Math.ceil(remaining / MAX_CUE_CHARS));
          target = remaining / left;
          cur = [];
          curLen = 0;
        }
      }
      curLen += (cur.length ? 1 : 0) + tk.text.length;
      cur.push(tk);
    }
    if (cur.length) chunks.push(cur);
    return chunks;
  }

  function splitLine(line) {
    const tokens = stripBracketTokens(line.tokens);
    if (!tokens.length) return [];
    const full = tokens.map((t) => t.text).join(' ');
    const totalChars = full.length;
    const start = line.start;
    const end = Math.max(line.end, start + 1);
    const chunks = chunkTokens(tokens);

    // Parça zamanları: kelime zamanı (asr) varsa onu, yoksa karakter oranını kullan.
    const result = [];
    let charPos = 0;
    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i].map((t) => t.text).join(' ');
      const propStart = start + ((end - start) * charPos) / totalChars;
      const s = i === 0 ? start : chunks[i][0].t != null ? chunks[i][0].t : propStart;
      result.push({ s, text });
      charPos += text.length + 1;
    }
    for (let i = 0; i < result.length; i++) {
      result[i].e = i + 1 < result.length ? result[i + 1].s : end;
    }
    return result
      .map((r) => ({ start: r.s, end: r.e, text: cleanText(r.text) }))
      .filter((c) => c.text && c.end > c.start);
  }

  // asr: satır kırılımları keyfi; kelime zamanlarından cümle/duraklama tabanlı cue'lar kur.
  function asrLinesToCues(lines) {
    const words = [];
    let lastT = 0;
    for (const l of lines) {
      for (const tk of stripBracketTokens(l.tokens)) {
        const t = tk.t != null ? Math.max(tk.t, lastT) : lastT;
        lastT = t;
        words.push({ text: tk.text, t, lineEnd: l.end });
      }
    }
    // Önce ifadelere ayır (cümle sonu noktalaması ya da uzun duraklama), sonra her ifadeyi dengeli böl.
    const phrases = [];
    let cur = [];
    let curLen = 0;
    const flush = () => { if (cur.length) phrases.push(cur); cur = []; curLen = 0; };
    for (const w of words) {
      if (cur.length && w.t - cur[cur.length - 1].t > 1500 && curLen >= 8) flush();
      curLen += (cur.length ? 1 : 0) + w.text.length;
      cur.push(w);
      if (/[.!?…]["'”’)]?$/.test(w.text) && curLen >= 20) flush();
    }
    flush();
    const groups = [];
    for (const ph of phrases) for (const ch of chunkTokens(ph)) groups.push(ch);

    const cues = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const start = g[0].t;
      const last = g[g.length - 1];
      let end = Math.max(last.lineEnd, last.t + 300);
      if (i + 1 < groups.length) end = Math.min(end, groups[i + 1][0].t);
      cues.push({ start, end, text: cleanText(g.map((w) => w.text).join(' ')) });
    }
    return cues;
  }

  function json3ToCues(json) {
    const lines = eventsToLines(json.events || []);
    const isAsr = lines.some((l) => l.tokens.length > 1 && l.tokens.every((tk) => tk.t != null));
    const raw = isAsr ? asrLinesToCues(lines) : null;
    const cues = [];
    if (raw) {
      for (const c of raw) {
        const prev = cues[cues.length - 1];
        const start = prev ? Math.max(c.start, prev.end) : c.start;
        if (!c.text || c.end <= start) continue;
        cues.push({ start: start / 1000, end: c.end / 1000, text: c.text });
      }
      return cues;
    }
    for (const l of lines) {
      for (const c of splitLine(l)) {
        const prev = cues[cues.length - 1];
        const start = prev ? Math.max(c.start, prev.end) : c.start;
        if (c.end <= start) continue;
        cues.push({ start: start / 1000, end: c.end / 1000, text: c.text });
      }
    }
    return cues;
  }

  // ---------------------------------------------------------------------------
  // 4) Genel arayüz
  // ---------------------------------------------------------------------------
  const inflight = new Map(); // videoId -> Promise
  const cache = new Map(); // videoId -> sonuç (yalnızca son birkaç)

  async function loadImpl(videoId) {
    const pr = await waitForPlayerResponse(videoId, 15000);
    if (!pr) throw makeError('FETCH_FAILED', 'Oynatıcı yanıtı bulunamadı: ' + videoId);
    const tracks =
      (pr.captions && pr.captions.playerCaptionsTracklistRenderer &&
        pr.captions.playerCaptionsTracklistRenderer.captionTracks) || [];
    if (!tracks.length) throw makeError('NO_CAPTIONS', 'Bu videoda altyazı yok.');
    const track = pickTrack(tracks);
    const kind = track.kind === 'asr' ? 'asr' : 'manual';

    let json = null;
    // (1) Doğrudan deneme (pot gerekmiyorsa çalışır).
    try {
      const u = new URL(track.baseUrl, location.href);
      u.searchParams.set('fmt', 'json3');
      json = parseJson(await fetchText(u.href));
    } catch (_) { /* yoksay, sıradakine geç */ }

    // (2) Yakalanmış pot ile.
    if (!json) {
      let cap = latestCapture(videoId);
      if (cap) {
        try { json = parseJson(await fetchText(buildUrlWithPot(track.baseUrl, cap.url))); } catch (_) { /* yut */ }
      }
      // (3) Oynatıcıyı tetikle, yeni pot yakala.
      if (!json) {
        if (currentVideoId() !== videoId) throw makeError('FETCH_FAILED', 'Video değişti.');
        cap = await triggerPlayerRequest(videoId, track, pr);
        if (cap) {
          try { json = parseJson(await fetchText(buildUrlWithPot(track.baseUrl, cap.url))); } catch (_) { /* yut */ }
          // Yakalanan gövde tam da istediğimiz iz ise onu kullan.
          if (!json && cap.body) {
            const cu = new URL(cap.url);
            if (cu.searchParams.get('lang') === track.languageCode && !cu.searchParams.get('tlang') &&
                (cu.searchParams.get('kind') || '') === (track.kind || '')) {
              json = parseJson(cap.body);
            }
          }
        }
      }
    }
    if (!json) throw makeError('FETCH_FAILED', 'Altyazı indirilemedi (PO token alınamadı).');

    const cues = json3ToCues(json);
    if (!cues.length) throw makeError('NO_CAPTIONS', 'Altyazı boş.');
    return { videoId, lang: track.languageCode, kind, cues };
  }

  function load() {
    const videoId = currentVideoId();
    if (!videoId) return Promise.reject(makeError('NO_CAPTIONS', 'İzleme sayfası değil.'));
    if (cache.has(videoId)) return Promise.resolve(cache.get(videoId));
    if (inflight.has(videoId)) return inflight.get(videoId);
    const p = loadImpl(videoId).then(
      (res) => {
        inflight.delete(videoId);
        cache.set(videoId, res);
        if (cache.size > 5) cache.delete(cache.keys().next().value);
        return res;
      },
      (err) => {
        inflight.delete(videoId);
        throw err;
      }
    );
    inflight.set(videoId, p);
    return p;
  }

  // --- Yerel altyazıyı gizle: <html> üzerinde class + tek <style> (Trusted Types uyumlu)
  const HIDE_CLASS = 'ytyaz-hide-native-captions';
  const STYLE_ID = 'ytyaz-hide-native-captions-style';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      'html.' + HIDE_CLASS + ' #movie_player .ytp-caption-window-container,' +
      'html.' + HIDE_CLASS + ' #movie_player .caption-window' +
      '{display:none !important;}';
    (document.head || document.documentElement).appendChild(st);
  }

  function hideNativeCaptions(hide) {
    try {
      ensureStyle();
      document.documentElement.classList.toggle(HIDE_CLASS, !!hide);
    } catch (_) { /* yut */ }
  }

  YTYaz.transcript = {
    __version: VERSION,
    load,
    hideNativeCaptions,
    // Test/hata ayıklama için (arayüzün parçası değil):
    _parseJson3: json3ToCues,
  };
})();
