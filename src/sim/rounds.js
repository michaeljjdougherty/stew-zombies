// =============================================================================
// Round manager: counts, spawn pacing, intermissions.
// =============================================================================
import { createLoadout } from './weapons.js';
import { zombieCountForRound, zombieHealthForRound } from '../config.js';
import { spawnZombie, spawnRising, spawnCheddar, removeZombie } from './zombies.js';
import { resetRoundDrops, spawnPowerup } from './powerups.js';
import { dist2D } from '../core/math.js';
import { groundHeight } from './physics.js';
import { boxesNear } from './boxgrid.js';

export function createRoundState(sim) {
  return {
    round: 0,
    phase: 'pregame',        // pregame | active | intermission
    timer: sim.cfg.rounds.firstRoundDelay,
    toSpawn: 0,
    total: 0,
    spawnTimer: 0,
    spawnInterval: sim.cfg.rounds.spawnIntervalStart,
    killed: 0,
    cheddar: false,          // is this a Cheddar Round?
    cheddarIndex: 0,         // how many Cheddar Rounds so far
    cheddarNext: sim.rng.int ? sim.rng.int(sim.cfg.cheddar.firstRound[0], sim.cfg.cheddar.firstRound[1]) : sim.cfg.cheddar.firstRound[0],
    preTimer: 0,
  };
}

export function cheddarHealth(sim, idx) {
  const h = sim.cfg.cheddar.health;
  return idx <= h.length ? h[idx - 1] : h[h.length - 1] + 600 * (idx - h.length);
}

// Somewhere open, inside the map, a few metres from a player, standing on the
// floor the player is on (the Crust's islands sit at all heights, over nothing).
export function strikePoint(sim) {
  const ch = sim.cfg.cheddar;
  const players = sim.players.filter((p) => p.alive && !p.downed);
  const list = players.length ? players : sim.players.filter((p) => p.alive);
  if (!list.length) return null;
  const p = list[Math.floor(sim.rng.next() * list.length)];
  for (let tries = 0; tries < 30; tries++) {
    const a = sim.rng.range(0, Math.PI * 2);
    const d = sim.rng.range(ch.spawnDist[0], ch.spawnDist[1]) * (tries > 20 ? 0.5 : 1);
    const pos = strikeSpot(sim, p, p.pos.x + Math.cos(a) * d, p.pos.z + Math.sin(a) * d);
    if (pos) return pos;
  }
  // somewhere cramped (a lookout, a mast): closer in, round anyone standing
  const a0 = sim.rng.range(0, Math.PI * 2);
  for (const q of [p, ...list.filter((o) => o !== p)]) {
    for (const d of [3.5, 2.5, 1.6]) {
      for (let k = 0; k < 12; k++) {
        const a = a0 + k / 12 * Math.PI * 2;
        const pos = strikeSpot(sim, q, q.pos.x + Math.cos(a) * d, q.pos.z + Math.sin(a) * d);
        if (pos) return pos;
      }
    }
  }
  return null;   // nowhere good just now: the next strike tries again
}

// The floor at (x, z) if a hound can stand there: on the player's level (no
// higher than a step up, no drop or void under it), inside an open part of the
// map, and clear of walls, crates and rock.
function strikeSpot(sim, p, x, z) {
  const ch = sim.cfg.cheddar;
  const lists = [sim.world.solids, sim.world.terrain];
  const y = groundHeight(x, z, 0.1, p.pos.y + 1.5, lists);
  if (Math.abs(y - p.pos.y) >= 2) return null;
  const pos = { x, y, z };
  const r = sim.nav.regionAt(pos);
  if (!r) return null;
  const reg = sim.nav.byId.get(r);
  if (reg && (y < reg.y0 - 0.6 || y > reg.y1 + 0.6)) return null;
  const room = sim.world.roomById.get(sim.nav.roomOfRegion(r));
  if (!room || !sim.openZones.has(room.zone)) return null;
  const rad = ch.radius + 0.2;
  if (lists.some((l) => boxesNear(l, x, z, rad).some((b) => b.minY < y + ch.height && b.maxY > y + 0.1 && x > b.minX - rad && x < b.maxX + rad && z > b.minZ - rad && z < b.maxZ + rad))) return null;
  return pos;
}

function startRound(sim, n) {
  const R = sim.rounds, c = sim.cfg.rounds;
  const players = sim.players.length;
  R.round = n;
  R.phase = 'active';
  respawnTheFallen(sim);
  resetRoundDrops(sim);
  R.cheddar = sim.mode !== 'range' && n === R.cheddarNext;
  if (R.cheddar) {
    const ch = sim.cfg.cheddar;
    R.cheddarIndex++;
    R.cheddarNext = n + Math.round(sim.rng.range(ch.every[0], ch.every[1]));
    R.total = Math.min(ch.maxCount, (ch.perPlayer + ch.addPerRound * (R.cheddarIndex - 1)) * players);
    R.toSpawn = R.total;
    R.killed = 0;
    R.preTimer = ch.preRoundTime;
    R.spawnTimer = 0;
    for (const p of sim.players) { p.boardPointsThisRound = 0; if (sim.cfg.equipment.frag.refillEachRound && p.alive) p.grenades = Math.max(p.grenades, p.grenadeMax); if (p.alive) p.lbds = Math.max(p.lbds || 0, p.lbdMax || 0); }
    sim.emit('roundStart', { round: n, zombies: R.total, cheddar: true, health: cheddarHealth(sim, R.cheddarIndex) });
    sim.emit('cheddarStart', { round: n, count: R.total });
    return;
  }
  R.total = zombieCountForRound(n, players, c);
  R.toSpawn = R.total;
  R.killed = 0;
  R.spawnTimer = c.firstSpawnDelay;
  R.spawnInterval = Math.max(c.spawnIntervalMin, c.spawnIntervalStart * Math.pow(c.spawnIntervalDecay, n - 1));
  for (const p of sim.players) {
    p.boardPointsThisRound = 0;
    if (sim.cfg.equipment.frag.refillEachRound && p.alive) p.grenades = Math.max(p.grenades, p.grenadeMax);
    if (p.alive) p.lbds = Math.max(p.lbds || 0, p.lbdMax || 0);   // (LBDs come back every round)
  }
  sim.emit('roundStart', { round: n, zombies: R.total, health: zombieHealthForRound(n, sim.cfg.zombie) });
}

// Spawn points in open, occupied zones (windows, fences and dirt patches).
// Ones near players are more likely; busy windows less so.
function pickSpawn(sim) {
  const act = sim.activeZones();
  const cands = sim.spawnWindows().map((w) => ({ win: w, pos: w.center, weight: 1 / (1 + w.queue.length * 0.5) }));
  for (const g of sim.world.groundSpawns) if (act.has(g.zone)) cands.push({ ground: g, pos: g, weight: sim.cfg.zombie.groundSpawnWeight });
  // sculpted ground (Call of the Crust): only where they could walk to someone from
  // (not behind debris nobody's cleared, not on another island)
  if (sim.mapData.terrainBoxes && cands.length) {
    const regs = sim.players.filter((p) => p.alive && !p.launch).map((p) => p.region || sim.nav.regionAt(p.pos));
    const ok = cands.filter((c) => {
      if (!c.ground) return true;
      const g = c.ground;
      if (g.region === undefined) g.region = sim.nav.regionAt(g);
      return regs.some((r) => sim.nav.canReach(g.region, r));
    });
    cands.splice(0, cands.length, ...ok);
  }
  if (!cands.length) return null;
  // on a big open map, only spawn points near someone (else zombies take ages to arrive)
  const rad = sim.mapData.openField ? sim.cfg.crust.spawnRadius : 0;
  if (rad) {
    const near = (c) => sim.players.some((p) => p.alive && dist2D(p.pos, c.pos) <= rad && dist2D(p.pos, c.pos) >= sim.cfg.crust.spawnMin);
    const close = cands.filter(near);
    if (close.length) cands.splice(0, cands.length, ...close);
  }
  // BO1 picks any spawn point in the live zones at random; only the open
  // battlefield leans towards the nearer ones
  const weights = cands.map((c) => {
    if (!rad) return c.weight;
    let d = Infinity;
    for (const p of sim.players) if (p.alive) d = Math.min(d, dist2D(p.pos, c.pos));
    return c.weight / (4 + (isFinite(d) ? d : 20));
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = sim.rng.next() * sum;
  for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) return cands[i]; }
  return cands[cands.length - 1];
}

// Explore mode: start round n now (zombies on, the map cleared).
export function exploreJumpToRound(sim, n) {
  if (sim.mode !== 'explore') return;
  n = Math.max(1, Math.min(100, Math.round(n)));
  for (const z of sim.zombies) if (z.state !== 'dead') { z.state = 'dead'; sim.emit('zombieRemoved', { id: z.id }); }
  for (const w of sim.windows) { w.queue.length = 0; w.climbing = null; }
  sim.explore.zombies = true;
  sim.emit('exploreZombies', { on: true });
  startRound(sim, n);
}

export function updateRounds(sim, dt) {
  const R = sim.rounds, c = sim.cfg.rounds;
  if (R.phase === 'pregame' || R.phase === 'intermission') {
    R.timer -= dt;
    if (R.timer <= 0) startRound(sim, R.round + 1);
    return;
  }
  updateRecycle(sim, dt);
  if (R.cheddar) { updateCheddarRound(sim, dt); return; }
  // active
  const alive = sim.zombies.length;
  if (R.toSpawn > 0 && alive < c.maxAlive) {
    R.spawnTimer -= dt;
    if (R.spawnTimer <= 0) {
      const sp = pickSpawn(sim);
      if (sp) {
        const z = sp.ground ? spawnRising(sim, sp.ground, R.round) : spawnZombie(sim, sp.win, R.round);
        z.recycle = true;
        R.toSpawn--;
      }
      R.spawnTimer = R.spawnInterval * (1 + sim.rng.range(-1, 1) * (c.spawnJitter || 0));
    }
  }
  if (R.toSpawn <= 0 && sim.zombies.length === 0) {   // (count again: one may have just risen)
    R.phase = 'intermission';
    R.timer = c.intermission;
    sim.emit('roundEnd', { round: R.round });
  }
}

// --- far-off zombies: pulled, and back up near the players ------------------
// A round's zombie that's stayed far from everyone (another island, the far end
// of the map) for a while is taken off and comes straight back up at a spawn
// point near someone, keeping its health. Never one somebody's looking at, and
// only when there's a spot much nearer. Once the round's down to its last few,
// "far" is nearer and the wait shorter, so the round never ends in a hunt.
// Numbers: CONFIG.rounds.recycle.
function nearestPlayerDist(sim, pos) {
  let d = Infinity;
  for (const p of sim.players) if (p.alive) d = Math.min(d, dist2D(p.pos, pos) + Math.abs((p.pos.y || 0) - (pos.y || 0)));
  return d;
}

export function seenByAnyone(sim, z) { return inSight(sim, z, sim.cfg.rounds.recycle); }

function inSight(sim, z, rc) {
  for (const p of sim.players) {
    if (!p.alive) continue;
    const dx = z.pos.x - p.pos.x, dz = z.pos.z - p.pos.z, l = Math.hypot(dx, dz);
    if (l > rc.seenDist) continue;
    if (l < 1e-3 || (-Math.sin(p.yaw) * dx - Math.cos(p.yaw) * dz) / l > rc.seenDot) return true;
  }
  return false;
}

export function recycleZombie(sim, z, within = Infinity, rc = sim.cfg.rounds.recycle) {
  let pos = null, sp = null;
  if (z.type === 'cheddar') {
    pos = strikePoint(sim);
    if (!pos || nearestPlayerDist(sim, pos) > within) return false;
  } else {
    let best = Infinity;
    for (let i = 0; i < rc.tries; i++) {
      const c = pickSpawn(sim);
      if (!c) break;
      const d = nearestPlayerDist(sim, c.pos);
      if (d < best) { best = d; sp = c; }
    }
    if (!sp || best > within) return false;
  }
  removeZombie(sim, z);
  const R = sim.rounds;
  const n = pos ? spawnCheddar(sim, pos, z.maxHealth) : sp.ground ? spawnRising(sim, sp.ground, R.round) : spawnZombie(sim, sp.win, R.round);
  n.maxHealth = Math.max(n.maxHealth, z.maxHealth);
  n.health = Math.min(n.maxHealth, z.health);
  n.recycle = true;
  sim.emit('zombieRecycled', { from: z.id, to: n.id, pos: { ...n.pos } });
  return true;
}

export function updateRecycle(sim, dt) {
  const R = sim.rounds, rc = sim.cfg.rounds.recycle;
  if (!rc || R.phase !== 'active' || (R.cheddar && R.preTimer > 0)) return;
  R.recycleT = (R.recycleT || 0) - dt;
  if (R.recycleT > 0) return;
  R.recycleT = rc.checkEvery;
  if (!sim.players.some((p) => p.alive)) return;
  const live = sim.zombies.filter((z) => z.state !== 'dead');
  const few = R.toSpawn <= 0 && live.length <= rc.lastFew;
  const far = few ? rc.lastFewDist : rc.dist, wait = few ? rc.lastFewTime : rc.time;
  for (const z of live) {
    if (!z.recycle || z.state === 'dead') continue;
    const d = nearestPlayerDist(sim, z.pos);
    if (d < far || inSight(sim, z, rc)) { z.farT = 0; continue; }
    z.farT = (z.farT || 0) + rc.checkEvery;
    if (z.farT < wait) continue;
    if (!recycleZombie(sim, z, d - rc.closerBy, rc)) z.farT = wait * 0.5;   // nowhere nearer just now: look again soon
  }
}

function updateCheddarRound(sim, dt) {
  const R = sim.rounds, ch = sim.cfg.cheddar;
  if (R.preTimer > 0) { R.preTimer -= dt; return; }
  const alive = sim.zombies.filter((z) => z.state !== 'dead').length;
  if (R.toSpawn > 0 && alive < ch.maxAlive) {
    R.spawnTimer -= dt;
    if (R.spawnTimer <= 0) {
      const pos = strikePoint(sim);
      if (pos) { spawnCheddar(sim, pos, cheddarHealth(sim, R.cheddarIndex)).recycle = true; R.toSpawn--; }
      R.spawnTimer = sim.rng.range(ch.spawnInterval[0], ch.spawnInterval[1]);
    }
  }
  if (R.toSpawn <= 0 && alive === 0) {
    // the last hound leaves a Full Pantry behind
    const at = sim.lastKill ? sim.lastKill.pos : (sim.players[0] ? sim.players[0].pos : { x: 0, z: 0 });
    spawnPowerup(sim, 'fullPantry', at);
    R.cheddar = false;
    R.phase = 'intermission';
    R.timer = sim.cfg.rounds.intermission;
    sim.emit('cheddarEnd', { round: R.round });
    sim.emit('roundEnd', { round: R.round, cheddar: true });
  }
}

// Back from bleeding out: the starting pistol (or, with Arms Grace, the guns you had).
export function respawnLoadout(sim, p) {
  p.loadout = createLoadout(sim, sim.cfg.startingWeapon);
  if (p.armsGrace) {
    p.loadout.slots = p.armsGrace.slots.filter((s) => !s.loaner && !s.disorder).slice(0, sim.cfg.player.maxWeapons);
    if (!p.loadout.slots.length) p.loadout = createLoadout(sim, sim.cfg.startingWeapon);
    p.loadout.current = 0;
    p.armsGrace = null;
    sim.emit('gumArmsGrace', { playerId: p.id });
  }
  p.loadout.drawTimer = sim.cfg.weapons[p.loadout.slots[0].id].drawTime;
  p.grenades = p.grenadeMax;
  p.drinking = null; p.reviving = null; p.throwing = null;
}

// Co-op: anyone who bled out last round is back for this one, next to a
// teammate who's still standing, with the starting pistol. (Their points stay.)
export function respawnTheFallen(sim) {
  if (sim.players.length < 2 || sim.gameOver) return;
  const standing = sim.players.filter((p) => p.alive && !p.downed);
  for (const p of sim.players) {
    if (p.alive) continue;
    const buddy = standing[0];
    const spot = buddy ? { x: buddy.pos.x + 0.9, z: buddy.pos.z + 0.6, yaw: buddy.yaw } : sim.mapData.playerSpawns[0];
    p.alive = true;
    p.downed = null;
    p.health = p.maxHealth;
    p.pos.x = spot.x; p.pos.y = buddy ? buddy.pos.y : 0; p.pos.z = spot.z;
    p.vel.x = p.vel.y = p.vel.z = 0;
    p.yaw = spot.yaw || 0;
    p.region = sim.nav.regionAt(p.pos);
    respawnLoadout(sim, p);
    p.tp = (p.tp || 0) + 1;     // online: tells their own copy it was moved
    sim.emit('playerRespawn', { playerId: p.id });
  }
}
