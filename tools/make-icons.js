'use strict';
/* Pravi PNG ikone za PWA iz koda — bez ijedne biblioteke.
   Chrome ne prihvata SVG ikone za "Instaliraj", traži PNG 192 i 512.

   Pokretanje:  npm run icons                                                */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'docs', 'icons');
const BG = [0x0d, 0x0b, 0x10];        // skoro crna, kao pozadina app-a
const GOLD = [0xff, 0xb0, 0x3a];      // žar

/* ───────────────────────── crtanje ─────────────────────────
   Sve u normalizovanim koordinatama 0..1, pa se uzorkuje 3x3 po pikselu
   radi mekih ivica. Oblici su definisani preko rastojanja — nema potrebe
   za pravim rasterizatorom.                                               */

const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

// rastojanje tačke do duži
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// tačke petokrake (10 temena, naizmenično spolja/unutra)
function starPoints(cx, cy, rOut, rIn, scale) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = (i % 2 === 0 ? rOut : rIn) * scale;
    p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return p;
}

function makeShader(scale) {
  const cx = 0.5, cy = 0.5;
  const ringR = 0.39 * scale, ringW = 0.026 * scale;
  const star = starPoints(cx, cy, 0.335, 0.145, scale);
  const starW = 0.034 * scale;
  // "ptica": presek dva kruga daje oblik sočiva (širina ~0.32, visina ~0.15)
  const lensR = 0.208 * scale, lensA = 0.133 * scale;

  return function (x, y) {
    // prsten
    if (Math.abs(dist(x, y, cx, cy) - ringR) <= ringW / 2) return 1;
    // sočivo (puno)
    if (dist(x, y, cx, cy - lensA) <= lensR && dist(x, y, cx, cy + lensA) <= lensR) return 1;
    // obris zvezde
    for (let i = 0; i < star.length; i++) {
      const a = star[i], b = star[(i + 1) % star.length];
      if (distSeg(x, y, a[0], a[1], b[0], b[1]) <= starW / 2) return 1;
    }
    return 0;
  };
}

function renderRGBA(size, scale) {
  const shade = makeShader(scale);
  const SS = 3, inv = 1 / (SS * SS);
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let cov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          cov += shade(x, y);
        }
      }
      cov *= inv;
      // Kvantizacija na 16 nivoa: skoro se ne vidi, a PNG se duplo bolje pakuje.
      cov = Math.round(cov * 16) / 16;
      const o = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) buf[o + c] = Math.round(BG[c] + (GOLD[c] - BG[c]) * cov);
      buf[o + 3] = 255;
    }
  }
  return buf;
}

/* ───────────────────────── PNG zapis ───────────────────────── */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(rgba, size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;                       // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ───────────────────────── izlaz ───────────────────────── */
fs.mkdirSync(OUT, { recursive: true });
const jobs = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.72],  // sadržaj unutar središnjih 80%, za okrugle maske
  ['apple-touch-icon.png', 180, 1],
];
for (const [name, size, scale] of jobs) {
  const png = encodePNG(renderRGBA(size, scale), size);
  fs.writeFileSync(path.join(OUT, name), png);
  console.log(`  ${name.padEnd(24)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
console.log('\nIkone su u docs/icons/');
