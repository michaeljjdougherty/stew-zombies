// =============================================================================
// Power-up drops: a glowing symbol spinning and bobbing over the floor, a
// green halo and light, blinking before it disappears.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';
import { drawPowerupIcon } from './powerupIcons.js';

export class PowerupViews {
  constructor(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    this.views = new Map();
    this.time = 0;
    this.tex = new Map();
    this.haloTex = T.softDotTexture('rgba(160,255,150,0.9)', 'rgba(60,255,80,0)');
    this.lights = [0].map(() => { const l = new THREE.PointLight(0x66ff66, 0, 6, 1.6); scene.add(l); return l; });
  }

  iconTexture(type) {
    if (this.tex.has(type)) return this.tex.get(type);
    const [c, g] = T.makeCanvas(256, 256);
    drawPowerupIcon(g, type, 256, '#eaffdf');
    const t = T.toTexture(c, { repeat: false });
    this.tex.set(type, t);
    return t;
  }

  build(e) {
    const g = new THREE.Group();
    g.position.set(e.pos.x, 0, e.pos.z);
    const mat = new THREE.MeshBasicMaterial({ map: this.iconTexture(e.ptype), color: new THREE.Color(2.4, 3.4, 2.4), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
    const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), mat);
    icon.position.y = 1.1;
    g.add(icon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.haloTex, color: new THREE.Color(0.18, 0.7, 0.18), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.7 }));
    halo.scale.setScalar(1.05); halo.position.y = 1.1;
    halo.renderOrder = -1;
    g.add(halo);
    // a ring of light on the floor
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.2, 0.3), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.y = 0.02;
    g.add(ring);
    this.scene.add(g);
    return { g, icon, halo, ring, mat, t: 0, ptype: e.ptype };
  }

  onEvent(e, effects) {
    if (e.type === 'powerupSpawn') {
      this.views.set(e.id, this.build(e));
      if (effects) effects.puff(new THREE.Vector3(e.pos.x, 1, e.pos.z), { color: 0x80ff80, size: 0.6, grow: 2, life: 0.6, alpha: 0.4 });
    } else if (e.type === 'powerupGone') {
      const v = this.views.get(e.id);
      if (!v) return;
      if (effects && e.taken) {
        const p = v.g.position.clone(); p.y = 1.1;
        for (let i = 0; i < 24; i++) effects.spawnParticle(p, new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5), { life: 0.5, size: 0.02, color: [0.6, 3, 0.6], gravity: 2, drag: 1.5 });
      }
      this.scene.remove(v.g);
      this.views.delete(e.id);
    }
  }

  update(dt, sim, camera) {
    this.time += dt;
    const blinkAt = this.cfg.powerups.blinkAt;
    const drops = new Map(sim.powerups.drops.map((d) => [d.id, d]));
    let li = 0;
    for (const [id, v] of this.views) {
      const d = drops.get(id);
      if (!d) { this.scene.remove(v.g); this.views.delete(id); continue; }
      v.t += dt;
      v.icon.position.y = 1.1 + Math.sin(this.time * 2.2 + id) * 0.08;
      v.halo.position.y = v.icon.position.y;
      v.icon.rotation.y += dt * 1.8;
      // blink faster as it's about to vanish
      let vis = true;
      if (d.t < blinkAt) vis = Math.sin(this.time * (d.t < 3 ? 22 : 10)) > -0.2;
      v.icon.visible = v.halo.visible = vis;
      v.ring.material.opacity = 0.35 + Math.sin(this.time * 3) * 0.15;
      if (li < this.lights.length) {
        const l = this.lights[li++];
        l.position.set(v.g.position.x, 1.2, v.g.position.z);
        l.intensity = vis ? 5 : 1;
      }
    }
    for (; li < this.lights.length; li++) this.lights[li].intensity = 0;
    void camera;
  }

  clear() {
    for (const v of this.views.values()) this.scene.remove(v.g);
    this.views.clear();
    for (const l of this.lights) l.intensity = 0;
  }
}
