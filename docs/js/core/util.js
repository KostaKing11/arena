/* ═══════════════════════════════════════════════════════════════════════════
   UTIL — determinstički slučaj, geografija, sitnice.
   Radi i u browseru (window.U) i u Node-u (require) — testovi koriste isti fajl.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.U = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ───────────────────────── slučaj ───────────────────────── */
  function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rngFor = (...parts) => mulberry32(hash32(parts.join('|')));
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // Bira po težinama: {kljuc: broj} -> kljuc
  function weighted(rng, weights) {
    const keys = Object.keys(weights);
    let total = 0;
    for (const k of keys) total += weights[k];
    let r = rng() * total;
    for (const k of keys) { if (r < weights[k]) return k; r -= weights[k]; }
    return keys[keys.length - 1];
  }

  /* ───────────────────────── geografija ───────────────────────── */
  const R_E = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  function dist(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return Infinity;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R_E * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function bearing(a, b) {
    const la1 = toRad(a.lat), la2 = toRad(b.lat), dLng = toRad(b.lng - a.lng);
    const y = Math.sin(dLng) * Math.cos(la2);
    const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
  function destPoint(p, brg, d) {
    const dr = d / R_E, b = toRad(brg), la1 = toRad(p.lat), lo1 = toRad(p.lng);
    const la2 = Math.asin(Math.sin(la1) * Math.cos(dr) + Math.cos(la1) * Math.sin(dr) * Math.cos(b));
    const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(dr) * Math.cos(la1),
      Math.cos(dr) - Math.sin(la1) * Math.sin(la2));
    return { lat: toDeg(la2), lng: ((toDeg(lo2) + 540) % 360) - 180 };
  }
  function pointInCircle(rng, center, maxR, minR) {
    minR = minR || 0;
    const r = Math.sqrt(rng() * (maxR * maxR - minR * minR) + minR * minR);
    return destPoint(center, rng() * 360, r);
  }
  // Najmanja razlika dva azimuta, u opsegu -180..180
  function angleDiff(a, b) {
    let d = ((b - a) % 360 + 540) % 360 - 180;
    return d;
  }
  // Tačka na duži koja je najbliža datoj tački — za "zid vatre"
  function distToLine(p, a, b) {
    const ax = 0, ay = 0;
    const bx = dist(a, { lat: a.lat, lng: b.lng }) * (b.lng > a.lng ? 1 : -1);
    const by = dist(a, { lat: b.lat, lng: a.lng }) * (b.lat > a.lat ? 1 : -1);
    const px = dist(a, { lat: a.lat, lng: p.lng }) * (p.lng > a.lng ? 1 : -1);
    const py = dist(a, { lat: p.lat, lng: a.lng }) * (p.lat > a.lat ? 1 : -1);
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /* Ravnomerno raspoređene tačke uz minimalno rastojanje (odbijanje uzoraka). */
  function scatter(rng, center, maxR, minR, count, minGap, existing) {
    const out = [];
    const all = (existing || []).slice();
    let guard = 0;
    while (out.length < count && guard++ < count * 60) {
      const p = pointInCircle(rng, center, maxR, minR);
      let ok = true;
      for (const q of all) { if (dist(p, q) < minGap) { ok = false; break; } }
      if (!ok) continue;
      out.push(p); all.push(p);
    }
    // Ako prostor ne dozvoljava, popuni ostatak bez uslova nego da fali predmeta
    while (out.length < count) out.push(pointInCircle(rng, center, maxR, minR));
    return out;
  }

  /* ───────────────────────── sitnice ───────────────────────── */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function lerpPoint(a, b, t) { return { lat: lerp(a.lat, b.lat, t), lng: lerp(a.lng, b.lng, t) }; }
  const uid = (p) => (p || 'x') + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function hhmmss(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600);
    return h > 0 ? `${h}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}` : mmss(sec);
  }
  const CODE_A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const roomCode = () => Array.from({ length: 5 }, () => CODE_A[Math.floor(Math.random() * CODE_A.length)]).join('');

  // Prosek poslednjih N GPS očitavanja, uz odbacivanje netačnih (§21)
  function smoothPos(samples) {
    const good = samples.filter((s) => s && s.accM != null && s.accM <= 30).slice(-3);
    if (!good.length) return null;
    let lat = 0, lng = 0, acc = 0;
    for (const s of good) { lat += s.lat; lng += s.lng; acc += s.accM; }
    return { lat: lat / good.length, lng: lng / good.length, accM: acc / good.length };
  }

  return {
    hash32, mulberry32, rngFor, pick, shuffle, weighted,
    R_E, toRad, toDeg, dist, bearing, destPoint, pointInCircle, angleDiff, distToLine, scatter,
    clamp, lerp, lerpPoint, uid, mmss, hhmmss, roomCode, smoothPos,
  };
});
