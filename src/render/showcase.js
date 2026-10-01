// =============================================================================
// Character select: the chosen character on a slowly turning platform under a
// single hard spotlight, in a dark school hallway haze. Drag to spin him.
// =============================================================================
import * as THREE from 'three';
import { buildKearns, idleKearns } from './characters.js';

export class Showcase {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0c0f');
    this.scene.fog = new THREE.Fog('#0b0c0f', 4, 11);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
    this.time = 0;
    this.spin = 0;
    this.spinVel = 0.35;
    this.dragging = false;
    this.char = null;
    this.key = null;

    const s = this.scene;
    s.add(new THREE.HemisphereLight('#6a7890', '#1a1612', 0.45));
    const spot = new THREE.SpotLight('#ffe8cc', 26, 9, 0.42, 0.55, 1.6);
    spot.position.set(0.6, 4.2, 1.6);
    spot.target.position.set(0, 0.9, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.025;
    s.add(spot, spot.target);
    const rim = new THREE.DirectionalLight('#7f9cff', 1.6);
    rim.position.set(-2.5, 2.2, -2.5);
    s.add(rim);
    const fill = new THREE.PointLight('#ff9a50', 3, 6, 2);
    fill.position.set(-1.8, 1.2, 1.6);
    s.add(fill);

    // concrete floor with a worn painted circle
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#4a4740'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)'; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    g.strokeStyle = 'rgba(200,170,90,0.5)'; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 150, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(200,170,90,0.25)'; g.lineWidth = 3; g.beginPath(); g.arc(256, 256, 170, 0, 7); g.stroke();
    const ft = new THREE.CanvasTexture(c); ft.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    // haze shaft of light
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.25, 4.4, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe0b0', transparent: true, opacity: 0.018, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.set(0.3, 2.1, 0.8); beam.lookAt(spot.position); beam.rotateX(Math.PI / 2);
    beam.position.set(0.3, 2.1, 0.8);
    s.add(beam);
    // drifting dust
    const n = 220, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 4; pos[i * 3 + 1] = Math.random() * 3.5; pos[i * 3 + 2] = (Math.random() - 0.5) * 3; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#ffe8c8', size: 0.006, transparent: true, opacity: 0.3, depthWrite: false }));
    s.add(this.dust);

    this.turntable = new THREE.Group();
    s.add(this.turntable);
    this.bindDrag();
  }

  bindDrag() {
    let lastX = 0;
    window.addEventListener('pointerdown', (e) => {
      if (!this.active || e.target.closest('.panel-ui')) return;
      this.dragging = true; lastX = e.clientX;
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - lastX; lastX = e.clientX;
      this.spin += dx * 0.01;
      this.spinVel = dx * 0.6;
    });
    window.addEventListener('pointerup', () => { this.dragging = false; });
  }

  show(id = 'kearns', shirt = 'sage') {
    const key = id + ':' + shirt;
    if (this.key !== key) {
      if (this.char) this.turntable.remove(this.char.root);
      this.char = buildKearns({ shirt });
      this.char.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.turntable.add(this.char.root);
      this.key = key;
    }
    this.active = true;
    this.renderer.shadowMap.enabled = true;
  }

  hide() { this.active = false; }

  render(dt, aspect) {
    this.time += dt;
    if (!this.dragging) {
      this.spinVel += (0.35 - this.spinVel) * Math.min(1, dt * 1.5);
      this.spin += this.spinVel * dt;
    }
    this.turntable.rotation.y = this.spin;
    if (this.char) idleKearns(this.char, this.time);
    this.dust.rotation.y += dt * 0.02;
    // frame him to the right of the menu on wide screens, centred on narrow ones
    const cam = this.camera;
    cam.aspect = aspect;
    const wide = aspect > 1.2;
    cam.fov = wide ? 30 : 38;
    cam.position.set(wide ? -0.75 : 0, 1.15, wide ? 4.3 : 4.6);
    cam.lookAt(wide ? -0.75 : 0, 0.98, 0);
    cam.updateProjectionMatrix();
    const r = this.renderer;
    const tm = r.toneMappingExposure;
    r.toneMappingExposure = 0.95;
    r.setRenderTarget(null);
    r.render(this.scene, cam);
    r.toneMappingExposure = tm;
  }
}
