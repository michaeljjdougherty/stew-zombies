// =============================================================================
// The War Hammers' trials, drawn (Call of the Crust; src/sim/hammerTrials.js):
// the buoys bobbing out over the void off the Ship Graveyard, the Trench
// Front's craters burning while the Fire trial's on (white-hot once you've
// been through), and the ice shrine glowing once it's ready to be smashed.
// Owned by TitanView (src/render/titanView.js).
// =============================================================================
import * as THREE from 'three';

const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false };

export class TrialsView {
  constructor(group, sim, cfg, map, effects, glowTex) {
    this.group = new THREE.Group(); this.group.name = 'trials';
    group.add(this.group);
    this.sim = sim; this.cfg = cfg; this.map = map; this.effects = effects; this.glowTex = glowTex;
    this.build();
  }

  T() { return this.sim && this.sim.crustEgg && this.sim.crustEgg.trials; }

  setSim(sim) { this.sim = sim; this.clear(); this.build(); }

  clear() {
    for (const o of [...this.group.children]) this.group.remove(o);
    for (const l of this.lights || []) this.map.removeVirtualLight(l);
    this.lights = [];
  }

  build() {
    const T = this.T();
    this.buoys = []; this.craters = []; this.lights = []; this.shrine = null;
    if (!T) return;
    // a buoy: a rusted float with a green lamp on top
    const body = new THREE.SphereGeometry(0.55, 14, 10), cap = new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6);
    for (const b of T.wind.buoys) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color: 0x8a3b22, roughness: 0.7, metalness: 0.4 }));
      g.add(m);
      const pole = new THREE.Mesh(cap, new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.6 })); pole.position.y = 0.8; g.add(pole);
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(0.6, 2.4, 1.2), ...ADD })); lamp.position.y = 1.3; lamp.scale.setScalar(1.6); g.add(lamp);
      g.position.set(b.x, b.y, b.z);
      g.visible = false;
      this.group.add(g);
      this.buoys.push({ b, g, lamp, phase: Math.random() * 6 });
    }
    // the craters: a ring of fire round each rim
    const ring = new THREE.RingGeometry(0.82, 1, 40, 1); ring.rotateX(-Math.PI / 2);
    for (const k of T.fire.craters) {
      const m = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.8, 0.12), side: THREE.DoubleSide, opacity: 0, ...ADD }));
      m.position.set(k.x, k.y + 0.12, k.z); m.scale.setScalar(k.r + 0.4); m.visible = false;
      this.group.add(m);
      const light = this.map.addVirtualLight({ x: k.x, y: k.y + 1, z: k.z }, 0xff6a18, 8, k.r * 4, 1.7); light.live = true; light.level = 0;
      this.lights.push(light);
      this.craters.push({ k, m, light });
    }
    // the ice shrine: a pale crystal on the summit
    if (T.ice.shrine) {
      const s = T.ice.shrine;
      const g = new THREE.Group();
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x2a6a90, roughness: 0.15, transparent: true, opacity: 0.85 }));
      c.scale.set(0.7, 1.6, 0.7); c.position.y = 1.6; g.add(c);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(0.6, 1.4, 2.6), opacity: 0, ...ADD })); glow.position.y = 1.6; glow.scale.setScalar(4); g.add(glow);
      g.position.set(s.x, s.y, s.z); g.visible = false;
      this.group.add(g);
      this.shrine = { g, c, glow };
    }
  }

  update(dt, time) {
    const T = this.T();
    if (!T) return;
    const on = (el) => T[el].state === 'open';
    for (const v of this.buoys) {
      v.g.visible = on('wind') && !v.b.hit;
      if (!v.g.visible) continue;
      v.g.position.y = v.b.y + Math.sin(time * 1.3 + v.phase) * 0.35;
      v.g.rotation.z = Math.sin(time * 0.9 + v.phase) * 0.15;
      v.lamp.material.opacity = 0.6 + 0.4 * (Math.sin(time * 4 + v.phase) > 0 ? 1 : 0.3);
    }
    const fire = on('fire');
    for (const v of this.craters) {
      v.m.visible = fire;
      v.light.level = fire ? (v.k.lit ? 1 : 0.45) * (0.85 + Math.sin(time * 9 + v.k.x) * 0.15) : 0;
      if (!fire) continue;
      v.m.material.opacity = (v.k.lit ? 1 : 0.5) * (0.7 + Math.sin(time * 7 + v.k.z) * 0.2);
      v.m.material.color.setRGB(v.k.lit ? 4 : 3, v.k.lit ? 2.6 : 0.8, v.k.lit ? 1.2 : 0.12);
      if (Math.random() < dt * 14) {
        const a = Math.random() * Math.PI * 2, r = v.k.r + 0.3;
        this.effects.spawnParticle(new THREE.Vector3(v.k.x + Math.cos(a) * r, v.k.y + 0.2, v.k.z + Math.sin(a) * r), new THREE.Vector3(0, 1.8 + Math.random() * 1.5, 0), { life: 0.8, size: 0.035, color: [4, 1.2, 0.2], gravity: -1, drag: 0.5 });
      }
    }
    if (this.shrine) {
      const ready = on('ice') && T.ice.count >= this.cfg.crust.trials.ice.count;
      this.shrine.g.visible = on('ice');
      this.shrine.c.rotation.y += dt * 0.6;
      this.shrine.glow.material.opacity = ready ? 0.6 + Math.sin(time * 5) * 0.3 : 0.12;
    }
  }

  onEvent(e) {
    if (e.type === 'trialStep' && e.pos) {
      const col = { wind: [1.4, 2.4, 2], fire: [4, 1.4, 0.3], ice: [1.4, 1.8, 2.4] }[e.element] || [2, 2, 2];
      for (let i = 0; i < 30; i++) this.effects.spawnParticle(new THREE.Vector3(e.pos.x, e.pos.y + 0.8, e.pos.z), new THREE.Vector3((Math.random() - 0.5) * 7, Math.random() * 6, (Math.random() - 0.5) * 7), { life: 0.9, size: 0.035, color: col, gravity: 8, drag: 0.5 });
    }
    if (e.type === 'trialDone' && e.element === 'ice' && this.shrine) {
      const p = this.shrine.g.position;
      for (let i = 0; i < 60; i++) this.effects.spawnParticle(new THREE.Vector3(p.x, p.y + 1.6, p.z), new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 7, (Math.random() - 0.5) * 9), { life: 1.2, size: 0.05, color: [1.4, 1.8, 2.4], gravity: 11, drag: 0.4 });
    }
  }
}
