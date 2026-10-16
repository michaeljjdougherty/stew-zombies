// =============================================================================
// Pit's forge (Call of the Crust). Pit isn't playable on this map: he got to
// the Anvil first and learned to smith, and he stays at his bench in the pit.
//
//   0. The War Hammer itself is in four parts, one at each island's shrine.
//      Walk over a part to pick it up and bring it to the stand on the dais;
//      once all four are on it, everyone can take a War Hammer from it (one
//      each). It's plain iron: the cores make it elemental.
//   1. Beat an island's titan (crustEgg.js) and its War Hammer core drops
//      where it fell. Walk over it to pick it up.
//   2. Bring it back to Pit's bench and hand it over [F]. He forges its War
//      Hammer (one at a time; the rest wait on the pile) and sets it in its
//      socket on the Anvil: N wind, E lightning, S fire, W ice.
//   3. Take a hammer from its socket [F] with your War Hammer in hand: yours
//      takes on that element (one person per element; put it back and yours is
//      plain again; lose it and it goes back to its socket). Do that element's
//      trial on its island (hammerTrials.js), then hand Pit the hammer and he
//      tempers it, free: its "+".
//   4. All four forged: ring the Anvil [F] and Big Evil Zach comes down into
//      the pit (zachBoss.js).
//
// Everything here is plain data in sim.crustEgg.forge / .cores, so an online
// host sends it with the rest. Pit's lines: PIT_FORGE in src/lore/crew.js.
// =============================================================================
import { PIT_FORGE, PIT_POWER, CREW } from '../lore/crew.js';
import { lineDuration } from '../lore/erik.js';
import { recordedDuration } from '../lore/voice.js';
import { giveWeapon, cancelReload } from './weapons.js';
import { HAMMER_ELEMENTS, HAMMER_IDS } from './hammers.js';
import { startFinale } from './zachBoss.js';
import { giveRelays, relaysCarriedBy, relaysFixed, hubPowered } from './crustPower.js';
import { paSay } from './pa.js';
import { RNG } from '../core/rng.js';
import { trialDone, trialHint, trialObjective } from './hammerTrials.js';

// which titan guards which element
export const CORE_ELEMENT = { ship: 'wind', research: 'lightning', caves: 'ice', trench: 'fire' };
export const ELEMENT_NAMES = { wind: 'Wind', lightning: 'Lightning', ice: 'Ice', fire: 'Fire' };
const baseId = (id) => (id && id.endsWith('+') ? id.slice(0, -1) : id);
const up = (p) => p.alive && !p.downed;
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function createForge(sim) {
  const spec = sim.mapData.forge;
  if (!spec) return null;
  const hammers = {};
  for (const el of HAMMER_ELEMENTS) hammers[el] = { forged: false, by: null, tempered: false };
  // the War Hammer's parts, where they lie
  const parts = {};
  const P = sim.cfg.crust.hammerParts.parts;
  // (each hidden at one of its island's spots, picked fresh every game; online the
  // host's pick is the one everyone gets)
  const rng = new RNG(((sim.seed || 1) * 7919 + 1013) >>> 0);
  for (const h of sim.mapData.hammerParts || []) {
    const d = P[h.island];
    if (!d) continue;
    const at = rng.pick(h.spots);
    parts[d.id] = { state: 'lying', x: at.x, y: at.y, z: at.z, home: { x: at.x, y: at.y, z: at.z }, by: null, island: h.island };
  }
  return { queue: [], work: null, hammers, lines: [], talkUntil: 0, nudgeAt: 0, intro: false, said: {}, rung: false, parts, stand: { taken: {} } };
}

// ---------------------------------------------------------------------------
// Pit talking: one line at a time, out loud if you're near him, else on the walkie
export function pitSay(sim, text, delay = 0) {
  const F = sim.crustEgg && sim.crustEgg.forge;
  if (!F || !text) return;
  // (with the speakers on, he waits his turn with everyone else: src/sim/pa.js)
  if (sim.pa && sim.pa.enabled && sim.crew) { paSay(sim, 'pit', { text, delay: delay + F.lines.length * 0.001, force: true, who: 'pit' }); return; }
  F.lines.push({ text, at: sim.time + delay });
}
function pitTalk(sim, F) {
  if (!F.lines.length || sim.time < F.talkUntil || sim.time < F.lines[0].at) return;
  const { text } = F.lines.shift();
  const v = CREW.pit.voice;
  const dur = recordedDuration('pit', text) ?? lineDuration(text) / (v.rate || 1);
  const at = sim.mapData.forge.pit;
  const near = sim.players.some((p) => p.alive && flat(p.pos, at) < sim.cfg.crust.forge.nearPit);
  F.talkUntil = sim.time + dur + sim.cfg.crust.forge.lineGap;
  sim.emit('crewSays', { who: 'pit', text, dur, radio: !near, live: near, cat: 'forge' });
}

// ---------------------------------------------------------------------------
// A titan's down: its core drops where it fell (called from crustEgg.js)
export function dropCore(sim, id, pos) {
  const E = sim.crustEgg;
  const el = CORE_ELEMENT[id];
  E.cores[id] = { state: 'dropped', x: pos.x, y: pos.y || 0, z: pos.z, home: { x: pos.x, y: pos.y || 0, z: pos.z }, by: null, element: el };
  sim.emit('titanCore', { id, element: el, name: ELEMENT_NAMES[el], pos: { ...pos }, count: coresWon(E) });
  pitSay(sim, PIT_FORGE.coreDropped[id], 1.5);
}
export const coresWon = (E) => Object.keys(E.cores).length;
export const PART_NAME = (sim, id) => Object.values(sim.cfg.crust.hammerParts.parts).find((d) => d.id === id).name;
export const partsPlaced = (F) => (F ? Object.values(F.parts).filter((k) => k.state === 'placed').length : 0);
export const partsTotal = (F) => (F ? Object.keys(F.parts).length : 0);
export const hammerBuilt = (F) => !!F && partsTotal(F) > 0 && partsPlaced(F) === partsTotal(F);
const partsCarriedBy = (F, pid) => Object.entries(F.parts).filter(([, k]) => k.state === 'carried' && k.by === pid).map(([id]) => id);
// does this player have a War Hammer of any kind (in hand, or saved while they're down)?
function hasAnyHammer(sim, p) {
  const lists = [p.loadout.slots, p.downed && p.downed.saved ? p.downed.saved.slots : []];
  return lists.some((l) => l.some((s) => { const d = sim.cfg.weapons[s.id]; return d && d.hammer; }));
}
export const hammersForged = (E) => (E.forge ? HAMMER_ELEMENTS.filter((el) => E.forge.hammers[el].forged).length : 0);
export const carriedBy = (E, pid) => Object.entries(E.cores).filter(([, c]) => c.state === 'carried' && c.by === pid).map(([id]) => id);

// Does this player still have this hammer (in hand, or saved while they're down)?
function holds(p, el) {
  const lists = [p.loadout.slots, p.downed && p.downed.saved ? p.downed.saved.slots : []];
  return lists.some((l) => l.some((s) => baseId(s.id) === HAMMER_IDS[el]));
}

// ---------------------------------------------------------------------------
export function updateForge(sim, dt) {
  const E = sim.crustEgg, F = E && E.forge;
  if (!F) return;
  const c = sim.cfg.crust.forge;
  if (!F.intro && sim.time > c.introDelay && sim.mode !== 'range') {
    F.intro = true;
    PIT_FORGE.intro.forEach((t, i) => pitSay(sim, t, i * 0.1));
    F.nudgeAt = sim.time + c.idleEvery * 2;
  }
  // cores on the ground: walk over one to pick it up; one whose carrier's gone goes back
  for (const [id, k] of Object.entries(E.cores)) {
    if (k.state === 'dropped') {
      const p = sim.players.find((q) => up(q) && Math.hypot(q.pos.x - k.x, q.pos.z - k.z) < c.pickupRange && Math.abs(q.pos.y - k.y) < 2.5);
      if (p) { k.state = 'carried'; k.by = p.id; sim.emit('corePicked', { id, element: k.element, playerId: p.id }); }
    } else if (k.state === 'carried') {
      const p = sim.playerById(k.by);
      if (!p || !p.alive) {
        k.state = 'dropped'; k.by = null; k.x = k.home.x; k.y = k.home.y; k.z = k.home.z;
        sim.emit('coreReturned', { id, element: k.element });
      }
    }
  }
  // the War Hammer's parts: walk over one to pick it up; one whose carrier's gone goes back
  const PR = sim.cfg.crust.hammerParts;
  for (const [id, k] of Object.entries(F.parts)) {
    if (k.state === 'lying') {
      const p = sim.players.find((q) => up(q) && Math.hypot(q.pos.x - k.x, q.pos.z - k.z) < PR.pickupRange && Math.abs(q.pos.y - k.y) < 2.5);
      if (p) {
        k.state = 'carried'; k.by = p.id;
        sim.emit('partPicked', { id, name: PART_NAME(sim, id), playerId: p.id });
        if (!F.said['part_' + id]) { F.said['part_' + id] = true; pitSay(sim, PIT_FORGE.partPicked[id], 0.8); }
      }
    } else if (k.state === 'carried') {
      const p = sim.playerById(k.by);
      if (!p || !p.alive) { k.state = 'lying'; k.by = null; k.x = k.home.x; k.y = k.home.y; k.z = k.home.z; sim.emit('partReturned', { id }); }
    }
  }
  // hammers whose holder has lost them go back to their sockets
  for (const el of HAMMER_ELEMENTS) {
    const h = F.hammers[el];
    if (!h.by) continue;
    const p = sim.playerById(h.by);
    if (p && p.alive && holds(p, el)) continue;
    h.by = null;
    sim.emit('hammerReturned', { element: el });
  }
  // Pit at work: the Anvil's relays first (once he has all four), then the cores
  const PW = E.power;
  if (!F.work && PW && PW.fixQueued) {
    PW.fixQueued = false;
    F.work = { kind: 'power', spark: 'lightning', t: 0, strikes: 0 };
    sim.emit('powerFixStart', {});
  }
  if (!F.work && F.queue.length) {
    const id = F.queue.shift();
    F.work = { kind: 'forge', id, element: CORE_ELEMENT[id], t: 0, strikes: 0 };
    sim.emit('forgeStart', { id, element: F.work.element });
  }
  if (F.work) {
    const W = F.work;
    W.t += dt;
    const total = workTime(sim, W);
    if (W.t >= (W.strikes + 1) * c.strikeEvery && W.t < total - 0.4) { W.strikes++; sim.emit('forgeStrike', { element: W.spark || W.element, n: W.strikes }); }
    if (W.t >= total) finishWork(sim, F, W);
  }
  // nobody's brought him anything in a while (the relays, while the power's out; then cores)
  if (F.intro && sim.time > F.nudgeAt && !F.work && !F.queue.length && hammersForged(E) < 4 && !Object.values(E.cores).some((k) => k.state !== 'forged') && !E.active && !(PW && PW.fixQueued)) {
    F.nudgeAt = sim.time + c.idleEvery;
    const n = (F.said.nudge = (F.said.nudge || 0) + 1);
    const lines = hubPowered(sim) ? PIT_FORGE.nudge : PIT_POWER.nudge;
    if (sim.players.some((p) => p.alive && flat(p.pos, sim.mapData.forge.pit) < 12)) pitSay(sim, lines[n % lines.length]);
  }
  pitTalk(sim, F);
}

// how long Pit takes over a job
function workTime(sim, W) {
  const c = sim.cfg.crust.forge;
  return W.kind === 'forge' ? c.forgeTime : W.kind === 'power' ? sim.cfg.crust.power.fixTime : c.temperTime;
}

function finishWork(sim, F, W) {
  F.work = null;
  if (W.kind === 'power') { relaysFixed(sim); return; }
  const el = W.element;
  if (W.kind === 'forge') {
    sim.crustEgg.cores[W.id].state = 'forged';
    F.hammers[el].forged = true;
    const n = hammersForged(sim.crustEgg);
    sim.emit('hammerForged', { element: el, name: HAMMER_IDS[el], count: n });
    pitSay(sim, PIT_FORGE.forged[el]);
    if (n === 4) { PIT_FORGE.allForged.forEach((t, i) => pitSay(sim, t, 0.6 + i * 0.1)); sim.emit('hammersAll', {}); }
    return;
  }
  // tempered: the hammer you handed over comes back as its "+"
  F.hammers[el].tempered = true;
  const p = sim.playerById(W.playerId);
  let slot = null;
  if (p) for (const l of [p.loadout.slots, p.downed && p.downed.saved ? p.downed.saved.slots : []]) slot = slot || l.find((s) => s === W.slot) || null;
  if (slot) {
    const upId = HAMMER_IDS[el] + '+';
    const def = sim.cfg.weapons[upId];
    slot.id = upId; slot.away = false; slot.upgraded = true; slot.clip = def.magSize; slot.reserve = 0;
    if (p.loadout.slots.includes(slot)) {
      p.loadout.current = p.loadout.slots.indexOf(slot);
      p.loadout.drawTimer = def.drawTime;
      sim.emit('weaponGiven', { playerId: p.id, weapon: upId });
    }
  }
  sim.emit('hammerTempered', { element: el, playerId: W.playerId, name: sim.cfg.weapons[HAMMER_IDS[el] + '+'].name });
  pitSay(sim, PIT_FORGE.tempered[el]);
}

// ---------------------------------------------------------------------------
// The HUD's line when no titan is awake: what the forge wants from you
export function forgeObjective(sim, pid) {
  const E = sim.crustEgg, F = E && E.forge;
  if (!F) return null;
  const mine = carriedBy(E, pid);
  if (mine.length) return `Take the ${mine.map((id) => ELEMENT_NAMES[CORE_ELEMENT[id]]).join(' and ')} core${mine.length > 1 ? 's' : ''} to Pit at the Anvil`;
  const parts = partsCarriedBy(F, pid);
  if (parts.length) return `Take the ${parts.map((id) => PART_NAME(sim, id)).join(' and ')} to the War Hammer stand at the Anvil`;
  if (!hammerBuilt(F) && partsTotal(F)) return `Find the War Hammer's parts · ${partsPlaced(F)} of ${partsTotal(F)} (one on each island)`;
  const me = pid && sim.playerById(pid);
  if (me && me.alive && !hasAnyHammer(sim, me)) return 'Take a War Hammer from the stand at the Anvil';
  if (F.work) return F.work.kind === 'forge' ? `Pit is forging the ${HAMMER_IDS[F.work.element]}` : `Pit is tempering the ${HAMMER_IDS[F.work.element]}`;
  const lying = Object.values(E.cores).find((k) => k.state === 'dropped');
  if (lying) return `Pick up the ${ELEMENT_NAMES[lying.element]} core`;
  const trial = me && me.alive ? trialObjective(sim, me) : null;
  if (trial) return trial;
  const n = hammersForged(E);
  if (n === 4 && !F.rung) return 'Ring the Anvil';
  if (n > 0 && n < 4) return `War Hammers forged · ${n} of 4`;
  return null;
}

// ---------------------------------------------------------------------------
// Interactables
// ---------------------------------------------------------------------------
function forgeOf(sim) { return sim.crustEgg && sim.crustEgg.forge; }

// Pit's bench: hand him cores, or a hammer to temper
class BenchInteractable {
  constructor(spec) {
    this.id = 'forge_bench'; this.kind = 'forge'; this.requireLook = false;
    const b = spec.bench;
    this.pos = { x: (b[0] + b[2]) / 2, y: (spec.y || 0) + 1, z: (b[1] + b[3]) / 2 };
  }
  get range() { return 2.6; }
  distanceTo(sim, p) { return Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z); }
  canUse(sim, p) { return up(p) && !p.drinking && !!forgeOf(sim); }
  heldHammer(sim, p) {
    const slot = p.loadout.slots[p.loadout.current];
    const def = slot && sim.cfg.weapons[slot.id];
    return def && def.hammer && def.hammer !== 'iron' && !def.upgraded && !slot.away ? def.hammer : null;
  }
  prompt(sim, p) {
    const E = sim.crustEgg, F = E.forge, c = sim.cfg.crust.forge;
    const relays = E.power ? relaysCarriedBy(E.power, p.id) : [];
    if (relays.length) return { text: `Press [F] to give Pit the ${sim.cfg.crust.power.relayName.toLowerCase()}${relays.length > 1 ? 's' : ''}`, cost: null };
    const mine = carriedBy(E, p.id);
    if (mine.length) return { text: `Press [F] to give Pit the ${mine.map((id) => ELEMENT_NAMES[CORE_ELEMENT[id]]).join(' and ')} core${mine.length > 1 ? 's' : ''}`, cost: null };
    if (F.work) {
      const left = Math.max(1, Math.ceil(workTime(sim, F.work) - F.work.t));
      if (F.work.kind === 'power') return { text: `Pit is fixing the relays · ${left}s`, cost: null };
      return { text: `Pit is ${F.work.kind === 'forge' ? 'forging' : 'tempering'} the ${HAMMER_IDS[F.work.element]} · ${left}s`, cost: null };
    }
    if (!hubPowered(sim)) return { text: 'Pit needs the launchers\' burnt relays', cost: null, sub: 'One in the box beside each launcher, up on the rim' };
    const el = this.heldHammer(sim, p);
    // (it earns its temper on its own island first: hammerTrials.js)
    if (el && !F.queue.length && !trialDone(sim, el)) return { text: `Pit: "The ${HAMMER_IDS[el]} isn't ready, man."`, cost: null, sub: trialHint(sim, el) };
    if (el && !F.queue.length) return { text: `Press [F] to have Pit temper the ${HAMMER_IDS[el]}`, cost: null, sub: `It comes back as the ${sim.cfg.weapons[HAMMER_IDS[el] + '+'].name}` };
    if (hammersForged(E) === 4) return { text: F.rung ? 'Pit' : 'Pit: "Ring the Anvil, man."', cost: null };
    return { text: 'Pit needs the titans\' War Hammer cores', cost: null };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const E = sim.crustEgg, F = E.forge, c = sim.cfg.crust.forge;
    if (giveRelays(sim, p)) return;
    const mine = carriedBy(E, p.id);
    if (mine.length) {
      for (const id of mine) {
        E.cores[id].state = 'given'; E.cores[id].by = null;
        sim.emit('coreGiven', { id, element: CORE_ELEMENT[id], playerId: p.id });
        pitSay(sim, F.work || F.queue.length ? PIT_FORGE.queued : PIT_FORGE.given[CORE_ELEMENT[id]]);
        F.queue.push(id);
      }
      return;
    }
    if (F.work || F.queue.length) { sim.emit('useDenied', { playerId: p.id }); return; }
    const el = this.heldHammer(sim, p);
    if (!el) return;
    if (!trialDone(sim, el)) { sim.emit('useDenied', { playerId: p.id }); return; }
    const w = p.loadout, slot = w.slots[w.current];
    if (w.reloading) cancelReload(sim, p);
    slot.away = true;
    F.work = { kind: 'temper', element: el, playerId: p.id, slot, t: 0, strikes: 0 };
    // switch to your other gun while Pit has the hammer
    const other = w.slots.findIndex((s) => !s.away);
    if (other >= 0) { w.current = other; w.drawTimer = sim.cfg.weapons[w.slots[other].id].drawTime; sim.emit('weaponSwitch', { playerId: p.id, weapon: w.slots[other].id }); }
    sim.emit('temperStart', { element: el, playerId: p.id });
    pitSay(sim, PIT_FORGE.temperStart);
  }
}

// One of the Anvil's four sockets: take its hammer, or put it back
class SocketInteractable {
  constructor(spec, el) {
    const s = spec.sockets[el];
    this.el = el; this.id = 'socket_' + el; this.kind = 'socket'; this.requireLook = true;
    this.pos = { x: s.x, y: (spec.y || 0) + 1.5, z: s.z };
  }
  get range() { return 2.1; }
  distanceTo(sim, p) { return Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z); }
  canUse(sim, p) { const F = forgeOf(sim); return up(p) && !p.drinking && !!F && F.hammers[this.el].forged; }
  prompt(sim, p) {
    const h = sim.crustEgg.forge.hammers[this.el];
    const name = sim.cfg.weapons[HAMMER_IDS[this.el] + (h.tempered ? '+' : '')].name;
    if (h.by === p.id) return holds(p, this.el) ? { text: `Press [F] to put the ${name} back`, cost: null, sub: 'Your War Hammer goes back to plain iron' } : { text: `You have the ${name}`, cost: null };
    if (h.by) { const o = sim.playerById(h.by); return { text: `${o ? o.name : 'Someone'} has the ${name}`, cost: null }; }
    if (plainSlot(sim, p) < 0) return { text: `The ${name}`, cost: null, sub: hasAnyHammer(sim, p) ? 'Put your other element back first' : 'Bring a War Hammer to take its element' };
    return { text: `Press [F] to take the ${name}`, cost: null, sub: 'Your War Hammer takes its element' };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const h = sim.crustEgg.forge.hammers[this.el];
    const w = p.loadout;
    if (h.by === p.id) {
      // back in its socket: your hammer's plain iron again
      const slot = w.slots.find((s) => baseId(s.id) === HAMMER_IDS[this.el] && !s.away);
      if (!slot) { sim.emit('useDenied', { playerId: p.id }); return; }
      if (w.reloading) cancelReload(sim, p);
      slot.id = 'War Hammer'; slot.upgraded = false;
      h.by = null;
      sim.emit('hammerReturned', { element: this.el, playerId: p.id });
      if (w.slots[w.current] === slot) { w.drawTimer = sim.cfg.weapons['War Hammer'].drawTime; sim.emit('weaponSwitch', { playerId: p.id, weapon: 'War Hammer' }); }
      return;
    }
    const i = plainSlot(sim, p);
    if (h.by || i < 0) { sim.emit('useDenied', { playerId: p.id }); return; }
    const id = HAMMER_IDS[this.el] + (h.tempered ? '+' : '');
    h.by = p.id;
    if (w.reloading) cancelReload(sim, p);
    const slot = w.slots[i];
    slot.id = id; slot.upgraded = !!h.tempered; slot.clip = sim.cfg.weapons[id].magSize; slot.reserve = 0;
    w.current = i; w.drawTimer = sim.cfg.weapons[id].drawTime;
    sim.emit('hammerTaken', { element: this.el, playerId: p.id });
    sim.emit('weaponGiven', { playerId: p.id, weapon: id });
  }
}

// which of your slots holds a plain War Hammer (-1: none)
function plainSlot(sim, p) { return p.loadout.slots.findIndex((s) => s.id === 'War Hammer' && !s.away); }

// The War Hammer stand on the dais: put the parts on it; once it's whole, take a hammer (one each)
class StandInteractable {
  constructor(spec) {
    this.id = 'hammer_stand'; this.kind = 'stand'; this.requireLook = false;
    this.pos = { x: spec.stand.x, y: (spec.stand.y || 0) + 1, z: spec.stand.z };
  }
  get range() { return this.reach ?? 2.4; }
  distanceTo(sim, p) { this.reach = sim.cfg.crust.hammerParts.standRange; return Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z); }
  canUse(sim, p) { return up(p) && !p.drinking && !!forgeOf(sim) && partsTotal(forgeOf(sim)) > 0; }
  prompt(sim, p) {
    const F = forgeOf(sim);
    const mine = partsCarriedBy(F, p.id);
    if (mine.length) return { text: `Press [F] to put the ${mine.map((id) => PART_NAME(sim, id)).join(' and ')} on the stand`, cost: null };
    if (!hammerBuilt(F)) return { text: `The War Hammer · ${partsPlaced(F)} of ${partsTotal(F)} parts`, cost: null, sub: 'One part hidden somewhere on each island' };
    if (hasAnyHammer(sim, p)) return { text: 'You have your War Hammer', cost: null };
    return { text: 'Press [F] to take a War Hammer', cost: null };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const F = forgeOf(sim);
    const mine = partsCarriedBy(F, p.id);
    if (mine.length) {
      for (const id of mine) {
        F.parts[id].state = 'placed'; F.parts[id].by = null;
        sim.emit('partPlaced', { id, name: PART_NAME(sim, id), playerId: p.id, count: partsPlaced(F), total: partsTotal(F) });
      }
      if (hammerBuilt(F)) { sim.emit('warHammerBuilt', { playerId: p.id }); PIT_FORGE.hammerBuilt.forEach((t, i) => pitSay(sim, t, 0.5 + i * 0.1)); }
      else pitSay(sim, PIT_FORGE.partPlaced, 0.4);
      return;
    }
    if (!hammerBuilt(F) || hasAnyHammer(sim, p)) { sim.emit('useDenied', { playerId: p.id }); return; }
    F.stand.taken[p.id] = (F.stand.taken[p.id] || 0) + 1;
    giveWeapon(sim, p, 'War Hammer');
    sim.emit('warHammerTaken', { playerId: p.id });
  }
}

// The Anvil itself: ring it once the four are forged and Big Evil Zach comes
class AnvilInteractable {
  constructor(spec) {
    this.id = 'anvil'; this.kind = 'anvil'; this.requireLook = false;
    this.pos = { x: spec.anvil.x, y: (spec.y || 0) + 1.5, z: spec.anvil.z };
    this.reach = spec.anvil.r;
  }
  get range() { return this.reach; }
  distanceTo(sim, p) { return Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z); }
  canUse(sim, p) {
    const E = sim.crustEgg, F = forgeOf(sim);
    return up(p) && !!F && !F.rung && hammersForged(E) === 4 && !E.active;
  }
  prompt() { return { text: 'Press [F] to ring the Anvil', cost: null, sub: 'Big Evil Zach will come' }; }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const F = forgeOf(sim);
    F.rung = true;
    sim.emit('anvilRung', { playerId: p.id });
    pitSay(sim, PIT_FORGE.ring, 0.4);
    startFinale(sim);
  }
}

export function forgeInteractables(sim) {
  const spec = sim.mapData.forge;
  if (!spec || !sim.crustEgg || !sim.crustEgg.forge) return [];
  return [new BenchInteractable(spec), ...HAMMER_ELEMENTS.map((el) => new SocketInteractable(spec, el)), new AnvilInteractable(spec), ...(spec.stand ? [new StandInteractable(spec)] : [])];
}

// Explore mode: every core in and every War Hammer on the Anvil, right now
export function forgeAllNow(sim) {
  const E = sim.crustEgg, F = E && E.forge;
  if (!F) return;
  for (const [id, el] of Object.entries(CORE_ELEMENT)) {
    const h = sim.mapData.forge.sockets[el];
    E.cores[id] = { state: 'forged', x: h.x, y: h.y, z: h.z, home: { x: h.x, y: h.y, z: h.z }, by: null, element: el };
    F.hammers[el].forged = true;
  }
  for (const k of Object.values(F.parts)) { k.state = 'placed'; k.by = null; }
  F.work = null; F.queue.length = 0;
  sim.emit('hammersAll', {});
}
