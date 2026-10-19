// Bikini Bottom (Map 3): the map builds, you can walk it, zombies come in over
// the barricades and up out of the sand, and every machine and wall gun is
// somewhere you can stand in front of. SpongeBob's front door and the Krusty
// Krab's take you inside and back out, and zombies find you in there.
import { CONFIG } from '../src/config.js';
import { BIKINI_BOTTOM as M } from '../src/map/bikinibottom.js';
import { GameSim } from '../src/sim/sim.js';
import { exploreJumpToRound } from '../src/sim/rounds.js';

let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };

const sim = new GameSim({ map: M, cfg: CONFIG, mode: 'zombies', seed: 3 });
const p = sim.addPlayer('p1', 'Stew', { character: 'ryan', skin: 'jersey' });
const two = new GameSim({ map: M, cfg: CONFIG, mode: 'zombies', seed: 3 });
const q1 = two.addPlayer('p1', 'Stew', { character: 'ryan', skin: 'jersey' }), p2 = two.addPlayer('p2', 'Friend', { character: 'ryan' });
check(q1.character === 'patrick' && p2.character === 'spongebob' && !q1.skin && p.character === 'patrick', `you play one of the town: Ryan turns up as ${q1.character}, a second Ryan as ${p2.character}`);
check(M.terrainBoxes.length > 1000 && M.navRegions.length > 100, `ground: ${M.terrainBoxes.length} boxes, ${M.navRegions.length} regions, ${M.portals.length} portals`);
check(Math.abs(p.pos.y - M.heightAt(p.pos.x, p.pos.z)) < 0.3, `spawn on the ground (y ${p.pos.y.toFixed(2)})`);
const reg = sim.nav.regionAt(p.pos);
check(!!reg, 'spawn is on the nav');
const reach = (pt) => sim.nav.canReach(sim.nav.regionAt({ ...pt, y: pt.y ?? M.heightAt(pt.x, pt.z) }), reg);
check(sim.windows.length === M.windows.length && sim.windows.every((w) => reach(w.interior)), `${sim.windows.length} barricades, all lead in to the spawn`);
check(sim.world.perkMachines.every((m) => reach(m.front)), `${sim.world.perkMachines.length} perk machines reachable`);
check(sim.world.wallBuys.every((w) => reach({ x: w.pos.x + w.normal.x * 0.8, z: w.pos.z + w.normal.z * 0.8 })), `${sim.world.wallBuys.length} wall guns reachable`);
check(sim.world.boxSpots.every((b) => reach(b)), `${sim.world.boxSpots.length} box spots reachable`);
check(!!sim.world.powerSwitch && reach({ x: sim.world.powerSwitch.pos.x + sim.world.powerSwitch.normal.x * 0.8, z: sim.world.powerSwitch.pos.z + sim.world.powerSwitch.normal.z * 0.8 }), 'power switch reachable');
check(reach(sim.world.madDog), 'Mad Dog Machine reachable');
check(M.groundSpawns.length >= 10, `${M.groundSpawns.length} sand spawns`);

// walk east for a few seconds: on the ground the whole way, never through a wall
const step = (s, cmd = {}) => { for (let i = 0; i < Math.round(s * 60); i++) { sim.setInput('p1', { moveX: 0, moveY: 0, yaw: p.yaw, pitch: 0, ...cmd }); sim.step(1 / 60); sim.drainEvents(); } };
const x0 = p.pos.x, z0 = p.pos.z;
p.yaw = -Math.PI / 2; step(3, { moveY: 1, yaw: -Math.PI / 2 });
const moved = Math.hypot(p.pos.x - x0, p.pos.z - z0);
check(moved > 2 && Math.abs(p.pos.y - M.heightAt(p.pos.x, p.pos.z)) < 0.5, `walked ${moved.toFixed(1)} m, feet on the ground (y ${p.pos.y.toFixed(2)} vs ${M.heightAt(p.pos.x, p.pos.z).toFixed(2)})`);

// rounds: zombies arrive and come for you
sim.godMode = true;
step(40);
const z = sim.zombies.filter((q) => q.state !== 'dead');
check(z.length > 0, `round ${sim.rounds.round}: ${z.length} zombies up`);
const chasing = z.filter((q) => q.state === 'chase');
step(20);
const closer = chasing.filter((q) => Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z) < 30);
check(chasing.length > 0 && closer.length > 0, `${chasing.length} chasing, ${closer.length} within 30 m after 20 s`);
check(sim.zombies.every((q) => q.state === 'dead' || (isFinite(q.pos.y) && q.pos.y > -2)), 'no zombie fell through the ground');

// the front doors: in, walk about, back out; zombies come for you inside too
const use = () => { step(0.1); sim.setInput('p1', { moveX: 0, moveY: 0, yaw: p.yaw, pitch: 0, use: true, usePressed: true }); sim.step(1 / 60); sim.drainEvents(); step(0.1); };
const roomAt = (pt) => { const id = sim.nav.regionAt(pt); return sim.nav.regions.find((r) => r.id === id)?.room; };
const at = (pt) => { p.pos.x = pt.x; p.pos.z = pt.z; p.pos.y = M.heightAt(pt.x, pt.z); p.vel.x = p.vel.y = p.vel.z = 0; p.region = sim.nav.regionAt(p.pos); };
for (const room of ['house', 'krab']) {
  const door = M.teleporters.find((t) => t.id === 'door_' + room), back = M.teleporters.find((t) => t.id === 'door_' + room + '_out');
  check(!!door && !!back && reach(door), `${room}: the front door's on open ground in town`);
  at(door); use();
  check(roomAt(p.pos) === room && Math.abs(p.pos.y - M.heightAt(p.pos.x, p.pos.z)) < 0.3, `${room}: F at the door takes you inside (${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)})`);
  const ix = p.pos.x, iz = p.pos.z;
  step(1.5, { moveY: 1, yaw: 0 });
  check(Math.hypot(p.pos.x - ix, p.pos.z - iz) > 1 && roomAt(p.pos) === room, `${room}: you can walk about inside`);
  check(M.groundSpawns.filter((s) => s.room === room).length >= 3, `${room}: ${M.groundSpawns.filter((s) => s.room === room).length} spawns inside`);
  // stay in a while: the zombies outside give up on the town and turn up in here
  step(25);
  const near = sim.zombies.filter((q) => q.state !== 'dead' && Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z) < 25);
  check(near.length > 0, `${room}: ${near.length} zombies came in after you`);
  at(back); use();
  check(roomAt(p.pos) === 'town' && Math.hypot(p.pos.x - door.x, p.pos.z - door.z) < 4, `${room}: the door inside takes you back out by the front door`);
}

// Explore mode (Play › Explore on the map screen): endless points, no dying,
// zombies only when you switch them on
const ex = new GameSim({ map: M, cfg: CONFIG, mode: 'explore', seed: 4 });
const q = ex.addPlayer('p1', 'Stew');
for (let i = 0; i < 600; i++) { ex.setInput('p1', { moveX: 0, moveY: 0, yaw: q.yaw, pitch: 0 }); ex.step(1 / 60); ex.drainEvents(); }
check(ex.godMode && q.points >= CONFIG.explore.points && ex.zombies.filter((z) => z.state !== 'dead').length === 0, `explore: ${q.points} points, no zombies until asked`);
exploreJumpToRound(ex, 10);
for (let i = 0; i < 1800; i++) { ex.setInput('p1', { moveX: 0, moveY: 0, yaw: q.yaw, pitch: 0 }); ex.step(1 / 60); ex.drainEvents(); }
check(ex.rounds.round === 10 && ex.zombies.some((z) => z.state !== 'dead') && q.alive, `explore: jumped to round ${ex.rounds.round}, ${ex.zombies.filter((z) => z.state !== 'dead').length} zombies up, still standing`);

console.log(fails ? `${fails} FAILED` : 'all ok');
if (fails) process.exit(1);
