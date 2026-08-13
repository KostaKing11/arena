/* UI kit: DOM sitnice, obaveštenja, fioke, avatar, tema. */
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

/* ───────────────────────── fioke i modali ───────────────────────── */
function sheet(title, bodyHtml, opts) {
  opts = opts || {};
  const wrap = el('div', 'sheet');
  wrap.innerHTML = `<div class="sheet-body">
    <div class="sheet-handle"></div>
    ${title ? `<h2 class="display" style="margin-bottom:var(--s4)">${esc(title)}</h2>` : ''}
    <div class="sheet-content"></div>
  </div>`;
  $('.sheet-content', wrap).innerHTML = bodyHtml || '';
  if (!opts.sticky) wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  document.body.appendChild(wrap);
  function close() { wrap.remove(); opts.onClose && opts.onClose(); }
  wrap.close = close;
  return wrap;
}
function modal(bodyHtml, opts) {
  opts = opts || {};
  const wrap = el('div', 'modal');
  wrap.innerHTML = `<div class="modal-body"></div>`;
  $('.modal-body', wrap).innerHTML = bodyHtml || '';
  if (opts.dismissible !== false) wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  document.body.appendChild(wrap);
  function close() { wrap.remove(); opts.onClose && opts.onClose(); }
  wrap.close = close;
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
    window.dispatchEvent(new CustomEvent('arena:screen', { detail: name }));
  },
};

/* ───────────────────────── avatar ───────────────────────── */
const AV = {
  skin: ['#F2C9A0', '#E0A878', '#C68642', '#8D5524', '#5C3317', '#FFE0BD'],
  hairColor: ['#2B1B12', '#5A3A22', '#A8641E', '#D9B45B', '#E8E2D8', '#7A2E2E'],
  hair: ['short', 'long', 'bun', 'buzz', 'curly'],
  shirt: ['#C0392B', '#2F6FB0', '#3B8F5A', '#7A4FA3', '#D08C1A', '#3A3F45'],
  body: ['slim', 'normal', 'broad'],
};
function randomAvatar() {
  const r = (a) => a[Math.floor(Math.random() * a.length)];
  return { skin: r(AV.skin), hairColor: r(AV.hairColor), hair: r(AV.hair), shirt: r(AV.shirt), body: r(AV.body) };
}
/** SVG lik — koristi se u lobiju, borbi, na kraju. */
function avatarSvg(a, size) {
  a = a || randomAvatar();
  const s = size || 64;
  const w = a.body === 'broad' ? 40 : a.body === 'slim' ? 28 : 34;
  const hair = {
    short: `<path d="M28 30c0-9 7-14 16-14s16 5 16 14c0 0-6-5-16-5s-16 5-16 5Z" fill="${a.hairColor}"/>`,
    long:  `<path d="M27 30c0-9 8-14 17-14s17 5 17 14v22c-3 2-5-4-5-10 0 0-5 3-12 3s-12-3-12-3c0 6-2 12-5 10V30Z" fill="${a.hairColor}"/>`,
    bun:   `<circle cx="44" cy="14" r="7" fill="${a.hairColor}"/><path d="M28 31c0-9 7-14 16-14s16 5 16 14c0 0-6-5-16-5s-16 5-16 5Z" fill="${a.hairColor}"/>`,
    buzz:  `<path d="M29 31c0-8 6-13 15-13s15 5 15 13c0 0-5-3-15-3s-15 3-15 3Z" fill="${a.hairColor}" opacity=".85"/>`,
    curly: `<g fill="${a.hairColor}"><circle cx="32" cy="24" r="8"/><circle cx="44" cy="19" r="9"/><circle cx="56" cy="24" r="8"/><circle cx="38" cy="20" r="7"/><circle cx="50" cy="20" r="7"/></g>`,
  }[a.hair] || '';
  return `<svg viewBox="0 0 88 88" width="${s}" height="${s}" aria-hidden="true">
    <circle cx="44" cy="44" r="44" fill="var(--ink-3)"/>
    <path d="M${44 - w} 88c0-14 ${w - 6} -20 ${w} -20s${w} 6 ${w} 20Z" fill="${a.shirt}"/>
    <circle cx="44" cy="40" r="16" fill="${a.skin}"/>
    ${hair}
    <circle cx="38" cy="40" r="2" fill="#2A1E16"/><circle cx="50" cy="40" r="2" fill="#2A1E16"/>
    <path d="M39 48c2 2 8 2 10 0" stroke="#2A1E16" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </svg>`;
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
function vitalBox(kind, iconName, val, max, crit) {
  return `<div class="vitalbox ${crit ? 'crit' : ''}">
    <div class="top"><span class="vital ${kind}">${icon(iconName, { size: 18 })}</span>
    <span class="num">${Math.round(val)}</span></div>
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
