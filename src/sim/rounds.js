// =============================================================================
// Round manager: counts, spawn pacing, intermissions.
// =============================================================================
import { createLoadout } from './weapons.js';
import { zombieCountForRound, zombieHealthForRound } from '../config.js';
import { spawnZombie, spawnRising, spawnCheddar } from './zombies.js';
import { resetRoundDrops, spawnPowerup } from './powerups.js';
import { dist2D } from '../core/math.js';

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

// Somewhere open, inside the map, a few metres from a player.
function strikePoint(sim) {
  const ch = sim.cfg.cheddar;
  const players = sim.players.filter((p) => p.alive && !p.downed);
  const list = players.length ? players : sim.players.filter((p) => p.alive);
  if (!list.length) return null;
  const p = list[Math.floor(sim.rng.next() * list.length)];
  for (let tries = 0; tries < 30; tries++) {
    const a = sim.rng.range(0, Math.PI * 2);
    const d = sim.rng.range(ch.spawnDist[0], ch.spawnDist[1]) * (tries > 20 ? 0.5 : 1);
    const pos = { x: p.pos.x + Math.cos(a) * d, y: 0, z: p.pos.z + Math.sin(a) * d };
    const r = sim.nav.regionAt(pos);
    if (!r) continue;
    const room = sim.world.roomById.get(sim.nav.roomOfRegion(r));
    if (!room || !sim.openZones.has(room.zone)) continue;
    const rad = ch.radius + 0.2;
    if (sim.world.solids.some((b) => b.minY < 1 && b.maxY > 0.1 && pos.x > b.minX - rad && pos.x < b.maxX + rad && pos.z > b.minZ - rad && pos.z < b.maxZ + rad)) continue;
    if (sim.nav.regionAt(pos) && Math.abs(pos.y - p.pos.y) < 2) return pos;
  }
  return { x: p.pos.x + 3, y: 0, z: p.pos.z };
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
    for (const p of sim.players) { p.boardPointsThisRound = 0; if (sim.cfg.equipment.frag.refillEachRound && p.alive) p.grenades = Math.max(p.grenades, p.grenadeMax); }
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
  }
  sim.emit('roundStart', { round: n, zombies: R.total, health: zombieHealthForRound(n, sim.cfg.zombie) });
}

// Spawn points in open, occupied zones (windows, fences and dirt patches).
// Ones near players are more likely; busy windows less so.
function pickSpawn(sim) {
  const act = sim.activeZones();
  const cands = sim.spawnWindows().map((w) => ({ win: w, pos: w.center, weight: 1 / (1 + w.queue.length * 0.5) }));
  for (const g of sim.world.groundSpawns) if (act.has(g.zone)) cands.push({ ground: g, pos: g, weight: sim.cfg.zombie.groundSpawnWeight });
  if (!cands.length) return null;
  const weights = cands.map((c) => {
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
  if (R.cheddar) { updateCheddarRound(sim, dt); return; }
  // active
  const alive = sim.zombies.length;
  if (R.toSpawn > 0 && alive < c.maxAlive) {
    R.spawnTimer -= dt;
    if (R.spawnTimer <= 0) {
      const sp = pickSpawn(sim);
      if (sp) {
        if (sp.ground) spawnRising(sim, sp.ground, R.round);
        else spawnZombie(sim, sp.win, R.round);
        R.toSpawn--;
      }
      R.spawnTimer = R.spawnInterval * sim.rng.range(0.7, 1.3);
    }
  }
  if (R.toSpawn <= 0 && alive === 0) {
    R.phase = 'intermission';
    R.timer = c.intermission;
    sim.emit('roundEnd', { round: R.round });
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
      if (pos) { spawnCheddar(sim, pos, cheddarHealth(sim, R.cheddarIndex)); R.toSpawn--; }
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
    p.loadout = createLoadout(sim, sim.cfg.startingWeapon);
    p.grenades = p.grenadeMax;
    p.drinking = null; p.reviving = null; p.throwing = null;
    p.tp = (p.tp || 0) + 1;     // online: tells their own copy it was moved
    sim.emit('playerRespawn', { playerId: p.id });
  }
}
