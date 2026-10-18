// =============================================================================
// Shooting the Schnitz's cage (Call of the Crust). Nobody in it gets hurt (the
// cage hangs over the Anvil, Chops, Regs, P, James and Kyle inside), but they
// have words: a line when a bullet hits the cage, at most one every
// CONFIG.crust.cageShot.gap s, taking turns, and the more you do it the less they
// like it. Leave them alone long enough (forgive s) and they're over it.
// Lines: CAGE_SHOT in src/lore/crustCrew.js.
//
// Bullets only (fire() in weapons.js calls this for every pellet's line). On an
// online client the shot goes to the host (netAct 'cage'), which checks it again.
// =============================================================================
import { CAGED, CAGE_SHOT } from '../lore/crustCrew.js';
import { paSay } from './pa.js';
import { rayAABB } from '../core/math.js';

// The cage's box: it hangs `chain` m under the top of its chain (src/render/crustCage.js)
export function cageBox(sim) {
  const at = sim.mapData.forge && sim.mapData.forge.cage;
  if (!at) return null;
  const L = sim.cfg.crust.cage, [W, H, D] = L.size, y = at.y - L.chain - H - 0.3;
  return { minX: at.x - W / 2, maxX: at.x + W / 2, minY: y, maxY: y + H + 0.1, minZ: at.z - D / 2, maxZ: at.z + D / 2 };
}

// How far along the ray (o, d) it hits the cage, or -1. Walls in the way count.
export function cageHitAt(sim, o, d, range) {
  if (!sim.crustEgg || (sim.crustEgg.finale && sim.crustEgg.finale.state === 'done')) return -1;
  const b = cageBox(sim);
  const hit = b && rayAABB(o, d, b, range);
  if (!hit) return -1;
  const wall = sim.raycastWorld(o, d, hit.t);
  return wall && wall.t < hit.t - 0.05 ? -1 : hit.t;
}

// A bullet from p along (o, d): if it hits the cage, someone in there says something.
export function cageShot(sim, p, o, d, range = 200) {
  if (cageHitAt(sim, o, d, range) < 0) return false;
  const C = sim.cfg.crust.cageShot;
  const S = sim.crustEgg.cageShot || (sim.crustEgg.cageShot = { n: 0, last: -1e9, next: 0, turn: 0 });
  if (sim.time - S.last > C.forgive) S.n = 0;
  S.last = sim.time;
  // (still on the last one, here or waiting its turn on the speakers)
  const waiting = sim.pa && sim.pa.queue.some((q) => q.cat === 'react' && CAGED.includes(q.who));
  if (sim.time < S.next || waiting) return true;
  // whoever's in there (anyone being played isn't)
  const here = new Set(sim.players.map((q) => q.character));
  const inside = CAGED.filter((id) => !here.has(id));
  if (!inside.length) return true;
  const who = inside[S.turn++ % inside.length];
  const list = S.n >= C.lotsAfter ? CAGE_SHOT.lots : S.n >= C.againAfter ? CAGE_SHOT.again : CAGE_SHOT.first;
  S.n++;
  S.next = sim.time + C.gap;
  paSay(sim, 'react', { text: list[who], delay: 0.2, force: true, who, live: true });
  sim.emit('cageShot', { playerId: p.id, who, n: S.n });
  return true;
}
