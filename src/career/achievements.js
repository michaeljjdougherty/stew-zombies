// =============================================================================
// Achievements: ten for Stew Leonard High and ten for Call of the Crust
// (map: 'crust'), with gamerscore like Xbox. Earned once per username and
// saved with its career (src/career/career.js).
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
  // Call of the Crust (src/career/tracker.js unlocks these; "one game" counts reset each game)
  { id: 'crustRound15', title: 'Space Cadet', desc: 'Reach round 15 on Call of the Crust.', g: 20, kind: 'event', map: 'crust' },
  { id: 'crustRound30', title: 'Lost in Space', desc: 'Reach round 30 on Call of the Crust.', g: 50, kind: 'event', map: 'crust' },
  { id: 'crustPower', title: 'Power Grid', desc: 'Turn the power on across all five islands.', g: 20, kind: 'event', map: 'crust' },
  { id: 'crustLaunch', title: 'Frequent Flyer', desc: 'Ride the launch pads 10 times in one game.', g: 10, kind: 'event', map: 'crust' },
  { id: 'crustFlame', title: 'Well Done', desc: 'Kill 50 zombies with the M2 Flamethrower in one game.', g: 20, kind: 'event', map: 'crust' },
  { id: 'crustWarHammer', title: 'Some Assembly Required', desc: 'Build the War Hammer at the Anvil.', g: 20, kind: 'event', map: 'crust' },
  { id: 'crustHammerTime', title: 'Hammer Time', desc: 'Kill 100 zombies with a War Hammer in one game.', g: 25, kind: 'event', map: 'crust' },
  { id: 'crustTitan', title: 'Giant Slayer', desc: 'Bring down a titan.', g: 30, kind: 'event', map: 'crust' },
  { id: 'crustHammers', title: 'Four Elements', desc: 'Have Pit forge all four elemental hammers.', g: 40, kind: 'event', map: 'crust' },
  { id: 'crustVictory', title: 'Crust Buster', desc: 'Defeat Big Evil Zach.', g: 100, kind: 'event', map: 'crust' },
];

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const TOTAL_G = ACHIEVEMENTS.reduce((n, a) => n + a.g, 0);
