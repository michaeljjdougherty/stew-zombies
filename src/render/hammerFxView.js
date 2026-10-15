// =============================================================================
// What a tempered War Hammer leaves behind where it came down (the sim's side
// is in src/sim/gadgets.js; the numbers in CONFIG.crust.hammers):
//   hfire   a pool of fire: the ground glowing like coals, flames licking up
//           all over it, embers going up
//   hice    a blizzard: frost spreading over the ground, ice spikes jutting up,
//           snow whirling round, mist
//   hwind   a tornado: a twisting funnel of wind and dust, debris spiralling
//           up it, carrying on along the line you swung
//   hbolt   a ball of lightning: a white-hot core in a violet glow, arcs
//           crackling off it, striking whatever comes near
// Each fades in, holds, and fades out over its last second.
// =============================================================================
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

let TEX = null;
function textures() {
  if (TEX) return TEX;
  const canvas = (S, draw) => { const c = document.createElement('canvas'); c.width = c.height = S; draw(c.getContext('2d'), S); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  TEX = {
    // coals: a glowing disc broken up with dark patches and bright seams
    coals: canvas(256, (g, S) => {
      const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + rnd() * 0.5})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, 4 + rnd() * 16, 0, Math.PI * 2); g.fill(); }
    }),
    // frost: a pale disc with crystals branching out from the middle
    frost: canvas(256, (g, S) => {
      const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5;
      for (let i = 0; i < 36; i++) {
        const a = rnd() * Math.PI * 2, r = 20 + rnd() * 100;
        const x = S / 2 + Math.cos(a) * r * 0.3, y = S / 2 + Math.sin(a) * r * 0.3;
        g.beginPath(); g.moveTo(x, y); g.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r);
        for (const s of [-1, 1]) { const m = 0.6; g.moveTo(S / 2 + Math.cos(a) * r * m, S / 2 + Math.sin(a) * r * m); g.lineTo(S / 2 + Math.cos(a + s * 0.25) * r * 0.85, S / 2 + Math.sin(a + s * 0.25) * r * 0.85); }
        g.stroke();
      }
    }),
    // wind: soft streaks round a funnel (wraps sideways)
    swirl: canvas(128, (g, S) => {
      g.clearRect(0, 0, S, S);
      for (let i = 0; i < 26; i++) {
        const y = rnd() * S, w = 20 + rnd() * 70, x = rnd() * S, h = 1 + rnd() * 3;
        const gr = g.createLinearGradient(x, 0, x + w, 0);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${0.35 + rnd() * 0.5})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        for (const dx of [0, -S]) g.fillRect(x + dx, y, w, h);
      }
    }),
    dot: canvas(64, (g, S) => {
      const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }),
  };
  TEX.swirl.wrapS = TEX.swirl.wrapT = THREE.RepeatWrapping;
  TEX.coals.wrapS = TEX.coals.wrapT = THREE.ClampToEdgeWrapping;
  return TEX;
}

const glowMat = (map, color, o = {}) => new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, ...o });
const sprite = (color, scale) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures().dot, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); s.scale.setScalar(scale); return s; };
const disc = (r, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2), mat); m.position.y = 0.04; m.renderOrder = 3; return m; };

export const HAMMER_FX = new Set(['hfire', 'hice', 'hwind', 'hbolt']);

export class HammerFxView {
  constructor(effects, cfg) { this.effects = effects; this.cfg = cfg; this.arcs = []; this.scene = null; }

  get H() { return this.cfg.crust.hammers; }

  // the view for one (added to `g`, which follows the projectile)
  build(type, g) {
    const T = textures(), L = this.H.look.linger, Tm = this.H.tempered;
    const v = { parts: {} };
    if (type === 'hfire') {
      const r = Tm.fire.pool.radius;
      v.parts.disc = disc(r, glowMat(T.coals, new THREE.Color(1, 0.36, 0.08).multiplyScalar(L.fire.discGlow)));
      v.parts.under = disc(r * 0.8, new THREE.MeshBasicMaterial({ color: '#120804', transparent: true, opacity: 0.7, depthWrite: false }));
      v.parts.under.position.y = 0.03;
      g.add(v.parts.under, v.parts.disc);
      v.parts.glow = sprite(new THREE.Color(1.6, 0.5, 0.1), r * 1.6); v.parts.glow.position.y = 0.6; g.add(v.parts.glow);
      v.radius = r; v.time = Tm.fire.pool.time;
    } else if (type === 'hice') {
      const r = Tm.ice.storm.radius;
      v.parts.disc = disc(r, new THREE.MeshBasicMaterial({ map: T.frost, color: new THREE.Color(0.8, 0.95, 1.1), transparent: true, depthWrite: false, toneMapped: false }));
      g.add(v.parts.disc);
      const iceMat = new THREE.MeshStandardMaterial({ color: '#cfefff', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85, emissive: new THREE.Color('#5ec8ff'), emissiveIntensity: 0.5 });
      v.spikes = [];
      for (let i = 0; i < L.ice.spikes; i++) {
        const a = (i / L.ice.spikes) * Math.PI * 2 + Math.random() * 0.5, d = r * (0.25 + Math.random() * 0.65);
        const h = L.ice.spikeHeight[0] + Math.random() * (L.ice.spikeHeight[1] - L.ice.spikeHeight[0]);
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.12 + Math.random() * 0.1, h, 5).translate(0, h / 2, 0), iceMat);
        s.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
        s.rotation.set((Math.random() - 0.5) * 0.6, Math.random() * 6, (Math.random() - 0.5) * 0.6);
        g.add(s); v.spikes.push(s);
      }
      v.parts.glow = sprite(new THREE.Color(0.4, 0.8, 1.2), r * 1.5); v.parts.glow.position.y = 0.8; g.add(v.parts.glow);
      v.radius = r; v.time = Tm.ice.storm.time;
    } else if (type === 'hwind') {
      const W = L.wind;
      v.funnel = [];
      // three twisting cones, one inside the other, each turning its own speed
      for (let k = 0; k < 3; k++) {
        const geo = new THREE.CylinderGeometry(W.radius[1] * (1 - k * 0.18), W.radius[0] * (1 - k * 0.15), W.height * (1 - k * 0.1), 24, 6, true).translate(0, W.height * (1 - k * 0.1) / 2, 0);
        const tx = T.swirl.clone(); tx.needsUpdate = true; tx.repeat.set(2 + k, 1);
        const m = new THREE.Mesh(geo, glowMat(tx, new THREE.Color(0.75, 0.9, 0.85).multiplyScalar(0.9 - k * 0.15)));
        m.renderOrder = 4; g.add(m); v.funnel.push({ m, tx, spin: W.spin * (1 + k * 0.4) * (k % 2 ? -0.6 : 1) });
      }
      v.time = Tm.wind.tornado.time;
    } else if (type === 'hbolt') {
      const B = L.lightning, y = Tm.lightning.orb.height;
      v.orb = new THREE.Group(); v.orb.position.y = 0; g.add(v.orb);
      v.parts.core = new THREE.Mesh(new THREE.SphereGeometry(B.core, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.6, 5), toneMapped: false }));
      v.parts.halo = sprite(new THREE.Color(1.2, 0.6, 2.2), B.glow);
      v.parts.halo2 = sprite(new THREE.Color(2, 1.6, 3), B.glow * 0.4);
      v.orb.add(v.parts.core, v.parts.halo, v.parts.halo2);
      v.lines = [];
      for (let i = 0; i < B.arcs; i++) {
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
        const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(2.4, 1.8, 4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        l.frustumCulled = false; v.orb.add(l); v.lines.push(l);
      }
      v.time = Tm.lightning.orb.time; v.height = y;
    }
    v.acc = {};
    return v;
  }

  // how far in it is (0..1 on the way in, 1 held, back down to 0 at the end)
  level(v, t) {
    const L = this.H.look.linger;
    return Math.max(0, Math.min(1, t / L.fadeIn, (v.time - t) / L.fadeOut));
  }

  every(v, key, rate, dt, fn) {
    v.acc[key] = (v.acc[key] || 0) + rate * dt;
    while (v.acc[key] >= 1) { v.acc[key] -= 1; fn(); }
  }

  update(type, view, g, dt, time) {
    const v = view.fx, t = view.t, k = this.level(v, t), L = this.H.look.linger, fx = this.effects, P = g.position;
    if (type === 'hfire') {
      const r = v.radius;
      v.parts.disc.material.opacity = k * (0.75 + Math.sin(time * 6) * 0.12 + Math.sin(time * 15) * 0.06);
      v.parts.disc.rotation.y += dt * 0.05;
      v.parts.under.material.opacity = 0.7 * k;
      v.parts.glow.material.opacity = 0.35 * k;
      if (fx.flames) {
        this.every(v, 'f', L.fire.flamesPerSec * k, dt, () => {
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r * 0.92;
          fx.flames.emit({ x: P.x + Math.cos(a) * d, y: P.y + 0.05, z: P.z + Math.sin(a) * d }, { x: (Math.random() - 0.5) * 0.3, y: 1 + Math.random() * 1.6, z: (Math.random() - 0.5) * 0.3 }, { size: L.fire.flameSize * (0.6 + Math.random() * 0.8), life: L.fire.flameLife * (0.6 + Math.random() * 0.7), rise: 2.2, drag: 1 });
        });
      }
      this.every(v, 'e', L.fire.emberPerSec * k, dt, () => {
        const a = Math.random() * Math.PI * 2, d = Math.random() * r;
        fx.spawnParticle(V(P.x + Math.cos(a) * d, P.y + 0.2, P.z + Math.sin(a) * d), V((Math.random() - 0.5) * 0.8, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 0.8), { life: 1 + Math.random(), size: 0.014, color: [5, 1.8, 0.4], gravity: -0.6, drag: 0.6 });
      });
    } else if (type === 'hice') {
      const r = v.radius, S = L.ice;
      v.parts.disc.material.opacity = Math.min(1, k * 1.2) * 0.85;
      v.parts.disc.scale.setScalar(0.3 + 0.7 * Math.min(1, t / 0.5));
      v.parts.glow.material.opacity = 0.25 * k;
      // spikes jut up as it lands, sink as it goes
      const grow = Math.min(1, t / 0.25), sink = Math.min(1, (v.time - t) / 0.8);
      for (const s of v.spikes) s.scale.set(1, Math.max(0.01, grow * sink), 1);
      // snow whirling round and round
      this.every(v, 's', S.snowPerSec * k, dt, () => {
        const a = Math.random() * Math.PI * 2, d = r * (0.2 + Math.random() * 0.8), y = Math.random() * 3;
        const tang = V(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(S.swirl * (1 + Math.random()));
        fx.spawnParticle(V(P.x + Math.cos(a) * d, P.y + y, P.z + Math.sin(a) * d), tang.add(V(0, -0.3, 0)), { life: 1 + Math.random() * 0.8, size: 0.02, color: [2.2, 2.6, 3], gravity: 0.6, drag: 0.1 });
      });
      this.every(v, 'm', S.mistPerSec * k, dt, () => {
        const a = Math.random() * Math.PI * 2, d = Math.random() * r * 0.8;
        fx.puff(V(P.x + Math.cos(a) * d, P.y + 0.3, P.z + Math.sin(a) * d), { color: 0xdff4ff, size: 1.2, grow: 2, life: 1.8, alpha: 0.35 * k, vel: V(-Math.sin(a) * 0.6, 0.15, Math.cos(a) * 0.6), shade: false });
      });
    } else if (type === 'hwind') {
      const W = L.wind;
      // it rises up out of the ground, and back down at the end
      g.scale.set(0.4 + 0.6 * k, Math.max(0.05, k), 0.4 + 0.6 * k);
      for (const f of v.funnel) {
        f.tx.offset.x += dt * f.spin * 0.15; f.tx.offset.y -= dt * 0.4;
        f.m.material.opacity = k * 0.8;
        f.m.rotation.y += dt * f.spin * 0.2;
      }
      // the funnel wanders a little
      for (const [i, f] of v.funnel.entries()) { f.m.position.x = Math.sin(time * 1.7 + i) * 0.15; f.m.position.z = Math.cos(time * 1.3 + i) * 0.15; }
      this.every(v, 'd', W.dustPerSec * k, dt, () => {
        const a = Math.random() * Math.PI * 2;
        fx.puff(V(P.x + Math.cos(a) * 1.2, P.y + 0.2, P.z + Math.sin(a) * 1.2), { color: 0x9a9080, size: 0.7, grow: 2.4, life: 1, alpha: 0.4, vel: V(-Math.sin(a) * 3, 0.8, Math.cos(a) * 3) });
      });
      this.every(v, 'b', W.debrisPerSec * k, dt, () => {
        const a = Math.random() * Math.PI * 2, y = Math.random() * W.height * 0.8, rr = W.radius[0] + (W.radius[1] - W.radius[0]) * (y / W.height);
        const tang = V(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(W.spin * rr * 0.9);
        fx.spawnParticle(V(P.x + Math.cos(a) * rr, P.y + y, P.z + Math.sin(a) * rr), tang.add(V(0, 2.5, 0)), { life: 0.5 + Math.random() * 0.4, size: 0.018, color: [0.5, 0.45, 0.35], gravity: 0, drag: 0 });
      });
    } else if (type === 'hbolt') {
      const B = L.lightning;
      const s = k * (1 + Math.sin(time * 23) * 0.08 + (Math.random() < 0.1 ? 0.3 : 0));
      v.orb.scale.setScalar(Math.max(0.01, s));
      v.orb.position.y = Math.sin(time * 2.2) * 0.12;
      v.parts.halo.material.opacity = 0.7 + Math.random() * 0.3;
      // little arcs crackling off it, new every frame
      for (const l of v.lines) {
        const a = l.geometry.attributes.position.array;
        const d = V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        const len = B.arcReach * (0.4 + Math.random() * 0.6);
        for (let i = 0; i < 8; i++) {
          const f = i / 7, j = i && i < 7 ? 0.12 : 0;
          a[i * 3] = d.x * len * f + (Math.random() - 0.5) * j; a[i * 3 + 1] = d.y * len * f + (Math.random() - 0.5) * j; a[i * 3 + 2] = d.z * len * f + (Math.random() - 0.5) * j;
        }
        l.geometry.attributes.position.needsUpdate = true;
        l.visible = Math.random() < 0.7;
      }
      this.every(v, 'sp', B.sparksPerSec * k, dt, () => {
        const d = V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        fx.spawnParticle(V(P.x, P.y + v.orb.position.y, P.z).addScaledVector(d, B.core), d.multiplyScalar(2 + Math.random() * 3), { life: 0.3, size: 0.012, color: [3, 2.2, 5], gravity: 2, drag: 1 });
      });
    }
  }

  // the ball striking something: a bolt from it to them
  zap(scene, points) {
    const [a, b] = points.map((p) => V(p.x, p.y, p.z));
    for (const [col, jit] of [[new THREE.Color(1.6, 0.9, 3), 0.45], [new THREE.Color(3, 3, 3.6), 0.2]]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) { const p = a.clone().lerp(b, i / 10); if (i && i < 10) p.add(V((Math.random() - 0.5) * jit, (Math.random() - 0.5) * jit, (Math.random() - 0.5) * jit)); pts.push(p); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      line.frustumCulled = false; scene.add(line);
      this.arcs.push({ line, life: 0.25, scene });
    }
    this.effects.energyBurst(b, '#b98aff', 0.9);
  }

  updateArcs(dt) {
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.life -= dt; a.line.material.opacity = Math.max(0, a.life / 0.25);
      if (a.life <= 0) { a.scene.remove(a.line); a.line.geometry.dispose(); this.arcs.splice(i, 1); }
    }
  }

  clear() { for (const a of this.arcs) a.scene.remove(a.line); this.arcs = []; }
}
