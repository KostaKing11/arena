/* ═══════════════════════════════════════════════════════════════════════════
   EKRANI — sve iscrtavanje. Logika je u game/*, ovde je samo prikaz.
   ═══════════════════════════════════════════════════════════════════════════ */
const UI = (() => {
  'use strict';
  let myAvatar = JSON.parse(localStorage.getItem('arena.avatar') || 'null') || randomAvatar();
  let gmap = null, smap = null, smapCenter = null;
  let lastFightRound = -1, lastHp = null, spectateFid = null;

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
    $('#brandMark').innerHTML = `<svg viewBox="0 0 120 120" width="96" height="96">
      <circle cx="60" cy="60" r="47" fill="none" stroke="var(--gold)" stroke-width="3"/>
      <path d="M60 20 L75 43 L99 50 L80 67 L86 95 L60 80 L34 95 L40 67 L21 50 L45 43 Z"
        fill="none" stroke="var(--ember)" stroke-width="4" stroke-linejoin="round"/>
      <path d="M40 60 Q60 44 80 60 Q60 72 40 60 Z" fill="var(--gold)"/></svg>`;
    makeEmbers($('#embers'), 14);
    $('#nameInput').value = localStorage.getItem('arena.name') || '';
    renderHomeAvatar();
    $('#btnTheme').textContent = Theme.get() === 'day' ? T('nightMode') : T('dayMode');
    // Test sa botovima je vidljivo dugme, ne skrivena putanja
    show($('#btnQuickTest'), testMode);
    $('#qtIcon').innerHTML = icon('settings', { size: 22 });
  }
  const renderHomeAvatar = () => { $('#homeAvatar').innerHTML = `<span class="avatar ring" style="display:block">${avatarSvg(myAvatar, 56)}</span>`; };

  function avatarBuilder() {
    const body = () => `
      <div class="avatar-preview"><div class="avatar ring">${avatarSvg(myAvatar, 150)}</div></div>
      ${group('skin', T('skin'), AV.skin, true)}
      ${group('hairColor', T('hairColor'), AV.hairColor, true)}
      ${group('hair', T('hair'), AV.hair, false)}
      ${group('shirt', T('shirt'), AV.shirt, true)}
      ${group('body', T('body'), AV.body, false)}
      <button class="btn ghost full" id="avRand" style="margin-top:var(--s3)">${esc(T('randomize'))}</button>
      <button class="btn primary lg full" id="avOk" style="margin-top:var(--s2)">${esc(T('continue'))}</button>`;
    function group(key, label, vals, isColor) {
      return `<div class="field" style="margin-bottom:var(--s3)"><div class="label">${esc(label)}</div>
        <div class="opt-row" data-k="${key}">${vals.map((v) => `
          <button class="opt ${myAvatar[key] === v ? 'on' : ''}" data-v="${esc(v)}">
            ${isColor ? `<span class="swatch" style="background:${esc(v)}"></span>` : `<span class="tiny">${esc(v)}</span>`}
          </button>`).join('')}</div></div>`;
    }
    const s = sheet(T('avatarTitle'), body());
    function wire() {
      $$('.opt-row', s).forEach((row) => $$('button', row).forEach((b) => b.onclick = () => {
        myAvatar[row.dataset.k] = b.dataset.v;
        saveAvatar(); redraw();
      }));
      $('#avRand', s).onclick = () => { myAvatar = randomAvatar(); saveAvatar(); redraw(); };
      $('#avOk', s).onclick = () => { s.close(); renderHomeAvatar(); };
    }
    function redraw() { $('.sheet-content', s).innerHTML = body(); wire(); renderHomeAvatar(); }
    wire();
  }

  /* ═══════════════ lobi ═══════════════ */
  function renderLobby() {
    const host = Store.isHost(), cfg = Store.config(), P = Store.players();
    const ids = Object.keys(P);
    const n = ids.length;
    const rec = R.recommendFor(n);
    $('#lobbyCode').textContent = Store.code || '-----';

    const ready = ids.every((id) => P[id].isBot || P[id].ready);
    const canStart = n >= R.MIN_PLAYERS && cfg.center && ready;

    const playersHtml = ids.map((id) => {
      const p = P[id];
      const st = (ok, ic) => `<span class="st ${ok ? 'ok' : ''}">${icon(ic, { size: 15 })}</span>`;
      const pe = p.perms || {};
      return `<div class="player-row">
        <div class="avatar" style="width:44px;height:44px">${p.isBot ? icon('settings', { size: 24 }) : avatarSvg(p.avatar, 44)}</div>
        <div class="grow"><div class="name">${esc(p.name)}${id === Store.myId ? ' ·' : ''}</div>
          ${Store.meta().hostId === id ? `<div class="tiny goldc">${esc(T('youAreHost'))}</div>` : ''}</div>
        <div class="statuses">
          ${st(pe.location || p.isBot, 'pin')}${st(pe.camera || p.isBot, 'camera')}
          ${st(pe.compass || p.isBot, 'compass')}${st(p.hasFace || p.isBot, 'portrait')}
        </div>
      </div>`;
    }).join('');

    const hostHtml = !host ? `
      <div class="card center stack"><div class="pulse-dot" style="margin:0 auto"></div>
        <p class="big">${esc(T('waitingHost'))}</p></div>` : `
      <div class="card stack">
        <div class="card-title">${esc(T('arenaCenter'))}</div>
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
      <button class="btn primary lg full" id="btnStart" ${canStart ? '' : 'disabled'}>${esc(T('startGame'))}</button>
      ${!canStart ? `<p class="tiny center dim">${esc(n < R.MIN_PLAYERS ? T('needPlayers') : !cfg.center ? T('needCenter') : T('needAllReady'))}</p>` : ''}`;

    $('#lobbyBody').innerHTML = `
      <div class="row between"><div class="chip">${icon('users', { size: 16 })}${n} / ${R.MAX_PLAYERS}</div>
        <div class="row-tight">
          <button class="btn sm ghost" id="btnMentorLink">${icon('users', { size: 16 })}<span>${esc(T('mentorTitle'))}</span></button>
          <button class="btn sm ghost" id="btnLeaveLobby">${esc(T('leaveRoom'))}</button>
        </div></div>
      <div class="list">${playersHtml}</div>
      ${hostHtml}`;

    $('#btnLeaveLobby').onclick = () => App.leaveRoom();
    const ml = $('#btnMentorLink');
    if (ml) ml.onclick = () => UI.mentorLinkSheet(Store.myId);
    if (host) wireHostConfig();

    function slider(key, label, min, max, step, val, unit, recVal) {
      const off = recVal ? Math.abs(val - recVal) / recVal : 0;
      return `<div class="slider" data-k="${key}">
        <div class="slider-head"><span class="label">${esc(label)}</span>
          <span class="slider-val"><span class="v">${val}</span> ${unit}</span></div>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${val}">
        <div class="rec-hint ${off > 1 ? 'warn' : ''}">${recVal ? `${esc(T('recommended'))}: ${recVal} ${unit}` : ''}${off > 1 ? ' — ' + esc(T('tooFarFromRecommended')) : ''}</div>
      </div>`;
    }
  }

  function wireHostConfig() {
    const cfg = Store.config();
    if (!smap) {
      smap = makeMap('setupMap', { zoom: 15 });
      smap.map.on('click', (e) => {
        smapCenter = { lat: e.latlng.lat, lng: e.latlng.lng };
        Store.hostUpdate('config', { center: smapCenter });
      });
    } else smap.refresh();
    if (cfg.center) {
      smap.drawZone({ center: cfg.center, radiusM: cfg.diameterM / 2, shrinking: false }, cfg);
      smap.map.setView([cfg.center.lat, cfg.center.lng], 15);
    }
    $('#btnMyLoc').onclick = () => {
      if (!Geo.pos) { toast(T('gpsGoOutside'), 'danger'); return; }
      Store.hostUpdate('config', { center: { lat: Geo.pos.lat, lng: Geo.pos.lng } });
    };
    $$('#lobbyBody .slider').forEach((sl) => {
      const inp = $('input', sl), key = sl.dataset.k;
      inp.oninput = () => { $('.v', sl).textContent = inp.value; };
      inp.onchange = () => {
        const v = +inp.value;
        if (key === 'itemDensityPct') Store.hostUpdate('config', { itemDensity: v / 100 });
        else Store.hostUpdate('config', { [key]: v });
      };
    });
    $$('#segMode button').forEach((b) => b.onclick = () => Store.hostUpdate('config', { startMode: b.dataset.v }));
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
        $('#fShot', s).onclick = () => {
          const v = $('#faceVid', s), c = $('#faceCan', s);
          if (!v.videoWidth) return toast(T('denied'), 'danger');
          const side = Math.min(v.videoWidth, v.videoHeight);
          c.width = 240; c.height = 240;
          c.getContext('2d').drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, 240, 240);
          localStorage.setItem(FACE_KEY, c.toDataURL('image/jpeg', 0.72));
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

    $('#deployBody').innerHTML = `
      ${me.classId ? `<div class="class-card">
        <div>${icon(CLASS_ICON[me.classId] || 'user', { size: 56 })}</div>
        <div class="tiny upper dim">${esc(T('yourClass'))}</div>
        <h2>${esc(clsName(me.classId))}</h2>
        <p class="dim" style="margin:var(--s2) 0 0">${esc(clsDesc(me.classId))}</p>
        <div class="chip gold" style="margin-top:var(--s3)">${icon(WEAPON_ICON[R.CLASSES[me.classId].weapon], { size: 16 })}${esc(weaponName(R.CLASSES[me.classId].weapon))}</div>
      </div>` : ''}
      <div class="card center stack">
        <div class="tiny upper dim">${esc(meta.countdownAtMs ? T('startingIn') : T('prepCountdown'))}</div>
        <div class="display" style="font-size:var(--fs-3xl);color:var(--ember)">${U.mmss(left)}</div>
      </div>
      <div class="card">
        <div class="prep-nav">
          <div class="tiny upper dim">${esc(T('goToStart'))}</div>
          <div class="prep-arrow" style="transform:rotate(${rot}deg)">${icon('navigation', { size: 84 })}</div>
          <div class="prep-dist ${close ? 'close' : ''}">${dist != null ? fmtDist(dist) : '—'}</div>
        </div>
        <button class="action-btn ${close ? '' : ''}" id="btnArrived" ${close && !me.arrived ? '' : 'disabled'}>
          ${me.arrived ? esc(T('arrivedDone')) : close ? esc(T('arrivedBtn')) : esc(T('arrivedLocked'))}
        </button>
      </div>
      ${Store.meta().census ? `<div class="card"><div class="card-title">${esc(T('arenaComposition'))}</div>
        <div class="row wrap">${Object.entries(Store.meta().census).map(([k, v]) =>
          `<span class="chip">${icon(CLASS_ICON[k], { size: 14 })}${v}× ${esc(clsName(k))}</span>`).join('')}</div></div>` : ''}`;
    const b = $('#btnArrived');
    if (b) b.onclick = () => { Store.updateMe({ arrived: true }); Haptics.fire('pickup'); };
  }

  /* ═══════════════ ekran igre ═══════════════ */
  function ensureMap() {
    if (!gmap) {
      gmap = makeMap('gamemap', { zoom: 18 });
      window.addEventListener('arena:mapdrag', () => { const b = $('#btnRecenter'); if (b) b.hidden = false; });
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
    if (d.zone) gmap.drawZone(d.zone, d.cfg);
    gmap.drawFire(d.firewall);
    gmap.drawWasps(d.wasps);
    // duhovi umesto plena vide iskre (§16)
    const ghost = me.alive === false;
    const drawn = ghost
      ? Items.sparks(d).slice(0, 40).map((s) => ({ ...s, type: 'spark', rarity: 'legendary' }))
      : Items.visible(d);
    gmap.drawItems(drawn, (it) => (ghost ? (it.inReach && Items.collectSpark(it.id)) : App.tryPickup(it)));
    gmap.drawTraps(Items.visibleTraps(d));
    gmap.drawPlayers(visiblePlayers(d));

    // gornja traka: samo kontekst
    const z = d.zone;
    const zc = $('#zoneChip');
    if (z) {
      const nextIn = z.next ? Math.max(0, (z.next.startMs - d.now) / 1000) : 0;
      zc.className = 'zonechip' + (d.outsideZone ? ' danger' : z.warn ? ' warn' : '');
      zc.innerHTML = d.outsideZone
        ? `${icon('alert', { size: 18 })}<span>${esc(T('outsideZone'))} · ${fmtDist(d.distToZone)}</span>`
        : `${icon('target', { size: 18 })}<span>${esc(T('zonePhase'))} ${z.phase}${z.next ? ' · ' + U.mmss(nextIn) : ''}</span>`;
    } else zc.innerHTML = `${icon('clock', { size: 18 })}<span>${U.mmss(Math.max(0, (d.endsAtMs - d.now) / 1000))}</span>`;

    $('#dangerVig').classList.toggle('on', !!d.outsideZone || !!d.inFire || !!d.inWasps);

    // vitalni
    const maxHp = me.maxHp || 100;
    $('#vitals').innerHTML =
      vitalBox('hp', 'heart', me.hp || 0, maxHp, (me.hp || 0) < 25) +
      vitalBox('hunger', 'meat', me.hunger || 0, 100 + (me.maxHungerBonus || 0), (me.hunger || 0) < 25) +
      vitalBox('thirst', 'droplet', me.thirst || 0, 100 + (me.maxThirstBonus || 0), (me.thirst || 0) < 25);

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

    // inventar značka
    const invN = Items.inv(me).length;
    $('#btnInv').innerHTML = `${icon('backpack', { size: 26 })}<span>${esc(T('inventory'))}</span>` +
      (invN ? `<span class="badge">${invN}</span>` : '');
    $('#btnFeed').innerHTML = `${icon('scroll', { size: 26 })}<span>${esc(T('feed'))}</span>`;
    $('#btnCamera').innerHTML = icon('camera', { size: 40 });
    $('#btnMenu').innerHTML = icon('menu', { size: 22 });

    // pogodak / šteta — vibracija i trzaj
    if (lastHp != null && me.hp < lastHp - 0.6) { Haptics.fire('hurt'); }
    lastHp = me.hp;
  }

  function visiblePlayers(d) {
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
      const strongVisible = (R.CLASSES[p.classId] || {}).alwaysVisible;
      const revealed = p.revealedUntilMs > now || (p.trackedBy === Store.myId && p.trackedUntilMs > now);
      if (strongVisible || revealed || (d.state === 'FINAL_TWO')) { out.push({ id: pid, lat: p.pos.lat, lng: p.pos.lng, kind: 'foe' }); continue; }
      if (cls.playerVisionM && dist <= cls.playerVisionM) out.push({ id: pid, lat: p.pos.lat, lng: p.pos.lng, kind: 'foe' });
    }
    return out;
  }

  function renderCompass(d) {
    const c = $('#compass');
    const h = Compass.heading;
    show(c, h != null);
    if (h == null) return;
    const w = c.clientWidth || 320;
    const pxPerDeg = w / 120;
    const marks = [];
    const CARD = LANG === 'en' ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] : ['S', 'SI', 'I', 'JI', 'J', 'JZ', 'Z', 'SZ'];
    for (let i = 0; i < 8; i++) {
      const ang = i * 45;
      const off = U.angleDiff(h, ang);
      if (Math.abs(off) > 60) continue;
      marks.push(`<div class="card" style="left:${w / 2 + off * pxPerDeg}px">${CARD[i]}</div>`);
      marks.push(`<div class="tick" style="left:${w / 2 + off * pxPerDeg}px"></div>`);
    }
    // oznake: zona, saveznici, startna tačka
    const pos = Geo.pos;
    if (pos && d.zone && d.outsideZone) {
      const off = U.angleDiff(h, U.bearing(pos, d.zone.center));
      if (Math.abs(off) <= 60) marks.push(`<div class="mk" style="left:${w / 2 + off * pxPerDeg}px;color:var(--danger)">${icon('target', { size: 18 })}</div>`);
    }
    if (pos) {
      for (const [pid, p] of Object.entries(Store.players())) {
        if (pid === Store.myId || !p.pos || p.alive === false) continue;
        if (!(p.allianceId && p.allianceId === (d.me.allianceId))) continue;
        const off = U.angleDiff(h, U.bearing(pos, p.pos));
        if (Math.abs(off) <= 60) marks.push(`<div class="mk" style="left:${w / 2 + off * pxPerDeg}px;color:var(--good)">${icon('user', { size: 16 })}</div>`);
      }
    }
    $('#compassStrip').innerHTML = marks.join('');
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

  /* ═══════════════ objave ═══════════════ */
  function feedText(f) {
    const P = Store.players();
    const nm = (id) => (P[id] ? P[id].name : T('unknown'));
    switch (f.type) {
      case 'death': return f.killerId ? `${nm(f.subjectId)} — ${T('diedFrom')} ${nm(f.killerId)}`
        : `${nm(f.subjectId)} — ${T({ zone: 'diedZone', hunger: 'diedHunger', thirst: 'diedThirst', fire: 'diedFire', trap: 'diedTrap' }[f.cause] || 'diedZone')}`;
      case 'start': return T('startGame');
      case 'finalTwo': return T('finalTwo');
      case 'end': return T('gameOver');
      case 'legendary': return T('pickupHold') + ' — ' + rarityName('legendary');
      case 'betrayal': return `${nm(f.subjectId)} → ${nm(f.targetId)}: ${T('actBetray')}`;
      case 'alliance': return T('allianceAccepted');
      case 'package': return T('gotPackage');
      case 'shot': return `${nm(f.subjectId)} → ${nm(f.targetId)} ${f.hit ? '✓' : '✗'}`;
      case 'event': return eventName(f.eventType);
      case 'zone': return T('zoneShrinking');
      case 'alarm': return T('trapHit');
      default: return f.text || f.type;
    }
  }
  function feedSheet() {
    const me = Store.me();
    const ghost = me && me.alive === false;
    const list = Object.entries(Store.feed())
      .map(([id, f]) => ({ id, ...f }))
      .filter((f) => f.scope !== 'ghosts' || ghost)
      .filter((f) => f.scope !== 'self' || f.subjectId === Store.myId)
      .sort((a, b) => b.atMs - a.atMs).slice(0, 60);
    sheet(T('feed'), `<div class="stack">${list.map((f) => `
      <div class="feed-item ${f.type === 'death' ? 'death' : f.type === 'zone' ? 'zone' : 'event'}">
        <div>${esc(feedText(f))}</div>
        <div class="t">${new Date(f.atMs).toLocaleTimeString()}</div>
      </div>`).join('') || `<p class="dim center">—</p>`}</div>`);
  }

  /* ═══════════════ meni ═══════════════ */
  function menuSheet() {
    const host = Store.isHost();
    const paused = !!Store.meta().pausedAtMs;
    sheet(T('menu'), `<div class="stack">
      <button class="btn full" id="mTheme">${icon(Theme.get() === 'day' ? 'moon' : 'sun', { size: 22 })}<span>${esc(Theme.get() === 'day' ? T('nightMode') : T('dayMode'))}</span></button>
      <button class="btn full" id="mLang">SR / EN</button>
      <button class="btn full" id="mRecenter">${icon('crosshair', { size: 22 })}<span>${esc(T('map'))}</span></button>
      <button class="btn full" id="mMentor">${icon('users', { size: 22 })}<span>${esc(T('mentorLink'))}</span></button>
      <label class="switch card"><span>${esc(T('cannon'))} + ${esc(T('menu'))}</span>
        <input type="checkbox" id="mHap" ${Haptics.enabled ? 'checked' : ''}><span class="track"><span class="knob"></span></span></label>
      ${host ? `<button class="btn ${paused ? 'good' : 'ghost'} full" id="mPause">${icon(paused ? 'play' : 'pause', { size: 22 })}<span>${esc(paused ? T('resumeGame') : T('pauseGame'))}</span></button>` : ''}
      <button class="btn danger-ghost full" id="mQuit">${esc(T('quitGame'))}</button>
    </div>`).close;
    $('#mTheme').onclick = () => { Theme.toggle(); location.reload(); };
    $('#mLang').onclick = () => { toggleLang(); location.reload(); };
    $('#mRecenter').onclick = () => { gmap && gmap.recenter(); };
    $('#mMentor').onclick = () => UI.mentorLinkSheet(Store.myId);
    $('#mHap').onchange = (e) => Haptics.setEnabled(e.target.checked);
    const p = $('#mPause');
    if (p) p.onclick = () => Store.hostUpdate('meta', { pausedAtMs: paused ? null : Clock.now() });
    $('#mQuit').onclick = async () => { if (await confirmBox(T('quitConfirm'), T('quitGame'), true)) Engine.die('quit'); };
  }

  /* ═══════════════ borba ═══════════════ */
  /** `spectate` = gledam tuđu borbu (duh ili mentor): isti ekran, bez komandi. */
  function renderFight(d, f, spectate) {
    const P = Store.players();
    const side = spectate ? 'A' : Combat.sideOf(f);
    const meId = spectate ? f.a : Store.myId;
    const foeId = spectate ? f.b : Combat.foeIdOf(f);
    const me = spectate ? (P[f.a] || {}) : d.me;
    const foe = P[foeId] || {};
    const myHp = side === 'A' ? f.hpA : f.hpB;
    const fHp = side === 'A' ? f.hpB : f.hpA;
    const w = R.WEAPONS[me.weapon] || R.WEAPONS.fists;
    const picked = spectate ? false : !!(f.moves || {})[Store.myId];
    const left = Math.max(0, (f.deadlineMs - d.now) / 1000);

    $('#fightTag').innerHTML = spectate
      ? `${icon('eye', { size: 16 })}<span>${esc(T('spectating'))}</span>`
      : `${icon('swords', { size: 16 })}<span>${esc(T('fight'))}</span>`;
    const rr = $('#roundRing');
    rr.className = 'round-ring' + (left < 4 ? ' urgent' : '');
    rr.innerHTML = ring(left / (R.ROUND_MS / 1000), 62) + `<div class="n">${f.round}</div>`;

    $('#fighters').innerHTML = `
      <div class="fighter me" id="fMe">
        <div class="avatar" style="width:74px;height:74px">${avatarSvg(me.avatar, 74)}</div>
        <div class="who">${esc(spectate ? (me.name || '?') : T('you'))}</div>
        <div class="cls">${esc(clsName(me.classId))}</div>
        <div class="hpnum">${Math.round(myHp)}</div>
        <div class="dmg-pop" id="popMe"></div>
      </div>
      <div class="dim display" style="font-size:var(--fs-lg)">VS</div>
      <div class="fighter foe" id="fFoe">
        <div class="avatar" style="width:74px;height:74px">${avatarSvg(foe.avatar, 74)}</div>
        <div class="who">${esc(foe.name || '?')}</div>
        <div class="cls">${foe.classId ? esc(clsName(foe.classId)) : '—'}</div>
        <div class="hpnum">${Math.round(fHp)}</div>
        <div class="dmg-pop" id="popFoe"></div>
      </div>`;

    // traka razdaljine kao vizuelna skala
    const segs = [];
    for (let i = 0; i <= 5; i++) {
      const pct = (i / 5) * 100;
      const inR = R.inRange(w, i);
      segs.push(`<div class="seg ${inR ? 'inrange' : ''}" style="left:${pct}%"></div>`);
      segs.push(`<div class="lbl" style="left:${pct}%">${i}</div>`);
    }
    $('#dtrack').innerHTML = `<div class="line"></div>${segs.join('')}
      <div class="pip" style="left:${(f.distance / 5) * 100}%"></div>`;
    const inRange = R.inRange(w, f.distance);
    $('#rangeHint').className = 'range-hint ' + (inRange ? 'ok' : 'bad');
    $('#rangeHint').innerHTML = `${esc(weaponName(me.weapon))} · ${w.min}–${w.max} · ` +
      (inRange ? esc(T('moveAttack')) : esc(T('outOfRange')));

    // gledalac vidi sve isto, samo bez dugmadi
    if (spectate) {
      $('#moves').innerHTML = '';
      $('#fightExtra').innerHTML = `<button class="btn ghost" id="specBack" style="grid-column:1/-1">
        ${icon('chevronLeft', { size: 20 })}<span>${esc(T('back'))}</span></button>`;
      const sb = $('#specBack');
      if (sb) sb.onclick = () => { spectateFid = null; Screens.go(Store.me() ? 'ghost' : 'mentor'); };
      $('#combatLog').textContent = describeLog(f, me, foe);
      bumpRound(f, meId, foeId);
      return;
    }

    // potezi
    const mk = (m, label, ic, cls) => `<button class="move ${cls || ''}" data-m="${m}" ${picked ? 'disabled' : ''}>
      ${icon(ic, { size: 28 })}<span>${esc(label)}</span></button>`;
    $('#moves').innerHTML =
      mk('attack', T('moveAttack'), 'swords', 'attack') +
      mk('block', T('moveBlock'), 'shield', 'block') +
      mk('approach', T('moveApproach'), 'chevronUp') +
      mk('retreat', T('moveRetreat'), 'chevronDown');
    $$('#moves .move').forEach((b) => b.onclick = () => { Combat.submit('move', b.dataset.m); b.classList.add('on'); });

    const sp = R.SPECIALS[me.classId];
    const spUsed = side === 'A' ? f.specialUsedA : f.specialUsedB;
    const canSp = sp && R.ownsWeapon(me) && !spUsed && !picked;
    $('#fightExtra').innerHTML = `
      <button class="btn ${canSp ? 'gold' : 'ghost'}" id="btnSpecial" ${canSp ? '' : 'disabled'}>
        ${icon('spark', { size: 20 })}<span>${sp ? esc(specialName(sp.id)) : esc(T('special'))}</span></button>
      <button class="btn danger-ghost" id="btnFlee" ${picked ? 'disabled' : ''}>
        ${icon('run', { size: 20 })}<span>${esc(T('fleeBtn'))}</span></button>`;
    const bs = $('#btnSpecial'); if (bs) bs.onclick = () => Combat.submit('special');
    $('#btnFlee').onclick = () => Combat.flee();

    $('#combatLog').textContent = picked ? T('waitingOpponent') : describeLog(f, me, foe);

    bumpRound(f, Store.myId, foeId);
  }

  /* Trzaj i brojka štete kad stigne nova runda. */
  function bumpRound(f, meId, foeId) {
    if (f.round === lastFightRound) return;
    if (lastFightRound >= 0 && f.lastLog) {
      for (const l of f.lastLog) {
        if (!l.dmg) continue;
        const mine = l.to === meId;
        const pop = $(mine ? '#popMe' : '#popFoe');
        if (pop) { pop.textContent = '−' + l.dmg; pop.classList.remove('go'); void pop.offsetWidth; pop.classList.add('go'); }
        const card = $(mine ? '#fMe' : '#fFoe');
        if (card) { card.classList.remove('hit'); void card.offsetWidth; card.classList.add('hit'); }
      }
      Haptics.fire('round'); Sfx.hit();
    }
    lastFightRound = f.round;
  }
  function describeLog(f, me, foe) {
    if (!f.lastLog || !f.lastLog.length) return '';
    return f.lastLog.map((l) => {
      const who = l.from === Store.myId ? T('you') : (foe.name || '?');
      if (l.kind === 'miss') return `${who}: ${T('missed')}`;
      if (l.kind === 'block') return `${who}: ${T('moveBlock')}`;
      if (l.kind === 'counter') return `${who}: ${T('counterHit')} −${l.dmg}`;
      if (l.kind === 'special') return `${who}: ${specialName(l.special)}`;
      if (l.kind === 'poison') return `${T('diedFrom')}: −${l.dmg}`;
      if (l.dmg) return `${who} −${l.dmg}${l.blocked ? ' (' + T('blockedHit') + ')' : ''}`;
      return '';
    }).filter(Boolean).join(' · ');
  }

  /* ═══════════════ bekstvo ═══════════════ */
  function renderChase(d) {
    const v = Chase.view(d);
    if (!v) return;
    const rot = v.bearing != null && Compass.heading != null ? v.bearing - Compass.heading : (v.bearing || 0);
    $('#chaseBody').innerHTML = `
      <div class="chip danger">${icon('run', { size: 16 })}<span>${esc(v.fleeing ? T('chaseFleeing') : T('chaseChasing'))}</span></div>
      <div class="chase-ring">${ring(v.secondsLeft / v.need, 220)}
        <div class="chase-count">${Math.ceil(v.secondsLeft)}</div></div>
      <div class="huge">${fmtDist(v.distM)}</div>
      <p class="dim">${esc(v.leftRadius ? T('chaseHold') : T('chaseGetAway'))}</p>
      <div class="chase-arrow" style="transform:rotate(${rot}deg)">${icon('navigation', { size: 72 })}</div>
      <p class="tiny mute">${esc(T('chaseNoHeal'))} · ${U.mmss(v.timeoutIn)}</p>`;
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

    $('#ghostBody').innerHTML = `
      <div class="card"><p style="margin:0">${esc(T('ghostBody'))}</p></div>
      <div class="card stack">
        <div class="card-title">${esc(T('buyEvent'))}</div>
        ${cool > 0 ? `<p class="tiny goldc">${esc(T('gmCooldown'))} · ${U.mmss(cool)}</p>` : ''}
        ${Object.entries(R.SPARK_COSTS).map(([type, cost]) => {
          const votes = Object.keys((Store.room.gmVotes || {})[type] || {}).length;
          const need = ghosts > 2 ? Math.ceil(ghosts / 2) : 1;
          return `<button class="gm-event" data-ev="${type}" ${pool >= cost && cool <= 0 ? '' : 'disabled'}>
            ${icon(EVENT_ICON[type] || 'spark', { size: 26 })}
            <div class="grow" style="text-align:left"><div style="font-weight:700">${esc(eventName(type))}</div>
            ${ghosts > 2 ? `<div class="tiny dim">${votes}/${need} ${esc(T('voteNeeded'))}</div>` : ''}</div>
            <span class="cost">${icon('spark', { size: 16 })}${cost}</span></button>`;
        }).join('')}
      </div>
      <div class="card stack">
        <div class="card-title">${esc(T('allPlayers'))}</div>
        ${aliveList.map(([pid, p]) => {
          const inFight = p.fightId && (Store.fights()[p.fightId] || {}).state === 'live';
          const followed = (d.me && d.me.following) === pid;
          return `<div class="list-item">
          <div class="avatar ${followed ? 'ring' : ''}" style="width:40px;height:40px">${avatarSvg(p.avatar, 40)}</div>
          <div class="grow"><div class="name">${esc(p.name)}</div>
            <div class="tiny dim">${esc(clsName(p.classId))} · ${esc(weaponName(p.weapon))}
              · ${icon('heart', { size: 11 })} ${Math.round(p.hp)}
              · ${Math.round(p.hunger || 0)} / ${Math.round(p.thirst || 0)}</div></div>
          ${inFight ? `<button class="btn sm danger-ghost" data-watch="${p.fightId}">${icon('eye', { size: 16 })}</button>` : ''}
          <button class="btn sm ${followed ? 'gold' : 'ghost'}" data-follow="${pid}">
            ${icon(followed ? 'check' : 'target', { size: 16 })}</button>
        </div>`; }).join('')}
      </div>
      <button class="btn ghost full" id="ghostMap">${icon('map', { size: 22 })}<span>${esc(T('map'))}</span></button>`;

    $$('#ghostBody .gm-event').forEach((b) => b.onclick = () => App.buyEvent(b.dataset.ev));
    $$('#ghostBody [data-follow]').forEach((b) => b.onclick = () => {
      const pid = b.dataset.follow;
      const cur = (Store.me() || {}).following;
      Store.updateMe({ following: cur === pid ? null : pid });
      toast(cur === pid ? T('unfollowBtn') : T('following'), '', 'target');
    });
    $$('#ghostBody [data-watch]').forEach((b) => b.onclick = () => {
      spectateFid = b.dataset.watch;
      lastFightRound = -1;
      Screens.go('fight');
    });
    $('#ghostMap').onclick = () => Screens.go('game');
  }

  /* ═══════════════ mentor i gledalac (§17) ═══════════════ */
  function renderMentor(d) {
    const p = Mentor.target();
    const isMentor = Mentor.mode === 'mentor';
    $('#mentorTitle').textContent = isMentor ? T('mentorTitle') : T('spectator');
    $('#favorChip').innerHTML = `${icon('spark', { size: 16 })}<span>${Mentor.favor().toFixed(1)}</span>`;

    if (!p) { $('#mentorBody').innerHTML = `<div class="card center"><p>${esc(T('loading'))}</p></div>`; return; }
    const inFight = p.fightId && (Store.fights()[p.fightId] || {}).state === 'live';
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
        ${inFight ? `<button class="btn danger full" id="mWatch" style="margin-top:var(--s3)">
          ${icon('eye', { size: 20 })}<span>${esc(T('watchFight'))}</span></button>` : ''}
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

    const w = $('#mWatch');
    if (w) w.onclick = () => { spectateFid = p.fightId; lastFightRound = -1; Screens.go('fight'); };
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
    renderLobby, showQr, shareLink, renderPrep, nextStep, get prepStep() { return prepStep; },
    set prepStep(v) { prepStep = v; }, renderDeploy, ensureMap, renderGame, inventorySheet,
    feedSheet, menuSheet, renderFight, renderChase, showSky, renderGhost, renderEnd, feedText,
    renderMentor,
    get gmap() { return gmap; },
    get spectateFid() { return spectateFid; },
    set spectateFid(v) { spectateFid = v; lastFightRound = -1; },
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
