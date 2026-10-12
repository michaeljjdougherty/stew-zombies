// =============================================================================
// The downloaded models placed round Call of the Crust (assets/crust/, shrunk
// by tools/crust/optimize.mjs): launch pads, the tank, the trench kit, the
// ship, the tesla coils, the ice... The map lists each placement (map.models):
// which model, which of its pieces (a pack of rocks or trench sections), where,
// turned and scaled. Copies of the same piece are drawn as one instanced mesh.
// Everything loads in the background; nothing waits on it.
// =============================================================================
import * as THREE from 'three';
import { loadModel } from './gltfLite.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const BASE = 'assets/crust/';
const sanitize = (s) => String(s || '').replace(/\s/g, '_').replace(/[[\]\.:\/]/g, '');

// The meshes of a loaded model to use: all of them, or the pieces named in `pick`.
function piecesOf(scene, pick) {
  scene.updateMatrixWorld(true);
  const want = pick ? pick.map(sanitize) : null;
  const out = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (want) {
      const names = [o.name, o.parent && o.parent.name].map(sanitize);
      if (!want.some((w) => names.some((n) => n === w || n.startsWith(w)))) return;
    }
    out.push(o);
  });
  return out;
}

// The pieces' bounds in the model's own space.
function boundsOf(meshes) {
  const b = new THREE.Box3(), t = new THREE.Box3();
  for (const m of meshes) {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    t.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
    b.union(t);
  }
  return b;
}

// Make a model's materials sit right in the night: no mirror shine, a little
// light of their own (the islands are lit live), tinted to the island.
function settle(mat, look) {
  const m = mat.clone();
  if (m.roughness !== undefined && m.roughness < 0.55) m.roughness = 0.55;
  if (m.metalness !== undefined && m.metalness > 0.5) m.metalness = 0.5;
  if (look && look.tint) m.color = (m.color || new THREE.Color(1, 1, 1)).clone().multiply(new THREE.Color(look.tint));
  if (m.emissive && m.emissive.getHex() === 0 && !m.emissiveMap) {
    if (m.map) { m.emissiveMap = m.map; m.emissive = new THREE.Color(look && look.glow ? look.glow : '#2a2e36'); }
    else m.emissive = (m.color || new THREE.Color(1, 1, 1)).clone().multiplyScalar(look && look.glowK ? look.glowK : 0.18);
  }
  if (look && look.hot) { m.emissive = new THREE.Color(look.hot); m.emissiveIntensity = 1; }
  m.side = THREE.DoubleSide;   // (scans and kits often leave faces one-sided)
  return m;
}

export function buildModels(out, group, map) {
  const specs = map.models || [];
  if (!specs.length) return;
  // group by model and pieces: each group becomes instanced meshes
  const groups = new Map();
  for (const s of specs) {
    const key = s.a + '|' + (s.pick ? s.pick.join(',') : '*') + '|' + (s.look ? JSON.stringify(s.look) : '');
    if (!groups.has(key)) groups.set(key, { a: s.a, pick: s.pick, look: s.look, list: [] });
    groups.get(key).list.push(s);
  }
  const root = new THREE.Group();
  root.name = 'crustModels';
  group.add(root);
  out.models = root;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const G of groups.values()) {
    loadModel(BASE + G.a + '.glb').then((gltf) => {
      if (!gltf) return;
      const meshes = piecesOf(gltf.scene, G.pick);
      if (!meshes.length) { console.warn('[crust] no pieces', G.a, G.pick); return; }
      const b = boundsOf(meshes);
      const size = b.getSize(new THREE.Vector3());
      // its foot at the origin, centred
      const T0 = new THREE.Matrix4().makeTranslation(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      // a model that moves (a wind turbine's blades, a rat): a copy each, and its clips playing
      if (G.list[0].anim) {
        for (const s of G.list) {
          let k = s.scale ?? 1;
          if (s.fit) k = s.fit.h ? s.fit.h / size.y : s.fit.len ? s.fit.len / Math.max(size.x, size.z) : s.fit.w ? s.fit.w / Math.min(size.x, size.z) : k;
          const holder = new THREE.Group();
          holder.position.set(s.x, s.y ?? 0, s.z);
          holder.rotation.set(s.rx || 0, s.yaw || 0, s.rz || 0, 'YXZ');
          holder.scale.setScalar(k);
          const c = cloneSkinned(gltf.scene);
          c.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
          c.traverse((o) => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map((mm) => settle(mm, G.look)) : settle(o.material, G.look); o.frustumCulled = false; o.userData.noBake = true; } });
          holder.add(c);
          root.add(holder);
          if (gltf.animations && gltf.animations.length) {
            const mixer = new THREE.AnimationMixer(c);
            const clips = s.clip ? gltf.animations.filter((a) => a.name.includes(s.clip)) : gltf.animations;
            for (const clip of clips.length ? clips : gltf.animations.slice(0, 1)) mixer.clipAction(clip).play();
            mixer.timeScale = s.animSpeed ?? 1;
            mixer.update(Math.random() * 10);
            (out.mixers || (out.mixers = [])).push(mixer);
          }
          if (s.tag) (out.tagged || (out.tagged = {}))[s.tag] = holder;
          // a critter that runs along a path (round a room, up and down a trench)
          if (s.path) (out.movers || (out.movers = [])).push({ holder, path: s.path, speed: s.speed || 1, d: (s.phase || 0) * 3, pingpong: !!s.pingpong, y: s.y ?? 0, turn: s.turn ?? -Math.PI / 2 });
        }
        return;
      }
      const placements = G.list.map((s) => {
        let k = s.scale ?? 1;
        if (s.fit) k = s.fit.h ? s.fit.h / size.y : s.fit.len ? s.fit.len / Math.max(size.x, size.z) : s.fit.w ? s.fit.w / Math.min(size.x, size.z) : k;
        e.set(s.rx || 0, s.yaw || 0, s.rz || 0, 'YXZ');
        q.setFromEuler(e);
        const ks = Array.isArray(k) ? k : [k, k, k];
        const M = new THREE.Matrix4().compose(v.set(s.x, s.y ?? 0, s.z), q, sc.set(ks[0], ks[1], ks[2]));
        return M.multiply(T0);
      });
      for (const mesh of meshes) {
        const mats = Array.isArray(mesh.material) ? mesh.material.map((mm) => settle(mm, G.look)) : settle(mesh.material, G.look);
        if (placements.length === 1) {
          const s0 = G.list[0];
          const geo = s0.cutBelow != null ? cutBelow(mesh.geometry, new THREE.Matrix4().multiplyMatrices(placements[0], mesh.matrixWorld), (s0.y ?? 0) + s0.cutBelow) : mesh.geometry;
          if (!geo) continue;
          const m = new THREE.Mesh(geo, mats);
          m.matrixAutoUpdate = false;
          m.matrix.multiplyMatrices(placements[0], mesh.matrixWorld);
          m.userData.noBake = true;
          root.add(m);
          continue;
        }
        const im = new THREE.InstancedMesh(mesh.geometry, mats, placements.length);
        placements.forEach((P, i) => { m4.multiplyMatrices(P, mesh.matrixWorld); im.setMatrixAt(i, m4); });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        im.userData.noBake = true;
        root.add(im);
      }
    });
  }
}

// A model's triangles, less those wholly below world height y (a ground plate
// that would sit in the rock or hang off a cliff). null if none are left.
function cutBelow(geo, M, y) {
  const P = geo.attributes.position, I = geo.index;
  const n = I ? I.count : P.count;
  const v = new THREE.Vector3(), keep = [];
  let cut = 0;
  for (let i = 0; i < n; i += 3) {
    let top = -Infinity;
    for (let j = 0; j < 3; j++) { v.fromBufferAttribute(P, I ? I.getX(i + j) : i + j).applyMatrix4(M); top = Math.max(top, v.y); }
    if (top < y) { cut++; continue; }
    for (let j = 0; j < 3; j++) keep.push(I ? I.getX(i + j) : i + j);
  }
  if (!cut) return geo;
  if (!keep.length) return null;
  const g = geo.clone();
  g.setIndex(keep);
  return g;
}

// Move the critters along their paths (a loop, or there and back).
export function updateMovers(out, dt) {
  for (const M of out.movers || []) {
    const P = M.path;
    if (!M.len) {
      M.segs = [];
      const pts = M.pingpong ? P : [...P, P[0]];
      for (let i = 0; i < pts.length - 1; i++) M.segs.push([pts[i], pts[i + 1], Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])]);
      M.len = M.segs.reduce((a, s) => a + s[2], 0) || 1;
    }
    M.d += dt * M.speed;
    let d = M.d % (M.pingpong ? M.len * 2 : M.len), back = false;
    if (M.pingpong && d > M.len) { d = M.len * 2 - d; back = true; }
    for (const [a, b, l] of M.segs) {
      if (d > l) { d -= l; continue; }
      const u = l ? d / l : 0;
      M.holder.position.set(a[0] + (b[0] - a[0]) * u, M.y, a[1] + (b[1] - a[1]) * u);
      const dx = (b[0] - a[0]) * (back ? -1 : 1), dz = (b[1] - a[1]) * (back ? -1 : 1);
      M.holder.rotation.y = Math.atan2(dx, dz) + (M.turn || 0);
      break;
    }
  }
}
