// =============================================================================
// Loading the downloaded models (glTF binaries) the game ships in assets/.
// Textures are decoded straight from the file bytes: the artifact page's
// security rules block the blob: URLs three's loader normally uses (models came
// out white). Hosts that won't serve .glb get a base64 copy (.glb.json).
// =============================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const WRAP = { 33071: THREE.ClampToEdgeWrapping, 33648: THREE.MirroredRepeatWrapping, 10497: THREE.RepeatWrapping };
const FILT = { 9728: THREE.NearestFilter, 9729: THREE.LinearFilter, 9984: THREE.NearestMipmapNearestFilter, 9985: THREE.LinearMipmapNearestFilter, 9986: THREE.NearestMipmapLinearFilter, 9987: THREE.LinearMipmapLinearFilter };

export class BitmapTexturesPlugin {
  constructor(parser) { this.parser = parser; this.name = 'stew_bitmap_textures'; this.cache = new Map(); }
  loadTexture(index) {
    const json = this.parser.json, def = json.textures[index], img = json.images[def.source];
    if (!img || img.bufferView === undefined || typeof createImageBitmap !== 'function') return null;
    if (!this.cache.has(def.source)) {
      this.cache.set(def.source, this.parser.getDependency('bufferView', img.bufferView)
        .then((buf) => createImageBitmap(new Blob([buf], { type: img.mimeType || 'image/png' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })));
    }
    return this.cache.get(def.source).then((bmp) => {
      const t = new THREE.Texture(bmp);
      t.flipY = false;
      const sm = (json.samplers || [])[def.sampler] || {};
      t.magFilter = FILT[sm.magFilter] || THREE.LinearFilter;
      t.minFilter = FILT[sm.minFilter] || THREE.LinearMipmapLinearFilter;
      t.wrapS = WRAP[sm.wrapS] || THREE.RepeatWrapping;
      t.wrapT = WRAP[sm.wrapT] || THREE.RepeatWrapping;
      t.anisotropy = 4;
      t.needsUpdate = true;
      return t;
    }).catch(() => null);
  }
}

let loader = null;
export function gltfLoader() {
  if (!loader) { loader = new GLTFLoader(); loader.register((p) => new BitmapTexturesPlugin(p)); }
  return loader;
}

export async function fetchGlb(url) {
  try {
    const r = await fetch(url);
    if (r.ok) return await r.arrayBuffer();
  } catch { /* try the other form */ }
  const r = await fetch(url + '.json');
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const s = atob((await r.json()).b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}

// Load a model once; resolves to the parsed glTF (or null if it can't load).
const cache = new Map();
export function loadModel(url) {
  if (!cache.has(url)) {
    cache.set(url, fetchGlb(url).then((buf) => gltfLoader().parseAsync(buf, '')).catch((err) => { console.warn('model ' + url + ':', err.message || err); return null; }));
  }
  return cache.get(url);
}
