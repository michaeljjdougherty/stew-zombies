// =============================================================================
// Zombie simulation: spawning outside windows, tearing boards, climbing in,
// chasing, attacking, damage, dismemberment and death. No rendering.
// =============================================================================
import { moveBody, separateCircles } from './physics.js';
import { rotY, angleWrap, dist2D } from '../core/math.js';
import { zombieHealthForRound } from '../config.js';

let _hitboxCache = [];

export function pickZombieType(sim, round) {
  const c = sim.cfg.zombie;
  const runner = Math.min(c.runnerMax, Math.max(0, (round - c.runnerStartRound + 1) * c.runnerPerRound));
  const sprinter = Math.min(c.sprinterMax, Math.max(0, (round - c.sprinterStartRound + 1) * c.sprinterPerRound));
  const r = sim.rng.next();
  if (r < sprinter) return 'sprinter';
  if (r < sprinter + runner * (1 - sprinter)) return 'runner';
  return 'walker';
}

export function spawnZombie(sim, win, round) {
  const c = sim.cfg.zombie;
  const type = pickZombieType(sim, round);
  const range = type === 'sprinter' ? c.sprintSpeed : type === 'runner' ? c.runSpeed : c.walkSpeed;
  const n = win.normal;
  const out = sim.rng.range(c.outsideSpawnDist[0], c.outsideSpawnDist[1]);
  const lateral = sim.rng.range(-3.5, 3.5);
  // tangent along the wall
  const tx = -n.z, tz = n.x;
  const hp = zombieHealthForRound(round, c);
  const z = {
    id: sim.nextId++,
    type,
    speed: sim.rng.range(range[0], range[1]),
    pos: { x: win.exterior.x - n.x * out + tx * lateral, y: 0, z: win.exterior.z - n.z * out + tz * lateral },
    vel: { x: 0, y: 0, z: 0 },
    yaw: Math.atan2(n.x, n.z),
    radius: c.radius,
    height: c.height,
    stepHeight: c.stepHeight,
    grounded: true,
    health: hp, maxHealth: hp,
    state: 'approach', stateTime: 0,
    windowId: win.id,
    attack: { phase: 'none', t: 0 },
    limbs: { armL: true, armR: true, head: true },
    limbDamage: { armL: 0, armR: 0 },
    stun: 0,
    tearTimer: 0,
    climbT: 0,
    targetId: null,
    scale: sim.rng.range(0.93, 1.07),
    seed: Math.floor(sim.rng.next() * 1e9),
    moveSpeed: 0,
  };
  win.queue.push(z.id);
  sim.zombies.push(z);
  sim.emit('zombieSpawn', { id: z.id, zombieType: type, pos: { ...z.pos }, windowId: win.id });
  return z;
}

// Hitboxes in world space. Model faces +Z at yaw 0; its left side is +X.
export function zombieHitboxes(z) {
  const s = z.scale;
  const P = (x, y, zz) => {
    const r = rotY(x * s, zz * s, z.yaw);
    return { x: z.pos.x + r.x, y: z.pos.y + y * s, z: z.pos.z + r.z };
  };
  const reach = z.type === 'walker' ? 0.62 : 0.35;
  const hb = _hitboxCache;
  hb.length = 0;
  if (z.limbs.head) hb.push({ part: 'head', sphere: true, c: P(0, 1.6, 0.1), r: 0.17 * s });
  hb.push({ part: 'torso', a: P(0, 0.98, 0), b: P(0, 1.38, 0.06), r: 0.25 * s });
  hb.push({ part: 'legs', a: P(0, 0.12, 0), b: P(0, 0.9, 0), r: 0.21 * s });
  if (z.limbs.armL) hb.push({ part: 'armL', a: P(0.27, 1.4, 0.05), b: P(0.24, 1.25, reach), r: 0.085 * s });
  if (z.limbs.armR) hb.push({ part: 'armR', a: P(-0.27, 1.4, 0.05), b: P(-0.24, 1.25, reach), r: 0.085 * s });
  return hb;
}

function nearestPlayer(sim, pos) {
  let best = null, bd = Infinity;
  for (const p of sim.players) {
    if (!p.alive) continue;
    const d = dist2D(p.pos, pos);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function faceToward(z, dx, dz, rate, dt) {
  if (Math.abs(dx) + Math.abs(dz) < 1e-5) return;
  const target = Math.atan2(dx, dz);
  const diff = angleWrap(target - z.yaw);
  const step = rate * dt;
  z.yaw = angleWrap(z.yaw + Math.max(-step, Math.min(step, diff)));
}

function setState(sim, z, s) {
  z.state = s;
  z.stateTime = 0;
}

export function updateZombies(sim, dt) {
  const c = sim.cfg.zombie;
  for (const z of sim.zombies) {
    z.stateTime += dt;
    if (z.stun > 0) z.stun -= dt;
    const win = sim.windowById(z.windowId);
    const bx = z.pos.x, bz = z.pos.z;

    switch (z.state) {
      case 'approach':
      case 'waiting': {
        const idx = win.queue.indexOf(z.id);
        const n = win.normal;
        const tx = -n.z, tz = n.x;
        const lateral = idx === 0 ? 0 : ((idx % 2) ? 0.6 : -0.6);
        const slot = {
          x: win.exterior.x - n.x * idx * c.queueSpacing + tx * lateral,
          z: win.exterior.z - n.z * idx * c.queueSpacing + tz * lateral,
        };
        const dx = slot.x - z.pos.x, dz = slot.z - z.pos.z;
        const d = Math.hypot(dx, dz);
        const sp = Math.min(z.speed, 2.6);
        if (d > 0.08) {
          const step = Math.min(d, sp * dt);
          z.pos.x += (dx / d) * step;
          z.pos.z += (dz / d) * step;
          faceToward(z, dx, dz, c.turnRate, dt);
          z.state = 'approach';
        } else {
          faceToward(z, n.x, n.z, c.turnRate, dt);
          if (idx === 0) {
            if (win.boards > 0) { setState(sim, z, 'tearing'); z.tearTimer = c.tearInterval * 0.6; }
            else startClimb(sim, z, win);
          } else z.state = 'waiting';
        }
        break;
      }

      case 'tearing': {
        faceToward(z, win.normal.x, win.normal.z, c.turnRate, dt);
        updateAttack(sim, z, dt, true, win);
        if (z.attack.phase !== 'none') break;
        z.tearTimer -= dt;
        if (win.boards <= 0) { if (z.tearTimer <= 0) startClimb(sim, z, win); break; }
        if (z.tearTimer <= 0) {
          win.boards--;
          z.tearTimer = c.tearInterval;
          sim.emit('boardTorn', { windowId: win.id, board: win.boards, zombieId: z.id });
          if (win.boards <= 0) z.tearTimer = 0.35; // short beat before climbing
        }
        break;
      }

      case 'climbing': {
        z.climbT += dt / c.climbTime;
        const t = Math.min(1, z.climbT);
        z.pos.x = win.exterior.x + (win.interior.x - win.exterior.x) * t;
        z.pos.z = win.exterior.z + (win.interior.z - win.exterior.z) * t;
        z.pos.y = Math.sin(Math.PI * t) * 0.75;
        if (t >= 1) {
          z.pos.y = 0;
          win.climbing = null;
          setState(sim, z, 'chase');
          z.grounded = true;
          z.region = sim.nav.regionAt(z.pos);
          const chance = c.screamChance[z.type] ?? 0.2;
          sim.emit('zombieEnter', { id: z.id, windowId: win.id });
          if (sim.rng.chance(chance)) sim.emit('zombieScream', { id: z.id, pos: { ...z.pos } });
        }
        break;
      }

      case 'chase': {
        const target = nearestPlayer(sim, z.pos);
        z.targetId = target ? target.id : null;
        z.region = sim.nav.regionAt(z.pos, z.region);
        let dirX = 0, dirZ = 0;
        if (target) {
          const goal = sim.nav.nextPoint(z.pos, z.region, target.pos, target.region);
          const dx = goal.x - z.pos.x, dz = goal.z - z.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          dirX = dx / d; dirZ = dz / d;
          // steer around corners, locker ends and furniture in the way
          if (d > 0.8) {
            const look = Math.min(0.9, d);
            if (blocked(sim, z, dirX, dirZ, look)) {
              const pref = z.avoidSign || 1;
              for (const a of [0.45, -0.45, 0.9, -0.9, 1.35, -1.35]) {
                const ang = a * pref;
                const c = Math.cos(ang), sn = Math.sin(ang);
                const tx = dirX * c - dirZ * sn, tz = dirX * sn + dirZ * c;
                if (!blocked(sim, z, tx, tz, look)) { dirX = tx; dirZ = tz; z.avoidSign = Math.sign(ang); break; }
              }
            }
          }
          // stuck on furniture? step sideways for a moment
          if (z.sidestep > 0) {
            z.sidestep -= dt;
            const gx = dirX, gz = dirZ;
            dirX = gx * 0.35 - gz * z.sideSign;
            dirZ = gz * 0.35 + gx * z.sideSign;
          }
          faceToward(z, dirX, dirZ, c.turnRate, dt);
        }
        // separation from other zombies
        let sx = 0, sz = 0;
        for (const o of sim.zombies) {
          if (o === z || o.state !== 'chase') continue;
          const ox = z.pos.x - o.pos.x, oz = z.pos.z - o.pos.z;
          const od = Math.hypot(ox, oz);
          if (od > 0.001 && od < c.separationRadius) {
            const f = (c.separationRadius - od) / c.separationRadius;
            sx += (ox / od) * f; sz += (oz / od) * f;
          }
        }
        dirX += sx * c.separationStrength * 0.5;
        dirZ += sz * c.separationStrength * 0.5;
        const dl = Math.hypot(dirX, dirZ) || 1;
        dirX /= dl; dirZ /= dl;

        updateAttack(sim, z, dt, false, null, target);
        let speed = z.speed;
        if (z.attack.phase !== 'none') speed *= 0.2;
        if (z.stun > 0) speed *= 0.35;
        // stop short when already in swing range
        if (target && dist2D(target.pos, z.pos) < c.attackRange * 0.75) speed *= 0.1;

        const k = 1 - Math.exp(-c.accel * dt);
        z.vel.x += (dirX * speed - z.vel.x) * k;
        z.vel.z += (dirZ * speed - z.vel.z) * k;
        const px = z.pos.x, pz = z.pos.z;
        moveBody(z, dt, [sim.world.solids], sim.cfg.player.gravity);
        // stuck detection: wanted to move but barely did
        const moved = Math.hypot(z.pos.x - px, z.pos.z - pz) / dt;
        if (speed > 0.5 && moved < speed * 0.25 && z.attack.phase === 'none') {
          z.stuckT = (z.stuckT || 0) + dt;
          if (z.stuckT > c.stuckTime && !(z.sidestep > 0)) {
            z.sidestep = c.sidestepTime;
            z.sideSign = sim.rng.chance(0.5) ? 1 : -1;
            z.stuckT = 0;
          }
        } else z.stuckT = Math.max(0, (z.stuckT || 0) - dt * 2);
        break;
      }
    }

    // keep outside zombies from stacking on each other
    if (z.state === 'approach' || z.state === 'waiting') {
      for (const o of sim.zombies) {
        if (o !== z && (o.state === 'approach' || o.state === 'waiting') && o.windowId === z.windowId) {
          separateCircles(z.pos, 0.3, o.pos, 0.3, 0.5);
        }
      }
    }
    z.moveSpeed = Math.hypot(z.pos.x - bx, z.pos.z - bz) / dt;
  }
}

function startClimb(sim, z, win) {
  if (win.climbing && win.climbing !== z.id) return; // someone is already coming through
  const qi = win.queue.indexOf(z.id);
  if (qi >= 0) win.queue.splice(qi, 1);
  win.climbing = z.id;
  z.climbT = 0;
  z.attack.phase = 'none';
  setState(sim, z, 'climbing');
  sim.emit('zombieClimb', { id: z.id, windowId: win.id });
}

// Attack logic. `throughWindow` = zombie is at a window swiping at players inside.
function updateAttack(sim, z, dt, throughWindow, win, target) {
  const c = sim.cfg.zombie;
  const a = z.attack;
  if (a.phase === 'windup') {
    a.t -= dt;
    if (a.t <= 0) {
      // does it connect?
      let victim = null;
      for (const p of sim.players) {
        if (!p.alive) continue;
        const d = dist2D(p.pos, z.pos);
        if (d < c.attackHitRange && Math.abs(p.pos.y - z.pos.y) < c.attackHeightTolerance) {
          const dx = p.pos.x - z.pos.x, dz = p.pos.z - z.pos.z;
          const fx = Math.sin(z.yaw), fz = Math.cos(z.yaw);
          if ((dx * fx + dz * fz) / (d || 1) > 0.2) { victim = p; break; }
        }
      }
      sim.emit('zombieSwingEnd', { id: z.id, hit: !!victim });
      if (victim) sim.damagePlayer(victim, c.attackDamage, z);
      a.phase = 'recover';
      a.t = c.attackRecover;
    }
    return;
  }
  if (a.phase === 'recover') {
    a.t -= dt;
    if (a.t <= 0) a.phase = 'none';
    return;
  }
  // start a swing?
  let victim = null;
  if (throughWindow) {
    for (const p of sim.players) {
      if (!p.alive) continue;
      if (dist2D(p.pos, win.center) < c.windowAttackRange + 0.4) { victim = p; break; }
    }
  } else if (target) {
    const d = dist2D(target.pos, z.pos);
    if (d < c.attackRange && Math.abs(target.pos.y - z.pos.y) < c.attackHeightTolerance && canReach(sim, z, target)) victim = target;
  }
  if (victim && z.stun <= 0) {
    a.phase = 'windup';
    a.t = c.attackWindup;
    sim.emit('zombieSwing', { id: z.id, pos: { ...z.pos } });
  }
}

// Would a step of `dist` in direction (dx,dz) run into something too tall to step onto?
function blocked(sim, z, dx, dz, dist) {
  const px = z.pos.x + dx * dist, pz = z.pos.z + dz * dist;
  const r = z.radius * 0.9, y0 = z.pos.y + z.stepHeight, y1 = z.pos.y + z.height;
  for (const b of sim.world.solids) {
    if (b.maxY <= y0 || b.minY >= y1) continue;
    const cx = px < b.minX ? b.minX : px > b.maxX ? b.maxX : px;
    const cz = pz < b.minZ ? b.minZ : pz > b.maxZ ? b.maxZ : pz;
    if ((px - cx) ** 2 + (pz - cz) ** 2 < r * r) return true;
  }
  return false;
}

// No swiping through walls.
function canReach(sim, z, p) {
  const o = { x: z.pos.x, y: z.pos.y + 1.2, z: z.pos.z };
  const dx = p.pos.x - o.x, dy = p.pos.y + 1.2 - o.y, dz = p.pos.z - o.z;
  const l = Math.hypot(dx, dy, dz) || 1;
  return !sim.raycastWorld(o, { x: dx / l, y: dy / l, z: dz / l }, l, true);
}

export function damageZombie(sim, z, amount, info) {
  if (z.state === 'dead') return;
  const c = sim.cfg.zombie;
  const pts = sim.cfg.points;
  const player = sim.playerById(info.playerId);
  z.health -= amount;
  z.stun = c.hitStun;
  sim.emit('zombieHit', { id: z.id, part: info.part, kind: info.kind, point: info.point, dir: info.dir, damage: amount });

  // arms come off after enough damage to them
  if ((info.part === 'armL' || info.part === 'armR') && z.limbs[info.part]) {
    z.limbDamage[info.part] += amount;
    if (z.limbDamage[info.part] >= z.maxHealth * c.armLossFraction) {
      z.limbs[info.part] = false;
      sim.emit('zombieLimb', { id: z.id, limb: info.part, dir: info.dir });
    }
  }

  if (z.health <= 0) {
    const headshot = info.part === 'head';
    const knife = info.kind === 'knife';
    if (headshot && z.limbs.head) {
      z.limbs.head = false;
      sim.emit('zombieLimb', { id: z.id, limb: 'head', dir: info.dir });
    }
    if (player) {
      const p = knife ? pts.knifeKill : headshot ? pts.headshotKill : pts.kill;
      sim.addPoints(player, p, knife ? 'knife' : headshot ? 'headshot' : 'kill');
      player.kills++;
      if (headshot) player.headshots++;
      if (knife) player.knifeKills++;
    }
    killZombie(sim, z, { ...info, headshot });
  } else if (player) {
    sim.addPoints(player, pts.hit, 'hit');
  }
}

export function killZombie(sim, z, info = {}) {
  if (z.state === 'dead') return;
  const win = sim.windowById(z.windowId);
  if (win) {
    const qi = win.queue.indexOf(z.id);
    if (qi >= 0) win.queue.splice(qi, 1);
    if (win.climbing === z.id) win.climbing = null;
  }
  const wasState = z.state;
  z.state = 'dead';
  sim.emit('zombieKilled', {
    id: z.id, pos: { ...z.pos }, yaw: z.yaw, part: info.part, kind: info.kind,
    dir: info.dir, headshot: !!info.headshot, wasState, playerId: info.playerId,
  });
}
