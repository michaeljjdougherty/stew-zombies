// =============================================================================
// Regs Best Buddy Mode (a power-up): for a while the zombies forget about the
// players and turn on each other. Each one picks the nearest other zombie,
// walks over and swings at it; whatever they kill counts as a kill for the
// player who grabbed it. Titans, Big Evil Zach and the quest's own zombies
// (a titan's or Zach's minions, the ritual's blue spirits) keep coming for you.
// Numbers: CONFIG.powerups.list.bestBuddy.
// =============================================================================
import { powerupActive } from './powerups.js';
import { damageZombie } from './zombies.js';
import { dist2D } from '../core/math.js';

export const brawling = (sim) => !!sim.powerups && powerupActive(sim, 'bestBuddy');

// Does this zombie join in? (the bosses' own stay on you)
export const brawler = (z) => z.state === 'chase' && !z.titan && !z.zach && !z.ritual;

// Who it's going after: the one that last hit it, else the nearest it can walk
// to (looked over again every `retarget` s).
export function brawlFoe(sim, z, dt) {
  const cur = z.foeId != null ? sim.zombieById(z.foeId) : null;
  z.foeT = (z.foeT || 0) - dt;
  if (cur && brawler(cur) && z.foeT > 0) return cur;
  z.foeT = sim.cfg.powerups.list.bestBuddy.retarget;
  let best = null, bd = Infinity;
  for (const o of sim.zombies) {
    if (o === z || !brawler(o)) continue;
    if (z.region && o.region && o.region !== z.region && !sim.nav.firstPortal(z.region, o.region, z.canDrop)) continue;
    const d = dist2D(o.pos, z.pos);
    if (d < bd) { bd = d; best = o; }
  }
  z.foeId = best ? best.id : null;
  return best;
}

// A swing landed on another zombie.
export function brawlHit(sim, z, foe) {
  const b = sim.cfg.powerups.list.bestBuddy;
  const dx = foe.pos.x - z.pos.x, dz = foe.pos.z - z.pos.z, l = Math.hypot(dx, dz) || 1;
  foe.foeId = z.id; foe.foeT = b.retarget;   // (it fights back)
  damageZombie(sim, foe, foe.maxHealth * b.hitFrac, {
    playerId: sim.powerups.buddyId, kind: 'brawl', part: 'torso', quiet: true,
    point: { x: foe.pos.x, y: foe.pos.y + 1.3, z: foe.pos.z }, dir: { x: dx / l, y: 0, z: dz / l },
  });
}
