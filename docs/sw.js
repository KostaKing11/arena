/* Service worker — omogućava "Instaliraj aplikaciju" i rad kad signal zabaguje.
   Mreža prvo za naše fajlove (nikad se ne igra sa starim kodom),
   keš prvo za CDN biblioteke. Baza, prijava i pločice mape se NE keširaju.
   Kad menjaš kod, podigni VERSION. */

const VERSION = 'arena-v4';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE = [
  './', 'index.html', 'manifest.json',
  'css/tokens.css', 'css/base.css', 'css/components.css', 'css/screens.css', 'css/game.css',
  'js/firebase-config.js',
  'js/core/util.js', 'js/core/rules.js', 'js/core/i18n.js', 'js/core/icons.js', 'js/core/haptics.js',
  'js/net/clock.js', 'js/net/store.js',
  'js/ui/kit.js', 'js/ui/nav.js', 'js/ui/sensors.js', 'js/ui/map.js', 'js/ui/screens.js',
  'js/game/engine.js', 'js/game/items.js', 'js/game/combat.js', 'js/game/encounter.js',
  'js/game/mentor.js', 'js/game/bots.js',
  'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

const NEVER = [
  'firebasedatabase.app', 'firebaseio.com',
  'identitytoolkit.googleapis.com', 'securetoken.googleapis.com',
  'basemaps.cartocdn.com', 'arcgisonline.com', 'tile.openstreetmap.org',
  'storage.googleapis.com',          // model za detekciju osoba je prevelik za keš
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE))
    .then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (NEVER.some((h) => url.hostname.includes(h))) return;

  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html');
      return Response.error();
    })));
    return;
  }

  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
