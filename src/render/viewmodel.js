// =============================================================================
// First-person viewmodel: hands, the current gun(s), the knife, grenades, and
// all their motion (sway, bob, recoil, every reload style, pump & bolt
// actions, sprint pose, ADS, dual wield, knife slash, grenade cook & throw,
// draw). Rendered in its own scene/camera so it never clips into walls.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { realGunMaterials, setFpClip, buildGun, gunMaterials, animateCamo, setArmLook } from './gunModels.js';
import { CHARACTERS } from './characters.js';
import { SKIN } from './human.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const ease = (t) => t * t * (3 - 2 * t);
const seg = (p, a, b) => ease(clamp01((p - a) / (b - a)));
const bump = (p, a, b) => Math.sin(clamp01((p - a) / (b - a)) * Math.PI);

class Spring {
  constructor(k = 180, d = 18) { this.k = k; this.d = d; this.x = 0; this.v = 0; }
  // sub-stepped (semi-implicit Euler) so a long frame can't make it blow up
  update(dt, target = 0) {
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) { this.v += ((target - this.x) * this.k - this.v * this.d) * h; this.x += this.v * h; }
    if (!Number.isFinite(this.x)) { this.x = 0; this.v = 0; }
    return this.x;
  }
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
    this.models = new Map();          // weapon id -> { R, L? }
    this.current = null;              // { R, L? }
    this.currentId = null;

    this.buildKnifeArm();
    this.buildGrenadeArm();
    this.buildDrinkArm();

    const flashMat = () => new THREE.SpriteMaterial({ map: T.muzzleFlashTexture(), color: new THREE.Color(2.2, 1.7, 1.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.flash = { R: new THREE.Sprite(flashMat()), L: new THREE.Sprite(flashMat()) };
    this.flash.R.visible = this.flash.L.visible = false;
    this.flashT = { R: 0, L: 0 };

    this.kickZ = new Spring(260, 20);
    this.kickRot = new Spring(240, 17);
    this.kickSide = new Spring(200, 16);
    this.kickL = new Spring(240, 17);
    this.swayX = new Spring(90, 12);
    this.swayY = new Spring(90, 12);
    this.landY = new Spring(160, 12);
    this.sprintBlend = 0;
    this.slideBack = { R: 0, L: 0 };
    this.slideLocked = false;
    this.actionT = -1;     // pump / bolt cycle after a shot
    this.shellPulse = -1;  // time since the last shell went in
    this.meleeT = -1;
    this.meleeLunge = false;
    this.throwT = -1;
    this.drinkT = -1;
    this.drawT = 1;
    this.reload = null;
    this.time = 0;
    this.envLevel = 1;
    this.cylSpin = 0;
    this.scoped = false;
  }

  // Show the model(s) for a weapon id (built on first use).
  setWeapon(id) {
    if (id === this.currentId) return;
    const def = this.cfg.weapons[id];
    let pair = this.models.get(id);
    if (!pair) {
      const camo = def.view.camo || null;
      const R = buildGun(def.view.model, { withHands: true, rightOnly: !!def.dual, camo });
      this.root.add(R.group);
      pair = { R };
      if (def.dual) {
        const L = buildGun(def.view.model, { withHands: true, rightOnly: true, camo });
        L.group.scale.x = -1;           // mirrored copy for the left hand
        this.root.add(L.group);
        pair.L = L;
      }
      this.models.set(id, pair);
    }
    if (this.current) { this.current.R.group.visible = false; if (this.current.L) this.current.L.group.visible = false; }
    pair.R.group.visible = true;
    if (pair.L) pair.L.group.visible = true;
    pair.R.muzzle.add(this.flash.R);
    if (pair.L) pair.L.muzzle.add(this.flash.L);
    this.current = pair;
    this.currentId = id;
    this.reload = null;
    this.slideLocked = false;
    this.actionT = -1;
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

  // Left arm holding a frag grenade.
  buildGrenadeArm() {
    const m = this.mats;
    this.grenadeArm = new THREE.Group();
    this.grenadeArm.visible = false;
    this.root.add(this.grenadeArm);
    const b = (w, h, d, mat, x, y, z) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); q.position.set(x, y, z); this.grenadeArm.add(q); return q; };
    b(0.05, 0.055, 0.07, m.glove, 0, -0.03, 0.01);
    const frag = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), new THREE.MeshStandardMaterial({ color: '#3a4430', roughness: 0.7 }));
    frag.scale.set(1, 1.2, 1); frag.position.set(0, 0.025, -0.015);
    this.grenadeArm.add(frag);
    this.fragMesh = frag;
    const fuse = b(0.012, 0.02, 0.012, m.metal, 0, 0.07, -0.015);            // fuse head
    const spoon = b(0.008, 0.06, 0.016, m.metal, 0.02, 0.03, -0.015); spoon.rotation.z = -0.25; // spoon
    this.fragParts = [frag, fuse, spoon];
    // a Stew Bomb: little steel pot, lid, ladle sticking out
    const pot = new THREE.Group(); pot.position.set(0, 0.03, -0.02); this.grenadeArm.add(pot);
    const steel = new THREE.MeshStandardMaterial({ color: '#9a9890', metalness: 0.85, roughness: 0.3 });
    pot.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.06, 16), steel));
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.008, 16), steel); lid.position.y = 0.034; pot.add(lid);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), m.metal); knob.position.y = 0.043; pot.add(knob);
    for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.01), m.metal); h.position.set(sx * 0.055, 0.015, 0); pot.add(h); }
    const ladle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 6), steel); ladle.position.set(0.02, 0.07, 0); ladle.rotation.z = -0.4; pot.add(ladle);
    const fuseLight = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.2) })); fuseLight.position.set(0, 0.0, 0.046); pot.add(fuseLight);
    pot.visible = false;
    this.potMesh = pot;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.42, 10), m.sleeve);
    arm.position.set(-0.07, -0.14, 0.16); arm.rotation.set(1.0, 0, 0.5);
    this.grenadeArm.add(arm);
  }

  // What's in the throwing hand: a frag or a Stew Bomb.
  showHeld(on) {
    const stew = this.heldKind === 'stew';
    for (const q of this.fragParts) q.visible = on && !stew;
    this.potMesh.visible = on && stew;
  }

  // Left hand holding a perk bottle.
  buildDrinkArm() {
    const m = this.mats;
    this.drinkArm = new THREE.Group();
    this.drinkArm.visible = false;
    this.root.add(this.drinkArm);
    const b = (w, h, d, mat, x, y, z) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); q.position.set(x, y, z); this.drinkArm.add(q); return q; };
    b(0.05, 0.06, 0.07, m.glove, 0, -0.04, 0.01);
    this.bottleMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85, emissive: new THREE.Color('#c0392b'), emissiveIntensity: 0.25 });
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.13, 12), this.bottleMat);
    bottle.position.set(0, 0.03, -0.01); this.drinkArm.add(bottle);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.028, 0.07, 10), this.bottleMat);
    neck.position.set(0, 0.125, -0.01); this.drinkArm.add(neck);
    this.bottleLabelMat = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.8 });
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0335, 0.0335, 0.05, 12, 1, true), this.bottleLabelMat);
    label.position.set(0, 0.03, -0.01); this.drinkArm.add(label);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 8), m.metal);
    cap.position.set(0, 0.165, -0.01); this.drinkArm.add(cap);
    this.bottleCap = cap;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.42, 10), m.sleeve);
    arm.position.set(-0.07, -0.15, 0.16); arm.rotation.set(1.0, 0, 0.5);
    this.drinkArm.add(arm);
  }

  setBottle(color) {
    this.bottleMat.color.set(color);
    this.bottleMat.emissive.set(color);
  }

  initEnvironment(renderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.envMats = Object.values(this.mats);
  }

  setAspect(a) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }

  // Your arms are your character's arms: their skin, their sleeves.
  setCharacter(id) {
    const def = CHARACTERS[id] || CHARACTERS.kearns;
    const sk = (SKIN[def.skin] || SKIN.light).base;
    // the game's lighting is warmer than the showcase: deepen the tone a touch
    const skin = sk.map((v) => Math.round(v * 0.8));
    let sleeve = null;
    if (def.layer && !def.layer.short) sleeve = { color: def.layer.color, kind: def.layer.type };
    else if (def.top && def.top.type === 'suit') sleeve = { color: def.top.color, kind: 'suit' };
    setArmLook({ skin, sleeve });
  }

  onEvent(e, localId) {
    if (e.playerId !== localId) return;
    const def = this.currentId ? this.cfg.weapons[this.currentId] : null;
    switch (e.type) {
      case 'shot': {
        const side = e.side === 'L' ? 'L' : 'R';
        const k = ((def && def.recoil.viewKick) || 1) * ((this.cfg.recoil && this.cfg.recoil.gunKick) ?? 1);
        if (side === 'L') this.kickL.v += 5.5 * Math.sqrt(k);
        else { this.kickZ.v += 1.9 * k; this.kickRot.v += 5.5 * Math.sqrt(k); }
        this.kickSide.v += (Math.random() - 0.5) * 1.2 * k;
        this.slideBack[side] = 1;
        this.slideLocked = e.clip === 0 && this.current && !!this.current.R.parts.slide && !(def && def.dual);
        this.cylSpin += Math.PI / 3;
        if (e.action) this.actionT = 0;
        const fs = (def && def.view.flash) || 1;
        if (fs > 0) {
          const f = this.flash[side];
          f.visible = true;
          if (def && (def.view.camo || def.view.flashColor)) f.material.color.set(def.view.camo || def.view.flashColor).multiplyScalar(2.6).lerp(new THREE.Color(2.4, 2.2, 2), 0.35);
          else f.material.color.setRGB(2.2, 1.7, 1.2);
          f.material.rotation = Math.random() * Math.PI * 2;
          f.scale.setScalar((0.09 + Math.random() * 0.06) * fs);
          this.flashT[side] = 0.045;
          this.flashLight.intensity = 3 * fs;
        }
        break;
      }
      case 'reloadStart':
        this.reload = { t: 0, total: e.time, empty: e.empty, style: e.style || (def ? def.reloadStyle : 'mag'), start: e.startTime, shell: e.shellTime };
        break;
      case 'reloadShell':
        this.shellPulse = 0;
        break;
      case 'reloadCancel':
        this.reload = null;
        break;
      case 'reloadDone':
        if (this.reload && this.reload.style === 'shell' && e.empty && def && def.action === 'pump') this.actionT = 0;
        this.reload = null;
        this.slideLocked = false;
        break;
      case 'melee':
        this.meleeT = 0;
        this.meleeLunge = e.lunge;
        break;
      case 'grenadeThrow':
        this.throwT = 0;
        break;
      case 'perkDrink':
        this.drinkT = 0;
        this.drinkDur = this.cfg.perks.drinkTime;
        this.setBottle(this.cfg.perks.list[e.perk].color);
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
  update(dt, p, def, look, bob, aim = null) {
    this.time += dt;
    const w = p.loadout;
    const slot = w.slots[w.current];
    if (slot.id !== this.currentId) this.setWeapon(slot.id);
    const pair = this.current;
    const M = pair.R;
    const dual = !!def.dual;
    const ads = aim ? aim.ads : w.adsAmount;
    this.adsNow = ads;
    const small = def.class === 'pistol';

    this.sprintBlend = lerp(this.sprintBlend, p.sprinting ? 1 : 0, 1 - Math.exp(-dt * 10));
    const sb = ease(this.sprintBlend);

    const kz = this.kickZ.update(dt);
    const kr = this.kickRot.update(dt);
    const kl = this.kickL.update(dt);
    const ks = this.kickSide.update(dt);
    // mouse sway from smoothed mouse *speed* (not per-frame deltas, which
    // jump around with the frame rate and made aiming shake)
    const sdt = Math.max(1 / 240, dt);
    const kv = 1 - Math.exp(-dt * 18);
    this.mvx = (this.mvx || 0) + (look.dx / sdt - (this.mvx || 0)) * kv;
    this.mvy = (this.mvy || 0) + (look.dy / sdt - (this.mvy || 0)) * kv;
    const swayAmt = lerp(1, 0.06, ads);
    const sx = this.swayX.update(dt, Math.max(-0.05, Math.min(0.05, -this.mvx * 0.0000075)) * swayAmt);
    const sy = this.swayY.update(dt, Math.max(-0.05, Math.min(0.05, this.mvy * 0.0000075)) * swayAmt);
    const ly = this.landY.update(dt);

    animateCamo(this.time);

    // --- common offsets (bob, breathing, sprint, recoil, sway, draw)
    const o = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
    if (p.downed) { o.y -= 0.02; o.rz += 0.12 + Math.sin(this.time * 1.3) * 0.03; o.x -= 0.02; }
    const bobScale = lerp(1, 0.12, ads);
    o.x += Math.cos(bob.phase) * bob.amp * 0.35 * bobScale;
    o.y += -Math.abs(Math.sin(bob.phase)) * bob.amp * 0.3 * bobScale + Math.sin(this.time * 1.6) * 0.0018 * (1 - ads * 0.9);
    o.rz += Math.cos(bob.phase) * bob.amp * 0.6 * bobScale;
    if (small || dual) { o.y -= sb * 0.05; o.z += sb * 0.04; o.rx += sb * 0.55; o.ry += sb * 0.45; o.rz += sb * 0.35; }
    else { o.x -= sb * 0.03; o.y -= sb * 0.05; o.z += sb * 0.03; o.rx -= sb * 0.25; o.ry += sb * 0.75; o.rz += sb * 0.3; }
    if (p.sprinting) { o.x += Math.cos(bob.phase) * 0.02 * sb; o.y += Math.abs(Math.sin(bob.phase)) * 0.018 * sb; }
    if (!p.grounded) o.y += 0.01;
    o.x += sx; o.y += sy + ly * 0.03; o.ry += sx * 1.2; o.rx += sy * 1.0;
    if (this.drawT < 1) {
      this.drawT = Math.min(1, this.drawT + dt / Math.max(0.05, def.drawTime));
      const d = 1 - ease(this.drawT);
      o.y -= d * 0.25; o.rx -= d * 0.9;
    }

    // --- reset animated parts
    for (const m of [pair.R, pair.L]) {
      if (!m) continue;
      for (const k of Object.keys(m.parts)) { const pt = m.parts[k]; pt.position.copy(pt.userData.home); pt.rotation.set(0, 0, 0); pt.visible = true; }
    }
    const leftOff = new THREE.Vector3();
    const r = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };   // reload pose offsets (applied to both guns)

    // --- reload choreography by style
    if (this.reload) {
      this.reload.t += dt;
      const style = this.reload.style;
      const pr = clamp01(this.reload.t / Math.max(0.05, this.reload.total));
      const parts = M.parts;
      if (style === 'shell') {
        // tilt to show the loading port; the left hand feeds shells in one at a time
        const tilt = seg(this.reload.t, 0, this.reload.start || 0.35);
        r.rz += tilt * 0.45; r.rx += tilt * 0.12; r.y += tilt * 0.02;
        if (this.shellPulse >= 0) this.shellPulse += dt;
        const push = this.shellPulse >= 0 ? bump(this.shellPulse, 0, (this.reload.shell || 0.5) * 0.8) : 0;
        const toPort = M.leftHome ? Math.max(0, -M.leftHome.z - 0.02) : 0;
        leftOff.set(0.02 * tilt, -0.04 * tilt + push * 0.03, toPort * tilt - push * 0.04);
      } else if (style === 'break') {
        const tilt = seg(pr, 0.0, 0.14) * (1 - seg(pr, 0.84, 1.0));
        r.rx -= tilt * 0.35; r.rz += tilt * 0.25; r.y += tilt * 0.03;
        const open = seg(pr, 0.08, 0.2) * (1 - seg(pr, 0.72, 0.8));
        if (parts.barrels) parts.barrels.rotation.x = -open * 0.6;
        const lh = seg(pr, 0.22, 0.34) * (1 - seg(pr, 0.66, 0.78));
        leftOff.set(0.02 * lh, 0.03 * lh + Math.sin(pr * 40) * 0.004 * lh, 0.2 * lh);
        if (pr > 0.74 && pr < 0.8) r.rx += 0.05;
      } else if (style === 'cylinder') {
        const tilt = seg(pr, 0.0, 0.14) * (1 - seg(pr, 0.84, 1.0));
        r.rz += tilt * 0.7; r.x -= tilt * 0.04; r.y += tilt * 0.03;
        const out = seg(pr, 0.1, 0.2) * (1 - seg(pr, 0.74, 0.82));
        if (parts.cylinder) { parts.cylinder.position.x -= out * 0.03; parts.cylinder.rotation.z = out * 0.4; }
        r.rx += bump(pr, 0.22, 0.42) * 0.5;
        const lh = seg(pr, 0.38, 0.5) * (1 - seg(pr, 0.7, 0.8));
        leftOff.set(0.02 * lh, 0.02 * lh, 0.02 * lh);
      } else if (style === 'belt') {
        // open the feed cover, swap the belt box, slam the cover, charge
        const tilt = seg(pr, 0.0, 0.1) * (1 - seg(pr, 0.9, 1.0));
        r.rz += tilt * 0.35; r.rx += tilt * 0.1; r.y += tilt * 0.03;
        const cover = seg(pr, 0.08, 0.18) * (1 - seg(pr, 0.66, 0.72));
        if (parts.cover) parts.cover.rotation.x = cover * 0.75;
        let magY = -seg(pr, 0.2, 0.32) * 0.25;
        if (pr > 0.32 && pr < 0.42 && parts.mag) parts.mag.visible = false;
        if (pr >= 0.42) magY = -(1 - seg(pr, 0.42, 0.62)) * 0.25;
        if (parts.mag) parts.mag.position.y += magY;
        const lh = seg(pr, 0.14, 0.24) * (1 - seg(pr, 0.74, 0.82));
        leftOff.set(-0.03 * lh, 0.02 * lh - bump(pr, 0.25, 0.6) * 0.15, 0.25 * lh);
        const pull = bump(pr, 0.82, 0.92);
        if (parts.bolt) parts.bolt.position.z += pull * (M.boltTravel || 0.03);
        if (pr > 0.66 && pr < 0.7) r.y -= 0.008;
      } else {
        // magazine (both guns at once when dual wielding)
        const tilt = seg(pr, 0.0, 0.14) * (1 - seg(pr, 0.86, 1.0));
        r.rz += tilt * (small ? 0.55 : 0.4); r.rx += tilt * 0.18; r.x -= tilt * 0.03; r.y += tilt * 0.02;
        if (dual) { r.y -= tilt * 0.12; r.rx -= tilt * 0.7; }
        let magY = -seg(pr, 0.12, 0.26) * 0.22;
        const hideMag = pr > 0.26 && pr < 0.36;
        if (pr >= 0.36) magY = -(1 - seg(pr, 0.36, 0.7)) * 0.2;
        for (const m of [pair.R, pair.L]) if (m && m.parts.mag) { m.parts.mag.position.y += magY; if (hideMag) m.parts.mag.visible = false; }
        const lh = seg(pr, 0.16, 0.3) * (1 - seg(pr, 0.4, 0.7));
        const toMag = parts.mag ? parts.mag.userData.home.z - (M.leftHome ? M.leftHome.z : 0) : 0;
        leftOff.set(-0.02 * lh, -0.18 * lh, (small ? 0.03 : toMag) * lh);
        if (pr > 0.7 && pr < 0.76) r.y += 0.006;
        if (this.reload.empty) {
          if (pr > 0.76) this.slideLocked = false;
          const pull = bump(pr, 0.76, 0.88);
          for (const m of [pair.R, pair.L]) if (m && m.parts.bolt) m.parts.bolt.position.z += pull * (m.boltTravel || 0.03);
          r.rz -= pull * 0.1;
        }
      }
    }

    // --- pump / bolt cycle after a shot
    if (this.actionT >= 0) {
      this.actionT += dt;
      const cyc = Math.min(0.55, 60 / def.rpm * 0.85);
      const a = clamp01((this.actionT - 0.08) / cyc);
      if (a >= 1) this.actionT = -1;
      const back = bump(a, 0, 1);
      if (M.parts.pump) {
        M.parts.pump.position.z += back * (M.pumpTravel || 0.08);
        if (M.leftFollows === 'pump') leftOff.z += back * (M.pumpTravel || 0.08);
        r.rx += back * 0.04;
      }
      if (def.action === 'bolt' && M.parts.bolt) {
        const lift = bump(a, 0, 0.5), pull = bump(a, 0.15, 0.85);
        M.parts.bolt.rotation.z = lift * 1.2;
        M.parts.bolt.position.z += pull * (M.boltTravel || 0.06);
        r.rz += back * 0.12; r.ry += back * 0.05;
      }
    }

    // --- slide / bolt cycling on automatic guns
    for (const side of ['R', 'L']) {
      const m = pair[side];
      if (!m) continue;
      this.slideBack[side] = Math.max(0, this.slideBack[side] - dt / 0.06);
      const cyc = Math.sin(this.slideBack[side] * Math.PI * 0.5);
      if (m.parts.slide) m.parts.slide.position.z += this.slideLocked && side === 'R' ? (m.slideTravel || 0.03) : cyc * (m.slideTravel || 0.03);
      if (m.parts.bolt && def.action !== 'bolt' && !this.reload) m.parts.bolt.position.z += cyc * (m.boltTravel || 0.03);
      if (m.parts.cylinder && !this.reload) m.parts.cylinder.rotation.z = this.cylSpin;
      // crossbow bolt / ballistic blade only show while loaded
      const loaded = (side === 'L' ? slot.clipL : slot.clip) > 0;
      if (m.parts.saw) {
        this.sawSpin = (this.sawSpin || 0) + dt * (8 + this.slideBack.R * 60);
        m.parts.saw.rotation.y = -this.sawSpin;
        m.parts.saw.visible = (side === 'L' ? slot.clipL : slot.clip) > 0 && !(this.reload && this.reload.t / this.reload.total < 0.6);
      }
      if (m.parts.core) m.parts.core.scale.setScalar(slot.clip > 0 ? 1 + Math.sin(this.time * 9) * 0.15 + this.slideBack.R * 0.8 : 0.3);
      if (m.parts.boltShaft) m.parts.boltShaft.visible = loaded && !(this.reload && this.reload.t / this.reload.total < 0.55);
      if (m.parts.blade) m.parts.blade.visible = loaded && !(this.reload && this.reload.t / this.reload.total < 0.5);
    }

    // --- knife
    let gunDip = 0;
    if (this.meleeT >= 0) {
      this.meleeT += dt;
      const t = this.meleeT / this.cfg.melee.duration;
      if (t >= 1) { this.meleeT = -1; this.knifeArm.visible = false; }
      else {
        this.knifeArm.visible = true;
        const inT = seg(t, 0, 0.15), slash = seg(t, 0.12, 0.38), outT = seg(t, 0.55, 1);
        gunDip = Math.max(gunDip, Math.min(inT * 2, 1) * (1 - outT));
        const kx = lerp(0.42, 0.26, inT) + lerp(0, -0.4, slash) + outT * 0.35;
        const ky = lerp(-0.32, -0.12, inT) + slash * 0.02 - outT * 0.3;
        const kzz = -0.46 - (this.meleeLunge ? slash * 0.06 : 0);
        this.knifeArm.position.set(kx, ky, kzz);
        this.knifeArm.rotation.set(-0.15 + slash * 0.1, lerp(0.25, 1.25, slash) + inT * 0.2, lerp(-0.6, -0.2, slash));
      }
    }

    // --- grenade: hold it up while cooking, then throw
    const cooking = p.throwing && p.throwing.phase === 'cook';
    if (cooking || this.throwT >= 0) {
      this.grenadeArm.visible = true;
      if (cooking) {
        const t = clamp01(p.throwing.t / 0.2);
        gunDip = Math.max(gunDip, t);
        this.grenadeArm.position.set(lerp(-0.25, -0.12, t), lerp(-0.35, -0.1, t) + Math.sin(this.time * 9) * 0.002, -0.32);
        this.grenadeArm.rotation.set(0.2, 0.2, 0.3);
        this.heldKind = p.throwing.kind || 'frag';
        this.showHeld(true);
      } else {
        this.throwT += dt;
        const t = clamp01(this.throwT / 0.4);
        gunDip = Math.max(gunDip, 1 - seg(t, 0.5, 1));
        // push forward and up (overhand lob), then drop out of view
        const swing = seg(t, 0, 0.3), drop = seg(t, 0.35, 1);
        this.grenadeArm.position.set(-0.12 + swing * 0.08, -0.1 + swing * 0.06 - drop * 0.45, -0.32 - swing * 0.18 + drop * 0.1);
        this.grenadeArm.rotation.set(0.2 - swing * 0.35 + drop * 0.5, 0.2 - swing * 0.15, 0.3);
        this.showHeld(t < 0.25);
        if (t >= 1) { this.throwT = -1; this.grenadeArm.visible = false; }
      }
    } else this.grenadeArm.visible = false;

    // --- drinking a perk: gun drops away, bottle comes up and tips back
    if (p.drinking || (this.drinkT != null && this.drinkT >= 0 && this.drinkT < (this.drinkDur || 2))) {
      if (this.drinkT == null || this.drinkT < 0) { this.drinkT = 0; this.drinkDur = this.cfg.perks.drinkTime; }
      this.drinkT += dt;
      const t = this.drinkT / this.drinkDur;
      if (t >= 1 && !p.drinking) { this.drinkT = -1; this.drinkArm.visible = false; }
      else {
        this.drinkArm.visible = true;
        gunDip = Math.max(gunDip, seg(t, 0, 0.15) * (1 - seg(t, 0.85, 1)));
        const up = seg(t, 0.12, 0.35) * (1 - seg(t, 0.82, 1));
        const tip = seg(t, 0.35, 0.55) * (1 - seg(t, 0.75, 0.85));
        this.drinkArm.position.set(lerp(-0.22, -0.1, up) + tip * 0.03, lerp(-0.38, -0.13, up) + tip * 0.02, lerp(-0.34, -0.36, up) + tip * 0.06);
        this.drinkArm.rotation.set(0.1 + tip * 1.25, 0.15, 0.35 - up * 0.15 - tip * 0.2);
        this.bottleCap.visible = t < 0.3;
      }
    } else this.drinkArm.visible = false;

    // --- place the gun(s)
    const place = (m, mirror, kick) => {
      const hip = m.hip, aim = m.aim;
      const a = dual ? 0 : ads;
      let px = lerp(hip.x, 0, a), py = lerp(hip.y, aim.y, a), pz = lerp(hip.z, aim.z, a);
      let rx = lerp(hip.rx || 0, 0, a), ry = lerp(hip.ry, 0, a), rz = lerp(hip.rz, 0, a);
      px += o.x + r.x; py += o.y + r.y; pz += o.z + r.z; rx += o.rx + r.rx; ry += o.ry + r.ry; rz += o.rz + r.rz;
      pz += kick.z * 0.024; rx += kick.r * 0.05; ry += ks * 0.025; py += kick.r * 0.004; rz += ks * 0.03;
      py -= gunDip * 0.2; rx -= gunDip * 0.6; px += gunDip * 0.05;
      if (mirror) { px = -px - 0.0; ry = -ry; rz = -rz; }
      if (dual) px += mirror ? -0.02 : 0.02;
      m.group.position.set(px, py, pz);
      m.group.rotation.set(rx, ry, rz);
    };
    place(pair.R, false, { z: kz, r: kr });
    if (pair.L) place(pair.L, true, { z: kl * 0.35, r: kl });
    if (M.leftHand) M.leftHand.position.copy(M.leftHome).add(leftOff);

    // scoped weapons hide the gun once the scope is up
    this.scoped = !!def.scope && ads > 0.85;
    this.root.visible = !this.scoped;
    // the gun is inside the Mad Dog Machine: empty hands
    const away = !!slot.away;
    pair.R.group.visible = !away;
    if (pair.L) pair.L.group.visible = !away;

    for (const side of ['R', 'L']) {
      if (this.flashT[side] > 0) {
        this.flashT[side] -= dt;
        if (this.flashT[side] <= 0) { this.flash[side].visible = false; this.flashLight.intensity = 0; }
      }
    }

    this.hemi.intensity = 0.5 + this.envLevel * 1.0;
    this.key.intensity = 0.4 + this.envLevel * 1.4;
    if (this.envMats) for (const m of this.envMats) m.envMapIntensity = 0.12 + this.envLevel * 0.35;
    for (const m of realGunMaterials) m.envMapIntensity = 0.15 + this.envLevel * 0.55;
    setFpClip(this.adsNow || 0);
  }

  muzzleWorldPosition(camera, out, side = 'R') {
    const m = this.current && (this.current[side] || this.current.R);
    if (!m) return out.copy(camera.position);
    m.muzzle.updateWorldMatrix(true, false);
    const local = new THREE.Vector3().setFromMatrixPosition(m.muzzle.matrixWorld);
    local.applyQuaternion(camera.quaternion);
    return out.copy(camera.position).add(local);
  }
}
