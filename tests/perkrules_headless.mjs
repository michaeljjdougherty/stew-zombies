// Perk rules: you can only buy 4 perks (GobbleGums get you past it), the first
// GobbleGum each round is free, and lying down in front of a perk machine pays
// the first player who does it, once per machine a game.
// Run: node tests/perkrules_headless.mjs
import { CONFIG } from '../src/config.js';
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { givePerk } from '../src/sim/perks.js';
import { PerkInteractable } from '../src/sim/interactables/machines.js';
import { chewGum, useGum, GumMachineInteractable } from '../src/sim/gums.js';
import { NetHost } from '../src/net/host.js';
import { NetClient } from '../src/net/client.js';
import { LoopbackHub } from '../src/net/transport.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const B = CONFIG.perks.proneBonus;

function game(map = SCHOOL, players = 1) {
  const sim = new GameSim({ map, seed: 5 });
  const me = sim.addPlayer('p1', 'Tester');
  const buddy = players > 1 ? sim.addPlayer('p2', 'Buddy') : null;
  sim.rounds.timer = 1e9;
  sim.power = true;
  const log = [];
  const step = (patch = {}, n = 1, who = me) => {
    for (let i = 0; i < n; i++) {
      for (const p of sim.players) sim.setInput(p.id, { ...emptyCommand(), yaw: p.yaw, pitch: p.pitch, ...(p === who ? patch : {}) });
      sim.step(dt);
      for (const e of sim.drainEvents()) log.push(e);
    }
  };
  me.points = 1e6;
  return { sim, me, buddy, log, step };
}
const perkIts = (sim) => sim.interactables.filter((i) => i instanceof PerkInteractable);

// --- four perks, no more
{
  const { sim, me, step } = game();
  const its = perkIts(sim);
  check(CONFIG.perks.limit === 4 && its.length > 4, `${its.length} perk machines, ${CONFIG.perks.limit} perks a player`);
  for (const it of its.slice(0, 4)) givePerk(sim, me, it.m.perk);
  const fifth = its[4];
  check(/only hold 4/.test(fifth.prompt(sim, me).text), `a 5th machine says: ${fifth.prompt(sim, me).text}`);
  const pts = me.points;
  fifth.use(sim, me, { usePressed: true }); step({}, Math.ceil(CONFIG.perks.drinkTime / dt) + 5);
  check(me.perks.length === 4 && me.points === pts, 'and won\'t sell you one');
  // Unquenchable: one more slot
  chewGum(sim, me, 'unquenchable'); useGum(sim, me);
  check(/Press/.test(fifth.prompt(sim, me).text), 'Unquenchable: the 5th machine sells again');
  fifth.use(sim, me, { usePressed: true }); step({}, Math.ceil(CONFIG.perks.drinkTime / dt) + 5);
  check(me.perks.length === 5, '...and you drink it (5 perks)');
  check(/only hold 5/.test(its[5].prompt(sim, me).text), 'then that\'s the limit again');
  // Perkaholic: every perk, past the limit
  chewGum(sim, me, 'perkaholic'); useGum(sim, me);
  check(me.perks.length === new Set(its.map((i) => i.m.perk)).size, `Perkaholic: every perk on the map (${me.perks.length})`);
}

// --- GobbleGum: the first each round is free
{
  const { sim, me, step } = game();
  const G = CONFIG.gobblegum;
  check(G.costs[0] === 0 && G.costs[1] === 1000 && G.costs[2] === 2000 && G.perRound === 3, `prices: ${G.costs.join(', ')}, ${G.perRound} a round`);
  const m = sim.gums.machines[0];
  const it = sim.interactables.find((i) => i instanceof GumMachineInteractable && i.m === m);
  const at = () => { me.pos.x = m.stand.x; me.pos.z = m.stand.z; me.pos.y = m.pos.y; me.yaw = Math.atan2(-(m.pos.x - me.pos.x), -(m.pos.z - me.pos.z)); };
  at(); step({}, 2);
  check(me.useTarget === it && /free/.test(me.prompt.text) && me.prompt.cost == null, `the prompt: ${me.prompt && me.prompt.text}`);
  me.points = 0;
  step({ use: true, usePressed: true }); step({}, 2);
  check(m.state === 'dispensing' && me.points === 0, 'with no points at all, you still get the first one');
  step({}, Math.ceil(G.dispenseTime / dt)); step({ use: true, usePressed: true }); step({}, 2);
  check(me.gum && m.state === 'idle' && me.gumBuys === 1, `and chew it (${me.gum && me.gum.id})`);
  at(); step({}, 2);
  check(me.prompt.cost === 1000, `the second: ${me.prompt.cost}`);
  step({ use: true, usePressed: true }); step({}, 2);
  check(m.state === 'idle' && me.gumBuys === 1, 'which you can\'t afford with 0 points');
  sim.emit('roundStart', { round: 2 });
  at(); step({}, 2);
  check(me.gumBuys === 0 && me.prompt.cost == null, 'a new round: free again');
}

// --- lie down at a perk machine: 100 points, the first player only, once per machine
for (const map of [SCHOOL, CRUST]) {
  const { sim, me, buddy, log, step } = game(map, 2);
  const m = sim.world.perkMachines[0];
  const put = (p) => { p.pos.x = m.front.x; p.pos.z = m.front.z; p.pos.y = m.center.y; p.vel.x = p.vel.y = p.vel.z = 0; };
  // somewhere else first: nothing
  me.pos.x = m.front.x + m.normal.x * 4; me.pos.z = m.front.z + m.normal.z * 4; me.pos.y = m.center.y;
  step({ crouch: true }, Math.ceil(CONFIG.player.prone.holdTime / dt) + 30);
  check(me.prone && !log.some((e) => e.type === 'proneBonus'), `${map.id}: prone away from a machine: nothing`);
  step({}, 1); step({ jump: true, jumpPressed: true }, 1); step({}, 40);
  // stand there: nothing
  put(me); step({}, 10);
  check(!log.some((e) => e.type === 'proneBonus'), `${map.id}: standing at ${m.perk}: nothing`);
  const pts = me.points;
  put(me); step({ crouch: true }, Math.ceil(CONFIG.player.prone.holdTime / dt) + 30);
  const got = log.filter((e) => e.type === 'proneBonus');
  check(me.prone && got.length === 1 && got[0].playerId === 'p1' && me.points === pts + B.points, `${map.id}: lie down at ${m.perk}: +${me.points - pts}`);
  // again: no
  step({}, 1); step({ jump: true, jumpPressed: true }, 1); step({}, 40);
  put(me); step({ crouch: true }, Math.ceil(CONFIG.player.prone.holdTime / dt) + 30);
  check(log.filter((e) => e.type === 'proneBonus').length === 1, `${map.id}: lying down there again pays nothing`);
  // the buddy there: no (someone was first)
  const bp = buddy.points;
  put(buddy); step({ crouch: true }, Math.ceil(CONFIG.player.prone.holdTime / dt) + 30, buddy);
  check(buddy.prone && buddy.points === bp, `${map.id}: a teammate lying there after gets nothing`);
  // the buddy at another machine: yes
  const m2 = sim.world.perkMachines[1];
  step({}, 1, buddy); step({ jump: true, jumpPressed: true }, 1, buddy); step({}, 40);
  buddy.pos.x = m2.front.x; buddy.pos.z = m2.front.z; buddy.pos.y = m2.center.y; buddy.vel.x = buddy.vel.y = buddy.vel.z = 0;
  step({ crouch: true }, Math.ceil(CONFIG.player.prone.holdTime / dt) + 30, buddy);
  check(buddy.points === bp + B.points, `${map.id}: the teammate at another machine (${m2.perk}) gets theirs`);
}

// --- online: a friend (not the host) lies down at a machine and the host pays them
{
  const hub = new LoopbackHub({ latency: 5, jitter: 3 });
  const mk = () => { const s = new GameSim({ map: SCHOOL, seed: 4 }); s.addPlayer('h', 'Host'); s.addPlayer('a', 'Ann'); s.rounds.timer = 1e9; return s; };
  const hostSim = mk(); hostSim.godMode = true;
  const H = hub.endpoint('H');
  const host = new NetHost(hostSim, (to, m) => H.send(to, m));
  H.onMessage = (from, m) => host.onMessage(from, m);
  const ep = hub.endpoint('A');
  const sim = mk();
  const c = new NetClient(sim, 'a', (m) => ep.send('H', m));
  ep.onMessage = (from, m) => c.onMessage(m);
  hub.connect('H', 'A'); host.addRemote('A', 'a');
  const me = sim.playerById('a'), hp = hostSim.playerById('a');
  const hostEvents = [];
  const step = (secs, cmd = {}) => {
    for (let i = 0; i < Math.round(secs * 60); i++) {
      hub.tick(); host.preStep();
      hostSim.setInput('h', { ...emptyCommand(), yaw: hostSim.playerById('h').yaw });
      hostSim.step(dt); const evs = hostSim.drainEvents(); hostEvents.push(...evs); host.postStep(evs);
      c.tick({ ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...cmd }, dt);
    }
  };
  step(1);
  const m = hostSim.world.perkMachines[2];
  me.pos.x = m.front.x; me.pos.z = m.front.z; me.pos.y = m.center.y; me.vel.x = me.vel.y = me.vel.z = 0;
  step(0.5);
  const pts = me.points;
  step(1, { crouch: true }); step(0.5);
  const got = hostEvents.filter((e) => e.type === 'proneBonus');
  check(got.length === 1 && got[0].playerId === 'a' && hp.points === pts + B.points, `online: Ann lies down at ${m.perk} and the host pays her (+${hp.points - pts})`);
  check(me.points === hp.points, `...and her own screen shows it (${me.points})`);
}

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log('\nall perk rules ok');
