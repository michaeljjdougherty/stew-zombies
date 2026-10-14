// =============================================================================
// Shelling (Call of the Crust's Trench Front): stand up top in the open (the
// gun pits, the saps, no-man's-land once it's open) and the guns find you: a
// shell whistles in near you every second or two and goes off where you were.
// Down in the trenches you're safe. The field telephone in the fort calls a
// ceasefire for a while.
// =============================================================================
import { explode } from './projectiles.js';

export function createShelling(sim) {
  const m = sim.mapData;
  if (!m.shelled) return null;
  return { zones: new Set(m.shelled), next: new Map(), pending: [], ceasefireUntil: 0, lineDeadUntil: 0 };
}

export function updateShelling(sim, dt) {
  const S = sim.shelling;
  if (!S) return;
  const c = sim.cfg.crust.shelling;
  // (quiet while the Molten Fiend is up: every gun's on it)
  const quiet = sim.time < S.ceasefireUntil || !!(sim.crustEgg && sim.crustEgg.active === 'trench');
  if (S.wasQuiet && !quiet) sim.emit('ceasefireOver', {});
  S.wasQuiet = quiet;
  for (const p of sim.players) {
    if (!p.alive || p.launch || p.ride) { S.next.delete(p.id); continue; }
    const zone = sim.zoneOf(p.pos, p.region);
    if (quiet || !S.zones.has(zone)) { S.next.delete(p.id); continue; }
    if (!S.next.has(p.id)) S.next.set(p.id, sim.time + c.firstDelay);
    if (sim.time < S.next.get(p.id)) continue;
    S.next.set(p.id, sim.time + sim.rng.range(c.every[0], c.every[1]));
    // aimed where you're heading, give or take
    const a = sim.rng.range(0, Math.PI * 2), r = sim.rng.range(0, c.spread);
    const pos = { x: p.pos.x + p.vel.x * c.warn * c.lead + Math.cos(a) * r, y: p.pos.y + 0.1, z: p.pos.z + p.vel.z * c.warn * c.lead + Math.sin(a) * r };
    S.pending.push({ pos, at: sim.time + c.warn });
    sim.emit('shellIncoming', { pos: { ...pos }, warn: c.warn });
  }
  for (let i = S.pending.length - 1; i >= 0; i--) {
    const sh = S.pending[i];
    if (sim.time < sh.at) continue;
    S.pending.splice(i, 1);
    explode(sim, sh.pos, 'shell', null);
    for (const q of sim.players) {
      if (!q.alive || q.launch) continue;
      const d = Math.hypot(q.pos.x - sh.pos.x, q.pos.y + 1 - sh.pos.y, q.pos.z - sh.pos.z);
      if (d < c.radius) sim.damagePlayer(q, c.damage * (1 - d / c.radius), { pos: { x: sh.pos.x, z: sh.pos.z } });
    }
  }
}

// The field telephone: pay for a ceasefire.
export class CeasefireInteractable {
  constructor(spec) {
    this.spec = spec;
    this.id = 'use_ceasefire';
    this.kind = 'ceasefire';
    this.requireLook = true;
    this.pos = { ...spec.pos };
    this.stand = { x: spec.pos.x + spec.normal.x * 0.6, z: spec.pos.z + spec.normal.z * 0.6 };
  }
  get range() { return 1.6; }
  distanceTo(sim, p) { return Math.hypot(p.pos.x - this.stand.x, p.pos.z - this.stand.z); }
  canUse(sim, p) { return p.alive && !!sim.shelling; }
  cost(sim) { return sim.mode === 'explore' ? 0 : sim.cfg.crust.shelling.ceasefireCost; }
  prompt(sim) {
    const S = sim.shelling;
    if (sim.time < S.ceasefireUntil) return { text: `Ceasefire: ${Math.ceil(S.ceasefireUntil - sim.time)}s left`, cost: null };
    if (sim.time < S.lineDeadUntil) return { text: `The line's dead (${Math.ceil(S.lineDeadUntil - sim.time)}s)`, cost: null };
    return { text: 'Press [F] to call a ceasefire', cost: this.cost(sim) };
  }
  use(sim, p, cmd) {
    const S = sim.shelling, c = sim.cfg.crust.shelling;
    if (!cmd.usePressed || sim.time < S.lineDeadUntil) return;
    const cost = this.cost(sim);
    if (p.points < cost) { sim.emit('cantAfford', { playerId: p.id, cost }); return; }
    sim.spendPoints(p, cost);
    S.ceasefireUntil = sim.time + c.ceasefire;
    S.lineDeadUntil = S.ceasefireUntil + c.cooldown;
    S.pending.length = 0;
    sim.emit('ceasefire', { playerId: p.id, time: c.ceasefire });
  }
}
