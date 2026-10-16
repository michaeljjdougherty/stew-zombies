// =============================================================================
// The thrown and planted gadgets (they ride on the projectile list, so they
// replicate online like any grenade):
//   maisy  the Maisy Dog: lands, howls, and a black hole opens over her that
//          drags every zombie round it in and swallows it; then her too. Dive
//          into it and you come out somewhere else on the map
//   lbd    the LBD: a sleeping baby set down like a Bouncing Betty; a zombie
//          comes near, it wakes, pops up and goes off
// ...and what a tempered War Hammer leaves behind where it lands (hammers.js):
//   hfire  a pool of fire: anything in it burns down where it stands
//   hice   a blizzard: anything that comes in freezes solid, then shatters
//   hwind  a whirlwind where the head came down, dragging zombies in
//   hbolt  the Lightning Hammer's Wunderwaffe: a ball of lightning jumping zombie to zombie
// =============================================================================
import { damageZombie } from './zombies.js';
import { explode } from './projectiles.js';
import { ignite } from './flame.js';
import { teleport, randomSpot } from './gums.js';

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
  const C = { hfire: T.fire.pool, hice: T.ice.storm, hwind: T.wind.tornado, hbolt: { ...T.lightning.waffe, time: T.lightning.orb.time, max: pr.chains } }[pr.type];
  pr.kills = pr.kills || 0;
  if (pr.age >= C.time || pr.kills >= C.max) {
    pr.done = true;
    sim.emit('projectileGone', { id: pr.id, hammerFx: pr.type, pos: { ...pr.pos } });
    return;
  }
  // (whatever's standing in it takes this much of its health a tick: it's dead
  // in `s` seconds whatever the round)
  const sear = (z, s, kind) => {
    damageZombie(sim, z, z.maxHealth * dt / s, { playerId: pr.ownerId, part: 'torso', kind, dir: { x: 0, y: 1, z: 0 }, point: { x: z.pos.x, y: z.pos.y + 1, z: z.pos.z }, weapon: pr.weapon, quiet: true });
    if (z.state === 'dead') pr.kills++;
  };
  if (pr.type === 'hfire') {
    // anything in the fire burns down where it stands (killTime), and walks out
    // still alight (burnKill)
    for (const z of within(sim, pr, C.radius)) { ignite(sim, z, pr.ownerId, { burnKill: C.burnKill }, pr.weapon); sear(z, C.killTime, 'fire'); }
  } else if (pr.type === 'hice') {
    // anything in the blizzard freezes solid, and shatters once it's been in it shatterAfter s
    pr.chill = pr.chill || {};
    for (const z of within(sim, pr, C.radius)) {
      if (!(z.frozen > 0)) { z.frozen = C.freeze; sim.emit('zombieFrozen', { id: z.id, pos: { ...z.pos } }); }
      pr.chill[z.id] = (pr.chill[z.id] || 0) + dt;
      if (pr.chill[z.id] < C.shatterAfter) continue;
      damageZombie(sim, z, 1e6, { playerId: pr.ownerId, part: 'torso', kind: 'hammer', dir: { x: 0, y: 1, z: 0 }, point: { x: z.pos.x, y: z.pos.y + 1, z: z.pos.z }, force: 1, weapon: pr.weapon });
      if (z.state === 'dead') pr.kills++;
    }
  } else if (pr.type === 'hwind') {
    // the whirlwind (it can drift on down the line at `speed`; 0 stays where it
    // landed): whatever's near is dragged in and thrown, and torn apart (grind)
    // if it's caught on something on the way
    const step = C.speed * dt;
    const ahead = step > 0 && sim.raycastWorld({ x: pr.pos.x, y: pr.pos.y + 1.2, z: pr.pos.z }, { x: pr.dir.x, y: 0, z: pr.dir.z }, step + 0.6);
    if (step > 0 && !ahead) {
      const g = sim.raycastWorld({ x: pr.pos.x + pr.dir.x * step, y: pr.pos.y + 1.2, z: pr.pos.z + pr.dir.z * step }, { x: 0, y: -1, z: 0 }, 3); if (g) pr.pos.y = g.point.y;
      pr.pos.x += pr.dir.x * step; pr.pos.z += pr.dir.z * step;
    }
    for (const z of within(sim, pr, C.pull)) {
      const dx = pr.pos.x - z.pos.x, dz = pr.pos.z - z.pos.z, d = Math.hypot(dx, dz);
      if (d < C.catch) {
        pr.kills++;
        const a = Math.random() * Math.PI * 2;
        damageZombie(sim, z, 1e6, { playerId: pr.ownerId, part: 'torso', kind: 'wind', dir: { x: Math.cos(a), y: 1, z: Math.sin(a) }, point: { ...z.pos }, force: 1, weapon: pr.weapon, fling: { x: Math.cos(a), z: Math.sin(a), dist: 5 + Math.random() * 5, up: 4 + Math.random() * 2 } });
        continue;
      }
      sear(z, C.grind, 'wind');
      if (z.state !== 'chase') continue;
      const k = 1 - d / C.pull;
      z.pull = { x: pr.pos.x, z: pr.pos.z, speed: C.pullSpeed[0] + (C.pullSpeed[1] - C.pullSpeed[0]) * k, ttl: 0.15 };
    }
  } else if (pr.type === 'hbolt') {
    // the Wunderwaffe's ball of lightning: every `every` s it jumps to the nearest
    // zombie it hasn't had yet (within hop m) and kills it; nobody near, it's gone
    pr.zap = (pr.zap ?? 0) - dt;
    if (pr.zap > 0) return;
    pr.hit = pr.hit || [];
    let best = null, bd = C.hop;
    for (const z of within(sim, pr, C.hop, 4)) {
      if (pr.hit.includes(z.id)) continue;
      const d = Math.hypot(z.pos.x - pr.pos.x, z.pos.z - pr.pos.z);
      if (d < bd) { bd = d; best = z; }
    }
    if (!best) { pr.done = true; sim.emit('projectileGone', { id: pr.id, hammerFx: pr.type, pos: { ...pr.pos } }); return; }
    pr.zap = C.every; pr.kills++; pr.hit.push(best.id);
    const c = { x: best.pos.x, y: best.pos.y + (best.crawler ? 0.3 : 1.0), z: best.pos.z };
    damageZombie(sim, best, 1e6, { playerId: pr.ownerId, part: 'torso', kind: 'electric', dir: { x: 0, y: 1, z: 0 }, point: c, force: 1, weapon: pr.weapon });
    sim.emit('hammerZap', { id: pr.id, points: [{ ...pr.pos }, c] });
    pr.pos = { ...c };
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
  // dolphin dive into it and it throws you out somewhere else on the map (the
  // Gersh device's trick, from Ascension)
  const W = C.diveWarp;
  if (W) for (const p of sim.players) {
    if (!p.alive || p.downed || !p.dive || p.ride || p.launch) continue;
    if (Math.hypot(p.pos.x - hole.x, p.pos.z - hole.z) > W.radius || Math.abs(p.pos.y - pr.pos.y) > 2.5) continue;
    const spot = randomSpot(sim, p);
    if (!spot) continue;
    const from = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
    teleport(sim, p, spot);
    p.dive = null;
    p.invulnUntil = Math.max(p.invulnUntil || 0, sim.time + W.invuln);
    sim.emit('maisyWarp', { id: pr.id, playerId: p.id, from, to: { ...p.pos } });
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
