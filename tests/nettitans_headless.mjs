// Call of the Crust online: the titans and Big Evil Zach, as a friend (not the
// host) feels them. Their browser moves them, so whatever the host does to
// them (a breath that drags them, a slam that throws them, a frost nova that
// slows them, a body they can't walk through) has to reach their copy.
// Run: node tests/nettitans_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { NetHost } from '../src/net/host.js';
import { NetClient } from '../src/net/client.js';
import { LoopbackHub } from '../src/net/transport.js';
import { wakeTitan } from '../src/sim/crustEgg.js';
import { startFinale } from '../src/sim/zachBoss.js';
import { groundHeight } from '../src/sim/physics.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

function game(seed) {
  const hub = new LoopbackHub({ latency: 5, jitter: 3 });
  const mk = () => { const s = new GameSim({ map: CRUST, seed }); s.addPlayer('h', 'Host', { character: 'kearns' }); s.addPlayer('a', 'Ann', { character: 'ryan' }); return s; };
  const hostSim = mk();
  const H = hub.endpoint('H');
  const host = new NetHost(hostSim, (to, m) => H.send(to, m));
  H.onMessage = (from, m) => host.onMessage(from, m);
  const ep = hub.endpoint('A');
  const sim = mk();
  const c = new NetClient(sim, 'a', (m) => ep.send('H', m));
  ep.onMessage = (from, m) => c.onMessage(m);
  hub.connect('H', 'A');
  host.addRemote('A', 'a');
  const me = sim.playerById('a'), hh = hostSim.playerById('h');
  // the host waits far off on the Anvil (out of every fight)
  hh.pos.x = 0; hh.pos.z = 0; hh.pos.y = groundHeight(0, 0, 0.3, 40, [hostSim.world.solids, hostSim.world.terrain]);
  const heard = [];
  const step = (secs, cmd = {}) => {
    for (let i = 0; i < Math.round(secs * 60); i++) {
      hub.tick(); host.preStep();
      for (const p of hostSim.players) p.health = p.maxHealth;
      hostSim.setInput('h', { ...emptyCommand(), yaw: hh.yaw });
      hostSim.step(dt); host.postStep(hostSim.drainEvents());
      for (const e of c.tick({ ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...cmd, usePressed: !!cmd.use && i === 0, firePressed: !!cmd.fire && i === 0, meleePressed: !!cmd.melee && i === 0 }, dt)) heard.push(e);
    }
  };
  // a spot r m from (x,z) with ground about as high as y (for a fight on a ledge)
  // (away: the one farthest from there, so there's room to be thrown)
  const near = (x, z, y, r, away = null) => {
    let best = null;
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const gy = groundHeight(px, pz, 0.3, y + 2, [sim.world.solids, sim.world.terrain]);
      if (Math.abs(gy - y) >= 0.6) continue;
      const s = { x: px, z: pz, y: gy, yaw: Math.atan2(px - x, pz - z), far: away ? Math.hypot(px - away.x, pz - away.z) : 0 };
      if (!away) return s;
      if (!best || s.far > best.far) best = s;
    }
    return best;
  };
  const at = (x, z, y = null) => {
    me.pos.x = x; me.pos.z = z; me.pos.y = (y ?? groundHeight(x, z, 0.3, 40, [sim.world.solids, sim.world.terrain])) + 0.05;
    me.vel.x = me.vel.y = me.vel.z = 0; me.region = null; me.grounded = false;
  };
  step(2);
  return { hostSim, sim, me, step, at, near, heard, hp: hostSim.playerById('a') };
}

// --- the Drowned Captain's breath drags her toward the edge, then blows her back
{
  const g = game(12);
  const { hostSim, me } = g;
  check(g.sim.replica, 'Ann has the host\'s world');
  wakeTitan(hostSim, 'ship');
  const T = hostSim.crustEgg.titans.ship, c = hostSim.cfg.crust.egg.ship;
  g.step(hostSim.cfg.crust.egg.wakeTime.ship + 2);
  g.at(0, -150); g.step(0.5);
  const z0 = me.pos.z;
  T.next.breath = hostSim.time; T.toSpit = Math.max(1, T.toSpit);
  g.step(c.inhaleWarn + c.inhaleTime * 0.9);
  check(me.pos.z < z0 - 3, `the breath drags her toward the edge (${(z0 - me.pos.z).toFixed(1)} m)`);
  const z1 = me.pos.z;
  g.step(c.inhaleTime * 0.1 + 1.2);
  check(me.pos.z > z1 + 1, `...then blows her back (${(me.pos.z - z1).toFixed(1)} m)`);
  g.step(2);
  check(!me.shove, '...and it dies away');
}

// --- she can't walk through a titan (asleep or awake)
{
  const g = game(21);
  const { hostSim, me } = g;
  const T = hostSim.crustEgg.titans.research;
  const s = g.near(T.pos.x, T.pos.z, T.pos.y, 6);
  g.at(s.x, s.z, s.y); me.yaw = s.yaw; g.step(0.5);
  g.step(3, { moveY: 1 });   // walk straight at it
  const d = Math.hypot(me.pos.x - T.pos.x, me.pos.z - T.pos.z);
  check(d >= T.bulk + me.radius - 0.15, `the Warden's in her way (${d.toFixed(2)} m from its middle, it's ${(T.bulk + me.radius).toFixed(2)} round)`);
}

// --- the Glacier Golem: its frost nova slows her
{
  const g = game(31);
  const { hostSim, me, hp } = g;
  wakeTitan(hostSim, 'caves');
  const T = hostSim.crustEgg.titans.caves, c = hostSim.cfg.crust.egg.caves;
  g.step(hostSim.cfg.crust.egg.wakeTime.caves + 0.3);
  const s = g.near(T.pos.x, T.pos.z, T.pos.y, c.slamRange + 2);
  check(!!s, 'a spot on the Golem\'s ledge');
  // (the ice is slippery: she's put there just as it goes off)
  g.at(s.x, s.z, s.y); g.step(0.15);
  T.act = { kind: 'nova', t: c.novaWarn - 0.02 }; T.next.nova = 0;
  g.step(0.3);
  check(hp.slowUntil > hostSim.time, 'the host has her frozen');
  check(me.slowUntil > g.sim.time && me.slowMult === c.slow, `...and so does her copy (x${me.slowMult})`);
  g.step(c.slowTime + 0.5);
  check(!me.slowUntil || me.slowUntil < g.sim.time, '...till it wears off');
}

// --- Big Evil Zach: she can't walk through him, and his stomp throws her
{
  const g = game(41);
  const { hostSim, me } = g;
  startFinale(hostSim);
  const F = hostSim.crustEgg.finale, c = hostSim.cfg.crust.finale;
  g.step(c.descendTime + 0.5);
  check(F.state === 'fight', 'Zach is down in the pit');
  F.nextAt = hostSim.time + 99;
  const bulk = c.bulk * F.scale / c.scale[0];
  const s = g.near(F.pos.x, F.pos.z, F.pos.y, bulk + 3, hostSim.mapData.forge.anvil);
  check(!!s, 'a spot on the pit floor');
  g.at(s.x, s.z, s.y); me.yaw = s.yaw; g.step(0.3);
  g.step(2, { moveY: 1 });
  const d = Math.hypot(me.pos.x - F.pos.x, me.pos.z - F.pos.z);
  check(d >= bulk + me.radius - 0.15, `he's in her way (${d.toFixed(2)} m, he's ${(bulk + me.radius).toFixed(2)} round)`);
  // (he walks after her, so it's how far she went, out from where he stood)
  const p0 = { ...me.pos }, f0 = { ...F.pos };
  F.act = { kind: 'stomp', t: 0, warn: 0.2 };
  g.step(1.2);
  const r0 = Math.hypot(p0.x - f0.x, p0.z - f0.z), r1 = Math.hypot(me.pos.x - f0.x, me.pos.z - f0.z);
  check(r1 > r0 + 0.4 && me.kicks > 0, `his stomp throws her (${(r1 - r0).toFixed(1)} m)`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
