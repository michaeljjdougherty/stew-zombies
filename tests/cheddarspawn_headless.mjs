// Cheddar Rounds: every hound comes down on the floor near the players, on both
// maps. (On Call of the Crust they used to land at height 0, under the islands,
// and fall into the void.)
// Run: node tests/cheddarspawn_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { groundHeight } from '../src/sim/physics.js';
import { strikePoint } from '../src/sim/rounds.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

function game(map, seed) {
  const sim = new GameSim({ map, seed });
  const me = sim.addPlayer('p1', 'Tester', { character: 'kearns' });
  sim.godMode = true;
  for (const r of sim.world.rooms) sim.openZones.add(r.zone);
  return { sim, me, lists: [sim.world.solids, sim.world.terrain] };
}

// Standable spots to put the player: the middle of each nav region that has floor there.
function spots(sim, lists) {
  const out = [];
  for (const r of sim.nav.regions) {
    const [x0, z0, x1, z1] = r.rect;
    const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    const y = groundHeight(x, z, 0.3, (r.y0 || 0) + 0.6, lists);
    if (Math.abs(y - (r.y0 || 0)) < 0.7) out.push({ id: r.id, x, y, z });
  }
  return out;
}

// --- every strike point is on the floor, on the player's level, near them
for (const [name, map] of [['Stew Leonard High', SCHOOL], ['Call of the Crust', CRUST]]) {
  const { sim, me, lists } = game(map, 4);
  let n = 0, none = 0;
  const bad = [];
  for (const s of spots(sim, lists)) {
    me.pos.x = s.x; me.pos.y = s.y; me.pos.z = s.z;
    for (let k = 0; k < 4; k++) {
      const p = strikePoint(sim);
      if (!p) { none++; continue; }
      n++;
      const g = groundHeight(p.x, p.z, 0.1, p.y + 0.05, lists);
      const far = Math.hypot(p.x - s.x, p.z - s.z);
      if (Math.abs(g - p.y) > 0.01 || Math.abs(p.y - s.y) >= 2 || far > 16) bad.push(`${s.id} (y ${s.y.toFixed(1)}) -> (${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}), floor ${g.toFixed(2)}`);
    }
  }
  for (const b of bad.slice(0, 5)) console.log('   ' + b);
  check(n > 0 && bad.length === 0, `${name}: all ${n} strikes land on the floor beside the player (${bad.length} off)`);
  check(none <= n * 0.01, `${name}: somewhere to strike nearly everywhere (${none} misses)`);
}

// --- a whole Cheddar Round on the Crust: the hounds stay up on the islands
{
  const places = [[0, 0], [25, -22], [-30, -138], [185, -30]];
  let strikes = 0, fell = 0, under = 0;
  for (const [i, [px, pz]] of places.entries()) {
    const { sim, me, lists } = game(CRUST, 10 + i);
    const y = groundHeight(px, pz, 0.3, 40, lists);
    me.pos.x = px; me.pos.y = y; me.pos.z = pz;
    const R = sim.rounds;
    R.round = R.cheddarNext - 1; R.phase = 'intermission'; R.timer = 0.05;
    const hounds = new Map();
    for (let f = 0; f < 60 * 14; f++) {
      me.pos.x = px; me.pos.z = pz; me.pos.y = y; me.vel.x = me.vel.z = 0;
      sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw });
      sim.step(dt);
      for (const e of sim.drainEvents()) {
        if (e.type === 'zombieRemoved' && hounds.has(e.id)) fell++;   // dropped into the void
        if (e.type !== 'cheddarStrike') continue;
        strikes++;
        if (e.pos.y < y - 2) under++;
        hounds.set(e.id, e.pos.y);
      }
    }
  }
  check(strikes >= 8, `hounds came down on every island tried (${strikes} strikes)`);
  check(under === 0, `no hound strikes under the floor (${under})`);
  check(fell === 0, `no hound drops into the void (${fell})`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
