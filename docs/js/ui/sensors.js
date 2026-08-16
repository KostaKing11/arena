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

  /* Android UOPŠTE ne javlja tačnost kompasa — provereno na uređaju: stiže
     `deviceorientationabsolute` sa `absolute: true`, ali `webkitCompassAccuracy`
     ne postoji. Zato se pouzdanost NE sme izvoditi iz izmišljenog broja, nego iz
     dve stvarne činjenice: da li dobijamo apsolutni smer, i da li se smer menja
     kad korisnik okrene telefon (to je ono što "osmica" zapravo proverava). */
  let sawAbsolute = false, sawAnyEvent = false;
  const seen = new Set();          // koje osmine kruga smo videli
  let span = 0;

  function handle(e) {
    let h = null, acc = null;
    sawAnyEvent = true;
    if (typeof e.webkitCompassHeading === 'number') {           // iOS daje pravi sever
      h = e.webkitCompassHeading;
      const a = e.webkitCompassAccuracy;
      acc = (typeof a === 'number' && a >= 0) ? a : null;       // -1 znači nekalibrisan
      sawAbsolute = true;
    } else if (e.alpha != null) {
      // Bez `absolute` alpha je u odnosu na proizvoljan početni položaj, ne na
      // sever — takvo očitavanje sme da se koristi samo ako pravog nema.
      if (!e.absolute && sawAbsolute) return;
      if (e.absolute) sawAbsolute = true;
      h = (360 - e.alpha) % 360;
      acc = null;                                              // Android ne javlja tačnost
    }
    if (h == null || isNaN(h)) return;
    samples.push(h);
    while (samples.length > 5) samples.shift();
    // prosek preko jediničnog kruga, da 359° i 1° ne daju 180°
    let x = 0, y = 0;
    samples.forEach((a) => { x += Math.cos(U.toRad(a)); y += Math.sin(U.toRad(a)); });
    heading = (U.toDeg(Math.atan2(y, x)) + 360) % 360;
    accuracy = acc;
    seen.add(Math.floor(heading / 45) % 8);
    span = Math.round((seen.size / 8) * 100);
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
    get accuracy() { return accuracy; },          // null = uređaj je ne javlja (Android)
    get available() { return heading != null; },
    get absolute() { return sawAbsolute; },
    get sawAnyEvent() { return sawAnyEvent; },
    /** Koliko je korisnik obišao krug, 0–100. Ovo je prava "osmica". */
    get span() { return span; },
    /** Sme li se kompas koristiti za konus pri slikanju. */
    get usable() {
      if (heading == null) return false;
      if (accuracy != null) return accuracy < 25;   // iOS javlja pravu tačnost
      return sawAbsolute;                            // Android: apsolutni smer je dovoljan
    },
    resetSpan() { seen.clear(); span = 0; },
  };
})();

/* ───────────────────────── ekran da ne zaspi (§21) ───────────────────────── */
/* Ekran ne sme da se gasi dok partija traje: telefon je u ruci, na ulici, i
   svako gašenje znači promašen napad ili propušteno upozorenje o zoni.

   Zaključavanje se GUBI svaki put kad korisnik prebaci aplikaciju, pa se mora
   tražiti iznova pri povratku — ali samo ako je i dalje potrebno. Zato `wanted`:
   bez njega bi se zaključavanje uzimalo i kad se vratiš na početni ekran.

   `supported` je za stariji iOS koji API nema — tamo se igraču jednom kaže da
   ekran mora sam da drži budnim. Nijedna greška ne sme da obori aplikaciju. */
const Wake = (() => {
  let lock = null, wanted = false;
  const supported = 'wakeLock' in navigator;

  async function on() {
    wanted = true;
    if (!supported || lock || document.visibilityState !== 'visible') return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch { lock = null; }
  }
  function off() {
    wanted = false;
    try { if (lock) lock.release(); } catch {}
    lock = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted && !lock) on();
  });
  return { on, off, get active() { return !!lock; }, get supported() { return supported; } };
})();

/* ───────────────────────── hodanje tapom (samo test) ─────────────────────────
   Sa botovima se sedi za stolom, pa GPS ne mrda i partija stoji u mestu.
   Ovde tap po mapi postaje šetnja: ideš ka tački ljudskim tempom (1,4 m/s),
   pa zona, glad, predmeti i napadi botova rade tačno kao napolju. Pravi GPS
   se time gasi (`Geo.simulate`), što u testu i jeste poenta. */
const TestWalk = (() => {
  'use strict';
  const SPEED_MS = 1.4;
  const TICK_MS = 200;
  let timer = null, target = null, cur = null;

  function enable() {
    if (timer) return;
    timer = setInterval(step, TICK_MS);
  }
  function disable() { clearInterval(timer); timer = null; target = null; }

  function goTo(p) {
    if (!p) return;
    if (!cur) cur = Geo.pos ? { lat: Geo.pos.lat, lng: Geo.pos.lng } : { lat: p.lat, lng: p.lng };
    target = { lat: p.lat, lng: p.lng };
    enable();
    Haptics.fire('tap');
  }

  function step() {
    if (!target) return;
    if (!cur) { cur = Geo.pos ? { lat: Geo.pos.lat, lng: Geo.pos.lng } : { ...target }; }
    const left = U.dist(cur, target);
    const stepM = SPEED_MS * (TICK_MS / 1000);
    if (left <= stepM) { cur = { ...target }; target = null; }
    else cur = U.destPoint(cur, U.bearing(cur, target), stepM);
    Geo.simulate(cur.lat, cur.lng);
  }

  return { enable, disable, goTo, get walking() { return !!target; } };
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
