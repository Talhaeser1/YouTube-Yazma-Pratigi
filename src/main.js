/* YTYaz.main — video senkronu ve yapıştırıcı kod. */
(function () {
  'use strict';
  const Y = (window.YTYaz = window.YTYaz || {});
  if (Y.main) return;

  const PAD = 0.15; // satır sonundan sonra tanınan pay (sn)
  const noop = () => {};
  let ctl = null;

  function videoId() {
    try { return new URL(location.href).searchParams.get('v') || ''; } catch (e) { return ''; }
  }
  function pageTitle() {
    return document.title.replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*YouTube$/, '');
  }

  function createController(vid, autoFocus) {
    const ac = new AbortController();
    const sig = ac.signal;
    const st = {
      vid, session: null, video: null, player: null,
      lineDone: false, ahead: false, weStopped: false,
      saved: false, ad: false, rvfc: 0,
      focused: false, finished: false, extra: '', title: '', titleSet: false, data: null, pending: '',
    };
    let poll = 0, obs = null;
    const ov = () => Y.overlay;

    // ---------- yardımcılar ----------
    function updateStats() {
      if (!st.session) return;
      const q = st.session.quick();
      ov().setStats(q.dks, q.accuracy);
    }
    function updateMode() {
      let m = '';
      if (!st.focused) m = '';
      else if (st.weStopped) m = 'video bekliyor…';
      else if (st.lineDone && st.ahead) m = 'videoyu bekle…';
      else if (st.video && st.video.paused) m = 'duraklatıldı';
      ov().setMode(m);
    }
    function renderLine() {
      const s = st.session;
      if (s.finished) {
        ov().setMessage('Altyazı bitti — sonuç için Alt+S');
      } else {
        const nx = s.cues[s.index + 1];
        ov().setLine(s.cue, nx ? nx.orig.join('') : '');
      }
      ov().clearInput();
      updateStats();
      updateMode();
    }
    function resumeIfWeStopped() {
      if (st.weStopped) {
        st.weStopped = false;
        if (st.video && st.video.paused) { const p = st.video.play(); if (p && p.catch) p.catch(noop); }
      }
    }
    function saveHistory() {
      const s = st.session;
      if (st.saved || !s) return;
      const x = s.stats();
      if (x.total < 5) return;
      st.saved = true;
      ov().pushHistory({
        ts: Date.now(), vid, title: (st.title || '').slice(0, 80),
        dks: Math.round(x.dks), acc: Math.round(x.accuracy), secs: Math.round(x.activeMs / 1000),
      });
    }
    function showResult() {
      if (!st.session) return;
      ov().showResult(st.session.stats(), ov().getHistory(), (st.title || '').slice(0, 50));
    }

    // ---------- ilerleme ----------
    function resync() {
      const s = st.session;
      if (!s) return;
      s.seekTime(st.video.currentTime);
      st.lineDone = false;
      st.ahead = false;
      st.finished = false;
      st.extra = '';
      resumeIfWeStopped();
      renderLine();
    }

    // Odak yokken katman video zamanındaki cue'yu gösterir.
    function passiveSync() {
      const s = st.session;
      if (!s) return;
      if (s.indexAt(st.video.currentTime) !== s.index || st.lineDone) {
        s.seekTime(st.video.currentTime);
        st.lineDone = false; st.ahead = false; st.extra = '';
        renderLine();
      }
    }
    function onFocus(f) {
      st.focused = f;
      if (!st.session) return;
      if (f) resync();
      else { resumeIfWeStopped(); st.extra = ''; passiveSync(); updateMode(); }
    }

    function finish() {
      if (st.finished) return;
      st.finished = true;
      st.lineDone = false;
      resumeIfWeStopped();
      st.ahead = false;
      saveHistory();
      showResult();
      updateMode();
    }

    // Satır bittiyse bir sonrakine geç; video en fazla bir cue gerideyse ilerlemeye izin ver.
    function tryAdvance() {
      if (!st.lineDone) return;
      const s = st.session;
      if (s.index >= s.count - 1) { finish(); return; }
      const limit = s.indexAt(st.video.currentTime) + 1;
      if (s.index + 1 <= limit) {
        s.advance();
        st.lineDone = false;
        st.ahead = false;
        renderLine();
        resumeIfWeStopped();
        updateMode();
        if (st.extra) { const x = st.extra; st.extra = ''; ov().setInputValue(x); onInput(x); }
      } else if (!st.ahead) {
        st.ahead = true;
        updateMode();
      }
    }

    function tick() {
      const s = st.session, v = st.video;
      if (!s || st.ad || v.seeking || s.finished || st.finished) return;
      if (!st.focused) { passiveSync(); return; }
      if (st.lineDone) { tryAdvance(); return; }
      const cue = s.cue;
      if (cue && !v.paused && v.currentTime >= cue.end + PAD) {
        st.weStopped = true;
        s.idle();
        v.pause();
        updateMode();
      }
    }

    function onInput(raw) {
      const s = st.session;
      // Altyazı henüz yüklenmedi: basılan tuşları sakla, begin() satır gelince uygular (yoksa ilk tuşlar kayboluyordu).
      if (!s) { if (st.focused && !st.ad) st.pending = raw; return; }
      if (st.ad || s.finished || st.finished || !st.focused) return;
      if (st.lineDone) {
        // Satır bitti ama video geride: sonraki satır için tuşları tamponla.
        const c = s.clean(raw);
        if (c.startsWith(s.typed)) st.extra = c.slice(s.typed.length).replace(/^ /, '');
        else ov().setInputValue(s.typed);
        return;
      }
      if (!st.titleSet) { st.title = pageTitle(); st.titleSet = true; }
      const r = s.setTyped(raw);
      ov().setInputValue(s.typed);
      if (r.changed.length) ov().updateLine(r.changed, s.states, s.typed.length);
      updateStats();
      if (r.done) {
        st.lineDone = true;
        ov().setDone(true);
        tryAdvance();
      }
    }

    // ---------- kare döngüsü (yalnızca video oynarken) ----------
    function startFrames() {
      const v = st.video;
      if (!v.requestVideoFrameCallback || st.rvfc) return;
      const cb = () => {
        st.rvfc = 0;
        if (sig.aborted) return;
        tick();
        if (!v.paused) st.rvfc = v.requestVideoFrameCallback(cb);
      };
      st.rvfc = v.requestVideoFrameCallback(cb);
    }
    function stopFrames() {
      if (st.rvfc && st.video.cancelVideoFrameCallback) st.video.cancelVideoFrameCallback(st.rvfc);
      st.rvfc = 0;
    }

    function checkAd() {
      const ad = st.player.classList.contains('ad-showing');
      if (ad === st.ad) return;
      st.ad = ad;
      ov().setHidden(ad);
      if (!ad && st.session) { resync(); setTimeout(() => { if (!sig.aborted && !st.ad && st.session) resync(); }, 300); }
    }

    // ---------- başlatma ----------
    function begin(data) {
      const s = Y.engine.createSession(data && data.cues, data && data.lang);
      if (!s.count) { ov().setMessage('Bu videoda altyazı yok'); return; }
      st.data = data;
      st.session = s;
      st.saved = false;
      resync();
      const p = st.pending;
      st.pending = '';
      if (p && st.focused) { ov().setInputValue(p); onInput(p); }
      if (!st.video.paused) startFrames();
    }

    function load() {
      ov().setMessage('altyazı yükleniyor…');
      Promise.resolve()
        .then(() => Y.transcript.load())
        .then((data) => { if (!sig.aborted) begin(data); })
        .catch((err) => {
          if (sig.aborted) return;
          ov().setMessage(err && err.code === 'NO_CAPTIONS'
            ? 'Bu videoda altyazı yok'
            : 'Altyazı alınamadı — tekrar dene (Alt+R)');
        });
    }

    function init(player, video) {
      st.player = player;
      st.video = video;
      st.title = pageTitle();
      ov().mount(player);
      ov().setHandlers({
        onInput, onFocus,
        onResult() {
          if (ov().isResultOpen()) ov().hideResult(); else showResult();
        },
        onReload() { reload(); },
        onClose() { disable(); },
      });
      if (autoFocus) ov().focusInput();
      // Alt+R'de yazma alanı zaten odaktadır ve yeniden focus olayı üretmez; durumu doğrudan oku
      // (yoksa yeni oturum odakta olmadığını sanıp hiçbir tuşu işlemiyordu).
      st.focused = !!ov().isFocused();
      ov().setStats(0, 100);
      ov().setMode('');

      const on = (t, f) => video.addEventListener(t, f, { signal: sig });
      on('timeupdate', tick);
      on('play', () => {
        // Biz durdurmuşken kullanıcı Play'e bastıysa: bu satırı geç.
        if (st.weStopped && st.session) { st.weStopped = false; resync(); }
        startFrames(); updateMode();
      });
      on('playing', startFrames);
      on('pause', () => { stopFrames(); if (st.session) st.session.idle(); updateMode(); });
      on('seeking', () => { if (st.session) st.session.idle(); });
      on('seeked', () => {
        if (!st.session || st.ad) return;
        // Önceki deneme kaydedildiyse (bitiş/video sonu) geri sarınca yeni oturum başlar; yoksa hiç kaydedilmezdi.
        if (st.saved) begin(st.data); else resync();
      });
      on('ended', () => {
        // Reklam da aynı video öğesinde oynar; reklamın bitişi oturumu bitirmesin.
        if (st.ad || player.classList.contains('ad-showing')) return;
        if (st.session && !st.finished && st.session.stats().total) { saveHistory(); showResult(); }
      });
      // Sekme kapanınca / sayfa yenilenince de oturum geçmişe yazılsın.
      window.addEventListener('pagehide', saveHistory, { signal: sig });

      obs = new MutationObserver(checkAd);
      obs.observe(player, { attributes: true, attributeFilter: ['class'] });
      checkAd();
      load();
    }

    // resume: biz durdurduysak video devam etsin (kapatma/yenileme); gezinmede istenmez.
    function destroy(resume) {
      ac.abort();
      clearInterval(poll);
      if (obs) obs.disconnect();
      stopFrames();
      saveHistory();
      if (resume && st.weStopped && st.video && st.video.paused) {
        const p = st.video.play();
        if (p && p.catch) p.catch(noop);
      }
      st.weStopped = false;
    }

    // Oynatıcı + video hazır olana kadar kısa süre bekle (kendini kapatır).
    function find() {
      const p = document.getElementById('movie_player');
      const v = p && p.querySelector('video.html5-main-video');
      if (!p || !v) return false;
      clearInterval(poll);
      init(p, v);
      return true;
    }
    if (!find()) {
      let tries = 0;
      poll = setInterval(() => {
        if (sig.aborted || ++tries > 80) { clearInterval(poll); return; }
        find();
      }, 250);
    }

    return { vid, destroy };
  }

  // ---------- aç / kapa ----------
  // Varsayılan KAPALI: kapalıyken yalnızca belge keydown'u ve kontrol çubuğundaki düğme var.
  let enabled = false;

  function stop(resume) {
    if (!ctl) return;
    const c = ctl;
    ctl = null;
    c.destroy(resume);
  }
  function hideNative(h) {
    try { Y.transcript && Y.transcript.hideNativeCaptions && Y.transcript.hideNativeCaptions(h); } catch (e) { /* yok say */ }
  }
  function typingElsewhere() {
    const a = document.activeElement;
    if (!a || (a.classList && a.classList.contains('ytyaz-input'))) return false;
    return !!(a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }

  function setButton(on) {
    const b = document.querySelector('.ytyaz-toggle');
    if (b) b.dataset.on = on ? '1' : '0';
  }
  function removeButton() {
    const b = document.querySelector('.ytyaz-toggle');
    if (b) b.remove();
  }
  // Düğme yoksa (YouTube çubuğu yeniden kurmuş olabilir) ekler; bulunamazsa sessizce atlar.
  function ensureButton() {
    if (location.pathname !== '/watch') { removeButton(); return; }
    const host = document.querySelector('.ytp-right-controls');
    if (!host) return;
    let b = document.querySelector('.ytyaz-toggle');
    if (b && b.parentNode === host) return;
    if (b) b.remove();
    b = document.createElement('button');
    b.className = 'ytp-button ytyaz-toggle';
    b.type = 'button';
    b.textContent = 'Yaz';
    b.title = 'Yazma pratiği (Alt+Y)';
    b.setAttribute('aria-label', 'Yazma pratiği');
    b.dataset.on = enabled ? '1' : '0';
    b.addEventListener('click', (e) => { e.stopPropagation(); toggle(); b.blur(); });
    host.prepend(b);
  }

  function enable() {
    if (location.pathname !== '/watch' || !Y.overlay || !Y.engine) return;
    stop(false);
    enabled = true;
    ensureButton();
    ctl = createController(videoId(), true);
    setButton(true);
  }
  function disable() {
    const was = enabled;
    enabled = false;
    stop(true);
    if (Y.overlay) Y.overlay.unmount();
    if (was) hideNative(false);
    setButton(false);
  }
  function toggle() { if (enabled) disable(); else enable(); }
  function reload() {
    if (!enabled) return;
    stop(true);
    ctl = createController(videoId(), true);
  }

  // Yeni videoya geçince yeniden KAPALI başlar (aynı videoda ayrıntı değişimi katmanı kapatmaz).
  function onNav() {
    if (location.pathname !== '/watch') { if (enabled) disable(); removeButton(); return; }
    if (enabled && ctl && ctl.vid === videoId()) { ensureButton(); return; }
    if (enabled) {
      enabled = false;
      stop(false);
      if (Y.overlay) Y.overlay.unmount();
      hideNative(false);
    }
    ensureButton();
    setButton(false);
  }

  // Gezinme başlar başlamaz kapat: yt-navigate-finish birkaç saniye gecikebiliyor ve o arada eski
  // oturum (aynı <video> öğesi üzerinden) YENİ videoyu eski cue sonlarında durdurabiliyordu (canlı test).
  function onNavStart(e) {
    if (!enabled) return;
    const url = e && e.detail && e.detail.url;
    if (!url) return;
    let next = '';
    try { const u = new URL(url, location.href); next = u.pathname === '/watch' ? (u.searchParams.get('v') || '') : ''; } catch (err) { return; }
    if (ctl && next === ctl.vid) return; // aynı video: dokunma
    enabled = false;
    stop(false);
    if (Y.overlay) Y.overlay.unmount();
    hideNative(false);
    setButton(false);
  }

  Y.main = { toggle, enable, disable, isEnabled: () => enabled };

  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.code !== 'KeyY') return;
    if (e.getModifierState && e.getModifierState('AltGraph')) return;
    if (location.pathname !== '/watch' || typingElsewhere()) return;
    e.preventDefault();
    e.stopPropagation();
    toggle();
  }, true);
  document.addEventListener('yt-navigate-start', onNavStart);
  document.addEventListener('yt-navigate-finish', onNav);
  document.addEventListener('yt-page-data-updated', ensureButton);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureButton, { once: true });
    window.addEventListener('load', ensureButton, { once: true });
  } else ensureButton();
})();
