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
import { buildWarHammer } from './warHammer.js';
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
    // the perk machines (its own, switched on by hand)
    this.perks = [];
    this.buildPerks();
    // the film light: a key light each shot points at its subject (the islands
    // are lit for playing, not for close-ups)
    this.film = new THREE.DirectionalLight(0xffffff, 0);
    this.scene.add(this.film); this.scene.add(this.film.target);
    this.savedExposure = renderer.renderer.toneMappingExposure;
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

  // The perk machines it shows off: cabinets of its own (the game's machines are
  // tied to the map's), dark until each flickers on.
  buildPerks() {
    const spots = [[116.4, -21.5], [119.8, -21.5]];
    this.C.perks.forEach((pk, i) => {
      const [x, z] = spots[i];
      const g = new THREE.Group();
      const col = new THREE.Color(pk.color);
      const body = new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.4), roughness: 0.45, metalness: 0.4 });
      const front = new THREE.MeshStandardMaterial({ map: perkFront(pk), emissive: 0xffffff, emissiveMap: perkFront(pk), emissiveIntensity: 0, roughness: 0.5 });
      const chrome = new THREE.MeshStandardMaterial({ color: '#c8c6c0', roughness: 0.2, metalness: 0.9 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 0.9), [body, body, body, body, front, body]); box.position.y = 1.15; g.add(box);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.24, 0.62), [body, body, body, body, front, body]); top.position.set(0, 2.42, -0.1); g.add(top);
      const kick = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.16, 0.94), chrome); kick.position.y = 0.08; g.add(kick);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      halo.scale.set(3, 3.6, 1); halo.position.set(0, 1.4, 0.6); g.add(halo);
      const base = this.gy(x, z);
      g.position.set(x, base, z);
      this.group.add(g);
      const v = this.map.addVirtualLight({ x, y: base + 1.6, z: z + 1.3 }, col.getHex(), 12, 7, 1.6);
      v.live = true; v.level = 0;
      this.perks.push({ g, front, halo, v, base, x, z, level: 0, flick: 0, force: false });
    });
  }
  updatePerks(dt) {
    for (const pv of this.perks) {
      const on = pv.force ? 1 : 0;
      pv.level += (on - pv.level) * Math.min(1, dt * 4);
      let lv = pv.level;
      if (pv.flick > 0) { pv.flick -= dt; lv *= Math.sin(this.t * 61) > 0 ? 0.15 : 1; }
      pv.front.emissiveIntensity = lv * 1.1;
      pv.halo.material.opacity = lv * 0.45;
      pv.v.level = lv;
    }
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

  // this shot's key light: how strong, what colour, from where (aimed at the camera's subject)
  light(k, color, from) {
    this.film.intensity = k * 2.6;
    this.film.color.set(color);
    this.film.position.set(...from);
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
    this.film.intensity = 0;
    this.zachLight.intensity = 14; this.zachLight.distance = 12;
    const fn = SHOTS[sh.id];
    if (fn && fn.frame) fn.frame(this, this.u, d, Math.min(1, this.u / d));
    // (the key light aims where the camera looks)
    this.film.target.position.copy(this.cam.position).add(this.cam.getWorldDirection(this.tmpD || (this.tmpD = new THREE.Vector3())).multiplyScalar(6));
    this.R.renderer.toneMappingExposure = this.C.exposure ?? 1.5;
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
    this.updatePerks(dt);
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
    for (const pv of this.perks) { pv.force = false; pv.level = 0; pv.flick = 0; }
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
    for (const pv of this.perks) this.map.removeVirtualLight(pv.v);
    this.scene.remove(this.film); this.scene.remove(this.film.target);
    this.R.renderer.toneMappingExposure = this.savedExposure;
    this.cam.far = this.savedFar;
    this.cam.updateProjectionMatrix();
  }
}

// A perk machine's face: its colour, its name down the front, its glyph.
function perkFront(pk) {
  const [c, g] = T.makeCanvas(256, 512);
  g.fillStyle = '#0c0c10'; g.fillRect(0, 0, 256, 512);
  g.fillStyle = pk.color; g.globalAlpha = 0.85; g.fillRect(14, 14, 228, 484); g.globalAlpha = 1;
  g.fillStyle = '#0c0c10'; g.fillRect(28, 150, 200, 270);
  g.fillStyle = '#f4efe6'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 110px Impact, Anton, sans-serif'; g.fillText(pk.glyph, 128, 82);
  g.font = 'bold 40px Impact, Anton, sans-serif';
  pk.name.toUpperCase().split(' ').forEach((w, i, all) => g.fillText(w, 128, 285 + (i - (all.length - 1) / 2) * 46));
  g.fillStyle = pk.color; g.fillRect(28, 440, 200, 30);
  return T.toTexture(c, { repeat: false });
}

// (the War Hammers: src/render/warHammer.js, the same ones as in the game)
const buildHammer = (el) => buildWarHammer(el);

// =============================================================================
// The shots. enter(T) sets the stage; frame(T, u, d, k): u seconds into the
// shot, d its length, k = u / d.
// =============================================================================
const run = (T, id, x0, z0, x1, z1, k, o = {}) => { T.pose(id, { x: lerp(x0, x1, k), z: lerp(z0, z1, k), sprint: o.sprint ?? true, ...o }); T.face(id, x1 + (x1 - x0), z1 + (z1 - z0)); };

const deg = (a) => a * Math.PI / 180;
const rim = (a, r = 26.5) => [Math.cos(deg(a)) * r, Math.sin(deg(a)) * r];

export const SHOTS = {
  black: {},

  // Out in space: a slow push in toward the islands, drifting in their clouds,
  // the nebula and the striped giant above them.
  space: {
    frame(T, u, d, k) {
      T.fogDensity = 0.0004; T.far = 1600;
      const e = sm(0, 1, k);
      T.path([-150, 62, 175, 0, 0, 0], [-62, 30, 72, 4, 2, -6], e, 54, -0.05);
    },
  },

  // Zach in the dark of the forge, completely still; the camera tilts from his
  // boots to his face, and at the end his head turns to it.
  zachReveal: {
    frame(T, u, d, k) {
      const [x, z] = rim(200, 26.5);
      T.zachAt(x, z, { yaw: Math.PI / 2 + 0.35, headY: -1.15 * sm(0.72, 0.97, k), headX: -0.18, y: 9 });
      T.zachLight.intensity = 34; T.zachLight.distance = 14;
      T.fogColor = new THREE.Color('#06090a'); T.fogDensity = 0.022;
      T.light(0.45, '#6aff90', [x + 6, 9 + 3, z + 6]);
      const ty = 9 + lerp(0.4, 4.3, sm(0.04, 0.72, k));
      T.look(x + 1.8, 9.25, z + 8.2, x, ty, z, 40);
    },
  },

  // The Research Base, empty and quiet: the red mast, the labs, the dome.
  basePan: {
    frame(T, u, d, k) {
      T.light(0.6, '#b0b8ff', [150, 30, 40]);
      T.path([138, 7, -42, 172, 8, -18], [146, 8, 34, 180, 9, 2], sm(0, 1, k), 50);
    },
  },

  // The five walk out of the fog toward you, Zach's green glow looming far behind.
  squadFog: {
    frame(T, u, d, k) {
      T.fogColor = new THREE.Color('#1d2422'); T.fogDensity = 0.05;
      T.far = 300;
      T.zachAt(103.5, 0, { yaw: Math.PI / 2, size: 1.3, headX: -0.05 });
      T.zachLight.intensity = 26; T.zachLight.distance = 18;
      CREW.forEach((id, i) => {
        T.pose(id, { x: lerp(114, 117.5, k) - Math.abs(i - 2) * 0.7, z: (i - 2) * 1.6, pitch: -0.25 });
        T.crew[id].yaw = -Math.PI / 2;   // walking +x, toward the camera
      });
      T.light(0.35, '#c8d8d0', [130, 8, 6]);
      T.look(125.5, 1.15, 0.5, 113, 1.9, 0, 42);
    },
  },

  // The drop: in over the forge's wall and along the rim, the crew running with
  // zombies on their heels.
  hubFly: {
    enter(T) { for (let i = 0; i < 7; i++) { const [x, z] = rim(78 + i * 3.2, 25.5 + (i % 3) * 1.4); T.zombie(x, z, { type: 'runner', y: 9 }); } },
    frame(T, u, d, k) {
      T.far = 420;
      const e = ease(k);
      const [cx, cz] = rim(22, 24.4), [lx, lz] = rim(44, 26);
      T.path([70, 34, 40, 10, 9, 22], [cx, 10.3, cz, lx, 10, lz], e, 52);
      CREW.forEach((id, i) => {
        const a = lerp(70, 36, k) + i * 3.4, r = 25.2 + (i % 2) * 1.6;
        const [x, z] = rim(a, r), [nx, nz] = rim(a - 2, r);
        T.pose(id, { x, z, y: 9, sprint: true }); T.face(id, nx, nz);
      });
      T.zs.forEach((zz, i) => { const [x, z] = rim(lerp(88, 56, k) + i * 3.2, 25.5 + (i % 3) * 1.4); T.moveZ(zz, x, z, { y: 9 }); });
      T.light(0.8, '#ffd0a0', [30, 30, 10]);
    },
  },

  // Rocco Fucci: walking at you in slow motion, reloading, then the gun snaps up.
  roccoHero: {
    enter(T) { for (let i = 0; i < 6; i++) T.zombie(-4.5 + (i - 2.5) * 1.8, -158 - (i % 2) * 2, { type: 'walker' }); },
    frame(T, u, d, k) {
      T.slow = 0.35;
      const z = lerp(-151.5, -149, k);
      const aim = sm(0.6, 0.7, k);
      T.pose('rocco', { x: -4.5, z, reload: k < 0.56, pitch: 0.02 });
      T.crew.rocco.yaw = aim > 0.5 ? 0 : Math.PI;   // toward the camera, then round to the pack behind
      if (aim > 0.5 && k > 0.76) T.fire('rocco', V(-4.5, 1.3, -157), 0.3);
      T.zs.forEach((zz, i) => T.moveZ(zz, zz.pos.x, lerp(-159, -156.5, k) - (i % 2) * 2, { speed: 0.6, yaw: 0 }));
      T.light(0.7, '#ffe0c0', [4, 8, -140]);
      const side = sm(0.55, 0.75, k);
      T.look(-4.5 + lerp(0.5, 2.6, side), lerp(1.3, 1.5, side), z + lerp(3.4, 2.2, side), -4.5, 1.45, z - side * 3, 40);
    },
  },

  // Sliding under a zombie's swing, firing as you go.
  slideUnder: {
    enter(T) { T.zombie(12.5, -126.6, { type: 'walker' }); T.zombie(14.5, -125.2, { type: 'walker' }); T.zombie(17, -127.5, { type: 'runner' }); },
    frame(T, u, d, k) {
      const x = lerp(5, 19.5, ease(k));
      T.pose('pit', { x, z: -126.2, slide: k > 0.15 && k < 0.8, crouch: k > 0.1 && k < 0.85, pitch: 0.15 });
      T.crew.pit.yaw = -Math.PI / 2;   // facing +x
      T.zs.forEach((zz) => !zz.dead && T.moveZ(zz, zz.pos.x, zz.pos.z, { yaw: -Math.PI / 2, attack: true, speed: 0 }));
      if (k > 0.2 && T.zs[2] && !T.zs[2].dead) T.fire('pit', V(T.zs[2].pos.x, 1.3, T.zs[2].pos.z));
      if (k > 0.7 && T.zs[2]) T.kill(T.zs[2], V(x, 0, -126), { kind: 'bullet', dist: 3, up: 0.8 });
      T.light(0.6, '#ffe8cc', [10, 10, -115]);
      T.look(11, 0.55, -121.5, 12, 1.0, -126.5, 54);
    },
  },

  // Seven guns, seven quick cuts: a big flash each, in slow motion.
  gunMontage: {
    enter(T) { T.gunCut = -1; },
    frame(T, u, d, k) {
      T.slow = 0.4;
      const G = T.C.guns, n = G.length, i = Math.min(n - 1, Math.floor(k * n));
      const c = { x: 118, z: -6.5 };
      if (i !== T.gunCut) {
        T.gunCut = i;
        for (const id of CREW) T.hide(id);
        T.clearZombies(); T.fx.clear();
        T.zombie(c.x - 9, c.z + (i % 3) - 1, { type: 'runner' });
      }
      const [gun, who] = G[i];
      const lk = k * n - i;
      T.pose(who, { x: c.x, z: c.z, gun, pitch: 0.04 });
      T.face(who, c.x - 12, c.z);
      if (T.zs[0]) T.moveZ(T.zs[0], lerp(c.x - 9, c.x - 6.5, lk), T.zs[0].pos.z, { speed: 3 });
      T.fire(who, T.zs[0] ? V(T.zs[0].pos.x, 1.3, T.zs[0].pos.z) : V(c.x - 10, 1.3, c.z), 0.12);
      const a = deg(i % 2 ? 60 : 120);
      T.light(0.8, '#fff0dc', [c.x + 3, 6, c.z + 4]);
      T.look(c.x + Math.cos(a) * 3.6 - 1.2, 1.6, c.z + Math.sin(a) * 3.6, c.x - 2.2, 1.4, c.z, 40);
    },
  },

  // Zach roars, from down at his feet.
  zachRoar: {
    frame(T, u, d, k) {
      const r = sm(0.15, 0.4, k);
      const Z = T.zachAt(117.5, 5.5, { yaw: Math.PI / 2, size: 1.0, headX: -0.24 - r * 0.55, lean: 0.2 - r * 0.35 });
      Z.armL.shoulder.rotation.set(-0.25 - r * 0.6, 0, 0.24 + r * 0.9); Z.armR.shoulder.rotation.set(-0.25 - r * 0.6, 0, -0.24 - r * 0.9);
      if (k > 0.3) T.shake = Math.max(T.shake, 0.9 * (1 - k));
      if (k > 0.3 && !T.roared) { T.roared = true; T.fx.energyBurst(V(117.5, 5.4, 5.5), '#5aff70', 3); }
      if (k < 0.1) T.roared = false;
      T.light(0.9, '#c0ffd0', [126, 4, 10]);
      T.look(123.5, 0.45, 7.8, 117.5, 3.8, 5.5, 60, 0.05);
    },
  },

  // The Ship Graveyard: in over the windmills and the lighthouse, down to the
  // shore where they're running.
  shipFly: {
    enter(T) { for (let i = 0; i < 6; i++) T.zombie(-2 - i * 1.4, -124 - (i % 3) * 1.4); },
    frame(T, u, d, k) {
      T.far = 420;
      T.path([-40, 30, -215, -20, 8, -170], [22, 3.2, -118, 6, 1.6, -126], ease(k), 56);
      ['ryan', 'kearns', 'brian'].forEach((id, i) => run(T, id, 2 + i, -125 + i * 1.3, 15 + i, -127 + i * 1.3, k));
      T.zs.forEach((zz, i) => T.moveZ(zz, lerp(-3 - i * 1.4, 9 - i * 1.4, k), -124 - (i % 3) * 1.4));
      T.light(0.5, '#e0ecff', [10, 20, -100]);
    },
  },

  // Brian slides under a pack of them, firing the whole way.
  brianHero: {
    enter(T) { for (let i = 0; i < 4; i++) T.zombie(175 + i * 0.5, -2.5 + (i - 1.5) * 1.1, { type: 'walker' }); },
    frame(T, u, d, k) {
      T.slow = k > 0.3 && k < 0.75 ? 0.4 : 1;
      const x = lerp(183, 167, sm(0.05, 0.9, k));
      T.pose('brian', { x, z: -2.6, slide: k > 0.25 && k < 0.8, crouch: k > 0.2 && k < 0.85, pitch: 0.25 });
      T.crew.brian.yaw = Math.PI / 2;   // facing -x, into them
      T.zs.forEach((zz) => !zz.dead && T.moveZ(zz, zz.pos.x, zz.pos.z, { yaw: Math.PI / 2, attack: true, speed: 0 }));
      if (k > 0.2) T.fire('brian', V(174.5, 1.6 + Math.sin(u * 20) * 0.3, -2.6 + Math.sin(u * 7)), 0.08);
      if (k > 0.82) T.zs.slice(0, 2).forEach((zz) => T.kill(zz, V(x, 0, -2.6), { kind: 'bullet', dist: 3, up: 1 }));
      T.light(0.7, '#d8dcff', [176, 8, 6]);
      T.look(175, 0.8, 3.6, 175.5, 1.3, -2.8, 54);
    },
  },

  // The Research Base: down past the red mast to the tesla catwalks, the crew
  // shooting down at zombies in the yard.
  researchFly: {
    enter(T) { for (let i = 0; i < 6; i++) T.zombie(155 + i * 1.5, 18 + (i % 2) * 2); },
    frame(T, u, d, k) {
      T.far = 420;
      T.path([210, 40, -40, 184, 10, -10], [175, 9, 48, 158, 3, 26], ease(k), 56);
      T.pose('ryan', { x: 149.2, z: 32, y: 4.2, pitch: -0.4 }); T.face('ryan', 156, 19);
      T.pose('pit', { x: 168.8, z: 31, y: 4.2, pitch: -0.4 }); T.face('pit', 160, 19);
      T.zs.forEach((zz, i) => T.moveZ(zz, 155 + i * 1.5, lerp(17, 22, k) + (i % 2) * 2, { speed: 1.5, yaw: 0 }));
      if (T.zs[4]) { T.fire('ryan', V(T.zs[1].pos.x, 1.2, T.zs[1].pos.z)); T.fire('pit', V(T.zs[4].pos.x, 1.2, T.zs[4].pos.z)); }
      T.light(0.5, '#c0c8ff', [160, 30, 50]);
    },
  },

  // Two new perk machines, flickering into life.
  perks: {
    frame(T, u, d, k) {
      const [a, b] = T.perks;
      const second = k > 0.5;
      if (a) { a.force = true; if (k < 0.04) a.flick = 0.5; }
      if (b) { b.force = second; if (second && k < 0.54) b.flick = 0.5; }
      const pv = second ? b : a;
      if (!pv) return;
      const kk = second ? (k - 0.5) * 2 : k * 2;
      T.light(0.35, '#ffffff', [pv.x - 3, pv.base + 4, pv.z + 5]);
      T.look(pv.x + lerp(-1.8, 1.6, kk), pv.base + lerp(0.9, 1.6, kk), pv.z + lerp(3.4, 2.7, kk), pv.x, pv.base + 1.35, pv.z, 44);
    },
  },

  // Ryan on the parapet at the edge of the forge, nothing but space beyond;
  // he turns and dives down into the fight.
  ryanHero: {
    enter(T) { for (let i = 0; i < 6; i++) T.zombie(17 + (i % 3) * 1.4, -2.5 + Math.floor(i / 3) * 3, { type: 'walker', y: 4.5 }); },
    frame(T, u, d, k) {
      const top = { x: 31.6, z: 0.4 }, y0 = T.gy(top.x, top.z);
      const jump = sm(0.6, 1, k);
      const jx = lerp(top.x, 19.5, jump), jz = lerp(top.z, 0, jump);
      const jy = lerp(y0, 4.5, jump) + Math.sin(jump * Math.PI) * 1.8;
      T.pose('ryan', { x: jx, z: jz, y: jy, pitch: k < 0.6 ? 0.15 : -0.35, sprint: jump > 0 && jump < 1 });
      T.crew.ryan.yaw = lerp(-Math.PI / 2, Math.PI / 2, sm(0.38, 0.58, k));   // facing out (+x), then back (-x)
      T.zs.forEach((zz, i) => T.moveZ(zz, 17 + (i % 3) * 1.4, -2.5 + Math.floor(i / 3) * 3, { y: 4.5, speed: 0.8, yaw: Math.PI / 2 }));
      T.light(0.6, '#ffd8b0', [40, 20, 10]);
      if (k < 0.58) T.look(top.x - 4.2, y0 + 1.9, top.z + 2.6, top.x + 20, y0 + 1.5, top.z - 6, 50);
      else T.look(24, 7.5, 6, jx, jy + 0.6, jz, 52);
    },
  },

  // The Trench Front: low over the burning ground, into the trench they're
  // fighting along.
  trenchFly: {
    enter(T) { for (let i = 0; i < 6; i++) T.zombie(-30 + i * 2.5, 163.5 + (i % 2) * 1.5); },
    frame(T, u, d, k) {
      T.far = 420;
      T.path([50, 28, 205, 0, 0, 160], [-2, 3.8, 175.5, -16, 0.8, 170], ease(k), 56);
      ['kearns', 'rocco'].forEach((id, i) => run(T, id, -3 - i * 1.4, 169.6, -17 - i * 1.4, 169.6, k, { y: 0 }));
      T.zs.forEach((zz, i) => T.moveZ(zz, lerp(-30 + i * 2.5, -26 + i * 2.5, k), 163.5 + (i % 2) * 1.5));
      T.light(0.8, '#ffb080', [-8, 12, 178]);
    },
  },

  // Two new explosives: a grenade into a pack, then a Stew Bomb.
  explosives: {
    enter(T) {
      T.boomed = [false, false];
      for (let i = 0; i < 6; i++) T.zombie(5.5 + (i % 3) * 1.5 - 1.5, 118.5 + Math.floor(i / 3) * 1.5);
      for (let i = 0; i < 6; i++) T.zombie(24.5 + (i % 3) * 1.5 - 1.5, 118.5 + Math.floor(i / 3) * 1.5);
    },
    frame(T, u, d, k) {
      T.slow = 0.55;
      const first = k < 0.5;
      const c = first ? V(5.5, 2.3, 119.2) : V(24.5, 2.3, 119.2);
      const kk = first ? k * 2 : (k - 0.5) * 2;
      T.zs.forEach((zz) => !zz.dead && T.moveZ(zz, zz.pos.x, zz.pos.z - 0.003, { yaw: Math.PI, speed: 1 }));
      if (kk > 0.3 && !T.boomed[first ? 0 : 1]) {
        T.boomed[first ? 0 : 1] = true;
        T.fx.explosion(c.clone().add(V(0, 0.3, 0)), first ? 4.5 : 5.5);
        if (!first) T.fx.energyBurst(c, '#7fe08a', 5);
        T.shake = 1.4;
        for (const zz of T.zs) if (Math.hypot(zz.pos.x - c.x, zz.pos.z - c.z) < 4.5) T.kill(zz, c, { up: 3 + Math.random() * 2, dist: 5 + Math.random() * 5 });
      }
      T.light(0.5, '#ffc090', [c.x + 5, 8, c.z - 6]);
      T.look(c.x + 6.5, 4.2, c.z - 7, c.x, 2.8, c.z, 50);
    },
  },

  // Zach brings his foot down; the ground jumps.
  zachStomp: {
    frame(T, u, d, k) {
      const lift = sm(0.05, 0.35, k) * (1 - sm(0.42, 0.5, k));
      const c = { x: -14.5, z: 121.5 };
      const Z = T.zachAt(c.x, c.z, { yaw: 0, size: 1.25, headX: -0.1 });
      Z.legR.hip.rotation.x = -1.1 * lift; Z.legR.knee.rotation.x = 1.2 * lift;
      Z.torso.rotation.x = 0.2 + lift * 0.15;
      if (k > 0.5 && !T.stomped) {
        T.stomped = true; T.shake = 2.2;
        const p = V(c.x - 0.5, 2.4, c.z + 1);
        T.fx.energyBurst(p, '#5aff70', 6);
        for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; T.fx.puff(p.clone().add(V(Math.cos(a) * 2, 0, Math.sin(a) * 2)), { color: 0x5a4434, size: 1.2, grow: 2.6, life: 1.6, alpha: 0.6, vel: V(Math.cos(a) * 4, 0.6, Math.sin(a) * 4) }); }
      }
      if (k < 0.1) T.stomped = false;
      T.light(0.9, '#b0ffc0', [c.x + 5, 6, c.z - 6]);
      T.look(c.x + 2.2, 2.6, c.z - 6.2, c.x, 5.6, c.z, 64, -0.06);
    },
  },

  // Kearns brings the Fire Hammer down; the pack goes up in flames and flying.
  kearnsHero: {
    enter(T) { T.giveHammer('kearns', 'fire'); for (let i = 0; i < 6; i++) { const [x, z] = rim(160 + (i - 2.5) * 3.5, 25.5 + (i % 2) * 1.6); T.zombie(x, z, { type: 'walker', y: 9 }); } },
    frame(T, u, d, k) {
      T.slow = k > 0.38 && k < 0.7 ? 0.35 : 1;
      T.giveHammer('kearns', 'fire');
      const [kx, kz] = rim(147, 26.2);
      const sw = sm(0.15, 0.36, k), down = sm(0.36, 0.44, k);
      T.pose('kearns', { x: kx, z: kz, y: 9, pitch: lerp(0.2, 1.25, sw) - down * 2.4 });
      const [hx, hz] = rim(156, 26.2);
      T.face('kearns', hx, hz);
      T.zs.forEach((zz) => !zz.dead && T.moveZ(zz, zz.pos.x, zz.pos.z, { y: 9, yaw: Math.atan2(kx - zz.pos.x, kz - zz.pos.z), speed: 1, attack: k < 0.3 }));
      if (k > 0.44 && !T.slammed) {
        T.slammed = true;
        const [bx, bz] = rim(151, 26.2);
        const h = V(bx, 9.4, bz);
        T.burst('fire', h);
        for (const zz of T.zs) T.kill(zz, h, { up: 4 + Math.random() * 2, dist: 7 + Math.random() * 5 });
      }
      if (k < 0.1) T.slammed = false;
      const [cx, cz] = rim(140, 24.2);
      T.light(0.5, '#ffb070', [cx, 14, cz]);
      T.look(cx, 10.1, cz, hx, 10.2, hz, 46);
    },
  },

  // The four War Hammers: fire, ice, wind, lightning.
  hammers: {
    enter(T) { T.hamCut = -1; },
    frame(T, u, d, k) {
      const els = ['fire', 'ice', 'wind', 'lightning'], who = ['ryan', 'brian', 'pit', 'rocco'];
      const spots = [[-25.5, 120.5], [-114.5, -6.5], [-21.5, -138.5], [160.5, -36.5]];
      const i = Math.min(3, Math.floor(k * 4)), lk = k * 4 - i;
      const [x, z] = spots[i], y = T.gy(x, z);
      if (i !== T.hamCut) {
        T.hamCut = i;
        for (const id of CREW) { T.takeHammer(id); T.hide(id); }
        T.clearZombies(); T.fx.clear(); T.slam = false;
        for (let j = 0; j < 5; j++) T.zombie(x + (j - 2) * 1.1, z - 3 - (j % 2));
      }
      const id = who[i], el = els[i];
      T.giveHammer(id, el);
      const sw = sm(0.0, 0.35, lk), down = sm(0.35, 0.5, lk);
      T.pose(id, { x, z, pitch: lerp(0.2, 1.25, sw) - down * 2.4 });
      T.crew[id].yaw = 0;
      T.zs.forEach((zz) => !zz.dead && T.moveZ(zz, zz.pos.x, zz.pos.z + 0.01, { yaw: Math.PI, speed: 1 }));
      if (lk > 0.5 && !T.slam) {
        T.slam = true;
        const h = V(x, y + 0.3, z - 2);
        T.burst(el, h, V(0, 0, -1));
        for (const zz of T.zs) T.kill(zz, h, { up: el === 'wind' ? 4.5 : 3, dist: el === 'wind' ? 12 : 7 });
      }
      T.light(0.5, ELEMENT[el], [x + 2, y + 5, z + 4]);
      T.look(x + 3.2, y + 1.6, z + 2.8, x - 0.6, y + 1.2, z - 2, 48);
    },
  },

  // The Ice Caves: in over the frost to the cave mouth, the crew running in.
  cavesFly: {
    enter(T) { for (let i = 0; i < 6; i++) T.zombie(-108 + i * 1.4, -1 + (i % 3) * 1.4); },
    frame(T, u, d, k) {
      T.far = 420;
      T.path([-70, 24, 30, -112, 1, 0], [-103, 2.5, 4, -116, 1.5, -1], ease(k), 56);
      ['pit', 'ryan'].forEach((id, i) => run(T, id, -111 - i, -1 + i * 1.6, -119 - i, -1 + i * 1.6, k));
      T.zs.forEach((zz, i) => T.moveZ(zz, lerp(-104 + i * 1.4, -112 + i * 1.4, k), -1 + (i % 3) * 1.4));
      T.light(0.5, '#c8e0ff', [-100, 20, 20]);
    },
  },

  // Pit backs off firing at the horde, then turns and runs; the camera runs with him.
  pitHero: {
    enter(T) { for (let i = 0; i < 9; i++) T.zombie(-128 - (i % 3) * 1.4, -4 + Math.floor(i / 3) * 1.8, { type: i % 2 ? 'runner' : 'walker' }); },
    frame(T, u, d, k) {
      const turn = sm(0.55, 0.65, k);
      const x = lerp(-123, -118, sm(0, 0.55, k)) + lerp(0, 5, sm(0.6, 1, k));
      T.pose('pit', { x, z: -1.5, sprint: turn > 0.5, pitch: 0.05 });
      T.crew.pit.yaw = lerp(Math.PI / 2, -Math.PI / 2, turn);   // facing the horde (-x), then away (+x)
      if (turn < 0.5) T.fire('pit', V(-128, 1.3, -1 + Math.sin(u * 9)), 0.07);
      T.zs.forEach((zz, i) => T.moveZ(zz, lerp(-129, -122, k) - (i % 3) * 1.4, -4 + Math.floor(i / 3) * 1.8, { yaw: Math.PI / 2 }));
      T.light(0.5, '#d0e4ff', [x + 4, 6, 4]);
      if (k < 0.58) T.look(x + 3.2, 1.5, 1.6, x - 4, 1.3, -1.5, 50);
      else T.look(x + 3 - sm(0.6, 1, k) * 0.5, 1.6, 1.4, x - 1, 1.4, -1.5, 52);
    },
  },

  // Sliding into cover behind a sea stack, firing round it.
  slideCover: {
    enter(T) { for (let i = 0; i < 5; i++) T.zombie(35.5 + (i % 3) * 1.2, -146 - Math.floor(i / 3) * 1.6 + i * 0.3); },
    frame(T, u, d, k) {
      // a slide in behind the stack, then up on one knee firing round it
      const sk = sm(0, 0.45, k);
      const x = lerp(19.2, 23.4, sk), z = lerp(-136.2, -138.3, sk);
      T.pose('rocco', { x, z, slide: k < 0.45, crouch: k >= 0.45, pitch: 0.05 });
      T.face('rocco', 34, -146);
      if (k > 0.35) T.fire('rocco', V(T.zs[0] && !T.zs[0].dead ? T.zs[0].pos.x : 34, 1.2, T.zs[0] && !T.zs[0].dead ? T.zs[0].pos.z : -146), 0.12);
      T.zs.forEach((zz, i) => !zz.dead && T.moveZ(zz, lerp(35.5, 31, k) + (i % 3) * 1.2, -146 - Math.floor(i / 3) * 1.6 + i * 0.3, { yaw: Math.atan2(x - zz.pos.x, z - zz.pos.z) }));
      T.zs.forEach((zz, i) => { if (k > 0.5 + i * 0.09 && !zz.dead) T.kill(zz, V(x, 0, z), { kind: 'bullet', dist: 2, up: 0.6 }); });
      T.light(0.8, '#e0ecff', [x - 6, 8, z + 4]);
      T.look(x - 3.4, 1.2, z + 2.8, x + 3, 1.0, z - 2.5, 50);
    },
  },

  // Zach swings at them: bigger than ever.
  zachSwing: {
    frame(T, u, d, k) {
      const s2 = sm(0.1, 0.55, k);
      const zx = 112, zz = 0, bx = 118.5, bz = -1, rx = 119, rz = 1.6;
      const Z = T.zachAt(zx, zz, { yaw: Math.atan2(bx - zx, bz - zz), size: 1.6, headX: -0.15, lean: 0.3 });
      Z.armR.shoulder.rotation.set(-0.25 - 1.6 * (1 - s2) - s2 * 0.2, 0, -0.24 - 1.2 * (1 - s2) + s2 * 1.3);
      Z.torso.rotation.y = lerp(0.5, -0.6, s2);
      T.pose('brian', { x: bx, z: bz, crouch: s2 > 0.4, pitch: 0.55 }); T.face('brian', zx, zz);
      T.pose('ryan', { x: rx, z: rz, pitch: 0.6 }); T.face('ryan', zx, zz);
      if (k > 0.3) { T.fire('brian', V(zx, 6, zz), 0.1); T.fire('ryan', V(zx, 7, zz), 0.12); }
      if (k > 0.5) T.shake = Math.max(T.shake, 0.7);
      T.light(0.8, '#a0ffb0', [zx + 8, 10, zz + 6]);
      T.look(122.5, 0.6, 3, zx, 5.2, zz, 62);
    },
  },

  // The end: all five back to back in the middle of the base, zombies closing in
  // from every side, and Zach rising up behind them.
  finale: {
    enter(T) { for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; T.zombie(175.5 + Math.cos(a) * 9, -2.5 + Math.sin(a) * 9, { type: i % 3 ? 'walker' : 'runner' }); } },
    frame(T, u, d, k) {
      const c = { x: 175.5, z: -2.5 };
      CREW.forEach((id, i) => {
        const a = i / 5 * Math.PI * 2;
        T.pose(id, { x: c.x + Math.cos(a) * 0.9, z: c.z + Math.sin(a) * 0.9, pitch: 0.05 });
        T.face(id, c.x + Math.cos(a) * 10, c.z + Math.sin(a) * 10);
        if (k > 0.25) T.fire(id, V(c.x + Math.cos(a) * 6, 1.3, c.z + Math.sin(a) * 6), 0.11 + i * 0.01);
      });
      T.zs.forEach((zz, i) => { const a = i / 14 * Math.PI * 2, r = lerp(9, 4.2, ease(k)); T.moveZ(zz, c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, { yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) }); });
      const rise = ease(sm(0.35, 0.85, k));
      T.zachAt(c.x + 9.5, c.z, { yaw: -Math.PI / 2, size: 1.8, y: T.gy(c.x + 9.5, c.z) - 9 * (1 - rise), headX: -0.1 });
      T.zachLight.intensity = 30; T.zachLight.distance = 20;
      T.light(0.5, '#d0d8ff', [c.x - 10, 15, c.z + 10]);
      const a = lerp(2.3, 2.75, k);
      T.look(c.x + Math.cos(a) * lerp(7, 9.5, k), lerp(1.3, 2.6, k), c.z + Math.sin(a) * lerp(7, 9.5, k), c.x + 2, lerp(1.4, 4.2, rise), c.z, 52);
    },
  },
};
