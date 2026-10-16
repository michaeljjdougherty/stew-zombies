// =============================================================================
// Character select: the chosen character on a slowly turning platform under a
// single hard spotlight, in a dark school hallway haze. Drag to spin him.
// =============================================================================
import * as THREE from 'three';
import { buildCharacter, idleCharacter, idleAct, CHARACTERS } from './characters.js';
import { IDLE_ACTS } from './characterAnim.js';
import { applySkin } from '../career/skins.js';
import { applySkinFx } from './skinFx.js';
import { buildGun, REAL_GUNS } from './gunModels.js';

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
    this.floor = floor; this.beam = beam;
    this.thumbs = new Map();     // key -> data URL (the Stew Store's tiles)
    this.thumbQueue = [];
  }

  // 'store': the Stew Store's bright blue stage; anything else: the dark hallway
  setStyle(style) {
    if (this.style === style) return;
    this.style = style;
    const s = this.scene;
    if (style === 'store') {
      if (!this.storeBg) {
        const c = document.createElement('canvas'); c.width = 16; c.height = 256;
        const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
        grd.addColorStop(0, '#2a7cff'); grd.addColorStop(0.55, '#1446c8'); grd.addColorStop(1, '#081a5c');
        g.fillStyle = grd; g.fillRect(0, 0, 16, 256);
        this.storeBg = new THREE.CanvasTexture(c); this.storeBg.colorSpace = THREE.SRGBColorSpace;
      }
      s.background = this.storeBg;
      s.fog.color.set('#123a9e'); s.fog.near = 5; s.fog.far = 14;
      this.beam.visible = false; this.floor.material.color.set('#8fb0ff');
    } else {
      s.background = new THREE.Color('#0b0c0f');
      s.fog.color.set('#0b0c0f'); s.fog.near = 4; s.fog.far = 11;
      this.beam.visible = true; this.floor.material.color.set('#ffffff');
    }
  }

  // A picture of someone wearing a skin (or doing an emote), on a rarity's
  // colour, for a store tile. done(url) once it's drawn (one a frame, before the
  // platform's own frame: it borrows the corner of the screen, then copies it out).
  thumb(spec, done) {
    const key = spec.gun ? ['gun', spec.gun, spec.gunSkin || '', spec.color || ''].join(':') : [spec.char, spec.skin || '', spec.act || '', spec.color || ''].join(':');
    if (this.thumbs.has(key)) { done(this.thumbs.get(key)); return; }
    const q = this.thumbQueue.find((x) => x.key === key);
    if (q) q.done.push(done);
    else this.thumbQueue.push({ key, spec, done: [done] });
  }

  drawThumb() {
    const job = this.thumbQueue.shift();
    if (!job) return;
    const { spec } = job, r = this.renderer;
    if (!this.thumbScene) {
      const ts = this.thumbScene = new THREE.Scene();
      ts.add(new THREE.HemisphereLight('#e8f0ff', '#3a3040', 1.3));
      const key = new THREE.DirectionalLight('#fff4e6', 2.6); key.position.set(1.2, 2.5, 3); ts.add(key);
      const rim = new THREE.DirectionalLight('#bfe0ff', 1.6); rim.position.set(-2, 2, -2); ts.add(rim);
      this.thumbCam = new THREE.PerspectiveCamera(24, 5 / 6, 0.05, 20);
    }
    const ts = this.thumbScene;
    if (spec.gun) { this.drawGunThumb(job); return; }
    const id = spec.char, def = spec.skin && CHARACTERS[id] ? applySkin(CHARACTERS[id], id, spec.skin) : null;
    const k = buildCharacter(def || id, { detail: 0.7 });
    if (def && def.skinFx) applySkinFx(k, def.skinFx, { light: false });
    idleCharacter(k, 1.3);
    if (spec.act) { idleAct(k, spec.act, spec.t ?? 1.6, 1); if (IDLE_ACTS[spec.act] && IDLE_ACTS[spec.act].turn) k.root.rotation.y = Math.PI; }
    k.root.rotation.y += spec.act ? 0 : -0.35;
    ts.add(k.root);
    // a rarity's glow behind them
    const bg = this.thumbBg(spec.color);
    ts.background = bg;
    const h = (k.def.height || 1);
    const cam = this.thumbCam;
    if (spec.act) { cam.fov = 26; cam.position.set(0, 1.0 * h, 4.4 * h); cam.lookAt(0, 0.9 * h, 0); }
    else { cam.fov = 22; cam.position.set(0, 1.45 * h, 3.6 * h); cam.lookAt(0, 1.2 * h, 0); }
    cam.updateProjectionMatrix();
    const url = this.snap(ts, cam);
    ts.remove(k.root);
    // (all of it: a picture each, they'd add up)
    const mats = new Set();
    k.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); for (const m of [].concat(o.material || [])) mats.add(m); });
    for (const m of mats) { for (const key of ['map', 'bumpMap', 'alphaMap', 'emissiveMap', 'normalMap']) if (m[key]) m[key].dispose(); m.dispose(); }
    bg.dispose();
    this.thumbs.set(job.key, url);
    for (const d of job.done) d(url);
  }

  // the thumb scene on a rarity's glow
  thumbBg(color) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 40, 4, 64, 60, 90);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.25, color || '#5aa0ff'); grd.addColorStop(1, '#0a0a14');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const bg = new THREE.CanvasTexture(c); bg.colorSpace = THREE.SRGBColorSpace;
    return bg;
  }

  // A gun in a gun skin (the Stew Store's Guns tab, the Arsenal). The downloaded
  // model loads first (a few seconds at most: until then the job waits its turn).
  drawGunThumb(job) {
    const { spec } = job, ts = this.thumbScene;
    if (!job.built) { job.built = buildGun(spec.gun, { skin: spec.gunSkin || null }); job.t0 = performance.now(); }
    const G = job.built;
    if (REAL_GUNS[spec.gun] && !G.real && performance.now() - job.t0 < 8000) { this.thumbQueue.push(job); return; }
    const holder = new THREE.Group();
    holder.add(G.group);
    G.group.rotation.set(0, -Math.PI / 2, 0.12);   // (barrel to the right, nose up a touch)
    ts.add(holder);
    const box = new THREE.Box3().setFromObject(holder), mid = box.getCenter(new THREE.Vector3()), dim = box.getSize(new THREE.Vector3());
    holder.position.sub(mid);
    const bg = this.thumbBg(spec.color);
    ts.background = bg;
    const cam = this.thumbCam;
    cam.fov = 24; cam.updateProjectionMatrix();
    const half = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const dist = Math.max(dim.x / 2 / (half * cam.aspect), dim.y / 2 / half) * 1.18 + dim.z / 2;
    cam.position.set(0, dist * 0.18, dist); cam.lookAt(0, 0, 0);
    const url = this.snap(ts, cam);
    ts.remove(holder);
    bg.dispose();
    this.thumbs.set(job.key, url);
    for (const d of job.done) d(url);
  }

  // render the thumb scene into the corner of the screen and copy it out
  snap(ts, cam) {
    const r = this.renderer;
    const W = 200, H = 240, pr = r.getPixelRatio(), size = r.getSize(new THREE.Vector2());
    r.setRenderTarget(null);
    r.setViewport(0, 0, W / pr, H / pr); r.setScissor(0, 0, W / pr, H / pr); r.setScissorTest(true);
    r.render(ts, cam);
    if (!this.thumbCanvas) { this.thumbCanvas = document.createElement('canvas'); this.thumbCanvas.width = W; this.thumbCanvas.height = H; }
    const tc = this.thumbCanvas.getContext('2d');
    tc.clearRect(0, 0, W, H);
    tc.drawImage(r.domElement, 0, r.domElement.height - H, W, H, 0, 0, W, H);
    r.setScissorTest(false); r.setViewport(0, 0, size.x, size.y);
    return this.thumbCanvas.toDataURL('image/webp', 0.85);
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

  // skin: one from the Skin Shop (src/career/skins.js), or null for their own clothes
  show(id = 'kearns', shirt = 'sage', skin = null) {
    const key = id + ':' + shirt + ':' + (skin || '');
    if (this.key !== key) {
      this.clearGun();
      if (this.char) this.turntable.remove(this.char.root);
      const def = skin && CHARACTERS[id] ? applySkin(CHARACTERS[id], id, skin) : null;
      this.char = buildCharacter(def || id, { shirt });
      if (def && def.skinFx) applySkinFx(this.char, def.skinFx);   // (the special skins' finish)
      this.char.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.turntable.add(this.char.root);
      this.key = key;
    }
    this.active = true;
  }

  // A gun on the platform instead (the Stew Store's gun skins: always on the SCAR-H)
  showGun(model, skin = null) {
    const key = 'gun:' + model + ':' + (skin || '');
    if (this.key !== key) {
      this.clearGun();
      if (this.char) { this.turntable.remove(this.char.root); this.char = null; }
      const G = buildGun(model, { skin });
      const holder = new THREE.Group(), pivot = new THREE.Group();
      const c = G.procBox.getCenter(new THREE.Vector3());
      G.group.position.set(-c.x, -c.y, -c.z);   // (turning round its middle, not the grip)
      pivot.rotation.y = -Math.PI / 2;
      pivot.add(G.group); holder.add(pivot);
      holder.scale.setScalar(1.6);
      holder.position.set(0, 1.0, 0);
      holder.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.turntable.add(holder);
      this.gun = { holder, G };
      this.key = key;
    }
    this.active = true;
  }
  clearGun() { if (this.gun) { this.turntable.remove(this.gun.holder); this.gun = null; } }

  hide() { this.active = false; }

  // the Skin Shop's emotes: he does it on the platform (null: just standing)
  setEmote(act) { this.act = act || null; }

  // controller: right stick turns him (a = stick x * dt)
  turn(a) { this.spin += a * 3.2; this.spinVel = 0; this.heldT = 0.5; }

  render(dt, aspect) {
    this.time += dt;
    if (this.thumbQueue.length) this.drawThumb();
    if (this.heldT > 0) this.heldT -= dt;
    else if (!this.dragging) {
      this.spinVel += (0.35 - this.spinVel) * Math.min(1, dt * 1.5);
      this.spin += this.spinVel * dt;
    }
    this.turntable.rotation.y = this.spin;
    if (this.char) { idleCharacter(this.char, this.time); if (this.act) idleAct(this.char, this.act, this.time, 1); }
    if (this.char && this.char.fxUpdate) this.char.fxUpdate(dt);
    this.dust.rotation.y += dt * 0.02;
    // frame him to the right of the menu on wide screens, centred on narrow ones
    const cam = this.camera;
    cam.aspect = aspect;
    const wide = aspect > 1.2;
    cam.fov = wide ? 30 : 38;
    // (the Stew Store: him in the middle, between the tiles and what he's trying on)
    const sx = this.style === 'store' ? (wide ? -0.55 : 0) : (wide ? -0.75 : 0);
    cam.position.set(sx, 1.15, wide ? 4.3 : 4.6);
    cam.lookAt(sx, 0.98, 0);
    cam.updateProjectionMatrix();
    const r = this.renderer;
    const tm = r.toneMappingExposure;
    r.toneMappingExposure = 0.95;
    const sm = r.shadowMap.enabled;
    r.shadowMap.enabled = true;
    r.setRenderTarget(null);
    r.render(this.scene, cam);
    r.shadowMap.enabled = sm;
    r.toneMappingExposure = tm;
  }
}
