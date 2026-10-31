addEventListener('load', () => {
  if (!gl) { hint.textContent = 'WebGL2 is not available in this browser'; return; }
  { const sw = softwareGL(), saved = lsGet('quality'); quality = QUAL[Q.get('quality')] ? Q.get('quality') : QUAL[saved] ? saved : sw || MOBILE ? 'low' : 'high'; markQ(); if (sw && !saved) $('qnote').textContent = 'No graphics card detected: Low quality selected for you'; }
  try { initGL(); } catch (e) { hint.textContent = 'Shader error: ' + e.message; console.log(e.message); return; }
  resize();
  homeReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  initHomeGL($('home-c'));
  loadHomeLogo(document.querySelector('#home-art img').src, () => { if (!playing && !liveOn && !document.body.classList.contains('still')) startHomeLoop(); });
  const IMGQ = Q.get('img'), onReady = async () => {
    ready = true; $('playgen').disabled = false; $('surprise').disabled = false; $('playlast').disabled = false; updateHint(); drawProfile(); renderImgs();
    // shared level from ?u= (applied before start so manual entry is honored)
    if (window.__sharedLevel != null) { try { setLevel(window.__sharedLevel, false, true, true); } catch (e) {} window.__sharedLevel = null; }
    const lq = Q.get('local'), localReady = lq ? loadLocal(lq) : null;   // test hook: ?local=<url of an audio file> (+ &t=… for a silent still, otherwise it plays)
    if (lq && Q.get('t') === null) { await localReady; startLocal(); }
    const dbg = Q.get('t');
    if (dbg !== null && STILL) {   // silent still: step the feedback loop up to the requested time
      homeGate(false); document.body.classList.add('still'); const T = parseFloat(dbg); let t = 0; if (lq) { await localReady; if (localData) { LOC = localData; LIVE = newLive(); TOTAL = LOC.dur; setArc('journey'); } } newSeed(); if (!LOC) { try { buildAudio(new OfflineAudioContext(2, 1, 44100), 0, 0); if (Q.has('debug')) console.log('EVT', MUSIC, JSON.stringify(EVT)); } catch (e) { console.warn('section plan', e); } } rotA = 0; bi = 0; const step = parseFloat(Q.get('step')) || .2;
      const fr = x => { if (LOC) localView(x); render(x, step, LOC ? LIVE.bn : 0, LOC ? LIVE.mn : 0, LOC ? LIVE.hn : 0); };
      if (Q.has('debug')) { PLOG = window.__plog = []; PLOG.nx = 0; }
      for (; t < T; t += step) fr(t); fr(T);
    }
    else if ((IMGQ || Q.has('u')) && !lq) autoStart();
    if (IMGFAIL) toast('Image could not be loaded or the host does not allow CORS', 8000);
  };
  const sharedImgs = window.__sharedImgs;
  if (sharedImgs && sharedImgs.length) {
    loadSharedImages(sharedImgs, window.__sharedImTo || 0, onReady);
    window.__sharedImgs = null;
  } else if (IMGQ) loadPoster(IMGQ, onReady, () => { IMGFAIL = true; loadPoster(GALLERY[0].src, onReady); });
  else loadPoster(GALLERY[0].src, onReady);   // default picture = the 1943 poster (the logo is only the home screen)
});
// ?img=<url>: no start screen; Journey curve (unless ?arc=), play at once; if the browser keeps audio suspended, show a tap pill
function autoStart() {
  if (!Q.get('arc')) { arcName = 'journey'; applyArc(); drawProfile(); }
  start();
  const tParam = Q.get('t'); if (tParam !== null && playing) { try { seekTo(parseFloat(tParam)); } catch (e) {} }
  if (!playing) return;
  setTimeout(() => {    if (!playing || !ac || ac.state === 'running') return;
    SUSP = performance.now() - lastT * 1000;   // keep the picture moving; the tap restarts the sound at the current picture time
    const pill = $('tap'); pill.hidden = false;
    const go = () => {
      removeEventListener('pointerdown', go, true); removeEventListener('keydown', go, true); pill.hidden = true;
      if (!playing || SUSP === null) return; const off = lastT; SUSP = null; begin(off, false);
    };
    addEventListener('pointerdown', go, true); addEventListener('keydown', go, true);
  }, 400);
}
