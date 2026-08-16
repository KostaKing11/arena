/* ═══════════════════════════════════════════════════════════════════════════
   APP — pokretanje, rutiranje ekrana i akcije koje spajaju module.
   ═══════════════════════════════════════════════════════════════════════════ */
const App = (() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  // `/arena/test` i `?test=1` pale iste botove — ista aplikacija, samo flag (§1)
  const TEST = params.get('test') === '1' || /\/test\/?$/.test(location.pathname);
  let booted = false;
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
    // Ponuda za instalaciju tek kad korisnik vidi ekran — ranije je iskakala
    // istovremeno sa sistemskim pitanjem za lokaciju, pa su se preklapale.
    setTimeout(() => UI.maybeInstallModal(), 1200);

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

    // GPS i kompas se NE pale sami na startu — inače telefon pita za lokaciju
    // pre nego što je korisnik uopšte išta uradio. Pale se u onboarding-u.
    const p = UI.permState();
    if (p.location) Geo.start();
    if (p.compass) Compass.start();

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

    /* Povratak mentora bez linka: mentor nema svoj `players` čvor, pa bi mu
       zatvaranje taba oduzelo mesto zauvek. Sesija se pamti lokalno. */
    const ms = Mentor.session();
    if (!room && ms && ms.room && ms.pid) {
      const okw = await Store.watchRoom(ms.room);
      if (okw) {
        MODE = await Mentor.claim(ms.pid);
        booted = true; Engine.start(); route();
        return;
      }
      Mentor.clearSession();          // soba više ne postoji
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
    UI.resetLobby();
    await Store.leave(true);
    goHome();
  }

  function wireStatic() {
    const ib = (sel, name, fn) => { const n = $(sel); if (!n) return; n.innerHTML = icon(name, { size: 22 }); if (fn) n.onclick = fn; };
    ib('#btnQr', 'qr', () => UI.showQr());
    ib('#btnShare', 'share', () => UI.shareLink());
    ib('#btnSetBack', 'chevronLeft', () => Nav.back());
    ib('#btnLobbyBack', 'chevronLeft', () => Nav.back());
    ib('#btnPrepBack', 'chevronLeft', () => Nav.back());
    ib('#btnGhostBack', 'chevronLeft', () => Nav.back());
    ib('#btnSettingsHome', 'settings', () => openSettings());

    $('#btnCreate').onclick = () => create();
    $('#btnJoin').onclick = () => join();
    $('#btnAvatar').onclick = () => UI.avatarBuilder();
    $('#btnQuickTest').onclick = () => askBotCount();
    $('#codeInput').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });

    /* Ista dugmad, dva zanimanja: živ ima torbu i saveznike, mrtav iskre i
       spisak igrača u duhovskom ekranu. */
    const dead = () => { const m = Store.me(); return !!(m && m.alive === false); };
    $('#btnInv').onclick = () => (dead() ? UI.sparksSheet(Engine.d) : UI.inventorySheet());
    $('#btnFeed').onclick = () => UI.feedSheet();
    $('#btnPlayers').onclick = () => {
      if (dead()) { UI.openGhost('players'); return; }
      UI.alliesSheet(Engine.d);
    };
    /* Gornje dugme vraća pogled na tebe, donje otvara pregled cele arene.
       Mapa je tu i živom i mrtvom — samo mrtvi na njoj vide sve. */
    $('#btnGhost').onclick = () => UI.arenaMapSheet(Engine.d);
    $('#btnMenu').onclick = () => openSettings();
    $('#btnRecenter').onclick = () => { if (UI.gmap) { UI.gmap.recenter(); Haptics.fire('tap'); } };
    // mrtav ne napada: na mestu kamere mu stoji ulaz među duhove
    $('#btnCamera').onclick = () => (dead() ? UI.openGhost('events') : UI.openAim());

    ['pointerdown', 'keydown'].forEach((e) => document.addEventListener(e, () => { Sfx.unlock(); goFullscreen(); }, { once: true }));
    // Zumiranje prstima gasi doživljaj i pomera HUD — igra je fiksnog razmera.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
    window.addEventListener('beforeunload', (e) => {
      const s = Store.state();
      if (s === 'LIVE' || s === 'FINAL_TWO') { e.preventDefault(); e.returnValue = T('leaveWarning'); }
    });
  }

  /** Pun ekran — bez statusne trake i navigacionih dugmadi. */
  function goFullscreen() {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    } catch {}
  }

  let settingsFrom = 'home';
  /* U lobiju i na kraju partije ovo su prava podešavanja. U toku igre je to
     izlaz u nuždi, pa ide kratak sheet sa tri stavke — pun ekran je u njemu
     jedan red niže. */
  function openSettings() {
    const s = Store.state();
    if (Store.room && s !== 'LOBBY' && s !== 'END') { UI.gameMenuSheet(); return; }
    openFullSettings();
  }
  function openFullSettings() {
    settingsFrom = Screens.cur === 'settings' ? settingsFrom : Screens.cur;
    Screens.go('settings');
    UI.renderSettings();
  }

  /** "Proveri dozvole" iz podešavanja — traži samo ono što fali. */
  async function checkPerms() {
    for (const k of ['location', 'camera', 'compass']) {
      if (!UI.permState()[k]) await requestPerm(k);
    }
    const p = UI.permState();
    if (p.location) Geo.start();
    if (p.compass) Compass.start();
    toast(p.location && p.camera ? T('permsAllGood') : T('denied'), p.location && p.camera ? 'good' : 'danger',
      p.location && p.camera ? 'check' : 'alert');
    UI.renderSettings();
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

  /** Slika lica se pravi jednom po telefonu i šalje se pri ulasku u sobu. */
  async function uploadFace() {
    const data = localStorage.getItem(UI.FACE_KEY);
    if (data) { try { await Store.saveFace(data); } catch {} }
    const p = UI.permState();
    await Store.updateMe({ perms: { location: p.location, camera: p.camera, compass: p.compass } });
  }

  async function create() {
    if (!Store.ready) return toast(T('firebaseMissing'), 'danger');
    await ensureReadyToPlay();
    const ok = await Store.createRoom(myName(), UI.avatar, { bots: TEST, botCount: 5 });
    if (ok) { await uploadFace(); Engine.start(); UI.prepStep = 0; route(); if (TEST) await Bots.seed(5); }
  }
  async function join() {
    if (!Store.ready) return toast(T('firebaseMissing'), 'danger');
    const c = ($('#codeInput').value || '').toUpperCase().trim();
    if (c.length < 4) return toast(T('enterCode'), 'danger');
    await ensureReadyToPlay();
    const ok = await Store.joinRoom(c, myName(), UI.avatar);
    if (ok) { await uploadFace(); Engine.start(); UI.prepStep = 0; route(); }
  }

  /* ───────────────── test sa botovima, jednim tapom ─────────────────
     Ranije je trebalo proći kroz sve isto što i prava partija, pa se do
     botova nije ni stizalo. Sada ovo napravi arenu oko tebe, doda botove
     i odmah pokrene igru. */
  async function quickTest(nBots) {
    if (!Store.ready) return toast(T('firebaseMissing'), 'danger');
    await ensureReadyToPlay();
    toast(T('testStarting'), 'gold', 'settings');
    const ok = await Store.createRoom(myName() || 'TEST', UI.avatar, { bots: true, botCount: nBots });
    if (!ok) return;
    await uploadFace();
    Engine.start();
    // sačekaj prvo GPS očitavanje, pa arenu postavi tu gde stojiš
    const pos = Geo.pos || await new Promise((res) => {
      const t = setTimeout(() => res(null), 6000);
      Geo.on((p) => { if (p) { clearTimeout(t); res(p); } });
    });
    const center = pos ? { lat: pos.lat, lng: pos.lng } : { lat: 44.8125, lng: 20.4612 };
    await Store.hostUpdate('config', {
      center, diameterM: 300, durationMin: 20, prepMinutes: 1,
      itemDensity: 1, startMode: 'cornucopia', eventsEnabled: true,
    });
    await Bots.seed(nBots);
    await Store.updateMe({ ready: true, arrived: true });
    await new Promise((r) => setTimeout(r, 900));
    await startGame();
    // preskoči odbrojavanje pripreme — u testu se ne šeta do startne tačke
    await Store.hostUpdate('meta', { countdownAtMs: Clock.now() + 3000 });
    toast(T('testReady'), 'good', 'check');
    route();
  }

  /* ───────────────── dugme "nazad" ───────────────── */
  function wireBack() {
    Nav.on('settings', () => { Screens.go(settingsFrom || 'home'); if (settingsFrom === 'lobby') UI.renderLobby(); });
    // Iz pripreme se ide korak unazad; sa prvog koraka — napolje iz sobe.
    Nav.on('prep', () => {
      if (UI.prepStep > 0) { UI.prepStep = UI.prepStep - 1; UI.renderPrep(); }
      else leaveRoom();
    });
    Nav.on('lobby', () => leaveRoom());
    Nav.on('ghost', () => Screens.go('game'));
    Nav.on('watch', () => UI.closeWatch());
    Nav.on('mentor', () => { /* mentor nema gde nazad */ });
    Nav.on('end', () => { });
    // Iz žive partije se ne izlazi slučajnim pritiskom
    const block = () => toast(T('cantGoBackInGame'), 'gold', 'menu');
    ['game', 'deploy'].forEach((s) => Nav.on(s, () => block()));
    // sa nisanjenja se izlazi normalno — to nije stanje iz kog se ne moze nazad
    Nav.on('aim', () => UI.closeAim());
  }

  function askBotCount() {
    const m = modal(`
      <div class="stack-lg center">
        <div class="goldc">${icon('settings', { size: 44 })}</div>
        <h2>${esc(T('testWithBots'))}</h2>
        <p class="dim">${esc(T('botsCount'))}</p>
        <div class="row">
          ${[2, 5, 9].map((n) => `<button class="btn lg grow" data-n="${n}">${n}</button>`).join('')}
        </div>
        <button class="btn ghost full" id="qtNo">${esc(T('cancel'))}</button>
      </div>`);
    $('#qtNo', m).onclick = () => m.close();
    $$('[data-n]', m).forEach((b) => b.onclick = () => { m.close(); quickTest(+b.dataset.n); });
  }

  /* ───────────────── rutiranje ───────────────── */
  function route() {
    if (MODE === 'mentor' || MODE === 'spectator') { Screens.go('mentor'); return; }
    if (!Store.room) { Screens.go('home'); return; }
    const me = Store.me();
    if (!me) { Screens.go('home'); return; }
    const s = Store.state();

    if (s === 'LOBBY') {
      // Dozvole i slika su odrađene pre ulaska; ovde ostaje samo živa provera
      // kompasa i GPS-a, i to se traži jednom po sobi.
      if (!me.ready) { Screens.go('prep'); UI.renderPrep(); }
      else { Screens.go('lobby'); UI.renderLobby(); }
      return;
    }
    if (s === 'PREP') { Screens.go('deploy'); return; }
    if (Screens.cur === 'settings') return;                  // podešavanja se ne prekidaju
    if (s === 'END') { Screens.go('end'); UI.renderEnd(); return; }

    // nisanjenje je ekran koji se otvara namerno i sam se zatvara
    if (Screens.cur === 'aim' || Screens.cur === 'ghost' || Screens.cur === 'watch'
        || Screens.cur === 'mentor') return;
    Screens.go('game');
  }

  /* ───────────────── dozvole (§3) ─────────────────
     Traže se JEDNOM po telefonu, pre ulaska u sobu, i pamte se lokalno. */
  function savePerm(kind, ok) {
    const p = JSON.parse(localStorage.getItem('arena.perms') || '{}');
    p[kind] = !!ok;
    localStorage.setItem('arena.perms', JSON.stringify(p));
    if (Store.me()) Store.updateMe({ ['perms/' + kind]: !!ok });
  }
  async function requestPerm(kind) {
    if (kind === 'location') {
      try {
        await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 20000 }));
        Geo.start();
        savePerm('location', true);
      } catch { savePerm('location', false); toast(T('denied'), 'danger'); }
    } else if (kind === 'camera') {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        s.getTracks().forEach((t) => t.stop());
        savePerm('camera', true);
        Encounter.loadDetector();
      } catch { savePerm('camera', false); toast(T('denied'), 'danger'); }
    } else if (kind === 'compass') {
      const ok = await Compass.request();
      savePerm('compass', !!ok);
      if (!ok) toast(T('denied'), 'danger');
    } else if (kind === 'notif') {
      try { const r = await Notification.requestPermission(); savePerm('notif', r === 'granted'); } catch {}
    }
  }

  /** Sve što treba pre ulaska u sobu: dozvole + slika lica, jednom. */
  async function ensureReadyToPlay() {
    if (!UI.onboardingDone()) await UI.onboarding();
    Geo.start(); Compass.start();
    return true;
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
      upd[`${id}/allianceId`] = null;
      upd[`${id}/specialUsedThisGame`] = null; upd[`${id}/weaponCooldownUntilMs`] = null;
      upd[`${id}/poisonUntilMs`] = null; upd[`${id}/entangledUntilMs`] = null;
      upd[`${id}/attacksLanded`] = 0; upd[`${id}/attacksMissed`] = 0;
      upd[`${id}/effects`] = null; upd[`${id}/capacity`] = R.BASE_SLOTS;
      upd[`${id}/sparksCollected`] = 0;
    }
    await Store.hostUpdate('players', upd);
    await Store.hostSet('items', null);
    await Store.hostSet('traps', null);
    await Store.hostSet('hits', null);
    await Store.hostSet('feed', null);
    await Store.hostSet('schedule', null);
    /* Bez ovoga bi druga partija krenula sa punom kasom, vec skupljenim
       iskrama i spiskom "vec kupljenih" eventova iz prve. */
    await Store.hostSet('liveEvents', null);
    await Store.hostSet('sparks', null);
    await Store.hostSet('gmVotes', null);
    await Store.hostUpdate('meta', { state: 'LOBBY', startedAtMs: null, endedAtMs: null, winnerId: null });
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

  /* ───────────────── događaji duhova ───────────────── */
  async function buyEvent(type) {
    const cost = R.SPARK_COSTS[type];
    const P = Store.players();
    const ghosts = Object.entries(P).filter(([, p]) => p.alive === false && !p.isBot).length;

    /* Dve granice, obe tvrde. Bez njih je pola sata igre umelo da primi pet
       talasa zaredom, i to tri puta isti zid vatre. */
    const live = Object.values((Store.room && Store.room.liveEvents) || {});
    if (live.some((e) => e.type === type)) { toast(T('evSpent'), 'gold'); return; }
    if (live.length >= R.ghostEventBudget(Store.config().durationMin)) {
      toast(T('ghostNoEventsLeft'), 'gold', 'alert'); return;
    }

    /* Glasovi se čitaju SA SERVERA, ne iz lokalnog keša: keš zaostaje odmah
       posle sopstvenog upisa, pa je moj glas znao da fali u brojanju. */
    let voters = [];
    if (ghosts > 2) {
      await Store.voteEvent(type);
      voters = await Store.readVoters(type);
      if (voters.length < Math.ceil(ghosts / 2)) { toast(T('voteNeeded'), 'gold'); return; }
    }

    /* Brava PRE trošenja: dva duha koja istovremeno pređu prag inače oba prođu
       proveru i oba skinu iskre iz iste kase. Ko prvi postavi bravu, taj kupuje. */
    const won = await Store.commitEvent(type);
    if (!won) { toast(T('voteNeeded'), 'gold'); return; }

    const ok = await Store.spendSparks(cost);
    if (!ok) { await Store.releaseEvent(type); toast(T('sparks'), 'danger'); return; }

    const cfg = Store.config(), now = Clock.now();
    const meta2 = R.EVENTS[type];
    /* Isplatu dobijaju SVI koji su glasali, ne samo onaj ko je slučajno bacio
       poslednji glas — njihove iskre su otišle u istu kasu. `buyerId` ostaje
       radi starih zapisa. */
    const buyers = voters.length ? voters : [Store.myId];
    const ev = {
      id: U.uid('ge'), type, buyerId: Store.myId, buyerIds: buyers,
      atMs: now + 15000, warnMs: 15000, endMs: now + 15000 + meta2.durMs,
    };
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
    // glasovi i brava padaju tek kad je događaj stvarno upisan
    await Store.clearVotes(type);
    toast(eventName(type), 'gold', EVENT_ICON[type]);
  }

  /* ───────────────── petlja prikaza ───────────────── */
  Engine.on(async (kind, d) => {
    if (kind === 'tick') {
      await Attack.tick(d);
      await Items.checkTraps(d);
      handleOffers(d);
      route();
      const s = Screens.cur;
      if (s === 'deploy') UI.renderDeploy(d);
      else if (s === 'game') UI.renderGame(d);
      else if (s === 'ghost') UI.renderGhost(d);
      else if (s === 'watch') UI.renderWatch(d);
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
    if (kind === 'died') { toast(T('youDied'), 'danger', 'skull'); Haptics.fire('death'); }
    // zadatak od mentora: obe strane moraju da vide ishod, i uspeh i istek
    if (kind === 'questDone') {
      toast(`${T('questDoneMsg')} · +${R.QUEST_HEAL} ${T('hp').toLowerCase()}`, 'good', 'scroll');
      Haptics.fire('win'); Sfx.pickup();
    }
    if (kind === 'questExpired') toast(T('questExpiredMsg'), 'gold', 'clock');
    if (kind === 'zoneWarn') toast(T('zoneWarn') + ' 30 s', 'danger', 'alert');
    if (kind === 'eventWarn') toast(eventName(d.type), 'gold', EVENT_ICON[d.type] || 'spark');

    /* Isplata za sve iskre: event koji si TI platio se upravo pokrenuo.
       Do sada se posle kupovine nije dešavalo ništa vidljivo, pa skupljanje
       nije imalo poentu. Otvara se puna mapa, centrirana na mesto događaja. */
    if (kind === 'myEvent') {
      Haptics.fire('cannon');
      Sfx.warn();
      UI.arenaMapSheet(Engine.d, {
        focus: (d.lat && d.lng) ? { lat: d.lat, lng: d.lng } : null,
        banner: `${T('yourEvent')} — ${eventName(d.type)}`,
      });
    }
    if (kind === 'cannon') {
      const flash = $('#zoneFlash');
      if (flash) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
    }
  });

  /* — ponude saveza i dolazeći hitac — */
  let offerShown = null, shotShown = null, pkgShown = null, hitShown = null, decoyShown = null;
  let mentorShown;                           // undefined = jos nije bilo prvog prolaza
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

    // neko te nišani oružjem koje se najavljuje — imaš rok da se skloniš
    if (me.incomingAim && shotShown !== me.incomingAim.atMs) {
      shotShown = me.incomingAim.atMs;
      const dir = compassName(me.incomingAim.bearing);
      toast(`${T('incomingShot')} ${dir} — ${T('incomingMove')}`, 'danger', 'alert');
      Haptics.fire('incoming'); Sfx.warn();
    }
    if (!me.incomingAim) shotShown = null;

    // pogodak: crveni bljesak, vibracija, ko te je pogodio čime i sa koje strane
    if (me.incomingHit && hitShown !== me.incomingHit.atMs) {
      hitShown = me.incomingHit.atMs;
      const h = me.incomingHit;
      const from = (Store.players()[h.from] || {}).name || T('unknown');
      if (h.shielded) {
        toast(T('shieldBroke'), 'gold', 'shield');
        Haptics.fire('alert');
      } else {
        toast(`${T('hitBy')} ${weaponName(h.weapon)} ${T('fromDist')} ${h.distM} m — ${from}`, 'danger', 'swords');
        Haptics.fire('hurt'); Sfx.hurt();
        const flash = $('#zoneFlash');
        if (flash) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
      }
      Store.setMe('incomingHit', null);
    }

    // neko je nagazio na tvoj mamac — jedina povratna informacija tog predmeta
    if (me.decoyHit && decoyShown !== me.decoyHit.atMs) {
      decoyShown = me.decoyHit.atMs;
      toast(T('decoyHitMsg'), 'gold', 'eyeOff');
      Haptics.fire('alert');
      Store.setMe('decoyHit', null);
    }

    /* Neko je prihvatio tvoj poziv i postao ti mentor.
       Prvi prolaz samo upamti zatečeno stanje — inače bi ti na svakom ulasku
       u sobu iskakalo obaveštenje za mentora koga već odavno imaš. */
    const men = me.mentorName || null;
    if (mentorShown === undefined) mentorShown = men;
    else if (men && men !== mentorShown) {
      toast(`${T('mentorClaimed')}: ${men}`, 'good', 'users');
      Haptics.fire('pickup');
      mentorShown = men;
    } else if (!men) mentorShown = null;
  }
  function compassName(b) {
    const C = LANG === 'en' ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] : ['sever', 'severoistok', 'istok', 'jugoistok', 'jug', 'jugozapad', 'zapad', 'severozapad'];
    return C[Math.round((b || 0) / 45) % 8];
  }

  return {
    boot, route, requestPerm, startGame, playAgain, tryPickup, buyEvent, leaveRoom, goHome,
    quickTest, askBotCount, openSettings, openFullSettings, checkPerms, goFullscreen,
    get TEST() { return TEST; }, get MODE() { return MODE; },
  };
})();

window.addEventListener('DOMContentLoaded', () => App.boot());
