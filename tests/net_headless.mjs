// Online co-op over a fake network with lag: the host runs the game, two
// friends' copies move and shoot locally and mirror the rest.
// Run: node tests/net_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG } from '../src/config.js';
import { makeZombie } from '../src/sim/zombies.js';
import { giveWeapon } from '../src/sim/weapons.js';
import { NetHost } from '../src/net/host.js';
import { NetClient } from '../src/net/client.js';
import { LoopbackHub } from '../src/net/transport.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const ROSTER = [['h', 'Host', 'kearns'], ['a', 'Ann', 'ryan'], ['b', 'Bo', 'pit']];

function makeGame(seed = 11, latency = 5, jitter = 3) {
  const hub = new LoopbackHub({ latency, jitter });
  const mk = () => { const s = new GameSim({ map: SCHOOL, seed }); for (const [id, n, c] of ROSTER) s.addPlayer(id, n, { character: c }); return s; };
  const hostSim = mk();
  const H = hub.endpoint('H');
  const host = new NetHost(hostSim, (to, m) => H.send(to, m));
  H.onMessage = (from, m) => host.onMessage(from, m);
  const clients = {};
  for (const [peer, id] of [['A', 'a'], ['B', 'b']]) {
    const ep = hub.endpoint(peer);
    const sim = mk();
    const c = new NetClient(sim, id, (m) => ep.send('H', m));
    ep.onMessage = (from, m) => c.onMessage(m);
    hub.connect('H', peer);
    host.addRemote(peer, id);
    clients[id] = { sim, c, cmd: { ...emptyCommand(), yaw: sim.playerById(id).yaw }, log: [] };
  }
  const hostLog = [];
  const hist = [];   // host zombie positions by tick
  let hostCmd = { ...emptyCommand(), yaw: hostSim.playerById('h').yaw };
  const step = (n = 1, patch = {}) => {
    for (let i = 0; i < n; i++) {
      hub.tick();
      host.preStep();
      hostSim.setInput('h', hostCmd);
      hostSim.step(dt);
      const ev = hostSim.drainEvents();
      for (const e of ev) hostLog.push(e);
      host.postStep(ev);
      hist.push({ tick: hostSim.tick, z: new Map(hostSim.zombies.map((z) => [z.id, { ...z.pos }])) });
      if (hist.length > 120) hist.shift();
      for (const id in clients) {
        const C = clients[id];
        const cmd = { ...C.cmd, ...(patch[id] || {}) };
        for (const e of C.c.tick(cmd, dt)) C.log.push(e);
        // one-tick buttons
        C.cmd.firePressed = C.cmd.usePressed = C.cmd.jumpPressed = C.cmd.reloadPressed = C.cmd.meleePressed = false;
      }
    }
  };
  return { hub, hostSim, host, clients, hostLog, hist, step, setHostCmd: (c) => { hostCmd = c; } };
}

// --- 1. getting started; zombies mirror; moving
{
  const G = makeGame();
  const { hostSim, clients, step, hub, hist } = G;
  step(60 * 2);
  const A = clients.a;
  check(A.c.started && A.sim.replica, 'friend A has the host\'s world');
  // run the round in for a bit
  step(60 * 25);
  const hz = hostSim.zombies.length, az = A.sim.zombies.length;
  check(hz > 0 && Math.abs(hz - az) <= 2, `zombies mirror (host ${hz}, A ${az})`);
  // compare A's zombie positions with where the host had them `delay + lag` ago
  let worst = 0, n = 0;
  for (const z of A.sim.zombies) {
    let best = Infinity;
    for (const h of hist.slice(-30)) { const p = h.z.get(z.id); if (p) best = Math.min(best, Math.hypot(p.x - z.pos.x, p.z - z.pos.z)); }
    if (best < Infinity) { worst = Math.max(worst, best); n++; }
  }
  check(n > 0 && worst < 0.25, `A draws zombies on the host's recent path (${n} zombies, worst ${worst.toFixed(3)} m)`);
  // A walks forward; the host sees A move
  const ha = hostSim.playerById('a'), aa = A.sim.playerById('a');
  const start = { ...aa.pos };
  A.cmd.moveY = 1; step(60); A.cmd.moveY = 0; step(30);
  const moved = Math.hypot(aa.pos.x - start.x, aa.pos.z - start.z);
  check(moved > 2, `A moved locally (${moved.toFixed(2)} m)`);
  check(Math.hypot(ha.pos.x - aa.pos.x, ha.pos.z - aa.pos.z) < 0.05, 'the host has A where A is');
  const B = clients.b;
  const ba = B.sim.playerById('a');
  check(Math.hypot(ba.pos.x - aa.pos.x, ba.pos.z - aa.pos.z) < 0.05, 'and so does B');
  const secs = hostSim.time;
  console.log(`     traffic: ${(hub.bytes / secs / 1024).toFixed(1)} KB/s total for 2 friends over ${secs.toFixed(0)} s`);
}

// --- 2. A shoots a zombie: the host kills it and pays A
{
  const G = makeGame(12);
  const { hostSim, clients, step, hostLog } = G;
  step(60);
  hostSim.rounds.timer = 1e9; hostSim.rounds.phase = 'intermission';
  for (const z of hostSim.zombies) z.state = 'dead';
  const A = clients.a, B = clients.b;
  const ha = hostSim.playerById('a'), aa = A.sim.playerById('a');
  const z = makeZombie(hostSim, { pos: { x: aa.pos.x, z: aa.pos.z - 6 }, health: 100, state: 'chase' });
  z.speed = 0; hostSim.zombies.push(z);
  step(40);
  const az = A.sim.zombies.find((q) => q.id === z.id);
  check(!!az, 'the new zombie shows up for A');
  const pts0 = ha.points;
  // aim at its chest
  const aim = () => { const dx = az.pos.x - aa.pos.x, dz = az.pos.z - aa.pos.z; A.cmd.yaw = Math.atan2(-dx, -dz); A.cmd.pitch = Math.atan2(az.pos.y + 1.2 - (aa.pos.y + CONFIG.player.eyeHeight), Math.hypot(dx, dz)); };
  for (let i = 0; i < 12 && z.state !== 'dead' && hostSim.zombies.includes(z); i++) { aim(); step(1, { a: { fire: true, firePressed: true } }); step(14); }
  step(20);
  check(!hostSim.zombies.includes(z), 'the host\'s zombie died from A\'s shots');
  check(ha.points > pts0 && hostLog.some((e) => e.type === 'zombieKilled' && e.playerId === 'a'), `A got the kill and points (${pts0} -> ${ha.points})`);
  check(aa.points === ha.points, 'A\'s own copy shows the points');
  check(!A.sim.zombies.some((q) => q.id === z.id), 'and the zombie is gone for A');
  check(B.log.some((e) => e.type === 'shot' && e.playerId === 'a' && e.echo), 'B saw A\'s shots');
  check(!A.log.some((e) => e.echo && e.playerId === 'a'), 'A doesn\'t get its own shots back');
  check(A.log.some((e) => e.type === 'zombieKilled'), 'A hears about the kill');
  const clipA = aa.loadout.slots[0].clip, clipH = ha.loadout.slots[0].clip;
  check(clipA === clipH && clipA < CONFIG.weapons[aa.loadout.slots[0].id].magSize, `ammo agrees (${clipA}/${clipH})`);
}

// --- 2b. A's knife and grenade go through the host
{
  const G = makeGame(14);
  const { hostSim, clients, step, hostLog } = G;
  step(60);
  hostSim.rounds.timer = 1e9; hostSim.rounds.phase = 'intermission';
  for (const z of hostSim.zombies) z.state = 'dead';
  const A = clients.a, aa = A.sim.playerById('a');
  const z = makeZombie(hostSim, { pos: { x: aa.pos.x, z: aa.pos.z - 1.3 }, health: 40, state: 'chase' });
  z.speed = 0; hostSim.zombies.push(z);
  step(40);
  A.cmd.yaw = Math.atan2(-(z.pos.x - aa.pos.x), -(z.pos.z - aa.pos.z)); A.cmd.pitch = 0;
  step(2);
  step(1, { a: { meleePressed: true } }); step(40);
  check(hostLog.some((e) => e.type === 'zombieKilled' && e.playerId === 'a'), 'A\'s knife kills the host\'s zombie');
  const g0 = aa.grenades;
  step(1, { a: { grenade: true, grenadePressed: true } }); step(1);
  step(20); step(1, { a: { grenade: false } }); step(25);
  check(hostSim.projectiles.some((p) => p.type === 'frag' && p.ownerId === 'a') || hostLog.some((e) => e.type === 'projectileSpawn' && e.ownerId === 'a'), 'A\'s grenade flies on the host');
  check(A.sim.projectiles.some((p) => p.type === 'frag'), 'and A sees it');
  step(60 * 4);
  check(aa.grenades === g0 - 1 && hostSim.playerById('a').grenades === g0 - 1, `one grenade used (${aa.grenades}/${hostSim.playerById('a').grenades})`);
  check(hostLog.some((e) => e.type === 'explosion'), 'it went off');
}

// --- 3. A uses the box; the gun arrives in A's hands
{
  const G = makeGame(13);
  const { hostSim, clients, step, hostLog } = G;
  step(60);
  hostSim.rounds.timer = 1e9; hostSim.rounds.phase = 'intermission';
  for (const z of hostSim.zombies) z.state = 'dead';
  const A = clients.a;
  const ha = hostSim.playerById('a'), aa = A.sim.playerById('a');
  ha.points = 5000;
  const box = hostSim.box;
  hostSim.box.pick = () => 'Pyton';
  aa.pos.x = box.stand.x; aa.pos.z = box.stand.z;
  A.cmd.yaw = Math.atan2(-(box.pos.x - aa.pos.x), -(box.pos.z - aa.pos.z)); A.cmd.pitch = -0.2;
  step(30);
  check(!!(aa.prompt && /box|Box|Mystery|\d/.test(aa.prompt.text || '')), 'A sees the box prompt from the host: ' + (aa.prompt && aa.prompt.text));
  step(1, { a: { use: true, usePressed: true } }); step(30);
  check(hostSim.box.phase === 'spinning' && hostSim.box.buyerId === 'a', 'the host\'s box spins for A');
  check(A.sim.box.phase === 'spinning', 'A sees it spin');
  step(60 * (CONFIG.box.spinTime + 0.3));
  step(1, { a: { use: true, usePressed: true } }); step(30);
  check(ha.loadout.slots.some((s) => s.id === 'Pyton'), 'the host gave A the gun');
  check(aa.loadout.slots.some((s) => s.id === 'Pyton') && aa.loadout.slots[aa.loadout.current].id === 'Pyton', 'A is holding it');
  check(aa.points === ha.points && ha.points < 5000, `A paid (${ha.points})`);
  // A fires the new gun: the host's copy agrees on ammo afterwards
  A.cmd.pitch = 0;
  step(60);
  step(1, { a: { fire: true, firePressed: true } }); step(30);
  const sa = aa.loadout.slots[aa.loadout.current], sh = ha.loadout.slots[ha.loadout.current];
  check(sa.id === sh.id && sa.clip === sh.clip && sa.clip === CONFIG.weapons.Pyton.magSize - 1, `ammo after a shot agrees (${sa.clip}/${sh.clip})`);
  // host-side: B gets a wall gun; B's copy adopts it
  const B = clients.b, hb = hostSim.playerById('b'), bb = B.sim.playerById('b');
  giveWeapon(hostSim, hb, 'M15'); step(30);
  check(bb.loadout.slots.some((s) => s.id === 'M15'), 'B gets a gun the host handed over');
  // A goes down: the host decides, A's copy follows
  hostSim.damagePlayer(ha, 1e4, null); step(30);
  check(!!aa.downed && CONFIG.weapons[aa.loadout.slots[aa.loadout.current].id].class === 'pistol', 'A goes down with a pistol on A\'s screen');
  check(B.log.some((e) => e.type === 'playerDown' && e.playerId === 'a'), 'B hears A went down');
  // B walks over and holds [F] on A
  bb.pos.x = aa.pos.x + 0.8; bb.pos.z = aa.pos.z;
  step(20);
  check(!!(bb.prompt && /revive/.test(bb.prompt.text)), 'B gets the revive prompt: ' + (bb.prompt && bb.prompt.text));
  B.cmd.use = true;
  step(60 * (CONFIG.lastStand.reviveTime + 1));
  B.cmd.use = false;
  step(30);
  check(!ha.downed && !aa.downed, 'B picked A up');
  check(aa.loadout.slots.some((s) => s.id === 'Pyton'), 'A has the box gun back');
  void hostLog;
}

// --- 4. bleeding out, coming back next round, someone leaving
{
  const G = makeGame(15);
  const { hostSim, clients, step, host } = G;
  step(60);
  const A = clients.a, B = clients.b;
  const ha = hostSim.playerById('a'), aa = A.sim.playerById('a');
  hostSim.damagePlayer(ha, 1e4, null); step(10);
  ha.downed.bleed = 0.05; step(40);
  check(!ha.alive && !aa.alive, 'A bled out (on A\'s screen too)');
  const before = { x: aa.pos.x, z: aa.pos.z };
  // next round
  for (const z of hostSim.zombies) z.state = 'dead';
  hostSim.rounds.toSpawn = 0; hostSim.rounds.phase = 'intermission'; hostSim.rounds.timer = 0.1;
  step(60 * 3);
  check(ha.alive && aa.alive && !aa.downed, `A is back for round ${hostSim.rounds.round}`);
  check(aa.loadout.slots.length === 1 && aa.loadout.slots[0].id === CONFIG.startingWeapon, 'with the starting pistol');
  const hb = hostSim.playerById('b');
  check(Math.hypot(aa.pos.x - hb.pos.x, aa.pos.z - hb.pos.z) < 2.5 && Math.hypot(ha.pos.x - aa.pos.x, ha.pos.z - aa.pos.z) < 0.05, `next to a teammate, on both screens (moved ${Math.hypot(aa.pos.x - before.x, aa.pos.z - before.z).toFixed(1)} m)`);
  // B leaves mid-game
  host.removeRemote('B');
  hostSim.players = hostSim.players.filter((p) => p.id !== 'b');
  hostSim.emit('playerLeft', { playerId: 'b', name: 'Bo' });
  step(30);
  check(!A.sim.playerById('b'), 'B is gone from A\'s game');
  check(A.log.some((e) => e.type === 'playerLeft'), 'and A heard about it');
  void B;
}

process.exit(fails ? 1 : 0);
