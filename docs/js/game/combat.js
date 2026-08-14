/* ═══════════════════════════════════════════════════════════════════════════
   NAPAD (borba v4) — nema stanja borbe.

   Nema rundi, nema trake razdaljine 0–5, nema potere, nema čvorova `fights/`
   i `chase/`. Borba je fizička: kad se pomeriš uživo, pomerio si se i u igri.
   Napad je JEDNA akcija — nišaniš kamerom i uslikaš protivnika, a razdaljina
   u igri je prava razdaljina u metrima.

   Odbrana je takođe fizička: ako si za zidom ili iza ćoška, protivnik te ne
   može detektovati u kadru i napada nema. Zato ovde nema ni bloka.
   ═══════════════════════════════════════════════════════════════════════════ */
const Attack = (() => {
  'use strict';

  /* — kontekst za anti-varanje (§10) — */
  function ctxFor(d, target) {
    return {
      nowMs: d.now,
      startedAtMs: Store.meta().startedAtMs,
      myAccM: Geo.accuracy,
      outsideZone: !!d.outsideZone,
      lastMoveMs: (d.me || {}).lastMoveMs,
      // u dimu se niko ne detektuje u kadru — ni napadač ni meta
      inSmoke: !!d.inSmoke,
      targetInSmoke: !!(target && target.pos && R.inSmoke(d.smoke, target.pos)),
    };
  }

  /** Zašto napad nije moguć, ili null ako jeste. */
  function blockedReason(d, target) {
    if (!d.me) return 'dead';
    return R.attackBlocked(d.me, target, ctxFor(d, target));
  }

  /* — koliko još traje cooldown oružja, u sekundama — */
  function cooldownLeft(d) {
    const me = d.me;
    if (!me) return 0;
    return Math.max(0, ((me.weaponCooldownUntilMs || 0) - d.now) / 1000);
  }

  /**
   * Upiši udarac. Zove ga napadač pošto se nišanjenje završi.
   * `res` je rezultat iz R.attackDamage, `opts` nosi {photo, special, betrayal}.
   */
  async function land(d, targetId, distM, res, opts) {
    opts = opts || {};
    const me = d.me;
    const P = Store.players();
    const target = P[targetId];
    if (!target) return null;
    const now = Clock.now();

    const w = opts.weapon || R.weaponOf(me);
    const upd = {};                       // moj čvor
    const tUpd = {};                      // čvor žrtve

    // cooldown i municija idu i na promašaj — pokušaj se broji
    if (!opts.noCooldown) upd.weaponCooldownUntilMs = now + R.cooldownFor(me, w, now);
    upd.lastAttackAtMs = now;
    if (w.ammo === 'arrow') upd.arrows = Math.max(0, (me.arrows || 0) - 1);

    // Stativ se troši na svaki ispaljen kadar, i kad pogodi i kad promaši
    if (res.usedTripod) upd.tripodCharges = Math.max(0, (me.tripodCharges || 0) - 1);

    let hp = target.hp || 0;
    let shielded = false;
    if (!res.miss) {
      /* Štit upija JEDAN napad u celosti, pa puca. Namerno pre svega
         ostalog: ni otrov ni mreža ne prolaze kroz štit. */
      if (target.hasShield) {
        shielded = true;
        tUpd.hasShield = null;
        upd.attacksLanded = (me.attacksLanded || 0) + 1;
      } else {
        hp = Math.max(0, hp - res.dmg);
        tUpd.hp = hp;
        upd.damageDone = (me.damageDone || 0) + res.dmg;
        upd.attacksLanded = (me.attacksLanded || 0) + 1;
        if (res.entangle && !(R.CLASSES[target.classId] || {}).immuneToEntangle) {
          tUpd.entangledUntilMs = now + R.ENTANGLE_MS;
        }
        // otrov se ne slaže, novi pogodak samo produžava trajanje;
        // protivotrov daje 60 s imuniteta i za vreme njega otrov ne prima
        if (res.poison && (target.poisonImmuneUntilMs || 0) <= now) {
          tUpd.poisonUntilMs = now + R.POISON_MS;
        }
      }
    } else {
      upd.attacksMissed = (me.attacksMissed || 0) + 1;
    }

    await Store.updateMe(upd);
    if (Object.keys(tUpd).length) await Store.ref(`players/${targetId}`).update(tUpd);

    // svaki udarac je dokaz — feed duhovima i recap na kraju (§10, §11)
    await Store.pushHit({
      attackerId: Store.myId, victimId: targetId, weapon: w.id,
      distanceM: Math.round(distM), damage: res.miss || shielded ? 0 : res.dmg,
      missed: !!res.miss, shielded, special: opts.special || null, photoRef: opts.photo || null,
    });

    if (!res.miss) {
      // žrtva vidi ko ju je pogodio, čime i sa koje strane (§4)
      await Store.ref(`players/${targetId}/incomingHit`).set({
        from: Store.myId, weapon: w.id, dmg: shielded ? 0 : res.dmg, atMs: now,
        distM: Math.round(distM), shielded,
        bearing: target.pos && me.pos ? U.bearing(target.pos, me.pos) : null,
        special: opts.special || null,
      });
    }

    const killed = hp <= 0 && !res.miss && !shielded;
    if (killed) await kill(targetId, target);
    return { hp, killed, shielded };
  }

  /** Smrt: top svima, sve pada na mesto smrti, ubici +1 (§5). */
  async function kill(targetId, target) {
    const me = Store.me();
    await Store.ref(`players/${targetId}`).update({
      alive: false, hp: 0, deathAtMs: Clock.now(), killedBy: Store.myId, deathCause: 'hit',
    });
    await Store.updateMe({ kills: (me.kills || 0) + 1 });
    await dropLoot(targetId, target);
    await Store.pushFeed({ type: 'death', subjectId: targetId, killerId: Store.myId, scope: 'all', cause: 'hit' });
  }

  /** Sav inventar i oružje padaju na mesto smrti kao obični predmeti (§5). */
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

  /* ═══════════════ specijali — jednom po IGRI ═══════════════ */

  /** Zašto specijal nije moguć, ili null. */
  function specialBlocked(d, targetId, distM) {
    const me = d.me;
    const sp = R.SPECIALS[me.classId];
    if (!sp) return 'class';
    if (me.specialUsedThisGame) return 'used';
    if (!R.ownsWeapon(me) && me.classId !== 'gatherer' && me.classId !== 'runner') return 'weapon';
    if (sp.maxM != null && distM != null && distM > sp.maxM) return 'far';
    if (sp.id === 'backstab') {
      const t = Store.players()[targetId];
      if (!t || !t.pos || !me.pos) return 'far';
      const brg = U.bearing(t.pos, me.pos);
      if (!R.isBackTurned(t.headingDeg, brg, sp.facingTolDeg)) return 'facing';
    }
    return null;
  }

  /**
   * Odigraj specijal. Vraća {ok, reason} ili {ok:true, res} kad je udarac.
   * Specijali bez cilja (Zaliha, Drugi vetar, Velika mreža) ne traže `targetId`.
   */
  async function special(d, targetId, distM, opts) {
    opts = opts || {};
    const me = d.me;
    const sp = R.SPECIALS[me.classId];
    if (!sp) return { ok: false, reason: 'class' };
    const now = Clock.now();

    if (sp.id === 'stash') {                                   // Sakupljač
      await Store.updateMe({
        specialUsedThisGame: true,
        hunger: 100 + (me.maxHungerBonus || 0),
        thirst: 100 + (me.maxThirstBonus || 0),
        lastTickMs: now,
      });
      return { ok: true, kind: 'self' };
    }
    if (sp.id === 'secondWind') {                              // Trkač
      await Store.updateMe({ specialUsedThisGame: true, secondWindUntilMs: now + sp.durationMs });
      return { ok: true, kind: 'self' };
    }
    if (sp.id === 'bigNet') {                                  // Zamkar
      const P = Store.players(), pos = Geo.pos;
      if (!pos) return { ok: false, reason: 'gps' };
      const upd = {};
      let n = 0;
      for (const [pid, p] of Object.entries(P)) {
        if (pid === Store.myId || p.alive === false || !p.pos) continue;
        if ((R.CLASSES[p.classId] || {}).immuneToEntangle) continue;
        if (U.dist(pos, p.pos) > sp.radiusM) continue;
        upd[`${pid}/entangledUntilMs`] = now + sp.entangleMs;
        n++;
      }
      if (Object.keys(upd).length) await Store.ref('players').update(upd);
      await Store.updateMe({ specialUsedThisGame: true });
      return { ok: true, kind: 'area', count: n };
    }
    if (sp.id === 'potion') {                                  // Lekar
      const healTarget = targetId || Store.myId;
      const t = Store.players()[healTarget];
      if (!t) return { ok: false, reason: 'target' };
      const hp = Math.min(t.maxHp || 100, (t.hp || 0) + sp.heal);
      await Store.ref(`players/${healTarget}`).update({ hp });
      await Store.updateMe({ specialUsedThisGame: true });
      return { ok: true, kind: 'heal', healed: healTarget, hp };
    }

    // ostali su udarci
    const why = specialBlocked(d, targetId, distM);
    if (why) return { ok: false, reason: why };
    const w = R.weaponOf(me);
    const res = {
      miss: false, dmg: sp.dmg, state: 'in', weapon: w.id,
      poison: false, entangle: false,
    };
    await Store.updateMe({ specialUsedThisGame: true });
    const out = await land(d, targetId, distM, res, {
      special: sp.id, photo: opts.photo, weapon: w,
      noCooldown: sp.id === 'volley',
    });
    // Ribar gubi trozubac, pada kod žrtve (§6)
    if (sp.losesWeapon) {
      const t = Store.players()[targetId];
      await Store.updateMe({ weapon: 'fists' });
      if (t && t.pos) await Store.dropItem('wTrident', 'legendary', t.pos.lat, t.pos.lng, 1);
    }
    await Store.pushFeed({ type: 'special', subjectId: Store.myId, targetId, special: sp.id, scope: 'all' });
    return { ok: true, kind: 'hit', res, out };
  }

  /* ═══════════════ otkucaj: otrov i isticanje efekata ═══════════════ */
  let lastPoisonMs = 0;

  async function tick(d) {
    const me = d.me;
    if (!me || me.alive === false) { lastPoisonMs = 0; return; }
    const now = d.now;

    // otrov duvaljke: 3 HP na 10 s dok traje (§2)
    const until = me.poisonUntilMs || 0;
    if (until > 0) {
      if (!lastPoisonMs) lastPoisonMs = Math.max(now - R.POISON_TICK_MS, until - R.POISON_MS);
      const dmg = R.poisonDamage(lastPoisonMs, now, until);
      if (dmg > 0) {
        lastPoisonMs += Math.floor(dmg / R.POISON_DMG) * R.POISON_TICK_MS;
        const hp = Math.max(0, (me.hp || 0) - dmg);
        await Store.updateMe({ hp });
        if (hp <= 0) Engine.die('poison');
      }
      if (now >= until) { lastPoisonMs = 0; await Store.updateMe({ poisonUntilMs: null }); }
    } else lastPoisonMs = 0;
  }

  return {
    blockedReason, cooldownLeft, land, kill, dropLoot,
    special, specialBlocked, tick,
  };
})();
