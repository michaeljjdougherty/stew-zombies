// =============================================================================
// The titans of Call of the Crust: each island's boss, guarding its War Hammer
// core. None of them is beaten by just shooting it:
//
//   The Drowned Captain (Ship Graveyard): a giant pirate head out past the
//     north cliffs. It spits its drowned crew (skeletons) onto the island in
//     waves; hold out through every wave. Between spits it breathes in (pulling
//     everyone toward the edge) and blows back out.
//   The Warden (Research Base): a shielded walker. Bullets spark off it. Charge
//     the tesla coils at their consoles (hold F) and lead it past them: a
//     charged coil fires into it when it walks close. It stomps, it sweeps a
//     laser, it calls the lab's dead in.
//   The Glacier Golem (Ice Caves): ice through and through. Shoot down the big
//     icicle clusters under the cave roofs as it walks under them; when one
//     drops on it, it kneels with its heart showing: knife the heart. It slams,
//     it raises ice shards under you, its frost nova slows you.
//   The Molten Fiend (Trench Front): bullets do nothing. Man the field guns in
//     the pits (hold F: you sit in the gun and aim it), fire one shell straight
//     at it and you're off the gun while it reloads. It lobs magma that leaves
//     burning pools, and it erupts: get clear.
//
// Fights pause the rounds (the titan brings its own). Everything here is plain
// data, so an online host can send it like the rest of the world.
// =============================================================================
import { zombieHealthForRound } from '../config.js';
import { makeZombie, pickZombieType } from './zombies.js';
import { moveBody, groundHeight, outOfWalls } from './physics.js';
import { explode } from './projectiles.js';
import { spawnPowerup } from './powerups.js';
import { angleWrap, lookDir } from '../core/math.js';
import { createForge, updateForge, forgeInteractables, dropCore, forgeObjective } from './forge.js';
import { createCrustPower, updateCrustPower, powerObjective, crustPowerInteractables } from './crustPower.js';
import { updateZach, zachTargets, zachObjective, finaleOn, ZACH_H } from './zachBoss.js';
import { createTrials, updateTrials, coilsForTrial } from './hammerTrials.js';

const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// radius: what it moves as (a zombie's size, so it fits the paths you do; it's
// drawn bigger). bulk: how far it shoves you out of the way.
const BODY = {
  ship: { radius: 0, bulk: 0, height: 0 },
  research: { radius: 0.45, bulk: 2.2, height: 9, step: 0.55 },
  caves: { radius: 0.45, bulk: 1.7, height: 7.5, step: 0.55 },
  trench: { radius: 0.6, bulk: 2.0, height: 10, step: 2.6 },
};

export const TITAN_NAMES = { ship: 'The Drowned Captain', research: 'The Warden', caves: 'The Glacier Golem', trench: 'The Molten Fiend' };

export function createCrustEgg(sim) {
  const m = sim.mapData;
  if (!m.titans || !m.titans.length) return null;
  const E = { active: null, cores: {}, titans: {}, hazards: [], shells: [], clusters: [], coils: [], guns: [], hid: 1 };
  for (const s of m.titans) {
    const b = BODY[s.id];
    E.titans[s.id] = {
      id: s.id, island: s.island, name: TITAN_NAMES[s.id], state: 'asleep', t: 0,
      // (its yaw is the way it faces: the model's own front is turned look.face from that)
      pos: { ...s.home }, vel: { x: 0, y: 0, z: 0 }, yaw: s.home.yaw - (sim.cfg.crust.egg.look[s.id].face || 0), home: { ...s.home },
      radius: b.radius, bulk: b.bulk, height: b.height, stepHeight: b.step || 0.5, grounded: true,
      region: null, moveSpeed: 0, act: null, next: {}, done: 0, of: 0, stuckT: 0, away: 0,
    };
    if (s.coils) E.coils = s.coils.map((c, i) => ({ id: 'coil' + i, x: c.x, y: c.y, z: c.z, con: { ...c.con }, charge: 0, ready: false, coolUntil: 0, by: null }));
    if (s.clusters) E.clusters = s.clusters.map((c, i) => ({ id: 'cluster' + i, x: c.x, y: c.y, z: c.z, state: 'hang', t: 0, regrowAt: 0, ground: null }));
    if (s.guns) E.guns = s.guns.map((g, i) => ({ id: 'gun' + i, x: g.x, y: g.y, z: g.z, readyAt: 0, by: null }));
    if (s.id === 'ship') {
      // where its crew can come down: open ground on the island, not too far from its mouth
      const isl = m.islands.find((i) => i.id === s.island);
      const [x0, z0, x1, z1] = isl.bounds;
      E.shipLand = m.groundSpawns.filter((g) => g.x > x0 && g.x < x1 && g.z > z0 && g.z < z1 && Math.hypot(g.x - s.home.x, g.z - s.home.z) < sim.cfg.crust.egg.ship.landReach).map((g) => ({ x: g.x, y: g.y, z: g.z }));
    }
  }
  E.forge = createForge(sim);       // Pit's forge: the cores become the War Hammers (forge.js)
  E.power = createCrustPower(sim);  // the power: the Anvil's relays, the islands' switches (crustPower.js)
  E.finale = { state: 'off' };      // Big Evil Zach (zachBoss.js)
  E.trials = createTrials(sim, E);  // the War Hammers' trials, for their "+" (hammerTrials.js)
  return E;
}

// The interactables: wake each titan; the coil consoles; the field guns.
export function crustEggInteractables(sim) {
  const E = sim.crustEgg;
  if (!E) return [];
  const out = [];
  for (const s of sim.mapData.titans) if (s.wake) out.push(new WakeInteractable(s));
  E.coils.forEach((c, i) => out.push(new CoilInteractable(i)));
  E.guns.forEach((g, i) => out.push(new FieldGunInteractable(i)));
  out.push(...forgeInteractables(sim));
  out.push(...crustPowerInteractables(sim));
  return out;
}

const islandOf = (sim, pos) => {
  for (const I of sim.mapData.islands) { const [x0, z0, x1, z1] = I.bounds; if (pos.x >= x0 && pos.x <= x1 && pos.z >= z0 && pos.z <= z1) return I.id; }
  return null;
};
// players still in the fight: alive, standing on the titan's island
const fighters = (sim, T) => sim.players.filter((p) => p.alive && !p.launch && islandOf(sim, p.pos) === T.island);

function nearest(sim, T, list = fighters(sim, T)) {
  let best = null, bd = Infinity;
  for (const p of list) { if (p.downed) continue; const d = d2(p.pos, T.pos); if (d < bd) { bd = d; best = p; } }
  return best;
}

function hazard(sim, h) { const E = sim.crustEgg; h.id = E.hid++; E.hazards.push(h); sim.emit('titanHazard', { ...h }); return h; }

function shove(sim, p, fromX, fromZ, speed) {
  const dx = p.pos.x - fromX, dz = p.pos.z - fromZ, l = Math.hypot(dx, dz) || 1;
  p.shove = { x: (dx / l) * speed, z: (dz / l) * speed };
  kickUp(p, speed * 0.35);
}

// Thrown up off your feet. (kicks counts them, so an online friend's browser,
// which moves them, knows a new one came: src/net/state.js)
export function kickUp(p, up) {
  p.vel.y = Math.max(p.vel.y, up);
  p.grounded = false;
  p.kicks = (p.kicks || 0) + 1; p.kickUp = up;
}

// What the titans and Big Evil Zach do to you every step: a shove dies away, a
// frost slow wears off, and you can't walk through them. The host does this for
// everyone; an online friend's browser does it for them too (src/net/client.js),
// since that's where they're moved.
export function feelTitans(sim, p, dt) {
  const E = sim.crustEgg;
  if (!E) return;
  const c = sim.cfg.crust.egg;
  if (p.shove) { const k = Math.exp(-c.pushDecay * dt); p.shove.x *= k; p.shove.z *= k; if (Math.abs(p.shove.x) + Math.abs(p.shove.z) < 0.05) p.shove = null; }
  if (p.slowUntil && sim.time > p.slowUntil) { p.slowUntil = 0; p.slowMult = 1; }
  if (!p.alive || p.launch) return;
  let pushed = false;
  const from = { x: p.pos.x, z: p.pos.z };
  const out = (x, z, r) => {
    const dx = p.pos.x - x, dz = p.pos.z - z, dd = Math.hypot(dx, dz), rr = r + p.radius;
    if (dd < rr && dd > 1e-4) { p.pos.x = x + (dx / dd) * rr; p.pos.z = z + (dz / dd) * rr; pushed = true; }
  };
  for (const T of Object.values(E.titans)) {
    // (it's solid, asleep or awake)
    if (T.bulk && T.state !== 'dead' && Math.abs(p.pos.y - T.pos.y) <= T.height) out(T.pos.x, T.pos.z, T.bulk);
  }
  const F = E.finale, f = sim.cfg.crust.finale;
  if (F && F.state !== 'off' && F.state !== 'done' && F.state !== 'freed' && Math.abs(p.pos.y - F.pos.y) <= ZACH_H * F.scale) out(F.pos.x, F.pos.z, f.bulk * F.scale / f.scale[0]);
  // (never through a wall: up against one, the wall wins. Pinned in a cave
  // passage by the Golem, you used to be shoved out through the rock)
  if (pushed) outOfWalls(p, from, [sim.world.solids, sim.world.terrain]);
}

// damage everyone within r of (x,z) (and near enough in height), falling off to `edge` at the rim
function blastPlayers(sim, pos, r, dmg, edge = 0.4, push = 0) {
  for (const p of sim.players) {
    if (!p.alive || p.launch) continue;
    const d = d2(p.pos, pos);
    if (d > r || Math.abs(p.pos.y - pos.y) > 3.5) continue;
    sim.damagePlayer(p, dmg * (1 - (1 - edge) * (d / r)), { pos: { x: pos.x, z: pos.z } });
    if (push) shove(sim, p, pos.x, pos.z, push);
  }
}

// Where to stand to take a titan on (Explore's "Fight" buttons): on walkable
// ground near where it's woken, about level with it, facing it. The Fiend's
// woken from a field gun, so beside one of those.
export function titanApproach(sim, id) {
  const s = sim.mapData.titans.find((t) => t.id === id);
  const E = sim.crustEgg, lists = [sim.world.solids, sim.world.terrain];
  const face = (x, z, to) => Math.atan2(-(to.x - x), -(to.z - z));
  if (!s.wake) {
    const g = E.guns[1] || E.guns[0];
    const x = g.x - 2, z = g.z - 2;
    return { x, y: groundHeight(x, z, 0.3, g.y + 2, lists), z, yaw: face(x, z, s.home) };
  }
  const w = s.wake, y0 = w.y || 0;
  if (id === 'ship') return { x: w.x, y: y0, z: w.z + 2, yaw: face(w.x, w.z + 2, s.home) };
  for (const r of [w.r + 4, w.r + 2.5, w.r + 6, w.r + 8, w.r + 1]) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, x = w.x + Math.cos(a) * r, z = w.z + Math.sin(a) * r;
      const y = groundHeight(x, z, 0.4, y0 + 1.5, lists);
      if (Math.abs(y - y0) > 1.2 || sim.nav.regionAt({ x, y, z }) == null) continue;
      // (not with rock over your head)
      if (groundHeight(x, z, 0.4, y + 40, lists) > y + 2.5) continue;
      return { x, y, z, yaw: face(x, z, s.home) };
    }
  }
  return { x: w.x, y: y0, z: w.z, yaw: 0 };
}

// --- waking --------------------------------------------------------------------
export function wakeTitan(sim, id, p = null) {
  const E = sim.crustEgg, T = E && E.titans[id];
  if (!T || T.state !== 'asleep' || E.active || finaleOn(E)) return false;
  const c = sim.cfg.crust.egg;
  E.active = id;
  T.state = 'waking'; T.t = 0; T.act = null; T.done = 0; T.stuckT = 0; T.away = 0;
  T.of = id === 'ship' ? c.ship.waves.length : id === 'research' ? c.research.strikes : id === 'caves' ? c.caves.hearts : c.trench.hits;
  const now = sim.time, r = (a) => now + sim.rng.range(a[0], a[1]);
  T.next = {};
  if (id === 'ship') { T.wave = 0; T.toSpit = 0; T.spitAt = 0; T.waveAt = now + c.wakeTime[id] + 1; T.next.breath = r(c.ship.inhaleEvery) + c.wakeTime[id]; T.crew = []; }
  if (id === 'research') { T.next.laser = r(c.research.laserEvery) + c.wakeTime[id]; T.next.adds = now + c.wakeTime[id] + c.research.addsEvery; }
  if (id === 'caves') { T.next.shards = r(c.caves.shardsEvery) + c.wakeTime[id]; T.next.nova = r(c.caves.novaEvery) + c.wakeTime[id]; }
  if (id === 'trench') { T.next.lob = r(c.trench.lobEvery) + c.wakeTime[id]; T.next.erupt = r(c.trench.eruptEvery) + c.wakeTime[id]; }
  sim.emit('titanWake', { id, name: T.name, playerId: p ? p.id : null, pos: { ...T.pos } });
  return true;
}

// Put a titan back to sleep where it started (everyone left its island).
function retreat(sim, T) {
  const E = sim.crustEgg;
  Object.assign(T.pos, T.home); T.yaw = T.home.yaw - (sim.cfg.crust.egg.look[T.id].face || 0); T.vel.x = T.vel.y = T.vel.z = 0;
  T.state = 'asleep'; T.t = 0; T.act = null; T.done = 0; T.region = null; T.moveSpeed = 0;
  E.active = null; E.hazards.length = 0; E.shells.length = 0;
  for (const c of E.coils) { c.charge = 0; c.ready = false; }
  sim.emit('titanRetreat', { id: T.id, name: T.name });
}

function beaten(sim, T) {
  const E = sim.crustEgg, c = sim.cfg.crust.egg;
  T.state = 'dying'; T.t = 0; T.act = null; T.moveSpeed = 0;
  E.hazards.length = 0;
  sim.emit('titanDown', { id: T.id, name: T.name, pos: { ...T.pos } });
  for (const p of sim.players) if (p.alive) sim.addPoints(p, c.reward, 'titan');
}

// --- the step -------------------------------------------------------------------
export function updateCrustEgg(sim, dt) {
  const E = sim.crustEgg;
  if (!E) return;
  const c = sim.cfg.crust.egg;
  for (const p of sim.players) feelTitans(sim, p, dt);
  // (a gun whose gunner's gone, or got off it some other way, is free again)
  for (const g of E.guns) if (g.by) { const q = sim.playerById(g.by); if (!q || !q.manning || q.manning.gun !== g.id) g.by = null; }
  updateFlung(sim, dt);
  updateClusters(sim, dt);
  updateShells(sim);
  for (const T of Object.values(E.titans)) {
    if (T.state === 'asleep' || T.state === 'dead') continue;
    T.t += dt;
    if (T.state === 'waking') {
      if (T.t >= c.wakeTime[T.id]) {
        T.state = 'fight'; T.t = 0;
        // (the Fiend has climbed up out of its crater)
        if (T.id === 'trench') { T.pos.y = c.trench.groundY; T.grounded = true; } sim.emit('titanRoar', { id: T.id, pos: { ...T.pos } });
      }
      continue;
    }
    if (T.state === 'dying') {
      if (T.t >= c.dyingTime) {
        T.state = 'dead';
        E.active = null;
        const drop = T.id === 'ship' ? sim.mapData.titans.find((s) => s.id === 'ship').wake : T.pos;
        spawnPowerup(sim, 'fullPantry', { x: drop.x, y: (drop.y || 0) + 0.2, z: drop.z });
        // its War Hammer core drops beside it: take it to Pit (forge.js)
        const gy = groundHeight(drop.x + 1.6, drop.z, 0.3, (drop.y || 0) + 3, [sim.world.solids, sim.world.terrain]);
        dropCore(sim, T.id, { x: drop.x + 1.6, y: Number.isFinite(gy) && gy > (drop.y || 0) - 4 ? gy : (drop.y || 0), z: drop.z });
      }
      continue;
    }
    // everyone gone from its island for a while: it goes back to sleep
    const here = fighters(sim, T);
    T.away = here.length ? 0 : T.away + dt;
    if (T.away > c.leash) { retreat(sim, T); continue; }
    if (T.id === 'ship') updateCaptain(sim, T, dt, here);
    else if (T.id === 'research') updateWarden(sim, T, dt, here);
    else if (T.id === 'caves') updateGolem(sim, T, dt, here);
    else updateFiend(sim, T, dt, here);
    if (T.state === 'fight' && T.done >= T.of) beaten(sim, T);
  }
  updateHazards(sim, dt);
  updateCrustPower(sim);
  updateForge(sim, dt);
  updateTrials(sim);
  updateZach(sim, dt);
}

// Walk toward a goal (along the nav, or straight at it), steering like a zombie.
// Returns true if it's making headway.
function stride(sim, T, goalPos, goalRegion, speed, dt, { nav = true, turn = 2.2, indoor = true } = {}) {
  T.region = sim.nav.regionAt(T.pos, T.region);
  let goal = goalPos;
  if (nav && goalRegion != null) goal = sim.nav.nextPoint(T.pos, T.region, goalPos, goalRegion, false);   // (the long way round, not off the ledges)
  let dx = goal.x - T.pos.x, dz = goal.z - T.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) { T.moveSpeed = 0; T.vel.x = T.vel.z = 0; return true; }
  dx /= d; dz /= d;
  // steer round whatever's in the way (a crystal, a crate)
  if (d > 1 && blockedAhead(sim, T, dx, dz)) {
    T.avoid = T.avoid || 1;
    for (const a of [0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) {
      const ang = a * T.avoid, cs = Math.cos(ang), sn = Math.sin(ang);
      const tx = dx * cs - dz * sn, tz = dx * sn + dz * cs;
      if (!blockedAhead(sim, T, tx, tz)) { dx = tx; dz = tz; T.avoid = Math.sign(ang); break; }
    }
  }
  const want = Math.atan2(dx, dz), diff = angleWrap(want - T.yaw);
  T.yaw = angleWrap(T.yaw + Math.max(-turn * dt, Math.min(turn * dt, diff)));
  const facing = Math.max(0, Math.cos(diff));
  let sp = speed * (0.25 + 0.75 * facing);
  // (it won't follow you indoors: too big for the doors)
  if (!indoor) {
    const ahead = { x: T.pos.x + dx * (T.bulk + 1.2), y: T.pos.y, z: T.pos.z + dz * (T.bulk + 1.2) };
    const room = sim.roomAt(ahead, T.region);
    if (room && room.outdoor === false) sp = 0;
  }
  // (nor walk off a cliff)
  const probe = groundHeight(T.pos.x + dx * (T.radius + 0.8), T.pos.z + dz * (T.radius + 0.8), 0.3, T.pos.y + T.stepHeight, [sim.world.solids, sim.world.terrain]);
  if (probe < T.pos.y - 3.2) sp = 0;
  T.vel.x = dx * sp; T.vel.z = dz * sp;
  const px = T.pos.x, pz = T.pos.z;
  moveBody(T, dt, [sim.world.solids, sim.world.terrain], sim.cfg.player.gravity);
  const moved = Math.hypot(T.pos.x - px, T.pos.z - pz) / dt;
  T.moveSpeed = moved;
  const far = Math.hypot(goalPos.x - T.pos.x, goalPos.z - T.pos.z) > 4;
  if ((sp > 0.3 && moved < sp * 0.3) || (sp === 0 && far)) T.stuckT += dt; else T.stuckT = Math.max(0, T.stuckT - dt);
  // (and stuck shuffling back and forth on the spot: the Warden at the foot of a
  // catwalk's stairs, one foot on and one off. Every couple of seconds: has it
  // got anywhere?)
  const W = sim.cfg.crust.egg.leap;
  // (only while it's been walking all that time, not stopped to stomp or fire)
  if (!T.chk || sim.time - T.chk.last > 0.1) T.chk = { x: T.pos.x, z: T.pos.z, t: sim.time };
  T.chk.last = sim.time;
  if (sim.time - T.chk.t >= W.checkEvery) {
    if (far && Math.hypot(T.pos.x - T.chk.x, T.pos.z - T.chk.z) < W.checkDist) T.stuckT = Math.max(T.stuckT, W.stuck + 0.01);
    T.chk = { x: T.pos.x, z: T.pos.z, t: sim.time, last: sim.time };
  }
  return moved > 0.2;
}

function blockedAhead(sim, T, dx, dz) {
  const px = T.pos.x + dx * 1.1, pz = T.pos.z + dz * 1.1, r = T.radius;
  const y0 = T.pos.y + T.stepHeight + 0.3, y1 = T.pos.y + 2.5;
  for (const b of [...sim.world.solids, ...sim.world.terrain.near(px, pz, r)]) {
    if (b.maxY <= y0 || b.minY >= y1) continue;
    const cx = px < b.minX ? b.minX : px > b.maxX ? b.maxX : px;
    const cz = pz < b.minZ ? b.minZ : pz > b.maxZ ? b.maxZ : pz;
    if ((px - cx) ** 2 + (pz - cz) ** 2 < r * r) return true;
  }
  return false;
}

// Stuck (or you've run off somewhere it can't walk): it leaps to open ground near you.
function leapToward(sim, T, target, airTime) {
  const c = sim.cfg.crust.egg;
  let best = null, bd = Infinity;
  // (never down on top of anyone: landing on you used to shove you through the ground and off the island)
  const clear = Math.max(c.leap.minDist, c.leap.clear || 0);
  const people = sim.players.filter((p) => p.alive && !p.launch);
  for (const g of sim.mapData.groundSpawns) {
    if (islandOf(sim, g) !== T.island) continue;
    const room = sim.roomAt(g);
    if (room && room.outdoor === false) continue;
    const d = Math.hypot(g.x - target.pos.x, g.z - target.pos.z);
    if (d < clear || people.some((p) => Math.hypot(g.x - p.pos.x, g.z - p.pos.z) < clear)) continue;
    if (d < bd) { bd = d; best = g; }
  }
  if (!best || bd > c.leap.maxDist) return false;
  // (the Warden flies on its jump jets; the Golem and the Fiend sink into the ground and come up again)
  const burrow = T.id !== 'research';
  T.act = { kind: 'leap', burrow, t: 0, dur: airTime, from: { ...T.pos }, to: { x: best.x, y: best.y, z: best.z } };
  T.stuckT = 0; T.chk = null;
  sim.emit('titanLeap', { id: T.id, from: { ...T.pos }, to: { ...T.act.to }, dur: airTime, burrow });
  return true;
}

function updateLeap(sim, T, dt) {
  const a = T.act, c = sim.cfg.crust.egg;
  a.t += dt;
  const u = Math.min(1, a.t / a.dur);
  if (a.burrow) {
    const down = u < 0.5, k = down ? u * 2 : (1 - u) * 2, at = down ? a.from : a.to;
    T.pos.x = at.x; T.pos.z = at.z; T.pos.y = at.y - c.leap.sink * k * k;
  } else {
    T.pos.x = a.from.x + (a.to.x - a.from.x) * u;
    T.pos.z = a.from.z + (a.to.z - a.from.z) * u;
    T.pos.y = a.from.y + (a.to.y - a.from.y) * u + Math.sin(Math.PI * u) * c.leap.height;
    T.yaw = Math.atan2(a.to.x - a.from.x, a.to.z - a.from.z);
  }
  T.moveSpeed = 0;
  if (u >= 1) {
    T.act = null; T.vel.x = T.vel.y = T.vel.z = 0; T.grounded = true; T.region = null;
    blastPlayers(sim, T.pos, c.leap.radius, c.leap.damage, 0.4, c.leap.push);
    sim.emit('titanLand', { id: T.id, pos: { ...T.pos }, radius: c.leap.radius });
  }
}

function face(T, p, dt, rate = 3) {
  const diff = angleWrap(Math.atan2(p.pos.x - T.pos.x, p.pos.z - T.pos.z) - T.yaw);
  T.yaw = angleWrap(T.yaw + Math.max(-rate * dt, Math.min(rate * dt, diff)));
}

// A melee wind-up (stomp, slam): telegraphed, then a shockwave round its feet.
function smash(sim, T, dt, range, warn, dmg, push) {
  const a = T.act;
  a.t += dt;
  if (!a.hit && a.t >= warn) {
    a.hit = true;
    blastPlayers(sim, T.pos, range * 1.25, dmg, 0.45, push);
    sim.emit('titanSmash', { id: T.id, pos: { ...T.pos }, radius: range * 1.25, kind: a.kind });
  }
  if (a.t >= warn + 0.6) T.act = null;
}

// ---------------------------------------------------------------------------
// The Drowned Captain
// ---------------------------------------------------------------------------
// Its mouth: where its crew come out (and where its breath pulls you), turned
// as it's turned. (T.pos is where it sits, before it rises.)
export function captainMouth(sim, T) {
  const c = sim.cfg.crust.egg.ship;
  const d = T.yaw - (T.home.yaw - (sim.cfg.crust.egg.look.ship.face || 0)), cs = Math.cos(d), sn = Math.sin(d);
  const [mx, my, mz] = c.mouth;
  return { x: T.pos.x + mx * cs + mz * sn, y: T.pos.y + c.rise + my, z: T.pos.z - mx * sn + mz * cs };
}
const mouthOf = captainMouth;

// It hangs in the air and follows you round the island, keeping its distance,
// high enough to see over the ground (and to see its crew come out).
function hover(sim, T, dt, here) {
  const c = sim.cfg.crust.egg.ship, F = c.follow;
  // (the one it's after: whoever's nearest)
  let who = null, bd = Infinity;
  for (const p of here) { const d = d2(p.pos, T.pos); if (d < bd) { bd = d; who = p; } }
  if (!who) return;
  let dx = T.pos.x - who.pos.x, dz = T.pos.z - who.pos.z;
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const tx = who.pos.x + dx * F.dist, tz = who.pos.z + dz * F.dist;
  // (clear of the ground under it: it's a big head)
  const g = groundHeight(tx, tz, F.clear, 200, [sim.world.solids, sim.world.terrain]);
  const ty = Math.min(who.pos.y + F.maxUp, Math.max(who.pos.y, Number.isFinite(g) ? g : -1e9) + F.height);
  const k = Math.min(1, dt * F.ease);
  const mx = (tx - T.pos.x) * k, my = (ty - T.pos.y) * k, mz = (tz - T.pos.z) * k, m = Math.hypot(mx, mz), cap = F.speed * dt;
  T.pos.x += m > cap ? mx / m * cap : mx; T.pos.z += m > cap ? mz / m * cap : mz;
  T.pos.y += Math.max(-cap, Math.min(cap, my));
  // and looks at you
  const want = Math.atan2(who.pos.x - T.pos.x, who.pos.z - T.pos.z);
  T.yaw = angleWrap(T.yaw + Math.max(-F.turn * dt, Math.min(F.turn * dt, angleWrap(want - T.yaw))));
}

function updateCaptain(sim, T, dt, here) {
  const c = sim.cfg.crust.egg.ship, E = sim.crustEgg, now = sim.time;
  T.crew = T.crew.filter((id) => sim.zombieById(id));
  hover(sim, T, dt, here);
  // its breath: rear back, pull everyone toward the edge, then blow them back
  if (T.act) {
    const a = T.act;
    a.t += dt;
    const M = mouthOf(sim, T);
    if (a.kind === 'inhaleWarn' && a.t >= c.inhaleWarn) { T.act = { kind: 'inhale', t: 0 }; sim.emit('titanBreath', { id: T.id, phase: 'in', dur: c.inhaleTime }); }
    else if (a.kind === 'inhale') {
      for (const p of here) {
        const dx = M.x - p.pos.x, dz = M.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
        if (d > c.reach) continue;
        const k = c.pull * (0.3 + 0.7 * (1 - d / c.reach));
        p.shove = { x: (dx / d) * k, z: (dz / d) * k };
      }
      if (a.t >= c.inhaleTime) { T.act = { kind: 'exhale', t: 0 }; sim.emit('titanBreath', { id: T.id, phase: 'out', dur: c.exhaleTime }); }
    } else if (a.kind === 'exhale') {
      // the gust back out
      for (const p of here) {
        const dx = p.pos.x - M.x, dz = p.pos.z - M.z, d = Math.hypot(dx, dz) || 1;
        if (d > c.reach) continue;
        const k = c.push * (0.35 + 0.65 * (1 - d / c.reach));
        p.shove = { x: (dx / d) * k, z: (dz / d) * k };
      }
      if (a.t >= c.exhaleTime) { T.act = null; T.next.breath = now + sim.rng.range(c.inhaleEvery[0], c.inhaleEvery[1]); }
    }
    if (T.act) return;
  }
  if (now >= T.next.breath && T.toSpit > 0) { T.act = { kind: 'inhaleWarn', t: 0 }; sim.emit('titanBreath', { id: T.id, phase: 'warn', dur: c.inhaleWarn }); return; }
  // the waves
  if (T.toSpit <= 0 && !T.crew.length) {
    if (T.wave > 0 && !T.waveCleared) {
      T.waveCleared = true; T.done = T.wave;
      sim.emit('titanWave', { id: T.id, wave: T.wave, of: T.of, cleared: true });
      T.waveAt = now + c.between;
      if (T.done >= T.of) return;
    }
    if (now >= T.waveAt && T.wave < c.waves.length) {
      T.wave++; T.waveCleared = false;
      T.toSpit = c.waves[T.wave - 1] + c.perPlayer * Math.max(0, here.length - 1);
      T.spitAt = now + 0.8;
      sim.emit('titanWave', { id: T.id, wave: T.wave, of: T.of, count: T.toSpit });
    }
    return;
  }
  if (T.toSpit > 0 && now >= T.spitAt && T.crew.length < c.maxUp && E.shipLand.length) {
    T.spitAt = now + sim.rng.range(c.spitEvery[0], c.spitEvery[1]);
    // somewhere near one of you
    const who = here.length ? here[Math.floor(sim.rng.next() * here.length)] : null;
    const cands = who ? [...E.shipLand].sort((a, b) => d2(a, who.pos) - d2(b, who.pos)).slice(0, 8).filter((g) => d2(g, who.pos) > c.landMin) : E.shipLand;
    const land = (cands.length ? cands : E.shipLand)[Math.floor(sim.rng.next() * (cands.length || E.shipLand.length))];
    const M = mouthOf(sim, T);
    const round = Math.max(1, sim.rounds.round);
    const z = makeZombie(sim, { type: pickZombieType(sim, round), pos: M, yaw: Math.atan2(land.x - M.x, land.z - M.z), health: zombieHealthForRound(round, sim.cfg.zombie) * c.health, state: 'flung' });
    z.cast = 'skeleton';
    z.titan = T.id;
    z.canDrop = true;
    // (a little off the spot, unless that's off the edge of something)
    let to = { x: land.x + sim.rng.range(-0.8, 0.8), y: land.y, z: land.z + sim.rng.range(-0.8, 0.8) };
    if (sim.nav.regionAt(to) == null) to = { x: land.x, y: land.y, z: land.z };
    z.fling = { from: { ...M }, to, t: 0, dur: c.flight };
    sim.zombies.push(z);
    T.crew.push(z.id);
    T.toSpit--;
    sim.emit('zombieSpawn', { id: z.id, zombieType: z.type, pos: { ...z.pos }, windowId: null });
    sim.emit('titanSpit', { id: T.id, zombieId: z.id, from: M, to: { ...z.fling.to }, dur: c.flight });
  }
}

// skeletons in the air, from the Captain's mouth to the ground
function updateFlung(sim, dt) {
  for (const z of sim.zombies) {
    if (z.state !== 'flung') continue;
    const f = z.fling;
    f.t += dt;
    const u = Math.min(1, f.t / f.dur);
    const arc = 4 + Math.hypot(f.to.x - f.from.x, f.to.z - f.from.z) * 0.22;
    z.pos.x = f.from.x + (f.to.x - f.from.x) * u;
    z.pos.z = f.from.z + (f.to.z - f.from.z) * u;
    z.pos.y = f.from.y + (f.to.y - f.from.y) * u + Math.sin(Math.PI * u) * arc;
    z.moveSpeed = 0;
    if (u >= 1) {
      z.pos.y = f.to.y; z.fling = null; z.state = 'chase'; z.stateTime = 0; z.grounded = true; z.vel.y = 0;
      z.region = sim.nav.regionAt(z.pos);
      sim.emit('skeletonLand', { id: z.id, pos: { ...z.pos } });
    }
  }
}

// ---------------------------------------------------------------------------
// The Warden
// ---------------------------------------------------------------------------
function updateWarden(sim, T, dt, here) {
  const c = sim.cfg.crust.egg.research, E = sim.crustEgg, now = sim.time;
  // a charged coil fires into it when it walks close
  for (const k of E.coils) {
    if (!k.ready) continue;
    if (Math.hypot(k.x - T.pos.x, k.z - T.pos.z) > c.coilRange || (T.act && (T.act.kind === 'struck' || T.act.kind === 'leap'))) continue;
    k.ready = false; k.charge = 0; k.coolUntil = now + c.recharge;
    T.done++;
    T.act = { kind: 'struck', t: 0 };
    sim.emit('coilStrike', { id: T.id, coil: k.id, from: { x: k.x, y: k.y, z: k.z }, to: { x: T.pos.x, y: T.pos.y + 4.5, z: T.pos.z }, strikes: T.done, of: T.of, playerId: k.by });
    if (T.done >= T.of) return;
  }
  const target = nearest(sim, T, here);
  if (T.act) {
    const a = T.act;
    if (a.kind === 'leap') { updateLeap(sim, T, dt); return; }
    if (a.kind === 'struck') { a.t += dt; T.moveSpeed = 0; if (a.t >= c.stun) T.act = null; return; }
    if (a.kind === 'stomp') { T.moveSpeed = 0; smash(sim, T, dt, c.stompRange, c.stompWarn, c.stompDamage, c.stompPush); return; }
    if (a.kind === 'laser') {
      a.t += dt; T.moveSpeed = 0;
      const tp = sim.playerById(a.target);
      const eye = { x: T.pos.x, y: T.pos.y + c.eyeHeight, z: T.pos.z };
      // it tracks you, then locks on just before it fires
      if (tp && tp.alive && a.t < c.laserWarn * 0.7) { a.aim = { x: tp.pos.x, y: tp.pos.y + 1, z: tp.pos.z }; face(T, tp, dt, 4); }
      if (!a.fired && a.t >= c.laserWarn) {
        a.fired = true;
        const dx = a.aim.x - eye.x, dy = a.aim.y - eye.y, dz = a.aim.z - eye.z, l = Math.hypot(dx, dy, dz) || 1;
        const dir = { x: dx / l, y: dy / l, z: dz / l };
        const wall = sim.raycastWorld(eye, dir, c.laserLen);
        const len = wall ? wall.t : c.laserLen;
        a.end = { x: eye.x + dir.x * len, y: eye.y + dir.y * len, z: eye.z + dir.z * len };
        for (const p of sim.players) {
          if (!p.alive || p.launch) continue;
          const q = { x: p.pos.x - eye.x, y: p.pos.y + 1 - eye.y, z: p.pos.z - eye.z };
          const along = q.x * dir.x + q.y * dir.y + q.z * dir.z;
          if (along < 0 || along > len) continue;
          const off = Math.hypot(q.x - dir.x * along, q.y - dir.y * along, q.z - dir.z * along);
          if (off < c.laserWidth) sim.damagePlayer(p, c.laserDamage, { pos: { x: eye.x, z: eye.z } });
        }
        sim.emit('titanLaser', { id: T.id, from: eye, to: a.end });
      }
      if (a.t >= c.laserWarn + 0.45) { T.act = null; T.next.laser = now + sim.rng.range(c.laserEvery[0], c.laserEvery[1]); }
      return;
    }
  }
  if (!target) { T.moveSpeed = 0; return; }
  const dist = d2(target.pos, T.pos);
  if (dist < c.stompRange && Math.abs(target.pos.y - T.pos.y) < 3) {
    T.act = { kind: 'stomp', t: 0 }; sim.emit('titanWindup', { id: T.id, kind: 'stomp', warn: c.stompWarn, pos: { ...T.pos }, radius: c.stompRange * 1.25 }); return;
  }
  if (now >= T.next.laser && dist < c.laserLen * 0.9) {
    const eye = { x: T.pos.x, y: T.pos.y + c.eyeHeight, z: T.pos.z };
    const tx = target.pos.x - eye.x, ty = target.pos.y + 1 - eye.y, tz = target.pos.z - eye.z, l = Math.hypot(tx, ty, tz);
    if (!sim.raycastWorld(eye, { x: tx / l, y: ty / l, z: tz / l }, l, true)) {
      T.act = { kind: 'laser', t: 0, target: target.id, aim: { x: target.pos.x, y: target.pos.y + 1, z: target.pos.z } };
      sim.emit('titanWindup', { id: T.id, kind: 'laser', warn: c.laserWarn, playerId: target.id });
      return;
    }
    T.next.laser = now + 1;
  }
  // the lab's dead come when it calls
  if (now >= T.next.adds) {
    T.next.adds = now + c.addsEvery;
    const alive = sim.zombies.filter((z) => z.titan === T.id).length;
    for (let i = 0; i < c.adds && alive + i < c.addsMax; i++) riseNear(sim, T, 'labzombie', 4 + i * 2);
  }
  stride(sim, T, target.pos, target.region, c.speed, dt, { indoor: false });
  if (T.stuckT > sim.cfg.crust.egg.leap.stuck) leapToward(sim, T, target, c.leapTime);
}

// one of its adds claws up out of the ground near it
function riseNear(sim, T, cast, off) {
  const c = sim.cfg.zombie, round = Math.max(1, sim.rounds.round);
  const a = sim.rng.range(0, Math.PI * 2);
  const x = T.pos.x + Math.cos(a) * off, z0 = T.pos.z + Math.sin(a) * off;
  const g = groundHeight(x, z0, 0.3, T.pos.y + 1.5, [sim.world.solids, sim.world.terrain]);
  if (g < T.pos.y - 3) return null;
  const z = makeZombie(sim, { type: pickZombieType(sim, round), pos: { x, y: g - c.riseDepth, z: z0 }, yaw: a, health: zombieHealthForRound(round, c), state: 'rising' });
  z.riseBase = g; z.riseFrom = z.pos.y - g; z.cast = cast; z.titan = T.id;
  sim.zombies.push(z);
  sim.emit('zombieSpawn', { id: z.id, zombieType: z.type, pos: { ...z.pos }, windowId: null, rising: true });
  sim.emit('zombieRise', { id: z.id, pos: { x, y: g, z: z0 } });
  return z;
}

// ---------------------------------------------------------------------------
// The Glacier Golem
// ---------------------------------------------------------------------------
function updateGolem(sim, T, dt, here) {
  const c = sim.cfg.crust.egg.caves, now = sim.time;
  const target = nearest(sim, T, here);
  if (T.act) {
    const a = T.act;
    if (a.kind === 'leap') { updateLeap(sim, T, dt); return; }
    if (a.kind === 'kneel') { a.t += dt; T.moveSpeed = 0; if (a.t >= c.stun) { T.act = { kind: 'rise', t: 0 }; sim.emit('titanRise', { id: T.id }); } return; }
    if (a.kind === 'rise') { a.t += dt; T.moveSpeed = 0; if (a.t >= c.riseTime) T.act = null; return; }
    if (a.kind === 'slam') { T.moveSpeed = 0; smash(sim, T, dt, c.slamRange, c.slamWarn, c.slamDamage, c.slamPush); return; }
    if (a.kind === 'nova') {
      a.t += dt; T.moveSpeed = 0;
      if (!a.hit && a.t >= c.novaWarn) {
        a.hit = true;
        for (const p of sim.players) {
          if (!p.alive || p.launch || d2(p.pos, T.pos) > c.novaRadius || Math.abs(p.pos.y - T.pos.y) > 4) continue;
          p.slowUntil = now + c.slowTime; p.slowMult = c.slow;
          sim.damagePlayer(p, c.novaDamage, { pos: { x: T.pos.x, z: T.pos.z } });
        }
        sim.emit('titanNova', { id: T.id, pos: { ...T.pos }, radius: c.novaRadius });
      }
      if (a.t >= c.novaWarn + 0.5) { T.act = null; T.next.nova = now + sim.rng.range(c.novaEvery[0], c.novaEvery[1]); }
      return;
    }
  }
  if (!target) { T.moveSpeed = 0; return; }
  const dist = d2(target.pos, T.pos);
  if (dist < c.slamRange && Math.abs(target.pos.y - T.pos.y) < 3) {
    T.act = { kind: 'slam', t: 0 }; sim.emit('titanWindup', { id: T.id, kind: 'slam', warn: c.slamWarn, pos: { ...T.pos }, radius: c.slamRange * 1.25 }); return;
  }
  if (now >= T.next.nova && dist < c.novaRadius * 1.3) {
    T.act = { kind: 'nova', t: 0 }; sim.emit('titanWindup', { id: T.id, kind: 'nova', warn: c.novaWarn, pos: { ...T.pos }, radius: c.novaRadius }); return;
  }
  if (now >= T.next.shards) {
    T.next.shards = now + sim.rng.range(c.shardsEvery[0], c.shardsEvery[1]);
    // ice spikes come up under you (and either side of you)
    for (let i = 0; i < c.shards; i++) {
      const p = here[i % here.length];
      const lead = i < here.length ? 0.6 : 0;
      const a = sim.rng.range(0, Math.PI * 2), r = i < here.length ? 0 : sim.rng.range(1.5, 3.5);
      const x = p.pos.x + p.vel.x * lead + Math.cos(a) * r, z = p.pos.z + p.vel.z * lead + Math.sin(a) * r;
      const y = groundHeight(x, z, 0.3, p.pos.y + 1, [sim.world.solids, sim.world.terrain]);
      hazard(sim, { kind: 'shard', x, y: y > p.pos.y - 4 ? y : p.pos.y, z, r: c.shardRadius, at: now + c.shardWarn, until: now + c.shardWarn + 1.2, dmg: c.shardDamage });
    }
  }
  stride(sim, T, target.pos, target.region, c.speed, dt);
  if (T.stuckT > sim.cfg.crust.egg.leap.stuck) leapToward(sim, T, target, c.leapTime);
}

// the icicle clusters: shot down, they fall; a hit drops the golem to its knees
function updateClusters(sim, dt) {
  const E = sim.crustEgg, c = sim.cfg.crust.egg.caves, now = sim.time;
  for (const k of E.clusters) {
    if (k.state === 'gone') { if (now >= k.regrowAt) { k.state = 'hang'; sim.emit('clusterRegrow', { id: k.id }); } continue; }
    if (k.state !== 'fall') continue;
    k.t += dt;
    if (k.t < c.fall) continue;
    k.state = 'gone'; k.regrowAt = now + c.regrow;
    const pos = { x: k.x, y: k.ground, z: k.z };
    blastPlayers(sim, pos, c.crushRadius, c.crushDamage, 0.6);
    const T = E.titans.caves;
    let hit = false;
    if (T && T.state === 'fight' && d2(T.pos, pos) < c.hitRadius && Math.abs(T.pos.y - pos.y) < 3 && !(T.act && (T.act.kind === 'kneel' || T.act.kind === 'leap'))) {
      hit = true;
      T.act = { kind: 'kneel', t: 0 };
    }
    sim.emit('clusterLand', { id: k.id, pos, hit });
    if (hit) sim.emit('titanKneel', { id: 'caves', pos: { ...T.pos }, stun: c.stun });
  }
}

export function shootCluster(sim, id, p) {
  const E = sim.crustEgg;
  if (!E || E.active !== 'caves') return;
  const k = E.clusters.find((q) => q.id === id);
  if (!k || k.state !== 'hang') return;
  k.state = 'fall'; k.t = 0;
  k.ground = groundHeight(k.x, k.z, 0.5, k.y - 0.5, [sim.world.solids, sim.world.terrain]);
  sim.emit('clusterFall', { id: k.id, from: { x: k.x, y: k.y, z: k.z }, to: { x: k.x, y: k.ground, z: k.z }, dur: sim.cfg.crust.egg.caves.fall, playerId: p ? p.id : null });
}

// A knife swing: is it into the golem's heart (on its knees)?
export function knifeTitan(sim, p) {
  const E = sim.crustEgg;
  if (!E || E.active !== 'caves') return false;
  const T = E.titans.caves, c = sim.cfg.crust.egg.caves;
  if (T.state !== 'fight' || !T.act || T.act.kind !== 'kneel' || T.act.stabbed) return false;
  const dx = T.pos.x - p.pos.x, dz = T.pos.z - p.pos.z, d = Math.hypot(dx, dz);
  if (d > c.knifeReach + T.bulk || Math.abs(T.pos.y - p.pos.y) > 2) return false;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  if (d > 0.5 && (dx * fx + dz * fz) / d < 0.35) return false;
  T.act.stabbed = true;
  T.done++;
  sim.addPoints(p, sim.cfg.points.knifeKill, 'knife');
  sim.emit('titanHeart', { id: 'caves', playerId: p.id, hearts: T.done, of: T.of, pos: { x: T.pos.x, y: T.pos.y + 2, z: T.pos.z } });
  // it doesn't stay down after that
  if (T.done < T.of) { T.act = { kind: 'rise', t: 0 }; sim.emit('titanRise', { id: 'caves' }); T.next.nova = sim.time + c.riseTime; }
  return true;
}

// ---------------------------------------------------------------------------
// The Molten Fiend
// ---------------------------------------------------------------------------
function updateFiend(sim, T, dt, here) {
  const c = sim.cfg.crust.egg.trench, now = sim.time;
  const target = nearest(sim, T, here);
  if (T.act) {
    const a = T.act;
    if (a.kind === 'leap') { updateLeap(sim, T, dt); return; }
    a.t += dt; T.moveSpeed = 0;
    if (a.kind === 'stagger') { if (a.t >= c.stagger) T.act = null; return; }
    if (a.kind === 'lob') { if (a.t >= c.lobWarn * 0.5) T.act = null; return; }
    if (a.kind === 'erupt') {
      if (!a.hit && a.t >= c.eruptTime) {
        a.hit = true;
        blastPlayers(sim, T.pos, c.eruptRadius, c.eruptDamage, 0.55, 7);
        sim.emit('titanErupt', { id: T.id, pos: { ...T.pos }, radius: c.eruptRadius });
      }
      if (a.t >= c.eruptTime + 0.8) { T.act = null; T.next.erupt = now + sim.rng.range(c.eruptEvery[0], c.eruptEvery[1]); }
      return;
    }
  }
  if (!target) { T.moveSpeed = 0; return; }
  const dist = d2(target.pos, T.pos);
  if (now >= T.next.erupt && dist < c.eruptRadius * 1.6) {
    T.act = { kind: 'erupt', t: 0 }; sim.emit('titanWindup', { id: T.id, kind: 'erupt', warn: c.eruptTime, pos: { ...T.pos }, radius: c.eruptRadius }); return;
  }
  if (now >= T.next.lob) {
    T.next.lob = now + sim.rng.range(c.lobEvery[0], c.lobEvery[1]);
    T.act = { kind: 'lob', t: 0 };
    const hand = { x: T.pos.x, y: T.pos.y + c.handHeight, z: T.pos.z };
    for (let i = 0; i < c.lobs; i++) {
      const p = here[i % here.length];
      const a = sim.rng.range(0, Math.PI * 2), r = i < here.length ? sim.rng.range(0, 1) : sim.rng.range(2, 4.5);
      const x = p.pos.x + p.vel.x * c.lobWarn * 0.5 + Math.cos(a) * r, z = p.pos.z + p.vel.z * c.lobWarn * 0.5 + Math.sin(a) * r;
      const y = groundHeight(x, z, 0.3, p.pos.y + 1.5, [sim.world.solids, sim.world.terrain]);
      hazard(sim, { kind: 'lob', x, y: y > p.pos.y - 4 ? y : p.pos.y, z, r: c.lobRadius, at: now + c.lobWarn, until: now + c.lobWarn, dmg: c.lobDamage, from: hand });
    }
    return;
  }
  stride(sim, T, target.pos, null, c.speed, dt, { nav: false, turn: 1.6 });
  // (stuck: it sinks into the rock and comes up somewhere near you)
  if (T.stuckT > sim.cfg.crust.egg.leap.stuck) leapToward(sim, T, target, c.burrowTime);
}

// a shell from a field gun, on its way
function updateShells(sim) {
  const E = sim.crustEgg, c = sim.cfg.crust.egg.trench;
  for (let i = E.shells.length - 1; i >= 0; i--) {
    const s = E.shells[i];
    if (sim.time < s.at) continue;
    E.shells.splice(i, 1);
    explode(sim, s.to, 'shell', s.by);
    const T = E.titans.trench;
    if (!T) continue;
    if (T.state === 'asleep' && d2(s.to, T.home) < c.wakeRadius) { wakeTitan(sim, 'trench', sim.playerById(s.by)); continue; }
    if (T.state !== 'fight' || (T.act && T.act.kind === 'leap')) continue;
    // (anywhere from its feet to its head: a shell to the chest used to miss)
    if (d2(s.to, T.pos) < c.hitRadius && s.to.y > T.pos.y - 3 && s.to.y < T.pos.y + T.height + 2) {
      T.done++;
      T.act = { kind: 'stagger', t: 0 };
      const p = sim.playerById(s.by);
      if (p) sim.addPoints(p, c.hitPoints, 'titan');
      sim.emit('titanHurt', { id: T.id, hits: T.done, of: T.of, pos: { ...T.pos }, playerId: s.by });
    }
  }
}

// ---------------------------------------------------------------------------
// hazards on the ground: ice shards, magma, burning pools
// ---------------------------------------------------------------------------
function updateHazards(sim, dt) {
  const E = sim.crustEgg, now = sim.time, tc = sim.cfg.crust.egg.trench;
  for (let i = E.hazards.length - 1; i >= 0; i--) {
    const h = E.hazards[i];
    if (!h.went && now >= h.at) {
      h.went = true;
      if (h.kind === 'shard' || h.kind === 'lob') blastPlayers(sim, h, h.r, h.dmg, 0.5);
      sim.emit('titanHazardHit', { id: h.id, kind: h.kind, x: h.x, y: h.y, z: h.z, r: h.r });
      if (h.kind === 'lob') hazard(sim, { kind: 'burn', x: h.x, y: h.y, z: h.z, r: tc.burnRadius, at: now, until: now + tc.burnTime, dps: tc.burnDps, went: true });
    }
    if (h.kind === 'burn') {
      h.tick = (h.tick || 0) + dt;
      if (h.tick >= 0.25) {
        h.tick -= 0.25;
        for (const p of sim.players) if (p.alive && !p.launch && d2(p.pos, h) < h.r && Math.abs(p.pos.y - h.y) < 1.2) sim.damagePlayer(p, h.dps * 0.25, { pos: { x: h.x, z: h.z } });
      }
    }
    if (now >= h.until && h.went) E.hazards.splice(i, 1);
  }
}

// ---------------------------------------------------------------------------
// What a bullet can hit: the titans (it sparks off) and the icicle clusters.
// ---------------------------------------------------------------------------
export function crustEggTargets(sim) {
  const E = sim.crustEgg;
  if (E && finaleOn(E)) return zachTargets(sim);
  if (!E || !E.active) return [];
  const out = [];
  const T = E.titans[E.active];
  if (T.state === 'fight' || T.state === 'waking') {
    if (T.id === 'ship') {
      const c = sim.cfg.crust.egg.ship;
      out.push({ id: 'titan', c: { x: T.pos.x, y: T.pos.y + c.rise + 9, z: T.pos.z }, r: 8.5, surface: 'rock' });
    } else {
      const s = sim.cfg.crust.egg.hitSpheres[T.id];
      for (const [y, r] of s) out.push({ id: 'titan', c: { x: T.pos.x, y: T.pos.y + y, z: T.pos.z }, r, surface: T.id === 'research' ? 'metal' : 'rock' });
    }
  }
  if (E.active === 'caves') for (const k of E.clusters) if (k.state === 'hang') out.push({ id: k.id, c: { x: k.x, y: k.y, z: k.z }, r: sim.cfg.crust.egg.caves.clusterRadius, surface: 'glass' });
  return out;
}

export function crustEggShot(sim, id, p) {
  if (id.startsWith('cluster')) shootCluster(sim, id, p);
  else if (id === 'zach') sim.emit('zachSpark', { playerId: p.id });
}

// The HUD's line: what to do now.
export function crustEggObjective(sim, pid = null) {
  const E = sim.crustEgg;
  if (E && finaleOn(E)) return zachObjective(sim);
  if (E && !E.active) return powerObjective(sim, pid) || forgeObjective(sim, pid);
  if (!E || !E.active) return null;
  const T = E.titans[E.active];
  if (T.state === 'dying') return `${T.name} is falling`;
  if (T.id === 'ship') return T.wave ? `Hold off the Captain's crew · wave ${T.wave} of ${T.of}` : 'The Drowned Captain is waking';
  if (T.id === 'research') return `Lead the Warden past a charged tesla coil · ${T.done} of ${T.of}`;
  if (T.id === 'caves') return T.act && T.act.kind === 'kneel' ? 'Knife its heart!' : `Drop the icicles on the Golem · heart ${T.done} of ${T.of}`;
  return `Man a field gun (hold [F]) and shell the Fiend · ${T.done} of ${T.of}`;
}

// ---------------------------------------------------------------------------
// Interactables
// ---------------------------------------------------------------------------
class WakeInteractable {
  constructor(s) {
    this.spec = s; this.id = 'wake_' + s.id; this.kind = 'titan'; this.requireLook = false;
    this.pos = { x: s.wake.x, y: s.wake.y, z: s.wake.z };
  }
  get range() { return this.spec.wake.r; }
  distanceTo(sim, p) { return Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z); }
  canUse(sim, p) { const T = sim.crustEgg.titans[this.spec.id]; return p.alive && !p.downed && T.state === 'asleep'; }
  prompt(sim) {
    const E = sim.crustEgg, T = E.titans[this.spec.id];
    if (E.active) return { text: `${E.titans[E.active].name} is already awake`, cost: null };
    return { text: `Press [F] to wake ${T.name}`, cost: null };
  }
  use(sim, p, cmd) { if (cmd.usePressed) wakeTitan(sim, this.spec.id, p); }
}

class CoilInteractable {
  constructor(i) { this.i = i; this.id = 'coil_' + i; this.kind = 'coil'; this.requireLook = false; this.pos = null; }
  coil(sim) { return sim.crustEgg.coils[this.i]; }
  get range() { return 1.8; }
  distanceTo(sim, p) { const k = this.coil(sim); this.pos = k.con; return Math.hypot(p.pos.x - k.con.x, p.pos.z - k.con.z); }
  canUse(sim, p) { return p.alive && !p.downed && ((sim.crustEgg.active === 'research' && sim.crustEgg.titans.research.state === 'fight') || coilsForTrial(sim)); }
  prompt(sim) {
    const k = this.coil(sim);
    if (k.ready) return { text: 'The coil is charged: lead the Warden to it', cost: null };
    if (sim.time < k.coolUntil) return { text: `The coil is recharging (${Math.ceil(k.coolUntil - sim.time)}s)`, cost: null };
    return { text: 'Hold [F] to charge the tesla coil', cost: null, hold: true };
  }
  use(sim, p, cmd, dt) {
    const k = this.coil(sim), c = sim.cfg.crust.egg.research;
    if (k.ready || sim.time < k.coolUntil) { p.reviving = null; return; }
    if (!cmd.use) { p.reviving = null; return; }
    k.charge = Math.min(1, k.charge + dt / c.charge);
    p.reviving = { frac: k.charge, label: 'Charging' };
    if (k.charge >= 1) { k.ready = true; k.by = p.id; p.reviving = null; sim.emit('coilCharged', { coil: k.id, pos: { x: k.x, y: k.y, z: k.z }, playerId: p.id }); }
  }
  release(sim, p) { p.reviving = null; }
}

class FieldGunInteractable {
  constructor(i) { this.i = i; this.id = 'fieldgun_' + i; this.kind = 'fieldgun'; this.requireLook = false; this.pos = null; }
  gun(sim) { return sim.crustEgg.guns[this.i]; }
  get range() { return 3.2; }
  distanceTo(sim, p) { const g = this.gun(sim); this.pos = g; return Math.hypot(p.pos.x - g.x, p.pos.z - g.z); }
  canUse(sim, p) { return p.alive && !p.downed && !p.manning && gunsLive(sim.crustEgg); }
  prompt(sim) {
    const g = this.gun(sim);
    if (g.by) return { text: 'Someone is on this gun', cost: null };
    if (sim.time < g.readyAt) return { text: `Reloading (${Math.ceil(g.readyAt - sim.time)}s)`, cost: null };
    return { text: 'Hold [F] to man the field gun', cost: null, hold: true };
  }
  use(sim, p, cmd, dt) {
    const g = this.gun(sim), c = sim.cfg.crust.egg.trench;
    if (g.by || sim.time < g.readyAt || !cmd.use) { p.reviving = null; this.held = 0; return; }
    this.held = (this.heldBy === p.id ? this.held || 0 : 0) + dt; this.heldBy = p.id;
    p.reviving = { frac: Math.min(1, this.held / c.manHold), label: 'Manning' };
    if (this.held >= c.manHold) { this.held = 0; p.reviving = null; mountGun(sim, p, g); }
  }
  release(sim, p) { p.reviving = null; this.held = 0; }
}

// --- manning a field gun --------------------------------------------------------
// The guns can be manned while the Fiend's asleep in its crater (shell it to wake
// it) or up and fighting.
function gunsLive(E) {
  const T = E && E.titans.trench;
  return !!T && (E.active === 'trench' ? T.state === 'fight' : (!E.active && T.state === 'asleep'));
}
// You sit in the gun: you're held at its breech and look along its barrel.
function mountGun(sim, p, g) {
  g.by = p.id;
  p.manning = { gun: g.id };
  p.manRev = (p.manRev || 0) + 1;   // (online: tells a friend's browser to sit them in it)
  p.sprinting = false; p.crouched = false; p.prone = null; p.dive = null; p.emote = null;
  sim.emit('fieldGunMan', { gun: g.id, playerId: p.id });
}
// Off the gun: a step back from it.
function dismountGun(sim, p, g) {
  if (!p.manning) return;
  p.manning = null;
  if (g && g.by === p.id) g.by = null;
  if (sim.replica) return;   // (online: the host lets the gun go; your own browser moves you)
  p.manRev = (p.manRev || 0) + 1;
  if (g) {
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), back = sim.cfg.crust.egg.trench.offGun;
    const x = g.x - fx * back, z = g.z - fz * back;
    const y = groundHeight(x, z, 0.3, g.y + 2, [sim.world.solids, sim.world.terrain]);
    p.pos.x = x; p.pos.z = z; p.pos.y = Number.isFinite(y) && y > g.y - 3 ? y : g.y;
    p.tp = (p.tp || 0) + 1;   // (online: the host moved you)
  }
  sim.emit('fieldGunOff', { gun: g ? g.id : null, playerId: p.id });
}
export function manPrompt(sim, p) {
  const g = sim.crustEgg && sim.crustEgg.guns.find((q) => q.id === (p.manning && p.manning.gun));
  if (g && sim.time < g.readyAt) return { text: `Reloading (${Math.ceil(g.readyAt - sim.time)}s)`, cost: null };
  return { text: 'Fire to shoot the field gun · Jump to get off', cost: null };
}
// Every step you're on a gun (instead of walking and shooting): held in your seat,
// fire once and you're off; jump to get off without firing.
export function updateManning(sim, p, cmd) {
  const E = sim.crustEgg, g = E && E.guns.find((q) => q.id === p.manning.gun);
  if (!g || !p.alive || p.downed || !gunsLive(E)) {
    if (sim.replica) sim.netOut.push({ k: 'cannonOff' });
    dismountGun(sim, p, g); return;
  }
  p.pos.x = g.x; p.pos.y = g.y; p.pos.z = g.z;
  p.vel.x = p.vel.y = p.vel.z = 0; p.grounded = true; p.sprinting = false;
  if (cmd.jumpPressed) {
    if (sim.replica) sim.netOut.push({ k: 'cannonOff' });
    dismountGun(sim, p, g); return;
  }
  if (cmd.firePressed && sim.time >= g.readyAt) {
    const eye = sim.eyePosition(p), dir = lookDir(p.yaw, p.pitch);
    if (sim.replica) sim.netOut.push({ k: 'cannon', gun: g.id, origin: eye, dir });
    else fireFieldGun(sim, p, g, eye, dir);
    dismountGun(sim, p, g);
  }
}
// Online: a friend fired the gun they're sitting in (or got off it).
export function cannonShot(sim, p, gunId, origin, dir) {
  const E = sim.crustEgg, g = E && E.guns.find((q) => q.id === gunId);
  if (!g || !p.manning || p.manning.gun !== gunId || !origin || !dir) return;
  if (sim.time >= g.readyAt && gunsLive(E)) fireFieldGun(sim, p, g, origin, dir);
  dismountGun(sim, p, g);
}
export function cannonOff(sim, p) {
  const E = sim.crustEgg;
  dismountGun(sim, p, E && p.manning && E.guns.find((q) => q.id === p.manning.gun));
}
// The shell flies straight where you aimed: at the Fiend if it's in your sights,
// else the first thing in the way.
function fireFieldGun(sim, p, g, eye, dir) {
  const c = sim.cfg.crust.egg.trench, E = sim.crustEgg;
  const o = { x: eye.x + dir.x * 1.5, y: eye.y + dir.y * 1.5, z: eye.z + dir.z * 1.5 };   // (out past the gun's own barrel)
  let t = c.range;
  for (const tg of crustEggTargets(sim)) {
    if (tg.id !== 'titan') continue;
    const k = raySphere(o, dir, tg.c, tg.r);
    if (k != null && k < t) t = k;
  }
  const hit = sim.raycastWorld(o, dir, t);
  if (hit && hit.t < t) t = hit.t;
  const to = { x: o.x + dir.x * t, y: o.y + dir.y * t, z: o.z + dir.z * t };
  g.readyAt = sim.time + c.reload;
  const from = { x: g.x, y: g.y + 1.2, z: g.z }, dur = Math.max(0.12, t / c.shellSpeed);
  E.shells.push({ from, to, at: sim.time + dur, by: p.id });
  sim.emit('fieldGunFire', { gun: g.id, from, to, dur, direct: true, playerId: p.id });
}
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : (cc < 0 ? 0 : null);
}
