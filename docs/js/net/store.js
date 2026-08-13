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
  const sess = {
    get code() { return localStorage.getItem('arena.code'); },
    get pid() { return localStorage.getItem('arena.pid'); },
    save(c, p) { localStorage.setItem('arena.code', c); localStorage.setItem('arena.pid', p); },
    clear() { localStorage.removeItem('arena.code'); localStorage.removeItem('arena.pid'); },
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
      db.ref('.info/connected').on('value', (s) => {
        const up = s.val() === true;
        emit(up ? 'online' : 'offline');
        if (up && myId && roomRef) presence();
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

  function attach() {
    sess.save(code, myId);
    roomRef = db.ref(`rooms/${code}`);
    roomRef.on('value', (s) => {
      room = s.val() || null;
      if (!room) { emit('roomGone'); return; }
      emit('room', room);
    });
    presence();
    emit('joined', { code, myId });
    return true;
  }

  function leave() {
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
  const fights = () => (room && room.fights) || {};
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

  /* — borbe — */
  async function openFight(otherId, distanceBand, meta2) {
    const fid = U.uid('f');
    // rezerviši protivnika pa sebe; ako drugi ne prođe, oslobodi
    const t1 = await ref(`players/${otherId}/fightId`).transaction((cur) => (cur == null ? fid : undefined));
    if (!t1.committed) return null;
    const t2 = await ref(`players/${myId}/fightId`).transaction((cur) => (cur == null ? fid : undefined));
    if (!t2.committed) { ref(`players/${otherId}/fightId`).remove(); return null; }

    const A = me(), B = players()[otherId];
    await ref(`fights/${fid}`).set({
      a: myId, b: otherId, state: 'live', round: 1,
      distance: distanceBand, hpA: A.hp, hpB: B.hp,
      arrowsA: A.arrows || 0, arrowsB: B.arrows || 0,
      startedAtMs: Clock.now(), deadlineMs: Clock.now() + R.ROUND_MS,
      moves: null, log: null, effA: null, effB: null,
      specialUsedA: false, specialUsedB: false,
      betrayal: !!(meta2 && meta2.betrayal),
    });
    return fid;
  }
  function fightRef(fid) { return ref(`fights/${fid}`); }
  function submitMove(fid, move) {
    return ref(`fights/${fid}/moves/${myId}`).set(move);
  }

  /* — potera: zastavica leftRadius je obavezna (§9) — */
  function startChase(fid, fleeing, chaser) {
    return ref(`chase/${fid}`).set({
      fid, fleeing, chaser, leftRadius: false, startedAtMs: Clock.now(),
    });
  }
  function chaseRef(fid) { return ref(`chase/${fid}`); }
  const chases = () => (room && room.chase) || {};

  /* — savezi — */
  const alliances = () => (room && room.alliances) || {};
  function setAlliance(pid, allianceId) { return ref(`players/${pid}/allianceId`).set(allianceId); }

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

  /* — mentori — */
  const mentors = () => (room && room.mentors) || {};
  function mentorRef(pid) { return ref(`mentors/${pid}`); }

  const API = {
    connect, on, sess,
    createRoom, joinRoom, rejoin, attach, leave,
    get ready() { return ready; }, get code() { return code; }, get myId() { return myId; },
    get room() { return room; }, get db() { return db; },
    meta, config, schedule, players, me, isHost, state, items, traps, fights, feed,
    alive, playerCount, alliances, sparks, mentors, chases,
    updateMe, setMe, hostUpdate, hostSet, pushFeed, ref,
    saveFace, loadFace, wipeFaces,
    claimItem, releaseItem, dropItem,
    openFight, fightRef, submitMove, startChase, chaseRef,
    setAlliance, addSpark, voteEvent, clearVotes, spendSparks, mentorRef,
    SV,
  };
  return API;
})();
