// =============================================================================
// Big Evil Zach: what The Schnitz made of Zach after the night Erik fell (it
// said it was moving on to its next victim). Still Zach (the curly hair, the
// flannel, the white sneakers) but two and a half times the size, skin gone
// grey-green and veined, the grin stretched too wide, and in his eyes The
// Schnitz's own: two burning green slits. The Dark Schnitz Coin hangs at his
// chest. Built from Zach's own definition (src/render/characters.js).
//   const Z = buildEvilZach();  scene.add(Z.root);  Z.update(dt, t) each frame
// =============================================================================
import * as THREE from 'three';
import { CHARACTERS, buildCharacter } from './characters.js';
import { CONFIG } from '../config.js';
import * as T from './textures.js';

const R = (s) => { let x = s >>> 0 || 1; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; };

export function evilZachDef(cfg = CONFIG.bigZach) {
  const z = CHARACTERS.zach;
  return {
    ...z, id: 'zach', name: 'Zach', villain: true,
    blurb: 'Zach. What The Schnitz made of him.',
    height: cfg.scale,
    headScale: 1.1,
    body: { ...z.body, shoulders: 0.235, chest: 0.19, waist: 0.165, build: 0.55 },
    limbs: 1.22, armsOut: 0.24,
    // the grin, stretched too far; the eyes narrowed to slits
    face: { ...z.face, smile: 1.4, grin: 1.75, cheeks: 0.12, browThick: 1.5 },
    look: { stubble: 0.45 }, squint: 0.97, eyes: '#0c140c',
    top: { type: 'tee', color: '#0b0c0b' },
    layer: { type: 'flannel', color: '#2a302c', check: '#121512' },
    chain: { metal: 'silver', drop: 0.16 },
    idle: 'manic',
  };
}

// dark veins (and their faint glow) over a skin texture's canvas
function veins(map, seed, count) {
  const img = map && map.image;
  if (!img || !img.getContext) return null;
  const W = img.width, H = img.height, g = img.getContext('2d'), r = R(seed);
  const [gc, gg] = T.makeCanvas(W, H);
  gg.fillStyle = '#000'; gg.fillRect(0, 0, W, H);
  for (let i = 0; i < count; i++) {
    let x = r() * W, y = r() * H, a = r() * Math.PI * 2, w = (0.8 + r() * 1.6) * W / 1024;
    const pts = [[x, y]];
    for (let k = 0; k < 10 + r() * 16; k++) { a += (r() - 0.5) * 1.1; x += Math.cos(a) * W * 0.012; y += Math.sin(a) * H * 0.012; pts.push([x, y]); }
    for (const [ctx, col, ww] of [[g, 'rgba(34,52,30,0.55)', w * 1.6], [gg, 'rgba(90,255,110,0.9)', w * 0.6]]) {
      ctx.strokeStyle = col; ctx.lineWidth = ww; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
  }
  map.needsUpdate = true;
  const t = T.toTexture(gc, { repeat: false });
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildEvilZach({ detail = 1, cfg = CONFIG.bigZach } = {}) {
  const C = buildCharacter(evilZachDef(cfg), { detail });
  const glowCol = new THREE.Color(...cfg.eyeGlow);
  const sick = new THREE.Color('#90a48c');
  // the skin: grey-green, veined, the veins faintly lit from inside
  const skinMats = new Set([C.mats.skin, C.face.skinMat]);
  C.face.group.traverse((o) => {
    if (!o.isMesh || o === C.face.hairMesh) return;
    if (C.face.eyes.some((e) => e.userData.ball === o)) return;
    const m = o.material;
    if (m && m.color && !skinMats.has(m) && m.roughness >= 0.55) m.color.multiply(sick);   // lids, ears
  });
  let seed = 7;
  for (const m of skinMats) {
    if (!m) continue;
    m.color = sick.clone();
    const glow = veins(m.map, seed += 13, m === C.face.skinMat ? 26 : 110);
    if (glow) { m.emissiveMap = glow; m.emissive = new THREE.Color(0.25, 0.9, 0.3); m.emissiveIntensity = 0.32; }
    m.needsUpdate = true;
  }
  // claws: the nails gone black
  for (const arm of [C.armL, C.armR]) arm.handGroup.traverse((o) => { if (o.isMesh && o.material && o.material.roughness === 0.32) o.material = new THREE.MeshStandardMaterial({ color: '#0c0d0b', roughness: 0.25, metalness: 0.2 }); });
  // the Schnitz eyes: the eyeballs burn green through the slits, a glow on each
  const burn = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.18, 1, 0.24), toneMapped: false });
  const dot = T.softDotTexture('rgba(160,255,140,1)', 'rgba(40,255,60,0)');
  const eyeGlows = [];
  for (const e of C.face.eyes) {
    e.userData.ball.material = burn;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: glowCol, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9, toneMapped: false }));
    sp.scale.set(0.065, 0.016, 1);
    // the lids close down to a slit round it
    e.userData.upper.rotation.x += 0.42; e.userData.upperRest = e.userData.upper.rotation.x;
    e.userData.lower.rotation.x -= 0.34; e.userData.lowerRest = e.userData.lower.rotation.x;
    sp.position.copy(e.position).add(new THREE.Vector3(0, 0, 0.011));
    C.face.group.add(sp);
    eyeGlows.push(sp);
  }
  // The Dark Schnitz Coin on the end of his chain
  const coin = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 28).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#15180f', metalness: 0.9, roughness: 0.35, emissive: glowCol.clone().multiplyScalar(0.12) }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0035, 8, 28), new THREE.MeshBasicMaterial({ color: glowCol.clone().multiplyScalar(0.6), toneMapped: false }));
  coin.add(face, rim);
  coin.position.set(0, C.neck.position.y - 0.19, 0.172);
  coin.rotation.x = -0.12;
  C.torso.add(coin);
  // an aura round him, and his own green light (the caller decides how it's lit)
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: new THREE.Color(0.2, 1.4, 0.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.22 }));
  aura.scale.set(1.4, 2.2, 1); aura.position.y = 1.0;
  C.root.add(aura);
  // his stance: hunched over you, head up, arms hanging wide
  C.torso.rotation.x = 0.2;
  C.head.rotation.x = -0.24;
  C.armL.shoulder.rotation.x = -0.25; C.armR.shoulder.rotation.x = -0.25;
  C.armL.elbow.rotation.x = -0.45; C.armR.elbow.rotation.x = -0.45;
  C.root.name = 'Big Evil Zach';
  const Z = {
    ...C, eyeGlows, coin, aura, glowColor: glowCol,
    // the eyes flicker and blink slow; the coin turns; the aura breathes
    update(dt, t) {
      const blink = Math.sin(t * 0.7) > 0.992 ? 0.15 : 1;
      eyeGlows.forEach((g, i) => { g.material.opacity = blink * (0.8 + Math.sin(t * 9 + i) * 0.12); });
      coin.rotation.y = Math.sin(t * 1.3) * 0.5;
      aura.material.opacity = 0.18 + Math.sin(t * 1.7) * 0.05;
      C.torso.rotation.z = Math.sin(t * 0.9) * 0.03;
    },
  };
  return Z;
}
