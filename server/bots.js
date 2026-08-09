'use strict';
// Simulirani igraci — za testiranje bez 12 ljudi na terenu.
// Krecu se realnom brzinom hoda, traze plen, napadaju i biju se.

const { haversine, bearing, destPoint, randomPointInCircle } = require('./geo');
const { BY_ID } = require('./items');

const STEP_SEC = 2; // stepBots se poziva na svake 2 sekunde

const NAMES = [
  'Kato', 'Marvel', 'Glimer', 'Trash', 'Foxface', 'Klov', 'Ruta', 'Treš',
  'Brutus', 'Enobarija', 'Fineas', 'Džoana', 'Bister', 'Vajres', 'Sejder', 'Gloss',
];

function botName(used) {
  const free = NAMES.filter((n) => !used.has(n));
  const pool = free.length ? free : NAMES;
  return pool[Math.floor(Math.random() * pool.length)] + (free.length ? '' : ' ' + Math.floor(Math.random() * 90 + 10));
}

function initBot(p) {
  p.bot = {
    speed: 1.0 + Math.random() * 0.9,          // m/s
    aggression: 0.25 + Math.random() * 0.6,    // sansa da napadne
    greed: 0.4 + Math.random() * 0.6,          // koliko lovi plen
    waypoint: null,
    moveAt: 0,
    lastLoot: null,
  };
}

function stepBots(room) {
  const now = Date.now();
  if (room.phase !== 'active' && room.phase !== 'finale' && room.phase !== 'deploy') return;

  for (const p of room.players.values()) {
    if (!p.isBot || !p.alive) continue;
    if (!p.bot || p.bot.speed == null) initBot(p);
    if (!p.pos) { p.pos = p.spawn ? { ...p.spawn } : { ...room.arena.center }; continue; }

    // Odgovor na ponudu saveza (bot razmisli par sekundi)
    if (p.pendingAlly && now > p.pendingAlly.until - 20000) {
      room.respondAlliance(p, p.pendingAlly.from, Math.random() > p.bot.aggression);
    }

    // --- U borbi: bira potez sa malim odlaganjem ---
    if (p.combatId) {
      const c = room.combats.get(p.combatId);
      if (!c || c.over || c.moves[p.id]) continue;
      if (!p.bot.moveAt || p.bot.moveAt < c.endsAt - room.cfg.roundSec * 1000) {
        p.bot.moveAt = now + 2000 + Math.random() * 5000;
      }
      if (now >= p.bot.moveAt) {
        const usable = p.items.filter((i) => BY_ID[i] && BY_ID[i].type === 'use');
        const hurt = c.hp[p.id] / c.maxHp[p.id] < 0.45;
        if (usable.length && (hurt ? Math.random() < 0.55 : Math.random() < 0.15)) {
          const heal = usable.find((i) => BY_ID[i].use === 'heal');
          room.combatMove(p, null, hurt && heal ? heal : usable[Math.floor(Math.random() * usable.length)]);
        } else {
          const moves = ['attack', 'block', 'feint'];
          const w = p.bot.aggression > 0.5 ? ['attack', 'attack', 'feint', 'block'] : moves;
          room.combatMove(p, w[Math.floor(Math.random() * w.length)]);
        }
      }
      continue;
    }

    if (room.phase === 'deploy') continue;

    // --- Kretanje ---
    const target = pickTarget(room, p, now);
    if (target) {
      const d = haversine(p.pos, target);
      const stepM = p.bot.speed * STEP_SEC;
      if (d <= stepM) p.pos = { ...target };
      else p.pos = destPoint(p.pos, bearing(p.pos, target), stepM);
      p.posAt = now;
    }

    // --- Kupljenje plena ---
    const near = room.loot.find(
      (l) => !l.taken && haversine(p.pos, l.pos) <= room.cfg.lootReachM &&
             (!l.lockedBy || l.lockedBy === p.id || l.lockedUntil < now)
    );
    if (near && Math.random() < 0.6) {
      const r = room.tryLoot(p, near.id);
      if (r.ok) {
        const successRate = [0, 0.9, 0.75, 0.6][near.rarity] || 0.8;
        room.lootResult(p, near.id, Math.random() < successRate);
        p.bot.waypoint = null;
      }
    }

    // --- Napad ---
    if (now >= p.cooldownUntil && !p.combatId) {
      for (const q of room.players.values()) {
        if (q.id === p.id || !q.alive || q.combatId) continue;
        if (!q.pos || now < q.cooldownUntil) continue;
        if (room.alliesOf(p.id).has(q.id)) continue;
        if (haversine(p.pos, q.pos) > room.cfg.engageM) continue;
        if (Math.random() < p.bot.aggression * 0.5) { room.engage(p, q.id); break; }
      }
    }
  }
}

function pickTarget(room, p, now) {
  const b = p.bot;
  const A = room.arena;

  // U finalu svi idu u centar
  if (room.phase === 'finale') return A.center;

  // Van arene ili u opasnoj zoni -> bezi ka centru
  if (haversine(p.pos, A.center) > A.radius * 0.95) return A.center;
  for (const h of room.hazards) {
    if (now < h.until && haversine(p.pos, h.center) <= h.radius * 1.1) {
      return destPoint(h.center, bearing(h.center, p.pos), h.radius * 1.4);
    }
  }

  // Najblizi plen u dometu "znanja"
  if (Math.random() < b.greed) {
    let best = null, bestD = Infinity;
    for (const l of room.loot) {
      if (l.taken) continue;
      const d = haversine(p.pos, l.pos);
      if (d < bestD && d < 300) { bestD = d; best = l; }
    }
    if (best) return best.pos;
  }

  // Nema plena u blizini -> kreni u lov na najblizeg igraca (inace partija stoji)
  let prey = null, preyD = Infinity;
  for (const q of room.players.values()) {
    if (q.id === p.id || !q.alive || !q.pos) continue;
    if (room.alliesOf(p.id).has(q.id)) continue;
    const d = haversine(p.pos, q.pos);
    if (d < preyD && d < 200) { preyD = d; prey = q; }
  }
  if (prey && Math.random() < 0.6) return prey.pos;

  // Lutanje
  if (!b.waypoint || haversine(p.pos, b.waypoint) < 12) {
    b.waypoint = randomPointInCircle(A.center, A.radius * 0.85);
  }
  return b.waypoint;
}

module.exports = { stepBots, botName, initBot };
