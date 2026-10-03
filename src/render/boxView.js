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
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 1, 16, 1, true),
      new THREE.MeshBasicMaterial({ map: beamTex, color: 0x6fc6ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    this.beam.rotation.x = Math.PI; // bright end at the bottom
    this.group.add(this.beam);
    this.mapView = mapView;
    this.light = mapView.addVirtualLight({ x: 0, y: 1.2, z: 0 }, 0x7fcfff, 7, 6, 1.8);
    this.light.live = true; // it moves with the box: drawn live, not baked

    // floating weapon display
    this.display = new THREE.Group();
    this.display.position.y = 0.5;
    this.group.add(this.display);
    this.guns = new Map();
    for (const id of Object.keys(cfg.box.weights)) {
      const def = cfg.weapons[id];
      let obj;
      if (def) {
        obj = buildGun(def.view.model).group;
        obj.rotation.y = Math.PI / 2; // barrel along the box's length
        obj.scale.setScalar(1.25);
      } else if (id === 'stewBomb') obj = stewPot();
      else continue;
      obj.visible = false;
      this.display.add(obj);
      this.guns.set(id, obj);
    }
    this.pool = [...this.guns.keys()];
    // Erik's bobblehead: what the box gives you when it's about to leave
    this.bobble = bobblehead();
    this.bobble.visible = false;
    this.display.add(this.bobble);
    this.guns.set('bobble', this.bobble);

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
    this.group.rotation.set(0, s.yaw, 0);
    this.group.scale.setScalar(1);
    this.light.pos.set(s.x + Math.sin(s.yaw) * 0.4, 1.2, s.z + Math.cos(s.yaw) * 0.4);
    const room = this.sim.world.roomById.get(s.room);
    const bh = room.outdoor ? 14 : room.height - 0.7;
    this.beam.scale.y = bh;
    this.beam.position.y = 0.65 + bh / 2; // from the lid up to the ceiling (or the sky)
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
      case 'boxBobble': this.phase = 'bobble'; this.t = 0; this.show('bobble'); break;
      case 'boxMoved': this.phase = 'arriving'; this.t = 0; this.show(null); this.place(); this.landed = false; break;
      case 'boxArrived': this.phase = 'idle'; break;
    }
  }

  update(dt, time) {
    this.t += dt;
    if (this.phase === 'bobble') return this.updateLeaving(dt, time);
    if (this.phase === 'arriving') return this.updateArriving(dt, time);
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

  // The bobblehead pops up and nods at you, then the box lifts off and is gone.
  updateLeaving(dt, time) {
    const T = this.cfg.box.leaveTime;
    this.lid.rotation.x += (-1.95 - this.lid.rotation.x) * Math.min(1, dt * 9);
    this.display.position.y = 0.45 + Math.min(1, this.t / 0.5) * 0.65;
    this.display.rotation.y = Math.sin(time * 1.5) * 0.4;
    this.bobble.userData.head.rotation.x = Math.sin(time * 11) * 0.25;
    this.bobble.userData.head.rotation.z = Math.sin(time * 7) * 0.12;
    const lift = Math.max(0, (this.t - T * 0.45) / (T * 0.55));
    const s = this.sim.box.spot;
    this.group.position.set(s.x + Math.sin(time * 30) * 0.03 * Math.min(1, lift * 4), lift * lift * 9, s.z);
    this.group.rotation.y = s.yaw + lift * lift * 8;
    this.group.scale.setScalar(Math.max(0.01, 1 - lift * 0.9));
    if (lift > 0.75) this.show(null);
    this.glowMat.emissiveIntensity = 2 + Math.sin(time * 25) * 1;
    this.beam.material.opacity = Math.max(0, 0.07 * (1 - lift * 2));
    this.light.level = (1 - lift) * (1.2 + Math.sin(time * 20) * 0.4);
  }

  // Drops out of the sky into its new spot in a cloud of dust.
  updateArriving(dt, time) {
    const T = this.cfg.box.arriveTime;
    const k = Math.min(1, this.t / (T * 0.6));
    const s = this.sim.box.spot;
    this.group.position.set(s.x, (1 - k * k) * 7, s.z);
    this.group.rotation.y = s.yaw + (1 - k) * 3;
    this.group.scale.setScalar(1);
    this.lid.rotation.x = 0;
    if (k >= 1 && !this.landed) {
      this.landed = true;
      if (this.onLand) this.onLand(s);
    }
    this.glowMat.emissiveIntensity = 1.2;
    this.beam.material.opacity = 0.07 * Math.min(1, this.t / T);
    this.light.level = 0.9;
  }
}

function stewPot() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#9a9890', metalness: 0.85, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.2, 18), steel); g.add(body);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.02, 18), steel); lid.position.y = 0.11; g.add(lid);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), steel); knob.position.y = 0.13; g.add(knob);
  const ladle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.34, 6), steel); ladle.position.set(0.08, 0.2, 0); ladle.rotation.z = -0.5; g.add(ladle);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.2) })); light.position.set(0, 0, 0.14); g.add(light);
  g.scale.setScalar(1.3);
  return g;
}

// A cartoon bobblehead of Erik: little body on a base, a huge head on a
// spring, a smug grin and glasses.
function bobblehead() {
  const g = new THREE.Group();
  const std = (c, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const skin = std('#d8a888'), shirt = std('#2a3a6a'), hair = std('#24140a', 1), dark = std('#111', 0.3);
  const add = (geo, mat, x, y, z, p = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); p.add(m); return m; };
  add(new THREE.CylinderGeometry(0.1, 0.11, 0.04, 16), std('#c9a23a', 0.3), 0, -0.1, 0);
  add(new THREE.BoxGeometry(0.1, 0.12, 0.06), shirt, 0, -0.02, 0);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.03, 0.1, 0.03), shirt, s * 0.065, -0.02, 0.01).rotation.z = s * 0.3;
  const spring = add(new THREE.CylinderGeometry(0.01, 0.01, 0.05, 6), std('#888', 0.3), 0, 0.06, 0);
  void spring;
  const head = new THREE.Group(); head.position.set(0, 0.08, 0); g.add(head);
  add(new THREE.SphereGeometry(0.11, 16, 12), skin, 0, 0.1, 0, head).scale.set(1, 1.05, 0.95);
  add(new THREE.SphereGeometry(0.112, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hair, 0, 0.115, -0.01, head);
  for (const s of [-1, 1]) {
    add(new THREE.TorusGeometry(0.026, 0.005, 6, 14), dark, s * 0.04, 0.115, 0.1, head);   // glasses
    add(new THREE.SphereGeometry(0.009, 6, 6), dark, s * 0.04, 0.115, 0.1, head);          // eyes
    add(new THREE.SphereGeometry(0.02, 8, 6), skin, s * 0.11, 0.1, 0, head);              // ears
  }
  add(new THREE.BoxGeometry(0.03, 0.004, 0.01), dark, 0, 0.115, 0.105, head);             // bridge
  const grin = add(new THREE.TorusGeometry(0.035, 0.007, 6, 12, Math.PI), dark, 0.008, 0.055, 0.1, head);
  grin.rotation.z = Math.PI + 0.15;
  add(new THREE.SphereGeometry(0.014, 8, 6), skin, 0, 0.09, 0.11, head);                  // nose
  // messy hair tufts
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const tuft = add(new THREE.ConeGeometry(0.03, 0.06, 5), hair, Math.cos(a) * 0.07, 0.19 + Math.sin(i * 1.7) * 0.01, Math.sin(a) * 0.06 - 0.01, head);
    tuft.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
  }
  g.userData.head = head;
  g.scale.setScalar(1.35);
  return g;
}
