/* ═══════════════════════════════════════════════════════════════════════════
   MENTOR, SPONZOR, GLEDAOCI (§17)

   Link je ličan: /arena/?room=KOD&mentor=PID. Prvi ko ga otvori postaje mentor
   tog igrača; svi posle njega su gledaoci istog igrača, bez moći osim navijanja.

   Naklonost NE dolazi od mentora nego od njegovog tributa: preživljeno
   skupljanje zone, ubistvo, legendarni predmet, ulazak u poslednjih pet,
   ispunjen zadatak. Mentor njome kupuje pakete — cena raste (1, 3, 6, 10), a
   paket pada 15 m od igrača, ne u ruke. Koliko PUTA sme da se umeša odlučuje
   duzina partije (R.mentorLimits), ne naklonost.
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

  /* ───────────────── naklonost dolazi od TRIBUTA ─────────────────
     Minigejmovi su izbačeni. Mentor je ranije mogao da farma poene ne gledajući
     partiju uopšte — sedeo bi na kauču, tapkao mete i zatrpavao tributa
     paketima. Sada svaki poen ima uzrok u areni, i taj uzrok se upisuje u
     dnevnik, da mentor vidi ZAŠTO ga je dobio.

     Poziva ga onaj čiji je događaj: ubistvo upisuje napadač, legendarni predmet
     onaj ko ga je uzeo, a zonu i poslednjih pet domaćin — jer to su jedine dve
     stvari koje niko pojedinačno ne „uradi". */
  const FAVOR_LOG_MAX = 30;

  async function awardFavor(pid, reason, mult) {
    const amount = (R.MENTOR_FAVOR[reason] || 0) * (mult || 1);
    if (!pid || !amount) return 0;
    await Store.ref(`mentors/${pid}/favor`).transaction((c) => (c || 0) + amount);
    await Store.ref(`mentors/${pid}/log`).push({ reason, amount, atMs: Clock.now() });
    return amount;
  }

  /** Dnevnik, najnoviji prvi — mentorov ekran ga čita ovako. */
  function favorLog() {
    return Object.entries(rec().log || {})
      .map(([id, e]) => ({ id, ...e }))
      .sort((a, b) => b.atMs - a.atMs)
      .slice(0, FAVOR_LOG_MAX);
  }

  /* ───────────────── zadaci ─────────────────
     Mentor bira JEDAN od tri ponuđena; slobodnog teksta nema, jer bi mentorski
     kanal odmah postao način da se dogovara i vara. Tribut ga vidi kao čip sa
     odbrojavačem i sme mirno da ga ignoriše — ovo je ponuda, ne naredba. */
  const questsUsed = () => rec().questsUsed || 0;
  const limits = () => R.mentorLimits(Store.config().durationMin);
  const questsLeft = () => Math.max(0, limits().quests - questsUsed());
  const packagesLeft = () => Math.max(0, limits().packages - sent());

  /** Tri ponude za sledeći zadatak — determinističke iz seed-a sobe. */
  const offer = () => R.questOffer((Store.room && Store.room.seed) || 'seed', questsUsed());

  /** Zadatak koji trenutno stoji kod tributa (ili null). */
  function activeQuest() {
    const q = (target() || {}).quest;
    if (!q || R.questExpired(q, Clock.now())) return null;
    return q;
  }

  async function giveQuest(id) {
    const p = target();
    if (!p || p.alive === false) return false;
    if (!R.QUESTS[id]) return false;
    if (activeQuest()) { toast(T('questActive'), 'gold', 'clock'); return false; }
    if (questsLeft() <= 0) { toast(T('questNoneLeft'), 'gold', 'alert'); return false; }

    const now = Clock.now();
    /* Snimak stanja u trenutku zadavanja: bez njega bi „postavi zamku" bio
       ispunjen zamkom koju je tribut postavio pre deset minuta. */
    await Store.ref(`players/${targetPid}/quest`).set({
      id, atMs: now, expiresAtMs: now + R.QUEST_TTL_MS,
      trapsSet: p.trapsSet || 0,
      walkedM: p.distanceWalkedM || 0,
      cornVisited: false,
    });
    await Store.ref(`mentors/${targetPid}/questsUsed`).transaction((c) => (c || 0) + 1);
    toast(T('questSent'), 'good', 'scroll');
    return true;
  }

  const mentorLinkFor = (code, pid) => `${appBase()}?room=${code}&mentor=${pid}`;

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
      /* Limit po dužini partije stoji ISPRED naklonosti: naklonost kaže šta
         mentor sme da pošalje, ovo koliko puta uopšte sme da se umeša. */
      if (packagesLeft() <= 0) { toast(T('packageNoneLeft'), 'gold', 'alert'); return; }
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

  return {
    claim, sendPackage, cheer, mentorLinkFor,
    awardFavor, favorLog, offer, giveQuest, activeQuest,
    questsUsed, questsLeft, packagesLeft, limits,
    session, clearSession,
    get mode() { return mode; }, get targetPid() { return targetPid; },
    get myId() { return myId; }, target, favor, sent, rec,
  };
})();
