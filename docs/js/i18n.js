/* Prevodi. data-i="key" u HTML-u se automatski menja. */
const I18N = {
  sr: {
    tagline: 'Igre gladi — uživo, na tvojoj mapi',
    yourName: 'Tvoje ime', createArena: 'Napravi arenu', or: 'ili', join: 'Uđi',
    footNote: 'Igra se napolju. Telefon je samo tvoj kompas, inventar i oružje.',
    roomCode: 'Kod sobe', share: 'Podeli', leave: 'Izađi', tributes: 'Tributi',
    arenaSetup: 'Postavka arene',
    tapMap: 'Tapni na mapu da postaviš centar arene (kornukopiju), ili koristi svoju lokaciju.',
    useMyLoc: '📍 Moja lokacija kao centar', radius: 'Prečnik arene', lootCount: 'Broj predmeta',
    deployTime: 'Vreme za raspored', modeCorn: 'Kornukopija', modeScatter: 'Rasuto',
    shrinkOpt: 'Arena se skuplja tokom igre', addBots: 'Dodaj botove', demoArena: '⚡ Test arena',
    startGames: 'Pokreni igre', waitHost: 'Čekamo domaćina da pokrene igre…',
    waitHint: 'Obavezno dozvoli pristup lokaciji kad te telefon pita.',
    goToSpawn: 'Idi na svoju startnu poziciju', inventory: 'Inventar', center: 'Centriraj',
    feed: 'Objave', close: 'Zatvori', settings: 'Podešavanja',
    simMode: 'Simulacija GPS-a (test na kompjuteru)',
    simHint: 'Kad je uključeno, tapni po mapi da pomeriš svog igrača umesto pravog GPS-a.',
    autoWalk: 'Automatsko hodanje ka tapnutoj tački', quitGame: 'Napusti arenu',
    giveUp: 'Odustani', mAttack: 'Napad', mAttackH: 'jači od varke', mBlock: 'Blok',
    mBlockH: 'jači od napada', mFeint: 'Varka', mFeintH: 'jača od bloka',
    waitFoe: 'Čekamo protivnika…', allyOffer: 'Ponuda saveza', accept: 'Prihvati',
    decline: 'Odbij', watchOn: 'Gledaj dalje', backHome: 'Nazad na početak',
    // dinamicki
    phaseLobby: 'ČEKAONICA', phaseDeploy: 'RASPORED', phaseActive: 'IGRE TRAJU',
    phaseFinale: 'FINALE', phaseEnded: 'KRAJ',
    aliveN: (n) => `${n} živih`,
    lootHere: 'Uzmi predmet', lootFar: (d) => `Predmet na ${d} m`,
    fight: 'Napadni', ally: 'Savez', breakAlly: 'Raskini',
    someoneNear: 'Neko je blizu', dirDist: (b, d) => `${b} • ~${d} m`,
    youWin: 'POBEDIO SI', youLose: 'PORAŽEN SI', draw: 'Razišli ste se',
    eliminated: 'ELIMINISAN', place: (n) => `${n}. mesto`,
    winner: 'POBEDNIK', spectating: 'Gledaš iz Kapitola',
    noItems: 'Nemaš ništa. Nađi kornukopiju.',
    goCenter: 'Idi u centar arene — finale počinje tamo',
    meetAt: (d) => `Nađite se uživo (${d} m od tebe)`,
    kills: 'eliminacija', items: 'predmeta', hp: 'život',
    tapTitle: 'Razvali sanduk', tapSub: (n, s) => `Tapni ${n} puta za ${s} sekundi.`,
    sliderTitle: 'Precizan zahvat', sliderSub: (n) => `Zaustavi marker u zelenoj zoni — ${n}×.`,
    seqTitle: 'Šifra sanduka', seqSub: 'Zapamti redosled pa ga ponovi.',
    holdTitle: 'Mirna ruka', holdSub: 'Drži i pusti tačno na zelenoj liniji.',
    got: (n) => `Uzeo si: ${n}`, failed: 'Nije uspelo — probaj ponovo',
    stop: 'STOP', tapNow: 'TAPKAJ', holdNow: 'DRŽI', repeat: 'PONOVI',
    connecting: 'Povezivanje…', lost: 'Veza prekinuta — pokušavam ponovo…',
    needName: 'Upiši ime', needCode: 'Upiši kod sobe', needArena: 'Prvo postavi centar arene',
    copied: 'Link kopiran', geoDenied: 'Nema pristupa lokaciji. Uključi GPS ili simulaciju u podešavanjima.',
    outside: '⚠️ VAN ARENE — gubiš život!', inHazard: '☠️ U ZABRANJENOJ ZONI!',
    hazardWarn: (m) => `⚠️ Izađi iz obeležene zone za ${m}`,
    night: '🌑 Noć — vidljivost prepolovljena',
  },
  en: {
    tagline: 'The Hunger Games — live, on your map',
    yourName: 'Your name', createArena: 'Create arena', or: 'or', join: 'Join',
    footNote: 'Played outdoors. Your phone is only the compass, inventory and weapon.',
    roomCode: 'Room code', share: 'Share', leave: 'Leave', tributes: 'Tributes',
    arenaSetup: 'Arena setup',
    tapMap: 'Tap the map to set the arena centre (the cornucopia), or use your location.',
    useMyLoc: '📍 Use my location as centre', radius: 'Arena diameter', lootCount: 'Item count',
    deployTime: 'Deployment time', modeCorn: 'Cornucopia', modeScatter: 'Scattered',
    shrinkOpt: 'Arena shrinks during play', addBots: 'Add bots', demoArena: '⚡ Test arena',
    startGames: 'Start the games', waitHost: 'Waiting for the host to start…',
    waitHint: 'Make sure you allow location access when your phone asks.',
    goToSpawn: 'Go to your starting position', inventory: 'Inventory', center: 'Recentre',
    feed: 'Broadcasts', close: 'Close', settings: 'Settings',
    simMode: 'Simulate GPS (desktop testing)',
    simHint: 'When on, tap the map to move your player instead of using real GPS.',
    autoWalk: 'Auto-walk toward tapped point', quitGame: 'Leave the arena',
    giveUp: 'Give up', mAttack: 'Attack', mAttackH: 'beats feint', mBlock: 'Block',
    mBlockH: 'beats attack', mFeint: 'Feint', mFeintH: 'beats block',
    waitFoe: 'Waiting for opponent…', allyOffer: 'Alliance offer', accept: 'Accept',
    decline: 'Decline', watchOn: 'Keep watching', backHome: 'Back to start',
    phaseLobby: 'LOBBY', phaseDeploy: 'DEPLOYMENT', phaseActive: 'GAMES LIVE',
    phaseFinale: 'FINALE', phaseEnded: 'OVER',
    aliveN: (n) => `${n} alive`,
    lootHere: 'Take the item', lootFar: (d) => `Item ${d} m away`,
    fight: 'Attack', ally: 'Alliance', breakAlly: 'Break',
    someoneNear: 'Someone is near', dirDist: (b, d) => `${b} • ~${d} m`,
    youWin: 'YOU WON', youLose: 'YOU FELL', draw: 'You broke apart',
    eliminated: 'ELIMINATED', place: (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} place`,
    winner: 'VICTOR', spectating: 'Watching from the Capitol',
    noItems: 'You have nothing. Find the cornucopia.',
    goCenter: 'Head to the arena centre — the finale begins there',
    meetAt: (d) => `Meet in person (${d} m from you)`,
    kills: 'kills', items: 'items', hp: 'health',
    tapTitle: 'Break the crate', tapSub: (n, s) => `Tap ${n} times in ${s} seconds.`,
    sliderTitle: 'Steady grab', sliderSub: (n) => `Stop the marker in the green zone — ${n}×.`,
    seqTitle: 'Crate code', seqSub: 'Memorise the sequence, then repeat it.',
    holdTitle: 'Steady hand', holdSub: 'Hold, and release exactly on the green line.',
    got: (n) => `You got: ${n}`, failed: 'Failed — try again',
    stop: 'STOP', tapNow: 'TAP', holdNow: 'HOLD', repeat: 'REPEAT',
    connecting: 'Connecting…', lost: 'Connection lost — retrying…',
    needName: 'Enter a name', needCode: 'Enter a room code', needArena: 'Set the arena centre first',
    copied: 'Link copied', geoDenied: 'No location access. Enable GPS or turn on simulation in settings.',
    outside: '⚠️ OUTSIDE THE ARENA — losing health!', inHazard: '☠️ IN THE FORBIDDEN ZONE!',
    hazardWarn: (m) => `⚠️ Leave the marked zone within ${m}`,
    night: '🌑 Night — vision halved',
  },
};

const ITEM_NAMES = {
  knife:['Nož','Knife','🗡️'], machete:['Mačeta','Machete','🔪'], sickle:['Srp','Sickle','🪝'],
  axe:['Sekira','Axe','🪓'], spear:['Koplje','Spear','🔱'], bow:['Luk i strele','Bow & arrows','🏹'],
  trident:['Trozubac','Trident','⚔️'], guards:['Štitnici','Guards','🦿'], helmet:['Kaciga','Helmet','⛑️'],
  vest:['Prsluk','Vest','🦺'], shield:['Štit','Shield','🛡️'], water:['Voda','Water','💧'],
  food:['Hrana','Food','🍞'], rope:['Uže','Rope','🪢'], torch:['Baklja','Torch','🔦'],
  medkit:['Prva pomoć','Med kit','🧰'], bandage:['Zavoji','Bandage','🩹'],
  adrenal:['Adrenalin','Adrenaline','💉'], trap:['Zamka','Snare','🕸️'],
  camo:['Kamuflaža','Camouflage','🌿'], nightlock:['Noćna senka','Nightlock','🫐'],
};
/* Brojke dolaze iz rules.js — jedan izvor istine, da se prikaz i pravila ne raziđu. */
const ITEM_STATS = Object.fromEntries(Rules.ITEMS.map((i) => [i.id,
  { atk: i.atk, def: i.def, hp: i.hp, vision: i.vision, use: i.use, r: i.rarity }]));

let LANG = localStorage.getItem('arena.lang') || 'sr';
const T = (k, ...a) => {
  const v = (I18N[LANG] && I18N[LANG][k]) ?? I18N.sr[k] ?? k;
  return typeof v === 'function' ? v(...a) : v;
};
const itemName = (id) => (ITEM_NAMES[id] ? ITEM_NAMES[id][LANG === 'en' ? 1 : 0] : id);
const itemIcon = (id) => (ITEM_NAMES[id] ? ITEM_NAMES[id][2] : '❔');
const itemInfo = (id) => ITEM_STATS[id] || {};

function applyLang() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i]').forEach((el) => {
    const v = T(el.dataset.i);
    if (typeof v === 'string') el.textContent = v;
  });
}
function toggleLang() {
  LANG = LANG === 'sr' ? 'en' : 'sr';
  localStorage.setItem('arena.lang', LANG);
  applyLang();
  if (window.App && App.render) App.render();
}
