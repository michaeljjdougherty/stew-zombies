// Load an FBX in node with three's FBXLoader (textures captured, not decoded).
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { readFileSync } from 'node:fs';

export const blobs = new Map();
URL.createObjectURL = (blob) => { const id = 'blob:conv/' + blobs.size; blobs.set(id, blob); return id; };
THREE.TextureLoader.prototype.load = function (url) { const t = new THREE.Texture(); t.userData.url = url; return t; };
globalThis.self = globalThis;
globalThis.window = globalThis;

export function loadFBX(path) {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new FBXLoader();
  const origWarn = console.warn; console.warn = () => {};
  try { return loader.parse(ab, ''); } finally { console.warn = origWarn; }
}
export { THREE };
