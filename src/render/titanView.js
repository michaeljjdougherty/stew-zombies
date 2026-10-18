// =============================================================================
// The titans, drawn (src/sim/crustEgg.js runs them). Their models are the ones
// already standing on each island (the map tags them: titan_<island>); this
// moves them, leans and bobs them as they walk, winds them up before a blow,
// and draws everything round them: the telegraph rings, the Warden's laser,
// the coils' lightning, the icicle clusters, the shells and the magma.
// =============================================================================
import * as THREE from 'three';
import * as TX from './textures.js';
import { captainMouth } from '../sim/crustEgg.js';

const v3 = (p) => new THREE.Vector3(p.x, p.y, p.z);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const COLORS = { stomp: '#ff6a30', slam: '#8fd8ff', nova: '#9fe8ff', erupt: '#ff5a10', shard: '#a8e4ff', lob: '#ff7a20', burn: '#ff4a08', laser: '#ff2a2a', land: '#ffb060' };

export class TitanView {
  constructor(scene, sim, cfg, map, effects) {
    this.scene = scene; this.sim = sim; this.cfg = cfg; this.map = map; this.effects = effects;
    this.group = new THREE.Group();
    this.group.name = 'titans';
    scene.add(this.group);
    this.views = {};        // per titan: the model's holder and its own bits
    this.rings = [];        // telegraphs on the ground
    this.fx = [];           // short-lived things (bolts, beams, shells, magma)
    this.hazards = new Map();
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 64, 1);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.discGeo = new THREE.CircleGeometry(1, 48);
    this.discGeo.rotateX(-Math.PI / 2);
    this.glowTex = TX.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.buildClusters();
    this.buildCoils();
  }

  setSim(sim) {
    this.sim = sim;
    for (const r of this.rings) this.group.remove(r.mesh);
    for (const f of this.fx) this.group.remove(f.obj);
    for (const [id, hv] of this.hazards) this.dropHazard(id, hv);
    this.rings = []; this.fx = [];
    for (const v of Object.values(this.views)) this.restore(v);
  }

  E() { return this.sim && this.sim.crustEgg; }

  // --- the model of titan `id` (once its file has loaded) ----------------------
  view(id) {
    if (this.views[id]) return this.views[id];
    const tagged = this.map.crust && this.map.crust.tagged;
    const holder = tagged && tagged['titan_' + id];
    if (!holder) return null;
    const v = this.views[id] = {
      id, holder, home: holder.position.clone(), rot: holder.rotation.clone(),
      pos: holder.position.clone(), yaw: holder.rotation.y, phase: 0, lean: 0, roll: 0, sink: 0, shake: 0,
      mats: [], glow: null, heart: null, light: null, baseScale: holder.scale.x,
    };
    holder.traverse((o) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (m && m.emissive) v.mats.push({ m, e: m.emissive.clone(), k: m.emissiveIntensity ?? 1 }); } });
    // its eyes / core: a glow that lights up when it wakes
    const col = { ship: '#6dffb0', research: '#ff3020', caves: '#7ad8ff', trench: '#ff7a1a' }[id];
    const gm = new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(col).multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    v.glow = new THREE.Sprite(gm);
    const G = this.cfg.crust.egg.look[id];
    v.glow.position.set(0, G.eyeY, G.eyeZ);
    v.glow.scale.setScalar(G.eyeSize);
    this.group.add(v.glow);
    v.light = new THREE.PointLight(new THREE.Color(col), 0, G.lightRange, 1.6);
    this.group.add(v.light);
    if (id === 'research') this.rigWalker(v);
    if (id === 'caves') {
      // its heart: shows when it's on its knees
      const hm = new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(0.8, 2.2, 4.5), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 });
      v.heart = new THREE.Sprite(hm);
      v.heart.scale.setScalar(1.4);
      v.heart.renderOrder = 5;
      this.group.add(v.heart);
      v.heartLight = new THREE.PointLight(0x6ac8ff, 0, 9, 1.6);
      this.group.add(v.heartLight);
    }
    return v;
  }

  // The Warden is a two-legged walker built of loose parts: gather each leg's
  // parts under a hip joint so the legs can swing as it walks.
  rigWalker(v) {
    const h = v.holder;
    h.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(h.matrixWorld).invert();
    const box = new THREE.Box3(), all = new THREE.Box3();
    const parts = [];
    h.traverse((o) => { if (o.isMesh) { box.setFromObject(o).applyMatrix4(inv); all.union(box); parts.push({ o, c: box.getCenter(new THREE.Vector3()), top: box.max.y }); } });
    const H = all.max.y - all.min.y, cx = (all.min.x + all.max.x) / 2, cz = (all.min.z + all.max.z) / 2, y0 = all.min.y;
    v.legs = [];
    for (const side of [1, -1]) {
      const hip = new THREE.Group();
      hip.position.set(cx + 0.11 * H, y0 + 0.69 * H, cz + side * 0.31 * H);
      h.add(hip);
      hip.updateMatrixWorld(true);
      for (const p of parts) if ((p.c.z - cz) * side > 0.262 * H && p.top < y0 + 0.745 * H) hip.attach(p.o);
      v.legs.push({ hip, side, y: hip.position.y, lift: 0.04 * H });
    }
  }

  restore(v) {
    v.holder.position.copy(v.home); v.holder.rotation.copy(v.rot); v.holder.visible = true; v.holder.scale.setScalar(v.baseScale);
    v.pos.copy(v.home); v.yaw = v.rot.y; v.sink = 0; v.lean = 0; v.roll = 0;
    if (v.glow) v.glow.material.opacity = 0;
    if (v.light) v.light.intensity = 0;
    this.setHeat(v, 0);
  }

  // brighten (or dim) its own glow: a woken titan's hot core, a dying one going dark
  setHeat(v, k) {
    for (const x of v.mats) { x.m.emissive.copy(x.e).multiplyScalar(1 + k); }
  }

  // --- per frame ----------------------------------------------------------------
  update(dt, time, camera) {
    const E = this.E();
    if (!E) return;
    const look = this.cfg.crust.egg.look;
    for (const T of Object.values(E.titans)) {
      const v = this.view(T.id);
      if (!v) continue;
      const L = look[T.id];
      if (T.state === 'asleep') {
        if (v.dirty) { this.restore(v); v.dirty = false; }
        continue;
      }
      if (T.state === 'dead') { v.holder.visible = false; v.glow.material.opacity = 0; v.light.intensity = 0; if (v.heart) v.heart.material.opacity = 0; continue; }
      v.dirty = true;
      v.holder.visible = true;
      const a = T.act;
      const k = Math.min(1, dt * 10);
      // where it is (the ship's head rises when it wakes, then follows you through the air)
      if (T.id === 'ship') {
        const c = this.cfg.crust.egg.ship;
        const up = T.state === 'waking' ? sm(0, this.cfg.crust.egg.wakeTime.ship, T.t) * c.rise : T.state === 'dying' ? c.rise - sm(0, this.cfg.crust.egg.dyingTime, T.t) * (c.rise + 18) : c.rise;
        v.pos.set(T.pos.x, T.pos.y + up, T.pos.z);
        const turned = T.yaw - (T.home.yaw - (L.face || 0));
        let tilt = Math.sin(time * 0.6) * 0.02;
        if (a && a.kind === 'inhaleWarn') tilt -= sm(0, c.inhaleWarn, a.t) * 0.16;
        else if (a && a.kind === 'inhale') tilt -= 0.16 - Math.sin(time * 20) * 0.01;
        else if (a && a.kind === 'exhale') tilt += 0.1 * (1 - sm(0, c.exhaleTime, a.t));
        v.holder.position.copy(v.pos);
        v.holder.position.x += (Math.random() - 0.5) * (T.state === 'waking' || T.state === 'dying' ? 0.12 : 0);
        v.holder.rotation.set(v.rot.x + tilt, v.rot.y + turned + Math.sin(time * 0.4) * 0.03, v.rot.z + (T.state === 'dying' ? T.t * 0.08 : 0), 'YXZ');
      } else {
        v.pos.x += (T.pos.x - v.pos.x) * k; v.pos.y += (T.pos.y - v.pos.y) * k; v.pos.z += (T.pos.z - v.pos.z) * k;
        if (a && a.kind === 'leap') v.pos.set(T.pos.x, T.pos.y, T.pos.z);
        let dy = angleDiff(T.yaw + L.face, v.yaw);
        v.yaw += dy * Math.min(1, dt * 6);
        // walking: a heavy sway and bob
        const spd = T.moveSpeed || 0;
        v.phase += dt * spd * L.stride;
        const walk = Math.min(1, spd / 1.5);
        let bob = Math.abs(Math.sin(v.phase)) * L.bob * walk, lean = L.leanWalk * walk, roll = Math.sin(v.phase) * L.roll * walk;
        if (v.legs) for (const g of v.legs) {
          // (its front is the model's -x: a forward swing turns the leg about +z)
          const s = Math.sin(v.phase) * g.side;
          g.hip.rotation.z += (s * 0.38 * walk - g.hip.rotation.z) * Math.min(1, dt * 12);
          g.hip.position.y = g.y + Math.max(0, Math.cos(v.phase) * g.side) * g.lift * walk;
        }
        let sink = 0, shake = 0;
        if (T.state === 'waking') { const u = sm(0, this.cfg.crust.egg.wakeTime[T.id], T.t); sink = (1 - u) * L.wakeSink; shake = (1 - u) * 0.06; lean = -0.1 * Math.sin(u * Math.PI); }
        if (a) {
          if (a.kind === 'stomp' || a.kind === 'slam') {
            const w = T.id === 'research' ? this.cfg.crust.egg.research.stompWarn : this.cfg.crust.egg.caves.slamWarn;
            lean = a.t < w ? -0.18 * sm(0, w, a.t) : 0.22 * (1 - sm(w, w + 0.6, a.t));
            bob = a.t < w ? 0.5 * sm(0, w, a.t) : 0;
          } else if (a.kind === 'laser') { lean = -0.06; shake = a.fired ? 0.04 : 0.01; }
          else if (a.kind === 'struck') { const u = sm(0, 0.6, a.t); lean = 0.18 * u; roll = Math.sin(time * 31) * 0.05 * (1 - sm(0, this.cfg.crust.egg.research.stun, a.t)); sink = 0.4 * u; shake = 0.05; }
          else if (a.kind === 'kneel') { const u = sm(0, 0.5, a.t); lean = 0.4 * u; sink = L.kneelSink * u; }
          else if (a.kind === 'rise') { const u = 1 - sm(0, this.cfg.crust.egg.caves.riseTime, a.t); lean = 0.4 * u; sink = L.kneelSink * u; shake = 0.03 * u; }
          else if (a.kind === 'nova') { lean = -0.12 * sm(0, this.cfg.crust.egg.caves.novaWarn, a.t); shake = 0.03; }
          else if (a.kind === 'erupt') { shake = 0.05 + 0.1 * sm(0, this.cfg.crust.egg.trench.eruptTime, a.t); lean = -0.15 * sm(0, this.cfg.crust.egg.trench.eruptTime, a.t); }
          else if (a.kind === 'lob') { lean = -0.25 * Math.sin(Math.min(1, a.t / 0.7) * Math.PI); }
          else if (a.kind === 'stagger') { const u = 1 - sm(0, this.cfg.crust.egg.trench.stagger, a.t); lean = -0.3 * u * (0.6 + 0.4 * Math.sin(a.t * 9)); shake = 0.08 * u; }
          else if (a.kind === 'leap' && !a.burrow) { lean = 0.15; }
        }
        if (T.state === 'dying') {
          const u = sm(0, this.cfg.crust.egg.dyingTime, T.t);
          if (T.id === 'research') { lean = 1.45 * sm(0.3, 1, u); shake = 0.06 * (1 - u); }
          else if (T.id === 'caves') { shake = 0.08; sink = u * 1.5; v.holder.scale.setScalar(v.baseScale * (1 - 0.6 * sm(0.5, 1, u))); }
          else { sink = u * 8; shake = 0.04; }
        }
        v.lean += (lean - v.lean) * Math.min(1, dt * 8);
        v.roll += (roll - v.roll) * Math.min(1, dt * 8);
        v.sink += (sink - v.sink) * Math.min(1, dt * 6);
        v.holder.position.set(v.pos.x + (Math.random() - 0.5) * shake * 2, v.pos.y + bob - v.sink + (L.lift || 0), v.pos.z + (Math.random() - 0.5) * shake * 2);
        v.holder.rotation.set(v.lean, v.yaw, v.roll, 'YXZ');
        // footfalls: dust (snow) and a thud
        if (walk > 0.3 && Math.floor(v.phase / Math.PI) !== v.lastStep) {
          v.lastStep = Math.floor(v.phase / Math.PI);
          this.effects.puff(new THREE.Vector3(T.pos.x + Math.cos(v.yaw) * (v.lastStep % 2 ? 0.9 : -0.9), T.pos.y + 0.2, T.pos.z - Math.sin(v.yaw) * (v.lastStep % 2 ? 0.9 : -0.9)), { color: T.id === 'trench' ? 0x3a2a22 : 0xb8c2d0, size: 0.7, grow: 2.2, life: 1.0, alpha: 0.35 });
        }
      }
      // its eyes / glow
      const awake = T.state === 'fight' ? 1 : T.state === 'waking' ? sm(0, this.cfg.crust.egg.wakeTime[T.id], T.t) : T.state === 'dying' ? 1 - sm(0, this.cfg.crust.egg.dyingTime * 0.8, T.t) : 0;
      let flare = 0;
      if (a && (a.kind === 'laser' || a.kind === 'inhale' || a.kind === 'erupt' || a.kind === 'nova')) flare = 0.6 + Math.sin(time * 25) * 0.3;
      if (a && a.kind === 'struck') flare = Math.random();
      const fy = v.holder.rotation.y - L.face, fwd = new THREE.Vector3(Math.sin(fy), 0, Math.cos(fy));
      const eye = v.holder.position.clone().addScaledVector(fwd, L.eyeZ + v.lean * L.eyeY * 0.8); eye.y += L.eyeY;
      v.glow.position.copy(eye);
      v.glow.material.opacity = awake * (0.75 + flare * 0.5);
      v.glow.scale.setScalar(L.eyeSize * (1 + flare * 0.5));
      v.light.position.copy(eye);
      v.light.intensity = awake * L.light * (1 + flare);
      this.setHeat(v, awake * L.heat + flare * L.heat);
      if (v.heart) {
        const open = a && a.kind === 'kneel' ? sm(0, 0.5, a.t) : 0;
        const hp = v.holder.position.clone().addScaledVector(fwd, L.heartZ + v.lean * L.heartY * 0.8); hp.y += L.heartY;
        v.heart.position.copy(hp);
        v.heart.material.opacity = open * (0.8 + Math.sin(time * 9) * 0.2);
        v.heart.scale.setScalar(1.4 + open * 1.4 + Math.sin(time * 9) * 0.25);
        v.heartLight.position.copy(hp);
        v.heartLight.intensity = open * (10 + Math.sin(time * 9) * 3);
      }
      // the Warden's laser: a thin aiming line while it locks on
      if (T.id === 'research') this.updateAim(v, T, a, time);
    }
    if (camera) this.updateBreath(dt, camera.position);
    this.updateClusters(E, dt, time);
    this.updateCoils(E, time);
    this.updateRings(dt, time);
    this.updateHazards(E, dt, time);
    this.updateFx(dt, time);
  }

  updateAim(v, T, a, time) {
    if (!v.aim) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      v.aim = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(4, 0.3, 0.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      v.aim.frustumCulled = false;
      this.group.add(v.aim);
    }
    const on = a && a.kind === 'laser' && !a.fired && a.aim;
    v.aim.visible = !!on;
    if (!on) return;
    const arr = v.aim.geometry.attributes.position.array;
    arr[0] = v.glow.position.x; arr[1] = v.glow.position.y; arr[2] = v.glow.position.z;
    const dx = a.aim.x - arr[0], dy = a.aim.y - arr[1], dz = a.aim.z - arr[2], l = Math.hypot(dx, dy, dz) || 1, L = this.cfg.crust.egg.research.laserLen;
    arr[3] = arr[0] + dx / l * L; arr[4] = arr[1] + dy / l * L; arr[5] = arr[2] + dz / l * L;
    v.aim.geometry.attributes.position.needsUpdate = true;
    v.aim.material.opacity = 0.4 + 0.6 * (Math.sin(time * 40) > 0 ? 1 : 0.4);
  }

  // --- a ring on the ground: where something's about to go off -------------------
  ring(pos, radius, color, dur, { fill = true, grow = false } = {}) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(fill ? this.discGeo : this.ringGeo, mat);
    mesh.position.set(pos.x, (pos.y || 0) + 0.08, pos.z);
    mesh.scale.setScalar(grow ? 0.01 : radius);
    mesh.renderOrder = 3;
    this.group.add(mesh);
    const edge = new THREE.Mesh(this.ringGeo, mat.clone());
    edge.scale.setScalar(1);
    mesh.add(edge);
    const r = { mesh, edge, t: 0, dur, radius, grow, follow: null };
    this.rings.push(r);
    return r;
  }

  updateRings(dt, time) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const u = r.t / r.dur;
      if (r.follow) r.mesh.position.set(r.follow.x, r.follow.y + 0.08, r.follow.z);
      if (r.grow) r.mesh.scale.setScalar(Math.max(0.01, r.radius * u));
      else r.mesh.scale.setScalar(r.radius);
      const pulse = 0.5 + 0.5 * Math.sin(time * (8 + u * 18));
      r.mesh.material.opacity = 0.12 + 0.18 * u * pulse;
      r.edge.material.opacity = 0.5 + 0.5 * pulse;
      if (u >= 1) { this.group.remove(r.mesh); this.free(r.mesh); this.rings.splice(i, 1); }
    }
  }

  // a short-lived thing's own geometry and materials, once it's gone (a long
  // fight makes hundreds of them)
  free(obj) {
    obj.traverse((o) => {
      if (o.geometry && o.geometry !== this.ringGeo && o.geometry !== this.discGeo) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  // --- the icicle clusters -----------------------------------------------------
  buildClusters() {
    const s = this.sim.mapData.titans && this.sim.mapData.titans.find((t) => t.id === 'caves');
    this.clusterViews = [];
    if (!s) return;
    const ice = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.7, 0.88, 1.0), emissive: new THREE.Color(0.15, 0.4, 0.75), roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 });
    const cone = new THREE.ConeGeometry(1, 1, 7, 1);
    cone.rotateX(Math.PI);   // point down
    cone.translate(0, -0.5, 0);
    for (const c of s.clusters) {
      const g = new THREE.Group();
      let seed = Math.abs(Math.round(c.x * 13 + c.z * 7));
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 11; i++) {
        const m = new THREE.Mesh(cone, ice);
        const a = rnd() * 6.28, r = i ? 0.3 + rnd() * 0.9 : 0;
        const len = i ? 1.2 + rnd() * 1.6 : 3;
        m.position.set(Math.cos(a) * r, 0.6, Math.sin(a) * r);
        m.scale.set(0.22 + rnd() * 0.18, len, 0.22 + rnd() * 0.18);
        g.add(m);
      }
      // a cold glow on it: something to shoot at
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(0.4, 1.1, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
      glow.scale.setScalar(3.2); glow.position.y = -0.4;
      g.add(glow);
      g.position.set(c.x, c.y, c.z);
      this.group.add(g);
      this.clusterViews.push({ g, glow, base: c.y });
    }
  }

  updateClusters(E, dt, time) {
    const c = this.cfg.crust.egg.caves;
    E.clusters.forEach((k, i) => {
      const v = this.clusterViews[i];
      if (!v) return;
      const live = E.active === 'caves';
      if (k.state === 'hang') {
        v.g.visible = true;
        v.g.position.y = v.base + Math.sin(time * 0.7 + i) * 0.03;
        v.g.scale.setScalar(Math.min(1, (v.g.scale.x || 0) + dt * 0.6));
        v.glow.material.opacity = live ? 0.55 + 0.25 * Math.sin(time * 3 + i) : 0.12;
        v.g.rotation.set(0, 0, 0);
      } else if (k.state === 'fall') {
        const u = Math.min(1, k.t / c.fall);
        v.g.position.y = v.base + (k.ground - v.base + 1.2) * u * u;
        v.g.rotation.z = u * 0.2;
        v.glow.material.opacity = 0.9;
      } else { v.g.visible = false; v.g.scale.setScalar(0.01); }
    });
  }

  // --- the coils: a light at the top while charged -------------------------------
  buildCoils() {
    const s = this.sim.mapData.titans && this.sim.mapData.titans.find((t) => t.id === 'research');
    this.coilViews = [];
    if (!s) return;
    for (const c of s.coils) {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(1.2, 1.8, 4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      glow.position.set(c.x, c.y, c.z);
      glow.scale.setScalar(4);
      this.group.add(glow);
      // the console at its foot
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.6, metalness: 0.4 }));
      box.position.set(c.con.x, c.con.y + 0.6, c.con.z);
      this.group.add(box);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.3, 0.35) }));
      lamp.position.set(c.con.x, c.con.y + 1.0, c.con.z - 0.27);
      this.group.add(lamp);
      this.coilViews.push({ glow, lamp });
    }
  }

  updateCoils(E, time) {
    E.coils.forEach((k, i) => {
      const v = this.coilViews[i];
      if (!v) return;
      const live = E.active === 'research';
      const cool = this.sim.time < k.coolUntil;
      v.glow.material.opacity = k.ready ? 0.8 + 0.2 * Math.sin(time * 30) : k.charge * 0.5;
      v.glow.scale.setScalar(k.ready ? 5 + Math.random() : 2 + k.charge * 3);
      v.lamp.material.color.setRGB(...(k.ready ? [0.4, 1.6, 3] : cool ? [2, 0.3, 0.2] : live ? [0.5 + k.charge * 2, 1.2, 0.3] : [0.3, 0.3, 0.35]));
      if (k.ready && Math.random() < 0.08) this.bolt({ x: k.x + (Math.random() - 0.5) * 4, y: k.y - Math.random() * 3, z: k.z + (Math.random() - 0.5) * 4 }, { x: k.x, y: k.y, z: k.z }, 0.12, 0.6);
    });
  }

  // --- ground hazards: shards, magma, burning pools -----------------------------
  updateHazards(E, dt, time) {
    const live = new Set();
    for (const h of E.hazards) {
      live.add(h.id);
      let hv = this.hazards.get(h.id);
      if (!hv) {
        hv = { obj: new THREE.Group(), kind: h.kind, went: false };
        if (h.kind === 'burn') {
          const m = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.9, 0.15), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
          m.scale.setScalar(h.r); m.position.y = 0.06;
          hv.obj.add(m); hv.disc = m;
          // (one of the map's pooled lights, not a new one: adding a light to the
          // scene rebuilds every shader, which froze the game for seconds at a time)
          hv.light = this.map.addVirtualLight({ x: h.x, y: h.y + 0.6, z: h.z }, 0xff6a18, 6, h.r * 4, 1.8); hv.light.live = true; hv.light.level = 0;
        } else {
          hv.ring = this.ring(h, h.r, COLORS[h.kind] || '#ffffff', Math.max(0.1, h.at - this.sim.time), { fill: true });
        }
        hv.obj.position.set(h.x, h.y, h.z);
        this.group.add(hv.obj);
        this.hazards.set(h.id, hv);
        // a magma ball on its way from the Fiend's hand
        if (h.kind === 'lob' && h.from) this.magma(h.from, h, Math.max(0.2, h.at - this.sim.time));
      }
      if (h.kind === 'burn') {
        const left = h.until - this.sim.time;
        hv.disc.material.opacity = Math.min(1, left) * (0.55 + 0.2 * Math.sin(time * 7 + h.id));
        hv.light.level = Math.min(1, left) * (5 + Math.sin(time * 11 + h.id) * 1.5) / 6;
        if (Math.random() < dt * 8) this.effects.spawnParticle(new THREE.Vector3(h.x + (Math.random() - 0.5) * h.r, h.y + 0.1, h.z + (Math.random() - 0.5) * h.r), new THREE.Vector3(0, 1.5 + Math.random() * 1.5, 0), { life: 0.7, size: 0.03, color: [4, 1.2, 0.2], gravity: -1, drag: 0.5 });
      }
      if (h.went && !hv.went) {
        hv.went = true;
        if (h.kind === 'shard') this.shards(h);
      }
    }
    for (const [id, hv] of this.hazards) if (!live.has(id)) this.dropHazard(id, hv);
  }

  dropHazard(id, hv) {
    this.group.remove(hv.obj);
    if (hv.light) this.map.removeVirtualLight(hv.light);
    if (hv.disc) hv.disc.material.dispose();
    this.hazards.delete(id);
  }

  shards(h) {
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.7, 0.9, 1.0), emissive: new THREE.Color(0.2, 0.5, 0.9), roughness: 0.1, transparent: true, opacity: 0.92 });
    const g = new THREE.Group();
    const cone = new THREE.ConeGeometry(1, 1, 6, 1); cone.translate(0, 0.5, 0);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(cone, mat);
      const a = Math.random() * 6.28, r = Math.random() * h.r * 0.8;
      m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      m.scale.set(0.25 + Math.random() * 0.2, 1.2 + Math.random() * 1.8, 0.25 + Math.random() * 0.2);
      m.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
      g.add(m);
    }
    g.position.set(h.x, h.y, h.z);
    this.group.add(g);
    this.fx.push({ obj: g, t: 0, dur: 1.4, kind: 'shard' });
    for (let i = 0; i < 18; i++) this.effects.spawnParticle(new THREE.Vector3(h.x, h.y + 0.3, h.z), new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6), { life: 0.8, size: 0.03, color: [1.4, 1.8, 2.4], gravity: 10, drag: 0.6 });
  }

  magma(from, to, dur) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.25) }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(3, 0.9, 0.15), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(2.4); m.add(glow);
    this.group.add(m);
    this.fx.push({ obj: m, t: 0, dur, kind: 'arc', from: v3(from), to: v3(to), h: 6 + from.y * 0.3, trail: [3, 1, 0.2], boom: 'magma' });
  }

  // a jagged bolt of lightning between two points
  bolt(a, b, life = 0.35, width = 1) {
    const N = 16;
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(N * 3);
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1), j = (i === 0 || i === N - 1) ? 0 : len * 0.05 * width;
      arr[i * 3] = a.x + dx * t + (Math.random() - 0.5) * j * 2;
      arr[i * 3 + 1] = a.y + dy * t + (Math.random() - 0.5) * j * 2;
      arr[i * 3 + 2] = a.z + dz * t + (Math.random() - 0.5) * j * 2;
    }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(2.5, 3, 5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    l.frustumCulled = false;
    this.group.add(l);
    this.fx.push({ obj: l, t: 0, dur: life, kind: 'fade' });
  }

  beam(from, to, color, width, life) {
    const d = new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
    const len = d.length();
    const geo = new THREE.CylinderGeometry(width, width, len, 8, 1, true);
    geo.translate(0, len / 2, 0); geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.position.set(from.x, from.y, from.z);
    m.lookAt(to.x, to.y, to.z);
    this.group.add(m);
    this.fx.push({ obj: m, t: 0, dur: life, kind: 'fade', shrink: true });
    const core = m.clone(); core.material = m.material.clone(); core.material.color.setRGB(5, 5, 5); core.scale.set(0.35, 0.35, 1);
    this.group.add(core);
    this.fx.push({ obj: core, t: 0, dur: life, kind: 'fade', shrink: true });
  }

  updateFx(dt, time) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      const u = Math.min(1, f.t / f.dur);
      if (f.kind === 'fade') {
        const m = f.obj.material;
        if (m) { m.opacity = 1 - u; m.transparent = true; }
        if (f.shrink) { f.obj.scale.x = f.obj.scale.y = (f.obj.userData.s0 || (f.obj.userData.s0 = f.obj.scale.x)) * (1 - u * 0.8); }
      } else if (f.kind === 'shard') {
        const k = u < 0.15 ? u / 0.15 : 1 - sm(0.7, 1, u);
        f.obj.scale.set(1, Math.max(0.01, k), 1);
      } else if (f.kind === 'arc') {
        f.obj.position.lerpVectors(f.from, f.to, u);
        f.obj.position.y += Math.sin(Math.PI * u) * f.h;
        if (Math.random() < 0.7) this.effects.spawnParticle(f.obj.position.clone(), new THREE.Vector3((Math.random() - 0.5), Math.random(), (Math.random() - 0.5)), { life: 0.5, size: 0.03, color: f.trail, gravity: 1, drag: 1 });
        if (u >= 1 && f.boom === 'magma') {
          this.effects.smallExplosion(f.to, 2.2);
          for (let k = 0; k < 20; k++) this.effects.spawnParticle(f.to.clone().setY(f.to.y + 0.3), new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 5, (Math.random() - 0.5) * 7), { life: 0.9, size: 0.035, color: [4, 1.2, 0.2], gravity: 12, drag: 0.4 });
        }
      }
      if (f.t >= f.dur) { this.group.remove(f.obj); this.free(f.obj); this.fx.splice(i, 1); }
    }
  }

  // --- what happened ------------------------------------------------------------
  onEvent(e, R) {
    const E = this.E();
    if (!E) return;
    const T = e.id && E.titans[e.id];
    switch (e.type) {
      case 'titanWake': {
        if (T && T.id !== 'ship') for (let i = 0; i < 10; i++) this.effects.puff(new THREE.Vector3(T.pos.x + (Math.random() - 0.5) * 4, T.pos.y + 0.3, T.pos.z + (Math.random() - 0.5) * 4), { color: T.id === 'trench' ? 0x3a2418 : 0xc0c8d4, size: 1.2, grow: 3, life: 2.4, alpha: 0.5, vel: new THREE.Vector3(0, 0.8, 0) });
        R.shake(0.6);
        break;
      }
      case 'titanRoar': R.shake(0.8); break;
      case 'titanWindup':
        if (e.kind === 'laser') break;
        if (e.pos) { const r = this.ring(e.pos, e.radius, COLORS[e.kind] || '#ffffff', e.warn, { fill: true, grow: e.kind === 'erupt' }); if (T) r.follow = T.pos; }
        break;
      case 'titanSmash': {
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; this.effects.puff(new THREE.Vector3(e.pos.x + Math.cos(a) * 1.5, e.pos.y + 0.3, e.pos.z + Math.sin(a) * 1.5), { color: e.kind === 'slam' ? 0xd8e6f4 : 0x8a8478, size: 0.9, grow: 3, life: 1.2, alpha: 0.45, vel: new THREE.Vector3(Math.cos(a) * 6, 0.4, Math.sin(a) * 6) }); }
        this.ring(e.pos, e.radius, e.kind === 'slam' ? '#bfe8ff' : '#ffb070', 0.35, { fill: false, grow: true });
        R.shake(0.9, e.pos, 25);
        break;
      }
      case 'titanLaser': this.beam(e.from, e.to, '#ff2a1a', 0.32, 0.45); R.shake(0.3, e.from, 30); this.effects.smallExplosion(e.to, 1.4); break;
      case 'coilStrike': {
        for (let i = 0; i < 4; i++) this.bolt(e.from, { x: e.to.x + (Math.random() - 0.5), y: e.to.y + (Math.random() - 0.5) * 2, z: e.to.z + (Math.random() - 0.5) }, 0.5 + i * 0.12, 1.2);
        this.effects.energyBurst(e.to, '#9fd0ff', 3.5);
        for (let i = 0; i < 40; i++) this.effects.spawnParticle(v3(e.to), new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 7, (Math.random() - 0.5) * 9), { life: 0.6, size: 0.02, color: [2.5, 3, 5], gravity: 8, drag: 1 });
        R.flash = Math.max(R.flash || 0, 0.4);
        R.shake(0.7, e.to, 40);
        break;
      }
      case 'coilCharged': this.bolt({ x: e.pos.x, y: e.pos.y + 6, z: e.pos.z }, e.pos, 0.3, 1); break;
      case 'clusterFall': for (let i = 0; i < 10; i++) this.effects.spawnParticle(v3(e.from), new THREE.Vector3((Math.random() - 0.5) * 3, -1, (Math.random() - 0.5) * 3), { life: 1.0, size: 0.03, color: [1.4, 1.8, 2.4], gravity: 9, drag: 0.4 }); break;
      case 'clusterLand': {
        for (let i = 0; i < 40; i++) this.effects.spawnParticle(new THREE.Vector3(e.pos.x, e.pos.y + 0.5, e.pos.z), new THREE.Vector3((Math.random() - 0.5) * 10, 1 + Math.random() * 6, (Math.random() - 0.5) * 10), { life: 1.1, size: 0.04, color: [1.4, 1.8, 2.4], gravity: 12, drag: 0.4 });
        for (let i = 0; i < 6; i++) this.effects.puff(new THREE.Vector3(e.pos.x + (Math.random() - 0.5) * 3, e.pos.y + 0.4, e.pos.z + (Math.random() - 0.5) * 3), { color: 0xd8e6f4, size: 1, grow: 2.5, life: 1.4, alpha: 0.5 });
        R.shake(e.hit ? 1 : 0.6, e.pos, 25);
        break;
      }
      case 'titanHeart': {
        for (let i = 0; i < 50; i++) this.effects.spawnParticle(v3(e.pos), new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8), { life: 1, size: 0.035, color: [1.2, 2.2, 4], gravity: 9, drag: 0.5 });
        this.effects.energyBurst(e.pos, '#8fd8ff', 3);
        R.flash = Math.max(R.flash || 0, 0.25);
        break;
      }
      case 'titanNova': this.ring(e.pos, e.radius, '#bff0ff', 0.6, { fill: false, grow: true }); this.effects.energyBurst({ x: e.pos.x, y: e.pos.y + 1.5, z: e.pos.z }, '#bff0ff', e.radius * 0.5); break;
      case 'titanErupt': {
        this.effects.explosion({ x: e.pos.x, y: e.pos.y + 1, z: e.pos.z }, e.radius * 0.7);
        for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = Math.random() * e.radius; this.effects.spawnParticle(new THREE.Vector3(e.pos.x + Math.cos(a) * r, e.pos.y + 0.3, e.pos.z + Math.sin(a) * r), new THREE.Vector3(0, 6 + Math.random() * 8, 0), { life: 1.3, size: 0.06, color: [4, 1.2, 0.2], gravity: 12, drag: 0.3 }); }
        R.shake(1.2, e.pos, 40);
        break;
      }
      case 'titanHurt': {
        this.effects.energyBurst({ x: e.pos.x, y: e.pos.y + 3, z: e.pos.z }, '#ffb050', 4);
        R.shake(0.6, e.pos, 40);
        break;
      }
      case 'fieldGunFire': {
        this.effects.muzzle(v3(e.from));
        for (let i = 0; i < 6; i++) this.effects.puff(v3(e.from), { color: 0x6a6258, size: 0.8, grow: 3, life: 1.8, alpha: 0.5, vel: new THREE.Vector3((Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2) });
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2, 1) }));
        this.group.add(s);
        const h = e.direct ? 0.5 : 10 + Math.hypot(e.to.x - e.from.x, e.to.z - e.from.z) * 0.25;   // (fired straight from a manned gun: barely an arc)
        this.fx.push({ obj: s, t: 0, dur: e.dur, kind: 'arc', from: v3(e.from), to: v3(e.to), h, trail: [1.2, 1, 0.8] });
        // where it'll land
        this.ring(e.to, this.cfg.crust.egg.trench.hitRadius, '#ffd070', e.dur, { fill: false });
        R.shake(0.5, e.from, 12);
        break;
      }
      case 'titanLeap': {
        if (e.burrow) for (let i = 0; i < 8; i++) this.effects.puff(new THREE.Vector3(e.from.x + (Math.random() - 0.5) * 3, e.from.y + 0.3, e.from.z + (Math.random() - 0.5) * 3), { color: e.id === 'trench' ? 0x3a2418 : 0xc8d2e0, size: 1, grow: 3, life: 1.6, alpha: 0.5 });
        else for (let i = 0; i < 20; i++) this.effects.spawnParticle(new THREE.Vector3(e.from.x, e.from.y + 0.5, e.from.z), new THREE.Vector3((Math.random() - 0.5) * 3, -2 - Math.random() * 3, (Math.random() - 0.5) * 3), { life: 0.6, size: 0.05, color: [4, 2, 0.6], gravity: 2, drag: 1 });
        this.ring(e.to, this.cfg.crust.egg.leap.radius, COLORS.land, e.dur, { fill: true });
        break;
      }
      case 'titanLand': {
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; this.effects.puff(new THREE.Vector3(e.pos.x + Math.cos(a), e.pos.y + 0.3, e.pos.z + Math.sin(a)), { color: e.id === 'trench' ? 0x3a2418 : 0xc0c8d4, size: 1, grow: 3, life: 1.3, alpha: 0.5, vel: new THREE.Vector3(Math.cos(a) * 5, 0.5, Math.sin(a) * 5) }); }
        R.shake(1, e.pos, 30);
        break;
      }
      case 'titanBreath': {
        if (e.phase === 'warn') break;
        const m = captainMouth(this.sim, E.titans.ship);
        this.breath = { phase: e.phase, t: 0, dur: e.dur, M: new THREE.Vector3(m.x, m.y, m.z) };
        break;
      }
      case 'titanDown': {
        if (!T) break;
        if (T.id === 'research') { for (let i = 0; i < 5; i++) setTimeout(() => { if (this.effects) this.effects.explosion({ x: T.pos.x + (Math.random() - 0.5) * 3, y: T.pos.y + 2 + Math.random() * 4, z: T.pos.z + (Math.random() - 0.5) * 3 }, 3); }, i * 500); }
        if (T.id === 'caves') for (let i = 0; i < 80; i++) this.effects.spawnParticle(new THREE.Vector3(T.pos.x, T.pos.y + 2.5, T.pos.z), new THREE.Vector3((Math.random() - 0.5) * 12, Math.random() * 9, (Math.random() - 0.5) * 12), { life: 1.6, size: 0.06, color: [1.2, 1.7, 2.4], gravity: 12, drag: 0.3 });
        if (T.id === 'trench') this.effects.explosion({ x: T.pos.x, y: T.pos.y + 3, z: T.pos.z }, 6);
        R.shake(1.2);
        R.flash = Math.max(R.flash || 0, 0.5);
        break;
      }
    }
  }

  // the Captain's breath: streams of spray drawn in, then blown out
  updateBreath(dt, eye) {
    const B = this.breath;
    if (!B) return;
    B.t += dt;
    if (B.t > B.dur) { this.breath = null; return; }
    const n = Math.round(dt * 160);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 30;
      const far = new THREE.Vector3(eye.x + Math.cos(a) * r * 0.6, eye.y + (Math.random() - 0.3) * 4, eye.z + Math.sin(a) * r * 0.6);
      const dir = B.M.clone().sub(far).normalize();
      if (B.phase === 'in') this.effects.spawnParticle(far, dir.multiplyScalar(14 + Math.random() * 8), { life: 0.9, size: 0.02, color: [0.7, 0.85, 0.8], gravity: 0, drag: 0 });
      else this.effects.spawnParticle(B.M.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3)), dir.multiplyScalar(-(18 + Math.random() * 10)).add(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6)), { life: 1.2, size: 0.025, color: [0.75, 0.9, 0.85], gravity: 0, drag: 0.2 });
    }
  }
}

function angleDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
