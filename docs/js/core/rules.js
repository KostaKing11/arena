/* ═══════════════════════════════════════════════════════════════════════════
   RULES — sva pravila igre kao čista logika. Bez mreže, bez DOM-a.

   Ovo je jedini izvor istine: i telefoni i testovi računaju iz ovog fajla.
   Sve što je slučajno generiše se JEDNOM na startu iz `seed`-a i upisuje u
   `schedule` sa apsolutnim vremenima (§0.1), pa svi vide isti scenario.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(
    typeof require === 'function' ? require('./util.js') : root.U);
  else root.R = factory(root.U);
})(typeof self !== 'undefined' ? self : this, function (U) {
  'use strict';

  /* ═══════════════════ 5. KLASE ═══════════════════ */
  const CLASSES = {
    archer:   { id: 'archer',   weapon: 'bow',     maxHp: 100, playerVisionM: 40, itemVisionM: 15 },
    shadow:   { id: 'shadow',   weapon: 'knife',   maxHp: 100, invisible: true, blindToMap: true },
    strong:   { id: 'strong',   weapon: 'axe',     maxHp: 130, zoneDamageMul: 0.5, alwaysVisible: true },
    gatherer: { id: 'gatherer', weapon: 'club',    maxHp: 100, survivalMul: 0.6, dirtyWaterSafe: true, itemVisionM: 25 },
    medic:    { id: 'medic',    weapon: 'blowgun', maxHp: 80,  healMul: 1.5, canHealAlly: true },
    trapper:  { id: 'trapper',  weapon: 'net',     maxHp: 100, trapCapacityMul: 2, trapPowerMul: 1.5, seesTrapsM: 10, cannotFlee: true },
    runner:   { id: 'runner',   weapon: 'sling',   maxHp: 85,  fleeSeconds: 10, freeHitOnFlee: false, extraSlots: 1 },
    hunter:   { id: 'hunter',   weapon: 'spear',   maxHp: 100 },
    fisher:   { id: 'fisher',   weapon: 'trident', maxHp: 90 },
  };
  const CLASS_IDS = Object.keys(CLASSES);

  // Modifikator štete po razdaljini, iz tabele u §5.
  function classRangeMod(classId, distance) {
    switch (classId) {
      case 'archer':   return distance <= 1 ? -8 : 0;
      case 'hunter':   return distance === 0 ? -6 : (distance >= 1 && distance <= 3 ? 6 : 0);
      case 'fisher':   return 6;                       // najširi domet, +6 svuda u svom dometu
      case 'gatherer': return -5;
      default:         return 0;
    }
  }

  /* ═══════════════════ 6. ORUŽJA ═══════════════════ */
  const WEAPONS = {
    fists:   { id: 'fists',   dmg: 8,  min: 0, max: 1, cls: null },
    club:    { id: 'club',    dmg: 12, min: 0, max: 1, cls: 'gatherer' },
    sling:   { id: 'sling',   dmg: 12, min: 2, max: 4, cls: 'runner' },
    net:     { id: 'net',     dmg: 10, min: 0, max: 2, cls: 'trapper' },
    spear:   { id: 'spear',   dmg: 18, min: 1, max: 3, cls: 'hunter' },
    axe:     { id: 'axe',     dmg: 20, min: 0, max: 2, cls: 'strong' },
    bow:     { id: 'bow',     dmg: 22, min: 3, max: 5, cls: 'archer', ammo: 'arrow' },
    knife:   { id: 'knife',   dmg: 24, min: 0, max: 1, cls: 'shadow' },
    trident: { id: 'trident', dmg: 26, min: 0, max: 3, cls: 'fisher' },
    blowgun: { id: 'blowgun', dmg: 10, min: 2, max: 4, cls: 'medic', poison: true },
  };
  const OWN_WEAPON_BONUS = 8;
  const inRange = (w, d) => d >= w.min && d <= w.max;

  /* ═══════════════════ 8. SPECIJALI ═══════════════════ */
  const SPECIALS = {
    shadow:   { id: 'stab',      dmg: 35, blockedDmg: 12 },
    fisher:   { id: 'throw',     dmg: 45, anyRange: true, losesWeapon: true },
    strong:   { id: 'smash',     dmg: 28, piercesBlock: true },
    archer:   { id: 'aimedShot', dmg: 40, chargeRounds: 2 },
    trapper:  { id: 'entangle',  lockRounds: 3 },
    hunter:   { id: 'breakthrough', dmg: 30, push: 1 },
    runner:   { id: 'vanish',    guaranteedFlee: true },
    gatherer: { id: 'daze',      skipsOpponentTurn: true },
    medic:    { id: 'poison',    dot: 6, afterFightMs: 120000 },
  };

  /* ═══════════════════ 12. PREDMETI ═══════════════════ */
  const RARITY = {
    common:    { i: 0, stack: 3, pickMs: 0,     pick: 'tap' },
    uncommon:  { i: 1, stack: 2, pickMs: 3000,  pick: 'hold' },
    rare:      { i: 2, stack: 1, pickMs: 6000,  pick: 'hold', cancelOnMove: true },
    epic:      { i: 3, stack: 1, pickMs: 0,     pick: 'challenge' },
    legendary: { i: 4, stack: 1, pickMs: 10000, pick: 'hold', cancelOnMove: true, announce: true },
  };

  // pool: 'scatter' | 'corn' | 'both'  (§13 — šta gde može da se pojavi)
  const ITEMS = {
    // — hrana —
    // Osnovne namirnice stoje i u kornukopiji: tabela retkosti joj daje 20%
    // običnih predmeta, pa mora da ima šta da se izvuče.
    berries:    { type: 'food',  rarity: 'common',    pool: 'both',    hunger: 20, poisonChance: 0.05, poisonHp: 10 },
    mushrooms:  { type: 'food',  rarity: 'uncommon',  pool: 'scatter', hunger: 30, poisonChance: 0.15, poisonHp: 20 },
    bread:      { type: 'food',  rarity: 'uncommon',  pool: 'both',    hunger: 35 },
    driedMeat:  { type: 'food',  rarity: 'rare',      pool: 'both',    hunger: 55 },
    feastMeal:  { type: 'food',  rarity: 'legendary', pool: 'corn',    hunger: 100 },
    supplyBelt: { type: 'pack',  rarity: 'epic',      pool: 'corn',    maxHunger: 30 },
    // — piće —
    dirtyWater: { type: 'drink', rarity: 'common',    pool: 'both',    thirst: 25, hp: -8 },
    waterBottle:{ type: 'drink', rarity: 'uncommon',  pool: 'both',    thirst: 40 },
    juice:      { type: 'drink', rarity: 'uncommon',  pool: 'both',    thirst: 30, hunger: 15 },
    springWater:{ type: 'drink', rarity: 'rare',      pool: 'both',    thirst: 70 },
    thermos:    { type: 'pack',  rarity: 'epic',      pool: 'corn',    maxThirst: 30 },
    // — lečenje —
    herbs:      { type: 'heal',  rarity: 'common',    pool: 'both',    heal: 15, medicDouble: true },
    bandage:    { type: 'heal',  rarity: 'uncommon',  pool: 'both',    heal: 25 },
    antidote:   { type: 'heal',  rarity: 'rare',      pool: 'both',    curesPoison: true },
    medkit:     { type: 'heal',  rarity: 'epic',      pool: 'corn',    heal: 60 },
    // Jedini legendarni predmet koji se nađe i u divljini — tabela rasutog
    // plena ima 1% legendarnih, a veliki ranac je po specifikaciji samo u
    // kornukopiji, pa taj procenat pripada masti.
    salve:      { type: 'heal',  rarity: 'legendary', pool: 'both',    healFull: true },
    // — rančevi —
    smallBag:   { type: 'pack',  rarity: 'rare',      pool: 'both',    slots: 5 },
    backpack:   { type: 'pack',  rarity: 'epic',      pool: 'corn',    slots: 7 },
    bigBackpack:{ type: 'pack',  rarity: 'legendary', pool: 'corn',    slots: 9 },
    // — zamke —
    trapBasic:  { type: 'trap',  rarity: 'uncommon',  pool: 'scatter', trap: 'basic',   hp: -18 },
    trapAlarm:  { type: 'trap',  rarity: 'rare',      pool: 'both',    trap: 'alarm',   revealMs: 8000 },
    trapTracker:{ type: 'trap',  rarity: 'epic',      pool: 'both',    trap: 'tracker', trackMs: 300000 },
    trapNet:    { type: 'trap',  rarity: 'epic',      pool: 'both',    trap: 'net',     blocksFlee: true },
    // — alat —
    torch:      { type: 'tool',  rarity: 'common',    pool: 'both',    light: 480000 },
    bigTorch:   { type: 'tool',  rarity: 'rare',      pool: 'both',    light: 900000, lightBonusM: 6 },
    binoculars: { type: 'tool',  rarity: 'rare',      pool: 'both',    visionM: 20 },
    smokeBomb:  { type: 'tool',  rarity: 'rare',      pool: 'both',    hideTrackersMs: 180000 },
    ragePotion: { type: 'tool',  rarity: 'epic',      pool: 'both',    rageFirstRound: true },
    camoCloak:  { type: 'tool',  rarity: 'epic',      pool: 'corn',    hideAllMs: 300000 },
    quiver:     { type: 'tool',  rarity: 'rare',      pool: 'both',    quiver: true },
    arrows:     { type: 'ammo',  rarity: 'uncommon',  pool: 'scatter', arrows: 3 },
    // — oružja kao predmeti —
    wClub:    { type: 'weapon', rarity: 'common',    pool: 'scatter', weapon: 'club' },
    wSling:   { type: 'weapon', rarity: 'common',    pool: 'scatter', weapon: 'sling' },
    wNet:     { type: 'weapon', rarity: 'uncommon',  pool: 'both',    weapon: 'net' },
    wSpear:   { type: 'weapon', rarity: 'rare',      pool: 'corn',    weapon: 'spear' },
    wAxe:     { type: 'weapon', rarity: 'rare',      pool: 'corn',    weapon: 'axe' },
    wBlowgun: { type: 'weapon', rarity: 'rare',      pool: 'corn',    weapon: 'blowgun' },
    wBow:     { type: 'weapon', rarity: 'epic',      pool: 'corn',    weapon: 'bow' },
    wKnife:   { type: 'weapon', rarity: 'epic',      pool: 'corn',    weapon: 'knife' },
    wTrident: { type: 'weapon', rarity: 'legendary', pool: 'corn',    weapon: 'trident' },
  };
  const ITEM_IDS = Object.keys(ITEMS);
  const isRenewable = (id) => ITEMS[id] && (ITEMS[id].type === 'food' || ITEMS[id].type === 'drink');

  /* ═══════════════════ 2. PREPORUKE ZA LOBI ═══════════════════ */
  const RECOMMENDED = [
    { max: 6,  diameterM: 350,  durationMin: 30 },
    { max: 12, diameterM: 500,  durationMin: 45 },
    { max: 20, diameterM: 700,  durationMin: 60 },
    { max: 32, diameterM: 900,  durationMin: 60 },
    { max: 48, diameterM: 1200, durationMin: 90 },
  ];
  const recommendFor = (n) => RECOMMENDED.find((r) => n <= r.max) || RECOMMENDED[RECOMMENDED.length - 1];
  const MIN_PLAYERS = 3, MAX_PLAYERS = 48;

  // §10 — koliko igrača staje u savez
  function maxAllianceSize(playerCount) {
    if (playerCount <= 8) return 2;
    if (playerCount <= 16) return 3;
    if (playerCount <= 32) return 4;
    return 5;
  }

  /* ═══════════════════ 5. ŠPIL KLASA ═══════════════════
     Meša se svih 9, deli redom, ponovo meša tek kad se isprazni — tako 4 igrača
     dobiju 4 različite, a 48 po ~5 od svake.                                  */
  function dealClasses(seed, playerIds) {
    const rng = U.rngFor(seed, 'classes');
    const out = {};
    let deck = [];
    for (const pid of playerIds) {
      if (!deck.length) deck = U.shuffle(rng, CLASS_IDS);
      out[pid] = deck.pop();
    }
    return out;
  }
  // Sastav arene za feed, bez imena (§5)
  function classCensus(assign) {
    const c = {};
    for (const k of Object.values(assign)) c[k] = (c[k] || 0) + 1;
    return c;
  }

  /* ═══════════════════ 14. ZONA ═══════════════════ */
  const ZONE_PHASES = [
    { pct: 0.65, dmg: 2,  drift: 0.35 },
    { pct: 0.42, dmg: 4,  drift: 0.5 },
    { pct: 0.25, dmg: 7,  drift: 0.7 },
    { pct: 0.12, dmg: 12, drift: 1.0 },
    { fixedRadiusM: 20, dmg: 20, atCenter: true },   // prečnik 40 m na kornukopiji
  ];
  const ZONE_WARN_MS = 30000;

  /* ═══════════════════ 15. EVENTOVI ═══════════════════ */
  const EVENTS = {
    firewall: { warnMs: 60000, durMs: 180000, widthM: 25, spark: 8 },
    wasps:    { warnMs: 20000, durMs: 300000, radiusM: 60, dmgPer10s: 3, spark: 5 },
    feast:    { warnMs: 120000, durMs: 0, items: 6, spark: 6 },
    drought:  { warnMs: 20000, durMs: 300000, thirstMul: 2, spark: 3 },
    night:    { warnMs: 20000, durMs: 360000, visionM: 8, spark: 3 },
    supplyBox:{ warnMs: 15000, durMs: 0, spark: 4 },
  };
  const SPARK_COSTS = Object.fromEntries(Object.entries(EVENTS).map(([k, v]) => [k, v.spark]));
  const GM_COOLDOWN_MS = 240000;

  /* ═══════════════════ 11. GLAD, ŽEĐ, HP ═══════════════════ */
  const SURVIVAL = {
    thirstSecPerPoint: 7,
    hungerSecPerPoint: 11,
    thirstHpSec: 20, thirstHpAmount: 2,
    hungerHpSec: 30, hungerHpAmount: 2,
    lowWarn: 25,
    baseMax: 100, capMax: 150,
  };

  /**
   * Primeni protok vremena na igrača (§0.5 — iz proteklog vremena, ne tajmerom).
   * Vraća SAMO promenjena polja, da svaki telefon piše minimum u bazu.
   */
  function survivalTick(p, cls, elapsedMs, ctx) {
    if (!p || p.alive === false || elapsedMs <= 0) return null;
    const sec = Math.min(elapsedMs, 6 * 3600 * 1000) / 1000;
    const mul = (cls && cls.survivalMul) || 1;
    const thirstMul = ctx && ctx.drought ? 2 : 1;

    const out = {};
    let hunger = p.hunger != null ? p.hunger : 100;
    let thirst = p.thirst != null ? p.thirst : 100;
    let hp = p.hp;

    if (!ctx || !ctx.frozen) {
      thirst = Math.max(0, thirst - (sec / SURVIVAL.thirstSecPerPoint) * mul * thirstMul);
      hunger = Math.max(0, hunger - (sec / SURVIVAL.hungerSecPerPoint) * mul);
      if (thirst <= 0) hp -= (sec / SURVIVAL.thirstHpSec) * SURVIVAL.thirstHpAmount;
      if (hunger <= 0) hp -= (sec / SURVIVAL.hungerHpSec) * SURVIVAL.hungerHpAmount;
    }

    // Šteta od zone — Snagator trpi upola (§5)
    if (ctx && ctx.outsideZone && ctx.zoneDmgPer10s > 0 && !ctx.frozen) {
      const zm = (cls && cls.zoneDamageMul) || 1;
      hp -= (sec / 10) * ctx.zoneDmgPer10s * zm;
    }
    // Traker ose (§15)
    if (ctx && ctx.inWasps && !ctx.frozen) hp -= (sec / 10) * EVENTS.wasps.dmgPer10s;
    // Otrov od duvaljke traje i 2 min posle borbe (§8)
    if (ctx && ctx.poisonedUntilMs && ctx.nowMs < ctx.poisonedUntilMs && !ctx.frozen) {
      hp -= (sec / 10) * 3;
    }

    out.hunger = hunger; out.thirst = thirst; out.hp = Math.max(0, hp);
    out.lastTickMs = (ctx && ctx.nowMs) || Date.now();
    return out;
  }

  /* ═══════════════════ 0/22. RASPORED ═══════════════════
     Zona, eventovi i nebo se izračunaju jednom, sa apsolutnim vremenima.     */
  function buildSchedule(seed, cfg, startedAtMs) {
    const rng = U.rngFor(seed, 'schedule');
    const durMs = cfg.durationMin * 60000;
    const center = cfg.center;
    const r0 = cfg.diameterM / 2;

    /* — zona — */
    const zone = [];
    // Faze počinju posle pripreme i raspoređene su kroz trajanje igre.
    const at = [0.18, 0.36, 0.54, 0.72, 0.88];
    let prevR = r0, prevC = center;
    ZONE_PHASES.forEach((ph, i) => {
      const radiusM = ph.fixedRadiusM != null ? ph.fixedRadiusM : r0 * ph.pct;
      let c;
      if (ph.atCenter) c = center;
      else {
        // nasumičan pomak unutar prethodnog kruga, pa povučen ka pravom centru
        const room = Math.max(0, prevR - radiusM);
        const cand = U.pointInCircle(rng, prevC, room * 0.8);
        c = U.lerpPoint(cand, center, ph.drift);
      }
      const atMs = startedAtMs + Math.round(durMs * at[i]);
      const shrinkMs = Math.max(20000, Math.round(durMs * 0.06));
      zone.push({
        i, radiusM: Math.round(radiusM), centerLat: c.lat, centerLng: c.lng,
        dmgPer10s: ph.dmg,
        warnAtMs: atMs - shrinkMs - ZONE_WARN_MS,
        startMs: atMs - shrinkMs,
        atMs,
      });
      prevR = radiusM; prevC = c;
    });

    /* — eventovi — */
    const events = [];
    if (cfg.eventsEnabled) {
      const types = ['wasps', 'feast', 'drought', 'night', 'firewall'];
      const order = U.shuffle(rng, types);
      const n = Math.max(2, Math.min(order.length, Math.round(cfg.durationMin / 15)));
      for (let k = 0; k < n; k++) {
        const type = order[k];
        const meta = EVENTS[type];
        const atMs = startedAtMs + Math.round(durMs * (0.22 + 0.62 * (k + rng() * 0.6) / n));
        const e = { id: 'ev' + k, type, atMs, warnMs: meta.warnMs, endMs: atMs + meta.durMs };
        if (type === 'firewall') {
          const head = rng() * 360;
          e.headingDeg = head;
          const startC = U.destPoint(center, (head + 180) % 360, r0 * 1.15);
          e.lat = startC.lat; e.lng = startC.lng;
          e.radiusM = meta.widthM;
          e.travelM = r0 * 2.3;
        } else if (type === 'wasps') {
          const c = U.pointInCircle(rng, center, r0 * 0.7);
          e.lat = c.lat; e.lng = c.lng; e.radiusM = meta.radiusM;
        } else if (type === 'feast') {
          e.lat = center.lat; e.lng = center.lng; e.radiusM = 40;
        }
        events.push(e);
      }
      events.sort((a, b) => a.atMs - b.atMs);
    }

    /* — nebo na svakih 15 min (§16) — */
    const sky = [];
    for (let t = 15 * 60000; t < durMs; t += 15 * 60000) sky.push({ atMs: startedAtMs + t });

    return { zone, events, sky };
  }

  /** Stanje zone u trenutku `now` — sa postepenim skupljanjem (§14). */
  function zoneAt(schedule, cfg, nowMs) {
    const z = (schedule && schedule.zone) || [];
    const r0 = cfg.diameterM / 2;
    let cur = { radiusM: r0, center: cfg.center, dmgPer10s: 0, phase: 0 };
    let next = null, shrinking = false;

    for (let i = 0; i < z.length; i++) {
      const ph = z[i];
      const prevR = i === 0 ? r0 : z[i - 1].radiusM;
      const prevC = i === 0 ? cfg.center : { lat: z[i - 1].centerLat, lng: z[i - 1].centerLng };
      const target = { lat: ph.centerLat, lng: ph.centerLng };
      if (nowMs >= ph.atMs) {
        cur = { radiusM: ph.radiusM, center: target, dmgPer10s: ph.dmgPer10s, phase: i + 1 };
      } else if (nowMs >= ph.startMs) {
        const t = (nowMs - ph.startMs) / Math.max(1, ph.atMs - ph.startMs);
        cur = {
          radiusM: U.lerp(prevR, ph.radiusM, t),
          center: U.lerpPoint(prevC, target, t),
          dmgPer10s: i === 0 ? 0 : z[i - 1].dmgPer10s,
          phase: i,
        };
        shrinking = true;
        next = ph;
        break;
      } else { next = ph; break; }
    }
    return { ...cur, next, shrinking, warn: next && nowMs >= next.warnAtMs && nowMs < next.startMs };
  }

  /** Pozicija zida vatre u trenutku `now` — linija koja putuje preko arene. */
  function firewallAt(ev, cfg, nowMs) {
    if (!ev || ev.type !== 'firewall') return null;
    if (nowMs < ev.atMs || nowMs > ev.endMs) return null;
    const t = (nowMs - ev.atMs) / Math.max(1, ev.endMs - ev.atMs);
    const from = { lat: ev.lat, lng: ev.lng };
    const mid = U.destPoint(from, ev.headingDeg, ev.travelM * t);
    const a = U.destPoint(mid, (ev.headingDeg + 90) % 360, cfg.diameterM);
    const b = U.destPoint(mid, (ev.headingDeg + 270) % 360, cfg.diameterM);
    return { a, b, mid, widthM: ev.radiusM, t };
  }

  /* ═══════════════════ 13. SPAWN PREDMETA ═══════════════════ */
  const RARITY_W = {
    scatter: { common: 55, uncommon: 27, rare: 13, epic: 4, legendary: 1 },
    corn:    { common: 20, uncommon: 30, rare: 30, epic: 15, legendary: 5 },
  };
  const CORN_RADIUS_M = 40, EDGE_MARGIN_M = 20;

  function itemsOfPool(pool, rarity) {
    return ITEM_IDS.filter((id) => {
      const it = ITEMS[id];
      return it.rarity === rarity && (it.pool === pool || it.pool === 'both');
    });
  }

  function generateItems(seed, cfg, playerCount, salt) {
    const rng = U.rngFor(seed, 'items', salt || 0);
    const total = Math.max(8, Math.round(playerCount * 12 * (cfg.itemDensity || 1)));
    const cornN = Math.round(total * 0.3), scatN = total - cornN;
    const center = cfg.center;
    const outerR = Math.max(30, cfg.diameterM / 2 - EDGE_MARGIN_M);

    const cornPts = U.scatter(rng, center, CORN_RADIUS_M, 0, cornN, 4, []);
    const scatPts = U.scatter(rng, center, outerR, CORN_RADIUS_M + 10, scatN, 12, []);
    const out = [];
    const RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const make = (p, pool) => {
      let rarity = U.weighted(rng, RARITY_W[pool]);
      let cand = itemsOfPool(pool, rarity);
      // Ako za tu retkost u tom bazenu nema ničega, spuštaj se pa diži —
      // bolje predmet druge retkosti nego rupa u rasporedu.
      if (!cand.length) {
        for (const r2 of RANK) { cand = itemsOfPool(pool, r2); if (cand.length) { rarity = r2; break; } }
      }
      if (!cand.length) return;
      const type = U.pick(rng, cand);
      out.push({ id: 'i' + out.length + (salt ? 's' + salt : ''), type, rarity, lat: p.lat, lng: p.lng, pool });
    };
    cornPts.forEach((p) => make(p, 'corn'));
    scatPts.forEach((p) => make(p, 'scatter'));

    // §6 — 8 nalazišta strela po strelcu u igri
    return out;
  }

  function generateArrowCaches(seed, cfg, archerCount) {
    if (!archerCount) return [];
    const rng = U.rngFor(seed, 'arrows');
    const outerR = Math.max(30, cfg.diameterM / 2 - EDGE_MARGIN_M);
    const pts = U.scatter(rng, cfg.center, outerR, 25, archerCount * 8, 15, []);
    return pts.map((p, i) => ({ id: 'a' + i, type: 'arrows', rarity: 'uncommon', lat: p.lat, lng: p.lng, pool: 'scatter' }));
  }

  /* ═══════════════════ 4. STARTNE TAČKE ═══════════════════ */
  function startPoints(seed, cfg, playerIds) {
    const rng = U.rngFor(seed, 'start');
    const out = {};
    if (cfg.startMode === 'cornucopia') {
      const off = rng() * 360;
      playerIds.forEach((pid, i) => {
        const b = off + (360 / playerIds.length) * i;
        out[pid] = U.destPoint(cfg.center, b, 40);
      });
    } else {
      const outerR = Math.max(40, cfg.diameterM / 2 - EDGE_MARGIN_M);
      const pts = U.scatter(rng, cfg.center, outerR, 30, playerIds.length, 30, []);
      playerIds.forEach((pid, i) => { out[pid] = pts[i]; });
    }
    return out;
  }

  /* ═══════════════════ 7. RAZDALJINA ═══════════════════ */
  function distanceBand(meters, isArcher) {
    if (meters < 8) return 0;
    if (meters < 15) return 1;
    if (meters < 25) return 2;
    if (meters < 35) return 3;
    if (isArcher && meters < 50) return 4;
    return -1;                      // predaleko za borbu
  }
  const PHOTO_MAX_M = 35, PHOTO_MAX_ARCHER_M = 60, PHOTO_CONE_DEG = 30, PHOTO_COOLDOWN_MS = 15000;
  const RANGED_MAX_M = 30, RANGED_AIM_MS = 8000, RANGED_COOLDOWN_MS = 90000;
  const RANGED_DODGE_M = 12, RANGED_SELF_MOVE_M = 5, RANGED_MIN_ACC_M = 20, RANGED_STALE_M = 20;

  /* ═══════════════════ 8. BORBA ═══════════════════ */
  const ROUND_MS = 10000, MAX_ROUNDS = 10, STALEMATE_HP = 10;
  const FIGHT_COOLDOWN_MS = 180000;
  const MOVES = ['approach', 'retreat', 'attack', 'block'];

  function weaponOf(p) { return WEAPONS[(p && p.weapon) || 'fists'] || WEAPONS.fists; }
  function ownsWeapon(p) {
    const cls = CLASSES[p && p.classId];
    return !!(cls && p.weapon && cls.weapon === p.weapon);
  }

  function attackDamage(attacker, distance, opts) {
    const w = weaponOf(attacker);
    if (!inRange(w, distance)) return { miss: true, dmg: 0, weapon: w.id };
    let dmg = w.dmg;
    if (ownsWeapon(attacker)) dmg += OWN_WEAPON_BONUS;
    dmg += classRangeMod(attacker.classId, distance);
    if (opts && opts.rage) dmg *= 2;
    return { miss: false, dmg: Math.max(1, Math.round(dmg)), weapon: w.id, poison: !!w.poison };
  }

  /**
   * Jedna runda borbe. Čista funkcija — oba telefona je izvrše i dobiju isto.
   * f: {a,b,distance,hpA,hpB,round,effA,effB,specialUsedA,specialUsedB}
   * moves: {[pid]: {kind:'move'|'special'|'flee', move?}}
   * P: {[pid]: player}
   */
  function resolveRound(f, moves, P) {
    const A = f.a, B = f.b;
    const pa = P[A], pb = P[B];
    const clsA = CLASSES[pa.classId], clsB = CLASSES[pb.classId];
    const effA = f.effA || {}, effB = f.effB || {};
    const log = [];
    let hpA = f.hpA, hpB = f.hpB, dist = f.distance;
    let fled = null, specialA = f.specialUsedA, specialB = f.specialUsedB;

    const norm = (pid, other, eff) => {
      let m = moves[pid];
      if (eff.skipTurn) return { kind: 'skipped' };
      if (!m) return { kind: 'move', move: 'block' };           // ne odigra → Blok (§8)
      if (m.kind === 'move' && !MOVES.includes(m.move)) return { kind: 'move', move: 'block' };
      if (m.kind === 'move' && (m.move === 'approach' || m.move === 'retreat') && eff.lockedRounds > 0)
        return { kind: 'move', move: 'block' };                 // Uplitanje (§8)
      return m;
    };
    const ma = norm(A, B, effA), mb = norm(B, A, effB);

    /* — kretanje se rešava prvo, napadi gađaju novu razdaljinu — */
    const delta = (m) => (m.kind === 'move' && m.move === 'approach' ? -1
      : m.kind === 'move' && m.move === 'retreat' ? 1 : 0);
    dist = U.clamp(dist + delta(ma) + delta(mb), 0, 5);

    const nEffA = { ...effA }, nEffB = { ...effB };
    nEffA.skipTurn = false; nEffB.skipTurn = false;
    if (nEffA.lockedRounds > 0) nEffA.lockedRounds--;
    if (nEffB.lockedRounds > 0) nEffB.lockedRounds--;

    const blocked = { [A]: ma.kind === 'move' && ma.move === 'block', [B]: mb.kind === 'move' && mb.move === 'block' };

    // Senka: prva runda besplatna — protivnikov potez se ignoriše (§5)
    const shadowFree = (pid) => f.round === 1 && P[pid].classId === 'shadow' && ownsWeapon(P[pid]);

    function applyHit(from, to, dmg, opts) {
      opts = opts || {};
      let d = dmg;
      if (blocked[to] && !opts.piercesBlock && !shadowFree(from)) d = Math.round(d * 0.4);
      if (to === A) hpA -= d; else hpB -= d;
      log.push({ from, to, dmg: d, blocked: blocked[to] && !opts.piercesBlock, kind: opts.kind || 'attack' });
      // kontra 6 ako te napadnu izbliza a ti blokiraš (§8)
      if (blocked[to] && dist <= 1 && !opts.noCounter && !shadowFree(from)) {
        if (from === A) hpA -= 6; else hpB -= 6;
        log.push({ from: to, to: from, dmg: 6, kind: 'counter' });
      }
      if (opts.poison) { (to === A ? nEffA : nEffB).poisonRounds = 99; }
    }

    function doAction(pid, other, m, isA) {
      const me = P[pid];
      const eff = isA ? nEffA : nEffB;
      if (m.kind === 'skipped') { log.push({ from: pid, kind: 'skipped' }); return; }
      if (m.kind === 'flee') { fled = pid; return; }

      if (m.kind === 'special') {
        const sp = SPECIALS[me.classId];
        if (!sp || !ownsWeapon(me) || (isA ? specialA : specialB)) return;
        if (isA) specialA = true; else specialB = true;
        log.push({ from: pid, kind: 'special', special: sp.id });
        if (sp.id === 'stab') {
          applyHit(pid, other, blocked[other] ? sp.blockedDmg : sp.dmg, { kind: 'special', noCounter: true, piercesBlock: true });
        } else if (sp.id === 'throw') {
          applyHit(pid, other, sp.dmg, { kind: 'special', noCounter: true });
          (isA ? nEffA : nEffB).lostWeapon = true;
        } else if (sp.id === 'smash') {
          applyHit(pid, other, sp.dmg, { kind: 'special', piercesBlock: true });
        } else if (sp.id === 'aimedShot') {
          eff.aiming = (eff.aiming || 0) + 1;
          if (eff.aiming >= sp.chargeRounds) {
            eff.aiming = 0;
            applyHit(pid, other, sp.dmg, { kind: 'special', noCounter: true });
          }
        } else if (sp.id === 'entangle') {
          (isA ? nEffB : nEffA).lockedRounds = sp.lockRounds;
        } else if (sp.id === 'breakthrough') {
          applyHit(pid, other, sp.dmg, { kind: 'special' });
          dist = U.clamp(dist + sp.push, 0, 5);
        } else if (sp.id === 'vanish') {
          fled = pid;
        } else if (sp.id === 'daze') {
          (isA ? nEffB : nEffA).skipTurn = true;
        } else if (sp.id === 'poison') {
          (isA ? nEffB : nEffA).poisonRounds = 99;
        }
        return;
      }

      if (m.move === 'attack') {
        const rage = eff.rageFirstRound && f.round === 1;
        const res = attackDamage(me, dist, { rage });
        if (res.miss) { log.push({ from: pid, kind: 'miss', weapon: res.weapon, dist }); return; }
        if (weaponOf(me).ammo === 'arrow') {
          const left = (isA ? f.arrowsA : f.arrowsB);
          if (left != null && left <= 0) { log.push({ from: pid, kind: 'noAmmo' }); return; }
          if (isA) f.arrowsA = (f.arrowsA || 0) - 1; else f.arrowsB = (f.arrowsB || 0) - 1;
        }
        applyHit(pid, other, res.dmg, { poison: res.poison });
      } else if (m.move === 'block') {
        log.push({ from: pid, kind: 'block' });
      } else {
        log.push({ from: pid, kind: m.move, dist });
      }
    }

    doAction(A, B, ma, true);
    doAction(B, A, mb, false);

    // otrov po rundi (§8 — Lekarov specijal 6 po rundi)
    if (nEffA.poisonRounds > 0) { hpA -= 6; log.push({ to: A, dmg: 6, kind: 'poison' }); }
    if (nEffB.poisonRounds > 0) { hpB -= 6; log.push({ to: B, dmg: 6, kind: 'poison' }); }

    hpA = Math.max(0, Math.round(hpA)); hpB = Math.max(0, Math.round(hpB));
    const round = f.round + 1;
    let state = 'live', winner = null;

    if (fled) { state = 'chase'; }
    else if (hpA <= 0 && hpB <= 0) { state = 'done'; winner = null; }
    else if (hpA <= 0) { state = 'done'; winner = B; }
    else if (hpB <= 0) { state = 'done'; winner = A; }
    else if (round > MAX_ROUNDS) {
      hpA = Math.max(0, hpA - STALEMATE_HP); hpB = Math.max(0, hpB - STALEMATE_HP);
      log.push({ kind: 'stalemate' });
      state = 'done';
      if (hpA <= 0 && hpB > 0) winner = B; else if (hpB <= 0 && hpA > 0) winner = A;
    }

    return {
      distance: dist, hpA, hpB, round, state, winner, fled,
      effA: nEffA, effB: nEffB, specialUsedA: specialA, specialUsedB: specialB,
      arrowsA: f.arrowsA, arrowsB: f.arrowsB, log,
    };
  }

  /* ═══════════════════ 9. BEKSTVO ═══════════════════ */
  const CHASE = {
    escapeRadiusM: 20, escapeSec: 15, escapeSecRunner: 10,
    rejoinRadiusM: 8, timeoutMs: 90000, immunityMs: 60000,
  };

  /* ═══════════════════ 12/13. INVENTAR ═══════════════════ */
  const BASE_SLOTS = 4, PICKUP_RADIUS_M = 10;
  const ITEM_RESPAWN_MS = 90000, ITEM_MOVE_MS = 600000, NO_PICKUP_AFTER_START_MS = 10000;

  function slotsOf(p) {
    const cls = CLASSES[p && p.classId];
    let s = (p && p.capacity) || BASE_SLOTS;
    if (cls && cls.extraSlots) s += cls.extraSlots;
    return s;
  }
  function stackLimit(itemType) {
    const it = ITEMS[itemType];
    return it ? RARITY[it.rarity].stack : 1;
  }
  /** Gde staje novi predmet? {mode:'stack'|'slot'|'full', index} */
  function fitItem(inv, itemType, slots) {
    const list = inv || [];
    const lim = stackLimit(itemType);
    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].itemType === itemType && (list[i].qty || 1) < lim) return { mode: 'stack', index: i };
    }
    if (list.filter(Boolean).length < slots) return { mode: 'slot', index: list.filter(Boolean).length };
    return { mode: 'full' };
  }

  /** Efekat konzumiranja predmeta — vraća izmene igrača. */
  function consume(p, itemType, rng) {
    const it = ITEMS[itemType];
    if (!it) return null;
    const cls = CLASSES[p.classId] || {};
    const out = {};
    const maxHunger = SURVIVAL.baseMax + (p.maxHungerBonus || 0);
    const maxThirst = SURVIVAL.baseMax + (p.maxThirstBonus || 0);
    let hp = p.hp, msg = null;

    if (it.hunger) out.hunger = Math.min(maxHunger, (p.hunger || 0) + it.hunger);
    if (it.thirst) {
      let t = it.thirst;
      out.thirst = Math.min(maxThirst, (p.thirst || 0) + t);
    }
    if (it.hp) {
      // Sakupljaču prljava voda ne škodi (§5)
      const safe = it === ITEMS.dirtyWater && cls.dirtyWaterSafe;
      if (!safe) hp += it.hp;
    }
    if (it.heal) {
      let h = it.heal;
      if (cls.healMul) h *= cls.healMul;
      if (it.medicDouble && p.classId === 'medic') h = it.heal * 2;
      hp += h;
    }
    if (it.healFull) hp = p.maxHp;
    if (it.curesPoison) out.poisonedUntilMs = 0;
    if (it.poisonChance && (rng || Math.random)() < it.poisonChance) {
      hp -= it.poisonHp; msg = 'poisoned';
    }
    if (it.maxHunger) out.maxHungerBonus = Math.min(50, (p.maxHungerBonus || 0) + it.maxHunger);
    if (it.maxThirst) out.maxThirstBonus = Math.min(50, (p.maxThirstBonus || 0) + it.maxThirst);
    if (it.slots) out.capacity = Math.max(p.capacity || BASE_SLOTS, it.slots);
    if (it.arrows) out.arrows = (p.arrows || 0) + it.arrows;
    if (it.quiver) out.hasQuiver = true;
    if (it.visionM) out.visionBonusM = Math.max(p.visionBonusM || 0, it.visionM - 15);

    out.hp = U.clamp(Math.round(hp), 0, p.maxHp);
    if (msg) out._msg = msg;
    return out;
  }

  /* ═══════════════════ vidljivost (§5, §12, §15) ═══════════════════ */
  function visionFor(p, ctx) {
    const cls = CLASSES[p.classId] || {};
    let items = cls.itemVisionM || 15;
    if (p.visionBonusM) items += p.visionBonusM;
    if (ctx && ctx.night && !(ctx.hasLight)) items = Math.min(items, EVENTS.night.visionM);
    if (ctx && ctx.hasLight && ctx.lightBonusM) items += ctx.lightBonusM;
    const players = cls.playerVisionM || 0;
    return { itemsM: items, playersM: players };
  }

  return {
    CLASSES, CLASS_IDS, classRangeMod, WEAPONS, OWN_WEAPON_BONUS, inRange, SPECIALS,
    RARITY, ITEMS, ITEM_IDS, isRenewable,
    RECOMMENDED, recommendFor, MIN_PLAYERS, MAX_PLAYERS, maxAllianceSize,
    dealClasses, classCensus,
    ZONE_PHASES, ZONE_WARN_MS, EVENTS, SPARK_COSTS, GM_COOLDOWN_MS,
    SURVIVAL, survivalTick,
    buildSchedule, zoneAt, firewallAt,
    RARITY_W, CORN_RADIUS_M, EDGE_MARGIN_M, generateItems, generateArrowCaches, startPoints,
    distanceBand, PHOTO_MAX_M, PHOTO_MAX_ARCHER_M, PHOTO_CONE_DEG, PHOTO_COOLDOWN_MS,
    RANGED_MAX_M, RANGED_AIM_MS, RANGED_COOLDOWN_MS, RANGED_DODGE_M, RANGED_SELF_MOVE_M,
    RANGED_MIN_ACC_M, RANGED_STALE_M,
    ROUND_MS, MAX_ROUNDS, STALEMATE_HP, FIGHT_COOLDOWN_MS, MOVES,
    weaponOf, ownsWeapon, attackDamage, resolveRound, CHASE,
    BASE_SLOTS, PICKUP_RADIUS_M, ITEM_RESPAWN_MS, ITEM_MOVE_MS, NO_PICKUP_AFTER_START_MS,
    slotsOf, stackLimit, fitItem, consume, visionFor,
  };
});
