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
// =============================================================================
import * as THREE from 'three';

const BASE = 'assets/crust/tex/';
const images = new Map();     // name -> { tex (the shared original), waiting: [clones] }

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
  const m = new THREE.MeshStandardMaterial({
    color: tint,
    map: texture(name + '_d', true, scale),
    normalMap: o.normal === 0 ? null : texture(name + '_n', false, scale),
    roughnessMap: texture(name + '_r', false, scale),
    roughness: o.rough ?? 1,
    metalness: o.metal ?? 0,
    side: o.side ?? THREE.FrontSide,
  });
  if (m.normalMap) m.normalScale.set(o.normal ?? 1, o.normal ?? 1);
  // its own light: its colour, dimmed (or a glow map of its own: lava cracks)
  if (o.glowMap) { m.emissiveMap = o.glowMap; m.emissive = new THREE.Color(o.glowColor || '#ffffff'); m.emissiveIntensity = o.glowI ?? 1; }
  else if (o.glow) { m.emissiveMap = m.map; m.emissive = tint.clone().multiplyScalar(o.glow); }
  m.userData.surface = name;
  return m;
}
