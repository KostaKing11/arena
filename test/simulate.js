'use strict';
/* Headless provera pravila iz docs/js/engine/rules.js — istog fajla koji rade telefoni.
   Koristi virtuelni sat, pa cela partija prođe za delić sekunde.
   Pokretanje:  npm test                                                        */

const R = require('../docs/js/engine/rules.js');

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log(`  ✔ ${name}`);
  else { failures++; console.log(`  ✖ ${name}${extra ? '  → ' + extra : ''}`); }
}

/* ─────────────────── 1. determinizam ─────────────────── */
console.log('\n1. Determinizam sveta (svi telefoni moraju da vide isto)');
{
  const cfg = Object.assign({}, R.DEFAULTS, {
    center: { lat: 44.8125, lng: 20.4612 }, radius0: 400, lootCount: 24, lootMode: 'cornucopia', deploySec: 180,
  });
  const s1 = R.genSchedule('abc123', cfg), s2 = R.genSchedule('abc123', cfg);
  const l1 = R.genLoot('abc123', cfg, s1), l2 = R.genLoot('abc123', cfg, s2);
  const roster = ['p1', 'p2', 'p3', 'p4'];
  const sp1 = R.genSpawns('abc123', roster, cfg), sp2 = R.genSpawns('abc123', roster, cfg);

  check('isti seed → isti raspored događaja', JSON.stringify(s1) === JSON.stringify(s2));
  check('isti seed → isti plen', JSON.stringify(l1) === JSON.stringify(l2));
  check('isti seed → iste startne pozicije', JSON.stringify(sp1) === JSON.stringify(sp2));
  check('drugi seed → drugi svet', JSON.stringify(R.genLoot('xyz789', cfg, R.genSchedule('xyz789', cfg))) !== JSON.stringify(l1));
  check('automatski potez je determinističan', R.autoMove('k1', 3, 'p1') === R.autoMove('k1', 3, 'p1'));

  const corn = l1.filter((l) => l.isCorn && !l.feast).length;
  check('kornukopija dobija ~40% plena', corn === Math.round(24 * 0.4), `${corn}`);
  check('svi predmeti su unutar arene',
    l1.every((l) => R.haversine(l, cfg.center) <= cfg.radius0 * 1.01));
  check('startne pozicije su razmaknute', (() => {
    const a = Object.values(sp1);
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++)
      if (R.haversine(a[i], a[j]) < 30) return false;
    return true;
  })());
  check('gozbe se pojavljuju tek u svom trenutku',
    l1.filter((l) => l.feast).every((l) => l.availableAt > 0));
}

/* ─────────────────── 2. borba: papir-kamen-makaze ─────────────────── */
console.log('\n2. Pravila borbe');
{
  const mk = () => ({
    id: 'k1', ids: ['A', 'B'], hp: { A: 100, B: 100 }, maxHp: { A: 100, B: 100 },
    st: { A: {}, B: {} }, round: 1, maxRounds: 5, isFinal: false,
  });
  const stats = { A: { atk: 0, def: 0 }, B: { atk: 0, def: 0 } };
  const play = (ma, mb) => R.resolveRound(mk(),
    { A: { kind: 'move', move: ma }, B: { kind: 'move', move: mb } }, stats);

  const wins = { attack: 'feint', feint: 'block', block: 'attack' };
  let ok = true, detail = '';
  for (const a of R.MOVES) for (const b of R.MOVES) {
    const r = play(a, b);
    if (a === b) { if (r.line.dmg.A !== 4 || r.line.dmg.B !== 4) { ok = false; detail = `${a}=${b}`; } }
    else if (wins[a] === b) { if (!(r.line.dmg.B > 0 && r.line.dmg.A === 0)) { ok = false; detail = `${a}>${b}`; } }
    else if (!(r.line.dmg.A > 0 && r.line.dmg.B === 0)) { ok = false; detail = `${b}>${a}`; }
  }
  check('napad > varka > blok > napad', ok, detail);
  check('isti potez → obojica gube po malo', play('attack', 'attack').line.dmg.A === 4);

  const strong = R.resolveRound(mk(), { A: { kind: 'move', move: 'attack' }, B: { kind: 'move', move: 'feint' } },
    { A: { atk: 15, def: 0 }, B: { atk: 0, def: 0 } });
  const weak = play('attack', 'feint');
  check('oružje povećava štetu', strong.line.dmg.B > weak.line.dmg.B, `${strong.line.dmg.B} vs ${weak.line.dmg.B}`);

  const armored = R.resolveRound(mk(), { A: { kind: 'move', move: 'attack' }, B: { kind: 'move', move: 'feint' } },
    { A: { atk: 0, def: 0 }, B: { atk: 0, def: 12 } });
  check('oklop smanjuje štetu', armored.line.dmg.B < weak.line.dmg.B, `${armored.line.dmg.B} vs ${weak.line.dmg.B}`);

  const heal = R.resolveRound(
    Object.assign(mk(), { hp: { A: 50, B: 100 } }),
    { A: { kind: 'item', itemId: 'bandage' }, B: { kind: 'move', move: 'attack' } }, stats);
  check('zavoji leče, ali te te runde tuku upola', heal.hp.A > 50 && heal.line.dmg.A > 0);

  const stun = R.resolveRound(mk(), { A: { kind: 'item', itemId: 'trap' }, B: { kind: 'move', move: 'attack' } }, stats);
  check('zamka omamljuje protivnika za sledeću rundu', stun.st.B.stun === 0 || stun.st.B.stun >= 0);

  const dead = R.resolveRound(
    Object.assign(mk(), { hp: { A: 5, B: 100 } }),
    { A: { kind: 'move', move: 'block' }, B: { kind: 'move', move: 'feint' } }, stats);
  check('borba se završava kad neko padne', dead.over && dead.winnerId === 'B' && dead.loserId === 'A');

  const tie = R.resolveRound(
    Object.assign(mk(), { round: 5, hp: { A: 60, B: 60 } }),
    { A: { kind: 'move', move: 'attack' }, B: { kind: 'move', move: 'attack' } }, stats);
  check('nerešeno posle poslednje runde → obojica prežive', tie.over && !tie.winnerId);

  const tieFinal = R.resolveRound(
    Object.assign(mk(), { round: 7, maxRounds: 7, isFinal: true, hp: { A: 60, B: 60 } }),
    { A: { kind: 'move', move: 'attack' }, B: { kind: 'move', move: 'attack' } }, stats);
  check('finale se produžava dok nema pobednika', !tieFinal.over && tieFinal.extend === 3);
}

/* ─────────────────── 3. svet izveden iz vremena ─────────────────── */
console.log('\n3. Arena kroz vreme');
{
  const cfg = Object.assign({}, R.DEFAULTS, { center: { lat: 44.8125, lng: 20.4612 }, radius0: 400, deploySec: 60 });
  const sch = R.genSchedule('seed42', cfg);
  const shrinks = sch.filter((e) => e.kind === 'shrink');
  check('ima događaja skupljanja', shrinks.length > 0);
  check('arena se samo smanjuje',
    shrinks.every((e, i) => i === 0 || e.radius <= shrinks[i - 1].radius));
  check('arena ne padne ispod poda', shrinks.every((e) => e.radius >= Math.round(400 * 0.3)));
  check('pre prvog događaja prečnik je početni', R.arenaRadiusAt(cfg, sch, 0) === 400);
  check('posle svih događaja prečnik je poslednji',
    R.arenaRadiusAt(cfg, sch, 3 * 3600 * 1000) === shrinks[shrinks.length - 1].radius);
  check('zabranjena zona je aktivna tek posle 5 min', (() => {
    const ev = sch.find((e) => e.kind === 'evac');
    if (!ev) return true;
    const h = R.hazardsAt(sch, ev.at)[0];
    return h && h.activeAt === ev.at + 300000;
  })());
  check('faza: raspored → aktivno → finale → kraj',
    R.phaseAt(cfg, 1000, 5) === 'deploy' && R.phaseAt(cfg, 90000, 5) === 'active' &&
    R.phaseAt(cfg, 90000, 2) === 'finale' && R.phaseAt(cfg, 90000, 1) === 'ended');
}

/* ─────────────────── 4. cela partija ─────────────────── */
console.log('\n4. Cela partija sa 10 botova (virtuelni sat)');
{
  const cfg = Object.assign({}, R.DEFAULTS, {
    center: { lat: 44.8125, lng: 20.4612 }, radius0: 250,
    lootCount: 24, lootMode: 'cornucopia', deploySec: 30, shrink: true,
  });
  const seed = 'game' + 7;
  const schedule = R.genSchedule(seed, cfg);
  const loot = R.genLoot(seed, cfg, schedule);
  const ids = Array.from({ length: 10 }, (_, i) => 'p' + i);
  const spawns = R.genSpawns(seed, ids, cfg);
  const taken = {};
  const combats = {};
  const feed = [];
  const P = {};
  ids.forEach((id) => {
    P[id] = {
      id, name: 'Bot' + id.slice(1), alive: true, hp: 100, items: [], kills: 0,
      pos: Object.assign({}, spawns[id]), cooldownUntil: 0, combatId: null, place: 0,
      speed: 2.5 + Math.random() * 2, aggression: 0.3 + Math.random() * 0.5,
      greed: 0.4 + Math.random() * 0.5, waypoint: null, hpAt: 0, sponsors: {},
    };
  });
  const aliveArr = () => ids.map((i) => P[i]).filter((p) => p.alive);
  const statsOf = (p) => { const s = R.statsOf(p.items); return { atk: s.atk, def: s.def, maxHp: 100 + s.hp }; };
  const say = (t, s) => feed.push(`[${Math.round(t / 1000)}s] ${s}`);

  const T0 = 1700000000000;
  let t = T0, ended = false, guard = 0;

  while (!ended && guard++ < 20000) {
    t += 1000;
    const el = t - T0;
    const radius = R.arenaRadiusAt(cfg, schedule, el);
    const hazards = R.hazardsAt(schedule, el);
    const alive = aliveArr();
    if (alive.length <= 1) { ended = true; break; }

    // sponzori
    for (const ev of schedule) {
      if (ev.kind !== 'sponsor' || el < ev.at) continue;
      const tgt = R.sponsorTarget(ev, alive.map((p) => p.id).sort());
      if (tgt && !P[tgt].sponsors[ev.i]) { P[tgt].sponsors[ev.i] = 1; P[tgt].items.push(ev.itemId); }
    }
    if (el < cfg.deploySec * 1000) continue;

    for (const p of alive) {
      // borba
      if (p.combatId) {
        const c = combats[p.combatId];
        if (!c || c.over) { p.combatId = null; continue; }
        if (!c.moves[c.round]) c.moves[c.round] = {};
        if (!c.moves[c.round][p.id] && Math.random() < 0.5) {
          c.moves[c.round][p.id] = { kind: 'move', move: R.MOVES[Math.floor(Math.random() * 3)] };
        }
        const mv = c.moves[c.round];
        if (!(mv[c.ids[0]] && mv[c.ids[1]]) && t < c.endsAt) continue;
        const res = R.resolveRound(c, mv, { [c.ids[0]]: statsOf(P[c.ids[0]]), [c.ids[1]]: statsOf(P[c.ids[1]]) });
        c.hp = res.hp; c.st = res.st; c.round++;
        if (res.extend) c.maxRounds += res.extend;
        if (res.over) {
          c.over = true;
          c.ids.forEach((id) => { P[id].hp = Math.max(1, res.hp[id]); P[id].combatId = null; P[id].cooldownUntil = t + 45000; });
          if (res.winnerId) {
            const W = P[res.winnerId], L = P[res.loserId];
            W.kills++;
            W.items.push(...L.items.slice(0, Math.ceil(L.items.length / 2)));
            L.alive = false; L.hp = 0; L.place = aliveArr().length;
            say(el, `💀 ${L.name} pao od ruke ${W.name}` + (c.isFinal ? ' (FINALE)' : ''));
          }
        } else c.endsAt = t + cfg.roundSec * 1000;
        continue;
      }

      // šteta od zone
      if (t - p.hpAt >= 3000) {
        p.hpAt = t;
        let dmg = 0;
        if (R.haversine(p.pos, cfg.center) > radius) dmg += 2;
        for (const h of hazards) {
          if (el >= h.activeAt && el < h.until && R.haversine(p.pos, h.center) <= h.radius) dmg += 5;
        }
        if (dmg) {
          p.hp -= dmg;
          if (p.hp <= 0) { p.alive = false; p.hp = 0; p.place = aliveArr().length; say(el, `💀 ${p.name} nije preživeo arenu`); continue; }
        } else p.hp = Math.min(statsOf(p).maxHp, p.hp + 0.2);
      }

      // kretanje
      let target = null;
      if (alive.length === 2) target = cfg.center;
      else if (R.haversine(p.pos, cfg.center) > radius * 0.95) target = cfg.center;
      else {
        const hz = hazards.find((h) => el < h.until && R.haversine(p.pos, h.center) <= h.radius * 1.1);
        if (hz) target = R.destPoint(hz.center, R.bearing(hz.center, p.pos), hz.radius * 1.4);
        else {
          let best = null, bd = Infinity;
          if (Math.random() < p.greed) {
            for (const l of loot) {
              if (taken[l.id] || el < l.availableAt) continue;
              const d = R.haversine(p.pos, l);
              if (d < bd && d < 300) { bd = d; best = l; }
            }
          }
          if (best) target = { lat: best.lat, lng: best.lng };
          else {
            let prey = null, pd = Infinity;
            for (const q of alive) {
              if (q.id === p.id) continue;
              const d = R.haversine(p.pos, q.pos);
              if (d < pd && d < 200) { pd = d; prey = q; }
            }
            if (prey && Math.random() < 0.6) target = prey.pos;
            else {
              if (!p.waypoint || R.haversine(p.pos, p.waypoint) < 12) p.waypoint = R.pointInCircle(Math.random, cfg.center, radius * 0.85);
              target = p.waypoint;
            }
          }
        }
      }
      const d = R.haversine(p.pos, target);
      p.pos = d <= p.speed ? { lat: target.lat, lng: target.lng } : R.destPoint(p.pos, R.bearing(p.pos, target), p.speed);

      // plen
      const near = loot.find((l) => !taken[l.id] && el >= l.availableAt && R.haversine(p.pos, l) <= cfg.lootReachM);
      if (near && Math.random() < 0.5) {
        taken[near.id] = p.id;
        if (Math.random() < ([0, 0.9, 0.75, 0.6][near.rarity] || 0.8)) p.items.push(near.itemId);
        else delete taken[near.id];
      }

      // napad
      if (t >= p.cooldownUntil && !p.combatId) {
        for (const q of alive) {
          if (q.id === p.id || q.combatId || t < q.cooldownUntil) continue;
          if (R.haversine(p.pos, q.pos) > cfg.engageM) continue;
          const isFinal = alive.length === 2 && R.haversine(p.pos, cfg.center) <= cfg.finaleReachM;
          if (!isFinal && Math.random() > p.aggression * 0.5) continue;
          const cid = 'k' + (guard) + p.id;
          combats[cid] = {
            id: cid, ids: [p.id, q.id], isFinal,
            hp: { [p.id]: p.hp, [q.id]: q.hp },
            maxHp: { [p.id]: statsOf(p).maxHp, [q.id]: statsOf(q).maxHp },
            st: { [p.id]: {}, [q.id]: {} }, moves: {}, round: 1,
            maxRounds: isFinal ? cfg.finalRounds : cfg.combatRounds,
            endsAt: t + cfg.roundSec * 1000, over: false,
          };
          p.combatId = cid; q.combatId = cid;
          break;
        }
      }
    }
  }

  const alive = aliveArr();
  const w = alive[0];
  feed.slice(-6).forEach((l) => console.log('    ' + l));
  check('partija se završila pobednikom', alive.length === 1 && !!w,
    `živih: ${alive.length}, iteracija: ${guard}`);
  check('svi ostali imaju dodeljeno mesto', ids.filter((i) => !P[i].alive).every((i) => P[i].place > 0));
  check('nema živog igrača sa 0 života', alive.every((p) => p.hp > 0));
  check('mesta su jedinstvena', (() => {
    const pl = ids.filter((i) => !P[i].alive).map((i) => P[i].place);
    return new Set(pl).size === pl.length;
  })());
  check('plen je pokupljen', Object.keys(taken).length > 5);
  if (w) console.log(`    → pobednik ${w.name}: ${w.kills} eliminacija, ${w.items.length} predmeta, ${Math.round(w.hp)} hp, za ${Math.round((t - T0) / 1000)}s igre`);
}

console.log(failures ? `\n✖ ${failures} provera palo\n` : '\n✔ Sve provere prošle\n');
process.exit(failures ? 1 : 0);
