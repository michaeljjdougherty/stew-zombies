// =============================================================================
// Zombie rendering: procedural low-poly models, animation, dismemberment,
// corpses. Reads zombie state from the sim; never changes it.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';

const SHIRTS = ['#6a6450', '#56606a', '#77634c', '#8a8676', '#554c44', '#6d3f3a', '#5a6650', '#7a7060'];
const PANTS = ['#3e3b33', '#3a4250', '#4d4433', '#35302a'];

function hash(n) { n = (n ^ 61) ^ (n >>> 16); n *= 9; n ^= n >>> 4; n *= 0x27d4eb2d; n ^= n >>> 15; return (n >>> 0) / 4294967296; }

export class ZombieViews {
  constructor(scene, effects, cfg) {
    this.scene = scene;
    this.effects = effects;
    this.cfg = cfg;
    this.views = new Map();
    this.corpses = [];
    this.prev = new Map();
    this.onFootstep = null;

    // shared resources
    this.skinMats = [1, 2, 3].map((s) => new THREE.MeshStandardMaterial({ map: T.skinTexture(s), roughness: 0.85 }));
    this.shirtMats = SHIRTS.map((c, i) => new THREE.MeshStandardMaterial({ map: T.clothTexture(i + 1, c, { stripes: i === 5 }), roughness: 0.95 }));
    this.pantsMats = PANTS.map((c, i) => new THREE.MeshStandardMaterial({ map: T.clothTexture(i + 20, c), roughness: 0.95 }));
    this.goreMat = new THREE.MeshStandardMaterial({ color: '#4a0808', roughness: 0.5 });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 3.2, 0.5), fog: false });
    this.mouthMat = new THREE.MeshBasicMaterial({ color: '#0a0303' });
    this.hairMat = new THREE.MeshStandardMaterial({ color: '#1c1813', roughness: 1 });
    this.glowMat = new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,170,60,1)', 'rgba(255,90,0,0)'), color: 0xffb040, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.9 });

    this.geo = {
      chest: new THREE.CylinderGeometry(0.25, 0.18, 0.54, 12).scale(1, 1, 0.64),
      shoulder: new THREE.SphereGeometry(0.085, 10, 8),
      pelvis: new THREE.CylinderGeometry(0.185, 0.175, 0.2, 12).scale(1, 1, 0.72),
      head: new THREE.SphereGeometry(0.125, 14, 12).scale(0.92, 1.12, 1.0),
      jaw: new THREE.BoxGeometry(0.15, 0.05, 0.1),
      neckGeo: new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8),
      brow: new THREE.BoxGeometry(0.19, 0.035, 0.05),
      socket: new THREE.SphereGeometry(0.032, 8, 6),
      nose: new THREE.BoxGeometry(0.03, 0.05, 0.035),
      hair: new THREE.SphereGeometry(0.132, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45).scale(0.95, 1.1, 1.05),
      flap: new THREE.BoxGeometry(0.1, 0.16, 0.01),
      upperArm: new THREE.CapsuleGeometry(0.06, 0.22, 3, 8),
      foreArm: new THREE.CapsuleGeometry(0.05, 0.22, 3, 8),
      hand: new THREE.BoxGeometry(0.08, 0.13, 0.045),
      thigh: new THREE.CapsuleGeometry(0.088, 0.3, 3, 8),
      shin: new THREE.CapsuleGeometry(0.07, 0.3, 3, 8),
      foot: new THREE.BoxGeometry(0.1, 0.07, 0.24),
      eye: new THREE.SphereGeometry(0.018, 6, 4),
      stump: new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8),
      neckStump: new THREE.CylinderGeometry(0.07, 0.08, 0.06, 8),
    };
  }

  build(z) {
    const r = (k) => hash(z.seed + k * 7919);
    const skin = this.skinMats[Math.floor(r(1) * this.skinMats.length)];
    const shirt = this.shirtMats[Math.floor(r(2) * this.shirtMats.length)];
    const pants = this.pantsMats[Math.floor(r(3) * this.pantsMats.length)];
    const G = this.geo;
    const mk = (geo, mat, parent, x = 0, y = 0, zz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, zz);
      parent.add(m);
      return m;
    };

    const root = new THREE.Group();
    const body = new THREE.Group(); // extra pivot for death falls
    root.add(body);
    const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
    mk(G.pelvis, pants, hips, 0, 0.02, 0);
    const torso = new THREE.Group(); torso.position.y = 0.1; hips.add(torso);
    mk(G.chest, shirt, torso, 0, 0.27, 0);
    // torn shirt flaps hanging off the hem
    for (let i = 0; i < 3; i++) {
      if (r(20 + i) < 0.35) continue;
      const a = (i - 1) * 0.9 + (r(30 + i) - 0.5) * 0.4;
      const f = mk(G.flap, shirt, torso, Math.sin(a) * 0.2, -0.02, Math.cos(a) * 0.13);
      f.rotation.set(0.15, a, (r(40 + i) - 0.5) * 0.6);
    }
    const neck = new THREE.Group(); neck.position.set(0, 0.54, 0.02); torso.add(neck);
    mk(G.neckGeo, skin, neck, 0, 0.03, 0);
    const head = new THREE.Group(); head.position.y = 0.06; neck.add(head);
    mk(G.head, skin, head, 0, 0.1, 0.01);
    const jaw = mk(G.jaw, skin, head, 0, -0.01, 0.04);
    const brow = mk(G.brow, skin, head, 0, 0.165, 0.085);
    brow.rotation.x = 0.35;
    mk(G.nose, skin, head, 0, 0.1, 0.125);
    for (const s of [-1, 1]) mk(G.socket, this.mouthMat, head, s * 0.045, 0.13, 0.092);
    if (r(11) < 0.6) mk(G.hair, this.hairMat, head, 0, 0.11, -0.005).rotation.x = -0.25;
    const mouth = mk(new THREE.BoxGeometry(0.1, 0.03, 0.02), this.mouthMat, head, 0, 0.02, 0.1);
    const eyes = [];
    for (const s of [-1, 1]) {
      eyes.push(mk(G.eye, this.eyeMat, head, s * 0.045, 0.13, 0.112));
    }
    const glow = new THREE.Sprite(this.glowMat);
    glow.scale.set(0.24, 0.12, 1);
    glow.position.set(0, 0.13, 0.13);
    head.add(glow);
    const neckStump = mk(G.neckStump, this.goreMat, neck, 0, 0.02, 0);
    neckStump.visible = false;

    const arm = (side) => {
      const shoulder = new THREE.Group(); shoulder.position.set(side * 0.25, 0.47, 0); torso.add(shoulder);
      mk(G.shoulder, shirt, shoulder, 0, -0.01, 0);
      mk(G.upperArm, shirt, shoulder, 0, -0.15, 0);
      const elbow = new THREE.Group(); elbow.position.y = -0.3; shoulder.add(elbow);
      mk(G.foreArm, skin, elbow, 0, -0.14, 0);
      mk(G.hand, skin, elbow, 0, -0.32, 0.01);
      const stump = mk(G.stump, this.goreMat, shoulder, 0, -0.3, 0);
      stump.visible = false;
      return { shoulder, elbow, stump };
    };
    const leg = (side) => {
      const hip = new THREE.Group(); hip.position.set(side * 0.1, -0.02, 0); hips.add(hip);
      mk(G.thigh, pants, hip, 0, -0.22, 0);
      const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
      mk(G.shin, pants, knee, 0, -0.21, 0);
      mk(G.foot, this.pantsMats[3], knee, 0, -0.45, 0.05);
      const stump = mk(G.stump, this.goreMat, hip, 0, -0.44, 0);
      stump.visible = false;
      return { hip, knee, stump };
    };
    const armL = arm(1), armR = arm(-1), legL = leg(1), legR = leg(-1);

    root.scale.setScalar(z.scale);
    this.scene.add(root);

    return {
      id: z.id, root, body, hips, torso, neck, head, jaw, eyes, glow, neckStump,
      armL, armR, legL, legR,
      skinMat: skin, shirtMat: shirt,
      phase: r(4) * Math.PI * 2,
      lastStepPhase: 0,
      hunch: 0.15 + r(5) * 0.25,
      limp: r(6) < 0.35 ? 0.5 + r(7) * 0.4 : 1,
      armLift: -1.15 - r(8) * 0.35,
      headTilt: (r(9) - 0.5) * 0.6,
      flinch: 0, flinchVel: 0,
      swing: 0,
      limbs: { armL: true, armR: true, head: true, legs: true },
      crawler: false,
      type: z.type,
      seedR: r,
    };
  }

  // match a fresh view to limbs already lost in the sim (no effects)
  syncLimbs(v, z) {
    if (z.crawler) {
      v.crawler = true; v.limbs.legs = false;
      for (const l of [v.legL, v.legR]) { l.knee.visible = false; l.stump.visible = true; }
    }
    for (const a of ['armL', 'armR']) {
      if (z.limbs && z.limbs[a] === false) { v.limbs[a] = false; v[a].elbow.visible = false; v[a].stump.visible = true; }
    }
    if (z.limbs && z.limbs.head === false) { v.limbs.head = false; v.head.visible = false; v.neckStump.visible = true; }
  }

  beginStep(sim) {
    for (const z of sim.zombies) {
      let p = this.prev.get(z.id);
      if (!p) { p = { x: 0, y: 0, z: 0, yaw: 0 }; this.prev.set(z.id, p); }
      p.x = z.pos.x; p.y = z.pos.y; p.z = z.pos.z; p.yaw = z.yaw;
    }
  }

  onEvent(e, sim) {
    const v = this.views.get(e.id);
    if (e.type === 'zombieHit' && v) {
      v.flinchVel += e.part === 'head' ? 9 : 5;
    } else if (e.type === 'zombieLimb' && v) {
      this.loseLimb(v, e.limb, e.dir);
    } else if (e.type === 'zombieSwing' && v) {
      v.swing = 0.0001;
    } else if (e.type === 'zombieKilled' && v) {
      this.views.delete(e.id);
      this.prev.delete(e.id);
      this.makeCorpse(v, e);
    }
  }

  loseLimb(v, limb, dir) {
    if (!v.limbs[limb]) return;
    v.limbs[limb] = false;
    const d = dir || { x: 0, y: 0, z: 1 };
    if (limb === 'legs') {
      v.crawler = true;
      for (const l of [v.legL, v.legR]) {
        const wp = new THREE.Vector3(); l.knee.getWorldPosition(wp);
        const wq = new THREE.Quaternion(); l.knee.getWorldQuaternion(wq);
        l.knee.visible = false;
        l.stump.visible = true;
        this.effects.bloodBurst(wp, d, 22, 1.1);
        this.effects.flyingLimb(l.knee, wp, wq, d, v.root.scale.x);
      }
      return;
    }
    if (limb === 'head') {
      const wp = new THREE.Vector3(); v.head.getWorldPosition(wp);
      v.head.visible = false;
      v.neckStump.visible = true;
      this.effects.bloodBurst(wp, d, 40, 1.4);
      this.effects.gibs(wp, d, 6, this.goreMat, v.skinMat);
      this.effects.bloodSpurt(v.neck, 1.2);
    } else {
      const a = limb === 'armL' ? v.armL : v.armR;
      const wp = new THREE.Vector3(); a.elbow.getWorldPosition(wp);
      const wq = new THREE.Quaternion(); a.elbow.getWorldQuaternion(wq);
      a.elbow.visible = false;
      a.stump.visible = true;
      this.effects.bloodBurst(wp, d, 24, 1.0);
      this.effects.flyingLimb(a.elbow, wp, wq, d, v.root.scale.x);
    }
  }

  // a close blast turns the zombie into pieces
  explodeBody(v, e) {
    const d = e.dir || { x: 0, y: 1, z: 0 };
    const c = new THREE.Vector3(); v.torso.getWorldPosition(c);
    this.effects.bloodBurst(c, d, 70, 1.8);
    this.effects.gibs(c, d, 14, this.goreMat, v.skinMat);
    const parts = [v.armL.elbow, v.armR.elbow, v.head];
    if (!v.crawler) parts.push(v.legL.knee, v.legR.knee);
    for (const part of parts) {
      if (!part.visible) continue;
      const wp = new THREE.Vector3(); part.getWorldPosition(wp);
      const wq = new THREE.Quaternion(); part.getWorldQuaternion(wq);
      this.effects.flyingLimb(part, wp, wq, { x: d.x + (Math.random() - 0.5) * 1.5, y: 0, z: d.z + (Math.random() - 0.5) * 1.5 }, v.root.scale.x);
    }
    this.scene.remove(v.root);
    const p = v.root.position;
    for (let i = 0; i < 3; i++) this.effects.bloodDecal(new THREE.Vector3(p.x + (Math.random() - 0.5) * 2, 0, p.z + (Math.random() - 0.5) * 2), new THREE.Vector3(0, 1, 0), 0.8 + Math.random() * 0.8);
  }

  makeCorpse(v, e) {
    if (e.kind === 'explosive' && e.force > 0.55) { this.explodeBody(v, e); return; }
    const d = e.dir || { x: 0, y: 0, z: 0 };
    const fwdX = Math.sin(v.root.rotation.y), fwdZ = Math.cos(v.root.rotation.y);
    const fromFront = d.x * fwdX + d.z * fwdZ < 0;
    const dir = fromFront ? -1 : 1;
    this.corpses.push({
      v, t: 0, dir,
      twist: (Math.random() - 0.5) * 0.8,
      fallTime: 0.55 + Math.random() * 0.25,
      armL: (Math.random() - 0.5) * 2, armR: (Math.random() - 0.5) * 2,
      legBend: Math.random() * 0.8,
      headshot: e.headshot,
      knockback: e.kind === 'knife' ? 0.2 : 0.35,
      kd: { x: d.x, z: d.z },
      crawler: v.crawler,
    });
    if (e.headshot && v.limbs.head) this.loseLimb(v, 'head', e.dir);
    v.glow.visible = false;
    for (const eye of v.eyes) eye.visible = false;
    // pool of blood beneath
    const p = v.root.position;
    setTimeout(() => this.effects.bloodDecal(new THREE.Vector3(p.x + d.x * 0.8, 0, p.z + d.z * 0.8), new THREE.Vector3(0, 1, 0), 0.9 + Math.random() * 0.6), 500);
  }

  update(sim, dt, alpha, time) {
    // create views for new zombies, sync
    const seen = new Set();
    for (const z of sim.zombies) {
      if (z.type === 'cheddar') continue; // drawn by CheddarViews
      seen.add(z.id);
      let v = this.views.get(z.id);
      if (!v) { v = this.build(z); this.syncLimbs(v, z); this.views.set(z.id, v); }
      const p = this.prev.get(z.id);
      const x = p ? p.x + (z.pos.x - p.x) * alpha : z.pos.x;
      const y = p ? p.y + (z.pos.y - p.y) * alpha : z.pos.y;
      const zz = p ? p.z + (z.pos.z - p.z) * alpha : z.pos.z;
      v.root.position.set(x, y, zz);
      let yaw = z.yaw;
      if (p) { let dy = z.yaw - p.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; yaw = p.yaw + dy * alpha; }
      v.root.rotation.y = yaw;
      this.animate(v, z, dt, time);
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) { this.scene.remove(v.root); this.views.delete(id); }
    }
    this.updateCorpses(dt);
  }

  animate(v, z, dt, time) {
    const speed = z.moveSpeed;
    const type = z.type;
    const stride = type === 'sprinter' ? 1.5 : type === 'runner' ? 1.25 : 0.75;
    v.phase += (speed / stride) * Math.PI * dt;
    if (z.state === 'tearing') v.phase += dt * 5;

    // footsteps on each half cycle
    const stepIdx = Math.floor(v.phase / Math.PI);
    if (stepIdx !== v.lastStepPhase && speed > 0.3 && this.onFootstep) this.onFootstep(z, v);
    v.lastStepPhase = stepIdx;

    // flinch spring
    v.flinchVel += (-v.flinch * 120 - v.flinchVel * 14) * dt;
    v.flinch += v.flinchVel * dt;

    const ph = v.phase;
    const s = Math.sin(ph), c = Math.cos(ph);
    let legAmp, kneeAmp, lean, armBase, armSwing, bounce;
    if (type === 'sprinter') { legAmp = 0.95; kneeAmp = 1.4; lean = 0.5; armBase = -0.3; armSwing = 1.2; bounce = 0.06; }
    else if (type === 'runner') { legAmp = 0.7; kneeAmp = 1.1; lean = 0.38; armBase = -0.7; armSwing = 0.7; bounce = 0.045; }
    else { legAmp = 0.34; kneeAmp = 0.5; lean = v.hunch; armBase = v.armLift; armSwing = 0.12; bounce = 0.025; }
    const moving = Math.min(1, speed / 0.6);

    v.legL.hip.rotation.x = -s * legAmp * moving;
    v.legR.hip.rotation.x = s * legAmp * moving * v.limp;
    v.legL.knee.rotation.x = Math.max(0, -c) * kneeAmp * moving + 0.05;
    v.legR.knee.rotation.x = Math.max(0, c) * kneeAmp * moving * v.limp + 0.05;
    v.hips.position.y = 0.95 - Math.abs(c) * bounce * moving - (type === 'walker' ? 0.03 : 0.06);
    v.hips.rotation.z = s * 0.06 * moving;
    v.hips.rotation.y = s * 0.12 * moving;
    v.torso.rotation.x = lean + v.flinch * -0.05;
    v.torso.rotation.y = -s * 0.15 * moving;
    v.torso.rotation.z = Math.sin(time * 0.7 + v.hunch * 10) * 0.05;
    v.neck.rotation.z = v.headTilt + Math.sin(time * 1.3 + v.phase * 0.5) * 0.12;
    v.neck.rotation.x = -lean * 0.6 + Math.sin(time * 0.9) * 0.08;
    v.jaw.rotation.x = 0.25 + Math.max(0, Math.sin(time * 3.1 + v.hunch * 20)) * 0.25;

    let aL, aR;
    if (type === 'walker') {
      aL = armBase + Math.sin(time * 1.6 + 1) * 0.12 + s * armSwing;
      aR = armBase + 0.1 + Math.sin(time * 1.4) * 0.12 - s * armSwing;
    } else {
      aL = armBase + s * armSwing * moving;
      aR = armBase - s * armSwing * moving;
    }
    v.armL.shoulder.rotation.set(aL, 0, 0.12);
    v.armR.shoulder.rotation.set(aR, 0, -0.12);
    v.armL.elbow.rotation.x = type === 'walker' ? -0.25 : -0.9;
    v.armR.elbow.rotation.x = type === 'walker' ? -0.3 : -0.9;

    // tearing boards: grab and yank
    if (z.state === 'tearing') {
      const t = time * 3.2 + v.hunch * 10;
      v.armL.shoulder.rotation.x = -1.6 + Math.sin(t) * 0.5;
      v.armR.shoulder.rotation.x = -1.6 + Math.sin(t + Math.PI) * 0.5;
      v.armL.elbow.rotation.x = -0.4 - Math.max(0, Math.sin(t)) * 0.8;
      v.armR.elbow.rotation.x = -0.4 - Math.max(0, Math.sin(t + Math.PI)) * 0.8;
      v.torso.rotation.x = 0.3 + Math.sin(t * 2) * 0.1;
    }

    // climbing through a window
    if (z.state === 'climbing') {
      const t = Math.min(1, z.climbT);
      const k = Math.sin(t * Math.PI);
      v.torso.rotation.x = 0.4 + k * 0.7;
      v.legL.hip.rotation.x = -k * 1.4;
      v.legR.hip.rotation.x = -Math.max(0, Math.sin((t - 0.15) * Math.PI)) * 1.4;
      v.legL.knee.rotation.x = k * 1.6;
      v.legR.knee.rotation.x = k * 1.4;
      v.armL.shoulder.rotation.x = -1.2 - k * 0.6;
      v.armR.shoulder.rotation.x = -1.0 - k * 0.8;
    }

    // attack swing
    if (z.attack.phase === 'windup') {
      const w = 1 - z.attack.t / this.cfg.zombie.attackWindup;
      v.armR.shoulder.rotation.x = -1.2 - w * 1.6;
      v.armR.shoulder.rotation.z = -0.4;
      v.torso.rotation.y = 0.35 * w;
      v.torso.rotation.x = lean - 0.1 * w;
    } else if (z.attack.phase === 'recover') {
      const w = 1 - z.attack.t / this.cfg.zombie.attackRecover;
      const slash = Math.min(1, w * 4);
      v.armR.shoulder.rotation.x = -2.8 + slash * 2.4;
      v.armR.shoulder.rotation.z = -0.4 + slash * 0.6;
      v.torso.rotation.y = 0.35 - slash * 0.7;
      v.torso.rotation.x = lean + slash * 0.25;
    }

    if (v.crawler) this.crawlPose(v, z, time);

    // clawing up out of the dirt: arms reaching for the sky, then dragging up
    if (z.state === 'rising') {
      const k = Math.min(1, z.stateTime / this.cfg.zombie.riseTime);
      const claw = Math.sin(time * 9 + v.hunch * 10);
      v.armL.shoulder.rotation.set(-2.9 + claw * 0.25 + k * 1.2, 0, 0.3);
      v.armR.shoulder.rotation.set(-2.9 - claw * 0.25 + k * 1.2, 0, -0.3);
      v.armL.elbow.rotation.x = -0.4 - Math.max(0, claw) * 0.6;
      v.armR.elbow.rotation.x = -0.4 - Math.max(0, -claw) * 0.6;
      v.torso.rotation.x = 0.5 - k * 0.3;
      v.neck.rotation.x = -0.6;
    }

    // eyes glow a little brighter for sprinters
    v.glow.material.opacity = 0.9;
  }

  // legless: drag itself along the floor with alternating arms
  crawlPose(v, z, time) {
    const ph = v.phase * 1.4;
    const s = Math.sin(ph), moving = Math.min(1, z.moveSpeed / 0.3);
    v.hips.position.y = 0.2 + Math.abs(Math.sin(ph)) * 0.02 * moving;
    v.hips.rotation.set(0, s * 0.15 * moving, s * 0.08 * moving);
    v.torso.rotation.set(1.42, -s * 0.12 * moving, s * 0.1 * moving);
    v.neck.rotation.x = -1.0 + Math.sin(time * 1.1) * 0.08;
    v.legL.hip.rotation.x = 1.45 + s * 0.15 * moving;
    v.legR.hip.rotation.x = 1.45 - s * 0.15 * moving;
    const reach = -2.4;
    v.armL.shoulder.rotation.set(reach + s * 0.55 * moving, 0, 0.25);
    v.armR.shoulder.rotation.set(reach - s * 0.55 * moving, 0, -0.25);
    v.armL.elbow.rotation.x = -0.3 - Math.max(0, -s) * 0.7 * moving;
    v.armR.elbow.rotation.x = -0.3 - Math.max(0, s) * 0.7 * moving;
    if (z.attack.phase === 'windup' || z.attack.phase === 'recover') {
      v.armR.shoulder.rotation.x = reach - 0.6 + Math.sin(time * 14) * 0.3;
      v.neck.rotation.x = -1.3;
    }
  }

  updateCorpses(dt) {
    const gcfg = this.cfg.graphics;
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      const v = c.v;
      c.t += dt;
      const ft = Math.min(1, c.t / c.fallTime);
      const e = ft * ft; // accelerate like gravity
      if (c.crawler) {
        // already on the ground: just slump flat
        v.hips.position.y += (0.14 - v.hips.position.y) * Math.min(1, dt * 8);
        v.torso.rotation.x += (1.55 - v.torso.rotation.x) * Math.min(1, dt * 8);
        v.body.rotation.z = c.twist * e * 0.3;
      } else {
        v.body.rotation.x = c.dir * e * (Math.PI / 2 - 0.08);
        v.body.rotation.z = c.twist * e;
        v.body.position.y = e * 0.14;
      }
      if (c.t < 0.3) {
        v.root.position.x += c.kd.x * c.knockback * dt * 3;
        v.root.position.z += c.kd.z * c.knockback * dt * 3;
      }
      if (ft >= 1 && !c.bounced) { c.bounced = true; c.bounceT = 0; }
      if (c.bounced && c.bounceT < 0.25) { c.bounceT += dt; v.body.position.y = 0.14 + Math.sin(c.bounceT / 0.25 * Math.PI) * 0.04; }
      // go limp
      const limp = Math.min(1, c.t * 3);
      v.armL.shoulder.rotation.x += (c.armL * 1.5 - v.armL.shoulder.rotation.x) * limp * 0.2;
      v.armR.shoulder.rotation.x += (c.armR * 1.5 - v.armR.shoulder.rotation.x) * limp * 0.2;
      v.legL.knee.rotation.x += (c.legBend - v.legL.knee.rotation.x) * limp * 0.2;
      v.legR.knee.rotation.x += (c.legBend * 0.4 - v.legR.knee.rotation.x) * limp * 0.2;
      if (!c.crawler) v.torso.rotation.x *= 1 - limp * 0.2;
      v.neck.rotation.x += (c.dir * 0.5 - v.neck.rotation.x) * limp * 0.2;
      // sink and remove
      if (c.t > gcfg.corpseTime) {
        const st = (c.t - gcfg.corpseTime) / gcfg.corpseSinkTime;
        v.root.position.y = -st * 0.6;
        if (st >= 1) {
          this.scene.remove(v.root);
          this.corpses.splice(i, 1);
        }
      }
    }
  }

  clear() {
    for (const v of this.views.values()) this.scene.remove(v.root);
    for (const c of this.corpses) this.scene.remove(c.v.root);
    this.views.clear(); this.corpses.length = 0; this.prev.clear();
  }
}
