// =============================================================================
// GameRenderer: owns the three.js renderer, scene, camera and all views.
// It reads the simulation and events; it never changes game state.
// =============================================================================
import * as THREE from 'three';
import { setAnisotropy } from './textures.js';
import { setSurfaceAnisotropy } from './surfaces.js';
import { MapView } from './mapView.js';
import { bakeUniforms, DYN_LIGHTS } from './bake.js';
import { ZombieViews } from './zombieView.js';
import { Effects, FX_LAYER } from './effects.js';
import { Puddles } from './puddles.js';
import { Viewmodel } from './viewmodel.js';
import { CameraRig } from './cameraRig.js';
import { PostFX } from './postfx.js';
import { BoxView } from './boxView.js';
import { ProjectileViews } from './projectileView.js';
import { MachinesView } from './machinesView.js';
import { PowerupViews } from './powerupView.js';
import { CheddarViews } from './cheddarView.js';
import { LoreView } from './loreView.js';
import { QuestView } from './questView.js';
import { Ending } from './ending.js';
import { Showcase } from './showcase.js';
import { Lineup } from './lineup.js';
import { TeammateViews } from './teammates.js';

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
    setSurfaceAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 220);
    this.camera.layers.enable(FX_LAYER); // particles and smoke (kept out of reflection captures)
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
      const puddles = new Puddles(scene, sim, cfg, effects);
      effects.puddles = puddles;
      effects.fixtures = map.fixtures;
      effects.lightAt = (pos) => this.envLevel(pos);
      w = {
        scene, map, effects, puddles,
        box: new BoxView(scene, sim, cfg, map),
        zombies: new ZombieViews(scene, effects, cfg),
        projectiles: new ProjectileViews(scene, effects, cfg),
        machines: new MachinesView(scene, sim, cfg, map),
        powerups: new PowerupViews(scene, cfg),
        cheddars: new CheddarViews(scene, effects, cfg),
        lore: new LoreView(scene, sim, cfg),
        quest: new QuestView(scene, sim, cfg, map),
        teammates: new TeammateViews(scene, cfg),
      };
      w.quest.effects = effects;
      w.box.onLand = (spot) => {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          effects.puff(new THREE.Vector3(spot.x + Math.cos(a) * 0.6, 0.2, spot.z + Math.sin(a) * 0.6), { color: 0x6a6052, size: 0.5, grow: 2.5, life: 1.3, alpha: 0.45, vel: new THREE.Vector3(Math.cos(a) * 1.2, 0.3, Math.sin(a) * 1.2) });
        }
        const p = this.sim.playerById(this.localId);
        if (p) this.rig.explosion({ pos: { x: spot.x, y: 0, z: spot.z }, radius: 2, shake: 0.4 }, p.pos);
      };
      this.worlds.set(sim.mapData.id, w);
    }
    w.scene.add(this.camera);
    Object.assign(this, { scene: w.scene, map: w.map, box: w.box, effects: w.effects, puddles: w.puddles, zombies: w.zombies, projectiles: w.projectiles, machines: w.machines, powerups: w.powerups, cheddars: w.cheddars, lore: w.lore, quest: w.quest, teammates: w.teammates });
    if (!this.cheddars.onFootstep && this.onCheddarStep) this.cheddars.onFootstep = this.onCheddarStep;
    this.fogBase = new THREE.Color(cfg.graphics.fogColor);
    this.hazeColor = new THREE.Color('#5a4410');
    this.zombies.onFootstep = footstep;
    this.mapData = sim.mapData;
    if (this.post) this.post.setScene(w.scene);
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
    this.puddles.sim = sim;
    this.puddles.clear();
    this.zombies.clear();
    this.projectiles.clear();
    this.powerups.clear();
    this.cheddars.clear();
    this.lore.reset(sim);
    this.quest.setSim(sim);
    this.teammates.clear();
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
    this.post.setAO(s.ao);
    this.cfg.graphics.reflections = s.reflections !== false;
    this.resize();
  }

  // Called before each simulation step, to interpolate between steps.
  beginStep(sim) {
    this.zombies.beginStep(sim);
    this.teammates.beginStep(sim, this.localId);
    this.projectiles.beginStep(sim);
    const p = sim.playerById(this.localId);
    if (p) {
      if (!this.prevPlayer) this.prevPlayer = { x: 0, y: 0, z: 0 };
      this.prevPlayer.x = p.pos.x; this.prevPlayer.y = p.pos.y; this.prevPlayer.z = p.pos.z;
      // aim/recoil/sway are stepped at 60 Hz; remember the last tick so the
      // camera and gun can blend between ticks on faster displays
      const w = p.loadout;
      this.prevAim = { ads: w.adsAmount, rp: w.recoilPitch, ry: w.recoilYaw, sp: w.swayPitch || 0, sy: w.swayYaw || 0, slot: w.current };
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
      this.lore.onEvent(e, this.effects);
      this.quest.onEvent(e);
      switch (e.type) {
        case 'shot': {
          let from;
          if (e.playerId === id) {
            from = this.viewmodel.muzzleWorldPosition(this.camera, this.tmp.clone(), e.side);
            this.effects.muzzle(from);
          } else {
            // a teammate: from their gun, with a flash
            const m = this.teammates.muzzle(e.playerId);
            from = m ? m.clone() : e.origin;
            if (m) this.effects.muzzle(from);
          }
          this.effects.muzzleSmoke(from, e.dir, e.pellets > 1 ? 1.8 : 1, e.playerId === id);
          for (const h of e.impacts) {
            if (h.kind === 'world') this.effects.impact(h.point, h.normal, h.surface);
            else this.effects.zombieHit(h.point, e.dir, h.part);
          }
          const end = e.impacts.length ? e.impacts[e.impacts.length - 1].point : { x: from.x + e.dir.x * 40, y: from.y + e.dir.y * 40, z: from.z + e.dir.z * 40 };
          if (!e.projectile && Math.random() < 0.5) this.effects.tracer(from, end);
          break;
        }
        case 'explosion': {
          if (this.cfg.explosions[e.etype]?.energy) this.effects.energyBurst(e.pos, this.cfg.explosions[e.etype].energy, e.radius);
          else if (this.cfg.explosions[e.etype]?.small) this.effects.smallExplosion(e.pos, e.radius);
          else this.effects.explosion(e.pos, e.radius);
          const p = this.sim.playerById(id);
          if (p) this.rig.explosion(e, p.pos);
          break;
        }
        case 'sawHit':
          this.effects.bloodBurst(new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z), { x: Math.random() - 0.5, y: 0.5, z: Math.random() - 0.5 }, 30, 1.4);
          break;
        case 'sawRicochet': case 'sawStick': {
          const n = e.normal || { x: 0, y: 1, z: 0 };
          for (let i = 0; i < 16; i++) this.effects.spawnParticle(new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z), new THREE.Vector3(n.x * 3 + (Math.random() - 0.5) * 6, Math.random() * 4, n.z * 3 + (Math.random() - 0.5) * 6), { life: 0.3, size: 0.01, color: [5, 3, 1], gravity: 10, drag: 1 });
          if (e.type === 'sawStick' && e.normal) this.effects.bulletHole(new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z), new THREE.Vector3(n.x, n.y, n.z));
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
          if (!w) break;
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
          if (!w) break;
          const pos = new THREE.Vector3(w.center.x + w.normal.x * 0.15, 1.4, w.center.z + w.normal.z * 0.15);
          this.effects.puff(pos, { color: 0x6a5a46, size: 0.25, grow: 1.5, life: 0.5, alpha: 0.3 });
          break;
        }
      }
    }
  }

  // Over-the-shoulder camera on a teammate (spectating), pulled in if a wall's in the way.
  spectateCam(v, dt) {
    const sp = this.sim.playerById(v.id);
    if (!sp) return;
    const pos = v.root.position;
    // smooth their look so 30 Hz network updates don't jitter the view
    if (!this.specLook || this.specLook.id !== v.id) this.specLook = { id: v.id, yaw: sp.yaw, pitch: sp.pitch || 0 };
    const sl = this.specLook, kk = 1 - Math.exp(-dt * 12);
    sl.yaw += Math.atan2(Math.sin(sp.yaw - sl.yaw), Math.cos(sp.yaw - sl.yaw)) * kk;
    sl.pitch += ((sp.pitch || 0) - sl.pitch) * kk;
    const yaw = sl.yaw, pitch = Math.max(-1.2, Math.min(1.2, sl.pitch));
    const head = new THREE.Vector3(pos.x, pos.y + (sp.downed ? 0.7 : sp.crouching ? 1.2 : 1.62), pos.z);
    const fwd = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const want = head.clone().addScaledVector(fwd, -2.4).addScaledVector(right, 0.55).add(new THREE.Vector3(0, 0.35, 0));
    const d = want.clone().sub(head); const len = d.length(); d.normalize();
    const hit = this.sim.raycastWorld(head, d, len + 0.3);
    if (hit) want.copy(head).addScaledVector(d, Math.max(0.3, hit.t - 0.3));
    if (!this.specCam) this.specCam = want.clone(); else this.specCam.lerp(want, 1 - Math.exp(-dt * 10));
    this.camera.position.copy(this.specCam);
    this.camera.lookAt(head.clone().addScaledVector(fwd, 6));
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

  getLineup() {
    if (!this.lineup) this.lineup = new Lineup(this.renderer);
    return this.lineup;
  }

  getShowcase() {
    if (!this.showcase) this.showcase = new Showcase(this.renderer);
    return this.showcase;
  }

  // The chosen character: their arms are the first-person arms.
  setCharacter(id, shirt) {
    this.character = { id, shirt };
    if (this.viewmodel.setCharacter) this.viewmodel.setCharacter(id, shirt);
  }

  // Baked surfaces don't use the real-time lights; the lights that come and go
  // (muzzle flash, explosions) or move (the mystery box) are handed to them here.
  updateBakedLive() {
    const U = bakeUniforms, cam = this.camera, fx = this.effects;
    cam.updateMatrixWorld();
    const slots = [fx.muzzleLight, fx.blastLight];
    let si = 0;
    for (const l of slots) {
      if (si >= DYN_LIGHTS) break;
      U.dynPos.value[si].copy(l.position).applyMatrix4(cam.matrixWorldInverse);
      U.dynColor.value[si].copy(l.color).multiplyScalar(l.intensity);
      U.dynRange.value[si].set(l.distance, l.decay);
      si++;
    }
    // nearest moving map lights
    const eye = cam.position;
    const live = this.map.vlights.filter((v) => v.live && v.level > 0.01).sort((a, b) => a.pos.distanceToSquared(eye) - b.pos.distanceToSquared(eye));
    for (const v of live) {
      if (si >= DYN_LIGHTS) break;
      U.dynPos.value[si].copy(v.pos).applyMatrix4(cam.matrixWorldInverse);
      U.dynColor.value[si].copy(v.color).multiplyScalar(v.intensity * v.level);
      U.dynRange.value[si].set(v.distance, v.decay);
      si++;
    }
    for (; si < DYN_LIGHTS; si++) U.dynColor.value[si].setRGB(0, 0, 0);
  }

  // --- the ending cutscene -------------------------------------------------
  startEnding(settings) {
    this.ending = new Ending(this, this.sim, { character: settings.character, shirt: settings.shirt });
    this.endingScene = this.scene;
    return this.ending;
  }

  endEnding() {
    if (!this.ending) return;
    this.ending.dispose();
    this.ending = null;
    this.post.setScene(this.scene);
    this.endingScene = null;
  }

  renderEnding(dt, time) {
    const sim = this.sim;
    this.map.update(dt, this.camera.position, { round: sim.rounds.round, kills: 0 });
    this.zombies.update(sim, dt, 1, time);
    this.machines.update(dt);
    this.quest.update(dt, this.camera);
    this.effects.update(dt);
    const scene = this.ending.update(dt, time);
    if (scene !== this.endingScene) { this.post.setScene(scene); this.endingScene = scene; }
    const vFov = 52;
    if (this.camera.fov !== vFov || this.camera.aspect !== this.aspect) { this.camera.fov = vFov; this.camera.aspect = this.aspect; this.camera.updateProjectionMatrix(); }
    this.viewmodel.root.visible = false;
    this.flash = Math.max(0, (this.flash || 0) - dt * 2.2);
    this.updateBakedLive();
    this.post.render(dt, { damage: 0, lowHealth: 0, flash: this.flash || 0, tint: 0 });
  }

  render(dt, alpha, look, p, time, mode = 'play') {
    if (mode === 'ending' && this.ending) { this.renderEnding(dt, time); return; }
    if (mode === 'showcase') {
      this.getShowcase().render(dt, this.aspect);
      return;
    }
    if (mode === 'lineup') {
      this.getLineup().render(dt, this.aspect);
      return;
    }
    const sim = this.sim;
    // interpolated player position
    let pos = p ? p.pos : { x: 0, y: 0, z: 0 };
    if (p && this.prevPlayer) {
      const a = this.prevPlayer;
      pos = { x: a.x + (p.pos.x - a.x) * alpha, y: a.y + (p.pos.y - a.y) * alpha, z: a.z + (p.pos.z - a.z) * alpha };
    }
    const def = p ? this.cfg.weapons[p.loadout.slots[p.loadout.current].id] : this.cfg.weapons.M1912;

    // blended aim state (see beginStep)
    let aim = null;
    if (p) {
      const w = p.loadout, a = this.prevAim && this.prevAim.slot === w.current ? this.prevAim : null;
      const L = (x0, x1) => (a ? x0 + (x1 - x0) * alpha : x1);
      const raw = L(a && a.ads, w.adsAmount);
      aim = {
        ads: raw * raw * (3 - 2 * raw), // eased in and out
        recoilPitch: L(a && a.rp, w.recoilPitch), recoilYaw: L(a && a.ry, w.recoilYaw),
        swayPitch: L(a && a.sp, w.swayPitch || 0), swayYaw: L(a && a.sy, w.swayYaw || 0),
      };
      this.aim = aim;
    }
    let bob = { phase: 0, amp: 0 };
    if (p) bob = this.rig.update(dt, pos, p, look, this.aspect, def, aim);

    // dead online: watch a teammate over their shoulder
    const watch = p && !p.alive && this.spectate ? this.teammates.views.get(this.spectate) : null;
    if (watch && watch.root.visible) {
      this.spectateCam(watch, dt);
    } else if (p && !p.alive) {
      // death: drop the camera to the floor
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 0.9);
      const e = 1 - Math.pow(1 - k, 3);
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, pos.y + 0.25, e);
      this.camera.rotation.z = e * 0.9;
      this.camera.rotation.x = look.pitch * (1 - e) + 0.2 * e;
    } else this.deathT = 0;
    if (!watch) { this.specCam = null; this.specLook = null; }   // (online you come back next round)

    // title screen: slow drift
    if (mode === 'title') {
      this.camera.position.set(Math.sin(time * 0.05) * 3, 1.7 + Math.sin(time * 0.3) * 0.03, 6);
      this.camera.rotation.set(0.12 + Math.sin(time * 0.17) * 0.02, Math.sin(time * 0.07) * 0.35, 0);
    }

    this.map.update(dt, this.camera.position, { round: sim.rounds.round, kills: p ? p.kills : 0 });
    // eye adaptation: open up in the dark, stop down once the lights are on
    const g = this.cfg.graphics;
    const lit = bakeUniforms.bakePower.value;
    const targetExp = (g.exposureDark ?? g.exposure) + ((g.exposureLit ?? g.exposure) - (g.exposureDark ?? g.exposure)) * lit;
    this.exposure = this.exposure == null ? targetExp : this.exposure + (targetExp - this.exposure) * Math.min(1, dt * 1.5);
    this.renderer.toneMappingExposure = mode === 'title' ? g.exposure : this.exposure;
    this.box.update(dt, time);
    this.zombies.update(sim, dt, alpha, time);
    this.projectiles.update(sim, dt, alpha);
    this.machines.update(dt);
    this.powerups.update(dt, sim, this.camera);
    this.cheddars.update(sim, this.zombies.prev, dt, alpha, time);
    this.lore.update(dt);
    this.quest.update(dt, this.camera);
    this.teammates.update(sim, this.localId, dt, alpha, time, this.camera);
    if (watch && watch.tag) watch.tag.visible = false;   // no name tag in your face while spectating

    // Cheddar Round haze: yellow tint, thicker yellow-brown fog, distant lightning
    const hazeTarget = sim.rounds.cheddar ? 1 : 0;
    this.haze = (this.haze || 0) + (hazeTarget - (this.haze || 0)) * Math.min(1, dt * 0.8);
    this.scene.fog.color.copy(this.fogBase).lerp(this.hazeColor, this.haze * 0.8);
    this.scene.background = this.scene.fog.color;
    this.scene.fog.density = this.cfg.graphics.fogDensity * (1 + this.haze * 0.9);
    if (sim.rounds.cheddar && Math.random() < dt * 0.25) this.flash = Math.max(this.flash || 0, 0.18 + Math.random() * 0.2);
    this.flash = Math.max(0, (this.flash || 0) - dt * 2.2);
    this.effects.update(dt);
    // smoke curling off a hot barrel
    const hot = p && p.alive && mode === 'play' && this.effects.heat > 0.2 && !this.viewmodel.scoped;
    this.effects.barrelSmoke(hot ? this.viewmodel.muzzleWorldPosition(this.camera, this.tmp.clone(), 'R') : null, dt);
    this.puddles.update(dt, this.renderer, this.camera);

    if (p) {
      const lvl = this.envLevel(pos);
      this.viewmodel.envLevel = lvl;
      this.viewmodel.update(dt, p, def, { dx: look.dx, dy: look.dy }, bob, aim);
      this.viewmodel.root.visible = p.alive && mode === 'play' && !this.viewmodel.scoped;
    } else this.viewmodel.root.visible = false;

    this.damage = Math.max(0, this.damage - dt * 1.6);
    const lowHealth = p && p.alive ? Math.max(0, 1 - p.health / (p.maxHealth * 0.55)) : (p ? 1 : 0);
    this.updateBakedLive();
    this.post.render(dt, { damage: this.damage, lowHealth, flash: this.flash || 0, tint: (this.haze || 0) * this.cfg.cheddar.haze });
    this.scoped = !!(p && p.alive && this.viewmodel.scoped);
  }
}

