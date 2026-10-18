// Reviving online, over a fake network with lag: friends picking each other
// up, picking up the host and being picked up by them, on both maps,
// including high up on the Crust (the Anvil's top is 9 m up), and next to
// something else you could buy.
// Run: node tests/revive_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG } from '../src/config.js';
import { NetHost } from '../src/net/host.js';
import { NetClient } from '../src/net/client.js';
import { LoopbackHub } from '../src/net/transport.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const ROSTER = [['h', 'Host', 'kearns'], ['a', 'Ann', 'ryan'], ['b', 'Bo', 'pit']];

function makeGame(map, seed = 11) {
  const hub = new LoopbackHub({ latency: 5, jitter: 3 });
  const mk = () => { const s = new GameSim({ map, seed }); for (const [id, n, c] of ROSTER) s.addPlayer(id, n, { character: c }); return s; };
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
    clients[id] = { sim, c, cmd: { ...emptyCommand(), yaw: sim.playerById(id).yaw } };
  }
  const hostCmd = { ...emptyCommand(), yaw: hostSim.playerById('h').yaw };
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      hub.tick();
      host.preStep();
      hostSim.setInput('h', hostCmd);
      hostSim.step(dt);
      host.postStep(hostSim.drainEvents());
      for (const id in clients) { const C = clients[id]; C.c.tick({ ...C.cmd }, dt); C.cmd.usePressed = false; }
    }
  };
  // someone's own copy of themselves, and the command they're sending
  const own = (id) => (id === 'h' ? { sim: hostSim, cmd: hostCmd } : clients[id]);
  return { hostSim, clients, step, own };
}

// `downId` goes down at `spot`; `upId` walks up beside them and holds [F]
function tryRevive(map, downId, upId, spot = null, beside = { x: 0.8, z: 0 }) {
  const G = makeGame(map);
  const { hostSim, step, own } = G;
  step(60);
  if (spot) {
    for (const id of [downId, upId]) {
      const o = own(id).sim.playerById(id);
      Object.assign(o.pos, spot); o.vel.x = o.vel.y = o.vel.z = 0;
    }
    step(60);
  }
  hostSim.damagePlayer(hostSim.playerById(downId), 1e4, null);
  step(30);
  const U = own(upId), u = U.sim.playerById(upId), d = U.sim.playerById(downId);
  u.pos.x = d.pos.x + beside.x; u.pos.z = d.pos.z + beside.z; u.pos.y = d.pos.y + (beside.y || 0);
  if (beside.yaw != null) U.cmd.yaw = u.yaw = beside.yaw;
  step(20);
  const prompt = u.prompt ? u.prompt.text : '';
  U.cmd.use = true; U.cmd.usePressed = true;
  step(60 * (CONFIG.lastStand.reviveTime + 0.5));
  U.cmd.use = false;
  step(30);
  const hd = hostSim.playerById(downId), mine = own(downId).sim.playerById(downId);
  return { prompt, up: hd.alive && !hd.downed && !mine.downed, G };
}

const name = (id) => ROSTER.find((r) => r[0] === id)[1];
const anvil = (() => { const pad = CRUST.launchers.find((q) => q.id === 'pad_hub_n'); return { x: pad.x + 3, y: pad.y + 0.5, z: pad.z }; })();
for (const [mapName, map, spot] of [['the school', SCHOOL, null], ['the Crust', CRUST, null], ['the top of the Anvil', CRUST, anvil]]) {
  for (const [downId, upId] of [['a', 'b'], ['h', 'a'], ['a', 'h']]) {
    const r = tryRevive(map, downId, upId, spot);
    check(/revive/.test(r.prompt), `${mapName}: ${name(upId)} gets the revive prompt for ${name(downId)} (${r.prompt || 'none'})`);
    check(r.up, `${mapName}: ${name(upId)} picks ${name(downId)} up`);
  }
}

// next to a perk machine (and the gum machine beside it): the revive still wins
{
  const sim0 = new GameSim({ map: SCHOOL, seed: 11 });
  const m = sim0.world.perkMachines[0];
  // (A goes down a step to the side; B stands right at the machine, facing it)
  const out = { x: m.front.x - m.center.x, z: m.front.z - m.center.z }, l = Math.hypot(out.x, out.z);
  const side = { x: -out.z / l * 1.2, z: out.x / l * 1.2 };
  const spot = { x: m.front.x + side.x, y: 0, z: m.front.z + side.z };
  const r = tryRevive(SCHOOL, 'a', 'b', spot, { x: -side.x, z: -side.z, yaw: Math.atan2(out.x, out.z) });
  check(/revive/.test(r.prompt), `beside a perk machine, the revive comes first (${r.prompt || 'none'})`);
  check(r.up, 'and B picks A up there');
}

// a floor below them on the Crust: no reviving through the floor
{
  const r = tryRevive(CRUST, 'a', 'b', anvil, { x: 0.5, z: 0, y: -8 });
  check(!/revive/.test(r.prompt), `from 8 m below, no revive prompt (${r.prompt || 'none'})`);
}

process.exit(fails ? 1 : 0);
