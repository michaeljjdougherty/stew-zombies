// =============================================================================
// The M2 Flamethrower: a jet of fire in a cone in front of you. Everything it
// touches catches and burns until it's dead (whatever its health, the fire
// takes it down in `burnKill` seconds); the flame itself only scorches. The
// gun has no ammo: it heats up as you fire and locks out when it overheats.
// =============================================================================
import { damageZombie } from './zombies.js';

const DEG = Math.PI / 180;

// One burst of the jet (the host works it out; a client sends it over).
export function flameBurst(sim, p, eye, dir, def, weapon) {
  const F = def.flame;
  const cosA = Math.cos(F.angle * DEG);
  const hits = [];
  for (const z of sim.zombies) {
    if (z.state === 'dead') continue;
    if (z.state === 'rising' && z.pos.y < -0.8) continue;
    // anywhere on the body will do: its feet, middle or head
    let best = null;
    for (const h of z.crawler ? [0.2, 0.4] : [0.3, 1.0, 1.6]) {
      const c = { x: z.pos.x, y: z.pos.y + h, z: z.pos.z };
      const dx = c.x - eye.x, dy = c.y - eye.y, dz = c.z - eye.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > F.range) continue;
      const dot = d > 0.01 ? (dx * dir.x + dy * dir.y + dz * dir.z) / d : 1;
      if (d > F.near && dot < cosA) continue;
      if (d > 0.6 && sim.raycastWorld(eye, { x: dx / d, y: dy / d, z: dz / d }, d - 0.4, true)) continue;
      best = { z, d, c };
      break;
    }
    if (best) hits.push(best);
  }
  hits.sort((a, b) => a.d - b.d);
  for (const { z, c } of hits.slice(0, F.maxTargets)) {
    ignite(sim, z, p.id, F, weapon);
    if (F.damage > 0 && z.state !== 'dead') damageZombie(sim, z, F.damage, { playerId: p.id, part: 'torso', kind: 'fire', dir, point: c, weapon, quiet: true });
  }
}

// Set one alight (or keep it burning, now on your account).
export function ignite(sim, z, playerId, F, weapon) {
  if (z.state === 'dead') return;
  const dps = z.maxHealth / F.burnKill;
  if (z.burn) { z.burn.by = playerId; z.burn.dps = Math.max(z.burn.dps, dps); return; }
  z.burn = { by: playerId, dps, tick: 0, weapon };
  sim.emit('zombieIgnite', { id: z.id, playerId, pos: { ...z.pos } });
  // (catching fire is the one hit that pays)
  const pl = sim.playerById(playerId);
  if (pl) sim.addPoints(pl, sim.cfg.points.hit, 'hit');
}

// The burning burn on (the host), a tick at a time.
export function updateBurning(sim, dt) {
  const every = sim.cfg.flameTick;
  for (const z of sim.zombies) {
    if (!z.burn || z.state === 'dead') continue;
    z.burn.tick += dt;
    if (z.burn.tick < every) continue;
    const dmg = z.burn.dps * z.burn.tick;
    z.burn.tick = 0;
    damageZombie(sim, z, dmg, { playerId: z.burn.by, part: 'torso', kind: 'fire', dir: { x: 0, y: 1, z: 0 }, point: { x: z.pos.x, y: z.pos.y + 1, z: z.pos.z }, weapon: z.burn.weapon, quiet: true });
  }
}

// The gun's heat: up while you fire, down when you don't; at full it locks
// out for a while. True while it can fire.
export function flameHeat(sim, p, slot, def, firing, dt) {
  const H = def.heat;
  slot.heat = slot.heat || 0;
  if (slot.overheat > 0) {
    slot.overheat -= dt;
    slot.heat = Math.max(0, slot.heat - H.cool * dt);
    if (slot.overheat <= 0) { slot.overheat = 0; sim.emit('flameCooled', { playerId: p.id }); }
    return false;
  }
  if (firing) slot.heat = Math.min(1, slot.heat + H.up * dt);
  else slot.heat = Math.max(0, slot.heat - H.cool * dt);
  if (slot.heat >= 1) { slot.overheat = H.lock; sim.emit('flameOverheat', { playerId: p.id }); return false; }
  return true;
}
