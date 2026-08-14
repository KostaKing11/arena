/* Botovi za `/arena/test` (§21). Vodi ih domaćinov telefon.
   Hodaj 1,4 m/s, skreni ka predmetu u blizini, napadni igrača, beži ispod 30 HP.

   Brojke ispod su NAMERNO agresivnije od §21 (koji kaže „napadni na 20 m"):
   botovi postoje samo da bi se igra mogla isprobati sama, a sa lutanjem po
   nasumičnim tačkama i čekanjem da im neko priđe do borbe se skoro nikad nije
   stizalo. Ovo ne menja pravila prave partije — botovi u njoj ne postoje. */
const Bots = (() => {
  'use strict';
  const HUNT_M = 120;        // koliko daleko bot traži plen
  const FLEE_HP = 30;        // ispod ovoga se ne lovi, nego beži (§21)
  const S = new Map();
  const NAMES = ['Kato', 'Marvel', 'Glimer', 'Treš', 'Foxface', 'Klov', 'Ruta', 'Brutus',
    'Enobarija', 'Fineas', 'Džoana', 'Bister', 'Vajres', 'Sejder', 'Gloss', 'Kašmir'];
  let lastMs = 0;

  const st = (pid) => {
    if (!S.has(pid)) S.set(pid, { wp: null, moveAt: 0, thinkAt: 0, speed: 1.2 + Math.random() * 0.5 });
    return S.get(pid);
  };

  /** Host dodaje botove u lobiju. */
  async function seed(n) {
    const used = new Set(Object.values(Store.players()).map((p) => p.name));
    const upd = {};
    for (let i = 0; i < n; i++) {
      const free = NAMES.filter((x) => !used.has(x));
      const name = free.length ? free[Math.floor(Math.random() * free.length)] : 'Bot' + (i + 1);
      used.add(name);
      const pid = U.uid('b');
      upd[pid] = {
        name, isBot: true, online: true, alive: true,
        hp: 100, maxHp: 100, hunger: 100, thirst: 100,
        kills: 0, distanceWalkedM: 0, fights: 0, damageDone: 0, itemsTaken: 0,
        capacity: R.BASE_SLOTS, weapon: 'fists', arrows: 0,
        ready: true, arrived: true, hasFace: false,
        avatar: randomAvatar(), joinedAt: Date.now(),
        perms: { location: true, camera: true, compass: true },
      };
    }
    await Store.hostUpdate('players', upd);
  }

  /* Ručke za testiranje: bez njih te botovi nađu, ubiju, i partija se pravi
     iznova samo da bi se isprobala jedna stvar. */
  let frozen = false, passive = false;

  async function step(d) {
    if (frozen) return;
    if (d.now - lastMs < 1500) return;
    const dt = Math.min(6, (d.now - lastMs) / 1000);
    lastMs = d.now;
    if (d.state !== 'LIVE' && d.state !== 'FINAL_TWO' && d.state !== 'PREP') return;
    if (d.paused) return;

    const P = Store.players(), cfg = d.cfg;
    const zone = d.zone;
    const items = Store.items();

    for (const [pid, p] of Object.entries(P)) {
      if (!p.isBot || p.alive === false) continue;
      const b = st(pid);
      const upd = {};

      if (!p.pos) {
        const sp = p.startPos || cfg.center;
        upd.pos = { lat: sp.lat, lng: sp.lng, accM: 5, atMs: d.now };
        await Store.ref(`players/${pid}`).update(upd);
        continue;
      }
      const pos = { lat: p.pos.lat, lng: p.pos.lng };

      // ranjen bot beži od najbližeg igrača umesto da lovi
      if ((p.hp || 100) < FLEE_HP) {
        let near = null, nd = 1e9;
        for (const [qid, q] of Object.entries(P)) {
          if (qid === pid || q.alive === false || !q.pos) continue;
          const m = U.dist(pos, q.pos);
          if (m < nd && m < 40) { nd = m; near = q; }
        }
        if (near) {
          const away = U.destPoint(pos, U.bearing(near.pos, pos), b.speed * dt * 1.4);
          upd.pos = { lat: away.lat, lng: away.lng, accM: 5, atMs: d.now };
          await Store.ref(`players/${pid}`).update(upd);
          continue;
        }
      }

      /* — glad i žeđ i zona: host ih primenjuje umesto bota — */
      const cls = R.CLASSES[p.classId];
      const patch = R.survivalTick(p, cls, d.now - (p.lastTickMs || d.now), {
        nowMs: d.now, drought: d.drought,
        outsideZone: zone ? U.dist(pos, zone.center) > zone.radiusM : false,
        zoneDmgPer10s: zone ? zone.dmgPer10s : 0,
      });
      if (patch && d.state !== 'PREP') {
        Object.assign(upd, { hunger: patch.hunger, thirst: patch.thirst, hp: patch.hp, lastTickMs: patch.lastTickMs });
        if (patch.hp <= 0) {
          await Store.ref(`players/${pid}`).update({ alive: false, hp: 0, deathAtMs: d.now, deathCause: 'zone' });
          await Store.pushFeed({ type: 'death', subjectId: pid, scope: 'all', cause: 'zone' });
          continue;
        }
      }
      if (d.state === 'PREP') { await Store.ref(`players/${pid}`).update(upd); continue; }

      /* — cilj kretanja —
         Prvo lov. Botovi su ranije samo lutali ka nasumičnoj tački i čekali da
         im neko priđe na 20 m, pa se u testu do borbe skoro nikad nije stizalo.
         Sada aktivno idu ka najbližem igraču u dometu `HUNT_M`. */
      let target = null;
      if (zone && U.dist(pos, zone.center) > zone.radiusM * 0.85) target = zone.center;
      if (!target && (p.hp || 100) >= FLEE_HP) {
        let prey = null, pd = 1e9;
        for (const [qid, q] of Object.entries(P)) {
          if (qid === pid || q.alive === false || !q.pos) continue;
          if (q.allianceId && q.allianceId === p.allianceId) continue;
          const m = U.dist(pos, q.pos);
          if (m < pd && m < HUNT_M) { pd = m; prey = q; }
        }
        // predmet tik uz put je i dalje vredniji od trčanja kroz pola arene
        if (prey) target = { lat: prey.pos.lat, lng: prey.pos.lng };
      }
      if (!target) {
        let best = null, bd = 1e9;
        for (const [iid, it] of Object.entries(items)) {
          if (it.takenBy) continue;
          const m = U.dist(pos, it);
          if (m < bd && m < 60) { bd = m; best = { iid, it, m }; }
        }
        if (best) {
          target = { lat: best.it.lat, lng: best.it.lng };
          if (best.m <= R.PICKUP_RADIUS_M && Math.random() < 0.6) {
            const ok = await Store.ref(`items/${best.iid}/takenBy`).transaction((c) => (c == null ? pid : undefined));
            if (ok.committed) {
              const def = R.ITEMS[best.it.type];
              if (def.weapon) upd.weapon = def.weapon;
              else if (def.arrows) upd.arrows = (p.arrows || 0) + def.arrows;
              else {
                const c2 = R.consume(p, best.it.type, Math.random);
                Object.assign(upd, { hp: U.clamp(c2.hp, 0, p.maxHp || 100), hunger: c2.hunger != null ? c2.hunger : upd.hunger, thirst: c2.thirst != null ? c2.thirst : upd.thirst });
              }
              upd.itemsTaken = (p.itemsTaken || 0) + 1;
            }
          }
        }
      }
      if (!target) {
        if (!b.wp || U.dist(pos, b.wp) < 10) {
          const r = zone ? zone.radiusM * 0.8 : cfg.diameterM / 2;
          b.wp = U.pointInCircle(Math.random, zone ? zone.center : cfg.center, r);
        }
        target = b.wp;
      }

      const stepM = 1.4 * dt;
      const np = U.dist(pos, target) <= stepM ? target : U.destPoint(pos, U.bearing(pos, target), stepM);
      upd.pos = { lat: np.lat, lng: np.lng, accM: 5, atMs: d.now };
      upd.distanceWalkedM = Math.round((p.distanceWalkedM || 0) + stepM);

      /* — udarac: borba v4, jedna akcija, bez stanja —
         Bot ne nišani kamerom (nema je), ali poštuje isti opseg oružja,
         cooldown i uplitanje kao igrač. */
      const bw = R.weaponOf(p);
      if (!passive && (p.hp || 100) >= FLEE_HP
          && (p.weaponCooldownUntilMs || 0) <= d.now
          && (p.entangledUntilMs || 0) <= d.now) {
        for (const [qid, q] of Object.entries(P)) {
          if (qid === pid || q.alive === false || !q.pos) continue;
          if (q.allianceId && q.allianceId === p.allianceId) continue;
          const m = U.dist(np, q.pos);
          if (R.rangeState(bw, m) === 'far') continue;
          const res = R.attackDamage(p, m, {});
          upd.weaponCooldownUntilMs = d.now + R.cooldownFor(p, bw, d.now);
          upd.lastAttackAtMs = d.now;
          if (bw.ammo === 'arrow') upd.arrows = Math.max(0, (p.arrows || 0) - 1);
          if (res.miss) { upd.attacksMissed = (p.attacksMissed || 0) + 1; break; }

          const hp = Math.max(0, (q.hp || 0) - res.dmg);
          upd.damageDone = (p.damageDone || 0) + res.dmg;
          upd.attacksLanded = (p.attacksLanded || 0) + 1;
          const tUpd = { hp };
          if (res.entangle && !(R.CLASSES[q.classId] || {}).immuneToEntangle) {
            tUpd.entangledUntilMs = d.now + R.ENTANGLE_MS;
          }
          if (res.poison) tUpd.poisonUntilMs = d.now + R.POISON_MS;
          tUpd.incomingHit = {
            from: pid, weapon: bw.id, dmg: res.dmg, atMs: d.now,
            distM: Math.round(m), bearing: U.bearing(q.pos, np),
          };
          await Store.ref(`players/${qid}`).update(tUpd);
          await Store.pushHit({
            attackerId: pid, victimId: qid, weapon: bw.id,
            distanceM: Math.round(m), damage: res.dmg, missed: false,
          });
          if (hp <= 0) {
            upd.kills = (p.kills || 0) + 1;
            await Store.ref(`players/${qid}`).update({
              alive: false, hp: 0, deathAtMs: d.now, killedBy: pid, deathCause: 'hit',
            });
            await Attack.dropLoot(qid, q);
            await Store.pushFeed({ type: 'death', subjectId: qid, killerId: pid, scope: 'all', cause: 'hit' });
          }
          break;
        }
      }
      await Store.ref(`players/${pid}`).update(upd);
    }
  }

  /** Dovedi bota tik uz mene — da se napad moze isprobati bez trcanja. */
  async function bring(pid, meters) {
    const pos = Geo.pos;
    if (!pos) return false;
    const p = U.destPoint(pos, Math.random() * 360, meters == null ? 2 : meters);
    await Store.ref(`players/${pid}`).update({
      pos: { lat: p.lat, lng: p.lng, accM: 5, atMs: Clock.now() },
    });
    S.delete(pid);                       // zaboravi staru putnu tacku
    return true;
  }

  return {
    seed, step, NAMES, bring,
    get frozen() { return frozen; }, setFrozen(v) { frozen = !!v; },
    get passive() { return passive; }, setPassive(v) { passive = !!v; },
  };
})();
