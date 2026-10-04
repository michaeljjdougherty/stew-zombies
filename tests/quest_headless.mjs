// "The Final Whistle" quest headless test (Stew Leonard High).
// Run: node tests/quest_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG } from '../src/config.js';
import { questObjective } from '../src/sim/quest.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

export function makeQuestGame(seed = 11, mode = 'zombies') {
  const sim = new GameSim({ map: SCHOOL, seed, mode });
  const me = sim.addPlayer('p1', 'Tester');
  me.points = 200000;
  sim.rounds.timer = 1e9; // no zombies unless we make them
  for (const d of sim.world.doors) sim.openDoor(d.id);
  const log = [];
  const step = (patch = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: 0, ...patch });
      sim.step(dt);
      for (const e of sim.drainEvents()) log.push(e);
    }
  };
  const place = (x, z, lx, lz) => { me.pos.x = x; me.pos.z = z; me.pos.y = 0; me.vel.x = me.vel.z = 0; me.yaw = Math.atan2(-(lx - x), -(lz - z)); step({}, 2); };
  const use = () => { step({ usePressed: true, use: true }); step({}, 2); };
  const standFor = (it) => it.stand && (it.stand.x !== it.pos.x || it.stand.z !== it.pos.z) ? it.stand : { x: it.pos.x + 0.9, z: it.pos.z + 0.9 };
  const at = (it) => { const s = standFor(it); place(s.x, s.z, it.pos.x, it.pos.z); };
  const find = (kind, id) => sim.interactables.find((i) => i.kind === kind && (!id || i.id === id));
  return { sim, me, log, step, place, use, at, find };
}

{
  const { sim, me, log, step, use, at, find } = makeQuestGame();
  const q = sim.quest;
  check(q && q.step === 'power', 'quest starts at the power step');
  check(!sim.power, 'power starts off');
  check(/breakers/.test(questObjective(sim)), 'objective: ' + questObjective(sim));

  // 1. breakers
  const brs = sim.interactables.filter((i) => i.kind === 'breaker');
  for (const r of brs) check(SCHOOL.rooms.find((x) => x.id === r.b.room), `breaker ${r.b.id} in ${r.b.room}`);
  at(brs[0]); check(/cafeteria|science/.test(me.prompt?.text || ''), 'breaker prompt: ' + me.prompt?.text); use();
  check(q.breakers.length === 1 && !sim.power, 'one breaker: still no power');
  at(brs[0]); check(!/breaker/.test(me.prompt?.text || ''), 'thrown breaker has no prompt');
  at(brs[1]); use();
  check(sim.power && q.step === 'trophy', 'both breakers: power on, trophy step');

  // the Mad Dog Machine isn't there yet
  at(sim.madDog);
  check(!/Mad Dog/.test(me.prompt?.text || ''), 'Mad Dog hidden: ' + me.prompt?.text);

  // 2. trophy pieces
  const stand = find('trophyStand');
  at(stand); check(/pieces/.test(me.prompt?.text || '') || /pieces/.test(me.prompt?.sub || ''), 'stand needs pieces: ' + me.prompt?.text);
  use(); check(!q.trophyPlaced, 'can\'t place an incomplete trophy');
  for (const piece of sim.interactables.filter((i) => i.kind === 'trophyPiece')) {
    const room = SCHOOL.rooms.find((r) => piece.pos.x > r.rect[0] && piece.pos.x < r.rect[2] && piece.pos.z > r.rect[1] && piece.pos.z < r.rect[3]);
    check(room, `trophy ${piece.t.id} is inside ${room?.name}`);
    at(piece); check(/trophy/.test(me.prompt?.text || ''), 'piece prompt: ' + me.prompt?.text); use();
  }
  check(q.pieces.length === 3, 'all three pieces');
  at(stand); use();
  check(q.trophyPlaced, 'trophy placed');
  step({}, Math.round((CONFIG.quest.trophySettle + 1 + CONFIG.quest.madDogRiseTime + 0.5) / dt));
  check(q.madDogRevealed && q.step === 'statue', 'Mad Dog Machine came up; statue step');
  check(log.some((e) => e.type === 'madDogRevealed'), 'madDogRevealed event');
  check(sim.world.solids.some((b) => b.kind === 'madDog'), 'the machine is solid');
  check(Math.abs(q.standPos.x - SCHOOL.quest.trophyStand.slideTo.x) < 0.01, 'trophy stand slid aside');
  at(sim.madDog);
  check(/Mad Dog/.test(me.prompt?.text || ''), 'Mad Dog usable: ' + me.prompt?.text);

  // 3. the statue: kills nearby feed it, kills far away don't
  const S = SCHOOL.quest.statue;
  sim.emit('zombieKilled', { pos: { x: 0, y: 0, z: 0 } });
  check(q.statueSouls === 0, 'kill in the gym doesn\'t count');
  for (let i = 0; i < CONFIG.quest.statueSouls; i++) sim.emit('zombieKilled', { pos: { x: S.x - 5, y: 0, z: S.z + (i % 3) } });
  check(q.statueAwake && q.step === 'coin', 'statue fed and awake');
  step({}, Math.round((CONFIG.quest.coinDropDelay + 0.3) / dt));
  check(q.coin === 'dropped', 'coin dropped');
  const coin = find('coin');
  me.pos.x = coin.pos.x - 0.8; me.pos.z = coin.pos.z; step({}, 2);
  check(/Coin/.test(me.prompt?.text || ''), 'coin prompt: ' + me.prompt?.text);
  use();
  check(q.coin === 'held' && q.coinHolder === 'p1' && q.step === 'altar', 'coin in hand');

  // 4. the altar
  const altar = find('altar');
  me.pos.x = altar.pos.x; me.pos.z = altar.pos.z + 1.2; me.yaw = 0; step({}, 2);
  check(/altar/.test(me.prompt?.text || ''), 'altar prompt: ' + me.prompt?.text);
  use();
  check(q.coin === 'placed' && q.step === 'cladding', 'coin placed, cladding coming up');
  step({}, Math.round((CONFIG.quest.claddingTime + 0.5) / dt));
  check(q.erikRevealed && q.cladding === 1 && q.step === 'ritual', 'Erik revealed, ritual step');
  check(log.some((e) => e.type === 'erikRevealed'), 'erikRevealed event');
  // Erik had things to say along the way
  const said = log.filter((e) => e.type === 'erikSays').map((e) => e.cat);
  check(said.includes('cladding'), 'Erik reacts to the cladding: ' + [...new Set(said)].join(','));
}

// 5. the half-court ritual
{
  const { sim, me, log, step, use, find } = makeQuestGame(12);
  const q = sim.quest;
  q.step = 'ritual'; sim.power = true;
  const balls = sim.interactables.filter((i) => i.kind === 'ritualBall');
  check(balls.length === 4, 'four drained basketballs');
  const go = (b) => { me.pos.x = b.pos.x; me.pos.z = b.pos.z + 1.2; me.yaw = 0; me.vel.x = me.vel.z = 0; step({}, 2); };
  // leave the circle and it goes out
  go(balls[0]); check(/Speed|Jump|Power|Defense/.test(me.prompt?.text || ''), 'ball prompt: ' + me.prompt?.text); use();
  check(q.ritual.active === balls[0].b.id, 'circle lit');
  me.pos.x += 6; step({}, Math.round((CONFIG.quest.ritualLeaveTime + 0.5) / dt));
  check(!q.ritual.active && log.some((e) => e.type === 'ritualFailed'), 'leaving the circle puts it out');
  // hold all four
  sim.godMode = true;
  const baseSpeed = 1;
  for (const b of balls) {
    go(b); use();
    let n = 0;
    while (q.ritual.active && n++ < 60 * 60) { me.pos.x = b.pos.x; me.pos.z = b.pos.z; me.vel.x = me.vel.z = 0; step({}, 1); }
    check(q.ritual.balls.find((x) => x.id === b.b.id).done, `${b.b.stat} restored`);
  }
  check(me.boosts && me.boosts.speed > 1 && me.boosts.jump > 1 && me.boosts.power > 1 && me.boosts.defense < 1, 'solo: all four boosts ' + JSON.stringify(me.boosts));
  check(q.step === 'boss', 'on to the boss');
  check(log.filter((e) => e.type === 'zombieRise').length > 10, 'a horde clawed up during the rituals (' + log.filter((e) => e.type === 'zombieRise').length + ')');
  void baseSpeed; void find;
}

// no quest in the firing range
{
  const { RANGE } = await import('../src/map/range.js');
  const sim = new GameSim({ map: RANGE, seed: 1, mode: 'range' });
  check(!sim.quest, 'no quest in the firing range');
}

console.log(fails ? `\n${fails} FAILED` : '\nall quest checks passed');
process.exit(fails ? 1 : 0);
