// Phase 2 headless test: doors, wall buys, the box, and zombie pathing between rooms.
// Run: node tests/phase2_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';

const sim = new GameSim({ map: SCHOOL, seed: 99 });
const me = sim.addPlayer('p1', 'Tester');
me.points = 20000;
const dt = 1 / 60;
const log = [];
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };

function step(cmdPatch = {}, n = 1) {
  for (let i = 0; i < n; i++) {
    const c = { ...emptyCommand(), yaw: me.yaw, pitch: 0, ...cmdPatch };
    sim.setInput('p1', c); sim.step(dt);
    for (const e of sim.drainEvents()) log.push(e);
  }
}
function place(x, z, lookX, lookZ) {
  me.pos.x = x; me.pos.z = z; me.pos.y = 0; me.vel.x = me.vel.z = 0;
  me.yaw = Math.atan2(-(lookX - x), -(lookZ - z));
  step({}, 2);
}
const use = () => { step({ usePressed: true, use: true }); step({}, 2); };

// 1. open the hallway door from the court
place(15.8, 6, 17.25, 6);
check(me.prompt && /open door/.test(me.prompt.text), 'door prompt: ' + (me.prompt && me.prompt.text));
use();
check(sim.doorOpen('door_hall'), 'door_hall opened');
check(me.points === 20000 - 750, 'door cost 750');

// 2. walk through the doorway into the hall
place(15.8, 6, 20, 6);
step({ moveY: 1 }, 90);
check(me.region === 'hall', 'walked into hall (region ' + me.region + ', x=' + me.pos.x.toFixed(2) + ')');

// 3. buy the Olympus off the wall
place(20.3, 3, 21.6, 3);
check(me.prompt && /Olympus/.test(me.prompt.text), 'olympus prompt: ' + (me.prompt && me.prompt.text));
use();
check(me.loadout.slots.map((s) => s.id).join(',') === 'M1912,Olympus', 'has pistol + Olympus');

// 4. mystery box
place(20.0, -3, 21.2, -3);
check(me.prompt && /Mystery Box/.test(me.prompt.text), 'box prompt: ' + (me.prompt && me.prompt.text));
use();
check(sim.box.phase === 'spinning', 'box spinning');
step({}, 60 * 4.4);
check(sim.box.phase === 'offering', 'box offering ' + sim.box.weapon);
const pulled = sim.box.weapon;
use();
check(me.loadout.slots.some((s) => s.id === pulled), 'took ' + pulled + ' (replaced held weapon)');
check(me.loadout.slots.length === 2, 'still two weapons');

// 5. cafeteria door and office debris
place(19.5, -20.8, 19.5, -22.3); use();
check(sim.doorOpen('door_cafe'), 'cafeteria door opened');
place(19.5, 14.8, 19.5, 16.3); use();
check(sim.doorOpen('debris_office'), 'office debris cleared');

// 6. pathing: stand in different rooms; zombies must reach us
function survive(x, z, seconds, label) {
  place(x, z, x, z - 1);
  let hits = 0, maxStuck = 0;
  const stuck = new Map();
  const startLog = log.length;
  for (let t = 0; t < seconds * 60; t++) {
    me.maxHealth = 1e9; me.health = 1e9; // god mode
    step({}, 1);
    for (const zb of sim.zombies) {
      if (zb.state !== 'chase') continue;
      const s = (zb.moveSpeed < 0.15 && Math.hypot(zb.pos.x - me.pos.x, zb.pos.z - me.pos.z) > 2) ? (stuck.get(zb.id) || 0) + dt : 0;
      stuck.set(zb.id, s);
      maxStuck = Math.max(maxStuck, s);
    }
  }
  hits = log.slice(startLog).filter((e) => e.type === 'playerHit').length;
  const zones = [...sim.activeZones()].join(',');
  check(hits > 0, `${label}: zombies reached player (${hits} hits, zones ${zones}, round ${sim.rounds.round}, alive ${sim.zombies.length})`);
  check(maxStuck < 6, `${label}: no zombie stuck > 6s (max ${maxStuck.toFixed(1)}s)`);
  // clear zombies for the next scenario
  for (const zb of [...sim.zombies]) { zb.health = 0; }
  for (const zb of sim.zombies) zb.state = 'dead';
  sim.zombies.length = 0;
}
survive(19.5, 0, 90, 'hallway');
survive(35.5, -31, 90, 'cafeteria stage');
survive(28.5, 24.5, 90, 'principal office');
survive(21.6, -31.4, 60, 'between cafeteria tables');
survive(0, 0, 60, 'court');

const types = {};
for (const e of log) types[e.type] = (types[e.type] || 0) + 1;
console.log(types);
process.exit(fails ? 1 : 0);
