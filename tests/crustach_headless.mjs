// The ten Call of the Crust achievements: each one unlocks from what happens in
// a real Crust game, and none of them unlock on the school.
// Run: node tests/crustach_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { SCHOOL } from '../src/map/school.js';
import { Career } from '../src/career/career.js';
import { CareerTracker } from '../src/career/tracker.js';
import { ACHIEVEMENTS } from '../src/career/achievements.js';
import { islandPowerOn } from '../src/sim/crustPower.js';
import { startLaunch } from '../src/sim/launchers.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const memStore = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };

const crustAch = ACHIEVEMENTS.filter((a) => a.map === 'crust');
check(crustAch.length === 10, 'ten Call of the Crust achievements');
check(new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length, 'every achievement id is unique');
check(ACHIEVEMENTS.every((a) => a.title && a.desc && a.g > 0 && (a.kind === 'event' || a.kind === 'stat')), 'every achievement has a title, description and gamerscore');

async function setup(map) {
  const C = new Career({}, { fetchFn: null, storage: memStore() });
  await C.signIn('Crust Tester');
  const got = [];
  C.onUnlock = (a) => got.push(a.id);
  const T = new CareerTracker(C);
  const sim = new GameSim({ map, seed: 7 });
  const p = sim.addPlayer('p1', 'Tester');
  const feed = () => { for (const e of sim.events.splice(0)) T.onEvent(e, sim, p.id); };
  T.tick(sim, p.id, 1 / 60);
  return { C, T, sim, p, got, feed };
}

{
  const { sim, p, got, feed } = await setup(CRUST);
  const fire = (type, data) => { sim.emit(type, data); feed(); };

  for (const r of [14, 15]) fire('roundStart', { round: r });
  check(got.includes('crustRound15') && !got.includes('crustRound30'), 'round 15 on the Crust unlocks Space Cadet');
  fire('roundStart', { round: 30 });
  check(got.includes('crustRound30'), 'round 30 unlocks Lost in Space');

  const islands = CRUST.islands.map((i) => i.id);
  for (const id of islands.slice(0, -1)) islandPowerOn(sim, id, { x: 0, z: 0 });
  feed();
  check(!got.includes('crustPower'), 'Power Grid waits for the last island');
  islandPowerOn(sim, islands[islands.length - 1], { x: 0, z: 0 });
  feed();
  check(got.includes('crustPower'), 'power on all five islands unlocks Power Grid');

  const pad = CRUST.launchers[0], to = CRUST.launchers.find((q) => q.id === pad.to);
  for (let i = 0; i < 9; i++) { startLaunch(sim, p, pad, to); p.launch = null; }
  feed();
  check(!got.includes('crustLaunch'), '9 launches is not enough');
  startLaunch(sim, p, pad, to); p.launch = null; feed();
  check(got.includes('crustLaunch'), '10 launch pad trips unlocks Frequent Flyer');

  // kills: the flamethrower, then a War Hammer
  const hold = (id) => { p.loadout.slots[p.loadout.current] = { id, clip: 1, reserve: 0 }; };
  hold('M2 Flamethrower');
  for (let i = 0; i < 49; i++) fire('zombieKilled', { playerId: p.id, kind: 'fire' });
  fire('zombieKilled', { playerId: p.id, kind: 'bullet' });
  check(!got.includes('crustFlame'), 'Well Done needs 50 fire kills (a bullet does not count)');
  fire('zombieKilled', { playerId: p.id, kind: 'fire' });
  check(got.includes('crustFlame'), '50 flamethrower kills unlocks Well Done');
  hold('Fire Hammer+');
  for (let i = 0; i < 99; i++) fire('zombieKilled', { playerId: p.id, kind: 'hammer' });
  fire('zombieKilled', { playerId: 'someone else', kind: 'hammer' });
  check(!got.includes('crustHammerTime'), "Hammer Time needs 100 of your own kills (a friend's don't count)");
  fire('zombieKilled', { playerId: p.id, kind: 'wind' });
  check(got.includes('crustHammerTime'), '100 War Hammer kills (a tempered one counts) unlocks Hammer Time');

  fire('warHammerBuilt', { playerId: 'p2' });
  check(got.includes('crustWarHammer'), "building the War Hammer unlocks Some Assembly Required (for the whole squad)");
  for (let n = 1; n <= 3; n++) fire('hammerForged', { element: 'fire', count: n });
  check(!got.includes('crustHammers'), 'Four Elements waits for the fourth hammer');
  fire('hammerForged', { element: 'ice', count: 4 });
  check(got.includes('crustHammers'), 'all four hammers forged unlocks Four Elements');
  fire('titanDown', { id: 'trench' });
  check(got.includes('crustTitan'), 'a titan down unlocks Giant Slayer');
  fire('crustVictory', { round: 31 });
  check(got.includes('crustVictory'), 'beating Big Evil Zach unlocks Crust Buster');
  check(crustAch.every((a) => got.includes(a.id)), 'all ten unlocked');
  check(!got.includes('egg'), "the Crust's ending doesn't unlock the school's Out of Bounds");
}

{
  // the school: none of the Crust ones
  const { sim, p, got, feed } = await setup(SCHOOL);
  sim.emit('roundStart', { round: 30 });
  for (let i = 0; i < 12; i++) sim.emit('playerLaunch', { playerId: p.id });
  p.loadout.slots[p.loadout.current] = { id: 'M2 Flamethrower', clip: 1, reserve: 0 };
  for (let i = 0; i < 60; i++) sim.emit('zombieKilled', { playerId: p.id, kind: 'fire' });
  for (const t of ['warHammerBuilt', 'titanDown', 'crustVictory']) sim.emit(t, {});
  sim.emit('hammerForged', { count: 4 }); sim.emit('islandPower', { count: 5, total: 5 });
  feed();
  check(got.includes('round25') && !got.some((id) => id.startsWith('crust')), 'no Crust achievements on the school');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
