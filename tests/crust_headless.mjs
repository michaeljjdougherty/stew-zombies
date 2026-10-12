// Call of the Crust (map 2), early build: the Call of the Dead-style layout.
// The nav joins up, the debris and doors open the way round (trenches →
// Lighthouse Point → the lagoon → the shore → the camp → back to the Landing),
// zombies find you wherever you stand once it's open, the trenches are narrow,
// the slush slows you, the windows have boards, and the guns and the box work.
// Explore mode works here too. Run: node tests/crust_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { unreachable } from '../src/map/layout.js';
import { makeZombie } from '../src/sim/zombies.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

// --- the map data
check(unreachable(CRUST.navRegions, CRUST.portals, 'landing').length === 0, `all ${CRUST.navRegions.length} areas join up`);
const ALL = CRUST.doors.map((d) => d.id);

function game(seed = 5, mode = 'zombies') {
  const sim = new GameSim({ map: CRUST, seed, mode });
  const me = sim.addPlayer('p1', 'Tester');
  const log = [];
  const step = (patch = {}, n = 1) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, ...patch }); sim.step(dt); log.push(...sim.drainEvents()); } };
  const put = (x, z, yaw = 0) => { me.pos.x = x; me.pos.y = 0; me.pos.z = z; me.vel.x = me.vel.y = me.vel.z = 0; me.yaw = yaw; step({}, 3); };
  const face = (it) => { me.yaw = Math.atan2(-(it.pos.x - me.pos.x), -(it.pos.z - me.pos.z)); };
  return { sim, me, log, step, put, face };
}

// --- you start in the Landing, shut in; zombies come up out of the snow
{
  const { sim, me, log, step } = game();
  check(sim.zoneOf(me.pos) === 'landing', 'you start in the Landing');
  me.health = me.maxHealth = 1e9;
  step({}, 60 * 30);
  const rose = log.filter((e) => e.type === 'zombieRise');
  check(rose.length > 0, `zombies rise in the Landing (${rose.length})`);
  check(rose.every((e) => sim.zoneOf(e.pos) === 'landing'), 'only in the Landing while the rest is shut');
}

// --- buying the way round
{
  const { sim, me, step, put, face } = game();
  me.points = 1e6;
  const buy = (id) => {
    const it = sim.interactables.find((i) => i.kind === 'door' && i.door.id === id);
    const d = sim.world.doors.find((x) => x.id === id);
    put(d.center.x + d.normal.x * 1.2, d.center.z + d.normal.z * 1.2);
    face({ pos: d.center });
    step({}, 2); step({ use: true, usePressed: true, yaw: me.yaw }); step({}, 2);
    void it;
    return sim.doorOpen(id);
  };
  const before = me.points;
  check(buy('debris_trench'), 'clear the debris into the trenches');
  check(before - me.points === 750, 'for 750 (' + (before - me.points) + ')');
  check(buy('debris_camp'), 'clear the debris into the Fishing Camp');
  for (const id of ['door_cabin', 'debris_shore', 'door_hold', 'debris_point', 'door_hut']) check(buy(id), 'open ' + id);
}

// One zombie a long way off, everything open: does it reach you?
function chase(label, from, to, secs = 120) {
  const { sim, me, step, put } = game(7);
  for (const id of ALL) sim.openDoor(id);
  sim.rounds.phase = 'pregame'; sim.rounds.timer = 1e9;
  me.health = me.maxHealth = 1e9;
  put(to.x, to.z);
  const z = makeZombie(sim, { type: 'runner', pos: { x: from.x, y: 0, z: from.z }, health: 1e6, state: 'chase' });
  sim.zombies.push(z);
  let t = 0, best = Infinity;
  for (; t < secs * 60; t++) {
    step({}, 1);
    const d = Math.hypot(z.pos.x - me.pos.x, z.pos.z - me.pos.z);
    best = Math.min(best, d);
    if (d < 2.2) break;
  }
  check(t < secs * 60, `${label} (${(t / 60).toFixed(1)} s${t >= secs * 60 ? ', closest ' + best.toFixed(1) + ' m, stuck at ' + z.pos.x.toFixed(1) + ',' + z.pos.z.toFixed(1) : ''})`);
}
chase('from the Landing, through the trenches, to the lighthouse', { x: 0, z: 20 }, { x: -40, z: -60 });
chase('from the ship\'s hold to the Landing', { x: 35, z: -95 }, { x: 0, z: 20 });
chase('into the west dugout', { x: 30, z: 0 }, { x: -42, z: -3 });
chase('into the east dugout', { x: -40, z: -70 }, { x: -17.5, z: -33 });
chase('into the keeper\'s hut', { x: 40, z: -60 }, { x: -62, z: -64 });
chase('into the cabin', { x: -30, z: -60 }, { x: 50, z: -6 });
chase('across the lagoon to the shore', { x: -45, z: -70 }, { x: 35, z: -40 });

// --- the trenches are narrow; the slush slows you; the cliffs hold
{
  const { sim, me, step, put } = game();
  const t = CRUST.rooms.filter((r) => /^t\d$/.test(r.id));
  check(t.every((r) => Math.min(r.rect[2] - r.rect[0], r.rect[3] - r.rect[1]) <= 2.7), 'the trenches are narrow (2.6 m)');
  const run = (x, z) => { put(x, z, Math.PI / 2); const x0 = me.pos.x; step({ moveY: 1, yaw: Math.PI / 2 }, 60); return Math.abs(me.pos.x - x0); };
  const slush = run(8 + 3, -72), ice = run(-2, -50);
  check(slush < ice * 0.75, `slush in the lagoon slows you (${slush.toFixed(2)} m vs ${ice.toFixed(2)} m on clear ice)`);
  put(0, 8, 0);
  step({ moveY: 1 }, 120);
  check(me.pos.z > 6, 'the Landing\'s cliffs hold you in (z ' + me.pos.z.toFixed(2) + ')');
  check(sim.windows.length === 7 && sim.windows.every((w) => w.boards === sim.cfg.windows.boards), `${sim.windows.length} boarded windows (hut, cabin, hold)`);
}

// --- the guns on the walls and the box
{
  const { sim, me, step, face } = game();
  me.points = 50000;
  const wb = sim.interactables.find((i) => i.kind === 'wallbuy' && i.wb.weapon === 'MP41');
  me.pos.x = wb.stand.x; me.pos.z = wb.stand.z; face(wb);
  step({}, 2); step({ use: true, usePressed: true, yaw: me.yaw }); step({}, 2);
  check(me.loadout.slots.some((s) => s.id === 'MP41'), 'bought the MP41 off the Landing\'s cliff');
  const guns = sim.interactables.filter((i) => i.kind === 'wallbuy').map((i) => i.wb.weapon);
  check(['M15', 'Staykout', 'PM64', 'MPK', 'Olympus', 'frag'].every((w) => guns.includes(w)), 'guns round the map: ' + guns.join(', '));
  const box = sim.box;
  me.pos.x = box.stand.x; me.pos.z = box.stand.z; face(box);
  step({}, 2); step({ use: true, usePressed: true, yaw: me.yaw }); step({}, 2);
  check(box.phase === 'spinning', 'the Mystery Box spins in the Landing (' + box.phase + ')');
  check(sim.world.boxSpots.length === 4, 'four places the box can be: ' + sim.world.boxSpots.map((b) => b.id).join(', '));
}

// --- Explore mode on this map: endless points, everything open for nothing
{
  const { sim, me } = game(5, 'explore');
  check(me.points >= 999999 && sim.godMode, 'Explore: endless points, nothing can hurt you');
}

console.log(fails ? `\n${fails} FAILED` : '\nall crust checks passed');
process.exit(fails ? 1 : 0);
