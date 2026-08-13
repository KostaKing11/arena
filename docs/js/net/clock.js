/* ═══════════════════════════════════════════════════════════════════════════
   SAT — jedini tačan izvor vremena u igri (§0.4).

   Telefoni imaju satove koji se razlikuju i po nekoliko minuta. Pošto se ceo
   raspored (zona, eventovi, nebo) čuva u apsolutnim vremenima, svi MORAJU da
   gledaju isti sat. Firebase daje `.info/serverTimeOffset` — razliku između
   lokalnog i serverskog sata.
   ═══════════════════════════════════════════════════════════════════════════ */
const Clock = (() => {
  let offset = 0, synced = false;
  const listeners = [];

  function attach(db) {
    try {
      db.ref('.info/serverTimeOffset').on('value', (s) => {
        const v = s.val();
        if (typeof v === 'number') {
          offset = v; synced = true;
          listeners.forEach((f) => { try { f(offset); } catch {} });
        }
      });
    } catch { /* bez sinhronizacije radimo sa lokalnim satom */ }
  }
  const now = () => Date.now() + offset;

  return {
    attach, now,
    get offset() { return offset; },
    get synced() { return synced; },
    onSync(f) { listeners.push(f); if (synced) f(offset); },
    // koliko je proteklo od nekog apsolutnog vremena, u sekundama
    since: (ms) => (now() - ms) / 1000,
    until: (ms) => (ms - now()) / 1000,
  };
})();
