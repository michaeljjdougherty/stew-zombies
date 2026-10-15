// Side and cross-section views (ASCII) of a solid model's placement, for fitting
// its collision: node tools/crust/profile.mjs galleon [z0 z1 | x=X]
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
import { CRUST } from '../../src/map/crust.js';
const ROOT = new URL('../../', import.meta.url).pathname;
globalThis.self = globalThis;
class NoTextures { constructor(p) { this.parser = p; this.name = 'no_textures'; } loadTexture() { return Promise.resolve(new THREE.Texture()); } }
const [name, a1, a2] = process.argv.slice(2);
const s = CRUST.models.find((m) => m.solid === name);
const buf = readFileSync(ROOT + 'assets/crust/' + s.a + '.glb');
const L = new GLTFLoader(); L.register((p) => new NoTextures(p)); L.pluginCallbacks.unshift(L.pluginCallbacks.pop());
const g = await new Promise((res, rej) => L.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
g.scene.updateMatrixWorld(true);
const meshes = []; g.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
const b = new THREE.Box3(), t = new THREE.Box3();
for (const m of meshes) { m.geometry.computeBoundingBox(); t.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); b.union(t); }
const size = b.getSize(new THREE.Vector3());
let k = s.scale ?? 1;
if (s.fit) k = s.fit.h ? s.fit.h / size.y : s.fit.len ? s.fit.len / Math.max(size.x, size.z) : k;
const T0 = new THREE.Matrix4().makeTranslation(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
const M = new THREE.Matrix4().compose(new THREE.Vector3(s.x, s.y ?? 0, s.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(s.rx || 0, s.yaw || 0, s.rz || 0, 'YXZ')), new THREE.Vector3(k, k, k)).multiply(T0);
const pts = [];
const v = new THREE.Vector3();
for (const m of meshes) {
  const W = M.clone().multiply(m.matrixWorld), P = m.geometry.attributes.position, I = m.geometry.index;
  const n = I ? I.count : P.count;
  const get = (i) => v.fromBufferAttribute(P, i).applyMatrix4(W).clone();
  for (let i = 0; i < n; i += 3) {
    const A = get(I ? I.getX(i) : i), B = get(I ? I.getX(i + 1) : i + 1), C = get(I ? I.getX(i + 2) : i + 2);
    const n1 = Math.max(1, Math.ceil(A.distanceTo(B) / 0.2)), n2 = Math.max(1, Math.ceil(A.distanceTo(C) / 0.2));
    for (let p = 0; p <= n1; p++) for (let q = 0; q <= n2; q++) { const u = p / n1, w = q / n2; if (u + w > 1) continue; pts.push([A.x + (B.x - A.x) * u + (C.x - A.x) * w, A.y + (B.y - A.y) * u + (C.y - A.y) * w, A.z + (B.z - A.z) * u + (C.z - A.z) * w]); }
  }
}
const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (const p of pts) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i]); mx[i] = Math.max(mx[i], p[i]); }
console.log('bounds x', mn[0].toFixed(1), mx[0].toFixed(1), 'z', mn[2].toFixed(1), mx[2].toFixed(1), 'y', mn[1].toFixed(1), mx[1].toFixed(1));
const C = 0.5;
if (a1 && a1.startsWith('x=')) {
  const X = +a1.slice(2), w = +(a2 || 0.5);
  const sel = pts.filter((p) => Math.abs(p[0] - X) < w);
  const z0 = mn[2], z1 = mx[2];
  const S = new Set(sel.map((p) => Math.floor((p[1] + 2) / C) + ',' + Math.floor((p[2] - z0) / C)));
  for (let yi = Math.floor(16 / C); yi >= 0; yi--) { let row = ''; for (let zi = 0; zi <= (z1 - z0) / C; zi++) row += S.has(yi + ',' + zi) ? '#' : '.'; console.log((yi * C - 2).toFixed(1).padStart(5), row); }
  console.log('z from', z0.toFixed(1));
} else {
  const z0 = +(a1 ?? -1e9), z1 = +(a2 ?? 1e9);
  const sel = pts.filter((p) => p[2] >= z0 && p[2] <= z1);
  const x0 = mn[0], x1 = mx[0];
  const S = new Set(sel.map((p) => Math.floor((p[1] + 2) / C) + ',' + Math.floor((p[0] - x0) / C)));
  for (let yi = Math.floor(16 / C); yi >= 0; yi--) { let row = ''; for (let xi = 0; xi <= (x1 - x0) / C; xi++) row += S.has(yi + ',' + xi) ? '#' : '.'; console.log((yi * C - 2).toFixed(1).padStart(5), row); }
  console.log('x from', x0.toFixed(1), 'step', C);
}
