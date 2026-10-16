// =============================================================================
// The void (Call of the Crust): the islands float in space. Step off an edge
// and you fall for good: in co-op you're out until the next round, solo it's
// the end. (Explore mode drops you back where you last stood.) Zombies that
// go over come back as new ones.
// =============================================================================
import { loseAllPerks } from './perks.js';

export function updateVoid(sim) {
  const V = sim.cfg.crust.voidY;
  for (const p of sim.players) {
    if (!p.alive || p.launch || p.ride) continue;
    // remember the last solid ground under you
    // (on the map's walkable ground: not a ledge you were thrown onto out of bounds)
    if (p.grounded && !p.downed && p.region != null) p.safePos = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
    if (p.pos.y > V) continue;
    if (sim.godMode || sim.mode === 'explore') {
      const s = p.safePos || sim.mapData.playerSpawns[0];
      p.pos.x = s.x; p.pos.y = (s.y || 0) + 0.5; p.pos.z = s.z;
      p.vel.x = p.vel.y = p.vel.z = 0;
      p.region = sim.nav.regionAt(p.pos);
      p.tp = (p.tp || 0) + 1;
      sim.emit('playerFell', { playerId: p.id, saved: true });
      continue;
    }
    p.alive = false;
    p.health = 0;
    p.downed = null;
    loseAllPerks(sim, p);
    sim.emit('playerFell', { playerId: p.id });
    sim.emit('playerDown', { playerId: p.id, final: true });
    sim.emit('playerDied', { playerId: p.id, fell: true });
  }
  for (const z of sim.zombies) {
    if (z.state === 'dead' || z.pos.y > V) continue;
    z.state = 'dead';
    sim.emit('zombieRemoved', { id: z.id });
    if (sim.rounds.phase === 'active' && !sim.rounds.cheddar) sim.rounds.toSpawn++;
  }
}
