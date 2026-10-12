// Rig a static character model for the zombie animations: fit a Mixamo
// skeleton (a reference zombie's, scaled) to the mesh, find which way its arms
// hang, weight every vertex to its nearest bones, and write a skinned GLB that
// conv_char.mjs can convert like any Mixamo character.
// usage: node autorig.mjs <in.glb> <out.glb> <refJson> <height> [turn]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, dedup, prune, metalRough } from '@gltf-transform/functions';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';

const [src, dst, refPath, H, turn] = [process.argv[2], process.argv[3], process.argv[4], +process.argv[5], +(process.argv[6] || 0)];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
await doc.transform(metalRough(), dedup(), flatten(), prune());
const root = doc.getRoot(), scene = root.listScenes()[0], buffer = root.listBuffers()[0];

// --- bake every mesh into one space, feet on the ground, H tall, facing +z
const parts = [];
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const M = new THREE.Matrix4().fromArray(node.getWorldMatrix());
  if (turn) M.premultiply(new THREE.Matrix4().makeRotationY(turn));
  const NM = new THREE.Matrix3().getNormalMatrix(M);
  for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL');
    const pos = [], nrm = [], e = [];
    for (let i = 0; i < P.getCount(); i++) { P.getElement(i, e); pos.push(new THREE.Vector3(...e).applyMatrix4(M)); if (N) { N.getElement(i, e); nrm.push(new THREE.Vector3(...e).applyMatrix3(NM).normalize()); } }
    if (!N) {
      // (no normals in the file: work them out)
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos.flatMap((v) => v.toArray()), 3));
      if (prim.getIndices()) g.setIndex(Array.from(prim.getIndices().getArray()));
      g.computeVertexNormals();
      const na = g.attributes.normal;
      for (let i = 0; i < na.count; i++) nrm.push(new THREE.Vector3(na.getX(i), na.getY(i), na.getZ(i)));
    }
    parts.push({ node, prim, pos, nrm });
  }
}
const box = new THREE.Box3(); for (const p of parts) for (const v of p.pos) box.expandByPoint(v);
const s = H / (box.max.y - box.min.y), c = box.getCenter(new THREE.Vector3());
for (const p of parts) for (const v of p.pos) { v.x = (v.x - c.x) * s; v.y = (v.y - box.min.y) * s; v.z = (v.z - c.z) * s; }
const V = parts.flatMap((p) => p.pos);

// --- the reference skeleton (T-pose, hips 100 up), scaled to this height
const ref = JSON.parse(readFileSync(refPath));
const Wr = [];
ref.bones.forEach((b, i) => { const L = new THREE.Matrix4().compose(new THREE.Vector3(...b.pos), new THREE.Quaternion(...b.quat), new THREE.Vector3(1, 1, 1)); Wr[i] = b.parent >= 0 ? Wr[b.parent].clone().multiply(L) : L; });
const k = H / ref.height;
const KEEP = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End', ...['Left', 'Right'].flatMap((d) => [`${d}Shoulder`, `${d}Arm`, `${d}ForeArm`, `${d}Hand`, `${d}UpLeg`, `${d}Leg`, `${d}Foot`, `${d}ToeBase`, `${d}Toe_End`])];
const J = {}, Q = {}, PARENT = {};
for (const n of KEEP) {
  const i = ref.bones.findIndex((b) => b.name === n);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  Wr[i].decompose(p, q, sc);
  J[n] = p.multiplyScalar(k); Q[n] = q;
  let pi = ref.bones[i].parent; while (pi >= 0 && !KEEP.includes(ref.bones[pi].name)) pi = ref.bones[pi].parent;
  PARENT[n] = pi >= 0 ? ref.bones[pi].name : null;
}
const slab = (y, dy, f) => { let n = 0; const m = new THREE.Vector3(); for (const v of V) if (Math.abs(v.y - y) < dy && f(v)) { m.add(v); n++; } return n ? m.divideScalar(n) : null; };
// the spine follows the body's middle
for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']) { const m = slab(J[n].y, 3 * k, (v) => Math.abs(v.x) < 10 * k); if (m) { const dz = m.z - J[n].z; J[n].z += dz; if (n === 'Head') J.HeadTop_End.z += dz; } }
for (const d of ['Left', 'Right']) {
  const sx = d === 'Left' ? 1 : -1;
  // the legs: the middle of each leg at the hip, knee and ankle
  for (const n of ['UpLeg', 'Leg', 'Foot']) {
    const m = slab(J[d + n].y, 3 * k, (v) => v.x * sx > 2 * k && Math.abs(v.x) < 30 * k);
    if (m) { const dx = m.x - J[d + n].x, dz = m.z - J[d + n].z; J[d + n].x += dx; if (n !== 'UpLeg') J[d + n].z += dz; if (n === 'Foot') for (const t of ['ToeBase', 'Toe_End']) { J[d + t].x += dx; J[d + t].z += dz; } }
  }
  for (const n of ['Shoulder']) J[d + n].z = J.Spine2.z + (J[d + n].z - J.Spine2.z);
  // the arm: which way it hangs (searched round the shoulder in the body's plane)
  const A = J[d + 'Arm'];
  A.z = J[d + 'Shoulder'].z;
  const L = J[d + 'Arm'].distanceTo(J[d + 'Hand']), R = 5.5 * k;
  let best = null;
  for (let ph = 0; ph <= 85; ph += 2.5) for (let ps = -30; ps <= 30; ps += 7.5) {
    const dir = new THREE.Vector3(sx * Math.cos(ph * Math.PI / 180) * Math.cos(ps * Math.PI / 180), -Math.sin(ph * Math.PI / 180), Math.cos(ph * Math.PI / 180) * Math.sin(ps * Math.PI / 180));
    let n = 0;
    for (const v of V) { const w = v.clone().sub(A); const t = w.dot(dir); if (t < 0.3 * L || t > 1.05 * L) continue; if (w.addScaledVector(dir, -t).length() < R) n++; }
    if (!best || n > best.n) best = { n, dir, ph, ps };
  }
  let tmax = 0;
  for (const v of V) { const w = v.clone().sub(A); const t = w.dot(best.dir); if (t > 0 && w.addScaledVector(best.dir, -t).length() < R * 1.3) tmax = Math.max(tmax, t); }
  const handLen = 17 * k;
  const reach = tmax > 0.6 * L ? Math.min(tmax - handLen, 1.15 * L) : L;
  const refDir = J[d + 'Hand'].clone().sub(J[d + 'Arm']).normalize();
  const qa = new THREE.Quaternion().setFromUnitVectors(refDir, best.dir);
  const elbowF = J[d + 'Arm'].distanceTo(J[d + 'ForeArm']) / L;
  J[d + 'ForeArm'] = A.clone().addScaledVector(best.dir, reach * elbowF);
  J[d + 'Hand'] = A.clone().addScaledVector(best.dir, reach);
  for (const n of ['Arm', 'ForeArm', 'Hand']) Q[d + n] = qa.clone().multiply(Q[d + n]);
  console.log(d, 'arm', best.ph, 'deg down', best.ps, 'fwd', best.n, 'verts; reach', (reach / k).toFixed(1), 'ref', (L / k).toFixed(1));
  J[d + 'HandEnd'] = J[d + 'Hand'].clone().addScaledVector(best.dir, handLen);
}

// --- the bones
const nodes = {};
const armature = doc.createNode('Armature'); scene.addChild(armature);
const Wm = (n) => new THREE.Matrix4().compose(J[n], Q[n], new THREE.Vector3(1, 1, 1));
for (const n of KEEP) {
  const node = doc.createNode('mixamorig:' + n);
  const L = PARENT[n] ? Wm(PARENT[n]).invert().multiply(Wm(n)) : Wm(n);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  L.decompose(p, q, sc);
  node.setTranslation(p.toArray()).setRotation(q.toArray());
  nodes[n] = node;
}
for (const n of KEEP) (PARENT[n] ? nodes[PARENT[n]] : armature).addChild(nodes[n]);
const skin = doc.createSkin('rig');
const ibm = [];
KEEP.forEach((n) => { skin.addJoint(nodes[n]); ibm.push(...Wm(n).invert().elements); });
skin.setSkeleton(nodes.Hips);
skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(new Float32Array(ibm)).setBuffer(buffer));

// --- weights: each vertex to its nearest bones (never across to the other side's limbs)
const segs = [];
const seg = (bone, a, b) => segs.push({ i: KEEP.indexOf(bone), a: J[a], b: J[b] || J[a], bone });
seg('Hips', 'Hips', 'Spine'); seg('Hips', 'LeftUpLeg', 'RightUpLeg');
seg('Spine', 'Spine', 'Spine1'); seg('Spine1', 'Spine1', 'Spine2'); seg('Spine2', 'Spine2', 'Neck'); seg('Neck', 'Neck', 'Head'); seg('Head', 'Head', 'HeadTop_End');
for (const d of ['Left', 'Right']) {
  seg(d + 'Shoulder', d + 'Shoulder', d + 'Arm'); seg(d + 'Arm', d + 'Arm', d + 'ForeArm'); seg(d + 'ForeArm', d + 'ForeArm', d + 'Hand'); seg(d + 'Hand', d + 'Hand', d + 'HandEnd');
  seg(d + 'UpLeg', d + 'UpLeg', d + 'Leg'); seg(d + 'Leg', d + 'Leg', d + 'Foot'); seg(d + 'Foot', d + 'Foot', d + 'ToeBase'); seg(d + 'ToeBase', d + 'ToeBase', d + 'Toe_End');
}
const distSeg = (v, a, b) => { const ab = b.clone().sub(a), t = ab.lengthSq() ? Math.max(0, Math.min(1, v.clone().sub(a).dot(ab) / ab.lengthSq())) : 0; return v.distanceTo(a.clone().addScaledVector(ab, t)); };
const e2 = (1.5 * k) ** 2;
for (const p of parts) {
  const n = p.pos.length;
  const jo = new Uint16Array(n * 4), we = new Float32Array(n * 4);
  p.pos.forEach((v, vi) => {
    const ws = [];
    for (const s2 of segs) {
      const side = /^Left/.test(s2.bone) ? 1 : /^Right/.test(s2.bone) ? -1 : 0;
      if (side && v.x * side < -2 * k) continue;
      // (a leg isn't an arm: below the hips, only arms out at the side reach the hands)
      const d = distSeg(v, s2.a, s2.b);
      ws.push([s2.i, 1 / (d * d + e2) ** 2]);
    }
    ws.sort((a, b) => b[1] - a[1]);
    const top = ws.slice(0, 4), tot = top.reduce((a, b) => a + b[1], 0);
    top.forEach(([i, w], j) => { jo[vi * 4 + j] = i; we[vi * 4 + j] = w / tot; });
  });
  const P = new Float32Array(n * 3); p.pos.forEach((v, i) => v.toArray(P, i * 3));
  p.prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(buffer));
  if (p.nrm.length) { const N = new Float32Array(n * 3); p.nrm.forEach((v, i) => v.toArray(N, i * 3)); p.prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(buffer)); }
  p.prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(jo).setBuffer(buffer));
  p.prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(we).setBuffer(buffer));
}
for (const p of parts) { p.node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]).setSkin(skin); }
await doc.transform(prune({ keepAttributes: true }));
await io.write(dst, doc);
console.log('wrote', dst, V.length, 'verts', 'joints', Object.fromEntries(['Hips', 'Head', 'LeftArm', 'LeftHand', 'LeftFoot'].map((n) => [n, J[n].toArray().map((x) => +x.toFixed(1))])));
