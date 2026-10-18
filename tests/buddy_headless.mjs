// Regs Best Buddy Mode: grab it and the zombies stop coming for you and fight
// each other for 20 s; their kills are yours. Titans' own zombies don't join in.
// Works on Stew Leonard High and Call of the Crust, and shows for a friend online.
// Run: node tests/buddy_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { makeZombie } from '../src/sim/zombies.js';
import { spawnPowerup } from '../src/sim/powerups.js';
import { worldState, applyMirror } from '../src/net/state.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

function setup(map, at) {
  const sim = new GameSim({ map, seed: 5 });
  const me = sim.addPlayer('p1', 'T', { character: 'kearns' });
  sim.rounds.phase = 'test'; sim.rounds.timer = 1e9;
  me.maxHealth = me.health = 1e6;
  if (at) { me.pos.x = at.x; me.pos.y = at.y; me.pos.z = at.z; }
  const step = (n) => { const ev = []; for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch }); sim.step(dt); ev.push(...sim.drainEvents()); } return ev; };
  const zombie = (dx, dz, extra = {}) => {
    const z = makeZombie(sim, { type: 'runner', pos: { x: me.pos.x + dx, y: me.pos.y, z: me.pos.z + dz }, health: 600, state: 'chase' });
    Object.assign(z, extra);
    sim.zombies.push(z);
    return z;
  };
  return { sim, me, step, zombie };
}

// --- Stew Leonard High
{
  const { sim, me, step, zombie } = setup(SCHOOL);
  const def = sim.cfg.powerups.list.bestBuddy;
  check(def && def.name === 'Regs Best Buddy Mode' && def.timed && def.time === 20, 'Regs Best Buddy Mode is a 20 s power-up');

  // before: they come for you
  const a = zombie(2.5, 0), b = zombie(-2.5, 0);
  step(Math.ceil(3 / dt));
  check(me.health < me.maxHealth, `without it they hit you (${me.maxHealth - me.health} damage)`);
  check(a.health === a.maxHealth && b.health === b.maxHealth, 'and leave each other alone');

  // grab it
  spawnPowerup(sim, 'bestBuddy', { x: me.pos.x, y: me.pos.y, z: me.pos.z });
  let ev = step(2);
  const grab = ev.find((e) => e.type === 'powerupGrab' && e.ptype === 'bestBuddy');
  check(!!grab && grab.duration === 20, `picked up, lasts ${grab && grab.duration} s`);
  check(sim.powerups.buddyId === me.id, 'their kills are mine');

  // the titans' own keep coming
  const t = zombie(0, 2.5, { titan: 1 });
  me.health = me.maxHealth;
  const kills = me.kills, pts = me.points;
  ev = step(Math.ceil(12 / dt));
  check(me.health < me.maxHealth, 'a titan\'s zombie still hits you');
  check(t.health === t.maxHealth, 'and nobody picks a fight with it');
  check(ev.some((e) => e.type === 'zombieHit' && e.kind === 'brawl'), 'the zombies punch each other');
  const brawlKills = ev.filter((e) => e.type === 'zombieKilled' && e.kind === 'brawl');
  check(brawlKills.length >= 1 && brawlKills.every((e) => e.playerId === me.id), `${brawlKills.length} killed each other, credited to me`);
  check(me.kills > kills && me.points > pts, `kills ${kills} → ${me.kills}, points ${pts} → ${me.points}`);

  // nobody but the titan's lays a hand on you
  t.state = 'dead';
  const c = zombie(1.2, 0), d = zombie(-1.2, 0.4);
  me.health = me.maxHealth;
  step(Math.ceil(3 / dt));
  check(me.health === me.maxHealth, 'zombies right next to you leave you alone');
  check(c.health < c.maxHealth || d.health < d.maxHealth || c.state === 'dead' || d.state === 'dead', 'and go at each other');

  // a friend online sees it on their HUD
  const fr = new GameSim({ map: SCHOOL, seed: 5 }); fr.addPlayer('p1', 'T'); fr.addPlayer('p2', 'F'); fr.replica = true;
  applyMirror(fr, JSON.parse(JSON.stringify(worldState(sim))), 'p2');
  check(fr.powerups.active.bestBuddy > 0, 'mirrored to a friend');

  // when it runs out they're back on you
  ev = step(Math.ceil((sim.powerups.active.bestBuddy + 0.2) / dt));
  check(ev.some((e) => e.type === 'powerupEnd' && e.ptype === 'bestBuddy'), 'it ends');
  for (const z of sim.zombies) if (z.state !== 'dead') { z.health = z.maxHealth = 1e6; }
  const e2 = zombie(1.5, 0);
  me.health = me.maxHealth;
  step(Math.ceil(3 / dt));
  check(me.health < me.maxHealth, 'then they come for you again');
  check(e2.health === e2.maxHealth, 'and stop fighting each other');
}

// --- Call of the Crust (the Anvil)
{
  const { sim, me, step, zombie } = setup(CRUST, { x: -6, y: 0.3, z: 8 });
  sim.godMode = true;
  sim.powerups.active.bestBuddy = 20; sim.powerups.buddyId = me.id;
  const a = zombie(2, 0), b = zombie(-2, 0);
  step(Math.ceil(6 / dt));
  check(a.health < a.maxHealth || b.health < b.maxHealth || a.state === 'dead' || b.state === 'dead', 'on the Crust they fight each other too');
}

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
