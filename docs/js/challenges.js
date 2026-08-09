/* Mini-izazovi koje moraš da položiš da bi pokupio predmet.
   Challenges.run(kind, difficulty 1..3) -> Promise<boolean> */
const Challenges = (() => {
  const $ = (id) => document.getElementById(id);
  let cleanup = [];

  function open(kind, title, sub) {
    $('chKind').textContent = kind;
    $('chTitle').textContent = title;
    $('chSub').textContent = sub;
    $('chTime').textContent = '';
    $('chStage').innerHTML = '';
    $('modalChallenge').hidden = false;
    return $('chStage');
  }
  function close() {
    cleanup.forEach((f) => { try { f(); } catch {} });
    cleanup = [];
    $('modalChallenge').hidden = true;
  }
  const later = (f) => cleanup.push(f);
  const iv = (f, ms) => { const t = setInterval(f, ms); later(() => clearInterval(t)); return t; };
  const to = (f, ms) => { const t = setTimeout(f, ms); later(() => clearTimeout(t)); return t; };
  const buzz = (ms = 25) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };

  function run(kind, d = 1) {
    d = Math.max(1, Math.min(3, d));
    return new Promise((resolve) => {
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        $('chStage').innerHTML = `<div class="${ok ? 'ch-ok' : 'ch-bad'}">${ok ? '✔' : '✖'}</div>`;
        buzz(ok ? [30, 40, 60] : 120);
        to(() => { close(); resolve(ok); }, 420);
      };
      $('chAbort').onclick = () => { if (settled) return; settled = true; close(); resolve(false); };
      const fn = { tap, slider, sequence, hold }[kind];
      if (fn) fn(d, done); else done(false);
    });
  }

  /* ── 1. TAPKANJE ── */
  function tap(d, done) {
    const need = 16 + d * 5, secs = 6;
    const stage = open('①', T('tapTitle'), T('tapSub', need, secs));
    stage.innerHTML = `<div style="text-align:center">
      <div class="tapcount" id="tapN">0</div>
      <button class="tapbtn" id="tapB">${T('tapNow')}</button></div>`;
    let n = 0, end = Date.now() + secs * 1000;
    const btn = $('tapB');
    const hit = (e) => {
      e.preventDefault(); n++; buzz(8);
      $('tapN').textContent = n;
      if (n >= need) { off(); done(true); }
    };
    const off = () => { btn.removeEventListener('pointerdown', hit); };
    btn.addEventListener('pointerdown', hit);
    later(off);
    iv(() => {
      const left = Math.max(0, end - Date.now());
      $('chTime').textContent = (left / 1000).toFixed(1) + 's';
      if (left <= 0) { off(); done(n >= need); }
    }, 60);
  }

  /* ── 2. PRECIZNO ZAUSTAVLJANJE ── */
  function slider(d, done) {
    const rounds = 1 + d, zoneW = 26 - d * 5, speed = 0.9 + d * 0.45;
    const stage = open('②', T('sliderTitle'), T('sliderSub', rounds));
    stage.innerHTML = `<div style="width:100%">
      <div class="track"><div class="zone" id="zone"></div><div class="cursor" id="cur"></div></div>
      <div class="progdots" id="dots">${'<i></i>'.repeat(rounds)}</div>
      <button class="holdbtn" id="stopB">${T('stop')}</button></div>`;
    let hit = 0, x = 0, dir = 1, zone = 0, running = true;
    const place = () => {
      zone = 10 + Math.random() * (80 - zoneW);
      $('zone').style.left = zone + '%';
      $('zone').style.width = zoneW + '%';
    };
    place();
    iv(() => {
      if (!running) return;
      x += dir * speed;
      if (x >= 100) { x = 100; dir = -1; }
      if (x <= 0) { x = 0; dir = 1; }
      $('cur').style.left = x + '%';
    }, 16);
    $('stopB').onclick = () => {
      if (!running) return;
      const ok = x >= zone && x <= zone + zoneW;
      if (!ok) { running = false; buzz(150); return done(false); }
      buzz(20);
      $('dots').children[hit].classList.add('ok');
      hit++;
      if (hit >= rounds) { running = false; return done(true); }
      place();
    };
  }

  /* ── 3. ŠIFRA (Simon) ── */
  function sequence(d, done) {
    const len = 3 + d;
    const stage = open('③', T('seqTitle'), T('seqSub'));
    stage.innerHTML = `<div class="simon" id="simon">
      <button data-k="0"></button><button data-k="1"></button>
      <button data-k="2"></button><button data-k="3"></button></div>`;
    const btns = [...$('simon').children];
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * 4));
    let idx = 0, accepting = false;

    const flash = (k, ms = 380) => { btns[k].classList.add('lit'); buzz(12); to(() => btns[k].classList.remove('lit'), ms - 90); };
    const show = () => {
      $('chTime').textContent = '…';
      seq.forEach((k, i) => to(() => flash(k), 200 + i * 480));
      to(() => { accepting = true; $('chTime').textContent = T('repeat'); }, 200 + seq.length * 480);
    };
    btns.forEach((b) => b.onclick = () => {
      if (!accepting) return;
      const k = +b.dataset.k;
      flash(k, 200);
      if (seq[idx] === k) {
        idx++;
        $('chTime').textContent = `${idx}/${len}`;
        if (idx >= len) { accepting = false; done(true); }
      } else { accepting = false; done(false); }
    });
    show();
  }

  /* ── 4. MIRNA RUKA ── */
  function hold(d, done) {
    const goal = 62 + Math.random() * 24, win = 13 - d * 3;
    const stage = open('④', T('holdTitle'), T('holdSub'));
    stage.innerHTML = `<div class="holdwrap">
      <div class="holdbar">
        <div class="fillh" id="fillh"></div>
        <div class="redz" style="left:${goal + win}%"></div>
        <div class="goal" style="left:${goal}%"></div>
      </div>
      <button class="holdbtn" id="holdB">${T('holdNow')}</button></div>`;
    let v = 0, holding = false, over = false;
    const b = $('holdB');
    const start = (e) => { e.preventDefault(); if (over) return; holding = true; b.classList.add('down'); };
    const stop = () => {
      if (over || !holding) return;
      over = true; holding = false;
      done(v >= goal && v <= goal + win);
    };
    b.addEventListener('pointerdown', start);
    b.addEventListener('pointerup', stop);
    b.addEventListener('pointercancel', stop);
    b.addEventListener('pointerleave', stop);
    later(() => { b.removeEventListener('pointerdown', start); b.removeEventListener('pointerup', stop); });
    iv(() => {
      if (over) return;
      if (holding) v = Math.min(112, v + 1.15);
      $('fillh').style.width = v + '%';
      $('chTime').textContent = Math.round(v) + '%';
      if (v >= 112) { over = true; done(false); }
    }, 24);
  }

  return { run, close };
})();
