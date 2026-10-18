// Call of the Crust's Mad Dog Machine: in the Anvil's pit, in view from the
// start, working once the Anvil's power is on. Same price and alternate ammo as
// the school's (5000; 2500 for a new bite). Zombies walk round it.
// Run: node tests/crustmaddog_headless.mjs
import { CONFIG } from '../src/config.js';
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { giveWeapon } from '../src/sim/weapons.js';
import { makeZombie } from '../src/sim/zombies.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

function game(seed = 3) {
  const sim = new GameSim({ map: CRUST, seed });
  const me = sim.addPlayer('p1', 'Tester');
  sim.rounds.timer = 1e9; me.health = me.maxHealth = 1e6;
  const log = [];
  const step = (patch = {}, k = 1) => { for (let i = 0; i < k; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch }); sim.step(dt); log.push(...sim.drainEvents()); } };
  const M = sim.madDog;
  const atMachine = () => {
    me.pos.x = M.stand.x; me.pos.z = M.stand.z; me.pos.y = M.md.y + 0.02; me.vel.x = me.vel.y = me.vel.z = 0; me.region = null;
    me.yaw = Math.atan2(-(M.md.x - me.pos.x), -(M.md.z - me.pos.z)); me.pitch = -0.15;
    step({}, 3);
  };
  const use = () => { step({ use: true, usePressed: true }); step({}, 2); };
  return { sim, me, log, step, M, atMachine, use };
}

{
  const g = game();
  const { sim, me, M } = g;
  check(!!M && !M.md.hidden && M.md.room === 'pit', `a Mad Dog Machine in the Anvil's pit, not hidden (${M && M.md.x.toFixed(1)}, ${M && M.md.z.toFixed(1)})`);
  const F = CRUST.forge, d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  check(d(M.md, F.anvil) > 9 && d(M.md, F.stand) > 4 && d(M.md, F.zach) > 8 && d(M.md, { x: (F.bench[0] + F.bench[2]) / 2, z: (F.bench[1] + F.bench[3]) / 2 }) > 12, 'clear of the Anvil, the hammer stand, Pit\'s bench and where Zach lands');
  check(CRUST.playerSpawns.every((p) => d(p, M.md) > 4) && CRUST.groundSpawns.every((s) => d(s, M.md) > 3), 'nobody starts or comes up on top of it');

  giveWeapon(sim, me, 'M15'); g.step({}, 40);
  me.points = 20000;
  g.atMachine();
  check(me.prompt && /needs power/.test(me.prompt.text), `before the Anvil's power: "${me.prompt && me.prompt.text}"`);
  g.use();
  check(M.state === 'idle' && me.points === 20000, '...it won\'t take your gun');

  sim.crustEgg.power.on.hub = true;
  g.atMachine();
  check(me.prompt && /feed .* to the Mad Dog/.test(me.prompt.text) && me.prompt.cost === CONFIG.madDog.cost, `powered: "${me.prompt && me.prompt.text}" (${me.prompt && me.prompt.cost})`);
  g.use();
  check(M.state === 'working' && me.points === 20000 - CONFIG.madDog.cost, `it chews on the M15 for ${CONFIG.madDog.cost}`);
  g.step({}, Math.ceil(CONFIG.madDog.workTime / dt) + 5);
  g.atMachine(); g.use();
  const s = me.loadout.slots.find((q) => q.id === 'M15+');
  check(!!s && !!s.aat, `you take the ${CONFIG.weapons['M15+'].name}, with ${s && s.aat}`);
  me.loadout.current = me.loadout.slots.indexOf(s);
  g.atMachine();
  check(me.prompt && /new bite/.test(me.prompt.text) && me.prompt.cost === CONFIG.aat.rerollCost, `again: "${me.prompt && me.prompt.text}" (${me.prompt && me.prompt.cost})`);

  giveWeapon(sim, me, 'War Hammer'); g.step({}, 40);
  g.atMachine();
  check(me.prompt && /won't eat a War Hammer/.test(me.prompt.text), `a War Hammer: "${me.prompt && me.prompt.text}"`);
}

// --- zombies on the pit floor get round it to you
{
  let stuck = 0, tot = 0;
  // [zombie from], [you at]: either side of it, between it and the wreck, by the Olympus
  for (const [[zx, zz], [px, pz]] of [[[2, 13], [8, 13]], [[9.5, 7], [3.5, 13.6]], [[1, 11], [8, 12]], [[8, 13.2], [2, 7]], [[3.5, 14.6], [8, 11]]]) {
    const g = game(4);
    const { sim, me } = g;
    sim.godMode = true;
    me.pos.x = px; me.pos.z = pz; me.pos.y = 0.05;
    const z = makeZombie(sim, { type: 'walker', pos: { x: zx, y: 0.05, z: zz }, health: 1e9, state: 'chase' });
    sim.zombies.push(z);
    let reached = false;
    for (let f = 0; f < 60 * 20 && !reached; f++) { g.step(); reached = Math.hypot(z.pos.x - me.pos.x, z.pos.z - me.pos.z) < 1.3; }
    tot++;
    if (!reached) { stuck++; console.log(`  a zombie from (${zx}, ${zz}) stuck at (${z.pos.x.toFixed(1)}, ${z.pos.z.toFixed(1)}); you at (${me.pos.x.toFixed(1)}, ${me.pos.y.toFixed(1)}, ${me.pos.z.toFixed(1)})`); }
  }
  check(!stuck, `zombies get round the machine to you (${tot - stuck} of ${tot})`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
