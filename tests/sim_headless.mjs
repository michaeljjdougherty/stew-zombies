// Headless simulation test: a simple bot plays the game with no renderer.
// Run: node tests/sim_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';

const sim = new GameSim({ map: SCHOOL, seed: 1234 });
const me = sim.addPlayer('p1', 'Tester');
const counts = {};
let lastRound = 0;
const dt = 1 / 60;
let fireToggle = false;
for (let i = 0; i < 60 * 60 * 6; i++) {
  const cmd = emptyCommand();
  // aim at nearest zombie that is inside
  let target = null, bd = Infinity;
  for (const z of sim.zombies) {
    const d = Math.hypot(z.pos.x - me.pos.x, z.pos.z - me.pos.z);
    if (d < bd) { bd = d; target = z; }
  }
  if (target) {
    const eye = sim.eyePosition(me);
    const dx = target.pos.x - eye.x, dz = target.pos.z - eye.z, dy = target.pos.y + 1.55 - eye.y;
    cmd.yaw = Math.atan2(-dx, -dz);
    cmd.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    fireToggle = !fireToggle;
    cmd.firePressed = fireToggle; cmd.fire = fireToggle;
    if (bd < 1.6) cmd.meleePressed = true;
    if (bd < 3) cmd.moveY = -1;
  }
  sim.setInput('p1', cmd);
  sim.step(dt);
  for (const e of sim.drainEvents()) {
    counts[e.type] = (counts[e.type] || 0) + 1;
    if (e.type === 'roundStart') { console.log(`t=${sim.time.toFixed(1)} round ${e.round} zombies=${e.zombies} hp=${e.health} points=${me.points} health=${me.health.toFixed(0)} ammo=${me.loadout.slots[0].clip}/${me.loadout.slots[0].reserve}`); lastRound = e.round; }
    if (e.type === 'gameOver') console.log('GAME OVER at round', e.round, 't=', sim.time.toFixed(1));
  }
  if (sim.gameOver) break;
  // refill ammo so the bot can keep testing
  if (me.loadout.slots[0].reserve < 10) me.loadout.slots[0].reserve = 80;
}
console.log(counts);
console.log('player', me.pos, 'kills', me.kills, 'headshots', me.headshots, 'knife', me.knifeKills);
const bad = sim.zombies.filter(z => !isFinite(z.pos.x) || !isFinite(z.pos.z));
if (bad.length) { console.error('NaN zombie positions'); process.exit(1); }
console.log('windows', sim.windows.map(w => w.boards).join(','), 'zombies alive', sim.zombies.length, sim.zombies.map(z=>z.state).join(','));
