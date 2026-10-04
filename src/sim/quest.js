// =============================================================================
// "The Final Whistle" — the main Easter egg quest on Stew Leonard High.
// (Designed by James Amarante.)
//
//   1. Power & the Mad Dog Machine: throw the two main breakers (cafeteria,
//      science lab), find the three pieces of the championship trophy
//      (library, locker room, teachers' lounge) and put it back together at
//      center court. The stand slides aside and the Mad Dog Machine comes up
//      through a trapdoor.
//   2. The Schnitz's Coin: kill zombies near the towering mascot statue in the
//      Quad to feed it their dark energy. Fully fed, its eyes ignite and its
//      jaw drops the Dark Schnitz Coin.
//   3. Retracting the cladding: put the coin in the occult altar under the
//      Press Box. The steel cladding grinds up into the roof and there's Erik,
//      sealed in behind the glass.
//   (4. the half-court ritual and 5. the Intercom Showdown follow.)
//
// Pure simulation: state + events. The quest views (src/render/questView.js),
// the HUD and the sound director read it.
// =============================================================================
import { paSay } from './pa.js';

const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const up = (p) => p.alive && !p.downed;
const solid = (x0, y0, z0, x1, y1, z1, kind) => ({ minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1, kind });

// The steps, in order. `step` on the quest state is one of these.
export const QUEST_STEPS = ['power', 'trophy', 'statue', 'coin', 'altar', 'cladding', 'ritual', 'boss', 'ending', 'done'];

export function createQuest(sim) {
  const Q = sim.world.quest;
  if (!Q || !(sim.mode === 'zombies' || sim.mode === 'explore')) return null;
  const c = sim.cfg.quest;
  const st = {
    step: 'power',
    breakers: [],              // ids thrown
    pieces: [],                // trophy piece ids found
    trophyPlaced: false,
    madDogRise: 0,             // 0..1 as the machine comes up through the floor
    madDogRevealed: false,
    statueSouls: 0,
    statueAwake: false,
    statueAwakeAt: 0,
    coin: 'none',              // none | dropped | held | placed
    coinHolder: null,
    cladding: 0,               // 0..1: the cladding grinding up into the roof
    erikRevealed: false,
    souls: 0,
  };
  // the trophy stand at center court is solid; it slides aside later
  const ts = Q.trophyStand;
  st.standBox = solid(ts.x - 0.42, 0, ts.z - 0.42, ts.x + 0.42, 1.1, ts.z + 0.42, 'trophyStand');
  sim.world.solids.push(st.standBox);
  st.standPos = { x: ts.x, z: ts.z };
  // the altar under the Press Box
  const al = Q.altar;
  sim.world.solids.push(solid(al.x - 0.65, 0, al.z - 0.42, al.x + 0.65, 0.88, al.z + 0.42, 'altar'));
  st.need = { breakers: Q.breakers.length, pieces: Q.trophyPieces.length, souls: c.statueSouls };
  return st;
}

export function questInteractables(sim) {
  const Q = sim.world.quest;
  if (!sim.quest) return [];
  return [
    ...Q.breakers.map((b) => new BreakerInteractable(b)),
    ...Q.trophyPieces.map((t) => new TrophyPieceInteractable(t)),
    new TrophyStandInteractable(Q.trophyStand),
    new CoinInteractable(Q.statue.coin),
    new AltarInteractable(Q.altar),
  ];
}

// ---------------------------------------------------------------------------
// 1. Power & the Mad Dog Machine
// ---------------------------------------------------------------------------
export class BreakerInteractable {
  constructor(b) {
    this.b = b;
    this.id = 'breaker_' + b.id;
    this.kind = 'breaker';
    this.requireLook = true;
    this.pos = { x: b.pos.x, y: b.pos.y, z: b.pos.z };
    this.stand = { x: b.pos.x + b.normal.x * 0.7, z: b.pos.z + b.normal.z * 0.7 };
  }
  get range() { return 1.6; }
  distanceTo(sim, p) { return flatDist(p.pos, this.stand); }
  canUse(sim, p) { return up(p) && !sim.quest.breakers.includes(this.b.id); }
  prompt(sim) {
    const n = sim.quest.breakers.length, t = sim.quest.need.breakers;
    return { text: `Press [F] to throw the ${this.b.label} main breaker`, cost: null, sub: n ? `${n} of ${t} thrown` : `one of ${t} main breakers` };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const q = sim.quest;
    q.breakers.push(this.b.id);
    sim.emit('breakerThrown', { playerId: p.id, id: this.b.id, count: q.breakers.length, total: q.need.breakers, pos: { ...this.pos } });
    if (q.breakers.length >= q.need.breakers) {
      sim.turnOnPower(p);
      advance(sim, 'trophy');
      paSay(sim, 'breakersDone', { delay: 6 });
    } else paSay(sim, 'breaker', { delay: 1.2 });
  }
}

export class TrophyPieceInteractable {
  constructor(t) {
    this.t = t;
    this.id = 'trophy_' + t.id;
    this.kind = 'trophyPiece';
    this.requireLook = true;
    this.pos = { x: t.x, y: t.y, z: t.z };
    this.stand = t.stand || { x: t.x, z: t.z };
  }
  get range() { return 1.5; }
  distanceTo(sim, p) { return flatDist(p.pos, this.pos); }
  canUse(sim, p) { return up(p) && !sim.quest.pieces.includes(this.t.id); }
  prompt() { return { text: `Press [F] to take the ${this.t.name}`, cost: null, sub: 'a piece of the championship trophy' }; }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const q = sim.quest;
    q.pieces.push(this.t.id);
    sim.emit('trophyPiece', { playerId: p.id, id: this.t.id, name: this.t.name, count: q.pieces.length, total: q.need.pieces, pos: { ...this.pos } });
    paSay(sim, 'trophyPiece', { delay: 0.8 });
  }
}

export class TrophyStandInteractable {
  constructor(ts) {
    this.ts = ts;
    this.id = 'trophy_stand';
    this.kind = 'trophyStand';
    this.requireLook = true;
    this.pos = { x: ts.x, y: 1.1, z: ts.z };
  }
  get range() { return 1.6; }
  distanceTo(sim, p) { return flatDist(p.pos, this.pos); }
  canUse(sim, p) { return up(p) && !sim.quest.trophyPlaced; }
  prompt(sim) {
    const q = sim.quest, n = q.pieces.length, t = q.need.pieces;
    if (n < t) return { text: 'The championship trophy is in pieces', cost: null, sub: n ? `${n} of ${t} pieces found` : 'find the pieces around the school' };
    return { text: 'Press [F] to put the trophy back together', cost: null };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const q = sim.quest;
    if (q.pieces.length < q.need.pieces) { sim.emit('useDenied', { playerId: p.id }); return; }
    q.trophyPlaced = true;
    q.trophyPlacedAt = sim.time;
    sim.emit('trophyPlaced', { playerId: p.id, pos: { x: this.ts.x, y: 0, z: this.ts.z } });
    paSay(sim, 'trophyPlaced', { delay: 2.5 });
  }
}

// ---------------------------------------------------------------------------
// 2. The Schnitz's Coin
// ---------------------------------------------------------------------------
export class CoinInteractable {
  constructor(c) {
    this.c = c;
    this.id = 'schnitz_coin';
    this.kind = 'coin';
    this.requireLook = false;
    this.pos = { x: c.x, y: c.y, z: c.z };
  }
  get range() { return 1.7; }
  distanceTo(sim, p) { return flatDist(p.pos, this.pos); }
  canUse(sim, p) { return up(p) && sim.quest.coin === 'dropped'; }
  prompt() { return { text: 'Press [F] to take the Dark Schnitz Coin', cost: null }; }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const q = sim.quest;
    q.coin = 'held';
    q.coinHolder = p.id;
    sim.emit('coinTaken', { playerId: p.id });
    paSay(sim, 'coin', { delay: 0.6 });
    advance(sim, 'altar');
  }
}

// ---------------------------------------------------------------------------
// 3. Retracting the cladding
// ---------------------------------------------------------------------------
export class AltarInteractable {
  constructor(a) {
    this.a = a;
    this.id = 'altar';
    this.kind = 'altar';
    this.requireLook = true;
    this.pos = { x: a.x, y: 0.9, z: a.z };
  }
  get range() { return 1.6; }
  distanceTo(sim, p) { return flatDist(p.pos, this.pos); }
  canUse(sim, p) { return up(p) && sim.quest.coin !== 'placed'; }
  prompt(sim) {
    const q = sim.quest;
    if (q.coin === 'held') return { text: 'Press [F] to set the Dark Schnitz Coin in the altar', cost: null };
    return { text: 'An altar under the Press Box', cost: null, sub: 'there\'s a coin-shaped hollow in the top' };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const q = sim.quest;
    if (q.coin !== 'held') { sim.emit('useDenied', { playerId: p.id }); return; }
    q.coin = 'placed';
    q.coinHolder = null;
    q.claddingStart = sim.time;
    sim.emit('coinPlaced', { playerId: p.id, pos: { x: this.a.x, y: 0.9, z: this.a.z } });
    advance(sim, 'cladding');
    paSay(sim, 'cladding', { delay: 1.5, force: true });
  }
}

// ---------------------------------------------------------------------------
function advance(sim, step) {
  const q = sim.quest;
  if (QUEST_STEPS.indexOf(step) <= QUEST_STEPS.indexOf(q.step)) return;
  q.step = step;
  sim.emit('questStep', { step });
}

// The game's events, as they happen.
export function questOnEvent(sim, e) {
  const q = sim.quest;
  if (!q) return;
  if (e.type === 'zombieKilled' && q.step === 'statue' && e.pos) {
    // a kill near the statue: its dark energy goes into the base
    const S = sim.world.quest.statue;
    if (Math.hypot(e.pos.x - S.x, e.pos.z - S.z) <= sim.cfg.quest.statueRadius) {
      q.statueSouls = Math.min(q.need.souls, q.statueSouls + 1);
      sim.emit('statueSoul', { from: { x: e.pos.x, y: 1.1, z: e.pos.z }, count: q.statueSouls, total: q.need.souls });
      if (q.statueSouls === 1) paSay(sim, 'statueFed', { delay: 1 });
      if (q.statueSouls >= q.need.souls) {
        q.statueAwake = true;
        q.statueAwakeAt = sim.time;
        sim.emit('statueAwake', { pos: { x: S.x, y: 0, z: S.z } });
        advance(sim, 'coin');
      }
    }
  }
}

export function updateQuest(sim, dt) {
  const q = sim.quest;
  if (!q) return;
  const c = sim.cfg.quest;
  const Q = sim.world.quest;
  // the trophy stand slides aside and the Mad Dog Machine comes up
  if (q.trophyPlaced && !q.madDogRevealed) {
    const t = sim.time - q.trophyPlacedAt;
    if (t > c.trophySettle) {
      if (!q.madDogRising) {
        q.madDogRising = true;
        sim.emit('madDogRising', { pos: { x: Q.trophyStand.x, y: 0, z: Q.trophyStand.z } });
      }
      // the stand slides to the side
      const k = Math.min(1, (t - c.trophySettle) / 1.2);
      const to = Q.trophyStand.slideTo;
      q.standPos.x = Q.trophyStand.x + (to.x - Q.trophyStand.x) * k;
      q.standPos.z = Q.trophyStand.z + (to.z - Q.trophyStand.z) * k;
      const b = q.standBox;
      b.minX = q.standPos.x - 0.42; b.maxX = q.standPos.x + 0.42; b.minZ = q.standPos.z - 0.42; b.maxZ = q.standPos.z + 0.42;
      q.madDogRise = Math.min(1, Math.max(0, (t - c.trophySettle - 1) / c.madDogRiseTime));
      if (q.madDogRise >= 1) {
        q.madDogRevealed = true;
        const md = sim.world.madDog;
        // the machine is solid now (anything standing on the trapdoor gets pushed off by the physics)
        sim.world.solids.push(solid(md.x - 1.3, 0, md.z - 1.2, md.x + 1.3, 2.6, md.z + 1.2, 'madDog'));
        sim.emit('madDogRevealed', { pos: { x: md.x, y: 0, z: md.z } });
        advance(sim, 'statue');
      }
    }
  }
  // the statue's jaw drops open and the coin falls out
  if (q.statueAwake && q.coin === 'none' && sim.time - q.statueAwakeAt > c.coinDropDelay) {
    q.coin = 'dropped';
    sim.emit('coinDrop', { pos: { ...Q.statue.coin } });
  }
  // the cladding grinds up into the roof
  if (q.coin === 'placed' && !q.erikRevealed) {
    q.cladding = Math.min(1, (sim.time - q.claddingStart) / c.claddingTime);
    if (q.cladding >= 1) {
      q.erikRevealed = true;
      sim.emit('erikRevealed', {});
      advance(sim, 'ritual');
    }
  }
  // whoever's holding the coin and bleeds out drops it back where it came from
  if (q.coin === 'held') {
    const h = sim.playerById(q.coinHolder);
    if (!h || !h.alive) { q.coin = 'dropped'; q.coinHolder = null; sim.emit('coinDropped', {}); }
  }
}

// What to tell the player to do next (the HUD's objective line).
export function questObjective(sim) {
  const q = sim.quest;
  if (!q) return null;
  switch (q.step) {
    case 'power': return `Restore power: throw the main breakers in the cafeteria and the science lab (${q.breakers.length}/${q.need.breakers})`;
    case 'trophy':
      if (q.trophyPlaced) return 'Something is moving under the gym floor...';
      if (q.pieces.length < q.need.pieces) return `Find the pieces of the championship trophy (${q.pieces.length}/${q.need.pieces})`;
      return 'Put the trophy back together at center court';
    case 'statue': return `Kill zombies by the mascot statue in the Quad to feed it (${q.statueSouls}/${q.need.souls})`;
    case 'coin': return 'Take the Dark Schnitz Coin from the statue';
    case 'altar': return 'Set the coin in the altar under the Press Box';
    case 'cladding': return 'The cladding is coming up...';
    case 'ritual': return 'Erik is exposed. Take back what he stole';
    default: return null;
  }
}
