// =============================================================================
// The Chopper's blast: a wall of wind out of the barrel. Every zombie in the
// cone (and anything right up against you) is killed and thrown, the near ones
// hardest, as far as the walls let them fly. In the quest's last phase it's
// also what knocks Erik out of the Press Box (quest.js questWind).
//
//   def.wind = { range, angle (half-angle, degrees), near (point-blank radius), maxKills }
// =============================================================================
import { DEG } from '../core/math.js';
import { damageZombie } from './zombies.js';
import { questWind } from './quest.js';

export function windBlast(sim, p, origin, dir, def, weapon) {
  const W = def.wind;
  sim.emit('windBlast', { playerId: p.id, origin: { ...origin }, dir: { ...dir }, range: W.range, angle: W.angle, weapon });
  const cosA = Math.cos(W.angle * DEG);
  const hits = [];
  for (const z of sim.zombies) {
    if (z.state === 'dead' || z.state === 'rising' && z.pos.y < -0.8) continue;
    const c = { x: z.pos.x, y: z.pos.y + (z.crawler ? 0.3 : 1.0), z: z.pos.z };
    const dx = c.x - origin.x, dy = c.y - origin.y, dz = c.z - origin.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > W.range) continue;
    const dot = d > 0.01 ? (dx * dir.x + dy * dir.y + dz * dir.z) / d : 1;
    if (d > (W.near ?? 1.8) && dot < cosA) continue;
    if (d > 0.6 && sim.raycastWorld(origin, { x: dx / d, y: dy / d, z: dz / d }, d - 0.4, true)) continue;
    hits.push({ z, d, c });
  }
  hits.sort((a, b) => a.d - b.d);
  for (const { z, d, c } of hits.slice(0, W.maxKills ?? 40)) {
    // thrown away from you, along the blast
    let fx = c.x - origin.x, fz = c.z - origin.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx = fx / fl * 0.6 + dir.x * 0.4; fz = fz / fl * 0.6 + dir.z * 0.4;
    const hl = Math.hypot(fx, fz) || 1; fx /= hl; fz /= hl;
    const k = 1 - d / W.range;                  // 1 up close, 0 at the edge
    const want = 4 + k * 9;                     // metres of flight
    const blocked = sim.raycastWorld({ x: c.x, y: c.y, z: c.z }, { x: fx, y: 0, z: fz }, want);
    const dist = Math.max(0.6, (blocked ? blocked.t : want) - 0.5);
    const fling = { x: fx, z: fz, dist, up: 1.2 + k * 2.2 };
    damageZombie(sim, z, 1e6, { playerId: p.id, part: 'torso', kind: 'wind', dir: { x: fx, y: 0.5, z: fz }, point: c, force: 1, weapon, fling });
  }
  // the quest's finale: blasting Erik out of the Press Box
  questWind(sim, p, origin, dir, W);
  return hits.length;
}
