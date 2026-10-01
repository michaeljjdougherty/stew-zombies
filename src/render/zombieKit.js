// =============================================================================
// Zombie parts kit: the reunion guests and school staff after the stew.
// Builds a handful of head variants and outfits once (textures painted in
// code), then every zombie is assembled from shared geometry and materials so
// a full horde stays cheap to draw.
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { headGeometry, headTexture, irisTexture, hairGeometry, hairTexture, torsoGeometry, neckGeometry, limb, handGeometry, shoeGeometry, loft, SKIN, rng } from './human.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };

// --- damage painted over any cloth -----------------------------------------------
function grime(g, W, H, R, amt = 1) {
  for (let i = 0; i < 40 * amt; i++) {
    const x = R() * W, y = R() * H, r = 10 + R() * 50;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(30,24,14,${0.25 * amt})`); grd.addColorStop(1, 'rgba(30,24,14,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function bloodSplat(g, x, y, s, R, dark = false) {
  g.fillStyle = dark ? 'rgba(40,4,3,0.9)' : 'rgba(92,8,6,0.85)';
  g.beginPath(); g.ellipse(x, y, s, s * (0.6 + R() * 0.5), R() * 3, 0, 7); g.fill();
  for (let i = 0; i < 8; i++) {
    const a = R() * 6.28, d = s * (1 + R() * 1.6);
    g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, s * (0.08 + R() * 0.2), 0, 7); g.fill();
  }
  // drips run down (canvas y grows down = toward the hem)
  for (let i = 0; i < 3; i++) {
    const dx = x + (R() - 0.5) * s * 1.4, len = s * (1 + R() * 3);
    g.fillRect(dx, y, 2 + R() * 2, len);
  }
}
function tears(g, W, H, R, n) {
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = H * (0.15 + R() * 0.7), w = 12 + R() * 40, h = 8 + R() * 26;
    g.save(); g.translate(x, y); g.rotate((R() - 0.5) * 1.2);
    // ragged hole: dark rim, wet flesh inside, ribs on some
    g.fillStyle = '#1a0606';
    g.beginPath();
    for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.28, r = 1 + (R() - 0.5) * 0.5; g.lineTo(Math.cos(a) * w * r, Math.sin(a) * h * r); }
    g.closePath(); g.fill();
    g.fillStyle = '#6a1712';
    g.beginPath(); g.ellipse(0, 0, w * 0.75, h * 0.7, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(160,40,30,0.6)';
    g.beginPath(); g.ellipse(-w * 0.2, -h * 0.2, w * 0.3, h * 0.25, 0, 0, 7); g.fill();
    if (R() < 0.4) { g.fillStyle = '#c8b898'; for (let k = -1; k <= 1; k++) g.fillRect(-w * 0.6, k * h * 0.3 - 2, w * 1.2, 3); }
    g.restore();
  }
}

// --- outfits ------------------------------------------------------------------------
// u: 0.5 = front of the body. v: 0 = bottom.
const OUTFITS = [
  { id: 'suit', top: 'suit', color: '#24262c', color2: '#7a1c1c', shirt: '#d8d4c8', pants: '#24262c', sleeve: 'long', shoes: '#141210' },
  { id: 'suitBrown', top: 'suit', color: '#4a3a2a', color2: '#2a3a5a', shirt: '#cfc6b0', pants: '#4a3a2a', sleeve: 'long', shoes: '#1e1610' },
  { id: 'sweater', top: 'sweater', color: '#6a2428', pants: '#8a7a5a', sleeve: 'long', shoes: '#2a2018' },
  { id: 'flannel', top: 'flannel', color: '#7a2a22', color2: '#1e2228', pants: '#2e3a52', sleeve: 'long', shoes: '#3a3026' },
  { id: 'letterman', top: 'letterman', color: '#5a1418', color2: '#d8cfb4', pants: '#34445e', sleeve: 'long', shoes: '#d0ccc0' },
  { id: 'janitor', top: 'overalls', color: '#5a6066', color2: '#3e4a5c', pants: '#3e4a5c', sleeve: 'short', shoes: '#1a1814' },
  { id: 'lunch', top: 'uniform', color: '#d6d2c4', color2: '#e8e4d8', pants: '#d6d2c4', sleeve: 'short', shoes: '#cfc8b8' },
  { id: 'polo', top: 'polo', color: '#2e5a4a', pants: '#9a8a68', sleeve: 'short', shoes: '#3a2c20' },
  { id: 'tee', top: 'tee', color: '#5c6470', pants: '#2e3a52', sleeve: 'short', shoes: '#b8b4aa' },
];

function knit(g, W, H, R, a = 0.06) {
  for (let i = 0; i < W * H / 5; i++) { g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.6})`; g.fillRect(R() * W, R() * H, 1, 2); }
}

function torsoTex(o, seed) {
  const W = 512, H = 512, R = rng(seed);
  const [c, g] = canvas(W, H);
  const vy = (v) => H - v * H;
  const cx = W * 0.5;
  g.fillStyle = o.color; g.fillRect(0, 0, W, H);
  if (o.top === 'flannel') {
    g.globalAlpha = 0.55; g.fillStyle = o.color2;
    for (let x = 0; x < W; x += 48) g.fillRect(x, 0, 14, H);
    for (let y = 0; y < H; y += 48) g.fillRect(0, y, W, 14);
    g.globalAlpha = 0.25; g.fillStyle = '#e8d8b0';
    for (let x = 24; x < W; x += 48) g.fillRect(x, 0, 2, H);
    g.globalAlpha = 1;
  }
  knit(g, W, H, R, o.top === 'sweater' ? 0.1 : 0.06);
  if (o.top === 'suit') {
    // shirt and tie in the V of the jacket
    g.fillStyle = o.shirt;
    g.beginPath(); g.moveTo(cx - 60, vy(0.95)); g.lineTo(cx + 60, vy(0.95)); g.lineTo(cx, vy(0.55)); g.closePath(); g.fill();
    g.fillStyle = o.color2;
    g.beginPath(); g.moveTo(cx - 8, vy(0.93)); g.lineTo(cx + 8, vy(0.93)); g.lineTo(cx + 14, vy(0.6)); g.lineTo(cx, vy(0.55)); g.lineTo(cx - 14, vy(0.6)); g.closePath(); g.fill();
    // lapels
    g.strokeStyle = shade(o.color, 0.6); g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx - 62, vy(0.95)); g.lineTo(cx, vy(0.55)); g.lineTo(cx + 62, vy(0.95)); g.stroke();
    g.fillStyle = shade(o.color, 0.7); g.fillRect(cx - 2, vy(0.55), 4, vy(0.14) - vy(0.55));
    g.fillStyle = '#0c0c0c'; for (const v of [0.45, 0.32]) { g.beginPath(); g.arc(cx + 10, vy(v), 5, 0, 7); g.fill(); }
  } else if (o.top === 'sweater') {
    g.fillStyle = shade(o.color, 0.8); g.fillRect(0, vy(0.2), W, 18);
    for (let x = 0; x < W; x += 4) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x, vy(0.2), 2, 18); }
  } else if (o.top === 'letterman') {
    g.fillStyle = o.color2; g.font = '900 64px Georgia, serif'; g.textAlign = 'center';
    g.fillText('LB', cx + 64, vy(0.62));
    for (const y of [0.975, 0.2]) { g.fillStyle = o.color2; g.fillRect(0, vy(y), W, 8); g.fillStyle = o.color; g.fillRect(0, vy(y) + 8, W, 4); g.fillStyle = o.color2; g.fillRect(0, vy(y) + 12, W, 4); }
    g.fillStyle = '#d8cfb4'; for (const v of [0.8, 0.65, 0.5, 0.35]) { g.beginPath(); g.arc(cx, vy(v), 5, 0, 7); g.fill(); }
  } else if (o.top === 'overalls') {
    g.fillStyle = o.color2;
    g.fillRect(cx - 80, vy(0.75), 160, vy(0.0) - vy(0.75));
    g.fillRect(0, vy(0.3), W, vy(0) - vy(0.3));
    g.fillRect(cx - 70, vy(0.98), 22, vy(0.75) - vy(0.98)); g.fillRect(cx + 48, vy(0.98), 22, vy(0.75) - vy(0.98));
    g.fillStyle = '#b8a060'; g.beginPath(); g.arc(cx - 59, vy(0.76), 6, 0, 7); g.arc(cx + 59, vy(0.76), 6, 0, 7); g.fill();
    knit(g, W, H, R, 0.05);
  } else if (o.top === 'uniform') {
    g.fillStyle = o.color2; g.fillRect(cx - 90, vy(0.7), 180, vy(0) - vy(0.7));
    g.strokeStyle = '#b8b2a0'; g.lineWidth = 3; g.strokeRect(cx - 90, vy(0.7), 180, vy(0) - vy(0.7));
  } else if (o.top === 'polo') {
    g.fillStyle = shade(o.color, 0.8); g.fillRect(cx - 10, vy(0.98), 20, vy(0.8) - vy(0.98));
    g.fillStyle = '#e8e2d0'; for (const v of [0.94, 0.88, 0.82]) { g.beginPath(); g.arc(cx, vy(v), 3, 0, 7); g.fill(); }
  }
  // collar band and neck skin
  g.fillStyle = o.top === 'suit' ? o.shirt : shade(o.color, 0.8); g.fillRect(0, vy(0.99), W, vy(0.94) - vy(0.99));
  g.fillStyle = '#8a8a70'; g.fillRect(0, 0, W, vy(0.99));
  // belt line and pants at the bottom
  if (o.top !== 'overalls' && o.top !== 'uniform') {
    g.fillStyle = o.pants; g.fillRect(0, vy(0.13), W, H - vy(0.13));
    g.fillStyle = '#1a1612'; g.fillRect(0, vy(0.15), W, 10);
  }
  // body shading
  const side = g.createLinearGradient(0, 0, W, 0);
  side.addColorStop(0, 'rgba(0,0,0,0.3)'); side.addColorStop(0.25, 'rgba(0,0,0,0.08)'); side.addColorStop(0.5, 'rgba(0,0,0,0)'); side.addColorStop(0.75, 'rgba(0,0,0,0.08)'); side.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = side; g.fillRect(0, 0, W, H);
  // the damage
  grime(g, W, H, R, 1);
  tears(g, W, H, R, 2 + Math.floor(R() * 3));
  for (let i = 0; i < 5 + R() * 5; i++) bloodSplat(g, R() * W, R() * H * 0.8, 5 + R() * 22, R, R() < 0.4);
  // a bib of blood down the front from the mouth
  const bib = g.createLinearGradient(0, vy(1), 0, vy(0.5));
  bib.addColorStop(0, 'rgba(70,6,4,0.85)'); bib.addColorStop(1, 'rgba(70,6,4,0)');
  g.fillStyle = bib; g.beginPath(); g.ellipse(cx, vy(0.85), 60 + R() * 40, 110, 0, 0, 7); g.fill();
  return tex(c);
}

function sleeveTex(o, seed, lower) {
  const W = 256, H = 256, R = rng(seed);
  const [c, g] = canvas(W, H);
  const col = o.top === 'letterman' ? o.color2 : o.color;
  g.fillStyle = col; g.fillRect(0, 0, W, H);
  if (o.top === 'flannel') {
    g.globalAlpha = 0.55; g.fillStyle = o.color2;
    for (let x = 0; x < W; x += 48) g.fillRect(x, 0, 14, H);
    for (let y = 0; y < H; y += 48) g.fillRect(0, y, W, 14);
    g.globalAlpha = 1;
  }
  knit(g, W, H, R, 0.07);
  if (lower) {
    // frayed cuff, torn at the bottom (v = 0 is the wrist)
    g.fillStyle = o.top === 'letterman' ? o.color : shade(col, 0.8); g.fillRect(0, H - 16, W, 16);
  }
  grime(g, W, H, R, 0.8);
  for (let i = 0; i < 3; i++) bloodSplat(g, R() * W, R() * H, 4 + R() * 12, R);
  if (R() < 0.6) tears(g, W, H, R, 1);
  return tex(c);
}

function pantsTex(o, seed) {
  const W = 256, H = 512, R = rng(seed);
  const [c, g] = canvas(W, H);
  g.fillStyle = o.pants; g.fillRect(0, 0, W, H);
  knit(g, W, H, R, 0.06);
  g.strokeStyle = shade(o.pants, 0.7); g.lineWidth = 2;
  for (const u of [64, 192]) { g.beginPath(); g.moveTo(u, 0); g.lineTo(u, H); g.stroke(); }
  grime(g, W, H, R, 1.3);
  // dirt and blood worse toward the cuffs (v = 0 = bottom = canvas bottom)
  const dirt = g.createLinearGradient(0, H, 0, H * 0.6);
  dirt.addColorStop(0, 'rgba(30,22,12,0.6)'); dirt.addColorStop(1, 'rgba(30,22,12,0)');
  g.fillStyle = dirt; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) bloodSplat(g, R() * W, R() * H, 4 + R() * 14, R, R() < 0.5);
  if (R() < 0.7) tears(g, W, H, R, 1);
  return tex(c);
}

function zombieSkinTex(skin, seed) {
  const W = 256, H = 256, R = rng(seed);
  const [c, g] = canvas(W, H);
  g.fillStyle = `rgb(${skin.base.join(',')})`; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    const x = R() * W, y = R() * H, r = 8 + R() * 30;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = R() < 0.5 ? `rgba(${skin.shade.join(',')},0.6)` : 'rgba(90,40,50,0.35)';
    grd.addColorStop(0, tone); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = 'rgba(40,40,60,0.35)';
  for (let k = 0; k < 14; k++) {
    let x = R() * W, y = R() * H; g.lineWidth = 0.6 + R(); g.beginPath(); g.moveTo(x, y);
    for (let j = 0; j < 6; j++) { x += (R() - 0.5) * 16; y += (R() - 0.5) * 16; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 6; i++) bloodSplat(g, R() * W, R() * H, 3 + R() * 8, R, true);
  return tex(c, true);
}

// --- heads -------------------------------------------------------------------------
const HEADS = [
  { shape: { gaunt: 1, jaw: 0.25, nose: 0.026, width: 0.074 }, skin: 'zombie', hair: 'messy', hairColor: [40, 34, 26], beard: 0 },
  { shape: { gaunt: 0.7, jaw: 0.34, nose: 0.032, cheeks: 0.1, width: 0.078 }, skin: 'zombieGrey', hair: 'bald', hairColor: [60, 56, 50], beard: 0.5 },
  { shape: { gaunt: 0.9, jaw: 0.28, nose: 0.028, width: 0.072, height: 0.124 }, skin: 'zombie', hair: 'short', hairColor: [70, 50, 30], beard: 0 },
  { shape: { gaunt: 0.6, jaw: 0.3, nose: 0.03, width: 0.076, beard: 0.6 }, skin: 'zombieGrey', hair: 'messy', hairColor: [26, 22, 18], beard: 0.9 },
  { shape: { gaunt: 1.1, jaw: 0.22, nose: 0.024, width: 0.07 }, skin: 'zombie', hair: 'long', hairColor: [96, 70, 40], beard: 0 },
  { shape: { gaunt: 0.8, jaw: 0.32, nose: 0.034, width: 0.077 }, skin: 'zombieGrey', hair: 'short', hairColor: [110, 104, 96], beard: 0.3 },
];

function earGeometry() {
  const parts = [];
  for (const s of [-1, 1]) {
    const e = new THREE.SphereGeometry(1, 10, 8); e.scale(0.0055, 0.028, 0.0175);
    const r = new THREE.TorusGeometry(0.02, 0.0034, 5, 14, Math.PI * 1.45); r.scale(1, 1.32, 1);
    r.rotateZ(-0.55); r.rotateY(s * Math.PI / 2); r.translate(s * 0.003, 0.002, -0.002);
    for (const g of [e, r]) {
      g.rotateZ(s * 0.06); g.rotateY(s * -0.28); g.rotateX(0.12);
      parts.push(g.toNonIndexed());
    }
  }
  for (const g of parts) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  return parts; // positioned per head by the caller
}

export class ZombieKit {
  constructor() {
    this.ready = false;
  }

  // Build everything once (a fraction of a second).
  build() {
    if (this.ready) return this;
    const R = rng(1234);
    this.goreMat = new THREE.MeshStandardMaterial({ color: '#4a0808', roughness: 0.45 });
    this.cavityMat = new THREE.MeshBasicMaterial({ color: '#140303' });
    this.teethMat = new THREE.MeshStandardMaterial({ color: '#a89c78', roughness: 0.5 });
    this.eyeMat = new THREE.MeshStandardMaterial({ map: irisTexture('#000', { zombie: true }), emissive: new THREE.Color(1, 0.55, 0.12), emissiveIntensity: 3, roughness: 0.2 });
    this.eyeMat.emissiveMap = this.eyeMat.map;
    this.skinMats = {
      zombie: new THREE.MeshStandardMaterial({ map: zombieSkinTex(SKIN.zombie, 3), roughness: 0.6 }),
      zombieGrey: new THREE.MeshStandardMaterial({ map: zombieSkinTex(SKIN.zombieGrey, 4), roughness: 0.6 }),
    };
    for (const m of Object.values(this.skinMats)) { m.bumpMap = m.map; m.bumpScale = 2; }

    // heads
    this.heads = HEADS.map((h, i) => this.buildHeadTemplate(h, i));

    // outfits
    this.outfits = OUTFITS.map((o, i) => {
      const torso = new THREE.MeshStandardMaterial({ map: torsoTex(o, 100 + i), roughness: 0.92 });
      torso.bumpMap = torso.map; torso.bumpScale = 2;
      const upper = new THREE.MeshStandardMaterial({ map: sleeveTex(o, 200 + i, false), roughness: 0.92 });
      const lower = new THREE.MeshStandardMaterial({ map: sleeveTex(o, 300 + i, true), roughness: 0.92 });
      const pants = new THREE.MeshStandardMaterial({ map: pantsTex(o, 400 + i), roughness: 0.92 });
      pants.bumpMap = pants.map; pants.bumpScale = 2;
      const shoes = new THREE.MeshStandardMaterial({ color: o.shoes, roughness: 0.55 });
      return { ...o, mats: { torso, upper, lower, pants, shoes } };
    });

    // body geometry (shared)
    this.geo = {
      torso: [
        torsoGeometry({ height: 0.56, shoulders: 0.2, chest: 0.155, waist: 0.13, hips: 0.152, depth: 0.1, build: 0.1, gaunt: 1 }),
        torsoGeometry({ height: 0.56, shoulders: 0.21, chest: 0.17, waist: 0.16, hips: 0.17, depth: 0.12, build: 0.5 }),
        torsoGeometry({ height: 0.55, shoulders: 0.205, chest: 0.162, waist: 0.145, hips: 0.16, depth: 0.108, build: 0.25, gaunt: 0.5 }),
      ],
      pelvis: loft([{ y: -0.14, rx: 0.15, rz: 0.1 }, { y: -0.05, rx: 0.165, rz: 0.105 }, { y: 0.05, rx: 0.16, rz: 0.1 }], { radial: 18 }),
      neck: neckGeometry(0.11, 0.05),
      upperArm: limb(0.3, 0.052, 0.042, { bulge: 0.1, bulgeAt: 0.35 }),
      sleeveShell: loft([{ y: -0.15, rx: 0.058, rz: 0.054 }, { y: -0.08, rx: 0.06, rz: 0.056 }, { y: 0.0, rx: 0.058, rz: 0.055 }, { y: 0.03, rx: 0.046, rz: 0.046 }], { radial: 14, capBottom: false, capTop: false }),
      foreArm: limb(0.27, 0.042, 0.032, { bulge: 0.12, bulgeAt: 0.25 }),
      hand: handGeometry({ curl: 0.35, claw: 1 }),
      thigh: limb(0.45, 0.085, 0.058, { bulge: 0.05, flat: 0.95 }),
      shin: limb(0.43, 0.058, 0.046, { bulge: 0.05, flat: 0.95 }),
      shoe: shoeGeometry({ length: 0.27, width: 0.1 }),
      stump: new THREE.CylinderGeometry(0.045, 0.05, 0.03, 10),
      neckStump: new THREE.CylinderGeometry(0.06, 0.07, 0.05, 10),
      shoulderCap: new THREE.SphereGeometry(0.056, 12, 8).scale(1, 0.8, 1),
    };
    this.ready = true;
    void R;
    return this;
  }

  buildHeadTemplate(h, i) {
    const hairStyle = h.hair;
    const look = {
      skin: SKIN[h.skin], hair: h.hairColor, beard: h.beard, stubble: 0.25, zombie: 1, blood: 1, seed: 50 + i * 7, size: 512,
      sideHair: hairStyle === 'bald' ? 0.0 : 1, brows: 0.7, lipColor: [70, 40, 44],
    };
    const shape = { ...h.shape, mouthOpen: 0.4 };
    const head = headGeometry(shape, { detail: 0.6, split: true });
    const p = head.params;
    const skinTex = headTexture(shape, look);
    const headMat = new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.6, bumpMap: skinTex, bumpScale: 1.5 });
    const plainMat = this.skinMats[h.skin];
    const group = new THREE.Group();
    group.add(new THREE.Mesh(head.skullGeometry, headMat));
    // jaw (hinged)
    const jaw = new THREE.Group(); jaw.name = 'jaw'; jaw.position.copy(head.hinge);
    jaw.add(new THREE.Mesh(head.jawGeometry, headMat));
    // teeth: upper row on the skull, lower row on the jaw
    const row = (y, dz, holes) => {
      const parts = [];
      for (let k = -3; k <= 3; k++) {
        if (holes.includes(k)) continue;
        const t = new THREE.BoxGeometry(0.0065, 0.009, 0.004);
        const a = k * 0.16;
        t.rotateY(a); t.translate(Math.sin(a) * 0.026, y, Math.cos(a) * 0.026 + 0.054 + dz);
        parts.push(t);
      }
      return mergeGeometries(parts);
    };
    group.add(new THREE.Mesh(row(-0.038, 0, [i % 3 - 1]), this.teethMat));
    const lowerTeeth = new THREE.Mesh(row(-0.054, -0.002, [((i + 1) % 4) - 2]), this.teethMat);
    lowerTeeth.position.set(-head.hinge.x, -head.hinge.y, -head.hinge.z);
    jaw.add(lowerTeeth);
    group.add(jaw);
    const cav = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), this.cavityMat);
    cav.scale.set(1.1, 0.85, 0.9); cav.position.set(0, -0.05, 0.05); group.add(cav);
    // eyes + lids + ears merged
    const eyeParts = [], plainParts = [];
    for (const s of [-1, 1]) {
      const th = s * p.eyeSpread * 0.92;
      const sp = head.surface(th, p.eyeHeight);
      const c = sp.clone().add(new THREE.Vector3(-Math.sin(th) * 0.0072, 0, -Math.cos(th) * 0.0072));
      const e = new THREE.SphereGeometry(0.0118, 12, 10); e.translate(c.x, c.y, c.z); eyeParts.push(e);
      const up = new THREE.SphereGeometry(0.0128, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); up.rotateX(-0.2); up.translate(c.x, c.y, c.z);
      const lo = new THREE.SphereGeometry(0.0128, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); lo.rotateX(Math.PI + 0.9); lo.translate(c.x, c.y, c.z);
      plainParts.push(up.toNonIndexed(), lo.toNonIndexed());
    }
    const ears = earGeometry();
    ears.forEach((g, k) => { const s = k < 2 ? -1 : 1; const ep = head.surface(s * 1.55, 0); g.translate(ep.x - s * 0.002, ep.y - 0.004, ep.z - 0.012); plainParts.push(g); });
    for (const g of plainParts) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const eyes = new THREE.Mesh(mergeGeometries(eyeParts), this.eyeMat); eyes.name = 'eyes';
    group.add(eyes);
    group.add(new THREE.Mesh(mergeGeometries(plainParts), plainMat));
    if (hairStyle === 'messy' || hairStyle === 'long') {
      const hg = hairGeometry(head, { seed: 20 + i, count: hairStyle === 'long' ? 160 : 120, length: hairStyle === 'long' ? 1.5 : 0.8, sweep: (i % 2 ? 1 : -1) * 0.3, messy: 2.5, detail: 0.5 });
      const ht = hairTexture(h.hairColor);
      group.add(new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ map: ht, roughness: 0.75, side: THREE.DoubleSide })));
    } else if (hairStyle === 'short') {
      const hg = hairGeometry(head, { seed: 30 + i, count: 0, length: 0.3, sweep: 0, messy: 0, detail: 0.5 });
      const ht = hairTexture(h.hairColor);
      group.add(new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ map: ht, roughness: 0.8 })));
    }
    return { group, skin: h.skin };
  }

  // A complete zombie body on the same rig the animation code expects.
  assemble(r, { scale = 1 } = {}) {
    this.build();
    const G = this.geo;
    const outfit = this.outfits[Math.floor(r(2) * this.outfits.length)];
    const H = this.heads[Math.floor(r(1) * this.heads.length)];
    const skin = this.skinMats[H.skin];
    const M = outfit.mats;
    const mk = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
    mk(G.pelvis, outfit.top === 'overalls' || outfit.top === 'uniform' ? M.torso : M.pants, hips);
    const torso = new THREE.Group(); torso.position.y = 0.1; hips.add(torso);
    const tg = G.torso[Math.floor(r(3) * G.torso.length)];
    mk(tg, M.torso, torso, 0, -0.03, 0);
    const neck = new THREE.Group(); neck.position.set(0, 0.52, 0.01); torso.add(neck);
    mk(G.neck, skin, neck, 0, -0.02, 0);
    const head = new THREE.Group(); head.position.y = 0.08; neck.add(head);
    const hg = H.group.clone();
    hg.position.set(0, 0.1, 0.01);
    head.add(hg);
    const jaw = hg.getObjectByName('jaw');
    const eyes = [hg.getObjectByName('eyes')];
    const neckStump = mk(G.neckStump, this.goreMat, neck, 0, 0.02, 0); neckStump.visible = false;

    const arm = (side) => {
      const shoulder = new THREE.Group(); shoulder.position.set(side * 0.215, 0.44, 0); torso.add(shoulder);
      mk(G.shoulderCap, outfit.sleeve === 'long' ? M.upper : M.torso, shoulder);
      mk(G.upperArm, outfit.sleeve === 'long' ? M.upper : skin, shoulder);
      if (outfit.sleeve === 'short') mk(G.sleeveShell, M.torso, shoulder);
      const elbow = new THREE.Group(); elbow.position.y = -0.3; shoulder.add(elbow);
      mk(G.foreArm, outfit.sleeve === 'long' ? M.lower : skin, elbow);
      const hand = mk(G.hand, skin, elbow, 0, -0.27, 0);
      hand.rotation.y = side * -Math.PI / 2 * 0.9; hand.scale.x = side;
      const stump = mk(G.stump, this.goreMat, shoulder, 0, -0.3, 0); stump.visible = false;
      return { shoulder, elbow, stump };
    };
    const leg = (side) => {
      const hip = new THREE.Group(); hip.position.set(side * 0.095, -0.02, 0); hips.add(hip);
      mk(G.thigh, M.pants, hip);
      const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
      mk(G.shin, M.pants, knee);
      mk(G.shoe, M.shoes, knee, 0, -0.49, 0.005);
      const stump = mk(G.stump, this.goreMat, hip, 0, -0.44, 0); stump.visible = false;
      return { hip, knee, stump };
    };
    const armL = arm(1), armR = arm(-1), legL = leg(1), legR = leg(-1);
    root.scale.setScalar(scale);
    return { root, body, hips, torso, neck, head, jaw, eyes, neckStump, armL, armR, legL, legR, skinMat: skin, shirtMat: M.torso };
  }
}

// One kit shared by every world (school, firing range).
export const zombieKit = new ZombieKit();
