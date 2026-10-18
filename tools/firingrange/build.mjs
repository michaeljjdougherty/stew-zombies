// The Firing Range map (Map 3) from the downloaded Call of Duty: Mobile model
// (Sketchfab, "Call of duty: mobile Firing Range map" by alljamimohammedrafi,
// CC BY-NC-SA 4.0). The download has no textures, so every triangle is sorted
// into a surface (dirt, road, grass, wood, tin roof, plaster, rock, palm...) by
// its original material, which way it faces and how high it sits, and gets
// new box-projected texture coordinates; src/render/firingRangeWorld.js paints
// each surface Black Ops style. Duplicates, the sky and the loose pieces left
// round the edge are dropped, and the rest is quantized.
//   node tools/firingrange/build.mjs <source.glb>
//   (needs @gltf-transform/core, /functions, /extensions and meshoptimizer resolvable)
// Writes assets/firingrange/range.glb and src/map/firingRangeGround.js (the
// ground's heights and where you can't walk, on a 0.5 m grid).
import { NodeIO, Document } from '@gltf-transform/core';
import { flatten, clearNodeTransform, weld, meshopt, simplifyPrimitive, prune, dedup } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { writeFileSync, mkdirSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url).pathname;
const SRC = process.argv[2] || '/mnt/project-files/call_of_duty_mobile_firing_range_map.glb';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

// --- what each of the model's materials is ------------------------------------------
const GROUND = { 46: 'dirt', 43: 'road', 45: 'grass', 8: 'grass', 10: 'far', 42: 'water', 44: 'water' };
const ROCK = new Set([6, 9]);
const PLANT = { 41: 'palm', 36: 'fern', 37: 'fern', 38: 'fern', 40: 'shrub', 13: 'shrub', 35: 'planks' };
const DROP = new Set([26]);   // the sky dome: the game draws its own
// structures: walls by material, roofs (up-facing, high) are tin
const WALL = { 14: 'wood', 11: 'plaster', 16: 'concrete', 12: 'metal', 25: 'olive', 32: 'tin', 31: 'metal', 21: 'metal' };
// what blocks walking (the ground and plants don't)
const SOLID = (m) => !(m in GROUND) && !(m in PLANT) && !DROP.has(m) && !(m === 41);
// The origin: the middle of the compound (x, z).
const OX = -23, OZ = -11;
const KEEP = [-72, -76, 30, 52];          // the playable compound and its fences (source x/z)
const BACK = 160;                          // backdrop ground and hills: this far out
const CELL = 0.5;

const doc = await io.read(SRC);
await doc.transform(flatten());
for (const n of doc.getRoot().listNodes()) if (n.getMesh()) clearNodeTransform(n);

// --- every triangle, deduplicated ----------------------------------------------------
const matNo = (m) => +(m?.getName() || '0').replace(/^mat_(\d+).*$/, '$1');
const seen = new Set();
const parts = [];   // { mat, pos: Float32Array (9 per tri), nrm }
for (const n of doc.getRoot().listNodes()) {
  const mesh = n.getMesh(); if (!mesh) continue;
  for (const p of mesh.listPrimitives()) {
    const mat = matNo(p.getMaterial());
    if (DROP.has(mat)) continue;
    const P = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), I = p.getIndices();
    const mn = P.getMin([]), mx = P.getMax([]);
    const key = mat + ':' + P.getCount() + ':' + [...mn, ...mx].map((v) => v.toFixed(2)).join(',');
    if (seen.has(key)) continue;   // (the download has a second copy of many pieces, in the same place)
    seen.add(key);
    const pa = P.getArray(), na = N.getArray(), ia = I ? I.getArray() : null;
    const nt = (ia ? ia.length : pa.length / 3) / 3;
    const pos = [], nrm = [];
    for (let t = 0; t < nt; t++) {
      const v = [0, 1, 2].map((k) => (ia ? ia[t * 3 + k] : t * 3 + k));
      const cx = (pa[v[0] * 3] + pa[v[1] * 3] + pa[v[2] * 3]) / 3, cz = (pa[v[0] * 3 + 2] + pa[v[1] * 3 + 2] + pa[v[2] * 3 + 2]) / 3;
      const back = mat in GROUND || ROCK.has(mat);
      const inKeep = cx >= KEEP[0] && cx <= KEEP[2] && cz >= KEEP[1] && cz <= KEEP[3];
      const inBack = Math.abs(cx - OX) < BACK && Math.abs(cz - OZ) < BACK;
      if (!(inKeep || (back && inBack))) continue;
      for (const i of v) { pos.push(pa[i * 3] - OX, pa[i * 3 + 1], pa[i * 3 + 2] - OZ); nrm.push(na[i * 3], na[i * 3 + 1], na[i * 3 + 2]); }
    }
    if (pos.length) parts.push({ mat, pos, nrm });
  }
}

// --- the ground: heights on a grid ------------------------------------------------------
// (from the walkable ground materials, then shifted so the lowest is y = 0)
const GX0 = KEEP[0] - OX - 4, GZ0 = KEEP[1] - OZ - 4;
const NX = Math.ceil((KEEP[2] - KEEP[0] + 8) / CELL), NZ = Math.ceil((KEEP[3] - KEEP[1] + 8) / CELL);
const H = new Float32Array(NX * NZ).fill(-1e9);
function rasterTop(pos, put) {
  for (let t = 0; t < pos.length; t += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = pos.slice(t, t + 9);
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-9) continue;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - GX0) / CELL)), i1 = Math.min(NX - 1, Math.floor((Math.max(ax, bx, cx) - GX0) / CELL));
    const k0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - GZ0) / CELL)), k1 = Math.min(NZ - 1, Math.floor((Math.max(az, bz, cz) - GZ0) / CELL));
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const px = GX0 + (i + 0.5) * CELL, pz = GZ0 + (k + 0.5) * CELL;
      const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      put(k * NX + i, l1 * ay + l2 * by + l3 * cy);
    }
  }
}
// (and which ground it is: 1 dirt, 2 road, 3 grass, 4 water)
const KIND = { dirt: 1, road: 2, grass: 3, water: 4 };
const GK = new Uint8Array(NX * NZ);
for (const P of parts) if (P.mat in GROUND && P.mat !== 10) rasterTop(P.pos, (c, y) => { if (y > H[c]) { H[c] = y; GK[c] = KIND[GROUND[P.mat]] || 0; } });
// the lowest ground on the grid sits at y = 0 (the game's floor: nothing goes below it)
let OY = Infinity;
for (let c = 0; c < H.length; c++) if (H[c] > -1e8) OY = Math.min(OY, H[c]);
for (const P of parts) for (let i = 1; i < P.pos.length; i += 3) P.pos[i] -= OY;
for (let c = 0; c < H.length; c++) if (H[c] > -1e8) H[c] -= OY;
// holes in the ground (under a building's floor): the lowest neighbour's height
for (let pass = 0; pass < 40; pass++) {
  let left = 0;
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
    const c = k * NX + i; if (H[c] > -1e8) continue;
    let s = 0, n = 0;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, kk = k + dk; if (ii < 0 || kk < 0 || ii >= NX || kk >= NZ) continue; const h = H[kk * NX + ii]; if (h > -1e8) { s += h; n++; } }
    if (n) H[c] = s / n; else left++;
  }
  if (!left) break;
}
// porches, decks and steps low enough to walk up count as ground
const groundAt = (x, z) => { const i = Math.floor((x - GX0) / CELL), k = Math.floor((z - GZ0) / CELL); return i < 0 || k < 0 || i >= NX || k >= NZ ? 0 : H[k * NX + i]; };

// --- where you can't walk: solid stuff between knee and head height --------------------
const BLOCK = new Uint8Array(NX * NZ);
const SAMP = CELL * 0.45;
for (const P of parts) {
  if (!SOLID(P.mat)) continue;
  const pos = P.pos;
  for (let t = 0; t < pos.length; t += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = pos.slice(t, t + 9);
    const n1 = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / SAMP)), n2 = Math.max(1, Math.ceil(Math.hypot(cx - ax, cy - ay, cz - az) / SAMP));
    if (n1 * n2 > 40000) continue;
    for (let i = 0; i <= n1; i++) for (let j = 0; j <= n2; j++) {
      const u = i / n1, w = j / n2; if (u + w > 1 + 1e-9) continue;
      const x = ax + (bx - ax) * u + (cx - ax) * w, y = ay + (by - ay) * u + (cy - ay) * w, z = az + (bz - az) * u + (cz - az) * w;
      const ci = Math.floor((x - GX0) / CELL), ck = Math.floor((z - GZ0) / CELL);
      if (ci < 0 || ck < 0 || ci >= NX || ck >= NZ) continue;
      const g = H[ck * NX + ci];
      if (y > g + 0.5 && y < g + 1.8) BLOCK[ck * NX + ci] = 1;
    }
  }
}

// --- surfaces ----------------------------------------------------------------------------
function classify(mat, ny, cy, cx, cz) {
  if (mat in GROUND) return GROUND[mat];
  if (ROCK.has(mat)) return 'rock';
  if (mat in PLANT) return PLANT[mat];
  const above = cy - groundAt(cx, cz);
  if (ny > 0.6) return above > 2.0 ? (mat === 16 ? 'concrete' : 'tin') : 'planks';
  if (ny < -0.6) return mat === 11 || mat === 16 ? 'concrete' : 'planks';
  return WALL[mat] || 'wood';
}
// texture coordinates: metres / this (box-projected on the face's main axis)
const SCALE = { dirt: 4, road: 4, grass: 3, far: 8, water: 6, rock: 3, palm: 2, fern: 1.5, shrub: 1.5, planks: 2, wood: 2.4, tin: 2, plaster: 3, concrete: 3, metal: 1.5, olive: 2 };
const buckets = new Map();
for (const P of parts) {
  const pos = P.pos, nrm = P.nrm;
  for (let t = 0; t < pos.length; t += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = pos.slice(t, t + 9);
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    const cls = classify(P.mat, ny, (ay + by + cy) / 3, (ax + bx + cx) / 3, (az + bz + cz) / 3);
    if (!buckets.has(cls)) buckets.set(cls, { pos: [], nrm: [], uv: [] });
    const B = buckets.get(cls), s = 1 / SCALE[cls];
    const axis = Math.abs(ny) >= Math.abs(nx) && Math.abs(ny) >= Math.abs(nz) ? 'y' : Math.abs(nx) >= Math.abs(nz) ? 'x' : 'z';
    for (let k = 0; k < 3; k++) {
      const x = pos[t + k * 3], y = pos[t + k * 3 + 1], z = pos[t + k * 3 + 2];
      B.pos.push(x, y, z); B.nrm.push(nrm[t + k * 3], nrm[t + k * 3 + 1], nrm[t + k * 3 + 2]);
      if (axis === 'y') B.uv.push(x * s, z * s); else if (axis === 'x') B.uv.push(z * s, -y * s); else B.uv.push(x * s, -y * s);
    }
  }
}

// --- the new model ------------------------------------------------------------------------
const out = new Document();
const buf = out.createBuffer();
const scene = out.createScene();
for (const [cls, B] of buckets) {
  const prim = out.createPrimitive()
    .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(new Float32Array(B.pos)).setBuffer(buf))
    .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(new Float32Array(B.nrm)).setBuffer(buf))
    .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(new Float32Array(B.uv)).setBuffer(buf))
    .setMaterial(out.createMaterial(cls));
  const mesh = out.createMesh(cls).addPrimitive(prim);
  scene.addChild(out.createNode(cls).setMesh(mesh));
}
// fewer triangles where nobody looks closely (plants, rocks, the hills)
const KEEP_RATIO = { palm: 0.35, fern: 0.35, shrub: 0.35, rock: 0.4, far: 0.3, grass: 0.5, dirt: 0.6, road: 0.6, water: 0.6 };
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
await out.transform(weld());
for (const m of out.getRoot().listMeshes()) {
  const r = KEEP_RATIO[m.getName()] ?? 0.8;
  for (const p of m.listPrimitives()) { const before = p.getIndices().getCount() / 3; simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: r, error: 0.01, lockBorder: false }); console.log('  ' + m.getName().padEnd(9), before, '->', p.getIndices().getCount() / 3); }
}
// (EXT_meshopt_compression: src/render/firingRangeWorld.js gives the loader its decoder)
await out.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
mkdirSync(ROOT + 'assets/firingrange', { recursive: true });
await io.write(ROOT + 'assets/firingrange/range.glb', out);
let tris = 0;
for (const m of out.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
console.log('surfaces', [...buckets.keys()].join(' '), 'tris', tris, 'ground y', OY.toFixed(2));

// --- the ground file --------------------------------------------------------------------
// heights in centimetres (+32768, two bytes each) and the blocked cells, base64
const hb = Buffer.alloc(NX * NZ * 2);
for (let c = 0; c < NX * NZ; c++) hb.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(H[c] * 100) + 32768)), c * 2);
writeFileSync(ROOT + 'src/map/firingRangeGround.js',
  '// Generated by tools/firingrange/build.mjs from the Firing Range model (do not edit).\n' +
  '// The ground on a grid: origin, size, cell (m); heights in cm + 32768 (uint16 LE),\n// the cells something solid stands in (1 byte each), and what the ground is (1 dirt,\n// 2 road, 3 grass, 4 water, 0 under something), all base64.\n' +
  `export const GROUND = ${JSON.stringify({ x0: GX0, z0: GZ0, nx: NX, nz: NZ, cell: CELL })};\n` +
  `export const HEIGHTS = '${hb.toString('base64')}';\n` +
  `export const BLOCKED = '${Buffer.from(BLOCK).toString('base64')}';\n` +
  `export const KINDS = '${Buffer.from(GK).toString('base64')}';\n`);
console.log('grid', NX, 'x', NZ);
