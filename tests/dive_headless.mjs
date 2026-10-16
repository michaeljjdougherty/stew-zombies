// Dolphin diving, falls, and PHD Gaylor.
// Run: node tests/dive_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { makeZombie } from '../src/sim/zombies.js';
import { givePerk } from '../src/sim/perks.js';
import { explode } from '../src/sim/projectiles.js';

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
  me.pos.x = 9; me.pos.z = 10; me.pos.y = 0; me.yaw = 0;
  return { sim, me, log, step };
}
const sprintDive = (g) => { g.step({ moveY: 1, sprint: true }, 30); g.step({ moveY: 1, sprint: true, crouch: true }, 1); };

// --- a dive: sprint, crouch
{
  const g = game();
  const z0 = g.me.pos.z;
  sprintDive(g);
  check(!!g.me.dive && g.log.some((e) => e.type === 'playerDive'), 'sprint + crouch: a dolphin dive');
  check(g.me.dive && g.me.vel.y > 0, '...thrown forward and up');
  let air = 0;
  while (g.me.dive && g.me.dive.phase === 'air' && air < 120) { g.step({ moveY: 1, sprint: true, crouch: true }); air++; }
  const landed = g.log.find((e) => e.type === 'diveLand');
  check(!!landed && air > 10, `lands on your belly (${(air / 60).toFixed(2)} s in the air)`);
  const zLand = g.me.pos.z;
  g.step({ crouch: true }, 60);
  check(!g.me.dive && !!g.me.prone, 'the skid over: you\'re lying prone');
  check(z0 - g.me.pos.z > 4.5 && z0 - zLand > 3, `covers ground (${(z0 - g.me.pos.z).toFixed(1)} m)`);
  g.step({}, 120);
  check(!!g.me.prone, '...and you stay down until you get up');
  const zp = g.me.pos.z; g.step({ moveY: 1 }, 60);
  const crawl = zp - g.me.pos.z;
  check(crawl > 0.1 && crawl < 1, `crawling along (${crawl.toFixed(2)} m a second)`);
  g.step({ jump: true, jumpPressed: true }, 1);
  check(g.me.prone && g.me.prone.up != null, 'jump: you push yourself up');
  check(g.me.pos.y < 0.05, '...without jumping');
  g.step({}, 40);
  check(!g.me.prone && !g.me.crouching && g.me.height === g.sim.cfg.player.height, 'and stand');
  check(g.me.health === g.me.maxHealth, 'a dive on the flat doesn\'t hurt');
}

// --- crouch as in Black Ops: tap to crouch, tap again to stand, hold to go prone
{
  const g = game();
  const tap = () => { g.step({ crouch: true }, 4); g.step({}, 2); };
  tap();
  check(g.me.crouching && !g.me.prone, 'tap crouch: you crouch');
  g.step({}, 120);
  check(g.me.crouching && !g.me.prone, '...and stay crouched after letting go (no prone)');
  tap();
  check(!g.me.crouching && g.me.height === g.sim.cfg.player.height, 'tap it again: you stand');
  g.step({ crouch: true }, 1);
  check(g.me.crouching && !g.me.prone, 'press it: down to a crouch at once');
  g.step({ crouch: true }, 30);
  check(!!g.me.prone && g.log.some((e) => e.type === 'playerProne'), 'hold it: down prone');
  g.step({ crouch: true }, 60); g.step({}, 30);
  check(!!g.me.prone, 'keep holding, let go: still prone');
  tap();
  check(g.me.prone && g.me.prone.up != null, 'tap crouch while prone: getting up');
  g.step({}, 40);
  check(!g.me.prone && g.me.crouching, '...to a crouch');
  g.step({ crouch: true }, 40); g.step({}, 2);
  check(!!g.me.prone, 'hold it from a crouch: prone');
  g.step({ crouch: true }, 40); g.step({}, 40);
  check(!g.me.prone && !g.me.crouching, 'hold it while prone: all the way up');
  tap();
  g.step({ jump: true, jumpPressed: true }, 1);
  check(!g.me.crouching && g.me.grounded, 'jump while crouched: you stand (no hop)');
  tap();
  g.step({ moveY: 1, sprint: true }, 30);
  check(!g.me.crouching && g.me.sprinting, 'sprint while crouched: up and running');
  g.step({ moveY: 1, sprint: true, crouch: true }, 1);
  check(!!g.me.dive, 'crouch on the run: a dive');
  g.step({ crouch: true }, 120); g.step({}, 30);
  check(!!g.me.prone && !g.me.dive, '...ending prone');
  g.step({}, 5); tap(); g.step({}, 40);
  check(!g.me.prone && g.me.crouching, 'tap crouch: up to a crouch');
  tap(); g.step({}, 5);
  g.step({ crouch: true }, 30); g.step({}, 2);
  check(!!g.me.prone, 'hold from standing: prone');
  g.step({ moveY: 1, sprint: true }, 40);
  check(!g.me.prone, 'sprint: up and off');
}

// --- a dive right as you run off a ledge still counts
{
  const g = game();
  g.step({ moveY: 1, sprint: true }, 30);
  g.me.grounded = false; g.me.pos.y = 0.3;
  g.step({ moveY: 1, sprint: true }, 6);
  g.step({ moveY: 1, sprint: true, crouch: true }, 1);
  check(!!g.me.dive, 'crouch just after running off the lip: a dive');
  const g2 = game();
  g2.step({ moveY: 1, sprint: true }, 30);
  g2.me.pos.y = 8; g2.me.grounded = false;
  g2.step({ moveY: 1, sprint: true }, 30);
  g2.step({ moveY: 1, sprint: true, crouch: true }, 1);
  check(!g2.me.dive, '...but not once you\'re well into the fall');
}

// --- no dive without sprinting
{
  const g = game();
  g.step({ moveY: 1 }, 30); g.step({ moveY: 1, crouch: true }, 2);
  check(!g.me.dive && g.me.crouching, 'crouch while walking: just a crouch');
}

// --- falls hurt; PHD Gaylor: they don't
{
  const g = game();
  g.me.pos.y = 9; g.me.grounded = false;
  g.step({}, 120);
  const hurt = g.me.maxHealth - g.me.health;
  check(hurt > 20 && g.me.alive, `a 9 m fall hurts (${Math.round(hurt)})`);
  const g2 = game();
  givePerk(g2.sim, g2.me, 'phdGaylor');
  g2.me.pos.y = 9; g2.me.grounded = false;
  g2.step({}, 120);
  check(g2.me.health === g2.me.maxHealth, 'with PHD Gaylor: nothing');
  const g3 = game();
  g3.me.pos.y = 2; g3.me.grounded = false;
  g3.step({}, 60);
  check(g3.me.health === g3.me.maxHealth, 'a short drop is free');
}

// --- PHD Gaylor: your own blasts can't hurt you
{
  const g = game();
  explode(g.sim, { x: g.me.pos.x + 1, y: 1, z: g.me.pos.z }, 'frag', 'p1');
  const hurt = g.me.maxHealth - g.me.health;
  const g2 = game();
  givePerk(g2.sim, g2.me, 'phdGaylor');
  explode(g2.sim, { x: g2.me.pos.x + 1, y: 1, z: g2.me.pos.z }, 'frag', 'p1');
  check(hurt > 0 && g2.me.health === g2.me.maxHealth, `your own grenade: ${Math.round(hurt)} without, 0 with PHD Gaylor`);
}

// --- PHD Gaylor: a dive off something lands with a blast (a bigger one off something high)
{
  const g0 = game();
  givePerk(g0.sim, g0.me, 'phdGaylor');
  sprintDive(g0);
  g0.step({ crouch: true }, 90);
  check(g0.log.some((e) => e.type === 'diveLand') && !g0.log.some((e) => e.type === 'explosion'), 'a dive along flat ground: no blast, even with PHD Gaylor');
  const g = game();
  givePerk(g.sim, g.me, 'phdGaylor');
  const zs = [];
  sprintDive(g);
  g.me.dive.from += 1.6;   // (as if off a ledge)
  // (round where it'll land)
  for (const [dx, dz] of [[0, -3.5], [1.8, -3], [-1.8, -4]]) { const z = makeZombie(g.sim, { pos: { x: g.me.pos.x + dx, z: g.me.pos.z + dz }, health: 1500, state: 'chase' }); z.speed = 0; g.sim.zombies.push(z); zs.push(z); }
  g.step({ crouch: true }, 90);
  check(g.log.some((e) => e.type === 'explosion' && e.etype === 'phd'), 'off a ledge: the dive lands with a purple blast');
  check(zs.filter((z) => z.state === 'dead').length >= 2, `it kills what's round you (${zs.filter((z) => z.state === 'dead').length} of 3)`);
  check(g.me.health === g.me.maxHealth, 'and not you');
  const g2 = game();
  givePerk(g2.sim, g2.me, 'phdGaylor');
  sprintDive(g2);
  g2.me.dive.from += 4;   // (as if off a ledge)
  g2.step({ crouch: true }, 90);
  check(g2.log.some((e) => e.type === 'explosion' && e.etype === 'phdHigh'), 'off something high: the big one');
  const g3 = game();
  sprintDive(g3);
  g3.step({ crouch: true }, 90);
  check(!g3.log.some((e) => e.type === 'explosion'), 'no perk, no blast');
}

// --- the machines
{
  check(SCHOOL.perkMachines.some((m) => m.perk === 'phdGaylor'), 'a PHD Gaylor machine at the school');
  const g = game(CRUST);
  const it = g.sim.interactables.find((i) => i.kind === 'perk' && i.m.perk === 'phdGaylor');
  check(!!it && it.m.perk === 'phdGaylor', 'and one at the Anvil');
  g.me.pos.x = it.stand.x; g.me.pos.z = it.stand.z; g.me.pos.y = it.m.center.y + 0.05; g.me.points = 5000;
  g.me.yaw = Math.atan2(-(it.pos.x - it.stand.x), -(it.pos.z - it.stand.z));
  g.step({}, 30);
  check(g.me.prompt && /power must be on/.test(g.me.prompt.text), `no power at the Front yet: "${g.me.prompt && g.me.prompt.text}"`);
  g.sim.crustEgg.power.on.trench = true;
  g.step({}, 2);
  check(g.me.prompt && /PHD Gaylor/.test(g.me.prompt.text), `its prompt: "${g.me.prompt && g.me.prompt.text}"`);
  g.step({ use: true, usePressed: true }); g.step({}, 160);
  check(g.me.perks.includes('phdGaylor'), 'with the Front\'s power on it works');
}

// --- lying flat, your head's a body-length out in front of you: it stays out of walls
{
  const g = game(CRUST);
  const PR = g.sim.cfg.player.prone;
  const m = g.sim.world.perkMachines[0], n = m.normal, b = m.box;
  // in front of the machine, facing it, close enough that lying down would put your head in it
  const face = { x: m.center.x + n.x * 0.45, z: m.center.z + n.z * 0.45 };
  g.me.pos.x = face.x + n.x * 0.4; g.me.pos.z = face.z + n.z * 0.4; g.me.pos.y = m.center.y + 0.02; g.me.region = null;
  g.me.yaw = Math.atan2(n.x, n.z);   // (facing -normal: at the machine)
  g.step({}, 5);
  g.me.prone = { t: 0 };
  g.step({}, 10);
  const o = { x: g.me.pos.x, y: g.me.pos.y + PR.clearHeight, z: g.me.pos.z };
  const hit = g.sim.raycastWorld(o, { x: -Math.sin(g.me.yaw), y: 0, z: -Math.cos(g.me.yaw) }, PR.reach + 0.5);
  check(hit && hit.t >= PR.reach - 0.02, `lying flat facing a perk machine: pushed back so your head's clear (${hit ? hit.t.toFixed(2) : 'nothing'} m to it, needs ${PR.reach})`);
  void b;
}

console.log(fails ? `\n${fails} FAILED` : '\nall dive checks passed');
process.exit(fails ? 1 : 0);
