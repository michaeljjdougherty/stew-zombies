// =============================================================================
// Skins: outfits for the crew, bought with Stew Bucks in the Skin Shop
// (src/ui/shopUI.js) and saved with your career (src/career/career.js).
//
// Every skin fits every playable character, so a new character gets the whole
// shop for free. A skin swaps the outfit only (top, jacket, pants, shoes, and
// sometimes the hair colour); the face, body and accessories stay theirs.
// Prices come from the skin's rarity (CONFIG.shop.rarities).
//
// look: the parts of a character definition (src/render/characters.js) it
//   replaces. layer: null takes their jacket off.
// =============================================================================
import { CONFIG } from '../config.js';

export const SKINS = [
  { id: 'jersey', name: 'Game Day', rarity: 'common', blurb: 'The team\'s green-and-gold jersey, number zero zero.',
    look: { top: { type: 'tank', color: '#1d5a2e', trim: '#d8b84a', number: '00' }, layer: null, pants: 'chinos', shoes: 'whiteSneaker' } },
  { id: 'lumberjack', name: 'Lumberjack', rarity: 'common', blurb: 'Red flannel over a black tee. Smells like campfire.',
    look: { top: { type: 'tee', color: '#151517' }, layer: { type: 'flannel', color: '#8e2a22', check: '#2a1210' }, pants: 'jeans', shoes: 'sneaker' } },
  { id: 'midnight', name: 'Midnight', rarity: 'common', blurb: 'All black, zipped up. Good for sneaking past the Cheddar.',
    look: { top: { type: 'tee', color: '#0e0e10' }, layer: { type: 'zip', color: '#0b0b0d' }, pants: 'darkJeans', shoes: 'sneaker' } },
  { id: 'beach', name: 'Spring Break', rarity: 'common', blurb: 'Orange camp shirt, white tank, light wash. Wrong season, right attitude.',
    look: { top: { type: 'tank', color: '#f1efe8' }, layer: { type: 'camp', color: '#d9772f', short: true }, pants: 'lightJeans', shoes: 'whiteSneaker' } },
  { id: 'varsity', name: 'Varsity', rarity: 'rare', blurb: 'The Stew varsity tee under a forest-green zip-up.',
    look: { top: { type: 'tee', color: '#151517', print: 'varsity' }, layer: { type: 'zip', color: '#1d4a2a' }, pants: 'darkJeans', shoes: 'whiteSneaker' } },
  { id: 'hazmat', name: 'Hazmat', rarity: 'rare', blurb: 'A yellow work jacket zipped to the chin. Nothing gets in.',
    look: { top: { type: 'tee', color: '#2a2a2a' }, layer: { type: 'canvas', color: '#d6b22a', zipTo: 0.85 }, pants: 'chinos', shoes: 'sneaker' } },
  { id: 'iceCaves', name: 'Ice Caves', rarity: 'rare', blurb: 'A white sherpa fleece for the coldest island in the Crust.',
    look: { top: { type: 'tee', color: '#2f4a66' }, layer: { type: 'sherpa', color: '#e6ebee' }, pants: 'darkJeans', shoes: 'whiteSneaker' } },
  { id: 'tux', name: 'Black Tie', rarity: 'rare', blurb: 'A tux with a bow tie, for prom night at Stew Leonard High.',
    look: { top: { type: 'suit', color: '#0e0e10', shirt: '#f2f1ec', bow: true }, layer: null, pants: 'suit', shoes: 'dress' } },
  { id: 'bloodMoon', name: 'Blood Moon', rarity: 'legendary', blurb: 'A deep red suit with a black shirt and tie, and the hair to match.',
    look: { top: { type: 'suit', color: '#5a0e12', shirt: '#121214', tie: '#050506' }, layer: null, pants: 'suit', shoes: 'dress', hairColor: [26, 14, 12] } },
  { id: 'golden', name: 'Golden Ladle', rarity: 'legendary', blurb: 'A gold suit and bleached hair. Everyone will know you can afford it.',
    look: { top: { type: 'suit', color: '#b28a2c', shirt: '#141416', tie: '#d8b84a' }, layer: null, pants: 'suit', shoes: 'dress', hairColor: [214, 186, 120] } },
  // --- not for sale: `unlock` says how you get them -----------------------------------
  // free: every username has it. kills: `need` kills while playing as that
  // character unlocks it for them (and CONFIG.shop.opalAccounts have it on everyone).
  // fx: a finish applied after the character's built (src/render/skinFx.js).
  { id: 'sexyFucci', name: 'Sexy Fucci', rarity: 'exclusive', unlock: { kind: 'free' }, fx: 'bikini',
    blurb: 'A Fucci bikini in black lacquer and gold. Free to everyone for playing Stew Zombies 2.0.',
    look: { top: { type: 'tank', color: '#111113' }, layer: null, pants: 'chinos', shoes: 'whiteSneaker' } },
  { id: 'opal', name: 'Pink Diamond Galaxy Opal Drippy Face Build Skin', rarity: 'exclusive', unlock: { kind: 'kills', need: 1000 }, fx: 'opal',
    blurb: 'Head to toe in glowing pink opal and diamond, with a galaxy swirling round them.',
    look: { top: { type: 'tee', color: '#ff7ad8' }, layer: null, pants: 'chinos', shoes: 'whiteSneaker', hairColor: [255, 170, 230], armSkin: [255, 160, 228] } },
];

export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));

export const rarityOf = (skin) => CONFIG.shop.rarities[skin.rarity] || CONFIG.shop.rarities.common;
export const priceOf = (id) => (SKIN_BY_ID[id] && !SKIN_BY_ID[id].unlock ? rarityOf(SKIN_BY_ID[id]).price : Infinity);

// A character definition wearing a skin: hand it to buildCharacter() in place
// of the id. (No skin, or one we don't know: their own outfit.)
export function applySkin(def, charId, skinId) {
  const s = SKIN_BY_ID[skinId];
  if (!def || !s) return def;
  const L = s.look, out = { ...def, id: charId, top: { ...L.top } };
  if ('layer' in L) out.layer = L.layer ? { ...L.layer } : undefined;
  if (L.pants) out.pants = L.pants;
  if (L.shoes) out.shoes = L.shoes;
  if (L.hairColor && def.hair) out.hair = { ...def.hair, color: L.hairColor };
  if (L.armSkin) out.armSkin = L.armSkin;   // (your arms in first person)
  if (s.fx) out.skinFx = s.fx;
  return out;
}
