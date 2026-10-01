// =============================================================================
// Projectiles (thrown grenades, launcher rounds, crossbow bolts, ballistic
// knife blades) and explosions.
// =============================================================================
import { damageZombie } from './zombies.js';
import { rotY } from '../core/math.js';

// opts: gravity, bounce, friction, fuse, explode (explosion type), impactDamage, headMult, weapon
export function spawnProjectile(sim, type, pos, vel, ownerId, opts = {}) {
  const pr = {
    id: sim.nextId++,
    type, ownerId,
    pos: { ...pos }, vel: { ...vel },
    gravity: opts.gravity ?? 9.8,
    bounce: opts.bounce ?? 0,
    friction: opts.friction ?? 0.6,
    // bolts start their fuse when they stick; everything else when thrown/fired
    fuse: type === 'bolt' ? Infinity : (opts.fuse ?? Infinity),
    stickFuse: type === 'bolt' ? (opts.fuse ?? 1) : Infinity,
    explode: opts.explode || null,
    impactDamage: opts.impactDamage || 0,
    headMult: opts.headMult || 1,
    weapon: opts.weapon || null,
    stuck: null,          // { zombieId, local:{x,y,z}, yaw } or { wall:true }
    resting: false,
    age: 0,
    done: false,
  };
  sim.projectiles.push(pr);
  sim.emit('projectileSpawn', { id: pr.id, ptype: type, pos: { ...pr.pos }, vel: { ...pr.vel }, ownerId });
  return pr;
}

export function updateProjectiles(sim, dt) {
  for (const pr of sim.projectiles) {
    if (pr.done) continue;
    pr.age += dt;
    if (pr.stuck) {
      if (pr.stuck.zombieId != null) {
        const z = sim.zombieById(pr.stuck.zombieId);
        if (z) {
          const r = rotY(pr.stuck.local.x, pr.stuck.local.z, z.yaw - pr.stuck.yaw);
          pr.pos.x = z.pos.x + r.x; pr.pos.y = z.pos.y + pr.stuck.local.y; pr.pos.z = z.pos.z + r.z;
        } else {
          pr.stuck = { wall: true }; // host died: drop where it is
        }
      }
    } else if (!pr.resting) {
      step(sim, pr, dt);
    }
    if (pr.done) continue;
    pr.fuse -= dt;
    if (pr.fuse <= 0) detonate(sim, pr);
    else if (pr.type === 'blade' && pr.age > 8) { pr.done = true; sim.emit('projectileGone', { id: pr.id }); }
  }
  if (sim.projectiles.some((p) => p.done)) sim.projectiles = sim.projectiles.filter((p) => !p.done);
}

function step(sim, pr, dt) {
  pr.vel.y -= pr.gravity * dt;
  const dx = pr.vel.x * dt, dy = pr.vel.y * dt, dz = pr.vel.z * dt;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return;
  const dir = { x: dx / len, y: dy / len, z: dz / len };

  // zombies first (grenades bounce off them, everything else hits)
  const hits = sim.hitscan(pr.pos, dir, len, 1);
  const zh = hits.find((h) => h.kind === 'zombie');
  if (zh) { hitZombie(sim, pr, zh, dir); if (pr.done || pr.stuck) return; }

  const wh = sim.raycastWorld(pr.pos, dir, len);
  if (wh) {
    hitWorld(sim, pr, wh, dir);
    return;
  }
  pr.pos.x += dx; pr.pos.y += dy; pr.pos.z += dz;
  if (pr.pos.y < -5) { pr.done = true; sim.emit('projectileGone', { id: pr.id }); }
}

function hitZombie(sim, pr, h, dir) {
  const z = sim.zombieById(h.zombieId);
  if (!z) return;
  if (pr.type === 'frag') {
    // bounce off the body
    pr.vel.x *= -0.25; pr.vel.z *= -0.25; pr.vel.y *= 0.3;
    return;
  }
  if (pr.impactDamage) {
    const dmg = pr.impactDamage * (h.part === 'head' ? pr.headMult : 1);
    damageZombie(sim, z, dmg, { playerId: pr.ownerId, part: h.part, kind: pr.type === 'blade' ? 'blade' : 'bullet', dir, point: h.point, weapon: pr.weapon });
  }
  if (pr.type === 'launcher') {
    pr.pos = { ...h.point };
    detonate(sim, pr);
  } else if (pr.type === 'bolt' || pr.type === 'blade') {
    pr.pos = { ...h.point };
    const z2 = sim.zombieById(h.zombieId);
    if (z2) {
      pr.stuck = { zombieId: z2.id, local: { x: h.point.x - z2.pos.x, y: h.point.y - z2.pos.y, z: h.point.z - z2.pos.z }, yaw: z2.yaw };
    } else pr.stuck = { wall: true };
    pr.fuse = pr.stickFuse;
    sim.emit('projectileStick', { id: pr.id, ptype: pr.type, pos: { ...pr.pos }, zombieId: h.zombieId, dir });
  }
}

function hitWorld(sim, pr, h, dir) {
  const n = h.normal;
  if (pr.type === 'launcher') { pr.pos = { x: h.point.x + n.x * 0.05, y: h.point.y + n.y * 0.05, z: h.point.z + n.z * 0.05 }; detonate(sim, pr); return; }
  if (pr.type === 'bolt' || pr.type === 'blade') {
    pr.pos = { x: h.point.x - dir.x * 0.05, y: h.point.y - dir.y * 0.05, z: h.point.z - dir.z * 0.05 };
    pr.stuck = { wall: true };
    pr.fuse = pr.stickFuse;
    sim.emit('projectileStick', { id: pr.id, ptype: pr.type, pos: { ...pr.pos }, zombieId: null, dir });
    return;
  }
  // bounce (grenades)
  const vn = pr.vel.x * n.x + pr.vel.y * n.y + pr.vel.z * n.z;
  const speed = Math.hypot(pr.vel.x, pr.vel.y, pr.vel.z);
  pr.vel.x -= (1 + pr.bounce) * vn * n.x;
  pr.vel.y -= (1 + pr.bounce) * vn * n.y;
  pr.vel.z -= (1 + pr.bounce) * vn * n.z;
  // friction on the tangent
  const f = pr.friction;
  pr.vel.x *= f + (1 - f) * Math.abs(n.x); pr.vel.z *= f + (1 - f) * Math.abs(n.z); pr.vel.y *= f + (1 - f) * Math.abs(n.y);
  pr.pos = { x: h.point.x + n.x * 0.04, y: h.point.y + n.y * 0.04, z: h.point.z + n.z * 0.04 };
  if (speed > 1.5) sim.emit('projectileBounce', { id: pr.id, pos: { ...pr.pos }, speed });
  if (n.y > 0.7 && Math.hypot(pr.vel.x, pr.vel.y, pr.vel.z) < 0.6) { pr.resting = true; pr.vel = { x: 0, y: 0, z: 0 }; }
}

function detonate(sim, pr) {
  if (pr.done) return;
  pr.done = true;
  if (pr.explode) explode(sim, pr.pos, pr.explode, pr.ownerId);
  sim.emit('projectileGone', { id: pr.id });
}

// Radius damage with line of sight. Zombies take full damage; the player who
// caused it takes `selfDamage` scaled by distance (other players are safe).
export function explode(sim, pos, typeName, ownerId) {
  const ex = sim.cfg.explosions[typeName];
  sim.emit('explosion', { pos: { ...pos }, radius: ex.radius, etype: typeName, shake: ex.shake, playerId: ownerId });
  for (const z of [...sim.zombies]) {
    if (z.state === 'dead') continue;
    const c = { x: z.pos.x, y: z.pos.y + (z.crawler ? 0.3 : 1.0), z: z.pos.z };
    const dx = c.x - pos.x, dy = c.y - pos.y, dz = c.z - pos.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > ex.radius + 0.4) continue;
    if (d > 0.3 && sim.raycastWorld(pos, { x: dx / d, y: dy / d, z: dz / d }, d - 0.2, true)) continue;
    const f = Math.max(ex.minFrac, 1 - d / (ex.radius + 0.4));
    const dir = d > 0.01 ? { x: dx / d, y: Math.max(0.3, dy / d), z: dz / d } : { x: 0, y: 1, z: 0 };
    damageZombie(sim, z, ex.damage * f, { playerId: ownerId, part: 'torso', kind: 'explosive', dir, point: c, force: f });
  }
  const owner = sim.playerById(ownerId);
  if (owner && owner.alive && ex.selfDamage > 0) {
    const c = { x: owner.pos.x, y: owner.pos.y + 1.0, z: owner.pos.z };
    const dx = c.x - pos.x, dy = c.y - pos.y, dz = c.z - pos.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < ex.radius && (d < 0.3 || !sim.raycastWorld(pos, { x: dx / d, y: dy / d, z: dz / d }, d - 0.2, true))) {
      const dmg = ex.selfDamage * (1 - d / ex.radius);
      if (dmg > 1) sim.damagePlayer(owner, dmg, { pos: { x: pos.x, z: pos.z } });
    }
  }
}
