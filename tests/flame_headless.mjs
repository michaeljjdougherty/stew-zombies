// The M2 Flamethrower: sets zombies alight, they burn until they die; it overheats.
// Run: node tests/flame_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { makeZombie } from '../src/sim/zombies.js';
import { giveWeapon } from '../src/sim/weapons.js';
import { CONFIG } from '../src/config.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const sim = new GameSim({ map: SCHOOL, seed: 4 });
const me = sim.addPlayer('p1', 'Tester');
sim.rounds.timer = 1e9;
me.pos.x = 9; me.pos.z = 10; me.yaw = 0; me.pitch = -0.2; me.points = 0;
const log = [];
const step = (patch = {}, n = 1) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch }); sim.step(dt); for (const e of sim.drainEvents()) log.push(e); } };
const addZ = (x, z, hp) => { const zz = makeZombie(sim, { pos: { x, y: 0, z }, health: hp, state: 'chase' }); zz.speed = 0.01; zz.region = sim.nav.regionAt(zz.pos); sim.zombies.push(zz); return zz; };

check(!!CONFIG.weapons['M2 Flamethrower'] && CONFIG.box.weights['M2 Flamethrower'] > 0, 'the M2 Flamethrower is in the box');
giveWeapon(sim, me, 'M2 Flamethrower');
step({}, 60);
const near = addZ(9, 6, 20000), side = addZ(9.6, 4, 20000), behind = addZ(9, 15, 20000), far = addZ(9, -4, 20000);
step({ fire: true, firePressed: true }, 1);
step({ fire: true }, 30);
check(!!near.burn && !!side.burn, 'the jet sets the ones in front alight');
check(!behind.burn && !far.burn, 'not the one behind you, or one 14 m off');
const ptsAfterLight = me.points;
step({}, 60);
check(near.health < 20000 * 0.7 && near.state !== 'dead', `once alight it keeps burning with the trigger let go (${Math.round(near.health)} left)`);
step({}, 60 * 3);
check(near.state === 'dead' && side.state === 'dead', 'and burns until it dies (about 3 s for any health)');
const kills = log.filter((e) => e.type === 'zombieKilled' && e.kind === 'fire').length;
check(kills === 2, `burnt to death: ${kills}`);
check(me.points - ptsAfterLight === 2 * CONFIG.points.kill, `points for the kills, not for every lick of flame (${me.points} in all)`);
// overheating
const slot = me.loadout.slots[me.loadout.current];
slot.heat = 0;
step({ fire: true, firePressed: true }, 1);
step({ fire: true }, 60 * 7);
check(log.some((e) => e.type === 'flameOverheat') && slot.overheat > 0, 'held down too long: it overheats');
const shots = log.filter((e) => e.type === 'shot').length;
step({ fire: true }, 30);
check(log.filter((e) => e.type === 'shot').length === shots, '...and won\'t fire while it\'s too hot');
step({}, 60 * 3);
check(slot.overheat === 0, 'cooled off, ready again');
console.log(fails ? `\n${fails} flamethrower check(s) FAILED` : '\nall flamethrower checks passed');
process.exit(fails ? 1 : 0);
