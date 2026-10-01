// =============================================================================
// Projectile visuals: thrown frags, launcher rounds, crossbow bolts and
// ballistic knife blades. Follows sim.projectiles with interpolation.
// =============================================================================
import * as THREE from 'three';
import { gunMaterials } from './gunModels.js';

const _d = new THREE.Vector3();
const FWD = new THREE.Vector3(0, 0, -1);

export class ProjectileViews {
  constructor(scene, effects) {
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
  }

  build(e) {
    const g = new THREE.Group();
    const m = this.mats;
    const add = (geo, mat, x = 0, y = 0, z = 0) => { const q = new THREE.Mesh(geo, mat); q.position.set(x, y, z); g.add(q); return q; };
    let beep = null;
    if (e.ptype === 'frag') {
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
    return { g, type: e.ptype, beep, stuck: false, spin: 0, trailT: 0 };
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
      if (v.type === 'frag') {
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
