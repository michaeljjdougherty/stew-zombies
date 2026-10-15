// =============================================================================
// The power on Call of the Crust. Everything electric starts dead.
//
//   The Anvil: each of its four launchers up on the rim has blown its relay.
//   Pull it [F] from the junction box beside the pad (it's burnt, but Pit can
//   fix it), carry it down to Pit's bench and hand it over. Once he has all
//   four he works on them (forge.js runs it, like a hammer), and the Anvil's
//   power comes on: its launchers fly, its perk machine runs, its lights.
//
//   The other islands: a power switch by each one's launcher pad. Flip it [F]
//   and that island's on (its perk machine, its lights).
//
// What runs off the power: perk machines (machines.js asks sim.powerAt), the
// Anvil's launchers (launchers.js), the electric lights (mapView.js). Plain
// data in sim.crustEgg.power, so an online host sends it with the rest.
// Numbers: CONFIG.crust.power. Pit's lines: PIT_POWER in src/lore/crew.js.
// =============================================================================
import { PIT_POWER } from '../lore/crew.js';
import { pitSay } from './forge.js';

const up = (p) => p.alive && !p.downed;
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const W = (sim) => sim.crustEgg && sim.crustEgg.power;

export function createCrustPower(sim) {
  const m = sim.mapData;
  if (!m.relays || !m.relays.length) return null;
  const all = sim.mode === 'explore';   // (exploring: everything's on)
  const on = {};
  for (const I of m.islands) on[I.id] = all;
  const relays = {};
  // blown (in its box, burnt) | carried | given (at Pit's bench) | fixed (back in, working)
  for (const r of m.relays) relays[r.id] = { state: all ? 'fixed' : 'blown', by: null };
  return { on, relays, fixQueued: false };
}

// which island a point is on (null: out over the void)
export function islandAt(sim, pos) {
  for (const I of sim.mapData.islands || []) { const [x0, z0, x1, z1] = I.bounds; if (pos.x >= x0 && pos.x <= x1 && pos.z >= z0 && pos.z <= z1) return I.id; }
  return null;
}
// is the power on where this is? (null: a map without island power)
export function crustPowered(sim, pos) {
  const P = W(sim);
  if (!P) return null;
  const id = islandAt(sim, pos);
  return !!(id && P.on[id]);
}
export const hubPowered = (sim) => { const P = W(sim); return !P || !!P.on.hub; };
export const relayCount = (P, state) => Object.values(P.relays).filter((r) => r.state === state).length;
export const relaysTotal = (P) => Object.keys(P.relays).length;
export const relaysCarriedBy = (P, pid) => Object.entries(P.relays).filter(([, r]) => r.state === 'carried' && r.by === pid).map(([id]) => id);
// has Pit got all of them (and nobody's still out with one)?
export const relaysAllIn = (P) => relayCount(P, 'given') === relaysTotal(P);
const relayName = (sim, n = 1) => sim.cfg.crust.power.relayName.toLowerCase() + (n > 1 ? 's' : '');

// Everything on, right now (explore mode, the films)
export function powerAllOn(sim) {
  const P = W(sim);
  if (!P) return;
  for (const k of Object.keys(P.on)) P.on[k] = true;
  for (const r of Object.values(P.relays)) { r.state = 'fixed'; r.by = null; }
  P.fixQueued = false;
}

// An island's power comes on (from: where the lights spread out from)
export function islandPowerOn(sim, id, from, playerId = null) {
  const P = W(sim);
  if (!P || P.on[id]) return;
  P.on[id] = true;
  const isl = sim.mapData.islands.find((i) => i.id === id);
  const count = Object.values(P.on).filter(Boolean).length;
  sim.emit('islandPower', { island: id, name: isl ? isl.name : id, pos: { x: from.x, y: from.y || 0, z: from.z }, playerId, count, total: Object.keys(P.on).length });
}

// Pit's done with the relays (forge.js, when his work on them is finished)
export function relaysFixed(sim) {
  const P = W(sim);
  if (!P) return;
  for (const r of Object.values(P.relays)) { r.state = 'fixed'; r.by = null; }
  const f = sim.mapData.forge;
  islandPowerOn(sim, 'hub', f ? f.pit : { x: 0, z: 0 });
  PIT_POWER.fixed.forEach((t, i) => pitSay(sim, t, 0.4 + i * 0.1));
}

// Hand Pit the relays you're carrying (his bench, forge.js). true: you had some.
export function giveRelays(sim, p) {
  const P = W(sim), F = sim.crustEgg.forge;
  const mine = P ? relaysCarriedBy(P, p.id) : [];
  if (!mine.length) return false;
  for (const id of mine) { P.relays[id].state = 'given'; P.relays[id].by = null; }
  const n = relayCount(P, 'given'), total = relaysTotal(P);
  sim.emit('relayGiven', { playerId: p.id, count: n, total, n: mine.length });
  if (n < total) pitSay(sim, PIT_POWER.given[Math.min(n, PIT_POWER.given.length) - 1]);
  else {
    P.fixQueued = true;   // (he starts as soon as his hands are free)
    PIT_POWER.allIn.forEach((t, i) => pitSay(sim, t, i * 0.1));
    if (F.work) pitSay(sim, PIT_POWER.busy);
  }
  return true;
}

export function updateCrustPower(sim) {
  const P = W(sim);
  if (!P) return;
  // a relay whose carrier's gone goes back in its box (still burnt)
  for (const [id, r] of Object.entries(P.relays)) {
    if (r.state !== 'carried') continue;
    const p = sim.playerById(r.by);
    if (p && p.alive) continue;
    r.state = 'blown'; r.by = null;
    sim.emit('relayReturned', { id });
  }
}

// ---------------------------------------------------------------------------
// The HUD's line about the power (before the War Hammers'), or null
export function powerObjective(sim, pid) {
  const P = W(sim);
  if (!P) return null;
  const F = sim.crustEgg.forge;
  const mine = relaysCarriedBy(P, pid);
  if (mine.length) return `Take the ${relayName(sim, mine.length)} to Pit`;
  if (!P.on.hub) {
    if (F && F.work && F.work.kind === 'power') return 'Pit is fixing the relays';
    if (relaysAllIn(P)) return 'Pit will fix the relays';
    return `The power's out · pull the ${relayName(sim, 2)} by the launchers · ${relayCount(P, 'given')} of ${relaysTotal(P)} with Pit`;
  }
  const me = pid && sim.playerById(pid);
  const isl = me && me.alive && !me.launch ? islandAt(sim, me.pos) : null;
  if (isl && P.on[isl] === false) return `Turn on the power · the switch by the launcher`;
  return null;
}

// ---------------------------------------------------------------------------
// Interactables
// ---------------------------------------------------------------------------
// A junction box beside one of the Anvil's launchers: pull its burnt relay
class RelayInteractable {
  constructor(spec) {
    this.spec = spec; this.id = spec.id; this.kind = 'relay'; this.requireLook = false;
    this.pos = { x: spec.x, y: spec.y + 1.1, z: spec.z };
    this.stand = { x: spec.x + spec.normal.x * 0.8, z: spec.z + spec.normal.z * 0.8 };
  }
  get range() { return this.reach ?? 1.9; }
  distanceTo(sim, p) { this.reach = sim.cfg.crust.power.relayRange; return flat(p.pos, this.stand); }
  canUse(sim, p) {
    const P = W(sim);
    return up(p) && !p.drinking && !!P && !P.on.hub && P.relays[this.id].state !== 'given';
  }
  prompt(sim, p) {
    const r = W(sim).relays[this.id], name = sim.cfg.crust.power.relayName;
    if (r.state === 'blown') return { text: `Press [F] to pull the ${name}`, cost: null, sub: 'The launcher\'s dead · Pit can fix it' };
    if (r.by === p.id) return { text: `You have this launcher's relay`, cost: null, sub: 'Take it to Pit' };
    const o = sim.playerById(r.by);
    return { text: `${o ? o.name : 'Someone'} has this launcher's relay`, cost: null };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const r = W(sim).relays[this.id];
    if (r.state !== 'blown') { sim.emit('useDenied', { playerId: p.id }); return; }
    r.state = 'carried'; r.by = p.id;
    const P = W(sim);
    sim.emit('relayPulled', { id: this.id, playerId: p.id, pos: { x: this.spec.x, y: this.spec.y + 1.1, z: this.spec.z } });
    const n = Object.values(P.relays).filter((q) => q.state !== 'blown').length;
    if (n === 1) pitSay(sim, PIT_POWER.firstPulled, 0.6);
  }
}

// An island's power switch, by its launcher pad: flip it and the island's on
class SwitchInteractable {
  constructor(spec) {
    this.spec = spec; this.id = spec.id; this.kind = 'power'; this.requireLook = false;
    this.pos = { x: spec.x, y: spec.y + 1.1, z: spec.z };
    this.stand = { x: spec.x + spec.normal.x * 0.8, z: spec.z + spec.normal.z * 0.8 };
  }
  get range() { return this.reach ?? 1.7; }
  distanceTo(sim, p) { this.reach = sim.cfg.crust.power.switchRange; return flat(p.pos, this.stand); }
  canUse(sim, p) { const P = W(sim); return up(p) && !!P && !P.on[this.spec.island]; }
  prompt() { return { text: 'Press [F] to turn on the power', cost: null, sub: this.spec.name }; }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    islandPowerOn(sim, this.spec.island, this.pos, p.id);
    pitSay(sim, PIT_POWER.island[this.spec.island], 1.2);
  }
}

export function crustPowerInteractables(sim) {
  if (!W(sim)) return [];
  return [...sim.mapData.relays.map((r) => new RelayInteractable(r)), ...(sim.mapData.powerSwitches || []).map((s) => new SwitchInteractable(s))];
}
