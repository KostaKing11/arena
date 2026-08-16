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

  /* ═══════════════════ 12. PREDMETI (v5) ═══════════════════
     Retkost više NE određuje kako se predmet uzima — samo boju i bazen u kom
     se izvlači. Ranije se voda uzimala isto kao ranac zato što su oboje bili
     „retko"; jedini pravi resurs u igri koja se igra napolju je koliko dugo
     stojiš u mestu na otvorenom, pa ga treba trošiti po TEŽINI predmeta. */
  const RARITY = {
    common:    { i: 0 },
    uncommon:  { i: 1 },
    rare:      { i: 2 },
    epic:      { i: 3 },
    legendary: { i: 4 },
  };

  /* Tri klase uzimanja. `chest8` je jedini koji javlja svima gde si. */
  const PICKUP = {
    tap:    { id: 'tap',    pickMs: 0,    cancelOnMove: false },
    hold3:  { id: 'hold3',  pickMs: 3000, cancelOnMove: true, moveM: 6 },
    chest8: { id: 'chest8', pickMs: 8000, cancelOnMove: true, moveM: 6, announce: true },
  };
  /** Kako se ovaj predmet uzima, uz Adrenalin koji prepolovljava držanje. */
  function pickupOf(itemType, p, nowMs) {
    const it = ITEMS[itemType];
    const base = PICKUP[(it && it.pickup) || 'tap'] || PICKUP.tap;
    if (base.pickMs && p && (p.adrenalineUntilMs || 0) > (nowMs || 0)) {
      return { ...base, pickMs: Math.round(base.pickMs * 0.5) };
    }
    return base;
  }

  // pool: 'scatter' | 'corn' | 'both' | 'none'  (§13 — šta gde može da se pojavi)
  // 'none' = postoji kao predmet ali ga generator NIKAD ne izvuče (mamac).
  const ITEMS = {
    /* ── hrana (5) ─────────────────────────────────────────────────────────
       Hleb i sušeno meso su spojeni u Obrok: bili su isti predmet sa dva
       broja. Bobicama je skinuta 5% šansa za trovanje — nevidljiva kazna
       koja ne pravi odluku. Pečurke sada UVEK truju, ali najbolje hrane od
       svega rasutog: to jeste odluka. */
    berries:    { type: 'food',  rarity: 'common',    pool: 'scatter', pickup: 'tap',    hunger: 20 },
    mushrooms:  { type: 'food',  rarity: 'uncommon',  pool: 'scatter', pickup: 'tap',    hunger: 40, poisonsAlways: true },
    ration:     { type: 'food',  rarity: 'uncommon',  pool: 'both',    pickup: 'tap',    hunger: 45 },
    feastMeal:  { type: 'food',  rarity: 'legendary', pool: 'corn',    pickup: 'chest8', hunger: 100, thirst: 50, bigItem: true },
    supplyBelt: { type: 'pack',  rarity: 'epic',      pool: 'corn',    pickup: 'hold3',  maxHunger: 30 },
    /* ── piće (4) ── Sok izbačen: bio je mešavina hleba i vode. */
    dirtyWater: { type: 'drink', rarity: 'common',    pool: 'both',    pickup: 'tap',    thirst: 25, hp: -8 },
    waterBottle:{ type: 'drink', rarity: 'uncommon',  pool: 'both',    pickup: 'tap',    thirst: 45 },
    springWater:{ type: 'drink', rarity: 'rare',      pool: 'both',    pickup: 'tap',    thirst: 70 },
    thermos:    { type: 'pack',  rarity: 'epic',      pool: 'corn',    pickup: 'hold3',  maxThirst: 30 },
    /* ── lečenje (4) ── Medkit izbačen (stepenik između zavoja i masti),
       zavoj podignut 25 → 35 da pokrije rupu. */
    herbs:      { type: 'heal',  rarity: 'common',    pool: 'both',    pickup: 'tap',    heal: 15, medicDouble: true },
    bandage:    { type: 'heal',  rarity: 'uncommon',  pool: 'both',    pickup: 'tap',    heal: 35 },
    antidote:   { type: 'heal',  rarity: 'rare',      pool: 'both',    pickup: 'tap',    curesPoison: true, poisonImmuneMs: 60000 },
    salve:      { type: 'heal',  rarity: 'legendary', pool: 'both',    pickup: 'tap',    healFull: true, curesPoison: true },
    /* ── ranac (1) ── Tri ranca („važi najveći") su bili jedan predmet
       napisan tri puta. Ostaje jedan, ali sa cenom: krupan je i vidi te se. */
    backpack:   { type: 'pack',  rarity: 'epic',      pool: 'corn',    pickup: 'hold3',  slots: 7, bulkyVisibleM: 50, bigItem: true },
    /* ── zamke (4) ── */
    trapBasic:  { type: 'trap',  rarity: 'uncommon',  pool: 'scatter', pickup: 'hold3',  trap: 'basic',   hp: -20 },
    trapAlarm:  { type: 'trap',  rarity: 'rare',      pool: 'both',    pickup: 'hold3',  trap: 'alarm',   revealMs: 8000 },
    trapTracker:{ type: 'trap',  rarity: 'epic',      pool: 'both',    pickup: 'hold3',  trap: 'tracker', trackMs: 300000 },
    // Mreža je popravljena: pošto se napada kamerom, „uhvaćen" = kamera ne radi.
    trapNet:    { type: 'trap',  rarity: 'epic',      pool: 'both',    pickup: 'hold3',  trap: 'net',     blocksCameraMs: 30000 },
    /* ── kamera i borba (5) — NOVA KATEGORIJA ───────────────────────────────
       Najveća rupa stare liste: borba je prešla na fotografisanje i daljinu,
       a nijedan predmet to nije dirao. */
    flashFoil:  { type: 'combat', rarity: 'rare', pool: 'both', pickup: 'tap',   flashMs: 60000, flashOverM: 15 },
    tripod:     { type: 'combat', rarity: 'rare', pool: 'corn', pickup: 'tap',   tripodCharge: true },
    smokeBomb:  { type: 'combat', rarity: 'rare', pool: 'both', pickup: 'tap',   smokeMs: 60000, smokeRadiusM: 20 },
    // ex-Napitak besa: `rageFirstRound` je čitao samo stari openFight.
    adrenaline: { type: 'combat', rarity: 'epic', pool: 'both', pickup: 'tap',   adrenalineMs: 90000 },
    shield:     { type: 'combat', rarity: 'epic', pool: 'corn', pickup: 'hold3', shield: true, bigItem: true },
    /* ── izviđanje i alat (8) ──────────────────────────────────────────────
       Baklja sada otkriva TEBE — jedini tradeoff koji je istinit i uživo, i
       jedini razlog da je iko ikad ugasi. Velika baklja izbačena. */
    torch:      { type: 'tool', rarity: 'common',   pool: 'both',    pickup: 'tap',   light: 480000, lightBonusM: 6, revealsM: 100 },
    compassItem:{ type: 'tool', rarity: 'uncommon', pool: 'both',    pickup: 'tap',   nearestArrowMs: 300000, nearestRefreshMs: 30000 },
    flare:      { type: 'tool', rarity: 'uncommon', pool: 'both',    pickup: 'tap',   flareRevealMs: 30000, freePackage: true },
    // Durbin je bio najslabiji „retko" u igri (vid za PREDMETE 15 → 20 m).
    // Sada daje vid na IGRAČE, ali samo u pravcu telefona i samo 15 s.
    binoculars: { type: 'tool', rarity: 'rare',     pool: 'both',    pickup: 'tap',   scopeM: 60, scopeConeDeg: 25, scopeMs: 15000 },
    zoneMap:    { type: 'tool', rarity: 'rare',     pool: 'both',    pickup: 'tap',   zonePeekMs: 300000 },
    decoyBait:  { type: 'tool', rarity: 'rare',     pool: 'both',    pickup: 'hold3', decoy: true },
    quiver:     { type: 'tool', rarity: 'rare',     pool: 'scatter', pickup: 'hold3', quiver: true },
    camoCloak:  { type: 'tool', rarity: 'epic',     pool: 'corn',    pickup: 'tap',   hideAllMs: 300000 },
    arrows:     { type: 'ammo', rarity: 'uncommon', pool: 'scatter', pickup: 'tap',   arrows: 3 },
    /* ── oružja kao predmeti (9) ── epska i legendarno idu kroz sanduk ── */
    wClub:    { type: 'weapon', rarity: 'common',    pool: 'scatter', pickup: 'hold3',  weapon: 'club' },
    wSling:   { type: 'weapon', rarity: 'common',    pool: 'scatter', pickup: 'hold3',  weapon: 'sling' },
    wNet:     { type: 'weapon', rarity: 'uncommon',  pool: 'both',    pickup: 'hold3',  weapon: 'net' },
    wSpear:   { type: 'weapon', rarity: 'rare',      pool: 'corn',    pickup: 'hold3',  weapon: 'spear' },
    wAxe:     { type: 'weapon', rarity: 'rare',      pool: 'corn',    pickup: 'hold3',  weapon: 'axe' },
    wBlowgun: { type: 'weapon', rarity: 'rare',      pool: 'corn',    pickup: 'hold3',  weapon: 'blowgun' },
    wBow:     { type: 'weapon', rarity: 'epic',      pool: 'corn',    pickup: 'chest8', weapon: 'bow' },
    wKnife:   { type: 'weapon', rarity: 'epic',      pool: 'corn',    pickup: 'chest8', weapon: 'knife' },
    wTrident: { type: 'weapon', rarity: 'legendary', pool: 'corn',    pickup: 'chest8', weapon: 'trident' },
  };
  const ITEM_IDS = Object.keys(ITEMS);
  /** Predmeti koje generator sme da izvuče — mamac se samo postavlja. */
  const SPAWNABLE_IDS = ITEM_IDS.filter((id) => ITEMS[id].pool !== 'none');
  // Obnavljaju se samo hrana i piće. Oružja, ranac, zamke, alat i cela
  // kategorija „kamera" se NE obnavljaju — inače prestaju da budu retki.
  const isRenewable = (id) => ITEMS[id] && (ITEMS[id].type === 'food' || ITEMS[id].type === 'drink');

  /* ═══════════════════ 2. PREPORUKE ZA LOBI ═══════════════════ */
  // Trajanje uvek u koracima od 10 min — pun dan (5 svetlih + 5 mračnih).
  const RECOMMENDED = [
    { max: 6,  diameterM: 350,  durationMin: 30 },
    { max: 12, diameterM: 500,  durationMin: 40 },
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

  /* ═══════════════════ 15. EVENTOVI ═══════════════════
     `tone` deli listu na dve strane: duhovi biraju da li žele da POMOGNU ili
     da ODMOGNU, i to mora da se vidi pre nego što potroše kasu. Ranije je sve
     stajalo u jednoj sivoj koloni, pa se gozba klikala kao i zid vatre.

     Noći više nema u ovoj listi — dan i noć se smenjuju sami, po satu (dole). */
  const EVENTS = {
    firewall: { warnMs: 60000, durMs: 180000, widthM: 25, spark: 8, tone: 'bad' },
    wasps:    { warnMs: 20000, durMs: 300000, radiusM: 60, dmgPer10s: 3, spark: 5, tone: 'bad' },
    drought:  { warnMs: 20000, durMs: 300000, thirstMul: 2, spark: 3, tone: 'bad' },
    feast:    { warnMs: 120000, durMs: 0, items: 6, spark: 6, tone: 'good' },
    supplyBox:{ warnMs: 15000, durMs: 0, spark: 4, tone: 'good' },
  };
  const SPARK_COSTS = Object.fromEntries(Object.entries(EVENTS).map(([k, v]) => [k, v.spark]));
  const GM_COOLDOWN_MS = 240000;

  /* Koliko događaja duhovi smeju da puste za celu partiju.
     Bez ovoga je pola sata igre umelo da primi pet talasa zaredom. Uz to važi
     i tvrdo pravilo: svaki tip najviše JEDNOM — jedan zid vatre, jedne ose,
     jedna gozba. Ostatak izbora ostaje duhovima. */
  const ghostEventBudget = (durationMin) => Math.max(1, Math.round((durationMin || 30) / 20));

  /* ═══════════════════ DAN I NOĆ ═══════════════════
     Noć je bila događaj koji duhovi kupuju, pa je partija mogla da prođe cela
     po danu — ili da noć padne dvaput za deset minuta. Sada je to ritam, ne
     iznenađenje: pun dan traje 10 minuta, pet svetlih i pet mračnih, i počinje
     danom. Zato trajanje partije uvek ide u koracima od 10 minuta.            */
  const DAY_MS = 300000, NIGHT_MS = 300000;
  const DAY_CYCLE_MS = DAY_MS + NIGHT_MS;
  const NIGHT_VISION_M = 8;
  const DURATION_STEP_MIN = 10;

  /** Da li je noć u trenutku `nowMs`, za partiju koja je počela `startedAtMs`. */
  function isNight(startedAtMs, nowMs) {
    if (!startedAtMs || !nowMs || nowMs < startedAtMs) return false;
    return (nowMs - startedAtMs) % DAY_CYCLE_MS >= DAY_MS;
  }
  /** Koliko još traje tekući deo dana i koji je po redu — za traku i najavu. */
  function dayPhase(startedAtMs, nowMs) {
    const night = isNight(startedAtMs, nowMs);
    const into = !startedAtMs ? 0 : (nowMs - startedAtMs) % DAY_CYCLE_MS;
    return {
      night,
      dayNo: !startedAtMs ? 1 : Math.floor((nowMs - startedAtMs) / DAY_CYCLE_MS) + 1,
      leftMs: night ? DAY_CYCLE_MS - into : DAY_MS - into,
    };
  }

  /* ═══════════════════ 11. GLAD, ŽEĐ, HP (v5) ═══════════════════
     Ranije su glad i žeđ radile identično, pa su hrana i piće bili zamenljivi
     i inventar se svodio na „nosi bilo šta jestivo". Sada su asimetrični:

       ŽEĐ  pada brzo (~10 min) i kad padne ispod 30% SLEPIŠ — radijus vida
            na minimapi pada na 10 m. Hitna je, tera te da se krećeš.
       GLAD pada sporo (~15 min) i kad padne ispod 30% SLABIŠ — šteta −25%.
            Strateška je: možeš je odložiti, ali ulaziš u sukob oslabljen.  */
  const SURVIVAL = {
    thirstSecPerPoint: 6,          // 100 × 6 s = 10 min
    hungerSecPerPoint: 9,          // 100 × 9 s = 15 min
    thirstHpSec: 20, thirstHpAmount: 2,
    hungerHpSec: 30, hungerHpAmount: 2,
    bothEmptyHpSec: 30, bothEmptyHpAmount: 5,   // oba na nuli boli više od zbira
    lowThreshold: 30,              // ispod ovoga počinju kazne
    lowThirstVisionM: 10,          // slep: minimapa sa 15 m pada na 10 m
    lowHungerDmgMul: 0.75,         // slab: šteta −25%
    lowWarn: 25,
    baseMax: 100, capMax: 150,
  };

  /** Kazne od niske gladi/žeđi. Čista funkcija — koriste je i borba i vid. */
  function survivalPenalty(p) {
    const hunger = p && p.hunger != null ? p.hunger : 100;
    const thirst = p && p.thirst != null ? p.thirst : 100;
    return {
      dmgMul: hunger < SURVIVAL.lowThreshold ? SURVIVAL.lowHungerDmgMul : 1,
      visionCapM: thirst < SURVIVAL.lowThreshold ? SURVIVAL.lowThirstVisionM : 0,
      starving: hunger < SURVIVAL.lowThreshold,
      parched: thirst < SURVIVAL.lowThreshold,
    };
  }

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
      if (thirst <= 0 && hunger <= 0) {
        hp -= (sec / SURVIVAL.bothEmptyHpSec) * SURVIVAL.bothEmptyHpAmount;
      } else {
        if (thirst <= 0) hp -= (sec / SURVIVAL.thirstHpSec) * SURVIVAL.thirstHpAmount;
        if (hunger <= 0) hp -= (sec / SURVIVAL.hungerHpSec) * SURVIVAL.hungerHpAmount;
      }
    }

    // Šteta od zone — Snagator trpi upola (§5)
    if (ctx && ctx.outsideZone && ctx.zoneDmgPer10s > 0 && !ctx.frozen) {
      const zm = (cls && cls.zoneDamageMul) || 1;
      hp -= (sec / 10) * ctx.zoneDmgPer10s * zm;
    }
    // Traker ose (§15)
    if (ctx && ctx.inWasps && !ctx.frozen) hp -= (sec / 10) * EVENTS.wasps.dmgPer10s;
    /* Otrov od duvaljke. Polje se zove `poisonUntilMs` — isto ime koje piše
       Attack.land i koje briše Protivotrov. Ranije je ovde stajalo
       `poisonedUntilMs` (sa D), a borba je pisala `poisonUntilMs`, pa
       protivotrov nije skidao otrov od duvaljke. Uživo otrov otkucava
       Attack.tick, pa mu engine namerno NE prosleđuje ovaj ključ — inače bi
       se šteta brojala dvaput. Ostaje zbog testova i simulacije. */
    if (ctx && ctx.poisonUntilMs && ctx.nowMs < ctx.poisonUntilMs && !ctx.frozen) {
      hp -= (sec / 10) * POISON_DMG;
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
      const types = ['wasps', 'feast', 'drought', 'firewall'];
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

    /* Nebo sa licima poginulih je izbačeno: ekran je preuzimao telefon usred
       igre i ostajao da visi. Smrt se sada javlja samo objavom. */
    return { zone, events };
  }

  /* Pomeri ceo raspored unazad za `byMs` — svet time ide UNAPRED za toliko.
     Služi samo testiranju: partija od pola sata se ne može odigrati u sobi za
     pola sata, a zona, dan i noć i događaji su jedino što je vredno videti.
     Pošto sve stoji u apsolutnim vremenima, dovoljno je pomeriti brojeve. */
  function shiftSchedule(schedule, byMs) {
    if (!schedule) return schedule;
    const z = (schedule.zone || []).map((p) => ({
      ...p,
      warnAtMs: p.warnAtMs - byMs, startMs: p.startMs - byMs, atMs: p.atMs - byMs,
    }));
    const e = (schedule.events || []).map((ev) => ({
      ...ev, atMs: ev.atMs - byMs, endMs: ev.endMs - byMs,
    }));
    return { ...schedule, zone: z, events: e };
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
    return SPAWNABLE_IDS.filter((id) => {
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
  /* ═══════════════════ ISKRE — duhovi žive VAN zone ═══════════════════
     Ranije su iskre bile rasute po celoj areni, pa su duhovi šetali kroz igru
     i živi nisu znali ko je uopšte još u partiji. Sada stoje u PRSTENU oko
     zone: unutra su živi (van zone gube život), napolju su mrtvi.

     Kako se zona skuplja, duhovska teritorija raste — teren koji je igra
     napustila pripada mrtvima. Na fazi 0 je zona cela arena, pa prsten pada
     izvan njene granice; to je namerno, jer na startu skoro niko nije mrtav. */
  /* Iskri je bilo šest po igraču, pa je prsten izgledao kao posuto zlato i
     skupljanje nije bilo izbor nego posao. Tri su dovoljne. */
  const SPARKS_PER_PLAYER = 3;
  const SPARK_ZONE_MARGIN_M = 20;      // nijedna iskra nije bliža od ovoga ivici zone
  const GHOST_OUTER_M = 60;            // dokle duhovski prsten viri van arene

  /* Zakovana geometrija zone za datu fazu — ono na šta se zona SLEGLA, ne ono
     kroz šta trenutno prolazi.

     `zoneAt` tokom skupljanja vraća `radiusM` i `center` kao lerp koji se menja
     svake sekunde, dok `phase` ostaje isti. Ako se prsten računa iz toga, iskra
     zadrži id ali promeni mesto — a pošto `U.scatter` prosleđuje minR u
     `pointInCircle`, promena unutrašnjeg poluprečnika drugačije preslika ceo
     niz nasumičnih brojeva, pa se iskre ne pomere nego POTPUNO promešaju.
     Mereno: do 634 m pomeraja pri dometu kupljenja od 10 m.

     Indeks: `zoneAt` vraća phase = i + 1 kad je faza gotova, a phase = i dok se
     skuplja U nju. Dakle faza N opisuje stanje POSLE zone[N-1]; faza 0 je puna arena. */
  function zoneAtPhaseSettled(schedule, cfg, phase) {
    const z = (schedule && schedule.zone) || [];
    if (!phase || !z[phase - 1]) return { center: cfg.center, radiusM: cfg.diameterM / 2 };
    const ph = z[phase - 1];
    return { center: { lat: ph.centerLat, lng: ph.centerLng }, radiusM: ph.radiusM };
  }

  function generateSparks(seed, cfg, playerCount, zonePhase, schedule) {
    const phase = zonePhase || 0;
    const rng = U.rngFor(seed, 'sparks', phase);
    const n = Math.max(12, Math.round(playerCount * SPARKS_PER_PLAYER));
    // geometrija je čista funkcija FAZE, nikad trenutka — inače iskre beže
    const z = zoneAtPhaseSettled(schedule, cfg, phase);
    const inner = z.radiusM + SPARK_ZONE_MARGIN_M;
    const outer = Math.max(inner + 40, cfg.diameterM / 2 + GHOST_OUTER_M);
    return U.scatter(rng, z.center, outer, inner, n, 18, [])
      // faza je u id-u: skupljene iskre iz raznih faza se ne smeju sudarati
      .map((p, i) => ({ id: 's' + phase + '_' + i, lat: p.lat, lng: p.lng, phase }));
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
      const pool = SPAWNABLE_IDS.filter((id) => ITEMS[id].rarity === rarity);
      out.push({ id: `h${bucket}_${i}`, type: U.pick(rng, pool), rarity, lat: p.lat, lng: p.lng, fake: true });
    }
    return out;
  }

  /* ═══════════════════ 17. MENTOR ═══════════════════ */
  /* ═══════════════════ 21. NESVEST ═══════════════════
     Ko tri minuta ne javi ništa, pada u nesvest — i time se otkrije svima na
     mapi. To je kazna za onog ko je izgubio vezu ili otišao kući.

     Ali igra se na ulici i ekran se gasi sam. Dok je aplikacija skrivena GPS ne
     radi i telefon ne piše ništa, pa bi svako zaključavanje ekrana obaralo
     igrača u nesvest. Zato telefon pri odlasku u pozadinu prijavi `hiddenAtMs`
     i dok to stoji, brojač miruje. Nije rupa: nesvest nije zaklon nego kazna,
     pa nema razloga da je iko traži. */
  const UNCONSCIOUS_MS = 180000;
  function isUnconscious(p, nowMs) {
    if (!p || p.isBot) return false;
    if (p.hiddenAtMs) return false;                       // brojač stoji
    return !!(p.lastSeenMs && nowMs - p.lastSeenMs > UNCONSCIOUS_MS);
  }

  /* ═══════════════════ 17b. MENTOR v2 ═══════════════════
     Naklonost je ranije dolazila od minigejmova na mentorovom telefonu, pa
     mentor nikad nije ni gledao partiju — farmao je poene i slao pakete u
     nedogled. Sada naklonost dolazi ISKLJUČIVO od toga šta uradi njegov
     tribut. Mentor gleda, savetuje i zadaje zadatke; ne igra svoju igru. */
  const MENTOR_FAVOR = {
    survivedShrink: 1,   // tribut bio u zoni kad se skupila
    landedKill: 3,       // tribut nekoga ubio
    legendaryPick: 2,    // tribut uzeo legendarni predmet
    finalFive: 3,        // ostalo ih je 5 ili manje, tribut među njima (jednom)
    questDone: 2,        // ispunjen zadatak
  };

  /* Zadaci koje mentor zadaje. NIKAD slobodan tekst — samo iz ove liste;
     inače je mentorski kanal način da se dogovara i vara.
     `check` je čista funkcija: (igrač, snimak na početku zadatka, kontekst). */
  const QUEST_TTL_MS = 300000;      // 5 min pa ističe
  const QUEST_HEAL = 15;            // tribut dobija život kad ispuni
  const QUEST_MOVE_M = 300;
  const QUEST_FED = 80;
  const RARE_PLUS = ['rare', 'epic', 'legendary'];

  const QUESTS = {
    weaponRare:  { check: (p) => RARE_PLUS.includes(weaponRarity(p.weapon)) },
    cornucopia:  { check: (p, base, ctx) => !!base.cornVisited && !!ctx && !ctx.inCorn },
    setTrap:     { check: (p, base) => (p.trapsSet || 0) > (base.trapsSet || 0) },
    attackAny:   { check: (p, base) => (p.lastAttackAtMs || 0) > (base.atMs || 0) },
    wellFed:     { check: (p) => (p.hunger || 0) >= QUEST_FED && (p.thirst || 0) >= QUEST_FED },
    moveFar:     { check: (p, base) => (p.distanceWalkedM || 0) - (base.walkedM || 0) >= QUEST_MOVE_M },
  };
  const QUEST_IDS = Object.keys(QUESTS);

  /** Retkost oružja koje igrač drži — 'fists' nema svoj predmet. */
  function weaponRarity(w) {
    if (!w || w === 'fists') return 'common';
    const key = 'w' + w.charAt(0).toUpperCase() + w.slice(1);
    return (ITEMS[key] || {}).rarity || 'common';
  }

  /** Tri ponuđena zadatka — isti seed i redni broj uvek daju istu trojku. */
  function questOffer(seed, questNo) {
    const rng = U.rngFor(seed, 'quest', questNo || 0);
    return U.shuffle(rng, QUEST_IDS).slice(0, 3);
  }

  /** Da li je zadatak ispunjen. `base` je snimak napravljen pri zadavanju. */
  function questSatisfied(id, p, base, ctx) {
    const q = QUESTS[id];
    if (!q || !p) return false;
    return !!q.check(p, base || {}, ctx || {});
  }
  const questExpired = (q, nowMs) => !!q && nowMs >= (q.expiresAtMs || 0);

  /* Koliko puta mentor uopšte sme da se umeša. Naklonost određuje ŠTA šalje,
     ovo koliko PUTA — inače duga partija znači beskonačno paketa. */
  function mentorLimits(durationMin) {
    const n = Math.floor((durationMin || 30) / 15);
    return {
      quests: U.clamp(n, 2, 6),
      packages: U.clamp(n, 2, 5),
    };
  }

  const PACKAGE_COSTS = [1, 3, 6, 10];          // cena raste po paketu (§17)
  const PACKAGE_COOLDOWN_MS = 300000;           // max 1 paket na 5 min po igraču
  const PACKAGE_DROP_M = 15;                    // paket pada 15 m od igrača
  const CHEER_FAVOR = 0.5, CHEER_COOLDOWN_MS = 600000;
  const PACKAGE_TIERS = {
    water:    { minCost: 1, items: ['waterBottle', 'springWater'] },
    food:     { minCost: 1, items: ['ration', 'berries'] },
    medkit:   { minCost: 3, items: ['bandage', 'antidote'] },
    backpack: { minCost: 3, items: ['backpack', 'supplyBelt', 'thermos'] },
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
    const now = opts.nowMs || 0;
    const w = opts.weapon || weaponOf(attacker);
    const state = rangeState(w, distM);
    if (state === 'far') return { miss: true, dmg: 0, state, weapon: w.id, reason: 'far' };

    const rng = opts.rng || Math.random;
    /* Adrenalin (ex-Napitak besa) skida kaznu za preblizu — u borbi v4 to je
       ekvivalent onoga što je „prva runda duplo" značilo u staroj borbi. */
    const adrenaline = (attacker && attacker.adrenalineUntilMs || 0) > now;
    const tripod = (attacker && attacker.tripodCharges || 0) > 0;
    const ignoresRange = opts.ignoresRangePenalty || adrenaline;

    /* Blic-folija: meta je oblepljena reflektujućom folijom, pa snimak sa
       daljine ne valja. Stativ (i samo stativ) to probija — to je jedini
       par predmeta u igri koji se direktno kontrira. */
    const flashOverM = ITEMS.flashFoil.flashOverM;
    if (opts.targetFlashUntilMs > now && distM > flashOverM && !tripod) {
      return { miss: true, dmg: 0, state, weapon: w.id, reason: 'flash' };
    }
    if (state === 'close' && !ignoresRange && rng() < CLOSE_MISS_CHANCE) {
      return { miss: true, dmg: 0, state, weapon: w.id, reason: 'close' };
    }
    let dmg = w.dmg;
    if (ownsWeapon(attacker)) dmg += OWN_WEAPON_BONUS;
    if (state === 'close' && !ignoresRange) dmg *= CLOSE_DMG_MUL;
    if (opts.betrayal) dmg *= BETRAYAL_MUL;
    // Gladan si → slabiji si. Traka gladi konačno nešto znači pre nego što padne na nulu.
    dmg *= survivalPenalty(attacker).dmgMul;
    if (tripod) dmg *= 2;
    return {
      miss: false, dmg: Math.max(1, Math.round(dmg)), state, weapon: w.id,
      poison: !!w.poison, entangle: !!w.entangle,
      usedTripod: tripod, adrenaline,
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
    // Mreža-zamka: napadaš kamerom, pa „uhvaćen u mrežu" znači da kamera ne radi
    if ((attacker.cameraBlockedUntilMs || 0) > now) return 'netted';
    // U dimu se niko ne detektuje u kadru — ni ti, ni meta
    if (ctx.inSmoke) return 'smoke';
    if (ctx.targetInSmoke) return 'smokeTarget';
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
  // 10 m je u gradu unutar same greške GPS-a (5–20 m između zgrada), pa je
  // radijus uzimanja podignut na 12 m.
  const BASE_SLOTS = 4, PICKUP_RADIUS_M = 12;
  const ITEM_RESPAWN_MS = 90000, ITEM_MOVE_MS = 600000, NO_PICKUP_AFTER_START_MS = 10000;

  /* Zamke: radijus 15 m, ali okidaju tek posle 5 s NEPREKIDNOG zadržavanja.
     Stari radijus od 10 m je bio unutar greške GPS-a, pa su zamke okidale na
     ljude koji nisu ni prišli. Uslov zadržavanja filtrira i drift i prolaznike,
     a tematski je bolji: zamka hvata onog ko se zadržava, ne onog ko projuri. */
  const TRAP_RADIUS_M = 15, TRAP_DWELL_MS = 5000;

  function slotsOf(p) {
    const cls = CLASSES[p && p.classId];
    let s = (p && p.capacity) || BASE_SLOTS;
    if (cls && cls.extraSlots) s += cls.extraSlots;
    return s;
  }
  /* Stack po TIPU, ne po retkosti: hrana i piće 3 po slotu, sve ostalo 1.
     Jasnije je i lakše se objasni igraču od „obično 3, neobično 2, retko 1". */
  const STACKABLE = { food: 3, drink: 3, ammo: 3 };
  function stackLimit(itemType) {
    const it = ITEMS[itemType];
    if (!it || it.bigItem) return 1;
    return STACKABLE[it.type] || 1;
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

  /**
   * Efekat konzumiranja predmeta — vraća izmene igrača.
   * `nowMs` je potreban za sve predmete sa trajanjem (kamera, alat).
   */
  function consume(p, itemType, rng, nowMs) {
    const it = ITEMS[itemType];
    if (!it) return null;
    const cls = CLASSES[p.classId] || {};
    const now = nowMs || 0;
    const out = {};
    const maxHunger = SURVIVAL.baseMax + (p.maxHungerBonus || 0);
    const maxThirst = SURVIVAL.baseMax + (p.maxThirstBonus || 0);
    let hp = p.hp, msg = null;

    if (it.hunger) out.hunger = Math.min(maxHunger, (p.hunger || 0) + it.hunger);
    if (it.thirst) out.thirst = Math.min(maxThirst, (p.thirst || 0) + it.thirst);
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

    /* Protivotrov briše ISTO polje koje piše borba (`poisonUntilMs`) i daje
       60 s imuniteta — inače je preuzak predmet za retkost „retko". */
    if (it.curesPoison) {
      out.poisonUntilMs = null;
      if (it.poisonImmuneMs) out.poisonImmuneUntilMs = now + it.poisonImmuneMs;
    }
    /* Pečurke uvek truju: nije 15% da te zezne, nego siguran trošak za
       najveću količinu hrane u divljini. Imunitet od protivotrova drži. */
    if (it.poisonsAlways && (p.poisonImmuneUntilMs || 0) <= now) {
      out.poisonUntilMs = now + POISON_MS;
      msg = 'poisoned';
    }

    if (it.maxHunger) out.maxHungerBonus = Math.min(50, (p.maxHungerBonus || 0) + it.maxHunger);
    if (it.maxThirst) out.maxThirstBonus = Math.min(50, (p.maxThirstBonus || 0) + it.maxThirst);
    if (it.slots) out.capacity = Math.max(p.capacity || BASE_SLOTS, it.slots);
    // Ranac je krupan: od trenutka kad ga obučeš vidi te se na 50 m, trajno.
    if (it.bulkyVisibleM) out.bulkyVisibleM = it.bulkyVisibleM;
    if (it.arrows) out.arrows = (p.arrows || 0) + it.arrows;
    if (it.quiver) out.hasQuiver = true;

    /* — kamera i borba — */
    if (it.flashMs) out.flashUntilMs = now + it.flashMs;
    if (it.tripodCharge) out.tripodCharges = (p.tripodCharges || 0) + 1;
    if (it.adrenalineMs) out.adrenalineUntilMs = now + it.adrenalineMs;
    if (it.shield) out.hasShield = true;
    /* Dim se pamti na igraču koji ga je bacio, sa mestom i rokom — tako svaki
       telefon može da izračuna sve aktivne zone iz spiska igrača, bez novog
       čvora u bazi koji bi trebalo posebno sinhronizovati. */
    if (it.smokeMs) {
      out.smokeUntilMs = now + it.smokeMs;
      out.smokeRadiusM = it.smokeRadiusM;
    }

    /* — izviđanje i alat — */
    if (it.light) out.torchUntilMs = now + it.light;
    if (it.nearestArrowMs) out.nearestArrowUntilMs = now + it.nearestArrowMs;
    if (it.scopeMs) out.scopeUntilMs = now + it.scopeMs;
    if (it.zonePeekMs) out.zonePeekUntilMs = now + it.zonePeekMs;
    if (it.hideAllMs) out.hiddenUntilMs = now + it.hideAllMs;
    if (it.flareRevealMs) out.revealedUntilMs = now + it.flareRevealMs;
    if (it.freePackage) out.freePackage = true;

    out.hp = U.clamp(Math.round(hp), 0, p.maxHp);
    if (msg) out._msg = msg;
    return out;
  }

  /* ═══════════════════ AKTIVNI EFEKTI (traka odbrojavača) ═══════════════════
     Sedam predmeta traje X minuta i do sada nigde nije pisalo koliko je ostalo
     — igrač ne može da planira oko nečega što ne vidi. Ovo je jedini izvor
     istine za tu traku, pa UI ne mora da zna imena polja. */
  const TIMED_EFFECTS = [
    { key: 'torchUntilMs',       id: 'torch',      icon: 'torch',  tone: 'gold'   },
    { key: 'hiddenUntilMs',      id: 'camo',       icon: 'eyeOff', tone: 'good'   },
    { key: 'adrenalineUntilMs',  id: 'adrenaline', icon: 'flame',  tone: 'gold'   },
    { key: 'flashUntilMs',       id: 'flash',      icon: 'sun',    tone: 'good'   },
    { key: 'smokeUntilMs',       id: 'smoke',      icon: 'cloud',  tone: 'good'   },
    { key: 'scopeUntilMs',       id: 'scope',      icon: 'binoculars', tone: 'good' },
    { key: 'zonePeekUntilMs',    id: 'zonePeek',   icon: 'map',    tone: 'good'   },
    { key: 'nearestArrowUntilMs',id: 'nearest',    icon: 'compass',tone: 'good'   },
    { key: 'revealedUntilMs',    id: 'revealed',   icon: 'alert',  tone: 'danger' },
    { key: 'poisonUntilMs',      id: 'poison',     icon: 'flask',  tone: 'danger' },
    { key: 'cameraBlockedUntilMs', id: 'netted',   icon: 'net',    tone: 'danger' },
    { key: 'entangledUntilMs',   id: 'entangled',  icon: 'net',    tone: 'danger' },
    { key: 'trackedUntilMs',     id: 'tracked',    icon: 'target', tone: 'danger' },
  ];
  /** Svi efekti koji upravo teku, sa preostalim vremenom u ms. */
  function activeEffects(p, nowMs) {
    if (!p) return [];
    const now = nowMs || 0;
    const out = [];
    for (const e of TIMED_EFFECTS) {
      const until = p[e.key] || 0;
      if (until > now) out.push({ ...e, untilMs: until, leftMs: until - now });
    }
    // Stativ i štit nemaju rok nego naboj — prikazuju se kao brojka
    if (p.tripodCharges > 0) out.push({ id: 'tripod', icon: 'crosshair', tone: 'gold', charges: p.tripodCharges });
    if (p.hasShield) out.push({ id: 'shield', icon: 'shield', tone: 'gold', charges: 1 });
    return out.sort((a, b) => (a.leftMs || Infinity) - (b.leftMs || Infinity));
  }

  /* ═══════════════════ DIM ═══════════════════
     Zona u kojoj kamera ne radi NIKOME, ni onom ko ju je bacio. Bacaš je da
     prekineš tuđi napad ili da se izvučeš iz kornukopije — nije pasivni buff. */
  function smokeZones(players, nowMs) {
    const out = [];
    for (const [pid, p] of Object.entries(players || {})) {
      if (!p || !(p.smokeUntilMs > nowMs) || !p.smokeAt) continue;
      out.push({
        ownerId: pid, lat: p.smokeAt.lat, lng: p.smokeAt.lng,
        radiusM: p.smokeRadiusM || ITEMS.smokeBomb.smokeRadiusM, untilMs: p.smokeUntilMs,
      });
    }
    return out;
  }
  const inSmoke = (zones, pos) => !!(pos && (zones || []).some((z) => U.dist(pos, z) <= z.radiusM));

  /* ═══════════════════ vidljivost (§5, §12, §15) ═══════════════════ */
  function visionFor(p, ctx) {
    const cls = CLASSES[p.classId] || {};
    let items = cls.itemVisionM || 15;
    if (ctx && ctx.night && !(ctx.hasLight)) items = Math.min(items, NIGHT_VISION_M);
    if (ctx && ctx.hasLight) items += ITEMS.torch.lightBonusM;
    /* Žedan si → slepiš. Ovo je jedina kazna koja se vidi bez otvaranja menija.

       ALI: vid za PIĆE ostaje pun. Da žeđ smanjuje i vid za vodu, upao bi u
       spiralu — što si žedniji, to ti je teže da nađeš vodu, pa si još
       žedniji. Ovako kazna i dalje boli (ne vidiš oružje, zamke, ni hranu),
       a igra ti ne oduzima način da je skineš. Tematski je i tačnije:
       očajan si i skeniraš okolinu tražeći baš vodu.                        */
    const pen = survivalPenalty(p);
    const full = Math.round(items);
    if (pen.visionCapM) items = Math.min(items, pen.visionCapM);
    const players = cls.playerVisionM || 0;
    return { itemsM: Math.round(items), drinksM: full, playersM: players, penalty: pen };
  }

  /**
   * Da li se `p` vidi na tuđoj mapi zbog nečega što sam nosi.
   * Baklja i ranac su jedina dva predmeta koja te ODAJU — i to je namerno:
   * oba su čista dobit bez toga.
   */
  function selfRevealM(p, nowMs) {
    if (!p) return 0;
    let m = 0;
    if ((p.torchUntilMs || 0) > (nowMs || 0)) m = Math.max(m, ITEMS.torch.revealsM);
    if (p.bulkyVisibleM) m = Math.max(m, p.bulkyVisibleM);
    return m;
  }

  return {
    CLASSES, CLASS_IDS, WEAPONS, OWN_WEAPON_BONUS, SPECIALS, warnsAt, rangeState,
    CLOSE_DMG_MUL, CLOSE_MISS_CHANCE,
    RARITY, PICKUP, pickupOf, ITEMS, ITEM_IDS, SPAWNABLE_IDS, STACKABLE, isRenewable,
    TIMED_EFFECTS, activeEffects, smokeZones, inSmoke, selfRevealM, survivalPenalty,
    TRAP_RADIUS_M, TRAP_DWELL_MS,
    RECOMMENDED, recommendFor, MIN_PLAYERS, MAX_PLAYERS, maxAllianceSize,
    dealClasses, classCensus,
    ZONE_PHASES, ZONE_WARN_MS, EVENTS, SPARK_COSTS, GM_COOLDOWN_MS, ghostEventBudget,
    DAY_MS, NIGHT_MS, DAY_CYCLE_MS, NIGHT_VISION_M, DURATION_STEP_MIN, isNight, dayPhase,
    SURVIVAL, survivalTick,
    buildSchedule, zoneAt, firewallAt, shiftSchedule,
    RARITY_W, CORN_RADIUS_M, EDGE_MARGIN_M, generateItems, generateArrowCaches, startPoints,
    SPARKS_PER_PLAYER, generateSparks, zoneAtPhaseSettled, SPARK_REACH_M, SPARK_ZONE_MARGIN_M, GHOST_OUTER_M,
    HALLUCINATION_MS, HALLUCINATION_POP_M, hallucinations,
    UNCONSCIOUS_MS, isUnconscious,
    MENTOR_FAVOR, QUESTS, QUEST_IDS, QUEST_TTL_MS, QUEST_HEAL, QUEST_MOVE_M, QUEST_FED,
    questOffer, questSatisfied, questExpired, mentorLimits, weaponRarity,
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
