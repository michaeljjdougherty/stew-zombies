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
import { buildWarHammer, hammerClock, temperedColor } from './warHammer.js';
import { maisyDog, lbdBaby, blackHole, updateHole } from './gadgetView.js';
import { ridePoint } from '../sim/rides.js';
import { makeZombie } from '../sim/zombies.js';
import * as T from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const CREW = ['rocco', 'brian', 'ryan', 'kearns'];   // (Pit isn't playable on the Crust: he's at his forge)
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

// (The same machinery plays the Crust's cutscenes, src/render/crustFilms.js:
// pass a film { C: its timings, lines and cues, shots: its choreography,
// crew: who's in it }. A film's crew can be empty-handed: a null in C.loadout.)
export class Trailer {
  constructor(renderer, sim, cfg, film = null) {
    this.R = renderer;
    this.sim = sim;
    this.cfg = cfg;
    this.spec = film;
    this.C = film ? film.C : cfg.trailer;
    this.shots = film ? film.shots : SHOTS;
    this.crewIds = film ? film.crew : CREW;
    this.lineAt = 0; this.cueAt = 0;
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
    for (const id of this.crewIds) {
      const gun = this.C.loadout[id];
      const p = { id: 'tr_' + id, name: id, character: id, alive: true, downed: null, crouching: false, sprinting: false, melee: { timer: 0 }, drinking: null, throwing: null, unarmed: !gun, loadout: { current: 0, reloading: false, slots: [{ id: gun || 'M1912' }] } };
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
  // The real floor at x, z: whatever's solid under `from` (decks, rocks, trench
  // boards), not just the ground's shape (people standing on air before).
  ground(x, z, from = 30) {
    const h = this.sim.raycastWorld({ x, y: from, z }, { x: 0, y: -1, z: 0 }, from + 40);
    return h ? h.point.y : this.gy(x, z);
  }

  // Put a crew member somewhere (and leave everyone else as they were).
  pose(id, o) {
    const a = this.crew[id];
    a.on = true;
    if (o.x != null) a.pos.set(o.x, o.y ?? this.ground(o.x, o.z), o.z);
    a.p.dive = o.dive ? { phase: 'air' } : null;
    a.p.ride = o.zip ? { zip: true } : null;
    a.p.launch = o.launch ? { t: 0 } : null;
    a.p.gesture = o.gesture || null;
    if (o.unarmed != null) a.p.unarmed = o.unarmed;
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

  // The flamethrower: a burst of its jet from a crew member's nozzle toward a point.
  flame(id, to, gun = 'M2 Flamethrower') {
    const a = this.crew[id];
    const key = id + '|f|' + (this.shot && this.shot.id);
    const last = this.fired.get(key) ?? -1;
    if (this.u - last < 0.1 && this.u >= last) return;
    this.fired.set(key, this.u);
    const m = a.tm.muzzle();
    if (!m) return;
    const dir = to.clone().sub(m).normalize();
    this.fx.flames.stream(m, dir, this.cfg.weapons[gun].flame);
  }

  // A titan awake (its own view animates it) for this shot, or all asleep again.
  wakeTitan(id) {
    const E = this.sim.crustEgg;
    if (!E) return;
    for (const T0 of Object.values(E.titans)) { T0.state = T0.id === id ? 'fight' : 'asleep'; T0.act = null; T0.t = 0; }
    this.titanOn = !!id;
  }

  // Zombies: made fresh for each shot (so each island gets its own kind).
  zombie(x, z, o = {}) {
    const zz = makeZombie(this.sim, { type: o.type || (this.zs.length % 3 ? 'walker' : 'runner'), pos: { x, y: o.y ?? this.ground(x, z), z }, yaw: o.yaw ?? 0, health: 100, state: 'chase' });
    zz.trailer = true;
    this.sim.zombies.push(zz);
    this.zs.push(zz);
    return zz;
  }
  moveZ(zz, x, z, o = {}) {
    const dx = x - zz.pos.x, dz = z - zz.pos.z, d = Math.hypot(dx, dz);
    zz.moveSpeed = o.speed ?? (this.dt > 0 ? Math.min(6, d / this.dt) : 0);
    zz.pos.x = x; zz.pos.z = z; zz.pos.y = o.y ?? this.ground(x, z);
    if (o.yaw != null) zz.yaw = o.yaw; else if (d > 1e-4) zz.yaw = Math.atan2(dx, dz);
    zz.attack.phase = o.attack ? 'windup' : 'none';
  }
  // ...and knock them flying
  kill(zz, from, o = {}) {
    if (zz.dead) return;
    zz.dead = true;
    const dx = zz.pos.x - from.x, dz = zz.pos.z - from.z, L = Math.hypot(dx, dz) || 1;
    const e = { type: 'zombieKilled', id: zz.id, pos: { ...zz.pos }, dir: { x: dx / L, y: 0.3, z: dz / L }, kind: o.kind || 'explosive', force: 1, headshot: false, vortex: o.vortex || null };
    if (o.fling !== false && !o.vortex && o.kind !== 'fire') e.fling = { x: dx / L, z: dz / L, dist: o.dist ?? 6 + Math.random() * 4, up: o.up ?? 2.5 + Math.random() * 2 };
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
    (this.C.perks || []).forEach((pk, i) => {
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
      const base = this.ground(x, z);
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
    // never under the ground's surface (looking up through it from below)
    py = Math.max(py, this.gy(px, pz) + 0.3);
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

  skip() {
    // a film: straight to its end
    if (this.spec) { this.t = this.C.end; this.lineAt = (this.C.lines || []).length; this.cueAt = (this.C.cues || []).length; this.done = true; return; }
    if (this.t >= this.C.end - 3) return;
    this.t = this.times.cards.find((c) => c.style === 'title').t0;
    if (this.onSeek) this.onSeek(this.t);
  }

  // --- each frame ---------------------------------------------------------------
  // With a clock (the song: see src/audio/trailerSong.js) the time is wherever
  // the song is, and the frame's step is however far that moved (a slow frame
  // just jumps ahead, never back); without one (recording), it steps by dt.
  update(dt, time) {
    if (this.clock) {
      const ct = this.clock();
      if (ct == null) dt = 0;                       // (the song's still loading: hold the first frame)
      else { dt = Math.min(0.1, Math.max(0, ct - this.t)); this.t = Math.max(this.t, ct); }
    } else this.t += dt;
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
    const fn = this.shots[sh.id];
    if (this.spec && this.spec.always) this.spec.always(this, t);
    if (fn && fn.frame) fn.frame(this, this.u, d, Math.min(1, this.u / d));
    // a film's lines and sound cues, as their moments pass
    const LN = this.C.lines || [], CU = this.C.cues || [];
    while (this.lineAt < LN.length && t >= LN[this.lineAt].at) { const l = LN[this.lineAt++]; if (this.onLine && t < l.at + 1) this.onLine(l.who, l.text, l.dur); }
    while (this.cueAt < CU.length && t >= CU[this.cueAt].at) { const c = CU[this.cueAt++]; if (this.onCue && t < c.at + 1) this.onCue(c.name); }
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
      if (a.spin) a.tm.root.rotation.set(a.spin.x || 0, a.spin.y ?? a.tm.root.rotation.y, a.spin.z || 0, 'YXZ');
      if (a.scale != null) a.tm.root.scale.setScalar(a.scale);
      if (a.slide) {
        // a slide: down low, leaning back, the front leg out
        k.hips.position.y = 0.42; k.torso.rotation.x = -0.45;
        k.legL.hip.rotation.x = -1.35; k.legL.knee.rotation.x = 0.15;
        k.legR.hip.rotation.x = -0.6; k.legR.knee.rotation.x = 1.6;
      }
    }
    this.zach.update(dt * this.slow, time);
    this.updatePerks(dt);
    hammerClock.t = this.t;
    if (this.titanOn && this.R.titans) this.R.titans.update(dt * this.slow, time, this.cam);
    if (this.forgeOn && this.R.forge) this.R.forge.update(dt * this.slow, time);
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
    for (const id of this.crewIds) { const a = this.crew[id]; this.takeHammer(id); this.hide(id); a.slide = 0; a.spin = null; a.p.dive = null; a.p.ride = null; a.p.launch = null; a.p.gesture = null; a.p.unarmed = !this.C.loadout[id]; a.p.loadout.slots[0].id = this.C.loadout[id] || 'M1912'; }
    if (this.titanOn) this.wakeTitan(null);
    this.forgeOn = false;
    if (this.sim.crustEgg) this.sim.crustEgg.forge.work = null;
    for (const o of this.props || []) this.group.remove(o);
    this.props = [];
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
    const fn = this.shots[sh.id];
    if (fn && fn.enter) fn.enter(this, sh);
  }

  // something of a shot's own (a dog, a black hole, a baby): gone at the next cut
  prop(o) { this.group.add(o); (this.props || (this.props = [])).push(o); return o; }

  dispose() {
    hammerClock.t = null;
    if (this.titanOn) this.wakeTitan(null);
    this.cullFar(0);
    this.clearZombies();
    this.fx.clear();
    for (const id of this.crewIds) { this.takeHammer(id); this.crew[id].tm.dispose(this.group); }
    if (this.spec && this.spec.dispose) this.spec.dispose(this);
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
// (the trailer shows them tempered, their elements going)
const buildHammer = (el) => buildWarHammer(el, { tempered: temperedColor(el) });

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
        T.pose(id, { x: lerp(114, 117.5, k) - Math.abs(i - 1.5) * 0.7, z: (i - 1.5) * 1.7, pitch: -0.25 });
        T.crew[id].yaw = -Math.PI / 2;   // walking +x, toward the camera
      });
      T.light(0.35, '#c8d8d0', [130, 8, 6]);
      T.look(125.5, T.ground(125.5, 0.5) + 0.45, 0.5, 113, 1.9, 0, 42);
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

  // Ryan sprints along the top of the Anvil's east terrace and dolphin dives
  // off the edge, down onto the pack on the terrace below: he lands belly first
  // and PHD Gaylor goes off under him in a purple blast (it only goes off from a height).
  diveBlast: {
    enter(T) { T.blasted = false; for (let i = 0; i < 8; i++) T.zombie(16.7 + (i % 4) * 0.95, -1.6 + Math.floor(i / 4) * 2.2 + (i % 2) * 0.4, { type: 'walker', yaw: Math.PI / 2 }); },
    frame(T, u, d, k) {
      const top = T.ground(26, -0.6), low = T.ground(17.6, -0.6), z = -0.6;
      T.slow = k > 0.3 && k < 0.66 ? 0.4 : 1;
      const run = sm(0, 0.3, k), fly = sm(0.3, 0.62, k);
      const x0 = 29.5, edge = 21.7, land = 18.6;   // (lying flat his head's a metre ahead of him: clear of the terrace's rail)
      const x = fly > 0 ? lerp(edge, land, fly) : lerp(x0, edge, run);
      const y = fly > 0 ? lerp(top, low, fly * fly) + Math.sin(fly * Math.PI) * 1.1 : top;
      const air = k > 0.3 && k < 0.62, prone = k >= 0.62 && k < 0.9;
      T.pose('ryan', { x, z, y, sprint: k < 0.3, dive: air || prone, crouch: k >= 0.9, pitch: air ? -0.25 : 0 });
      T.crew.ryan.yaw = Math.PI / 2;   // facing -x: off the edge and into them
      T.zs.forEach((zz) => !zz.dead && T.moveZ(zz, zz.pos.x + 0.004, zz.pos.z, { yaw: Math.PI / 2, speed: 1 }));
      if (k >= 0.62 && !T.blasted) {
        T.blasted = true;
        const p = V(land, low + 0.4, z);
        T.fx.energyBurst(p, '#9b4dff', 6.5);
        T.fx.energyBurst(p.clone().add(V(0, 0.6, 0)), '#d6a8ff', 3.8);
        T.R.flash = Math.max(T.R.flash || 0, 0.4);
        T.shake = 2;
        for (const zz of T.zs) T.kill(zz, p, { up: 3 + Math.random() * 2.5, dist: 6 + Math.random() * 5 });
      }
      if (k < 0.1) T.blasted = false;
      T.light(1.1, '#e0d0ff', [14, top + 6, z + 6]);
      // from out over the pit, looking back up at the terraces: he comes running
      // at us along the top, off the edge and down onto them
      const ck = sm(0, 1, k);
      T.look(lerp(7, 10, ck), lerp(top + 3.5, top + 1.6, ck), lerp(1.2, 2.2, ck), lerp(x, land, 0.35), lerp(y + 0.6, low + 0.9, sm(0.4, 0.75, k)), z, 50);
    },
  },

  // Brian with the M2 Flamethrower: a jet of fire into the pack coming at him;
  // they catch, stagger on burning and drop.
  flamer: {
    enter(T) { for (let i = 0; i < 7; i++) { const zz = T.zombie(157 + (i % 4) * 1.3 - 2, 17 - Math.floor(i / 4) * 1.7, { type: i % 3 ? 'walker' : 'runner', yaw: 0 }); zz.burnAt = 0.18 + (i % 4) * 0.05 + Math.floor(i / 4) * 0.12; zz.dieAt = zz.burnAt + 0.32 + Math.random() * 0.12; } },
    frame(T, u, d, k) {
      const b = { x: 157.5, z: 24.5 };
      T.pose('brian', { x: b.x, z: b.z, gun: 'M2 Flamethrower', pitch: -0.08 });
      T.face('brian', 156.5, 15);
      if (k > 0.12 && k < 0.9) T.flame('brian', V(156.5 + Math.sin(u * 3) * 1.5, 1.0, 17.5));
      T.zs.forEach((zz) => {
        if (zz.dead) return;
        T.moveZ(zz, zz.pos.x, zz.pos.z + 0.012 * (zz.burn ? 0.4 : 1), { yaw: 0, speed: zz.burn ? 0.6 : 1.5 });
        if (k > zz.burnAt) zz.burn = zz.burn || { by: 'brian' };
        if (k > zz.dieAt) T.kill(zz, V(b.x, 0, b.z), { kind: 'fire', fling: false });
      });
      T.light(0.6, '#ffb070', [b.x + 3, 6, b.z + 3]);
      T.look(b.x + lerp(2.4, 1.6, k), T.ground(b.x, b.z) + 1.55, b.z + lerp(3.2, 2.4, k), 156.2, 1.1, 17.5, 52);
    },
  },

  // The four titans, awake: the Drowned Captain, the Warden, the Fiend, the Golem.
  titans: {
    enter(T) { T.titCut = -1; },
    frame(T, u, d, k) {
      const ids = ['ship', 'research', 'trench', 'caves'];
      const i = Math.min(3, Math.floor(k * 4)), lk = k * 4 - i;
      if (i !== T.titCut) { T.titCut = i; T.wakeTitan(ids[i]); T.fx.clear(); }
      const shots = {
        // (from out over the void beside him: he's past the cliffs, and from the island the rock hides him)
        ship: [[32, 9, -219, 9, 7, -225], [27, 7.5, -220.5, 9, 9, -225], 50, '#a0ffd0'],
        research: [[124.5, 1.3, -10.5, 114, 4.5, -20], [122, 1.0, -12.5, 114, 6, -20], 46, '#ffb0a0'],
        trench: [[29, 4.6, 130.5, 40.5, 4, 118.5], [31.5, 3.6, 128, 40.5, 6, 118.5], 48, '#ffc080'],
        // (from the summit's north-west side: clear of the shrine and the standing stones)
        caves: [[-174.5, 13.8, -41.5, -164.5, 13.5, -36.5], [-173, 13.2, -40.5, -164.5, 14.5, -36.5], 50, '#b0e0ff'],
      };
      const [a, b, fov, col] = shots[ids[i]];
      T.path(a, b, sm(0, 1, lk), fov);
      T.shake = Math.max(T.shake, 0.2);
      T.light(0.6, col, [a[0], a[1] + 6, a[2]]);
      T.far = 420;
    },
  },

  // Ryan and Kearns ride the zipline off the radio mast, hanging by one hand,
  // firing down into the yard as they go.
  zipline: {
    enter(T) { for (let i = 0; i < 9; i++) T.zombie(140.5 + (i % 3) * 3, -25.4 + Math.floor(i / 3) * 1.6, { type: i % 2 ? 'runner' : 'walker', yaw: -Math.PI / 2 }); },   // (out in the yard south of the labs, under the line)
    frame(T, u, d, k) {
      const R = T.sim.rides.find((r) => r.id === 'zip_mast');
      if (!R) return;
      const hang = T.cfg.crust.ride.hang;
      const s0 = lerp(19, 38, k);
      const riders = ['ryan', 'kearns'];
      riders.forEach((id, j) => {
        const at = ridePoint(R, s0 - j * 6);
        T.pose(id, { x: at.x, z: at.z, y: at.y - hang, zip: true, pitch: -0.55 });
        const tgt = T.zs.find((zz, q) => !zz.dead && q % 2 === j) || T.zs.find((zz) => !zz.dead);
        if (tgt) { T.face(id, tgt.pos.x, tgt.pos.z); T.fire(id, V(tgt.pos.x, tgt.pos.y + 1.2, tgt.pos.z), 0.1); }
      });
      T.zs.forEach((zz, q) => {
        if (zz.dead) return;
        T.moveZ(zz, zz.pos.x + 0.01, zz.pos.z, { yaw: -Math.PI / 2, speed: 1.2 });
        if (k > 0.2 + q * 0.075) T.kill(zz, V(zz.pos.x, zz.pos.y + 6, zz.pos.z - 2), { kind: 'bullet', dist: 2, up: 0.5 });
      });
      // the camera rides along beside them, a little below
      const at = ridePoint(R, s0 - 3), dir = at.d, side = V(dir.z, 0, -dir.x).normalize();
      const cy = at.y - hang + 0.4;
      T.look(at.x - side.x * 6.5 - dir.x * 2, cy, at.z - side.z * 6.5 - dir.z * 2, at.x + side.x * 2, cy + 0.6, at.z + side.z * 2, 52);
      T.light(0.6, '#d0d8ff', [at.x - side.x * 4, cy + 8, at.z - side.z * 4]);
      T.far = 420;
    },
  },

  // The launcher, from its base: Rocco runs onto the Anvil's north pad, crouches,
  // and it throws him up over the wall toward the Ship Graveyard; the camera
  // stays low by the launcher and tilts up after him into the sky.
  launchPad: {
    enter(T) { T.launched = false; },
    frame(T, u, d, k) {
      const pads = T.sim.mapData.launchers || [];
      const A = pads.find((q) => q.id === 'pad_hub_n'), B = pads.find((q) => q.id === 'pad_ship');
      if (!A || !B) return;
      const L = T.cfg.crust.launch;
      const go = 0.3, run = sm(0, 0.22, k);
      let x, y, z;
      if (k <= go) { x = lerp(A.x - 0.6, A.x, run); z = lerp(A.z + 3.8, A.z, run); y = A.y; }
      else {
        // (the first half of the flight, sped up: off the pad, up and over the wall)
        const uu = (k - go) / (1 - go) * 0.55, e = 1 - Math.pow(1 - uu, 1.6);
        x = lerp(A.x, B.x, e); z = lerp(A.z, B.z, e);
        y = A.y + (B.y - A.y) * uu + L.apex * 4 * uu * (1 - uu);
      }
      T.pose('rocco', { x, z, y, sprint: k < 0.22, launch: k > go, crouch: k > 0.22 && k <= go, pitch: 0 });
      T.face('rocco', B.x, B.z);
      if (k > go && !T.launched) {
        T.launched = true;
        const p = V(A.x, A.y + 0.2, A.z);
        T.fx.energyBurst(p, '#7fd8ff', 3.6);
        for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; T.fx.puff(p.clone().add(V(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8)), { color: 0xc8d8e8, size: 0.6, grow: 2.6, life: 1.2, alpha: 0.55, vel: V(Math.cos(a) * 5, 0.8, Math.sin(a) * 5), shade: false }); }
        T.shake = 1.2;
      }
      if (k < 0.05) T.launched = false;
      // low at the launcher's base, just off the pad: the pad and Rocco on it; when
      // it fires the camera cranes up off the base after him (close behind, the
      // Anvil dropping away under them and the Graveyard out ahead)
      const F = T.C.launchCam;
      const base = V(A.x + F.base[0], A.y + F.base[1], A.z + F.base[2]);
      const chase = V(x + F.chase[0], y + F.chase[1], z + F.chase[2]);
      const c = base.lerp(chase, ease(sm(go, go + F.catchUp, k)));
      const him = V(x, y + 0.9, z), ahead = V(x, y - F.ahead[0], z - F.ahead[1]);
      const look = k <= go ? V(lerp(A.x - 0.3, A.x, run), A.y + lerp(1.0, 1.3, run), lerp(A.z + 1.8, A.z, run)) : him.lerp(ahead, sm(go + F.catchUp, 1, k) * 0.35);
      T.look(c.x, c.y, c.z, look.x, look.y, look.z, lerp(F.fov[0], F.fov[1], sm(go, 0.85, k)));
      // (the key light goes up with him: up there nothing else lights him)
      T.light(F.light, '#e4f0ff', [x + 2, y + 2.5, z + 4]);
      T.far = 420;
    },
  },

  // A Maisy Dog: thrown into a horde on the shore; she howls, a black hole
  // opens over her and drags every one of them in. Then her.
  maisy: {
    enter(T) {
      for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, r = 3.2 + (i % 3) * 1.5; T.zombie(6 + Math.cos(a) * r, -126 + Math.sin(a) * r, { type: 'walker' }); }
      T.dog = T.prop(maisyDog(0.6)); T.hole = null;
    },
    frame(T, u, d, k) {
      const c = V(6, T.ground(6, -126), -126);
      const tk = sm(0, 0.2, k);
      const from = V(13, c.y + 1.7, -123.5);
      T.dog.position.lerpVectors(from, c, tk); T.dog.position.y += Math.sin(tk * Math.PI) * 1.4;
      T.dog.rotation.set(tk < 1 ? u * 9 : 0, tk < 1 ? u * 5 : 0.6, tk < 1 ? u * 6 : 0);
      const openK = sm(0.3, 0.42, k) * (1 - sm(0.93, 1, k));
      if (k > 0.3 && !T.hole) { T.hole = T.prop(blackHole(T.glowTex)); T.hole.position.set(c.x, c.y + 1.3, c.z); T.fx.energyBurst(T.hole.position.clone(), '#8a4dff', 2.4); }
      if (T.hole) updateHole(T.hole, T.dt, Math.max(0.01, openK), T.fx, T.t);
      if (k > 0.85) { const l = sm(0.85, 0.97, k); T.dog.position.y = c.y + l * 1.3; T.dog.rotation.y = l * 14; T.dog.scale.setScalar(Math.max(0.02, 1 - l)); }
      T.zs.forEach((zz) => {
        if (zz.dead) return;
        if (k < 0.32) { T.moveZ(zz, zz.pos.x, zz.pos.z, { yaw: Math.atan2(c.x - zz.pos.x, c.z - zz.pos.z), speed: 0.5 }); return; }
        const dx = c.x - zz.pos.x, dz = c.z - zz.pos.z, dd = Math.hypot(dx, dz);
        const sp = (2.5 + 9 * sm(0.32, 0.8, k)) * T.dt * T.slow;
        if (dd < 1.4) { T.kill(zz, c, { vortex: { x: c.x, y: c.y + 1.3, z: c.z } }); return; }
        T.moveZ(zz, zz.pos.x + dx / dd * Math.min(dd, sp), zz.pos.z + dz / dd * Math.min(dd, sp), { yaw: Math.atan2(-dx, -dz), speed: 0 });
      });
      T.light(0.5, '#c8b0ff', [c.x + 6, c.y + 8, c.z + 6]);
      T.look(c.x + lerp(8.5, 7, k), c.y + 2.4, c.z + lerp(7.5, 6.5, k), c.x, c.y + 1.1, c.z, 52);
    },
  },

  // An LBD in the trench: they come round the corner, it wakes, pops up and goes off.
  lbd: {
    enter(T) {
      for (let i = 0; i < 5; i++) T.zombie(-27.5 - i * 1.3, 169.6 + (i % 2 ? 0.5 : -0.5), { type: i % 2 ? 'runner' : 'walker', yaw: Math.PI / 2 });
      T.baby = T.prop(lbdBaby(0.5)); T.popped = false;
    },
    frame(T, u, d, k) {
      const c = V(-21, T.ground(-21, 169.6, 6), 169.6);
      T.slow = k > 0.4 ? 0.5 : 1;
      const pop = sm(0.38, 0.6, k);
      T.baby.position.set(c.x, c.y + Math.sin(pop * Math.PI * 0.5) * 1.1, c.z);
      T.baby.rotation.y = 0.4 + pop * 9;
      T.baby.visible = k < 0.6;
      T.zs.forEach((zz, i) => !zz.dead && T.moveZ(zz, lerp(-27.5, -22.6, sm(0, 0.45, k)) - i * 1.3, zz.pos.z, { yaw: Math.PI / 2, speed: 2.5 }));
      if (k >= 0.6 && !T.popped) {
        T.popped = true;
        const p = c.clone().add(V(0, 1.1, 0));
        T.fx.explosion(p, 5); T.shake = 1.6;
        for (const zz of T.zs) T.kill(zz, p, { up: 3 + Math.random() * 2, dist: 5 + Math.random() * 4 });
      }
      if (k < 0.1) T.popped = false;
      T.light(0.6, '#ffd0a0', [c.x + 3, c.y + 5, c.z + 3]);
      T.look(c.x + 3.6, c.y + 0.55, c.z + 1.1, c.x - 1.5, c.y + 0.7, c.z, 54);
    },
  },

  // Pit at his bench by the Anvil, hammering a War Hammer out of a titan's core.
  pitForge: {
    enter(T) { T.forgeOn = true; },
    frame(T, u, d, k) {
      const E = T.sim.crustEgg;
      if (!E) return;
      E.forge.work = { kind: 'forge', element: 'fire', t: 6 + u * 1.6, strikes: 0 };
      const P = T.cfg.crust ? null : null; void P;
      const pit = T.sim.mapData.forge.pit, y = pit.y;
      // sparks off the anvil on each blow
      const every = T.cfg.crust.forge.strikeEvery, ph = (E.forge.work.t % every) / every;
      if (ph > 0.7 && ph < 0.78 && !T.struck) {
        T.struck = true;
        const at = V(pit.x + 1.1, y + 0.95, pit.z);
        for (let i = 0; i < 30; i++) T.fx.spawnParticle(at, V((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5), { life: 0.5, size: 0.012, color: [5, 2.6, 0.7], gravity: 9, drag: 0.8 });
        T.shake = Math.max(T.shake, 0.25);
      }
      if (ph < 0.5) T.struck = false;
      T.light(0.5, '#ffb070', [pit.x + 3, y + 3, pit.z + 3]);
      T.look(pit.x + lerp(3.4, 2.8, k), y + 1.7, pit.z + lerp(2.8, 2.2, k), pit.x + 0.6, y + 1.1, pit.z, 46);
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
      const [zx, zz] = T.C.zachRoarAt;   // (clear of the launcher and its power switch: he stood in them)
      const Z = T.zachAt(zx, zz, { yaw: Math.PI / 2, size: 1.0, headX: -0.24 - r * 0.55, lean: 0.2 - r * 0.35 });
      Z.armL.shoulder.rotation.set(-0.25 - r * 0.6, 0, 0.24 + r * 0.9); Z.armR.shoulder.rotation.set(-0.25 - r * 0.6, 0, -0.24 - r * 0.9);
      if (k > 0.3) T.shake = Math.max(T.shake, 0.9 * (1 - k));
      if (k > 0.3 && !T.roared) { T.roared = true; T.fx.energyBurst(V(zx, 5.4, zz), '#5aff70', 3); }
      if (k < 0.1) T.roared = false;
      T.light(0.9, '#c0ffd0', [zx + 8.5, 4, zz + 4.5]);
      T.look(zx + 6, T.ground(zx + 6, zz + 2.3) + 0.4, zz + 2.3, zx, 3.8, zz, 60, 0.05);   // (from just off the ground: never under it)
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
      T.look(175, T.ground(175, 3.6) + 0.45, 3.6, 175.5, T.ground(175.5, -2.8) + 0.6, -2.8, 54);
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
      T.look(c.x + 0.9, T.ground(c.x + 0.9, c.z - 6.2) + 0.6, c.z - 6.2, c.x, 5.6, c.z, 64, -0.06);   // (clear of the bunker beside him)
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
      const els = ['fire', 'ice', 'wind', 'lightning'], who = ['ryan', 'brian', 'kearns', 'rocco'];
      const spots = [[-25.5, 120.5], [-114, 7], [-21.5, -138.5], [160.5, -36.5]];   // (the caves one clear of its power switch and the snow tree)
      const i = Math.min(3, Math.floor(k * 4)), lk = k * 4 - i;
      const [x, z] = spots[i], y = T.ground(x, z);
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

  // Zach swings at them: bigger than ever.
  zachSwing: {
    frame(T, u, d, k) {
      const s2 = sm(0.1, 0.55, k);
      const [zx, zz] = T.C.zachSwingAt, bx = zx + 6.5, bz = zz - 1, rx = zx + 7, rz = zz + 1.6;   // (off the launcher pad: he stood in it)
      const Z = T.zachAt(zx, zz, { yaw: Math.atan2(bx - zx, bz - zz), size: 1.6, headX: -0.15, lean: 0.3 });
      Z.armR.shoulder.rotation.set(-0.25 - 1.6 * (1 - s2) - s2 * 0.2, 0, -0.24 - 1.2 * (1 - s2) + s2 * 1.3);
      Z.torso.rotation.y = lerp(0.5, -0.6, s2);
      T.pose('brian', { x: bx, z: bz, crouch: s2 > 0.4, pitch: 0.55 }); T.face('brian', zx, zz);
      T.pose('ryan', { x: rx, z: rz, pitch: 0.6 }); T.face('ryan', zx, zz);
      if (k > 0.3) { T.fire('brian', V(zx, 6, zz), 0.1); T.fire('ryan', V(zx, 7, zz), 0.12); }
      if (k > 0.5) T.shake = Math.max(T.shake, 0.7);
      T.light(0.8, '#a0ffb0', [zx + 8, 10, zz + 6]);
      T.look(zx + 10.5, T.ground(zx + 10.5, zz + 3) + 0.4, zz + 3, zx, 5.2, zz, 62);
    },
  },

  // The end: all five back to back in the middle of the base, zombies closing in
  // from every side, and Zach rising up behind them.
  finale: {
    enter(T) { for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; T.zombie(175.5 + Math.cos(a) * 9, -2.5 + Math.sin(a) * 9, { type: i % 3 ? 'walker' : 'runner' }); } },
    frame(T, u, d, k) {
      const c = { x: 175.5, z: -2.5 };
      CREW.forEach((id, i) => {
        const a = i / CREW.length * Math.PI * 2 + 0.4;
        T.pose(id, { x: c.x + Math.cos(a) * 0.8, z: c.z + Math.sin(a) * 0.8, pitch: 0.05 });
        T.face(id, c.x + Math.cos(a) * 10, c.z + Math.sin(a) * 10);
        if (k > 0.25) T.fire(id, V(c.x + Math.cos(a) * 6, 1.3, c.z + Math.sin(a) * 6), 0.11 + i * 0.01);
      });
      T.zs.forEach((zz, i) => { const a = i / 14 * Math.PI * 2, r = lerp(9, 4.2, ease(k)); T.moveZ(zz, c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, { yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) }); });
      const rise = ease(sm(0.35, 0.85, k));
      T.zachAt(c.x + 9.5, c.z, { yaw: -Math.PI / 2, size: 1.8, y: T.ground(c.x + 9.5, c.z) - 9 * (1 - rise), headX: -0.1 });
      T.zachLight.intensity = 30; T.zachLight.distance = 20;
      T.light(0.5, '#d0d8ff', [c.x - 10, 15, c.z + 10]);
      const a = lerp(2.3, 2.75, k);
      T.look(c.x + Math.cos(a) * lerp(7, 9.5, k), lerp(1.3, 2.6, k), c.z + Math.sin(a) * lerp(7, 9.5, k), c.x + 2, lerp(1.4, 4.2, rise), c.z, 52);
    },
  },
};
