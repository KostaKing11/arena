/* ═══════════════════════════════════════════════════════════════════════════
   ENGINE — otkucaj igre.

   Nema servera, pa svaki telefon radi tri stvari:
   1. iz `schedule` i sata IZVODI stanje sveta (zona, eventovi) — bez pisanja
   2. SEBI primenjuje glad, žeđ i štetu, na osnovu proteklog vremena (§0.5)
   3. ako je host, gura zajedničke prelaze stanja

   Sve ostalo je čitanje.
   ═══════════════════════════════════════════════════════════════════════════ */
const Engine = (() => {
  'use strict';

  let timer = null, lastMs = 0, booted = false;
  const listeners = [];
  const seen = { deaths: new Set(), feed: new Set(), zonePhase: -1, events: new Set(), myEvents: new Set() };
  let derived = null;
  let lastPosWrite = 0;

  const emit = (t, d) => listeners.forEach((f) => { try { f(t, d); } catch (e) { console.error(e); } });
  const on = (f) => listeners.push(f);

  /* ═══════════════ izvedeno stanje sveta ═══════════════ */
  function derive() {
    const now = Clock.now();
    const cfg = Store.config(), sch = Store.schedule(), meta = Store.meta();
    const me = Store.me();
    const state = meta.state || 'LOBBY';
    const started = meta.startedAtMs || 0;
    const paused = !!meta.pausedAtMs;

    const out = {
      now, state, paused, cfg, me,
      zone: null, firewall: null, wasps: null, night: false, drought: false,
      outsideZone: false, distToZone: 0, elapsedMs: started ? now - started : 0,
      endsAtMs: started && cfg.durationMin ? started + cfg.durationMin * 60000 : 0,
    };
    if (!cfg || !cfg.center) return out;

    if (sch && started && (state === 'LIVE' || state === 'FINAL_TWO' || state === 'END')) {
      const z = R.zoneAt(sch, cfg, now);
      out.zone = z;
      // FINAL_TWO: zona se skuplja duplo brže do poslednjih 40 m (§18)
      if (state === 'FINAL_TWO' && z.radiusM > 20) out.zone = { ...z, radiusM: Math.max(20, z.radiusM * 0.5) };

      /* Dan i noć nisu događaj nego ritam: 5 min svetla, 5 min mraka, uvek
         počevši danom. Zato se izvode iz sata, a ne iz rasporeda. */
      out.day = R.dayPhase(started, now);
      out.night = out.day.night;

      for (const ev of (sch.events || [])) {
        if (now < ev.atMs - (ev.warnMs || 0) || now > ev.endMs + 2000) continue;
        if (now >= ev.atMs) {
          if (ev.type === 'drought') out.drought = true;
          if (ev.type === 'wasps') out.wasps = ev;
          if (ev.type === 'firewall') out.firewall = R.firewallAt(ev, cfg, now);
        }
        if (!seen.events.has(ev.id) && now >= ev.atMs - (ev.warnMs || 0)) {
          seen.events.add(ev.id);
          emit('eventWarn', ev);
        }
      }
      // eventovi koje su kupili tvorci igara stoje u `liveEvents`
      const live = (Store.room && Store.room.liveEvents) || {};
      for (const k of Object.keys(live)) {
        const ev = live[k];
        if (now < ev.atMs || now > ev.endMs) continue;
        if (ev.type === 'drought') out.drought = true;
        if (ev.type === 'wasps') out.wasps = ev;
        if (ev.type === 'firewall') out.firewall = R.firewallAt(ev, cfg, now);
      }
    }

    const pos = Geo.pos;
    if (pos && out.zone) {
      const d = U.dist(pos, out.zone.center);
      out.distToZone = Math.max(0, d - out.zone.radiusM);
      out.outsideZone = d > out.zone.radiusM;
    }
    /* Duh ne gubi život ni u zoni ni van nje — mrtav je. Ali njegovo mesto je
       VAN zone: unutra samo zbunjuje žive, a iskri tamo ionako nema.
       Bez GPS očitavanja ne tvrdimo ništa — inače bi duh koji je tek upalio
       telefon dobio prekor da je u zoni. */
    const isGhost = !!(me && me.alive === false);
    out.ghostOutside = !!(isGhost && pos && out.zone && out.outsideZone);
    out.ghostInZone = !!(isGhost && pos && out.zone && !out.outsideZone);
    if (pos && out.wasps) out.inWasps = U.dist(pos, { lat: out.wasps.lat, lng: out.wasps.lng }) <= out.wasps.radiusM;
    if (pos && out.firewall) out.inFire = U.distToLine(pos, out.firewall.a, out.firewall.b) <= out.firewall.widthM / 2;

    // zone dima — računaju se iz spiska igrača, bez posebnog čvora u bazi
    out.smoke = R.smokeZones(Store.players(), now);
    out.inSmoke = R.inSmoke(out.smoke, pos);

    // vidljivost
    if (me) {
      out.vision = R.visionFor(me, { night: out.night, hasLight: hasActive(me, 'light') });
      out.effects = R.activeEffects(me, now);
      out.penalty = out.vision.penalty;
    }
    return out;
  }
  function hasActive(p, kind) {
    const now = Clock.now();
    if (kind === 'light') return (p && p.torchUntilMs || 0) > now;
    return false;
  }

  /* ═══════════════ moj otkucaj ═══════════════ */
  async function tickSelf(d) {
    const me = d.me;
    if (!me || me.alive === false) return;
    if (d.state !== 'LIVE' && d.state !== 'FINAL_TWO') return;

    const now = d.now;
    const last = me.lastTickMs || now;
    const elapsed = now - last;
    if (elapsed < 900) return;

    /* Zadatak mentora ide u OVOM prolazu — ne pravi sebi zaseban otkucaj.
       Nagradu u životu NE upisuje sam nego je vraća, pa da je `survivalTick`
       ispod ne prepiše vrednošću koju je izračunao iz stanja PRE lečenja. */
    const questHeal = await checkQuest(d, me);

    const cls = R.CLASSES[me.classId];
    const patch = R.survivalTick(me, cls, elapsed, {
      nowMs: now,
      frozen: d.paused,
      drought: d.drought,
      outsideZone: d.outsideZone,
      zoneDmgPer10s: d.zone ? d.zone.dmgPer10s : 0,
      inWasps: !!d.inWasps,
      // otrov NAMERNO ne ide ovde: otkucava ga Attack.tick, koji je jedini
      // vlasnik polja `poisonUntilMs`. Da ga i survivalTick broji, šteta bi
      // se primenjivala dvaput.
    });
    if (!patch) return;

    // zid vatre je trenutna smrt (§15)
    if (d.inFire && !d.paused) { patch.hp = 0; patch._cause = 'fire'; }

    if (questHeal) patch.hp = Math.min(me.maxHp || 100, patch.hp + questHeal);
    if (patch.hp <= 0) return die(patch._cause || causeOf(d));
    const w = { hunger: patch.hunger, thirst: patch.thirst, hp: patch.hp, lastTickMs: patch.lastTickMs };
    // Traker ose ostavljaju halucinacije još 5 minuta pošto izađeš (§15)
    if (d.inWasps) {
      const until = now + R.HALLUCINATION_MS;
      if (((me.effects && me.effects.hallucinateUntil) || 0) < until - 30000) {
        w['effects/hallucinateUntil'] = until;
      }
    }
    await Store.updateMe(w);
    warnLow(me, patch);
  }

  /* Zadatak od mentora: ponuda, ne naredba. Tribut ga sme ignorisati — istekne
     za 5 minuta i mentor dobija pravo na sledeći. Proveru radi tributov telefon,
     jer je to njegov čvor (§0.2), a nagradu (+HP njemu, +naklonost mentoru)
     upisuje istim potezom. */
  async function checkQuest(d, me) {
    const q = me.quest;
    if (!q || !q.id) return 0;
    const now = d.now;

    if (R.questExpired(q, now)) {
      await Store.updateMe({ quest: null });
      emit('questExpired', q);
      return 0;
    }

    /* Kornukopija se pamti u dva koraka: uđi pa izađi živ. Bez zapamćenog
       ulaska bi zadatak bio ispunjen time što nikad nisi ni prišao. */
    const cfg = d.cfg || {};
    const inCorn = !!(Geo.pos && cfg.center && U.dist(Geo.pos, cfg.center) <= R.CORN_RADIUS_M);
    if (inCorn && !q.cornVisited) {
      await Store.ref(`players/${Store.myId}/quest/cornVisited`).set(true);
      return 0;                                // izlazak se broji tek sledeći otkucaj
    }

    if (!R.questSatisfied(q.id, me, q, { inCorn })) return 0;

    await Store.updateMe({ quest: null, questsDone: (me.questsDone || 0) + 1 });
    await Mentor.awardFavor(Store.myId, 'questDone');
    emit('questDone', q);
    return R.QUEST_HEAL;                       // život dodaje otkucaj koji ga i računa
  }

  function causeOf(d) {
    if (d.outsideZone) return 'zone';
    const me = d.me;
    if (me.thirst <= 0) return 'thirst';
    if (me.hunger <= 0) return 'hunger';
    return 'zone';
  }

  let warned = { hunger: false, thirst: false };
  function warnLow(me, patch) {
    for (const k of ['hunger', 'thirst']) {
      if (patch[k] < R.SURVIVAL.lowWarn && !warned[k]) {
        warned[k] = true;
        Haptics.fire('alert');
        toast(T(k === 'hunger' ? 'hungerLow' : 'thirstLow'), 'gold', k === 'hunger' ? 'meat' : 'droplet');
      }
      if (patch[k] > R.SURVIVAL.lowWarn + 10) warned[k] = false;
    }
  }

  /** Smrt — moj klijent je upisuje, svi je vide iz baze (§16). */
  async function die(cause, killerId) {
    const me = Store.me();
    if (!me || me.alive === false) return;
    await Store.updateMe({
      alive: false, hp: 0, deathAtMs: Clock.now(),
      killedBy: killerId || null, deathCause: cause || 'zone',
    });
    // sve što je nosio pada na zemlju (§8)
    await dropAll(me);
    await Store.pushFeed({ type: 'death', subjectId: Store.myId, scope: 'all', cause: cause || 'zone', killerId: killerId || null });
    emit('died', { cause });
  }

  async function dropAll(me) {
    const pos = Geo.pos;
    if (!pos) return;
    const inv = (me.inv || []).filter(Boolean);
    for (const s of inv) {
      const it = R.ITEMS[s.itemType];
      await Store.dropItem(s.itemType, it ? it.rarity : 'common', pos.lat, pos.lng, s.qty || 1);
    }
    if (me.weapon && me.weapon !== 'fists') {
      const key = 'w' + me.weapon.charAt(0).toUpperCase() + me.weapon.slice(1);
      if (R.ITEMS[key]) await Store.dropItem(key, R.ITEMS[key].rarity, pos.lat, pos.lng, 1);
    }
    await Store.updateMe({ inv: null, weapon: 'fists', arrows: 0 });
  }

  /* ═══════════════ pozicija ═══════════════ */
  let lastMovePos = null;
  async function tickPos(d) {
    const pos = Geo.pos;
    if (!pos || !Store.myId) return;
    if (!Geo.shouldWrite(d.now)) return;
    Geo.markWritten(d.now);

    /* `lastMoveMs` je anti-varanje (borba v4 §10): ko se nije pomerio 20 m u
       poslednjih 5 minuta ne sme da napada. Beleži se samo pravi pomeraj, ne
       podrhtavanje GPS-a. */
    const patch = {
      pos: { lat: pos.lat, lng: pos.lng, accM: Math.round(pos.accM), atMs: d.now },
      distanceWalkedM: Math.round(Geo.walkedM),
      online: true, lastSeenMs: Store.SV(),
    };
    if (!lastMovePos || U.dist(lastMovePos, pos) > R.STALE_MOVE_M) {
      lastMovePos = { lat: pos.lat, lng: pos.lng };
      patch.lastMoveMs = d.now;
    }
    // smer u kom gledaš — treba Senki da zna da li joj je meta okrenuta leđima
    if (Compass.heading != null) patch.headingDeg = Math.round(Compass.heading);
    await Store.updateMe(patch);
  }

  /* ═══════════════ host: prelazi stanja ═══════════════ */
  async function tickHost(d) {
    if (!Store.isHost()) return;
    const meta = Store.meta(), cfg = Store.config(), now = d.now;
    const P = Store.players();
    const ids = Object.keys(P);
    const aliveIds = ids.filter((id) => P[id].alive !== false);

    if (meta.state === 'PREP') {
      const everyone = ids.every((id) => P[id].arrived || P[id].isBot);
      const expired = meta.prepEndsAtMs && now >= meta.prepEndsAtMs;
      if ((everyone || expired) && !meta.countdownAtMs) {
        await Store.hostUpdate('meta', { countdownAtMs: now + 10000 });
      }
      if (meta.countdownAtMs && now >= meta.countdownAtMs) await beginLive(expired && !everyone);
    }

    if (meta.state === 'LIVE') {
      if (aliveIds.length === 2) {
        await Store.hostUpdate('meta', { state: 'FINAL_TWO' });
        await Store.pushFeed({ type: 'finalTwo', scope: 'all' });
      } else if (aliveIds.length <= 1) await endGame(aliveIds[0]);
      else if (d.endsAtMs && now > d.endsAtMs + 120000) await endGame(null);
    }
    if (meta.state === 'FINAL_TWO' && aliveIds.length <= 1) await endGame(aliveIds[0]);

    /* Onesvešćen posle 3 min bez veze (§21) — ali NE i onaj kome se prosto
       ugasio ekran. Dok je aplikacija skrivena GPS ne radi i telefon ne piše,
       pa bi svako zaključavanje ekrana obaralo igrača u nesvest. Igrač zato pri
       odlasku u pozadinu sam prijavi `hiddenAtMs`, i dok to stoji brojač miruje.

       Nije rupa: nesvest je kazna (otkriva te svima na mapi), ne zaklon —
       niko neće skrivati aplikaciju da bi je izbegao. Ostaje kazna za onog ko
       je stvarno izgubio vezu ili otišao kući. */
    for (const id of aliveIds) {
      const p = P[id];
      if (p.isBot) continue;
      const gone = R.isUnconscious(p, now);
      if (gone && !p.unconscious) await Store.ref(`players/${id}/unconscious`).set(true);
      if (!gone && p.unconscious) await Store.ref(`players/${id}/unconscious`).remove();
    }

    if (meta.state === 'LIVE' || meta.state === 'FINAL_TWO') {
      await maintainItems(d);
      await maintainDrops(d);
      await mentorFavor(d, P, aliveIds);
    }
  }

  /* ═══════════════ naklonost za mentore (§17b) ═══════════════
     Dve stvari koje niko pojedinačno ne „uradi", pa ih broji domaćin: preživeti
     skupljanje zone i ući u poslednjih pet. Sve ostalo (ubistvo, legendarni
     predmet, zadatak) upisuje onaj kome se desilo, na svom telefonu.

     Mora domaćin i mora JEDNOM: kad bi svaki telefon nagrađivao, ista zona bi
     se platila onoliko puta koliko ima igrača u sobi. */
  let favorPhase = -1, finalFiveDone = false;
  async function mentorFavor(d, P, aliveIds) {
    if (!d.zone) return;

    /* Zona se slegla u novu fazu — nagradi svakog ko je tada unutra.
       Prvo viđenje se samo zapamti: domaćin koji se priključi usred partije
       zatiče fazu 3 i ne sme da isplati tri skupljanja koja nije video. Zato
       se pamti i faza 0 — inače bi baš PRVO skupljanje ostalo neplaćeno. */
    const ph = d.zone.phase || 0;
    if (favorPhase < 0) favorPhase = ph;
    else if (ph > favorPhase) {
      for (const id of aliveIds) {
        const p = P[id];
        if (!p.pos) continue;
        if (U.dist(p.pos, d.zone.center) > d.zone.radiusM) continue;
        await Mentor.awardFavor(id, 'survivedShrink');
      }
      favorPhase = ph;
    }

    // poslednjih pet — jednom po partiji, svima koji su tada još živi
    if (!finalFiveDone && aliveIds.length > 0 && aliveIds.length <= 5) {
      finalFiveDone = true;
      for (const id of aliveIds) await Mentor.awardFavor(id, 'finalFive');
    }
  }

  async function beginLive(late) {
    const cfg = Store.config(), P = Store.players();
    const ids = Object.keys(P);
    const now = Clock.now();
    const seed = (Store.room && Store.room.seed) || 'seed';
    const sch = R.buildSchedule(seed, cfg, now);

    // kazna srazmerna udaljenosti za one koji nisu stigli (§4)
    if (late) {
      for (const id of ids) {
        const p = P[id];
        if (p.arrived || !p.pos || !p.startPos) continue;
        const m = U.dist(p.pos, p.startPos);
        const pen = Math.min(15, Math.floor(m / 10));
        if (pen > 0) {
          await Store.ref(`players/${id}`).update({
            hp: Math.max(1, (p.hp || 100) - pen),
            hunger: Math.max(0, (p.hunger || 100) - pen * 2),
            thirst: Math.max(0, (p.thirst || 100) - pen * 2),
          });
        }
      }
    }
    for (const id of ids) await Store.ref(`players/${id}/lastTickMs`).set(now);
    await Store.hostUpdate('', { schedule: sch });
    await Store.hostUpdate('meta', { state: 'LIVE', startedAtMs: now, countdownAtMs: null });
    await Store.pushFeed({ type: 'start', scope: 'all' });
  }

  async function endGame(winnerId) {
    /* Pobednik se bira iz snimka „ko je još živ", a zona ume da pokosi i njega
       u istom otkucaju. Zato se pred upis još jednom proveri: mrtav pobednik
       se ne upisuje, partija onda nema pobednika. */
    const cand = winnerId && Store.players()[winnerId];
    if (cand && cand.alive === false) winnerId = null;
    await Store.hostUpdate('meta', { state: 'END', endedAtMs: Clock.now(), winnerId: winnerId || null });
    await Store.pushFeed({ type: 'end', subjectId: winnerId || null, scope: 'all' });
    Store.wipeFaces();                 // §21 — slike lica se brišu na kraju
  }

  /* — obnavljanje i seljenje predmeta (§13) — */
  let itemMaintAt = 0;
  async function maintainItems(d) {
    if (d.now - itemMaintAt < 20000) return;
    itemMaintAt = d.now;
    const cfg = Store.config(), items = Store.items();
    const seed = (Store.room && Store.room.seed) || 's';
    const rng = U.rngFor(seed, 'maint', Math.floor(d.now / 20000));
    const upd = {};
    let n = 0;
    for (const [iid, it] of Object.entries(items)) {
      if (it.takenBy && R.isRenewable(it.type) && !it.respawned) {
        // hrana i voda se obnavljaju drugde 90 s posle uzimanja
        if (d.now - (it.takenAtMs || it.spawnedAtMs || 0) > R.ITEM_RESPAWN_MS) {
          const p = U.pointInCircle(rng, cfg.center, Math.max(30, cfg.diameterM / 2 - R.EDGE_MARGIN_M), 25);
          upd[`${iid}/respawned`] = true;
          const nid = U.uid('r');
          await Store.ref(`items/${nid}`).set({ type: it.type, rarity: it.rarity, lat: p.lat, lng: p.lng, spawnedAtMs: d.now });
          if (++n > 4) break;
        }
      }
      /* Mamac se nikad ne seli, ne obnavlja i ne uvlači u zonu — a nestaje
         kad njegov vlasnik pogine, da ne ostane da vara i posle njega. */
      if (it.decoyFake) {
        const owner = Store.players()[it.ownerId];
        if (!owner || owner.alive === false) await Store.ref(`items/${iid}`).remove();
        continue;
      }
      // predmet koji niko ne uzme 10 min se seli
      if (!it.takenBy && d.now - (it.spawnedAtMs || 0) > R.ITEM_MOVE_MS && !it.dropped) {
        const p = U.pointInCircle(rng, cfg.center, Math.max(30, cfg.diameterM / 2 - R.EDGE_MARGIN_M), 20);
        upd[`${iid}/lat`] = p.lat; upd[`${iid}/lng`] = p.lng; upd[`${iid}/spawnedAtMs`] = d.now;
        if (++n > 4) break;
      }
      // kad se zona skupi, predmeti van nje ulaze unutra
      if (!it.takenBy && d.zone && U.dist(it, d.zone.center) > d.zone.radiusM) {
        const p = U.pointInCircle(rng, d.zone.center, Math.max(15, d.zone.radiusM * 0.85));
        upd[`${iid}/lat`] = p.lat; upd[`${iid}/lng`] = p.lng;
        if (++n > 4) break;
      }
    }
    if (Object.keys(upd).length) await Store.hostUpdate('items', upd);
  }

  /* — gozba i sanduk sa zalihama stvarno spuštaju predmete (§15, §16) — */
  const droppedFor = new Set();
  async function maintainDrops(d) {
    const sch = Store.schedule(), cfg = Store.config();
    const live = (Store.room && Store.room.liveEvents) || {};
    const all = [...((sch && sch.events) || []), ...Object.values(live)];
    for (const ev of all) {
      if (ev.type !== 'feast' && ev.type !== 'supplyBox') continue;
      if (d.now < ev.atMs || droppedFor.has(ev.id)) continue;
      droppedFor.add(ev.id);
      const rng = U.rngFor(ev.id, 'drop');
      const n = ev.type === 'feast' ? (R.EVENTS.feast.items || 6) : 3;
      // gozba je na kornukopiji, sanduk na neutralnom mestu
      const center = ev.type === 'feast' ? cfg.center : U.pointInCircle(rng, cfg.center, cfg.diameterM * 0.3, 40);
      const pts = U.scatter(rng, center, ev.type === 'feast' ? 25 : 8, 0, n, 4, []);
      const upd = {};
      pts.forEach((p, i) => {
        const rarity = U.weighted(rng, ev.type === 'feast' ? { rare: 30, epic: 50, legendary: 20 } : { uncommon: 40, rare: 45, epic: 15 });
        const pool = R.ITEM_IDS.filter((id) => R.ITEMS[id].rarity === rarity);
        upd[`${ev.id}_${i}`] = {
          type: U.pick(rng, pool), rarity, lat: p.lat, lng: p.lng,
          spawnedAtMs: d.now, dropped: true,
        };
      });
      await Store.hostUpdate('items', upd);
      await Store.pushFeed({ type: 'event', eventType: ev.type, scope: 'all' });
    }
  }

  /* ═══════════════ posmatranje promena za obaveštenja ═══════════════ */
  function watchWorld(d) {
    // top na svaku smrt
    const P = Store.players();
    for (const [id, p] of Object.entries(P)) {
      if (p.alive === false && p.deathAtMs && !seen.deaths.has(id)) {
        seen.deaths.add(id);
        if (booted) { Sfx.cannon(); Haptics.fire('cannon'); emit('cannon', { id, p }); }
      }
    }
    // upozorenje pred skupljanje zone
    if (d.zone && d.zone.next) {
      const ph = d.zone.next.i;
      if (d.zone.warn && seen.zonePhase !== ph) {
        seen.zonePhase = ph;
        Haptics.fire('zoneWarn'); Sfx.warn();
        emit('zoneWarn', d.zone.next);
      }
    }
    /* Kupljeni event se stvarno pokrenuo — javi ONOM ko ga je platio.
       Ovo NE sme u `tickHost`: kupac najčešće nije domaćin, pa bi isplatu
       gledao neko treći. Zato stoji ovde, u petlji koju vrti svaki telefon. */
    const live = (Store.room && Store.room.liveEvents) || {};
    for (const ev of Object.values(live)) {
      // isplata ide SVIMA koji su glasali; `buyerId` je tu radi starih zapisa
      const mine = (ev.buyerIds || []).includes(Store.myId) || ev.buyerId === Store.myId;
      if (!ev || !mine) continue;
      if (d.now < ev.atMs || seen.myEvents.has(ev.id)) continue;
      seen.myEvents.add(ev.id);
      if (booted) emit('myEvent', ev);
    }
  }

  /* ═══════════════ petlja ═══════════════ */
  function start() {
    if (timer) return;
    lastMs = Clock.now();
    timer = setInterval(step, 1000);
    step();
  }
  function stop() { clearInterval(timer); timer = null; }

  async function step() {
    if (!Store.room) return;
    const d = derive();
    derived = d;
    try {
      await tickPos(d);
      await tickSelf(d);
      await tickHost(d);
      watchWorld(d);
      if (typeof Bots !== 'undefined' && Store.isHost() && Store.config().botsEnabled) Bots.step(d);
    } catch (e) { console.error('tick', e); }
    emit('tick', d);
    booted = true;
  }

  return {
    start, stop, on, derive, die, dropAll,
    get d() { return derived || derive(); },
    resetSeen() {
      seen.deaths.clear(); seen.feed.clear(); seen.events.clear(); seen.myEvents.clear();
      seen.zonePhase = -1; favorPhase = -1; finalFiveDone = false; booted = false;
    },
  };
})();
