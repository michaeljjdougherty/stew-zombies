// =============================================================================
// Character animation for the menus (character select, lineup).
//
// Three layers, every frame:
//   1. the character's idle style (how they stand: relaxed, big, lanky, goofy...)
//   2. "life": breathing, weight shifting from foot to foot, blinking, eyes
//      darting about, fingers never quite still
//   3. a signature gesture every so often (Kearns strokes his beard, Brian
//      waves, Zach claps...). Gestures place the hands with two-bone IK in the
//      torso's space, so they land on the chin / in front of the chest whatever
//      the character's build, and blend in and out of the idle.
// =============================================================================
import * as THREE from 'three';
import { HAND_POSES, mixPoses } from './hands.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// small seeded random per character (blinks and glances shouldn't sync up)
function rand(A) { A.seed = (A.seed * 16807) % 2147483647; return (A.seed - 1) / 2147483646; }

// =============================================================================
// 1. idle styles (set the whole pose)
// =============================================================================
function baseIdle(k, t) {
  const b = Math.sin(t * 1.6);
  k.hips.position.set(0, 0.95, 0);
  k.hips.rotation.set(0, 0, Math.sin(t * 0.5) * 0.02);
  k.hips.position.x = Math.sin(t * 0.5) * 0.01;
  k.torso.rotation.set(0.02 + b * 0.01, 0, 0);
  k.torso.scale.set(1, 1, 1);
  k.head.rotation.set(-0.04 + Math.sin(t * 0.5) * 0.03, Math.sin(t * 0.37) * 0.18 + Math.sin(t * 1.1) * 0.03, Math.sin(t * 0.29) * 0.04);
  const out = k.def.armsOut ?? 0.1;
  for (const [a, s, ph] of [[k.armL, 1, 0.4], [k.armR, -1, 0.9]]) {
    a.shoulder.rotation.set(Math.sin(t * 1.6 + ph) * 0.025, 0, s * out);
    a.elbow.rotation.set(-0.18, 0, 0);
    a.wrist.rotation.set(0, 0, 0);
  }
  for (const l of [k.legL, k.legR]) { l.hip.rotation.set(0, 0, l === k.legL ? 0.025 : -0.025); l.knee.rotation.x = 0; l.ankle.rotation.x = 0; }
}

// P: every few seconds, the sideways peace sign under the chin.
function peaceIdle(k, t, A) {
  baseIdle(k, t);
  const cyc = t % 7;
  const up = sm(1.0, 1.6, cyc) * (1 - sm(5.0, 5.6, cyc));
  A.handR = up > 0.5 ? mixPoses(HAND_POSES.relaxed, HAND_POSES.peace, sm(0.5, 0.75, up)) : null;
  if (up <= 0) return;
  const a = k.armR;
  const out = k.def.armsOut ?? 0.1;
  // solved so the wrist sits just under the chin, fingers pointing across
  a.shoulder.rotation.set(-1.163 * up, 0.786 * up, -out * (1 - up) + 0.282 * up);
  a.elbow.rotation.x = -0.18 + (-2.254 + 0.18) * up;
  a.wrist.rotation.set(-1.761 * up, -2.647 * up, -2.02 * up);
  // chin up, cool head tilt toward the hand
  k.head.rotation.x = -0.04 - 0.1 * up;
  k.head.rotation.z = -0.1 * up;
  k.head.rotation.y *= 1 - up;
  A.lookAway = up; // eyes on the camera, not darting about
}

// Rocco: bouncy, goofy, never still.
function goofyIdle(k, t, A) {
  baseIdle(k, t);
  const b = Math.abs(Math.sin(t * 4.2));
  k.hips.position.y = 0.95 - 0.02 + b * 0.035;
  k.hips.rotation.z = Math.sin(t * 4.2) * 0.07;
  k.torso.rotation.z = -Math.sin(t * 4.2) * 0.05;
  k.head.rotation.z = Math.sin(t * 4.2 + 0.6) * 0.12;
  k.head.rotation.y = Math.sin(t * 1.3) * 0.35;
  for (const l of [k.legL, k.legR]) { l.hip.rotation.x = -0.12 * (1 - b); l.knee.rotation.x = 0.25 * (1 - b); l.ankle.rotation.x = -0.12 * (1 - b); }
  // a little arm-pump dance every few seconds, finger guns blazing
  const dance = sm(3, 3.4, t % 8) * (1 - sm(6.2, 6.6, t % 8));
  for (const [a, s, ph] of [[k.armL, 1, 0], [k.armR, -1, Math.PI]]) {
    a.shoulder.rotation.x = -0.25 * dance + Math.sin(t * 8.4 + ph) * (0.08 + 0.45 * dance);
    a.shoulder.rotation.z = s * (0.14 + 0.25 * dance);
    a.elbow.rotation.x = -0.25 - 1.3 * dance;
    a.wrist.rotation.set(0.25 * dance, s * 0.3 * dance, 0);
  }
  const gun = sm(0.2, 0.6, dance);
  A.handL = A.handR = gun > 0 ? mixPoses(HAND_POSES.relaxed, HAND_POSES.fingerGun, gun) : null;
  A.noWeight = true;
}

// Erik: rubbing his hands together, bouncing with glee, fingers drumming.
function manicIdle(k, t, A) {
  baseIdle(k, t);
  const rub = Math.sin(t * 11);
  k.hips.position.y = 0.95 + Math.abs(Math.sin(t * 2.6)) * 0.012;
  k.torso.rotation.x = 0.1 + Math.sin(t * 2.6) * 0.02;
  k.head.rotation.set(-0.05 + Math.sin(t * 2.6) * 0.04, Math.sin(t * 0.7) * 0.25, Math.sin(t * 0.9) * 0.14);
  for (const [a, s] of [[k.armL, 1], [k.armR, -1]]) {
    a.shoulder.rotation.set(-0.153, -s * 0.563, -s * 0.258);
    a.elbow.rotation.x = -2.02 + rub * 0.05 * s;
    a.wrist.rotation.set(-0.321 + rub * 0.1, -s * 0.719, -s * 0.21);
  }
  // every few seconds the rubbing stops and the fingers drum, one after another
  const drum = sm(0, 0.3, (t % 6) - 3.2) * (1 - sm(0, 0.3, (t % 6) - 5.2));
  const mk = (ph) => ({
    curl: [0, 1, 2, 3].map((f) => 0.55 + drum * 0.5 * Math.max(0, Math.sin(t * 14 - f * 0.9 + ph))),
    spread: [-0.04, 0, 0.03, 0.07],
    thumb: { flex: 0.3, curl: 0.3, out: 0 },
  });
  A.handL = mk(0); A.handR = mk(0.4);
  A.noWeight = true;
}

function bigIdle(k, t) {
  baseIdle(k, t);
  k.torso.rotation.x = 0.0 + Math.sin(t * 1.2) * 0.012;
  k.head.rotation.x = -0.06;
}

function cheerfulIdle(k, t) {
  baseIdle(k, t);
  k.hips.position.y = 0.95 + Math.abs(Math.sin(t * 2.2)) * 0.006;
  k.head.rotation.z = Math.sin(t * 1.1) * 0.08;
}

function lankyIdle(k, t, A) {
  baseIdle(k, t);
  // weight on one leg, slouched
  k.hips.rotation.z = 0.06;
  k.hips.position.x = 0.025;
  k.torso.rotation.z = -0.05; k.torso.rotation.x = 0.06;
  k.legR.hip.rotation.z = -0.06; k.legL.knee.rotation.x = 0.15; k.legL.hip.rotation.x = -0.08;
  k.head.rotation.z = 0.06 + Math.sin(t * 0.4) * 0.04;
  A.noWeight = true;
}

const IDLES = { relaxed: baseIdle, peace: peaceIdle, goofy: goofyIdle, manic: manicIdle, big: bigIdle, cheerful: cheerfulIdle, lanky: lankyIdle };

// =============================================================================
// 2. life
// =============================================================================
function life(k, A, t, dt) {
  // breathing: chest swells, shoulders lift a touch
  const br = Math.sin(t * 1.55);
  k.torso.scale.set(1 + br * 0.006, 1 + br * 0.003, 1 + br * 0.012);
  for (const a of [k.armL, k.armR]) a.shoulder.position.y = a.shoulderY + Math.max(0, br) * 0.004;

  // weight shift from foot to foot (slow, irregular)
  if (!A.noWeight) {
    const w = Math.sin(t * 0.21) * 0.7 + Math.sin(t * 0.13 + 1.3) * 0.3;     // -1 .. 1, + = on his left foot
    k.hips.position.x += w * 0.016;
    k.hips.rotation.z += w * 0.035;
    k.torso.rotation.z -= w * 0.03;                                          // spine counters to stay upright
    // legs: keep the feet down, bend the knee of the leg taking it easy
    for (const [l, s] of [[k.legL, 1], [k.legR, -1]]) {
      l.hip.rotation.z -= w * 0.035;
      const ease = Math.max(0, -s * w);
      l.knee.rotation.x += ease * 0.14;
      l.hip.rotation.x -= ease * 0.07;
      l.ankle.rotation.x -= ease * 0.07;
    }
  }

  // blinking: every 2-6 s, sometimes twice
  if (t >= A.nextBlink) { A.blinkStart = t; A.nextBlink = t + 2 + rand(A) * 4; if (rand(A) < 0.2) A.nextBlink = t + 0.35; }
  const bt = t - A.blinkStart;
  const blink = bt < 0.07 ? bt / 0.07 : bt < 0.2 ? 1 - (bt - 0.07) / 0.13 : 0;

  // eyes: glance somewhere new every second or two, snap there, drift back
  if (t >= A.nextGaze) {
    A.nextGaze = t + 0.6 + rand(A) * 2.2;
    const away = rand(A) < 0.45;
    A.gazeTo.set(away ? (rand(A) - 0.5) * 0.7 : (rand(A) - 0.5) * 0.12, away ? (rand(A) - 0.5) * 0.3 : (rand(A) - 0.5) * 0.08);
  }
  if (A.lookAway) A.gazeTo.multiplyScalar(1 - A.lookAway);
  A.gaze.lerp(A.gazeTo, 1 - Math.exp(-dt * 22));
  // the head follows big glances a little, later
  A.headGaze.lerp(A.gaze, 1 - Math.exp(-dt * 2.5));
  k.head.rotation.y += A.headGaze.x * 0.35;
  k.head.rotation.x -= A.headGaze.y * 0.25;

  for (const e of k.face.eyes) {
    const u = e.userData;
    if (!u.ball) continue;
    u.ball.rotation.set(-A.gaze.y * 0.6, A.gaze.x * 0.55, 0);
    // the upper lid follows the eye up and down, and closes on a blink
    const lidFollow = -A.gaze.y * 0.35;
    u.upper.rotation.x = u.upperRest + lidFollow + (1.55 - u.upperRest) * blink;
    if (u.lower) u.lower.rotation.x = u.lowerRest + 0.18 * blink;
  }
}

// =============================================================================
// 3. gestures (two-bone IK in torso space)
// =============================================================================
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();

// Point the arm's wrist at `target` (torso space). pole: where the elbow points.
export function solveArm(arm, target, pole) {
  const a = arm.upperLen, b = arm.lowerLen;
  const T = target.clone().sub(arm.shoulder.position);
  const d = clamp(T.length(), 0.06, a + b - 0.003);
  T.setLength(d);
  const dir = T.clone().normalize();
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0);
  perp.normalize();
  const E = dir.clone().multiplyScalar(a * cosA).addScaledVector(perp, a * sinA);
  const ua = E.clone().normalize();
  const fa = T.clone().sub(E).normalize();
  const bend = Math.acos(clamp(ua.dot(fa), -1, 1));
  const z = fa.clone().addScaledVector(ua, -fa.dot(ua));
  if (z.lengthSq() < 1e-8) z.copy(perp).negate();
  z.normalize();
  const y = ua.clone().negate();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z));
  return { q, bend };
}

// Wrist rotation that gives the hand this orientation (torso space):
// fingers along `fingers`, palm facing `palm`.
export function orientHand(arm, shoulderQ, bend, fingers, palm) {
  const y = fingers.clone().normalize().negate();
  const z = palm.clone().addScaledVector(y, -palm.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  const want = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z));
  const parent = shoulderQ.clone().multiply(_q.setFromAxisAngle(V(1, 0, 0), -bend));
  return parent.invert().multiply(want).multiply(_q2.copy(arm.handGroup.quaternion).invert());
}

// Points on the head (head space, before its scale) -> torso space.
function headPoint(k, x, y, z) {
  const p = V(x, y, z);
  k.face.group.localToWorld(p);
  return k.torso.worldToLocal(p);
}

// Apply an IK result to an arm, blended with whatever the idle set (w 0..1).
export function applyArm(arm, sol, wristQ, w) {
  if (w <= 0) return;
  arm.shoulder.quaternion.slerp(sol.q, w);
  arm.elbow.rotation.x += (-sol.bend - arm.elbow.rotation.x) * w;
  arm.elbow.rotation.y *= 1 - w; arm.elbow.rotation.z *= 1 - w;
  arm.wrist.quaternion.slerp(wristQ, w);
}

// Each gesture: how long it lasts, how often it comes round, and what it does at
// time g (seconds into the gesture) with blend weight w.
const GESTURES = {
  // Kearns: strokes his beard, pleased with himself
  beard: { dur: 3.6, every: 10, run(k, A, g, w) {
    const arm = k.armR, s = -1;
    const chin = headPoint(k, 0, -0.115, 0.062);
    const stroke = Math.sin(g * 5.2) * 0.012 * sm(0.5, 0.9, g) * (1 - sm(2.8, 3.2, g));
    const target = chin.clone().add(V(0.004, -0.07 + stroke, 0.03));
    const sol = solveArm(arm, target, V(s * 0.7, -1, -0.15));
    const wq = orientHand(arm, sol.q, sol.bend, chin.clone().sub(target).add(V(0, 0, 0.02)), V(-s * 1, 0.2, -0.6));
    applyArm(arm, sol, wq, w);
    A.handR = mixPoses(HAND_POSES.relaxed, HAND_POSES.cupped, w);
    k.head.rotation.x -= 0.08 * w; // chin up into the hand
    A.lookAway = w * 0.6;
  } },
  // Ryan: punches a fist into his palm. Twice.
  fistPalm: { dur: 3, every: 9, run(k, A, g, w) {
    const chestY = k.armL.shoulderY - 0.17, front = 0.24;
    const palmAt = V(0.035, chestY, front);
    const solL = solveArm(k.armL, palmAt, V(0.8, -1, -0.3));
    applyArm(k.armL, solL, orientHand(k.armL, solL.q, solL.bend, V(0.15, 0.45, 1), V(-1, 0, 0)), w);
    const hits = Math.max(0, Math.sin(Math.max(0, g - 0.6) * Math.PI * 1.6));
    const fistAt = V(-0.07 - 0.13 * (1 - hits), chestY + 0.005, front + 0.015);
    const solR = solveArm(k.armR, fistAt, V(-0.8, -1, -0.4));
    applyArm(k.armR, solR, orientHand(k.armR, solR.q, solR.bend, V(1, 0.05, 0.25), V(0, -1, 0.2)), w);
    A.handL = mixPoses(HAND_POSES.relaxed, HAND_POSES.open, w);
    A.handR = mixPoses(HAND_POSES.relaxed, HAND_POSES.fist, w);
    k.torso.rotation.y += 0.06 * hits * w;
    A.lookAway = w * 0.8;
  } },
  // Chops and Regs: a big thumbs up
  thumbsUp: { dur: 2.8, every: 9, run(k, A, g, w) {
    const arm = k.armR;
    const target = V(-0.1, arm.shoulderY - 0.16 + 0.015 * Math.sin(g * 3), 0.27);
    const sol = solveArm(arm, target, V(-0.9, -1, -0.3));
    applyArm(arm, sol, orientHand(arm, sol.q, sol.bend, V(0.25, -0.05, 1), V(1, 0, 0.1)), w);
    A.handR = mixPoses(HAND_POSES.relaxed, HAND_POSES.thumbsUp, sm(0.2, 0.7, w));
    k.head.rotation.z += 0.06 * w;
    A.lookAway = w;
  } },
  // Brian: a big friendly wave
  wave: { dur: 3, every: 8.5, run(k, A, g, w) {
    const arm = k.armR, s = -1;
    const S = arm.shoulder.position;
    const target = V(S.x + s * 0.14, S.y + 0.33, S.z + 0.05);
    const sol = solveArm(arm, target, V(s * 1, -0.7, -0.2));
    const sway = Math.sin(g * 9) * 0.45 * sm(0.4, 0.8, g);
    applyArm(arm, sol, orientHand(arm, sol.q, sol.bend, V(sway, 1, 0.08), V(0, 0, 1)), w);
    A.handR = mixPoses(HAND_POSES.relaxed, HAND_POSES.open, w);
    k.head.rotation.z -= 0.05 * w;
    A.lookAway = w;
  } },
  // Zach: claps (happy to be here)
  clap: { dur: 2.6, every: 8, run(k, A, g, w) {
    const y = k.armL.shoulderY - 0.15, z = 0.26;
    const open = 0.5 + 0.5 * Math.cos(Math.max(0, g - 0.5) * Math.PI * 2 * 2.4);
    const gap = 0.02 + 0.07 * open * sm(0.3, 0.6, g);
    for (const [arm, s, key] of [[k.armL, 1, 'handL'], [k.armR, -1, 'handR']]) {
      const sol = solveArm(arm, V(s * gap, y, z), V(s * 0.9, -1, -0.35));
      applyArm(arm, sol, orientHand(arm, sol.q, sol.bend, V(-s * 0.15, 0.6, 1), V(-s, 0, 0)), w);
      A[key] = mixPoses(HAND_POSES.relaxed, HAND_POSES.open, w * 0.8);
    }
    A.lookAway = w * 0.5;
  } },
  // Pit: scratches the back of his head, no rush
  headScratch: { dur: 3.4, every: 11, run(k, A, g, w) {
    const arm = k.armR, s = -1;
    const spot = headPoint(k, s * 0.055, 0.07, -0.045);
    const scratch = Math.sin(g * 11) * 0.01 * sm(0.6, 1, g) * (1 - sm(2.6, 3, g));
    const target = spot.clone().add(V(s * 0.06, -0.05 + scratch, -0.04));
    const sol = solveArm(arm, target, V(s * 1, 0.1, -0.2));
    applyArm(arm, sol, orientHand(arm, sol.q, sol.bend, spot.clone().sub(target), V(-s * 0.6, 0.2, 0.6)), w);
    A.handR = mixPoses(HAND_POSES.relaxed, HAND_POSES.claw, w);
    k.head.rotation.x += 0.08 * w; k.head.rotation.z += 0.06 * w;
    A.lookAway = w * 0.3;
  } },
};

// Trigger a gesture now (e.g. when a character is picked on the select screen).
export function setGesture(k, name = null) {
  const A = k.anim;
  if (!A) return;
  A.forceGesture = name || k.def.gesture || null;
}

function gestures(k, A, t) {
  const G = GESTURES[k.def.gesture];
  if (!G) return;
  if (A.forceGesture && GESTURES[A.forceGesture]) { A.gStart = t; A.forceGesture = null; }
  if (A.gStart == null) A.gStart = t + 2 + (k.phase % 1) * G.every;
  if (t > A.gStart + G.dur) A.gStart = t + G.every * (0.7 + rand(A) * 0.6);
  const g = t - A.gStart;
  if (g < 0) return;
  const w = sm(0, 0.45, g) * (1 - sm(G.dur - 0.5, G.dur, g));
  k.root.updateMatrixWorld(true);
  G.run(k, A, g, w);
}

// =============================================================================
// fingers: the hands are never quite still
// =============================================================================
function fingers(k, A, t) {
  for (const [arm, key, ph] of [[k.armL, 'handL', 0], [k.armR, 'handR', 2.1]]) {
    if (!arm.hand || !arm.hand.set) continue;
    let pose = A[key];
    if (!pose) {
      const f = Math.sin(t * 0.7 + ph) * 0.08;
      const R = HAND_POSES.relaxed;
      pose = { curl: R.curl.map((c, i) => c + f * (1 + i * 0.3) + Math.sin(t * 0.43 + i + ph) * 0.04), spread: R.spread, thumb: R.thumb };
    }
    arm.hand.set(pose);
  }
}

// =============================================================================
export function idleCharacter(k, t) {
  t += k.phase;
  const A = k.anim || (k.anim = {
    lastT: t, seed: Math.floor(k.phase * 1000) + 7, nextBlink: t + 1, blinkStart: -10,
    nextGaze: t + 0.5, gaze: new THREE.Vector2(), gazeTo: new THREE.Vector2(), headGaze: new THREE.Vector2(),
  });
  const dt = clamp(t - A.lastT, 0, 0.1);
  A.lastT = t;
  A.handL = A.handR = null; A.noWeight = false; A.lookAway = 0;
  (IDLES[k.def.idle] || baseIdle)(k, t, A);
  gestures(k, A, t);
  life(k, A, t, dt);
  fingers(k, A, t);
}
export function idleKearns(k, t) { idleCharacter(k, t); }
