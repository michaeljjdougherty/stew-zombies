// ADS headless test: aiming settles and holds steady for every weapon.
// Run: node tests/ads_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { RANGE } from '../src/map/range.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG } from '../src/config.js';
import { rangeGive } from '../src/sim/range.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const ids = Object.keys(CONFIG.weapons).filter((k) => !CONFIG.weapons[k].dual);
let bad = [];
for (const id of ids) {
  const sim = new GameSim({ map: RANGE, seed: 3, mode: 'range' });
  const me = sim.addPlayer('p1', 'T');
  rangeGive(sim, me, id);
  const step = (patch, n) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, ...patch }); sim.step(dt); sim.drainEvents(); } };
  step({}, 90);
  step({ ads: true }, 90);
  const seen = [];
  for (let i = 0; i < 30; i++) { step({ ads: true }, 1); seen.push(me.loadout.adsAmount); }
  const lo = Math.min(...seen), hi = Math.max(...seen);
  if (!(lo === 1 && hi === 1)) bad.push(`${id} ${lo.toFixed(3)}..${hi.toFixed(3)}`);
  step({ ads: false }, 90);
  if (me.loadout.adsAmount !== 0) bad.push(`${id} doesn't lower`);
}
check(!bad.length, `held ADS stays fully up on all ${ids.length} weapons ${bad.join(', ')}`);
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
