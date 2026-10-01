// =============================================================================
// Round manager: counts, spawn pacing, intermissions.
// =============================================================================
import { zombieCountForRound, zombieHealthForRound } from '../config.js';
import { spawnZombie, spawnRising } from './zombies.js';
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
  };
}

function startRound(sim, n) {
  const R = sim.rounds, c = sim.cfg.rounds;
  const players = sim.players.length;
  R.round = n;
  R.phase = 'active';
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

export function updateRounds(sim, dt) {
  const R = sim.rounds, c = sim.cfg.rounds;
  if (R.phase === 'pregame' || R.phase === 'intermission') {
    R.timer -= dt;
    if (R.timer <= 0) startRound(sim, R.round + 1);
    return;
  }
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
