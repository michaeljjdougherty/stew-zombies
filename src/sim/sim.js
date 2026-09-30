// =============================================================================
// GameSim — the authoritative game state and rules.
//
// It knows nothing about three.js, the DOM or Web Audio. The client feeds it
// input commands and reads state + events back. For online co-op the host
// runs this same class, peers send their commands over the network, and the
// host broadcasts snapshots and events (see src/net/README.md).
// =============================================================================
import { CONFIG } from '../config.js';
import { RNG } from '../core/rng.js';
import { rayAABB, rayCapsule, raySphere, v3 } from '../core/math.js';
import { buildMap } from '../map/build.js';
import { createPlayer, updatePlayer, emptyCommand, damagePlayer } from './player.js';
import { cancelReload } from './weapons.js';
import { updateZombies, zombieHitboxes } from './zombies.js';
import { createRoundState, updateRounds } from './rounds.js';
import { createWindows, WindowInteractable } from './interactables/windows.js';
import { Nav } from './nav.js';

export class GameSim {
  constructor({ map, cfg = CONFIG, seed = (Date.now() & 0xffffffff) >>> 0, teamName = 'Stew' } = {}) {
    this.cfg = cfg;
    this.mapData = map;
    this.world = buildMap(map, cfg);
    this.rng = new RNG(seed);
    this.seed = seed;
    this.teamName = teamName;
    this.time = 0;
    this.tick = 0;
    this.nextId = 1;
    this.players = [];
    this.zombies = [];
    this.inputs = new Map();
    this.events = [];
    this.power = false;
    this.gameOver = false;
    this.windows = createWindows(this);
    this.interactables = this.windows.map((w) => new WindowInteractable(w));
    this.nav = new Nav(this.world);
    this.rounds = createRoundState(this);
  }

  // --- players --------------------------------------------------------------
  addPlayer(id, name) {
    const spawn = this.mapData.playerSpawns[this.players.length % this.mapData.playerSpawns.length];
    const p = createPlayer(this, id, name, spawn);
    this.players.push(p);
    this.inputs.set(id, emptyCommand());
    this.emit('playerJoin', { playerId: id, name });
    return p;
  }

  setInput(playerId, cmd) { this.inputs.set(playerId, cmd); }
  playerById(id) { return this.players.find((p) => p.id === id) || null; }

  eyePosition(p) {
    const c = this.cfg.player;
    return v3(p.pos.x, p.pos.y + (p.crouching ? c.crouchEyeHeight : c.eyeHeight), p.pos.z);
  }

  weaponDef(loadout) { return this.cfg.weapons[loadout.slots[loadout.current].id]; }
  cancelReload(p) { cancelReload(this, p); }
  damagePlayer(p, amount, source) { damagePlayer(this, p, amount, source); }

  addPoints(p, amount, reason) {
    if (!amount) return;
    p.points += amount;
    this.emit('points', { playerId: p.id, amount, reason, total: p.points });
  }

  // --- world queries -------------------------------------------------------
  zombieById(id) {
    if (id == null) return null;
    for (const z of this.zombies) if (z.id === id && z.state !== 'dead') return z;
    return null;
  }
  windowById(id) { return this.windows.find((w) => w.id === id) || null; }
  spawnWindows() { return this.windows; }

  // First solid hit along a ray. Returns {t, point, normal, box} or null.
  raycastWorld(o, d, maxT, any = false) {
    let best = null;
    for (const b of this.world.solids) {
      const h = rayAABB(o, d, b, best ? best.t : maxT);
      if (h && h.t <= maxT && (!best || h.t < best.t)) {
        best = { t: h.t, normal: h.normal, box: b };
        if (any) break;
      }
    }
    // floor
    if (d.y < -1e-6) {
      const t = (0 - o.y) / d.y;
      if (t > 0 && t <= maxT && (!best || t < best.t)) best = { t, normal: v3(0, 1, 0), box: null };
    }
    if (best) best.point = v3(o.x + d.x * best.t, o.y + d.y * best.t, o.z + d.z * best.t);
    return best;
  }

  // Bullet trace. Returns ordered impacts: zombies (up to `penetration`), then the wall.
  hitscan(o, d, range, penetration = 1) {
    const wall = this.raycastWorld(o, d, range);
    const maxT = wall ? wall.t : range;
    const zHits = [];
    for (const z of this.zombies) {
      if (z.state === 'dead') continue;
      // cheap reject: distance from ray to zombie center
      const cx = z.pos.x - o.x, cy = z.pos.y + 1 - o.y, cz = z.pos.z - o.z;
      const along = cx * d.x + cy * d.y + cz * d.z;
      if (along < 0 || along > maxT + 2) continue;
      const px = cx - d.x * along, py = cy - d.y * along, pz = cz - d.z * along;
      if (px * px + py * py + pz * pz > 2.2) continue;
      let bestT = Infinity, part = null;
      for (const hb of zombieHitboxes(z)) {
        const t = hb.sphere ? raySphere(o, d, hb.c, hb.r) : rayCapsule(o, d, hb.a, hb.b, hb.r);
        if (t >= 0 && t < bestT) { bestT = t; part = hb.part; }
      }
      if (part && bestT < maxT) {
        zHits.push({ kind: 'zombie', t: bestT, zombieId: z.id, part, point: v3(o.x + d.x * bestT, o.y + d.y * bestT, o.z + d.z * bestT), normal: v3(-d.x, -d.y, -d.z) });
      }
    }
    zHits.sort((a, b) => a.t - b.t);
    const out = zHits.slice(0, penetration);
    out.forEach((h, i) => { h.penetrationMult = Math.pow(0.6, i); });
    if (wall && zHits.length < penetration) {
      out.push({ kind: 'world', t: wall.t, point: wall.point, normal: wall.normal, surface: wall.box ? wall.box.kind : 'floor' });
    }
    return out;
  }

  // --- events ---------------------------------------------------------------
  emit(type, data = {}) { this.events.push({ type, t: this.time, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // --- main step ------------------------------------------------------------
  step(dt) {
    if (this.gameOver) return;
    this.time += dt;
    this.tick++;

    for (const p of this.players) {
      const cmd = this.inputs.get(p.id) || emptyCommand();
      updatePlayer(this, p, cmd, dt);
    }
    updateZombies(this, dt);
    if (this.zombies.some((z) => z.state === 'dead')) {
      this.zombies = this.zombies.filter((z) => z.state !== 'dead');
    }
    updateRounds(this, dt);

    if (this.players.length && this.players.every((p) => !p.alive)) {
      this.gameOver = true;
      this.emit('gameOver', { round: this.rounds.round, team: this.teamName });
    }
  }

  // Plain-object snapshot for networking / debugging.
  snapshot() {
    return {
      tick: this.tick, time: this.time, power: this.power,
      round: { ...this.rounds },
      players: this.players.map((p) => ({
        id: p.id, name: p.name, pos: { ...p.pos }, yaw: p.yaw, pitch: p.pitch,
        health: p.health, points: p.points, alive: p.alive,
        weapon: p.loadout.slots[p.loadout.current],
      })),
      zombies: this.zombies.map((z) => ({ id: z.id, type: z.type, pos: { ...z.pos }, yaw: z.yaw, state: z.state, limbs: { ...z.limbs } })),
      windows: this.windows.map((w) => ({ id: w.id, boards: w.boards })),
    };
  }
}
