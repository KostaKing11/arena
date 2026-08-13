/* ═══════════════════════════════════════════════════════════════════════════
   SENZORI — GPS, kompas, wake lock.

   GPS (§21): watchPosition sa visokom tačnošću, odbaci sve preko 30 m,
   proseči poslednja 3 očitavanja, u bazu upisuj najviše jednom na 3 s
   i ređe kad igrač stoji.
   ═══════════════════════════════════════════════════════════════════════════ */
const Geo = (() => {
  let watchId = null;
  const samples = [];
  let cur = null, lastWriteMs = 0, lastWritePos = null, walked = 0, lastMovePos = null;
  const listeners = [];
  let simulated = false;

  function start() {
    if (watchId != null || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(
      (p) => {
        if (simulated) return;
        push({ lat: p.coords.latitude, lng: p.coords.longitude, accM: p.coords.accuracy });
      },
      (err) => listeners.forEach((f) => f(null, err)),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    );
  }
  function stop() { if (watchId != null) navigator.geolocation.clearWatch(watchId); watchId = null; }

  function push(s) {
    samples.push(s);
    while (samples.length > 6) samples.shift();
    const sm = U.smoothPos(samples);
    if (!sm) { listeners.forEach((f) => f(null, { weak: true, accM: s.accM })); return; }
    if (lastMovePos) walked += U.dist(lastMovePos, sm);
    lastMovePos = sm;
    cur = sm;
    listeners.forEach((f) => f(cur));
  }
  /** Ručno postavljanje pozicije — koristi test režim i botovi. */
  function simulate(lat, lng) {
    simulated = true;
    samples.length = 0;
    push({ lat, lng, accM: 5 });
  }

  /** Da li treba pisati u bazu? Ređe kad stojiš (§21). */
  function shouldWrite(nowMs) {
    if (!cur) return false;
    const moved = lastWritePos ? U.dist(lastWritePos, cur) : Infinity;
    const gap = moved > 5 ? 3000 : 12000;
    return nowMs - lastWriteMs >= gap;
  }
  function markWritten(nowMs) { lastWriteMs = nowMs; lastWritePos = cur; }

  return {
    start, stop, simulate, push, shouldWrite, markWritten,
    on(f) { listeners.push(f); },
    get pos() { return cur; },
    get accuracy() { return cur ? cur.accM : null; },
    get walkedM() { return walked; },
    get isSimulated() { return simulated; },
    resetWalked() { walked = 0; },
  };
})();

/* ───────────────────────── kompas ───────────────────────── */
const Compass = (() => {
  let heading = null, accuracy = null, running = false;
  const listeners = [];
  const samples = [];

  function handle(e) {
    let h = null, acc = null;
    if (typeof e.webkitCompassHeading === 'number') {           // iOS daje pravi sever
      h = e.webkitCompassHeading;
      acc = e.webkitCompassAccuracy != null ? Math.abs(e.webkitCompassAccuracy) : 15;
    } else if (e.alpha != null) {
      h = (360 - e.alpha) % 360;                                 // Android: alpha je suprotan smer
      acc = e.absolute ? 20 : 35;
    }
    if (h == null || isNaN(h)) return;
    samples.push(h);
    while (samples.length > 5) samples.shift();
    // prosek preko jediničnog kruga, da 359° i 1° ne daju 180°
    let x = 0, y = 0;
    samples.forEach((a) => { x += Math.cos(U.toRad(a)); y += Math.sin(U.toRad(a)); });
    heading = (U.toDeg(Math.atan2(y, x)) + 360) % 360;
    accuracy = acc;
    listeners.forEach((f) => f(heading, accuracy));
  }

  async function request() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();      // iOS traži izričitu dozvolu
        if (r !== 'granted') return false;
      }
    } catch { return false; }
    start();
    return true;
  }
  function start() {
    if (running) return;
    running = true;
    window.addEventListener('deviceorientationabsolute', handle, true);
    window.addEventListener('deviceorientation', handle, true);
  }
  function stop() {
    running = false;
    window.removeEventListener('deviceorientationabsolute', handle, true);
    window.removeEventListener('deviceorientation', handle, true);
  }
  return {
    request, start, stop,
    on(f) { listeners.push(f); },
    get heading() { return heading; },
    get accuracy() { return accuracy; },
    get available() { return heading != null; },
  };
})();

/* ───────────────────────── ekran da ne zaspi (§21) ───────────────────────── */
const Wake = (() => {
  let lock = null;
  async function on() {
    try { if ('wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch {}
  }
  function off() { try { if (lock) lock.release(); } catch {} lock = null; }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && lock === null) on(); });
  return { on, off, get active() { return !!lock; } };
})();

/* ───────────────────────── akcelerometar (protresi telefon) ───────────────────────── */
const Shake = (() => {
  let last = 0, count = 0, cb = null, running = false;
  function handle(e) {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    const now = Date.now();
    if (mag > 22 && now - last > 320) { last = now; count++; if (cb) cb(count); }
  }
  return {
    async start(onShake) {
      count = 0; cb = onShake;
      try {
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
          const r = await DeviceMotionEvent.requestPermission();
          if (r !== 'granted') return false;
        }
      } catch { return false; }
      if (!running) { window.addEventListener('devicemotion', handle); running = true; }
      return true;
    },
    stop() { window.removeEventListener('devicemotion', handle); running = false; cb = null; },
    get count() { return count; },
  };
})();
