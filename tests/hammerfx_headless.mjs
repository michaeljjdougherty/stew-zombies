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
for (const [id, type, r] of [['Fire Hammer+', 'hfire', 2.5], ['Ice Hammer+', 'hice', 2.5], ['Wind Hammer+', 'hwind', 4.5], ['Lightning Hammer+', 'hbolt', 4]]) {
  const g = game(CRUST);
  g.step(30); giveWeapon(g.sim, g.me, id); g.step(60);
  g.step(1, { fire: true, firePressed: true }); g.step(30);
  const pr = g.sim.projectiles.find((p) => p.type === type);
  check(!!pr, `${id}: leaves its ${type} behind`);
  if (!pr) continue;
  const zs = ring(g.sim, pr.pos, r);
  g.step(4 * 60);
  const dead = zs.filter((z) => z.state === 'dead').length;
  check(dead === zs.length, `${id}: it kills what comes into it, high round or not (${dead}/${zs.length} in 4 s)`);
}

// --- the whirlwind stays where it landed and drags zombies in from further out
{
  const g = game(CRUST);
  g.step(30); giveWeapon(g.sim, g.me, 'Wind Hammer+'); g.step(60);
  g.step(1, { fire: true, firePressed: true }); g.step(30);
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
