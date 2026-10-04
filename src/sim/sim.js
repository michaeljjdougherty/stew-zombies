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
import { buildMap, openDoorCollision } from '../map/build.js';
import { createPlayer, updatePlayer, updateRemotePlayer, emptyCommand, damagePlayer } from './player.js';
import { cancelReload } from './weapons.js';
import { updateZombies, zombieHitboxes } from './zombies.js';
import { createRoundState, updateRounds } from './rounds.js';
import { createWindows, WindowInteractable } from './interactables/windows.js';
import { DoorInteractable, WallBuyInteractable, BoxInteractable, SaleBox } from './interactables/buyables.js';
import { Nav } from './nav.js';
import { updateProjectiles } from './projectiles.js';
import { setupRange, updateRange } from './range.js';
import { PowerInteractable, PerkInteractable, MadDogInteractable, TrapInteractable, ReviveInteractable, createTraps, updateTraps } from './interactables/machines.js';
import { updateLastStand, anyoneStanding } from './laststand.js';
import { createPowerupState, updatePowerups, notePointsEarned, powerupActive } from './powerups.js';
import { createPA, updatePA } from './pa.js';
import { IntercomInteractable, NoteInteractable, StewItemInteractable, createStewEgg, updateStewEgg } from './interactables/lore.js';
import { createQuest, questInteractables, questOnEvent, updateQuest, questTargets } from './quest.js';
import { createCauldron, cauldronTargets } from './cauldron.js';
import { createCrew } from './crew.js';

export class GameSim {
  constructor({ map, cfg = CONFIG, seed = (Date.now() & 0xffffffff) >>> 0, teamName = 'Stew', mode = 'zombies' } = {}) {
    this.cfg = cfg;
    this.mode = mode;          // 'zombies' | 'range' | 'explore'
    this.godMode = false;
    this.replica = false;      // online client: this copy only moves you and mirrors the host
    this.netOut = [];          // online client: hits, throws and blasts to send to the host
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
    this.projectiles = [];
    this.inputs = new Map();
    this.events = [];
    this.gameOver = false;
    this.windows = createWindows(this);
    this.doorState = new Map(this.world.doors.map((d) => [d.id, { open: false, openedAt: 0 }]));
    this.openZones = new Set([this.world.roomById.get('court') ? 'court' : map.rooms[0].zone]);
    this.power = !!cfg.power.startsOn;
    this.perkBuys = {};      // perk id -> times bought (solo Second Helping runs out)
    this.box = new BoxInteractable(this);
    this.saleBoxes = this.world.boxSpots.length > 1 ? this.world.boxSpots.map((s) => new SaleBox(this, s)) : [];
    this.traps = createTraps(this);
    this.madDog = this.world.madDog ? new MadDogInteractable(this, this.world.madDog) : null;
    this.quest = createQuest(this);
    this.cauldron = createCauldron(this);   // "The Final Whistle" (school only)
    this.interactables = [
      ...this.windows.filter((w) => w.kind !== 'fence').map((w) => new WindowInteractable(w)),
      ...this.world.doors.map((d) => new DoorInteractable(d)),
      ...this.world.wallBuys.map((wb) => new WallBuyInteractable(wb)),
      this.box,
      ...this.saleBoxes,
      ...(this.world.powerSwitch ? [new PowerInteractable(this.world.powerSwitch)] : []),
      ...this.world.perkMachines.map((m) => new PerkInteractable(m)),
      ...(this.madDog ? [this.madDog] : []),
      ...this.traps.map((t) => new TrapInteractable(t)),
      new ReviveInteractable(),
      ...(map.intercom ? [new IntercomInteractable(map.intercom)] : []),
      ...(map.notes || []).map((n) => new NoteInteractable(n)),
      ...(map.stewItems || []).map((s) => new StewItemInteractable(s)),
      ...questInteractables(this),
    ];
    this.pa = createPA(this);
    this.crew = map.quest ? createCrew() : null;   // the crew's walkie-talkies (the school)
    this.stewEgg = createStewEgg();
    this.nav = new Nav(this);
    this.rounds = createRoundState(this);
    this.powerups = createPowerupState(this);
    if (mode === 'range') setupRange(this);
    // Explore: the school with endless points; you can't die and the zombies
    // only come when you switch them on.
    if (mode === 'explore') { this.godMode = true; this.explore = { zombies: false }; }
  }

  // --- players --------------------------------------------------------------
  addPlayer(id, name, { character = 'kearns' } = {}) {
    const spawn = this.mapData.playerSpawns[this.players.length % this.mapData.playerSpawns.length];
    const p = createPlayer(this, id, name, spawn);
    p.character = character;   // who they're playing: what they say, what Erik calls them
    if (this.mode === 'explore') p.points = this.cfg.explore.points;
    p.region = this.nav.regionAt(p.pos);
    this.players.push(p);
    this.inputs.set(id, emptyCommand());
    if (this.mode === 'range') p.points = this.cfg.range.startPoints;
    this.emit('playerJoin', { playerId: id, name });
    return p;
  }

  // Explore mode: switch the zombies on (rounds carry on) or off (all gone).
  setExploreZombies(on) {
    if (this.mode !== 'explore') return;
    this.explore.zombies = !!on;
    if (!on) {
      for (const z of this.zombies) if (z.state !== 'dead') { z.state = 'dead'; this.emit('zombieRemoved', { id: z.id }); }
      const R = this.rounds;
      if (R.phase === 'active') { R.phase = 'intermission'; R.timer = this.cfg.rounds.intermission ?? 10; R.toSpawn = 0; }
    }
    this.emit('exploreZombies', { on: !!on });
  }

  setInput(playerId, cmd) { this.inputs.set(playerId, cmd); }
  playerById(id) { return this.players.find((p) => p.id === id) || null; }

  eyePosition(p) {
    const c = this.cfg.player;
    const h = p.downed ? this.cfg.lastStand.eyeHeight : p.crouching ? c.crouchEyeHeight : c.eyeHeight;
    return v3(p.pos.x, p.pos.y + h, p.pos.z);
  }

  weaponDef(loadout) { return this.cfg.weapons[loadout.slots[loadout.current].id]; }
  cancelReload(p) { cancelReload(this, p); }
  // Cheddars won't shut up about 2K. Every few seconds the closest one says it.
  cheddarChatter(dt) {
    const c = this.cfg.cheddar;
    if (this.cheddarTalkT == null) this.cheddarTalkT = 1.2;
    this.cheddarTalkT -= dt;
    if (this.cheddarTalkT > 0) return;
    let best = null, bd = c.talkRange;
    for (const z of this.zombies) {
      if (z.type !== 'cheddar' || z.state === 'dead' || z.state === 'spawning') continue;
      for (const p of this.players) {
        if (!p.alive) continue;
        const d = Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z);
        if (d < bd) { bd = d; best = z; }
      }
    }
    if (!best) { this.cheddarTalkT = 0.5; return; }
    this.cheddarTalkT = this.rng.range(c.talkEvery[0], c.talkEvery[1]);
    this.emit('cheddarTalk', { id: best.id, text: c.line, dur: 1.3, pos: { x: best.pos.x, y: 0.8, z: best.pos.z } });
  }

  boxById(id) { return !id || id === this.box.id ? this.box : this.saleBoxes.find((b) => b.id === id) || this.box; }
  damagePlayer(p, amount, source) { damagePlayer(this, p, amount, source); }

  addPoints(p, amount, reason) {
    if (!amount) return;
    if (amount > 0 && reason !== 'powerup' && powerupActive(this, 'doubleDough')) amount *= 2;
    notePointsEarned(this, amount);
    p.points += amount;
    this.emit('points', { playerId: p.id, amount, reason, total: p.points });
  }

  spendPoints(p, amount) {
    if (this.mode !== 'explore') p.points -= amount;
    this.emit('points', { playerId: p.id, amount: -amount, reason: 'spend', total: p.points });
  }

  turnOnPower(byPlayer = null) {
    if (this.power) return;
    this.power = true;
    this.emit('powerOn', { playerId: byPlayer ? byPlayer.id : null });
  }

  // --- doors & zones -------------------------------------------------------
  doorOpen(id) { const d = this.doorState.get(id); return !!(d && d.open); }

  openDoor(id, byPlayer = null) {
    const st = this.doorState.get(id);
    if (!st || st.open) return;
    st.open = true;
    st.openedAt = this.time;
    const door = this.world.doors.find((d) => d.id === id);
    for (const z of door.zones) this.openZones.add(z);
    openDoorCollision(this.world, id);
    this.nav.invalidate();
    this.emit('doorOpened', { id, kind: door.kind, playerId: byPlayer ? byPlayer.id : null });
  }

  roomAt(pos, regionHint = null) {
    const r = this.nav.regionAt(pos, regionHint);
    return r ? this.world.roomById.get(this.nav.roomOfRegion(r)) : null;
  }

  zoneOf(pos, regionHint = null) {
    const room = this.roomAt(pos, regionHint);
    return room ? room.zone : null;
  }

  // Zones where zombies may spawn: where players are, plus open neighbours.
  activeZones() {
    const act = new Set();
    for (const p of this.players) {
      if (!p.alive) continue;
      const z = this.zoneOf(p.pos, p.region);
      if (z) act.add(z);
    }
    const occupied = new Set(act);
    for (const d of this.world.doors) {
      if (!this.doorOpen(d.id)) continue;
      const [a, b] = d.zones;
      if (occupied.has(a) && this.openZones.has(b)) act.add(b);
      if (occupied.has(b) && this.openZones.has(a)) act.add(a);
    }
    if (!act.size) act.add('court');
    return act;
  }

  // --- world queries -------------------------------------------------------
  zombieById(id) {
    if (id == null) return null;
    for (const z of this.zombies) if (z.id === id && z.state !== 'dead') return z;
    return null;
  }
  windowById(id) { return this.windows.find((w) => w.id === id) || null; }
  spawnWindows() {
    const act = this.activeZones();
    return this.windows.filter((w) => act.has(w.zone));
  }

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
    let wall = this.raycastWorld(o, d, range);
    // quest targets (the soundboard wire) and the cauldron's valves stop a bullet like a wall does
    const targets = [...((this.quest && questTargets(this)) || []), ...cauldronTargets(this)];
    if (targets.length) {
      for (const tg of targets) {
        const t = raySphere(o, d, tg.c, tg.r);
        if (t >= 0 && t < (wall ? wall.t : range)) {
          wall = { t, normal: v3(-d.x, -d.y, -d.z), box: { kind: tg.id.startsWith('valve') ? 'metal' : 'wire' }, point: v3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t), targetId: tg.id };
        }
      }
    }
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
      out.push({ kind: 'world', t: wall.t, point: wall.point, normal: wall.normal, surface: wall.box ? wall.box.kind : 'floor', targetId: wall.targetId });
    }
    return out;
  }

  // --- events ---------------------------------------------------------------
  emit(type, data = {}) {
    const e = { type, t: this.time, ...data };
    this.events.push(e);
    if (this.replica) return;   // an online client's copy: Erik and the quest live on the host
    if (this.pa && this.pa.enabled && type !== 'erikSays') this.pa.inbox.push(e); // Erik listens to everything
    if (this.quest) questOnEvent(this, e);
  }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // --- main step ------------------------------------------------------------
  step(dt) {
    if (this.gameOver) return;
    this.time += dt;
    this.tick++;

    for (const p of this.players) {
      const cmd = this.inputs.get(p.id) || emptyCommand();
      if (p.remote) updateRemotePlayer(this, p, cmd, dt);
      else updatePlayer(this, p, cmd, dt);
      p.region = this.nav.regionAt(p.pos, p.region);
    }
    for (const it of this.interactables) if (it.update) it.update(this, dt);
    for (const p of this.players) if (p.downed) updateLastStand(this, p, dt);
    updateTraps(this, dt);
    updatePowerups(this, dt);
    updateZombies(this, dt);
    this.cheddarChatter(dt);
    updateProjectiles(this, dt);
    if (this.zombies.some((z) => z.state === 'dead')) {
      this.zombies = this.zombies.filter((z) => z.state !== 'dead');
    }
    if (this.mode === 'range') updateRange(this, dt);
    // (no rounds during Erik's showdown or after it: that fight is its own thing)
    else if (this.quest && this.quest.boss) { /* the quest spawns its own */ }
    else if (this.mode !== 'explore' || this.explore.zombies) updateRounds(this, dt);

    if (this.players.length && !anyoneStanding(this)) {
      this.gameOver = true;
      this.emit('gameOver', { round: this.rounds.round, team: this.teamName });
    }
    updateStewEgg(this);
    updateQuest(this, dt);
    updatePA(this, dt);
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
      doors: [...this.doorState].filter(([, s]) => s.open).map(([id]) => id),
      box: { phase: this.box.phase, weapon: this.box.weapon, spot: this.box.spot.id, timer: this.box.timer },
      stewEgg: { found: [...this.stewEgg.found], playing: this.stewEgg.playing },
      quest: this.quest ? { step: this.quest.step, breakers: [...this.quest.breakers], pieces: [...this.quest.pieces], souls: this.quest.statueSouls, coin: this.quest.coin, cladding: this.quest.cladding } : null,
      pa: this.pa.speaking ? { ...this.pa.speaking } : null,
    };
  }
}
