// =============================================================================
// Characters: Stew (the crew) and Erik. Every one is built in code from the
// sculpting kit in src/render/human.js, from the data in CHARACTERS below:
// body proportions, face, hair, outfit layers, accessories and idle style.
// The rig matches the zombies' (hips > torso > neck > head, shoulders >
// elbows > wrists, hips > knees > ankles) so the same animation code can
// drive them later.
// =============================================================================
import * as THREE from 'three';
import { buildHead, torsoSections, loft, neckGeometry, limb, shoeGeometry, SKIN, rng } from './human.js';
import { buildHand } from './hands.js';
export { idleCharacter, idleKearns, setGesture } from './characterAnim.js';

export const SHIRT_COLORS = {
  navy: { name: 'Navy', hex: '#26324c' },
  sage: { name: 'Sage', hex: '#7e8f72' },
  blue: { name: 'Blue', hex: '#47689a' },
  pink: { name: 'Dusty pink', hex: '#c09092' },
};

const BROWN = [50, 33, 21], DARK = [24, 19, 16];
const EYES_BROWN = '#3a2616';

// Body: height = overall scale; torso widths in metres (see torsoSections);
// limbs = arm/leg thickness; armsOut = how far the arms hang from the body.
export const CHARACTERS = {
  kearns: {
    name: 'Kearns', playable: true,
    blurb: 'Mid-twenties. Knows something you don\'t, and he\'s enjoying it.',
    height: 1.0, headScale: 1.08,
    body: { shoulders: 0.2, chest: 0.158, waist: 0.138, hips: 0.158, depth: 0.105, build: 0.15 }, limbs: 1,
    skin: 'light',
    face: { smirk: 0.8, beard: 1, cheeks: 0.08, jaw: 0.3 },
    look: { beard: 1, stubble: 0.3 }, squint: 0.65, eyes: '#4a3520',
    hair: { style: 'quiff', color: [46, 31, 20] },
    top: { type: 'tee', color: 'shirt' }, pants: 'jeans', shoes: 'sneaker',
    idle: 'relaxed', gesture: 'beard',
  },
  ryan: {
    name: 'Ryan', blurb: 'Big, laid-back, and ready to throw down. Wandered in from a night out.',
    height: 1.0, headScale: 1.1,
    body: { shoulders: 0.222, chest: 0.185, waist: 0.178, hips: 0.178, depth: 0.13, build: 0.4, belly: 0.6 }, limbs: 1.17, armsOut: 0.17,
    skin: 'tanWarm',
    face: { width: 0.081, height: 0.118, depth: 0.1, cheeks: 0.14, jaw: 0.2, jawAngle: 0.62, smile: 0.55, beard: 1.2 },
    look: { beard: 0.95, stubble: 0.3 }, squint: 0.62,
    hair: { style: 'wavyBack', color: [52, 34, 22] },
    top: { type: 'tee', color: '#e9e7e1' },
    layer: { type: 'zip', color: '#18181b' },
    pants: 'darkJeans', shoes: 'sneaker',
    chain: { metal: 'gold', drop: 0.075 },
    idle: 'big', gesture: 'fistPalm',
  },
  rocco: {
    name: 'Rocco', blurb: 'A pint-sized troublemaker dressed like a mob boss.',
    height: 0.84, headScale: 1.16,
    body: { shoulders: 0.205, chest: 0.168, waist: 0.158, hips: 0.162, depth: 0.118, build: 0.3 }, limbs: 1.06, armsOut: 0.14,
    skin: 'oliveLight',
    face: { width: 0.073, height: 0.12, smirk: 0.75, browRaiseBoth: 0.35, browThick: 1.45, beard: 0.7 },
    look: { beard: 0.9, stubble: 0.2, chinPatch: 0.6 }, beardLine: -0.06, squint: 0.25,
    hair: { style: 'slicked', color: [20, 16, 14] },
    top: { type: 'suit', color: '#141417', shirt: '#ecebe6', tie: '#0b0b0c' },
    pants: 'suit', shoes: 'dress',
    earrings: true,
    watch: { side: 'left', kind: 'silver' },
    bracelet: { side: 'left', colors: ['#c9ccd0', '#c9ccd0'], chunky: true },
    idle: 'goofy', gesture: 'fingerGuns',
  },
  pit: {
    name: 'Pit', blurb: 'Laid-back and easygoing. Always looks like he just got to the party.',
    height: 1.04, headScale: 1.06,
    body: { shoulders: 0.182, chest: 0.142, waist: 0.126, hips: 0.146, depth: 0.094, build: 0 }, limbs: 0.86, armsOut: 0.09,
    skin: 'flushed',
    face: { width: 0.066, height: 0.137, depth: 0.1, nose: 0.045, noseWidth: 0.072, noseBridge: 0.009, jaw: 0.22, jawAngle: 0.52, chin: 0.013, smirk: 0.35 },
    look: { stubble: 0.4 }, squint: 0.66, eyes: '#6f7a40',
    hair: { style: 'curlyFringe', color: [62, 40, 26] },
    top: { type: 'tee', color: '#d78f7c', print: 'vintage' },
    layer: { type: 'sherpa', color: '#c9ae88' },
    pants: 'jeans', shoes: 'sneaker',
    chain: { metal: 'silver', drop: 0.06 },
    idle: 'lanky', gesture: 'headScratch',
  },
  chops: {
    name: 'Chops', blurb: 'Big, confident and friendly. Always at the best table on the patio.',
    height: 1.11, headScale: 1.06,
    body: { shoulders: 0.228, chest: 0.18, waist: 0.165, hips: 0.17, depth: 0.122, build: 0.35, belly: 0.25 }, limbs: 1.12, armsOut: 0.15,
    skin: 'warm',
    face: { width: 0.084, height: 0.121, depth: 0.1, jaw: 0.1, jawAngle: 0.78, cheeks: 0.15, smile: 0.6, beard: 0.8, browThick: 1.3, hairSquare: 1 },
    look: { beard: 0.9, stubble: 0.3 }, beardLine: -0.09, squint: 0.42,
    hair: { style: 'buzz', color: [48, 33, 22] },
    top: { type: 'tank', color: '#efeee9' },
    layer: { type: 'camp', color: '#22304a', short: true },
    pants: 'chinos', shoes: 'sneaker',
    watch: { side: 'left', kind: 'smart' },
    idle: 'big', gesture: 'thumbsUp',
  },
  brian: {
    name: 'Brian', blurb: 'Always the one smiling, even mid-zombie apocalypse.',
    height: 1.0, headScale: 1.06,
    body: { shoulders: 0.188, chest: 0.147, waist: 0.13, hips: 0.15, depth: 0.098, build: 0.05 }, limbs: 0.9, armsOut: 0.1,
    skin: 'warm',
    face: { width: 0.071, height: 0.121, cheekbones: 0.014, cheeks: 0.06, smile: 1.0, grin: 0.75, browHeight: 0.25, nose: 0.024, noseBridge: 0.003 },
    look: { stubble: 0.04 }, squint: 1.05,
    hair: { style: 'sidePart', color: [22, 18, 16] },
    top: { type: 'tee', color: '#ecebe6' },
    layer: { type: 'canvas', color: '#a8794a', collar: '#5a3a22', zipTo: 0.55 },
    pants: 'lightJeans', shoes: 'sneaker',
    idle: 'cheerful', gesture: 'wave',
  },
  regs: {
    name: 'Regs', blurb: 'A big, lovable teddy bear. Everyone\'s best buddy.',
    height: 1.07, headScale: 1.08,
    body: { shoulders: 0.24, chest: 0.192, waist: 0.172, hips: 0.176, depth: 0.13, build: 0.45, belly: 0.2 }, limbs: 1.22, armsOut: 0.19,
    skin: 'warm',
    face: { width: 0.084, height: 0.124, depth: 0.1, jaw: 0.14, jawAngle: 0.75, cheeks: 0.15, smile: 1.1, grin: 0.85, beard: 0.8, browThick: 1.25 },
    look: { beard: 0.95, stubble: 0.3 }, beardLine: -0.04, squint: 0.85,
    hair: { style: 'pushedUp', color: [54, 36, 24] },
    top: { type: 'tee', color: '#151517', print: 'varsity' },
    pants: 'darkJeans', shoes: 'sneaker',
    chain: { metal: 'gold', drop: 0.2, cross: true },
    idle: 'big', gesture: 'thumbsUp',
  },
  zach: {
    name: 'Zach', blurb: 'Cheerful and friendly. Always genuinely happy to be there.',
    height: 1.0, headScale: 1.08,
    body: { shoulders: 0.212, chest: 0.172, waist: 0.163, hips: 0.168, depth: 0.122, build: 0.3, belly: 0.25 }, limbs: 1.08, armsOut: 0.14,
    skin: 'rosy',
    face: { width: 0.082, height: 0.119, cheeks: 0.16, jaw: 0.18, smile: 1.0, grin: 0.7, browThick: 1.2 },
    look: { stubble: 0.3 }, squint: 0.6,
    hair: { style: 'curlyTop', color: [20, 16, 14] },
    top: { type: 'tee', color: '#151517' },
    layer: { type: 'flannel', color: '#3e4044', check: '#24262a' },
    pants: 'darkJeans', shoes: 'whiteSneaker',
    idle: 'cheerful', gesture: 'clap',
  },
  p: {
    name: 'P', blurb: 'Too cool for school. His forehead enters the room before he does.',
    height: 1.0, headScale: 1.08,
    body: { shoulders: 0.207, chest: 0.165, waist: 0.148, hips: 0.162, depth: 0.112, build: 0.25 }, limbs: 1.02, armsOut: 0.12,
    skin: 'olive',
    face: { width: 0.074, height: 0.12, forehead: 0.75, hairlineRaise: 0.2, recede: 0.08, jaw: 0.34, chin: 0.012, smirk: 0.6, browRaise: 0.55, browThick: 1.4 },
    look: { stubble: 0.45 }, squint: 0.3,
    hair: { style: 'cropped', color: [52, 36, 24] },
    top: { type: 'tee', color: '#22304e' },
    pants: 'darkJeans', shoes: 'sneaker',
    chain: { metal: 'gold', drop: 0.06 },
    bracelet: { side: 'right', colors: ['#1a1a1c', '#c9ccd0'], chunky: true },
    idle: 'peace',
  },
  erik: {
    name: 'Erik Madsen', villain: true, blurb: 'Number 8. Cut from the team before the championship. Sold his soul to The Schnitz.',
    height: 1.0, headScale: 1.12,
    body: { shoulders: 0.205, chest: 0.162, waist: 0.15, hips: 0.162, depth: 0.11, build: 0.2 }, limbs: 1, armsOut: 0.12,
    skin: 'fairPink', blush: 1.6,
    face: { width: 0.082, height: 0.118, cheeks: 0.16, jaw: 0.2, smile: 1.4, grin: 1.75, browRaiseBoth: 0.3 },
    look: { stubble: 0.3, stubbleColor: [214, 168, 118], browColor: [196, 154, 104] }, squint: -0.4, eyes: '#7f95a8',
    hair: { style: 'wildCurls', color: [196, 126, 76] },
    top: { type: 'suit', color: '#0e0e10', shirt: '#f2f1ec', bow: true },
    pants: 'suit', shoes: 'dress',
    idle: 'manic',
  },
};

// The order they stand in for the lineup (Erik apart, at the end).
export const LINEUP = ['chops', 'regs', 'ryan', 'kearns', 'p', 'zach', 'brian', 'pit', 'rocco', 'erik'];

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
const mix = (a, b, k) => { const c = new THREE.Color(a).lerp(new THREE.Color(b), k); return '#' + c.getHexString(); };

function fabricNoise(g, W, H, R, amt = 0.08) {
  for (let i = 0; i < W * H / 6; i++) {
    g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${amt})` : `rgba(255,255,255,${amt * 0.7})`;
    g.fillRect(R() * W, R() * H, 1, 2);
  }
}
function folds(g, W, H, R, n = 26, k = 1) {
  for (let i = 0; i < n; i++) {
    const u = R(), y0 = H * (0.25 + R() * 0.5);
    const grd = g.createLinearGradient(u * W - 10, 0, u * W + 10, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, `rgba(0,0,0,${(0.06 + R() * 0.08) * k})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(u * W, y0); g.rotate((R() - 0.5) * 0.9); g.fillStyle = grd; g.fillRect(-12, -40 - R() * 50, 24, 80 + R() * 60); g.restore();
  }
}
function sideShade(g, W, H, a = 0.25) {
  const side = g.createLinearGradient(0, 0, W, 0);
  side.addColorStop(0, `rgba(0,0,0,${a})`); side.addColorStop(0.25, `rgba(0,0,0,${a * 0.3})`); side.addColorStop(0.5, 'rgba(0,0,0,0)');
  side.addColorStop(0.75, `rgba(0,0,0,${a * 0.3})`); side.addColorStop(1, `rgba(0,0,0,${a})`);
  g.fillStyle = side; g.fillRect(0, 0, W, H);
}
function denim(g, x0, y0, w, h, R, light = false) {
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  g.strokeStyle = light ? 'rgba(230,240,255,0.18)' : 'rgba(160,180,210,0.12)'; g.lineWidth = 1;
  for (let k = -h; k < w; k += 3) { g.beginPath(); g.moveTo(x0 + k, y0 + h); g.lineTo(x0 + k + h, y0); g.stroke(); }
  for (let i = 0; i < w * h / 40; i++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,10,0.12)' : 'rgba(200,210,230,0.08)'; g.fillRect(x0 + R() * w, y0 + R() * h, 2, 1); }
  g.restore();
}

const PANTS = {
  jeans: { color: '#3a4a66', denim: true },
  darkJeans: { color: '#232c40', denim: true },
  lightJeans: { color: '#7e9cc2', denim: true, light: true },
  chinos: { color: '#b4b3ae' },
  suit: { color: '#131315' },
};

// Varsity block letters across the chest (Regs).
function varsityPrint(g, cx, cy, W) {
  g.save();
  g.font = `900 ${W * 0.11}px "Arial Black", Impact, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = W * 0.022; g.strokeStyle = '#c6aef0'; g.strokeText('STEW', cx, cy);
  g.fillStyle = '#5a2a92'; g.fillText('STEW', cx, cy);
  g.font = `900 ${W * 0.06}px "Arial Black", Impact, sans-serif`;
  g.lineWidth = W * 0.012; g.strokeText('16', cx, cy + W * 0.1); g.fillText('16', cx, cy + W * 0.1);
  g.restore();
}
// A faded white vintage logo (Pit).
function vintagePrint(g, cx, cy, W, R) {
  g.save();
  g.globalAlpha = 0.78;
  g.strokeStyle = '#f4ece4'; g.fillStyle = '#f4ece4'; g.lineWidth = W * 0.008;
  g.beginPath(); g.arc(cx, cy, W * 0.07, 0, 7); g.stroke();
  // sun over waves
  g.beginPath(); g.arc(cx, cy + W * 0.012, W * 0.03, Math.PI, 0); g.fill();
  for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(cx - W * 0.05, cy + W * (0.026 + k * 0.014)); for (let x = -0.05; x <= 0.05; x += 0.01) g.lineTo(cx + W * x, cy + W * (0.026 + k * 0.014) + Math.sin(x * 120) * W * 0.004); g.stroke(); }
  g.font = `700 ${W * 0.026}px Georgia, serif`; g.textAlign = 'center';
  g.fillText('SUNSET COAST', cx, cy - W * 0.085);
  g.fillText('EST. 1979', cx, cy + W * 0.1);
  g.globalAlpha = 1;
  // cracked print
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${0.4 + R() * 0.4})`; g.fillRect(cx + (R() - 0.5) * W * 0.2, cy + (R() - 0.5) * W * 0.24, 1 + R() * 2, 1); }
  g.restore();
}

// Torso: pants below the hem, the shirt above, skin in the collar.
// u: 0.5 = front, 0/1 = back. v: 0 = crotch, 1 = base of the neck.
function torsoTexture(def, shirtHex, seed = 4) {
  const W = 512, H = 512, R = rng(seed);
  const [c, g] = canvas(W, H);
  const vy = (v) => H - v * H;
  const top = def.top, cx = W * 0.5;
  const color = top.color === 'shirt' ? shirtHex : top.color;
  const skinCol = `rgb(${(SKIN[def.skin] || SKIN.light).base.map((x) => Math.round(x * 0.92)).join(',')})`;
  if (top.type === 'suit') {
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    fabricNoise(g, W, H, R, 0.05);
    // white shirt in the V of the jacket
    g.fillStyle = top.shirt;
    g.beginPath(); g.moveTo(cx - 64, vy(0.97)); g.lineTo(cx + 64, vy(0.97)); g.lineTo(cx, vy(0.5)); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, vy(0.95)); g.lineTo(cx, vy(0.5)); g.stroke();
    if (!top.bow) {
      g.fillStyle = top.tie;
      g.beginPath(); g.moveTo(cx - 9, vy(0.95)); g.lineTo(cx + 9, vy(0.95)); g.lineTo(cx + 15, vy(0.56)); g.lineTo(cx, vy(0.5)); g.lineTo(cx - 15, vy(0.56)); g.closePath(); g.fill();
    }
    // satin lapels (tux) or wool lapels (suit)
    g.fillStyle = top.bow ? '#1c1c20' : shade(color, 1.25);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 64, vy(0.97)); g.lineTo(cx + s * 30, vy(0.62)); g.lineTo(cx + s * 4, vy(0.5)); g.lineTo(cx + s * 20, vy(0.62)); g.lineTo(cx + s * 52, vy(0.97)); g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 64, vy(0.97)); g.lineTo(cx + s * 30, vy(0.62)); g.stroke(); }
    // buttons, pocket square line, seams
    g.fillStyle = '#060606'; for (const v of [0.43, 0.3]) { g.beginPath(); g.arc(cx + 8, vy(v), 5, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 2, vy(0.5), 4, vy(0.14) - vy(0.5));
    g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(cx + 70, vy(0.75), 34, 3);
    folds(g, W, H, R, 14, 0.6);
  } else if (top.type === 'tank') {
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    fabricNoise(g, W, H, R, 0.05);
    // skin: scoop neck at the front, arms holes at the sides, straps over the shoulders
    g.fillStyle = skinCol;
    g.beginPath(); g.ellipse(cx, vy(1.0), 56, H * 0.12, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(0, vy(1.0), 60, H * 0.16, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(W, vy(1.0), 60, H * 0.16, 0, 0, 7); g.fill();
    for (const u of [0.25, 0.75]) { g.beginPath(); g.ellipse(u * W, vy(0.95), 64, H * 0.13, 0, 0, 7); g.fill(); }
    // ribbed edges
    g.strokeStyle = shade(color, 0.85); g.lineWidth = 4;
    g.beginPath(); g.ellipse(cx, vy(1.0), 58, H * 0.125, 0, 0, 7); g.stroke();
  } else {
    // crew-neck tee
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    fabricNoise(g, W, H, R, 0.07);
    folds(g, W, H, R);
    g.strokeStyle = shade(color, 0.7); g.lineWidth = 2;
    for (const u of [0.25, 0.75]) { g.beginPath(); g.moveTo(u * W, vy(0.12)); g.lineTo(u * W, vy(0.86)); g.stroke(); }
    // the texture runs right-to-left across the front, so prints are mirrored
    g.save(); g.translate(W, 0); g.scale(-1, 1);
    if (top.print === 'varsity') varsityPrint(g, cx, vy(0.68), W);
    if (top.print === 'vintage') vintagePrint(g, cx, vy(0.66), W, R);
    g.restore();
    g.fillStyle = shade(color, 0.82); g.fillRect(0, vy(0.985), W, vy(0.93) - vy(0.985));
    g.strokeStyle = shade(color, 0.65);
    for (let x = 0; x < W; x += 3) { g.beginPath(); g.moveTo(x, vy(0.985)); g.lineTo(x, vy(0.93)); g.stroke(); }
    g.fillStyle = skinCol; g.fillRect(0, 0, W, vy(0.985));
  }
  if (top.type === 'suit') { g.fillStyle = top.shirt; g.fillRect(0, 0, W, vy(0.975)); g.fillStyle = skinCol; g.fillRect(0, 0, W, vy(0.995)); }
  sideShade(g, W, H, 0.25);
  // hem and pants
  const P = PANTS[def.pants] || PANTS.jeans;
  const hem = 0.13;
  if (top.type !== 'suit') { g.fillStyle = shade(color, 0.75); g.fillRect(0, vy(hem + 0.012), W, 4); }
  g.fillStyle = P.color; g.fillRect(0, vy(hem - 0.002), W, H - vy(hem - 0.002));
  if (P.denim) denim(g, 0, vy(hem - 0.002), W, H - vy(hem - 0.002), R, P.light);
  // belt (chinos, suits)
  if (!P.denim) { g.fillStyle = '#1a1612'; g.fillRect(0, vy(hem + 0.005), W, 9); g.fillStyle = '#9a9a96'; g.fillRect(cx - 9, vy(hem + 0.005), 18, 9); }
  const sh = g.createLinearGradient(0, vy(hem), 0, vy(hem - 0.04));
  sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh; g.fillRect(0, vy(hem), W, vy(hem - 0.04) - vy(hem));
  return tex(c);
}

function sleeveTexture(hex, seed = 9, { cuff = null } = {}) {
  const [c, g] = canvas(256, 128); const R = rng(seed);
  g.fillStyle = hex; g.fillRect(0, 0, 256, 128);
  fabricNoise(g, 256, 128, R, 0.07);
  g.fillStyle = shade(hex, 0.72); g.fillRect(0, 118, 256, 4);
  for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.06})`; g.fillRect(R() * 256, 0, 10, 128); }
  if (cuff) { g.fillStyle = cuff; g.fillRect(0, 116, 256, 12); }
  return tex(c);
}

// Jacket / overshirt fabric.
function layerTexture(L, seed = 21) {
  const W = 256, H = 256, R = rng(seed);
  const [c, g] = canvas(W, H);
  g.fillStyle = L.color; g.fillRect(0, 0, W, H);
  if (L.type === 'sherpa') {
    // fuzzy fleece: lots of soft curly blobs
    for (let i = 0; i < 2600; i++) {
      const x = R() * W, y = R() * H, r = 1.5 + R() * 3;
      g.fillStyle = R() < 0.5 ? shade(L.color, 1.12) : shade(L.color, 0.84);
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  } else if (L.type === 'flannel') {
    g.globalAlpha = 0.6; g.fillStyle = L.check;
    for (let x = 0; x < W; x += 40) g.fillRect(x, 0, 16, H);
    for (let y = 0; y < H; y += 40) g.fillRect(0, y, W, 16);
    g.globalAlpha = 0.25; g.fillStyle = '#8a8c90';
    for (let x = 22; x < W; x += 40) g.fillRect(x, 0, 2, H);
    for (let y = 22; y < H; y += 40) g.fillRect(0, y, W, 2);
    g.globalAlpha = 1;
    fabricNoise(g, W, H, R, 0.08);
  } else if (L.type === 'canvas') {
    // duck canvas weave and orange contrast stitching
    g.strokeStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < H; y += 2) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    fabricNoise(g, W, H, R, 0.06);
    g.strokeStyle = '#e0a050'; g.setLineDash([4, 3]); g.lineWidth = 1.5;
    for (const x of [30, 34, 220, 224]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    g.setLineDash([]);
  } else if (L.type === 'camp') {
    // textured weave
    for (let i = 0; i < 4000; i++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.07)'; g.fillRect(R() * W, R() * H, 2, 2); }
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < H; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 2); g.stroke(); }
  } else {
    // zip-up: smooth nylon/cotton with soft creases
    fabricNoise(g, W, H, R, 0.05);
    folds(g, W, H, R, 10, 1.4);
  }
  return tex(c, true);
}

function skinTexture(skin, seed = 3) {
  const [c, g] = canvas(256, 256); const R = rng(seed);
  g.fillStyle = `rgb(${skin.base.join(',')})`; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { g.fillStyle = R() < 0.5 ? 'rgba(120,60,40,0.06)' : 'rgba(255,230,210,0.05)'; g.fillRect(R() * 256, R() * 256, 2, 2); }
  return tex(c, true);
}

function pantsTexture(kind, seed = 12) {
  const P = PANTS[kind] || PANTS.jeans;
  const [c, g] = canvas(256, 512); const R = rng(seed);
  g.fillStyle = P.color; g.fillRect(0, 0, 256, 512);
  if (P.denim) {
    denim(g, 0, 0, 256, 512, R, P.light);
    for (const [v, a] of [[0.25, P.light ? 0.25 : 0.18], [0.7, 0.12]]) {
      const grd = g.createRadialGradient(128, 512 * v, 5, 128, 512 * v, 90);
      grd.addColorStop(0, `rgba(190,205,230,${a})`); grd.addColorStop(1, 'rgba(190,205,230,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 256, 512);
    }
    g.strokeStyle = '#b08a4a'; g.lineWidth = 1.5;
  } else {
    fabricNoise(g, 256, 512, R, 0.05);
    g.strokeStyle = shade(P.color, 0.75); g.lineWidth = 1.5;
    // pressed crease down the front
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(126, 0, 3, 512);
  }
  for (const u of [64, 192]) { g.beginPath(); g.moveTo(u, 0); g.lineTo(u, 512); g.stroke(); }
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(70 + R() * 110, 512 * (0.42 + R() * 0.12), 40, 3); }
  return tex(c);
}

function shoeTexture(kind) {
  const [c, g] = canvas(256, 128);
  if (kind === 'dress') {
    g.fillStyle = '#0d0c0b'; g.fillRect(0, 0, 256, 128);
    const grd = g.createLinearGradient(0, 0, 256, 0);
    grd.addColorStop(0.35, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.12)'); grd.addColorStop(0.65, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#1e1a16'; g.fillRect(0, 0, 40, 128); g.fillRect(216, 0, 40, 128);
    return tex(c);
  }
  const white = kind === 'whiteSneaker';
  g.fillStyle = '#5a5650'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = white ? '#f0eee8' : '#dcd8cc'; g.fillRect(40, 0, 176, 128);
  g.fillStyle = white ? '#d8d6d0' : '#8a857a'; g.fillRect(40, 0, 8, 128); g.fillRect(208, 0, 8, 128);
  g.strokeStyle = '#efece4'; g.lineWidth = 3;
  for (let v = 30; v < 80; v += 9) { g.beginPath(); g.moveTo(110, v); g.lineTo(146, v + 4); g.stroke(); }
  return tex(c);
}

// --- accessory geometry ------------------------------------------------------------
const METAL = {
  gold: () => new THREE.MeshStandardMaterial({ color: '#d4a93c', metalness: 1, roughness: 0.28 }),
  silver: () => new THREE.MeshStandardMaterial({ color: '#d4d6da', metalness: 1, roughness: 0.25 }),
  black: () => new THREE.MeshStandardMaterial({ color: '#141416', metalness: 0.6, roughness: 0.35 }),
};

// Radius of the torso surface at height y (for draping chains over the chest).
function torsoAt(secs, y) {
  for (let i = 1; i < secs.length; i++) {
    if (y <= secs[i].y) {
      const a = secs[i - 1], b = secs[i], k = (y - a.y) / (b.y - a.y);
      return { rx: a.rx + (b.rx - a.rx) * k, rz: a.rz + (b.rz - a.rz) * k, z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * k };
    }
  }
  const l = secs[secs.length - 1];
  return { rx: l.rx, rz: l.rz, z: l.z || 0 };
}

function chainMesh(secs, neckY, { metal = 'gold', drop = 0.07, cross = false, outer = 0 }) {
  const pts = [];
  const n = 40;
  for (let k = 0; k < n; k++) {
    const phi = (k / n) * Math.PI * 2;            // 0 = back, PI = front
    const front = (1 - Math.cos(phi)) / 2;
    const y = neckY - 0.012 - drop * front ** 2.2;
    const r = 0.066 + drop * 0.25 * front + outer;
    let x = Math.sin(phi) * r, z = -Math.cos(phi) * r * 0.95;
    // lie on the chest: never inside the torso
    const T = torsoAt(secs, y);
    const fz = (T.z || 0) + T.rz * Math.sqrt(Math.max(0, 1 - (x / Math.max(0.01, T.rx)) ** 2)) + 0.004 + outer;
    if (z > 0 && y < neckY - 0.02) z = Math.max(z, fz);
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const g = new THREE.Group();
  const mat = METAL[metal]();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, cross ? 0.0028 : 0.0021, 6, true), mat));
  if (cross) {
    const p = curve.getPointAt(0.5);
    const c = new THREE.Group(); c.position.set(p.x, p.y - 0.022, p.z + 0.004);
    c.add(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.04, 0.004), mat));
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.008, 0.004), mat); bar.position.y = 0.007; c.add(bar);
    g.add(c);
  }
  return g;
}

function watchMesh(r, side, kind) {
  const g = new THREE.Group();
  const metal = METAL.silver();
  if (kind === 'smart') {
    // metal link band and a square black face
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const link = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.016, 0.004), metal);
      link.position.set(Math.cos(a) * (r + 0.003), 0, Math.sin(a) * (r + 0.003)); link.rotation.y = -a + Math.PI / 2;
      g.add(link);
    }
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.026), metal);
    face.position.x = side * (r + 0.006); g.add(face);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.026, 0.022), new THREE.MeshStandardMaterial({ color: '#0a0c10', roughness: 0.1, metalness: 0.5 }));
    glass.position.x = side * (r + 0.0105); g.add(glass);
  } else {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.003, r + 0.003, 0.014, 18, 1, true), metal));
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.007, 20), metal);
    face.rotation.z = Math.PI / 2; face.position.x = side * (r + 0.006); g.add(face);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.0115, 20), new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.3 }));
    dial.rotation.y = side * Math.PI / 2; dial.position.x = side * (r + 0.0096); g.add(dial);
  }
  return g;
}

function braceletMesh(r, { colors, chunky }) {
  const g = new THREE.Group();
  const mats = colors.map((c) => new THREE.MeshStandardMaterial({ color: c, metalness: c === '#1a1a1c' ? 0.5 : 1, roughness: 0.3 }));
  const n = chunky ? 12 : 18;
  const geo = new THREE.TorusGeometry(chunky ? 0.0062 : 0.004, chunky ? 0.0022 : 0.0014, 6, 12);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const link = new THREE.Mesh(geo, mats[k % mats.length]);
    link.position.set(Math.cos(a) * (r + 0.006), 0, Math.sin(a) * (r + 0.006));
    link.rotation.set(Math.PI / 2, 0, a + (k % 2 ? Math.PI / 2 : 0));
    g.add(link);
  }
  return g;
}

// --- body building ------------------------------------------------------------------
const cache = new Map();

export function buildCharacter(id = 'kearns', { shirt = 'sage', detail = 1 } = {}) {
  const def = CHARACTERS[id] || CHARACTERS.kearns;
  const skin = SKIN[def.skin] || SKIN.light;
  const shirtHex = (SHIRT_COLORS[shirt] || SHIRT_COLORS.sage).hex;
  const Lk = def.limbs || 1;
  const top = def.top;
  const suit = top.type === 'suit';
  const longSleeves = suit || (def.layer && !def.layer.short);
  const sleeveHex = suit ? top.color : def.layer ? def.layer.color : (top.color === 'shirt' ? shirtHex : top.color);

  const mats = {
    skin: new THREE.MeshStandardMaterial({ map: skinTexture(skin), roughness: 0.62 }),
    torso: new THREE.MeshStandardMaterial({ map: torsoTexture(def, shirtHex, id.length * 7), roughness: suit ? 0.7 : 0.92 }),
    sleeve: new THREE.MeshStandardMaterial({ map: def.layer ? layerTexture(def.layer, 31) : sleeveTexture(sleeveHex, 9, { cuff: suit ? top.shirt : null }), roughness: 0.9, side: THREE.DoubleSide }),
    pants: new THREE.MeshStandardMaterial({ map: pantsTexture(def.pants, 12), roughness: 0.9 }),
    shoe: new THREE.MeshStandardMaterial({ map: shoeTexture(def.shoes), roughness: def.shoes === 'dress' ? 0.35 : 0.75 }),
  };
  if (suit) mats.sleeve.map = sleeveTexture(top.color, 9, { cuff: top.shirt });
  mats.torso.bumpMap = mats.torso.map; mats.torso.bumpScale = 1.5;
  mats.pants.bumpMap = mats.pants.map; mats.pants.bumpScale = 1.5;
  if (def.layer) { mats.layer = new THREE.MeshStandardMaterial({ map: layerTexture(def.layer, 31), roughness: def.layer.type === 'zip' ? 0.6 : 0.95, side: THREE.DoubleSide }); mats.layer.bumpMap = mats.layer.map; mats.layer.bumpScale = def.layer.type === 'sherpa' ? 4 : 1.5; }
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  const root = new THREE.Group();
  root.name = def.name;
  const body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const bodyOpts = { height: 0.56, ...def.body };
  const secs = torsoSections(bodyOpts);
  mesh(loft(secs, { radial: 22 }), mats.torso, torso);

  // --- open jacket / overshirt over the torso
  if (def.layer) {
    const L = def.layer, radial = 26;
    const off = L.type === 'sherpa' ? 0.016 : 0.011;
    const js = secs.slice(1, 8).map((s) => ({ ...s, rx: s.rx + off, rz: s.rz + off }));
    js.unshift({ ...secs[0], y: secs[0].y * 0.55, rx: secs[0].rx + off + 0.006, rz: secs[0].rz + off + 0.006 });
    const n = js.length;
    // the front is open (camp shirt, flannel, fleece, zip-up) or zipped partway (work jacket)
    const gapAt = (t) => {
      if (L.zipTo != null) return t > L.zipTo ? 0.12 + (t - L.zipTo) * 1.4 : 0.02;
      return 0.32 + t * 0.35;
    };
    const geo = loft(js, { radial, capTop: false, capBottom: false, skip: (i, j) => {
      const a = ((j + 0.5) / radial) * Math.PI * 2;
      return Math.abs(a - Math.PI) < gapAt(i / (n - 1));
    } });
    mesh(geo, mats.layer, torso);
    // collar round the back of the neck
    const collarCol = L.collar || L.color;
    const cm = new THREE.MeshStandardMaterial({ color: collarCol, roughness: 0.9, side: THREE.DoubleSide });
    if (L.collar) { cm.map = layerTexture({ type: 'camp', color: collarCol }, 5); }
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.078, L.type === 'sherpa' ? 0.016 : 0.011, 6, 24, Math.PI * 1.45), cm);
    collar.rotation.set(Math.PI / 2, 0, Math.PI / 2 + Math.PI * 0.275 + Math.PI / 2);
    collar.position.set(0, js[n - 1].y - 0.01, -0.004);
    collar.scale.set(1, 1.05, 1);
    torso.add(collar);
    // zipper pull on the work jacket
    if (L.zipTo != null) {
      const T = torsoAt(js, js[0].y + (js[n - 1].y - js[0].y) * L.zipTo);
      const zp = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.016, 0.003), new THREE.MeshStandardMaterial({ color: '#b8b6ae', metalness: 0.3, roughness: 0.4 }));
      zp.position.set(0, js[0].y + (js[n - 1].y - js[0].y) * L.zipTo - 0.01, (T.z || 0) + T.rz + 0.004); torso.add(zp);
    }
  }

  // --- tie / bow tie
  if (suit && top.bow) {
    const bm = new THREE.MeshStandardMaterial({ color: '#0b0b0c', roughness: 0.4 });
    const T = torsoAt(secs, 0.535);
    const bow = new THREE.Group(); bow.position.set(0, 0.535, (T.z || 0) + T.rz + 0.006);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.03, 4), bm); w.rotation.z = s * Math.PI / 2; w.position.x = s * 0.016; w.scale.set(1, 1, 0.5); bow.add(w); }
    bow.add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.012, 0.01), bm));
    torso.add(bow);
  }

  // --- neck and head
  const neckY = secs[secs.length - 1].y - 0.025;
  const neck = new THREE.Group(); neck.position.set(0, neckY, 0.0); torso.add(neck);
  mesh(neckGeometry(0.085, 0.057 * Math.max(1, Lk * 0.95)), mats.skin, neck, 0, -0.012, 0);
  const headJoint = new THREE.Group(); headJoint.position.set(0, 0.055, 0.012); neck.add(headJoint);
  const hairStyle = def.hair || { style: 'quiff', color: BROWN };
  const H = buildHead({
    shape: { ...def.face, beardLine: def.beardLine || 0 },
    look: { skin, seed: 11 + id.length * 13, size: Math.round(1024 * Math.min(1, detail)), blush: def.blush ?? 1, ...def.look, brows: 1 },
    hair: { style: hairStyle.style, seed: 5 + id.length, detail, countScale: detail },
    hairColor: hairStyle.color, eyeColor: def.eyes || EYES_BROWN, squint: def.squint ?? 0.3, detail,
  });
  H.group.position.y = 0.1;
  H.group.scale.setScalar(def.headScale || 1.08);
  headJoint.add(H.group);
  if (def.earrings) {
    const dm = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.3, roughness: 0.05, emissive: '#bfe4ff', emissiveIntensity: 0.6 });
    for (const ear of H.ears) {
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.0042), dm);
      st.position.set(0, -0.023, 0.006); ear.add(st);
    }
  }
  if (def.chain) torso.add(chainMesh(secs, neckY, { ...def.chain, outer: suit ? 0.004 : 0 }));

  // --- arms
  const nailMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(`rgb(${skin.base.map((x) => Math.min(255, Math.round(x * 1.08 + 14))).join(',')})`), roughness: 0.32 });
  const arm = (side) => {
    const shoulder = new THREE.Group();
    const sx = secs[6].rx * 0.92;
    shoulder.position.set(side * sx, secs[6].y * 0.98, -0.005); torso.add(shoulder);
    shoulder.rotation.z = side * (def.armsOut ?? 0.1);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.052 * Lk, 14, 10), longSleeves || def.layer ? mats.sleeve : mats.torso.clone());
    if (!longSleeves && !def.layer) cap.material = new THREE.MeshStandardMaterial({ map: sleeveTexture(top.type === 'tank' ? `rgb(${skin.base.join(',')})` : (top.color === 'shirt' ? shirtHex : top.color)), roughness: 0.9 });
    cap.scale.set(1, 0.75, 1.05); cap.position.y = -0.005; shoulder.add(cap);
    if (top.type === 'tank' && !def.layer) cap.material = mats.skin;
    const upper = limb(0.29, 0.05 * Lk, 0.04 * Lk, { bulge: 0.14, bulgeAt: 0.35 });
    mesh(upper, mats.skin, shoulder);
    const r1 = 0.058 * Lk + (def.layer ? 0.008 : 0);
    // sleeves: short (tee, camp shirt) or long (jackets, suits)
    const sleeveMat = mats.sleeve;
    if (longSleeves) {
      mesh(loft([{ y: -0.295, rx: 0.05 * Lk + 0.012, rz: 0.048 * Lk + 0.012 }, { y: -0.15, rx: r1, rz: r1 * 0.95 }, { y: 0.0, rx: r1, rz: r1 * 0.95 }, { y: 0.03, rx: r1 * 0.8, rz: r1 * 0.8 }], { radial: 16, capBottom: false, capTop: false }), sleeveMat, shoulder);
    } else if (top.type !== 'tank' || def.layer) {
      const sr = def.layer && def.layer.short ? r1 + 0.01 : r1;
      mesh(loft([{ y: -0.16, rx: sr, rz: sr * 0.93 }, { y: -0.1, rx: sr * 1.02, rz: sr * 0.95 }, { y: -0.02, rx: sr, rz: sr * 0.94 }, { y: 0.02, rx: sr * 0.8, rz: sr * 0.8 }], { radial: 16, capBottom: false, capTop: false }), def.layer ? mats.sleeve : cap.material, shoulder);
    }
    const elbow = new THREE.Group(); elbow.position.y = -0.29; shoulder.add(elbow);
    elbow.rotation.x = -0.18;
    mesh(limb(0.26, 0.041 * Lk, 0.031 * Lk, { bulge: 0.14, bulgeAt: 0.25 }), mats.skin, elbow);
    if (longSleeves) {
      const r2 = 0.046 * Lk + 0.01;
      mesh(loft([{ y: -0.235, rx: 0.036 * Lk + 0.009, rz: 0.034 * Lk + 0.009 }, { y: -0.12, rx: r2 * 0.95, rz: r2 * 0.9 }, { y: 0.02, rx: r2, rz: r2 * 0.95 }], { radial: 16, capBottom: false, capTop: false }), sleeveMat, elbow);
    }
    const wrist = new THREE.Group(); wrist.position.y = -0.26; elbow.add(wrist);
    const handGroup = new THREE.Group(); wrist.add(handGroup);
    handGroup.rotation.y = side * -Math.PI / 2 * 0.9;
    handGroup.scale.set(-side * Lk, Lk, Lk); // mirrored so each arm gets the right hand (thumb forward)
    const hand = buildHand(mats.skin, nailMat, { size: 1 });
    handGroup.add(hand.group);
    // jewellery on the wrist (just above the hand)
    const wr = 0.031 * Lk;
    const sideName = side === 1 ? 'left' : 'right';
    if (def.watch && def.watch.side === sideName) { const w = watchMesh(wr, side, def.watch.kind); w.position.y = 0.028; wrist.add(w); }
    if (def.bracelet && def.bracelet.side === sideName) { const b = braceletMesh(wr, def.bracelet); b.position.y = def.watch && def.watch.side === sideName ? 0.05 : 0.026; wrist.add(b); }
    return { side, shoulder, elbow, wrist, handGroup, hand, shoulderY: shoulder.position.y, upperLen: 0.29, lowerLen: 0.26 };
  };
  const armL = arm(1), armR = arm(-1);

  // --- legs
  const leg = (side) => {
    const hip = new THREE.Group(); hip.position.set(side * secs[1].rx * 0.56, -0.03, 0); hips.add(hip);
    hip.rotation.z = side * 0.025;
    mesh(limb(0.45, 0.083 * Lk, 0.055 * Lk, { bulge: 0.06, bulgeAt: 0.3, flat: 0.95 }), mats.pants, hip);
    const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
    mesh(limb(0.44, 0.056 * Lk, 0.046 * Math.max(1, Lk * 0.95), { bulge: 0.04, bulgeAt: 0.3, flat: 0.95 }), mats.pants, knee);
    const ankle = new THREE.Group(); ankle.position.y = -0.44; knee.add(ankle);
    mesh(shoeGeometry({ length: 0.27 + 0.02 * (Lk - 1), width: 0.1 * Math.max(0.95, Lk * 0.95) }), mats.shoe, ankle, 0, -0.06, 0.005);
    return { hip, knee, ankle };
  };
  const legL = leg(1), legR = leg(-1);

  root.scale.setScalar(def.height || 1);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { id, def, root, body, hips, torso, neck, head: headJoint, face: H, armL, armR, legL, legR, mats, phase: Math.random() * 10 };
}

// Kept for older callers.
export function buildKearns(opts = {}) { return buildCharacter('kearns', opts); }

void cache;
