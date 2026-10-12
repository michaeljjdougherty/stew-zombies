// =============================================================================
// Call of the Crust: the frozen battlefield. Draws everything for this map
// itself (mapView skips its rooms and walls): the mud and snow, the trench
// berms with their plank revetments, sandbags, duckboards and barbed wire, the
// craters, the command bunker, the farmhouse and barn, the church and its
// bell tower, the workshop, the excavation pit with the old stones at the
// bottom, the wrecks in No Man's Land, the overcast alien sky with two moons
// and green streaks, lightning, falling snow, and far to the north the four
// smoke stacks (always in view: see stacksGroup in update).
//
// Collision all comes from the map data (src/map/crust.js); this only looks.
// mapView calls crustMaterials() while building its materials and
// buildCrust() in place of the school's exterior; update() runs every frame.
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';
import { BoxBatch } from './geometry.js';
import * as CT from './crustTextures.js';
import { CONFIG } from '../config.js';

const R = CT.R;

// --- geometry helpers ------------------------------------------------------------------
// Everything static is merged into one mesh per material.
class Batch {
  constructor() { this.lists = new Map(); }
  add(mat, geo) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!this.lists.has(mat)) this.lists.set(mat, []);
    this.lists.get(mat).push(g);
  }
  build(group) {
    for (const [mat, geos] of this.lists) {
      const g = mergeGeometries(geos, false);
      if (!g) continue;
      g.computeBoundingSphere();
      group.add(new THREE.Mesh(g, mat));
    }
    this.lists.clear();
  }
}

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S3 = new THREE.Vector3();
// A geometry moved into place: { x, y, z, rx, ry, rz, s | sx, sy, sz }
function place(geo, o = {}) {
  E.set(o.rx || 0, o.ry || 0, o.rz || 0);
  Q.setFromEuler(E);
  const s = o.s ?? 1;
  M4.compose(V.set(o.x || 0, o.y || 0, o.z || 0), Q, S3.set(o.sx ?? s, o.sy ?? s, o.sz ?? s));
  return geo.applyMatrix4(M4);
}

// A box from min/max with world-space UVs (so textures tile at a steady scale).
function wbox(b, uvScale = 0.5, skip = null) {
  return new BoxBatch().add({ minX: b[0], minY: b[1], minZ: b[2], maxX: b[3], maxY: b[4], maxZ: b[5] }, { uvScale, skip }).build();
}

// A long shape made by sweeping a cross-section along a wall.
// profile: [[u, y], ...] going round the section (u: metres back from the face);
// map(t, u, y) -> [x, y, z] in the world. Flat-shaded; caps both ends.
function sweep(profile, t0, t1, map, uvScale = 0.5) {
  const pos = [], uv = [];
  const tri = (a, b, c, ua, ub, uc) => { pos.push(...a, ...b, ...c); uv.push(...ua, ...ub, ...uc); };
  // perimeter distance for v
  const dist = [0];
  for (let i = 1; i <= profile.length; i++) { const a = profile[i - 1], b = profile[i % profile.length]; dist.push(dist[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i], b = profile[(i + 1) % profile.length];
    const p00 = map(t0, a[0], a[1]), p01 = map(t0, b[0], b[1]), p10 = map(t1, a[0], a[1]), p11 = map(t1, b[0], b[1]);
    const u0 = t0 * uvScale, u1 = t1 * uvScale, v0 = dist[i] * uvScale, v1 = dist[i + 1] * uvScale;
    tri(p00, p10, p11, [u0, v0], [u1, v0], [u1, v1]);
    tri(p00, p11, p01, [u0, v0], [u1, v1], [u0, v1]);
  }
  // end caps (the section is convex: a fan)
  for (const [t, flip] of [[t0, true], [t1, false]]) {
    for (let i = 1; i < profile.length - 1; i++) {
      const a = map(t, ...profile[0]), b = map(t, ...profile[i]), c = map(t, ...profile[i + 1]);
      const ua = [profile[0][0] * uvScale, profile[0][1] * uvScale], ub = [profile[i][0] * uvScale, profile[i][1] * uvScale], uc = [profile[i + 1][0] * uvScale, profile[i + 1][1] * uvScale];
      if (flip) tri(a, c, b, ua, uc, ub); else tri(a, b, c, ua, ub, uc);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  // the winding depends on the mapping (mirrored for some walls): make sure the
  // normals point out, checking the top face (it must face up)
  const n = g.attributes.normal;
  let up = 0;
  for (let i = 0; i < n.count; i++) up += n.getY(i);
  if (up < 0) {
    const p = g.attributes.position.array, u = g.attributes.uv.array;
    for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const tmp = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = tmp; }
    for (let i = 0; i < u.length; i += 6) for (let k = 0; k < 2; k++) { const tmp = u[i + 2 + k]; u[i + 2 + k] = u[i + 4 + k]; u[i + 4 + k] = tmp; }
    g.computeVertexNormals();
  }
  return g;
}

// How a wall box lies: which way its trench face points, its length axis.
function wallFrame(r, face) {
  const [x0, z0, x1, z1] = r;
  if (face.z) {
    const fz = face.z > 0 ? z1 : z0, back = -face.z;
    return { t0: x0, t1: x1, thick: z1 - z0, map: (t, u, y) => [t, y, fz + back * u], alongX: true, fx: null, fz, face };
  }
  const fx = face.x > 0 ? x1 : x0, back = -face.x;
  return { t0: z0, t1: z1, thick: x1 - x0, map: (t, u, y) => [fx + back * u, y, t], alongX: false, fx, fz: null, face };
}

// --- materials ----------------------------------------------------------------------------
export function crustMaterials(M) {
  // (kept for mapView: the floor type name 'mud' points here)
  M.mud = new THREE.MeshStandardMaterial({ map: CT.mudTexture({ snow: 0.3 }), roughness: 0.95 });
}

function makeMats() {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.95, ...o });
  const rep = (t, x, y = x) => { t.repeat.set(x, y); return t; };
  const mudT = CT.mudTexture({ snow: 0.38 });
  const bermT = CT.mudTexture({ snow: 0.55, seed: 19 });
  const clayT = CT.mudTexture({ snow: 0.18, seed: 23 });
  return {
    ground: std({ map: rep(mudT, 1), bumpMap: mudT, bumpScale: 0.8 }),
    berm: std({ map: rep(bermT, 1), bumpMap: bermT, bumpScale: 1.0 }),
    clay: std({ map: clayT, bumpMap: clayT, bumpScale: 0.7, color: '#b49a88' }),
    revet: std({ map: CT.boardsTexture({ seed: 4 }) }),
    slats: std({ map: CT.boardsTexture({ seed: 8, base: [78, 62, 44], vertical: true }) }),
    slatsZ: std({ map: CT.boardsTexture({ seed: 8, base: [78, 62, 44] }) }),
    post: std({ color: '#3a2a1c' }),
    sandbag: std({ map: CT.sandbagTexture() }),
    farm: std({ map: CT.stoneTexture({ base: [104, 96, 86], burnt: 0.75, seed: 31 }) }),
    church: std({ map: CT.stoneTexture({ dressed: true, base: [100, 96, 90], burnt: 0.45, seed: 37 }), color: '#c8c0b4' }),
    shop: std({ map: CT.stoneTexture({ dressed: true, base: [86, 78, 72], burnt: 0.2, seed: 41 }), color: '#c8c0b4' }),
    barn: std({ map: CT.boardsTexture({ seed: 12, base: [96, 46, 34], vertical: true }) }),
    charred: std({ color: '#1a1512', roughness: 1 }),
    slate: std({ map: CT.rustTexture({ base: [52, 56, 62], seed: 51 }), roughness: 0.9 }),
    roofTiles: std({ map: CT.rustTexture({ base: [96, 52, 40], seed: 53 }) }),
    rust: std({ map: CT.rustTexture({ seed: 13 }), metalness: 0.3, roughness: 0.85 }),
    corrugated: std({ map: CT.rustTexture({ corrugated: true, seed: 17 }), metalness: 0.3 }),
    iron: std({ color: '#2a2a2c', metalness: 0.6, roughness: 0.55 }),
    basalt: std({ map: CT.runeTexture(17), emissive: new THREE.Color('#ffffff'), emissiveMap: CT.runeTexture(17), emissiveIntensity: 1.1 }),
    altarStone: std({ map: CT.runeTexture(29), emissive: new THREE.Color('#ffffff'), emissiveMap: CT.runeTexture(29), emissiveIntensity: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ map: CT.stainedGlassTexture(5), emissive: new THREE.Color('#ffffff'), emissiveMap: CT.stainedGlassTexture(5), emissiveIntensity: 0.35, transparent: true, roughness: 0.4, side: THREE.DoubleSide }),
    dark: new THREE.MeshBasicMaterial({ color: '#07080a' }),
    bronze: std({ color: '#6a5232', metalness: 0.7, roughness: 0.45 }),
    paper: std({ color: '#c8bc98' }),
    hay: std({ color: '#8a7440' }),
    radio: std({ map: CT.radioTexture(), emissive: new THREE.Color('#ffffff'), emissiveMap: CT.radioTexture(), emissiveIntensity: 0.25 }),
    lanternGlass: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 0.7) }),
    coals: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.1, 0.25) }),
    wire: new THREE.LineBasicMaterial({ color: '#1c1c1e' }),
    puddle: new THREE.MeshStandardMaterial({ map: CT.puddleTexture(), transparent: true, depthWrite: false, roughness: 0.15, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
}

// --- the world ------------------------------------------------------------------------------
export function buildCrust(mv) {
  const map = mv.map, group = mv.group;
  const fog = map.fog ? map.fog.color : '#2e343c';
  const W = { mv, map, lanterns: [], flames: [], forges: [], crystals: [], flash: 0, flashT: 4 + Math.random() * 6, smoke: [] };
  const M = makeMats();
  W.M = M;
  const B = new Batch();
  const r = R(9);

  buildSky(W, group, fog);
  buildLighting(W, group);
  buildGround(W, group, B, M, r);
  buildTrenches(W, B, M, r);
  buildBunker(W, B, M, r);
  buildBuildings(W, B, M, r);
  buildPit(W, B, M, r);
  buildWrecks(W, B, M, r);
  buildBeyond(W, group, B, M, r);
  B.build(group);
  buildStacks(W, group, fog);
  buildSnow(W, group, r);

  // the lanterns, forges and the pit's glow are real (streamed) lights
  for (const l of W.lanterns) l.v = mv.addVirtualLight(l.pos, l.color || 0xffb060, l.i || 5, l.d || 9, 1.6);
  W.update = (dt, eye, time) => updateCrust(W, dt, eye, time);
  W.setDetail = (f) => { W.snow.count = Math.max(200, Math.round(W.snow.N * f)); W.snow.geo.setDrawRange(0, W.snow.count); };
  return W;
}

// --- the sky: low overcast, two moons, green streaks, lightning --------------------------------
function buildSky(W, group, fog) {
  const sky = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(205, 64, 32), new THREE.MeshBasicMaterial({ map: CT.overcastSkyTexture(fog), side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -10;
  sky.add(dome);
  const moon = (dir, size, seed, tint, veil) => {
    const d = new THREE.Vector3(...dir).normalize().multiplyScalar(188);
    const m = new THREE.Mesh(new THREE.CircleGeometry(size, 48), new THREE.MeshBasicMaterial({ map: CT.moonTexture(seed, tint), transparent: true, fog: false, depthWrite: false, opacity: 0.92 }));
    m.position.copy(d); m.lookAt(0, 0, 0); m.renderOrder = -9;
    sky.add(m);
    // a halo through the cloud, and wisps drifting across its face
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(220,228,240,0.5)', 'rgba(200,210,230,0)'), fog: false, depthWrite: false, transparent: true, opacity: 0.55 }));
    halo.position.copy(d.clone().multiplyScalar(1.01)); halo.scale.setScalar(size * 4.2); halo.renderOrder = -9.5;
    sky.add(halo);
    for (let i = 0; i < veil; i++) {
      const w = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.smokeTexture(7 + i + seed), color: '#4a525e', fog: false, depthWrite: false, transparent: true, opacity: 0.55 }));
      w.position.copy(d.clone().multiplyScalar(0.97)).add(new THREE.Vector3((Math.random() - 0.5) * size * 2, (Math.random() - 0.5) * size, (Math.random() - 0.5) * size * 2));
      w.scale.set(size * 2.6, size * 1.1, 1); w.renderOrder = -8;
      sky.add(w);
      W.smoke.push({ s: w, home: w.position.clone(), sky: true, ph: Math.random() * 6 });
    }
    return m;
  };
  // the huge pale moon over the stacks to the north-east, a smaller one low in the west
  moon([0.35, 0.42, -0.85], 34, 3, [236, 238, 232], 3);
  moon([-0.9, 0.22, 0.2], 9, 11, [214, 226, 236], 1);
  group.add(sky);
  W.sky = sky; W.dome = dome;
}

function buildLighting(W, group) {
  // grey daylight through the overcast, from everywhere; a little cold moonlight
  // from the north-east (nothing here is baked: it's all lit live)
  const hemi = new THREE.HemisphereLight(0xa4b0c4, 0x3a3026, 1.45);
  const moon = new THREE.DirectionalLight(0xc8d6ee, 0.75);
  moon.position.set(0.35, 0.6, -0.85).multiplyScalar(60);
  group.add(hemi, moon, moon.target);
  W.hemi = hemi; W.moonLight = moon;
  W.hemiBase = hemi.intensity; W.moonBase = moon.intensity;
}

// --- the ground ----------------------------------------------------------------------------
// Flat mud and snow over the battlefield, rising into frozen hills outside the
// trench loop; shell craters with icy black water in them.
function buildGround(W, group, B, M, r) {
  const map = W.map;
  const size = 620, seg = 124;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  // out past the loop and the bunker, the land rolls away
  const ox0 = -66, ox1 = 66, oz0 = -58, oz1 = 74;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const dx = Math.max(ox0 - x, 0, x - ox1), dz = Math.max(oz0 - z, 0, z - oz1);
    const d = Math.hypot(dx, dz);
    let h = 0;
    if (d > 4) {
      const k = Math.min(1, (d - 4) / 40);
      h = k * ((Math.sin(x * 0.04) * Math.cos(z * 0.035) * 0.5 + 0.5) * 9 + Math.sin(x * 0.11 + z * 0.07) * 1.6 + 1.5);
      // the way north to the stacks stays lower
      if (z < -60 && Math.abs(x) < 60) h *= 0.35;
    }
    p.setY(i, h - 0.02);
    uv.setXY(i, x / 9, z / 9);
  }
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, M.ground);
  group.add(ground);
  W.ground = ground;

  // craters: a churned rim and a black, icy puddle in the bottom
  for (const c of map.craters || []) {
    const rim = new THREE.TorusGeometry(c.r * 0.92, Math.max(0.35, c.r * 0.16), 6, 28);
    B.add(M.berm, place(rim, { x: c.x, y: 0.02, z: c.z, rx: Math.PI / 2, sz: 0.55 }));
    const pud = new THREE.Mesh(new THREE.CircleGeometry(c.r * 0.8, 28).rotateX(-Math.PI / 2), M.puddle);
    pud.position.set(c.x, 0.03, c.z); pud.rotation.y = r() * 6;
    group.add(pud);
    // a few lumps of earth thrown out round it
    for (let k = 0; k < 5; k++) {
      const a = r() * 6.28, d = c.r * (1.15 + r() * 0.4);
      B.add(M.berm, place(new THREE.DodecahedronGeometry(0.2 + r() * 0.35, 0), { x: c.x + Math.cos(a) * d, y: 0.05, z: c.z + Math.sin(a) * d, sy: 0.5, ry: r() * 3 }));
    }
  }
  // the deep mud: wetter, darker patches (where it slows you)
  for (const m of map.mud || []) {
    const wet = new THREE.Mesh(new THREE.CircleGeometry(m.r, 32).rotateX(-Math.PI / 2), M.puddle);
    wet.position.set(m.x, 0.025, m.z); wet.scale.set(1.15, 1, 1.15);
    group.add(wet);
  }
  // duckboard paths across No Man's Land
  for (const d of map.duckboards || []) {
    const [x0, z0, x1, z1] = d;
    if (x1 - x0 > 14 && z1 - z0 > 14) continue;   // (the big areas are handled by their own floors)
    const alongX = x1 - x0 > z1 - z0;
    B.add(alongX ? M.slats : M.slatsZ, wbox([x0 + 0.2, 0, z0 + 0.2, x1 - 0.2, 0.06, z1 - 0.2], 0.6));
  }
}

// --- the trenches --------------------------------------------------------------------------
function buildTrenches(W, B, M, r) {
  const map = W.map, H = map.G.bermH;
  const wire = [];
  for (const b of map.props) {
    if (b.kind !== 'berm') continue;
    const [x0, , z0, x1, h, z1] = b.box;
    const rr = [x0, z0, x1, z1];
    const F = wallFrame(rr, b.face);
    const T0 = F.thick;
    if (b.stub || T0 < 0.9) {
      // the back wall of a dugout: a plain earth block with planks on its face
      B.add(M.berm, wbox([x0, 0, z0, x1, h, z1], 0.5));
    } else {
      // the cross-section: straight up at the trench, a sandbagged top, sloping off behind
      const prof = [[0, 0], [T0, 0], [T0, 0.2], [T0 * 0.6, h * 0.62], [0.75, h], [0, h]];
      B.add(M.berm, sweep(prof, F.t0, F.t1, F.map, 0.45));
      // barbed wire along the back slope
      const len = F.t1 - F.t0;
      const turns = Math.floor(len / 0.5);
      const pts = [];
      for (let k = 0; k <= turns * 8; k++) {
        const t = F.t0 + (k / (turns * 8)) * len, a = (k / 8) * Math.PI * 2;
        const [x, y, z] = F.map(t, T0 * 0.78 + Math.cos(a) * 0.32, h * 0.32 + 0.35 + Math.sin(a) * 0.32);
        pts.push(x, y, z);
      }
      for (let k = 0; k < pts.length / 3 - 1; k++) wire.push(pts[k * 3], pts[k * 3 + 1], pts[k * 3 + 2], pts[k * 3 + 3], pts[k * 3 + 4], pts[k * 3 + 5]);
      // pickets for the wire
      for (let t = F.t0 + 1.5; t < F.t1 - 0.5; t += 3) {
        const [x, , z] = F.map(t, T0 * 0.78, 0);
        B.add(M.post, place(new THREE.BoxGeometry(0.08, 1.4, 0.08), { x, y: 0.7 + h * 0.2, z, rz: 0.15, rx: 0.1 }));
      }
    }
    // the trench side: planks between posts, sandbags along the top
    const len = F.t1 - F.t0;
    if (len < 0.3) continue;
    const off = 0.03;
    const panel = new THREE.PlaneGeometry(len, h - 0.25);
    const mid = (F.t0 + F.t1) / 2;
    const [px, , pz] = F.map(mid, -off, 0);
    const ry = F.face.z ? (F.face.z > 0 ? 0 : Math.PI) : (F.face.x > 0 ? Math.PI / 2 : -Math.PI / 2);
    const pg = place(panel, { x: px, y: (h - 0.25) / 2, z: pz, ry });
    // stretch the planks' UVs to the panel's size
    const puv = pg.attributes.uv;
    for (let i = 0; i < puv.count; i++) puv.setXY(i, puv.getX(i) * len / 2.4, puv.getY(i) * (h - 0.25) / 2.4);
    B.add(M.revet, pg);
    for (let t = F.t0 + 0.12; t < F.t1; t += 2.2) {
      const [x, , z] = F.map(t, -0.06, 0);
      B.add(M.post, place(new THREE.BoxGeometry(0.16, h + 0.15, 0.16), { x, y: (h + 0.15) / 2, z }));
    }
    const [sx, , sz] = F.map(mid, 0.3, 0);
    const hx = F.alongX ? len / 2 : 0.31, hz = F.alongX ? 0.31 : len / 2;
    B.add(M.sandbag, wbox([sx - hx, h - 0.03, sz - hz, sx + hx, h + 0.39, sz + hz], 0.5));
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  W.mv.group.add(new THREE.LineSegments(wg, M.wire));

  // duckboards along every trench floor, the communication trench and the dugouts
  const floors = [...map.loop.regions.map((q) => q.rect), map.COMM.rect, ...map.DUGOUTS.map((d) => d.rect)];
  for (const f of floors) {
    const [x0, z0, x1, z1] = f;
    const alongX = x1 - x0 > z1 - z0;
    B.add(alongX ? M.slats : M.slatsZ, wbox([x0 + 0.25, 0, z0 + 0.25, x1 - 0.25, 0.05, z1 - 0.25], 0.6));
  }
  // dugout roofs: timber and corrugated iron, earth on top
  for (const d of map.DUGOUTS) {
    const [x0, z0, x1, z1] = d.rect;
    B.add(M.corrugated, wbox([x0 - 0.2, H - 0.3, z0 - 0.2, x1 + 0.2, H - 0.18, z1 + 0.2], 0.5));
    B.add(M.post, wbox([x0, 0, z0, x0 + 0.16, H - 0.3, z0 + 0.16])); B.add(M.post, wbox([x1 - 0.16, 0, z0, x1, H - 0.3, z0 + 0.16]));
    B.add(M.post, wbox([x0, 0, z1 - 0.16, x0 + 0.16, H - 0.3, z1])); B.add(M.post, wbox([x1 - 0.16, 0, z1 - 0.16, x1, H - 0.3, z1]));
    // a lantern hanging inside
    W.lanterns.push({ pos: { x: (x0 + x1) / 2, y: 2.0, z: (z0 + z1) / 2 }, i: 3.5, d: 6 });
  }
  // lanterns hung along the trenches
  for (const q of map.loop.regions) {
    const [x0, z0, x1, z1] = q.rect;
    const len = Math.max(x1 - x0, z1 - z0);
    if (len < 12) continue;
    const alongX = x1 - x0 > z1 - z0;
    for (let k = 0.5; k < len / 18; k++) {
      const t = (alongX ? x0 : z0) + (k * 18) % len;
      const pos = alongX ? { x: t, y: 2.05, z: z0 + 0.35 } : { x: x0 + 0.35, y: 2.05, z: t };
      W.lanterns.push({ pos, i: 4.5, d: 9 });
    }
  }
  for (const l of W.lanterns) lanternMesh(B, M, l.pos);
}

function lanternMesh(B, M, p) {
  B.add(M.iron, place(new THREE.BoxGeometry(0.2, 0.04, 0.2), { x: p.x, y: p.y + 0.16, z: p.z }));
  B.add(M.lanternGlass, place(new THREE.BoxGeometry(0.14, 0.24, 0.14), { x: p.x, y: p.y, z: p.z }));
  B.add(M.iron, place(new THREE.BoxGeometry(0.2, 0.03, 0.2), { x: p.x, y: p.y - 0.14, z: p.z }));
  B.add(M.iron, place(new THREE.BoxGeometry(0.02, 0.28, 0.02), { x: p.x, y: p.y + 0.32, z: p.z }));
}

// --- the command bunker ---------------------------------------------------------------------
function buildBunker(W, B, M, r) {
  const map = W.map;
  for (const b of map.props) {
    const [x0, y0, z0, x1, y1, z1] = b.box;
    switch (b.kind) {
      case 'sandbags': B.add(M.sandbag, wbox(b.box, 0.5)); break;
      case 'timber': B.add(M.revet, wbox(b.box, 0.42)); break;
      case 'bunkerRoof':
        B.add(M.corrugated, wbox([x0, y0, z0, x1, y0 + 0.14, z1], 0.5));
        // earth heaped over it, sandbags round the edge
        B.add(M.berm, sweep([[0, 0], [z1 - z0, 0], [z1 - z0 - 1.2, 0.55], [1.2, 0.55]], x0 + 0.4, x1 - 0.4, (t, u, y) => [t, y0 + 0.14 + y, z0 + u], 0.45));
        B.add(M.sandbag, wbox([x0, y0 + 0.14, z0, x1, y0 + 0.5, z0 + 0.5], 0.5));
        // beams under the roof
        for (let x = x0 + 0.6; x < x1; x += 1.6) B.add(M.post, wbox([x, y0 - 0.22, z0 + 0.4, x + 0.18, y0, z1], 0.5));
        break;
      case 'radio': {
        // the table, the field radio on it, its aerial wire up through the roof
        B.add(M.revet, wbox([x0, 0.72, z0, x1, 0.8, z1], 0.5));
        for (const [lx, lz] of [[x0 + 0.05, z0 + 0.05], [x1 - 0.1, z0 + 0.05], [x0 + 0.05, z1 - 0.1], [x1 - 0.1, z1 - 0.1]]) B.add(M.post, wbox([lx, 0, lz, lx + 0.06, 0.72, lz + 0.06]));
        const set = new THREE.BoxGeometry(0.9, 0.44, 0.4);
        B.add(M.radio, place(set, { x: (x0 + x1) / 2, y: 1.02, z: z1 - 0.3, ry: Math.PI }));
        B.add(M.iron, place(new THREE.CylinderGeometry(0.012, 0.012, 1.6, 4), { x: x1 - 0.2, y: 1.95, z: z1 - 0.2, rz: 0.2 }));
        W.lanterns.push({ pos: { x: (x0 + x1) / 2 - 0.8, y: 2.0, z: z1 - 0.6 }, i: 4, d: 7 });
        W.radioPos = { x: (x0 + x1) / 2, y: 1.02, z: z1 - 0.3 };
        break;
      }
      case 'mapTable':
        B.add(M.revet, wbox([x0, 0.78, z0, x1, 0.85, z1], 0.5));
        B.add(M.paper, place(new THREE.PlaneGeometry(x1 - x0 - 0.2, z1 - z0 - 0.3).rotateX(-Math.PI / 2), { x: (x0 + x1) / 2, y: 0.86, z: (z0 + z1) / 2, ry: 0.08 }));
        for (const [lx, lz] of [[x0, z0], [x1 - 0.06, z0], [x0, z1 - 0.06], [x1 - 0.06, z1 - 0.06]]) B.add(M.post, wbox([lx, 0, lz, lx + 0.06, 0.78, lz + 0.06]));
        break;
      default: break;
    }
  }
  // the yard: duckboards, ammunition crates, a fire barrel
  const [yx0, yz0, yx1, yz1] = map.BUNKER.yard;
  B.add(M.slatsZ, wbox([yx0 + 0.2, 0, yz0 + 0.2, yx1 - 0.2, 0.05, yz1 - 0.2], 0.6));
  for (const [x, z, s] of [[-8.2, 63, 0], [-8.2, 64.1, 1], [7.9, 66.8, 0]]) B.add(M.revet, place(new THREE.BoxGeometry(0.9, 0.5, 0.55), { x, y: 0.25 + s * 0.5, z, ry: s * 0.2 }));
  fireBarrel(W, B, M, -7.6, 55.4);
  W.lanterns.push({ pos: { x: 0, y: 2.3, z: 63.4 }, i: 5, d: 10 });
  lanternMesh(B, M, { x: 0, y: 2.3, z: 63.4 });
}

function fireBarrel(W, B, M, x, z, h = 0.95) {
  B.add(M.rust, place(new THREE.CylinderGeometry(0.33, 0.33, h, 14, 1, true), { x, y: h / 2, z }));
  B.add(M.coals, place(new THREE.CircleGeometry(0.31, 14).rotateX(-Math.PI / 2), { x, y: h - 0.1, z }));
  W.flames.push({ x, z, h, n: 5 });
  W.lanterns.push({ pos: { x, y: h + 0.5, z }, color: 0xff8a40, i: 7, d: 9 });
}

// --- the buildings --------------------------------------------------------------------------
function buildBuildings(W, B, M, r) {
  const map = W.map;
  for (const b of map.props) {
    if (!['stone', 'planks'].includes(b.kind)) continue;
    const mat = b.style === 'church' ? M.church : b.style === 'workshop' ? M.shop : b.style === 'barn' ? M.barn : M.farm;
    B.add(mat, wbox(b.box, b.style === 'barn' ? 0.42 : 0.4));
    // a burnt, broken top edge on the ruins
    if (b.style === 'farm') B.add(M.charred, wbox([b.box[0], b.box[4] - 0.08, b.box[2], b.box[3], b.box[4] + 0.05, b.box[5]], 0.5));
  }
  farmhouse(W, B, M, r);
  barn(W, B, M, r);
  church(W, B, M, r);
  workshop(W, B, M, r);
}

function farmhouse(W, B, M, r) {
  const { rect: [x0, z0, x1, z1], h } = W.map.FARM;
  // charred rafters still spanning the walls, some fallen
  for (let x = x0 + 1.5; x < x1 - 1; x += 2.2) {
    const fallen = r() < 0.4;
    B.add(M.charred, place(new THREE.BoxGeometry(0.22, 0.24, z1 - z0 + 0.6), { x, y: fallen ? 1.6 : h - 0.1, z: (z0 + z1) / 2, rx: fallen ? 0.35 : 0, rz: (r() - 0.5) * 0.1 }));
  }
  // what's left of the roof: tiles sliding in from the north wall
  B.add(M.roofTiles, place(new THREE.BoxGeometry(x1 - x0 - 6, 0.12, 6), { x: (x0 + x1) / 2 - 2, y: h - 1.2, z: z0 + 3, rx: -0.45 }));
  // a chimney stack on the west wall
  B.add(M.farm, wbox([x0 - 0.5, 0, z0 + 5, x0 + 0.7, 7.2, z0 + 6.4], 0.4));
  // the rubble pile and an overturned table
  for (let k = 0; k < 14; k++) B.add(M.farm, place(new THREE.DodecahedronGeometry(0.25 + r() * 0.35, 0), { x: -39.2 + (r() - 0.5) * 3, y: r() * 1.1, z: -3.5 + (r() - 0.5) * 2.8, ry: r() * 3 }));
  B.add(M.revet, place(new THREE.BoxGeometry(2.6, 0.08, 1.3), { x: -33.5, y: 0.8, z: 2.3, rz: 0.2 }));
  // dark empty windows
  for (const [x, z, ry] of [[x0 - 0.01, -3, -Math.PI / 2], [x0 - 0.01, 2.5, -Math.PI / 2], [-41, z1 + 0.01, 0], [-32, z1 + 0.01, 0]]) B.add(M.dark, place(new THREE.PlaneGeometry(1.1, 1.3), { x, y: 2.2, z, ry }));
  fireBarrel(W, B, M, -31.2, -6.6, 0.9);
}

function barn(W, B, M, r) {
  const { rect: [x0, z0, x1, z1], h } = W.map.BARN;
  const cz = (z0 + z1) / 2, half = (z1 - z0) / 2 + 0.4;
  // gable ends and a roof with a great hole torn in it
  const gable = new THREE.Shape([new THREE.Vector2(-half + 0.4, 0), new THREE.Vector2(half - 0.4, 0), new THREE.Vector2(0, 3)]);
  for (const x of [x0 + 0.17, x1 - 0.17]) B.add(M.barn, place(new THREE.ExtrudeGeometry(gable, { depth: 0.3, bevelEnabled: false }), { x: x - 0.15, y: h, z: cz, ry: Math.PI / 2 }));
  const slope = Math.atan2(3, half);
  const panelLen = Math.hypot(3, half);
  B.add(M.roofTiles, place(new THREE.BoxGeometry(x1 - x0 + 0.8, 0.1, panelLen), { x: (x0 + x1) / 2, y: h + 1.5, z: cz - half / 2, rx: slope }));
  B.add(M.roofTiles, place(new THREE.BoxGeometry((x1 - x0) * 0.45, 0.1, panelLen), { x: x0 + (x1 - x0) * 0.25, y: h + 1.5, z: cz + half / 2, rx: -slope }));
  for (let x = x0; x <= x1; x += 2) B.add(M.charred, place(new THREE.BoxGeometry(0.15, 0.15, panelLen * 2), { x, y: h + 1.45, z: cz, rx: 0 }));
  // hay against the west wall
  for (const [z, y] of [[19.4, 0.35], [20.6, 0.35], [19.9, 1.0]]) B.add(M.hay, place(new THREE.BoxGeometry(0.9, 0.7, 1.1), { x: x0 + 0.9, y, z: z + 6 }));
  W.lanterns.push({ pos: { x: (x0 + x1) / 2, y: 3.2, z: cz }, i: 4.5, d: 9 });
  lanternMesh(B, M, { x: (x0 + x1) / 2, y: 3.2, z: cz });
}

function church(W, B, M, r) {
  const C = W.map.CHURCH;
  const [x0, z0, x1, z1] = C.rect, h = C.h;
  const cz = (z0 + z1) / 2, half = (z1 - z0) / 2;
  // gable ends
  const gable = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, 4.2)]);
  for (const x of [x0, x1 - 0.8]) B.add(M.church, place(new THREE.ExtrudeGeometry(gable, { depth: 0.8, bevelEnabled: false }), { x, y: h, z: cz, ry: Math.PI / 2 }));
  // the roof: bare trusses, one stretch of slates left on the north side
  const slope = Math.atan2(4.2, half);
  for (let x = x0 + 1.5; x < x1 - 1; x += 2.4) {
    B.add(M.charred, place(new THREE.BoxGeometry(0.2, 0.22, Math.hypot(4.2, half) + 0.3), { x, y: h + 2.1, z: cz - half / 2, rx: slope }));
    if (r() < 0.6) B.add(M.charred, place(new THREE.BoxGeometry(0.2, 0.22, Math.hypot(4.2, half) + 0.3), { x, y: h + 2.1, z: cz + half / 2, rx: -slope }));
  }
  B.add(M.slate, place(new THREE.BoxGeometry(5.5, 0.12, Math.hypot(4.2, half)), { x: x1 - 4, y: h + 2.15, z: cz - half / 2, rx: slope }));
  // stained glass windows down both sides, inside and out, some blown out
  for (let x = x0 + 3; x < x1 - 1.5; x += 3.6) for (const [z, ry] of [[z0 - 0.02, Math.PI], [z0 + C.t + 0.02, 0], [z1 + 0.02, 0], [z1 - C.t - 0.02, Math.PI]]) {
    if (x > 35.5 && x < 39.5 && z > 0) continue;   // (the bomb hole)
    B.add(M.glass, place(new THREE.PlaneGeometry(1.3, 2.9), { x, y: 3.8, z, ry }));
  }
  // the bell tower with its open belfry, a spire, and the bell
  const [tx0, tz0, tx1, tz1] = C.tower, th = C.towerH;
  const tcx = (tx0 + tx1) / 2, tcz = (tz0 + tz1) / 2;
  B.add(M.church, wbox([tx0, 0, tz0, tx1, th, tz1], 0.4));
  for (const [x, z, ry] of [[tcx, tz0 - 0.02, Math.PI], [tcx, tz1 + 0.02, 0], [tx0 - 0.02, tcz, -Math.PI / 2], [tx1 + 0.02, tcz, Math.PI / 2]]) {
    B.add(M.dark, place(new THREE.PlaneGeometry(1.6, 3), { x, y: th - 2.6, z, ry }));
    B.add(M.dark, place(new THREE.PlaneGeometry(0.9, 1.6), { x, y: th - 9, z, ry }));
  }
  B.add(M.slate, place(new THREE.ConeGeometry(3.9, 7, 4), { x: tcx, y: th + 3.5, z: tcz, ry: Math.PI / 4 }));
  const bell = new THREE.LatheGeometry([[0.05, 0.9], [0.4, 0.85], [0.55, 0.5], [0.62, 0.1], [0.8, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 18);
  B.add(M.bronze, place(bell, { x: tcx, y: th - 3.6, z: tcz, sy: 1.1 }));
  B.add(M.iron, place(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6), { x: tcx, y: th + 7.8, z: tcz }));
  B.add(M.iron, place(new THREE.BoxGeometry(0.9, 0.06, 0.06), { x: tcx, y: th + 8.3, z: tcz }));
  // the altar and broken pews
  B.add(M.church, wbox([41.6, 0, -2.2, 43.2, 1.1, 0.2], 0.4));
  B.add(M.paper, place(new THREE.BoxGeometry(1.7, 0.02, 2.5), { x: 42.4, y: 1.11, z: -1 }));
  for (let x = x0 + 2.5; x < 40; x += 1.6) for (const z of [-4.6, 2.6]) {
    if (r() < 0.3) continue;
    B.add(M.revet, place(new THREE.BoxGeometry(0.45, 0.42, 3.2), { x, y: 0.21, z, ry: (r() - 0.5) * 0.4, rz: r() < 0.25 ? 0.4 : 0 }));
  }
  // candles still burning on the altar
  W.lanterns.push({ pos: { x: 42.4, y: 1.6, z: -1 }, color: 0xffc070, i: 3, d: 7 });
  for (const dz of [-1.8, -0.2]) { B.add(M.paper, place(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), { x: 42.6, y: 1.26, z: dz })); W.flames.push({ x: 42.6, z: dz, h: 1.42, n: 1, small: true }); }
}

function workshop(W, B, M, r) {
  const S = W.map.SHOP;
  const [x0, z0, x1, z1] = S.rect, h = S.h;
  const cx = (x0 + x1) / 2, half = (z1 - z0) / 2 + 0.5;
  // a slate roof, intact, and a chimney over each forge
  const slope = Math.atan2(2.6, half), len = Math.hypot(2.6, half);
  for (const s of [-1, 1]) B.add(M.slate, place(new THREE.BoxGeometry(x1 - x0 + 1, 0.14, len), { x: cx, y: h + 1.3, z: (z0 + z1) / 2 + s * half / 2, rx: -s * slope }));
  const gable = new THREE.Shape([new THREE.Vector2(-half + 0.5, 0), new THREE.Vector2(half - 0.5, 0), new THREE.Vector2(0, 2.6)]);
  for (const x of [x0, x1 - 0.6]) B.add(M.shop, place(new THREE.ExtrudeGeometry(gable, { depth: 0.6, bevelEnabled: false }), { x, y: h, z: (z0 + z1) / 2, ry: Math.PI / 2 }));
  for (const b of W.map.props) {
    const [bx0, , bz0, bx1, by1, bz1] = b.box;
    const mx = (bx0 + bx1) / 2, mz = (bz0 + bz1) / 2;
    if (b.kind === 'forge') {
      B.add(M.shop, wbox(b.box, 0.4));
      B.add(M.coals, place(new THREE.PlaneGeometry(bx1 - bx0 - 0.6, 0.5).rotateX(-Math.PI / 2), { x: mx, y: by1 + 0.01, z: mz }));
      // the hood and chimney
      B.add(M.iron, place(new THREE.CylinderGeometry(0.3, 1.2, 1.2, 4, 1, true), { x: mx, y: by1 + 1.7, z: mz, ry: Math.PI / 4 }));
      B.add(M.shop, wbox([mx - 0.45, by1 + 2.3, mz - 0.45, mx + 0.45, h + 3.6, mz + 0.45], 0.4));
      W.forges.push({ x: mx, y: by1 + 0.3, z: mz });
      W.lanterns.push({ pos: { x: mx, y: by1 + 0.6, z: mz + 0.8 }, color: 0xff6a20, i: 9, d: 9 });
      W.smoke.push({ chimney: { x: mx, y: h + 3.7, z: mz } });
    } else if (b.kind === 'anvil') {
      B.add(M.post, place(new THREE.CylinderGeometry(0.3, 0.36, 0.5, 8), { x: mx, y: 0.25, z: mz }));
      B.add(M.iron, place(new THREE.BoxGeometry(0.75, 0.22, 0.3), { x: mx, y: 0.66, z: mz }));
      B.add(M.iron, place(new THREE.ConeGeometry(0.12, 0.4, 6).rotateZ(Math.PI / 2), { x: mx + 0.55, y: 0.7, z: mz }));
    } else if (b.kind === 'workbench') {
      B.add(M.revet, wbox([bx0, by1 - 0.08, bz0, bx1, by1, bz1], 0.5));
      for (const lx of [bx0 + 0.05, bx1 - 0.13]) B.add(M.post, wbox([lx, 0, bz0 + 0.05, lx + 0.08, by1 - 0.08, bz1 - 0.05]));
      // tools hanging on the wall behind
      for (let k = 0; k < 5; k++) B.add(M.iron, place(new THREE.BoxGeometry(0.08, 0.6, 0.03), { x: bx0 + 0.3 + k * 0.55, y: by1 + 0.9, z: bz0 + 0.03, rz: (r() - 0.5) * 0.3 }));
    }
  }
  // inside, a lamp from the beams
  W.lanterns.push({ pos: { x: cx, y: 3.8, z: (z0 + z1) / 2 + 1 }, i: 5, d: 10 });
  lanternMesh(B, M, { x: cx, y: 3.8, z: (z0 + z1) / 2 + 1 });
}

// --- the excavation pit ----------------------------------------------------------------------
function buildPit(W, B, M, r) {
  const map = W.map, H = map.G.rimH;
  const [ix0, iz0, ix1, iz1] = map.PIT.inner;
  for (const b of map.props) {
    if (b.kind !== 'rim') continue;
    const [x0, , z0, x1, , z1] = b.box;
    // facing the pit: which side of this strip is open to it
    const face = b.rim === 'rim_n' ? { x: 0, z: 1 } : b.rim === 'rim_s' ? { x: 0, z: -1 } : b.rim.startsWith('rim_w') ? { x: 1, z: 0 } : { x: -1, z: 0 };
    const F = wallFrame([x0, z0, x1, z1], face);
    // a flat walkable top, shored up on the pit side, bevelled off outside
    const t = F.thick;
    B.add(M.berm, sweep([[0, 0], [t, 0], [t, H - 0.5], [t - 0.45, H], [0, H]], F.t0, F.t1, F.map, 0.45));
    // shoring on the pit side (only along the open stretch)
    const lo = Math.max(F.t0, F.alongX ? ix0 : iz0), hi = Math.min(F.t1, F.alongX ? ix1 : iz1);
    if (hi - lo > 0.5) {
      for (let tt = lo + 0.2; tt < hi; tt += 2.4) {
        const [x, , z] = F.map(tt, -0.1, 0);
        B.add(M.post, place(new THREE.BoxGeometry(0.2, H + 0.4, 0.2), { x, y: (H + 0.4) / 2, z }));
      }
      for (const y of [1.2, 2.6]) {
        const [x, , z] = F.map((lo + hi) / 2, -0.12, 0);
        B.add(M.post, place(F.alongX ? new THREE.BoxGeometry(hi - lo, 0.14, 0.14) : new THREE.BoxGeometry(0.14, 0.14, hi - lo), { x, y, z }));
      }
      const [px, , pz] = F.map((lo + hi) / 2, -0.03, 0);
      const ry = face.z ? (face.z > 0 ? 0 : Math.PI) : (face.x > 0 ? Math.PI / 2 : -Math.PI / 2);
      const pg = place(new THREE.PlaneGeometry(hi - lo, H - 0.3), { x: px, y: (H - 0.3) / 2, z: pz, ry });
      const puv = pg.attributes.uv;
      for (let i = 0; i < puv.count; i++) puv.setXY(i, puv.getX(i) * (hi - lo) / 2.4, puv.getY(i) * (H - 0.3) / 2.4);
      B.add(M.revet, pg);
    }
  }
  // the stairs: timber treads (inside the pit) and cut earth steps with plank risers (outside)
  for (const s of map.stairsList) {
    for (const b of s.boxes) B.add(s.region.id === 'stairs_pit' ? M.revet : M.berm, wbox(b.box, 0.5));
    // handrail posts along one side
    const [x0, z0, x1, z1] = s.region.rect;
    const alongZ = s.dir === 'n' || s.dir === 's';
    for (let k = 0; k <= s.steps; k += 2) {
      const f = k / s.steps, h = (k / s.steps) * H;
      const t = s.dir === 'n' ? z1 - f * (z1 - z0) : s.dir === 's' ? z0 + f * (z1 - z0) : s.dir === 'e' ? x0 + f * (x1 - x0) : x1 - f * (x1 - x0);
      const p = alongZ ? { x: x1 - 0.06, z: t } : { x: t, z: z1 - 0.06 };
      B.add(M.post, place(new THREE.BoxGeometry(0.1, 1.1, 0.1), { x: p.x, y: h + 0.55, z: p.z }));
    }
  }
  // the cuts in from the east and west: timber frames, duckboards through
  for (const xs of [[-18, -12], [12, 18]]) {
    const w = map.PIT.cutW / 2;
    for (const x of xs) for (const z of [-w, w]) B.add(M.post, place(new THREE.BoxGeometry(0.3, 3.6, 0.3), { x, y: 1.8, z: z + (z < 0 ? 0.15 : -0.15) }));
    for (const x of xs) B.add(M.post, place(new THREE.BoxGeometry(0.3, 0.3, w * 2 + 0.3), { x, y: 3.55, z: 0 }));
    B.add(M.slatsZ, wbox([xs[0], 0, -w + 0.2, xs[1], 0.05, w - 0.2], 0.6));
  }
  // the pit floor: pale clay dug down to, duckboards, work lights on the rim
  B.add(M.clay, wbox([ix0, -0.05, iz0, ix1, 0.015, iz1], 0.12, new Set([0, 1, 3, 4, 5])));
  for (const [x, z] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) {
    B.add(M.post, place(new THREE.BoxGeometry(0.14, 3, 0.14), { x, y: H + 1.5, z }));
    B.add(M.iron, place(new THREE.BoxGeometry(0.4, 0.3, 0.3), { x: x * 0.97, y: H + 3, z: z * 0.97 }));
    W.lanterns.push({ pos: { x: x * 0.9, y: H + 2.8, z: z * 0.9 }, color: 0xfff0d0, i: 8, d: 16 });
  }
  // the old stones: four standing stones round an altar, runes glowing green;
  // a crystal turns slowly over the altar and a ring of glyphs lights the floor
  for (const b of map.props) {
    const [x0, , z0, x1, y1, z1] = b.box;
    if (b.kind === 'standingStone') {
      const g = new THREE.BoxGeometry(x1 - x0, y1, z1 - z0, 1, 4, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 1 - (p.getY(i) + y1 / 2) / y1 * 0.25; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
      B.add(M.basalt, place(g, { x: (x0 + x1) / 2, y: y1 / 2, z: (z0 + z1) / 2, ry: b.i * 0.4 }));
    } else if (b.kind === 'altarStone') {
      B.add(M.altarStone, wbox(b.box, 0.4));
    }
  }
  const ringT = (() => {
    const S = 512, [c, g] = T.makeCanvas(S, S);
    g.strokeStyle = 'rgba(110,255,200,0.9)'; g.lineWidth = 6; g.shadowColor = '#6dffc8'; g.shadowBlur = 18;
    g.beginPath(); g.arc(S / 2, S / 2, S * 0.44, 0, 7); g.stroke();
    g.beginPath(); g.arc(S / 2, S / 2, S * 0.36, 0, 7); g.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, x = S / 2 + Math.cos(a) * S * 0.4, y = S / 2 + Math.sin(a) * S * 0.4;
      g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(-8, -10); g.lineTo(0, 10); g.lineTo(8, -10); g.moveTo(-8, 0); g.lineTo(8, 0); g.stroke(); g.restore();
    }
    return T.toTexture(c, { repeat: false });
  })();
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.7, 1.2, 1) }));
  ring.position.set(0, 0.04, 0);
  W.mv.group.add(ring);
  W.glyphRing = ring;
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 1.6) }));
  crystal.position.set(0, 2.2, 0); crystal.scale.set(0.8, 1.4, 0.8);
  W.mv.group.add(crystal);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(120,255,190,0.9)', 'rgba(60,255,160,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
  halo.position.copy(crystal.position); halo.scale.setScalar(3.2);
  W.mv.group.add(halo);
  W.crystals.push({ m: crystal, halo });
  W.lanterns.push({ pos: { x: 0, y: 2.2, z: 0 }, color: 0x60ffb0, i: 10, d: 13 });
}

// --- wrecks in No Man's Land -------------------------------------------------------------------
function buildWrecks(W, B, M, r) {
  for (const w of W.map.WRECKS) {
    const [x0, z0, x1, z1] = w.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (w.kind === 'tank') {
      // a rhomboid landship, burnt out and nosed into the mud
      const L = x1 - x0, Wd = z1 - z0;
      const sh = new THREE.Shape([[-L / 2, 0.3], [-L / 2 + 0.9, 0], [L / 2 - 0.9, 0], [L / 2, 1.2], [L / 2 - 0.4, 2.5], [-L / 2 + 1.4, 2.5]].map(([x, y]) => new THREE.Vector2(x, y)));
      for (const s of [-1, 1]) B.add(M.rust, place(new THREE.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false }), { x: cx, y: -0.15, z: cz + s * (Wd / 2 - 0.4) - 0.4, ry: 0, rz: 0.04 }));
      B.add(M.rust, place(new THREE.BoxGeometry(L - 2.2, 1.8, Wd - 1.4), { x: cx, y: 1.1, z: cz }));
      B.add(M.rust, place(new THREE.BoxGeometry(1.4, 1, 1.2), { x: cx, y: 2.3, z: cz }));
      B.add(M.iron, place(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 8).rotateZ(Math.PI / 2), { x: cx - 1.2, y: 2.3, z: cz }));
    } else if (w.kind === 'fieldGun') {
      for (const s of [-1, 1]) B.add(M.revet, place(new THREE.CylinderGeometry(0.75, 0.75, 0.14, 14).rotateX(Math.PI / 2), { x: cx, y: 0.7, z: cz + s * 0.9, ry: w.yaw }));
      B.add(M.iron, place(new THREE.CylinderGeometry(0.16, 0.2, 3, 10).rotateZ(Math.PI / 2 - 0.25), { x: cx + 0.6, y: 1.3, z: cz, ry: w.yaw }));
      B.add(M.iron, place(new THREE.BoxGeometry(0.1, 1.2, 1.8), { x: cx - 0.2, y: 1.1, z: cz, ry: w.yaw }));
      B.add(M.post, place(new THREE.BoxGeometry(2.4, 0.16, 0.2), { x: cx - 1.4, y: 0.35, z: cz, ry: w.yaw, rz: 0.2 }));
    } else if (w.kind === 'ruinWall') {
      for (let x = x0; x < x1 - 0.2; x += 1) B.add(M.farm, wbox([x, 0, z0, Math.min(x1, x + 1), 1 + r() * 1.4 + (x === x0 ? 0.5 : 0), z1], 0.4));
    }
  }
}

// --- out past the trenches: dead trees, broken fences, far hills --------------------------------
function buildBeyond(W, group, B, M, r) {
  const trunk = new THREE.CylinderGeometry(0.12, 0.3, 1, 6);
  const count = 160, im = new THREE.InstancedMesh(trunk, M.charred, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < 600 && n < count; i++) {
    const x = (r() - 0.5) * 380, z = (r() - 0.5) * 380 + 10;
    if (x > -72 && x < 72 && z > -64 && z < 80) continue;
    if (z < -150) continue;
    const hgt = 4 + r() * 7;
    q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25));
    m4.compose(ps.set(x, hgt / 2 - 0.5, z), q, sc.set(1, hgt, 1));
    im.setMatrixAt(n++, m4);
  }
  im.count = n;
  group.add(im);
  // far ridges round the horizon (not in front of the stacks)
  const mtn = new THREE.MeshStandardMaterial({ color: '#4a525e', roughness: 1, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const a = Math.PI / 2 + (i - 6.5) * 0.42 + (r() - 0.5) * 0.1, d = 190;
    const h = 18 + r() * 24, w = 40 + r() * 30;
    const geo = new THREE.ConeGeometry(w, h, 9, 3);
    const gp = geo.attributes.position;
    for (let k = 0; k < gp.count; k++) { const y = gp.getY(k); if (y > h / 2 - 0.01) continue; const j = 1 + (r() - 0.5) * 0.35; gp.setXYZ(k, gp.getX(k) * j, y + (y > -h / 2 + 0.01 ? (r() - 0.5) * h * 0.2 : 0), gp.getZ(k) * j); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mtn);
    m.position.set(Math.cos(a) * d, h / 2 - 3, Math.sin(a) * d);
    group.add(m);
  }
}

// --- the four smoke stacks, far to the north -------------------------------------------------
// Always in view: past stackDrawDistance the whole group is drawn scaled down
// toward the camera (same direction, same apparent size), and fog doesn't
// touch it, so the stacks stand on the horizon from almost anywhere.
function buildStacks(W, group, fog) {
  const map = W.map;
  const G = new THREE.Group();
  const fogC = new THREE.Color(fog);
  const haze = (c, k = 0.35) => new THREE.Color(c).lerp(fogC, k);
  const brickT = CT.stackBrickTexture(9);
  const brick = new THREE.MeshStandardMaterial({ map: brickT, color: haze('#ffffff', 0.25), emissive: new THREE.Color('#ffffff'), emissiveMap: brickT, emissiveIntensity: 0.55, roughness: 1, fog: false });
  const darkM = new THREE.MeshStandardMaterial({ color: haze('#1c1a1a', 0.3), roughness: 1, fog: false, emissive: new THREE.Color('#0e0c0c') });
  const fireT = T.softDotTexture('rgba(255,220,140,1)', 'rgba(255,90,20,0)');
  const smokeT = T.smokeTexture(3);
  const cx = map.stacks.reduce((a, s) => a + s.x, 0) / map.stacks.length, cz = map.stacks.reduce((a, s) => a + s.z, 0) / map.stacks.length;
  W.stackCenter = new THREE.Vector3(cx, 0, cz);
  for (const s of map.stacks) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 5.6, s.h, 28, 1, true), brick);
    st.position.set(s.x, s.h / 2, s.z); G.add(st);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 3.8, 1.6, 28, 1, true), darkM);
    lip.position.set(s.x, s.h - 0.4, s.z); G.add(lip);
    // fire roaring out of the top
    for (let k = 0; k < 6; k++) {
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireT, color: new THREE.Color(2.6, 1.3, 0.45), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      f.position.set(s.x, s.h + 1, s.z); G.add(f);
      W.flames.push({ sprite: f, base: new THREE.Vector3(s.x, s.h, s.z), k, big: true });
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireT, color: new THREE.Color(1.4, 0.5, 0.15), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.5 }));
    glow.position.set(s.x, s.h + 2, s.z); glow.scale.setScalar(26); G.add(glow);
    // black smoke pouring up and leaning away on the wind
    for (let k = 0; k < 9; k++) {
      const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeT, color: haze('#1a1818', 0.15), depthWrite: false, transparent: true, fog: false, opacity: 0.75 }));
      G.add(sm);
      W.smoke.push({ s: sm, stack: s, ph: k / 9 });
    }
  }
  // two rings of catwalks between the stacks (halfway up, near the top)
  const ring = [[map.stacks[0], map.stacks[1]], [map.stacks[1], map.stacks[3]], [map.stacks[3], map.stacks[2]], [map.stacks[2], map.stacks[0]]];
  for (const lvl of [0.5, 0.86]) for (const [a, b] of ring) {
    const len = Math.hypot(b.x - a.x, b.z - a.z), h = Math.min(a.h, b.h) * lvl;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 2), darkM);
    m.position.set((a.x + b.x) / 2, h, (a.z + b.z) / 2); m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    G.add(m);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.15, 0.15), darkM);
    rail.position.copy(m.position).add(new THREE.Vector3(0, 1.1, 0)); rail.rotation.copy(m.rotation); G.add(rail);
  }
  // the works at their feet: dark sheds, a red glow from the furnaces
  for (const [dx, dz, w, h, d] of [[0, 0, 30, 14, 30], [-34, 12, 18, 9, 22], [34, 8, 20, 11, 18]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), darkM);
    b.position.set(cx + dx, h / 2, cz + dz); G.add(b);
  }
  const furnace = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireT, color: new THREE.Color(1.2, 0.35, 0.1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.5 }));
  furnace.position.set(cx, 8, cz + 18); furnace.scale.set(90, 30, 1); G.add(furnace);
  group.add(G);
  W.stacksGroup = G;
}

// --- snow ------------------------------------------------------------------------------------
function buildSnow(W, group, r) {
  const N = 3600, box = { x: 50, y: 24, z: 50 };
  const pos = new Float32Array(N * 3), drift = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (r() - 0.5) * box.x; pos[i * 3 + 1] = r() * box.y; pos[i * 3 + 2] = (r() - 0.5) * box.z; drift[i] = r() * 6.28; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flakes = new THREE.Points(geo, new THREE.PointsMaterial({ map: T.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: new THREE.Color(0.92, 0.95, 1), size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false }));
  flakes.frustumCulled = false;
  group.add(flakes);
  W.snow = { flakes, geo, pos, drift, box, N, count: N };
}

// --- every frame -----------------------------------------------------------------------------
function updateCrust(W, dt, eye, time) {
  if (!eye) return;
  W.sky.position.copy(eye);
  // snow rides with the camera; flakes wrap round inside the box
  const S = W.snow, p = S.pos, b = S.box;
  if (!S.placed) { for (let i = 0; i < p.length; i += 3) { p[i] += eye.x; p[i + 2] += eye.z; } S.placed = true; }
  const end = S.count * 3;
  for (let i = 0; i < end; i += 3) {
    const k = i / 3;
    p[i + 1] -= dt * (1.0 + (k % 7) * 0.12);
    p[i] += dt * (0.9 + Math.sin(time * 0.7 + S.drift[k]) * 0.6);
    p[i + 2] += dt * Math.cos(time * 0.5 + S.drift[k]) * 0.35;
    const lx = p[i] - eye.x, lz = p[i + 2] - eye.z;
    if (lx > b.x / 2) p[i] -= b.x; else if (lx < -b.x / 2) p[i] += b.x;
    if (lz > b.z / 2) p[i + 2] -= b.z; else if (lz < -b.z / 2) p[i + 2] += b.z;
    if (p[i + 1] < 0) p[i + 1] += b.y;
  }
  S.geo.attributes.position.needsUpdate = true;

  // the stacks: drawn no further away than stackDrawDistance (scaled toward the eye)
  const D = CONFIG.crust.stackDrawDistance;
  const d = Math.hypot(W.stackCenter.x - eye.x, W.stackCenter.z - eye.z);
  const k = d > D ? D / d : 1;
  W.stacksGroup.scale.setScalar(k);
  W.stacksGroup.position.set(eye.x * (1 - k), eye.y * (1 - k), eye.z * (1 - k));

  // fires: barrels, candles, the tops of the stacks
  for (const f of W.flames) {
    if (f.sprite) {
      const ph = ((time * 0.8 + f.k / 6) % 1);
      f.sprite.position.set(f.base.x + Math.sin(time * 3 + f.k) * 1.2, f.base.y + 1 + ph * 9, f.base.z + Math.cos(time * 2.3 + f.k) * 1.2);
      f.sprite.scale.setScalar(9 * (1 - ph) + 3);
      f.sprite.material.opacity = (1 - ph) * 0.9;
      continue;
    }
    if (!f.sprites) {
      const fm = T.softDotTexture('rgba(255,200,90,1)', 'rgba(255,80,10,0)');
      f.sprites = [];
      for (let i = 0; i < f.n; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fm, color: new THREE.Color(2.4, 1.2, 0.35), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        W.mv.group.add(s); f.sprites.push(s);
      }
    }
    f.sprites.forEach((s, i) => {
      const life = 1 - ((time * 0.9 + i * 0.21) % 1);
      const t = time * (3 + i * 0.7) + i * 1.7;
      s.position.set(f.x + Math.sin(t) * 0.07, f.h + 0.1 + (1 - life) * (f.small ? 0.12 : 0.55), f.z + Math.cos(t * 1.3) * 0.07);
      s.scale.setScalar((f.small ? 0.12 : 0.55) * life + 0.05);
      s.material.opacity = life;
    });
  }
  // smoke: from the stacks, the workshop chimneys, and wisps over the moon
  for (const sm of W.smoke) {
    if (sm.stack) {
      const ph = (time * 0.05 + sm.ph) % 1;
      const s = sm.stack;
      sm.s.position.set(s.x + ph * 40 + Math.sin(time * 0.3 + sm.ph * 9) * 3, s.h + 6 + ph * 70, s.z + ph * 14);
      sm.s.scale.setScalar(10 + ph * 46);
      sm.s.material.opacity = 0.8 * Math.min(1, ph * 6) * (1 - ph);
    } else if (sm.chimney) {
      if (!sm.puffs) {
        sm.puffs = [];
        const st = T.smokeTexture(5);
        for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, color: '#2a2826', transparent: true, depthWrite: false, opacity: 0.5 })); W.mv.group.add(s); sm.puffs.push(s); }
      }
      sm.puffs.forEach((s, i) => {
        const ph = (time * 0.25 + i / 4) % 1;
        s.position.set(sm.chimney.x + ph * 2.2, sm.chimney.y + ph * 5, sm.chimney.z + ph * 0.8);
        s.scale.setScalar(0.8 + ph * 3);
        s.material.opacity = 0.55 * (1 - ph);
      });
    } else if (sm.sky) {
      sm.s.position.set(sm.home.x + Math.sin(time * 0.02 + sm.ph) * 14, sm.home.y, sm.home.z + Math.cos(time * 0.017 + sm.ph) * 6);
    }
  }
  // the old stones' crystal turns; the glyph ring breathes
  for (const c of W.crystals) {
    c.m.rotation.y = time * 0.6;
    c.m.position.y = 2.2 + Math.sin(time * 1.3) * 0.12;
    c.halo.position.y = c.m.position.y;
    c.halo.material.opacity = 0.5 + Math.sin(time * 2.1) * 0.15;
  }
  if (W.glyphRing) W.glyphRing.material.opacity = 0.65 + Math.sin(time * 1.4) * 0.25;
  // lanterns flicker a little
  for (const l of W.lanterns) if (l.v) l.v.level = 0.85 + Math.sin(time * 9 + l.pos.x * 3) * 0.06 + Math.sin(time * 23 + l.pos.z) * 0.04;

  // lightning in the clouds: a flicker now and then (the thunder rolls in on its own)
  W.flashT -= dt;
  if (W.flashT <= 0) {
    W.flashT = CONFIG.crust.thunderEvery[0] + Math.random() * (CONFIG.crust.thunderEvery[1] - CONFIG.crust.thunderEvery[0]);
    W.flashSeq = [0, 0.09, 0.2, 0.33].map((t) => time + t);
  }
  let f = 0;
  if (W.flashSeq) for (const t0 of W.flashSeq) { const a = time - t0; if (a >= 0 && a < 0.12) f = Math.max(f, 1 - a / 0.12); }
  W.flash = Math.max(f, W.flash - dt * 4);
  W.hemi.intensity = W.hemiBase + W.flash * 1.6;
  W.dome.material.color.setScalar(1 + W.flash * 1.4);
}
