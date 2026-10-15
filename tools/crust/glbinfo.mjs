import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
globalThis.self = globalThis;
class NoTextures { constructor(p) { this.parser = p; this.name = 'no_textures'; } loadTexture() { return Promise.resolve(new THREE.Texture()); } }
const buf = readFileSync('/home/claude/stew-zombies/assets/crust/' + process.argv[2] + '.glb');
const L = new GLTFLoader(); L.register((p) => new NoTextures(p)); L.pluginCallbacks.unshift(L.pluginCallbacks.pop());
const g = await new Promise((res, rej) => L.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
g.scene.updateMatrixWorld(true);
const all = new THREE.Box3();
g.scene.traverse((o) => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); all.union(b); const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()); console.log((o.name + '/' + (o.parent && o.parent.name)).padEnd(28), [o.material.name], 'size', s.toArray().map((v) => v.toFixed(2)).join(' '), 'c', c.toArray().map((v) => v.toFixed(2)).join(' ')); });
console.log('all', all.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2)));
