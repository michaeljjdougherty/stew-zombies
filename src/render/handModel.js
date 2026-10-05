// =============================================================================
// The first-person hand: a sculpted, rigged hand (built offline by
// tools/hands/build_hand.py from "3D Rigged Hand" by Emma L. D. Lieker).
//
// It lives in the same hand space as the built-in hand in hands.js (wrist at
// the origin, fingers down -Y, palm +Z, thumb on the -X side) and takes the
// same poses ({ curl[4], spread[4], thumb: { flex, curl, out } }), so the
// gun grips set up for that hand drive this one too. Each joint bends about
// its own hinge axis (worked out from the bones at build time), the way real
// knuckles do: fingers fold toward the palm, the thumb folds across it.
// =============================================================================
import * as THREE from 'three';

const BASE = 'assets/hands/';
const FINGER = ['index', 'midd', 'ring', 'pinky'];

async function fetchBin(name) {
  try {
    const r = await fetch(BASE + name + '.bin');
    if (r.ok) return await r.arrayBuffer();
  } catch { /* try the other form */ }
  const r = await fetch(BASE + name + '.bin.json');
  if (!r.ok) throw new Error(name + '.bin ' + r.status);
  const s = atob((await r.json()).b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}

// Joint angles for a finger curl c (knuckle, middle joint, tip joint), the
// same curve the built-in hand uses, less the bend the model already has at rest.
const curlAngles = (c) => [c * 0.62 + 0.04, c * 0.98 + 0.02, c * 0.66 + 0.01];

class HandLib {
  constructor() { this.ready = false; this.failed = false; this.loading = null; }

  load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const [meta, bin] = await Promise.all([fetch(BASE + 'hand.json').then((r) => r.json()), fetchBin('hand')]);
      const L = meta.layout, n = meta.verts;
      const view = (T, k) => new T(bin, L[k][0], L[k][1]);
      const q = view(Uint16Array, 'pos'), lo = meta.lo, hi = meta.hi;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) { const a = i % 3; pos[i] = lo[a] + (q[i] / 65535) * (hi[a] - lo[a]); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const nb = view(Int8Array, 'nrm'), n3 = new Int8Array(n * 3);
      for (let i = 0; i < n; i++) { n3[i * 3] = nb[i * 4]; n3[i * 3 + 1] = nb[i * 4 + 1]; n3[i * 3 + 2] = nb[i * 4 + 2]; }
      g.setAttribute('normal', new THREE.BufferAttribute(n3, 3, true));
      g.setAttribute('skinIndex', new THREE.BufferAttribute(view(Uint8Array, 'si'), 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(view(Uint8Array, 'sw'), 4, true));
      g.setIndex(new THREE.BufferAttribute(view(Uint16Array, 'idx'), 1));
      g.computeBoundingSphere();
      g.boundingSphere.radius *= 1.5;
      this.geometry = g;
      this.bones = meta.bones;
      this.ready = true;
    })().catch((err) => { console.warn('hand model:', err); this.failed = true; });
    return this.loading;
  }

  // A posable hand: { group, set(pose), state } like hands.js buildHand().
  build(skinMat) {
    const byName = {};
    const bones = this.bones.map((b) => { const o = new THREE.Bone(); o.name = b.name; byName[b.name] = o; return o; });
    let root = null;
    this.bones.forEach((b, i) => {
      const o = bones[i];
      const pp = b.parent ? this.bones.find((x) => x.name === b.parent).pos : [0, 0, 0];
      o.position.set(b.pos[0] - pp[0], b.pos[1] - pp[1], b.pos[2] - pp[2]);
      o.userData.curl = new THREE.Vector3(...b.curl);
      o.userData.side = new THREE.Vector3(...b.side);
      if (b.parent) byName[b.parent].add(o); else root = o;
    });
    const mesh = new THREE.SkinnedMesh(this.geometry, skinMat);
    mesh.add(root);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.frustumCulled = false;
    const group = new THREE.Group();
    group.add(mesh);
    const hand = {
      group, mesh, state: null,
      fingers: FINGER.map((f) => ['prox', 'midd', 'dist'].map((k) => byName[f + '_' + k])),
      thumb: ['meta', 'prox', 'dist'].map((k) => byName['thumb_' + k]),
    };
    hand.set = (pose) => setHand(hand, pose);
    return hand;
  }
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), aim = new THREE.Vector3();
// bend: about the joint's hinge; swing: about its side axis (applied after)
function pose(bone, bend, swing = 0) {
  qa.setFromAxisAngle(bone.userData.curl, bend);
  if (swing) { qb.setFromAxisAngle(bone.userData.side, swing); bone.quaternion.multiplyQuaternions(qb, qa); }
  else bone.quaternion.copy(qa);
}

function setHand(hand, p) {
  hand.state = p;
  // explicit joint angles (radians): { f: [[knuckle, middle, tip] x4], s: [spread x4], t: [flex, out, base, tip] }
  // (td: aim the thumb at this hand-space direction instead of flex/out)
  if (p.f) {
    p.f.forEach(([a, b, d], f) => { const [j0, j1, j2] = hand.fingers[f]; pose(j0, a, (p.s && p.s[f]) || 0); pose(j1, b); pose(j2, d); });
    const [fl, out, tb, tt] = p.t;
    if (p.td) {
      // aim the thumb's long bone straight at a direction (hand space)
      const rest = hand.thumb[1].position.clone().normalize();
      hand.thumb[0].quaternion.setFromUnitVectors(rest, aim.set(...p.td).normalize());
    } else pose(hand.thumb[0], fl, out);
    pose(hand.thumb[1], tb); pose(hand.thumb[2], tt);
    return;
  }
  p.curl.forEach((c, f) => {
    const [a, b, d] = curlAngles(c);
    const [j0, j1, j2] = hand.fingers[f];
    pose(j0, a, p.spread[f] || 0);
    pose(j1, b);
    pose(j2, d);
  });
  const T = p.thumb;
  // the thumb's base joint swings it across the palm (flex) or out to the side
  pose(hand.thumb[0], T.flex * 0.55, T.out * 0.8);
  pose(hand.thumb[1], T.flex * 0.3 + T.curl * 0.55);
  pose(hand.thumb[2], T.curl * 0.85);
}

export const handModel = new HandLib();
