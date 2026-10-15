// =============================================================================
// The thrown and planted gadgets (they ride on the projectile list, so they
// replicate online like any grenade):
//   maisy  the Maisy Dog: lands, howls, and a black hole opens over her that
//          drags every zombie round it in and swallows it; then her too
//   lbd    the LBD: a sleeping baby set down like a Bouncing Betty; a zombie
//          comes near, it wakes, pops up and goes off
// ...and what a tempered War Hammer leaves behind where it lands (hammers.js):
//   hfire  a pool of fire: anything that walks in catches and burns down
//   hice   a blizzard: anything that comes in freezes solid
//   hwind  a tornado carrying on down the line of the swing, dragging zombies in
//   hbolt  a ball of lightning drifting on, striking anything near it
// =============================================================================
import { damageZombie } from './zombies.js';
import { explode } from './projectiles.js';
import { ignite } from './flame.js';

export const GADGETS = new Set(['maisy', 'lbd', 'hfire', 'hice', 'hwind', 'hbolt']);

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
  else updateHammerFx(sim, pr, dt);
}

// --- what a tempered War Hammer leaves behind ------------------------------------
const loose = (z) => z.state !== 'dead' && z.state !== 'rising' && z.state !== 'spawning' && z.state !== 'dummy';
function within(sim, pr, r, dy = 2.5) {
  return sim.zombies.filter((z) => loose(z) && Math.hypot(z.pos.x - pr.pos.x, z.pos.z - pr.pos.z) <= r && Math.abs(z.pos.y - pr.pos.y) < dy);
}
function updateHammerFx(sim, pr, dt) {
  const T = sim.cfg.crust.hammers.tempered;
  const C = { hfire: T.fire.pool, hice: T.ice.storm, hwind: T.wind.tornado, hbolt: T.lightning.orb }[pr.type];
  pr.kills = pr.kills || 0;
  if (pr.age >= C.time || pr.kills >= C.max) {
    pr.done = true;
    sim.emit('projectileGone', { id: pr.id, hammerFx: pr.type, pos: { ...pr.pos } });
    return;
  }
  if (pr.type === 'hfire') {
    // anything that walks into the fire catches
    for (const z of within(sim, pr, C.radius)) if (!z.burn) { ignite(sim, z, pr.ownerId, { burnKill: C.burnKill }, pr.weapon); pr.kills++; }
  } else if (pr.type === 'hice') {
    for (const z of within(sim, pr, C.radius)) if (!(z.frozen > 0)) { z.frozen = C.freeze; pr.kills++; sim.emit('zombieFrozen', { id: z.id, pos: { ...z.pos } }); }
  } else if (pr.type === 'hwind') {
    // the tornado carries on down the line; whatever's near is dragged in and thrown
    const step = C.speed * dt;
    const ahead = sim.raycastWorld({ x: pr.pos.x, y: pr.pos.y + 1.2, z: pr.pos.z }, { x: pr.dir.x, y: 0, z: pr.dir.z }, step + 0.6);
    if (!ahead) { const g = sim.raycastWorld({ x: pr.pos.x + pr.dir.x * step, y: pr.pos.y + 1.2, z: pr.pos.z + pr.dir.z * step }, { x: 0, y: -1, z: 0 }, 3); if (g) pr.pos.y = g.point.y; }
    if (!ahead) { pr.pos.x += pr.dir.x * step; pr.pos.z += pr.dir.z * step; }
    for (const z of within(sim, pr, C.pull)) {
      const dx = pr.pos.x - z.pos.x, dz = pr.pos.z - z.pos.z, d = Math.hypot(dx, dz);
      if (d < C.catch) {
        pr.kills++;
        const a = Math.random() * Math.PI * 2;
        damageZombie(sim, z, 1e6, { playerId: pr.ownerId, part: 'torso', kind: 'wind', dir: { x: Math.cos(a), y: 1, z: Math.sin(a) }, point: { ...z.pos }, force: 1, weapon: pr.weapon, fling: { x: Math.cos(a), z: Math.sin(a), dist: 5 + Math.random() * 5, up: 4 + Math.random() * 2 } });
        continue;
      }
      if (z.state !== 'chase') continue;
      const k = 1 - d / C.pull;
      z.pull = { x: pr.pos.x, z: pr.pos.z, speed: C.pullSpeed[0] + (C.pullSpeed[1] - C.pullSpeed[0]) * k, ttl: 0.15 };
    }
  } else if (pr.type === 'hbolt') {
    // the ball drifts on, and strikes the nearest thing to it every so often
    const step = C.speed * dt;
    const ahead = sim.raycastWorld(pr.pos, { x: pr.dir.x, y: 0, z: pr.dir.z }, step + 0.5);
    if (!ahead) { pr.pos.x += pr.dir.x * step; pr.pos.z += pr.dir.z * step; }
    pr.zap = (pr.zap ?? 0) - dt;
    if (pr.zap <= 0) {
      let best = null, bd = C.reach;
      for (const z of within(sim, pr, C.reach, 5)) { const d = Math.hypot(z.pos.x - pr.pos.x, z.pos.z - pr.pos.z); if (d < bd) { bd = d; best = z; } }
      if (best) {
        pr.zap = C.every; pr.kills++;
        const c = { x: best.pos.x, y: best.pos.y + (best.crawler ? 0.3 : 1.0), z: best.pos.z };
        damageZombie(sim, best, 1e6, { playerId: pr.ownerId, part: 'torso', kind: 'electric', dir: { x: 0, y: 1, z: 0 }, point: c, force: 1, weapon: pr.weapon });
        sim.emit('hammerZap', { id: pr.id, points: [{ ...pr.pos }, c] });
      }
    }
  }
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
