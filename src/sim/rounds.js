// =============================================================================
// Round manager: counts, spawn pacing, intermissions.
// =============================================================================
import { zombieCountForRound, zombieHealthForRound } from '../config.js';
import { spawnZombie } from './zombies.js';
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

// Windows near players are more likely to be picked. Later phases will
// restrict this to windows in zones that are open and occupied.
function pickWindow(sim) {
  const wins = sim.spawnWindows();
  if (!wins.length) return null;
  const weights = wins.map((w) => {
    let d = Infinity;
    for (const p of sim.players) if (p.alive) d = Math.min(d, dist2D(p.pos, w.center));
    return 1 / (4 + (isFinite(d) ? d : 20)) * (1 / (1 + w.queue.length * 0.5));
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = sim.rng.next() * sum;
  for (let i = 0; i < wins.length; i++) { r -= weights[i]; if (r <= 0) return wins[i]; }
  return wins[wins.length - 1];
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
      const win = pickWindow(sim);
      if (win) {
        spawnZombie(sim, win, R.round);
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
