/* ARENA — glavna logika klijenta */
const $ = (id) => document.getElementById(id);
const R_E = 6371000, rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

function dist(a, b) {
  if (!a || !b) return Infinity;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_E * Math.asin(Math.min(1, Math.sqrt(h)));
}
function brg(a, b) {
  const dLng = rad(b.lng - a.lng), la1 = rad(a.lat), la2 = rad(b.lat);
  return (deg(Math.atan2(Math.sin(dLng) * Math.cos(la2),
    Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng))) + 360) % 360;
}
const COMP = { sr: ['S', 'SI', 'I', 'JI', 'J', 'JZ', 'Z', 'SZ'], en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] };
const compass = (b) => COMP[LANG === 'en' ? 'en' : 'sr'][Math.round(b / 45) % 8];
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const App = {
  s: null, pid: null, screen: 'home',
  pos: null, posSent: 0, geoOn: false, geoErr: false,
  sim: localStorage.getItem('arena.sim') === '1', walk: false, walkTo: null,
  gmap: null, smap: null,
  arenaCenter: null, lootMode: 'cornucopia',
  busy: false, lastCombatRound: 0, seenFeed: new Set(), tickerItems: [],
  elimShown: false, endShown: false, watching: false,
};

/* ─────────────────────────────── init ─────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  applyLang();
  makeEmbers();
  wire();
  $('nameInput').value = localStorage.getItem('arena.name') || '';
  $('simToggle').checked = App.sim;

  Net.on('open', () => { })
    .on('down', () => toast(T('lost'), 'bad'))
    .on('nocfg', () => {
      document.querySelector('.home-panel').innerHTML =
        `<h3 style="color:var(--gold);margin:0 0 8px">Firebase nije podešen</h3>
         <p class="hint">Otvori <code>docs/js/firebase-config.js</code> i nalepi svoj config.
         Uputstvo korak po korak je u <b>README.md</b>, odeljak „Podešavanje Firebase-a".</p>`;
    })
    .on('replaced', () => toast(LANG === 'en'
      ? 'This arena was opened in another window.' : 'Arena je otvorena u drugom prozoru.', 'bad'))
    .on('joined', (m) => {
      App.pid = m.playerId;
      Net.session.save(m.code, m.playerId, m.token);
      $('roomCode').textContent = m.code;
      show('lobby');
      ensureSetupMap();
      startGeo();
    })
    .on('state', (m) => { App.s = m; App.render(); })
    .on('error', (m) => { App.busy = false; toast(m.msg, 'bad'); })
    .on('toast', (m) => toast(LANG === 'en' ? m.en : m.sr, m.sev || ''))
    .on('challenge', onChallenge)
    .on('lootResult', (m) => {
      if (m.success) { toast(T('got', itemName(m.itemId)) + ' ' + itemIcon(m.itemId), 'good'); flashOk(); Sfx.ping(); }
      else toast(T('failed'), 'bad');
      App.busy = false;
    })
    .on('proposal', (m) => {
      $('allyTxt').textContent = LANG === 'en'
        ? `${m.fromName} offers you an alliance.` : `${m.fromName} ti nudi savez.`;
      $('modalAlly').hidden = false;
      $('allyYes').onclick = () => { Net.send({ t: 'allyRespond', fromId: m.from, accept: true }); $('modalAlly').hidden = true; };
      $('allyNo').onclick = () => { Net.send({ t: 'allyRespond', fromId: m.from, accept: false }); $('modalAlly').hidden = true; };
      setTimeout(() => { $('modalAlly').hidden = true; }, 24000);
    })
    .on('gift', (m) => toast('🪂 ' + T('got', itemName(m.itemId)), 'good'))
    .on('eliminated', () => { setTimeout(showElim, 4600); });

  Net.connect();
  setInterval(tickLocal, 200);
});

/* ─────────────────────────────── UI wiring ─────────────────────────────── */
function wire() {
  // Zvuk se sme pokrenuti tek posle prve interakcije korisnika.
  ['pointerdown', 'keydown'].forEach((e) =>
    document.addEventListener(e, () => Sfx.unlock(), { once: true }));

  $('btnLang').onclick = toggleLang;
  $('btnLang2').onclick = toggleLang;

  $('btnCreate').onclick = () => {
    const n = name$(); if (!n) return toast(T('needName'), 'bad');
    Net.session.clear(); Net.send({ t: 'create', name: n });
  };
  $('btnJoin').onclick = () => {
    const n = name$(); if (!n) return toast(T('needName'), 'bad');
    const c = $('codeInput').value.toUpperCase().trim();
    if (c.length < 4) return toast(T('needCode'), 'bad');
    Net.session.clear(); Net.send({ t: 'join', code: c, name: n });
  };
  $('codeInput').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });

  $('btnLeave').onclick = () => { Net.send({ t: 'quit' }); Net.session.clear(); location.reload(); };
  $('btnShare').onclick = async () => {
    const url = `${location.origin}/?c=${App.s?.code || ''}`;
    const text = `ARENA — kod sobe: ${App.s?.code}\n${url}`;
    if (navigator.share) { try { await navigator.share({ title: 'ARENA', text, url }); return; } catch { } }
    try { await navigator.clipboard.writeText(text); toast(T('copied'), 'good'); } catch { toast(url); }
  };

  // podesavanja arene
  const push = debounce(sendArena, 350);
  $('radius').oninput = (e) => {
    $('radLbl').textContent = e.target.value * 2 + ' m';
    App.smap && App.smap.setRadius(+e.target.value); push();
  };
  $('lootCount').oninput = (e) => { $('lootLbl').textContent = e.target.value; push(); };
  $('deploySec').oninput = (e) => { $('depLbl').textContent = fmtMin(+e.target.value); push(); };
  $('shrink').onchange = push;
  $('lootMode').querySelectorAll('button').forEach((b) => b.onclick = () => {
    $('lootMode').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on'); App.lootMode = b.dataset.v; push();
  });
  $('btnMyLoc').onclick = () => {
    if (!App.pos) { startGeo(); return toast(T('geoDenied'), 'bad'); }
    App.smap.setCenter(App.pos); App.arenaCenter = App.pos; sendArena();
  };
  $('btnBots').onclick = () => Net.send({ t: 'addBots', count: 3 });
  $('btnStart').onclick = () => { if (!App.arenaCenter) return toast(T('needArena'), 'bad'); sendArena(); setTimeout(() => Net.send({ t: 'start' }), 250); };
  $('btnDemo').onclick = demoArena;

  // igra
  $('btnMenu').onclick = () => { $('sheetMenu').hidden = false; };
  $('btnInv').onclick = () => { renderInv(); $('sheetInv').hidden = false; };
  $('btnFeed').onclick = () => { renderFeedSheet(); $('sheetFeed').hidden = false; };
  $('btnCenter').onclick = () => App.gmap && App.gmap.recenter();
  document.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => b.closest('.sheet').hidden = true);
  document.querySelectorAll('.sheet').forEach((s) => s.addEventListener('click', (e) => { if (e.target === s) s.hidden = true; }));

  $('simToggle').onchange = (e) => {
    App.sim = e.target.checked; localStorage.setItem('arena.sim', App.sim ? '1' : '0');
    if (App.sim && !App.pos && App.s?.arena) App.pos = { ...App.s.arena.center };
    if (!App.sim) startGeo();
    toast(App.sim ? 'SIM ON' : 'SIM OFF');
  };
  $('walkToggle').onchange = (e) => { App.walk = e.target.checked; };
  $('btnQuit').onclick = () => { if (confirm('Napustiti arenu?')) { Net.send({ t: 'quit' }); $('sheetMenu').hidden = true; } };

  $('btnLoot').onclick = () => {
    const l = reachableLoot();
    if (!l || App.busy) return;
    App.busy = true; Net.send({ t: 'lootTry', lootId: l.id });
  };

  // borba
  document.querySelectorAll('#cbMoves .move').forEach((b) => b.onclick = () => {
    if (b.disabled) return;
    Net.send({ t: 'combatMove', move: b.dataset.m });
    document.querySelectorAll('#cbMoves .move').forEach((x) => { x.classList.remove('sel'); x.disabled = true; });
    b.classList.add('sel');
  });

  $('endHome').onclick = () => { Net.session.clear(); location.reload(); };
  $('endWatch').onclick = () => { App.watching = true; $('modalEnd').hidden = true; };

  const params = new URLSearchParams(location.search);
  if (params.get('c')) $('codeInput').value = params.get('c').toUpperCase();
}

const name$ = () => {
  const v = $('nameInput').value.trim().slice(0, 16);
  if (v) localStorage.setItem('arena.name', v);
  return v;
};
const fmtMin = (s) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s}s`);
function debounce(f, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; }

function sendArena() {
  if (!App.arenaCenter) return;
  Net.send({
    t: 'setArena', center: App.arenaCenter, radius: +$('radius').value,
    lootMode: App.lootMode, lootCount: +$('lootCount').value,
    deploySec: +$('deploySec').value, shrink: $('shrink').checked,
  });
}

function demoArena() {
  const c = App.pos || { lat: 44.8125, lng: 20.4612 };
  App.arenaCenter = c;
  App.smap && App.smap.setCenter(c);
  $('radius').value = 150; $('radLbl').textContent = '300 m'; App.smap && App.smap.setRadius(150);
  $('lootCount').value = 20; $('lootLbl').textContent = '20';
  $('deploySec').value = 30; $('depLbl').textContent = '30s';
  sendArena();
  Net.send({ t: 'addBots', count: 5 });
  App.sim = true; $('simToggle').checked = true; localStorage.setItem('arena.sim', '1');
  App.pos = { ...c };
  toast(LANG === 'en' ? 'Test arena ready: 5 bots + GPS simulation. Press START.'
                      : 'Test arena spremna: 5 botova + simulacija GPS-a. Pritisni POKRENI.', 'good');
}

/* ─────────────────────────────── ekrani ─────────────────────────────── */
function show(name) {
  if (App.screen === name) return;
  App.screen = name;
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $('s-' + name).classList.add('active');
  if (name === 'game') { ensureGameMap(); keepAwake(); }
  if (name === 'lobby') setTimeout(() => App.smap && App.smap.refresh(), 120);
}

function ensureSetupMap() {
  if (App.smap) { App.smap.refresh(); return; }
  App.smap = MapView.initSetup($('setupMap'), (c) => { App.arenaCenter = { lat: c.lat, lng: c.lng }; sendArena(); });
  if (App.pos) App.smap.map.setView([App.pos.lat, App.pos.lng], 16);
  $('radLbl').textContent = $('radius').value * 2 + ' m';
  $('depLbl').textContent = fmtMin(+$('deploySec').value);
}

function ensureGameMap() {
  if (App.gmap) { App.gmap.refresh(); return; }
  App.gmap = MapView.initGame($('gameMap'));
  App.gmap.onLoot = (l) => { if (l.inReach && !App.busy) { App.busy = true; Net.send({ t: 'lootTry', lootId: l.id }); } };
  App.gmap.onTap = (p) => {
    if (!App.sim) return;
    if (App.walk) App.walkTo = p; else { App.pos = p; sendPos(true); }
  };
}

/* ─────────────────────────────── render ─────────────────────────────── */
App.render = function () {
  const s = App.s; if (!s) return;
  document.body.classList.toggle('is-host', !!s.isHost);
  document.body.classList.toggle('is-guest', !s.isHost);

  if (s.phase === 'lobby') { show('lobby'); renderLobby(s); return; }
  show('game');
  renderHud(s);
  renderDeploy(s);
  renderContacts(s);
  renderTicker(s);
  renderCombat(s);
  renderLootBtn(s);
  if (App.gmap) App.gmap.update(s, App.pos);
  if (s.phase === 'ended' && !App.endShown) { App.endShown = true; setTimeout(showEnd, 1200); }
};

function renderLobby(s) {
  $('roomCode').textContent = s.code;
  $('playerCount').textContent = s.roster.length;
  $('lobbyRoster').innerHTML = s.roster.map((p) => `
    <li><span class="pid">${p.isBot ? '🤖' : p.name.slice(0, 1).toUpperCase()}</span>
    <span>${esc(p.name)}</span>
    <span class="meta">${p.host ? '👑 host' : p.isBot ? 'bot' : p.online ? '' : 'offline'}</span></li>`).join('');
  $('btnStart').disabled = s.roster.length < 2 || !s.arena;
  if (s.arena && !App.arenaCenter) {
    App.arenaCenter = s.arena.center;
    App.smap && App.smap.setCenter(s.arena.center);
  }
}

function renderHud(s) {
  const y = s.you;
  $('phaseTag').textContent = T('phase' + s.phase[0].toUpperCase() + s.phase.slice(1));
  $('aliveTag').textContent = T('aliveN', s.aliveCount);
  const pct = Math.max(0, Math.min(1, y.hp / y.maxHp));
  $('hpFill').style.transform = `scaleX(${pct})`;
  $('hpTxt').textContent = `${y.hp} / ${y.maxHp}`;
  $('stAtk').textContent = y.atk; $('stDef').textContent = y.def; $('stKil').textContent = y.kills;
  $('visionHint').textContent = `👁 ${s.vision} m${s.night ? ' · ' + T('night') : ''}`;
  $('btnInv').classList.toggle('badge', y.items.length > 0);
}

function renderDeploy(s) {
  const card = $('deployCard');
  const on = s.phase === 'deploy' && s.you.spawn && s.you.alive;
  card.classList.toggle('on', !!on);
  if (!on) return;
  $('dcCount').textContent = mmss(s.countdown);
  if (App.pos) {
    const d = Math.round(dist(App.pos, s.you.spawn));
    $('dcDist').textContent = s.you.spawnReached ? '✔' : d + ' m';
    $('dcArrow').style.transform = `rotate(${brg(App.pos, s.you.spawn)}deg)`;
    $('dcArrow').style.opacity = s.you.spawnReached ? 0.25 : 1;
  } else $('dcDist').textContent = '— m';
}

function renderContacts(s) {
  const box = $('contacts');
  const sig = JSON.stringify((s.contacts || []).map((c) => [c.id, c.band, Math.round(c.dist / 5), c.cooldown]));
  if (box._sig === sig) return;
  box._sig = sig;
  const allies = new Set(s.you.allies || []);
  box.innerHTML = (s.contacts || []).filter((c) => c.band !== 'dead' && c.band !== 'spy').map((c) => {
    if (c.band === 'near') return `<div class="contact near">
        <div class="cn">👤 ${T('someoneNear')}</div>
        <div class="cd">${T('dirDist', compass(c.brg), c.dist)}</div></div>`;
    const isAlly = c.band === 'ally' || allies.has(c.id);
    const canFight = c.band === 'engage' && !c.cooldown;
    return `<div class="contact ${isAlly ? 'ally' : 'engage'}">
      <div class="cn"><span>${isAlly ? '🤝' : '⚔️'} ${esc(c.name)}</span><span class="cd">${c.dist} m</span></div>
      <div class="cd">${compass(c.brg)}</div>
      <div class="cacts">
        ${isAlly
          ? `<button data-act="break" data-id="${c.id}">${T('breakAlly')}</button>`
          : `<button class="fight" data-act="fight" data-id="${c.id}" ${canFight ? '' : 'disabled'}>${c.cooldown ? c.cooldown + 's' : T('fight')}</button>
             <button class="ally" data-act="ally" data-id="${c.id}">${T('ally')}</button>`}
      </div></div>`;
  }).join('');
  box.querySelectorAll('button[data-act]').forEach((b) => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'fight') Net.send({ t: 'engage', targetId: id });
    if (b.dataset.act === 'ally') Net.send({ t: 'ally', targetId: id });
    if (b.dataset.act === 'break') Net.send({ t: 'allyBreak', targetId: id });
  });
}

function renderTicker(s) {
  for (const f of s.feed || []) {
    if (App.seenFeed.has(f.id)) continue;
    App.seenFeed.add(f.id);
    if (Date.now() - f.ts > 15000) continue;
    const el = document.createElement('div');
    el.className = 'tk ' + (f.sev || '');
    el.textContent = LANG === 'en' ? f.en : f.sr;
    $('ticker').appendChild(el);
    if (f.sev === 'death') {
      $('flash').classList.remove('go'); void $('flash').offsetWidth; $('flash').classList.add('go');
      Sfx.cannon();
    } else if (f.sev === 'major') Sfx.gong();
    else if (f.sev === 'warn') Sfx.alarm();
    try { navigator.vibrate && navigator.vibrate(f.sev === 'major' ? [60, 40, 60] : 40); } catch { }
    setTimeout(() => el.remove(), 8000);
    while ($('ticker').children.length > 3) $('ticker').firstChild.remove();
  }
}

function reachableLoot() {
  const s = App.s;
  if (!s || !s.you.alive || s.combat) return null;
  return (s.loot || []).filter((l) => l.inReach).sort((a, b) => a.dist - b.dist)[0] || null;
}
function renderLootBtn(s) {
  const b = $('btnLoot');
  if (s.phase !== 'active' && s.phase !== 'finale') { b.hidden = true; return; }
  if (!s.you.alive || s.combat) { b.hidden = true; return; }
  const l = reachableLoot();
  if (l) {
    b.hidden = false; b.disabled = false; b.style.filter = '';
    b.textContent = '📦 ' + T('lootHere');
    return;
  }
  const near = [...(s.loot || [])].sort((a, b2) => a.dist - b2.dist)[0];
  if (near && near.dist < 120) {
    b.hidden = false; b.disabled = true; b.style.filter = 'grayscale(.6)';
    b.textContent = T('lootFar', near.dist);
  } else b.hidden = true;
}

/* ─────────────────────────────── borba ─────────────────────────────── */
function renderCombat(s) {
  const c = s.combat || (App.watching ? s.spectate : null);
  const m = $('modalCombat');
  if (!c) { m.hidden = true; App.lastCombatRound = 0; return; }
  m.hidden = false;
  const mine = !!s.combat;

  $('cbRound').textContent = (c.isFinal ? '★ ' : '') + (LANG === 'en' ? 'ROUND' : 'RUNDA') + ` ${Math.min(c.round, c.maxRounds)}/${c.maxRounds}`;
  $('cbYouName').textContent = c.you.name + (mine ? '' : '');
  $('cbFoeName').textContent = c.foe.name;
  $('cbYouHp').style.transform = `scaleX(${Math.max(0, c.you.hp / c.you.maxHp)})`;
  $('cbFoeHp').style.transform = `scaleX(${Math.max(0, c.foe.hp / c.foe.maxHp)})`;
  $('cbYouNum').textContent = `${c.you.hp}/${c.you.maxHp}`;
  $('cbFoeNum').textContent = `${c.foe.hp}/${c.foe.maxHp}`;

  if (mine && c.meetPoint && App.pos) {
    const d = Math.round(dist(App.pos, c.meetPoint));
    $('cbMeet').textContent = T('meetAt', d);
  } else $('cbMeet').textContent = '';

  // nova runda -> animacija stete + reset dugmadi
  if (c.log.length && c.log[c.log.length - 1].round !== App.lastCombatRound) {
    const ln = c.log[c.log.length - 1];
    App.lastCombatRound = ln.round;
    popDmg('cbYouDmg', ln.dmg[c.you.id]);
    popDmg('cbFoeDmg', ln.dmg[c.foe.id]);
    $('cbLog').textContent = describeRound(ln, c);
    if (ln.dmg[c.you.id] > 0 && mine) { try { navigator.vibrate && navigator.vibrate(90); } catch { } }
  }

  const picked = c.picked;
  document.querySelectorAll('#cbMoves .move').forEach((b) => {
    b.disabled = !mine || picked || c.over;
    if (!picked) b.classList.remove('sel');
  });
  $('cbWait').hidden = !(mine && picked && !c.over);
  $('cbMoves').style.display = mine && !c.over ? 'flex' : 'none';

  // potrošni predmeti
  const items = (s.you.items || []).filter((i) => itemInfo(i).use);
  $('cbItems').innerHTML = (mine && !c.over && !picked)
    ? items.map((i) => `<button data-item="${i}">${itemIcon(i)} ${itemName(i)}</button>`).join('') : '';
  $('cbItems').querySelectorAll('button').forEach((b) => b.onclick = () => {
    Net.send({ t: 'combatMove', itemId: b.dataset.item });
    $('cbItems').innerHTML = '';
  });

  const res = $('cbResult');
  if (c.over) {
    res.hidden = false;
    const win = c.winnerId === s.you.id;
    res.className = 'cb-result ' + (c.winnerId ? (win ? 'win' : 'lose') : '');
    const spoils = (c.spoils || []).map((i) => itemIcon(i)).join(' ');
    res.innerHTML = !c.winnerId
      ? `<h2>${T('draw')}</h2>`
      : mine
        ? `<h2>${win ? T('youWin') : T('youLose')}</h2>${win && spoils ? `<p>+ ${spoils}</p>` : ''}`
        : `<h2>${esc(c.winnerId === c.you.id ? c.you.name : c.foe.name)} 🏆</h2>`;
  } else res.hidden = true;
}
function describeRound(ln, c) {
  const nm = (id) => (id === c.you.id ? c.you.name : c.foe.name);
  const mv = { attack: T('mAttack'), block: T('mBlock'), feint: T('mFeint') };
  const one = (id, m) => `${nm(id)}: ${m.kind === 'item' ? itemIcon(m.itemId) + ' ' + itemName(m.itemId) : mv[m.move]}`;
  const ids = Object.keys(ln.dmg);
  return `${one(ids[0], ln.a)}  ·  ${one(ids[1], ln.b)}`;
}
function popDmg(id, v) {
  const el = $(id);
  if (!v) return;
  el.textContent = '-' + v;
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
}

/* ─────────────────────────────── izazovi ─────────────────────────────── */
async function onChallenge(m) {
  const ok = await Challenges.run(m.challenge, m.difficulty);
  Net.send({ t: 'lootDone', lootId: m.lootId, success: ok });
  App.busy = false;
}

/* ─────────────────────────────── inventar / feed ─────────────────────────────── */
function renderInv() {
  const items = App.s?.you.items || [];
  $('invGrid').innerHTML = items.map((i) => {
    const inf = itemInfo(i);
    const bonus = [inf.atk ? `⚔+${inf.atk}` : '', inf.def ? `🛡+${inf.def}` : '',
      inf.hp ? `❤+${inf.hp}` : '', inf.vision ? `👁+${inf.vision}` : '',
      inf.use ? '⚡' : ''].filter(Boolean).join(' ');
    return `<div class="inv-item r${inf.r || 1}"><div class="ii">${itemIcon(i)}</div>
      <div class="in">${itemName(i)}</div><div class="ib">${bonus}</div></div>`;
  }).join('') || `<p class="hint">${T('noItems')}</p>`;
  const y = App.s?.you;
  $('invHint').textContent = y ? `⚔ ${y.atk}  🛡 ${y.def}  ❤ ${y.hp}/${y.maxHp}` : '';
}
function renderFeedSheet() {
  const s = App.s; if (!s) return;
  $('feedList').innerHTML = [...s.feed].reverse().map((f) =>
    `<li class="${f.sev || ''}">${esc(LANG === 'en' ? f.en : f.sr)}</li>`).join('');
  $('gameRoster').innerHTML = s.roster.map((p) => `
    <li class="${p.alive ? '' : 'dead'}"><span class="pid">${p.isBot ? '🤖' : p.name.slice(0, 1).toUpperCase()}</span>
    <span>${esc(p.name)}</span>
    <span class="meta">${p.alive ? '💀 ' + p.kills : (p.place ? p.place + '.' : '')}</span></li>`).join('');
}

/* ─────────────────────────────── kraj ─────────────────────────────── */
function showElim() {
  if (App.elimShown) return; App.elimShown = true;
  const s = App.s; const card = $('endCard');
  card.className = 'modal-in endcard';
  $('endIcon').textContent = '💀';
  $('endTitle').textContent = T('eliminated');
  $('endSub').textContent = s ? T('place', s.you.place || s.aliveCount + 1) : '';
  $('endStats').innerHTML = statBlock(s?.you);
  $('endWatch').hidden = false;
  $('modalEnd').hidden = false;
}
function showEnd() {
  const s = App.s; if (!s) return;
  const win = s.winnerId === s.you.id;
  const w = s.roster.find((p) => p.id === s.winnerId);
  const card = $('endCard');
  card.className = 'modal-in endcard' + (win ? ' win' : '');
  $('endIcon').textContent = win ? '👑' : '🏛️';
  $('endTitle').textContent = win ? T('winner') : (w ? w.name : '—');
  $('endSub').textContent = win ? '' : T('winner');
  $('endStats').innerHTML = statBlock(s.you);
  $('endWatch').hidden = true;
  $('modalEnd').hidden = false;
}
const statBlock = (y) => !y ? '' : `
  <div><b>${y.kills}</b>${T('kills')}</div>
  <div><b>${y.items.length}</b>${T('items')}</div>
  <div><b>${Math.max(0, y.hp)}</b>${T('hp')}</div>`;

/* ─────────────────────────────── GPS ─────────────────────────────── */
function startGeo() {
  if (App.geoOn || !navigator.geolocation) return;
  App.geoOn = true;
  navigator.geolocation.watchPosition(
    (p) => {
      App.geoErr = false;
      if (App.sim) return;
      App.pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
      sendPos();
    },
    () => { if (!App.geoErr) { App.geoErr = true; toast(T('geoDenied'), 'bad'); } },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
  );
}
function sendPos(force) {
  if (!App.pos) return;
  const now = Date.now();
  if (!force && now - App.posSent < 1500) return;
  App.posSent = now;
  Net.send({ t: 'pos', lat: App.pos.lat, lng: App.pos.lng });
}

/* lokalni tick: simulirano hodanje + tajmer runde */
let lastTick = Date.now();
function tickLocal() {
  const now = Date.now(), dt = (now - lastTick) / 1000; lastTick = now;

  if (App.sim && App.walk && App.walkTo && App.pos) {
    const d = dist(App.pos, App.walkTo);
    if (d < 1.5) App.walkTo = null;
    else {
      const step = 1.5 * dt, b = rad(brg(App.pos, App.walkTo));
      App.pos = {
        lat: App.pos.lat + (step * Math.cos(b) / R_E) * (180 / Math.PI),
        lng: App.pos.lng + (step * Math.sin(b) / (R_E * Math.cos(rad(App.pos.lat)))) * (180 / Math.PI),
      };
      sendPos();
      App.gmap && App.gmap.update(App.s, App.pos);
    }
  }
  if (App.sim && App.pos) sendPos();

  const c = App.s?.combat;
  if (c && !c.over) {
    const left = Math.max(0, c.endsAt - now);
    $('cbTimerFill').style.transform = `scaleX(${left / (App.s.cfg.roundSec * 1000)})`;
  }
  if (App.s?.phase === 'deploy') $('dcCount').textContent = mmss(Math.max(0, Math.ceil((App.s.countdown * 1000 - (now - (App.s.now || now))) / 1000)));
}

/* ───────────────────────── zvuk (bez fajlova, WebAudio) ───────────────────────── */
const Sfx = (() => {
  let ctx = null, ok = false;
  const ac = () => ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());
  function unlock() {
    try { const c = ac(); if (c.state === 'suspended') c.resume(); ok = true; } catch { }
  }
  function tone(f0, f1, dur, type = 'sine', gain = 0.25) {
    if (!ok) return;
    try {
      const c = ac(), o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), c.currentTime + dur);
      g.gain.setValueAtTime(gain, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur + 0.05);
    } catch { }
  }
  return {
    unlock,
    cannon() { tone(120, 28, 1.1, 'sawtooth', 0.45); tone(70, 20, 1.4, 'sine', 0.5); },
    gong() { tone(320, 140, 1.8, 'triangle', 0.3); tone(640, 300, 1.4, 'sine', 0.15); },
    ping() { tone(880, 1400, 0.16, 'sine', 0.2); },
    alarm() { tone(440, 660, 0.25, 'square', 0.18); },
  };
})();

/* ───────────────────────── ekran da ne zaspi ───────────────────────── */
let wakeLock = null;
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch { }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

/* ─────────────────────────────── sitnice ─────────────────────────────── */
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3600);
}
function flashOk() { try { navigator.vibrate && navigator.vibrate([20, 40, 20]); } catch { } }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function makeEmbers() {
  const box = document.querySelector('.embers');
  for (let i = 0; i < 26; i++) {
    const e = document.createElement('i');
    e.style.left = Math.random() * 100 + '%';
    e.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
    e.style.animationDuration = 7 + Math.random() * 9 + 's';
    e.style.animationDelay = -Math.random() * 12 + 's';
    box.appendChild(e);
  }
}
window.App = App;
