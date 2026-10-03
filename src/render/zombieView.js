// =============================================================================
// Zombie rendering: procedural low-poly models, animation, dismemberment,
// corpses. Reads zombie state from the sim; never changes it.
// =============================================================================
import * as THREE from 'three';
const _drip = new THREE.Vector3();
import * as T from './textures.js';
import { zombieKit } from './zombieKit.js';


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

    // shared resources: bodies and heads come from the kit (built on first use)
    this.kit = zombieKit;
    this.goreMat = new THREE.MeshStandardMaterial({ color: '#4a0808', roughness: 0.5 });
    this.glowMat = new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,170,60,1)', 'rgba(255,90,0,0)'), color: 0xffb040, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.9 });

  }

  build(z) {
    const r = (k) => hash(z.seed + k * 7919);
    const parts = this.kit.assemble(r, { scale: z.scale });
    const glow = new THREE.Sprite(this.glowMat);
    glow.scale.set(0.2, 0.09, 1);
    glow.position.set(0, 0.118, 0.1);
    parts.head.add(glow);
    this.scene.add(parts.root);
    return {
      id: z.id, ...parts, glow,
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
    const off = (fromFront ? 1 : -1) * 0.7;
    if (e.kind !== 'electric') this.effects.bloodPool(new THREE.Vector3(p.x - fwdX * off + d.x * 0.3, 0, p.z - fwdZ * off + d.z * 0.3), (0.9 + Math.random() * 0.7) * v.root.scale.x);
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
      // the badly hurt leave a trail of drips
      const lost = !v.limbs.head || !v.limbs.armL || !v.limbs.armR || v.crawler;
      if (z.maxHealth && (z.health < z.maxHealth * 0.55 || lost)) {
        v.dripT = (v.dripT ?? Math.random()) - dt * (lost ? 2.5 : 1);
        if (v.dripT <= 0) {
          v.dripT = 0.35 + Math.random() * 0.6;
          const src = !v.limbs.armL ? v.armL.stump : !v.limbs.armR ? v.armR.stump : v.torso;
          src.getWorldPosition(_drip);
          this.effects.bloodDrip(_drip);
        }
      }
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
    v.jaw.rotation.x = 0.12 + Math.max(0, Math.sin(time * 3.1 + v.hunch * 20)) * 0.22;

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
