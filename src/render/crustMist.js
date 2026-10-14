// =============================================================================
// The mist round each island of Call of the Crust: banks of it hanging off the
// rim and drifting under the rock, each island's own (forge smoke over the
// Anvil, ash and battle smoke off the Trench Front lit red from below, the
// Research Base's violet storm haze that flashes with the lightning, sea mist
// round the Ship Graveyard, white frost-fog round the Ice Caves). Colours in
// ATMOS (crustThemes.js), how much and where in CONFIG.crust.mist.
// One instanced mesh of camera-facing puffs per island; they drift and turn
// slowly, and fade as you get close (no fog in your face on the edge).
// =============================================================================
import * as THREE from 'three';
import { K } from '../map/terrain.js';
import { ATMOS } from './crustThemes.js';
import * as T from './textures.js';

const R = (s) => { let x = s >>> 0 || 1; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; };

// a soft puff: a few overlapping blobs, ragged at the edges
function puffTexture() {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(77);
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * S * 0.26;
    const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d * 0.8, rad = S * (0.08 + r() * 0.16);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(255,255,255,${0.08 + r() * 0.08})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const t = T.toTexture(c, { repeat: false });
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const VERT = `
uniform float uTime, uNear0, uNear1, uDrift;
attribute vec4 aPuff;            // phase, strength, spin, size
varying vec2 vUv; varying float vA;
void main() {
  vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float ph = aPuff.x;
  c.xyz += vec3(sin(uTime * 0.045 + ph) * uDrift, sin(uTime * 0.09 + ph * 1.7) * uDrift * 0.3, cos(uTime * 0.05 + ph * 0.6) * uDrift);
  vec4 mv = viewMatrix * c;
  float a = ph + uTime * aPuff.z;
  vec2 p = position.xy * aPuff.w;
  mv.xy += vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
  vUv = uv;
  float d = -mv.z;
  vA = aPuff.y * smoothstep(uNear0, uNear1, d) * (0.82 + 0.18 * sin(uTime * 0.27 + ph * 3.0));
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform sampler2D uMap; uniform vec3 uColor, uGlow; uniform float uOpacity, uGlowK, uFlash;
varying vec2 vUv; varying float vA;
void main() {
  float t = texture2D(uMap, vUv).r;
  // lit from below (lava, the storm, the ice): the underside of each puff takes the glow
  vec3 col = mix(uColor, uGlow, (1.0 - smoothstep(0.15, 0.7, vUv.y)) * uGlowK + uFlash * 0.6);
  gl_FragColor = vec4(col, clamp(t * 1.6, 0.0, 1.0) * vA * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildMist(out, group, map, cfg) {
  if (!map.terrains || !cfg) return;
  const tex = puffTexture();
  const quad = new THREE.PlaneGeometry(1, 1);
  out.mist = [];
  for (const t of map.terrains) {
    const A = ATMOS[t.id];
    if (!A || !A.mist) continue;
    const r = R(t.id.length * 97 + 13);
    // the island's edge cells (land next to the void), and its middle
    const edge = [];
    let cx = 0, cz = 0, n = 0;
    for (let iz = 1; iz < t.nz - 1; iz++) for (let ix = 1; ix < t.nx - 1; ix++) {
      const c = t.i(ix, iz);
      if (t.kind[c] === K.SEA) continue;
      cx += t.cx(ix); cz += t.cz(iz); n++;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => t.kind[t.i(ix + dx, iz + dz)] === K.SEA)) edge.push([t.cx(ix), t.cz(iz), t.h[c]]);
    }
    if (!n || !edge.length) continue;
    cx /= n; cz /= n;
    // thin the edge out to one every `spacing` metres
    const picks = [];
    for (const e of edge.sort(() => r() - 0.5)) if (!picks.some((p) => Math.hypot(p[0] - e[0], p[1] - e[1]) < cfg.spacing)) picks.push(e);
    const puffs = [];
    const lowest = Math.min(...edge.map((e) => e[2]));
    for (const [x, z, h] of picks) {
      const dx = x - cx, dz = z - cz, L = Math.hypot(dx, dz) || 1;
      for (let k = 0; k < (cfg.layers || 2); k++) {
        const o = cfg.out[0] + r() * (cfg.out[1] - cfg.out[0]);
        const y = Math.min(h, lowest + 2) + cfg.below[0] + r() * (cfg.below[1] - cfg.below[0]) * (k / Math.max(1, (cfg.layers || 2) - 1));
        puffs.push([x + (dx / L) * o, y, z + (dz / L) * o, cfg.size[0] + r() * (cfg.size[1] - cfg.size[0])]);
      }
    }
    // and under the island, hiding where the rock ends
    const span = Math.max(...edge.map((e) => Math.hypot(e[0] - cx, e[1] - cz)));
    for (let k = 0; k < cfg.under; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * span * 0.85;
      puffs.push([cx + Math.cos(a) * d, lowest - 12 - r() * 14, cz + Math.sin(a) * d, cfg.size[1] * (1.2 + r() * 0.8)]);
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: tex }, uTime: { value: 0 }, uColor: { value: new THREE.Color(A.mist.color) }, uGlow: { value: new THREE.Color(A.mist.glow || A.mist.color) },
        uGlowK: { value: A.mist.glow ? 0.55 : 0 }, uOpacity: { value: A.mist.opacity }, uFlash: { value: 0 },
        uNear0: { value: cfg.near[0] }, uNear1: { value: cfg.near[1] }, uDrift: { value: cfg.drift },
      },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: false,
    });
    const im = new THREE.InstancedMesh(quad, mat, puffs.length);
    const attr = new Float32Array(puffs.length * 4);
    const m4 = new THREE.Matrix4();
    puffs.forEach(([x, y, z, s], i) => {
      m4.makeTranslation(x, y, z); im.setMatrixAt(i, m4);
      attr.set([r() * 100, 0.6 + r() * 0.4, (r() - 0.5) * 0.04, s], i * 4);
    });
    im.geometry = quad.clone();
    im.geometry.setAttribute('aPuff', new THREE.InstancedBufferAttribute(attr, 4));
    im.frustumCulled = false;
    im.renderOrder = 2;
    im.userData.noBake = true;
    group.add(im);
    out.mist.push({ id: t.id, mat });
  }
}

export function updateMist(out, dt, time, flash = 0) {
  for (const M of out.mist || []) {
    M.mat.uniforms.uTime.value = time;
    M.mat.uniforms.uFlash.value = M.id === 'research' ? flash : 0;
  }
}
