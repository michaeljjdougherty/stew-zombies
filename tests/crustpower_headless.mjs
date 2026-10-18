// Call of the Crust's power: everything electric starts dead. The Anvil's four
// launchers have each blown a relay; pull them from the junction boxes beside
// the pads, take them to Pit, and he fixes the Anvil's power (its launchers,
// its perk machine). Every other island has a power switch by its launcher
// pad. Run: node tests/crustpower_headless.mjs
import { CONFIG } from '../src/config.js';
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { islandAt, powerObjective } from '../src/sim/crustPower.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const F = CRUST.forge, PW = CONFIG.crust.power;

function game(seed = 3, mode = 'zombies', n = 1) {
  const sim = new GameSim({ map: CRUST, seed, mode });
  const ps = [];
  for (let i = 0; i < n; i++) ps.push(sim.addPlayer('p' + (i + 1), 'Tester' + (i + 1)));
  const me = ps[0];
  sim.rounds.timer = 1e9;
  for (const p of ps) p.health = p.maxHealth = 1e6;
  const log = [];
  const step = (patch = {}, k = 1) => {
    for (let i = 0; i < k; i++) {
      for (const p of ps) sim.setInput(p.id, { ...emptyCommand(), yaw: p.yaw, pitch: p.pitch, ...(p === me ? patch : {}) });
      sim.step(dt);
      for (const e of sim.drainEvents()) log.push(e);
    }
  };
  // stand at (x, z) on whatever's there at height y, looking at (lx, lz)
  const at = (x, z, y, lx = null, lz = null) => {
    me.pos.x = x; me.pos.z = z; me.pos.y = y + 0.02; me.vel.x = me.vel.y = me.vel.z = 0; me.region = null; me.launch = null;
    if (lx != null) me.yaw = Math.atan2(-(lx - x), -(lz - z));
    step({}, 3);
  };
  const use = () => { step({ use: true, usePressed: true }); step({}, 2); };
  const bench = () => at((F.bench[0] + F.bench[2]) / 2 + 1.6, (F.bench[1] + F.bench[3]) / 2, F.y, F.pit.x, F.pit.z);
  const box = (r) => at(r.x + r.normal.x * 0.9, r.z + r.normal.z * 0.9, r.y, r.x, r.z);
  const pad = (L) => at(L.x, L.z, L.y);
  return { sim, me, ps, log, step, at, use, bench, box, pad };
}
const P = (g) => g.sim.crustEgg.power;
const hubPads = CRUST.launchers.filter((L) => CRUST.relays.some((r) => r.pad === L.id));

// --- the map: a junction box by each of the Anvil's pads, a switch by every other island's
{
  check(CRUST.relays.length === 4 && hubPads.length === 4, 'four junction boxes, one by each of the Anvil\'s launchers');
  const others = CRUST.islands.filter((i) => i.id !== 'hub');
  check(others.every((i) => CRUST.powerSwitches.some((s) => s.island === i.id)) && CRUST.powerSwitches.length === others.length, `a power switch on each other island (${CRUST.powerSwitches.map((s) => s.island).join(', ')})`);
  const g = game();
  const spawnReg = g.sim.nav.regionAt(g.me.pos);
  // (up out of the pit: once the debris on the ramps is cleared)
  const closed = g.sim.nav.canReach(spawnReg, g.sim.nav.regionAt(hubPads[0]));
  for (const d of g.sim.world.doors) g.sim.doorState.get(d.id).open = true;
  g.sim.nav.reach = null;
  for (const s of [...CRUST.relays, ...CRUST.powerSwitches]) {
    const L = CRUST.launchers.find((q) => q.id === s.pad);
    const stand = { x: s.x + s.normal.x * 0.9, y: s.y, z: s.z + s.normal.z * 0.9 };
    const reg = g.sim.nav.regionAt(stand);
    const regL = g.sim.nav.regionAt(L);
    check(!!reg && Math.abs(s.y - L.y) < 0.4 && Math.hypot(s.x - L.x, s.z - L.z) < 6, `${s.id}: by its pad, on the ground you stand on there`);
    check(!!reg && !!regL && g.sim.nav.canReach(regL, reg), `${s.id}: you can walk to it from the pad`);
    if (s.id.startsWith('relay')) check(!!reg && g.sim.nav.canReach(spawnReg, reg), `${s.id}: you can walk up to it from where you start (the debris cleared${closed ? '' : '; not before'})`);
  }
  // one perk machine on each island
  const isl = g.sim.world.perkMachines.map((m) => islandAt(g.sim, m.center));
  check(CRUST.islands.every((i) => isl.includes(i.id)), `a perk machine on every island (${g.sim.world.perkMachines.map((m, i) => `${m.perk}: ${isl[i]}`).join(', ')})`);
}

// --- the start: all dark
{
  const g = game();
  check(Object.values(P(g).on).every((v) => !v), 'everything starts without power');
  const L = hubPads[0];
  g.pad(L);
  check(g.me.prompt && /dead/.test(g.me.prompt.text) && /relay/.test(g.me.prompt.sub || ''), `on an Anvil launcher: "${g.me.prompt && g.me.prompt.text}" (${g.me.prompt && g.me.prompt.sub})`);
  g.use();
  check(!g.me.launch && g.log.some((e) => e.type === 'useDenied'), '...it won\'t fly');
  const kick = g.sim.interactables.find((i) => i.kind === 'perk' && i.m.perk === 'miltonKick');
  g.me.points = 9000;
  g.at(kick.stand.x, kick.stand.z, kick.m.center.y, kick.pos.x, kick.pos.z);
  check(g.me.prompt && /power must be on/.test(g.me.prompt.text), `the Anvil's perk machine: "${g.me.prompt && g.me.prompt.text}"`);
  g.use();
  check(!g.me.perks.includes('miltonKick') && !g.me.drinking, '...and won\'t sell you anything');
  check(/power's out/.test(powerObjective(g.sim, 'p1') || ''), `the objective: "${powerObjective(g.sim, 'p1')}"`);
  // an island launcher home works regardless (nobody's stranded)
  const back = CRUST.launchers.find((q) => q.id === 'pad_ship');
  g.pad(back); g.me.launchReady = 0;
  check(g.me.prompt && /launch to the Anvil/.test(g.me.prompt.text), `an island's launcher home always works: "${g.me.prompt && g.me.prompt.text}"`);
}

// --- the relays: pull them, a fallen one goes back, take them to Pit, he fixes the power
{
  const g = game(4, 'zombies', 2);
  const [r0] = CRUST.relays;
  g.box(r0);
  check(g.me.prompt && /pull the Burnt Relay/.test(g.me.prompt.text), `at a junction box: "${g.me.prompt && g.me.prompt.text}"`);
  g.use();
  check(P(g).relays[r0.id].state === 'carried' && P(g).relays[r0.id].by === 'p1', 'pulled: you carry it');
  check(g.log.some((e) => e.type === 'relayPulled'), '...sparks');
  check(/Take the burnt relay to Pit/.test(powerObjective(g.sim, 'p1') || ''), `the objective: "${powerObjective(g.sim, 'p1')}"`);
  // you die with it: back in its box, still burnt
  g.me.alive = false; g.step({}, 2);
  check(P(g).relays[r0.id].state === 'blown' && g.log.some((e) => e.type === 'relayReturned'), 'your carrier dies: it\'s back in its box');
  g.me.alive = true; g.me.health = 1e6;
  // pull all four (two at a time is fine)
  for (const r of CRUST.relays) { g.box(r); g.use(); }
  check(Object.values(P(g).relays).every((r) => r.state === 'carried' && r.by === 'p1'), 'all four pulled (you can carry them all)');
  g.box(CRUST.relays[1]);
  check(g.me.prompt && /You have this launcher's relay/.test(g.me.prompt.text), `at an emptied box: "${g.me.prompt && g.me.prompt.text}"`);
  const L = hubPads[0];
  g.pad(L);
  check(g.me.prompt && /dead/.test(g.me.prompt.text) && /Pit/.test(g.me.prompt.sub || ''), `its launcher: "${g.me.prompt && g.me.prompt.text}" (${g.me.prompt && g.me.prompt.sub})`);
  g.bench();
  check(g.me.prompt && /give Pit the burnt relays/.test(g.me.prompt.text), `at Pit's bench: "${g.me.prompt && g.me.prompt.text}"`);
  g.use();
  check(Object.values(P(g).relays).every((r) => r.state === 'given'), 'handed over');
  g.step({}, 3);
  const F2 = g.sim.crustEgg.forge;
  check(F2.work && F2.work.kind === 'power', 'Pit gets to work on them');
  check(g.me.prompt && /fixing the relays/.test(g.me.prompt.text), `his bench: "${g.me.prompt && g.me.prompt.text}"`);
  check(!P(g).on.hub, '...not on yet');
  g.step({}, 60 * (PW.fixTime + 1));
  check(P(g).on.hub && Object.values(P(g).relays).every((r) => r.state === 'fixed'), `after ${PW.fixTime} s the Anvil has power`);
  check(g.log.some((e) => e.type === 'islandPower' && e.island === 'hub'), '...and everyone hears it');
  check(g.log.some((e) => e.type === 'forgeStrike' && e.element === 'lightning'), '(sparks fly off his anvil while he works)');
  check(!P(g).on.ship && !P(g).on.caves, 'the other islands still dark');
  g.pad(L); g.me.launchReady = 0;
  check(g.me.prompt && /Press \[F\] to launch/.test(g.me.prompt.text), `the launcher: "${g.me.prompt && g.me.prompt.text}"`);
  g.use();
  check(!!g.me.launch, '...flies');
  g.step({}, 60 * (CONFIG.crust.launch.time + 1));
  const kick = g.sim.interactables.find((i) => i.kind === 'perk' && i.m.perk === 'miltonKick');
  g.me.points = 9000; g.me.launchReady = 0;
  g.at(kick.stand.x, kick.stand.z, kick.m.center.y, kick.pos.x, kick.pos.z);
  check(g.me.prompt && /buy Milton Kick/.test(g.me.prompt.text), `the Anvil's perk machine: "${g.me.prompt && g.me.prompt.text}"`);
  check(powerObjective(g.sim, 'p1') === null, 'on the Anvil, powered: no power objective');
}

// --- three in, one carried by somebody else; Pit busy when the last comes in: he finishes first
{
  const g = game(5);
  for (const r of CRUST.relays) { g.box(r); g.use(); }
  const F2 = g.sim.crustEgg.forge;
  g.sim.crustEgg.cores.trench = { state: 'given', element: 'fire' };
  F2.work = { kind: 'forge', id: 'trench', element: 'fire', t: 0, strikes: 0 };
  g.bench(); g.use();
  check(!F2.work || F2.work.kind === 'forge', 'Pit\'s busy: the relays wait');
  check(P(g).fixQueued, '...he\'ll get to them');
  g.step({}, 60 * (CONFIG.crust.forge.forgeTime + 1));
  check(F2.work && F2.work.kind === 'power', 'then he starts on them');
  g.step({}, 60 * (PW.fixTime + 1));
  check(P(g).on.hub, '...and the power\'s on');
}

// --- the islands: land, flip the switch, its perk machine runs
{
  const g = game(6);
  P(g).on.hub = true;
  for (const s of CRUST.powerSwitches) {
    const L = CRUST.launchers.find((q) => q.id === s.pad);
    g.pad(L);
    check(/Turn on the power/.test(powerObjective(g.sim, 'p1') || ''), `${s.name}: landed, the objective says "${powerObjective(g.sim, 'p1')}"`);
    const machine = g.sim.interactables.find((i) => i.kind === 'perk' && islandAt(g.sim, i.m.center) === s.island);
    if (machine) {
      g.me.points = 9000;
      g.at(machine.stand.x, machine.stand.z, machine.m.center.y, machine.pos.x, machine.pos.z);
      check(g.me.prompt && /power must be on/.test(g.me.prompt.text) && /switch/.test(g.me.prompt.sub || ''), `${s.name}: its ${machine.m.perk} machine: "${g.me.prompt && g.me.prompt.text}" (${g.me.prompt && g.me.prompt.sub})`);
    }
    g.at(s.x + s.normal.x * 0.9, s.z + s.normal.z * 0.9, s.y, s.x, s.z);
    check(g.me.prompt && /turn on the power/.test(g.me.prompt.text), `${s.name}: at the switch: "${g.me.prompt && g.me.prompt.text}"`);
    g.use();
    check(P(g).on[s.island] && g.log.some((e) => e.type === 'islandPower' && e.island === s.island), `${s.name}: flipped, the power's on`);
    g.step({}, 2);
    check(!g.me.prompt || !/turn on the power/.test(g.me.prompt.text), `${s.name}: the switch is done with`);
    if (machine) {
      g.at(machine.stand.x, machine.stand.z, machine.m.center.y, machine.pos.x, machine.pos.z);
      check(g.me.prompt && /Press \[F\] to buy/.test(g.me.prompt.text), `${s.name}: its machine runs: "${g.me.prompt && g.me.prompt.text}"`);
    }
  }
  check(Object.values(P(g).on).every(Boolean), 'every island lit');
}

// --- Second Helping (the Quick Revive) in the pit where you start: it needs no power
{
  const g = game(5);
  const qr = g.sim.interactables.find((i) => i.kind === 'perk' && i.m.perk === 'secondHelping');
  check(qr && islandAt(g.sim, qr.m.center) === 'hub' && qr.m.zone === 'pit', `Second Helping in the pit (${qr && qr.m.zone})`);
  const sp = CRUST.playerSpawns[0];
  check(qr && Math.hypot(qr.m.center.x - sp.x, qr.m.center.z - sp.z) < 10, '...a few steps from where you start');
  check(!P(g).on.hub, '(the Anvil\'s power is still out)');
  g.me.points = 9000;
  g.at(qr.stand.x, qr.stand.z, qr.m.center.y, qr.pos.x, qr.pos.z);
  check(g.me.prompt && /buy Second Helping/.test(g.me.prompt.text), `with the power still out: "${g.me.prompt && g.me.prompt.text}"`);
  g.use(); g.step({}, 200);
  check(g.me.perks.includes('secondHelping'), '...and it sells you one');
}

// --- exploring: everything's on from the start
{
  const g = game(7, 'explore');
  check(Object.values(P(g).on).every(Boolean) && Object.values(P(g).relays).every((r) => r.state === 'fixed'), 'explore mode: all the power\'s on');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
