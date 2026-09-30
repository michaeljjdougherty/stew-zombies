// =============================================================================
// Weapons & knife simulation: firing, spread, recoil, reloads, ADS, melee.
// Weapon stats come from CONFIG.weapons; nothing here is weapon-specific.
// =============================================================================
import { lookDir, coneDir, DEG, clamp, lerp, dist2D } from '../core/math.js';
import { damageZombie } from './zombies.js';

export function createLoadout(sim, weaponId) {
  const def = sim.cfg.weapons[weaponId];
  return {
    slots: [{ id: weaponId, clip: def.magSize, reserve: def.reserve, upgraded: false }],
    current: 0,
    fireCooldown: 0,
    reloading: false, reloadTimer: 0, reloadTotal: 0, reloadAdded: false, reloadEmpty: false,
    adsAmount: 0,
    bloom: 0,
    recoilPitch: 0, recoilYaw: 0,   // radians, added to view and aim
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
  const ads = s.ads + w.bloom * (s.adsPerShot / s.perShot) * 0.5 + moveFrac * s.moving * 0.15;
  let spread = lerp(hip, ads, w.adsAmount);
  if (p.crouching) spread *= s.crouchMult;
  return spread;
}

export function updateWeapons(sim, p, cmd, dt) {
  const w = p.loadout;
  const slot = w.slots[w.current];
  const def = sim.cfg.weapons[slot.id];

  updateMelee(sim, p, cmd, dt);

  if (w.fireCooldown > 0) w.fireCooldown -= dt;
  if (w.drawTimer > 0) w.drawTimer -= dt;

  // --- weapon switching
  let want = -1;
  if (cmd.weaponSlot >= 0 && cmd.weaponSlot < w.slots.length && cmd.weaponSlot !== w.current) want = cmd.weaponSlot;
  if (cmd.weaponCycle && w.slots.length > 1) want = (w.current + 1) % w.slots.length;
  if (want >= 0 && p.melee.timer <= 0) {
    if (w.reloading) cancelReload(sim, p);
    w.current = want;
    w.drawTimer = sim.cfg.weapons[w.slots[want].id].drawTime;
    w.adsAmount = 0;
    sim.emit('weaponSwitch', { playerId: p.id, weapon: w.slots[want].id });
    return;
  }

  // --- aim down sights
  const canAds = !p.sprinting && !w.reloading && p.melee.timer <= 0;
  const adsTarget = cmd.ads && canAds ? 1 : 0;
  const adsStep = dt / Math.max(0.01, def.adsTime);
  w.adsAmount = adsTarget > w.adsAmount ? Math.min(1, w.adsAmount + adsStep) : Math.max(0, w.adsAmount - adsStep);

  // --- spread and recoil settle
  w.bloom = Math.max(0, w.bloom - def.spread.recovery * dt);
  const settle = Math.exp(-def.recoil.recovery * dt);
  w.recoilPitch *= settle;
  w.recoilYaw *= settle;

  w.spreadNow = currentSpread(sim, p, def);

  // --- reload
  if (cmd.reloadPressed) tryReload(sim, p);
  if (w.reloading) {
    w.reloadTimer += dt;
    const frac = w.reloadTimer / w.reloadTotal;
    if (!w.reloadAdded && frac >= def.reloadAddAt) {
      const need = def.magSize - slot.clip;
      const take = Math.min(need, slot.reserve);
      slot.clip += take; slot.reserve -= take;
      w.reloadAdded = true;
      sim.emit('reloadMagIn', { playerId: p.id, weapon: slot.id });
    }
    if (w.reloadTimer >= w.reloadTotal) {
      w.reloading = false;
      sim.emit('reloadDone', { playerId: p.id, weapon: slot.id });
    }
  }

  // --- fire
  const blocked = !p.alive || p.sprinting || p.sprintOutTimer > 0 || w.reloading || p.melee.timer > 0 || w.drawTimer > 0;
  if (cmd.firePressed && (blocked || w.fireCooldown > 0)) p.fireBuffer = Math.max(p.fireBuffer, 0.22);
  if (!cmd.fire) w.dryFireLatch = false;

  let wantsFire = false;
  if (def.fireMode === 'auto') wantsFire = cmd.fire;
  else if (def.fireMode === 'semi') wantsFire = cmd.firePressed || p.fireBuffer > 0;
  else if (def.fireMode === 'burst') {
    if ((cmd.firePressed || p.fireBuffer > 0) && w.burstLeft <= 0) w.burstLeft = def.burstCount || 3;
    wantsFire = w.burstLeft > 0;
  }

  if (wantsFire && !blocked && w.fireCooldown <= 0) {
    p.fireBuffer = 0;
    if (slot.clip > 0) {
      fire(sim, p, slot, def);
      if (def.fireMode === 'burst') {
        w.burstLeft--;
        w.fireCooldown = w.burstLeft > 0 ? 60 / def.rpm : (def.burstDelay ?? 0.25);
      }
    } else {
      w.burstLeft = 0;
      if (!w.dryFireLatch) { sim.emit('dryFire', { playerId: p.id }); w.dryFireLatch = true; }
      tryReload(sim, p);
    }
  }

  // auto reload once the magazine runs dry
  if (slot.clip === 0 && slot.reserve > 0 && !w.reloading && !blocked && w.fireCooldown <= 0) tryReload(sim, p);
}

function fire(sim, p, slot, def) {
  const w = p.loadout;
  slot.clip--;
  w.shotsFired++;
  if (def.fireMode !== 'burst') w.fireCooldown = 60 / def.rpm;

  const eye = sim.eyePosition(p);
  const dir = lookDir(p.yaw + w.recoilYaw, p.pitch + w.recoilPitch);
  const s = def.spread;
  const spread = currentSpread(sim, p, def);

  const impacts = [];
  const pellets = def.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const d = coneDir(dir, spread * DEG, sim.rng);
    const hits = sim.hitscan(eye, d, def.range, def.penetration || 1);
    for (const h of hits) {
      impacts.push(h);
      if (h.kind === 'zombie') {
        const z = sim.zombieById(h.zombieId);
        if (!z) continue;
        let dmg = def.damage;
        if (h.t > def.falloffStart) {
          const f = clamp((h.t - def.falloffStart) / Math.max(1, def.range - def.falloffStart), 0, 1);
          dmg *= lerp(1, def.falloffMinMult, f);
        }
        if (h.part === 'head') dmg *= def.headMult ?? sim.cfg.zombie.headshotMult;
        else if (h.part !== 'torso') dmg *= def.limbMult ?? 0.8;
        dmg *= h.penetrationMult ?? 1;
        damageZombie(sim, z, dmg, { playerId: p.id, part: h.part, kind: 'bullet', dir: d, point: h.point, weapon: slot.id });
      }
    }
  }

  // bloom & recoil
  w.bloom += lerp(s.perShot, s.adsPerShot, w.adsAmount);
  const r = def.recoil;
  const kick = lerp(1, r.adsMult, w.adsAmount);
  w.recoilPitch += r.pitch * kick * DEG;
  w.recoilYaw += sim.rng.range(-r.yaw, r.yaw) * kick * DEG;

  sim.emit('shot', {
    playerId: p.id, weapon: slot.id, origin: eye, dir,
    impacts: impacts.map((h) => ({ kind: h.kind, point: h.point, normal: h.normal, zombieId: h.zombieId, part: h.part })),
    clip: slot.clip,
  });
}

export function tryReload(sim, p) {
  const w = p.loadout;
  const slot = w.slots[w.current];
  const def = sim.cfg.weapons[slot.id];
  if (w.reloading || slot.clip >= def.magSize || slot.reserve <= 0 || p.melee.timer > 0 || !p.alive) return false;
  w.reloading = true;
  w.reloadTimer = 0;
  w.reloadEmpty = slot.clip === 0;
  w.reloadTotal = w.reloadEmpty ? def.reloadEmptyTime : def.reloadTime;
  w.reloadAdded = false;
  w.burstLeft = 0;
  if (p.sprinting) { p.sprinting = false; }
  sim.emit('reloadStart', { playerId: p.id, weapon: slot.id, empty: w.reloadEmpty, time: w.reloadTotal });
  return true;
}

export function cancelReload(sim, p) {
  const w = p.loadout;
  if (!w.reloading) return;
  w.reloading = false;
  sim.emit('reloadCancel', { playerId: p.id, kept: w.reloadAdded });
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
    // line of sight at chest height (a wall between you and it blocks the stab)
    const target = { x: z.pos.x, y: z.pos.y + 1.2, z: z.pos.z };
    const tx = target.x - eye.x, ty = target.y - eye.y, tz = target.z - eye.z;
    const tl = Math.hypot(tx, ty, tz);
    const wh = sim.raycastWorld(eye, { x: tx / tl, y: ty / tl, z: tz / tl }, tl, true);
    if (wh) continue;
    out.push({ z, d });
  }
  out.sort((a, b) => a.d - b.d);
  return out;
}

function updateMelee(sim, p, cmd, dt) {
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
        damageZombie(sim, pick.z, mc.damage, { playerId: p.id, part: 'torso', kind: 'knife', dir: { x: -Math.sin(p.yaw), y: 0, z: -Math.cos(p.yaw) }, point: { x: pick.z.pos.x, y: pick.z.pos.y + 1.2, z: pick.z.pos.z } });
        sim.emit('meleeHit', { playerId: p.id, zombieId: pick.z.id });
      } else {
        sim.emit('meleeMiss', { playerId: p.id });
      }
    }
  }

  if (cmd.meleePressed && m.cooldown <= 0 && m.timer <= 0 && p.alive) {
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
    sim.emit('melee', { playerId: p.id, lunge });
  }
}
