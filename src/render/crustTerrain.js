// =============================================================================
// Drawing Call of the Crust's sculpted islands (src/map/terrain.js): the ground
// and rock from each island's height grid (rough rock faces, snow on top,
// ramps drawn as slopes, trench walls boarded, cave ceilings overhead), then
// what's built on it (catwalks, decks, stairs, spiral stairs, railings), the
// ziplines and ice slides, and the set pieces (the lighthouse's turning lamp,
// the storm coils' glow, the barbed wire, the capsized hull, the radio masts,
// the toppled ice pillars, the frozen waterfall, the observatory's dome).
// =============================================================================
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildLighthouse } from './crustLighthouse.js';
import { BoxBatch } from './geometry.js';
import { K } from '../map/terrain.js';
import * as T from './textures.js';
import { themeMaterials } from './crustThemes.js';
import { surface } from './crustSurfaces.js';

const R = (s) => { let x = s >>> 0 || 1; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; };
// smooth-ish noise from sines (deterministic: the same point always moves the same way)
const n3 = (x, y, z) => Math.sin(x * 1.7 + y * 0.9 + Math.sin(z * 1.3 + y * 0.7) * 2.1) * 0.5 + Math.sin(z * 2.3 - x * 0.8 + y * 1.9) * 0.3 + Math.sin(y * 3.1 + x * 0.4 - z * 0.6) * 0.2;

// A bag of triangles per material.
class Bucket {
  constructor() { this.pos = []; this.nor = []; this.uv = []; }
  tri(a, b, c, uvf) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const p of [a, b, c]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz); const [u, v] = uvf(p, nx, ny, nz); this.uv.push(u, v); }
  }
  quad(a, b, c, d, uvf) { this.tri(a, b, c, uvf); this.tri(a, c, d, uvf); }
  mesh(mat) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, mat);
  }
}
// world-space UVs (metres): tops by x/z, faces by along/up
const uvWorld = (p, nx, ny, nz) => (Math.abs(ny) > 0.6 ? [p[0], -p[2]] : Math.abs(nx) > Math.abs(nz) ? [p[2], p[1]] : [p[0], p[1]]);

// The materials for the ground (lit live: too big to bake).
// (They glow a little with their own texture: the moonlight on the snow, which
// a few live lights couldn't give this much ground.)
export function moonlit(map, color, glow, o = {}) {
  return new THREE.MeshStandardMaterial({ roughness: 0.95, map, color, emissive: new THREE.Color(glow), emissiveMap: map, emissiveIntensity: 1, ...o });
}
function groundMaterials(M, wallMats) {
  const tex = (m) => (m && m.map) || null;
  return {
    snow: moonlit(tex(M.snow), '#c4ccda', '#6a7896', { bumpMap: tex(M.snow), bumpScale: 1.2 }),
    rocktop: moonlit(tex(M.snow), '#9aa2b0', '#4c566c'),
    ice: moonlit(tex(M.ice), '#b8cadb', '#4a6a8c', { roughness: 0.5, metalness: 0.1 }),
    iceside: moonlit(tex(M.ice), '#8fb4cc', '#3a6a94', { roughness: 0.4 }),
    duckboard: moonlit(tex(M.duckboard), '#ffffff', '#9a8670'),
    planks: moonlit(tex(M.planks), '#ffffff', '#9a8670'),
    concrete: moonlit(tex(wallMats.bunker), '#9a9890', '#3a3a3e'),
    flagstone: moonlit(tex(M.flagstone), '#ffffff', '#3a3a42'),
    cliff: moonlit(tex(wallMats.cliff), '#7a8290', '#363e4c', { bumpMap: tex(wallMats.cliff), bumpScale: 3 }),
    trench: moonlit(tex(wallMats.trench), '#ffffff', '#8e7c66'),
    cave: moonlit(tex(wallMats.cliff), '#6a7a8c', '#22344a'),
  };
}

// --- the ground ----------------------------------------------------------------------------
export function buildGround(out, group, map, M, wallMats) {
  const G = groundMaterials(M, wallMats);
  out.groundMats = G;
  for (const t of map.terrains) buildIsland(group, t, G, !!map.space);
  if (map.space) for (const t of map.terrains) buildUnderside(group, t, themeMaterials(G)[t.id] || {}, G);
}

function topMat(t, c) {
  const k = t.kind[c], m = t.mat[c];
  if (m === 'lava') return 'lava';
  if (m === 'mud') return 'mud';
  if (k === K.ROCK) return m === 'ice' ? 'ice' : 'rocktop';
  if (m === 'ice' || m === 'icesteps') return 'ice';
  if (m === 'duckboard' || m === 'planks' || m === 'concrete' || m === 'flagstone') return m;
  return 'snow';
}

function buildIsland(group, t, G0, space) {
  // this island's own ground (src/render/crustThemes.js), over the shared ones
  const TM = themeMaterials(G0)[t.id] || {};
  const G = { ...G0, ...TM, snow: TM.top || G0.snow, iceside: TM.iceside || G0.iceside };
  if (TM.cliff && !TM.trench) G.trench = G0.trench;
  const deep = space ? -3 : -0.6;   // (out in space the edge goes on down to the rock underneath)
  const B = new Map();
  const bucket = (k) => { if (!B.has(k)) B.set(k, new Bucket()); return B.get(k); };
  const nx = t.nx, nz = t.nz, C = t.cell;
  const X = (ix) => t.x0 + ix * C, Z = (iz) => t.z0 + iz * C;
  const solid = (c) => t.kind[c] !== K.SEA;
  const walky = (c) => t.kind[c] === K.GROUND || t.kind[c] === K.BLOCK;
  const cave = (c) => t.ceil[c] > 0 && t.kind[c] !== K.ROCK;
  // the height of cell c's top at its corner (cx, cz) (grid corner indices)
  const cellsAt = (cx, cz) => {
    const l = [];
    for (const [ix, iz] of [[cx - 1, cz - 1], [cx, cz - 1], [cx - 1, cz], [cx, cz]]) if (ix >= 0 && iz >= 0 && ix < nx && iz < nz) l.push(t.i(ix, iz));
    return l;
  };
  const cornerH = (c, cx, cz) => {
    const h = t.h[c];
    if (t.kind[c] === K.ROCK) {
      // rock: rounded off with its rocky neighbours, and roughened
      let s = 0, n = 0;
      for (const o of cellsAt(cx, cz)) if (t.kind[o] === K.ROCK && Math.abs(t.h[o] - h) < 3) { s += t.h[o]; n++; }
      return s / n + n3(X(cx) * 0.7, h, Z(cz) * 0.7) * 0.25;
    }
    if (t.smooth[c]) {
      let s = 0, n = 0;
      for (const o of cellsAt(cx, cz)) if ((t.smooth[o] || walky(o)) && Math.abs(t.h[o] - h) <= 0.6) { s += t.h[o]; n++; }
      return s / n;
    }
    return h;
  };
  // cave ceilings: the same, upside down
  const ceilAt = (c, cx, cz) => {
    const h = t.ceil[c];
    let s = 0, n = 0;
    for (const o of cellsAt(cx, cz)) if (cave(o) && Math.abs(t.ceil[o] - h) < 3) { s += t.ceil[o]; n++; }
    return s / n + n3(X(cx) * 0.9, h * 2, Z(cz) * 0.9) * 0.45;
  };
  // the rock over a cave: about as high as the rock round it
  const roof = new Float32Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const c = t.i(ix, iz);
    if (!cave(c)) continue;
    let s = 0, n = 0;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const jx = ix + dx, jz = iz + dz;
      if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
      const o = t.i(jx, jz);
      if (t.kind[o] === K.ROCK) { s += t.h[o]; n++; }
    }
    roof[c] = Math.max(t.ceil[c] + 2.5, n ? s / n : t.ceil[c] + 4);
  }
  // corners of a cell, going round: NW, NE, SE, SW
  const corners = (ix, iz) => [[ix, iz], [ix + 1, iz], [ix + 1, iz + 1], [ix, iz + 1]];
  const top = (c, ix, iz) => corners(ix, iz).map(([cx, cz]) => [X(cx), cornerH(c, cx, cz), Z(cz)]);

  // a vertical face along a cell edge, from the edge's top (a1 at p, a2 at q) down to the
  // lower side's top (b1, b2), facing `face` (a unit vector out); roughened if tall
  const face = (bk, p, q, a1, a2, b1, b2, out, rough) => {
    const hmax = Math.max(a1 - b1, a2 - b2);
    if (hmax < 0.01) return;
    const rows = rough ? Math.max(1, Math.ceil(hmax / 1.4)) : 1;
    const cols = rough && hmax > 1.2 ? 2 : 1;
    const pt = (s, r) => {
      const x = p[0] + (q[0] - p[0]) * s, z = p[1] + (q[1] - p[1]) * s;
      const ytop = a1 + (a2 - a1) * s, ybot = b1 + (b2 - b1) * s;
      const y = ytop + (ybot - ytop) * r;
      let ox = 0, oz = 0;
      if (rough && r > 0 && r < 1 && s > 0 && s < 1) {
        const amp = Math.min(0.4, 0.1 * hmax) * Math.sin(Math.PI * s);
        const n = n3(x * 0.8, y * 0.8, z * 0.8) * amp;
        ox = out[0] * n; oz = out[1] * n;
      }
      return [x + ox, y, z + oz];
    };
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const s0 = k / cols, s1 = (k + 1) / cols, r0 = r / rows, r1 = (r + 1) / rows;
      // wind so the face looks out (toward the lower side)
      const A = pt(s0, r0), Bq = pt(s1, r0), Cq = pt(s1, r1), D = pt(s0, r1);
      const ex = q[0] - p[0], ez = q[1] - p[1];
      // (edge direction x up) points one way or the other: pick the order that faces `out`
      const facing = (-ez) * out[0] + (ex) * out[1];   // cross(edge, up) . out
      if (facing < 0) bk.quad(A, Bq, Cq, D, uvWorld); else bk.quad(A, D, Cq, Bq, uvWorld);
    }
  };

  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const c = t.i(ix, iz);
    if (!solid(c)) continue;
    const roomCell = t.kind[c] === K.ROOM;
    const tc = top(c, ix, iz);
    // the top (under a building or a big model too, a hair lower: no holes
    // round a floor's edge or a model's foot to see through into space)
    {
      // (a floor of its own on this island: the hub's cobbles, the planks...)
      const mk = t.mat[c];
      const bk = bucket(t.kind[c] !== K.ROCK && mk && TM[mk] ? mk : t.kind[c] === K.ROCK && mk && TM[mk + 'Top'] ? mk + 'Top' : topMat(t, c));
      const q = roomCell ? tc.map((p) => [p[0], p[1] - 0.06, p[2]]) : tc;
      // NW, NE, SE, SW: wind for an upward normal
      bk.quad(q[0], q[3], q[2], q[1], uvWorld);
    }
    // the edges: wherever this cell stands higher than its neighbour
    // [dx, dz, our corner 1, our corner 2, outward, the neighbour's matching corners]
    const edges = [
      [0, -1, 0, 1, [0, -1], { 0: 3, 1: 2 }],   // north edge: NW -> NE
      [1, 0, 1, 2, [1, 0], { 1: 0, 2: 3 }],     // east: NE -> SE
      [0, 1, 2, 3, [0, 1], { 2: 1, 3: 0 }],     // south: SE -> SW
      [-1, 0, 3, 0, [-1, 0], { 3: 2, 0: 1 }],   // west: SW -> NW
    ];
    for (const [dx, dz, i1, i2, outv, other] of edges) {
      const jx = ix + dx, jz = iz + dz;
      let b1, b2, n = -1;
      const p = [tc[i1][0], tc[i1][2]], q = [tc[i2][0], tc[i2][2]];
      if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) { b1 = b2 = deep; }
      else {
        n = t.i(jx, jz);
        if (!solid(n)) { b1 = b2 = deep; }
        else {
          // the neighbour's top along the same edge
          const tn = top(n, jx, jz);
          b1 = tn[other[i1]][1]; b2 = tn[other[i2]][1];
        }
      }
      const a1 = tc[i1][1], a2 = tc[i2][1];
      if ((a1 + a2) / 2 <= (b1 + b2) / 2 + 0.005) continue;
      const tall = Math.max(a1 - b1, a2 - b2);
      let mat;
      if (t.kind[c] === K.ROCK) mat = t.mat[c] === 'ice' ? 'iceside' : (t.mat[c] && TM[t.mat[c]] ? t.mat[c] : 'cliff');
      else if (n >= 0 && t.mat[n] === 'duckboard' && t.mat[c] !== 'duckboard' && tall > 0.6) mat = 'trench';
      else if ((t.mat[c] === 'ice' || t.mat[c] === 'icesteps') && t.id === 'caves') mat = 'iceside';
      else if (t.mat[c] === 'lava') mat = 'lava';
      else if (tall <= 0.5) mat = topMat(t, c) === 'rocktop' ? 'cliff' : topMat(t, c);
      else if (t.mat[c] === 'planks' || t.mat[c] === 'duckboard') mat = t.mat[c];
      else mat = 'cliff';
      face(bucket(mat), p, q, a1, a2, b1, b2, outv, mat === 'cliff' || mat === 'iceside' || mat === 'wall');
    }
    // a cave: its ceiling overhead, the rock above that
    if (cave(c)) {
      const cc = corners(ix, iz).map(([cx, cz]) => [X(cx), ceilAt(c, cx, cz), Z(cz)]);
      bucket('cave').quad(cc[0], cc[1], cc[2], cc[3], uvWorld);   // facing down
      const rr = corners(ix, iz).map(([cx, cz]) => [X(cx), roof[c] + n3(X(cx), 3, Z(cz)) * 0.4, Z(cz)]);
      bucket('rocktop').quad(rr[0], rr[3], rr[2], rr[1], uvWorld);
      for (const [dx, dz, i1, i2, outv] of edges) {
        const jx = ix + dx, jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
        const n = t.i(jx, jz);
        const p = [cc[i1][0], cc[i1][2]], q = [cc[i2][0], cc[i2][2]];
        if (t.kind[n] === K.ROCK) {
          // the roof meets the mountain: a step where it's lower
          if (t.h[n] < roof[c] - 0.05) face(bucket('cliff'), p, q, roof[c], roof[c], t.h[n], t.h[n], outv, true);
          continue;
        }
        if (cave(n)) {
          // ceilings at different heights: the step between them (facing the higher)
          if (t.ceil[n] > t.ceil[c] + 0.05) face(bucket('cave'), p, q, t.ceil[n], t.ceil[n], cc[i1][1], cc[i2][1], outv, true);
          if (roof[n] < roof[c] - 0.05) face(bucket('cliff'), p, q, roof[c], roof[c], roof[n], roof[n], outv, true);
          continue;
        }
        // open sky beside it (the cave's mouth, the hole over the falls): rock from the ceiling up
        face(bucket('cliff'), p, q, roof[c], roof[c], cc[i1][1], cc[i2][1], outv, true);
      }
    }
  }
  for (const [k, bk] of B) {
    const m = bk.mesh(G[k] || G.cliff);
    if (m) { m.userData.noBake = true; group.add(m); }
  }
}

// --- the rock each island floats on: a jagged mass tapering away underneath --------------
function buildUnderside(group, t, TM, G) {
  const r = R(t.nx * 7 + t.nz);
  let sx = 0, sz = 0, n = 0;
  for (let iz = 0; iz < t.nz; iz++) for (let ix = 0; ix < t.nx; ix++) if (t.kind[t.i(ix, iz)] !== K.SEA) { sx += t.cx(ix); sz += t.cz(iz); n++; }
  if (!n) return;
  const cx = sx / n, cz = sz / n;
  // how far the island reaches in each direction
  const A = 64, rad = [];
  for (let k = 0; k < A; k++) {
    const a = (k / A) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    let best = 2;
    for (let d = 0; d < 120; d += 0.5) { const c = t.cellAt(cx + dx * d, cz + dz * d); if (c >= 0 && t.kind[c] !== K.SEA) best = d; }
    rad.push(best);
  }
  const mean = rad.reduce((a, b) => a + b, 0) / A;
  const depth = mean * 0.95 + 8;
  const rings = [[0.99, 0], [0.92, 0.08], [0.78, 0.22], [0.58, 0.42], [0.36, 0.64], [0.16, 0.85], [0.03, 1]];
  const pos = [];
  const P = rings.map(([f, d], j) => rad.map((R0, k) => {
    const a = (k / A) * Math.PI * 2, wob = j === 0 ? 1 : 1 + (r() - 0.5) * 0.35;
    const rr = R0 * f * wob;
    return [cx + Math.cos(a) * rr, -3.2 - depth * d + (j ? (r() - 0.5) * 3 : 0), cz + Math.sin(a) * rr];
  }));
  for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < A; k++) {
    const k2 = (k + 1) % A;
    const a = P[j][k], b = P[j][k2], c = P[j + 1][k2], d = P[j + 1][k];
    pos.push(...a, ...d, ...c, ...a, ...c, ...b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const uv = [];
  for (let i = 0; i < pos.length; i += 3) uv.push(Math.atan2(pos[i + 2] - cz, pos[i] - cx) * mean / 3, pos[i + 1] / 3);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const um = TM.under || (() => { const u = (TM.cliff || G.cliff).clone(); u.side = THREE.DoubleSide; return u; })();
  const m = new THREE.Mesh(g, um);
  m.userData.noBake = true;
  group.add(m);
  // a few chunks drifting alongside it
  const rock = TM.under || TM.rocktop || G.cliff;
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = mean * (1.1 + r() * 0.5), s = 1.5 + r() * 4;
    const geo = new THREE.DodecahedronGeometry(s, 1);
    const pp = geo.attributes.position;
    for (let q = 0; q < pp.count; q++) { const k = 0.7 + r() * 0.5; pp.setXYZ(q, pp.getX(q) * k, pp.getY(q) * k * 0.8, pp.getZ(q) * k); }
    geo.computeVertexNormals();
    const c = new THREE.Mesh(geo, rock);
    c.position.set(cx + Math.cos(a) * d, -6 - r() * 22, cz + Math.sin(a) * d);
    c.rotation.set(r() * 3, r() * 3, r() * 3);
    c.userData.noBake = true;
    group.add(c);
  }
}

// --- what's built on it ------------------------------------------------------------------
export function buildStructures(out, group, map, mats, M, wallMats) {
  const steel = new THREE.MeshStandardMaterial({ color: '#5a626c', roughness: 0.6, metalness: 0.4, emissive: new THREE.Color('#1c222c') });
  const gt = grateTexture();
  const grate = moonlit(gt, '#9aa0a8', '#3a4048', { roughness: 0.6, metalness: 0.4 });
  const looks = {
    steel: surface('metal_plate_02', { scale: 2, tint: '#a0a4ac', glow: 0.2, metal: 0.4, rough: 0.8 }),
    grate: surface('metal_grate_rusty', { scale: 1.6, tint: '#b0a49a', glow: 0.2, metal: 0.4, rough: 0.8 }),
    concrete: surface('concrete_wall_008', { scale: 3, tint: '#a8a6a0', glow: 0.18 }),
    stone: surface('rock_wall_08', { scale: 2.5, tint: '#a09890', glow: 0.18 }),
    planks: surface('brown_planks_05', { scale: 2.2, tint: '#b0a090', glow: 0.18 }),
    deck: surface('dark_wooden_planks', { scale: 2.2, tint: '#a09080', glow: 0.18 }),
    hullTop: moonlit(wallMats.hull && wallMats.hull.map, '#8a4a40', '#3a2420', { roughness: 0.85, metalness: 0.3 }),
    ice: surface('snow_02', { scale: 3, tint: '#a8cce8', glow: 0.25, rough: 0.35 }),
  };
  looks.scaffold = looks.grate;
  const batches = new Map();
  const get = (k) => { if (!batches.has(k)) batches.set(k, new BoxBatch()); return batches.get(k); };
  const posts = new BoxBatch();
  const groundAt = (x, z) => { for (const t of map.terrains) if (t.contains(x, z)) return t.heightAt(x, z); return 0; };
  // where a leg comes down on: the ground, or a roof, a floor or a deck below (never through them)
  const allBoxes = map.structures.flatMap((st) => st.boxes.filter((b) => b.kind !== 'rail').map((b) => ({ b, id: st.id })));
  const roofs = map.rooms.filter((r) => !r.virtual).map((r) => ({ rect: r.rect, top: (r.y || 0) + (r.height || 3) }));
  const supportAt = (x, z, below, self) => {
    let g = groundAt(x, z);
    for (const { b, id } of allBoxes) if (id !== self && b.maxY < below && b.maxY > g && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) g = b.maxY;
    for (const r of roofs) if (r.top < below && r.top > g && x >= r.rect[0] - 0.3 && x <= r.rect[2] + 0.3 && z >= r.rect[1] - 0.3 && z <= r.rect[3] + 0.3) g = r.top;
    return g;
  };
  for (const s of map.structures) {
    for (const b of s.boxes) {
      const look = b.look || s.look || 'steel';
      if (look === 'hidden') continue;   // (a model draws it: the galleon's decks)
      if (b.kind === 'rail' && look === 'stone') { get('stone').add({ ...b, maxY: b.minY + 0.95, minX: b.minX - 0.1, maxX: b.maxX + 0.1, minZ: b.minZ - 0.1, maxZ: b.maxZ + 0.1 }); continue; }
      if (b.kind === 'rail') {
        // a railing: a top bar and posts
        const along = b.maxX - b.minX > b.maxZ - b.minZ;
        posts.add({ minX: b.minX, maxX: b.maxX, minY: b.maxY - 0.07, maxY: b.maxY, minZ: b.minZ, maxZ: b.maxZ });
        posts.add({ minX: b.minX, maxX: b.maxX, minY: b.minY + 0.5, maxY: b.minY + 0.55, minZ: b.minZ, maxZ: b.maxZ });
        const L = along ? b.maxX - b.minX : b.maxZ - b.minZ;
        const n = Math.max(1, Math.round(L / 1.4));
        for (let i = 0; i <= n; i++) {
          const a = (along ? b.minX : b.minZ) + (L * i) / n;
          if (along) posts.add({ minX: a - 0.04, maxX: a + 0.04, minY: b.minY, maxY: b.maxY, minZ: b.minZ, maxZ: b.maxZ });
          else posts.add({ minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY, minZ: a - 0.04, maxZ: a + 0.04 });
        }
        continue;
      }
      get(look).add(b, { skip: b.minY < -0.5 ? new Set([3]) : null });
    }
    // catwalks and platforms up on legs
    if (s.kind === 'deck' && s.y > 2 && s.look === 'stone') {
      // a stone bridge: square piers every few metres
      const [x0, z0, x1, z1] = s.rect, along = x1 - x0 > z1 - z0, L = along ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(L / 6));
      for (let i = 1; i < n; i++) {
        const u = (along ? x0 : z0) + L * i / n, cx = along ? u : (x0 + x1) / 2, cz = along ? (z0 + z1) / 2 : u;
        const g = supportAt(cx, cz, s.y - 0.35, s.id);
        if (s.y - 0.3 - g > 0.6) get('stone').add({ minX: cx - 0.45, maxX: cx + 0.45, minZ: cz - 0.45, maxZ: cz + 0.45, minY: g - 0.2, maxY: s.y - 0.3 });
      }
    }
    if (s.kind === 'deck' && s.y > 2 && /grate|scaffold|steel/.test(s.look || '')) {
      const [x0, z0, x1, z1] = s.rect;
      const legs = [];
      const nx = Math.max(1, Math.round((x1 - x0) / 4)), nz = Math.max(1, Math.round((z1 - z0) / 4));
      for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) if (i === 0 || k === 0 || i === nx || k === nz) legs.push([x0 + 0.15 + (x1 - x0 - 0.3) * i / nx, z0 + 0.15 + (z1 - z0 - 0.3) * k / nz]);
      for (const [x, z] of legs) {
        const g = supportAt(x, z, s.y - 0.35, s.id);
        if (s.y - 0.3 - g < 0.6) continue;
        posts.add({ minX: x - 0.07, maxX: x + 0.07, minY: g - 0.2, maxY: s.y - 0.3, minZ: z - 0.07, maxZ: z + 0.07 });
      }
    }
  }
  for (const [k, b] of batches) { const m = new THREE.Mesh(b.build(), looks[k] || steel); m.userData.noBake = true; group.add(m); }
  const pm = new THREE.Mesh(posts.build(), looks.steel); pm.userData.noBake = true; group.add(pm);
}

// --- guard rails along the ledges and round the decks (map.rails), and the gaps
// left to dive off (map.dives). Each island its own kind: a stone parapet round
// the forge, timber fencing at the shipwreck and the caves, yellow pipe rails
// at the research base, sandbags along the trenches.
export function buildRails(out, group, map) {
  if (!map.rails || !map.rails.length) return;
  const mats = {
    stone: surface('rock_wall_08', { scale: 1.6, tint: '#b0a498', glow: 0.18 }),
    cap: surface('stone_floor', { scale: 1.6, tint: '#b8aca0', glow: 0.18 }),
    wood: surface('dark_wooden_planks', { scale: 1.2, tint: '#a08a74', glow: 0.16 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c49a2c', roughness: 0.55, metalness: 0.35, emissive: new THREE.Color('#2a2008') }),
    sandbag: surface('coast_sand_01', { scale: 0.9, tint: '#a8966c', glow: 0.14, normal: 1.5 }),
  };
  // (one set of meshes per island, so each can be culled on its own)
  const islands = [...new Set(map.rails.map((r) => r.island))];
  for (const isl of islands) buildRailSet(group, map.rails.filter((r) => r.island === isl), mats);
  if (!CONFIG.crust.rails.rimOnly) buildDives(out, group, map);   // (every ledge is a place to dive: no marks)
}

function buildRailSet(group, rails, mats) {
  const stone = new BoxBatch(), cap = new BoxBatch();
  const bars = { wood: [], metal: [] }, bags = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  // a box from point a to point b (a bar, a post), w by h thick
  const bar = (list, ax, ay, az, bx, by, bz, w, h) => list.push([ax, ay, az, bx, by, bz, w, h]);
  for (const r of rails) {
    const along = r.axis === 'z';                         // (it runs along x)
    const inset = -r.side * 0.07;                          // on the high side of the edge
    const P = (a, y) => along ? [a, y, r.line + inset] : [r.line + inset, y, a];
    const yAt = (a) => r.ys[Math.min(r.ys.length - 1, Math.max(0, Math.floor((a - r.a0) / r.step + 1e-6)))];
    if (r.style === 'stone') {
      // a parapet: a box per level stretch, a capstone along its top
      let k0 = 0;
      for (let k = 1; k <= r.ys.length; k++) {
        if (k < r.ys.length && Math.abs(r.ys[k] - r.ys[k0]) < 0.06) continue;
        const a0 = r.a0 + k0 * r.step, a1 = Math.min(r.a1, r.a0 + k * r.step), y = r.ys[k0];
        const l0 = r.side > 0 ? r.line - 0.42 : r.line, l1 = r.side > 0 ? r.line : r.line + 0.42;
        const bx = along ? { minX: a0, maxX: a1, minZ: l0, maxZ: l1 } : { minX: l0, maxX: l1, minZ: a0, maxZ: a1 };
        stone.add({ ...bx, minY: y - 0.3, maxY: y + 0.88 });
        const c = along ? { minX: a0 - 0.02, maxX: a1 + 0.02, minZ: l0 - 0.05, maxZ: l1 + 0.05 } : { minX: l0 - 0.05, maxX: l1 + 0.05, minZ: a0 - 0.02, maxZ: a1 + 0.02 };
        cap.add({ ...c, minY: y + 0.88, maxY: y + 1.0 });
        k0 = k;
      }
      continue;
    }
    if (r.style === 'sandbag') {
      // three courses of sandbags, each course offset half a bag
      const L = r.a1 - r.a0, n = Math.max(1, Math.round(L / 0.56));
      for (let row = 0; row < 3; row++) for (let i = 0; i < n + (row % 2 ? 0 : 0); i++) {
        const a = r.a0 + (i + (row % 2 ? 0.75 : 0.25)) * (L / n);
        if (a > r.a1 - 0.1) continue;
        const y = yAt(a) + 0.15 + row * 0.27;
        bags.push([...P(a, y), along, (i * 7 + row * 3) % 5]);
      }
      continue;
    }
    // posts and two bars (timber or pipe)
    const list = bars[r.style] || bars.metal;
    const L = r.a1 - r.a0, n = Math.max(1, Math.ceil(L / 1.6));
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = r.a0 + (L * i) / n; pts.push([a, yAt(Math.min(a, r.a1 - 0.01))]); }
    const thick = r.style === 'wood' ? 0.13 : 0.06;
    for (const [a, y] of pts) bar(list, ...P(a, y - 0.1), ...P(a, y + 1.05), thick, thick);
    for (let i = 0; i < pts.length - 1; i++) {
      const [a0, y0] = pts[i], [a1, y1] = pts[i + 1];
      for (const h of r.style === 'wood' ? [0.5, 0.98] : [0.52, 1.02]) bar(list, ...P(a0, y0 + h), ...P(a1, y1 + h), r.style === 'wood' ? 0.07 : 0.05, r.style === 'wood' ? 0.15 : 0.05);
    }
  }
  const addBatch = (b, m) => { if (!b.count) return; const mesh = new THREE.Mesh(b.build(), m); mesh.userData.noBake = true; group.add(mesh); };
  addBatch(stone, mats.stone); addBatch(cap, mats.cap);
  for (const [style, list] of Object.entries(bars)) {
    if (!list.length) continue;
    const geo = style === 'wood' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.CylinderGeometry(0.5, 0.5, 1, 8).rotateX(Math.PI / 2);
    const im = new THREE.InstancedMesh(geo, mats[style], list.length);
    list.forEach(([ax, ay, az, bx, by, bz, w, h], i) => {
      const d = v.set(bx - ax, by - ay, bz - az), len = d.length();
      // box/cylinder's long axis is z: turn z onto the bar
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().normalize());
      // (keep the bar's "height" upright for timber)
      m4.compose(new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), q, sc.set(w, h, len));
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.userData.noBake = true;
    group.add(im);
  }
  if (bags.length) {
    const geo = new THREE.SphereGeometry(0.5, 7, 4);
    const im = new THREE.InstancedMesh(geo, mats.sandbag, bags.length);
    bags.forEach(([x, y, z, along, j], i) => {
      q.setFromAxisAngle(up, (along ? 0 : Math.PI / 2) + (j - 2) * 0.06);
      m4.compose(v.set(x, y, z), q, sc.set(0.6, 0.3, 0.42));
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.userData.noBake = true;
    group.add(im);
  }
}

// the dive spots: a chevron on the lip pointing over the edge, a faint violet glow
function buildDives(out, group, map) {
  const chev = chevronTexture();
  for (const d of map.dives || []) {
    const p = (map.portals || []).filter((pp) => pp.drop && Math.hypot(pp.x - d.x, pp.z - d.z) < 3).sort((a, b) => Math.hypot(a.x - d.x, a.z - d.z) - Math.hypot(b.x - d.x, b.z - d.z))[0];
    if (!p) continue;
    const dx = p.axis === 'x' ? p.dirAB : 0, dz = p.axis === 'z' ? p.dirAB : 0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: chev, color: new THREE.Color(1.6, 0.9, 2.4), transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    m.position.set(p.x - dx * 0.95, d.y + 0.04, p.z - dz * 0.95);
    m.rotation.y = Math.atan2(-dx, -dz);
    group.add(m);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: new THREE.Color(0.9, 0.4, 1.6), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(2.2); glow.position.set(p.x - dx * 0.9, d.y + 0.5, p.z - dz * 0.9);
    group.add(glow);
    (out.glows || (out.glows = [])).push({ s: glow, base: 2.2, rate: 1.1 });
  }
}

function chevronTexture() {
  const [c, g] = T.makeCanvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const y of [34, 70]) { g.beginPath(); g.moveTo(28, y + 30); g.lineTo(64, y); g.lineTo(100, y + 30); g.stroke(); }
  return T.toTexture(c);
}

function grateTexture() {
  const [c, g] = T.makeCanvas(64, 64);
  g.fillStyle = '#3a3e44'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#8a9098'; g.lineWidth = 3;
  for (let i = 0; i <= 64; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); }
  g.lineWidth = 1.5;
  for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
  const tex = T.toTexture(c, { repeat: true });
  tex.repeat.set(1, 1);
  return tex;
}

// --- ziplines and ice slides --------------------------------------------------------------
export function buildRides(out, group, map, mats) {
  const iron = mats.iron;
  const ice = new THREE.MeshStandardMaterial({ color: '#a8d4ec', roughness: 0.15, metalness: 0.05, emissive: new THREE.Color('#1a4060'), transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  for (const r of map.rides) {
    const P = r.pts.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    if (r.kind === 'zip') {
      // the cable (a little sag), and a pole at each end
      const a = P[0], b = P[P.length - 1];
      const mid = a.clone().lerp(b, 0.5); mid.y -= a.distanceTo(b) * CONFIG.crust.ride.sag;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.035, 5), iron));
      for (const e of [a, b]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.2, 8), iron);
        pole.position.set(e.x, e.y - 1.5, e.z); group.add(pole);
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 12), mats.steel);
        wheel.position.set(e.x, e.y + 0.05, e.z); wheel.lookAt(e.x + (b.x - a.x), e.y, e.z + (b.z - a.z)); group.add(wheel);
      }
      // a hanging handle at the top
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), mats.hullRed);
      h.position.set(a.x, a.y - 1.0, a.z); group.add(h);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 4), iron); st.position.set(a.x, a.y - 0.5, a.z); group.add(st);
    } else {
      // an ice chute: a half pipe along the path
      const pts = [];
      for (let i = 0; i < P.length - 1; i++) {
        const n = Math.max(1, Math.ceil(P[i].distanceTo(P[i + 1]) / 0.6));
        for (let k = 0; k < n; k++) pts.push(P[i].clone().lerp(P[i + 1], k / n));
      }
      pts.push(P[P.length - 1].clone());
      const segs = 10, W = 1.15, D = 0.55;
      const pos = [], idx = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
        const dir = q.clone().sub(o); dir.y = 0; dir.normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        for (let k = 0; k <= segs; k++) {
          const a = Math.PI * (k / segs);
          const v = p.clone().addScaledVector(side, Math.cos(a) * W); v.y += -Math.sin(a) * D + D - 0.05;
          pos.push(v.x, v.y, v.z);
        }
      }
      for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < segs; k++) {
        const a = i * (segs + 1) + k, b = a + 1, c = a + segs + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, ice); m.userData.noBake = true; group.add(m);
      // a glow at the mouth so you can see it's a ride
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(170,230,255,1)', 'rgba(120,200,255,0)'), color: new THREE.Color(0.8, 1.6, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(2.2); glow.position.set(P[0].x, P[0].y + 0.6, P[0].z); group.add(glow);
      out.glows.push({ s: glow, base: 2.2, rate: 2.2 });
    }
  }
}

// --- the set pieces ------------------------------------------------------------------------
export function buildDecor(out, group, map, mats, mv) {
  for (const d of map.decor) {
    switch (d.kind) {
      case 'beacon': out.beams.push(beacon(group, d, mats, mv)); break;
      case 'screwpile': buildLighthouse(group, d, mats); break;
      case 'storm': stormGlows(out, group, d); break;
      case 'wire': wireLine(out, group, d); break;
      case 'capsized': capsized(group, d, mats); break;
      case 'mast': mast(out, group, d); break;
      case 'pillar': pillar(group, d, mats); break;
      case 'icefall': icefall(group, d, mats, mv); break;
      case 'fort': fort(group, d, mats); break;
      default: break;
    }
  }
  for (const rm of map.rooms) {
    if (rm.lighthouse) out.beams.push(lighthouseTop(group, rm, mats, mv));
    if (rm.dome) dome(group, rm, mats);
  }
}

function capsized(group, d, mats) {
  const [x0, z0, x1, z1] = d.rect, Y = d.keelY;
  const g = new THREE.Group();
  const cx = (x0 + x1) / 2;
  // the keel along the top, a rudder and a screw at the stern end, rust streaks
  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, z1 - z0 - 1), mats.hullRed); keel.position.set(cx, Y + 0.25, (z0 + z1) / 2);
  // (split round the hole)
  void keel;
  const [hx0, hz0, hx1, hz1] = d.hole;
  for (const [a, b] of [[z0 + 0.5, hz0], [hz1, z1 - 0.5]]) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, b - a), mats.hullRed); k.position.set(cx - 2.6, Y + 0.2, (a + b) / 2); g.add(k); }
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 2.4), mats.hullRed); rudder.position.set(cx, Y + 1.5, z0 + 0.5); g.add(rudder);
  const screw = new THREE.Group();
  for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.5), mats.iron); b.rotation.z = (k * Math.PI * 2) / 3; b.position.y = 0; screw.add(b); }
  screw.position.set(cx, Y - 1.4, z0 - 0.4); g.add(screw);
  // the torn edge of the hole
  const torn = new THREE.MeshStandardMaterial({ color: '#2a1410', roughness: 1 });
  for (const [ax, az, bx, bz] of [[hx0, hz0, hx1, hz0], [hx0, hz1, hx1, hz1], [hx0, hz0, hx0, hz1], [hx1, hz0, hx1, hz1]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.15, bx - ax), 0.12, Math.max(0.15, bz - az)), torn);
    m.position.set((ax + bx) / 2, Y + 0.02, (az + bz) / 2); m.rotation.z = 0.15; g.add(m);
  }
  // snow drifted on the bottom plates
  const sn = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 1, 0.08, hz0 - z0 - 1), mats.snowCap); sn.position.set(cx, Y + 0.05, (z0 + hz0) / 2); g.add(sn);
  group.add(g);
}

// The lighthouse's lamp (the model's lantern): a light turning, its beams out over the void.
function beacon(group, d, mats, mv) {
  const g = new THREE.Group();
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.4, 2.2) })); g.add(lamp);
  const beamGeo = new THREE.ConeGeometry(6, 90, 24, 1, true).rotateZ(Math.PI / 2).translate(45, 0, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.85, 0.75), transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const pivot = new THREE.Group(); g.add(pivot);
  for (const a of [0, Math.PI]) { const bm = new THREE.Mesh(beamGeo, beamMat); bm.rotation.y = a; pivot.add(bm); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,240,200,1)', 'rgba(255,220,150,0)'), color: new THREE.Color(2, 1.8, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(4.5); g.add(halo);
  g.position.set(d.x, d.y, d.z);
  group.add(g);
  mv.addVirtualLight({ x: d.x, y: d.y, z: d.z }, 0xffe6b8, 24, 18, 1.6);
  return { pivot, halo };
}

// The storm asteroid's coils: violet glows crackling on their tops.
function stormGlows(out, group, d) {
  const tex = T.softDotTexture('rgba(210,170,255,1)', 'rgba(140,90,255,0)');
  for (const [x, y, z] of d.coils) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(1.6, 1.1, 3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(2.6); s.position.set(x, y, z); group.add(s);
    out.glows.push({ s, base: 2.6, rate: 17, crackle: true });
  }
}

// Barbed wire on stakes round the place you can't go yet (gone when it opens).
function wireLine(out, group, d) {
  if (!d.pts.length) return;
  const has = new Set(d.pts.map(([x, , z]) => Math.round(x * 2) + ',' + Math.round(z * 2)));
  // a coil of concertina wire, a metre long, along x
  const pts = [];
  for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI * 2 * 7; pts.push(new THREE.Vector3(-0.5 + i / 60, 0.42 + Math.sin(a) * 0.36, Math.cos(a) * 0.36)); }
  const coilGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.018, 3, false);
  const stakeGeo = new THREE.BoxGeometry(0.07, 1.1, 0.07).translate(0, 0.45, 0);
  const coilMat = new THREE.MeshStandardMaterial({ color: '#4a4440', roughness: 0.6, metalness: 0.6, emissive: new THREE.Color('#2a1408') });
  const stakeMat = new THREE.MeshStandardMaterial({ color: '#2a1e16', roughness: 1, emissive: new THREE.Color('#120a06') });
  const coils = new THREE.InstancedMesh(coilGeo, coilMat, d.pts.length);
  const stakes = new THREE.InstancedMesh(stakeGeo, stakeMat, d.pts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  d.pts.forEach(([x, y, z], i) => {
    const alongX = has.has(Math.round(x * 2 + 2) + ',' + Math.round(z * 2)) || has.has(Math.round(x * 2 - 2) + ',' + Math.round(z * 2));
    q.setFromAxisAngle(up, alongX ? 0 : Math.PI / 2);
    m.compose(new THREE.Vector3(x, y, z), q, one); coils.setMatrixAt(i, m);
    q.setFromAxisAngle(new THREE.Vector3(0.2 * Math.sin(i), 0, 0.2 * Math.cos(i * 1.7)).normalize(), 0.12);
    m.compose(new THREE.Vector3(x + 0.4, y, z + 0.4), q, one); stakes.setMatrixAt(i, m);
  });
  for (const im of [coils, stakes]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.userData.noBake = true; group.add(im); }
  (out.gateWire || (out.gateWire = [])).push(coils, stakes);
}

function mast(out, group, d) {
  const g = new THREE.Group();
  const lines = [];
  const base = d.size / 2 + 0.2, topW = 0.5, h = d.h;
  const corner = (k, y) => { const s = base + (topW - base) * (y / h); return [(k & 1 ? 1 : -1) * s, y, (k & 2 ? 1 : -1) * s]; };
  for (let k = 0; k < 4; k++) lines.push(...corner(k, 0), ...corner(k, h));
  for (let y = 0; y < h; y += 2.5) for (const [k1, k2] of [[0, 1], [1, 3], [3, 2], [2, 0]]) { lines.push(...corner(k1, y), ...corner(k2, y + 2.5)); lines.push(...corner(k1, y + 2.5), ...corner(k2, y + 2.5)); }
  // (real steel: the legs thick, the bracing thinner, not one-pixel lines)
  const geos = [];
  const up = new THREE.Vector3(0, 1, 0), A = new THREE.Vector3(), B = new THREE.Vector3();
  for (let i = 0; i < lines.length; i += 6) {
    A.set(lines[i], lines[i + 1], lines[i + 2]); B.set(lines[i + 3], lines[i + 4], lines[i + 5]);
    const len = A.distanceTo(B);
    if (len < 0.01) continue;
    const leg = i < 4 * 6;
    const r = leg ? 0.16 * (1 - (A.y + B.y) / (4 * h)) + 0.07 : 0.06;
    const c = new THREE.CylinderGeometry(r, r, len, 6, 1, true);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, B.clone().sub(A).normalize()));
    c.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
    geos.push(c.toNonIndexed());
  }
  const steel = new THREE.MeshStandardMaterial({ color: '#9a2e24', roughness: 0.6, metalness: 0.5, emissive: new THREE.Color('#2a0806'), side: THREE.DoubleSide });
  g.add(new THREE.Mesh(mergeGeometries(geos), steel));
  const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,80,60,1)', 'rgba(255,20,10,0)'), color: new THREE.Color(3, 0.4, 0.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  lamp.scale.setScalar(2.4); lamp.position.y = h + 0.5; g.add(lamp);
  if (out.stackHeads) out.stackHeads.push({ lamp, phase: 0.5 });
  g.position.set(d.x, d.y, d.z);
  group.add(g);
}

function pillar(group, d, mats) {
  const a = new THREE.Vector3(...d.a), b = new THREE.Vector3(...d.b);
  // sunk so its top is the ramp you walk up
  a.y -= d.r * 0.75; b.y -= d.r * 0.75;
  const len = a.distanceTo(b) + 1.5;
  const geo = new THREE.CylinderGeometry(d.r, d.r * 1.1, len, 9, 6);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.85 + Math.abs(n3(p.getX(i) * 3, p.getY(i), p.getZ(i) * 3)) * 0.3; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mats.ice);
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  group.add(m);
  // the broken base, jagged
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(d.r * 0.9, d.r * 1.2, 1.4, 7), mats.ice);
  stump.position.set(d.a[0] - (d.b[0] - d.a[0]) * 0.08, d.a[1] + 0.6, d.a[2] - (d.b[2] - d.a[2]) * 0.08); stump.rotation.z = 0.3;
  group.add(stump);
}

function icefall(group, d, mats, mv) {
  const g = new THREE.CylinderGeometry(d.w / 2, d.w / 1.6, d.h, 16, 10, true, Math.PI * 0.1, Math.PI * 1.2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.8 + Math.abs(n3(p.getX(i), p.getY(i) * 0.6, p.getZ(i))) * 0.45; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#b8e2f8', roughness: 0.15, emissive: new THREE.Color('#2a6a9a'), emissiveIntensity: 0.8, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.position.set(d.x, d.y + d.h / 2, d.z); m.rotation.y = Math.PI * 0.4;
  group.add(m);
  mv.addVirtualLight({ x: d.x + 2, y: d.y + 3, z: d.z }, 0x8ad8ff, 22, 14, 1.5);
}

function fort(group, d, mats) {
  // sandbags along the roof's edge (low enough to jump over)
  const [x0, z0, x1, z1] = d.rect, Y = d.roofY;
  const bag = (ax, az, bx, bz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.5, bx - ax), 0.45, Math.max(0.5, bz - az)), mats.sandbag); m.position.set((ax + bx) / 2, Y + 0.22, (az + bz) / 2); group.add(m); };
  bag(x0, z0, x1 - 6, z0 + 0.5); bag(x0, z1 - 0.5, x1, z1); bag(x0, z0 + 0.5, x0 + 0.5, z1 - 0.5);
  const sn = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 6, 0.08, 0.5), mats.snowCap); sn.position.set((x0 + x1 - 6) / 2, Y + 0.49, z0 + 0.25); group.add(sn);
}

function lighthouseTop(group, rm, mats, mv) {
  const [x0, z0, x1, z1] = rm.rect;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y = rm.y + rm.height;
  const g = new THREE.Group();
  const rad = (x1 - x0) / 2;
  // the lamp room: a glass drum on a roof over the stairwell's middle, a red dome
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.55, rad * 0.55, 0.3, 20), mats.iron); plat.position.y = 2.6; g.add(plat);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), mats.iron); p.position.set(Math.cos(a) * rad * 0.5, 1.3, Math.sin(a) * rad * 0.5); g.add(p); }
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.45, rad * 0.45, 2.2, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.25, roughness: 0.1, emissive: new THREE.Color('#ffd27a'), emissiveIntensity: 0.6, side: THREE.DoubleSide }));
  glass.position.y = 4.0; g.add(glass);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 1.8) })); lamp.position.y = 4.0; g.add(lamp);
  const domeM = new THREE.Mesh(new THREE.SphereGeometry(rad * 0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.hullRed); domeM.position.y = 5.1; g.add(domeM);
  const beamGeo = new THREE.ConeGeometry(5, 70, 24, 1, true).rotateZ(Math.PI / 2).translate(35, 0, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.8, 0.55), transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const pivot = new THREE.Group(); pivot.position.y = 4.0; g.add(pivot);
  for (const a of [0, Math.PI]) { const bm = new THREE.Mesh(beamGeo, beamMat); bm.rotation.y = a; pivot.add(bm); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,230,170,1)', 'rgba(255,200,120,0)'), color: new THREE.Color(2, 1.7, 1.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(3.5); halo.position.y = 4.0; g.add(halo);
  g.position.set(cx, y, cz);
  group.add(g);
  mv.addVirtualLight({ x: cx, y: y + 1, z: cz }, 0xffd9a0, 18, 14, 1.6);
  return { pivot, halo };
}

function dome(group, rm, mats) {
  const [x0, z0, x1, z1] = rm.rect;
  const w = x1 - x0 + 1, y = rm.y + rm.height;
  const g = new THREE.SphereGeometry(w * 0.72, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#c8ccd2', roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide, emissive: new THREE.Color('#101418') }));
  m.scale.y = 0.55; m.position.set((x0 + x1) / 2, y - 0.2, (z0 + z1) / 2);
  group.add(m);
  // the slit for the telescope
  const slit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, w * 0.7), new THREE.MeshBasicMaterial({ color: '#05070a' }));
  slit.position.set((x0 + x1) / 2, y + w * 0.36, (z0 + z1) / 2 - w * 0.12); slit.rotation.x = 0.5;
  group.add(slit);
  // a snow cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(w * 0.73, 24, 6, 0, Math.PI * 2, 0, Math.PI / 5), mats.snowCap);
  cap.scale.y = 0.55; cap.position.copy(m.position); group.add(cap);
}

// pines on the gentler rock
export function buildPines(out, group, map, mats) {
  const r = R(77);
  const spots = [];
  for (const t of map.terrains) {
    const want = t.id === 'caves' ? 30 : t.id === 'hub' ? 26 : 34;
    let got = 0;
    for (let i = 0; i < 4000 && got < want; i++) {
      const x = t.x0 + r() * t.nx * t.cell, z = t.z0 + r() * t.nz * t.cell;
      const c = t.cellAt(x, z);
      if (c < 0 || t.kind[c] !== K.ROCK || t.ceil[c] > 0 || t.h[c] < 2) continue;
      // not on a steep face: its neighbours about level with it
      let ok = true;
      for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) { const o = t.cellAt(x + dx, z + dz); if (o < 0 || t.kind[o] !== K.ROCK || Math.abs(t.h[o] - t.h[c]) > 1.2) ok = false; }
      if (!ok) continue;
      spots.push([x, z, 0.8 + r() * 1.1, t.h[c] - 0.2]);
      got++;
    }
  }
  const trunk = new THREE.CylinderGeometry(0.15, 0.25, 2, 6), needles = new THREE.ConeGeometry(1, 2.2, 8);
  out.trunk = trunk; out.needles = needles;
  const tiers = 3;
  const tIm = new THREE.InstancedMesh(trunk, mats.bark, spots.length);
  const nIm = new THREE.InstancedMesh(needles, mats.pine, spots.length * tiers);
  const cIm = new THREE.InstancedMesh(needles, mats.snowCap, spots.length * tiers);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  spots.forEach(([x, z, s, base], i) => {
    m4.compose(ps.set(x, base + s, z), q.identity(), sc.set(s, s, s)); tIm.setMatrixAt(i, m4);
    for (let k = 0; k < tiers; k++) {
      const w = (1.6 - k * 0.4) * s, y = base + s * (1.8 + k * 1.3);
      m4.compose(ps.set(x, y, z), q.identity(), sc.set(w, s * 1.1, w)); nIm.setMatrixAt(i * tiers + k, m4);
      m4.compose(ps.set(x, y + 0.25 * s, z), q.identity(), sc.set(w * 0.82, s * 0.7, w * 0.82)); cIm.setMatrixAt(i * tiers + k, m4);
    }
  });
  group.add(tIm, nIm, cIm);
}
