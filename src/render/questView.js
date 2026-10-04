// =============================================================================
// What "The Final Whistle" looks like: the main breakers, the trophy pieces and
// stand, the trapdoor the Mad Dog Machine comes up through, the mascot statue
// waking up, soul wisps, the Dark Schnitz Coin, the altar under the Press Box,
// the cladding grinding up, and Erik in his booth.
//
// Reads sim.quest; never changes it.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';
import { buildCharacter, idleCharacter } from './characters.js';
import { PRESS_BOX } from './storyProps.js';

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
  }

  setSim(sim) {
    this.sim = sim;
    for (const w of this.wisps) this.group.remove(w.s);
    this.wisps = [];
    if (this.erik) { this.group.remove(this.erik.root); this.erik = null; if (this.erikLight) this.erikLight.level = 0; }
  }

  onEvent(e) {
    if (!this.Q) return;
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
      if (this.erikLight && !this.erik.root.parent) this.erikLight.level = 0;
    }
    if (this.erik) {
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
