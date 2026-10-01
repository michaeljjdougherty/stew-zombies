// =============================================================================
// Visual effects: blood, gibs, decals, impacts, muzzle light, tracers, dust.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

export class Effects {
  constructor(scene, sim, cfg) {
    this.scene = scene;
    this.sim = sim;
    this.cfg = cfg;
    this.time = 0;

    // --- droplets & sparks: one instanced mesh
    this.maxP = 900;
    this.particles = [];
    const pgeo = new THREE.BoxGeometry(1, 1, 1);
    this.pmesh = new THREE.InstancedMesh(pgeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), this.maxP);
    this.pmesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pmesh.frustumCulled = false;
    this.pcolor = new Float32Array(this.maxP * 3);
    this.pmesh.instanceColor = new THREE.InstancedBufferAttribute(this.pcolor, 3);
    scene.add(this.pmesh);

    // --- puffs (smoke, dust, blood mist): sprite pool
    this.puffTex = T.softDotTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
    this.puffs = [];
    for (let i = 0; i < 140; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      scene.add(s);
      this.puffs.push({ s, life: 0, max: 1, grow: 1, vel: new THREE.Vector3(), alpha: 0.5 });
    }
    this.puffIdx = 0;

    // --- decals
    this.bloodTex = [1, 2, 3, 4].map((i) => T.bloodSplatTexture(i));
    this.bloodMats = this.bloodTex.map((t) => new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.3 }));
    this.holeMat = new THREE.MeshStandardMaterial({ map: T.bulletHoleTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 });
    this.decalGeo = new THREE.PlaneGeometry(1, 1);
    this.bloodDecals = [];
    this.holes = [];

    // --- gibs & limbs
    this.gibList = [];
    this.gibGeo = [new THREE.BoxGeometry(0.07, 0.05, 0.06), new THREE.BoxGeometry(0.05, 0.04, 0.09), new THREE.TetrahedronGeometry(0.05)];

    // --- muzzle light
    this.muzzleLight = new THREE.PointLight(0xffb060, 0, 9, 1.6);
    scene.add(this.muzzleLight);
    this.muzzleT = 0;

    // --- tracers
    this.tracerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.4), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    this.tracers = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 1), this.tracerMat.clone());
      m.visible = false; scene.add(m);
      this.tracers.push({ m, life: 0 });
    }
    this.tracerIdx = 0;

    // --- emitters (e.g. neck spurts)
    this.emitters = [];

    // --- explosions: fireball sprites, a flash light, scorch marks
    this.fireTex = T.softDotTexture('rgba(255,240,200,1)', 'rgba(255,120,30,0)');
    this.fires = [];
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fireTex, color: new THREE.Color(3, 1.6, 0.6), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false; scene.add(s);
      this.fires.push({ s, life: 0, max: 1, size: 1, vel: new THREE.Vector3() });
    }
    this.fireIdx = 0;
    this.blastLight = new THREE.PointLight(0xff9a40, 0, 14, 1.4);
    scene.add(this.blastLight);
    this.blastT = 0;
    this.scorchMat = new THREE.MeshStandardMaterial({ map: T.softDotTexture('rgba(12,9,6,0.9)', 'rgba(12,9,6,0)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 });
    this.scorches = [];

    this.buildDust();
  }

  buildDust() {
    // spread motes over all rooms by floor area; each remembers its room
    const rooms = this.sim.mapData.rooms;
    const areas = rooms.map((r) => (r.rect[2] - r.rect[0]) * (r.rect[3] - r.rect[1]));
    const total = areas.reduce((a, b) => a + b, 0);
    const n = this.cfg.graphics.dustCount;
    const pos = new Float32Array(n * 3);
    this.dustVel = new Float32Array(n * 3);
    this.dustRoom = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      let r = Math.random() * total, k = 0;
      while (k < rooms.length - 1 && r > areas[k]) { r -= areas[k]; k++; }
      const [x0, z0, x1, z1] = rooms[k].rect;
      this.dustRoom[i] = k;
      pos[i * 3] = x0 + Math.random() * (x1 - x0);
      pos[i * 3 + 1] = Math.random() * (rooms[k].height - 0.5);
      pos[i * 3 + 2] = z0 + Math.random() * (z1 - z0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.028, map: this.puffTex, color: 0xcdbb98, transparent: true, opacity: 0.32, depthWrite: false, sizeAttenuation: true,
    }));
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);

    // denser, brighter motes inside the light cones
    const lit = this.sim.mapData.rooms.flatMap((r) => (r.fixtures || []).filter((f) => f.lit).map((f) => ({ ...f, drop: Math.min(6.2, f.y - 0.4), spread: f.y > 6 ? 2.1 : 1.0 })));
    const wins = this.sim.windows;
    const m = 360;
    const bp = new Float32Array(m * 3);
    this.beamSources = [];
    for (let i = 0; i < m; i++) {
      let x, y, z;
      if ((i % 2 === 0 || !wins.length) && lit.length) {
        const f = lit[i % lit.length];
        const t = Math.random();
        const r = (0.3 + t * f.spread) * Math.sqrt(Math.random());
        const a = Math.random() * Math.PI * 2;
        x = f.x + Math.cos(a) * r; z = f.z + Math.sin(a) * r; y = f.y - 0.3 - t * f.drop;
        this.beamSources.push({ kind: 'f', f, cx: f.x, cz: f.z });
      } else if (wins.length) {
        const w = wins[i % wins.length];
        const t = Math.random();
        x = w.center.x + w.normal.x * t * 4 + (Math.random() - 0.5) * (0.7 + t);
        z = w.center.z + w.normal.z * t * 4 + (Math.random() - 0.5) * (0.7 + t) * 0.6;
        y = 1.8 - t * 1.8 + (Math.random() - 0.5) * 0.8;
        this.beamSources.push({ kind: 'w' });
      } else { x = 0; y = 1; z = 0; this.beamSources.push({ kind: 'w' }); }
      bp[i * 3] = x; bp[i * 3 + 1] = Math.max(0.05, y); bp[i * 3 + 2] = z;
    }
    this.beamHome = bp.slice();
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    this.beamDust = new THREE.Points(bg, new THREE.PointsMaterial({
      size: 0.022, map: this.puffTex, color: 0xfff0d0, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.beamDust.frustumCulled = false;
    this.scene.add(this.beamDust);
  }

  // ---------------------------------------------------------------------------
  spawnParticle(pos, vel, { life = 1, size = 0.02, color = [0.25, 0.01, 0.01], gravity = 9.8, drag = 0.5, floorDecal = false } = {}) {
    if (this.particles.length >= this.maxP) this.particles.shift();
    this.particles.push({ p: pos.clone(), v: vel.clone(), life, max: life, size, color, gravity, drag, floorDecal });
  }

  bloodBurst(pos, dir, count = 16, power = 1) {
    const d = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(
        d.x * 2.5 + (Math.random() - 0.5) * 3,
        d.y * 2.5 + Math.random() * 2.5,
        d.z * 2.5 + (Math.random() - 0.5) * 3,
      ).multiplyScalar(power * (0.4 + Math.random()));
      const dark = 0.12 + Math.random() * 0.2;
      this.spawnParticle(pos, v, { life: 0.6 + Math.random() * 0.8, size: 0.012 + Math.random() * 0.03, color: [dark, 0.005, 0.004], floorDecal: Math.random() < 0.08 });
    }
    this.puff(pos, { color: 0x5a0a08, size: 0.35 * power, grow: 1.2, life: 0.4, alpha: 0.55, vel: d.clone().multiplyScalar(0.8) });
  }

  bloodSpurt(object3d, duration) {
    this.emitters.push({ obj: object3d, t: 0, duration, acc: 0 });
  }

  puff(pos, { color = 0x8a8070, size = 0.3, grow = 1.5, life = 0.8, alpha = 0.4, vel = null } = {}) {
    const p = this.puffs[this.puffIdx];
    this.puffIdx = (this.puffIdx + 1) % this.puffs.length;
    p.s.position.copy(pos);
    p.s.material.color.set(color);
    p.s.material.opacity = alpha;
    p.s.scale.setScalar(size);
    p.s.visible = true;
    p.life = life; p.max = life; p.grow = grow; p.size = size; p.alpha = alpha;
    p.vel.copy(vel || new THREE.Vector3(0, 0.25, 0));
  }

  placeDecal(list, max, mat, pos, normal, size) {
    let m;
    if (list.length >= max) { m = list.shift(); } else { m = new THREE.Mesh(this.decalGeo, mat); this.scene.add(m); }
    m.material = mat;
    m.position.copy(pos).addScaledVector(normal, 0.006 + list.length * 0.00002);
    _q.setFromUnitVectors(Z, normal);
    m.quaternion.copy(_q);
    m.rotateZ(Math.random() * Math.PI * 2);
    m.scale.setScalar(size);
    list.push(m);
    return m;
  }

  bloodDecal(pos, normal, size = 0.8) {
    const mat = this.bloodMats[Math.floor(Math.random() * this.bloodMats.length)];
    this.placeDecal(this.bloodDecals, this.cfg.graphics.maxBloodDecals, mat, pos, normal, size);
  }

  bulletHole(pos, normal) {
    this.placeDecal(this.holes, this.cfg.graphics.maxBulletHoles, this.holeMat, pos, normal, 0.07 + Math.random() * 0.03);
  }

  impact(point, normal, surface) {
    const p = new THREE.Vector3(point.x, point.y, point.z);
    const n = new THREE.Vector3(normal.x, normal.y, normal.z);
    this.bulletHole(p, n);
    const wood = surface === 'bleacher' || surface === 'floor';
    const col = wood ? 0x6a5236 : 0x8a8478;
    this.puff(p.clone().addScaledVector(n, 0.05), { color: col, size: 0.18, grow: 2.2, life: 0.9, alpha: 0.45, vel: n.clone().multiplyScalar(0.5) });
    const sparks = wood ? 2 : 5;
    for (let i = 0; i < sparks; i++) {
      const v = n.clone().multiplyScalar(2 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4));
      this.spawnParticle(p, v, { life: 0.15 + Math.random() * 0.2, size: 0.01, color: wood ? [0.5, 0.35, 0.2] : [4, 2.2, 0.8], gravity: 12, drag: 1 });
    }
    // chips
    for (let i = 0; i < 4; i++) {
      const v = n.clone().multiplyScalar(1 + Math.random() * 2).add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2));
      this.spawnParticle(p, v, { life: 0.5 + Math.random() * 0.4, size: 0.012, color: wood ? [0.25, 0.17, 0.1] : [0.3, 0.29, 0.26], gravity: 9.8 });
    }
  }

  zombieHit(point, dir, part) {
    const p = new THREE.Vector3(point.x, point.y, point.z);
    const d = new THREE.Vector3(dir.x, dir.y, dir.z);
    this.bloodBurst(p, d, part === 'head' ? 26 : 14, part === 'head' ? 1.2 : 0.8);
    // spatter on whatever is behind
    if (Math.random() < 0.6) {
      const h = this.sim.raycastWorld(point, dir, 3.5);
      if (h) this.bloodDecal(new THREE.Vector3(h.point.x, h.point.y, h.point.z), new THREE.Vector3(h.normal.x, h.normal.y, h.normal.z), 0.35 + Math.random() * 0.5);
    }
  }

  gibs(pos, dir, n, goreMat, skinMat) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.gibGeo[i % this.gibGeo.length], i % 3 === 0 ? skinMat : goreMat);
      m.position.copy(pos);
      this.scene.add(m);
      this.gibList.push({
        m, t: 0, life: 7,
        v: new THREE.Vector3(dir.x * 2 + (Math.random() - 0.5) * 3, 2 + Math.random() * 2.5, dir.z * 2 + (Math.random() - 0.5) * 3),
        spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10), rest: false,
      });
    }
  }

  flyingLimb(src, pos, quat, dir, scale) {
    const limb = src.clone(true);
    limb.visible = true;
    limb.position.copy(pos);
    limb.quaternion.copy(quat);
    limb.scale.setScalar(scale);
    this.scene.add(limb);
    this.gibList.push({
      m: limb, t: 0, life: 9, limb: true,
      v: new THREE.Vector3(dir.x * 2.5 + (Math.random() - 0.5) * 2, 1.5 + Math.random() * 2, dir.z * 2.5 + (Math.random() - 0.5) * 2),
      spin: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12), rest: false,
    });
    this.bloodSpurt(limb, 0.5);
  }

  muzzle(pos) {
    this.muzzleLight.position.copy(pos);
    this.muzzleLight.intensity = 9;
    this.muzzleT = 0.05;
  }

  tracer(from, to) {
    const t = this.tracers[this.tracerIdx];
    this.tracerIdx = (this.tracerIdx + 1) % this.tracers.length;
    const a = new THREE.Vector3(from.x, from.y, from.z), b = new THREE.Vector3(to.x, to.y, to.z);
    const len = a.distanceTo(b);
    if (len < 1) return;
    t.m.position.copy(a).lerp(b, 0.5);
    t.m.lookAt(b);
    t.m.scale.set(1, 1, len);
    t.m.visible = true;
    t.m.material.opacity = 0.35;
    t.life = 0.05;
  }

  // Mad Dog explosive rounds: a quick pop, no scorch.
  smallExplosion(pos, radius = 2) {
    const p = new THREE.Vector3(pos.x, pos.y, pos.z);
    for (let i = 0; i < 3; i++) {
      const f = this.fires[this.fireIdx];
      this.fireIdx = (this.fireIdx + 1) % this.fires.length;
      f.s.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, Math.random() * 0.2, (Math.random() - 0.5) * 0.3));
      f.vel.set((Math.random() - 0.5) * 1.5, 0.5 + Math.random(), (Math.random() - 0.5) * 1.5);
      f.size = 0.5 + Math.random() * 0.4 * radius / 2;
      f.life = f.max = 0.14 + Math.random() * 0.1;
      f.s.material.rotation = Math.random() * 6.28;
      f.s.visible = true;
    }
    this.puff(p, { color: 0x2e2a26, size: 0.45, grow: 2, life: 0.9, alpha: 0.4, vel: new THREE.Vector3(0, 0.5, 0) });
    for (let i = 0; i < 6; i++) this.spawnParticle(p, new THREE.Vector3((Math.random() - 0.5) * 7, 1 + Math.random() * 4, (Math.random() - 0.5) * 7), { life: 0.25, size: 0.012, color: [5, 2.4, 0.8], gravity: 10, drag: 1 });
    this.muzzleLight.position.copy(p);
    this.muzzleLight.intensity = 14;
    this.muzzleT = 0.06;
  }

  explosion(pos, radius = 4) {
    const p = new THREE.Vector3(pos.x, pos.y, pos.z);
    const k = radius / 4.5;
    this.blastLight.position.copy(p).y += 0.4;
    this.blastLight.intensity = 260 * k;
    this.blastT = 0.32;
    for (let i = 0; i < 9; i++) {
      const f = this.fires[this.fireIdx];
      this.fireIdx = (this.fireIdx + 1) % this.fires.length;
      f.s.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.5, (Math.random() - 0.5) * 0.6).multiplyScalar(k));
      f.vel.set((Math.random() - 0.5) * 3, 0.8 + Math.random() * 2, (Math.random() - 0.5) * 3).multiplyScalar(k);
      f.size = (1.1 + Math.random() * 0.9) * k;
      f.life = f.max = 0.25 + Math.random() * 0.25;
      f.s.material.rotation = Math.random() * 6.28;
      f.s.visible = true;
    }
    for (let i = 0; i < 10; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.3 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6).multiplyScalar(k);
      const c = 0x2a2622 + Math.floor(Math.random() * 3) * 0x080808;
      this.puff(p.clone().add(v.clone().multiplyScalar(0.3)), { color: c, size: 1.0 * k, grow: 2.6, life: 2.2 + Math.random() * 1.5, alpha: 0.75, vel: v });
    }
    for (let i = 0; i < 26; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 14, 2 + Math.random() * 8, (Math.random() - 0.5) * 14);
      this.spawnParticle(p, v, { life: 0.3 + Math.random() * 0.5, size: 0.015, color: [5, 2.6, 0.8], gravity: 12, drag: 1.2 });
    }
    for (let i = 0; i < 18; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 8, 2 + Math.random() * 6, (Math.random() - 0.5) * 8);
      this.spawnParticle(p, v, { life: 0.9 + Math.random() * 0.6, size: 0.02 + Math.random() * 0.03, color: [0.12, 0.1, 0.08], gravity: 9.8, drag: 0.3 });
    }
    // scorch on the floor (or whatever is below)
    const h = this.sim.raycastWorld({ x: p.x, y: p.y + 0.1, z: p.z }, { x: 0, y: -1, z: 0 }, 2.5);
    const sp = h ? new THREE.Vector3(h.point.x, h.point.y, h.point.z) : new THREE.Vector3(p.x, 0, p.z);
    if (sp.y < 0.05 || h) this.placeDecal(this.scorches, 12, this.scorchMat, sp, h ? new THREE.Vector3(h.normal.x, h.normal.y, h.normal.z) : UP, 2.2 * k);
  }

  // ---------------------------------------------------------------------------
  update(dt) {
    this.time += dt;
    // droplets
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.v.y -= p.gravity * dt;
      p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.p.addScaledVector(p.v, dt);
      if (p.p.y < 0.01) {
        if (p.floorDecal) { this.bloodDecal(new THREE.Vector3(p.p.x, 0, p.p.z), UP, 0.15 + Math.random() * 0.25); p.floorDecal = false; }
        p.p.y = 0.01; p.v.set(0, 0, 0);
        p.life = Math.min(p.life, 0.2);
      }
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
    }
    for (const p of this.particles) {
      if (n >= this.maxP) break;
      const s = p.size * Math.min(1, p.life / p.max * 3);
      _s.set(s, s, s + Math.min(0.08, p.v.length() * 0.01));
      _v.copy(p.v); if (_v.lengthSq() > 1e-4) { _q.setFromUnitVectors(Z, _v.normalize()); } else _q.identity();
      _m.compose(p.p, _q, _s);
      this.pmesh.setMatrixAt(n, _m);
      this.pcolor[n * 3] = p.color[0]; this.pcolor[n * 3 + 1] = p.color[1]; this.pcolor[n * 3 + 2] = p.color[2];
      n++;
    }
    this.pmesh.count = n;
    this.pmesh.instanceMatrix.needsUpdate = true;
    this.pmesh.instanceColor.needsUpdate = true;

    // puffs
    for (const p of this.puffs) {
      if (!p.s.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      const k = 1 - p.life / p.max;
      p.s.position.addScaledVector(p.vel, dt);
      p.s.scale.setScalar(p.size * (1 + k * p.grow));
      p.s.material.opacity = p.alpha * (1 - k) * (1 - k);
    }

    // neck/limb spurts
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i];
      e.t += dt; e.acc += dt;
      if (e.t > e.duration || !e.obj.parent) { this.emitters.splice(i, 1); continue; }
      while (e.acc > 0.02) {
        e.acc -= 0.02;
        e.obj.getWorldPosition(_v);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(e.obj.getWorldQuaternion(new THREE.Quaternion()));
        const pulse = 0.6 + Math.sin(e.t * 25) * 0.4;
        this.spawnParticle(_v, up.multiplyScalar(2.2 * pulse).add(new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.5, (Math.random() - 0.5))), { life: 0.8, size: 0.02, color: [0.2, 0.005, 0.005], floorDecal: Math.random() < 0.05 });
      }
    }

    // gibs
    for (let i = this.gibList.length - 1; i >= 0; i--) {
      const g = this.gibList[i];
      g.t += dt;
      if (!g.rest) {
        g.v.y -= 9.8 * dt;
        g.m.position.addScaledVector(g.v, dt);
        g.m.rotation.x += g.spin.x * dt; g.m.rotation.y += g.spin.y * dt; g.m.rotation.z += g.spin.z * dt;
        const floor = g.limb ? 0.06 : 0.03;
        if (g.m.position.y < floor) {
          g.m.position.y = floor;
          if (Math.abs(g.v.y) < 1) { g.rest = true; if (g.limb) g.m.rotation.x = Math.PI / 2; }
          g.v.y *= -0.3; g.v.x *= 0.5; g.v.z *= 0.5; g.spin.multiplyScalar(0.5);
        }
      }
      if (g.t > g.life) {
        g.m.position.y -= dt * 0.3;
        if (g.t > g.life + 1.5) { this.scene.remove(g.m); this.gibList.splice(i, 1); }
      }
    }

    // explosions
    for (const f of this.fires) {
      if (!f.s.visible) continue;
      f.life -= dt;
      if (f.life <= 0) { f.s.visible = false; continue; }
      const k = 1 - f.life / f.max;
      f.s.position.addScaledVector(f.vel, dt);
      f.s.scale.setScalar(f.size * (0.6 + k * 1.2));
      f.s.material.opacity = (1 - k) * (1 - k);
      f.s.material.color.setRGB(3 - k * 1.5, 1.6 - k * 1.2, 0.6 - k * 0.5);
    }
    if (this.blastT > 0) { this.blastT -= dt; this.blastLight.intensity *= Math.exp(-dt * 9); if (this.blastT <= 0) this.blastLight.intensity = 0; }

    // muzzle light
    if (this.muzzleT > 0) { this.muzzleT -= dt; if (this.muzzleT <= 0) this.muzzleLight.intensity = 0; }

    // tracers
    for (const t of this.tracers) {
      if (!t.m.visible) continue;
      t.life -= dt;
      t.m.material.opacity = Math.max(0, t.life / 0.05) * 0.35;
      if (t.life <= 0) t.m.visible = false;
    }

    // dust drift
    const pa = this.dust.geometry.attributes.position;
    const arr = pa.array, vel = this.dustVel;
    const rooms = this.sim.mapData.rooms;
    for (let i = 0; i < arr.length; i += 3) {
      const room = rooms[this.dustRoom[i / 3]];
      const [bx0, bz0, bx1, bz1] = room.rect, H = room.height;
      vel[i] += (Math.random() - 0.5) * 0.02 * dt * 60;
      vel[i + 1] += (Math.random() - 0.52) * 0.01 * dt * 60;
      vel[i + 2] += (Math.random() - 0.5) * 0.02 * dt * 60;
      vel[i] *= 0.98; vel[i + 1] *= 0.98; vel[i + 2] *= 0.98;
      arr[i] += vel[i] * dt * 0.3; arr[i + 1] += vel[i + 1] * dt * 0.3; arr[i + 2] += vel[i + 2] * dt * 0.3;
      if (arr[i + 1] < 0.1) arr[i + 1] = H - 0.6;
      if (arr[i] < bx0) arr[i] = bx1; if (arr[i] > bx1) arr[i] = bx0;
      if (arr[i + 2] < bz0) arr[i + 2] = bz1; if (arr[i + 2] > bz1) arr[i + 2] = bz0;
    }
    pa.needsUpdate = true;
    const ba = this.beamDust.geometry.attributes.position.array, home = this.beamHome;
    const t = this.time;
    for (let i = 0; i < ba.length; i += 3) {
      const k = i * 0.37;
      ba[i] = home[i] + Math.sin(t * 0.21 + k) * 0.25;
      ba[i + 1] = home[i + 1] + Math.sin(t * 0.13 + k * 1.7) * 0.3;
      ba[i + 2] = home[i + 2] + Math.cos(t * 0.17 + k * 0.9) * 0.25;
    }
    this.beamDust.geometry.attributes.position.needsUpdate = true;
  }

  // brightness of the beam dust follows the fixtures
  setBeamLevel(level) { this.beamDust.material.opacity = 0.35 + 0.4 * level; }

  clear() {
    this.particles.length = 0;
    for (const d of [...this.bloodDecals, ...this.holes, ...this.scorches]) this.scene.remove(d);
    this.bloodDecals.length = 0; this.holes.length = 0; this.scorches.length = 0;
    for (const f of this.fires) f.s.visible = false;
    this.blastLight.intensity = 0;
    for (const g of this.gibList) this.scene.remove(g.m);
    this.gibList.length = 0;
    this.emitters.length = 0;
  }
}
