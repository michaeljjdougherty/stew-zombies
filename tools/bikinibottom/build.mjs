// The Bikini Bottom map (Map 3) from the downloaded model of the town hub in
// SpongeBob: Battle for Bikini Bottom (Sketchfab, "Bikini Bottom Map 3D Model"
// by spongebob.evolution, CC BY 4.0). The model keeps its own textures; this
// scales it up to metres (SpongeBob's pineapple comes out about 7 m tall),
// moves the middle of town to the origin, and measures the ground off it.
// The sky (the flowery Jellyfish Fields sky) is kept as its own node, shrunk to
// a unit dome that src/render/bikiniBottomWorld.js hangs round the camera.
// Two insides go in the same model, far off past the edge of the world where
// nobody sees them: SpongeBob's house (the ground floor of "Spongebob's House"
// by Cheryl Hill) and the Krusty Krab's dining room and kitchen (the building
// from "The Krusty Krab from BFBBR", also Cheryl Hill; both Sketchfab, CC BY 4.0).
// The doors in town take you there (src/sim/launchers.js).
//   node tools/bikinibottom/build.mjs <town.glb> <spongebob_house.glb> <the_krusty_krab_from_bfbbr.glb> <squidwards_tiki.glb> <downtown_bikini_bottom.glb> <goo_lagoon_a.glb>
//   (needs @gltf-transform/core, /functions, /extensions, meshoptimizer and sharp resolvable)
// Writes assets/bikinibottom/town.glb and src/map/bikiniBottomGround.js (the
// ground's heights and where you can't walk, on a 0.5 m grid: the town's and
// each inside's).
import { NodeIO, getBounds } from '@gltf-transform/core';
import { flatten, clearNodeTransform, meshopt, prune, dedup, join, mergeDocuments, unpartition, weld, simplify, textureCompress } from '@gltf-transform/functions';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { bakeSkins } from './skin.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const [SRC, HOUSE_SRC, KRAB_SRC, SQUID_SRC, DOWNTOWN_SRC, GOO_SRC] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const S = 90;                       // model units to metres
const OX = -0.1, OZ = -0.2;         // the middle of town (model units)
const KEEP = [-1.3, -0.8, 1.05, 0.4];   // the grid's extent (model units)
const CELL = 0.5;

// What each part of the model is, by the group it sits in under HB01.
//   ground: you walk on it. solid: you can't walk through it. Everything else
//   (shadow decals, water, flowers) is only drawn.
const GROUND = ['terrain/ground', 'terrain/road', 'terrain/platforms'];
//   (the toll gates' arms you can walk past; the hub's bamboo fences are solid,
//   so the east end of town is behind the first gate, a door you buy)
const LOOSE = [/^terrain\/liquid/, /toll_gate/];
const SKY = 'skybox/';
// (dropped: the baked shadow patches under the buildings and the tufts of sea
// grass, whose see-through parts the download lost, so they came out solid black)
// and the cut-outs round the pineapple's foot, which lost theirs too)
const DROP = /^shadows\/|^details\/nature_details|^details\/house_sb_flowers/;
// Pieces whose textures the download lost (they came out white): a colour each,
// or (a name) the material of the piece that has the texture they should have.
const PAINT = [
  [/krustycrabwin(_|2_)/, 'krustycrabwin11'],
  [/porthole_big/, '#3f62a8'], [/^buildings\/airlock/, '#c99a3c'], [/gumdrop_green/, '#6bb85a'],
  [/beach_chair/, '#d8604a'], [/wood_purple/, '#7a4f96'], [/wood_pounded_pillar|wood_bridge/, '#8f6c45'],
  [/treedome_blanket/, '#c84848'], [/Tv_shadshoals/, '#4a4f58'], [/electrical_pole/, '#6b5640'],
  [/fountain_statue/, '#d6ae3a'], [/fountain_water/, '#5ab4d6'], [/cannon_fd/, '#3c3c40'],
  [/ballarena_platform/, '#a8b4bc'], [/dumpster_lid/, '#3f6e44'], [/light_street_rev/, '#4f545c'],
  [/sand_gl/, '#d8c8a0'], [/rope/, '#e2d4b0'], [/sign_bikini_btm/, '#d84a3a'], [/sign_|level_signs/, '#c9a066'],
];
// The first toll gate (east, by Patrick's rock): its arm swings up when the gate's bought.
const GATE_ARM = /toll_gate_arm0/, GATE_POST = /toll_gate0/;
// The piece of bamboo fence copied round the edge of play.
const FENCE = /hub_2_fence1_/;

const doc = await io.read(SRC);
const root = doc.getRoot();
const pathOf = (n) => { const p = []; for (let x = n; x; x = x.getParentNode()) p.unshift(x.getName()); const i = p.indexOf('HB01'); return p.slice(i + 1).join('/'); };
const roleOfPath = (path) => (path.startsWith(SKY) ? 'sky' : GROUND.some((g) => path.startsWith(g)) ? 'ground' : LOOSE.some((g) => g.test(path)) ? 'loose' : 'solid');
// (by node: a mesh several nodes share is copied when its node's transform is baked in)
const ROLE = new Map();
for (const n of root.listNodes()) if (n.getMesh()) { if (DROP.test(pathOf(n))) n.setMesh(null); else ROLE.set(n, roleOfPath(pathOf(n))); }
const srgb = (h) => [1, 3, 5].map((i) => ((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))(parseInt(h.slice(i, i + 2), 16) / 255));
for (const n of root.listNodes()) {
  const m = n.getMesh(); if (!m) continue;
  const rule = PAINT.find(([re]) => re.test(pathOf(n))); if (!rule) continue;
  for (const p of m.listPrimitives()) {
    if (rule[1][0] === '#') p.setMaterial(p.getMaterial().clone().setBaseColorTexture(null).setBaseColorFactor([...srgb(rule[1]), 1]));
    else { const like = root.listNodes().find((q) => q.getMesh() && pathOf(q).includes(rule[1])); if (like) p.setMaterial(like.getMesh().listPrimitives()[0].getMaterial()); }
  }
}
const named = (re) => root.listNodes().find((n) => n.getMesh() && re.test(pathOf(n)));
const gateArm = named(GATE_ARM), gatePost = named(GATE_POST), fenceSrc = named(FENCE);
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
function rasterOn(pos, GX0, GZ0, NX, NZ, put) {
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
rasterOn(tris.ground, GX0, GZ0, NX, NZ, (c, y) => { if (y > H[c]) H[c] = y; });
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
function blockOn(pos, GX0, GZ0, NX, NZ, H, BLOCK) {
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
blockOn(tris.solid, GX0, GZ0, NX, NZ, H, BLOCK);

// --- the insides: SpongeBob's house and the Krusty Krab ---------------------------------
// Each is cut out of its own model, scaled to metres with its front door at
// `place` (far off the map, past the far plane and the fog) and measured onto a
// grid of its own. door: the front door in the model (it faces +z, out);
// floor: the model's floor height; keep(x, y, z): the triangles to keep (by
// their middle, in the model); pass: materials you walk through (the house's
// bead curtains between rooms).
const INSIDES = [
  { name: 'house', src: HOUSE_SRC, scale: 0.42, door: [-6.8, 18.2], floor: 0, place: [600, 0],
    keep: (x, y, z) => y < 12.5, pass: /^Doors$/,
    // (the doors between the rooms come out: it's all open inside; by where they stand, placed)
    remove: (mat, x, y, z) => mat === 'Doors' && [[602, -12.5], [598, -8], [609, -8.5]].some(([dx, dz]) => Math.hypot(x - dx, z - dz) < 1.4) },
  { name: 'krab', src: KRAB_SRC, scale: 19.5, door: [0.73, -0.83], floor: 0, place: [600, -400],
    keep: (x, y, z) => x > 0.05 && x < 1.42 && z > -2.05 && z < -0.78, drop: /^Object_(2|23)$/,
    simplify: 0.15, textures: 512 },
  // Squidward's living room (the room out of "Squidward's Tiki", the rest of that model's his yard)
  { name: 'squid', src: SQUID_SRC, scale: 0.37, door: [-4.9, 9.3], floor: 0, place: [600, -800],
    keep: () => true, dropMat: /^Outside_/, textures: 256 },
  // The taxi rides: Downtown's streets and Goo Lagoon's beach, each a whole place outdoors
  // (the ground's the highest thing underfoot; roofs too high to climb), each in its own file.
  { name: 'downtown', src: DOWNTOWN_SRC, scale: 0.6, door: [0, 0], floor: 0, place: [1200, 0], outdoor: true, file: 'downtown',
    keep: (x, y, z) => x > -95 && x < 90 && z > -80 && z < 80 && y < 120, textures: 256 },
  { name: 'goolagoon', src: GOO_SRC, scale: 0.6, door: [170, 0], floor: 0, place: [1200, -800], outdoor: true, file: 'goolagoon',
    keep: (x, y, z) => x > -60 && x < 280 && z > -110 && z < 130 && y < 80, simplify: 0.5, textures: 256 },
];
// keep only some of a mesh's triangles
function cut(prim, keep) {
  const pa = prim.getAttribute('POSITION').getArray(), I = prim.getIndices();
  const ia = I ? I.getArray() : Uint32Array.from({ length: pa.length / 3 }, (_, i) => i);
  const out = [];
  for (let t = 0; t < ia.length; t += 3) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) { const v = ia[t + k]; x += pa[v * 3]; y += pa[v * 3 + 1]; z += pa[v * 3 + 2]; }
    if (keep(x / 3, y / 3, z / 3)) out.push(ia[t], ia[t + 1], ia[t + 2]);
  }
  if (!out.length) return false;
  const nI = (I ? I.clone() : prim.getAttribute('POSITION').clone().setType('SCALAR')).setArray(new Uint32Array(out));
  prim.setIndices(nI);
  return true;
}
// the ground inside: the floor's height (faces turned up, below knee height)
// and the cells something solid stands in; no floor, no way through
function measureInside(tris, outdoor) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < tris.all.length; i += 3) { x0 = Math.min(x0, tris.all[i]); x1 = Math.max(x1, tris.all[i]); z0 = Math.min(z0, tris.all[i + 2]); z1 = Math.max(z1, tris.all[i + 2]); }
  const gx = Math.floor(x0) - 1, gz = Math.floor(z0) - 1, nx = Math.ceil((x1 - gx + 1) / CELL), nz = Math.ceil((z1 - gz + 1) / CELL);
  const H = new Float32Array(nx * nz).fill(-1e9), B = new Uint8Array(nx * nz);
  const low = [];
  // (outdoors: whatever's highest underfoot; a roof is just ground too high to climb to)
  for (let t = 0; t < tris.all.length; t += 9) if (outdoor || Math.max(tris.all[t + 1], tris.all[t + 4], tris.all[t + 7]) < 1) low.push(...tris.all.slice(t, t + 9));
  rasterOn(low, gx, gz, nx, nz, (c, y) => { if (y > H[c]) H[c] = y; });
  for (let c = 0; c < H.length; c++) if (H[c] < -1e8) { H[c] = 0; B[c] = 1; }
  blockOn(tris.solid, gx, gz, nx, nz, H, B);
  return { x0: gx, z0: gz, nx, nz, H, B };
}
async function inside(I) {
  const d = await io.read(I.src), r = d.getRoot();
  for (const a of r.listAnimations()) a.dispose();
  bakeSkins(d);
  await d.transform(flatten());
  for (const n of r.listNodes()) if (n.getMesh()) {
    if (I.drop && I.drop.test(n.getName())) { n.setMesh(null); continue; }
    if (I.dropMat) for (const p of n.getMesh().listPrimitives()) if (I.dropMat.test(p.getMaterial()?.getName() || '')) { n.getMesh().removePrimitive(p); p.dispose(); }
    clearNodeTransform(n);
    // (only what's kept: the bits of the mesh inside)
    for (const p of n.getMesh().listPrimitives()) if (!cut(p, I.keep)) { n.getMesh().removePrimitive(p); p.dispose(); }
  }
  const S = I.scale;
  for (const n of r.listNodes()) if (n.getMesh()) { n.setTranslation([I.place[0] - I.door[0] * S, -I.floor * S, I.place[1] - I.door[1] * S]).setScale([S, S, S]); clearNodeTransform(n); }
  if (I.remove) for (const n of r.listNodes()) for (const p of n.getMesh()?.listPrimitives() || []) {
    const mat = p.getMaterial()?.getName() || '';
    if (!cut(p, (x, y, z) => !I.remove(mat, x, y, z))) { n.getMesh().removePrimitive(p); p.dispose(); }
  }
  await d.transform(prune(), weld());
  if (I.simplify) await d.transform(simplify({ simplifier: MeshoptSimplifier, ratio: I.simplify, error: 0.01 }));
  if (I.textures) await d.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [I.textures, I.textures], quality: 80 }));
  const tris = { all: [], solid: [] };
  for (const n of r.listNodes()) {
    const mesh = n.getMesh(); if (!mesh) continue;
    for (const p of mesh.listPrimitives()) {
      const pass = I.pass && I.pass.test(p.getMaterial()?.getName() || '');
      const pa = p.getAttribute('POSITION').getArray(), ia = p.getIndices().getArray();
      for (const v of ia) { tris.all.push(pa[v * 3], pa[v * 3 + 1], pa[v * 3 + 2]); if (!pass) tris.solid.push(pa[v * 3], pa[v * 3 + 1], pa[v * 3 + 2]); }
    }
  }
  return { d, grid: measureInside(tris, I.outdoor) };
}

// --- the new model: one node for the town, one for the sky, one for each inside ----------
// (join merges the pieces under each, so they stay apart)
const scene = root.listScenes()[0];
// the gate's arm on its own (the game swings it up), where it hinges: the end by the post
const ab = getBounds(gateArm), pb = getBounds(gatePost);
const armAxis = ab.max[0] - ab.min[0] > ab.max[2] - ab.min[2] ? 'x' : 'z', ai = armAxis === 'x' ? 0 : 2;
const postAt = (pb.min[ai] + pb.max[ai]) / 2;
const hinge = [(ab.min[0] + ab.max[0]) / 2, (ab.min[1] + ab.max[1]) / 2, (ab.min[2] + ab.max[2]) / 2];
hinge[ai] = Math.abs(ab.min[ai] - postAt) < Math.abs(ab.max[ai] - postAt) ? ab.min[ai] : ab.max[ai];
const GATE = { axis: armAxis, rect: [ab.min[0], ab.min[2], ab.max[0], ab.max[2]], y: [ab.min[1], ab.max[1]], hinge };
// one piece of the bamboo fence, stood at the origin on y = 0, running along x
function fencePiece() {
  const src = fenceSrc.getMesh(), mesh = doc.createMesh('fence');
  let sx = 0, sz = 0, n = 0, y0 = Infinity;
  const pts = [];
  for (const p of src.listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { const v = a.getElement(i, []); pts.push(v); sx += v[0]; sz += v[2]; n++; y0 = Math.min(y0, v[1]); } }
  const cx = sx / n, cz = sz / n;
  let xx = 0, zz = 0, xz = 0;
  for (const v of pts) { const dx = v[0] - cx, dz = v[2] - cz; xx += dx * dx; zz += dz * dz; xz += dx * dz; }
  const ang = 0.5 * Math.atan2(2 * xz, xx - zz), c = Math.cos(-ang), s = Math.sin(-ang);
  const turn = (x, z) => [x * c - z * s, x * s + z * c];
  for (const p of src.listPrimitives()) {
    const q = p.clone();
    for (const sem of q.listSemantics()) q.setAttribute(sem, q.getAttribute(sem).clone());
    const P = q.getAttribute('POSITION'), N = q.getAttribute('NORMAL');
    for (let i = 0; i < P.getCount(); i++) { const v = P.getElement(i, []); const [x, z] = turn(v[0] - cx, v[2] - cz); P.setElement(i, [x, v[1] - y0, z]); }
    if (N) for (let i = 0; i < N.getCount(); i++) { const v = N.getElement(i, []); const [x, z] = turn(v[0], v[2]); N.setElement(i, [x, v[1], z]); }
    mesh.addPrimitive(q);
  }
  return doc.createNode('fence').setMesh(mesh);
}
const holders = { town: doc.createNode('town'), sky: doc.createNode('sky'), gate: doc.createNode('gate') };
holders.fence = doc.createNode('fencePiece').addChild(fencePiece());
for (const n of root.listNodes()) if (n.getMesh() && n.getName() !== 'fence') { scene.removeChild(n); holders[n === gateArm ? 'gate' : roleOf(n) === 'sky' ? 'sky' : 'town'].addChild(n); }
for (const h of Object.values(holders)) scene.addChild(h);
const grids = [{ name: 'town', x0: GX0, z0: GZ0, nx: NX, nz: NZ, H, B: BLOCK }];
doc.createExtension(EXTTextureWebP);
for (const I of INSIDES) {
  const { d, grid } = await inside(I);
  grids.push({ name: I.name, ...grid });
  console.log(I.name, 'grid', grid.nx, 'x', grid.nz, 'origin', grid.x0, grid.z0);
  if (I.file) {
    // (its own file, loaded once the town's up)
    const sc = d.getRoot().listScenes()[0], holder = d.createNode(I.name);
    for (const n of sc.listChildren()) { sc.removeChild(n); holder.addChild(n); }
    sc.addChild(holder);
    d.createExtension(EXTTextureWebP);
    await MeshoptEncoder.ready;
    await d.transform(prune(), dedup(), join({ keepNamed: false }), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(ROOT + `assets/bikinibottom/${I.file}.glb`, d);
    continue;
  }
  const map = mergeDocuments(doc, d);
  const holder = doc.createNode(I.name);
  for (const sc of d.getRoot().listScenes()) {
    const s2 = map.get(sc);
    for (const n of s2.listChildren()) { s2.removeChild(n); holder.addChild(n); }
    s2.dispose();
  }
  scene.addChild(holder);
}
await MeshoptEncoder.ready;
await doc.transform(unpartition(), prune(), dedup(), join({ keepNamed: false }), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
mkdirSync(ROOT + 'assets/bikinibottom', { recursive: true });
await io.write(ROOT + 'assets/bikinibottom/town.glb', doc);
let nt = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) nt += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
console.log('tris', nt, 'meshes', root.listMeshes().length, 'ground y', OY.toFixed(2), 'sky r', sr.toFixed(2));

// --- the ground file ----------------------------------------------------------------------
writeFileSync(ROOT + 'src/map/bikiniBottomGround.js',
  '// Generated by tools/bikinibottom/build.mjs from the Bikini Bottom model (do not edit).\n' +
  '// The ground on grids (the town, then each inside): origin, size, cell (m);\n// heights in cm + 32768 (uint16 LE) and the cells something solid stands in\n// (1 byte each), base64.\n' +
  'export const GRIDS = [\n' + grids.map((g) => {
    const hb = Buffer.alloc(g.nx * g.nz * 2);
    for (let c = 0; c < g.nx * g.nz; c++) hb.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(g.H[c] * 100) + 32768)), c * 2);
    return `  { name: '${g.name}', x0: ${g.x0}, z0: ${g.z0}, nx: ${g.nx}, nz: ${g.nz}, cell: ${CELL},\n    heights: '${hb.toString('base64')}',\n    blocked: '${Buffer.from(g.B).toString('base64')}' },\n`;
  }).join('') + '];\n' +
  '// The first toll gate\'s arm (a door you buy): its rect [x0, z0, x1, z1], heights, the axis it\n// runs along and the hinge it swings up about.\n' +
  'export const GATE = ' + JSON.stringify({ ...GATE, rect: GATE.rect.map((v) => +v.toFixed(2)), y: GATE.y.map((v) => +v.toFixed(2)), hinge: GATE.hinge.map((v) => +v.toFixed(2)) }) + ';\n');
console.log('grid', NX, 'x', NZ, 'origin', GX0, GZ0);
