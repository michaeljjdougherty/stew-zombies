// =============================================================================
// Mystery box: a battered crate with glowing question marks and a beam of
// light. When bought the lid flies open and guns cycle above it until it
// lands on the pull.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';
import { buildGun } from './gunModels.js';

const W = 1.05, H = 0.55, D = 0.52;

export class BoxView {
  constructor(scene, sim, cfg, mapView) {
    this.scene = scene;
    this.sim = sim;
    this.cfg = cfg;
    this.group = new THREE.Group();
    scene.add(this.group);

    const side = T.mysteryBoxTexture();
    const qm = T.questionMarkTexture();
    this.glowMat = new THREE.MeshStandardMaterial({ map: side, emissive: new THREE.Color(0.55, 0.85, 1.2), emissiveMap: qm, emissiveIntensity: 1.2, roughness: 0.85 });
    const plain = new THREE.MeshStandardMaterial({ map: side, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [plain, plain, plain, plain, this.glowMat, this.glowMat]);
    body.position.y = H / 2 + 0.05;
    this.group.add(body);
    // feet
    for (const [x, z] of [[-0.45, -0.2], [0.45, -0.2], [-0.45, 0.2], [0.45, 0.2]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.08), mapView.mats.rustMetal);
      f.position.set(x, 0.025, z); this.group.add(f);
    }
    // dark inside
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, D - 0.06).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#050403' }));
    inside.position.y = H + 0.04;
    this.group.add(inside);
    // lid hinged along the back edge
    this.lid = new THREE.Group();
    this.lid.position.set(0, H + 0.05, -D / 2);
    this.group.add(this.lid);
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.06, D + 0.02), [plain, plain, this.glowMat, plain, plain, plain]);
    lidMesh.position.set(0, 0.03, D / 2);
    this.lid.add(lidMesh);

    // beam of light that marks the box's location
    const beamTex = T.beamTexture();
    const roomH = sim.world.roomById.get(sim.box.spot.room).height;
    const bh = roomH - 0.7;
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, bh, 16, 1, true),
      new THREE.MeshBasicMaterial({ map: beamTex, color: 0x6fc6ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    this.beam.rotation.x = Math.PI; // bright end at the bottom
    this.beam.position.y = 0.65 + bh / 2; // from the lid up to the ceiling
    this.group.add(this.beam);
    this.light = mapView.addVirtualLight({ x: 0, y: 1.2, z: 0 }, 0x7fcfff, 7, 6, 1.8);

    // floating weapon display
    this.display = new THREE.Group();
    this.display.position.y = 0.5;
    this.group.add(this.display);
    this.guns = new Map();
    for (const id of Object.keys(cfg.box.weights)) {
      const def = cfg.weapons[id];
      if (!def) continue;
      const g = buildGun(def.view.model);
      g.group.rotation.y = Math.PI / 2; // barrel along the box's length
      g.group.scale.setScalar(1.25);
      g.group.visible = false;
      this.display.add(g.group);
      this.guns.set(id, g.group);
    }
    this.pool = [...this.guns.keys()];

    this.phase = 'idle';
    this.t = 0;
    this.cycleT = 0;
    this.shown = null;
    this.lidAngle = 0;
    this.place();
  }

  place() {
    const s = this.sim.box.spot;
    this.group.position.set(s.x, 0, s.z);
    this.group.rotation.y = s.yaw;
    this.light.pos.set(s.x + Math.sin(s.yaw) * 0.4, 1.2, s.z + Math.cos(s.yaw) * 0.4);
  }

  setSim(sim) { this.sim = sim; this.phase = 'idle'; this.show(null); this.place(); }

  show(id) {
    if (this.shown === id) return;
    if (this.shown) this.guns.get(this.shown).visible = false;
    this.shown = id;
    if (id) this.guns.get(id).visible = true;
  }

  onEvent(e) {
    switch (e.type) {
      case 'boxOpen': this.phase = 'spinning'; this.t = 0; this.cycleT = 0; this.final = e.weapon; this.spinTime = e.spinTime; break;
      case 'boxLanded': this.phase = 'offering'; this.t = 0; this.show(e.weapon); break;
      case 'boxTaken': case 'boxExpired': this.phase = 'closing'; this.t = 0; this.taken = e.type === 'boxTaken'; break;
      case 'boxClosed': this.phase = 'idle'; this.show(null); break;
    }
  }

  update(dt, time) {
    this.t += dt;
    const open = this.phase === 'spinning' || this.phase === 'offering';
    const target = open ? -1.95 : 0;
    this.lidAngle += (target - this.lidAngle) * Math.min(1, dt * (open ? 9 : 5));
    this.lid.rotation.x = this.lidAngle;

    if (this.phase === 'spinning') {
      // rise, then cycle faster-to-slower through the pool
      const k = Math.min(1, this.t / this.spinTime);
      this.display.position.y = 0.45 + Math.min(1, this.t / 0.6) * 0.55;
      this.cycleT -= dt;
      if (this.cycleT <= 0) {
        const others = this.pool.filter((id) => id !== this.shown);
        this.show(others[Math.floor(Math.random() * others.length)]);
        this.cycleT = 0.06 + k * k * 0.35;
      }
      this.display.rotation.y = Math.sin(time * 3) * 0.3;
    } else if (this.phase === 'offering') {
      this.display.position.y = 1.0 + Math.sin(time * 2.2) * 0.03;
      // sink back in as time runs out
      const left = this.sim.box.timer;
      if (left < 3) this.display.position.y -= (1 - left / 3) * 0.5;
      this.display.rotation.y = Math.sin(time * 1.2) * 0.15;
    } else if (this.phase === 'closing') {
      this.display.position.y = Math.max(0.2, this.display.position.y - dt * (this.taken ? 3 : 0.8));
      if (this.taken || this.display.position.y <= 0.25) this.show(null);
    }
    // question marks pulse, brighter while in use
    const pulse = 0.9 + Math.sin(time * 2.4) * 0.25 + (open ? 0.8 : 0);
    this.glowMat.emissiveIntensity = pulse;
    this.beam.material.opacity = 0.06 + Math.sin(time * 1.3) * 0.015;
    this.light.level = 0.8 + (open ? 0.9 : 0) + Math.sin(time * 5) * 0.05;
  }
}
