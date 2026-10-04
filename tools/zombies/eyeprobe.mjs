// Find eyeball-like pieces: small, separate, symmetric parts of the head.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
const dir = process.argv[2];
for (const id of process.argv.slice(3)) {
  const meta = JSON.parse(readFileSync(`${dir}/${id}.json`));
  const bin = readFileSync(`${dir}/${id}.bin`); const ab = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
  const head = meta.bones.findIndex((b) => b.name === 'Head');
  // head bone world position: accumulate local transforms (positions only along the chain, quats matter) -> use inverse bind
  const inv = new Float32Array(ab, meta.inverses, meta.bones.length * 16);
  // world = inverse(inv); translation of world matrix = -R^T t ; simple 4x4 inverse
  const hp = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(inv, head * 16).invert()).toArray();
  const found = [];
  meta.meshes.forEach((me, mi) => {
    const vc = me.vertexCount;
    const qp = new Int16Array(ab, me.pos, vc * 3);
    const P = new Float32Array(vc * 3);
    for (let i = 0; i < vc * 3; i++) { const k = i % 3; P[i] = me.min[k] + ((qp[i] + 32768) / 65535) * (me.max[k] - me.min[k]); }
    const idx = me.index32 ? new Uint32Array(ab, me.index, me.indexCount) : new Uint16Array(ab, me.index, me.indexCount);
    // union-find, also joining vertices at the same position (uv seams)
    const par = new Int32Array(vc).map((_, i) => i);
    const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const u = (a, b) => { a = f(a); b = f(b); if (a !== b) par[a] = b; };
    for (let i = 0; i < idx.length; i += 3) { u(idx[i], idx[i + 1]); u(idx[i], idx[i + 2]); }
    const key = new Map();
    for (let i = 0; i < vc; i++) { const k = `${Math.round(P[i * 3] * 50)},${Math.round(P[i * 3 + 1] * 50)},${Math.round(P[i * 3 + 2] * 50)}`; if (key.has(k)) u(i, key.get(k)); else key.set(k, i); }
    const comps = new Map();
    for (let i = 0; i < vc; i++) { const r = f(i); let c = comps.get(r); if (!c) { c = { n: 0, min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }; comps.set(r, c); } c.n++; for (let k = 0; k < 3; k++) { c.min[k] = Math.min(c.min[k], P[i * 3 + k]); c.max[k] = Math.max(c.max[k], P[i * 3 + k]); } }
    for (const c of comps.values()) {
      const size = [0, 1, 2].map((k) => c.max[k] - c.min[k]);
      const cen = [0, 1, 2].map((k) => (c.max[k] + c.min[k]) / 2 - hp[k]);
      if (Math.max(...size) < 6 && Math.min(...size) > 0.5 && c.n > 20 && cen[1] > 0 && cen[1] < 16 && Math.abs(cen[0]) > 1.2 && Math.abs(cen[0]) < 7 && cen[2] > 0) found.push({ mesh: mi, n: c.n, cen: cen.map((x) => +x.toFixed(2)), size: size.map((x) => +x.toFixed(2)) });
    }
  });
  console.log(id, 'head', hp.map((x) => +x.toFixed(1)), JSON.stringify(found));
}
