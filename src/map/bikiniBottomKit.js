// =============================================================================
// Bikini Bottom's ground (Map 3), from the grid tools/bikinibottom/build.mjs
// measured off the model (src/map/bikiniBottomGround.js): the heights of the
// sand, the roads and the rock ledges, and the cells a house, fence or rock stands in.
// From it come the collision boxes (the ground as steps of 0.5 m cells, walls
// where something solid stands, an invisible fence round the edge of play),
// the nav regions (rectangles of cells you can walk straight across) and the
// portals between them. Pure JS (no three.js): the sim and the renderer read it.
// =============================================================================
import { GRIDS } from './bikiniBottomGround.js';
import { autoPortals } from './layout.js';

const STEP = 0.24;     // the most the sand may rise from one cell to the next and still be walkable
                       // (about 25 degrees: the cliffs and rock ledges are too steep to climb)
const WALL = 3.2;      // how high a wall box stands over the ground
const FENCE = 6;       // the invisible fence at the edge of play

function bytes(b64) {
  const s = atob(b64), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
// each grid (the town, then the insides far off the map), unpacked
const ALL = GRIDS.map((g) => {
  const hb = bytes(g.heights), H = new Float32Array(g.nx * g.nz);
  for (let c = 0; c < g.nx * g.nz; c++) H[c] = ((hb[c * 2] | (hb[c * 2 + 1] << 8)) - 32768) / 100;
  return { name: g.name, x0: g.x0, z0: g.z0, nx: g.nx, nz: g.nz, cell: g.cell, H, SOLID: bytes(g.blocked) };
});
const gridAt = (x, z) => ALL.find((g) => x >= g.x0 && z >= g.z0 && x < g.x0 + g.nx * g.cell && z < g.z0 + g.nz * g.cell);
const cellIn = (g, x, z) => [Math.floor((x - g.x0) / g.cell), Math.floor((z - g.z0) / g.cell)];
const { x0: GX0, z0: GZ0, nx: NX, nz: NZ, cell: CELL } = ALL[0];
// the town's grid (the insides' are in INSIDES, by name)
export const GRID = { x0: GX0, z0: GZ0, nx: NX, nz: NZ, cell: CELL };
export const INSIDES = Object.fromEntries(ALL.slice(1).map((g) => [g.name, { x0: g.x0, z0: g.z0, nx: g.nx, nz: g.nz, cell: g.cell }]));

// The ground's height under a point (the cell's).
export function heightAt(x, z) {
  const g = gridAt(x, z);
  if (!g) return 0;
  const [i, k] = cellIn(g, x, z);
  return g.H[k * g.nx + i];
}

// Build the playable ground. play(x, z): inside the edge of play (the town's)? start: a point
// you can walk from (everything you can't walk to from it is fenced off).
// starts: { house: {x, z}, ... } the same for each inside (one left out isn't built).
// open: rects [x0, z0, x1, z1] cleared of walls (a doorway the model leaves too tight).
// shut: rects walled up (a gap you shouldn't get through).
// doors: [{ id, rect }] gaps a door you buy stands in: open ground of their own in the nav,
// whose ways in are shut till it's bought.
function buildOn(g, play, start, open, shut, regions, doors) {
  const { x0: GX0, z0: GZ0, nx: NX, nz: NZ, cell: CELL, H, SOLID } = g;
  const cellOf = (x, z) => cellIn(g, x, z);
  const inR = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
  const cx = (i) => GX0 + (i + 0.5) * CELL, cz = (k) => GZ0 + (k + 0.5) * CELL;
  const solid = new Uint8Array(NX * NZ);
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
    const c = k * NX + i, x = cx(i), z = cz(k);
    solid[c] = (SOLID[c] && !open.some((r) => inR(r, x, z))) || shut.some((r) => inR(r, x, z)) ? 1 : 0;
  }
  // flood out from the start over cells you can step between
  const walk = new Uint8Array(NX * NZ);
  const [si, sk] = cellOf(start.x, start.z);
  const stack = [sk * NX + si];
  while (stack.length) {
    const c = stack.pop();
    if (walk[c] || solid[c]) continue;
    const i = c % NX, k = (c - i) / NX;
    if (!play(cx(i), cz(k))) continue;
    walk[c] = 1;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, kk = k + dk;
      if (ii < 0 || kk < 0 || ii >= NX || kk >= NZ) continue;
      const n = kk * NX + ii;
      if (!walk[n] && Math.abs(H[n] - H[c]) <= STEP) stack.push(n);
    }
  }

  // --- collision: greedy rectangles of cells alike (same kind, heights within 4 cm)
  // kind 0: ground you walk on; 1: a wall (something solid stands there);
  // 2: off limits (the invisible fence: stops you, not bullets)
  const kindOf = (c) => (walk[c] ? 0 : solid[c] ? 1 : 2);
  const used = new Uint8Array(NX * NZ);
  const boxes = [];
  const TOL = 0.04;
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
    const c = k * NX + i; if (used[c]) continue;
    const kind = kindOf(c);
    let lo = H[c], hi = H[c];
    const fits = (n) => !used[n] && kindOf(n) === kind && Math.max(hi, H[n]) - Math.min(lo, H[n]) <= TOL;
    let i1 = i;
    while (i1 + 1 < NX && fits(k * NX + i1 + 1)) { i1++; lo = Math.min(lo, H[k * NX + i1]); hi = Math.max(hi, H[k * NX + i1]); }
    let k1 = k;
    for (;;) {
      if (k1 + 1 >= NZ) break;
      let ok = true, l2 = lo, h2 = hi;
      for (let j = i; j <= i1 && ok; j++) { const n = (k1 + 1) * NX + j; if (!fits(n)) ok = false; else { l2 = Math.min(l2, H[n]); h2 = Math.max(h2, H[n]); } if (h2 - l2 > TOL) ok = false; }
      if (!ok) break;
      k1++; lo = l2; hi = h2;
    }
    for (let kk = k; kk <= k1; kk++) for (let j = i; j <= i1; j++) used[kk * NX + j] = 1;
    const b = { minX: GX0 + i * CELL, maxX: GX0 + (i1 + 1) * CELL, minZ: GZ0 + k * CELL, maxZ: GZ0 + (k1 + 1) * CELL, minY: Math.max(-1, lo - 4) };
    if (kind === 0) boxes.push({ ...b, maxY: hi, kind: 'ground' });
    else if (kind === 1) boxes.push({ ...b, maxY: hi + WALL, kind: 'rock' });
    else boxes.push({ ...b, maxY: hi + FENCE, kind: 'shore', ghost: true });
  }

  // --- nav: greedy rectangles of walkable cells (straight lines inside each are clear)
  const taken = new Uint8Array(NX * NZ);
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
    const c = k * NX + i; if (!walk[c] || taken[c]) continue;
    const dOf = (n) => doors.find((d) => inR(d.rect, cx(n % NX), cz(Math.floor(n / NX)))) || null, door = dOf(c);
    const ok = (n) => walk[n] && !taken[n] && dOf(n) === door;
    let i1 = i;
    // (no ledge inside a region: each cell within a step of the ones beside it)
    const near = (a, b) => Math.abs(H[a] - H[b]) <= STEP;
    while (i1 + 1 < NX && ok(k * NX + i1 + 1) && near(k * NX + i1, k * NX + i1 + 1) && i1 - i < 23) i1++;
    let k1 = k;
    while (k1 + 1 < NZ && k1 - k < 23) {
      let row = true;
      for (let j = i; j <= i1; j++) { const n = (k1 + 1) * NX + j; if (!ok(n) || !near(n, n - NX) || (j > i && !near(n, n - 1))) { row = false; break; } }
      if (!row) break;
      k1++;
    }
    let y0 = Infinity, y1 = -Infinity;
    for (let kk = k; kk <= k1; kk++) for (let j = i; j <= i1; j++) { taken[kk * NX + j] = 1; y0 = Math.min(y0, H[kk * NX + j]); y1 = Math.max(y1, H[kk * NX + j]); }
    regions.push({ id: 'bb_' + regions.length, rect: [GX0 + i * CELL, GZ0 + k * CELL, GX0 + (i1 + 1) * CELL, GZ0 + (k1 + 1) * CELL], room: g.name, level: 0, y0, y1, ...(door ? { door: door.id } : {}) });
  }
  return { boxes, walk, solid };
}

export function buildGround({ play, start, starts = {}, open = [], shut = [], doors = [] }) {
  const regions = [], boxes = [], grids = {};
  for (const g of ALL) {
    const town = g === ALL[0], s = town ? start : starts[g.name];
    if (!s) continue;
    const b = buildOn(g, town ? play : () => true, s, open, shut, regions, doors);
    boxes.push(...b.boxes);
    grids[g.name] = { ...b, x0: g.x0, z0: g.z0, nx: g.nx, nz: g.nz, cell: g.cell };
  }
  // (a region of a single cell's width is too tight to walk through: no portal)
  const portals = autoPortals(regions, 0.9);
  // portals across a step too high to walk: not a way through
  const P = portals.filter((p) => Math.abs(heightAt(p.x - (p.axis === 'x' ? 0.25 : 0), p.z - (p.axis === 'z' ? 0.25 : 0)) - heightAt(p.x + (p.axis === 'x' ? 0.25 : 0), p.z + (p.axis === 'z' ? 0.25 : 0))) <= STEP + 0.05);
  // (the ways into a door's ground are shut till it's open)
  const byId = new Map(regions.map((r) => [r.id, r]));
  for (const p of P) { const d = byId.get(p.a).door || byId.get(p.b).door; if (d) p.door = d; }
  const look = (x, z, what) => { const g = gridAt(x, z), b = g && grids[g.name]; if (!b) return false; const [i, k] = cellIn(g, x, z); return !!b[what][k * g.nx + i]; };
  const walkable = (x, z) => look(x, z, 'walk');
  const solidAt = (x, z) => look(x, z, 'solid');
  // (walk and solid: the town's cells; grids: each grid's, by name)
  return { boxes, regions, portals: P, walkable, solidAt, walk: grids.town.walk, solid: grids.town.solid, grids };
}
