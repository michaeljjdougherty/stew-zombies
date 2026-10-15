// =============================================================================
// The War Hammers (Call of the Crust). Pit forges one from each titan's core;
// you take it from its socket on the Anvil. A swing smashes everything just
// in front of you, then the hammer's element goes off where its head lands:
//   Fire       a burst of flame
//   Ice        everything round you frozen solid (the next hit shatters it)
//   Wind       a gale down the line you swung along (flings them off the island)
//   Lightning  a bolt that jumps zombie to zombie
// Pit's tempered "+" hammers do more of all of it. They're also the only
// thing that gets through The Schnitz's hold on Big Evil Zach (zachBoss.js).
// Numbers: CONFIG.crust.hammers.
// =============================================================================
import { damageZombie } from './zombies.js';
import { explode } from './projectiles.js';
import { windBlast } from './wind.js';
import { zachHammerHit } from './zachBoss.js';
import { DEG } from '../core/math.js';

const alive = (z) => z.state !== 'dead' && !(z.state === 'rising' && z.pos.y < -0.8);
const center = (z) => ({ x: z.pos.x, y: z.pos.y + (z.crawler ? 0.3 : 1.0), z: z.pos.z });

export const HAMMER_ELEMENTS = ['wind', 'lightning', 'ice', 'fire'];
export const HAMMER_IDS = { wind: 'Wind Hammer', lightning: 'Lightning Hammer', ice: 'Ice Hammer', fire: 'Fire Hammer' };

export function hammerSlam(sim, p, eye, dir, def, weapon) {
  const H = sim.cfg.crust.hammers, el = def.hammer, up = !!def.upgraded;
  const E = up ? H.tempered[el] : H[el];
  let fx = dir.x, fz = dir.z;
  const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
  const land = { x: p.pos.x + fx * H.landAt, y: p.pos.y + 0.15, z: p.pos.z + fz * H.landAt };

  // the smash: everything just in front of you
  const cosA = Math.cos(H.angle * DEG);
  const hits = [];
  for (const z of sim.zombies) {
    if (!alive(z)) continue;
    const dx = z.pos.x - p.pos.x, dz = z.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d > H.reach + 0.4 || Math.abs(z.pos.y - p.pos.y) > 2.4) continue;
    if (d > 0.8 && (dx * fx + dz * fz) / d < cosA) continue;
    const c = center(z);
    const ex = c.x - eye.x, ey = c.y - eye.y, ez = c.z - eye.z, el2 = Math.hypot(ex, ey, ez);
    if (el2 > 0.6 && sim.raycastWorld(eye, { x: ex / el2, y: ey / el2, z: ez / el2 }, el2 - 0.4, true)) continue;
    hits.push({ z, d, c });
  }
  hits.sort((a, b) => a.d - b.d);
  const maxKills = up ? (H.tempered.maxKills ?? H.maxKills) : H.maxKills;
  for (const { z, c } of hits.slice(0, maxKills)) {
    let kx = c.x - p.pos.x, kz = c.z - p.pos.z;
    const kl = Math.hypot(kx, kz) || 1; kx = kx / kl * 0.5 + fx * 0.5; kz = kz / kl * 0.5 + fz * 0.5;
    damageZombie(sim, z, 1e6, { playerId: p.id, part: 'torso', kind: 'hammer', dir: { x: kx, y: 0.45, z: kz }, point: c, force: 1, weapon, fling: { x: kx, z: kz, dist: 3.5, up: 1.6 } });
  }
  sim.emit('hammerSlam', { playerId: p.id, element: el, upgraded: up, pos: land, dir: { x: fx, z: fz }, smashed: Math.min(hits.length, maxKills), weapon });

  // the element
  if (el === 'fire') explode(sim, { x: land.x, y: land.y + 0.5, z: land.z }, E.blast, p.id);
  else if (el === 'ice') {
    const near = [];
    for (const z of sim.zombies) {
      if (!alive(z)) continue;
      const d = Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z);
      if (d <= E.radius && Math.abs(z.pos.y - p.pos.y) < 3) near.push({ z, d });
    }
    near.sort((a, b) => a.d - b.d);
    const ids = [];
    for (const { z } of near.slice(0, E.maxFrozen)) { z.frozen = E.freeze; ids.push(z.id); }
    sim.emit('hammerFreeze', { playerId: p.id, pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, radius: E.radius, ids });
  } else if (el === 'wind') windBlast(sim, p, eye, { x: fx, y: 0, z: fz }, { wind: E }, weapon);
  else if (el === 'lightning') {
    const pts = [{ x: land.x, y: land.y + 0.2, z: land.z }];
    const hit = new Set();
    let from = land, reach = E.reach;
    for (let i = 0; i < E.chains; i++) {
      let best = null, bd = reach;
      for (const z of sim.zombies) {
        if (!alive(z) || hit.has(z.id)) continue;
        const d = Math.hypot(z.pos.x - from.x, z.pos.z - from.z);
        if (d < bd && Math.abs(z.pos.y - from.y) < 4) { bd = d; best = z; }
      }
      if (!best) break;
      hit.add(best.id);
      const c = center(best);
      pts.push(c);
      damageZombie(sim, best, 1e6, { playerId: p.id, part: 'torso', kind: 'electric', dir: { x: 0, y: 1, z: 0 }, point: c, force: 1, weapon });
      from = best.pos; reach = E.hop;
    }
    sim.emit('hammerChain', { playerId: p.id, points: pts });
  }

  // Big Evil Zach (the finale): the only thing that gets through
  zachHammerHit(sim, p, el, land, { x: fx, z: fz });
}
