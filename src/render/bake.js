// =============================================================================
// Baked lighting. Old console shooters got their soft shadows and dark
// corners from lighting baked into the level ahead of time; this does the same
// in the browser, in the background, right after a map is built.
//
// For every vertex of the floors, walls and ceilings (which are split into
// ~half-metre quads so there are enough of them) it works out:
//   x  ambient occlusion: how boxed-in the spot is (corners, under bleachers,
//      behind lockers, along the skirting) from short rays into the open
//   the light arriving from every light that can see it (soft shadows
//      included): its two strongest fixtures on their own, the rest summed
// Shadow rays aim at a few points spread over each light, so shadow edges come
// out soft. The rays test the map's solid boxes (walls, props) through a grid.
//
// The baked light replaces the real-time lights on those surfaces (real-time
// point lights have no shadows, so they shone straight through walls). The
// two fixtures that light each spot most are kept separate and scaled by their
// live brightness, so tubes still flicker and the power still comes on in a
// wave; the muzzle flash and explosions are added on top live. A dominant
// light direction per vertex keeps the photo surfaces' bumps catching the light.
// =============================================================================
import * as THREE from 'three';
import { addShaderPatch } from './shaderPatch.js';

export const MAX_CHANNELS = 256;  // one per map light: its live brightness
export const DYN_LIGHTS = 4;      // live lights added on top: muzzle flash, explosion, the box, the Mad Dog
const levels = [];
for (let i = 0; i < MAX_CHANNELS / 4; i++) levels.push(new THREE.Vector4(1, 1, 1, 1));
export const bakeUniforms = {
  bakePower: { value: 0 },          // 0..1 as the power comes on
  bakeScale: { value: 1 },          // everything at once (the ending's blackout)
  lightLevel: { value: levels },    // packed 4 per vec4
  dynPos: { value: Array.from({ length: DYN_LIGHTS }, () => new THREE.Vector3()) }, // view space
  dynColor: { value: Array.from({ length: DYN_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
  dynRange: { value: Array.from({ length: DYN_LIGHTS }, () => new THREE.Vector2(9, 1.6)) }, // distance, decay
};
export function setLightLevel(i, v) {
  if (i < 0 || i >= MAX_CHANNELS) return;
  levels[i >> 2].setComponent(i & 3, v);
}

// ---------------------------------------------------------------------------
// Occluders: axis-aligned boxes in a 2D grid over the ground plane.
// ---------------------------------------------------------------------------
export class Occluders {
  constructor(cell = 2) {
    this.cell = cell;
    this.boxes = [];
  }

  add(minX, minY, minZ, maxX, maxY, maxZ) {
    if (!(maxX > minX - 1e-6 && maxY > minY - 1e-6 && maxZ > minZ - 1e-6)) return;
    this.boxes.push(new Float32Array([minX, minY, minZ, maxX, maxY, maxZ]));
  }

  finalize() {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const b of this.boxes) { x0 = Math.min(x0, b[0]); z0 = Math.min(z0, b[2]); x1 = Math.max(x1, b[3]); z1 = Math.max(z1, b[5]); }
    if (!this.boxes.length) { x0 = z0 = 0; x1 = z1 = 1; }
    this.ox = x0 - 0.01; this.oz = z0 - 0.01;
    this.nx = Math.max(1, Math.ceil((x1 - x0 + 0.02) / this.cell));
    this.nz = Math.max(1, Math.ceil((z1 - z0 + 0.02) / this.cell));
    this.cells = Array.from({ length: this.nx * this.nz }, () => []);
    this.boxes.forEach((b, i) => {
      const i0 = Math.max(0, Math.floor((b[0] - this.ox) / this.cell)), i1 = Math.min(this.nx - 1, Math.floor((b[3] - this.ox) / this.cell));
      const k0 = Math.max(0, Math.floor((b[2] - this.oz) / this.cell)), k1 = Math.min(this.nz - 1, Math.floor((b[5] - this.oz) / this.cell));
      for (let k = k0; k <= k1; k++) for (let j = i0; j <= i1; j++) this.cells[k * this.nx + j].push(i);
    });
    this.stamp = new Uint32Array(this.boxes.length);
    this.ray = 0;
  }

  // Does anything solid lie between o and o + d * maxT? (d normalised)
  blocked(ox, oy, oz, dx, dy, dz, maxT) {
    const ray = ++this.ray;
    const C = this.cell;
    const idx = 1 / (dx || 1e-12), idy = 1 / (dy || 1e-12), idz = 1 / (dz || 1e-12);
    // walk the 2D grid along the ray (DDA)
    let gx = Math.floor((ox - this.ox) / C), gz = Math.floor((oz - this.oz) / C);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const nextX = (gx + (dx > 0 ? 1 : 0)) * C + this.ox, nextZ = (gz + (dz > 0 ? 1 : 0)) * C + this.oz;
    let tMaxX = Math.abs(dx) < 1e-9 ? Infinity : (nextX - ox) * idx;
    let tMaxZ = Math.abs(dz) < 1e-9 ? Infinity : (nextZ - oz) * idz;
    const tDX = Math.abs(dx) < 1e-9 ? Infinity : C * Math.abs(idx), tDZ = Math.abs(dz) < 1e-9 ? Infinity : C * Math.abs(idz);
    let t = 0;
    while (t <= maxT) {
      if (gx >= 0 && gz >= 0 && gx < this.nx && gz < this.nz) {
        const list = this.cells[gz * this.nx + gx];
        for (let n = 0; n < list.length; n++) {
          const i = list[n];
          if (this.stamp[i] === ray) continue;
          this.stamp[i] = ray;
          const b = this.boxes[i];
          let t0 = (b[0] - ox) * idx, t1 = (b[3] - ox) * idx;
          let tmin = Math.min(t0, t1), tmax = Math.max(t0, t1);
          t0 = (b[1] - oy) * idy; t1 = (b[4] - oy) * idy;
          tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1));
          if (tmax < tmin) continue;
          t0 = (b[2] - oz) * idz; t1 = (b[5] - oz) * idz;
          tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1));
          if (tmax >= Math.max(tmin, 0) && tmin < maxT) return Math.max(0, tmin);
        }
      } else if ((gx < 0 && sx < 0) || (gz < 0 && sz < 0) || (gx >= this.nx && sx > 0) || (gz >= this.nz && sz > 0)) break;
      if (tMaxX < tMaxZ) { t = tMaxX; tMaxX += tDX; gx += sx; } else { t = tMaxZ; tMaxZ += tDZ; gz += sz; }
    }
    return -1;
  }
}

// ---------------------------------------------------------------------------
// Shader
// ---------------------------------------------------------------------------
const VERT_PARS = `
attribute vec4 bakeA;   // strongest light: light (rgb), its channel
attribute vec4 bakeB;   // second strongest
attribute vec4 bakeC;   // always-on light (rgb), ambient occlusion
attribute vec4 bakeD;   // light from fixtures that need the power (rgb), baked flag
attribute vec3 bakeDir; // main direction the light comes from (world)
uniform vec4 lightLevel[${MAX_CHANNELS / 4}];
uniform float bakePower;
uniform float bakeScale;
varying vec3 vBakeE;
varying vec3 vBakeDir;
varying float vBakeAo;
varying float vBakeOn;
`;
const VERT_MAIN = `
{
  int i1 = clamp( int( bakeA.w + 0.5 ), 0, ${MAX_CHANNELS - 1} ), i2 = clamp( int( bakeB.w + 0.5 ), 0, ${MAX_CHANNELS - 1} );
  float l1 = bakeA.w >= 0.0 ? lightLevel[ i1 / 4 ][ i1 - ( i1 / 4 ) * 4 ] : 0.0;
  float l2 = bakeB.w >= 0.0 ? lightLevel[ i2 / 4 ][ i2 - ( i2 / 4 ) * 4 ] : 0.0;
  vBakeE = ( bakeA.rgb * l1 + bakeB.rgb * l2 + bakeC.rgb + bakeD.rgb * bakePower ) * bakeScale;
  vBakeAo = bakeC.w;
  vBakeOn = bakeD.w;
  vBakeDir = length( bakeDir ) > 0.001 ? normalize( ( viewMatrix * vec4( bakeDir, 0.0 ) ).xyz ) : vec3( 0.0 );
}
`;
const FRAG_PARS = `
varying vec3 vBakeE;
varying vec3 vBakeDir;
varying float vBakeAo;
varying float vBakeOn;
uniform vec3 dynPos[${DYN_LIGHTS}];
uniform vec3 dynColor[${DYN_LIGHTS}];
uniform vec2 dynRange[${DYN_LIGHTS}];
`;
const FRAG_APPLY = `
#include <lights_fragment_end>
if ( vBakeOn > 0.5 ) {
  // the photo bumps still catch the light, from the direction it mostly comes from
  float bump = 1.0;
  vec3 ld = vec3( 0.0, 1.0, 0.0 );
  bool hasDir = dot( vBakeDir, vBakeDir ) > 0.0001;
  if ( hasDir ) {
    ld = normalize( vBakeDir );
    bump = clamp( max( dot( normal, ld ), 0.0 ) / max( dot( nonPerturbedNormal, ld ), 0.2 ), 0.0, 1.6 );
  }
  vec3 E = vBakeE * bump;
  vec3 bakedDiffuse = E * BRDF_Lambert( material.diffuseColor ) * mix( 1.0, vBakeAo, 0.3 );
  vec3 bakedSpecular = vec3( 0.0 );
  #ifdef STANDARD
    // highlights from the baked light too (real-time ones would shine through walls)
    if ( hasDir ) bakedSpecular = E * BRDF_GGX( ld, geometryViewDir, normal, material ) * vBakeAo;
  #endif
  // live lights on top: muzzle flash, explosions, the mystery box
  for ( int i = 0; i < ${DYN_LIGHTS}; i ++ ) {
    vec3 L = dynPos[ i ] - geometryPosition;
    float d = length( L );
    vec3 Ld = L / max( d, 0.0001 );
    vec3 irr = dynColor[ i ] * getDistanceAttenuation( d, dynRange[ i ].x, dynRange[ i ].y ) * saturate( dot( normal, Ld ) );
    bakedDiffuse += irr * BRDF_Lambert( material.diffuseColor );
    #ifdef STANDARD
      bakedSpecular += irr * BRDF_GGX( Ld, geometryViewDir, normal, material );
    #endif
  }
  reflectedLight.directDiffuse = bakedDiffuse;
  reflectedLight.directSpecular = bakedSpecular;
  reflectedLight.indirectDiffuse *= mix( 1.0, vBakeAo, 0.9 );
}
`;

export function applyBake(mat) {
  // meshes without baked values fall back to the real-time lights (flag = 0)
  mat.defaultAttributeValues = { ...(mat.defaultAttributeValues || {}), bakeA: [0, 0, 0, -1], bakeB: [0, 0, 0, -1], bakeC: [0, 0, 0, 1], bakeD: [0, 0, 0, 0], bakeDir: [0, 0, 0] };
  addShaderPatch(mat, 'bake', (shader) => {
    for (const k of ['bakePower', 'bakeScale', 'lightLevel', 'dynPos', 'dynColor', 'dynRange']) shader.uniforms[k] = bakeUniforms[k];
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <lights_fragment_end>', FRAG_APPLY);
  });
  return mat;
}

// ---------------------------------------------------------------------------
// The baker: a quick unshadowed pass straight away, then shadows filled in a
// few milliseconds per frame.
// ---------------------------------------------------------------------------
const AO_RAYS = 10, AO_LEN = 1.3, SHADOW_SAMPLES = 3;

// fixed, well-spread hemisphere directions (cosine weighted) around +Z
const HEMI = (() => {
  const out = [];
  for (let i = 0; i < AO_RAYS; i++) {
    const u = (i + 0.5) / AO_RAYS, a = i * 2.39996;     // golden angle spiral
    const r = Math.sqrt(u);
    out.push([Math.cos(a) * r, Math.sin(a) * r, Math.sqrt(1 - u)]);
  }
  return out;
})();
const DISC = [[0, 0], [0.75, 0.35], [-0.7, -0.4]];
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export class Baker {
  // lights: [{pos, color, intensity, distance, decay, size, channel, early}]
  //   early: on before the power comes back (else it's scaled by the power when not one of the top two)
  constructor(occ, receivers, lights) {
    this.occ = occ;
    this.lights = lights;
    this.jobs = [];
    for (const mesh of receivers) {
      const g = mesh.geometry;
      const n = g.attributes.position.count;
      const mk = (k, size) => { const a = new THREE.BufferAttribute(new Float32Array(n * size), size); g.setAttribute(k, a); return a; };
      mesh.updateMatrixWorld(true);
      const job = { mesh, g, i: 0, n, m: mesh.matrixWorld.clone(), nm: new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld),
        A: mk('bakeA', 4), B: mk('bakeB', 4), C: mk('bakeC', 4), D: mk('bakeD', 4), Dir: mk('bakeDir', 3) };
      this.jobs.push(job);
    }
    this.total = this.jobs.reduce((a, j) => a + j.n, 0);
    this.doneCount = 0;
    this._p = new THREE.Vector3(); this._n = new THREE.Vector3();
    // quick pass: no shadows, no occlusion, so the world is lit right away
    for (const job of this.jobs) this.runJob(job, false, Infinity);
    for (const job of this.jobs) job.i = 0;
    this.done = !this.jobs.length;
  }

  get progress() { return this.total ? this.doneCount / this.total : 1; }

  runJob(job, shadows, end) {
    const P = job.g.attributes.position, N = job.g.attributes.normal;
    while (job.i < job.n) {
      this._p.fromBufferAttribute(P, job.i).applyMatrix4(job.m);
      this._n.fromBufferAttribute(N, job.i).applyMatrix3(job.nm).normalize();
      this.vertex(this._p, this._n, job, job.i, shadows);
      job.i++;
      if (shadows) this.doneCount++;
      if ((job.i & 31) === 0 && performance.now() > end) break;
    }
    for (const k of ['A', 'B', 'C', 'D', 'Dir']) job[k].needsUpdate = true;
    return job.i >= job.n;
  }

  // Spend up to `ms` milliseconds baking shadows.
  step(ms = 4) {
    if (this.done) return true;
    const end = performance.now() + ms;
    while (this.jobs.length) {
      if (!this.runJob(this.jobs[0], true, end)) return false;
      this.jobs.shift();
    }
    this.done = true;
    return true;
  }

  vertex(p, n, job, i, shadows) {
    const occ = this.occ;
    const px = p.x + n.x * 0.03, py = p.y + n.y * 0.03, pz = p.z + n.z * 0.03;
    // --- ambient occlusion
    let ao = 1;
    if (shadows) {
      const tx = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(n).normalize() : new THREE.Vector3(1, 0, 0).cross(n).normalize();
      const ty = new THREE.Vector3().crossVectors(n, tx);
      let shut = 0;
      for (const h of HEMI) {
        const dx = tx.x * h[0] + ty.x * h[1] + n.x * h[2], dy = tx.y * h[0] + ty.y * h[1] + n.y * h[2], dz = tx.z * h[0] + ty.z * h[1] + n.z * h[2];
        const t = occ.blocked(px, py, pz, dx, dy, dz, AO_LEN);
        if (t >= 0) shut += 1 - t / AO_LEN;
      }
      ao = 1 - Math.min(0.85, (shut / AO_RAYS) * 1.3);
    }
    // --- light from every light that reaches this point
    let s1 = null, s2 = null;            // two strongest lights {f, r, g, b, l, early}
    let lr = 0, lg = 0, lb = 0, pr = 0, pg = 0, pb = 0, dx = 0, dy = 0, dz = 0;
    const rest = (x) => { if (x.early) { lr += x.r; lg += x.g; lb += x.b; } else { pr += x.r; pg += x.g; pb += x.b; } };
    for (const L of this.lights) {
      const vx = L.pos.x - px, vy = L.pos.y - py, vz = L.pos.z - pz;
      const d = Math.hypot(vx, vy, vz);
      if (d > L.distance || d < 1e-4) continue;
      const ndl = (vx * n.x + vy * n.y + vz * n.z) / d;
      if (ndl <= 0) continue;
      const att = Math.max(0, 1 - (d / L.distance) ** 4) ** 2 / Math.max(d ** L.decay, 0.01);
      let k = L.intensity * att * ndl;
      if (k < 1e-4) continue;
      if (shadows) {
        let vis = 0;
        for (let s = 0; s < SHADOW_SAMPLES; s++) {
          // aim at a point spread over the light (a fluorescent tube is ~1.2m long)
          const q = DISC[s];
          const qx = L.pos.x + q[0] * L.size, qz = L.pos.z + q[1] * L.size * 0.5;
          const ux = qx - px, uy = L.pos.y - py, uz = qz - pz;
          const du = Math.hypot(ux, uy, uz);
          if (occ.blocked(px, py, pz, ux / du, uy / du, uz / du, du - 0.2) < 0) vis++;
        }
        k *= vis / SHADOW_SAMPLES;
        if (k <= 0) continue;
      }
      const r = L.color.r * k, g = L.color.g * k, b = L.color.b * k, l = lum(r, g, b);
      dx += (vx / d) * l; dy += (vy / d) * l; dz += (vz / d) * l;
      const e = { f: L.channel, r, g, b, l, early: L.early };
      if (L.channel < 0) rest(e);
      else if (!s1 || l > s1.l) { if (s2) rest(s2); s2 = s1; s1 = e; }
      else if (!s2 || l > s2.l) { if (s2) rest(s2); s2 = e; }
      else rest(e);
    }
    const A = job.A.array, B = job.B.array, C = job.C.array, D = job.D.array, Dir = job.Dir.array;
    const o4 = i * 4, o3 = i * 3;
    if (s1) { A[o4] = s1.r; A[o4 + 1] = s1.g; A[o4 + 2] = s1.b; A[o4 + 3] = s1.f; } else { A[o4] = A[o4 + 1] = A[o4 + 2] = 0; A[o4 + 3] = -1; }
    if (s2) { B[o4] = s2.r; B[o4 + 1] = s2.g; B[o4 + 2] = s2.b; B[o4 + 3] = s2.f; } else { B[o4] = B[o4 + 1] = B[o4 + 2] = 0; B[o4 + 3] = -1; }
    C[o4] = lr; C[o4 + 1] = lg; C[o4 + 2] = lb; C[o4 + 3] = ao;
    D[o4] = pr; D[o4 + 1] = pg; D[o4 + 2] = pb; D[o4 + 3] = 1;
    const dl = Math.hypot(dx, dy, dz);
    if (dl > 1e-6) { Dir[o3] = dx / dl; Dir[o3 + 1] = dy / dl; Dir[o3 + 2] = dz / dl; } else { Dir[o3] = Dir[o3 + 1] = Dir[o3 + 2] = 0; }
  }

}
