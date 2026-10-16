// =============================================================================
// Gun skins, drawn: each pattern (src/career/gunSkins.js `look.kind`) is
// painted once onto a small tiling canvas and becomes one material, shared by
// every gun wearing it. buildGun() (src/render/gunModels.js) swaps it onto
// the gun's metal and wood (not the hands, sights' glass or anything glowing).
// The moving ones (Dark Matter, Molten, Dragon Scale) drift: animateGunSkins(t).
// =============================================================================
import * as THREE from 'three';
import { GUN_SKIN_BY_ID } from '../career/gunSkins.js';

const S = 256;
const cache = new Map();
const moving = [];

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const seedOf = (id) => [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
// draw fn() at every wrap-around offset, so the picture tiles without seams
function wrap(g, fn) { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } }
function blob(g, x, y, r, R) {
  g.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, rr = r * (0.6 + R() * 0.6); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.7; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.closePath(); g.fill();
}

// one pattern: { map, glow (an emissive map, or null) }
const PAINT = {
  blots(g, C, R) {
    g.fillStyle = C[0]; g.fillRect(0, 0, S, S);
    for (const col of C.slice(1)) for (let i = 0; i < 9; i++) { const x = R() * S, y = R() * S, r = 18 + R() * 30; g.fillStyle = col; wrap(g, () => blob(g, x, y, r, R)); }
  },
  tiger(g, C, R) {
    g.fillStyle = C[0]; g.fillRect(0, 0, S, S);
    g.fillStyle = C[1];
    for (let i = 0; i < 22; i++) {
      const x = R() * S, y = R() * S, len = 40 + R() * 70, w = 4 + R() * 9, a = -0.25 + R() * 0.5;
      wrap(g, () => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, -w); g.quadraticCurveTo(len * 0.5, -w * 2 * R(), len, 0); g.quadraticCurveTo(len * 0.5, w * 1.5, 0, w); g.closePath(); g.fill(); g.restore(); });
    }
  },
  pixels(g, C, R) {
    const P = 8;
    for (let y = 0; y < S; y += P) for (let x = 0; x < S; x += P) { g.fillStyle = C[Math.floor(R() * R() * C.length)]; g.fillRect(x, y, P, P); }
    for (let i = 0; i < 40; i++) { g.fillStyle = C[1 + Math.floor(R() * (C.length - 1))]; const x = Math.floor(R() * S / P) * P, y = Math.floor(R() * S / P) * P; g.fillRect(x, y, P * (1 + Math.floor(R() * 4)), P * (1 + Math.floor(R() * 3))); }
  },
  petals(g, C, R) {
    g.fillStyle = C[0]; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 40; i++) {
      const x = R() * S, y = R() * S, r = 5 + R() * 8, col = C[1 + (i % 2)];
      wrap(g, () => { g.fillStyle = col; for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8, r * 0.5, a, 0, 7); g.fill(); } g.fillStyle = '#ffe080'; g.beginPath(); g.arc(x, y, r * 0.3, 0, 7); g.fill(); });
    }
  },
  damascus(g, C) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x += 2) {
      const v = Math.sin((y + Math.sin(x * 0.049) * 18 + Math.sin(x * 0.0245 + y * 0.049) * 10) * 0.39);
      g.fillStyle = v > 0.2 ? C[1] : v > -0.4 ? mix(C[0], C[1], 0.45) : C[0]; g.fillRect(x, y, 2, 1);
    }
  },
  weave(g, C) {
    const P = 16;
    for (let y = 0; y < S; y += P) for (let x = 0; x < S; x += P) {
      const odd = ((x + y) / P) % 2;
      const grd = odd ? g.createLinearGradient(x, y, x + P, y) : g.createLinearGradient(x, y, x, y + P);
      grd.addColorStop(0, C[0]); grd.addColorStop(0.5, C[1]); grd.addColorStop(1, C[0]);
      g.fillStyle = grd; g.fillRect(x, y, P, P);
    }
  },
  bacon(g, C, R) {
    g.fillStyle = C[0]; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 32) {
      g.fillStyle = C[1];
      g.beginPath(); g.moveTo(0, y + 8);
      for (let x = 0; x <= S; x += 16) g.lineTo(x, y + 8 + Math.sin(x * 0.0491 + y) * 4);
      for (let x = S; x >= 0; x -= 16) g.lineTo(x, y + 16 + Math.sin(x * 0.0491 + y + 1) * 4);
      g.fill();
      g.fillStyle = 'rgba(80,10,0,0.35)'; for (let i = 0; i < 12; i++) g.fillRect(R() * S, y + 20 + R() * 8, 10, 2);
    }
  },
  metal(g, C, R) {
    const grd = g.createLinearGradient(0, 0, S, S);
    grd.addColorStop(0, C[0]); grd.addColorStop(0.5, mix(C[0], '#ffffff', 0.35)); grd.addColorStop(1, C[0]);
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},0.06)`; g.fillRect(R() * S, R() * S, 30 + R() * 60, 1); }
    g.strokeStyle = C[1]; g.globalAlpha = 0.35; g.lineWidth = 2; for (let y = 0; y < S; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); } g.globalAlpha = 1;
  },
  facets(g, C, R) {
    g.fillStyle = C[1]; g.fillRect(0, 0, S, S);
    const P = 32;
    for (let y = 0; y < S; y += P) for (let x = 0; x < S; x += P) {
      for (const [a, b, c] of [[[x, y], [x + P, y], [x + P / 2, y + P / 2]], [[x + P, y], [x + P, y + P], [x + P / 2, y + P / 2]], [[x + P, y + P], [x, y + P], [x + P / 2, y + P / 2]], [[x, y + P], [x, y], [x + P / 2, y + P / 2]]]) {
        g.fillStyle = mix(C[R() < 0.5 ? 0 : 1], C[2], R() * 0.6);
        g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.closePath(); g.fill();
      }
    }
  },
  galaxy(g, C, R, glow) {
    g.fillStyle = C[0]; g.fillRect(0, 0, S, S);
    glow.fillStyle = '#000'; glow.fillRect(0, 0, S, S);
    for (const [ctx, k] of [[g, 0.5], [glow, 1]]) {
      for (let i = 0; i < 14; i++) {
        const x = R() * S, y = R() * S, r = 30 + R() * 50, col = C[1 + (i % 2)];
        wrap(ctx, () => { const grd = ctx.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 0.35 * k + 0.1; ctx.fillStyle = grd; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; });
      }
      for (let i = 0; i < 160; i++) { ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.4 + R() * 0.6; ctx.fillRect(R() * S, R() * S, R() < 0.9 ? 1 : 2, R() < 0.9 ? 1 : 2); ctx.globalAlpha = 1; }
    }
  },
  cracks(g, C, R, glow) {
    g.fillStyle = C[0]; g.fillRect(0, 0, S, S);
    glow.fillStyle = '#000'; glow.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(255,255,255,${0.02 + R() * 0.04})`; const x = R() * S, y = R() * S, r = 14 + R() * 24; wrap(g, () => blob(g, x, y, r, R)); }
    for (let i = 0; i < 16; i++) {
      const pts = []; let x = R() * S, y = R() * S;
      for (let k = 0; k < 6; k++) { pts.push([x, y]); x += (R() - 0.5) * 60; y += (R() - 0.5) * 60; }
      for (const [ctx, w, col] of [[glow, 6, C[1]], [glow, 2, C[2]], [g, 3, C[1]]]) wrap(ctx, () => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); });
    }
  },
  stripes(g, C) {
    g.fillStyle = C[0]; g.fillRect(0, 0, S, S);
    g.fillStyle = C[1]; g.fillRect(0, 96, S, 16); g.fillRect(0, 120, S, 6);
  },
  flames(g, C, R) {
    g.fillStyle = C[0]; g.fillRect(0, 0, S, S);
    for (const [col, k] of [[C[1], 1], [C[2], 0.6]]) {
      g.fillStyle = col;
      for (let i = 0; i < 6; i++) {
        const y = 40 + i * 36 + R() * 10, len = (120 + R() * 110) * k;
        g.beginPath(); g.moveTo(0, y - 10 * k);
        g.bezierCurveTo(len * 0.4, y - 26 * k, len * 0.7, y - 4, len, y - 14 * k);
        g.bezierCurveTo(len * 0.7, y + 4, len * 0.4, y + 18 * k, 0, y + 10 * k);
        g.fill();
      }
    }
  },
  scroll(g, C) {
    g.fillStyle = C[0]; g.fillRect(0, 0, S, S);
    g.strokeStyle = C[1]; g.lineWidth = 2.5;
    for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) {
      for (const s of [1, -1]) { g.beginPath(); g.arc(x + 32 + s * 12, y + 32, 12, 0, Math.PI * 1.6 * s, s < 0); g.stroke(); g.beginPath(); g.arc(x + 32 + s * 20, y + 26, 6, 0, Math.PI * 1.4); g.stroke(); }
      g.beginPath(); g.moveTo(x, y + 32); g.bezierCurveTo(x + 16, y + 10, x + 48, y + 54, x + 64, y + 32); g.stroke();
    }
  },
  leaves(g, C, R) {
    g.fillStyle = C[0]; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      const x = R() * S, y = R() * S, a = R() * 6.3, l = 10 + R() * 12, col = C[1 + (i % 2)];
      wrap(g, () => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, l, l * 0.4, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.moveTo(-l, 0); g.lineTo(l, 0); g.stroke(); g.restore(); });
    }
  },
  grass(g, C, R) {
    g.fillStyle = C[2]; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      const x = R() * S, y = R() * S, l = 6 + R() * 16;
      g.strokeStyle = C[i % 2]; g.lineWidth = 1.5;
      wrap(g, () => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 8, y - l); g.stroke(); });
    }
  },
  scales(g, C, R, glow) {
    glow.fillStyle = C[2]; glow.fillRect(0, 0, S, S);
    g.fillStyle = C[2]; g.fillRect(0, 0, S, S);
    const P = 32;
    for (let row = 0; row < S / (P / 2) + 1; row++) for (let x = -P; x < S + P; x += P) {
      const cx = x + (row % 2) * (P / 2), cy = row * (P / 2);
      const grd = g.createRadialGradient(cx, cy - 6, 2, cx, cy, P * 0.55);
      grd.addColorStop(0, C[1]); grd.addColorStop(1, C[0]);
      for (const [ctx, fill] of [[g, grd], [glow, '#000']]) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, P * 0.48, 0, Math.PI); ctx.lineTo(cx - P * 0.48, cy - P * 0.3); ctx.arc(cx, cy - P * 0.3, P * 0.48, Math.PI, 0); ctx.fill(); }
    }
  },
  grid(g, C, R, glow) {
    for (const [ctx, bg] of [[g, C[0]], [glow, '#000']]) {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
      ctx.lineWidth = 3;
      for (let i = 0; i < S; i += 32) { ctx.strokeStyle = C[1]; ctx.beginPath(); ctx.moveTo(0, i + 1.5); ctx.lineTo(S, i + 1.5); ctx.stroke(); ctx.strokeStyle = C[2]; ctx.beginPath(); ctx.moveTo(i + 1.5, 0); ctx.lineTo(i + 1.5, S); ctx.stroke(); }
    }
  },
  squiggle(g, C, R) {
    g.fillStyle = C[2]; g.fillRect(0, 0, S, S);
    g.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const y0 = R() * S, x0 = R() * S, col = C[i % 2];
      wrap(g, () => { g.strokeStyle = col; g.lineWidth = 9; g.beginPath(); for (let k = 0; k <= 12; k++) { const x = x0 + k * 10, y = y0 + Math.sin(k * 1.3) * 10; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
    }
  },
};

function mix(a, b, k) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString(); }

// The material for a gun skin (cached: every gun wearing it shares it). null: unknown.
export function gunSkinMaterial(id) {
  if (cache.has(id)) return cache.get(id);
  const s = GUN_SKIN_BY_ID[id];
  if (!s) return null;
  const L = s.look, R = rng(seedOf(id));
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const gc = document.createElement('canvas'); gc.width = gc.height = S;
  const gg = gc.getContext('2d');
  (PAINT[L.kind] || PAINT.blots)(g, L.colors, R, gg);
  const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.anisotropy = 4; return t; };
  const map = tex(c);
  const o = { map, roughness: L.rough ?? 0.5, metalness: L.metal ?? 0.25 };
  if (L.glow) Object.assign(o, { emissive: new THREE.Color('#ffffff'), emissiveMap: ['galaxy', 'cracks', 'scales', 'grid'].includes(L.kind) ? tex(gc) : map, emissiveIntensity: L.glow });
  const m = new THREE.MeshStandardMaterial(o);
  m.userData.gunSkin = id;
  cache.set(id, m);
  if (L.move) moving.push(m);
  return m;
}

// The moving skins drift and pulse (once a frame)
export function animateGunSkins(t) {
  for (const m of moving) {
    m.map.offset.set(t * 0.02, t * 0.03);
    if (m.emissiveMap) { m.emissiveMap.offset.copy(m.map.offset); m.emissiveIntensity = (GUN_SKIN_BY_ID[m.userData.gunSkin].look.glow || 1) * (0.85 + Math.sin(t * 2.4) * 0.15); }
  }
}
