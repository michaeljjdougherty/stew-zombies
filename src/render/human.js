// =============================================================================
// Procedural people. Heads are sculpted from a dense sphere with a set of
// soft "clay" operations (jaw, cheekbones, brow, eye sockets, nose, lips,
// chin), then painted with a canvas texture in the same coordinates (skin,
// beard, brows, lips). Bodies are lofted from elliptical cross-sections.
// Used for the playable characters (Kearns) and, roughened up, the zombies.
//
// Conventions: a head faces +Z, Y up, units are metres. Sculpt features are
// placed with (theta, h): theta = angle round the head from the nose
// (+ is the character's left / screen right when facing him), h = height
// from -1 (chin) to +1 (crown).
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gauss = (th, h, t0, h0, st, sh) => Math.exp(-(((th - t0) / st) ** 2) - (((h - h0) / sh) ** 2));

// --- seeded random ------------------------------------------------------------
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// =============================================================================
// HEAD SCULPT
// =============================================================================
export const HEAD_DEFAULTS = {
  width: 0.073,       // half-widths in metres
  height: 0.12,
  depth: 0.098,
  jaw: 0.3,           // how much the jaw narrows toward the chin (defined jaw = higher)
  jawAngle: 0.6,      // where the jaw turns in (0..1 down the face)
  cheeks: 0.07,       // broad cheeks
  cheekbones: 0.005,
  brow: 0.008,        // brow ridge
  browHeight: 0.235,
  sockets: 0.009,     // eye socket depth
  eyeHeight: 0.13,
  eyeSpread: 0.33,
  nose: 0.03,         // nose length out from the face
  noseWidth: 0.065,
  noseBridge: 0.006,
  lips: 1,
  smirk: 0,           // raises one mouth corner (+ = his left)
  chin: 0.008,
  beard: 0,           // adds a little volume where the beard is
  gaunt: 0,           // zombies: hollow cheeks and temples
  mouthOpen: 0,       // zombies: sag the mouth
  forehead: 0,        // makes the cranium taller (P's famous forehead)
  smile: 0,           // lifts both mouth corners, puffs the cheeks
  grin: 0,            // opens the smile to show teeth (painted)
  browRaise: 0,       // raises one eyebrow (+ = his left)
  browRaiseBoth: 0,   // raises both eyebrows
  browThick: 1,
  hairlineRaise: 0,   // pushes the front hairline up
  hairSquare: 0,      // straight, squared-off hairline (buzz cuts)
  recede: 0,          // recession at the temples
  beardLine: 0,       // moves the beard's cheek line (negative = tighter)
};

// How far the mouth line lifts at angle th (smirk on one side, smile on both).
export function mouthLift(th, p) {
  let l = 0;
  if (p.smirk) l += p.smirk * 0.06 * smooth(0, 0.24, th * Math.sign(p.smirk));
  if (p.smile) l += p.smile * 0.05 * smooth(0.03, 0.24, Math.abs(th));
  return l;
}
// Half-height of the open mouth (in h units) for a toothy grin.
export function mouthOpening(th, p) {
  if (!p.grin) return 0;
  const w = 0.19 + p.smile * 0.04 + p.grin * 0.03;
  const k = 1 - (th / w) ** 2;
  return k > 0 ? p.grin * 0.055 * Math.sqrt(k) : 0;
}

// Where the scalp hair starts, by angle round the head (piecewise linear):
// a widow's-peak-free front, slightly receding temples, down in front of the
// ears to the sideburns, over the ears, and down the back to the nape.
const HAIRLINE = [[0, 0.5], [0.3, 0.52], [0.6, 0.56], [0.95, 0.38], [1.2, 0.24], [1.36, 0.06], [1.5, 0.2], [1.75, 0.22], [2.0, -0.1], [2.5, -0.42], [Math.PI, -0.5]];
export function hairline(th, p = null) {
  const a = Math.abs(th);
  let h = HAIRLINE[HAIRLINE.length - 1][1];
  for (let i = 1; i < HAIRLINE.length; i++) {
    const [a1, h1] = HAIRLINE[i];
    if (a <= a1) { const [a0, h0] = HAIRLINE[i - 1]; h = h0 + (h1 - h0) * ((a - a0) / (a1 - a0)); break; }
  }
  if (!p) return h;
  if (p.hairSquare && a < 1.08) h = h * (1 - p.hairSquare) + 0.47 * p.hairSquare;
  if (p.hairlineRaise) h += p.hairlineRaise * (1 - smooth(0.85, 1.3, a));
  if (p.recede) h += p.recede * gauss(a, 0, 0.75, 0, 0.22, 1);
  return h;
}

// Masks in (theta, h) space, shared by sculpt and paint.
export const masks = {
  beard(th, h, p) {
    const a = Math.abs(th);
    // upper edge climbs from the mouth up the cheek to a sideburn by the ear
    const edge = -0.235 - 0.07 * smooth(0.22, 0.55, a) + (0.2 + (p.beardLine || 0)) * smooth(0.6, 1.15, a) + 0.26 * smooth(1.12, 1.36, a);
    const inside = smooth(edge + 0.03, edge - 0.05, h);
    const behind = 1 - smooth(1.4, 1.55, a);          // stops at the ear
    const neck = smooth(-1.25, -0.95, h);             // fades under the chin
    const lipGap = 1 - 0.85 * gauss(th, h, 0, -0.39, 0.28, 0.045); // lips stay clear
    const mouthGap = 1 - gauss(th, h, 0, -0.33, 0.24, 0.02) * 0.6;
    const cheekGap = 1;
    return inside * behind * neck * lipGap * mouthGap * cheekGap;
  },
  mustache(th, h) {
    return gauss(th, h, 0, -0.275, 0.3, 0.045) * (1 - smooth(0.26, 0.4, Math.abs(th))) + 0;
  },
  brows(th, h, p) {
    const a = Math.abs(th);
    let y0 = p.browHeight - 0.035 + (a - 0.3) * 0.05;
    // raised brow arches up in the middle
    const raise = (p.browRaiseBoth || 0) + ((p.browRaise || 0) * Math.sign(th) > 0 ? Math.abs(p.browRaise) : 0);
    if (raise) y0 += raise * (0.06 + 0.05 * Math.sin(smooth(0.06, 0.5, a) * Math.PI));
    const t = p.browThick || 1;
    return smooth(0.06, 0.12, a) * (1 - smooth(0.42 + 0.03 * (t - 1), 0.5 + 0.03 * (t - 1), a)) * gauss(0, h, 0, y0, 1, 0.035 * t);
  },
  lips(th, h, p) {
    const lift = mouthLift(th, p), open = mouthOpening(th, p);
    const w = 0.21 + (p.smile || 0) * 0.04 + (p.grin || 0) * 0.03;
    return (1 - smooth(w - 0.04, w + 0.04, Math.abs(th))) * (gauss(0, h, 0, -0.35 + lift, 1, 0.03) + gauss(0, h, 0, -0.415 + lift * 0.6 - open * 1.6, 1, 0.035));
  },
};

// Distance-based falloff along the nasolabial fold (nose wing -> past the mouth corner).
function foldLine(a, h) {
  const ax = 0.2, ay = -0.15, bx = 0.31, by = -0.4;
  const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((a - ax) * vx + (h - ay) * vy) / (vx * vx + vy * vy)));
  const dx = a - (ax + vx * t), dy = h - (ay + vy * t);
  return Math.exp(-(dx * dx + dy * dy) / (0.022 * 0.022)) * (0.4 + 0.6 * Math.sin(t * Math.PI * 0.9 + 0.2));
}

function sculpt(d, p) {
  // d: unit direction. Returns a displaced point.
  const th = Math.atan2(d.x, d.z);
  const h = d.y;
  const front = smooth(-0.1, 0.5, d.z);
  let X = d.x * p.width, Y = d.y * p.height, Z = d.z * p.depth;

  // jaw: narrows below the cheekbones, then cuts in at the jaw angle
  const s1 = smooth(-0.05, -p.jawAngle, h), s2 = smooth(-p.jawAngle, -1, h);
  X *= 1 - 0.1 * s1 - p.jaw * s2;
  // broad cheeks
  X *= 1 + p.cheeks * gauss(0, h, 0, -0.18, 1, 0.22) * smooth(0.2, 0.7, Math.abs(d.x));
  // the face is flatter than the back of the skull
  if (d.z > 0) Z = Z * (0.88 + 0.12 * (1 - front)) + 0.008 * front;
  else Z *= 1.0 + 0.03 * smooth(0.6, 0.0, h) - 0.06 * smooth(-0.2, -0.8, h);
  // forehead slopes back toward the crown, the back of the head is fuller
  Z -= 0.018 * smooth(0.35, 1, h) * front;
  if (h > 0.5) X *= 1 - 0.05 * smooth(0.5, 1, h);
  // chin juts a touch
  Z += p.chin * gauss(th, h, 0, -0.8, 0.3, 0.14);
  // under the chin: pull the bottom back toward the neck
  Y += 0.012 * smooth(-0.7, -1, h) * front;
  // a taller cranium, bulging forward a little at the brow
  if (p.forehead) {
    // stretch everything above the brow upward (keeps the dome round)
    const yb = (p.browHeight + 0.02) * p.height;
    if (Y > yb) {
      const k = smooth(p.browHeight + 0.02, p.browHeight + 0.3, h);
      Y = yb + (Y - yb) * (1 + p.forehead * k);
      X *= 1 + p.forehead * 0.06 * k;
      Z *= 1 + p.forehead * 0.05 * k;
    }
    Z += p.forehead * 0.01 * front * gauss(0, h, 0, 0.55, 1, 0.25);
  }

  // --- features (pushed out along the face)
  let n = 0;
  const side = th >= 0 ? 1 : -1;
  n += p.brow * gauss(Math.abs(th), h, p.eyeSpread * 0.95, p.browHeight, 0.3, 0.07);
  n += p.brow * 0.5 * gauss(th, h, 0, p.browHeight - 0.02, 0.2, 0.06);
  n -= p.sockets * gauss(Math.abs(th), h, p.eyeSpread, p.eyeHeight, 0.17, 0.085);
  n += p.noseBridge * gauss(th, h, 0, 0.1, 0.07, 0.12);
  // nose: grows out from the bridge to the tip, wings flare at the bottom
  const noseP = p.nose * smooth(0.14, -0.13, h) * (1 - smooth(-0.13, -0.21, h));
  const noseW = p.noseWidth + 0.06 * smooth(-0.02, -0.16, h);
  n += noseP * Math.exp(-((th / noseW) ** 2));
  n += 0.004 * gauss(Math.abs(th), h, 0.13, -0.16, 0.05, 0.04);           // nostril wings
  n += p.nose * 0.07 * gauss(th, h, 0, -0.14, 0.06, 0.05);                 // rounded tip
  n -= 0.0022 * gauss(Math.abs(th), h, 0.175, -0.13, 0.025, 0.06);          // crease round the wings
  n -= 0.0008 * gauss(Math.abs(th), h, 0.05, -0.205, 0.02, 0.014);         // nostrils (from below)
  // smile lines from the nose down to the mouth corners
  if (p.smile > 0 && !p.gaunt) n -= 0.0018 * Math.min(1.2, p.smile) * foldLine(Math.abs(th), h);
  n -= 0.003 * gauss(th, h, 0, -0.23, 0.06, 0.03);                         // philtrum
  n += p.cheekbones * gauss(Math.abs(th), h, 0.6, 0.0, 0.22, 0.12);
  n -= p.gaunt * 0.012 * gauss(Math.abs(th), h, 0.75, -0.25, 0.25, 0.16);  // hollow cheeks
  n -= p.gaunt * 0.008 * gauss(Math.abs(th), h, 1.15, 0.35, 0.2, 0.2);     // sunken temples
  n -= p.gaunt * 0.006 * gauss(Math.abs(th), h, p.eyeSpread, p.eyeHeight, 0.2, 0.1);
  // mouth: lips, the line between them, corners; a smirk lifts one side
  const lift = mouthLift(th, p);
  const my = -0.375 + lift - p.mouthOpen * 0.05;
  if (p.smile) n += p.smile * 0.005 * gauss(Math.abs(th), h, 0.42, -0.2, 0.18, 0.12);      // apple cheeks
  if (p.grin) n -= 0.007 * gauss(th, h, 0, my - mouthOpening(th, p) * 0.7, 0.2, 0.03 + p.grin * 0.03) * Math.min(1, p.grin);
  n += 0.007 * p.lips * gauss(th, h, 0, my + 0.035, 0.22, 0.035);
  n += 0.008 * p.lips * gauss(th, h, 0, my - 0.045, 0.2, 0.04);
  n -= 0.004 * gauss(th, h, 0, my, 0.25, 0.013 + p.mouthOpen * 0.03);
  n -= 0.0025 * gauss(th, h, side * 0.27, my + lift * 0.3, 0.05, 0.05);    // corners / dimple
  if (p.smirk) n -= 0.002 * Math.abs(p.smirk) * gauss(th, h, Math.sign(p.smirk) * 0.33, my + 0.06, 0.06, 0.06);
  n += 0.004 * gauss(th, h, 0, -0.62, 0.25, 0.08);                         // mentalis
  // beard volume
  if (p.beard) n += p.beard * 0.004 * masks.beard(th, h, p);

  // push along the horizontal face normal (mostly +Z at the front)
  const nx = Math.sin(th), nz = Math.cos(th);
  return new THREE.Vector3(X + nx * n, Y, Z + nz * n);
}

// UVs: u = angle round the head, starting at his right ear (theta = -90°),
// so the nose is at u = 0.25 and the seam hides by the ear; v = height.
export function headUV(th, h) { let a = th + Math.PI / 2; if (a < 0) a += Math.PI * 2; return [a / (2 * Math.PI), (h + 1) / 2]; }
export function uvToTheta(u) { let th = u * 2 * Math.PI - Math.PI / 2; if (th > Math.PI) th -= Math.PI * 2; return th; }

const headCache = new Map();
export function headGeometry(params = {}, { detail = 1, split = false } = {}) {
  const p = { ...HEAD_DEFAULTS, ...params };
  const key = JSON.stringify([p, detail, split]);
  if (headCache.has(key)) return headCache.get(key);
  const ws = Math.round(96 * detail), hs = Math.round(72 * detail);
  const g = new THREE.SphereGeometry(1, ws, hs);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    const v = sculpt(d, p);
    pos.setXYZ(i, v.x, v.y, v.z);
    uv.setXY(i, uv.getX(i), (d.y + 1) / 2);
  }
  g.computeVertexNormals();
  let out = { geometry: g, params: p };
  if (split) out = { ...out, ...splitJaw(g, p) };
  out.surface = (th, h) => sculpt(new THREE.Vector3(Math.sin(th) * Math.sqrt(1 - h * h), h, Math.cos(th) * Math.sqrt(1 - h * h)).normalize(), p);
  headCache.set(key, out);
  return out;
}

// Zombies: cut the lower jaw off into its own mesh so it can hang open.
function splitJaw(g, p) {
  const src = g.toNonIndexed();
  const pos = src.attributes.position, nor = src.attributes.normal, uv = src.attributes.uv;
  const skull = { p: [], n: [], u: [] }, jaw = { p: [], n: [], u: [] };
  const hinge = new THREE.Vector3(0, -0.025, -0.01);
  for (let t = 0; t < pos.count; t += 3) {
    let cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { cy += pos.getY(t + k); cz += pos.getZ(t + k); }
    cy /= 3; cz /= 3;
    const mouthY = -0.375 * p.height - 0.004;
    const isJaw = cy < mouthY + (cz < 0.02 ? (0.02 - cz) * -1.2 : 0) && cz > -0.035;
    const dst = isJaw ? jaw : skull;
    for (let k = 0; k < 3; k++) {
      dst.p.push(pos.getX(t + k), pos.getY(t + k) - (isJaw ? hinge.y : 0), pos.getZ(t + k) - (isJaw ? hinge.z : 0));
      dst.n.push(nor.getX(t + k), nor.getY(t + k), nor.getZ(t + k));
      dst.u.push(uv.getX(t + k), uv.getY(t + k));
    }
  }
  const mk = (o) => {
    const b = new THREE.BufferGeometry();
    b.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3));
    b.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3));
    b.setAttribute('uv', new THREE.Float32BufferAttribute(o.u, 2));
    return b;
  };
  return { skullGeometry: mk(skull), jawGeometry: mk(jaw), hinge };
}

// =============================================================================
// HEAD TEXTURE
// =============================================================================
export const SKIN = {
  light: { base: [222, 182, 156], shade: [176, 120, 98], blush: [214, 120, 104] },
  tan: { base: [196, 150, 112], shade: [150, 100, 72], blush: [196, 108, 86] },
  dark: { base: [128, 88, 62], shade: [90, 58, 40], blush: [140, 70, 52] },
  warm: { base: [226, 180, 150], shade: [178, 122, 96], blush: [220, 122, 104] },
  rosy: { base: [232, 182, 160], shade: [182, 124, 104], blush: [226, 112, 104] },
  olive: { base: [208, 168, 128], shade: [156, 116, 84], blush: [204, 124, 96] },
  oliveLight: { base: [216, 176, 138], shade: [164, 122, 90], blush: [208, 128, 102] },
  tanWarm: { base: [212, 164, 126], shade: [160, 112, 82], blush: [206, 116, 92] },
  flushed: { base: [230, 178, 154], shade: [180, 120, 100], blush: [228, 108, 100] },
  fairPink: { base: [240, 196, 180], shade: [192, 138, 124], blush: [236, 120, 118] },
  zombie: { base: [146, 150, 124], shade: [92, 96, 74], blush: [120, 74, 66] },
  zombieGrey: { base: [158, 152, 140], shade: [100, 94, 86], blush: [110, 70, 64] },
};

// Paint a head texture. The painter walks every texel, turns it back into
// (theta, h) and asks the masks what goes there.
export function headTexture(params = {}, look = {}) {
  const p = { ...HEAD_DEFAULTS, ...params };
  const L = {
    skin: SKIN.light, hair: [44, 30, 20], beard: 0, brows: 1, lipColor: [150, 86, 78],
    stubble: 0.15, hairline: 0.5, sideHair: 1, zombie: 0, blood: 0, seed: 7, size: 512, ...look,
  };
  const S = L.size;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const D = img.data;
  const R = rng(L.seed);
  // roughness + fine relief: oily T-zone and lips shine, beard and brows are matte
  const rc = document.createElement('canvas');
  rc.width = rc.height = S >> 1;
  const rg = rc.getContext('2d');
  const rimg = rg.createImageData(S >> 1, S >> 1);
  const RD = rimg.data;
  // low-frequency blotch noise
  const blot = new Float32Array(64 * 64);
  for (let i = 0; i < blot.length; i++) blot[i] = R();
  const noise2 = (u, v) => {
    const x = u * 63, y = v * 63, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const a = blot[(yi % 64) * 64 + (xi % 64)], b = blot[(yi % 64) * 64 + ((xi + 1) % 64)];
    const cc = blot[((yi + 1) % 64) * 64 + (xi % 64)], dd = blot[((yi + 1) % 64) * 64 + ((xi + 1) % 64)];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + dd * fx) * fy;
  };
  for (let y = 0; y < S; y++) {
    const h = ((S - 1 - y) / (S - 1)) * 2 - 1;     // canvas top = crown
    for (let x = 0; x < S; x++) {
      const th = uvToTheta(x / (S - 1));
      const a = Math.abs(th);
      const nz = noise2(x / S * 3, y / S * 3), fine = R();
      // skin
      let r = L.skin.base[0], gg = L.skin.base[1], b = L.skin.base[2];
      const shadeK = 0.18 * smooth(0.4, 1.6, a) + 0.25 * gauss(a, h, p.eyeSpread, p.eyeHeight, 0.2, 0.1) + 0.12 * smooth(-0.6, -1, h);
      r += (L.skin.shade[0] - r) * shadeK; gg += (L.skin.shade[1] - gg) * shadeK; b += (L.skin.shade[2] - b) * shadeK;
      // warmth on the cheeks, nose and ears
      const blush = (0.35 * gauss(a, h, 0.55, -0.1, 0.25, 0.15) + 0.4 * gauss(th, h, 0, -0.08, 0.1, 0.08) + 0.3 * gauss(a, h, 1.57, 0.05, 0.15, 0.15)) * (L.blush ?? 1);
      r += (L.skin.blush[0] - r) * blush * 0.5; gg += (L.skin.blush[1] - gg) * blush * 0.5; b += (L.skin.blush[2] - b) * blush * 0.5;
      // pores and blotches
      const v = (nz - 0.5) * 18 + (fine - 0.5) * 8;
      r += v; gg += v * 0.9; b += v * 0.85;
      // lips, a little lighter in the middle of the lower lip
      const lip = masks.lips(th, h, p);
      r += (L.lipColor[0] - r) * lip * 0.75; gg += (L.lipColor[1] - gg) * lip * 0.75; b += (L.lipColor[2] - b) * lip * 0.75;
      const lipHi = lip * gauss(th, h, 0, -0.42 + mouthLift(th, p) * 0.6 - mouthOpening(th, p) * 1.6, 0.1, 0.02);
      r += 18 * lipHi; gg += 12 * lipHi; b += 12 * lipHi;
      // nostrils and the shadow under the nose
      const nos = gauss(a, h, 0.05, -0.198, 0.018, 0.008) * (L.zombie ? 0.5 : 1);
      r *= 1 - nos * 0.3; gg *= 1 - nos * 0.36; b *= 1 - nos * 0.34;
      const underNose = gauss(th, h, 0, -0.23, 0.1, 0.02) * 0.05;
      r *= 1 - underNose; gg *= 1 - underNose; b *= 1 - underNose;
      // smile lines
      if (p.smile > 0 && !L.zombie) { const f = foldLine(a, h) * Math.min(1, p.smile) * 0.09; r *= 1 - f; gg *= 1 - f * 1.1; b *= 1 - f * 1.1; }
      // the line where the lips meet
      const lift = mouthLift(th, p);
      const my = -0.377 + lift - p.mouthOpen * 0.05;
      const mw = 0.21 + (p.smile || 0) * 0.04 + (p.grin || 0) * 0.03;
      const mline = gauss(th, 0, 0, 0, mw, 1) * gauss(0, h, 0, my, 1, 0.008 + p.mouthOpen * 0.03);
      r *= 1 - mline * 0.6; gg *= 1 - mline * 0.65; b *= 1 - mline * 0.65;
      // toothy grin: upper teeth, then the dark of the mouth
      const op = mouthOpening(th, p);
      if (op > 0 && h < my + 0.006 && h > my - op * 2) {
        const depth = (my + 0.006 - h) / (op * 2 + 0.006);
        if (depth < 0.55) {
          const gap = Math.abs(((th + 0.5) * 34) % 1 - 0.5) < 0.06 ? 0.7 : 1;
          const tk = (1 - smooth(0.35, 0.55, depth)) * gap;
          r = 236 * tk + 70 * (1 - tk); gg = 230 * tk + 22 * (1 - tk); b = 214 * tk + 22 * (1 - tk);
          const shade = smooth(0.12, 0.3, Math.abs(th)); r *= 1 - shade * 0.35; gg *= 1 - shade * 0.35; b *= 1 - shade * 0.3;
        } else { r = 58; gg = 16; b = 18; }
      }
      // stubble shadow + beard
      const bm = masks.beard(th, h, p);
      const stub = L.stubble * smooth(0, 1, bm * 1.6) * (0.85 + 0.3 * nz);
      if (stub > 0) {
        if (L.stubbleColor) { const sc = L.stubbleColor, k = stub * 0.45 * (fine > 0.4 ? 1 : 0.4); r += (sc[0] - r) * k; gg += (sc[1] - gg) * k; b += (sc[2] - b) * k; }
        else {
          // speckled shadow of short dark hairs
          const hc = L.hair, k = stub * (fine > 0.45 ? 0.55 : 0.3);
          r += (hc[0] * 1.6 + 20 - r) * k; gg += (hc[1] * 1.6 + 20 - gg) * k; b += (hc[2] * 1.6 + 24 - b) * k;
        }
      }
      if (L.beard > 0) {
        const chin = (L.chinPatch || 0) * gauss(th, h, 0, -0.62, 0.12, 0.14);
        const m = Math.min(1, (bm + masks.mustache(th, h) * 0.95) * L.beard + chin);
        const strand = (fine > 0.22 ? 1 : 0.7) * (0.85 + 0.3 * nz);
        const k = Math.min(1, m * strand * 1.3);
        r += (L.hair[0] - r) * k; gg += (L.hair[1] - gg) * k; b += (L.hair[2] - b) * k;
      }
      // eyebrows: thick, dark, straight and low
      if (L.brows > 0) {
        const bw = masks.brows(th, h, p) * L.brows;
        const k = Math.min(1, bw * (fine > 0.25 ? 1.2 : 0.6));
        const bc = L.browColor || L.hair;
        r += (bc[0] - r) * k; gg += (bc[1] - gg) * k; b += (bc[2] - b) * k;
      }
      // scalp hair (short sides and back; the top is geometry)
      if (L.sideHair > 0) {
        const hl = hairline(th, p) + (nz - 0.5) * 0.03;
        const k = smooth(hl - 0.015, hl + 0.035, h) * L.sideHair;
        const strand = 0.75 + 0.25 * (fine > 0.5 ? 1 : 0) + (nz - 0.5) * 0.3;
        if (k > 0) {
          const kk = Math.min(1, k * strand);
          r += (L.hair[0] * 0.9 - r) * kk; gg += (L.hair[1] * 0.9 - gg) * kk; b += (L.hair[2] * 0.9 - b) * kk;
        }
      }
      // zombies: veins, rot, bruising, dried blood round the mouth
      if (L.zombie > 0) {
        const rot = smooth(0.55, 0.85, nz) * L.zombie;
        r += (70 - r) * rot * 0.6; gg += (78 - gg) * rot * 0.6; b += (52 - b) * rot * 0.6;
        const bruise = gauss(a, h, p.eyeSpread, p.eyeHeight - 0.02, 0.22, 0.12) * L.zombie;
        r += (60 - r) * bruise * 0.7; gg += (36 - gg) * bruise * 0.7; b += (48 - b) * bruise * 0.7;
        const mouthBlood = gauss(th, h, 0, -0.5, 0.35, 0.22) * smooth(0.3, 0.7, noise2(x / S * 7, y / S * 9)) * L.blood;
        r += (70 - r) * mouthBlood; gg += (6 - gg) * mouthBlood; b += (6 - b) * mouthBlood;
      }
      const i = (y * S + x) * 4;
      D[i] = Math.max(0, Math.min(255, r)); D[i + 1] = Math.max(0, Math.min(255, gg)); D[i + 2] = Math.max(0, Math.min(255, b)); D[i + 3] = 255;
      if (!(x & 1) && !(y & 1)) {
        // roughness (green channel, as three.js reads it); fine pores in red for relief
        const tz = gauss(th, h, 0, 0.3, 0.22, 0.35) + gauss(th, h, 0, -0.1, 0.09, 0.12);
        const hairy = Math.min(1, (L.beard > 0 ? bm * L.beard : 0) + masks.brows(th, h, p) * 1.5 + (L.sideHair > 0 ? smooth(hairline(th, p) - 0.01, hairline(th, p) + 0.04, h) : 0));
        let rough = 0.66 - 0.14 * Math.min(1, tz) - 0.22 * lip + 0.24 * hairy + (fine - 0.5) * 0.06;
        if (L.zombie) rough = 0.78 + (fine - 0.5) * 0.1;
        const j = ((y >> 1) * (S >> 1) + (x >> 1)) * 4;
        const pore = 128 + (fine - 0.5) * 70 * (1 - hairy * 0.5) + (hairy > 0.3 ? (R() - 0.5) * 120 : 0);
        RD[j] = Math.max(0, Math.min(255, pore)); RD[j + 1] = Math.max(0, Math.min(255, rough * 255)); RD[j + 2] = 0; RD[j + 3] = 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
  // zombies: veins and gashes drawn on top
  if (L.zombie > 0) {
    g.globalAlpha = 0.35;
    g.strokeStyle = '#2a2638';
    for (let k = 0; k < 18; k++) {
      let x = R() * S, y = S * (0.3 + R() * 0.5);
      g.lineWidth = 0.6 + R();
      g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 6; j++) { x += (R() - 0.5) * 14; y += (R() - 0.3) * 10; g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
    for (let k = 0; k < 2 + Math.floor(R() * 3); k++) {
      const x = S * (0.25 + R() * 0.5), y = S * (0.25 + R() * 0.5), w = 6 + R() * 18, hh = 2 + R() * 4;
      g.save(); g.translate(x, y); g.rotate(R() * 3);
      g.fillStyle = '#3a0806'; g.beginPath(); g.ellipse(0, 0, w, hh, 0, 0, 7); g.fill();
      g.fillStyle = '#6a1410'; g.beginPath(); g.ellipse(0, 0, w * 0.7, hh * 0.45, 0, 0, 7); g.fill();
      g.restore();
    }
  }
  rg.putImageData(rimg, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const rt = new THREE.CanvasTexture(rc);
  rt.anisotropy = 4;
  t.userData.detailMap = rt;   // roughness in G, pore relief in R
  return t;
}

// Eye: white, coloured iris, pupil, a glint. zombie = glowing.
export function irisTexture(color = '#5a3e22', { zombie = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  // sphere UV: u around, v pole-to-pole; the front of the eye is at u=0.75
  g.fillStyle = zombie ? '#c8b880' : '#e2dbd0'; g.fillRect(0, 0, 128, 128);
  const cx = 32, cy = 64;
  if (!zombie) {
    g.strokeStyle = 'rgba(160,60,50,0.25)'; g.lineWidth = 0.6;
    for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(cx + 40 * Math.cos(i), cy + 40 * Math.sin(i)); g.lineTo(cx + 18 * Math.cos(i + 0.2), cy + 18 * Math.sin(i + 0.2)); g.stroke(); }
  }
  const ir = zombie ? 1 : 0.8;
  const grd = g.createRadialGradient(cx, cy, 2, cx, cy, 15 * ir);
  grd.addColorStop(0, zombie ? '#fff2a0' : '#1a120a');
  grd.addColorStop(0.32, zombie ? '#ffb020' : color);
  grd.addColorStop(0.85, zombie ? '#ff6a00' : color);
  grd.addColorStop(1, zombie ? '#7a2a00' : '#1c140c');
  g.fillStyle = grd; g.beginPath(); g.ellipse(cx, cy, 14 * ir, 20 * ir, 0, 0, 7); g.fill();
  if (!zombie) {
    // fibres radiating from the pupil, lighter round the pupil, a dark ring at the edge
    const base = new THREE.Color(color);
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + Math.sin(i * 7.3) * 0.05, l = 0.5 + 0.5 * Math.abs(Math.sin(i * 12.9));
      g.strokeStyle = `rgba(${Math.round(base.r * 255 * 1.6)},${Math.round(base.g * 255 * 1.5)},${Math.round(base.b * 255 * 1.4)},${0.25 * l})`;
      g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * 4.5, cy + Math.sin(a) * 6.3); g.lineTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 14.4); g.stroke();
    }
    g.strokeStyle = 'rgba(20,14,10,0.75)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(cx, cy, 10.8, 15.6, 0, 0, 7); g.stroke();
    g.fillStyle = '#060404'; g.beginPath(); g.ellipse(cx, cy, 4.2, 6, 0, 0, 7); g.fill();
    // catchlight
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(cx - 3.4, cy - 5, 1.8, 2.6, 0, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// =============================================================================
// HAIR: a cap (painted on the head) plus clumps for volume on top.
// style: 'quiff' = short sides, longer textured top swept up and to one side
// =============================================================================
export function taperedTube(points, r0, r1, radial = 5, segs = 7, round = false) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const P = curve.getPointAt(t);
    const N = frames.normals[i], B = frames.binormals[i];
    const r = r0 + (r1 - r0) * t ** 0.8;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      // flattened ribbon-ish cross-section
      const cx = Math.cos(a) * r * (round ? 1 : 1.5), cy = Math.sin(a) * r * (round ? 1 : 0.6);
      pos.push(P.x + N.x * cx + B.x * cy, P.y + N.y * cx + B.y * cy, P.z + N.z * cx + B.z * cy);
      uv.push(j / radial, t);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Hair volume: a shell over the scalp, thicker on top; outside the hair
// region it tucks under the skin. o: { length, volume, flow, part }.
function hairThickness(th, h, o, p) {
  const a = Math.abs(th);
  const hl = hairline(th, p);
  const earZone = smooth(1.28, 1.4, a) * (1 - smooth(1.78, 1.92, a));
  const region = smooth(hl - 0.01, hl + 0.09, h) * (1 - earZone * (1 - smooth(0.16, 0.28, h)));
  if (region < 0.01) return -0.006;
  const topK = smooth(0.15, 0.75, h) * (1 - smooth(1.0, 2.4, a));
  const front = Math.max(0, Math.cos(th)) * smooth(0.45, 0.78, h);
  const lean = o.flow.x ? 0.5 + 0.5 * Math.tanh(th * 1.5 * Math.sign(o.flow.x) * -1) : 0.5; // fuller on the side it goes to
  const t = 0.0028 + (topK * (0.011 + 0.011 * lean) * o.length + front * 0.007 * o.length) * o.volume + o.sides * 0.004 * (1 - topK);
  return t * region - 0.006 * (1 - region);
}

// Hair styles. flow: the way the hair is brushed (head space: +x his left,
// +y up, +z forward). curls: curly clumps. fringe: hair falling forward over
// the forehead. volume: thickness of the top. sides: thickness of the sides.
export const HAIR_STYLES = {
  quiff: { flow: [-0.8, 0.6, 0.15], volume: 1, sides: 0, count: 380, length: 1.3, messy: 1 },
  sweptBack: { flow: [0, 0.55, -1], volume: 1.1, sides: 0.3, count: 360, length: 1.4, messy: 1.2 },
  wavyBack: { flow: [0.15, 0.5, -1], volume: 1.35, sides: 0.4, count: 380, length: 1.6, messy: 1.6, waves: 1 },
  slicked: { flow: [0, 0.15, -1], volume: 0.45, sides: 0.15, count: 260, length: 1.6, messy: 0.15 },
  sidePart: { flow: [-0.35, 0.2, -1], volume: 0.6, sides: 0, count: 300, length: 1.5, messy: 0.25, strays: 6 },
  pushedUp: { flow: [0.1, 0.9, -0.8], volume: 1.3, sides: 0.2, count: 360, length: 1.5, messy: 1.3, strays: 10 },
  cropped: { flow: [0, 0.35, -1], volume: 0.75, sides: 0.1, count: 260, length: 0.8, messy: 0.3 },
  buzz: { flow: [0, 0.4, -1], volume: 0.05, sides: 0.0, count: 0, length: 0.3, messy: 0 },
  curlyFringe: { flow: [0, -0.6, 1], volume: 1.4, sides: 0.3, count: 300, length: 1.3, messy: 1.4, curls: 1, fringe: 1 },
  curlyTop: { flow: [0, 0.6, -0.3], volume: 1.25, sides: 0.05, count: 300, length: 1.0, messy: 1.1, curls: 1, forelock: 1 },
  wildCurls: { flow: [0, 0.8, -0.7], volume: 1.7, sides: 0.5, count: 380, length: 1.5, messy: 1.6, curls: 1, strays: 8 },
};

export function hairGeometry(head, opt = {}) {
  const st = { ...(HAIR_STYLES[opt.style] || HAIR_STYLES.quiff), ...opt };
  const { seed = 3, detail = 1 } = st;
  const length = st.length ?? 1, messy = st.messy ?? 1;
  const flow = new THREE.Vector3(...st.flow);
  if (st.sweep != null && !opt.style) flow.x = -0.8 * st.sweep;
  const o = { length, volume: st.volume ?? 1, sides: st.sides ?? 0, flow };
  const count = Math.round((st.count ?? 340) * (opt.countScale ?? 1));
  const R = rng(seed);
  const p = head.params;
  // --- shell
  const shell = new THREE.SphereGeometry(1, Math.round(80 * detail), Math.round(60 * detail), 0, Math.PI * 2, 0, Math.PI * 0.9);
  const pos = shell.attributes.position, uv = shell.attributes.uv;
  const d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    const th = Math.atan2(d.x, d.z), h = d.y;
    const base = sculpt(d, p);
    const t = hairThickness(th, h, o, p);
    // the front lifts up and over in the direction it's brushed
    const lift = Math.max(0, t - 0.006) * 0.25 * Math.max(0, Math.cos(th)) * smooth(0.5, 0.85, h);
    const n = base.clone().normalize();
    base.addScaledVector(n, t);
    base.y += lift * Math.max(0, flow.y);
    base.x += lift * 1.5 * flow.x;
    if (st.waves) base.addScaledVector(n, Math.max(0, t - 0.004) * 0.25 * Math.sin(th * 9 + h * 14));
    pos.setXYZ(i, base.x, base.y, base.z);
    uv.setXY(i, uv.getX(i) * 6, (h + 1) * 2);
  }
  shell.computeVertexNormals();
  const parts = [shell.toNonIndexed()];
  // --- clumps: each one walks over the scalp from its root, so strands lie
  // on the head instead of sticking out (curls coil round the path)
  const surfAt = (dd, extra = 0) => {
    const th = Math.atan2(dd.x, dd.z);
    const t = Math.max(0.002, hairThickness(th, dd.y, o, p));
    return sculpt(dd, p).addScaledVector(dd, t * 0.85 + extra);
  };
  const addClump = (th, hr, lenK = 1, fringe = false) => {
    const dir = new THREE.Vector3(Math.sin(th) * Math.sqrt(1 - hr * hr), hr, Math.cos(th) * Math.sqrt(1 - hr * hr)).normalize();
    const t0 = hairThickness(th, hr, o, p);
    if (t0 < 0.004 && !fringe) return;
    const front = Math.max(0, Math.cos(th)) * smooth(0.5, 0.8, hr);
    const len = (0.026 + R() * 0.03 + front * 0.02) * length * lenK;
    let fl = flow.clone();
    if ((st.fringe && front > 0.2) || fringe) fl = new THREE.Vector3((R() - 0.5) * 0.5, -1, 0.35);
    const tang = new THREE.Vector3(fl.x + (R() - 0.5) * 0.8 * messy, fl.y + (R() - 0.5) * 0.3 * messy, fl.z + (R() - 0.5) * 0.4 * messy);
    const d = dir.clone();
    const steps = st.curls ? 12 : 5, seg = len / steps;
    const lift = 0.002 + front * 0.006 * Math.max(0, flow.y) * (fringe ? 0 : 1);
    const pts = [surfAt(d, -0.004)];
    const curlR = 0.0045 + R() * 0.003, turns = 1.4 + R() * 0.8, ph = R() * 6.28;
    for (let k = 1; k <= steps; k++) {
      tang.addScaledVector(d, -tang.dot(d)).normalize();
      d.addScaledVector(tang, seg / 0.1).normalize();
      const f = k / steps;
      const P = surfAt(d, lift * Math.sin(f * Math.PI) + (st.curls ? 0.004 : 0) + R() * 0.0015 * messy);
      if (st.curls) {
        const side = new THREE.Vector3().crossVectors(d, tang).normalize();
        const a = ph + f * turns * Math.PI * 2;
        P.addScaledVector(side, Math.sin(a) * curlR).addScaledVector(d, (Math.cos(a) + 1) * curlR * 0.7);
      }
      pts.push(P);
    }
    parts.push(taperedTube(pts, (st.curls ? 0.0046 : 0.0042) + R() * 0.0022, st.curls ? 0.0018 : 0.0007, 4, st.curls ? 16 : 8).toNonIndexed());
  };
  for (let i = 0; i < count; i++) {
    const th = (R() - 0.5) * 2 * (R() < 0.7 ? 1.1 : 2.2);
    addClump(th, 0.5 + R() * 0.45);
  }
  // a curl or two dropping onto the forehead
  if (st.forelock) for (let i = 0; i < 4; i++) addClump(0.12 + (R() - 0.5) * 0.2, hairline(0.1, p) + 0.1 + R() * 0.05, 0.8, true);
  // loose strands near the front edge
  for (let i = 0; i < (st.strays || 0); i++) {
    const th = (R() < 0.5 ? -1 : 1) * (0.3 + R() * 0.7);
    addClump(th, hairline(th, p) + 0.1 + R() * 0.08, 0.6, R() < 0.35);
  }
  for (const g of parts) { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k); }
  return mergeGeometries(parts);
}

export function hairTexture(color = [44, 30, 20]) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = `rgb(${color.join(',')})`; g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 64, l = 0.6 + Math.random() * 0.8;
    g.strokeStyle = `rgba(${Math.round(color[0] * l * 1.4)},${Math.round(color[1] * l * 1.4)},${Math.round(color[2] * l * 1.4)},0.6)`;
    g.lineWidth = 0.6 + Math.random();
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 6, 128); g.stroke();
  }
  // darker at the roots
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.45)'); grd.addColorStop(0.4, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// =============================================================================
// Assemble a head group.
// =============================================================================
export function buildHead(opts = {}) {
  const {
    shape = {}, look = {}, hair = null, eyeColor = '#4a3420', zombie = false, squint = 0, detail = 1,
    skinMaterial = null, hairColor = [44, 30, 20],
  } = opts;
  const head = headGeometry(shape, { detail, split: zombie });
  const p = head.params;
  const group = new THREE.Group();
  let skinMat = skinMaterial;
  if (!skinMat) {
    const map = headTexture(shape, { hair: hairColor, ...look });
    const dm = map.userData.detailMap;
    skinMat = new THREE.MeshStandardMaterial({ map, roughness: 1, roughnessMap: dm, bumpMap: dm, bumpScale: 0.35 });
  }
  skinMat.userData.skin = true;
  let jaw = null;
  if (zombie) {
    group.add(new THREE.Mesh(head.skullGeometry, skinMat));
    jaw = new THREE.Group();
    jaw.position.copy(head.hinge);
    jaw.add(new THREE.Mesh(head.jawGeometry, skinMat));
    group.add(jaw);
    // mouth cavity and teeth so an open jaw shows a mouth, not a hole
    const cav = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 8), new THREE.MeshBasicMaterial({ color: '#160404' }));
    cav.scale.set(1.1, 0.8, 0.9); cav.position.set(0, -0.048, 0.052); group.add(cav);
    const teethMat = new THREE.MeshStandardMaterial({ color: '#b8ae8c', roughness: 0.5 });
    const teeth = (y, parent, dz = 0) => {
      for (let i = -3; i <= 3; i++) {
        if (Math.random() < 0.18) continue;
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.0065, 0.009, 0.004), teethMat);
        const a = i * 0.16;
        t.position.set(Math.sin(a) * 0.026, y, Math.cos(a) * 0.026 + 0.054 + dz);
        t.rotation.y = a;
        parent.add(t);
      }
    };
    teeth(-0.038, group);
    const jt = new THREE.Group(); jt.position.set(-head.hinge.x, -head.hinge.y, -head.hinge.z); jaw.add(jt);
    teeth(-0.054, jt, -0.002);
  } else {
    group.add(new THREE.Mesh(head.geometry, skinMat));
  }
  // plain skin for lids and ears (the head texture is laid out for the head)
  const sk = (look.skin || SKIN.light).base;
  const lidMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(`rgb(${Math.round(sk[0] * 0.86)},${Math.round(sk[1] * 0.78)},${Math.round(sk[2] * 0.76)})`), roughness: 0.6 });
  if (zombie) lidMat.color.multiplyScalar(0.8);
  // eyes
  const eyeMat = zombie
    ? new THREE.MeshStandardMaterial({ map: irisTexture(eyeColor, { zombie }), roughness: 0.15, emissive: new THREE.Color(1, 0.55, 0.1), emissiveIntensity: 2.5 })
    : new THREE.MeshPhysicalMaterial({ map: irisTexture(eyeColor), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 });
  if (zombie) eyeMat.emissiveMap = eyeMat.map;
  const eyeR = zombie ? 0.0118 : 0.0125;
  const eyeGeo = new THREE.SphereGeometry(eyeR, 24, 18);
  const lidGeo = new THREE.SphereGeometry(eyeR + 0.001, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const lashGeo = new THREE.TorusGeometry(eyeR + 0.001, 0.0009, 4, 28);
  const lashMat = new THREE.MeshStandardMaterial({ color: '#1a120c', roughness: 0.9 });
  const eyes = [];
  for (const s of [-1, 1]) {
    const th = s * p.eyeSpread * 0.92, hh = p.eyeHeight;
    const surfP = head.surface(th, hh);
    const e = new THREE.Group();
    const sink = zombie ? 0.0072 : 0.0068;
    e.position.copy(surfP).add(new THREE.Vector3(-Math.sin(th) * sink, 0, -Math.cos(th) * sink));
    e.rotation.y = th * 0.35;
    const ball = new THREE.Mesh(eyeGeo, eyeMat);
    e.add(ball);
    // lids: the upper one drops for a squint, the lower one rises a little
    const upper = new THREE.Mesh(lidGeo, lidMat);
    upper.rotation.x = zombie ? -0.5 + squint * 0.42 + 0.12 : -0.66 + squint * 0.3;
    e.userData = { ball, upper, lower: null, upperRest: upper.rotation.x };
    const lash = new THREE.Mesh(lashGeo, lashMat); lash.rotation.x = Math.PI / 2;
    upper.add(lash);
    e.add(upper);
    const lower = new THREE.Mesh(lidGeo, lidMat);
    lower.rotation.x = zombie ? Math.PI + 0.78 - squint * 0.3 : Math.PI + 0.86 - squint * 0.2;
    e.add(lower);
    e.userData.lower = lower; e.userData.lowerRest = lower.rotation.x;
    group.add(e);
    eyes.push(e);
  }
  // ears: a flat shell with a rolled rim (helix) and a darker bowl
  const earMat = lidMat.clone(); earMat.color.multiply(new THREE.Color(1.0, 0.9, 0.88));
  const earGeo = new THREE.SphereGeometry(1, 14, 10); earGeo.scale(0.0055, 0.028, 0.0175);
  const rimGeo = new THREE.TorusGeometry(0.02, 0.0034, 6, 18, Math.PI * 1.45); rimGeo.scale(1, 1.32, 1);
  const bowlGeo = new THREE.SphereGeometry(1, 10, 8); bowlGeo.scale(0.004, 0.012, 0.009);
  const bowlMat = new THREE.MeshStandardMaterial({ color: '#7a4434', roughness: 0.85 });
  const ears = [];
  for (const s of [-1, 1]) {
    const ep = head.surface(s * 1.55, 0.0);
    const ear = new THREE.Group();
    ears.push(ear);
    ear.position.set(ep.x - s * 0.002, ep.y - 0.004, ep.z - 0.012);
    ear.rotation.set(0.12, s * -0.28, s * 0.06);
    ear.add(new THREE.Mesh(earGeo, earMat));
    const rim = new THREE.Mesh(rimGeo, earMat);
    rim.rotation.set(0, s * Math.PI / 2, -0.55); rim.position.set(s * 0.003, 0.002, -0.002);
    ear.add(rim);
    const bowl = new THREE.Mesh(bowlGeo, bowlMat); bowl.position.set(s * 0.004, -0.004, 0.003);
    ear.add(bowl);
    group.add(ear);
  }
  // hair
  let hairMesh = null;
  if (hair) {
    const hg = hairGeometry(head, hair);
    const ht = hairTexture(hairColor);
    const hm = new THREE.MeshStandardMaterial({ map: ht, bumpMap: ht, bumpScale: 2, roughness: 0.58, metalness: 0.0, side: THREE.DoubleSide });
    hairMesh = new THREE.Mesh(hg, hm);
    group.add(hairMesh);
  }
  return { group, jaw, eyes, skinMat, head, hairMesh, ears };
}

// =============================================================================
// BODY: lofted limbs and torsos from elliptical cross-sections.
// sections: [{ y, rx, rz, x?, z? }] bottom to top. UVs: u round, v along.
// =============================================================================
export function loft(sections, { radial = 16, capTop = true, capBottom = true, skip = null } = {}) {
  const pos = [], uv = [], idx = [];
  const n = sections.length;
  for (let i = 0; i < n; i++) {
    const s = sections[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      // front of the body (+Z) at u = 0.5. sq > 2 squares the section off (superellipse).
      let sa = Math.sin(a), ca = Math.cos(a);
      if (s.sq) { const e = 2 / s.sq; sa = Math.sign(sa) * Math.abs(sa) ** e; ca = Math.sign(ca) * Math.abs(ca) ** e; }
      const x = sa * s.rx * (s.sx ? (Math.sin(a) > 0 ? s.sx[1] : s.sx[0]) : 1);
      const z = -ca * s.rz * (s.sz ? (Math.cos(a) < 0 ? s.sz[1] : s.sz[0]) : 1);
      pos.push(x + (s.x || 0), s.y, z + (s.z || 0));
      uv.push(j / radial, i / (n - 1));
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    if (skip && skip(i, j)) continue;
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const addCap = (i, up) => {
    const s = sections[i];
    const c = pos.length / 3;
    pos.push(s.x || 0, s.y + (up ? 0.003 : -0.003), s.z || 0);
    uv.push(0.5, up ? 1 : 0);
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      if (up) idx.push(a, c, a + 1); else idx.push(a, a + 1, c);
    }
  };
  if (capTop) addCap(n - 1, true);
  if (capBottom) addCap(0, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A limb hanging down from its joint (y = 0 at the joint, -len at the end).
export function limb(len, r0, r1, { bulge = 0.12, bulgeAt = 0.3, flat = 0.85, radial = 14, steps = 8, front = 0 } = {}) {
  const secs = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = far end, 1 = joint
    const r = r1 + (r0 - r1) * t;
    const b = 1 + bulge * Math.exp(-((((1 - t) - bulgeAt) / 0.22) ** 2));
    const round = 1 - 0.25 * (Math.min(t, 1 - t) < 0.08 ? 0 : 0);
    secs.push({ y: -len * (1 - t), rx: r * b * round, rz: r * b * flat, z: front * Math.sin(t * Math.PI) });
  }
  return loft(secs, { radial });
}

// Torso from pelvis (y=0) to the base of the neck. build: 0 slim .. 1 heavy.
// torsoSections() is shared with clothing layers (jackets) that sit over it.
export function torsoSections({ height = 0.56, shoulders = 0.205, chest = 0.165, waist = 0.142, hips = 0.165, depth = 0.11, build = 0.3, gaunt = 0, belly = 0 } = {}) {
  const b = 1 + build * 0.15;
  const S = (t, rx, rz, z = 0) => ({ y: t * height, rx: rx * b, rz: rz * b, z });
  return [
    S(-0.18, hips * 0.92, depth * 0.95, 0.0),
    S(0.0, hips, depth, 0.0),
    S(0.2, waist * 1.02, depth * (0.95 + belly * 0.2), 0.004 + belly * 0.012),
    S(0.38, waist, depth * (0.93 - gaunt * 0.15 + belly * 0.18), 0.008 + belly * 0.012),
    S(0.58, chest, depth * 1.08, 0.012),
    S(0.74, chest * 1.06, depth * 1.12, 0.012),
    S(0.86, shoulders, depth * 1.0, 0.0),
    S(0.94, shoulders * 0.86, depth * 0.85, -0.006),
    S(1.0, 0.07, 0.06, -0.004),
  ];
}
export function torsoGeometry(opts = {}) {
  return loft(torsoSections(opts), { radial: 22 });
}

export function neckGeometry(len = 0.11, r = 0.052) {
  return loft([
    { y: 0, rx: r * 1.2, rz: r * 1.05 },
    { y: len * 0.5, rx: r, rz: r * 0.95, z: 0.004 },
    { y: len, rx: r * 0.92, rz: r * 0.9, z: 0.01 },
  ], { radial: 14 });
}

// A hand: palm, four fingers and a thumb, relaxed curl. Hangs down from the wrist.
export function handGeometry({ curl = 0.5, size = 1, claw = 0, curls = null, thumb = null, spread = null } = {}) {
  const parts = [];
  const palm = new THREE.SphereGeometry(1, 12, 8);
  palm.scale(0.042 * size, 0.05 * size, 0.017 * size);
  palm.translate(0, -0.045 * size, 0);
  parts.push(palm);
  for (let f = 0; f < 4; f++) {
    const x = (f - 1.5) * 0.019 * size;
    const L = [0.042, 0.048, 0.045, 0.036][f] * size * (1 + claw * 0.15);
    let p = new THREE.Vector3(x, -0.088 * size, 0.003);
    const c = curls ? curls[f] : curl;
    let a = c < 0.05 ? 0.05 : 0.25 + c * 0.45;
    const pts = [p.clone()];
    for (let k = 0; k < 3; k++) {
      const seg = L / 3;
      p = p.clone().add(new THREE.Vector3(spread ? spread[f] * seg : 0, -Math.cos(a) * seg, Math.sin(a) * seg));
      pts.push(p);
      a += c < 0.05 ? 0.04 : 0.35 + c * 0.5 + claw * 0.3;
    }
    parts.push(taperedTube(pts, 0.0085 * size, 0.0068 * size, 7, 7, true));
  }
  // thumb on the index-finger side (-x); thumb = 1 tucks it across the palm
  const tk = thumb ?? 0;
  const tp = [new THREE.Vector3(-0.03 * size, -0.03 * size, 0.008), new THREE.Vector3((-0.046 + tk * 0.03) * size, -0.055 * size, (0.022 + tk * 0.01) * size), new THREE.Vector3((-0.048 + tk * 0.05) * size, (-0.075 + tk * 0.01) * size, (0.034 + tk * 0.004) * size)];
  parts.push(taperedTube(tp, 0.0102 * size, 0.0078 * size, 7, 7, true));
  // taperedTube flattens its cross-section; round the fingers back out
  return mergeGeometries(parts.map((g) => g.index ? g.toNonIndexed() : g).map((g) => { g.deleteAttribute('uv'); return g; }));
}

// Sneaker / shoe pointing +Z, sole at y = 0, ankle at the origin's top.
export function shoeGeometry({ length = 0.27, width = 0.1, boot = false } = {}) {
  const secs = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n; // heel -> toe
    const z = -0.06 + t * length;
    const h = (boot ? 0.13 : 0.1) * (1 - smooth(0.4, 1, t) * 0.5);
    const w = width * (0.42 + 0.58 * Math.sin(Math.min(1, t * 1.25 + 0.15) * Math.PI * 0.85));
    secs.push({ y: z, rx: w / 2, rz: h / 2, z: -h / 2 });
  }
  const g = loft(secs, { radial: 14 });
  // loft runs along +Y; turn it so it runs heel-to-toe along +Z, sole at y=0
  g.rotateX(Math.PI / 2);
  return g;
}
