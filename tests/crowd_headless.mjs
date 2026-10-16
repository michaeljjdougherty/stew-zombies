// A crowd of zombies shoving a player who's standing still can't push them into
// the rock and out through the bottom of the map. On the Anvil's floor near
// (-10, 17) the ground meets a rock corner; the crowd used to wedge you in it.
// Run: node tests/crowd_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { makeZombie } from '../src/sim/zombies.js';
import { groundHeight } from '../src/sim/physics.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

let fell = 0;
const runs = 40;
for (let seed = 1; seed <= runs; seed++) {
  const sim = new GameSim({ map: CRUST, seed });
  const me = sim.addPlayer('p1', 'Tester', { character: 'kearns' });
  sim.rounds.timer = 1e9;
  me.health = me.maxHealth = 1e9;
  const L = [sim.world.solids, sim.world.terrain];
  const x0 = -13 + (seed % 8) * 0.9, z0 = 10 + Math.floor(seed / 8) * 1.6;
  me.pos.x = x0; me.pos.z = z0; me.pos.y = groundHeight(x0, z0, 0.3, 60, L);
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, r = 1.2 + (i % 4), x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
    sim.zombies.push(makeZombie(sim, { type: 'walker', pos: { x, y: groundHeight(x, z, 0.3, 60, L), z }, health: 1e9, state: 'chase' }));
  }
  for (let f = 0; f < 60 * 30; f++) {
    sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw });
    sim.step(dt); sim.drainEvents();
    if (me.pos.y < -3) { fell++; console.log(`  seed ${seed}: pushed through at (${me.pos.x.toFixed(2)}, ${me.pos.z.toFixed(2)})`); break; }
  }
}
check(fell === 0, `18 zombies crowd a player standing still on the Anvil's floor for 30 s, ${runs} times: never pushed through the ground (${fell})`);

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
