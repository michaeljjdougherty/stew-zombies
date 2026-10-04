// =============================================================================
// Online state sync: what the host sends, and how a client's copy takes it in.
//
// The host turns the world into a plain object (worldState), and each send
// carries only what changed since the last one (diff). The channel is
// reliable and in order, so every client can rebuild the same object by
// applying the patches (applyPatch). applyMirror then copies that object
// into the client's own GameSim, which the renderer and HUD read as usual.
// =============================================================================
import { openDoorCollision } from '../map/build.js';

export const DEL = '\u0001';   // "this key is gone" in a patch

// --- plain-data copy: numbers to 3 decimals, Sets to arrays, Infinity kept --
const BIG = 1e9;
export function clean(v, skip = null) {
  if (typeof v === 'number') {
    if (v === Infinity) return BIG;
    if (v === -Infinity) return -BIG;
    if (Number.isNaN(v)) return 0;
    return Math.round(v * 1000) / 1000;
  }
  if (v === null || typeof v !== 'object') return typeof v === 'function' || v === undefined ? undefined : v;
  if (Array.isArray(v)) return v.map((x) => { const c = clean(x); return c === undefined ? null : c; });
  if (v instanceof Set) return [...v].map((x) => clean(x));
  if (v instanceof Map) return Object.fromEntries([...v].map(([k, x]) => [k, clean(x)]));
  const o = {};
  for (const k in v) {
    if (skip && skip.has(k)) continue;
    const c = clean(v[k]);
    if (c !== undefined) o[k] = c;
  }
  return o;
}

const byId = (list, fn) => { const o = {}; for (const x of list) o[x.id] = fn(x); return o; };

// --- what the host sends ----------------------------------------------------
const PLAYER_SKIP = new Set(['useTarget']);
const ZOMBIE_SKIP = new Set(['region', 'stuckT', 'avoidSign', 'sidestep', 'sideSign', 'speed', 'radius', 'stepHeight', 'height', 'targetId']);
const PROJ_SKIP = new Set(['hitIds', 'gravity', 'bounce', 'friction']);
const WINDOW_KEYS = ['boards', 'climbing', 'rebuild', 'queue'];
const QUEST_SKIP = new Set(['standBox', 'need']);

export function playerState(p) {
  const s = clean(p, PLAYER_SKIP);
  s.useNote = p.useTarget && p.useTarget.noteId ? p.useTarget.noteId : null;
  return s;
}

export function worldState(sim) {
  const S = {
    tick: sim.tick,
    time: clean(sim.time),
    power: sim.power,
    gameOver: sim.gameOver,
    perkBuys: clean(sim.perkBuys),
    rounds: clean(sim.rounds),
    doors: {},
    players: byId(sim.players, playerState),
    zombies: byId(sim.zombies.filter((z) => z.state !== 'dead'), (z) => clean(z, ZOMBIE_SKIP)),
    projectiles: byId(sim.projectiles.filter((p) => !p.done), (p) => clean(p, PROJ_SKIP)),
    windows: byId(sim.windows, (w) => { const o = {}; for (const k of WINDOW_KEYS) o[k] = clean(w[k]); return o; }),
    box: (() => { const b = sim.box; return clean({ spot: b.spot.id, phase: b.phase, timer: b.timer, weapon: b.weapon, buyerId: b.buyerId, uses: b.uses, totalUses: b.totalUses, paid: b.paid, moveAt: b.moveAt }); })(),
    cauldron: sim.cauldron ? clean(sim.cauldron) : null,
    jukebox: sim.jukebox ? clean(sim.jukebox) : null,
    saleBoxes: Object.fromEntries((sim.saleBoxes || []).map((b) => [b.id, clean({ phase: b.phase, timer: b.timer, weapon: b.weapon, buyerId: b.buyerId, uses: b.uses, paid: b.paid })])),
    traps: byId(sim.traps, (t) => clean({ state: t.state, timer: t.timer, ownerId: t.ownerId })),
    madDog: sim.madDog ? clean({ state: sim.madDog.state, timer: sim.madDog.timer, ownerId: sim.madDog.ownerId, weapon: sim.madDog.weapon }) : null,
    quest: sim.quest ? clean(sim.quest, QUEST_SKIP) : null,
    powerups: { drops: byId(sim.powerups.drops, (d) => clean(d)), active: clean(sim.powerups.active) },
    stewEgg: clean(sim.stewEgg),
  };
  for (const [id, st] of sim.doorState) if (st.open) S.doors[id] = clean(st.openedAt);
  return S;
}

// --- patches ----------------------------------------------------------------
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function sameArray(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x === y) continue;
    if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null) return false;
    if (JSON.stringify(x) !== JSON.stringify(y)) return false;
  }
  return true;
}

// What turns `a` into `b`, or undefined when they're the same.
export function diff(a, b) {
  if (a === b) return undefined;
  if (isObj(a) && isObj(b)) {
    let out;
    for (const k in b) {
      const d = diff(a[k], b[k]);
      if (d !== undefined) (out || (out = {}))[k] = d;
    }
    for (const k in a) if (!(k in b)) (out || (out = {}))[k] = DEL;
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b) && sameArray(a, b)) return undefined;
  // a whole new value (a plain object only replaces a non-object)
  return isObj(b) && !isObj(a) ? { $new: b } : b;
}

export function applyPatch(target, patch) {
  for (const k in patch) {
    const v = patch[k];
    if (v === DEL) delete target[k];
    else if (isObj(v) && '$new' in v) target[k] = v.$new;
    else if (isObj(v) && isObj(target[k])) applyPatch(target[k], v);
    else target[k] = v;
  }
  return target;
}

// --- deep copy of plain data into an existing object --------------------------
export function deepAssign(target, src, skip = null) {
  for (const k in src) {
    if (skip && skip.has(k)) continue;
    const v = src[k];
    if (isObj(v)) {
      if (!isObj(target[k])) target[k] = {};
      const t = target[k];
      for (const tk in t) if (!(tk in v)) delete t[tk];
      deepAssign(t, v);
    } else if (Array.isArray(v)) target[k] = structuredCopy(v);
    else target[k] = v;
  }
  return target;
}
export function structuredCopy(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(structuredCopy);
  const o = {};
  for (const k in v) o[k] = structuredCopy(v[k]);
  return o;
}
const unbig = (v) => (v >= BIG ? Infinity : v <= -BIG ? -Infinity : v);

// --- the client's copy takes in the host's state ---------------------------
// Fields of your own player that the host decides (everything else, like where
// you are and what's in your magazine, your own browser decides).
const OWNED = ['name', 'character', 'health', 'maxHealth', 'alive', 'downed', 'perks', 'drinking', 'reviving',
  'points', 'kills', 'headshots', 'downs', 'revives', 'knifeKills', 'boosts', 'prompt', 'lastDamageTime', 'invulnUntil', 'grenadeMax', 'boardPointsThisRound', 'rebuilding'];
const INTERP = new Set(['pos', 'yaw', 'pitch']);

export function applyMirror(sim, M, localId) {
  sim.tick = M.tick;
  sim.power = M.power;
  sim.gameOver = M.gameOver;
  sim.perkBuys = structuredCopy(M.perkBuys);
  Object.assign(sim.rounds, M.rounds);

  // doors (and what they block)
  for (const id in M.doors) {
    const st = sim.doorState.get(id);
    if (!st || st.open) continue;
    st.open = true; st.openedAt = M.doors[id];
    const door = sim.world.doors.find((d) => d.id === id);
    for (const z of door.zones) sim.openZones.add(z);
    openDoorCollision(sim.world, id);
    sim.nav.invalidate();
  }

  // players (someone who left is gone from the host's list)
  if (sim.players.some((p) => p.id !== localId && !M.players[p.id])) sim.players = sim.players.filter((p) => p.id === localId || M.players[p.id]);
  for (const id in M.players) {
    const p = sim.playerById(id);
    if (!p) continue;
    const s = M.players[id];
    if (id === localId) {
      for (const k of OWNED) {
        const v = s[k];
        p[k] = v !== null && typeof v === 'object' ? structuredCopy(v) : v;
      }
      p.useTarget = s.useNote ? { noteId: s.useNote } : null;
      // the host handed you something (a gun, ammo, the last-stand pistol)
      if ((s.invRev || 0) > (p.invRev || 0)) {
        p.invRev = s.invRev;
        p.loadout.slots = structuredCopy(s.loadout.slots);
        p.loadout.current = Math.min(s.loadout.current, p.loadout.slots.length - 1);
        p.loadout.drawTimer = s.loadout.drawTimer;
        p.loadout.reloading = s.loadout.reloading;
        p.loadout.reload = structuredCopy(s.loadout.reload);
        p.loadout.adsAmount = Math.min(p.loadout.adsAmount, s.loadout.adsAmount);
        p.grenades = s.grenades; p.stewBombs = s.stewBombs;
      }
      // the host moved you (respawn)
      if ((s.tp || 0) > (p.tp || 0)) {
        p.tp = s.tp;
        Object.assign(p.pos, s.pos); p.vel.x = p.vel.y = p.vel.z = 0;
        sim.netTeleport = { yaw: s.yaw };
      }
    } else {
      deepAssign(p, s, INTERP);
      p.useTarget = null;
    }
  }

  // zombies and projectiles: the list follows the host; positions are filled
  // in by the interpolation (NetClient)
  sim.zombies = syncList(sim.zombies, M.zombies);
  sim.projectiles = syncList(sim.projectiles, M.projectiles, (p) => { p.fuse = unbig(p.fuse); p.stickFuse = unbig(p.stickFuse); p.life = unbig(p.life); });

  for (const w of sim.windows) { const s = M.windows[w.id]; if (s) deepAssign(w, s); }

  const box = sim.box, B = M.box;
  if (B.spot !== box.spot.id) {
    const spot = sim.world.boxSpots.find((s) => s.id === B.spot);
    if (spot) box.moveTo(sim, spot);
  }
  Object.assign(box, { phase: B.phase, timer: B.timer, weapon: B.weapon, buyerId: B.buyerId, uses: B.uses, totalUses: B.totalUses, paid: B.paid, moveAt: B.moveAt });
  if (sim.cauldron && M.cauldron) deepAssign(sim.cauldron, M.cauldron);
  if (sim.jukebox && M.jukebox) Object.assign(sim.jukebox, M.jukebox);
  for (const b of sim.saleBoxes || []) {
    const S = M.saleBoxes && M.saleBoxes[b.id];
    if (!S) continue;
    Object.assign(b, S);
    b.setPresent(sim, S.phase !== 'gone');
  }
  for (const t of sim.traps) { const s = M.traps[t.id]; if (s) Object.assign(t, s); }
  if (sim.madDog && M.madDog) Object.assign(sim.madDog, M.madDog);

  if (sim.quest && M.quest) {
    const q = sim.quest;
    const wasRevealed = q.madDogRevealed;
    deepAssign(q, M.quest);
    if (q.ritual && Array.isArray(q.ritual.stood)) q.ritual.stood = new Set(q.ritual.stood);
    const b = q.standBox;
    b.minX = q.standPos.x - 0.42; b.maxX = q.standPos.x + 0.42; b.minZ = q.standPos.z - 0.42; b.maxZ = q.standPos.z + 0.42;
    if (q.madDogRevealed && !wasRevealed && sim.world.madDog) {
      const md = sim.world.madDog;
      sim.world.solids.push({ minX: md.x - 1.3, minY: 0, minZ: md.z - 1.2, maxX: md.x + 1.3, maxY: 2.6, maxZ: md.z + 1.2, kind: 'madDog' });
    }
  }

  sim.powerups.drops = Object.values(M.powerups.drops).map(structuredCopy);
  sim.powerups.active = structuredCopy(M.powerups.active);
  deepAssign(sim.stewEgg, M.stewEgg);
}

// Bring a list of {id,...} objects in line with the host's map of them,
// keeping the same objects (the renderer holds on to them).
function syncList(list, map, fix) {
  const have = new Map(list.map((x) => [x.id, x]));
  const out = [];
  for (const id in map) {
    const s = map[id];
    let x = have.get(s.id);
    if (!x) { x = structuredCopy(s); x._new = true; }
    else deepAssign(x, s, INTERP);
    if (fix) fix(x);
    out.push(x);
  }
  return out;
}

// Positions to interpolate between, from one host update.
export function positionFrame(M, localId) {
  const f = { tick: M.tick, time: M.time, e: new Map() };
  for (const id in M.zombies) { const z = M.zombies[id]; f.e.set('z' + id, [z.pos.x, z.pos.y, z.pos.z, z.yaw, 0]); }
  for (const id in M.projectiles) { const p = M.projectiles[id]; f.e.set('j' + id, [p.pos.x, p.pos.y, p.pos.z, 0, 0]); }
  for (const id in M.players) { if (id === localId) continue; const p = M.players[id]; f.e.set('p' + id, [p.pos.x, p.pos.y, p.pos.z, p.yaw, p.pitch]); }
  return f;
}

// Signature of what a player carries, to spot the host changing it.
export function inventorySig(p) {
  const w = p.loadout;
  let s = w.current + '|' + p.grenades + '|' + p.stewBombs;
  for (const sl of w.slots) s += '|' + sl.id + ',' + sl.clip + ',' + (sl.clipL || 0) + ',' + sl.reserve + ',' + (sl.upgraded ? 1 : 0) + ',' + (sl.away ? 1 : 0);
  return s;
}
