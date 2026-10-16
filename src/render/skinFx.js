// =============================================================================
// Finishes for the Skin Shop's special skins (src/career/skins.js `fx`),
// applied to a character after buildCharacter() has made them:
//   bikini: the Sexy Fucci. Bare skin everywhere, a black-and-gold Fucci bikini.
//   opal:   the Pink Diamond Galaxy Opal Drippy Face Build Skin. Every surface
//           turns to glowing, iridescent pink opal, with a swirl of galaxy
//           sparkles round them. k.fxUpdate(dt) makes it shimmer.
// =============================================================================
import * as THREE from 'three';
import { SKIN } from './human.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

export function applySkinFx(k, fx) {
  if (fx === 'bikini') bikini(k);
  else if (fx === 'opal') opal(k);
  return k;
}

// --- Sexy Fucci ------------------------------------------------------------------------
function bikini(k) {
  const base = (SKIN[k.def.skin] || SKIN.light).base;
  const skinCol = `rgb(${base.join(',')})`;
  const BLACK = '#0d0d0f', GOLD = '#d8b04a', PINK = '#ff2fa0';
  // the torso (u: 0.5 = front, mirrored; v: 0 = crotch, 1 = neck)
  const W = 512, H = 512, [c, g] = canvas(W, H), vy = (v) => H - v * H, cx = W * 0.5;
  g.fillStyle = skinCol; g.fillRect(0, 0, W, H);
  // the top: two gold-edged triangles, a strap round the back and up over the shoulders
  g.fillStyle = BLACK; g.strokeStyle = GOLD; g.lineWidth = 4;
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(cx + s * 8, vy(0.6)); g.lineTo(cx + s * 78, vy(0.6)); g.lineTo(cx + s * 44, vy(0.78)); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(cx + s * 44, vy(0.78)); g.lineTo(cx + s * 70, vy(1)); g.stroke();
  }
  g.fillStyle = BLACK; g.fillRect(0, vy(0.62), cx - 76, 9); g.fillRect(cx + 76, vy(0.62), W - cx - 76, 9);
  g.fillStyle = GOLD; g.beginPath(); g.arc(cx, vy(0.61), 6, 0, 7); g.fill();
  // the bottoms, with the double F on the front in pink
  g.fillStyle = BLACK; g.fillRect(0, vy(0.13), W, vy(0) - vy(0.13));
  g.fillStyle = GOLD; g.fillRect(0, vy(0.13), W, 5);
  g.save(); g.translate(W, 0); g.scale(-1, 1);
  g.font = '900 34px "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = PINK; g.fillText('FF', cx, vy(0.065));
  g.restore();
  k.mats.torso.map = tex(c); k.mats.torso.bumpMap = null; k.mats.torso.roughness = 0.6; k.mats.torso.needsUpdate = true;
  // bare legs
  const [lc, lg] = canvas(64, 64);
  lg.fillStyle = skinCol; lg.fillRect(0, 0, 64, 64);
  k.mats.pants.map = tex(lc); k.mats.pants.bumpMap = null; k.mats.pants.roughness = 0.62; k.mats.pants.needsUpdate = true;
}

// --- Pink Diamond Galaxy Opal Drippy Face Build Skin ----------------------------------
const OPAL = { tint: new THREE.Color('#ffc4ee'), glow: new THREE.Color('#ff3fcf') };

function opal(k) {
  const made = new Map();
  const convert = (m) => {
    if (!m || !m.isMeshStandardMaterial) return m;
    if (made.has(m)) return made.get(m);
    const o = new THREE.MeshPhysicalMaterial({
      map: m.map, color: m.color.clone().lerp(OPAL.tint, 0.65),
      metalness: 0.55, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08,
      iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [180, 820],
      emissive: OPAL.glow, emissiveIntensity: 0.5, emissiveMap: m.map || null,
      transparent: m.transparent, opacity: m.opacity, side: m.side, alphaTest: m.alphaTest,
    });
    made.set(m, o);
    return o;
  };
  k.root.traverse((o) => {
    if (!o.isMesh || o.isPoints) return;
    o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
  });
  for (const key of Object.keys(k.mats)) k.mats[key] = convert(k.mats[key]);
  // the galaxy: pink, violet and white sparkles orbiting them
  const n = 260, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const C = [new THREE.Color('#ff7ad8'), new THREE.Color('#b78cff'), new THREE.Color('#ffffff'), new THREE.Color('#7af0ff')];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.35 + Math.random() * 0.35, y = Math.random() * 2;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r;
    const cc = C[i % C.length]; col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.018, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  stars.raycast = () => {};
  k.root.add(stars);
  const glow = new THREE.PointLight('#ff4fd0', 1.2, 2.2, 2);
  glow.position.set(0, 1.2, 0.5);
  k.root.add(glow);
  let t = 0;
  const mats = [...made.values()];
  k.fxUpdate = (dt) => {
    t += dt;
    stars.rotation.y += dt * 0.5;
    const pulse = 0.45 + Math.sin(t * 2.2) * 0.12;
    for (const m of mats) { m.emissiveIntensity = pulse; m.iridescenceThicknessRange[1] = 700 + Math.sin(t * 0.9) * 180; }
    glow.intensity = 1 + Math.sin(t * 2.2) * 0.4;
  };
}
