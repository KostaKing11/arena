/* ═══════════════════════════════════════════════════════════════════════════
   IKONICE — jedan SVG set, bez emodžija.
   Sve je 24×24, iscrtano linijom debljine 2, `currentColor` boja.
   Popunjene varijante se dobijaju sa fill="currentColor" preko klase.
   ═══════════════════════════════════════════════════════════════════════════ */
const ICONS = {
  /* — status i dozvole — */
  pin: 'M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z M12 10.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z',
  camera: 'M4 8h3l1.4-2h7.2L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5Z',
  portrait: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M12 11a2.4 2.4 0 1 0 0-4.8A2.4 2.4 0 0 0 12 11Z M7.5 18c.7-2.4 2.4-3.6 4.5-3.6s3.8 1.2 4.5 3.6',
  bell: 'M12 3a5 5 0 0 0-5 5c0 4-2 5-2 7h14c0-2-2-3-2-7a5 5 0 0 0-5-5Z M10 18a2 2 0 0 0 4 0',

  /* — vitalni — */
  heart: 'M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7-2.6c1.4 1.6 1 4-.4 5.6C17 13.4 12 20 12 20Z',
  meat: 'M7.5 16.5 5 19M8.5 15.5a4.5 4.5 0 1 1 6.4-6.4l3.6 3.6a4.5 4.5 0 0 1-6.4 6.4Z M6.6 17.4l-1.9.5.5-1.9',
  droplet: 'M12 3c3.5 4.2 6 7.1 6 10a6 6 0 0 1-12 0c0-2.9 2.5-5.8 6-10Z',
  skull: 'M12 3a8 8 0 0 0-8 8c0 2.6 1.4 4.2 2.5 5.1V19a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2.9C18.6 15.2 20 13.6 20 11a8 8 0 0 0-8-8Z M9 12a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z M15 12a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z M10.5 16.5h3',

  /* — kretanje i borba — */
  swords: 'M14.5 3H21v6.5L11 19.5 4.5 13 14.5 3Z M3 21l3.5-3.5 M16 8l2 2',
  shield: 'M12 3 20 6v5.5c0 4.6-3.4 8-8 9.5-4.6-1.5-8-4.9-8-9.5V6l8-3Z',
  arrowLeftRight: 'M8 7 4 11l4 4 M4 11h16 M16 17l4-4-4-4',
  chevronUp: 'M6 15l6-6 6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  arrowUp: 'M12 20V4 M6 10l6-6 6 6',
  navigation: 'M3 11 21 3l-8 18-2.2-7.8L3 11Z',
  crosshair: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 2v4 M12 18v4 M2 12h4 M18 12h4',
  run: 'M13.5 5.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z M9 21l2.5-5 2.5-2.5-1-4.5-3.5 2L8 14 M14 13.5l3.5 2.5.5 4 M6 9l3-2.5 3.5-.5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z M12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z',

  /* — oružja — */
  bow: 'M5 20 19 6 M18 4h3v3 M6 5a12 12 0 0 1 13 13 M6 5 4 19l14-1',
  knife: 'M4 20 12 12 M20 4 12 12l-3-3 8-6 3 3Z M7 15l2 2',
  axe: 'M4 20 11 13 M14 3l7 5-4 5-7-3 4-7Z',
  spear: 'M4 20 20 4 M20 4h-4M20 4v4 M8 16l-3 1 1-3',
  trident: 'M12 21V8 M6 3v5a6 6 0 0 0 12 0V3 M12 3v5 M9 21h6',
  club: 'M5 19 10 14 M17 4a4 4 0 0 1 3 3c0 3-3.5 6.5-6 8l-2-2c1.5-2.5 5-6 5-9Z',
  net: 'M4 4h16v16H4z M4 9h16 M4 14h16 M9 4v16 M14 4v16',
  sling: 'M8 4 12 14l4-10 M12 14v6 M8 20h8',
  blowgun: 'M3 18 21 6 M19 5l2 2 M6 15l2 2',
  arrows: 'M4 20 20 4 M20 4h-5M20 4v5 M4 20h4M4 20v-4',

  /* — predmeti i inventar — */
  backpack: 'M6 8a6 6 0 0 1 12 0v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8Z M9 8V6a3 3 0 0 1 6 0v2 M9 13h6',
  box: 'M4 8 12 4l8 4v8l-8 4-8-4V8Z M4 8l8 4 8-4 M12 12v8',
  flask: 'M9 3v6L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L15 9V3 M8 3h8 M7.5 15h9',
  bandage: 'M5 12a5 5 0 0 1 5-5h4a5 5 0 0 1 0 10h-4a5 5 0 0 1-5-5Z M12 10v4M10 12h4',
  torch: 'M12 3c2 3 4 4 4 7a4 4 0 0 1-8 0c0-3 2-4 4-7Z M12 14v7 M9.5 21h5',
  binoculars: 'M7 20a3 3 0 0 0 3-3V8H5v9a3 3 0 0 0 2 3Z M17 20a3 3 0 0 0 3-3V8h-5v9a3 3 0 0 0 2 3Z M10 11h4 M7 8V5h3v3 M14 8V5h3v3',
  trap: 'M12 4v6 M4 20l8-10 8 10 M4 20h16 M8.5 15h7',
  gift: 'M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z M3 7h18v4H3z M12 7v14 M12 7S9 3 7 4.5 9 7 12 7Zm0 0s3-4 5-2.5S15 7 12 7Z',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z',

  /* — mapa i okruženje — */
  map: 'M9 4 3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5 9 4Z M9 4v14 M15 6.5v14',
  flame: 'M12 21a6 6 0 0 0 6-6c0-4-4-6-4-10 0 0-3 2-3 5 0 0-2-1-2-3-2 2-3 4.5-3 8a6 6 0 0 0 6 6Z',
  cloud: 'M7 18a4 4 0 0 1 .6-8A5.5 5.5 0 0 1 18 11a3.5 3.5 0 0 1-.5 7H7Z',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  wasp: 'M12 3v4 M9 5 12 7l3-2 M12 7a4 4 0 0 0-4 4c0 3 4 10 4 10s4-7 4-10a4 4 0 0 0-4-4Z M8 11h8 M8.5 14h7',

  /* — ljudi — */
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20c.9-3.5 3.5-5.2 6.5-5.2s5.6 1.7 6.5 5.2 M17 5.5a3 3 0 0 1 0 6 M18.5 14.4c2 .8 3.2 2.4 3.7 4.6',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M4 4l16 16 M9.5 9.6A3 3 0 0 0 12 15c.8 0 1.6-.3 2.1-.9 M6.5 6.8C4.1 8.5 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1 M9.8 5.8c.7-.2 1.4-.3 2.2-.3 6 0 9.5 6.5 9.5 6.5s-.9 1.7-2.6 3.3',
  ghost: 'M12 3a7 7 0 0 0-7 7v11l2.5-2 2.5 2 2-2 2 2 2.5-2 2.5 2V10a7 7 0 0 0-7-7Z M9.5 11a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z M14.5 11a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z',
  handshake: 'M3 12l4-4 3 3 3-3 4 4 M7 8l-4 4 3.5 3.5 2-2 M17 8l4 4-3.5 3.5-2-2 M10 15l2 2 2-2',

  /* — interfejs — */
  check: 'M4 12.5 9.5 18 20 6.5',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  menu: 'M12 6.5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Zm0 7a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Zm0 7a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5H9l-.3 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.4-1c.5.4 1.1.8 1.7 1l.3 2.6h6l.3-2.6c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.5Z',
  share: 'M18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M6 15a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M18 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M8.2 11.4l7.6-3.8 M8.2 13.6l7.6 3.8',
  qr: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 14h2v2h-2z M14 18h2v2h-2z M18 18h2v2h-2z',
  download: 'M12 3v12 M7 11l5 5 5-5 M4 20h16',
  trash: 'M4 7h16 M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13 M10 11v6M14 11v6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5.5l3.5 2',
  pause: 'M9 5v14M15 5v14',
  play: 'M7 4l12 8-12 8V4Z',
  alert: 'M12 3 22 20H2L12 3Z M12 9v5 M12 17.4a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0V4Z M7 6H4v1a4 4 0 0 0 3 3.9 M17 6h3v1a4 4 0 0 1-3 3.9 M10 14h4l.5 4H9.5l.5-4Z M7.5 21h9',
  wifiOff: 'M4 4l16 16 M2.5 9.5c1.4-1.2 3-2.1 4.8-2.6 M16.8 7.3c1.4.5 2.7 1.3 3.8 2.2 M6 13a8 8 0 0 1 2.4-1.5 M15 11.9c.9.3 1.7.7 2.4 1.3 M9.5 16.4A4 4 0 0 1 12 15.5c.9 0 1.8.3 2.5.9 M12 20.2a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z',
  hand: 'M8 12V6.5a1.5 1.5 0 0 1 3 0V11 M11 11V5a1.5 1.5 0 0 1 3 0v6 M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7s-6-2.5-6-6v-3a1.5 1.5 0 0 1 3 0',
  scroll: 'M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2V4Z M6 4a2 2 0 0 0-2 2v2h2 M9 8h7M9 12h7M9 16h4',
  medal: 'M12 13a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M9 3l3 6 3-6 M7.5 3H10l2 4M14 3h2.5l-2 4',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7 M20 4v4h-4',
};

const ICON_FILLED = new Set(['spark', 'flame', 'heart', 'droplet', 'play', 'navigation']);

/** Vrati SVG kao string. `name` iz ICONS, `opts.size` px, `opts.cls` dodatne klase. */
function icon(name, opts) {
  opts = opts || {};
  const d = ICONS[name];
  if (!d) return '';
  const size = opts.size || 24;
  const fill = opts.fill != null ? opts.fill : ICON_FILLED.has(name);
  const sw = opts.stroke || 2;
  return `<svg class="ic ${opts.cls || ''}" width="${size}" height="${size}" viewBox="0 0 24 24" `
    + `fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${sw}" `
    + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

/* Koja ikonica ide uz koji predmet / oružje. */
const ITEM_ICON = {
  berries: 'flask', mushrooms: 'flask', bread: 'meat', driedMeat: 'meat', feastMeal: 'meat',
  supplyBelt: 'backpack', dirtyWater: 'droplet', waterBottle: 'droplet', juice: 'droplet',
  springWater: 'droplet', thermos: 'flask', herbs: 'flask', bandage: 'bandage',
  antidote: 'flask', medkit: 'bandage', salve: 'bandage',
  smallBag: 'backpack', backpack: 'backpack', bigBackpack: 'backpack',
  trapBasic: 'trap', trapAlarm: 'trap', trapTracker: 'trap', trapNet: 'net',
  torch: 'torch', bigTorch: 'torch', binoculars: 'binoculars', smokeBomb: 'cloud',
  ragePotion: 'flask', camoCloak: 'eyeOff', quiver: 'arrows', arrows: 'arrows',
  wClub: 'club', wSling: 'sling', wNet: 'net', wSpear: 'spear', wAxe: 'axe',
  wBlowgun: 'blowgun', wBow: 'bow', wKnife: 'knife', wTrident: 'trident',
  spark: 'spark',
};
const WEAPON_ICON = {
  fists: 'hand', club: 'club', sling: 'sling', net: 'net', spear: 'spear',
  axe: 'axe', bow: 'bow', knife: 'knife', trident: 'trident', blowgun: 'blowgun',
};
const CLASS_ICON = {
  archer: 'bow', shadow: 'eyeOff', strong: 'axe', gatherer: 'backpack', medic: 'bandage',
  trapper: 'net', runner: 'run', hunter: 'spear', fisher: 'trident',
};
const EVENT_ICON = {
  firewall: 'flame', wasps: 'wasp', feast: 'gift', drought: 'sun', night: 'moon', supplyBox: 'box',
};
