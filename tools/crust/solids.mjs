// Height grids for the models you can't walk through (Call of the Crust): each
// placement marked `solid` in src/map/crust.js is loaded, placed exactly as
// src/render/crustModels.js places it, and its triangles rasterized onto a
// 0.5 m grid (the highest surface over each cell). crust.js turns the grids
// into collision boxes, so walls, roofs, hulls and porches are where they look.
//   node tools/crust/solids.mjs      (needs `three` resolvable)
// Writes src/map/crustSolids.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { CRUST } from '../../src/map/crust.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const CELL = 0.5;
globalThis.self = globalThis;

// textures aren't needed: skip them
class NoTextures { constructor(p) { this.parser = p; this.name = 'no_textures'; } loadTexture() { return Promise.resolve(new THREE.Texture()); } }
const cache = new Map();
function load(name) {
  if (!cache.has(name)) {
    const buf = readFileSync(ROOT + 'assets/crust/' + name + '.glb');
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const L = new GLTFLoader();
    L.register((p) => new NoTextures(p));
    L.pluginCallbacks.unshift(L.pluginCallbacks.pop());
    cache.set(name, new Promise((res, rej) => L.parse(ab, '', res, rej)));
  }
  return cache.get(name);
}
const sanitize = (s) => String(s || '').replace(/\s/g, '_').replace(/[[\]\.:\/]/g, '');
function piecesOf(scene, pick) {
  scene.updateMatrixWorld(true);
  const want = pick ? pick.map(sanitize) : null;
  const out = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (want) { const names = [o.name, o.parent && o.parent.name].map(sanitize); if (!want.some((w) => names.some((n) => n === w || n.startsWith(w)))) return; }
    out.push(o);
  });
  return out;
}

const out = {};
const specs = CRUST.models.filter((s) => s.solid);
for (const s of specs) {
  const g = await load(s.a);
  const meshes = piecesOf(g.scene, s.pick);
  const b = new THREE.Box3(), t = new THREE.Box3();
  for (const m of meshes) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); t.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); b.union(t); }
  const size = b.getSize(new THREE.Vector3());
  let k = s.scale ?? 1;
  if (s.fit) k = s.fit.h ? s.fit.h / size.y : s.fit.len ? s.fit.len / Math.max(size.x, size.z) : s.fit.w ? s.fit.w / Math.min(size.x, size.z) : k;
  const ks = Array.isArray(k) ? k : [k, k, k];
  const T0 = new THREE.Matrix4().makeTranslation(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  const M = new THREE.Matrix4().compose(new THREE.Vector3(s.x, s.y ?? 0, s.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(s.rx || 0, s.yaw || 0, s.rz || 0, 'YXZ')), new THREE.Vector3(...ks)).multiply(T0);
  // the triangles, in the world
  const tris = [];
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  const v = new THREE.Vector3();
  for (const m of meshes) {
    const W = M.clone().multiply(m.matrixWorld);
    const P = m.geometry.attributes.position, I = m.geometry.index;
    const pts = [];
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(W); pts.push(v.x, v.y, v.z); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
    const n = I ? I.count : P.count;
    for (let i = 0; i < n; i += 3) {
      const a = I ? I.getX(i) : i, bb = I ? I.getX(i + 1) : i + 1, c = I ? I.getX(i + 2) : i + 2;
      tris.push([pts[a * 3], pts[a * 3 + 1], pts[a * 3 + 2], pts[bb * 3], pts[bb * 3 + 1], pts[bb * 3 + 2], pts[c * 3], pts[c * 3 + 1], pts[c * 3 + 2]]);
    }
  }
  const gx0 = Math.floor(x0 / CELL) * CELL, gz0 = Math.floor(z0 / CELL) * CELL;
  const nx = Math.ceil((x1 - gx0) / CELL) + 1, nz = Math.ceil((z1 - gz0) / CELL) + 1;
  const H = new Float32Array(nx * nz).fill(-1e9);
  const put = (x, z, y) => { const i = Math.floor((x - gx0) / CELL), k2 = Math.floor((z - gz0) / CELL); if (i < 0 || k2 < 0 || i >= nx || k2 >= nz) return; const c = k2 * nx + i; if (y > H[c]) H[c] = y; };
  for (const T of tris) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = T;
    // its edges (walls seen edge-on from above still get their tops)
    for (const [px, py, pz, qx, qy, qz] of [[ax, ay, az, bx, by, bz], [bx, by, bz, cx, cy, cz], [cx, cy, cz, ax, ay, az]]) {
      const L = Math.hypot(qx - px, qz - pz), n = Math.max(1, Math.ceil(L / (CELL * 0.5)));
      for (let j = 0; j <= n; j++) { const u = j / n; put(px + (qx - px) * u, pz + (qz - pz) * u, py + (qy - py) * u); }
    }
    // its face, at each cell centre it covers
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-9) continue;
    const i0 = Math.floor((Math.min(ax, bx, cx) - gx0) / CELL), i1 = Math.floor((Math.max(ax, bx, cx) - gx0) / CELL);
    const k0 = Math.floor((Math.min(az, bz, cz) - gz0) / CELL), k1 = Math.floor((Math.max(az, bz, cz) - gz0) / CELL);
    for (let k2 = k0; k2 <= k1; k2++) for (let i = i0; i <= i1; i++) {
      const px = gx0 + (i + 0.5) * CELL, pz = gz0 + (k2 + 0.5) * CELL;
      const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      put(px, pz, l1 * ay + l2 * by + l3 * cy);
    }
  }
  // rows of heights in decimetres (-1: nothing there)
  const rows = [];
  for (let k2 = 0; k2 < nz; k2++) { const r = []; for (let i = 0; i < nx; i++) { const h = H[k2 * nx + i]; r.push(h < -1e8 ? -1 : Math.round(h * 10)); } rows.push(r.join(',')); }
  out[s.solid] = { x0: +gx0.toFixed(2), z0: +gz0.toFixed(2), nx, nz, cell: CELL, rows };
  console.log(s.solid.padEnd(22), s.a.padEnd(12), `${nx}x${nz}`, 'top', (Math.max(...H) | 0));
}
writeFileSync(ROOT + 'src/map/crustSolids.js', '// Generated by tools/crust/solids.mjs — height grids of the solid models (do not edit).\n// Each: grid origin, size, cell (m), and rows of heights in decimetres (-1: empty).\nexport const SOLIDS = ' + JSON.stringify(out) + ';\n');
console.log('wrote', Object.keys(out).length, 'solids');
