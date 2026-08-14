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
    // vid za piće ne pada od žeđi — inače bi žeđ bila spirala iz koje se ne izlazi
    const visDrink = (d.vision && d.vision.drinksM) || vis;
    const out = [];
    for (const [id, it] of Object.entries(Store.items())) {
      if (it.takenBy) continue;
      const dm = U.dist(pos, it);
      const def = R.ITEMS[it.type];
      if (dm > (def && def.type === 'drink' ? visDrink : vis)) continue;
      out.push({ id, ...it, distM: dm, inReach: dm <= R.PICKUP_RADIUS_M });
    }
    // Halucinacije od tracker osa: lažni predmeti koji nestanu kad priđeš (§15)
    const hallucUntil = (me.effects && me.effects.hallucinateUntil) || 0;
    if (d.now < hallucUntil) {
      const bucket = Math.floor(d.now / 60000);
      for (const f of R.hallucinations(Store.myId, pos, bucket)) {
        const dm = U.dist(pos, f);
        if (dm > vis || dm <= R.HALLUCINATION_POP_M) continue;   // isparava kad priđeš
        out.push({ ...f, distM: dm, inReach: false });
      }
    }
    return out.sort((a, b) => a.distM - b.distM);
  }

  /* ───────────────── iskre: vidljive samo duhovima (§16) ───────────────── */
  function sparks(d) {
    const me = d.me, pos = Geo.pos;
    if (!me || me.alive !== false || !pos || !d.cfg || !d.cfg.center) return [];
    const seed = (Store.room && Store.room.seed) || 's';
    const taken = (Store.sparks().collected) || {};
    /* Prsten se seli i širi sa svakom FAZOM, ali unutar faze stoji mirno.
       Zato ide raspored, ne živa zona: živa zona se tokom skupljanja menja
       svake sekunde i iskre bi bežale ispred duha. */
    const all = R.generateSparks(seed, d.cfg, Object.keys(Store.players()).length,
      (d.zone && d.zone.phase) || 0, Store.schedule());
    return all.filter((s) => !taken[s.id]).map((s) => ({
      ...s, distM: U.dist(pos, s), inReach: U.dist(pos, s) <= R.SPARK_REACH_M,
    })).sort((a, b) => a.distM - b.distM);
  }
  async function collectSpark(sid) {
    await Store.addSpark(sid);
    // lični brojač: bazen je zajednički, ali duh treba da vidi svoj doprinos
    const me = Store.me() || {};
    await Store.updateMe({ sparksCollected: (me.sparksCollected || 0) + 1 });
    Haptics.fire('pickup'); Sfx.pickup();
    toast(T('sparkTaken'), 'gold', 'spark');
  }

  const nearest = (d) => visible(d).find((i) => i.inReach) || null;

  /** Da li smem sad da kupim? Prvih 10 s posle starta niko ne kupi ništa (§4). */
  function pickupAllowed(d) {
    if (d.state !== 'LIVE' && d.state !== 'FINAL_TWO') return false;
    if (d.paused) return false;
    const me = d.me;
    if (!me || me.alive === false) return false;
    // Mreža-zamka: 30 s ne možeš ni da napadaš ni da uzimaš (§9)
    if ((me.cameraBlockedUntilMs || 0) > d.now) return false;
    return d.elapsedMs > R.NO_PICKUP_AFTER_START_MS;
  }

  /* ───────────────── uzimanje po TIPU predmeta ─────────────────
     Ranije je retkost određivala način uzimanja, pa se voda uzimala isto kao
     ranac. Sada cenu plaćaš u izloženosti, srazmerno težini predmeta:
       tap     — hrana, piće, strele, sitni alat
       hold3   — oružje, zamke, ranac, trajni bonusi
       chest8  — legendarno i epska oružja: 8 s + JAVNA OBJAVA svima      */
  /** Vraća Promise<boolean> — da li je uzimanje uspelo. UI se crta ovde. */
  function runPickup(item) {
    const meta = R.pickupOf(item.type, Store.me(), Clock.now());
    if (!meta.pickMs) return Promise.resolve(true);
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
        if (meta.cancelOnMove && startPos && Geo.pos && U.dist(startPos, Geo.pos) > (meta.moveM || 6)) {
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
      // sanduk: svima ide objava da ga neko otvara (§1)
      if (meta.announce) Store.pushFeed({ type: 'legendary', scope: 'all' });
    });
  }

  /* ───────────────── inventar ───────────────── */
  const inv = (me) => (me && me.inv ? me.inv.filter(Boolean) : []);

  async function take(item) {
    const me = Store.me();
    const slots = R.slotsOf(me);
    const list = inv(me);

    /* Mamac: izgleda kao legendarni sanduk, a nema ničega u njemu. Vlasnik
       dobija obaveštenje da mu je neko upravo stao na tačku koju je izabrao. */
    if (item.decoyFake) {
      await Store.ref(`items/${item.id}`).remove();
      if (item.ownerId && item.ownerId !== Store.myId) {
        await Store.ref(`players/${item.ownerId}/decoyHit`).set({ atMs: Clock.now(), lat: item.lat, lng: item.lng });
      }
      Haptics.fire('hurt');
      toast(T('decoyFooled'), 'danger', 'eyeOff');
      return false;
    }

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

    if (def.trap) return setTrap(index, s);
    if (def.decoy) return setDecoy(index, s);

    /* Borba v4 §9: nema više stanja borbe, pa je lečenje i jelo uvek dostupno —
       ali traje 3 s stajanja u mestu i prekida se ako se pomeriš preko 5 m.
       Tu je cena: dok jedeš, ranjiv si i ne bežiš. */
    if (def.type === 'food' || def.type === 'drink' || def.type === 'heal') {
      const okHold = await holdPick(
        { type: s.itemType, rarity: def.rarity },
        { pickMs: R.HEAL_HOLD_MS, cancelOnMove: true, moveM: R.HEAL_MOVE_M }
      );
      if (!okHold) return;
    }

    const now = Clock.now();
    const patch = R.consume(me, s.itemType, Math.random, now);
    const next = list.slice();
    if ((s.qty || 1) > 1) next[index] = { ...s, qty: s.qty - 1 };
    else next.splice(index, 1);
    patch.inv = next.map((x, i) => ({ slot: i, itemType: x.itemType, qty: x.qty || 1 }));

    // Dim pamti GDE je bačen — iz toga svi telefoni računaju aktivne zone
    if (def.smokeMs) {
      const pos = Geo.pos;
      if (!pos) { toast(T('noGps'), 'danger'); return; }
      patch.smokeAt = { lat: pos.lat, lng: pos.lng };
    }
    // Signalna raketa: otkriva te 30 s, ali mentor odmah dobija jedan paket
    if (def.freePackage) await Store.pushFeed({ type: 'flare', subjectId: Store.myId, scope: 'all' });
    if (s.itemType === 'dirtyWater') patch.dirtyWaterDrunk = (me.dirtyWaterDrunk || 0) + 1;

    const msg = patch._msg; delete patch._msg;
    await Store.updateMe(patch);
    if (msg === 'poisoned') { toast(T('gotPoisoned'), 'danger', 'alert'); Haptics.fire('hurt'); }
    else { toast(itemName(s.itemType), 'good', ITEM_ICON[s.itemType]); Sfx.pickup(); }
    if (patch.hp <= 0) Engine.die('poison');
  }

  /* Mamac: lažni sanduk koji svima izgleda legendarno. Jedini predmet koji
     pravi razlog da neko negde ode — a to je ono što IRL igra treba da radi. */
  async function setDecoy(index, s) {
    const me = Store.me(), pos = Geo.pos;
    if (!pos) { toast(T('noGps'), 'danger'); return; }
    const list = inv(me), next = list.slice();
    if ((s.qty || 1) > 1) next[index] = { ...s, qty: s.qty - 1 }; else next.splice(index, 1);
    await Store.ref(`items/${U.uid('k')}`).set({
      type: 'feastMeal', rarity: 'legendary', lat: pos.lat, lng: pos.lng,
      spawnedAtMs: Clock.now(), dropped: true, decoyFake: true, ownerId: Store.myId,
    });
    await Store.updateMe({ inv: next.map((x, i) => ({ slot: i, itemType: x.itemType, qty: x.qty || 1 })) });
    toast(T('decoySet'), 'gold', 'eyeOff');
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

  /* Koliko dugo stojim u kojoj zamci — lokalno, ne ide u bazu.
     Zamka okida tek posle 5 s neprekidnog zadržavanja u krugu od 15 m:
     stari radijus od 10 m je bio unutar same greške GPS-a, pa su zamke
     okidale na ljude koji nisu ni prišli. */
  const dwell = new Map();

  /** Provera da li sam upao u tuđu zamku — svaki igrač je proverava sam. */
  async function checkTraps(d) {
    const pos = Geo.pos, me = d.me;
    if (!pos || !me || me.alive === false) { dwell.clear(); return; }
    const now = d.now;
    const live = new Set();

    for (const [tid, t] of Object.entries(Store.traps())) {
      if (t.triggeredBy || t.ownerId === Store.myId) continue;
      if (U.dist(pos, t) > R.TRAP_RADIUS_M) continue;
      live.add(tid);
      if (!dwell.has(tid)) { dwell.set(tid, now); continue; }        // tek sam ušao
      if (now - dwell.get(tid) < R.TRAP_DWELL_MS) continue;          // još se nisam zadržao
      dwell.delete(tid);

      await Store.ref(`traps/${tid}/triggeredBy`).set(Store.myId);
      const mul = t.power || 1;
      if (t.type === 'basic') {
        const hp = Math.max(0, me.hp - Math.round(Math.abs(R.ITEMS.trapBasic.hp) * mul));
        await Store.updateMe({ hp });
        Haptics.fire('hurt'); Sfx.hurt();
        if (hp <= 0) { Engine.die('trap', t.ownerId); return; }
      } else if (t.type === 'alarm') {
        await Store.updateMe({ revealedUntilMs: now + R.ITEMS.trapAlarm.revealMs });
        await Store.pushFeed({ type: 'alarm', subjectId: Store.myId, scope: 'all' });
      } else if (t.type === 'tracker') {
        await Store.updateMe({ trackedBy: t.ownerId, trackedUntilMs: now + R.ITEMS.trapTracker.trackMs });
      } else if (t.type === 'net') {
        /* Popravljeno: stara mreža je pisala `cannotFleeUntilMs`, a to je čitao
           samo Combat.flee kog više nema. Pošto se sada napada kamerom,
           „uhvaćen u mrežu" prirodno znači da ti kamera ne radi — pa ne možeš
           ni da napadaš ni da uzimaš predmete. To je priprema za ubistvo,
           što je i bila prvobitna namera predmeta. */
        await Store.updateMe({ cameraBlockedUntilMs: now + R.ITEMS.trapNet.blocksCameraMs });
        if (t.ownerId) await Store.ref(`players/${t.ownerId}/nettedTarget`).set({ id: Store.myId, untilMs: now + R.ITEMS.trapNet.blocksCameraMs });
      }
      Haptics.fire('hurt');
      toast(T('trapHit'), 'danger', 'trap');
    }
    // izašao si iz kruga pre nego što je isteklo → brojanje kreće iz početka
    for (const tid of [...dwell.keys()]) if (!live.has(tid)) dwell.delete(tid);
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

  return { visible, nearest, pickupAllowed, runPickup, take, use, drop, inv, checkTraps, visibleTraps, swapDialog, sparks, collectSpark, setDecoy };
})();
