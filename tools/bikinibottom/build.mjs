// The Bikini Bottom map (Map 3) from the downloaded model of the town hub in
// SpongeBob: Battle for Bikini Bottom (Sketchfab, "Bikini Bottom Map 3D Model"
// by spongebob.evolution, CC BY 4.0). The model keeps its own textures; this
// scales it up to metres (SpongeBob's pineapple comes out about 7 m tall),
// moves the middle of town to the origin, and measures the ground off it.
// The sky (the flowery Jellyfish Fields sky) is kept as its own node, shrunk to
// a unit dome that src/render/bikiniBottomWorld.js hangs round the camera.
//   node tools/bikinibottom/build.mjs <source.glb>
//   (needs @gltf-transform/core, /functions, /extensions and meshoptimizer resolvable)
// Writes assets/bikinibottom/town.glb and src/map/bikiniBottomGround.js (the
// ground's heights and where you can't walk, on a 0.5 m grid).
import { NodeIO, getBounds } from '@gltf-transform/core';
import { flatten, clearNodeTransform, meshopt, prune, dedup, join, joinPrimitives } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer';
import { writeFileSync, mkdirSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url).pathname;
const SRC = process.argv[2];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const S = 90;                       // model units to metres
const OX = -0.1, OZ = -0.2;         // the middle of town (model units)
const KEEP = [-1.3, -0.8, 1.05, 0.4];   // the grid's extent (model units)
const CELL = 0.5;

// What each part of the model is, by the group it sits in under HB01.
//   ground: you walk on it. solid: you can't walk through it. Everything else
//   (shadow decals, water, flowers) is only drawn.
const GROUND = ['terrain/ground', 'terrain/road', 'terrain/platforms'];
//   (the hub's low bamboo fences and the toll gates' arms you can walk past:
//   in the game they split the town up, here it's all one place)
const LOOSE = [/^terrain\/liquid/, /^details\/house_sb_flowers/, /^details\/hub_fences/, /toll_gate/];
const SKY = 'skybox/';
// (dropped: the baked shadow patches under the buildings and the tufts of sea
// grass, whose see-through parts the download lost, so they came out solid black)
const DROP = /^shadows\/|^details\/nature_details/;

const doc = await io.read(SRC);
const root = doc.getRoot();
const pathOf = (n) => { const p = []; for (let x = n; x; x = x.getParentNode()) p.unshift(x.getName()); const i = p.indexOf('HB01'); return p.slice(i + 1).join('/'); };
const roleOfPath = (path) => (path.startsWith(SKY) ? 'sky' : GROUND.some((g) => path.startsWith(g)) ? 'ground' : LOOSE.some((g) => g.test(path)) ? 'loose' : 'solid');
// (by node: a mesh several nodes share is copied when its node's transform is baked in)
const ROLE = new Map();
for (const n of root.listNodes()) if (n.getMesh()) { if (DROP.test(pathOf(n))) n.setMesh(null); else ROLE.set(n, roleOfPath(pathOf(n))); }
const roleOf = (n) => ROLE.get(n) || 'solid';

await doc.transform(flatten());
for (const n of root.listNodes()) if (n.getMesh()) clearNodeTransform(n);

// --- into metres, round the middle of town; the sky into a unit dome ---------------------
const skyNodes = root.listNodes().filter((n) => n.getMesh() && roleOf(n) === 'sky');
let sc = [0, 0, 0], sr = 1;
if (skyNodes.length) {
  const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const n of skyNodes) { const nb = getBounds(n); for (let i = 0; i < 3; i++) { b.min[i] = Math.min(b.min[i], nb.min[i]); b.max[i] = Math.max(b.max[i], nb.max[i]); } }
  sc = [(b.min[0] + b.max[0]) / 2, 0, (b.min[2] + b.max[2]) / 2];
  sr = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) / 2;
}
for (const n of root.listNodes()) {
  const mesh = n.getMesh(); if (!mesh) continue;
  const role = roleOf(n);
  if (role === 'sky') n.setTranslation([-sc[0] / sr, 0, -sc[2] / sr]).setScale([1 / sr, 1 / sr, 1 / sr]);
  else n.setTranslation([-OX * S, 0, -OZ * S]).setScale([S, S, S]);
  clearNodeTransform(n);
}

// --- every triangle, by role -------------------------------------------------------------
const tris = { ground: [], solid: [] };
for (const n of root.listNodes()) {
  const mesh = n.getMesh(); if (!mesh) continue;
  const role = roleOf(n);
  if (!(role in tris)) continue;
  for (const p of mesh.listPrimitives()) {
    const pa = p.getAttribute('POSITION').getArray(), I = p.getIndices(), ia = I ? I.getArray() : null;
    const nt = (ia ? ia.length : pa.length / 3) / 3;
    for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const v = ia ? ia[t * 3 + k] : t * 3 + k; tris[role].push(pa[v * 3], pa[v * 3 + 1], pa[v * 3 + 2]); }
  }
}

// --- the ground: heights on a grid --------------------------------------------------------
const GX0 = Math.floor((KEEP[0] - OX) * S), GZ0 = Math.floor((KEEP[1] - OZ) * S);
const NX = Math.ceil(((KEEP[2] - KEEP[0]) * S) / CELL), NZ = Math.ceil(((KEEP[3] - KEEP[1]) * S) / CELL);
const H = new Float32Array(NX * NZ).fill(-1e9);
function raster(pos, put) {
  for (let t = 0; t < pos.length; t += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = pos.slice(t, t + 9);
    // (only faces turned up: the ground's undersides and cliffs don't count)
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1) < 0.35) continue;
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
raster(tris.ground, (c, y) => { if (y > H[c]) H[c] = y; });
// the lowest ground on the grid sits at y = 0 (the game's floor: nothing goes below it)
let OY = Infinity;
for (let c = 0; c < H.length; c++) if (H[c] > -1e8) OY = Math.min(OY, H[c]);
for (let c = 0; c < H.length; c++) if (H[c] > -1e8) H[c] -= OY;
for (const n of root.listNodes()) {
  const mesh = n.getMesh(); if (!mesh || roleOf(n) === 'sky') continue;
  n.setTranslation([0, -OY, 0]); clearNodeTransform(n);
}
for (const role in tris) for (let i = 1; i < tris[role].length; i += 3) tris[role][i] -= OY;
// holes in the ground (under a building): the neighbours' height
for (let pass = 0; pass < 200; pass++) {
  let left = 0;
  const H2 = H.slice();
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
    const c = k * NX + i; if (H[c] > -1e8) continue;
    let s = 0, n = 0;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, kk = k + dk; if (ii < 0 || kk < 0 || ii >= NX || kk >= NZ) continue; const h = H[kk * NX + ii]; if (h > -1e8) { s += h; n++; } }
    if (n) H2[c] = s / n; else left++;
  }
  H.set(H2);
  if (!left) break;
}

// --- where you can't walk: something solid between knee and head height ------------------
const BLOCK = new Uint8Array(NX * NZ);
const SAMP = CELL * 0.45;
{
  const pos = tris.solid;
  for (let t = 0; t < pos.length; t += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = pos.slice(t, t + 9);
    const n1 = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / SAMP)), n2 = Math.max(1, Math.ceil(Math.hypot(cx - ax, cy - ay, cz - az) / SAMP));
    if (n1 * n2 > 200000) continue;
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

// --- the new model: one node for the town, one for the sky --------------------------------
// (join merges the pieces under each, so the sky stays apart)
const scene = root.listScenes()[0];
const holders = { town: doc.createNode('town'), sky: doc.createNode('sky') };
for (const n of root.listNodes()) if (n.getMesh()) { scene.removeChild(n); holders[roleOf(n) === 'sky' ? 'sky' : 'town'].addChild(n); }
scene.addChild(holders.town).addChild(holders.sky);
await MeshoptEncoder.ready;
await doc.transform(prune(), dedup(), join({ keepNamed: false }), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
mkdirSync(ROOT + 'assets/bikinibottom', { recursive: true });
await io.write(ROOT + 'assets/bikinibottom/town.glb', doc);
let nt = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) nt += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
console.log('tris', nt, 'meshes', root.listMeshes().length, 'ground y', OY.toFixed(2), 'sky r', sr.toFixed(2));

// --- the ground file ----------------------------------------------------------------------
const hb = Buffer.alloc(NX * NZ * 2);
for (let c = 0; c < NX * NZ; c++) hb.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(H[c] * 100) + 32768)), c * 2);
writeFileSync(ROOT + 'src/map/bikiniBottomGround.js',
  '// Generated by tools/bikinibottom/build.mjs from the Bikini Bottom model (do not edit).\n' +
  '// The ground on a grid: origin, size, cell (m); heights in cm + 32768 (uint16 LE)\n// and the cells something solid stands in (1 byte each), base64.\n' +
  `export const GROUND = ${JSON.stringify({ x0: GX0, z0: GZ0, nx: NX, nz: NZ, cell: CELL })};\n` +
  `export const HEIGHTS = '${hb.toString('base64')}';\n` +
  `export const BLOCKED = '${Buffer.from(BLOCK).toString('base64')}';\n`);
console.log('grid', NX, 'x', NZ, 'origin', GX0, GZ0);
