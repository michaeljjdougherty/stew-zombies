// =============================================================================
// The Ship Graveyard's screw-pile lighthouse, built here rather than from a
// downloaded model (that one came apart: faces missing, sheets hanging in the
// air, piles that stopped short of the ground and beams you walked through).
// Iron piles from the mesa up to a plank porch, the keeper's red house on it,
// a hip roof, and the lantern tower on top with the lamp inside its glass.
// Every solid piece here has a matching box in src/map/crust.js (the piles,
// the house), so what you see is what stops you.
//   d: { x, z, mesa, porch, house, piles: [[dx, dz]...], tower }
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// a box whose texture repeats per metre (so the planks and plates aren't stretched)
function box(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
  return g;
}
const at = (g, x, y, z) => { g.translate(x, y, z); return g.index ? g.toNonIndexed() : g; };
function strut(a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const g = new THREE.CylinderGeometry(r, r, A.distanceTo(B), 6, 1, false);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g.toNonIndexed();
}
const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k); return g; }));

export function buildLighthouse(group, d, mats) {
  const root = new THREE.Group(); root.name = 'lighthouse';
  root.position.set(d.x, 0, d.z);
  group.add(root);
  const M = d.mesa, P = d.porch, H = d.house / 2;
  const iron = new THREE.MeshStandardMaterial({ color: '#3c3a3e', roughness: 0.55, metalness: 0.7, emissive: new THREE.Color('#0c0c10') });
  const red = new THREE.MeshStandardMaterial({ color: '#b2413a', roughness: 0.8, emissive: new THREE.Color('#2a0a08') });
  const white = new THREE.MeshStandardMaterial({ color: '#e8e2d6', roughness: 0.7, emissive: new THREE.Color('#1c1a18') });
  const roof = new THREE.MeshStandardMaterial({ color: '#2e3034', roughness: 0.6, metalness: 0.4, emissive: new THREE.Color('#08080a') });
  const glass = new THREE.MeshStandardMaterial({ color: '#fff2c8', roughness: 0.1, transparent: true, opacity: 0.35, emissive: new THREE.Color('#ffd890'), emissiveIntensity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const deck = mats && mats.planks ? mats.planks : new THREE.MeshStandardMaterial({ color: '#6a5440', roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: '#141a22', roughness: 0.2, metalness: 0.3, emissive: new THREE.Color('#2a2210') });

  // --- the piles: iron columns down onto screw feet, tie beams and cross-bracing up top
  const ironG = [];
  for (const [px, pz] of d.piles) {
    ironG.push(at(new THREE.CylinderGeometry(0.24, 0.28, P - M + 0.3, 10), px, M - 0.3 + (P - M + 0.3) / 2, pz));
    ironG.push(at(new THREE.CylinderGeometry(0.6, 0.7, 0.18, 12), px, M + 0.05, pz));   // the screw's flange on the rock
    ironG.push(at(new THREE.CylinderGeometry(0.34, 0.34, 0.35, 10), px, P - 0.55, pz)); // the cap under the porch
  }
  const xs = [...new Set(d.piles.map((p) => p[0]))].sort((a, b) => a - b), zs = [...new Set(d.piles.map((p) => p[1]))].sort((a, b) => a - b);
  const top = P - 0.6, low = P - 3.0;   // (bracing kept up out of your head's way)
  for (const z of zs) for (let i = 0; i < xs.length - 1; i++) {
    ironG.push(strut([xs[i], top, z], [xs[i + 1], top, z], 0.1));
    ironG.push(strut([xs[i], low, z], [xs[i + 1], top, z], 0.07), strut([xs[i], top, z], [xs[i + 1], low, z], 0.07));
  }
  for (const x of xs) for (let i = 0; i < zs.length - 1; i++) {
    ironG.push(strut([x, top, zs[i]], [x, top, zs[i + 1]], 0.1));
    ironG.push(strut([x, low, zs[i]], [x, top, zs[i + 1]], 0.07), strut([x, top, zs[i]], [x, low, zs[i + 1]], 0.07));
  }
  root.add(new THREE.Mesh(merge(ironG), iron));

  // --- the porch: planks over the whole platform (the scaffold gallery rings it)
  const pw = d.porchW;
  const porch = new THREE.Mesh(box(pw, 0.3, pw), deck); porch.position.y = P - 0.15; root.add(porch);

  // --- the keeper's house: red walls, white corners and trim, windows, a door to the south
  const wallH = 3.4;
  const house = new THREE.Mesh(box(H * 2, wallH, H * 2), red); house.position.y = P + wallH / 2; root.add(house);
  const trimG = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) trimG.push(at(box(0.3, wallH, 0.3), sx * H, P + wallH / 2, sz * H));
  trimG.push(at(box(H * 2 + 0.3, 0.25, H * 2 + 0.3), 0, P + wallH - 0.1, 0), at(box(H * 2 + 0.3, 0.2, H * 2 + 0.3), 0, P + 0.1, 0));
  // window frames and the door frame
  const win = [];
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const off of [-H * 0.5, H * 0.5]) {
    if (nz === 1 && off < 0) continue;   // (the door's there)
    const cx = nx ? nx * (H + 0.02) : off, cz = nz ? nz * (H + 0.02) : off;
    const fw = nx ? 0.12 : 1.2, fd = nx ? 1.2 : 0.12;
    trimG.push(at(box(nx ? 0.14 : 1.45, 1.6, nx ? 1.45 : 0.14), cx, P + 1.9, cz));
    win.push(at(box(nx ? 0.16 : fw, 1.3, nx ? fd : 0.16), cx + nx * 0.01, P + 1.9, cz + nz * 0.01));
  }
  root.add(new THREE.Mesh(merge(trimG), white));
  root.add(new THREE.Mesh(merge(win), dark));
  const door = new THREE.Mesh(box(1.2, 2.2, 0.16), new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.8 }));
  door.position.set(-H * 0.5, P + 1.1, H + 0.03); root.add(door);
  // the hip roof
  const rf = new THREE.Mesh(new THREE.ConeGeometry(H * 1.55, 1.9, 4, 1).rotateY(Math.PI / 4), roof);
  rf.position.y = P + wallH + 0.95; root.add(rf);

  // --- the lantern tower: a red drum up through the roof, a railed gallery, the glass, a cap
  const T = d.tower;   // { base, gallery, glassTop }
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.6, T.gallery - T.base, 12), red);
  drum.position.y = (T.base + T.gallery) / 2; root.add(drum);
  const gal = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.2, 0.18, 16), iron); gal.position.y = T.gallery; root.add(gal);
  const railG = [at(new THREE.TorusGeometry(2.15, 0.04, 6, 24).rotateX(Math.PI / 2), 0, T.gallery + 1.0, 0)];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; railG.push(at(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 5), Math.cos(a) * 2.15, T.gallery + 0.5, Math.sin(a) * 2.15)); }
  root.add(new THREE.Mesh(merge(railG), iron));
  const gl = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, T.glassTop - T.gallery - 0.1, 12, 1, true), glass);
  gl.position.y = (T.gallery + T.glassTop) / 2 + 0.05; root.add(gl);
  const mull = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; mull.push(at(box(0.07, T.glassTop - T.gallery, 0.07), Math.cos(a) * 1.17, (T.gallery + T.glassTop) / 2, Math.sin(a) * 1.17)); }
  root.add(new THREE.Mesh(merge(mull), iron));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.2, 12), red); cap.position.y = T.glassTop + 0.6; root.add(cap);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), iron); ball.position.y = T.glassTop + 1.35; root.add(ball);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}
