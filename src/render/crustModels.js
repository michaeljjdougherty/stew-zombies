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
          const m = new THREE.Mesh(mesh.geometry, mats);
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
