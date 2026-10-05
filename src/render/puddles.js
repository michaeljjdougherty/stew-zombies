// =============================================================================
// Wet floors: puddles of standing water that mirror the room, some under a
// ceiling leak that drips and sends rings across them.
//
// Reflections come from a small cube map captured around the camera, one face
// per frame, so it costs one tiny extra render a frame. Blood pools share it.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';
import { addShaderPatch } from './shaderPatch.js';

const MAX_RIPPLES = 3;

// how wet each kind of room is: puddles to try for, and how many of them leak
const WET = {
  hall: [3, 0.4], lockerroom: [5, 0.6], boiler: [5, 0.7], kitchen: [3, 0.5], cafe: [2, 0.5], gym: [2, 0.5],
  lab: [2, 0.3], exterior: [6, 0], auditorium: [1, 1], band: [1, 1], office: [0, 0], principal: [0, 0], library: [0, 0],
  cliff: [0, 0],   // (Call of the Crust: it's all frozen)
};

export class Puddles {
  constructor(scene, sim, cfg, effects) {
    this.scene = scene;
    this.sim = sim;
    this.cfg = cfg;
    this.effects = effects;
    this.time = 0;
    this.list = [];
    const g = cfg.graphics;

    // reflection probe
    this.rt = new THREE.WebGLCubeRenderTarget(g.reflectionSize ?? 128, { type: THREE.HalfFloatType, generateMipmaps: false });
    this.cube = new THREE.CubeCamera(0.05, 45, this.rt);
    this.face = 0;
    this.captureT = 0;
    this.envMap = this.rt.texture;

    this.masks = [1, 2, 3, 4].map((i) => T.blobTexture(i, { lobes: 10 }));
    this.geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.uTime = { value: 0 };
    this.build();
  }

  // ---------------------------------------------------------------------------
  build() {
    let seed = 1234567;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const sim = this.sim;
    const clearAt = (x, z) => {
      const h = sim.raycastWorld({ x, y: 1.9, z }, { x: 0, y: -1, z: 0 }, 1.95);
      return !h || h.point.y < 0.03;
    };
    for (const room of sim.mapData.rooms) {
      const [want, leaky] = WET[room.style] || WET[room.outdoor ? 'exterior' : 'hall'];
      const [x0, z0, x1, z1] = room.rect;
      let made = 0;
      for (let tries = 0; tries < want * 8 && made < want; tries++) {
        const r = room.outdoor ? 0.8 + rnd() * 1.6 : 0.45 + rnd() * 0.9;
        const x = x0 + r + 0.6 + rnd() * (x1 - x0 - 2 * r - 1.2);
        const z = z0 + r + 0.6 + rnd() * (z1 - z0 - 2 * r - 1.2);
        if (!(x1 - x0 > 2 * r + 1.2 && z1 - z0 > 2 * r + 1.2)) break;
        if (this.list.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 0.8)) continue;
        if (![[0, 0], [r * 0.7, 0], [-r * 0.7, 0], [0, r * 0.7], [0, -r * 0.7]].every(([dx, dz]) => clearAt(x + dx, z + dz))) continue;
        const leak = !room.outdoor && rnd() < leaky;
        this.add(x, z, r, rnd() * Math.PI * 2, 0.6 + rnd() * 0.5, leak ? room.height : 0, rnd);
        made++;
      }
    }
  }

  add(x, z, r, yaw, stretch, leakH, rnd) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x07080a, roughness: 0.03, metalness: 0, transparent: true, depthWrite: false,
      alphaMap: this.masks[Math.floor(rnd() * this.masks.length)], opacity: 0.72,
      envMap: this.envMap, envMapIntensity: 2.4,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    const ripples = { c: [], t: [] };
    for (let i = 0; i < MAX_RIPPLES; i++) { ripples.c.push(new THREE.Vector3(x, 0, z)); ripples.t.push(-100); }
    const U = { rippleC: { value: ripples.c }, rippleT: { value: ripples.t }, uTime: this.uTime };
    addShaderPatch(mat, 'puddle', (shader) => {
      Object.assign(shader.uniforms, U);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvPW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vPW;
uniform vec3 rippleC[${MAX_RIPPLES}];
uniform float rippleT[${MAX_RIPPLES}];
uniform float uTime;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  // drip rings spreading across the water
  vec2 slope = vec2( 0.0 );
  for ( int i = 0; i < ${MAX_RIPPLES}; i ++ ) {
    float age = uTime - rippleT[ i ];
    if ( age < 0.0 || age > 2.2 ) continue;
    vec2 d = vPW.xz - rippleC[ i ].xz;
    float dist = length( d ) + 1e-4;
    float front = age * 0.32;
    float x = ( dist - front ) * 38.0;
    float env = exp( - x * x * 0.04 ) * ( 1.0 - age / 2.2 ) * exp( - dist * 1.5 );
    slope += ( d / dist ) * cos( x ) * env * 0.35;
  }
  // a faint shiver so it reads as water, not glass
  slope += vec2( sin( vPW.x * 9.0 + uTime * 1.3 + vPW.z * 4.0 ), cos( vPW.z * 8.0 - uTime * 1.1 + vPW.x * 3.0 ) ) * 0.008;
  vec3 wn = normalize( vec3( - slope.x, 1.0, - slope.y ) );
  normal = normalize( ( viewMatrix * vec4( wn, 0.0 ) ).xyz );
}`);
    });
    const m = new THREE.Mesh(this.geo, mat);
    m.position.set(x, 0.004, z);
    m.rotation.y = yaw;
    m.scale.set(r * 2, 1, r * 2 * stretch);
    m.renderOrder = 1;
    this.scene.add(m);
    const p = { mesh: m, x, z, r, leakH, ripples, next: 0.5 + rnd() * 2, ri: 0, drops: [] };
    // the leak drips somewhere inside the puddle
    p.leakX = x + (rnd() - 0.5) * r * 0.6; p.leakZ = z + (rnd() - 0.5) * r * 0.6 * stretch;
    this.list.push(p);
  }

  ripple(p, x, z) {
    p.ripples.c[p.ri].set(x, 0, z);
    p.ripples.t[p.ri] = this.time;
    p.ri = (p.ri + 1) % MAX_RIPPLES;
  }

  // something landed in a puddle (shell casings, blood, a zombie's foot): ripple it
  splash(x, z) {
    for (const p of this.list) if (Math.hypot(p.x - x, p.z - z) < p.r) { this.ripple(p, x, z); return true; }
    return false;
  }

  // ---------------------------------------------------------------------------
  update(dt, renderer, camera) {
    this.time += dt;
    this.uTime.value = this.time;
    const eye = camera.position;
    let near = false;
    for (const p of this.list) {
      const d = Math.hypot(p.x - eye.x, p.z - eye.z);
      if (d < 30) near = true;
      if (!p.leakH || d > 25) continue;
      // drips from the leak: a drop falls, and when it lands the water rings
      p.next -= dt;
      if (p.next <= 0) {
        p.next = 0.7 + Math.random() * 2.2;
        const h = p.leakH - 0.05;
        const fall = Math.sqrt((2 * h) / 9.8);
        p.drops.push(this.time + fall);
        if (this.effects) this.effects.spawnParticle(new THREE.Vector3(p.leakX, h, p.leakZ), new THREE.Vector3(0, 0, 0), { life: fall, size: 0.012, color: [0.35, 0.38, 0.42], gravity: 9.8, drag: 0 });
      }
      while (p.drops.length && p.drops[0] <= this.time) {
        p.drops.shift();
        this.ripple(p, p.leakX, p.leakZ);
        if (this.effects) for (let i = 0; i < 3; i++) this.effects.spawnParticle(new THREE.Vector3(p.leakX, 0.02, p.leakZ), new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8), { life: 0.25, size: 0.006, color: [0.35, 0.38, 0.42], gravity: 9.8, drag: 0 });
      }
    }
    if (near && renderer && this.cfg.graphics.reflections !== false) this.capture(dt, renderer, camera);
  }

  // One face of the reflection cube per frame, taken from where the camera is.
  capture(dt, renderer, camera) {
    if (this.face === 0) {
      this.captureT -= dt;
      if (this.captureT > 0) return;
      this.captureT = this.cfg.graphics.reflectionInterval ?? 0.25;
      this.cube.position.set(camera.position.x, Math.max(0.5, camera.position.y - 0.4), camera.position.z);
      this.cube.updateMatrixWorld(true);
    }
    if (this.cube.coordinateSystem !== renderer.coordinateSystem) {
      this.cube.coordinateSystem = renderer.coordinateSystem;
      this.cube.updateCoordinateSystem();
    }
    const cams = this.cube.children;
    const prevRT = renderer.getRenderTarget(), prevFace = renderer.getActiveCubeFace(), prevMip = renderer.getActiveMipmapLevel();
    const xr = renderer.xr.enabled; renderer.xr.enabled = false;
    for (const p of this.list) p.mesh.visible = false;
    this.hidden?.forEach((o) => { o.userData._v = o.visible; o.visible = false; });
    renderer.setRenderTarget(this.rt, this.face);
    renderer.render(this.scene, cams[this.face]);
    renderer.setRenderTarget(prevRT, prevFace, prevMip);
    renderer.xr.enabled = xr;
    for (const p of this.list) p.mesh.visible = true;
    this.hidden?.forEach((o) => { o.visible = o.userData._v; });
    this.face = (this.face + 1) % 6;
    if (this.face === 0) this.rt.texture.needsPMREMUpdate = true;
  }

  clear() {
    for (const p of this.list) { p.drops.length = 0; for (let i = 0; i < MAX_RIPPLES; i++) p.ripples.t[i] = -100; }
  }
}
