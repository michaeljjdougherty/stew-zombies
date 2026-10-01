// =============================================================================
// Map rendering: builds every room from map data (floors, walls, ceilings,
// furniture, windows, doors, wall weapons), dresses the court, and runs the
// lights. Lights are "virtual": each frame the nearest ones are streamed into
// a fixed pool of real lights so shader cost stays flat as the map grows.
// =============================================================================
import * as THREE from 'three';
import { BoxBatch, bx } from './geometry.js';
import * as T from './textures.js';
import { campusBounds } from '../map/school.js';

const SIDE_FACES = { n: [4, 5], s: [5, 4], w: [0, 1], e: [1, 0] }; // [inward face, outward face]

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
    this.vlights = [];
    this.vspots = [];
    this.windowViews = new Map();
    this.doorViews = new Map();
    this.time = 0;
    this.T = this.map.wallThickness;

    this.buildMaterials();
    for (const room of this.map.rooms) this.buildRoom(room);
    this.buildWalls();
    this.buildCourt();
    this.buildProps();
    this.buildWindows();
    this.buildDoors();
    this.buildWallBuys();
    this.buildExterior();
    this.buildLights();
  }

  // ---------------------------------------------------------------------------
  buildMaterials() {
    T.seedTextures(1);
    const std = (o) => new THREE.MeshStandardMaterial(o);
    this.mats = {
      gymFloor: std({ map: T.gymFloorTexture(), roughness: 0.38 }),
      tile: std({ map: T.linoleumTexture({ tile: 0.3 }), roughness: 0.45 }),
      tile_big: std({ map: T.linoleumTexture({ tile: 0.45, a: '#8e8c7a', b: '#6f5a48', seed: 9 }), roughness: 0.4 }),
      carpet: std({ map: T.carpetTexture(), roughness: 1 }),
      trussCeiling: std({ map: T.ceilingTexture(), roughness: 1 }),
      drop: std({ map: T.dropCeilingTexture(), roughness: 1 }),
      wood: std({ map: T.woodTexture(), roughness: 0.75 }),
      darkWood: std({ map: T.woodTexture({ dark: true }), roughness: 0.85 }),
      metal: std({ map: T.metalTexture(), roughness: 0.7, metalness: 0.2 }),
      rustMetal: std({ map: T.metalTexture({ color: '#4a4538', rust: 1 }), roughness: 0.8, metalness: 0.15 }),
      ground: std({ map: T.groundTexture(), roughness: 1 }),
      windowFrame: std({ color: '#2a2620', roughness: 0.9 }),
      glass: std({ color: '#8a9a9a', roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
      lockers: std({ map: T.lockerTexture(), roughness: 0.6, metalness: 0.3 }),
      lockers2: std({ map: T.lockerTexture({ color: '#6b5a3a', seed: 33 }), roughness: 0.6, metalness: 0.3 }),
      cabinets: std({ map: T.cabinetTexture(), roughness: 0.6, metalness: 0.3 }),
      shelf: std({ map: T.bookshelfTexture(), roughness: 0.9 }),
      tableTop: std({ map: T.tableTopTexture(), roughness: 0.5 }),
      steel: std({ map: T.steelTexture(), roughness: 0.35, metalness: 0.5 }),
    };
    this.wallMats = {
      gym: std({ map: T.wallTexture({ height: 9, upper: '#6e695b' }), roughness: 0.92 }),
      hall: std({ map: T.roomWallTexture({ height: 5, upper: '#8a846e', lower: '#3f5a50', lowerH: 1.25, stripe: '#6d2a24', seed: 3 }), roughness: 0.9 }),
      office: std({ map: T.roomWallTexture({ height: 3.2, upper: '#7d7560', lower: '#4a3322', lowerH: 1.0, blocks: false, panel: true, seed: 5 }), roughness: 0.9 }),
      principal: std({ map: T.roomWallTexture({ height: 3.2, upper: '#6f6452', lower: '#3e2a1c', lowerH: 1.0, blocks: false, panel: true, seed: 6 }), roughness: 0.9 }),
      cafe: std({ map: T.roomWallTexture({ height: 5, upper: '#8d8a78', lower: '#6f8a7c', lowerH: 1.5, tiles: true, seed: 7 }), roughness: 0.7 }),
      exterior: std({ map: T.brickTexture({ height: 9 }), roughness: 1 }),
    };
    this.plankMats = [0, 1, 2, 3].map((i) => new THREE.MeshStandardMaterial({ map: T.plankTexture(i), roughness: 0.9 }));
  }

  floorMat(type) {
    return { gym: this.mats.gymFloor, tile: this.mats.tile, tile_big: this.mats.tile_big, carpet: this.mats.carpet }[type] || this.mats.tile;
  }

  roomAtPoint(x, z) {
    for (const r of this.map.rooms) {
      const [x0, z0, x1, z1] = r.rect;
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return r;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  buildRoom(room) {
    const [x0, z0, x1, z1] = room.rect;
    const w = x1 - x0, d = z1 - z0;
    const geo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + (x0 + x1) / 2, -(pos.getZ(i) + (z0 + z1) / 2));
    const floor = new THREE.Mesh(geo, this.floorMat(room.floor));
    floor.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    this.group.add(floor);

    // floor grime / litter overlay for non-court rooms
    if (room.id !== 'court') {
      const ov = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ map: litterTexture(w, d, room.id.length * 17), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.8 }),
      );
      ov.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
      this.group.add(ov);
    }

    const H = room.height, Tt = this.T;
    if (room.ceiling === 'trusses') {
      this.buildTrussCeiling(room);
    } else {
      const c = new BoxBatch().add({ minX: x0 - Tt, maxX: x1 + Tt, minY: H, maxY: H + 0.25, minZ: z0 - Tt, maxZ: z1 + Tt });
      this.group.add(new THREE.Mesh(c.build(), this.mats.drop));
    }
  }

  buildTrussCeiling(room) {
    const [minX, minZ, maxX, maxZ] = room.rect;
    const H = room.height, Tt = this.T;
    const ceil = new BoxBatch().add({ minX: minX - Tt, maxX: maxX + Tt, minY: H, maxY: H + 0.3, minZ: minZ - Tt, maxZ: maxZ + Tt });
    this.group.add(new THREE.Mesh(ceil.build(), this.mats.trussCeiling));
    const tr = new BoxBatch();
    for (let x = minX + 3.4; x < maxX - 1; x += 5.6) {
      tr.add(bx(x, H - 0.1, 0, 0.18, 0.2, maxZ - minZ));
      tr.add(bx(x, H - 1.3, 0, 0.16, 0.16, maxZ - minZ - 1.5));
      for (let z = minZ + 1; z < maxZ - 0.5; z += 1.6) tr.add(bx(x, H - 0.7, z, 0.08, 1.2, 0.08));
    }
    for (let z = minZ + 2; z < maxZ; z += 4) tr.add(bx((minX + maxX) / 2, H - 0.25, z, maxX - minX, 0.12, 0.12));
    this.group.add(new THREE.Mesh(tr.build(), this.mats.rustMetal));
  }

  // Walls: the inside face uses the owning room's style, the outside face the
  // style of whatever is on the other side (another room, or exterior brick).
  buildWalls() {
    const batches = new Map();
    const get = (style) => { if (!batches.has(style)) batches.set(style, new BoxBatch()); return batches.get(style); };
    for (const b of this.world.walls) {
      const [inF, outF] = SIDE_FACES[b.side];
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      const room = this.world.roomById.get(b.room);
      const si = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[b.side];
      const other = this.roomAtPoint(cx + si[0] * (this.T / 2 + 0.2), cz + si[1] * (this.T / 2 + 0.2));
      const outStyle = other ? other.style : 'exterior';
      const all = [0, 1, 2, 3, 4, 5];
      get(room.style).add(b, { skip: new Set([outF]) });
      get(outStyle).add(b, { skip: new Set(all.filter((f) => f !== outF)) });
    }
    for (const [style, batch] of batches) {
      this.group.add(new THREE.Mesh(batch.build(), this.wallMats[style] || this.wallMats.exterior));
    }
  }

  // ---------------------------------------------------------------------------
  // Court dressing: bleachers, banner, scoreboard, hoops, court lines
  buildCourt() {
    const court = this.world.roomById.get('court');
    if (!court) return;
    const [x0, z0, x1, z1] = court.rect;
    const overlay = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: T.courtOverlayTexture({ bounds: { minX: x0, maxX: x1, minZ: z0, maxZ: z1 } }), transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    overlay.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
    this.group.add(overlay);

    // bleachers
    const wood = new BoxBatch(), metal = new BoxBatch();
    for (const b of this.world.bleacherBoxes) {
      wood.add(b, { skip: new Set([3]) });
      const dir = b.side === 'north' ? 1 : -1;
      const seatZ = (dir > 0 ? b.maxZ : b.minZ) - dir * 0.18;
      metal.add({ minX: b.minX, maxX: b.maxX, minY: b.maxY - 0.02, maxY: b.maxY + 0.02, minZ: seatZ - 0.02, maxZ: seatZ + 0.02 });
    }
    for (const bl of this.map.bleachers || []) {
      const wallZ = bl.side === 'north' ? z0 : z1;
      const dir = bl.side === 'north' ? 1 : -1;
      for (const x of [bl.x0 + 0.05, bl.x1 - 0.05]) {
        for (let i = 0; i < bl.rows; i++) {
          const z = wallZ + dir * (bl.rows * bl.depth - i * bl.depth - 0.1);
          metal.add(bx(x, (i + 1) * bl.rise + 0.45, z, 0.05, 0.9, 0.05));
        }
        const zA = wallZ + dir * (bl.rows * bl.depth - 0.1), zB = wallZ + dir * 0.1;
        const yA = bl.rise + 0.9, yB = bl.rows * bl.rise + 0.9;
        for (let s = 0; s < 10; s++) {
          const t0 = s / 10, t1 = (s + 1) / 10;
          const za = zA + (zB - zA) * t0, zb = zA + (zB - zA) * t1, ya = yA + (yB - yA) * t0, yb = yA + (yB - yA) * t1;
          metal.add({ minX: x - 0.03, maxX: x + 0.03, minY: Math.min(ya, yb) - 0.02, maxY: Math.max(ya, yb) + 0.02, minZ: Math.min(za, zb), maxZ: Math.max(za, zb) });
        }
      }
    }
    this.group.add(new THREE.Mesh(wood.build(), this.mats.wood));
    this.group.add(new THREE.Mesh(metal.build(), this.mats.metal));

    // banner
    const b = this.map.banner;
    if (b) {
      const geo = new THREE.PlaneGeometry(b.width, b.height, 24, 8);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const sag = Math.cos((x / b.width) * Math.PI) * 0.18 * (0.5 - y / b.height);
        pos.setY(i, y - sag * 0.6);
        pos.setZ(i, Math.sin(x * 2.1 + y) * 0.02 + (0.5 - y / b.height) * 0.12);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: T.bannerTexture(b.text), roughness: 0.95, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }));
      mesh.position.set(b.x, b.y, b.z + 0.08);
      this.group.add(mesh);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, b.width + 0.6, 8).rotateZ(Math.PI / 2), this.mats.metal);
      pole.position.set(b.x, b.y + b.height / 2 + 0.05, b.z + 0.1);
      this.group.add(pole);
    }

    // scoreboard
    const s = this.map.scoreboard;
    if (s) {
      this.scoreTex = new T.ScoreboardTexture();
      this.group.add(new THREE.Mesh(new BoxBatch().add(bx(s.x, s.y, s.z - 0.25, s.width + 0.3, s.height + 0.3, 0.5)).build(), this.mats.metal));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(s.width, s.height), new THREE.MeshStandardMaterial({ map: this.scoreTex.texture, emissive: 0xffffff, emissiveMap: this.scoreTex.texture, emissiveIntensity: 0.9, roughness: 0.6 }));
      face.position.set(s.x, s.y, s.z - 0.51);
      face.rotation.y = Math.PI;
      this.group.add(face);
      this.addVirtualLight({ x: s.x, y: s.y - 0.5, z: s.z - 1.5 }, 0xff3a1e, 6, 9, 1.6);
      this.lastScore = { round: -1, kills: -1 };
    }

    // hoops
    const [c, g] = T.makeCanvas(256, 150);
    g.fillStyle = '#d8d6ca'; g.fillRect(0, 0, 256, 150);
    g.strokeStyle = '#7a2a20'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 138); g.strokeRect(88, 60, 80, 60);
    const boardMat = new THREE.MeshStandardMaterial({ map: T.toTexture(c, { repeat: false }), roughness: 0.4 });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#b04a1a', roughness: 0.5, metalness: 0.6 });
    const netMat = new THREE.LineBasicMaterial({ color: '#b8b4a4', transparent: true, opacity: 0.8 });
    for (const h of this.map.hoops || []) {
      const grp = new THREE.Group();
      grp.position.set(h.x + h.facing * 1.25, 0, h.z);
      grp.rotation.y = h.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.04), boardMat);
      board.position.set(0, 3.45, 0); grp.add(board);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.012, 6, 24).rotateX(Math.PI / 2), rimMat);
      rim.position.set(0, 3.05, 0.38); grp.add(rim);
      const pts = [];
      for (let i = 0; i < 12; i++) {
        const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
        const top = (a) => new THREE.Vector3(Math.cos(a) * 0.23, 3.05, 0.38 + Math.sin(a) * 0.23);
        const bot = (a) => new THREE.Vector3(Math.cos(a) * 0.14, 2.62 - (i % 4 === 0 ? 0.08 : 0), 0.38 + Math.sin(a) * 0.14);
        pts.push(top(a0), bot(a1), top(a1), bot(a0));
      }
      grp.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), netMat));
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.25), this.mats.metal);
      arm.position.set(0, 3.6, -0.62); grp.add(arm);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.6), this.mats.metal);
      brace.position.set(0, 4.3, -0.62); brace.rotation.x = 0.8; grp.add(brace);
      this.group.add(grp);
    }

    // a few loose basketballs and folding chairs
    const [bc, bg] = T.makeCanvas(128, 64);
    bg.fillStyle = '#7a4020'; bg.fillRect(0, 0, 128, 64);
    bg.strokeStyle = '#1a0e08'; bg.lineWidth = 2;
    for (const x of [0, 32, 64, 96]) { bg.beginPath(); bg.moveTo(x, 0); bg.lineTo(x, 64); bg.stroke(); }
    bg.beginPath(); bg.moveTo(0, 32); bg.lineTo(128, 32); bg.stroke();
    const ballMat = new THREE.MeshStandardMaterial({ map: T.toTexture(bc), roughness: 0.8 });
    for (const [x, z] of [[-6, 4.5], [7.5, -3], [-12.5, -6.8], [12.8, 7.2]]) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), ballMat);
      ball.position.set(x, 0.12, z); ball.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.group.add(ball);
    }
    for (let i = 0; i < 5; i++) {
      const chair = foldingChair(this.mats.metal);
      chair.position.set(-15.8 + (i % 2) * 0.6, i === 2 || i === 4 ? 0.2 : 0, 8.5 + i * 0.7);
      chair.rotation.set(i === 2 ? Math.PI / 2 : 0, Math.random() * 6, i === 4 ? Math.PI / 2 : 0);
      this.group.add(chair);
    }
  }

  // ---------------------------------------------------------------------------
  buildProps() {
    const M = this.mats;
    const batches = new Map();
    const add = (mat, box, opts) => { if (!batches.has(mat)) batches.set(mat, new BoxBatch()); batches.get(mat).add(box, opts); };
    const faceIdx = { e: 0, w: 1, s: 4, n: 5 };
    const others = (f) => new Set([0, 1, 2, 3, 4, 5].filter((i) => i !== f));
    for (const b of this.world.propBoxes) {
      const p = b.prop;
      switch (p.kind) {
        case 'lockers': {
          const f = faceIdx[p.face];
          add(Math.abs(b.minZ) % 7 < 3.5 ? M.lockers : M.lockers2, b, { skip: others(f) });
          add(M.metal, b, { skip: new Set([f, 3]) });
          break;
        }
        case 'cabinets': {
          const f = faceIdx[p.face];
          add(M.cabinets, b, { skip: others(f) });
          add(M.metal, b, { skip: new Set([f, 3]) });
          break;
        }
        case 'shelf': {
          const f = faceIdx[p.face];
          add(M.shelf, b, { skip: others(f) });
          add(M.darkWood, b, { skip: new Set([f, 3]) });
          break;
        }
        case 'counter':
          if (p.lunch) {
            add(M.steel, { ...b, minY: b.maxY - 0.05 });
            add(M.metal, { ...b, maxY: b.maxY - 0.05 }, { skip: new Set([3]) });
            this.sneezeGuard(b);
          } else {
            add(M.wood, { ...b, minY: b.maxY - 0.05, minX: b.minX - 0.03, maxX: b.maxX + 0.03, minZ: b.minZ - 0.03, maxZ: b.maxZ + 0.03 });
            add(M.darkWood, { ...b, maxY: b.maxY - 0.05 }, { skip: new Set([3]) });
          }
          break;
        case 'desk':
          add(M.wood, { ...b, minY: b.maxY - 0.04 });
          add(M.darkWood, { ...b, maxY: b.maxY - 0.04, minX: b.minX + 0.05, maxX: b.maxX - 0.05 }, { skip: new Set([3]) });
          if (p.pa) this.paSystem(b);
          break;
        case 'table': {
          add(M.tableTop, { ...b, minY: b.maxY - 0.04 });
          const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
          for (const s of [-1, 1]) {
            add(M.metal, bx(cx + s * 1.9, 0.36, cz, 0.06, 0.72, 0.7));
            add(M.tableTop, { minX: b.minX + 0.1, maxX: b.maxX - 0.1, minY: 0.42, maxY: 0.46, minZ: cz + s * 0.72 - 0.14, maxZ: cz + s * 0.72 + 0.14 });
          }
          break;
        }
        case 'stage':
          add(M.wood, { ...b, minY: b.maxY - 0.02 }, {});
          add(M.darkWood, { ...b, maxY: b.maxY - 0.02 }, { skip: new Set([3]) });
          break;
        case 'step':
          add(M.wood, b, { skip: new Set([3]) });
          break;
        case 'trash': {
          const can = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.9, 12, 1, true), M.rustMetal);
          can.position.set((b.minX + b.maxX) / 2, 0.45, (b.minZ + b.maxZ) / 2);
          this.group.add(can);
          break;
        }
        default: break;
      }
    }
    for (const [mat, batch] of batches) this.group.add(new THREE.Mesh(batch.build(), mat));
  }

  sneezeGuard(b) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX, 0.45), this.mats.glass);
    g.position.set((b.minX + b.maxX) / 2, b.maxY + 0.35, b.maxZ - 0.05);
    this.group.add(g);
    for (let x = b.minX + 0.2; x < b.maxX; x += 1.5) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), this.mats.steel);
      post.position.set(x, b.maxY + 0.3, b.maxZ - 0.05);
      this.group.add(post);
    }
    // trays
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 0.33), this.mats.tableTop);
      t.position.set(b.minX + 0.5 + i * 1.3 + Math.random() * 0.3, b.maxY + 0.01, (b.minZ + b.maxZ) / 2);
      t.rotation.y = (Math.random() - 0.5) * 0.4;
      this.group.add(t);
    }
  }

  // Erik's microphone and amplifier on the principal's desk.
  paSystem(b) {
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, y = b.maxY;
    const amp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 0.3), this.mats.metal);
    amp.position.set(cx + 0.4, y + 0.075, cz);
    this.group.add(amp);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.06, 0.28, 8), this.mats.metal);
    stand.position.set(cx - 0.2, y + 0.14, cz); this.group.add(stand);
    const mic = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), this.mats.steel);
    mic.position.set(cx - 0.2, y + 0.3, cz); this.group.add(mic);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.1) }));
    led.position.set(cx + 0.3, y + 0.1, cz + 0.155); this.group.add(led);
    this.paLed = led;
  }

  // ---------------------------------------------------------------------------
  buildWindows() {
    const wc = this.cfg.windows;
    const T0 = this.T;
    for (const w of this.sim.windows) {
      const n = w.normal;
      const grp = new THREE.Group();
      grp.position.set(w.center.x, 0, w.center.z);
      grp.rotation.y = Math.atan2(n.x, n.z);
      this.group.add(grp);
      const fr = new BoxBatch();
      const hw = wc.width / 2;
      fr.add(bx(-hw - 0.05, (wc.sillHeight + wc.topHeight) / 2, -T0 / 2, 0.1, wc.topHeight - wc.sillHeight, T0 + 0.04));
      fr.add(bx(hw + 0.05, (wc.sillHeight + wc.topHeight) / 2, -T0 / 2, 0.1, wc.topHeight - wc.sillHeight, T0 + 0.04));
      fr.add(bx(0, wc.sillHeight - 0.03, -T0 / 2, wc.width + 0.2, 0.08, T0 + 0.12));
      fr.add(bx(0, wc.topHeight + 0.03, -T0 / 2, wc.width + 0.2, 0.08, T0 + 0.04));
      fr.add(bx(0, (wc.sillHeight + wc.topHeight) / 2 + 0.4, -T0 * 0.8, 0.05, 0.9, 0.05));
      grp.add(new THREE.Mesh(fr.build(), this.mats.windowFrame));
      const sp = [];
      const s = wc.sillHeight, t = wc.topHeight, zz = -T0 * 0.8;
      const tri = (a, b, c) => sp.push(a[0], a[1], zz, b[0], b[1], zz, c[0], c[1], zz);
      tri([-hw, t], [-hw + 0.5, t], [-hw, t - 0.6]);
      tri([hw, t], [hw - 0.3, t], [hw, t - 0.9]);
      tri([-hw, s], [-hw + 0.35, s], [-hw, s + 0.5]);
      tri([hw, s], [hw - 0.6, s], [hw, s + 0.25]);
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      sg.computeVertexNormals();
      grp.add(new THREE.Mesh(sg, this.mats.glass));

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
      this.windowViews.set(w.id, { win: w, grp, planks, order });
      // moonlight through each window (streamed into the spot pool)
      this.vspots.push({
        pos: new THREE.Vector3(w.center.x - n.x * 5, 5.2, w.center.z - n.z * 5),
        target: new THREE.Vector3(w.center.x + n.x * 4, 0, w.center.z + n.z * 4),
      });
    }
  }

  // ---------------------------------------------------------------------------
  buildDoors() {
    const chainMat = new THREE.MeshStandardMaterial({ color: '#5a5650', metalness: 0.8, roughness: 0.5 });
    const linkGeo = new THREE.TorusGeometry(0.04, 0.01, 4, 8);
    for (const d of this.world.doors) {
      const grp = new THREE.Group();
      // local frame: origin at the wall's inner face centre of the opening, +z into the owning room
      const n = d.normal;
      grp.position.set(d.center.x + n.x * this.T / 2, 0, d.center.z + n.z * this.T / 2);
      grp.rotation.y = Math.atan2(n.x, n.z);
      this.group.add(grp);
      const view = { door: d, grp, leaves: [], chains: [], debris: [], t: -1, swing: -1 };
      // swing the leaves into whichever side has more room
      const own = this.world.roomById.get(d.room);
      const far = this.roomAtPoint(d.center.x - n.x * (this.T + 0.3), d.center.z - n.z * (this.T + 0.3));
      const area = (r) => r ? (r.rect[2] - r.rect[0]) * (r.rect[3] - r.rect[1]) : 0;
      if (area(own) > area(far)) view.swing = 1;
      if (d.kind === 'debris') {
        this.buildDebris(view);
      } else {
        const tex = T.doorTexture(d.label || 'DOOR');
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.3 });
        const back = new THREE.MeshStandardMaterial({ map: T.doorTexture(''), roughness: 0.7, metalness: 0.3 });
        const half = d.width / 2;
        for (const s of [-1, 1]) {
          const hinge = new THREE.Group();
          hinge.position.set(s * half, 0, -this.T / 2);
          grp.add(hinge);
          const geo = new THREE.BoxGeometry(half - 0.02, d.height - 0.02, 0.05);
          // UVs: each leaf shows its half of the door texture on the front
          const uv = geo.attributes.uv;
          for (let i = 0; i < uv.count; i++) uv.setX(i, s < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
          const leaf = new THREE.Mesh(geo, [back, back, back, back, mat, back]);
          leaf.position.set(-s * half / 2, d.height / 2, 0);
          hinge.add(leaf);
          view.leaves.push({ hinge, s });
        }
        // frame + exit sign
        const fr = new BoxBatch();
        fr.add(bx(-half - 0.06, d.height / 2, 0.03, 0.12, d.height, 0.1));
        fr.add(bx(half + 0.06, d.height / 2, 0.03, 0.12, d.height, 0.1));
        fr.add(bx(0, d.height + 0.06, 0.03, d.width + 0.24, 0.12, 0.1));
        grp.add(new THREE.Mesh(fr.build(), this.mats.metal));
        const signTex = T.signTexture('EXIT');
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.26, 0.08),
          [this.mats.metal, this.mats.metal, this.mats.metal, this.mats.metal,
            new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.6 }), this.mats.metal]);
        sign.position.set(0, d.height + 0.35, 0.06);
        if (d.height + 0.5 < this.world.roomById.get(d.room).height) grp.add(sign);
        // chains in an X and a padlock
        for (const s of [-1, 1]) {
          for (let i = 0; i < 22; i++) {
            const t = i / 21;
            const l = new THREE.Mesh(linkGeo, chainMat);
            l.position.set(-half * 0.9 + t * d.width * 0.9, 0.4 + (s > 0 ? t : 1 - t) * 2.2 - Math.sin(t * Math.PI) * 0.15, 0.08);
            l.rotation.set(i % 2 ? Math.PI / 2 : 0, 0, Math.atan2(2.2 * s, d.width * 0.9));
            grp.add(l);
            view.chains.push({ m: l, home: l.position.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.5, 1 + Math.random()) });
          }
        }
        const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.05), new THREE.MeshStandardMaterial({ color: '#8a7a40', metalness: 0.8, roughness: 0.4 }));
        lock.position.set(0, 1.45, 0.11);
        grp.add(lock);
        view.chains.push({ m: lock, home: lock.position.clone(), v: new THREE.Vector3(0, 0.5, 1.2) });
      }
      this.doorViews.set(d.id, view);
    }
  }

  buildDebris(view) {
    const d = view.door;
    const pieces = [];
    const M = this.mats;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const add = (geo, mat, x, y, z, rx, ry, rz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z - this.T / 2); m.rotation.set(rx, ry, rz);
      view.grp.add(m);
      pieces.push({ m, home: m.position.clone(), v: new THREE.Vector3(rnd(-0.6, 0.6), rnd(1.2, 2.4), rnd(-0.6, 0.6)), spin: new THREE.Vector3(rnd(-2, 2), rnd(-2, 2), rnd(-2, 2)) });
    };
    const w = d.width;
    // overturned desks, chairs, filing cabinet, ceiling tiles, planks: a pile filling the doorway
    for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(1.1, 0.05, 0.6), M.wood, rnd(-w / 2, w / 2), rnd(0.2, 2.2), rnd(-0.8, 0.8), rnd(-1, 1), rnd(0, 3), rnd(-1.2, 1.2));
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.06, 0.7, 0.06), M.metal, rnd(-w / 2, w / 2), rnd(0.3, 2), rnd(-0.7, 0.7), rnd(-1.5, 1.5), 0, rnd(-1.5, 1.5));
    add(new THREE.BoxGeometry(0.5, 1.3, 0.6), M.cabinets, rnd(-0.6, 0.6), 0.55, rnd(-0.3, 0.3), 0, rnd(0, 1), 1.2);
    for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(1.2, 0.02, 0.6), M.drop, rnd(-w / 2, w / 2), rnd(0.05, 2.6), rnd(-1, 1), rnd(-1.4, 1.4), rnd(0, 3), rnd(-1.4, 1.4));
    for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(2.2, 0.12, 0.04), this.plankMats[i % 4], rnd(-0.3, 0.3), rnd(0.4, 2.6), rnd(-0.4, 0.4), 0, rnd(-0.3, 0.3), rnd(-0.9, 0.9));
    for (let i = 0; i < 3; i++) {
      const chair = foldingChair(M.metal);
      chair.position.set(rnd(-w / 2, w / 2), rnd(0.2, 1.8), rnd(-0.7, 0.7) - this.T / 2);
      chair.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
      view.grp.add(chair);
      pieces.push({ m: chair, home: chair.position.clone(), v: new THREE.Vector3(rnd(-0.6, 0.6), rnd(1.2, 2.4), rnd(-0.6, 0.6)), spin: new THREE.Vector3(rnd(-2, 2), rnd(-2, 2), rnd(-2, 2)) });
    }
    view.debris = pieces;
  }

  // ---------------------------------------------------------------------------
  buildWallBuys() {
    for (const wb of this.world.wallBuys) {
      const def = this.cfg.weapons[wb.weapon] || this.cfg.equipment[wb.weapon];
      const tex = T.chalkTexture(def, def.view ? def.view.model : 'frag');
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), mat);
      m.position.set(wb.pos.x + wb.normal.x * 0.012, wb.pos.y, wb.pos.z + wb.normal.z * 0.012);
      m.rotation.y = Math.atan2(wb.normal.x, wb.normal.z);
      this.group.add(m);
    }
  }

  // ---------------------------------------------------------------------------
  buildExterior() {
    const cb = campusBounds(this.map);
    const cx = (cb.minX + cb.maxX) / 2, cz = (cb.minZ + cb.maxZ) / 2;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), this.mats.ground);
    const uv = ground.geometry.attributes.uv, pos = ground.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i));
    ground.position.set(cx, -0.02, cz);
    this.group.add(ground);

    // chain-link fence around the whole campus
    const [c, g] = T.makeCanvas(128, 128);
    g.strokeStyle = 'rgba(150,150,140,0.9)'; g.lineWidth = 3;
    for (let i = -128; i < 256; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke();
      g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke();
    }
    const fenceMat = new THREE.MeshStandardMaterial({ map: T.toTexture(c), alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.6 });
    const m = 13;
    const fx0 = cb.minX - m, fx1 = cb.maxX + m, fz0 = cb.minZ - m, fz1 = cb.maxZ + m;
    const fenceRun = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const geo = new THREE.PlaneGeometry(len, 3.2);
      const u = geo.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * len / 0.6, u.getY(i) * 3.2 / 0.6);
      const f = new THREE.Mesh(geo, fenceMat);
      f.position.set((x0 + x1) / 2, 1.6, (z0 + z1) / 2);
      f.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
      this.group.add(f);
      for (let t = 0; t <= len; t += 3) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 6), this.mats.rustMetal);
        post.position.set(x0 + (x1 - x0) * t / len, 1.7, z0 + (z1 - z0) * t / len);
        this.group.add(post);
      }
    };
    fenceRun(fx0, fz0, fx1, fz0); fenceRun(fx0, fz1, fx1, fz1);
    fenceRun(fx0, fz0, fx0, fz1); fenceRun(fx1, fz0, fx1, fz1);

    // dead trees between the building and the fence
    const barkMat = new THREE.MeshStandardMaterial({ color: '#1e1a14', roughness: 1 });
    let placed = 0, tries = 0;
    while (placed < 16 && tries < 400) {
      tries++;
      const x = fx0 + 2 + Math.random() * (fx1 - fx0 - 4), z = fz0 + 2 + Math.random() * (fz1 - fz0 - 4);
      if (this.nearBuilding(x, z, 11)) continue;
      this.group.add(deadTree(x, z, barkMat));
      placed++;
    }
    // an old school bus rotting in the courtyard east of the hallway (the loading dock comes later)
    const bus = new THREE.Group();
    const busMat = new THREE.MeshStandardMaterial({ color: '#6e5a1c', roughness: 0.9 });
    const bb = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.6, 9), busMat); bb.position.y = 1.6; bus.add(bb);
    const win = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.7, 8), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.3 })); win.position.y = 2.2; bus.add(win);
    for (const [x, z] of [[-1.2, 3], [1.2, 3], [-1.2, -3], [1.2, -3]]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12).rotateZ(Math.PI / 2), this.mats.rustMetal);
      wh.position.set(x, 0.5, z); bus.add(wh);
    }
    bus.position.set(31, 0, -6); bus.rotation.set(0, 0.35, 0.05);
    this.group.add(bus);
  }

  nearBuilding(x, z, margin) {
    for (const r of this.map.rooms) {
      const [x0, z0, x1, z1] = r.rect;
      if (x > x0 - margin && x < x1 + margin && z > z0 - margin && z < z1 + margin) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  addVirtualLight(pos, color, intensity, distance, decay, fixture = null) {
    const v = { pos: new THREE.Vector3(pos.x, pos.y, pos.z), color: new THREE.Color(color), intensity, distance, decay, fixture, level: 1 };
    this.vlights.push(v);
    return v;
  }

  buildLights() {
    const g = this.cfg.graphics;
    this.hemi = new THREE.HemisphereLight(0x6f7580, 0x2a2016, g.ambientLight);
    this.group.add(this.hemi);

    const beamTex = T.beamTexture();
    const hangGeo = new THREE.PlaneGeometry(1.25, 0.24).rotateX(Math.PI / 2);
    const panelGeo = new THREE.PlaneGeometry(1.15, 0.55).rotateX(Math.PI / 2);
    for (const room of this.map.rooms) {
      for (const f of room.fixtures || []) {
        const grp = new THREE.Group();
        grp.position.set(f.x, f.y, f.z);
        const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.08, 0.07) });
        if (f.kind === 'hanging') {
          grp.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.38), this.mats.metal));
          const tube = new THREE.Mesh(hangGeo, tubeMat); tube.position.y = -0.065; grp.add(tube);
          for (const x of [-0.55, 0.55]) {
            const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.1, 4), this.mats.metal);
            rod.position.set(x, 0.6, 0); grp.add(rod);
          }
          if (!f.lit && Math.random() < 0.3) { grp.rotation.z = 0.25; grp.position.y -= 0.2; }
        } else {
          grp.add(new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.05, 0.65), this.mats.metal));
          const tube = new THREE.Mesh(panelGeo, tubeMat); tube.position.y = -0.03; grp.add(tube);
          // a few dead panels dangle from one corner
          if (!f.lit && Math.random() < 0.35) { grp.position.y -= 0.35; grp.rotation.set(0.5, 0, 0.3); }
        }
        this.group.add(grp);
        const fx = { data: f, grp, tubeMat, beam: null, level: f.lit ? 1 : 0, target: f.lit ? 1 : 0, timer: Math.random() * 3, burst: 0 };
        if (f.lit) {
          const tall = f.y > 6;
          fx.v = this.addVirtualLight({ x: f.x, y: f.y - 0.3, z: f.z }, 0xffe7c0, tall ? 120 : 26, tall ? 22 : 11, tall ? 1.8 : 1.7, fx);
          const h = tall ? 6.5 : f.y - 0.1;
          const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(tall ? 0.5 : 0.4, tall ? 2.6 : 1.3, h, 20, 1, true),
            new THREE.MeshBasicMaterial({ map: beamTex, color: 0xffe0b0, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
          );
          beam.position.set(f.x, f.y - 0.05 - h / 2, f.z);
          this.group.add(beam);
          fx.beam = beam;
        }
        this.fixtures.push(fx);
      }
    }

    for (const e of this.map.emergencyLights || []) {
      this.addVirtualLight(e, 0xff2010, 14, 11, 1.5);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.18), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.4, 0.2) }));
      bulb.position.set(e.x, e.y + 0.3, e.z);
      this.group.add(bulb);
    }

    // visible moonlight shafts
    for (const w of this.sim.windows) {
      const n = w.normal, len = 7;
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 1.4, len, 16, 1, true),
        new THREE.MeshBasicMaterial({ map: beamTex, color: 0x9ab0d0, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      const from = new THREE.Vector3(w.center.x - n.x * 0.2, 1.8, w.center.z - n.z * 0.2);
      const to = new THREE.Vector3(w.center.x + n.x * 4, 0, w.center.z + n.z * 4);
      const dir = to.clone().sub(from).normalize();
      shaft.position.copy(from).addScaledVector(dir, len / 2);
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      this.group.add(shaft);
    }

    // real light pools
    this.pool = [];
    for (let i = 0; i < g.maxPointLights; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      this.group.add(l);
      this.pool.push(l);
    }
    this.spotPool = [];
    for (let i = 0; i < g.maxSpotLights; i++) {
      const s = new THREE.SpotLight(0x8fa6c8, 0, 22, 0.45, 0.6, 1.25);
      this.group.add(s); this.group.add(s.target);
      this.spotPool.push(s);
    }
  }

  // Assign the most relevant virtual lights to the real pool.
  streamLights(eye) {
    const range = this.cfg.graphics.lightRange;
    const scored = [];
    for (const v of this.vlights) {
      const lvl = v.fixture ? v.fixture.level : v.level;
      if (lvl <= 0.001) continue;
      const d = v.pos.distanceTo(eye);
      if (d > range) continue;
      scored.push({ v, lvl, d, s: v.intensity * lvl / (1 + d * d * 0.05) });
    }
    scored.sort((a, b) => b.s - a.s);
    for (let i = 0; i < this.pool.length; i++) {
      const l = this.pool[i];
      const e = scored[i];
      if (!e) { l.intensity = 0; continue; }
      const fade = Math.min(1, (range - e.d) / 8);
      l.position.copy(e.v.pos);
      l.color.copy(e.v.color);
      l.distance = e.v.distance;
      l.decay = e.v.decay;
      l.intensity = e.v.intensity * e.lvl * fade;
    }
    const spots = this.vspots.map((s) => ({ s, d: s.target.distanceTo(eye) })).sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.spotPool.length; i++) {
      const sp = this.spotPool[i], e = spots[i];
      if (!e || e.d > range) { sp.intensity = 0; continue; }
      sp.position.copy(e.s.pos);
      sp.target.position.copy(e.s.target);
      sp.intensity = 90 * Math.min(1, (range - e.d) / 8);
    }
  }

  // ---------------------------------------------------------------------------
  onEvent(e) {
    if (e.type === 'boardTorn') {
      const v = this.windowViews.get(e.windowId);
      if (!v) return;
      v.planks[v.order[e.board]].anim = { kind: 'tear', t: 0, vx: (Math.random() - 0.5) * 2, vy: 2.5, vz: -3.5, spin: (Math.random() - 0.5) * 12 };
    } else if (e.type === 'boardRepaired') {
      const v = this.windowViews.get(e.windowId);
      if (!v) return;
      const plank = v.planks[v.order[e.board]];
      plank.mesh.visible = true;
      plank.anim = { kind: 'repair', t: 0 };
    } else if (e.type === 'doorOpened') {
      const v = this.doorViews.get(e.id);
      if (v) v.t = 0;
    }
  }

  update(dt, eye, roundInfo) {
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
      f.tubeMat.color.setRGB(2.6 * f.level + 0.06, 2.45 * f.level + 0.06, 2.1 * f.level + 0.05);
      if (f.beam) f.beam.material.opacity = 0.045 * f.level;
    }
    if (eye) this.streamLights(eye);
    if (this.paLed) this.paLed.visible = Math.sin(this.time * 3) > -0.2;

    if (this.scoreTex && roundInfo && (roundInfo.round !== this.lastScore.round || roundInfo.kills !== this.lastScore.kills)) {
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
          a.vy -= 9.8 * dt;
          p.mesh.position.x += a.vx * dt; p.mesh.position.y += a.vy * dt; p.mesh.position.z += a.vz * dt;
          p.mesh.rotation.x += a.spin * dt;
          if (p.mesh.position.y < 0.05) { p.mesh.position.y = 0.05; a.vy *= -0.3; a.vx *= 0.5; a.vz *= 0.5; a.spin *= 0.5; }
          if (a.t > 1.6) { p.mesh.visible = false; p.anim = null; }
        } else {
          const t = Math.min(1, a.t / 0.22);
          const e = 1 - Math.pow(1 - t, 3);
          p.mesh.position.set(p.home.x, p.home.y * e + 0.1 * (1 - e), p.home.z + 0.9 * (1 - e));
          p.mesh.rotation.set((1 - e) * 1.2, 0, p.home.rz);
          if (t >= 1) { p.anim = null; p.mesh.rotation.set(0, 0, p.home.rz); }
        }
      }
      for (let k = 0; k < v.planks.length; k++) {
        const p = v.planks[v.order[k]];
        const should = k < v.win.boards;
        if (!p.anim) {
          p.mesh.visible = should;
          if (should) { p.mesh.position.set(p.home.x, p.home.y, p.home.z); p.mesh.rotation.set(0, 0, p.home.rz); }
        }
      }
    }

    // doors swinging open, debris clearing
    const openTime = this.cfg.doors.openTime;
    for (const v of this.doorViews.values()) {
      const open = this.sim.doorOpen(v.door.id);
      if (!open) { if (v.t >= 0) this.resetDoor(v); continue; }
      if (v.t < 0) v.t = openTime + 5; // opened before this view existed
      v.t += dt;
      const k = Math.min(1, v.t / openTime);
      const e = 1 - Math.pow(1 - k, 3);
      for (const leaf of v.leaves) leaf.hinge.rotation.y = v.swing * leaf.s * e * 1.6;
      for (const c of v.chains) {
        if (v.t > 2.5) { c.m.visible = false; continue; }
        c.v.y -= 9.8 * dt;
        c.m.position.addScaledVector(c.v, dt);
        if (c.m.position.y < 0.03) { c.m.position.y = 0.03; c.v.set(0, 0, 0); }
      }
      for (const p of v.debris) {
        if (k >= 1) { p.m.visible = false; continue; }
        p.m.position.addScaledVector(p.v, dt * 0.8);
        p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt;
        p.m.scale.setScalar(Math.max(0.01, 1 - e));
      }
    }
  }

  resetDoor(v) {
    v.t = -1;
    for (const leaf of v.leaves) leaf.hinge.rotation.y = 0;
    for (const p of v.debris) { p.m.visible = true; p.m.position.copy(p.home); p.m.scale.setScalar(1); }
    for (const c of v.chains) { c.m.visible = true; c.m.position.copy(c.home); c.v.set((Math.random() - 0.5) * 1.5, Math.random() * 1.5, 1 + Math.random()); }
  }
}

// ---------------------------------------------------------------------------
function foldingChair(mat) {
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.42), mat); seat.position.y = 0.45; chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.03), mat); back.position.set(0, 0.75, -0.2); chair.add(back);
  for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.45, 0.025), mat); leg.position.set(lx, 0.225, lz); chair.add(leg);
  }
  return chair;
}

function deadTree(x, z, mat) {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  const h = 5 + Math.random() * 4;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, h, 6), mat);
  trunk.position.y = h / 2; grp.add(trunk);
  for (let i = 0; i < 6; i++) {
    const len = 1.2 + Math.random() * 2;
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.08, len, 4), mat);
    const y = h * (0.45 + Math.random() * 0.5), a = Math.random() * Math.PI * 2;
    br.position.set(Math.cos(a) * len * 0.35, y + len * 0.3, Math.sin(a) * len * 0.35);
    br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    grp.add(br);
  }
  grp.rotation.z = (Math.random() - 0.5) * 0.15;
  return grp;
}

// Scattered papers, dirt and dark stains for a room floor.
function litterTexture(w, d, seed) {
  T.seedTextures(seed);
  const pxm = 48;
  const W = Math.min(2048, Math.round(w * pxm)), H = Math.min(2048, Math.round(d * pxm));
  const [c, g] = T.makeCanvas(W, H);
  const r = Math.random;
  for (let i = 0; i < 18; i++) {
    const x = r() * W, y = r() * H, rad = 20 + r() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const blood = r() < 0.25;
    grd.addColorStop(0, blood ? 'rgba(50,6,4,0.45)' : 'rgba(20,14,6,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, rad, rad * (0.4 + r() * 0.6), r() * 3, 0, 7); g.fill();
  }
  for (let i = 0; i < w * d * 0.35; i++) {
    g.save(); g.translate(r() * W, r() * H); g.rotate(r() * 6.28);
    g.fillStyle = `rgba(${170 + r() * 40},${165 + r() * 35},${140 + r() * 30},0.85)`;
    g.fillRect(-10, -13, 20, 26);
    g.fillStyle = 'rgba(60,60,80,0.3)';
    for (let k = -9; k < 12; k += 4) g.fillRect(-7, k, 14, 1);
    g.restore();
  }
  const edge = g.createLinearGradient(0, 0, 0, H);
  edge.addColorStop(0, 'rgba(10,8,5,0.55)'); edge.addColorStop(0.1, 'rgba(10,8,5,0)'); edge.addColorStop(0.9, 'rgba(10,8,5,0)'); edge.addColorStop(1, 'rgba(10,8,5,0.55)');
  g.fillStyle = edge; g.fillRect(0, 0, W, H);
  return T.toTexture(c, { repeat: false });
}
