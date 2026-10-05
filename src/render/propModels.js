// =============================================================================
// The downloaded prop models (built by tools/props/build_props.py into
// assets/props/): the perk machines (one Juggernog-style machine, repainted
// per perk), the perk bottles, the Mad Dog machine (a Pack-a-Punch, repainted),
// the jukebox, the trophy and the Mystery Box. Everything here is async: the
// built-in versions stand in until a model arrives (or if it can't load).
// =============================================================================
import * as THREE from 'three';
import { loadModel } from './gltfLite.js';

const BASE = 'assets/props/';
const C = (hex) => new THREE.Color(hex);

// Normalize a loaded scene: turn it, put its base on y = 0, center it in x/z.
function normalize(scene, { yaw = 0, scale = 1 } = {}) {
  const turn = new THREE.Group();
  turn.rotation.y = yaw; turn.scale.setScalar(scale);
  turn.add(scene);
  const holder = new THREE.Group(); holder.add(turn);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  turn.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  holder.updateMatrixWorld(true);
  holder.userData.size = box.getSize(new THREE.Vector3());
  return holder;
}

function firstMap(scene) {
  let map = null;
  scene.traverse((o) => { if (!map && o.isMesh && o.material && o.material.map) map = o.material.map; });
  return map;
}

// Canvas helpers ---------------------------------------------------------------
function canvasFrom(image, scale) {
  const c = document.createElement('canvas');
  c.width = image.width * scale; c.height = image.height * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(image, 0, 0, c.width, c.height);
  return [c, g];
}
function rgb2hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255];
}
// Repaint every pixel whose hue is within `range` of `from` with the hue/saturation of `to`.
function recolor(g, w, h, test, to, { keepLight = true, boost = 1 } = {}) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const T = C(to), hsl = {}; T.getHSL(hsl);
  for (let i = 0; i < d.length; i += 4) {
    const [hh, s, v] = rgb2hsv(d[i], d[i + 1], d[i + 2]);
    if (!test(hh, s, v)) continue;
    const L = keepLight ? Math.min(1, v * 0.62 * boost) : hsl.l;
    const c = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * (0.75 + s * 0.4)), L);
    d[i] = c.r * 255; d[i + 1] = c.g * 255; d[i + 2] = c.b * 255;
  }
  g.putImageData(img, 0, 0);
}
function fitText(g, lines, x, y, w, h, color, weight = 900) {
  const n = lines.length;
  let size = h / n * 0.9;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  for (const l of lines) { g.font = `${weight} ${size}px Impact, "Arial Narrow", "Arial Black", sans-serif`; while (g.measureText(l).width > w && size > 4) { size -= 1; g.font = `${weight} ${size}px Impact, "Arial Narrow", sans-serif`; } }
  g.font = `${weight} ${size}px Impact, "Arial Narrow", "Arial Black", sans-serif`;
  lines.forEach((l, i) => g.fillText(l, x + w / 2, y + h * (i + 0.5) / n));
}
// A simple perk symbol in a circle.
function perkSymbol(g, cx, cy, r, def) {
  g.save();
  g.fillStyle = '#efe6cc'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.lineWidth = r * 0.16; g.strokeStyle = def.color; g.stroke();
  g.fillStyle = def.color; g.strokeStyle = def.color; g.lineCap = 'round'; g.lineJoin = 'round';
  const k = r * 0.55;
  g.beginPath();
  switch (def.key) {
    case 'secondHelping':   // a heart with a plus
      g.moveTo(cx, cy + k * 0.9); g.bezierCurveTo(cx - k * 1.4, cy - k * 0.1, cx - k * 0.6, cy - k * 1.2, cx, cy - k * 0.4);
      g.bezierCurveTo(cx + k * 0.6, cy - k * 1.2, cx + k * 1.4, cy - k * 0.1, cx, cy + k * 0.9); g.fill();
      g.strokeStyle = '#efe6cc'; g.lineWidth = r * 0.14; g.beginPath(); g.moveTo(cx - k * 0.35, cy - k * 0.1); g.lineTo(cx + k * 0.35, cy - k * 0.1); g.moveTo(cx, cy - k * 0.45); g.lineTo(cx, cy + k * 0.25); g.stroke();
      break;
    case 'beefcakeBroth':   // a shield
      g.moveTo(cx, cy - k); g.lineTo(cx + k * 0.85, cy - k * 0.6); g.lineTo(cx + k * 0.7, cy + k * 0.3); g.lineTo(cx, cy + k); g.lineTo(cx - k * 0.7, cy + k * 0.3); g.lineTo(cx - k * 0.85, cy - k * 0.6); g.closePath(); g.fill();
      break;
    case 'hotPotHustle':    // a lightning bolt
      g.moveTo(cx + k * 0.25, cy - k); g.lineTo(cx - k * 0.55, cy + k * 0.15); g.lineTo(cx - k * 0.02, cy + k * 0.15); g.lineTo(cx - k * 0.3, cy + k); g.lineTo(cx + k * 0.6, cy - k * 0.2); g.lineTo(cx + k * 0.05, cy - k * 0.2); g.closePath(); g.fill();
      break;
    case 'doubleLadle':     // two crossed ladles
      g.lineWidth = r * 0.16;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx - s * k * 0.8, cy - k * 0.8); g.lineTo(cx + s * k * 0.45, cy + k * 0.45); g.stroke(); g.beginPath(); g.arc(cx + s * k * 0.55, cy + k * 0.55, k * 0.3, 0, Math.PI * 2); g.fill(); }
      break;
    default:                // marathon: speed chevrons
      g.lineWidth = r * 0.17;
      for (const dx of [-0.45, 0.15]) { g.beginPath(); g.moveTo(cx + (dx - 0.3) * k, cy - k * 0.7); g.lineTo(cx + (dx + 0.35) * k, cy); g.lineTo(cx + (dx - 0.3) * k, cy + k * 0.7); g.stroke(); }
  }
  g.restore();
}

// --- perk machines -----------------------------------------------------------------
// The Juggernog machine's texture (256 px) and where its painted signs are.
const JUG = {
  front: [24, 176, 52, 200],        // the big sign on the front
  side: [72, 211, 89, 232],         // the stacked name down one side
  logo: [49, 148, 60, 159],        // the round logo on top
  red: (h, s, v) => (h < 22 || h > 335) && s > 0.32 && v > 0.12,
};
const jugCache = new Map();
export function perkMachineModel(key, def) {
  if (jugCache.has(key)) return jugCache.get(key).then((t) => t && t.clone(true));
  const job = loadModel(BASE + 'juggernog.glb').then((gltf) => {
    if (!gltf) return null;
    const map = firstMap(gltf.scene);
    const S = 4;
    const [c, g] = canvasFrom(map.image, S);
    const [ec, eg] = [document.createElement('canvas'), null];
    ec.width = c.width; ec.height = c.height;
    const e = ec.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, ec.width, ec.height);
    const d = { ...def, key };
    recolor(g, c.width, c.height, JUG.red, def.color, { boost: 1.15 });
    const cream = '#e4dcc4', ink = new THREE.Color(def.color).multiplyScalar(0.75).getStyle();
    const words = def.name.toUpperCase().split(' ');
    for (const ctx of [g, e]) {
      const [x0, y0, x1, y1] = JUG.front.map((v) => v * S);
      ctx.fillStyle = ctx === g ? cream : '#000'; ctx.fillRect(x0 + S, y0 + S, x1 - x0 - 2 * S, y1 - y0 - 2 * S);
      fitText(ctx, words, x0 + 2 * S, y0 + 2 * S, x1 - x0 - 4 * S, y1 - y0 - 4 * S, ctx === g ? ink : def.color);
      const [sx0, sy0, sx1, sy1] = JUG.side.map((v) => v * S);
      ctx.fillStyle = ctx === g ? cream : '#000'; ctx.fillRect(sx0 + S, sy0 + S, sx1 - sx0 - 2 * S, sy1 - sy0 - 2 * S);
      fitText(ctx, words, sx0 + 2 * S, sy0 + 2 * S, sx1 - sx0 - 4 * S, sy1 - sy0 - 4 * S, ctx === g ? ink : def.color);
      const [lx0, ly0, lx1, ly1] = JUG.logo.map((v) => v * S);
      if (ctx === g) perkSymbol(ctx, (lx0 + lx1) / 2, (ly0 + ly1) / 2, (lx1 - lx0) / 2, d);
      else { ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc((lx0 + lx1) / 2, (ly0 + ly1) / 2, (lx1 - lx0) / 2, 0, 7); ctx.fill(); }
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.magFilter = THREE.NearestFilter; tex.anisotropy = 4;
    const glow = new THREE.CanvasTexture(ec); glow.colorSpace = THREE.SRGBColorSpace; glow.flipY = false;
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 0, roughness: 0.6, metalness: 0.15, alphaTest: 0.05, side: THREE.DoubleSide });
    const scene = gltf.scene.clone(true);
    scene.traverse((o) => { if (o.isMesh) o.material = mat; });
    const t = normalize(scene, { yaw: Math.PI });   // the front faces +Z
    t.userData.mat = mat;
    return t;
  });
  jugCache.set(key, job);
  return job.then((t) => t && t.clone(true));
}

// --- the perk bottle -------------------------------------------------------------
const bottleCache = new Map();
export function perkBottleModel(key, def) {
  if (bottleCache.has(key)) return bottleCache.get(key).then((t) => t && t.clone(true));
  const job = loadModel(BASE + 'bottle.glb').then((gltf) => {
    if (!gltf) return null;
    const scene = gltf.scene.clone(true);
    const col = C(def.color);
    let labelSrc = null;
    scene.traverse((o) => { if (o.isMesh && o.name === 'label' && o.material.map) labelSrc = o.material.map.image; });
    let labelMat = null;
    if (labelSrc) {
      const [c, g] = canvasFrom(labelSrc, 1);
      const W = c.width, H = c.height;
      // the wrap-around label is the strip at the bottom of the texture
      const y0 = Math.round(H * 0.705), y1 = Math.round(H * 0.975), x0 = Math.round(W * 0.02), x1 = Math.round(W * 0.985);
      g.fillStyle = '#d9c9a6'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.strokeStyle = def.color; g.lineWidth = H * 0.012; g.strokeRect(x0 + H * 0.015, y0 + H * 0.015, x1 - x0 - H * 0.03, y1 - y0 - H * 0.03);
      const h = y1 - y0;
      perkSymbol(g, (x0 + x1) / 2, y0 + h * 0.42, h * 0.3, { ...def, key });
      for (const side of [-1, 1]) fitText(g, def.name.toUpperCase().split(' '), (x0 + x1) / 2 + side * (x1 - x0) * 0.3 - (x1 - x0) * 0.17, y0 + h * 0.15, (x1 - x0) * 0.34, h * 0.7, new THREE.Color(def.color).multiplyScalar(0.7).getStyle());
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4;
      labelMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide });
    }
    scene.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name === 'drink') o.material = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.15, transparent: true, opacity: 0.9 });
      else if (o.name === 'bubble') o.material = new THREE.MeshStandardMaterial({ color: col.clone().lerp(C('#ffffff'), 0.6), roughness: 0.05, transparent: true, opacity: 0.5 });
      else if (o.name === 'label' && labelMat) o.material = labelMat;
      else if (o.name === 'glass') { o.material = new THREE.MeshStandardMaterial({ color: '#e4efec', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.2, depthWrite: false }); o.renderOrder = 2; }
    });
    return normalize(scene, { yaw: Math.PI / 2 });   // the label faces +Z
  });
  bottleCache.set(key, job);
  return job.then((t) => t && t.clone(true));
}

// --- the Mad Dog machine (a Pack-a-Punch, repainted) -------------------------------
let papJob = null;
export function madDogModel() {
  if (papJob) return papJob.then((t) => t && t.clone(true));
  papJob = loadModel(BASE + 'pap.glb').then((gltf) => {
    if (!gltf) return null;
    const map = firstMap(gltf.scene);
    const S = 4;
    const [c, g] = canvasFrom(map.image, S);
    // mint body -> blood red; green pads -> burnt orange; blue -> steel
    recolor(g, c.width, c.height, (h, s, v) => h > 140 && h < 185 && s > 0.12 && v > 0.25, '#8e1d17', { boost: 0.95 });
    recolor(g, c.width, c.height, (h, s) => h > 95 && h <= 140 && s > 0.3, '#d8641c', { boost: 1.2 });
    recolor(g, c.width, c.height, (h, s) => h > 185 && h < 220 && s > 0.3, '#9aa3ad', { boost: 1.2 });
    // pale stone frame -> dark gunmetal, so it doesn't read as a Pack-a-Punch
    recolor(g, c.width, c.height, (h, s, v) => s < 0.14 && v > 0.3, '#4a4f57', { boost: 0.75 });
    const [ec] = [document.createElement('canvas')]; ec.width = c.width; ec.height = c.height;
    const e = ec.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, ec.width, ec.height);
    // the sign: "MAD DOG"
    const sign = [50, 356, 96, 369].map((v) => v * S);
    for (const ctx of [g, e]) {
      ctx.fillStyle = '#140707'; ctx.fillRect(sign[0], sign[1], sign[2] - sign[0], sign[3] - sign[1]);
      fitText(ctx, ['MAD DOG'], sign[0] + S, sign[1] + S * 0.5, sign[2] - sign[0] - 2 * S, sign[3] - sign[1] - S, '#ffcf3a');
    }
    // the logo: a snarling dog's head on a gold oval
    const lg = [189, 276, 212, 287].map((v) => v * S);
    const cx = (lg[0] + lg[2]) / 2, cy = (lg[1] + lg[3]) / 2, rx = (lg[2] - lg[0]) / 2, ry = (lg[3] - lg[1]) / 2;
    for (const ctx of [g, e]) {
      ctx.fillStyle = '#e8b323'; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a0a07';
      ctx.beginPath(); ctx.moveTo(cx - rx * 0.55, cy - ry * 0.7); ctx.lineTo(cx - rx * 0.25, cy - ry * 0.1); ctx.lineTo(cx + rx * 0.25, cy - ry * 0.1); ctx.lineTo(cx + rx * 0.55, cy - ry * 0.7);
      ctx.lineTo(cx + rx * 0.45, cy + ry * 0.5); ctx.lineTo(cx, cy + ry * 0.8); ctx.lineTo(cx - rx * 0.45, cy + ry * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff3a1a'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * rx * 0.2, cy + ry * 0.1, ry * 0.13, 0, 7); ctx.fill(); }
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.magFilter = THREE.NearestFilter;
    const glow = new THREE.CanvasTexture(ec); glow.colorSpace = THREE.SRGBColorSpace; glow.flipY = false;
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 0, roughness: 0.6, metalness: 0.2, alphaTest: 0.05, side: THREE.DoubleSide });
    const scene = gltf.scene.clone(true);
    scene.traverse((o) => { if (o.isMesh) o.material = mat; });
    const t = normalize(scene, { scale: 1 / 16 });   // Blockbench units
    t.userData.mat = mat;
    return t;
  });
  return papJob.then((t) => t && t.clone(true));
}

// --- jukebox, trophy, Mystery Box ---------------------------------------------------
export function jukeboxModel() {
  return loadModel(BASE + 'jukebox.glb').then((g) => {
    if (!g) return null;
    const t = normalize(g.scene.clone(true), { yaw: -Math.PI / 2 });   // front faces +Z
    t.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissiveIntensity = 0.4; t.userData.mat = o.material; } });
    return t;
  });
}
// The trophy, and the same trophy broken into the three pieces the quest
// scatters round the school: { all, cup, handles, plinth } (each 0.5 m scale).
let trophyJob = null;
export function trophyParts(height = 0.5) {
  if (!trophyJob) trophyJob = loadModel(BASE + 'trophy.glb').then((g) => {
    if (!g) return null;
    let mesh = null; g.scene.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
    const geo = mesh.geometry, P = geo.attributes.position, I = geo.index.array;
    const box = new THREE.Box3().setFromBufferAttribute(P);
    const k = height / (box.max.y - box.min.y);
    const parts = { cup: [], handles: [], plinth: [] };
    for (let t = 0; t < I.length; t += 3) {
      let x = 0, y = 0, z = 0;
      for (let j = 0; j < 3; j++) { x += P.getX(I[t + j]); y += P.getY(I[t + j]); z += P.getZ(I[t + j]); }
      x /= 3; y /= 3; z /= 3;
      const part = y < 0.32 ? 'plinth' : (Math.abs(z) < 0.12 && Math.abs(x) > 0.85 && y > 1.25) ? 'handles' : 'cup';
      parts[part].push(I[t], I[t + 1], I[t + 2]);
    }
    // each piece sits on its own bottom
    const make = (idx) => {
      const gg = geo.clone(); gg.setIndex(idx);
      let minY = Infinity; for (const i of idx) minY = Math.min(minY, P.getY(i));
      const m = new THREE.Mesh(gg, mesh.material);
      m.scale.setScalar(k); m.position.y = -minY * k;
      const grp = new THREE.Group(); grp.add(m); return grp;
    };
    return { all: make(Array.from(I)), cup: make(parts.cup), handles: make(parts.handles), plinth: make(parts.plinth) };
  });
  return trophyJob;
}
// The box with its lid split off (hinged along the back edge) and the glow decals.
export function mysteryBoxModel() {
  return loadModel(BASE + 'mysterybox.glb').then((g) => {
    if (!g) return null;
    const t = normalize(g.scene.clone(true));
    t.updateMatrixWorld(true);
    const lidParts = [], glows = [];
    t.traverse((o) => {
      if (!o.isMesh) return;
      const n = o.material.name || '';
      // the export marks every panel as see-through and some lights at 17x:
      // tame both so the box reads under bloom
      if (o.material.map) { o.material.transparent = false; o.material.depthWrite = true; }
      if (o.material.emissiveIntensity > 2) o.material.emissiveIntensity = 0.7;
      if (/Lid|GlowTop|Material\.00/.test(n)) lidParts.push(o);
      if (/Glow/.test(n)) glows.push(o);
    });
    return { group: t, lidParts, glows, size: t.userData.size };
  });
}
