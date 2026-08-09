/* Service worker — potreban da bi Chrome ponudio "Instaliraj aplikaciju",
   a usput drži app upotrebljivim i kad signal zabaguje na terenu.

   Strategija je namerno "mreža prvo" za naše fajlove: partija se ne sme
   igrati sa starim kodom, pa keš služi samo kao mreža za pad. CDN biblioteke
   i ikone idu "keš prvo" jer se ne menjaju.

   Kad menjaš kod, podigni VERSION — stari keš se tada obriše. */

const VERSION = 'arena-v1';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/engine/rules.js',
  'js/bots.js',
  'js/i18n.js',
  'js/firebase-config.js',
  'js/net-firebase.js',
  'js/mapview.js',
  'js/challenges.js',
  'js/app.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

// Nikada ne keširati: baza, prijava i pločice mape.
// Baza mora da bude živa, a pločice bi za par partija pojele stotine megabajta.
const NEVER = [
  'firebasedatabase.app',
  'firebaseio.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'basemaps.cartocdn.com',
  'arcgisonline.com',
  'tile.openstreetmap.org',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // jedan fajl koji fali ne sme da obori instalaciju
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (NEVER.some((h) => url.hostname.includes(h))) return;

  // Naši fajlovi: mreža prvo, keš kao rezerva.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => {
          if (hit) return hit;
          // Na index.html se vraćamo samo za otvaranje stranice — inače bi
          // neki .js fajl dobio HTML kao odgovor i sve bi puklo.
          if (req.mode === 'navigate') return caches.match('index.html');
          return Response.error();
        }))
    );
    return;
  }

  // CDN (Leaflet, Firebase SDK, fontovi): keš prvo, osvežavanje u pozadini.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
