// =============================================================================
// Player simulation: movement, sprint, stamina, health, interaction.
// Consumes an input command per tick. No rendering here.
// =============================================================================
import { moveBody, separateCircles } from './physics.js';
import { createLoadout, updateWeapons } from './weapons.js';
import { clamp } from '../core/math.js';
import { perkMult, updateDrinking } from './perks.js';
import { goDown } from './laststand.js';

// The shape of one tick of input. The client (or a network peer) fills this in.
export function emptyCommand() {
  return {
    moveX: 0, moveY: 0,       // strafe right +, forward +
    yaw: 0, pitch: 0,         // radians, absolute
    sprint: false, crouch: false,
    fire: false, firePressed: false,
    ads: false, adsPressed: false,   // right click (also the left gun when dual wielding)
    grenade: false, grenadePressed: false,
    tactical: false, tacticalPressed: false,   // [Q] stew bomb
    jumpPressed: false,
    reloadPressed: false,
    meleePressed: false,
    use: false, usePressed: false,
    weaponSlot: -1,           // -1 = no change
    weaponCycle: 0,
  };
}

export function createPlayer(sim, id, name, spawn) {
  const cfg = sim.cfg.player;
  return {
    id, name,
    pos: { x: spawn.x, y: 0, z: spawn.z },
    vel: { x: 0, y: 0, z: 0 },
    yaw: spawn.yaw, pitch: 0,
    radius: cfg.radius,
    height: cfg.height,
    stepHeight: cfg.stepHeight,
    grounded: true,
    crouching: false,
    sprinting: false,
    stamina: cfg.sprintDuration,
    sprintOutTimer: 0,
    fireBuffer: 0,
    jumpCooldown: 0,
    landSlowTimer: 0,
    lastLandImpact: 0,
    health: cfg.maxHealth,
    maxHealth: cfg.maxHealth,
    lastDamageTime: -999,
    alive: true,
    downed: null,             // last stand state (see laststand.js)
    perks: [],                // perk ids in the order bought
    drinking: null,           // { perk, t } while chugging a perk
    reviving: null,           // { targetId, frac } while picking up a teammate
    points: cfg.startPoints,
    kills: 0, headshots: 0, knifeKills: 0,
    boardPointsThisRound: 0,
    prompt: null,             // { text, cost } shown on HUD
    useTarget: null,
    loadout: createLoadout(sim, sim.cfg.startingWeapon),
    grenades: sim.cfg.equipment.frag.startWith,
    grenadeMax: sim.cfg.equipment.frag.startWith,
    stewBombs: 0,
    throwing: null,           // grenade in hand: { phase: 'cook' | 'recover', t }
    melee: { timer: 0, cooldown: 0, lunge: 0, lungeDir: null, targetId: null, hitPending: false, hitAt: 0 },
    moveSpeed: 0,             // horizontal speed, for camera bob / audio
    distanceWalked: 0,
  };
}

export function updatePlayer(sim, p, cmd, dt) {
  if (!p.alive) return;
  const cfg = sim.cfg.player;
  p.yaw = cmd.yaw;
  p.pitch = clamp(cmd.pitch, -sim.cfg.camera.pitchLimit * Math.PI / 180, sim.cfg.camera.pitchLimit * Math.PI / 180);

  if (!sim.replica) updateDrinking(sim, p, dt);   // (online: the host owns perks)
  const downed = !!p.downed;

  // --- stance
  p.crouching = downed || (cmd.crouch && p.grounded);
  p.height = downed ? 0.8 : p.crouching ? cfg.crouchHeight : cfg.height;
  const sprintMax = cfg.sprintDuration * perkMult(sim, p, 'sprintMult');

  // --- sprint state machine
  let mx = cmd.moveX, my = cmd.moveY;
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  const w = p.loadout;
  const wantsSprint = cmd.sprint && my > 0.3 && !p.crouching && !downed;
  const interrupt = cmd.ads || cmd.fire || cmd.firePressed || cmd.meleePressed || cmd.grenadePressed || cmd.tacticalPressed || !!p.throwing || !!p.drinking;
  if (p.sprinting) {
    if (!wantsSprint || p.stamina <= 0 || interrupt) {
      p.sprinting = false;
      p.sprintOutTimer = cfg.sprintToFireDelay;
      if (cmd.firePressed) p.fireBuffer = 0.3; // fire as soon as the gun comes up
    }
  } else if (wantsSprint && !cmd.ads && !cmd.fire && !p.throwing && !p.drinking && p.stamina >= Math.min(cfg.sprintMinToStart, sprintMax) && p.melee.timer <= 0) {
    p.sprinting = true;
    if (w.reloading) sim.cancelReload(p);
  }
  if (p.sprinting) p.stamina = Math.max(0, p.stamina - dt);
  else p.stamina = Math.min(sprintMax, p.stamina + cfg.sprintRecoverRate * dt);
  if (p.sprintOutTimer > 0) p.sprintOutTimer -= dt;
  if (p.fireBuffer > 0) p.fireBuffer -= dt;

  // --- desired velocity
  const def = sim.weaponDef(w);
  let speed = p.sprinting ? cfg.sprintSpeed : cfg.walkSpeed * (def.moveSpeedMult ?? 1);
  if (!p.sprinting) {
    if (my < -0.1) speed *= cfg.backpedalMult;
    else if (Math.abs(mx) > Math.abs(my)) speed *= cfg.strafeMult;
    speed *= 1 + ((def.adsMoveMult ?? 0.6) - 1) * w.adsAmount;
  }
  if (p.crouching) speed *= cfg.crouchSpeedMult;
  speed *= perkMult(sim, p, 'speedMult');
  if (p.boosts && p.boosts.speed) speed *= p.boosts.speed;   // restored by the half-court ritual
  if (downed) speed = sim.cfg.lastStand.crawlSpeed;
  if (p.landSlowTimer > 0) { speed *= cfg.landSlowdownMult; p.landSlowTimer -= dt; }

  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  // forward = (-sin, -cos), right = (cos, -sin)
  const wx = (-sy * my + cy * mx) * speed;
  const wz = (-cy * my - sy * mx) * speed;

  // --- knife lunge overrides movement briefly
  if (p.melee.lunge > 0 && p.melee.lungeDir) {
    p.vel.x = p.melee.lungeDir.x * sim.cfg.melee.lungeSpeed;
    p.vel.z = p.melee.lungeDir.z * sim.cfg.melee.lungeSpeed;
  } else if (p.grounded) {
    const hasInput = mx * mx + my * my > 0.001;
    const rate = hasInput ? cfg.groundAccel : cfg.groundDecel;
    approach(p.vel, wx, wz, rate * dt);
  } else {
    // limited air control, no air friction
    if (mx * mx + my * my > 0.001) approach(p.vel, wx, wz, cfg.airAccel * dt);
  }

  // --- jump
  if (p.jumpCooldown > 0) p.jumpCooldown -= dt;
  if (cmd.jumpPressed && p.grounded && p.jumpCooldown <= 0 && !p.crouching && !downed) {
    p.vel.y = Math.sqrt(2 * cfg.gravity * cfg.jumpHeight * ((p.boosts && p.boosts.jump) || 1));
    p.grounded = false;
    p.jumpCooldown = cfg.jumpCooldown;
    sim.emit('playerJump', { playerId: p.id });
  }

  // --- move & collide
  const before = { x: p.pos.x, z: p.pos.z };
  const res = moveBody(p, dt, [sim.world.solids, sim.world.playerBlockers], cfg.gravity);
  if (res.landed) {
    p.landSlowTimer = res.impact > 4 ? cfg.landSlowdownTime : 0;
    p.lastLandImpact = res.impact;
    sim.emit('playerLand', { playerId: p.id, impact: res.impact });
  }

  // zombies are solid: they body-block you
  for (const z of sim.zombies) {
    if (z.state !== 'chase') continue;
    if (Math.abs(z.pos.y - p.pos.y) > 1.2) continue;
    separateCircles(p.pos, p.radius, z.pos, sim.cfg.zombie.radius * 0.9, 1);
  }
  // other players too
  for (const o of sim.players) {
    if (o !== p && o.alive) separateCircles(p.pos, p.radius, o.pos, o.radius, 0.5);
  }

  const moved = Math.hypot(p.pos.x - before.x, p.pos.z - before.z);
  p.moveSpeed = moved / dt;
  if (p.grounded) p.distanceWalked += moved;

  // --- weapons and knife
  updateWeapons(sim, p, cmd, dt);

  // online, the host does the buying, prompts and health for you
  if (sim.replica) return;
  updateUseAndHealth(sim, p, cmd, dt);
}

// Interaction prompts and health regen. Online, the host runs only this part
// for the other players: their own browsers move them and fire their guns.
function updateUseAndHealth(sim, p, cmd, dt) {
  const cfg = sim.cfg.player;
  const downed = !!p.downed;
  // --- interaction prompts (none while you're down)
  if (downed) {
    if (p.useTarget && p.useTarget.release) p.useTarget.release(sim, p);
    p.useTarget = null; p.prompt = null;
  } else updateInteraction(sim, p, cmd, dt);

  // --- health regen
  if (!downed && p.health < p.maxHealth && sim.time - p.lastDamageTime > cfg.regenDelay) {
    p.health = Math.min(p.maxHealth, p.health + cfg.regenRate * dt);
  }
}

// Host side of an online teammate: their browser reports where they are and
// what they shot (src/net/host.js); here we only drink perks, use things and heal.
export function updateRemotePlayer(sim, p, cmd, dt) {
  if (!p.alive) return;
  updateDrinking(sim, p, dt);
  updateUseAndHealth(sim, p, cmd, dt);
}

function approach(v, tx, tz, maxDelta) {
  const dx = tx - v.x, dz = tz - v.z;
  const d = Math.hypot(dx, dz);
  if (d <= maxDelta || d < 1e-6) { v.x = tx; v.z = tz; return; }
  v.x += (dx / d) * maxDelta;
  v.z += (dz / d) * maxDelta;
}

function updateInteraction(sim, p, cmd, dt) {
  let best = null, bestD = Infinity;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const cosLook = Math.cos(sim.cfg.interaction.lookAngle * Math.PI / 180);
  for (const it of sim.interactables) {
    const d = it.distanceTo(sim, p);
    if (d > it.range || d >= bestD || !it.canUse(sim, p)) continue;
    if (it.requireLook) {
      const dx = it.pos.x - p.pos.x, dz = it.pos.z - p.pos.z;
      const l = Math.hypot(dx, dz);
      if (l > 0.3 && (dx * fx + dz * fz) / l < cosLook) continue;
    }
    best = it; bestD = d;
  }
  if (p.useTarget && p.useTarget !== best && p.useTarget.release) p.useTarget.release(sim, p);
  p.useTarget = best;
  p.prompt = best ? best.prompt(sim, p) : null;
  if (best) best.use(sim, p, cmd, dt);
}

export function damagePlayer(sim, p, amount, source) {
  if (!p.alive || p.downed) return;
  if (sim.godMode) {
    // firing range: you still feel the hit, but take no damage
    sim.emit('playerHit', { playerId: p.id, amount, from: source ? { x: source.pos.x, z: source.pos.z } : null, health: p.health });
    return;
  }
  if (p.boosts && p.boosts.defense) amount *= p.boosts.defense;
  p.health -= amount;
  p.lastDamageTime = sim.time;
  sim.emit('playerHit', { playerId: p.id, amount, from: source ? { x: source.pos.x, z: source.pos.z } : null, health: p.health });
  if (p.health <= 0) goDown(sim, p);
}
