// Explore mode: skipping to any part of the Easter egg, and to any round.
// Run: node tests/explore_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { QUEST_SKIPS, questSkipTo, questObjective } from '../src/sim/quest.js';
import { exploreJumpToRound } from '../src/sim/rounds.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const make = () => {
  const sim = new GameSim({ map: SCHOOL, seed: 3, mode: 'explore' });
  const me = sim.addPlayer('p1', 'Tester');
  const step = (n = 1) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw }); sim.step(1 / 60); sim.drainEvents(); } };
  return { sim, me, step };
};

const order = ['power', 'trophy', 'statue', 'coin', 'altar', 'cladding', 'ritual', 'chopper', 'infused', 'boss'];
for (const s of QUEST_SKIPS) {
  const { sim, me, step } = make();
  check(questSkipTo(sim, s.id, me), `skip to ${s.id}`);
  step(60);
  const q = sim.quest;
  const at = (k) => order.indexOf(q.step) >= order.indexOf(k);
  const okStep = q.step === s.step;
  const okState = (!at('trophy') || sim.power)
    && (!at('statue') || q.madDogRevealed)
    && (!at('coin') || q.coin !== 'none')
    && (!at('ritual') || q.erikRevealed)
    && (!at('chopper') || q.ritual.balls.every((b) => b.done))
    && (s.id !== 'schnitz' || (q.chopper.built && !q.chopper.holder))
    && (!at('infused') || (q.schnitz && q.schnitz.done && me.loadout.slots.some((x) => x.id.startsWith('The Chopper'))))
    && (!at('boss') || (q.chopper.upgraded && me.loadout.slots.some((x) => x.id === 'The Chopper+')))
    && (s.id !== 'blast' || (q.boss && q.boss.phase === 3));
  check(okStep && okState, `  at ${q.step}: ${questObjective(sim)}`);
}

// lifting the Chopper from the "Schnitz" skip still brings the dark
{
  const { sim, me, step } = make();
  questSkipTo(sim, 'schnitz', me);
  step(10);
  const t = SCHOOL.quest.chopperTable;
  me.pos.x = t.x - 1.2; me.pos.z = t.z; me.yaw = Math.PI / 2;
  sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, use: true, usePressed: true }); sim.step(1 / 60);
  step(2);
  check(sim.quest.darkUntil > sim.time, 'taking it from the bench: The Schnitz');
}

// jump to a round
{
  const { sim, step } = make();
  exploreJumpToRound(sim, 15);
  step(60 * 3);
  check(sim.rounds.round === 15 && sim.explore.zombies && sim.rounds.phase === 'active', 'round 15 (' + sim.rounds.round + ', ' + sim.rounds.phase + ')');
  step(60 * 6);
  check(sim.zombies.length > 0, 'zombies coming (' + sim.zombies.length + ')');
  exploreJumpToRound(sim, 3);
  step(60 * 3);
  check(sim.rounds.round === 3, 'back to round 3');
}

console.log(fails ? `\n${fails} FAILED` : '\nall explore checks passed');
process.exit(fails ? 1 : 0);
