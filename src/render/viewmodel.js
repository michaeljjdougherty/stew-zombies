// =============================================================================
// First-person viewmodel: hands, the current gun, the knife, and all their
// motion (sway, bob, recoil, reloads, sprint pose, ADS, knife slash, draw).
// Rendered in its own scene/camera so it never clips into walls.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildGun, gunMaterials } from './gunModels.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const ease = (t) => t * t * (3 - 2 * t);
const seg = (p, a, b) => ease(clamp01((p - a) / (b - a)));

class Spring {
  constructor(k = 180, d = 18) { this.k = k; this.d = d; this.x = 0; this.v = 0; }
  update(dt, target = 0) { this.v += ((target - this.x) * this.k - this.v * this.d) * dt; this.x += this.v * dt; return this.x; }
}

export class Viewmodel {
  constructor(cfg) {
    this.cfg = cfg;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(cfg.graphics.viewmodelFov, 1, 0.01, 10);
    this.scene.add(this.camera);

    this.hemi = new THREE.HemisphereLight(0xcfc6b0, 0x302418, 1.0);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffe2b8, 1.4);
    this.key.position.set(0.4, 1, 0.3);
    this.scene.add(this.key);
    this.flashLight = new THREE.PointLight(0xffa050, 0, 1.5, 2);
    this.camera.add(this.flashLight);

    this.root = new THREE.Group();   // everything that moves with sway/bob
    this.camera.add(this.root);

    this.mats = { ...gunMaterials(), blade: new THREE.MeshStandardMaterial({ color: '#9a9c9a', roughness: 0.25, metalness: 0.9 }) };
    this.models = new Map();          // weapon id -> built model
    this.current = null;
    this.currentId = null;

    this.buildKnifeArm();

    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.muzzleFlashTexture(), color: new THREE.Color(2.2, 1.7, 1.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.visible = false;
    this.flashT = 0;

    // animation state
    this.kickZ = new Spring(260, 20);
    this.kickRot = new Spring(240, 17);
    this.kickSide = new Spring(200, 16);
    this.swayX = new Spring(90, 12);
    this.swayY = new Spring(90, 12);
    this.landY = new Spring(160, 12);
    this.sprintBlend = 0;
    this.slideBack = 0;
    this.slideLocked = false;
    this.meleeT = -1;
    this.meleeLunge = false;
    this.drawT = 1;
    this.reload = null;
    this.time = 0;
    this.envLevel = 1;
    this.cylSpin = 0;
  }

  // Show the model for a weapon id (built on first use).
  setWeapon(id) {
    if (id === this.currentId) return;
    const def = this.cfg.weapons[id];
    let m = this.models.get(id);
    if (!m) {
      m = buildGun(def.view.model, { withHands: true });
      m.id = id;
      this.models.set(id, m);
      this.root.add(m.group);
    }
    if (this.current) this.current.group.visible = false;
    m.group.visible = true;
    this.current = m;
    this.currentId = id;
    m.muzzle.add(this.flash);
    this.reload = null;
    this.slideLocked = false;
    this.drawT = 0;
  }

  buildKnifeArm() {
    const m = this.mats;
    this.knifeArm = new THREE.Group();
    this.knifeArm.visible = false;
    this.root.add(this.knifeArm);
    const hand = new THREE.Group();
    this.knifeArm.add(hand);
    const b = (w, h, d, mat, x, y, z, parent = hand) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); q.position.set(x, y, z); parent.add(q); return q; };
    b(0.05, 0.05, 0.075, m.glove, 0, 0, 0.0);
    for (let i = 0; i < 4; i++) b(0.012, 0.016, 0.02, m.glove, 0.022, 0.018 - i * 0.012, -0.028);
    b(0.02, 0.026, 0.1, m.darkMetal, 0, 0.0, -0.075);
    b(0.05, 0.034, 0.008, m.darkMetal, 0, 0.004, -0.128);
    b(0.005, 0.03, 0.17, m.blade, 0, 0.004, -0.215);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.021, 0.05, 3), m.blade);
    tip.rotation.x = -Math.PI / 2; tip.scale.set(0.2, 1, 1); tip.position.set(0, 0.006, -0.325);
    hand.add(tip);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 0.4, 10), m.sleeve);
    arm.position.set(0.02, -0.09, 0.2); arm.rotation.set(Math.PI / 2 - 0.45, 0, 0);
    hand.add(arm);
  }

  // Soft studio-style reflections so the gun metal isn't pitch black.
  initEnvironment(renderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.envMats = Object.values(this.mats);
  }

  setAspect(a) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }

  onEvent(e, localId) {
    if (e.playerId !== localId) return;
    const def = this.currentId ? this.cfg.weapons[this.currentId] : null;
    switch (e.type) {
      case 'shot': {
        const k = (def && def.recoil.viewKick) || 1;
        this.kickZ.v += 1.9 * k;
        this.kickRot.v += 5.5 * Math.sqrt(k);
        this.kickSide.v += (Math.random() - 0.5) * 1.2 * k;
        this.slideBack = 1;
        this.slideLocked = e.clip === 0 && this.current && !!this.current.parts.slide;
        this.cylSpin += Math.PI / 3;
        const fs = (def && def.view.flash) || 1;
        this.flash.visible = true;
        this.flash.material.rotation = Math.random() * Math.PI * 2;
        this.flash.scale.setScalar((0.09 + Math.random() * 0.06) * fs);
        this.flashT = 0.045;
        this.flashLight.intensity = 3 * fs;
        break;
      }
      case 'reloadStart':
        this.reload = { t: 0, total: e.time, empty: e.empty, style: def ? def.reloadStyle : 'mag' };
        break;
      case 'reloadCancel':
        this.reload = null;
        break;
      case 'reloadDone':
        this.reload = null;
        this.slideLocked = false;
        break;
      case 'melee':
        this.meleeT = 0;
        this.meleeLunge = e.lunge;
        break;
      case 'playerLand':
        this.landY.v -= Math.min(1.2, e.impact * 0.12);
        break;
      case 'weaponSwitch':
      case 'weaponGiven':
        this.setWeapon(e.weapon);
        break;
    }
  }

  // p = local sim player, look = {dx, dy} mouse movement this frame, bob = camera bob info
  update(dt, p, def, look, bob) {
    this.time += dt;
    const w = p.loadout;
    const id = w.slots[w.current].id;
    if (id !== this.currentId) this.setWeapon(id);
    const M = this.current;
    const ads = w.adsAmount;

    this.sprintBlend = lerp(this.sprintBlend, p.sprinting ? 1 : 0, 1 - Math.exp(-dt * 10));
    const sb = ease(this.sprintBlend);

    const kz = this.kickZ.update(dt);
    const kr = this.kickRot.update(dt);
    const ks = this.kickSide.update(dt);
    const swayAmt = lerp(1, 0.25, ads);
    const sx = this.swayX.update(dt, Math.max(-0.05, Math.min(0.05, -look.dx * 0.00045)) * swayAmt);
    const sy = this.swayY.update(dt, Math.max(-0.05, Math.min(0.05, look.dy * 0.00045)) * swayAmt);
    const ly = this.landY.update(dt);

    // base pose: hip -> ads
    const hip = M.hip, aim = M.aim;
    let px = lerp(hip.x, 0, ads), py = lerp(hip.y, aim.y, ads), pz = lerp(hip.z, aim.z, ads);
    let rx = lerp(hip.rx || 0, 0, ads), ry = lerp(hip.ry, 0, ads), rz = lerp(hip.rz, 0, ads);

    const bobScale = lerp(1, 0.12, ads);
    px += Math.cos(bob.phase) * bob.amp * 0.35 * bobScale;
    py += -Math.abs(Math.sin(bob.phase)) * bob.amp * 0.3 * bobScale;
    rz += Math.cos(bob.phase) * bob.amp * 0.6 * bobScale;
    py += Math.sin(this.time * 1.6) * 0.0018 * (1 - ads * 0.7);

    // sprint pose: pistols tip up and in, long guns swing across the body
    const small = def.class === 'pistol';
    if (small) { py -= sb * 0.05; pz += sb * 0.04; rx += sb * 0.55; ry += sb * 0.45; rz += sb * 0.35; }
    else { px -= sb * 0.03; py -= sb * 0.05; pz += sb * 0.03; rx -= sb * 0.25; ry += sb * 0.75; rz += sb * 0.3; }
    if (p.sprinting) {
      px += Math.cos(bob.phase) * 0.02 * sb;
      py += Math.abs(Math.sin(bob.phase)) * 0.018 * sb;
    }
    if (!p.grounded) py += 0.01;

    // recoil
    pz += kz * 0.02;
    rx += kr * 0.045;
    ry += ks * 0.02;
    py += kr * 0.003;

    px += sx; py += sy + ly * 0.03;
    ry += sx * 1.2; rx += sy * 1.0;

    // draw from below
    if (this.drawT < 1) {
      this.drawT = Math.min(1, this.drawT + dt / Math.max(0.05, def.drawTime));
      const d = 1 - ease(this.drawT);
      py -= d * 0.25; rx -= d * 0.9;
    }

    // reset animated parts
    const parts = M.parts;
    for (const k of Object.keys(parts)) { parts[k].position.copy(parts[k].userData.home); parts[k].rotation.set(0, 0, 0); parts[k].visible = true; }
    const leftOff = new THREE.Vector3();

    if (this.reload) {
      this.reload.t += dt;
      const r = clamp01(this.reload.t / this.reload.total);
      const style = this.reload.style;
      if (style === 'break') {
        // tip the muzzle down, crack the barrels open, drop two shells in, snap shut
        const tilt = seg(r, 0.0, 0.14) * (1 - seg(r, 0.84, 1.0));
        rx -= tilt * 0.35; rz += tilt * 0.25; py += tilt * 0.03;
        const open = seg(r, 0.08, 0.2) * (1 - seg(r, 0.72, 0.8));
        if (parts.barrels) parts.barrels.rotation.x = -open * 0.6;
        const lh = seg(r, 0.22, 0.34) * (1 - seg(r, 0.66, 0.78));
        leftOff.set(0.02 * lh, 0.03 * lh + Math.sin(r * 40) * 0.004 * lh, 0.2 * lh);
        if (r > 0.74 && r < 0.8) rx += 0.05;
      } else if (style === 'cylinder') {
        const tilt = seg(r, 0.0, 0.14) * (1 - seg(r, 0.84, 1.0));
        rz += tilt * 0.7; px -= tilt * 0.04; py += tilt * 0.03;
        const out = seg(r, 0.1, 0.2) * (1 - seg(r, 0.74, 0.82));
        if (parts.cylinder) { parts.cylinder.position.x -= out * 0.03; parts.cylinder.rotation.z = out * 0.4; }
        const eject = seg(r, 0.22, 0.3) * (1 - seg(r, 0.34, 0.42));
        rx += eject * 0.5;
        const lh = seg(r, 0.38, 0.5) * (1 - seg(r, 0.7, 0.8));
        leftOff.set(0.02 * lh, 0.02 * lh, 0.02 * lh);
      } else {
        // magazine
        const tilt = seg(r, 0.0, 0.14) * (1 - seg(r, 0.86, 1.0));
        rz += tilt * (small ? 0.55 : 0.4); rx += tilt * 0.18; px -= tilt * 0.03; py += tilt * 0.02;
        let magY = -seg(r, 0.12, 0.26) * 0.22;
        if (parts.mag && r > 0.26 && r < 0.36) parts.mag.visible = false;
        if (r >= 0.36) magY = -(1 - seg(r, 0.36, 0.7)) * 0.2;
        if (parts.mag) parts.mag.position.y += magY;
        const lh = seg(r, 0.16, 0.3) * (1 - seg(r, 0.4, 0.7));
        const toMag = parts.mag ? parts.mag.userData.home.z - (M.leftHome ? M.leftHome.z : 0) : 0;
        leftOff.set(-0.02 * lh, -0.18 * lh, (small ? 0.03 : toMag) * lh);
        if (r > 0.7 && r < 0.76) py += 0.006;
        // charge the bolt / release the slide on empty reloads
        if (this.reload.empty) {
          if (r > 0.76) this.slideLocked = false;
          const pull = seg(r, 0.76, 0.82) * (1 - seg(r, 0.84, 0.88));
          if (parts.bolt) parts.bolt.position.z += pull * (M.boltTravel || 0.03);
          rz -= pull * 0.1;
        }
      }
    }
    if (M.leftHand) M.leftHand.position.copy(M.leftHome).add(leftOff);

    // slide / bolt cycling
    this.slideBack = Math.max(0, this.slideBack - dt / 0.06);
    const cyc = Math.sin(this.slideBack * Math.PI * 0.5);
    if (parts.slide) parts.slide.position.z += this.slideLocked ? M.slideTravel : cyc * (M.slideTravel || 0.03);
    if (parts.bolt) parts.bolt.position.z += cyc * (M.boltTravel || 0.03);
    if (parts.cylinder && !this.reload) parts.cylinder.rotation.z = this.cylSpin;

    // knife
    let gunDip = 0;
    if (this.meleeT >= 0) {
      this.meleeT += dt;
      const t = this.meleeT / this.cfg.melee.duration;
      if (t >= 1) { this.meleeT = -1; this.knifeArm.visible = false; }
      else {
        this.knifeArm.visible = true;
        const inT = seg(t, 0, 0.15), slash = seg(t, 0.12, 0.38), outT = seg(t, 0.55, 1);
        gunDip = Math.min(inT * 2, 1) * (1 - outT);
        const kx = lerp(0.42, 0.26, inT) + lerp(0, -0.4, slash) + outT * 0.35;
        const ky = lerp(-0.32, -0.12, inT) + slash * 0.02 - outT * 0.3;
        const kzz = -0.46 - (this.meleeLunge ? slash * 0.06 : 0);
        this.knifeArm.position.set(kx, ky, kzz);
        this.knifeArm.rotation.set(-0.15 + slash * 0.1, lerp(0.25, 1.25, slash) + inT * 0.2, lerp(-0.6, -0.2, slash));
      }
    }
    py -= gunDip * 0.2; rx -= gunDip * 0.6; px += gunDip * 0.05;

    M.group.position.set(px, py, pz);
    M.group.rotation.set(rx, ry, rz);

    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) { this.flash.visible = false; this.flashLight.intensity = 0; }
    }

    this.hemi.intensity = 0.5 + this.envLevel * 1.0;
    this.key.intensity = 0.4 + this.envLevel * 1.4;
    if (this.envMats) for (const m of this.envMats) m.envMapIntensity = 0.12 + this.envLevel * 0.35;
  }

  muzzleWorldPosition(camera, out) {
    if (!this.current) return out.copy(camera.position);
    this.current.muzzle.updateWorldMatrix(true, false);
    const local = new THREE.Vector3().setFromMatrixPosition(this.current.muzzle.matrixWorld);
    local.applyQuaternion(camera.quaternion);
    return out.copy(camera.position).add(local);
  }
}
