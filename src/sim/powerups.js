// =============================================================================
// Power-ups: drops from dead zombies, pickups, and the timed effects.
//   Full Pantry      refill all ammo and grenades
//   One Bite         everything dies in one hit (timed)
//   Double Dough     double points (timed)
//   Pressure Cooker  every zombie on the map dies, +400 each
//   Shop Class       every barrier rebuilt, +200 each
//   Clearance Sale   Mystery Box costs 10 (timed)
// =============================================================================
import { refillAll } from './weapons.js';
import { killZombie } from './zombies.js';
import { dist2D } from '../core/math.js';

export function createPowerupState(sim) {
  return {
    drops: [],            // { id, type, pos, t }
    active: {},           // type -> seconds left
    earned: 0,            // team points earned toward the next drop
    nextAt: sim.cfg.powerups.firstThreshold,
    step: sim.cfg.powerups.firstThreshold,
    thisRound: 0,
    last: null,
  };
}

export const powerupActive = (sim, type) => (sim.powerups.active[type] || 0) > 0;

// Called from addPoints for points earned (not spent).
export function notePointsEarned(sim, amount) {
  if (amount > 0) sim.powerups.earned += amount;
}

function pickType(sim) {
  const P = sim.powerups, list = sim.cfg.powerups.list;
  const anyBoardsDown = sim.windows.some((w) => w.boards < w.maxBoards);
  const pool = Object.entries(list).filter(([id]) => {
    if (id === P.last) return false;
    if (id === 'shopClass' && !anyBoardsDown) return false;
    if (id === 'clearanceSale' && sim.box.uses === 0) return false;
    return true;
  });
  const total = pool.reduce((a, [, d]) => a + d.weight, 0);
  let r = sim.rng.next() * total;
  for (const [id, d] of pool) { r -= d.weight; if (r <= 0) return id; }
  return pool[pool.length - 1][0];
}

export function spawnPowerup(sim, type, pos) {
  const P = sim.powerups;
  const d = { id: sim.nextId++, type, pos: { x: pos.x, y: 0, z: pos.z }, t: sim.cfg.powerups.life };
  P.drops.push(d);
  P.last = type;
  sim.emit('powerupSpawn', { id: d.id, ptype: type, pos: { ...d.pos } });
  return d;
}

// A zombie died: maybe leave something behind. Only zombies that were inside
// the map (chasing) and killed by a player can drop.
export function maybeDrop(sim, z, info) {
  if (sim.mode === 'range' || !info.playerId || info.wasState !== 'chase') return;
  if (z.type === 'cheddar') return; // Cheddar Rounds drop their own reward
  const P = sim.powerups, pc = sim.cfg.powerups;
  if (P.thisRound >= pc.maxPerRound) return;
  let drop = false;
  if (P.earned >= P.nextAt) {
    drop = true;
    P.step *= pc.thresholdGrowth;
    P.nextAt = P.earned + P.step;
  } else if (sim.rng.chance(pc.randomChance)) drop = true;
  if (!drop) return;
  P.thisRound++;
  spawnPowerup(sim, pickType(sim), z.pos);
}

function apply(sim, type, p) {
  const pc = sim.cfg.powerups, d = pc.list[type];
  if (d.timed) sim.powerups.active[type] = pc.duration;
  switch (type) {
    case 'fullPantry':
      for (const q of sim.players) {
        if (!q.alive) continue;
        refillAll(sim, q);
        if (q.downed && q.downed.saved) for (const s of q.downed.saved.slots) {
          const wd = sim.cfg.weapons[s.id]; s.clip = wd.magSize; if (wd.dual) s.clipL = wd.magSize; s.reserve = wd.reserve;
        }
        q.grenades = Math.max(q.grenades, q.grenadeMax);
      }
      break;
    case 'pressureCooker': {
      const victims = sim.zombies.filter((z) => z.state !== 'dead' && z.state !== 'dummy');
      victims.forEach((z, i) => {
        z.nukeAt = sim.time + 0.15 + (i % 12) * 0.07; // staggered pops
      });
      sim.powerups.nuking = victims.map((z) => z.id);
      for (const q of sim.players) if (q.alive) sim.addPoints(q, d.points, 'powerup');
      break;
    }
    case 'shopClass':
      for (const w of sim.windows) {
        while (w.boards < w.maxBoards) {
          w.boards++;
          sim.emit('boardRepaired', { windowId: w.id, board: w.boards - 1, playerId: null, points: 0 });
        }
      }
      for (const q of sim.players) if (q.alive) sim.addPoints(q, d.points, 'powerup');
      break;
  }
  sim.emit('powerupGrab', { ptype: type, playerId: p.id, duration: d.timed ? pc.duration : 0 });
}

export function updatePowerups(sim, dt) {
  const P = sim.powerups, pc = sim.cfg.powerups;
  for (const k of Object.keys(P.active)) {
    if (P.active[k] <= 0) continue;
    P.active[k] -= dt;
    if (P.active[k] <= 0) { P.active[k] = 0; sim.emit('powerupEnd', { ptype: k }); }
  }
  // pressure cooker pops
  if (P.nuking) {
    let left = 0;
    for (const id of P.nuking) {
      const z = sim.zombieById(id);
      if (!z) continue;
      if (sim.time >= z.nukeAt) killZombie(sim, z, { kind: 'nuke', part: 'torso', dir: { x: 0, y: 1, z: 0 }, playerId: null });
      else left++;
    }
    if (!left) P.nuking = null;
  }
  for (let i = P.drops.length - 1; i >= 0; i--) {
    const d = P.drops[i];
    d.t -= dt;
    let taker = null;
    for (const p of sim.players) {
      if (!p.alive || p.downed) continue;
      if (dist2D(p.pos, d.pos) < pc.pickupRange && Math.abs(p.pos.y - d.pos.y) < 1.6) { taker = p; break; }
    }
    if (taker) {
      P.drops.splice(i, 1);
      sim.emit('powerupGone', { id: d.id, taken: true });
      apply(sim, d.type, taker);
    } else if (d.t <= 0) {
      P.drops.splice(i, 1);
      sim.emit('powerupGone', { id: d.id, taken: false });
    }
  }
}

export function resetRoundDrops(sim) { sim.powerups.thisRound = 0; }
