// The crew talking: walkie-talkie conversations, reactions, Erik's roasts.
// Run: node tests/crew_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { TALKS, REACT, ERIK_ROASTS, CREW } from '../src/lore/crew.js';
import { readFileSync } from 'node:fs';
const CHAR_SRC = readFileSync(new URL('../src/render/characters.js', import.meta.url), 'utf8');

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

function game(character, seed = 5) {
  const sim = new GameSim({ map: SCHOOL, seed });
  const me = sim.addPlayer('p1', 'T', { character });
  sim.godMode = true;
  const log = [];
  const step = (n = 1) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw }); sim.step(dt); for (const e of sim.drainEvents()) log.push(e); } };
  return { sim, me, log, step };
}

// the launch four are playable; Brian unlocks with the quest
check(['Kearns', 'Ryan', 'Pit', 'Rocco'].every((n) => new RegExp(`name: '${n}', playable: true`).test(CHAR_SRC)), 'Kearns, Ryan, Pit and Rocco are playable');
check(/name: 'Brian', unlock: 'quest'/.test(CHAR_SRC), 'Brian unlocks by finishing The Final Whistle');
for (const id of ['kearns', 'ryan', 'pit', 'rocco', 'brian']) check(CREW[id] && Object.keys(REACT).every((k) => REACT[k][id] && REACT[k][id].length), `${id} has reactions for everything`);

// the intro: Erik, then the radio check, Pit's back
for (const ch of ['kearns', 'rocco', 'pit']) {
  const { sim, log, step } = game(ch);
  step(60 * 110);
  const crew = log.filter((e) => e.type === 'crewSays');
  const intro = crew.filter((e) => TALKS.intro.some((l) => l.text === e.text));
  check(intro.length >= 8, `${ch}: the intro conversation plays (${intro.length} lines)`);
  check(intro.filter((e) => e.who === ch).every((e) => !e.radio) && intro.filter((e) => e.who !== ch).every((e) => e.radio), `${ch}: you talk live, the others are on the radio`);
  const firstErik = log.findIndex((e) => e.type === 'erikSays');
  const firstCrew = log.findIndex((e) => e.type === 'crewSays');
  check(firstErik >= 0 && firstErik < firstCrew, `${ch}: Erik welcomes them before the radio check`);
  check(!crew.some((e) => e.who === 'brian'), `${ch}: Brian isn't on the walkies`);
  void sim;
}
// playing Brian he gets his own lines
{
  const { log, step } = game('brian');
  step(60 * 110);
  check(log.some((e) => e.type === 'crewSays' && e.who === 'brian' && !e.radio), 'playing Brian, he joins the radio check');
}

// reactions and replies
{
  const { sim, me, log, step } = game('rocco', 9);
  step(60 * 110);
  const n0 = log.length;
  let got = 0;
  for (let i = 0; i < 12; i++) { sim.emit('playerDown', { playerId: me.id }); step(60 * 12); }
  const after = log.slice(n0).filter((e) => e.type === 'crewSays');
  got = after.filter((e) => e.who === 'rocco' && REACT.down.rocco.includes(e.text)).length;
  check(got >= 3, `Rocco reacts when he goes down (${got})`);
  check(after.some((e) => e.radio && e.who !== 'rocco'), 'someone answers on the walkie');
}

// Erik roasts whoever you play
{
  let roasts = 0;
  for (let s = 0; s < 6; s++) {
    const { sim, log, step } = game('kearns', 100 + s);
    step(60 * 100);
    for (let r = 2; r < 14; r++) { sim.emit('roundStart', { round: r }); step(60 * 15); sim.emit('roundEnd', { round: r }); step(60 * 10); }
    roasts += log.filter((e) => e.type === 'erikSays' && ERIK_ROASTS.kearns.includes(e.text)).length;
  }
  check(roasts >= 1, `Erik roasts Kearns (${roasts} over 6 games)`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall crew checks passed');
process.exit(fails ? 1 : 0);
