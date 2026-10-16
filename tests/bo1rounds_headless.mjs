// Black Ops 1 round scaling: zombie counts, health, walker/runner/sprinter mix,
// spawn pacing and the 24-at-once cap.
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG, zombieCountForRound, zombieHealthForRound } from '../src/config.js';
import { pickZombieType } from '../src/sim/zombies.js';

let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failed++; };

// counts (BO1's round_spawning; solo, 2 and 4 players)
const counts = (p, rs) => rs.map((r) => zombieCountForRound(r, p, CONFIG.rounds));
const R = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30];
check(counts(1, R).join() === '6,8,13,18,24,27,28,28,29,33,60,105', `solo counts (${counts(1, R).join(', ')})`);
check(counts(2, R).join() === '7,9,15,21,27,31,32,33,34,42,96,186', `2-player counts (${counts(2, R).join(', ')})`);
check(counts(4, [1, 10, 30]).join() === '10,78,510', `4-player counts (${counts(4, [1, 10, 30]).join(', ')})`);

// health: +100 a round to 9, then +10% (rounded down)
const hp = [1, 2, 9, 10, 11, 20].map((r) => zombieHealthForRound(r, CONFIG.zombie));
check(hp.join() === '150,250,950,1045,1149,2701', `health (${hp.join(', ')})`);

// walker / runner / sprinter mix
const sim = new GameSim({ map: SCHOOL, seed: 4 });
const mix = (round) => {
  const n = { walker: 0, runner: 0, sprinter: 0 };
  for (let i = 0; i < 2000; i++) n[pickZombieType(sim, round)]++;
  return n;
};
const m1 = mix(1), m2 = mix(2), m5 = mix(5), m9 = mix(9);
check(m1.walker === 2000, 'round 1: everyone walks');
check(m2.runner > 600 && m2.runner < 1000 && m2.sprinter === 0, `round 2: about 4 in 10 run (${m2.runner}/2000)`);
check(m5.sprinter > 0 && m5.sprinter < 400 && m5.walker === 0, `round 5: the first sprinters (${m5.sprinter}/2000)`);
check(m9.sprinter === 2000, 'round 9 on: everyone sprints');
check(CONFIG.zombie.sprintSpeed[1] < CONFIG.player.walkSpeed, 'a sprinter is a touch slower than you walking');

// spawn pacing and the cap
const s = new GameSim({ map: SCHOOL, seed: 7 });
const me = s.addPlayer('p1', 'Tester');
me.health = me.maxHealth = 1e9;
s.rounds.round = 29; s.rounds.timer = 0;
let peak = 0;
for (let i = 0; i < 60 * 90; i++) {
  me.health = me.maxHealth;
  s.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch });
  s.step(1 / 60); s.drainEvents();
  peak = Math.max(peak, s.zombies.length);
}
check(s.rounds.round === 30 && Math.abs(s.rounds.spawnInterval - 2 * Math.pow(0.95, 29)) < 1e-6, `round 30 spawns every ${s.rounds.spawnInterval.toFixed(2)} s`);
check(peak === 24, `never more than 24 at once (peak ${peak})`);

console.log(failed ? `\n${failed} FAILED` : '\nall BO1 round checks passed');
process.exit(failed ? 1 : 0);
