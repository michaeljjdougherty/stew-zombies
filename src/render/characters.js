// =============================================================================
// Playable characters. Each one is built in code from src/render/human.js.
// The rig matches the zombies' (hips > torso > neck > head, shoulders >
// elbows > hands, hips > knees > feet) so the same animation code can drive
// them later for co-op.
// =============================================================================
import * as THREE from 'three';
import { buildHead, torsoGeometry, neckGeometry, limb, handGeometry, shoeGeometry, loft, SKIN, rng } from './human.js';

export const SHIRT_COLORS = {
  navy: { name: 'Navy', hex: '#26324c' },
  sage: { name: 'Sage', hex: '#7e8f72' },
  blue: { name: 'Blue', hex: '#47689a' },
  pink: { name: 'Dusty pink', hex: '#c09092' },
};

export const CHARACTERS = {
  kearns: {
    name: 'Kearns',
    blurb: 'Mid-twenties. Knows something you don\'t, and he\'s enjoying it.',
    shirts: ['sage', 'navy', 'blue', 'dusty pink'],
  },
};

// --- textures -----------------------------------------------------------------
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };

function fabricNoise(g, W, H, R, amt = 0.08) {
  // knit texture: tiny vertical stitches + soft blotches
  for (let i = 0; i < W * H / 6; i++) {
    const x = R() * W, y = R() * H;
    g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${amt})` : `rgba(255,255,255,${amt * 0.7})`;
    g.fillRect(x, y, 1, 2);
  }
}

// Torso: jeans below the hem, a crew-neck tee above, skin in the collar.
// u: 0.5 = front, 0/1 = back. v: 0 = crotch, 1 = base of the neck.
function torsoTexture(shirtHex, seed = 4) {
  const W = 512, H = 512, R = rng(seed);
  const [c, g] = canvas(W, H);
  const vy = (v) => H - v * H;
  // shirt
  g.fillStyle = shirtHex; g.fillRect(0, 0, W, H);
  fabricNoise(g, W, H, R, 0.07);
  // folds: soft diagonal creases on the front and sides, pulled toward the waist
  for (let i = 0; i < 26; i++) {
    const u = R(), y0 = vy(0.2 + R() * 0.5);
    const grd = g.createLinearGradient(u * W - 10, 0, u * W + 10, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, `rgba(0,0,0,${0.06 + R() * 0.08})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(u * W, y0); g.rotate((R() - 0.5) * 0.9); g.fillStyle = grd; g.fillRect(-12, -40 - R() * 50, 24, 80 + R() * 60); g.restore();
  }
  // shading: darker under the chest and at the sides
  const side = g.createLinearGradient(0, 0, W, 0);
  side.addColorStop(0, 'rgba(0,0,0,0.25)'); side.addColorStop(0.25, 'rgba(0,0,0,0.08)'); side.addColorStop(0.5, 'rgba(0,0,0,0)');
  side.addColorStop(0.75, 'rgba(0,0,0,0.08)'); side.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = side; g.fillRect(0, 0, W, H);
  // side seams
  g.strokeStyle = shade(shirtHex, 0.7); g.lineWidth = 2;
  for (const u of [0.25, 0.75]) { g.beginPath(); g.moveTo(u * W, vy(0.12)); g.lineTo(u * W, vy(0.86)); g.stroke(); }
  // crew neck: rib band, then skin inside the collar
  g.fillStyle = shade(shirtHex, 0.82); g.fillRect(0, vy(0.985), W, vy(0.93) - vy(0.985));
  g.strokeStyle = shade(shirtHex, 0.65);
  for (let x = 0; x < W; x += 3) { g.beginPath(); g.moveTo(x, vy(0.985)); g.lineTo(x, vy(0.93)); g.stroke(); }
  g.fillStyle = '#c99f84'; g.fillRect(0, 0, W, vy(0.985));
  // hem and jeans
  const hem = 0.13;
  g.fillStyle = shade(shirtHex, 0.75); g.fillRect(0, vy(hem + 0.012), W, 4);
  g.fillStyle = '#3a4a66'; g.fillRect(0, vy(hem - 0.002), W, H - vy(hem - 0.002));
  denim(g, 0, vy(hem - 0.002), W, H - vy(hem - 0.002), R);
  // shadow the shirt casts on the jeans
  const sh = g.createLinearGradient(0, vy(hem), 0, vy(hem - 0.04));
  sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh; g.fillRect(0, vy(hem), W, vy(hem - 0.04) - vy(hem));
  return tex(c);
}

function denim(g, x0, y0, w, h, R) {
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  g.strokeStyle = 'rgba(160,180,210,0.12)'; g.lineWidth = 1;
  for (let k = -h; k < w; k += 3) { g.beginPath(); g.moveTo(x0 + k, y0 + h); g.lineTo(x0 + k + h, y0); g.stroke(); }
  for (let i = 0; i < w * h / 40; i++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,10,0.12)' : 'rgba(200,210,230,0.08)'; g.fillRect(x0 + R() * w, y0 + R() * h, 2, 1); }
  g.restore();
}

function sleeveTexture(shirtHex, seed = 9) {
  const [c, g] = canvas(256, 128); const R = rng(seed);
  g.fillStyle = shirtHex; g.fillRect(0, 0, 256, 128);
  fabricNoise(g, 256, 128, R, 0.07);
  // hem at the cuff (v = 0 is the cuff end)
  g.fillStyle = shade(shirtHex, 0.72); g.fillRect(0, 118, 256, 4);
  for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.06})`; g.fillRect(R() * 256, 0, 10, 128); }
  return tex(c);
}

function jeansTexture(seed = 12) {
  const [c, g] = canvas(256, 512); const R = rng(seed);
  g.fillStyle = '#3a4a66'; g.fillRect(0, 0, 256, 512);
  denim(g, 0, 0, 256, 512, R);
  // faded front of the thigh and knee (u = .5 is the front)
  for (const [v, a] of [[0.25, 0.18], [0.7, 0.12]]) {
    const grd = g.createRadialGradient(128, 512 * v, 5, 128, 512 * v, 90);
    grd.addColorStop(0, `rgba(170,190,220,${a})`); grd.addColorStop(1, 'rgba(170,190,220,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 512);
  }
  // outer seam
  g.strokeStyle = '#b08a4a'; g.lineWidth = 1.5;
  for (const u of [64, 192]) { g.beginPath(); g.moveTo(u, 0); g.lineTo(u, 512); g.stroke(); }
  // knee creases
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(70 + R() * 110, 512 * (0.42 + R() * 0.12), 40, 3); }
  return tex(c);
}

function skinTexture(skin, seed = 3) {
  const [c, g] = canvas(256, 256); const R = rng(seed);
  g.fillStyle = `rgb(${skin.base.join(',')})`; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { g.fillStyle = R() < 0.5 ? 'rgba(120,60,40,0.06)' : 'rgba(255,230,210,0.05)'; g.fillRect(R() * 256, R() * 256, 2, 2); }
  return tex(c, true);
}

function shoeTexture() {
  const [c, g] = canvas(256, 128);
  // u = round the shoe, v = heel -> toe; white canvas upper, grey sole stripe
  g.fillStyle = '#d8d4c8'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#5a5650'; g.fillRect(0, 0, 256, 128); // sole colour where it wraps under
  g.fillStyle = '#dcd8cc'; g.fillRect(40, 0, 176, 128);
  g.fillStyle = '#8a857a'; g.fillRect(40, 0, 8, 128); g.fillRect(208, 0, 8, 128);
  // laces over the top
  g.strokeStyle = '#efece4'; g.lineWidth = 3;
  for (let v = 30; v < 80; v += 9) { g.beginPath(); g.moveTo(110, v); g.lineTo(146, v + 4); g.stroke(); }
  return tex(c);
}

// --- Kearns -------------------------------------------------------------------
export function buildKearns({ shirt = 'sage', detail = 1 } = {}) {
  const skin = SKIN.light;
  const shirtHex = (SHIRT_COLORS[shirt] || SHIRT_COLORS.sage).hex;
  const mats = {
    skin: new THREE.MeshStandardMaterial({ map: skinTexture(skin), roughness: 0.62 }),
    torso: new THREE.MeshStandardMaterial({ map: torsoTexture(shirtHex), roughness: 0.92 }),
    sleeve: new THREE.MeshStandardMaterial({ map: sleeveTexture(shirtHex), roughness: 0.92, side: THREE.DoubleSide }),
    jeans: new THREE.MeshStandardMaterial({ map: jeansTexture(), roughness: 0.9 }),
    shoe: new THREE.MeshStandardMaterial({ map: shoeTexture(), roughness: 0.75 }),
  };
  mats.torso.bumpMap = mats.torso.map; mats.torso.bumpScale = 1.5;
  mats.jeans.bumpMap = mats.jeans.map; mats.jeans.bumpScale = 1.5;
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  const root = new THREE.Group();
  root.name = 'Kearns';
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  mesh(torsoGeometry({ height: 0.56, shoulders: 0.2, chest: 0.158, waist: 0.138, hips: 0.158, depth: 0.105, build: 0.15 }), mats.torso, torso);

  const neck = new THREE.Group(); neck.position.set(0, 0.535, 0.0); torso.add(neck);
  mesh(neckGeometry(0.095, 0.056), mats.skin, neck, 0, -0.012, 0);
  const headJoint = new THREE.Group(); headJoint.position.set(0, 0.07, 0.012); neck.add(headJoint);
  const H = buildHead({
    shape: { smirk: 0.8, beard: 1, cheeks: 0.08, jaw: 0.3 },
    look: { beard: 1, stubble: 0.3, skin, seed: 11, size: 1024 * Math.min(1, detail) },
    hair: { seed: 5, count: Math.round(380 * detail), detail, length: 1.3 },
    hairColor: [46, 31, 20], eyeColor: '#4a3520', squint: 0.65, detail,
  });
  H.group.position.y = 0.1;
  H.group.scale.setScalar(1.08);
  headJoint.add(H.group);

  // arms
  const arm = (side) => {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 0.185, 0.475, -0.005); torso.add(shoulder);
    shoulder.rotation.z = side * 0.1;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 10), mats.sleeve); cap.scale.set(1, 0.75, 1.05); cap.position.y = -0.005; shoulder.add(cap);
    mesh(limb(0.29, 0.05, 0.04, { bulge: 0.14, bulgeAt: 0.35 }), mats.skin, shoulder);
    // short sleeve over the top of the upper arm
    const sl = loft([
      { y: -0.16, rx: 0.056, rz: 0.052 }, { y: -0.1, rx: 0.057, rz: 0.054 }, { y: -0.02, rx: 0.055, rz: 0.053 }, { y: 0.02, rx: 0.046, rz: 0.046 },
    ], { radial: 16, capBottom: false, capTop: false });
    mesh(sl, mats.sleeve, shoulder);
    const elbow = new THREE.Group(); elbow.position.y = -0.29; shoulder.add(elbow);
    elbow.rotation.x = -0.18;
    mesh(limb(0.26, 0.041, 0.031, { bulge: 0.14, bulgeAt: 0.25 }), mats.skin, elbow);
    const wrist = new THREE.Group(); wrist.position.y = -0.26; elbow.add(wrist);
    const hand = mesh(handGeometry({ curl: 0.55 }), mats.skin, wrist);
    hand.rotation.y = side * -Math.PI / 2 * 0.9;
    hand.scale.x = side; // mirror for the left hand
    return { shoulder, elbow, wrist };
  };
  const armL = arm(1), armR = arm(-1);

  // legs
  const leg = (side) => {
    const hip = new THREE.Group(); hip.position.set(side * 0.09, -0.03, 0); hips.add(hip);
    hip.rotation.z = side * 0.025;
    mesh(limb(0.45, 0.083, 0.055, { bulge: 0.06, bulgeAt: 0.3, flat: 0.95 }), mats.jeans, hip);
    const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
    mesh(limb(0.44, 0.056, 0.046, { bulge: 0.04, bulgeAt: 0.3, flat: 0.95 }), mats.jeans, knee);
    const ankle = new THREE.Group(); ankle.position.y = -0.44; knee.add(ankle);
    mesh(shoeGeometry({ length: 0.28, width: 0.105 }), mats.shoe, ankle, 0, -0.06, 0.005);
    return { hip, knee, ankle };
  };
  const legL = leg(1), legR = leg(-1);

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return { root, hips, torso, neck, head: headJoint, face: H, armL, armR, legL, legR, mats };
}

// Idle animation for menus: breathing, weight shift, a glance around.
export function idleKearns(k, t) {
  const b = Math.sin(t * 1.6);
  k.torso.rotation.x = 0.02 + b * 0.01;
  k.torso.scale.set(1 + b * 0.006, 1, 1 + b * 0.01);
  k.hips.rotation.z = Math.sin(t * 0.5) * 0.02;
  k.hips.position.x = Math.sin(t * 0.5) * 0.01;
  k.head.rotation.y = Math.sin(t * 0.37) * 0.18 + Math.sin(t * 1.1) * 0.03;
  k.head.rotation.x = -0.04 + Math.sin(t * 0.5) * 0.03;
  k.head.rotation.z = Math.sin(t * 0.29) * 0.04;
  k.armL.shoulder.rotation.x = Math.sin(t * 1.6 + 0.4) * 0.025;
  k.armR.shoulder.rotation.x = Math.sin(t * 1.6 + 0.9) * 0.025;
}
