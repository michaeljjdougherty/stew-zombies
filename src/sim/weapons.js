// =============================================================================
// Weapons, grenades & knife simulation: firing (semi/auto/burst, pump & bolt
// actions, dual wield, projectiles), spread, recoil, scope sway, reloads
// (magazine, break-open, cylinder, belt, shell-by-shell), ADS and melee.
// Weapon stats come from CONFIG.weapons; nothing here is weapon-specific.
// =============================================================================
import { lookDir, coneDir, DEG, clamp, lerp, dist2D } from '../core/math.js';
import { damageZombie } from './zombies.js';
import { spawnProjectile, explode } from './projectiles.js';

export function makeSlot(sim, id) {
  const def = sim.cfg.weapons[id];
  return { id, clip: def.magSize, clipL: def.dual ? def.magSize : 0, reserve: def.reserve, upgraded: false };
}

export function createLoadout(sim, weaponId) {
  const def = sim.cfg.weapons[weaponId];
  return {
    slots: [makeSlot(sim, weaponId)],
    current: 0,
    fireCooldown: 0, fireCooldownL: 0,
    reloading: false, reload: null,
    adsAmount: 0,
    bloom: 0,
    recoilPitch: 0, recoilYaw: 0,   // radians, added to view and aim
    swayPitch: 0, swayYaw: 0,       // scope sway, radians
    drawTimer: def.drawTime,
    burstLeft: 0,
    shotsFired: 0,
    dryFireLatch: false,
  };
}

export function currentSlot(p) { return p.loadout.slots[p.loadout.current]; }

// Cone half-angle in degrees for the next shot.
export function currentSpread(sim, p, def) {
  const w = p.loadout, s = def.spread;
  const moveFrac = clamp(p.moveSpeed / sim.cfg.player.walkSpeed, 0, 1.5);
  let hip = s.hipBase + w.bloom + moveFrac * s.moving + (p.grounded ? 0 : s.air);
  hip = Math.min(hip, s.hipMax + (p.grounded ? 0 : s.air));
  const ads = s.ads + w.bloom * (s.adsPerShot / Math.max(0.01, s.perShot)) * 0.5 + moveFrac * s.moving * 0.15;
  let spread = lerp(hip, ads, w.adsAmount);
  if (p.crouching) spread *= s.crouchMult;
  return spread;
}

function magFull(slot, def) {
  return slot.clip >= def.magSize && (!def.dual || slot.clipL >= def.magSize);
}

export function updateWeapons(sim, p, cmd, dt) {
  const w = p.loadout;
  const slot = w.slots[w.current];
  const def = sim.cfg.weapons[slot.id];

  updateMelee(sim, p, cmd, dt, def);
  updateGrenade(sim, p, cmd, dt);

  if (w.fireCooldown > 0) w.fireCooldown -= dt;
  if (w.fireCooldownL > 0) w.fireCooldownL -= dt;
  if (w.drawTimer > 0) w.drawTimer -= dt;

  // --- weapon switching
  let want = -1;
  if (cmd.weaponSlot >= 0 && cmd.weaponSlot < w.slots.length && cmd.weaponSlot !== w.current) want = cmd.weaponSlot;
  if (cmd.weaponCycle && w.slots.length > 1) want = (w.current + 1) % w.slots.length;
  if (want >= 0 && p.melee.timer <= 0 && !p.throwing) {
    if (w.reloading) cancelReload(sim, p);
    w.current = want;
    w.drawTimer = sim.cfg.weapons[w.slots[want].id].drawTime;
    w.adsAmount = 0;
    w.burstLeft = 0;
    sim.emit('weaponSwitch', { playerId: p.id, weapon: w.slots[want].id });
    return;
  }

  // --- aim down sights (dual wield uses right click as the left trigger instead)
  const canAds = !def.dual && !p.sprinting && !w.reloading && p.melee.timer <= 0 && !p.throwing;
  const adsTarget = cmd.ads && canAds ? 1 : 0;
  const adsStep = dt / Math.max(0.01, def.adsTime);
  w.adsAmount = adsTarget > w.adsAmount ? Math.min(1, w.adsAmount + adsStep) : Math.max(0, w.adsAmount - adsStep);

  // --- spread, recoil settle, scope sway
  w.bloom = Math.max(0, w.bloom - def.spread.recovery * dt);
  const settle = Math.exp(-def.recoil.recovery * dt);
  w.recoilPitch *= settle;
  w.recoilYaw *= settle;
  if (def.scope && w.adsAmount > 0.01) {
    const amp = def.scope.sway * DEG * w.adsAmount * (p.crouching ? 0.45 : 1) * (p.moveSpeed > 0.5 ? 1.6 : 1);
    w.swayPitch = Math.sin(sim.time * 1.15) * amp;
    w.swayYaw = Math.sin(sim.time * 0.71 + 1.3) * amp * 1.4;
  } else { w.swayPitch *= 0.85; w.swayYaw *= 0.85; }
  w.spreadNow = currentSpread(sim, p, def);

  // --- reload
  if (cmd.reloadPressed) tryReload(sim, p);
  if (w.reloading) updateReload(sim, p, slot, def, dt);

  // --- fire
  const shellReload = w.reloading && w.reload.style === 'shell' && slot.clip > 0;
  const blocked = !p.alive || p.sprinting || p.sprintOutTimer > 0 || (w.reloading && !shellReload) || p.melee.timer > 0 || w.drawTimer > 0 || p.throwing;
  if (cmd.firePressed && (blocked || w.fireCooldown > 0)) p.fireBuffer = Math.max(p.fireBuffer, 0.22);
  if (!cmd.fire) w.dryFireLatch = false;

  let wantsFire = false;
  if (def.fireMode === 'auto') wantsFire = cmd.fire;
  else if (def.fireMode === 'semi') wantsFire = cmd.firePressed || p.fireBuffer > 0;
  else if (def.fireMode === 'burst') {
    if ((cmd.firePressed || p.fireBuffer > 0) && w.burstLeft <= 0 && w.fireCooldown <= 0) w.burstLeft = def.burstCount || 3;
    wantsFire = w.burstLeft > 0;
  }

  if (wantsFire && !blocked && w.fireCooldown <= 0) {
    p.fireBuffer = 0;
    if (slot.clip > 0) {
      if (shellReload) cancelReload(sim, p, true);
      fire(sim, p, slot, def, 'R');
      if (def.fireMode === 'burst') {
        w.burstLeft--;
        w.fireCooldown = w.burstLeft > 0 && slot.clip > 0 ? 60 / def.rpm : (def.burstDelay ?? 0.25);
        if (slot.clip <= 0) w.burstLeft = 0;
      }
    } else {
      w.burstLeft = 0;
      if (!w.dryFireLatch) { sim.emit('dryFire', { playerId: p.id }); w.dryFireLatch = true; }
      tryReload(sim, p);
    }
  }

  // left gun of a dual-wield pair
  if (def.dual && !blocked && w.fireCooldownL <= 0) {
    const leftWants = def.fireMode === 'auto' ? cmd.ads : cmd.adsPressed;
    if (leftWants) {
      if (slot.clipL > 0) fire(sim, p, slot, def, 'L');
      else if (slot.clip === 0) tryReload(sim, p);
    }
  }

  // auto reload once the magazine(s) run dry
  const dry = def.dual ? slot.clip === 0 && slot.clipL === 0 : slot.clip === 0;
  if (dry && slot.reserve > 0 && !w.reloading && !blocked && w.fireCooldown <= 0) tryReload(sim, p);
}

// ---------------------------------------------------------------------------
function fire(sim, p, slot, def, side) {
  const w = p.loadout;
  if (side === 'L') { slot.clipL--; w.fireCooldownL = 60 / def.rpm; }
  else { slot.clip--; if (def.fireMode !== 'burst') w.fireCooldown = 60 / def.rpm; }
  w.shotsFired++;

  const eye = sim.eyePosition(p);
  const dir = lookDir(p.yaw + w.recoilYaw + w.swayYaw, p.pitch + w.recoilPitch + w.swayPitch);
  const s = def.spread;
  const spread = currentSpread(sim, p, def);

  const impacts = [];
  if (def.projectile) {
    const d = coneDir(dir, spread * DEG, sim.rng);
    const off = side === 'L' ? -0.12 : 0.12;
    const start = { x: eye.x + d.x * 0.5 + Math.cos(p.yaw) * off * 0.5, y: eye.y + d.y * 0.5 - 0.06, z: eye.z + d.z * 0.5 - Math.sin(p.yaw) * off * 0.5 };
    spawnProjectile(sim, def.projectile.type, start, { x: d.x * def.projectile.speed, y: d.y * def.projectile.speed, z: d.z * def.projectile.speed }, p.id, { ...def.projectile, weapon: slot.id });
  } else {
    const pellets = def.pellets || 1;
    // Pellets that hit the same zombie are summed into one hit (one set of points).
    const perZombie = new Map();
    for (let i = 0; i < pellets; i++) {
      const d = coneDir(dir, spread * DEG, sim.rng);
      const hits = sim.hitscan(eye, d, def.range, def.penetration || 1);
      for (const h of hits) {
        impacts.push(h);
        if (h.kind !== 'zombie') continue;
        let dmg = def.damage;
        if (h.t > def.falloffStart) {
          const f = clamp((h.t - def.falloffStart) / Math.max(1, def.range - def.falloffStart), 0, 1);
          dmg *= lerp(1, def.falloffMinMult, f);
        }
        if (h.part === 'head') dmg *= def.headMult ?? sim.cfg.zombie.headshotMult;
        else if (h.part !== 'torso') dmg *= def.limbMult ?? 0.8;
        dmg *= h.penetrationMult ?? 1;
        let acc = perZombie.get(h.zombieId);
        if (!acc) { acc = { dmg: 0, parts: {}, point: h.point, dir: d }; perZombie.set(h.zombieId, acc); }
        acc.dmg += dmg;
        acc.parts[h.part] = (acc.parts[h.part] || 0) + dmg;
      }
    }
    for (const [id, acc] of perZombie) {
      const z = sim.zombieById(id);
      if (!z) continue;
      const part = acc.parts.head ? 'head' : Object.entries(acc.parts).sort((a, b) => b[1] - a[1])[0][0];
      damageZombie(sim, z, acc.dmg, { playerId: p.id, part, kind: 'bullet', dir: acc.dir, point: acc.point, weapon: slot.id, pellets });
    }
  }

  // bloom & recoil
  w.bloom += lerp(s.perShot, s.adsPerShot, w.adsAmount);
  const r = def.recoil;
  const kick = lerp(1, r.adsMult, w.adsAmount);
  w.recoilPitch += r.pitch * kick * DEG;
  w.recoilYaw += sim.rng.range(-r.yaw, r.yaw) * kick * DEG + (side === 'L' ? -0.2 : side === 'R' && def.dual ? 0.2 : 0) * DEG;

  sim.emit('shot', {
    playerId: p.id, weapon: slot.id, origin: eye, dir, side,
    impacts: impacts.map((h) => ({ kind: h.kind, point: h.point, normal: h.normal, zombieId: h.zombieId, part: h.part, surface: h.surface })),
    clip: side === 'L' ? slot.clipL : slot.clip,
    action: def.action || null,
    projectile: def.projectile ? def.projectile.type : null,
  });
}

// ---------------------------------------------------------------------------
// Reloads
// ---------------------------------------------------------------------------
export function tryReload(sim, p) {
  const w = p.loadout;
  const slot = w.slots[w.current];
  const def = sim.cfg.weapons[slot.id];
  if (w.reloading || magFull(slot, def) || slot.reserve <= 0 || p.melee.timer > 0 || !p.alive || p.throwing) return false;
  const empty = slot.clip === 0 && (!def.dual || slot.clipL === 0);
  const style = def.reloadStyle;
  w.reloading = true;
  w.burstLeft = 0;
  if (style === 'shell') {
    w.reload = { style, phase: 'start', t: def.reloadStartTime, empty, shells: 0 };
  } else {
    const total = empty ? (def.reloadEmptyTime ?? def.reloadTime) : def.reloadTime;
    w.reload = { style, t: 0, total, added: false, empty };
  }
  if (p.sprinting) p.sprinting = false;
  sim.emit('reloadStart', {
    playerId: p.id, weapon: slot.id, empty, style,
    time: style === 'shell' ? def.reloadStartTime + def.shellTime * Math.min(def.magSize - slot.clip, slot.reserve) + def.reloadEndTime : w.reload.total,
    startTime: def.reloadStartTime, shellTime: def.shellTime, endTime: def.reloadEndTime,
  });
  return true;
}

function updateReload(sim, p, slot, def, dt) {
  const w = p.loadout, r = w.reload;
  if (r.style === 'shell') {
    r.t -= dt;
    if (r.t > 0) return;
    if (r.phase === 'start') { r.phase = 'shell'; r.t = def.shellTime; return; }
    if (r.phase === 'shell') {
      if (slot.reserve > 0 && slot.clip < def.magSize) {
        slot.clip++; slot.reserve--; r.shells++;
        sim.emit('reloadShell', { playerId: p.id, weapon: slot.id, clip: slot.clip });
      }
      if (slot.clip >= def.magSize || slot.reserve <= 0) {
        r.phase = 'end';
        r.t = def.reloadEndTime + (r.empty && def.action === 'pump' ? 0.2 : 0);
      } else r.t = def.shellTime;
      return;
    }
    w.reloading = false; w.reload = null;
    sim.emit('reloadDone', { playerId: p.id, weapon: slot.id, empty: r.empty });
    return;
  }
  r.t += dt;
  if (!r.added && r.t / r.total >= def.reloadAddAt) {
    let need = def.magSize - slot.clip;
    let take = Math.min(need, slot.reserve);
    slot.clip += take; slot.reserve -= take;
    if (def.dual) {
      need = def.magSize - slot.clipL;
      take = Math.min(need, slot.reserve);
      slot.clipL += take; slot.reserve -= take;
    }
    r.added = true;
    sim.emit('reloadMagIn', { playerId: p.id, weapon: slot.id });
  }
  if (r.t >= r.total) {
    w.reloading = false; w.reload = null;
    sim.emit('reloadDone', { playerId: p.id, weapon: slot.id, empty: r.empty });
  }
}

export function cancelReload(sim, p, byFiring = false) {
  const w = p.loadout;
  if (!w.reloading) return;
  const kept = w.reload && (w.reload.added || w.reload.shells > 0);
  w.reloading = false;
  w.reload = null;
  sim.emit('reloadCancel', { playerId: p.id, kept, byFiring });
}

// ---------------------------------------------------------------------------
// Giving weapons and ammo
// ---------------------------------------------------------------------------
// Give a weapon (wall buy, box). Owning it already = full ammo refill.
export function giveWeapon(sim, p, id) {
  const w = p.loadout;
  const def = sim.cfg.weapons[id];
  const have = w.slots.findIndex((s) => s.id === id);
  if (w.reloading) cancelReload(sim, p);
  if (have >= 0) {
    const s = w.slots[have];
    s.clip = def.magSize;
    if (def.dual) s.clipL = def.magSize;
    s.reserve = def.reserve;
    sim.emit('ammoRefill', { playerId: p.id, weapon: id });
    if (have !== w.current) {
      w.current = have;
      w.drawTimer = def.drawTime;
      sim.emit('weaponSwitch', { playerId: p.id, weapon: id });
    }
    return;
  }
  const slot = makeSlot(sim, id);
  if (w.slots.length < sim.cfg.player.maxWeapons) {
    w.slots.push(slot);
    w.current = w.slots.length - 1;
  } else {
    const old = w.slots[w.current].id;
    w.slots[w.current] = slot;
    sim.emit('weaponDropped', { playerId: p.id, weapon: old });
  }
  w.drawTimer = def.drawTime;
  w.adsAmount = 0;
  w.bloom = 0;
  w.burstLeft = 0;
  sim.emit('weaponGiven', { playerId: p.id, weapon: id });
}

// Max-ammo style refill of everything a player carries (used by power-ups later).
export function refillAll(sim, p) {
  for (const s of p.loadout.slots) {
    const def = sim.cfg.weapons[s.id];
    s.clip = def.magSize; if (def.dual) s.clipL = def.magSize;
    s.reserve = def.reserve;
  }
  p.grenades = Math.max(p.grenades, p.grenadeMax);
}

// ---------------------------------------------------------------------------
// Grenades: press G to pull the pin, hold to cook, release to throw.
// ---------------------------------------------------------------------------
function updateGrenade(sim, p, cmd, dt) {
  const g = sim.cfg.equipment.frag;
  const t = p.throwing;
  if (!t) {
    if (cmd.grenadePressed && p.grenades > 0 && p.alive && p.melee.timer <= 0) {
      if (p.loadout.reloading) cancelReload(sim, p);
      p.sprinting = false;
      p.loadout.adsAmount = 0;
      p.grenades--;
      p.throwing = { phase: 'cook', t: 0 };
      sim.emit('grenadePull', { playerId: p.id });
    }
    return;
  }
  if (t.phase === 'cook') {
    t.t += dt;
    if (t.t >= g.fuse) {
      // held it too long
      const eye = sim.eyePosition(p);
      explode(sim, { x: eye.x, y: eye.y - 0.3, z: eye.z }, 'cookedOff', p.id);
      p.throwing = { phase: 'recover', t: g.throwLock };
      return;
    }
    if (!cmd.grenade && t.t >= g.minCook) {
      const eye = sim.eyePosition(p);
      const d = lookDir(p.yaw, p.pitch + 0.08);
      const start = { x: eye.x + d.x * 0.4 + Math.cos(p.yaw) * 0.1, y: eye.y + d.y * 0.4, z: eye.z + d.z * 0.4 - Math.sin(p.yaw) * 0.1 };
      const vel = { x: d.x * g.throwSpeed + p.vel.x * 0.5, y: d.y * g.throwSpeed + g.throwUp, z: d.z * g.throwSpeed + p.vel.z * 0.5 };
      spawnProjectile(sim, 'frag', start, vel, p.id, { gravity: g.gravity, bounce: g.bounce, friction: g.friction, fuse: g.fuse - t.t, explode: g.explode });
      p.throwing = { phase: 'recover', t: g.throwLock };
      sim.emit('grenadeThrow', { playerId: p.id, cooked: t.t });
    }
    return;
  }
  t.t -= dt;
  if (t.t <= 0) p.throwing = null;
}

// ---------------------------------------------------------------------------
// Knife
// ---------------------------------------------------------------------------
function knifeCandidates(sim, p, maxRange, maxAngleDeg) {
  const eye = sim.eyePosition(p);
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const out = [];
  for (const z of sim.zombies) {
    if (z.state === 'dead') continue;
    const dx = z.pos.x - p.pos.x, dz = z.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > maxRange + sim.cfg.zombie.radius) continue;
    if (Math.abs((z.pos.y + 1.0) - (p.pos.y + 1.0)) > 1.4) continue;
    const cos = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
    if (cos < Math.cos(maxAngleDeg * DEG)) continue;
    const target = { x: z.pos.x, y: z.pos.y + (z.crawler ? 0.35 : 1.2), z: z.pos.z };
    const tx = target.x - eye.x, ty = target.y - eye.y, tz = target.z - eye.z;
    const tl = Math.hypot(tx, ty, tz);
    if (sim.raycastWorld(eye, { x: tx / tl, y: ty / tl, z: tz / tl }, tl, true)) continue;
    out.push({ z, d });
  }
  out.sort((a, b) => a.d - b.d);
  return out;
}

function updateMelee(sim, p, cmd, dt, def) {
  const m = p.melee, mc = sim.cfg.melee;
  if (m.cooldown > 0) m.cooldown -= dt;
  if (m.timer > 0) m.timer -= dt;

  if (m.lunge > 0) {
    m.lunge -= dt;
    const t = sim.zombieById(m.targetId);
    if (!t || dist2D(t.pos, p.pos) <= mc.range * 0.75) m.lunge = 0;
    if (m.lunge <= 0) { m.lunge = 0; m.lungeDir = null; p.vel.x *= 0.3; p.vel.z *= 0.3; }
  }
  if (m.hitPending && m.lunge <= 0) {
    m.hitAt -= dt;
    if (m.hitAt <= 0) {
      m.hitPending = false;
      const c = knifeCandidates(sim, p, mc.range, 50);
      const pick = c.find((e) => e.z.id === m.targetId) || c[0];
      if (pick) {
        const dmg = mc.damage * (def.meleeMult || 1);
        damageZombie(sim, pick.z, dmg, { playerId: p.id, part: 'torso', kind: 'knife', dir: { x: -Math.sin(p.yaw), y: 0, z: -Math.cos(p.yaw) }, point: { x: pick.z.pos.x, y: pick.z.pos.y + (pick.z.crawler ? 0.35 : 1.2), z: pick.z.pos.z } });
        sim.emit('meleeHit', { playerId: p.id, zombieId: pick.z.id });
      } else {
        sim.emit('meleeMiss', { playerId: p.id });
      }
    }
  }

  if (cmd.meleePressed && m.cooldown <= 0 && m.timer <= 0 && p.alive && !p.throwing) {
    if (p.loadout.reloading) cancelReload(sim, p);
    p.sprinting = false;
    p.loadout.adsAmount = 0;
    const c = knifeCandidates(sim, p, mc.lungeRange, mc.lungeAngle);
    const target = c[0]?.z || null;
    m.timer = mc.duration;
    m.cooldown = mc.cooldown;
    m.hitPending = true;
    m.hitAt = mc.hitDelay;
    m.targetId = target ? target.id : null;
    let lunge = false;
    if (target) {
      const d = dist2D(target.pos, p.pos);
      if (d > mc.range * 0.8) {
        const dx = target.pos.x - p.pos.x, dz = target.pos.z - p.pos.z;
        m.lungeDir = { x: dx / d, z: dz / d };
        m.lunge = Math.min(mc.lungeMaxTime, (d - mc.range * 0.7) / mc.lungeSpeed);
        lunge = true;
      }
    }
    sim.emit('melee', { playerId: p.id, lunge, blade: !!def.meleeMult });
  }
}
