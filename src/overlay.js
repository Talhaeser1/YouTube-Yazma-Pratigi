/* YTYaz.overlay — oynatıcı içindeki şeffaf yazma katmanı. innerHTML kullanılmaz (Trusted Types). */
(function () {
  'use strict';
  const Y = (window.YTYaz = window.YTYaz || {});
  if (Y.overlay) return;

  const PFX = 'ytyaz:';
  const HIST_MAX = 20;

  function lsGet(k, d) { try { const v = localStorage.getItem(PFX + k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(PFX + k, v); } catch (e) { /* yok say */ } }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Delete', 'PageUp', 'PageDown']);
  let ui = null;            // kurulu arayüz referansları
  let ac = null;            // belge dinleyicileri için AbortController
  let handlers = {};
  let spans = [];
  let curStates = null;
  let curIdx = -1;
  let composing = false;
  const cache = { dks: '', acc: '', mode: '' };

  const settings = {
    size: lsGet('size', 'm'),
    pos: lsGet('pos', 'bottom'),
    hide: lsGet('hideNative', '1') !== '0',
  };

  // ---------- kurulum ----------
  function mount(player) {
    if (!player) return false;
    if (ui && ui.layer.parentNode === player) return true;
    unmount();
    player.querySelectorAll('.ytyaz-layer, .ytyaz-result').forEach((n) => n.remove());

    const layer = el('div', 'ytyaz-layer');
    const strip = el('div', 'ytyaz-strip');
    const sDks = el('span', 'ytyaz-dks', 'DKS 0');
    const sAcc = el('span', 'ytyaz-acc', '%100');
    const sMode = el('span', 'ytyaz-mode', '');
    const bGear = el('button', 'ytyaz-btn', 'Ayarlar');
    const bRes = el('button', 'ytyaz-btn', 'Sonuç');
    bGear.type = bRes.type = 'button';
    bGear.title = 'Ayarlar';
    bRes.title = 'Sonuç kartı (Alt+S)';
    const bClose = el('button', 'ytyaz-btn', '✕');
    bClose.type = 'button';
    bClose.title = 'Kapat (Alt+Y)';
    bClose.setAttribute('aria-label', 'Yazma katmanını kapat');
    strip.append(sDks, sAcc, sMode, bGear, bRes, bClose);

    const panel = buildPanel();

    const box = el('div', 'ytyaz-box');
    const line = el('div', 'ytyaz-line');
    const next = el('div', 'ytyaz-next');
    const msg = el('div', 'ytyaz-msg');
    const hint = el('div', 'ytyaz-hint', 'yazmak için tıkla · kapat: Alt+Y');
    const ta = document.createElement('textarea');
    ta.className = 'ytyaz-input';
    ta.setAttribute('autocomplete', 'off');
    ta.setAttribute('autocapitalize', 'off');
    ta.setAttribute('autocorrect', 'off');
    ta.setAttribute('aria-label', 'Yazma alanı');
    ta.spellcheck = false;
    box.append(line, next, msg, hint, ta);

    layer.append(strip, panel.root, box);

    const result = buildResult();

    ui = { layer, sDks, sAcc, sMode, bGear, bRes, panel, box, line, next, msg, ta, result };
    layer.dataset.size = settings.size;
    layer.dataset.pos = settings.pos;

    // Katman üstündeki fare olayları videoya (duraklat/tam ekran) geçmesin; odak textarea'da kalsın.
    for (const t of ['click', 'dblclick', 'mouseup']) {
      layer.addEventListener(t, (e) => e.stopPropagation());
      result.root.addEventListener(t, (e) => e.stopPropagation());
    }
    layer.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    result.root.addEventListener('mousedown', (e) => e.stopPropagation());
    box.addEventListener('click', () => { focusInput(); caretEnd(); });
    bGear.addEventListener('click', () => panel.root.classList.toggle('ytyaz-open'));
    bRes.addEventListener('click', () => handlers.onResult && handlers.onResult());
    bClose.addEventListener('click', () => handlers.onClose && handlers.onClose());

    // Girdi: keydown'dan karakter üretme yok; yalnızca input/beforeinput.
    const stop = (e) => e.stopPropagation();
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { ta.blur(); return; }
      // İmleç hep sonda: gezinme/silme-ileri tuşları etkisiz.
      if (NAV_KEYS.has(e.key)) e.preventDefault();
      e.stopPropagation();
    });
    ta.addEventListener('keyup', stop);
    ta.addEventListener('keypress', stop);
    ta.addEventListener('beforeinput', (e) => {
      const t = e.inputType;
      if (t === 'insertFromPaste' || t === 'insertFromDrop' || t === 'insertFromYank' ||
          t === 'insertLineBreak' || t === 'insertParagraph' || t === 'historyUndo' || t === 'historyRedo' ||
          t === 'deleteContentForward' || t === 'deleteByCut') {
        e.preventDefault();
      }
    });
    ta.addEventListener('paste', (e) => e.preventDefault());
    ta.addEventListener('drop', (e) => e.preventDefault());
    ta.addEventListener('compositionstart', () => { composing = true; });
    ta.addEventListener('compositionend', () => { composing = false; emit(); });
    ta.addEventListener('input', (e) => { if (!e.isComposing && !composing) emit(); caretEnd(); });
    ta.addEventListener('select', caretEnd);
    ta.addEventListener('focus', () => {
      layer.classList.add('ytyaz-focused');
      caretEnd();
      handlers.onFocus && handlers.onFocus(true);
    });
    ta.addEventListener('blur', () => {
      composing = false;
      layer.classList.remove('ytyaz-focused');
      handlers.onFocus && handlers.onFocus(false);
    });

    player.append(layer, result.root);

    ac = new AbortController();
    document.addEventListener('keydown', onDocKey, { capture: true, signal: ac.signal });

    applySettings();
    return true;
  }

  function unmount() {
    if (ac) { ac.abort(); ac = null; }
    if (ui) { ui.layer.remove(); ui.result.root.remove(); ui = null; }
    spans = []; curStates = null; curIdx = -1; composing = false;
    cache.dks = cache.acc = cache.mode = '';
  }

  function onDocKey(e) {
    const a = document.activeElement;
    if (ui && a && a !== ui.ta && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    if (!ui || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.getModifierState && e.getModifierState('AltGraph')) return;
    let h = null;
    if (e.code === 'KeyS') h = () => handlers.onResult && handlers.onResult();
    else if (e.code === 'KeyR') h = () => handlers.onReload && handlers.onReload();
    if (!h) return;
    e.preventDefault();
    e.stopPropagation();
    h();
  }

  // ---------- ayarlar paneli ----------
  function buildPanel() {
    const root = el('div', 'ytyaz-panel');
    const groups = {};
    function row(label, key, opts) {
      const r = el('div', 'ytyaz-row');
      r.append(el('span', null, label));
      groups[key] = [];
      for (const [val, txt] of opts) {
        const b = el('button', 'ytyaz-opt', txt);
        b.type = 'button';
        b.addEventListener('click', () => setSetting(key, val));
        b.dataset.val = val;
        groups[key].push(b);
        r.append(b);
      }
      root.append(r);
    }
    row('Yazı boyutu', 'size', [['s', 'Küçük'], ['m', 'Orta'], ['l', 'Büyük']]);
    row('Konum', 'pos', [['bottom', 'Alt'], ['mid', 'Orta'], ['top', 'Üst']]);
    row('YouTube altyazısını gizle', 'hide', [['1', 'Evet'], ['0', 'Hayır']]);
    root.append(el('div', 'ytyaz-keys', 'Alt+Y yaz/bırak · Alt+S sonuç · Alt+R altyazıyı yenile'));
    return { root, groups };
  }

  function setSetting(key, val) {
    if (key === 'hide') { settings.hide = val === '1'; lsSet('hideNative', val); }
    else { settings[key] = val; lsSet(key, val); }
    applySettings();
  }

  function applySettings() {
    if (ui) {
      ui.layer.dataset.size = settings.size;
      ui.layer.dataset.pos = settings.pos;
      const cur = { size: settings.size, pos: settings.pos, hide: settings.hide ? '1' : '0' };
      for (const k of Object.keys(ui.panel.groups)) {
        for (const b of ui.panel.groups[k]) b.dataset.on = b.dataset.val === cur[k] ? '1' : '0';
      }
    }
    try { Y.transcript && Y.transcript.hideNativeCaptions && Y.transcript.hideNativeCaptions(settings.hide); } catch (e) { /* yok say */ }
  }

  // ---------- sonuç kartı ----------
  function buildResult() {
    const root = el('div', 'ytyaz-result ytyaz-hidden');
    const close = el('button', 'ytyaz-close', 'Kapat');
    close.type = 'button';
    close.addEventListener('click', hideResult);
    const h = el('h3', null, 'Sonuç');
    const grid = el('div', 'ytyaz-grid');
    const cells = {};
    for (const [k, label] of [['dks', 'DKS'], ['acc', 'Doğruluk'], ['time', 'Süre'], ['keys', 'Tuş']]) {
      const c = el('div');
      cells[k] = el('b', null, '-');
      c.append(cells[k], el('small', null, label));
      grid.append(c);
    }
    const miss = el('div', 'ytyaz-miss');
    const hTitle = el('div', 'ytyaz-miss', 'Son oturumlar');
    const hist = el('ul', 'ytyaz-hist');
    root.append(close, h, grid, miss, hTitle, hist);
    return { root, h, cells, miss, hist };
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function showResult(st, history, title) {
    if (!ui) return;
    const r = ui.result;
    r.h.textContent = title ? 'Sonuç — ' + title : 'Sonuç';
    r.cells.dks.textContent = String(Math.round(st.dks));
    r.cells.acc.textContent = '%' + Math.round(st.accuracy);
    r.cells.time.textContent = fmtTime(st.activeMs / 1000);
    r.cells.keys.textContent = String(st.total);
    const names = (ch) => (ch === ' ' ? 'boşluk' : ch);
    r.miss.textContent = st.topMisses.length
      ? 'En çok yanlış yapılan harfler: ' + st.topMisses.map((m) => names(m.ch) + ' (' + m.n + ')').join(', ')
      : 'Hiç yanlış yok.';
    r.hist.replaceChildren();
    const list = history || [];
    if (!list.length) r.hist.append(el('li', null, 'Henüz kayıt yok.'));
    for (const h of list.slice().reverse()) {
      const d = new Date(h.ts);
      const when = d.toLocaleDateString('tr') + ' ' + d.toLocaleTimeString('tr', { hour: '2-digit', minute: '2-digit' });
      r.hist.append(el('li', null, when + ' · ' + (h.title || h.vid || '') + ' · ' + h.dks + ' DKS · %' + h.acc));
    }
    r.root.classList.remove('ytyaz-hidden');
  }
  function hideResult() { if (ui) ui.result.root.classList.add('ytyaz-hidden'); }
  function isResultOpen() { return !!ui && !ui.result.root.classList.contains('ytyaz-hidden'); }

  function getHistory() {
    try { const a = JSON.parse(lsGet('history', '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function pushHistory(rec) {
    const a = getHistory();
    a.push(rec);
    lsSet('history', JSON.stringify(a.slice(-HIST_MAX)));
  }

  // ---------- satır ----------
  // Span'ler ÖZGÜN karakterlerden kurulur. map[o] >= 0: yazılacak karakter (hedef indeksi);
  // map[o] < 0: atlanan (noktalama, kesme, fazladan boşluk) — soluk, imleç durmaz, öncesi yazılınca 'geçildi'.
  let lineMap = null, lineT2o = null, prevT = null;

  function paint(o) {
    const sp = spans[o];
    if (!sp) return;
    const t = lineMap[o];
    if (t >= 0) {
      const s = curStates ? curStates[t] : 0;
      sp.className = (s === 1 ? 'o' : s === 2 ? 'x' : 't') + (o === curIdx ? ' c' : '');
    } else {
      const p = prevT[o];
      sp.className = (p < 0 || (curStates && curStates[p] !== 0)) ? 'k p' : 'k';
    }
  }
  // Bir yazılabilir karakter ve ardındaki atlananlar (onun durumuna bağlılar).
  function paintRun(o) {
    paint(o);
    for (let x = o + 1; x < spans.length && lineMap[x] < 0; x++) paint(x);
  }

  // Satır değişince bir kez kurulur. cue: engine'in {orig, map, t2o} alanlı cue'su.
  function setLine(cue, nextText) {
    if (!ui) return;
    ui.msg.textContent = '';
    ui.msg.style.display = 'none';
    ui.line.style.display = '';
    ui.line.classList.remove('ytyaz-done');
    const frag = document.createDocumentFragment();
    const n = cue.orig.length;
    lineMap = cue.map;
    lineT2o = cue.t2o;
    spans = new Array(n);
    curStates = new Uint8Array(cue.target.length);
    curIdx = lineT2o.length ? lineT2o[0] : -1;
    prevT = new Int32Array(n);
    let prev = -1;
    for (let o = 0; o < n; o++) { prevT[o] = prev; if (lineMap[o] >= 0) prev = lineMap[o]; }
    for (let o = 0; o < n; o++) {
      const sp = document.createElement('span');
      sp.textContent = cue.orig[o];
      spans[o] = sp;
      frag.append(sp);
    }
    ui.line.replaceChildren(frag);
    for (let o = 0; o < n; o++) paint(o);
    ui.next.textContent = nextText || '';
    ui.next.style.display = '';
  }

  // Tuş başına yalnızca değişen hedef karakterlerin span'leri (ve ardındaki atlananlar) güncellenir.
  function updateLine(changed, states, caret) {
    if (!ui || !lineMap) return;
    curStates = states;
    const old = curIdx;
    curIdx = caret < lineT2o.length ? lineT2o[caret] : -1;
    for (let k = 0; k < changed.length; k++) paintRun(lineT2o[changed[k]]);
    if (old !== curIdx) { if (old >= 0) paint(old); if (curIdx >= 0) paint(curIdx); }
  }

  function setDone(b) { if (ui) ui.line.classList.toggle('ytyaz-done', !!b); }

  function setMessage(text) {
    if (!ui) return;
    spans = []; curStates = null; curIdx = -1; lineMap = null;
    ui.line.replaceChildren();
    ui.line.style.display = 'none';
    ui.next.textContent = '';
    ui.next.style.display = 'none';
    ui.msg.style.display = '';
    ui.msg.textContent = text;
  }

  function setStats(dks, acc) {
    if (!ui) return;
    const a = 'DKS ' + Math.round(dks), b = '%' + Math.round(acc);
    if (a !== cache.dks) { cache.dks = a; ui.sDks.textContent = a; }
    if (b !== cache.acc) { cache.acc = b; ui.sAcc.textContent = b; }
  }
  function setMode(text) {
    if (!ui || text === cache.mode) return;
    cache.mode = text;
    ui.sMode.textContent = text;
    ui.sMode.style.display = text ? '' : 'none';
  }

  // ---------- girdi ----------
  function emit() { if (ui && handlers.onInput) handlers.onInput(ui.ta.value); }
  function caretEnd() { if (ui) { const n = ui.ta.value.length; try { ui.ta.setSelectionRange(n, n); } catch (e) { /* yok say */ } } }
  function setInputValue(v) {
    if (!ui || composing) return;
    if (ui.ta.value !== v) { ui.ta.value = v; caretEnd(); }
  }
  function clearInput() { setInputValue(''); }
  function focusInput() { if (ui) ui.ta.focus({ preventScroll: true }); }
  function blurInput() { if (ui) ui.ta.blur(); }
  function isFocused() { return !!ui && document.activeElement === ui.ta; }

  function setHidden(b) {
    if (!ui) return;
    ui.layer.classList.toggle('ytyaz-hidden', !!b);
    if (b) { blurInput(); hideResult(); }
  }

  Y.overlay = {
    mount, unmount, setHandlers(h) { handlers = h || {}; },
    setMessage, setLine, updateLine, setDone, setStats, setMode,
    setInputValue, clearInput, focusInput, blurInput, isFocused,
    setHidden, showResult, hideResult, isResultOpen,
    getHistory, pushHistory, applySettings,
  };
})();
