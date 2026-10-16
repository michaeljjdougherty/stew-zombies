// =============================================================================
// The Battle Pass: 20 tiers of prizes you get just by playing (it's free).
// Rounds, kills and games give pass XP (CONFIG.shop.pass); every
// `xpPerTier` XP is a tier, and each tier's prize is yours the moment you reach it.
//
// The prizes are the skins (src/career/skins.js, `unlock: { kind: 'pass', tier }`)
// and emotes (src/career/emotes.js, `pass: tier`) that say which tier they're on,
// plus the Stew Bucks tiers in CONFIG.shop.pass.bucks. Every skin and emote in
// the pass fits every character. The top tier is Burger Bros.
//
// Your XP is saved with your career (profile.shop.passXp, src/career/career.js).
// =============================================================================
import { CONFIG } from '../config.js';
import { SKINS } from './skins.js';
import { EMOTES } from './emotes.js';

const P = () => CONFIG.shop.pass;

// Every tier, in order: { tier, kind: 'skin' | 'emote' | 'bucks', id?, n?, item? }
export function passTiers() {
  const out = [];
  for (let t = 1; t <= P().tiers; t++) {
    const skin = SKINS.find((s) => s.unlock && s.unlock.kind === 'pass' && s.unlock.tier === t);
    const emote = EMOTES.find((e) => e.pass === t);
    if (skin) out.push({ tier: t, kind: 'skin', id: skin.id, item: skin });
    else if (emote) out.push({ tier: t, kind: 'emote', id: emote.id, item: emote });
    else if (P().bucks[t]) out.push({ tier: t, kind: 'bucks', n: P().bucks[t] });
    else out.push({ tier: t, kind: 'none' });
  }
  return out;
}

// The tier you've reached with this much XP (0: none yet), capped at the top
export const tierOf = (xp) => Math.min(P().tiers, Math.floor(Math.max(0, xp || 0) / P().xpPerTier));

// How far into the next tier: { tier, into, need, done } (done: you've got them all)
export function passProgress(xp) {
  const tier = tierOf(xp), done = tier >= P().tiers;
  return { tier, into: done ? P().xpPerTier : Math.max(0, xp || 0) - tier * P().xpPerTier, need: P().xpPerTier, done };
}

// XP a counted stat gives (the career's earn(): 'rounds', 'kills', 'games')
export function passXpFor(stat, n) {
  const E = P();
  if (stat === 'rounds') return n * E.perRound;
  if (stat === 'kills') return n * E.perKill;
  if (stat === 'games') return n * E.perGame;
  return 0;
}
