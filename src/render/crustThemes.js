// =============================================================================
// Each island of Call of the Crust has its own look and air: the Anvil's forge
// (obsidian, gold veins, embers rising), the Trench Front's molten battlefield
// (scorched ground, lava in the cracks, ash falling), the Research Base's storm
// asteroid (dark metallic rock, violet light, lightning), the Ship Graveyard's
// windswept rock (dust, sandstone, debris on the gale) and the Ice Caves'
// frozen comet (snow, ice, snowfall). Here: the ground textures for each, and
// the fog, sky light and particles you get while you're on it.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';

const R = (s) => { let x = s >>> 0 || 1; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; };

// The air on each island (lerped as you move between them).
export const ATMOS = {
  hub: { fog: '#1d1512', density: 0.0045, sky: '#b08a68', ground: '#2a160c', amb: 0.85, particles: 'embers' },
  trench: { fog: '#2c140a', density: 0.0075, sky: '#d07848', ground: '#3a1408', amb: 0.8, particles: 'ash' },
  research: { fog: '#16142a', density: 0.006, sky: '#8a7ed0', ground: '#1c1830', amb: 0.8, particles: 'sparks' },
  ship: { fog: '#26303a', density: 0.0075, sky: '#a4b0bc', ground: '#2e2a26', amb: 0.85, particles: 'wind' },
  caves: { fog: '#1c2534', density: 0.006, sky: '#8fa6c8', ground: '#2a2a34', amb: 0.8, particles: 'snow' },
  void: { fog: '#0c0c16', density: 0.003, sky: '#7f8db0', ground: '#2a2a34', amb: 0.75, particles: 'none' },
};

// A ground texture: noise and flecks over a base colour, and its glow (the
// light it gives off: a little of its own colour, plus glowing cracks).
function groundTex(seed, { base, vary = 18, flecks = null, cracks = null, strata = null, glowK = 0.32, size = 512 }) {
  const r = R(seed);
  const [c, g] = T.makeCanvas(size, size), [gc, gg] = T.makeCanvas(size, size);
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, size, size);
  // blotches
  for (let i = 0; i < 900; i++) {
    const x = r() * size, y = r() * size, rad = 4 + r() * 40, d = (r() - 0.5) * vary * 2;
    const col = base.map((v) => Math.max(0, Math.min(255, v + d)));
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${col},0.35)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) g.fillRect(x - rad + ox, y - rad + oy, rad * 2, rad * 2);
  }
  if (strata) for (let y = 0; y < size; y += 3 + r() * 9) { g.fillStyle = `rgba(${strata},${0.08 + r() * 0.14})`; g.fillRect(0, y, size, 1 + r() * 3); }
  if (flecks) for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${flecks},${0.2 + r() * 0.5})`; g.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2); }
  // the glow: the texture, dimmed
  gg.globalAlpha = glowK; gg.drawImage(c, 0, 0); gg.globalAlpha = 1;
  if (cracks) {
    for (let i = 0; i < cracks.count; i++) {
      let x = r() * size, y = r() * size, a = r() * 6.28;
      const w = cracks.width * (0.5 + r());
      const pts = [[x, y]];
      for (let s = 0; s < 8 + r() * 14; s++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * (6 + r() * 14); y += Math.sin(a) * (6 + r() * 14); pts.push([x, y]); }
      for (const [ctx, col, ww] of [[g, cracks.dark, w], [gg, cracks.glow, w * 0.8]]) {
        if (!col) continue;
        ctx.strokeStyle = col; ctx.lineWidth = ww; ctx.lineCap = 'round';
        for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
          ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy))); ctx.stroke();
        }
      }
    }
  }
  return { map: T.toTexture(c), glow: T.toTexture(gc) };
}

function mat({ map, glow }, o = {}) {
  map.repeat.set(o.rep ?? 1 / 6, o.rep ?? 1 / 6); glow.repeat.copy(map.repeat);
  return new THREE.MeshStandardMaterial({ map, emissiveMap: glow, emissive: new THREE.Color(o.glowColor || '#ffffff'), emissiveIntensity: o.glowI ?? 1, roughness: o.rough ?? 0.95, metalness: o.metal ?? 0, color: o.color || '#ffffff', bumpMap: o.bump ? map : null, bumpScale: o.bump || 0 });
}

// The ground materials for each island, by surface: top (where you walk),
// rocktop (on top of the rock), cliff (its faces), and the special ones.
let cache = null;
export function themeMaterials(base) {
  if (cache) return cache;
  const ember = 'rgba(255,120,30,0.95)';
  const forgeTop = groundTex(11, { base: [34, 30, 36], vary: 10, flecks: '90,80,70', cracks: { count: 40, width: 1.6, dark: 'rgba(10,8,8,0.8)', glow: 'rgba(255,190,90,0.85)' }, glowK: 0.28 });
  const forgeRock = groundTex(12, { base: [40, 36, 40], vary: 16, flecks: '120,110,100', strata: '10,8,10', glowK: 0.24, cracks: { count: 14, width: 1, dark: null, glow: 'rgba(255,150,60,0.6)' } });
  const scorched = groundTex(21, { base: [44, 30, 24], vary: 16, flecks: '110,100,96', cracks: { count: 70, width: 2.2, dark: 'rgba(12,6,4,0.9)', glow: ember }, glowK: 0.26 });
  const scorchRock = groundTex(22, { base: [58, 38, 30], vary: 18, strata: '20,10,6', flecks: '30,20,16', glowK: 0.24, cracks: { count: 20, width: 1.4, dark: null, glow: 'rgba(255,110,30,0.7)' } });
  const lava = groundTex(23, { base: [255, 110, 20], vary: 50, flecks: '255,220,120', cracks: { count: 60, width: 4, dark: 'rgba(60,10,0,0.9)', glow: 'rgba(80,20,0,0.9)' }, glowK: 1 });
  const metal = groundTex(31, { base: [52, 56, 70], vary: 12, flecks: '150,160,190', cracks: { count: 22, width: 1, dark: 'rgba(16,16,24,0.6)', glow: 'rgba(170,120,255,0.75)' }, glowK: 0.3 });
  const metalRock = groundTex(32, { base: [44, 46, 60], vary: 16, strata: '20,20,34', flecks: '120,120,160', glowK: 0.26, cracks: { count: 10, width: 1, dark: null, glow: 'rgba(160,110,255,0.55)' } });
  const dust = groundTex(41, { base: [128, 112, 90], vary: 18, flecks: '70,60,50', glowK: 0.34 });
  const sandstone = groundTex(42, { base: [116, 100, 82], vary: 16, strata: '60,48,36', flecks: '150,136,110', glowK: 0.3 });
  const mud = groundTex(43, { base: [98, 80, 62], vary: 14, cracks: { count: 120, width: 1.6, dark: 'rgba(40,30,22,0.9)', glow: null }, glowK: 0.3 });
  cache = {
    hub: { top: mat(forgeTop, { rough: 0.7, metal: 0.15 }), rocktop: mat(forgeRock), cliff: mat(forgeRock, { rep: 1 / 5, bump: 2 }), flagstone: base.flagstone },
    trench: { top: mat(scorched, { bump: 1 }), rocktop: mat(scorchRock), cliff: mat(scorchRock, { rep: 1 / 5, bump: 2 }), lava: mat(lava, { glowColor: '#ffffff', glowI: 1.6, rough: 0.6 }) },
    research: { top: mat(metal, { rough: 0.7, metal: 0.25 }), rocktop: mat(metalRock), cliff: mat(metalRock, { rep: 1 / 5, bump: 2 }) },
    ship: { top: mat(dust, { bump: 1 }), rocktop: mat(sandstone), cliff: mat(sandstone, { rep: 1 / 5, bump: 2 }), mud: mat(mud) },
    caves: {},
  };
  return cache;
}

// The sky out in space: stars all round, a nebula band, no horizon.
export function spaceTexture() {
  const W = 2048, H = 1024, [c, g] = T.makeCanvas(W, H), r = R(7331);
  g.fillStyle = '#020309'; g.fillRect(0, 0, W, H);
  const band = (x) => H * 0.5 + Math.sin(x / W * Math.PI * 2 + 0.6) * H * 0.22;
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 2200; i++) {
    const x = r() * W, y = band(x) + (r() - 0.5) * (60 + r() * 220), rad = 10 + r() * 70;
    const col = r() < 0.4 ? [120, 70, 255] : r() < 0.5 ? [255, 90, 160] : r() < 0.5 ? [60, 190, 255] : [255, 200, 140];
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${col},${0.04 + r() * 0.05})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (const [x, y, rad, col] of [[300, 300, 360, '150,60,220'], [1300, 420, 420, '40,150,220'], [1750, 620, 300, '230,70,140'], [820, 700, 280, '60,200,190'], [560, 160, 240, '255,140,60']]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${col},0.2)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 14000; i++) {
    const x = r() * W, y = r() < 0.35 ? band(x) + (r() - 0.5) * 200 : r() * H;
    const b = r(), s = b > 0.995 ? 2.4 : b > 0.96 ? 1.5 : 0.9;
    const tint = r() < 0.15 ? '200,220,255' : r() < 0.1 ? '255,220,190' : '255,255,255';
    g.fillStyle = `rgba(${tint},${0.3 + r() * 0.7})`;
    g.fillRect(x, y, s, s);
    if (b > 0.997) { g.fillStyle = `rgba(${tint},0.25)`; g.fillRect(x - 3, y + s / 2, 6 + s, 0.8); g.fillRect(x + s / 2, y - 3, 0.8, 6 + s); }
  }
  return T.toTexture(c, { repeat: false });
}

// The particles for each island's air: how they look and move.
export const PARTICLES = {
  snow: { color: [0.95, 0.97, 1.0], size: 0.09, fall: 1.2, wind: [0.6, 0], swirl: 0.5, opacity: 0.85, add: false },
  ash: { color: [0.45, 0.42, 0.4], size: 0.07, fall: 0.45, wind: [0.4, 0.2], swirl: 0.6, opacity: 0.8, add: false },
  embers: { color: [2.4, 1.0, 0.3], size: 0.06, fall: -0.9, wind: [0.2, 0.1], swirl: 0.8, opacity: 1, add: true },
  wind: { color: [0.75, 0.72, 0.66], size: 0.05, fall: 0.15, wind: [11, 3], swirl: 1.2, opacity: 0.7, add: false },
  sparks: { color: [1.2, 0.9, 2.4], size: 0.05, fall: -0.2, wind: [0.3, 0.3], swirl: 1.4, opacity: 0.9, add: true },
  none: { color: [1, 1, 1], size: 0.01, fall: 0, wind: [0, 0], swirl: 0, opacity: 0, add: false },
};
