/* Vibracija je deo dizajna, ne ukras — svaki obrazac znači nešto određeno,
   pa igrač zna šta se desilo i pre nego što pogleda u ekran. */
const Haptics = (() => {
  const can = () => 'vibrate' in navigator;
  let enabled = localStorage.getItem('arena.haptics') !== '0';

  const PATTERNS = {
    tap: 10,
    itemNear: [12, 60, 12],            // predmet u blizini — dva laka kucanja
    pickup: [20, 40, 60],              // uzeo si
    zoneWarn: [90, 70, 90, 70, 160],   // zona se skuplja — dugo i preteće
    outsideZone: [200, 120, 200],
    cannon: [400, 160, 260],           // top — najduži obrazac u igri
    hit: 80,                           // pogodio si
    hurt: [140, 50, 140],              // pogođen si
    incoming: [300, 80, 300, 80, 300], // strelac te gađa — MRDAJ
    round: 25,
    win: [60, 60, 60, 60, 200],
    death: [500, 200, 500],
    alert: [60, 40, 60],
  };

  function fire(name) {
    if (!enabled || !can()) return;
    const p = PATTERNS[name];
    if (!p) return;
    try { navigator.vibrate(p); } catch { /* neki browseri ovo blokiraju */ }
  }
  function stop() { if (can()) { try { navigator.vibrate(0); } catch {} } }
  function setEnabled(v) { enabled = !!v; localStorage.setItem('arena.haptics', v ? '1' : '0'); if (!v) stop(); }

  return { fire, stop, setEnabled, get enabled() { return enabled; }, can, PATTERNS };
})();

/* Zvuk bez ijednog fajla — WebAudio. Top, gong, zujanje, škljocaj. */
const Sfx = (() => {
  let ctx = null, unlocked = false;
  let enabled = localStorage.getItem('arena.sfx') !== '0';
  const ac = () => ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());

  function unlock() {
    try { const c = ac(); if (c.state === 'suspended') c.resume(); unlocked = true; } catch {}
  }
  function tone(f0, f1, dur, type, gain, delay) {
    if (!enabled || !unlocked) return;
    try {
      const c = ac(), t0 = c.currentTime + (delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.25, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch {}
  }
  function noise(dur, gain, delay) {
    if (!enabled || !unlocked) return;
    try {
      const c = ac(), t0 = c.currentTime + (delay || 0);
      const n = c.sampleRate * dur;
      const buf = c.createBuffer(1, n, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource(); s.buffer = buf;
      const g = c.createGain(); g.gain.value = gain || 0.2;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      s.connect(f); f.connect(g); g.connect(c.destination);
      s.start(t0);
    } catch {}
  }

  return {
    unlock, setEnabled(v) { enabled = !!v; localStorage.setItem('arena.sfx', v ? '1' : '0'); },
    get enabled() { return enabled; },
    cannon() { tone(90, 22, 1.6, 'sawtooth', 0.5); tone(55, 18, 2.0, 'sine', 0.55); noise(0.7, 0.3); },
    gong()   { tone(300, 130, 2.2, 'triangle', 0.3); tone(600, 280, 1.6, 'sine', 0.14); },
    anthem() { [392, 494, 587, 784].forEach((f, i) => tone(f, f, 0.9, 'triangle', 0.16, i * 0.5)); },
    pickup() { tone(760, 1250, 0.14, 'sine', 0.2); },
    hit()    { tone(200, 70, 0.18, 'square', 0.24); noise(0.12, 0.16); },
    hurt()   { tone(150, 60, 0.3, 'sawtooth', 0.3); },
    tick()   { tone(1100, 1100, 0.04, 'sine', 0.12); },
    warn()   { tone(500, 700, 0.22, 'square', 0.16); tone(500, 700, 0.22, 'square', 0.16, 0.3); },
    zap()    { tone(1400, 300, 0.25, 'sawtooth', 0.2); },
    /* Otvaranje ranca: kratak šum sa uzlaznim filtrom — rajsferšlus. Sitnica,
       ali od nje inventar prestane da bude spisak i postane torba. */
    bag()    { noise(0.22, 0.13); tone(240, 520, 0.2, 'sawtooth', 0.05); },
  };
})();
