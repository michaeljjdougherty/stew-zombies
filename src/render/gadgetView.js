// =============================================================================
// How the gadgets look (src/sim/gadgets.js), drawn by the projectile views:
//   the Maisy Dog   a little black sausage dog (assets/props/maisydog.glb)
//                   tumbling through the air; on the floor she howls, then a
//                   black hole opens over her: a black core in a swirling
//                   violet ring, everything streaming into it. At the end it
//                   takes her too and snaps shut.
//   the LBD         a sleeping baby (assets/props/lbd.glb) with a red light
//                   blinking on its blanket once it's live; set off, it pops up
//                   spinning and the blast does the rest.
// Plus the little in-hand copies the viewmodel and the Mystery Box show.
// =============================================================================
import * as THREE from 'three';
import { loadModel } from './gltfLite.js';
import { CONFIG } from '../config.js';

const LOOK = () => CONFIG.gadgetLook;

// A model, centred on its footprint with its base at y = 0, `len` long (its
// longest side). A plain stand-in shows until it's in.
function placeModel(group, url, len, stand) {
  group.add(stand);
  loadModel(url).then((g) => {
    if (!g) return;
    const m = g.scene.clone(true);
    const holder = new THREE.Group(); holder.add(m);
    holder.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(holder), s = b.getSize(new THREE.Vector3());
    const k = len / Math.max(s.x, s.y, s.z);
    m.scale.multiplyScalar(k);
    m.position.set(-(b.min.x + b.max.x) / 2 * k, -b.min.y * k, -(b.min.z + b.max.z) / 2 * k);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (o.material && o.material.roughness !== undefined) o.material.roughness = Math.max(0.5, o.material.roughness); } });
    group.add(holder);
    stand.visible = false;
  });
}

export function maisyDog(len = LOOK().maisy.length) {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.CapsuleGeometry(len * 0.16, len * 0.6, 4, 8).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.7 }));
  stand.position.y = len * 0.22;
  placeModel(g, LOOK().maisy.model, len, stand);
  return g;
}

export function lbdBaby(len = LOOK().lbd.length) {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.SphereGeometry(len * 0.35, 10, 8), new THREE.MeshStandardMaterial({ color: '#e8c8b0', roughness: 0.8 }));
  stand.position.y = len * 0.35;
  placeModel(g, LOOK().lbd.model, len, stand);
  return g;
}

// --- the black hole -------------------------------------------------------------
function ringTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S * 2 - 1, v = (y + 0.5) / S * 2 - 1;
    const r = Math.hypot(u, v), a = Math.atan2(v, u);
    // a bright inner edge fading outward, in spiral arms
    const band = r < 0.28 ? 0 : Math.exp(-Math.pow((r - 0.34) / 0.1, 2)) + 0.55 * Math.exp(-Math.pow((r - 0.55) / 0.22, 2));
    const arms = 0.55 + 0.45 * Math.sin(a * 3 + r * 14);
    const k = Math.max(0, Math.min(1, band * arms * (r < 1 ? 1 : 0)));
    const i = (y * S + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = Math.round(k * 255);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let ringTex = null;

export function blackHole(glowTex) {
  const L = LOOK().hole;
  const g = new THREE.Group();
  ringTex = ringTex || ringTexture();
  const col = new THREE.Color(L.color);
  // the core: pure black, with a thin bright rim
  const core = new THREE.Mesh(new THREE.SphereGeometry(L.core, 24, 16), new THREE.MeshBasicMaterial({ color: '#000000' }));
  g.add(core);
  const rimMat = new THREE.SpriteMaterial({ map: glowTex, color: col.clone().multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const rimGlow = new THREE.Sprite(rimMat); rimGlow.scale.setScalar(L.core * 3.6); g.add(rimGlow);
  core.renderOrder = 2;
  // two discs of swirling light, crossed a little, turning
  const disks = [];
  for (let k = 0; k < 2; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L.disk * 2, L.disk * 2), new THREE.MeshBasicMaterial({ map: ringTex, color: (k ? new THREE.Color(L.color2) : col).clone().multiplyScalar(1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.rotation.x = -Math.PI / 2 + (k ? 0.5 : 0.18);
    g.add(m); disks.push(m);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 }));
  halo.scale.setScalar(L.disk * 4.2); g.add(halo);
  g.userData = { core, disks, halo, rimGlow, t: 0 };
  g.scale.setScalar(0.01);
  return g;
}

// One frame of an open hole: size (0..1), turning, things streaming in.
export function updateHole(h, dt, open, effects, time) {
  const L = LOOK().hole, U = h.userData;
  U.t += dt;
  const s = Math.max(0.01, open);
  h.scale.setScalar(s * (1 + Math.sin(time * 9) * 0.03));
  U.disks[0].rotation.z += dt * L.spin; U.disks[1].rotation.z -= dt * L.spin * 0.7;
  U.halo.material.opacity = 0.25 + 0.15 * Math.sin(time * 4);
  U.rimGlow.scale.setScalar(L.core * (3.2 + Math.sin(time * 13) * 0.4));
  if (open < 0.3 || !effects) return;
  // streaks spiralling in from round it
  U.acc = (U.acc || 0) + dt * L.motes;
  const c = h.position;
  while (U.acc > 1) {
    U.acc -= 1;
    const a = Math.random() * Math.PI * 2, r = L.reach * (0.5 + Math.random() * 0.5), y = (Math.random() - 0.4) * 2;
    const p = new THREE.Vector3(c.x + Math.cos(a) * r, c.y + y, c.z + Math.sin(a) * r);
    const toC = c.clone().sub(p), tang = new THREE.Vector3(-toC.z, 0, toC.x).normalize();
    const v = toC.multiplyScalar(1.6).addScaledVector(tang, 3.5);
    const cc = Math.random() < 0.5 ? new THREE.Color(L.color) : new THREE.Color(L.color2);
    effects.spawnParticle(p, v, { life: 0.55, size: 0.025, color: [cc.r * 3, cc.g * 3, cc.b * 3], gravity: 0, drag: 0 });
  }
}
