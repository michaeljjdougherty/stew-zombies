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
  // Erik had things to say along the way (the crew's walkie chatter goes first)
  step({}, 60 * 40);
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
  step({}, 2);
  check(log.some((e) => e.type === 'zombieRise') && !sim.zombies.some((z) => z.ritual) && log.some((e) => e.type === 'zombieBanished'), 'and its blue spirits fade away (' + log.filter((e) => e.type === 'zombieBanished').length + ')');
  // hold all four
  sim.godMode = true;
  const baseSpeed = 1;
  for (const b of balls) {
    go(b); use();
    let n = 0;
    while (q.ritual.active && n++ < 60 * 60) { me.pos.x = b.pos.x; me.pos.z = b.pos.z; me.vel.x = me.vel.z = 0; step({}, 1); }
    check(q.ritual.balls.find((x) => x.id === b.b.id).done, `${b.b.stat} restored`);
    step({}, 2);
    check(!sim.zombies.some((z) => z.ritual), `${b.b.stat}: the blue spirits fade when the circle fills`);
  }
  check(me.boosts && me.boosts.speed > 1 && me.boosts.jump > 1 && me.boosts.power > 1 && me.boosts.defense < 1, 'solo: all four boosts ' + JSON.stringify(me.boosts));
  check(q.step === 'chopper', 'on to building the Chopper');
  check(log.filter((e) => e.type === 'zombieRise').length > 10, 'a horde clawed up during the rituals (' + log.filter((e) => e.type === 'zombieRise').length + ')');
  void baseSpeed; void find;
}

// 5. building the Chopper
{
  const { sim, me, log, step, place, use, find } = makeQuestGame(12);
  const q = sim.quest;
  const parts = sim.interactables.filter((i) => i.kind === 'chopperPart');
  const table = find('chopperTable');
  check(parts.length === 4 && table, 'four Chopper parts and a workbench');
  // not before the ritual's done
  q.step = 'ritual';
  place(parts[0].pos.x + 0.9, parts[0].pos.z, parts[0].pos.x, parts[0].pos.z);
  check(!parts[0].canUse(sim, me), 'parts can\'t be taken before the circles are done');
  q.step = 'chopper';
  check(/Chopper/.test(questObjective(sim)), 'objective: ' + questObjective(sim));
  // the workbench with nothing on it
  const tb = SCHOOL.quest.chopperTable;
  place(tb.x - 1.2, tb.z, tb.x, tb.z);
  check(me.prompt && /workbench/i.test(me.prompt.text), 'empty workbench: ' + (me.prompt && me.prompt.text) + ' / ' + (me.prompt && me.prompt.sub));
  use();
  check(!q.chopper.built, 'can\'t build without the parts');
  for (const it of parts) {
    // stand next to it, wherever it's reachable from
    let ok = false;
    for (const [dx, dz] of [[0, 1.1], [0, -1.1], [1.1, 0], [-1.1, 0]]) {
      place(it.pos.x + dx, it.pos.z + dz, it.pos.x, it.pos.z);
      if (Math.hypot(me.pos.x - (it.pos.x + dx), me.pos.z - (it.pos.z + dz)) < 0.2 && me.prompt && /take the/.test(me.prompt.text)) { ok = true; break; }
    }
    check(ok, `can reach the ${it.c.name} (${it.c.where}): ` + (me.prompt && me.prompt.text));
    use();
  }
  check(q.chopper.parts.length === 4, 'all four parts found (' + q.chopper.parts.join(', ') + ')');
  check(log.filter((e) => e.type === 'chopperPart').length === 4, 'four chopperPart events');
  place(tb.x - 1.2, tb.z, tb.x, tb.z);
  check(/build the Chopper/.test(me.prompt && me.prompt.text), 'workbench: ' + (me.prompt && me.prompt.text));
  use();
  check(q.chopper.built && q.step === 'chopper', 'built (still needs the Mad Dog)');
  check(me.loadout.slots.some((s) => s.id === 'The Chopper') && q.chopper.holder === 'p1', 'the builder has the Chopper');
  check(/refill/.test(me.prompt && me.prompt.text), 'then the bench refills it: ' + (me.prompt && me.prompt.text));
  // lifting it: the dark, The Schnitz, and nothing can hurt you
  check(log.some((e) => e.type === 'schnitzVisit') && q.darkUntil > sim.time, 'the lights go down: The Schnitz');
  const { makeZombie, killZombie } = await import('../src/sim/zombies.js');
  const lurker = makeZombie(sim, { type: 'sprinter', pos: { x: me.pos.x - 1.0, y: 0, z: me.pos.z }, yaw: Math.PI / 2, health: 1e6, state: 'chase' });
  sim.zombies.push(lurker);
  me.health = me.maxHealth;
  step({}, 60 * 4);
  check(me.health === me.maxHealth, 'nothing attacks you in the dark');
  killZombie(sim, lurker, { kind: 'bullet' });
  step({}, 60 * (CONFIG.quest.schnitz.duration - 3));
  const said = log.filter((e) => e.type === 'schnitzSays');
  check(said.length === 3 && /powerless against The Schnitz/.test(said[0].text), 'The Schnitz speaks (' + said.length + ' lines)');
  check(q.step === 'infused' && q.darkUntil <= sim.time, 'the lights come back: on to the infused');
  check(!log.some((e) => e.type === 'erikSays' && e.t > q.schnitz.at && e.t < q.darkUntil), 'Erik keeps quiet while The Schnitz talks');
  // the infused: twice as tall, slower, 2.5x the health, clawing up near you
  step({}, 60 * 8);
  const inf = sim.zombies.filter((z) => z.infused);
  check(inf.length > 0, 'infused zombies rise (' + inf.length + ')');
  if (inf.length) {
    const z0 = inf[0], hp = (await import('../src/config.js')).zombieHealthForRound(Math.max(1, sim.rounds.round), CONFIG.zombie);
    check(z0.scale > 1.8 && Math.abs(z0.maxHealth / hp - 2.5) < 0.01 && z0.speed < CONFIG.zombie.walkSpeed[1], `scale ${z0.scale.toFixed(2)}, health x${(z0.maxHealth / hp).toFixed(2)}, speed ${z0.speed.toFixed(2)}`);
  }
  check(/infused zombies \(0\/50\)/.test(questObjective(sim)), 'objective: ' + questObjective(sim));
  // kill fifty of them
  let guard = 0;
  while (q.infused.kills < CONFIG.quest.infused.kills && guard++ < 60 * 600) {
    step({}, 1);
    for (const z of [...sim.zombies]) if (z.infused && z.state === 'chase') killZombie(sim, z, { kind: 'bullet', part: 'torso', playerId: 'p1' });
  }
  check(q.infused.kills === 50, 'fifty infused down (' + q.infused.kills + ')');
  step({}, 2);
  check(log.some((e) => e.type === 'schnitzSays' && e.shock && /How did you do that/.test(e.text)), 'The Schnitz reacts to the fiftieth');
  check(!sim.zombies.some((z) => z.infused && z.state !== 'dead'), 'the leftover infused fade away');
  step({}, 60 * 20);
  check(!sim.zombies.some((z) => z.infused && z.state !== 'dead'), 'and no more infused spawn after the fifty');
  check(q.step === 'infused' && /Mad Dog/.test(questObjective(sim)), 'still needs the Mad Dog: ' + questObjective(sim));
  // there's only the one
  const p2 = sim.addPlayer('p2', 'Two');
  p2.pos.x = tb.x - 1.2; p2.pos.z = tb.z; p2.yaw = Math.PI / 2;
  sim.setInput('p2', { ...emptyCommand(), usePressed: true, use: true }); step({}, 1);
  sim.setInput('p2', emptyCommand());
  check(!p2.loadout.slots.some((s) => s.id.startsWith('The Chopper')), 'a teammate can\'t take a second one');
  // the box can still give one out
  const box = sim.box;
  let pulled = false;
  for (let i = 0; i < 400; i++) if (box.pick(sim, p2) === 'The Chopper') pulled = true;
  check(pulled, 'the Mystery Box can still give a Chopper');
  // lose it and it goes back on the bench
  const ci = me.loadout.slots.findIndex((s) => s.id === 'The Chopper');
  me.loadout.slots[ci].id = 'M15'; me.loadout.current = 0;
  step({}, 2);
  check(q.chopper.holder === null && log.some((e) => e.type === 'chopperReturned'), 'swap it away: it goes back on the bench');
  sim.setInput('p2', { ...emptyCommand(), usePressed: true, use: true }); step({}, 1);
  check(p2.loadout.slots.some((s) => s.id === 'The Chopper') && q.chopper.holder === 'p2', 'then a teammate can take it');
  // through the Mad Dog Machine: on to the showdown
  const s2 = p2.loadout.slots.find((s) => s.id === 'The Chopper');
  s2.id = 'The Chopper+';
  sim.emit('madDogTaken', { playerId: 'p2', weapon: 'The Chopper+' });
  step({}, 1);
  check(q.chopper.upgraded && q.step === 'boss', 'the Mad Dog\'d Chopper: on to the showdown');
}

// 6. the Intercom Showdown
{
  const { sim, me, log, step, use, find } = makeQuestGame(13);
  const { killZombie } = await import('../src/sim/zombies.js');
  const { inZone } = await import('../src/sim/quest.js');
  const q = sim.quest;
  q.step = 'boss'; sim.power = true;
  const altar = find('altar');
  me.pos.x = 0; me.pos.z = 1.3; me.yaw = 0; step({}, 2);
  check(/call Erik out/.test(me.prompt?.text || ''), 'altar starts the showdown: ' + me.prompt?.text);
  use();
  check(q.boss && q.boss.phase === 1, 'phase 1');
  const B = CONFIG.quest.boss;
  // playbook zones hurt
  let hurt = false;
  me.health = me.maxHealth;
  for (let i = 0; i < 60 * 12 && !hurt; i++) {
    step({}, 1);
    const live = q.boss.zones.find((z) => sim.time - z.born > z.warn);
    if (live) { me.pos.x = live.shape === 'O' ? live.x : (live.segs[0][0] + live.segs[0][2]) / 2; me.pos.z = live.shape === 'O' ? live.z : (live.segs[0][1] + live.segs[0][3]) / 2; check(inZone(live, me.pos.x, me.pos.z), 'standing in a play'); step({}, 20); hurt = me.health < me.maxHealth; }
  }
  check(hurt, 'Erik\'s playbook burns');
  sim.godMode = true;
  // clear the waves
  let guard = 0;
  const kinds = { spirit: 0, infused: 0, plain: 0 };
  while (q.boss.phase === 1 && guard++ < 60 * 120) {
    step({}, 1);
    for (const z of sim.zombies) if (z.state === 'rising' && !z.counted) { z.counted = true; kinds[z.ritual ? 'spirit' : z.infused ? 'infused' : 'plain']++; }
    for (const z of [...sim.zombies]) if (z.state !== 'rising' && z.state !== 'dead') killZombie(sim, z, { kind: 'bullet', part: 'torso', dir: { x: 0, y: 0, z: 1 }, playerId: 'p1' });
  }
  check(q.boss.phase === 2, 'waves cleared: phase 2 (' + log.filter((e) => e.type === 'bossWave').length + ' waves)');
  check(log.some((e) => e.type === 'zombieSpawn' && e.defender), 'defenders spawned');
  {
    const ids = new Set(log.filter((e) => e.type === 'zombieSpawn').map((e) => e.id));
    const spawned = log.filter((e) => e.type === 'zombieSpawn');
    check(spawned.some((e) => e.infused), 'the fight brings The Schnitz\'s giants (' + spawned.filter((e) => e.infused).length + ')');
    check(kinds.spirit > 0 && kinds.infused > 0 && kinds.plain > 0, 'all three kinds in the fight: ' + JSON.stringify(kinds));
  }
  // elites drop amps; plug them into the towers
  guard = 0;
  while (q.boss.phase === 2 && guard++ < 60 * 200) {
    step({}, 1);
    for (const z of [...sim.zombies]) if (z.state !== 'rising' && z.state !== 'dead') killZombie(sim, z, { kind: 'bullet', part: 'torso', dir: { x: 0, y: 0, z: 1 }, playerId: 'p1' });
    const amp = q.boss.amps.find((a) => a.state === 'ground');
    if (amp) {
      me.pos.x = amp.x; me.pos.z = amp.z; step({}, 1); use();
      const ti = q.boss.towers.findIndex((t) => !t);
      const tw = SCHOOL.quest.towers[ti];
      me.pos.x = tw.x + (tw.x > 0 ? -1.2 : 1.2); me.pos.z = tw.z; step({}, 2); use();
    }
  }
  check(q.boss.phase === 3 && q.boss.towers.every(Boolean), 'four towers powered: phase 3');
  check(log.filter((e) => e.type === 'ampDrop').length >= 4, 'elites dropped amplifiers');
  // phase 3: blast the Press Box with the Chopper
  const { giveWeapon } = await import('../src/sim/weapons.js');
  giveWeapon(sim, me, 'The Chopper');
  const blastOnce = () => { step({ fire: true, firePressed: true, yaw: me.yaw, pitch: me.pitch }, 1); step({ yaw: me.yaw, pitch: me.pitch }, 60); };
  const P = SCHOOL.quest.pressBox;
  const aim = (x, z) => {
    me.pos.x = x; me.pos.z = z; me.vel.x = me.vel.z = 0;
    const d = { x: P.x - x, y: P.y - 1.6, z: P.z - z }; const l = Math.hypot(d.x, d.y, d.z);
    me.yaw = Math.atan2(-d.x / l, -d.z / l); me.pitch = Math.asin(d.y / l);
  };
  // from the locker room it doesn't count (there's a wall in the way)
  aim(-21, -6);
  step({ fire: true, firePressed: true, yaw: me.yaw, pitch: me.pitch }, 1); step({ yaw: me.yaw, pitch: me.pitch }, 60);
  check(q.boss.blasts === 0, 'no blast through the wall');
  // looking away doesn't count either
  aim(0, 7); me.yaw += Math.PI;
  step({ fire: true, firePressed: true, yaw: me.yaw, pitch: me.pitch }, 1); step({ yaw: me.yaw, pitch: me.pitch }, 60);
  check(q.boss.blasts === 0, 'no blast facing away');
  aim(0, 7);
  blastOnce();
  check(q.boss.blasts === 0 && log.some((e) => e.type === 'pressBoxShrug'), 'the plain Chopper just rattles the glass');
  giveWeapon(sim, me, 'The Chopper+');
  aim(0, 7);
  for (let i = 0; i < 12 && !q.boss.over; i++) {
    const s = me.loadout.slots[me.loadout.current];
    if (s.clip === 0) { step({ reload: true, reloadPressed: true, yaw: me.yaw, pitch: me.pitch }, 1); step({ yaw: me.yaw, pitch: me.pitch }, 200); }
    step({ fire: true, firePressed: true, yaw: me.yaw, pitch: me.pitch }, 1); step({ yaw: me.yaw, pitch: me.pitch }, 60);
  }
  check(log.filter((e) => e.type === 'pressBoxBlast').length === CONFIG.quest.boss.chopperHits, 'each Chopper blast cracks the booth (' + log.filter((e) => e.type === 'pressBoxBlast').length + ')');
  check(q.boss.over && q.step === 'ending', 'Erik is blasted out: the ending (' + q.boss.blasts + ' blasts)');
  check(log.some((e) => e.type === 'bossEnd'), 'bossEnd event');
}

// no quest in the firing range
{
  const { RANGE } = await import('../src/map/range.js');
  const sim = new GameSim({ map: RANGE, seed: 1, mode: 'range' });
  check(!sim.quest, 'no quest in the firing range');
}

console.log(fails ? `\n${fails} FAILED` : '\nall quest checks passed');
process.exit(fails ? 1 : 0);
