// Call of the Crust: the War Hammers' trials (src/sim/hammerTrials.js). Each
// element earns its "+" on its own island, then Pit tempers it for free. And a
// friend online can do one.
// Run: node tests/trials_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { makeZombie } from '../src/sim/zombies.js';
import { giveWeapon } from '../src/sim/weapons.js';
import { revive } from '../src/sim/laststand.js';
import { forgeAllNow } from '../src/sim/forge.js';
import { powerAllOn } from '../src/sim/crustPower.js';
import { groundHeight } from '../src/sim/physics.js';
import { NetHost } from '../src/net/host.js';
import { NetClient } from '../src/net/client.js';
import { LoopbackHub } from '../src/net/transport.js';
import { CONFIG } from '../src/config.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const FS = CRUST.forge;

function game(seed = 5) {
  const sim = new GameSim({ map: CRUST, seed });
  powerAllOn(sim);
  const me = sim.addPlayer('p1', 'Tester', { character: 'kearns' });
  sim.rounds.timer = 1e9;
  me.health = me.maxHealth = 1e6;
  const log = [];
  const step = (patch = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch });
      sim.step(dt);
      for (const e of sim.drainEvents()) log.push(e);
    }
  };
  const put = (x, z, y = null, lookAt = null) => {
    me.pos.x = x; me.pos.z = z; me.pos.y = (y ?? groundHeight(x, z, 0.3, 60, [sim.world.solids, sim.world.terrain])) + 0.02;
    me.vel.x = me.vel.y = me.vel.z = 0; me.region = null;
    if (lookAt) me.yaw = Math.atan2(-(lookAt.x - x), -(lookAt.z - z));
    me.pitch = 0;
    step({}, 3);
  };
  const use = () => { step({ use: true, usePressed: true }); step({}, 2); };
  const swing = () => { step({ fire: true, firePressed: true }); step({}, Math.ceil(CONFIG.crust.hammers.charged.every * 60) + 2); };   // (a charged slam, then the wait till the next)
  const E = () => sim.crustEgg;
  // all four forged; take this element's hammer from its socket
  const take = (el) => {
    const s = FS.sockets[el], k = Math.hypot(s.x, s.z);
    giveWeapon(sim, me, 'War Hammer'); step({}, 40);
    me.pos.x = s.x / k * 3.75; me.pos.z = s.z / k * 3.75; me.pos.y = FS.y + 0.02; me.yaw = Math.atan2(-(s.x - me.pos.x), -(s.z - me.pos.z)); step({}, 2);
    use(); step({}, 40);
  };
  const bench = () => { me.pos.x = (FS.bench[0] + FS.bench[2]) / 2 + 1.6; me.pos.z = (FS.bench[1] + FS.bench[3]) / 2; me.pos.y = FS.y + 0.02; me.yaw = Math.atan2(-(FS.pit.x - me.pos.x), -(FS.pit.z - me.pos.z)); step({}, 2); };
  forgeAllNow(sim); step({}, 2);
  return { sim, me, log, step, put, use, swing, take, bench, E };
}
const tempered = (g, el) => { g.bench(); g.use(); g.step({}, 60 * (CONFIG.crust.forge.temperTime + 1)); return g.me.loadout.slots.some((s) => s.id === `${el[0].toUpperCase() + el.slice(1)} Hammer+`); };

// --- they open once the hammers are forged
{
  const g = game();
  const T = g.E().trials;
  check(['wind', 'lightning', 'ice', 'fire'].every((el) => T[el].state === 'open'), 'all four trials open once the hammers are forged');
  check(g.log.filter((e) => e.type === 'trialOpen').length === 4, '...one for each');
}

// --- Wind: hit the three buoys off the north shore
{
  const g = game(6);
  g.take('wind');
  check(g.me.loadout.slots[g.me.loadout.current].id === 'Wind Hammer', 'take the Wind Hammer');
  const T = g.E().trials.wind;
  check(T.buoys.length === 3 && T.buoys.every((b) => groundHeight(b.x, b.z, 0.3, 60, [g.sim.world.solids, g.sim.world.terrain]) < -100), `three buoys out over the void (${T.buoys.map((b) => `${b.x.toFixed(0)},${b.z.toFixed(0)}`).join(' ')})`);
  for (const b of T.buoys) {
    g.put(b.x, b.z + CONFIG.crust.trials.wind.out, null, b);
    g.swing();
  }
  check(T.buoys.every((b) => b.hit) && T.state === 'done' && g.log.some((e) => e.type === 'trialDone' && e.element === 'wind'), 'a swing at each from the shore: done');
  check(tempered(g, 'wind'), 'Pit tempers it, for nothing');
}

// --- Lightning: every coil inside the time, then slam by one
{
  const g = game(7);
  g.take('lightning');
  const coils = g.E().coils, c = CONFIG.crust.trials.lightning;
  const charge = (k) => { g.put(k.con.x, k.con.z + 0.2); g.step({ use: true }, Math.round((CONFIG.crust.egg.research.charge + 0.3) / dt)); };
  charge(coils[0]);
  check(coils[0].ready && g.E().trials.lightning.until > 0, 'a coil charges (no Warden needed): the clock starts');
  // too slow: they go dead
  g.step({}, Math.round((c.time + 1) / dt));
  check(!coils.some((k) => k.ready) && g.log.some((e) => e.type === 'trialFailed'), 'run out of time and they go dead');
  for (const k of coils) charge(k);
  check(coils.every((k) => k.ready), `all ${coils.length} charged in time`);
  const k = coils[0];
  g.put(k.con.x, k.con.z + 0.2, null, k);
  g.swing();
  check(g.E().trials.lightning.state === 'done', 'slam it down by a coil: done');
  check(tempered(g, 'lightning'), 'Pit tempers it');
}

// --- Ice: freeze them in the Ice Caves, then the shrine
{
  const g = game(8);
  g.take('ice');
  const T = g.E().trials.ice, c = CONFIG.crust.trials.ice;
  // on the island, with zombies round you
  g.put(-152, 0, 2);
  let guard = 0;
  while (T.count < c.count && guard++ < 12) {
    for (let i = 0; i < 8; i++) { const z = makeZombie(g.sim, { type: 'walker', pos: { x: g.me.pos.x + Math.cos(i) * 3, y: g.me.pos.y, z: g.me.pos.z + Math.sin(i) * 3 }, health: 1e5, state: 'chase' }); z.speed = 0; g.sim.zombies.push(z); }
    g.step({}, 2); g.swing();
  }
  check(T.count >= c.count, `freeze ${c.count} in the Ice Caves (${T.count}, ${guard} swings)`);
  check(T.state === 'open', '...not done yet: the shrine');
  g.put(T.shrine.x + 2, T.shrine.z, T.shrine.y, T.shrine);
  g.swing();
  check(T.state === 'done', 'smash the shrine: done');
  check(tempered(g, 'ice'), 'Pit tempers it');
}

// --- Fire: through the craters without going down
{
  const g = game(9);
  g.sim.addPlayer('p2', 'Friend', { character: 'ryan' });   // (so going down isn't the end)
  g.take('fire');
  const T = g.E().trials.fire, c = CONFIG.crust.trials.fire;
  const into = (k) => { g.me.pos.x = k.x; g.me.pos.z = k.z; g.me.pos.y = k.y + 0.05; g.step({}, 3); };
  into(T.craters[0]); into(T.craters[1]);
  check(T.craters.filter((k) => k.lit).length === 2, 'two craters lit');
  // go down: they go out
  g.sim.damagePlayer(g.me, 2e6, { pos: g.me.pos }); g.step({}, 3);
  check(g.me.downed && !T.craters.some((k) => k.lit), 'go down and they go out');
  revive(g.sim, g.me, 'p2'); g.me.health = g.me.maxHealth; g.step({}, 40);
  const fh = g.me.loadout.slots.findIndex((sl) => sl.id === 'Fire Hammer'); if (fh >= 0) g.me.loadout.current = fh;
  check(g.me.loadout.slots.some((sl) => sl.id === 'Fire Hammer'), '...picked up, the hammer\'s still yours');
  for (const k of T.craters.slice(0, c.craters)) into(k);
  check(T.state === 'done', `${c.craters} craters, still standing: done`);
  check(tempered(g, 'fire'), 'Pit quenches it');
}

// --- online: a friend does the Wind trial; the host counts it
{
  const hub = new LoopbackHub({ latency: 4, jitter: 2 });
  const mk = () => { const s = new GameSim({ map: CRUST, seed: 10 }); s.addPlayer('h', 'Host', { character: 'kearns' }); s.addPlayer('a', 'Ann', { character: 'ryan' }); powerAllOn(s); return s; };
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
  hostSim.godMode = true;
  const me = sim.playerById('a');
  const step = (secs, cmd = {}) => {
    for (let i = 0; i < Math.round(secs * 60); i++) {
      hub.tick(); host.preStep();
      hostSim.setInput('h', { ...emptyCommand() });
      hostSim.step(dt); host.postStep(hostSim.drainEvents());
      c.tick({ ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...cmd, usePressed: !!cmd.use && i === 0, firePressed: !!cmd.fire && i === 0 }, dt);
    }
  };
  forgeAllNow(hostSim); step(1);
  // her War Hammer, then the Wind Hammer from its socket
  giveWeapon(hostSim, hostSim.playerById('a'), 'War Hammer'); step(1);
  const s = FS.sockets.wind, k = Math.hypot(s.x, s.z);
  me.pos.x = s.x / k * 3.75; me.pos.z = s.z / k * 3.75; me.pos.y = FS.y + 0.02; me.yaw = Math.atan2(-(s.x - me.pos.x), -(s.z - me.pos.z)); me.pitch = 0;
  step(0.5); step(0.2, { use: true }); step(1);
  check(me.loadout.slots[me.loadout.current].id === 'Wind Hammer', 'Ann takes the Wind Hammer');
  const T = hostSim.crustEgg.trials.wind;
  for (const b of T.buoys) {
    me.pos.x = b.x; me.pos.z = b.z + CONFIG.crust.trials.wind.out; me.pos.y = groundHeight(me.pos.x, me.pos.z, 0.3, 60, [sim.world.solids, sim.world.terrain]) + 0.02;
    me.vel.x = me.vel.y = me.vel.z = 0; me.yaw = Math.atan2(-(b.x - me.pos.x), -(b.z - me.pos.z));
    step(0.4); step(0.1, { fire: true }); step(CONFIG.crust.hammers.charged.every);
  }
  check(T.state === 'done', `her swings count on the host (${T.buoys.filter((b) => b.hit).length} of 3)`);
  check(sim.crustEgg.trials.wind.state === 'done', '...and her copy knows');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
