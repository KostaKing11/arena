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

  /* ═══════════════════ 5. KLASE ═══════════════════
     Izmene zbog borbe v4 (§7 tog dokumenta): bekstvo i potera više ne postoje,
     pa su Trkaču i Zamkaru plus i minus prepravljeni. */
  const CLASSES = {
    archer:   { id: 'archer',   weapon: 'bow',     maxHp: 100, playerVisionM: 40, itemVisionM: 15 },
    shadow:   { id: 'shadow',   weapon: 'knife',   maxHp: 100, invisible: true, blindToMap: true },
    strong:   { id: 'strong',   weapon: 'axe',     maxHp: 130, zoneDamageMul: 0.5, alwaysVisible: true },
    gatherer: { id: 'gatherer', weapon: 'club',    maxHp: 100, survivalMul: 0.6, dirtyWaterSafe: true, itemVisionM: 25 },
    medic:    { id: 'medic',    weapon: 'blowgun', maxHp: 80,  healMul: 1.5, canHealAlly: true },
    // ranije `cannotFlee`; bekstva nema, pa minus postaje −10 max HP
    trapper:  { id: 'trapper',  weapon: 'net',     maxHp: 90,  trapCapacityMul: 2, trapPowerMul: 1.5, seesTrapsM: 10 },
    // ranije brže bekstvo; sada svi cooldowni −25% i imun na uplitanje
    runner:   { id: 'runner',   weapon: 'sling',   maxHp: 85,  cooldownMul: 0.75, immuneToEntangle: true, extraSlots: 1 },
    hunter:   { id: 'hunter',   weapon: 'spear',   maxHp: 100 },
    fisher:   { id: 'fisher',   weapon: 'trident', maxHp: 90 },
  };
  const CLASS_IDS = Object.keys(CLASSES);

  /* ═══════════════════ 6. ORUŽJA ═══════════════════
     Opseg je u METRIMA, prava razdaljina iz GPS-a. Nema apstraktne trake 0–5.
     `aimMs` je koliko se drži dugme, `cdMs` cooldown posle udarca, `warns`
     da li žrtva dobija upozorenje čim počneš da nišaniš. */
  /* Cooldown prati jačinu: slabo oružje puca često, jako retko. Mrežа i
     duvaljka su duže jer ne rade štetu nego onesposobljavaju. */
  const WEAPONS = {
    fists:   { id: 'fists',   dmg: 10, minM: 0,  maxM: 3,  aimMs: 1000, cdMs: 10000, warns: false, cls: null },
    knife:   { id: 'knife',   dmg: 45, minM: 0,  maxM: 5,  aimMs: 1000, cdMs: 26000, warns: false, cls: 'shadow' },
    club:    { id: 'club',    dmg: 22, minM: 0,  maxM: 5,  aimMs: 1500, cdMs: 18000, warns: false, cls: 'gatherer' },
    axe:     { id: 'axe',     dmg: 35, minM: 0,  maxM: 8,  aimMs: 2000, cdMs: 24000, warns: false, cls: 'strong' },
    net:     { id: 'net',     dmg: 10, minM: 0,  maxM: 8,  aimMs: 2000, cdMs: 35000, warns: false, cls: 'trapper', entangle: true },
    spear:   { id: 'spear',   dmg: 28, minM: 3,  maxM: 12, aimMs: 2000, cdMs: 20000, warns: true,  cls: 'hunter' },
    trident: { id: 'trident', dmg: 30, minM: 0,  maxM: 15, aimMs: 2000, cdMs: 22000, warns: 'over8', cls: 'fisher' },
    blowgun: { id: 'blowgun', dmg: 12, minM: 5,  maxM: 20, aimMs: 3000, cdMs: 30000, warns: true,  cls: 'medic', poison: true },
    sling:   { id: 'sling',   dmg: 15, minM: 8,  maxM: 25, aimMs: 3000, cdMs: 14000, warns: true,  cls: 'runner' },
    bow:     { id: 'bow',     dmg: 30, minM: 15, maxM: 40, aimMs: 5000, cdMs: 45000, warns: true,  cls: 'archer', ammo: 'arrow' },
  };
  const OWN_WEAPON_BONUS = 8;

  /** Da li oružje upozorava žrtvu na ovoj razdaljini. Trozubac tek preko 8 m. */
  function warnsAt(w, m) {
    if (w.warns === 'over8') return m > 8;
    return !!w.warns;
  }

  /* Opseg: 'in' u dometu, 'close' preblizu (pola štete, 40% promašaj),
     'far' predaleko (ne može ni da se uslika). */
  const CLOSE_DMG_MUL = 0.5, CLOSE_MISS_CHANCE = 0.4;
  function rangeState(w, m) {
    if (m > w.maxM) return 'far';
    if (m < w.minM) return 'close';
    return 'in';
  }

  /* ═══════════════════ SPECIJALI — jednom po IGRI ═══════════════════
     Pošto borbi kao stanja više nema, specijal je jedan potez po celoj partiji.
     Zato su znatno jači nego ranije. */
  const SPECIALS = {
    shadow:   { id: 'backstab',   dmg: 90, maxM: 3, needsBackTurned: true, facingTolDeg: 60 },
    fisher:   { id: 'throwTrident', dmg: 60, maxM: 25, losesWeapon: true },
    archer:   { id: 'preciseShot', dmg: 55, maxM: 60, aimMs: 10000, warns: true },
    strong:   { id: 'charge',     dmg: 50, maxM: 8, ignoresRangePenalty: true },
    hunter:   { id: 'volley',     dmg: 20, hits: 3, windowMs: 15000, maxM: 12 },
    trapper:  { id: 'bigNet',     radiusM: 12, entangleMs: 40000 },
    runner:   { id: 'secondWind', durationMs: 60000, cooldownMul: 0.5 },
    gatherer: { id: 'stash',      fillsSurvival: true },
    medic:    { id: 'potion',     heal: 70, maxM: 15, canTargetAlly: true },
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

  /* ═══════════════════ 16. ISKRE ═══════════════════
     Vidljive samo duhovima. Raspoređene po celoj areni, determinstički —
     nema potrebe da iko iko drugom javlja gde su.                            */
  const SPARKS_PER_PLAYER = 6;
  function generateSparks(seed, cfg, playerCount) {
    const rng = U.rngFor(seed, 'sparks');
    const n = Math.max(20, Math.round(playerCount * SPARKS_PER_PLAYER));
    const outerR = Math.max(30, cfg.diameterM / 2 - 10);
    return U.scatter(rng, cfg.center, outerR, 15, n, 18, [])
      .map((p, i) => ({ id: 's' + i, lat: p.lat, lng: p.lng }));
  }
  const SPARK_REACH_M = 10;

  /* ═══════════════════ 15. HALUCINACIJE ═══════════════════
     Traker ose ostavljaju 5 minuta lažnih predmeta koji nestanu kad priđeš.
     Računaju se lokalno, iz (igrač, minut) — ne diraju bazu.                 */
  const HALLUCINATION_MS = 300000;
  const HALLUCINATION_POP_M = 12;
  function hallucinations(pid, center, bucket, count) {
    const rng = U.rngFor(pid, 'halluc', bucket);
    const n = count || 4;
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = U.pointInCircle(rng, center, 70, 20);
      const rarity = U.weighted(rng, { uncommon: 40, rare: 35, epic: 20, legendary: 5 });
      const pool = ITEM_IDS.filter((id) => ITEMS[id].rarity === rarity);
      out.push({ id: `h${bucket}_${i}`, type: U.pick(rng, pool), rarity, lat: p.lat, lng: p.lng, fake: true });
    }
    return out;
  }

  /* ═══════════════════ 17. MENTOR ═══════════════════ */
  const PACKAGE_COSTS = [1, 3, 6, 10];          // cena raste po paketu (§17)
  const PACKAGE_COOLDOWN_MS = 300000;           // max 1 paket na 5 min po igraču
  const PACKAGE_DROP_M = 15;                    // paket pada 15 m od igrača
  const CHEER_FAVOR = 0.5, CHEER_COOLDOWN_MS = 600000;
  const PACKAGE_TIERS = {
    water:    { minCost: 1, items: ['waterBottle', 'springWater'] },
    food:     { minCost: 1, items: ['bread', 'driedMeat'] },
    medkit:   { minCost: 3, items: ['medkit', 'bandage'] },
    backpack: { minCost: 3, items: ['smallBag', 'backpack'] },
    weapon:   { minCost: 6, items: ['wSpear', 'wAxe', 'wBow', 'wKnife', 'wBlowgun', 'wTrident'] },
  };
  const packageCost = (sent) => PACKAGE_COSTS[Math.min(sent || 0, PACKAGE_COSTS.length - 1)];
  const canAffordTier = (tier, sent, favor) => {
    const t = PACKAGE_TIERS[tier];
    if (!t) return false;
    const c = packageCost(sent);
    return c >= t.minCost && favor >= c;
  };

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

  /* ═══════════════════ SLIKANJE I NIŠANJENJE ═══════════════════
     Kandidati se traže u konusu ±30° (kompas greši 15–20°, uže ne radi).
     `PHOTO_MAX_M` je samo dokle se kandidati uopšte prikazuju na ekranu
     nišanjenja — da li smeš da opališ određuje opseg oružja. */
  const PHOTO_CONE_DEG = 30, PHOTO_COOLDOWN_MS = 15000;
  const ALLY_OFFER_M = 10;        // savez se nudi samo izbliza

  /* Koliko daleko uopšte VIDIŠ nekoga na ekranu nišanjenja.
     Vezano je za tvoje oružje: sa pesnicama nemaš šta da tražiš na 30 m, a sa
     lukom moraš da vidiš metu pre nego što uđe u domet. Malo preko dometa se
     ostavlja da postoji stanje „predaleko", i taman toliko da vidiš saveznika
     kome hoćeš da ponudiš savez. */
  function visibleRangeM(w) {
    return Math.max((w || WEAPONS.fists).maxM * 1.25, ALLY_OFFER_M);
  }
  const AIM_SELF_MOVE_M = 5;      // pomeriš se preko ovoga dok nišaniš → promašaj
  const AIM_DODGE_M = 8;          // žrtva se pomeri preko ovoga → promašaj

  /* Anti-varanje (§10 borbe v4) — sada za SVAKI napad, ne samo za luk. */
  const MIN_ACC_M = 20;           // GPS tačnost napadača i žrtve
  const STALE_MOVE_M = 20, STALE_MS = 300000;   // ko sedi kod kuće ne napada
  const START_GRACE_MS = 30000;   // prvih 30 s od starta nema napada

  /* Efekti. */
  const ENTANGLE_MS = 20000;                                     // mreža
  const POISON_MS = 60000, POISON_DMG = 3, POISON_TICK_MS = 10000; // duvaljka
  const BETRAYAL_MUL = 1.5;                                       // prvi udarac na saveznika
  const HEAL_HOLD_MS = 3000, HEAL_MOVE_M = 5;                     // lečenje i jelo u mestu

  function weaponOf(p) { return WEAPONS[(p && p.weapon) || 'fists'] || WEAPONS.fists; }
  function ownsWeapon(p) {
    const cls = CLASSES[p && p.classId];
    return !!(cls && p.weapon && cls.weapon === p.weapon);
  }

  /** Koliko traje cooldown oružja za ovog igrača (Trkač −25%, Drugi vetar −50%). */
  function cooldownFor(p, w, nowMs) {
    const cls = CLASSES[p && p.classId] || {};
    let ms = (w || weaponOf(p)).cdMs;
    if (cls.cooldownMul) ms *= cls.cooldownMul;
    if (p && p.secondWindUntilMs > (nowMs || 0)) ms *= SPECIALS.runner.cooldownMul;
    return Math.round(ms);
  }

  /**
   * Šteta jednog udarca. Čista funkcija — `rng` se ubrizgava da bi test mogao
   * da je zada. Vraća {miss, dmg, state, weapon, poison, entangle}.
   *
   * Preblizu: pola štete i 40% šanse za promašaj (Strelac na 3 m je bespomoćan).
   * Predaleko: uopšte nije napad — to hvata UI pre nego što se dođe dovde.
   */
  function attackDamage(attacker, distM, opts) {
    opts = opts || {};
    const w = opts.weapon || weaponOf(attacker);
    const state = rangeState(w, distM);
    if (state === 'far') return { miss: true, dmg: 0, state, weapon: w.id, reason: 'far' };

    const rng = opts.rng || Math.random;
    if (state === 'close' && !opts.ignoresRangePenalty && rng() < CLOSE_MISS_CHANCE) {
      return { miss: true, dmg: 0, state, weapon: w.id, reason: 'close' };
    }
    let dmg = w.dmg;
    if (ownsWeapon(attacker)) dmg += OWN_WEAPON_BONUS;
    if (state === 'close' && !opts.ignoresRangePenalty) dmg *= CLOSE_DMG_MUL;
    if (opts.betrayal) dmg *= BETRAYAL_MUL;
    return {
      miss: false, dmg: Math.max(1, Math.round(dmg)), state, weapon: w.id,
      poison: !!w.poison, entangle: !!w.entangle,
    };
  }

  /**
   * Sme li se uopšte napasti (§10). Vraća null ako sme, inače razlog.
   * ctx: {nowMs, startedAtMs, myAccM, outsideZone, lastMoveMs}
   */
  function attackBlocked(attacker, target, ctx) {
    ctx = ctx || {};
    const now = ctx.nowMs || 0;
    if (!target || target.alive === false) return 'dead';
    if (ctx.startedAtMs && now - ctx.startedAtMs < START_GRACE_MS) return 'grace';
    if (ctx.outsideZone) return 'zone';
    if (ctx.myAccM == null || ctx.myAccM > MIN_ACC_M) return 'gps';
    if (((target.pos || {}).accM == null) || target.pos.accM > MIN_ACC_M) return 'gpsTarget';
    if (ctx.lastMoveMs && now - ctx.lastMoveMs > STALE_MS) return 'stale';
    if ((attacker.weaponCooldownUntilMs || 0) > now) return 'cooldown';
    if ((attacker.entangledUntilMs || 0) > now) return 'entangled';
    const w = weaponOf(attacker);
    if (w.ammo === 'arrow' && (attacker.arrows || 0) <= 0) return 'ammo';
    return null;
  }

  /** Da li žrtva gleda u pravcu napadača — za Senkin ubod u leđa. */
  function isBackTurned(victimHeadingDeg, bearingVictimToAttacker, tolDeg) {
    if (victimHeadingDeg == null) return true;      // ne javlja smer → računa se kao leđa
    const diff = Math.abs(U.angleDiff(victimHeadingDeg, bearingVictimToAttacker));
    return diff > (tolDeg == null ? SPECIALS.shadow.facingTolDeg : tolDeg);
  }

  /** Koliko otrov nanese od `fromMs` do `toMs`, uz `POISON_TICK_MS` korak. */
  function poisonDamage(fromMs, toMs, untilMs) {
    const end = Math.min(toMs, untilMs || 0);
    if (end <= fromMs) return 0;
    const ticks = Math.floor((end - fromMs) / POISON_TICK_MS);
    return Math.max(0, ticks) * POISON_DMG;
  }
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
    CLASSES, CLASS_IDS, WEAPONS, OWN_WEAPON_BONUS, SPECIALS, warnsAt, rangeState,
    CLOSE_DMG_MUL, CLOSE_MISS_CHANCE,
    RARITY, ITEMS, ITEM_IDS, isRenewable,
    RECOMMENDED, recommendFor, MIN_PLAYERS, MAX_PLAYERS, maxAllianceSize,
    dealClasses, classCensus,
    ZONE_PHASES, ZONE_WARN_MS, EVENTS, SPARK_COSTS, GM_COOLDOWN_MS,
    SURVIVAL, survivalTick,
    buildSchedule, zoneAt, firewallAt,
    RARITY_W, CORN_RADIUS_M, EDGE_MARGIN_M, generateItems, generateArrowCaches, startPoints,
    SPARKS_PER_PLAYER, generateSparks, SPARK_REACH_M,
    HALLUCINATION_MS, HALLUCINATION_POP_M, hallucinations,
    PACKAGE_COSTS, PACKAGE_COOLDOWN_MS, PACKAGE_DROP_M, PACKAGE_TIERS,
    CHEER_FAVOR, CHEER_COOLDOWN_MS, packageCost, canAffordTier,
    PHOTO_CONE_DEG, PHOTO_COOLDOWN_MS, AIM_SELF_MOVE_M, AIM_DODGE_M,
    ALLY_OFFER_M, visibleRangeM,
    MIN_ACC_M, STALE_MOVE_M, STALE_MS, START_GRACE_MS,
    ENTANGLE_MS, POISON_MS, POISON_DMG, POISON_TICK_MS, BETRAYAL_MUL,
    HEAL_HOLD_MS, HEAL_MOVE_M,
    weaponOf, ownsWeapon, cooldownFor, attackDamage, attackBlocked, isBackTurned, poisonDamage,
    BASE_SLOTS, PICKUP_RADIUS_M, ITEM_RESPAWN_MS, ITEM_MOVE_MS, NO_PICKUP_AFTER_START_MS,
    slotsOf, stackLimit, fitItem, consume, visionFor,
  };
});
