// =============================================================================
// Firing range mode: no rounds. Target dummies stand on marked spots and come
// back a moment after they die, ammo can be infinite, and you can call in a
// horde at any round's strength to test guns against moving zombies.
// Logic only; the panel and stats live in src/ui/range.js.
// =============================================================================
import { makeZombie, pickZombieType } from './zombies.js';
import { zombieHealthForRound } from '../config.js';
import { giveWeapon } from './weapons.js';
import { givePerk, applyPerkStats } from './perks.js';

export function setupRange(sim) {
  const rc = sim.cfg.range;
  sim.range = {
    round: rc.startRound,
    infiniteAmmo: true,
    moving: false,
    slots: (sim.mapData.targets || []).map((t) => ({ home: { ...t }, zid: null, timer: 0.5 + Math.random() * 0.4 })),
  };
  sim.godMode = true;
  sim.power = true;
  for (const p of sim.players) p.points = rc.startPoints;
}

function spawnDummy(sim, slot) {
  const R = sim.range;
  const z = makeZombie(sim, {
    type: 'walker',
    pos: { x: slot.home.x, y: 0, z: slot.home.z },
    yaw: Math.PI,
    health: zombieHealthForRound(R.round, sim.cfg.zombie),
    state: 'dummy',
  });
  z.home = slot.home;
  sim.zombies.push(z);
  slot.zid = z.id;
  sim.emit('zombieSpawn', { id: z.id, zombieType: z.type, pos: { ...z.pos }, windowId: null, dummy: true });
}

export function updateRange(sim, dt) {
  const R = sim.range, rc = sim.cfg.range;
  for (const s of R.slots) {
    if (s.zid != null && sim.zombieById(s.zid)) continue;
    if (s.zid != null) { s.zid = null; s.timer = rc.respawnTime; }
    s.timer -= dt;
    if (s.timer <= 0) spawnDummy(sim, s);
  }
  for (const p of sim.players) {
    if (p.points < rc.startPoints / 2) p.points = rc.startPoints;
    if (!R.infiniteAmmo) continue;
    for (const slot of p.loadout.slots) slot.reserve = sim.cfg.weapons[slot.id].reserve;
    if (!p.throwing) p.grenades = Math.max(p.grenades, p.grenadeMax);
  }
}

// A pack of chasing zombies from the far end, as strong as the chosen round.
export function spawnHorde(sim, count = sim.cfg.range.hordeSize) {
  const R = sim.range;
  const spots = sim.mapData.hordeSpawns || [];
  if (!spots.length) return;
  for (let i = 0; i < count; i++) {
    const sp = spots[i % spots.length];
    const z = makeZombie(sim, {
      type: pickZombieType(sim, R.round),
      pos: { x: sp.x + sim.rng.range(-1.2, 1.2), y: 0, z: sp.z + sim.rng.range(-1.5, 1.5) },
      yaw: 0,
      health: zombieHealthForRound(R.round, sim.cfg.zombie),
      state: 'chase',
    });
    sim.zombies.push(z);
    sim.emit('zombieSpawn', { id: z.id, zombieType: z.type, pos: { ...z.pos }, windowId: null });
  }
  sim.emit('rangeHorde', { count, round: R.round });
}

// Remove every zombie (dummies come back on their own).
export function clearZombies(sim) {
  for (const z of sim.zombies) {
    if (z.state === 'dead') continue;
    z.state = 'dead';
    sim.emit('zombieRemoved', { id: z.id });
  }
}

export function setRangeRound(sim, n) {
  sim.range.round = Math.max(1, Math.min(sim.cfg.range.maxRound, Math.round(n)));
  // dummies pick up the new health right away
  const hp = zombieHealthForRound(sim.range.round, sim.cfg.zombie);
  for (const z of sim.zombies) if (z.state === 'dummy') { z.health = hp; z.maxHealth = hp; }
}

export function rangeGive(sim, p, id) {
  if (!sim.cfg.weapons[id] || !p.alive) return;
  giveWeapon(sim, p, id);
}

// Toggle a perk on or off instantly (no drinking in the range).
export function rangeTogglePerk(sim, p, id) {
  if (!sim.cfg.perks.list[id]) return;
  const i = p.perks.indexOf(id);
  if (i >= 0) { p.perks.splice(i, 1); applyPerkStats(sim, p); sim.emit('perksLost', { playerId: p.id, perks: [id] }); }
  else givePerk(sim, p, id);
}
