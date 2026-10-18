// GobbleGum online: a friend (not the host) brings their own pack, buys a gum
// from a machine (the host runs the machine; the friend sees it churn and the
// gum in the tray), chews it, and sets it off with [H] (the host does it).
// Their Megas come off their own career: the friend's copy hears its own
// 'gumDispensed'. Run: node tests/netgums_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG } from '../src/config.js';
import { NetHost } from '../src/net/host.js';
import { NetClient } from '../src/net/client.js';
import { LoopbackHub } from '../src/net/transport.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

const annGums = { pack: ['idleEyes', 'stockOption', 'swordFlay', 'coagulant', 'inPlainSight'], stock: { idleEyes: 1 } };
const hub = new LoopbackHub({ latency: 5, jitter: 3 });
const mk = () => { const s = new GameSim({ map: SCHOOL, seed: 4 }); s.addPlayer('h', 'Host'); s.addPlayer('a', 'Ann', { gums: annGums }); s.rounds.timer = 1e9; return s; };
const hostSim = mk();
hostSim.godMode = true;
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
hp.points = me.points = 50000;
const seen = [];
const step = (secs, cmd = {}) => {
  for (let i = 0; i < Math.round(secs * 60); i++) {
    hub.tick(); host.preStep();
    hostSim.setInput('h', { ...emptyCommand(), yaw: hostSim.playerById('h').yaw });
    hostSim.step(dt); host.postStep(hostSim.drainEvents());
    for (const e of c.tick({ ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...(i === 0 ? cmd : {}) }, dt)) seen.push(e);
  }
};
step(1);
check(c.started, 'Ann has the host\'s world');
check(hp.gumPack.join() === annGums.pack.join() && hp.gumStock.idleEyes === 1, 'the host has Ann\'s pack (and her one Idle Eyes)');

// to a machine, and buy
const m = hostSim.gums.machines[0];
const put = () => { me.pos.x = m.stand.x; me.pos.z = m.stand.z; me.pos.y = m.pos.y; me.vel.x = me.vel.y = me.vel.z = 0; me.yaw = Math.atan2(-(m.pos.x - me.pos.x), -(m.pos.z - me.pos.z)); };
put(); step(0.5);
check(me.prompt && /GobbleGum/.test(me.prompt.text) && me.prompt.cost === (CONFIG.gobblegum.costs[0] || null), `Ann sees the machine's prompt (${me.prompt && me.prompt.text})`);
put(); step(0.3, { use: true, usePressed: true });
step(0.3);
const cm = sim.gums.machines.find((q) => q.id === m.id);
check(cm.state === 'dispensing' && cm.buyerId === 'a', 'her copy sees it churning for her');
step(CONFIG.gobblegum.dispenseTime + 0.3);
check(cm.state === 'offering' && cm.gum === m.gum, `...then her gum in the tray (${cm.gum})`);
const gum = m.gum;
put(); step(0.3, { use: true, usePressed: true }); step(0.4);
check(hp.gum && hp.gum.id === gum && me.gum && me.gum.id === gum, 'she chews it (the host has it, and so does her copy)');
check(seen.some((e) => e.type === 'gumDispensed' && e.playerId === 'a'), 'her copy hears its own gumDispensed (her career takes off a Mega)');

// set one off with [H]: Idle Eyes, given to her by the host
hostSim.drainEvents();
const { chewGum } = await import('../src/sim/gums.js');
chewGum(hostSim, hp, 'idleEyes');
step(0.5);
check(me.gum && me.gum.id === 'idleEyes' && me.gum.uses === 3, 'her copy shows Idle Eyes (3 uses)');
step(0.3, { gumPressed: true }); step(0.4);
check(hp.gum.uses === 2 && hostSim.gums.idleUntil > hostSim.time && sim.gums.idleUntil > sim.time, '[H] on her copy: the host sets it off, and her copy knows');

// a gum that works on her own gun: Stock Option, read on her copy
chewGum(hostSim, hp, 'stockOption');
step(0.5);
const s = me.loadout.slots[me.loadout.current], clip = s.clip, res = s.reserve;
step(0.6);
step(0.1, { fire: true, firePressed: true }); step(0.2);
check(s.clip === clip && s.reserve === res - 1, `Stock Option on her own gun: from the stockpile (${clip}/${res} → ${s.clip}/${s.reserve})`);

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
