'use strict';

const { haversine, bearing, destPoint, randomPointInCircle } = require('./geo');
const { BY_ID, rollItem, statsOf } = require('./items');

const TICK_MS = 1000;

const DEFAULTS = {
  proximityM: 100,   // "neko je u blizini" (bez imena)
  engageM: 15,       // moze da se pokrene borba
  lootReachM: 15,    // moze da se uzme predmet
  visionM: 150,      // radijus u kom vidis predmete na mapi
  deploySec: 180,    // vreme da svako stigne na svoju startnu poziciju
  lootCount: 24,
  lootMode: 'cornucopia', // 'cornucopia' | 'scattered'
  combatRounds: 5,
  finalRounds: 7,
  roundSec: 12,
  eventMinSec: 150,
  eventMaxSec: 300,
  shrink: true,
  finaleReachM: 30,
};

const MOVES = ['attack', 'block', 'feint'];
const BEATS = { attack: 'feint', feint: 'block', block: 'attack' };

let seq = 0;
const uid = (p = 'x') => `${p}_${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join('');
}

class Room {
  constructor(code) {
    this.code = code || makeCode();
    this.createdAt = Date.now();
    this.phase = 'lobby'; // lobby | deploy | active | finale | ended
    this.cfg = { ...DEFAULTS };
    this.arena = null;    // { center:{lat,lng}, radius }
    this.players = new Map();
    this.hostId = null;
    this.loot = [];
    this.hazards = [];
    this.combats = new Map();
    this.feed = [];
    this.alliances = new Map(); // playerId -> Set(playerId)
    this.nightUntil = 0;
    this.nextEventAt = 0;
    this.phaseEndsAt = 0;
    this.winnerId = null;
    this.finaleStartedAt = 0;
    this.tickN = 0;
    this.send = () => {};   // postavlja index.js
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  destroy() { clearInterval(this.timer); }

  // ---------------------------------------------------------------- igraci

  addPlayer({ name, isBot = false }) {
    const id = uid('p');
    const p = {
      id,
      name: (name || 'Tribut').slice(0, 16),
      token: uid('t'),
      isBot,
      online: isBot,
      alive: true,
      pos: null,
      posAt: 0,
      spawn: null,
      spawnReached: false,
      hp: 100,
      items: [],
      kills: 0,
      cloakUntil: 0,
      regenAt: 0,
      combatId: null,
      cooldownUntil: 0,
      eliminatedAt: 0,
      deathReason: null,
      place: 0,
      bot: isBot ? { waypoint: null, nextThink: 0, target: null } : null,
    };
    this.players.set(id, p);
    if (!this.hostId && !isBot) this.hostId = id;
    return p;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    if (this.phase === 'lobby') {
      this.players.delete(id);
      if (this.hostId === id) {
        const next = [...this.players.values()].find((x) => !x.isBot);
        this.hostId = next ? next.id : null;
      }
    } else {
      p.online = false;
    }
  }

  alivePlayers() { return [...this.players.values()].filter((p) => p.alive); }
  maxHp(p) { return 100 + statsOf(p.items).hp; }
  statsFor(p) {
    const s = statsOf(p.items);
    return { atk: s.atk, def: s.def, maxHp: 100 + s.hp, vision: s.vision };
  }

  // ---------------------------------------------------------------- feed

  announce(sr, en, sev = 'info', extra = {}) {
    const entry = { id: uid('f'), ts: Date.now(), sr, en, sev, ...extra };
    this.feed.push(entry);
    if (this.feed.length > 60) this.feed.shift();
    return entry;
  }

  // ---------------------------------------------------------------- setup

  setArena({ center, radius, lootMode, lootCount, deploySec, shrink }) {
    if (this.phase !== 'lobby') return { error: 'Igra je već počela' };
    if (!center || typeof center.lat !== 'number') return { error: 'Nevažeći centar arene' };
    this.arena = {
      center: { lat: center.lat, lng: center.lng },
      radius: Math.max(60, Math.min(5000, radius || 400)),
      radius0: Math.max(60, Math.min(5000, radius || 400)),
    };
    if (lootMode) this.cfg.lootMode = lootMode;
    if (lootCount) this.cfg.lootCount = Math.max(4, Math.min(80, lootCount));
    if (deploySec != null) this.cfg.deploySec = Math.max(20, Math.min(900, deploySec));
    if (shrink != null) this.cfg.shrink = !!shrink;
    return { ok: true };
  }

  generateLoot() {
    const { center, radius } = this.arena;
    this.loot = [];
    const n = this.cfg.lootCount;
    const cornN = this.cfg.lootMode === 'cornucopia' ? Math.round(n * 0.4) : 0;

    for (let i = 0; i < cornN; i++) {
      const pos = randomPointInCircle(center, Math.max(12, radius * 0.06));
      this.loot.push(this.mkLoot(pos, 'cornucopia', true));
    }
    for (let i = 0; i < n - cornN; i++) {
      const pos = randomPointInCircle(center, radius * 0.95, radius * 0.12);
      this.loot.push(this.mkLoot(pos, 'normal', false));
    }
  }

  mkLoot(pos, pool, isCorn) {
    const item = rollItem(pool);
    return {
      id: uid('l'),
      pos,
      itemId: item.id,
      rarity: item.rarity,
      isCorn,
      taken: false,
      lockedBy: null,
      lockedUntil: 0,
    };
  }

  assignSpawns() {
    const alive = this.alivePlayers();
    const { center, radius } = this.arena;
    const ringR = Math.max(40, radius * 0.72);
    const offset = Math.random() * 360;
    alive.forEach((p, i) => {
      const brg = offset + (360 / alive.length) * i;
      p.spawn = destPoint(center, brg, ringR * (0.9 + Math.random() * 0.2));
      p.spawnReached = false;
      p.hp = this.statsFor(p).maxHp;
      if (p.isBot) p.pos = { ...p.spawn };
    });
  }

  start() {
    if (this.phase !== 'lobby') return { error: 'Već je počelo' };
    if (!this.arena) return { error: 'Prvo postavi arenu' };
    if (this.players.size < 2) return { error: 'Potrebna su bar 2 igrača' };
    this.generateLoot();
    this.assignSpawns();
    this.phase = 'deploy';
    this.phaseEndsAt = Date.now() + this.cfg.deploySec * 1000;
    this.nextEventAt = 0;
    this.announce(
      'Tributi, na pozicije. Odbrojavanje je počelo.',
      'Tributes, to your positions. The countdown has begun.',
      'major'
    );
    return { ok: true };
  }

  // ---------------------------------------------------------------- pozicija

  onPos(p, lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    p.pos = { lat, lng };
    p.posAt = Date.now();
    if (this.phase === 'deploy' && p.spawn && !p.spawnReached) {
      if (haversine(p.pos, p.spawn) <= 20) p.spawnReached = true;
    }
  }

  // ---------------------------------------------------------------- loot

  visionFor(p) {
    let v = this.cfg.visionM + this.statsFor(p).vision;
    if (Date.now() < this.nightUntil) v *= 0.5;
    return v;
  }

  tryLoot(p, lootId) {
    if (this.phase !== 'active' && this.phase !== 'finale') return { error: 'Ne sada' };
    if (p.combatId) return { error: 'U borbi si' };
    const l = this.loot.find((x) => x.id === lootId);
    if (!l || l.taken) return { error: 'Nema ničega ovde' };
    if (!p.pos || haversine(p.pos, l.pos) > this.cfg.lootReachM)
      return { error: 'Previše si daleko' };
    const now = Date.now();
    if (l.lockedBy && l.lockedBy !== p.id && l.lockedUntil > now)
      return { error: 'Neko drugi već pokušava' };
    l.lockedBy = p.id;
    l.lockedUntil = now + 45000;
    const kinds = { 1: ['tap', 'slider'], 2: ['slider', 'sequence'], 3: ['sequence', 'hold'] };
    const pool = kinds[l.rarity];
    return {
      ok: true,
      lootId: l.id,
      rarity: l.rarity,
      itemId: l.itemId,
      challenge: pool[Math.floor(Math.random() * pool.length)],
      difficulty: l.rarity,
    };
  }

  lootResult(p, lootId, success) {
    const l = this.loot.find((x) => x.id === lootId);
    if (!l || l.taken || l.lockedBy !== p.id) return { error: 'Isteklo' };
    l.lockedBy = null;
    if (!success) return { ok: true, success: false };
    l.taken = true;
    l.takenBy = p.id;
    p.items.push(l.itemId);
    const it = BY_ID[l.itemId];
    p.hp = Math.min(this.statsFor(p).maxHp, p.hp + (it.hp || 0));
    if (l.rarity === 3) {
      this.announce(
        `${p.name} je pronašao/la nešto moćno.`,
        `${p.name} found something powerful.`,
        'info'
      );
    }
    return { ok: true, success: true, itemId: l.itemId };
  }

  // ---------------------------------------------------------------- savezi

  alliesOf(id) { return this.alliances.get(id) || new Set(); }

  proposeAlliance(p, targetId) {
    const q = this.players.get(targetId);
    if (!q || !q.alive || !p.alive) return { error: 'Nedostupan igrač' };
    if (!p.pos || !q.pos || haversine(p.pos, q.pos) > this.cfg.engageM)
      return { error: 'Moraš biti bliže' };
    this.send(q, { t: 'proposal', kind: 'ally', from: p.id, fromName: p.name, expires: Date.now() + 25000 });
    q.pendingAlly = { from: p.id, until: Date.now() + 25000 };
    return { ok: true };
  }

  respondAlliance(p, fromId, accept) {
    if (!p.pendingAlly || p.pendingAlly.from !== fromId) return { error: 'Isteklo' };
    p.pendingAlly = null;
    const q = this.players.get(fromId);
    if (!q) return { error: 'Nema igrača' };
    if (!accept) {
      this.send(q, { t: 'toast', sr: `${p.name} je odbio/la savez.`, en: `${p.name} declined the alliance.` });
      return { ok: true };
    }
    if (!this.alliances.has(p.id)) this.alliances.set(p.id, new Set());
    if (!this.alliances.has(q.id)) this.alliances.set(q.id, new Set());
    this.alliances.get(p.id).add(q.id);
    this.alliances.get(q.id).add(p.id);
    this.announce(
      `${q.name} i ${p.name} su sklopili savez.`,
      `${q.name} and ${p.name} formed an alliance.`,
      'info'
    );
    return { ok: true };
  }

  breakAlliance(p, targetId) {
    this.alliesOf(p.id).delete(targetId);
    this.alliesOf(targetId).delete(p.id);
    const q = this.players.get(targetId);
    if (q) {
      this.send(q, { t: 'toast', sev: 'bad', sr: `${p.name} je raskinuo/la savez!`, en: `${p.name} broke the alliance!` });
    }
    return { ok: true };
  }

  // ---------------------------------------------------------------- borba

  engage(p, targetId) {
    if (this.phase !== 'active' && this.phase !== 'finale') return { error: 'Ne sada' };
    const q = this.players.get(targetId);
    if (!q || !q.alive || !p.alive) return { error: 'Nedostupan igrač' };
    if (p.combatId || q.combatId) return { error: 'Već je u borbi' };
    if (Date.now() < p.cooldownUntil) return { error: 'Sačekaj posle prethodne borbe' };
    if (Date.now() < q.cooldownUntil) return { error: 'Protivnik se još oporavlja' };
    if (this.alliesOf(p.id).has(q.id)) return { error: 'Saveznik ti je — prvo raskini savez' };
    if (!p.pos || !q.pos || haversine(p.pos, q.pos) > this.cfg.engageM)
      return { error: 'Moraš biti bliže (15 m)' };
    this.startCombat(p, q, false);
    return { ok: true };
  }

  startCombat(a, b, isFinal) {
    const mid = {
      lat: (a.pos.lat + b.pos.lat) / 2,
      lng: (a.pos.lng + b.pos.lng) / 2,
    };
    const c = {
      id: uid('c'),
      isFinal,
      ids: [a.id, b.id],
      names: { [a.id]: a.name, [b.id]: b.name },
      hp: { [a.id]: a.hp, [b.id]: b.hp },
      maxHp: { [a.id]: this.statsFor(a).maxHp, [b.id]: this.statsFor(b).maxHp },
      st: { [a.id]: { rage: 0, stun: 0, poison: 0 }, [b.id]: { rage: 0, stun: 0, poison: 0 } },
      used: { [a.id]: [], [b.id]: [] },
      round: 1,
      maxRounds: isFinal ? this.cfg.finalRounds : this.cfg.combatRounds,
      endsAt: Date.now() + this.cfg.roundSec * 1000,
      moves: {},
      log: [],
      meetPoint: mid,
      over: false,
    };
    this.combats.set(c.id, c);
    a.combatId = c.id;
    b.combatId = c.id;
    this.announce(
      isFinal ? `FINALE: ${a.name} protiv ${b.name}!` : `${a.name} je napao/la ${b.name}!`,
      isFinal ? `FINALE: ${a.name} vs ${b.name}!` : `${a.name} attacked ${b.name}!`,
      isFinal ? 'major' : 'warn'
    );
  }

  combatMove(p, move, itemId) {
    const c = this.combats.get(p.combatId);
    if (!c || c.over) return { error: 'Nema aktivne borbe' };
    if (c.moves[p.id]) return { error: 'Već si izabrao/la' };
    if (itemId) {
      const idx = p.items.indexOf(itemId);
      const it = BY_ID[itemId];
      if (idx < 0 || !it || it.type !== 'use') return { error: 'Nemaš taj predmet' };
      p.items.splice(idx, 1);
      c.moves[p.id] = { kind: 'item', itemId };
    } else {
      if (!MOVES.includes(move)) return { error: 'Nepoznat potez' };
      c.moves[p.id] = { kind: 'move', move };
    }
    if (Object.keys(c.moves).length === 2) this.resolveRound(c);
    return { ok: true };
  }

  resolveRound(c) {
    const [ia, ib] = c.ids;
    const A = this.players.get(ia), B = this.players.get(ib);
    const pick = (id) => c.moves[id] || { kind: 'move', move: MOVES[Math.floor(Math.random() * 3)] };
    const ma = pick(ia), mb = pick(ib);
    const line = { round: c.round, a: ma, b: mb, dmg: { [ia]: 0, [ib]: 0 }, note: null };

    // Potrosni predmeti
    const applyItem = (self, other, m) => {
      if (m.kind !== 'item') return;
      const it = BY_ID[m.itemId];
      c.used[self].push(m.itemId);
      if (it.use === 'heal') c.hp[self] = Math.min(c.maxHp[self], c.hp[self] + it.power);
      if (it.use === 'rage') c.st[self].rage = 2;
      if (it.use === 'stun') c.st[other].stun = 1;
      if (it.use === 'poison') c.st[other].poison = 3;
      if (it.use === 'cloak') {
        const pl = this.players.get(self);
        if (pl) pl.cloakUntil = Date.now() + it.power * 1000;
      }
    };
    applyItem(ia, ib, ma);
    applyItem(ib, ia, mb);

    const stA = c.st[ia].stun > 0, stB = c.st[ib].stun > 0;
    const usedA = ma.kind === 'item', usedB = mb.kind === 'item';

    let winner = null, mult = 1;
    if (stA && !stB) { winner = ib; }
    else if (stB && !stA) { winner = ia; }
    else if (stA && stB) { winner = null; }
    else if (usedA && usedB) { winner = null; line.note = 'both_item'; }
    else if (usedA) { winner = ib; mult = 0.5; }
    else if (usedB) { winner = ia; mult = 0.5; }
    else if (ma.move === mb.move) { winner = null; line.note = 'clash'; }
    else if (BEATS[ma.move] === mb.move) { winner = ia; }
    else { winner = ib; }

    const dealDmg = (win, lose) => {
      const W = this.players.get(win), L = this.players.get(lose);
      const ws = this.statsFor(W), ls = this.statsFor(L);
      const base = c.isFinal ? 20 : 13;
      let d = base + ws.atk * 0.9 - ls.def * 0.55;
      if (c.st[win].rage > 0) d *= 1.5;
      d = Math.max(4, Math.round(d * mult));
      c.hp[lose] = Math.max(0, c.hp[lose] - d);
      line.dmg[lose] = d;
    };

    if (winner) dealDmg(winner, winner === ia ? ib : ia);
    else if (!usedA && !usedB && !stA && !stB) {
      const chip = c.isFinal ? 6 : 4;
      c.hp[ia] = Math.max(0, c.hp[ia] - chip);
      c.hp[ib] = Math.max(0, c.hp[ib] - chip);
      line.dmg[ia] = chip; line.dmg[ib] = chip;
    }

    // Otrov + skidanje statusa
    for (const id of c.ids) {
      if (c.st[id].poison > 0) {
        c.hp[id] = Math.max(0, c.hp[id] - 6);
        line.dmg[id] = (line.dmg[id] || 0) + 6;
        c.st[id].poison--;
      }
      if (c.st[id].rage > 0) c.st[id].rage--;
      if (c.st[id].stun > 0) c.st[id].stun--;
    }

    line.hp = { ...c.hp };
    c.log.push(line);
    c.moves = {};
    c.round++;

    // Kraj?
    const deadA = c.hp[ia] <= 0, deadB = c.hp[ib] <= 0;
    if (deadA || deadB) {
      if (deadA && deadB) return this.endCombat(c, null, null);
      return this.endCombat(c, deadA ? ib : ia, deadA ? ia : ib);
    }
    if (c.round > c.maxRounds) {
      const pa = c.hp[ia] / c.maxHp[ia], pb = c.hp[ib] / c.maxHp[ib];
      if (Math.abs(pa - pb) < 0.02) {
        if (c.isFinal) { c.maxRounds += 3; c.endsAt = Date.now() + this.cfg.roundSec * 1000; return; }
        return this.endCombat(c, null, null); // obojica prezive
      }
      return this.endCombat(c, pa > pb ? ia : ib, pa > pb ? ib : ia);
    }
    c.endsAt = Date.now() + this.cfg.roundSec * 1000;
  }

  endCombat(c, winnerId, loserId) {
    c.over = true;
    c.winnerId = winnerId;
    c.endedAt = Date.now();
    for (const id of c.ids) {
      const pl = this.players.get(id);
      if (!pl) continue;
      pl.combatId = null;
      pl.lastCombatId = c.id;                      // da klijent stigne da prikaže ishod
      pl.lastCombatUntil = Date.now() + 9000;
      pl.hp = Math.max(1, c.hp[id]);
      pl.cooldownUntil = Date.now() + 45000;
    }
    if (!winnerId) {
      this.announce(
        `${c.names[c.ids[0]]} i ${c.names[c.ids[1]]} su se razišli — bez pobednika.`,
        `${c.names[c.ids[0]]} and ${c.names[c.ids[1]]} broke apart — no winner.`,
        'info'
      );
    } else {
      const W = this.players.get(winnerId), L = this.players.get(loserId);
      if (W && L) {
        W.hp = Math.max(1, c.hp[winnerId]);
        W.kills++;
        // Pobednik uzima pola plena
        const spoils = [...L.items].sort(() => Math.random() - 0.5).slice(0, Math.ceil(L.items.length / 2));
        W.items.push(...spoils);
        c.spoils = spoils;
        this.eliminate(L, 'combat', W.id);
      }
    }
    setTimeout(() => this.combats.delete(c.id), 20000);
  }

  // ---------------------------------------------------------------- eliminacija

  eliminate(p, reason, killerId) {
    if (!p.alive) return;
    p.alive = false;
    p.hp = 0;
    p.combatId = null;
    p.eliminatedAt = Date.now();
    p.deathReason = reason;
    p.place = this.alivePlayers().length + 1;
    for (const a of this.alliesOf(p.id)) this.alliesOf(a).delete(p.id);
    this.alliances.delete(p.id);

    const killer = killerId ? this.players.get(killerId) : null;
    const msgs = {
      combat: [`💀 ${p.name} je pao/la od ruke ${killer ? killer.name : '?'}.`, `💀 ${p.name} fell to ${killer ? killer.name : '?'}.`],
      arena: [`💀 ${p.name} nije preživeo/la arenu.`, `💀 ${p.name} did not survive the arena.`],
      hazard: [`💀 ${p.name} je ostao/la u zabranjenoj zoni.`, `💀 ${p.name} stayed in the forbidden zone.`],
      quit: [`💀 ${p.name} je napustio/la arenu.`, `💀 ${p.name} left the arena.`],
    };
    const m = msgs[reason] || msgs.arena;
    this.announce(m[0], m[1], 'death', { cannon: true, playerId: p.id });
    this.send(p, { t: 'eliminated', place: p.place, reason });
  }

  // ---------------------------------------------------------------- eventi

  scheduleEvent() {
    const { eventMinSec: a, eventMaxSec: b } = this.cfg;
    this.nextEventAt = Date.now() + (a + Math.random() * (b - a)) * 1000;
  }

  runEvent() {
    const alive = this.alivePlayers();
    if (alive.length < 2) return;
    const pool = ['evac', 'evac', 'sponsor', 'sponsor', 'night', 'feast'];
    if (this.cfg.shrink && this.arena.radius > 120) pool.push('shrink', 'shrink', 'shrink');
    const kind = pool[Math.floor(Math.random() * pool.length)];

    if (kind === 'shrink') {
      const floor = Math.max(60, Math.round(this.arena.radius0 * 0.3));
      this.arena.radius = Math.max(floor, Math.round(this.arena.radius * 0.78));
      this.announce(
        `⚠️ Arena se skuplja! Novi prečnik: ${Math.round(this.arena.radius * 2)} m. Van granice gubiš život.`,
        `⚠️ The arena is shrinking! New diameter: ${Math.round(this.arena.radius * 2)} m. Outside the line you lose health.`,
        'major'
      );
    } else if (kind === 'evac') {
      const center = randomPointInCircle(this.arena.center, this.arena.radius * 0.7);
      const radius = Math.max(50, this.arena.radius * 0.33);
      const now = Date.now();
      this.hazards.push({
        id: uid('h'), type: 'evac', center, radius,
        activeAt: now + 5 * 60 * 1000, until: now + 10 * 60 * 1000,
      });
      this.announce(
        `⚠️ Sektor je označen. Imate 5 minuta da izađete iz obeležene zone ili umirete.`,
        `⚠️ A sector has been marked. You have 5 minutes to leave the marked zone or die.`,
        'major'
      );
    } else if (kind === 'feast') {
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const pos = randomPointInCircle(this.arena.center, Math.max(10, this.arena.radius * 0.05));
        const l = this.mkLoot(pos, 'feast', true);
        l.feast = true;
        this.loot.push(l);
      }
      this.announce(
        `🎁 GOZBA! U kornukopiji (centar arene) ostavljeno je ${n} dragocenih predmeta. Vidljivi su svima.`,
        `🎁 FEAST! ${n} valuable items were left at the cornucopia (arena center). Visible to everyone.`,
        'major'
      );
    } else if (kind === 'sponsor') {
      const p = alive[Math.floor(Math.random() * alive.length)];
      const it = rollItem('cornucopia');
      p.items.push(it.id);
      p.hp = Math.min(this.statsFor(p).maxHp, p.hp + (it.hp || 0));
      this.announce(
        `🪂 Sponzor je poslao paket za ${p.name}.`,
        `🪂 A sponsor sent a parachute to ${p.name}.`,
        'info'
      );
      this.send(p, { t: 'gift', itemId: it.id });
    } else if (kind === 'night') {
      this.nightUntil = Date.now() + 3 * 60 * 1000;
      this.announce(
        `🌑 Pada mrak. Vidljivost je prepolovljena narednih 3 minuta.`,
        `🌑 Night falls. Vision halved for the next 3 minutes.`,
        'warn'
      );
    }
    this.scheduleEvent();
  }

  // ---------------------------------------------------------------- tick

  tick() {
    this.tickN++;
    const now = Date.now();

    if (this.phase === 'deploy') {
      if (now >= this.phaseEndsAt) {
        this.phase = 'active';
        this.scheduleEvent();
        this.announce(
          '🔔 GONG! Igre gladi su počele. Neka sreća uvek bude na vašoj strani.',
          '🔔 GONG! The Hunger Games have begun. May the odds be ever in your favour.',
          'major'
        );
      }
    }

    if (this.phase === 'active' || this.phase === 'finale') {
      // Borbe: istek runde
      for (const c of this.combats.values()) {
        if (!c.over && now >= c.endsAt) this.resolveRound(c);
      }

      // Steta van arene / u zoni + regeneracija
      if (this.tickN % 3 === 0) {
        for (const p of this.alivePlayers()) {
          if (!p.pos || p.combatId) continue;
          let dmg = 0;
          if (haversine(p.pos, this.arena.center) > this.arena.radius) dmg += 2;
          for (const h of this.hazards) {
            if (now >= h.activeAt && now < h.until && haversine(p.pos, h.center) <= h.radius) dmg += 5;
          }
          if (this.phase === 'finale' && this.finaleStartedAt &&
              now - this.finaleStartedAt > 8 * 60 * 1000 &&
              haversine(p.pos, this.arena.center) > this.cfg.finaleReachM) dmg += 4;
          if (dmg > 0) {
            p.hp -= dmg;
            if (p.hp <= 0) this.eliminate(p, dmg >= 5 ? 'hazard' : 'arena', null);
          }
        }
      }
      if (this.tickN % 15 === 0) {
        for (const p of this.alivePlayers()) {
          if (p.combatId) continue;
          p.hp = Math.min(this.statsFor(p).maxHp, p.hp + 1);
        }
      }

      this.hazards = this.hazards.filter((h) => now < h.until + 30000);

      if (this.phase === 'active' && this.nextEventAt && now >= this.nextEventAt) this.runEvent();

      // Bot AI
      if (this.tickN % 2 === 0) require('./bots').stepBots(this);

      // Prelazak u finale / kraj
      const alive = this.alivePlayers();
      if (this.phase === 'active' && alive.length === 2) {
        this.phase = 'finale';
        this.finaleStartedAt = now;
        const [x, y] = alive;
        this.announce(
          `🏛️ Ostali su samo ${x.name} i ${y.name}. Svi — i eliminisani — idite u centar arene. Finale počinje tamo.`,
          `🏛️ Only ${x.name} and ${y.name} remain. Everyone — including the eliminated — head to the arena center. The finale begins there.`,
          'major'
        );
      }
      if (this.phase === 'finale' && alive.length === 2) {
        const [x, y] = alive;
        const anyCombat = x.combatId || y.combatId;
        const bothThere =
          x.pos && y.pos &&
          haversine(x.pos, this.arena.center) <= this.cfg.finaleReachM &&
          haversine(y.pos, this.arena.center) <= this.cfg.finaleReachM;
        if (!anyCombat && bothThere && !this.finalCombatDone) {
          this.finalCombatDone = true;
          this.startCombat(x, y, true);
        }
      }
      if (alive.length <= 1 && (this.phase === 'active' || this.phase === 'finale')) {
        this.phase = 'ended';
        const w = alive[0];
        this.winnerId = w ? w.id : null;
        if (w) {
          w.place = 1;
          this.announce(
            `👑 Pobednik ${this.players.size}. Igara gladi: ${w.name}!`,
            `👑 Winner of these Hunger Games: ${w.name}!`,
            'major'
          );
        } else {
          this.announce('Nema pobednika.', 'No winner.', 'major');
        }
      }
    }

    this.broadcast();
  }

  // ---------------------------------------------------------------- state

  broadcast() {
    for (const p of this.players.values()) {
      if (p.isBot || !p.online) continue;
      this.send(p, this.stateFor(p));
    }
  }

  stateFor(p) {
    const now = Date.now();
    const spectator = !p.alive || this.phase === 'ended';
    const st = this.statsFor(p);
    const vision = this.visionFor(p);
    const allies = this.alliesOf(p.id);

    // Kontakti
    const contacts = [];
    if (this.phase !== 'lobby') {
      for (const q of this.players.values()) {
        if (q.id === p.id) continue;
        if (!q.alive && !spectator) continue;
        if (!q.pos) continue;
        if (spectator) {
          contacts.push({
            id: q.id, name: q.name, alive: q.alive, band: q.alive ? 'spy' : 'dead',
            lat: q.pos.lat, lng: q.pos.lng,
            dist: p.pos ? Math.round(haversine(p.pos, q.pos)) : null,
          });
          continue;
        }
        if (!p.pos) continue;
        const d = haversine(p.pos, q.pos);
        const isAlly = allies.has(q.id);
        const cloaked = now < q.cloakUntil && !isAlly;
        if (isAlly) {
          contacts.push({ id: q.id, name: q.name, alive: true, band: 'ally', lat: q.pos.lat, lng: q.pos.lng, dist: Math.round(d), brg: Math.round(bearing(p.pos, q.pos)) });
        } else if (cloaked) {
          continue;
        } else if (d <= this.cfg.engageM) {
          contacts.push({ id: q.id, name: q.name, alive: true, band: 'engage', lat: q.pos.lat, lng: q.pos.lng, dist: Math.round(d), brg: Math.round(bearing(p.pos, q.pos)), cooldown: Math.max(0, Math.ceil((Math.max(p.cooldownUntil, q.cooldownUntil) - now) / 1000)) });
        } else if (d <= this.cfg.proximityM) {
          contacts.push({ band: 'near', dist: Math.round(d / 25) * 25, brg: Math.round(bearing(p.pos, q.pos) / 45) * 45 });
        }
      }
    }

    // Loot vidljiv igracu
    const loot = [];
    if (this.phase === 'active' || this.phase === 'finale' || this.phase === 'ended') {
      for (const l of this.loot) {
        if (l.taken) continue;
        const visible = spectator || l.feast ||
          (p.pos && haversine(p.pos, l.pos) <= vision);
        if (!visible) continue;
        const d = p.pos ? Math.round(haversine(p.pos, l.pos)) : null;
        loot.push({
          id: l.id, lat: l.pos.lat, lng: l.pos.lng, rarity: l.rarity,
          isCorn: l.isCorn, feast: !!l.feast, dist: d,
          inReach: d != null && d <= this.cfg.lootReachM,
        });
      }
    }

    let combat = p.combatId ? this.combatView(this.combats.get(p.combatId), p.id) : null;
    if (!combat && p.lastCombatUntil > now) {
      combat = this.combatView(this.combats.get(p.lastCombatId), p.id);
    }
    let spectate = null;
    if (spectator) {
      const live = [...this.combats.values()].find((c) => !c.over);
      if (live) spectate = this.combatView(live, null);
    }

    return {
      t: 'state',
      now,
      phase: this.phase,
      code: this.code,
      isHost: this.hostId === p.id,
      cfg: {
        engageM: this.cfg.engageM, proximityM: this.cfg.proximityM,
        lootReachM: this.cfg.lootReachM, roundSec: this.cfg.roundSec,
        finaleReachM: this.cfg.finaleReachM,
      },
      arena: this.arena ? { center: this.arena.center, radius: this.arena.radius, radius0: this.arena.radius0 } : null,
      hazards: this.hazards.map((h) => ({ id: h.id, center: h.center, radius: h.radius, activeAt: h.activeAt, until: h.until })),
      night: now < this.nightUntil ? this.nightUntil : 0,
      countdown: this.phase === 'deploy' ? Math.max(0, Math.ceil((this.phaseEndsAt - now) / 1000)) : 0,
      you: {
        id: p.id, name: p.name, alive: p.alive, hp: Math.max(0, Math.round(p.hp)),
        maxHp: st.maxHp, atk: st.atk, def: st.def, items: p.items, kills: p.kills,
        spawn: p.spawn, spawnReached: p.spawnReached, place: p.place,
        cooldown: Math.max(0, Math.ceil((p.cooldownUntil - now) / 1000)),
        cloak: now < p.cloakUntil ? Math.ceil((p.cloakUntil - now) / 1000) : 0,
        allies: [...allies],
      },
      roster: [...this.players.values()].map((q) => ({
        id: q.id, name: q.name, alive: q.alive, isBot: q.isBot, online: q.online,
        kills: q.kills, place: q.place, host: q.id === this.hostId,
      })),
      aliveCount: this.alivePlayers().length,
      loot,
      contacts,
      combat,
      spectate,
      feed: this.feed.slice(-14),
      winnerId: this.winnerId,
      vision: Math.round(vision),
    };
  }

  combatView(c, viewerId) {
    if (!c) return null;
    const [ia, ib] = c.ids;
    const me = viewerId && c.ids.includes(viewerId) ? viewerId : null;
    const foe = me ? c.ids.find((x) => x !== me) : null;
    return {
      id: c.id, isFinal: c.isFinal, round: c.round, maxRounds: c.maxRounds,
      endsAt: c.endsAt, over: c.over, winnerId: c.winnerId,
      meetPoint: c.meetPoint,
      picked: me ? !!c.moves[me] : false,
      you: me ? { id: me, name: c.names[me], hp: c.hp[me], maxHp: c.maxHp[me], st: c.st[me] } : { id: ia, name: c.names[ia], hp: c.hp[ia], maxHp: c.maxHp[ia], st: c.st[ia] },
      foe: me ? { id: foe, name: c.names[foe], hp: c.hp[foe], maxHp: c.maxHp[foe], st: c.st[foe] } : { id: ib, name: c.names[ib], hp: c.hp[ib], maxHp: c.maxHp[ib], st: c.st[ib] },
      log: c.log.slice(-4),
      spoils: c.spoils || null,
    };
  }
}

module.exports = { Room, makeCode, DEFAULTS };
