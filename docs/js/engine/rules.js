/* ═══════════════════════════════════════════════════════════════════════════
   PRAVILA IGRE — čista logika, bez mreže i bez DOM-a.

   Ključna ideja arhitekture bez servera: sve što je "slučajno" u partiji
   (raspored plena, startne pozicije, redosled i sadržaj događaja) izvodi se
   determinstički iz jednog broja — `seed`. Svi telefoni iz istog seed-a
   dobiju identičan svet, pa niko ne mora da im ga šalje.

   Isti fajl radi i u browseru (window.Rules) i u Node-u (require).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Rules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ───────────────────────────── geo ───────────────────────────── */
  const R_E = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  function haversine(a, b) {
    if (!a || !b) return Infinity;
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

  /* ─────────────────────── deterministički slučaj ─────────────────────── */
  function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
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

  /* ───────────────────────────── predmeti ───────────────────────────── */
  const ITEMS = [
    { id: 'knife',   type: 'weapon', rarity: 1, atk: 6 },
    { id: 'machete', type: 'weapon', rarity: 1, atk: 7 },
    { id: 'sickle',  type: 'weapon', rarity: 1, atk: 7 },
    { id: 'axe',     type: 'weapon', rarity: 2, atk: 10 },
    { id: 'spear',   type: 'weapon', rarity: 2, atk: 11 },
    { id: 'bow',     type: 'weapon', rarity: 3, atk: 14 },
    { id: 'trident', type: 'weapon', rarity: 3, atk: 15 },
    { id: 'guards',  type: 'armor',  rarity: 1, def: 5 },
    { id: 'helmet',  type: 'armor',  rarity: 1, def: 4 },
    { id: 'vest',    type: 'armor',  rarity: 2, def: 8 },
    { id: 'shield',  type: 'armor',  rarity: 3, def: 12 },
    { id: 'water',   type: 'supply', rarity: 1, hp: 10 },
    { id: 'food',    type: 'supply', rarity: 1, hp: 15 },
    { id: 'rope',    type: 'supply', rarity: 1, def: 3 },
    { id: 'torch',   type: 'supply', rarity: 2, vision: 60 },
    { id: 'medkit',  type: 'supply', rarity: 3, hp: 30 },
    { id: 'bandage',   type: 'use', rarity: 1, use: 'heal',   power: 25 },
    { id: 'adrenal',   type: 'use', rarity: 2, use: 'rage',   power: 2 },
    { id: 'trap',      type: 'use', rarity: 2, use: 'stun',   power: 1 },
    { id: 'camo',      type: 'use', rarity: 2, use: 'cloak',  power: 300 },
    { id: 'nightlock', type: 'use', rarity: 3, use: 'poison', power: 18 },
  ];
  const BY_ID = {};
  ITEMS.forEach((i) => { BY_ID[i.id] = i; });

  const WEIGHTS = {
    normal:     { 1: 70, 2: 25, 3: 5 },
    cornucopia: { 1: 25, 2: 45, 3: 30 },
    feast:      { 1: 0,  2: 40, 3: 60 },
  };
  function rollItem(rng, pool) {
    const w = WEIGHTS[pool] || WEIGHTS.normal;
    let r = rng() * (w[1] + w[2] + w[3]);
    let rarity = 1;
    for (const k of [1, 2, 3]) { if (r < w[k]) { rarity = k; break; } r -= w[k]; }
    const c = ITEMS.filter((i) => i.rarity === rarity);
    return c[Math.floor(rng() * c.length)];
  }
  function statsOf(items) {
    const s = { atk: 0, def: 0, hp: 0, vision: 0 };
    (items || []).forEach((id) => {
      const it = BY_ID[id];
      if (!it) return;
      s.atk += it.atk || 0; s.def += it.def || 0;
      s.hp += it.hp || 0; s.vision += it.vision || 0;
    });
    return s;
  }
  const maxHpOf = (items) => 100 + statsOf(items).hp;

  /* ───────────────────────────── podešavanja ───────────────────────────── */
  const DEFAULTS = {
    proximityM: 100, engageM: 15, lootReachM: 15, visionM: 150,
    deploySec: 180, lootCount: 24, lootMode: 'cornucopia',
    combatRounds: 5, finalRounds: 7, roundSec: 12,
    eventMinSec: 150, eventMaxSec: 300, shrink: true, finaleReachM: 30,
    combatCooldownSec: 45,
  };

  /* ─────────────────── raspored događaja (unapred izvučen) ─────────────────── */
  // Vraća niz {at, kind, ...} gde je `at` pomeraj u ms od početka partije.
  // Sve slučajnosti su ovde zapečaćene, da svi telefoni vide isti scenario.
  function genSchedule(seed, cfg) {
    const rng = rngFor(seed, 'schedule');
    const out = [];
    let t = cfg.deploySec * 1000 + (cfg.eventMinSec + rng() * 60) * 1000;
    let radius = cfg.radius0;
    const floor = Math.max(60, Math.round(cfg.radius0 * 0.3));

    for (let i = 0; i < 40 && t < 3 * 3600 * 1000; i++) {
      const pool = ['evac', 'evac', 'sponsor', 'sponsor', 'night', 'feast'];
      if (cfg.shrink && radius > floor) pool.push('shrink', 'shrink', 'shrink');
      const kind = pool[Math.floor(rng() * pool.length)];
      const ev = { i, at: Math.round(t), kind };

      if (kind === 'shrink') {
        radius = Math.max(floor, Math.round(radius * 0.78));
        ev.radius = radius;
      } else if (kind === 'evac') {
        const c = pointInCircle(rng, cfg.center, cfg.radius0 * 0.7);
        ev.lat = c.lat; ev.lng = c.lng;
        ev.radius = Math.round(Math.max(50, radius * 0.33));
        ev.activeAt = ev.at + 5 * 60 * 1000;
        ev.until = ev.at + 10 * 60 * 1000;
      } else if (kind === 'feast') {
        ev.n = 3 + Math.floor(rng() * 3);
      } else if (kind === 'sponsor') {
        ev.r = rng();
        ev.itemId = rollItem(rng, 'cornucopia').id;
      } else if (kind === 'night') {
        ev.until = ev.at + 3 * 60 * 1000;
      }
      out.push(ev);
      t += (cfg.eventMinSec + rng() * (cfg.eventMaxSec - cfg.eventMinSec)) * 1000;
    }
    return out;
  }

  /* ─────────────────── plen (u potpunosti determinističan) ─────────────────── */
  // U bazi se čuva SAMO ko je šta uzeo. Sam raspored svako izračuna sam.
  function genLoot(seed, cfg, schedule) {
    const rng = rngFor(seed, 'loot');
    const out = [];
    const n = cfg.lootCount;
    const cornN = cfg.lootMode === 'cornucopia' ? Math.round(n * 0.4) : 0;

    for (let i = 0; i < cornN; i++) {
      const p = pointInCircle(rng, cfg.center, Math.max(12, cfg.radius0 * 0.06));
      const it = rollItem(rng, 'cornucopia');
      out.push({ id: 'c' + i, lat: p.lat, lng: p.lng, itemId: it.id, rarity: it.rarity, isCorn: true, availableAt: 0 });
    }
    for (let i = 0; i < n - cornN; i++) {
      const p = pointInCircle(rng, cfg.center, cfg.radius0 * 0.95, cfg.radius0 * 0.12);
      const it = rollItem(rng, 'normal');
      out.push({ id: 'n' + i, lat: p.lat, lng: p.lng, itemId: it.id, rarity: it.rarity, isCorn: false, availableAt: 0 });
    }
    // Gozbe: predmeti postoje od početka, samo se "pojave" u trenutku događaja.
    (schedule || []).filter((e) => e.kind === 'feast').forEach((e) => {
      const r2 = rngFor(seed, 'feast', e.i);
      for (let k = 0; k < e.n; k++) {
        const p = pointInCircle(r2, cfg.center, Math.max(10, cfg.radius0 * 0.05));
        const it = rollItem(r2, 'feast');
        out.push({ id: `f${e.i}_${k}`, lat: p.lat, lng: p.lng, itemId: it.id, rarity: it.rarity, isCorn: true, feast: true, availableAt: e.at });
      }
    });
    return out;
  }

  // Startne pozicije: prsten oko kornukopije, ravnomerno raspoređen.
  function genSpawns(seed, roster, cfg) {
    const rng = rngFor(seed, 'spawn');
    const offset = rng() * 360;
    const ringR = Math.max(40, cfg.radius0 * 0.72);
    const out = {};
    roster.forEach((pid, i) => {
      const b = offset + (360 / roster.length) * i;
      out[pid] = destPoint(cfg.center, b, ringR * (0.9 + rngFor(seed, 'spawn', pid)() * 0.2));
    });
    return out;
  }

  /* ─────────────── stanje sveta izvedeno iz vremena (bez baze) ─────────────── */
  function arenaRadiusAt(cfg, schedule, elapsed) {
    let r = cfg.radius0;
    for (const e of schedule) {
      if (e.kind === 'shrink' && elapsed >= e.at) r = e.radius;
    }
    return r;
  }
  function hazardsAt(schedule, elapsed) {
    return schedule
      .filter((e) => e.kind === 'evac' && elapsed >= e.at && elapsed < e.until + 30000)
      .map((e) => ({
        id: 'h' + e.i,
        center: { lat: e.lat, lng: e.lng },
        radius: e.radius,
        activeAt: e.activeAt,
        until: e.until,
      }));
  }
  function nightUntilAt(schedule, elapsed) {
    for (const e of schedule) {
      if (e.kind === 'night' && elapsed >= e.at && elapsed < e.until) return e.until;
    }
    return 0;
  }
  function phaseAt(cfg, elapsed, aliveCount, ended) {
    if (ended || aliveCount <= 1) return 'ended';
    if (elapsed < cfg.deploySec * 1000) return 'deploy';
    if (aliveCount === 2) return 'finale';
    return 'active';
  }

  // Objave koje se ne pišu u bazu — svi ih izračunaju iz rasporeda.
  function scheduleFeed(schedule, startedAt, elapsed) {
    const out = [];
    for (const e of schedule) {
      if (elapsed < e.at) continue;
      const ts = startedAt + e.at;
      if (e.kind === 'shrink') out.push({ id: 'e' + e.i, ts, sev: 'major',
        sr: `⚠️ Arena se skuplja! Novi prečnik: ${e.radius * 2} m. Van granice gubiš život.`,
        en: `⚠️ The arena is shrinking! New diameter: ${e.radius * 2} m. Outside the line you lose health.` });
      else if (e.kind === 'evac') out.push({ id: 'e' + e.i, ts, sev: 'major',
        sr: '⚠️ Sektor je označen. Imate 5 minuta da izađete iz obeležene zone ili umirete.',
        en: '⚠️ A sector has been marked. You have 5 minutes to leave the marked zone or die.' });
      else if (e.kind === 'feast') out.push({ id: 'e' + e.i, ts, sev: 'major',
        sr: `🎁 GOZBA! U kornukopiji je ostavljeno ${e.n} dragocenih predmeta. Vidljivi su svima.`,
        en: `🎁 FEAST! ${e.n} valuable items were left at the cornucopia. Visible to everyone.` });
      else if (e.kind === 'night') out.push({ id: 'e' + e.i, ts, sev: 'warn',
        sr: '🌑 Pada mrak. Vidljivost je prepolovljena narednih 3 minuta.',
        en: '🌑 Night falls. Vision halved for the next 3 minutes.' });
      else if (e.kind === 'sponsor') out.push({ id: 'e' + e.i, ts, sev: 'info', sponsor: true });
    }
    return out;
  }

  // Kome je stigao sponzorski paket (izvedeno, isto kod svih).
  function sponsorTarget(ev, aliveIdsSorted) {
    if (!aliveIdsSorted.length) return null;
    return aliveIdsSorted[Math.floor(ev.r * aliveIdsSorted.length)];
  }

  /* ───────────────────────────── borba ───────────────────────────── */
  const MOVES = ['attack', 'block', 'feint'];
  const BEATS = { attack: 'feint', feint: 'block', block: 'attack' };

  function autoMove(cid, round, pid) {
    return MOVES[Math.floor(rngFor(cid, round, pid)() * 3)];
  }

  /**
   * Presuđuje jednu rundu. Čista funkcija — oba telefona dobiju isti rezultat,
   * pa nije bitno ko je prvi upisao.
   * c: { id, ids:[a,b], hp:{}, maxHp:{}, st:{}, round, maxRounds, isFinal }
   * moves: { pid: {kind:'move',move} | {kind:'item',itemId} }
   * stats: { pid: {atk,def} }
   * Vraća { hp, st, line, over, winnerId, loserId }
   */
  function resolveRound(c, moves, stats) {
    const [ia, ib] = c.ids;
    const hp = Object.assign({}, c.hp);
    // Baza ume da izostavi prazne objekte, pa se ne oslanjamo da statusi postoje.
    const st0 = { [ia]: (c.st && c.st[ia]) || {}, [ib]: (c.st && c.st[ib]) || {} };
    const st = { [ia]: Object.assign({}, st0[ia]), [ib]: Object.assign({}, st0[ib]) };
    const pick = (id) => moves[id] || { kind: 'move', move: autoMove(c.id, c.round, id) };
    const ma = pick(ia), mb = pick(ib);
    const line = { round: c.round, a: ma, b: mb, dmg: { [ia]: 0, [ib]: 0 }, note: null };

    const applyItem = (self, other, m) => {
      if (m.kind !== 'item') return;
      const it = BY_ID[m.itemId];
      if (!it) return;
      if (it.use === 'heal') hp[self] = Math.min(c.maxHp[self], hp[self] + it.power);
      if (it.use === 'rage') st[self].rage = 2;
      if (it.use === 'stun') st[other].stun = 1;
      if (it.use === 'poison') st[other].poison = 3;
      if (it.use === 'cloak') line.cloak = self;
    };
    applyItem(ia, ib, ma);
    applyItem(ib, ia, mb);

    const stA = (st0[ia].stun || 0) > 0, stB = (st0[ib].stun || 0) > 0;
    const useA = ma.kind === 'item', useB = mb.kind === 'item';

    let winner = null, mult = 1;
    if (stA && !stB) winner = ib;
    else if (stB && !stA) winner = ia;
    else if (stA && stB) winner = null;
    else if (useA && useB) { winner = null; line.note = 'both_item'; }
    else if (useA) { winner = ib; mult = 0.5; }
    else if (useB) { winner = ia; mult = 0.5; }
    else if (ma.move === mb.move) { winner = null; line.note = 'clash'; }
    else winner = BEATS[ma.move] === mb.move ? ia : ib;

    if (winner) {
      const lose = winner === ia ? ib : ia;
      const base = c.isFinal ? 20 : 13;
      let d = base + (stats[winner].atk || 0) * 0.9 - (stats[lose].def || 0) * 0.55;
      if ((st0[winner].rage || 0) > 0) d *= 1.5;
      d = Math.max(4, Math.round(d * mult));
      hp[lose] = Math.max(0, hp[lose] - d);
      line.dmg[lose] = d;
    } else if (!useA && !useB && !stA && !stB) {
      const chip = c.isFinal ? 6 : 4;
      hp[ia] = Math.max(0, hp[ia] - chip);
      hp[ib] = Math.max(0, hp[ib] - chip);
      line.dmg[ia] = chip; line.dmg[ib] = chip;
    }

    for (const id of c.ids) {
      if ((st[id].poison || 0) > 0) {
        hp[id] = Math.max(0, hp[id] - 6);
        line.dmg[id] = (line.dmg[id] || 0) + 6;
        st[id].poison--;
      }
      if ((st[id].rage || 0) > 0) st[id].rage--;
      if ((st[id].stun || 0) > 0) st[id].stun--;
    }
    line.hp = Object.assign({}, hp);

    let over = false, winnerId = null, loserId = null, extend = 0;
    const deadA = hp[ia] <= 0, deadB = hp[ib] <= 0;
    if (deadA || deadB) {
      over = true;
      if (!(deadA && deadB)) { winnerId = deadA ? ib : ia; loserId = deadA ? ia : ib; }
    } else if (c.round >= c.maxRounds) {
      const pa = hp[ia] / c.maxHp[ia], pb = hp[ib] / c.maxHp[ib];
      if (Math.abs(pa - pb) < 0.02) {
        if (c.isFinal) extend = 3;      // finale mora da ima pobednika
        else over = true;               // obična borba: obojica prežive
      } else {
        over = true;
        winnerId = pa > pb ? ia : ib;
        loserId = pa > pb ? ib : ia;
      }
    }
    return { hp, st, line, over, winnerId, loserId, extend };
  }

  /* ─────────────────── izazovi za podizanje predmeta ─────────────────── */
  function challengeFor(rarity, rng) {
    const kinds = { 1: ['tap', 'slider'], 2: ['slider', 'sequence'], 3: ['sequence', 'hold'] };
    const pool = kinds[rarity] || kinds[1];
    return pool[Math.floor((rng || Math.random)() * pool.length)];
  }

  return {
    R_E, haversine, bearing, destPoint, pointInCircle,
    hash32, mulberry32, rngFor,
    ITEMS, BY_ID, rollItem, statsOf, maxHpOf, DEFAULTS,
    genSchedule, genLoot, genSpawns,
    arenaRadiusAt, hazardsAt, nightUntilAt, phaseAt, scheduleFeed, sponsorTarget,
    MOVES, BEATS, autoMove, resolveRound, challengeFor,
  };
});
