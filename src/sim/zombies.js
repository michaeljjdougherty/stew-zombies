// =============================================================================
// Zombie simulation: spawning outside windows, tearing boards, climbing in,
// chasing, attacking, damage, dismemberment and death. No rendering.
// =============================================================================
import { moveBody, separateCircles } from './physics.js';
import { rotY, angleWrap, dist2D } from '../core/math.js';
import { zombieHealthForRound } from '../config.js';
import { maybeDrop, powerupActive } from './powerups.js';
import { activeLure } from './projectiles.js';

let _hitboxCache = [];

// Zombie settings for this zombie: Cheddars override the bits that differ.
export function zcfg(sim, z) {
  if (z.type !== 'cheddar') return sim.cfg.zombie;
  if (!sim._cheddarCfg) sim._cheddarCfg = { ...sim.cfg.zombie, ...sim.cfg.cheddar };
  return sim._cheddarCfg;
}

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
  const n = win.normal;
  const out = sim.rng.range(c.outsideSpawnDist[0], c.outsideSpawnDist[1]);
  const lateral = sim.rng.range(-3.5, 3.5);
  // tangent along the wall
  const tx = -n.z, tz = n.x;
  const z = makeZombie(sim, {
    type,
    pos: { x: win.exterior.x - n.x * out + tx * lateral, y: 0, z: win.exterior.z - n.z * out + tz * lateral },
    yaw: Math.atan2(n.x, n.z),
    health: zombieHealthForRound(round, c),
    state: 'approach',
    windowId: win.id,
  });
  win.queue.push(z.id);
  sim.zombies.push(z);
  sim.emit('zombieSpawn', { id: z.id, zombieType: type, pos: { ...z.pos }, windowId: win.id });
  return z;
}

// Clawing up out of the dirt (outdoor ground spawns).
export function spawnRising(sim, spot, round) {
  const c = sim.cfg.zombie;
  const type = pickZombieType(sim, round);
  const z = makeZombie(sim, {
    type,
    pos: { x: spot.x + sim.rng.range(-0.6, 0.6), y: -c.riseDepth, z: spot.z + sim.rng.range(-0.6, 0.6) },
    yaw: sim.rng.range(-Math.PI, Math.PI),
    health: zombieHealthForRound(round, c),
    state: 'rising',
  });
  z.riseFrom = z.pos.y;
  sim.zombies.push(z);
  sim.emit('zombieSpawn', { id: z.id, zombieType: type, pos: { ...z.pos }, windowId: null, rising: true });
  sim.emit('zombieRise', { id: z.id, pos: { x: z.pos.x, y: 0, z: z.pos.z } });
  return z;
}

// Cheddar Rounds: a hound comes down with a lightning strike.
export function spawnCheddar(sim, pos, health) {
  const z = makeZombie(sim, { type: 'cheddar', pos, yaw: sim.rng.range(-Math.PI, Math.PI), health, state: 'spawning' });
  sim.zombies.push(z);
  sim.emit('cheddarStrike', { id: z.id, pos: { ...z.pos } });
  sim.emit('zombieSpawn', { id: z.id, zombieType: 'cheddar', pos: { ...z.pos }, windowId: null });
  return z;
}

// Build a zombie record. Used by window spawns and by the firing range
// (standing target dummies and hordes that start inside).
export function makeZombie(sim, { type = 'walker', pos, yaw = 0, health, state = 'chase', windowId = null }) {
  const c = type === 'cheddar' ? { ...sim.cfg.zombie, ...sim.cfg.cheddar } : sim.cfg.zombie;
  const range = type === 'cheddar' ? c.speed : type === 'sprinter' ? c.sprintSpeed : type === 'runner' ? c.runSpeed : c.walkSpeed;
  return {
    id: sim.nextId++,
    type,
    speed: sim.rng.range(range[0], range[1]),
    pos: { x: pos.x, y: pos.y || 0, z: pos.z },
    vel: { x: 0, y: 0, z: 0 },
    yaw,
    radius: c.radius,
    height: c.height,
    stepHeight: c.stepHeight,
    grounded: true,
    health, maxHealth: health,
    state, stateTime: 0,
    windowId,
    attack: { phase: 'none', t: 0 },
    limbs: { armL: true, armR: true, head: true },
    limbDamage: { armL: 0, armR: 0 },
    stun: 0,
    tearTimer: 0,
    climbT: 0,
    targetId: null,
    scale: type === 'cheddar' ? sim.rng.range(0.9, 1.1) : sim.rng.range(0.93, 1.07),
    seed: Math.floor(sim.rng.next() * 1e9),
    moveSpeed: 0,
    region: sim.nav ? sim.nav.regionAt(pos) : null,
  };
}

// Firing range target: stands on its spot (or strafes) and faces the player.
function updateDummy(sim, z, dt) {
  const c = sim.cfg.zombie;
  const home = z.home;
  const moving = sim.range && sim.range.moving;
  let tx = home.x;
  if (moving) tx = home.x + Math.sin(sim.time * 0.8 + (z.seed % 100)) * (home.strafe || 1.6);
  const dx = tx - z.pos.x;
  const step = Math.max(-1.6 * dt, Math.min(1.6 * dt, dx));
  z.pos.x += step;
  z.pos.z = home.z;
  z.moveSpeed = Math.abs(step) / Math.max(dt, 1e-6);
  const p = nearestPlayer(sim, z.pos);
  if (p) faceToward(z, p.pos.x - z.pos.x, p.pos.z - z.pos.z, c.turnRate * 0.5, dt);
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
  if (z.type === 'cheddar') {
    if (z.limbs.head) hb.push({ part: 'head', sphere: true, c: P(0, 0.66, 0.62), r: 0.17 * s });
    hb.push({ part: 'torso', a: P(0, 0.58, -0.42), b: P(0, 0.62, 0.38), r: 0.22 * s });
    hb.push({ part: 'legs', a: P(0, 0.08, 0), b: P(0, 0.42, 0), r: 0.24 * s });
    return hb;
  }
  if (z.crawler) {
    // dragging itself along the floor, head low and forward
    if (z.limbs.head) hb.push({ part: 'head', sphere: true, c: P(0, 0.34, 0.78), r: 0.17 * s });
    hb.push({ part: 'torso', a: P(0, 0.26, 0.02), b: P(0, 0.3, 0.58), r: 0.24 * s });
    if (z.limbs.armL) hb.push({ part: 'armL', a: P(0.26, 0.3, 0.55), b: P(0.3, 0.08, 1.1), r: 0.085 * s });
    if (z.limbs.armR) hb.push({ part: 'armR', a: P(-0.26, 0.3, 0.55), b: P(-0.3, 0.08, 1.1), r: 0.085 * s });
    return hb;
  }
  if (z.limbs.head) hb.push({ part: 'head', sphere: true, c: P(0, 1.6, 0.1), r: 0.17 * s });
  hb.push({ part: 'torso', a: P(0, 0.98, 0), b: P(0, 1.38, 0.06), r: 0.25 * s });
  hb.push({ part: 'legs', a: P(0, 0.12, 0), b: P(0, 0.9, 0), r: 0.21 * s });
  if (z.limbs.armL) hb.push({ part: 'armL', a: P(0.27, 1.4, 0.05), b: P(0.24, 1.25, reach), r: 0.085 * s });
  if (z.limbs.armR) hb.push({ part: 'armR', a: P(-0.27, 1.4, 0.05), b: P(-0.24, 1.25, reach), r: 0.085 * s });
  return hb;
}

// During a half-court ritual, whoever holds the circle belongs to the blue
// spirit zombies: ordinary ones leave them alone.
function inRitual(sim, p) {
  const r = sim.quest && sim.quest.ritual;
  if (!r || !r.active) return false;
  const b = r.balls.find((q) => q.id === r.active);
  return !!b && Math.hypot(p.pos.x - b.x, p.pos.z - b.z) <= sim.cfg.quest.ritualCircle + 1.0;
}

function nearestPlayer(sim, pos, z = null) {
  let best = null, bd = Infinity;
  for (const p of sim.players) {
    if (!p.alive || p.downed) continue;
    if (z && !z.ritual && inRitual(sim, p)) continue;
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
  for (const z of sim.zombies) {
    const c = zcfg(sim, z);
    z.stateTime += dt;
    if (z.state === 'spawning') {
      z.moveSpeed = 0;
      const p = nearestPlayer(sim, z.pos);
      if (p) faceToward(z, p.pos.x - z.pos.x, p.pos.z - z.pos.z, c.turnRate, dt);
      if (z.stateTime >= c.spawnTime) { setState(sim, z, 'chase'); z.region = sim.nav.regionAt(z.pos); }
      continue;
    }
    if (z.stun > 0) z.stun -= dt;
    if (z.state === 'dummy') { updateDummy(sim, z, dt); continue; }
    if (z.state === 'rising') {
      const k = Math.min(1, z.stateTime / c.riseTime);
      z.pos.y = z.riseFrom * (1 - k * (2 - k));
      z.moveSpeed = 0;
      const p = nearestPlayer(sim, z.pos);
      if (p) faceToward(z, p.pos.x - z.pos.x, p.pos.z - z.pos.z, c.turnRate * 0.4, dt);
      if (k >= 1) { z.pos.y = 0; setState(sim, z, 'chase'); }
      continue;
    }
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
        const fence = win.kind === 'fence';
        z.climbT += dt / (c.climbTime * (fence ? c.fenceClimbMult : 1));
        const t = Math.min(1, z.climbT);
        z.pos.x = win.exterior.x + (win.interior.x - win.exterior.x) * t;
        z.pos.z = win.exterior.z + (win.interior.z - win.exterior.z) * t;
        // up and over a fence (they hang off the top), or a hop through a window
        z.pos.y = fence ? Math.sin(Math.PI * Math.min(1, t * 1.15)) * 2.3 : Math.sin(Math.PI * t) * 0.75;
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
        // a Stew Bomb nearby beats any player
        const lure = activeLure(sim, z.pos);
        const target = lure ? null : nearestPlayer(sim, z.pos, z);
        const goTo = lure ? { pos: lure.pos, region: lure.region } : target;
        z.targetId = target ? target.id : null;
        z.lured = !!lure;
        z.region = sim.nav.regionAt(z.pos, z.region);
        let dirX = 0, dirZ = 0;
        if (goTo) {
          const goal = sim.nav.nextPoint(z.pos, z.region, goTo.pos, goTo.region);
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
        if (lure && dist2D(lure.pos, z.pos) < 1.4) speed *= 0.05; // crowd round the pot

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
  const c = zcfg(sim, z);
  const a = z.attack;
  if (a.phase === 'windup') {
    a.t -= dt;
    if (a.t <= 0) {
      // does it connect?
      let victim = null;
      for (const p of sim.players) {
        if (!p.alive || p.downed) continue;
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
      if (!p.alive || p.downed) continue;
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
  if (player && player.boosts && player.boosts.power) amount *= player.boosts.power;   // half-court ritual
  if (player && powerupActive(sim, 'oneBite') && z.state !== 'dummy') amount = Math.max(amount, z.health);
  z.health -= amount;
  z.stun = c.hitStun;
  sim.emit('zombieHit', { id: z.id, playerId: info.playerId, part: info.part, kind: info.kind, point: info.point, dir: info.dir, damage: amount });

  // blasts tear limbs off; a big one that doesn't kill can take the legs (crawler)
  if (info.kind === 'explosive' && z.health > 0 && z.type !== 'cheddar') {
    const big = amount >= z.maxHealth * c.crawlerDamageFrac;
    if (big && !z.crawler && (z.state === 'chase' || z.state === 'dummy') && sim.rng.chance(c.crawlerChance)) {
      z.crawler = true;
      z.height = 0.7;
      z.speed = Math.min(z.speed, sim.rng.range(c.crawlSpeed[0], c.crawlSpeed[1]));
      sim.emit('zombieLimb', { id: z.id, limb: 'legs', dir: info.dir });
    }
    for (const limb of ['armL', 'armR']) {
      if (z.limbs[limb] && sim.rng.chance(big ? 0.4 : 0.15)) {
        z.limbs[limb] = false;
        sim.emit('zombieLimb', { id: z.id, limb, dir: info.dir });
      }
    }
  }

  // arms come off after enough damage to them
  if ((info.part === 'armL' || info.part === 'armR') && z.limbs[info.part]) {
    z.limbDamage[info.part] += amount;
    if (z.limbDamage[info.part] >= z.maxHealth * c.armLossFraction) {
      z.limbs[info.part] = false;
      sim.emit('zombieLimb', { id: z.id, limb: info.part, dir: info.dir });
    }
  }

  // saw blades take arms off as they go through
  if (info.kind === 'saw' && z.type !== 'cheddar') {
    for (const limb of ['armL', 'armR']) {
      if (z.limbs[limb] && sim.rng.chance(0.45)) { z.limbs[limb] = false; sim.emit('zombieLimb', { id: z.id, limb, dir: info.dir }); }
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
  sim.lastKill = { pos: { ...z.pos }, type: z.type };
  sim.emit('zombieKilled', {
    id: z.id, pos: { ...z.pos }, yaw: z.yaw, part: info.part, kind: info.kind, zombieType: z.type,
    dir: info.dir, headshot: !!info.headshot, wasState, playerId: info.playerId, force: info.force || 0, crawler: !!z.crawler,
    fling: info.fling || null,
  });
  maybeDrop(sim, z, { ...info, wasState });
}
