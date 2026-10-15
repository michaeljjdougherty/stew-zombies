// Every zipline at the Crust rides clear of the buildings it passes over (a
// rider's whole body, cable down to feet: no walls, no roofs).
// Run: node tests/zips_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { ridePoint } from '../src/sim/rides.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const sim = new GameSim({ map: CRUST, seed: 1 });
const hang = sim.cfg.crust.ride.hang;
for (const R of sim.rides.filter((r) => r.kind === 'zip')) {
  const hits = new Set();
  // (the last couple of metres you're stepping off at the bottom)
  for (let s = 0; s <= R.len - 2; s += 0.5) {
    const at = ridePoint(R, s), lo = at.y - hang - 0.1, hi = at.y;
    for (const b of sim.world.solids) {
      if (b.ghost || at.x + 0.3 < b.minX || at.x - 0.3 > b.maxX || at.z + 0.3 < b.minZ || at.z - 0.3 > b.maxZ) continue;
      if (hi > b.minY && lo < b.maxY && s > 2) hits.add(`${b.kind} ${b.room || ''}`);
    }
    // a building's roof (its collision may not reach that high): its walls' height and a bit
    for (const r of CRUST.rooms) {
      if (!r.rect || r.outdoor || r.virtual || r.ceiling === 'none') continue;
      const [x0, z0, x1, z1] = r.rect;
      if (at.x < x0 - 0.3 || at.x > x1 + 0.3 || at.z < z0 - 0.3 || at.z > z1 + 0.3) continue;
      if (lo < (r.y || 0) + (r.height || 3.4) + 0.6 && hi > (r.y || 0)) hits.add(`the ${r.name}'s roof`);
    }
  }
  check(!hits.size, `${R.id} (${R.len.toFixed(0)} m)${hits.size ? ': through ' + [...hits].join(', ') : ': clear all the way down'}`);
}
console.log(fails ? `\n${fails} FAILED` : '\nall zipline checks passed');
process.exit(fails ? 1 : 0);
