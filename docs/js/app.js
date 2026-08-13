/* ═══════════════════════════════════════════════════════════════════════════
   APP — pokretanje, rutiranje ekrana i akcije koje spajaju module.
   ═══════════════════════════════════════════════════════════════════════════ */
const App = (() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  // `/arena/test` i `?test=1` pale iste botove — ista aplikacija, samo flag (§1)
  const TEST = params.get('test') === '1' || /\/test\/?$/.test(location.pathname);
  let booted = false, camScreen = null;
  let MODE = 'player';                       // 'player' | 'mentor' | 'spectator'

  /* ───────────────── pokretanje ───────────────── */
  async function boot() {
    Theme.init();
    applyLang();
    UI.initHome(TEST);
    wireStatic();
    wireBack();
    registerSW();
    Nav.init();
    Screens.go('home');
    UI.maybeInstallModal();

    Store.on('nocfg', () => {
      Screens.go('home');
      toast(T('firebaseMissing'), 'danger', 'alert');
    });
    Store.on('error', (e) => toast(e.msg, 'danger', 'alert'));
    Store.on('offline', () => toast(T('connectionLost'), 'danger', 'wifiOff'));
    Store.on('room', () => { if (booted) route(); });
    Store.on('roomGone', () => { Store.leave(); goHome(); });

    const ok = await Store.connect();
    if (!ok) return;

    Geo.on(() => { /* pozicije obrađuje motor */ });
    Geo.start();
    Compass.start();

    const room = params.get('room');
    if (room) $('#codeInput').value = room.toUpperCase();

    // Mentorski link je ličan: ?room=KOD&mentor=PID (§17)
    const mentorPid = params.get('mentor');
    if (room && mentorPid) {
      const okw = await Store.watchRoom(room);
      if (okw) {
        MODE = await Mentor.claim(mentorPid);
        toast(MODE === 'mentor' ? T('mentorWelcome') : T('mentorTaken'), MODE === 'mentor' ? 'good' : 'gold', 'users');
        booted = true; Engine.start(); route();
        return;
      }
    }

    // Povratak u sobu se NE dešava sam — pitamo (§ traženo posle testiranja)
    if (Store.sess.code && Store.sess.pid) {
      const want = await askRejoin(Store.sess.code);
      if (want) {
        const okr = await Store.rejoin(Store.sess.code, Store.sess.pid);
        if (okr) { booted = true; Engine.start(); route(); return; }
        toast(T('roomNotFound'), 'danger');
      }
      Store.sess.clear();          // "Ne" briše sesiju, pa se više ne pita
    }
    booted = true;
    Screens.go('home');
  }

  /** Pitanje na ulasku: da li se vraćaš u sobu u kojoj si već bio? */
  function askRejoin(code) {
    return new Promise((res) => {
      const m = modal(`
        <div class="center stack-lg">
          <div class="goldc">${icon('refresh', { size: 48 })}</div>
          <h2>${esc(T('rejoinTitle'))}</h2>
          <p class="dim">${esc(T('rejoinBody'))} <b class="goldc">${esc(code)}</b></p>
          <button class="btn primary lg full" id="rjYes">${esc(T('rejoinYes'))}</button>
          <button class="btn ghost full" id="rjNo">${esc(T('rejoinNo'))}</button>
        </div>`, { dismissible: false });
      $('#rjYes', m).onclick = () => { m.close(); res(true); };
      $('#rjNo', m).onclick = () => { m.close(); res(false); };
    });
  }

  /** Nazad na početak, ali bez gubljenja `test`/`emu` — inače te izlazak iz
      sobe u test režimu izbaci iz test režima. */
  function goHome() {
    const keep = new URLSearchParams();
    for (const k of ['test', 'emu']) if (params.get(k)) keep.set(k, params.get(k));
    const q = keep.toString();
    location.href = location.pathname + (q ? '?' + q : '');
  }

  /** Izlazak iz sobe iz bilo kog ekrana pre početka igre. */
  async function leaveRoom() {
    if (!(await confirmBox(T('leaveConfirm'), T('leaveRoom'), true))) return;
    await Store.leave(true);
    goHome();
  }

  function wireStatic() {
    $('#btnQr').innerHTML = icon('qr', { size: 22 });
    $('#btnShare').innerHTML = icon('share', { size: 22 });
    $('#btnCreate').onclick = () => create();
    $('#btnJoin').onclick = () => join();
    $('#btnAvatar').onclick = () => UI.avatarBuilder();
    $('#btnLang').onclick = () => { toggleLang(); location.reload(); };
    $('#btnTheme').onclick = () => { Theme.toggle(); location.reload(); };
    $('#codeInput').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });
    $('#btnQr').onclick = () => UI.showQr();
    $('#btnShare').onclick = () => UI.shareLink();
    $('#btnInv').onclick = () => UI.inventorySheet();
    $('#btnFeed').onclick = () => UI.feedSheet();
    $('#btnMenu').onclick = () => UI.menuSheet();
    $('#btnCamera').onclick = () => openEncounter();
    ['pointerdown', 'keydown'].forEach((e) => document.addEventListener(e, () => Sfx.unlock(), { once: true }));
    window.addEventListener('beforeunload', (e) => {
      const s = Store.state();
      if (s === 'LIVE' || s === 'FINAL_TWO') { e.preventDefault(); e.returnValue = T('leaveWarning'); }
    });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/arena/sw.js', { scope: '/arena/', updateViaCache: 'none' })
      .then((reg) => reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) sw.postMessage('SKIP_WAITING');
        });
      }))
      .catch(() => {});
  }

  const myName = () => {
    const v = ($('#nameInput').value || '').trim().slice(0, 16) || 'Tribut';
    localStorage.setItem('arena.name', v);
    return v;
  };

  async function create() {
    if (!Store.ready) return toast(T('firebaseMissing'), 'danger');
    const ok = await Store.createRoom(myName(), UI.avatar, { bots: TEST, botCount: 5 });
    if (ok) { Engine.start(); UI.prepStep = 0; route(); if (TEST) await Bots.seed(5); }
  }
  async function join() {
    if (!Store.ready) return toast(T('firebaseMissing'), 'danger');
    const c = ($('#codeInput').value || '').toUpperCase().trim();
    if (c.length < 4) return toast(T('enterCode'), 'danger');
    const ok = await Store.joinRoom(c, myName(), UI.avatar);
    if (ok) { Engine.start(); UI.prepStep = 0; route(); }
  }

  /* ───────────────── dugme "nazad" ───────────────── */
  function wireBack() {
    $('#btnPrepBack').innerHTML = icon('chevronLeft', { size: 22 });
    $('#btnGhostBack').innerHTML = icon('chevronLeft', { size: 22 });
    $('#btnPrepBack').onclick = () => Nav.back();
    $('#btnGhostBack').onclick = () => Nav.back();

    // Iz pripreme se ide korak unazad; sa prvog koraka — napolje iz sobe.
    Nav.on('prep', () => {
      if (UI.prepStep > 0) { UI.prepStep = UI.prepStep - 1; UI.renderPrep(); }
      else leaveRoom();
    });
    Nav.on('lobby', () => leaveRoom());
    Nav.on('ghost', () => Screens.go('game'));
    Nav.on('mentor', () => { /* mentor nema gde nazad */ });
    Nav.on('end', () => { });
    // Iz žive partije se ne izlazi slučajnim pritiskom
    const block = () => toast(T('cantGoBackInGame'), 'gold', 'menu');
    ['game', 'fight', 'chase', 'deploy'].forEach((s) => Nav.on(s, () => {
      if (s === 'fight' && UI.spectateFid) { UI.spectateFid = null; Screens.go(Store.me() ? 'ghost' : 'mentor'); return; }
      block();
    }));
  }

  /* ───────────────── rutiranje ───────────────── */
  function route() {
    if (MODE === 'mentor' || MODE === 'spectator') {
      if (UI.spectateFid && Store.fights()[UI.spectateFid]) { Screens.go('fight'); return; }
      Screens.go('mentor');
      return;
    }
    if (!Store.room) { Screens.go('home'); return; }
    const me = Store.me();
    if (!me) { Screens.go('home'); return; }
    const s = Store.state();

    // duh gleda tuđu borbu
    if (UI.spectateFid) {
      const sf = Store.fights()[UI.spectateFid];
      if (sf && sf.state === 'live') { Screens.go('fight'); return; }
      UI.spectateFid = null;
    }

    if (s === 'LOBBY') {
      const done = me.perms && me.perms.location && me.perms.camera && me.hasFace;
      if (!done) { Screens.go('prep'); UI.renderPrep(); }
      else { Screens.go('lobby'); UI.renderLobby(); }
      return;
    }
    if (s === 'PREP') { Screens.go('deploy'); return; }
    if (s === 'END') { Screens.go('end'); UI.renderEnd(); return; }

    if (me.fightId && Store.fights()[me.fightId] && Store.fights()[me.fightId].state === 'live') { Screens.go('fight'); return; }
    if (me.chaseId && Store.chases()[me.chaseId]) { Screens.go('chase'); return; }
    if (Screens.cur === 'ghost' || Screens.cur === 'sky' || Screens.cur === 'mentor') return;
    Screens.go('game');
  }

  /* ───────────────── dozvole (§3) ───────────────── */
  async function requestPerm(kind) {
    if (kind === 'location') {
      try {
        await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 }));
        Geo.start();
        await Store.updateMe({ 'perms/location': true });
      } catch { toast(T('denied'), 'danger'); }
    } else if (kind === 'camera') {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        s.getTracks().forEach((t) => t.stop());
        await Store.updateMe({ 'perms/camera': true });
        Encounter.loadDetector();
      } catch { toast(T('denied'), 'danger'); }
    } else if (kind === 'compass') {
      const ok = await Compass.request();
      await Store.updateMe({ 'perms/compass': !!ok });
      if (!ok) toast(T('denied'), 'danger');
    } else if (kind === 'notif') {
      try { const r = await Notification.requestPermission(); await Store.updateMe({ 'perms/notif': r === 'granted' }); } catch {}
    }
    UI.renderPrep();
  }

  /* ───────────────── start igre (host) ───────────────── */
  async function startGame() {
    const cfg = Store.config(), P = Store.players();
    const ids = Object.keys(P);
    if (ids.length < R.MIN_PLAYERS) return toast(T('needPlayers'), 'danger');
    if (!cfg.center) return toast(T('needCenter'), 'danger');
    const seed = Store.room.seed || 'seed';

    const classes = R.dealClasses(seed, ids);
    const starts = R.startPoints(seed, cfg, ids);
    const items = R.generateItems(seed, cfg, ids.length);
    const archers = Object.values(classes).filter((c) => c === 'archer').length;
    const arrows = R.generateArrowCaches(seed, cfg, archers);

    const itemMap = {};
    [...items, ...arrows].forEach((it) => {
      itemMap[it.id] = { type: it.type, rarity: it.rarity, lat: it.lat, lng: it.lng, spawnedAtMs: Clock.now() };
    });
    const pUpd = {};
    for (const id of ids) {
      const cls = R.CLASSES[classes[id]];
      pUpd[`${id}/classId`] = classes[id];
      pUpd[`${id}/maxHp`] = cls.maxHp;
      pUpd[`${id}/hp`] = cls.maxHp;
      pUpd[`${id}/startPos`] = starts[id];
      pUpd[`${id}/arrived`] = !!P[id].isBot;
      pUpd[`${id}/lastTickMs`] = Clock.now();
    }
    await Store.hostSet('items', itemMap);
    await Store.hostUpdate('players', pUpd);
    await Store.hostUpdate('meta', {
      state: 'PREP',
      prepEndsAtMs: Clock.now() + (cfg.prepMinutes || 10) * 60000,
      census: R.classCensus(classes),
      countdownAtMs: null,
    });
    await Store.pushFeed({ type: 'prep', scope: 'all' });
  }

  async function playAgain() {
    const P = Store.players();
    const upd = {};
    for (const id of Object.keys(P)) {
      upd[`${id}/alive`] = true; upd[`${id}/hp`] = 100; upd[`${id}/maxHp`] = 100;
      upd[`${id}/hunger`] = 100; upd[`${id}/thirst`] = 100;
      upd[`${id}/inv`] = null; upd[`${id}/weapon`] = 'fists'; upd[`${id}/arrows`] = 0;
      upd[`${id}/kills`] = 0; upd[`${id}/fights`] = 0; upd[`${id}/itemsTaken`] = 0;
      upd[`${id}/distanceWalkedM`] = 0; upd[`${id}/deathAtMs`] = null; upd[`${id}/killedBy`] = null;
      upd[`${id}/classId`] = null; upd[`${id}/startPos`] = null; upd[`${id}/arrived`] = false;
      upd[`${id}/allianceId`] = null; upd[`${id}/fightId`] = null; upd[`${id}/chaseId`] = null;
      upd[`${id}/effects`] = null; upd[`${id}/capacity`] = R.BASE_SLOTS;
    }
    await Store.hostUpdate('players', upd);
    await Store.hostSet('items', null);
    await Store.hostSet('traps', null);
    await Store.hostSet('fights', null);
    await Store.hostSet('chase', null);
    await Store.hostSet('feed', null);
    await Store.hostSet('schedule', null);
    await Store.hostUpdate('meta', { state: 'LOBBY', startedAtMs: null, endedAtMs: null, winnerId: null, skyAtMs: null });
    Engine.resetSeen();
  }

  /* ───────────────── kupljenje predmeta ───────────────── */
  let picking = false;
  async function tryPickup(item) {
    if (picking) return;
    const d = Engine.d;
    if (!Items.pickupAllowed(d)) { toast(T('noPickupYet'), 'gold'); return; }
    if (!item.inReach) { toast(T('tooFarItem'), 'gold'); return; }
    picking = true;
    try {
      const ok = await Items.runPickup(item);
      if (ok) await Items.take(item);
    } finally { picking = false; }
  }

  /* ───────────────── slikanje protivnika (§7) ───────────────── */
  function openEncounter() {
    const d = Engine.d;
    if (!d.me || d.me.alive === false) { Screens.go('ghost'); UI.renderGhost(d); return; }
    if (d.state !== 'LIVE' && d.state !== 'FINAL_TWO') return;

    const s = sheet(null, `
      <div class="stack">
        <div class="row between"><h2>${esc(T('photoTitle'))}</h2>
          <div class="chip" id="encZoom">1×</div></div>
        <div class="cam-wrap"><video id="encVid" playsinline muted></video>
          <div class="face-oval" style="background:none"></div></div>
        <canvas id="encCan" hidden></canvas>
        <div class="row-tight wrap" id="encStatus"></div>
        <p class="tiny dim center" id="encHint">${esc(T('photoHint'))}</p>
        <input type="range" min="1" max="3" step="0.5" value="1" id="encZoomRange">
        <button class="action-btn" id="encShoot">${icon('camera', { size: 26 })}<span>${esc(T('photoShoot'))}</span></button>
        <div id="encList" class="stack"></div>
      </div>`, { onClose: () => { Encounter.stop(); clearInterval(statusTimer); } });
    camScreen = s;
    Encounter.openCamera($('#encVid', s), 'environment').catch(() => { toast(T('denied'), 'danger'); s.close(); });
    Encounter.loadDetector();

    // Živi prikaz stanja senzora — bez ovoga ne znaš da li je filter aktivan
    // ili se tiho preskače, pa ne možeš da protumačiš rezultat.
    const statusTimer = setInterval(drawStatus, 700);
    drawStatus();
    function drawStatus() {
      const box = $('#encStatus', s);
      if (!box) return;
      const st = Encounter.detectorState;
      const det = st === 'ready' ? ['good', T('detReady')]
        : st === 'loading' ? ['gold', T('detLoading')]
        : st === 'failed' ? ['danger', T('detOff')] : ['', T('detLoading')];
      const h = Compass.heading;
      const comp = h == null ? ['danger', T('detNoCompass')]
        : Compass.absolute ? ['good', `${Math.round(h)}° ±${Math.round(Compass.accuracy || 0)}°`]
          : ['gold', `${Math.round(h)}° ${T('detRelative')}`];
      const acc = Geo.accuracy;
      const gps = acc == null ? ['danger', 'GPS —']
        : acc <= 20 ? ['good', `GPS ±${Math.round(acc)} m`] : ['gold', `GPS ±${Math.round(acc)} m`];
      const n = Encounter.candidatesInCone(Engine.d).list.length;
      box.innerHTML = [det, comp, gps, ['', `${icon('users', { size: 13 })}${n}`]]
        .map(([c, t]) => `<span class="chip ${c}">${t}</span>`).join('');
    }
    $('#encZoomRange', s).oninput = (e) => {
      const z = Encounter.setZoom(+e.target.value);
      $('#encZoom', s).textContent = z + '×';
    };
    $('#encShoot', s).onclick = async () => {
      const res = await Encounter.shoot(Engine.d, $('#encCan', s));
      if (!res.ok) {
        const msg = res.reason === 'cooldown' ? `${T('photoCooldown')} ${res.waitS}s`
          : res.reason === 'noperson' ? T('photoNoPerson') : T('photoNoneInCone');
        toast(msg, 'danger', 'alert');
        Haptics.fire('alert');
        return;
      }
      Haptics.fire('tap');
      renderCandidates(s, res.candidates);
    };
  }

  function renderCandidates(s, list) {
    const d = Engine.d;
    $('#encList', s).innerHTML = `<div class="card-title">${esc(T('photoCandidates'))}</div>` +
      list.map((c, i) => `<button class="cand ${i === 0 ? 'best' : ''}" data-pid="${c.pid}">
        <div class="avatar" style="width:52px;height:52px">${avatarSvg(c.p.avatar, 52)}</div>
        <div class="grow"><div class="name">${esc(c.p.name)}</div>
          <div class="meta">${fmtDist(c.distM)} · ${Math.round(c.angleDiff)}°${i === 0 ? ' · ' + esc(T('photoBest')) : ''}</div></div>
        ${icon('chevronRight', { size: 20 })}</button>`).join('');
    $$('#encList .cand', s).forEach((b) => b.onclick = () => {
      const pid = b.dataset.pid;
      const c = list.find((x) => x.pid === pid);
      s.close();
      actionsFor(c);
    });
  }

  function actionsFor(c) {
    const d = Engine.d, me = d.me;
    const ally = c.p.allianceId && c.p.allianceId === me.allianceId;
    const canBetray = ally && c.distM < 12;
    const archer = me.classId === 'archer' && me.weapon === 'bow';
    const rangedWhy = archer ? Encounter.rangedBlocked(d, c.p) : 'class';

    const m = modal(`
      <div class="center stack">
        <div class="avatar ring" style="width:88px;height:88px;margin:0 auto">${avatarSvg(c.p.avatar, 88)}</div>
        <h2>${esc(c.p.name)}</h2>
        <div class="chip">${fmtDist(c.distM)}</div>
        <div class="stack" style="width:100%;margin-top:var(--s4)">
          ${!ally ? `<button class="btn good lg full" id="aAlly">${icon('handshake', { size: 22 })}<span>${esc(T('actAlliance'))}</span></button>` : ''}
          ${canBetray ? `<button class="btn danger lg full" id="aBetray">${icon('knife', { size: 22 })}<span>${esc(T('actBetray'))}</span></button>` : ''}
          ${!ally ? `<button class="btn danger lg full" id="aFight">${icon('swords', { size: 22 })}<span>${esc(T('actFight'))}</span></button>` : ''}
          ${archer && !rangedWhy && c.distM <= R.RANGED_MAX_M ? `<button class="btn gold lg full" id="aShoot">${icon('bow', { size: 22 })}<span>${esc(T('aimTitle'))}</span></button>` : ''}
          <button class="btn ghost full" id="aClose">${esc(T('close'))}</button>
        </div>
      </div>`);
    $('#aClose', m).onclick = () => m.close();
    const ab = $('#aAlly', m); if (ab) ab.onclick = async () => { m.close(); await Encounter.proposeAlliance(c.pid); };
    const fb = $('#aFight', m); if (fb) fb.onclick = async () => { m.close(); await Encounter.startFight(c.pid, c.distM, false); route(); };
    const bb = $('#aBetray', m); if (bb) bb.onclick = async () => { m.close(); await Encounter.startFight(c.pid, c.distM, true); route(); };
    const sb = $('#aShoot', m); if (sb) sb.onclick = () => { m.close(); aimAt(c); };
  }

  /* — nišanjenje strelca — */
  function aimAt(c) {
    const m = modal(`
      <div class="center stack-lg">
        <h2>${esc(T('aimTitle'))}</h2>
        <div class="aim-wrap"><div class="aim-ring" id="aimRing">
          ${ring(0, 220)}<div class="display" id="aimN" style="font-size:var(--fs-2xl)">8</div></div></div>
        <p class="dangerc" style="font-weight:800">${esc(T('aimHold'))}</p>
        <button class="btn ghost full" id="aimCancel">${esc(T('cancel'))}</button>
      </div>`, { dismissible: false });
    let cancelled = false;
    $('#aimCancel', m).onclick = () => { cancelled = true; m.close(); };
    Encounter.fireRanged(c.pid, (p) => {
      if (cancelled) return;
      setRing($('#aimRing svg', m), p);
      $('#aimN', m).textContent = Math.max(0, Math.ceil(8 - p * 8));
    }).then((res) => {
      if (cancelled) return;
      m.close();
      if (res.hit) { toast(T('shotHit'), 'good', 'bow'); Haptics.fire('hit'); Sfx.zap(); }
      else toast(T('aimMissed'), 'danger', 'alert');
    });
  }

  /* ───────────────── tvorci igara ───────────────── */
  async function buyEvent(type) {
    const cost = R.SPARK_COSTS[type];
    const P = Store.players();
    const ghosts = Object.entries(P).filter(([, p]) => p.alive === false && !p.isBot).length;
    if (ghosts > 2) {
      await Store.voteEvent(type);
      const votes = Object.keys((Store.room.gmVotes || {})[type] || {}).length;
      if (votes < Math.ceil(ghosts / 2)) { toast(T('voteNeeded'), 'gold'); return; }
    }
    const ok = await Store.spendSparks(cost);
    if (!ok) { toast(T('sparks'), 'danger'); return; }
    await Store.clearVotes(type);
    const cfg = Store.config(), now = Clock.now();
    const meta2 = R.EVENTS[type];
    const ev = { id: U.uid('ge'), type, atMs: now + 15000, warnMs: 15000, endMs: now + 15000 + meta2.durMs };
    if (type === 'firewall') {
      const head = Math.random() * 360;
      const start = U.destPoint(cfg.center, (head + 180) % 360, cfg.diameterM * 0.575);
      Object.assign(ev, { headingDeg: head, lat: start.lat, lng: start.lng, radiusM: meta2.widthM, travelM: cfg.diameterM * 1.15 });
    } else if (type === 'wasps') {
      const p = U.pointInCircle(Math.random, cfg.center, cfg.diameterM * 0.35);
      Object.assign(ev, { lat: p.lat, lng: p.lng, radiusM: meta2.radiusM });
    }
    await Store.ref(`liveEvents/${ev.id}`).set(ev);
    await Store.ref('meta/lastGmEventMs').set(now);
    await Store.pushFeed({ type: 'event', eventType: type, scope: 'all' });
    toast(eventName(type), 'gold', EVENT_ICON[type]);
  }

  /* ───────────────── petlja prikaza ───────────────── */
  Engine.on(async (kind, d) => {
    if (kind === 'tick') {
      await Combat.tick(d);
      await Chase.tick(d);
      await Items.checkTraps(d);
      handleOffers(d);
      route();
      const s = Screens.cur;
      if (s === 'deploy') UI.renderDeploy(d);
      else if (s === 'game') UI.renderGame(d);
      else if (s === 'fight') {
        if (UI.spectateFid) { const sf = Store.fights()[UI.spectateFid]; if (sf) UI.renderFight(d, { fid: UI.spectateFid, ...sf }, true); }
        else { const f = Combat.myFight(); if (f) UI.renderFight(d, f); }
      }
      else if (s === 'chase') UI.renderChase(d);
      else if (s === 'ghost') UI.renderGhost(d);
      else if (s === 'mentor') UI.renderMentor(d);
      else if (s === 'lobby') { /* lobi se osvežava na promenu sobe */ }
      // §16 — obavezno wake lock dok igra traje
      if (d.state === 'LIVE' || d.state === 'FINAL_TWO' || d.state === 'PREP') {
        Wake.on();
        // Model za detekciju osoba se povlači ~20 s. Ako bismo čekali prvo
        // otvaranje kamere, prvi susret bi prošao bez tog filtera — zato ga
        // vučemo unapred, čim krene priprema.
        if (Encounter.detectorState === 'idle') Encounter.loadDetector();
      }
    }
    if (kind === 'sky') UI.showSky(d.atMs);
    if (kind === 'died') { toast(T('youDied'), 'danger', 'skull'); Haptics.fire('death'); }
    if (kind === 'zoneWarn') toast(T('zoneWarn') + ' 30 s', 'danger', 'alert');
    if (kind === 'eventWarn') toast(eventName(d.type), 'gold', EVENT_ICON[d.type] || 'spark');
    if (kind === 'cannon') {
      const flash = $('#zoneFlash');
      if (flash) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
    }
  });

  /* — ponude saveza i dolazeći hitac — */
  let offerShown = null, shotShown = null, pkgShown = null;
  function handleOffers(d) {
    const me = d.me;
    if (!me) return;
    if (me.allyOffer && offerShown !== me.allyOffer.from) {
      offerShown = me.allyOffer.from;
      const from = Store.players()[me.allyOffer.from];
      const m = modal(`
        <div class="center stack">
          <div class="avatar" style="width:80px;height:80px;margin:0 auto">${avatarSvg(from.avatar, 80)}</div>
          <h2>${esc(from.name)}</h2><p class="dim">${esc(T('allianceOffer'))}</p>
          <button class="btn good lg full" id="oYes">${esc(T('yes'))}</button>
          <button class="btn ghost full" id="oNo">${esc(T('no'))}</button>
        </div>`, { dismissible: false });
      $('#oYes', m).onclick = async () => { m.close(); await Encounter.respondAlliance(me.allyOffer.from, true); };
      $('#oNo', m).onclick = async () => { m.close(); await Encounter.respondAlliance(me.allyOffer.from, false); };
      setTimeout(() => { try { m.close(); } catch {} }, 25000);
    }
    if (!me.allyOffer) offerShown = null;

    // paket od mentora — samo tebi piše ko ga je poslao (§17, §20)
    if (me.incomingPackage && pkgShown !== me.incomingPackage.atMs) {
      pkgShown = me.incomingPackage.atMs;
      toast(`${T('yourPackage')}: ${itemName(me.incomingPackage.type)} — ${T('packageLanded')}`, 'gold', 'gift');
      Haptics.fire('pickup'); Sfx.pickup();
      Store.setMe('incomingPackage', null);
    }

    if (me.incomingShot && shotShown !== me.incomingShot.atMs) {
      shotShown = me.incomingShot.atMs;
      const dir = compassName(me.incomingShot.bearing);
      toast(`${T('incomingShot')} ${dir} — ${T('incomingMove')}`, 'danger', 'alert');
      Haptics.fire('incoming'); Sfx.warn();
    }
  }
  function compassName(b) {
    const C = LANG === 'en' ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] : ['sever', 'severoistok', 'istok', 'jugoistok', 'jug', 'jugozapad', 'zapad', 'severozapad'];
    return C[Math.round((b || 0) / 45) % 8];
  }

  return {
    boot, route, requestPerm, startGame, playAgain, tryPickup, openEncounter, buyEvent, leaveRoom, goHome,
    get TEST() { return TEST; }, get MODE() { return MODE; },
  };
})();

window.addEventListener('DOMContentLoaded', () => App.boot());
