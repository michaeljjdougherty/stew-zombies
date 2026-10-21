// =============================================================================
// Bikini Bottom (Map 3): the town itself. The model (assets/bikinibottom/town.glb,
// tools/bikinibottom/build.mjs) keeps its own textures, so it looks like the
// game it came from; here it gets the light down through the water, the
// blue-green sea fog, and its flowery sky hung round the camera.
// Also the barricades' plank surrounds (the frames and planks are mapView's).
// =============================================================================
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as T from './textures.js';
import { fetchGlb, gltfLoader } from './gltfLite.js';
import { GATE } from '../map/bikiniBottomGround.js';

// (the game's loader: textures straight from the file's bytes, which the
// artifact page needs; plus the decoder for these compressed models)
function loader() { const l = gltfLoader(); l.setMeshoptDecoder(MeshoptDecoder); return l; }
// the model's own materials, lit the cheap way like the rest of the game
function lambert(s) {
  const l = new THREE.MeshLambertMaterial({ map: s.map, color: s.color, transparent: s.transparent, alphaTest: s.alphaTest, opacity: s.opacity, side: s.side, vertexColors: s.vertexColors, name: s.name });
  if (l.map) l.map.colorSpace = THREE.SRGBColorSpace;
  return l;
}

// Plank sheets and posts round each barricade, like the town's bamboo fences.
function barricadeSurrounds(mv, mat) {
  const wc = mv.cfg.windows, T0 = mv.T;
  const geo = [];
  for (const w of mv.sim.windows) {
    const grp = new THREE.Group();
    grp.position.set(w.center.x, w.center.y || 0, w.center.z);
    grp.rotation.y = Math.atan2(w.normal.x, w.normal.z);
    const hw = wc.width / 2;
    const add = (x, y, sx, sy) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.06), mat); b.position.set(x, y, -T0 / 2); grp.add(b); };
    add(-hw - 0.55, 1.2, 1.0, 2.4);          // the sheets either side
    add(hw + 0.55, 1.2, 1.0, 2.4);
    add(0, wc.sillHeight / 2, wc.width + 0.1, wc.sillHeight);   // under the sill
    add(0, (wc.topHeight + 2.4) / 2 + 0.03, wc.width + 0.1, 2.4 - wc.topHeight);   // over the top
    for (const x of [-hw - 1.05, hw + 1.05]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.7, 0.12), mat); p.position.set(x, 1.35, -T0 / 2); grp.add(p); }   // posts
    grp.userData.noBake = true;
    geo.push(grp);
  }
  return geo;
}

export function buildBikiniBottom(mv) {
  const map = mv.map, cfg = mv.cfg.bikiniBottom;
  const out = { mv, root: new THREE.Group(), ready: false, sky: null };
  out.root.name = 'bikiniBottom';
  mv.group.add(out.root);

  // the light: down through the water (mapView dims it with the power and blackouts), and the sun overhead
  mv.hemi = new THREE.HemisphereLight(0xd8f4ff, 0x8a7a58, map.ambient ?? 0.8);
  mv.group.add(mv.hemi);
  const sun = new THREE.DirectionalLight(cfg.sun.color, cfg.sun.intensity);
  sun.position.set(...cfg.sun.from);
  mv.group.add(sun, sun.target);
  out.sun = sun;

  const planks = new THREE.MeshLambertMaterial({ color: '#d8b888', map: T.plankTexture(0) });
  for (const g of barricadeSurrounds(mv, planks)) out.root.add(g);

  // the town (in the background: nothing waits on it)
  fetchGlb(map.glbWorld)
    .then((buf) => loader().parseAsync(buf, ''))
    .then((gltf) => {
      const sky = gltf.scene.getObjectByName('sky');
      // (the insides, far off the map, lit from within: the light down through the water doesn't get in)
      const indoors = new Set();
      for (const id of ['house', 'krab']) gltf.scene.getObjectByName(id)?.traverse((o) => indoors.add(o));
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        // (lit the cheap way, like the rest of the game, keeping the model's own textures)
        const m = o.material, mats = Array.isArray(m) ? m : [m];
        const lam = mats.map((s) => {
          const l = lambert(s);
          if (indoors.has(o)) { l.emissive.set('#ffffff'); l.emissiveMap = l.map; l.emissiveIntensity = cfg.insideGlow; if (!l.map) l.emissive.copy(l.color); }
          return l;
        });
        o.material = Array.isArray(m) ? lam : lam[0];
        // (the pieces stand still: their matrices are set once; the compressed
        // model's positions are scaled back to metres by them)
        o.updateMatrix();
        o.matrixAutoUpdate = false;
      });
      out.gate = tollGate(gltf.scene);
      const piece = gltf.scene.getObjectByName('fencePiece');
      if (piece) { gltf.scene.remove(piece); for (const f of edgeFence(mv, piece)) out.root.add(f); }
      if (sky) {
        // the sky: a backdrop round the camera, not a place (no fog, behind everything)
        gltf.scene.remove(sky);
        sky.traverse((o) => {
          if (!o.isMesh) return;
          o.material = new THREE.MeshBasicMaterial({ map: o.material.map, color: '#ffffff', transparent: o.material.transparent, alphaTest: o.material.alphaTest, fog: false, depthWrite: false, side: THREE.DoubleSide });
          o.renderOrder = -10;
          o.frustumCulled = false;
          o.matrixAutoUpdate = false;
          o.updateMatrix();
        });
        sky.scale.setScalar(cfg.skyRadius);
        out.sky = sky;
        mv.group.add(sky);
      }
      gltf.scene.updateMatrixWorld(true);
      out.root.add(gltf.scene);
      out.ready = true;
    })
    .catch((err) => console.warn('bikini bottom model:', err.message || err));
  return out;
}

// The toll gate's arm on a hinge at the post's end (it swings up once the gate's bought).
function tollGate(scene) {
  const arm = scene.getObjectByName('gate');
  if (!arm) return null;
  const pivot = new THREE.Group();
  pivot.position.set(...GATE.hinge);
  arm.parent.add(pivot);
  pivot.add(arm);
  arm.position.set(-GATE.hinge[0], -GATE.hinge[1], -GATE.hinge[2]);
  arm.updateMatrix();
  // (which way it reaches from the hinge: it turns about the level axis across it, tip up)
  const i = GATE.axis === 'x' ? 0 : 1, mid = (GATE.rect[i] + GATE.rect[i + 2]) / 2;
  const dir = Math.sign(mid - GATE.hinge[GATE.axis === 'x' ? 0 : 2]) || 1;
  return { pivot, turn: (a) => { if (GATE.axis === 'x') pivot.rotation.z = dir * a; else pivot.rotation.x = -dir * a; }, t0: 0 };
}

// The town's bamboo fence, copied all round the edge of play (just outside it), except
// where a barricade stands. The piece (tools/bikinibottom/build.mjs) runs along x from its
// middle, feet on y = 0.
function edgeFence(mv, piece) {
  const map = mv.map, E = map.edge || [], cfg = mv.cfg.bikiniBottom;
  piece.updateMatrixWorld(true);
  const parts = [];
  piece.traverse((o) => { if (o.isMesh) parts.push(o); });
  const b = new THREE.Box3().setFromObject(piece), L = b.max.x - b.min.x;
  // (the polygon's winding: which side of each edge is outside)
  let area = 0;
  for (let i = 0; i < E.length; i++) { const [x0, z0] = E[i], [x1, z1] = E[(i + 1) % E.length]; area += x0 * z1 - x1 * z0; }
  const out = area > 0 ? -1 : 1;
  const mats = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < E.length; i++) {
    const [x0, z0] = E[i], [x1, z1] = E[(i + 1) % E.length];
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / L)), dx = (x1 - x0) / len, dz = (z1 - z0) / len;
    const nx = -dz * out, nz = dx * out;
    q.setFromAxisAngle(up, Math.atan2(-dz, dx));
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n, x = x0 + (x1 - x0) * f + nx * cfg.fenceOut, z = z0 + (z1 - z0) * f + nz * cfg.fenceOut;
      if (mv.sim.windows.some((w) => Math.hypot(w.center.x - x, w.center.z - z) < cfg.fenceGap)) continue;
      mats.push(m.clone().compose(new THREE.Vector3(x, map.heightAt(x, z), z), q, new THREE.Vector3(len / n / L, 1, 1)));
    }
  }
  return parts.map((o) => {
    const im = new THREE.InstancedMesh(o.geometry, o.material, mats.length);
    mats.forEach((a, j) => im.setMatrixAt(j, a.clone().multiply(o.matrixWorld)));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.userData.noBake = true;
    return im;
  });
}

// The sky follows the camera (it's the backdrop, not a place); the toll gate lifts once it's bought.
export function updateBikiniBottom(bb, eye) {
  if (bb.sky && eye) bb.sky.position.copy(eye);
  const g = bb.gate;
  if (g && bb.mv.sim.doorOpen('toll_gate')) {
    const now = performance.now() / 1000;
    if (!g.t0) g.t0 = now;
    const t = Math.min(1, (now - g.t0) / bb.mv.cfg.bikiniBottom.gateLift.time);
    g.turn((t * t * (3 - 2 * t)) * bb.mv.cfg.bikiniBottom.gateLift.angle);
  } else if (g && g.t0) { g.t0 = 0; g.turn(0); }
}

// --- Bikini Bottom's crew: SpongeBob, Patrick, Squidward, Sandy -----------------
// (assets/bikinibottom/cast.glb, tools/bikinibottom/cast.mjs: one node each, stood
// on y = 0 facing +z.) A character built on the human rig (src/render/characters.js)
// keeps its joints, so everything that walks, crouches and aims a person still
// works; the person's own parts are hidden and the model rides on the hips.
let castJob = null;
function castModels() {
  if (!castJob) {
    castJob = fetchGlb('assets/bikinibottom/cast.glb')
      .then((buf) => loader().parseAsync(buf, ''))
      .then((gltf) => {
        gltf.scene.traverse((o) => { if (o.isMesh) { o.material = lambert(o.material); o.castShadow = true; } });
        return gltf.scene;
      })
      .catch((err) => { console.warn('bikini bottom cast:', err.message || err); return null; });
  }
  return castJob;
}
// a copy of one piece of the cast file (the zombies' Chum Bucket helmet), or null
export function castPiece(name) {
  return castModels().then((scene) => { const src = scene && scene.getObjectByName(name); return src ? src.clone(true) : null; });
}
export function castOn(k, who) {
  k.root.traverse((o) => { if (o.isMesh) o.visible = false; });
  const hips = k.hips, y = hips.position.y;
  castModels().then((scene) => {
    const src = scene && scene.getObjectByName(who);
    if (!src) return;
    const m = src.clone(true);
    m.position.set(0, -y, 0);
    m.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.userData.noBake = true; } });
    hips.add(m);
    k.model = m;
  });
  return k;
}
