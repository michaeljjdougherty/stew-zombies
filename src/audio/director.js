// =============================================================================
// Sound director: turns game events and world state into sounds.
// Also runs the ambience (wind at the windows, light buzz, drips, creaks).
// =============================================================================
import * as S from './sfx.js';

const R = (a, b) => a + Math.random() * (b - a);

export class SoundDirector {
  constructor(engine, sim, cfg) {
    this.A = engine;
    this.sim = sim;
    this.cfg = cfg;
    this.groanTimers = new Map();
    this.activeVoices = 0;
    this.ambientStarted = false;
    this.heartT = 0;
    this.dripT = 2;
    this.creakT = 6;
    this.localId = null;
  }

  startAmbience(mapView) {
    const A = this.A;
    if (!A.ready || this.ambientStarted) return;
    this.ambientStarted = true;
    const ctx = A.ctx;
    this.ambNodes = [];
    const keep = (n) => { this.ambNodes.push(n); return n; };
    // wind whistling in through each broken window
    for (const w of this.sim.windows) {
      const out = A.output({ pos: { x: w.exterior.x, y: 1.6, z: w.exterior.z }, bus: 'ambient', reverb: 0.25, ref: 3, rolloff: 1.1 });
      const src = keep(ctx.createBufferSource()); src.buffer = A.noise.brown; src.loop = true; src.start(0, Math.random() * 2);
      const bp = A.filter('bandpass', 450, 0.6);
      const lfo = keep(ctx.createOscillator()); lfo.frequency.value = R(0.05, 0.1); lfo.start();
      const lfoG = A.gain(260); lfo.connect(lfoG); lfoG.connect(bp.frequency);
      const g = A.gain(0.09);
      const lfo2 = keep(ctx.createOscillator()); lfo2.frequency.value = R(0.08, 0.15); lfo2.start();
      const lfo2G = A.gain(0.06); lfo2.connect(lfo2G); lfo2G.connect(g.gain);
      src.connect(bp); bp.connect(g); g.connect(out.input);
      // occasional whistle
      const wh = keep(ctx.createBufferSource()); wh.buffer = A.noise.white; wh.loop = true; wh.start(0, Math.random() * 2);
      const whf = A.filter('bandpass', R(900, 1400), 18);
      const whg = A.gain(0.0);
      const wlfo = keep(ctx.createOscillator()); wlfo.frequency.value = R(0.03, 0.07); wlfo.start();
      const wlg = A.gain(0.05); wlfo.connect(wlg); wlg.connect(whg.gain);
      wh.connect(whf); whf.connect(whg); whg.connect(out.input);
    }
    // faint distant machinery rumble (it will grow once the power is on)
    const rumbleOut = A.output({ bus: 'ambient', reverb: 0.4 });
    const r = keep(ctx.createBufferSource()); r.buffer = A.noise.brown; r.loop = true; r.start();
    const rl = A.filter('lowpass', 110, 0.7);
    this.rumble = A.gain(0.12);
    r.connect(rl); rl.connect(this.rumble); this.rumble.connect(rumbleOut.input);

    // electrical buzz from each working fluorescent fixture
    this.buzzers = [];
    const flickery = mapView.fixtures.filter((f) => f.data.lit && f.data.flicker > 0.3).slice(0, this.cfg.audio.maxBuzzers);
    for (const f of flickery) {
      const out = A.output({ pos: { x: f.data.x, y: f.data.y, z: f.data.z }, bus: 'ambient', reverb: 0.15, ref: 1.5, rolloff: 1.6 });
      const o1 = keep(ctx.createOscillator()); o1.type = 'sawtooth'; o1.frequency.value = 120; o1.start();
      const o2 = keep(ctx.createOscillator()); o2.type = 'square'; o2.frequency.value = 240.5; o2.start();
      const bp = A.filter('bandpass', 180, 1.5);
      const g = A.gain(0);
      const og2 = A.gain(0.3);
      o1.connect(bp); o2.connect(og2); og2.connect(bp); bp.connect(g); g.connect(out.input);
      // crackle for flicker
      const cr = keep(ctx.createBufferSource()); cr.buffer = A.noise.white; cr.loop = true; cr.start(0, Math.random() * 2);
      const crf = A.filter('highpass', 3000, 0.7);
      const crg = A.gain(0);
      cr.connect(crf); crf.connect(crg); crg.connect(out.input);
      this.buzzers.push({ f, g, crg, lastLevel: f.level });
    }
  }

  // Silence the current map's ambience (before switching maps).
  stopAmbience() {
    for (const n of this.ambNodes || []) { try { n.stop(); n.disconnect(); } catch (e) { /* already stopped */ } }
    this.ambNodes = [];
    this.buzzers = null;
    this.rumble = null;
    this.ambientStarted = false;
  }

  // --- event handling --------------------------------------------------------
  onEvent(e) {
    const A = this.A;
    if (!A.ready) return;
    const sim = this.sim;
    const local = e.playerId === this.localId;
    const zpos = (id, y = 1.5) => { const z = sim.zombieById(id); return z ? { x: z.pos.x, y: z.pos.y + y, z: z.pos.z } : null; };
    switch (e.type) {
      case 'shot': {
        const def = this.cfg.weapons[e.weapon];
        A.play(S.gunshot, def.sound, local ? { reverb: 0.35, gain: 0.8 } : { pos: e.origin, reverb: 0.4 });
        if (local && e.action) {
          const delay = 0.08 + (e.action === 'bolt' ? 0.05 : 0);
          if (e.clip > 0 || e.action === 'pump') A.play(e.action === 'bolt' ? S.boltCycle : S.pumpRack, {}, { gain: 0.85, delay, reverb: 0.08 });
        }
        break;
      }
      case 'reloadShell': if (local) A.play(S.shellIn, {}, { gain: 0.9, reverb: 0.08 }); break;
      case 'reloadDone':
        if (local && this.cfg.weapons[e.weapon].reloadStyle === 'shell' && e.empty && this.cfg.weapons[e.weapon].action === 'pump') A.play(S.pumpRack, {}, { gain: 0.85, reverb: 0.08 });
        break;
      case 'grenadePull': if (local) A.play(S.grenadePin, {}, { gain: 0.8, reverb: 0.05 }); break;
      case 'grenadeThrow': if (local) A.play(S.grenadeThrow, {}, { gain: 0.8, reverb: 0.05 }); break;
      case 'projectileBounce': A.play(S.grenadeBounce, { speed: e.speed }, { pos: e.pos, ref: 2 }); break;
      case 'projectileStick': A.play(S.stickThunk, { flesh: e.zombieId != null }, { pos: e.pos, ref: 2 }); break;
      case 'explosion': {
        const p = sim.playerById(this.localId);
        const d = p ? Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) : 10;
        // close blasts are played unpanned and loud so they hit like they should
        if (d < 6) A.play(S.explosion, { big: e.radius / 4.5 }, { gain: 1.1, reverb: 0.5 });
        else A.play(S.explosion, { big: e.radius / 4.5 }, { pos: e.pos, ref: 6, reverb: 0.6 });
        break;
      }
      case 'dryFire': if (local) A.play(S.dryFire, {}, { gain: 0.8, reverb: 0.05 }); break;
      case 'reloadStart':
        if (local) {
          A.play(S.reloadCloth, {}, { gain: 0.7, reverb: 0.05 });
          const T = e.time;
          const style = this.cfg.weapons[e.weapon].reloadStyle;
          const at = (fn, frac, gain = 0.85) => A.play(fn, {}, { gain, delay: T * frac, reverb: 0.08 });
          if (style === 'shell') { /* each shell plays on reloadShell */ }
          else if (style === 'belt') { at(S.beltOpen, 0.1); at(S.magOut, 0.22, 0.8); at(S.magIn, 0.55, 0.9); at(S.beltClose, 0.68, 1); at(S.slideRelease, 0.85, 0.9); }
          else if (style === 'break') { at(S.breakOpen, 0.12); at(S.shellIn, 0.45); at(S.shellIn, 0.6); at(S.breakClose, 0.76, 1); }
          else if (style === 'cylinder') { at(S.cylinderOut, 0.12); at(S.shellsDrop, 0.2, 0.7); at(S.shellIn, 0.5, 0.6); at(S.shellIn, 0.6, 0.6); at(S.cylinderIn, 0.78, 1); }
          else {
            at(S.magOut, 0.13, 0.8);
            if (e.empty) at(S.slideRelease, 0.77, 0.9);
          }
        }
        break;
      case 'reloadMagIn':
        if (local && this.cfg.weapons[e.weapon].reloadStyle === 'mag') A.play(S.magIn, {}, { gain: 0.9, reverb: 0.1 });
        break;
      case 'weaponSwitch':
      case 'weaponGiven':
        if (local) A.play(S.weaponSwitch, {}, { gain: 0.8, reverb: 0.05 });
        break;
      case 'wallBuy':
        if (local) A.play(S.purchase, {}, { gain: 0.7, reverb: 0.15 });
        break;
      case 'cantAfford':
        if (local) A.play(S.denied, {}, { gain: 0.8, reverb: 0.05 });
        break;
      case 'doorOpened': {
        const d = sim.world.doors.find((q) => q.id === e.id);
        if (e.playerId === this.localId) A.play(S.purchase, {}, { gain: 0.7, reverb: 0.15 });
        if (d) A.play(e.kind === 'debris' ? S.debrisClear : S.doorOpen, {}, { pos: { x: d.center.x, y: 1.5, z: d.center.z }, ref: 4, gain: 1.1 });
        break;
      }
      case 'boxOpen': {
        const b = sim.box.pos;
        if (local) A.play(S.purchase, {}, { gain: 0.7, reverb: 0.15 });
        A.play(S.boxOpen, {}, { pos: b, ref: 3 });
        A.play(S.musicBox, { duration: e.spinTime }, { pos: b, ref: 3, gain: 0.9, reverb: 0.5 });
        break;
      }
      case 'boxLanded': A.play(S.boxLand, {}, { pos: sim.box.pos, ref: 3, reverb: 0.5 }); break;
      case 'boxTaken': if (local) A.play(S.boxTake, {}, { gain: 0.9, reverb: 0.05 }); break;
      case 'boxExpired': A.play(S.boxShut, {}, { pos: sim.box.pos, ref: 3 }); break;
      case 'melee': if (local) A.play(S.knifeSwing, {}, { gain: 0.8, reverb: 0.05 }); break;
      case 'meleeHit': A.play(S.knifeHit, {}, local ? { gain: 1, reverb: 0.1 } : { pos: zpos(e.zombieId, 1.2) }); break;
      case 'zombieHit': {
        const pos = e.point;
        if (e.kind === 'knife') break;
        if (e.part === 'head') A.play(S.headshot, {}, { pos, gain: 1.1, ref: 4 });
        else A.play(S.fleshHit, {}, { pos, gain: 1, ref: 4 });
        break;
      }
      case 'zombieLimb': {
        const pos = zpos(e.id, 1.3);
        if (pos) A.play(S.gore, {}, { pos, ref: 3 });
        break;
      }
      case 'zombieKilled':
        this.groanTimers.delete(e.id);
        A.play(S.gore, {}, { pos: { x: e.pos.x, y: 1, z: e.pos.z }, gain: 0.7, ref: 2.5 });
        break;
      case 'zombieScream': {
        const z = sim.zombieById(e.id);
        A.play(S.zombieScream, {}, { pos: e.pos, gain: 1, ref: 5, trackId: 'v' + e.id, getPos: () => { const zz = sim.zombieById(e.id); return zz && { x: zz.pos.x, y: 1.6, z: zz.pos.z }; } });
        if (z) this.groanTimers.set(e.id, R(1.5, 3));
        break;
      }
      case 'zombieSwing': {
        const late = sim.rounds.round >= 6;
        A.play(S.zombieSnarl, { f0: R(late ? 150 : 110, late ? 220 : 160), dur: R(0.3, 0.5) }, { pos: { x: e.pos.x, y: 1.6, z: e.pos.z }, ref: 3 });
        break;
      }
      case 'playerHit': if (e.playerId === this.localId) A.play(S.playerHurt, {}, { gain: 1, reverb: 0.1 }); break;
      case 'playerJump': if (local) A.play(S.jump, {}, { gain: 0.8, reverb: 0.05 }); break;
      case 'playerLand': if (local && e.impact > 2) A.play(S.land, { impact: e.impact, surface: 'gym' }, { gain: 0.9, reverb: 0.1 }); break;
      case 'boardTorn': {
        const w = sim.windowById(e.windowId);
        A.play(S.boardTear, {}, { pos: { x: w.center.x, y: 1.4, z: w.center.z }, ref: 4, gain: 1.1 });
        break;
      }
      case 'boardRepaired': {
        const w = sim.windowById(e.windowId);
        A.play(S.boardRepair, {}, { pos: { x: w.center.x, y: 1.4, z: w.center.z }, ref: 4 });
        break;
      }
      case 'roundEnd': A.play(S.roundEndSting, {}, { bus: 'music', reverb: 0.5, gain: 0.9 }); break;
      case 'roundStart': A.play(S.roundStartSting, {}, { bus: 'music', reverb: 0.5, gain: 0.9 }); break;
    }
  }

  zombieFootstep(z) {
    if (!this.A.ready) return;
    const lp = this.A.listenerPos;
    if (lp && Math.hypot(z.pos.x - lp.x, z.pos.z - lp.z) > 22) return;
    this.A.play(S.zombieStep, { walker: z.type === 'walker' }, { pos: { x: z.pos.x, y: 0.1, z: z.pos.z }, ref: 1.5, rolloff: 1.4, gain: z.type === 'walker' ? 0.7 : 1 });
  }

  playerFootstep(sprint, speed) {
    if (!this.A.ready) return;
    const p = this.sim.playerById(this.localId);
    const room = p ? this.sim.roomAt(p.pos, p.region) : null;
    this.A.play(S.footstep, { intensity: sprint ? 1.1 : 0.7, sprint, surface: room ? room.floor : 'gym' }, { gain: 0.8, reverb: 0.12 });
  }

  // --- per-frame -------------------------------------------------------------
  update(dt, localPlayer) {
    const A = this.A;
    if (!A.ready) return;
    const sim = this.sim;
    const round = sim.rounds.round;

    // stuck crossbow bolts beep faster and faster
    if (!this.beepT) this.beepT = new Map();
    for (const pr of sim.projectiles) {
      if (pr.type !== 'bolt' || !pr.stuck || !isFinite(pr.fuse)) continue;
      let t = (this.beepT.get(pr.id) ?? 0) - dt;
      if (t <= 0) { A.play(S.boltBeep, {}, { pos: pr.pos, ref: 2 }); t = 0.06 + Math.max(0, pr.fuse) * 0.2; }
      this.beepT.set(pr.id, t);
    }
    if (this.beepT.size > 20) this.beepT.clear();

    // zombie vocal chatter
    const [gMin, gMax] = this.cfg.audio.groanInterval;
    let voices = 0;
    for (const t of A.tracked.keys()) if (String(t).startsWith('v')) voices++;
    for (const z of sim.zombies) {
      let t = this.groanTimers.get(z.id);
      if (t === undefined) { t = R(0.2, gMax); }
      t -= dt;
      if (t <= 0) {
        if (voices < this.cfg.audio.maxZombieVoices) {
          const aggressive = z.type !== 'walker';
          const recipe = aggressive && Math.random() < 0.7 ? S.zombieSnarl : S.zombieGroan;
          const late = Math.min(1, Math.max(0, (round - 3) / 10));
          const f0 = aggressive ? R(120, 180) * (1 + late * 0.4) : R(62, 100) * (1 + late * 0.25);
          const id = z.id;
          A.play(recipe, { f0 }, {
            pos: { x: z.pos.x, y: 1.6, z: z.pos.z }, ref: 2.5,
            trackId: 'v' + id, getPos: () => { const zz = sim.zombieById(id); return zz && { x: zz.pos.x, y: zz.pos.y + 1.6, z: zz.pos.z }; },
          });
          voices++;
        }
        t = R(gMin, gMax) * (z.type === 'walker' ? 1 : 0.6);
      }
      this.groanTimers.set(z.id, t);
    }

    // how echoey the room you're in is
    if (localPlayer) {
      const room = sim.roomAt(localPlayer.pos, localPlayer.region);
      const target = room ? (room.reverb ?? 0.6) : 0.6;
      A.roomReverb = (A.roomReverb ?? target) + (target - (A.roomReverb ?? target)) * Math.min(1, dt * 2);
    }

    // low health heartbeat
    if (localPlayer && localPlayer.alive && localPlayer.health < localPlayer.maxHealth * 0.55) {
      this.heartT -= dt;
      if (this.heartT <= 0) {
        A.play(S.heartbeat, {}, { gain: 0.9, reverb: 0 });
        this.heartT = 0.85;
      }
    }

    // drips and distant noises
    this.dripT -= dt;
    if (this.dripT <= 0) {
      this.dripT = R(1.5, 5);
      const lp = A.listenerPos || { x: 0, z: 0 };
      A.play(S.drip, {}, { pos: { x: lp.x + R(-12, 12), y: 0.1, z: lp.z + R(-12, 12) }, reverb: 0.8, bus: 'ambient', ref: 3 });
    }
    this.creakT -= dt;
    if (this.creakT <= 0) {
      this.creakT = R(8, 22);
      const a = Math.random() * Math.PI * 2, d = R(20, 30);
      const lp = A.listenerPos || { x: 0, z: 0 };
      const pos = { x: lp.x + Math.cos(a) * d, y: R(1, 6), z: lp.z + Math.sin(a) * d };
      A.play(Math.random() < 0.65 ? S.creak : S.bang, {}, { pos, reverb: 1.2, bus: 'ambient', ref: 6, gain: 0.8 });
    }

    // fluorescent buzz tracks the light level; crackle when it flickers
    if (this.buzzers) {
      for (const bz of this.buzzers) {
        const lvl = bz.f.level;
        bz.g.gain.value = 0.02 + lvl * 0.035;
        const change = Math.abs(lvl - bz.lastLevel);
        bz.crg.gain.value = Math.min(0.2, change * 3);
        bz.lastLevel = lvl;
      }
    }
  }
}
