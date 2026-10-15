// The War Hammers are heavy: a swing winds up before it lands, slows you while
// you swing, and the next one has to wait for the hammer to come back round.
// Run: node tests/hammerswing_headless.mjs
import { CONFIG } from '../src/config.js';
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { giveWeapon } from '../src/sim/weapons.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60, S = CONFIG.crust.hammers.swing;
const sim = new GameSim({ map: CRUST, seed: 3, mode: 'explore' });
const me = sim.addPlayer('p1', 'T', { character: 'kearns' });
const log = [];
const step = (n, c = {}) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...c }); sim.step(dt); log.push(...sim.drainEvents().map((e) => ({ ...e, at: sim.time }))); } };
step(30);
giveWeapon(sim, me, 'Fire Hammer'); step(60);
const slams = () => log.filter((e) => e.type === 'hammerSlam').length;

// the wind-up: nothing smashed at the click, it lands windup s later
const t0 = sim.time;
step(1, { fire: true, firePressed: true });
check(slams() === 0, 'the click: it goes up over your shoulder, nothing smashed yet');
step(Math.ceil(S.windup * 60) + 1);
const s1 = log.find((e) => e.type === 'hammerSlam');
check(!!s1 && Math.abs(s1.at - t0 - S.windup) < 0.05, `...it comes down ${s1 ? (s1.at - t0).toFixed(2) : '?'} s later`);

// straight away again: still coming back round
step(1, { fire: true, firePressed: true }); step(40);
check(slams() === 1, 'clicking again right away: nothing (the hammer\'s still coming back round)');
const gap = 60 / CONFIG.weapons['Fire Hammer'].rpm;
step(Math.ceil(gap * 60));
step(1, { fire: true, firePressed: true }); step(Math.ceil(S.windup * 60) + 2);
check(slams() === 2, `after ${gap.toFixed(1)} s it swings again`);

// heavy: slower carrying it, slower still mid-swing
const speedOver = (secs, c) => { const x0 = me.pos.x, z0 = me.pos.z; step(Math.round(secs * 60), c); return Math.hypot(me.pos.x - x0, me.pos.z - z0) / secs; };
step(Math.ceil(gap * 60));
const walk = speedOver(0.6, { moveY: 1 });
step(1, { moveY: 1, fire: true, firePressed: true });
const swinging = speedOver(0.5, { moveY: 1 });
check(swinging < walk * (S.slowMult + 0.15), `mid-swing you're slowed (${swinging.toFixed(2)} vs ${walk.toFixed(2)} m/s)`);
giveWeapon(sim, me, 'M1912'); step(60);
const pistol = speedOver(0.6, { moveY: 1 });
check(walk < pistol * 0.9, `carrying it you're slower than with a pistol (${walk.toFixed(2)} vs ${pistol.toFixed(2)} m/s)`);

// put it away mid-swing: it never lands
giveWeapon(sim, me, 'Ice Hammer'); step(Math.ceil(gap * 60) + 60);
const n = slams();
step(1, { fire: true, firePressed: true }); step(3, { weaponCycle: 1 }); step(60);
check(slams() === n, 'switching away mid-swing: it never lands');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
