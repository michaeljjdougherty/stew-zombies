// =============================================================================
// What "The Final Whistle" looks like: the main breakers, the trophy pieces and
// stand, the trapdoor the Mad Dog Machine comes up through, the mascot statue
// waking up, soul wisps, the Dark Schnitz Coin, the altar under the Press Box,
// the cladding grinding up, Erik in his booth, the Chopper's parts and the
// workbench in the boiler room, and the booth's glass cracking under the blasts.
//
// Reads sim.quest; never changes it.
// =============================================================================
import * as THREE from 'three';
import { trophyParts } from './propModels.js';
import * as T from './textures.js';
import { buildCharacter, idleCharacter } from './characters.js';
import { PRESS_BOX } from './storyProps.js';
import { buildGun } from './gunModels.js';

const GOLD = () => new THREE.MeshStandardMaterial({ color: '#d8ac3c', roughness: 0.22, metalness: 1, emissive: new THREE.Color(0.25, 0.16, 0.02), emissiveIntensity: 0.6 });

function labelTexture(top, bottom, { bg = '#d4a514', fg = '#111' } = {}) {
  const [c, g] = T.makeCanvas(256, 128);
  g.fillStyle = bg; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(4, 4, 248, 120);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 34px Impact, "Arial Black", sans-serif'; g.fillText(top, 128, 46, 232);
  g.font = '700 24px "Arial Narrow", Arial, sans-serif'; g.fillText(bottom, 128, 92, 232);
  return T.toTexture(c, { repeat: false });
}

function sigilTexture() {
  const S = 512;
  const [c, g] = T.makeCanvas(S, S);
  g.fillStyle = '#1c1a18'; g.fillRect(0, 0, S, S);
  // carved: a basketball's seams turned into a summoning circle
  g.strokeStyle = 'rgba(120,255,140,0.95)'; g.lineWidth = 7; g.shadowColor = '#5f5'; g.shadowBlur = 14;
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.42, 0, 7); g.stroke();
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.3, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(S * 0.08, S / 2); g.lineTo(S * 0.92, S / 2); g.moveTo(S / 2, S * 0.08); g.lineTo(S / 2, S * 0.92); g.stroke();
  g.beginPath(); g.arc(S * 0.08, S / 2, S * 0.36, -0.95, 0.95); g.stroke();
  g.beginPath(); g.arc(S * 0.92, S / 2, S * 0.36, Math.PI - 0.95, Math.PI + 0.95); g.stroke();
  g.font = '700 30px Georgia, serif'; g.fillStyle = 'rgba(140,255,150,0.9)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const runes = 'ᚦᛟᛞᚱᛉᛗᚾᛋ8ᛏᚹᛚᛃᛈ';
  for (let i = 0; i < runes.length; i++) {
    const a = (i / runes.length) * Math.PI * 2;
    g.fillText(runes[i], S / 2 + Math.cos(a) * S * 0.36, S / 2 + Math.sin(a) * S * 0.36);
  }
  return T.toTexture(c, { repeat: false });
}

function coinTexture() {
  const S = 256;
  const [c, g] = T.makeCanvas(S, S);
  g.fillStyle = '#20241e'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#7dff8c'; g.lineWidth = 8; g.beginPath(); g.arc(S / 2, S / 2, S * 0.42, 0, 7); g.stroke();
  g.font = '900 120px Impact, "Arial Black", sans-serif'; g.fillStyle = '#7dff8c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('S', S / 2, S / 2 + 6);
  return T.toTexture(c, { repeat: false });
}

function basketballTexture(drained) {
  const W = 512, H = 256;
  const [c, g] = T.makeCanvas(W, H);
  g.fillStyle = drained ? '#5a5650' : '#d2691e'; g.fillRect(0, 0, W, H);
  // pebbled
  let s = 5; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  g.fillStyle = drained ? 'rgba(0,0,0,0.12)' : 'rgba(80,30,5,0.18)';
  for (let i = 0; i < 2500; i++) g.fillRect(r() * W, r() * H, 2, 2);
  g.strokeStyle = '#141210'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  for (const x of [W * 0.25, W * 0.75]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (const x of [0, W / 2, W]) { g.beginPath(); g.ellipse(x, H / 2, W * 0.12, H * 0.5, 0, -Math.PI / 2, Math.PI / 2); g.stroke(); g.beginPath(); g.ellipse(x, H / 2, W * 0.12, H * 0.5, 0, Math.PI / 2, Math.PI * 1.5); g.stroke(); }
  return T.toTexture(c);
}

function statLabelTexture(text) {
  const [c, g] = T.makeCanvas(512, 128);
  g.clearRect(0, 0, 512, 128);
  g.font = '900 86px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(140,255,150,0.9)'; g.fillText(text.toUpperCase(), 256, 66, 490);
  return T.toTexture(c, { repeat: false });
}

// One of Erik's playbook diagrams, painted on the floor in red.
function playMesh(zn) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.08, 0.05), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  if (zn.shape === 'O') {
    const m = new THREE.Mesh(new THREE.RingGeometry(zn.r - 0.35, zn.r, 48).rotateX(-Math.PI / 2), mat);
    m.position.set(zn.x, 0.012, zn.z); g.add(m);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(zn.r - 0.35, 48).rotateX(-Math.PI / 2), mat.clone());
    fill.position.set(zn.x, 0.011, zn.z); fill.userData.fill = true; g.add(fill);
  } else {
    for (const s of zn.segs) {
      const L = Math.hypot(s[2] - s[0], s[3] - s[1]);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(L + zn.w * 0.6, zn.w).rotateX(-Math.PI / 2), mat);
      m.position.set((s[0] + s[2]) / 2, 0.012, (s[1] + s[3]) / 2);
      m.rotation.y = -Math.atan2(s[3] - s[1], s[2] - s[0]);
      g.add(m);
    }
  }
  g.userData.mat = mat;
  return g;
}

function speakerFaceTexture() {
  const [c, g] = T.makeCanvas(256, 512);
  g.fillStyle = '#141414'; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = '#2a2a2a'; g.lineWidth = 4; g.strokeRect(6, 6, 244, 500);
  for (const [y, r] of [[120, 92], [330, 92], [460, 34]]) {
    const grd = g.createRadialGradient(128, y, 4, 128, y, r);
    grd.addColorStop(0, '#3a3a3a'); grd.addColorStop(0.25, '#0c0c0c'); grd.addColorStop(0.85, '#1e1e1e'); grd.addColorStop(1, '#4a4a4a');
    g.fillStyle = grd; g.beginPath(); g.arc(128, y, r, 0, 7); g.fill();
  }
  return T.toTexture(c, { repeat: false });
}

// --- trophy pieces -------------------------------------------------------------
function trophyPart(id, mat) {
  const g = new THREE.Group();
  if (id === 'cup' || id === 'all') {
    const pts = [];
    for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new THREE.Vector2(0.03 + Math.sin(k * Math.PI * 0.55) * 0.13 + k * 0.02, k * 0.26)); }
    const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), mat); cup.position.y = id === 'all' ? 0.2 : 0; g.add(cup);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.1, 10), mat); stem.position.y = (id === 'all' ? 0.2 : 0) - 0.04; g.add(stem);
  }
  if (id === 'handles' || id === 'all') {
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.013, 6, 14, Math.PI * 1.2), mat);
      h.position.set(s * 0.15, (id === 'all' ? 0.2 : 0) + 0.15, 0); h.rotation.z = s > 0 ? -Math.PI * 0.6 : Math.PI * 1.6;
      g.add(h);
    }
  }
  if (id === 'plinth' || id === 'all') {
    const wood = new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.45 });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.24), wood); b1.position.y = 0.035; g.add(b1);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.18), wood); b2.position.y = 0.105; g.add(b2);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.04), mat); plate.position.set(0, 0.035, 0.121); g.add(plate);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), mat); ball.position.y = id === 'all' ? 0.15 : 0.175; g.add(ball);
  }
  return g;
}

// --- the Chopper's parts ----------------------------------------------------------
let chopperMats = null;
function choppersMats() {
  if (chopperMats) return chopperMats;
  chopperMats = {
    red: new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.45, metalness: 0.3 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#e8b81a', roughness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.4, metalness: 0.8 }),
    steel: new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.28, metalness: 1 }),
    black: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.6 }),
  };
  return chopperMats;
}
// Each part at the gun's own size, resting on y = 0.
function chopperPart(id) {
  const M = choppersMats();
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  if (id === 'motor') {
    add(new THREE.CylinderGeometry(0.042, 0.042, 0.12, 16).rotateZ(Math.PI / 2), M.dark, 0, 0.046, 0);
    for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.047, 0.047, 0.006, 18).rotateZ(Math.PI / 2), M.steel, -0.045 + i * 0.018, 0.046, 0);
    add(new THREE.CylinderGeometry(0.01, 0.01, 0.07, 8).rotateZ(Math.PI / 2), M.black, 0.02, 0.09, 0.025);
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8).rotateZ(Math.PI / 2), M.steel, 0.075, 0.046, 0);
  } else if (id === 'blade') {
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.005, 28), M.steel, 0, 0.004, 0);
    add(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 10), M.dark, 0, 0.008, 0);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const t = add(new THREE.BoxGeometry(0.016, 0.005, 0.012), M.steel, Math.cos(a) * 0.095, 0.004, Math.sin(a) * 0.095);
      t.rotation.y = -a + 0.5;
    }
  } else if (id === 'housing') {
    add(new THREE.BoxGeometry(0.075, 0.095, 0.3), M.red, 0, 0.048, 0);
    for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(0.077, 0.018, 0.02), i % 2 ? M.black : M.yellow, 0, 0.012, -0.1 + i * 0.022);
    add(new THREE.BoxGeometry(0.07, 0.03, 0.06), M.red, 0, 0.11, -0.11);
    add(new THREE.BoxGeometry(0.072, 0.006, 0.06), M.yellow, 0, 0.127, -0.11);
  } else if (id === 'grip') {
    add(new THREE.BoxGeometry(0.03, 0.1, 0.04), M.black, 0, 0.05, 0).rotation.x = -0.25;
    add(new THREE.BoxGeometry(0.008, 0.03, 0.012), M.dark, 0, 0.09, -0.03);
    add(new THREE.BoxGeometry(0.012, 0.012, 0.15), M.black, 0, 0.11, -0.05);
    add(new THREE.BoxGeometry(0.01, 0.03, 0.01), M.black, 0, 0.095, -0.12);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

// The plans on the workbench: the Chopper, its four parts circled.
function blueprintTexture() {
  const [c, g] = T.makeCanvas(512, 320);
  g.fillStyle = '#1d4f8a'; g.fillRect(0, 0, 512, 320);
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1;
  for (let x = 0; x < 512; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 320); g.stroke(); }
  for (let y = 0; y < 320; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.strokeStyle = '#e8f2ff'; g.lineWidth = 3;
  g.strokeRect(120, 120, 230, 70);                                    // housing
  g.beginPath(); g.arc(90, 112, 46, 0, 7); g.stroke();                 // blade
  g.strokeRect(350, 130, 70, 52);                                      // motor
  g.beginPath(); g.moveTo(250, 190); g.lineTo(240, 260); g.lineTo(275, 260); g.lineTo(285, 190); g.stroke();   // grip
  g.setLineDash([6, 6]); g.strokeStyle = '#ffd23a';
  for (const [x, y, r] of [[90, 112, 60], [235, 155, 80], [385, 156, 50], [262, 228, 42]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); }
  g.setLineDash([]);
  g.fillStyle = '#e8f2ff'; g.font = '900 30px Impact, "Arial Black", sans-serif'; g.textAlign = 'left';
  g.fillText('THE CHOPPER', 18, 300);
  g.font = '700 16px "Courier New", monospace';
  g.fillText('MOTOR · BLADE · HOUSING · GRIP', 230, 300);
  return T.toTexture(c, { repeat: false });
}

// Cracks spreading over the booth's glass, one more burst per blast.
function crackTexture(level) {
  const S = 512;
  const [c, g] = T.makeCanvas(S, S);
  g.clearRect(0, 0, S, S);
  let seed = 77;
  const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const hits = [[0.32, 0.45], [0.68, 0.38], [0.5, 0.62], [0.2, 0.7], [0.8, 0.66]].slice(0, level + 1);
  g.strokeStyle = 'rgba(235,250,255,0.95)'; g.lineCap = 'round';
  for (const [hx, hy] of hits) {
    const x0 = hx * S, y0 = hy * S;
    const spokes = 9 + Math.floor(r() * 5);
    for (let i = 0; i < spokes; i++) {
      let a = (i / spokes) * Math.PI * 2 + r() * 0.4, x = x0, y = y0;
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(x, y);
      const len = 60 + r() * 150 * (0.6 + level * 0.25);
      for (let d = 0; d < len; d += 14) { a += (r() - 0.5) * 0.5; x += Math.cos(a) * 14; y += Math.sin(a) * 14; g.lineTo(x, y); }
      g.stroke();
    }
    // rings round the impact
    g.lineWidth = 3.5;
    for (const rr of [18, 36, 58]) { g.beginPath(); for (let k = 0; k <= 14; k++) { const a = (k / 14) * Math.PI * 2; const q = rr * (0.8 + r() * 0.4); g[k ? 'lineTo' : 'moveTo'](x0 + Math.cos(a) * q, y0 + Math.sin(a) * q); } g.stroke(); }
    g.fillStyle = 'rgba(235,250,255,0.75)'; g.beginPath(); g.arc(x0, y0, 16, 0, 7); g.fill();
  }
  return T.toTexture(c, { repeat: false });
}

export class QuestView {
  constructor(scene, sim, cfg, mapView) {
    this.scene = scene;
    this.sim = sim;
    this.cfg = cfg;
    this.map = mapView;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.time = 0;
    const Q = sim.world.quest;
    this.Q = Q;
    if (!Q) return;
    const metal = mapView.mats.metal;
    const add = (geo, mat, x, y, z, p = this.group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); p.add(m); return m; };
    this.halo = T.softDotTexture('rgba(255,220,120,0.9)', 'rgba(255,200,80,0)');

    // --- breakers
    this.breakers = Q.breakers.map((b) => {
      const g = new THREE.Group();
      g.position.set(b.pos.x, b.pos.y, b.pos.z);
      g.rotation.y = Math.atan2(b.normal.x, b.normal.z);
      this.group.add(g);
      add(new THREE.BoxGeometry(0.7, 1.0, 0.2), metal, 0, 0, 0.1, g);
      const lbl = add(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({ map: labelTexture('MAIN BREAKER', b.label.toUpperCase()), roughness: 0.7 }), 0, 0.3, 0.205, g);
      void lbl;
      const pivot = new THREE.Group(); pivot.position.set(0, -0.1, 0.22); g.add(pivot);
      add(new THREE.BoxGeometry(0.06, 0.36, 0.06), new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.6, roughness: 0.4 }), 0, 0.15, 0.03, pivot);
      add(new THREE.BoxGeometry(0.22, 0.07, 0.09), new THREE.MeshStandardMaterial({ color: '#b02018', roughness: 0.5 }), 0, 0.33, 0.04, pivot);
      pivot.rotation.x = 0.55;
      const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.15, 0.1) });
      add(new THREE.SphereGeometry(0.035, 10, 8), lampMat, 0.24, -0.36, 0.21, g);
      return { b, pivot, lampMat, thrown: 0 };
    });

    // --- trophy pieces where they lie
    const gold = GOLD();
    this.goldMat = gold;
    this.pieces = Q.trophyPieces.map((t) => {
      const g = trophyPart(t.id, gold);
      g.position.set(t.x, t.y, t.z);
      g.scale.setScalar(t.id === 'plinth' ? 1.2 : 1.1);
      this.group.add(g);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.halo, color: 0xffd070, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(0.6); halo.position.set(t.x, t.y + 0.15, t.z);
      this.group.add(halo);
      return { t, g, halo };
    });

    // --- trophy stand at center court, the trapdoor next to it
    const ts = Q.trophyStand;
    this.stand = new THREE.Group();
    this.group.add(this.stand);
    const wood = new THREE.MeshStandardMaterial({ color: '#3a2414', roughness: 0.5 });
    add(new THREE.BoxGeometry(0.84, 1.0, 0.84), wood, 0, 0.5, 0, this.stand);
    add(new THREE.BoxGeometry(0.92, 0.06, 0.92), gold, 0, 1.03, 0, this.stand);
    add(new THREE.PlaneGeometry(0.5, 0.18), new THREE.MeshStandardMaterial({ map: labelTexture('STATE CHAMPIONS', 'STEW LEONARDS', { bg: '#c9a54e' }), roughness: 0.5 }), 0, 0.72, 0.421, this.stand);
    this.trophy = trophyPart('all', gold);
    this.trophy.position.y = 1.06;
    this.trophy.scale.setScalar(1.6);
    this.trophy.visible = false;
    this.stand.add(this.trophy);
    // the real trophy model: the pieces and the rebuilt one
    trophyParts().then((T) => {
      if (!T) return;
      for (const pc of this.pieces) {
        const m = T[pc.t.id].clone(true);
        for (const c of [...pc.g.children]) c.visible = false;
        m.scale.setScalar(1 / pc.g.scale.x);   // the model is already life size
        pc.g.add(m);
      }
      for (const c of [...this.trophy.children]) c.visible = false;
      const all = T.all.clone(true); all.scale.setScalar(1.45 / this.trophy.scale.x);
      this.trophy.position.y = 1.06; this.trophy.add(all);
    });
    this.stand.position.set(ts.x, 0, ts.z);
    // the trapdoor: two steel leaves set in the floor
    const md = sim.world.madDog;
    this.trap = new THREE.Group(); this.trap.position.set(md.x, 0.006, md.z); this.group.add(this.trap);
    const pit = add(new THREE.PlaneGeometry(2.7, 2.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#030303' }), 0, 0.001, 0, this.trap);
    pit.visible = false; this.pit = pit;
    const leafMat = new THREE.MeshStandardMaterial({ map: T.metalTexture({ color: '#3a3a36', rust: 0.4 }), roughness: 0.5, metalness: 0.6 });
    this.leaves = [-1, 1].map((s) => {
      const hinge = new THREE.Group(); hinge.position.set(s * 1.35, 0, 0); this.trap.add(hinge);
      add(new THREE.BoxGeometry(1.35, 0.03, 2.5), leafMat, -s * 0.675, 0.0, 0, hinge);
      return { hinge, s };
    });

    // --- the mascot statue (built by storyProps) wakes up
    this.mascot = mapView.story && mapView.story.mascot;
    if (this.mascot) {
      this.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.0, 0.0) });
      for (const e of this.mascot.eyes) e.material = this.eyeMat;
      const S = Q.statue;
      this.baseGlow = add(new THREE.RingGeometry(1.2, 2.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.4, 0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), S.x, 0.63, S.z);
    }
    this.wisps = [];
    this.wispTex = T.softDotTexture('rgba(150,255,160,1)', 'rgba(60,255,90,0)');

    // --- the Dark Schnitz Coin
    const coinMat = new THREE.MeshStandardMaterial({ map: coinTexture(), emissive: new THREE.Color(0.5, 2.5, 0.6), emissiveMap: coinTexture(), emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.8 });
    this.coin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 24).rotateX(Math.PI / 2), coinMat);
    this.coin.visible = false;
    this.group.add(this.coin);

    // --- the altar under the Press Box
    const al = Q.altar;
    const stone = new THREE.MeshStandardMaterial({ map: T.toTexture(T.noiseCanvas(256, 5, 5)), color: '#3a3632', roughness: 0.9 });
    this.sigilMat = new THREE.MeshStandardMaterial({ map: sigilTexture(), emissive: new THREE.Color(1, 1, 1), emissiveMap: sigilTexture(), emissiveIntensity: 0.15, roughness: 0.8 });
    const altar = new THREE.Group(); altar.position.set(al.x, 0, al.z); this.group.add(altar);
    add(new THREE.BoxGeometry(1.3, 0.75, 0.84), stone, 0, 0.375, 0, altar);
    add(new THREE.BoxGeometry(1.42, 0.12, 0.96), stone, 0, 0.81, 0, altar);
    add(new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2), this.sigilMat, 0, 0.872, 0, altar);
    for (const s of [-1, 1]) add(new THREE.PlaneGeometry(0.6, 0.6), this.sigilMat, 0, 0.4, s * 0.421, altar).rotation.y = s > 0 ? 0 : Math.PI;
    // candles at the corners
    const flame = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.5, 0.7) });
    this.flames = [];
    for (const [x, z] of [[-0.6, -0.38], [0.6, -0.38], [-0.6, 0.38], [0.6, 0.38]]) {
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), new THREE.MeshStandardMaterial({ color: '#1a1a14' }), x, 0.94, z, altar);
      this.flames.push(add(new THREE.ConeGeometry(0.018, 0.06, 6), flame, x, 1.04, z, altar));
    }
    // the floor's sigil around the altar, faint
    this.floorSigil = add(new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: sigilTexture(), color: new THREE.Color(0.4, 0.4, 0.4), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }), al.x, 0.005, al.z);

    this.pressBox = mapView.story && mapView.story.pressBox;
    this.erik = null;

    // --- the four drained basketballs and their circles
    const drained = new THREE.MeshStandardMaterial({ map: basketballTexture(true), roughness: 0.8 });
    const live = new THREE.MeshStandardMaterial({ map: basketballTexture(false), roughness: 0.55, emissive: new THREE.Color(1, 0.45, 0.1), emissiveIntensity: 0.4 });
    const ballGeo = new THREE.SphereGeometry(0.12, 24, 16);
    this.balls = (Q.ritualBalls || []).map((b) => {
      const g = new THREE.Group(); g.position.set(b.x, 0, b.z); this.group.add(g);
      const ball = add(ballGeo, drained, 0, 0.12, 0, g);
      const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 0.45), transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const R = this.cfg.quest.ritualCircle;
      const ring = add(new THREE.RingGeometry(R - 0.08, R, 64).rotateX(-Math.PI / 2), ringMat, 0, 0.008, 0, g);
      const fillMat = ringMat.clone();
      const fill = add(new THREE.RingGeometry(R - 0.35, R - 0.12, 64, 1, 0, 0.001).rotateX(-Math.PI / 2), fillMat, 0, 0.009, 0, g);
      const pillar = add(new THREE.CylinderGeometry(R, R, 4, 40, 1, true), new THREE.MeshBasicMaterial({ map: T.beamTexture(), color: new THREE.Color(0.2, 1.4, 0.35), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 2, 0, g);
      pillar.rotation.x = Math.PI;
      const label = add(new THREE.PlaneGeometry(1.2, 0.3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: statLabelTexture(b.stat), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.01, R + 0.32, g);
      return { b, g, ball, ring, fill, fillR: R, pillar, label, drained, live, lastFrac: -1 };
    });

    // --- the Intercom Showdown: speaker towers, the wire, amps, the playbook
    const face = new THREE.MeshStandardMaterial({ map: speakerFaceTexture(), roughness: 0.8 });
    const cab = new THREE.MeshStandardMaterial({ color: '#181818', roughness: 0.7 });
    this.towers = (Q.towers || []).map((tw) => {
      const g = new THREE.Group(); g.position.set(tw.x, 0, tw.z);
      g.rotation.y = Math.atan2(-tw.x, -tw.z); // facing center court
      this.group.add(g);
      for (const [y, h] of [[0.55, 1.1], [1.65, 1.1], [2.5, 0.6]]) {
        add(new THREE.BoxGeometry(1.0, h - 0.04, 0.9), [cab, cab, cab, cab, face, cab], 0, y, 0, g);
      }
      const ampSlot = add(new THREE.BoxGeometry(0.5, 0.25, 0.1), new THREE.MeshStandardMaterial({ color: '#0a0a0a' }), 0, 2.95, 0.42, g);
      void ampSlot;
      const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.02, 0.02) });
      const lamp = add(new THREE.BoxGeometry(0.8, 0.06, 0.04), lightMat, 0, 2.86, 0.47, g);
      void lamp;
      const amp = this.ampModel(); amp.position.set(0, 3.12, 0.1); amp.visible = false; g.add(amp);
      return { g, lightMat, amp };
    });
    // --- the Chopper: its four parts where they lie, the workbench in the boiler room
    this.choppers = (Q.chopperParts || []).map((c) => {
      const g = chopperPart(c.id);
      g.scale.setScalar(1.6);
      g.position.set(c.x, c.y, c.z);
      g.rotation.y = c.x * 0.7;
      g.visible = false;
      this.group.add(g);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.halo, color: 0xff7050, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(0.7); halo.position.set(c.x, c.y + 0.12, c.z); halo.visible = false;
      this.group.add(halo);
      // its spot on the workbench once it's found
      const onBench = chopperPart(c.id);
      onBench.scale.setScalar(1.6);
      onBench.visible = false;
      return { c, g, halo, onBench };
    });
    const tb = Q.chopperTable;
    if (tb) {
      const bench = new THREE.Group();
      bench.position.set(tb.x, 0, tb.z);
      this.group.add(bench);
      const top = new THREE.MeshStandardMaterial({ map: T.toTexture(T.noiseCanvas(256, 9, 3)), color: '#6a4a2c', roughness: 0.8 });
      const legM = new THREE.MeshStandardMaterial({ color: '#4a4d50', roughness: 0.55, metalness: 0.4 });
      add(new THREE.BoxGeometry(tb.w, 0.06, tb.d), top, 0, tb.h - 0.03, 0, bench);
      add(new THREE.BoxGeometry(tb.w - 0.08, 0.04, tb.d - 0.1), top, 0, 0.18, 0, bench);       // lower shelf
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.05, tb.h - 0.06, 0.05), legM, x * (tb.w / 2 - 0.05), (tb.h - 0.06) / 2, z * (tb.d / 2 - 0.05), bench);
      // a vise on the end, a pegboard of tools on the wall behind
      add(new THREE.BoxGeometry(0.16, 0.1, 0.12), legM, 0, tb.h + 0.05, tb.d / 2 - 0.12, bench);
      const peg = add(new THREE.BoxGeometry(0.03, 0.9, tb.d - 0.2), new THREE.MeshStandardMaterial({ color: '#8a6e4a', roughness: 0.9 }), tb.w / 2 - 0.02, tb.h + 0.75, 0, bench);
      void peg;
      for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.02, 0.22 + (i % 3) * 0.06, 0.04), i % 2 ? legM : choppersMats().red, tb.w / 2 - 0.05, tb.h + 0.6 + (i % 2) * 0.25, -0.8 + i * 0.32, bench);
      // the plans
      const plan = add(new THREE.PlaneGeometry(0.62, 0.39).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: blueprintTexture(), roughness: 0.9 }), -0.04, tb.h + 0.002, 0.55, bench);
      plan.rotation.y = Math.PI / 2;
      // where the found parts go, and the finished Chopper
      const slots = [-0.65, -1.0, -0.3, 0.02];   // motor, blade, housing, grip (the plans lie past them)
      this.choppers.forEach((ch, i) => { ch.onBench.position.set(0.02, tb.h, slots[i] ?? 0); bench.add(ch.onBench); });
      this.builtChopper = buildGun('chopper').group;
      this.builtChopper.scale.setScalar(1.5);
      this.builtChopper.position.set(0, tb.h + 0.16, -0.35);
      this.builtChopper.visible = false;
      bench.add(this.builtChopper);
      this.benchHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.halo, color: 0xff7050, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.benchHalo.scale.setScalar(1.1); this.benchHalo.position.set(0, tb.h + 0.2, -0.35);
      bench.add(this.benchHalo);
      this.bench = bench;
    }
    // --- cracks on the Press Box's glass as the Chopper hits it
    this.cracks = [];
    this.crackTex = [];
    if (this.pressBox) {
      for (const pane of this.pressBox.panes) {
        const m = new THREE.Mesh(pane.geometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }));
        m.position.copy(pane.position); m.rotation.copy(pane.rotation); m.scale.copy(pane.scale);
        m.visible = false;
        pane.parent.add(m);
        this.cracks.push(m);
      }
    }
    this.crackLevel = 0;
    // --- The Schnitz: two green eyes over the stew when the Chopper's first lifted
    const eyeTex = T.softDotTexture('rgba(160,255,140,1)', 'rgba(40,255,60,0)');
    this.schnitzEyes = [-1, 1].map(() => {
      const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
      e.scale.set(0.55, 0.17, 1); e.visible = false; this.group.add(e); return e;
    });
    const C0 = sim.mapData.cauldron;
    this.schnitzAt = C0 ? new THREE.Vector3(C0.x, 2.25, C0.z) : new THREE.Vector3(0, 2.25, 0);
    this.schnitzLight = mapView.addVirtualLight({ x: this.schnitzAt.x, y: 1.6, z: this.schnitzAt.z }, 0x50ff70, 10, 7, 1.6);
    this.schnitzLight.live = true; this.schnitzLight.noDim = true; this.schnitzLight.level = 0;
    this.groundAmps = new Map();
    this.plays = new Map();
  }

  ampModel() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.24), new THREE.MeshStandardMaterial({ color: '#202020', roughness: 0.5 }));
    g.add(body);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.3 }));
    cone.position.z = 0.121; g.add(cone);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.4, 0.5) }));
    led.position.set(0, 0.1, 0.122); g.add(led);
    return g;
  }

  setSim(sim) {
    this.sim = sim;
    for (const m of this.plays?.values() || []) this.group.remove(m);
    this.plays?.clear();
    for (const m of this.groundAmps?.values() || []) this.group.remove(m);
    this.groundAmps?.clear();
    for (const w of this.wisps || []) this.group.remove(w.s);
    this.wisps = [];
    if (this.erik) { this.group.remove(this.erik.root); this.erik = null; if (this.erikLight) this.erikLight.level = 0; }
    this.erikHeld = false;
    if (this.pressBox) for (const p of this.pressBox.panes) p.visible = true;
    this.crackLevel = 0;
    for (const m of this.cracks || []) m.visible = false;
  }

  onEvent(e) {
    if (!this.Q) return;
    if (e.type === 'schnitzVisit') {
      // the eyes open over the stew, side by side as seen by whoever lifted it
      const p = this.sim.playerById(e.playerId);
      const at = this.schnitzAt;
      const dx = p ? p.pos.x - at.x : 1, dz = p ? p.pos.z - at.z : 0;
      const l = Math.hypot(dx, dz) || 1;
      this.schnitzSide = new THREE.Vector3(-dz / l, 0, dx / l);
    }
    if (e.type === 'pressBoxBlast') {
      this.boothShake = 1;
      // glass bits rain down from the booth
      if (this.effects) for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        this.effects.spawnParticle(new THREE.Vector3(Math.cos(a) * 2.5, PRESS_BOX.y0 + Math.random() * 1.5, Math.sin(a) * 1.8), new THREE.Vector3(Math.cos(a) * 2, Math.random() * 1.5, Math.sin(a) * 2), { life: 1.2, size: 0.02, color: [2.2, 2.6, 2.8], gravity: 9, drag: 0.4 });
      }
    }
    if (e.type === 'statueSoul' && this.mascot) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.wispTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.scale.setScalar(0.35);
      this.group.add(s);
      this.wisps.push({ s, from: new THREE.Vector3(e.from.x, e.from.y, e.from.z), t: 0 });
    }
  }

  buildErik() {
    const k = buildCharacter('erik', { detail: 0.75 });
    k.root.position.set(0, PRESS_BOX.y0, -0.4);
    this.group.add(k.root);
    this.erik = k;
    // a sickly green light in the booth with him
    this.erikLight = this.map.addVirtualLight({ x: 0, y: PRESS_BOX.y0 + 1.9, z: 0.8 }, 0x60ff80, 30, 7, 1.5);
    this.erikLight.live = true;
    this.erikLight.level = 0;
  }

  update(dt, camera) {
    const sim = this.sim, q = sim.quest;
    this.time += dt;
    const t = this.time;
    if (!this.Q) return;
    this.group.visible = !!q;
    if (!q) return;
    // breakers
    for (const br of this.breakers) {
      const on = q.breakers.includes(br.b.id);
      br.thrown += ((on ? 1 : 0) - br.thrown) * Math.min(1, dt * 14);
      br.pivot.rotation.x = 0.55 - br.thrown * 1.1;
      br.lampMat.color.setRGB(on ? 0.2 : 2.2, on ? 2.4 : 0.15, 0.1);
    }
    // pieces lying around
    for (const pc of this.pieces) {
      const have = q.pieces.includes(pc.t.id);
      pc.g.visible = pc.halo.visible = !have;
      if (!have) { pc.g.rotation.y = t * 0.6; pc.halo.material.opacity = 0.25 + Math.sin(t * 2.5) * 0.1; }
    }
    this.goldMat.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.15;
    // trophy and stand
    this.trophy.visible = q.trophyPlaced;
    this.stand.position.set(q.standPos.x, 0, q.standPos.z);
    // trapdoor leaves swing down into the pit as the machine comes up
    const open = q.madDogRising ? Math.min(1, (q.madDogRise + 0.25) * 1.6) : 0;
    for (const L of this.leaves) L.hinge.rotation.z = L.s * open * 1.75;
    this.pit.visible = open > 0.02;
    // the statue
    if (this.mascot) {
      const k = q.statueSouls / q.need.souls;
      const awake = q.statueAwake;
      const e = awake ? 3 + Math.sin(t * 6) * 0.8 : k * 0.9;
      this.eyeMat.color.setRGB(e + 0.05, e * 0.06, e * 0.03);
      this.baseGlow.material.opacity = q.step === 'statue' || awake ? 0.12 + k * 0.6 + Math.sin(t * 3) * 0.05 : 0;
      const jaw = awake ? Math.min(1, (sim.time - q.statueAwakeAt) / 1.5) : 0;
      this.mascot.jaw.rotation.z = -jaw * 0.75;
      this.mascot.head.rotation.z = awake ? Math.sin(t * 20) * 0.01 * (1 - jaw) - jaw * 0.12 : 0;
    }
    // soul wisps fly into the statue's base
    if (this.mascot && this.wisps.length) {
      const S = this.Q.statue;
      const to = new THREE.Vector3(S.x, 1.2, S.z);
      for (let i = this.wisps.length - 1; i >= 0; i--) {
        const w = this.wisps[i];
        w.t += dt / 1.1;
        const k = Math.min(1, w.t);
        w.s.position.lerpVectors(w.from, to, k);
        w.s.position.y += Math.sin(k * Math.PI) * 1.6;
        w.s.material.opacity = Math.min(1, (1 - k) * 4);
        if (k >= 1) { this.group.remove(w.s); w.s.material.dispose(); this.wisps.splice(i, 1); }
      }
    }
    // the half-court ritual
    const r = q.ritual;
    for (const B of this.balls) {
      const st = r.balls.find((x) => x.id === B.b.id);
      const active = r.active === B.b.id;
      const avail = q.step === 'ritual' && !st.done;
      B.ball.material = st.done ? B.live : B.drained;
      B.ball.position.y = st.done ? 0.55 + Math.sin(t * 2 + B.g.position.x) * 0.06 : 0.12;
      B.ball.rotation.y = st.done ? t * 1.5 : 0;
      B.ring.material.opacity = active ? 0.9 : avail ? 0.18 + Math.sin(t * 2.5) * 0.08 : 0;
      B.pillar.material.opacity = active ? 0.1 + Math.sin(t * 6) * 0.03 : 0;
      B.label.material.opacity = avail || active ? 0.35 : st.done ? 0.15 : 0;
      const frac = st.progress / this.cfg.quest.ritualTime;
      if (Math.abs(frac - B.lastFrac) > 0.004) {
        B.lastFrac = frac;
        B.fill.geometry.dispose();
        B.fill.geometry = new THREE.RingGeometry(B.fillR - 0.35, B.fillR - 0.12, 64, 1, Math.PI / 2, -Math.max(0.001, frac) * Math.PI * 2).rotateX(-Math.PI / 2);
      }
      B.fill.material.opacity = active ? 0.85 : 0;
    }
    // the showdown
    const B = q.boss;
    for (let i = 0; i < this.towers.length; i++) {
      const tw = this.towers[i];
      const on = !!(B && B.towers[i]);
      tw.amp.visible = on;
      const k = on ? (B.phase === 3 ? 2.5 + Math.sin(t * 30) * 1.2 : 1.6 + Math.sin(t * 4 + i) * 0.4) : (B && B.phase === 2 ? 0.4 + Math.sin(t * 3) * 0.2 : 0.12);
      tw.lightMat.color.setRGB(on ? k * 0.15 : k, on ? k : k * 0.1, on ? k * 0.25 : k * 0.08);
    }
    // the Chopper's parts, the workbench and the finished gun
    const CH = q.chopper;
    const hunting = CH && (q.step === 'chopper' || q.step === 'boss' || q.step === 'ending');
    for (const ch of this.choppers) {
      const have = CH && CH.parts.includes(ch.c.id);
      const show = hunting && !have;
      ch.g.visible = ch.halo.visible = show;
      if (show) { ch.g.rotation.y = t * 0.6; ch.halo.material.opacity = 0.25 + Math.sin(t * 2.5) * 0.1; }
      ch.onBench.visible = !!(have && !CH.built);
    }
    if (this.builtChopper) {
      const built = !!(CH && CH.built && !CH.holder);   // sitting on the bench, waiting
      this.builtChopper.visible = built;
      if (built) this.builtChopper.rotation.y = Math.sin(t * 0.7) * 0.3;
      this.benchHalo.material.opacity = built ? 0.3 + Math.sin(t * 2.2) * 0.08 : (q.step === 'chopper' && !CH.built && CH.parts.length >= q.need.parts ? 0.35 + Math.sin(t * 4) * 0.12 : 0);
    }
    // The Schnitz's dark: the building sinks low, its eyes open over the stew
    const S = q.schnitz, dark = S && !S.done && q.darkUntil > sim.time;
    this.map.dimTarget = dark ? this.cfg.quest.schnitz.dim : 1;
    if (dark) {
      const k = sim.time - S.at, left = q.darkUntil - sim.time;
      const o = Math.min(1, Math.max(0, (k - 1.2) / 1.5)) * Math.min(1, left / 1.5);
      const side = this.schnitzSide || new THREE.Vector3(0, 0, 1);
      const blink = Math.sin(k * 0.9) > 0.985 ? 0.1 : 1;
      this.schnitzEyes.forEach((e, i) => {
        e.visible = true;
        e.position.copy(this.schnitzAt).addScaledVector(side, (i ? 1 : -1) * 0.34);
        e.position.y += Math.sin(k * 0.7) * 0.06;
        e.material.opacity = o * blink * (0.85 + Math.sin(t * 9 + i) * 0.1);
      });
      this.schnitzLight.level = o * (0.7 + Math.sin(t * 5) * 0.15);
    } else {
      for (const e of this.schnitzEyes) e.visible = false;
      this.schnitzLight.level = 0;
    }
    // the booth's glass cracks a little more with every blast, and the booth shudders
    const blasts = B ? B.blasts || 0 : 0;
    if (blasts !== this.crackLevel && this.cracks.length) {
      this.crackLevel = blasts;
      const tex = blasts > 0 ? (this.crackTex[blasts] ||= crackTexture(blasts - 1)) : null;
      for (const m of this.cracks) { m.visible = !!tex; if (tex) { m.material.map = tex; m.material.needsUpdate = true; } }
    }
    if (this.pressBox && this.pressBox.group) {
      this.boothShake = Math.max(0, (this.boothShake || 0) - dt * 2.5);
      const k = this.boothShake * 0.06;
      this.pressBox.group.position.x = Math.sin(t * 61) * k;
      this.pressBox.group.position.z = Math.cos(t * 47) * k;
    }
    // amplifiers lying on the court
    const seen = new Set();
    if (B) for (const a of B.amps) {
      if (a.state !== 'ground') continue;
      seen.add(a.id);
      let m = this.groundAmps.get(a.id);
      if (!m) {
        m = this.ampModel();
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.wispTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
        halo.scale.setScalar(0.9); m.add(halo);
        this.group.add(m); this.groundAmps.set(a.id, m);
      }
      m.position.set(a.x, 0.35 + Math.sin(t * 3 + a.id) * 0.06, a.z);
      m.rotation.y = t * 1.2;
    }
    for (const [id, m] of this.groundAmps) if (!seen.has(id)) { this.group.remove(m); this.groundAmps.delete(id); }
    // the playbook
    const live = new Set();
    if (B) for (const zn of B.zones) {
      live.add(zn.id);
      let m = this.plays.get(zn.id);
      if (!m) { m = playMesh(zn); this.group.add(m); this.plays.set(zn.id, m); }
      const age = sim.time - zn.born;
      const burning = age >= zn.warn;
      const o = burning ? 0.85 + Math.sin(t * 20) * 0.1 : 0.12 + 0.25 * Math.max(0, Math.sin(age * 14));
      m.userData.mat.opacity = o;
      m.traverse((c) => { if (c.isMesh && c.userData.fill) c.material.opacity = burning ? 0.25 : 0.04; });
    }
    for (const [id, m] of this.plays) if (!live.has(id)) { this.group.remove(m); this.plays.delete(id); }

    // the coin
    const C = this.Q.statue.coin, A = this.Q.altar;
    if (q.coin === 'dropped') {
      this.coin.visible = true;
      const since = sim.time - (q.statueAwakeAt + this.cfg.quest.coinDropDelay);
      const fall = Math.max(0, 1 - since / 0.5);
      this.coin.position.set(C.x, C.y + 0.12 + fall * 2.6 + Math.sin(t * 2.4) * 0.03, C.z);
      this.coin.rotation.y = t * 2;
    } else if (q.coin === 'placed') {
      this.coin.visible = true;
      this.coin.position.set(A.x, 0.9, A.z);
      this.coin.rotation.set(Math.PI / 2, 0, t * 0.5);
    } else this.coin.visible = false;
    // the altar wakes once the coin is in
    const altarK = q.coin === 'placed' ? 1 : q.coin === 'held' ? 0.4 : 0.1;
    this.sigilMat.emissiveIntensity = altarK * (0.8 + Math.sin(t * 4) * 0.2);
    this.floorSigil.material.opacity = 0.12 + altarK * 0.5;
    for (const f of this.flames) f.scale.y = 0.8 + Math.sin(t * 17 + f.position.x * 9) * 0.25;
    // cladding rolls up like a shutter; glass and Erik behind it
    if (this.pressBox) {
      const c = q.cladding;
      const H = PRESS_BOX.y1 - PRESS_BOX.y0 + 0.05;
      for (const m of this.pressBox.cladding) {
        if (m.userData.placard) { m.position.y = m.userData.home + c * 0.75; m.visible = c < 0.98; continue; }
        m.scale.y = Math.max(0.001, 1 - c);
        m.position.y = PRESS_BOX.y1 + 0.02 - (H * (1 - c)) / 2;
        m.visible = c < 0.995;
        // rattles while it moves
        if (c > 0 && c < 1) m.position.x += 0;
      }
      if (c > 0 && !this.erik) this.buildErik();
      if (this.erikLight && this.erik && !this.erik.root.parent) this.erikLight.level = 0;
    }
    if (this.erik && !this.erikHeld) {
      this.erik.root.visible = q.cladding > 0;
      idleCharacter(this.erik, t);
      // he watches whoever's closest
      const cam = camera ? camera.position : null;
      if (cam) {
        const want = Math.atan2(cam.x - this.erik.root.position.x, cam.z - this.erik.root.position.z);
        let d = want - this.erik.root.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        this.erik.root.rotation.y += d * Math.min(1, dt * 1.5);
      }
      this.erikLight.level = Math.min(1, q.cladding * 1.5) * (0.85 + Math.sin(t * 7) * 0.1);
    }
  }
}
