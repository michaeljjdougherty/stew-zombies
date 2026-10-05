// =============================================================================
// Achievements: ten for now, 500G in all (gamerscore, like Xbox). Earned once
// per username and saved with its career (src/career/career.js).
//
// kind:  'stat'   — a career total reaches `need` (stat: which one)
//        'event'  — unlocked by career.js when the thing happens (see check())
// =============================================================================
export const ACHIEVEMENTS = [
  { id: 'kills250', title: 'All You Can Eat', desc: 'Kill 250 zombies.', g: 25, kind: 'stat', stat: 'kills', need: 250 },
  { id: 'revives10', title: 'Second Helping', desc: 'Revive 10 teammates.', g: 25, kind: 'stat', stat: 'revives', need: 10 },
  { id: 'rounds50', title: 'Slow Cooker', desc: 'Survive 50 rounds in total.', g: 40, kind: 'stat', stat: 'rounds', need: 50 },
  { id: 'round10', title: 'Warming Up', desc: 'Reach round 10 in a single game.', g: 15, kind: 'event' },
  { id: 'round25', title: 'Undefeated Season', desc: 'Reach round 25 in a single game.', g: 60, kind: 'event' },
  { id: 'maddog', title: 'Feed the Dog', desc: 'Upgrade a weapon in the Mad Dog Machine.', g: 15, kind: 'event' },
  { id: 'cheddar', title: 'Lactose Intolerant', desc: 'Get through a Cheddar round without going down.', g: 30, kind: 'event' },
  { id: 'fullyLoaded', title: 'Fully Loaded', desc: 'Hold the Fucci Gun and the Chopper at the same time.', g: 40, kind: 'event' },
  { id: 'egg', title: 'Out of Bounds', desc: 'Complete The Final Whistle.', g: 100, kind: 'event', secret: false },
  { id: 'eggHardcore', title: 'Hardcore Fan', desc: 'Complete The Final Whistle on Hardcore.', g: 150, kind: 'event' },
];

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const TOTAL_G = ACHIEVEMENTS.reduce((n, a) => n + a.g, 0);
