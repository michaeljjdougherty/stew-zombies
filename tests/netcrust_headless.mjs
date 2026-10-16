// Call of the Crust online (beta): a friend (not the host) does the map's things
// over a laggy fake network: pulls a relay and hands it to Pit, rides a
// zipline, finds hammer parts and puts them on the stand, takes a War Hammer
// and smashes zombies with it; and hears the crew. Plus the lobby picking the map.
// Run: node tests/netcrust_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG } from '../src/config.js';
import { NetHost } from '../src/net/host.js';
import { NetClient } from '../src/net/client.js';
import { LoopbackHub } from '../src/net/transport.js';
import { OnlineSession } from '../src/net/online.js';
import { powerAllOn } from '../src/sim/crustPower.js';
import { makeZombie } from '../src/sim/zombies.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

// --- the lobby: the host picks the map; Pit's not playable on the Crust
{
  const S = new OnlineSession({ name: 'Host', character: 'pit' });
  S.role = 'host'; S.you = 'p1'; S.code = 'TEST';
  S.members = [{ id: 'p1', peer: null, name: 'Host', character: 'pit', brian: false }, { id: 'p2', peer: 'x', name: 'Ann', character: 'ryan', brian: false }];
  S.ep = { send: () => {} };
  let lobby = null; S.o.onLobby = (l) => { lobby = l; };
  check(S.lobby().map === 'lastbell', 'a new lobby is on The Last Bell');
  S.setMap('crust');
  check(lobby && lobby.map === 'crust', 'the host picks Call of the Crust');
  check(S.members[0].character !== 'pit' && S.members[0].character && S.members[0].character !== 'ryan', `...the host, who was Pit, is moved to someone free (${S.members[0].character})`);
  check(!S.canPlay('pit', S.members[1]), '...and nobody can pick Pit there');
  let started = null; S.o.onStart = (st) => { started = st; };
  S.start(5);
  check(started && started.map === 'crust', 'the game starts on the Crust');
}

// --- in the game
const hub = new LoopbackHub({ latency: 5, jitter: 3 });
const mk = () => { const s = new GameSim({ map: CRUST, seed: 4 }); s.addPlayer('h', 'Host', { character: 'kearns' }); s.addPlayer('a', 'Ann', { character: 'ryan' }); return s; };
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
const me = sim.playerById('a'), hp = hostSim.playerById('a');
hostSim.godMode = true;   // (nobody goes down: this is about the map's things working online)
const heard = [];
const step = (secs, cmd = {}) => {
  for (let i = 0; i < Math.round(secs * 60); i++) {
    hub.tick(); host.preStep();
    for (const p of hostSim.players) p.health = p.maxHealth;
    hostSim.setInput('h', { ...emptyCommand(), yaw: hostSim.playerById('h').yaw });
    hostSim.step(dt); host.postStep(hostSim.drainEvents());
    for (const e of c.tick({ ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...cmd, usePressed: !!cmd.use && i === 0, firePressed: !!cmd.fire && i === 0 }, dt)) heard.push(e);
  }
};
const at = (x, z, y) => { me.pos.x = x; me.pos.z = z; me.pos.y = y; me.vel.x = me.vel.y = me.vel.z = 0; };
step(3);
check(c.started && sim.replica, 'Ann has the host\'s world');

// a relay: pulled from its junction box, given to Pit
const R = hostSim.mapData.relays[0];
at(R.x + R.normal.x * 0.8, R.z + R.normal.z * 0.8, R.y); step(0.5); step(0.3, { use: true }); step(0.5);
check(hostSim.crustEgg.power.relays[R.id].state === 'carried' && hostSim.crustEgg.power.relays[R.id].by === 'a', 'Ann pulls a relay');
check(sim.crustEgg.power.relays[R.id].by === 'a', '...and her copy knows she has it');
const bench = hostSim.mapData.forge.bench;
at((bench[0] + bench[2]) / 2 + 1.2, (bench[1] + bench[3]) / 2, hostSim.mapData.forge.y || 0); step(0.5); step(0.3, { use: true }); step(0.5);
check(hostSim.crustEgg.power.relays[R.id].state === 'given', '...hands it to Pit');

// the rest on: a zipline
powerAllOn(hostSim); step(0.5);
const zip = hostSim.rides.find((r) => r.kind === 'zip');
const top = zip.pts[0];
at(top.x, top.z, top.y - CONFIG.crust.ride.hang); step(0.6); step(0.3, { use: true });
step(0.6);
check(!!me.ride && me.ride.id === zip.id, `Ann grabs the zipline (${zip.id})`);
step(zip.len / CONFIG.crust.ride.zipSpeed + 3);
const end = zip.pts[zip.pts.length - 1];
check(!me.ride && Math.hypot(me.pos.x - end.x, me.pos.z - end.z) < 4, `...rides it all the way down (${me.pos.x.toFixed(1)}, ${me.pos.z.toFixed(1)})`);
check(!hp.ride, '...and the host has her off it too');
at(top.x, top.z, top.y - CONFIG.crust.ride.hang); step(1.2); step(0.3, { use: true }); step(0.6);
check(!!me.ride, '...and can ride it again');
step(zip.len / CONFIG.crust.ride.zipSpeed + 3);

// the hammer's parts: found, carried, put on the stand
const F = hostSim.crustEgg.forge, st = hostSim.mapData.forge.stand, FY = hostSim.mapData.forge.y || 0;
for (const [id, k] of Object.entries(F.parts)) {
  at(k.x + 0.5, k.z, k.y + 0.2); step(0.8);
  check(F.parts[id].state === 'carried' && F.parts[id].by === 'a', `Ann picks up the ${id}`);
  at(st.x + 1.2, st.z, FY); step(0.5); step(0.3, { use: true }); step(0.5);
}
check(Object.values(F.parts).every((k) => k.state === 'placed'), 'all four on the stand');
check(Object.values(sim.crustEgg.forge.parts).every((k) => k.state === 'placed'), '...her copy sees them there');
step(0.3, { use: true }); step(1);
check(me.loadout.slots.some((s) => s.id === 'War Hammer'), 'Ann takes a War Hammer');

// a swing: wound up, lands, the host smashes the zombies in front of her
at(st.x + 1.2, st.z, FY); me.yaw = 0; me.pitch = 0;
const w = me.loadout.slots.findIndex((s) => s.id === 'War Hammer');
step(1.2, { weaponSlot: w });
const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
const zs = [0, 1, 2].map((i) => makeZombie(hostSim, { type: 'walker', pos: { x: me.pos.x + fx * 1.8 + (i - 1) * 0.6, y: me.pos.y, z: me.pos.z + fz * 1.8 }, health: 500, state: 'chase' }));
for (const z of zs) { z.speed = 0; hostSim.zombies.push(z); }
step(0.2); step(0.1, { fire: true }); step(0.8);
check(zs.every((z) => z.state === 'dead'), `her swing lands on the host: ${zs.filter((z) => z.state === 'dead').length} of 3 smashed`);

check(heard.some((e) => e.type === 'crewSays' && e.who === 'pit') && heard.some((e) => e.type === 'schnitzSays'), `all along she hears the Schnitz and Pit (${heard.filter((e) => e.type === 'crewSays' || e.type === 'schnitzSays').length} lines)`);

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
