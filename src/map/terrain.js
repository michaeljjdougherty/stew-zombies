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

export const K = { SEA: 0, ROCK: 1, GROUND: 2, ROOM: 3 };
const STEP = 0.45;          // the biggest rise you can walk up (zombies 0.5, players 0.48)
const DROP_MAX = 12;        // ledges higher than this aren't something you jump off

// --- shapes: (x, z) => inside? ----------------------------------------------------------
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const wobble = (x, z, amp, freq = 0.35) => amp * (Math.sin(x * freq + Math.cos(z * freq * 0.7) * 1.7) * 0.6 + Math.sin(z * freq * 1.3 - x * freq * 0.4) * 0.4);
export const shape = {
  rect: (x0, z0, x1, z1) => (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1,
  circle: (cx, cz, r, jag = 0) => (x, z) => Math.hypot(x - cx, z - cz) <= r + (jag ? wobble(x, z, jag) : 0),
  ellipse: (cx, cz, rx, rz, jag = 0) => (x, z) => Math.hypot((x - cx) / rx, (z - cz) / rz) <= 1 + (jag ? wobble(x, z, jag) / Math.max(rx, rz) : 0),
  // a polygon (points [[x, z], ...]), edges roughened by `jag` metres
  poly: (pts, jag = 0) => (x, z) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, zi] = pts[i], [xj, zj] = pts[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    if (!jag) return inside;
    // near an edge: let the wobble decide
    const d = distToPoly(pts, x, z);
    return d < jag ? (inside ? d > -wobble(x, z, jag) : d < wobble(x, z, jag) * 0.5) || inside && d > jag * 0.5 : inside;
  },
  // a band along a polyline (a trench, a path), `w` wide
  path: (pts, w, jag = 0) => (x, z) => distToLine(pts, x, z).d <= w / 2 + (jag ? wobble(x, z, jag, 0.6) : 0),
  not: (f) => (x, z) => !f(x, z),
  and: (...fs) => (x, z) => fs.every((f) => f(x, z)),
  or: (...fs) => (x, z) => fs.some((f) => f(x, z)),
};
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
  }
  i(ix, iz) { return iz * this.nx + ix; }
  cx(ix) { return this.x0 + (ix + 0.5) * this.cell; }
  cz(iz) { return this.z0 + (iz + 0.5) * this.cell; }
  cellAt(x, z) { const ix = Math.floor((x - this.x0) / this.cell), iz = Math.floor((z - this.z0) / this.cell); return ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz ? -1 : this.i(ix, iz); }
  heightAt(x, z) { const c = this.cellAt(x, z); return c < 0 ? 0 : this.h[c]; }

  // Paint every cell whose middle is inside `f`.
  paint(f, { h, kind = K.GROUND, mat, zone, ceil, spawn, smooth, add, max, min } = {}) {
    for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
      const x = this.cx(ix), z = this.cz(iz);
      if (!f(x, z)) continue;
      const c = this.i(ix, iz);
      let hv = typeof h === 'function' ? h(x, z, this.h[c]) : h;
      if (add != null) hv = this.h[c] + add;
      if (hv != null) {
        if (max != null) hv = Math.min(hv, max);
        if (min != null) hv = Math.max(hv, min);
        this.h[c] = hv;
      }
      this.kind[c] = kind;
      if (mat) this.mat[c] = mat;
      if (zone !== undefined) this.zone[c] = zone;
      if (ceil !== undefined) this.ceil[c] = ceil;
      if (spawn !== undefined) this.spawn[c] = spawn ? 1 : 0;
      else if (kind === K.GROUND) this.spawn[c] = 1;
      if (smooth !== undefined) this.smooth[c] = smooth ? 1 : 0;
      else if (kind !== K.GROUND) this.smooth[c] = 0;
    }
  }

  // A ramp along a polyline: points [[x, z, h], ...], `w` wide; height runs
  // along it. (Steeper than you can walk up = a slide.)
  ramp(pts, w, opts = {}) {
    const flat = pts.map((p) => [p[0], p[1]]);
    const lens = []; for (let i = 0; i < pts.length - 1; i++) lens.push(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]));
    const total = lens.reduce((a, b) => a + b, 0);
    const hAt = (s) => {
      let acc = 0;
      for (let i = 0; i < lens.length; i++) {
        if (s * total <= acc + lens[i] || i === lens.length - 1) { const t = lens[i] ? Math.min(1, (s * total - acc) / lens[i]) : 0; return pts[i][2] + (pts[i + 1][2] - pts[i][2]) * t; }
        acc += lens[i];
      }
      return pts[pts.length - 1][2];
    };
    this.paint((x, z) => distToLine(flat, x, z).d <= w / 2, { ...opts, smooth: opts.smooth ?? true, h: (x, z) => hAt(distToLine(flat, x, z).s) });
  }

  // Mark the cells under a building (its floor height; not walked by the terrain nav).
  building(rect, y, pad = 0.5) {
    const [x0, z0, x1, z1] = rect;
    this.paint(shape.rect(x0 - pad, z0 - pad, x1 + pad, z1 + pad), { h: y, kind: K.ROOM, spawn: false, smooth: false });
  }

  walkable(c) { return this.kind[c] === K.GROUND; }

  // --- collision boxes: runs of cells with the same top, merged into rectangles ----------------
  boxes() {
    const out = [];
    const used = new Uint8Array(this.nx * this.nz);
    const q = (v) => Math.round(v * 20) / 20;
    for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
      const c = this.i(ix, iz);
      if (used[c] || this.kind[c] === K.SEA) continue;
      const hv = q(this.h[c]), kd = this.kind[c] === K.ROCK ? 1 : 0;
      if (hv <= 0.01) { used[c] = 1; continue; }
      const same = (cc) => !used[cc] && this.kind[cc] !== K.SEA && q(this.h[cc]) === hv && (this.kind[cc] === K.ROCK ? 1 : 0) === kd;
      let w = 1;
      while (ix + w < this.nx && same(this.i(ix + w, iz))) w++;
      let d = 1;
      grow: while (iz + d < this.nz) {
        for (let k = 0; k < w; k++) if (!same(this.i(ix + k, iz + d))) break grow;
        d++;
      }
      for (let r = 0; r < d; r++) for (let k = 0; k < w; k++) used[this.i(ix + k, iz + r)] = 1;
      out.push({ minX: this.x0 + ix * this.cell, maxX: this.x0 + (ix + w) * this.cell, minZ: this.z0 + iz * this.cell, maxZ: this.z0 + (iz + d) * this.cell, minY: -1, maxY: hv, kind: kd ? 'rock' : 'ground', terrain: this.id });
    }
    // the sea's edge: an invisible wall where the land meets the ice
    for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
      const c = this.i(ix, iz);
      if (this.kind[c] !== K.SEA) continue;
      let top = -1;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const jx = ix + dx, jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= this.nx || jz >= this.nz) continue;
        const cc = this.i(jx, jz);
        if (this.kind[cc] === K.GROUND) top = Math.max(top, this.h[cc]);
      }
      if (top < 0) continue;
      out.push({ minX: this.x0 + ix * this.cell, maxX: this.x0 + (ix + 1) * this.cell, minZ: this.z0 + iz * this.cell, maxZ: this.z0 + (iz + 1) * this.cell, minY: -1, maxY: top + 3.5, kind: 'shore', ghost: true, terrain: this.id });
    }
    return out;
  }

  // --- nav: rectangles of cells you can walk straight across ---------------------------------
  regions(prefix, maxSize = 14) {
    const reg = new Int32Array(this.nx * this.nz).fill(-1);
    const list = [];
    const ok = (c, zone) => this.walkable(c) && reg[c] < 0 && this.zone[c] === zone;
    for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
      const c = this.i(ix, iz);
      if (!ok(c, this.zone[c])) continue;
      const zone = this.zone[c];
      let w = 1;
      while (ix + w < this.nx && w < maxSize) {
        const n = this.i(ix + w, iz);
        if (!ok(n, zone) || Math.abs(this.h[n] - this.h[this.i(ix + w - 1, iz)]) > STEP) break;
        w++;
      }
      let d = 1;
      grow: while (iz + d < this.nz && d < maxSize) {
        for (let k = 0; k < w; k++) {
          const n = this.i(ix + k, iz + d);
          if (!ok(n, zone) || Math.abs(this.h[n] - this.h[this.i(ix + k, iz + d - 1)]) > STEP) break grow;
          if (k > 0 && Math.abs(this.h[n] - this.h[this.i(ix + k - 1, iz + d)]) > STEP) break grow;
        }
        d++;
      }
      let y0 = Infinity, y1 = -Infinity;
      for (let r = 0; r < d; r++) for (let k = 0; k < w; k++) { const cc = this.i(ix + k, iz + r); reg[cc] = list.length; y0 = Math.min(y0, this.h[cc]); y1 = Math.max(y1, this.h[cc]); }
      list.push({ id: `${prefix}${list.length}`, rect: [this.x0 + ix * this.cell, this.z0 + iz * this.cell, this.x0 + (ix + w) * this.cell, this.z0 + (iz + d) * this.cell], zone, y0, y1 });
    }
    this.reg = reg;
    this.regList = list;
    // portals across region edges: walk where the step is small, drop where it isn't
    const runs = new Map();
    const note = (a, b, type, axis, line, along, hi) => {
      const key = `${a}|${b}|${type}|${axis}|${line}`;
      if (!runs.has(key)) runs.set(key, { a, b, type, axis, line, list: [] });
      runs.get(key).list.push({ along, hi });
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
          note(a, b, 'walk', axis, line, along, 0);
        } else if (Math.abs(diff) <= DROP_MAX) {
          const up = diff > 0 ? reg[n] : reg[c], down = diff > 0 ? reg[c] : reg[n];
          note(up, down, 'drop', axis, line, along, 0);
        }
      }
    }
    const portals = [];
    for (const r of runs.values()) {
      r.list.sort((p, q) => p.along - q.along);
      let start = 0;
      for (let k = 1; k <= r.list.length; k++) {
        if (k < r.list.length && r.list[k].along - r.list[k - 1].along <= this.cell + 0.01) continue;
        const s0 = r.list[start].along - this.cell / 2, s1 = r.list[k - 1].along + this.cell / 2;
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

  // Where zombies claw up: spread-out walkable cells, by zone.
  spawns(prefix, spacing = 10, avoid = []) {
    const out = [];
    for (let iz = 1; iz < this.nz - 1; iz++) for (let ix = 1; ix < this.nx - 1; ix++) {
      const c = this.i(ix, iz);
      if (!this.walkable(c) || !this.spawn[c] || !this.zone[c] || this.smooth[c]) continue;
      // flat round about (not on a ramp, not at a ledge)
      let flat = true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = this.i(ix + dx, iz + dz); if (!this.walkable(n) || Math.abs(this.h[n] - this.h[c]) > 0.1) flat = false; }
      if (!flat) continue;
      const x = this.cx(ix), z = this.cz(iz);
      if (avoid.some((b) => x > b[0] && x < b[3] && z > b[2] && z < b[5])) continue;
      if (out.some((s) => s.zone === this.zone[c] && Math.hypot(s.x - x, s.z - z) < spacing)) continue;
      out.push({ id: `${prefix}${out.length}`, x, z, y: this.h[c], zone: this.zone[c] });
    }
    return out;
  }
}

// --- raised structures ------------------------------------------------------------------------
// A flat walkable deck at height y over [x0, z0, x1, z1] (a catwalk, a ship's
// deck, a roof): a slab to stand on and a nav region. rails: sides with a
// railing ('n','s','w','e'); the rest are edges you can jump off.
export function deck(id, rect, y, { zone, rails = '', thick = 0.3, kind = 'deck', look = 'steel' } = {}) {
  const [x0, z0, x1, z1] = rect;
  const boxes = [{ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: y - thick, maxY: y, kind, look, deck: id }];
  for (const s of rails) {
    const t = 0.08, H = 1.05;
    const r = s === 'n' ? [x0, z0, x1, z0 + t] : s === 's' ? [x0, z1 - t, x1, z1] : s === 'w' ? [x0, z0, x0 + t, z1] : [x1 - t, z0, x1, z1];
    boxes.push({ minX: r[0], minZ: r[1], maxX: r[2], maxZ: r[3], minY: y, maxY: y + H, kind: 'rail', look, rail: id });
  }
  return { id, boxes, region: { id, rect, y0: y, y1: y, zone, deck: true }, rails, rect, y, look };
}

// A straight flight of stairs. dir: the way you go UP ('n','s','e','w').
export function flight(id, rect, y0, y1, dir, { zone, rise = 0.32, look = 'concrete' } = {}) {
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
  return { id, boxes, region: { id, rect, y0, y1, zone, stairs: true }, bottom: { ...bottom, y: y0, width }, top: { ...top, y: y1, width }, dir, rect, y0, y1, look };
}

// A square spiral staircase round a central column: flights up each side,
// landings at the corners, round and round from y0 to y1. Each turn of the
// spiral is 4 flights. Returns its pieces and where you get on and off.
// size: outer width of the square; w: width of the stairs.
export function spiral(id, cx, cz, size, y0, y1, { zone, w = 1.6, perFlight = 1.6, look = 'concrete', startSide = 's' } = {}) {
  const h = size / 2;
  const parts = [], boxes = [], regions = [], portals = [];
  // corners (landings) and sides (flights), going anticlockwise seen from above
  const corners = [[cx - h, cz + h - w], [cx + h - w, cz + h - w], [cx + h - w, cz - h], [cx - h, cz - h]];   // SW, SE, NE, NW (their min corner)
  const order = ['s', 'e', 'n', 'w'];
  let side = order.indexOf(startSide);
  let y = y0;
  let k = 0;
  let prevLanding = null;
  const landing = (ci, yy) => {
    const [lx, lz] = corners[ci];
    const r = [lx, lz, lx + w, lz + w];
    const lid = `${id}_l${k}`;
    boxes.push({ minX: r[0], minZ: r[1], maxX: r[2], maxZ: r[3], minY: yy - 0.3, maxY: yy, kind: 'stairs', look, stair: id });
    regions.push({ id: lid, rect: r, y0: yy, y1: yy, zone, stairs: true });
    return { id: lid, rect: r, y: yy };
  };
  // first landing: the corner before the first flight
  let corner = side;   // flight on side s runs from corner side to corner side+1
  prevLanding = landing(corner, y0);
  const first = prevLanding;
  while (y < y1 - 0.01) {
    const yy = Math.min(y1, y + perFlight);
    const s = order[side];
    // the flight's rect along this side, between the two corner landings
    let rect, dir;
    if (s === 's') { rect = [cx - h + w, cz + h - w, cx + h - w, cz + h]; dir = 'e'; }
    else if (s === 'e') { rect = [cx + h - w, cz - h + w, cx + h, cz + h - w]; dir = 'n'; }
    else if (s === 'n') { rect = [cx - h + w, cz - h, cx + h - w, cz - h + w]; dir = 'w'; }
    else { rect = [cx - h, cz - h + w, cx - h + w, cz + h - w]; dir = 's'; }
    const f = flight(`${id}_f${k}`, rect, y, yy, dir, { zone, look });
    boxes.push(...f.boxes); regions.push(f.region);
    const nextCorner = (corner + 1) % 4;
    const L = landing(nextCorner, yy);
    portals.push({ a: prevLanding.id, b: f.id, x: f.bottom.x, z: f.bottom.z, axis: f.bottom.axis, width: w, dirAB: dirOf(f.dir) });
    portals.push({ a: f.id, b: L.id, x: f.top.x, z: f.top.z, axis: f.top.axis, width: w, dirAB: dirOf(f.dir) });
    parts.push(f);
    prevLanding = L; corner = nextCorner; side = (side + 1) % 4; y = yy; k++;
  }
  // the central column
  boxes.push({ minX: cx - h + w, minZ: cz - h + w, maxX: cx + h - w, maxZ: cz + h - w, minY: y0 - 0.2, maxY: y1 + 0.2, kind: 'column', look, stair: id });
  return { id, boxes, regions, portals, bottom: first, top: prevLanding, parts, look, cx, cz, size, y0, y1, w };
}
const dirOf = (d) => (d === 'e' || d === 's' ? 1 : -1);
