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
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; this.count = 0; }

  // b: {minX,minY,minZ,maxX,maxY,maxZ}. skip: set of face indices to omit (0..5 = +x,-x,+y,-y,+z,-z)
  add(b, { skip = null, uvScale = 1, uvOffset = [0, 0] } = {}) {
    const x0 = b.minX, x1 = b.maxX, y0 = b.minY, y1 = b.maxY, z0 = b.minZ, z1 = b.maxZ;
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
      const base = this.count;
      for (const c of corners[f]) {
        this.pos.push(c[0], c[1], c[2]);
        this.nor.push(...face.n);
        const [u, v] = face.uv(c[0], c[1], c[2]);
        this.uv.push(u * uvScale + uvOffset[0], v * uvScale + uvOffset[1]);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      this.count += 4;
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
