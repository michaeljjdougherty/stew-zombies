// =============================================================================
// Cheddars: Erik's rabid hounds for the Cheddar Rounds. Mangy orange-yellow
// fur, ribs showing, glowing eyes and embers coming off them. They come down
// with a lightning strike and burst into flaming cheese-colored gore.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';
import { houndModel } from './houndModel.js';

function furTexture(seed) {
  T.seedTextures(seed);
  const S = 256;
  const [c, g] = T.makeCanvas(S, S);
  g.fillStyle = '#b8761c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,200,90' : '70,30,8'},${0.2 + Math.random() * 0.4})`;
    g.lineWidth = 1 + Math.random();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 4, y + 4 + Math.random() * 7); g.stroke();
  }
  // mange: bare, raw patches
  for (let i = 0; i < 7; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 10 + Math.random() * 22;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(120,20,14,0.95)'); grd.addColorStop(0.6, 'rgba(90,30,20,0.7)'); grd.addColorStop(1, 'rgba(90,30,20,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // scorch
  for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(20,10,4,${0.25 + Math.random() * 0.3})`; g.beginPath(); g.ellipse(Math.random() * S, Math.random() * S, 20 + Math.random() * 30, 8 + Math.random() * 12, Math.random() * 3, 0, 7); g.fill(); }
  return T.toTexture(c);
}

export class CheddarViews {
  constructor(scene, effects, cfg) {
    this.scene = scene;
    this.effects = effects;
    this.cfg = cfg;
    this.views = new Map();
    this.furMats = [11, 12, 13].map((s) => new THREE.MeshStandardMaterial({ map: furTexture(s), roughness: 0.95 }));
    this.rawMat = new THREE.MeshStandardMaterial({ color: '#5e1410', roughness: 0.5 });
    this.boneMat = new THREE.MeshStandardMaterial({ color: '#d8ccb0', roughness: 0.6 });
    this.darkMat = new THREE.MeshStandardMaterial({ color: '#1a120c', roughness: 0.8 });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.3) });
    this.glowTex = T.softDotTexture('rgba(255,190,60,0.9)', 'rgba(255,90,10,0)');
    this.eyeTex = T.softDotTexture('rgba(255,240,170,1)', 'rgba(255,120,0,0)');
    this.onFootstep = null;
    houndModel.load();
  }

  // The real hound (once its model has loaded): skinned, cheddar yellow.
  buildHound(z) {
    const h = houndModel.instance();
    const B = h.bone;
    const root = new THREE.Group();
    h.root.scale.setScalar(1.38);
    root.add(h.root);
    // glowing eyes
    for (const s of [-1, 1]) {
      const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.eyeTex, color: new THREE.Color(3, 1.8, 0.3), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      eye.scale.setScalar(0.07);
      eye.position.set(s * 0.042, 0.035, 0.105);   // from the head joint
      B.head.add(eye);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(1.6, 0.8, 0.2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
    glow.scale.set(1.4, 0.8, 1); glow.position.y = 0.45;
    root.add(glow);
    root.scale.setScalar(z.scale);
    this.scene.add(root);
    const legs = [['fhipL', 'fkneeL', true], ['fhipR', 'fkneeR', true], ['rhipL', 'rkneeL', false], ['rhipR', 'rkneeR', false]].map(([a, b, front]) => ({ hip: B[a], knee: B[b], front }));
    return { id: z.id, hound: true, root, body: B.body, hips: B.hips, neck: B.neck, head: B.head, jaw: B.jaw, legs, tails: [B.tail0, B.tail1, B.tail2, B.tail3], glow, phase: Math.random() * 6, appear: 0, flinch: 0, emberT: 0, lastStep: 0, bodyY: B.body.position.y };
  }

  build(z) {
    if (houndModel.ready) return this.buildHound(z);
    const fur = this.furMats[z.seed % this.furMats.length];
    const root = new THREE.Group();
    const body = new THREE.Group(); body.position.y = 0.55; root.add(body);
    const mk = (geo, mat, parent, x = 0, y = 0, zz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, zz); parent.add(m); return m; };
    // torso: deep chest tapering to a thin waist
    const chest = mk(new THREE.SphereGeometry(0.22, 12, 10), fur, body, 0, 0.02, 0.22); chest.scale.set(0.95, 1.05, 1.25);
    const waist = mk(new THREE.CylinderGeometry(0.13, 0.19, 0.6, 10).rotateX(Math.PI / 2), fur, body, 0, 0.03, -0.12);
    void waist;
    const hips = mk(new THREE.SphereGeometry(0.15, 10, 8), fur, body, 0, 0.04, -0.4); hips.scale.set(1, 1, 1.1);
    // ribs showing through
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
      const rib = mk(new THREE.BoxGeometry(0.02, 0.2, 0.025), this.boneMat, body, s * 0.18, -0.02, 0.32 - i * 0.07);
      rib.rotation.z = s * 0.2;
    }
    // spine ridge
    for (let i = 0; i < 8; i++) mk(new THREE.ConeGeometry(0.025, 0.07, 4), this.boneMat, body, 0, 0.22 - Math.abs(i - 3) * 0.012, 0.35 - i * 0.1);
    // neck + head
    const neck = new THREE.Group(); neck.position.set(0, 0.1, 0.42); body.add(neck);
    mk(new THREE.CylinderGeometry(0.09, 0.12, 0.22, 8).rotateX(-1.0), fur, neck, 0, 0.05, 0.06);
    const head = new THREE.Group(); head.position.set(0, 0.13, 0.17); neck.add(head);
    mk(new THREE.BoxGeometry(0.22, 0.19, 0.22), fur, head, 0, 0, 0);
    mk(new THREE.BoxGeometry(0.13, 0.1, 0.2), fur, head, 0, -0.03, 0.18); // snout
    mk(new THREE.BoxGeometry(0.06, 0.04, 0.04), this.darkMat, head, 0, 0.01, 0.28); // nose
    for (const s of [-1, 1]) {
      const ear = mk(new THREE.ConeGeometry(0.05, 0.14, 4), fur, head, s * 0.08, 0.13, -0.04);
      ear.rotation.set(-0.5, 0, s * 0.35);
      mk(new THREE.SphereGeometry(0.028, 8, 6), this.eyeMat, head, s * 0.065, 0.04, 0.11);
    }
    const jaw = new THREE.Group(); jaw.position.set(0, -0.07, 0.06); head.add(jaw);
    mk(new THREE.BoxGeometry(0.11, 0.04, 0.2), fur, jaw, 0, -0.02, 0.1);
    mk(new THREE.BoxGeometry(0.1, 0.02, 0.17), this.rawMat, jaw, 0, 0.005, 0.1); // gums
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      mk(new THREE.ConeGeometry(0.008, 0.035, 4), this.boneMat, jaw, s * 0.04, 0.02, 0.04 + i * 0.045);
      const up = mk(new THREE.ConeGeometry(0.008, 0.035, 4), this.boneMat, head, s * 0.045, -0.085, 0.13 + i * 0.04);
      up.rotation.x = Math.PI;
    }
    // legs: hip -> knee -> paw
    const leg = (x, zz, front) => {
      const hip = new THREE.Group(); hip.position.set(x, front ? -0.02 : 0.0, zz); body.add(hip);
      mk(new THREE.CylinderGeometry(0.05, 0.065, 0.28, 8), fur, hip, 0, -0.12, 0);
      const knee = new THREE.Group(); knee.position.y = -0.26; hip.add(knee);
      mk(new THREE.CylinderGeometry(0.035, 0.045, 0.26, 6), fur, knee, 0, -0.12, 0);
      mk(new THREE.BoxGeometry(0.07, 0.04, 0.1), this.darkMat, knee, 0, -0.26, 0.02);
      return { hip, knee, front };
    };
    const legs = [leg(0.12, 0.28, true), leg(-0.12, 0.28, true), leg(0.11, -0.4, false), leg(-0.11, -0.4, false)];
    // tail
    const tail = new THREE.Group(); tail.position.set(0, 0.08, -0.52); body.add(tail);
    mk(new THREE.CylinderGeometry(0.015, 0.035, 0.38, 6), fur, tail, 0, 0, -0.17).rotation.x = Math.PI / 2 + 0.5;
    // ember glow under the body
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(1.6, 0.8, 0.2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
    glow.scale.set(1.4, 0.8, 1); glow.position.y = 0.45;
    root.add(glow);
    root.scale.setScalar(z.scale);
    this.scene.add(root);
    return { id: z.id, root, body, neck, head, jaw, legs, tail, glow, phase: Math.random() * 6, appear: 0, flinch: 0, emberT: 0, lastStep: 0 };
  }

  // A speech bubble over a hound's head ("Wanna play 2K?").
  bubble(v, text, dur) {
    if (v.bubble) { v.bubble.parent.remove(v.bubble); v.bubble.material.map.dispose(); v.bubble.material.dispose(); }
    const [c, g] = T.makeCanvas(512, 160);
    g.fillStyle = 'rgba(255,248,225,0.95)'; g.strokeStyle = '#2a1a06'; g.lineWidth = 8;
    const r = 40;
    g.beginPath(); g.moveTo(r + 6, 6); g.arcTo(506, 6, 506, 120, r); g.arcTo(506, 120, 6, 120, r); g.lineTo(150, 120); g.lineTo(110, 154); g.lineTo(118, 120);
    g.arcTo(6, 120, 6, 6, r); g.arcTo(6, 6, 506, 6, r); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#2a1a06'; g.font = '900 54px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(0.5, 0.5, 0.5), transparent: true, depthTest: false, fog: false }));   // dimmed so the bloom doesn't wash it out
    sp.renderOrder = 10;
    sp.scale.set(1.0, 0.31, 1);
    sp.position.set(0.25, 1.45, 0);
    v.root.add(sp);
    v.bubble = sp; v.bubbleT = dur + 0.6;
  }

  onEvent(e) {
    const v = this.views.get(e.id);
    if (e.type === 'cheddarTalk' && v) { this.bubble(v, e.text, e.dur); if (v.jaw) v.talkT = e.dur; return; }
    if (e.type === 'zombieHit' && v) v.flinch = 1;
    else if (e.type === 'zombieKilled' && e.zombieType === 'cheddar') {
      const p = v ? v.root.position.clone() : new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z);
      p.y += 0.55;
      this.burst(p, e.dir || { x: 0, y: 0, z: 0 });
      if (v) { this.scene.remove(v.root); this.views.delete(e.id); }
    }
  }

  // death: a flash of cheese-colored fire, gore and embers
  burst(p, dir) {
    const fx = this.effects;
    fx.smallExplosion(p, 2.4);
    fx.bloodBurst(p, dir, 30, 1.3);
    fx.gibs(p, dir, 8, this.rawMat, this.furMats[0]);
    for (let i = 0; i < 26; i++) fx.spawnParticle(p, new THREE.Vector3((Math.random() - 0.5) * 6, 1 + Math.random() * 4, (Math.random() - 0.5) * 6), { life: 0.6 + Math.random() * 0.6, size: 0.015, color: [4, 2.2, 0.4], gravity: 3, drag: 1 });
    fx.puff(p, { color: 0x6a4a1a, size: 0.8, grow: 2.2, life: 1.4, alpha: 0.5, vel: new THREE.Vector3(0, 0.6, 0) });
  }

  update(sim, prev, dt, alpha, time) {
    const seen = new Set();
    for (const z of sim.zombies) {
      if (z.type !== 'cheddar' || z.state === 'dead') continue;
      seen.add(z.id);
      let v = this.views.get(z.id);
      if (!v) { v = this.build(z); this.views.set(z.id, v); }
      const p = prev.get(z.id);
      v.root.position.set(p ? p.x + (z.pos.x - p.x) * alpha : z.pos.x, p ? p.y + (z.pos.y - p.y) * alpha : z.pos.y, p ? p.z + (z.pos.z - p.z) * alpha : z.pos.z);
      let yaw = z.yaw;
      if (p) { let d = z.yaw - p.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; yaw = p.yaw + d * alpha; }
      v.root.rotation.y = yaw;
      this.animate(v, z, dt, time);
    }
    for (const [id, v] of this.views) if (!seen.has(id)) { this.scene.remove(v.root); this.views.delete(id); }
  }

  animate(v, z, dt, time) {
    // materialize out of the strike
    if (z.state === 'spawning') {
      const k = Math.min(1, z.stateTime / 0.35);
      v.root.visible = z.stateTime > 0.12;
      v.root.scale.setScalar(z.scale * (0.3 + 0.7 * k));
    } else { v.root.visible = true; v.root.scale.setScalar(z.scale); }

    const speed = z.moveSpeed;
    const run = Math.min(1, speed / 4);
    v.phase += (speed / 1.6) * Math.PI * dt + dt * 0.5;
    const ph = v.phase;
    // rotary gallop: front pair slightly offset, back pair half a cycle later
    const offs = [0, 0.25, Math.PI, Math.PI + 0.25];
    v.legs.forEach((l, i) => {
      const s = Math.sin(ph + offs[i]);
      const amp = v.hound ? 0.72 : 1;
      l.hip.rotation.x = s * (0.25 + run * 0.7) * amp;
      l.knee.rotation.x = (l.front ? -Math.max(0, -Math.cos(ph + offs[i])) * (0.4 + run * 0.8) : Math.max(0, Math.cos(ph + offs[i])) * (0.4 + run * 0.9)) * amp;
    });
    const bodyY = v.hound ? v.bodyY : 0.55;
    v.body.position.y = bodyY + Math.abs(Math.sin(ph)) * 0.05 * run * (v.hound ? 0.7 : 1);
    v.body.rotation.x = Math.sin(ph) * 0.08 * run;
    v.flinch = Math.max(0, v.flinch - dt * 5);
    v.body.rotation.z = v.flinch * 0.25 * Math.sin(time * 40);
    // head low when running, snarling when close; jaw snaps when attacking
    const attacking = z.attack.phase !== 'none';
    v.neck.rotation.x = run * 0.35 + (attacking ? -0.25 : 0) + Math.sin(time * 3 + z.id) * 0.04;
    // talking: the jaw flaps along with the words
    v.talkT = Math.max(0, (v.talkT || 0) - dt);
    const talk = v.talkT > 0 ? Math.max(0, Math.sin(time * 22)) * 0.5 : 0;
    const jawOpen = attacking ? 0.75 : 0.18 + Math.max(0, Math.sin(time * 7 + z.id)) * 0.25 + talk;
    if (v.hound) {
      // the model's mouth is already open in a snarl: close it a little at rest
      v.jaw.rotation.x = (jawOpen - 0.5) * 0.7;
      v.neck.rotation.x *= 0.6;
      v.tails.forEach((t, i) => {
        t.rotation.x = (i ? 0.12 : -0.15) + Math.sin(ph * 2 - i * 0.8) * 0.12 * run;
        t.rotation.y = Math.sin(time * 5 - i * 0.9) * (0.15 + i * 0.05);
      });
      v.hips.rotation.x = -Math.sin(ph) * 0.06 * run;
    } else {
      v.jaw.rotation.x = jawOpen;
      v.tail.rotation.x = -0.3 + Math.sin(ph * 2) * 0.2 * run;
      v.tail.rotation.y = Math.sin(time * 5) * 0.3;
    }
    if (v.bubble) {
      v.bubbleT -= dt;
      v.bubble.material.opacity = Math.min(1, v.bubbleT * 3);
      v.bubble.position.y = 1.45 + Math.sin(time * 9) * 0.015;
      if (v.bubbleT <= 0) { v.root.remove(v.bubble); v.bubble.material.map.dispose(); v.bubble.material.dispose(); v.bubble = null; }
    }
    if (attacking && z.attack.phase === 'windup') v.body.rotation.x -= 0.2; // lunge
    v.glow.material.opacity = 0.4 + Math.sin(time * 9 + z.id) * 0.12;
    // embers drifting off
    v.emberT -= dt;
    if (v.emberT <= 0) {
      v.emberT = 0.08;
      const p = v.root.position.clone(); p.y += 0.5 + Math.random() * 0.3;
      p.x += (Math.random() - 0.5) * 0.4; p.z += (Math.random() - 0.5) * 0.4;
      this.effects.spawnParticle(p, new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4), { life: 0.7, size: 0.012, color: [4, 1.8, 0.3], gravity: -0.5, drag: 0.5 });
    }
    // paw steps
    const step = Math.floor(ph / Math.PI);
    if (step !== v.lastStep && speed > 1 && this.onFootstep) this.onFootstep(z);
    v.lastStep = step;
  }

  clear() {
    for (const v of this.views.values()) this.scene.remove(v.root);
    this.views.clear();
  }
}
