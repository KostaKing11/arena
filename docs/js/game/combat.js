/* Borba (§8) i bekstvo/potera (§9).
   Rundu presuđuje bilo koji od dvojice — `resolveRound` je čista funkcija, pa
   oba telefona dobiju isto; transakcija sprečava da se runda odigra dvaput. */
const Combat = (() => {
  'use strict';
  let curFid = null, lastRound = 0, resolving = false;

  const myFight = () => {
    const me = Store.me();
    if (!me || !me.fightId) return null;
    const f = Store.fights()[me.fightId];
    return f ? { fid: me.fightId, ...f } : null;
  };
  const sideOf = (f) => (f.a === Store.myId ? 'A' : 'B');
  const foeIdOf = (f) => (f.a === Store.myId ? f.b : f.a);
  const myHp = (f) => (sideOf(f) === 'A' ? f.hpA : f.hpB);
  const foeHp = (f) => (sideOf(f) === 'A' ? f.hpB : f.hpA);

  async function submit(kind, move) {
    const f = myFight();
    if (!f || f.state !== 'live') return;
    if ((f.moves || {})[Store.myId]) return;
    await Store.submitMove(f.fid, kind === 'move' ? { kind: 'move', move } : { kind });
    Haptics.fire('tap');
  }

  /** Poziva se svake sekunde iz motora. */
  async function tick(d) {
    const f = myFight();
    if (!f) { curFid = null; return; }
    if (f.fid !== curFid) { curFid = f.fid; lastRound = 0; }

    if (f.state !== 'live') return;
    const moves = f.moves || {};
    const both = moves[f.a] && moves[f.b];
    const expired = d.now >= (f.deadlineMs || 0);
    if (!both && !expired) return;
    if (resolving) return;

    resolving = true;
    const P = Store.players();
    const round = f.round;
    try {
      const res = await Store.fightRef(f.fid).transaction((cur) => {
        if (!cur || cur.state !== 'live' || cur.round !== round) return;      // neko je već presudio
        const shape = {
          a: cur.a, b: cur.b, distance: cur.distance, hpA: cur.hpA, hpB: cur.hpB,
          round: cur.round, effA: cur.effA || {}, effB: cur.effB || {},
          specialUsedA: !!cur.specialUsedA, specialUsedB: !!cur.specialUsedB,
          arrowsA: cur.arrowsA, arrowsB: cur.arrowsB,
        };
        const r = R.resolveRound(shape, cur.moves || {}, P);
        cur.distance = r.distance; cur.hpA = r.hpA; cur.hpB = r.hpB;
        cur.round = r.round; cur.effA = r.effA; cur.effB = r.effB;
        cur.specialUsedA = r.specialUsedA; cur.specialUsedB = r.specialUsedB;
        cur.arrowsA = r.arrowsA; cur.arrowsB = r.arrowsB;
        cur.moves = null;
        cur.lastLog = r.log;
        cur.deadlineMs = Date.now() + R.ROUND_MS;
        cur.state = r.state;
        cur.winner = r.winner || null;
        cur.fled = r.fled || null;
        cur.settledBy = r.state !== 'live' ? Store.myId : null;
        return cur;
      });
      if (res.committed) {
        const v = res.snapshot.val();
        if (v.state !== 'live' && v.settledBy === Store.myId) await settle(f.fid, v);
      }
    } catch (e) { console.error(e); }
    resolving = false;
  }

  /** Ishod borbe upisuje onaj čija je transakcija prošla. */
  async function settle(fid, f) {
    const P = Store.players();
    const upd = {};
    upd[`${f.a}/hp`] = Math.max(0, f.hpA);
    upd[`${f.b}/hp`] = Math.max(0, f.hpB);
    upd[`${f.a}/fights`] = (P[f.a].fights || 0) + 1;
    upd[`${f.b}/fights`] = (P[f.b].fights || 0) + 1;
    upd[`${f.a}/lastFight/${f.b}`] = Clock.now();
    upd[`${f.b}/lastFight/${f.a}`] = Clock.now();

    if (f.state === 'chase') {
      // bekstvo: pokreni poteru sa OBAVEZNOM zastavicom leftRadius (§9)
      const fleeing = f.fled, chaser = fleeing === f.a ? f.b : f.a;
      await Store.startChase(fid, fleeing, chaser);
      upd[`${fleeing}/chaseId`] = fid;
      upd[`${chaser}/chaseId`] = fid;
      // dok traje potera nisi "u borbi" — Chase.rejoin vraća fightId kad se sustignete
      upd[`${fleeing}/fightId`] = null;
      upd[`${chaser}/fightId`] = null;
    } else {
      upd[`${f.a}/fightId`] = null;
      upd[`${f.b}/fightId`] = null;
      if (f.winner) {
        const loser = f.winner === f.a ? f.b : f.a;
        upd[`${f.winner}/kills`] = (P[f.winner].kills || 0) + 1;
        upd[`${loser}/alive`] = false;
        upd[`${loser}/hp`] = 0;
        upd[`${loser}/deathAtMs`] = Clock.now();
        upd[`${loser}/killedBy`] = f.winner;
        upd[`${loser}/deathCause`] = 'fight';
        await dropLoot(loser, P[loser]);
        await Store.pushFeed({ type: 'death', subjectId: loser, killerId: f.winner, scope: 'all', cause: 'fight' });
      }
    }
    await Store.ref('players').update(upd);
    // otrov Lekara traje i 2 min posle borbe (§8)
    const eff = (side) => (side === 'A' ? f.effA : f.effB) || {};
    for (const [pid, side] of [[f.a, 'A'], [f.b, 'B']]) {
      if ((eff(side === 'A' ? 'B' : 'A').poisonRounds || 0) > 0) {
        await Store.ref(`players/${pid}/effects/poisonedUntilMs`).set(Clock.now() + 120000);
      }
    }
  }

  /** Gubitnik ispušta SVE na svojoj GPS lokaciji (§8). */
  async function dropLoot(pid, p) {
    if (!p || !p.pos) return;
    for (const s of (p.inv || []).filter(Boolean)) {
      const def = R.ITEMS[s.itemType];
      await Store.dropItem(s.itemType, def ? def.rarity : 'common', p.pos.lat, p.pos.lng, s.qty || 1);
    }
    if (p.weapon && p.weapon !== 'fists') {
      const key = 'w' + p.weapon.charAt(0).toUpperCase() + p.weapon.slice(1);
      if (R.ITEMS[key]) await Store.dropItem(key, R.ITEMS[key].rarity, p.pos.lat, p.pos.lng, 1);
    }
    await Store.ref(`players/${pid}`).update({ inv: null, weapon: 'fists', arrows: 0 });
  }

  /** Bekstvo iz borbe: protivnik dobija jedan besplatan udarac (§9). */
  async function flee() {
    const f = myFight();
    if (!f || f.state !== 'live') return;
    const me = Store.me();
    const cls = R.CLASSES[me.classId] || {};
    if (cls.cannotFlee) { toast(T('aimBlocked'), 'danger'); return; }
    if (me.cannotFleeUntilMs > Clock.now()) { toast(T('aimBlocked'), 'danger'); return; }

    const foeId = foeIdOf(f);
    const foe = Store.players()[foeId];
    // Trkač je izuzet od besplatnog udarca
    if (cls.freeHitOnFlee !== false) {
      const hit = R.attackDamage(foe, f.distance, {});
      if (!hit.miss) {
        const side = sideOf(f);
        const newHp = Math.max(0, (side === 'A' ? f.hpA : f.hpB) - hit.dmg);
        await Store.fightRef(f.fid).update(side === 'A' ? { hpA: newHp } : { hpB: newHp });
        await Store.updateMe({ hp: newHp });
        Haptics.fire('hurt'); Sfx.hurt();
        toast(T('chaseFreeHit') + ' −' + hit.dmg, 'danger', 'swords');
        if (newHp <= 0) { await Store.fightRef(f.fid).update({ state: 'done', winner: foeId, settledBy: Store.myId }); return; }
      }
    }
    await Store.submitMove(f.fid, { kind: 'flee' });
  }

  return { myFight, sideOf, foeIdOf, myHp, foeHp, submit, tick, flee, dropLoot, settle };
})();

/* ═══════════════════════════════════════════════════════════════════════════
   POTERA (§9) — zastavica `leftRadius` je suština.
   Bez nje bi se borba nastavila istog trena po pokretanju, jer si i dalje
   na 0 m od protivnika. Tek kad jednom izađeš van 20 m, prilazak na 8 m
   ponovo pokreće borbu.
   ═══════════════════════════════════════════════════════════════════════════ */
const Chase = (() => {
  'use strict';
  let outsideSince = 0;

  const mine = () => {
    const me = Store.me();
    if (!me || !me.chaseId) return null;
    const c = Store.chases()[me.chaseId];
    return c ? { fid: me.chaseId, ...c } : null;
  };
  const isFleeing = () => { const c = mine(); return !!c && c.fleeing === Store.myId; };
  const isChasing = () => { const c = mine(); return !!c && c.chaser === Store.myId; };

  async function tick(d) {
    const c = mine();
    if (!c) { outsideSince = 0; return; }
    const me = Store.me();
    const otherId = c.fleeing === Store.myId ? c.chaser : c.fleeing;
    const other = Store.players()[otherId];
    const now = d.now;

    if (!me || me.alive === false || !other || other.alive === false) return end(c, 'dead');
    if (now - c.startedAtMs > R.CHASE.timeoutMs) return end(c, 'escaped');   // 90 s bez ishoda

    const a = Geo.pos, b = other.pos;
    if (!a || !b) return;
    const m = U.dist(a, b);

    // Zastavica: jednom kad se izađe van 20 m, otključava se povratak u borbu.
    if (!c.leftRadius && m > R.CHASE.escapeRadiusM) {
      await Store.chaseRef(c.fid).update({ leftRadius: true, leftAtMs: now });
      outsideSince = now;
    }
    if (c.leftRadius) {
      if (m > R.CHASE.escapeRadiusM) {
        if (!outsideSince) outsideSince = now;
        const cls = R.CLASSES[Store.players()[c.fleeing].classId] || {};
        const need = (cls.fleeSeconds || R.CHASE.escapeSec) * 1000;
        if (now - outsideSince >= need) return end(c, 'escaped');
      } else {
        outsideSince = 0;
        // tek sada prilazak na 8 m nastavlja borbu, na razdaljini 0
        if (m <= R.CHASE.rejoinRadiusM) return rejoin(c);
      }
    }
  }

  async function rejoin(c) {
    await Store.chaseRef(c.fid).remove();
    const f = Store.fights()[c.fid];
    if (!f) return;
    await Store.fightRef(c.fid).update({
      state: 'live', distance: 0, round: (f.round || 1),
      deadlineMs: Clock.now() + R.ROUND_MS, moves: null, fled: null,
    });
    await Store.ref('players').update({
      [`${c.fleeing}/chaseId`]: null, [`${c.chaser}/chaseId`]: null,
      [`${c.fleeing}/fightId`]: c.fid, [`${c.chaser}/fightId`]: c.fid,
    });
    toast(T('chaseCaught'), 'danger', 'swords');
    Haptics.fire('hurt');
  }

  async function end(c, why) {
    await Store.chaseRef(c.fid).remove();
    const f = Store.fights()[c.fid];
    if (f) await Store.fightRef(c.fid).update({ state: 'done', winner: null });
    const upd = {
      [`${c.fleeing}/chaseId`]: null, [`${c.chaser}/chaseId`]: null,
      [`${c.fleeing}/fightId`]: null, [`${c.chaser}/fightId`]: null,
    };
    if (why === 'escaped') {
      // 60 s imuniteta na ponovno slikanje od istog igrača (§9)
      upd[`${c.fleeing}/immuneTo/${c.chaser}`] = Clock.now() + R.CHASE.immunityMs;
    }
    await Store.ref('players').update(upd);
    if (why === 'escaped') {
      toast(isFleeing() ? T('chaseEscaped') : T('chaseEscaped'), 'good', 'run');
      Haptics.fire('win');
    }
    outsideSince = 0;
  }

  /** Podaci za ekran bekstva. */
  function view(d) {
    const c = mine();
    if (!c) return null;
    const otherId = c.fleeing === Store.myId ? c.chaser : c.fleeing;
    const other = Store.players()[otherId];
    const a = Geo.pos, b = other && other.pos;
    const m = a && b ? U.dist(a, b) : null;
    const cls = R.CLASSES[(Store.players()[c.fleeing] || {}).classId] || {};
    const need = cls.fleeSeconds || R.CHASE.escapeSec;
    let left = need;
    if (c.leftRadius && m != null && m > R.CHASE.escapeRadiusM && outsideSince) {
      left = Math.max(0, need - (d.now - outsideSince) / 1000);
    }
    return {
      fid: c.fid, fleeing: c.fleeing === Store.myId, other, otherId,
      distM: m, leftRadius: !!c.leftRadius, secondsLeft: left, need,
      bearing: a && b ? U.bearing(a, b) : null,
      timeoutIn: Math.max(0, (c.startedAtMs + R.CHASE.timeoutMs - d.now) / 1000),
    };
  }

  return { mine, isFleeing, isChasing, tick, view, end };
})();
