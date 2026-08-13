/* ═══════════════════════════════════════════════════════════════════════════
   NAV — dugme "nazad" na telefonu.

   Bez ovoga Android back gasi aplikaciju usred partije. Trik je da uvek držimo
   jedan višak unosa u istoriji: kad korisnik pritisne nazad, mi taj unos
   potrošimo, uradimo nešto smisleno i odmah postavimo novi.

   Redosled je uvek isti:
   1. zatvori najgornji sloj (fioka ili modal)
   2. ako ekran ima svoje ponašanje za nazad — pokreni ga
   3. na početnom ekranu drugi pritisak stvarno izlazi
   ═══════════════════════════════════════════════════════════════════════════ */
const Nav = (() => {
  'use strict';
  const handlers = {};
  let armed = false, exitHint = 0;

  function arm() {
    if (armed) return;
    try { history.pushState({ arena: 'trap' }, ''); armed = true; } catch {}
  }
  function rearm() { armed = false; arm(); }

  function onPop() {
    armed = false;

    // 1. najgornji sloj
    const layers = document.querySelectorAll('.sheet, .modal');
    if (layers.length) {
      const top = layers[layers.length - 1];
      if (top.dataset.noback === '1') { arm(); return; }   // pitanja na koja se mora odgovoriti
      if (typeof top.close === 'function') top.close(); else top.remove();
      arm();
      return;
    }

    // 2. ponašanje ekrana
    const h = handlers[Screens.cur];
    if (h) { h(); arm(); return; }

    // 3. početni ekran: drugi pritisak izlazi
    if (Screens.cur === 'home') {
      const now = Date.now();
      if (now - exitHint < 2500) return;                   // ne postavljamo novi unos → izlaz
      exitHint = now;
      toast(T('backAgainToExit'), '', 'chevronLeft');
      arm();
      return;
    }
    arm();
  }

  function init() {
    try { history.replaceState({ arena: 'root' }, ''); } catch {}
    arm();
    window.addEventListener('popstate', onPop);
  }

  return {
    init, arm, rearm,
    on(screen, fn) { handlers[screen] = fn; },
    /** Dugme "nazad" za vrh ekrana. */
    button(id) { return `<button class="iconbtn sm" id="${id}" data-i-aria="back">${icon('chevronLeft', { size: 22 })}</button>`; },
    /** Ručno pokretanje istog ponašanja kao hardversko dugme. */
    back() { onPop(); },
  };
})();
