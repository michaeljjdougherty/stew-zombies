// Shooting Pit at his bench on the Crust (src/sim/pitShot.js): he isn't hurt,
// he has words, and fewer of them the nicer you are.
// Run: node tests/pitshot_headless.mjs
import { powerAllOn } from '../src/sim/crustPower.js';
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { pitShot, pitHitAt } from '../src/sim/pitShot.js';
import { lookDir } from '../src/core/math.js';
import { PIT_SHOT } from '../src/lore/crew.js';
import { CONFIG } from '../src/config.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const PIT = CRUST.forge.pit;
const ALL = new Set(Object.values(PIT_SHOT).flat());

const sim = new GameSim({ map: CRUST, seed: 5 });
powerAllOn(sim);
const me = sim.addPlayer('p1', 'Tester', { character: 'kearns' });
sim.rounds.timer = 1e9;
me.health = me.maxHealth = 1e6;
const said = [];
const step = (patch = {}, n = 1) => {
  for (let i = 0; i < n; i++) {
    sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch });
    sim.step(dt);
    for (const e of sim.drainEvents()) if (e.type === 'crewSays' && e.who === 'pit' && ALL.has(e.text)) said.push(e.text);
  }
};
step({}, 30);
const pitLines = () => said.length;

// stand a few metres off him and aim at his chest
me.pos.x = PIT.x + 4; me.pos.z = PIT.z + 0.4; me.pos.y = PIT.y; me.vel.x = me.vel.y = me.vel.z = 0;
step({}, 2);
const eye = sim.eyePosition(me);
const dx = PIT.x - eye.x, dy = PIT.y + 1.1 - eye.y, dz = PIT.z - eye.z;
me.yaw = Math.atan2(-dx, -dz);
for (const s of [1, -1]) { me.pitch = s * Math.atan2(dy, Math.hypot(dx, dz)); if (pitHitAt(sim, eye, lookDir(me.yaw, me.pitch), 50) >= 0) break; }
check(pitHitAt(sim, eye, lookDir(me.yaw, me.pitch), 50) >= 0, 'aimed at his chest: the bullet would hit Pit');
check(pitHitAt(sim, eye, lookDir(me.yaw + 0.6, me.pitch), 50) < 0, 'aimed well wide: it misses him');

// a real shot from a real gun
step({ fire: true, firePressed: true }); step({}, 240);
check(pitLines() === 1 && PIT_SHOT.first.includes(said[0]), `shoot Pit: he says something ("${said[0]}")`);

// spraying him: one line per gap, never a pile-up, and he gets crankier
const before = pitLines();
for (let i = 0; i < 60; i++) { step({ fire: true, firePressed: true }); step({}, 5); }
const n = pitLines() - before;
check(n >= 1 && n <= Math.ceil(60 * 6 * dt / CONFIG.pitShot.gap) + 1, `holding the trigger on him: ${n} lines, not one a bullet`);
for (let i = 0; i < 12; i++) { sim.time += CONFIG.pitShot.gap + 1; pitShot(sim, me, eye, lookDir(me.yaw, me.pitch)); step({}, 400); }
check(said.some((t) => PIT_SHOT.lots.includes(t)), 'keep at it and he gets properly fed up');
check(me.alive && sim.crustEgg.forge, 'nobody got hurt (Pit can\'t be)');

// leave him alone a while and he's over it
step({}, 900);   // (let him finish what he's saying)
sim.time += CONFIG.pitShot.forgive + 5;
const k = said.length;
pitShot(sim, me, eye, lookDir(me.yaw, me.pitch)); step({}, 900);
check(PIT_SHOT.first.includes(said[said.length - 1]), 'a long while later: back to the first kind of line');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
