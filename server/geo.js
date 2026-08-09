'use strict';
// Geo helpers. Sve koordinate su { lat, lng }, sve distance u metrima.

const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

function haversine(a, b) {
  if (!a || !b) return Infinity;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearing(a, b) {
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x =
    Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Tacka na `dist` metara od `p` u smeru `brg` stepeni.
function destPoint(p, brg, dist) {
  const d = dist / R;
  const b = toRad(brg);
  const la1 = toRad(p.lat);
  const lo1 = toRad(p.lng);
  const la2 = Math.asin(
    Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b)
  );
  const lo2 =
    lo1 +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(la1),
      Math.cos(d) - Math.sin(la1) * Math.sin(la2)
    );
  return { lat: toDeg(la2), lng: ((toDeg(lo2) + 540) % 360) - 180 };
}

// Ravnomerno raspodeljena random tacka u prstenu [minR, maxR].
function randomPointInCircle(center, maxR, minR = 0) {
  const u = Math.random();
  const r = Math.sqrt(u * (maxR ** 2 - minR ** 2) + minR ** 2);
  return destPoint(center, Math.random() * 360, r);
}

// 8 smerova, za "kompas" prikaz kad ne znas tacnu poziciju.
const COMPASS = ['S', 'SI', 'I', 'JI', 'J', 'JZ', 'Z', 'SZ'];
function compass(brg) {
  return COMPASS[Math.round(brg / 45) % 8];
}

module.exports = { haversine, bearing, destPoint, randomPointInCircle, compass, toRad, toDeg };
