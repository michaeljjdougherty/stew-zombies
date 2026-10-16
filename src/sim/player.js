// =============================================================================
// Player simulation: movement, sprint, stamina, health, interaction.
// Consumes an input command per tick. No rendering here.
// =============================================================================
import { moveBody, separateCircles } from './physics.js';
import { createLoadout, updateWeapons } from './weapons.js';
import { clamp } from '../core/math.js';
import { perkMult, updateDrinking } from './perks.js';
import { goDown } from './laststand.js';
import { updateLaunch } from './launchers.js';
import { updateRide, checkSlides } from './rides.js';
import { explode } from './projectiles.js';
import { gumOn, gumPressed, gumSlide } from './gums.js';

// The shape of one tick of input. The client (or a network peer) fills this in.
export function emptyCommand() {
  return {
    moveX: 0, moveY: 0,       // strafe right +, forward +
    yaw: 0, pitch: 0,         // radians, absolute
    sprint: false, crouch: false,
    fire: false, firePressed: false,
    ads: false, adsPressed: false,   // right click (also the left gun when dual wielding)
    grenade: false, grenadePressed: false,
    tactical: false, tacticalPressed: false,   // [Q] stew bomb / Maisy Dog
    minePressed: false,                         // [X] set down an LBD
    jumpPressed: false,
    reloadPressed: false,
    meleePressed: false,
    use: false, usePressed: false,
    gumPressed: false,                          // [H] use your GobbleGum
    weaponSlot: -1,           // -1 = no change
    weaponCycle: 0,
  };
}

export function createPlayer(sim, id, name, spawn) {
  const cfg = sim.cfg.player;
  return {
    id, name,
    pos: { x: spawn.x, y: spawn.y || 0, z: spawn.z },
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
    kills: 0, headshots: 0, knifeKills: 0, downs: 0, revives: 0,
    boardPointsThisRound: 0,
    prompt: null,             // { text, cost } shown on HUD
    useTarget: null,
    loadout: createLoadout(sim, sim.cfg.startingWeapon),
    grenades: sim.cfg.equipment.frag.startWith,
    grenadeMax: sim.cfg.equipment.frag.startWith,
    stewBombs: 0,
    maisyDogs: 0,             // (the box gives these or Stew Bombs, never both)
    lbds: 0, lbdMax: 0,       // LBDs carried, and what each round tops you back up to
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
  // flying between islands (a launcher): nothing else happens till you land
  if (p.launch) { updateLaunch(sim, p, dt); p.prompt = null; p.useTarget = null; return; }

  if (!sim.replica) updateDrinking(sim, p, dt);   // (online: the host owns perks)
  const downed = !!p.downed;

  // --- dolphin dive: crouch while sprinting
  const crouchPressed = !!cmd.crouch && !p.crouchHeld;
  p.crouchHeld = !!cmd.crouch;
  if (p.diveCooldown > 0) p.diveCooldown -= dt;
  if (downed || p.ride) { p.dive = null; p.prone = null; }
  else if (crouchPressed && p.sprinting && p.grounded && !p.dive && !p.prone && !(p.diveCooldown > 0)) startDive(sim, p);

  // --- prone: down on purpose (hold crouch), or where a dive leaves you; up with jump, crouch or sprint
  const PR = cfg.prone;
  if (p.prone) {
    p.prone.t += dt;
    if (p.prone.up != null) {
      p.prone.up -= dt;
      if (p.prone.up <= 0) { p.prone = null; p.crouchHold = -1; sim.emit('playerStand', { playerId: p.id }); }
    } else if (p.prone.t >= PR.minTime && (cmd.jumpPressed || crouchPressed || (cmd.sprint && cmd.moveY > 0.3))) {
      p.prone.up = PR.getUpTime;
      sim.emit('playerGetUp', { playerId: p.id });
    }
  } else if (!downed && !p.dive && p.grounded && cmd.crouch && !p.sprinting && !p.ride) {
    if ((p.crouchHold ?? 0) >= 0) {
      p.crouchHold = (p.crouchHold || 0) + dt;
      if (p.crouchHold >= PR.holdTime) { p.prone = { t: 0 }; p.crouchHold = -1; sim.emit('playerProne', { playerId: p.id }); }
    }
  }
  if (!cmd.crouch) p.crouchHold = 0;

  // --- stance
  p.crouching = downed || !!p.dive || !!p.prone || (cmd.crouch && p.grounded);
  p.height = downed ? 0.8 : p.dive ? cfg.dive.height : p.prone ? PR.height : p.crouching ? cfg.crouchHeight : cfg.height;
  const sprintMax = cfg.sprintDuration * perkMult(sim, p, 'sprintMult');

  // --- sprint state machine
  let mx = cmd.moveX, my = cmd.moveY;
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  const w = p.loadout;
  const wantsSprint = cmd.sprint && my > 0.3 && !p.crouching && !downed;
  const foac = gumOn(p, 'firingOnAllCylinders');   // (GobbleGum: shoot on the run)
  const interrupt = cmd.ads || (!foac && (cmd.fire || cmd.firePressed)) || cmd.meleePressed || cmd.grenadePressed || cmd.tacticalPressed || !!p.throwing || !!p.drinking;
  if (p.sprinting) {
    if (!wantsSprint || p.stamina <= 0 || interrupt) {
      p.sprinting = false;
      p.sprintOutTimer = cfg.sprintToFireDelay;
      if (cmd.firePressed) p.fireBuffer = 0.3; // fire as soon as the gun comes up
    }
  } else if (wantsSprint && !cmd.ads && (foac || !cmd.fire) && !p.throwing && !p.drinking && p.stamina >= Math.min(cfg.sprintMinToStart, sprintMax) && p.melee.timer <= 0) {
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
    if (!gumOn(p, 'alwaysDoneSwiftly')) speed *= 1 + ((def.adsMoveMult ?? 0.6) - 1) * w.adsAmount;   // (GobbleGum: full speed)
  }
  if (def.hammer && w.heavyT > 0) speed *= sim.cfg.crust.hammers.swing.slowMult;   // (mid-swing with a War Hammer)
  if (p.prone) speed = p.prone.up != null ? 0 : cfg.walkSpeed * PR.speedMult;
  else if (p.crouching) speed *= cfg.crouchSpeedMult;
  speed *= perkMult(sim, p, 'speedMult');
  if (p.boosts && p.boosts.speed) speed *= p.boosts.speed;   // restored by the half-court ritual
  if (downed) speed = sim.cfg.lastStand.crawlSpeed;
  if (p.landSlowTimer > 0) { speed *= cfg.landSlowdownMult; p.landSlowTimer -= dt; }
  // Call of the Crust: wading through deep mud (not on the duckboards)
  p.inMud = !!(sim.mapData.mud && inDeepMud(sim.mapData, p.pos.x, p.pos.z, p.pos.y));
  if (p.inMud && !downed) speed *= sim.cfg.crust.mudSpeed;
  if (p.slowUntil && sim.time < p.slowUntil) speed *= p.slowMult || 1;   // a titan's frost

  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  // forward = (-sin, -cos), right = (cos, -sin)
  let wx = (-sy * my + cy * mx) * speed;
  let wz = (-cy * my - sy * mx) * speed;
  // shoved (a titan's breath, a slam): it carries you whatever you're doing
  if (p.shove && !p.ride) { wx += p.shove.x; wz += p.shove.z; }

  // --- a dive carries you (no steering in the air; on your belly you slide to a stop)
  if (p.dive) {
    p.dive.t += dt;
    if (p.dive.phase === 'air') p.dive.peak = Math.max(p.dive.peak, p.pos.y);
    else {
      const sp = Math.hypot(p.vel.x, p.vel.z);
      const k = sp > 1e-4 ? Math.max(0, sp - cfg.dive.slideDecel * dt) / sp : 0;
      p.vel.x *= k; p.vel.z *= k;
      // the skid over, you're flat on the ground: get up yourself
      if (p.dive.t >= cfg.dive.proneTime) { p.dive = null; p.diveCooldown = cfg.dive.cooldown; p.prone = { t: 0, dove: true }; p.crouchHold = -1; }
    }
  } else if (p.melee.lunge > 0 && p.melee.lungeDir) {
    p.vel.x = p.melee.lungeDir.x * sim.cfg.melee.lungeSpeed;
    p.vel.z = p.melee.lungeDir.z * sim.cfg.melee.lungeSpeed;
  } else if (p.grounded) {
    const hasInput = mx * mx + my * my > 0.001;
    const rate = hasInput ? cfg.groundAccel : cfg.groundDecel;
    approach(p.vel, wx, wz, rate * dt);
  } else {
    // limited air control, no air friction
    if (mx * mx + my * my > 0.001 || p.shove) approach(p.vel, wx, wz, cfg.airAccel * dt);
  }

  // --- jump
  if (p.jumpCooldown > 0) p.jumpCooldown -= dt;
  if (cmd.jumpPressed && p.grounded && p.jumpCooldown <= 0 && !p.crouching && !downed) {
    p.vel.y = Math.sqrt(2 * cfg.gravity * cfg.jumpHeight * ((p.boosts && p.boosts.jump) || 1));
    p.grounded = false;
    p.jumpCooldown = cfg.jumpCooldown;
    sim.emit('playerJump', { playerId: p.id });
  }

  // --- move & collide (or ride a zipline or an ice slide: you can still shoot)
  const before = { x: p.pos.x, z: p.pos.z };
  if (sim.rides.length && !p.ride && !downed) checkSlides(sim, p);
  if (p.ride) updateRide(sim, p, cmd, dt);
  else {
    const res = moveBody(p, dt, [sim.world.solids, sim.world.playerBlockers, sim.world.terrain], cfg.gravity);
    if (res.landed) {
      p.landSlowTimer = res.impact > 4 && !p.dive ? cfg.landSlowdownTime : 0;
      p.lastLandImpact = res.impact;
      sim.emit('playerLand', { playerId: p.id, impact: res.impact });
      if (p.dive && p.dive.phase === 'air') diveLand(sim, p);
      // a long drop hurts (PHD Gaylor: not at all; online the host keeps your health)
      const fd = cfg.fallDamage;
      if (!downed && !sim.replica && res.impact > fd.minImpact && !p.perks.some((id) => sim.cfg.perks.list[id].noFall)) {
        sim.damagePlayer(p, Math.min(fd.max, (res.impact - fd.minImpact) * fd.perMs), null);
      }
    }
    // zombies are solid: they body-block you
    for (const z of sim.zombies) {
      if (z.state !== 'chase') continue;
      if (Math.abs(z.pos.y - p.pos.y) > 1.2) continue;
      separateCircles(p.pos, p.radius, z.pos, sim.cfg.zombie.radius * 0.9, 1);
    }
    // other players too
    for (const o of sim.players) {
      if (o !== p && o.alive && Math.abs(o.pos.y - p.pos.y) < 1.6) separateCircles(p.pos, p.radius, o.pos, o.radius, 0.5);
    }
    // lying flat (prone, or skidding out of a dive): your head and feet are a body-length
    // apart either side of you, so keep both out of the walls and the rails
    if ((p.prone || (p.dive && p.dive.phase !== 'air')) && p.grounded) keepBodyClear(sim, p, cfg.prone);
  }

  const moved = Math.hypot(p.pos.x - before.x, p.pos.z - before.z);
  p.moveSpeed = moved / dt;
  if (p.grounded) p.distanceWalked += moved;

  // --- weapons and knife
  updateWeapons(sim, p, cmd, dt);
  // --- [H]: chew your activated GobbleGum (online, the host does it)
  if (cmd.gumPressed) gumPressed(sim, p);

  // online, the host does the buying, prompts and health for you
  if (sim.replica) return;
  updateUseAndHealth(sim, p, cmd, dt);
}

// Push someone lying flat back (or forward) so neither end of them is in a wall.
function keepBodyClear(sim, p, PR) {
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const o = { x: p.pos.x, y: p.pos.y + PR.clearHeight, z: p.pos.z };
  const f = sim.raycastWorld(o, { x: fx, y: 0, z: fz }, PR.reach);
  const b = sim.raycastWorld(o, { x: -fx, y: 0, z: -fz }, PR.reach);
  const ff = f ? PR.reach - f.t : 0, bb = b ? PR.reach - b.t : 0;
  if (ff > 0 && bb > 0) return;   // (wedged in a gap shorter than you: nothing to do)
  if (ff > 0) { p.pos.x -= fx * ff; p.pos.z -= fz * ff; }
  else if (bb > 0) { p.pos.x += fx * bb; p.pos.z += fz * bb; }
}

// How flat you are (0 standing .. 1 prone): getting up runs it back down.
export function proneLevel(p, cfg) {
  if (!p.prone) return 0;
  if (p.prone.lvl != null) return p.prone.lvl;   // (a teammate online: as their browser said)
  return p.prone.up != null ? Math.max(0, p.prone.up / cfg.player.prone.getUpTime) : 1;
}

// Dolphin dive: thrown flat out forward and a little up.
function startDive(sim, p) {
  const c = sim.cfg.player.dive;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  p.vel.x = fx * c.speed; p.vel.z = fz * c.speed; p.vel.y = c.up;
  p.grounded = false;
  p.sprinting = false;
  p.dive = { phase: 'air', t: 0, peak: p.pos.y, from: p.pos.y };
  sim.emit('playerDive', { playerId: p.id, pos: { ...p.pos } });
}

// Belly first into the ground: a slide (and with PHD Gaylor, a blast).
function diveLand(sim, p) {
  const drop = p.dive.from - p.pos.y;
  p.dive.phase = 'prone'; p.dive.t = 0;
  sim.emit('diveLand', { playerId: p.id, pos: { ...p.pos }, drop });
  if (gumOn(p, 'slaughterSlide')) { if (sim.replica) sim.netOut.push({ k: 'gumSlide' }); else gumSlide(sim, p); }
  const perk = p.perks.map((id) => sim.cfg.perks.list[id]).find((d) => d.diveBlast);
  if (!perk) return;
  // (only off something: a dive along flat ground just lands)
  if (drop < perk.minDrop) return;
  const kind = drop >= perk.highDrop ? perk.diveBlastHigh : perk.diveBlast;
  const pos = { x: p.pos.x, y: p.pos.y + 0.3, z: p.pos.z };
  if (sim.replica) sim.netOut.push({ k: 'boom', pos, kind });
  else explode(sim, pos, kind, p.id);
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
  const regenDelay = cfg.regenDelay * (gumOn(p, 'armamentalAccomplishment') ? sim.cfg.gobblegum.gums.armamentalAccomplishment.regenMult : 1);
  if (!downed && p.health < p.maxHealth && sim.time - p.lastDamageTime > regenDelay) {
    p.health = Math.min(p.maxHealth, p.health + cfg.regenRate * dt);
  }
}

// Host side of an online teammate: their browser reports where they are and
// what they shot (src/net/host.js); here we only drink perks, use things and heal.
export function updateRemotePlayer(sim, p, cmd, dt) {
  if (!p.alive) return;
  // off a launcher: the host flies them too (so they land here, and the
  // launcher's recharge starts here, where it's checked)
  if (p.launch) { updateLaunch(sim, p, dt); p.prompt = null; p.useTarget = null; return; }
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
  const tall = !!sim.mapData.terrainBoxes;   // (a map with floors above floors: not through the ceiling)
  for (const it of sim.interactables) {
    if (tall && it.pos && it.pos.y != null && Math.abs(it.pos.y - p.pos.y) > 2.6) continue;
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
  // just picked back up: a few seconds where nothing touches you
  if (p.invulnUntil && sim.time < p.invulnUntil) return;
  if (p.launch) return;   // in the air over the ice
  if (source && source.explosive && gumOn(p, 'dangerClosest')) return;   // (GobbleGum: no blast can touch you)
  if (p.boosts && p.boosts.defense) amount *= p.boosts.defense;
  p.health -= amount;
  p.lastDamageTime = sim.time;
  sim.emit('playerHit', { playerId: p.id, amount, from: source ? { x: source.pos.x, z: source.pos.z } : null, health: p.health });
  if (p.health <= 0) goDown(sim, p);
}

// Is (x, z) in a patch of deep mud, and not on the duckboards?
export function inDeepMud(map, x, z, y = 0) {
  let mud = false;
  for (const m of map.mud) if ((x - m.x) ** 2 + (z - m.z) ** 2 < m.r * m.r && y < (m.y || 0) + 0.3) { mud = true; break; }
  if (!mud) return false;
  for (const r of map.duckboards || []) if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return false;
  return true;
}
