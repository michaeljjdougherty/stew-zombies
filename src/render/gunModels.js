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


// ===========================================================================
// Phase 3 models
// ===========================================================================
function scope(g, m, y, z, len = 0.2, r = 0.019) {
  const { box, cylZ } = helpers(g);
  cylZ(r, r, len, m.black, 0, y, z);
  cylZ(r * 1.35, r * 1.2, 0.05, m.black, 0, y, z - len / 2);      // objective bell
  cylZ(r * 1.15, r * 1.3, 0.04, m.black, 0, y, z + len / 2);      // eyepiece
  cylZ(r * 1.1, r * 1.1, 0.002, new THREE.MeshBasicMaterial({ color: '#203040' }), 0, y, z - len / 2 - 0.026);
  box(0.016, 0.02, 0.02, m.black, 0, y - r - 0.008, z - len * 0.25);  // rings
  box(0.016, 0.02, 0.02, m.black, 0, y - r - 0.008, z + len * 0.25);
}

function grip(g, box, mat, z, y = -0.04, tilt = -0.3, h = 0.085) {
  const gr = new THREE.Group(); gr.position.set(0, y, z); gr.rotation.x = tilt; g.add(gr);
  box(0.026, h, 0.034, mat, 0, -h / 2, 0, gr);
  return gr;
}

// A tinted copy of the starting pistol.
function cz76(m) {
  const s = pistol(m);
  s.group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material === m.metal) o.material = m.blued;
    else if (o.material === m.wood) o.material = m.bakelite;
  });
  return s;
}

function pump(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  box(0.042, 0.1, 0.3, m.wood, 0, -0.05, 0.28).rotation.x = 0.12;    // stock
  box(0.036, 0.055, 0.1, m.wood, 0, -0.03, 0.08);                     // wrist
  box(0.042, 0.05, 0.17, m.blued, 0, 0.0, -0.03);                     // receiver
  box(0.03, 0.012, 0.04, m.darkMetal, 0.021, 0.006, -0.01);          // loading port
  cylZ(0.012, 0.012, 0.5, m.blued, 0, 0.012, -0.36);                  // barrel
  cylZ(0.011, 0.011, 0.44, m.darkMetal, 0, -0.014, -0.33);           // tube mag
  box(0.004, 0.006, 0.004, m.metal, 0, 0.028, -0.6);                  // bead
  box(0.004, 0.004, 0.04, m.metal, 0, -0.045, 0.03);
  const pumpG = new THREE.Group(); g.add(pumpG);
  const fore = box(0.046, 0.042, 0.16, m.wood, 0, -0.016, -0.3, pumpG);
  for (let i = 0; i < 6; i++) box(0.047, 0.003, 0.004, m.darkMetal, 0, -0.016, -0.37 + i * 0.026, pumpG);
  void fore;
  return {
    group: g, parts: { pump: pumpG }, muzzleAt: [0, 0.012, -0.62],
    right: { pos: [0.004, -0.06, 0.085], rot: [-0.4, 0, 0], kind: 'grip' },
    left: { pos: [-0.008, -0.045, -0.3], rot: [0.1, 0.2, 1.2], kind: 'under' }, leftFollows: 'pump',
    hip: { x: 0.13, y: -0.11, z: -0.28, ry: 0.05, rz: -0.06, rx: 0.02 },
    aim: { y: -0.03, z: -0.3 },
    pumpTravel: 0.08,
  };
}

function spaz(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  box(0.044, 0.06, 0.22, m.black, 0, -0.005, -0.02);                 // receiver
  cylZ(0.013, 0.013, 0.42, m.darkMetal, 0, 0.014, -0.34);            // barrel
  box(0.034, 0.03, 0.34, m.black, 0, 0.02, -0.32);                   // heat shield
  for (let i = 0; i < 7; i++) box(0.036, 0.008, 0.012, m.darkMetal, 0, 0.03, -0.46 + i * 0.045);
  cylZ(0.012, 0.012, 0.36, m.black, 0, -0.016, -0.32);               // tube
  const pumpG = new THREE.Group(); g.add(pumpG);
  box(0.05, 0.045, 0.15, m.black, 0, -0.018, -0.28, pumpG);
  grip(g, box, m.black, 0.06);
  box(0.008, 0.008, 0.26, m.metal, 0, 0.034, 0.18);                  // folding stock arm on top
  box(0.03, 0.07, 0.01, m.metal, 0, 0.0, 0.31);
  box(0.004, 0.012, 0.006, m.metal, 0, 0.042, -0.47);                // front post
  box(0.012, 0.01, 0.01, m.metal, 0, 0.036, 0.05);
  return {
    group: g, parts: { pump: pumpG }, muzzleAt: [0, 0.014, -0.56],
    right: { pos: [0.004, -0.075, 0.065], rot: [-0.3, 0, 0], kind: 'grip' },
    left: { pos: [-0.01, -0.05, -0.28], rot: [0.1, 0.2, 1.2], kind: 'under' }, leftFollows: 'pump',
    hip: { x: 0.13, y: -0.11, z: -0.29, ry: 0.05, rz: -0.06, rx: 0.02 },
    aim: { y: -0.044, z: -0.3 },
  };
}

function hs11(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  box(0.045, 0.075, 0.32, m.black, 0, 0.0, 0.02);                    // bullpup body
  cylZ(0.014, 0.014, 0.16, m.darkMetal, 0, 0.018, -0.22);
  box(0.03, 0.03, 0.12, m.black, 0, -0.012, -0.18);
  grip(g, box, m.black, -0.06, -0.035, -0.25);
  const mag = new THREE.Group(); g.add(mag);
  box(0.032, 0.09, 0.06, m.darkMetal, 0, -0.07, 0.08, mag);
  box(0.006, 0.014, 0.006, m.metal, 0, 0.046, -0.12);
  return {
    group: g, parts: { mag }, muzzleAt: [0, 0.018, -0.31],
    right: { pos: [0.004, -0.07, -0.05], rot: [-0.25, 0, 0], kind: 'grip' },
    left: { pos: [-0.01, -0.03, -0.18], rot: [0.1, 0.2, 1.2], kind: 'under' },
    hip: { x: 0.14, y: -0.1, z: -0.36, ry: 0.06, rz: -0.08, rx: 0.02 },
    aim: { y: -0.05, z: -0.3 },
  };
}

function mp6k(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  box(0.034, 0.05, 0.22, m.black, 0, 0.004, -0.02);
  cylZ(0.012, 0.012, 0.05, m.darkMetal, 0, 0.004, -0.15);
  box(0.022, 0.06, 0.03, m.black, 0, -0.045, -0.1);                 // vertical foregrip
  grip(g, box, m.black, 0.06);
  box(0.012, 0.014, 0.012, m.darkMetal, 0, 0.034, 0.07);              // rear drum
  box(0.004, 0.016, 0.008, m.darkMetal, 0, 0.034, -0.12);             // front post
  const bolt = new THREE.Group(); g.add(bolt);
  box(0.01, 0.01, 0.02, m.metal, -0.02, 0.018, -0.07, bolt);
  const mag = new THREE.Group(); g.add(mag);
  const mm = box(0.02, 0.15, 0.03, m.darkMetal, 0, -0.09, -0.03, mag); mm.rotation.x = 0.25;
  return {
    group: g, parts: { bolt, mag }, muzzleAt: [0, 0.004, -0.18],
    right: { pos: [0.004, -0.075, 0.06], rot: [-0.3, 0, 0], kind: 'grip' },
    left: { pos: [-0.01, -0.07, -0.1], rot: [0, 0.2, 1.4], kind: 'under' },
    hip: { x: 0.12, y: -0.1, z: -0.32, ry: 0.06, rz: -0.08, rx: 0.02 },
    aim: { y: -0.04, z: -0.3 },
    boltTravel: 0.03,
  };
}

function mpk(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  box(0.03, 0.045, 0.2, m.darkMetal, 0, 0.0, -0.02);
  cylZ(0.009, 0.009, 0.08, m.metal, 0, 0.004, -0.16);
  grip(g, box, m.bakelite, 0.04);
  box(0.006, 0.006, 0.24, m.metal, 0, 0.03, 0.18);                   // wire stock
  box(0.03, 0.05, 0.008, m.metal, 0, 0.005, 0.3);
  box(0.004, 0.014, 0.008, m.darkMetal, 0, 0.03, -0.11);
  box(0.012, 0.012, 0.01, m.darkMetal, 0, 0.03, 0.05);
  const mag = new THREE.Group(); g.add(mag);
  box(0.018, 0.13, 0.028, m.darkMetal, 0, -0.085, -0.07, mag).rotation.x = 0.35;
  const bolt = new THREE.Group(); g.add(bolt);
  box(0.008, 0.01, 0.016, m.metal, 0.018, 0.012, -0.02, bolt);
  return {
    group: g, parts: { mag, bolt }, muzzleAt: [0, 0.004, -0.2],
    right: { pos: [0.004, -0.07, 0.04], rot: [-0.3, 0, 0], kind: 'grip' },
    left: { pos: [-0.012, -0.07, -0.08], rot: [0, 0.2, 1.3], kind: 'under' },
    hip: { x: 0.12, y: -0.1, z: -0.32, ry: 0.06, rz: -0.08, rx: 0.02 },
    aim: { y: -0.036, z: -0.3 },
    boltTravel: 0.03,
  };
}

function pm64(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  const slide = new THREE.Group(); g.add(slide);
  box(0.03, 0.032, 0.21, m.black, 0, 0, -0.02, slide);
  box(0.03, 0.008, 0.03, m.black, 0, 0.0, -0.135, slide);              // muzzle compensator lip
  box(0.028, 0.022, 0.16, m.darkMetal, 0, -0.026, -0.02);
  cylZ(0.008, 0.008, 0.02, m.darkMetal, 0, 0, -0.14);
  const gr = grip(g, box, m.bakelite, 0.06, -0.035, -0.22, 0.1);
  const mag = new THREE.Group(); gr.add(mag);
  box(0.02, 0.11, 0.03, m.darkMetal, 0, -0.065, 0, mag);
  box(0.02, 0.05, 0.02, m.black, 0, -0.05, -0.1);                    // folding front grip
  box(0.004, 0.01, 0.008, m.darkMetal, 0, 0.02, -0.12, slide);
  box(0.012, 0.01, 0.008, m.darkMetal, 0, 0.02, 0.08, slide);
  return {
    group: g, parts: { slide, mag }, muzzleAt: [0, 0, -0.15],
    right: { pos: [0.004, -0.075, 0.068], rot: [-0.22, 0, 0], kind: 'grip' },
    left: { pos: [-0.014, -0.06, -0.09], rot: [0, 0.2, 1.3], kind: 'under' },
    hip: { x: 0.11, y: -0.08, z: -0.33, ry: 0.07, rz: -0.15, rx: 0.03 },
    aim: { y: -0.025, z: -0.32 },
    slideTravel: 0.025,
  };
}

// Kalashnikov family: AK-75u, Galill, RPKK
function akStyle(m, o) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  const L = o.barrel;
  box(0.036, 0.045, 0.26, m.darkMetal, 0, 0.0, -0.02);                // receiver
  box(0.032, 0.012, 0.24, m.metal, 0, 0.026, -0.02);                  // dust cover
  box(0.04, 0.05, 0.14, o.metalGuard ? m.black : m.lightWood, 0, -0.004, -0.2);   // lower handguard
  box(0.032, 0.025, 0.12, o.metalGuard ? m.black : m.lightWood, 0, 0.032, -0.2);  // gas tube cover
  cylZ(0.0095, 0.0095, L, m.darkMetal, 0, 0.006, -0.27 - L / 2);
  cylZ(0.016, 0.014, 0.05, m.black, 0, 0.006, -0.29 - L);            // muzzle device
  box(0.006, 0.026, 0.01, m.darkMetal, 0, 0.036, -0.27 - L + 0.01);  // front post
  box(0.016, 0.012, 0.03, m.darkMetal, 0, 0.034, -0.1);              // rear sight
  grip(g, box, m.bakelite, 0.07);
  box(0.004, 0.004, 0.04, m.metal, 0, -0.04, 0.04);
  if (o.stock === 'wood') { box(0.04, 0.09, 0.3, m.wood, 0, -0.04, 0.28).rotation.x = 0.08; }
  else { box(0.008, 0.008, 0.26, m.metal, 0.02, -0.01, 0.22); box(0.008, 0.008, 0.26, m.metal, 0.02, -0.06, 0.22); box(0.01, 0.06, 0.012, m.metal, 0.02, -0.035, 0.34); }
  const mag = new THREE.Group(); g.add(mag);
  if (o.drum) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20).rotateZ(Math.PI / 2), m.darkMetal);
    d.position.set(0, -0.1, -0.06); mag.add(d);
  } else {
    const m1 = box(0.022, 0.09, 0.05, o.magMat === 'orange' ? m.bakelite : m.darkMetal, 0, -0.07, -0.07, mag); m1.rotation.x = 0.2;
    const m2 = box(0.022, 0.07, 0.048, o.magMat === 'orange' ? m.bakelite : m.darkMetal, 0, -0.14, -0.1, mag); m2.rotation.x = 0.5;
  }
  if (o.bipod) { box(0.006, 0.006, 0.2, m.metal, 0.012, -0.012, -0.45); box(0.006, 0.006, 0.2, m.metal, -0.012, -0.012, -0.45); }
  const bolt = new THREE.Group(); g.add(bolt);
  box(0.014, 0.01, 0.016, m.metal, 0.024, 0.016, 0.02, bolt);
  return {
    group: g, parts: { mag, bolt }, muzzleAt: [0, 0.006, -0.32 - L],
    right: { pos: [0.004, -0.075, 0.07], rot: [-0.3, 0, 0], kind: 'grip' },
    left: { pos: [-0.012, -0.03, -0.2], rot: [0.1, 0.2, 1.3], kind: 'under' },
    hip: { x: 0.12, y: -0.11, z: -0.28, ry: 0.05, rz: -0.08, rx: 0.02 },
    aim: { y: -0.049, z: -0.3 },
    boltTravel: 0.04,
  };
}
const ak75u = (m) => akStyle(m, { barrel: 0.1, stock: 'fold', magMat: 'orange' });
const galill = (m) => akStyle(m, { barrel: 0.22, stock: 'fold', metalGuard: true });
const rpkk = (m) => akStyle(m, { barrel: 0.36, stock: 'wood', drum: true, bipod: true });

function m17(m) {
  const s = carbine(m);
  const g = s.group;
  const { box, cylZ } = helpers(g);
  // longer barrel and a fixed stock
  cylZ(0.008, 0.008, 0.2, m.metal, 0, 0.006, -0.56);
  cylZ(0.012, 0.012, 0.045, m.darkMetal, 0, 0.006, -0.67);
  box(0.038, 0.1, 0.22, m.black, 0, -0.035, 0.33);
  s.muzzleAt = [0, 0.006, -0.7];
  return s;
}

function spectur(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  box(0.034, 0.055, 0.26, m.black, 0, 0.0, -0.04);
  for (let i = 0; i < 5; i++) box(0.036, 0.01, 0.012, m.darkMetal, 0, 0.014, -0.14 - i * 0.022);
  cylZ(0.009, 0.009, 0.05, m.darkMetal, 0, 0.004, -0.19);
  grip(g, box, m.black, 0.06);
  box(0.008, 0.008, 0.22, m.metal, 0.012, 0.03, 0.17); box(0.008, 0.008, 0.22, m.metal, -0.012, 0.03, 0.17);
  box(0.034, 0.06, 0.01, m.metal, 0, 0.0, 0.28);
  box(0.004, 0.014, 0.008, m.darkMetal, 0, 0.034, -0.15);
  box(0.012, 0.012, 0.01, m.darkMetal, 0, 0.034, 0.05);
  const mag = new THREE.Group(); g.add(mag);
  box(0.026, 0.15, 0.035, m.darkMetal, 0, -0.09, -0.05, mag);
  const bolt = new THREE.Group(); g.add(bolt);
  box(0.01, 0.01, 0.02, m.metal, 0.02, 0.012, -0.08, bolt);
  return {
    group: g, parts: { mag, bolt }, muzzleAt: [0, 0.004, -0.22],
    right: { pos: [0.004, -0.075, 0.06], rot: [-0.3, 0, 0], kind: 'grip' },
    left: { pos: [-0.012, -0.06, -0.12], rot: [0, 0.2, 1.3], kind: 'under' },
    hip: { x: 0.12, y: -0.1, z: -0.31, ry: 0.06, rz: -0.08, rx: 0.02 },
    aim: { y: -0.04, z: -0.3 },
    boltTravel: 0.03,
  };
}

function famos(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  box(0.044, 0.075, 0.46, m.black, 0, -0.01, 0.05);                  // bullpup body
  box(0.012, 0.02, 0.36, m.black, 0, 0.05, 0.0);                     // long carry handle
  box(0.012, 0.035, 0.02, m.black, 0, 0.033, -0.17);
  box(0.012, 0.035, 0.02, m.black, 0, 0.033, 0.17);
  cylZ(0.009, 0.009, 0.12, m.darkMetal, 0, 0.0, -0.24);
  box(0.004, 0.014, 0.008, m.darkMetal, 0, 0.066, -0.15);            // front post in handle
  box(0.012, 0.012, 0.01, m.darkMetal, 0, 0.066, 0.15);
  grip(g, box, m.black, -0.08, -0.04, -0.25);
  box(0.006, 0.04, 0.12, m.black, 0, -0.06, -0.08);                  // trigger guard bar
  const mag = new THREE.Group(); g.add(mag);
  box(0.022, 0.11, 0.05, m.darkMetal, 0, -0.08, 0.1, mag).rotation.x = 0.1;
  const bolt = new THREE.Group(); g.add(bolt);
  box(0.03, 0.008, 0.02, m.metal, 0, 0.06, 0.02, bolt);              // charging lever under handle
  return {
    group: g, parts: { mag, bolt }, muzzleAt: [0, 0.0, -0.31],
    right: { pos: [0.004, -0.075, -0.07], rot: [-0.25, 0, 0], kind: 'grip' },
    left: { pos: [-0.012, -0.03, -0.18], rot: [0.1, 0.2, 1.3], kind: 'under' },
    hip: { x: 0.12, y: -0.1, z: -0.36, ry: 0.05, rz: -0.08, rx: 0.02 },
    aim: { y: -0.066, z: -0.33 },
    boltTravel: 0.02,
  };
}

function awg(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  const green = new THREE.MeshStandardMaterial({ color: '#3b4a33', roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.03, 0.44, 12).rotateX(Math.PI / 2), green);
  body.scale.set(1, 1.35, 1); body.position.set(0, -0.012, 0.06); g.add(body);
  cylZ(0.009, 0.009, 0.2, m.darkMetal, 0, -0.006, -0.25);
  box(0.022, 0.06, 0.03, green, 0, -0.06, -0.1);                      // vertical foregrip
  grip(g, box, green, -0.01, -0.04, -0.2);
  scope(g, m, 0.05, -0.04, 0.22, 0.017);
  const mag = new THREE.Group(); g.add(mag);
  box(0.022, 0.1, 0.05, new THREE.MeshStandardMaterial({ color: '#2a2e2a', roughness: 0.3, transparent: true, opacity: 0.85 }), 0, -0.08, 0.14, mag);
  return {
    group: g, parts: { mag }, muzzleAt: [0, -0.006, -0.36], scoped: true,
    right: { pos: [0.004, -0.075, 0.0], rot: [-0.2, 0, 0], kind: 'grip' },
    left: { pos: [-0.012, -0.075, -0.1], rot: [0, 0.2, 1.4], kind: 'under' },
    hip: { x: 0.12, y: -0.1, z: -0.34, ry: 0.05, rz: -0.08, rx: 0.02 },
    aim: { y: -0.05, z: -0.2 },
  };
}

function g12(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  const shell = new THREE.MeshStandardMaterial({ color: '#2b2d2b', roughness: 0.55 });
  box(0.05, 0.1, 0.62, shell, 0, -0.01, 0.02);
  box(0.054, 0.02, 0.5, shell, 0, 0.045, 0.02);
  cylZ(0.014, 0.014, 0.14, shell, 0, 0.068, -0.02);                   // integral optic
  cylZ(0.012, 0.012, 0.002, new THREE.MeshBasicMaterial({ color: '#3a2010' }), 0, 0.068, -0.091);
  cylZ(0.008, 0.008, 0.04, m.darkMetal, 0, -0.01, -0.31);
  const gr = new THREE.Group(); gr.position.set(0, -0.06, -0.04); gr.rotation.x = -0.2; g.add(gr);
  box(0.026, 0.08, 0.034, shell, 0, -0.04, 0, gr);
  const mag = new THREE.Group(); g.add(mag);
  box(0.02, 0.012, 0.3, m.darkMetal, 0, 0.035, -0.05, mag);          // top-loaded mag
  return {
    group: g, parts: { mag }, muzzleAt: [0, -0.01, -0.33],
    right: { pos: [0.004, -0.085, -0.04], rot: [-0.2, 0, 0], kind: 'grip' },
    left: { pos: [-0.012, -0.04, -0.2], rot: [0.1, 0.2, 1.3], kind: 'under' },
    hip: { x: 0.12, y: -0.1, z: -0.34, ry: 0.05, rz: -0.08, rx: 0.02 },
    aim: { y: -0.068, z: -0.26 },
  };
}

function hk22(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  box(0.04, 0.06, 0.32, m.black, 0, 0.0, -0.02);
  const cover = new THREE.Group(); cover.position.set(0, 0.03, 0.12); g.add(cover);
  box(0.04, 0.012, 0.22, m.darkMetal, 0, 0.006, -0.11, cover);       // feed cover (hinged at rear)
  box(0.042, 0.05, 0.22, m.black, 0, 0.0, -0.3);                       // perforated handguard
  for (let i = 0; i < 6; i++) box(0.044, 0.012, 0.012, m.darkMetal, 0, 0.012, -0.22 - i * 0.03);
  cylZ(0.011, 0.011, 0.32, m.darkMetal, 0, 0.008, -0.56);
  cylZ(0.016, 0.016, 0.05, m.black, 0, 0.008, -0.74);
  box(0.006, 0.006, 0.24, m.metal, 0.014, -0.02, -0.5); box(0.006, 0.006, 0.24, m.metal, -0.014, -0.02, -0.5);
  box(0.006, 0.028, 0.01, m.darkMetal, 0, 0.04, -0.68);
  box(0.016, 0.014, 0.02, m.darkMetal, 0, 0.042, 0.1);
  grip(g, box, m.black, 0.12);
  box(0.04, 0.1, 0.25, m.black, 0, -0.04, 0.3).rotation.x = 0.06;
  const mag = new THREE.Group(); g.add(mag);
  box(0.06, 0.09, 0.12, new THREE.MeshStandardMaterial({ color: '#3d4430', roughness: 0.9 }), -0.05, -0.06, -0.02, mag);  // belt box
  for (let i = 0; i < 6; i++) box(0.012, 0.022, 0.006, m.metal, -0.024, -0.005, -0.06 + i * 0.012, mag);
  const bolt = new THREE.Group(); g.add(bolt);
  box(0.012, 0.012, 0.02, m.metal, -0.024, 0.02, -0.18, bolt);
  return {
    group: g, parts: { mag, bolt, cover }, muzzleAt: [0, 0.008, -0.77],
    right: { pos: [0.004, -0.075, 0.12], rot: [-0.3, 0, 0], kind: 'grip' },
    left: { pos: [-0.012, -0.03, -0.3], rot: [0.1, 0.2, 1.3], kind: 'under' },
    hip: { x: 0.13, y: -0.12, z: -0.27, ry: 0.05, rz: -0.08, rx: 0.02 },
    aim: { y: -0.049, z: -0.32 },
    boltTravel: 0.03,
  };
}

function dragunoff(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  box(0.034, 0.045, 0.24, m.darkMetal, 0, 0.0, -0.02);
  box(0.042, 0.05, 0.2, m.wood, 0, 0.0, -0.22);                       // handguard
  cylZ(0.009, 0.009, 0.48, m.darkMetal, 0, 0.006, -0.56);
  cylZ(0.013, 0.012, 0.06, m.black, 0, 0.006, -0.82);
  // skeleton thumbhole stock
  box(0.032, 0.02, 0.3, m.wood, 0, 0.0, 0.25);
  box(0.034, 0.1, 0.06, m.wood, 0, -0.04, 0.37);
  box(0.03, 0.02, 0.24, m.wood, 0, -0.08, 0.26).rotation.x = -0.2;
  box(0.03, 0.08, 0.03, m.wood, 0, -0.04, 0.12).rotation.x = -0.3;
  scope(g, m, 0.062, -0.02, 0.2);
  const mag = new THREE.Group(); g.add(mag);
  box(0.022, 0.08, 0.06, m.darkMetal, 0, -0.06, -0.06, mag).rotation.x = 0.15;
  const bolt = new THREE.Group(); g.add(bolt);
  box(0.012, 0.012, 0.02, m.metal, 0.022, 0.012, 0.04, bolt);
  return {
    group: g, parts: { mag, bolt }, muzzleAt: [0, 0.006, -0.86], scoped: true,
    right: { pos: [0.004, -0.06, 0.12], rot: [-0.3, 0, 0], kind: 'grip' },
    left: { pos: [-0.012, -0.03, -0.22], rot: [0.1, 0.2, 1.3], kind: 'under' },
    hip: { x: 0.13, y: -0.12, z: -0.27, ry: 0.05, rz: -0.08, rx: 0.02 },
    aim: { y: -0.062, z: -0.18 },
    boltTravel: 0.03,
  };
}

function l97(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  const green = new THREE.MeshStandardMaterial({ color: '#4a5a3a', roughness: 0.7 });
  box(0.05, 0.06, 0.56, green, 0, -0.02, -0.1);                        // chassis
  box(0.05, 0.12, 0.12, green, 0, -0.04, 0.3);                         // butt
  box(0.046, 0.03, 0.2, green, 0, -0.07, 0.18);
  box(0.03, 0.08, 0.035, green, 0, -0.07, 0.09).rotation.x = -0.3;     // thumbhole grip
  cylZ(0.012, 0.011, 0.5, m.darkMetal, 0, 0.012, -0.6);
  cylZ(0.016, 0.016, 0.06, m.black, 0, 0.012, -0.87);
  box(0.034, 0.03, 0.18, m.darkMetal, 0, 0.012, 0.02);                // receiver
  scope(g, m, 0.068, -0.0, 0.24, 0.022);
  const bolt = new THREE.Group(); g.add(bolt);
  box(0.008, 0.008, 0.04, m.metal, 0.03, 0.014, 0.08, bolt);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), m.metal); knob.position.set(0.05, 0.0, 0.08); bolt.add(knob);
  const mag = new THREE.Group(); g.add(mag);
  box(0.024, 0.05, 0.08, m.darkMetal, 0, -0.06, -0.02, mag);
  return {
    group: g, parts: { bolt, mag }, muzzleAt: [0, 0.012, -0.91], scoped: true,
    right: { pos: [0.004, -0.075, 0.1], rot: [-0.3, 0, 0], kind: 'grip' },
    left: { pos: [-0.012, -0.04, -0.3], rot: [0.1, 0.2, 1.3], kind: 'under' },
    hip: { x: 0.13, y: -0.12, z: -0.27, ry: 0.05, rz: -0.08, rx: 0.02 },
    aim: { y: -0.068, z: -0.18 },
    boltTravel: 0.06,
  };
}

function chinapond(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  cylZ(0.024, 0.024, 0.46, m.darkMetal, 0, 0.012, -0.3);               // big bore
  cylZ(0.026, 0.026, 0.02, m.black, 0, 0.012, -0.54);
  cylZ(0.016, 0.016, 0.38, m.darkMetal, 0, -0.03, -0.27);              // tube mag
  box(0.05, 0.06, 0.16, m.darkMetal, 0, -0.005, 0.0);
  const pumpG = new THREE.Group(); g.add(pumpG);
  box(0.05, 0.04, 0.14, m.wood, 0, -0.036, -0.28, pumpG);
  box(0.004, 0.06, 0.03, m.metal, 0.02, 0.06, -0.02);                 // ladder sight
  for (let i = 0; i < 4; i++) box(0.012, 0.002, 0.002, m.metal, 0.02, 0.04 + i * 0.012, -0.02);
  box(0.006, 0.01, 0.008, m.metal, 0, 0.042, -0.5);
  box(0.036, 0.055, 0.1, m.wood, 0, -0.03, 0.12);
  box(0.042, 0.1, 0.28, m.wood, 0, -0.05, 0.3).rotation.x = 0.12;
  return {
    group: g, parts: { pump: pumpG }, muzzleAt: [0, 0.012, -0.56],
    right: { pos: [0.004, -0.06, 0.12], rot: [-0.4, 0, 0], kind: 'grip' },
    left: { pos: [-0.01, -0.06, -0.28], rot: [0.1, 0.2, 1.2], kind: 'under' }, leftFollows: 'pump',
    hip: { x: 0.13, y: -0.12, z: -0.29, ry: 0.05, rz: -0.06, rx: 0.02 },
    aim: { y: -0.048, z: -0.3 },
    pumpTravel: 0.09,
  };
}

function krossbow(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  box(0.04, 0.05, 0.6, m.wood, 0, -0.01, -0.04);                       // stock/tiller
  box(0.012, 0.01, 0.5, m.darkMetal, 0, 0.02, -0.12);                 // rail
  box(0.042, 0.1, 0.18, m.wood, 0, -0.05, 0.26);
  grip(g, box, m.wood, 0.08);
  // prod (limbs) angled back from the front
  for (const s of [-1, 1]) {
    const limb = box(0.32, 0.016, 0.03, m.darkMetal, s * 0.16, 0.012, -0.36);
    limb.rotation.y = s * 0.28;
  }
  // string from limb tips to the nut
  const stringMat = new THREE.MeshBasicMaterial({ color: '#c8c2b0' });
  for (const s of [-1, 1]) {
    const len = Math.hypot(0.3, 0.16);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.002, len), stringMat);
    st.position.set(s * 0.15, 0.022, -0.2); st.rotation.y = s * Math.atan2(0.3, 0.16) * -1 + s * Math.PI / 2;
    g.add(st);
  }
  scope(g, m, 0.07, 0.0, 0.16, 0.016);
  const boltShaft = new THREE.Group(); g.add(boltShaft);
  cylZ(0.004, 0.004, 0.36, m.metal, 0, 0.03, -0.2, boltShaft);
  box(0.016, 0.016, 0.03, new THREE.MeshStandardMaterial({ color: '#3a3a20', roughness: 0.5 }), 0, 0.03, -0.39, boltShaft); // explosive tip
  return {
    group: g, parts: { boltShaft }, muzzleAt: [0, 0.03, -0.42], scoped: true,
    right: { pos: [0.004, -0.075, 0.08], rot: [-0.3, 0, 0], kind: 'grip' },
    left: { pos: [-0.012, -0.05, -0.18], rot: [0.1, 0.2, 1.3], kind: 'under' },
    hip: { x: 0.13, y: -0.11, z: -0.3, ry: 0.05, rz: -0.06, rx: 0.02 },
    aim: { y: -0.07, z: -0.2 },
  };
}

function bknife(m) {
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  cylZ(0.016, 0.018, 0.16, m.black, 0, 0, 0.0);                        // spring handle
  for (let i = 0; i < 6; i++) cylZ(0.019, 0.019, 0.006, m.bakelite, 0, 0, -0.06 + i * 0.024);
  box(0.05, 0.012, 0.012, m.darkMetal, 0, 0, -0.085);                  // guard
  const blade = new THREE.Group(); g.add(blade);
  box(0.004, 0.026, 0.16, new THREE.MeshStandardMaterial({ color: '#9a9c9a', roughness: 0.25, metalness: 0.9 }), 0, 0.002, -0.17, blade);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.019, 0.05, 3), new THREE.MeshStandardMaterial({ color: '#9a9c9a', roughness: 0.25, metalness: 0.9 }));
  tip.rotation.x = -Math.PI / 2; tip.scale.set(0.2, 1, 1); tip.position.set(0, 0.004, -0.275); blade.add(tip);
  box(0.006, 0.01, 0.02, m.metal, 0.018, 0.008, 0.03);                 // release lever
  return {
    group: g, parts: { blade }, muzzleAt: [0, 0, -0.3],
    right: { pos: [0.004, -0.012, 0.02], rot: [0, 0, 0], kind: 'grip' },
    left: { pos: [-0.03, -0.06, 0.06], rot: [-0.2, 0.3, 0.5], kind: 'cup' },
    hip: { x: 0.12, y: -0.1, z: -0.34, ry: 0.06, rz: -0.25, rx: 0.06 },
    aim: { y: -0.03, z: -0.34 },
  };
}

// --- wonder weapons -------------------------------------------------------
let extra = null;
function extraMats() {
  if (extra) return extra;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  extra = {
    gold: std({ color: '#c9a23a', metalness: 0.9, roughness: 0.25 }),
    lacquer: std({ color: '#15110e', metalness: 0.3, roughness: 0.15 }),
    cream: std({ map: T.gloveTexture(), color: '#e2d2ae', roughness: 0.75 }),
    crimson: std({ color: '#7a0f1a', metalness: 0.2, roughness: 0.35 }),
    red: std({ map: T.metalTexture({ color: '#7a1a12', rust: 0.7 }), metalness: 0.4, roughness: 0.6 }),
    yellow: std({ color: '#c9a020', roughness: 0.6 }),
    steel: std({ color: '#c4c4be', metalness: 0.95, roughness: 0.22 }),
    glowGold: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.4, 0.7) }),
    glowRed: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.5, 0.2) }),
  };
  return extra;
}

// The Fucci Gun: black lacquer and gold, an emitter of stacked gold rings
// around a glowing core, cream leather grip.
function fucci(m) {
  const X = extraMats();
  const g = new THREE.Group();
  const { box, cylZ, ring } = helpers(g);
  box(0.034, 0.048, 0.19, X.lacquer, 0, 0.004, -0.02);                  // body
  box(0.036, 0.008, 0.19, X.gold, 0, 0.031, -0.02);                     // gold top rail
  box(0.037, 0.008, 0.12, X.crimson, 0, -0.008, -0.03);                 // stripe
  box(0.0372, 0.0025, 0.12, X.gold, 0, -0.0035, -0.03);
  box(0.0372, 0.0025, 0.12, X.gold, 0, -0.0125, -0.03);
  box(0.004, 0.026, 0.07, X.gold, 0, 0.045, 0.02);                      // fin
  box(0.012, 0.008, 0.012, X.gold, 0, 0.04, -0.1);                      // front sight
  cylZ(0.022, 0.028, 0.06, X.lacquer, 0, 0.006, -0.145);                // emitter
  for (let i = 0; i < 3; i++) ring(0.026 + i * 0.002, X.gold, 0, 0.006, -0.13 - i * 0.022);
  const core = new THREE.Group(); core.position.set(0, 0.006, -0.175); g.add(core);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), X.glowGold); core.add(orb);
  for (const sx of [-1, 1]) box(0.005, 0.005, 0.11, X.glowGold, sx * 0.0185, 0.012, -0.03);   // side coils
  box(0.0372, 0.014, 0.014, X.gold, 0, 0.004, 0.05);                    // monogram plate
  box(0.004, 0.004, 0.05, X.gold, 0, -0.04, 0.0);                       // trigger guard
  box(0.004, 0.022, 0.004, X.gold, 0, -0.03, -0.024);
  box(0.004, 0.02, 0.004, X.lacquer, 0, -0.03, 0.006);
  const gr = new THREE.Group(); gr.position.set(0, -0.02, 0.065); gr.rotation.x = -0.25; g.add(gr);
  box(0.028, 0.105, 0.044, X.cream, 0, -0.055, 0, gr);
  box(0.031, 0.012, 0.047, X.gold, 0, -0.11, 0, gr);                    // butt cap
  const mag = new THREE.Group(); gr.add(mag);
  box(0.02, 0.03, 0.03, X.gold, 0, -0.125, 0, mag);
  return {
    group: g, parts: { mag, core }, muzzleAt: [0, 0.006, -0.19],
    right: { pos: [0.004, -0.062, 0.07], rot: [-0.25, 0, 0], kind: 'grip' },
    left: { pos: [-0.022, -0.08, 0.06], rot: [-0.2, 0.3, 0.5], kind: 'cup' },
    hip: { x: 0.11, y: -0.08, z: -0.34, ry: 0.07, rz: -0.18, rx: 0.03 },
    aim: { y: -0.042, z: -0.34 },
  };
}

// The Chopper: a red housing with a buzz-saw blade exposed at the front,
// a motor at the back, a carry handle on top.
function chopper(m) {
  const X = extraMats();
  const g = new THREE.Group();
  const { box, cylZ } = helpers(g);
  box(0.075, 0.095, 0.3, X.red, 0, 0, -0.04);                          // housing
  for (let i = 0; i < 5; i++) box(0.077, 0.018, 0.02, i % 2 ? m.black : X.yellow, 0, -0.035, -0.14 + i * 0.022);
  for (let i = 0; i < 4; i++) box(0.078, 0.004, 0.18, m.darkMetal, 0, 0.044 - i * 0.012, 0.01);
  cylZ(0.042, 0.042, 0.12, m.darkMetal, 0, 0.01, 0.15);                 // motor
  for (let i = 0; i < 6; i++) cylZ(0.046, 0.046, 0.006, m.metal, 0, 0.01, 0.1 + i * 0.018);
  cylZ(0.01, 0.01, 0.07, m.black, 0.03, 0.06, 0.16);                    // exhaust
  // guard over the top half of the blade
  // the blade rides flat on top of the nose, half hidden under a shroud
  box(0.07, 0.03, 0.06, X.red, 0, 0.055, -0.15);                      // shroud
  box(0.072, 0.006, 0.06, X.yellow, 0, 0.071, -0.15);
  const saw = new THREE.Group(); saw.position.set(0, 0.058, -0.24); g.add(saw);
  saw.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.005, 28), X.steel));
  saw.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 10), m.darkMetal));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.005, 0.012), X.steel);
    t.position.set(Math.cos(a) * 0.095, 0, Math.sin(a) * 0.095);
    t.rotation.y = -a + 0.5;
    saw.add(t);
  }
  cylZ(0.008, 0.008, 0.08, m.darkMetal, 0, 0.05, -0.2);                 // spindle arm
  // carry handle
  box(0.012, 0.012, 0.15, m.black, 0, 0.078, -0.06);
  box(0.01, 0.03, 0.01, m.black, 0, 0.062, -0.13);
  box(0.01, 0.03, 0.01, m.black, 0, 0.062, 0.01);
  box(0.004, 0.012, 0.004, X.glowRed, 0.04, 0.03, 0.06);                // power light
  grip(g, box, m.black, 0.07, -0.045, -0.25, 0.09);
  box(0.004, 0.004, 0.05, m.metal, 0, -0.07, 0.04);
  return {
    group: g, parts: { saw }, muzzleAt: [0, 0.058, -0.34],
    right: { pos: [0.004, -0.085, 0.075], rot: [-0.25, 0, 0], kind: 'grip' },
    left: { pos: [-0.03, -0.05, -0.15], rot: [0.1, 0.2, 1.2], kind: 'under' },
    hip: { x: 0.15, y: -0.118, z: -0.37, ry: 0.1, rz: -0.05, rx: 0.12 },
    aim: { y: -0.1, z: -0.4 },
  };
}

const BUILDERS = {
  fucci, chopper,
  pistol, revolver, rifle, doubleBarrel, smg, carbine,
  cz76, pump, spaz, hs11, mp6k, mpk, pm64, ak75u, galill, rpkk, m17, spectur, famos, awg, g12, hk22, dragunoff, l97, chinapond, krossbow, bknife,
};

// ---------------------------------------------------------------------------
// Mad Dog camo: claw-slashed dark metal with glowing veins in the weapon's
// upgrade color. The glow scrolls and pulses (animateCamo, once per frame).
// ---------------------------------------------------------------------------
const camoCache = new Map();
const camoMats = [];

function camoTextures(color) {
  const S = 256;
  const col = new THREE.Color(color);
  const css = `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`;
  const [c, g] = T.makeCanvas(S, S);
  const [gc, gg] = T.makeCanvas(S, S);
  // base: near-black gunmetal tinted toward the color
  g.fillStyle = `rgb(${18 + col.r * 30},${18 + col.g * 30},${20 + col.b * 30})`; g.fillRect(0, 0, S, S);
  gg.fillStyle = '#000'; gg.fillRect(0, 0, S, S);
  let seed = Math.floor(col.r * 97 + col.g * 57 + col.b * 31) + 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // mottled plates
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rnd() * 0.06})`;
    g.beginPath(); g.arc(rnd() * S, rnd() * S, 8 + rnd() * 30, 0, 7); g.fill();
  }
  // glowing veins (tileable: draw each with wrap-around copies)
  const wrap = (fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.save(); gg.save(); g.translate(ox, oy); gg.translate(ox, oy); fn(); g.restore(); gg.restore(); } };
  for (let i = 0; i < 14; i++) {
    const pts = []; let x = rnd() * S, y = rnd() * S;
    for (let k = 0; k < 7; k++) { pts.push([x, y]); x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; }
    wrap(() => {
      for (const [ctx, w, style] of [[gg, 5, css], [gg, 2, '#fff'], [g, 3, css]]) {
        ctx.strokeStyle = style; ctx.lineWidth = w; ctx.globalAlpha = ctx === g ? 0.5 : 1;
        ctx.beginPath(); pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
  }
  // claw slashes: three parallel tears
  for (let i = 0; i < 5; i++) {
    const x = rnd() * S, y = rnd() * S, a = -0.9 + rnd() * 0.5, len = 50 + rnd() * 50;
    wrap(() => {
      for (let k = 0; k < 3; k++) {
        const ox = Math.cos(a + Math.PI / 2) * k * 9, oy = Math.sin(a + Math.PI / 2) * k * 9;
        for (const [ctx, w, style] of [[g, 5, '#050505'], [gg, 3, css]]) {
          ctx.strokeStyle = style; ctx.lineWidth = w; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); ctx.stroke();
        }
      }
    });
  }
  const map = T.toTexture(c);
  const glow = T.toTexture(gc);
  return { map, glow };
}

function camoMaterial(base, color) {
  const key = color; void base;
  if (camoCache.has(key)) return camoCache.get(key);
  const { map, glow } = camoTextures(color);
  const m = new THREE.MeshStandardMaterial({
    map, emissive: new THREE.Color(color), emissiveMap: glow, emissiveIntensity: 1.4,
    roughness: 0.32, metalness: 0.6,
  });
  m.userData.camo = true;
  camoCache.set(key, m);
  camoMats.push(m);
  return m;
}

// Pulse and scroll the glowing veins on every upgraded gun.
export function animateCamo(t) {
  for (const m of camoMats) {
    m.emissiveIntensity = 1.1 + Math.sin(t * 3.1) * 0.45 + Math.sin(t * 17) * 0.08;
    m.emissiveMap.offset.set(t * 0.035, t * 0.05);
  }
}

// Build a gun. withHands: add first-person hands and sleeves. camo: Mad Dog color.
export function buildGun(model, { withHands = false, rightOnly = false, camo = null } = {}) {
  const m = gunMaterials();
  const spec = (BUILDERS[model] || pistol)(m);
  if (camo) {
    const skip = new Set([m.glove, m.sleeve, m.skin]);
    spec.group.traverse((o) => {
      if (!o.isMesh) return;
      if (Array.isArray(o.material)) o.material = o.material.map((mm) => (skip.has(mm) || mm.transparent ? mm : camoMaterial(mm, camo)));
      else if (!skip.has(o.material) && !o.material.transparent && !(o.material.isMeshBasicMaterial)) o.material = camoMaterial(o.material, camo);
    });
    spec.camo = camo;
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(...spec.muzzleAt);
  spec.group.add(muzzle);
  spec.muzzle = muzzle;
  for (const k of Object.keys(spec.parts)) spec.parts[k].userData.home = spec.parts[k].position.clone();
  if (withHands) addHands(spec, m, rightOnly);
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

function addHands(spec, m, rightOnly = false) {
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
  if (rightOnly) return;
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
