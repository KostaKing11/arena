/* Botovi za `/arena/test` (§21). Vodi ih domaćinov telefon.
   Hodaj 1,4 m/s, skreni ka predmetu u blizini, napadni igrača, beži ispod 30 HP.

   Brojke ispod su NAMERNO agresivnije od §21 (koji kaže „napadni na 20 m"):
   botovi postoje samo da bi se igra mogla isprobati sama, a sa lutanjem po
   nasumičnim tačkama i čekanjem da im neko priđe do borbe se skoro nikad nije
   stizalo. Ovo ne menja pravila prave partije — botovi u njoj ne postoje. */
const Bots = (() => {
  'use strict';
  const HUNT_M = 120;        // koliko daleko bot traži plen
  const ATTACK_M = 30;       // na kojoj razdaljini kreće borba
  const THINK_MS = 6000;     // pauza pre nego što ponovo razmišlja o napadu
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

  async function step(d) {
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

      /* — u borbi: bira potez — */
      if (p.fightId) {
        const f = Store.fights()[p.fightId];
        if (!f || f.state !== 'live') continue;
        if ((f.moves || {})[pid]) continue;
        if (d.now < b.moveAt) continue;
        b.moveAt = d.now + 1500 + Math.random() * 3500;
        const isA = f.a === pid;
        const hp = isA ? f.hpA : f.hpB;
        if (hp < 30 && Math.random() < 0.5) {
          await Store.ref(`fights/${p.fightId}/moves/${pid}`).set({ kind: 'flee' });
          continue;
        }
        const w = R.weaponOf(p);
        const inR = R.inRange(w, f.distance);
        const move = inR ? (Math.random() < 0.65 ? 'attack' : 'block')
          : (f.distance < w.min ? 'retreat' : 'approach');
        await Store.ref(`fights/${p.fightId}/moves/${pid}`).set({ kind: 'move', move });
        continue;
      }
      if (p.chaseId) {
        // beži pravo od progonioca
        const c = Store.chases()[p.chaseId];
        const other = c && P[c.fleeing === pid ? c.chaser : c.fleeing];
        if (other && other.pos) {
          const away = U.destPoint(pos, (U.bearing(other.pos, pos)), b.speed * dt * 1.4);
          upd.pos = { lat: away.lat, lng: away.lng, accM: 5, atMs: d.now };
          await Store.ref(`players/${pid}`).update(upd);
        }
        continue;
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

      /* — napad na igrača u blizini — */
      if ((p.hp || 100) >= FLEE_HP && d.now > (b.thinkAt || 0)) {
        for (const [qid, q] of Object.entries(P)) {
          if (qid === pid || q.alive === false || q.fightId || q.chaseId || !q.pos) continue;
          if (q.allianceId && q.allianceId === p.allianceId) continue;
          const m = U.dist(np, q.pos);
          if (m > ATTACK_M) continue;
          if (Clock.now() - ((p.lastFight || {})[qid] || 0) < R.FIGHT_COOLDOWN_MS) continue;
          b.thinkAt = d.now + THINK_MS;
          const band = R.distanceBand(m, false);
          if (band < 0) break;
          const t1 = await Store.ref(`players/${qid}/fightId`).transaction((c) => (c == null ? 'pending' : undefined));
          if (!t1.committed) break;
          const fid = U.uid('f');
          await Store.ref(`players/${qid}/fightId`).set(fid);
          await Store.ref(`players/${pid}/fightId`).set(fid);
          await Store.ref(`fights/${fid}`).set({
            a: pid, b: qid, state: 'live', round: 1, distance: band,
            hpA: p.hp, hpB: q.hp, arrowsA: p.arrows || 0, arrowsB: q.arrows || 0,
            startedAtMs: d.now, deadlineMs: d.now + R.ROUND_MS,
            moves: null, specialUsedA: false, specialUsedB: false,
          });
          break;
        }
      }
      await Store.ref(`players/${pid}`).update(upd);
    }
  }

  return { seed, step, NAMES };
})();
