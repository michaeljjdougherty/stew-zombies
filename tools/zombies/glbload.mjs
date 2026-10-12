// Load a GLB in node with three's GLTFLoader (textures captured as their file bytes, not decoded).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
import { blobs } from './fbxload.mjs';

class CaptureTextures {
  constructor(parser) { this.parser = parser; this.name = 'capture_textures'; }
  loadTexture(index) {
    const json = this.parser.json, def = json.textures[index];
    const ext = def.extensions || {};
    const src = (ext.EXT_texture_webp || ext.KHR_texture_basisu || def).source ?? def.source;
    const img = json.images[src];
    return this.parser.getDependency('bufferView', img.bufferView).then((buf) => {
      const url = 'glb:img' + src;
      if (!blobs.has(url)) blobs.set(url, new Blob([buf], { type: img.mimeType }));
      const t = new THREE.Texture(); t.userData.url = url; return t;
    });
  }
}

export function loadGLB(path) {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();
  loader.register((p) => new CaptureTextures(p));
  loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return new Promise((res, rej) => loader.parse(ab, '', (g) => {
    // glTF's v runs the other way to FBX's (the game flips zombie textures on load)
    g.scene.traverse((o) => { if (o.isMesh && o.geometry.attributes.uv && !o.geometry.userData.flipped) { const u = o.geometry.attributes.uv; for (let i = 0; i < u.count; i++) u.setY(i, 1 - u.getY(i)); o.geometry.userData.flipped = true; } });
    res(g.scene);
  }, rej));
}
