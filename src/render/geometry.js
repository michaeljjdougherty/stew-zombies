// Geometry helpers: batched world-space boxes with meter-based UVs.
import * as THREE from 'three';

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
