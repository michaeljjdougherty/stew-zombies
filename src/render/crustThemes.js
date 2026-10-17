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
import { surface } from './crustSurfaces.js';
import { CONFIG } from '../config.js';

const R = (s) => { let x = s >>> 0 || 1; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; };

// The air on each island (lerped as you move between them).
export const ATMOS = {
  // key: the light from the brightest thing in this island's sky (a nebula, a
  // burning horizon, the storm), keyI its strength; skyTint: the sky's colour once
  // you're standing on the island (its element: wind, lightning, fire, ice; none on the Anvil)
  hub: { fog: '#1a1618', density: 0.0045, sky: '#aaa0b0', ground: '#2c2220', amb: 1.0, key: '#ffc898', keyI: 1.25, mist: { color: '#6a4c3c', opacity: 0.42, glow: '#ff7a30' }, particles: 'embers' },
  trench: { fog: '#2c140a', density: 0.0065, sky: '#d88858', ground: '#40180a', amb: 0.95, key: '#ffa070', keyI: 1.2, mist: { color: '#5c3424', opacity: 0.55, glow: '#ff4a10' }, particles: 'ash', skyTint: '#ffb088' },
  research: { fog: '#16142a', density: 0.0055, sky: '#9a8ee0', ground: '#24203a', amb: 0.95, key: '#c0c8ff', keyI: 1.2, mist: { color: '#5c4ca8', opacity: 0.45, glow: '#a070ff' }, particles: 'sparks', skyTint: '#c4b0ff' },
  ship: { fog: '#26303a', density: 0.0065, sky: '#b4c0cc', ground: '#3a342e', amb: 1.0, key: '#d8e4f4', keyI: 1.2, mist: { color: '#2f8a76', opacity: 0.45, glow: '#3fe0b0' }, particles: 'wind', skyTint: '#a8f0d8' },
  caves: { fog: '#1c2534', density: 0.0055, sky: '#9fb6d8', ground: '#323440', amb: 0.95, key: '#c8e0ff', keyI: 1.2, mist: { color: '#a8cdf4', opacity: 0.55, glow: '#5aa8ff' }, particles: 'snow', skyTint: '#b0dcff' },
  void: { fog: '#0c0c16', density: 0.003, sky: '#7f8db0', ground: '#2a2a34', amb: 0.85, key: '#b0c0e8', keyI: 0.9, particles: 'none' },
};

// A ground texture: noise and flecks over a base colour, and its glow (the
// The ground materials for each island, by surface: top (where you walk),
// rocktop (on top of the rock), cliff (its faces: walls never look like the
// floor), the special floors (cobble, flagstone, mud, planks, duckboard, lava,
// ice), the trench walls, the cave ceilings and the rock underneath.
// Photo surfaces (src/render/crustSurfaces.js); the lava and the glowing
// cracks in the Trench Front's ground are still painted.
let cache = null;
export function themeMaterials(base) {
  if (cache) return cache;
  cache = {
    hub: {
      top: surface('stone_floor', { scale: 2.5, tint: '#aaa8aa', glow: 0.18 }),
      cobble: surface('cobblestone_floor_08', { scale: 2.2, tint: '#a0a0a8', glow: 0.16 }),
      flagstone: surface('stone_floor', { scale: 4, tint: '#a4a0a0', glow: 0.18 }),
      rocktop: surface('lichen_rock', { scale: 5, tint: '#8a8078', glow: 0.14 }),
      cliff: surface('rock_wall_10', { scale: 3.2, tint: '#a89888', glow: 0.16, normal: 1.4 }),
      wall: surface('rock_wall_08', { scale: 2.6, tint: '#a8acb8', glow: 0.17, normal: 1.3 }),
      wallTop: surface('stone_floor', { scale: 2.5, tint: '#a09080', glow: 0.16 }),
      under: surface('lichen_rock', { scale: 9, tint: '#6a6058', glow: 0.1, side: THREE.DoubleSide }),
    },
    trench: {
      // (the ground's cooled lava crust, glowing at its seams; molten lava in the cracks, flowing)
      top: surface('lava_crust', { scale: 6, tint: '#8a7a74', glowTex: true, glowColor: '#ff6a24', glowI: 0.42, normal: 1.3, pulse: 0.15 }),
      duckboard: surface('dark_wooden_planks', { scale: 2.2, tint: '#a08870', glow: 0.18 }),
      trench: surface('wood_planks_dirt', { scale: 2.4, tint: '#a08870', glow: 0.16 }),
      rocktop: surface('rock_face', { scale: 4, tint: '#8a5a48', glow: 0.14 }),
      cliff: surface('rock_face', { scale: 4, tint: '#7a4c3c', glow: 0.14, normal: 1.3 }),
      lava: surface('lava_molten', { scale: 3.5, nTex: 'lava_crust', rTex: 'lava_crust', glowTex: true, glowColor: '#ffb070', glowI: 2.6, normal: 0.5, flow: [0.012, 0.02], pulse: 0.2 }),
      under: surface('rock_face', { scale: 9, tint: '#5a3a30', glow: 0.1, side: THREE.DoubleSide }),
    },
    research: {
      top: surface('concrete_floor_02', { scale: 4, tint: '#a8a8b4', glow: 0.18 }),
      concrete: surface('concrete_wall_008', { scale: 3, tint: '#a0a0a8', glow: 0.18 }),
      concreteTop: surface('concrete_floor_02', { scale: 3, tint: '#8a8a94', glow: 0.16 }),
      rocktop: surface('rock_face_03', { scale: 4, tint: '#8a88a0', glow: 0.14 }),
      cliff: surface('rock_face_03', { scale: 4, tint: '#7a7890', glow: 0.14, normal: 1.3 }),
      under: surface('rock_face_03', { scale: 9, tint: '#55546a', glow: 0.1, side: THREE.DoubleSide }),
    },
    ship: {
      top: surface('coast_sand_01', { scale: 3.5, tint: '#c8b8a0', glow: 0.18 }),
      mud: surface('muddy_tracks', { scale: 3, tint: '#8a7a68', glow: 0.14 }),
      planks: surface('brown_planks_05', { scale: 2.5, tint: '#c0b0a0', glow: 0.18 }),
      rocktop: surface('coast_land_rocks_01', { scale: 4, tint: '#a09484', glow: 0.14 }),
      cliff: surface('coast_land_rocks_01', { scale: 4, tint: '#8a7c6c', glow: 0.14, normal: 1.3 }),
      under: surface('coast_land_rocks_01', { scale: 9, tint: '#5a5248', glow: 0.1, side: THREE.DoubleSide }),
    },
    caves: {
      top: surface('snow_02', { scale: 3, tint: '#dce4f0', glow: 0.22 }),
      rocktop: surface('snow_02', { scale: 4, tint: '#c4cede', glow: 0.2 }),
      ice: surface('snow_02', { scale: 4, tint: '#9cc4e4', glow: 0.22, rough: 0.35, metal: 0.05, normal: 0.6 }),
      iceside: surface('rock_face_03', { scale: 3, tint: '#a8cce8', glow: 0.22, rough: 0.4, normal: 1.2 }),
      cave: surface('rock_face_03', { scale: 3, tint: '#6a88a4', glow: 0.18 }),
      cliff: surface('lichen_rock', { scale: 4, tint: '#8a98b0', glow: 0.14, normal: 1.3 }),
      planks: surface('dark_wooden_planks', { scale: 2.2, tint: '#a09080', glow: 0.18 }),
      under: surface('rock_face_03', { scale: 9, tint: '#506478', glow: 0.1, side: THREE.DoubleSide }),
    },
  };
  return cache;
}


// The sky out in space: a calm one. A soft nebula band and not too many stars,
// small and sharp (a big, busy star field upscaled over the whole dome was too
// much to look at). Numbers: CONFIG.crust.sky.
export function spaceTexture() {
  const S = CONFIG.crust.sky;
  const [W, H] = S.size, [c, g] = T.makeCanvas(W, H), r = R(7331), k = W / 2048;
  g.fillStyle = '#020309'; g.fillRect(0, 0, W, H);
  const band = (x) => H * 0.5 + Math.sin(x / W * Math.PI * 2 + 0.6) * H * 0.22;
  // the nebula: soft glows along a band, and a few big washes of colour
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 2200; i++) {
    const x = r() * W, y = band(x) + (r() - 0.5) * (60 + r() * 220) * k, rad = (10 + r() * 70) * k;
    const col = r() < 0.4 ? [120, 70, 255] : r() < 0.5 ? [255, 90, 160] : r() < 0.5 ? [60, 190, 255] : [255, 200, 140];
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${col},${(0.04 + r() * 0.05) * S.nebula})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (const [x, y, rad, col] of [[300, 300, 360, '150,60,220'], [1300, 420, 420, '40,150,220'], [1750, 620, 300, '230,70,140'], [820, 700, 280, '60,200,190'], [560, 160, 240, '255,140,60']]) {
    const gr = g.createRadialGradient(x * k, y * k, 0, x * k, y * k, rad * k);
    gr.addColorStop(0, `rgba(${col},${0.2 * S.nebula})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect((x - rad) * k, (y - rad) * k, rad * 2 * k, rad * 2 * k);
  }
  g.globalCompositeOperation = 'source-over';
  // the stars: mostly faint pinpricks, a few brighter ones; a little thicker along the band
  for (let i = 0; i < S.stars; i++) {
    const x = r() * W, y = r() < 0.3 ? band(x) + (r() - 0.5) * 200 * k : r() * H;
    const tint = r() < 0.15 ? '200,220,255' : r() < 0.1 ? '255,220,190' : '255,255,255';
    g.fillStyle = `rgba(${tint},${S.faint[0] + r() * (S.faint[1] - S.faint[0])})`;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  for (let i = 0; i < S.bright; i++) {
    const x = r() * W, y = r() * H, tint = r() < 0.2 ? '200,220,255' : r() < 0.15 ? '255,220,190' : '255,255,255';
    const gr = g.createRadialGradient(x, y, 0, x, y, 2.2);
    gr.addColorStop(0, `rgba(${tint},${0.75 + r() * 0.25})`); gr.addColorStop(1, `rgba(${tint},0)`);
    g.fillStyle = gr; g.fillRect(x - 3, y - 3, 6, 6);
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
