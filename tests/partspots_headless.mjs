// The War Hammer's parts are hidden: each island's part lies at one of its four
// spots, a different one from game to game, and every spot can be walked to and
// the part picked up there. Run: node tests/partspots_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

check(CRUST.hammerParts.length === 4 && CRUST.hammerParts.every((h) => h.spots.length === 4), 'four islands, four spots each');

// different games, different spots
const picked = {};
for (let seed = 1; seed <= 24; seed++) {
  const sim = new GameSim({ map: CRUST, seed });
  for (const k of Object.values(sim.crustEgg.forge.parts)) (picked[k.island] ||= new Set()).add(k.x + ',' + k.z);
}
for (const [isl, set] of Object.entries(picked)) check(set.size >= 3, `${isl}: the part turns up in ${set.size} different spots over 24 games`);

// every spot: on the ground you'd stand on there, and the part's picked up there
for (const h of CRUST.hammerParts) {
  for (const sp of h.spots) {
    const sim = new GameSim({ map: CRUST, seed: 5 });
    const me = sim.addPlayer('p1', 'T', { character: 'kearns' });
    const k = Object.values(sim.crustEgg.forge.parts).find((q) => q.island === h.island);
    k.x = k.home.x = sp.x; k.y = k.home.y = sp.y; k.z = k.home.z = sp.z;
    // (stood just off it: some are out past the wire, behind its gate)
    me.pos.x = sp.x + 1.2; me.pos.z = sp.z; me.pos.y = sp.y + 0.3;
    for (let i = 0; i < 30; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw }); sim.step(dt); }
    const standY = me.pos.y;
    const zone = sim.zoneOf(me.pos, me.region);
    check(k.state === 'carried' && Math.abs(standY - sp.y) < 0.6 && !!zone, `${h.island} (${sp.x}, ${sp.z}): on the ground (${zone}, y ${standY.toFixed(2)} vs ${sp.y.toFixed(2)}), picked up`);
  }
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
