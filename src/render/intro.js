// =============================================================================
// Intro cutscene: how it started (story by James Amarante).
//
//   The Cut        the night before the championship, in the locker room: the
//                  Stew Leonards tell Erik Madsen (#8) they took a vote
//   The Bargain    later that night, in the boiler room: Erik in a circle of
//                  candles, and two green eyes in the steam - The Schnitz.
//                  Talent has a price. He pays it.
//   Tip-off        championship night: a packed gym, the team at center court,
//                  and Erik on the PA from the Press Box. The lights go green,
//                  the team's talent is pulled out of them, the balls go dead,
//                  and the court splits open
//   Title          STEW ZOMBIES - then the game starts
//
// Like the ending (ending.js) it drives the camera and its own props; the
// renderer hands it the frame. Lines go out through onLine(who, text, secs),
// sound cues through onCue(name).
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';
import { buildCharacter, idleCharacter } from './characters.js';
import { PRESS_BOX } from './storyProps.js';
import { makeZombie } from '../sim/zombies.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, k) => a.clone().lerp(b, k);

export const INTRO_BEATS = {
  card1: 0.4, cut: 3.6, cutEnd: 21.4,
  card2: 21.9, bargain: 24.2, eyes: 28.6, fire: 39.2, reborn: 40.8, bargainEnd: 44.6,
  card3: 45.2, tipoff: 47.6, pa1: 49.2, pa2: 53.6, green: 55.8, drain: 57.4, rise: 58.8, pa3: 60.6, shutter: 64.4, black: 66.4, title: 67.2, end: 72.5,
};
const B = INTRO_BEATS;

// Who says what, and when (seconds from the start).
export const INTRO_LINES = [
  { at: 5.2, who: 'kearns', text: 'Erik. We took a vote.', dur: 2.4 },
  { at: 7.9, who: 'erik', text: 'A vote? On what?', dur: 1.9 },
  { at: 10.1, who: 'ryan', text: 'It\'s unanimous. You\'re off the team.', dur: 2.6 },
  { at: 13.0, who: 'erik', text: 'The championship is TOMORROW.', dur: 2.3 },
  { at: 15.6, who: 'rocco', text: 'Well well well... guess you\'ll be watching it.', dur: 2.6 },
  { at: 18.6, who: 'erik', text: 'You\'ll regret this. Every one of you.', dur: 2.4 },
  { at: 25.6, who: 'erik', text: 'Undefeated. Because of ME. And they cut me.', dur: 2.8 },
  { at: 29.4, who: 'schnitz', text: 'You want them to lose.', dur: 2.4 },
  { at: 32.0, who: 'erik', text: 'I want them to lose everything. Their speed. Their jump. All of it.', dur: 3.2 },
  { at: 35.6, who: 'schnitz', text: 'Talent has a price, Number Eight.', dur: 2.6 },
  { at: 38.0, who: 'erik', text: 'Take it.', dur: 1.2 },
  { at: 49.2, who: 'erikPA', text: 'Ladies and gentlemen... your undefeated... Stew Leonards!', dur: 3.6 },
  { at: 53.6, who: 'erikPA', text: '...Not anymore.', dur: 1.8 },
  { at: 60.6, who: 'erikPA', text: 'Let\'s see you win without your talent.', dur: 2.8 },
];
export const INTRO_CARDS = {
  card1: ['Stew Leonard High', 'The night before the championship'],
  card2: ['The boiler room', 'Later that night'],
  card3: ['Championship night', 'Tip-off'],
};

// the team and their numbers (Erik is #8)
const TEAM = [
  ['kearns', 3], ['ryan', 23], ['pit', 11], ['rocco', 1],
  ['chops', 44], ['regs', 5], ['zach', 12], ['p', 32],
];
const ERIK_LOCKER = V(-20.4, 0, -6);    // by the door to the court
const ERIK_DOOR = V(-17.0, 0, -6);
const BOILER_ERIK = V(-24.2, 0, 7.3);
const CAULDRON = V(-20.3, 0, 7.4);

function sigilTexture() {
  const S = 512;
  const [c, g] = T.makeCanvas(S, S);
  g.clearRect(0, 0, S, S);
  g.strokeStyle = 'rgba(140,255,150,1)'; g.lineWidth = 7;
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.46, 0, 7); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(S / 2, S / 2, S * 0.4, 0, 7); g.stroke();
  // an 8-pointed star and a basketball's seams inside
  g.lineWidth = 5; g.beginPath();
  for (let i = 0; i <= 8; i++) { const a = (i * 3 / 8) * Math.PI * 2; const x = S / 2 + Math.cos(a) * S * 0.4, y = S / 2 + Math.sin(a) * S * 0.4; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  g.stroke();
  g.lineWidth = 4;
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.14, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(S / 2, S * 0.36); g.lineTo(S / 2, S * 0.64); g.moveTo(S * 0.36, S / 2); g.lineTo(S * 0.64, S / 2); g.stroke();
  g.font = '900 64px Impact, sans-serif'; g.fillStyle = 'rgba(140,255,150,1)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('8', S / 2, S / 2);
  return T.toTexture(c, { repeat: false });
}

function ballTexture(drained) {
  const [c, g] = T.makeCanvas(128, 64);
  g.fillStyle = drained ? '#5a5650' : '#d2691e'; g.fillRect(0, 0, 128, 64);
  g.strokeStyle = 'rgba(20,10,5,0.8)'; g.lineWidth = 2;
  for (const x of [32, 64, 96]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
  g.beginPath(); g.moveTo(0, 32); g.lineTo(128, 32); g.stroke();
  return T.toTexture(c, { repeat: false });
}

// Legs swing while a character walks (after idleCharacter has posed them).
function walkLegs(k, t, amt = 1) {
  const s = Math.sin(t * 7.5) * 0.45 * amt;
  if (k.legL) { k.legL.hip.rotation.x = s; k.legL.knee.rotation.x = Math.max(0, -s) * 0.9; }
  if (k.legR) { k.legR.hip.rotation.x = -s; k.legR.knee.rotation.x = Math.max(0, s) * 0.9; }
  k.hips.position.y += Math.abs(Math.cos(t * 7.5)) * 0.03 * amt;
}
// Arms out from the sides, palms up: Erik giving himself over.
function armsOut(k, w) {
  for (const a of [k.armL, k.armR]) {
    a.shoulder.rotation.z += (a.side * 1.1 - a.shoulder.rotation.z) * w;
    a.shoulder.rotation.x += (-0.35 - a.shoulder.rotation.x) * w;
    a.elbow.rotation.x *= 1 - w;
  }
  k.head.rotation.x += (-0.35 - k.head.rotation.x) * w;
}
// Doubled over: what the drain does to the team.
function slump(k, w) {
  k.torso.rotation.x += 0.22 * w;
  k.head.rotation.x += 0.25 * w;
  for (const a of [k.armL, k.armR]) a.shoulder.rotation.x += 0.15 * w;
  for (const l of [k.legL, k.legR]) { l.knee.rotation.x += 0.25 * w; l.hip.rotation.x -= 0.12 * w; }
  k.hips.position.y -= 0.05 * w;
}

export class Intro {
  constructor(renderer, sim, { character = 'kearns' } = {}) {
    this.R = renderer;
    this.sim = sim;
    this.t = 0;
    this.done = false;
    this.cues = new Set();
    this.onCue = null;      // (name) => sounds and overlay cards
    this.onLine = null;     // (who, text, secs) => subtitles and voices
    this.lineIx = 0;
    this.scene = renderer.scene;
    this.cam = renderer.camera;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.character = character;
    const map = renderer.map;
    this.map = map;

    // --- the team, in their game jerseys (the four you can play in front)
    this.team = TEAM.map(([id, n], i) => {
      const k = buildCharacter(id, { jersey: n, detail: 0.6 });
      this.group.add(k.root);
      // a loose arc facing Erik, the four up front
      const front = i < 4;
      const a = (front ? (i - 1.5) * 0.42 : (i - 5.5) * 0.36 + 0.1) + Math.PI;
      const r = front ? 2.7 : 4.2;
      k.root.position.set(ERIK_LOCKER.x - Math.cos(a + Math.PI) * r, 0, ERIK_LOCKER.z + Math.sin(a) * r * 1.2);
      k.root.lookAt(ERIK_LOCKER.x, 0, ERIK_LOCKER.z);
      return { k, id, front };
    });
    this.lead = (id) => this.team.find((m) => m.id === id);

    // --- Erik: in his #8 jersey, then (after the bargain) in black
    this.erikJ = buildCharacter('erik', { jersey: 8, detail: 0.75 });
    this.group.add(this.erikJ.root);
    this.erikJ.root.position.copy(ERIK_LOCKER);
    this.erikJ.root.rotation.y = -Math.PI / 2;   // facing the team (west)
    this.erikS = buildCharacter('erik', { detail: 0.75 });
    this.erikS.root.visible = false;
    this.group.add(this.erikS.root);

    // --- the boiler room: a circle drawn on the floor, candles, two eyes in the steam
    this.boiler = new THREE.Group(); this.boiler.visible = false; this.group.add(this.boiler);
    this.sigilMat = new THREE.MeshBasicMaterial({ map: sigilTexture(), color: new THREE.Color(0.6, 2.2, 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3 });
    const sigil = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8).rotateX(-Math.PI / 2), this.sigilMat);
    sigil.position.set(BOILER_ERIK.x, 0.015, BOILER_ERIK.z); this.boiler.add(sigil);
    const flameTex = T.softDotTexture('rgba(255,230,160,1)', 'rgba(255,120,20,0)');
    const wax = new THREE.MeshStandardMaterial({ color: '#d9d2be', roughness: 0.8 });
    this.flames = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const x = BOILER_ERIK.x + Math.cos(a) * 1.3, z = BOILER_ERIK.z + Math.sin(a) * 1.3;
      const h = 0.12 + (i % 3) * 0.06;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, h, 8), wax); c.position.set(x, h / 2, z); this.boiler.add(c);
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: new THREE.Color(2.2, 1.4, 0.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      f.position.set(x, h + 0.05, z); f.scale.set(0.09, 0.15, 1); f.userData.ph = Math.random() * 6; this.boiler.add(f);
      this.flames.push(f);
    }
    // the library book, open on the floor
    const book = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.3), new THREE.MeshStandardMaterial({ color: '#2a1410', roughness: 0.7 }));
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.035, 0.27), new THREE.MeshStandardMaterial({ color: '#d8ccb0', roughness: 0.9 }));
    pages.position.y = 0.01; book.add(cover, pages);
    book.position.set(BOILER_ERIK.x + 0.55, 0.02, BOILER_ERIK.z); book.rotation.y = 0.4; this.boiler.add(book);
    const eyeTex = T.softDotTexture('rgba(160,255,140,1)', 'rgba(40,255,60,0)');
    this.eyes = [-1, 1].map((s) => {
      const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
      e.scale.set(0.5, 0.15, 1); e.position.set(CAULDRON.x - 0.9, 2.15, CAULDRON.z + s * 0.32); this.boiler.add(e); return e;
    });
    this.fireLight = null;

    // --- championship night: a crowd in the bleachers, a ball at each spot
    this.crowd = this.buildCrowd();
    this.crowd.group.visible = false;
    this.balls = (sim.mapData.quest && sim.mapData.quest.ritualBalls || []).map((b) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshStandardMaterial({ map: ballTexture(false), roughness: 0.75 }));
      m.position.set(b.x, 0.12, b.z); m.visible = false; this.group.add(m);
      return { m, b, home: V(b.x, 0.12, b.z) };
    });
    this.drainedTex = ballTexture(true);
    const wispTex = T.softDotTexture('rgba(200,255,190,1)', 'rgba(60,255,90,0)');
    this.wisps = [];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 5; j++) {
        const w = new THREE.Sprite(new THREE.SpriteMaterial({ map: wispTex, color: new THREE.Color(0.8, 2.4, 1.0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
        w.scale.setScalar(0.18); w.visible = false; this.group.add(w);
        this.wisps.push({ s: w, who: i, delay: j * 0.18, ph: Math.random() * 6 });
      }
    }
    this.risers = [];
    this.scenePhase = null;
  }

  buildCrowd() {
    const g = new THREE.Group(); this.group.add(g);
    const seats = [];
    for (const bl of this.sim.mapData.bleachers || []) {
      const dir = bl.side === 'north' ? 1 : -1;
      const wallZ = bl.side === 'north' ? -13 : 13;
      const total = bl.rows * bl.depth;
      for (let i = 0; i < bl.rows; i++) {
        const front = wallZ + dir * (total - i * bl.depth);
        for (let x = bl.x0 + 0.4; x < bl.x1 - 0.3; x += 0.55 + Math.random() * 0.35) {
          if (Math.random() < 0.12) continue;
          seats.push({ x: x + (Math.random() - 0.5) * 0.15, y: (i + 1) * bl.rise, z: front - dir * bl.depth * 0.45, face: bl.side === 'north' ? 0 : Math.PI, ph: Math.random() * 6, amp: 0.4 + Math.random() * 0.8 });
        }
      }
    }
    const n = seats.length;
    const body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.17, 0.2, 0.62, 8).translate(0, 0.31, 0), new THREE.MeshStandardMaterial({ roughness: 0.9 }), n);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 10, 8).translate(0, 0.74, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
    const tops = ['#1d5a2e', '#d8b84a', '#1d5a2e', '#e8e4dc', '#2b3d5c', '#1d5a2e', '#8a2a20', '#d8b84a', '#3a3a3e'];
    const skins = ['#e2b9a0', '#c99a7a', '#8d5a3c', '#f0cdb4', '#6b4430', '#d8a888'];
    const col = new THREE.Color();
    seats.forEach((s, i) => {
      body.setColorAt(i, col.set(tops[i % tops.length]));
      head.setColorAt(i, col.set(skins[(i * 7) % skins.length]));
    });
    g.add(body, head);
    return { group: g, body, head, seats, m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), sc: new THREE.Vector3(1, 1, 1) };
  }

  updateCrowd(time, excite, fear) {
    const C = this.crowd;
    C.seats.forEach((s, i) => {
      const jump = Math.max(0, Math.sin(time * (5 + s.amp * 3) + s.ph)) * 0.14 * excite * s.amp;
      const shake = Math.sin(time * 23 + s.ph) * 0.04 * fear;
      C.p.set(s.x + shake, s.y + jump, s.z);
      C.q.setFromAxisAngle(V(0, 1, 0), s.face + shake * 2);
      C.m.compose(C.p, C.q, C.sc);
      C.body.setMatrixAt(i, C.m);
      C.head.setMatrixAt(i, C.m);
    });
    C.body.instanceMatrix.needsUpdate = true;
    C.head.instanceMatrix.needsUpdate = true;
  }

  cue(name) {
    if (this.cues.has(name)) return;
    this.cues.add(name);
    if (this.onCue) this.onCue(name);
  }

  // skipping cuts to black and shows the title for a moment
  skip() { if (this.t < B.black) { this.t = B.end - 2.4; this.lineIx = INTRO_LINES.length; } }

  // Lights: the first and last scenes are lit, the boiler room isn't.
  setPower(on) {
    if (this.sim.power === on) return;
    this.sim.power = on;
    if (on) this.map.powerOn(true); else this.map.resetPower();
  }

  enter(phase) {
    if (this.scenePhase === phase) return;
    this.scenePhase = phase;
    const showTeam = phase === 'cut';
    for (const m of this.team) m.k.root.visible = showTeam || (phase === 'tipoff' && m.front);
    this.erikJ.root.visible = phase === 'cut' || phase === 'bargain';
    this.erikS.root.visible = phase === 'reborn';
    this.boiler.visible = phase === 'bargain' || phase === 'reborn';
    this.crowd.group.visible = phase === 'tipoff';
    for (const b of this.balls) b.m.visible = phase === 'tipoff';
    if (phase === 'cut') this.setPower(true);
    if (phase === 'bargain') {
      this.setPower(false);
      this.erikJ.root.position.copy(BOILER_ERIK);
      this.erikJ.root.rotation.set(0, Math.PI / 2, 0);   // facing the cauldron (east)
      if (!this.fireLight) { this.fireLight = this.map.addVirtualLight({ x: BOILER_ERIK.x, y: 0.35, z: BOILER_ERIK.z }, 0x50ff70, 3.5, 6, 1.8); this.fireLight.live = true; }
      this.fireLight.level = 0.15;
    }
    if (phase === 'tipoff') {
      this.setPower(true);
      if (this.fireLight) this.fireLight.level = 0;
      // the four on the court, round the center circle
      const four = ['kearns', 'ryan', 'pit', 'rocco'];
      four.forEach((id, i) => {
        const m = this.lead(id);
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        m.k.root.position.set(Math.cos(a) * 2.1, 0, 4.6 + Math.sin(a) * 1.2);
        m.k.root.lookAt(0, 0, 4.6);
        m.home = m.k.root.position.clone();
      });
      // Erik's booth: open, him in it under the green light
      const qv = this.R.quest;
      if (!qv.erik) qv.buildErik();
      qv.erikHeld = true;
      this.qv = qv;
      qv.erik.root.visible = true;
      qv.erik.root.rotation.y = 0;
      if (this.sim.quest) this.sim.quest.cladding = 1;
      if (qv.erikLight) qv.erikLight.level = 1;
    }
  }

  // Returns the scene to draw this frame.
  update(dt, time) {
    this.t += dt;
    const t = this.t;
    const cam = this.cam, fx = this.R.effects;
    if (t >= B.end) this.done = true;
    // lines
    while (this.lineIx < INTRO_LINES.length && t >= INTRO_LINES[this.lineIx].at) {
      const L = INTRO_LINES[this.lineIx++];
      if (this.onLine) this.onLine(L.who, L.text, L.dur);
    }
    // keep the quest's own props quiet while we use the court
    if (this.R.quest && this.R.quest.balls) for (const b of this.R.quest.balls) if (b.g) b.g.visible = false;

    // --- black, card 1
    if (t < B.cut) {
      this.cue('card1');
      this.enter('cut');
      cam.position.set(-24.6, 1.8, -0.9); cam.lookAt(ERIK_LOCKER.x - 0.6, 1.3, ERIK_LOCKER.z);
      for (const m of this.team) idleCharacter(m.k, time);
      idleCharacter(this.erikJ, time);
    }
    // --- The Cut
    else if (t < B.cutEnd) {
      this.cue('fadeIn');
      this.enter('cut');
      for (const m of this.team) { idleCharacter(m.k, time); m.k.root.lookAt(this.erikJ.root.position.x, 0, this.erikJ.root.position.z); }
      const e = this.erikJ;
      idleCharacter(e, time);
      if (t < 18.6) {
        // over the team's shoulders, pushing in; then on Erik's face for his lines
        if ((t > 7.8 && t < 10.0) || (t > 12.9 && t < 15.4)) {
          cam.position.set(ERIK_LOCKER.x - 1.35, 1.6, ERIK_LOCKER.z - 0.55);
          cam.lookAt(ERIK_LOCKER.x, 1.55, ERIK_LOCKER.z);
          if (t > 12.9) { e.torso.rotation.x -= 0.08; e.head.rotation.x -= 0.12; }
        } else {
          const k = sm(B.cut, 18.6, t);
          cam.position.copy(lerpV(V(-24.6, 1.8, -0.9), V(-23.6, 1.7, -2.4), k));
          cam.lookAt(ERIK_LOCKER.x - 0.6, 1.35, ERIK_LOCKER.z);
        }
      } else {
        // he turns his back on them and walks out; the door slams
        const k = sm(18.9, 21.0, t);
        e.root.rotation.y = -Math.PI / 2 + sm(18.6, 19.2, t) * Math.PI;
        e.root.position.copy(lerpV(ERIK_LOCKER, ERIK_DOOR, k));
        if (t > 19.2) walkLegs(e, time, 1 - sm(20.6, 21, t));
        e.root.visible = t < 20.9;
        if (t >= 20.9) this.cue('slam');
        cam.position.set(-24.2, 1.5, -7.6);
        cam.lookAt(ERIK_DOOR.x, 1.3, ERIK_DOOR.z);
      }
    }
    // --- black, card 2
    else if (t < B.bargain) {
      this.cue('black1');
      if (t >= B.card2) this.cue('card2');
      this.enter('bargain');
      cam.position.set(-26.8, 1.45, 3.0); cam.lookAt(-22.6, 1.0, 7.6);
    }
    // --- The Bargain
    else if (t < B.reborn) {
      this.cue('fadeIn2');
      this.enter('bargain');
      const e = this.erikJ;
      idleCharacter(e, time);
      e.head.rotation.x += 0.25;   // head down, over the book
      // candles
      this.flames.forEach((f) => { const s = 1 + Math.sin(time * 13 + f.userData.ph) * 0.15; f.scale.set(0.09 * s, 0.15 * s, 1); });
      // the circle lights as he reads; the eyes open in the steam
      const glow = sm(B.bargain + 0.5, B.eyes, t) * 0.6 + sm(B.eyes, B.fire, t) * 0.4;
      this.sigilMat.opacity = glow * (0.85 + Math.sin(time * 6) * 0.1);
      const eo = sm(B.eyes, B.eyes + 1.2, t);
      if (t >= B.eyes) this.cue('eyes');
      for (const s of this.eyes) s.material.opacity = eo * (0.85 + Math.sin(time * 9) * 0.1);
      this.fireLight.level = 0.15 + glow * 0.9;
      if (t > 37.6) armsOut(e, sm(37.6, 38.6, t));
      // green fire takes him
      if (t >= B.fire) {
        this.cue('fire');
        this.fireLight.level = 1.6 + Math.random() * 0.8;
        if (!this.burst) {
          this.burst = true;
          for (let i = 0; i < 70; i++) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * 0.6;
            fx.spawnParticle(V(BOILER_ERIK.x + Math.cos(a) * r, 0.1 + Math.random() * 1.6, BOILER_ERIK.z + Math.sin(a) * r), V(Math.cos(a) * 0.6, 2 + Math.random() * 3, Math.sin(a) * 0.6), { life: 1.4, size: 0.03 + Math.random() * 0.03, color: [0.4, 1.6, 0.5], gravity: -1.5, drag: 0.6 });
          }
          for (let i = 0; i < 10; i++) fx.puff(V(BOILER_ERIK.x + (Math.random() - 0.5), 0.4 + Math.random() * 1.4, BOILER_ERIK.z + (Math.random() - 0.5)), { color: 0x123814, size: 0.9, grow: 2.4, life: 2, alpha: 0.8, vel: V(0, 1.2, 0), smoke: true, shade: false });
        }
      }
      // camera: wide, then over his shoulder at the eyes, then on him
      if (t < B.eyes + 0.6) {
        const k = sm(B.bargain, B.eyes, t);
        cam.position.copy(lerpV(V(-26.8, 1.45, 3.0), V(-26.0, 1.5, 4.2), k));
        cam.lookAt(lerpV(V(-22.6, 1.0, 7.6), V(-22.2, 1.4, 7.5), k));
      } else if (t < 37.6) {
        const odd = Math.floor((t - B.eyes) / 3.4) % 2;
        if (!odd) { cam.position.set(BOILER_ERIK.x - 1.1, 1.75, BOILER_ERIK.z - 0.75); cam.lookAt(this.eyes[0].position.x, 2.1, CAULDRON.z); }
        else { cam.position.set(BOILER_ERIK.x + 1.5, 1.35, BOILER_ERIK.z + 0.9); cam.lookAt(BOILER_ERIK.x, 1.4, BOILER_ERIK.z); }
      } else {
        cam.position.set(BOILER_ERIK.x + 2.2, 1.0, BOILER_ERIK.z - 1.4);
        cam.lookAt(BOILER_ERIK.x, 1.3 + sm(B.fire, B.reborn, t) * 0.4, BOILER_ERIK.z);
      }
    }
    // --- Reborn: the smoke clears and he's in black, grinning, eyes glowing
    else if (t < B.card3) {
      this.enter('reborn');
      this.cue('laugh');
      const e = this.erikS;
      e.root.position.copy(BOILER_ERIK); e.root.rotation.set(0, -Math.PI / 2 + 0.5, 0);
      idleCharacter(e, time);
      for (const s of this.eyes) s.material.opacity = 1 - sm(B.reborn, B.reborn + 1.5, t);
      this.sigilMat.opacity = 0.9 * (1 - sm(B.bargainEnd - 1.5, B.bargainEnd, t));
      this.fireLight.level = 0.7 + Math.sin(time * 17) * 0.2;
      const k = sm(B.reborn, B.bargainEnd, t);
      cam.position.copy(lerpV(V(BOILER_ERIK.x - 2.6, 1.55, BOILER_ERIK.z + 1.4), V(BOILER_ERIK.x - 1.2, 1.62, BOILER_ERIK.z + 0.65), k));
      cam.lookAt(BOILER_ERIK.x, 1.58, BOILER_ERIK.z);
      if (t >= B.bargainEnd) this.cue('black2');
    }
    // --- black, card 3
    else if (t < B.tipoff) {
      this.cue('card3');
      this.enter('tipoff');
      cam.position.set(13, 3.4, 7.5); cam.lookAt(0, 1.1, 4.2);
    }
    // --- Tip-off
    else if (t < B.black) {
      this.cue('fadeIn3');
      this.enter('tipoff');
      this.cue('crowd');
      const qv = this.qv;
      const four = ['kearns', 'ryan', 'pit', 'rocco'].map((id) => this.lead(id));
      const drainK = sm(B.green, B.drain + 0.8, t);
      four.forEach((m, i) => {
        idleCharacter(m.k, time);
        m.k.root.lookAt(0, 0, 4.6);
        if (t > B.pa2) m.k.root.lookAt(0, 0, 0);   // they look up at the booth
        slump(m.k, drainK * (0.7 + 0.3 * Math.sin(time * 3 + i)));
        // they go back to back as the floor opens
        if (t > B.rise) {
          const k = sm(B.rise, B.rise + 2, t);
          const p = m.home.clone(); const c = V(0, 0, 4.6);
          m.k.root.position.copy(lerpV(p, lerpV(c, p, 0.45), k));
          m.k.root.lookAt(m.k.root.position.x * 2 - c.x, 0, m.k.root.position.z * 2 - c.z);
        }
      });
      // Erik in the booth
      if (qv && qv.erik) {
        idleCharacter(qv.erik, time);
        qv.erik.root.rotation.y = 0;
        if (qv.erikLight) qv.erikLight.level = 0.9 + Math.sin(time * 7) * 0.1;
      }
      // the crowd: cheering, then not
      const fear = sm(B.green, B.green + 1, t);
      this.updateCrowd(time, 1 - fear, fear);
      // lights go green and flicker
      if (t >= B.green) {
        this.cue('green');
        this.map.blackout = t < B.drain && Math.sin(t * 41) > 0.3;
      }
      if (t >= B.drain) { this.map.blackout = false; this.cue('drain'); }
      // talent pulled out of them, up to the booth
      for (const w of this.wisps) {
        const k = Math.min(1, Math.max(0, (t - B.green - 0.4 - w.delay) / 2.4));
        w.s.visible = k > 0 && k < 1;
        if (!w.s.visible) continue;
        const from = four[w.who].k.root.position.clone().add(V(0, 1.3, 0));
        const to = V(0, PRESS_BOX.y0 + 1.2, 0);
        const p = lerpV(from, to, k * k);
        p.x += Math.sin(k * 9 + w.ph) * 0.4 * (1 - k); p.z += Math.cos(k * 7 + w.ph) * 0.4 * (1 - k);
        w.s.position.copy(p);
        w.s.material.opacity = Math.sin(k * Math.PI);
      }
      // the balls bounce, then go dead and grey
      for (const b of this.balls) {
        if (t < B.drain) b.m.position.y = 0.12 + Math.abs(Math.sin(time * 4 + b.b.x)) * 0.35 * (1 - drainK);
        else {
          if (!b.dead) { b.dead = true; b.m.material.map = this.drainedTex; b.m.material.needsUpdate = true; }
          b.m.position.y = 0.1; b.m.scale.set(1.1, 0.8, 1.1);
        }
      }
      // the court splits and they claw up out of it
      if (t >= B.rise && !this.risen) { this.risen = true; this.raise(); }
      for (const z of this.risers) {
        z.stateTime += dt;
        const k = Math.min(1, z.stateTime / this.sim.cfg.zombie.riseTime);
        z.pos.y = z.riseFrom * (1 - k * (2 - k));
      }
      // the booth's shutter slams down over him
      if (t >= B.shutter) {
        this.cue('shutter');
        if (this.sim.quest) this.sim.quest.cladding = Math.max(0, 1 - sm(B.shutter, B.shutter + 0.6, t));
        if (qv && qv.erik) qv.erik.root.visible = this.sim.quest ? this.sim.quest.cladding > 0.05 : false;
      }
      // camera
      if (t < B.pa2) {
        const k = sm(B.tipoff, B.pa2, t);
        cam.position.copy(lerpV(V(13, 3.4, 7.5), V(5.2, 1.7, 9.0), k));
        cam.lookAt(lerpV(V(0, 1.1, 4.2), V(0, 1.3, 4.6), k));
      } else if (t < B.green) {
        // up at the booth
        cam.position.set(0.7, 6.0, 5.2);
        cam.lookAt(0, PRESS_BOX.y0 + 1.15, -0.2);
      } else if (t < B.rise) {
        const a = 0.8 + (t - B.green) * 0.25;
        cam.position.set(Math.cos(a) * 4.6, 1.6, 4.6 + Math.sin(a) * 4.6);
        cam.lookAt(0, 1.1, 4.6);
      } else if (t < B.shutter) {
        const k = sm(B.rise, B.shutter, t);
        cam.position.copy(lerpV(V(0, 2.2, 10.5), V(0, 5.6, 10.2), k));
        cam.lookAt(0, 0.6, 4.2);
      } else {
        cam.position.set(1.4, 5.6, 7.6);
        cam.lookAt(0, PRESS_BOX.y0 + 1.1, 0);
      }
    }
    // --- slam to black, title card
    else {
      this.map.blackout = false;
      this.cue('black3');
      if (t >= B.title) this.cue('title');
    }
    return this.scene;
  }

  // Zombies claw up out of the court around the team.
  raise() {
    const sim = this.sim;
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, d = 3.6 + Math.random() * 3;
      const pos = { x: Math.cos(a) * d, y: -sim.cfg.zombie.riseDepth, z: 4.6 + Math.sin(a) * d * 0.9 };
      const z = makeZombie(sim, { type: i % 3 ? 'walker' : 'runner', pos, yaw: Math.atan2(-pos.x, 4.6 - pos.z), health: 100, state: 'rising' });
      z.riseFrom = z.pos.y;
      z.stateTime = -i * 0.12;
      sim.zombies.push(z);
      this.risers.push(z);
      this.R.onEvents([{ type: 'zombieRise', id: z.id, pos: { x: z.pos.x, y: 0, z: z.pos.z } }]);
    }
    this.cue('rise');
  }

  dispose() {
    this.map.blackout = false;
    this.scene.remove(this.group);
    if (this.fireLight) { this.fireLight.level = 0; if (this.map.removeVirtualLight) this.map.removeVirtualLight(this.fireLight); }
    if (this.qv) this.qv.erikHeld = false;
    for (const z of this.risers) { const i = this.sim.zombies.indexOf(z); if (i >= 0) this.sim.zombies.splice(i, 1); }
  }
}
