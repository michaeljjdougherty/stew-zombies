// =============================================================================
// Character lineup: the whole crew side by side on a dark stage (Erik a step
// apart), each in their idle pose. Drag to turn them, pick one to walk the
// camera over, and zoom to faces. Review tool for the character models.
// =============================================================================
import * as THREE from 'three';
import { CHARACTERS, LINEUP, buildCharacter, idleCharacter } from './characters.js';

const lerp = (a, b, t) => a + (b - a) * t;

export class Lineup {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0c0f');
    this.scene.fog = new THREE.Fog('#0b0c0f', 9, 20);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
    this.camPos = new THREE.Vector3(0, 1.3, 9.5);
    this.camLook = new THREE.Vector3(0, 0.95, 0);
    this.time = 0;
    this.spin = 0;
    this.spinVel = 0;
    this.autoSpin = false;
    this.focus = -1;          // -1 = everyone
    this.face = false;
    this.chars = [];
    this.built = false;
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#7a88a0', '#1a1612', 0.7));
    const key = new THREE.DirectionalLight('#ffe8cc', 2.2);
    key.position.set(2.5, 6, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 1024);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 3, bottom: -1, near: 1, far: 20 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    s.add(key);
    const rim = new THREE.DirectionalLight('#7f9cff', 1.4); rim.position.set(-3, 3, -4); s.add(rim);
    const fill = new THREE.DirectionalLight('#ffb070', 0.5); fill.position.set(-4, 1.5, 4); s.add(fill);
    // Erik gets his own red light
    this.erikLight = new THREE.SpotLight('#ff4a30', 18, 7, 0.5, 0.6, 1.5);
    s.add(this.erikLight, this.erikLight.target);
    // stage floor
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#3c3933'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 12000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)'; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    for (let y = 0; y < 512; y += 64) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, y, 512, 2); }
    const ft = new THREE.CanvasTexture(c); ft.colorSpace = THREE.SRGBColorSpace; ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(4, 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    s.add(floor);
    // height lines on a back wall, so relative heights are easy to read
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 4), new THREE.MeshStandardMaterial({ color: '#1a1b1f', roughness: 1 }));
    wall.position.set(0, 2, -1.6); wall.receiveShadow = true; s.add(wall);
    const lm = new THREE.MeshBasicMaterial({ color: '#3a3b40' });
    for (let h = 1.0; h <= 2.01; h += 0.25) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(24, h % 0.5 < 0.01 ? 0.012 : 0.005), lm);
      l.position.set(0, h, -1.59); s.add(l);
    }
    this.turntables = [];
  }

  // Build everyone (a couple of seconds the first time).
  build() {
    if (this.built) return;
    const spacing = 0.78;
    const n = LINEUP.length;
    LINEUP.forEach((id, i) => {
      const k = buildCharacter(id, { detail: 0.75 });
      const x = (i - (n - 1) / 2) * spacing + (CHARACTERS[id].villain ? 0.5 : 0) - 0.25;
      const tt = new THREE.Group(); tt.position.x = x; this.scene.add(tt);
      tt.add(k.root);
      k.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.chars.push({ id, k, tt, x, name: CHARACTERS[id].name });
      if (CHARACTERS[id].villain) {
        this.erikLight.position.set(x + 0.6, 3.4, 1.8);
        this.erikLight.target.position.set(x, 1.0, 0);
      }
    });
    this.built = true;
  }

  setFocus(i) { this.focus = i; }

  drag(dx) { this.spin += dx * 0.01; this.spinVel = dx * 0.6; }

  // screen positions for the name tags (CSS pixels)
  tags(w, h) {
    const out = [];
    const v = new THREE.Vector3();
    for (const c of this.chars) {
      const top = (CHARACTERS[c.id].height || 1) * 1.98 + 0.12;
      v.set(c.x, top, 0).project(this.camera);
      out.push({ name: c.name, x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, hidden: v.z > 1 });
    }
    return out;
  }

  render(dt, aspect) {
    this.time += dt;
    if (this.autoSpin) this.spin += dt * 0.5;
    else { this.spin += this.spinVel * dt * 0.1; this.spinVel *= Math.exp(-dt * 3); }
    for (const c of this.chars) { c.tt.rotation.y = this.spin; idleCharacter(c.k, this.time); }
    // camera: everyone, one character, or a face close-up
    const cam = this.camera;
    cam.aspect = aspect;
    let pos, look;
    const narrow = aspect < 1.1;
    if (this.focus < 0 || !this.chars[this.focus]) {
      pos = new THREE.Vector3(0, 1.35, narrow ? 17 : 9.6); look = new THREE.Vector3(0, 1.0, 0);
    } else {
      const c = this.chars[this.focus], hgt = CHARACTERS[c.id].height || 1;
      if (this.face) { pos = new THREE.Vector3(c.x + 0.12, 1.72 * hgt, narrow ? 1.35 : 1.05); look = new THREE.Vector3(c.x, 1.7 * hgt, 0); }
      else { pos = new THREE.Vector3(c.x, 1.05 * hgt, narrow ? 5.6 : 4.5); look = new THREE.Vector3(c.x, 0.93 * hgt, 0); }
    }
    const k = 1 - Math.exp(-dt * 4);
    this.camPos.lerp(pos, k); this.camLook.lerp(look, k);
    cam.position.copy(this.camPos); cam.lookAt(this.camLook);
    cam.fov = narrow ? 40 : 32;
    cam.updateProjectionMatrix();
    const r = this.renderer;
    const tm = r.toneMappingExposure;
    r.toneMappingExposure = 1.0;
    const sm = r.shadowMap.enabled;
    r.shadowMap.enabled = true;
    r.setRenderTarget(null);
    r.render(this.scene, cam);
    r.shadowMap.enabled = sm;
    r.toneMappingExposure = tm;
  }
}
