// =============================================================================
// Projectile visuals: thrown frags, launcher rounds, crossbow bolts and
// ballistic knife blades. Follows sim.projectiles with interpolation.
// =============================================================================
import * as THREE from 'three';
import { gunMaterials } from './gunModels.js';
import * as T from './textures.js';

const _d = new THREE.Vector3();
const FWD = new THREE.Vector3(0, 0, -1);

export class ProjectileViews {
  constructor(scene, effects, cfg = null) {
    this.cfg = cfg;
    this.scene = scene;
    this.effects = effects;
    this.views = new Map();
    this.prev = new Map();
    const m = gunMaterials();
    this.mats = m;
    this.fragMat = new THREE.MeshStandardMaterial({ color: '#3d4733', roughness: 0.75 });
    this.beepMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.2) });
    this.bladeMat = new THREE.MeshStandardMaterial({ color: '#a0a2a0', roughness: 0.25, metalness: 0.9 });
    this.time = 0;
    this.glowTex = T.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  }

  build(e) {
    const g = new THREE.Group();
    const m = this.mats;
    const add = (geo, mat, x = 0, y = 0, z = 0) => { const q = new THREE.Mesh(geo, mat); q.position.set(x, y, z); g.add(q); return q; };
    let beep = null, spin = null, glow = null;
    if (e.ptype === 'fucci') {
      const up = this.cfg && e.weapon && this.cfg.weapons[e.weapon] && this.cfg.weapons[e.weapon].upgraded;
      const col = up ? new THREE.Color(3.2, 0.6, 1.8) : new THREE.Color(3.2, 2.4, 0.7);
      const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      add(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.6, 2.6) }));
      for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.1 + i * 0.03, 0.012, 6, 20), ringMat, 0, 0, 0.12 + i * 0.13);
      glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      glow.scale.setScalar(0.6); g.add(glow);
    } else if (e.ptype === 'saw') {
      spin = new THREE.Group(); g.add(spin);
      const steel = new THREE.MeshStandardMaterial({ color: '#d0d0ca', metalness: 0.35, roughness: 0.35, emissive: new THREE.Color(0.12, 0.12, 0.12) });
      spin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 28), steel));
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.012), steel);
        t.position.set(Math.cos(a) * 0.21, 0, Math.sin(a) * 0.21); t.rotation.y = -a + 0.5; spin.add(t);
      }
      spin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10), m.darkMetal));
      // motion blur disc
      const blur = new THREE.Mesh(new THREE.CircleGeometry(0.23, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd0d0d0, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
      g.add(blur);
    } else if (e.ptype === 'stewbomb') {
      const steel = new THREE.MeshStandardMaterial({ color: '#a8a69c', metalness: 0.4, roughness: 0.35 });
      add(new THREE.CylinderGeometry(0.11, 0.1, 0.15, 16), steel, 0, 0.075, 0);
      const lid = add(new THREE.CylinderGeometry(0.115, 0.115, 0.015, 16), steel, 0, 0.16, 0);
      add(new THREE.SphereGeometry(0.018, 8, 6), m.metal, 0, 0.18, 0);
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.015, 0.025), m.metal, sx * 0.13, 0.12, 0);
      const ladle = add(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 6), steel, 0.06, 0.25, 0); ladle.rotation.z = -0.5;
      beep = add(new THREE.SphereGeometry(0.014, 8, 6), this.beepMat, 0, 0.08, 0.105);
      spin = lid;
      glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(1.6, 1.0, 0.3), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
      glow.scale.setScalar(1.6); glow.position.y = 0.2; g.add(glow);
    } else if (e.ptype === 'frag') {
      add(new THREE.SphereGeometry(0.045, 10, 8), this.fragMat).scale.set(1, 1.25, 1);
      add(new THREE.BoxGeometry(0.018, 0.03, 0.018), m.metal, 0, 0.06, 0);
    } else if (e.ptype === 'launcher') {
      const body = add(new THREE.CylinderGeometry(0.02, 0.02, 0.09, 10), m.darkMetal);
      body.rotation.x = Math.PI / 2;
      const nose = add(new THREE.SphereGeometry(0.02, 10, 8), m.metal, 0, 0, -0.045);
      nose.scale.z = 1.4;
    } else if (e.ptype === 'bolt') {
      const shaft = add(new THREE.CylinderGeometry(0.005, 0.005, 0.42, 6), m.black);
      shaft.rotation.x = Math.PI / 2;
      const head = add(new THREE.CylinderGeometry(0.0, 0.016, 0.06, 6), m.metal, 0, 0, -0.23);
      head.rotation.x = -Math.PI / 2;
      add(new THREE.BoxGeometry(0.03, 0.03, 0.05), m.darkMetal, 0, 0, -0.17);
      for (const r of [0, Math.PI / 2]) add(new THREE.BoxGeometry(0.035, 0.002, 0.06), m.bakelite, 0, 0, 0.18).rotation.z = r;
      beep = add(new THREE.SphereGeometry(0.008, 6, 6), this.beepMat, 0, 0.018, -0.17);
    } else {
      const blade = add(new THREE.BoxGeometry(0.004, 0.026, 0.16), this.bladeMat, 0, 0, -0.06);
      blade.scale.y = 1;
      const tip = add(new THREE.CylinderGeometry(0, 0.013, 0.04, 3), this.bladeMat, 0, 0, -0.16);
      tip.rotation.x = -Math.PI / 2; tip.scale.set(0.3, 1, 1);
      add(new THREE.BoxGeometry(0.02, 0.03, 0.01), m.darkMetal, 0, 0, 0.025);
    }
    this.scene.add(g);
    return { g, type: e.ptype, beep, spinner: spin, glow, stuck: false, spin: 0, trailT: 0, t: 0 };
  }

  beginStep(sim) {
    for (const pr of sim.projectiles) {
      let p = this.prev.get(pr.id);
      if (!p) { p = new THREE.Vector3(); this.prev.set(pr.id, p); }
      p.set(pr.pos.x, pr.pos.y, pr.pos.z);
    }
  }

  onEvent(e) {
    if (e.type === 'projectileSpawn') {
      if (!this.views.has(e.id)) this.views.set(e.id, this.build(e));
    } else if (e.type === 'projectileStick') {
      const v = this.views.get(e.id);
      if (v) {
        v.stuck = true;
        if (e.dir) { _d.set(e.dir.x, e.dir.y, e.dir.z).normalize(); v.g.quaternion.setFromUnitVectors(FWD, _d); }
      }
    } else if (e.type === 'projectileGone') {
      const v = this.views.get(e.id);
      if (v) { this.scene.remove(v.g); this.views.delete(e.id); }
      this.prev.delete(e.id);
    }
  }

  update(sim, dt, alpha) {
    this.time += dt;
    const live = new Map(sim.projectiles.map((p) => [p.id, p]));
    for (const [id, v] of this.views) {
      const pr = live.get(id);
      if (!pr) { this.scene.remove(v.g); this.views.delete(id); continue; }
      const prev = this.prev.get(id);
      if (prev && !v.stuck) v.g.position.lerpVectors(prev, _d.set(pr.pos.x, pr.pos.y, pr.pos.z), alpha);
      else v.g.position.set(pr.pos.x, pr.pos.y, pr.pos.z);
      v.t += dt;
      if (v.type === 'saw') {
        v.spinner.rotation.y -= dt * 40;
        // the blade flies flat, tilted a little toward its heading
        const sp = Math.hypot(pr.vel.x, pr.vel.z);
        if (sp > 0.1) v.g.rotation.set(0, Math.atan2(pr.vel.x, pr.vel.z), 0.15);
        v.trailT += dt;
        while (v.trailT > 0.03) { v.trailT -= 0.03; this.effects.spawnParticle(v.g.position, new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3), { life: 0.12, size: 0.008, color: [4, 2.6, 1], gravity: 8, drag: 1 }); }
      } else if (v.type === 'fucci') {
        const sp = Math.hypot(pr.vel.x, pr.vel.y, pr.vel.z);
        if (sp > 0.1) { _d.set(pr.vel.x / sp, pr.vel.y / sp, pr.vel.z / sp); v.g.quaternion.setFromUnitVectors(FWD, _d); }
        v.glow.scale.setScalar(0.55 + Math.sin(this.time * 40) * 0.08);
      } else if (v.type === 'stewbomb') {
        if (!pr.resting) { v.spin += dt * 9; v.g.rotation.set(v.spin * 0.6, v.spin, 0); }
        else {
          // rattling lid, steam, blinking fuse light, a warm glow
          v.g.rotation.set(0, v.g.rotation.y, 0);
          v.spinner.position.y = 0.16 + Math.abs(Math.sin(this.time * 18)) * 0.02;
          v.spinner.rotation.z = Math.sin(this.time * 23) * 0.12;
          v.glow.material.opacity = 0.4 + Math.sin(this.time * 6) * 0.15;
          const left = pr.fuse;
          v.beep.visible = Math.sin(this.time * (left < 2 ? 30 : 8)) > 0;
          v.trailT += dt;
          while (v.trailT > 0.12) { v.trailT -= 0.12; this.effects.puff(v.g.position.clone().add(new THREE.Vector3(0, 0.25, 0)), { color: 0xd8d0c0, size: 0.12, grow: 3, life: 1.2, alpha: 0.25, vel: new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.7, (Math.random() - 0.5) * 0.2) }); }
        }
        continue;
      } else if (v.type === 'frag') {
        if (!pr.resting) { v.spin += dt * 14; v.g.rotation.set(v.spin, v.spin * 0.7, 0); }
      } else if (!v.stuck) {
        const sp = Math.hypot(pr.vel.x, pr.vel.y, pr.vel.z);
        if (sp > 0.1) { _d.set(pr.vel.x / sp, pr.vel.y / sp, pr.vel.z / sp); v.g.quaternion.setFromUnitVectors(FWD, _d); }
        if (v.type === 'launcher') {
          v.trailT += dt;
          while (v.trailT > 0.02) { v.trailT -= 0.02; this.effects.puff(v.g.position.clone(), { color: 0x8a8478, size: 0.12, grow: 3, life: 0.9, alpha: 0.4, vel: new THREE.Vector3(0, 0.3, 0) }); }
        }
      }
      // crossbow bolt: beeps faster as it is about to go
      if (v.beep) {
        if (v.stuck && isFinite(pr.fuse)) {
          const rate = 4 + (1 - Math.max(0, pr.fuse)) * 14;
          v.beep.visible = Math.sin(this.time * rate * Math.PI * 2) > 0;
        } else v.beep.visible = true;
      }
    }
  }

  clear() {
    for (const v of this.views.values()) this.scene.remove(v.g);
    this.views.clear(); this.prev.clear();
  }
}
