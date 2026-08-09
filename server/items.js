'use strict';
// Katalog predmeta. rarity: 1 = obicno, 2 = retko, 3 = legendarno.
// atk / def / hp su bonusi. `use` oznacava potrosni predmet (koristi se u borbi).

const ITEMS = [
  // --- Oruzje ---
  { id: 'knife',    sr: 'Nož',            en: 'Knife',         icon: '🗡️', type: 'weapon', rarity: 1, atk: 6 },
  { id: 'machete',  sr: 'Mačeta',         en: 'Machete',       icon: '🔪', type: 'weapon', rarity: 1, atk: 7 },
  { id: 'sickle',   sr: 'Srp',            en: 'Sickle',        icon: '🪝', type: 'weapon', rarity: 1, atk: 7 },
  { id: 'axe',      sr: 'Sekira',         en: 'Axe',           icon: '🪓', type: 'weapon', rarity: 2, atk: 10 },
  { id: 'spear',    sr: 'Koplje',         en: 'Spear',         icon: '🔱', type: 'weapon', rarity: 2, atk: 11 },
  { id: 'bow',      sr: 'Luk i strele',   en: 'Bow & arrows',  icon: '🏹', type: 'weapon', rarity: 3, atk: 14 },
  { id: 'trident',  sr: 'Trozubac',       en: 'Trident',       icon: '⚔️', type: 'weapon', rarity: 3, atk: 15 },

  // --- Oklop ---
  { id: 'guards',   sr: 'Štitnici',       en: 'Guards',        icon: '🦿', type: 'armor',  rarity: 1, def: 5 },
  { id: 'helmet',   sr: 'Kaciga',         en: 'Helmet',        icon: '⛑️', type: 'armor',  rarity: 1, def: 4 },
  { id: 'vest',     sr: 'Prsluk',         en: 'Vest',          icon: '🦺', type: 'armor',  rarity: 2, def: 8 },
  { id: 'shield',   sr: 'Štit',           en: 'Shield',        icon: '🛡️', type: 'armor',  rarity: 3, def: 12 },

  // --- Pasivno / zalihe ---
  { id: 'water',    sr: 'Voda',           en: 'Water',         icon: '💧', type: 'supply', rarity: 1, hp: 10 },
  { id: 'food',     sr: 'Hrana',          en: 'Food',          icon: '🍞', type: 'supply', rarity: 1, hp: 15 },
  { id: 'rope',     sr: 'Uže',            en: 'Rope',          icon: '🪢', type: 'supply', rarity: 1, def: 3 },
  { id: 'torch',    sr: 'Baklja',         en: 'Torch',         icon: '🔦', type: 'supply', rarity: 2, vision: 60 },
  { id: 'medkit',   sr: 'Komplet prve pomoći', en: 'Med kit',  icon: '🧰', type: 'supply', rarity: 3, hp: 30 },

  // --- Potrosno (u borbi) ---
  { id: 'bandage',  sr: 'Zavoji',         en: 'Bandage',       icon: '🩹', type: 'use', rarity: 1, use: 'heal',  power: 25 },
  { id: 'adrenal',  sr: 'Adrenalin',      en: 'Adrenaline',    icon: '💉', type: 'use', rarity: 2, use: 'rage',  power: 2 },
  { id: 'trap',     sr: 'Zamka',          en: 'Snare',         icon: '🕸️', type: 'use', rarity: 2, use: 'stun',  power: 1 },
  { id: 'camo',     sr: 'Kamuflaža',      en: 'Camouflage',    icon: '🌿', type: 'use', rarity: 2, use: 'cloak', power: 300 },
  { id: 'nightlock',sr: 'Noćna senka',    en: 'Nightlock',     icon: '🫐', type: 'use', rarity: 3, use: 'poison', power: 18 },
];

const BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// Verovatnoce po retkosti za obican loot / kornukopiju / gozbu.
const WEIGHTS = {
  normal:     { 1: 70, 2: 25, 3: 5 },
  cornucopia: { 1: 25, 2: 45, 3: 30 },
  feast:      { 1: 0,  2: 40, 3: 60 },
};

function rollItem(pool = 'normal') {
  const w = WEIGHTS[pool] || WEIGHTS.normal;
  const total = w[1] + w[2] + w[3];
  let r = Math.random() * total;
  let rarity = 1;
  for (const k of [1, 2, 3]) {
    if (r < w[k]) { rarity = k; break; }
    r -= w[k];
  }
  const candidates = ITEMS.filter((i) => i.rarity === rarity);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Sabira bonuse iz inventara.
function statsOf(itemIds) {
  const s = { atk: 0, def: 0, hp: 0, vision: 0 };
  for (const id of itemIds) {
    const it = BY_ID[id];
    if (!it) continue;
    s.atk += it.atk || 0;
    s.def += it.def || 0;
    s.hp += it.hp || 0;
    s.vision += it.vision || 0;
  }
  return s;
}

module.exports = { ITEMS, BY_ID, rollItem, statsOf };
