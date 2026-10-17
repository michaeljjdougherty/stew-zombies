// Call of the Crust: Michael's batch of fixes.
//   - zombies go round Pit's bench (and the rune stones) instead of getting caught on them
//   - the spiky rock's gone from the pit floor; no boulders in or against the Supply Depot
//   - the rim past the depot is blocked: the way through is its door
//   - every door and debris pile costs 750
//   - each War Hammer part lying on its island hums, louder as you get closer
// Run: node tests/crustfixes_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { makeZombie } from '../src/sim/zombies.js';
import { PartHum } from '../src/audio/partHum.js';
import { CONFIG } from '../src/config.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

// --- zombies get to you round Pit and his bench
{
  let stuck = 0, tot = 0;
  for (const [px, pz] of [[-4.9, 2.9], [-5, 1], [-5, 4.8], [-9.3, 2.9], [-7.5, 0.6], [-7.5, 5.3]]) {
    for (let seed = 1; seed <= 6; seed++) {
      const sim = new GameSim({ map: CRUST, seed });
      const me = sim.addPlayer('p1', 'Tester', { character: 'kearns' });
      sim.rounds.timer = 1e9; sim.godMode = true;
      me.pos.x = px; me.pos.z = pz; me.pos.y = 0.3;
      const a = seed / 6 * Math.PI * 2;
      const z = makeZombie(sim, { type: 'walker', pos: { x: -7 + Math.cos(a) * 6, y: 0.3, z: 3 + Math.sin(a) * 6 }, health: 1e9, state: 'chase' });
      sim.zombies.push(z);
      let reached = false;
      for (let f = 0; f < 60 * 20 && !reached; f++) {
        sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw });
        sim.step(dt); sim.drainEvents();
        reached = Math.hypot(z.pos.x - me.pos.x, z.pos.z - me.pos.z) < 1.3;
      }
      tot++;
      if (!reached) { stuck++; console.log(`  you at (${px}, ${pz}): a zombie stuck at (${z.pos.x.toFixed(2)}, ${z.pos.z.toFixed(2)})`); }
    }
  }
  check(stuck === 0, `a zombie gets round Pit's bench to you from every side (${tot - stuck} of ${tot})`);
}

// --- the pit floor and the depot
{
  check(!CRUST.props.some((p) => p.kind === 'rock' && p.box[0] > -20 && p.box[3] < 20 && p.box[2] > -20 && p.box[5] < 20), 'no spiky rock on the pit floor');
  const inDepot = CRUST.models.filter((m) => m.a === 'stones' && m.x > 13 && m.x < 31 && m.z > -31 && m.z < -14);
  check(inDepot.length === 0, `no boulders in or against the Supply Depot (${inDepot.length})`);
}

// --- the rim past the depot: through its door, not round the outside
{
  const regAt = (x, z, y) => CRUST.navRegions.find((r) => r.rect && x >= r.rect[0] && x <= r.rect[2] && z >= r.rect[1] && z <= r.rect[3] && Math.abs((r.y0 ?? 0) - y) < 1.5);
  const byId = new Map(CRUST.navRegions.map((r) => [r.id, r]));
  const near = (id) => { const r = byId.get(id); return /depot/.test(String(id)) || (r && r.rect && r.rect[0] > 4 && r.rect[3] < -4 && (r.y0 ?? 0) > 7); };
  const reach = (doors) => {
    const adj = new Map();
    for (const p of CRUST.portals) {
      if (p.door && !doors) continue;
      for (const [u, v] of [[p.a, p.b], [p.b, p.a]]) { if (!adj.has(u)) adj.set(u, []); adj.get(u).push(v); }
    }
    const a = regAt(20.5, -16.5, 9).id, seen = new Set([a]), q = [a];
    while (q.length) { const u = q.shift(); for (const v of adj.get(u) || []) if (!seen.has(v) && near(v)) { seen.add(v); q.push(v); } }
    return seen.has(regAt(13.5, -23.5, 9).id);
  };
  check(!reach(false), "no way round the depot along the rim without its door");
  check(reach(true), '...and through it once the door is open');
  // and you can't just walk round it
  const sim = new GameSim({ map: CRUST, seed: 3 });
  const me = sim.addPlayer('p1', 'Tester', { character: 'kearns' });
  sim.rounds.timer = 1e9; sim.godMode = true;
  me.pos.x = 19; me.pos.z = -17; me.pos.y = 9.02;
  let past = false;
  for (let f = 0; f < 60 * 6; f++) {
    me.yaw = Math.atan2(-(13 - me.pos.x), -(-22 - me.pos.z));
    sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, moveY: 1 });
    sim.step(dt); sim.drainEvents();
    if (me.pos.x < 15.5 && me.pos.z < -19.6 && me.pos.y > 8) past = true;
  }
  check(!past, `walking round the outside of the depot gets you nowhere (at ${me.pos.x.toFixed(1)}, ${me.pos.z.toFixed(1)})`);
}

// --- 750 a door
{
  const sim = new GameSim({ map: CRUST, seed: 1 });
  sim.addPlayer('p1', 'Tester', { character: 'kearns' });
  const doors = sim.interactables.filter((i) => i.constructor.name === 'DoorInteractable' && !i.door.locked);
  const costs = doors.map((d) => [d.door.id, d.cost(sim)]);
  check(doors.length >= 12 && costs.every(([, c]) => c === 750), `every door and debris pile on the Crust is 750 (${costs.filter(([, c]) => c !== 750).map(([id, c]) => id + ' ' + c).join(', ') || doors.length + ' of them'})`);
}

// --- the parts hum, louder the closer you are
{
  const sim = new GameSim({ map: CRUST, seed: 2 });
  sim.addPlayer('p1', 'Tester', { character: 'kearns' });
  const parts = sim.crustEgg.forge.parts;
  const ids = Object.keys(parts);
  check(ids.length === 4 && ids.every((id) => parts[id].state === 'lying'), `four parts lying out on the islands (${ids.join(', ')})`);
  // a pretend sound engine: just enough to see what the hum's gain is set to
  const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() { this.stopped = true; }, frequency: { value: 0 }, gain: { value: 0, setTargetAtTime(v) { this.value = v; } } });
  const A = { now: () => 0, noise: { pink: {} }, ctx: { createOscillator: node, createBufferSource: node }, gain: (v) => { const n = node(); n.gain.value = v; return n; }, filter: () => node(), output: () => ({ input: node() }) };
  const hum = new PartHum(A, CONFIG);
  const k = parts[ids[0]], R = CONFIG.crust.partHum.range;
  const at = (d) => { hum.update(sim, { x: k.x + d, y: k.y, z: k.z }); const h = hum.hums.get(ids[0]); return h ? h.g.gain.value : 0; };
  const far = at(R + 5), mid = at(R * 0.6), close = at(2);
  check(far === 0 && mid > 0 && close > mid, `${ids[0]}: silent from ${R + 5} m, ${mid.toFixed(2)} at ${(R * 0.6).toFixed(0)} m, ${close.toFixed(2)} at 2 m`);
  const h = hum.hums.get(ids[0]);
  k.state = 'carried';
  hum.update(sim, { x: k.x, y: k.y, z: k.z });
  check(!hum.hums.has(ids[0]) && h.nodes.every((n) => n.stopped), 'picked up: it stops');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
