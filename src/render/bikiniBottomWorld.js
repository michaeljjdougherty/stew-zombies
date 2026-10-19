// =============================================================================
// Bikini Bottom (Map 3): the town itself. The model (assets/bikinibottom/town.glb,
// tools/bikinibottom/build.mjs) keeps its own textures, so it looks like the
// game it came from; here it gets the light down through the water, the
// blue-green sea fog, and its flowery sky hung round the camera.
// Also the barricades' plank surrounds (the frames and planks are mapView's).
// =============================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as T from './textures.js';
import { fetchGlb } from './gltfLite.js';

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
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  fetchGlb(map.glbWorld)
    .then((buf) => loader.parseAsync(buf, ''))
    .then((gltf) => {
      const sky = gltf.scene.getObjectByName('sky');
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        // (lit the cheap way, like the rest of the game, keeping the model's own textures)
        const m = o.material, mats = Array.isArray(m) ? m : [m];
        const lam = mats.map((s) => {
          const l = new THREE.MeshLambertMaterial({ map: s.map, color: s.color, transparent: s.transparent, alphaTest: s.alphaTest, opacity: s.opacity, side: s.side, vertexColors: s.vertexColors, name: s.name });
          if (l.map) l.map.colorSpace = THREE.SRGBColorSpace;
          return l;
        });
        o.material = Array.isArray(m) ? lam : lam[0];
        // (the pieces stand still: their matrices are set once; the compressed
        // model's positions are scaled back to metres by them)
        o.updateMatrix();
        o.matrixAutoUpdate = false;
      });
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

// The sky follows the camera (it's the backdrop, not a place).
export function updateBikiniBottom(bb, eye) {
  if (bb.sky && eye) bb.sky.position.copy(eye);
}
