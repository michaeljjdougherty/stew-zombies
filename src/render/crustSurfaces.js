// =============================================================================
// Photo surfaces for Call of the Crust (assets/crust/tex/: Poly Haven, CC0):
// colour, normal and roughness maps, tiled in metres. Every surface the map
// is built from comes through here: the ground and the cliffs of each island,
// trench boards, decks and grates, the buildings' walls.
//
//   surface('rock_wall_10', { scale: 3, tint: '#a09080', glow: 0.25 })
//
// scale: metres one tile covers. tint: multiplies the colour. glow: how much
// of its own colour it gives off (the islands are lit by a few lamps and the
// stars: a little self-light keeps them readable). normal: bump strength.
// The maps stream in; until they arrive the material shows its tint.
//
// The Trench Front's lava (lava_crust: cooled crust with glowing seams; and
// lava_molten: the molten stuff in the cracks) comes from the lava model in
// the project's assets (assets/NEW/lava.glb), with a glow map of its own
// (_e); the molten flows (flow: m/s) and its glow breathes (pulse).
// =============================================================================
import * as THREE from 'three';

const BASE = 'assets/crust/tex/';
const images = new Map();     // name -> { tex (the shared original), waiting: [clones] }
// surfaces whose roughness is one flat value all over (no map to download)
const FLAT_ROUGH = { rock_face: 0.835, concrete_wall_008: 0.741, coast_sand_01: 0.965 };
// surfaces that move: { textures, flow: [u, v] in tiles a second, m, glow, pulse }
export const FLOWING = [];
export function updateSurfaces(dt, time) {
  for (const f of FLOWING) {
    if (f.flow) for (const t of f.textures) { t.offset.x = (t.offset.x + f.flow[0] * dt) % 1; t.offset.y = (t.offset.y + f.flow[1] * dt) % 1; }
    if (f.pulse) f.m.emissiveIntensity = f.glow * (1 + f.pulse * (Math.sin(time * 1.3) * 0.6 + Math.sin(time * 3.7 + 1) * 0.4));
  }
}

function texture(name, srgb, scale) {
  let rec = images.get(name);
  if (!rec) {
    rec = { img: null, clones: [] };
    images.set(name, rec);
    new THREE.ImageLoader().load(BASE + name + '.webp', (img) => {
      rec.img = img;
      for (const t of rec.clones) { t.image = img; t.needsUpdate = true; }
    }, undefined, () => { /* missing: the tint carries it */ });
  }
  const t = new THREE.Texture();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / scale, 1 / scale);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (rec.img) { t.image = rec.img; t.needsUpdate = true; }
  rec.clones.push(t);
  return t;
}

export function surface(name, o = {}) {
  const scale = o.scale ?? 3;
  const tint = new THREE.Color(o.tint || '#ffffff');
  const flat = FLAT_ROUGH[o.rTex || name];
  const m = new THREE.MeshStandardMaterial({
    color: tint,
    map: texture(name + '_d', true, scale),
    normalMap: o.normal === 0 ? null : texture((o.nTex || name) + '_n', false, scale),
    roughnessMap: flat != null ? null : texture((o.rTex || name) + '_r', false, scale),
    roughness: o.rough ?? flat ?? 1,
    metalness: o.metal ?? 0,
    side: o.side ?? THREE.FrontSide,
  });
  if (m.normalMap) m.normalScale.set(o.normal ?? 1, o.normal ?? 1);
  // its own light: its colour, dimmed (or a glow map of its own: lava cracks)
  if (o.glowTex) { m.emissiveMap = texture(name + '_e', true, scale); m.emissive = new THREE.Color(o.glowColor || '#ffffff'); m.emissiveIntensity = o.glowI ?? 1; }
  else if (o.glowMap) { m.emissiveMap = o.glowMap; m.emissive = new THREE.Color(o.glowColor || '#ffffff'); m.emissiveIntensity = o.glowI ?? 1; }
  else if (o.glow) { m.emissiveMap = m.map; m.emissive = tint.clone().multiplyScalar(o.glow); }
  if (o.flow || o.pulse) FLOWING.push({ textures: [m.map, m.normalMap, m.roughnessMap, m.emissiveMap].filter(Boolean), flow: o.flow, m, glow: m.emissiveIntensity, pulse: o.pulse || 0 });
  m.userData.surface = name;
  return m;
}
