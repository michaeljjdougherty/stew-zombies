// =============================================================================
// Firing Range (Map 3): the camp itself. The model (assets/firingrange/range.glb,
// tools/firingrange/build.mjs) comes in sorted by surface, with no textures of
// its own; here each surface is painted the way Black Ops 1's Firing Range
// looks: red-brown jungle dirt and tyre ruts, dusty tan road, sun-bleached
// plywood and planks, rusted corrugated tin, chipped yellow plaster over
// brick, grey concrete, olive drab, palms and ferns, the creek's murky water.
// Texture coordinates come from the world (box-projected, in metres). Then the
// evening light: a low sun from the west, the sky, and the haze.
// Also the barricades' plywood surrounds (the frames and planks are mapView's).
// =============================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as T from './textures.js';
import { R } from './crustTextures.js';
import { applySurface } from './surfaces.js';
import { fetchGlb } from './gltfLite.js';

const tex = (c, size) => { const t = T.toTexture(c); t.repeat.set(1 / size, 1 / size); return t; };
const rgba = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

// A base colour with soft blotches of lighter and darker, and fine grit.
function blotchy(g, S, r, base, { blotches = 300, size = [6, 40], dark = [0, 0, 0], light = [255, 255, 255], grit = 3000, alpha = [0.05, 0.18] } = {}) {
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const n = T.noiseCanvas(S, 6, 4);
  g.globalAlpha = 0.45; g.globalCompositeOperation = 'multiply'; g.drawImage(n, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  for (let i = 0; i < blotches; i++) {
    const w = size[0] + r() * (size[1] - size[0]), c = r() < 0.5 ? dark : light;
    g.fillStyle = rgba(c[0], c[1], c[2], alpha[0] + r() * (alpha[1] - alpha[0]));
    // (drawn wrapped round the edges so it tiles)
    const x = r() * S, y = r() * S, a = r() * 3;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.ellipse(x + ox, y + oy, w, w * (0.4 + r() * 0.5), a, 0, 7); g.fill(); }
  }
  for (let i = 0; i < grit; i++) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.1 + r() * 0.25})` : `rgba(255,240,220,${0.05 + r() * 0.15})`; g.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5); }
}

// Red-brown jungle dirt: packed, with tyre ruts, boot prints, puddle stains and pebbles.
function dirtTexture(seed = 3) {
  const S = 512, [c, g] = T.makeCanvas(S, S), r = R(seed);
  blotchy(g, S, r, '#6e4a33', { dark: [40, 24, 14], light: [150, 110, 80], blotches: 380 });
  for (let i = 0; i < 2; i++) {   // ruts
    const x = S * (0.25 + i * 0.45);
    g.strokeStyle = 'rgba(35,20,12,0.28)'; g.lineWidth = 14;
    for (const dx of [-28, 28]) { g.beginPath(); g.moveTo(x + dx, 0); g.bezierCurveTo(x + dx + 20, S * 0.33, x + dx - 20, S * 0.66, x + dx, S); g.stroke(); }
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${150 + r() * 60},${130 + r() * 40},${110 + r() * 30},${0.4 + r() * 0.4})`; g.beginPath(); g.ellipse(r() * S, r() * S, 1 + r() * 3, 1 + r() * 2, r() * 3, 0, 7); g.fill(); }
  return c;
}
// The road: dusty tan gravel.
function roadTexture() {
  const S = 512, [c, g] = T.makeCanvas(S, S), r = R(5);
  blotchy(g, S, r, '#8f7a5c', { dark: [60, 46, 32], light: [190, 170, 140], blotches: 260, grit: 9000 });
  return c;
}
// Tropical grass, dry at the tips.
function grassTexture(base = '#56602f', seed = 7) {
  const S = 512, [c, g] = T.makeCanvas(S, S), r = R(seed);
  blotchy(g, S, r, base, { dark: [24, 34, 12], light: [150, 150, 70], blotches: 200, grit: 0 });
  for (let i = 0; i < 9000; i++) {
    const x = r() * S, y = r() * S, l = 3 + r() * 9, a = -Math.PI / 2 + (r() - 0.5) * 0.9;
    g.strokeStyle = r() < 0.7 ? `rgba(${40 + r() * 50},${60 + r() * 50},${18 + r() * 20},0.7)` : `rgba(${140 + r() * 40},${130 + r() * 30},${70 + r() * 20},0.6)`;
    g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return c;
}
// Weathered planks, grey-brown, nailed, dark gaps (walls run vertical, floors any way).
function plankTexture({ base = [112, 92, 70], w = 32, seed = 9, vertical = true } = {}) {
  const S = 512, [c, g] = T.makeCanvas(S, S), r = R(seed);
  g.fillStyle = '#1c140e'; g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += w) {
    const k = 0.75 + r() * 0.4, sh = (r() - 0.5) * 18;
    g.fillStyle = `rgb(${base[0] * k + sh},${base[1] * k + sh},${base[2] * k})`;
    g.fillRect(x + 1.5, 0, w - 3, S);
    for (let i = 0; i < 40; i++) {   // grain
      const gx = x + 3 + r() * (w - 6);
      g.strokeStyle = `rgba(${r() < 0.5 ? '30,20,12' : '200,180,150'},${0.08 + r() * 0.12})`; g.lineWidth = 0.5 + r();
      g.beginPath(); g.moveTo(gx, r() * S); g.lineTo(gx + (r() - 0.5) * 3, r() * S); g.stroke();
    }
    for (let y = 0; y < S; y += S / 2) { g.fillStyle = 'rgba(30,26,22,0.8)'; g.fillRect(x + w / 2 - 6, y + 10, 2, 2); g.fillRect(x + w / 2 + 4, y + 10, 2, 2); }   // nails
    if (r() < 0.4) { const y = r() * S; g.fillStyle = '#1c140e'; g.fillRect(x, y, w, 2); }   // a butt joint
  }
  // weathering: grey bleach, water stains from the bottom
  const n = T.noiseCanvas(S, 5, 3);
  g.globalAlpha = 0.35; g.globalCompositeOperation = 'multiply'; g.drawImage(n, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  const grd = g.createLinearGradient(0, S, 0, S * 0.6); grd.addColorStop(0, 'rgba(30,20,10,0.35)'); grd.addColorStop(1, 'rgba(30,20,10,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  if (!vertical) { const [c2, g2] = T.makeCanvas(S, S); g2.translate(S / 2, S / 2); g2.rotate(Math.PI / 2); g2.drawImage(c, -S / 2, -S / 2); return c2; }
  return c;
}
// Corrugated tin, galvanised grey gone to rust in streaks and patches.
function tinTexture() {
  const S = 512, [c, g] = T.makeCanvas(S, S), r = R(13);
  for (let x = 0; x < S; x++) { const v = 0.5 + 0.5 * Math.sin((x / S) * Math.PI * 2 * 16); const k = 70 + v * 55; g.fillStyle = `rgb(${k},${k * 0.97},${k * 0.92})`; g.fillRect(x, 0, 1, S); }
  const n = T.noiseCanvas(S, 6, 4);
  const [mc, mg] = T.makeCanvas(S, S); mg.drawImage(n, 0, 0);
  const img = mg.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = d[i] / 255, a = Math.max(0, Math.min(1, (v - 0.45) / 0.2)); d[i] = 118; d[i + 1] = 62; d[i + 2] = 30; d[i + 3] = a * 210; }
  mg.putImageData(img, 0, 0); g.drawImage(mc, 0, 0);
  for (let i = 0; i < 70; i++) {   // rust running down
    const x = r() * S, y = r() * S, l = 30 + r() * 160;
    const grd = g.createLinearGradient(0, y, 0, y + l); grd.addColorStop(0, 'rgba(110,52,20,0.55)'); grd.addColorStop(1, 'rgba(110,52,20,0)');
    g.fillStyle = grd; g.fillRect(x, y, 3 + r() * 8, l);
  }
  for (let y = 0; y < S; y += S / 2) for (let x = 8; x < S; x += S / 8) { g.fillStyle = 'rgba(40,30,20,0.9)'; g.beginPath(); g.arc(x, y + 6, 2.5, 0, 7); g.fill(); }   // screws
  return c;
}
// Yellowed plaster, chipped off in places down to the brick.
function plasterTexture() {
  const S = 512, [c, g] = T.makeCanvas(S, S), r = R(17);
  blotchy(g, S, r, '#a8956c', { dark: [70, 58, 40], light: [210, 200, 170], blotches: 200, grit: 4000 });
  for (let i = 0; i < 9; i++) {
    const x = r() * S, y = r() * S, w = 30 + r() * 80, h = 20 + r() * 50;
    g.save(); g.beginPath(); g.ellipse(x, y, w, h, r(), 0, 7); g.clip();
    g.fillStyle = '#5a3a2a'; g.fillRect(x - w, y - h, w * 2, h * 2);
    for (let by = y - h; by < y + h; by += 14) for (let bx = x - w + ((by / 14) % 2) * 15; bx < x + w; bx += 30) { g.fillStyle = `rgb(${120 + r() * 30},${62 + r() * 20},${44 + r() * 14})`; g.fillRect(bx + 1, by + 1, 28, 12); }
    g.restore();
    g.strokeStyle = 'rgba(60,45,30,0.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, 7); g.stroke();
  }
  const grd = g.createLinearGradient(0, S, 0, S * 0.5); grd.addColorStop(0, 'rgba(50,40,25,0.45)'); grd.addColorStop(1, 'rgba(50,40,25,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return c;
}
// Grey concrete, stained and patched.
function concreteTexture() {
  const S = 512, [c, g] = T.makeCanvas(S, S), r = R(19);
  blotchy(g, S, r, '#7a776e', { dark: [40, 38, 34], light: [170, 166, 155], blotches: 260, grit: 6000 });
  g.strokeStyle = 'rgba(40,36,30,0.4)'; g.lineWidth = 2;
  for (let y = 0; y <= S; y += S / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }   // pour lines
  return c;
}
function paintedMetalTexture(base, seed) {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(seed);
  blotchy(g, S, r, base, { dark: [20, 18, 14], light: [140, 130, 110], blotches: 80, size: [3, 20], grit: 1500 });
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(105,50,22,${0.3 + r() * 0.4})`; g.beginPath(); g.ellipse(r() * S, r() * S, 2 + r() * 10, 2 + r() * 6, r() * 3, 0, 7); g.fill(); }
  return c;
}
function rockTexture() {
  const S = 512, [c, g] = T.makeCanvas(S, S), r = R(23);
  blotchy(g, S, r, '#6f665a', { dark: [30, 28, 24], light: [160, 150, 135], blotches: 340, grit: 7000 });
  for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(25,22,18,0.45)'; g.lineWidth = 1 + r() * 2; g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 60; y += r() * 40; g.lineTo(x, y); } g.stroke(); }
  // moss in the cracks
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(60,80,30,${0.15 + r() * 0.25})`; g.beginPath(); g.ellipse(r() * S, r() * S, 4 + r() * 18, 3 + r() * 8, r() * 3, 0, 7); g.fill(); }
  return c;
}
function leafTexture(base, seed) {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(seed);
  blotchy(g, S, r, base, { dark: [10, 20, 6], light: [150, 170, 70], blotches: 120, size: [4, 24], grit: 0 });
  for (let i = 0; i < 260; i++) { const x = r() * S, y = r() * S; g.strokeStyle = `rgba(${170 + r() * 50},${180 + r() * 40},${90 + r() * 40},0.25)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y - 6 + r() * 12); g.stroke(); }
  return c;
}
function waterTexture() {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(29);
  blotchy(g, S, r, '#3c4834', { dark: [14, 20, 12], light: [120, 130, 100], blotches: 90, size: [8, 40], grit: 0, alpha: [0.05, 0.12] });
  for (let i = 0; i < 120; i++) { g.strokeStyle = `rgba(200,210,190,${0.05 + r() * 0.1})`; g.lineWidth = 1; g.beginPath(); const x = r() * S, y = r() * S; g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 3, x + 20 + r() * 20, y); g.stroke(); }
  return c;
}

// Each surface: its painting, how many metres one copy covers, a photo surface
// for detail (src/surfaces.js), and how it shines.
function surfaceMaterials() {
  const def = {
    dirt: { map: dirtTexture(), size: 6, photo: 'ground', rough: 1 },
    road: { map: roadTexture(), size: 5, photo: 'ground', rough: 1 },
    grass: { map: grassTexture(), size: 4, photo: 'grass', rough: 1 },
    far: { map: grassTexture('#3e4a26', 31), size: 12, rough: 1 },
    water: { map: waterTexture(), size: 8, rough: 0.25, metal: 0.1, transparent: 0.88 },
    rock: { map: rockTexture(), size: 4, photo: 'concrete', rough: 0.95 },
    planks: { map: plankTexture({ vertical: false, base: [104, 84, 62], seed: 11 }), size: 2.4, photo: 'wood', rough: 0.95 },
    wood: { map: plankTexture({ base: [118, 100, 80], w: 40, seed: 9 }), size: 2.6, photo: 'wood', rough: 0.95 },
    tin: { map: tinTexture(), size: 2.4, photo: 'metal', rough: 0.7, metal: 0.35 },
    plaster: { map: plasterTexture(), size: 3.2, photo: 'plaster', rough: 0.95 },
    concrete: { map: concreteTexture(), size: 3.5, photo: 'concrete', rough: 0.95 },
    metal: { map: paintedMetalTexture('#3d3c36', 37), size: 1.5, photo: 'metal', rough: 0.6, metal: 0.45 },
    olive: { map: paintedMetalTexture('#4c5232', 41), size: 2, photo: 'metal', rough: 0.75, metal: 0.3 },
    palm: { map: leafTexture('#55802c', 43), size: 1.5, rough: 0.85, double: true },
    fern: { map: leafTexture('#5e8a30', 47), size: 1, rough: 0.9, double: true },
    shrub: { map: leafTexture('#4a6c30', 53), size: 1.2, rough: 0.95, double: true },
  };
  const mats = {};
  for (const [k, d] of Object.entries(def)) {
    const m = new THREE.MeshStandardMaterial({ map: tex(d.map, d.size), roughness: d.rough, metalness: d.metal || 0, side: d.double ? THREE.DoubleSide : THREE.FrontSide });
    // (leaves light through: their undersides aren't black)
    if (d.double) { m.emissiveMap = m.map; m.emissive = new THREE.Color(0.35, 0.38, 0.3); }
    if (d.transparent) { m.transparent = true; m.opacity = d.transparent; m.depthWrite = false; }
    if (d.photo) applySurface(m, d.photo, { strength: 0.7 });
    m.name = 'firingRange_' + k;
    mats[k] = m;
  }
  return mats;
}

// Box-projected texture coordinates in metres from the world position,
// along each vertex's main axis (walls: across and up; floors: x and z).
function worldUVs(mesh) {
  const g = mesh.geometry, P = g.attributes.position, N = g.attributes.normal;
  mesh.updateMatrixWorld(true);
  const M = mesh.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(M);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i).applyMatrix4(M);
    n.fromBufferAttribute(N, i).applyMatrix3(nm);
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    if (ay >= ax && ay >= az) { uv[i * 2] = v.x; uv[i * 2 + 1] = v.z; }
    else if (ax >= az) { uv[i * 2] = v.z; uv[i * 2 + 1] = -v.y; }
    else { uv[i * 2] = v.x; uv[i * 2 + 1] = -v.y; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// The evening sky: a gradient dome, the haze at the bottom, the sun's glow.
function skyDome(cfg, sunDir, radius) {
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(cfg.sky.top) }, horizon: { value: new THREE.Color(cfg.sky.horizon) }, haze: { value: new THREE.Color(cfg.fog.color) }, sun: { value: sunDir.clone().normalize() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.9999; }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 haze; uniform vec3 sun; varying vec3 vDir; void main(){ float h = vDir.y; vec3 c = mix(horizon, top, smoothstep(0.0, 0.55, h)); c = mix(haze, c, smoothstep(-0.05, 0.12, h)); float s = max(dot(normalize(vDir), sun), 0.0); c += vec3(1.0, 0.62, 0.3) * (pow(s, 12.0) * 0.5 + pow(s, 400.0) * 3.0); gl_FragColor = vec4(c, 1.0); }',
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

// Plywood sheets round each barricade's frame, so it reads as part of a wall.
function barricadeSurrounds(mv, mat) {
  const wc = mv.cfg.windows, T0 = mv.T;
  const geo = [];
  for (const w of mv.sim.windows) {
    const grp = new THREE.Group();
    grp.position.set(w.center.x, w.center.y || 0, w.center.z);
    grp.rotation.y = Math.atan2(w.normal.x, w.normal.z);
    const hw = wc.width / 2;
    const add = (x, y, sx, sy) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.06), mat); b.position.set(x, y, -T0 / 2); grp.add(b); };
    add(-hw - 0.55, 1.2, 1.0, 2.4);          // the sheets either side
    add(hw + 0.55, 1.2, 1.0, 2.4);
    add(0, wc.sillHeight / 2, wc.width + 0.1, wc.sillHeight);   // under the sill
    add(0, (wc.topHeight + 2.4) / 2 + 0.03, wc.width + 0.1, 2.4 - wc.topHeight);   // over the top
    for (const x of [-hw - 1.05, hw + 1.05]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.7, 0.12), mat); p.position.set(x, 1.35, -T0 / 2); grp.add(p); }   // posts
    grp.userData.noBake = true;
    geo.push(grp);
  }
  return geo;
}

export function buildFiringRange(mv) {
  const map = mv.map, cfg = mv.cfg.firingRange;
  const out = { mv, root: new THREE.Group(), ready: false };
  out.root.name = 'firingRange';
  mv.group.add(out.root);

  // the light: the sky's (mapView dims it with the power and blackouts) and the low sun
  mv.hemi = new THREE.HemisphereLight(0xb8bccb, 0x6a5038, map.ambient ?? 0.8);
  mv.group.add(mv.hemi);
  const sunDir = new THREE.Vector3(...cfg.sun.from).normalize();
  const sun = new THREE.DirectionalLight(cfg.sun.color, cfg.sun.intensity);
  sun.position.copy(sunDir).multiplyScalar(100);
  mv.group.add(sun, sun.target);
  out.sun = sun;
  out.sky = skyDome(cfg, sunDir, (map.farPlane || 260) * 0.9);
  mv.group.add(out.sky);

  const mats = surfaceMaterials();
  out.mats = mats;
  for (const g of barricadeSurrounds(mv, mats.wood)) out.root.add(g);

  // the camp (in the background: nothing waits on it)
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  fetchGlb(map.glbWorld)
    .then((buf) => loader.parseAsync(buf, ''))
    .then((gltf) => {
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const name = o.material && o.material.name;
        o.material = mats[name] || mats.wood;
        worldUVs(o);
        o.matrixAutoUpdate = false;
      });
      gltf.scene.updateMatrixWorld(true);
      out.root.add(gltf.scene);
      out.ready = true;
    })
    .catch((err) => console.warn('firing range model:', err.message || err));
  return out;
}

// The sky dome follows the camera (it's the backdrop, not a place).
export function updateFiringRange(fr, eye) {
  if (fr.sky && eye) fr.sky.position.copy(eye);
}
