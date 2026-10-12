// =============================================================================
// Navigation: the map is split into rectangular regions (rooms, the stage...)
// joined by portals (doorways, debris openings, stairs). Inside a region
// zombies walk straight at their target; between regions they head for the
// next portal on the shortest open route. Closed doors block their portal.
//
// Regions can sit at different heights (y0..y1: a catwalk over a pit, the
// second floor of a fort, the flights of a spiral stair): the one you're in is
// the one under your feet. Some portals only go one way: a ledge you can jump
// down from (a drop). Only some zombies will take a drop; the rest go round.
// =============================================================================

const BUCKET = 6;

export class Nav {
  constructor(sim) {
    this.sim = sim;
    this.regions = sim.world.navRegions.map((r) => ({ y0: 0, y1: 0, ...r }));
    this.byId = new Map(this.regions.map((r) => [r.id, r]));
    this.portals = sim.world.portals.map((p) => ({ ...p }));
    this.cache = new Map();
    // portals out of each region (a drop only leads out of its upper side)
    this.out = new Map(this.regions.map((r) => [r.id, []]));
    for (const p of this.portals) {
      if (this.out.has(p.a)) this.out.get(p.a).push(p);
      if (!p.oneWay && this.out.has(p.b)) this.out.get(p.b).push(p);
    }
    // buckets over the ground, so finding the region under you is quick
    this.buckets = new Map();
    for (const r of this.regions) {
      const [x0, z0, x1, z1] = r.rect;
      for (let i = Math.floor(x0 / BUCKET); i <= Math.floor(x1 / BUCKET); i++) {
        for (let k = Math.floor(z0 / BUCKET); k <= Math.floor(z1 / BUCKET); k++) {
          const key = i * 100003 + k;
          if (!this.buckets.has(key)) this.buckets.set(key, []);
          this.buckets.get(key).push(r);
        }
      }
    }
  }

  invalidate() { this.cache.clear(); }

  regionAt(p, fallback = null) {
    const key = Math.floor(p.x / BUCKET) * 100003 + Math.floor(p.z / BUCKET);
    const list = this.buckets.get(key);
    if (!list) return fallback;
    const y = p.y ?? 0;
    let best = null, bs = Infinity;
    for (const r of list) {
      const [x0, z0, x1, z1] = r.rect;
      if (!(p.x >= x0 - 0.05 && p.x <= x1 + 0.05 && p.z >= z0 - 0.05 && p.z <= z1 + 0.05)) continue;
      // how far your feet are from this region's floor
      const s = y < r.y0 - 0.6 ? (r.y0 - y) * 2 : y > r.y1 + 0.6 ? y - r.y1 : 0;
      if (s < bs || (s === bs && best && r.y0 > best.y0 && r.y0 <= y + 0.6)) { bs = s; best = r; }
    }
    if (!best) return fallback;
    return best.id;
  }

  roomOfRegion(id) {
    const r = this.byId.get(id);
    return r ? r.room : null;
  }

  portalOpen(p) { return !p.door || this.sim.doorOpen(p.door); }

  // First portal on the shortest open route from region a to region b (null if none).
  // drops: may this walker jump down ledges?
  firstPortal(a, b, drops = false) {
    const key = a + '>' + b + (drops ? '!' : '');
    if (this.cache.has(key)) return this.cache.get(key);
    const dist = new Map([[a, 0]]);
    const first = new Map([[a, null]]);
    const pos = new Map([[a, null]]);
    const done = new Set();
    const open = [a];
    while (open.length) {
      // (a small open list: pick the nearest by hand)
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (dist.get(open[i]) < dist.get(open[bi])) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      if (done.has(cur)) continue;
      done.add(cur);
      if (cur === b) break;
      for (const p of this.out.get(cur) || []) {
        if (!this.portalOpen(p)) continue;
        if (p.drop && !drops) continue;
        const next = p.a === cur ? p.b : p.a;
        if (done.has(next)) continue;
        const from = pos.get(cur);
        const step = from ? Math.hypot(from.x - p.x, from.z - p.z) : 0;
        const nd = dist.get(cur) + step + 0.01 + (p.drop ? 2 : 0);
        if (!dist.has(next) || nd < dist.get(next)) {
          dist.set(next, nd);
          pos.set(next, { x: p.x, z: p.z });
          first.set(next, first.get(cur) || p);
          open.push(next);
        }
      }
    }
    const res = first.get(b) || null;
    this.cache.set(key, res);
    return res;
  }

  // Where an agent in `region` at `from` should walk to reach `to` (in `toRegion`).
  nextPoint(from, region, to, toRegion, drops = false) {
    if (!region || !toRegion || region === toRegion) return to;
    const p = this.firstPortal(region, toRegion, drops);
    if (!p) return to;
    const k = p.axis;                 // axis we cross along
    const other = k === 'x' ? 'z' : 'x';
    // direction of travel through it: toward the far region, wherever we are
    // (an agent standing in the doorway itself must keep going, not turn back)
    const next = p.a === region ? p.b : p.a;
    const nr = this.byId.get(next);
    const nc = k === 'x' ? (nr.rect[0] + nr.rect[2]) / 2 : (nr.rect[1] + nr.rect[3]) / 2;
    const s = p.dirAB != null ? (p.a === region ? p.dirAB : -p.dirAB) : (Math.sign(nc - p[k]) || 1);
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
