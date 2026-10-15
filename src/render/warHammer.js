// =============================================================================
// A War Hammer (Call of the Crust): the downloaded hammer (assets/props/
// hammer.glb: a big iron sledge on a long wooden haft) with its element bound
// into the iron and going off round the head the whole time:
//   fire       glowing bands, spikes like flames off the top, and real fire:
//              flames licking up off the head and embers drifting away
//   ice        crystal shards, a cold mist circling the head, snow falling off it
//   wind       swept fins, a gale spiralling round the head, wind ribbons
//   lightning  forked prongs and arcs crackling off the iron, sparks
// Tempered by Pit (each hammer's "+"), the element runs harder in its new color.
// A built hammer stands in until the model arrives (or if it can't load).
// The effects animate themselves as they're drawn (no update call needed).
// Shared by the game (first person, the Anvil's sockets, Pit's bench) and the
// trailer. Frame: the haft runs along +Z (the butt at z -0.22, the head's
// centre at z 0.82); `grip` marks where the other hand goes.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';
import { loadModel } from './gltfLite.js';
import { CONFIG } from '../config.js';

export const HAMMER_COLORS = { fire: '#ff6a1a', ice: '#8fe4ff', wind: '#d8f0e0', lightning: '#b98aff' };
const LOOK = () => CONFIG.crust.hammers.look;

// The effects' clock: wall time, unless something (the trailer's renderer) drives it.
export const hammerClock = { t: null };
const now = () => (hammerClock.t != null ? hammerClock.t : performance.now() / 1000);

// a bright line fading out to its edges (v across the ribbon)
function streakTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.35, 'rgba(200,170,255,0.5)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)');
  gr.addColorStop(0.65, 'rgba(200,170,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// a tongue of flame: round and bright at the bottom, licking to a point at the top
function flameTexture() {
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S - 0.5, v = 1 - (y + 0.5) / S;          // v: 0 bottom, 1 top
    const w = 0.42 * Math.pow(Math.max(0, 1 - v), 0.7) * Math.min(1, (v + 0.12) * 3);
    const k = w > 0 ? Math.max(0, 1 - Math.abs(u) / w) : 0;
    const a = Math.pow(k, 1.3) * Math.min(1, (1 - v) * 1.6);
    const i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

let shared = null;
function mats() {
  if (shared) return shared;
  shared = {
    iron: new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.45, metalness: 0.85 }),
    darkIron: new THREE.MeshStandardMaterial({ color: '#17171a', roughness: 0.5, metalness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.8 }),
    leather: new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.9 }),
    dot: T.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
    streak: streakTexture(),
    flame: flameTexture(),
  };
  return shared;
}

// ---------------------------------------------------------------------------
// The model, turned and sized once into the hammer's frame: the haft's long
// axis onto +Z (head end up), the head's long axis onto X.
// ---------------------------------------------------------------------------
let template = null;
function hammerModel() {
  if (!template) template = loadModel(LOOK().model).then((g) => (g ? prepModel(g.scene) : null)).catch(() => null);
  return template;
}

function pointsOf(mesh) {
  const out = [], P = mesh.geometry.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) out.push(v.fromBufferAttribute(P, i).applyMatrix4(mesh.matrixWorld).clone());
  return out;
}
// principal axis of a cloud of points (power iteration on its covariance)
function mainAxis(pts) {
  const m = new THREE.Vector3();
  for (const p of pts) m.add(p);
  m.divideScalar(pts.length);
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of pts) {
    const d = [p.x - m.x, p.y - m.y, p.z - m.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] += d[i] * d[j];
  }
  let a = new THREE.Vector3(0.3, 1, 0.2).normalize();
  for (let k = 0; k < 40; k++) a = new THREE.Vector3(C[0] * a.x + C[1] * a.y + C[2] * a.z, C[3] * a.x + C[4] * a.y + C[5] * a.z, C[6] * a.x + C[7] * a.y + C[8] * a.z).normalize();
  return { mean: m, axis: a };
}

function prepModel(scene) {
  const src = scene.clone(true);
  src.updateMatrixWorld(true);
  let haft = null, head = null;
  src.traverse((o) => {
    if (!o.isMesh) return;
    if (/^Cylinder_/.test(o.name)) haft = o;
    if (/^Cube/.test(o.name)) head = o;
    o.castShadow = true;
    if (o.material) {
      o.material = o.material.clone();
      if (o.material.roughness !== undefined) o.material.roughness = Math.max(0.4, o.material.roughness);
    }
  });
  if (!haft || !head) return null;
  const H = mainAxis(pointsOf(haft)), K = mainAxis(pointsOf(head));
  const z = H.axis.clone();
  if (K.mean.clone().sub(H.mean).dot(z) < 0) z.negate();
  let x = K.axis.clone().addScaledVector(z, -K.axis.dot(z)).normalize();
  // (a bevelled block's points don't give its axis exactly: turn x round the haft
  // to where the head is thinnest across)
  const kw = pointsOf(head);
  let best = Infinity, bx = x;
  for (let d = -30; d <= 30; d += 0.5) {
    const xa = x.clone().applyAxisAngle(z, d * Math.PI / 180), ya = new THREE.Vector3().crossVectors(z, xa);
    let lo = Infinity, hi = -Infinity;
    for (const q of kw) { const v = q.dot(ya); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (hi - lo < best) { best = hi - lo; bx = xa; }
  }
  x = bx;
  const y = new THREE.Vector3().crossVectors(z, x);
  const toFrame = new THREE.Matrix4().makeBasis(x, y, z).invert();
  // where the haft and head land in that frame
  const inFrame = (p) => p.clone().applyMatrix4(toFrame);
  const hp = pointsOf(haft).map(inFrame), kp = pointsOf(head).map(inFrame);
  const buttZ = Math.min(...hp.map((p) => p.z));
  const hb = new THREE.Box3().setFromPoints(kp), hc = hb.getCenter(new THREE.Vector3());
  const L = LOOK();
  const s = (L.headAt - L.butt) / (hc.z - buttZ);
  const axisXY = inFrame(H.mean);
  const holder = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(src);
  inner.quaternion.setFromRotationMatrix(toFrame);
  inner.scale.setScalar(s);
  inner.position.set(-axisXY.x * s, -axisXY.y * s, L.butt - buttZ * s);
  holder.add(inner);
  const size = hb.getSize(new THREE.Vector3()).multiplyScalar(s);
  return { group: holder, headSize: size, headOffset: new THREE.Vector3((hc.x - axisXY.x) * s, (hc.y - axisXY.y) * s, 0) };
}

// ---------------------------------------------------------------------------
// The element going off round the head
// ---------------------------------------------------------------------------
const frac = (v) => v - Math.floor(v);
const hash = (i, k) => frac(Math.sin(i * 127.1 + k * 311.7) * 43758.5453);
const _m = new THREE.Matrix4(), _up = new THREE.Vector3(), _s = new THREE.Vector3();

function pointsLayer(n, size, dot) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const mat = new THREE.PointsMaterial({ size, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.size = size;
  return pts;
}

// One step of the effect per frame, whoever draws first (the same hammer can
// be in a frame twice: the viewmodel and its shadow).
function onDraw(obj, tick) {
  let last = -1;
  obj.onBeforeRender = (renderer, scene, camera) => {
    const t = now();
    if (t === last) return;
    const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, t - last));
    last = t;
    obj.updateMatrixWorld();
    _m.copy(obj.matrixWorld);
    _s.setFromMatrixScale(_m);
    const scale = (_s.x + _s.y + _s.z) / 3 || 1;
    _up.set(0, 1, 0).transformDirection(_m.clone().invert());   // world up, in the head's own frame
    tick(t, dt, _up, scale, camera);
  };
}

function elementFx(el, H, dims) {
  const L = LOOK(), F = L[el], M = mats();
  const fx = new THREE.Group(); fx.name = 'hammerFx';
  const st = { power: 1, color: H.color.clone(), base: H.glowMat.color.clone() };
  const hw = dims.x / 2, hh = dims.y / 2, hd = dims.z / 2;
  const maxK = L.temperedPower;
  const cap = (n) => Math.ceil(n * maxK);
  const count = (n) => Math.min(cap(n), Math.round(n * st.power));
  const inBox = (i, k, out) => out.set((hash(i, k) - 0.5) * 2 * hw * 0.95, (hash(i, k + 1) - 0.5) * 2 * hh * 0.9, (hash(i, k + 2) - 0.5) * 2 * hd * 0.9);
  const p = new THREE.Vector3(), c = new THREE.Color(), side = new THREE.Vector3();
  const sizeTo = (layer, scale, k = 1) => { layer.material.size = layer.userData.size * scale * k * (0.75 + 0.25 * st.power); };

  if (el === 'fire') {
    const flames = pointsLayer(cap(F.flames), F.flameSize, M.flame), embers = pointsLayer(cap(F.embers), F.emberSize, M.dot);
    fx.add(flames, embers);
    const hot = new THREE.Color('#fff2c0'), mid = new THREE.Color('#ff8a1a'), deep = new THREE.Color('#b0200a');
    onDraw(flames, (t, dt, up, scale) => {
      const rise = F.rise * (0.8 + 0.2 * st.power) / scale;
      side.set(1, 0, 0).addScaledVector(up, -up.x).normalize();
      const n = count(F.flames), P = flames.geometry.attributes.position, C = flames.geometry.attributes.color;
      for (let i = 0; i < P.count; i++) {
        if (i >= n) { C.setXYZ(i, 0, 0, 0); continue; }
        const ph = frac(t * F.rate * (0.8 + 0.5 * hash(i, 9)) + hash(i, 4));
        inBox(i, 1, p);
        // (from the iron's upper face, whichever way the hammer's held)
        const top = hw * Math.abs(up.x) + hh * Math.abs(up.y) + hd * Math.abs(up.z);
        p.addScaledVector(up, top * (0.75 + 0.2 * hash(i, 6)) - p.dot(up));
        p.addScaledVector(up, rise * ph * (0.7 + 0.6 * hash(i, 5)));
        p.addScaledVector(side, Math.sin(t * 9 + i * 1.7) * 0.02 / scale * ph);
        P.setXYZ(i, p.x, p.y, p.z);
        if (ph < 0.3) c.copy(hot).lerp(mid, ph / 0.3); else c.copy(mid).lerp(deep, (ph - 0.3) / 0.7);
        if (st.power > 1) c.lerp(st.color, 0.35);
        c.multiplyScalar(Math.pow(1 - ph, 1.4) * (ph < 0.08 ? ph / 0.08 : 1) * 0.9);
        C.setXYZ(i, c.r, c.g, c.b);
      }
      P.needsUpdate = C.needsUpdate = true;
      sizeTo(flames, scale);
      H.glowMat.color.copy(st.base).multiplyScalar(1 + (Math.sin(t * 23) * 0.5 + Math.sin(t * 37) * 0.5) * F.flicker);
    });
    onDraw(embers, (t, dt, up, scale) => {
      const n = count(F.embers), P = embers.geometry.attributes.position, C = embers.geometry.attributes.color;
      for (let i = 0; i < P.count; i++) {
        if (i >= n) { C.setXYZ(i, 0, 0, 0); continue; }
        const ph = frac(t * F.rate * 0.45 * (0.7 + 0.6 * hash(i, 19)) + hash(i, 14));
        inBox(i, 21, p);
        p.addScaledVector(up, F.rise * 2.4 * ph / scale);
        p.x += Math.sin(t * 2 + i) * 0.08 * ph / scale; p.z += Math.cos(t * 1.7 + i * 2) * 0.08 * ph / scale;
        P.setXYZ(i, p.x, p.y, p.z);
        c.copy(mid).lerp(hot, hash(i, 30) * 0.5).multiplyScalar((1 - ph) * (0.6 + 0.4 * Math.sin(t * 30 + i * 3)) * 2);
        C.setXYZ(i, c.r, c.g, c.b);
      }
      P.needsUpdate = C.needsUpdate = true;
      sizeTo(embers, scale);
    });
  } else if (el === 'ice') {
    const mist = pointsLayer(cap(F.mist), F.mistSize, M.dot), flakes = pointsLayer(cap(F.flakes), F.flakeSize, M.dot);
    fx.add(mist, flakes);
    const pale = new THREE.Color('#bfefff'), white = new THREE.Color('#ffffff');
    onDraw(mist, (t, dt, up, scale) => {
      const n = count(F.mist), P = mist.geometry.attributes.position, C = mist.geometry.attributes.color;
      // a ring round the head, in the plane across world up
      const a1 = new THREE.Vector3(1, 0, 0).addScaledVector(up, -up.x).normalize(), a2 = new THREE.Vector3().crossVectors(up, a1);
      for (let i = 0; i < P.count; i++) {
        if (i >= n) { C.setXYZ(i, 0, 0, 0); continue; }
        const ph = frac(t * F.rate * (0.7 + 0.6 * hash(i, 3)) + hash(i, 2));
        const ang = t * 0.9 * (hash(i, 6) < 0.5 ? 1 : -1) + i * 2.399;
        const r = (Math.max(hw, hh) * 0.9 + F.orbit * (0.4 + 0.6 * hash(i, 7)) / scale);
        p.set(0, 0, 0).addScaledVector(a1, Math.cos(ang) * r).addScaledVector(a2, Math.sin(ang) * r * 0.6).addScaledVector(up, hh * 0.6 - F.sink * ph / scale);
        P.setXYZ(i, p.x, p.y, p.z);
        c.copy(pale).multiplyScalar(Math.sin(Math.PI * ph) * F.mistGlow);
        if (st.power > 1) c.lerp(st.color, 0.3);
        C.setXYZ(i, c.r, c.g, c.b);
      }
      P.needsUpdate = C.needsUpdate = true;
      sizeTo(mist, scale);
    });
    onDraw(flakes, (t, dt, up, scale) => {
      const n = count(F.flakes), P = flakes.geometry.attributes.position, C = flakes.geometry.attributes.color;
      for (let i = 0; i < P.count; i++) {
        if (i >= n) { C.setXYZ(i, 0, 0, 0); continue; }
        const ph = frac(t * F.rate * 0.8 * (0.6 + 0.8 * hash(i, 13)) + hash(i, 12));
        inBox(i, 31, p);
        p.addScaledVector(up, -F.sink * 2 * ph / scale);
        p.x += Math.sin(t * 1.3 + i) * 0.04 * ph / scale;
        P.setXYZ(i, p.x, p.y, p.z);
        const tw = 0.5 + 0.5 * Math.sin(t * 11 + i * 5.1);
        c.copy(white).lerp(pale, hash(i, 40)).multiplyScalar((1 - ph) * (0.4 + tw) * 1.6);
        C.setXYZ(i, c.r, c.g, c.b);
      }
      P.needsUpdate = C.needsUpdate = true;
      sizeTo(flakes, scale);
      H.glowMat.color.copy(st.base).multiplyScalar(0.85 + 0.15 * Math.sin(t * 2.2));
    });
  } else if (el === 'wind') {
    const motes = pointsLayer(cap(F.motes), F.size, M.dot);
    fx.add(motes);
    const ribbonMat = new THREE.MeshBasicMaterial({ color: H.color.clone().multiplyScalar(0.9), transparent: true, opacity: F.ribbonGlow, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const ribbons = [];
    for (let k = 0; k < F.ribbons + 1; k++) {
      const r = Math.max(hh, hd) * (1.35 + k * 0.28);
      const rb = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.025, 4, 40, Math.PI * (1.1 + 0.3 * k)), ribbonMat);
      rb.rotation.y = Math.PI / 2; rb.position.x = (k - F.ribbons / 2) * hw * 0.5;
      rb.visible = k < F.ribbons;
      rb.userData.k = k;
      fx.add(rb); ribbons.push(rb);
    }
    const green = new THREE.Color('#d8ffe8');
    onDraw(motes, (t, dt, up, scale) => {
      const n = count(F.motes), P = motes.geometry.attributes.position, C = motes.geometry.attributes.color;
      for (let i = 0; i < P.count; i++) {
        if (i >= n) { C.setXYZ(i, 0, 0, 0); continue; }
        const ph = frac(t * F.drift * (0.7 + 0.6 * hash(i, 2)) + hash(i, 1));
        const ang = t * F.spin * st.power * (0.8 + 0.4 * hash(i, 3)) + i * 2.399;
        const r = Math.max(hh, hd) * 1.1 + F.radius * (0.3 + 0.7 * hash(i, 4)) / scale * (0.6 + 0.4 * st.power);
        p.set((ph - 0.5) * 2 * hw * 1.3, Math.cos(ang) * r, Math.sin(ang) * r);
        P.setXYZ(i, p.x, p.y, p.z);
        c.copy(green).lerp(st.color, 0.4).multiplyScalar(Math.sin(Math.PI * ph) * 1.4);
        C.setXYZ(i, c.r, c.g, c.b);
      }
      P.needsUpdate = C.needsUpdate = true;
      sizeTo(motes, scale);
      for (const rb of ribbons) {
        rb.visible = rb.userData.k < F.ribbons + (st.power > 1 ? 1 : 0);
        rb.rotation.x = t * F.ribbonSpin * st.power * (rb.userData.k % 2 ? -1 : 1) + rb.userData.k;
      }
      ribbonMat.opacity = F.ribbonGlow * (0.75 + 0.25 * Math.sin(t * 6));
    });
  } else if (el === 'lightning') {
    // arcs: jagged polylines drawn as glowing ribbons turned to face the camera
    const nSeg = cap(F.arcs) * F.segs;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nSeg * 4 * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nSeg * 4 * 2), 2));
    const idx = [];
    for (let i = 0; i < nSeg; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3);
    geo.setIndex(idx);
    const arcMat = new THREE.MeshBasicMaterial({ map: M.streak, color: new THREE.Color('#ead8ff').multiplyScalar(2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const arcs = new THREE.Mesh(geo, arcMat);
    arcs.frustumCulled = false;
    const sparks = pointsLayer(cap(F.sparks), F.sparkSize, M.dot);
    fx.add(arcs, sparks);
    let next = 0, seed = 0;
    const onFace = (k, out) => {
      // a point on the head's surface
      inBox(k, 50, out);
      const f = Math.floor(hash(k, 60) * 3);
      if (f === 0) out.x = Math.sign(out.x || 1) * hw; else if (f === 1) out.y = Math.sign(out.y || 1) * hh; else out.z = Math.sign(out.z || 1) * hd;
      return out;
    };
    const a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Vector3();
    const lines = [];   // each arc's points
    const camL = new THREE.Vector3(), d = new THREE.Vector3(), toCam = new THREE.Vector3(), wv = new THREE.Vector3(), mid = new THREE.Vector3();
    onDraw(arcs, (t, dt, up, scale, camera) => {
      if (!(t < next && t >= next - F.every * 2)) {
        next = t + F.every * (0.6 + 0.8 * Math.random());
        seed++;
        lines.length = 0;
        for (let k = 0; k < count(F.arcs); k++) {
          onFace(seed * 7 + k, a);
          b.copy(a).normalize().multiplyScalar(F.reach * (0.5 + 0.5 * Math.random()) * (0.8 + 0.2 * st.power) / scale).add(a);
          b.x += (Math.random() - 0.5) * 0.12 / scale; b.y += (Math.random() - 0.5) * 0.12 / scale;
          const L = [a.clone()];
          for (let s = 1; s <= F.segs; s++) {
            q.lerpVectors(a, b, s / F.segs);
            if (s < F.segs) q.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.07 / scale));
            L.push(q.clone());
          }
          lines.push(L);
        }
        arcMat.opacity = 0.65 + 0.35 * Math.random();
        H.glowMat.color.copy(st.base).multiplyScalar(0.7 + Math.random() * 0.9);
      }
      // the ribbons face the camera every frame
      camL.set(0, 0, 0);
      if (camera) camL.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(_m.clone().invert());
      const P = geo.attributes.position, U = geo.attributes.uv, half = F.width / 2 / scale;
      let w = 0;
      for (const L of lines) for (let s = 0; s < L.length - 1; s++) {
        d.subVectors(L[s + 1], L[s]);
        mid.addVectors(L[s], L[s + 1]).multiplyScalar(0.5);
        toCam.subVectors(camL, mid);
        wv.crossVectors(d, toCam).normalize().multiplyScalar(half * (s === 0 ? 0.6 : 1));
        const wn = wv.clone().multiplyScalar(s + 1 === L.length - 1 ? 0.5 : 1);
        P.setXYZ(w * 4, L[s].x - wv.x, L[s].y - wv.y, L[s].z - wv.z); U.setXY(w * 4, 0, 0);
        P.setXYZ(w * 4 + 1, L[s].x + wv.x, L[s].y + wv.y, L[s].z + wv.z); U.setXY(w * 4 + 1, 0, 1);
        P.setXYZ(w * 4 + 2, L[s + 1].x - wn.x, L[s + 1].y - wn.y, L[s + 1].z - wn.z); U.setXY(w * 4 + 2, 1, 0);
        P.setXYZ(w * 4 + 3, L[s + 1].x + wn.x, L[s + 1].y + wn.y, L[s + 1].z + wn.z); U.setXY(w * 4 + 3, 1, 1);
        w++;
      }
      geo.setDrawRange(0, w * 6);
      P.needsUpdate = U.needsUpdate = true;
    });
    const violet = new THREE.Color('#d6b8ff');
    onDraw(sparks, (t, dt, up, scale) => {
      const n = count(F.sparks), P = sparks.geometry.attributes.position, C = sparks.geometry.attributes.color;
      for (let i = 0; i < P.count; i++) {
        if (i >= n) { C.setXYZ(i, 0, 0, 0); continue; }
        const ph = frac(t * 3.2 * (0.7 + 0.6 * hash(i, 8)) + hash(i, 9));
        const cyc = Math.floor(t * 3.2 * (0.7 + 0.6 * hash(i, 8)) + hash(i, 9));
        onFace(i * 13 + cyc * 101, p);
        p.multiplyScalar(1 + ph * 0.6);
        P.setXYZ(i, p.x, p.y, p.z);
        c.copy(violet).lerp(st.color, 0.4).multiplyScalar((1 - ph) * 2.2 * (Math.sin(t * 40 + i) > 0 ? 1 : 0.3));
        C.setXYZ(i, c.r, c.g, c.b);
      }
      P.needsUpdate = C.needsUpdate = true;
      sizeTo(sparks, scale);
    });
  }
  return {
    group: fx,
    setPower(k, color) {
      st.power = k;
      if (color) { st.color.set(color); st.base.copy(st.color).multiplyScalar(H.glowBoost); H.glowMat.color.copy(st.base); }
      if (H.headMat) { H.headMat.emissive.copy(st.color); H.headMat.emissiveIntensity = LOOK().headGlow * k; }
    },
  };
}

export function buildWarHammer(el, { halo = true, glow = 2.2, color = null, tempered = null } = {}) {
  const M = mats();
  const col = new THREE.Color(color || HAMMER_COLORS[el] || '#ffffff');
  const glowMat = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(glow), toneMapped: false });
  const g = new THREE.Group();
  const proc = [];
  const add = (geo, mat, x, y, z, parent = g, built = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); if (built) proc.push(m); return m; };
  // the built hammer (until the model's in): wood haft, leather grip, iron fittings
  add(new THREE.CylinderGeometry(0.022, 0.026, 1.0, 10).rotateX(Math.PI / 2), M.wood, 0, 0, 0.32);
  add(new THREE.CylinderGeometry(0.027, 0.027, 0.3, 10).rotateX(Math.PI / 2), M.leather, 0, 0, 0.0);
  for (let i = 0; i < 6; i++) add(new THREE.TorusGeometry(0.027, 0.003, 4, 12), M.darkIron, 0, 0, -0.13 + i * 0.05);
  add(new THREE.CylinderGeometry(0.032, 0.026, 0.06, 10).rotateX(Math.PI / 2), M.iron, 0, 0, -0.19);            // pommel
  add(new THREE.SphereGeometry(0.03, 10, 8), glowMat, 0, 0, -0.225, g, false);
  add(new THREE.CylinderGeometry(0.03, 0.024, 0.12, 10).rotateX(Math.PI / 2), M.iron, 0, 0, 0.7);               // throat
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.008, 0.05, 0.2), M.darkIron, s * 0.024, 0, 0.62);        // langets
  // the head (its centre); the element's iron work sits in `deco`, sized to the 0.34 x 0.17 x 0.17 built head
  const head = new THREE.Group(); head.position.z = LOOK().headAt; g.add(head);
  const deco = new THREE.Group(); head.add(deco);
  add(new THREE.BoxGeometry(0.34, 0.17, 0.17), M.iron, 0, 0, 0, head);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.04, 0.21, 0.21), M.darkIron, s * 0.185, 0, 0, head);              // striking faces
    add(new THREE.BoxGeometry(0.02, 0.175, 0.175), glowMat, s * 0.1, 0, 0, head);                  // glowing bands (the built head's)
    add(new THREE.BoxGeometry(0.012, 0.15, 0.15), glowMat, s * 0.207, 0, 0, head);                 // the faces' cores
  }
  const core = add(new THREE.OctahedronGeometry(0.05), glowMat, 0, 0.1, 0, deco, false);
  const D = (geo, mat, x, y, z) => add(geo, mat, x, y, z, deco, false);
  if (el === 'fire') {
    for (let i = 0; i < 5; i++) D(new THREE.ConeGeometry(0.018, 0.08 + (i % 2) * 0.04, 6), glowMat, -0.12 + i * 0.06, 0.12, 0).rotation.z = (i - 2) * 0.18;
  } else if (el === 'ice') {
    for (const [x, y, z, rz, rx, h] of [[0.06, 0.1, 0.05, 0.4, 0.3, 0.12], [-0.07, 0.11, -0.04, -0.3, -0.2, 0.1], [0.0, -0.1, 0.06, Math.PI - 0.2, 0.3, 0.09], [-0.05, 0.02, 0.1, 0.2, 1.3, 0.08], [0.05, -0.02, -0.1, -0.2, -1.3, 0.08]]) {
      D(new THREE.ConeGeometry(0.022, h, 4), glowMat, x, y, z).rotation.set(rx, 0, rz);
    }
  } else if (el === 'wind') {
    for (const s of [-1, 1]) {
      D(new THREE.BoxGeometry(0.004, 0.13, 0.09), M.iron, 0, 0.12, s * 0.05).rotation.x = s * 0.5;
      D(new THREE.BoxGeometry(0.006, 0.12, 0.012), glowMat, 0, 0.13, s * 0.09).rotation.x = s * 0.5;
    }
  } else if (el === 'lightning') {
    for (const s of [-1, 0, 1]) {
      D(new THREE.BoxGeometry(0.012, 0.12, 0.012), s ? M.iron : glowMat, s * 0.07, 0.14, 0).rotation.z = -s * 0.35;
      D(new THREE.SphereGeometry(0.012, 6, 5), glowMat, s * 0.09, 0.2, 0);
    }
  }
  let haloSprite = null;
  if (halo) {
    haloSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.dot, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    haloSprite.scale.setScalar(0.7); head.add(haloSprite);
  }
  const grip = new THREE.Object3D(); grip.position.z = 0.3; g.add(grip);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  const H = { group: g, head, grip, core, glowMat, halo: haloSprite, color: col, glowBoost: glow, fx: null };
  // the element round the built head first; again round the model's when it's in
  let fx = elementFx(el, H, new THREE.Vector3(0.34, 0.17, 0.17));
  head.add(fx.group);
  H.fx = fx;
  let power = 1, powerColor = null;
  H.temper = (upColor) => { power = upColor ? LOOK().temperedPower : 1; powerColor = upColor || HAMMER_COLORS[el]; H.fx.setPower(power, powerColor); };
  if (tempered) H.temper(tempered);
  hammerModel().then((T0) => {
    if (!T0) return;
    const m = T0.group.clone(true);
    g.add(m);
    // the head's iron lit from inside by its element (its own copy of the material)
    m.traverse((o) => {
      if (!o.isMesh || !/^Cube/.test(o.name)) return;
      o.material = o.material.clone();
      o.material.emissive = col.clone();
      o.material.emissiveIntensity = LOOK().headGlow;
      H.headMat = o.material;
    });
    for (const o of proc) o.visible = false;
    head.position.set(T0.headOffset.x, T0.headOffset.y, LOOK().headAt);
    const hs = T0.headSize;
    deco.scale.set(hs.x / 0.34, hs.y / 0.17, hs.z / 0.17);
    if (haloSprite) haloSprite.scale.setScalar(Math.max(hs.x, 0.34) * 2);
    head.remove(fx.group);
    fx = elementFx(el, H, hs);
    head.add(fx.group);
    H.fx = fx;
    fx.setPower(power, powerColor);
  });
  return H;
}
