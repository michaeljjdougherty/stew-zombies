// The boiler room cauldron: shoot the three valves, the stew boils over.
// Run: node tests/cauldron_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { giveWeapon } from '../src/sim/weapons.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const sim = new GameSim({ map: SCHOOL, seed: 5 });
const me = sim.addPlayer('p1', 'T');
me.maxHealth = me.health = 1e6;
sim.rounds.phase = 'test';
giveWeapon(sim, me, 'M15');
const step = (n, patch = {}) => { const ev = []; for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch }); sim.step(dt); ev.push(...sim.drainEvents()); } return ev; };
check(sim.cauldron && Object.keys(sim.cauldron.valves).length === 3, 'three valves');
check(sim.world.solids.some((b) => b.kind === 'cauldron'), 'the cauldron is solid');
const C = SCHOOL.cauldron;
const spots = { valve1: [-22.0, 4.2], valve2: [-23.6, 10.0], valve3: [-19.5, 3.0] };
const pts0 = me.points;
const all = [];
for (const v of C.valves) {
  const [x, z] = spots[v.id];
  me.pos.x = x; me.pos.z = z; me.pos.y = 0;
  const eye = { x, y: 1.62, z };
  const dx = v.x - eye.x, dy = v.y - eye.y, dz = v.z - eye.z;
  me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  me.loadout.slots[me.loadout.current].mag = 30;
  step(30, { ads: true });
  for (let k = 0; k < 6 && !sim.cauldron.valves[v.id]; k++) { all.push(...step(1, { ads: true, fire: true, firePressed: true })); all.push(...step(20, { ads: true })); }
  check(sim.cauldron.valves[v.id], `${v.id} shot open`);
}
check(all.filter((e) => e.type === 'valveTurned').length === 3, 'three valveTurned events');
check(sim.cauldron.boiled && all.some((e) => e.type === 'cauldronBoil'), 'boiled over');
check(me.points - pts0 >= sim.cfg.cauldron.points, `points awarded (+${me.points - pts0})`);
check(sim.powerups.drops.some((d) => d.type === sim.cfg.cauldron.powerup), 'power-up dropped');
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
