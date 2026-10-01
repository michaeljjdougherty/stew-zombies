// =============================================================================
// Navigation: the map is split into rectangular regions (rooms, the stage...)
// joined by portals (doorways, debris openings, stairs). Inside a region
// zombies walk straight at their target; between regions they head for the
// next portal on the shortest open route. Closed doors block their portal.
// =============================================================================

export class Nav {
  constructor(sim) {
    this.sim = sim;
    this.regions = sim.world.navRegions;
    this.portals = sim.world.portals.map((p) => ({ ...p }));
    this.cache = new Map();
  }

  invalidate() { this.cache.clear(); }

  regionAt(p, fallback = null) {
    for (const r of this.regions) {
      const [x0, z0, x1, z1] = r.rect;
      if (p.x >= x0 - 0.05 && p.x <= x1 + 0.05 && p.z >= z0 - 0.05 && p.z <= z1 + 0.05) return r.id;
    }
    return fallback;
  }

  roomOfRegion(id) {
    const r = this.regions.find((q) => q.id === id);
    return r ? r.room : null;
  }

  portalOpen(p) { return !p.door || this.sim.doorOpen(p.door); }

  // First portal on the shortest open route from region a to region b (null if none).
  firstPortal(a, b) {
    const key = a + '>' + b;
    if (this.cache.has(key)) return this.cache.get(key);
    // Dijkstra over portal-to-portal distances (small graph)
    const dist = new Map([[a, 0]]);
    const first = new Map([[a, null]]);
    const pos = new Map([[a, null]]);
    const open = [a];
    while (open.length) {
      open.sort((x, y) => dist.get(x) - dist.get(y));
      const cur = open.shift();
      if (cur === b) break;
      for (const p of this.portals) {
        if (!this.portalOpen(p)) continue;
        let next = null;
        if (p.a === cur) next = p.b; else if (p.b === cur) next = p.a;
        if (!next) continue;
        const from = pos.get(cur);
        const step = from ? Math.hypot(from.x - p.x, from.z - p.z) : 0;
        const nd = dist.get(cur) + step + 0.01;
        if (!dist.has(next) || nd < dist.get(next)) {
          dist.set(next, nd);
          pos.set(next, { x: p.x, z: p.z });
          first.set(next, first.get(cur) || p);
          if (!open.includes(next)) open.push(next);
        }
      }
    }
    const res = first.get(b) || null;
    this.cache.set(key, res);
    return res;
  }

  // Where an agent in `region` at `from` should walk to reach `to` (in `toRegion`).
  nextPoint(from, region, to, toRegion) {
    if (!region || !toRegion || region === toRegion) return to;
    const p = this.firstPortal(region, toRegion);
    if (!p) return to;
    const k = p.axis;                 // axis we cross along
    const other = k === 'x' ? 'z' : 'x';
    const s = Math.sign(p[k] - from[k]) || 1; // direction of travel through it
    const reach = this.sim.cfg.zombie.portalReach;
    const lateral = Math.abs(from[other] - p[other]);
    const along = Math.abs(from[k] - p[k]);
    // line up with the opening first, then push through
    const half = Math.max(0.2, p.width / 2 - 0.45);
    const target = { x: p.x, z: p.z };
    target[other] = p[other] + Math.max(-half, Math.min(half, from[other] - p[other]));
    if (along < reach && lateral < half + 0.2) {
      target[k] = p[k] + s * 1.3;
      return target;
    }
    target[k] = p[k] - s * 0.6;
    return target;
  }
}
