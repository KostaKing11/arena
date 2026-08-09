/* Simulirani igrači. Vodi ih telefon domaćina — služe samo za testiranje
   partije bez 12 ljudi na terenu. Ako domaćin zatvori app, botovi stanu;
   pravi igrači nastavljaju normalno. */
const Bots = (() => {
  'use strict';
  const R = Rules;
  const S = new Map();   // pid -> lokalno stanje bota (ne ide u bazu)

  const NAMES = ['Kato', 'Marvel', 'Glimer', 'Treš', 'Foxface', 'Klov', 'Ruta', 'Brutus',
    'Enobarija', 'Fineas', 'Džoana', 'Bister', 'Vajres', 'Sejder', 'Gloss', 'Kašmir'];

  function name(used) {
    const free = NAMES.filter((n) => !used.has(n));
    if (free.length) return free[Math.floor(Math.random() * free.length)];
    return NAMES[Math.floor(Math.random() * NAMES.length)] + ' ' + Math.floor(Math.random() * 90 + 10);
  }

  function stateOf(pid) {
    if (!S.has(pid)) {
      S.set(pid, {
        speed: 1.0 + Math.random() * 0.9,
        aggression: 0.25 + Math.random() * 0.6,
        greed: 0.4 + Math.random() * 0.6,
        waypoint: null, moveAt: 0, lastStep: 0, hpAt: 0,
      });
    }
    return S.get(pid);
  }

  function step(api, room, w, now) {
    const P = room.players || {};
    const el = now - room.startedAt;
    if (el < w.cfg.deploySec * 1000) return;   // za vreme rasporeda botovi stoje na spawn-u

    const radius = R.arenaRadiusAt(w.cfg, w.schedule, el);
    const hazards = R.hazardsAt(w.schedule, el);
    const taken = room.taken || {};
    const alive = Object.entries(P).filter(([, p]) => p.alive !== false);
    if (alive.length <= 1) return;

    for (const [pid, p] of Object.entries(P)) {
      if (!p.isBot || p.alive === false) continue;
      const b = stateOf(pid);
      const ref = (path) => api._ref(path);

      if (typeof p.lat !== 'number') {
        const sp = w.spawns && w.spawns[pid];
        if (sp) ref(`players/${pid}`).update({ lat: sp.lat, lng: sp.lng });
        continue;
      }
      const pos = { lat: p.lat, lng: p.lng };

      /* — savez: bot odgovori posle par sekundi — */
      if (p.proposal && now - p.proposal.at > 4000) {
        ref(`players/${pid}/proposal`).remove();
        if (Math.random() > b.aggression) {
          ref(`allies/${pid}/${p.proposal.from}`).set(true);
          ref(`allies/${p.proposal.from}/${pid}`).set(true);
          const q = P[p.proposal.from];
          api._feed(`${q ? q.name : '?'} i ${p.name} su sklopili savez.`,
            `${q ? q.name : '?'} and ${p.name} formed an alliance.`, 'info');
        }
      }

      /* — u borbi: bira potez sa malim odlaganjem — */
      if (p.combatId) {
        const c = (room.combats || {})[p.combatId];
        if (!c || c.over) continue;
        if (((c.moves || {})[c.round] || {})[pid]) continue;
        if (!b.moveAt || b.moveAt < c.endsAt - 14000) b.moveAt = now + 2000 + Math.random() * 5000;
        if (now < b.moveAt) continue;
        const items = Object.entries(p.items || {}).filter(([, id]) => R.BY_ID[id] && R.BY_ID[id].type === 'use');
        const hurt = (c.hp[pid] || 0) / (c.maxHp[pid] || 100) < 0.45;
        if (items.length && (hurt ? Math.random() < 0.55 : Math.random() < 0.15)) {
          const heal = items.find(([, id]) => R.BY_ID[id].use === 'heal');
          const [key, itemId] = (hurt && heal) ? heal : items[Math.floor(Math.random() * items.length)];
          ref(`players/${pid}/items/${key}`).remove();
          ref(`combats/${p.combatId}/moves/${c.round}/${pid}`).set({ kind: 'item', itemId });
        } else {
          const w2 = b.aggression > 0.5 ? ['attack', 'attack', 'feint', 'block'] : R.MOVES;
          ref(`combats/${p.combatId}/moves/${c.round}/${pid}`)
            .set({ kind: 'move', move: w2[Math.floor(Math.random() * w2.length)] });
        }
        continue;
      }

      /* — šteta od zone i regeneracija (domaćin ih primenjuje umesto bota) — */
      if (now - b.hpAt > 3000) {
        b.hpAt = now;
        let dmg = 0;
        if (R.haversine(pos, w.cfg.center) > radius) dmg += 2;
        for (const h of hazards) {
          if (el >= h.activeAt && el < h.until && R.haversine(pos, h.center) <= h.radius) dmg += 5;
        }
        if (dmg > 0) {
          const hp = (p.hp || 0) - dmg;
          if (hp <= 0) {
            ref(`players/${pid}`).update({ alive: false, hp: 0, place: alive.length,
              deathReason: dmg >= 5 ? 'hazard' : 'arena', combatId: null });
            api._feed(`💀 ${p.name} nije preživeo/la arenu.`, `💀 ${p.name} did not survive the arena.`, 'death');
            continue;
          }
          ref(`players/${pid}/hp`).set(hp);
        }
      }

      /* — kretanje — */
      const dt = b.lastStep ? Math.min(4, (now - b.lastStep) / 1000) : 1;
      b.lastStep = now;
      const target = pickTarget(api, room, w, p, pid, pos, radius, hazards, el, taken);
      let np = pos;
      if (target) {
        const d = R.haversine(pos, target);
        const stepM = b.speed * dt;
        np = d <= stepM ? { lat: target.lat, lng: target.lng }
                        : R.destPoint(pos, R.bearing(pos, target), stepM);
        ref(`players/${pid}`).update({ lat: np.lat, lng: np.lng, pt: now });
      }

      /* — kupljenje plena — */
      const near = w.loot.find((l) => !taken[l.id] && el >= l.availableAt &&
        R.haversine(np, l) <= w.cfg.lootReachM);
      if (near && Math.random() < 0.5) {
        ref(`taken/${near.id}`).transaction((cur) => (cur == null ? pid : undefined), (e, ok) => {
          if (e || !ok) return;
          const rate = [0, 0.9, 0.75, 0.6][near.rarity] || 0.8;
          if (Math.random() < rate) {
            ref(`players/${pid}/items`).push(near.itemId);
            b.waypoint = null;
            if (near.rarity === 3) {
              api._feed(`${p.name} je pronašao/la nešto moćno.`, `${p.name} found something powerful.`, 'info');
            }
          } else ref(`taken/${near.id}`).remove();
        });
      }

      /* — napad — */
      if (now >= (p.cooldownUntil || 0)) {
        for (const [qid, q] of alive) {
          if (qid === pid || q.alive === false || q.combatId) continue;
          if (typeof q.lat !== 'number' || now < (q.cooldownUntil || 0)) continue;
          if (((room.allies || {})[pid] || {})[qid]) continue;
          if (R.haversine(np, { lat: q.lat, lng: q.lng }) > w.cfg.engageM) continue;
          if (Math.random() < b.aggression * 0.5) { botEngage(api, room, p, pid, q, qid); break; }
        }
      }
    }
  }

  function botEngage(api, room, p, pid, q, qid) {
    const cid = api._uid('k');
    const ref = (path) => api._ref(path);
    ref(`players/${qid}/combatId`).transaction((cur) => (cur == null ? cid : undefined), (e1, ok1) => {
      if (e1 || !ok1) return;
      ref(`players/${pid}/combatId`).transaction((cur) => (cur == null ? cid : undefined), (e2, ok2) => {
        if (e2 || !ok2) { ref(`players/${qid}/combatId`).set(null); return; }
        ref(`combats/${cid}`).set({
          a: pid, b: qid, isFinal: false,
          names: { [pid]: p.name, [qid]: q.name },
          hp: { [pid]: p.hp, [qid]: q.hp },
          maxHp: { [pid]: api._stats(p).maxHp, [qid]: api._stats(q).maxHp },
          st: { [pid]: { rage: 0, stun: 0, poison: 0 }, [qid]: { rage: 0, stun: 0, poison: 0 } },
          round: 1, maxRounds: R.DEFAULTS.combatRounds,
          endsAt: Date.now() + R.DEFAULTS.roundSec * 1000,
          meet: { lat: (p.lat + q.lat) / 2, lng: (p.lng + q.lng) / 2 },
          over: false, startedAt: Date.now(),
        });
        api._feed(`${p.name} je napao/la ${q.name}!`, `${p.name} attacked ${q.name}!`, 'warn');
      });
    });
  }

  function pickTarget(api, room, w, p, pid, pos, radius, hazards, el, taken) {
    const b = stateOf(pid);
    const C = w.cfg.center;
    const alive = Object.entries(room.players || {}).filter(([, x]) => x.alive !== false);

    if (alive.length === 2) return C;                                  // finale je u centru
    if (R.haversine(pos, C) > radius * 0.95) return C;                 // van arene -> nazad
    for (const h of hazards) {
      if (el < h.until && R.haversine(pos, h.center) <= h.radius * 1.1) {
        return R.destPoint(h.center, R.bearing(h.center, pos), h.radius * 1.4);
      }
    }
    if (Math.random() < b.greed) {
      let best = null, bd = Infinity;
      for (const l of w.loot) {
        if (taken[l.id] || el < l.availableAt) continue;
        const d = R.haversine(pos, l);
        if (d < bd && d < 300) { bd = d; best = l; }
      }
      if (best) return { lat: best.lat, lng: best.lng };
    }
    // nema plena u blizini -> lov na najbližeg igrača, inače partija stoji
    let prey = null, pd = Infinity;
    for (const [qid, q] of alive) {
      if (qid === pid || typeof q.lat !== 'number') continue;
      if (((room.allies || {})[pid] || {})[qid]) continue;
      const d = R.haversine(pos, { lat: q.lat, lng: q.lng });
      if (d < pd && d < 200) { pd = d; prey = q; }
    }
    if (prey && Math.random() < 0.6) return { lat: prey.lat, lng: prey.lng };

    if (!b.waypoint || R.haversine(pos, b.waypoint) < 12) {
      b.waypoint = R.pointInCircle(Math.random, C, radius * 0.85);
    }
    return b.waypoint;
  }

  return { step, name };
})();
