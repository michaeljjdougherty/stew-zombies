// A titan fight: once it's awake, its island's launcher is locked down (no
// flying off mid-fight) till it's beaten; the rest of the launchers still go.
// Run: node tests/launchlock_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { powerAllOn } from '../src/sim/crustPower.js';
import { wakeTitan } from '../src/sim/crustEgg.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const sim = new GameSim({ map: CRUST, seed: 9 });
const me = sim.addPlayer('p1', 'T', { character: 'kearns' });
me.health = me.maxHealth = 1e7; me.points = 1e6;
const step = (n, c = {}) => { for (let i = 0; i < n; i++) { me.health = me.maxHealth; sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, ...c }); sim.step(dt); } };
powerAllOn(sim); step(10);
const pad = (id) => sim.mapData.launchers.find((q) => q.id === id);
const stand = (q) => { me.pos.x = q.x + 0.3; me.pos.z = q.z; me.pos.y = q.y; me.launch = null; me.launchReady = 0; };

stand(pad('pad_ship')); step(5);
check(/launch/.test(me.prompt && me.prompt.text), `before the fight: "${me.prompt && me.prompt.text}"`);
wakeTitan(sim, 'ship', me); step(5);
check(/locked/.test(me.prompt && me.prompt.text), `the titan's awake: "${me.prompt && me.prompt.text}" (${me.prompt && me.prompt.sub})`);
step(1, { use: true, usePressed: true }); step(30);
check(!me.launch && Math.hypot(me.pos.x - pad('pad_ship').x, me.pos.z - pad('pad_ship').z) < 2, '...pressing F: you stay put');
stand(pad('pad_research')); step(5); step(1, { use: true, usePressed: true }); step(10);
check(!!me.launch, 'another island\'s launcher still flies');
step(60 * 6);
// beaten: it's unlocked
const T = sim.crustEgg.titans.ship;
T.state = 'dead'; sim.crustEgg.active = null;
stand(pad('pad_ship')); step(5);
check(/launch/.test(me.prompt && me.prompt.text), `beaten: unlocked ("${me.prompt && me.prompt.text}")`);
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
