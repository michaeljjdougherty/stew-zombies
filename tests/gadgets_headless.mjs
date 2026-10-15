// The Maisy Dog (a black hole that swallows zombies) and the LBD (a sleeping
// baby that pops up and goes off when zombies come near).
// Run: node tests/gadgets_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { makeZombie } from '../src/sim/zombies.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

function game(map = SCHOOL, seed = 3) {
  const sim = new GameSim({ map, seed });
  const me = sim.addPlayer('p1', 'Tester');
  sim.rounds.timer = 1e9;
  const log = [];
  const step = (patch = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch });
      sim.step(dt);
      for (const e of sim.drainEvents()) log.push(e);
    }
  };
  me.pos.x = 9; me.pos.z = 10; me.pos.y = 0; me.yaw = 0; me.pitch = -0.3;
  me.points = 100000;
  return { sim, me, log, step };
}
const addZ = (g, x, z, hp = 5000) => { const zz = makeZombie(g.sim, { pos: { x, y: 0, z }, health: hp, state: 'chase' }); zz.speed = 0.01; zz.region = g.sim.nav.regionAt(zz.pos); g.sim.zombies.push(zz); return zz; };

// --- the Maisy Dog
{
  const g = game();
  g.me.maisyDogs = 3;
  g.step({ tactical: true, tacticalPressed: true }, 1);
  check(g.me.throwing && g.me.throwing.kind === 'maisy', '[Q] with Maisy Dogs: one in your hand');
  g.step({}, 40);
  check(g.me.maisyDogs === 2 && g.log.some((e) => e.type === 'projectileSpawn' && e.ptype === 'maisy'), 'thrown');
  let t = 0;
  while (!g.log.some((e) => e.type === 'maisyLand') && t < 300) { g.step(); t++; }
  const land = g.log.find((e) => e.type === 'maisyLand');
  check(!!land, `she lands (${land && land.pos.x.toFixed(1)}, ${land && land.pos.z.toFixed(1)})`);
  const P = land.pos;
  const near = [[3, 0], [-4, 1], [0, 5], [6, -2], [-2, -7]].map(([dx, dz]) => addZ(g, P.x + dx, P.z + dz));
  const far = addZ(g, P.x + 16, P.z);
  g.step({}, 90);
  check(g.log.some((e) => e.type === 'maisyOpen'), 'a black hole opens over her');
  const before = Math.hypot(near[3].pos.x - P.x, near[3].pos.z - P.z);
  g.step({}, 60 * 6);
  const dead = near.filter((z) => z.state === 'dead').length;
  check(dead >= 4, `zombies round her dragged in and swallowed (${dead} of 5; one was ${before.toFixed(1)} m out)`);
  const kills = g.log.filter((e) => e.type === 'zombieKilled' && e.kind === 'vortex');
  check(kills.length === dead && kills.every((e) => e.vortex), 'they go into the hole (a vortex death)');
  check(far.state !== 'dead', 'one 16 m away is left alone');
  g.step({}, 60 * 2);
  check(g.log.some((e) => e.type === 'maisyClose') && !g.sim.projectiles.some((p) => p.type === 'maisy'), 'then the hole closes and takes her');
  check(g.me.alive && g.me.health === g.me.maxHealth, 'it never touches you');
}

// --- the LBD
{
  const g = game();
  g.me.lbds = 2;
  g.step({ minePressed: true }, 1);
  check(g.me.lbds === 1 && g.log.some((e) => e.type === 'lbdPlant'), '[X]: an LBD set down in front of you');
  g.step({}, 90);
  const lb = g.sim.projectiles.find((p) => p.type === 'lbd');
  check(lb && lb.resting && lb.armed, `it's on the floor and live (${lb && lb.pos.y.toFixed(2)} m)`);
  g.me.pos.z += 6;   // (step back)
  const z = addZ(g, lb.pos.x + 4, lb.pos.z, 3000);
  g.step({}, 30);
  check(z.state !== 'dead' && !g.log.some((e) => e.type === 'lbdPop'), 'a zombie 4 m off: nothing');
  z.pos.x = lb.pos.x + 1.5;
  g.step({}, 2);
  check(g.log.some((e) => e.type === 'lbdPop'), 'one walks up to it: it wakes and pops up');
  g.step({}, 40);
  check(z.state === 'dead' && g.log.some((e) => e.type === 'explosion' && e.etype === 'lbd'), 'and goes off');
  check(g.me.health === g.me.maxHealth, 'it never hurts you');
  g.me.lbds = 0;
  g.sim.rounds.timer = 0;
}

// --- buying them
for (const [name, map] of [['the school', SCHOOL], ['the Crust', CRUST]]) {
  const g = game(map);
  const wb = g.sim.interactables.find((i) => i.kind === 'wallbuy' && i.wb.weapon === 'lbd');
  check(!!wb, `an LBD wall buy at ${name}`);
  if (!wb) continue;
  check(/LBDs/.test(wb.prompt(g.sim, g.me).text) && wb.prompt(g.sim, g.me).cost === 1000, `"${wb.prompt(g.sim, g.me).text}" for 1000`);
  wb.use(g.sim, g.me, { usePressed: true });
  check(g.me.lbds === 2 && g.me.lbdMax === 2, 'you carry two');
  check(wb.prompt(g.sim, g.me).cost === null, 'full: nothing more to buy');
  g.me.lbds = 0;
  g.sim.rounds.state = 'between'; g.sim.rounds.timer = 0;
  for (let i = 0; i < 400 && g.sim.rounds.round < 2; i++) g.step();
  check(g.me.lbds === 2, `next round: two again (round ${g.sim.rounds.round})`);
}

// --- from the box: Maisy Dogs or Stew Bombs, never both
{
  const g = game();
  const box = g.sim.interactables.find((i) => i.kind === 'box' || (i.constructor && i.constructor.name === 'BoxInteractable'));
  check(!!box, 'a Mystery Box');
  if (box) {
    g.me.stewBombs = 3;
    box.phase = 'offering'; box.buyerId = g.me.id; box.weapon = 'maisyDog';
    box.use(g.sim, g.me, { usePressed: true });
    check(g.me.maisyDogs === 3 && g.me.stewBombs === 0, 'taking Maisy Dogs swaps out your Stew Bombs');
    box.phase = 'offering'; box.buyerId = g.me.id; box.weapon = 'stewBomb';
    box.use(g.sim, g.me, { usePressed: true });
    check(g.me.stewBombs === 3 && g.me.maisyDogs === 0, 'and the other way round');
  }
}

console.log(fails ? `\n${fails} gadget check(s) FAILED` : '\nall gadget checks passed');
process.exit(fails ? 1 : 0);
