// =============================================================================
// Sculpted ground (Call of the Crust). Each island is a grid of 1 m cells, each
// with a height: rock rising out of the frozen sea, the ground you walk on at
// different levels, ramps between them, trenches dug down into it, caves
// under a rock ceiling. From that grid come the collision boxes (one per run
// of cells of equal height), the nav regions (rectangles of cells you can walk
// straight across) and the portals between them, including one-way drops off
// a ledge. Raised structures (catwalks, decks, stairs, spiral stairs) are
// added on top with their own boxes and regions.
// Pure JS (no three.js): the simulation and the renderer both read it.
// =============================================================================
import { CONFIG } from '../config.js';

// SEA: the frozen sea (you can't go there). ROCK: cliffs, mountain, too steep
// to walk. GROUND: where you walk. ROOM: under a building (its own floor).
// BLOCK: ground the nav treats as a wall (under a debris pile you pay to clear).
export const K = { SEA: 0, ROCK: 1, GROUND: 2, ROOM: 3, BLOCK: 4 };
export const STEP = 0.45;   // the biggest rise you can walk up (zombies 0.5, players 0.48)
export const DROP_MAX = 12; // ledges higher than this aren't something you jump off
const FENCE = 3.5;          // how high the invisible edge reaches over the ground beside it
const { drop: RAIL_DROP, h: RAIL_H, t: RAIL_T } = CONFIG.crust.rails;
const EDGES = [[1, 0, 1], [-1, 0, 2], [0, 1, 4], [0, -1, 8]];

// --- shapes: (x, z) => inside? ----------------------------------------------------------
export const wobble = (x, z, amp, freq = 0.35) => amp * (Math.sin(x * freq + Math.cos(z * freq * 0.7) * 1.7) * 0.6 + Math.sin(z * freq * 1.3 - x * freq * 0.4) * 0.4);
export const shape = {
  rect: (x0, z0, x1, z1) => (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1,
  circle: (cx, cz, r, jag = 0) => (x, z) => Math.hypot(x - cx, z - cz) <= r + (jag ? wobble(x, z, jag) : 0),
  ring: (cx, cz, r0, r1, jag = 0) => (x, z) => { const d = Math.hypot(x - cx, z - cz), j = jag ? wobble(x, z, jag) : 0; return d >= r0 + j && d <= r1 + j; },
  ellipse: (cx, cz, rx, rz, jag = 0) => (x, z) => Math.hypot((x - cx) / rx, (z - cz) / rz) <= 1 + (jag ? wobble(x, z, jag) / Math.max(rx, rz) : 0),
  // a polygon (points [[x, z], ...]), edges roughened by `jag` metres
  poly: (pts, jag = 0) => (x, z) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, zi] = pts[i], [xj, zj] = pts[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    if (!jag) return inside;
    const d = distToPoly(pts, x, z);
    if (d > jag) return inside;
    const w = wobble(x, z, jag);
    return inside ? d > -w : d < w;
  },
  // a band along a polyline (a trench, a path), `w` wide
  path: (pts, w, jag = 0) => (x, z) => distToLine(pts, x, z).d <= w / 2 + (jag ? wobble(x, z, jag, 0.6) : 0),
  // a wedge of a ring between two angles (degrees; 0 = +x, 90 = +z)
  arc: (cx, cz, r0, r1, a0, a1, jag = 0) => (x, z) => {
    const d = Math.hypot(x - cx, z - cz), j = jag ? wobble(x, z, jag) : 0;
    if (d < r0 + j || d > r1 + j) return false;
    return angleIn(Math.atan2(z - cz, x - cx) * 180 / Math.PI, a0, a1);
  },
  not: (f) => (x, z) => !f(x, z),
  and: (...fs) => (x, z) => fs.every((f) => f(x, z)),
  or: (...fs) => (x, z) => fs.some((f) => f(x, z)),
};
export function angleIn(a, a0, a1) {
  const n = (v) => ((v % 360) + 360) % 360;
  const s = n(a - a0), e = n(a1 - a0);
  return s <= e;
}
// Points along an arc (for ramps that wind round a pit): [[x, z, h], ...]
export function arcPts(cx, cz, r, a0, a1, h0, h1, step = 8) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step) + 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), a = (a0 + (a1 - a0) * t) * Math.PI / 180;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, h0 + (h1 - h0) * t]);
  }
  return out;
}
function distToPoly(pts, x, z) {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    d = Math.min(d, segDist(a[0], a[1], b[0], b[1], x, z).d);
  }
  return d;
}
function segDist(ax, az, bx, bz, x, z) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
  return { d: Math.hypot(x - (ax + dx * t), z - (az + dz * t)), t };
}
// Distance from a polyline, and how far along it (0..1 of total length).
export function distToLine(pts, x, z) {
  let best = { d: Infinity, s: 0 }, acc = 0;
  const lens = [];
  for (let i = 0; i < pts.length - 1; i++) lens.push(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < pts.length - 1; i++) {
    const r = segDist(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], x, z);
    if (r.d < best.d) best = { d: r.d, s: (acc + r.t * lens[i]) / total, seg: i, t: r.t };
    acc += lens[i];
  }
  return best;
}

// --- the grid ------------------------------------------------------------------------------
export class Terrain {
  constructor({ id, x0, z0, x1, z1, cell = 1 }) {
    this.id = id;
    this.cell = cell;
    this.x0 = Math.floor(x0); this.z0 = Math.floor(z0);
    this.nx = Math.ceil((x1 - this.x0) / cell); this.nz = Math.ceil((z1 - this.z0) / cell);
    const n = this.nx * this.nz;
    this.h = new Float32Array(n);          // top of the ground (or rock) in the cell
    this.kind = new Uint8Array(n);         // K.*
    this.mat = new Array(n).fill('snow');  // what it looks like on top
    this.zone = new Array(n).fill(null);
    this.ceil = new Float32Array(n);       // a cave's rock ceiling (0: open sky)
    this.smooth = new Uint8Array(n);       // ramps: drawn as a slope, not a step
    this.spawn = new Uint8Array(n);        // zombies may claw up here
    this.noFence = new Uint8Array(n);      // (under a deck that juts out over a cliff)
    this.rail = new Uint8Array(n);         // guard rails on the cell's edges (1 +x, 2 -x, 4 +z, 8 -z)
  }
  i(ix, iz) { return iz * this.nx + ix; }
  cx(ix) { return this.x0 + (ix + 0.5) * this.cell; }
  cz(iz) { return this.z0 + (iz + 0.5) * this.cell; }
  cellAt(x, z) { const ix = Math.floor((x - this.x0) / this.cell), iz = Math.floor((z - this.z0) / this.cell); return ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz ? -1 : this.i(ix, iz); }
  heightAt(x, z) { const c = this.cellAt(x, z); return c < 0 ? 0 : this.h[c]; }
  kindAt(x, z) { const c = this.cellAt(x, z); return c < 0 ? K.SEA : this.kind[c]; }
  contains(x, z) { return x >= this.x0 && z >= this.z0 && x < this.x0 + this.nx * this.cell && z < this.z0 + this.nz * this.cell; }

  // Paint every cell whose middle is inside `f`.
  //   h: a height, or (x, z, old) => height; add: raise by; max/min: clamp
  //   only: (cell kind) => paint this one?
  paint(f, { h, kind = K.GROUND, mat, zone, ceil, spawn, smooth, add, max, min, only } = {}) {
    for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
      const x = this.cx(ix), z = this.cz(iz);
      if (!f(x, z)) continue;
      const c = this.i(ix, iz);
      if (only && !only(this.kind[c], c)) continue;
      let hv = typeof h === 'function' ? h(x, z, this.h[c]) : h;
      if (add != null) hv = this.h[c] + add;
      if (hv != null) {
        if (max != null) hv = Math.min(hv, max);
        if (min != null) hv = Math.max(hv, min);
        this.h[c] = hv;
      }
      if (kind != null) this.kind[c] = kind;
      if (mat) this.mat[c] = mat;
      if (zone !== undefined) this.zone[c] = zone;
      if (ceil !== undefined) this.ceil[c] = ceil;
      if (spawn !== undefined) this.spawn[c] = spawn ? 1 : 0;
      else this.spawn[c] = this.kind[c] === K.GROUND ? 1 : 0;
      if (smooth !== undefined) this.smooth[c] = smooth ? 1 : 0;
      else this.smooth[c] = 0;
    }
  }

  // A ramp along a polyline: points [[x, z, h], ...], `w` wide; the height runs
  // along it.
  ramp(pts, w, opts = {}) {
    const flat = pts.map((p) => [p[0], p[1]]);
    const lens = []; for (let i = 0; i < pts.length - 1; i++) lens.push(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]));
    const total = lens.reduce((a, b) => a + b, 0);
    const hAt = (s) => {
      let acc = 0;
      for (let i = 0; i < lens.length; i++) {
        if (s * total <= acc + lens[i] || i === lens.length - 1) { const t = lens[i] ? Math.max(0, Math.min(1, (s * total - acc) / lens[i])) : 0; return pts[i][2] + (pts[i + 1][2] - pts[i][2]) * t; }
        acc += lens[i];
      }
      return pts[pts.length - 1][2];
    };
    // (round to a step so the ramp's cells merge into fewer boxes)
    const q = opts.quant ?? 0.05;
    this.paint((x, z) => distToLine(flat, x, z).d <= w / 2 + (opts.jag ? wobble(x, z, opts.jag, 0.7) : 0), { spawn: false, ...opts, smooth: opts.smooth ?? true, h: (x, z) => Math.round(hAt(distToLine(flat, x, z).s) / q) * q });
  }

  // The cells under a building: its floor height, not walked by the terrain's nav.
  building(rect, y, pad = 0.5) {
    const [x0, z0, x1, z1] = rect;
    this.paint(shape.rect(x0 - pad, z0 - pad, x1 + pad, z1 + pad), { h: y, kind: K.ROOM, spawn: false, smooth: false });
  }

  // A strip of ground the nav treats as a wall (a debris pile across a path:
  // the door's own portal is the way through). Cells within half a cell of the
  // line; only the ground ones (the rock either side stays rock).
  block(x, z, axis, len) {
    let n = 0;
    for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
      const cx = this.cx(ix), cz = this.cz(iz);
      if (axis === 'x' ? (Math.abs(cz - z) >= 0.5 || Math.abs(cx - x) > len / 2) : (Math.abs(cx - x) >= 0.5 || Math.abs(cz - z) > len / 2)) continue;
      const c = this.i(ix, iz);
      if (this.kind[c] !== K.GROUND) continue;
      this.kind[c] = K.BLOCK; this.spawn[c] = 0; n++;
    }
    return n;
  }

  // Fill one-cell holes left between shapes (you'd get stuck in them).
  fillPits() {
    for (let pass = 0; pass < 3; pass++) {
      for (let iz = 1; iz < this.nz - 1; iz++) for (let ix = 1; ix < this.nx - 1; ix++) {
        const c = this.i(ix, iz);
        if (this.kind[c] !== K.GROUND) continue;
        let lowest = Infinity, out = false;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = this.i(ix + dx, iz + dz);
          if (this.kind[n] === K.GROUND && this.h[n] - this.h[c] <= STEP) { out = true; break; }
          if (this.kind[n] === K.GROUND) lowest = Math.min(lowest, this.h[n]);
        }
        if (!out && lowest < Infinity) { this.h[c] = lowest; this.zone[c] = this.zone[c] ?? null; }
      }
    }
  }

  walkable(c) { return this.kind[c] === K.GROUND; }
  physWalk(c) { return this.kind[c] === K.GROUND || this.kind[c] === K.BLOCK; }

  // --- guard rails: along every ledge you'd fall more than `minDrop` off (and the
  // island's edge, over nothing), except where skip(x, z) says it's a place to dive
  guardRails(minDrop = RAIL_DROP, skip = () => false) {
    this.rail.fill(0);
    this.railRuns = null;
    for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
      const c = this.i(ix, iz);
      if (!this.walkable(c)) continue;
      for (const [dx, dz, bit] of EDGES) {
        const jx = ix + dx, jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= this.nx || jz >= this.nz) continue;
        const n = this.i(jx, jz);
        let drop;
        if (this.kind[n] === K.SEA) { if (!this.openEdges) continue; drop = Infinity; }
        else if (this.walkable(n)) drop = this.h[c] - this.h[n];
        else if (this.kind[n] === K.ROCK && this.noFence[n]) drop = this.h[c] - this.h[n];   // (a slope you'd tumble down)
        else continue;      // (rock: its invisible fence already stops you)
        if (drop < minDrop) continue;
        if (skip(this.cx(ix) + dx * this.cell / 2, this.cz(iz) + dz * this.cell / 2, this.h[c])) continue;
        this.rail[c] |= bit;
      }
    }
  }
  // The rails as runs along cell edges: { axis ('x': a line of constant x), line,
  // side (+1/-1: which way is the drop), a0, a1, ys: the ground's height at each cell }
  railRunList() {
    if (this.railRuns) return this.railRuns;
    const out = [];
    for (const [dx, dz, bit] of EDGES) {
      const alongX = dz !== 0;          // a rail on a ±z edge runs along x
      const nA = alongX ? this.nz : this.nx, nB = alongX ? this.nx : this.nz;
      for (let a = 0; a < nA; a++) {
        let run = null;
        const flush = () => { if (run) out.push(run); run = null; };
        for (let b = 0; b < nB; b++) {
          const ix = alongX ? b : a, iz = alongX ? a : b;
          const c = this.i(ix, iz);
          if (!(this.rail[c] & bit)) { flush(); continue; }
          const h = this.h[c];
          if (run && Math.abs(run.ys[run.ys.length - 1] - h) <= STEP + 0.05) { run.ys.push(h); run.a1 += this.cell; continue; }
          flush();
          const line = alongX ? this.z0 + (iz + (dz > 0 ? 1 : 0)) * this.cell : this.x0 + (ix + (dx > 0 ? 1 : 0)) * this.cell;
          const a0 = alongX ? this.x0 + ix * this.cell : this.z0 + iz * this.cell;
          run = { axis: alongX ? 'z' : 'x', line, side: dx + dz, a0, a1: a0 + this.cell, ys: [h] };
        }
        flush();
      }
    }
    this.railRuns = out;
    return out;
  }

  // --- collision boxes: runs of cells with the same top, merged into rectangles ----------------
  boxes() {
    const out = [];
    const q = (v) => Math.round(v * 20) / 20;
    const merge = (want, make) => {
      const used = new Uint8Array(this.nx * this.nz);
      for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
        const c = this.i(ix, iz);
        if (used[c]) continue;
        const key = want(c);
        if (key == null) { used[c] = 1; continue; }
        const same = (cc) => !used[cc] && want(cc) === key;
        let w = 1;
        while (ix + w < this.nx && same(this.i(ix + w, iz))) w++;
        let d = 1;
        grow: while (iz + d < this.nz) {
          for (let k = 0; k < w; k++) if (!same(this.i(ix + k, iz + d))) break grow;
          d++;
        }
        for (let r = 0; r < d; r++) for (let k = 0; k < w; k++) used[this.i(ix + k, iz + r)] = 1;
        out.push(make(key, this.x0 + ix * this.cell, this.z0 + iz * this.cell, this.x0 + (ix + w) * this.cell, this.z0 + (iz + d) * this.cell, c));
      }
    };
    // the ground and the rock
    merge((c) => {
      if (this.kind[c] === K.SEA) return null;
      return (this.kind[c] === K.ROCK ? 'r' : 'g') + q(this.h[c]);
    }, (key, x0, z0, x1, z1) => ({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: -1, maxY: +key.slice(1), kind: key[0] === 'r' ? 'rock' : 'ground', terrain: this.id }));
    // cave ceilings: the rock overhead
    merge((c) => (this.ceil[c] > 0 && this.kind[c] !== K.ROCK ? q(this.ceil[c]) : null),
      (key, x0, z0, x1, z1) => ({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: key, maxY: key + 6, kind: 'rock', ceiling: true, terrain: this.id }));
    // invisible edges: where walkable ground meets the sea or a drop into rock,
    // a wall you can't climb or jump over
    const need = new Float32Array(this.nx * this.nz).fill(-1);
    for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
      const c = this.i(ix, iz);
      const k = this.kind[c];
      if ((k !== K.SEA && k !== K.ROCK) || this.noFence[c]) continue;
      if (k === K.SEA && this.openEdges) continue;   // (an edge you can walk off)
      const top = k === K.SEA ? 0 : this.h[c];
      let want = -1;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const jx = ix + dx, jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= this.nx || jz >= this.nz) continue;
        const n = this.i(jx, jz);
        if (this.physWalk(n)) want = Math.max(want, this.h[n] + FENCE);
      }
      if (want > top + 0.05) need[c] = q(want);
    }
    merge((c) => (need[c] > 0 ? need[c] : null),
      (key, x0, z0, x1, z1) => ({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: -1, maxY: key, kind: 'shore', ghost: true, terrain: this.id }));
    // the guard rails (a box per level stretch of each run)
    for (const r of this.railRunList()) {
      let k0 = 0;
      for (let k = 1; k <= r.ys.length; k++) {
        if (k < r.ys.length && Math.abs(r.ys[k] - r.ys[k0]) < 0.06) continue;
        const a0 = r.a0 + k0 * this.cell, a1 = r.a0 + k * this.cell, y = Math.max(...r.ys.slice(k0, k));
        const l0 = r.side > 0 ? r.line - RAIL_T : r.line, l1 = r.side > 0 ? r.line : r.line + RAIL_T;
        out.push(r.axis === 'x'
          ? { minX: l0, maxX: l1, minZ: a0, maxZ: a1, minY: y - 0.05, maxY: y + RAIL_H, kind: 'rail', ledge: true, terrain: this.id }
          : { minX: a0, maxX: a1, minZ: l0, maxZ: l1, minY: y - 0.05, maxY: y + RAIL_H, kind: 'rail', ledge: true, terrain: this.id });
        k0 = k;
      }
    }
    return out;
  }

  // --- nav: rectangles of cells you can walk straight across ---------------------------------
  regions(prefix, maxSize = 16) {
    const reg = new Int32Array(this.nx * this.nz).fill(-1);
    const list = [];
    const ok = (c, zone) => this.walkable(c) && reg[c] < 0 && this.zone[c] === zone;
    for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
      const c = this.i(ix, iz);
      if (!ok(c, this.zone[c])) continue;
      const zone = this.zone[c];
      // the biggest rectangle from this corner: for each row down, how far
      // across it can go (and still join the row above), keep the best area
      let lim = maxSize, w = 1, d = 1, best = 0;
      for (let r = 0; r < maxSize && iz + r < this.nz; r++) {
        let k = 0;
        while (k < lim && ix + k < this.nx) {
          const n = this.i(ix + k, iz + r);
          if (!ok(n, zone)) break;
          if (k > 0 && Math.abs(this.h[n] - this.h[this.i(ix + k - 1, iz + r)]) > STEP) break;
          if (r > 0 && Math.abs(this.h[n] - this.h[this.i(ix + k, iz + r - 1)]) > STEP) break;
          k++;
        }
        if (k === 0) break;
        lim = k;
        if (lim * (r + 1) > best) { best = lim * (r + 1); w = lim; d = r + 1; }
      }
      let y0 = Infinity, y1 = -Infinity;
      for (let r = 0; r < d; r++) for (let k = 0; k < w; k++) { const cc = this.i(ix + k, iz + r); reg[cc] = list.length; y0 = Math.min(y0, this.h[cc]); y1 = Math.max(y1, this.h[cc]); }
      list.push({ id: `${prefix}${list.length}`, rect: [this.x0 + ix * this.cell, this.z0 + iz * this.cell, this.x0 + (ix + w) * this.cell, this.z0 + (iz + d) * this.cell], zone, room: zone, y0, y1 });
    }
    this.reg = reg;
    this.regList = list;
    // portals across region edges: walk where the step is small, drop where it isn't
    const runs = new Map();
    const note = (a, b, type, axis, line, along) => {
      const key = `${a}|${b}|${type}|${axis}|${line}`;
      if (!runs.has(key)) runs.set(key, { a, b, type, axis, line, list: [] });
      runs.get(key).list.push(along);
    };
    for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
      const c = this.i(ix, iz);
      if (reg[c] < 0) continue;
      for (const [dx, dz, axis] of [[1, 0, 'x'], [0, 1, 'z']]) {
        const jx = ix + dx, jz = iz + dz;
        if (jx >= this.nx || jz >= this.nz) continue;
        const n = this.i(jx, jz);
        if (reg[n] < 0 || reg[n] === reg[c]) continue;
        const diff = this.h[n] - this.h[c];
        const line = axis === 'x' ? this.x0 + jx * this.cell : this.z0 + jz * this.cell;
        const along = axis === 'x' ? this.cz(iz) : this.cx(ix);
        if (Math.abs(diff) <= STEP) {
          const [a, b] = reg[c] < reg[n] ? [reg[c], reg[n]] : [reg[n], reg[c]];
          note(a, b, 'walk', axis, line, along);
        } else if (Math.abs(diff) <= DROP_MAX) {
          // (not over a guard rail)
          if (diff > 0 ? this.rail[n] & (axis === 'x' ? 2 : 8) : this.rail[c] & (axis === 'x' ? 1 : 4)) continue;
          const up = diff > 0 ? reg[n] : reg[c], down = diff > 0 ? reg[c] : reg[n];
          note(up, down, 'drop', axis, line, along);
        }
      }
    }
    const portals = [];
    for (const r of runs.values()) {
      r.list.sort((p, q) => p - q);
      let start = 0;
      for (let k = 1; k <= r.list.length; k++) {
        if (k < r.list.length && r.list[k] - r.list[k - 1] <= this.cell + 0.01) continue;
        const s0 = r.list[start] - this.cell / 2, s1 = r.list[k - 1] + this.cell / 2;
        const mid = (s0 + s1) / 2;
        const A = list[r.a], B = list[r.b];
        const pos = r.axis === 'x' ? { x: r.line, z: mid } : { x: mid, z: r.line };
        const ac = r.axis === 'x' ? (A.rect[0] + A.rect[2]) / 2 : (A.rect[1] + A.rect[3]) / 2;
        const dirAB = Math.sign(r.line - ac) || 1;
        portals.push({ a: A.id, b: B.id, ...pos, axis: r.axis, width: s1 - s0, dirAB, ...(r.type === 'drop' ? { drop: true, oneWay: true } : {}) });
        start = k;
      }
    }
    return { regions: list, portals };
  }

  // The terrain region under a point (after regions()).
  regionAt(x, z) {
    const c = this.cellAt(x, z);
    if (c < 0 || !this.reg || this.reg[c] < 0) return null;
    return this.regList[this.reg[c]];
  }

  // Portals from a raised flat thing (a deck, a landing) at height y over
  // `rect` to the ground round it: walk on where it's level, drop off where
  // the ground is lower. sides: which edges are open ('nswe').
  connect(region, sides = 'nswe') {
    const [x0, z0, x1, z1] = region.rect, y = region.y1 ?? region.y0;
    const portals = [];
    for (const s of sides) {
      const axis = s === 'n' || s === 's' ? 'z' : 'x';
      const line = s === 'n' ? z0 : s === 's' ? z1 : s === 'w' ? x0 : x1;
      const out = s === 'n' || s === 'w' ? -1 : 1;
      const a0 = axis === 'z' ? x0 : z0, a1 = axis === 'z' ? x1 : z1;
      let run = null;
      const make = (r) => {
        r.a = Math.max(r.a, a0); r.b = Math.min(r.b, a1);
        const mid = (r.a + r.b) / 2;
        const pos = axis === 'z' ? { x: mid, z: line } : { x: line, z: mid };
        return { a: region.id, b: r.to, ...pos, axis, width: r.b - r.a, dirAB: out, ...(r.type === 'drop' ? { drop: true, oneWay: true } : {}) };
      };
      const flush = () => { if (run && run.b - run.a > 0.6) portals.push(make(run)); run = null; };
      for (let a = Math.floor(a0) + 0.5; a < a1; a += this.cell) {
        const px = axis === 'z' ? a : line + out * 0.5, pz = axis === 'z' ? line + out * 0.5 : a;
        const R = this.regionAt(px, pz);
        let type = null;
        if (R) {
          const h = this.heightAt(px, pz), diff = y - h;
          if (Math.abs(diff) <= STEP + 0.05) type = 'walk';
          else if (diff > STEP && diff <= DROP_MAX) type = 'drop';
        }
        if (!type) { flush(); continue; }
        if (run && run.to === R.id && run.type === type) { run.b = a + this.cell / 2; continue; }
        flush();
        run = { to: R.id, type, a: a - this.cell / 2, b: a + this.cell / 2 };
      }
      flush();
    }
    return portals;
  }

  // Where zombies claw up: spread-out walkable cells, by zone.
  spawns(prefix, spacing = 10, avoid = []) {
    const out = [];
    for (let iz = 1; iz < this.nz - 1; iz++) for (let ix = 1; ix < this.nx - 1; ix++) {
      const c = this.i(ix, iz);
      if (!this.walkable(c) || !this.spawn[c] || !this.zone[c] || this.smooth[c]) continue;
      // flat round about (not on a ramp, not at a ledge)
      let flat = true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const n = this.i(ix + dx, iz + dz); if (!this.walkable(n) || Math.abs(this.h[n] - this.h[c]) > 0.1) flat = false; }
      if (!flat) continue;
      const x = this.cx(ix), z = this.cz(iz);
      if (avoid.some((b) => x > b[0] && x < b[2] && z > b[1] && z < b[3])) continue;
      if (out.some((s) => s.zone === this.zone[c] && Math.hypot(s.x - x, s.z - z) < spacing)) continue;
      out.push({ id: `${prefix}${out.length}`, x, z, y: this.h[c], zone: this.zone[c], room: this.zone[c] });
    }
    return out;
  }
}

// --- raised structures ------------------------------------------------------------------------
// A flat walkable deck at height y over [x0, z0, x1, z1] (a catwalk, a ship's
// deck, a roof): a slab to stand on and a nav region. rails: sides with a
// railing you can't get over ('nswe'); the rest are edges you can jump off.
export function deck(id, rect, y, { zone, rails = '', thick = 0.3, look = 'steel', solid = false } = {}) {
  const [x0, z0, x1, z1] = rect;
  const boxes = [{ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: solid ? -1 : y - thick, maxY: y, kind: 'deck', look, deck: id }];
  for (const s of rails) {
    const t = 0.1, H = 1.1;
    const r = s === 'n' ? [x0, z0, x1, z0 + t] : s === 's' ? [x0, z1 - t, x1, z1] : s === 'w' ? [x0, z0, x0 + t, z1] : [x1 - t, z0, x1, z1];
    boxes.push({ minX: r[0], minZ: r[1], maxX: r[2], maxZ: r[3], minY: y, maxY: y + H, kind: 'rail', look, rail: id });
  }
  return { id, boxes, region: { id, rect, y0: y, y1: y, zone, room: zone, deck: true }, rails, rect, y, look, thick };
}

// A straight flight of stairs. dir: the way you go UP ('n','s','e','w').
export function flight(id, rect, y0, y1, dir, { zone, rise = 0.3, look = 'concrete' } = {}) {
  const [x0, z0, x1, z1] = rect;
  const n = Math.max(1, Math.ceil((y1 - y0) / rise));
  const len = dir === 'n' || dir === 's' ? z1 - z0 : x1 - x0;
  const run = len / n;
  const boxes = [];
  for (let k = 0; k < n; k++) {
    const top = y0 + ((k + 1) / n) * (y1 - y0);
    const a = k * run, b = (k + 1) * run;
    let r;
    if (dir === 'n') r = [x0, z1 - b, x1, z1 - a];
    else if (dir === 's') r = [x0, z0 + a, x1, z0 + b];
    else if (dir === 'e') r = [x0 + a, z0, x0 + b, z1];
    else r = [x1 - b, z0, x1 - a, z1];
    // each step is solid down to the bottom (so you can't walk under it)
    boxes.push({ minX: r[0], minZ: r[1], maxX: r[2], maxZ: r[3], minY: y0 - 0.2, maxY: top, kind: 'stairs', look, stair: id });
  }
  const mid = (a, b) => (a + b) / 2;
  const bottom = dir === 'n' ? { x: mid(x0, x1), z: z1, axis: 'z' } : dir === 's' ? { x: mid(x0, x1), z: z0, axis: 'z' } : dir === 'e' ? { x: x0, z: mid(z0, z1), axis: 'x' } : { x: x1, z: mid(z0, z1), axis: 'x' };
  const top = dir === 'n' ? { x: mid(x0, x1), z: z0, axis: 'z' } : dir === 's' ? { x: mid(x0, x1), z: z1, axis: 'z' } : dir === 'e' ? { x: x1, z: mid(z0, z1), axis: 'x' } : { x: x0, z: mid(z0, z1), axis: 'x' };
  const width = dir === 'n' || dir === 's' ? x1 - x0 : z1 - z0;
  const up = dir === 'e' || dir === 's' ? 1 : -1;   // + along the axis going up
  return { id, boxes, region: { id, rect, y0, y1, zone, room: zone, stairs: true }, bottom: { ...bottom, y: y0, width }, top: { ...top, y: y1, width }, dir, up, rect, y0, y1, look, n };
}
// Portals onto and off a flight: from region `below` at its foot, to `above` at its head.
export function flightPortals(f, below, above) {
  const out = [];
  if (below) out.push({ a: below, b: f.id, x: f.bottom.x, z: f.bottom.z, axis: f.bottom.axis, width: f.bottom.width, dirAB: f.up });
  if (above) out.push({ a: f.id, b: above, x: f.top.x, z: f.top.z, axis: f.top.axis, width: f.top.width, dirAB: f.up });
  return out;
}

// A square spiral staircase round a central column: flights up each side,
// landings at the corners, round and round from y0 to y1 (no ladders here).
// size: outer width of the square; w: width of the stairs. summit: the
// column's top is a platform you step onto at the end (a telescope's plinth).
export function spiral(id, cx, cz, size, y0, y1, { zone, w = 1.6, perFlight = 1.6, look = 'concrete', startSide = 's', summit = false, from = null } = {}) {
  const h = size / 2;
  const boxes = [], regions = [], portals = [], parts = [];
  // corner landings (their min corner): SW, SE, NE, NW
  const corners = [[cx - h, cz + h - w], [cx + h - w, cz + h - w], [cx + h - w, cz - h], [cx - h, cz - h]];
  const order = ['s', 'e', 'n', 'w'];
  const sideRect = (s) => s === 's' ? [cx - h + w, cz + h - w, cx + h - w, cz + h] : s === 'e' ? [cx + h - w, cz - h + w, cx + h, cz + h - w] : s === 'n' ? [cx - h + w, cz - h, cx + h - w, cz - h + w] : [cx - h, cz - h + w, cx - h + w, cz + h - w];
  const sideDir = { s: 'e', e: 'n', n: 'w', w: 's' };
  let side = order.indexOf(startSide);
  let corner = side, y = y0, k = 0, li = 0;
  const landing = (ci, yy) => {
    const [lx, lz] = corners[ci];
    const r = [lx, lz, lx + w, lz + w];
    const lid = `${id}_l${li++}`;
    boxes.push({ minX: r[0], minZ: r[1], maxX: r[2], maxZ: r[3], minY: yy - 0.3, maxY: yy, kind: 'stairs', look, stair: id });
    const reg = { id: lid, rect: r, y0: yy, y1: yy, zone, room: zone, stairs: true };
    regions.push(reg);
    return reg;
  };
  // (carrying on up from another spiral's top landing: start from it)
  let prev = from || landing(corner, y0);
  const first = prev;
  while (y < y1 - 0.01) {
    const yy = Math.min(y1, y + perFlight);
    const s = order[side];
    const f = flight(`${id}_f${k}`, sideRect(s), y, yy, sideDir[s], { zone, look });
    boxes.push(...f.boxes); regions.push(f.region); parts.push(f);
    const nextCorner = (corner + 1) % 4;
    const L = landing(nextCorner, yy);
    portals.push(...flightPortals(f, prev.id, L.id));
    prev = L; corner = nextCorner; side = (side + 1) % 4; y = yy; k++;
  }
  const inner = [cx - h + w, cz - h + w, cx + h - w, cz + h - w];
  let top = prev;
  if (summit) {
    // a level walk along the next side, then onto the column's top
    const s = order[side];
    const r = sideRect(s);
    const wid = `${id}_walk`;
    boxes.push({ minX: r[0], minZ: r[1], maxX: r[2], maxZ: r[3], minY: y1 - 0.3, maxY: y1, kind: 'stairs', look, stair: id });
    regions.push({ id: wid, rect: r, y0: y1, y1, zone, room: zone, stairs: true });
    const f = flight('x', r, 0, 1, sideDir[s]);
    portals.push({ a: prev.id, b: wid, x: f.bottom.x, z: f.bottom.z, axis: f.bottom.axis, width: w, dirAB: f.up });
    const topReg = { id: `${id}_top`, rect: inner, y0: y1, y1, zone, room: zone, summit: true };
    regions.push(topReg);
    // the edge between the walk and the column
    const ax = s === 's' || s === 'n' ? 'z' : 'x';
    const line = s === 's' ? inner[3] : s === 'n' ? inner[1] : s === 'e' ? inner[2] : inner[0];
    const toIn = s === 's' || s === 'e' ? -1 : 1;
    portals.push({ a: wid, b: topReg.id, x: ax === 'z' ? cx : line, z: ax === 'z' ? line : cz, axis: ax, width: size - 2 * w, dirAB: toIn });
    top = topReg;
  }
  // the central column
  boxes.push({ minX: inner[0], minZ: inner[1], maxX: inner[2], maxZ: inner[3], minY: y0 - 0.2, maxY: summit ? y1 : y1 + 0.2, kind: 'column', look, stair: id });
  return { id, boxes, regions, portals, bottom: first, top, first: parts[0], parts, look, cx, cz, size, y0, y1, w, inner };
}
