'use strict';
/* Integracioni test Firebase sloja (docs/js/net-firebase.js) protiv pravog
   Realtime Database emulatora. Svaki "igrač" dobija svoj izolovan JS kontekst,
   isto kao da je zaseban telefon.

   Pokretanje:
     1) npm run emu        (u jednom prozoru)
     2) npm run test:fb    (u drugom)                                        */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const NS = 'demo-arena-default-rtdb';
const DB_REST = 'http://127.0.0.1:9000';
const D = (p) => path.join(__dirname, '..', 'docs', 'js', p);

let failures = 0;
const check = (name, cond, extra) => {
  if (cond) console.log(`  OK   ${name}`);
  else { failures++; console.log(`  FAIL ${name}${extra ? '  -> ' + extra : ''}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000, step = 250) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(step); }
  return null;
}

/* --- most ka pravom firebase paketu, sa zasebnom app instancom po igraču --- */
const realFb = require('firebase/compat/app');
require('firebase/compat/auth');
require('firebase/compat/database');
let appN = 0;

function makePlayerContext(label) {
  const store = new Map();
  const fbFacade = {
    _app: null,
    initializeApp(cfg) { this._app = realFb.initializeApp(cfg, `${label}-${++appN}`); return this._app; },
    database() { return realFb.database(this._app); },
    auth() { return realFb.auth(this._app); },
  };
  fbFacade.database.ServerValue = realFb.database.ServerValue;

  const sandbox = {
    console: { log: () => {}, error: (...a) => console.error(`[${label}]`, ...a), warn: () => {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, URLSearchParams, Promise, Object, Array, String, Number, Error,
    firebase: fbFacade,
    location: { search: '?emu=1', hostname: '127.0.0.1', protocol: 'http:', host: '127.0.0.1:3000' },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['engine/rules.js', 'bots.js', 'net-firebase.js']) {
    vm.runInContext(fs.readFileSync(D(f), 'utf8'), ctx, { filename: f });
  }
  return { label, ctx, run: (c) => vm.runInContext(c, ctx) };
}

/* --- REST ka emulatoru; token "owner" je administratorski, zaobilazi pravila --- */
const ADMIN = { Authorization: 'Bearer owner' };
const rest = async (p) => {
  const r = await fetch(`${DB_REST}/${p}.json?ns=${NS}`, { headers: ADMIN });
  return r.status === 200 ? r.json() : null;
};
const restPut = async (p, val) => {
  const r = await fetch(`${DB_REST}/${p}.json?ns=${NS}`,
    { method: 'PUT', headers: ADMIN, body: JSON.stringify(val) });
  if (!r.ok) throw new Error(`REST PUT ${p} -> ${r.status} ${await r.text()}`);
  return r;
};

/* ============================== TEST ============================== */
(async () => {
  try { await fetch(`${DB_REST}/.json?ns=${NS}`); }
  catch {
    console.error('\n  Emulator nije pokrenut. U drugom prozoru:  npm run emu\n');
    process.exit(2);
  }
  await restPut('rooms', null);

  const A = makePlayerContext('A');
  const B = makePlayerContext('B');
  for (const P of [A, B]) {
    P.run(`
      globalThis.__st = null; globalThis.__ev = [];
      Net.on('state', (s) => { globalThis.__st = s; });
      ['error','challenge','lootResult','eliminated','gift','proposal','nocfg']
        .forEach((t) => Net.on(t, (m) => globalThis.__ev.push([t, m])));
      Net.connect();
    `);
  }
  const st = (P) => P.run('globalThis.__st');
  const ev = (P) => P.run('globalThis.__ev');
  const send = (P, m) => P.run(`Net.send(${JSON.stringify(m)})`);

  let code = null;
  // Slanje pozicije je prigušeno na 1,4 s -- ponavljaj dok baza stvarno ne primi.
  const setPos = async (P, lat, lng) => {
    for (let i = 0; i < 20; i++) {
      send(P, { t: 'pos', lat, lng });
      const ok = await until(async () => {
        const p = await rest(`rooms/${code}/players/${st(P).you.id}`);
        return p && Math.abs(p.lat - lat) < 1e-9 && Math.abs(p.lng - lng) < 1e-9;
      }, 1200, 200);
      if (ok) return true;
    }
    return false;
  };

  console.log('\n1. Povezivanje i pravljenje sobe');
  await until(() => A.run('Net.ready') && B.run('Net.ready'));
  check('oba klijenta se povezala na bazu', A.run('Net.ready') && B.run('Net.ready'));
  check('nema grekse o nedostajucem configu', !ev(A).some((e) => e[0] === 'nocfg'));

  send(A, { t: 'create', name: 'KOSTA' });
  const sA = await until(() => (st(A) && st(A).code ? st(A) : null));
  check('domacin je napravio sobu', !!sA && sA.code.length === 5, sA && sA.code);
  check('domacin je oznacen kao host', !!sA && sA.isHost);
  code = sA.code;

  send(B, { t: 'join', code, name: 'MILAN' });
  const sB = await until(() => (st(B) && st(B).code === code ? st(B) : null));
  check('drugi igrac je usao u istu sobu', !!sB && !sB.isHost);
  await until(() => st(A).roster.length === 2);
  check('domacin vidi oba igraca', st(A).roster.length === 2,
    st(A).roster.map((r) => r.name).join(','));

  console.log('\n2. Postavka arene i botovi');
  const center = { lat: 44.8125, lng: 20.4612 };
  send(A, { t: 'setArena', center, radius: 200, lootMode: 'cornucopia', lootCount: 20, deploySec: 20, shrink: true });
  await until(() => st(A).arena && st(A).arena.radius === 200);
  check('arena je upisana', !!st(A).arena && st(A).arena.radius === 200);
  check('gost odmah vidi istu arenu', !!(await until(() => st(B).arena && st(B).arena.radius === 200)));

  send(A, { t: 'addBots', count: 2 });
  await until(() => st(A).roster.length === 4);
  check('botovi su dodati', st(A).roster.filter((r) => r.isBot).length === 2);

  console.log('\n3. Start partije i determinizam');
  send(A, { t: 'start' });
  await until(() => st(A).phase === 'deploy');
  check('faza je raspored', st(A).phase === 'deploy', st(A).phase);
  check('svako je dobio SVOJU startnu poziciju',
    !!st(A).you.spawn && !!(await until(() => st(B).you.spawn)) &&
    JSON.stringify(st(A).you.spawn) !== JSON.stringify(st(B).you.spawn));

  await restPut(`rooms/${code}/startedAt`, Date.now() - 25000);   // preskoci odbrojavanje
  await until(() => st(A).phase === 'active' && st(B).phase === 'active');
  check('posle odbrojavanja partija je aktivna', st(A).phase === 'active',
    `A=${st(A).phase} B=${st(B).phase}`);

  // Oba na ISTU tacku -- tek tada je posteno porediti sta vide (vid je krug oko igraca).
  await setPos(A, center.lat, center.lng);
  await setPos(B, center.lat, center.lng);
  await until(() => st(A).loot.length > 0 && st(B).loot.length > 0);
  const lootA = st(A).loot, lootB = st(B).loot;
  check('oba telefona vide plen', lootA.length > 0 && lootB.length > 0);
  check('sa istog mesta oba telefona vide ISTI plen (deterministicki svet)',
    JSON.stringify(lootA.map((l) => [l.id, l.rarity, Math.round(l.lat * 1e6)]).sort()) ===
    JSON.stringify(lootB.map((l) => [l.id, l.rarity, Math.round(l.lat * 1e6)]).sort()),
    `A=${lootA.length} B=${lootB.length}`);

  console.log('\n4. Uzimanje predmeta i trka za isti sanduk');
  const target = lootA.find((l) => l.inReach) || lootA[0];
  await setPos(A, target.lat, target.lng);
  await setPos(B, target.lat, target.lng);
  await until(() => (st(A).loot.find((l) => l.id === target.id) || {}).inReach &&
                    (st(B).loot.find((l) => l.id === target.id) || {}).inReach);

  send(A, { t: 'lootTry', lootId: target.id });
  send(B, { t: 'lootTry', lootId: target.id });
  await sleep(2000);
  const chA = ev(A).filter((e) => e[0] === 'challenge').length;
  const chB = ev(B).filter((e) => e[0] === 'challenge').length;
  check('samo JEDAN igrac dobija izazov za isti sanduk', chA + chB === 1, `A=${chA} B=${chB}`);
  const winnerP = chA ? A : B;
  const chEv = ev(winnerP).find((e) => e[0] === 'challenge')[1];
  check('izazov ima tip i tezinu',
    ['tap', 'slider', 'sequence', 'hold'].includes(chEv.challenge) && chEv.difficulty >= 1);

  send(winnerP, { t: 'lootDone', lootId: target.id, success: true });
  await until(() => st(winnerP).you.items.length > 0);
  check('predmet je zavrsio u inventaru', st(winnerP).you.items.length === 1,
    JSON.stringify(st(winnerP).you.items));
  await until(() => !st(A).loot.some((l) => l.id === target.id) &&
                    !st(B).loot.some((l) => l.id === target.id));
  check('predmet je nestao sa mape kod OBA igraca',
    !st(A).loot.some((l) => l.id === target.id) && !st(B).loot.some((l) => l.id === target.id));

  console.log('\n5. Vidljivost igraca');
  const cA = st(A).contacts.find((c) => c.band === 'engage');
  check('na 15 m se vidi ime protivnika', !!cA && cA.name === 'MILAN', JSON.stringify(st(A).contacts));
  await setPos(B, target.lat + 0.0005, target.lng);   // ~55 m
  await until(() => st(A).contacts.some((c) => c.band === 'near'));
  check('na 55 m se vidi samo blip bez imena', (() => {
    const c = st(A).contacts.find((x) => x.band === 'near');
    return !!c && !c.name && !c.id && typeof c.brg === 'number';
  })(), JSON.stringify(st(A).contacts));

  console.log('\n6. Borba izmedju dva prava igraca');
  await setPos(B, target.lat + 0.00003, target.lng);
  await until(() => st(A).contacts.find((c) => c.band === 'engage'));
  send(A, { t: 'engage', targetId: st(B).you.id });
  const cbA = await until(() => st(A).combat);
  const cbB = await until(() => st(B).combat);
  check('borba je otvorena kod napadaca', !!cbA && cbA.round === 1);
  check('borba je otvorena i kod napadnutog', !!cbB && cbB.foe.name === 'KOSTA');
  check('obojica krecu sa punim zivotom', !!cbA && cbA.you.hp === 100 && cbA.foe.hp === 100,
    cbA && `${cbA.you.hp}/${cbA.foe.hp}`);
  check('app dobija tacku susreta uzivo', !!cbA && !!cbA.meetPoint);

  // A: blok, B: napad  ->  blok pobedjuje napad, B trpi stetu
  send(A, { t: 'combatMove', move: 'block' });
  send(B, { t: 'combatMove', move: 'attack' });
  const r2 = await until(() => (st(A).combat && st(A).combat.round === 2 ? st(A).combat : null));
  check('runda je presudjena tacno jednom', !!r2 && r2.log.length === 1,
    r2 && JSON.stringify(r2.log.length));
  check('blok pobedjuje napad', !!r2 && r2.you.hp === 100 && r2.foe.hp < 100,
    r2 && `A=${r2.you.hp} B=${r2.foe.hp}`);
  await until(() => st(B).combat && st(B).combat.round === 2);
  check('oba telefona vide isti ishod', !!st(B).combat && st(B).combat.you.hp === r2.foe.hp,
    st(B).combat && `${st(B).combat.you.hp} vs ${r2.foe.hp}`);

  for (let i = 0; i < 14; i++) {
    if (st(A).combat && st(A).combat.over) break;
    send(A, { t: 'combatMove', move: 'block' });
    send(B, { t: 'combatMove', move: 'attack' });
    await sleep(900);
  }
  check('borba se zavrsila', !!(await until(() => st(A).combat && st(A).combat.over, 15000)));
  const endCb = st(A).combat;
  check('porazeni je eliminisan', !!(await until(() => ev(B).some((e) => e[0] === 'eliminated'), 8000)));
  await until(() => { const m = st(A).roster.find((r) => r.name === 'MILAN'); return m && !m.alive; });
  check('oba telefona vide da je MILAN ispao',
    !st(A).roster.find((r) => r.name === 'MILAN').alive &&
    !st(B).roster.find((r) => r.name === 'MILAN').alive);
  check('pobednik ima eliminaciju', st(A).you.kills === 1, String(st(A).you.kills));
  // Ko savrseno blokira, izadje bez ogrebotine -- bitno je da se zivot PRENOSI iz borbe.
  check('pobednik nosi zivot iz borbe dalje', st(A).you.hp === Math.max(1, endCb.you.hp),
    `${st(A).you.hp} vs ${endCb.you.hp}`);
  check('porazeni je na nuli', st(B).you.hp === 0, String(st(B).you.hp));
  check('porazeni dobija mesto na tabeli', st(B).you.place > 0, String(st(B).you.place));

  console.log('\n7. Eliminisani gleda dalje');
  await until(() => st(B).contacts.some((c) => c.band === 'spy'));
  check('eliminisani vidi pozicije svih prezivelih',
    st(B).contacts.some((c) => c.band === 'spy' && typeof c.lat === 'number'),
    JSON.stringify(st(B).contacts.map((c) => c.band)));
  check('eliminisani vidi sav plen na mapi', st(B).loot.length >= st(A).loot.length,
    `${st(B).loot.length} vs ${st(A).loot.length}`);

  console.log('\n8. Objave');
  const feed = st(A).feed.map((f) => f.sr);
  check('objave sadrze gong', feed.some((f) => f.includes('GONG')), feed.join(' | ').slice(0, 120));
  check('objave sadrze eliminaciju', feed.some((f) => f.includes('MILAN') && f.includes('\u{1F480}')));
  check('objave su hronoloske', st(A).feed.every((f, i, a) => i === 0 || a[i - 1].ts <= f.ts));

  for (const P of [A, B]) P.run('Net.hardClose()');
  await restPut('rooms', null);
  console.log(failures ? `\n${failures} provera palo\n` : '\nSve provere prosle\n');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('\nPUKLO:', e); process.exit(1); });
