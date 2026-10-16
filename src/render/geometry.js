// Geometry helpers: batched world-space boxes with meter-based UVs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Faces: [normal, corner builder]. UVs come from world coordinates so textures
// line up across pieces (u,v in meters; set texture.repeat to scale).
const FACES = [
  { n: [1, 0, 0], uv: (x, y, z) => [-z, y] },
  { n: [-1, 0, 0], uv: (x, y, z) => [z, y] },
  { n: [0, 1, 0], uv: (x, y, z) => [x, -z] },
  { n: [0, -1, 0], uv: (x, y, z) => [x, z] },
  { n: [0, 0, 1], uv: (x, y, z) => [x, y] },
  { n: [0, 0, -1], uv: (x, y, z) => [-x, y] },
];

export class BoxBatch {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; this.count = 0; this.boxes = []; }

  // b: {minX,minY,minZ,maxX,maxY,maxZ}. skip: set of face indices to omit (0..5 = +x,-x,+y,-y,+z,-z)
  // cell: split each face into quads no bigger than this (metres), so per-vertex
  // baked lighting has somewhere to live.
  add(b, { skip = null, uvScale = 1, uvOffset = [0, 0], cell = 0 } = {}) {
    const x0 = b.minX, x1 = b.maxX, y0 = b.minY, y1 = b.maxY, z0 = b.minZ, z1 = b.maxZ;
    this.boxes.push({ minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1 });
    const corners = [
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], // +x
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], // -x
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], // +y
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], // -y
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], // +z
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], // -z
    ];
    for (let f = 0; f < 6; f++) {
      if (skip && skip.has(f)) continue;
      const face = FACES[f];
      const [c0, c1, c2, c3] = corners[f];
      const len = (a, b2) => Math.hypot(b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]);
      const nu = cell > 0 ? Math.max(1, Math.ceil(len(c0, c1) / cell - 1e-6)) : 1;
      const nv = cell > 0 ? Math.max(1, Math.ceil(len(c0, c3) / cell - 1e-6)) : 1;
      const base = this.count;
      for (let j = 0; j <= nv; j++) {
        const t = j / nv;
        for (let i = 0; i <= nu; i++) {
          const s2 = i / nu;
          // bilinear across the quad c0 -> c1 (s) and c0 -> c3 (t)
          const p = [0, 1, 2].map((k) => (c0[k] + (c1[k] - c0[k]) * s2) * (1 - t) + (c3[k] + (c2[k] - c3[k]) * s2) * t);
          this.pos.push(p[0], p[1], p[2]);
          this.nor.push(...face.n);
          const [u, v] = face.uv(p[0], p[1], p[2]);
          this.uv.push(u * uvScale + uvOffset[0], v * uvScale + uvOffset[1]);
        }
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = base + j * (nu + 1) + i, b2 = a + 1, c = a + (nu + 1) + 1, d = a + (nu + 1);
        this.idx.push(a, b2, c, a, c, d);
      }
      this.count += (nu + 1) * (nv + 1);
    }
    return this;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.userData.boxes = this.boxes;   // the solid boxes, for baking shadows
    return g;
  }
}

export function boxMesh(b, material, opts) {
  const m = new THREE.Mesh(new BoxBatch().add(b, opts).build(), material);
  return m;
}

// A box centered at (x,y,z) with size (w,h,d) as a {min,max} record.
export const bx = (x, y, z, w, h, d) => ({
  minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2, minZ: z - d / 2, maxZ: z + d / 2,
});

// Static scenery, merged: meshes that never move, show or hide on their own and
// share a material (fence posts, dead trees, crates, rocks...) are drawn as one
// mesh per material in each `cell`-metre square of the map, not one each. Only
// what's marked: userData.static on the mesh or on a group it's in. Run once the
// map's built (and its light-blocking boxes are collected). Each merged copy
// keeps its material, so anything that changes the material still shows.
const KEEP = ['position', 'normal', 'uv'];
export function mergeStatic(root, { cell = 24 } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const m4 = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.children.length || o.layers.mask !== 1) return;
    let marked = false;
    for (let q = o; q && q !== root; q = q.parent) { if (!q.visible) return; if (q.userData.static) marked = true; }
    const mat = o.material, g = o.geometry;
    if (!marked || !g || !g.attributes.position || Object.keys(g.morphAttributes || {}).length) return;
    // (see-through things are drawn in order, back to front: leave them be)
    if (mat.transparent || mat.blending !== THREE.NormalBlending) return;
    const attrs = KEEP.filter((a) => g.attributes[a]);
    if (!attrs.includes('normal')) return;
    m4.multiplyMatrices(inv, o.matrixWorld);
    const e = o.matrixWorld.elements;
    const flip = m4.determinant() < 0;
    const key = mat.uuid + '|' + attrs.join(',') + '|' + Math.floor(e[12] / cell) + ',' + Math.floor(e[14] / cell) + (flip ? '|f' : '') + (o.castShadow ? '|s' : '') + (o.receiveShadow ? '|r' : '');
    if (!buckets.has(key)) buckets.set(key, { mat, attrs, flip, cast: o.castShadow, recv: o.receiveShadow, list: [] });
    buckets.get(key).list.push({ o, m: m4.clone() });
  });
  let merged = 0;
  for (const B of buckets.values()) {
    if (B.list.length < 2) continue;
    const geos = B.list.map(({ o, m }) => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const a of Object.keys(g.attributes)) if (!B.attrs.includes(a)) g.deleteAttribute(a);
      g.morphAttributes = {};
      g.applyMatrix4(m);
      // (a mirrored copy turns its triangles inside out: turn them back)
      if (B.flip) for (const a of B.attrs) {
        const at = g.attributes[a], n = at.itemSize, arr = at.array;
        for (let t = 0; t < at.count; t += 3) for (let k = 0; k < n; k++) { const i1 = (t + 1) * n + k, i2 = (t + 2) * n + k, x = arr[i1]; arr[i1] = arr[i2]; arr[i2] = x; }
      }
      return g;
    });
    const geo = mergeGeometries(geos);
    if (!geo) continue;
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, B.mat);
    mesh.castShadow = B.cast; mesh.receiveShadow = B.recv;
    mesh.userData.noBake = true;
    root.add(mesh);
    for (const { o } of B.list) o.parent.remove(o);
    merged += B.list.length - 1;
  }
  return merged;
}
