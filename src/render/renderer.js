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
import { BoxView } from './boxView.js';
import { ProjectileViews } from './projectileView.js';
import { MachinesView } from './machinesView.js';
import { PowerupViews } from './powerupView.js';
import { CheddarViews } from './cheddarView.js';

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

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 220);
    this.buildWorld(sim);
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

  // Everything that depends on the map lives in its own scene. Each map's
  // world is built once and kept, so switching between the school and the
  // firing range is instant after the first visit.
  buildWorld(sim) {
    const cfg = this.cfg;
    if (!this.worlds) this.worlds = new Map();
    const footstep = this.zombies ? this.zombies.onFootstep : null;
    let w = this.worlds.get(sim.mapData.id);
    const fresh = !w;
    if (fresh) {
      const scene = new THREE.Scene();
      const fog = new THREE.Color(cfg.graphics.fogColor);
      scene.background = fog;
      scene.fog = new THREE.FogExp2(fog, cfg.graphics.fogDensity);
      const map = new MapView(scene, sim, cfg);
      const effects = new Effects(scene, sim, cfg);
      w = {
        scene, map, effects,
        box: new BoxView(scene, sim, cfg, map),
        zombies: new ZombieViews(scene, effects, cfg),
        projectiles: new ProjectileViews(scene, effects),
        machines: new MachinesView(scene, sim, cfg, map),
        powerups: new PowerupViews(scene, cfg),
        cheddars: new CheddarViews(scene, effects, cfg),
      };
      this.worlds.set(sim.mapData.id, w);
    }
    w.scene.add(this.camera);
    Object.assign(this, { scene: w.scene, map: w.map, box: w.box, effects: w.effects, zombies: w.zombies, projectiles: w.projectiles, machines: w.machines, powerups: w.powerups, cheddars: w.cheddars });
    if (!this.cheddars.onFootstep && this.onCheddarStep) this.cheddars.onFootstep = this.onCheddarStep;
    this.fogBase = new THREE.Color(cfg.graphics.fogColor);
    this.hazeColor = new THREE.Color('#5a4410');
    this.zombies.onFootstep = footstep;
    this.mapData = sim.mapData;
    if (this.post) this.post.mainPass.scene = w.scene;
    if (!fresh) this.resetWorld(sim);
    this.sim = sim;
  }

  // Point the current world at a new game on the same map and clear leftovers.
  resetWorld(sim) {
    this.sim = sim;
    this.map.sim = sim;
    this.map.resetPower();
    if (this.machines) this.machines.reset(sim);
    for (const [id, v] of this.map.windowViews) v.win = sim.windowById(id);
    for (const v of this.map.windowViews.values()) for (const p of v.planks) p.anim = null;
    this.box.setSim(sim);
    this.effects.sim = sim;
    this.effects.clear();
    this.zombies.clear();
    this.projectiles.clear();
    this.powerups.clear();
    this.cheddars.clear();
  }

  setSim(sim) {
    if (sim.mapData !== this.mapData) this.buildWorld(sim);
    else this.resetWorld(sim);
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
    this.projectiles.beginStep(sim);
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
      this.box.onEvent(e);
      this.rig.onEvent(e, id);
      this.viewmodel.onEvent(e, id);
      this.projectiles.onEvent(e);
      this.machines.onEvent(e, this.effects);
      this.powerups.onEvent(e, this.effects);
      this.cheddars.onEvent(e);
      switch (e.type) {
        case 'shot': {
          let from;
          if (e.playerId === id) {
            from = this.viewmodel.muzzleWorldPosition(this.camera, this.tmp.clone(), e.side);
            this.effects.muzzle(from);
          } else from = e.origin;
          for (const h of e.impacts) {
            if (h.kind === 'world') this.effects.impact(h.point, h.normal, h.surface);
            else this.effects.zombieHit(h.point, e.dir, h.part);
          }
          const end = e.impacts.length ? e.impacts[e.impacts.length - 1].point : { x: from.x + e.dir.x * 40, y: from.y + e.dir.y * 40, z: from.z + e.dir.z * 40 };
          if (!e.projectile && Math.random() < 0.5) this.effects.tracer(from, end);
          break;
        }
        case 'explosion': {
          if (this.cfg.explosions[e.etype]?.small) this.effects.smallExplosion(e.pos, e.radius);
          else this.effects.explosion(e.pos, e.radius);
          const p = this.sim.playerById(id);
          if (p) this.rig.explosion(e, p.pos);
          break;
        }
        case 'cheddarStrike':
          this.effects.lightning(e.pos);
          this.flash = Math.max(this.flash || 0, 0.35);
          if (this.sim.playerById(id)) this.rig.explosion({ pos: e.pos, radius: 3, shake: 0.5 }, this.sim.playerById(id).pos);
          break;
        case 'powerupGrab':
          if (e.ptype === 'pressureCooker') this.flash = 1;
          else this.flash = Math.max(this.flash || 0, 0.12);
          break;
        case 'zombieRise': {
          const pos = new THREE.Vector3(e.pos.x, 0.05, e.pos.z);
          for (let i = 0; i < 4; i++) this.effects.puff(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.1, (Math.random() - 0.5) * 0.8)), { color: 0x3a3024, size: 0.5, grow: 2.2, life: 1.4, alpha: 0.5, vel: new THREE.Vector3(0, 0.6, 0) });
          for (let i = 0; i < 14; i++) this.effects.spawnParticle(pos, new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 3), { life: 0.9, size: 0.04, color: [0.12, 0.09, 0.06] });
          break;
        }
        case 'zombieKilled':
          if (e.kind === 'electric') {
            const pos = new THREE.Vector3(e.pos.x, 1.1, e.pos.z);
            for (let i = 0; i < 20; i++) this.effects.spawnParticle(pos, new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6), { life: 0.3 + Math.random() * 0.3, size: 0.012, color: [2.5, 3.2, 5], gravity: 6, drag: 1 });
            this.effects.puff(pos, { color: 0x4a4a52, size: 0.6, grow: 2.4, life: 1.6, alpha: 0.45, vel: new THREE.Vector3(0, 0.8, 0) });
          }
          break;
        case 'projectileStick':
          if (e.zombieId != null) this.effects.zombieHit(e.pos, e.dir, 'torso');
          else this.effects.puff(new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z), { color: 0x8a8478, size: 0.12, grow: 2, life: 0.6, alpha: 0.4 });
          break;
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
        case 'doorOpened': {
          const d = this.sim.world.doors.find((q) => q.id === e.id);
          if (!d) break;
          for (let i = 0; i < 7; i++) {
            const pos = new THREE.Vector3(d.center.x + (Math.random() - 0.5) * d.width * (d.axis === 'x' ? 1 : 0.3), 0.4 + Math.random() * 2, d.center.z + (Math.random() - 0.5) * d.width * (d.axis === 'z' ? 1 : 0.3));
            this.effects.puff(pos, { color: 0x6a6052, size: 0.6, grow: 2.5, life: 1.4, alpha: 0.35 });
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
    for (const v of this.map.vlights) {
      const level = v.fixture ? v.fixture.level : v.level;
      if (level <= 0) continue;
      const d2 = (v.pos.x - pos.x) ** 2 + (v.pos.z - pos.z) ** 2;
      const r = v.distance * 0.5;
      lvl += Math.min(1, v.intensity / 60) * level * 0.9 / (1 + d2 / (r * r));
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

    this.map.update(dt, this.camera.position, { round: sim.rounds.round, kills: p ? p.kills : 0 });
    this.box.update(dt, time);
    this.zombies.update(sim, dt, alpha, time);
    this.projectiles.update(sim, dt, alpha);
    this.machines.update(dt);
    this.powerups.update(dt, sim, this.camera);
    this.cheddars.update(sim, this.zombies.prev, dt, alpha, time);

    // Cheddar Round haze: yellow tint, thicker yellow-brown fog, distant lightning
    const hazeTarget = sim.rounds.cheddar ? 1 : 0;
    this.haze = (this.haze || 0) + (hazeTarget - (this.haze || 0)) * Math.min(1, dt * 0.8);
    this.scene.fog.color.copy(this.fogBase).lerp(this.hazeColor, this.haze * 0.8);
    this.scene.background = this.scene.fog.color;
    this.scene.fog.density = this.cfg.graphics.fogDensity * (1 + this.haze * 0.9);
    if (sim.rounds.cheddar && Math.random() < dt * 0.25) this.flash = Math.max(this.flash || 0, 0.18 + Math.random() * 0.2);
    this.flash = Math.max(0, (this.flash || 0) - dt * 2.2);
    this.effects.update(dt);

    if (p) {
      const lvl = this.envLevel(pos);
      this.viewmodel.envLevel = lvl;
      this.viewmodel.update(dt, p, def, { dx: look.dx, dy: look.dy }, bob);
      this.viewmodel.root.visible = p.alive && mode === 'play' && !this.viewmodel.scoped;
    } else this.viewmodel.root.visible = false;

    this.damage = Math.max(0, this.damage - dt * 1.6);
    const lowHealth = p && p.alive ? Math.max(0, 1 - p.health / (p.maxHealth * 0.55)) : (p ? 1 : 0);
    this.post.render(dt, { damage: this.damage, lowHealth, flash: this.flash || 0, tint: (this.haze || 0) * this.cfg.cheddar.haze });
    this.scoped = !!(p && p.alive && this.viewmodel.scoped);
  }
}

