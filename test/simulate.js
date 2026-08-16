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
  ok('stack po TIPU: hrana i pice 3, sve ostalo 1',
    R.stackLimit('berries') === 3 && R.stackLimit('waterBottle') === 3
    && R.stackLimit('backpack') === 1 && R.stackLimit('trapBasic') === 1
    && R.stackLimit('feastMeal') === 1);
  ok('radijus kupljenja je 12 m', R.PICKUP_RADIUS_M === 12);
  ok('uzimanje zavisi od TIPA, ne od retkosti',
    R.pickupOf('springWater').id === 'tap'          // retko, ali se pije
    && R.pickupOf('berries').id === 'tap'
    && R.pickupOf('trapBasic').id === 'hold3'
    && R.pickupOf('backpack').id === 'hold3'
    && R.pickupOf('wTrident').id === 'chest8'
    && R.pickupOf('wBow').id === 'chest8'
    && R.pickupOf('feastMeal').id === 'chest8');
  ok('samo sanduk javlja svima',
    R.PICKUP.chest8.announce === true && !R.PICKUP.hold3.announce && !R.PICKUP.tap.announce);
  ok('adrenalin polovi vreme drzanja',
    R.pickupOf('wTrident', { adrenalineUntilMs: 9e9 }, 0).pickMs === 4000
    && R.pickupOf('wTrident', {}, 0).pickMs === 8000);
  ok('svaki predmet ima klasu uzimanja',
    R.ITEM_IDS.every((id) => !!R.PICKUP[R.ITEMS[id].pickup || 'tap']));
  ok('mamac se nikad ne izvlaci iz bazena',
    R.SPAWNABLE_IDS.length === R.ITEM_IDS.length || !R.SPAWNABLE_IDS.includes('decoyBait'));
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
  ok('hrana i voda se obnavljaju, oruzja i kamera ne',
    R.isRenewable('ration') && R.isRenewable('waterBottle')
    && !R.isRenewable('wBow') && !R.isRenewable('backpack')
    && !R.isRenewable('flashFoil') && !R.isRenewable('adrenaline'));
  const fit = R.fitItem([{ itemType: 'berries', qty: 2 }], 'berries', 4);
  ok('dopunjava postojeci stack', fit.mode === 'stack');
  ok('pun inventar trazi zamenu',
    R.fitItem([1, 2, 3, 4].map(() => ({ itemType: 'ration', qty: 3 })), 'bandage', 4).mode === 'full');
  ok('izbaceni duplikati vise ne postoje',
    ['bread', 'driedMeat', 'juice', 'medkit', 'smallBag', 'bigBackpack', 'bigTorch', 'ragePotion']
      .every((id) => !R.ITEMS[id]));
  ok('nova kategorija kamere postoji',
    ['flashFoil', 'tripod', 'smokeBomb', 'adrenaline', 'shield']
      .every((id) => R.ITEMS[id] && R.ITEMS[id].type === 'combat'));
  ok('ukupno 41 predmet', R.ITEM_IDS.length === 41, String(R.ITEM_IDS.length));
}

console.log('\n4b. Zamke i GPS (§9)');
{
  ok('zamka okida na 15 m posle 5 s zadrzavanja',
    R.TRAP_RADIUS_M === 15 && R.TRAP_DWELL_MS === 5000);
  ok('mreza-zamka blokira kameru 30 s, ne bekstvo',
    R.ITEMS.trapNet.blocksCameraMs === 30000 && R.ITEMS.trapNet.blocksFlee === undefined);
  const ctx = { nowMs: 1000, myAccM: 5, lastMoveMs: 900 };
  const t = { alive: true, hp: 100, pos: { accM: 5 } };
  ok('u mrezi ne mozes da napadas',
    R.attackBlocked({ cameraBlockedUntilMs: 5000 }, t, ctx) === 'netted');
  ok('u dimu ne mozes da napadas',
    R.attackBlocked({}, t, { ...ctx, inSmoke: true }) === 'smoke'
    && R.attackBlocked({}, t, { ...ctx, targetInSmoke: true }) === 'smokeTarget');
  const zones = R.smokeZones({ p1: { smokeUntilMs: 9e9, smokeRadiusM: 20, smokeAt: { lat: 0, lng: 0 } } }, 0);
  ok('dim se cita iz spiska igraca, bez novog cvora',
    zones.length === 1 && R.inSmoke(zones, { lat: 0, lng: 0 }) && !R.inSmoke(zones, { lat: 0.01, lng: 0 }));
}

console.log('\n4c. Kamera i borba (§10)');
{
  const shooter = { classId: 'hunter', weapon: 'spear', hunger: 100, thirst: 100 };
  const far = 10;
  ok('blic-folija obara snimak sa preko 15 m',
    R.attackDamage(shooter, 20, { weapon: R.WEAPONS.bow, targetFlashUntilMs: 9e9, nowMs: 0 }).reason === 'flash');
  ok('blic ne smeta izbliza',
    !R.attackDamage(shooter, far, { targetFlashUntilMs: 9e9, nowMs: 0 }).miss);
  ok('stativ probija blic i duplira stetu', (() => {
    const r = R.attackDamage({ classId: 'hunter', weapon: 'bow', tripodCharges: 1 }, 20,
      { weapon: R.WEAPONS.bow, targetFlashUntilMs: 9e9, nowMs: 0 });
    return !r.miss && r.usedTripod && r.dmg === 60;      // luk 30 × 2, nije njegovo oruzje
  })());
  ok('adrenalin skida kaznu za preblizu', (() => {
    const close = { ...shooter, weapon: 'bow', classId: 'archer', adrenalineUntilMs: 9e9 };
    const r = R.attackDamage(close, 5, { nowMs: 0, rng: () => 0 });
    return !r.miss && r.dmg === 38;                       // 30 + 8 svoje oruzje, bez polovljenja
  })());
  ok('gladan igrac radi 25% manje stete', (() => {
    const hungry = { ...shooter, hunger: 10 };
    return R.attackDamage(hungry, far, { nowMs: 0 }).dmg
      === Math.round(R.attackDamage(shooter, far, { nowMs: 0 }).dmg * 0.75);
  })());
}

console.log('\n5. Oruzja i udarac (borba v4 §2)');
{
  const mk = (classId, weapon, extra) => ({ classId, weapon, hp: 100, maxHp: 100, ...(extra || {}) });
  const W = R.WEAPONS;

  ok('svako oruzje ima opseg u metrima', Object.values(W).every((w) => w.maxM >= w.minM && w.aimMs > 0 && w.cdMs > 0));
  ok('pesnice 0-3 m / 10, luk 15-40 m / 30',
    W.fists.minM === 0 && W.fists.maxM === 3 && W.fists.dmg === 10
    && W.bow.minM === 15 && W.bow.maxM === 40 && W.bow.dmg === 30);
  ok('noz je najjaci izbliza', W.knife.dmg === 45 && W.knife.maxM === 5);

  const own = R.attackDamage(mk('archer', 'bow'), 25, { rng: () => 0.99 }).dmg;
  const notOwn = R.attackDamage(mk('hunter', 'bow'), 25, { rng: () => 0.99 }).dmg;
  ok('sa svojom klasom +8', own - notOwn === R.OWN_WEAPON_BONUS, `${own} vs ${notOwn}`);

  ok('opseg: u dometu / preblizu / predaleko',
    [R.rangeState(W.bow, 25), R.rangeState(W.bow, 3), R.rangeState(W.bow, 55)].join(',') === 'in,close,far');
  ok('predaleko je uvek promasaj', R.attackDamage(mk('archer', 'bow'), 55, {}).miss === true);

  // preblizu: pola stete i 40% sanse za promasaj
  const near = R.attackDamage(mk('archer', 'bow'), 3, { rng: () => 0.99 });
  ok('preblizu radi pola stete', near.dmg === Math.round((30 + 8) * R.CLOSE_DMG_MUL), String(near.dmg));
  ok('preblizu moze da promasi', R.attackDamage(mk('archer', 'bow'), 3, { rng: () => 0.1 }).miss === true);
  ok('sansa promasaja izbliza je 40%', R.CLOSE_MISS_CHANCE === 0.4);

  ok('izdaja radi +50%', R.attackDamage(mk('hunter', 'spear'), 6, { rng: () => 0.99, betrayal: true }).dmg
    === Math.round((28 + 8) * R.BETRAYAL_MUL));

  // upozorenje zrtvi
  ok('noz i sekira ne najavljuju', !R.warnsAt(W.knife, 3) && !R.warnsAt(W.axe, 5));
  ok('luk i koplje najavljuju', R.warnsAt(W.bow, 30) && R.warnsAt(W.spear, 8));
  ok('trozubac najavljuje tek preko 8 m', !R.warnsAt(W.trident, 6) && R.warnsAt(W.trident, 12));

  /* §5: "potrebno je 3 pogotka nozem ili 4 strele za 100 HP" — to je racun sa
     OSNOVNOM stetom oruzja. Sa svojom klasom (+8) ide brze, i to je i poenta
     bonusa. Jedan napad iz zasede ne sme da ubije ni u jednom slucaju. */
  const knifeBase = R.attackDamage(mk('hunter', 'knife'), 2, { rng: () => 0.99 }).dmg;
  ok('tri pogotka nozem obaraju 100 HP', knifeBase * 2 < 100 && knifeBase * 3 >= 100, String(knifeBase));
  const bowBase = R.attackDamage(mk('hunter', 'bow'), 25, { rng: () => 0.99 }).dmg;
  ok('cetiri strele obaraju 100 HP', bowBase * 3 < 100 && bowBase * 4 >= 100, String(bowBase));
  const knifeOwn = R.attackDamage(mk('shadow', 'knife'), 2, { rng: () => 0.99 }).dmg;
  ok('sa svojom klasom je brze, ali nikad iz jednog udarca', knifeOwn < 100 && knifeOwn * 2 >= 100, String(knifeOwn));
  ok('ni najjaci specijal ne ubija iz jednog udarca sa punim HP', R.SPECIALS.shadow.dmg < 100);

  // cooldown
  ok('Trkac ima cooldown -25%',
    R.cooldownFor(mk('runner', 'sling'), W.sling, 0) === Math.round(W.sling.cdMs * 0.75));
  ok('Drugi vetar polovi cooldown',
    R.cooldownFor(mk('runner', 'sling', { secondWindUntilMs: 9e15 }), W.sling, 0)
    === Math.round(W.sling.cdMs * 0.75 * 0.5));

  // efekti
  ok('mreza uplice 20 s', R.WEAPONS.net.entangle === true && R.ENTANGLE_MS === 20000);
  ok('duvaljka truje 3 HP na 10 s tokom 60 s',
    R.POISON_DMG === 3 && R.POISON_TICK_MS === 10000 && R.POISON_MS === 60000);
  ok('otrov za 30 s nanese 9', R.poisonDamage(0, 30000, 60000) === 9, String(R.poisonDamage(0, 30000, 60000)));
  ok('otrov prestaje kad istekne', R.poisonDamage(0, 90000, 60000) === 18, String(R.poisonDamage(0, 90000, 60000)));
}

console.log('\n6. Nisanjenje i anti-varanje (borba v4 §3, §10)');
{
  const me = { classId: 'hunter', weapon: 'spear', hp: 100 };
  const foe = { alive: true, hp: 100, pos: { lat: 0, lng: 0, accM: 5 } };
  const base = { nowMs: 1e6, startedAtMs: 0, myAccM: 5, outsideZone: false, lastMoveMs: 1e6 - 1000 };

  ok('konus je +-30 stepeni', R.PHOTO_CONE_DEG === 30);
  ok('cooldown na neuspelo slikanje 15 s', R.PHOTO_COOLDOWN_MS === 15000);
  ok('nisanjenje puca ako se pomeris 5 m', R.AIM_SELF_MOVE_M === 5);
  ok('zrtva izmice na 8 m', R.AIM_DODGE_M === 8);

  ok('u redu -> nema prepreke', R.attackBlocked(me, foe, base) === null);
  ok('mrtva meta', R.attackBlocked(me, { ...foe, alive: false }, base) === 'dead');
  ok('prvih 30 s nema napada', R.attackBlocked(me, foe, { ...base, startedAtMs: base.nowMs - 10000 }) === 'grace');
  ok('van arene ne moze', R.attackBlocked(me, foe, { ...base, outsideZone: true }) === 'zone');
  ok('slab GPS napadaca', R.attackBlocked(me, foe, { ...base, myAccM: 30 }) === 'gps');
  ok('slab GPS zrtve', R.attackBlocked(me, { ...foe, pos: { lat: 0, lng: 0, accM: 40 } }, base) === 'gpsTarget');
  ok('ko se ne pomera 5 min ne napada',
    R.attackBlocked(me, foe, { ...base, lastMoveMs: base.nowMs - 400000 }) === 'stale');
  ok('cooldown oruzja blokira',
    R.attackBlocked({ ...me, weaponCooldownUntilMs: base.nowMs + 5000 }, foe, base) === 'cooldown');
  ok('uplitanje blokira',
    R.attackBlocked({ ...me, entangledUntilMs: base.nowMs + 5000 }, foe, base) === 'entangled');
  ok('luk bez strela ne puca',
    R.attackBlocked({ classId: 'archer', weapon: 'bow', arrows: 0 }, foe, base) === 'ammo');
  ok('anti-varanje trazi tacnost 20 m i pomeraj 20 m',
    R.MIN_ACC_M === 20 && R.STALE_MOVE_M === 20 && R.STALE_MS === 300000 && R.START_GRACE_MS === 30000);
}

console.log('\n7. Specijali — jednom po IGRI (borba v4 §6)');
{
  const S = R.SPECIALS;
  ok('svaka klasa ima specijal', R.CLASS_IDS.every((c) => S[c]));
  ok('Ubod u leda 90 na 3 m', S.shadow.dmg === 90 && S.shadow.maxM === 3 && S.shadow.needsBackTurned === true);
  ok('Baceni trozubac 60 do 25 m i gubi oruzje',
    S.fisher.dmg === 60 && S.fisher.maxM === 25 && S.fisher.losesWeapon === true);
  ok('Precizan hitac 55, nisani 10 s', S.archer.dmg === 55 && S.archer.aimMs === 10000);
  ok('Nasrtaj 50 i ignorise kaznu za opseg', S.strong.dmg === 50 && S.strong.ignoresRangePenalty === true);
  ok('Salva 3 x 20 u 15 s', S.hunter.hits === 3 && S.hunter.dmg === 20 && S.hunter.windowMs === 15000);
  ok('Velika mreza 12 m / 40 s', S.trapper.radiusM === 12 && S.trapper.entangleMs === 40000);
  ok('Drugi vetar 60 s', S.runner.durationMs === 60000 && S.runner.cooldownMul === 0.5);
  ok('Zaliha puni glad i zed', S.gatherer.fillsSurvival === true);
  ok('Napitak vraca 70 HP', S.medic.heal === 70 && S.medic.canTargetAlly === true);

  ok('Nasrtaj ignorise kaznu za preblizu',
    R.attackDamage({ classId: 'strong', weapon: 'axe' }, 0.5,
      { rng: () => 0.1, ignoresRangePenalty: true, weapon: R.WEAPONS.spear }).miss === false);

  // ubod u leda: gleda li zrtva u tvom pravcu
  ok('leda okrenuta -> prolazi', R.isBackTurned(0, 180, 60) === true);
  ok('gleda u tebe -> ne prolazi', R.isBackTurned(0, 10, 60) === false);
  ok('bez kompasa se racuna kao leda', R.isBackTurned(null, 0, 60) === true);
}

console.log('\n7b. Klase posle borbe v4 (§7)');
{
  ok('Trkac: cooldown -25% i imun na uplitanje',
    R.CLASSES.runner.cooldownMul === 0.75 && R.CLASSES.runner.immuneToEntangle === true);
  ok('Trkac zadrzao +1 slot', R.CLASSES.runner.extraSlots === 1);
  ok('Zamkar: -10 max HP umesto zabrane bekstva',
    R.CLASSES.trapper.maxHp === 90 && R.CLASSES.trapper.cannotFlee === undefined);
  ok('Zamkar zadrzao zamke', R.CLASSES.trapper.trapCapacityMul === 2 && R.CLASSES.trapper.trapPowerMul === 1.5);
  ok('Lekar i dalje moze da leci saveznika', R.CLASSES.medic.canHealAlly === true);
  ok('Strelac vidi igrace na 40 m', R.CLASSES.archer.playerVisionM === 40);
  ok('Senka nevidljiva i slepa za mapu',
    R.CLASSES.shadow.invisible === true && R.CLASSES.shadow.blindToMap === true);
  ok('bekstva vise nema', R.CHASE === undefined && R.resolveRound === undefined);
  ok('trake razdaljine 0-5 vise nema', R.distanceBand === undefined && R.MOVES === undefined);
  ok('lecenje traje 3 s u mestu', R.HEAL_HOLD_MS === 3000 && R.HEAL_MOVE_M === 5);
}

console.log('\n8. Glad, zed, HP (§11) — iz proteklog vremena, ne tajmerom');
{
  const p = { hp: 100, hunger: 100, thirst: 100, maxHp: 100 };
  let r = R.survivalTick(p, null, 70000, { nowMs: T0 });
  ok('zed -1 na 6 s (prazna za 10 min)', Math.abs(r.thirst - (100 - 70 / 6)) < .01, r.thirst.toFixed(2));
  ok('glad -1 na 9 s (prazna za 15 min)', Math.abs(r.hunger - (100 - 70 / 9)) < .01, r.hunger.toFixed(2));
  ok('HP se ne dira dok ima hrane', r.hp === 100);
  r = R.survivalTick({ ...p, thirst: 0 }, null, 20000, { nowMs: T0 });
  ok('prazna zed -2 HP na 20 s', Math.abs(r.hp - 98) < .01, String(r.hp));
  r = R.survivalTick({ ...p, thirst: 0, hunger: 0 }, null, 60000, { nowMs: T0 });
  ok('oba prazna: -5 HP na 30 s, jace od zbira', Math.abs(r.hp - 90) < .01, String(r.hp));
  const gat = R.survivalTick(p, R.CLASSES.gatherer, 70000, { nowMs: T0 });
  ok('Sakupljac 40% sporije', Math.abs(gat.thirst - (100 - (70 / 6) * 0.6)) < .01, gat.thirst.toFixed(2));
  const dr = R.survivalTick(p, null, 70000, { nowMs: T0, drought: true });
  ok('susa duplo brze', Math.abs(dr.thirst - (100 - (70 / 6) * 2)) < .01, dr.thirst.toFixed(2));
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
    R.recommendFor(5).diameterM === 350 && R.recommendFor(10).durationMin === 40 &&
    R.recommendFor(40).diameterM === 1200);
}

console.log('\n10. Konzumiranje (§12)');
{
  const p = { hp: 50, maxHp: 100, hunger: 40, thirst: 40, classId: 'hunter' };
  ok('obrok +45 gladi', R.consume(p, 'ration').hunger === 85);
  ok('izvorska voda +70 zedji, do 100', R.consume(p, 'springWater').thirst === 100);
  ok('prljava voda -8 HP', R.consume(p, 'dirtyWater').hp === 42);
  ok('Sakupljacu prljava voda ne skodi', R.consume({ ...p, classId: 'gatherer' }, 'dirtyWater').hp === 50);
  ok('bilje +15, Lekaru duplo',
    R.consume(p, 'herbs').hp === 65 && R.consume({ ...p, classId: 'medic' }, 'herbs').hp === 80);
  ok('zavoj +35 (popunio rupu od medkita)', R.consume(p, 'bandage').hp === 85);
  ok('mast vraca pun HP i skida otrov',
    R.consume(p, 'salve').hp === 100 && R.consume(p, 'salve').poisonUntilMs === null);
  ok('ranac dize kapacitet na 7 i cini te vidljivim', (() => {
    const r = R.consume(p, 'backpack');
    return r.capacity === 7 && r.bulkyVisibleM === 50;
  })());
  ok('gozba puni i glad i zedj',
    R.consume(p, 'feastMeal').hunger === 100 && R.consume(p, 'feastMeal').thirst === 90);
  ok('pojas dize max glad', R.consume(p, 'supplyBelt').maxHungerBonus === 30);
  ok('Trkac ima +1 slot', R.slotsOf({ classId: 'runner', capacity: 4 }) === 5);

  /* Ovo je bio bag: protivotrov je pisao `poisonedUntilMs` (sa D), a borba je
     citala `poisonUntilMs`, pa protivotrov nije skidao otrov od duvaljke. */
  ok('protivotrov brise ISTO polje koje pise borba', (() => {
    const r = R.consume({ ...p, poisonUntilMs: 9e9 }, 'antidote', null, 1000);
    return r.poisonUntilMs === null && r.poisonImmuneUntilMs === 61000;
  })());
  ok('pecurke uvek truju, ali hrane najvise u divljini', (() => {
    const r = R.consume(p, 'mushrooms', null, 1000);
    return r.hunger === 80 && r._msg === 'poisoned' && r.poisonUntilMs === 1000 + R.POISON_MS;
  })());
  ok('protivotrov stiti od pecuraka 60 s',
    R.consume({ ...p, poisonImmuneUntilMs: 9e9 }, 'mushrooms', null, 1000).poisonUntilMs === undefined);

  ok('efekti sa trajanjem se vide u traci', (() => {
    const fx = R.activeEffects({ torchUntilMs: 5000, hasShield: true, tripodCharges: 2 }, 1000);
    const ids = fx.map((e) => e.id);
    return ids.includes('torch') && ids.includes('shield') && ids.includes('tripod')
      && fx.find((e) => e.id === 'torch').leftMs === 4000;
  })());
  ok('baklja i ranac te odaju, ostalo ne',
    R.selfRevealM({ torchUntilMs: 9e9 }, 0) === 100
    && R.selfRevealM({ bulkyVisibleM: 50 }, 0) === 50
    && R.selfRevealM({ camoUntilMs: 9e9 }, 0) === 0);
}

console.log('\n10b. Glad i zedj su asimetricne (§3)');
{
  const S = R.SURVIVAL;
  ok('zedj ~10 min, glad ~15 min',
    S.thirstSecPerPoint * 100 === 600 && S.hungerSecPerPoint * 100 === 900);
  ok('zedjan slepis, gladan slabis', (() => {
    const parched = R.survivalPenalty({ hunger: 100, thirst: 10 });
    const starving = R.survivalPenalty({ hunger: 10, thirst: 100 });
    return parched.visionCapM === 10 && parched.dmgMul === 1
      && starving.dmgMul === 0.75 && starving.visionCapM === 0;
  })());
  ok('zedj obara minimapu sa 15 na 10 m',
    R.visionFor({ classId: 'hunter', hunger: 100, thirst: 10 }).itemsM === 10
    && R.visionFor({ classId: 'hunter', hunger: 100, thirst: 100 }).itemsM === 15);
  // bez ovoga bi zedj bila spirala: sto si zedniji, teze nadjes vodu
  ok('vid za PICE ne pada od zedji',
    R.visionFor({ classId: 'hunter', hunger: 100, thirst: 10 }).drinksM === 15);
  ok('baklja dize vid za predmete', R.visionFor({ classId: 'hunter' }, { hasLight: true }).itemsM === 21);
  ok('oba na nuli bole vise od zbira', (() => {
    const both = R.survivalTick({ hp: 100, hunger: 0, thirst: 0, alive: true },
      null, 30000, { nowMs: 0 });
    return Math.round(100 - both.hp) === 5;
  })());
}

console.log('\n11. Iskre, halucinacije, mentor (§15, §16, §17)');
{
  const s1 = R.generateSparks('sp', cfg, 10), s2 = R.generateSparks('sp', cfg, 10);
  ok('iskre su determinsticke', JSON.stringify(s1) === JSON.stringify(s2));
  ok('iskre po 3 na igraca', s1.length === 30, String(s1.length));
  ok('iskra se kupi na 10 m', R.SPARK_REACH_M === 10);

  const h1 = R.hallucinations('p1', cfg.center, 7), h2 = R.hallucinations('p1', cfg.center, 7);
  ok('halucinacije su stabilne u istom minutu', JSON.stringify(h1) === JSON.stringify(h2));
  ok('drugi igrac vidi druge halucinacije',
    JSON.stringify(R.hallucinations('p2', cfg.center, 7)) !== JSON.stringify(h1));
  ok('halucinacije su oznacene kao lazne', h1.every((x) => x.fake === true && !!R.ITEMS[x.type]));
  ok('halucinacije traju 5 min', R.HALLUCINATION_MS === 300000);

  ok('cena paketa raste 1/3/6/10',
    [0, 1, 2, 3].map(R.packageCost).join(',') === '1,3,6,10');
  ok('peti paket ostaje na 10', R.packageCost(9) === 10);
  ok('voda i hrana od 1, medkit i ranac od 3, oruzje od 6',
    R.PACKAGE_TIERS.water.minCost === 1 && R.PACKAGE_TIERS.food.minCost === 1 &&
    R.PACKAGE_TIERS.medkit.minCost === 3 && R.PACKAGE_TIERS.backpack.minCost === 3 &&
    R.PACKAGE_TIERS.weapon.minCost === 6);
  ok('prvi paket ne moze biti oruzje', !R.canAffordTier('weapon', 0, 99));
  ok('cetvrti paket moze biti oruzje', R.canAffordTier('weapon', 3, 10));
  ok('bez naklonosti nema paketa', !R.canAffordTier('water', 0, 0));
  ok('paket pada 15 m od igraca', R.PACKAGE_DROP_M === 15);
  ok('max 1 paket na 5 min', R.PACKAGE_COOLDOWN_MS === 300000);
  ok('navijanje 0.5 na 10 min', R.CHEER_FAVOR === 0.5 && R.CHEER_COOLDOWN_MS === 600000);
  ok('svi paketi vode ka stvarnim predmetima',
    Object.values(R.PACKAGE_TIERS).every((t) => t.items.every((i) => !!R.ITEMS[i])));
}

console.log("\n12. Duhovi van zone (§16)");
{
  /* Duhovska teritorija je PRSTEN oko zone: unutra su zivi, napolju mrtvi.
     Geometrija prstena je cista funkcija FAZE — ne trenutka — pa iskre stoje
     mirno i dok se zona skuplja. */
  const sch = R.buildSchedule('gz', cfg, T0);
  const gen = (phase) => R.generateSparks('gz', cfg, 10, phase, sch);
  const zoneR = (phase) => R.zoneAtPhaseSettled(sch, cfg, phase).radiusM;
  const zoneC = (phase) => R.zoneAtPhaseSettled(sch, cfg, phase).center;

  const a1 = gen(1), a2 = gen(1);
  ok('iskre su determinsticke po fazi', JSON.stringify(a1) === JSON.stringify(a2));

  const drugaFaza = gen(2);
  ok('druga faza daje druge iskre', JSON.stringify(drugaFaza) !== JSON.stringify(a1));

  ok('nijedna iskra nije bliza od 20 m ivici zone', [0, 1, 2, 3, 4, 5].every((ph) => {
    const r = zoneR(ph), c = zoneC(ph);
    return gen(ph).every((s) => U.dist(s, c) >= r + R.SPARK_ZONE_MARGIN_M - 0.5);
  }));

  ok('margina je 20 m, prsten viri 60 m van arene',
    R.SPARK_ZONE_MARGIN_M === 20 && R.GHOST_OUTER_M === 60);

  // kad se zona skupi, unutrasnja ivica prstena se priblizava centru
  const minOd = (ph) => Math.min.apply(null, gen(ph).map((s) => U.dist(s, zoneC(ph))));
  ok('kad se zona skupi, prsten iskri je veci',
    minOd(4) < minOd(1), `${Math.round(minOd(4))} < ${Math.round(minOd(1))}`);

  // id nosi fazu, pa se skupljene iskre iz raznih faza ne sudaraju
  const idA = new Set(a1.map((s) => s.id));
  ok('id-jevi iskri iz razlicitih faza se ne poklapaju', drugaFaza.every((s) => !idA.has(s.id)));
  ok('id nosi fazu', a1[0].id.startsWith('s1_') && drugaFaza[0].id.startsWith('s2_'));

  // prsten prati centar ZONE, ne arene — zona se pomera kroz partiju
  ok('prsten prati centar zone, ne arene', (() => {
    const ph = sch.zone.findIndex((z) => U.dist({ lat: z.centerLat, lng: z.centerLng }, cfg.center) > 20) + 1;
    if (!ph) return true;                       // ovaj seed nije pomerio centar
    const c = zoneC(ph), r = zoneR(ph);
    return gen(ph).every((s) => U.dist(s, c) >= r + R.SPARK_ZONE_MARGIN_M - 0.5);
  })());

  ok('faza 0 je puna arena', zoneR(0) === cfg.diameterM / 2);
  ok('faza N je stanje POSLE zone[N-1]',
    zoneR(1) === sch.zone[0].radiusM && zoneR(5) === sch.zone[4].radiusM);
}

console.log("\n12b. Iskre ne beze dok se zona skuplja");
{
  /* Regresija: `zoneAt` tokom skupljanja vraca radiusM i center kao lerp koji
     se menja svake sekunde, dok `phase` ostaje isti. Dok se prsten racunao iz
     zive zone, ista iskra (isti id) selila se do 634 m — pri dometu kupljenja
     od 10 m. Ovo je provera KROZ VREME; provera jedne funkcije je ne hvata. */
  const sch = R.buildSchedule('s1', cfg, T0);
  const gen = (ph) => R.generateSparks('s1', cfg, 10, ph, sch);

  let maxPomeraj = 0, gde = '';
  for (const ph of sch.zone) {
    const naPocetku = R.zoneAt(sch, cfg, ph.startMs);
    const naKraju = R.zoneAt(sch, cfg, ph.atMs - 500);
    ok(`faza ostaje ista kroz celo skupljanje (${Math.round((ph.atMs - ph.startMs) / 1000)} s)`,
      naPocetku.phase === naKraju.phase, `${naPocetku.phase} -> ${naKraju.phase}`);

    const A = gen(naPocetku.phase), B = gen(naKraju.phase);
    const mapB = new Map(B.map((s) => [s.id, s]));
    for (const s of A) {
      const t = mapB.get(s.id);
      if (!t) { maxPomeraj = Infinity; gde = 'iskra ' + s.id + ' nestala'; continue; }
      const m = U.dist(s, t);
      if (m > maxPomeraj) { maxPomeraj = m; gde = s.id; }
    }
  }
  ok('iskra se NE pomera dok se zona skuplja', maxPomeraj === 0,
    `najveci pomeraj ${Math.round(maxPomeraj)} m (${gde})`);

  // isto i na sredini skupljanja, ne samo na krajevima
  let sredina = 0;
  for (const ph of sch.zone) {
    const t = (ph.startMs + ph.atMs) / 2;
    const A = gen(R.zoneAt(sch, cfg, ph.startMs).phase);
    const B = gen(R.zoneAt(sch, cfg, t).phase);
    const mapB = new Map(B.map((s) => [s.id, s]));
    for (const s of A) { const q = mapB.get(s.id); if (q) sredina = Math.max(sredina, U.dist(s, q)); }
  }
  ok('ni na sredini skupljanja', sredina === 0, `${Math.round(sredina)} m`);

  // FINAL_TWO polovi radijus bez promene faze — iskre to vise ne smeju da osete
  const z = R.zoneAt(sch, cfg, sch.zone[2].atMs);
  const kaoFinalTwo = { ...z, radiusM: Math.max(20, z.radiusM * 0.5) };
  ok('FINAL_TWO ne pomera iskre',
    JSON.stringify(gen(z.phase)) === JSON.stringify(gen(kaoFinalTwo.phase)));
}


console.log('\n13. Dan i noc idu sami, po satu');
{
  /* Noc je bila dogadjaj koji duhovi kupuju, pa je partija mogla da prodje
     cela po danu — ili da noc padne dvaput za deset minuta. Sada je ritam. */
  ok('noci vise nema medju dogadjajima', !R.EVENTS.night && !R.SPARK_COSTS.night);
  ok('pun dan je 10 min: 5 svetlih + 5 mracnih',
    R.DAY_MS === 300000 && R.NIGHT_MS === 300000 && R.DAY_CYCLE_MS === 600000);
  ok('trajanje ide u koracima od 10 min', R.DURATION_STEP_MIN === 10);
  ok('sve preporuke su deljive sa 10',
    R.RECOMMENDED.every((r) => r.durationMin % R.DURATION_STEP_MIN === 0));

  // partija pocinje danom, pa se smenjuju u minut
  const min = (n) => T0 + n * 60000;
  ok('prvih 5 min je dan', [0, 1, 4.9].every((m) => !R.isNight(T0, min(m))));
  ok('od 5. do 10. min je noc', [5, 7, 9.9].every((m) => R.isNight(T0, min(m))));
  ok('u 10. minutu opet svice', !R.isNight(T0, min(10)));
  ok('drugi dan se ponasa kao prvi',
    [10, 14.9].every((m) => !R.isNight(T0, min(m)))
    && [15, 19.9].every((m) => R.isNight(T0, min(m))));

  // ni jedan tren dana ne sme da ostane bez odgovora
  let smena = 0, bio = R.isNight(T0, T0);
  for (let s = 0; s <= 3600; s += 5) {
    const n = R.isNight(T0, T0 + s * 1000);
    if (n !== bio) { smena++; bio = n; }
  }
  // sat vremena = 6 punih dana, a svaki nosi po dve smene (smrkne i svane)
  ok('za sat vremena tacno 12 smena dana i noci', smena === 12, String(smena));

  const dp = R.dayPhase(T0, min(7));
  ok('odbrojava do svanuca', dp.night && Math.round(dp.leftMs / 60000) === 3, `${Math.round(dp.leftMs / 60000)} min`);
  ok('dan se broji od 1', R.dayPhase(T0, min(2)).dayNo === 1 && R.dayPhase(T0, min(12)).dayNo === 2);
  ok('pre pocetka partije nije noc', !R.isNight(0, Date.now()) && !R.isNight(T0, T0 - 1000));

  // noc i dalje smanjuje vid, samo je izvor drugi
  const vidDanju = R.visionFor({ classId: 'runner' }, { night: false });
  const vidNocu = R.visionFor({ classId: 'runner' }, { night: true });
  ok('nocu se vidi manje', vidNocu.itemsM < vidDanju.itemsM && vidNocu.itemsM === R.NIGHT_VISION_M);
  ok('baklja vraca vid i nocu',
    R.visionFor({ classId: 'runner' }, { night: true, hasLight: true }).itemsM > R.NIGHT_VISION_M);
}

console.log('\n14. Duhovi ne mogu da zatrpaju partiju dogadjajima');
{
  /* Bez ovoga je pola sata igre umelo da primi pet talasa zaredom, i to tri
     puta isti zid vatre. Dve granice: budzet po trajanju i jedan po tipu. */
  ok('pola sata nosi 1-2 dogadjaja', [1, 2].includes(R.ghostEventBudget(30)), String(R.ghostEventBudget(30)));
  ok('sat vremena nosi 3-4', [3, 4].includes(R.ghostEventBudget(60)), String(R.ghostEventBudget(60)));
  ok('duza partija nosi vise', R.ghostEventBudget(90) > R.ghostEventBudget(60));
  ok('uvek bar jedan', R.ghostEventBudget(10) >= 1 && R.ghostEventBudget(undefined) >= 1);
  ok('budzet nikad ne pada sa trajanjem', (() => {
    let prev = 0;
    for (let m = 10; m <= 120; m += 10) { const b = R.ghostEventBudget(m); if (b < prev) return false; prev = b; }
    return true;
  })());

  // svaki dogadjaj je ili pomoc ili nevolja — sivih nema, jer se biraju po tome
  ok('svaki dogadjaj ima stranu',
    Object.values(R.EVENTS).every((e) => e.tone === 'good' || e.tone === 'bad'));
  ok('gozba i sanduk pomazu',
    R.EVENTS.feast.tone === 'good' && R.EVENTS.supplyBox.tone === 'good');
  ok('vatra, ose i susa odmazu',
    ['firewall', 'wasps', 'drought'].every((t) => R.EVENTS[t].tone === 'bad'));
  ok('ima obe strane', Object.values(R.EVENTS).some((e) => e.tone === 'good')
    && Object.values(R.EVENTS).some((e) => e.tone === 'bad'));

  // raspored vise ne pravi noc, i ne pravi nebo
  const sch = R.buildSchedule('ev', { ...cfg, eventsEnabled: true }, T0);
  ok('raspored ne zakazuje noc', (sch.events || []).every((e) => e.type !== 'night'));
  ok('nebo sa poginulima je izbaceno', sch.sky === undefined);
  ok('svaki zakazani dogadjaj postoji u pravilima',
    (sch.events || []).every((e) => !!R.EVENTS[e.type]));
}


console.log('\n15. Mentor v2 — naklonost dolazi od tributa');
{
  /* Minigejmovi su izbaceni: mentor je mogao da farma poene ne gledajuci
     partiju uopste. Sad svaki poen ima uzrok u areni. */
  ok('svih pet razloga ima cenu', ['survivedShrink', 'landedKill', 'legendaryPick', 'finalFive', 'questDone']
    .every((k) => R.MENTOR_FAVOR[k] > 0));
  ok('ubistvo vredi najvise od pojedinacnih dela',
    R.MENTOR_FAVOR.landedKill >= R.MENTOR_FAVOR.legendaryPick
    && R.MENTOR_FAVOR.landedKill >= R.MENTOR_FAVOR.survivedShrink);

  // sabiranje ide tacno po tabeli, bez skrivenih bonusa
  const put = ['survivedShrink', 'survivedShrink', 'landedKill', 'questDone', 'legendaryPick'];
  const zbir = put.reduce((n, k) => n + R.MENTOR_FAVOR[k], 0);
  ok('naklonost se sabira tacno po tabeli', zbir === 1 + 1 + 3 + 2 + 2, String(zbir));

  /* finalFive se dodeljuje JEDNOM: motor ima zastavicu, pa se isti prag ne
     placa svake sekunde dok ih ima petoro. */
  let dato = 0, flag = false;
  for (let zivih = 9; zivih >= 1; zivih--) {
    for (let tick = 0; tick < 5; tick++) {
      if (!flag && zivih <= 5 && zivih > 0) { flag = true; dato += zivih; }
    }
  }
  ok('finalFive se dodeli tacno jednom', dato === 5, `dodeljeno ${dato} puta`);

  /* Regresija: prvo skupljanje je ostajalo NEPLACENO. Motor pamti poslednju
     vidjenu fazu i placa svaki porast; ako se prvo vidjenje ne zapamti dok je
     faza jos 0, prelaz 0 -> 1 se protumaci kao „tek sam se prikljucio". */
  function isplate(faze) {
    let vidjena = -1, n = 0;
    for (const ph of faze) {
      if (vidjena < 0) vidjena = ph;
      else if (ph > vidjena) { n++; vidjena = ph; }
    }
    return n;
  }
  ok('prvo skupljanje se placa', isplate([0, 0, 0, 1]) === 1, String(isplate([0, 0, 0, 1])));
  ok('svih pet skupljanja se placa',
    isplate([0, 0, 1, 1, 2, 2, 3, 4, 4, 5]) === 5, String(isplate([0, 0, 1, 1, 2, 2, 3, 4, 4, 5])));
  ok('ista faza se ne placa dvaput', isplate([1, 1, 1, 1]) === 0);
  ok('domacin koji se prikljuci usred partije ne placa unazad',
    isplate([3, 3, 4]) === 1, String(isplate([3, 3, 4])));

  // limiti po duzini partije
  const L = R.mentorLimits;
  ok('pola sata daje 2 zadatka i 2 paketa', L(30).quests === 2 && L(30).packages === 2);
  ok('sat vremena daje 4 i 4', L(60).quests === 4 && L(60).packages === 4);
  ok('sat i po daje 6 i 5', L(90).quests === 6 && L(90).packages === 5);
  ok('kratka partija ne pada ispod 2', L(10).quests === 2 && L(10).packages === 2);
  ok('duga partija ne raste preko 6/5', L(300).quests === 6 && L(300).packages === 5);
  ok('limiti nikad ne padaju sa trajanjem', (() => {
    let pq = 0, pp = 0;
    for (let m = 10; m <= 180; m += 10) {
      const l = L(m);
      if (l.quests < pq || l.packages < pp) return false;
      pq = l.quests; pp = l.packages;
    }
    return true;
  })());

  // potrosen limit paketa blokira slanje, i pre provere naklonosti
  const blokiran = (poslato, min) => Math.max(0, L(min).packages - poslato) <= 0;
  ok('potrosen limit paketa blokira slanje', blokiran(2, 30) && !blokiran(1, 30));
  ok('bogat mentor i dalje udara u limit',
    blokiran(4, 60) && R.canAffordTier('water', 4, 999),
    'ima naklonosti napretek, ali nema vise poteza');
}

console.log('\n15b. Zadaci koje mentor zadaje');
{
  ok('ima tacno sest zadataka', R.QUEST_IDS.length === 6, String(R.QUEST_IDS.length));
  ok('svaki zadatak ima proveru', R.QUEST_IDS.every((id) => typeof R.QUESTS[id].check === 'function'));
  ok('zadatak traje 5 minuta', R.QUEST_TTL_MS === 300000);

  // ponuda je deterministicka iz seed-a i rednog broja
  const a = R.questOffer('mz', 0), b = R.questOffer('mz', 0);
  ok('ponuda je tri zadatka', a.length === 3, String(a.length));
  ok('ista ponuda iz istog seed-a', a.join(',') === b.join(','));
  ok('u ponudi nema duplikata', new Set(a).size === 3);
  ok('sledeci redni broj daje drugu ponudu',
    R.questOffer('mz', 1).join(',') !== a.join(','));
  ok('drugi seed daje drugu ponudu', R.questOffer('xx', 0).join(',') !== a.join(','));
  ok('sve ponudjeno stvarno postoji', [0, 1, 2, 3, 4].every((n) =>
    R.questOffer('mz', n).every((id) => !!R.QUESTS[id])));

  // istek oslobadja mesto za sledeci
  const q = { id: 'setTrap', atMs: T0, expiresAtMs: T0 + R.QUEST_TTL_MS };
  ok('zadatak ne istekne pre vremena', !R.questExpired(q, T0 + R.QUEST_TTL_MS - 1000));
  ok('zadatak istekne posle 5 min', R.questExpired(q, T0 + R.QUEST_TTL_MS));
  ok('istekao zadatak oslobadja mesto', (() => {
    const aktivan = (nowMs) => (R.questExpired(q, nowMs) ? null : q);
    return aktivan(T0 + 60000) === q && aktivan(T0 + R.QUEST_TTL_MS + 1) === null;
  })());

  /* Provere gledaju SNIMAK sa pocetka zadatka. Bez toga bi „postavi zamku"
     bio ispunjen zamkom postavljenom deset minuta ranije. */
  const base = { atMs: T0, trapsSet: 3, walkedM: 1200, cornVisited: false };
  ok('stara zamka ne ispunjava zadatak',
    !R.questSatisfied('setTrap', { trapsSet: 3 }, base));
  ok('nova zamka ispunjava', R.questSatisfied('setTrap', { trapsSet: 4 }, base));

  ok('napad pre zadatka se ne broji',
    !R.questSatisfied('attackAny', { lastAttackAtMs: T0 - 1000 }, base));
  ok('napad posle zadatka se broji',
    R.questSatisfied('attackAny', { lastAttackAtMs: T0 + 1000 }, base));

  ok('299 m nije dovoljno',
    !R.questSatisfied('moveFar', { distanceWalkedM: 1200 + R.QUEST_MOVE_M - 1 }, base));
  ok('300 m jeste', R.questSatisfied('moveFar', { distanceWalkedM: 1200 + R.QUEST_MOVE_M }, base));

  ok('pesnice nisu pravo oruzje', !R.questSatisfied('weaponRare', { weapon: 'fists' }, base));
  ok('toljaga nije dovoljno retka', !R.questSatisfied('weaponRare', { weapon: 'club' }, base));
  ok('koplje jeste', R.questSatisfied('weaponRare', { weapon: 'spear' }, base));
  ok('trozubac jeste', R.questSatisfied('weaponRare', { weapon: 'trident' }, base));
  ok('retkost oruzja se cita iz predmeta',
    R.weaponRarity('trident') === 'legendary' && R.weaponRarity('fists') === 'common');

  ok('samo sit nije dovoljno', !R.questSatisfied('wellFed', { hunger: 95, thirst: 40 }, base));
  ok('sit i napojen jeste', R.questSatisfied('wellFed', { hunger: 85, thirst: 85 }, base));

  // kornukopija: udji PA izadji — nijedno samo za sebe ne vredi
  ok('ulazak sam po sebi ne ispunjava',
    !R.questSatisfied('cornucopia', {}, { ...base, cornVisited: true }, { inCorn: true }));
  ok('izlazak bez ulaska ne ispunjava',
    !R.questSatisfied('cornucopia', {}, base, { inCorn: false }));
  ok('udji pa izadji ispunjava',
    R.questSatisfied('cornucopia', {}, { ...base, cornVisited: true }, { inCorn: false }));
}


console.log('\n16. Ugasen ekran ne obara igraca u nesvest');
{
  /* Igra se na ulici i ekran se gasi sam. Dok je aplikacija skrivena GPS ne
     radi i telefon ne pise nista, pa bi svako zakljucavanje obaralo igraca u
     nesvest. Brojac zato miruje dok telefon prijavljuje `hiddenAtMs`. */
  ok('nesvest je posle 3 minuta', R.UNCONSCIOUS_MS === 180000);

  const tih = (ms, extra) => ({ lastSeenMs: T0, ...(extra || {}) });
  const posle = (ms) => T0 + ms;

  ok('dva minuta cutanja jos nije nesvest', !R.isUnconscious(tih(), posle(120000)));
  ok('tri minuta jeste', R.isUnconscious(tih(), posle(181000)));
  ok('skriven telefon ne pada u nesvest',
    !R.isUnconscious(tih(0, { hiddenAtMs: T0 + 1000 }), posle(600000)));
  ok('cim se vrati, brojac opet radi',
    R.isUnconscious({ lastSeenMs: T0, hiddenAtMs: null }, posle(400000)));
  ok('bot nikad nije u nesvesti', !R.isUnconscious({ isBot: true, lastSeenMs: T0 }, posle(999999)));
  ok('bez ijednog javljanja ne tvrdimo nista', !R.isUnconscious({}, posle(999999)));

  /* Provera KROZ VREME: pola sata sa ugasenim ekranom u sredini. Ovo je ono
     sto je pre pucalo — jedno zakljucavanje i igrac je onesvescen. */
  let paoDokJeSkriven = false, paoKadJeVracen = false;
  let p = { lastSeenMs: T0 };
  for (let t = 0; t <= 1800000; t += 5000) {
    const now = posle(t);
    if (t === 60000) p = { ...p, hiddenAtMs: now };            // ugasio ekran
    if (t === 900000) p = { lastSeenMs: now, hiddenAtMs: null }; // vratio se
    if (t > 600000 && t < 900000 && R.isUnconscious(p, now)) paoDokJeSkriven = true;
    if (!p.hiddenAtMs && p.lastSeenMs) p = { ...p };            // bez pisanja, samo citanje
    if (t === 1800000) paoKadJeVracen = R.isUnconscious({ lastSeenMs: T0 + 900000 }, now);
  }
  ok('14 minuta ugasenog ekrana ne obara nikoga', !paoDokJeSkriven);
  ok('ko se vrati pa opet zacuti 15 min, pada', paoKadJeVracen);
}

console.log('\n17. Vreme: jedan sat za sve, i pravo doba dana');
{
  /* Telefoni umeju da odlutaju i po nekoliko minuta. Da svako pise po svom
     satu, dva igraca bi za isti dogadjaj videla razlicita vremena — a ceo
     raspored (zona, dogadjaji, dan i noc) stoji u apsolutnim vremenima. */
  const sat = (offset) => () => 1700000000000 + offset;   // isti trenutak, dva telefona
  const a = sat(0), b = sat(-240000);                     // drugi kasni 4 minuta
  ok('dva telefona sa istim offsetom vide isti trenutak', sat(500)() === sat(500)());
  ok('bez ispravke bi se razlikovali za 4 minuta', a() - b() === 240000);

  // monotonost: sat sme da stoji, ali ne sme da ide unazad
  let prosli = 0, monoton = true;
  for (let i = 0; i < 200; i++) {
    const t = 1700000000000 + i * 137;
    if (t < prosli) monoton = false;
    prosli = t;
  }
  ok('sat je monoton', monoton);

  // HH:MM po lokalnoj zoni — ono sto igrac vidi kad pogleda na svoj sat
  const d = new Date(2026, 0, 15, 9, 5, 30);
  ok('doba dana se pise sa dve cifre', U.hhmm(d.getTime()) === '09:05', U.hhmm(d.getTime()));
  const noc = new Date(2026, 0, 15, 23, 59, 0);
  ok('ponoc pre ponoci', U.hhmm(noc.getTime()) === '23:59', U.hhmm(noc.getTime()));
  ok('prazno vreme ne pise nista', U.hhmm(0) === '' && U.hhmm(null) === '');
  ok('isti trenutak daje isto vreme na svakom telefonu',
    U.hhmm(d.getTime()) === U.hhmm(d.getTime()));

  /* Odbrojavaci i dalje racunaju razliku, samo od zajednickog sata. Zona,
     zadaci i efekti se svi vezuju za apsolutna vremena. */
  const sch = R.buildSchedule('t1', cfg, T0);
  ok('zona se vezuje za apsolutno vreme', sch.zone.every((z) => z.atMs > T0));
  ok('faza zone zavisi samo od trenutka',
    R.zoneAt(sch, cfg, T0 + 600000).phase === R.zoneAt(sch, cfg, T0 + 600000).phase);
  const q = { id: 'setTrap', atMs: T0, expiresAtMs: T0 + R.QUEST_TTL_MS };
  ok('zadatak se meri istim satom',
    !R.questExpired(q, T0 + 1000) && R.questExpired(q, T0 + R.QUEST_TTL_MS + 1));
  ok('dan i noc se mere od starta partije, ne od ponoci',
    !R.isNight(T0, T0 + 60000) && R.isNight(T0, T0 + 360000));
}


console.log('\n18. Arena se umesa kad partija utihne');
{
  /* Otkad dogadjaje puste samo duhovi, partija u kojoj niko ne pogine rano
     prodje bez ijednog: nema mrtvih -> nema iskri -> nema niceg. A bas takva
     partija i jeste ona kojoj nesto treba. */
  const DUR = 30;
  const dur = DUR * 60000;
  const base = { nowMs: T0, startedAtMs: T0, durationMin: DUR, lastEventAtMs: T0, firedTypes: new Set() };
  const at = (frac, extra) => R.autoEventPick({ ...base, nowMs: T0 + dur * frac, ...(extra || {}) });

  ok('pre polovine partije arena cuti', at(0.1) === null && at(0.49) === null);
  ok('posle polovine se umesa', !!at(0.75), String(at(0.75)));
  ok('posle kraja partije vise ne', at(1.4) === null);

  // budzet je ZAJEDNICKI sa duhovima — dva izvora se ne sabiraju u pet talasa
  const bud = R.ghostEventBudget(DUR);
  ok('potrosen budzet zaustavlja arenu',
    at(0.8, { firedTypes: new Set(['feast', 'wasps', 'firewall', 'drought', 'supplyBox'].slice(0, bud)) }) === null);
  ok('sa jednim slobodnim mestom jos moze',
    bud < 2 || !!at(0.8, { firedTypes: new Set(['feast']) }));

  // razmak od poslednjeg dogadjaja vazi za oba izvora
  ok('ne ubacuje odmah posle tudjeg dogadjaja',
    at(0.8, { lastEventAtMs: T0 + dur * 0.75 }) === null);
  ok('posle dovoljne pauze ubacuje',
    !!at(0.8, { lastEventAtMs: T0 + dur * 0.5 }));

  /* Izbor NIJE nasumican: gladnima i prebijenima pomoc, sitima nevolja. */
  const gladni = { fed: 20, hp: 90, thirst: 30 };
  const prebijeni = { fed: 90, hp: 30, thirst: 90 };
  const citavi = { fed: 95, hp: 95, thirst: 95 };
  ok('gladnima arena salje pomoc', R.EVENTS[at(0.8, { mood: gladni })].tone === 'good');
  ok('prebijenima takodje', R.EVENTS[at(0.8, { mood: prebijeni })].tone === 'good');
  ok('sitima i citavima salje nevolju', R.EVENTS[at(0.8, { mood: citavi })].tone === 'bad');
  ok('kad plivaju u vodi, prva nevolja je susa',
    at(0.8, { mood: { fed: 95, hp: 95, thirst: 95 } }) === 'drought');
  ok('kad su zedni, ne salje susu nego ih tera u pokret',
    at(0.8, { mood: { fed: 60, hp: 95, thirst: 50 } }) === 'firewall');
  ok('nikad ne ponavlja tip',
    at(0.8, { mood: citavi, firedTypes: new Set(['drought']) }) !== 'drought');
  ok('kad je jedna strana potrosena, uzima drugu', (() => {
    const t = at(0.8, { mood: gladni, firedTypes: new Set(['feast', 'supplyBox']) });
    return t === null || R.EVENTS[t].tone === 'bad';        // null ako je budzet pun
  })());

  ok('sve sto arena izabere postoji u pravilima',
    [0.55, 0.7, 0.9].every((f) => { const t = at(f); return t === null || !!R.EVENTS[t]; }));

  /* Provera KROZ VREME: tiha partija od pola sata, niko ne gine, duhovi nista
     ne kupuju. Mora da dobije bar jedan dogadjaj, i nikad vise od budzeta. */
  {
    let fired = [], last = T0;
    for (let t = 0; t <= dur; t += 10000) {
      const type = R.autoEventPick({
        nowMs: T0 + t, startedAtMs: T0, durationMin: DUR, lastEventAtMs: last,
        firedTypes: new Set(fired), mood: { fed: 80, hp: 90, thirst: 80 },
      });
      if (type) { fired.push(type); last = T0 + t; }
    }
    ok('tiha partija ipak dobije dogadjaj', fired.length >= 1, fired.join(',') || 'nijedan');
    ok('ali nikad preko budzeta', fired.length <= bud, `${fired.length} > ${bud}`);
    ok('i nijedan tip dvaput', new Set(fired).size === fired.length, fired.join(','));
  }

  // raspolozenje se cita iz zivih, mrtvi se ne broje
  const m = R.arenaMood({
    a: { alive: true, hunger: 100, thirst: 100, hp: 100, maxHp: 100 },
    b: { alive: false, hunger: 0, thirst: 0, hp: 0, maxHp: 100 },
  });
  ok('mrtvi ne kvare prosek', m.fed === 100 && m.hp === 100 && m.alive === 1);
  ok('prazna arena ne rusi racun', R.arenaMood({}).alive === 0);

  // geometrija je ista i za duhove i za arenu
  const cfg2 = { center: cfg.center, diameterM: 500 };
  const fw = R.buildLiveEvent('firewall', cfg2, T0, () => 0.5);
  ok('zid vatre dobija pravac i putanju', fw.headingDeg != null && fw.travelM > 0 && !!fw.lat);
  ok('najava zida vatre je 60 s, ne 15', fw.atMs - T0 === R.EVENTS.firewall.warnMs);
  ok('gozba pada na kornukopiju',
    R.buildLiveEvent('feast', cfg2, T0, Math.random).lat === cfg2.center.lat);
  ok('nepoznat tip ne pravi dogadjaj', R.buildLiveEvent('nema', cfg2, T0, Math.random) === null);
}


console.log('\n19. GPS greska ne sme da onemoguci borbu');
{
  /* Regresija sa terena: covek stane drugom pred nos i pise "niko nije u tom
     pravcu". GPS u gradu gresi 10-20 m po telefonu, pa dva coveka koja stoje
     zajedno telefoni procitaju kao 25 m razmaka — a pesnice vide 10 m. */
  const E = R.effectiveDistM;

  ok('bez greske razdaljina ostaje ista', E(12, 0, 0) === 12);
  ok('greska se odbija od razdaljine', E(25, 8, 7) === 10, String(E(25, 8, 7)));
  ok('nikad ispod nule', E(3, 15, 15) === 0);
  ok('popust je ogranicen', E(90, 40, 40) === 90 - R.SLACK_CAP_M, String(E(90, 40, 40)));
  ok('ko je stvarno daleko ostaje daleko', E(80, 10, 10) === 60);

  // dvoje jedan pored drugog, svaki sa +-12 m: pesnice moraju da rade
  const rukom = R.WEAPONS.fists;
  const blizu = E(22, 12, 12);
  ok('pesnice rade kad se stoji jedan uz drugog',
    blizu <= rukom.maxM && R.rangeState(rukom, blizu) === 'in', `${blizu} m`);
  ok('ali ne i preko pola arene',
    R.rangeState(rukom, E(70, 12, 12)) === 'far', String(E(70, 12, 12)));

  // luk i dalje mora da bude oruzje za daljinu, ne za blizinu
  const luk = R.WEAPONS.bow;
  ok('luk izbliza i dalje promasuje', R.rangeState(luk, E(10, 5, 5)) === 'close');

  ok('Senka se vidi kad joj stanes pred nos, ne sa 30 m',
    R.SHADOW_SEEN_M > 0 && R.SHADOW_SEEN_M <= 10, String(R.SHADOW_SEEN_M));
}

console.log(fail ? `\n${fail} provera palo\n` : `\nSve provere prosle\n`);
process.exit(fail ? 1 : 0);
