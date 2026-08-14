/* ═══════════════════════════════════════════════════════════════════════════
   EKRANI — sve iscrtavanje. Logika je u game/*, ovde je samo prikaz.
   ═══════════════════════════════════════════════════════════════════════════ */
const UI = (() => {
  'use strict';
  let myAvatar = JSON.parse(localStorage.getItem('arena.avatar') || 'null') || randomAvatar();
  let gmap = null, smap = null, smapCenter = null;
  let lastHp = null;

  const saveAvatar = () => localStorage.setItem('arena.avatar', JSON.stringify(myAvatar));

  /* ═══════════════ instalacija (§1) ═══════════════ */
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function maybeInstallModal() {
    if (isStandalone() || localStorage.getItem('arena.installChoice')) return;
    const m = modal(`
      <div class="center stack-lg">
        <div style="color:var(--gold)">${icon('download', { size: 52 })}</div>
        <h2>${esc(T('installTitle'))}</h2>
        <p class="dim">${esc(T('installBody'))}</p>
        <button class="btn primary lg full" id="iYes">${esc(T('installNow'))}</button>
        <button class="btn ghost full" id="iNo">${esc(T('continueBrowser'))}</button>
      </div>`, { dismissible: false });
    $('#iNo', m).onclick = () => { localStorage.setItem('arena.installChoice', 'browser'); m.close(); };
    $('#iYes', m).onclick = () => { m.close(); phoneChoice(); };
  }
  function phoneChoice() {
    const m = modal(`
      <div class="stack-lg">
        <h2 class="center">${esc(T('whichPhone'))}</h2>
        <button class="btn lg full" id="pAnd">${esc(T('android'))}</button>
        <button class="btn lg full" id="pIos">${esc(T('iphone'))}</button>
      </div>`);
    $('#pAnd', m).onclick = () => { m.close(); installSteps('android'); };
    $('#pIos', m).onclick = () => { m.close(); installSteps('ios'); };
  }
  function installSteps(kind) {
    const m = modal(`
      <div class="stack-lg">
        <h2>${esc(T('installTitle'))}</h2>
        <p class="dim" style="line-height:1.7">${kind === 'ios' ? T('iphoneSteps') : T('androidSteps')}</p>
        ${kind === 'android' ? `<button class="btn primary lg full" id="doInstall">${esc(T('installNow'))}</button>` : ''}
        <button class="btn ghost full" id="iDone">${esc(T('continue'))}</button>
      </div>`);
    $('#iDone', m).onclick = () => { localStorage.setItem('arena.installChoice', 'done'); m.close(); };
    const b = $('#doInstall', m);
    if (b) b.onclick = async () => {
      if (!installPrompt) { toast(T('installUnavailable'), 'gold'); return; }
      installPrompt.prompt();
      try { await installPrompt.userChoice; } catch {}
      installPrompt = null;
      localStorage.setItem('arena.installChoice', 'done');
      m.close();
    };
  }

  /* ═══════════════ početni ekran ═══════════════ */
  function initHome(testMode) {
    $('#brandMark').innerHTML = `<svg viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="50" fill="none" stroke="var(--gold)" stroke-width="5"/>
      <path d="M60 20 L75 44 L100 50 L81 68 L87 96 L60 81 L33 96 L39 68 L20 50 L45 44 Z"
        fill="var(--ember)"/></svg>`;
    $('#nameInput').value = localStorage.getItem('arena.name') || '';
    $('#idcardEdit').innerHTML = icon('chevronRight', { size: 18 });
    $('#btnSettingsHome').innerHTML = icon('settings', { size: 22 });
    renderHomeAvatar();
    show($('#btnQuickTest'), testMode || devMode());
    $('#qtIcon').innerHTML = icon('settings', { size: 20 });
  }
  const renderHomeAvatar = () => { $('#homeAvatar').innerHTML = `<span class="avatar" style="display:block">${avatarSvg(myAvatar, 46)}</span>`; };
  const devMode = () => localStorage.getItem('arena.dev') === '1';

  const HAIR_LBL = { short: 'Kratka', long: 'Duga', bun: 'Punđa', buzz: 'Ošišan', curly: 'Kovrdžava', braid: 'Pletenica' };
  const HAIR_LBL_EN = { short: 'Short', long: 'Long', bun: 'Bun', buzz: 'Buzz', curly: 'Curly', braid: 'Braid' };
  const BUILD_LBL = { slim: 'Vitak', normal: 'Srednji', broad: 'Krupan' };
  const BUILD_LBL_EN = { slim: 'Slim', normal: 'Normal', broad: 'Broad' };

  /** `opts.onSave` se zove na svaku promenu — u lobiju time lik ide i u bazu. */
  function avatarBuilder(opts) {
    opts = opts || {};
    const save = () => { saveAvatar(); if (opts.onSave) opts.onSave(myAvatar); };
    const s = sheet(T('avatarTitle'), '<div id="avBody"></div>');
    draw();
    function draw() {
      $('#avBody', s).innerHTML = `
        <div class="avatar-preview">${avatarFigure(myAvatar, 180, { weapon: 'fists' })}</div>
        ${group('skin', T('skin'), AV.skin, 'color')}
        ${group('hair', T('hair'), AV.hair, 'label')}
        ${group('hairColor', T('hairColor'), AV.hairColor, 'color')}
        ${group('top', T('shirt'), AV.top, 'color')}
        ${group('bottom', T('pants'), AV.bottom, 'color')}
        ${group('build', T('body'), AV.build, 'label')}
        <div class="row" style="margin-top:var(--s4)">
          <button class="btn ghost grow" id="avRand">${esc(T('randomize'))}</button>
          <button class="btn primary grow" id="avOk">${esc(T('continue'))}</button>
        </div>`;
      $$('.opt-row', s).forEach((row) => $$('button', row).forEach((b) => b.onclick = () => {
        myAvatar[row.dataset.k] = b.dataset.v; save(); draw(); renderHomeAvatar();
      }));
      $('#avRand', s).onclick = () => { myAvatar = randomAvatar(); save(); draw(); renderHomeAvatar(); };
      $('#avOk', s).onclick = () => { s.close(); renderHomeAvatar(); };
    }
    function group(key, label, vals, kind) {
      const lbl = (v) => (key === 'hair' ? (LANG === 'en' ? HAIR_LBL_EN : HAIR_LBL)[v]
        : key === 'build' ? (LANG === 'en' ? BUILD_LBL_EN : BUILD_LBL)[v] : v);
      return `<div class="field" style="margin-bottom:var(--s3)"><div class="label">${esc(label)}</div>
        <div class="opt-row" data-k="${key}">${vals.map((v) => `
          <button class="opt ${myAvatar[key] === v ? 'on' : ''}" data-v="${esc(v)}">
            ${kind === 'color' ? `<span class="swatch" style="background:${esc(v)}"></span>` : `<span class="tiny">${esc(lbl(v))}</span>`}
          </button>`).join('')}</div></div>`;
    }
  }

  /* ═══════════════ lobi ═══════════════
     Lobi se osvežava na SVAKU promenu u sobi, a igrači upisuju poziciju svakih
     par sekundi. Zato je podeljen na dva dela:

       buildLobby()  — skelet, mapa i klizači; pravi se JEDNOM
       updateLobby() — brojke, spisak igrača i stanje dugmeta "Pokreni"

     Ranije je sve išlo kroz jedno prepisivanje `#lobbyBody`, pa su klizači
     pucali usred prevlačenja, a Leaflet je ostajao zakačen za čvor koji
     sledeće iscrtavanje obriše — zbog toga mapa arene uopšte nije radila. */
  let lobbyKey = null;

  function renderLobby() {
    const host = Store.isHost();
    const key = `${Store.code}|${host}|${LANG}`;
    if (lobbyKey !== key) { lobbyKey = key; smap = null; buildLobby(host); }
    updateLobby(host);
  }

  /** Izlazak iz sobe: sledeći ulazak mora da gradi iznova. */
  function resetLobby() { lobbyKey = null; smap = null; }

  function buildLobby(host) {
    const cfg = Store.config();
    const rec = R.recommendFor(Object.keys(Store.players()).length || 3);

    const hostHtml = !host ? `
      <div class="card center stack"><div class="pulse-dot" style="margin:0 auto"></div>
        <p class="big">${esc(T('waitingHost'))}</p></div>` : `
      <div class="card stack">
        <div class="card-title">${esc(T('arena'))}</div>
        <div class="setup-map" id="setupMap"></div>
        <p class="tiny dim">${esc(T('tapMapCenter'))}</p>
        <button class="btn ghost" id="btnMyLoc">${icon('pin', { size: 20 })}<span>${esc(T('useMyLocation'))}</span></button>
      </div>
      <div class="card stack-lg">
        ${slider('diameterM', T('diameter'), 200, 2000, 50, cfg.diameterM, 'm', rec.diameterM)}
        ${slider('durationMin', T('duration'), 15, 120, 5, cfg.durationMin, 'min', rec.durationMin)}
        ${slider('itemDensityPct', T('itemDensity'), 50, 150, 10, Math.round((cfg.itemDensity || 1) * 100), '%', 100)}
        ${slider('prepMinutes', T('prepTime'), 3, 30, 1, cfg.prepMinutes, 'min', 10)}
        <div class="field"><div class="label">${esc(T('startMode'))}</div>
          <div class="seg" id="segMode">
            <button data-v="cornucopia" class="${cfg.startMode === 'cornucopia' ? 'on' : ''}">${esc(T('modeCornucopia'))}</button>
            <button data-v="scattered" class="${cfg.startMode === 'scattered' ? 'on' : ''}">${esc(T('modeScattered'))}</button>
          </div></div>
        <label class="switch"><span>${esc(T('eventsOn'))}</span>
          <input type="checkbox" id="cfgEvents" ${cfg.eventsEnabled ? 'checked' : ''}><span class="track"><span class="knob"></span></span></label>
        ${cfg.botsEnabled ? `<label class="switch"><span>${esc(T('botsOn'))}</span>
          <input type="checkbox" id="cfgBots" checked disabled><span class="track"><span class="knob"></span></span></label>` : ''}
      </div>
      <button class="btn primary lg full" id="btnStart">${esc(T('startGame'))}</button>
      <p class="tiny center dim" id="startWhy"></p>`;

    $('#lobbyBody').innerHTML = `
      <div class="row between"><div class="chip" id="lobbyCount"></div>
        <button class="btn sm ghost" id="btnLeaveLobby">${esc(T('leaveRoom'))}</button>
      </div>
      <div class="list" id="lobbyList"></div>
      <div class="card stack" id="mentorCard"></div>
      ${hostHtml}`;

    $('#btnLeaveLobby').onclick = () => App.leaveRoom();
    if (host) wireHostConfig();

    function slider(key, label, min, max, step, val, unit, recVal) {
      return `<div class="slider" data-k="${key}" data-rec="${recVal || ''}" data-unit="${esc(unit)}">
        <div class="slider-head"><span class="label">${esc(label)}</span>
          <span class="slider-val"><span class="v">${val}</span> ${esc(unit)}</span></div>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${val}">
        <div class="rec-hint"></div>
      </div>`;
    }
  }

  /* Osvežavanje — dira samo tekst i `disabled`, nikad ne prepisuje čvorove
     u kojima žive mapa i klizači. */
  function updateLobby(host) {
    const cfg = Store.config(), P = Store.players();
    const ids = Object.keys(P);
    const n = ids.length;
    $('#lobbyCode').textContent = Store.code || '-----';

    const cnt = $('#lobbyCount');
    if (cnt) cnt.innerHTML = `${icon('users', { size: 16 })}${n} / ${R.MAX_PLAYERS}`;

    const list = $('#lobbyList');
    if (list) {
      // Moja kartica prva — na njoj menjam lik i sa nje pozivam mentora.
      const order = ids.slice().sort((a, b) => (a === Store.myId ? -1 : b === Store.myId ? 1 : 0));
      list.innerHTML = order.map((id) => playerCard(id, P[id])).join('');
      const av = $('#lobbyMyAvatar');
      if (av) av.onclick = () => avatarBuilder({ onSave: () => Store.updateMe({ avatar: myAvatar }) });
    }

    updateMentorCard();

    if (!host) return;
    const ready = ids.every((id) => P[id].isBot || P[id].ready);
    const canStart = n >= R.MIN_PLAYERS && cfg.center && ready;
    const bs = $('#btnStart');
    if (bs) bs.disabled = !canStart;
    const why = $('#startWhy');
    if (why) {
      why.textContent = canStart ? ''
        : n < R.MIN_PLAYERS ? T('needPlayers') : !cfg.center ? T('needCenter') : T('needAllReady');
    }

    // preporuke se menjaju sa brojem igrača, pa upozorenje ide ovde
    const rec = R.recommendFor(n);
    const recFor = { diameterM: rec.diameterM, durationMin: rec.durationMin, itemDensityPct: 100, prepMinutes: 10 };
    $$('#lobbyBody .slider').forEach((sl) => {
      const key = sl.dataset.k, recVal = recFor[key];
      const inp = $('input', sl);
      // vrednost se NE dira dok je prst na klizaču
      if (document.activeElement !== inp && !inp.dataset.dragging) {
        const v = key === 'itemDensityPct' ? Math.round((cfg.itemDensity || 1) * 100) : cfg[key];
        if (v != null && +inp.value !== +v) { inp.value = v; $('.v', sl).textContent = v; }
      }
      const cur = +inp.value;
      const off = recVal ? Math.abs(cur - recVal) / recVal : 0;
      const hint = $('.rec-hint', sl);
      hint.className = 'rec-hint' + (off > 1 ? ' warn' : '');
      hint.textContent = (recVal ? `${T('recommended')}: ${recVal} ${sl.dataset.unit}` : '')
        + (off > 1 ? ' — ' + T('tooFarFromRecommended') : '');
    });

    if (smap && cfg.center) {
      smap.drawZone({ center: cfg.center, radiusM: cfg.diameterM / 2, shrinking: false }, cfg);
    }
  }

  /** Kartica igrača. Zelena oznaka dozvola je sklonjena — dozvole se traže
      unapred, pa je na kartici bila samo buka. */
  function playerCard(id, p) {
    const mine = id === Store.myId;
    const isHost = Store.meta().hostId === id;
    const avatar = p.isBot ? icon('settings', { size: 24 }) : avatarSvg(p.avatar, 44);
    return `<div class="player-row${mine ? ' mine' : ''}">
        <div class="avatar${mine ? ' tapable' : ''}" ${mine ? 'id="lobbyMyAvatar"' : ''}
          style="width:44px;height:44px">${avatar}</div>
        <div class="grow"><div class="name">${esc(p.name)}${mine ? ' · ' + esc(T('you')) : ''}</div>
          ${isHost ? `<div class="tiny goldc">${esc(T('youAreHost'))}</div>` : ''}</div>
      </div>`;
  }

  /* ═══════════════ poziv mentora — iz LOBIJA ═══════════════
     Ranije se do mentorskog linka dolazilo samo kroz podešavanja nasred žive
     partije: pet koraka, od kojih se tri dešavaju dok trčiš napolju. Niko to
     nikad nije uradio, pa mentore niko nije ni video. Lobi je jedini trenutak
     kad svi stoje na istom mestu, sa vremenom u rukama. */
  function updateMentorCard() {
    const card = $('#mentorCard');
    if (!card) return;
    const me = Store.me() || {};
    const men = (Store.mentors() || {})[Store.myId] || {};
    const name = me.mentorName || men.name;
    const has = !!men.mentorId;

    card.innerHTML = `<div class="card-title">${esc(T('yourMentorTitle'))}</div>`
      + (has
        ? `<div class="row">
             <span class="goldc">${icon('users', { size: 22 })}</span>
             <div class="grow"><div class="big" style="font-weight:800">${esc(name || T('mentorTitle'))}</div>
               <div class="tiny dim">${esc(T('yourMentor'))}</div></div>
             <button class="btn sm ghost" id="mentorChange">${esc(T('changeMentor'))}</button>
           </div>`
        : `<p class="tiny dim" style="margin:0">${esc(T('mentorQrBody'))}</p>
           <button class="btn primary full" id="mentorInvite">
             ${icon('qr', { size: 20 })}<span>${esc(T('inviteMentor'))}</span></button>`);

    const inv = $('#mentorInvite', card);
    if (inv) inv.onclick = () => mentorInviteSheet();
    const ch = $('#mentorChange', card);
    if (ch) ch.onclick = async () => {
      if (!(await confirmBox(T('changeMentorAsk'), T('changeMentor'), true))) return;
      await Store.mentorRef(Store.myId).remove();
      await Store.updateMe({ mentorName: null });
      mentorInviteSheet();
    };
  }

  /** QR + link, isti oblik kao `showQr()` za sobu. */
  function mentorInviteSheet() {
    const url = Mentor.mentorLinkFor(Store.code, Store.myId);
    let svg = '';
    try {
      const q = qrcode(0, 'M'); q.addData(url); q.make();
      svg = q.createSvgTag({ cellSize: 6, margin: 2 });
    } catch { svg = ''; }
    const s = sheet(T('inviteMentor'), `
      <div class="qr-wrap">${svg}
        <p class="dim">${esc(T('mentorQrBody'))}</p></div>
      <div class="card" style="word-break:break-all;font-size:var(--fs-sm)">${esc(url)}</div>
      <button class="btn primary lg full" id="mlCopy" style="margin-top:var(--s3)">${esc(T('copyMentorLink'))}</button>`);
    $('#mlCopy', s).onclick = async () => {
      try { await navigator.clipboard.writeText(url); toast(T('copied'), 'good', 'check'); } catch {}
      if (navigator.share) { try { await navigator.share({ title: 'ARENA', url }); } catch {} }
    };
  }

  function wireHostConfig() {
    const cfg = Store.config();
    // Mapa se pravi jednom, u čvoru koji od sada niko ne prepisuje.
    smap = makeMap('setupMap', { zoom: 15, noFog: true });
    smap.map.on('click', (e) => {
      smapCenter = { lat: e.latlng.lat, lng: e.latlng.lng };
      Store.hostUpdate('config', { center: smapCenter });
    });
    setTimeout(() => smap && smap.refresh(), 60);
    if (cfg.center) smap.map.setView([cfg.center.lat, cfg.center.lng], 15);

    $('#btnMyLoc').onclick = () => {
      if (!Geo.pos) { toast(T('gpsGoOutside'), 'danger'); return; }
      Store.hostUpdate('config', { center: { lat: Geo.pos.lat, lng: Geo.pos.lng } });
      smap.map.setView([Geo.pos.lat, Geo.pos.lng], 16);
    };
    $$('#lobbyBody .slider').forEach((sl) => {
      const inp = $('input', sl), key = sl.dataset.k;
      // zastavica drži osvežavanje dalje od klizača dok traje prevlačenje
      inp.addEventListener('pointerdown', () => { inp.dataset.dragging = '1'; });
      ['pointerup', 'pointercancel'].forEach((e) =>
        inp.addEventListener(e, () => { delete inp.dataset.dragging; }));
      inp.oninput = () => { $('.v', sl).textContent = inp.value; };
      inp.onchange = () => {
        delete inp.dataset.dragging;
        const v = +inp.value;
        if (key === 'itemDensityPct') Store.hostUpdate('config', { itemDensity: v / 100 });
        else Store.hostUpdate('config', { [key]: v });
      };
    });
    segInit($('#segMode'));
    $$('#segMode button').forEach((b) => b.onclick = () => {
      segPick($('#segMode'), b.dataset.v);
      Store.hostUpdate('config', { startMode: b.dataset.v });
    });
    const ev = $('#cfgEvents'); if (ev) ev.onchange = () => Store.hostUpdate('config', { eventsEnabled: ev.checked });
    const bs = $('#btnStart'); if (bs) bs.onclick = () => App.startGame();
  }

  function showQr() {
    const url = `${location.origin}/arena/?room=${Store.code}`;
    let svg = '';
    try {
      const q = qrcode(0, 'M'); q.addData(url); q.make();
      svg = q.createSvgTag({ cellSize: 6, margin: 2 });
    } catch { svg = `<p class="dim">${esc(url)}</p>`; }
    sheet(T('showQr'), `<div class="qr-wrap">${svg}
      <div class="code-display">${esc(Store.code)}</div>
      <p class="dim">${esc(T('scanQr'))}</p></div>`);
  }
  async function shareLink() {
    const url = `${location.origin}/arena/?room=${Store.code}`;
    const text = `ARENA — ${T('roomCode')}: ${Store.code}\n${url}`;
    if (navigator.share) { try { await navigator.share({ title: 'ARENA', text, url }); return; } catch {} }
    try { await navigator.clipboard.writeText(text); toast(T('copied'), 'good', 'check'); } catch { toast(url); }
  }

  /* ═══════════════ dozvole i slika — JEDNOM, pre ulaska u sobu (§3) ═══════════════
     Ranije je sve ovo stajalo tik pred partiju, pa se dozvole traže u trenutku
     kad ljudi hoće da igraju. Sada se odradi jednom po telefonu i zapamti. */
  const ONB_KEY = 'arena.onboarded';
  const FACE_KEY = 'arena.face';
  const onboardingDone = () => localStorage.getItem(ONB_KEY) === '1' && !!localStorage.getItem(FACE_KEY);

  function onboarding() {
    return new Promise((res) => {
      let step = 0;
      const s = sheet(null, '<div id="onbBody"></div>', { sticky: true });
      s.dataset.noback = '1';

      function draw() { [perms, face][step](); }
      function next() { step = Math.min(1, step + 1); draw(); }
      draw();                       // tek posle definicija — inače `next` još ne postoji

      function perms() {
        const p = permState();
        $('#onbBody', s).innerHTML = `
          <h2 style="margin-bottom:var(--s2)">${esc(T('permTitle'))}</h2>
          <p class="dim">${esc(T('permBody'))}</p>
          <div class="stack" style="margin:var(--s4) 0">
            ${row('location', T('grantLocation'), 'pin', p.location)}
            ${row('camera', T('grantCamera'), 'camera', p.camera)}
            ${row('compass', T('grantCompass'), 'compass', p.compass)}
          </div>
          <div class="card" style="border-color:var(--gold);margin-bottom:var(--s3)">
            <div class="row"><span class="goldc">${icon('alert', { size: 22 })}</span>
            <p class="grow tiny" style="margin:0">${esc(T('safetyWarn'))}</p></div>
          </div>
          <button class="btn primary lg full" id="onbNext" ${p.location && p.camera ? '' : 'disabled'}>${esc(T('continue'))}</button>`;
        $$('#onbBody .perm-row', s).forEach((b) => b.onclick = async () => { await App.requestPerm(b.dataset.p); perms(); });
        $('#onbNext', s).onclick = next;
      }
      function row(k, label, ic, ok) {
        return `<button class="perm-row ${ok ? 'ok' : ''}" data-p="${k}">
          <span class="${ok ? 'goldc' : 'dim'}">${icon(ic, { size: 22 })}</span>
          <span class="grow" style="text-align:left;font-weight:700">${esc(label)}</span>
          ${ok ? `<span style="color:var(--good)">${icon('check', { size: 20 })}</span>` : icon('chevronRight', { size: 18 })}
        </button>`;
      }

      function face() {
        $('#onbBody', s).innerHTML = `
          <h2 style="margin-bottom:var(--s2)">${esc(T('faceTitle'))}</h2>
          <p class="dim">${esc(T('faceBody'))}</p>
          <div class="cam-wrap" style="margin:var(--s3) 0"><video id="faceVid" playsinline muted></video><div class="face-oval"></div></div>
          <canvas id="faceCan" hidden></canvas>
          <button class="btn primary lg full" id="fShot">${icon('camera', { size: 22 })}<span>${esc(T('faceTake'))}</span></button>`;
        Encounter.openCamera($('#faceVid', s), 'user').catch(() => toast(T('denied'), 'danger'));
        /* Isečak prati OVAL sa ekrana, ne ceo kadar — ranije se seklo po
           sredini celog snimka, pa je lice ispadalo sitno i daleko. Uz to se
           slika okreće po širini: prednja kamera je daje u ogledalu, a u igri
           te ostali prepoznaju onako kako te stvarno vide. */
        $('#fShot', s).onclick = () => {
          const v = $('#faceVid', s), c = $('#faceCan', s);
          if (!v.videoWidth) return toast(T('denied'), 'danger');
          const vw = v.videoWidth, vh = v.videoHeight;
          // deo izvora koji se zaista vidi u okviru 3:4 (object-fit: cover)
          const k = Math.max(3 / vw, 4 / vh);
          const visW = 3 / k, visH = 4 / k;
          const visX = (vw - visW) / 2, visY = (vh - visH) / 2;
          // vodilja iz CSS-a: 16%–84% po širini, 18%–70% po visini
          const gw = visW * 0.68, gh = visH * 0.52;
          const cx = visX + visW * 0.16 + gw / 2, cy = visY + visH * 0.18 + gh / 2;
          const side = Math.min(Math.max(gw, gh) * 1.15, vw, vh);
          const sx = U.clamp(cx - side / 2, 0, vw - side);
          const sy = U.clamp(cy - side / 2, 0, vh - side);
          const S = 320;
          c.width = S; c.height = S;
          const ctx = c.getContext('2d');
          ctx.translate(S, 0); ctx.scale(-1, 1);
          ctx.drawImage(v, sx, sy, side, side, 0, 0, S, S);
          localStorage.setItem(FACE_KEY, c.toDataURL('image/jpeg', 0.78));
          localStorage.setItem(ONB_KEY, '1');
          Encounter.stop();
          Haptics.fire('pickup');
          s.close();
          res(true);
        };
      }
    });
  }
  function permState() {
    const p = JSON.parse(localStorage.getItem('arena.perms') || '{}');
    return { location: !!p.location, camera: !!p.camera, compass: !!p.compass };
  }

  /* ═══════════════ pred partiju: samo kompas i GPS ═══════════════ */
  const PREP_STEPS = ['compass', 'gps'];
  let prepStep = 0;

  function renderPrep() {
    const s = PREP_STEPS[prepStep] || 'compass';
    $('#prepSteps').innerHTML = PREP_STEPS.map((_, i) =>
      `<i class="${i < prepStep ? 'done' : i === prepStep ? 'on' : ''}"></i>`).join('');
    $('#prepStepChip').textContent = `${T('step')} ${prepStep + 1}/${PREP_STEPS.length}`;
    ({ compass: stepCompass, gps: stepGps })[s]();
  }
  const nextStep = async () => {
    if (prepStep < PREP_STEPS.length - 1) { prepStep++; renderPrep(); return; }
    await Store.updateMe({ ready: true });
    Screens.go('lobby');
  };

  /** Kalibracija: meri se STVARNO okretanje telefona, ne izmišljena tačnost.
      Android tačnost uopšte ne javlja — jedini pošten test je da li se smer
      menja kad okreneš telefon u krug. */
  function stepCompass() {
    const h = Compass.heading, acc = Compass.accuracy, span = Compass.span;
    const usable = Compass.usable;
    const turned = span >= 75;
    const ok = usable && turned;
    $('#prepBody').innerHTML = `
      <div class="stack-lg center">
        <h2>${esc(T('calibTitle'))}</h2>
        <p class="dim">${esc(T('calibTurn'))}</p>
        <div class="gauge" style="padding:var(--s3) 0">
          <div style="position:relative;width:150px;height:150px">
            <svg width="150" height="150" style="position:absolute;inset:0;transform:rotate(-90deg)">
              <circle cx="75" cy="75" r="66" fill="none" stroke="var(--ink-4)" stroke-width="8"/>
              <circle cx="75" cy="75" r="66" fill="none" stroke="var(--good)" stroke-width="8" stroke-linecap="round"
                stroke-dasharray="${2 * Math.PI * 66}" stroke-dashoffset="${2 * Math.PI * 66 * (1 - span / 100)}"/>
            </svg>
            <div style="position:absolute;inset:0;display:grid;place-items:center;transform:rotate(${h == null ? 0 : -h}deg);color:var(--ember)">
              ${icon('navigation', { size: 56 })}</div>
          </div>
          <div class="val ${turned ? 'ok' : ''}">${span}%</div>
          <div class="tiny dim">${h == null ? esc(T('detNoCompass')) : Math.round(h) + '° · ' + (acc != null ? '±' + Math.round(acc) + '°' : esc(T('compassNoAcc')))}</div>
        </div>
        ${!Compass.sawAnyEvent ? `<div class="card danger"><p class="tiny" style="margin:0">${esc(T('compassNone'))}</p></div>` : ''}
        <button class="btn primary lg full" id="cNext" ${ok ? '' : 'disabled'}>${esc(T('continue'))}</button>
        <button class="btn ghost full" id="cSkip">${esc(T('skip'))}</button>
        <p class="tiny mute">${esc(T('calibSkipWarn'))}</p>
      </div>`;
    $('#cNext').onclick = () => { Store.updateMe({ 'perms/compass': true }); nextStep(); };
    $('#cSkip').onclick = () => nextStep();
  }

  function stepGps() {
    const acc = Geo.accuracy;
    const ok = acc != null && acc <= 20;
    const bad = acc != null && acc > 30;
    $('#prepBody').innerHTML = `
      <div class="stack-lg center">
        <h2>${esc(T('gpsTitle'))}</h2>
        <p class="dim">${esc(T('gpsBody'))}</p>
        <div class="gauge">
          <div style="color:${ok ? 'var(--good)' : 'var(--gold)'}">${icon('pin', { size: 76 })}</div>
          <div class="val ${ok ? 'ok' : bad ? 'bad' : ''}">${acc != null ? '±' + Math.round(acc) + ' m' : '…'}</div>
          <div class="tiny dim">${esc(T('gpsAccuracy'))}</div>
        </div>
        ${bad ? `<div class="card danger"><p class="tiny" style="margin:0">${esc(T('gpsGoOutside'))}</p></div>` : ''}
        <button class="btn primary lg full" id="gNext" ${ok ? '' : 'disabled'}>${esc(T('imReady'))}</button>
        <button class="btn ghost full" id="gSkip">${esc(T('skip'))}</button>
      </div>`;
    $('#gNext').onclick = () => nextStep();
    $('#gSkip').onclick = () => nextStep();
  }

  /* ═══════════════ PREP faza: idi na startnu tačku (§4) ═══════════════ */
  /* Ekran pripreme se osvežava svake sekunde. Ako se pri tom prepiše ceo
     `#deployBody`, kartica klase i sastav arene se iznova crtaju i vidno
     trepere. Zato skelet ide jednom, a otkucaj menja samo brojke, ugao
     strelice i stanje dugmeta. */
  let deployKey = null;

  function renderDeploy(d) {
    const me = d.me;
    if (!me) return;
    const sp = me.startPos;
    const pos = Geo.pos;
    const dist = sp && pos ? U.dist(pos, sp) : null;
    const close = dist != null && dist <= 10;
    const meta = Store.meta();
    const left = meta.countdownAtMs ? Math.max(0, (meta.countdownAtMs - d.now) / 1000)
      : Math.max(0, ((meta.prepEndsAtMs || 0) - d.now) / 1000);
    const brg = sp && pos ? U.bearing(pos, sp) : 0;
    const rot = Compass.heading != null ? brg - Compass.heading : brg;

    const key = `${me.classId}|${LANG}|${!!Store.meta().census}|${App.TEST}`;
    if (deployKey !== key) { deployKey = key; buildDeploy(me); }

    $('#depCountLbl').textContent = meta.countdownAtMs ? T('startingIn') : T('prepCountdown');
    $('#depCount').textContent = U.mmss(left);
    $('#depArrow').style.transform = `rotate(${rot}deg)`;
    const dn = $('#depDist');
    dn.textContent = dist != null ? fmtDist(dist) : '—';
    dn.className = 'prep-dist' + (close ? ' close' : '');
    const b = $('#btnArrived');
    b.disabled = !(close && !me.arrived);
    b.textContent = me.arrived ? T('arrivedDone') : close ? T('arrivedBtn') : T('arrivedLocked');
    const w = $('#btnWalkStart');
    if (w) show(w, !!sp && !me.arrived);
  }

  function buildDeploy(me) {
    const census = Store.meta().census;
    $('#deployBody').innerHTML = `
      ${me.classId ? `<div class="class-card">
        <div>${icon(CLASS_ICON[me.classId] || 'user', { size: 56 })}</div>
        <div class="tiny upper dim">${esc(T('yourClass'))}</div>
        <h2>${esc(clsName(me.classId))}</h2>
        <p class="dim" style="margin:var(--s2) 0 0">${esc(clsDesc(me.classId))}</p>
        <div class="chip gold" style="margin-top:var(--s3)">${icon(WEAPON_ICON[R.CLASSES[me.classId].weapon], { size: 16 })}${esc(weaponName(R.CLASSES[me.classId].weapon))}</div>
      </div>` : ''}
      <div class="card center stack">
        <div class="tiny upper dim" id="depCountLbl"></div>
        <div class="display" id="depCount" style="font-size:var(--fs-3xl);color:var(--ember)"></div>
      </div>
      <div class="card">
        <div class="prep-nav">
          <div class="tiny upper dim">${esc(T('goToStart'))}</div>
          <div class="prep-arrow" id="depArrow">${icon('navigation', { size: 84 })}</div>
          <div class="prep-dist" id="depDist"></div>
        </div>
        <button class="action-btn" id="btnArrived" disabled></button>
        ${App.TEST ? `<button class="btn ghost full" id="btnWalkStart" hidden
          style="margin-top:var(--s2)">${icon('run', { size: 20 })}<span>${esc(T('testWalkStart'))}</span></button>` : ''}
      </div>
      ${census ? `<div class="card"><div class="card-title">${esc(T('arenaComposition'))}</div>
        <div class="row wrap">${Object.entries(census).map(([k, v]) =>
          `<span class="chip">${icon(CLASS_ICON[k], { size: 14 })}${v}× ${esc(clsName(k))}</span>`).join('')}</div></div>` : ''}`;

    $('#btnArrived').onclick = () => { Store.updateMe({ arrived: true }); Haptics.fire('pickup'); };
    // Bez ovoga se u testu do startne tačke ne stiže — a bez nje partija ne kreće.
    const w = $('#btnWalkStart');
    if (w) w.onclick = () => {
      const sp = (Store.me() || {}).startPos;
      if (sp) { TestWalk.goTo(sp); toast(T('testWalkStart'), 'gold', 'run'); }
    };
  }

  /* ═══════════════ ekran igre ═══════════════ */
  function ensureMap() {
    if (!gmap) {
      gmap = makeMap('gamemap', { zoom: 18 });
      window.addEventListener('arena:mapdrag', () => { const b = $('#btnRecenter'); if (b) b.hidden = false; });
      // U testu se ne šeta po gradu — tap po mapi te vodi tamo peške (§21).
      if (App.TEST) {
        gmap.map.on('click', (e) => TestWalk.goTo({ lat: e.latlng.lat, lng: e.latlng.lng }));
        TestWalk.enable();
        toast(T('tapToWalk'), 'gold', 'map');
      }
    } else gmap.refresh();
    return gmap;
  }

  function renderGame(d) {
    const me = d.me;
    if (!me) return;
    ensureMap();
    const pos = Geo.pos;

    // vidljivost i mapa
    gmap.setVision((d.vision && d.vision.itemsM) || 15);
    gmap.setFull(me.alive === false || d.state === 'FINAL_TWO');
    if (pos) gmap.setMe(pos, Compass.heading);
    const ghost = me.alive === false;
    const ghostInZone = !!d.ghostInZone;
    // Karta zone: najavni prsten se pali 5 min ranije nego inače.
    // Duhu se krug obrće — njegov teren je VAN zone.
    if (d.zone) gmap.drawZone({ ...d.zone, peek: (me.zonePeekUntilMs || 0) > d.now }, d.cfg, { ghost });
    gmap.drawFire(d.firewall);
    gmap.drawWasps(d.wasps);
    gmap.drawSmoke(d.smoke);
    /* Duhovi umesto plena vide iskre (§16). Iskre stoje samo u prstenu van
       zone, pa se dok je duh unutra ne crta ništa — nema šta ni da se crta. */
    // izračunaj jednom po otkucaju — i mapa i kompas duha gledaju isti spisak
    const ghostSparks = ghost ? Items.sparks(d) : null;
    d._sparks = ghostSparks;
    const drawn = ghost
      ? (ghostInZone ? [] : ghostSparks.slice(0, 40).map((s) => ({ ...s, type: 'spark', rarity: 'legendary' })))
      : Items.visible(d);
    gmap.drawItems(drawn, (it) => (ghost ? (it.inReach && Items.collectSpark(it.id)) : App.tryPickup(it)));
    gmap.drawTraps(Items.visibleTraps(d));
    gmap.drawPlayers(visiblePlayers(d));

    // gornja traka: samo kontekst
    const z = d.zone;
    const zc = $('#zoneChip');
    if (z) {
      const nextIn = z.next ? Math.max(0, (z.next.startMs - d.now) / 1000) : 0;
      zc.className = 'zonechip glass' + (d.outsideZone ? ' danger' : z.warn || z.shrinking ? ' warn' : '');
      zc.innerHTML = d.outsideZone
        ? `${icon('alert', { size: 15 })}<span>${esc(T('outsideZone'))} · ${fmtDist(d.distToZone)}</span>`
        : `${icon('target', { size: 15 })}<span>${esc(T('zonePhase'))}${z.phase ? ' ' + z.phase + '/5' : ''}${z.next ? ' · ' + U.mmss(nextIn) : ''}</span>`;
    } else zc.innerHTML = `${icon('clock', { size: 15 })}<span>${U.mmss(Math.max(0, (d.endsAtMs - d.now) / 1000))}</span>`;

    // duh se ne kažnjava životom, ali mora da zna da mu mesto nije unutra
    $('#dangerVig').classList.toggle('on', (!ghost && !!d.outsideZone) || !!d.inFire || !!d.inWasps);
    const gb = $('#ghostBanner');
    gb.hidden = !ghostInZone;
    if (ghostInZone) gb.innerHTML = `${icon('alert', { size: 18 })}<span>${esc(T('ghostInZone'))}</span>`;

    if (ghost) {
      // mrtvom HP, glad i žeđ ne znače ništa — u traci stoji ono što mu jeste posao
      $('#vitals').innerHTML = ghostVitals(d);
      $('#fxBar').hidden = true;             // efekti su stvar živih
    } else {
      // vitalni — prag upozorenja prati prag kazne (§3), ne proizvoljnih 25
      const maxHp = me.maxHp || 100;
      const lowAt = R.SURVIVAL.lowThreshold;
      $('#vitals').innerHTML =
        vitalBox('hp', 'heart', me.hp || 0, maxHp, (me.hp || 0) < 25) +
        vitalBox('hunger', 'meat', me.hunger || 0, 100 + (me.maxHungerBonus || 0), (me.hunger || 0) < lowAt) +
        vitalBox('thirst', 'droplet', me.thirst || 0, 100 + (me.maxThirstBonus || 0), (me.thirst || 0) < lowAt);
      renderEffects(d);
    }

    // kompas traka sa oznakama
    renderCompass(d);

    // glavna akcija
    const act = $('#actionBtn');
    const near = Items.nearest(d);
    if (ghost) {
      const sp = drawn.find((s) => s.inReach);
      act.hidden = false; act.disabled = false; act.className = 'action-btn gold';
      act.innerHTML = sp
        ? `${icon('spark', { size: 24 })}<span>${esc(T('collectSpark'))}</span>`
        : `${icon('ghost', { size: 24 })}<span>${esc(T('ghostTitle'))}</span>`;
      act.onclick = () => (sp ? Items.collectSpark(sp.id) : Screens.go('ghost'));
    } else if (near && Items.pickupAllowed(d)) {
      act.hidden = false; act.disabled = false; act.className = 'action-btn';
      act.innerHTML = `${icon(ITEM_ICON[near.type] || 'box', { size: 24 })}<span>${esc(itemName(near.type))}</span>`;
      act.onclick = () => App.tryPickup(near);
      if (!act._buzzed) { act._buzzed = true; Haptics.fire('itemNear'); }
    } else { act.hidden = true; act._buzzed = false; }

    // donja traka
    const dockBtn = (id, ic, label, badge) => {
      const n = $(id);
      if (!n) return;
      n.innerHTML = `${icon(ic, { size: 20 })}<span class="t">${esc(label)}</span>`
        + (badge ? `<span class="badge">${badge}</span>` : '');
    };
    const invN = Items.inv(me).length;
    dockBtn('#btnInv', 'backpack', T('inventory'), invN || 0);
    dockBtn('#btnFeed', 'scroll', T('feed'));
    dockBtn('#btnPlayers', 'users', T('tributes'), d.aliveCount);
    dockBtn('#btnGhost', ghost ? 'spark' : 'map', ghost ? T('sparks') : T('map'));
    $('#btnCamera').innerHTML = icon('camera', { size: 26 });
    $('#btnMenu').innerHTML = icon('settings', { size: 20 });
    $('#btnRecenter').innerHTML = icon('crosshair', { size: 20 });

    // pogodak / šteta — vibracija i trzaj
    if (lastHp != null && me.hp < lastHp - 0.6) { Haptics.fire('hurt'); }
    lastHp = me.hp;

    // Puna mapa je fioka preko ekrana igre, pa ovaj otkucaj i dalje ide —
    // koristimo ga da se i na njoj vidi kretanje, a ne zamrznuta slika.
    if (amap) {
      if (pos) amap.setMe(pos, Compass.heading);
      if (d.zone) amap.drawZone({ ...d.zone, peek: (me.zonePeekUntilMs || 0) > d.now }, d.cfg);
      amap.drawPlayers(visiblePlayers(d, true));
      amap.drawItems(Items.visible(d), null);
      amap.drawFire(d.firewall);
      amap.drawWasps(d.wasps);
      amap.drawSmoke(d.smoke);
    }
  }

  /* ═══════════════ traka efekata sa trajanjem ═══════════════
     Sedam predmeta traje X minuta, a do sada nigde nije pisalo koliko je
     ostalo. Šta god da se doda u budućnosti, dovoljno je da uđe u
     R.TIMED_EFFECTS — ovde se ne dira ništa.

     Uz efekte stoje i dve kazne od preživljavanja (slep/slab), jer se i one
     ponašaju kao stanje koje igrač mora da vidi da bi znao zašto promašuje. */
  function renderEffects(d) {
    const bar = $('#fxBar');
    if (!bar) return;
    const chips = (d.effects || []).map((e) => {
      const left = e.charges != null ? `×${e.charges}` : U.mmss(Math.max(0, e.leftMs / 1000));
      return `<span class="fx ${e.tone}" title="${esc(T('fx_' + e.id))}">
        ${icon(e.icon, { size: 13 })}<b>${esc(left)}</b></span>`;
    });
    const pen = d.penalty || {};
    if (pen.parched) chips.unshift(`<span class="fx danger" title="${esc(T('fxParched'))}">${icon('eyeOff', { size: 13 })}<b>${esc(T('fxParchedShort'))}</b></span>`);
    if (pen.starving) chips.unshift(`<span class="fx danger" title="${esc(T('fxStarving'))}">${icon('meat', { size: 13 })}<b>−25%</b></span>`);

    /* Mentor nije efekat sa trajanjem nego stalno stanje — stoji prvi u traci,
       bez odbrojavača, samo da igrač zna da neko gleda i da mu može poslati
       paket. Bez ovoga igrač nema pojma da mentora uopšte ima. */
    const men = (d.me || {}).mentorName;
    if (men) {
      chips.unshift(`<span class="fx gold" id="fxMentor" title="${esc(T('yourMentor'))}">
        ${icon('users', { size: 13 })}<b>${esc(men)}</b></span>`);
    }

    bar.innerHTML = chips.join('');
    bar.hidden = !chips.length;
    const fm = $('#fxMentor', bar);
    if (fm) fm.onclick = () => {
      const m = modal(`<div class="center stack">
        <div class="goldc">${icon('users', { size: 44 })}</div>
        <h2>${esc(T('yourMentorTitle'))}</h2>
        <p class="big" style="font-weight:800">${esc(men)}</p>
        <p class="dim tiny">${esc(T('mentorWatching'))}</p>
        <button class="btn primary full" id="fmOk">${esc(T('ok'))}</button></div>`);
      $('#fmOk', m).onclick = () => m.close();
    };
  }

  /* ═══════════════ traka duha ═══════════════
     Zamenjuje HP/glad/žeđ. Duh treba četiri broja: koliko je SAM doprineo,
     koliko ima u zajedničkoj kasi, koliko još fali do prvog sledećeg eventa,
     i koliko je igara ostalo — jer to je jedini razlog zašto još skuplja. */
  function ghostVitals(d) {
    const me = d.me || {};
    const pool = (Store.sparks().pool) || 0;
    const alive = Object.values(Store.players()).filter((p) => p.alive !== false).length;

    // najjeftiniji event koji još niko nije pustio
    const bought = new Set(Object.values((Store.room && Store.room.liveEvents) || {}).map((e) => e.type));
    const left = Object.entries(R.SPARK_COSTS).filter(([t]) => !bought.has(t));
    const cheapest = left.length ? left.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;
    const missing = cheapest ? Math.max(0, cheapest[1] - pool) : 0;

    const box = (cls, ic, val, label) => `<div class="vitalbox ${cls}">
      <span class="vi">${icon(ic, { size: 15 })}</span>
      <span class="vn num">${esc(String(val))}</span>
      <span class="gl">${esc(label)}</span></div>`;

    return box('spark', 'spark', me.sparksCollected || 0, T('ghostMine'))
      + box('pool', 'flask', pool, T('ghostPool'))
      + (cheapest
        ? box(missing > 0 ? 'need' : 'ready',
            EVENT_ICON[cheapest[0]] || 'spark',
            missing > 0 ? '−' + missing : '✓',
            missing > 0 ? eventName(cheapest[0]) : T('ghostCanBuy'))
        : box('ready', 'check', '✓', T('ghostAllBought')))
      + box('alive', 'users', alive, T('ghostAlive'));
  }

  /* Ko se uopšte vidi na mapi (§5).
     Pravilo je usko namerno: protivnika NE vidiš. Vide se samo saveznici, oni
     koje si sam otkrio (traker, alarm, durbin), i — ako si Strelac — igrači u
     tvom dometu vida. Snagator je „vidljiv svima" samo na PUNOJ mapi, ne i na
     minimapi; ranije je iskakao i na minimapi, pa je izgledalo kao da mapa
     odaje protivnike svima. */
  function visiblePlayers(d, fullMap) {
    const me = d.me, pos = Geo.pos;
    const out = [];
    const now = d.now;
    const spectator = me.alive === false || d.state === 'END';
    const cls = R.CLASSES[me.classId] || {};
    for (const [pid, p] of Object.entries(Store.players())) {
      if (pid === Store.myId || !p.pos) continue;
      if (spectator) { out.push({ id: pid, lat: p.pos.lat, lng: p.pos.lng, kind: p.alive === false ? 'dead' : 'foe' }); continue; }
      if (p.alive === false) continue;
      const ally = p.allianceId && p.allianceId === me.allianceId;
      const dist = pos ? U.dist(pos, p.pos) : Infinity;
      if (p.unconscious) { out.push({ id: pid, lat: p.pos.lat, lng: p.pos.lng, kind: 'unconscious' }); continue; }
      if (ally) { out.push({ id: pid, lat: p.pos.lat, lng: p.pos.lng, kind: 'ally' }); continue; }
      if (cls.blindToMap) continue;                                  // Senka nikoga ne vidi (§5)
      if (p.classId === 'shadow') continue;                          // Senku niko ne vidi
      if (p.hiddenUntilMs > now) continue;
      const strongVisible = fullMap && (R.CLASSES[p.classId] || {}).alwaysVisible;
      const revealed = p.revealedUntilMs > now || (p.trackedBy === Store.myId && p.trackedUntilMs > now);
      if (strongVisible || revealed || (d.state === 'FINAL_TWO')) { out.push({ id: pid, lat: p.pos.lat, lng: p.pos.lng, kind: 'foe' }); continue; }
      /* Baklja i ranac su jedina dva predmeta koja te ODAJU. Svetlo znači da
         ti vidiš, ali i da tebe vide — jedini tradeoff koji je istinit i
         uživo, i jedini razlog da baklju iko ikad ugasi. */
      const selfM = R.selfRevealM(p, now);
      if (selfM && dist <= selfM) { out.push({ id: pid, lat: p.pos.lat, lng: p.pos.lng, kind: 'foe' }); continue; }
      /* Durbin: 15 s vidiš igrače u konusu ±25° u pravcu u kom držiš telefon.
         Stari durbin je dizao samo vid za PREDMETE (15 → 20 m) i bio najslabiji
         „retko" u igri; ovaj traži da staneš i da pogodiš pravac. */
      const scope = R.ITEMS.binoculars;
      if ((me.scopeUntilMs || 0) > now && dist <= scope.scopeM && pos && Compass.heading != null
          && Math.abs(U.angleDiff(Compass.heading, U.bearing(pos, p.pos))) <= scope.scopeConeDeg) {
        out.push({ id: pid, lat: p.pos.lat, lng: p.pos.lng, kind: 'foe' }); continue;
      }
      if (cls.playerVisionM && dist <= cls.playerVisionM) out.push({ id: pid, lat: p.pos.lat, lng: p.pos.lng, kind: 'foe' });
    }
    return out;
  }

  /* ═══════════════ puna mapa arene ═══════════════
     Donje dugme "Mapa" i gornje "Centriraj" su ranije radili istu stvar. Sada
     gornje vraća pogled na tebe, a ovo otvara pregled CELE arene: granica,
     zona koja se skuplja, kornukopija i sve što ti je vidljivo. */
  let amap = null;
  function arenaMapSheet(d, opts) {
    opts = opts || {};
    const cfg = d.cfg || Store.config();
    if (!cfg || !cfg.center) { toast(T('needCenter'), 'gold', 'map'); return; }
    const s = sheet(opts.banner ? T('yourEvent') : T('arenaMap'), `
      ${opts.banner ? `<div class="event-banner">${icon('spark', { size: 22 })}
        <span>${esc(opts.banner)}</span></div>` : ''}
      <div class="arena-map" id="arenaMapBox"></div>
      <div class="row-tight wrap" style="margin-top:var(--s3)" id="arenaMapLegend"></div>`,
      { onClose: () => { amap = null; if (gmap) gmap.drawFog(); } });

    amap = makeMap('arenaMapBox', { zoom: 15, noFog: true });
    amap.setFull(true);
    amap.setFollow(false);
    amap.fitArena(cfg);
    amap.drawZone(d.zone || { center: cfg.center, radiusM: cfg.diameterM / 2, shrinking: false }, cfg);
    amap.drawFire(d.firewall);
    amap.drawWasps(d.wasps);
    if (Geo.pos) amap.setMe(Geo.pos, Compass.heading);
    amap.drawPlayers(visiblePlayers(d, true));
    amap.drawItems(Items.visible(d), null);
    setTimeout(() => {
      if (!amap) return;
      amap.refresh();
      // kad je otvorena zbog događaja, pogled ide NA događaj, ne na celu arenu
      if (opts.focus) amap.map.setView([opts.focus.lat, opts.focus.lng], 17, { animate: false });
      else amap.fitArena(cfg);
    }, 80);

    // u testu je pun pregled arene i pravo mesto da zadaš kuda ideš
    if (App.TEST) {
      amap.map.on('click', (e) => {
        TestWalk.goTo({ lat: e.latlng.lat, lng: e.latlng.lng });
        toast(T('tapToWalk'), 'gold', 'run');
      });
    }

    const key = (cls, label) => `<span class="chip"><i class="legend ${cls}"></i>${esc(label)}</span>`;
    $('#arenaMapLegend', s).innerHTML =
      key('me', T('you')) + key('foe', T('tributes')) + key('zone', T('zonePhase'))
      + key('corn', T('modeCornucopia'))
      + (App.TEST ? `<span class="chip gold">${esc(T('testWalk'))}</span>` : '');
  }

  /* ═══════════════ kompasna traka ═══════════════
     Crtice na svakih 5°, veće na 15°, strane sveta na 45°. Vidno polje 120°.

     Traka se crta JEDNOM, kao pojas od dva puna kruga, pa se na svaki događaj
     kompasa (desetine puta u sekundi) samo pomera preko `translateX`. Ranije
     se ceo `innerHTML` prepisivao iz otkucaja motora — jednom u sekundi — pa
     je traka skakala umesto da klizi.

     Oznake (zona, saveznici, startna tačka) su u zasebnom sloju koji se NE
     pomera: one se računaju iz razlike uglova i osvežavaju na otkucaj. */
  const CARD_SR = ['S', 'SI', 'I', 'JI', 'J', 'JZ', 'Z', 'SZ'];
  const CARD_EN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const FOV = 120;
  let compassKey = null, compassPpd = 0, compassW = 0, compassWired = false;

  /** Pojas se prostire od −180° do 540°, pa nikad ne dolazi do preloma. */
  function buildCompass() {
    const c = $('#compass');
    const w = c.clientWidth || 340;
    const key = `${w}|${LANG}`;
    if (compassKey === key) return;
    compassKey = key; compassW = w; compassPpd = w / FOV;
    const CARD = LANG === 'en' ? CARD_EN : CARD_SR;
    const out = [];
    for (let a = -180; a <= 540; a += 5) {
      const norm = ((a % 360) + 360) % 360;
      const x = (a + 180) * compassPpd;
      const major = norm % 45 === 0, mid = norm % 15 === 0;
      out.push(`<i class="tk ${major ? 'major' : mid ? 'mid' : 'minor'}" style="left:${x}px"></i>`);
      if (major) out.push(`<span class="cd" style="left:${x}px">${CARD[norm / 45]}</span>`);
    }
    const ticks = $('#compassTicks');
    ticks.style.width = (720 * compassPpd) + 'px';
    ticks.innerHTML = out.join('');
    placeCompass(Compass.heading);
  }

  /** Jedina stvar koja se dešava na svaki događaj kompasa. */
  function placeCompass(h) {
    const strip = $('#compassStrip');
    if (!strip || h == null || !compassPpd) return;
    strip.style.transform = `translateX(${compassW / 2 - (h + 180) * compassPpd}px)`;
  }

  /* Smer ka najbližem živom protivniku, zamrznut na 30 s.
     Da se računa svaki otkucaj, strelica bi treperila i pretvorila se u
     radar; ovako je snimak star do pola minuta — dovoljno da te uputi, ne i
     da ti neko pobegne ispred nosa. */
  let nearestSnap = { atMs: 0, brg: null };
  function nearestBearing(d, pos) {
    const item = R.ITEMS.compassItem;
    if (d.now - nearestSnap.atMs < item.nearestRefreshMs) return nearestSnap.brg;
    let best = Infinity, brg = null;
    for (const [pid, p] of Object.entries(Store.players())) {
      if (pid === Store.myId || p.alive === false || !p.pos) continue;
      if (p.allianceId && p.allianceId === d.me.allianceId) continue;
      const m = U.dist(pos, p.pos);
      if (m < best) { best = m; brg = U.bearing(pos, p.pos); }
    }
    nearestSnap = { atMs: d.now, brg };
    return brg;
  }

  function renderCompass(d) {
    const c = $('#compass');
    const h = Compass.heading;
    if (h == null) {
      c.classList.add('compass-dead');
      $('#compassMarks').innerHTML = `<span class="dead-lbl">${esc(T('detNoCompass'))}</span>`;
      return;
    }
    c.classList.remove('compass-dead');
    if (!compassWired) { compassWired = true; Compass.on((hh) => placeCompass(hh)); }
    buildCompass();
    placeCompass(h);

    // oznake: zona kad si van nje, saveznici, startna tačka u pripremi
    const half = FOV / 2 + 6;
    const pos = Geo.pos;
    const out = [];
    const mark = (brg, color, name) => {
      const off = U.angleDiff(h, brg);
      if (Math.abs(off) > half) return;
      out.push(`<span class="mk" style="left:${compassW / 2 + off * compassPpd}px;color:${color}">${icon(name, { size: 14 })}</span>`);
    };
    const isGhost = !!(d.me && d.me.alive === false);
    // živog zona vuče unutra; duh se ne kažnjava pa mu taj marker samo smeta
    if (pos && d.zone && d.outsideZone && !isGhost) mark(U.bearing(pos, d.zone.center), 'var(--danger)', 'target');
    /* Duhu strelica ka najbližoj iskri — bez nje, dok je unutar zone, nema
       nijedan trag kuda treba da ide. */
    if (pos && isGhost) {
      const near = (d._sparks || Items.sparks(d))[0];
      if (near) mark(U.bearing(pos, near), 'var(--gold)', 'spark');
    }
    if (pos && d.me && d.state === 'PREP' && d.me.startPos) mark(U.bearing(pos, d.me.startPos), 'var(--gold)', 'pin');
    /* Kompas tributa: strelica ka najbližem igraču, BEZ razdaljine, i osvežava
       se tek na 30 s. Namerno je grub — daje ti pravac, ne rešenje. */
    if (pos && d.me && (d.me.nearestArrowUntilMs || 0) > d.now) {
      const brg = nearestBearing(d, pos);
      if (brg != null) mark(brg, 'var(--gold)', 'navigation');
    }
    if (pos && d.me) {
      for (const [pid, p] of Object.entries(Store.players())) {
        if (pid === Store.myId || !p.pos || p.alive === false) continue;
        if (!(p.allianceId && p.allianceId === d.me.allianceId)) continue;
        mark(U.bearing(pos, p.pos), 'var(--ally)', 'user');
      }
    }
    $('#compassMarks').innerHTML = out.join('');
  }

  /* ═══════════════ inventar ═══════════════ */
  function inventorySheet() {
    const me = Store.me();
    const list = Items.inv(me);
    const slots = R.slotsOf(me);
    const cells = [];
    for (let i = 0; i < slots; i++) {
      const s = list[i];
      if (!s) { cells.push(`<div class="inv-slot empty"><span class="dim tiny">${esc(T('emptySlot'))}</span></div>`); continue; }
      const def = R.ITEMS[s.itemType];
      cells.push(`<button class="inv-slot has rar-${def.rarity}" data-i="${i}">
        ${icon(ITEM_ICON[s.itemType] || 'box', { size: 30 })}
        <div class="nm">${esc(itemName(s.itemType))}</div>
        ${(s.qty || 1) > 1 ? `<div class="qty">${s.qty}</div>` : ''}</button>`);
    }
    const w = R.WEAPONS[me.weapon] || R.WEAPONS.fists;
    const own = R.ownsWeapon(me);
    const s = sheet(T('inventory'), `
      <div class="weapon-slot">
        <span class="goldc">${icon(WEAPON_ICON[me.weapon] || 'hand', { size: 32 })}</span>
        <div class="grow"><div class="big" style="font-weight:800">${esc(weaponName(me.weapon))}${own ? ' +8' : ''}</div>
          <div class="tiny dim">${w.dmg + (own ? 8 : 0)} ${esc(T('statDamage')).toLowerCase()} · ${esc(T('distance'))} ${w.min}–${w.max}</div></div>
        ${w.ammo ? `<div class="chip gold">${icon('arrows', { size: 14 })}${me.arrows || 0}</div>` : ''}
      </div>
      <div class="inv-grid" style="margin-top:var(--s4)">${cells.join('')}</div>`);
    $$('.inv-slot.has', s).forEach((b) => b.onclick = () => {
      const i = +b.dataset.i;
      const it = list[i], def = R.ITEMS[it.itemType];
      const m = modal(`
        <div class="center stack">
          <div class="rar-${def.rarity}" style="color:var(--rc)">${icon(ITEM_ICON[it.itemType] || 'box', { size: 46 })}</div>
          <h3>${esc(itemName(it.itemType))}</h3>
          <div class="chip rar-${def.rarity}" style="color:var(--rc);border-color:var(--rc)">${esc(rarityName(def.rarity))}</div>
          <button class="btn primary lg full" id="iUse" style="margin-top:var(--s4)">${esc(def.trap ? T('setTrap') : T('useItem'))}</button>
          <button class="btn ghost full" id="iDrop">${esc(T('dropItem'))}</button>
        </div>`);
      $('#iUse', m).onclick = async () => { m.close(); s.close(); await Items.use(i); };
      $('#iDrop', m).onclick = async () => { m.close(); s.close(); await Items.drop(i); };
    });
  }

  /* ═══════════════ spisak igrača ═══════════════ */
  function playersSheet() {
    const me = Store.me() || {};
    const P = Store.players();
    const rows = Object.entries(P).sort((a, b) => (a[1].alive === false) - (b[1].alive === false))
      .map(([pid, p]) => {
        const ally = p.allianceId && p.allianceId === me.allianceId;
        const kind = pid === Store.myId ? 'me' : ally ? 'ally' : 'foe';
        return `<div class="list-item ${p.alive === false ? 'dead' : ''}">
          <span class="avatar ${p.alive === false ? '' : kind}" style="display:block">${avatarSvg(p.avatar, 34)}</span>
          <div class="grow"><div class="name">${esc(p.name)}${pid === Store.myId ? ' · ' + esc(T('you')) : ''}</div>
            <div class="tiny mute">${p.alive === false ? esc(T('youDied')) + (p.place ? ' · ' + p.place + '.' : '')
              : (p.classId && pid === Store.myId ? esc(clsName(p.classId)) : esc(T('unknown')))}</div></div>
          ${p.alive === false ? icon('skull', { size: 16 }) : `<span class="chip ${kind === 'ally' ? 'good' : ''}">${p.kills || 0} ${icon('skull', { size: 11 })}</span>`}
        </div>`;
      }).join('');
    sheet(`${T('tributes')} · ${Store.alive().length}/${Object.keys(P).length}`, `<div class="list">${rows}</div>`);
  }

  /* ═══════════════ objave ═══════════════ */
  /** Objave su rečenice, ne šifre. Ranije je pisalo "prep", "zona", "kosta -". */
  function feedText(f) {
    const P = Store.players();
    const nm = (id) => (P[id] ? P[id].name : T('unknown'));
    switch (f.type) {
      case 'death':
        if (f.killerId) return T('fDeathBy', nm(f.subjectId), nm(f.killerId));
        return T({ zone: 'fDeathZone', hunger: 'fDeathHunger', thirst: 'fDeathThirst', fire: 'fDeathFire', trap: 'fDeathTrap' }[f.cause] || 'fDeathZone', nm(f.subjectId));
      case 'prep': return T('fPrep');
      case 'start': return T('fStart');
      case 'finalTwo': return T('fFinalTwo');
      case 'end': return f.subjectId ? T('fWinner', nm(f.subjectId)) : T('gameOver');
      case 'legendary': return T('fLegend');
      case 'betrayal': return T('fBetray', nm(f.subjectId), nm(f.targetId));
      case 'alliance': return T('fAlliance');
      case 'package': return T('fPackage');
      case 'shot': return T('fShot', nm(f.subjectId), nm(f.targetId), f.hit);
      case 'special': return T('fSpecial', nm(f.subjectId), specialName(f.special));
      case 'event': return f.eventType === 'feast' ? T('fFeast') : T('fEvent', eventName(f.eventType));
      case 'zone': return T('fZone', f.phase || '', f.diameter || '');
      case 'alarm': return T('fAlarm');
      default: return f.text || '';
    }
  }
  const feedIcon = (f) => ({
    death: 'skull', start: 'flame', prep: 'clock', finalTwo: 'users', end: 'trophy',
    legendary: 'box', betrayal: 'knife', alliance: 'handshake', package: 'gift',
    shot: 'bow', event: 'spark', zone: 'target', alarm: 'bell',
  }[f.type] || 'scroll');
  function feedSheet() {
    const me = Store.me();
    const ghost = me && me.alive === false;
    const list = Object.entries(Store.feed())
      .map(([id, f]) => ({ id, ...f }))
      .filter((f) => f.scope !== 'ghosts' || ghost)
      .filter((f) => f.scope !== 'self' || f.subjectId === Store.myId)
      .sort((a, b) => b.atMs - a.atMs).slice(0, 60);
    const t0 = Store.meta().startedAtMs || 0;
    sheet(T('feed'), `<div>${list.map((f) => `
      <div class="feed-item ${f.type === 'death' ? 'death' : f.type === 'zone' ? 'zone' : 'event'}">
        <span class="fic">${icon(feedIcon(f), { size: 16 })}</span>
        <span class="ft">${esc(feedText(f))}</span>
        <span class="fw">${t0 ? U.mmss(Math.max(0, (f.atMs - t0) / 1000)) : ''}</span>
      </div>`).join('') || `<p class="dim center">—</p>`}</div>`);
  }

  /* ═══════════════ podešavanja ═══════════════ */
  let verTaps = 0;
  function renderSettings() {
    const inGame = Store.room && Store.state() !== 'LOBBY' && Store.state() !== 'END';
    const host = Store.isHost();
    const paused = !!Store.meta().pausedAtMs;
    const dev = devMode();
    const p = permState();
    const permsOk = p.location && p.camera;

    const row = (id, ic, label, val, extra) => `
      <button class="rowitem" id="${id}">${icon(ic, { size: 20 })}
        <span class="lbl">${esc(label)}</span>
        ${val ? `<span class="val">${esc(val)}</span>` : ''}
        ${extra || icon('chevronRight', { size: 16 })}</button>`;

    $('#settingsBody').innerHTML = `
      <div>
        <div class="card-title">${esc(T('appearance'))}</div>
        <div class="rows">
          <div class="rowitem">${icon('sun', { size: 20 })}<span class="lbl">${esc(T('theme'))}</span>
            <div class="seg" style="width:170px" id="setTheme">
              <button data-v="night" class="${Theme.get() !== 'day' ? 'on' : ''}">${esc(T('nightMode'))}</button>
              <button data-v="day" class="${Theme.get() === 'day' ? 'on' : ''}">${esc(T('dayMode'))}</button>
            </div></div>
          <div class="rowitem">${icon('scroll', { size: 20 })}<span class="lbl">${esc(T('language'))}</span>
            <div class="seg" style="width:130px" id="setLang">
              <button data-v="sr" class="${LANG === 'sr' ? 'on' : ''}">SR</button>
              <button data-v="en" class="${LANG === 'en' ? 'on' : ''}">EN</button>
            </div></div>
        </div>
      </div>

      <div>
        <div class="card-title">${esc(T('soundVibe'))}</div>
        <div class="rows">
          <label class="rowitem">${icon('bell', { size: 20 })}<span class="lbl">${esc(T('haptics'))}</span>
            <span class="switch"><input type="checkbox" id="setHap" ${Haptics.enabled ? 'checked' : ''}><span class="track"><span class="knob"></span></span></span></label>
          <label class="rowitem">${icon('flame', { size: 20 })}<span class="lbl">${esc(T('sound'))}</span>
            <span class="switch"><input type="checkbox" id="setSfx" ${Sfx.enabled ? 'checked' : ''}><span class="track"><span class="knob"></span></span></span></label>
        </div>
      </div>

      <div>
        <div class="card-title">${esc(T('yourTribute'))}</div>
        <div class="rows">
          ${row('setAvatar', 'user', T('avatarTitle'))}
          ${row('setPerms', 'pin', T('checkPerms'), permsOk ? T('granted') : T('denied'))}
        </div>
      </div>

      ${inGame ? `<div>
        <div class="card-title">${esc(T('game'))}</div>
        <div class="rows">
          ${row('setMentor', 'users', T('mentorLink'))}
          ${host ? row('setPause', paused ? 'play' : 'pause', paused ? T('resumeGame') : T('pauseGame')) : ''}
          <button class="rowitem" id="setQuit">${icon('alert', { size: 20 })}
            <span class="lbl" style="color:var(--danger)">${esc(T('quitGame'))}</span></button>
        </div></div>` : ''}

      ${dev || App.TEST ? `<div>
        <div class="card-title">${esc(T('devOptions'))}</div>
        <div class="rows">
          ${row('setTest', 'target', T('testPanel'))}
          ${row('setBots', 'settings', T('testWithBots'))}
          ${row('setDiag', 'compass', T('diagnostics'))}
          ${row('setDevOff', 'x', T('devOff'))}
        </div></div>` : ''}

      <div>
        <div class="card-title">${esc(T('about'))}</div>
        <div class="rows">
          <button class="rowitem" id="setVer">${icon('trophy', { size: 20 })}
            <span class="lbl">${esc(T('version'))}</span><span class="val">${APP_VERSION}</span></button>
          <div class="rowitem"><span class="lbl tiny mute" style="font-weight:400">${esc(T('mapCredit'))}</span></div>
        </div>
      </div>`;

    segInit($('#setTheme')); segInit($('#setLang'));
    // Tema se menja bez ponovnog iscrtavanja — pločica ima šta da otklizi.
    $$('#setTheme button').forEach((b) => b.onclick = () => { Theme.set(b.dataset.v); segPick($('#setTheme'), b.dataset.v); });
    // Jezik menja sav tekst, pa se ekran iscrtava tek kad pločica stigne.
    $$('#setLang button').forEach((b) => b.onclick = () => segPick($('#setLang'), b.dataset.v, () => {
      setLang(b.dataset.v); applyLang(); renderSettings();
    }));
    $('#setHap').onchange = (e) => Haptics.setEnabled(e.target.checked);
    $('#setSfx').onchange = (e) => { Sfx.setEnabled(e.target.checked); Sfx.unlock(); };
    $('#setAvatar').onclick = () => avatarBuilder();
    $('#setPerms').onclick = () => App.checkPerms();
    const mm = $('#setMentor'); if (mm) mm.onclick = () => mentorLinkSheet(Store.myId);
    const pp = $('#setPause'); if (pp) pp.onclick = () => { Store.hostUpdate('meta', { pausedAtMs: paused ? null : Clock.now() }); renderSettings(); };
    const qq = $('#setQuit'); if (qq) qq.onclick = async () => { if (await confirmBox(T('quitConfirm'), T('quitGame'), true)) { Engine.die('quit'); App.route(); } };
    const tp = $('#setTest'); if (tp) tp.onclick = () => testSheet();
    const bb = $('#setBots'); if (bb) bb.onclick = () => App.askBotCount();
    const dd = $('#setDiag'); if (dd) dd.onclick = () => { location.href = 'diag.html'; };
    const off = $('#setDevOff'); if (off) off.onclick = () => { localStorage.removeItem('arena.dev'); renderSettings(); UI.initHome(App.TEST); };
    // Razvojne opcije se otključavaju sa sedam tapova na verziju — kao na telefonu.
    $('#setVer').onclick = () => {
      if (devMode()) return;
      if (++verTaps >= 7) { localStorage.setItem('arena.dev', '1'); verTaps = 0; Haptics.fire('pickup'); toast(T('devOn'), 'good', 'settings'); renderSettings(); UI.initHome(App.TEST); }
      else if (verTaps >= 4) toast(`${7 - verTaps}`, '', 'settings');
    };
  }

  /* ═══════════════ test panel ═══════════════
     Bez ovoga se svaka sitnica isprobava tako što napraviš partiju, sačekaš
     da te bot nađe, pogine ti lik, pa iznova. Vidi se samo u test režimu ili
     kad su uključene razvojne opcije. */
  function testSheet() {
    const s = sheet(T('testPanel'), '<div id="tpBody"></div>');
    draw();
    function draw() {
      const me = Store.me() || {};
      const bots = Object.entries(Store.players()).filter(([, p]) => p.isBot);
      const aliveBots = bots.filter(([, p]) => p.alive !== false);
      $('#tpBody', s).innerHTML = `
        <div class="card stack">
          <div class="card-title">${esc(T('tpBots'))} · ${aliveBots.length}/${bots.length}</div>
          <label class="switch"><span>${esc(T('tpFreeze'))}</span>
            <input type="checkbox" id="tpFrozen" ${Bots.frozen ? 'checked' : ''}><span class="track"><span class="knob"></span></span></label>
          <label class="switch"><span>${esc(T('tpPassive'))}</span>
            <input type="checkbox" id="tpPassive" ${Bots.passive ? 'checked' : ''}><span class="track"><span class="knob"></span></span></label>
          <div class="row-tight wrap">
            ${aliveBots.map(([pid, p]) => `<button class="btn sm ghost" data-bring="${pid}">
              ${icon('run', { size: 14 })}<span>${esc(p.name)}</span></button>`).join('') || `<p class="dim tiny">${esc(T('nobody'))}</p>`}
          </div>
          <p class="tiny dim">${esc(T('tpBringHint'))}</p>
        </div>

        <div class="card stack">
          <div class="card-title">${esc(T('tpMe'))}</div>
          <div class="row-tight wrap">
            <button class="btn sm ghost" id="tpHeal">${icon('heart', { size: 14 })}<span>${esc(T('tpFullHp'))}</span></button>
            <button class="btn sm ghost" id="tpRevive">${icon('refresh', { size: 14 })}<span>${esc(T('tpRevive'))}</span></button>
            <button class="btn sm ghost" id="tpSpecial">${icon('spark', { size: 14 })}<span>${esc(T('tpResetSpecial'))}</span></button>
            <button class="btn sm ghost" id="tpCd">${icon('clock', { size: 14 })}<span>${esc(T('tpClearCd'))}</span></button>
          </div>
        </div>

        <div class="card stack">
          <div class="card-title">${esc(T('tpWeapon'))}</div>
          <div class="row-tight wrap">
            ${Object.keys(R.WEAPONS).map((id) => `<button class="btn sm ${me.weapon === id ? 'gold' : 'ghost'}" data-w="${id}">
              ${icon(WEAPON_ICON[id] || 'hand', { size: 14 })}<span>${esc(weaponName(id))}</span>
              <span class="dim">${R.WEAPONS[id].minM}–${R.WEAPONS[id].maxM}</span></button>`).join('')}
          </div>
        </div>`;

      $('#tpFrozen', s).onchange = (e) => Bots.setFrozen(e.target.checked);
      $('#tpPassive', s).onchange = (e) => Bots.setPassive(e.target.checked);
      $$('[data-bring]', s).forEach((b) => b.onclick = async () => {
        const ok = await Bots.bring(b.dataset.bring, 2);
        toast(ok ? T('tpBrought') : T('gpsGoOutside'), ok ? 'good' : 'danger', 'run');
      });
      $('#tpHeal', s).onclick = async () => { await Store.updateMe({ hp: me.maxHp || 100 }); toast(T('tpFullHp'), 'good', 'heart'); draw(); };
      $('#tpRevive', s).onclick = async () => {
        await Store.updateMe({ alive: true, hp: me.maxHp || 100, deathAtMs: null, killedBy: null });
        toast(T('tpRevive'), 'good', 'refresh'); App.route(); draw();
      };
      $('#tpSpecial', s).onclick = async () => { await Store.updateMe({ specialUsedThisGame: null }); toast(T('tpResetSpecial'), 'good', 'spark'); draw(); };
      $('#tpCd', s).onclick = async () => {
        await Store.updateMe({ weaponCooldownUntilMs: null, entangledUntilMs: null, poisonUntilMs: null });
        toast(T('tpClearCd'), 'good', 'clock'); draw();
      };
      $$('[data-w]', s).forEach((b) => b.onclick = async () => {
        await Store.updateMe({ weapon: b.dataset.w, arrows: 30 });
        toast(weaponName(b.dataset.w), 'good', WEAPON_ICON[b.dataset.w]); draw();
      });
    }
  }

  /* ═══════════════ NIŠANJENJE (borba v4) ═══════════════
     Jedini način napada, i najvažniji ekran u igri.

     Radi u dva sloja:
     · petlja uživo (4×/s) — konus po kompasu bira cilj, pa se osvežavaju nišan,
       brojka razdaljine i traka opsega. Ovo NE traži sliku.
     · držanje dugmeta — tek tada se uslika kadar, proveri da li u njemu ima
       osobe, i pokrene nišanjenje koje traje onoliko koliko oružje traži. */
  let aimTick = null, aimHandle = null, aimTargetId = null, aimBusy = false;

  function openAim() {
    const d = Engine.d;
    if (!d.me || d.me.alive === false) { Screens.go('ghost'); renderGhost(d); return; }
    Screens.go('aim');
    aimTargetId = null; aimBusy = false;

    $('#aimBack').innerHTML = icon('chevronLeft', { size: 22 });
    $('#aimBack').onclick = () => closeAim();

    Encounter.openCamera($('#aimVid'), 'environment')
      .catch(() => { toast(T('denied'), 'danger'); closeAim(); });
    Encounter.loadDetector();

    wireFire();
    drawAim();
    clearInterval(aimTick);
    aimTick = setInterval(drawAim, 250);
  }

  function closeAim() {
    clearInterval(aimTick); aimTick = null;
    if (aimHandle) { aimHandle.cancel(); aimHandle = null; }
    const f = $('#s-aim .aim-flash');
    if (f) f.remove();                       // da ne dočeka sledeće otvaranje
    setAimRing(0);
    Encounter.stop();
    Screens.go('game');
  }

  /* — petlja uživo — */
  function drawAim() {
    const d = Engine.d;
    if (!d.me) return;
    if (d.me.alive === false) { closeAim(); return; }

    const me = d.me;
    const w = R.weaponOf(me);
    const { list, noHeading } = Encounter.candidatesInCone(d);

    // cilj je onaj najbliži sredini nišana; ostaje izabran dok je u konusu
    let target = list.find((c) => c.pid === aimTargetId) || list[0] || null;
    aimTargetId = target ? target.pid : null;

    $('#aimWeapon').innerHTML =
      `${icon(WEAPON_ICON[me.weapon] || 'hand', { size: 15 })}<span>${esc(weaponName(me.weapon))}</span>`
      + `<span class="dim"> ${w.minM}–${w.maxM} m</span>`;

    // stanje senzora — bez ovoga ne znaš zašto te ne pušta da opališ
    const st = Encounter.detectorState;
    const det = st === 'ready' ? ['good', T('detReady')] : st === 'failed' ? ['danger', T('detOff')] : ['gold', T('detLoading')];
    const h = Compass.heading;
    const comp = h == null ? ['danger', T('detNoCompass')] : ['good', `${Math.round(h)}°`];
    const acc = Geo.accuracy;
    const gps = acc == null ? ['danger', 'GPS —'] : acc <= R.MIN_ACC_M ? ['good', `±${Math.round(acc)} m`] : ['danger', `±${Math.round(acc)} m`];
    $('#aimStatus').innerHTML = [det, comp, gps].map(([c, t]) => `<span class="chip ${c}">${esc(t)}</span>`).join('');

    const state = target ? R.rangeState(w, target.distM) : null;
    $('#aimReticle').className = 'aim-reticle' + (state ? ' ' + state : '');

    // ko je na nišanu
    if (!target) {
      $('#aimLock').innerHTML = `<div class="sub">${esc(noHeading ? T('detNoCompass') : T('photoNoneInCone'))}</div>`;
    } else {
      $('#aimLock').innerHTML = `
        <div class="nm">${esc(target.p.name)}</div>
        <div class="dist ${state}">${Math.round(target.distM)}<u> m</u></div>
        ${target.ally ? `<div class="ally">${icon('handshake', { size: 14 })} ${esc(T('isAlly'))}</div>`
          : `<div class="sub">${esc(state === 'in' ? T('rangeIn') : state === 'close' ? T('rangeClose') : T('rangeFar'))}</div>`}`;
    }

    drawRangeBar(w, target ? target.distM : null);

    // ostali u konusu — tap bira drugog
    $('#aimList').innerHTML = list.slice(0, 5).map((c) => `
      <button class="aim-cand ${c.pid === aimTargetId ? 'on' : ''}" data-pid="${c.pid}">
        ${esc(c.p.name)} · ${Math.round(c.distM)} m</button>`).join('');
    $$('#aimList .aim-cand').forEach((b) => b.onclick = () => { aimTargetId = b.dataset.pid; drawAim(); });

    updateFire(d, target, state);
    drawExtra(d, target);
  }

  /** Traka opsega: žuto preblizu, zeleno u dometu, crveno predaleko. */
  function drawRangeBar(w, distM) {
    const scale = Math.max(w.maxM * 1.35, 12);
    const pct = (m) => U.clamp((m / scale) * 100, 0, 100);
    const a = pct(w.minM), b = pct(w.maxM);
    const marker = distM == null ? null : pct(distM);
    $('#aimRange').innerHTML = `
      <div class="rb">
        ${a > 0 ? `<i class="z close" style="left:0;width:${a}%"></i>` : ''}
        <i class="z in" style="left:${a}%;width:${b - a}%"></i>
        <i class="z far" style="left:${b}%;width:${100 - b}%"></i>
      </div>
      ${marker != null ? `<b class="marker" style="left:${marker}%"></b>` : ''}
      ${w.minM > 0 ? `<span class="tick" style="left:${a}%">${w.minM} m</span>` : ''}
      <span class="tick" style="left:${b}%">${w.maxM} m</span>`;
  }

  /* — okidač: natpis i stanje, čvor se NE pravi iznova — */
  const RING_LEN = 2 * Math.PI * 45;
  function setAimRing(p) {
    const fg = $('#aimFire .ring .fg');
    if (fg) fg.style.strokeDashoffset = RING_LEN * (1 - U.clamp(p, 0, 1));
  }

  function updateFire(d, target, state) {
    const btn = $('#aimFire');
    const cd = Attack.cooldownLeft(d);
    const why = target ? Attack.blockedReason(d, target.p) : 'nocone';
    const can = !!target && state !== 'far' && !why && !aimBusy;
    const w = R.weaponOf(d.me);

    // Dugme se NE gasi dok traje držanje — gašenje usred pritiska ume da
    // prekine niz pointer događaja, pa nišanjenje pukne bez razloga.
    if (!aimBusy) btn.disabled = !can;
    const secs = (w.aimMs / 1000).toFixed(w.aimMs % 1000 ? 1 : 0);
    const lbl = $('.lbl', btn);
    lbl.innerHTML = `${esc(T('aimHoldBtn'))}<br><b style="font-size:var(--fs-lg)">${secs} s</b>`;
    lbl.style.visibility = cd > 0 ? 'hidden' : '';      // ispod odbrojavanja se ne cita
    const cdEl = $('.cd', btn);
    cdEl.hidden = cd <= 0;
    if (cd > 0) cdEl.textContent = Math.ceil(cd) + ' s';

    $('#aimHint').textContent = !target ? ''
      : why ? blockedText(why)
      : state === 'far' ? T('rangeFarHint')
      : state === 'close' ? T('rangeCloseHint')
      : target.ally ? T('allyHint') : '';
  }

  function blockedText(why) {
    return ({
      dead: T('targetDead'), grace: T('blockGrace'), zone: T('blockZone'),
      gps: T('blockGps'), gpsTarget: T('blockGpsTarget'), stale: T('blockStale'),
      cooldown: T('blockCooldown'), entangled: T('blockEntangled'),
      netted: T('blockNetted'), smoke: T('blockSmoke'), smokeTarget: T('blockSmokeTarget'),
      ammo: T('noArrows'), nocone: T('photoNoneInCone'),
    })[why] || T('aimBlocked');
  }

  /** Savez i specijal — bočna dugmad. Savez se nudi samo izbliza (10 m). */
  function drawExtra(d, target) {
    const me = d.me;

    const ab = $('#aimAlly');
    const canAlly = !!target && !target.ally;
    ab.classList.toggle('off', !canAlly);
    if (canAlly) {
      const near = target.distM <= R.ALLY_OFFER_M;
      ab.disabled = !near;
      ab.className = 'aim-side ally';
      ab.innerHTML = `${icon('handshake', { size: 20 })}<span>${esc(T('actAlliance'))}</span>`
        + (near ? '' : `<span class="dim">${R.ALLY_OFFER_M} m</span>`);
      ab.onclick = () => Encounter.proposeAlliance(target.pid);
    }

    const sb = $('#aimSpecial');
    const sp = R.SPECIALS[me.classId];
    const showSp = !!sp && !me.specialUsedThisGame;
    sb.classList.toggle('off', !showSp);
    if (showSp) {
      const why = Attack.specialBlocked(d, target && target.pid, target && target.distM);
      sb.disabled = !!why;
      sb.className = 'aim-side special';
      sb.innerHTML = `${icon('spark', { size: 20 })}<span>${esc(specialName(sp.id))}</span>`;
      sb.onclick = () => fireSpecial(target);
    }
  }

  async function fireSpecial(target) {
    if (aimBusy) return;
    aimBusy = true;
    const d = Engine.d;
    const sp = R.SPECIALS[d.me.classId];
    try {
      // Strelčev precizan hitac se i dalje nišani, samo duže
      let photo = null;
      if (sp.maxM != null && target) {
        const conf = await confirmTarget(target);
        if (!conf.ok) { toast(confirmText(conf), 'danger', 'alert'); return; }
        photo = conf.thumb || conf.photo;
        if (sp.aimMs) {
          const held = await holdAim(target.pid, { aimMs: sp.aimMs, warns: sp.warns });
          if (!held || held.reason === 'cancelled') return;
          if (held.miss) { showMiss(held.reason); return; }
        }
      }
      const res = await Attack.special(d, target && target.pid, target && target.distM, { photo });
      if (!res.ok) { toast(blockedText(res.reason), 'danger', 'alert'); return; }
      if (res.kind === 'hit') showHit(res.res.dmg, res.out && res.out.killed);
      else { toast(specialName(sp.id), 'good', 'spark'); Haptics.fire('pickup'); }
    } finally { aimBusy = false; drawAim(); }
  }

  /* Detekcija osobe u kadru je filter protiv gadjanja kroz zid. Bot ne postoji
     u stvarnom svetu, pa ga kamera nikad nece videti — u testu bi to znacilo da
     se nijedan napad ne moze isprobati. Zato se filter preskace SAMO za botove
     i SAMO u test rezimu. */
  function confirmTarget(target) {
    const isBot = !!(Store.players()[target.pid] || {}).isBot;
    if (App.TEST && isBot) return Promise.resolve({ ok: true, photo: null, skipped: true });
    return Encounter.confirmPerson($('#aimCan'));
  }

  const confirmText = (c) => (c.reason === 'noperson' ? T('photoNoPerson')
    : c.reason === 'cooldown' ? `${T('photoCooldown')} ${c.waitS} s` : T('denied'));

  /** Drži dugme; otpuštanje pre vremena prekida. */
  function holdAim(targetId, opts) {
    return new Promise((res) => {
      const btn = $('#aimFire');
      btn.classList.add('holding');
      Haptics.fire('tap');
      aimHandle = Encounter.startAim(Engine.d, targetId, {
        ...opts,
        onProgress: setAimRing,
      });
      const done = (r) => {
        btn.classList.remove('holding');
        setAimRing(0);
        aimHandle = null;
        res(r);
      };
      aimHandle.promise.then(done);
      const release = () => { if (aimHandle) aimHandle.cancel(); };
      btn.addEventListener('pointerup', release, { once: true });
      btn.addEventListener('pointercancel', release, { once: true });
      btn.addEventListener('pointerleave', release, { once: true });
    });
  }

  function wireFire() {
    const btn = $('#aimFire');
    btn.onpointerdown = async (e) => {
      e.preventDefault();
      if (aimBusy || btn.disabled) return;
      const d = Engine.d;
      const { list } = Encounter.candidatesInCone(d);
      const target = list.find((c) => c.pid === aimTargetId) || list[0];
      if (!target) return;
      aimBusy = true;
      try {
        // saveznika se ne napada slučajno — prvo pitanje (§8)
        if (target.ally && !(await confirmBox(T('betrayAsk'), T('actBetray'), true))) return;

        const conf = await confirmTarget(target);
        if (!conf.ok) { toast(confirmText(conf), 'danger', 'alert'); Haptics.fire('alert'); return; }

        const held = await holdAim(target.pid, {});
        if (!held || held.reason === 'cancelled') { toast(T('aimReleased'), 'gold'); return; }
        if (held.miss) { showMiss(held.reason); return; }

        const me = Store.me();
        const res = R.attackDamage(me, held.distM, {
          betrayal: target.ally,
          nowMs: Clock.now(),
          // Blic-folija na meti obara snimak sa daljine; Stativ je probija
          targetFlashUntilMs: target.p && target.p.flashUntilMs,
        });
        const out = await Attack.land(d, target.pid, held.distM, res, { photo: conf.thumb || conf.photo });
        if (target.ally) {
          await Store.updateMe({ allianceId: null });
          await Store.pushFeed({ type: 'betrayal', subjectId: Store.myId, targetId: target.pid, scope: 'all' });
        }
        if (res.miss) showMiss(res.reason || 'close');
        else if (out && out.shielded) { flash(T('shieldBroke'), 'var(--gold)'); Haptics.fire('alert'); toast(T('shieldBroke'), 'gold', 'shield'); }
        else showHit(res.dmg, out && out.killed);
      } finally { aimBusy = false; drawAim(); }
    };
  }

  /* — ishod: broj štete preko ekrana, 1,5 s (§3) — */
  function showHit(dmg, killed) {
    flash(`−${dmg}`, 'var(--danger-hi)');
    Haptics.fire(killed ? 'death' : 'hit');
    Sfx.zap();
    if (killed) toast(T('youKilled'), 'good', 'skull');
  }
  function showMiss(reason) {
    flash(T('missed'), 'var(--text-2)');
    Haptics.fire('alert');
    const why = reason === 'dodged' ? T('missDodged') : reason === 'moved' ? T('missMoved')
      : reason === 'flash' ? T('missFlash') : T('missClose');
    toast(why, 'gold', reason === 'flash' ? 'sun' : 'alert');
  }
  /* Broj štete preko ekrana, 1,5 s (§3).

     Čvor se BRIŠE čim animacija prođe. Ako ostane u DOM-u sa klasom `go`,
     ekran nišanjenja ga pri sledećem otvaranju vraća iz `display:none` u
     vidljivo stanje — a tada se CSS animacija pokreće ponovo, pa ti isti
     „−10" iskače svaki put kad uđeš u kameru. */
  function flash(text, color) {
    const s = $('#s-aim');
    const old = $('.aim-flash', s);
    if (old) old.remove();
    const n = el('div', 'aim-flash', '<div class="n"></div>');
    const num = $('.n', n);
    num.textContent = text;
    num.style.color = color;
    s.appendChild(n);
    void n.offsetWidth;
    n.classList.add('go');
    n.addEventListener('animationend', () => n.remove(), { once: true });
    setTimeout(() => n.remove(), 2000);      // i ako animationend izostane
  }

  /* ═══════════════ nebo (§16) ═══════════════ */
  let skyShown = 0;
  async function showSky(atMs) {
    if (skyShown === atMs) return;
    skyShown = atMs;
    const P = Store.players();
    const since = atMs - 15 * 60000;
    const fallen = Object.entries(P).filter(([, p]) => p.alive === false && p.deathAtMs > since);
    const stars = $('#skyStars');
    stars.innerHTML = '';
    for (let i = 0; i < 60; i++) {
      const s = el('i');
      s.style.left = Math.random() * 100 + '%'; s.style.top = Math.random() * 100 + '%';
      s.style.animationDelay = -Math.random() * 3 + 's';
      stars.appendChild(s);
    }
    $('#skyFaces').innerHTML = fallen.length
      ? fallen.map(() => '').join('')
      : `<p class="dim">${esc(T('nobody'))}</p>`;
    Screens.go('sky');
    Sfx.anthem(); Haptics.fire('cannon');
    for (let i = 0; i < fallen.length; i++) {
      const [pid, p] = fallen[i];
      const face = await Store.loadFace(pid);
      const node = el('div', 'sky-face');
      node.style.animationDelay = i * 0.4 + 's';
      node.innerHTML = (face ? `<img src="${face}" alt="">` : `<div class="avatar" style="width:132px;height:132px">${avatarSvg(p.avatar, 132)}</div>`) +
        `<div class="nm">${esc(p.name)}</div>`;
      $('#skyFaces').appendChild(node);
    }
    setTimeout(() => { if (Screens.cur === 'sky') App.route(); }, 20000);
  }

  /* ═══════════════ duhovi = Tvorci igara (§16) ═══════════════ */
  function renderGhost(d) {
    const pool = (Store.sparks().pool) || 0;
    const P = Store.players();
    const aliveList = Object.entries(P).filter(([, p]) => p.alive !== false);
    const ghosts = Object.entries(P).filter(([, p]) => p.alive === false && !p.isBot).length;
    const lastEv = Store.meta().lastGmEventMs || 0;
    const cool = Math.max(0, (lastEv + R.GM_COOLDOWN_MS - d.now) / 1000);
    $('#sparkPool').innerHTML = `${icon('spark', { size: 24 })}<span>${pool}</span>`;

    /* Duhov teren je VAN zone. Dok je unutra ne može ništa da kupi — inače bi
       se isplatilo stajati usred žive igre i odatle bacati eventove. */
    const inZone = !!d.ghostInZone;

    $('#ghostBody').innerHTML = `
      ${inZone ? `<div class="card danger stack">
        <div class="row"><span class="dangerc">${icon('alert', { size: 22 })}</span>
          <p class="grow" style="margin:0;font-weight:700">${esc(T('ghostInZone'))}</p></div>
      </div>` : ''}
      <div class="card"><p style="margin:0">${esc(T('ghostBody'))}</p></div>
      <div class="card stack">
        <div class="card-title">${esc(T('buyEvent'))}</div>
        ${cool > 0 ? `<p class="tiny goldc">${esc(T('gmCooldown'))} · ${U.mmss(cool)}</p>` : ''}
        ${Object.entries(R.SPARK_COSTS).map(([type, cost]) => {
          const votes = Object.keys((Store.room.gmVotes || {})[type] || {}).length;
          const need = ghosts > 2 ? Math.ceil(ghosts / 2) : 1;
          return `<button class="gm-event" data-ev="${type}" ${pool >= cost && cool <= 0 && !inZone ? '' : 'disabled'}>
            ${icon(EVENT_ICON[type] || 'spark', { size: 26 })}
            <div class="grow" style="text-align:left"><div style="font-weight:700">${esc(eventName(type))}</div>
            ${ghosts > 2 ? `<div class="tiny dim">${votes}/${need} ${esc(T('voteNeeded'))}</div>` : ''}</div>
            <span class="cost">${icon('spark', { size: 16 })}${cost}</span></button>`;
        }).join('')}
      </div>
      <div class="card stack">
        <div class="card-title">${esc(T('allPlayers'))}</div>
        ${aliveList.map(([pid, p]) => {
          const followed = (d.me && d.me.following) === pid;
          return `<div class="list-item">
          <div class="avatar ${followed ? 'ring' : ''}" style="width:40px;height:40px">${avatarSvg(p.avatar, 40)}</div>
          <div class="grow"><div class="name">${esc(p.name)}</div>
            <div class="tiny dim">${esc(clsName(p.classId))} · ${esc(weaponName(p.weapon))}
              · ${icon('heart', { size: 11 })} ${Math.round(p.hp)}
              · ${Math.round(p.hunger || 0)} / ${Math.round(p.thirst || 0)}</div></div>
          <button class="btn sm ${followed ? 'gold' : 'ghost'}" data-follow="${pid}">
            ${icon('eye', { size: 16 })}<span>${esc(T('watchBtn'))}</span></button>
        </div>`; }).join('')}
      </div>
      <button class="btn ghost full" id="ghostMap">${icon('map', { size: 22 })}<span>${esc(T('map'))}</span></button>`;

    $$('#ghostBody .gm-event').forEach((b) => b.onclick = () => App.buyEvent(b.dataset.ev));
    $$('#ghostBody [data-follow]').forEach((b) => b.onclick = () => openWatch(b.dataset.follow));
    $('#ghostMap').onclick = () => Screens.go('game');
  }

  /* ═══════════════ GLEDANJE JEDNOG IGRAČA (duh) ═══════════════
     „Prati" je bio čekboks: upiše se `following` i ne desi se ništa. Ovo je
     pravo gledanje — mapa koja ide za njim, njegovo stanje, spisak njegovih
     udaraca, i kadar koji je snimio kad nekog pogodi. */
  let wmap = null, watchFollow = true, watchSeenHit = null, watchShotTimer = 0;

  function openWatch(pid) {
    Store.updateMe({ following: pid });
    watchSeenHit = null;                   // ne prikazuj stare kadrove pri ulasku
    Screens.go('watch');
    renderWatch(Engine.d);
  }
  function closeWatch() {
    clearTimeout(watchShotTimer);
    $('#watchShot').hidden = true;
    Screens.go('ghost');
    renderGhost(Engine.d);
  }

  function renderWatch(d) {
    const pid = (d.me || {}).following;
    const p = pid && Store.players()[pid];
    if (!p) { closeWatch(); return; }

    $('#watchTitle').textContent = p.name || '';
    $('#btnWatchBack').innerHTML = icon('chevronLeft', { size: 22 });
    $('#btnWatchBack').onclick = () => closeWatch();

    /* — mapa ide za njim, ne za mnom — */
    if (!wmap) {
      wmap = makeMap('watchMap', { zoom: 17, noFog: true });
      wmap.setFull(true);
      wmap.setFollow(false);               // ne juri MOJU poziciju
      watchFollow = true;
      wmap.map.on('dragstart', () => { watchFollow = false; });
      setTimeout(() => wmap && wmap.refresh(), 60);
    }
    if (p.pos) {
      wmap.drawPlayers([{ id: pid, lat: p.pos.lat, lng: p.pos.lng, kind: 'foe' }]);
      if (watchFollow) wmap.map.setView([p.pos.lat, p.pos.lng], wmap.map.getZoom(), { animate: true, duration: 0.4 });
    }
    if (d.zone) wmap.drawZone(d.zone, d.cfg);
    wmap.drawFire(d.firewall);
    wmap.drawWasps(d.wasps);

    /* — neko ga nišani: napetost pred udarac — */
    const aim = p.incomingAim;
    const aimOn = !!(aim && d.now - (aim.atMs || 0) < 12000);
    const ac = $('#watchAim');
    ac.hidden = !aimOn;
    if (aimOn) ac.innerHTML = `${icon('target', { size: 14 })}<span>${esc(T('watchAimed'))}</span>`;
    ac.className = 'chip danger';

    /* — njegova kartica — */
    const maxHp = p.maxHp || 100;
    const eff = R.activeEffects(p, d.now);
    const carrying = (p.inv || []).filter(Boolean).reduce((n, s) => n + (s.qty || 1), 0);

    $('#watchBody').innerHTML = `
      <div class="card stack">
        <div class="row">
          <div class="avatar ring" style="width:56px;height:56px">${avatarSvg(p.avatar, 56)}</div>
          <div class="grow">
            <div class="big" style="font-weight:800">${esc(p.name)}</div>
            <div class="tiny dim">${p.classId ? esc(clsName(p.classId)) : '—'} · ${esc(weaponName(p.weapon || 'fists'))}</div>
          </div>
          <div class="chip">${icon('backpack', { size: 14 })}${carrying}</div>
        </div>
        <div class="vitals">
          ${vitalBox('hp', 'heart', p.hp || 0, maxHp, (p.hp || 0) < 25)}
          ${vitalBox('hunger', 'meat', p.hunger || 0, 100 + (p.maxHungerBonus || 0), (p.hunger || 0) < R.SURVIVAL.lowThreshold)}
          ${vitalBox('thirst', 'droplet', p.thirst || 0, 100 + (p.maxThirstBonus || 0), (p.thirst || 0) < R.SURVIVAL.lowThreshold)}
        </div>
        ${eff.length ? `<div class="fx-bar" style="position:static">${eff.map((e) => {
          const left = e.charges != null ? `×${e.charges}` : U.mmss(Math.max(0, e.leftMs / 1000));
          return `<span class="fx ${e.tone}">${icon(e.icon, { size: 13 })}<b>${esc(left)}</b></span>`;
        }).join('')}</div>` : ''}
        ${p.alive === false ? `<p class="dangerc center" style="margin:0">${esc(T('watchDead'))}</p>` : ''}
      </div>

      <div class="card stack">
        <div class="card-title">${esc(T('watchHits'))}</div>
        ${hitRows(pid)}
      </div>

      <button class="btn ghost full" id="watchStop">${icon('x', { size: 20 })}<span>${esc(T('watchStop'))}</span></button>`;

    $('#watchStop').onclick = () => { Store.updateMe({ following: null }); closeWatch(); };

    maybeShowShot(pid, d);
  }

  /** Njegovi udarci — i oni koje je zadao i oni koje je primio. */
  function hitRows(pid) {
    const P = Store.players();
    const nm = (id) => (P[id] ? P[id].name : T('unknown'));
    const list = Object.values(Store.hits() || {})
      .filter((h) => h.attackerId === pid || h.victimId === pid)
      .sort((a, b) => b.atMs - a.atMs)
      .slice(0, 15);
    if (!list.length) return `<p class="dim tiny" style="margin:0">${esc(T('watchNoHits'))}</p>`;
    return list.map((h) => {
      const mine = h.attackerId === pid;
      const what = h.missed ? T('missed') : `−${h.damage}`;
      return `<div class="hit-row ${mine ? 'out' : 'in'}">
        <span class="w">${icon(WEAPON_ICON[h.weapon] || 'hand', { size: 15 })}</span>
        <span class="grow tiny">${esc(mine ? nm(h.attackerId) : nm(h.attackerId))} → ${esc(nm(h.victimId))}
          · ${h.distanceM} m</span>
        <b class="${h.missed ? 'dim' : mine ? 'goodc' : 'dangerc'}">${esc(what)}</b>
      </div>`;
    }).join('');
  }

  /** Kadar koji je praćeni igrač snimio kad je nekog pogodio — 2 s preko ekrana. */
  function maybeShowShot(pid, d) {
    const hits = Object.entries(Store.hits() || {})
      .filter(([, h]) => h.attackerId === pid && h.photoRef && !h.missed)
      .sort((a, b) => b[1].atMs - a[1].atMs);
    if (!hits.length) return;
    const [hid, h] = hits[0];
    if (watchSeenHit === null) { watchSeenHit = hid; return; }   // prvi prolaz samo pamti
    if (watchSeenHit === hid) return;
    if (d.now - h.atMs > 15000) return;                          // ne prikazuj zastarelo
    watchSeenHit = hid;

    const box = $('#watchShot');
    box.innerHTML = `<img src="${esc(h.photoRef)}" alt="">
      <div class="dmg">−${h.damage}</div>
      <div class="who">${esc((Store.players()[h.victimId] || {}).name || '')} · ${h.distanceM} m</div>`;
    box.hidden = false;
    Haptics.fire('hit'); Sfx.zap();
    clearTimeout(watchShotTimer);
    watchShotTimer = setTimeout(() => { box.hidden = true; }, 2000);
  }

  /* ═══════════════ mentor i gledalac (§17) ═══════════════ */
  function renderMentor(d) {
    const p = Mentor.target();
    const isMentor = Mentor.mode === 'mentor';
    $('#mentorTitle').textContent = isMentor ? T('mentorTitle') : T('spectator');
    $('#favorChip').innerHTML = `${icon('spark', { size: 16 })}<span>${Mentor.favor().toFixed(1)}</span>`;

    if (!p) { $('#mentorBody').innerHTML = `<div class="card center"><p>${esc(T('loading'))}</p></div>`; return; }
    const cost = R.packageCost(Mentor.sent());
    const cd = Math.max(0, ((Mentor.rec().lastPackageMs || 0) + R.PACKAGE_COOLDOWN_MS - d.now) / 1000);

    $('#mentorBody').innerHTML = `
      <div class="card">
        <div class="row">
          <div class="avatar ring" style="width:64px;height:64px">${avatarSvg(p.avatar, 64)}</div>
          <div class="grow"><div class="tiny upper dim">${esc(T('yourTribute'))}</div>
            <div class="big" style="font-weight:800">${esc(p.name)}</div>
            <div class="tiny dim">${p.classId ? esc(clsName(p.classId)) : '—'} · ${esc(weaponName(p.weapon || 'fists'))}</div></div>
        </div>
        <div class="vitals" style="margin-top:var(--s3)">
          ${vitalBox('hp', 'heart', p.hp || 0, p.maxHp || 100, (p.hp || 0) < 25)}
          ${vitalBox('hunger', 'meat', p.hunger || 0, 100, (p.hunger || 0) < 25)}
          ${vitalBox('thirst', 'droplet', p.thirst || 0, 100, (p.thirst || 0) < 25)}
        </div>
        ${p.alive === false ? `<p class="dangerc center" style="margin-top:var(--s3)">${esc(T('youDied'))}</p>` : ''}
      </div>

      ${isMentor ? `
      <div class="card stack">
        <div class="card-title">${esc(T('earnFavor'))}</div>
        <p class="tiny dim" style="margin:0">${esc(T('noFavorYet'))}</p>
        <div class="row wrap">
          ${Mentor.CHALLENGES.map((c) => `<button class="btn sm ghost" data-ch="${c}">
            ${esc(T({ reaction: 'chReaction', simon: 'chSimon', targets: 'chTarget', quiz: 'chQuiz', rhythm: 'chRhythm' }[c]))}</button>`).join('')}
        </div>
      </div>

      <div class="card stack">
        <div class="card-title">${esc(T('packages'))}</div>
        <div class="row between"><span class="dim">${esc(T('packageNext'))}</span>
          <span class="chip gold">${icon('spark', { size: 14 })}${cost}</span></div>
        ${cd > 0 ? `<p class="tiny goldc">${esc(T('packageCooldown'))} ${U.mmss(cd)}</p>` : ''}
        ${Object.keys(R.PACKAGE_TIERS).map((tier) => {
          const okBuy = R.canAffordTier(tier, Mentor.sent(), Mentor.favor()) && cd <= 0 && p.alive !== false;
          const t = R.PACKAGE_TIERS[tier];
          return `<button class="gm-event" data-pkg="${tier}" ${okBuy ? '' : 'disabled'}>
            ${icon({ water: 'droplet', food: 'meat', medkit: 'bandage', backpack: 'backpack', weapon: 'swords' }[tier], { size: 24 })}
            <div class="grow" style="text-align:left"><div style="font-weight:700">${esc(T({ water: 'pkgWater', food: 'pkgFood', medkit: 'pkgMedkit', backpack: 'pkgBackpack', weapon: 'pkgWeapon' }[tier]))}</div>
              <div class="tiny dim">${esc(T('packageCost'))} ${Math.max(cost, t.minCost)}</div></div>
            <span class="cost">${icon('spark', { size: 14 })}${t.minCost}+</span></button>`;
        }).join('')}
      </div>` : `
      <div class="card stack center">
        <p class="dim">${esc(T('spectator'))}</p>
        <button class="btn gold lg full" id="mCheer">${icon('users', { size: 22 })}<span>${esc(T('cheer'))}</span></button>
        <p class="tiny mute">${esc(T('cheerCooldown'))}</p>
      </div>`}

      <div class="card stack">
        <div class="card-title">${esc(T('feed'))}</div>
        ${Object.entries(Store.feed()).map(([id, f]) => ({ id, ...f }))
          .filter((f) => f.scope === 'all').sort((a, b) => b.atMs - a.atMs).slice(0, 12)
          .map((f) => `<div class="feed-item ${f.type === 'death' ? 'death' : 'event'}">${esc(feedText(f))}</div>`).join('') || '<p class="dim">—</p>'}
      </div>`;

    $$('#mentorBody [data-ch]').forEach((b) => b.onclick = () => Mentor.earn(b.dataset.ch));
    $$('#mentorBody [data-pkg]').forEach((b) => b.onclick = () => Mentor.sendPackage(b.dataset.pkg));
    const c = $('#mCheer');
    if (c) c.onclick = () => Mentor.cheer();
  }

  /* ═══════════════ kraj (§19) ═══════════════ */
  async function renderEnd() {
    const P = Store.players(), meta = Store.meta();
    const w = meta.winnerId ? P[meta.winnerId] : null;
    const dead = Object.entries(P).filter(([, p]) => p.alive === false && p.deathAtMs)
      .sort((a, b) => a[1].deathAtMs - b[1].deathAtMs);
    const t0 = meta.startedAtMs || 0;
    const nm = (id) => (P[id] ? P[id].name : '?');

    const awards = [
      ['awardWalker', 'run', (p) => p.distanceWalkedM || 0, true],
      ['awardFighter', 'swords', (p) => p.fights || 0, true],
      ['awardCoward', 'shield', (p) => p.fights || 0, false],
      ['awardHungry', 'meat', (p) => 100 - (p.hunger || 0), true],
      ['awardDirtyWater', 'droplet', (p) => p.dirtyWaterDrunk || 0, true],
    ].map(([key, ic, f, max]) => {
      const arr = Object.entries(P).filter(([, p]) => !p.isBot);
      if (!arr.length) return '';
      arr.sort((a, b) => (max ? f(b[1]) - f(a[1]) : f(a[1]) - f(b[1])));
      const [, p] = arr[0];
      return `<div class="award">${icon(ic, { size: 24 })}<div class="grow">
        <div style="font-weight:700">${esc(T(key))}</div><div class="tiny dim">${esc(p.name)} · ${Math.round(f(p))}</div></div></div>`;
    }).join('');

    $('#endBody').innerHTML = `
      <div class="winner-card">
        ${w ? `<div class="avatar ring" style="width:130px;height:130px">${avatarSvg(w.avatar, 130)}</div>
        <div class="tiny upper dim">${esc(T('victory'))}</div>
        <h1>${esc(w.name)}</h1>
        <div class="row" style="justify-content:center;margin-top:var(--s3)">
          <span class="chip gold">${icon(CLASS_ICON[w.classId] || 'user', { size: 14 })}${esc(clsName(w.classId))}</span>
          <span class="chip">${icon(WEAPON_ICON[w.weapon] || 'hand', { size: 14 })}${esc(weaponName(w.weapon))}</span>
        </div>` : `<h1>${esc(T('gameOver'))}</h1>`}
      </div>
      <div class="card"><div class="card-title">${esc(T('timeline'))}</div>
        ${dead.map(([pid, p]) => `<div class="tl-item">
          <span class="when">${U.mmss((p.deathAtMs - t0) / 1000)}</span>
          <span class="grow">${esc(p.name)}${p.killedBy ? ` — ${esc(nm(p.killedBy))}` : ''}</span>
        </div>`).join('') || `<p class="dim">—</p>`}</div>
      <div class="card"><div class="card-title">${esc(T('stats'))}</div>
        ${Object.entries(P).map(([pid, p]) => `<div class="list-item">
          <div class="avatar" style="width:40px;height:40px">${avatarSvg(p.avatar, 40)}</div>
          <div class="grow"><div class="name">${esc(p.name)}</div>
          <div class="tiny dim">${esc(T('statWalked'))} ${Math.round(p.distanceWalkedM || 0)} m ·
            ${esc(T('statFights'))} ${p.fights || 0} · ${esc(T('statKills'))} ${p.kills || 0} ·
            ${esc(T('statItems'))} ${p.itemsTaken || 0}</div></div>
        </div>`).join('')}</div>
      <div class="card stack"><div class="card-title">${esc(T('stats'))}</div>${awards}</div>
      ${Store.isHost() ? `<button class="btn primary lg full" id="btnAgain">${esc(T('playAgain'))}</button>` : ''}
      <button class="btn ghost full" id="btnHome">${esc(T('backToStart'))}</button>`;

    const a = $('#btnAgain'); if (a) a.onclick = () => App.playAgain();
    $('#btnHome').onclick = async () => { await Store.leave(); App.goHome(); };
  }

  return {
    maybeInstallModal, initHome, avatarBuilder, renderHomeAvatar, get avatar() { return myAvatar; },
    onboarding, onboardingDone, permState, FACE_KEY,
    renderLobby, resetLobby, showQr, shareLink, arenaMapSheet, renderPrep, nextStep, get prepStep() { return prepStep; },
    set prepStep(v) { prepStep = v; }, renderDeploy, ensureMap, renderGame, inventorySheet,
    feedSheet, playersSheet, openAim, closeAim, testSheet, showSky, renderGhost, renderEnd, feedText,
    renderWatch, openWatch, closeWatch,
    renderMentor, renderSettings, devMode,
    get gmap() { return gmap; },
    mentorLinkSheet(pid) {
      const url = Mentor.mentorLinkFor(Store.code, pid);
      const s = sheet(T('mentorLink'), `
        <p class="dim">${esc(T('mentorOf'))}: <b>${esc((Store.players()[pid] || {}).name || '')}</b></p>
        <div class="card" style="word-break:break-all;font-size:var(--fs-sm)">${esc(url)}</div>
        <button class="btn primary lg full" id="mlCopy" style="margin-top:var(--s3)">${esc(T('copyMentorLink'))}</button>`);
      $('#mlCopy', s).onclick = async () => {
        try { await navigator.clipboard.writeText(url); toast(T('copied'), 'good', 'check'); } catch { }
        if (navigator.share) { try { await navigator.share({ title: 'ARENA', url }); } catch { } }
      };
    },
  };
})();
