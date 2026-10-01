// Overhaul headless test: Explore mode.
// Run: node tests/overhaul_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

{
  const sim = new GameSim({ map: SCHOOL, seed: 4, mode: 'explore' });
  const me = sim.addPlayer('p1', 'T');
  const log = [];
  const step = (patch = {}, n = 1) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, ...patch }); sim.step(dt); log.push(...sim.drainEvents()); } };
  check(me.points >= 999999, 'explore starts with endless points');
  step({}, 60 * 20);
  check(sim.rounds.round === 0 && sim.zombies.length === 0, 'no zombies until you ask for them');
  const before = me.points;
  sim.spendPoints(me, 5000);
  check(me.points === before, 'buying things costs nothing');
  sim.openDoor('door_hall', me);
  check(sim.doorOpen('door_hall'), 'doors still open when bought');
  sim.setExploreZombies(true);
  step({}, 60 * 25);
  check(sim.rounds.round >= 1 && sim.zombies.length > 0, `zombies on: round ${sim.rounds.round}, ${sim.zombies.length} zombies`);
  sim.damagePlayer(me, 10000, { pos: { x: me.pos.x + 1, z: me.pos.z } });
  check(me.alive && !me.downed && !sim.gameOver, "you can't die");
  sim.setExploreZombies(false);
  step({}, 2);
  check(sim.zombies.length === 0, 'zombies off clears them');
  step({}, 60 * 20);
  check(sim.zombies.length === 0, '...and no more come');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
