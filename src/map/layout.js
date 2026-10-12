// =============================================================================
// Layout kit for big outdoor maps (Call of the Crust): helpers that turn a few
// lines of description (a trench loop, buildings, a pit) into the map data
// the engine wants: collision boxes, nav regions and the portals between them.
// Pure JS: the simulation and the tests use it, no three.js.
//
// Nav regions carry a `level` (ground 0, the excavation rim 4...). Regions on
// the same level that touch get a portal automatically; stairs join levels
// with portals of their own.
// =============================================================================

const EPS = 0.01;

export const rect = (x0, z0, x1, z1) => [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)];
export const boxOf = (r, y0, y1, kind, extra = {}) => ({ box: [r[0], y0, r[1], r[2], y1, r[3]], kind, ...extra });
const overlaps = (a, b) => a[0] < b[2] - EPS && a[2] > b[0] + EPS && a[1] < b[3] - EPS && a[3] > b[1] + EPS;

// --- orthogonal polygons ---------------------------------------------------------
// Signed area (positive: counter-clockwise in x/z).
function area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length]; a += x0 * z1 - x1 * z0; }
  return a / 2;
}

// Offset a closed orthogonal polygon outward by d (negative: inward).
export function offsetLoop(pts, d) {
  const s = area(pts) > 0 ? 1 : -1;   // which way "outward" is for this winding
  const n = pts.length;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    // outward normal of edge p->q
    const dx = Math.sign(q[0] - p[0]), dz = Math.sign(q[1] - p[1]);
    const nx = dz * s, nz = -dx * s;
    return { horiz: dz === 0, c: dz === 0 ? p[1] + nz * d : p[0] + nx * d };
  });
  // each vertex: where the offset lines of the edges either side of it cross
  return pts.map((_, i) => {
    const a = lines[(i - 1 + n) % n], b = lines[i];
    const x = a.horiz ? b.c : a.c, z = a.horiz ? a.c : b.c;
    return [x, z];
  });
}

export function insidePoly(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const bbox4 = (...ps) => rect(Math.min(...ps.map((p) => p[0])), Math.min(...ps.map((p) => p[1])), Math.max(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[1])));

// --- a closed trench loop ----------------------------------------------------------
// points: the centreline, axis-aligned, closed. width: trench floor width.
// berm: thickness of the earth wall either side. Returns the trench floor
// regions (one per edge), the berm boxes (each knows which way faces into
// the trench), and the polygons for the loop's inside.
export function trenchLoop({ points, width, berm, height, room }) {
  const half = width / 2;
  const qIn = offsetLoop(points, -half), qOut = offsetLoop(points, half);
  const bIn = offsetLoop(points, -(half + berm)), bOut = offsetLoop(points, half + berm);
  const n = points.length;
  const edges = [];
  const berms = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p = points[i], q = points[j];
    const horiz = p[1] === q[1];
    const dir = horiz ? Math.sign(q[0] - p[0]) : Math.sign(q[1] - p[1]);
    // the floor of this edge, owning its start corner and leaving its end corner to the next
    const full = bbox4(qIn[i], qIn[j], qOut[i], qOut[j]);
    let r;
    if (horiz) r = dir > 0 ? [full[0], full[1], q[0] - half, full[3]] : [q[0] + half, full[1], full[2], full[3]];
    else r = dir > 0 ? [full[0], full[1], full[2], q[1] - half] : [full[0], q[1] + half, full[2], full[3]];
    edges.push({ i, horiz, dir, rect: r, center: [p, q] });
    // the berms: inside one faces out (toward the trench), outside one faces in
    const inner = bbox4(qIn[i], qIn[j], bIn[i], bIn[j]);
    const outer = bbox4(qOut[i], qOut[j], bOut[i], bOut[j]);
    // the face toward the trench: direction from the berm to the centreline
    const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    for (const b of [inner, outer]) {
      const c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
      const face = horiz ? { x: 0, z: Math.sign(mid[1] - c[1]) } : { x: Math.sign(mid[0] - c[0]), z: 0 };
      berms.push({ rect: b, y1: height, face, side: b === inner ? 'in' : 'out', edge: i });
    }
  }
  return {
    edges, berms, qIn, qOut, bIn, bOut, height, width, berm,
    regions: edges.map((e) => ({ id: `${room}_${e.i}`, rect: e.rect, room, level: 0, trench: true })),
  };
}

// Cut a hole through a list of berm boxes (an exit, a dugout). Each box that
// overlaps the cut is split along its length; the pieces keep its facing.
export function carve(berms, cut) {
  const out = [];
  for (const b of berms) {
    if (!overlaps(b.rect, cut)) { out.push(b); continue; }
    const [x0, z0, x1, z1] = b.rect;
    const alongX = x1 - x0 >= z1 - z0;
    if (alongX) {
      if (cut[0] > x0 + EPS) out.push({ ...b, rect: [x0, z0, cut[0], z1] });
      if (cut[2] < x1 - EPS) out.push({ ...b, rect: [cut[2], z0, x1, z1] });
    } else {
      if (cut[1] > z0 + EPS) out.push({ ...b, rect: [x0, z0, x1, cut[1]] });
      if (cut[3] < z1 - EPS) out.push({ ...b, rect: [x0, cut[3], x1, z1] });
    }
    // what's left of the berm beside the cut (when the cut doesn't go all the way through)
    if (alongX) {
      if (cut[1] > z0 + EPS) out.push({ ...b, rect: [Math.max(x0, cut[0]), z0, Math.min(x1, cut[2]), cut[1]], stub: true });
      if (cut[3] < z1 - EPS) out.push({ ...b, rect: [Math.max(x0, cut[0]), cut[3], Math.min(x1, cut[2]), z1], stub: true });
    } else {
      if (cut[0] > x0 + EPS) out.push({ ...b, rect: [x0, Math.max(z0, cut[1]), cut[0], Math.min(z1, cut[3])], stub: true });
      if (cut[2] < x1 - EPS) out.push({ ...b, rect: [cut[2], Math.max(z0, cut[1]), x1, Math.min(z1, cut[3])], stub: true });
    }
  }
  return out;
}

// --- filling an area with nav regions ----------------------------------------------
// The inside of a polygon (or a rect) minus some holes, cut into as few
// rectangles as a greedy merge finds. Each gets `room` from roomOf(cx, cz).
export function tile({ poly = null, area: ar = null, holes = [], level = 0, roomOf, prefix }) {
  const pts = poly || [[ar[0], ar[1]], [ar[2], ar[1]], [ar[2], ar[3]], [ar[0], ar[3]]];
  const xs = new Set(pts.map((p) => p[0])), zs = new Set(pts.map((p) => p[1]));
  const [px0, pz0, px1, pz1] = bbox4(...pts);
  for (const h of holes) {
    for (const x of [h[0], h[2]]) if (x > px0 && x < px1) xs.add(x);
    for (const z of [h[1], h[3]]) if (z > pz0 && z < pz1) zs.add(z);
  }
  const X = [...xs].sort((a, b) => a - b), Z = [...zs].sort((a, b) => a - b);
  const nx = X.length - 1, nz = Z.length - 1;
  const fill = [];
  for (let j = 0; j < nz; j++) {
    fill.push([]);
    for (let i = 0; i < nx; i++) {
      const cx = (X[i] + X[i + 1]) / 2, cz = (Z[j] + Z[j + 1]) / 2;
      const inHole = holes.some((h) => cx > h[0] && cx < h[2] && cz > h[1] && cz < h[3]);
      fill[j].push(!inHole && insidePoly(pts, cx, cz));
    }
  }
  const used = fill.map((row) => row.map(() => false));
  const out = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      if (!fill[j][i] || used[j][i]) continue;
      let i1 = i;
      while (i1 + 1 < nx && fill[j][i1 + 1] && !used[j][i1 + 1]) i1++;
      let j1 = j;
      const rowOk = (jj) => { for (let k = i; k <= i1; k++) if (!fill[jj][k] || used[jj][k]) return false; return true; };
      while (j1 + 1 < nz && rowOk(j1 + 1)) j1++;
      for (let jj = j; jj <= j1; jj++) for (let k = i; k <= i1; k++) used[jj][k] = true;
      const r = [X[i], Z[j], X[i1 + 1], Z[j1 + 1]];
      out.push({ id: `${prefix}_${out.length}`, rect: r, room: roomOf((r[0] + r[2]) / 2, (r[1] + r[3]) / 2), level });
    }
  }
  return out;
}

// --- portals ---------------------------------------------------------------------
// A portal wherever two regions on the same level share an edge.
export function autoPortals(regions, minWidth = 1.0) {
  const out = [];
  for (let a = 0; a < regions.length; a++) {
    for (let b = a + 1; b < regions.length; b++) {
      const A = regions[a], B = regions[b];
      if (A.level !== B.level || A.noAuto || B.noAuto) continue;
      const [ax0, az0, ax1, az1] = A.rect, [bx0, bz0, bx1, bz1] = B.rect;
      if (Math.abs(ax1 - bx0) < EPS || Math.abs(bx1 - ax0) < EPS) {
        const lo = Math.max(az0, bz0), hi = Math.min(az1, bz1);
        if (hi - lo >= minWidth) out.push({ a: A.id, b: B.id, x: Math.abs(ax1 - bx0) < EPS ? ax1 : ax0, z: (lo + hi) / 2, axis: 'x', width: hi - lo });
      } else if (Math.abs(az1 - bz0) < EPS || Math.abs(bz1 - az0) < EPS) {
        const lo = Math.max(ax0, bx0), hi = Math.min(ax1, bx1);
        if (hi - lo >= minWidth) out.push({ a: A.id, b: B.id, x: (lo + hi) / 2, z: Math.abs(az1 - bz0) < EPS ? az1 : az0, axis: 'z', width: hi - lo });
      }
    }
  }
  return out;
}

// The region on `level` that contains (or touches) a point.
export function regionAt(regions, x, z, level = 0) {
  return regions.find((r) => r.level === level && x >= r.rect[0] - EPS && x <= r.rect[2] + EPS && z >= r.rect[1] - EPS && z <= r.rect[3] + EPS) || null;
}

// --- stairs ----------------------------------------------------------------------
// A flight up from `from` (the bottom edge) to `to` height, rising toward `dir`
// ('n','s','e','w'). Returns the step boxes and a region with no automatic
// portals (the caller joins its two ends).
export function stairs({ id, rect: r, dir, rise, top, room }) {
  const steps = Math.round(top / rise);
  const [x0, z0, x1, z1] = r;
  const len = dir === 'n' || dir === 's' ? z1 - z0 : x1 - x0;
  const run = len / steps;
  const boxes = [];
  for (let k = 0; k < steps; k++) {
    const h = (k + 1) * (top / steps);
    // step k covers from its front edge to the top end of the flight
    const a = k * run;
    let b;
    if (dir === 'n') b = [x0, z0, x1, z1 - a];
    else if (dir === 's') b = [x0, z0 + a, x1, z1];
    else if (dir === 'e') b = [x0 + a, z0, x1, z1];
    else b = [x0, z0, x1 - a, z1];
    boxes.push(boxOf(b, 0, h, 'stairs', { stairs: id }));
  }
  // bottom and top edges
  const bottom = dir === 'n' ? { axis: 'z', z: z1, x: (x0 + x1) / 2 } : dir === 's' ? { axis: 'z', z: z0, x: (x0 + x1) / 2 } : dir === 'e' ? { axis: 'x', x: x0, z: (z0 + z1) / 2 } : { axis: 'x', x: x1, z: (z0 + z1) / 2 };
  const topE = dir === 'n' ? { axis: 'z', z: z0, x: (x0 + x1) / 2 } : dir === 's' ? { axis: 'z', z: z1, x: (x0 + x1) / 2 } : dir === 'e' ? { axis: 'x', x: x1, z: (z0 + z1) / 2 } : { axis: 'x', x: x0, z: (z0 + z1) / 2 };
  const width = dir === 'n' || dir === 's' ? x1 - x0 : z1 - z0;
  return { boxes, region: { id, rect: r, room, level: 'stairs', noAuto: true }, bottom: { ...bottom, width }, top: { ...topE, width }, dir, rise: top / steps, run, steps };
}

// --- buildings ---------------------------------------------------------------------
// Walls round a rect (thickness t, height h) with openings: [{ side, from, to }]
// measured along the wall. Per-wall heights let a ruin crumble: heights[side]
// can be a number or [[from, to, height], ...] pieces.
export function walls({ rect: r, t, h, openings = [], heights = {}, kind = 'wall', style }) {
  const [x0, z0, x1, z1] = r;
  const out = [];
  const sides = {
    n: { a: x0, b: x1, mk: (a, b) => [a, z0, b, z0 + t] },
    s: { a: x0, b: x1, mk: (a, b) => [a, z1 - t, b, z1] },
    w: { a: z0 + t, b: z1 - t, mk: (a, b) => [x0, a, x0 + t, b] },
    e: { a: z0 + t, b: z1 - t, mk: (a, b) => [x1 - t, a, x1, b] },
  };
  for (const [side, S] of Object.entries(sides)) {
    const ops = openings.filter((o) => o.side === side).sort((a, b) => a.from - b.from);
    let cur = S.a;
    const pieces = [];
    for (const o of ops) { if (o.from > cur + EPS) pieces.push([cur, o.from]); cur = Math.max(cur, o.to); }
    if (S.b > cur + EPS) pieces.push([cur, S.b]);
    for (const [a, b] of pieces) {
      const hs = heights[side];
      if (Array.isArray(hs)) {
        // crumbled: different heights along the wall
        for (const [ha, hb, hh] of hs) {
          const lo = Math.max(a, ha), hi = Math.min(b, hb);
          if (hi > lo + EPS) out.push(boxOf(S.mk(lo, hi), 0, hh, kind, { side, style }));
        }
      } else out.push(boxOf(S.mk(a, b), 0, hs ?? h, kind, { side, style }));
    }
  }
  return out;
}

// The connector region through a wall opening (joins the inside to the outside).
export function doorway(r, t, o, room) {
  const [x0, z0, x1, z1] = r;
  const c = o.side === 'n' ? [o.from, z0, o.to, z0 + t] : o.side === 's' ? [o.from, z1 - t, o.to, z1] : o.side === 'w' ? [x0, o.from, x0 + t, o.to] : [x1 - t, o.from, x1, o.to];
  return { id: `door_${room}_${o.side}_${Math.round(o.from * 10)}`, rect: c, room, level: 0 };
}

// --- checks -------------------------------------------------------------------------
// Every region reachable from `start` over the portals? Returns the unreachable ids.
export function unreachable(regions, portals, start) {
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    for (const p of portals) {
      const nxt = p.a === cur ? p.b : p.b === cur ? p.a : null;
      if (nxt && !seen.has(nxt)) { seen.add(nxt); q.push(nxt); }
    }
  }
  return regions.filter((r) => !seen.has(r.id)).map((r) => r.id);
}
