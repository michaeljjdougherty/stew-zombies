// =============================================================================
// GameRenderer: owns the three.js renderer, scene, camera and all views.
// It reads the simulation and events; it never changes game state.
// =============================================================================
import * as THREE from 'three';
import { setAnisotropy } from './textures.js';
import { MapView } from './mapView.js';
import { ZombieViews } from './zombieView.js';
import { Effects } from './effects.js';
import { Viewmodel } from './viewmodel.js';
import { CameraRig } from './cameraRig.js';
import { PostFX } from './postfx.js';

export class GameRenderer {
  constructor(canvas, sim, cfg, settings) {
    this.cfg = cfg;
    this.settings = settings;
    this.sim = sim;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = cfg.graphics.exposure;
    r.outputColorSpace = THREE.SRGBColorSpace;
    setAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));

    this.scene = new THREE.Scene();
    const fog = new THREE.Color(cfg.graphics.fogColor);
    this.scene.background = fog;
    this.scene.fog = new THREE.FogExp2(fog, cfg.graphics.fogDensity);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 220);
    this.scene.add(this.camera);

    this.map = new MapView(this.scene, sim, cfg);
    this.effects = new Effects(this.scene, sim, cfg);
    this.zombies = new ZombieViews(this.scene, this.effects, cfg);
    this.viewmodel = new Viewmodel(cfg);
    this.viewmodel.initEnvironment(r);
    this.rig = new CameraRig(this.camera, cfg);
    this.post = new PostFX(r, this.scene, this.camera, this.viewmodel.scene, this.viewmodel.camera, cfg);

    this.prevPlayer = null;
    this.damage = 0;
    this.deathT = 0;
    this.localId = null;
    this.tmp = new THREE.Vector3();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setSim(sim) {
    this.sim = sim;
    this.map.sim = sim;
    for (const [id, v] of this.map.windowViews) v.win = sim.windowById(id);
    for (const v of this.map.windowViews.values()) for (const p of v.planks) p.anim = null;
    this.effects.sim = sim;
    this.effects.clear();
    this.zombies.clear();
    this.prevPlayer = null;
    this.damage = 0;
    this.deathT = 0;
    this.rig.lastDist = null;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.cfg.graphics.maxPixelRatio) * (this.settings.renderScale || 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, pr);
    this.aspect = w / h;
    this.viewmodel.setAspect(this.aspect);
  }

  applySettings(s) {
    this.settings = s;
    this.rig.setFov(s.fov);
    this.post.setGrain(s.grain);
    this.post.setBloom(s.bloom);
    this.resize();
  }

  // Called before each simulation step, to interpolate between steps.
  beginStep(sim) {
    this.zombies.beginStep(sim);
    const p = sim.playerById(this.localId);
    if (p) {
      if (!this.prevPlayer) this.prevPlayer = { x: 0, y: 0, z: 0 };
      this.prevPlayer.x = p.pos.x; this.prevPlayer.y = p.pos.y; this.prevPlayer.z = p.pos.z;
    }
  }

  onEvents(events) {
    const id = this.localId;
    for (const e of events) {
      this.zombies.onEvent(e, this.sim);
      this.map.onEvent(e);
      this.rig.onEvent(e, id);
      this.viewmodel.onEvent(e, id);
      switch (e.type) {
        case 'shot': {
          let from;
          if (e.playerId === id) {
            from = this.viewmodel.muzzleWorldPosition(this.camera, this.tmp.clone());
            this.effects.muzzle(from);
          } else from = e.origin;
          for (const h of e.impacts) {
            if (h.kind === 'world') this.effects.impact(h.point, h.normal, h.surface);
            else this.effects.zombieHit(h.point, e.dir, h.part);
          }
          const end = e.impacts.length ? e.impacts[e.impacts.length - 1].point : { x: from.x + e.dir.x * 40, y: from.y + e.dir.y * 40, z: from.z + e.dir.z * 40 };
          if (Math.random() < 0.5) this.effects.tracer(from, end);
          break;
        }
        case 'zombieHit':
          if (e.kind === 'knife') this.effects.zombieHit(e.point, e.dir, 'torso');
          break;
        case 'playerHit':
          if (e.playerId === id) this.damage = 1;
          break;
        case 'boardTorn': {
          const w = this.sim.windowById(e.windowId);
          const pos = new THREE.Vector3(w.center.x + w.normal.x * 0.1, 1.2 + Math.random() * 0.8, w.center.z + w.normal.z * 0.1);
          this.effects.puff(pos, { color: 0x5a4a36, size: 0.3, grow: 2, life: 0.7, alpha: 0.4 });
          for (let i = 0; i < 8; i++) {
            this.effects.spawnParticle(pos, new THREE.Vector3((Math.random() - 0.5) * 3 - w.normal.x * 2, Math.random() * 3, (Math.random() - 0.5) * 3 - w.normal.z * 2), { life: 0.8, size: 0.025, color: [0.22, 0.15, 0.08] });
          }
          break;
        }
        case 'boardRepaired': {
          const w = this.sim.windowById(e.windowId);
          const pos = new THREE.Vector3(w.center.x + w.normal.x * 0.15, 1.4, w.center.z + w.normal.z * 0.15);
          this.effects.puff(pos, { color: 0x6a5a46, size: 0.25, grow: 1.5, life: 0.5, alpha: 0.3 });
          break;
        }
      }
    }
  }

  // Light level near the player (0..1), so the viewmodel isn't glowing in the dark.
  envLevel(pos) {
    let lvl = 0.2;
    for (const f of this.map.fixtures) {
      if (!f.light) continue;
      const d2 = (f.data.x - pos.x) ** 2 + (f.data.z - pos.z) ** 2;
      lvl += f.level * 0.9 / (1 + d2 / 25);
    }
    return Math.min(1, lvl);
  }

  render(dt, alpha, look, p, time, mode = 'play') {
    const sim = this.sim;
    // interpolated player position
    let pos = p ? p.pos : { x: 0, y: 0, z: 0 };
    if (p && this.prevPlayer) {
      const a = this.prevPlayer;
      pos = { x: a.x + (p.pos.x - a.x) * alpha, y: a.y + (p.pos.y - a.y) * alpha, z: a.z + (p.pos.z - a.z) * alpha };
    }
    const def = p ? this.cfg.weapons[p.loadout.slots[p.loadout.current].id] : this.cfg.weapons.M1912;

    let bob = { phase: 0, amp: 0 };
    if (p) bob = this.rig.update(dt, pos, p, look, this.aspect, def);

    // death: drop the camera to the floor
    if (p && !p.alive) {
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 0.9);
      const e = 1 - Math.pow(1 - k, 3);
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, pos.y + 0.25, e);
      this.camera.rotation.z = e * 0.9;
      this.camera.rotation.x = look.pitch * (1 - e) + 0.2 * e;
    }

    // title screen: slow drift
    if (mode === 'title') {
      this.camera.position.set(Math.sin(time * 0.05) * 3, 1.7 + Math.sin(time * 0.3) * 0.03, 6);
      this.camera.rotation.set(0.12 + Math.sin(time * 0.17) * 0.02, Math.sin(time * 0.07) * 0.35, 0);
    }

    this.map.update(dt, p, { round: sim.rounds.round, kills: p ? p.kills : 0 });
    this.zombies.update(sim, dt, alpha, time);
    this.effects.update(dt);

    if (p) {
      const lvl = this.envLevel(pos);
      this.viewmodel.envLevel = lvl;
      this.viewmodel.update(dt, p, def, { dx: look.dx, dy: look.dy }, bob);
      this.viewmodel.root.visible = p.alive && mode === 'play';
    } else this.viewmodel.root.visible = false;

    this.damage = Math.max(0, this.damage - dt * 1.6);
    const lowHealth = p && p.alive ? Math.max(0, 1 - p.health / (p.maxHealth * 0.55)) : (p ? 1 : 0);
    this.post.render(dt, { damage: this.damage, lowHealth });
  }
}
