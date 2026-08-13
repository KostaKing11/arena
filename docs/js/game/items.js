/* Predmeti: šta vidim, kupljenje po retkosti, inventar, zamke. (§12, §13) */
const Items = (() => {
  'use strict';

  /** Predmeti koje trenutno vidim — presudan je domet vida moje klase. */
  function visible(d) {
    const pos = Geo.pos, me = d.me;
    if (!pos || !me) return [];
    const started = d.state === 'LIVE' || d.state === 'FINAL_TWO';
    if (!started) return [];
    const vis = (d.vision && d.vision.itemsM) || 15;
    const out = [];
    for (const [id, it] of Object.entries(Store.items())) {
      if (it.takenBy) continue;
      const dm = U.dist(pos, it);
      if (dm > vis) continue;
      out.push({ id, ...it, distM: dm, inReach: dm <= R.PICKUP_RADIUS_M });
    }
    return out.sort((a, b) => a.distM - b.distM);
  }

  const nearest = (d) => visible(d).find((i) => i.inReach) || null;

  /** Da li smem sad da kupim? Prvih 10 s posle starta niko ne kupi ništa (§4). */
  function pickupAllowed(d) {
    if (d.state !== 'LIVE' && d.state !== 'FINAL_TWO') return false;
    if (d.paused) return false;
    const me = d.me;
    if (!me || me.alive === false || me.fightId) return false;
    return d.elapsedMs > R.NO_PICKUP_AFTER_START_MS;
  }

  /* ───────────────── kupljenje po retkosti ───────────────── */
  /** Vraća Promise<boolean> — da li je izazov položen. UI se crta ovde. */
  function runPickup(item) {
    const meta = R.RARITY[item.rarity];
    if (meta.pick === 'tap') return Promise.resolve(true);
    if (meta.pick === 'challenge') return challengePick(item);
    return holdPick(item, meta);
  }

  function holdPick(item, meta) {
    return new Promise((res) => {
      const startPos = Geo.pos;
      const dur = meta.pickMs;
      const m = modal(`
        <div class="center stack-lg">
          <div class="chip rar-${item.rarity}" style="color:var(--rc);border-color:var(--rc)">
            <span class="rar-dot"></span>${esc(rarityName(item.rarity))}</div>
          <h2>${esc(itemName(item.type))}</h2>
          <div class="holdring" id="hr">${ring(0, 180)}
            <div style="position:absolute" class="display" id="hrN">${Math.ceil(dur / 1000)}</div>
          </div>
          <p class="dim">${esc(meta.cancelOnMove ? T('pickupHold') + ' — ' + T('pickupMoved') : T('pickupHold'))}</p>
          <button class="btn ghost full" id="hrCancel">${esc(T('cancel'))}</button>
        </div>`, { dismissible: false });

      let t0 = 0, raf = 0, holding = false, done = false;
      const ringEl = $('#hr svg', m), numEl = $('#hrN', m);
      const finish = (ok) => {
        if (done) return; done = true;
        cancelAnimationFrame(raf); m.close(); res(ok);
      };
      function loop() {
        if (!holding) return;
        const p = (performance.now() - t0) / dur;
        setRing(ringEl, p);
        numEl.textContent = Math.max(0, Math.ceil((dur - (performance.now() - t0)) / 1000));
        if (meta.cancelOnMove && startPos && Geo.pos && U.dist(startPos, Geo.pos) > 6) {
          toast(T('pickupMoved'), 'danger'); return finish(false);
        }
        if (p >= 1) { Haptics.fire('pickup'); return finish(true); }
        raf = requestAnimationFrame(loop);
      }
      const down = (e) => { e.preventDefault(); if (holding || done) return; holding = true; t0 = performance.now(); Haptics.fire('tap'); loop(); };
      const up = () => { if (!holding || done) return; holding = false; cancelAnimationFrame(raf); setRing(ringEl, 0); };
      const hr = $('#hr', m);
      hr.addEventListener('pointerdown', down);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      $('#hrCancel', m).onclick = () => finish(false);
      m.addEventListener('remove', () => window.removeEventListener('pointerup', up));
      // legendarno: svima ide objava da neko otvara sanduk (§12)
      if (meta.announce) Store.pushFeed({ type: 'legendary', scope: 'all' });
    });
  }

  /** Epsko: 5 tapova u ritmu ILI 3 protresanja telefona. */
  function challengePick(item) {
    return new Promise((res) => {
      const m = modal(`
        <div class="center stack-lg">
          <div class="chip rar-epic" style="color:var(--rc);border-color:var(--rc)"><span class="rar-dot"></span>${esc(rarityName('epic'))}</div>
          <h2>${esc(itemName(item.type))}</h2>
          <div class="seg" id="chMode">
            <button class="on" data-m="tap">${esc(T('pickupChallenge'))}</button>
            <button data-m="shake">${esc(T('pickupShake'))}</button>
          </div>
          <div id="chStage" style="min-height:180px;display:grid;place-items:center"></div>
          <button class="btn ghost full" id="chCancel">${esc(T('cancel'))}</button>
        </div>`, { dismissible: false });

      let done = false;
      const finish = (ok) => { if (done) return; done = true; Shake.stop(); m.close(); res(ok); };
      $('#chCancel', m).onclick = () => finish(false);

      const stage = $('#chStage', m);
      function tapMode() {
        Shake.stop();
        stage.innerHTML = `<div class="stack center" style="gap:var(--s4)">
          <div class="display" id="chBeat" style="font-size:var(--fs-3xl)">0/5</div>
          <button class="btn primary lg" id="chTap" style="width:170px;height:170px;border-radius:50%">${icon('hand', { size: 44 })}</button>
        </div>`;
        let hits = 0, last = 0, ivl = 600, t = setInterval(() => { Sfx.tick(); }, ivl);
        const beat = setInterval(() => {}, ivl);
        const t0 = performance.now();
        $('#chTap', stage).onclick = () => {
          const now = performance.now();
          const phase = ((now - t0) % ivl) / ivl;
          const good = phase < 0.28 || phase > 0.72;      // dovoljno blizu otkucaju
          if (good) { hits++; Haptics.fire('tap'); } else { hits = Math.max(0, hits - 1); }
          $('#chBeat', stage).textContent = `${hits}/5`;
          if (hits >= 5) { clearInterval(t); clearInterval(beat); Haptics.fire('pickup'); finish(true); }
        };
        m.addEventListener('remove', () => { clearInterval(t); clearInterval(beat); });
      }
      async function shakeMode() {
        stage.innerHTML = `<div class="stack center"><div class="display" id="chShake" style="font-size:var(--fs-3xl)">0/3</div>
          <p class="dim">${esc(T('pickupShake'))}</p></div>`;
        const ok = await Shake.start((n) => {
          $('#chShake', stage).textContent = `${Math.min(3, n)}/3`;
          Haptics.fire('tap');
          if (n >= 3) { Haptics.fire('pickup'); finish(true); }
        });
        if (!ok) { toast(T('denied'), 'danger'); tapMode(); $$('#chMode button', m).forEach((b) => b.classList.toggle('on', b.dataset.m === 'tap')); }
      }
      $$('#chMode button', m).forEach((b) => b.onclick = () => {
        $$('#chMode button', m).forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        b.dataset.m === 'tap' ? tapMode() : shakeMode();
      });
      tapMode();
    });
  }

  /* ───────────────── inventar ───────────────── */
  const inv = (me) => (me && me.inv ? me.inv.filter(Boolean) : []);

  async function take(item) {
    const me = Store.me();
    const slots = R.slotsOf(me);
    const list = inv(me);

    // oružje ide u svoj slot van inventara (§6)
    const def = R.ITEMS[item.type];
    if (def && def.weapon) return takeWeapon(item, def);
    if (def && def.arrows) {
      const claimed = await Store.claimItem(item.id);
      if (!claimed) return false;
      const add = me.hasQuiver ? 6 : Math.min(def.arrows, 3 - (me.arrows || 0));
      await Store.updateMe({ arrows: (me.arrows || 0) + Math.max(0, add), itemsTaken: (me.itemsTaken || 0) + 1 });
      await Store.ref(`items/${item.id}/takenAtMs`).set(Clock.now());
      toast(`+${Math.max(0, add)} ${itemName('arrows')}`, 'good', 'arrows');
      return true;
    }

    const fit = R.fitItem(list, item.type, slots);
    if (fit.mode === 'full') {
      const drop = await swapDialog(list, item);
      if (!drop) return false;
      const claimed = await Store.claimItem(item.id);
      if (!claimed) { toast(T('tooFarItem'), 'danger'); return false; }
      const pos = Geo.pos;
      const dropped = list[drop.index];
      if (pos && dropped) await Store.dropItem(dropped.itemType, R.ITEMS[dropped.itemType].rarity, pos.lat, pos.lng, dropped.qty || 1);
      const next = list.slice();
      next[drop.index] = { slot: drop.index, itemType: item.type, qty: 1 };
      await commit(next, item);
      return true;
    }
    const claimed = await Store.claimItem(item.id);
    if (!claimed) { toast(T('tooFarItem'), 'danger'); return false; }
    const next = list.slice();
    if (fit.mode === 'stack') next[fit.index] = { ...next[fit.index], qty: (next[fit.index].qty || 1) + 1 };
    else next.push({ slot: next.length, itemType: item.type, qty: 1 });
    await commit(next, item);
    return true;
  }

  async function commit(next, item) {
    const me = Store.me();
    await Store.updateMe({
      inv: next.map((s, i) => ({ slot: i, itemType: s.itemType, qty: s.qty || 1 })),
      itemsTaken: (me.itemsTaken || 0) + 1,
    });
    await Store.ref(`items/${item.id}/takenAtMs`).set(Clock.now());
    Haptics.fire('pickup'); Sfx.pickup();
    toast(itemName(item.type), 'good', ITEM_ICON[item.type] || 'box');
  }

  async function takeWeapon(item, def) {
    const me = Store.me();
    const claimed = await Store.claimItem(item.id);
    if (!claimed) return false;
    const old = me.weapon;
    const pos = Geo.pos;
    if (old && old !== 'fists' && pos) {
      const key = 'w' + old.charAt(0).toUpperCase() + old.slice(1);
      if (R.ITEMS[key]) await Store.dropItem(key, R.ITEMS[key].rarity, pos.lat, pos.lng, 1);
    }
    await Store.updateMe({ weapon: def.weapon, itemsTaken: (me.itemsTaken || 0) + 1 });
    await Store.ref(`items/${item.id}/takenAtMs`).set(Clock.now());
    Haptics.fire('pickup'); Sfx.pickup();
    toast(weaponName(def.weapon), 'gold', WEAPON_ICON[def.weapon]);
    return true;
  }

  function swapDialog(list, incoming) {
    return new Promise((res) => {
      const m = modal(`
        <h2 style="margin-bottom:var(--s2)">${esc(T('swapTitle'))}</h2>
        <p class="dim">${esc(T('swapBody'))}</p>
        <div class="card raised" style="margin:var(--s4) 0">
          <div class="row"><div class="rar-${incoming.rarity}" style="color:var(--rc)">${icon(ITEM_ICON[incoming.type] || 'box', { size: 30 })}</div>
          <div class="grow"><div class="big" style="font-weight:800">${esc(itemName(incoming.type))}</div>
          <div class="tiny dim">${esc(rarityName(incoming.rarity))}</div></div></div>
        </div>
        <div class="inv-grid" id="swGrid"></div>
        <button class="btn ghost full" style="margin-top:var(--s4)" id="swCancel">${esc(T('cancel'))}</button>`,
        { dismissible: false });
      $('#swGrid', m).innerHTML = list.map((s, i) => {
        const r = R.ITEMS[s.itemType].rarity;
        return `<button class="inv-slot has rar-${r}" data-i="${i}">
          ${icon(ITEM_ICON[s.itemType] || 'box', { size: 26 })}
          <div class="nm">${esc(itemName(s.itemType))}</div>
          ${(s.qty || 1) > 1 ? `<div class="qty">${s.qty}</div>` : ''}</button>`;
      }).join('');
      $$('#swGrid button', m).forEach((b) => b.onclick = () => { m.close(); res({ index: +b.dataset.i }); });
      $('#swCancel', m).onclick = () => { m.close(); res(null); };
    });
  }

  /** Iskoristi predmet iz inventara. */
  async function use(index) {
    const me = Store.me();
    const list = inv(me);
    const s = list[index];
    if (!s) return;
    const def = R.ITEMS[s.itemType];
    if (!def) return;
    if (Chase.isFleeing()) { toast(T('chaseNoHeal'), 'danger'); return; }   // §9

    if (def.trap) return setTrap(index, s);

    const patch = R.consume(me, s.itemType, Math.random);
    const next = list.slice();
    if ((s.qty || 1) > 1) next[index] = { ...s, qty: s.qty - 1 };
    else next.splice(index, 1);
    patch.inv = next.map((x, i) => ({ slot: i, itemType: x.itemType, qty: x.qty || 1 }));

    if (def.light) {
      patch.effects = { ...(me.effects || {}) };
      patch.effects[def.lightBonusM ? 'bigTorchUntil' : 'torchUntil'] = Clock.now() + def.light;
    }
    if (def.hideTrackersMs) { patch.effects = { ...(me.effects || {}), hideTrackersUntil: Clock.now() + def.hideTrackersMs }; }
    if (def.hideAllMs) { patch.hiddenUntilMs = Clock.now() + def.hideAllMs; }
    if (def.rageFirstRound) { patch.effects = { ...(me.effects || {}), rage: true }; }
    if (s.itemType === 'dirtyWater') patch.dirtyWaterDrunk = (me.dirtyWaterDrunk || 0) + 1;

    const msg = patch._msg; delete patch._msg;
    await Store.updateMe(patch);
    if (msg === 'poisoned') { toast(T('diedFrom') + ': ' + itemName(s.itemType), 'danger', 'alert'); Haptics.fire('hurt'); }
    else { toast(itemName(s.itemType), 'good', ITEM_ICON[s.itemType]); Sfx.pickup(); }
    if (patch.hp <= 0) Engine.die('poison');
  }

  async function drop(index) {
    const me = Store.me(), list = inv(me), s = list[index], pos = Geo.pos;
    if (!s || !pos) return;
    const next = list.slice(); next.splice(index, 1);
    await Store.dropItem(s.itemType, R.ITEMS[s.itemType].rarity, pos.lat, pos.lng, s.qty || 1);  // ceo stack (§12)
    await Store.updateMe({ inv: next.map((x, i) => ({ slot: i, itemType: x.itemType, qty: x.qty || 1 })) });
  }

  /* ───────────────── zamke ───────────────── */
  async function setTrap(index, s) {
    const me = Store.me(), pos = Geo.pos;
    if (!pos) return;
    const cls = R.CLASSES[me.classId] || {};
    const def = R.ITEMS[s.itemType];
    const list = inv(me), next = list.slice();
    if ((s.qty || 1) > 1) next[index] = { ...s, qty: s.qty - 1 }; else next.splice(index, 1);
    await Store.ref(`traps/${U.uid('t')}`).set({
      ownerId: Store.myId, type: def.trap, lat: pos.lat, lng: pos.lng,
      power: cls.trapPowerMul || 1, setAtMs: Clock.now(),
    });
    await Store.updateMe({ inv: next.map((x, i) => ({ slot: i, itemType: x.itemType, qty: x.qty || 1 })) });
    toast(T('trapSet'), 'gold', 'trap');
  }

  /** Provera da li sam upao u tuđu zamku — svaki igrač je proverava sam. */
  async function checkTraps(d) {
    const pos = Geo.pos, me = d.me;
    if (!pos || !me || me.alive === false) return;
    for (const [tid, t] of Object.entries(Store.traps())) {
      if (t.triggeredBy || t.ownerId === Store.myId) continue;
      if (U.dist(pos, t) > 10) continue;
      await Store.ref(`traps/${tid}/triggeredBy`).set(Store.myId);
      const mul = t.power || 1;
      if (t.type === 'basic') {
        const hp = Math.max(0, me.hp - Math.round(18 * mul));
        await Store.updateMe({ hp });
        Haptics.fire('hurt'); Sfx.hurt();
        toast(T('trapHit'), 'danger', 'trap');
        if (hp <= 0) Engine.die('trap', t.ownerId);
      } else if (t.type === 'alarm') {
        await Store.updateMe({ revealedUntilMs: Clock.now() + 8000 });
        await Store.pushFeed({ type: 'alarm', subjectId: Store.myId, scope: 'all' });
      } else if (t.type === 'tracker') {
        await Store.updateMe({ trackedBy: t.ownerId, trackedUntilMs: Clock.now() + 300000 });
      } else if (t.type === 'net') {
        await Store.updateMe({ cannotFleeUntilMs: Clock.now() + 600000 });
      }
      toast(T('trapHit'), 'danger', 'trap');
    }
  }

  /** Zamke koje vidim: svoje uvek, tuđe samo Zamkar na 10 m. */
  function visibleTraps(d) {
    const pos = Geo.pos, me = d.me;
    if (!pos || !me) return [];
    const cls = R.CLASSES[me.classId] || {};
    const out = [];
    for (const [tid, t] of Object.entries(Store.traps())) {
      if (t.triggeredBy) continue;
      if (t.ownerId === Store.myId) out.push({ id: tid, ...t });
      else if (cls.seesTrapsM && U.dist(pos, t) <= cls.seesTrapsM) out.push({ id: tid, ...t });
    }
    return out;
  }

  return { visible, nearest, pickupAllowed, runPickup, take, use, drop, inv, checkTraps, visibleTraps, swapDialog };
})();
