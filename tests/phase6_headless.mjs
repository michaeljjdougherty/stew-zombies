// Phase 6 headless test: power-ups and Cheddar Rounds.
// Run: node tests/phase6_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG } from '../src/config.js';
import { makeZombie, damageZombie } from '../src/sim/zombies.js';
import { spawnPowerup } from '../src/sim/powerups.js';
import { giveWeapon } from '../src/sim/weapons.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

function game(seed = 3) {
  const sim = new GameSim({ map: SCHOOL, seed });
  const me = sim.addPlayer('p1', 'Tester');
  const log = [];
  const step = (patch = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch });
      sim.step(dt);
      for (const e of sim.drainEvents()) log.push(e);
    }
  };
  return { sim, me, log, step };
}
const addZ = (sim, x, z, hp = 500) => { const zz = makeZombie(sim, { pos: { x, z }, health: hp, state: 'chase' }); zz.speed = 0; sim.zombies.push(zz); return zz; };

// --- 1. drops happen as points are earned, at most 4 per round
{
  const { sim, me, log, step } = game(4);
  sim.rounds.timer = 1e9;
  sim.rounds.round = 3;
  me.health = me.maxHealth = 1e9;
  let drops = 0;
  for (let i = 0; i < 120; i++) {
    const z = addZ(sim, me.pos.x, me.pos.z - 3, 5);
    // a player kill inside the map
    sim.addPoints(me, 100, 'kill');
    sim.drainEvents();
    damageZombie(sim, z, 10, { playerId: me.id, part: 'torso', kind: 'bullet', dir: { x: 0, y: 0, z: -1 }, point: z.pos });
    for (const e of sim.drainEvents()) { log.push(e); if (e.type === 'powerupSpawn') drops++; }
    step({}, 1);
  }
  check(drops === CONFIG.powerups.maxPerRound, `drops capped per round (${drops})`);
  check(log.filter((e) => e.type === 'powerupSpawn').every((e) => CONFIG.powerups.list[e.ptype]), 'drop types valid: ' + [...new Set(log.filter((e) => e.type === 'powerupSpawn').map((e) => e.ptype))].join(','));
}

// --- 2. each power-up's effect
{
  const { sim, me, log, step } = game(5);
  sim.rounds.timer = 1e9;
  const grab = (type) => { spawnPowerup(sim, type, { x: me.pos.x, z: me.pos.z }); step({}, 2); };

  giveWeapon(sim, me, 'M15'); step({}, 40);
  for (const s of me.loadout.slots) { s.reserve = 0; s.clip = 1; }
  me.grenades = 0;
  grab('fullPantry');
  check(me.loadout.slots.every((s) => s.reserve === CONFIG.weapons[s.id].reserve && s.clip === CONFIG.weapons[s.id].magSize) && me.grenades === me.grenadeMax, 'Full Pantry refills everything');

  grab('doubleDough');
  const p0 = me.points; sim.addPoints(me, 60, 'kill');
  check(me.points - p0 === 120, `Double Dough doubles points (+${me.points - p0})`);
  step({}, 60 * (CONFIG.powerups.duration + 1));
  const p1 = me.points; sim.addPoints(me, 60, 'kill');
  check(me.points - p1 === 60, 'Double Dough wears off');

  grab('oneBite');
  const tough = addZ(sim, me.pos.x, me.pos.z - 3, 1e6);
  me.yaw = 0; me.pitch = -0.08; me.loadout.drawTimer = 0;
  for (let i = 0; i < 20 && tough.state !== 'dead'; i++) { step({ firePressed: true, fire: true }); step({}, 6); }
  check(tough.state === 'dead', 'One Bite: a million-health zombie dies in one hit');
  step({}, 60 * (CONFIG.powerups.duration + 1));

  for (let i = 0; i < 8; i++) addZ(sim, me.pos.x + i, me.pos.z - 6, 1e6);
  const pts = me.points;
  grab('pressureCooker');
  step({}, 90);
  check(sim.zombies.length === 0, 'Pressure Cooker clears the map');
  check(me.points - pts === 400, `Pressure Cooker gives 400 (+${me.points - pts})`);

  for (const w of sim.windows) w.boards = 0;
  grab('shopClass');
  check(sim.windows.every((w) => w.boards === w.maxBoards), 'Shop Class rebuilds every barrier');

  sim.box.uses = 1;
  grab('clearanceSale');
  const boxIt = sim.interactables.find((i) => i.kind === 'box');
  check(boxIt.prompt(sim, me).cost === 10, 'Clearance Sale: box costs 10');

  spawnPowerup(sim, 'fullPantry', { x: me.pos.x + 10, z: me.pos.z });
  step({}, 60 * (CONFIG.powerups.life + 1));
  check(sim.powerups.drops.length === 0 && log.some((e) => e.type === 'powerupGone' && !e.taken), 'untaken drops vanish');
}

// --- 3. Cheddar Round
{
  const { sim, me, log, step } = game(9);
  me.health = me.maxHealth = 1e9;
  const R = sim.rounds;
  check(R.cheddarNext >= 5 && R.cheddarNext <= 7, 'first Cheddar Round is round ' + R.cheddarNext);
  // skip ahead to the round before it
  R.round = R.cheddarNext - 1; R.phase = 'intermission'; R.timer = 0.05;
  step({}, 10);
  check(R.cheddar && log.some((e) => e.type === 'cheddarStart'), 'Cheddar Round started on round ' + R.round);
  check(sim.zombies.length === 0, 'haze first, no hounds yet');
  step({}, 60 * 8);
  const hounds = sim.zombies.filter((z) => z.type === 'cheddar');
  check(hounds.length > 0 && log.some((e) => e.type === 'cheddarStrike'), `hounds came down with the lightning (${hounds.length} alive)`);
  check(!sim.zombies.some((z) => z.type !== 'cheddar'), 'no regular zombies during a Cheddar Round');
  step({}, 60 * 6);
  const bites = log.filter((e) => e.type === 'playerHit').length;
  check(bites > 0, `hounds bite (${bites} bites)`);
  // kill them all as they come
  let guard = 0;
  while (R.cheddar && guard++ < 60 * 120) {
    for (const z of [...sim.zombies]) if (z.state === 'chase') damageZombie(sim, z, 1e6, { playerId: me.id, part: 'torso', kind: 'bullet', dir: { x: 0, y: 0, z: 1 }, point: z.pos });
    step({}, 1);
  }
  check(!R.cheddar && R.phase === 'intermission', 'Cheddar Round ended');
  check(log.filter((e) => e.type === 'zombieKilled' && e.zombieType === 'cheddar').length === R.total, `all ${R.total} hounds killed`);
  check(sim.powerups.drops.some((d) => d.type === 'fullPantry') || log.some((e) => e.type === 'powerupGrab' && e.ptype === 'fullPantry'), 'last hound left a Full Pantry');
  const next = R.cheddarNext - R.round;
  check(next >= CONFIG.cheddar.every[0] && next <= CONFIG.cheddar.every[1], 'next Cheddar Round in ' + next + ' rounds');
  // the following round is back to zombies
  R.timer = 0.05; step({}, 60 * 6);
  check(!R.cheddar && sim.zombies.length > 0 && sim.zombies.every((z) => z.type !== 'cheddar'), 'zombies again after');
}

process.exit(fails ? 1 : 0);
