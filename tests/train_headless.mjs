// A bullet goes on through a line of zombies (a train), like COD: each one it
// hits pays its own points, solo and online.
// Run: node tests/train_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG } from '../src/config.js';
import { makeZombie } from '../src/sim/zombies.js';
import { giveWeapon, throughCount } from '../src/sim/weapons.js';
import { NetHost } from '../src/net/host.js';
import { NetClient } from '../src/net/client.js';
import { LoopbackHub } from '../src/net/transport.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const GAP = 0.7;   // a tight train

// a line of zombies straight ahead of `p` (dummies: they stand still)
function train(sim, p, n, health) {
  const zs = [];
  for (let i = 0; i < n; i++) {
    const at = { x: p.pos.x, z: p.pos.z - 2.5 - i * GAP };
    const z = makeZombie(sim, { pos: at, health, state: 'dummy' });
    z.home = { x: at.x, z: at.z };
    sim.zombies.push(z); zs.push(z);
  }
  return zs;
}

// one shot into the train, solo
function soloShot(gun, n, health = 5000) {
  const sim = new GameSim({ map: SCHOOL, seed: 7 });
  const me = sim.addPlayer('p1', 'T');
  sim.rounds.phase = 'test';
  giveWeapon(sim, me, gun);
  me.loadout.drawTimer = 0;
  const zs = train(sim, me, n, health);
  sim.drainEvents();
  const pts0 = me.points;
  sim.setInput('p1', { ...emptyCommand(), fire: true, firePressed: true, yaw: 0, pitch: -0.05 });
  me.yaw = 0; me.pitch = -0.05;
  sim.step(dt);
  const ev = sim.drainEvents();
  // (the bullet's own hits: a Mad Dog'd gun's ammo type can catch others too)
  const hit = new Set(ev.filter((e) => e.type === 'zombieHit' && e.kind === 'bullet').map((e) => e.id));
  return { sim, me, zs, ev, hit, earned: me.points - pts0 };
}

// --- 1. the starting pistol: 30 points a bullet off three lined-up zombies
{
  const r = soloShot('M1912', 6);
  check(CONFIG.weapons.M1912.penetration === 1 && throughCount(r.sim, CONFIG.weapons.M1912) === CONFIG.throughZombies.min, `the M1912 goes through ${CONFIG.throughZombies.min} zombies`);
  check(r.hit.size === 3 && r.zs.slice(0, 3).every((z) => r.hit.has(z.id)), `it hits the first three in the line (${r.hit.size})`);
  check(r.earned === 30, `and pays 10 for each (${r.earned})`);
  const dmg = r.ev.filter((e) => e.type === 'zombieHit').map((e) => e.damage);
  check(dmg[2] > 0 && dmg[2] < dmg[0], 'it keeps going with less behind each one');
}

// --- 2. each zombie it drops pays its kill points
{
  const r = soloShot('M1912', 3, 1);
  const kills = r.ev.filter((e) => e.type === 'zombieKilled').length;
  check(kills === 3, `one bullet drops all three weak zombies (${kills})`);
  const expect = r.ev.filter((e) => e.type === 'points').reduce((a, e) => a + e.amount, 0);
  check(r.earned >= 3 * CONFIG.points.kill && r.earned === expect, `each kill pays (${r.earned})`);
}

// --- 3. a gun that goes through more keeps its own count; Mad Dog adds one
{
  const r = soloShot('L97A1', 8);
  check(r.hit.size === CONFIG.weapons.L97A1.penetration, `the L96A1 goes through ${CONFIG.weapons.L97A1.penetration} (${r.hit.size})`);
  check(r.earned === 10 * r.hit.size, `10 points each (${r.earned})`);
  const up = soloShot('MP41+', 8);
  check(up.hit.size === CONFIG.throughZombies.min + CONFIG.madDog.penetrationAdd, `a Mad Dog'd MP41 goes one further (${up.hit.size})`);
}

// --- 4. a shotgun: every zombie its pellets reach pays once a shot
{
  const r = soloShot('SPAZ-13', 4);
  check(r.hit.size >= 2, `the pellets go through the front zombie (${r.hit.size} hit)`);
  check(r.earned === 10 * r.hit.size, `one 10 per zombie hit, not per pellet (${r.earned})`);
}

// --- 5. the train ends at a wall: nothing past it
{
  const sim = new GameSim({ map: SCHOOL, seed: 7 });
  const me = sim.addPlayer('p1', 'T');
  const eye = sim.eyePosition(me), d = { x: 0, y: 0, z: -1 };
  const wall = sim.raycastWorld(eye, d, 50);
  const z = makeZombie(sim, { pos: { x: me.pos.x, z: me.pos.z - wall.t - 1.5 }, health: 100, state: 'dummy' });
  sim.zombies.push(z);
  check(!sim.hitscan(eye, d, 80, 9).some((h) => h.zombieId === z.id), 'a zombie behind the wall isn\'t hit');
}

// --- 6. online: a friend's bullet through the train pays them for each
{
  const hub = new LoopbackHub({ latency: 5, jitter: 2 });
  const mk = () => { const s = new GameSim({ map: SCHOOL, seed: 12 }); s.addPlayer('h', 'Host'); s.addPlayer('a', 'Ann'); return s; };
  const hostSim = mk();
  const H = hub.endpoint('H');
  const host = new NetHost(hostSim, (to, m) => H.send(to, m));
  H.onMessage = (from, m) => host.onMessage(from, m);
  const ep = hub.endpoint('A');
  const aSim = mk();
  const c = new NetClient(aSim, 'a', (m) => ep.send('H', m));
  ep.onMessage = (from, m) => c.onMessage(m);
  hub.connect('H', 'A');
  host.addRemote('A', 'a');
  const cmd = { ...emptyCommand(), yaw: aSim.playerById('a').yaw };
  const hostLog = [];
  const step = (n, patch = {}) => {
    for (let i = 0; i < n; i++) {
      hub.tick(); host.preStep();
      hostSim.setInput('h', { ...emptyCommand(), yaw: hostSim.playerById('h').yaw });
      hostSim.step(dt);
      const ev = hostSim.drainEvents();
      hostLog.push(...ev);
      host.postStep(ev);
      c.tick({ ...cmd, ...patch }, dt);
      cmd.firePressed = false;
    }
  };
  step(60);
  hostSim.rounds.timer = 1e9; hostSim.rounds.phase = 'intermission';
  for (const z of hostSim.zombies) z.state = 'dead';
  step(20);
  const ha = hostSim.playerById('a'), aa = aSim.playerById('a');
  const zs = train(hostSim, aa, 5, 5000);
  step(40);
  check(zs.every((z) => aSim.zombies.some((q) => q.id === z.id)), 'Ann sees the whole train');
  const first = aSim.zombies.find((q) => q.id === zs[0].id);
  const dx = first.pos.x - aa.pos.x, dz = first.pos.z - aa.pos.z;
  cmd.yaw = Math.atan2(-dx, -dz);
  cmd.pitch = Math.atan2(first.pos.y + 1.2 - (aa.pos.y + CONFIG.player.eyeHeight), Math.hypot(dx, dz));
  step(5);
  const pts0 = ha.points;
  hostLog.length = 0;
  step(1, { fire: true, firePressed: true });
  step(30);
  const hit = new Set(hostLog.filter((e) => e.type === 'zombieHit' && e.playerId === 'a').map((e) => e.id));
  check(hit.size === 3 && zs.slice(0, 3).every((z) => hit.has(z.id)), `the host takes Ann's bullet through three zombies (${hit.size})`);
  check(ha.points - pts0 === 30, `and pays her 10 for each (${ha.points - pts0})`);
  check(aa.points === ha.points, 'her own copy shows the points');
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
