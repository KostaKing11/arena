'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

const { Room, makeCode } = require('./game');
const { botName, initBot } = require('./bots');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: 0 }));
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, rooms: rooms.size, uptime: Math.round(process.uptime()) })
);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/** @type {Map<string, Room>} */
const rooms = new Map();

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function newRoom() {
  let code;
  do { code = makeCode(); } while (rooms.has(code));
  const room = new Room(code);
  room.send = (player, msg) => { if (player && player.ws) send(player.ws, msg); };
  rooms.set(code, room);
  return room;
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  let room = null;
  let me = null;

  const fail = (msg) => send(ws, { t: 'error', msg });

  const attach = (r, p) => {
    // Otkaci ovaj socket sa prethodnog igraca (npr. rejoin pa join iz istog taba),
    // inace bi stari igrac ostao sa socketom koji vise ne slusa njegova stanja.
    if (me && me !== p && me.ws === ws) { me.ws = null; me.online = false; }
    // Ako je isti igrac vec otvoren negde drugde, poslednja veza preuzima.
    if (p.ws && p.ws !== ws) { try { p.ws.close(4000, 'replaced'); } catch { /* ignore */ } }
    room = r; me = p;
    p.ws = ws; p.online = true;
    ws.roomCode = r.code; ws.playerId = p.id;
    send(ws, {
      t: 'joined', code: r.code, playerId: p.id, token: p.token,
      isHost: r.hostId === p.id, name: p.name,
    });
    send(ws, r.stateFor(p));
  };

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;

    // --- pre ulaska u sobu ---
    if (m.t === 'create') {
      const r = newRoom();
      const p = r.addPlayer({ name: m.name });
      r.hostId = p.id;
      return attach(r, p);
    }
    if (m.t === 'join') {
      const r = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!r) return fail('Soba ne postoji');
      if (r.phase !== 'lobby') return fail('Igra je već počela');
      if (r.players.size >= 24) return fail('Soba je puna');
      return attach(r, r.addPlayer({ name: m.name }));
    }
    if (m.t === 'rejoin') {
      const r = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!r) return fail('Soba ne postoji');
      const p = r.players.get(m.playerId);
      if (!p || p.token !== m.token) return fail('Nevažeća sesija');
      return attach(r, p);
    }

    if (!room || !me) return fail('Nisi u sobi');
    const isHost = room.hostId === me.id;

    switch (m.t) {
      case 'ping': return send(ws, { t: 'pong', now: Date.now() });

      case 'setArena': {
        if (!isHost) return fail('Samo domaćin');
        const r = room.setArena(m);
        return r.error ? fail(r.error) : room.broadcast();
      }
      case 'addBots': {
        if (!isHost) return fail('Samo domaćin');
        if (room.phase !== 'lobby') return fail('Samo u čekaonici');
        const used = new Set([...room.players.values()].map((p) => p.name));
        const n = Math.max(1, Math.min(20, m.count || 1));
        for (let i = 0; i < n && room.players.size < 24; i++) {
          const b = room.addPlayer({ name: botName(used), isBot: true });
          used.add(b.name);
          initBot(b);
        }
        return room.broadcast();
      }
      case 'kick': {
        if (!isHost) return fail('Samo domaćin');
        room.removePlayer(m.id);
        return room.broadcast();
      }
      case 'setName': {
        if (room.phase !== 'lobby') return fail('Kasno je');
        me.name = String(m.name || 'Tribut').slice(0, 16);
        return room.broadcast();
      }
      case 'start': {
        if (!isHost) return fail('Samo domaćin');
        const r = room.start();
        return r.error ? fail(r.error) : room.broadcast();
      }
      case 'pos':
        return room.onPos(me, m.lat, m.lng);

      case 'lootTry': {
        const r = room.tryLoot(me, m.lootId);
        return r.error ? fail(r.error) : send(ws, { t: 'challenge', ...r });
      }
      case 'lootDone': {
        const r = room.lootResult(me, m.lootId, !!m.success);
        return r.error ? fail(r.error) : send(ws, { t: 'lootResult', ...r });
      }
      case 'engage': {
        const r = room.engage(me, m.targetId);
        return r.error ? fail(r.error) : null;
      }
      case 'ally': {
        const r = room.proposeAlliance(me, m.targetId);
        return r.error ? fail(r.error) : send(ws, { t: 'toast', sr: 'Ponuda poslata.', en: 'Offer sent.' });
      }
      case 'allyRespond': {
        const r = room.respondAlliance(me, m.fromId, !!m.accept);
        return r.error ? fail(r.error) : null;
      }
      case 'allyBreak':
        return room.breakAlliance(me, m.targetId), null;

      case 'combatMove': {
        const r = room.combatMove(me, m.move, m.itemId);
        return r.error ? fail(r.error) : null;
      }
      case 'quit': {
        if (room.phase === 'lobby') room.removePlayer(me.id);
        else room.eliminate(me, 'quit', null);
        return room.broadcast();
      }
      default:
        return;
    }
  });

  ws.on('close', () => {
    // Samo ako je jos uvek nas socket — inace smo vec zamenjeni novijom vezom.
    if (room && me && me.ws === ws) { me.online = false; me.ws = null; }
  });
});

// Heartbeat + ciscenje mrtvih soba
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch { /* ignore */ }
  });
}, 30000);

setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms) {
    const humans = [...r.players.values()].filter((p) => !p.isBot && p.online).length;
    const idleTooLong = humans === 0 && now - r.createdAt > 10 * 60 * 1000;
    const ancient = now - r.createdAt > 6 * 60 * 60 * 1000;
    if (idleTooLong || ancient) { r.destroy(); rooms.delete(code); }
  }
}, 60000);

server.listen(PORT, () => {
  const os = require('os');
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  console.log(`\n  ARENA IRL server\n  ────────────────`);
  console.log(`  lokalno:  http://localhost:${PORT}`);
  ips.forEach((ip) => console.log(`  na mrezi: http://${ip}:${PORT}`));
  console.log(`\n  Za telefone preko interneta pokreni tunel (vidi README).\n`);
});

module.exports = { app, server, rooms };
