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
const area = (r) => (r.rect[2] - r.rect[0]) * (r.rect[3] - r.rect[1]);

// A small binary heap of [priority, value].
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(k, v) {
    const a = this.a; a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

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

  invalidate() { this.cache.clear(); this.toward = new Map(); this.reach = new Map(); }

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
      // a tie: the higher floor you're up on, else the smaller (more particular) place
      // (floors within a centimetre are the same floor: the ground's heights are float32)
      const same = best && Math.abs(r.y0 - best.y0) < 0.01;
      if (s < bs || (s === bs && best && ((!same && r.y0 > best.y0 && r.y0 <= y + 0.6) || (same && area(r) < area(best))))) { bs = s; best = r; }
    }
    if (!best) return fallback;
    // (nowhere near anything here: a ledge's edge, mid-fall; keep to where you were)
    if (bs > 3 && fallback) return fallback;
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
    if (a === b) return null;
    // a big map (Call of the Crust: thousands of places) searches back from
    // the target once for everyone; a small one searches from each zombie
    if (this.regions.length > 400) return this.towards(b, drops).get(a) || null;
    return this.searchFrom(a, b, drops);
  }
  searchFrom(a, b, drops = false) {
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

  // For every region that can get to b: the portal to take first. One search
  // backwards from b serves every zombie heading there (they all chase the
  // same few players).
  towards(b, drops = false) {
    if (!this.toward) this.toward = new Map();
    const key = b + (drops ? '!' : '');
    let res = this.toward.get(key);
    if (res) return res;
    res = new Map();
    // the portals into each region (the reverse of `out`)
    if (!this.into) {
      this.into = new Map(this.regions.map((r) => [r.id, []]));
      for (const p of this.portals) {
        if (this.into.has(p.b)) this.into.get(p.b).push(p);
        if (!p.oneWay && this.into.has(p.a)) this.into.get(p.a).push(p);
      }
    }
    const dist = new Map([[b, 0]]);
    const pos = new Map([[b, null]]);
    const done = new Set();
    const heap = new MinHeap();
    heap.push(0, b);
    while (heap.size) {
      const [d, cur] = heap.pop();
      if (done.has(cur) || d > dist.get(cur)) continue;
      done.add(cur);
      for (const p of this.into.get(cur) || []) {
        if (!this.portalOpen(p)) continue;
        if (p.drop && !drops) continue;
        const prev = p.oneWay ? p.a : (p.a === cur ? p.b : p.a);
        if (prev === cur || done.has(prev)) continue;
        const from = pos.get(cur);
        const step = from ? Math.hypot(from.x - p.x, from.z - p.z) : 0;
        const nd = d + step + 0.01 + (p.drop ? 2 : 0);
        if (!dist.has(prev) || nd < dist.get(prev)) {
          dist.set(prev, nd);
          pos.set(prev, { x: p.x, z: p.z });
          res.set(prev, p);
          heap.push(nd, prev);
        }
      }
    }
    this.toward.set(key, res);
    return res;
  }

  // Can you walk from region a to region b (through open doors; jumping down
  // ledges only if `drops`)?
  canReach(a, b, drops = false) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (!this.reach) this.reach = new Map();
    const key = a + (drops ? '!' : '');
    let set = this.reach.get(key);
    if (!set) {
      set = new Set([a]);
      const stack = [a];
      while (stack.length) {
        const cur = stack.pop();
        for (const p of this.out.get(cur) || []) {
          if (!this.portalOpen(p)) continue;
          if (p.drop && !drops) continue;
          const next = p.a === cur ? p.b : p.a;
          if (!set.has(next)) { set.add(next); stack.push(next); }
        }
      }
      this.reach.set(key, set);
    }
    return set.has(b);
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
