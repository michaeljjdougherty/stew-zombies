// =============================================================================
// Shooting Pit at his bench (Call of the Crust). He can't be hurt (he's not
// playable here, he's the guy at the forge), but he has words: a line when a
// bullet hits him, at most one every CONFIG.pitShot.gap s, and the more you do
// it the less he likes it. Leave him alone long enough (forgive s) and he's
// over it. Lines: PIT_SHOT in src/lore/crew.js.
//
// Bullets only (fire() in weapons.js calls this for every pellet's line). On an
// online client the shot goes to the host (netAct 'pit'), which checks it again.
// =============================================================================
import { PIT_SHOT } from '../lore/crew.js';
import { pitSay } from './forge.js';
import { rayCapsule } from '../core/math.js';

// How far along the ray (o, d) it hits Pit, or -1. Walls in the way count.
export function pitHitAt(sim, o, d, range) {
  const F = sim.crustEgg && sim.crustEgg.forge, at = sim.mapData.forge && sim.mapData.forge.pit;
  if (!F || !at) return -1;
  const C = sim.cfg.pitShot, r = C.radius;
  const t = rayCapsule(o, d, { x: at.x, y: at.y + r, z: at.z }, { x: at.x, y: at.y + C.height - r, z: at.z }, r);
  if (t < 0 || t > range) return -1;
  const wall = sim.raycastWorld(o, d, t);
  return wall && wall.t < t - 0.05 ? -1 : t;
}

// A bullet from p along (o, d): if it hits Pit, he says something about it.
export function pitShot(sim, p, o, d, range = 200) {
  if (pitHitAt(sim, o, d, range) < 0) return false;
  const F = sim.crustEgg.forge, C = sim.cfg.pitShot;
  const S = F.shot || (F.shot = { n: 0, last: -1e9, next: 0 });
  if (sim.time - S.last > C.forgive) S.n = 0;
  S.last = sim.time;
  // (still on his last one, here or waiting its turn on the speakers)
  const waiting = F.lines.length || (sim.pa && sim.pa.enabled && sim.pa.queue.some((q) => q.who === 'pit'));
  if (sim.time < S.next || waiting) return true;
  const list = F.work ? PIT_SHOT.working : S.n >= C.lotsAfter ? PIT_SHOT.lots : S.n >= C.againAfter ? PIT_SHOT.again : PIT_SHOT.first;
  const text = list[S.n % list.length];
  S.n++;
  S.next = sim.time + C.gap;
  pitSay(sim, text);
  sim.emit('pitShot', { playerId: p.id, n: S.n });
  return true;
}
