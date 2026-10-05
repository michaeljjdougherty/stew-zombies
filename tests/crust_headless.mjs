// Call of the Crust (map 2): the field builds, zombies rise out of the snow and
// come for you, the box and the wall gun work, and Erik isn't here.
// Run: node tests/crust_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const sim = new GameSim({ map: CRUST, seed: 5, mode: 'zombies' });
const me = sim.addPlayer('p1', 'Tester');
const log = [];
const step = (patch = {}, n = 1) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, ...patch }); sim.step(1 / 60); log.push(...sim.drainEvents()); } };

check(!sim.quest && !sim.pa.enabled, 'no quest, no Erik on the PA');
check(sim.world.walls.some((w) => w.ghost) && sim.world.walls.some((w) => w.style === 'cliff' && !w.ghost), 'cliff walls and the invisible snowbank walls');
// the invisible wall stops you but not a bullet
const hit = sim.raycastWorld({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: -1 }, 60);
check(!hit || hit.t > 30, 'bullets fly out over the snowbank (' + (hit ? hit.t.toFixed(1) : 'none') + ')');
me.pos.x = 0; me.pos.z = -19; me.yaw = 0; step({ moveY: 1, yaw: 0 }, 150);
check(me.pos.z > -22.2 && me.pos.z < -21, 'but you can\'t walk out of the field (z ' + me.pos.z.toFixed(2) + ')');
me.pos.z = 16; me.pos.x = 0; me.godMode = true; sim.godMode = true;
step({}, 60 * 20);
check(sim.rounds.round >= 1 && log.some((e) => e.type === 'zombieRise'), 'round ' + sim.rounds.round + ': zombies rise out of the snow');
step({}, 60 * 20);
const near = sim.zombies.filter((z) => z.state === 'chase' && Math.hypot(z.pos.x - me.pos.x, z.pos.z - me.pos.z) < 6).length;
check(near > 0, 'and come for you (' + near + ' close)');
check(!log.some((e) => e.type === 'erikSays'), 'Erik stays quiet');
// the wall gun and the box
me.points = 50000;
const wb = sim.interactables.find((i) => i.kind === 'wallbuy' && i.wb.weapon === 'MP41');
me.pos.x = wb.stand.x; me.pos.z = wb.stand.z; me.yaw = Math.atan2(-(wb.pos.x - me.pos.x), -(wb.pos.z - me.pos.z));
step({}, 2); step({ use: true, usePressed: true, yaw: me.yaw }); step({}, 2);
check(me.loadout.slots.some((s) => s.id === 'MP41'), 'bought the MP41 off the cliff wall');
const box = sim.box;
me.pos.x = box.stand.x; me.pos.z = box.stand.z; me.yaw = Math.atan2(-(box.pos.x - me.pos.x), -(box.pos.z - me.pos.z));
step({}, 2); step({ use: true, usePressed: true, yaw: me.yaw }); step({}, 2);
check(box.phase === 'spinning', 'the Mystery Box spins (' + box.phase + ')');

console.log(fails ? `\n${fails} FAILED` : '\nall crust checks passed');
process.exit(fails ? 1 : 0);
