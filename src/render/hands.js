// =============================================================================
// Rigged hands for the crew. Unlike the zombies' one-piece hands, these are
// built from parts on joints so they can make real poses: a palm (with the
// thumb's fleshy base), four fingers of three bones each, a thumb, and nails.
//
// Hand space: the wrist is at the origin, the hand hangs down (-Y), the palm
// faces +Z and the thumb is on the -X side. Bending a finger joint rotates it
// about its local X axis (negative = curl toward the palm).
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loft } from './human.js';

// One finger bone, hanging from its joint (y = 0) to the next (y = -len).
// Slightly wider than deep, a knuckle bulge at the top, rounded ends.
const boneCache = new Map();
function boneGeometry(len, r0, r1, tip = false) {
  const key = [len, r0, r1, tip].map((v) => (typeof v === 'number' ? v.toFixed(4) : v)).join();
  if (boneCache.has(key)) return boneCache.get(key);
  const secs = [];
  const top = r0 * 0.6;                      // dome above the joint, tucked into the bone before
  const bottom = tip ? 0 : r1 * 0.5;         // runs on past the next joint so they overlap
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;                          // 0 = far end, 1 = top of the dome
    const y = -len - bottom + (len + bottom + top) * t;
    const along = Math.min(1, Math.max(0, (y + len) / len));   // 0 at the next joint, 1 at this one
    let r = r1 + (r0 - r1) * along;
    r *= 1 + 0.06 * Math.exp(-(((along - 0.88) / 0.12) ** 2));        // knuckle
    r *= 1 - 0.04 * Math.exp(-(((along - 0.45) / 0.22) ** 2));        // waist
    if (y > 0) r *= Math.sqrt(Math.max(0.02, 1 - (y / top) ** 2));     // dome
    if (tip) {
      const u = 1 - along;                    // 0 .. 1 toward the fingertip
      if (u > 0.62) r *= Math.sqrt(Math.max(0.0025, 1 - ((u - 0.62) / 0.38) ** 2));
    }
    // the pad of the fingertip is fuller on the palm side
    secs.push({ y, rx: r * 1.08, rz: r * 0.92, z: tip ? 0.1 * r * Math.sin(along * Math.PI) : 0 });
  }
  const g = loft(secs, { radial: 12, capBottom: !tip, capTop: false });
  g.deleteAttribute('uv');
  boneCache.set(key, g);
  return g;
}

// Palm: rounded-rectangle sections from the wrist to the knuckles, thicker at
// the heel of the hand, plus the pads at the base of the thumb and pinky.
const palmCache = new Map();
function palmGeometry(size) {
  const key = size.toFixed(3);
  if (palmCache.has(key)) return palmCache.get(key);
  const s = size;
  const secs = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;                          // 0 = past the knuckles, 1 = wrist
    const y = (-0.1 + 0.1 * t) * s;
    const end = Math.min(1, t / 0.12);        // rounds off the knuckle end
    const w = (0.041 - 0.013 * t ** 1.6) * s * (0.82 + 0.18 * Math.sqrt(end));
    const d = (0.0115 + 0.0055 * Math.sin(t * Math.PI * 0.85)) * s * (0.7 + 0.3 * Math.sqrt(end));
    secs.push({ y, rx: w, rz: d, z: (0.0015 * Math.sin(t * Math.PI) - 0.001) * s, sq: 2.5 });
  }
  const palm = loft(secs, { radial: 24 });
  palm.deleteAttribute('uv');
  // thenar pad (thumb muscle) on the palm side by the thumb
  const thenar = new THREE.SphereGeometry(1, 14, 10);
  thenar.scale(0.021 * s, 0.034 * s, 0.014 * s);
  thenar.rotateZ(-0.45);
  thenar.translate(-0.024 * s, -0.04 * s, 0.011 * s);
  thenar.deleteAttribute('uv');
  // hypothenar (pinky side heel)
  const hypo = new THREE.SphereGeometry(1, 12, 8);
  hypo.scale(0.013 * s, 0.03 * s, 0.009 * s);
  hypo.translate(0.026 * s, -0.045 * s, 0.008 * s);
  hypo.deleteAttribute('uv');
  // knuckles: the heads of the hand bones show as bumps along the back
  const knuckles = [[-0.0285, -0.088, 0.0105], [-0.0093, -0.092, 0.011], [0.0098, -0.09, 0.0102], [0.0278, -0.083, 0.009]].map(([x, y, r]) => {
    const k = new THREE.SphereGeometry(1, 10, 8);
    k.scale(r * 0.85 * s, r * 0.8 * s, r * 0.7 * s);
    k.translate(x * s, (y + 0.007) * s, -0.0055 * s);
    k.deleteAttribute('uv');
    return k.toNonIndexed();
  });
  // keep each part's smooth normals (recomputing on the merged, unindexed mesh would facet it)
  const g = mergeGeometries([palm.index ? palm.toNonIndexed() : palm, thenar.toNonIndexed(), hypo.toNonIndexed(), ...knuckles]);
  palmCache.set(key, g);
  return g;
}

const nailGeo = (() => {
  const g = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
  g.rotateX(-Math.PI / 2);                         // dome faces -Z (the back of the finger)
  g.deleteAttribute('uv');
  return g;
})();

// Finger layout: knuckle position (x, y, z), bone lengths, radius, fan angle.
const FINGERS = [
  { x: -0.0285, y: -0.092, len: [0.039, 0.024, 0.0195], r: 0.0094, fan: -0.07 }, // index
  { x: -0.0093, y: -0.096, len: [0.043, 0.027, 0.0205], r: 0.0097, fan: -0.015 }, // middle
  { x: 0.0098, y: -0.094, len: [0.041, 0.026, 0.0198], r: 0.0092, fan: 0.035 }, // ring
  { x: 0.0278, y: -0.087, len: [0.032, 0.019, 0.0172], r: 0.0081, fan: 0.1 },   // pinky
];

// Build a hand. Returns { group, fingers: [[mcp, pip, dip]...], thumb: {...}, set(pose) }.
export function buildHand(skinMat, nailMat, { size = 1 } = {}) {
  const s = size;
  const group = new THREE.Group();
  group.add(new THREE.Mesh(palmGeometry(s), skinMat));
  const fingers = [];
  for (const F of FINGERS) {
    const base = new THREE.Group();
    base.position.set(F.x * s, F.y * s, 0.0005 * s);
    base.rotation.z = F.fan;
    group.add(base);
    const joints = [];
    let parent = base;
    for (let k = 0; k < 3; k++) {
      const j = new THREE.Group();
      if (k > 0) j.position.y = -F.len[k - 1] * s;
      parent.add(j);
      const r0 = F.r * s * [1, 0.9, 0.82][k], r1 = F.r * s * [0.92, 0.84, 0.74][k];
      j.add(new THREE.Mesh(boneGeometry(F.len[k] * s, r0, r1, k === 2), skinMat));
      if (k === 2) {
        const nail = new THREE.Mesh(nailGeo, nailMat);
        nail.scale.set(r1 * 0.78, F.len[2] * s * 0.36, r1 * 0.28);
        nail.position.set(0, -F.len[2] * s * 0.56, -r1 * 0.78);
        j.add(nail);
      }
      joints.push(j);
      parent = j;
    }
    fingers.push(joints);
  }
  // Thumb: its base sits in the heel of the hand, pointing down, forward and
  // out. In the thumb's own frame it flexes toward local +Z (across the palm).
  const thumbBase = new THREE.Group();
  thumbBase.position.set(-0.026 * s, -0.022 * s, 0.006 * s);
  {
    const dir = new THREE.Vector3(-0.42, -1, 0.5).normalize();          // along the thumb
    const flex = new THREE.Vector3(1, 0, 0.75);                          // toward the palm
    flex.addScaledVector(dir, -flex.dot(dir)).normalize();
    const yAxis = dir.clone().negate();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, flex).normalize();
    thumbBase.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, flex));
  }
  group.add(thumbBase);
  const TL = [0.04, 0.031, 0.026], TR = [0.0128, 0.0112, 0.0102];
  const thumb = [];
  let parent = thumbBase;
  for (let k = 0; k < 3; k++) {
    const j = new THREE.Group();
    if (k > 0) j.position.y = -TL[k - 1] * s;
    parent.add(j);
    j.add(new THREE.Mesh(boneGeometry(TL[k] * s, TR[k] * s, TR[k] * s * (k === 2 ? 0.8 : 0.9), k === 2), skinMat));
    if (k === 2) {
      const nail = new THREE.Mesh(nailGeo, nailMat);
      const r = TR[2] * s * 0.8;
      nail.scale.set(r * 0.85, TL[2] * s * 0.38, r * 0.3);
      nail.position.set(0, -TL[2] * s * 0.55, -r * 0.82);
      j.add(nail);
    }
    thumb.push(j);
    parent = j;
  }
  const hand = { group, fingers, thumb, state: null };
  hand.set = (pose) => setHand(hand, pose);
  hand.set(HAND_POSES.relaxed);
  return hand;
}

// --- poses ------------------------------------------------------------------------
// curl: per finger 0 (straight) .. 1.6 (fist). spread: extra fan per finger.
// thumb: { flex: across the palm 0..1.2, curl: bend of its two joints, out: swing away }
export const HAND_POSES = {
  relaxed: { curl: [0.42, 0.5, 0.58, 0.66], spread: [0, 0, 0, 0], thumb: { flex: 0.15, curl: 0.25, out: 0 } },
  open: { curl: [0.04, 0.03, 0.05, 0.08], spread: [-0.12, -0.03, 0.06, 0.16], thumb: { flex: -0.1, curl: 0.05, out: 0.35 } },
  fist: { curl: [1.55, 1.6, 1.6, 1.6], spread: [0.05, 0, -0.02, -0.06], thumb: { flex: 0.85, curl: 0.6, out: -0.1 } },
  peace: { curl: [0, 0, 1.6, 1.6], spread: [-0.2, 0.18, 0, -0.04], thumb: { flex: 0.95, curl: 0.55, out: -0.1 } },
  point: { curl: [0, 1.5, 1.6, 1.6], spread: [0, 0, 0, -0.04], thumb: { flex: 0.6, curl: 0.4, out: 0 } },
  fingerGun: { curl: [0, 1.5, 1.6, 1.6], spread: [0, 0, 0, -0.04], thumb: { flex: -0.25, curl: 0.0, out: 0.55 } },
  thumbsUp: { curl: [1.55, 1.6, 1.6, 1.6], spread: [0.05, 0, -0.02, -0.06], thumb: { flex: -0.35, curl: -0.1, out: 0.45 } },
  cupped: { curl: [0.75, 0.8, 0.85, 0.9], spread: [0, 0, 0, 0], thumb: { flex: 0.5, curl: 0.35, out: 0 } },
  claw: { curl: [0.55, 0.6, 0.65, 0.7], spread: [-0.15, -0.04, 0.06, 0.18], thumb: { flex: 0.2, curl: 0.5, out: 0.2 } },
};

// Joint angles for a finger curl c: knuckle, middle joint, tip joint.
const curlAngles = (c) => [0.1 + c * 0.62, 0.08 + c * 0.98, 0.04 + c * 0.66];

function setHand(hand, pose) {
  hand.state = pose;
  pose.curl.forEach((c, f) => {
    const [a, b, d] = curlAngles(c);
    const j = hand.fingers[f];
    j[0].rotation.set(-a, 0, (pose.spread[f] || 0));
    j[1].rotation.x = -b;
    j[2].rotation.x = -d;
  });
  const T = pose.thumb;
  hand.thumb[0].rotation.set(-T.flex * 0.7, 0, -T.out);
  hand.thumb[1].rotation.x = -(T.flex * 0.35 + T.curl * 0.6);
  hand.thumb[2].rotation.x = -T.curl * 0.9;
}

// Blend two poses (k = 0 -> a, 1 -> b).
export function mixPoses(a, b, k) {
  const L = (x, y) => x + (y - x) * k;
  return {
    curl: a.curl.map((v, i) => L(v, b.curl[i])),
    spread: a.spread.map((v, i) => L(v, b.spread[i])),
    thumb: { flex: L(a.thumb.flex, b.thumb.flex), curl: L(a.thumb.curl, b.thumb.curl), out: L(a.thumb.out, b.thumb.out) },
  };
}
