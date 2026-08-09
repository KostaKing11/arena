'use strict';
/* Provera da su Firebase config, pravila i anonimna prijava stvarno ispravni —
   pokreće se protiv PRAVOG projekta, ne emulatora. Napravi jednu test sobu,
   odigra par poteza i obriše je za sobom.

   Pokretanje:  node test/verify-live.js                                     */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const D = (p) => path.join(__dirname, '..', 'docs', 'js', p);
const CFG_SRC = fs.readFileSync(D('firebase-config.js'), 'utf8');

let failures = 0;
const check = (n, c, e) => {
  if (c) console.log(`  OK   ${n}`);
  else { failures++; console.log(`  FAIL ${n}${e ? '  -> ' + e : ''}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 15000, step = 300) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(step); }
  return null;
}

const realFb = require('firebase/compat/app');
require('firebase/compat/auth');
require('firebase/compat/database');
let appN = 0;

function makeClient(label) {
  const store = new Map();
  const fb = {
    _app: null,
    initializeApp(cfg) { this._app = realFb.initializeApp(cfg, `${label}-${++appN}`); return this._app; },
    database() { return realFb.database(this._app); },
    auth() { return realFb.auth(this._app); },
  };
  fb.database.ServerValue = realFb.database.ServerValue;
  const sandbox = {
    console: { log: () => {}, error: (...a) => console.error(`[${label}]`, ...a), warn: () => {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, URLSearchParams, Promise, Object, Array, String, Number, Error,
    firebase: fb,
    location: { search: '', hostname: 'localhost', protocol: 'https:', host: 'localhost' },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k), clear: () => store.clear(),
    },
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(CFG_SRC, ctx, { filename: 'firebase-config.js' });
  for (const f of ['engine/rules.js', 'bots.js', 'net-firebase.js']) {
    vm.runInContext(fs.readFileSync(D(f), 'utf8'), ctx, { filename: f });
  }
  return { run: (c) => vm.runInContext(c, ctx) };
}

(async () => {
  console.log('\nProvera protiv projekta:', /projectId:\s*"([^"]+)"/.exec(CFG_SRC)[1], '\n');

  console.log('1. Config fajl');
  // gledamo samo kod, bez komentara — inace i objasnjenje u komentaru izgleda kao poziv
  const CODE = CFG_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check('nema `import` (srusio bi <script>)', !/^\s*import\s/m.test(CODE));
  check('nema poziva initializeApp (radi ga net-firebase.js)', !/initializeApp\s*\(/.test(CODE));
  check('objekat se zove FIREBASE_CONFIG', /const\s+FIREBASE_CONFIG\s*=/.test(CODE));
  for (const k of ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId']) {
    check(`popunjen ${k}`, new RegExp(`${k}:\\s*"(?!PASTE_ME)[^"]+"`).test(CFG_SRC));
  }
  check('databaseURL pokazuje na Realtime Database',
    /databaseURL:\s*"https:\/\/[^"]*firebasedatabase\.app"/.test(CFG_SRC));

  console.log('\n2. Veza, prijava i pravila');
  const A = makeClient('A'), B = makeClient('B');
  for (const P of [A, B]) {
    P.run(`globalThis.__st=null; globalThis.__ev=[];
      Net.on('state', s => globalThis.__st = s);
      ['error','nocfg','eliminated','challenge'].forEach(t => Net.on(t, m => globalThis.__ev.push([t,m])));
      Net.connect();`);
  }
  const st = (P) => P.run('globalThis.__st');
  const ev = (P) => P.run('globalThis.__ev');
  const send = (P, m) => P.run(`Net.send(${JSON.stringify(m)})`);

  await until(() => A.run('Net.ready') && B.run('Net.ready'));
  check('anonimna prijava radi (Authentication je ukljucen)', A.run('Net.ready') && B.run('Net.ready'));
  check('config je prepoznat', !ev(A).some((e) => e[0] === 'nocfg'));

  send(A, { t: 'create', name: 'PROVERA' });
  const sA = await until(() => (st(A) && st(A).code ? st(A) : null));
  check('pisanje u bazu prolazi kroz pravila', !!sA, JSON.stringify(ev(A).filter((e) => e[0] === 'error')));
  if (!sA) { console.log('\nStani — pravila blokiraju pisanje. Nalepi firebase-rules.json u Rules.\n'); process.exit(1); }
  const code = sA.code;
  console.log(`     (test soba: ${code})`);

  send(B, { t: 'join', code, name: 'DRUGI' });
  await until(() => st(B) && st(B).code === code);
  check('drugi uredjaj vidi istu sobu', !!st(B) && st(B).code === code);
  await until(() => st(A).roster.length === 2);
  check('sinhronizacija u realnom vremenu radi', st(A).roster.length === 2);

  console.log('\n3. Kratka partija');
  const center = { lat: 44.8125, lng: 20.4612 };
  send(A, { t: 'setArena', center, radius: 200, lootMode: 'cornucopia', lootCount: 20, deploySec: 20 });
  await until(() => st(B).arena && st(B).arena.radius === 200);
  check('postavka arene stize do svih', !!st(B).arena);
  send(A, { t: 'addBots', count: 1 });
  await until(() => st(A).roster.length === 3);
  check('botovi rade', st(A).roster.filter((r) => r.isBot).length === 1);

  send(A, { t: 'start' });
  await until(() => st(A).phase === 'deploy' && st(B).phase === 'deploy');
  check('partija krece kod oba uredjaja', st(A).phase === 'deploy' && st(B).phase === 'deploy');
  check('svako dobija svoju startnu poziciju',
    !!st(A).you.spawn && !!st(B).you.spawn &&
    JSON.stringify(st(A).you.spawn) !== JSON.stringify(st(B).you.spawn));

  for (let i = 0; i < 12; i++) { send(A, { t: 'pos', lat: center.lat, lng: center.lng }); await sleep(200); }
  await until(() => st(A).you.spawn);
  check('pozicija se upisuje', !!(await until(async () => {
    const p = A.run('Net._room()').players[st(A).you.id];
    return p && typeof p.lat === 'number';
  })));

  await until(() => st(A).phase === 'active', 26000);
  check('posle odbrojavanja partija je aktivna', st(A).phase === 'active', st(A).phase);
  await until(() => st(A).loot.length > 0);
  check('plen se pojavljuje na mapi', st(A).loot.length > 0, String(st(A).loot.length));
  check('oba uredjaja racunaju isti svet',
    !!st(B).arena && st(A).arena.radius === st(B).arena.radius &&
    A.run('Net._room()').seed === B.run('Net._room()').seed);

  console.log('\n4. Ciscenje');
  await A.run(`Net._ref('').remove()`);
  await sleep(1500);
  const gone = await until(async () => {
    const r = A.run('Net._room()');
    return r === null;
  }, 6000);
  check('test soba je obrisana', !!gone);

  for (const P of [A, B]) P.run('Net.hardClose()');
  console.log(failures ? `\n${failures} provera palo\n` : '\nSve provere prosle — Firebase je ispravno podesen\n');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('\nPUKLO:', e); process.exit(1); });
