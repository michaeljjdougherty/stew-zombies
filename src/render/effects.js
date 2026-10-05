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

export const FX_LAYER = 1;

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
    this.smokeTex = [1, 2, 3].map((i) => T.smokeTexture(i));
    for (let i = 0; i < 220; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      scene.add(s);
      this.puffs.push({ s, life: 0, max: 1, grow: 1, vel: new THREE.Vector3(), alpha: 0.5 });
    }
    this.puffIdx = 0;
    this.lightAt = null;   // (pos) => 0..1, how lit a spot is (set by the renderer) so smoke isn't glowing in the dark
    this.puddles = null;   // set by the renderer: drops landing in water ripple it
    this.heat = 0;         // barrel heat: smoke curls off the muzzle after a burst
    this.sinceShot = 9;
    this.wispAcc = 0;

    // --- decals
    this.bloodTex = [1, 2, 3, 4].map((i) => T.bloodSplatTexture(i));
    this.bloodMats = this.bloodTex.map((t) => new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.3 }));
    this.holeMat = new THREE.MeshStandardMaterial({ map: T.bulletHoleTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 });
    this.decalGeo = new THREE.PlaneGeometry(1, 1);
    this.bloodDecals = [];
    this.holes = [];
    // pools that spread out under the dead: glossy, they pick up the reflections
    this.poolTex = [1, 2, 3].map((i) => T.blobTexture(40 + i, { rgb: [255, 255, 255], lobes: 12 }));
    this.poolMats = this.poolTex.map((t) => new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.045, 0.0015, 0.0015), alphaMap: t, transparent: true, depthWrite: false, opacity: 0.96,
      roughness: 0.1, metalness: 0, envMapIntensity: 0.7, polygonOffset: true, polygonOffsetFactor: -5,
    }));
    this.pools = [];

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

    // --- emitters (e.g. neck spurts) and grit falling from the ceiling
    this.emitters = [];
    this.streams = [];

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
    // particles, smoke and dust stay out of the puddles' reflection captures
    // (tiny points right next to a cube camera come out as NaNs)
    for (const o of [this.dust, this.beamDust, this.pmesh, ...this.puffs.map((p) => p.s), ...this.fires.map((f) => f.s)]) o.layers.set(FX_LAYER);
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

    // denser, brighter motes inside the light cones: every fixture gets some,
    // and they show only while it's on (see update); plus shafts at the windows
    const fixtures = this.sim.mapData.rooms.flatMap((r) => (r.fixtures || []).map((f) => ({ ...f, drop: Math.min(6.2, f.y - 0.4), spread: f.y > 6 ? 2.1 : f.kind === 'lamp' ? 1.4 : 1.0 })));
    const wins = this.sim.windows;
    const pts = [];
    fixtures.forEach((f, fi) => {
      const n = f.y > 6 ? 16 : 7;
      for (let i = 0; i < n; i++) {
        const t = Math.random();
        const r = (0.3 + t * f.spread) * Math.sqrt(Math.random());
        const a = Math.random() * Math.PI * 2;
        pts.push([f.x + Math.cos(a) * r, f.y - 0.3 - t * f.drop, f.z + Math.sin(a) * r, fi]);
      }
    });
    for (let i = 0; i < 150 && wins.length; i++) {
      const w = wins[i % wins.length];
      const t = Math.random();
      pts.push([
        w.center.x + w.normal.x * t * 4 + (Math.random() - 0.5) * (0.7 + t),
        1.8 - t * 1.8 + (Math.random() - 0.5) * 0.8,
        w.center.z + w.normal.z * t * 4 + (Math.random() - 0.5) * (0.7 + t) * 0.6, -1]);
    }
    const m = pts.length;
    const bp = new Float32Array(m * 3);
    this.beamCol = new Float32Array(m * 3);
    this.beamFix = new Int16Array(m);
    pts.forEach(([x, y, z, fi], i) => {
      bp[i * 3] = x; bp[i * 3 + 1] = Math.max(0.05, y); bp[i * 3 + 2] = z;
      this.beamFix[i] = fi;
      const k = fi < 0 ? 0.55 : 1;   // window shafts are moonlight: dimmer and bluer
      this.beamCol[i * 3] = fi < 0 ? 0.75 * k : 1; this.beamCol[i * 3 + 1] = fi < 0 ? 0.85 * k : 0.94; this.beamCol[i * 3 + 2] = fi < 0 ? 1 * k : 0.82;
    });
    this.beamBase = this.beamCol.slice();
    this.beamHome = bp.slice();
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    bg.setAttribute('color', new THREE.BufferAttribute(this.beamCol, 3));
    this.beamDust = new THREE.Points(bg, new THREE.PointsMaterial({
      size: 0.022, map: this.puffTex, vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.fixtures = null; // the map's live fixtures (set by the renderer): motes follow their brightness
    this.beamDust.frustumCulled = false;
    this.scene.add(this.beamDust);
  }

  // ---------------------------------------------------------------------------
  spawnParticle(pos, vel, { life = 1, size = 0.02, color = [0.25, 0.01, 0.01], gravity = 9.8, drag = 0.5, floorDecal = false, decalSize = 0 } = {}) {
    if (this.particles.length >= this.maxP) this.particles.shift();
    this.particles.push({ p: pos.clone(), v: vel.clone(), life, max: life, size, color, gravity, drag, floorDecal, decalSize });
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
      this.spawnParticle(pos, v, { life: 0.6 + Math.random() * 0.8, size: 0.012 + Math.random() * 0.03, color: [dark, 0.005, 0.004], floorDecal: Math.random() < 0.18, decalSize: 0.06 + Math.random() * 0.16 });
    }
    this.puff(pos, { color: 0x5a0a08, size: 0.35 * power, grow: 1.2, life: 0.4, alpha: 0.55, vel: d.clone().multiplyScalar(0.8) });
  }

  bloodSpurt(object3d, duration) {
    this.emitters.push({ obj: object3d, t: 0, duration, acc: 0 });
  }

  puff(pos, { color = 0x8a8070, size = 0.3, grow = 1.5, life = 0.8, alpha = 0.4, vel = null, smoke = false, shade = true, rise = 0 } = {}) {
    const p = this.puffs[this.puffIdx];
    this.puffIdx = (this.puffIdx + 1) % this.puffs.length;
    p.s.position.copy(pos);
    p.s.material.color.set(color);
    // smoke and dust are lit by the room, not glowing
    if (shade && this.lightAt) p.s.material.color.multiplyScalar(0.3 + 0.95 * this.lightAt(pos));
    const tex = smoke ? this.smokeTex[Math.floor(Math.random() * this.smokeTex.length)] : this.puffTex;
    if (p.s.material.map !== tex) { p.s.material.map = tex; p.s.material.needsUpdate = true; }
    p.s.material.rotation = smoke ? Math.random() * 6.28 : 0;
    p.spin = smoke ? (Math.random() - 0.5) * 0.8 : 0;
    p.rise = rise;
    p.smoke = smoke;
    p.s.material.opacity = alpha;
    p.s.scale.setScalar(size);
    p.s.visible = true;
    p.life = life; p.max = life; p.grow = grow; p.size = size; p.alpha = alpha;
    p.vel.copy(vel || new THREE.Vector3(0, 0.25, 0));
  }

  // dir (optional): the way the splash was travelling; it streaks along it
  placeDecal(list, max, mat, pos, normal, size, dir = null) {
    let m;
    if (list.length >= max) { m = list.shift(); } else { m = new THREE.Mesh(this.decalGeo, mat); this.scene.add(m); }
    m.material = mat;
    m.position.copy(pos).addScaledVector(normal, 0.006 + list.length * 0.00002);
    _q.setFromUnitVectors(Z, normal);
    m.quaternion.copy(_q);
    m.scale.setScalar(size);
    if (dir) {
      const dn = dir.dot(normal);
      const along = dir.clone().addScaledVector(normal, -dn);
      if (along.lengthSq() > 1e-4) {
        along.normalize();
        const xw = new THREE.Vector3(1, 0, 0).applyQuaternion(_q);
        const ang = Math.atan2(new THREE.Vector3().crossVectors(xw, along).dot(normal), xw.dot(along));
        m.rotateZ(ang);
        const stretch = Math.min(2.6, 1 / Math.max(0.35, Math.abs(dn)));
        m.scale.set(size * stretch, size / Math.sqrt(stretch), 1);
        m.position.addScaledVector(along, size * (stretch - 1) * 0.3);
      } else m.rotateZ(Math.random() * Math.PI * 2);
    } else m.rotateZ(Math.random() * Math.PI * 2);
    list.push(m);
    return m;
  }

  bloodDecal(pos, normal, size = 0.8, dir = null) {
    const mat = this.bloodMats[Math.floor(Math.random() * this.bloodMats.length)];
    this.placeDecal(this.bloodDecals, this.cfg.graphics.maxBloodDecals, mat, pos, normal, size, dir);
  }

  // A pool of blood spreading out from under a body.
  bloodPool(pos, size = 1) {
    const max = this.cfg.graphics.maxBloodPools ?? 16;
    const h = this.sim.raycastWorld({ x: pos.x, y: 0.6, z: pos.z }, { x: 0, y: -1, z: 0 }, 0.65);
    const y = h ? h.point.y : 0;
    if (y > 0.5) return;
    const mat = this.poolMats[Math.floor(Math.random() * this.poolMats.length)];
    if (this.puddles && mat.envMap !== this.puddles.envMap) { for (const pm of this.poolMats) { pm.envMap = this.puddles.envMap; pm.needsUpdate = true; } }
    const m = this.placeDecal(this.pools, max, mat, new THREE.Vector3(pos.x, y, pos.z), UP, 0.01);
    m.position.y = y + 0.007;
    m.userData.pool = { t: 0, size: size * (0.9 + Math.random() * 0.6), delay: 0.5 + Math.random() * 0.4 };
  }

  // A drop of blood falling from a wounded zombie, leaving a spot where it lands.
  bloodDrip(pos) {
    this.spawnParticle(pos, new THREE.Vector3((Math.random() - 0.5) * 0.3, -0.5, (Math.random() - 0.5) * 0.3), { life: 2, size: 0.014, color: [0.16, 0.004, 0.004], floorDecal: true, decalSize: 0.07 + Math.random() * 0.09 });
  }

  // Smoke from the muzzle on each shot; it builds up into curling wisps after a burst.
  muzzleSmoke(pos, dir, k = 1, local = true) {
    if (local) { this.heat = Math.min(1.5, this.heat + 0.09 * k); this.sinceShot = 0; }
    const d = dir ? new THREE.Vector3(dir.x, dir.y, dir.z) : new THREE.Vector3(0, 0, -1);
    this.puff(new THREE.Vector3(pos.x, pos.y, pos.z).addScaledVector(d, 0.12), { color: 0xb8b4ac, size: 0.13 * k, grow: 5, life: 1.1 + Math.random() * 0.6, alpha: 0.5, vel: d.multiplyScalar(0.9).add(new THREE.Vector3(0, 0.15, 0)), smoke: true, rise: 0.25 });
  }

  // Called every frame with the muzzle's position: wisps rise off a hot barrel.
  barrelSmoke(pos, dt) {
    this.sinceShot += dt;
    this.heat = Math.max(0, this.heat - dt * 0.28);
    if (this.heat < 0.2 || this.sinceShot < 0.12 || !pos) return;
    this.wispAcc += dt * 14 * Math.min(1, this.heat);
    while (this.wispAcc > 1) {
      this.wispAcc -= 1;
      this.puff(new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.01, pos.y + 0.01, pos.z + (Math.random() - 0.5) * 0.01), {
        color: 0xc8c4bc, size: 0.03, grow: 6, life: 1.4 + Math.random() * 0.6, alpha: 0.38 * Math.min(1, this.heat), smoke: true, rise: 0.12,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.06, 0.18 + Math.random() * 0.1, (Math.random() - 0.5) * 0.06),
      });
    }
  }

  // Dust and grit shaken down from the ceiling (explosions nearby).
  ceilingDust(pos, radius = 3, amount = 1) {
    const room = this.roomAt(pos.x, pos.z);
    if (!room || room.outdoor) return;
    const H = room.height - 0.08;
    const n = Math.round(14 * amount);
    for (let i = 0; i < n; i++) {
      const x = pos.x + (Math.random() - 0.5) * radius * 2, z = pos.z + (Math.random() - 0.5) * radius * 2;
      // a short stream of grit from each spot, and a little cloud that sinks
      this.streams.push({ x, z, y: H, t: Math.random() * 0.4, life: 0.6 + Math.random() * 1.2, acc: 0 });
      if (i % 2 === 0) this.puff(new THREE.Vector3(x, H - 0.15, z), { color: 0x9a9082, size: 0.8, grow: 2.4, life: 2.5 + Math.random() * 1.5, alpha: 0.34, vel: new THREE.Vector3((Math.random() - 0.5) * 0.2, -0.35 - Math.random() * 0.3, (Math.random() - 0.5) * 0.2), smoke: true });
    }
  }

  roomAt(x, z) {
    for (const r of this.sim.mapData.rooms) { const [x0, z0, x1, z1] = r.rect; if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return r; }
    return null;
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
      if (h) this.bloodDecal(new THREE.Vector3(h.point.x, h.point.y, h.point.z), new THREE.Vector3(h.normal.x, h.normal.y, h.normal.z), 0.3 + Math.random() * 0.45, d.clone().normalize());
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
    this.muzzleLight.color.set(0xffb060);
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

  // A lightning bolt from the sky to `pos` (Cheddar strikes).
  lightning(pos) {
    if (!this.bolts) {
      this.bolts = [];
      for (let i = 0; i < 4; i++) {
        const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(3, 3, 2.4), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
        const lines = [];
        for (let k = 0; k < 3; k++) {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
          const l = new THREE.Line(geo, mat); l.frustumCulled = false; l.visible = false;
          this.scene.add(l); lines.push(l);
        }
        this.bolts.push({ lines, mat, life: 0 });
      }
      this.boltIdx = 0;
      this.boltLight = this.blastLight; // share the explosion light (no extra light in the shaders)
    }
    const b = this.bolts[this.boltIdx];
    this.boltIdx = (this.boltIdx + 1) % this.bolts.length;
    b.lines.forEach((l, k) => {
      const arr = l.geometry.attributes.position.array;
      let x = pos.x + (Math.random() - 0.5) * 3, z = pos.z + (Math.random() - 0.5) * 3;
      for (let i = 0; i < 24; i++) {
        const t = i / 23;
        const y = 18 * (1 - t);
        if (i === 23) { x = pos.x; z = pos.z; } else { x += (Math.random() - 0.5) * 0.9 + (pos.x - x) * 0.12; z += (Math.random() - 0.5) * 0.9 + (pos.z - z) * 0.12; }
        arr[i * 3] = x + (k ? (Math.random() - 0.5) * 0.15 : 0); arr[i * 3 + 1] = y; arr[i * 3 + 2] = z + (k ? (Math.random() - 0.5) * 0.15 : 0);
      }
      l.geometry.attributes.position.needsUpdate = true;
      l.visible = true;
    });
    b.life = 0.22;
    b.mat.opacity = 1;
    this.boltLight.position.set(pos.x, 2, pos.z);
    this.boltLight.color.set(0xfff0c0);
    this.boltLight.intensity = 400;
    this.boltT = 0.25;
    const p = new THREE.Vector3(pos.x, 0.1, pos.z);
    for (let i = 0; i < 30; i++) this.spawnParticle(p, new THREE.Vector3((Math.random() - 0.5) * 8, 1 + Math.random() * 5, (Math.random() - 0.5) * 8), { life: 0.4 + Math.random() * 0.4, size: 0.015, color: [4, 3.4, 1.6], gravity: 10, drag: 1 });
    for (let i = 0; i < 4; i++) this.puff(p.clone().add(new THREE.Vector3((Math.random() - 0.5), 0.2, (Math.random() - 0.5))), { color: 0x5a5040, size: 0.6, grow: 2.5, life: 1.3, alpha: 0.5 });
    this.placeDecal(this.scorches, 12, this.scorchMat, new THREE.Vector3(pos.x, 0.005, pos.z), UP, 1.6);
  }

  // Fucci Gun hit: a flash of colored plasma, rings of sparks, a scorch.
  energyBurst(pos, color = '#ffcf4a', radius = 2.4) {
    const p = new THREE.Vector3(pos.x, pos.y, pos.z);
    const c = new THREE.Color(color);
    for (let i = 0; i < 4; i++) {
      const f = this.fires[this.fireIdx];
      this.fireIdx = (this.fireIdx + 1) % this.fires.length;
      f.s.position.copy(p);
      f.vel.set((Math.random() - 0.5) * 2, 0.4 + Math.random(), (Math.random() - 0.5) * 2);
      f.size = 0.5 + Math.random() * 0.5 * radius / 2.4;
      f.life = f.max = 0.18 + Math.random() * 0.1;
      f.s.material.rotation = Math.random() * 6.28;
      f.s.visible = true;
      f.tint = c;
    }
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2, up = Math.random() * 0.6;
      const v = new THREE.Vector3(Math.cos(a) * 6, up * 5, Math.sin(a) * 6).multiplyScalar(0.5 + Math.random() * 0.6);
      this.spawnParticle(p, v, { life: 0.25 + Math.random() * 0.3, size: 0.014, color: [c.r * 4, c.g * 4, c.b * 4], gravity: 3, drag: 2 });
    }
    this.puff(p, { color: c.getHex(), size: 0.5, grow: 2.5, life: 0.4, alpha: 0.35 });
    this.muzzleLight.position.copy(p);
    this.muzzleLight.color.copy(c);
    this.muzzleLight.intensity = 18;
    this.muzzleT = 0.08;
    const h = this.sim.raycastWorld({ x: p.x, y: p.y + 0.1, z: p.z }, { x: 0, y: -1, z: 0 }, 1.2);
    if (h) this.placeDecal(this.scorches, 12, this.scorchMat, new THREE.Vector3(h.point.x, h.point.y, h.point.z), new THREE.Vector3(h.normal.x, h.normal.y, h.normal.z), 0.9);
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
      f.s.visible = true; f.tint = null;
    }
    this.puff(p, { color: 0x2e2a26, size: 0.45, grow: 2, life: 0.9, alpha: 0.4, vel: new THREE.Vector3(0, 0.5, 0) });
    for (let i = 0; i < 6; i++) this.spawnParticle(p, new THREE.Vector3((Math.random() - 0.5) * 7, 1 + Math.random() * 4, (Math.random() - 0.5) * 7), { life: 0.25, size: 0.012, color: [5, 2.4, 0.8], gravity: 10, drag: 1 });
    this.muzzleLight.position.copy(p);
    this.muzzleLight.intensity = 14;
    this.muzzleT = 0.06;
  }

  // The Chopper: a wall of wind out of the barrel - shock rings racing down a
  // cone, a pale rush of air and dust, and everything loose flying with it.
  windBlast(origin, dir, range = 13, angle = 30) {
    const o = new THREE.Vector3(origin.x, origin.y - 0.15, origin.z);
    const d = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
    const tan = Math.tan(angle * Math.PI / 180);
    if (!this.windMat) {
      this.windMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.9, 1.0), transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      this.ringGeo = new THREE.RingGeometry(0.86, 1, 48);
      this.coneGeo = new THREE.ConeGeometry(1, 1, 40, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2);   // apex at 0, opening along +z
      this.waves = [];
    }
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(this.ringGeo, this.windMat.clone());
      m.quaternion.copy(q);
      this.scene.add(m);
      this.waves.push({ m, t: -i * 0.06, life: 0.5, o: o.clone(), d: d.clone(), range, tan, ring: true });
    }
    const cone = new THREE.Mesh(this.coneGeo, this.windMat.clone());
    cone.quaternion.copy(q); cone.position.copy(o);
    this.scene.add(cone);
    this.waves.push({ m: cone, t: 0, life: 0.45, o: o.clone(), d: d.clone(), range, tan, ring: false });
    // the rush of air and dust
    const side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(side, d).normalize();
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * tan;
      const v = d.clone().addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize().multiplyScalar(14 + Math.random() * 12);
      this.puff(o.clone().addScaledVector(d, 0.8 + Math.random() * 1.5), { color: 0xcfd6dc, size: 0.35, grow: 4.5, life: 0.6 + Math.random() * 0.4, alpha: 0.16, vel: v, shade: false });
    }
    // dust off the floor along the cone, and grit flying
    for (let i = 0; i < 14; i++) {
      const k = 0.15 + Math.random() * 0.85;
      const at = o.clone().addScaledVector(d, range * k); at.y = 0.15;
      at.addScaledVector(side, (Math.random() - 0.5) * 2 * tan * range * k);
      this.puff(at, { color: 0x8a8070, size: 0.6, grow: 3, life: 1.4, alpha: 0.3, vel: d.clone().multiplyScalar(6 + Math.random() * 4).setY(0.6), shade: true });
    }
    for (let i = 0; i < 40; i++) {
      const v = d.clone().multiplyScalar(16 + Math.random() * 14);
      v.x += (Math.random() - 0.5) * 8; v.z += (Math.random() - 0.5) * 8; v.y += Math.random() * 4;
      this.spawnParticle(o.clone().addScaledVector(d, 1), v, { life: 0.5 + Math.random() * 0.5, size: 0.012 + Math.random() * 0.012, color: [0.5, 0.48, 0.42], gravity: 6, drag: 1.4 });
    }
    this.ceilingDust(o.clone().addScaledVector(d, range * 0.4), 4, 1.3);
  }

  updateWaves(dt) {
    if (!this.waves) return;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.t += dt;
      if (w.t < 0) { w.m.visible = false; continue; }
      w.m.visible = true;
      const k = w.t / w.life;
      if (k >= 1) { this.scene.remove(w.m); w.m.material.dispose(); this.waves.splice(i, 1); continue; }
      const ease = 1 - (1 - k) * (1 - k);
      if (w.ring) {
        const dist = 1.4 + ease * w.range;
        w.m.position.copy(w.o).addScaledVector(w.d, dist);
        w.m.scale.setScalar(0.25 + dist * w.tan);
        w.m.material.opacity = 0.28 * (1 - k);
      } else {
        const len = 1 + ease * w.range;
        w.m.scale.set(len * w.tan, len * w.tan, len);
        w.m.material.opacity = 0.12 * (1 - k) * Math.min(1, w.t * 20);
      }
    }
  }

  explosion(pos, radius = 4) {
    const p = new THREE.Vector3(pos.x, pos.y, pos.z);
    const k = radius / 4.5;
    this.blastLight.color.set(0xff9a40);
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
      f.tint = null;
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
    this.ceilingDust(p, radius * 1.2, 1.2 * k);
    // scorch on the floor (or whatever is below)
    const h = this.sim.raycastWorld({ x: p.x, y: p.y + 0.1, z: p.z }, { x: 0, y: -1, z: 0 }, 2.5);
    const sp = h ? new THREE.Vector3(h.point.x, h.point.y, h.point.z) : new THREE.Vector3(p.x, 0, p.z);
    if (sp.y < 0.05 || h) this.placeDecal(this.scorches, 12, this.scorchMat, sp, h ? new THREE.Vector3(h.normal.x, h.normal.y, h.normal.z) : UP, 2.2 * k);
  }

  // ---------------------------------------------------------------------------
  update(dt) {
    this.time += dt;
    this.updateWaves(dt);
    // droplets
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.v.y -= p.gravity * dt;
      p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.p.addScaledVector(p.v, dt);
      if (p.p.y < 0.01) {
        if (p.floorDecal) {
          // drops hitting the floor leave spots, streaked the way they were flying
          const hv = _v.set(p.v.x, p.v.y, p.v.z);
          this.bloodDecal(new THREE.Vector3(p.p.x, 0, p.p.z), UP, p.decalSize || 0.12 + Math.random() * 0.2, hv.lengthSq() > 4 ? hv.clone().normalize() : null);
          p.floorDecal = false;
        }
        if (this.puddles && p.v.y < -2 && Math.random() < 0.5) this.puddles.splash(p.p.x, p.p.z);
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
      if (p.rise) p.vel.y += p.rise * dt;
      p.s.position.addScaledVector(p.vel, dt);
      if (p.spin) p.s.material.rotation += p.spin * dt;
      p.s.scale.setScalar(p.size * (1 + k * p.grow));
      // smoke swells in then thins out slowly; other puffs just fade
      p.s.material.opacity = p.smoke ? p.alpha * Math.min(1, k * 8) * Math.pow(1 - k, 1.3) : p.alpha * (1 - k) * (1 - k);
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

    // blood pools spreading
    for (const m of this.pools) {
      const pl = m.userData.pool;
      if (!pl || pl.t > 6) continue;
      pl.t += dt;
      const k = Math.max(0, pl.t - pl.delay) / 5;
      const s = pl.size * Math.max(0.01, 1 - Math.pow(1 - Math.min(1, k), 3));
      m.scale.set(s, s, 1);
    }

    // grit trickling from the ceiling
    for (let i = this.streams.length - 1; i >= 0; i--) {
      const st = this.streams[i];
      st.t += dt;
      if (st.t > st.life) { this.streams.splice(i, 1); continue; }
      st.acc += dt * 30 * (1 - st.t / st.life);
      while (st.acc > 1) {
        st.acc -= 1;
        this.spawnParticle(new THREE.Vector3(st.x + (Math.random() - 0.5) * 0.08, st.y, st.z + (Math.random() - 0.5) * 0.08), new THREE.Vector3((Math.random() - 0.5) * 0.2, -0.3, (Math.random() - 0.5) * 0.2), { life: 2.5, size: 0.012 + Math.random() * 0.016, color: [0.32, 0.3, 0.26], gravity: 7, drag: 0.6 });
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
      if (f.tint) f.s.material.color.setRGB(f.tint.r * 3 * (1 - k * 0.5), f.tint.g * 3 * (1 - k * 0.5), f.tint.b * 3 * (1 - k * 0.5));
      else f.s.material.color.setRGB(3 - k * 1.5, 1.6 - k * 1.2, 0.6 - k * 0.5);
    }
    if (this.blastT > 0) { this.blastT -= dt; this.blastLight.intensity *= Math.exp(-dt * 9); if (this.blastT <= 0) this.blastLight.intensity = 0; }

    // lightning bolts
    if (this.bolts) {
      for (const b of this.bolts) {
        if (b.life <= 0) continue;
        b.life -= dt;
        b.mat.opacity = Math.max(0, b.life / 0.22) * (Math.random() < 0.3 ? 0.4 : 1);
        if (b.life <= 0) for (const l of b.lines) l.visible = false;
      }
      if (this.boltT > 0) { this.boltT -= dt; this.boltLight.intensity *= Math.exp(-dt * 12); if (this.boltT <= 0) this.boltLight.intensity = 0; }
    }

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
    if (this.fixtures) {
      const col = this.beamCol, base = this.beamBase, fx = this.fixtures, fix = this.beamFix;
      for (let i = 0; i < fix.length; i++) {
        const fi = fix[i];
        if (fi < 0) continue;
        const l = fx[fi] ? fx[fi].level : 0;
        col[i * 3] = base[i * 3] * l; col[i * 3 + 1] = base[i * 3 + 1] * l; col[i * 3 + 2] = base[i * 3 + 2] * l;
      }
      this.beamDust.geometry.attributes.color.needsUpdate = true;
    }
    this.beamDust.geometry.attributes.position.needsUpdate = true;
  }

  clear() {
    this.particles.length = 0;
    for (const d of [...this.bloodDecals, ...this.holes, ...this.scorches, ...this.pools]) this.scene.remove(d);
    this.bloodDecals.length = 0; this.holes.length = 0; this.scorches.length = 0; this.pools.length = 0;
    this.streams.length = 0; this.heat = 0;
    for (const f of this.fires) f.s.visible = false;
    this.blastLight.intensity = 0;
    for (const g of this.gibList) this.scene.remove(g.m);
    this.gibList.length = 0;
    this.emitters.length = 0;
    if (this.waves) { for (const w of this.waves) this.scene.remove(w.m); this.waves.length = 0; }
  }
}
