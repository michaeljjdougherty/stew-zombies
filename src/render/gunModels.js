// =============================================================================
// Procedural gun models. Each builder returns a group (barrel pointing -Z,
// origin at the firing hand) plus the parts that animate and the anchors the
// viewmodel needs (hands, muzzle, sight height, hip/ADS placement).
// Used by the first-person viewmodel and the mystery box.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';

let shared = null;
export function gunMaterials() {
  if (shared) return shared;
  shared = {
    metal: new THREE.MeshStandardMaterial({ map: T.gunMetalTexture('#55575a'), roughness: 0.4, metalness: 0.35 }),
    darkMetal: new THREE.MeshStandardMaterial({ map: T.gunMetalTexture('#35373a'), roughness: 0.5, metalness: 0.3 }),
    black: new THREE.MeshStandardMaterial({ map: T.gunMetalTexture('#232426'), roughness: 0.65, metalness: 0.15 }),
    blued: new THREE.MeshStandardMaterial({ map: T.gunMetalTexture('#3a4250'), roughness: 0.3, metalness: 0.5 }),
    wood: new THREE.MeshStandardMaterial({ map: T.woodTexture({ base: [22, 40, 26], plank: 32 }), roughness: 0.6 }),
    lightWood: new THREE.MeshStandardMaterial({ map: T.woodTexture({ base: [28, 45, 34], plank: 32 }), roughness: 0.55 }),
    bakelite: new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.5 }),
    glove: new THREE.MeshStandardMaterial({ map: T.gloveTexture(), color: '#b0a590', roughness: 0.85 }),
    sleeve: new THREE.MeshStandardMaterial({ map: T.sleeveTexture(), roughness: 0.95 }),
    skin: new THREE.MeshStandardMaterial({ color: '#8c7560', roughness: 0.8 }),
  };
  return shared;
}

function helpers(parent) {
  const box = (w, h, d, mat, x, y, z, p = parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); p.add(m); return m;
  };
  // cylinder along Z
  // peep sight ring facing the eye
  const ring = (r, mat, x, y, z, p = parent) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.45, 6, 14), mat);
    m.position.set(x, y, z); p.add(m); return m;
  };
  const cylZ = (r0, r1, len, mat, x, y, z, p = parent, seg = 10) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg).rotateX(Math.PI / 2), mat);
    m.position.set(x, y, z); p.add(m); return m;
  };
  return { box, cylZ, ring };
}

// ---------------------------------------------------------------------------
function pistol(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  const slide = new THREE.Group(); g.add(slide);
  box(0.03, 0.03, 0.2, m.metal, 0, 0, 0, slide);
  for (let i = 0; i < 6; i++) box(0.031, 0.022, 0.003, m.darkMetal, 0, 0.001, 0.06 + i * 0.007, slide);
  box(0.003, 0.006, 0.008, m.darkMetal, 0, 0.018, -0.092, slide);
  box(0.005, 0.006, 0.006, m.darkMetal, -0.0055, 0.018, 0.09, slide);
  box(0.005, 0.006, 0.006, m.darkMetal, 0.0055, 0.018, 0.09, slide);
  box(0.002, 0.012, 0.04, m.darkMetal, 0.015, 0.004, 0.0, slide);
  box(0.024, 0.004, 0.19, m.metal, 0, 0.016, 0, slide);
  cylZ(0.009, 0.009, 0.01, m.darkMetal, 0, -0.002, -0.102);
  box(0.028, 0.02, 0.16, m.metal, 0, -0.024, -0.015);
  box(0.012, 0.006, 0.02, m.darkMetal, 0, -0.012, 0.105);
  box(0.004, 0.004, 0.05, m.metal, 0, -0.058, 0.0);
  box(0.004, 0.026, 0.004, m.metal, 0, -0.045, -0.024);
  box(0.004, 0.02, 0.004, m.darkMetal, 0, -0.043, 0.004);
  const grip = new THREE.Group(); grip.position.set(0, -0.035, 0.065); grip.rotation.x = -0.22; g.add(grip);
  box(0.027, 0.11, 0.045, m.metal, 0, -0.055, 0, grip);
  box(0.031, 0.085, 0.036, m.wood, 0, -0.055, 0.002, grip);
  const mag = new THREE.Group(); grip.add(mag);
  box(0.02, 0.11, 0.033, m.darkMetal, 0, -0.06, 0.002, mag);
  box(0.024, 0.008, 0.038, m.darkMetal, 0, -0.114, 0.002, mag);
  return {
    group: g, parts: { slide, mag }, muzzleAt: [0, 0, -0.12],
    right: { pos: [0.004, -0.07, 0.07], rot: [-0.22, 0, 0], kind: 'grip' },
    left: { pos: [-0.022, -0.085, 0.06], rot: [-0.2, 0.3, 0.5], kind: 'cup' },
    hip: { x: 0.11, y: -0.074, z: -0.33, ry: 0.07, rz: -0.2, rx: 0.03 },
    aim: { y: -0.0225, z: -0.33 },
    slideTravel: 0.03,
  };
}

function revolver(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  box(0.026, 0.034, 0.07, m.blued, 0, -0.01, 0.01);          // frame
  cylZ(0.01, 0.01, 0.17, m.blued, 0, 0.004, -0.11);          // barrel
  box(0.008, 0.01, 0.17, m.blued, 0, 0.016, -0.11);          // vent rib
  box(0.02, 0.012, 0.13, m.blued, 0, -0.012, -0.1);          // ejector shroud
  box(0.003, 0.01, 0.02, m.darkMetal, 0, 0.024, -0.18);      // front ramp
  box(0.01, 0.006, 0.01, m.darkMetal, 0, 0.022, 0.04);       // rear notch
  box(0.008, 0.016, 0.018, m.darkMetal, 0, 0.012, 0.055);    // hammer
  const cyl = new THREE.Group(); cyl.position.set(0, -0.006, 0.0); g.add(cyl);
  cylZ(0.021, 0.021, 0.045, m.blued, 0, 0, 0, cyl, 12);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    box(0.004, 0.004, 0.046, m.darkMetal, Math.cos(a) * 0.02, Math.sin(a) * 0.02, 0, cyl);
  }
  box(0.004, 0.004, 0.04, m.metal, 0, -0.035, 0.015);        // trigger guard
  box(0.004, 0.018, 0.004, m.darkMetal, 0, -0.03, 0.02);
  const grip = new THREE.Group(); grip.position.set(0, -0.03, 0.055); grip.rotation.x = -0.35; g.add(grip);
  box(0.03, 0.1, 0.04, m.wood, 0, -0.05, 0, grip);
  return {
    group: g, parts: { cylinder: cyl }, muzzleAt: [0, 0.004, -0.2],
    right: { pos: [0.004, -0.065, 0.065], rot: [-0.35, 0, 0], kind: 'grip' },
    left: { pos: [-0.022, -0.08, 0.055], rot: [-0.2, 0.3, 0.5], kind: 'cup' },
    hip: { x: 0.11, y: -0.07, z: -0.34, ry: 0.07, rz: -0.18, rx: 0.03 },
    aim: { y: -0.025, z: -0.34 },
  };
}

function rifle(m) {
  const g = new THREE.Group();
  const { box, cylZ, ring } = helpers(g);
  // wooden stock: butt, wrist, handguard
  const butt = box(0.042, 0.1, 0.3, m.wood, 0, -0.045, 0.3);
  butt.rotation.x = 0.1;
  box(0.036, 0.06, 0.1, m.wood, 0, -0.035, 0.1);
  box(0.03, 0.06, 0.04, m.wood, 0, -0.07, 0.085).rotation.x = -0.4; // grip swell
  box(0.044, 0.05, 0.4, m.wood, 0, -0.012, -0.28);
  box(0.03, 0.015, 0.3, m.lightWood, 0, 0.018, -0.3);         // upper handguard
  // metal receiver & barrel
  const bolt = new THREE.Group(); g.add(bolt);
  box(0.034, 0.03, 0.17, m.metal, 0, 0.012, -0.02);
  box(0.012, 0.012, 0.05, m.darkMetal, 0.02, 0.014, -0.03, bolt); // op handle
  cylZ(0.011, 0.01, 0.2, m.metal, 0, 0.012, -0.57);
  cylZ(0.014, 0.014, 0.05, m.darkMetal, 0, 0.01, -0.66);       // flash hider
  box(0.004, 0.024, 0.006, m.darkMetal, 0, 0.032, -0.64);      // front post
  box(0.016, 0.012, 0.012, m.darkMetal, 0, 0.03, 0.05);         // rear sight base
  ring(0.0065, m.darkMetal, 0, 0.044, 0.05);                    // rear aperture
  box(0.004, 0.004, 0.04, m.metal, 0, -0.055, 0.03);           // trigger guard
  const mag = new THREE.Group(); g.add(mag);
  box(0.03, 0.085, 0.06, m.darkMetal, 0, -0.06, -0.075, mag);
  return {
    group: g, parts: { bolt, mag }, muzzleAt: [0, 0.01, -0.7],
    right: { pos: [0.004, -0.07, 0.09], rot: [-0.45, 0, 0], kind: 'grip' },
    left: { pos: [-0.01, -0.05, -0.3], rot: [0.1, 0.2, 1.2], kind: 'under' },
    hip: { x: 0.12, y: -0.105, z: -0.27, ry: 0.05, rz: -0.08, rx: 0.02 },
    aim: { y: -0.044, z: -0.28 },
    boltTravel: 0.035,
  };
}

function doubleBarrel(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  box(0.042, 0.1, 0.32, m.wood, 0, -0.05, 0.28).rotation.x = 0.12;
  box(0.036, 0.055, 0.1, m.wood, 0, -0.03, 0.08);
  box(0.044, 0.04, 0.09, m.metal, 0, -0.005, -0.02);            // action
  box(0.004, 0.004, 0.04, m.metal, 0, -0.05, 0.02);
  const barrels = new THREE.Group(); barrels.position.set(0, 0.0, -0.06); g.add(barrels);
  for (const s of [-1, 1]) cylZ(0.0125, 0.0125, 0.62, m.blued, s * 0.0128, 0.004, -0.31, barrels);
  box(0.006, 0.004, 0.6, m.darkMetal, 0, 0.018, -0.31, barrels);  // rib
  box(0.004, 0.005, 0.004, m.metal, 0, 0.022, -0.6, barrels);     // bead
  box(0.036, 0.03, 0.26, m.wood, 0, -0.018, -0.2, barrels);       // forend
  return {
    group: g, parts: { barrels }, muzzleAt: [0, 0.004, -0.69],
    right: { pos: [0.004, -0.06, 0.085], rot: [-0.4, 0, 0], kind: 'grip' },
    left: { pos: [-0.008, -0.045, -0.25], rot: [0.1, 0.2, 1.2], kind: 'under' },
    hip: { x: 0.13, y: -0.11, z: -0.28, ry: 0.05, rz: -0.06, rx: 0.02 },
    aim: { y: -0.024, z: -0.3 },
  };
}

function smg(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  cylZ(0.019, 0.019, 0.3, m.darkMetal, 0, 0.0, -0.05);          // receiver tube
  cylZ(0.009, 0.009, 0.14, m.metal, 0, -0.004, -0.26);         // barrel
  box(0.01, 0.02, 0.02, m.darkMetal, 0, -0.02, -0.28);          // rest lug
  box(0.006, 0.02, 0.012, m.darkMetal, 0, 0.022, -0.3);         // front hood
  box(0.005, 0.016, 0.01, m.darkMetal, -0.0055, 0.022, 0.07);   // rear sight notch
  box(0.005, 0.016, 0.01, m.darkMetal, 0.0055, 0.022, 0.07);
  box(0.028, 0.03, 0.14, m.black, 0, -0.025, -0.02);            // lower frame
  const grip = new THREE.Group(); grip.position.set(0, -0.04, 0.05); grip.rotation.x = -0.3; g.add(grip);
  box(0.026, 0.09, 0.034, m.bakelite, 0, -0.045, 0, grip);
  box(0.004, 0.004, 0.035, m.metal, 0, -0.05, 0.005);
  // folding stock rods
  box(0.006, 0.006, 0.26, m.metal, 0.012, -0.03, 0.22);
  box(0.006, 0.006, 0.26, m.metal, -0.012, -0.03, 0.22);
  box(0.03, 0.06, 0.012, m.metal, 0, -0.045, 0.35);
  const bolt = new THREE.Group(); g.add(bolt);
  box(0.008, 0.012, 0.012, m.metal, -0.022, 0.004, 0.03, bolt);  // cocking knob
  const mag = new THREE.Group(); g.add(mag);
  box(0.024, 0.07, 0.03, m.black, 0, -0.06, -0.1, mag);          // mag well
  box(0.022, 0.19, 0.028, m.darkMetal, 0, -0.16, -0.1, mag);
  return {
    group: g, parts: { bolt, mag }, muzzleAt: [0, -0.004, -0.34],
    right: { pos: [0.004, -0.075, 0.06], rot: [-0.3, 0, 0], kind: 'grip' },
    left: { pos: [-0.012, -0.075, -0.1], rot: [0, 0.2, 1.3], kind: 'under' },
    hip: { x: 0.12, y: -0.1, z: -0.3, ry: 0.05, rz: -0.08, rx: 0.02 },
    aim: { y: -0.03, z: -0.3 },
    boltTravel: 0.04,
  };
}

function carbine(m) {
  const g = new THREE.Group();
  const { box, cylZ, ring } = helpers(g);
  box(0.03, 0.04, 0.22, m.black, 0, 0.008, -0.02);               // upper
  box(0.028, 0.035, 0.15, m.black, 0, -0.025, -0.01);            // lower
  cylZ(0.023, 0.021, 0.24, m.black, 0, 0.006, -0.25);            // handguard
  for (let i = 0; i < 6; i++) box(0.047, 0.006, 0.012, m.darkMetal, 0, 0.012, -0.16 - i * 0.034);
  cylZ(0.008, 0.008, 0.12, m.metal, 0, 0.006, -0.42);            // barrel
  cylZ(0.012, 0.012, 0.045, m.darkMetal, 0, 0.006, -0.49);       // hider
  box(0.006, 0.042, 0.01, m.black, 0, 0.04, -0.36);              // front sight post
  box(0.02, 0.03, 0.14, m.black, 0, 0.042, -0.01);               // carry handle
  ring(0.006, m.darkMetal, 0, 0.061, 0.05);                      // rear aperture
  cylZ(0.013, 0.013, 0.2, m.black, 0, -0.005, 0.2);              // buffer tube
  box(0.034, 0.09, 0.05, m.black, 0, -0.03, 0.3);                // stock
  const grip = new THREE.Group(); grip.position.set(0, -0.04, 0.07); grip.rotation.x = -0.3; g.add(grip);
  box(0.024, 0.08, 0.034, m.black, 0, -0.04, 0, grip);
  box(0.004, 0.004, 0.04, m.black, 0, -0.05, 0.03);
  const bolt = new THREE.Group(); g.add(bolt);
  box(0.024, 0.008, 0.02, m.darkMetal, 0, 0.03, 0.09, bolt);    // charging handle
  const mag = new THREE.Group(); g.add(mag);
  const m1 = box(0.022, 0.1, 0.05, m.darkMetal, 0, -0.08, -0.065, mag); m1.rotation.x = 0.12;
  const m2 = box(0.022, 0.06, 0.048, m.darkMetal, 0, -0.15, -0.075, mag); m2.rotation.x = 0.3;
  return {
    group: g, parts: { bolt, mag }, muzzleAt: [0, 0.006, -0.52],
    right: { pos: [0.004, -0.07, 0.08], rot: [-0.3, 0, 0], kind: 'grip' },
    left: { pos: [-0.012, -0.025, -0.23], rot: [0.1, 0.2, 1.3], kind: 'under' },
    hip: { x: 0.12, y: -0.11, z: -0.28, ry: 0.05, rz: -0.08, rx: 0.02 },
    aim: { y: -0.061, z: -0.27 },
    boltTravel: 0.03,
  };
}

const BUILDERS = { pistol, revolver, rifle, doubleBarrel, smg, carbine };

// Build a gun. withHands: add first-person hands and sleeves.
export function buildGun(model, { withHands = false } = {}) {
  const m = gunMaterials();
  const spec = (BUILDERS[model] || pistol)(m);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(...spec.muzzleAt);
  spec.group.add(muzzle);
  spec.muzzle = muzzle;
  for (const k of Object.keys(spec.parts)) spec.parts[k].userData.home = spec.parts[k].position.clone();
  if (withHands) addHands(spec, m);
  return spec;
}

function arm(m, from, dir, len = 0.42) {
  const geo = new THREE.CylinderGeometry(0.03, 0.037, len, 10);
  const mesh = new THREE.Mesh(geo, m.sleeve);
  const d = new THREE.Vector3(...dir).normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  mesh.position.set(from[0] + d.x * len / 2, from[1] + d.y * len / 2, from[2] + d.z * len / 2);
  return mesh;
}

function addHands(spec, m) {
  const g = spec.group;
  // right hand wrapped round the grip
  const rh = new THREE.Group();
  rh.position.set(...spec.right.pos); rh.rotation.set(...spec.right.rot);
  g.add(rh);
  const b = (w, h, d, mat, x, y, z, p) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); q.position.set(x, y, z); p.add(q); return q; };
  b(0.045, 0.07, 0.06, m.glove, 0.008, 0, 0.01, rh);
  for (let i = 0; i < 3; i++) b(0.05, 0.018, 0.022, m.glove, -0.002, 0.012 - i * 0.022, -0.03, rh);
  b(0.018, 0.018, 0.05, m.glove, -0.02, 0.03, -0.01, rh);
  rh.add(arm(m, [0.02, -0.02, 0.03], [0.25, -0.55, 1]));
  // left hand
  const lh = new THREE.Group();
  lh.position.set(...spec.left.pos); lh.rotation.set(...spec.left.rot);
  g.add(lh);
  b(0.045, 0.06, 0.06, m.glove, 0, 0, 0, lh);
  for (let i = 0; i < 3; i++) b(0.022, 0.018, 0.05, m.glove, 0.03, 0.01 - i * 0.021, -0.005, lh);
  if (spec.left.kind === 'under') lh.add(arm(m, [-0.01, -0.03, 0.01], [-0.9, -0.2, 0.9]));
  else lh.add(arm(m, [-0.03, -0.04, 0.03], [-0.55, -0.6, 1]));
  spec.leftHand = lh;
  spec.leftHome = lh.position.clone();
}
