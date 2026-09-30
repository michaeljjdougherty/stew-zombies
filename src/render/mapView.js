// =============================================================================
// Map rendering: builds the gym from map data and animates lights and boards.
// =============================================================================
import * as THREE from 'three';
import { BoxBatch, bx } from './geometry.js';
import * as T from './textures.js';

export class MapView {
  constructor(scene, sim, cfg) {
    this.scene = scene;
    this.sim = sim;
    this.cfg = cfg;
    this.map = sim.mapData;
    this.world = sim.world;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.fixtures = [];
    this.windowViews = new Map();
    this.flyingPlanks = [];
    this.time = 0;

    this.buildMaterials();
    this.buildFloor();
    this.buildWalls();
    this.buildCeiling();
    this.buildBleachers();
    this.buildBanner();
    this.buildScoreboard();
    this.buildHoops();
    this.buildDoors();
    this.buildWindows();
    this.buildExterior();
    this.buildLights();
    this.buildProps();
  }

  buildMaterials() {
    T.seedTextures(1);
    this.mats = {
      floor: new THREE.MeshStandardMaterial({ map: T.gymFloorTexture(), roughness: 0.38, metalness: 0.0 }),
      wall: new THREE.MeshStandardMaterial({ map: T.wallTexture({ height: this.map.height, upper: '#6e695b' }), roughness: 0.92 }),
      ceiling: new THREE.MeshStandardMaterial({ map: T.ceilingTexture(), roughness: 1 }),
      wood: new THREE.MeshStandardMaterial({ map: T.woodTexture(), roughness: 0.75 }),
      darkWood: new THREE.MeshStandardMaterial({ map: T.woodTexture({ dark: true }), roughness: 0.85 }),
      metal: new THREE.MeshStandardMaterial({ map: T.metalTexture(), roughness: 0.7, metalness: 0.2 }),
      rustMetal: new THREE.MeshStandardMaterial({ map: T.metalTexture({ color: '#4a4538', rust: 1 }), roughness: 0.8, metalness: 0.15 }),
      ground: new THREE.MeshStandardMaterial({ map: T.groundTexture(), roughness: 1 }),
      windowFrame: new THREE.MeshStandardMaterial({ color: '#2a2620', roughness: 0.9 }),
      glass: new THREE.MeshStandardMaterial({ color: '#8a9a9a', roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    };
    this.plankTextures = [0, 1, 2, 3].map((i) => T.plankTexture(i));
    this.plankMats = this.plankTextures.map((t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  }

  buildFloor() {
    const { minX, maxX, minZ, maxZ } = this.map.bounds;
    const w = maxX - minX, d = maxZ - minZ;
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    // world-meter UVs
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i));
    const floor = new THREE.Mesh(geo, this.mats.floor);
    floor.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    this.group.add(floor);

    const overlay = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        map: T.courtOverlayTexture(this.map), transparent: true, roughness: 0.5,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      }),
    );
    overlay.position.set((minX + maxX) / 2, 0.004, (minZ + maxZ) / 2);
    this.group.add(overlay);
  }

  buildWalls() {
    const batch = new BoxBatch();
    for (const b of this.world.walls) batch.add(b);
    const mesh = new THREE.Mesh(batch.build(), this.mats.wall);
    this.group.add(mesh);
  }

  buildCeiling() {
    const { minX, maxX, minZ, maxZ } = this.map.bounds;
    const H = this.map.height, T0 = this.map.wallThickness;
    const ceil = new BoxBatch().add({ minX: minX - T0, maxX: maxX + T0, minY: H, maxY: H + 0.3, minZ: minZ - T0, maxZ: maxZ + T0 });
    this.group.add(new THREE.Mesh(ceil.build(), this.mats.ceiling));

    // steel trusses spanning north-south
    const tr = new BoxBatch();
    for (let x = minX + 3.4; x < maxX - 1; x += 5.6) {
      tr.add(bx(x, H - 0.1, 0, 0.18, 0.2, maxZ - minZ));
      tr.add(bx(x, H - 1.3, 0, 0.16, 0.16, maxZ - minZ - 1.5));
      for (let z = minZ + 1; z < maxZ - 0.5; z += 1.6) tr.add(bx(x, H - 0.7, z, 0.08, 1.2, 0.08));
    }
    // purlins
    for (let z = minZ + 2; z < maxZ; z += 4) tr.add(bx(0, H - 0.25, z, maxX - minX, 0.12, 0.12));
    this.group.add(new THREE.Mesh(tr.build(), this.mats.rustMetal));
  }

  buildBleachers() {
    const wood = new BoxBatch(), metal = new BoxBatch();
    for (const b of this.world.bleacherBoxes) {
      // tier body
      wood.add(b, { skip: new Set([3]) });
      // seat board on each tier (visual only)
      const dir = b.side === 'north' ? 1 : -1;
      const front = dir > 0 ? b.maxZ : b.minZ;
      const seatZ = front - dir * 0.18;
      metal.add({ minX: b.minX, maxX: b.maxX, minY: b.maxY - 0.02, maxY: b.maxY + 0.02, minZ: seatZ - 0.02, maxZ: seatZ + 0.02 });
    }
    // end railings
    for (const bl of this.map.bleachers) {
      const wallZ = bl.side === 'north' ? this.map.bounds.minZ : this.map.bounds.maxZ;
      const dir = bl.side === 'north' ? 1 : -1;
      for (const x of [bl.x0 + 0.05, bl.x1 - 0.05]) {
        for (let i = 0; i < bl.rows; i++) {
          const z = wallZ + dir * (bl.rows * bl.depth - i * bl.depth - 0.1);
          metal.add(bx(x, (i + 1) * bl.rise + 0.45, z, 0.05, 0.9, 0.05));
        }
        const zA = wallZ + dir * (bl.rows * bl.depth - 0.1), zB = wallZ + dir * 0.1;
        const yA = bl.rise + 0.9, yB = bl.rows * bl.rise + 0.9;
        // sloped hand rail approximated with short segments
        const segs = 10;
        for (let s = 0; s < segs; s++) {
          const t0 = s / segs, t1 = (s + 1) / segs;
          const za = zA + (zB - zA) * t0, zb = zA + (zB - zA) * t1;
          const ya = yA + (yB - yA) * t0, yb = yA + (yB - yA) * t1;
          metal.add({ minX: x - 0.03, maxX: x + 0.03, minY: Math.min(ya, yb) - 0.02, maxY: Math.max(ya, yb) + 0.02, minZ: Math.min(za, zb), maxZ: Math.max(za, zb) });
        }
      }
    }
    this.group.add(new THREE.Mesh(wood.build(), this.mats.wood));
    this.group.add(new THREE.Mesh(metal.build(), this.mats.metal));
  }

  buildBanner() {
    const b = this.map.banner;
    const geo = new THREE.PlaneGeometry(b.width, b.height, 24, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const sag = Math.cos((x / b.width) * Math.PI) * 0.18 * (0.5 - y / b.height);
      pos.setY(i, y - sag * 0.6);
      pos.setZ(i, Math.sin(x * 2.1 + y) * 0.02 + (0.5 - y / b.height) * 0.12);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: T.bannerTexture(b.text), roughness: 0.95, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    const z = this.map.bounds.minZ + 0.08;
    mesh.position.set(b.x, b.y, z);
    this.group.add(mesh);
    // mounting pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, b.width + 0.6, 8).rotateZ(Math.PI / 2), this.mats.metal);
    pole.position.set(b.x, b.y + b.height / 2 + 0.05, z + 0.02);
    this.group.add(pole);
  }

  buildScoreboard() {
    const s = this.map.scoreboard;
    this.scoreTex = new T.ScoreboardTexture();
    const z = this.map.bounds.maxZ;
    const body = new THREE.Mesh(new BoxBatch().add(bx(s.x, s.y, z - 0.25, s.width + 0.3, s.height + 0.3, 0.5)).build(), this.mats.metal);
    this.group.add(body);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(s.width, s.height),
      new THREE.MeshStandardMaterial({ map: this.scoreTex.texture, emissive: 0xffffff, emissiveMap: this.scoreTex.texture, emissiveIntensity: 0.9, roughness: 0.6 }),
    );
    face.position.set(s.x, s.y, z - 0.51);
    face.rotation.y = Math.PI;
    this.group.add(face);
    this.scoreLight = new THREE.PointLight(0xff3a1e, 6, 9, 1.6);
    this.scoreLight.position.set(s.x, s.y - 0.5, z - 1.5);
    this.group.add(this.scoreLight);
    this.lastScore = { round: -1, kills: -1 };
  }

  buildHoops() {
    const [c, g] = T.makeCanvas(256, 150);
    g.fillStyle = '#d8d6ca'; g.fillRect(0, 0, 256, 150);
    g.strokeStyle = '#7a2a20'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 138); g.strokeRect(88, 60, 80, 60);
    g.fillStyle = 'rgba(30,25,15,0.4)'; for (let i = 0; i < 60; i++) g.fillRect(Math.random() * 256, Math.random() * 150, 3, 3);
    const boardMat = new THREE.MeshStandardMaterial({ map: T.toTexture(c, { repeat: false }), roughness: 0.4 });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#b04a1a', roughness: 0.5, metalness: 0.6 });
    const netMat = new THREE.LineBasicMaterial({ color: '#b8b4a4', transparent: true, opacity: 0.8 });
    for (const h of this.map.hoops) {
      const grp = new THREE.Group();
      grp.position.set(h.x + h.facing * 1.25, 0, h.z);
      grp.rotation.y = h.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.04), boardMat);
      board.position.set(0, 3.45, 0);
      grp.add(board);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.012, 6, 24).rotateX(Math.PI / 2), rimMat);
      rim.position.set(0, 3.05, 0.38);
      grp.add(rim);
      // net
      const pts = [];
      const N = 12;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
        const top = (a) => new THREE.Vector3(Math.cos(a) * 0.23, 3.05, 0.38 + Math.sin(a) * 0.23);
        const bot = (a) => new THREE.Vector3(Math.cos(a) * 0.14, 2.62 - (i % 4 === 0 ? 0.08 : 0), 0.38 + Math.sin(a) * 0.14);
        pts.push(top(a0), bot(a1), top(a1), bot(a0));
      }
      grp.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), netMat));
      // support arm to the wall
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.25), this.mats.metal);
      arm.position.set(0, 3.6, -0.62);
      grp.add(arm);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.6), this.mats.metal);
      brace.position.set(0, 4.3, -0.62); brace.rotation.x = 0.8;
      grp.add(brace);
      this.group.add(grp);
    }
  }

  buildDoors() {
    const chainMat = new THREE.MeshStandardMaterial({ color: '#5a5650', metalness: 0.8, roughness: 0.5 });
    const linkGeo = new THREE.TorusGeometry(0.04, 0.01, 4, 8);
    for (const d of this.map.doors) {
      const box = this.world.doorBoxes.find((b) => b.doorId === d.id);
      const mat = new THREE.MeshStandardMaterial({ map: T.doorTexture(d.label), roughness: 0.7, metalness: 0.3 });
      const grp = new THREE.Group();
      const inward = d.wall === 'east' ? -1 : 1; // +x direction into room
      const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
      grp.position.set(d.wall === 'east' ? box.minX : box.maxX, 0, cz);
      grp.rotation.y = inward > 0 ? Math.PI / 2 : -Math.PI / 2;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(d.width, d.height), mat);
      panel.position.set(0, d.height / 2, 0.02);
      grp.add(panel);
      // frame
      const fr = new BoxBatch();
      fr.add(bx(-d.width / 2 - 0.06, d.height / 2, 0.03, 0.12, d.height, 0.1));
      fr.add(bx(d.width / 2 + 0.06, d.height / 2, 0.03, 0.12, d.height, 0.1));
      fr.add(bx(0, d.height + 0.06, 0.03, d.width + 0.24, 0.12, 0.1));
      grp.add(new THREE.Mesh(fr.build(), this.mats.metal));
      // chains in an X and a padlock
      for (const s of [-1, 1]) {
        const n = 22;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const l = new THREE.Mesh(linkGeo, chainMat);
          l.position.set(-d.width / 2 * 0.9 + t * d.width * 0.9, 0.4 + (s > 0 ? t : 1 - t) * 2.2 + Math.sin(t * Math.PI) * -0.15, 0.08);
          l.rotation.set(i % 2 ? Math.PI / 2 : 0, 0, Math.atan2(2.2 * s, d.width * 0.9));
          grp.add(l);
        }
      }
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.05), new THREE.MeshStandardMaterial({ color: '#8a7a40', metalness: 0.8, roughness: 0.4 }));
      lock.position.set(0, 1.45, 0.11);
      grp.add(lock);
      // exit sign
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.26, 0.08),
        [this.mats.metal, this.mats.metal, this.mats.metal, this.mats.metal,
          new THREE.MeshStandardMaterial({ map: T.signTexture('EXIT'), emissive: 0xffffff, emissiveMap: T.signTexture('EXIT'), emissiveIntensity: 1.6 }),
          this.mats.metal],
      );
      sign.position.set(0, d.height + 0.4, 0.06);
      grp.add(sign);
      this.group.add(grp);
    }
  }

  buildWindows() {
    const wc = this.cfg.windows;
    const T0 = this.map.wallThickness;
    for (const w of this.sim.windows) {
      const n = w.normal;
      const grp = new THREE.Group();
      // local frame: +z points into the room, origin at window center on the inner wall face
      grp.position.set(w.center.x, 0, w.center.z);
      grp.rotation.y = Math.atan2(n.x, n.z);
      this.group.add(grp);
      const fr = new BoxBatch();
      const hw = wc.width / 2;
      fr.add(bx(-hw - 0.05, (wc.sillHeight + wc.topHeight) / 2, -T0 / 2, 0.1, wc.topHeight - wc.sillHeight, T0 + 0.04));
      fr.add(bx(hw + 0.05, (wc.sillHeight + wc.topHeight) / 2, -T0 / 2, 0.1, wc.topHeight - wc.sillHeight, T0 + 0.04));
      fr.add(bx(0, wc.sillHeight - 0.03, -T0 / 2, wc.width + 0.2, 0.08, T0 + 0.12));
      fr.add(bx(0, wc.topHeight + 0.03, -T0 / 2, wc.width + 0.2, 0.08, T0 + 0.04));
      // mullion cross, half broken
      fr.add(bx(0, (wc.sillHeight + wc.topHeight) / 2 + 0.4, -T0 * 0.8, 0.05, 0.9, 0.05));
      grp.add(new THREE.Mesh(fr.build(), this.mats.windowFrame));
      // jagged glass shards stuck in the frame
      const shardPts = [];
      const addShard = (x0, y0, x1, y1, x2, y2) => shardPts.push(x0, y0, -T0 * 0.8, x1, y1, -T0 * 0.8, x2, y2, -T0 * 0.8);
      const s = wc.sillHeight, t = wc.topHeight;
      addShard(-hw, t, -hw + 0.5, t, -hw, t - 0.6);
      addShard(hw, t, hw - 0.3, t, hw, t - 0.9);
      addShard(-hw, s, -hw + 0.35, s, -hw, s + 0.5);
      addShard(hw, s, hw - 0.6, s, hw, s + 0.25);
      addShard(-0.1, t, 0.3, t, 0.1, t - 0.35);
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(shardPts, 3));
      sg.computeVertexNormals();
      grp.add(new THREE.Mesh(sg, this.mats.glass));

      // planks: nailed across the inside of the opening
      const planks = [];
      const order = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
      for (let i = 0; i < w.maxBoards; i++) {
        const y = wc.sillHeight + 0.2 + (i / (w.maxBoards - 1)) * (wc.topHeight - wc.sillHeight - 0.4);
        const rot = (i % 2 ? 1 : -1) * (0.06 + Math.random() * 0.14);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(wc.width + 0.35, 0.17, 0.035), this.plankMats[i % this.plankMats.length]);
        const home = { x: (Math.random() - 0.5) * 0.08, y, z: 0.05 + (i % 3) * 0.012, rz: rot };
        mesh.position.set(home.x, home.y, home.z);
        mesh.rotation.z = rot;
        grp.add(mesh);
        planks.push({ mesh, home, anim: null });
      }
      this.windowViews.set(w.id, { win: w, grp, planks, order, shown: w.maxBoards });
    }
  }

  buildExterior() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140).rotateX(-Math.PI / 2), this.mats.ground);
    const uv = ground.geometry.attributes.uv, pos = ground.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i));
    ground.position.y = -0.02;
    this.group.add(ground);

    // chain-link fence
    const [c, g] = T.makeCanvas(128, 128);
    g.strokeStyle = 'rgba(150,150,140,0.9)'; g.lineWidth = 3;
    for (let i = -128; i < 256; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke();
      g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke();
    }
    const ft = T.toTexture(c);
    const fenceMat = new THREE.MeshStandardMaterial({ map: ft, alphaTest: 0.4, transparent: false, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.6 });
    const { minX, maxX, minZ, maxZ } = this.map.bounds;
    for (const z of [minZ - 13, maxZ + 13]) {
      const geo = new THREE.PlaneGeometry(70, 3.2);
      const u = geo.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * 70 / 0.6, u.getY(i) * 3.2 / 0.6);
      const f = new THREE.Mesh(geo, fenceMat);
      f.position.set(0, 1.6, z);
      this.group.add(f);
      for (let x = -35; x <= 35; x += 3) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 6), this.mats.rustMetal);
        post.position.set(x, 1.7, z);
        this.group.add(post);
      }
    }
    // dead trees
    const barkMat = new THREE.MeshStandardMaterial({ color: '#1e1a14', roughness: 1 });
    const treeSpots = [[-24, minZ - 9], [-8, minZ - 11], [9, minZ - 8], [26, minZ - 10], [-20, maxZ + 9], [4, maxZ + 11], [22, maxZ + 8]];
    for (const [x, z] of treeSpots) this.group.add(deadTree(x, z, barkMat));
    // the rest of the school, as dark masses in the fog
    const massMat = new THREE.MeshStandardMaterial({ color: '#221f1a', roughness: 1 });
    const mass = new BoxBatch();
    mass.add({ minX: maxX + 0.5, maxX: maxX + 30, minY: 0, maxY: 7, minZ: minZ - 2, maxZ: maxZ + 2 });
    mass.add({ minX: minX - 30, maxX: minX - 0.5, minY: 0, maxY: 6, minZ: minZ - 2, maxZ: maxZ + 2 });
    this.group.add(new THREE.Mesh(mass.build(), massMat));
  }

  buildLights() {
    const scene = this.group;
    const g = this.cfg.graphics;
    this.hemi = new THREE.HemisphereLight(0x6f7580, 0x2a2016, g.ambientLight);
    scene.add(this.hemi);

    const housingMat = this.mats.metal;
    const tubeGeo = new THREE.PlaneGeometry(1.25, 0.24).rotateX(Math.PI / 2);
    const beamTex = T.beamTexture();
    for (const f of this.map.fixtures) {
      const grp = new THREE.Group();
      grp.position.set(f.x, f.y, f.z);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.38), housingMat);
      grp.add(housing);
      const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.08, 0.07), fog: true });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.position.y = -0.065;
      grp.add(tube);
      // hanging rods
      for (const x of [-0.55, 0.55]) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.1, 4), housingMat);
        rod.position.set(x, 0.6, 0);
        grp.add(rod);
      }
      if (!f.lit && Math.random() < 0.3) { grp.rotation.z = 0.25; grp.position.y -= 0.2; } // one end dropped
      this.group.add(grp);
      const fx = { data: f, grp, tubeMat, light: null, beam: null, level: f.lit ? 1 : 0, target: f.lit ? 1 : 0, timer: Math.random() * 3, burst: 0, buzz: f.flicker };
      if (f.lit) {
        fx.light = new THREE.PointLight(0xffe7c0, 120, 22, 1.8);
        fx.light.position.set(f.x, f.y - 0.3, f.z);
        scene.add(fx.light);
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 2.6, 6.5, 20, 1, true),
          new THREE.MeshBasicMaterial({ map: beamTex, color: 0xffe0b0, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true }),
        );
        beam.position.set(f.x, f.y - 3.3, f.z);
        scene.add(beam);
        fx.beam = beam;
      }
      this.fixtures.push(fx);
    }

    // red emergency lights
    for (const e of this.map.emergencyLights) {
      const l = new THREE.PointLight(0xff2010, 14, 11, 1.5);
      l.position.set(e.x, e.y, e.z);
      scene.add(l);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.18), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.4, 0.2) }));
      bulb.position.set(e.x, e.y + 0.3, e.z);
      scene.add(bulb);
    }

    // moonlight spilling through the windows
    for (const w of this.sim.windows) {
      const n = w.normal;
      const spot = new THREE.SpotLight(0x8fa6c8, 90, 22, 0.45, 0.6, 1.25);
      spot.position.set(w.center.x - n.x * 5, 5.2, w.center.z - n.z * 5);
      spot.target.position.set(w.center.x + n.x * 4, 0, w.center.z + n.z * 4);
      scene.add(spot); scene.add(spot.target);
      // visible shaft
      const len = 7;
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 1.4, len, 16, 1, true),
        new THREE.MeshBasicMaterial({ map: beamTex, color: 0x9ab0d0, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      const from = new THREE.Vector3(w.center.x - n.x * 0.2, 1.8, w.center.z - n.z * 0.2);
      const to = new THREE.Vector3(w.center.x + n.x * 4, 0, w.center.z + n.z * 4);
      const dir = to.clone().sub(from).normalize();
      shaft.position.copy(from).addScaledVector(dir, len / 2);
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      scene.add(shaft);
    }
  }

  buildProps() {
    // basketballs
    const [c, g] = T.makeCanvas(128, 64);
    g.fillStyle = '#7a4020'; g.fillRect(0, 0, 128, 64);
    g.strokeStyle = '#1a0e08'; g.lineWidth = 2;
    for (const x of [0, 32, 64, 96]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
    g.beginPath(); g.moveTo(0, 32); g.lineTo(128, 32); g.stroke();
    const ballMat = new THREE.MeshStandardMaterial({ map: T.toTexture(c), roughness: 0.8 });
    const balls = [[-6, 4.5], [7.5, -3], [-12.5, -6.8], [12.8, 7.2]];
    for (const [x, z] of balls) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), ballMat);
      b.position.set(x, 0.12, z);
      b.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.group.add(b);
    }
    // a tipped-over ball cart and folding chairs against the walls
    const cart = new THREE.Mesh(new BoxBatch().add(bx(15.5, 0.35, -10.5, 1.0, 0.7, 0.6)).build(), this.mats.rustMetal);
    cart.rotation.z = 0.1;
    this.group.add(cart);
    for (let i = 0; i < 5; i++) {
      const chair = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.42), this.mats.metal);
      seat.position.y = 0.45; chair.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.03), this.mats.metal);
      back.position.set(0, 0.75, -0.2); chair.add(back);
      for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.45, 0.025), this.mats.metal);
        leg.position.set(lx, 0.225, lz); chair.add(leg);
      }
      chair.position.set(-15.8 + (i % 2) * 0.6, 0, 8.5 + i * 0.7);
      chair.rotation.set(i === 2 ? Math.PI / 2 : 0, Math.random() * 6, i === 4 ? Math.PI / 2 : 0);
      if (i === 2 || i === 4) chair.position.y = 0.2;
      this.group.add(chair);
    }
  }

  // --- dynamic -------------------------------------------------------------
  onEvent(e) {
    if (e.type === 'boardTorn') {
      const v = this.windowViews.get(e.windowId);
      if (!v) return;
      const plank = v.planks[v.order[e.board]];
      plank.anim = { kind: 'tear', t: 0, vx: (Math.random() - 0.5) * 2, vy: 2.5, vz: -3.5, spin: (Math.random() - 0.5) * 12 };
    } else if (e.type === 'boardRepaired') {
      const v = this.windowViews.get(e.windowId);
      if (!v) return;
      const plank = v.planks[v.order[e.board]];
      plank.mesh.visible = true;
      plank.anim = { kind: 'repair', t: 0 };
    }
  }

  update(dt, localPlayer, roundInfo) {
    this.time += dt;
    // fluorescent flicker
    for (const f of this.fixtures) {
      if (!f.data.lit) continue;
      f.timer -= dt;
      if (f.burst > 0) {
        f.burst -= dt;
        if (f.timer <= 0) {
          f.target = f.target > 0.5 ? (Math.random() < 0.5 ? 0.05 : 0.35) : 1;
          f.timer = 0.02 + Math.random() * 0.09;
        }
        if (f.burst <= 0) f.target = Math.random() < f.data.flicker * 0.3 ? 0 : 1;
      } else if (f.timer <= 0) {
        if (Math.random() < f.data.flicker) f.burst = 0.15 + Math.random() * 1.1;
        f.timer = 1 + Math.random() * 5 * (1.2 - f.data.flicker);
        if (f.target === 0 && Math.random() < 0.6) f.target = 1;
      }
      f.level += (f.target - f.level) * Math.min(1, dt * 40);
      const hum = 1 + Math.sin(this.time * 120) * 0.015;
      if (f.light) f.light.intensity = 120 * f.level * hum;
      f.tubeMat.color.setRGB(2.6 * f.level + 0.06, 2.45 * f.level + 0.06, 2.1 * f.level + 0.05);
      if (f.beam) f.beam.material.opacity = 0.045 * f.level;
    }

    // scoreboard
    if (roundInfo && (roundInfo.round !== this.lastScore.round || roundInfo.kills !== this.lastScore.kills)) {
      this.scoreTex.draw(roundInfo.round, roundInfo.kills);
      this.lastScore = { round: roundInfo.round, kills: roundInfo.kills };
    }

    // planks
    for (const v of this.windowViews.values()) {
      for (const p of v.planks) {
        const a = p.anim;
        if (!a) continue;
        a.t += dt;
        if (a.kind === 'tear') {
          // yanked outward (local -z), tumbling down
          a.vy -= 9.8 * dt;
          p.mesh.position.x += a.vx * dt;
          p.mesh.position.y += a.vy * dt;
          p.mesh.position.z += a.vz * dt;
          p.mesh.rotation.x += a.spin * dt;
          if (p.mesh.position.y < 0.05) { p.mesh.position.y = 0.05; a.vy *= -0.3; a.vx *= 0.5; a.vz *= 0.5; a.spin *= 0.5; }
          if (a.t > 1.6) { p.mesh.visible = false; p.anim = null; }
        } else if (a.kind === 'repair') {
          const t = Math.min(1, a.t / 0.22);
          const e = 1 - Math.pow(1 - t, 3);
          p.mesh.position.set(p.home.x, p.home.y * e + 0.1 * (1 - e), p.home.z + 0.9 * (1 - e));
          p.mesh.rotation.set((1 - e) * 1.2, 0, p.home.rz);
          if (t >= 1) { p.anim = null; p.mesh.rotation.set(0, 0, p.home.rz); }
        }
      }
      // make sure hidden/shown matches sim (e.g. after restart)
      for (let k = 0; k < v.planks.length; k++) {
        const p = v.planks[v.order[k]];
        const should = k < v.win.boards;
        if (!p.anim) {
          p.mesh.visible = should;
          if (should) { p.mesh.position.set(p.home.x, p.home.y, p.home.z); p.mesh.rotation.set(0, 0, p.home.rz); }
        }
      }
    }
  }
}

function deadTree(x, z, mat) {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  const h = 5 + Math.random() * 4;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, h, 6), mat);
  trunk.position.y = h / 2;
  grp.add(trunk);
  for (let i = 0; i < 6; i++) {
    const len = 1.2 + Math.random() * 2;
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.08, len, 4), mat);
    const y = h * (0.45 + Math.random() * 0.5);
    const a = Math.random() * Math.PI * 2;
    br.position.set(Math.cos(a) * len * 0.35, y + len * 0.3, Math.sin(a) * len * 0.35);
    br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    grp.add(br);
  }
  grp.rotation.z = (Math.random() - 0.5) * 0.15;
  return grp;
}
