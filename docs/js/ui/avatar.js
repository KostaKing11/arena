/* ═══════════════════════════════════════════════════════════════════════════
   LIKOVI

   Dve varijante iz istog opisa lika:
   · portret  — glava i ramena, za liste i kartice
   · figura   — cela osoba, za borbu, lobi i kraj; drži svoje oružje

   Crta se ravnim vektorom sa jasnom siluetom, bez obruba i sjaja — da na
   malom ekranu ostane čitljivo i da ne izgleda kao crtani.
   ═══════════════════════════════════════════════════════════════════════════ */
const AV = {
  skin:      ['#F0C9A4', '#E0A87C', '#C88C5E', '#A2673F', '#7A4A2B', '#57331C'],
  hairColor: ['#1E1712', '#3B2A1C', '#6B4222', '#A9763A', '#D8C08A', '#8C2F2F', '#4A4A52'],
  hair:      ['short', 'long', 'bun', 'buzz', 'curly', 'braid'],
  top:       ['#B5462B', '#2F6FA8', '#3B7A52', '#6B4C9A', '#B08428', '#3A3F46', '#8C3A5E'],
  bottom:    ['#2B2F36', '#3A3128', '#1F2A33', '#43373F', '#4A4038'],
  build:     ['slim', 'normal', 'broad'],
};

function randomAvatar() {
  const r = (a) => a[Math.floor(Math.random() * a.length)];
  return { skin: r(AV.skin), hairColor: r(AV.hairColor), hair: r(AV.hair), top: r(AV.top), bottom: r(AV.bottom), build: r(AV.build) };
}
function normAvatar(a) {
  a = a || {};
  return {
    skin: a.skin || AV.skin[1], hairColor: a.hairColor || AV.hairColor[1],
    hair: a.hair || 'short', top: a.top || a.shirt || AV.top[0],
    bottom: a.bottom || AV.bottom[0], build: a.build || a.body || 'normal',
  };
}

/* ───────────────────────── kosa ───────────────────────── */
function hairPath(kind, c, cx, cy, r) {
  const s = (n) => n * (r / 20);
  switch (kind) {
    case 'long':
      return `<path d="M${cx - r - s(3)} ${cy + s(4)} q${s(-2)} ${s(48)} ${s(6)} ${s(54)} l${s(8)} ${s(-6)}
        q${s(-6)} ${s(-22)} ${s(-2)} ${s(-40)} Z" fill="${c}"/>
        <path d="M${cx + r + s(3)} ${cy + s(4)} q${s(2)} ${s(48)} ${s(-6)} ${s(54)} l${s(-8)} ${s(-6)}
        q${s(6)} ${s(-22)} ${s(2)} ${s(-40)} Z" fill="${c}"/>
        <path d="M${cx - r - s(2)} ${cy - s(2)} a${r + s(2)} ${r + s(2)} 0 0 1 ${2 * (r + s(2))} 0
        q${s(-4)} ${s(-12)} ${-(r + s(2))} ${s(-12)} q${-(r - s(2))} 0 ${s(-4)} ${s(12)} Z" fill="${c}"/>`;
    case 'bun':
      return `<circle cx="${cx}" cy="${cy - r - s(9)}" r="${s(9)}" fill="${c}"/>
        <path d="M${cx - r - s(1)} ${cy - s(1)} a${r + s(1)} ${r + s(1)} 0 0 1 ${2 * (r + s(1))} 0
        q${s(-5)} ${s(-13)} ${-(r + s(1))} ${s(-13)} q${-(r - s(4))} 0 ${s(-5)} ${s(13)} Z" fill="${c}"/>`;
    case 'buzz':
      return `<path d="M${cx - r} ${cy - s(3)} a${r} ${r} 0 0 1 ${2 * r} 0 q${s(-4)} ${s(-10)} ${-r} ${s(-10)}
        q${-(r - s(4))} 0 ${s(-4)} ${s(10)} Z" fill="${c}" opacity=".9"/>`;
    case 'curly':
      return `<g fill="${c}">
        <circle cx="${cx - r * .8}" cy="${cy - r * .5}" r="${s(9)}"/>
        <circle cx="${cx - r * .3}" cy="${cy - r * .95}" r="${s(10)}"/>
        <circle cx="${cx + r * .3}" cy="${cy - r * .95}" r="${s(10)}"/>
        <circle cx="${cx + r * .8}" cy="${cy - r * .5}" r="${s(9)}"/></g>`;
    case 'braid':
      return `<path d="M${cx - r - s(1)} ${cy - s(1)} a${r + s(1)} ${r + s(1)} 0 0 1 ${2 * (r + s(1))} 0
        q${s(-5)} ${s(-13)} ${-(r + s(1))} ${s(-13)} q${-(r - s(4))} 0 ${s(-5)} ${s(13)} Z" fill="${c}"/>
        <path d="M${cx + r - s(2)} ${cy + s(6)} q${s(10)} ${s(16)} ${s(2)} ${s(34)} l${s(-7)} ${s(-2)}
        q${s(6)} ${s(-16)} ${s(-2)} ${s(-28)} Z" fill="${c}"/>`;
    default: // short
      return `<path d="M${cx - r - s(1)} ${cy - s(2)} a${r + s(1)} ${r + s(1)} 0 0 1 ${2 * (r + s(1))} 0
        q${s(-4)} ${s(-14)} ${-(r + s(1))} ${s(-14)} q${-(r - s(2))} 0 ${s(-4)} ${s(14)} Z" fill="${c}"/>`;
  }
}

/* ───────────────────────── portret ───────────────────────── */
function avatarSvg(a, size) {
  a = normAvatar(a);
  const s = size || 48;
  return `<svg viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true">
    <rect width="100" height="100" fill="var(--ink-3)"/>
    <path d="M22 100c0-16 12-24 28-24s28 8 28 24Z" fill="${a.top}"/>
    <rect x="43" y="58" width="14" height="14" rx="5" fill="${a.skin}"/>
    <circle cx="50" cy="44" r="20" fill="${a.skin}"/>
    ${hairPath(a.hair, a.hairColor, 50, 44, 20)}
    <circle cx="43" cy="44" r="2.2" fill="#241A12"/><circle cx="57" cy="44" r="2.2" fill="#241A12"/>
    <path d="M45 53q5 3.5 10 0" stroke="#241A12" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  </svg>`;
}

/* ───────────────────────── oružje ───────────────────────── */
/* Svako oružje ima svoj oblik, tačku hvata i pozu ruke. */
const WEAPON_ART = {
  fists:   null,
  club:    { pose: 'side',    w: 14, h: 40 },
  knife:   { pose: 'side',    w: 8,  h: 30 },
  axe:     { pose: 'side',    w: 20, h: 44 },
  spear:   { pose: 'upright', w: 8,  h: 78 },
  trident: { pose: 'upright', w: 18, h: 80 },
  bow:     { pose: 'bow',     w: 22, h: 62 },
  sling:   { pose: 'side',    w: 12, h: 30 },
  net:     { pose: 'side',    w: 24, h: 28 },
  blowgun: { pose: 'raised',  w: 6,  h: 54 },
};

function weaponArt(id) {
  const wood = '#6B4A2C', steel = '#C6CBD2', dark = '#8D949D', cord = '#D8CBAE';
  switch (id) {
    case 'club':    return `<rect x="-4" y="-14" width="8" height="16" rx="3" fill="${wood}"/><path d="M-7 -34 q7 -10 14 0 q0 12 -7 14 q-7 -2 -7 -14 Z" fill="${wood}"/>`;
    case 'knife':   return `<rect x="-2.5" y="-12" width="5" height="12" rx="2" fill="#3B2A1C"/><path d="M-3 -12 L3 -12 L2 -30 L0 -33 L-2 -30 Z" fill="${steel}"/>`;
    case 'axe':     return `<rect x="-2.5" y="-34" width="5" height="36" rx="2" fill="${wood}"/><path d="M2 -34 q14 2 14 12 q0 8 -14 8 Z" fill="${steel}"/><path d="M-2 -34 q-8 2 -8 9 q0 5 8 6 Z" fill="${dark}"/>`;
    case 'spear':   return `<rect x="-2" y="-58" width="4" height="76" rx="2" fill="${wood}"/><path d="M0 -74 L5 -56 L-5 -56 Z" fill="${steel}"/>`;
    case 'trident': return `<rect x="-2.5" y="-52" width="5" height="72" rx="2" fill="${wood}"/><path d="M-9 -52 L-9 -70 M0 -52 L0 -76 M9 -52 L9 -70" stroke="${steel}" stroke-width="4" stroke-linecap="round"/><rect x="-11" y="-54" width="22" height="5" rx="2" fill="${steel}"/>`;
    case 'bow':     return `<path d="M0 -30 q16 30 0 60" stroke="${wood}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M0 -30 L0 30" stroke="${cord}" stroke-width="1.6"/>`;
    case 'sling':   return `<path d="M-6 -10 L0 6 L6 -10" stroke="${cord}" stroke-width="2.4" fill="none"/><path d="M-8 -12 q8 -6 16 0" stroke="#5B4A38" stroke-width="3" fill="none"/>`;
    case 'net':     return `<path d="M-11 -12 h22 v20 h-22 Z" fill="none" stroke="${cord}" stroke-width="1.6"/><path d="M-11 -5 h22 M-11 2 h22 M-4 -12 v20 M4 -12 v20" stroke="${cord}" stroke-width="1.2"/>`;
    case 'blowgun': return `<rect x="-2" y="-46" width="4" height="52" rx="2" fill="#4A3A2A"/><circle cx="0" cy="-46" r="3" fill="${dark}"/>`;
    default: return '';
  }
}

/* ───────────────────────── figura ───────────────────────── */
/**
 * Cela figura. `opts.weapon` crta oružje u ruci sa odgovarajućom pozom,
 * `opts.facing` -1 okreće lika (za protivnika u borbi).
 */
function avatarFigure(a, size, opts) {
  a = normAvatar(a);
  opts = opts || {};
  const h = size || 150;
  const w = h * 0.6;
  const build = a.build;
  const sh = build === 'broad' ? 30 : build === 'slim' ? 22 : 26;   // pola širine ramena
  const hip = build === 'broad' ? 24 : build === 'slim' ? 18 : 21;
  const wid = WEAPON_ART[opts.weapon] || null;
  const pose = wid ? wid.pose : 'idle';
  const boot = '#2A2320';

  // desna ruka (gledaočeva desna) drži oružje
  const armR = {
    idle:    `<path d="M${60 + sh - 3} 96 q10 20 6 42" stroke="${a.skin}" stroke-width="11" fill="none" stroke-linecap="round"/>`,
    side:    `<path d="M${60 + sh - 3} 96 q12 18 8 38" stroke="${a.skin}" stroke-width="11" fill="none" stroke-linecap="round"/>`,
    upright: `<path d="M${60 + sh - 3} 96 q14 12 10 30" stroke="${a.skin}" stroke-width="11" fill="none" stroke-linecap="round"/>`,
    bow:     `<path d="M${60 + sh - 3} 96 q14 6 20 2" stroke="${a.skin}" stroke-width="11" fill="none" stroke-linecap="round"/>`,
    raised:  `<path d="M${60 + sh - 3} 96 q12 -10 4 -24" stroke="${a.skin}" stroke-width="11" fill="none" stroke-linecap="round"/>`,
  }[pose];
  const hand = {
    idle: [60 + sh + 3, 138], side: [60 + sh + 5, 134], upright: [60 + sh + 7, 126],
    bow: [60 + sh + 17, 98], raised: [60 + sh + 1, 72],
  }[pose];
  const weaponRot = { side: 6, upright: 0, bow: 0, raised: -24, idle: 0 }[pose];

  return `<svg viewBox="0 0 120 240" width="${w}" height="${h}" aria-hidden="true"
    style="${opts.facing === -1 ? 'transform:scaleX(-1)' : ''}">
    <!-- noge -->
    <path d="M${60 - hip} 148 q-3 40 -1 74 l14 0 q2 -34 5 -60 q3 26 5 60 l14 0 q2 -34 -1 -74 Z" fill="${a.bottom}"/>
    <rect x="${60 - hip - 1}" y="216" width="16" height="10" rx="3" fill="${boot}"/>
    <rect x="${60 + hip - 15}" y="216" width="16" height="10" rx="3" fill="${boot}"/>
    <!-- leva ruka -->
    <path d="M${60 - sh + 3} 96 q-10 20 -6 42" stroke="${a.skin}" stroke-width="11" fill="none" stroke-linecap="round"/>
    <!-- trup -->
    <path d="M${60 - sh} 84 q0 -10 ${sh} -10 q${sh} 0 ${sh} 10 l${hip - sh} 66 l${-2 * hip} 0 Z" fill="${a.top}"/>
    <!-- pojas -->
    <rect x="${60 - hip - 2}" y="144" width="${2 * hip + 4}" height="7" rx="2" fill="#3A2E24"/>
    <!-- desna ruka + oružje -->
    ${armR}
    ${wid ? `<g transform="translate(${hand[0]},${hand[1]}) rotate(${weaponRot})">${weaponArt(opts.weapon)}</g>` : ''}
    <!-- vrat i glava -->
    <rect x="53" y="66" width="14" height="14" rx="5" fill="${a.skin}"/>
    <circle cx="60" cy="48" r="22" fill="${a.skin}"/>
    ${hairPath(a.hair, a.hairColor, 60, 48, 22)}
    <circle cx="52" cy="48" r="2.4" fill="#241A12"/><circle cx="68" cy="48" r="2.4" fill="#241A12"/>
    <path d="M55 58q5 3.5 10 0" stroke="#241A12" stroke-width="1.9" fill="none" stroke-linecap="round"/>
  </svg>`;
}
