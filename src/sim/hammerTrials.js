// =============================================================================
// The War Hammers' trials (Call of the Crust). Pit won't temper a hammer for
// points: like the Origins staffs, each element earns its "+" on its own
// island. Whoever's holding that element's hammer does its trial, then hands
// the hammer to Pit, who tempers it for free.
//
//   Wind       three buoys float off the Ship Graveyard's north shore, out over
//              the void. Hit each one with the Wind Hammer's gale.
//   Lightning  charge every tesla coil at the Research Base inside the time
//              limit (the first one charged starts the clock), then slam the
//              hammer down next to a charged coil.
//   Ice        freeze or smash zombies with the Ice Hammer in the Ice Caves,
//              then smash the ice shrine on the summit where the Golem slept.
//   Fire       carry the Fire Hammer through the Trench Front's burning
//              craters without going down. Pit quenches it.
//
// Plain data in sim.crustEgg.trials (an online host sends it with the rest).
// Numbers: CONFIG.crust.trials.
// =============================================================================
import { groundHeight } from './physics.js';
import { HAMMER_ELEMENTS, HAMMER_IDS } from './hammers.js';
import { pitSay } from './forge.js';

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const up = (p) => p && p.alive && !p.downed;
const baseId = (id) => (id && id.endsWith('+') ? id.slice(0, -1) : id);

// Pit's lines for them
export const PIT_TRIALS = {
  open: {
    wind: "The Wind Hammer won't get spicy for free, man. There's buoys floating off the Ship Graveyard. Go knock 'em around.",
    lightning: "Lightning Hammer wants juice. Charge every coil at the Research Base, fast, then slam it down by one.",
    ice: "Ice Hammer needs to get cold. Freeze a bunch of 'em in the Ice Caves, then smash the shrine where the Golem was sleeping.",
    fire: "Fire Hammer's gotta get hot. Walk it through the burning craters on the Trench Front. Don't go down.",
  },
  done: {
    wind: "The wind's in it now. Bring it here, man.",
    lightning: "It's humming. Bring it to me before it zaps somebody.",
    ice: "It's freezing. Like actually. Bring it back.",
    fire: "It's glowing. Bring it here and I'll quench it.",
  },
  failed: {
    lightning: "Too slow, man. The coils went dead. Start over.",
    fire: "You went down. The fire went out. Do it again.",
  },
};

export function createTrials(sim, E) {
  const m = sim.mapData;
  if (!m.forge || !E) return null;
  const c = sim.cfg.crust.trials;
  const T = {};
  for (const el of HAMMER_ELEMENTS) T[el] = { state: 'locked' };
  // the buoys: out over the void, a few metres off the north shore
  const lists = [sim.world.solids, sim.world.terrain];
  const shore = (E.shipLand || []).filter((g) => groundHeight(g.x, g.z - c.wind.out, 0.3, 60, lists) < -100).sort((a, b) => a.x - b.x);
  const pick = shore.length >= 3 ? [shore[0], shore[Math.floor(shore.length / 2)], shore[shore.length - 1]] : shore;
  T.wind.buoys = pick.map((g, i) => ({ id: 'buoy' + i, x: g.x, y: g.y + c.wind.height, z: g.z - c.wind.out, hit: false }));
  // the craters on the Trench Front
  const tr = m.islands.find((i) => i.id === 'trench');
  T.fire.craters = (m.craters || []).filter((k) => !tr || (k.x >= tr.bounds[0] && k.x <= tr.bounds[2] && k.z >= tr.bounds[1] && k.z <= tr.bounds[3])).map((k, i) => ({ id: 'crater' + i, x: k.x, y: k.y, z: k.z, r: k.r, lit: false }));
  // the ice shrine: where the Golem slept
  const g = m.titans.find((t) => t.id === 'caves');
  T.ice.shrine = g ? { x: g.wake.x, y: g.wake.y, z: g.wake.z } : null;
  T.ice.count = 0;
  T.lightning.until = 0;
  return T;
}

const trialsOf = (sim) => sim.crustEgg && sim.crustEgg.trials;
const holder = (sim, el) => { const F = sim.crustEgg.forge; return F && F.hammers[el].by ? sim.playerById(F.hammers[el].by) : null; };
// is this player holding (in hand) the untempered hammer of this element?
function inHand(sim, p, el) {
  const s = p.loadout.slots[p.loadout.current];
  return !!s && !s.away && s.id === HAMMER_IDS[el];
}
// does this player carry it at all (in hand or on their back)?
function carries(p, el) { return p.loadout.slots.some((s) => !s.away && baseId(s.id) === HAMMER_IDS[el]); }

function finish(sim, el) {
  const t = trialsOf(sim)[el];
  t.state = 'done';
  sim.emit('trialDone', { element: el });
  sayPit(sim, PIT_TRIALS.done[el]);
}
const sayPit = (sim, text) => pitSay(sim, text, 0.6);

// Each step: open a trial once its hammer's forged; the clock on the coils; the craters.
export function updateTrials(sim) {
  const T = trialsOf(sim), E = sim.crustEgg, F = E && E.forge;
  if (!T || !F) return;
  const c = sim.cfg.crust.trials;
  for (const el of HAMMER_ELEMENTS) {
    const t = T[el];
    if (t.state === 'locked' && F.hammers[el].forged) {
      t.state = F.hammers[el].tempered ? 'done' : 'open';
      if (t.state === 'open') { sim.emit('trialOpen', { element: el }); sayPit(sim, PIT_TRIALS.open[el]); }
    }
  }
  // the coils: run out of time and they go dead
  const L = T.lightning;
  if (L.state === 'open' && L.until && sim.time > L.until && !E.coils.every((k) => k.ready)) {
    for (const k of E.coils) { k.ready = false; k.charge = 0; }
    L.until = 0;
    sim.emit('trialFailed', { element: 'lightning' });
    sayPit(sim, PIT_TRIALS.failed.lightning);
  }
  if (L.state === 'open' && !L.until && E.coils.some((k) => k.ready) && !E.active) L.until = sim.time + c.lightning.time;
  // the craters: walk the Fire Hammer through them; go down and they go out
  const R = T.fire;
  if (R.state === 'open') {
    const p = holder(sim, 'fire');
    const lit = R.craters.filter((k) => k.lit).length;
    if (lit && (!p || !p.alive || p.downed || !carries(p, 'fire'))) {
      for (const k of R.craters) k.lit = false;
      sim.emit('trialFailed', { element: 'fire' });
      if (p && p.downed) sayPit(sim, PIT_TRIALS.failed.fire);
    } else if (up(p)) {
      for (const k of R.craters) {
        if (k.lit || flat(p.pos, k) > k.r + c.fire.margin || Math.abs(p.pos.y - k.y) > 3) continue;
        k.lit = true;
        const n = R.craters.filter((q) => q.lit).length;
        sim.emit('trialStep', { element: 'fire', id: k.id, n, of: c.fire.craters, pos: { x: k.x, y: k.y, z: k.z } });
        if (n >= c.fire.craters) finish(sim, 'fire');
        break;
      }
    }
  }
}

// A swing of an elemental War Hammer landed (hammers.js): does it count for its trial?
export function trialSlam(sim, p, el, land, dir, info) {
  const T = trialsOf(sim);
  if (!T || !T[el] || T[el].state !== 'open') return;
  const t = T[el], c = sim.cfg.crust.trials;
  if (el === 'wind') {
    const H = sim.cfg.crust.hammers, reach = H.reach + H.tempered.wind.range * H.elementK + c.wind.slack, cosA = Math.cos(c.wind.angle * Math.PI / 180);
    for (const b of t.buoys) {
      if (b.hit) continue;
      const dx = b.x - p.pos.x, dz = b.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > reach || Math.abs(b.y - p.pos.y) > c.wind.reachUp || (d > 1 && (dx * dir.x + dz * dir.z) / d < cosA)) continue;
      b.hit = true;
      const n = t.buoys.filter((q) => q.hit).length;
      sim.emit('trialStep', { element: 'wind', id: b.id, n, of: t.buoys.length, pos: { x: b.x, y: b.y, z: b.z } });
      if (n >= t.buoys.length) { finish(sim, 'wind'); return; }
    }
  } else if (el === 'lightning') {
    const E = sim.crustEgg;
    if (!E.coils.length || !E.coils.every((k) => k.ready)) return;
    if (!E.coils.some((k) => flat(k, land) < c.lightning.near || flat(k, p.pos) < c.lightning.near)) return;
    for (const k of E.coils) { k.ready = false; k.charge = 0; }
    t.until = 0;
    finish(sim, 'lightning');
  } else if (el === 'ice') {
    if (t.count < c.ice.count) {
      if (!onIsland(sim, p.pos, 'caves')) return;
      const was = t.count;
      t.count = Math.min(c.ice.count, t.count + (info.smashed || 0) + (info.frozen || 0));
      if (t.count > was) sim.emit('trialStep', { element: 'ice', n: t.count, of: c.ice.count, pos: { ...land } });
      return;
    }
    if (t.shrine && (flat(land, t.shrine) < c.ice.near || flat(p.pos, t.shrine) < c.ice.near) && Math.abs(p.pos.y - t.shrine.y) < 3) finish(sim, 'ice');
  }
}

function onIsland(sim, pos, id) {
  const I = sim.mapData.islands.find((i) => i.id === id);
  if (!I) return false;
  const [x0, z0, x1, z1] = I.bounds;
  return pos.x >= x0 && pos.x <= x1 && pos.z >= z0 && pos.z <= z1;
}

// Can the coils be charged now (no Warden fight, but the Lightning trial's on)?
export const coilsForTrial = (sim) => { const T = trialsOf(sim); return !!T && T.lightning.state === 'open' && !!holder(sim, 'lightning') && !sim.crustEgg.active; };

export const trialDone = (sim, el) => { const T = trialsOf(sim); return !T || !T[el] || T[el].state === 'done'; };

// The HUD's line for the hammer you're holding
export function trialObjective(sim, p) {
  const T = trialsOf(sim);
  if (!T || !p) return null;
  const c = sim.cfg.crust.trials;
  for (const el of HAMMER_ELEMENTS) {
    const t = T[el];
    if (t.state === 'locked' || !carries(p, el) || p.loadout.slots.some((s) => s.id === HAMMER_IDS[el] + '+')) continue;
    if (t.state === 'done') return `Take the ${HAMMER_IDS[el]} to Pit to be tempered`;
    if (el === 'wind') return `Hit the buoys off the Ship Graveyard's north shore with the Wind Hammer · ${t.buoys.filter((b) => b.hit).length} of ${t.buoys.length}`;
    if (el === 'lightning') {
      const E = sim.crustEgg, n = E.coils.filter((k) => k.ready).length;
      if (n === E.coils.length) return 'Slam the Lightning Hammer down by a charged tesla coil';
      return `Charge every tesla coil at the Research Base · ${n} of ${E.coils.length}${t.until ? ` · ${Math.max(0, Math.ceil(t.until - sim.time))}s` : ''}`;
    }
    if (el === 'ice') return t.count < c.ice.count ? `Freeze zombies with the Ice Hammer in the Ice Caves · ${t.count} of ${c.ice.count}` : 'Smash the ice shrine on the summit where the Golem slept';
    if (el === 'fire') return `Carry the Fire Hammer through the Trench Front's burning craters · ${t.craters.filter((k) => k.lit).length} of ${c.fire.craters}`;
  }
  return null;
}

// What Pit says at the bench when you bring him a hammer that hasn't done its trial
export function trialHint(sim, el) {
  return {
    wind: 'Hit the three buoys off the Ship Graveyard shore with it',
    lightning: 'Charge every tesla coil at the Research Base in time, then slam it down by one',
    ice: `Freeze ${sim.cfg.crust.trials.ice.count} zombies with it in the Ice Caves, then smash the shrine`,
    fire: `Carry it through ${sim.cfg.crust.trials.fire.craters} of the Trench Front's burning craters without going down`,
  }[el];
}
