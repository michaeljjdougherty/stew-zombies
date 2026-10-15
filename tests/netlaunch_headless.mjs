// Call of the Crust online: a friend (not the host) flies off a launcher, lands
// on the other side, and has to wait out the recharge like everyone else; the
// Anvil's launchers are dead for them too until the power's on.
// Run: node tests/netlaunch_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG } from '../src/config.js';
import { NetHost } from '../src/net/host.js';
import { NetClient } from '../src/net/client.js';
import { LoopbackHub } from '../src/net/transport.js';
import { powerAllOn } from '../src/sim/crustPower.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

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
const me = sim.playerById('a');
const step = (secs, use = false) => {
  for (let i = 0; i < Math.round(secs * 60); i++) {
    hub.tick(); host.preStep();
    for (const p of hostSim.players) p.health = p.maxHealth;
    hostSim.setInput('h', { ...emptyCommand(), yaw: hostSim.playerById('h').yaw });
    hostSim.step(dt); host.postStep(hostSim.drainEvents());
    c.tick({ ...emptyCommand(), yaw: me.yaw, use, usePressed: use && i === 0 }, dt);
  }
};
const pads = hostSim.mapData.launchers, A = pads.find((p) => p.id === 'pad_hub_n'), B = pads.find((p) => p.id === 'pad_ship');
const stand = (pad) => { me.pos.x = pad.x + 0.3; me.pos.z = pad.z; me.pos.y = pad.y; me.vel.x = me.vel.y = me.vel.z = 0; };
step(2);
check(c.started && sim.replica, 'Ann has the host\'s world');

// the power's off: the launcher won't go
stand(A); step(0.5); step(0.2, true); step(1);
check(Math.hypot(me.pos.x - A.x, me.pos.z - A.z) < 2 && !me.launch, 'the power\'s off: Ann stays on the dead launcher');

// power on: she flies to the Ship Graveyard
powerAllOn(hostSim); step(0.5);
stand(A); step(0.5); step(0.2, true);
step(0.8);
check(!!me.launch && me.pos.y > A.y + 3, `Ann's in the air (y ${me.pos.y.toFixed(1)})`);
step(CONFIG.crust.launch.time + 1);
check(!me.launch && Math.hypot(me.pos.x - B.x, me.pos.z - B.z) < 2.5, `...and lands at the Ship Graveyard (${me.pos.x.toFixed(1)}, ${me.pos.z.toFixed(1)})`);
const hp = hostSim.playerById('a');
check(!hp.launch, 'the host has her landed too');

// straight back: it's recharging
step(0.3); stand(B); step(0.5); step(0.2, true); step(1);
check(!me.launch && Math.hypot(me.pos.x - B.x, me.pos.z - B.z) < 2.5, 'straight back on: the launcher\'s recharging, she stays put');
check(me.prompt && /recharging/.test(me.prompt.text), `...and she's told so ("${me.prompt && me.prompt.text}")`);
step(CONFIG.crust.launch.cooldown);
stand(B); step(0.5); step(0.2, true); step(0.8);
check(!!me.launch, 'after the recharge she can go again');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
