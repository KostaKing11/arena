'use strict';
/* Provera pravila iz docs/js/core/rules.js — istog fajla koji rade telefoni.
   Bez mreže, bez browsera.   npm test                                       */

const U = require('../docs/js/core/util.js');
const R = require('../docs/js/core/rules.js');

let fail = 0;
const ok = (n, c, e) => { if (c) console.log(`  OK   ${n}`); else { fail++; console.log(`  FAIL ${n}${e ? '  -> ' + e : ''}`); } };
const cfg = {
  center: { lat: 44.8125, lng: 20.4612 }, diameterM: 500, durationMin: 45,
  itemDensity: 1, prepMinutes: 10, startMode: 'cornucopia', eventsEnabled: true,
};
const T0 = 1800000000000;

console.log('\n1. Determinizam (svi telefoni moraju da vide isti svet)');
{
  const a = R.buildSchedule('s1', cfg, T0), b = R.buildSchedule('s1', cfg, T0);
  ok('isti seed -> isti raspored', JSON.stringify(a) === JSON.stringify(b));
  ok('drugi seed -> drugi raspored', JSON.stringify(R.buildSchedule('s2', cfg, T0)) !== JSON.stringify(a));
  const i1 = R.generateItems('s1', cfg, 10), i2 = R.generateItems('s1', cfg, 10);
  ok('isti seed -> isti predmeti', JSON.stringify(i1) === JSON.stringify(i2));
  const ids = ['p1', 'p2', 'p3', 'p4'];
  ok('iste startne tacke', JSON.stringify(R.startPoints('s1', cfg, ids)) === JSON.stringify(R.startPoints('s1', cfg, ids)));
  ok('iste klase', JSON.stringify(R.dealClasses('s1', ids)) === JSON.stringify(R.dealClasses('s1', ids)));
}

console.log('\n2. Spil klasa (§5)');
{
  const four = R.dealClasses('x', ['a', 'b', 'c', 'd']);
  ok('4 igraca -> 4 razlicite klase', new Set(Object.values(four)).size === 4);
  const c48 = R.classCensus(R.dealClasses('y', Array.from({ length: 45 }, (_, i) => 'p' + i)));
  const counts = Object.values(c48);
  ok('45 igraca -> po 5 od svake', counts.length === 9 && counts.every((c) => c === 5), JSON.stringify(c48));
  ok('svaka klasa ima svoje oruzje', R.CLASS_IDS.every((c) => R.WEAPONS[R.CLASSES[c].weapon]));
  ok('niko ne krece sa predmetima', R.CLASS_IDS.every((c) => !R.CLASSES[c].startItems));
}

console.log('\n3. Zona (§14)');
{
  const s = R.buildSchedule('z', cfg, T0);
  ok('tacno 5 faza', s.zone.length === 5, String(s.zone.length));
  const pct = s.zone.map((z) => z.radiusM / (cfg.diameterM / 2));
  ok('procenti 65/42/25/12', Math.abs(pct[0] - .65) < .02 && Math.abs(pct[1] - .42) < .02
    && Math.abs(pct[2] - .25) < .02 && Math.abs(pct[3] - .12) < .02, pct.map((p) => p.toFixed(2)).join(','));
  ok('poslednja faza je 40 m precnika', s.zone[4].radiusM === 20);
  ok('poslednja faza je na kornukopiji',
    Math.abs(s.zone[4].centerLat - cfg.center.lat) < 1e-9 && Math.abs(s.zone[4].centerLng - cfg.center.lng) < 1e-9);
  ok('steta raste 2/4/7/12/20', s.zone.map((z) => z.dmgPer10s).join(',') === '2,4,7,12,20');
  ok('upozorenje 30 s pre pocetka skupljanja', s.zone.every((z) => z.startMs - z.warnAtMs === 30000));
  ok('skuplja se postepeno, ne skokom', s.zone.every((z) => z.atMs > z.startMs));
  // sredina skupljanja mora dati radijus izmedju stare i nove vrednosti
  const z0 = s.zone[0], mid = (z0.startMs + z0.atMs) / 2;
  const zm = R.zoneAt(s, cfg, mid);
  ok('u toku skupljanja radijus je izmedju', zm.radiusM < cfg.diameterM / 2 && zm.radiusM > z0.radiusM, Math.round(zm.radiusM));
  ok('centri se priblizavaju pravom centru', (() => {
    let prev = Infinity;
    for (const z of s.zone) { const d = U.dist({ lat: z.centerLat, lng: z.centerLng }, cfg.center); if (d > prev + 25) return false; prev = d; }
    return true;
  })());
}

console.log('\n4. Predmeti (§12, §13)');
{
  const items = R.generateItems('it', cfg, 12);
  ok('ukupno = igraci x 12', items.length === 144, String(items.length));
  const corn = items.filter((i) => i.pool === 'corn');
  ok('30% u kornukopiji', Math.abs(corn.length / items.length - .3) < .02);
  ok('kornukopija je u krugu 40 m', corn.every((i) => U.dist(i, cfg.center) <= R.CORN_RADIUS_M + 1));
  ok('nista u poslednjih 20 m uz ivicu',
    items.every((i) => U.dist(i, cfg.center) <= cfg.diameterM / 2 - R.EDGE_MARGIN_M + 1));
  const scat = items.filter((i) => i.pool === 'scatter');
  let minS = Infinity;
  for (let i = 0; i < scat.length; i++) for (let j = i + 1; j < scat.length; j++) minS = Math.min(minS, U.dist(scat[i], scat[j]));
  ok('min 12 m izmedju rasutih', minS >= 11.9, Math.round(minS) + ' m');
  ok('stack: obicno 3, neobicno 2, retko 1',
    R.stackLimit('berries') === 3 && R.stackLimit('bread') === 2 && R.stackLimit('driedMeat') === 1);
  ok('radijus kupljenja je 10 m', R.PICKUP_RADIUS_M === 10);
  ok('nijedan predmet nije bez tipa', items.every((i) => !!i.type && !!R.ITEMS[i.type]));
  ok('svaka retkost ima sta da izvuce u oba bazena', (() => {
    for (const pool of ['scatter', 'corn']) for (const r of Object.keys(R.RARITY)) {
      if (!R.ITEM_IDS.some((id) => R.ITEMS[id].rarity === r && (R.ITEMS[id].pool === pool || R.ITEMS[id].pool === 'both'))) return false;
    }
    return true;
  })());
  // 500 razlicitih arena — nijedna ne sme da proizvede neispravan predmet
  ok('generator je stabilan na 500 seedova', (() => {
    for (let k = 0; k < 500; k++) {
      const g = R.generateItems('seed' + k, cfg, 3 + (k % 40));
      if (!g.length || g.some((i) => !i.type || !R.ITEMS[i.type] || !isFinite(i.lat))) return false;
    }
    return true;
  })());
  ok('hrana i voda se obnavljaju, oruzja ne',
    R.isRenewable('bread') && R.isRenewable('waterBottle') && !R.isRenewable('wBow') && !R.isRenewable('backpack'));
  const fit = R.fitItem([{ itemType: 'berries', qty: 2 }], 'berries', 4);
  ok('dopunjava postojeci stack', fit.mode === 'stack');
  ok('pun inventar trazi zamenu',
    R.fitItem([1, 2, 3, 4].map(() => ({ itemType: 'bread', qty: 2 })), 'medkit', 4).mode === 'full');
}

console.log('\n5. Oruzja i borba (§6, §8)');
{
  const mk = (classId, weapon, hp) => ({ classId, weapon, hp: hp || 100, maxHp: 100 });
  ok('svako oruzje ima domet', Object.values(R.WEAPONS).every((w) => w.max >= w.min));
  ok('pesnice 8, trozubac 26', R.WEAPONS.fists.dmg === 8 && R.WEAPONS.trident.dmg === 26);
  const own = R.attackDamage(mk('archer', 'bow'), 4).dmg;
  const notOwn = R.attackDamage(mk('hunter', 'bow'), 4).dmg;
  ok('sa svojom klasom +8', own - notOwn === 8, `${own} vs ${notOwn}`);
  ok('napad van dometa je promasaj', R.attackDamage(mk('archer', 'bow'), 1).miss === true);
  ok('strelac slab izbliza', R.classRangeMod('archer', 1) === -8);
  ok('lovac jak na 1-3, slab na 0', R.classRangeMod('hunter', 2) === 6 && R.classRangeMod('hunter', 0) === -6);

  const P = { A: mk('hunter', 'spear'), B: mk('strong', 'axe') };
  const base = { a: 'A', b: 'B', distance: 2, hpA: 100, hpB: 100, round: 1, effA: {}, effB: {} };
  let r = R.resolveRound({ ...base }, { A: { kind: 'move', move: 'attack' }, B: { kind: 'move', move: 'block' } }, P);
  ok('blok smanjuje stetu za 60%', r.hpB > 100 - 26 && r.hpB < 100, String(r.hpB));
  // kontra radi samo ako je napad stvarno stigao (koplje ima domet 1–3)
  r = R.resolveRound({ ...base, distance: 1 }, { A: { kind: 'move', move: 'attack' }, B: { kind: 'move', move: 'block' } }, P);
  ok('kontra 6 izbliza', r.hpA === 94, String(r.hpA));
  r = R.resolveRound({ ...base, distance: 3 }, { A: { kind: 'move', move: 'attack' }, B: { kind: 'move', move: 'block' } }, P);
  ok('nema kontre sa daljine', r.hpA === 100, String(r.hpA));
  r = R.resolveRound({ ...base }, { A: { kind: 'move', move: 'approach' }, B: { kind: 'move', move: 'approach' } }, P);
  ok('oba prilaze -> razdaljina -2', r.distance === 0, String(r.distance));
  r = R.resolveRound({ ...base }, { A: { kind: 'move', move: 'approach' }, B: { kind: 'move', move: 'retreat' } }, P);
  ok('prilaz i odmak se ponistavaju', r.distance === 2);
  r = R.resolveRound({ ...base }, { A: null, B: { kind: 'move', move: 'attack' } }, P);
  ok('ko ne odigra -> automatski blok', r.log.some((l) => l.from === 'A' && l.kind === 'block') || r.hpA > 80);
  r = R.resolveRound({ ...base, round: 10, hpA: 90, hpB: 90 }, { A: { kind: 'move', move: 'block' }, B: { kind: 'move', move: 'block' } }, P);
  ok('posle 10 rundi obojica -10 i kraj', r.state === 'done' && r.hpA === 80 && r.hpB === 80, `${r.hpA}/${r.hpB} ${r.state}`);
  r = R.resolveRound({ ...base, hpB: 5, distance: 2 }, { A: { kind: 'move', move: 'attack' }, B: { kind: 'move', move: 'block' } }, P);
  ok('pad na 0 zavrsava borbu', r.state === 'done' && r.winner === 'A', `${r.hpB} ${r.state}`);
  // Kretanje se resava PRE napada: protivnik moze da izbegne napad menjanjem razdaljine.
  r = R.resolveRound({ ...base, distance: 3 }, { A: { kind: 'move', move: 'attack' }, B: { kind: 'move', move: 'retreat' } }, P);
  ok('odmicanjem se izbegava napad', r.hpB === 100 && r.log.some((l) => l.kind === 'miss'), String(r.hpB));

  const PS = { A: mk('shadow', 'knife'), B: mk('gatherer', 'club') };
  r = R.resolveRound({ ...base, distance: 1 }, { A: { kind: 'special' }, B: { kind: 'move', move: 'attack' } }, PS);
  ok('Senkin ubod radi 35', r.hpB === 65, String(r.hpB));
  r = R.resolveRound({ ...base, distance: 1 }, { A: { kind: 'special' }, B: { kind: 'move', move: 'block' } }, PS);
  ok('Senkin ubod na blok radi 12', r.hpB === 88, String(r.hpB));
  ok('specijal se trosi', r.specialUsedA === true);
  const PT = { A: mk('trapper', 'net'), B: mk('hunter', 'spear') };
  r = R.resolveRound({ ...base }, { A: { kind: 'special' }, B: { kind: 'move', move: 'attack' } }, PT);
  ok('Uplitanje zakljucava 3 runde', r.effB.lockedRounds === 3, String(r.effB.lockedRounds));
  const PR = { A: mk('runner', 'sling'), B: mk('hunter', 'spear') };
  r = R.resolveRound({ ...base }, { A: { kind: 'special' }, B: { kind: 'move', move: 'attack' } }, PR);
  ok('Trkacev nestanak = bekstvo', r.state === 'chase' && r.fled === 'A');
}

console.log('\n6. Razdaljina i slikanje (§7)');
{
  ok('opsezi 0/1/2/3', [4, 10, 20, 30].map((m) => R.distanceBand(m, false)).join(',') === '0,1,2,3');
  ok('opseg 4 samo za strelca', R.distanceBand(42, false) === -1 && R.distanceBand(42, true) === 4);
  ok('konus je +-30 stepeni', R.PHOTO_CONE_DEG === 30);
  ok('cooldown na neuspelo slikanje 15 s', R.PHOTO_COOLDOWN_MS === 15000);
  ok('strelac vidi 60, gadja 30', R.PHOTO_MAX_ARCHER_M === 60 && R.RANGED_MAX_M === 30);
  ok('nisanjenje 8 s, cooldown 90 s', R.RANGED_AIM_MS === 8000 && R.RANGED_COOLDOWN_MS === 90000);
}

console.log('\n7. Bekstvo (§9)');
{
  ok('van 20 m neprekidno 15 s', R.CHASE.escapeRadiusM === 20 && R.CHASE.escapeSec === 15);
  ok('Trkac bezi za 10 s', R.CLASSES.runner.fleeSeconds === 10);
  ok('Trkac bez besplatnog udarca', R.CLASSES.runner.freeHitOnFlee === false);
  ok('Zamkar ne moze da bezi', R.CLASSES.trapper.cannotFlee === true);
  ok('povratak u borbu na 8 m', R.CHASE.rejoinRadiusM === 8);
  ok('90 s bez ishoda = pobegao', R.CHASE.timeoutMs === 90000);
  ok('60 s imuniteta posle bekstva', R.CHASE.immunityMs === 60000);
}

console.log('\n8. Glad, zed, HP (§11) — iz proteklog vremena, ne tajmerom');
{
  const p = { hp: 100, hunger: 100, thirst: 100, maxHp: 100 };
  let r = R.survivalTick(p, null, 70000, { nowMs: T0 });
  ok('zed -1 na 7 s', Math.abs(r.thirst - 90) < .01, String(r.thirst));
  ok('glad -1 na 11 s', Math.abs(r.hunger - (100 - 70 / 11)) < .01, r.hunger.toFixed(2));
  ok('HP se ne dira dok ima hrane', r.hp === 100);
  r = R.survivalTick({ ...p, thirst: 0 }, null, 20000, { nowMs: T0 });
  ok('prazna zed -2 HP na 20 s', Math.abs(r.hp - 98) < .01, String(r.hp));
  r = R.survivalTick({ ...p, thirst: 0, hunger: 0 }, null, 60000, { nowMs: T0 });
  ok('glad i zed se sabiraju', Math.abs(r.hp - (100 - 6 - 4)) < .01, String(r.hp));
  const gat = R.survivalTick(p, R.CLASSES.gatherer, 70000, { nowMs: T0 });
  ok('Sakupljac 40% sporije', gat.thirst > r.thirst && Math.abs(gat.thirst - 94) < .01, String(gat.thirst));
  const dr = R.survivalTick(p, null, 70000, { nowMs: T0, drought: true });
  ok('susa duplo brze', Math.abs(dr.thirst - 80) < .01, String(dr.thirst));
  const zn = R.survivalTick(p, null, 10000, { nowMs: T0, outsideZone: true, zoneDmgPer10s: 7 });
  ok('zona radi stetu po 10 s', Math.abs(zn.hp - 93) < .01, String(zn.hp));
  const st = R.survivalTick(p, R.CLASSES.strong, 10000, { nowMs: T0, outsideZone: true, zoneDmgPer10s: 12 });
  ok('Snagator trpi upola od zone', Math.abs(st.hp - 94) < .01, String(st.hp));
  const fr = R.survivalTick(p, null, 60000, { nowMs: T0, frozen: true, outsideZone: true, zoneDmgPer10s: 20 });
  ok('pauza zamrzava sve', fr.hp === 100 && fr.hunger === 100 && fr.thirst === 100);
  ok('HP se nikad ne regenerise', R.survivalTick({ ...p, hp: 40 }, null, 600000, { nowMs: T0 }).hp <= 40);
}

console.log('\n9. Savezi i lobi (§2, §10)');
{
  ok('max savez 2/3/4/5', [6, 12, 20, 40].map(R.maxAllianceSize).join(',') === '2,3,4,5');
  ok('min 3 max 48 igraca', R.MIN_PLAYERS === 3 && R.MAX_PLAYERS === 48);
  ok('preporuke po broju igraca',
    R.recommendFor(5).diameterM === 350 && R.recommendFor(10).durationMin === 45 &&
    R.recommendFor(40).diameterM === 1200);
}

console.log('\n10. Konzumiranje (§12)');
{
  const p = { hp: 50, maxHp: 100, hunger: 40, thirst: 40, classId: 'hunter' };
  ok('hleb +35 gladi', R.consume(p, 'bread').hunger === 75);
  ok('izvorska voda +70 zedji, do 100', R.consume(p, 'springWater').thirst === 100);
  ok('prljava voda -8 HP', R.consume(p, 'dirtyWater').hp === 42);
  ok('Sakupljacu prljava voda ne skodi', R.consume({ ...p, classId: 'gatherer' }, 'dirtyWater').hp === 50);
  ok('bilje +15, Lekaru duplo',
    R.consume(p, 'herbs').hp === 65 && R.consume({ ...p, classId: 'medic' }, 'herbs').hp === 80);
  ok('mast vraca pun HP', R.consume(p, 'salve').hp === 100);
  ok('ranac dize kapacitet na 7', R.consume(p, 'backpack').capacity === 7);
  ok('pojas dize max glad', R.consume(p, 'supplyBelt').maxHungerBonus === 30);
  ok('Trkac ima +1 slot', R.slotsOf({ classId: 'runner', capacity: 4 }) === 5);
}

console.log(fail ? `\n${fail} provera palo\n` : `\nSve provere prosle\n`);
process.exit(fail ? 1 : 0);
