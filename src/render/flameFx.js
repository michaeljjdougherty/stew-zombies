// =============================================================================
// Fire: one pool of glowing points, each its own size and color, for the
// flamethrower's stream and anything burning (zombies alight). A point starts
// white-hot and small, swells, goes orange, red, then dark smoke and gone.
// One draw call, however much is burning.
// =============================================================================
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const VERT = /* glsl */`
attribute float size;
attribute vec4 tint;
varying vec4 vTint;
uniform float scale;
void main() {
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.05, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
uniform sampler2D map;
varying vec4 vTint;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vTint.rgb * t.rgb, t.a * vTint.a);
}`;

// a soft blob of flame, brighter in its heart
function flameTexture() {
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const HOT = new THREE.Color(4.2, 3.4, 2.2), MID = new THREE.Color(3.4, 1.3, 0.25), DEEP = new THREE.Color(1.4, 0.25, 0.05), SMOKE = new THREE.Color(0.06, 0.05, 0.05);

export class FlameFx {
  constructor(scene) {
    const L = CONFIG.flameLook;
    this.max = L.maxPoints;
    this.list = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.max * 3), 3));
    geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(this.max), 1));
    geo.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(this.max * 4), 4));
    geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({ uniforms: { map: { value: flameTexture() }, scale: { value: 600 } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.points.onBeforeRender = (renderer, sc, camera) => {
      const h = renderer.getDrawingBufferSize(this._v2 || (this._v2 = new THREE.Vector2())).y;
      this.mat.uniforms.scale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov || 60) / 2));
    };
    scene.add(this.points);
  }

  // one point of flame: where, how fast, how big at its fullest, how long
  emit(pos, vel, { size = 0.5, life = 0.6, rise = 1.4, drag = 2.2, hot = 1 } = {}) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z, size, life, max: life, rise, drag, hot });
  }

  // A burst of the flamethrower's stream (one per shot, ~10 a second): points
  // spread along the first stretch of it, so the stream reads as one jet.
  stream(from, dir, F) {
    const L = CONFIG.flameLook.stream;
    const n = Math.round(L.perShot * (F.look || 1));
    for (let i = 0; i < n; i++) {
      const sp = F.speed * (0.8 + Math.random() * 0.4);
      const s = (Math.random() - 0.5) * L.spread, u = (Math.random() - 0.5) * L.spread;
      const vx = dir.x + s * dir.z, vy = dir.y + u, vz = dir.z - s * dir.x;
      const lead = Math.random() * L.lead;
      this.emit({ x: from.x + vx * sp * lead, y: from.y + vy * sp * lead, z: from.z + vz * sp * lead }, { x: vx * sp, y: vy * sp, z: vz * sp }, { size: L.size * (0.7 + Math.random() * 0.6), life: (F.range / F.speed) * (0.7 + Math.random() * 0.5), rise: L.rise, drag: L.drag });
    }
  }

  // Someone (or something) alight: licks of flame off the body. `acc` is the
  // caller's own running count (an object with .n), so each fire keeps its rate.
  burn(pos, height, dt, acc, k = 1) {
    const L = CONFIG.flameLook.burn;
    acc.n = (acc.n || 0) + dt * L.rate * k;
    while (acc.n > 1) {
      acc.n -= 1;
      const p = { x: pos.x + (Math.random() - 0.5) * 0.5, y: pos.y + Math.random() * height, z: pos.z + (Math.random() - 0.5) * 0.5 };
      this.emit(p, { x: (Math.random() - 0.5) * 0.4, y: 0.6 + Math.random() * 0.8, z: (Math.random() - 0.5) * 0.4 }, { size: L.size * (0.6 + Math.random() * 0.8), life: L.life * (0.6 + Math.random() * 0.8), rise: 2, drag: 1 });
    }
  }

  update(dt) {
    const P = this.points.geometry.attributes.position, S = this.points.geometry.attributes.size, T = this.points.geometry.attributes.tint;
    const c = new THREE.Color();
    let n = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.life -= dt;
      if (f.life <= 0) { this.list.splice(i, 1); continue; }
      const dr = Math.exp(-f.drag * dt);
      f.vx *= dr; f.vz *= dr; f.vy = f.vy * dr + f.rise * dt;
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
    }
    for (const f of this.list) {
      if (n >= this.max) break;
      const k = 1 - f.life / f.max;   // 0 new .. 1 gone
      if (k < 0.15) c.copy(HOT).lerp(MID, k / 0.15);
      else if (k < 0.55) c.copy(MID).lerp(DEEP, (k - 0.15) / 0.4);
      else c.copy(DEEP).lerp(SMOKE, (k - 0.55) / 0.45);
      const a = (k < 0.08 ? k / 0.08 : 1) * (1 - k * k);
      P.setXYZ(n, f.x, f.y, f.z);
      S.setX(n, f.size * (0.3 + k * 1.1));
      T.setXYZW(n, c.r, c.g, c.b, a);
      n++;
    }
    this.points.geometry.setDrawRange(0, n);
    P.needsUpdate = S.needsUpdate = T.needsUpdate = true;
  }

  clear() { this.list.length = 0; this.points.geometry.setDrawRange(0, 0); }
}
