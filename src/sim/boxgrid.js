// =============================================================================
// A grid of boxes over the ground plane, for worlds with thousands of them
// (Call of the Crust's sculpted terrain). The physics and the bullets ask it
// for the boxes near a point, or along a ray, instead of checking them all.
// =============================================================================
import { rayAABB } from '../core/math.js';

export class BoxGrid {
  constructor(boxes, cell = 4) {
    this.cell = cell;
    this.boxes = boxes;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const b of boxes) { x0 = Math.min(x0, b.minX); z0 = Math.min(z0, b.minZ); x1 = Math.max(x1, b.maxX); z1 = Math.max(z1, b.maxZ); }
    if (!boxes.length) { x0 = z0 = 0; x1 = z1 = 1; }
    this.ox = x0 - 0.01; this.oz = z0 - 0.01;
    this.nx = Math.max(1, Math.ceil((x1 - x0 + 0.02) / cell));
    this.nz = Math.max(1, Math.ceil((z1 - z0 + 0.02) / cell));
    this.cells = new Array(this.nx * this.nz);
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
    boxes.forEach((b, i) => {
      const [i0, k0] = this.ij(b.minX, b.minZ), [i1, k1] = this.ij(b.maxX, b.maxZ);
      for (let k = k0; k <= k1; k++) for (let j = i0; j <= i1; j++) this.cells[k * this.nx + j].push(i);
    });
    this.stamp = new Uint32Array(boxes.length);
    this.tick = 0;
    this.out = [];
  }
  ij(x, z) {
    return [Math.max(0, Math.min(this.nx - 1, Math.floor((x - this.ox) / this.cell))), Math.max(0, Math.min(this.nz - 1, Math.floor((z - this.oz) / this.cell)))];
  }
  // Boxes whose footprint might touch the rectangle (reused array: copy it if you keep it).
  query(x0, z0, x1, z1) {
    const out = this.out; out.length = 0;
    if (x1 < this.ox || z1 < this.oz || x0 > this.ox + this.nx * this.cell || z0 > this.oz + this.nz * this.cell) return out;
    this.tick = (this.tick + 1) >>> 0 || 1;
    const [i0, k0] = this.ij(x0, z0), [i1, k1] = this.ij(x1, z1);
    for (let k = k0; k <= k1; k++) for (let j = i0; j <= i1; j++) {
      for (const i of this.cells[k * this.nx + j]) {
        if (this.stamp[i] === this.tick) continue;
        this.stamp[i] = this.tick;
        out.push(this.boxes[i]);
      }
    }
    return out;
  }
  near(x, z, r) { return this.query(x - r, z - r, x + r, z + r); }

  // First box hit along the ray (walking the grid cells it crosses).
  raycast(o, d, maxT) {
    let best = null;
    const C = this.cell;
    let x = o.x, z = o.z;
    let [j, k] = this.ij(x, z);
    const stepJ = d.x > 0 ? 1 : -1, stepK = d.z > 0 ? 1 : -1;
    const nextX = this.ox + (j + (d.x > 0 ? 1 : 0)) * C, nextZ = this.oz + (k + (d.z > 0 ? 1 : 0)) * C;
    let tMaxX = Math.abs(d.x) > 1e-9 ? (nextX - x) / d.x : Infinity;
    let tMaxZ = Math.abs(d.z) > 1e-9 ? (nextZ - z) / d.z : Infinity;
    const tDX = Math.abs(d.x) > 1e-9 ? C / Math.abs(d.x) : Infinity;
    const tDZ = Math.abs(d.z) > 1e-9 ? C / Math.abs(d.z) : Infinity;
    this.tick = (this.tick + 1) >>> 0 || 1;
    let t = 0;
    for (let guard = 0; guard < 4096; guard++) {
      if (j >= 0 && k >= 0 && j < this.nx && k < this.nz) {
        for (const i of this.cells[k * this.nx + j]) {
          if (this.stamp[i] === this.tick) continue;
          this.stamp[i] = this.tick;
          const b = this.boxes[i];
          if (b.ghost) continue;
          const h = rayAABB(o, d, b, best ? best.t : maxT);
          if (h && h.t <= maxT && (!best || h.t < best.t)) best = { t: h.t, normal: h.normal, box: b };
        }
      }
      // a hit nearer than the next cell boundary can't be beaten
      const tNext = Math.min(tMaxX, tMaxZ);
      if (best && best.t <= tNext) break;
      if (tNext > maxT) break;
      t = tNext;
      if (tMaxX < tMaxZ) { j += stepJ; tMaxX += tDX; } else { k += stepK; tMaxZ += tDZ; }
      if ((j < -1 || k < -1 || j > this.nx || k > this.nz)) break;
    }
    void t;
    return best;
  }
}

// The boxes of a list (an array, or a grid asked about a spot).
export function boxesNear(list, x, z, r) {
  return list.query ? list.near(x, z, r) : list;
}
