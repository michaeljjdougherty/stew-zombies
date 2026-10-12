// Call of the Crust (map 2): the archipelago. The hub and four islands each
// join up inside; the launchers fling you between them (nothing touches you in
// the air); zombies left behind on another island get recycled near you; the
// doors and debris open; zombies find you inside each island; the slush slows
// you; the guns, the box and Explore work. Run: node tests/crust_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { unreachable } from '../src/map/layout.js';
import { makeZombie } from '../src/sim/zombies.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

// --- the map data
for (const isl of CRUST.islands) {
  const regs = CRUST.navRegions.filter((r) => isl.rooms.includes(r.room));
  const ports = CRUST.portals.filter((p) => regs.some((r) => r.id === p.a));
  check(unreachable(regs, ports, regs[0].id).length === 0, `${isl.name}: all ${regs.length} areas join up`);
}
check(CRUST.islands.filter((i) => i.element).map((i) => i.element).sort().join() === 'fire,ice,lightning,wind', 'one island for each element');

function game(seed = 5, mode = 'zombies') {
  const sim = new GameSim({ map: CRUST, seed, mode });
  const me = sim.addPlayer('p1', 'Tester');
  const log = [];
  const step = (patch = {}, n = 1) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, ...patch }); sim.step(dt); log.push(...sim.drainEvents()); } };
  const put = (x, z, yaw = 0) => { me.pos.x = x; me.pos.y = 0; me.pos.z = z; me.vel.x = me.vel.y = me.vel.z = 0; me.yaw = yaw; me.region = null; step({}, 3); };
  const face = (pos) => { me.yaw = Math.atan2(-(pos.x - me.pos.x), -(pos.z - me.pos.z)); };
  const use = () => { step({}, 2); step({ use: true, usePressed: true, yaw: me.yaw }); step({}, 2); };
  return { sim, me, log, step, put, face, use };
}

// --- you crash-land at the Crash Site, beside the Anvil
{
  const { sim, me, log, step } = game();
  check(sim.zoneOf(me.pos) === 'crash', 'you start at the Crash Site');
  me.health = me.maxHealth = 1e9;
  step({}, 60 * 30);
  const rose = log.filter((e) => e.type === 'zombieRise');
  check(rose.length > 0 && rose.every((e) => sim.zoneOf(e.pos) === 'crash'), `zombies rise at the Crash Site, nowhere else yet (${rose.length})`);
}

// --- the debris out of the Crash Site, then the launchers
{
  const { sim, me, log, step, put, face, use } = game();
  me.points = 1e6;
  const d = sim.world.doors.find((x) => x.id === 'debris_hub_south');
  put(d.center.x + d.normal.x * 1.2, d.center.z + d.normal.z * 1.2); face(d.center);
  const before = me.points;
  use();
  check(sim.doorOpen('debris_hub_south') && before - me.points === 750, 'clear the debris out of the Crash Site (750)');
  for (const [pad, dest, island] of [['pad_hub_s', 'pad_trench', 'trench'], ['pad_hub_n', 'pad_ship', 'ship'], ['pad_hub_e', 'pad_research', 'research'], ['pad_hub_w', 'pad_caves', 'caves']]) {
    const P = CRUST.launchers.find((q) => q.id === pad), D = CRUST.launchers.find((q) => q.id === dest);
    put(P.x + 0.3, P.z + 0.3);
    check(me.prompt && /launch/i.test(me.prompt.text), `${pad}: "${me.prompt && me.prompt.text}"`);
    step({ use: true, usePressed: true, yaw: me.yaw });
    check(!!me.launch, '  and off you go');
    let top = 0;
    for (let i = 0; i < 60 * 5 && me.launch; i++) { step({}, 1); top = Math.max(top, me.pos.y); if (me.launch && me.launch.t > 1) { const h = me.health; sim.damagePlayer(me, 50, null); check(me.health === h, '  nothing can hurt you in the air'); me.launch.t += 0; } }
    const isl = CRUST.islands.find((i) => i.id === island);
    check(!me.launch && Math.hypot(me.pos.x - D.x, me.pos.z - D.z) < 0.5 && isl.rooms.includes(sim.roomAt(me.pos).id), `  landed on ${isl.name} (up to ${top.toFixed(0)} m)`);
    // and back
    step({}, 90);
    put(D.x + 0.2, D.z - 0.2);
    step({ use: true, usePressed: true, yaw: me.yaw });
    for (let i = 0; i < 60 * 5 && me.launch; i++) step({}, 1);
    check(Math.hypot(me.pos.x - P.x, me.pos.z - P.z) < 0.5, '  and launched back to the hub');
    step({}, 90);
  }
  check(log.some((e) => e.type === 'playerLaunch') && log.some((e) => e.type === 'playerLaunchLand'), 'launch and landing events');
}

// --- a zombie left behind on the hub when you launch away gets recycled near you
{
  const { sim, me, log, step, put } = game(9);
  me.health = me.maxHealth = 1e9;
  put(-114.5, 6);   // the Ice Caves' mouth
  sim.rounds.phase = 'active'; sim.rounds.toSpawn = 0; sim.rounds.round = 3;
  const z = makeZombie(sim, { type: 'walker', pos: { x: -20, y: 0, z: 20 }, health: 1e6, state: 'chase' });
  sim.zombies.push(z);
  step({}, 60 * (sim.cfg.crust.strandedTime + 2));
  const rose = log.filter((e) => e.type === 'zombieRise');
  check(z.state === 'dead' && rose.length === 1 && Math.hypot(rose[0].pos.x - me.pos.x, rose[0].pos.z - me.pos.z) < 40 && sim.rounds.phase === 'active', 'a zombie left on the hub is recycled: it rises again near you, on the Ice Caves (' + [z.state, rose.length, rose[0] && Math.hypot(rose[0].pos.x - me.pos.x, rose[0].pos.z - me.pos.z).toFixed(1), sim.rounds.phase].join(' ') + ')');
}

// One zombie a long way off, everything open: does it reach you (on the same island)?
function chase(label, from, to, secs = 120) {
  const { sim, me, step, put } = game(7);
  for (const d of CRUST.doors) sim.openDoor(d.id);
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
chase('hub: round the Anvil, from the Crash Site to the Observatory', { x: -23, z: 23 }, { x: -20, z: -25 });
chase('hub: Dig Camp to the Supply Depot', { x: 25, z: 20 }, { x: 25, z: -25 });
chase('ship: the pier to the engine room', { x: -6, z: -118 }, { x: 33, z: -190 });
chase('ship: the trawler to the keeper\'s house', { x: 33, z: -120 }, { x: -40, z: -165 });
chase('research: the helipad to the radio yard', { x: 115, z: 20 }, { x: 182, z: -30 });
chase('research: the dormitory to the generator hall', { x: 132, z: 36 }, { x: 155, z: -36 });
chase('trenches: the landing zone to the burning farm', { x: -30, z: 115 }, { x: 8, z: 168 });
chase('trenches: the bunker to the supply dump', { x: -40, z: 140 }, { x: 35, z: 165 });
chase('caves: the mouth to the frozen lake', { x: -118, z: 10 }, { x: -182, z: 0 });
chase('caves: the mine to the wind summit', { x: -130, z: 40 }, { x: -170, z: -30 });

// --- the slush slows you; trenches are narrow; windows have boards
{
  const { sim, me, step, put } = game();
  const run = (x, z) => { put(x, z, Math.PI / 2); const x0 = me.pos.x; step({ moveY: 1, yaw: Math.PI / 2 }, 60); return Math.abs(me.pos.x - x0); };
  const slush = run(32, -155), ice = run(14, -160);
  check(slush < ice * 0.75, `slush in the harbor slows you (${slush.toFixed(2)} m vs ${ice.toFixed(2)} m on clear ice)`);
  const tr = CRUST.rooms.filter((r) => r.kind === 'trench');
  check(tr.length >= 8 && tr.every((r) => Math.min(r.rect[2] - r.rect[0], r.rect[3] - r.rect[1]) <= 2.7), `${tr.length} trenches, all narrow (2.6 m)`);
  check(sim.windows.length >= 20 && sim.windows.every((w) => w.boards === sim.cfg.windows.boards), `${sim.windows.length} boarded windows`);
}

// --- the guns on the walls and the box
{
  const { sim, me, step, face } = game();
  me.points = 50000;
  const wb = sim.interactables.find((i) => i.kind === 'wallbuy' && i.wb.weapon === 'M15' && i.wb.room === 'crash');
  me.pos.x = wb.stand.x; me.pos.z = wb.stand.z; face(wb.pos);
  step({}, 2); step({ use: true, usePressed: true, yaw: me.yaw }); step({}, 2);
  check(me.loadout.slots.some((s) => s.id === 'M15'), 'bought the M15 at the Crash Site');
  check(sim.world.wallBuys.length >= 20, `${sim.world.wallBuys.length} guns on the walls round the map`);
  const box = sim.box;
  me.pos.x = box.stand.x; me.pos.z = box.stand.z; face(box.pos);
  step({}, 2); step({ use: true, usePressed: true, yaw: me.yaw }); step({}, 2);
  check(box.phase === 'spinning', 'the Mystery Box spins at the Crash Site (' + box.phase + ')');
  check(sim.world.boxSpots.length === 10, 'ten places the box can be, two on every island');
}

// --- Explore: endless points, the launchers free
{
  const { sim, me } = game(5, 'explore');
  check(me.points >= 999999 && sim.godMode, 'Explore: endless points, nothing can hurt you');
}

console.log(fails ? `\n${fails} FAILED` : '\nall crust checks passed');
process.exit(fails ? 1 : 0);
