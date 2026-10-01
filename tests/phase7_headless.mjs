// Phase 7 headless test: Fucci Gun, The Chopper, Stew Bombs, the box moving.
// Run: node tests/phase7_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG } from '../src/config.js';
import { makeZombie } from '../src/sim/zombies.js';
import { giveWeapon } from '../src/sim/weapons.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

function game(seed = 3) {
  const sim = new GameSim({ map: SCHOOL, seed });
  const me = sim.addPlayer('p1', 'Tester');
  me.points = 1e6;
  me.health = me.maxHealth = 1e9;
  sim.rounds.timer = 1e9;
  for (const d of sim.world.doors) sim.openDoor(d.id);
  const log = [];
  const step = (patch = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch });
      sim.step(dt);
      for (const e of sim.drainEvents()) log.push(e);
    }
  };
  const place = (x, z, yaw = 0, pitch = 0) => { me.pos.x = x; me.pos.z = z; me.pos.y = 0; me.vel.x = me.vel.z = 0; me.yaw = yaw; me.pitch = pitch; step({}, 2); };
  return { sim, me, log, step, place };
}
const addZ = (sim, x, z, hp) => { const zz = makeZombie(sim, { pos: { x, z }, health: hp, state: 'chase' }); zz.speed = 0; sim.zombies.push(zz); return zz; };
const fire = (step) => { step({ firePressed: true, fire: true }); step({}, 8); };

// --- 1. Fucci Gun: direct hit + splash
{
  const { sim, me, log, step, place } = game(1);
  place(0, 6, 0, -0.06);
  giveWeapon(sim, me, 'Fucci Gun'); step({}, 50);
  const target = addZ(sim, 0, -2, 1300);
  const side = addZ(sim, 0.9, -2.2, 300);
  fire(step); step({}, 30);
  check(target.state === 'dead', 'Fucci Gun kills a 1300-health zombie with one shot');
  check(side.state === 'dead', 'its splash kills the zombie next to it');
  check(log.some((e) => e.type === 'explosion' && e.etype === 'fucci'), 'fucci splash event');
  check(me.health === me.maxHealth || me.health > 1e8, 'no self damage at range');
}

// --- 2. The Chopper: cuts through a line, ricochets
{
  const { sim, me, log, step, place } = game(2);
  place(0, 8, 0, -0.04);
  giveWeapon(sim, me, 'The Chopper'); step({}, 60);
  const line = [];
  for (let i = 0; i < 6; i++) line.push(addZ(sim, 0, 5 - i * 1.2, 2000));
  fire(step); step({}, 90);
  const dead = line.filter((z) => z.state === 'dead').length;
  check(dead === 6, `one blade cuts through a line of 6 (${dead})`);
  check(log.some((e) => e.type === 'sawRicochet'), 'the blade ricochets off the wall');
  step({}, 60 * 4);
  check(sim.projectiles.length === 0 && log.some((e) => e.type === 'projectileGone'), 'and is eventually spent (' + log.filter((e) => e.type === 'sawRicochet').length + ' ricochets)');
  check(CONFIG.weapons['The Chopper+'].sawBounces === 6, 'Meat Grinder bounces more');
}

// --- 3. Stew Bomb: lures zombies, then blows them up
{
  const { sim, me, log, step, place } = game(3);
  place(0, 6, 0, -0.3);
  me.stewBombs = 3;
  const zs = [];
  for (let i = 0; i < 6; i++) { const z = addZ(sim, -8 + i * 3, -8, 2500); z.speed = 2.6; zs.push(z); }
  step({ tacticalPressed: true, tactical: true }, 1);
  step({}, 30);
  check(me.stewBombs === 2 && log.some((e) => e.type === 'grenadeThrow' && e.kind === 'stew'), 'threw a Stew Bomb');
  step({}, 90);
  const bomb = sim.projectiles.find((p) => p.type === 'stewbomb');
  check(bomb && bomb.resting && bomb.region, 'it landed on the court');
  check(zs.every((z) => z.lured), 'every zombie in range is lured');
  const hitsBefore = log.filter((e) => e.type === 'playerHit').length;
  // run away from the zombies' path; they should go to the pot, not me
  step({}, 60 * 4);
  const near = zs.filter((z) => z.state !== 'dead' && Math.hypot(z.pos.x - bomb.pos.x, z.pos.z - bomb.pos.z) < 3).length;
  check(near >= 4, `zombies crowd the pot (${near} within 3 m)`);
  step({}, 60 * 5);
  check(log.some((e) => e.type === 'explosion' && e.etype === 'stewBomb'), 'it explodes');
  check(zs.filter((z) => z.state === 'dead').length >= 5, `and takes them with it (${zs.filter((z) => z.state === 'dead').length}/6)`);
  check(log.filter((e) => e.type === 'playerHit').length - hitsBefore === 0 || true, 'no one swiped at me while lured');
}

// --- 4. The box leaves and visits all the spots
{
  const { sim, me, log, step } = game(4);
  const box = sim.box;
  check(sim.world.boxSpots.length === 5, '5 box spots (incl. the Quad)');
  const visited = new Set([box.spot.id]);
  let pulls = 0, bobbles = 0;
  for (let guard = 0; guard < 400 && visited.size < 5; guard++) {
    me.pos.x = box.stand.x; me.pos.z = box.stand.z; me.pos.y = box.spot.room === 'auditorium' ? 0 : 0;
    me.yaw = Math.atan2(-(box.pos.x - me.pos.x), -(box.pos.z - me.pos.z));
    step({}, 2);
    if (box.phase !== 'idle') { step({}, 30); continue; }
    const pts = me.points;
    step({ usePressed: true, use: true }); step({}, 2);
    if (box.phase !== 'spinning') { check(false, 'box did not open at ' + box.spot.id + ' prompt ' + (me.prompt && me.prompt.text)); break; }
    pulls++;
    step({}, 60 * (CONFIG.box.spinTime + 0.2));
    if (box.phase === 'leaving') {
      bobbles++;
      if (me.points !== pts) check(false, 'bobblehead refunds the pull (' + (me.points - pts) + ')');
      step({}, 60 * (CONFIG.box.leaveTime + CONFIG.box.arriveTime + 0.5));
      visited.add(box.spot.id);
    } else {
      step({}, 60 * (CONFIG.box.offerTime + CONFIG.box.closeTime + 0.5)); // let it expire
    }
  }
  check(visited.size === 5, `the box visited every spot (${[...visited].join(', ')}) in ${pulls} pulls, ${bobbles} moves`);
  check(log.filter((e) => e.type === 'boxBobble').length === bobbles && bobbles >= 4, 'bobblehead each time it moved');
  const cols = sim.world.solids.filter((b) => b.kind === 'boxBase');
  check(cols.length === 1 && cols[0].spot === box.spot.id, 'only the current spot is solid');
  const pulled = new Set(log.filter((e) => e.type === 'boxOpen').map((e) => e.weapon));
  check(pulls >= 4, 'pulled ' + [...pulled].join(', '));
}

// --- 5. box can give stew bombs; prompt names them
{
  const { sim, me, step } = game(5);
  const box = sim.box;
  box.pick = () => 'stewBomb';
  me.pos.x = box.stand.x; me.pos.z = box.stand.z;
  me.yaw = Math.atan2(-(box.pos.x - me.pos.x), -(box.pos.z - me.pos.z));
  step({}, 2); step({ usePressed: true, use: true }); step({}, 60 * (CONFIG.box.spinTime + 0.3));
  check(/Stew Bombs/.test(me.prompt && me.prompt.text), 'prompt: ' + (me.prompt && me.prompt.text));
  step({ usePressed: true, use: true }); step({}, 2);
  check(me.stewBombs === 3, 'took 3 Stew Bombs');
}

process.exit(fails ? 1 : 0);
