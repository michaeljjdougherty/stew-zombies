// =============================================================================
// GobbleGum (as in Black Ops 3). Everyone brings a pack of 5 gums into the game
// (their career's: src/career/career.js). A GobbleGum machine hands you one of
// your 5 at random; you hold one gum at a time, and it goes off one of four ways
// (CONFIG.gobblegum, at the top). Classics never run out; a Mega's used up as
// it comes out of the machine (the player's browser takes it off their career:
// the 'gumDispensed' event).
//
// This file: the machines, chewing, [H] to use an activated gum, the gum's
// timers, and every gum's effect. Most effects are read where they happen
// through gumOn(p, id) (weapons.js, player.js, zombies.js, laststand.js...);
// the ones that happen when you use them, or on a game event, are here.
// The host runs it all; a friend's copy online only reads p.gum (mirrored) for
// the effects on their own gun and movement (src/net/state.js).
//
// Also here: alternate ammo (a Mad Dog'd gun's "bite", CONFIG.aat): what Lucky
// Crit and Bullet Boost work on.
// =============================================================================
import { spawnPowerup } from './powerups.js';
import { killZombie, damageZombie, removeZombie } from './zombies.js';
import { givePerk, hasPerk } from './perks.js';
import { revive } from './laststand.js';
import { explode } from './projectiles.js';
import { ignite } from './flame.js';
import { giveWeapon, makeSlot } from './weapons.js';
import { respawnLoadout } from './rounds.js';
import { DEG } from '../core/math.js';
import { RNG } from '../core/rng.js';

const GC = (sim) => sim.cfg.gobblegum;
// (its own dice: buying a gum doesn't change what the rest of the game rolls)
const R = (sim) => (sim.gums && sim.gums.rng) || sim.rng;
const gumDef = (sim, id) => GC(sim).gums[id];
export const isMega = (sim, id) => { const d = gumDef(sim, id); return !!d && d.tier !== 'classic' && d.tier !== 'whimsical'; };
const up = (p) => p && p.alive && !p.downed;
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// --- the player's side --------------------------------------------------------
// Their pack (5 gums) and how many of each Mega they brought.
export function setPlayerGums(sim, p, gums = null) {
  const G = GC(sim);
  const pack = (gums && Array.isArray(gums.pack) ? gums.pack : G.defaultPack).filter((id) => G.gums[id]).slice(0, G.packSize);
  p.gumPack = [...new Set(pack)];
  p.gumStock = {};
  for (const id of p.gumPack) if (isMega(sim, id)) p.gumStock[id] = Math.max(0, Math.floor(Number(gums && gums.stock && gums.stock[id]) || 0));
  p.gum = null;          // the one you're holding: { id, kind, uses, left, rounds, onUntil, on }
  p.gumBuys = 0;         // from a machine this round
  p.perkBonus = p.perkBonus || 0;   // (Unquenchable)
}

// Is this gum of yours on right now (doing its thing)?
export function gumOn(p, id) {
  const g = p && p.gum;
  return !!g && g.id === id && !!g.on;
}

// Anyone's (Fear in Headlights, Temporal Gift...)
export const anyGumOn = (sim, id) => sim.players.some((p) => gumOn(p, id));

// Chew a gum: it replaces whatever you had.
export function chewGum(sim, p, id, { free = false } = {}) {
  const d = gumDef(sim, id);
  if (!d) return;
  if (p.gum) endGum(sim, p, 'replaced');
  const g = { id, kind: d.kind, tier: d.tier, uses: d.uses || 0, left: d.time || 0, rounds: d.rounds || 0, onUntil: 0, on: d.kind === 'timed' || d.kind === 'rounds' || d.kind === 'special' };
  p.gum = g;
  sim.emit('gumChewed', { playerId: p.id, gum: id, kind: d.kind, free });
  if (id === 'disorderlyCombat') startDisorder(sim, p);
}

// The gum's done (or swapped out): anything it was holding on to comes back.
export function endGum(sim, p, why = 'done') {
  const g = p.gum;
  if (!g) return;
  if (g.id === 'disorderlyCombat') endDisorder(sim, p);
  p.gum = null;
  sim.emit('gumEnded', { playerId: p.id, gum: g.id, why });
}

// [H]: use the activated gum you're holding. On a friend's copy online, the
// host does it (src/net/host.js 'gum').
export function gumPressed(sim, p) {
  if (sim.replica) { sim.netOut.push({ k: 'gum' }); return; }
  useGum(sim, p);
}

export function useGum(sim, p) {
  const g = p.gum;
  if (!g || g.kind !== 'activated' || g.uses <= 0 || !p.alive || (p.downed && g.id !== 'phoenixUp')) { sim.emit('gumDenied', { playerId: p.id }); return false; }
  const d = gumDef(sim, g.id);
  if (!ACT[g.id] || ACT[g.id](sim, p, d) === false) { sim.emit('gumDenied', { playerId: p.id, gum: g.id }); return false; }
  g.uses--;
  if (d.window) { g.onUntil = sim.time + d.window; g.on = true; }
  sim.emit('gumUsed', { playerId: p.id, gum: g.id, left: g.uses });
  if (g.uses <= 0 && !d.window) endGum(sim, p, 'used');
  gumAfterUse(sim);
  return true;
}

// A special gum went off: one use gone.
function spend(sim, p, id) {
  const g = p.gum;
  if (!g || g.id !== id) return;
  g.uses--;
  sim.emit('gumUsed', { playerId: p.id, gum: id, left: g.uses });
  if (g.uses <= 0) endGum(sim, p, 'used');
}

// --- the machines ----------------------------------------------------------------
// One beside each perk machine (on the side with room), up to machine.perMap.
export function createGums(sim) {
  const G = GC(sim);
  const W = sim.world;
  const machines = [], rng = new RNG(((sim.seed >>> 0) * 7919 + 4242) >>> 0);
  const free = (b) => !W.solids.some((s) => s.minX < b.maxX && s.maxX > b.minX && s.minZ < b.maxZ && s.maxZ > b.minZ && s.minY < b.maxY && s.maxY > b.minY);
  for (const m of W.perkMachines) {
    if (machines.length >= (G.machine.perMap ?? 6)) break;
    const n = m.normal, along = { x: -n.z, z: n.x };
    for (const side of [1, -1]) {
      const c = { x: m.center.x + along.x * G.machine.offset * side, y: m.center.y || 0, z: m.center.z + along.z * G.machine.offset * side };
      const h = G.machine.half;
      const b = { minX: c.x - h, maxX: c.x + h, minZ: c.z - h, maxZ: c.z + h, minY: c.y + 0.1, maxY: c.y + 1.8, kind: 'gumMachine' };
      if (!free(b)) continue;
      // (and somewhere to stand in front of it)
      const st = { x: c.x + n.x * (h + 0.6), z: c.z + n.z * (h + 0.6) };
      const sb = { minX: st.x - 0.3, maxX: st.x + 0.3, minZ: st.z - 0.3, maxZ: st.z + 0.3, minY: c.y + 0.2, maxY: c.y + 1.6 };
      if (!free(sb)) continue;
      W.solids.push(b);
      machines.push({ id: 'gum_' + machines.length, pos: c, normal: { ...n }, stand: st, zone: m.zone, state: 'idle', timer: 0, buyerId: null, gum: null, uses: 0, usesLeft: rng.int(G.machine.uses[0], G.machine.uses[1]) });
      break;
    }
  }
  return { machines, rng, idleUntil: 0, lure: null, killing: null, fearT: 0, impatient: {} };
}

// The gums a player can get out of a machine (Megas they've run out of aren't in it)
export function gumsAvailable(sim, p) {
  return (p.gumPack || []).filter((id) => !isMega(sim, id) || (p.gumStock[id] || 0) > 0);
}
export const gumCost = (sim, p) => GC(sim).costs[Math.min(p.gumBuys || 0, GC(sim).costs.length - 1)];

export class GumMachineInteractable {
  constructor(m) {
    this.m = m;
    this.id = 'use_' + m.id;
    this.kind = 'gum';
    this.requireLook = true;
    this.pos = { x: m.pos.x, y: m.pos.y + 1.2, z: m.pos.z };
  }
  get range() { return this.reach ?? 1.7; }
  distanceTo(sim, p) { this.reach = GC(sim).machine.range; return flat(p.pos, this.m.stand); }
  canUse(sim, p) { return up(p) && !p.drinking; }
  prompt(sim, p) {
    const m = this.m, G = GC(sim);
    if (m.state === 'away') return { text: 'This GobbleGum machine is out of order', cost: null, sub: 'Another one\'s still going' };
    if (m.state === 'dispensing') return { text: m.buyerId === p.id ? 'GobbleGum coming...' : 'Someone\'s getting a GobbleGum', cost: null };
    if (m.state === 'offering') {
      if (m.buyerId !== p.id) return { text: 'That GobbleGum isn\'t yours', cost: null };
      return { text: `Press [F] to chew ${gumDef(sim, m.gum).name}`, cost: null, sub: gumDef(sim, m.gum).desc };
    }
    if ((p.gumBuys || 0) >= G.perRound) return { text: 'No more GobbleGum this round', cost: null, sub: `${G.perRound} a round` };
    if (!gumsAvailable(sim, p).length) return { text: 'Your GobbleGum pack is empty', cost: null, sub: 'Your Megas have run out: build a new pack' };
    const cost = gumCost(sim, p);
    return { text: cost ? 'Press [F] for a GobbleGum' : 'Press [F] for a free GobbleGum', cost: cost || null, sub: cost ? 'One of the 5 in your pack, at random' : 'Your first one each round is free' };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const m = this.m, G = GC(sim);
    if (m.state === 'offering' && m.buyerId === p.id) { take(sim, m, p); return; }
    if (m.state !== 'idle' || (p.gumBuys || 0) >= G.perRound) { sim.emit('useDenied', { playerId: p.id }); return; }
    const pool = gumsAvailable(sim, p);
    if (!pool.length) { sim.emit('useDenied', { playerId: p.id }); return; }
    const cost = gumCost(sim, p);
    if (cost && !sim.pay(p, cost)) return;
    p.gumBuys = (p.gumBuys || 0) + 1;
    const id = pool[Math.floor(R(sim).next() * pool.length)];
    // (a Mega's gone as it comes out)
    const mega = isMega(sim, id);
    if (mega) p.gumStock[id] = Math.max(0, (p.gumStock[id] || 0) - 1);
    m.state = 'dispensing'; m.timer = G.dispenseTime; m.buyerId = p.id; m.gum = id;
    sim.emit('gumDispensed', { playerId: p.id, gum: id, mega, machine: m.id, tier: gumDef(sim, id).tier });
  }
}

function take(sim, m, p) {
  const id = m.gum;
  m.state = 'idle'; m.buyerId = null; m.gum = null;
  chewGum(sim, p, id);
  sim.emit('gumTaken', { playerId: p.id, gum: id, machine: m.id });
  machineUsed(sim, m);
}

// Each machine only has a few in it, then it's dark for a while.
function machineUsed(sim, m) {
  const G = GC(sim);
  m.uses++;
  if (m.uses >= m.usesLeft && sim.gums.machines.filter((q) => q.state !== 'away').length > 1) {
    m.state = 'away'; m.timer = G.machine.awayTime; m.uses = 0; m.usesLeft = R(sim).int(G.machine.uses[0], G.machine.uses[1]);
    sim.emit('gumMachineAway', { machine: m.id });
  }
}

// --- every tick (the host) -----------------------------------------------------------
export function updateGums(sim, dt) {
  const S = sim.gums;
  if (!S) return;
  for (const m of S.machines) {
    if (m.state === 'idle') continue;
    m.timer -= dt;
    if (m.timer > 0) continue;
    if (m.state === 'dispensing') { m.state = 'offering'; m.timer = GC(sim).offerTime; sim.emit('gumOffered', { playerId: m.buyerId, gum: m.gum, machine: m.id }); }
    else if (m.state === 'offering') { sim.emit('gumExpired', { playerId: m.buyerId, gum: m.gum, machine: m.id }); m.state = 'idle'; m.buyerId = null; m.gum = null; machineUsed(sim, m); }
    else if (m.state === 'away') { m.state = 'idle'; sim.emit('gumMachineBack', { machine: m.id }); }
  }
  for (const p of sim.players) {
    const g = p.gum;
    if (!g) continue;
    if (g.kind === 'timed') {
      g.left -= dt;
      if (g.id === 'disorderlyCombat') tickDisorder(sim, p, dt);
      if (g.left <= 0) endGum(sim, p, 'time');
    } else if (g.kind === 'activated' && g.onUntil) {
      if (sim.time >= g.onUntil) {
        g.onUntil = 0; g.on = false;
        if (g.id === 'ephemeralEnhancement') endEphemeral(sim, p);
        if (g.id === 'killingTime') endKillingTime(sim);
        if (g.uses <= 0) endGum(sim, p, 'used');
      }
    }
  }
  // Ephemeral Enhancement's gun, whoever holds it now
  for (const p of sim.players) for (const s of p.loadout.slots) if (s.ephemeral && sim.time >= s.ephemeral.until) revertEphemeral(sim, p, s);
  // Fear in Headlights: zombies someone's looking at stand still
  if (anyGumOn(sim, 'fearInHeadlights')) {
    const F = GC(sim).gums.fearInHeadlights;
    S.fearT -= dt;
    if (S.fearT <= 0) { S.fearT = F.every; for (const z of sim.zombies) z.gumHeld = z.state === 'chase' && seen(sim, z, F); }
  } else if (S.fearT !== 0) { S.fearT = 0; for (const z of sim.zombies) z.gumHeld = false; }
  // Impatient: back before the round's out
  for (const p of sim.players) {
    const at = S.impatient[p.id];
    if (at == null) continue;
    if (p.alive) { delete S.impatient[p.id]; continue; }
    const R = sim.rounds, I = GC(sim).gums.impatient;
    const left = R.toSpawn + sim.zombies.length;
    if (sim.time >= at || (R.phase === 'active' && left <= I.left)) { delete S.impatient[p.id]; respawnNow(sim, p); }
  }
  // Near Death Experience: being near a downed teammate (either of you chewing it) gets them up
  for (const p of sim.players) {
    if (!p.downed || !p.alive) continue;
    const N = GC(sim).gums.nearDeathExperience;
    const helper = sim.players.find((o) => o !== p && up(o) && flat(o.pos, p.pos) <= N.range && (gumOn(o, 'nearDeathExperience') || gumOn(p, 'nearDeathExperience')));
    if (!helper) { p.downed.nde = 0; continue; }
    p.downed.nde = (p.downed.nde || 0) + dt;
    if (p.downed.nde >= N.time) revive(sim, p, helper.id);
  }
  if (S.lure && sim.time >= S.lure.until) S.lure = null;
}

// someone's in front of this zombie and can see it
function seen(sim, z, F) {
  for (const p of sim.players) {
    if (!up(p)) continue;
    const dx = z.pos.x - p.pos.x, dz = z.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d > F.range || d < 0.5) { if (d < 0.5) return true; continue; }
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    if ((dx * fx + dz * fz) / d < F.dot) continue;
    const eye = sim.eyePosition(p), c = { x: z.pos.x, y: z.pos.y + 1, z: z.pos.z };
    const ex = c.x - eye.x, ey = c.y - eye.y, ez = c.z - eye.z, el = Math.hypot(ex, ey, ez);
    if (!sim.raycastWorld(eye, { x: ex / el, y: ey / el, z: ez / el }, el - 0.3, true)) return true;
  }
  return false;
}

// --- game events (the host: sim.emit) ------------------------------------------------
export function gumOnEvent(sim, e) {
  if (!sim.gums) return;
  switch (e.type) {
    case 'roundStart':
      for (const p of sim.players) p.gumBuys = 0;
      break;
    case 'roundEnd':
      for (const p of sim.players) {
        const g = p.gum;
        if (g && g.kind === 'rounds' && --g.rounds <= 0) endGum(sim, p, 'rounds');
      }
      break;
    case 'zombieKilled': {
      const p = sim.playerById(e.playerId);
      if (p && gumOn(p, 'toneDeath')) { sim.emit('gumToneDeath', { playerId: p.id, pos: e.pos }); spend(sim, p, 'toneDeath'); }
      break;
    }
  }
}

// --- hooks the rest of the game calls -------------------------------------------------
// Bled out (laststand.js, before the downed state's cleared): Arms Grace keeps
// the guns you had; Impatient brings you back early.
export function gumBledOut(sim, p, saved) {
  if (!sim.gums) return;
  if (gumOn(p, 'armsGrace') && saved) { p.armsGrace = { slots: saved.slots }; spend(sim, p, 'armsGrace'); }
  if (gumOn(p, 'impatient')) { sim.gums.impatient[p.id] = sim.time + GC(sim).gums.impatient.after; spend(sim, p, 'impatient'); }
}

// Who the zombies go for: null = nobody (Idle Eyes); `skip(p)` = leave them alone.
export function gumIgnored(sim, p) {
  if (!sim.gums) return false;
  if (sim.time < sim.gums.idleUntil) return true;
  return gumOn(p, 'inPlainSight');
}
export function gumLure(sim) {
  const L = sim.gums && sim.gums.lure;
  if (!L) return null;
  const p = sim.playerById(L.id);
  return up(p) ? p : null;
}
export const gumsIdle = (sim) => !!sim.gums && sim.time < sim.gums.idleUntil;

// A zombie's been hit (the host's damageZombie): Killing Time marks it; Pop Shocks.
export function gumOnHit(sim, z, info, player) {
  if (!sim.gums || !player) return;
  if (sim.gums.killing && sim.time < sim.gums.killing.until) z.gumMarked = player.id;
  if (info.kind === 'knife' && gumOn(player, 'popShocks')) {
    const R = GC(sim).gums.popShocks.radius;
    const pts = [{ x: z.pos.x, y: z.pos.y + 1, z: z.pos.z }];
    for (const o of [...sim.zombies]) {
      if (o === z || o.state === 'dead' || flat(o.pos, z.pos) > R) continue;
      pts.push({ x: o.pos.x, y: o.pos.y + 1, z: o.pos.z });
      damageZombie(sim, o, 1e6, { playerId: player.id, part: 'torso', kind: 'electric', dir: { x: 0, y: 1, z: 0 }, point: { x: o.pos.x, y: o.pos.y + 1, z: o.pos.z } });
    }
    sim.emit('gumShock', { playerId: player.id, points: pts });
    spend(sim, player, 'popShocks');
  }
}

// A kill: the gums that change how it goes (Newtonian Negation, Projectile Vomiting)
export function gumKillInfo(sim, info) {
  const p = info.playerId && sim.playerById(info.playerId);
  if (!p || !p.gum) return info;
  if (gumOn(p, 'newtonianNegation')) return { ...info, fling: { x: 0, z: 0, dist: 0, up: GC(sim).gums.newtonianNegation.rise, float: true } };
  if (info.kind === 'explosive' && gumOn(p, 'projectileVomiting')) {
    const k = GC(sim).gums.projectileVomiting.flingMult, d = info.dir || { x: 0, z: 0 };
    return { ...info, fling: { x: d.x, z: d.z, dist: 5 * k, up: 2.5 * k } };
  }
  return info;
}

// A player killed a zombie while down: Self Medication gets them back up.
export function gumDownedKill(sim, p) {
  if (p && p.downed && gumOn(p, 'selfMedication')) {
    spend(sim, p, 'selfMedication');
    revive(sim, p, p.id, { keepPerks: true });
  }
}

// Slaughter Slide: a dive lands, two blasts go off either side of you.
export function gumSlide(sim, p) {
  if (!gumOn(p, 'slaughterSlide')) return;
  const D = GC(sim).gums.slaughterSlide, sx = Math.cos(p.yaw) * D.side, sz = -Math.sin(p.yaw) * D.side;
  for (const s of [1, -1]) explode(sim, { x: p.pos.x + sx * s, y: p.pos.y + 0.9, z: p.pos.z + sz * s }, D.explosion, p.id);
  spend(sim, p, 'slaughterSlide');
}

// A zombie hit you: Burned Out.
export function gumOnHurt(sim, p) {
  if (!p.alive || !gumOn(p, 'burnedOut')) return;
  const B = GC(sim).gums.burnedOut;
  for (const z of sim.zombies) if (z.state !== 'dead' && flat(z.pos, p.pos) <= B.radius) ignite(sim, z, p.id, { burnKill: 1.5 }, null);
  sim.emit('gumBurst', { playerId: p.id, pos: { ...p.pos }, radius: B.radius });
  spend(sim, p, 'burnedOut');
}

// Points earned: Alchemical Antithesis turns them into ammo; Profit Sharing shares them.
// Returns the points the player should actually get.
export function gumOnPoints(sim, p, amount, reason) {
  if (!sim.gums || amount <= 0 || reason === 'refund') return amount;
  if (gumOn(p, 'alchemicalAntithesis')) {
    const s = p.loadout.slots[p.loadout.current], d = s && sim.cfg.weapons[s.id];
    if (s && d && !d.infinite) {
      const per = GC(sim).gums.alchemicalAntithesis.perAmmo;
      s.reserve = Math.min(d.reserve * 2, s.reserve + Math.max(1, Math.floor(amount / per)));
      sim.emit('gumAmmo', { playerId: p.id, weapon: s.id });
      return 0;
    }
  }
  if (reason !== 'shared') {
    const R = GC(sim).gums.profitSharing.range;
    for (const o of sim.players) {
      if (o === p || !o.alive || flat(o.pos, p.pos) > R) continue;
      if (gumOn(p, 'profitSharing') || gumOn(o, 'profitSharing')) sim.addPoints(o, amount, 'shared');
    }
  }
  return amount;
}

// Buying: free while Shopping Free's on.
export const gumFree = (p) => gumOn(p, 'shoppingFree');

// Perks: Unquenchable and Soda Fountain let you hold more.
export const gumPerkLimit = (sim, p) => sim.cfg.perks.limit + (p.perkBonus || 0) + (gumOn(p, 'sodaFountain') ? 1 : 0);
// You just got a perk: Soda Fountain throws in another.
export function gumOnPerk(sim, p) {
  if (!gumOn(p, 'sodaFountain') || p.gumSoda) return;
  const extra = mapPerks(sim).filter((id) => !hasPerk(p, id));
  if (!extra.length) return;
  p.gumSoda = true;
  givePerk(sim, p, extra[Math.floor(R(sim).next() * extra.length)]);
  p.gumSoda = false;
  spend(sim, p, 'sodaFountain');
}
const mapPerks = (sim) => [...new Set(sim.world.perkMachines.map((m) => m.perk))];

// Mystery Box / wall: Crate Power and Wall Power make the gun Mad Dog'd.
export function gumUpgradeBuy(sim, p, id, from) {
  const gum = from === 'box' ? 'cratePower' : 'wallPower';
  if (!gumOn(p, gum) || !sim.cfg.weapons[id + '+']) return id;
  spend(sim, p, gum);
  return id + '+';
}
// The box landed on the bobblehead for you: Unbearable spins it again (and it stays).
export function gumUnbearable(sim, p) {
  if (!gumOn(p, 'unbearable')) return false;
  spend(sim, p, 'unbearable');
  return true;
}
// Windows: Board Games puts every board back; Board to Death kills the zombies there.
export function gumOnBoard(sim, p, w) {
  if (gumOn(p, 'boardGames')) while (w.boards < w.maxBoards) { w.boards++; sim.emit('boardRepaired', { windowId: w.id, board: w.boards - 1, playerId: p.id, points: 0 }); }
  if (gumOn(p, 'boardToDeath')) {
    const R = GC(sim).gums.boardToDeath.radius;
    const out = { x: w.center.x - w.normal.x * 1.5, z: w.center.z - w.normal.z * 1.5 };
    for (const z of [...sim.zombies]) if (z.state !== 'dead' && (flat(z.pos, out) <= R || flat(z.pos, w.center) <= R)) damageZombie(sim, z, 1e6, { playerId: p.id, part: 'torso', kind: 'gum', dir: { x: w.normal.x * -1, y: 0.5, z: w.normal.z * -1 }, point: { ...z.pos } });
  }
}

// --- activated gums ----------------------------------------------------------------------
const ahead = (p, d = 1.6) => ({ x: p.pos.x - Math.sin(p.yaw) * d, y: p.pos.y, z: p.pos.z - Math.cos(p.yaw) * d });
const POWERUPS = (sim) => Object.keys(sim.cfg.powerups.list).filter((t) => !sim.cfg.powerups.list[t].gumOnly);
function drop(sim, p, type) {
  const d = spawnPowerup(sim, type === 'random' ? POWERUPS(sim)[Math.floor(R(sim).next() * POWERUPS(sim).length)] : type, ahead(p));
  if (sim.cfg.powerups.list[d.type].personal) d.owner = p.id;
  return d;
}
// Somewhere else to be: open ground on the map, away from the zombies.
// (also the Maisy Dog's black hole, dived into: src/sim/gadgets.js)
export function teleport(sim, p, spot) {
  p.pos.x = spot.x; p.pos.y = spot.y || 0; p.pos.z = spot.z;
  p.vel.x = p.vel.y = p.vel.z = 0;
  p.region = sim.nav.regionAt(p.pos);
  p.tp = (p.tp || 0) + 1;
  sim.emit('gumTeleport', { playerId: p.id, pos: { ...p.pos } });
}
export function randomSpot(sim, p) {
  const D = GC(sim).gums.anywhereButHere;
  const W = sim.world, open = (r) => {
    const room = W.roomById.get(r.room);
    return !!room && (sim.mapData.openField || sim.openZones.has(room.zone));
  };
  // everywhere you could walk to from here (through open doors; down ledges too)
  const N = sim.nav, from = p.region || N.regionAt(p.pos), seen = new Set(from ? [from] : []), todo = from ? [from] : [];
  while (todo.length) {
    const c = todo.pop();
    for (const q of N.out.get(c) || []) {
      if (!N.portalOpen(q)) continue;
      const n = q.a === c ? q.b : q.a;
      if (!seen.has(n)) { seen.add(n); todo.push(n); }
    }
  }
  const regs = N.regions.filter((r) => seen.has(r.id) && open(r) && (r.rect[2] - r.rect[0]) * (r.rect[3] - r.rect[1]) >= 4);
  for (let k = 0; k < 40 && regs.length; k++) {
    const r = regs[Math.floor(R(sim).next() * regs.length)];
    const x = r.rect[0] + (r.rect[2] - r.rect[0]) * (0.3 + R(sim).next() * 0.4), z = r.rect[1] + (r.rect[3] - r.rect[1]) * (0.3 + R(sim).next() * 0.4);
    if (Math.hypot(x - p.pos.x, z - p.pos.z) < 8) continue;
    if (sim.zombies.some((q) => q.state !== 'dead' && Math.hypot(q.pos.x - x, q.pos.z - z) < D.minFromZombies)) continue;
    const top = Math.max(r.y0 || 0, r.y1 || 0) + 2.5;
    const h = sim.raycastWorld({ x, y: top, z }, { x: 0, y: -1, z: 0 }, top + 2);
    const y = h ? h.point.y : 0;
    if (Math.abs(y - (r.y0 || 0)) > 1.5 && Math.abs(y - (r.y1 || 0)) > 1.5) continue;
    if (W.solids.some((b) => !b.ghost && x > b.minX - 0.4 && x < b.maxX + 0.4 && z > b.minZ - 0.4 && z < b.maxZ + 0.4 && b.minY < y + 1.7 && b.maxY > y + 0.15)) continue;
    return { x, y, z };
  }
  return null;
}
function inView(sim, p, z, range, dot) {
  const dx = z.pos.x - p.pos.x, dz = z.pos.z - p.pos.z, d = Math.hypot(dx, dz);
  if (d > range) return false;
  if (d > 0.8 && (dx * -Math.sin(p.yaw) + dz * -Math.cos(p.yaw)) / d < dot) return false;
  const eye = sim.eyePosition(p), c = { x: z.pos.x, y: z.pos.y + (z.crawler ? 0.4 : 1.5), z: z.pos.z };
  const ex = c.x - eye.x, ey = c.y - eye.y, ez = c.z - eye.z, el = Math.hypot(ex, ey, ez);
  return !sim.raycastWorld(eye, { x: ex / el, y: ey / el, z: ez / el }, el - 0.3, true);
}

const ACT = {
  alchemicalAntithesis: () => true,
  inPlainSight: () => true,
  nowYouSeeMe: (sim, p, d) => { sim.gums.lure = { id: p.id, until: sim.time + d.window }; },
  idleEyes: (sim, p, d) => { sim.gums.idleUntil = sim.time + d.window; },
  anywhereButHere: (sim, p) => { const s = randomSpot(sim, p); if (!s) return false; teleport(sim, p, s); },
  nowhereButThere: (sim, p) => {
    const o = sim.players.find((q) => q !== p && q.alive && q.downed);
    if (!o) return false;
    teleport(sim, p, { x: o.pos.x + 0.8, y: o.pos.y, z: o.pos.z + 0.4 });
  },
  eyeCandy: (sim, p, d) => {
    const s = p.loadout.slots[p.loadout.current];
    if (!s) return false;
    const pick = d.camos.filter((c) => c !== s.camo);
    s.camo = pick[Math.floor(R(sim).next() * pick.length)];
    sim.emit('weaponGiven', { playerId: p.id, weapon: s.id, camo: true });
  },
  cacheBack: (sim, p, d) => { drop(sim, p, d.drop); },
  deadOfNuclearWinter: (sim, p, d) => { drop(sim, p, d.drop); },
  extraCredit: (sim, p, d) => { drop(sim, p, d.drop); },
  fatalContraption: (sim, p, d) => { drop(sim, p, d.drop); },
  imFeelinLucky: (sim, p, d) => { drop(sim, p, d.drop); },
  immolationLiquidation: (sim, p, d) => { drop(sim, p, d.drop); },
  killJoy: (sim, p, d) => { drop(sim, p, d.drop); },
  licensedContractor: (sim, p, d) => { drop(sim, p, d.drop); },
  whosKeepingScore: (sim, p, d) => { drop(sim, p, d.drop); },
  reignDrops: (sim, p, d) => {
    const types = Object.keys(sim.cfg.powerups.list);
    types.forEach((t, i) => {
      const a = (i / types.length) * Math.PI * 2;
      const pu = spawnPowerup(sim, t, { x: p.pos.x + Math.cos(a) * d.spread, y: p.pos.y, z: p.pos.z + Math.sin(a) * d.spread });
      if (sim.cfg.powerups.list[t].personal) pu.owner = p.id;
    });
  },
  crawlSpace: (sim, p, d) => {
    const c = sim.cfg.zombie;
    for (const z of sim.zombies) {
      if (z.state === 'dead' || z.crawler || z.type === 'cheddar' || flat(z.pos, p.pos) > d.radius) continue;
      z.crawler = true; z.height = 0.7; z.speed = Math.min(z.speed, R(sim).range(c.crawlSpeed[0], c.crawlSpeed[1]));
      sim.emit('zombieLimb', { id: z.id, limb: 'legs', dir: { x: 0, y: 1, z: 0 } });
    }
  },
  mindBlown: (sim, p, d) => {
    for (const z of [...sim.zombies]) if (z.state === 'chase' && inView(sim, p, z, d.range, 0.5)) damageZombie(sim, z, 1e6, { playerId: p.id, part: 'head', kind: 'gum', dir: { x: 0, y: 1, z: 0 }, point: { x: z.pos.x, y: z.pos.y + 1.7, z: z.pos.z } });
  },
  killingTime: (sim, p, d) => {
    sim.gums.killing = { until: sim.time + d.window, by: p.id };
    for (const z of sim.zombies) z.gumMarked = null;
  },
  phoenixUp: (sim, p) => {
    const down = sim.players.filter((o) => o !== p && o.alive && o.downed);
    if (!down.length) return false;
    for (const o of down) revive(sim, o, p.id, { keepPerks: true });
  },
  onTheHouse: (sim, p) => {
    const left = mapPerks(sim).filter((id) => !hasPerk(p, id));
    if (!left.length) return false;
    givePerk(sim, p, left[Math.floor(R(sim).next() * left.length)]);
  },
  perkaholic: (sim, p) => {
    const left = mapPerks(sim).filter((id) => !hasPerk(p, id));
    if (!left.length) return false;
    for (const id of left) givePerk(sim, p, id);
  },
  unquenchable: (sim, p) => { p.perkBonus = (p.perkBonus || 0) + 1; },
  roundRobbin: (sim, p, d) => {
    const R = sim.rounds;
    if (R.phase !== 'active') return false;
    for (const z of [...sim.zombies]) removeZombie(sim, z);
    R.toSpawn = 0;
    for (const o of sim.players) if (o.alive) sim.addPoints(o, d.points, 'powerup');
  },
  respinCycle: (sim, p) => {
    const box = [sim.box, ...(sim.saleBoxes || [])].find((b) => b.phase === 'offering' && b.buyerId === p.id);
    if (!box) return false;
    box.phase = 'spinning'; box.timer = sim.cfg.box.spinTime;
    box.weapon = box.pick(sim, p);
    box.emit(sim, 'boxOpen', { playerId: p.id, spot: box.spot.id, weapon: box.weapon, spinTime: box.timer, respin: true });
  },
  ephemeralEnhancement: (sim, p, d) => {
    const s = p.loadout.slots[p.loadout.current];
    const def = s && sim.cfg.weapons[s.id];
    if (!s || s.away || !def || def.upgraded || def.hammer || !sim.cfg.weapons[s.id + '+']) return false;   // (not a War Hammer: only Pit tempers those)
    const up2 = sim.cfg.weapons[s.id + '+'];
    s.ephemeral = { until: sim.time + d.window, id: s.id, clip: s.clip, clipL: s.clipL, reserve: s.reserve };
    s.id = s.id + '+'; s.upgraded = true; s.clip = up2.magSize; s.clipL = up2.dual ? up2.magSize : 0; s.reserve = up2.reserve;
    s.aat = rollAat(sim, null);
    sim.emit('weaponGiven', { playerId: p.id, weapon: s.id, ephemeral: true });
  },
  bulletBoost: (sim, p) => {
    const s = p.loadout.slots[p.loadout.current];
    if (!s || !sim.cfg.weapons[s.id] || !sim.cfg.weapons[s.id].upgraded || sim.cfg.weapons[s.id].hammer) return false;
    s.aat = rollAat(sim, s.aat);
    sim.emit('aatChanged', { playerId: p.id, weapon: s.id, aat: s.aat });
  },
  flavorHexed: (sim, p) => {
    const G = GC(sim);
    const pool = Object.keys(G.gums).filter((id) => isMega(sim, id) && id !== 'flavorHexed' && !p.gumPack.includes(id));
    if (!pool.length) return false;
    const id = pool[Math.floor(R(sim).next() * pool.length)];
    // (this gum's gone, the new one's in your mouth: chewGum after the use is counted)
    sim.gums.hexed = { p, id };
  },
};

// Flavor Hexed's new gum goes in after the old one's use is counted (useGum).
export function gumAfterUse(sim) {
  const H = sim.gums && sim.gums.hexed;
  if (!H) return;
  sim.gums.hexed = null;
  chewGum(sim, H.p, H.id, { free: true });
}

// --- Ephemeral Enhancement: the gun goes back -------------------------------------------
function revertEphemeral(sim, p, s) {
  const E = s.ephemeral;
  s.ephemeral = null;
  s.id = E.id; s.upgraded = false; s.aat = null;
  const d = sim.cfg.weapons[E.id];
  s.clip = Math.min(d.magSize, E.clip); s.clipL = E.clipL || 0; s.reserve = E.reserve;
  sim.emit('weaponGiven', { playerId: p.id, weapon: s.id, ephemeralEnd: true });
}
function endEphemeral(sim, p) { for (const s of p.loadout.slots) if (s.ephemeral) revertEphemeral(sim, p, s); }

// --- Killing Time: over; the ones that were shot go up ---------------------------------
function endKillingTime(sim) {
  const K = sim.gums.killing;
  sim.gums.killing = null;
  if (!K) return;
  for (const z of [...sim.zombies]) {
    if (z.state === 'dead' || !z.gumMarked) continue;
    const pos = { x: z.pos.x, y: z.pos.y + 1, z: z.pos.z };
    sim.emit('explosion', { pos, radius: 1.5, etype: 'gumPop', shake: 0.2, playerId: z.gumMarked });
    damageZombie(sim, z, 1e6, { playerId: z.gumMarked, part: 'torso', kind: 'explosive', dir: { x: 0, y: 1, z: 0 }, point: pos, force: 1 });
  }
}
export const killingTimeOn = (sim) => !!(sim.gums && sim.gums.killing && sim.time < sim.gums.killing.until);

// --- Disorderly Combat: a random gun every few seconds, yours back after -------------------
function boxGuns(sim) { return Object.keys(sim.cfg.box.weights).filter((id) => sim.cfg.weapons[id] && !sim.cfg.weapons[id].hammer); }
function startDisorder(sim, p) {
  const w = p.loadout;
  p.gumDisorder = { slot: w.current, saved: w.slots[w.current], t: 0 };
  swapDisorder(sim, p);
}
function swapDisorder(sim, p) {
  const D = p.gumDisorder, w = p.loadout;
  if (!D || !w.slots[D.slot]) return;
  const cur = w.slots[D.slot].id, pool = boxGuns(sim).filter((id) => id !== cur && !w.slots.some((s) => s.id === id));
  const id = pool[Math.floor(R(sim).next() * pool.length)];
  const s = makeSlot(sim, id);
  s.disorder = true;
  w.slots[D.slot] = s;
  w.current = D.slot; w.drawTimer = sim.cfg.weapons[id].drawTime; w.reloading = false; w.reload = null;
  sim.emit('weaponGiven', { playerId: p.id, weapon: id, disorder: true });
}
function tickDisorder(sim, p, dt) {
  const D = p.gumDisorder;
  if (!D || p.downed) return;
  D.t += dt;
  if (D.t >= GC(sim).gums.disorderlyCombat.every) { D.t = 0; swapDisorder(sim, p); }
}
function endDisorder(sim, p) {
  const D = p.gumDisorder, w = p.loadout;
  p.gumDisorder = null;
  if (!D) return;
  const list = p.downed && p.downed.saved ? p.downed.saved.slots : w.slots;
  const i = list.findIndex((s) => s.disorder);
  if (i >= 0) list[i] = D.saved;
  if (!p.downed) { w.drawTimer = sim.cfg.weapons[w.slots[w.current].id].drawTime; sim.emit('weaponGiven', { playerId: p.id, weapon: w.slots[w.current].id }); }
}

// --- back already (Impatient) ------------------------------------------------------------
function respawnNow(sim, p) {
  const buddy = sim.players.find((o) => up(o));
  if (!buddy) return;
  p.alive = true; p.downed = null; p.health = p.maxHealth;
  p.pos.x = buddy.pos.x + 0.9; p.pos.y = buddy.pos.y; p.pos.z = buddy.pos.z + 0.6;
  p.vel.x = p.vel.y = p.vel.z = 0;
  p.region = sim.nav.regionAt(p.pos);
  respawnLoadout(sim, p);
  p.tp = (p.tp || 0) + 1;
  sim.emit('playerRespawn', { playerId: p.id, impatient: true });
}

// --- alternate ammo (a Mad Dog'd gun's bite) ---------------------------------------------
export function rollAat(sim, not = null) {
  const ids = Object.keys(sim.cfg.aat.types).filter((t) => t !== not);
  return ids[Math.floor(R(sim).next() * ids.length)];
}
// A hit with a Mad Dog'd gun (the host): maybe its bite goes off.
export function aatOnHit(sim, z, info, p) {
  if (!p || !info.weapon || z.state === 'dead' || (info.kind !== 'bullet' && info.kind !== 'knife')) return;
  const s = p.loadout.slots.find((q) => q.id === info.weapon);
  if (!s || !s.aat || !sim.cfg.aat.types[s.aat]) return;
  const A = sim.cfg.aat;
  p.aatReady = p.aatReady || {};
  if (sim.time < (p.aatReady[s.aat] || 0)) return;
  const chance = A.chance * (gumOn(p, 'luckyCrit') ? GC(sim).gums.luckyCrit.aatMult : 1);
  if (R(sim).next() >= chance) return;
  p.aatReady[s.aat] = sim.time + A.cooldown;
  AAT[s.aat](sim, z, p, A.types[s.aat], info);
}
const AAT = {
  // fire round where it hit: every zombie near it catches
  blastFurnace: (sim, z, p, T) => {
    const at = { x: z.pos.x, y: z.pos.y + 1, z: z.pos.z };
    for (const o of sim.zombies) if (o.state !== 'dead' && flat(o.pos, z.pos) <= T.radius) ignite(sim, o, p.id, { burnKill: T.burnKill }, null);
    sim.emit('aatProc', { aat: 'blastFurnace', playerId: p.id, pos: at, radius: T.radius });
  },
  // lightning from it to the ones near it
  deadWire: (sim, z, p, T) => {
    const pts = [{ x: z.pos.x, y: z.pos.y + 1.2, z: z.pos.z }], hit = new Set([z.id]);
    let from = z;
    for (let i = 0; i < T.chains; i++) {
      let best = null, bd = T.hop;
      for (const o of sim.zombies) { if (o.state === 'dead' || hit.has(o.id)) continue; const d = flat(o.pos, from.pos); if (d < bd) { bd = d; best = o; } }
      if (!best) break;
      hit.add(best.id); pts.push({ x: best.pos.x, y: best.pos.y + 1.2, z: best.pos.z }); from = best;
    }
    sim.emit('aatProc', { aat: 'deadWire', playerId: p.id, pos: pts[0], points: pts });
    for (const id of hit) { const o = sim.zombieById(id); if (o) damageZombie(sim, o, 1e6, { playerId: p.id, part: 'torso', kind: 'electric', dir: { x: 0, y: 1, z: 0 }, point: { x: o.pos.x, y: o.pos.y + 1, z: o.pos.z } }); }
  },
  // a wall of air: everything in front of you thrown back and dead
  thunderWall: (sim, z, p, T) => {
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), cosA = Math.cos(T.angle * DEG);
    sim.emit('aatProc', { aat: 'thunderWall', playerId: p.id, pos: { x: p.pos.x, y: p.pos.y + 1.2, z: p.pos.z }, dir: { x: fx, z: fz }, range: T.range });
    for (const o of [...sim.zombies]) {
      if (o.state === 'dead') continue;
      const dx = o.pos.x - p.pos.x, dz = o.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > T.range || (d > 0.5 && (dx * fx + dz * fz) / d < cosA)) continue;
      damageZombie(sim, o, 1e6, { playerId: p.id, part: 'torso', kind: 'wind', dir: { x: fx, y: 0.4, z: fz }, point: { x: o.pos.x, y: o.pos.y + 1, z: o.pos.z }, fling: { x: fx, z: fz, dist: T.dist, up: T.up } });
    }
  },
};
