// What a tempered War Hammer leaves behind really kills (the fire pool, the
// blizzard, the whirlwind, the ball of lightning), the Mad Dog won't upgrade a
// War Hammer (only Pit tempers them, like the Origins staffs), and diving into a
// Maisy Dog's black hole throws you somewhere else on the map (the Gersh device).
// Run: node tests/hammerfx_headless.mjs
import { CONFIG } from '../src/config.js';
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { giveWeapon } from '../src/sim/weapons.js';
import { makeZombie } from '../src/sim/zombies.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

function game(map, mode = 'explore') {
  const sim = new GameSim({ map, seed: 3, mode });
  const me = sim.addPlayer('p1', 'T', { character: 'kearns' });
  sim.rounds.timer = 1e9;
  const log = [];
  const step = (n, c = {}) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...c }); sim.step(dt); log.push(...sim.drainEvents()); } };
  return { sim, me, log, step };
}
// a ring of zombies round a spot, with round-30 health
const ring = (sim, at, r, n = 6) => Array.from({ length: n }, (_, i) => {
  const a = i / n * Math.PI * 2;
  const z = makeZombie(sim, { pos: { x: at.x + Math.cos(a) * r, y: at.y, z: at.z + Math.sin(a) * r }, health: 60000, state: 'chase' });
  z.maxHealth = 60000; z.region = sim.nav.regionAt(z.pos); sim.zombies.push(z);
  return z;
});

// --- each tempered hammer's leftover effect, with zombies brought to it after the swing
for (const [id, type, r] of [['Fire Hammer+', 'hfire', 2.5], ['Ice Hammer+', 'hice', 2.5], ['Wind Hammer+', 'hwind', 4.5]]) {
  const g = game(CRUST);
  g.step(30); giveWeapon(g.sim, g.me, id); g.step(60);
  g.step(1, { fire: true, firePressed: true }); g.step(40);
  const pr = g.sim.projectiles.find((p) => p.type === type);
  check(!!pr, `${id}: leaves its ${type} behind`);
  if (!pr) continue;
  const zs = ring(g.sim, pr.pos, r);
  g.step(4 * 60);
  const dead = zs.filter((z) => z.state === 'dead').length;
  check(dead === zs.length, `${id}: it kills what comes into it, high round or not (${dead}/${zs.length} in 4 s)`);
}

// --- the Lightning Hammer is the Wunderwaffe: a bolt down your aim, then a ball of
// lightning jumping zombie to zombie, killing each (10 forged, 24 tempered)
for (const id of ['Lightning Hammer', 'Lightning Hammer+']) {
  const g = game(CRUST);
  g.step(30); giveWeapon(g.sim, g.me, id); g.step(60);
  const fx = -Math.sin(g.me.yaw), fz = -Math.cos(g.me.yaw);
  const zs = [];
  for (let i = 0; i < 30; i++) {
    const f = 7 + (i % 6) * 1.2, s = ((i / 6 | 0) - 2) * 1.5;
    const z = ring(g.sim, { x: g.me.pos.x + fx * f - fz * s, y: g.me.pos.y, z: g.me.pos.z + fz * f + fx * s }, 0, 1)[0];
    z.speed = 0.01; zs.push(z);   // (stood still, so none walks out of its reach)
  }
  const n0 = g.log.length;
  g.step(1, { fire: true, firePressed: true }); g.step(4 * 60);
  const W = CONFIG.crust.hammers.tempered.lightning.waffe, want = id.endsWith('+') ? W.chains : W.forged;
  const dead = zs.filter((z) => z.state === 'dead').length;
  check(dead === want && g.log.slice(n0).some((e) => e.type === 'hammerChain'), `${id}: the Wunderwaffe kills ${dead} of 30 at round-30 health (wants ${want})`);
  check(!g.sim.projectiles.length, '...and then the ball\'s gone');
}

// --- the quick swing (right click): a sweep in front of you, the same on every
// hammer; no element and nothing left behind
for (const id of ['War Hammer', 'Fire Hammer+', 'Ice Hammer+', 'Wind Hammer+', 'Lightning Hammer+']) {
  const g = game(CRUST);
  const Q = CONFIG.crust.hammers.quick;
  g.step(30); giveWeapon(g.sim, g.me, id); g.step(60);
  const fx = -Math.sin(g.me.yaw), fz = -Math.cos(g.me.yaw), rx = -fz, rz = fx;
  const at = (f, r) => ({ x: g.me.pos.x + fx * f + rx * r, y: g.me.pos.y, z: g.me.pos.z + fz * f + rz * r });
  const front = [at(1.6, -1), at(1.8, 0), at(1.6, 1), at(2.2, -0.4), at(2.2, 0.4), at(2.4, 0)].map((q) => ring(g.sim, q, 0, 1)[0]);
  const behind = ring(g.sim, at(-2, 0), 0, 1)[0];
  const n0 = g.log.length;
  g.step(1, { ads: true, adsPressed: true }); g.step(Math.ceil(Q.windup * 60) + 2);
  const L = g.log.slice(n0);
  const dead = front.filter((z) => z.state === 'dead').length;
  check(dead === Q.maxKills && behind.state !== 'dead', `${id}, right click: the sweep smashes ${dead} in front of you (not the one behind)`);
  check(!L.some((e) => ['hammerSlam', 'explosion', 'hammerFreeze', 'windBlast', 'hammerChain'].includes(e.type)) && !g.sim.projectiles.length && !front.some((z) => z.frozen > 0), '...and that\'s all: no element, nothing left behind');
}

// --- the whirlwind stays where it landed and drags zombies in from further out
{
  const g = game(CRUST);
  g.step(30); giveWeapon(g.sim, g.me, 'Wind Hammer+'); g.step(60);
  g.step(1, { fire: true, firePressed: true }); g.step(40);
  const pr = g.sim.projectiles.find((p) => p.type === 'hwind');
  const at = { ...pr.pos };
  g.step(60);
  check(Math.hypot(pr.pos.x - at.x, pr.pos.z - at.z) < 0.01, 'the whirlwind stays where the head came down');
}

// --- no Mad Dog version of a War Hammer: the machine won't take one
{
  const g = game(SCHOOL, 'zombies');
  const md = g.sim.madDog;
  g.sim.power = true; g.me.points = 1e6;
  for (const id of ['Fire Hammer', 'Fire Hammer+', 'War Hammer']) {
    giveWeapon(g.sim, g.me, id); g.step(60);
    const pts = g.me.points;
    const pr = md.prompt(g.sim, g.me);
    md.use(g.sim, g.me, { usePressed: true });
    check(!pr.cost && md.state === 'idle' && g.me.points === pts, `the Mad Dog won't eat the ${id} ("${pr.text}")`);
  }
  const slot = g.me.loadout.slots[g.me.loadout.current];
  check(!slot.aat, 'a tempered War Hammer has no Mad Dog bite');
}

// --- diving into a Maisy Dog's hole: out somewhere else; walking past it: nothing
for (const [name, map] of [['school', SCHOOL], ['the Crust', CRUST]]) {
  for (const dive of [true, false]) {
    const g = game(map, 'zombies');
    g.step(30); g.me.maisyDogs = 1; g.me.pitch = -0.6;
    g.step(1, { tactical: true, tacticalPressed: true }); g.step(200);
    const pr = g.sim.projectiles.find((p) => p.type === 'maisy');
    if (!pr || !pr.hole) { check(false, `${name}: her hole opens`); continue; }
    g.me.yaw = Math.atan2(-(pr.pos.x - g.me.pos.x), -(pr.pos.z - g.me.pos.z));
    if (dive) { g.step(20, { moveY: 1, sprint: true }); g.step(1, { moveY: 1, sprint: true, crouch: true, crouchPressed: true }); g.step(50); }
    else g.step(80, { moveY: 1 });
    const w = g.log.find((e) => e.type === 'maisyWarp');
    if (dive) check(!!w && Math.hypot(w.to.x - w.from.x, w.to.z - w.from.z) > 6 && g.me.invulnUntil > g.sim.time, `${name}: diving into her hole throws you out somewhere else${w ? ` (${Math.hypot(w.to.x - w.from.x, w.to.z - w.from.z).toFixed(0)} m away)` : ''}`);
    else check(!w, `${name}: walking into it doesn't`);
  }
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
