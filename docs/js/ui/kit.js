/* UI kit: DOM sitnice, obaveštenja, fioke, tema. */
const APP_VERSION = '0.9.4';
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const show = (n, v) => { if (n) n.hidden = !v; };

/* ───────────────────────── tema ───────────────────────── */
const Theme = {
  get() { return localStorage.getItem('arena.theme') || 'night'; },
  set(t) {
    localStorage.setItem('arena.theme', t);
    document.documentElement.setAttribute('data-theme', t === 'day' ? 'day' : 'night');
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = t === 'day' ? '#FFFFFF' : '#0D0B11';
    window.dispatchEvent(new CustomEvent('arena:theme'));
  },
  toggle() { this.set(this.get() === 'day' ? 'night' : 'day'); },
  init() { this.set(this.get()); },
};

/* ───────────────────────── obaveštenja ───────────────────────── */
function toast(msg, kind, iconName) {
  const box = $('#toasts') || document.body.appendChild(el('div', 'toasts')).id === 'toasts';
  const host = $('#toasts');
  const t = el('div', 'toast ' + (kind || ''));
  t.innerHTML = (iconName ? icon(iconName, { size: 22 }) : '') + `<div class="grow">${esc(msg)}</div>`;
  host.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; }, 3200);
  setTimeout(() => t.remove(), 3600);
  while (host.children.length > 3) host.firstChild.remove();
}

/* ───────────────────────── klizeći prekidač (.seg) ─────────────────────────
   Pločica ispod dugmadi klizi na izabrano polje. Ranije se samo prebacivala
   klasa `on`, a ekran podešavanja se uz to iscrtavao iznova — pa je izbor
   izgledao kao da se teleportuje. */
function segInit(seg) {
  if (!seg) return;
  if (!$('.thumb', seg)) seg.insertAdjacentHTML('afterbegin', '<i class="thumb"></i>');
  segMove(seg);
  requestAnimationFrame(() => segMove(seg));      // posle prvog rasporeda
}
function segMove(seg) {
  if (!seg) return;
  const btns = $$('button', seg);
  const th = $('.thumb', seg);
  if (!th || !btns.length) return;
  const b = btns.find((x) => x.classList.contains('on')) || btns[0];
  if (!b.offsetWidth) return;
  th.style.width = b.offsetWidth + 'px';
  th.style.transform = `translateX(${b.offsetLeft}px)`;
}
/** Izaberi vrednost sa animacijom; `after` se zove kad pločica stigne. */
function segPick(seg, v, after) {
  if (!seg) return;
  $$('button', seg).forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  segMove(seg);
  if (after) setTimeout(after, 230);
}

/* ───────────────────────── fioke i modali ───────────────────────── */
/** Fioka odozdo. Zatvara se tapom pored, prevlačenjem nadole i dugmetom nazad. */
function sheet(title, bodyHtml, opts) {
  opts = opts || {};
  const wrap = el('div', 'sheet');
  wrap.innerHTML = `<div class="sheet-body">
    <div class="sheet-grab"><i></i></div>
    ${title ? `<div class="sheet-title">${esc(title)}</div>` : ''}
    <div class="sheet-content"></div>
  </div>`;
  $('.sheet-content', wrap).innerHTML = bodyHtml || '';
  const body = $('.sheet-body', wrap);
  document.body.appendChild(wrap);

  function close() { wrap.remove(); opts.onClose && opts.onClose(); }
  wrap.close = close;
  if (!opts.sticky) {
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    // prevlačenje nadole
    let y0 = null, dy = 0;
    const grab = $('.sheet-grab', wrap);
    const down = (e) => { y0 = e.touches ? e.touches[0].clientY : e.clientY; dy = 0; body.style.transition = 'none'; };
    const move = (e) => {
      if (y0 == null) return;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      dy = Math.max(0, y - y0);
      body.style.transform = `translateY(${dy}px)`;
      if (e.cancelable) e.preventDefault();
    };
    const up = () => {
      if (y0 == null) return;
      y0 = null;
      body.style.transition = 'transform .2s var(--ease)';
      if (dy > 90) { body.style.transform = 'translateY(100%)'; setTimeout(close, 190); }
      else body.style.transform = '';
    };
    grab.addEventListener('touchstart', down, { passive: true });
    grab.addEventListener('touchmove', move, { passive: false });
    grab.addEventListener('touchend', up);
    grab.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }
  if (window.Nav) Nav.rearm();
  return wrap;
}
function modal(bodyHtml, opts) {
  opts = opts || {};
  const wrap = el('div', 'modal');
  wrap.innerHTML = `<div class="modal-body"></div>`;
  $('.modal-body', wrap).innerHTML = bodyHtml || '';
  if (opts.dismissible !== false) wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  else wrap.dataset.noback = '1';        // na ovo se mora odgovoriti, nazad ga ne zatvara
  document.body.appendChild(wrap);
  function close() { wrap.remove(); opts.onClose && opts.onClose(); }
  wrap.close = close;
  if (window.Nav) Nav.rearm();
  return wrap;
}
function confirmBox(text, okLabel, danger) {
  return new Promise((res) => {
    const m = modal(`
      <p class="big" style="margin-bottom:var(--s5)">${esc(text)}</p>
      <div class="stack">
        <button class="btn ${danger ? 'danger' : 'primary'} lg full" id="cbOk">${esc(okLabel || T('ok'))}</button>
        <button class="btn ghost full" id="cbNo">${esc(T('cancel'))}</button>
      </div>`, { dismissible: false });
    $('#cbOk', m).onclick = () => { m.close(); res(true); };
    $('#cbNo', m).onclick = () => { m.close(); res(false); };
  });
}

/* ───────────────────────── ekrani ───────────────────────── */
const Screens = {
  cur: null,
  go(name) {
    if (this.cur === name) return;
    this.cur = name;
    $$('.screen').forEach((s) => s.classList.toggle('on', s.id === 's-' + name));
    if (window.Nav) Nav.arm();
    window.dispatchEvent(new CustomEvent('arena:screen', { detail: name }));
  },
};

/* Osnovna adresa aplikacije, izvedena iz trenutne stranice.
   Ranije je svuda stajalo zakucano "/arena/", pa su svi deljeni linkovi na
   lokalnom serveru vodili u 404, a iz /arena/test bi ispao /arena/test?room=. */
function appBase() {
  return location.origin + location.pathname.replace(/[^/]*$/, '');
}

/* ───────────────────────── razno ───────────────────────── */
function fmtDist(m) {
  if (m == null || !isFinite(m)) return '—';
  return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';
}
function bar(kind, val, max) {
  const p = U.clamp((val || 0) / (max || 100), 0, 1);
  return `<div class="bar ${kind}"><i style="transform:scaleX(${p})"></i></div>`;
}
/** Jedan vitalni pokazatelj: ikonica, broj, tanka traka. */
function vitalBox(kind, iconName, val, max, crit) {
  return `<div class="vitalbox ${kind} ${crit ? 'crit' : ''}">
    <span class="vi">${icon(iconName, { size: 15 })}</span>
    <span class="vn num">${Math.round(val)}</span>
    ${bar(kind, val, max)}
  </div>`;
}
/** Odbrojavanje u prsten — koristi se za rundu, bekstvo, nišanjenje. */
function ring(pct, size, cls) {
  const r = size / 2 - 6, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}"><circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}"/>
    <circle class="fg ${cls || ''}" cx="${size / 2}" cy="${size / 2}" r="${r}"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - U.clamp(pct, 0, 1))}"/></svg>`;
}
function setRing(svgEl, pct) {
  const fg = $('.fg', svgEl);
  if (!fg) return;
  const r = +fg.getAttribute('r'), c = 2 * Math.PI * r;
  fg.setAttribute('stroke-dasharray', c);
  fg.setAttribute('stroke-dashoffset', c * (1 - U.clamp(pct, 0, 1)));
}
function makeEmbers(host, n) {
  if (!host) return;
  for (let i = 0; i < (n || 22); i++) {
    const e = el('i');
    e.style.left = Math.random() * 100 + '%';
    e.style.setProperty('--dx', (Math.random() * 70 - 35) + 'px');
    e.style.animationDuration = 7 + Math.random() * 9 + 's';
    e.style.animationDelay = -Math.random() * 12 + 's';
    host.appendChild(e);
  }
}
