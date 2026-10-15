// =============================================================================
// The thrown and planted gadgets (they ride on the projectile list, so they
// replicate online like any grenade):
//   maisy  the Maisy Dog: lands, howls, and a black hole opens over her that
//          drags every zombie round it in and swallows it; then her too
//   lbd    the LBD: a sleeping baby set down like a Bouncing Betty; a zombie
//          comes near, it wakes, pops up and goes off
// =============================================================================
import { damageZombie } from './zombies.js';
import { explode } from './projectiles.js';

export const GADGETS = new Set(['maisy', 'lbd']);

// It came to rest on the floor.
export function gadgetLanded(sim, pr) {
  if (pr.type === 'maisy') {
    pr.armAt = pr.age + sim.cfg.equipment.maisyDog.armTime;
    sim.emit('maisyLand', { id: pr.id, pos: { ...pr.pos }, ownerId: pr.ownerId });
  } else if (pr.type === 'lbd') {
    pr.armAt = pr.age + sim.cfg.equipment.lbd.armTime;
    // (too many down: the owner's oldest goes)
    const mine = sim.projectiles.filter((q) => q.type === 'lbd' && q.ownerId === pr.ownerId && !q.done);
    if (mine.length > sim.cfg.equipment.lbd.maxPlaced) {
      const old = mine[0];
      old.done = true;
      sim.emit('projectileGone', { id: old.id, fizzle: true });
    }
  }
}

export function updateGadget(sim, pr, dt) {
  if (pr.type === 'maisy') updateMaisy(sim, pr, dt);
  else if (pr.type === 'lbd') updateLbd(sim, pr, dt);
}

function updateMaisy(sim, pr, dt) {
  const C = sim.cfg.equipment.maisyDog;
  if (!pr.resting || pr.armAt == null || pr.age < pr.armAt) return;
  const hole = { x: pr.pos.x, y: pr.pos.y + C.holeY, z: pr.pos.z };
  if (!pr.hole) {
    pr.hole = { t: 0, kills: 0 };
    sim.emit('maisyOpen', { id: pr.id, pos: hole, ownerId: pr.ownerId, time: C.holeTime });
  }
  pr.hole.t += dt;
  if (pr.hole.t >= C.holeTime) {
    pr.done = true;
    sim.emit('maisyClose', { id: pr.id, pos: hole, kills: pr.hole.kills, ownerId: pr.ownerId });
    sim.emit('projectileGone', { id: pr.id });
    return;
  }
  for (const z of sim.zombies) {
    if (z.state === 'dead' || z.state === 'rising' || z.state === 'spawning' || z.state === 'dummy') continue;
    const dx = hole.x - z.pos.x, dz = hole.z - z.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > C.pullRadius || Math.abs(z.pos.y - pr.pos.y) > 3) continue;
    if (d < C.killRadius && pr.hole.kills < C.maxKills) {
      pr.hole.kills++;
      damageZombie(sim, z, 1e6, { playerId: pr.ownerId, part: 'torso', kind: 'vortex', dir: { x: dx / (d || 1), y: 0.5, z: dz / (d || 1) }, point: { ...z.pos }, force: 0, vortex: hole });
      continue;
    }
    // dragged in, harder the closer it gets (only zombies already loose in the map:
    // the ones still outside a window stay there)
    if (z.state !== 'chase') continue;
    const k = 1 - d / C.pullRadius;
    z.pull = { x: hole.x, z: hole.z, speed: C.pullSpeed[0] + (C.pullSpeed[1] - C.pullSpeed[0]) * k * k, ttl: 0.15 };
  }
}

function updateLbd(sim, pr, dt) {
  const C = sim.cfg.equipment.lbd;
  if (pr.pop != null) {
    pr.pop += dt;
    if (pr.pop >= C.popTime) {
      pr.done = true;
      explode(sim, { x: pr.pos.x, y: pr.pos.y + C.popHeight, z: pr.pos.z }, C.explode, pr.ownerId);
      sim.emit('projectileGone', { id: pr.id });
    }
    return;
  }
  if (!pr.resting || pr.armAt == null || pr.age < pr.armAt) return;
  if (!pr.armed) { pr.armed = true; sim.emit('lbdArmed', { id: pr.id, pos: { ...pr.pos } }); }
  for (const z of sim.zombies) {
    if (z.state === 'dead' || z.state === 'rising' || z.state === 'spawning' || z.state === 'dummy') continue;
    if (Math.hypot(z.pos.x - pr.pos.x, z.pos.z - pr.pos.z) > C.trigger || Math.abs(z.pos.y - pr.pos.y) > 1.6) continue;
    pr.pop = 0;
    sim.emit('lbdPop', { id: pr.id, pos: { ...pr.pos }, ownerId: pr.ownerId, height: C.popHeight, time: C.popTime });
    return;
  }
}
