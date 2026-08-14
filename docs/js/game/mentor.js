/* ═══════════════════════════════════════════════════════════════════════════
   MENTOR, SPONZOR, GLEDAOCI (§17)

   Link je ličan: /arena/?room=KOD&mentor=PID. Prvi ko ga otvori postaje mentor
   tog igrača; svi posle njega su gledaoci istog igrača, bez moći osim navijanja.

   Mentor zarađuje naklonost publike izazovima na svom telefonu i njome kupuje
   pakete. Cena raste sa svakim paketom (1, 3, 6, 10), a paket pada 15 m od
   igrača — ne u ruke.
   ═══════════════════════════════════════════════════════════════════════════ */
const Mentor = (() => {
  'use strict';
  let mode = null;          // 'mentor' | 'spectator'
  let targetPid = null;
  let myId = localStorage.getItem('arena.mentorId');
  if (!myId) { myId = U.uid('m'); localStorage.setItem('arena.mentorId', myId); }

  const rec = () => (Store.mentors() || {})[targetPid] || {};
  const target = () => (Store.players() || {})[targetPid] || null;
  const favor = () => rec().favor || 0;
  const sent = () => rec().packagesSent || 0;

  /* Mentorska sesija se pamti lokalno: mentor nema `players/{pid}` čvor, pa bi
     mu zatvaranje taba značilo da je izgubio mesto zauvek. */
  const SESS = 'arena.mentor';
  const saveSession = (room, pid) => {
    try { localStorage.setItem(SESS, JSON.stringify({ room, pid })); } catch {}
  };
  const session = () => {
    try { return JSON.parse(localStorage.getItem(SESS) || 'null'); } catch { return null; }
  };
  const clearSession = () => { try { localStorage.removeItem(SESS); } catch {} };

  /** Pokušaj da preuzmeš mesto mentora; ako je zauzeto, postaješ gledalac. */
  async function claim(pid) {
    targetPid = pid;
    const t = await Store.mentorRef(pid).child('mentorId').transaction((cur) => (cur == null ? myId : undefined));
    // Ime ide uz mesto mentora — bez njega igraču u lobiju piše samo "mentor".
    if (t.committed) {
      const nm = (localStorage.getItem('arena.name') || '').trim().slice(0, 16) || T('mentorTitle');
      await Store.mentorRef(pid).child('name').set(nm);
      // i na igračev čvor, da igrač u igri vidi da mentora uopšte ima
      await Store.ref(`players/${pid}/mentorName`).set(nm);
    }
    saveSession(Store.code, pid);
    if (t.committed) { mode = 'mentor'; return 'mentor'; }
    const cur = t.snapshot.val();
    mode = cur === myId ? 'mentor' : 'spectator';
    return mode;
  }

  /* ───────────────── izazovi za naklonost ───────────────── */
  const CHALLENGES = ['reaction', 'simon', 'targets', 'quiz', 'rhythm'];

  function run(kind) {
    return ({ reaction, simon, targets, quiz, rhythm })[kind]();
  }

  const wrap = (title, body) => modal(
    `<div class="stack-lg"><h2 class="center">${esc(title)}</h2>
     <div id="chBody">${body}</div>
     <button class="btn ghost full" id="chQuit">${esc(T('cancel'))}</button></div>`,
    { dismissible: false });

  /* 1. reakcija — tapni čim pozeleni, 5 puta */
  function reaction() {
    return new Promise((res) => {
      const m = wrap(T('tapWhenGreen'),
        `<button id="rxPad" style="width:100%;height:190px;border-radius:var(--r-lg);background:var(--ink-3);
          border:2px solid var(--line);font-size:var(--fs-xl);font-weight:800"></button>
         <div class="center big" style="margin-top:var(--s3)" id="rxN">0/5</div>`);
      let hits = 0, green = false, t = 0, done = false;
      const pad = $('#rxPad', m);
      const finish = (v) => { if (done) return; done = true; clearTimeout(t); m.close(); res(v); };
      $('#chQuit', m).onclick = () => finish(0);
      const next = () => {
        pad.style.background = 'var(--ink-3)'; pad.textContent = '…'; green = false;
        t = setTimeout(() => {
          green = true; pad.style.background = 'var(--good)'; pad.textContent = '!';
          Haptics.fire('tap');
        }, 700 + Math.random() * 2200);
      };
      pad.onclick = () => {
        if (done) return;
        if (!green) { toast(T('tooEarly'), 'danger'); clearTimeout(t); next(); return; }
        hits++; $('#rxN', m).textContent = `${hits}/5`;
        if (hits >= 5) return finish(1);
        next();
      };
      next();
    });
  }

  /* 2. Simon — niz od 6 */
  function simon() {
    return new Promise((res) => {
      const m = wrap(T('repeatSequence'),
        `<div class="simon-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:280px;margin:0 auto">
          ${[0, 1, 2, 3].map((i) => `<button data-k="${i}" style="aspect-ratio:1;border-radius:var(--r-lg);opacity:.35;
            background:${['#E0483A', '#4AA3FF', '#45C46B', '#E8B64C'][i]}"></button>`).join('')}
         </div><div class="center big" style="margin-top:var(--s3)" id="smN">…</div>`);
      const btns = $$('.simon-grid button', m);
      const seq = Array.from({ length: 6 }, () => Math.floor(Math.random() * 4));
      let idx = 0, accept = false, done = false;
      const finish = (v) => { if (done) return; done = true; m.close(); res(v); };
      $('#chQuit', m).onclick = () => finish(0);
      const flash = (k, ms) => { btns[k].style.opacity = '1'; Haptics.fire('tap'); setTimeout(() => { btns[k].style.opacity = '.35'; }, ms - 90); };
      seq.forEach((k, i) => setTimeout(() => flash(k, 400), 350 + i * 470));
      setTimeout(() => { accept = true; $('#smN', m).textContent = `0/6`; }, 350 + seq.length * 470);
      btns.forEach((b) => b.onclick = () => {
        if (!accept || done) return;
        const k = +b.dataset.k;
        flash(k, 200);
        if (seq[idx] === k) { idx++; $('#smN', m).textContent = `${idx}/6`; if (idx >= 6) finish(1); }
        else finish(0);
      });
    });
  }

  /* 3. mete koje beže — pogodi 5 */
  function targets() {
    return new Promise((res) => {
      const m = wrap(T('hitTargets'),
        `<div id="tgArea" style="position:relative;height:240px;border-radius:var(--r-lg);
          background:var(--ink-3);border:2px solid var(--line);overflow:hidden"></div>
         <div class="center big" style="margin-top:var(--s3)" id="tgN">0/5</div>`);
      const area = $('#tgArea', m);
      let hits = 0, done = false, iv = 0;
      const finish = (v) => { if (done) return; done = true; clearInterval(iv); m.close(); res(v); };
      $('#chQuit', m).onclick = () => finish(0);
      const dot = el('button');
      dot.style.cssText = 'position:absolute;width:56px;height:56px;border-radius:50%;background:var(--ember);border:3px solid #fff';
      area.appendChild(dot);
      const move = () => {
        dot.style.left = Math.random() * (area.clientWidth - 60) + 'px';
        dot.style.top = Math.random() * (area.clientHeight - 60) + 'px';
      };
      dot.onclick = () => {
        hits++; Haptics.fire('tap'); $('#tgN', m).textContent = `${hits}/5`;
        if (hits >= 5) return finish(1);
        move();
      };
      move();
      iv = setInterval(move, 1100);
      setTimeout(() => finish(hits >= 5 ? 1 : 0), 30000);
    });
  }

  /* 4. kviz */
  const QUIZ = [
    { sr: 'Koliko distrikta ima Panem?', en: 'How many districts does Panem have?', a: ['12', '10', '13'], c: 0 },
    { sr: 'Šta je kornukopija?', en: 'What is the cornucopia?', a: ['Oružje', 'Rog izobilja sa zalihama', 'Distrikt'], c: 1 },
    { sr: 'Koliko tributa ulazi u arenu?', en: 'How many tributes enter the arena?', a: ['24', '12', '36'], c: 0 },
    { sr: 'Šta znači zvuk topa?', en: 'What does the cannon mean?', a: ['Gozba', 'Neko je poginuo', 'Kraj dana'], c: 1 },
    { sr: 'Ko šalje pakete tributima?', en: 'Who sends packages to tributes?', a: ['Sponzori', 'Distrikt', 'Mirovnjaci'], c: 0 },
  ];
  function quiz() {
    return new Promise((res) => {
      const qs = U.shuffle(Math.random, QUIZ).slice(0, 3);
      let i = 0, right = 0, done = false;
      const m = wrap(T('quizTitle'), `<div id="qz"></div>`);
      const finish = (v) => { if (done) return; done = true; m.close(); res(v); };
      $('#chQuit', m).onclick = () => finish(0);
      function draw() {
        if (i >= qs.length) return finish(right >= 2 ? 1 : 0);
        const q = qs[i];
        $('#qz', m).innerHTML = `<p class="big center">${esc(LANG === 'en' ? q.en : q.sr)}</p>
          <div class="stack">${q.a.map((t, k) => `<button class="btn full" data-k="${k}">${esc(t)}</button>`).join('')}</div>`;
        $$('#qz button', m).forEach((b) => b.onclick = () => {
          if (+b.dataset.k === q.c) { right++; Haptics.fire('tap'); } else Haptics.fire('alert');
          i++; draw();
        });
      }
      draw();
    });
  }

  /* 5. ritam */
  function rhythm() {
    return new Promise((res) => {
      const m = wrap(T('tapRhythm'),
        `<button id="rhPad" style="width:100%;height:190px;border-radius:var(--r-lg);background:var(--ink-3);
          border:2px solid var(--line);font-size:var(--fs-2xl);font-weight:800">♦</button>
         <div class="center big" style="margin-top:var(--s3)" id="rhN">0/8</div>`);
      const ivl = 620;
      let hits = 0, done = false, t0 = performance.now();
      const beat = setInterval(() => {
        Sfx.tick();
        const p = $('#rhPad', m);
        if (p) { p.style.background = 'var(--ember)'; setTimeout(() => { p.style.background = 'var(--ink-3)'; }, 120); }
      }, ivl);
      const finish = (v) => { if (done) return; done = true; clearInterval(beat); m.close(); res(v); };
      $('#chQuit', m).onclick = () => finish(0);
      $('#rhPad', m).onclick = () => {
        const phase = ((performance.now() - t0) % ivl) / ivl;
        if (phase < 0.26 || phase > 0.74) { hits++; Haptics.fire('tap'); } else hits = Math.max(0, hits - 1);
        $('#rhN', m).textContent = `${hits}/8`;
        if (hits >= 8) finish(1);
      };
      setTimeout(() => finish(hits >= 8 ? 1 : 0), 40000);
    });
  }

  async function earn(kind) {
    const gained = await run(kind);
    if (!gained) { toast(T('challengeFail'), '', 'x'); return 0; }
    await Store.mentorRef(targetPid).child('favor').transaction((c) => (c || 0) + gained);
    Haptics.fire('win'); Sfx.pickup();
    toast(`${T('challengeDone')} +${gained}`, 'good', 'spark');
    return gained;
  }

  /* ───────────────── paketi ───────────────── */
  async function sendPackage(tier) {
    const p = target();
    if (!p || !p.pos) return;
    const cost = R.packageCost(sent());
    /* Signalna raketa: igrač se otkrio svima na 30 s i time kupio jedan paket
       koji ne košta naklonost i ne čeka hlađenje. To je ceo trejd tog predmeta
       — čist rizik za nagradu, i jedina veza predmeta sa mentorskim sistemom. */
    const freebie = !!p.freePackage;
    if (!freebie) {
      if (!R.canAffordTier(tier, sent(), favor())) { toast(T('notEnoughFavor'), 'danger'); return; }
      const last = rec().lastPackageMs || 0;
      if (Clock.now() - last < R.PACKAGE_COOLDOWN_MS) {
        toast(`${T('packageCooldown')} ${U.mmss((last + R.PACKAGE_COOLDOWN_MS - Clock.now()) / 1000)}`, 'gold');
        return;
      }
      const t = await Store.mentorRef(targetPid).child('favor').transaction((c) => ((c || 0) >= cost ? c - cost : undefined));
      if (!t.committed) { toast(T('notEnoughFavor'), 'danger'); return; }
    } else {
      await Store.ref(`players/${targetPid}/freePackage`).remove();
    }

    const pool = R.PACKAGE_TIERS[tier].items;
    const type = pool[Math.floor(Math.random() * pool.length)];
    const drop = U.destPoint(p.pos, Math.random() * 360, R.PACKAGE_DROP_M);   // pada 15 m od igrača
    await Store.ref(`items/${U.uid('pk')}`).set({
      type, rarity: R.ITEMS[type].rarity, lat: drop.lat, lng: drop.lng,
      spawnedAtMs: Clock.now(), fromMentor: myId, dropped: true,
    });
    await Store.mentorRef(targetPid).update({ packagesSent: sent() + 1, lastPackageMs: Clock.now() });
    // svima bez imena, igraču sa imenom pošiljaoca (§17, §20)
    await Store.pushFeed({ type: 'package', scope: 'all' });
    await Store.ref(`players/${targetPid}/incomingPackage`).set({ type, atMs: Clock.now(), from: 'mentor' });
    toast(T('packageSent'), 'good', 'gift');
  }

  /* ───────────────── navijanje (gledaoci) ───────────────── */
  async function cheer() {
    const key = 'arena.cheer.' + targetPid;
    const last = +(localStorage.getItem(key) || 0);
    if (Date.now() - last < R.CHEER_COOLDOWN_MS) { toast(T('cheerCooldown'), 'gold'); return; }
    localStorage.setItem(key, String(Date.now()));
    await Store.mentorRef(targetPid).child('favor').transaction((c) => (c || 0) + R.CHEER_FAVOR);
    Haptics.fire('tap');
    toast(T('cheered'), 'good', 'users');
  }

  const mentorLinkFor = (code, pid) => `${appBase()}?room=${code}&mentor=${pid}`;

  return {
    claim, earn, sendPackage, cheer, mentorLinkFor, CHALLENGES,
    session, clearSession,
    get mode() { return mode; }, get targetPid() { return targetPid; },
    get myId() { return myId; }, target, favor, sent, rec,
  };
})();
