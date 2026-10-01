// =============================================================================
// Story dressing: posters & graffiti, the PA speakers (their light comes on
// when Erik talks), notes lying around, and the three hidden Stew items.
// Reads map data and sim events only.
// =============================================================================
import * as THREE from 'three';
import { wallPoint, sideInfo } from '../map/build.js';
import { NOTES } from '../lore/erik.js';
import { decalTexture, noteTexture, labelTexture, grilleTexture } from './decals.js';

const SIDE_YAW = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 };

export class LoreView {
  constructor(scene, sim, cfg) {
    this.scene = scene;
    this.sim = sim;
    this.cfg = cfg;
    this.map = sim.mapData;
    this.group = new THREE.Group();
    this.group.name = 'lore';
    scene.add(this.group);
    this.items = new Map();
    this.speakers = [];
    this.talk = 0;        // seconds of Erik left
    this.time = 0;
    this.roomById = new Map(this.map.rooms.map((r) => [r.id, r]));
    this.buildDecals();
    this.buildSpeakers();
    this.buildNotes();
    this.buildItems();
    this.sparkleTex = sparkleTexture();
    this.sparkles = [];
  }

  // Position + facing on the inside of a room wall, from {room, side, at, y}.
  anchor(d, off = 0.012) {
    if (d.room) {
      const room = this.roomById.get(d.room);
      const p = wallPoint(room.rect, d.side, d.at);
      const n = sideInfo(room.rect, d.side, this.map.wallThickness).normal;
      return { pos: new THREE.Vector3(p.x + n.x * off, d.y, p.z + n.z * off), yaw: SIDE_YAW[d.side], n };
    }
    const n = { x: Math.sin(d.yaw), z: Math.cos(d.yaw) };
    return { pos: new THREE.Vector3(d.x + n.x * off, d.y, d.z + n.z * off), yaw: d.yaw, n };
  }

  buildDecals() {
    for (const d of this.map.decals || []) {
      const { texture, transparent } = decalTexture(d);
      const mat = new THREE.MeshStandardMaterial({
        map: texture, transparent, alphaTest: 0.02, roughness: d.kind.startsWith('graffiti') ? 0.7 : 0.92,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: !d.kind.startsWith('graffiti'),
      });
      const geo = new THREE.PlaneGeometry(d.w, d.h, d.kind === 'reunion' || d.kind === 'madDogsBanner' ? 12 : 1, 1);
      // banners sag a little between their pins
      if (d.kind === 'reunion' || d.kind === 'madDogsBanner') {
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i) / (d.w / 2);
          pos.setY(i, pos.getY(i) - (1 - x * x) * d.h * 0.08);
          pos.setZ(i, (1 - x * x) * 0.03);
        }
        geo.computeVertexNormals();
      }
      const m = new THREE.Mesh(geo, mat);
      const a = this.anchor(d, d.kind.startsWith('graffiti') ? 0.008 : 0.015);
      m.position.copy(a.pos);
      m.rotation.y = a.yaw;
      // posters hang slightly crooked
      if (!d.kind.startsWith('graffiti') && d.kind !== 'reunion' && d.kind !== 'madDogsBanner' && d.kind !== 'menu') m.rotation.z = (((d.at ?? 0) * 7.13) % 1) * 0.05 - 0.025;
      m.receiveShadow = false;
      this.group.add(m);
    }
  }

  buildSpeakers() {
    const list = this.map.paSpeakers || [];
    if (!list.length) return;
    const body = new THREE.MeshStandardMaterial({ color: '#b8b09a', roughness: 0.75 });
    const grille = new THREE.MeshStandardMaterial({ map: grilleTexture(), roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2a2a28', roughness: 0.7, metalness: 0.4 });
    this.ledOff = new THREE.MeshBasicMaterial({ color: '#3a0d08' });
    this.ledOn = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.5, 0.2) });
    const boxGeo = new THREE.BoxGeometry(0.46, 0.34, 0.2);
    const faceGeo = new THREE.PlaneGeometry(0.38, 0.26);
    const ledGeo = new THREE.BoxGeometry(0.03, 0.03, 0.01);
    for (const s of list) {
      const a = this.anchor(s, 0);
      const g = new THREE.Group();
      g.position.copy(a.pos);
      g.rotation.y = a.yaw;
      if (s.horn) {
        // outdoor horn speaker on a bracket
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.35), dark); br.position.z = 0.17; g.add(br);
        const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.06, 0.45, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide }));
        horn.rotation.x = Math.PI / 2 + 0.3; horn.position.set(0, -0.05, 0.45); g.add(horn);
        const led = new THREE.Mesh(ledGeo, this.ledOff); led.position.set(0, 0.06, 0.36); g.add(led);
        this.speakers.push({ led, group: g });
      } else {
        const b = new THREE.Mesh(boxGeo, body); b.position.z = 0.1; b.rotation.x = 0.18; g.add(b);
        const f = new THREE.Mesh(faceGeo, grille); f.position.set(0, -0.02, 0.205); f.rotation.x = 0.18; g.add(f);
        const led = new THREE.Mesh(ledGeo, this.ledOff); led.position.set(0.17, -0.14, 0.205); led.rotation.x = 0.18; g.add(led);
        // conduit up to the ceiling
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6), dark); c.position.set(0, 0.85, 0.03); g.add(c);
        this.speakers.push({ led, group: g });
      }
      this.group.add(g);
    }
  }

  buildNotes() {
    for (const n of this.map.notes || []) {
      const note = NOTES.find((x) => x.id === n.id);
      const mat = new THREE.MeshStandardMaterial({ map: noteTexture(note, { flyer: n.wall }), roughness: 0.95, emissive: '#ffffff', emissiveIntensity: 0.04, side: THREE.DoubleSide });
      const w = n.wall ? 0.36 : 0.22, h = n.wall ? 0.46 : 0.28;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      if (n.wall) {
        const a = this.anchor(n, 0.012);
        m.position.copy(a.pos); m.rotation.y = a.yaw; m.rotation.z = 0.04;
      } else {
        m.position.set(n.x, n.y + 0.004, n.z);
        m.rotation.set(-Math.PI / 2, 0, n.yaw || 0);
      }
      this.group.add(m);
    }
  }

  buildItems() {
    for (const s of this.map.stewItems || []) {
      const g = new THREE.Group();
      g.position.set(s.x, s.y, s.z);
      g.rotation.y = s.yaw || 0;
      if (s.id === 'ladle') {
        g.scale.setScalar(1.45);
        const steel = new THREE.MeshStandardMaterial({ color: '#d8d4cc', metalness: 0.45, roughness: 0.3, emissive: '#3a362e', emissiveIntensity: 0.6 });
        const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), steel);
        bowl.position.set(0, 0.055, 0); g.add(bowl);
        const stew = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), new THREE.MeshStandardMaterial({ color: '#5a3018', roughness: 0.4 }));
        stew.rotation.x = -Math.PI / 2; stew.position.y = 0.048; g.add(stew);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.32, 6), steel);
        handle.rotation.z = Math.PI / 2 - 0.25; handle.position.set(0.2, 0.09, 0); g.add(handle);
        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 10, Math.PI), steel);
        hook.position.set(0.355, 0.13, 0); hook.rotation.z = -0.25; g.add(hook);
      } else if (s.id === 'tape') {
        const shell = new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.4, emissive: '#101010' });
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.064), shell); box.position.y = 0.006; g.add(box);
        const label = new THREE.Mesh(new THREE.PlaneGeometry(0.086, 0.04), new THREE.MeshStandardMaterial({ map: labelTexture('tape'), roughness: 0.9, emissive: '#ffffff', emissiveIntensity: 0.05 }));
        label.rotation.x = -Math.PI / 2; label.position.set(0, 0.0125, -0.008); g.add(label);
        for (const x of [-0.022, 0.022]) {
          const r = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.0135, 10), new THREE.MeshStandardMaterial({ color: '#efe8d8' }));
          r.position.set(x, 0.006, 0.012); g.add(r);
        }
      } else if (s.id === 'can') {
        const tin = new THREE.MeshStandardMaterial({ color: '#c8c4bc', metalness: 0.8, roughness: 0.35 });
        const lab = new THREE.MeshStandardMaterial({ map: labelTexture('can'), roughness: 0.7, emissive: '#ffffff', emissiveIntensity: 0.05 });
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.11, 18, 1, true), lab);
        can.position.y = 0.055; can.rotation.z = 0.08; g.add(can);
        for (const y of [0.002, 0.108]) {
          const cap = new THREE.Mesh(new THREE.CircleGeometry(0.038, 18), tin);
          cap.rotation.x = y < 0.05 ? Math.PI / 2 : -Math.PI / 2; cap.position.y = y; g.add(cap);
        }
        g.rotation.z = 0.05; // dented, leaning
      }
      g.userData.base = g.position.clone();
      g.userData.scale = g.scale.x;
      this.group.add(g);
      this.items.set(s.id, { group: g, taken: false, t: 0, next: 1 + Math.random() * 4 });
    }
  }

  // New game on the same map: put everything back.
  reset(sim) {
    this.sim = sim;
    this.talk = 0;
    for (const it of this.items.values()) { it.taken = false; it.t = 0; it.group.visible = true; it.group.position.copy(it.group.userData.base); it.group.scale.setScalar(it.group.userData.scale); }
    for (const sp of this.sparkles) sp.sprite.removeFromParent();
    this.sparkles.length = 0;
  }

  onEvent(e, effects) {
    switch (e.type) {
      case 'erikSays': this.talk = e.dur; break;
      case 'stewItem': {
        const it = this.items.get(e.id);
        if (!it) break;
        it.taken = true; it.t = 0;
        if (effects) for (let i = 0; i < 18; i++) effects.spawnParticle(new THREE.Vector3(e.pos.x, e.pos.y + 0.08, e.pos.z), new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2), { life: 0.5 + Math.random() * 0.4, size: 0.01, color: [4, 3.2, 1.4], gravity: 3, drag: 1.5 });
        break;
      }
    }
  }

  sparkle(pos) {
    const mat = new THREE.SpriteMaterial({ map: this.sparkleTex, color: new THREE.Color(3, 2.6, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.scale.setScalar(0.001);
    this.group.add(s);
    this.sparkles.push({ sprite: s, t: 0 });
  }

  update(dt) {
    this.time += dt;
    // speaker lights flicker with Erik's voice
    this.talk = Math.max(0, this.talk - dt);
    const on = this.talk > 0 && Math.sin(this.time * 31) + Math.sin(this.time * 17.3) > -0.6;
    for (const s of this.speakers) s.led.material = on ? this.ledOn : this.ledOff;

    for (const it of this.items.values()) {
      if (it.taken) {
        if (!it.group.visible) continue;
        it.t += dt;
        it.group.position.y = it.group.userData.base.y + it.t * 1.4;
        it.group.rotation.y += dt * 12;
        it.group.scale.setScalar(it.group.userData.scale * Math.max(0.001, 1 - it.t * 2.5));
        if (it.t > 0.4) it.group.visible = false;
        continue;
      }
      // the odd glint so a sharp eye can spot them
      it.next -= dt;
      if (it.next <= 0) {
        it.next = 3 + Math.random() * 5;
        this.sparkle(it.group.position.clone().add(new THREE.Vector3(0, 0.08, 0)));
      }
    }
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sp = this.sparkles[i];
      sp.t += dt;
      const k = sp.t / 0.5;
      if (k >= 1) { sp.sprite.removeFromParent(); sp.sprite.material.dispose(); this.sparkles.splice(i, 1); continue; }
      sp.sprite.scale.setScalar(0.14 * Math.sin(k * Math.PI));
      sp.sprite.material.rotation = k * 2;
    }
  }
}

function sparkleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 10);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.moveTo(32, 0); g.lineTo(35, 29); g.lineTo(64, 32); g.lineTo(35, 35); g.lineTo(32, 64); g.lineTo(29, 35); g.lineTo(0, 32); g.lineTo(29, 29); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
