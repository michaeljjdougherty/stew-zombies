// =============================================================================
// GameRenderer: owns the three.js renderer, scene, camera and all views.
// It reads the simulation and events; it never changes game state.
// =============================================================================
import * as THREE from 'three';
import { TitanView } from './titanView.js';
import { ForgeView } from './forgeView.js';
import { ZachView } from './zachView.js';
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
import { CauldronView } from './cauldronView.js';
import { ProjectileViews } from './projectileView.js';
import { MachinesView, GumView } from './machinesView.js';
import { PowerupViews } from './powerupView.js';
import { CheddarViews } from './cheddarView.js';
import { LoreView } from './loreView.js';
import { QuestView } from './questView.js';
import { Ending } from './ending.js';
import { Intro } from './intro.js';
import { Trailer } from './trailer.js';
import { INTRO_SHOTS, ENDING_SHOTS, restoreCage } from './crustFilms.js';
import { Showcase } from './showcase.js';
import { Lineup } from './lineup.js';
import { applyQuality, AutoRes } from './quality.js';
import { TeammateViews } from './teammates.js';

export class GameRenderer {
  constructor(canvas, sim, cfg, settings) {
    this.cfg = cfg;
    this.settings = settings;
    this.sim = sim;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.localClippingEnabled = true;   // first-person guns clip what's right at the eye
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
      const mf = sim.mapData.fog;
      const fog = new THREE.Color(mf ? mf.color : cfg.graphics.fogColor);
      scene.background = fog;
      scene.fog = new THREE.FogExp2(fog, mf ? mf.density : cfg.graphics.fogDensity);
      const map = new MapView(scene, sim, cfg);
      const effects = new Effects(scene, sim, cfg);
      const puddles = new Puddles(scene, sim, cfg, effects);
      effects.puddles = puddles;
      effects.fixtures = map.fixtures;
      effects.lightAt = (pos) => this.envLevel(pos);
      w = {
        scene, map, effects, puddles,
        box: new BoxView(scene, sim, cfg, map),
        saleBoxes: new Map((sim.saleBoxes || []).map((b) => [b.id, new BoxView(scene, sim, cfg, map, b.id)])),
        zombies: new ZombieViews(scene, effects, cfg),
        projectiles: new ProjectileViews(scene, effects, cfg),
        machines: new MachinesView(scene, sim, cfg, map),
        gumMachines: new GumView(scene, sim, cfg, map),
        powerups: new PowerupViews(scene, cfg),
        cheddars: new CheddarViews(scene, effects, cfg),
        lore: new LoreView(scene, sim, cfg),
        quest: new QuestView(scene, sim, cfg, map),
        teammates: new TeammateViews(scene, cfg),
      };
      // Call of the Crust's titans
      if (sim.mapData.titans) w.titans = new TitanView(scene, sim, cfg, map, effects);
      // ...Pit's forge, the War Hammers' effects, and Big Evil Zach
      if (sim.mapData.forge) { w.forge = new ForgeView(scene, sim, cfg, map, effects); w.zach = new ZachView(scene, sim, cfg, map, effects); }
      w.quest.effects = effects;
      w.box.onLand = (spot) => {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          effects.puff(new THREE.Vector3(spot.x + Math.cos(a) * 0.6, 0.2, spot.z + Math.sin(a) * 0.6), { color: 0x6a6052, size: 0.5, grow: 2.5, life: 1.3, alpha: 0.45, vel: new THREE.Vector3(Math.cos(a) * 1.2, 0.3, Math.sin(a) * 1.2) });
        }
        const p = this.sim.playerById(this.localId);
        if (p) this.rig.explosion({ pos: { x: spot.x, y: 0, z: spot.z }, radius: 2, shake: 0.4 }, p.pos);
      };
      for (const v of w.saleBoxes.values()) v.onLand = w.box.onLand;
      w.zombies.islands = sim.mapData.islands || null;   // (Call of the Crust: each island's own dead)
      w.cauldron = new CauldronView(scene, sim.mapData, effects);
      w.cauldron.attachLight(map);
      this.worlds.set(sim.mapData.id, w);
    }
    w.scene.add(this.camera);
    Object.assign(this, { forge: w.forge || null, zach: w.zach || null, titans: w.titans || null, scene: w.scene, map: w.map, box: w.box, saleBoxes: w.saleBoxes, cauldron: w.cauldron, effects: w.effects, puddles: w.puddles, zombies: w.zombies, projectiles: w.projectiles, machines: w.machines, gumMachines: w.gumMachines, powerups: w.powerups, cheddars: w.cheddars, lore: w.lore, quest: w.quest, teammates: w.teammates });
    if (!this.cheddars.onFootstep && this.onCheddarStep) this.cheddars.onFootstep = this.onCheddarStep;
    this.fogBase = new THREE.Color(sim.mapData.fog ? sim.mapData.fog.color : cfg.graphics.fogColor);
    this.fogDensity = sim.mapData.fog ? sim.mapData.fog.density : cfg.graphics.fogDensity;
    this.hazeColor = new THREE.Color('#5a4410');
    this.zombies.onFootstep = footstep;
    this.mapData = sim.mapData;
    if (this.post) this.post.setScene(w.scene);
    if (fresh && this.settings) applyQuality(this, this.settings);
    if (!fresh) this.resetWorld(sim);
    this.sim = sim;
  }

  // Point the current world at a new game on the same map and clear leftovers.
  resetWorld(sim) {
    this.sim = sim;
    this.map.sim = sim;
    this.map.resetPower();
    if (this.machines) this.machines.reset(sim);
    if (this.gumMachines) this.gumMachines.reset(sim);
    for (const [id, v] of this.map.windowViews) v.win = sim.windowById(id);
    for (const v of this.map.windowViews.values()) for (const p of v.planks) p.anim = null;
    this.box.setSim(sim);
    for (const v of this.saleBoxes.values()) v.setSim(sim);
    this.cauldron.reset();
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
    if (this.titans) this.titans.setSim(sim);
    if (this.forge) { this.forge.setSim(sim); this.zach.setSim(sim); }
  }

  setSim(sim) {
    // a big map sees further (Call of the Crust: the other islands across the ice)
    const far = sim.mapData.farPlane || 220;
    if (this.camera.far !== far) { this.camera.far = far; this.camera.updateProjectionMatrix(); }
    if (sim.mapData !== this.mapData) this.buildWorld(sim);
    else this.resetWorld(sim);
    this.prevPlayer = null;
    this.damage = 0;
    this.deathT = 0;
    this.rig.lastDist = null;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const sharp = this.settings.sharpness || this.cfg.graphics.maxPixelRatio;
    const dyn = this.settings.autoRes && this.autoRes ? this.autoRes.scale : 1;
    const pr = Math.min(window.devicePixelRatio || 1, sharp) * (this.settings.renderScale || 1) * dyn;
    this.pixelRatio = pr;
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
    if (!this.autoRes) this.autoRes = new AutoRes(this.cfg);
    if (!s.autoRes) this.autoRes.reset();
    applyQuality(this, s);
    this.resize();
  }

  // Auto resolution: fed each frame's length; resizes when it moves the scale.
  frameTime(dt, targetFps) {
    if (!this.settings || !this.settings.autoRes || !this.autoRes) return;
    if (this.autoRes.sample(dt, targetFps)) this.resize();
  }

  // Shake the camera: k at pos (falling off over `range` m), or k anywhere.
  shake(k, pos = null, range = 30) {
    const p = this.sim && this.sim.playerById(this.localId);
    if (!p) return;
    const d = pos ? Math.hypot(pos.x - p.pos.x, (pos.y || 0) - p.pos.y, pos.z - p.pos.z) : 0;
    const f = Math.max(0, 1 - d / range);
    this.rig.shake = Math.min(1.6, Math.max(this.rig.shake || 0, k * f * 1.4));
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
      this.cauldron.onEvent(e);
      if (e.boxId && this.saleBoxes.has(e.boxId)) this.saleBoxes.get(e.boxId).onEvent(e); else this.box.onEvent(e);
      this.rig.onEvent(e, id);
      this.viewmodel.onEvent(e, id);
      this.projectiles.onEvent(e);
      this.machines.onEvent(e, this.effects);
      if (this.gumMachines) this.gumMachines.onEvent(e, this.effects);
      this.powerups.onEvent(e, this.effects);
      this.cheddars.onEvent(e);
      this.lore.onEvent(e, this.effects);
      this.quest.onEvent(e);
      if (this.titans) this.titans.onEvent(e, this);
      if (this.forge) { this.forge.onEvent(e, this); this.zach.onEvent(e, this); }
      switch (e.type) {
        case 'shot': {
          let from;
          const sdef = this.cfg.weapons[e.weapon];
          if (sdef && sdef.flame) {
            // the flamethrower: a jet of fire out of the nozzle (no flash, no tracer)
            from = e.playerId === id ? this.viewmodel.muzzleWorldPosition(this.camera, this.tmp.clone(), e.side) : (this.teammates.muzzle(e.playerId) || e.origin);
            this.effects.flames.stream(from, e.dir, sdef.flame);
            break;
          }
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
        // GobbleGum, and a Mad Dog'd gun's bite
        case 'aatProc':
          if (e.aat === 'blastFurnace') this.effects.energyBurst(e.pos, this.cfg.aat.types.blastFurnace.color, e.radius || 3);
          else if (e.aat === 'deadWire') this.effects.arc(e.points, this.cfg.aat.types.deadWire.color);
          else if (e.aat === 'thunderWall') this.effects.windBlast(e.pos, { x: e.dir.x, y: 0, z: e.dir.z }, e.range || 8, this.cfg.aat.types.thunderWall.angle);
          break;
        case 'gumShock': this.effects.arc(e.points, '#ff7ad0'); break;
        case 'gumBurst': this.effects.energyBurst({ x: e.pos.x, y: e.pos.y + 0.8, z: e.pos.z }, '#ff7a1a', e.radius || 4); break;
        case 'gumTeleport': for (let i = 0; i < 6; i++) this.effects.puff({ x: e.pos.x + (Math.random() - 0.5), y: e.pos.y + 0.3 + Math.random() * 1.4, z: e.pos.z + (Math.random() - 0.5) }, { color: 0xff7ad0, size: 0.4, grow: 2, life: 0.8, alpha: 0.5 }); break;
        case 'explosion': {
          if (this.cfg.explosions[e.etype]?.energy) this.effects.energyBurst(e.pos, this.cfg.explosions[e.etype].energy, e.radius);
          else if (this.cfg.explosions[e.etype]?.small) this.effects.smallExplosion(e.pos, e.radius);
          else this.effects.explosion(e.pos, e.radius);
          const p = this.sim.playerById(id);
          if (p) this.rig.explosion(e, p.pos);
          break;
        }
        case 'windBlast': {
          this.effects.windBlast(e.origin, e.dir, e.range, e.angle);
          if (e.playerId === id) this.rig.shake = Math.min(1.6, Math.max(this.rig.shake || 0, 1.0));
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
          const snow = !!this.mapData.snow;   // (clawing up out of snow throws up powder, not dirt)
          for (let i = 0; i < 4; i++) this.effects.puff(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.1, (Math.random() - 0.5) * 0.8)), { color: snow ? 0xc8d2e0 : 0x3a3024, size: 0.5, grow: 2.2, life: 1.4, alpha: 0.5, vel: new THREE.Vector3(0, 0.6, 0) });
          for (let i = 0; i < 14; i++) this.effects.spawnParticle(pos, new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 3), { life: 0.9, size: 0.04, color: snow ? [0.8, 0.85, 0.95] : [0.12, 0.09, 0.06] });
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

  // The intro plays through the same slot as the ending (one cutscene at a time).
  startIntro(settings) {
    this.ending = new Intro(this, this.sim, { character: settings.character });
    this.endingScene = this.scene;
    return this.ending;
  }

  // The Call of the Crust trailer, through the same slot.
  startTrailer() {
    this.ending = new Trailer(this, this.sim, this.cfg);
    this.endingScene = this.scene;
    return this.ending;
  }

  // One of Call of the Crust's cutscenes (src/render/crustFilms.js), on the trailer's machinery.
  startFilm(name) {
    const C = this.cfg.crustFilms[name];
    const film = { C, crew: C.crew, shots: name === 'intro' ? INTRO_SHOTS : ENDING_SHOTS, always: (T) => { T.forgeOn = true; }, dispose: restoreCage };
    this.ending = new Trailer(this, this.sim, this.cfg, film);
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
    // (a cutscene can slow the world down, and pick its own lens)
    const sdt = dt * (this.ending.slow ?? 1);
    this.map.update(sdt, this.camera.position, { round: sim.rounds.round, kills: 0 });
    this.zombies.update(sim, sdt, 1, time);
    this.machines.update(sdt);
    if (this.gumMachines) this.gumMachines.update(sdt);
    this.quest.update(sdt, this.camera);
    this.effects.update(sdt);
    const scene = this.ending.update(dt, time);
    if (scene !== this.endingScene) { this.post.setScene(scene); this.endingScene = scene; }
    const vFov = this.ending.fov || 52;
    if (this.camera.fov !== vFov || this.camera.aspect !== this.aspect) { this.camera.fov = vFov; this.camera.aspect = this.aspect; this.camera.updateProjectionMatrix(); }
    this.viewmodel.root.visible = false;
    this.flash = Math.max(0, (this.flash || 0) - dt * 2.2);
    if (this.noDraw) return;
    this.updateBakedLive();
    this.farCull(this.camera);
    this.post.render(dt, { damage: 0, lowHealth: 0, flash: this.flash || 0, tint: 0 });
  }

  // Far detail (CONFIG.graphics.farCull): anything so small at its distance that
  // it would only be a speck of a few pixels isn't drawn at all (taken off every
  // camera layer; put back the moment it's big enough to see). Glowing things
  // and anything on a layer of its own (particles) are left alone.
  farCull(cam) {
    const F = this.cfg.graphics.farCull;
    if (!F || !F.ratio) { if (this.cull) { for (const E of this.cull.list) E.o.layers.mask = 1; this.cull = null; } return; }
    const C = this.cull || (this.cull = { list: [], scene: null, next: 0, culled: 0 });
    const now = performance.now();
    if (C.scene !== this.scene || now >= C.next) this.farScan(C, F, now);
    const DEG = Math.PI / 180;
    // a zoomed view (a scope) shows small things bigger: cull less
    const ratio = F.ratio * Math.tan((F.refFov / 2) * DEG) / Math.tan((cam.fov / 2) * DEG);
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, min2 = F.minDist * F.minDist;
    let n = 0;
    for (const E of C.list) {
      const o = E.o, e = o.matrixWorld.elements, c = E.c;
      const wx = e[0] * c.x + e[4] * c.y + e[8] * c.z + e[12] - cx;
      const wy = e[1] * c.x + e[5] * c.y + e[9] * c.z + e[13] - cy;
      const wz = e[2] * c.x + e[6] * c.y + e[10] * c.z + e[14] - cz;
      const d2 = wx * wx + wy * wy + wz * wz;
      const r = E.r * Math.sqrt(Math.max(e[0] * e[0] + e[1] * e[1] + e[2] * e[2], e[4] * e[4] + e[5] * e[5] + e[6] * e[6], e[8] * e[8] + e[9] * e[9] + e[10] * e[10]));
      const far = d2 > min2 && d2 > r * r * ratio * ratio;
      o.layers.mask = far ? 0 : 1;
      if (far) n++;
    }
    C.culled = n;
  }

  // (what can be culled: everything drawn on the ordinary layer that isn't a glow)
  farScan(C, F, now) {
    for (const E of C.list) E.o.layers.mask = 1;   // (put everything back first)
    C.list.length = 0;
    C.scene = this.scene;
    C.next = now + F.rescan * 1000;
    const bright = (m) => {
      if (!m || m.blending === THREE.AdditiveBlending || m.fog === false || m.toneMapped === false) return true;
      if (!m.emissive) return false;
      const k = (m.emissiveIntensity ?? 1) * Math.max(m.emissive.r, m.emissive.g, m.emissive.b);
      return k > F.glow;
    };
    this.scene.traverse((o) => {
      // (frustumCulled off: its bounds don't say where it's drawn, e.g. moved in its shader)
      if (!(o.isMesh || o.isSprite) || o.isSkinnedMesh || o.frustumCulled === false || o.layers.mask !== 1 || o.userData.noCull || !o.geometry) return;
      if (Array.isArray(o.material) ? o.material.some(bright) : bright(o.material)) return;
      let bs;
      if (o.isInstancedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); bs = o.boundingSphere; }
      else { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); bs = o.geometry.boundingSphere; }
      if (!bs || !(bs.radius > 0)) return;
      C.list.push({ o, c: bs.center.clone(), r: bs.radius });
    });
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
      const T = this.cfg.title.cam;
      if (sim.mapData.id === this.cfg.title.map) {
        // (the title's map: a slow circle round it, high up)
        const a = time * T.speed;
        this.camera.position.set(T.center[0] + Math.cos(a) * T.radius, T.center[1] + T.height + Math.sin(time * 0.13) * T.bob, T.center[2] + Math.sin(a) * T.radius);
        this.camera.lookAt(T.look[0], T.look[1], T.look[2]);
        if (Math.abs(this.camera.fov - T.fov) > 0.5 && this.camera.aspect) { this.camera.fov = T.fov; this.camera.updateProjectionMatrix(); }
      } else {
        this.camera.position.set(Math.sin(time * 0.05) * 3, 1.7 + Math.sin(time * 0.3) * 0.03, 6);
        this.camera.rotation.set(0.12 + Math.sin(time * 0.17) * 0.02, Math.sin(time * 0.07) * 0.35, 0);
      }
    }

    this.map.update(dt, this.camera.position, { round: sim.rounds.round, kills: p ? p.kills : 0 });
    // eye adaptation: open up in the dark, stop down once the lights are on
    const g = this.cfg.graphics;
    const lit = bakeUniforms.bakePower.value;
    const targetExp = (g.exposureDark ?? g.exposure) + ((g.exposureLit ?? g.exposure) - (g.exposureDark ?? g.exposure)) * lit;
    this.exposure = this.exposure == null ? targetExp : this.exposure + (targetExp - this.exposure) * Math.min(1, dt * 1.5);
    this.renderer.toneMappingExposure = mode === 'title' ? g.exposure : this.exposure * (sim.mapData.brightness || 1);
    this.box.update(dt, time);
    for (const v of this.saleBoxes.values()) v.update(dt, time);
    this.cauldron.update(dt, time, sim, this.camera.position);
    this.zombies.update(sim, dt, alpha, time);
    this.projectiles.update(sim, dt, alpha);
    this.machines.update(dt);
    if (this.gumMachines) this.gumMachines.update(dt);
    this.powerups.update(dt, sim, this.camera);
    this.cheddars.update(sim, this.zombies.prev, dt, alpha, time);
    this.lore.update(dt);
    this.quest.update(dt, this.camera);
    if (this.titans) this.titans.update(dt, time, this.camera);
    if (this.forge) { this.forge.update(dt, time); this.zach.update(dt, time); }
    this.teammates.update(sim, this.localId, dt, alpha, time, this.camera);
    if (watch && watch.tag) watch.tag.visible = false;   // no name tag in your face while spectating

    // Cheddar Round haze: yellow tint, thicker yellow-brown fog, distant lightning
    const hazeTarget = sim.rounds.cheddar ? 1 : 0;
    this.haze = (this.haze || 0) + (hazeTarget - (this.haze || 0)) * Math.min(1, dt * 0.8);
    const air = this.map.crust && this.map.crust.air;   // (out in space: each island's own air)
    if (air) { this.fogBase.copy(air.fog); this.fogDensity = air.density; }
    this.scene.fog.color.copy(this.fogBase).lerp(this.hazeColor, this.haze * 0.8);
    this.scene.background = this.scene.fog.color;
    // a thermal scope (the Carrion Crown): the dead burn bright through the fog and the dark
    const held = p && p.alive && this.cfg.weapons[p.loadout.slots[p.loadout.current].id];
    const thermal = !!(held && held.thermal && this.viewmodel.scoped);
    this.zombies.setThermal(thermal);
    this.thermal = thermal;
    this.scene.fog.density = (this.fogDensity ?? this.cfg.graphics.fogDensity) * (1 + this.haze * 0.9) * (thermal ? 0.25 : 1);
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
    // one more hit and you're down: pulse red around the edges (fades in/out)
    const hit = this.cfg.zombie.attackDamage * (p && p.boosts && p.boosts.defense ? p.boosts.defense : 1);
    const brink = p && p.alive && !p.downed && p.health <= hit + 0.01 ? 1 : 0;
    this.brink = (this.brink || 0) + (brink - (this.brink || 0)) * Math.min(1, dt * 6);
    this.updateBakedLive();
    this.farCull(this.camera);
    this.post.render(dt, { damage: this.damage, lowHealth, brink: this.brink, flash: this.flash || 0, tint: (this.haze || 0) * this.cfg.cheddar.haze });
    this.scoped = !!(p && p.alive && this.viewmodel.scoped);
  }
}

