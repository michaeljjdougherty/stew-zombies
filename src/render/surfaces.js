// =============================================================================
// Photo surfaces. Real CC0 photo-scanned materials (ambientCG, via
// tools/make_textures.py) laid over the game's painted textures.
//
// Each surface is a pair of tiling images in assets/tex/:
//   <name>_d.jpg  fine detail (brick, grain, flecks), stored as colour ratio / 4
//   <name>_n.jpg  normal map (OpenGL convention)
// A material keeps its painted canvas map (paint colours, stripes, grime,
// stains: the art direction) and the shader multiplies in the photo detail and
// lights it with the photo's normals. The detail tiles at its own real-world
// size, independent of the painted map. A wall can use a second surface below
// a height (cinder block above, glazed tile below the stripe).
//
// The images load in the background; until they arrive the placeholders are
// neutral, so nothing waits on them and nothing breaks without them.
// =============================================================================
import * as THREE from 'three';
import { addShaderPatch } from './shaderPatch.js';

export const TEX_BASE = 'assets/tex/';

// size: metres covered by one copy of the image; normal: bump strength
export const SURFACES = {
  block:     { size: [2.0, 2.0], normal: 1.0 },
  blockRaw:  { size: [1.7, 1.7], normal: 1.0 },
  brick:     { size: [1.35, 1.35], normal: 1.1 },
  plaster:   { size: [2.4, 1.2], normal: 0.8 },
  tileWall:  { size: [1.2, 1.2], normal: 0.9 },
  gymFloor:  { size: [1.4, 1.4], normal: 0.6 },
  woodFloor: { size: [2.2, 1.1], normal: 1.0 },
  vct:       { size: [1.0, 1.0], normal: 0.4 },
  tileFloor: { size: [2.4, 2.4], normal: 1.0 },
  concrete:  { size: [3.0, 3.0], normal: 0.9 },
  ceiling:   { size: [3.6, 3.6], normal: 1.0 },
  carpet:    { size: [1.2, 1.2], normal: 1.0 },
  asphalt:   { size: [2.5, 2.5], normal: 1.0 },
  grass:     { size: [1.6, 1.6], normal: 1.0 },
  ground:    { size: [2.5, 2.5], normal: 1.0 },
  wood:      { size: [1.2, 0.6], normal: 0.8 },
  panel:     { size: [0.6, 1.2], normal: 0.8 },
  metal:     { size: [1.2, 1.2], normal: 0.8 },
};

let anisotropy = 4;
export function setSurfaceAnisotropy(n) { anisotropy = n; for (const s of cache.values()) { s.d.anisotropy = n; s.n.anisotropy = n; } }

// 1x1 stand-ins: detail ratio 1 (64/255 * 4) and a flat normal
function solid(r, g, b) {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const x = c.getContext('2d'); x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(0, 0, 1, 1);
  return c;
}

const cache = new Map();
let pending = 0;
const waiters = [];
export const surfacesReady = () => pending === 0;
export function onSurfacesReady(fn) { if (pending === 0) fn(); else waiters.push(fn); }

function tex(img, size) {
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.repeat.set(1 / size[0], 1 / size[1]);
  t.needsUpdate = true;
  return t;
}

function loadInto(t, url) {
  pending++;
  const img = new Image();
  img.decoding = 'async';
  const done = () => { if (--pending === 0) { for (const f of waiters.splice(0)) f(); } };
  // dispose first: the GPU copy was allocated at the placeholder's 1x1 size
  img.onload = () => { t.dispose(); t.image = img; t.needsUpdate = true; done(); };
  img.onerror = () => { console.warn('[surfaces] could not load', url); done(); };
  img.src = url;
}

export function surface(name) {
  if (cache.has(name)) return cache.get(name);
  const def = SURFACES[name];
  if (!def) throw new Error('unknown surface ' + name);
  const s = { name, def, d: tex(solid(64, 64, 64), def.size), n: tex(solid(128, 128, 255), def.size) };
  loadInto(s.d, `${TEX_BASE}${name}_d.jpg`);
  loadInto(s.n, `${TEX_BASE}${name}_n.jpg`);
  cache.set(name, s);
  return s;
}

const FRAG_PARS = /* glsl */`
uniform sampler2D detailMap;
uniform float detailStrength;
#ifdef DETAIL_SPLIT
  uniform sampler2D detailMapB;
  uniform sampler2D normalMapB;
  uniform vec2 detailBScale;
  uniform float detailSplit;
#endif
`;

const FRAG_MAP = /* glsl */`
#include <map_fragment>
float dMask = 0.0;
vec3 dTex = texture2D( detailMap, vNormalMapUv ).rgb;
#ifdef DETAIL_SPLIT
  dMask = 1.0 - smoothstep( detailSplit - 0.002, detailSplit + 0.002, vMapUv.y );
  dTex = mix( dTex, texture2D( detailMapB, vNormalMapUv * detailBScale ).rgb, dMask );
#endif
diffuseColor.rgb *= mix( vec3( 1.0 ), dTex * 4.0, detailStrength );
`;

const FRAG_NORMAL = /* glsl */`
vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
#ifdef DETAIL_SPLIT
  vec3 mapNB = texture2D( normalMapB, vNormalMapUv * detailBScale ).xyz * 2.0 - 1.0;
  mapN = normalize( mix( mapN, mapNB, dMask ) );
#endif
mapN.xy *= normalScale;
normal = normalize( tbn * mapN );
#ifdef USE_BUMPMAP
  normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif
// faces seen exactly edge-on have no slope to work with: keep the plain normal
// (otherwise a few pixels come out NaN, which smears through the reflections)
if ( any( isnan( normal ) ) || dot( normal, normal ) < 0.5 ) normal = nonPerturbedNormal;
`;

function patch(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\n' + FRAG_PARS)
    .replace('#include <map_fragment>', FRAG_MAP)
    .replace('#include <normal_fragment_maps>', FRAG_NORMAL);
}

// Put a photo surface on a material that already has a painted `map`.
//   below/split: a second surface under `split` (0..1 of the map's height, v)
//   strength: how much of the photo's light/dark comes through (0..1)
//   bump: keep a little of the painted map as a bump map (grout, peeling paint)
export function applySurface(mat, name, { below = null, split = 0, strength = 1, bump = 0 } = {}) {
  const A = surface(name);
  mat.normalMap = A.n;
  mat.normalScale = new THREE.Vector2(A.def.normal, A.def.normal);
  if (bump > 0 && mat.map) { mat.bumpMap = mat.map; mat.bumpScale = bump; } else { mat.bumpMap = null; }
  const uniforms = { detailMap: { value: A.d }, detailStrength: { value: strength } };
  mat.defines = { ...(mat.defines || {}) };
  if (below) {
    const B = surface(below);
    mat.defines.DETAIL_SPLIT = '';
    uniforms.detailMapB = { value: B.d };
    uniforms.normalMapB = { value: B.n };
    uniforms.detailBScale = { value: new THREE.Vector2(A.def.size[0] / B.def.size[0], A.def.size[1] / B.def.size[1]) };
    uniforms.detailSplit = { value: split };
  }
  mat.userData.surface = { name, below, uniforms };
  addShaderPatch(mat, 'surface' + (below ? '2' : '1'), (shader) => patch(shader, uniforms));
  return mat;
}

// Turn the photo detail up or down everywhere (settings / debugging).
export function setSurfaceStrength(materials, k) {
  for (const m of materials) if (m.userData.surface) m.userData.surface.uniforms.detailStrength.value = k;
}
