// =============================================================================
// The boiler room's stew cauldron. Three red valves feed it from the boiler;
// shoot all three open and the stew boils over: points for everyone and a
// power-up. Once per game.
// =============================================================================
import { spawnPowerup } from './powerups.js';

export function createCauldron(sim) {
  const c = sim.mapData.cauldron;
  if (!c) return null;
  return { valves: Object.fromEntries(c.valves.map((v) => [v.id, false])), boiled: false };
}

// Valves still shut: things a bullet can hit.
export function cauldronTargets(sim) {
  const st = sim.cauldron, c = sim.mapData.cauldron;
  if (!st || st.boiled) return [];
  return c.valves.filter((v) => !st.valves[v.id]).map((v) => ({ id: v.id, c: { x: v.x, y: v.y, z: v.z }, r: 0.2 }));
}

export const isValve = (id) => typeof id === 'string' && id.startsWith('valve');

export function cauldronShot(sim, id, p) {
  const st = sim.cauldron, c = sim.mapData.cauldron;
  if (!st || st.boiled || !(id in st.valves) || st.valves[id]) return;
  st.valves[id] = true;
  const count = Object.values(st.valves).filter(Boolean).length, total = c.valves.length;
  const v = c.valves.find((q) => q.id === id);
  sim.emit('valveTurned', { id, count, total, playerId: p ? p.id : null, pos: { x: v.x, y: v.y, z: v.z } });
  if (count < total) return;
  st.boiled = true;
  const cfg = sim.cfg.cauldron;
  for (const q of sim.players) {
    if (!q.alive) continue;
    q.points += cfg.points;
    sim.emit('points', { playerId: q.id, amount: cfg.points, reason: 'cauldron', total: q.points });
  }
  sim.emit('cauldronBoil', { pos: { x: c.x, y: 1.1, z: c.z } });
  spawnPowerup(sim, cfg.powerup, { x: c.x + c.drop[0], y: 0, z: c.z + c.drop[1] });
}
