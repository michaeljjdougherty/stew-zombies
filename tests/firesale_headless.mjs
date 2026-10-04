// Clearance Sale: a box at every box spot while it lasts, all usable, and they
// go away (after finishing a pull) when it ends.
// Run: node tests/firesale_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { worldState, applyMirror } from '../src/net/state.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const sim = new GameSim({ map: SCHOOL, seed: 3 });
const me = sim.addPlayer('p1', 'T');
me.maxHealth = me.health = 1e6; me.points = 50000;
sim.rounds.phase = 'test';
const step = (n, patch = {}) => { const ev = []; for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch }); sim.step(dt); ev.push(...sim.drainEvents()); } return ev; };

check(sim.saleBoxes.length === SCHOOL.boxSpots.length, `a sale box for each of ${SCHOOL.boxSpots.length} spots`);
step(10);
check(sim.saleBoxes.every((b) => b.phase === 'gone'), 'none out before the sale');
const solidsBefore = sim.world.solids.length;

sim.box.totalUses = 1;
sim.powerups.active.clearanceSale = sim.cfg.powerups.duration;
let ev = step(Math.ceil((sim.cfg.box.arriveTime + 0.2) / dt));
const out = sim.saleBoxes.filter((b) => b.phase !== 'gone');
check(out.length === SCHOOL.boxSpots.length - 1, `${out.length} sale boxes dropped in (every spot but the main box's)`);
check(!out.some((b) => b.spot === sim.box.spot), 'none on top of the main box');
check(ev.filter((e) => e.type === 'saleBoxArrive').length === out.length, 'arrive events');
check(sim.world.solids.length === solidsBefore + out.length, 'their bases are solid');
check(out.every((b) => b.phase === 'idle'), 'all ready to use');

// use one: stand at it and press use
const sb = out[0];
me.pos.x = sb.stand.x; me.pos.z = sb.stand.z;
me.yaw = Math.atan2(-(sb.pos.x - me.pos.x), -(sb.pos.z - me.pos.z)); me.pitch = -0.2;
const pts = me.points;
ev = step(2, { use: true, usePressed: true });
check(sb.phase === 'spinning', `sale box spins when used (${sb.phase})`);
check(pts - me.points === sim.cfg.powerups.list.clearanceSale.boxCost, `costs ${pts - me.points}`);
check(ev.some((e) => e.type === 'boxOpen' && e.boxId === sb.id), 'boxOpen carries its box id');

// net: a friend's copy sees the same boxes
const fr = new GameSim({ map: SCHOOL, seed: 3 }); fr.addPlayer('p1', 'T'); fr.addPlayer('p2', 'F'); fr.replica = true;
applyMirror(fr, JSON.parse(JSON.stringify(worldState(sim))), 'p2');
check(fr.saleBoxes.filter((b) => b.phase !== 'gone').length === out.length && fr.saleBoxes.find((b) => b.id === sb.id).phase === 'spinning', 'mirrored to a friend');

// sale ends mid-spin: that one finishes, the rest vanish
sim.powerups.active.clearanceSale = 0.01;
step(Math.ceil(1.5 / dt));
check(sb.phase !== 'gone', `the box in use stays until the pull is done (${sb.phase})`);
check(out.filter((b) => b !== sb).every((b) => b.phase === 'gone'), 'the idle ones are gone');
step(Math.ceil((sim.cfg.box.spinTime + sim.cfg.box.offerTime + sim.cfg.box.closeTime + 2) / dt));
check(sim.saleBoxes.every((b) => b.phase === 'gone'), 'and then it goes too');
check(sim.world.solids.length === solidsBefore, 'colliders removed');
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
