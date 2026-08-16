/* ═══════════════════════════════════════════════════════════════════════════
   STORE — sve što dodiruje Firebase. Struktura je iz §22.

   Pravila pisanja (§0.2, §21):
   · igrač piše ISKLJUČIVO svoj `players/{myId}`
   · host piše `meta`, `config`, `schedule`, `items`, i sve što je zajedničko
   · takmičenje za isti predmet / otvaranje borbe ide kroz transakciju

   Odstupanje od §22 koje je namerno: slike lica stoje u `faces/{pid}`, a u
   `players` je samo `hasFace`. Inače bi svaki telefon na ulasku povukao
   48 × 20 KB slika koje mu tog trenutka ne trebaju.
   ═══════════════════════════════════════════════════════════════════════════ */
const Store = (() => {
  'use strict';

  let db = null, auth = null, ready = false;
  let code = null, myId = null, roomRef = null, room = null;
  const handlers = {};
  const emit = (t, m) => (handlers[t] || []).forEach((f) => { try { f(m); } catch (e) { console.error(e); } });
  const on = (t, f) => { (handlers[t] = handlers[t] || []).push(f); return API; };

  const EMU = new URLSearchParams(location.search).get('emu') === '1';
  /* Zapis o partiji u kojoj si. Igra se na ulici: ekran se gasi, prođe pet
     minuta, upališ ga — i moraš da nastaviš tamo gde si stao, bez lobija i bez
     pitanja. `atMs` je tu da se vidi koliko je zapis star. */
  const SESS_KEY = 'arena.session';
  const sess = {
    get all() {
      try { return JSON.parse(localStorage.getItem(SESS_KEY) || 'null'); } catch { return null; }
    },
    get code() { return (sess.all || {}).room || null; },
    get pid() { return (sess.all || {}).pid || null; },
    get atMs() { return (sess.all || {}).atMs || 0; },
    save(c, p) {
      try { localStorage.setItem(SESS_KEY, JSON.stringify({ room: c, pid: p, atMs: Clock.now() })); } catch {}
    },
    /** Upiši samo ako fali ili se razlikuje — zove se iz petlje prikaza. */
    ensure(c, p) {
      if (!c || !p) return;
      if (sess.code === c && sess.pid === p) return;
      sess.save(c, p);
    },
    clear() { try { localStorage.removeItem(SESS_KEY); } catch {} },
  };

  const ref = (p) => db.ref(p ? `rooms/${code}/${p}` : `rooms/${code}`);
  const SV = () => firebase.database.ServerValue.TIMESTAMP;

  /* ───────────────────────── veza ───────────────────────── */
  async function connect() {
    if (!window.firebase) { emit('nocfg'); return false; }
    const CFG = typeof FIREBASE_CONFIG !== 'undefined' ? FIREBASE_CONFIG : null;
    if (!EMU && (!CFG || CFG.apiKey === 'PASTE_ME')) { emit('nocfg'); return false; }
    try {
      const host = location.hostname || '127.0.0.1';
      firebase.initializeApp(EMU ? {
        apiKey: 'demo', projectId: 'demo-arena', authDomain: 'demo-arena.firebaseapp.com',
        databaseURL: `http://${host}:9000?ns=demo-arena-default-rtdb`,
      } : CFG);
      db = firebase.database();
      auth = firebase.auth();
      if (EMU) { db.useEmulator(host, 9000); auth.useEmulator(`http://${host}:9099`, { disableWarnings: true }); }
      await auth.signInAnonymously();
      Clock.attach(db);
      // `.info/connected` prvo javi false dok se veza tek uspostavlja — to nije
      // prekid. "Izgubljena veza" se prijavljuje tek ako smo ranije bili online.
      let everOnline = false;
      db.ref('.info/connected').on('value', (s) => {
        const up = s.val() === true;
        if (up) { everOnline = true; emit('online'); if (myId && roomRef) presence(); }
        else if (everOnline) emit('offline');
      });
      ready = true;
      emit('ready');
      return true;
    } catch (e) {
      console.error('Firebase:', e);
      emit('error', { msg: 'Firebase: ' + (e.message || e) });
      return false;
    }
  }

  function presence() {
    const r = ref(`players/${myId}/lastSeenMs`);
    r.onDisconnect().set(SV());
    r.set(SV());
    ref(`players/${myId}/online`).onDisconnect().set(false);
    ref(`players/${myId}/online`).set(true);
  }

  /* ───────────────────────── sobe ───────────────────────── */
  function blankPlayer(name, avatar) {
    return {
      name: String(name || 'Tribut').slice(0, 16),
      avatar: avatar || null,
      online: true, alive: true,
      hp: 100, maxHp: 100, hunger: 100, thirst: 100,
      kills: 0, distanceWalkedM: 0, fights: 0, damageDone: 0, itemsTaken: 0, dirtyWaterDrunk: 0,
      capacity: R.BASE_SLOTS, weapon: 'fists', arrows: 0,
      ready: false, arrived: false,
      perms: { location: false, camera: false, compass: false },
      hasFace: false,
      joinedAt: SV(),
    };
  }

  async function createRoom(name, avatar, opts) {
    for (let i = 0; i < 6; i++) {
      const c = U.roomCode();
      const t = await db.ref(`rooms/${c}/createdAt`).transaction((cur) => (cur === null ? Date.now() : undefined));
      if (!t.committed) continue;
      code = c; myId = U.uid('p');
      await db.ref(`rooms/${c}`).update({
        meta: { hostId: myId, state: 'LOBBY', lang: LANG, createdAt: Date.now() },
        seed: Math.floor(Math.random() * 2 ** 31).toString(36),
        config: {
          center: null, diameterM: 500, durationMin: 45, itemDensity: 1,
          prepMinutes: 10, startMode: 'cornucopia', eventsEnabled: true,
          botsEnabled: !!(opts && opts.bots), botCount: (opts && opts.botCount) || 5,
        },
        [`players/${myId}`]: blankPlayer(name, avatar),
      });
      return attach();
    }
    emit('error', { msg: T('roomNotFound') });
    return false;
  }

  async function joinRoom(c, name, avatar) {
    c = String(c || '').toUpperCase().trim();
    const snap = await db.ref(`rooms/${c}`).get();
    if (!snap.exists()) { emit('error', { msg: T('roomNotFound') }); return false; }
    const r = snap.val();
    if (r.meta && r.meta.state !== 'LOBBY') { emit('error', { msg: T('gameStarted') }); return false; }
    if (Object.keys(r.players || {}).length >= R.MAX_PLAYERS) { emit('error', { msg: T('roomFull') }); return false; }
    code = c; myId = U.uid('p');
    await db.ref(`rooms/${c}/players/${myId}`).set(blankPlayer(name, avatar));
    return attach();
  }

  async function rejoin(c, pid) {
    c = String(c || '').toUpperCase().trim();
    const s = await db.ref(`rooms/${c}/players/${pid}`).get();
    if (!s.exists()) { sess.clear(); return false; }
    code = c; myId = pid;
    return attach();
  }

  /* Povratak posle ugašenog ekrana. Slušalac se sam oporavi kad se veza vrati,
     ali to traje — a igrač u međuvremenu gleda sliku od pre pet minuta i po
     njoj donosi odluke. Zato se pre prvog crtanja povuče svež snimak sa
     servera. Sat se sinhronizuje sam, preko `.info/serverTimeOffset`. */
  async function resync() {
    if (!roomRef) return false;
    try {
      const s = await roomRef.get();
      const v = s.val();
      if (!v) { emit('roomGone'); return false; }
      room = v;
      emit('room', room);
      return true;
    } catch { return false; }
  }

  /** Gledanje sobe bez igranja — mentor i gledalac nemaju svoj players/{pid}. */
  async function watchRoom(c) {
    c = String(c || '').toUpperCase().trim();
    const s = await db.ref(`rooms/${c}`).get();
    if (!s.exists()) { emit('error', { msg: T('roomNotFound') }); return false; }
    code = c; myId = null;
    roomRef = db.ref(`rooms/${code}`);
    roomRef.on('value', (snap) => {
      room = snap.val() || null;
      if (!room) { emit('roomGone'); return; }
      emit('room', room);
    });
    emit('watching', { code });
    return true;
  }

  /* Vraća tek kad stigne PRVI snimak sobe. Ranije je vraćalo odmah, pa je
     pozivalac koji odmah pita `state()` dobijao podrazumevani 'LOBBY' — zbog
     toga je povratak u partiju koja traje i dalje pitao „vrati se u arenu?". */
  function attach() {
    sess.save(code, myId);
    roomRef = db.ref(`rooms/${code}`);
    return new Promise((res) => {
      let first = true;
      const done = () => { if (first) { first = false; res(true); } };
      roomRef.on('value', (s) => {
        room = s.val() || null;
        done();
        if (!room) { emit('roomGone'); return; }
        emit('room', room);
      });
      presence();
      emit('joined', { code, myId });
      setTimeout(done, 4000);              // slaba veza ne sme da zaglavi ulazak
    });
  }

  /** Izlazak iz sobe: obriši i sebe iz baze ako igra još nije počela. */
  async function leave(removeSelf) {
    try {
      if (removeSelf && roomRef && myId && state() === 'LOBBY') {
        await ref(`players/${myId}`).remove();
        // ako je domaćin izašao, prvi sledeći koji je ušao preuzima sobu (§21)
        if (meta().hostId === myId) {
          const rest = Object.entries(players()).filter(([id, p]) => id !== myId && !p.isBot)
            .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
          if (rest.length) await ref('meta/hostId').set(rest[0][0]);
          else await roomRef.remove();
        }
      }
    } catch (e) { console.warn('leave', e); }
    if (roomRef) roomRef.off();
    sess.clear();
    room = null; code = null; myId = null; roomRef = null;
  }

  /* ───────────────────────── čitanje ───────────────────────── */
  const meta = () => (room && room.meta) || {};
  const config = () => (room && room.config) || {};
  const schedule = () => (room && room.schedule) || null;
  const players = () => (room && room.players) || {};
  const me = () => players()[myId] || null;
  const isHost = () => meta().hostId === myId;
  const state = () => meta().state || 'LOBBY';
  const items = () => (room && room.items) || {};
  const traps = () => (room && room.traps) || {};
  const feed = () => (room && room.feed) || {};
  const alive = () => Object.entries(players()).filter(([, p]) => p.alive !== false);
  const playerCount = () => Object.keys(players()).length;

  /* ───────────────────────── pisanje ───────────────────────── */
  // Igrač piše samo svoj čvor (§0.2)
  function updateMe(patch) {
    if (!myId || !patch) return Promise.resolve();
    return ref(`players/${myId}`).update(patch);
  }
  function setMe(path, val) { return ref(`players/${myId}/${path}`).set(val); }

  // Host piše zajedničko
  function hostUpdate(path, val) {
    if (!isHost()) return Promise.resolve();
    return path ? ref(path).update(val) : roomRef.update(val);
  }
  function hostSet(path, val) {
    if (!isHost()) return Promise.resolve();
    return ref(path).set(val);
  }

  function pushFeed(entry) {
    return ref('feed').push({ atMs: Clock.now(), ...entry });
  }

  /* — slike lica stoje odvojeno, da se ne vuku bez potrebe — */
  function saveFace(dataUrl) {
    return Promise.all([
      db.ref(`faces/${code}/${myId}`).set(dataUrl),
      setMe('hasFace', true),
    ]);
  }
  async function loadFace(pid) {
    try { const s = await db.ref(`faces/${code}/${pid}`).get(); return s.val(); } catch { return null; }
  }
  function wipeFaces() { return db.ref(`faces/${code}`).remove(); }

  /* — predmeti: transakcija da dvoje ne uzmu isti (§12) — */
  async function claimItem(iid) {
    const t = await ref(`items/${iid}/takenBy`).transaction((cur) => (cur == null ? myId : undefined));
    return t.committed;
  }
  function releaseItem(iid) { return ref(`items/${iid}/takenBy`).remove(); }
  function dropItem(itemType, rarity, lat, lng, qty) {
    const id = U.uid('d');
    return ref(`items/${id}`).set({
      type: itemType, rarity: rarity || 'common', lat, lng,
      spawnedAtMs: Clock.now(), qty: qty || 1, dropped: true,
    }).then(() => id);
  }

  /* — udarci (borba v4 §11) —
     Nema više čvorova `fights/` i `chase/`; borba nije stanje nego niz
     pojedinačnih udaraca. `hits/` služi za feed, za recap na kraju i kao
     dokaz duhovima. */
  function pushHit(hit) {
    return ref('hits').push({ atMs: Clock.now(), ...hit });
  }
  const hits = () => (room && room.hits) || {};

  /* — savezi — */
  const alliances = () => (room && room.alliances) || {};
  function setAlliance(pid, allianceId) { return ref(`players/${pid}/allianceId`).set(allianceId); }

  /* — dogovor duhova —
     Bez ovoga su duhovi klikali događaje nasumično, svako za sebe, i kasa se
     trošila na ono što je prvi stigao da pritisne. */
  const ghostChat = () => (room && room.ghostChat) || {};
  function pushGhostChat(text) {
    const t = String(text || '').trim().slice(0, 200);
    if (!t) return Promise.resolve();
    return ref('ghostChat').push({ atMs: Clock.now(), by: myId, text: t });
  }

  /* — iskre i tvorci igara — */
  const sparks = () => (room && room.sparks) || { pool: 0 };
  function addSpark(sid) {
    return Promise.all([
      ref(`sparks/collected/${sid}`).set(myId),
      ref('sparks/pool').transaction((c) => (c || 0) + 1),
    ]);
  }
  function voteEvent(type) { return ref(`gmVotes/${type}/${myId}`).set(true); }
  function clearVotes(type) { return ref(`gmVotes/${type}`).remove(); }
  async function spendSparks(n) {
    const t = await ref('sparks/pool').transaction((c) => ((c || 0) >= n ? c - n : undefined));
    return t.committed;
  }

  /* Glasovi za događaj stoje kao `gmVotes/{type}/{pid}: true`, a u istom čvoru
     živi i ključ `committed` — brava, ne glas. Zato se svuda filtrira. */
  const VOTE_LOCK = 'committed';
  const votersFrom = (obj) => Object.keys(obj || {}).filter((k) => k !== VOTE_LOCK);

  /** Sveži glasovi sa servera — lokalni keš zaostaje odmah posle upisa. */
  async function readVoters(type) {
    try {
      const s = await ref(`gmVotes/${type}`).get();
      return votersFrom(s.val());
    } catch { return votersFrom((room && room.gmVotes || {})[type]); }
  }

  /* Ko prvi postavi bravu, taj kupuje.
     Bez ovoga dva duha koja istovremeno pređu prag oba prođu proveru (čita se
     iz lokalnog keša odmah posle upisa) i oba skinu iskre iz iste kase.

     Brava nosi vreme i ističe posle `LOCK_TTL_MS`: ako onome ko ju je uzeo
     crkne telefon pre nego što upiše događaj, tip događaja bi inače ostao
     zaključan do kraja partije. */
  const LOCK_TTL_MS = 15000;
  async function commitEvent(type) {
    const now = Clock.now();
    const t = await ref(`gmVotes/${type}/${VOTE_LOCK}`).transaction((cur) => {
      if (cur && cur.atMs && now - cur.atMs < LOCK_TTL_MS) return undefined;   // tuđa, još važi
      return { by: myId, atMs: now };
    });
    return t.committed && t.snapshot.val() && t.snapshot.val().by === myId;
  }
  function releaseEvent(type) { return ref(`gmVotes/${type}/${VOTE_LOCK}`).remove(); }

  /* — mentori — */
  const mentors = () => (room && room.mentors) || {};
  function mentorRef(pid) { return ref(`mentors/${pid}`); }

  const API = {
    connect, on, sess,
    createRoom, joinRoom, rejoin, attach, leave, watchRoom, resync,
    get ready() { return ready; }, get code() { return code; }, get myId() { return myId; },
    get room() { return room; }, get db() { return db; },
    meta, config, schedule, players, me, isHost, state, items, traps, feed,
    alive, playerCount, alliances, sparks, mentors, hits, ghostChat, pushGhostChat,
    updateMe, setMe, hostUpdate, hostSet, pushFeed, ref,
    saveFace, loadFace, wipeFaces,
    claimItem, releaseItem, dropItem,
    pushHit,
    setAlliance, addSpark, voteEvent, clearVotes, spendSparks, mentorRef,
    readVoters, commitEvent, releaseEvent, votersFrom,
    SV,
  };
  return API;
})();
