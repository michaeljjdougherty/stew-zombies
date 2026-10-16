// =============================================================================
// Gun skins: finishes for the guns, after the best-loved camos in Call of Duty
// (Gold, Diamond, Dark Matter, Damascus, the tiger and digital patterns...).
// Bought with Stew Bucks in the Stew Store (its Guns tab, shown on the SCAR-H)
// or unlocked in the Battle Pass, and put on a gun in the Arsenal blade
// (src/ui/arsenal.js). Saved with your career (src/career/career.js).
//
// Most fit every gun; `only` is the one gun a skin is made for. Pack-a-Punched
// guns keep their own camo. The patterns are drawn in src/render/gunSkins.js
// (`look`: which pattern, and its colours).
// =============================================================================
import { CONFIG } from '../config.js';

export const GUN_SKINS = [
  // --- every gun ------------------------------------------------------------------
  { id: 'woodland', name: 'Woodland', rarity: 'common', blurb: 'The classic: green, brown and black blots.', look: { kind: 'blots', colors: ['#4a5a2a', '#2e3a1c', '#6a5434', '#141410'] } },
  { id: 'tiger', name: 'Desert Tiger', rarity: 'common', blurb: 'Sand with dark tiger stripes.', look: { kind: 'tiger', colors: ['#c8a46a', '#3a2a18'] } },
  { id: 'digital', name: 'Urban Digital', rarity: 'common', blurb: 'Grey pixels. Hides you in a parking lot.', look: { kind: 'pixels', colors: ['#7a7e84', '#4a4e54', '#a8acb0', '#2a2c30'] } },
  { id: 'arctic', name: 'Arctic', rarity: 'common', blurb: 'White and ice grey, for the Ice Caves.', look: { kind: 'blots', colors: ['#e8eef2', '#b8c4cc', '#8a98a4', '#f8fbfc'] } },
  { id: 'cherry', name: 'Cherry Blossom', rarity: 'rare', blurb: 'Pink petals on dark lacquer.', look: { kind: 'petals', colors: ['#1a1014', '#ff9ac8', '#ffd8ea'] } },
  { id: 'damascus', name: 'Damascus', rarity: 'rare', blurb: 'Folded steel, wave after wave of it.', look: { kind: 'damascus', colors: ['#5a5c60', '#c8ccd0'], metal: 0.85, rough: 0.3 } },
  { id: 'carbon', name: 'Carbon Fiber', rarity: 'rare', blurb: 'The woven black of a race car.', look: { kind: 'weave', colors: ['#16171a', '#3a3c42'], rough: 0.35 } },
  { id: 'bacon', name: 'Bacon', rarity: 'rare', blurb: 'Strips of bacon. Don\'t ask. Smells great.', look: { kind: 'bacon', colors: ['#a8321e', '#f0c8a0'] } },
  { id: 'gold', name: 'Gold', rarity: 'legendary', blurb: 'Solid gold. Every gun in your hands, shining.', look: { kind: 'metal', colors: ['#f2c440', '#a87a10'], metal: 1, rough: 0.18, glow: 0.12 } },
  { id: 'diamond', name: 'Diamond', rarity: 'legendary', blurb: 'Cut diamond facets that catch every light.', look: { kind: 'facets', colors: ['#dff4ff', '#8ad8ff', '#ffffff'], metal: 0.5, rough: 0.08, glow: 0.35 } },
  { id: 'darkMatter', name: 'Dark Matter', rarity: 'legendary', blurb: 'Black and purple, with a galaxy moving through it.', look: { kind: 'galaxy', colors: ['#0a0612', '#8a3aff', '#ff5ad8'], glow: 1, move: true } },
  { id: 'molten', name: 'Molten', rarity: 'legendary', blurb: 'Cooling rock with lava glowing through the cracks.', look: { kind: 'cracks', colors: ['#1a1210', '#ff6a10', '#ffd040'], glow: 1.2, move: true } },
  // --- made for one gun -----------------------------------------------------------
  { id: 'varsityScar', only: 'SCAR-H', name: 'Varsity', rarity: 'rare', blurb: 'Stew Leonard High green and gold, for the SCAR-H.', look: { kind: 'stripes', colors: ['#1d5a2e', '#d8b84a'] } },
  { id: 'pinkEagle', only: 'Desert Eagle', name: 'Pink Chrome', rarity: 'rare', blurb: 'The Desert Eagle in pink chrome. Loud in every way.', look: { kind: 'metal', colors: ['#ff7ac8', '#a83a7a'], metal: 1, rough: 0.15, glow: 0.1 } },
  { id: 'hotRod', only: 'AK-75u', name: 'Hot Rod', rarity: 'rare', blurb: 'Flames down the sides of the AK-75u.', look: { kind: 'flames', colors: ['#141416', '#ff5a10', '#ffd040'] } },
  { id: 'ivory', only: 'M1912', name: 'Ivory', rarity: 'rare', blurb: 'White with gold scrollwork, the M1912 dressed up.', look: { kind: 'scroll', colors: ['#f2ece0', '#c89a30'] } },
  { id: 'sherwood', only: 'Kross-Bow', name: 'Sherwood', rarity: 'rare', blurb: 'Green wood and leaves for the Kross-Bow.', look: { kind: 'leaves', colors: ['#2a3a1a', '#5a8a2a', '#8ab84a'] } },
  { id: 'engraved', only: 'Olympus', name: 'Engraved', rarity: 'common', blurb: 'Silver engraving on the Olympus, like a shotgun from an old estate.', look: { kind: 'scroll', colors: ['#8a8c90', '#e2e4e8'], metal: 0.8, rough: 0.3 } },
  { id: 'ghillie', only: 'Dragunoff', name: 'Ghillie', rarity: 'common', blurb: 'Grass-wrapped Dragunoff. You\'re a bush now.', look: { kind: 'grass', colors: ['#3a4a22', '#6a7a3a', '#1e2a12'] } },
  { id: 'dragonScale', only: 'M2 Flamethrower', name: 'Dragon Scale', rarity: 'legendary', blurb: 'Red scales with fire between them, for the M2 Flamethrower.', look: { kind: 'scales', colors: ['#3a0806', '#c41a10', '#ff9a20'], glow: 0.8, move: true } },
  // --- the Battle Pass (src/career/battlepass.js): every gun --------------------------
  { id: 'neonGrid', name: 'Neon Grid', rarity: 'rare', unlock: { kind: 'pass', tier: 6 }, blurb: 'A glowing synthwave grid on black.', look: { kind: 'grid', colors: ['#0c0618', '#ff3ad8', '#3ad8ff'], glow: 0.9 } },
  { id: 'zebra', name: 'Zebra', rarity: 'rare', unlock: { kind: 'pass', tier: 12 }, blurb: 'Black and white stripes, no two the same.', look: { kind: 'tiger', colors: ['#f2f0ea', '#111113'] } },
  { id: 'ketchupMustard', name: 'Ketchup & Mustard', rarity: 'legendary', unlock: { kind: 'pass', tier: 18 }, blurb: 'Red and yellow squiggles, straight off the Burger Bros grill.', look: { kind: 'squiggle', colors: ['#c8202a', '#ffc72a', '#f6efe0'] } },
];

export const GUN_SKIN_BY_ID = Object.fromEntries(GUN_SKINS.map((s) => [s.id, s]));
export const gunSkinRarity = (s) => CONFIG.shop.rarities[s.rarity] || CONFIG.shop.rarities.common;
export const gunSkinPrice = (id) => { const s = GUN_SKIN_BY_ID[id]; return s && !s.unlock ? gunSkinRarity(s).price : Infinity; };

// Does it go on this gun? (a gun's id is its name in CONFIG.weapons; Pack-a-Punched: its base gun)
export const gunSkinFits = (id, gun) => !!GUN_SKIN_BY_ID[id] && (!GUN_SKIN_BY_ID[id].only || GUN_SKIN_BY_ID[id].only === gun);
export const gunSkinsFor = (gun) => GUN_SKINS.filter((s) => gunSkinFits(s.id, gun));

// The guns in the Arsenal, by kind: every gun you can hold except the wonder
// weapons and the power-ups (the M2 Flamethrower isn't a wonder weapon here:
// it's a Special, with the Kross-Bow).
export const ARSENAL_CLASSES = [
  { id: 'pistol', name: 'Pistols' }, { id: 'smg', name: 'SMGs' }, { id: 'ar', name: 'Assault rifles' }, { id: 'rifle', name: 'Rifles' },
  { id: 'shotgun', name: 'Shotguns' }, { id: 'lmg', name: 'LMGs' }, { id: 'sniper', name: 'Snipers' }, { id: 'special', name: 'Specials' },
];
const SPECIALS = ['Kross-Bow', 'M2 Flamethrower', 'China Pond', 'Ballistik Knife'];
const NOT_GUNS = ['Death Machine'];   // (a power-up)
export function arsenalGuns(weapons = CONFIG.weapons) {
  const out = [];
  for (const [id, w] of Object.entries(weapons)) {
    if (w.upgraded || w.baseId || NOT_GUNS.includes(id) || !w.view) continue;
    if (w.wonder && !SPECIALS.includes(id)) continue;
    out.push({ id, name: id, model: w.view.model, cls: SPECIALS.includes(id) ? 'special' : w.class });
  }
  return out;
}
// The gun the store shows every gun skin on
export const SHOWCASE_GUN = 'SCAR-H';
