/* ═══════════════════════════════════════════════════════════════════════════
   NET — Firebase Realtime Database umesto servera.

   Napolju govori tačno isti jezik kao stari WebSocket sloj
   (`Net.on`, `Net.send`, `Net.session`, `Net.connect`), pa app.js, mapview.js
   i challenges.js ne znaju da se ispod išta promenilo.

   Unutra: nema procesa koji kuca. Svet je determinističan iz `seed`-a
   (vidi rules.js), a u bazi stoji samo ono što se ne može predvideti —
   gde je ko, ko je šta uzeo, i šta se dešava u borbama.
   ═══════════════════════════════════════════════════════════════════════════ */
const Net = (() => {
  'use strict';
  const R = Rules;

  let db = null, ready = false, handlers = {};
  let code = null, myId = null, roomRef = null, room = null;
  let posSentAt = 0, lastHpWrite = 0, tickTimer = null;
  let cachedLoot = null, cachedSchedule = null, cachedSpawns = null, cacheKey = '';
  const appliedSponsors = new Set();
  const shownDerived = new Set();

  const emit = (t, m) => (handlers[t] || []).forEach((f) => f(m));
  const on = (t, f) => { (handlers[t] = handlers[t] || []).push(f); return api; };
  const fail = (msg) => emit('error', { msg });
  const now = () => Date.now();
  const ref = (p) => db.ref(`rooms/${code}/${p}`);

  const session = {
    get code() { return localStorage.getItem('arena.code'); },
    get playerId() { return localStorage.getItem('arena.pid'); },
    get token() { return localStorage.getItem('arena.tok'); },
    save(c, p, t) {
      localStorage.setItem('arena.code', c);
      localStorage.setItem('arena.pid', p);
      localStorage.setItem('arena.tok', t);
    },
    clear() { ['code', 'pid', 'tok'].forEach((k) => localStorage.removeItem('arena.' + k)); },
  };

  const uid = (p) => p + Math.random().toString(36).slice(2, 8) + now().toString(36).slice(-3);
  const CODE_A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const makeCode = () => Array.from({ length: 5 }, () => CODE_A[Math.floor(Math.random() * 32)]).join('');

  /* ───────────────────────────── veza ───────────────────────────── */
  // ?emu=1 gađa lokalni Firebase emulator (npm run emu) umesto pravog projekta.
  const EMU = new URLSearchParams(location.search).get('emu') === '1';

  async function connect() {
    if (!window.firebase) return emit('nocfg');
    // `const` na vrhu običnog skripta NE pravi window.FIREBASE_CONFIG —
    // do njega se dolazi samo po imenu, pa `typeof` čuva od ReferenceError.
    const CFG = typeof FIREBASE_CONFIG !== 'undefined' ? FIREBASE_CONFIG : null;
    if (!EMU && (!CFG || CFG.apiKey === 'PASTE_ME')) return emit('nocfg');
    try {
      const host = location.hostname || '127.0.0.1';
      firebase.initializeApp(EMU ? {
        apiKey: 'demo', projectId: 'demo-arena',
        authDomain: 'demo-arena.firebaseapp.com',
        databaseURL: `http://${host}:9000?ns=demo-arena-default-rtdb`,
      } : CFG);
      db = firebase.database();
      if (EMU) {
        db.useEmulator(host, 9000);
        firebase.auth().useEmulator(`http://${host}:9099`, { disableWarnings: true });
      }
      await firebase.auth().signInAnonymously();
      ready = true;
      emit('open');
      db.ref('.info/connected').on('value', (s) => {
        if (s.val() === false) emit('down');
        else if (roomRef) markOnline();
      });
      if (session.code && session.playerId) {
        send({ t: 'rejoin', code: session.code, playerId: session.playerId, token: session.token });
      }
    } catch (e) {
      console.error(e);
      emit('error', { msg: 'Firebase: ' + (e.message || e) });
    }
  }

  function markOnline() {
    if (!myId) return;
    const r = ref(`players/${myId}/online`);
    r.onDisconnect().set(false);
    r.set(true);
  }

  /* ───────────────────────── ulaz u sobu ───────────────────────── */
  async function createRoom(name) {
    for (let i = 0; i < 6; i++) {
      const c = makeCode();
      // U transakciji ne sme ServerValue.TIMESTAMP — upisao bi se doslovno.
      const res = await db.ref(`rooms/${c}/createdAt`).transaction((cur) =>
        cur === null ? Date.now() : undefined);
      if (!res.committed) continue;
      code = c;
      myId = uid('p');
      await db.ref(`rooms/${c}`).update({
        hostId: myId,
        phase: 'lobby',
        seed: Math.floor(Math.random() * 2 ** 31).toString(36),
        cfg: { center: null, radius0: 400, lootMode: 'cornucopia', lootCount: 24, deploySec: 180, shrink: true },
        [`players/${myId}`]: newPlayer(name, false),
      });
      return attach();
    }
    fail('Ne mogu da napravim sobu, probaj opet');
  }

  async function joinRoom(c, name) {
    c = String(c || '').toUpperCase().trim();
    const snap = await db.ref(`rooms/${c}`).get();
    if (!snap.exists()) return fail('Soba ne postoji');
    const r = snap.val();
    if (r.phase !== 'lobby') return fail('Igra je već počela');
    if (Object.keys(r.players || {}).length >= 24) return fail('Soba je puna');
    code = c;
    myId = uid('p');
    await db.ref(`rooms/${c}/players/${myId}`).set(newPlayer(name, false));
    return attach();
  }

  async function rejoinRoom(c, pid) {
    c = String(c || '').toUpperCase().trim();
    const snap = await db.ref(`rooms/${c}/players/${pid}`).get();
    if (!snap.exists()) { session.clear(); return; }
    code = c; myId = pid;
    return attach();
  }

  function newPlayer(name, isBot) {
    return {
      name: String(name || 'Tribut').slice(0, 16),
      isBot: !!isBot,
      online: true,
      alive: true,
      hp: 100,
      kills: 0,
      joinedAt: firebase.database.ServerValue.TIMESTAMP,
    };
  }

  function attach() {
    session.save(code, myId, myId);
    roomRef = db.ref(`rooms/${code}`);
    roomRef.on('value', (s) => { room = s.val() || null; });
    markOnline();
    emit('joined', { code, playerId: myId, token: myId, name: null });
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tick, 1000);
  }


  /* ─────────────────── izvedeni (determinstički) svet ─────────────────── */
  function cfgOf() {
    const c = (room && room.cfg) || {};
    return Object.assign({}, R.DEFAULTS, {
      center: c.center, radius0: c.radius0 || 400,
      lootMode: c.lootMode || 'cornucopia', lootCount: c.lootCount || 24,
      deploySec: c.deploySec || 180, shrink: c.shrink !== false,
    });
  }
  function world() {
    if (!room || !room.seed || !room.cfg || !room.cfg.center) return null;
    const cfg = cfgOf();
    const key = `${room.seed}|${cfg.radius0}|${cfg.lootCount}|${cfg.lootMode}|${cfg.deploySec}|${(room.roster || []).join(',')}`;
    if (cacheKey !== key) {
      cachedSchedule = R.genSchedule(room.seed, cfg);
      cachedLoot = R.genLoot(room.seed, cfg, cachedSchedule);
      cachedSpawns = room.roster ? R.genSpawns(room.seed, room.roster, cfg) : null;
      cacheKey = key;
    }
    return { cfg, schedule: cachedSchedule, loot: cachedLoot, spawns: cachedSpawns };
  }

  const playersOf = () => Object.entries((room && room.players) || {});
  const aliveIds = () => playersOf().filter(([, p]) => p.alive !== false).map(([id]) => id).sort();
  const itemsOf = (p) => Object.values((p && p.items) || {});
  const statsFor = (p) => {
    const s = R.statsOf(itemsOf(p));
    return { atk: s.atk, def: s.def, maxHp: 100 + s.hp, vision: s.vision };
  };
  const posOf = (p) => (p && typeof p.lat === 'number' ? { lat: p.lat, lng: p.lng } : null);

  /* ─────────────────────────── otkucaj ─────────────────────────── */
  let wasAlive = null;
  function tick() {
    if (!room || !myId) return;
    const me = (room.players || {})[myId];
    if (!me) return;
    const w = world();
    const n = now();

    // Pad je pad — bilo od arene, bilo od protivnika (koji nam upiše smrt).
    const aliveNow = me.alive !== false;
    if (wasAlive === true && !aliveNow) {
      emit('eliminated', { place: me.place || 0, reason: me.deathReason || 'arena' });
    }
    wasAlive = aliveNow;

    if (room.phase === 'running' && w && room.startedAt) {
      const el = n - room.startedAt;
      selfEffects(me, w, el, n);
      applySponsors(me, w, el);
      driveCombat(me, w, n);
      if (room.hostId === myId) Bots.step(api, room, w, n);
    }
    emit('state', buildState(me, w, n));
  }

  /* — šteta od zone, regeneracija, sopstvena smrt — */
  function selfEffects(me, w, el, n) {
    if (me.alive === false || me.combatId) return;
    const pos = posOf(me);
    if (!pos) return;
    const radius = R.arenaRadiusAt(w.cfg, w.schedule, el);
    const alive = aliveIds().length;
    if (alive <= 1) return;
    if (el < w.cfg.deploySec * 1000) return;

    let dmg = 0;
    if (R.haversine(pos, w.cfg.center) > radius) dmg += 2;
    for (const h of R.hazardsAt(w.schedule, el)) {
      if (el >= h.activeAt && el < h.until && R.haversine(pos, h.center) <= h.radius) dmg += 5;
    }
    if (alive === 2 && room.finaleAt && n - room.finaleAt > 8 * 60 * 1000 &&
        R.haversine(pos, w.cfg.center) > w.cfg.finaleReachM) dmg += 4;

    if (n - lastHpWrite < 3000) return;
    const maxHp = statsFor(me).maxHp;
    let hp = me.hp;
    if (dmg > 0) hp -= dmg;
    else if (n - lastHpWrite >= 15000 && hp < maxHp) hp += 1;
    else return;

    lastHpWrite = n;
    hp = Math.min(maxHp, hp);
    if (hp <= 0) selfEliminate(dmg >= 5 ? 'hazard' : 'arena');
    else ref(`players/${myId}/hp`).set(hp);
  }

  function selfEliminate(reason) {
    const place = aliveIds().length;
    const me = room.players[myId];
    ref(`players/${myId}`).update({ alive: false, hp: 0, place, deathReason: reason, combatId: null });
    const m = reason === 'hazard'
      ? [`💀 ${me.name} je ostao/la u zabranjenoj zoni.`, `💀 ${me.name} stayed in the forbidden zone.`]
      : reason === 'quit'
        ? [`💀 ${me.name} je napustio/la arenu.`, `💀 ${me.name} left the arena.`]
        : [`💀 ${me.name} nije preživeo/la arenu.`, `💀 ${me.name} did not survive the arena.`];
    pushFeed(m[0], m[1], 'death');
    // 'eliminated' se ne šalje odavde — tick ga javi kad vidi da smo pali,
    // pa isti put važi i kad nas obori protivnik.
  }

  /* — sponzorski paketi: svako sam primeni svoj — */
  function applySponsors(me, w, el) {
    if (me.alive === false) return;
    const got = Object.keys(me.sponsors || {});
    for (const ev of w.schedule) {
      if (ev.kind !== 'sponsor' || el < ev.at) continue;
      const key = 's' + ev.i;
      if (got.includes(key) || appliedSponsors.has(key)) continue;
      const target = R.sponsorTarget(ev, aliveIds());
      if (target !== myId) { appliedSponsors.add(key); continue; }
      appliedSponsors.add(key);
      const it = R.BY_ID[ev.itemId];
      ref(`players/${myId}/sponsors/${key}`).set(true);
      ref(`players/${myId}/items`).push(ev.itemId);
      if (it && it.hp) ref(`players/${myId}/hp`).set(Math.min(statsFor(me).maxHp + it.hp, me.hp + it.hp));
      pushFeed(`🪂 Sponzor je poslao paket za ${me.name}.`, `🪂 A sponsor sent a parachute to ${me.name}.`, 'info');
      emit('gift', { itemId: ev.itemId });
    }
  }

  /* ───────────────────────────── borba ───────────────────────────── */
  function driveCombat(me, w, n) {
    const cid = me.combatId;
    if (!cid) return;
    const c = (room.combats || {})[cid];
    if (!c) { ref(`players/${myId}/combatId`).set(null); return; }

    if (c.over) {
      if (n > (c.endedAt || 0) + 9000) ref(`players/${myId}/combatId`).set(null);
      return;
    }
    const mv = (c.moves || {})[c.round] || {};
    const both = mv[c.a] && mv[c.b];
    if (!both && n < c.endsAt) return;

    const stats = {
      [c.a]: statsFor((room.players || {})[c.a]),
      [c.b]: statsFor((room.players || {})[c.b]),
    };
    const roundNow = c.round;

    ref(`combats/${cid}`).transaction((cur) => {
      if (!cur || cur.over || cur.round !== roundNow) return; // neko drugi je već presudio
      const shape = {
        id: cid, ids: [cur.a, cur.b], hp: cur.hp, maxHp: cur.maxHp,
        st: cur.st || { [cur.a]: {}, [cur.b]: {} },
        round: cur.round, maxRounds: cur.maxRounds, isFinal: !!cur.isFinal,
      };
      const moves = (cur.moves || {})[cur.round] || {};
      const res = R.resolveRound(shape, moves, stats);
      cur.hp = res.hp;
      cur.st = res.st;
      cur.log = cur.log || {};
      cur.log[cur.round] = res.line;
      cur.round = cur.round + 1;
      if (res.extend) cur.maxRounds = cur.maxRounds + res.extend;
      if (res.over) {
        cur.over = true;
        cur.winnerId = res.winnerId || null;
        cur.loserId = res.loserId || null;
        cur.endedAt = now();
        cur.settledBy = myId;
      } else {
        cur.endsAt = now() + w.cfg.roundSec * 1000;
      }
      return cur;
    }, (err, committed, snap) => {
      if (err || !committed) return;
      const v = snap.val();
      if (v && v.over && v.settledBy === myId) settleCombat(cid, v);
    });
  }

  function settleCombat(cid, c) {
    const P = room.players || {};
    const cool = now() + R.DEFAULTS.combatCooldownSec * 1000;
    for (const id of [c.a, c.b]) {
      ref(`players/${id}`).update({ hp: Math.max(1, c.hp[id]), cooldownUntil: cool });
    }
    if (!c.winnerId) {
      pushFeed(`${P[c.a].name} i ${P[c.b].name} su se razišli — bez pobednika.`,
        `${P[c.a].name} and ${P[c.b].name} broke apart — no winner.`, 'info');
      return;
    }
    const W = P[c.winnerId], L = P[c.loserId];
    const loot = itemsOf(L);
    const rng = R.rngFor(cid, 'spoils');
    const spoils = loot.slice().sort(() => rng() - 0.5).slice(0, Math.ceil(loot.length / 2));
    const place = aliveIds().length;

    ref(`players/${c.winnerId}`).update({ kills: (W.kills || 0) + 1, hp: Math.max(1, c.hp[c.winnerId]) });
    spoils.forEach((it) => ref(`players/${c.winnerId}/items`).push(it));
    ref(`combats/${cid}/spoils`).set(spoils);
    ref(`players/${c.loserId}`).update({ alive: false, hp: 0, place, deathReason: 'combat', killerId: c.winnerId });
    pushFeed(`💀 ${L.name} je pao/la od ruke ${W.name}.`, `💀 ${L.name} fell to ${W.name}.`, 'death');
  }

  async function startCombat(targetId, isFinal) {
    const P = room.players || {};
    const me = P[myId], q = P[targetId];
    if (!me || !q) return fail('Nedostupan igrač');
    const cid = uid('k');
    const t = await ref(`players/${targetId}/combatId`).transaction((cur) => (cur == null ? cid : undefined));
    if (!t.committed) return fail('Protivnik je već u borbi');
    const s = await ref(`players/${myId}/combatId`).transaction((cur) => (cur == null ? cid : undefined));
    if (!s.committed) { ref(`players/${targetId}/combatId`).set(null); return fail('Već si u borbi'); }

    const mp = posOf(me), qp = posOf(q);
    await ref(`combats/${cid}`).set({
      a: myId, b: targetId, isFinal: !!isFinal,
      names: { [myId]: me.name, [targetId]: q.name },
      hp: { [myId]: me.hp, [targetId]: q.hp },
      maxHp: { [myId]: statsFor(me).maxHp, [targetId]: statsFor(q).maxHp },
      st: { [myId]: { rage: 0, stun: 0, poison: 0 }, [targetId]: { rage: 0, stun: 0, poison: 0 } },
      round: 1,
      maxRounds: isFinal ? R.DEFAULTS.finalRounds : R.DEFAULTS.combatRounds,
      endsAt: now() + R.DEFAULTS.roundSec * 1000,
      meet: mp && qp ? { lat: (mp.lat + qp.lat) / 2, lng: (mp.lng + qp.lng) / 2 } : null,
      over: false, startedAt: now(),
    });
    pushFeed(
      isFinal ? `FINALE: ${me.name} protiv ${q.name}!` : `${me.name} je napao/la ${q.name}!`,
      isFinal ? `FINALE: ${me.name} vs ${q.name}!` : `${me.name} attacked ${q.name}!`,
      isFinal ? 'major' : 'warn');
  }

  /* ───────────────────────────── objave ───────────────────────────── */
  function pushFeed(sr, en, sev) {
    ref('feed').push({ ts: firebase.database.ServerValue.TIMESTAMP, sr, en, sev });
  }

  /* ───────────────────── slanje poruka (stari protokol) ───────────────────── */
  async function send(m) {
    if (!m || !m.t) return;
    if (!ready && m.t !== 'rejoin') { if (!db) return fail('Nema veze sa bazom'); }
    const me = room && room.players ? room.players[myId] : null;

    switch (m.t) {
      case 'create': return createRoom(m.name);
      case 'join': return joinRoom(m.code, m.name);
      case 'rejoin': return rejoinRoom(m.code, m.playerId);
      case 'ping': return;

      case 'setArena': {
        if (!room || room.hostId !== myId) return fail('Samo domaćin');
        if (room.phase !== 'lobby') return fail('Igra je već počela');
        return ref('cfg').update({
          center: m.center || null,
          radius0: Math.max(60, Math.min(5000, m.radius || 400)),
          lootMode: m.lootMode || 'cornucopia',
          lootCount: Math.max(4, Math.min(80, m.lootCount || 24)),
          deploySec: Math.max(20, Math.min(900, m.deploySec || 180)),
          shrink: m.shrink !== false,
        });
      }
      case 'addBots': {
        if (!room || room.hostId !== myId) return fail('Samo domaćin');
        if (room.phase !== 'lobby') return fail('Samo u čekaonici');
        const used = new Set(playersOf().map(([, p]) => p.name));
        const upd = {};
        for (let i = 0; i < (m.count || 1); i++) {
          const nm = Bots.name(used); used.add(nm);
          upd[uid('b')] = newPlayer(nm, true);
        }
        return ref('players').update(upd);
      }
      case 'start': {
        if (!room || room.hostId !== myId) return fail('Samo domaćin');
        if (room.phase !== 'lobby') return fail('Već je počelo');
        if (!room.cfg || !room.cfg.center) return fail('Prvo postavi arenu');
        const ids = playersOf().map(([id]) => id);
        if (ids.length < 2) return fail('Potrebna su bar 2 igrača');
        const w0 = { cfg: cfgOf() };
        const spawns = R.genSpawns(room.seed, ids, w0.cfg);
        const upd = { phase: 'running', startedAt: now(), roster: ids };
        ids.forEach((id) => {
          const p = room.players[id];
          upd[`players/${id}/hp`] = statsFor(p).maxHp;
          if (p.isBot) { upd[`players/${id}/lat`] = spawns[id].lat; upd[`players/${id}/lng`] = spawns[id].lng; }
        });
        await roomRef.update(upd);
        return pushFeed('Tributi, na pozicije. Odbrojavanje je počelo.',
          'Tributes, to your positions. The countdown has begun.', 'major');
      }
      case 'pos': {
        if (!me || now() - posSentAt < 1400) return;
        posSentAt = now();
        return ref(`players/${myId}`).update({ lat: m.lat, lng: m.lng, pt: now() });
      }
      case 'lootTry': {
        const w = world();
        if (!w || !me) return;
        const l = w.loot.find((x) => x.id === m.lootId);
        if (!l) return fail('Nema ničega ovde');
        if ((room.taken || {})[l.id]) return fail('Neko je već uzeo');
        const pos = posOf(me);
        if (!pos || R.haversine(pos, l) > w.cfg.lootReachM) return fail('Previše si daleko');
        const t = await ref(`taken/${l.id}`).transaction((cur) => (cur == null ? myId : undefined));
        if (!t.committed) return fail('Neko drugi je bio brži');
        return emit('challenge', {
          lootId: l.id, rarity: l.rarity, itemId: l.itemId,
          challenge: R.challengeFor(l.rarity), difficulty: l.rarity,
        });
      }
      case 'lootDone': {
        const w = world();
        const l = w && w.loot.find((x) => x.id === m.lootId);
        if (!l) return;
        if (!m.success) { ref(`taken/${l.id}`).remove(); return emit('lootResult', { success: false }); }
        ref(`players/${myId}/items`).push(l.itemId);
        const it = R.BY_ID[l.itemId];
        if (it && it.hp) {
          const mx = statsFor(me).maxHp + it.hp;
          ref(`players/${myId}/hp`).set(Math.min(mx, (me.hp || 0) + it.hp));
        }
        if (l.rarity === 3) {
          pushFeed(`${me.name} je pronašao/la nešto moćno.`, `${me.name} found something powerful.`, 'info');
        }
        return emit('lootResult', { success: true, itemId: l.itemId });
      }
      case 'engage': {
        const P = room.players || {}, q = P[m.targetId];
        if (!me || !q || q.alive === false) return fail('Nedostupan igrač');
        if (me.combatId || q.combatId) return fail('Već je u borbi');
        if (now() < (me.cooldownUntil || 0)) return fail('Sačekaj posle prethodne borbe');
        if (now() < (q.cooldownUntil || 0)) return fail('Protivnik se još oporavlja');
        if (((room.allies || {})[myId] || {})[m.targetId]) return fail('Saveznik ti je — prvo raskini savez');
        const a = posOf(me), b = posOf(q);
        if (!a || !b || R.haversine(a, b) > cfgOf().engageM) return fail('Moraš biti bliže (15 m)');
        return startCombat(m.targetId, false);
      }
      case 'ally': {
        const q = (room.players || {})[m.targetId];
        if (!me || !q) return fail('Nedostupan igrač');
        const a = posOf(me), b = posOf(q);
        if (!a || !b || R.haversine(a, b) > cfgOf().engageM) return fail('Moraš biti bliže');
        return ref(`players/${m.targetId}/proposal`).set({ from: myId, fromName: me.name, at: now() });
      }
      case 'allyRespond': {
        ref(`players/${myId}/proposal`).remove();
        if (!m.accept) return;
        const q = (room.players || {})[m.fromId];
        ref(`allies/${myId}/${m.fromId}`).set(true);
        ref(`allies/${m.fromId}/${myId}`).set(true);
        return pushFeed(`${q ? q.name : '?'} i ${me.name} su sklopili savez.`,
          `${q ? q.name : '?'} and ${me.name} formed an alliance.`, 'info');
      }
      case 'allyBreak': {
        ref(`allies/${myId}/${m.targetId}`).remove();
        ref(`allies/${m.targetId}/${myId}`).remove();
        return;
      }
      case 'combatMove': {
        if (!me || !me.combatId) return fail('Nema aktivne borbe');
        const c = (room.combats || {})[me.combatId];
        if (!c || c.over) return fail('Nema aktivne borbe');
        if (((c.moves || {})[c.round] || {})[myId]) return fail('Već si izabrao/la');
        if (m.itemId) {
          const key = Object.keys(me.items || {}).find((k) => me.items[k] === m.itemId);
          if (!key) return fail('Nemaš taj predmet');
          ref(`players/${myId}/items/${key}`).remove();
          if (R.BY_ID[m.itemId] && R.BY_ID[m.itemId].use === 'cloak') {
            ref(`players/${myId}/cloakUntil`).set(now() + R.BY_ID[m.itemId].power * 1000);
          }
          return ref(`combats/${me.combatId}/moves/${c.round}/${myId}`).set({ kind: 'item', itemId: m.itemId });
        }
        if (!R.MOVES.includes(m.move)) return fail('Nepoznat potez');
        return ref(`combats/${me.combatId}/moves/${c.round}/${myId}`).set({ kind: 'move', move: m.move });
      }
      case 'quit': {
        if (!room) return;
        if (room.phase === 'lobby') {
          await ref(`players/${myId}`).remove();
          if (room.hostId === myId) {
            const next = playersOf().find(([id, p]) => id !== myId && !p.isBot);
            if (next) roomRef.update({ hostId: next[0] });
            else roomRef.remove();
          }
        } else if (me && me.alive !== false) selfEliminate('quit');
        else if (room.hostId === myId && aliveIds().length <= 1) {
          await roomRef.remove();   // partija gotova i domaćin izlazi — soba više ne treba
        }
        return;
      }
      default: return;
    }
  }

  /* ─────────────────── sklapanje `state` objekta za UI ─────────────────── */
  function buildState(me, w, n) {
    const cfg = cfgOf();
    const P = room.players || {};
    const ids = Object.keys(P);
    const alive = aliveIds();
    const started = room.phase === 'running' && room.startedAt;
    const el = started ? n - room.startedAt : 0;
    const phase = !started ? 'lobby' : R.phaseAt(cfg, el, alive.length, false);

    const radius = w ? R.arenaRadiusAt(cfg, w.schedule, el) : cfg.radius0;
    const hazards = w && started ? R.hazardsAt(w.schedule, el) : [];
    const nightU = w && started ? R.nightUntilAt(w.schedule, el) : 0;
    const spawn = w && w.spawns ? w.spawns[myId] : null;

    const st = statsFor(me);
    const myItems = itemsOf(me);
    const spectator = me.alive === false || phase === 'ended';
    let vision = cfg.visionM + st.vision;
    if (nightU) vision *= 0.5;
    const mypos = posOf(me);
    const allies = Object.keys(((room.allies || {})[myId]) || {});

    // kontakti
    const contacts = [];
    if (started) {
      for (const id of ids) {
        if (id === myId) continue;
        const q = P[id], qp = posOf(q);
        if (!qp) continue;
        const qAlive = q.alive !== false;
        if (!qAlive && !spectator) continue;
        if (spectator) {
          contacts.push({ id, name: q.name, alive: qAlive, band: qAlive ? 'spy' : 'dead',
            lat: qp.lat, lng: qp.lng, dist: mypos ? Math.round(R.haversine(mypos, qp)) : null });
          continue;
        }
        if (!mypos) continue;
        const d = R.haversine(mypos, qp);
        const isAlly = allies.includes(id);
        if (isAlly) {
          contacts.push({ id, name: q.name, alive: true, band: 'ally', lat: qp.lat, lng: qp.lng,
            dist: Math.round(d), brg: Math.round(R.bearing(mypos, qp)) });
        } else if (n < (q.cloakUntil || 0)) {
          continue;
        } else if (d <= cfg.engageM) {
          contacts.push({ id, name: q.name, alive: true, band: 'engage', lat: qp.lat, lng: qp.lng,
            dist: Math.round(d), brg: Math.round(R.bearing(mypos, qp)),
            cooldown: Math.max(0, Math.ceil((Math.max(me.cooldownUntil || 0, q.cooldownUntil || 0) - n) / 1000)) });
        } else if (d <= cfg.proximityM) {
          contacts.push({ band: 'near', dist: Math.round(d / 25) * 25, brg: Math.round(R.bearing(mypos, qp) / 45) * 45 });
        }
      }
    }

    // plen
    const loot = [];
    if (w && started && phase !== 'deploy') {
      const taken = room.taken || {};
      for (const l of w.loot) {
        if (taken[l.id] || el < l.availableAt) continue;
        const d = mypos ? Math.round(R.haversine(mypos, l)) : null;
        const visible = spectator || l.feast || (d != null && d <= vision);
        if (!visible) continue;
        loot.push({ id: l.id, lat: l.lat, lng: l.lng, rarity: l.rarity, isCorn: l.isCorn,
          feast: !!l.feast, dist: d, inReach: d != null && d <= cfg.lootReachM });
      }
    }

    // objave: izvedene iz rasporeda + one upisane u bazu
    const dbFeed = Object.entries(room.feed || {}).map(([k, f]) => ({ id: k, ts: f.ts || 0, sr: f.sr, en: f.en, sev: f.sev }));
    const derived = (w && started ? R.scheduleFeed(w.schedule, room.startedAt, el) : []).filter((f) => !f.sponsor);
    if (started && alive.length === 2 && phase === 'finale') {
      const [x, y] = alive.map((i) => P[i].name);
      derived.push({ id: 'finale', ts: room.finaleAt || n, sev: 'major',
        sr: `🏛️ Ostali su samo ${x} i ${y}. Svi — i eliminisani — idite u centar arene. Finale počinje tamo.`,
        en: `🏛️ Only ${x} and ${y} remain. Everyone — including the eliminated — head to the arena centre.` });
    }
    if (started && el >= cfg.deploySec * 1000) {
      derived.push({ id: 'gong', ts: room.startedAt + cfg.deploySec * 1000, sev: 'major',
        sr: '🔔 GONG! Igre gladi su počele. Neka sreća uvek bude na vašoj strani.',
        en: '🔔 GONG! The Hunger Games have begun. May the odds be ever in your favour.' });
    }
    let winnerId = null;
    if (phase === 'ended' && alive.length === 1) {
      winnerId = alive[0];
      derived.push({ id: 'winner', ts: n, sev: 'major',
        sr: `👑 Pobednik ${ids.length}. Igara gladi: ${P[winnerId].name}!`,
        en: `👑 Winner of these Hunger Games: ${P[winnerId].name}!` });
    }
    const feed = dbFeed.concat(derived).sort((a, b) => a.ts - b.ts).slice(-14);

    // borba
    const combat = me.combatId ? combatView((room.combats || {})[me.combatId], myId, P) : null;
    let spectate = null;
    if (spectator) {
      const live = Object.values(room.combats || {}).find((c) => !c.over);
      if (live) spectate = combatView(live, null, P);
    }

    // finale: zapamti kad je počelo (za tajmer prisilne štete)
    if (started && alive.length === 2 && !room.finaleAt && room.hostId === myId) {
      roomRef.update({ finaleAt: n });
    }

    return {
      t: 'state', now: n, phase, code, isHost: room.hostId === myId,
      cfg: { engageM: cfg.engageM, proximityM: cfg.proximityM, lootReachM: cfg.lootReachM,
             roundSec: cfg.roundSec, finaleReachM: cfg.finaleReachM },
      arena: cfg.center ? { center: cfg.center, radius, radius0: cfg.radius0 } : null,
      hazards, night: nightU ? room.startedAt + nightU : 0,
      countdown: phase === 'deploy' ? Math.max(0, Math.ceil((cfg.deploySec * 1000 - el) / 1000)) : 0,
      you: {
        id: myId, name: me.name, alive: me.alive !== false, hp: Math.max(0, Math.round(me.hp || 0)),
        maxHp: st.maxHp, atk: st.atk, def: st.def, items: myItems, kills: me.kills || 0,
        spawn, spawnReached: !!(spawn && mypos && R.haversine(mypos, spawn) <= 20),
        place: me.place || 0,
        cooldown: Math.max(0, Math.ceil(((me.cooldownUntil || 0) - n) / 1000)),
        cloak: n < (me.cloakUntil || 0) ? Math.ceil(((me.cloakUntil) - n) / 1000) : 0,
        allies,
      },
      roster: ids.map((id) => ({ id, name: P[id].name, alive: P[id].alive !== false, isBot: !!P[id].isBot,
        online: P[id].online !== false, kills: P[id].kills || 0, place: P[id].place || 0,
        host: room.hostId === id })),
      aliveCount: alive.length,
      loot, contacts, combat, spectate, feed,
      winnerId: winnerId || (phase === 'ended' && alive.length ? alive[0] : null),
      vision: Math.round(vision),
    };
  }

  function combatView(c, viewerId, P) {
    if (!c) return null;
    const me = viewerId && (c.a === viewerId || c.b === viewerId) ? viewerId : null;
    const foe = me ? (c.a === me ? c.b : c.a) : null;
    const one = (id) => ({ id, name: (c.names || {})[id] || (P[id] ? P[id].name : '?'),
      hp: (c.hp || {})[id] || 0, maxHp: (c.maxHp || {})[id] || 100, st: (c.st || {})[id] || {} });
    const log = Object.keys(c.log || {}).map(Number).sort((a, b) => a - b).slice(-4).map((k) => c.log[k]);
    return {
      id: c.id || '', isFinal: !!c.isFinal, round: c.round, maxRounds: c.maxRounds,
      endsAt: c.endsAt, over: !!c.over, winnerId: c.winnerId || null,
      meetPoint: c.meet || null,
      picked: me ? !!(((c.moves || {})[c.round] || {})[me]) : false,
      you: me ? one(me) : one(c.a),
      foe: me ? one(foe) : one(c.b),
      log, spoils: c.spoils ? Object.values(c.spoils) : null,
    };
  }

  /* ─────────────── pomoć botovima i testu (interni API) ─────────────── */
  const api = {
    connect, on, send, session,
    get ready() { return ready; },
    hardClose() { if (tickTimer) clearInterval(tickTimer); if (roomRef) roomRef.off(); },
    // koristi Bots.step
    _ref: (p) => ref(p), _room: () => room, _me: () => myId,
    _stats: statsFor, _pos: posOf, _items: itemsOf, _alive: aliveIds,
    _feed: pushFeed, _combat: startCombat, _uid: uid,
  };
  return api;
})();
