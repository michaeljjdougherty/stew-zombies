// =============================================================================
// The Cheddar hound: a skinless, cheddar-yellow beast (built offline by
// tools/cheddar/build_hound.py). Loads once; each hound gets its own skeleton.
// Bones: body, hips, neck, head, jaw, fhipL/R, fkneeL/R, rhipL/R, rkneeL/R,
// tail0..3. Rest rotations are all identity, so the animation code can set
// rotation.x on them the same way it did on the old built-in-code dogs.
// =============================================================================
import * as THREE from 'three';

const BASE = 'assets/cheddar/';

async function fetchBin(name) {
  try {
    const r = await fetch(BASE + name + '.bin');
    if (r.ok) return await r.arrayBuffer();
  } catch { /* try the other form */ }
  const r = await fetch(BASE + name + '.bin.json');
  if (!r.ok) throw new Error(name + '.bin ' + r.status);
  const s = atob((await r.json()).b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}

class HoundLib {
  constructor() { this.ready = false; this.failed = false; this.loading = null; }

  load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const [meta, bin] = await Promise.all([fetch(BASE + 'hound.json').then((r) => r.json()), fetchBin('hound')]);
      const L = meta.layout, n = meta.verts;
      const view = (T, k) => new T(bin, L[k][0], L[k][1]);
      // positions: uint16 within the bounding box
      const q = view(Uint16Array, 'pos'), lo = meta.lo, hi = meta.hi;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) { const a = i % 3; pos[i] = lo[a] + (q[i] / 65535) * (hi[a] - lo[a]); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(view(Uint16Array, 'uv0'), 2, true));
      g.setAttribute('uv1', new THREE.BufferAttribute(view(Uint16Array, 'uv1'), 2, true));
      g.setAttribute('skinIndex', new THREE.BufferAttribute(view(Uint8Array, 'si'), 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(view(Uint8Array, 'sw'), 4, true));
      g.setIndex(new THREE.BufferAttribute(view(Uint16Array, 'idx'), 1));
      // normals are packed in 4 bytes (xyz + pad): give three a 3-wide view
      const nb = view(Int8Array, 'nrm'), n3 = new Int8Array(n * 3);
      for (let i = 0; i < n; i++) { n3[i * 3] = nb[i * 4]; n3[i * 3 + 1] = nb[i * 4 + 1]; n3[i * 3 + 2] = nb[i * 4 + 2]; }
      g.setAttribute('normal', new THREE.BufferAttribute(n3, 3, true));
      g.computeBoundingSphere();
      g.boundingSphere.radius *= 1.6;   // the legs swing out of the rest pose

      const tl = new THREE.TextureLoader();
      const tex = (f, srgb) => new Promise((res) => tl.load(BASE + f, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; res(t); }, undefined, () => res(null)));
      const [map, normalMap, roughnessMap] = await Promise.all([tex(meta.textures.map, true), tex(meta.textures.normalMap, false), tex(meta.textures.roughnessMap, false)]);
      if (normalMap) normalMap.channel = 1;   // the normal map is laid out on the second UV set
      this.material = new THREE.MeshStandardMaterial({
        map, normalMap, roughnessMap, roughness: 0.9, metalness: 0.0,
        normalScale: new THREE.Vector2(1, 1), side: THREE.DoubleSide,
        emissive: new THREE.Color(0.12, 0.06, 0.0), emissiveMap: map,
      });
      this.geometry = g;
      this.bones = meta.bones;
      this.ready = true;
    })().catch((err) => { console.warn('hound model:', err); this.failed = true; });
    return this.loading;
  }

  // A new hound: { root (Group, model faces +z), mesh, bone: {name: Bone} }
  instance() {
    const byName = {};
    const bones = this.bones.map((b) => { const o = new THREE.Bone(); o.name = b.name; byName[b.name] = o; return o; });
    let rootBone = null;
    this.bones.forEach((b, i) => {
      const o = bones[i];
      const pp = b.parent ? this.bones.find((q) => q.name === b.parent).pos : [0, 0, 0];
      o.position.set(b.pos[0] - pp[0], b.pos[1] - pp[1], b.pos[2] - pp[2]);
      if (b.parent) byName[b.parent].add(o); else rootBone = o;
    });
    const mesh = new THREE.SkinnedMesh(this.geometry, this.material);
    mesh.add(rootBone);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.castShadow = false;
    const root = new THREE.Group();
    root.add(mesh);
    for (const b of bones) b.userData.rest = b.position.clone();
    return { root, mesh, bone: byName };
  }
}

export const houndModel = new HoundLib();
