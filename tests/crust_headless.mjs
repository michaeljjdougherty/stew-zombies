// Call of the Crust (map 2), phase 1: the battlefield layout. The nav joins up,
// zombies rise near you and find their way to you wherever you stand (trench,
// No Man's Land, the buildings, down in the pit, up on its rim), the berms stop
// you, the mud slows you and the duckboards don't, the stairs climb the rim,
// and the wall guns and the box work. Run: node tests/crust_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { unreachable } from '../src/map/layout.js';
import { makeZombie } from '../src/sim/zombies.js';
import { CONFIG } from '../src/config.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

// --- the map data
const R = CRUST.navRegions;
check(unreachable(R, CRUST.portals, 'yard_0').length === 0, `every one of the ${R.length} nav regions joins up`);
check(CRUST.groundSpawns.length > 40, `${CRUST.groundSpawns.length} places zombies claw up`);

function game(seed = 5) {
  const sim = new GameSim({ map: CRUST, seed, mode: 'zombies' });
  const me = sim.addPlayer('p1', 'Tester');
  const log = [];
  const step = (patch = {}, n = 1) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, ...patch }); sim.step(dt); log.push(...sim.drainEvents()); } };
  const put = (x, z, y = 0, yaw = 0) => { me.pos.x = x; me.pos.y = y; me.pos.z = z; me.vel.x = me.vel.y = me.vel.z = 0; me.yaw = yaw; step({}, 3); };
  return { sim, me, log, step, put };
}

{
  const { sim, me, log, step } = game();
  check(!sim.quest && !sim.pa.enabled, 'no quest, nobody on the PA yet');
  check(sim.zoneOf(me.pos) === 'bunker', 'you start in the command bunker');
  me.health = me.maxHealth = 1e9;
  step({}, 60 * 25);
  const rose = log.filter((e) => e.type === 'zombieRise');
  check(rose.length > 0, `round ${sim.rounds.round}: zombies rise out of the mud (${rose.length})`);
  const far = rose.filter((e) => Math.hypot(e.pos.x - me.pos.x, e.pos.z - me.pos.z) > CONFIG.crust.spawnRadius + 0.5);
  check(far.length === 0, 'all of them near you (none further than ' + CONFIG.crust.spawnRadius + ' m)');
  step({}, 60 * 30);
  const near = sim.zombies.filter((z) => z.state === 'chase' && Math.hypot(z.pos.x - me.pos.x, z.pos.z - me.pos.z) < 3).length;
  check(near > 0, 'they find their way down the communication trench to the bunker (' + near + ' on you)');
}

// One zombie, a long way off: does it reach you?
function chase(label, from, to, secs = 90) {
  const { sim, me, step, put } = game(7);
  sim.rounds.phase = 'pregame'; sim.rounds.timer = 1e9;   // just this one zombie
  me.health = me.maxHealth = 1e9;
  put(to.x, to.z, to.y || 0);
  const z = makeZombie(sim, { type: 'runner', pos: { x: from.x, y: from.y || 0, z: from.z }, health: 1e6, state: 'chase' });
  sim.zombies.push(z);
  let t = 0, best = Infinity;
  for (; t < secs * 60; t++) {
    step({}, 1);
    const d = Math.hypot(z.pos.x - me.pos.x, z.pos.z - me.pos.z) + Math.abs(z.pos.y - me.pos.y) * 0.5;
    best = Math.min(best, d);
    if (d < 2.2) break;
  }
  check(t < secs * 60, `${label} (${(t / 60).toFixed(1)} s${t >= secs * 60 ? ', closest ' + best.toFixed(1) + ' m, stuck at ' + z.pos.x.toFixed(1) + ',' + z.pos.z.toFixed(1) : ''})`);
}
chase('from the north-west of No Man\'s Land to the bunker', { x: -45, z: -40 }, { x: 0, z: 60 });
chase('round the trench loop', { x: 57, z: -50 }, { x: -57, z: 44 });
chase('into the farmhouse', { x: 30, z: 30 }, { x: -36, z: -2 });
chase('into the church', { x: -40, z: 30 }, { x: 40, z: -1 });
chase('into the workshop', { x: 0, z: 30 }, { x: 0, z: -31 });
chase('down into the pit', { x: -40, z: -20 }, { x: 6, z: 2 });
chase('up onto the rim', { x: 40, z: 30 }, { x: 0, z: -15, y: 4 });
chase('out of the pit to a dugout', { x: 0, z: 0 }, { x: -42.7, z: 46.6 });
chase('into the barn', { x: 20, z: -30 }, { x: -39, z: 23 });

// --- walls, mud, stairs
{
  const { me, step, put } = game();
  // the berm between the south trench and No Man's Land
  put(-50, 44, 0, 0);
  step({ moveY: 1 }, 120);
  check(me.pos.z > 42, 'the trench wall stops you (z ' + me.pos.z.toFixed(2) + ')');
  // mud vs duckboards: same push, different distance
  const run = (x, z) => { put(x, z, 0, Math.PI / 2); const x0 = me.pos.x; step({ moveY: 1, yaw: Math.PI / 2 }, 60); return Math.abs(me.pos.x - x0); };
  const inMud = run(-30, -20), onBoards = run(-28, -1);
  check(inMud < onBoards * 0.75, `deep mud slows you (${inMud.toFixed(2)} m vs ${onBoards.toFixed(2)} m on the duckboards)`);
  // up the outside stairs to the rim
  put(11.5, -26, 0, Math.PI);
  step({ moveY: 1, yaw: Math.PI }, 150);
  check(me.pos.y > 3.8, 'the stairs climb the rim (y ' + me.pos.y.toFixed(2) + ')');
}

// --- the bunker's wall gun and the box
{
  const { sim, me, step } = game();
  me.points = 50000;
  for (const [weapon, x, z] of [['Olympus', -8.2, 59]]) {
    const wb = sim.interactables.find((i) => i.kind === 'wallbuy' && i.wb.weapon === weapon);
    me.pos.x = wb.stand.x; me.pos.z = wb.stand.z; me.yaw = Math.atan2(-(wb.pos.x - me.pos.x), -(wb.pos.z - me.pos.z));
    step({}, 2); step({ use: true, usePressed: true, yaw: me.yaw }); step({}, 2);
    check(me.loadout.slots.some((s) => s.id === weapon), `bought the ${weapon} off the bunker wall`);
    void x; void z;
  }
  const dug = sim.interactables.filter((i) => i.kind === 'wallbuy').map((i) => i.wb.weapon);
  check(['MP41', 'M15', 'Staykout', 'PM64', 'frag'].every((w) => dug.includes(w)), 'wall guns in the dugouts: ' + dug.join(', '));
  const box = sim.box;
  me.pos.x = box.stand.x; me.pos.z = box.stand.z; me.yaw = Math.atan2(-(box.pos.x - me.pos.x), -(box.pos.z - me.pos.z));
  step({}, 2); step({ use: true, usePressed: true, yaw: me.yaw }); step({}, 2);
  check(box.phase === 'spinning', 'the Mystery Box spins in the bunker (' + box.phase + ')');
  check(sim.world.boxSpots.length === 4, 'four places the box can be: ' + sim.world.boxSpots.map((b) => b.id).join(', '));
}

console.log(fails ? `\n${fails} FAILED` : '\nall crust checks passed');
process.exit(fails ? 1 : 0);
