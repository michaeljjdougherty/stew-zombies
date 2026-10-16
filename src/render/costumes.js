// =============================================================================
// Costume gear for the Skin Shop's skins (src/career/skins.js): the hats,
// helmets, hoods, tails and props a skin adds on top of the outfit. A skin's
// look lists them as `gear: [{ kind, ...options }]`; buildCharacter()
// (src/render/characters.js) calls dressGear() once the body's built.
//
// Each piece hangs off the joint it moves with: the head (k.face.group, in the
// head's own units: the skull is about x ±0.08, y ±0.12, the face at z ≈ 0.1),
// the torso (k.torso: y 0 at the hips up to the neck, k.neckY), or the hips.
// =============================================================================
import * as THREE from 'three';

const mat = (color, rough = 0.8, metal = 0, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...o });
function add(parent, geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z); o.castShadow = true;
  parent.add(o);
  return o;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// how far the torso's surface is from its middle at height y (for the back and chest)
function torsoAt(secs, y) {
  for (let i = 1; i < secs.length; i++) {
    if (y <= secs[i].y) {
      const a = secs[i - 1], b = secs[i], t = (y - a.y) / (b.y - a.y);
      return { rx: a.rx + (b.rx - a.rx) * t, rz: a.rz + (b.rz - a.rz) * t, z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * t };
    }
  }
  const l = secs[secs.length - 1];
  return { rx: l.rx, rz: l.rz, z: l.z || 0 };
}
const backZ = (k, y) => { const T = torsoAt(k.secs, y); return (T.z || 0) - T.rz; };
const chestZ = (k, y) => { const T = torsoAt(k.secs, y); return (T.z || 0) + T.rz; };

// --- hair under the hat -------------------------------------------------------------
const hideHair = (k) => { if (k.face.hairMesh) k.face.hairMesh.visible = false; };
const squashHair = (k, y = 0.6) => { if (k.face.hairMesh) k.face.hairMesh.scale.set(1, y, 0.97); };

// A hood over the head with the face left open (dog, horse, dino, skunk)
function hood(k, color) {
  const H = k.face.group, m = mat(color, 0.95);
  const g = new THREE.Group(); g.position.set(0, 0.005, -0.006); g.scale.set(1.02, 1.1, 1.1); H.add(g);
  add(g, new THREE.SphereGeometry(0.118, 24, 10, 0, Math.PI * 2, 0, 0.95), m);
  const side = add(g, new THREE.SphereGeometry(0.118, 24, 12, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0.95, 1.4), m);
  side.material = m.clone(); side.material.side = THREE.DoubleSide;
  // a rim round the face
  const rim = add(g, new THREE.TorusGeometry(0.084, 0.01, 6, 20), m, 0, -0.02, 0.078);
  rim.scale.set(1, 1.2, 0.6);
  hideHair(k);
  return { g, m };
}

const PIECES = {
  // --- headwear --------------------------------------------------------------------
  strawHat(k, o) {
    const H = k.face.group, t = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = o.color || '#d8b46a'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) { g.fillStyle = y % 8 ? 'rgba(90,60,20,0.25)' : 'rgba(255,240,200,0.2)'; g.fillRect(0, y, w, 2); }
    });
    const m = mat('#fff', 0.95, 0, { map: t, side: THREE.DoubleSide });
    add(H, new THREE.CylinderGeometry(0.2, 0.2, 0.008, 28), m, 0, 0.085, 0);
    add(H, new THREE.CylinderGeometry(0.085, 0.1, 0.085, 22), m, 0, 0.13, -0.004);
    add(H, new THREE.CylinderGeometry(0.101, 0.101, 0.02, 22, 1, true), mat(o.band || '#8a2a1e'), 0, 0.1, -0.004);
    squashHair(k);
  },
  topHat(k, o) {
    const H = k.face.group, m = mat(o.color || '#1f6b35', 0.7);
    add(H, new THREE.CylinderGeometry(0.16, 0.16, 0.01, 28), m, 0, 0.09, 0);
    add(H, new THREE.CylinderGeometry(0.1, 0.09, 0.17, 24), m, 0, 0.18, -0.005);
    add(H, new THREE.CylinderGeometry(0.093, 0.093, 0.03, 24, 1, true), mat(o.band || '#111'), 0, 0.115, -0.005);
    if (o.buckle) {
      const b = add(H, new THREE.TorusGeometry(0.018, 0.005, 4, 4), mat(o.buckle, 0.3, 1), 0, 0.115, 0.093);
      b.rotation.z = Math.PI / 4;
    }
    if (o.clover) PIECES.clover(k, { parent: H, x: 0.07, y: 0.15, z: 0.06, size: 0.6 });
    squashHair(k, 0.55);
  },
  stemCap(k) {
    const H = k.face.group, leaf = mat('#3d8a2a', 0.7, 0, { side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, l = add(H, new THREE.ConeGeometry(0.04, 0.13, 4), leaf, Math.sin(a) * 0.06, 0.12, Math.cos(a) * 0.06);
      l.scale.set(1, 1, 0.25); l.rotation.set(Math.cos(a) * 1.25, 0, -Math.sin(a) * 1.25);
    }
    add(H, new THREE.CylinderGeometry(0.012, 0.016, 0.07, 8), mat('#4f7a2a'), 0, 0.17, 0);
    squashHair(k, 0.6);
  },
  dogHood(k, o) {
    const { g, m } = hood(k, o.color || '#8a6440');
    for (const s of [-1, 1]) {
      const ear = add(g, new THREE.SphereGeometry(0.05, 12, 8), mat(o.ear || '#5a3e26', 0.95), s * 0.11, 0.02, -0.01);
      ear.scale.set(0.35, 1.5, 0.9); ear.rotation.z = s * 0.25;
    }
    const snout = add(g, new THREE.SphereGeometry(0.03, 12, 8), m, 0, 0.1, 0.085); snout.scale.set(1.2, 0.8, 1.3);
    add(g, new THREE.SphereGeometry(0.012, 8, 6), mat('#141210', 0.3), 0, 0.105, 0.124);
    for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.01, 8, 6), mat('#141210', 0.2), s * 0.035, 0.112, 0.092);
  },
  horseHood(k, o) {
    const { g, m } = hood(k, o.color || '#8a5a34');
    for (const s of [-1, 1]) {
      const ear = add(g, new THREE.ConeGeometry(0.022, 0.07, 6), m, s * 0.05, 0.13, 0.0);
      ear.rotation.z = -s * 0.25; ear.scale.z = 0.6;
    }
    // the mane: a ridge of dark hair from the forehead down the back
    const mane = mat(o.mane || '#1e140c', 1);
    for (let i = 0; i < 9; i++) {
      const a = -0.5 + i * 0.32, tuft = add(g, new THREE.ConeGeometry(0.018, 0.06, 5), mane, 0, Math.cos(a) * 0.125, Math.sin(-a) * 0.125);
      tuft.rotation.x = -a - 0.3;
    }
    const snout = add(g, new THREE.SphereGeometry(0.04, 12, 8), m, 0, 0.1, 0.09); snout.scale.set(0.9, 0.7, 1.4);
    for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.009, 8, 6), mat('#141210', 0.3), s * 0.016, 0.1, 0.143);
  },
  dinoHood(k, o) {
    const { g, m } = hood(k, o.color || '#3f9a3a');
    // the dino's head sits on top: a long snout with teeth, slit eyes either side, spines down the back
    const snout = add(g, new THREE.SphereGeometry(0.075, 18, 12), m, 0, 0.095, 0.1); snout.scale.set(0.95, 0.5, 1.6);
    const jaw = add(g, new THREE.SphereGeometry(0.06, 14, 8), mat(o.belly || '#d8d06a', 0.9), 0, 0.072, 0.12); jaw.scale.set(0.95, 0.28, 1.5);
    const tooth = mat('#f4f0e2', 0.4);
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + i * (2.4 / 8), t = add(g, new THREE.ConeGeometry(0.006, 0.018, 4), tooth, Math.sin(a) * 0.058, 0.07, 0.11 + Math.cos(a) * 0.085);
      t.rotation.x = Math.PI;
    }
    for (const s of [-1, 1]) {
      const eye = add(g, new THREE.SphereGeometry(0.016, 12, 8), mat('#f2c81e', 0.3), s * 0.062, 0.122, 0.055);
      eye.scale.z = 0.7;
      add(g, new THREE.BoxGeometry(0.004, 0.022, 0.004), mat('#101010', 0.2), s * 0.07, 0.122, 0.064);
      const brow = add(g, new THREE.BoxGeometry(0.04, 0.012, 0.03), m, s * 0.058, 0.142, 0.05); brow.rotation.z = s * 0.3;
      add(g, new THREE.SphereGeometry(0.006, 6, 4), mat('#1a3a14'), s * 0.02, 0.12, 0.215);
    }
    const spine = mat(o.spikes || '#ef8a2a', 0.6);
    for (let i = 0; i < 5; i++) {
      const a = 0.15 + i * 0.4, sp = add(g, new THREE.ConeGeometry(0.018, 0.045, 4), spine, 0, Math.cos(a) * 0.12, -Math.sin(a) * 0.12);
      sp.rotation.x = -a; sp.scale.x = 0.35;
    }
  },
  skunkHood(k, o) {
    const { g } = hood(k, o.color || '#151517');
    // the white stripe from the forehead over the top and down the back
    const stripe = add(g, new THREE.TorusGeometry(0.119, 0.01, 6, 24, Math.PI * 0.85), mat(o.stripe || '#f2f0ea', 0.95), 0, 0, 0);
    stripe.rotation.set(0, Math.PI / 2, -0.15); stripe.scale.set(1, 1, 2.2);
    for (const s of [-1, 1]) {
      const ear = add(g, new THREE.SphereGeometry(0.026, 10, 8), mat(o.color || '#151517', 0.95), s * 0.075, 0.1, -0.01);
      ear.scale.set(1, 1, 0.45);
    }
  },
  fireHelmet(k, o) {
    const H = k.face.group, m = mat(o.color || '#b81d16', 0.35, 0.1);
    const dome = add(H, new THREE.SphereGeometry(0.115, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.06, -0.005);
    dome.scale.set(1, 0.95, 1.08);
    // the long brim, out over the back of the neck
    const brim = add(H, new THREE.CylinderGeometry(0.16, 0.17, 0.012, 28), m, 0, 0.06, -0.03);
    brim.scale.set(0.95, 1, 1.25); brim.rotation.x = -0.12;
    add(H, new THREE.TorusGeometry(0.115, 0.008, 6, 24), mat('#d8b84a', 0.3, 0.8), 0, 0.075, -0.005).rotation.x = Math.PI / 2;
    // the shield on the front
    const shield = canvasTex(64, 64, (g, w, h) => {
      g.fillStyle = '#f2eee2'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#b81d16'; g.font = '900 40px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.number || '1', 32, 34);
    });
    const sh = add(H, new THREE.CircleGeometry(0.04, 16), mat('#fff', 0.4, 0, { map: shield }), 0, 0.12, 0.11);
    sh.rotation.x = -0.35;
    hideHair(k);
  },
  headset(k, o) {
    const H = k.face.group, m = mat(o.color || '#141418', 0.4, 0.3), glow = mat(o.glow || '#7a2ad8', 0.3, 0, { emissive: o.glow || '#7a2ad8', emissiveIntensity: 1.4 });
    const band = add(H, new THREE.TorusGeometry(0.098, 0.009, 6, 24, Math.PI), m, 0, 0.03, 0);
    band.scale.set(1, 1.35, 1);
    for (const s of [-1, 1]) {
      const cup = add(H, new THREE.CylinderGeometry(0.04, 0.04, 0.03, 18), m, s * 0.095, 0.0, 0);
      cup.rotation.z = Math.PI / 2;
      const ring = add(H, new THREE.TorusGeometry(0.035, 0.004, 6, 18), glow, s * 0.112, 0.0, 0);
      ring.rotation.y = Math.PI / 2;
    }
    // the mic, round to the mouth
    const arm = add(H, new THREE.CylinderGeometry(0.003, 0.003, 0.1, 6), m, 0.085, -0.045, 0.06);
    arm.rotation.x = 1.1; arm.rotation.z = 0.5;
    add(H, new THREE.SphereGeometry(0.009, 8, 6), glow, 0.04, -0.07, 0.1);
  },
  horns(k, o) {
    const H = k.face.group, m = mat(o.color || '#c4140e', 0.35);
    for (const s of [-1, 1]) {
      const h = add(H, new THREE.ConeGeometry(0.02, 0.07, 10), m, s * 0.05, 0.135, 0.03);
      h.rotation.z = -s * 0.45; h.rotation.x = -0.2;
    }
  },
  goggles(k, o) {
    const H = k.face.group, strap = mat(o.strap || '#2a1e16', 0.9);
    const band = add(H, new THREE.TorusGeometry(0.097, 0.008, 6, 28), strap, 0, 0.065, 0);
    band.rotation.x = Math.PI / 2 + 0.25; band.scale.set(1, 1.15, 1);
    for (const s of [-1, 1]) {
      const lens = add(H, new THREE.CylinderGeometry(0.026, 0.026, 0.025, 16), mat('#3a3a3a', 0.4, 0.8), s * 0.034, 0.085, 0.098);
      lens.rotation.x = Math.PI / 2 - 0.4;
      const glass = add(H, new THREE.CircleGeometry(0.02, 16), mat('#1e3a2a', 0.1, 0.5, { emissive: '#1a3a26', emissiveIntensity: 0.3 }), s * 0.034, 0.09, 0.111);
      glass.rotation.x = -0.4;
    }
  },
  bucketHat(k, o) {
    const H = k.face.group, m = mat(o.color || '#e8e2d2', 0.95, 0, { side: THREE.DoubleSide });
    add(H, new THREE.CylinderGeometry(0.095, 0.11, 0.075, 24, 1, false), m, 0, 0.115, -0.005);
    add(H, new THREE.CylinderGeometry(0.115, 0.15, 0.04, 28, 1, true), m, 0, 0.065, -0.005);
    squashHair(k, 0.55);
  },
  shades(k, o) {
    const H = k.face.group, lens = mat(o.lens || '#0c0c10', 0.08, 0.6), frame = mat(o.frame || '#141416', 0.3, 0.6);
    for (const s of [-1, 1]) {
      const l = add(H, new THREE.CircleGeometry(o.round ? 0.026 : 0.028, 18), lens, s * 0.036, 0.012, 0.118);
      l.scale.set(o.aviator ? 1.1 : 1.15, o.aviator ? 1 : 0.72, 1);
      const temple = add(H, new THREE.BoxGeometry(0.004, 0.005, 0.1), frame, s * 0.077, 0.018, 0.07);
      temple.rotation.y = s * 0.05;
    }
    add(H, new THREE.BoxGeometry(0.02, 0.004, 0.004), frame, 0, 0.022, 0.12);
  },
  beanie(k, o) {
    const H = k.face.group;
    const t = canvasTex(64, 64, (g, w, h) => {
      g.fillStyle = o.color || '#9a2a22'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 2, h);
      if (o.stripe) { g.fillStyle = o.stripe; g.fillRect(0, 20, w, 10); }
    });
    t.wrapS = THREE.RepeatWrapping; t.repeat.x = 4;
    const m = mat('#fff', 1, 0, { map: t });
    const dome = add(H, new THREE.SphereGeometry(0.105, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.055, -0.006);
    dome.scale.set(1.0, 1.15, 1.08);
    add(H, new THREE.CylinderGeometry(0.108, 0.108, 0.04, 24, 1, true), mat(o.cuff || o.color || '#9a2a22', 1, 0, { side: THREE.DoubleSide }), 0, 0.06, -0.006).scale.z = 1.08;
    if (o.pom) add(H, new THREE.SphereGeometry(0.03, 12, 8), mat(o.pom, 1), 0, 0.185, -0.01);
    hideHair(k);
  },
  cap(k, o) {
    const H = k.face.group, m = mat(o.color || '#ff7a1a', 0.8);
    const g = new THREE.Group(); H.add(g);
    if (o.backwards) g.rotation.y = Math.PI;
    const dome = add(g, new THREE.SphereGeometry(0.104, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.065, -0.004);
    dome.scale.set(1, 0.85, 1.08);
    const bill = add(g, new THREE.CylinderGeometry(0.075, 0.075, 0.008, 20, 1, false, -Math.PI / 2, Math.PI), m, 0, 0.067, 0.085);
    bill.scale.set(1, 1, 1.05); bill.rotation.x = 0.12;
    add(g, new THREE.SphereGeometry(0.01, 8, 6), m, 0, 0.152, -0.004);
    squashHair(k, 0.65);
  },
  // a fast-food visor: a band round the head (the top open), a bill, and the name on the front
  visor(k, o) {
    const H = k.face.group, col = o.color || '#c8202a';
    const t = canvasTex(512, 28, (g, w, h) => {
      g.fillStyle = col; g.fillRect(0, 0, w, h);
      g.fillStyle = o.trim || '#ffc72a'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
      if (o.text) {
        g.font = '900 17px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 3; g.strokeStyle = o.edge || '#5a1208'; g.strokeText(o.text, w / 2, h / 2 + 1);
        g.fillStyle = o.trim || '#ffc72a'; g.fillText(o.text, w / 2, h / 2 + 1);
      }
    });
    // (thetaStart PI: the middle of the picture lands on the front)
    const band = add(H, new THREE.CylinderGeometry(0.108, 0.11, 0.04, 32, 1, true, Math.PI, Math.PI * 2), mat('#fff', 0.7, 0, { map: t, side: THREE.DoubleSide }), 0, 0.075, -0.004);
    band.scale.z = 1.08;
    const bill = add(H, new THREE.CylinderGeometry(0.08, 0.08, 0.008, 20, 1, false, -Math.PI / 2, Math.PI), mat(col, 0.7), 0, 0.058, 0.09);
    bill.scale.set(1, 1, 1.1); bill.rotation.x = 0.16;
    squashHair(k, 0.85);
  },
  cowboyHat(k, o) {
    const H = k.face.group, m = mat(o.color || '#6b4626', 0.85, 0, { side: THREE.DoubleSide });
    // the brim curls up at the sides
    const geo = new THREE.CylinderGeometry(0.2, 0.2, 0.01, 32, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) + Math.max(0, Math.abs(x) - 0.09) ** 2 * 3.2); }
    geo.computeVertexNormals();
    add(H, geo, m, 0, 0.085, 0).scale.z = 1.12;
    const crown = add(H, new THREE.CylinderGeometry(0.085, 0.1, 0.11, 22), m, 0, 0.145, -0.004);
    crown.scale.z = 1.15;
    const dent = add(H, new THREE.BoxGeometry(0.02, 0.02, 0.15), mat(o.color ? new THREE.Color(o.color).multiplyScalar(0.7) : '#4a3018', 0.9), 0, 0.2, -0.004);
    dent.scale.y = 0.5;
    add(H, new THREE.CylinderGeometry(0.101, 0.101, 0.018, 22, 1, true), mat(o.band || '#2a1a0e'), 0, 0.103, -0.004).scale.z = 1.15;
    squashHair(k, 0.55);
  },
  toque(k, o) {
    const H = k.face.group, m = mat(o.color || '#f6f5f1', 0.95);
    add(H, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 24, 1, true), m, 0, 0.1, -0.004).material.side = THREE.DoubleSide;
    // the puffed top
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(H, new THREE.SphereGeometry(0.06, 12, 10), m, Math.sin(a) * 0.055, 0.21, Math.cos(a) * 0.055 - 0.004);
    }
    add(H, new THREE.CylinderGeometry(0.095, 0.1, 0.13, 24), m, 0, 0.16, -0.004);
    squashHair(k, 0.6);
  },
  partyHat(k, o) {
    const H = k.face.group;
    const t = canvasTex(128, 64, (g, w, h) => {
      const C = o.colors || ['#ff4f7a', '#ffd23a', '#3ad0ff'];
      for (let i = 0; i < 8; i++) { g.fillStyle = C[i % C.length]; g.save(); g.translate(i * 16, 0); g.transform(1, 0, -0.5, 1, 0, 0); g.fillRect(0, 0, 10, h); g.restore(); }
    });
    const hat = add(H, new THREE.ConeGeometry(0.06, 0.18, 20, 1, true), mat('#fff', 0.6, 0, { map: t, side: THREE.DoubleSide }), 0.03, 0.2, 0.0);
    hat.rotation.z = -0.25;
    add(H, new THREE.SphereGeometry(0.02, 10, 8), mat('#ffd23a', 0.8), 0.053, 0.29, 0);
  },
  wig(k, o) {
    // a judge's powdered wig: rows of rolled curls down each side (the hair's gone white)
    const H = k.face.group, m = mat(o.color || '#ece8de', 1);
    for (const s of [-1, 1]) for (let r = 0; r < 3; r++) {
      const roll = add(H, new THREE.CylinderGeometry(0.022, 0.022, 0.09, 12), m, s * 0.09, 0.04 - r * 0.045, -0.02);
      roll.rotation.x = Math.PI / 2;
    }
    const top = add(H, new THREE.SphereGeometry(0.11, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), m, 0, 0.045, -0.012);
    top.scale.set(1.02, 1.05, 1.08);
    add(H, new THREE.SphereGeometry(0.04, 12, 8), m, 0, -0.03, -0.11);
    hideHair(k);
  },
  bubbleHelmet(k) {
    const H = k.face.group;
    add(H, new THREE.SphereGeometry(0.19, 28, 18), mat('#cfe6ff', 0.02, 0.1, { transparent: true, opacity: 0.18, depthWrite: false, envMapIntensity: 1.5 }), 0, 0.01, 0.01).castShadow = false;
    const ring = add(k.neck, new THREE.TorusGeometry(0.105, 0.022, 10, 28), mat('#d8dade', 0.3, 0.7), 0, 0.02, 0.005);
    ring.rotation.x = Math.PI / 2;
    add(H, new THREE.SphereGeometry(0.008, 8, 6), mat('#ff3a2a', 0.3, 0, { emissive: '#ff3a2a', emissiveIntensity: 2 }), 0.12, 0.09, 0.1);
  },
  earpiece(k) {
    const H = k.face.group, m = mat('#e8e6e0', 0.4);
    add(H, new THREE.SphereGeometry(0.008, 8, 6), m, -0.085, 0.0, 0.0);
    const wire = add(H, new THREE.CylinderGeometry(0.0018, 0.0018, 0.12, 4), m, -0.085, -0.06, -0.01);
    wire.rotation.x = 0.15;
  },
  mustache(k, o) {
    const H = k.face.group, m = mat(o.color || '#1a120c', 1);
    for (const s of [-1, 1]) {
      const half = add(H, new THREE.CapsuleGeometry(0.009, 0.035, 4, 8), m, s * 0.024, -0.047, 0.118);
      half.rotation.z = s * 1.25;
      const curl = add(H, new THREE.TorusGeometry(0.01, 0.004, 6, 10, Math.PI * 1.3), m, s * 0.052, -0.04, 0.11);
      curl.rotation.z = s > 0 ? -0.6 : Math.PI + 0.6;
    }
  },

  // --- the neck and chest ----------------------------------------------------------------
  bandana(k, o) {
    const T = k.torso, y = k.neckY - 0.01, m = mat(o.color || '#b01c1c', 0.9, 0, { side: THREE.DoubleSide });
    const R = torsoAt(k.secs, y);
    const ring = add(T, new THREE.TorusGeometry(Math.max(R.rx, R.rz) * 0.62, 0.016, 6, 22), m, 0, y, 0);
    ring.rotation.x = Math.PI / 2; ring.scale.set(1.1, 1, 1);
    const tri = add(T, new THREE.ConeGeometry(0.06, 0.09, 3), m, 0, y - 0.05, chestZ(k, y - 0.05) + 0.008);
    tri.rotation.set(0, 0, Math.PI); tri.scale.z = 0.25;
  },
  collar(k, o) {
    const T = k.torso, y = k.neckY + 0.005;
    const ring = add(T, new THREE.TorusGeometry(0.068, 0.012, 6, 22), mat(o.color || '#b01c1c', 0.6), 0, y, 0.005);
    ring.rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, sp = add(T, new THREE.ConeGeometry(0.006, 0.016, 6), mat('#cfd2d6', 0.3, 1), Math.sin(a) * 0.08, y, Math.cos(a) * 0.08 + 0.005);
      sp.rotation.set(Math.cos(a) * Math.PI / 2, 0, -Math.sin(a) * Math.PI / 2);
    }
    const tag = add(T, new THREE.CylinderGeometry(0.014, 0.014, 0.003, 14), mat(o.tag || '#d8b84a', 0.3, 1), 0, y - 0.025, 0.08);
    tag.rotation.x = Math.PI / 2;
  },
  medallion(k, o) {
    const T = k.torso, y = k.neckY - 0.2;
    const md = add(T, new THREE.CylinderGeometry(0.035, 0.035, 0.007, 22), mat(o.metal || '#d4a93c', 0.25, 1), 0, y, chestZ(k, y) + 0.01);
    md.rotation.x = Math.PI / 2;
    if (o.letter) {
      const t = canvasTex(64, 64, (g) => { g.fillStyle = '#d4a93c'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#6a4a10'; g.font = '900 44px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.letter, 32, 35); });
      add(T, new THREE.CircleGeometry(0.03, 20), mat('#fff', 0.3, 0.8, { map: t }), 0, y, chestZ(k, y) + 0.0145);
    }
  },
  jabot(k) {
    const T = k.torso, y = k.neckY - 0.03, m = mat('#f6f5f1', 0.9, 0, { side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const f = add(T, new THREE.ConeGeometry(0.03 - i * 0.004, 0.05, 10, 1, true), m, 0, y - i * 0.03, chestZ(k, y - i * 0.03) + 0.008);
      f.rotation.x = Math.PI; f.scale.z = 0.4;
    }
  },
  clover(k, o) {
    const P = o.parent || k.torso, y = o.y ?? k.neckY - 0.1, z = o.z ?? chestZ(k, y) + 0.004, x = o.x ?? 0.06, sz = o.size || 1;
    const m = mat('#2f9a3a', 0.6, 0, { side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      add(P, new THREE.CircleGeometry(0.012 * sz, 12), m, x + Math.cos(a) * 0.011 * sz, y + Math.sin(a) * 0.011 * sz, z);
    }
  },
  carrot(k) {
    const T = k.torso, y = 0.4, z = chestZ(k, y) + 0.012;
    const c = add(T, new THREE.ConeGeometry(0.012, 0.08, 10), mat('#ef7a1a', 0.7), 0.035, y + 0.01, z);
    c.rotation.x = Math.PI; c.rotation.z = -0.15;
    for (const s of [-1, 0, 1]) { const l = add(T, new THREE.ConeGeometry(0.005, 0.04, 4), mat('#3d8a2a'), 0.035 + s * 0.006, y + 0.065, z); l.rotation.z = s * 0.4; }
  },
  star(k, o) {
    const T = k.torso, y = k.neckY - 0.12, x = 0.06;
    const st = add(T, new THREE.CylinderGeometry(0.022, 0.022, 0.004, 5), mat(o.metal || '#d4a93c', 0.25, 1), x, y, chestZ(k, y) + 0.016);
    st.rotation.x = Math.PI / 2;
    const st2 = add(T, new THREE.CylinderGeometry(0.022, 0.022, 0.004, 5), st.material, x, y, chestZ(k, y) + 0.016);
    st2.rotation.set(Math.PI / 2, Math.PI / 5, 0);
  },
  // a name tag pinned on the chest: the company on top, their name under it
  nameTag(k, o) {
    const T = k.torso, y = k.neckY - 0.13, x = -0.065;
    const name = String((k.def && k.def.name) || '').toUpperCase();
    const t = canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = '#f6f4ee'; g.fillRect(0, 0, w, h);
      g.fillStyle = o.color || '#c8202a'; g.fillRect(0, 0, w, 24);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = o.trim || '#ffc72a'; g.font = '900 17px Impact, "Arial Black", sans-serif'; g.fillText(o.text || '', w / 2, 13);
      g.fillStyle = '#1a1a1e'; g.font = '900 24px Impact, "Arial Black", sans-serif'; g.fillText(name, w / 2, 45);
    });
    add(T, new THREE.BoxGeometry(0.07, 0.035, 0.004), mat('#fff', 0.5, 0, { map: t }), x, y, chestZ(k, y) + 0.01);
  },
  carton(k) {
    // a milk carton round the body: MISSING on the front, his face on the side
    const T = k.torso, T0 = torsoAt(k.secs, 0.3);
    const w = T0.rx * 2 + 0.08, d = T0.rz * 2 + 0.08, h = 0.5;
    const face = (front) => canvasTex(256, 256, (g, W, H) => {
      g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#2a5ab0'; g.fillRect(0, 0, W, 34); g.fillRect(0, H - 22, W, 22);
      g.fillStyle = '#fff'; g.font = '900 24px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('WHOLE MILK', W / 2, 26);
      g.fillStyle = '#1a1a1a'; g.font = '900 40px Impact, sans-serif';
      if (front) {
        g.fillText('MISSING', W / 2, 78);
        g.strokeStyle = '#1a1a1a'; g.lineWidth = 3; g.strokeRect(W / 2 - 46, 92, 92, 100);
        g.beginPath(); g.arc(W / 2, 134, 26, 0, 7); g.stroke();
        g.beginPath(); g.arc(W / 2, 140, 13, 0.2, Math.PI - 0.2); g.stroke();
        g.fillRect(W / 2 - 12, 124, 5, 5); g.fillRect(W / 2 + 7, 124, 5, 5);
        g.font = '700 18px Arial, sans-serif'; g.fillText('HAVE YOU SEEN ZACH?', W / 2, 218);
      } else { g.font = '700 22px Arial, sans-serif'; g.fillText('LAST SEEN', W / 2, 110); g.fillText('SMILING', W / 2, 140); }
    });
    const side = mat('#fff', 0.85, 0, { map: face(false) }), front = mat('#fff', 0.85, 0, { map: face(true) });
    const box = add(T, new THREE.BoxGeometry(w, h, d), [side, side, mat('#f4f2ea', 0.85), mat('#f4f2ea', 0.85), front, side], 0, 0.27, (T0.z || 0));
    // the gable top round the neck
    const roof = add(T, new THREE.CylinderGeometry(0.001, Math.max(w, d) * 0.72, 0.1, 4, 1, true), mat('#f4f2ea', 0.85, 0, { side: THREE.DoubleSide }), 0, 0.27 + h / 2 + 0.05, (T0.z || 0));
    roof.rotation.y = Math.PI / 4; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    void box;
  },
  tomato(k) {
    // a big round tomato round the body
    const T = k.torso, T0 = torsoAt(k.secs, 0.3);
    const r = Math.max(T0.rx, T0.rz) + 0.12;
    const body = add(T, new THREE.SphereGeometry(r, 28, 18), mat('#d8281e', 0.35), 0, 0.29, T0.z || 0);
    body.scale.set(1.05, 0.9, 1);
    // a ring of green leaves round the neck
    const leaf = mat('#3d8a2a', 0.7, 0, { side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, l = add(T, new THREE.ConeGeometry(0.035, 0.1, 4), leaf, Math.sin(a) * 0.09, 0.29 + r * 0.86, Math.cos(a) * 0.09 + (T0.z || 0));
      l.scale.set(1, 1, 0.2); l.rotation.set(Math.cos(a) * 1.4, 0, -Math.sin(a) * 1.4);
    }
  },

  // --- on the back -----------------------------------------------------------------
  airTank(k, o) {
    const T = k.torso, y = 0.36, z = backZ(k, y) - 0.06;
    const m = mat(o.color || '#c9c9c4', 0.3, 0.8);
    add(T, new THREE.CylinderGeometry(0.055, 0.055, 0.32, 18), m, 0, y, z);
    add(T, new THREE.SphereGeometry(0.055, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, y + 0.16, z);
    add(T, new THREE.CylinderGeometry(0.018, 0.018, 0.04, 10), mat('#222', 0.4, 0.6), 0, y + 0.22, z);
    add(T, new THREE.BoxGeometry(0.2, 0.3, 0.02), mat(o.frame || '#1a1a1a', 0.6, 0.4), 0, y, z + 0.045);
  },
  lifePack(k) {
    const T = k.torso, y = 0.36, z = backZ(k, y) - 0.06;
    add(T, new THREE.BoxGeometry(0.24, 0.3, 0.1), mat('#e8e8e4', 0.6), 0, y, z);
    add(T, new THREE.BoxGeometry(0.08, 0.04, 0.012), mat('#3ad0ff', 0.3, 0, { emissive: '#3ad0ff', emissiveIntensity: 1.2 }), 0.05, y + 0.08, z - 0.052);
    for (const s of [-1, 1]) add(T, new THREE.CylinderGeometry(0.03, 0.03, 0.26, 12), mat('#cfd2d6', 0.3, 0.7), s * 0.1, y, z - 0.04);
  },
  barbell(k) {
    // across the shoulders, behind the neck
    const T = k.torso, y = k.neckY - 0.02, z = backZ(k, y) - 0.02;
    const bar = add(T, new THREE.CylinderGeometry(0.012, 0.012, 1.0, 10), mat('#c9ccd0', 0.3, 1), 0, y, z);
    bar.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) for (const [x, r] of [[0.38, 0.11], [0.43, 0.09]]) {
      const pl = add(T, new THREE.CylinderGeometry(r, r, 0.035, 22), mat('#1a1a1a', 0.5, 0.3), s * x, y, z);
      pl.rotation.z = Math.PI / 2;
    }
  },
  axe(k) {
    const T = k.torso, y = 0.33, z = backZ(k, y) - 0.03;
    const g = new THREE.Group(); g.position.set(0, y, z); g.rotation.z = 0.7; T.add(g);
    add(g, new THREE.CylinderGeometry(0.012, 0.014, 0.62, 8), mat('#8a5a2e', 0.7), 0, 0, 0);
    const head = add(g, new THREE.BoxGeometry(0.1, 0.07, 0.012), mat('#b8bcc2', 0.3, 0.9), 0.04, 0.27, 0);
    void head;
    add(g, new THREE.BoxGeometry(0.04, 0.07, 0.014), mat('#a8281e', 0.5), -0.0, 0.27, 0);
  },
  hammer(k) {
    const T = k.torso, y = 0.32, z = backZ(k, y) - 0.03;
    const g = new THREE.Group(); g.position.set(0, y, z); g.rotation.z = -0.6; T.add(g);
    add(g, new THREE.CylinderGeometry(0.012, 0.014, 0.5, 8), mat('#5a3a1e', 0.8), 0, 0, 0);
    add(g, new THREE.BoxGeometry(0.13, 0.05, 0.05), mat('#3a3a3c', 0.45, 0.85), 0, 0.24, 0);
  },
  spikes(k, o) {
    const T = k.torso, m = mat(o.color || '#ef8a2a', 0.6);
    for (let i = 0; i < 6; i++) {
      const y = 0.1 + i * 0.085, s = 0.7 + Math.sin((i / 5) * Math.PI) * 0.5;
      const sp = add(T, new THREE.ConeGeometry(0.03 * s, 0.07 * s, 4), m, 0, y, backZ(k, y) - 0.01);
      sp.rotation.x = -Math.PI / 2 - 0.2; sp.scale.x = 0.35;
    }
  },
  tail(k, o) {
    // a tail off the back of the hips: dog, dino, devil, skunk, horse
    const kind = o.type || 'dog', m = mat(o.color || '#8a6440', kind === 'horse' ? 1 : 0.9);
    const g = new THREE.Group(); g.position.set(0, 0.06, backZ(k, 0.06) + 0.01); k.torso.add(g);
    const len = { dog: 0.18, dino: 0.6, devil: 0.5, skunk: 0.4, horse: 0.42 }[kind] || 0.3;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      if (kind === 'dino') pts.push(new THREE.Vector3(0, -0.05 - t * 0.35 + t * t * 0.25, -t * len));
      else if (kind === 'skunk') pts.push(new THREE.Vector3(0, Math.sin(t * 2.2) * 0.32, -0.04 - Math.sin(t * 1.4) * 0.16));
      else if (kind === 'horse') pts.push(new THREE.Vector3(0, -t * len, -0.03 - Math.sin(t * 1.5) * 0.06));
      else if (kind === 'devil') pts.push(new THREE.Vector3(Math.sin(t * 5) * 0.05, -t * 0.45 + t * t * 0.2, -0.03 - t * 0.12));
      else pts.push(new THREE.Vector3(0, t * 0.12, -0.02 - t * len * 0.8));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const r0 = { dog: 0.02, dino: 0.09, devil: 0.009, skunk: 0.07, horse: 0.035 }[kind] || 0.03;
    const geo = new THREE.TubeGeometry(curve, 24, 1, 10, false);
    // taper toward the tip
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const seg = Math.floor(i / 11), t = seg / 24, c = curve.getPoint(t);
      const taper = kind === 'skunk' ? (0.6 + Math.sin(t * Math.PI) * 0.6) : kind === 'horse' ? 0.7 + t * 0.6 : (1 - t * 0.85);
      p.setXYZ(i, c.x + (p.getX(i) - c.x) * r0 * taper, c.y + (p.getY(i) - c.y) * r0 * taper, c.z + (p.getZ(i) - c.z) * r0 * taper);
    }
    geo.computeVertexNormals();
    add(g, geo, m);
    if (kind === 'skunk') {
      const st = add(g, geo.clone(), mat(o.stripe || '#f2f0ea', 0.95)); st.scale.set(0.35, 1.02, 1.02); st.position.z = -0.01;
      add(g, new THREE.SphereGeometry(r0 * 0.6, 12, 8), m, pts[10].x, pts[10].y, pts[10].z);   // (a round end)
    }
    if (kind === 'devil') { const tip = add(g, new THREE.ConeGeometry(0.03, 0.05, 3), m, pts[10].x, pts[10].y - 0.02, pts[10].z); tip.rotation.x = Math.PI; tip.scale.z = 0.4; }
    if (kind === 'dino') for (let i = 1; i < 6; i++) { const c = curve.getPoint(i / 7), sp = add(g, new THREE.ConeGeometry(0.022, 0.05, 4), mat(o.spikes || '#ef8a2a', 0.6), c.x, c.y + r0 * (1 - i / 7 * 0.85) * 0.9, c.z); sp.scale.x = 0.35; }
    g.userData.tail = kind;
    k.tail = g;
  },
};

export function dressGear(k, gear) {
  for (const piece of gear) {
    const f = PIECES[piece.kind];
    if (f) f(k, piece);
  }
  k.root.traverse((o) => { if (o.isMesh && o.material && !o.material.transparent) o.castShadow = true; });
}

export const GEAR_KINDS = Object.keys(PIECES);
