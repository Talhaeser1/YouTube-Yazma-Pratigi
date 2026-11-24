/* YTYaz.engine — saf yazma mantığı (DOM yok). */
(function () {
  'use strict';
  const Y = (window.YTYaz = window.YTYaz || {});
  if (Y.engine) return;

  const IDLE_GAP = 3000;   // bu süreden uzun boşluklar aktif süreye sayılmaz (ms)
  const MIN_ACTIVE = 2000; // DKS gösteriminde alt sınır (ms), ilk tuşlarda uçuk değer çıkmasın

  const APOS = new Set(["'", '’', '‘', '`', '´', 'ʼ', '′']);
  const LETTER = /^[\p{L}\p{N}]+$/u;

  // Karakter karakter normalize + özgün→hedef eşleme.
  // Kurallar: kesme işareti hiçbir şey; harf/rakam → tr küçük harf; diğer her şey (boşluk, noktalama)
  // bir 'ayraç' koşusu olur ve iki kelime arasında TEK boşluk üretir. Boşluk, koşunun SON özgün
  // karakterine eşlenir ("Merhaba, dünya" → boşluk karakteri yazılır, virgül atlanır).
  // keepTrailing: kullanıcının yazdığı metinde sondaki boşluk korunur.
  // lang: altyazı dili. Türkçe/Azerice'de I→ı, İ→i; diğer dillerde I→i (yoksa "I think" hata sayılır).
  // Verilmezse Türkçe kabul edilir.
  const TR_LANG = /^(tr|az)(-|$)/i;
  function lower(ch, lang) {
    if (lang == null || TR_LANG.test(lang)) return ch.toLocaleLowerCase('tr');
    return ch.toLowerCase().replace(/̇/g, ''); // İ → "i̇" olur; birleşen noktayı at
  }
  function walk(text, keepTrailing, lang) {
    const chars = Array.from(String(text == null ? '' : text).normalize('NFC'));
    const map = new Int32Array(chars.length).fill(-1); // özgün indeks → hedef indeks (-1: atlanan)
    const t2o = [];                                     // hedef indeks → özgün indeks
    let target = '', pend = -1;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (APOS.has(ch)) continue;
      const lc = lower(ch, lang);
      if (LETTER.test(lc)) {
        if (pend >= 0 && target) { map[pend] = target.length; t2o.push(pend); target += ' '; }
        pend = -1;
        map[i] = target.length;
        for (let k = 0; k < lc.length; k++) t2o.push(i);
        target += lc;
      } else pend = i;
    }
    if (keepTrailing && pend >= 0 && target) { map[pend] = target.length; t2o.push(pend); target += ' '; }
    return { chars, map, t2o, target };
  }
  function normalize(text, lang) { return walk(text, false, lang).target; }
  // Kullanıcının yazdığı ham metin: baştaki boşluk atılır, sondaki kalır (yazım sürüyor olabilir).
  function clean(raw, lang) { return walk(raw, true, lang).target; }

  // İkili arama: end > t olan ilk cue'nun indeksi (yoksa cues.length).
  function findCueIndex(cues, t) {
    let lo = 0, hi = cues.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cues[mid].end > t) hi = mid; else lo = mid + 1;
    }
    return lo;
  }

  function createSession(rawCues, lang) {
    const cues = [];
    for (const c of rawCues || []) {
      const w = walk(String(c.text == null ? '' : c.text).replace(/\s+/g, ' ').trim(), false, lang);
      if (w.target) cues.push({ start: c.start, end: c.end, text: c.text, target: w.target, orig: w.chars, map: w.map, t2o: w.t2o });
    }

    let lastTs = null, activeMs = 0, correct = 0, wrong = 0, lines = 0;
    const miss = Object.create(null);

    const s = {
      cues,
      count: cues.length,
      index: 0,
      target: '',
      typed: '',
      states: new Uint8Array(0), // 0 todo, 1 ok, 2 bad
      done: false,
      get finished() { return s.index >= cues.length; },
      get cue() { return cues[s.index] || null; },

      indexAt(t) { return findCueIndex(cues, t); },

      // Geçerli satırı sıfırla (istatistik korunur).
      resetLine() {
        const c = cues[s.index];
        s.target = c ? c.target : '';
        s.typed = '';
        s.states = new Uint8Array(s.target.length);
        s.done = false;
      },
      seekTime(t) { s.index = findCueIndex(cues, t); s.resetLine(); lastTs = null; },
      advance() { s.index++; s.resetLine(); return !s.finished; },
      idle() { lastTs = null; },
      // Ham girdiyi bu oturumun diliyle normalize eder.
      clean(raw) { return clean(raw, lang); },

      // Ham girdiyi uygular. Dönüş: değişen karakter indeksleri ve satır bitti mi.
      setTyped(raw, now) {
        if (s.done || s.finished) return { changed: [], done: s.done };
        now = now == null ? Date.now() : now;
        const target = s.target;
        let nt = clean(raw, lang);
        if (nt.length > target.length) nt = nt.slice(0, target.length);
        const old = s.typed;
        if (nt === old) return { changed: [], done: false };

        let p = 0;
        const m = Math.min(old.length, nt.length);
        while (p < m && old[p] === nt[p]) p++;

        // Eklenen karakterler tuş sayılır.
        for (let i = p; i < nt.length; i++) {
          if (nt[i] === target[i]) correct++;
          else { wrong++; const k = target[i]; miss[k] = (miss[k] || 0) + 1; }
        }
        // Aktif süre
        if (lastTs != null) { const d = now - lastTs; if (d <= IDLE_GAP) activeMs += d; }
        lastTs = now;

        const changed = [];
        const end = Math.max(old.length, nt.length);
        for (let i = p; i < end; i++) {
          const st = i < nt.length ? (nt[i] === target[i] ? 1 : 2) : 0;
          if (s.states[i] !== st) { s.states[i] = st; changed.push(i); }
        }
        s.typed = nt;
        // lastTs korunur: satırlar arası süre de (IDLE_GAP'ten kısaysa) aktif süreye sayılır.
        if (nt.length >= target.length) { s.done = true; lines++; }
        return { changed, done: s.done };
      },

      quick() {
        const total = correct + wrong;
        const act = Math.max(activeMs, correct > 0 ? MIN_ACTIVE : 0);
        return {
          dks: act > 0 ? (correct / 5) / (act / 60000) : 0,
          accuracy: total ? (correct / total) * 100 : 100,
        };
      },

      stats() {
        const q = s.quick();
        const topMisses = Object.keys(miss)
          .map((ch) => ({ ch, n: miss[ch] }))
          .sort((a, b) => b.n - a.n)
          .slice(0, 5);
        return { correct, wrong, total: correct + wrong, accuracy: q.accuracy, dks: q.dks, activeMs, lines, topMisses };
      },
    };
    s.resetLine();
    return s;
  }

  Y.engine = { normalize, clean, walk, findCueIndex, createSession };
})();
