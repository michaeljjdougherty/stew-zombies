// =============================================================================
// The Schnitz's cage (Call of the Crust): an iron-barred crate hanging by a
// chain out over the void past the Anvil's north rim, Chops, Regs and P
// inside. The chain runs up into a slow green whirl in the sky (where the
// Schnitz watches from). One of you has to go over the edge to get them out.
// The forge view hangs it in the world; the cutscenes move it (lower it, swing
// the door open, empty it).
//   pivot: the top of the chain (the whirl); the cage hangs `len` below it
// Numbers: CONFIG.crust.cage.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';
import { buildCharacter, idleCharacter } from './characters.js';
import { CONFIG } from '../config.js';

const C = () => CONFIG.crust.cage;

function whirlTexture() {
  const [c, g] = T.makeCanvas(256, 256);
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = (x + 0.5) / 128 - 1, v = (y + 0.5) / 128 - 1, r = Math.hypot(u, v), a = Math.atan2(v, u);
    const arms = 0.5 + 0.5 * Math.sin(a * 3 - r * 9);
    const k = Math.max(0, 1 - r) * (0.35 + 0.65 * arms) * (r < 0.12 ? r / 0.12 : 1);
    const i = (y * 256 + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = Math.round(Math.min(1, k) * 255);
  }
  g.putImageData(img, 0, 0);
  return T.toTexture(c, { repeat: false });
}
let whirlTex = null;

export class CrustCage {
  // at: where the chain's top is ({x, y, z}); len: chain length down to the cage's roof
  constructor(parent, at, { len = C().chain, map = null, occupants = ['chops', 'regs', 'p'] } = {}) {
    this.parent = parent;
    this.map = map;
    this.pivot = new THREE.Group();
    this.pivot.position.set(at.x, at.y, at.z);
    parent.add(this.pivot);
    this.len = len;
    this.time = 0;
    this.sway = 1;
    const L = C();
    const W = L.size[0], H = L.size[1], D = L.size[2];
    this.size = { W, H, D };
    // the cage: hangs under the chain (its origin at its floor's middle)
    this.cage = new THREE.Group();
    this.pivot.add(this.cage);
    const wood = new THREE.MeshStandardMaterial({ color: '#3e2c1e', roughness: 0.85 });
    const iron = new THREE.MeshStandardMaterial({ color: '#2c2c30', roughness: 0.45, metalness: 0.85 });
    const add = (geo, mat, x, y, z, parent = this.cage) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    add(new THREE.BoxGeometry(W, 0.12, D), wood, 0, 0.06, 0);                 // floor
    add(new THREE.BoxGeometry(W, 0.1, D), wood, 0, H, 0);                      // roof
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.14, H, 0.14), wood, sx * (W / 2 - 0.07), H / 2, sz * (D / 2 - 0.07));
    // bars on three sides; the fourth (+z, toward the island) is the door
    const bar = new THREE.CylinderGeometry(0.022, 0.022, H - 0.12, 6);
    for (let x = -W / 2 + 0.2; x < W / 2 - 0.1; x += L.barGap) add(bar, iron, x, H / 2, -D / 2 + 0.05);
    for (const sx of [-1, 1]) for (let z = -D / 2 + 0.2; z < D / 2 - 0.1; z += L.barGap) add(bar, iron, sx * (W / 2 - 0.05), H / 2, z);
    for (const y of [0.5, H - 0.4]) {
      add(new THREE.BoxGeometry(W, 0.05, 0.05), iron, 0, y, -D / 2 + 0.05);
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.05, D), iron, sx * (W / 2 - 0.05), y, 0);
    }
    // the door: hinged at its left edge
    this.door = new THREE.Group(); this.door.position.set(-W / 2 + 0.07, 0, D / 2 - 0.05); this.cage.add(this.door);
    for (let x = 0.15; x < W - 0.2; x += L.barGap) add(bar, iron, x, H / 2, 0, this.door);
    for (const y of [0.5, H - 0.4]) add(new THREE.BoxGeometry(W - 0.14, 0.05, 0.05), iron, (W - 0.14) / 2, y, 0, this.door);
    add(new THREE.BoxGeometry(0.12, 0.3, 0.12), iron, W - 0.3, H / 2, 0.04, this.door);   // the lock
    // the ring on the roof, and the chain up from it
    add(new THREE.TorusGeometry(0.16, 0.035, 6, 14), iron, 0, H + 0.2, 0).rotation.y = Math.PI / 2;
    const link = new THREE.TorusGeometry(0.11, 0.028, 5, 10);
    this.links = new THREE.InstancedMesh(link, iron, L.maxLinks);
    this.links.frustumCulled = false;
    this.pivot.add(this.links);
    // the whirl at the top
    whirlTex = whirlTex || whirlTexture();
    this.whirl = [];
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(L.whirl * (1 + i * 0.5), L.whirl * (1 + i * 0.5)), new THREE.MeshBasicMaterial({ map: whirlTex, color: new THREE.Color(L.whirlColor).multiplyScalar(i ? 0.9 : 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false }));
      m.rotation.x = -Math.PI / 2; this.pivot.add(m); this.whirl.push(m);
    }
    // who's inside
    this.boys = occupants.map((id, i) => {
      const k = buildCharacter(id, { detail: L.detail });
      k.root.scale.multiplyScalar(L.boyScale);
      k.root.position.set((i - (occupants.length - 1) / 2) * (W / occupants.length) * 0.9, 0.12, -0.15 + (i % 2) * 0.3);
      k.root.rotation.y = (i - 1) * 0.25;
      this.cage.add(k.root);
      return { id, k };
    });
    this.light = map ? map.addVirtualLight({ x: at.x, y: at.y - len, z: at.z }, new THREE.Color(L.lightColor).getHex(), L.light, L.lightRange, 1.6) : null;
    if (this.light) this.light.live = true;
    this.doorOpen = 0;
    this.place();
  }

  // the chain: links from the cage's roof up to the whirl
  place() {
    const L = C(), H = this.size.H;
    this.cage.position.set(0, -this.len - H - 0.3, 0);
    const n = Math.min(L.maxLinks, Math.ceil(this.len / L.linkStep));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      e.set(0, (i % 2) * Math.PI / 2, Math.PI / 2); q.setFromEuler(e);
      p.set(0, -i * L.linkStep - 0.1, 0);
      m.compose(p, q, s);
      this.links.setMatrixAt(i, m);
    }
    this.links.count = n;
    this.links.instanceMatrix.needsUpdate = true;
  }

  setLen(len) { if (Math.abs(len - this.len) > 1e-3) { this.len = len; this.place(); } }

  // where the cage's floor is now (world)
  floorPos(out = new THREE.Vector3()) { this.cage.updateMatrixWorld(true); return this.cage.getWorldPosition(out); }

  update(dt, time) {
    this.time += dt;
    const L = C(), t = this.time;
    // swaying on its chain (the pivot swings), turning a little
    this.pivot.rotation.set(Math.sin(t * L.swayRate) * L.sway * this.sway, 0, Math.sin(t * L.swayRate * 0.77 + 1) * L.sway * 0.7 * this.sway);
    this.cage.rotation.y = Math.sin(t * 0.3) * 0.12 * this.sway;
    this.whirl[0].rotation.z = t * 0.35; this.whirl[1].rotation.z = -t * 0.2;
    this.door.rotation.y = -this.doorOpen * 1.9;
    for (const [i, b] of this.boys.entries()) {
      if (!b.k.root.visible) continue;
      idleCharacter(b.k, time + i * 1.7);
      // hands on the bars, shaking them now and then
      const shake = Math.max(0, Math.sin(time * 1.3 + i * 2.1));
      for (const a of [b.k.armL, b.k.armR]) {
        a.shoulder.rotation.x = -1.2 - shake * 0.5 * (a === b.k.armR ? 1 : 0.6) + Math.sin(time * 14 + i) * 0.06 * shake;
        a.elbow.rotation.x = -0.6;
      }
    }
    if (this.light) { const f = this.floorPos(this.tmp || (this.tmp = new THREE.Vector3())); this.light.pos.set(f.x, f.y + 2.5, f.z + 1.5); }
  }

  dispose() {
    this.parent.remove(this.pivot);
    if (this.light && this.map) this.map.removeVirtualLight(this.light);
  }
}
