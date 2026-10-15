// =============================================================================
// A War Hammer (Call of the Crust): a long iron-bound haft, a heavy head bound
// in its element's glow, and the element worked into the iron:
//   fire       ember-red bands, short spikes like flames off the top
//   ice        pale bands, crystal shards growing off the faces
//   wind       pale green bands, swept fins like a weather vane
//   lightning  violet bands, forked prongs off the top
// Shared by the game (first person, the Anvil's sockets, Pit's bench) and the
// trailer. Frame: the haft runs along +Z (the butt at z -0.18, the head at
// z 0.82); `grip` marks where the other hand goes.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';

export const HAMMER_COLORS = { fire: '#ff6a1a', ice: '#8fe4ff', wind: '#d8f0e0', lightning: '#b98aff' };

let shared = null;
function mats() {
  if (shared) return shared;
  shared = {
    iron: new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.45, metalness: 0.85 }),
    darkIron: new THREE.MeshStandardMaterial({ color: '#17171a', roughness: 0.5, metalness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.8 }),
    leather: new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.9 }),
    dot: T.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
  };
  return shared;
}

export function buildWarHammer(el, { halo = true, glow = 2.2, color = null } = {}) {
  const M = mats();
  const col = new THREE.Color(color || HAMMER_COLORS[el] || '#ffffff');
  const glowMat = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(glow), toneMapped: false });
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  // the haft: wood, leather-wrapped at the grip, iron at the butt and the throat
  add(new THREE.CylinderGeometry(0.022, 0.026, 1.0, 10).rotateX(Math.PI / 2), M.wood, 0, 0, 0.32);
  add(new THREE.CylinderGeometry(0.027, 0.027, 0.3, 10).rotateX(Math.PI / 2), M.leather, 0, 0, 0.0);
  for (let i = 0; i < 6; i++) add(new THREE.TorusGeometry(0.027, 0.003, 4, 12), M.darkIron, 0, 0, -0.13 + i * 0.05);
  add(new THREE.CylinderGeometry(0.032, 0.026, 0.06, 10).rotateX(Math.PI / 2), M.iron, 0, 0, -0.19);            // pommel
  add(new THREE.SphereGeometry(0.03, 10, 8), glowMat, 0, 0, -0.225);
  add(new THREE.CylinderGeometry(0.03, 0.024, 0.12, 10).rotateX(Math.PI / 2), M.iron, 0, 0, 0.7);               // throat
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.008, 0.05, 0.2), M.darkIron, s * 0.024, 0, 0.62);        // langets
  // the head
  const head = new THREE.Group(); head.position.z = 0.82; g.add(head);
  add(new THREE.BoxGeometry(0.34, 0.17, 0.17), M.iron, 0, 0, 0, head);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.04, 0.21, 0.21), M.darkIron, s * 0.185, 0, 0, head);    // striking faces
    add(new THREE.BoxGeometry(0.02, 0.175, 0.175), glowMat, s * 0.1, 0, 0, head);       // glowing bands
    add(new THREE.BoxGeometry(0.012, 0.15, 0.15), glowMat, s * 0.207, 0, 0, head);      // the faces' cores
  }
  const core = add(new THREE.OctahedronGeometry(0.05), glowMat, 0, 0.1, 0, head);
  // the element worked into the iron
  if (el === 'fire') {
    for (let i = 0; i < 5; i++) {
      const sp = add(new THREE.ConeGeometry(0.018, 0.08 + (i % 2) * 0.04, 6), glowMat, -0.12 + i * 0.06, 0.12, 0, head);
      sp.rotation.z = (i - 2) * 0.18;
    }
  } else if (el === 'ice') {
    for (const [x, y, z, rz, rx, h] of [[0.06, 0.1, 0.05, 0.4, 0.3, 0.12], [-0.07, 0.11, -0.04, -0.3, -0.2, 0.1], [0.0, -0.1, 0.06, Math.PI - 0.2, 0.3, 0.09], [-0.05, 0.02, 0.1, 0.2, 1.3, 0.08], [0.05, -0.02, -0.1, -0.2, -1.3, 0.08]]) {
      const c = add(new THREE.ConeGeometry(0.022, h, 4), glowMat, x, y, z, head);
      c.rotation.set(rx, 0, rz);
    }
  } else if (el === 'wind') {
    for (const s of [-1, 1]) {
      const fin = add(new THREE.BoxGeometry(0.004, 0.13, 0.09), M.iron, 0, 0.12, s * 0.05, head);
      fin.rotation.x = s * 0.5;
      const edge = add(new THREE.BoxGeometry(0.006, 0.12, 0.012), glowMat, 0, 0.13, s * 0.09, head);
      edge.rotation.x = s * 0.5;
    }
    add(new THREE.TorusGeometry(0.11, 0.006, 6, 24), glowMat, 0, 0, 0, head).rotation.y = Math.PI / 2;
  } else if (el === 'lightning') {
    for (const s of [-1, 0, 1]) {
      const prong = add(new THREE.BoxGeometry(0.012, 0.12, 0.012), s ? M.iron : glowMat, s * 0.07, 0.14, 0, head);
      prong.rotation.z = -s * 0.35;
      add(new THREE.SphereGeometry(0.012, 6, 5), glowMat, s * 0.09, 0.2, 0, head);
    }
  }
  let haloSprite = null;
  if (halo) {
    haloSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.dot, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    haloSprite.scale.setScalar(0.7); head.add(haloSprite);
  }
  const grip = new THREE.Object3D(); grip.position.z = 0.3; g.add(grip);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, head, grip, core, glowMat, halo: haloSprite, color: col };
}
