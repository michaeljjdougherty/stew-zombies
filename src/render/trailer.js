// =============================================================================
// The Call of the Crust trailer: a scripted camera sequence run in the real
// game on the real map (Main menu > Watch Trailer). The crew, Big Evil Zach,
// zombies, guns, hammers, perk machines and explosions are the game's own,
// posed and moved shot by shot. Timings, shot order and the words on screen
// are all in CONFIG.trailer (everything after the drop is counted in beats from
// it, so moving the drop moves it all); each shot's choreography is here, in
// SHOTS. Plays through the renderer's cutscene slot, like the intro.
//   update(dt, time) -> the scene to draw; this.t is where it's at (seconds)
// =============================================================================
import * as THREE from 'three';
import { Teammate } from './teammates.js';
import { buildEvilZach } from './evilZach.js';
import { makeZombie } from '../sim/zombies.js';
import * as T from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const CREW = ['rocco', 'brian', 'ryan', 'kearns', 'pit'];
const ELEMENT = { fire: '#ff6a1a', ice: '#8fe4ff', wind: '#d8f0e0', lightning: '#b98aff' };

// When each shot and card starts (seconds), from the config.
export function trailerTimes(cfg) {
  const B = 60 / cfg.bpm;
  const at = (o) => (o.beat != null ? cfg.drop + o.beat * B : o.at);
  const len = (o) => (o.beats != null ? o.beats * B : o.len);
  const shots = cfg.shots.map((s) => ({ ...s, t0: at(s) }));
  shots.forEach((s, i) => { s.t1 = i + 1 < shots.length ? shots[i + 1].t0 : cfg.end; });
  const cards = cfg.cards.map((c) => ({ ...c, t0: at(c), t1: at(c) + len(c) }));
  return { beat: B, shots, cards };
}

export class Trailer {
  constructor(renderer, sim, cfg) {
    this.R = renderer;
    this.sim = sim;
    this.cfg = cfg;
    this.C = cfg.trailer;
    this.times = trailerTimes(this.C);
    this.t = 0;
    this.done = false;
    this.slow = 1;
    this.fov = 50;
    this.scene = renderer.scene;
    this.cam = renderer.camera;
    this.map = renderer.map;
    this.fx = renderer.effects;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.savedFar = this.cam.far;
    this.terrains = sim.mapData.terrains || [];
    this.shake = 0;
    this.shot = null;
    this.ix = -1;
    this.fired = new Map();
    this.zs = [];
    // the crew, each with their gun
    this.crew = {};
    for (const id of CREW) {
      const p = { id: 'tr_' + id, name: id, character: id, alive: true, downed: null, crouching: false, sprinting: false, melee: { timer: 0 }, drinking: null, throwing: null, loadout: { current: 0, reloading: false, slots: [{ id: this.C.loadout[id] }] } };
      const tm = new Teammate(this.group, p, cfg);
      tm.tag.visible = false;
      this.crew[id] = { id, p, tm, pos: V(0, -200, 0), yaw: 0, pitch: 0, on: false, slide: 0, hammer: null };
    }
    // Big Evil Zach
    this.zach = buildEvilZach({ detail: 0.8 });
    this.group.add(this.zach.root);
    for (const s of this.zach.eyeGlows) s.material.fog = false;
    this.zach.aura.material.fog = false;
    this.zachLight = this.map.addVirtualLight({ x: 0, y: -100, z: 0 }, 0x50ff70, 14, 12, 1.4);
    this.zachLight.live = true; this.zachLight.noDim = true;
    this.zachBase = this.zach.root.scale.x;
    // the hammers, one per element
    this.hammers = {};
    for (const el of Object.keys(ELEMENT)) this.hammers[el] = buildHammer(el);
    // the perk machines (built by the machines view, switched on by hand)
    this.perks = [];
    this.buildPerks();
    // a soft glow sprite for roars and charges
    this.glowTex = T.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  }

  // --- where things stand -------------------------------------------------------
  gy(x, z) {
    for (const t of this.terrains) if (t.contains(x, z)) return t.heightAt(x, z);
    return 0;
  }

  // Put a crew member somewhere (and leave everyone else as they were).
  pose(id, o) {
    const a = this.crew[id];
    a.on = true;
    if (o.x != null) a.pos.set(o.x, o.y ?? this.gy(o.x, o.z), o.z);
    if (o.yaw != null) a.yaw = o.yaw;
    a.pitch = o.pitch ?? 0;
    a.p.sprinting = !!o.sprint;
    a.p.crouching = !!o.crouch || !!o.slide;
    a.slide = o.slide ? 1 : 0;
    a.p.loadout.reloading = !!o.reload;
    if (o.gun) a.p.loadout.slots[0].id = o.gun;
    return a;
  }
  face(id, x, z) { const a = this.crew[id]; a.yaw = Math.atan2(-(x - a.pos.x), -(z - a.pos.z)); return a.yaw; }
  hide(id) { this.crew[id].on = false; }

  // Fire a crew member's gun at a point: flash, smoke, tracer, a hit.
  fire(id, to, every = 0.09) {
    const a = this.crew[id];
    const key = id + '|' + (this.shot && this.shot.id);
    const last = this.fired.get(key) ?? -1;
    if (this.u - last < every && this.u >= last) return;
    this.fired.set(key, this.u);
    const m = a.tm.muzzle();
    if (!m) return;
    const from = m.clone(), dir = to.clone().sub(from).normalize();
    this.fx.muzzle(from);
    this.fx.muzzleSmoke(from, dir, 1, false);
    const end = to.clone().add(V((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3));
    this.fx.tracer(from, end);
    this.fx.zombieHit(end, dir, Math.random() < 0.3 ? 'head' : 'torso');
  }

  // Zombies: made fresh for each shot (so each island gets its own kind).
  zombie(x, z, o = {}) {
    const zz = makeZombie(this.sim, { type: o.type || (this.zs.length % 3 ? 'walker' : 'runner'), pos: { x, y: o.y ?? this.gy(x, z), z }, yaw: o.yaw ?? 0, health: 100, state: 'chase' });
    zz.trailer = true;
    this.sim.zombies.push(zz);
    this.zs.push(zz);
    return zz;
  }
  moveZ(zz, x, z, o = {}) {
    const dx = x - zz.pos.x, dz = z - zz.pos.z, d = Math.hypot(dx, dz);
    zz.moveSpeed = o.speed ?? (this.dt > 0 ? Math.min(6, d / this.dt) : 0);
    zz.pos.x = x; zz.pos.z = z; zz.pos.y = o.y ?? this.gy(x, z);
    if (o.yaw != null) zz.yaw = o.yaw; else if (d > 1e-4) zz.yaw = Math.atan2(dx, dz);
    zz.attack.phase = o.attack ? 'windup' : 'none';
  }
  // ...and knock them flying
  kill(zz, from, o = {}) {
    if (zz.dead) return;
    zz.dead = true;
    const dx = zz.pos.x - from.x, dz = zz.pos.z - from.z, L = Math.hypot(dx, dz) || 1;
    const e = { type: 'zombieKilled', id: zz.id, pos: { ...zz.pos }, dir: { x: dx / L, y: 0.3, z: dz / L }, kind: o.kind || 'explosive', force: 1, headshot: false };
    if (o.fling !== false) e.fling = { x: dx / L, z: dz / L, dist: o.dist ?? 6 + Math.random() * 4, up: o.up ?? 2.5 + Math.random() * 2 };
    this.R.onEvents([e]);
    const i = this.sim.zombies.indexOf(zz);
    if (i >= 0) this.sim.zombies.splice(i, 1);
  }
  clearZombies() {
    for (const zz of this.zs) { const i = this.sim.zombies.indexOf(zz); if (i >= 0) this.sim.zombies.splice(i, 1); }
    this.zs = [];
    this.R.zombies.clear();
  }

  // Big Evil Zach: where, how big, his head and arms
  zachAt(x, z, o = {}) {
    const Z = this.zach;
    Z.root.visible = true;
    Z.root.position.set(x, (o.y ?? this.gy(x, z)), z);
    Z.root.rotation.y = o.yaw ?? 0;
    Z.root.scale.setScalar(this.zachBase * (o.size ?? 1));
    Z.head.rotation.set(o.headX ?? -0.24, o.headY ?? 0, 0);
    Z.torso.rotation.set(o.lean ?? 0.2, 0, 0);
    for (const [arm, s] of [[Z.armL, 1], [Z.armR, -1]]) { arm.shoulder.rotation.set(-0.25, 0, s * 0.24); arm.elbow.rotation.set(-0.45, 0, 0); }
    Z.legL.hip.rotation.set(0, 0, 0); Z.legR.hip.rotation.set(0, 0, 0); Z.legL.knee.rotation.set(0.05, 0, 0); Z.legR.knee.rotation.set(0.05, 0, 0);
    const eye = Z.root.position.clone().add(V(0, 4.3 * (o.size ?? 1), 0));
    this.zachLight.pos.copy(eye).add(V(0, -1, 0)); this.zachLight.level = 1;
    return Z;
  }

  // A War Hammer in someone's hands (in place of their gun), or back to the gun.
  giveHammer(id, el) {
    const a = this.crew[id], tm = a.tm;
    if (a.hammer === el) return;
    this.takeHammer(id);
    tm.update(a.p, a.pos, a.yaw, 0, 0, this.t, this.cam);   // (make sure the gun's built)
    const H = this.hammers[el];
    tm.holder.add(H.group);
    tm.gun.group.visible = false;
    a.savedGrip = tm.leftGrip; tm.leftGrip = H.grip;
    a.hammer = el;
  }
  takeHammer(id) {
    const a = this.crew[id];
    if (!a.hammer) return;
    const H = this.hammers[a.hammer];
    if (H.group.parent) H.group.parent.remove(H.group);
    a.tm.gun.group.visible = true;
    a.tm.leftGrip = a.savedGrip;
    a.hammer = null;
  }
  hammerHead(id) { const a = this.crew[id]; return this.hammers[a.hammer].head.getWorldPosition(V(0, 0, 0)); }

  // The element going off where a hammer lands.
  burst(el, pos, dir) {
    const fx = this.fx, p = pos.clone(); p.y = Math.max(p.y, this.gy(p.x, p.z) + 0.2);
    if (el === 'fire') { fx.explosion(p, 4); fx.energyBurst(p, ELEMENT.fire, 3.4); }
    if (el === 'ice') {
      fx.energyBurst(p, ELEMENT.ice, 3.6);
      for (let i = 0; i < 10; i++) fx.puff(p.clone().add(V((Math.random() - 0.5) * 4, Math.random() * 1.2, (Math.random() - 0.5) * 4)), { color: 0xdff4ff, size: 0.9, grow: 2.4, life: 1.4, alpha: 0.7, vel: V(0, 0.4, 0), shade: false });
    }
    if (el === 'wind') { fx.windBlast(p.clone().add(V(0, 1, 0)), dir || V(0, 0, -1), 14, 34); fx.energyBurst(p, ELEMENT.wind, 2.6); }
    if (el === 'lightning') { fx.lightning(p); fx.energyBurst(p, ELEMENT.lightning, 3.2); this.R.flash = Math.max(this.R.flash || 0, 0.5); }
    this.shake = Math.max(this.shake, 1);
  }

  buildPerks() {
    const mv = this.R.machines;
    const saved = mv.cfg;
    const list = { ...saved.perks.list };
    for (const pk of this.C.perks) list[pk.key] = { name: pk.name, color: pk.color, glyph: pk.glyph, power: false, cost: 0, desc: '' };
    mv.cfg = { ...saved, perks: { ...saved.perks, list } };
    const spots = [[147.2, -6.4], [150.4, -6.4]];
    this.C.perks.forEach((pk, i) => {
      const n = mv.perks.length;
      const [x, z] = spots[i];
      mv.buildPerk({ perk: pk.key, center: { x, z }, normal: { x: 0, z: 1 } });
      const pv = mv.perks[n];
      pv.force = false;
      pv.trailer = true;
      pv.g.position.y = 0;
      pv.base = this.gy(x, z);
      this.perks.push(pv);
    });
    mv.cfg = saved;
  }

  // --- the camera ---------------------------------------------------------------
  look(px, py, pz, tx, ty, tz, fov = 50, roll = 0) {
    const s = this.shake;
    const n = (k) => Math.sin(this.t * (37 + k * 11) + k * 2.1) * 0.6 + Math.sin(this.t * (53 + k * 7)) * 0.4;
    this.cam.position.set(px + n(1) * s * 0.12, py + n(2) * s * 0.1, pz + n(3) * s * 0.12);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(tx, ty, tz);
    if (roll || s) this.cam.rotateZ(roll + n(4) * s * 0.012);
    this.fov = fov;
  }
  // a camera on a path: from a to b (each [px,py,pz,tx,ty,tz]) over k
  path(a, b, k, fov = 50, roll = 0) {
    const e = k;
    this.look(...a.slice(0, 3).map((v, i) => lerp(v, b[i], e)), ...a.slice(3, 6).map((v, i) => lerp(v, b[i + 3], e)), fov, roll);
  }

  skip() { if (this.t < this.C.end - 3) this.t = this.times.cards.find((c) => c.style === 'title').t0; }

  // --- each frame ---------------------------------------------------------------
  update(dt, time) {
    this.t += dt;
    this.dt = dt;
    const t = this.t;
    if (t >= this.C.end) this.done = true;
    // which shot
    const S = this.times.shots;
    let ix = 0;
    while (ix + 1 < S.length && t >= S[ix + 1].t0) ix++;
    if (ix !== this.ix) this.enter(ix);
    const sh = S[ix];
    this.u = t - sh.t0;
    const d = sh.t1 - sh.t0;
    this.shake = Math.max(0, this.shake - dt * 3);
    this.slow = 1;
    this.far = 260;          // (a shot that needs to see further says so)
    this.cullD = 120;
    this.black = sh.id === 'black';
    const fn = SHOTS[sh.id];
    if (fn && fn.frame) fn.frame(this, this.u, d, Math.min(1, this.u / d));
    if (this.cam.far !== this.far) { this.cam.far = this.far; this.cam.updateProjectionMatrix(); }
    this.cullFar(this.far < 1000 ? Math.min(this.far, this.cullD ?? 120) : 0);
    // pose the crew and send the sprites home
    for (const a of Object.values(this.crew)) {
      a.tm.root.visible = a.on;
      if (!a.on) { a.tm.tag.visible = false; continue; }
      a.tm.update(a.p, a.pos, a.yaw, a.pitch, dt * this.slow, time, this.cam);
      a.tm.tag.visible = false;
      const k = a.tm.k;
      if (a.slide) {
        // a slide: down low, leaning back, the front leg out
        k.hips.position.y = 0.42; k.torso.rotation.x = -0.45;
        k.legL.hip.rotation.x = -1.35; k.legL.knee.rotation.x = 0.15;
        k.legR.hip.rotation.x = -0.6; k.legR.knee.rotation.x = 1.6;
      }
    }
    this.zach.update(dt * this.slow, time);
    // perk machines: hold them still on the ground
    for (const pv of this.perks) pv.g.position.y = pv.base + (pv.shake > 0 ? Math.sin(time * 60) * 0.01 : 0);
    // the air: this island's fog, or the shot's own
    const air = this.map.crust && this.map.crust.air;
    if (air) {
      this.scene.fog.color.copy(this.fogColor || air.fog);
      this.scene.fog.density = this.fogDensity ?? air.density;
      this.scene.background = this.scene.fog.color;
    }
    return this.scene;
  }

  // Skip drawing the far side of the map: anything (but the big stuff) further
  // than d from the camera (0: draw everything). The renderer is slow enough
  // recording frame by frame without the islands you can't see anyway.
  cullFar(d) {
    if (!this.cullList) {
      this.cullList = [];
      this.map.group.traverse((o) => { if ((o.isMesh || o.isPoints) && o.geometry) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); this.cullList.push(o); } });
    }
    const c = this.tmpV || (this.tmpV = new THREE.Vector3()), eye = this.cam.position;
    for (const o of this.cullList) {
      let far = false;
      if (d > 0) {
        const s = o.geometry.boundingSphere;
        c.copy(s.center).applyMatrix4(o.matrixWorld);
        far = c.distanceTo(eye) - s.radius * o.matrixWorld.getMaxScaleOnAxis() > d;
      }
      if (far && o.visible) { o.visible = false; o.userData.trCulled = true; }
      else if (!far && o.userData.trCulled) { o.visible = true; o.userData.trCulled = false; }
    }
  }

  enter(ix) {
    this.ix = ix;
    const sh = this.times.shots[ix];
    this.shot = sh;
    // a hard cut: a clean slate
    for (const id of CREW) { this.takeHammer(id); this.hide(id); this.crew[id].slide = 0; }
    this.zach.root.visible = false;
    this.zachLight.level = 0;
    this.clearZombies();
    this.fx.clear();
    for (const pv of this.perks) { pv.force = false; pv.level = 0; }
    this.fogColor = null; this.fogDensity = null;
    if (this.cullList) { this.cullFar(0); this.cullList = null; }   // (models may have loaded since)
    this.fired.clear();
    this.shake = 0;
    this.u = 0;
    const fn = SHOTS[sh.id];
    if (fn && fn.enter) fn.enter(this, sh);
  }

  dispose() {
    this.cullFar(0);
    this.clearZombies();
    this.fx.clear();
    for (const id of CREW) { this.takeHammer(id); this.crew[id].tm.dispose(this.group); }
    this.scene.remove(this.group);
    this.map.removeVirtualLight(this.zachLight);
    const mv = this.R.machines;
    for (const pv of this.perks) { mv.group.remove(pv.g); this.map.removeVirtualLight(pv.v); const i = mv.perks.indexOf(pv); if (i >= 0) mv.perks.splice(i, 1); }
    this.cam.far = this.savedFar;
    this.cam.updateProjectionMatrix();
  }
}

// A War Hammer: a long iron haft, a heavy head bound in its element's glow.
function buildHammer(el) {
  const g = new THREE.Group();
  const col = new THREE.Color(ELEMENT[el]);
  const iron = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.45, metalness: 0.85 });
  const wood = new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.8 });
  const glow = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.2), toneMapped: false });
  const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.0, 10).rotateX(Math.PI / 2), wood);
  haft.position.z = 0.32; g.add(haft);
  const head = new THREE.Group(); head.position.z = 0.82; g.add(head);
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.17, 0.17), iron); head.add(block);
  for (const s of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.2), iron); face.position.x = s * 0.18; head.add(face);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.175, 0.175), glow); band.position.x = s * 0.1; head.add(band);
  }
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), glow); core.position.y = 0.09; head.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  halo.scale.setScalar(0.7); head.add(halo);
  const grip = new THREE.Object3D(); grip.position.z = 0.3; g.add(grip);
  return { group: g, head, grip };
}

// =============================================================================
// The shots. enter(T) sets the stage; frame(T, u, d, k): u seconds into the
// shot, d its length, k = u / d.
// =============================================================================
const run = (T, id, x0, z0, x1, z1, k, o = {}) => { T.pose(id, { x: lerp(x0, x1, k), z: lerp(z0, z1, k), sprint: o.sprint ?? true, ...o }); T.face(id, x1 + (x1 - x0), z1 + (z1 - z0)); };

export const SHOTS = {
  black: {},

  // Out in space: a slow push in toward the islands, drifting in their clouds.
  space: {
    frame(T, u, d, k) {
      T.fogDensity = 0.0004; T.far = 1600;
      const e = sm(0, 1, k);
      T.path([150, 95, 440, 10, -10, -20], [52, 34, 150, 0, -2, -40], e, 46, -0.04);
    },
  },

  // Zach in the dark of the forge pit, still; the camera tilts from his boots to
  // his face, and his head turns to it.
  zachReveal: {
    enter(T) { T.zachAt(0, 13.5, { yaw: Math.PI / 2, headY: 0 }); },
    frame(T, u, d, k) {
      const Z = T.zachAt(0, 13.5, { yaw: Math.PI / 2 + 0.1, headY: -1.25 * sm(0.72, 0.98, k), headX: -0.2 });
      void Z;
      T.fogColor = new THREE.Color('#0a0c0a'); T.fogDensity = 0.03;
      const ty = lerp(0.6, 4.4, sm(0.05, 0.75, k));
      T.look(lerp(1.6, 1.2, k), 0.35, 19.6, 0, ty, 13.5, 42);
    },
  },

  // The Research Base, empty and quiet: the red mast, the labs, the dome.
  basePan: {
    frame(T, u, d, k) {
      T.path([136, 9, -44, 168, 6, -14], [142, 9, 30, 178, 8, 4], sm(0, 1, k), 48);
    },
  },

  // The five walk out of the fog toward you; Zach's glow looms far behind them.
  squadFog: {
    enter(T) { T.zachAt(150, 0, { yaw: -Math.PI / 2, size: 1.4, headX: -0.1 }); },
    frame(T, u, d, k) {
      T.fogColor = new THREE.Color('#2a302e'); T.fogDensity = 0.055;
      T.zachAt(150, 0, { yaw: -Math.PI / 2, size: 1.4, headX: -0.1 });
      CREW.forEach((id, i) => {
        const x = lerp(127, 123.5, k) + Math.abs(i - 2) * 0.6, z = (i - 2) * 1.5;
        T.pose(id, { x, z, pitch: -0.25 });
        T.crew[id].yaw = Math.PI / 2;   // walking -x, toward the camera
        T.crew[id].p.sprinting = false;
      });
      T.look(114.5, 1.25, 0.4, 126, 1.5, 0, 44);
    },
  },

  // The drop: sweeping in over the forge's wall, down into the pit; the crew
  // running across it with zombies on their heels.
  hubFly: {
    enter(T) { for (let i = 0; i < 7; i++) T.zombie(-12 - i * 1.3, 4 + (i % 3) * 1.6, { type: 'runner' }); },
    frame(T, u, d, k) {
      T.far = 420;
      const e = ease(k);
      T.path([46, 30, 46, 0, 2, 0], [14, 4.5, 16, -2, 1.5, 4], e, 55);
      CREW.forEach((id, i) => run(T, id, -9 + i * 0.4, 3 + i * 1.1, 4 + i * 0.4, 5 + i * 0.6, k));
      T.zs.forEach((zz, i) => T.moveZ(zz, lerp(-13 - i * 1.3, 0 - i * 1.3, k), 4 + (i % 3) * 1.6));
    },
  },

  // Rocco Fucci: walking at you in slow motion, reloading, then the gun snaps up.
  roccoHero: {
    enter(T) { for (let i = 0; i < 5; i++) T.zombie(14 + (i - 2) * 2.2, -142 - (i % 2) * 2, { type: 'walker' }); },
    frame(T, u, d, k) {
      T.slow = 0.35;
      const z = lerp(-136, -133.6, k);
      const aim = sm(0.62, 0.72, k);
      T.pose('rocco', { x: 14, z, reload: k < 0.58, pitch: aim * 0.05 });
      T.crew.rocco.yaw = aim > 0.5 ? Math.PI : Math.PI;   // facing +z (the camera)
      if (aim > 0.5) { T.crew.rocco.yaw = 0; if (k > 0.78) T.fire('rocco', V(14, 1.4, -143), 0.25); }
      T.zs.forEach((zz, i) => T.moveZ(zz, zz.pos.x, lerp(-144 - (i % 2) * 2, -141, k), { speed: 0.5 }));
      T.look(14.4 + Math.sin(k * 2) * 0.3, 1.25, lerp(-131.2, -130.6, k), 14, 1.45, z, 40);
    },
  },

  // Sliding under a zombie's swing, firing as you go.
  slideUnder: {
    enter(T) { T.zombie(3, 2, { type: 'walker' }); T.zombie(4.6, 3.2, { type: 'walker' }); },
    frame(T, u, d, k) {
      const x = lerp(-6, 8, ease(k));
      T.pose('pit', { x, z: 2.6, slide: k > 0.15 && k < 0.8, crouch: k > 0.1 && k < 0.85, pitch: 0.1 });
      T.crew.pit.yaw = -Math.PI / 2;   // facing +x
      T.zs.forEach((zz) => T.moveZ(zz, zz.pos.x, zz.pos.z, { yaw: -Math.PI / 2, attack: true, speed: 0 }));
      if (k > 0.2) T.fire('pit', T.zs[1] ? V(T.zs[1].pos.x, 1.3, T.zs[1].pos.z) : V(10, 1, 3));
      if (k > 0.85 && T.zs[0]) T.kill(T.zs[0], V(x, 0, 2.6), { kind: 'bullet', dist: 3, up: 0.8 });
      T.look(1.5, 0.45, 7.2, 1.5, 1.1, 2.4, 52);
    },
  },

  // Seven guns, seven quick cuts: a big flash each, in slow motion.
  gunMontage: {
    frame(T, u, d, k) {
      T.slow = 0.4;
      const G = T.C.guns, n = G.length, i = Math.min(n - 1, Math.floor(k * n));
      if (i !== T.gunCut) {
        T.gunCut = i;
        for (const id of CREW) T.hide(id);
        T.clearZombies();
        T.fx.clear();
        T.zombie(-8 + 0.5 * i, -6 + (i % 3), { type: 'runner' });
      }
      const [gun, who] = G[i];
      const lk = k * n - i;
      const side = i % 2 ? 1 : -1;
      T.pose(who, { x: 2, z: 0, gun, pitch: 0.05 });
      T.face(who, -10, -6);
      if (T.zs[0]) T.moveZ(T.zs[0], lerp(-8, -5, lk), -6 + (i % 3), { speed: 3 });
      T.fire(who, T.zs[0] ? V(T.zs[0].pos.x, 1.3, T.zs[0].pos.z) : V(-10, 1.3, -6), 0.12);
      const a = Math.atan2(-6, -12) + side * 1.2;
      T.look(2 + Math.cos(a) * 2.2, 1.6, Math.sin(a) * 2.2, lerp(0.4, -0.2, lk), 1.45, -1.2, 38);
    },
  },

  // Zach roars, from down at his feet.
  zachRoar: {
    frame(T, u, d, k) {
      const r = sm(0.15, 0.4, k);
      const Z = T.zachAt(118, 0, { yaw: Math.PI / 2, size: 1.0, headX: -0.24 - r * 0.55, lean: 0.2 - r * 0.35 });
      Z.armL.shoulder.rotation.set(-0.25 - r * 0.6, 0, 0.24 + r * 0.9); Z.armR.shoulder.rotation.set(-0.25 - r * 0.6, 0, -0.24 - r * 0.9);
      if (k > 0.3) T.shake = Math.max(T.shake, 0.9 * (1 - k));
      if (k > 0.3 && !T.roared) { T.roared = true; T.fx.energyBurst(V(118, 4.6, 0), '#5aff70', 3); }
      if (k < 0.1) T.roared = false;
      T.look(124.5, 0.4, 2.2, 118, 3.6, 0, 58, 0.05);
    },
  },

  // The Ship Graveyard: in over the windmills and the lighthouse, down to the
  // shore where they're running.
  shipFly: {
    enter(T) { for (let i = 0; i < 6; i++) T.zombie(-6 - i * 1.4, -120 - (i % 3) * 1.5); },
    frame(T, u, d, k) {
      T.far = 420;
      T.path([60, 34, -230, 0, 4, -160], [22, 5, -122, 2, 1.6, -124], ease(k), 55);
      ['ryan', 'kearns', 'brian'].forEach((id, i) => run(T, id, -3 + i, -121 + i * 1.3, 9 + i, -123 + i * 1.3, k));
      T.zs.forEach((zz, i) => T.moveZ(zz, lerp(-7 - i * 1.4, 5 - i * 1.4, k), -120 - (i % 3) * 1.5));
    },
  },

  // Brian slides under a pack of them, firing the whole way.
  brianHero: {
    enter(T) { for (let i = 0; i < 4; i++) T.zombie(162 + i * 0.4, -4 + (i - 1.5) * 1.1, { type: 'walker' }); },
    frame(T, u, d, k) {
      T.slow = k > 0.3 && k < 0.75 ? 0.4 : 1;
      const x = lerp(170, 152, sm(0.05, 0.9, k));
      T.pose('brian', { x, z: -4, slide: k > 0.25 && k < 0.8, crouch: k > 0.2 && k < 0.85, pitch: 0.2 });
      T.crew.brian.yaw = Math.PI / 2;   // facing -x... into them
      T.zs.forEach((zz, i) => T.moveZ(zz, zz.pos.x, zz.pos.z, { yaw: Math.PI / 2 - Math.PI, attack: true, speed: 0 }));
      if (k > 0.2) T.fire('brian', V(161, 1.6 + Math.sin(u * 20) * 0.3, -4 + Math.sin(u * 7)), 0.08);
      if (k > 0.82) T.zs.slice(0, 2).forEach((zz) => T.kill(zz, V(x, 0, -4), { kind: 'bullet', dist: 3, up: 1 }));
      T.look(158, 0.5, 0.2, 162, 1.1, -4.2, 50);
    },
  },

  // The Research Base: down past the red mast to the tesla catwalks, the crew
  // shooting down at zombies in the yard.
  researchFly: {
    enter(T) { for (let i = 0; i < 6; i++) T.zombie(155 + i * 1.5, 18 + (i % 2) * 2); },
    frame(T, u, d, k) {
      T.far = 420;
      T.path([210, 40, -40, 184, 10, -10], [175, 9, 48, 158, 3, 26], ease(k), 55);
      T.pose('ryan', { x: 149.2, z: 32, y: 4.2, pitch: -0.4 }); T.face('ryan', 156, 19);
      T.pose('pit', { x: 168.8, z: 31, y: 4.2, pitch: -0.4 }); T.face('pit', 160, 19);
      T.zs.forEach((zz, i) => T.moveZ(zz, 155 + i * 1.5, lerp(17, 22, k) + (i % 2) * 2, { speed: 1.5, yaw: 0 }));
      if (T.zs[1]) { T.fire('ryan', V(T.zs[1].pos.x, 1.2, T.zs[1].pos.z)); T.fire('pit', V(T.zs[4].pos.x, 1.2, T.zs[4].pos.z)); }
    },
  },

  // Two new perk machines, flickering into life.
  perks: {
    frame(T, u, d, k) {
      const [a, b] = T.perks;
      const second = k > 0.5;
      if (a) { a.force = true; if (k < 0.06) a.flick = 0.6; }
      if (b) { b.force = second; if (second && k < 0.56) b.flick = 0.6; }
      const pv = second ? b : a;
      if (!pv) return;
      const x = pv.m.center.x, z = pv.m.center.z, base = pv.base;
      const kk = second ? (k - 0.5) * 2 : k * 2;
      T.look(x + lerp(-1.6, 1.4, kk), base + lerp(0.8, 1.5, kk), z + lerp(2.8, 2.2, kk), x, base + 1.3, z, 42);
    },
  },

  // Ryan on a crag at the edge of the Ship Graveyard, space all round; he turns
  // and drops down into the fight.
  ryanHero: {
    enter(T) { for (let i = 0; i < 6; i++) T.zombie(-20 + (i % 3) * 2, -152 + Math.floor(i / 3) * 2.2); },
    frame(T, u, d, k) {
      const top = { x: -27.5, z: -167.5 };
      const y0 = T.gy(top.x, top.z);
      const jump = sm(0.62, 1, k);
      const jx = lerp(top.x, -21, jump), jz = lerp(top.z, -156, jump);
      const jy = lerp(y0, T.gy(-21, -156), jump) + Math.sin(jump * Math.PI) * 2.2;
      T.pose('ryan', { x: jx, z: jz, y: jy, pitch: k < 0.6 ? 0.2 : -0.3 });
      T.crew.ryan.yaw = lerp(2.2, -0.6, sm(0.35, 0.6, k));
      T.zs.forEach((zz, i) => T.moveZ(zz, -20 + (i % 3) * 2, -152 + Math.floor(i / 3) * 2.2, { speed: 0.8, yaw: Math.PI }));
      if (k < 0.6) T.look(top.x + 4.5, y0 + 1.2, top.z - 4.5, top.x - 12, y0 + 3, top.z + 10, 42);
      else T.look(-15, 2.4, -148, jx, jy + 0.8, jz, 50);
    },
  },

  // The Trench Front: low over the burning ground, into the trench they're
  // fighting along.
  trenchFly: {
    enter(T) { for (let i = 0; i < 6; i++) T.zombie(-30 + i * 2.5, 165 + (i % 2) * 3, { y: 2.3 }); },
    frame(T, u, d, k) {
      T.far = 420;
      T.path([60, 26, 200, 0, 0, 150], [-6, 3.6, 176, -18, 0.6, 170], ease(k), 55);
      ['kearns', 'rocco'].forEach((id, i) => run(T, id, -2 - i * 1.3, 170, -16 - i * 1.3, 170, k, { y: 0 }));
      T.zs.forEach((zz, i) => T.moveZ(zz, lerp(-30 + i * 2.5, -26 + i * 2.5, k), 165 + (i % 2) * 3, { y: 2.3 }));
    },
  },

  // Two new explosives: a grenade tumbling into a pack, a Stew Bomb going up.
  explosives: {
    enter(T) { for (let i = 0; i < 8; i++) T.zombie(-14 + (i % 4) * 1.6, 140 + Math.floor(i / 4) * 1.6 + (i > 3 ? 6 : 0), { y: 2.3 }); },
    frame(T, u, d, k) {
      T.slow = 0.55;
      const first = k < 0.5;
      const c = first ? V(-11.6, 2.3, 140.8) : V(-11.6, 2.3, 147.6);
      const kk = first ? k * 2 : (k - 0.5) * 2;
      T.zs.forEach((zz) => !zz.dead && T.moveZ(zz, zz.pos.x, zz.pos.z + 0.002, { y: 2.3, yaw: Math.PI, speed: 1 }));
      if (kk > 0.35 && !T.boomed[first ? 0 : 1]) {
        T.boomed[first ? 0 : 1] = true;
        if (first) T.fx.explosion(c.clone().add(V(0, 0.3, 0)), 4.5);
        else { T.fx.explosion(c.clone().add(V(0, 0.3, 0)), 5.5); T.fx.energyBurst(c, '#7fe08a', 5); }
        T.shake = 1.4;
        for (const zz of T.zs) if (Math.hypot(zz.pos.x - c.x, zz.pos.z - c.z) < 4) T.kill(zz, c, { up: 3 + Math.random() * 2, dist: 5 + Math.random() * 5 });
      }
      T.look(c.x + 7, 3.2, c.z + 5, c.x, 1.4, c.z, 48);
    },
    enterExtra: null,
  },

  // Zach brings his foot down; the ground jumps.
  zachStomp: {
    frame(T, u, d, k) {
      const lift = sm(0.05, 0.35, k) * (1 - sm(0.42, 0.5, k));
      const Z = T.zachAt(0, 128, { yaw: 0, size: 1.25, headX: -0.1, y: 2.3 });
      Z.legR.hip.rotation.x = -1.1 * lift; Z.legR.knee.rotation.x = 1.2 * lift;
      Z.torso.rotation.x = 0.2 + lift * 0.15;
      if (k > 0.5 && !T.stomped) {
        T.stomped = true; T.shake = 2.2;
        const p = V(-0.5, 2.4, 129);
        T.fx.energyBurst(p, '#5aff70', 6);
        for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; T.fx.puff(p.clone().add(V(Math.cos(a) * 2, 0, Math.sin(a) * 2)), { color: 0x5a4434, size: 1.2, grow: 2.6, life: 1.6, alpha: 0.6, vel: V(Math.cos(a) * 4, 0.6, Math.sin(a) * 4) }); }
      }
      if (k < 0.1) T.stomped = false;
      T.look(2.5, 2.8, 136.5, 0, 4.5, 128, 60, -0.06);
    },
  },

  // Kearns brings the Fire Hammer down; the pack goes up in flames and flying.
  kearnsHero: {
    enter(T) { T.giveHammer('kearns', 'fire'); for (let i = 0; i < 6; i++) { const a = -0.9 + i * 0.36; T.zombie(-4 + Math.sin(a) * 3, -6 - Math.cos(a) * 3, { type: 'walker' }); } },
    frame(T, u, d, k) {
      T.slow = k > 0.38 && k < 0.7 ? 0.35 : 1;
      T.giveHammer('kearns', 'fire');
      const sw = sm(0.15, 0.36, k), down = sm(0.36, 0.44, k);
      T.pose('kearns', { x: -4, z: -2.6, pitch: lerp(0.2, 1.25, sw) - down * 2.4 });
      T.crew.kearns.yaw = 0;   // facing -z
      T.zs.forEach((zz) => !zz.dead && T.moveZ(zz, zz.pos.x, zz.pos.z, { yaw: Math.atan2(-4 - zz.pos.x, -2.6 - zz.pos.z), speed: 1, attack: k < 0.3 }));
      if (k > 0.44 && !T.slammed) {
        T.slammed = true;
        const h = V(-4, 0.4, -4.4);
        T.burst('fire', h);
        for (const zz of T.zs) T.kill(zz, h, { up: 4 + Math.random() * 2, dist: 7 + Math.random() * 5 });
      }
      if (k < 0.1) T.slammed = false;
      T.look(lerp(-0.6, 0.2, k), 1.0, lerp(1.6, 2.2, k), -4, 1.5, -4.5, 46);
    },
  },

  // The four War Hammers: fire, ice, wind, lightning.
  hammers: {
    frame(T, u, d, k) {
      const els = ['fire', 'ice', 'wind', 'lightning'], who = ['ryan', 'brian', 'pit', 'rocco'];
      const spots = [[-40, 138, 2.3], [-150, 0, 1.0], [10, -135, 0.8], [158, 22, 0.8]];
      const i = Math.min(3, Math.floor(k * 4)), lk = k * 4 - i;
      const [x, z, y] = spots[i];
      if (i !== T.hamCut) {
        T.hamCut = i;
        for (const id of CREW) { T.takeHammer(id); T.hide(id); }
        T.clearZombies(); T.fx.clear(); T.slam = false;
        for (let j = 0; j < 5; j++) T.zombie(x - 2 + (j - 2) * 1.1, z - 3 - (j % 2), { y, type: 'walker' });
      }
      const id = who[i], el = els[i];
      T.giveHammer(id, el);
      const sw = sm(0.0, 0.35, lk), down = sm(0.35, 0.5, lk);
      T.pose(id, { x, z, y, pitch: lerp(0.2, 1.25, sw) - down * 2.4 });
      T.crew[id].yaw = 0;
      T.zs.forEach((zz) => !zz.dead && T.moveZ(zz, zz.pos.x, zz.pos.z + 0.01, { y, yaw: Math.PI, speed: 1 }));
      if (lk > 0.5 && !T.slam) {
        T.slam = true;
        const h = V(x, y + 0.3, z - 2);
        T.burst(el, h, V(0, 0, -1));
        for (const zz of T.zs) T.kill(zz, h, { up: el === 'wind' ? 4.5 : 3, dist: el === 'wind' ? 12 : 7 });
      }
      T.look(x + 3.4, y + 1.6, z + 2.8, x - 0.6, y + 1.2, z - 2, 48);
    },
  },

  // The Ice Caves: in through the mouth, over the frozen floor of the cavern.
  cavesFly: {
    enter(T) { for (let i = 0; i < 6; i++) T.zombie(-140 - i * 1.4, -2 + (i % 3) * 1.5, { y: 1 }); },
    frame(T, u, d, k) {
      T.far = 420;
      T.path([-96, 18, 30, -130, 2, 0], [-124, 3.6, 4, -146, 1.6, -1], ease(k), 55);
      ['pit', 'ryan'].forEach((id, i) => run(T, id, -138 + i, -1 + i * 1.6, -127 + i, -1 + i * 1.6, k));
      T.zs.forEach((zz, i) => T.moveZ(zz, lerp(-142 - i * 1.4, -132 - i * 1.4, k), -2 + (i % 3) * 1.5));
    },
  },

  // Pit backs off firing at the horde, then turns and runs; the camera runs with him.
  pitHero: {
    enter(T) { for (let i = 0; i < 9; i++) T.zombie(-150 - (i % 3) * 1.4, -3 + Math.floor(i / 3) * 1.6, { type: i % 2 ? 'runner' : 'walker' }); },
    frame(T, u, d, k) {
      const turn = sm(0.55, 0.65, k);
      const x = lerp(-145, -139, sm(0, 0.55, k)) + lerp(0, 7, sm(0.6, 1, k));
      T.pose('pit', { x, z: -1.5, sprint: turn > 0.5, pitch: 0.05 });
      T.crew.pit.yaw = lerp(-Math.PI / 2 + Math.PI, -Math.PI / 2, turn);   // facing the horde (-x), then away (+x)
      if (turn < 0.5) T.fire('pit', V(-150, 1.3, -1 + Math.sin(u * 9)), 0.07);
      T.zs.forEach((zz, i) => T.moveZ(zz, lerp(-151, -143, k) - (i % 3) * 1.4, -3 + Math.floor(i / 3) * 1.6, { yaw: -Math.PI / 2 + Math.PI }));
      if (k < 0.58) T.look(x + 3.2, 1.5, -0.2, x - 4, 1.3, -1.5, 50);
      else T.look(x + 2.8 - sm(0.6, 1, k) * 0.5, 1.6, 0.4, x - 1, 1.4, -1.5, 52);
    },
  },

  // Sliding into cover behind the ice, firing over it.
  slideCover: {
    enter(T) { for (let i = 0; i < 5; i++) T.zombie(-160 - i * 1.2, 2 + (i % 2) * 1.5, { y: 1 }); },
    frame(T, u, d, k) {
      const x = lerp(-148, -153, sm(0, 0.6, k));
      T.pose('rocco', { x, z: 3.5, slide: k < 0.6, crouch: true, pitch: 0.05 });
      T.crew.rocco.yaw = Math.PI / 2 * -1 + Math.PI;   // facing -x
      T.fire('rocco', V(-160, 1.2, 2.5), 0.15);
      T.zs.forEach((zz, i) => T.moveZ(zz, lerp(-162, -158, k) - i * 1.2, 2 + (i % 2) * 1.5));
      T.look(x + 2.2, 0.7, 6.2, x - 3, 0.9, 2.5, 50);
    },
  },

  // Zach swings at them: bigger than ever.
  zachSwing: {
    frame(T, u, d, k) {
      const s = sm(0.1, 0.55, k);
      const Z = T.zachAt(6, -3, { yaw: -Math.PI / 2 - 0.4, size: 1.5, headX: -0.1, lean: 0.25 });
      Z.armR.shoulder.rotation.set(-0.25 - 1.6 * (1 - s) - s * 0.2, 0, -0.24 - 1.2 * (1 - s) + s * 1.3);
      Z.torso.rotation.y = lerp(0.5, -0.6, s);
      T.pose('brian', { x: 1, z: -2, crouch: s > 0.4, pitch: 0.4 }); T.face('brian', 6, -3);
      T.pose('ryan', { x: 0.5, z: -4.5, pitch: 0.5 }); T.face('ryan', 6, -3);
      if (k > 0.3) { T.fire('brian', V(6, 5, -3), 0.1); T.fire('ryan', V(6, 6, -3), 0.12); }
      if (k > 0.5) T.shake = Math.max(T.shake, 0.7);
      T.look(-2.2, 0.35, 1.8, 5, 4.2, -3, 60);
    },
  },

  // The end: all five back to back in the middle of the base, zombies closing in
  // from every side, and Zach rising up behind them.
  finale: {
    enter(T) { for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; T.zombie(160 + Math.cos(a) * 11, -2 + Math.sin(a) * 11, { type: i % 3 ? 'walker' : 'runner' }); } },
    frame(T, u, d, k) {
      const c = { x: 160, z: -2 };
      CREW.forEach((id, i) => {
        const a = i / 5 * Math.PI * 2;
        T.pose(id, { x: c.x + Math.cos(a) * 0.9, z: c.z + Math.sin(a) * 0.9, pitch: 0.05 });
        T.face(id, c.x + Math.cos(a) * 10, c.z + Math.sin(a) * 10);
        if (k > 0.25) T.fire(id, V(c.x + Math.cos(a) * 7, 1.3, c.z + Math.sin(a) * 7), 0.11 + i * 0.01);
      });
      T.zs.forEach((zz, i) => { const a = i / 16 * Math.PI * 2, r = lerp(11, 4.5, ease(k)); T.moveZ(zz, c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, { yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) }); });
      const rise = ease(sm(0.35, 0.85, k));
      T.zachAt(c.x + 10, c.z, { yaw: -Math.PI / 2, size: 1.8, y: T.gy(c.x + 10, c.z) - 9 * (1 - rise), headX: -0.1 });
      const a = lerp(-2.2, -2.7, k);
      T.look(c.x + Math.cos(a) * lerp(7, 9.5, k), lerp(1.3, 2.4, k), c.z + Math.sin(a) * lerp(7, 9.5, k), c.x + 2, lerp(1.4, 3.8, rise), c.z, 52);
    },
  },
};
SHOTS.explosives.enter = ((orig) => (T) => { T.boomed = [false, false]; orig(T); })(SHOTS.explosives.enter);
SHOTS.gunMontage.enter = (T) => { T.gunCut = -1; };
SHOTS.hammers.enter = (T) => { T.hamCut = -1; };
