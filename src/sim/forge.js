// =============================================================================
// Pit's forge (Call of the Crust). Pit isn't playable on this map: he got to
// the Anvil first and learned to smith, and he stays at his bench in the pit.
//
//   1. Beat an island's titan (crustEgg.js) and its War Hammer core drops
//      where it fell. Walk over it to pick it up.
//   2. Bring it back to Pit's bench and hand it over [F]. He forges its War
//      Hammer (one at a time; the rest wait on the pile) and sets it in its
//      socket on the Anvil: N wind, E lightning, S fire, W ice.
//   3. Take a hammer from its socket [F] (one person per hammer; it goes back
//      to its socket if you lose it). Hand Pit a hammer you're holding and he
//      tempers it, for a price: its "+".
//   4. All four forged: ring the Anvil [F] and Big Evil Zach comes down into
//      the pit (zachBoss.js).
//
// Everything here is plain data in sim.crustEgg.forge / .cores, so an online
// host sends it with the rest. Pit's lines: PIT_FORGE in src/lore/crew.js.
// =============================================================================
import { PIT_FORGE, CREW } from '../lore/crew.js';
import { lineDuration } from '../lore/erik.js';
import { recordedDuration } from '../lore/voice.js';
import { giveWeapon, cancelReload } from './weapons.js';
import { HAMMER_ELEMENTS, HAMMER_IDS } from './hammers.js';
import { startFinale } from './zachBoss.js';

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
  return { queue: [], work: null, hammers, lines: [], talkUntil: 0, nudgeAt: 0, intro: false, said: {}, rung: false };
}

// ---------------------------------------------------------------------------
// Pit talking: one line at a time, out loud if you're near him, else on the walkie
export function pitSay(sim, text, delay = 0) {
  const F = sim.crustEgg && sim.crustEgg.forge;
  if (!F || !text) return;
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
  // hammers whose holder has lost them go back to their sockets
  for (const el of HAMMER_ELEMENTS) {
    const h = F.hammers[el];
    if (!h.by) continue;
    const p = sim.playerById(h.by);
    if (p && p.alive && holds(p, el)) continue;
    h.by = null;
    sim.emit('hammerReturned', { element: el });
  }
  // Pit at work
  if (!F.work && F.queue.length) {
    const id = F.queue.shift();
    F.work = { kind: 'forge', id, element: CORE_ELEMENT[id], t: 0, strikes: 0 };
    sim.emit('forgeStart', { id, element: F.work.element });
  }
  if (F.work) {
    const W = F.work;
    W.t += dt;
    const total = W.kind === 'forge' ? c.forgeTime : c.temperTime;
    if (W.t >= (W.strikes + 1) * c.strikeEvery && W.t < total - 0.4) { W.strikes++; sim.emit('forgeStrike', { element: W.element, n: W.strikes }); }
    if (W.t >= total) finishWork(sim, F, W);
  }
  // nobody's brought him anything in a while
  if (sim.time > F.nudgeAt && !F.work && !F.queue.length && hammersForged(E) < 4 && !Object.values(E.cores).some((k) => k.state !== 'forged') && !E.active) {
    F.nudgeAt = sim.time + c.idleEvery;
    const n = (F.said.nudge = (F.said.nudge || 0) + 1);
    if (sim.players.some((p) => p.alive && flat(p.pos, sim.mapData.forge.pit) < 12)) pitSay(sim, PIT_FORGE.nudge[n % PIT_FORGE.nudge.length]);
  }
  pitTalk(sim, F);
}

function finishWork(sim, F, W) {
  F.work = null;
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
  if (F.work) return F.work.kind === 'forge' ? `Pit is forging the ${HAMMER_IDS[F.work.element]}` : `Pit is tempering the ${HAMMER_IDS[F.work.element]}`;
  const lying = Object.values(E.cores).find((k) => k.state === 'dropped');
  if (lying) return `Pick up the ${ELEMENT_NAMES[lying.element]} core`;
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
    return def && def.hammer && !def.upgraded && !slot.away ? def.hammer : null;
  }
  prompt(sim, p) {
    const E = sim.crustEgg, F = E.forge, c = sim.cfg.crust.forge;
    const mine = carriedBy(E, p.id);
    if (mine.length) return { text: `Press [F] to give Pit the ${mine.map((id) => ELEMENT_NAMES[CORE_ELEMENT[id]]).join(' and ')} core${mine.length > 1 ? 's' : ''}`, cost: null };
    if (F.work) {
      const total = F.work.kind === 'forge' ? c.forgeTime : c.temperTime;
      return { text: `Pit is ${F.work.kind === 'forge' ? 'forging' : 'tempering'} the ${HAMMER_IDS[F.work.element]} · ${Math.max(1, Math.ceil(total - F.work.t))}s`, cost: null };
    }
    const el = this.heldHammer(sim, p);
    if (el && !F.queue.length) return { text: `Press [F] to have Pit temper the ${HAMMER_IDS[el]}`, cost: c.temperCost, sub: `It comes back as the ${sim.cfg.weapons[HAMMER_IDS[el] + '+'].name}` };
    if (hammersForged(E) === 4) return { text: F.rung ? 'Pit' : 'Pit: "Ring the Anvil, man."', cost: null };
    return { text: 'Pit needs the titans\' War Hammer cores', cost: null };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const E = sim.crustEgg, F = E.forge, c = sim.cfg.crust.forge;
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
    if (p.points < c.temperCost) { sim.emit('cantAfford', { playerId: p.id, cost: c.temperCost }); return; }
    sim.spendPoints(p, c.temperCost);
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
    if (h.by === p.id) return holds(p, this.el) && p.loadout.slots.length > 1 ? { text: `Press [F] to put the ${name} back`, cost: null } : { text: `You have the ${name}`, cost: null };
    if (h.by) { const o = sim.playerById(h.by); return { text: `${o ? o.name : 'Someone'} has the ${name}`, cost: null }; }
    return { text: `Press [F] to take the ${name}`, cost: null };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const h = sim.crustEgg.forge.hammers[this.el];
    if (h.by === p.id) {
      const w = p.loadout;
      const i = w.slots.findIndex((s) => baseId(s.id) === HAMMER_IDS[this.el] && !s.away);
      if (i < 0 || w.slots.length < 2) { sim.emit('useDenied', { playerId: p.id }); return; }
      if (w.reloading) cancelReload(sim, p);
      w.slots.splice(i, 1);
      w.current = Math.min(w.current > i ? w.current - 1 : w.current, w.slots.length - 1);
      w.drawTimer = sim.cfg.weapons[w.slots[w.current].id].drawTime;
      h.by = null;
      sim.emit('hammerReturned', { element: this.el, playerId: p.id });
      sim.emit('weaponSwitch', { playerId: p.id, weapon: w.slots[w.current].id });
      return;
    }
    if (h.by) { sim.emit('useDenied', { playerId: p.id }); return; }
    h.by = p.id;
    giveWeapon(sim, p, HAMMER_IDS[this.el] + (h.tempered ? '+' : ''));
    sim.emit('hammerTaken', { element: this.el, playerId: p.id });
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
  return [new BenchInteractable(spec), ...HAMMER_ELEMENTS.map((el) => new SocketInteractable(spec, el)), new AnvilInteractable(spec)];
}
