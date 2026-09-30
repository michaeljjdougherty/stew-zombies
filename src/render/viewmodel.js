// =============================================================================
// First-person viewmodel: hands, the M1912, the knife, and all their motion
// (sway, bob, recoil, reloads, sprint pose, ADS, knife slash, draw).
// Rendered in its own scene/camera so it never clips into walls.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';

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

    this.mats = {
      metal: new THREE.MeshStandardMaterial({ map: T.gunMetalTexture('#2c2d2e'), roughness: 0.45, metalness: 0.75 }),
      darkMetal: new THREE.MeshStandardMaterial({ map: T.gunMetalTexture('#1d1e1f'), roughness: 0.5, metalness: 0.7 }),
      wood: new THREE.MeshStandardMaterial({ map: T.woodTexture({ base: [22, 40, 26], plank: 32 }), roughness: 0.6 }),
      glove: new THREE.MeshStandardMaterial({ map: T.gloveTexture(), roughness: 0.9 }),
      sleeve: new THREE.MeshStandardMaterial({ map: T.sleeveTexture(), roughness: 0.95 }),
      skin: new THREE.MeshStandardMaterial({ color: '#8c7560', roughness: 0.8 }),
      blade: new THREE.MeshStandardMaterial({ color: '#9a9c9a', roughness: 0.25, metalness: 0.9 }),
    };

    this.buildPistol();
    this.buildKnifeArm();

    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.muzzleFlashTexture(), color: new THREE.Color(2.2, 1.7, 1.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.scale.setScalar(0.12);
    this.flash.visible = false;
    this.muzzle.add(this.flash);
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
  }

  buildPistol() {
    const m = this.mats;
    const gun = new THREE.Group();
    this.gun = gun;
    this.root.add(gun);
    const box = (w, h, d, mat, x, y, z, parent = gun) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(x, y, z);
      parent.add(b);
      return b;
    };
    // slide (moves back when firing)
    this.slide = new THREE.Group();
    gun.add(this.slide);
    box(0.03, 0.03, 0.2, m.metal, 0, 0.0, 0, this.slide);
    // serrations
    for (let i = 0; i < 6; i++) box(0.031, 0.022, 0.003, m.darkMetal, 0, 0.001, 0.06 + i * 0.007, this.slide);
    box(0.006, 0.008, 0.008, m.darkMetal, 0, 0.019, -0.092, this.slide);  // front sight
    box(0.008, 0.008, 0.008, m.darkMetal, -0.009, 0.019, 0.09, this.slide); // rear sight L
    box(0.008, 0.008, 0.008, m.darkMetal, 0.009, 0.019, 0.09, this.slide);  // rear sight R
    // barrel bushing
    const bush = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.01, 10).rotateX(Math.PI / 2), m.darkMetal);
    bush.position.set(0, -0.002, -0.102);
    gun.add(bush);
    // frame
    box(0.028, 0.02, 0.16, m.metal, 0, -0.024, -0.015);
    box(0.012, 0.006, 0.02, m.darkMetal, 0, -0.012, 0.105); // hammer
    // trigger guard
    box(0.004, 0.004, 0.05, m.metal, 0, -0.058, 0.0);
    box(0.004, 0.026, 0.004, m.metal, 0, -0.045, -0.024);
    box(0.004, 0.02, 0.004, m.darkMetal, 0, -0.043, 0.004); // trigger
    // grip
    const grip = new THREE.Group();
    grip.position.set(0, -0.035, 0.065);
    grip.rotation.x = -0.22;
    gun.add(grip);
    box(0.027, 0.11, 0.045, m.metal, 0, -0.055, 0, grip);
    box(0.031, 0.085, 0.036, m.wood, 0, -0.055, 0.002, grip);
    // magazine (drops during reload)
    this.mag = new THREE.Group();
    this.mag.position.set(0, 0, 0);
    grip.add(this.mag);
    box(0.02, 0.11, 0.033, m.darkMetal, 0, -0.06, 0.002, this.mag);
    box(0.024, 0.008, 0.038, m.darkMetal, 0, -0.114, 0.002, this.mag);
    this.magHome = this.mag.position.clone();
    this.grip = grip;

    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.0, -0.12);
    gun.add(this.muzzle);

    // right hand wrapped around the grip
    const rh = new THREE.Group();
    rh.position.set(0.004, -0.07, 0.07);
    rh.rotation.x = -0.22;
    gun.add(rh);
    box(0.045, 0.07, 0.06, m.glove, 0.008, 0, 0.01, rh);
    for (let i = 0; i < 3; i++) box(0.05, 0.018, 0.022, m.glove, -0.002, 0.012 - i * 0.022, -0.03, rh); // fingers
    box(0.018, 0.018, 0.05, m.glove, -0.02, 0.03, -0.01, rh); // thumb
    const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.42, 10), m.sleeve);
    rArm.position.set(0.03, -0.07, 0.2);
    rArm.rotation.set(1.25, 0, -0.25);
    rh.add(rArm);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10), m.skin);
    cuff.position.set(0.012, -0.024, 0.045); cuff.rotation.set(1.25, 0, -0.25);
    rh.add(cuff);

    // left support hand (moves during reload)
    this.leftHand = new THREE.Group();
    this.leftHome = new THREE.Vector3(-0.022, -0.085, 0.06);
    this.leftHand.position.copy(this.leftHome);
    this.leftHand.rotation.set(-0.2, 0.3, 0.5);
    gun.add(this.leftHand);
    box(0.045, 0.06, 0.06, m.glove, 0, 0, 0, this.leftHand);
    for (let i = 0; i < 3; i++) box(0.022, 0.018, 0.05, m.glove, 0.03, 0.01 - i * 0.021, -0.005, this.leftHand);
    const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.42, 10), m.sleeve);
    lArm.position.set(-0.07, -0.1, 0.17);
    lArm.rotation.set(1.1, 0, 0.6);
    this.leftHand.add(lArm);
  }

  buildKnifeArm() {
    const m = this.mats;
    this.knifeArm = new THREE.Group();
    this.knifeArm.visible = false;
    this.root.add(this.knifeArm);
    const hand = new THREE.Group();
    this.knifeArm.add(hand);
    const b = (w, h, d, mat, x, y, z, parent = hand) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); q.position.set(x, y, z); parent.add(q); return q; };
    b(0.05, 0.06, 0.07, m.glove, 0, 0, 0);
    b(0.012, 0.03, 0.1, m.darkMetal, 0, 0.0, -0.08); // handle
    b(0.04, 0.008, 0.01, m.darkMetal, 0, 0.0, -0.13); // guard
    const blade = b(0.004, 0.028, 0.17, m.blade, 0, 0.004, -0.22);
    blade.scale.set(1, 1, 1);
    b(0.004, 0.014, 0.03, m.blade, 0, 0.012, -0.315); // tip
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.45, 10), m.sleeve);
    arm.position.set(0.02, -0.05, 0.24); arm.rotation.set(1.3, 0, 0);
    hand.add(arm);
    this.knifeHand = hand;
  }

  setAspect(a) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }

  onEvent(e, localId) {
    if (e.playerId !== localId) return;
    switch (e.type) {
      case 'shot':
        this.kickZ.v += 1.9;
        this.kickRot.v += 5.5;
        this.kickSide.v += (Math.random() - 0.5) * 1.2;
        this.slideBack = 1;
        this.slideLocked = e.clip === 0;
        this.flash.visible = true;
        this.flash.material.rotation = Math.random() * Math.PI * 2;
        this.flash.scale.setScalar(0.09 + Math.random() * 0.06);
        this.flashT = 0.045;
        this.flashLight.intensity = 3;
        break;
      case 'reloadStart':
        this.reload = { t: 0, total: e.time, empty: e.empty };
        break;
      case 'reloadCancel':
        this.reload = null;
        if (!e.kept) this.mag.position.copy(this.magHome);
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
        this.drawT = 0;
        break;
    }
  }

  // p = local sim player, look = {dx, dy} mouse movement this frame, bob = camera bob info
  update(dt, p, def, look, bob) {
    this.time += dt;
    const w = p.loadout;
    const ads = w.adsAmount;

    // sprint pose blend
    this.sprintBlend = lerp(this.sprintBlend, p.sprinting ? 1 : 0, 1 - Math.exp(-dt * 10));
    const sb = ease(this.sprintBlend);

    // springs
    const kz = this.kickZ.update(dt);
    const kr = this.kickRot.update(dt);
    const ks = this.kickSide.update(dt);
    const swayAmt = lerp(1, 0.25, ads);
    const sx = this.swayX.update(dt, Math.max(-0.05, Math.min(0.05, -look.dx * 0.00045)) * swayAmt);
    const sy = this.swayY.update(dt, Math.max(-0.05, Math.min(0.05, look.dy * 0.00045)) * swayAmt);
    const ly = this.landY.update(dt);

    // base pose: hip -> ads
    const hip = { x: 0.14, y: -0.135, z: -0.3, ry: 0.06, rz: 0.0 };
    const aim = { x: 0.0, y: -0.0205, z: -0.2, ry: 0.0, rz: 0.0 };
    let px = lerp(hip.x, aim.x, ads), py = lerp(hip.y, aim.y, ads), pz = lerp(hip.z, aim.z, ads);
    let rx = 0, ry = lerp(hip.ry, aim.ry, ads), rz = 0;

    // bob (figure-eight) from camera rig
    const bobScale = lerp(1, 0.12, ads);
    px += Math.cos(bob.phase) * bob.amp * 0.35 * bobScale;
    py += -Math.abs(Math.sin(bob.phase)) * bob.amp * 0.3 * bobScale;
    rz += Math.cos(bob.phase) * bob.amp * 0.6 * bobScale;

    // idle breathing
    const breath = Math.sin(this.time * 1.6) * 0.0018 * (1 - ads * 0.7);
    py += breath;

    // sprint: pistol tipped up and in
    px += sb * 0.0; py += sb * -0.05; pz += sb * 0.04;
    rx += sb * 0.55; ry += sb * 0.45; rz += sb * 0.35;
    if (p.sprinting) {
      px += Math.cos(bob.phase) * 0.02 * sb;
      py += Math.abs(Math.sin(bob.phase)) * 0.018 * sb;
    }

    // air
    if (!p.grounded) py += 0.01;

    // recoil
    pz += kz * 0.02;
    rx += kr * 0.045;
    ry += ks * 0.02;
    py += kr * 0.003;

    // sway + landing
    px += sx; py += sy + ly * 0.03;
    ry += sx * 1.2; rx += sy * 1.0;

    // draw from below
    if (this.drawT < 1) {
      this.drawT = Math.min(1, this.drawT + dt / Math.max(0.05, def.drawTime));
      const d = 1 - ease(this.drawT);
      py -= d * 0.25; rx -= d * 0.9;
    }

    // reload choreography
    let magY = 0, magVisible = true, leftOff = new THREE.Vector3();
    if (this.reload) {
      this.reload.t += dt;
      const r = clamp01(this.reload.t / this.reload.total);
      const tilt = seg(r, 0.0, 0.14) * (1 - seg(r, 0.86, 1.0));
      rz += tilt * 0.55; rx += tilt * 0.18; px -= tilt * 0.03; py += tilt * 0.02;
      // mag out
      const out = seg(r, 0.12, 0.26);
      magY = -out * 0.22;
      if (r > 0.26 && r < 0.36) magVisible = false;
      // new mag comes up with the left hand
      if (r >= 0.36) {
        const inn = seg(r, 0.36, 0.7);
        magY = -(1 - inn) * 0.2;
      }
      // left hand goes down to fetch mag, then returns
      const lh = seg(r, 0.16, 0.3) * (1 - seg(r, 0.4, 0.7));
      leftOff.set(-0.02 * lh, -0.18 * lh, 0.03 * lh);
      // mag seat smack
      if (r > 0.7 && r < 0.76) { py += 0.006; }
      // slide release on empty reloads
      if (this.reload.empty) {
        const sr = seg(r, 0.76, 0.8);
        if (r > 0.76) this.slideLocked = false;
        rz -= sr * (1 - seg(r, 0.8, 0.9)) * 0.1;
      }
    }
    this.mag.position.set(this.magHome.x, this.magHome.y + magY, this.magHome.z);
    this.mag.visible = magVisible;
    this.leftHand.position.copy(this.leftHome).add(leftOff);

    // slide
    this.slideBack = Math.max(0, this.slideBack - dt / 0.06);
    const slideZ = this.slideLocked ? 0.03 : Math.sin(this.slideBack * Math.PI * 0.5) * 0.03;
    this.slide.position.z = slideZ;

    // knife
    let gunDip = 0;
    if (this.meleeT >= 0) {
      this.meleeT += dt;
      const dur = this.cfg.melee.duration;
      const t = this.meleeT / dur;
      if (t >= 1) { this.meleeT = -1; this.knifeArm.visible = false; }
      else {
        this.knifeArm.visible = true;
        const inT = seg(t, 0, 0.15), slash = seg(t, 0.12, 0.38), outT = seg(t, 0.55, 1);
        gunDip = Math.min(inT * 2, 1) * (1 - outT);
        const kx = lerp(0.35, 0.18, inT) + lerp(0, -0.36, slash) + outT * 0.2;
        const ky = lerp(-0.25, -0.05, inT) - slash * 0.02 - outT * 0.25;
        const kzz = lerp(-0.3, -0.36, inT) - (this.meleeLunge ? slash * 0.05 : 0);
        this.knifeArm.position.set(kx, ky, kzz);
        this.knifeArm.rotation.set(-0.1 - slash * 0.2, lerp(-0.2, 1.3, slash), lerp(1.2, 1.5, slash));
      }
    }
    py -= gunDip * 0.2; rx -= gunDip * 0.6; px += gunDip * 0.05;

    this.gun.position.set(px, py, pz);
    this.gun.rotation.set(rx, ry, rz);

    // muzzle flash
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) { this.flash.visible = false; this.flashLight.intensity = 0; }
    }

    // lighting follows the environment a little
    this.hemi.intensity = 0.35 + this.envLevel * 0.9;
    this.key.intensity = 0.3 + this.envLevel * 1.1;
  }

  muzzleWorldPosition(camera, out) {
    // approximate muzzle point in world space (for tracers/lights)
    this.muzzle.updateWorldMatrix(true, false);
    const local = new THREE.Vector3().setFromMatrixPosition(this.muzzle.matrixWorld);
    // viewmodel camera sits at origin, so local ≈ offset from eye
    local.applyQuaternion(camera.quaternion);
    return out.copy(camera.position).add(local);
  }
}
