// =============================================================================
// Zombie rendering: procedural low-poly models, animation, dismemberment,
// corpses. Reads zombie state from the sim; never changes it.
// =============================================================================
import * as THREE from 'three';
const _drip = new THREE.Vector3();
import * as T from './textures.js';
import { zombieKit } from './zombieKit.js';
import { zombieModels } from './zombieModels.js';

const _v = new THREE.Vector3(), _q = new THREE.Quaternion();
const RIG_SPHERE = new THREE.Sphere(new THREE.Vector3(0, 90, 0), 170);   // generous, in model units
// green eye glow (both kinds of zombie)
const GLOW = { inner: 'rgba(170,255,140,1)', outer: 'rgba(40,255,60,0)', tint: 0x7dff5a };


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
    this.glowMat = new THREE.SpriteMaterial({ map: T.softDotTexture(GLOW.inner, GLOW.outer), color: GLOW.tint, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.9 });
    // the rigged models (Mixamo characters) load in the background
    this.models = zombieModels;
    this.models.load();

  }

  build(z) {
    if (this.models.ready && !this.simple) return this.buildRigged(z);   // (Settings › Zombie models: Simple skips the rigged ones)
    const r = (k) => hash(z.seed + k * 7919);
    const parts = this.kit.assemble(r, { scale: z.scale, outfit: z.defender || z.elite ? 'jersey' : null });
    const glow = new THREE.Sprite(this.glowMat);
    glow.scale.set(0.2, 0.09, 1);
    glow.position.set(0, 0.118, 0.1);
    parts.head.add(glow);
    if (z.elite) {
      // Erik's elite defenders carry the Schnitz's glow
      if (!this.eliteMat) this.eliteMat = new THREE.SpriteMaterial({ map: this.glowMat.map, color: new THREE.Color(0.3, 2.4, 0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
      const aura = new THREE.Sprite(this.eliteMat);
      aura.scale.set(1.6, 2.4, 1); aura.position.set(0, 1.0, 0);
      parts.root.add(aura);
    }
    if (z.infused) this.makeInfused(null, [], parts.root, 1);   // (the kit already built it at its scale)
    let spiritMeshes = null;
    if (z.ritual) {
      // the simple models get the ghostly blue too (their materials are cloned first)
      spiritMeshes = [];
      parts.root.traverse((o) => { if (o.isMesh && o.material && o.material.color) spiritMeshes.push(o); });
      this.makeSpirit(spiritMeshes, [glow], parts.root, 1);
    }
    this.scene.add(parts.root);
    return {
      id: z.id, ...parts, glow,
      spirit: !!z.ritual, infused: !!z.infused, meshes: spiritMeshes,
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


  // --- rigged (Mixamo) zombies --------------------------------------------------
  buildRigged(z) {
    const r = (k) => hash(z.seed + k * 7919);
    const t = this.models.pick(r(1));
    const inst = t.instance();
    inst.model.scale.setScalar(0.01 * z.scale);
    for (const m of inst.meshes) m.boundingSphere = RIG_SPHERE;
    // eye glow, hung off the head bone
    const head = inst.bones.Head;
    const glow = [];
    const size = (t.meta.eyeSize || 3) * 2.2;
    for (const e of t.meta.eyesLocal || []) {
      const g = new THREE.Sprite(this.glowMat);
      g.position.fromArray(e);
      g.scale.set(size, size * 0.7, 1);
      head.add(g);
      glow.push(g);
    }
    if (z.elite) {
      if (!this.eliteMat) this.eliteMat = new THREE.SpriteMaterial({ map: this.glowMat.map, color: new THREE.Color(0.3, 2.4, 0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
      const aura = new THREE.Sprite(this.eliteMat);
      aura.scale.set(1.6, 2.4, 1); aura.position.set(0, 1.0, 0);
      inst.root.add(aura);
    }
    if (z.ritual) this.makeSpirit(inst.meshes, glow, inst.root, size);
    if (z.infused) this.makeInfused(inst.meshes, glow, inst.root, z.scale);
    this.scene.add(inst.root);
    const mixer = new THREE.AnimationMixer(inst.model);
    const clips = this.models.clipsFor(t);
    const actions = {};
    for (const [name, clip] of Object.entries(clips)) actions[name] = mixer.clipAction(clip);
    for (const n of ['hit1Upper', 'hit2Upper']) if (actions[n]) { actions[n].setLoop(THREE.LoopOnce, 1); actions[n].clampWhenFinished = false; }
    const v = {
      id: z.id, rig: true, root: inst.root, inst, bones: inst.bones, mixer, actions, clips,
      glow: { visible: true }, glows: glow, eyes: [],
      cur: null, curName: null,
      phase: r(4) * Math.PI * 2, lastStepPhase: 0,
      limbs: { armL: true, armR: true, head: true, legs: true },
      crawler: false, type: z.type, seedR: r,
      skinMat: inst.meshes[0].material,
      offset: r(5),   // so they don't all move in step
      hitT: 0,
      spirit: !!z.ritual, infused: !!z.infused, meshes: inst.meshes,
    };
    this.play(v, 'idle', 0);
    return v;
  }

  // The Schnitz's infused zombies: twice the size, a sickly green cast and a
  // green glow all round them.
  makeInfused(meshes, glows, root, s) {
    if (!this.infusedAura) this.infusedAura = new THREE.SpriteMaterial({ map: this.glowMat.map, color: new THREE.Color(0.25, 2.2, 0.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 });
    for (const m of meshes || []) {
      const mat = m.material.clone();
      mat.color = mat.color.clone().multiply(new THREE.Color(0.8, 1.05, 0.75));
      if (!mat.emissiveMap) mat.emissive = new THREE.Color(0.02, 0.09, 0.02);
      m.material = mat;
    }
    for (const g of glows) g.scale.multiplyScalar(1.4);
    const aura = new THREE.Sprite(this.infusedAura);
    aura.scale.set(1.3 * s, 2.0 * s, 1); aura.position.set(0, 0.95 * s, 0);
    root.add(aura);
  }

  // The half-court ritual's zombies: tinted ghostly blue, eyes blazing blue.
  makeSpirit(meshes, glows, root, eyeSize) {
    if (!this.spiritGlow) {
      this.spiritGlow = new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(190,230,255,1)', 'rgba(40,120,255,0)'), color: new THREE.Color(0.6, 1.6, 4.0), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true });
      this.spiritAura = new THREE.SpriteMaterial({ map: this.spiritGlow.map, color: new THREE.Color(0.15, 0.45, 1.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 });
    }
    for (const m of meshes) {
      const mat = m.material.clone();
      mat.color = new THREE.Color(0.32, 0.52, 1.5);
      mat.emissive = new THREE.Color(0.03, 0.09, 0.3);
      if (mat.emissiveMap) mat.emissive = new THREE.Color(0.25, 0.6, 2.2);   // the eye map: blue now
      m.material = mat;
    }
    for (const g of glows) { g.material = this.spiritGlow; g.scale.multiplyScalar(1.6); }
    const aura = new THREE.Sprite(this.spiritAura);
    aura.scale.set(1.5, 2.3, 1); aura.position.set(0, 1.0, 0);
    root.add(aura);
    void eyeSize;
  }

  // A spirit zombie dies: it goes limp and floats up into the air, fading out.
  ascend(v, color = null) {
    if (v.meshes) for (const m of v.meshes) { m.material.transparent = true; m.material.depthWrite = false; }
    if (v.mixer) {
      v.mixer.stopAllAction();
      const a = v.actions.hit2 || v.actions.idle;
      if (a) { a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = 0.35; a.play(); }
    }
    this.corpses.push({ v, t: 0, spirit: true, spin: (Math.random() - 0.5) * 1.2, y0: v.root.position.y, color });
  }

  // crossfade to a looping clip
  play(v, name, fade = 0.25, speed = 1) {
    const a = v.actions[name];
    if (!a) return;
    a.timeScale = speed;
    if (v.curName === name) return;
    a.reset();
    a.time = (v.offset * a.getClip().duration) % a.getClip().duration;
    a.setEffectiveWeight(1);
    a.play();
    if (v.cur && fade > 0) v.cur.crossFadeTo(a, fade, false);
    else if (v.cur) v.cur.stop();
    v.cur = a; v.curName = name;
  }

  animateRigged(v, z, dt, time) {
    const speed = z.moveSpeed;
    const scale = z.scale || 1;
    // footsteps from distance covered (same rhythm as before)
    const stride = z.type === 'sprinter' ? 1.5 : z.type === 'runner' ? 1.25 : 0.75;
    v.phase += (speed / stride) * Math.PI * dt;
    const stepIdx = Math.floor(v.phase / Math.PI);
    if (stepIdx !== v.lastStepPhase && speed > 0.3 && this.onFootstep && !v.crawler) this.onFootstep(z, v);
    v.lastStepPhase = stepIdx;

    const clipSpeed = (n) => ((v.clips[n] && v.clips[n].meta && v.clips[n].meta.speed) || 100) * 0.01 * scale;
    const attacking = z.attack && (z.attack.phase === 'windup' || z.attack.phase === 'recover');
    if (z.attack && z.attack.phase === 'windup' && v.prevAtk !== 'windup' && v.curName === 'attack') v.cur.time = 0.15;   // each swing restarts the clip
    v.prevAtk = z.attack && z.attack.phase;
    // each walker keeps one of the two walks; most barrier work is reaching through
    if (!v.walkName) {
      const r = ((z.id * 2654435761) >>> 0) / 4294967296;
      v.walkName = v.clips.walk2 && r < 0.5 ? 'walk2' : 'walk';
      v.tearName = v.clips.reach && r * 7 % 1 < 0.75 ? 'reach' : 'punch';
    }
    if (v.crawler) {
      const k = speed > 0.05 ? Math.min(2.4, Math.max(0.5, speed / clipSpeed('crawl'))) : 0.3;
      this.play(v, 'crawl', 0.3, attacking ? 1.6 : k);
    } else if (z.state === 'rising') {
      this.play(v, 'attack', 0.2, 1.3);
    } else if (z.state === 'tearing') {
      this.play(v, v.tearName, 0.25, v.tearName === 'reach' ? (attacking ? 1.5 : 1.1) : 1.15);
    } else if (attacking) {
      this.play(v, 'attack', 0.15, 1.35);
    } else if (z.state === 'climbing') {
      this.play(v, 'walk', 0.2, 1.6);
    } else if (speed > 0.15) {
      if (z.type === 'sprinter') this.play(v, 'sprint', 0.3, Math.min(1.4, Math.max(0.75, speed / clipSpeed('sprint'))));
      else if (z.type === 'runner') this.play(v, 'run', 0.3, Math.min(1.5, Math.max(0.6, speed / clipSpeed('run'))));
      else this.play(v, v.walkName, 0.35, Math.min(2.2, Math.max(0.6, speed / clipSpeed(v.walkName))));
    } else {
      this.play(v, 'idle', 0.4, 1);
    }
    v.mixer.update(dt);
    // a lost limb stays lost whatever the animation does
    this.applyLostLimbs(v);
  }

  applyLostLimbs(v) {
    const B = v.bones, tiny = 0.001;
    if (!v.limbs.armL && B.LeftForeArm) B.LeftForeArm.scale.setScalar(tiny);
    if (!v.limbs.armR && B.RightForeArm) B.RightForeArm.scale.setScalar(tiny);
    if (!v.limbs.head && B.Head) B.Head.scale.setScalar(tiny);
    if (v.crawler) { if (B.LeftLeg) B.LeftLeg.scale.setScalar(tiny); if (B.RightLeg) B.RightLeg.scale.setScalar(tiny); }
  }

  hitRigged(v, part) {
    const name = Math.random() < 0.5 ? 'hit1Upper' : 'hit2Upper';
    const a = v.actions[name];
    if (!a) return;
    a.reset();
    a.time = 0.05;
    a.setEffectiveWeight(part === 'head' ? 0.9 : 0.6);
    a.fadeOut(0.45);
    a.play();
  }

  loseLimbRigged(v, limb, dir) {
    if (!v.limbs[limb]) return;
    v.limbs[limb] = false;
    const d = dir || { x: 0, y: 0, z: 1 };
    const B = v.bones;
    v.root.updateMatrixWorld(true);
    if (limb === 'legs') {
      v.crawler = true;
      for (const b of [B.LeftLeg, B.RightLeg]) {
        if (!b) continue;
        b.getWorldPosition(_v);
        this.effects.bloodBurst(_v.clone(), d, 22, 1.1);
        this.effects.gibs(_v.clone(), d, 3, this.goreMat, v.skinMat);
      }
    } else if (limb === 'head') {
      if (!B.Head) return;
      B.Head.getWorldPosition(_v); _v.y += 0.08;
      for (const g of v.glows) g.visible = false;
      this.effects.bloodBurst(_v.clone(), d, 40, 1.4);
      this.effects.gibs(_v.clone(), d, 6, this.goreMat, v.skinMat);
      if (B.Neck) this.effects.bloodSpurt(B.Neck, 1.2);
    } else {
      const b = limb === 'armL' ? B.LeftForeArm : B.RightForeArm;
      if (!b) return;
      b.getWorldPosition(_v);
      this.effects.bloodBurst(_v.clone(), d, 24, 1.0);
      this.effects.gibs(_v.clone(), d, 3, this.goreMat, v.skinMat);
      this.effects.bloodSpurt(b.parent, 0.6);
    }
    this.applyLostLimbs(v);
  }

  explodeRigged(v, e) {
    const d = e.dir || { x: 0, y: 1, z: 0 };
    (v.bones.Spine1 || v.root).getWorldPosition(_v);
    this.effects.bloodBurst(_v.clone(), d, 70, 1.8);
    this.effects.gibs(_v.clone(), d, 16, this.goreMat, v.skinMat);
    this.scene.remove(v.root);
    const p = v.root.position;
    for (let i = 0; i < 3; i++) this.effects.bloodDecal(new THREE.Vector3(p.x + (Math.random() - 0.5) * 2, 0, p.z + (Math.random() - 0.5) * 2), new THREE.Vector3(0, 1, 0), 0.8 + Math.random() * 0.8);
  }

  corpseRigged(v, e) {
    if (e.kind === 'explosive' && e.force > 0.55) { this.explodeRigged(v, e); return; }
    const d = e.dir || { x: 0, y: 0, z: 0 };
    const yaw = v.root.rotation.y;
    const fwdX = Math.sin(yaw), fwdZ = Math.cos(yaw);
    const fromFront = d.x * fwdX + d.z * fwdZ < 0;   // the shot came at its face: it goes over backwards
    if (e.headshot && v.limbs.head) this.loseLimbRigged(v, 'head', e.dir);
    for (const g of v.glows) g.visible = false;
    let name;
    if (v.crawler) name = null;
    else if (e.kind === 'explosive' || e.fling) name = 'deathFly';
    else if (fromFront) name = ['death1', 'deathBack', 'death1'][Math.floor(Math.random() * 3)];
    else name = Math.random() < 0.5 ? 'death2' : 'deathFront';
    v.mixer.stopAllAction();
    if (name && v.actions[name]) {
      const a = v.actions[name];
      a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
      a.timeScale = e.kind === 'knife' ? 1.35 : 1.6;
      a.play();
      a.time = a.getClip().duration * 0.12;   // skip the wind-up: they drop
    }
    this.corpses.push({ v, t: 0, rig: true, kd: { x: d.x, z: d.z }, knockback: e.kind === 'knife' ? 0.15 : 0.25, fling: this.flingOf(v, e) });
    if (e.fling) return;   // the blood comes when it lands
    const p = v.root.position;
    const off = (fromFront ? 1 : -1) * 0.7;
    if (e.kind !== 'electric') this.effects.bloodPool(new THREE.Vector3(p.x - fwdX * off + d.x * 0.3, 0, p.z - fwdZ * off + d.z * 0.3), (0.9 + Math.random() * 0.7) * (v.root.children[0].scale.x * 100));
  }

  // match a fresh view to limbs already lost in the sim (no effects)
  syncLimbs(v, z) {
    if (v.rig) {
      if (z.crawler) { v.crawler = true; v.limbs.legs = false; }
      for (const a of ['armL', 'armR', 'head']) if (z.limbs && z.limbs[a] === false) v.limbs[a] = false;
      if (!v.limbs.head) for (const g of v.glows) g.visible = false;
      this.applyLostLimbs(v);
      return;
    }
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
      if (v.rig) this.hitRigged(v, e.part);
      else v.flinchVel += e.part === 'head' ? 9 : 5;
    } else if (e.type === 'zombieLimb' && v) {
      if (v.rig) this.loseLimbRigged(v, e.limb, e.dir);
      else this.loseLimb(v, e.limb, e.dir);
    } else if (e.type === 'zombieSwing' && v) {
      v.swing = 0.0001;
    } else if (e.type === 'zombieKilled' && v) {
      this.views.delete(e.id);
      this.prev.delete(e.id);
      this.makeCorpse(v, e);
    } else if (e.type === 'zombieBanished' && v) {
      // a ritual spirit whose circle went out (or filled): it just floats away
      this.views.delete(e.id);
      this.prev.delete(e.id);
      this.eyesOut(v);
      // (spirits float off blue; The Schnitz's giants, after the fifty, go up in green)
      if (v.spirit || v.infused) this.ascend(v, v.infused ? [0.6, 4, 0.8] : null); else this.scene.remove(v.root);
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

  // Thrown by the wind: a ballistic arc to where the sim says it can land,
  // tumbling end over end on the way.
  flingOf(v, e) {
    const f = e.fling;
    if (!f) return null;
    const g = 14;
    const T = Math.sqrt(8 * f.up / g);
    v.root.rotation.order = 'YXZ';
    return { from: v.root.position.clone(), x: f.x, z: f.z, dist: f.dist, T, vy: 0.5 * g * T, g, t: 0, flips: f.dist > 6 ? 1 : 0.5, landed: false };
  }

  // one step of a thrown corpse; true once it's on the ground
  fly(c, v, dt) {
    const F = c.fling;
    if (F.landed) return true;
    F.t += dt;
    const k = Math.min(1, F.t / F.T);
    v.root.position.set(F.from.x + F.x * F.dist * k, Math.max(0, F.from.y + F.vy * F.t - 0.5 * F.g * F.t * F.t), F.from.z + F.z * F.dist * k);
    v.root.rotation.x = F.flips >= 1 ? -Math.PI * 2 * k : -k * 0.6;   // big throws go end over end
    if (k >= 1) {
      F.landed = true;
      v.root.position.y = 0;
      v.root.rotation.x = 0;
      const p = v.root.position;
      this.effects.bloodPool(new THREE.Vector3(p.x, 0, p.z), 0.9 + Math.random() * 0.6);
      this.effects.puff(new THREE.Vector3(p.x, 0.2, p.z), { color: 0x6a6052, size: 0.5, grow: 2.5, life: 1, alpha: 0.35 });
      if (this.onLand) this.onLand(p);
    }
    return F.landed;
  }

  // Dead: the eyes go out the instant it dies. The glow sprites switch off and
  // the eyes' glowing material swaps for a dark copy (shared per material).
  eyesOut(v) {
    if (v.eyesOut) return;
    v.eyesOut = true;
    if (v.glow) v.glow.visible = false;
    for (const g of v.glows || []) g.visible = false;
    for (const eye of v.eyes || []) if (eye.material) eye.material = this.deadEyeMat(eye.material);
    for (const m of v.meshes || []) if (m.material && m.material.emissiveMap) m.material = this.deadEyeMat(m.material);
  }

  deadEyeMat(mat) {
    if (mat.userData.deadEye) return mat;
    const cache = this.deadEyes || (this.deadEyes = new WeakMap());
    let d = cache.get(mat);
    if (!d) {
      d = mat.clone();
      d.emissive = new THREE.Color(0, 0, 0);
      d.emissiveIntensity = 0;
      d.userData.deadEye = true;
      cache.set(mat, d);
    }
    return d;
  }

  makeCorpse(v, e) {
    this.eyesOut(v);
    if (v.spirit) { this.ascend(v); return; }
    if (v.rig) { this.corpseRigged(v, e); return; }
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
      fling: this.flingOf(v, e),
    });
    if (e.fling) return;
    if (e.headshot && v.limbs.head) this.loseLimb(v, 'head', e.dir);
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
      if (v.rig) this.animateRigged(v, z, dt, time);
      else this.animate(v, z, dt, time);
      // the badly hurt leave a trail of drips
      const lost = !v.limbs.head || !v.limbs.armL || !v.limbs.armR || v.crawler;
      if (z.maxHealth && (z.health < z.maxHealth * 0.55 || lost)) {
        v.dripT = (v.dripT ?? Math.random()) - dt * (lost ? 2.5 : 1);
        if (v.dripT <= 0) {
          v.dripT = 0.35 + Math.random() * 0.6;
          const src = v.rig ? ((!v.limbs.armL ? v.bones.LeftArm : !v.limbs.armR ? v.bones.RightArm : !v.limbs.head ? v.bones.Neck : v.bones.Spine1) || v.root) : !v.limbs.armL ? v.armL.stump : !v.limbs.armR ? v.armR.stump : v.torso;
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
      if (c.spirit) {
        // up, up and away, slowly turning, fading out in a trail of blue sparks
        if (v.mixer) v.mixer.update(dt);
        const k = c.t / 3.2;
        v.root.position.y = c.y0 + k * k * 5 + k * 1.2;
        v.root.rotation.y += c.spin * dt;
        if (v.meshes) for (const m of v.meshes) m.material.opacity = Math.max(0, 1 - k * 1.1);
        if (Math.random() < dt * 20) {
          const p = v.root.position.clone(); p.y += 0.6 + Math.random() * 1.2; p.x += (Math.random() - 0.5) * 0.5; p.z += (Math.random() - 0.5) * 0.5;
          this.effects.spawnParticle(p, new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.6 + Math.random(), (Math.random() - 0.5) * 0.3), { life: 0.9, size: 0.014, color: c.color || [0.5, 1.4, 4], gravity: -1, drag: 0.4 });
        }
        if (k >= 1) { this.scene.remove(v.root); this.corpses.splice(i, 1); }
        continue;
      }
      if (c.rig) {
        // the death clip does the falling; slide back a touch, then sink and go
        v.mixer.update(dt);
        this.applyLostLimbs(v);
        if (c.fling && !this.fly(c, v, dt)) continue;
        if (c.t < 0.3 && !c.fling) { v.root.position.x += c.kd.x * c.knockback * dt * 3; v.root.position.z += c.kd.z * c.knockback * dt * 3; }
        if (c.t > gcfg.corpseTime) {
          const st = (c.t - gcfg.corpseTime) / gcfg.corpseSinkTime;
          v.root.position.y = -st * 0.6;
          if (st >= 1) { this.scene.remove(v.root); this.corpses.splice(i, 1); }
        }
        continue;
      }
      if (c.fling && !this.fly(c, v, dt)) {
        // limp and spread-eagled in the air
        v.armL.shoulder.rotation.z = 1.2; v.armR.shoulder.rotation.z = -1.2;
        v.legL.knee.rotation.x = 0.5; v.legR.knee.rotation.x = 0.2;
        continue;
      }
      if (c.fling && !c.flingDone) { c.flingDone = true; c.t = 0; c.knockback = 0; }
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
