// =============================================================================
// Stew Leonard High dressing for "Out of Bounds": the metal-clad Press Box
// hanging over center court (Erik's booth), fiberglass dairy cows, the
// rotting animatronic cows on the cafeteria stage, the Rule #1 rock in the
// Quad, the store-style sign over the cafeteria, and blood dragged across
// the court.
//
// Built once by MapView for the school. Things the quest moves (the Press Box
// cladding, the statue's jaw) are kept on `story` for the quest views to drive.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// --- textures ------------------------------------------------------------------
function cowHideTexture(seed = 3, { rot = 0 } = {}) {
  T.seedTextures(seed);
  const S = 512;
  const [c, g] = T.makeCanvas(S, S);
  g.fillStyle = rot ? '#b8ad98' : '#f2efe6'; g.fillRect(0, 0, S, S);
  let s = (Math.abs(seed * 7919) % 2147483646) + 1;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  g.fillStyle = rot ? '#2a1c14' : '#151515';
  for (let i = 0; i < 9; i++) {
    const x = r() * S, y = r() * S, R = 30 + r() * 70;
    g.beginPath();
    for (let a = 0; a < 6.3; a += 0.4) { const k = R * (0.7 + r() * 0.5); g.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k * 0.8); }
    g.closePath(); g.fill();
  }
  if (rot) {
    // torn patches and rot
    for (let i = 0; i < 26; i++) {
      const x = r() * S, y = r() * S, R = 8 + r() * 36;
      const grd = g.createRadialGradient(x, y, 0, x, y, R);
      grd.addColorStop(0, i % 3 ? 'rgba(70,20,16,0.95)' : 'rgba(40,46,30,0.9)'); grd.addColorStop(1, 'rgba(60,30,20,0)');
      g.fillStyle = grd; g.fillRect(x - R, y - R, R * 2, R * 2);
    }
  } else {
    // fiberglass: chips and grime
    g.globalAlpha = 0.12; g.fillStyle = '#5a4a30';
    for (let i = 0; i < 120; i++) g.fillRect(r() * S, r() * S, 2 + r() * 6, 1 + r() * 3);
    g.globalAlpha = 1;
  }
  return T.toTexture(c);
}

function corrugatedTexture() {
  const W = 256, H = 256;
  const [c, g] = T.makeCanvas(W, H);
  for (let x = 0; x < W; x++) {
    const k = 0.5 + 0.5 * Math.sin((x / W) * Math.PI * 2 * 8);
    const v = Math.round(70 + k * 70);
    g.fillStyle = `rgb(${v},${v + 4},${v + 8})`; g.fillRect(x, 0, 1, H);
  }
  // rust runs and rivets
  let s = 99; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < 40; i++) {
    const x = r() * W, y = r() * H * 0.6, h = 20 + r() * 120;
    const grd = g.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, 'rgba(120,60,24,0.5)'); grd.addColorStop(1, 'rgba(120,60,24,0)');
    g.fillStyle = grd; g.fillRect(x, y, 2 + r() * 5, h);
  }
  g.fillStyle = '#2a2a2a';
  for (let x = 8; x < W; x += 32) { g.beginPath(); g.arc(x, 8, 3, 0, 7); g.fill(); g.beginPath(); g.arc(x, H - 8, 3, 0, 7); g.fill(); }
  return T.toTexture(c);
}

function signTexture(lines, { w = 1024, h = 256, bg = '#1a0f0a', fg = '#e83a24', sub = '#f0d070' } = {}) {
  const [c, g] = T.makeCanvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c9a54e'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
  // marquee bulbs
  g.fillStyle = '#f8e8b0';
  for (let x = 30; x < w - 20; x += 40) { g.beginPath(); g.arc(x, 26, 6, 0, 7); g.fill(); g.beginPath(); g.arc(x, h - 26, 6, 0, 7); g.fill(); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = fg; g.font = `900 ${h * 0.34}px Impact, "Arial Black", sans-serif`;
  g.fillText(lines[0], w / 2, h * 0.43, w * 0.9);
  if (lines[1]) { g.fillStyle = sub; g.font = `700 ${h * 0.16}px "Arial Narrow", Arial, sans-serif`; g.fillText(lines[1], w / 2, h * 0.73, w * 0.9); }
  return T.toTexture(c, { repeat: false });
}

function rockTextTexture() {
  const W = 1024, H = 384;
  const [c, g] = T.makeCanvas(W, H);
  g.clearRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const carve = (t, y, size) => {
    g.font = `900 ${size}px Georgia, "Times New Roman", serif`;
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillText(t, W / 2 + 2, y + 2, W * 0.92);
    g.fillStyle = 'rgba(20,18,14,0.92)'; g.fillText(t, W / 2, y, W * 0.92);
  };
  carve('RULE #1', H * 0.16, 64);
  carve('THE STUDENT IS ALWAYS RIGHT.', H * 0.36, 52);
  carve('RULE #2', H * 0.6, 64);
  carve('IF THE STUDENT IS EVER WRONG,', H * 0.78, 44);
  carve('REREAD RULE #1.', H * 0.92, 44);
  return T.toTexture(c, { repeat: false });
}

function streakTexture(seed) {
  T.seedTextures(seed);
  const W = 512, H = 128;
  const [c, g] = T.makeCanvas(W, H);
  g.clearRect(0, 0, W, H);
  let s = seed * 31; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  // a body dragged across the floor: a wide smear with finger streaks that thins out
  for (let i = 0; i < 9; i++) {
    const y = H * (0.25 + r() * 0.5), w = 4 + r() * 16;
    const grd = g.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, 'rgba(70,4,3,0.95)'); grd.addColorStop(0.6, 'rgba(80,6,4,0.6)'); grd.addColorStop(1, 'rgba(80,6,4,0)');
    g.strokeStyle = grd; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(W * 0.04, y); g.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 30, W * 0.6, y + (r() - 0.5) * 30, W * (0.7 + r() * 0.28), y + (r() - 0.5) * 20); g.stroke();
  }
  const grd = g.createRadialGradient(W * 0.06, H / 2, 2, W * 0.06, H / 2, H * 0.45);
  grd.addColorStop(0, 'rgba(50,2,2,0.95)'); grd.addColorStop(1, 'rgba(50,2,2,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W * 0.3, H);
  return T.toTexture(c, { repeat: false });
}

// --- a dairy cow ------------------------------------------------------------------
// statue: glossy fiberglass. rot: an animatronic gone bad (torn hide, metal
// showing, red eyes). Returns { group, head, jaw, eyes }.
export function buildCow({ rot = false, seed = 3 } = {}) {
  const hide = new THREE.MeshStandardMaterial({ map: cowHideTexture(seed, { rot }), roughness: rot ? 0.85 : 0.32, metalness: 0 });
  const pink = new THREE.MeshStandardMaterial({ color: rot ? '#7a4a44' : '#e8a8a0', roughness: rot ? 0.8 : 0.35 });
  const horn = new THREE.MeshStandardMaterial({ color: '#d8ccb0', roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: '#6a6a6a', roughness: 0.4, metalness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.3 });
  const eyeMat = rot
    ? new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.25, 0.15) })
    : new THREE.MeshStandardMaterial({ color: '#0c0c0c', roughness: 0.15 });
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, p = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); p.add(m); return m; };

  // body (along +x = front)
  const body = add(new THREE.CapsuleGeometry(0.36, 0.85, 8, 16), hide, 0, 1.0, 0);
  body.rotation.z = Math.PI / 2; body.scale.set(1, 1, 0.92);
  add(new THREE.SphereGeometry(0.2, 12, 10), pink, -0.25, 0.68, 0).scale.set(1, 0.7, 1);   // udder
  for (const [x, z] of [[0.5, 0.2], [0.5, -0.2], [-0.48, 0.2], [-0.48, -0.2]]) {
    const leg = add(new THREE.CylinderGeometry(0.075, 0.06, 0.78, 10), rot && x < 0 && z < 0 ? steel : hide, x, 0.42, z);
    void leg;
    add(new THREE.CylinderGeometry(0.07, 0.075, 0.08, 10), dark, x, 0.04, z);             // hoof
  }
  // tail
  const tail = add(new THREE.CylinderGeometry(0.02, 0.015, 0.6, 6), hide, -0.86, 0.95, 0);
  tail.rotation.z = -0.25;
  add(new THREE.SphereGeometry(0.05, 8, 6), dark, -0.92, 0.66, 0);

  // head on a neck pivot so it can turn / twitch
  const head = new THREE.Group(); head.position.set(0.72, 1.18, 0); g.add(head);
  add(new THREE.BoxGeometry(0.36, 0.3, 0.3), hide, 0.14, 0.02, 0, head);
  const muzzle = add(new THREE.BoxGeometry(0.2, 0.18, 0.26), pink, 0.38, -0.06, 0, head);
  void muzzle;
  for (const z of [-0.06, 0.06]) add(new THREE.SphereGeometry(0.025, 6, 6), dark, 0.485, -0.04, z, head);  // nostrils
  const jaw = new THREE.Group(); jaw.position.set(0.28, -0.15, 0); head.add(jaw);
  add(new THREE.BoxGeometry(0.22, 0.05, 0.22), pink, 0.1, -0.02, 0, jaw);
  if (rot) for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.012, 0.05, 4), horn, 0.04 + i * 0.04, 0.03, (i % 2 ? 1 : -1) * 0.07, jaw);
  const eyes = [];
  for (const z of [-0.155, 0.155]) {
    eyes.push(add(new THREE.SphereGeometry(rot ? 0.035 : 0.04, 10, 8), eyeMat, 0.2, 0.08, z, head));
    const h = add(new THREE.ConeGeometry(0.035, 0.18, 8), horn, 0.04, 0.2, z * 1.2, head);
    h.rotation.x = z > 0 ? 0.6 : -0.6;
    const ear = add(new THREE.BoxGeometry(0.06, 0.04, 0.16), hide, 0.0, 0.1, z * 1.55, head);
    ear.rotation.x = z > 0 ? 0.4 : -0.4;
  }
  if (rot) {
    // the skull and endoskeleton show through
    add(new THREE.BoxGeometry(0.18, 0.12, 0.08), steel, 0.08, 0.08, 0.15, head);
    for (let i = 0; i < 4; i++) add(new THREE.TorusGeometry(0.3, 0.012, 6, 16, Math.PI), steel, -0.2 + i * 0.13, 1.0, 0.33).rotation.y = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), steel, 0.38, 1.0, 0).rotation.z = Math.PI / 2;
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  return { group: g, head, jaw, eyes, hide };
}

// --- the Press Box ----------------------------------------------------------------
// A steel booth hung from the trusses over center court. Glass on all four sides,
// hidden behind corrugated cladding that the quest grinds up into the roof.
const PB = { x0: -2.6, x1: 2.6, z0: -1.8, z1: 1.8, y0: 5.2, y1: 7.5 };
export const PRESS_BOX = PB;

function buildPressBox(M) {
  const g = new THREE.Group();
  const steel = M.rustMetal;
  const clad = new THREE.MeshStandardMaterial({ map: corrugatedTexture(), roughness: 0.55, metalness: 0.55 });
  clad.map.wrapS = clad.map.wrapT = THREE.RepeatWrapping;
  const glass = new THREE.MeshStandardMaterial({ color: '#90b8a0', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 0.6) });
  const W = PB.x1 - PB.x0, D = PB.z1 - PB.z0, H = PB.y1 - PB.y0;
  const cy = (PB.y0 + PB.y1) / 2;
  const add = (geo, mat, x, y, z, p = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); p.add(m); return m; };
  // floor and roof slabs, corner posts
  add(new THREE.BoxGeometry(W + 0.3, 0.25, D + 0.3), steel, 0, PB.y0 - 0.125, 0);
  add(new THREE.BoxGeometry(W + 0.4, 0.22, D + 0.4), steel, 0, PB.y1 + 0.11, 0);
  for (const x of [PB.x0, PB.x1]) for (const z of [PB.z0, PB.z1]) add(new THREE.BoxGeometry(0.16, H, 0.16), steel, x, cy, z);
  // glass (behind the cladding)
  const panes = [];
  panes.push(add(new THREE.PlaneGeometry(W, H * 0.7), glass, 0, cy + 0.15, PB.z1));
  panes.push(add(new THREE.PlaneGeometry(W, H * 0.7), glass, 0, cy + 0.15, PB.z0)); panes[1].rotation.y = Math.PI;
  panes.push(add(new THREE.PlaneGeometry(D, H * 0.7), glass, PB.x1, cy + 0.15, 0)); panes[2].rotation.y = Math.PI / 2;
  panes.push(add(new THREE.PlaneGeometry(D, H * 0.7), glass, PB.x0, cy + 0.15, 0)); panes[3].rotation.y = -Math.PI / 2;
  // interior: a sickly green glow, a desk with the soundboard
  const inside = new THREE.Group(); g.add(inside);
  add(new THREE.BoxGeometry(W - 0.3, 0.06, 0.7), steel, 0, PB.y0 + 0.9, PB.z1 - 0.45, inside);
  add(new THREE.BoxGeometry(W - 0.3, 0.86, 0.06), steel, 0, PB.y0 + 0.45, PB.z1 - 0.12, inside);
  const board = add(new THREE.BoxGeometry(1.4, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.4 }), 0, PB.y0 + 0.97, PB.z1 - 0.45, inside);
  for (let i = 0; i < 18; i++) add(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: i % 3 ? new THREE.Color(0.2, 1.6, 0.4) : new THREE.Color(2, 0.3, 0.2) }), -0.6 + i * 0.07, PB.y0 + 1.03, PB.z1 - 0.45 + (i % 2) * 0.12, inside);
  void board;
  const mic = add(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 6), steel, 0.4, PB.y0 + 1.15, PB.z1 - 0.5, inside); mic.rotation.x = -0.5;
  add(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: '#333' }), 0.4, PB.y0 + 1.33, PB.z1 - 0.38, inside);
  const glowBack = add(new THREE.PlaneGeometry(W - 0.2, H - 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.8, 0.22) }), 0, cy, PB.z0 + 0.1, inside);
  void glowBack;

  // cladding: one sheet per side, slides up into a housing on the roof
  const cladding = [];
  const sheet = (w, x, z, ry) => {
    const geo = new THREE.PlaneGeometry(w, H + 0.05);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 1.6, uv.getY(i) * H / 1.6);
    const m = add(geo, clad, x, cy, z); m.rotation.y = ry;
    // seams leaking green light
    const seam = add(new THREE.PlaneGeometry(w, 0.025), glow, 0, -H / 2 + 0.06, 0.005, m);
    void seam;
    m.userData.home = cy;
    cladding.push(m);
    return m;
  };
  sheet(W, 0, PB.z1 + 0.04, 0);
  sheet(W, 0, PB.z0 - 0.04, Math.PI);
  sheet(D, PB.x1 + 0.04, 0, Math.PI / 2);
  sheet(D, PB.x0 - 0.04, 0, -Math.PI / 2);
  // roof housing the cladding retracts into
  add(new THREE.BoxGeometry(W + 0.5, 0.5, D + 0.5), steel, 0, PB.y1 + 0.47, 0);
  // hung from the trusses on four steel cables
  for (const x of [PB.x0 + 0.3, PB.x1 - 0.3]) for (const z of [PB.z0 + 0.3, PB.z1 - 0.3]) {
    add(new THREE.CylinderGeometry(0.025, 0.025, 9 - PB.y1 - 0.7, 6), M.metal, x, (9 + PB.y1 + 0.7) / 2, z);
  }
  // a big "PRESS" placard on the cladding (two sides)
  const placard = new THREE.MeshStandardMaterial({ map: signTexture(['PRESS BOX', 'STEW LEONARDS · HOME OF THE CHAMPIONS'], { w: 1024, h: 220, bg: '#1d4a2a', fg: '#f4efe0', sub: '#c9a54e' }), roughness: 0.6 });
  for (const [z, ry] of [[PB.z1 + 0.06, 0], [PB.z0 - 0.06, Math.PI]]) {
    const p = add(new THREE.PlaneGeometry(3.2, 0.7), placard, 0, PB.y1 - 0.5, z); p.rotation.y = ry;
    cladding.push(p);
    p.userData.home = PB.y1 - 0.5; p.userData.placard = true;
  }
  return { group: g, cladding, panes, inside, glass };
}

// --- the Rule #1 rock -------------------------------------------------------------
function buildRock(M, b) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 40, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // smooth lumps, a flat-ish bottom and a flatter carved face on the west side
    let k = 1 + 0.12 * Math.sin(x * 3.1 + z * 1.7) + 0.08 * Math.sin(y * 4.3 + x * 2.2) + 0.05 * Math.sin(z * 6.1 - y * 3.3);
    let px = x * k;
    if (px < -0.72) px = -0.72 + (px + 0.72) * 0.25;
    pos.setXYZ(i, px, Math.max(-0.25, y) * k, z * k);
  }
  geo.computeVertexNormals();
  const stoneMap = T.toTexture(T.noiseCanvas(256, 5, 6));
  const rockMat = new THREE.MeshStandardMaterial({ map: stoneMap, color: '#8a8478', roughness: 0.95 });
  const rock = new THREE.Mesh(geo, rockMat);
  const w = b[3] - b[0], h = b[4] - b[1], d = b[5] - b[2];
  rock.scale.set(w / 2, h / 0.95, d / 2);
  rock.position.set((b[0] + b[3]) / 2, b[1] + h * 0.18, (b[2] + b[5]) / 2);
  g.add(rock);
  // the carved face, toward the hall door (west)
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.85, h * 0.6), new THREE.MeshStandardMaterial({ map: rockTextTexture(), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
  face.position.set((b[0] + b[3]) / 2 - (w / 2) * 0.72 - 0.03, b[1] + h * 0.5, (b[2] + b[5]) / 2);
  face.rotation.y = -Math.PI / 2;
  g.add(face);
  return g;
}

// --- blood dragged across the court ----------------------------------------------
function buildCourtBlood() {
  const g = new THREE.Group();
  const streaks = [1, 2, 3].map((i) => new THREE.MeshStandardMaterial({ map: streakTexture(i), transparent: true, depthWrite: false, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -3 }));
  const splats = [1, 2, 3, 4].map((i) => new THREE.MeshStandardMaterial({ map: T.bloodSplatTexture(i + 20), transparent: true, depthWrite: false, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -3 }));
  const flat = (mat, x, z, w, h, yaw) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), mat);
    m.position.set(x, 0.004, z); m.rotation.y = yaw; g.add(m);
  };
  // drag marks heading for the doors, pools round center court
  flat(streaks[0], 4.5, 2.6, 6.2, 1.5, -0.3);
  flat(streaks[1], -6, -3.5, 7, 1.6, 2.8);
  flat(streaks[2], 11.5, 5.2, 6.5, 1.5, 0.2);
  flat(streaks[0], -12.5, -5.4, 6, 1.4, 3.0);
  flat(streaks[1], 1.5, -7.5, 5.4, 1.3, 1.4);
  [[1.2, 0.8, 1.6], [-2.4, 2.6, 1.1], [7, -4, 1.3], [-9, 6, 1.2], [13, -2, 0.9], [-4, -9, 1.0], [3.3, 8.5, 0.8]].forEach(([x, z, sz], i) => flat(splats[i % 4], x, z, sz, sz, i * 1.7));
  return g;
}

// ---------------------------------------------------------------------------------
// Build everything for the school. Returns the movable bits and extra light blockers.
export function buildStoryProps(mapView) {
  const M = mapView.mats;
  const map = mapView.map;
  const root = new THREE.Group();
  const story = { root, occluders: [], animatronics: [], cows: [] };

  // Press Box over center court
  const pb = buildPressBox(M);
  pb.group.userData.noBake = true;   // its shadow comes from the box below
  root.add(pb.group);
  story.pressBox = pb;
  story.occluders.push([PB.x0 - 0.2, PB.y0 - 0.25, PB.z0 - 0.2, PB.x1 + 0.2, PB.y1 + 0.7, PB.z1 + 0.2]);

  // blood on the court
  const blood = buildCourtBlood();
  blood.userData.noBake = true;
  root.add(blood);

  // statues and animatronics from the map's props
  for (const p of map.props || []) {
    const b = p.box;
    if (p.kind === 'cow') {
      const cow = buildCow({ seed: Math.round(b[0] * 13 + b[2] * 7) });
      const len = Math.max(b[3] - b[0], b[5] - b[2]);
      const k = len / 2.15;
      const ph = p.plinth === true ? 0.25 : p.plinth || 0;
      const base = b[1] + ph;
      cow.group.scale.setScalar(k);
      cow.group.position.set((b[0] + b[3]) / 2 + 0.12 * k * (p.yaw ? Math.cos(p.yaw) : 1), base, (b[2] + b[5]) / 2);
      cow.group.rotation.y = p.yaw || 0;
      root.add(cow.group);
      story.cows.push(cow);
      if (p.mascot) story.mascot = cow;
      if (p.plinth) {
        const pl = new THREE.Mesh(new THREE.BoxGeometry(b[3] - b[0] + 0.1, ph, b[5] - b[2] + 0.1), M.stone);
        pl.position.set((b[0] + b[3]) / 2, b[1] + ph / 2, (b[2] + b[5]) / 2);
        root.add(pl);
      }
    } else if (p.kind === 'animatronic') {
      const cow = buildCow({ rot: true, seed: Math.round(b[2] * 5) });
      cow.group.scale.setScalar(1.35);
      cow.group.position.set((b[0] + b[3]) / 2 - 0.12, b[1], (b[2] + b[5]) / 2);
      cow.group.rotation.y = p.yaw || 0;
      // stood up on its hind legs like a performer: tip it back
      root.add(cow.group);
      cow.phase = b[2] * 1.3;
      story.animatronics.push(cow);
    } else if (p.kind === 'rock') {
      root.add(buildRock(M, b));
    }
  }

  // store-style marquee over the cafeteria stage (east wall)
  const cafe = map.rooms.find((r) => r.id === 'cafe');
  if (cafe) {
    const signMat = new THREE.MeshStandardMaterial({ map: signTexture(['STEW LEONARD HIGH', 'CAFETERIA · FRESH EVERY DAY · RULE #1: THE STUDENT IS ALWAYS RIGHT']), emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0.35, roughness: 0.6 });
    signMat.emissiveMap = signMat.map;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), signMat);
    sign.position.set(cafe.rect[2] - 0.12, 3.75, -31.5);
    sign.rotation.y = -Math.PI / 2;
    sign.userData.noBake = true;
    root.add(sign);
    story.cafeSign = signMat;
  }

  mapView.group.add(root);
  return story;
}

// Per frame: animatronics twitch and chatter, the sign buzzes.
export function updateStoryProps(story, dt, time) {
  for (const a of story.animatronics) {
    a.phase += dt;
    const t = a.phase;
    // mostly still, then a sudden jerk of the head
    const jerk = Math.sin(t * 0.7) > 0.93 ? Math.sin(t * 40) * 0.25 : 0;
    a.head.rotation.y = Math.sin(t * 0.45) * 0.4 + jerk;
    a.head.rotation.z = Math.sin(t * 0.3 + 1) * 0.15 + jerk * 0.5;
    a.jaw.rotation.z = -Math.max(0, Math.sin(t * 9)) * 0.45 * (Math.sin(t * 0.8) > 0 ? 1 : 0.1);
    for (const e of a.eyes) e.visible = Math.sin(t * 13.7 + a.phase) > -0.9;
  }
  if (story.cafeSign) story.cafeSign.emissiveIntensity = 0.3 + (Math.sin(time * 23) > 0.96 ? -0.25 : 0) + Math.sin(time * 1.3) * 0.03;
}
