// Convert a Mixamo character FBX into the game's compact zombie format:
//   <out>/<id>.json  bones, meshes (attribute layout), materials, meta
//   <out>/<id>.bin   quantized vertex data + indices + inverse bind matrices
// Textures are written as PNGs to <texOut>/<id>_<n>.png for the Python step.
// The mesh is baked into the pose it was loaded in (Mixamo's T-pose), scaled
// so the hips sit 100 units up (the animations are normalized the same way).
import { loadFBX, blobs, THREE } from './fbxload.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const [path, id, outDir, texOut, eyeArg] = process.argv.slice(2);
// eye centres relative to the Head bone (x, y, z in hip-100 units), when the rig has no eye bones
const EYE_GUESS = eyeArg ? JSON.parse(eyeArg) : null;
mkdirSync(outDir, { recursive: true });
mkdirSync(texOut, { recursive: true });
const norm = (n) => n.replace(/^mixamorig\d*:?/, '');

const g = loadFBX(path);
g.updateMatrixWorld(true);

// canonical bones: first bone seen with each name (FBXLoader adds same-named sub-bones)
const canon = new Map();
g.traverse((o) => { if (o.isBone && !canon.has(norm(o.name))) canon.set(norm(o.name), o); });
const hips = canon.get('Hips');
const hipsY = new THREE.Vector3().setFromMatrixPosition(hips.matrixWorld).y;
const S = 100 / hipsY;

// --- bake every skinned mesh into world space, grouped by material
const groups = new Map(); // key -> { mat, pos:[], nrm:[], uv:[], si:[], sw:[] }
const srcTris = [];       // { mesh, tex, p:[9], uv:[6] } for texture masks
const usedBones = new Set();
const tmpM = new THREE.Matrix4(), acc = new THREE.Matrix4(), nm = new THREE.Matrix3();
const v = new THREE.Vector3(), n = new THREE.Vector3();
g.traverse((o) => {
  if (!o.isSkinnedMesh) return;
  const geo = o.geometry;
  const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
  const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const mats = [].concat(o.material);
  o.skeleton.update();
  const boneMats = o.skeleton.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, o.skeleton.boneInverses[i]));
  const boneCanon = o.skeleton.bones.map((b) => { const c = canon.get(norm(b.name)); return c; });
  const groupsOf = geo.groups.length ? geo.groups : [{ start: 0, count: geo.index ? geo.index.count : P.count, materialIndex: 0 }];
  const index = geo.index;
  for (const gr of groupsOf) {
    const mat = mats[gr.materialIndex] || mats[0];
    const key = (mat.map && mat.map.userData.url) + '|' + mat.name + '|' + mat.transparent;
    let G = groups.get(key);
    if (!G) { G = { mat, pos: [], nrm: [], uv: [], si: [], sw: [] }; groups.set(key, G); }
    const texUrl = mat.map && mat.map.userData.url;
    let tri = null;
    for (let k = gr.start; k < gr.start + gr.count; k++) {
      const i = index ? index.getX(k) : k;
      if ((k - gr.start) % 3 === 0) { tri = { mesh: o.name, alpha: !!(mat.transparent || mat.alphaMap), tex: texUrl, p: [], uv: [] }; srcTris.push(tri); }
      // skinning matrix for this vertex (world)
      acc.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      const inf = [];
      for (let j = 0; j < 4; j++) {
        const w = SW.getComponent(i, j);
        if (w <= 0) continue;
        const bi = SI.getComponent(i, j);
        const e = boneMats[bi].elements, a = acc.elements;
        for (let q = 0; q < 16; q++) a[q] += e[q] * w;
        inf.push([boneCanon[bi], w]);
      }
      tmpM.multiplyMatrices(o.matrixWorld, o.bindMatrixInverse).multiply(acc).multiply(o.bindMatrix);
      v.fromBufferAttribute(P, i).applyMatrix4(tmpM).multiplyScalar(S);
      nm.getNormalMatrix(tmpM);
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      G.pos.push(v.x, v.y, v.z); G.nrm.push(n.x, n.y, n.z);
      tri.p.push(v.x, v.y, v.z); tri.uv.push(U.getX(i), U.getY(i));
      G.uv.push(U.getX(i), U.getY(i));
      inf.sort((a, b) => b[1] - a[1]);
      // merge duplicate canonical bones
      const merged = new Map();
      for (const [b, w] of inf) merged.set(b, (merged.get(b) || 0) + w);
      const list = [...merged].slice(0, 4);
      const tot = list.reduce((s, x) => s + x[1], 0) || 1;
      const si = [0, 0, 0, 0], sw = [0, 0, 0, 0];
      list.forEach(([b, w], j) => { si[j] = b; sw[j] = w / tot; usedBones.add(norm(b.name)); });
      G.si.push(si); G.sw.push(sw);
    }
  }
});

// --- bones to keep: used ones, their ancestors, the eyes, and everything the animations drive
const ANIM_BONES = new Set(['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End', 'LeftEye', 'RightEye',
  ...['Left', 'Right'].flatMap((s) => [`${s}Shoulder`, `${s}Arm`, `${s}ForeArm`, `${s}Hand`, `${s}UpLeg`, `${s}Leg`, `${s}Foot`, `${s}ToeBase`, `${s}Toe_End`])]);
const keep = new Set();
for (const [name, b] of canon) {
  if (!(usedBones.has(name) || ANIM_BONES.has(name))) continue;
  for (let o = b; o && o.isBone; o = o.parent) keep.add(norm(o.name));
}
const order = [];
const visit = (b) => { if (keep.has(norm(b.name)) && canon.get(norm(b.name)) === b) order.push(b); for (const c of b.children) if (c.isBone) visit(c); };
visit(hips);
const boneIndex = new Map(order.map((b, i) => [b, i]));
const worldOf = (b) => new THREE.Matrix4().makeScale(S, S, S).multiply(b.matrixWorld);
const bones = order.map((b) => {
  let p = b.parent;
  while (p && p.isBone && !boneIndex.has(p)) p = p.parent;
  const parent = p && boneIndex.has(p) ? boneIndex.get(p) : -1;
  const W = worldOf(b);
  const L = parent >= 0 ? new THREE.Matrix4().copy(worldOf(order[parent])).invert().multiply(W) : W;
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
  L.decompose(pos, quat, scl);
  return { name: norm(b.name), parent, pos: pos.toArray().map((x) => +x.toFixed(4)), quat: quat.toArray().map((x) => +x.toFixed(6)), scl: scl.toArray().map((x) => +x.toFixed(5)) };
});
const inverses = order.map((b) => worldOf(b).invert().elements);

// --- merge duplicate vertices and write the binary
const chunks = [];
let offset = 0;
const push = (typed) => { const pad = (4 - (offset % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; } const b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength); chunks.push(b); const at = offset; offset += b.length; return at; };
const textures = new Map();
const texName = (url) => { if (!url) return null; if (!textures.has(url)) textures.set(url, `${id}_${textures.size}`); return textures.get(url); };
const meshes = [];
let box = new THREE.Box3();
for (const G of groups.values()) {
  const cnt = G.pos.length / 3;
  const map = new Map(), remap = new Int32Array(cnt);
  const P = [], N = [], UV = [], SI = [], SW = [];
  for (let i = 0; i < cnt; i++) {
    const key = [G.pos[i * 3], G.pos[i * 3 + 1], G.pos[i * 3 + 2]].map((x) => Math.round(x * 100)).join(',') + '|' + [G.nrm[i * 3], G.nrm[i * 3 + 1], G.nrm[i * 3 + 2]].map((x) => Math.round(x * 60)).join(',') + '|' + Math.round(G.uv[i * 2] * 4096) + ',' + Math.round(G.uv[i * 2 + 1] * 4096);
    let j = map.get(key);
    if (j === undefined) {
      j = P.length / 3; map.set(key, j);
      P.push(G.pos[i * 3], G.pos[i * 3 + 1], G.pos[i * 3 + 2]); N.push(G.nrm[i * 3], G.nrm[i * 3 + 1], G.nrm[i * 3 + 2]); UV.push(G.uv[i * 2], G.uv[i * 2 + 1]);
      SI.push(...G.si[i].map((b, k) => (G.sw[i][k] > 0 ? boneIndex.get(b) ?? 0 : 0))); SW.push(...G.sw[i]);
    }
    remap[i] = j;
  }
  const vc = P.length / 3;
  // positions: int16 over the mesh bounds
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vc; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i * 3 + k]); mx[k] = Math.max(mx[k], P[i * 3 + k]); }
  box.union(new THREE.Box3(new THREE.Vector3(...mn), new THREE.Vector3(...mx)));
  const qp = new Int16Array(vc * 3);
  for (let i = 0; i < vc; i++) for (let k = 0; k < 3; k++) qp[i * 3 + k] = Math.round(((P[i * 3 + k] - mn[k]) / Math.max(1e-6, mx[k] - mn[k])) * 65535 - 32768);
  const qn = new Int8Array(vc * 4);
  for (let i = 0; i < vc; i++) for (let k = 0; k < 3; k++) qn[i * 4 + k] = Math.round(N[i * 3 + k] * 127);
  const uv = new Float32Array(UV);
  const si = new Uint8Array(SI);
  const sw = new Uint8Array(vc * 4);
  for (let i = 0; i < vc; i++) {
    const w = SW.slice(i * 4, i * 4 + 4).map((x) => Math.round(x * 255));
    const d = 255 - w.reduce((a, b) => a + b, 0); w[0] += d;   // weights add up exactly
    sw.set(w, i * 4);
  }
  const idx = vc < 65536 ? new Uint16Array(remap) : new Uint32Array(remap);
  if (si.some((x) => x >= order.length)) throw new Error('bad bone index');
  const m = G.mat;
  meshes.push({
    vertexCount: vc, indexCount: idx.length,
    min: mn, max: mx,
    pos: push(qp), nrm: push(qn), uv: push(uv), si: push(si), sw: push(sw),
    index: push(idx), index32: !(idx instanceof Uint16Array),
    material: {
      name: m.name,
      map: texName(m.map && m.map.userData.url),
      normalMap: texName(m.normalMap && m.normalMap.userData.url),
      alpha: !!(m.transparent || m.alphaMap),
      alphaMap: texName(m.alphaMap && m.alphaMap.userData.url),
    },
  });
}
const invAt = push(new Float32Array(inverses.flat()));
writeFileSync(`${outDir}/${id}.bin`, Buffer.concat(chunks));
const size = box.getSize(new THREE.Vector3());
const meta = { id, source: path.split('/').pop(), scale: S, hipsY: 100, height: +box.max.y.toFixed(2), width: +size.x.toFixed(2), bones, inverses: invAt, meshes, textures: [...textures].map(([url, name]) => ({ name, url })) };
// eye bones, if the rig has them
for (const e of ['LeftEye', 'RightEye']) { const i = order.findIndex((b) => norm(b.name) === e); if (i >= 0) meta[e] = i; }
writeFileSync(`${outDir}/${id}.json`, JSON.stringify(meta));
// --- texture masks: skin (the body mesh), clothes (the rest), eyes (near the eye centres)
const headW = worldOf(canon.get('Head'));
const headPos = new THREE.Vector3().setFromMatrixPosition(headW);
const eyeCentres = [];
let eyeR = 1.5;
if (EYE_GUESS) {
  eyeR = EYE_GUESS[2] || 1.5;
  for (const e of EYE_GUESS.slice(0, 2)) {
    const c = headPos.clone().add(new THREE.Vector3(e[0], e[1], e[2] ?? 0));
    if (e[2] == null) {
      // on the face surface: the most forward point near (x, y)
      let best = -Infinity;
      for (const t of srcTris) for (let j = 0; j < 3; j++) {
        const x = t.p[j * 3], y = t.p[j * 3 + 1], z = t.p[j * 3 + 2];
        if (Math.hypot(x - c.x, y - c.y) < 0.8 && z > best) best = z;
      }
      c.z = best - 0.4;
    }
    eyeCentres.push(c);
  }
} else {
  for (const e of ['LeftEye', 'RightEye']) { const b = canon.get(e); if (b) eyeCentres.push(new THREE.Vector3().setFromMatrixPosition(worldOf(b))); }
  eyeR = 1.75;
}
// the mouth and chin (for blood): below the eyes, on the face's surface
const mouthPts = [];
if (eyeCentres.length === 2) {
  const ey = (eyeCentres[0].y + eyeCentres[1].y) / 2, ex = (eyeCentres[0].x + eyeCentres[1].x) / 2;
  const span = Math.abs(eyeCentres[0].x - eyeCentres[1].x);
  for (const [dy, r] of [[-1.2, 0.36], [-1.45, 0.28], [-1.7, 0.2]]) {
    const c = new THREE.Vector3(ex, ey + dy * span, 0);
    let best = -Infinity;
    for (const t of srcTris) for (let j = 0; j < 3; j++) { const x = t.p[j * 3], y = t.p[j * 3 + 1], z = t.p[j * 3 + 2]; if (Math.hypot(x - c.x, y - c.y) < 0.8 && z > best) best = z; }
    c.z = best; mouthPts.push([c, r * span]);
  }
}
const uvOut = {};
const isSkin = (name) => /body|skin|head/i.test(name) && !/shirt|pants|top|bottom|shoe|sneaker|hair|lash/i.test(name);
for (const t of srcTris) {
  const name = textures.get(t.tex);
  if (!name) continue;
  const o = (uvOut[name] ||= { skin: [], cloth: [], eyes: [], mouth: [] });
  const r = t.uv.map((x) => +x.toFixed(4));
  const near = [0, 1, 2].every((j) => eyeCentres.some((c) => Math.hypot(t.p[j * 3] - c.x, t.p[j * 3 + 1] - c.y, t.p[j * 3 + 2] - c.z) < eyeR));
  if (near) o.eyes.push(r);
  else if ([0, 1, 2].every((j) => mouthPts.some(([c, rr]) => Math.hypot(t.p[j * 3] - c.x, (t.p[j * 3 + 1] - c.y) * 0.8, t.p[j * 3 + 2] - c.z) < rr))) o.mouth.push(r);
  if (t.alpha) continue;
  if (isSkin(t.mesh) || /Bodymat/.test(t.mesh)) o.skin.push(r); else o.cloth.push(r);
}
writeFileSync(`${outDir}/${id}.uv.json`, JSON.stringify(uvOut));
meta.eyes = eyeCentres.map((c) => c.clone().sub(headPos).toArray().map((x) => +x.toFixed(2)));
// in the Head bone's own frame (what the glow sprites hang off), pushed to the front of the eye
const headInv = headW.clone().invert();
meta.eyesLocal = eyeCentres.map((c) => c.clone().add(new THREE.Vector3(0, 0, eyeR * 0.55)).applyMatrix4(headInv).toArray().map((x) => +x.toFixed(3)));
meta.eyeSize = +(eyeR * 2).toFixed(2);
meta.eyeHead = order.findIndex((b) => norm(b.name) === 'Head');
writeFileSync(`${outDir}/${id}.json`, JSON.stringify(meta));
for (const [url, name] of textures) { const b = blobs.get(url); if (b) writeFileSync(`${texOut}/${name}.png`, Buffer.from(await b.arrayBuffer())); }
console.log(JSON.stringify({ eyes: meta.eyes, eyeTris: Object.values(uvOut).map((x) => x.eyes.length), id, S: +S.toFixed(4), bones: bones.length, meshes: meshes.map((m) => [m.material.name, m.vertexCount, m.indexCount / 3, m.material.alpha]), height: meta.height, bin: offset, tex: textures.size }));
