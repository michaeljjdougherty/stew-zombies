// =============================================================================
// The boiler room cauldron, alive: a thick stew surface that churns and glows
// from below, bubbles that swell and pop, steam rolling off the top, a fire
// that flickers under it, and the three red valve wheels (src/sim/cauldron.js).
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';

const STEW_VERT = /* glsl */`
  uniform float time, boil;
  varying vec2 vUv;
  varying float vH;
  float h(vec2 p) {
    return sin(p.x * 9.0 + time * 1.7) * 0.5 + sin(p.y * 11.0 - time * 1.3) * 0.5
      + sin((p.x + p.y) * 17.0 + time * 2.9) * 0.3;
  }
  void main() {
    vUv = uv;
    vec3 p = position;
    float k = h(uv * 2.0) * (0.012 + boil * 0.03);
    p.z += k;          // the circle lies in xy before it's rotated flat
    vH = k;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const STEW_FRAG = /* glsl */`
  uniform float time, boil, light;
  varying vec2 vUv;
  varying float vH;
  float n(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(n(i), n(i + vec2(1, 0)), f.x), mix(n(i + vec2(0, 1)), n(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec2 p = vUv * 7.0;
    float swirl = vn(p + vec2(time * 0.25, -time * 0.18)) * 0.6 + vn(p * 2.3 - time * 0.4) * 0.4;
    // chunks of meat and veg floating in it
    float chunks = smoothstep(0.72, 0.78, vn(vUv * 15.0 + vec2(sin(time * 0.2), cos(time * 0.17))));
    vec3 broth = mix(vec3(0.23, 0.09, 0.03), vec3(0.55, 0.24, 0.07), swirl);
    broth = mix(broth, vec3(0.42, 0.3, 0.12), chunks * 0.7);
    // hot spots glow through from the fire under the pot
    float hot = pow(vn(vUv * 4.0 + time * 0.15), 3.0) * (0.6 + boil * 2.5);
    vec3 col = broth * (0.35 + light * 0.9) + vec3(1.0, 0.45, 0.08) * hot * 0.35 + vec3(1.0, 0.75, 0.2) * boil * 0.35;
    col += max(vH, 0.0) * 6.0 * vec3(0.5, 0.3, 0.1);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class CauldronView {
  constructor(scene, map, effects) {
    this.C = map.cauldron;
    this.effects = effects;
    this.mapView = null;
    this.group = new THREE.Group();
    if (!this.C) return;
    const C = this.C;
    scene.add(this.group);
    this.group.position.set(C.x, 0, C.z);

    this.uni = { time: { value: 0 }, boil: { value: 0 }, light: { value: 1 } };
    const surf = new THREE.Mesh(new THREE.CircleGeometry(C.r * 0.93, 48), new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: STEW_VERT, fragmentShader: STEW_FRAG }));
    surf.rotation.x = -Math.PI / 2;
    surf.position.y = C.rim - 0.13;
    this.group.add(surf);
    this.surf = surf;

    // bubbles: swell, then pop
    this.bubbleMat = new THREE.MeshStandardMaterial({ color: '#7a3a12', roughness: 0.2, metalness: 0.1, emissive: new THREE.Color(0.25, 0.08, 0.01) });
    this.bubbles = [];
    const bg = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(bg, this.bubbleMat);
      m.visible = false;
      this.group.add(m);
      this.bubbles.push({ m, t: Math.random() * 2, life: 1, r: 0.05 });
    }

    // fire under the pot
    const fireTex = T.softDotTexture('rgba(255,200,90,1)', 'rgba(255,60,0,0)');
    this.flames = [];
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: new THREE.Color(2.2, 0.9, 0.25), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      const a = (i / 7) * Math.PI * 2;
      sp.userData.base = new THREE.Vector3(Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4);
      sp.userData.ph = Math.random() * 6;
      this.group.add(sp);
      this.flames.push(sp);
    }

    // valve wheels
    const red = new THREE.MeshStandardMaterial({ color: '#a8150c', roughness: 0.45, metalness: 0.4 });
    this.valves = new Map();
    for (const v of C.valves) {
      const w = new THREE.Group();
      w.position.set(v.x - C.x, v.y, v.z - C.z);
      w.lookAt(new THREE.Vector3(v.x - C.x + v.face[0], v.y + v.face[1], v.z - C.z + v.face[2]));
      const wheel = new THREE.Group(); w.add(wheel);
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 8, 22), red));
      for (let k = 0; k < 3; k++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.022, 0.022), red);
        spoke.rotation.z = k * Math.PI / 3; wheel.add(spoke);
      }
      wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10).rotateX(Math.PI / 2), red));
      this.group.add(w);
      this.valves.set(v.id, { def: v, wheel, spin: 0, open: false, steam: 0 });
    }
    this.boilT = 0;
    this.steamT = 0;
  }

  // The live firelight (the baked one is static).
  attachLight(mapView) {
    if (!this.C || this.light) return;
    this.mapView = mapView;
    this.light = mapView.addVirtualLight({ x: this.C.x, y: 0.5, z: this.C.z - 1.1 }, 0xff6a20, 4, 5, 1.7);
    this.light.live = true;
  }

  onEvent(e) {
    if (!this.C) return;
    if (e.type === 'valveTurned') {
      const v = this.valves.get(e.id);
      if (v) { v.open = true; v.spin = 14; v.steam = 2.2; }
    } else if (e.type === 'cauldronBoil') {
      this.boilT = 6;
      const p = new THREE.Vector3(this.C.x, this.C.rim + 0.2, this.C.z);
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        this.effects.puff(p.clone().add(new THREE.Vector3(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4)), { color: 0xd8ccb8, size: 0.6, grow: 3.2, life: 2.2, alpha: 0.5, vel: new THREE.Vector3(Math.cos(a) * 0.8, 2.2 + Math.random(), Math.sin(a) * 0.8), shade: false });
      }
      for (let i = 0; i < 40; i++) {
        this.effects.spawnParticle(p, new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3), { life: 1.2, size: 0.025, color: [0.5, 0.22, 0.05], gravity: 9.8, drag: 0.3, floorDecal: false });
      }
    }
  }

  reset() {
    if (!this.C) return;
    for (const v of this.valves.values()) { v.open = false; v.spin = 0; v.steam = 0; v.wheel.rotation.z = 0; }
    this.boilT = 0;
  }

  update(dt, time, sim, eye) {
    if (!this.C) return;
    const C = this.C;
    const near = !eye || Math.hypot(eye.x - C.x, eye.z - C.z) < 25;
    this.group.visible = near;
    if (!near) { if (this.light) this.light.level = 0; return; }
    // keep up with the sim (a friend joining, a missed event)
    const st = sim && sim.cauldron;
    if (st) for (const [id, v] of this.valves) if (st.valves[id] && !v.open) { v.open = true; v.wheel.rotation.z = 4; }
    const boiled = st && st.boiled;
    this.boilT = Math.max(0, this.boilT - dt);
    const boil = this.boilT > 0 ? Math.min(1, this.boilT / 2) : boiled ? 0.15 : 0;
    this.uni.time.value = time;
    this.uni.boil.value = boil;

    // valves: spin open, then hiss for a bit
    for (const v of this.valves.values()) {
      if (v.spin > 0) { v.wheel.rotation.z += v.spin * dt; v.spin = Math.max(0, v.spin - dt * 9); }
      if (v.steam > 0) {
        v.steam -= dt;
        if (Math.random() < dt * 30) {
          const d = v.def;
          this.effects.puff(new THREE.Vector3(d.x, d.y, d.z), { color: 0xe0dcd2, size: 0.12, grow: 4, life: 0.9, alpha: 0.4, vel: new THREE.Vector3(d.face[0] * 3 + (Math.random() - 0.5), 0.6 + Math.random(), d.face[2] * 3 + (Math.random() - 0.5)), shade: false });
        }
      }
    }

    // bubbles
    const R = C.r * 0.8, y0 = C.rim - 0.13;
    for (const b of this.bubbles) {
      b.t += dt * (1 + boil * 3);
      if (b.t >= b.life) {
        // pop: a little splash of broth (and sometimes a puff of steam)
        if (b.m.visible && Math.random() < 0.5) this.effects.puff(b.m.position.clone().add(this.group.position), { color: 0xcfc6b8, size: 0.12, grow: 2.2, life: 0.9, alpha: 0.18, vel: new THREE.Vector3(0, 0.6, 0), shade: false });
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R;
        b.m.position.set(Math.cos(a) * r, y0, Math.sin(a) * r);
        b.t = 0; b.life = 0.6 + Math.random() * 1.4; b.r = 0.03 + Math.random() * 0.07 + boil * 0.05;
        b.m.visible = true;
      }
      const k = b.t / b.life;
      b.m.scale.set(b.r * k, b.r * k * 0.8, b.r * k);
    }

    // steam drifting up
    this.steamT -= dt * (1 + boil * 4);
    if (this.steamT <= 0) {
      this.steamT = 0.35;
      const a = Math.random() * Math.PI * 2, r = Math.random() * R;
      this.effects.puff(new THREE.Vector3(C.x + Math.cos(a) * r, y0 + 0.1, C.z + Math.sin(a) * r), { color: 0xcfc8bc, size: 0.35, grow: 2.6, life: 2.6, alpha: 0.12 + boil * 0.25, vel: new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.45, (Math.random() - 0.5) * 0.15), shade: false });
    }

    // fire
    let fl = 0;
    for (const f of this.flames) {
      const s = 0.22 + Math.sin(time * 9 + f.userData.ph) * 0.06 + Math.sin(time * 23 + f.userData.ph * 3) * 0.03;
      f.scale.set(s, s * 1.5, 1);
      f.position.copy(f.userData.base); f.position.y += Math.sin(time * 6 + f.userData.ph) * 0.03;
      fl += s;
    }
    if (this.light) this.light.level = 0.8 + (fl / this.flames.length - 0.22) * 4 + boil * 1.2;
    this.uni.light.value = 0.6 + Math.sin(time * 7.3) * 0.05;
  }
}
