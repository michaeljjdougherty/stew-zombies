// The second wave of guns: the Scavenger, the Fucci Gun Mk 2, the Desert
// Eagle, the Peacekeeper, the SCAR-H, the M60 and the L96A1.
// Run: node tests/newguns_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG, zombieHealthForRound } from '../src/config.js';
import { makeZombie } from '../src/sim/zombies.js';
import { giveWeapon } from '../src/sim/weapons.js';
import { REAL_GUNS } from '../src/render/gunModels.js';
import { GUN_VOICES } from '../src/audio/gunSamples.js';
import fs from 'node:fs';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const NEW = ['Scavenger', 'Fucci Gun Mk 2', 'Desert Eagle', 'Peacekeeper', 'SCAR-H', 'M60', 'L97A1'];

function game(seed = 3) {
  const sim = new GameSim({ map: SCHOOL, seed });
  const me = sim.addPlayer('p1', 'Tester');
  sim.rounds.timer = 1e9;
  me.health = me.maxHealth = 250;
  const log = [];
  const step = (patch = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch });
      sim.step(dt);
      for (const e of sim.drainEvents()) log.push(e);
    }
  };
  // stand in the gym, facing -z
  me.pos.x = 9; me.pos.z = 8; me.pos.y = 0; me.yaw = 0; me.pitch = 0;
  return { sim, me, log, step };
}
const addZ = (sim, x, z, hp) => { const zz = makeZombie(sim, { pos: { x: x + 9, z }, health: hp, state: 'chase' }); zz.speed = 0; sim.zombies.push(zz); return zz; };
const equip = (g, id) => { giveWeapon(g.sim, g.me, id); g.step({}, 70); g.step({ ads: true }, 40); };

// --- every one is set up: a model file, stats, an upgrade, its own sound
for (const id of NEW) {
  const d = CONFIG.weapons[id], u = CONFIG.weapons[id + '+'];
  const R = REAL_GUNS[d.view.model];
  check(!!R && fs.existsSync(`assets/guns/${R.file}.glb`), `${d.name}: its model (${R && R.file}.glb)`);
  check(!!u && u.name !== d.name && !!u.view.camo && (u.damage > d.damage || u.magSize > d.magSize || (u.projectile && u.projectile.impactDamage > d.projectile.impactDamage)), `${d.name}: Mad Dog'd into ${u && u.name} (${u && u.view.camo})`);
  check(!!GUN_VOICES[id] || d.sound.kind === 'beam', `${d.name}: its own shot`);
}
check(CONFIG.weapons.Peacekeeper.cost > 0 && SCHOOL.wallBuys.some((w) => w.weapon === 'Peacekeeper'), 'the Peacekeeper is on the wall');
check(['Scavenger', 'Fucci Gun Mk 2', 'Desert Eagle', 'SCAR-H', 'M60', 'L97A1'].every((id) => CONFIG.weapons[id].boxOnly && CONFIG.box.weights[id] > 0), 'the rest come out of the box');
check(CONFIG.weapons['Scavenger+'].thermal && !CONFIG.weapons.Scavenger.thermal, 'only the upgraded Scavenger has the thermal scope');

// --- the Scavenger: the bolt sticks, glows, then a big blast a second later
{
  const g = game(5);
  equip(g, 'Scavenger');
  const zs = [addZ(g.sim, 0, -2, 2000), addZ(g.sim, 1.5, -2.5, 2000), addZ(g.sim, -1.5, -2.5, 2000), addZ(g.sim, 0.5, -4, 2000)];
  g.step({ ads: true, fire: true, firePressed: true }, 1); g.step({ ads: true }, 20);
  const stuck = g.log.find((e) => e.type === 'projectileStick' && e.ptype === 'scav');
  check(!!stuck, 'the bolt sticks in what it hits');
  check(!g.log.some((e) => e.type === 'explosion'), '...and waits');
  g.step({ ads: true }, 70);
  const boom = g.log.find((e) => e.type === 'explosion' && e.etype === 'scav');
  check(!!boom, 'then goes off');
  check(zs.every((z) => z.state === 'dead'), `the blast kills the whole group (${zs.filter((z) => z.state === 'dead').length} of ${zs.length})`);
  check(CONFIG.weapons.Scavenger.magSize === 2 && CONFIG.weapons.Scavenger.action === 'bolt', 'bolt action, two in the magazine');
  // too close: it hurts you
  const g2 = game(6);
  equip(g2, 'Scavenger');
  addZ(g2.sim, 0, 6.6, 2000);
  const h0 = g2.me.health;
  g2.step({ ads: true, fire: true, firePressed: true }, 1); g2.step({}, 90);
  check(g2.me.health < h0, `a bolt at your feet hurts you (${Math.round(h0 - g2.me.health)})`);
}

// --- the Fucci Gun Mk 2: a 3-round burst of beams; one hit kills early on
{
  const g = game(7);
  g.sim.rounds.round = 8;
  equip(g, 'Fucci Gun Mk 2');
  const hp = zombieHealthForRound(8);
  const zs = [addZ(g.sim, 0, -4, hp), addZ(g.sim, 0, -9, hp), addZ(g.sim, 0, -14, hp)];
  g.step({ ads: true, fire: true, firePressed: true }, 1); g.step({ ads: true }, 40);
  const spawned = g.log.filter((e) => e.type === 'projectileSpawn' && e.ptype === 'beam').length;
  check(spawned === 3, `one pull, three beams (${spawned})`);
  check(zs.filter((z) => z.state === 'dead').length >= 2, `each beam kills in one hit in round 8 (${zs.filter((z) => z.state === 'dead').length} down)`);
  const h0 = g.me.health;
  addZ(g.sim, 0, 7.2, hp);
  g.step({ ads: true, fire: true, firePressed: true }, 1); g.step({ ads: true }, 40);
  check(g.me.health === h0, 'it never hurts you');
  check(CONFIG.weapons['Fucci Gun Mk 2+'].burstCount === 5, 'upgraded: a 5-round burst');
}

// --- the Desert Eagle: a big hit, a big kick
{
  const g = game(8);
  equip(g, 'Desert Eagle');
  const z = addZ(g.sim, 0, -3, 5000);
  const p0 = g.me.loadout.recoilPitch;
  g.step({ ads: true, fire: true, firePressed: true }, 1);
  check(5000 - z.health >= CONFIG.weapons['Desert Eagle'].damage * 0.9, `one round: ${Math.round(5000 - z.health)} damage`);
  check(g.me.loadout.recoilPitch - p0 > CONFIG.weapons.M1912.recoil.pitch * 2.5 * Math.PI / 180, 'and the view kicks up hard');
  check(CONFIG.weapons['Desert Eagle+'].explosiveRounds, 'upgraded: explosive rounds');
}

// --- the M60 weighs you down; the Peacekeeper doesn't
{
  const speed = (id) => {
    const g = game(9);
    equip(g, id);
    const x0 = g.me.pos.z;
    g.step({ moveY: 1 }, 60);
    return Math.abs(g.me.pos.z - x0);
  };
  const m60 = speed('M60'), pk = speed('Peacekeeper');
  check(m60 < pk * 0.9, `the M60 slows you (${m60.toFixed(2)} m vs ${pk.toFixed(2)} m in a second)`);
  check(CONFIG.weapons.M60.magSize === 100 && CONFIG.weapons.M60.reloadTime > 6, 'a 100-round belt, a long reload');
}

// --- the L96A1 goes through a line of them
{
  const g = game(10);
  equip(g, 'L97A1');
  const hp = zombieHealthForRound(3);
  const zs = [addZ(g.sim, 0, 3, hp), addZ(g.sim, 0, 1.5, hp), addZ(g.sim, 0, 0, hp)];
  g.me.pitch = -0.08;   // (chest high through the line)
  g.step({ ads: true }, 20);
  g.step({ ads: true, fire: true, firePressed: true }, 1);
  check(zs.every((z) => z.state === 'dead'), `one round through three of them (${zs.filter((z) => z.state === 'dead').length}, ${JSON.stringify(g.log.filter((e) => e.type === 'shot').map((e) => e.impacts.map((h) => h.kind)))})`);
  check(CONFIG.weapons.L97A1.name === 'L96A1', 'it\'s the L96A1 now');
}

console.log(fails ? `\n${fails} FAILED` : '\nall new-gun checks passed');
process.exit(fails ? 1 : 0);
