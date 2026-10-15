// Milton Kick: a third weapon slot (lost when you go down).
// Run: node tests/miltonkick_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { givePerk, weaponLimit } from '../src/sim/perks.js';
import { giveWeapon } from '../src/sim/weapons.js';
import { revive } from '../src/sim/laststand.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

function game(map = SCHOOL, players = 1) {
  const sim = new GameSim({ map, seed: 4 });
  const me = sim.addPlayer('p1', 'Tester');
  if (players > 1) sim.addPlayer('p2', 'Buddy');
  sim.rounds.timer = 1e9;
  const log = [];
  const step = (patch = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch });
      sim.step(dt);
      for (const e of sim.drainEvents()) log.push(e);
    }
  };
  me.pos.x = 9; me.pos.z = 10; me.pos.y = 0;
  return { sim, me, log, step };
}
const ids = (p) => p.loadout.slots.map((s) => s.id);

// --- without it: two guns, the third replaces the one in your hands
{
  const g = game();
  const start = ids(g.me)[0];
  giveWeapon(g.sim, g.me, 'MP41'); giveWeapon(g.sim, g.me, 'Galill');
  check(ids(g.me).length === 2 && ids(g.me).includes('Galill') && ids(g.me).includes(start) && !ids(g.me).includes('MP41'), `no perk: two guns (${ids(g.me).join(', ')})`);
}

// --- with it: three
{
  const g = game();
  givePerk(g.sim, g.me, 'miltonKick');
  check(weaponLimit(g.sim, g.me) === 3, 'Milton Kick: three slots');
  giveWeapon(g.sim, g.me, 'MP41'); giveWeapon(g.sim, g.me, 'Galill');
  check(ids(g.me).length === 3 && ids(g.me)[2] === 'Galill', `three guns (${ids(g.me).join(', ')})`);
  giveWeapon(g.sim, g.me, 'M60');
  check(ids(g.me).length === 3 && ids(g.me)[2] === 'M60', `a fourth replaces the one in your hands (${ids(g.me).join(', ')})`);
  // cycling and the 3 key
  g.step({}, 90);
  g.step({ weaponCycle: true }); g.step({}, 2);
  check(g.me.loadout.current === 0, 'cycle wraps round all three');
  g.step({ weaponSlot: 2 }); g.step({}, 2);
  check(g.me.loadout.current === 2, 'the 3 key picks the third');
  check(g.sim.cfg.input.keys.weapon3[0] === 'Digit3', '...bound to 3');
}

// --- going down: perk gone, and the third gun with it when you're picked up
{
  const g = game(SCHOOL, 2);
  givePerk(g.sim, g.me, 'miltonKick');
  giveWeapon(g.sim, g.me, 'MP41'); giveWeapon(g.sim, g.me, 'Galill');
  const firstTwo = ids(g.me).slice(0, 2);
  g.step({}, 10);
  g.sim.damagePlayer(g.me, 1e4, null);
  check(!!g.me.downed && !g.me.perks.includes('miltonKick'), 'down: Milton Kick is gone');
  revive(g.sim, g.me, 'p2'); g.step({}, 1);
  check(ids(g.me).length === 2 && ids(g.me).join() === firstTwo.join(), `picked up: the third gun is lost (${ids(g.me).join(', ')})`);
  check(g.log.some((e) => e.type === 'weaponDropped' && e.weapon === 'Galill'), '...it was the Galill');
  check(g.me.loadout.current < 2, 'and you\'re holding one you still have');
}

// --- the machines
{
  check(SCHOOL.perkMachines.some((m) => m.perk === 'miltonKick'), 'a Milton Kick machine at the school');
  for (const [map, where] of [[SCHOOL, 'school library'], [CRUST, 'Anvil depot']]) {
    const g = game(map);
    const it = g.sim.interactables.find((i) => i.kind === 'perk' && i.m.perk === 'miltonKick');
    check(!!it, `${where}: a machine`);
    if (!it) continue;
    g.sim.power = true;
    if (g.sim.crustEgg) g.sim.crustEgg.power.on.hub = true;   // (the Anvil's own power: crustpower_headless.mjs)
    g.me.pos.x = it.stand.x; g.me.pos.z = it.stand.z; g.me.pos.y = it.m.center.y + 0.05; g.me.points = 5000;
    g.me.yaw = Math.atan2(-(it.pos.x - it.stand.x), -(it.pos.z - it.stand.z));
    g.step({}, 30);
    check(g.me.prompt && /Milton Kick/.test(g.me.prompt.text), `${where}: "${g.me.prompt && g.me.prompt.text}"`);
    g.step({ use: true, usePressed: true }); g.step({}, 160);
    check(g.me.perks.includes('miltonKick') && g.me.points === 1000, `${where}: drunk for 4000`);
  }
  // the Anvil depot's west gap is clear again
  const g = game(CRUST);
  const blocks = g.sim.world.perkMachines.filter((m) => m.room === 'depot' && m.box.minX < 17.6 && m.box.maxZ > -23.5 && m.box.minZ < -21.5);
  check(blocks.length === 0, 'nothing stands in the depot\'s west gap');
}

// --- no two perk machines side by side (each in its own room, well apart)
for (const map of [SCHOOL, CRUST]) {
  const M = new GameSim({ map, seed: 1 }).world.perkMachines;
  let min = Infinity;
  for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) min = Math.min(min, Math.hypot(M[i].center.x - M[j].center.x, M[i].center.z - M[j].center.z));
  check(new Set(M.map((m) => m.room)).size === M.length && min > 12, `${map.name}: perk machines spread out (closest ${min.toFixed(1)} m apart, one per room)`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall Milton Kick checks passed');
process.exit(fails ? 1 : 0);
