// =============================================================================
// Sound director: turns game events and world state into sounds.
// Also runs the ambience (wind at the windows, light buzz, drips, creaks).
// =============================================================================
import * as S from './sfx.js';
import { StewSong, FireSaleMusic } from './music.js';
import { powerupActive } from '../sim/powerups.js';
import { GUN_VOICES, mechSetFor } from './gunSamples.js';
import { baseWeaponId } from '../config.js';
import { CREW } from '../lore/crew.js';
import { voiceKey } from '../lore/voice.js';

const R = (a, b) => a + Math.random() * (b - a);

// Each perk machine has its own little tune (Hz).
const PERK_TUNES = {
  secondHelping: [523, 659, 784, 659, 523, 784, 1047],
  beefcakeBroth: [196, 196, 262, 247, 196, 330, 294],
  hotPotHustle: [659, 784, 880, 988, 880, 784, 1175],
  doubleLadle: [392, 392, 494, 494, 587, 587, 784],
  marathonMinestrone: [330, 392, 440, 523, 587, 659, 784, 880],
};

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
    this.song = null;       // the Stew song, when it's playing
    this.talkUntil = 0;     // ducks the ambience while Erik talks
    this.tickT = 0;
  }

  // A recorded gun mechanics sound (mag out, bolt, pump...) or a synth fallback.
  mech(weaponId, part, delay, fallback, gain = 0.9) {
    const A = this.A;
    const def = this.cfg.weapons[weaponId];
    const key = def ? mechSetFor(weaponId, def)[part] : null;
    if (key && A.hasSample(Array.isArray(key) ? key[0] : key)) A.play(S.sample, { key, gain }, { delay, reverb: 0.06, gain: 1 });
    else if (fallback) A.play(fallback, {}, { gain, delay, reverb: 0.08 });
  }

  localWeapon() {
    const p = this.sim.playerById(this.localId);
    return p ? p.loadout.slots[p.loadout.current].id : null;
  }

  // The ending cutscene's sounds (src/render/ending.js cues).
  cue(name) {
    const A = this.A;
    if (!A.ready) return;
    const booth = { x: 0, y: 6, z: 0 };
    switch (name) {
      case 'shatter': A.play(S.glassShatter, {}, { pos: booth, ref: 12, gain: 1.5, reverb: 0.9 }); A.play(S.explosion, {}, { pos: booth, ref: 10, gain: 0.6, reverb: 0.9 }); break;
      case 'thud': A.play(S.boxThud, {}, { gain: 1.2, reverb: 0.6 }); break;
      case 'lightsDie': A.play(S.powerDown, {}, { gain: 1.2, reverb: 0.9 }); break;
      case 'schnitz': A.play(S.schnitzVoice, { text: "This season isn't over yet.", dur: 3 }, { gain: 1.4, reverb: 1, bus: 'voice' }); break;
      case 'smoke': A.play(S.boxWhoosh, {}, { gain: 1.2, reverb: 0.8 }); A.play(S.smallBoom, {}, { gain: 1, reverb: 0.8 }); break;
      case 'lightsBack': A.play(S.powerOn, {}, { gain: 1, reverb: 0.8 }); break;
      case 'doors': A.play(S.creak, {}, { gain: 1.2, reverb: 0.8 }); A.play(S.bang, {}, { gain: 0.9, reverb: 0.9, delay: 1.2 }); break;
      case 'space': A.play(S.spaceWind, { dur: 12 }, { gain: 0.9, reverb: 0.5 }); break;
      case 'portal': A.play(S.thunder, { near: 0.4 }, { gain: 0.9, reverb: 0.8 }); A.play(S.electrocute, {}, { gain: 0.9, reverb: 0.6, delay: 0.3 }); break;
      case 'brian': A.play(S.stewTalk, { text: 'You guys coming?', dur: 1.6 }, { gain: 1.1, reverb: 0.3, bus: 'voice' }); break;
      case 'black': A.play(S.bang, {}, { gain: 1.3, reverb: 0.2 }); break;
      case 'card': A.play(S.roundStartSting, {}, { gain: 1, reverb: 0.8 }); break;
      // --- the intro (src/render/intro.js)
      case 'card1': case 'card2': case 'card3': A.play(S.paChime, {}, { gain: 0.35, reverb: 0.9, bus: 'music' }); break;
      case 'slam': A.play(S.bang, {}, { gain: 1.3, reverb: 0.7 }); break;
      case 'eyes': A.play(S.thunder, { near: 0.15 }, { gain: 0.8, reverb: 0.9 }); break;
      case 'fire': A.play(S.boxWhoosh, {}, { gain: 1.3, reverb: 0.8 }); A.play(S.explosion, {}, { gain: 0.7, reverb: 0.9 }); break;
      case 'laugh': A.play(S.erikLaugh, {}, { gain: 1.1, reverb: 0.6, bus: 'voice', delay: 0.4 }); break;
      case 'crowd': A.play(S.crowdCheer, { dur: 9 }, { gain: 0.9, reverb: 0.7 }); A.play(S.refWhistle, {}, { gain: 0.7, reverb: 0.6, delay: 0.6 }); break;
      case 'green': A.play(S.powerDown, {}, { gain: 1.2, reverb: 0.9 }); A.play(S.crowdScream, { dur: 4.5 }, { gain: 0.8, reverb: 0.8, delay: 0.5 }); break;
      case 'drain': A.play(S.electrocute, {}, { gain: 0.9, reverb: 0.7 }); A.play(S.powerOn, {}, { gain: 0.6, reverb: 0.8 }); break;
      case 'rise': for (let i = 0; i < 5; i++) A.play(S.dirtRise, {}, { gain: 0.9, reverb: 0.6, delay: i * 0.25 }); A.play(S.zombieScream, {}, { gain: 0.8, reverb: 0.7, delay: 1.2 }); break;
      case 'shutter': A.play(S.bang, {}, { gain: 1.1, reverb: 0.8, delay: 0.5 }); A.play(S.creak, {}, { gain: 0.9, reverb: 0.8 }); break;
      case 'black3': A.play(S.bang, {}, { gain: 1.3, reverb: 0.3 }); break;
      case 'title': A.play(S.roundStartSting, {}, { gain: 1.1, reverb: 0.8, bus: 'music' }); break;
    }
  }

  // One line of a cutscene, in the speaker's voice.
  voiceLine(who, text, dur) {
    const A = this.A;
    if (!A.ready) return;
    const key = voiceKey(who === 'erikPA' ? 'erik' : who, text);
    if (key && A.hasSample(key)) {
      if (who === 'erikPA') A.play(S.paVoice, { key, chime: false, arena: true }, { bus: 'voice', reverb: 0.75, gain: 1 });
      else A.play(S.liveVoice, { key }, { bus: 'voice', reverb: who === 'schnitz' ? 1 : 0.25, gain: 1 });
      return;
    }
    if (who === 'schnitz') A.play(S.schnitzVoice, { text, dur }, { gain: 1.4, reverb: 1, bus: 'voice' });
    else if (who === 'erikPA') A.play(S.erikPA, { text, dur, chime: false }, { bus: 'voice', reverb: 0.7, gain: 1 });
    else if (who === 'erik') A.play(S.crewVoice, { text, dur, f0: 142, grit: 0.4 }, { bus: 'voice', reverb: 0.25, gain: 0.95 });
    else {
      const v = (CREW[who] && CREW[who].voice) || {};
      A.play(S.crewVoice, { text, dur, f0: v.f0, grit: v.grit }, { bus: 'voice', reverb: 0.25, gain: 0.95 });
    }
  }

  stopSong() { if (this.song) { this.song.stop(0.4); this.song = null; } }

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
  // --- the jukebox and the Clearance Sale theme -------------------------------
  // Both follow the game's state (so a friend online hears the same thing).
  updateMusic() {
    const A = this.A, sim = this.sim;
    // game-show music for as long as the sale lasts
    const sale = !!(sim.powerups && powerupActive(sim, 'clearanceSale')) && this.ambientStarted;
    this.saleMusic = this.saleMusic || new FireSaleMusic(A);
    if (sale && !this.saleMusic.playing) this.saleMusic.start('music', 0.75);
    else if (!sale && this.saleMusic.playing) this.saleMusic.stop(1.5);
    // the jukebox
    const j = sim.jukebox, spot = sim.mapData.jukebox;
    const want = j && j.song != null && this.ambientStarted ? j.song + '@' + j.startedAt : null;
    if (want === this.jbKey) return;
    if (this.jb) { const o = this.jb; try { o.out.input.gain.setTargetAtTime(0.0001, A.now(), 0.15); setTimeout(() => { try { o.src.stop(); o.out.input.disconnect(); } catch { /* gone */ } }, 800); } catch { /* gone */ } this.jb = null; }
    this.jbKey = want;
    if (!want) return;
    const song = this.cfg.jukebox.songs[j.song];
    const offset = Math.max(0, sim.time - j.startedAt);
    this.loadSong(song.file).then((buf) => {
      if (!buf || this.jbKey !== want) return;
      const out = A.output({ pos: { x: spot.x, y: 1.2, z: spot.z + 0.3 }, bus: 'music', ref: 6, rolloff: 0.9, reverb: 0.25, gain: 1.6 });
      const src = A.ctx.createBufferSource(); src.buffer = buf;
      src.connect(out.input);
      const at = Math.min(offset + (A.now() - this.jbAsked), buf.duration - 0.1);
      src.start(A.now() + 0.05, Math.max(0, at));
      this.jb = { src, out };
    });
    this.jbAsked = A.now();
  }

  loadSong(file) {
    this.songs = this.songs || new Map();
    if (!this.songs.has(file)) {
      this.songs.set(file, fetch('assets/music/' + file + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : null)).then((ab) => (ab ? this.A.ctx.decodeAudioData(ab) : null)).catch(() => null));
    }
    return this.songs.get(file);
  }

  stopAmbience() {
    if (this.saleMusic && this.saleMusic.playing) this.saleMusic.stop(0.5);
    if (this.jb) { try { this.jb.src.stop(); this.jb.out.input.disconnect(); } catch { /* gone */ } this.jb = null; }
    this.jbKey = null;
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
        const voice = GUN_VOICES[baseWeaponId(e.weapon)];
        A.play(S.gunshot, { ...def.sound, voice, upgraded: !!def.upgraded }, local ? { reverb: 0.3, gain: 0.85 } : { pos: e.origin, reverb: 0.45, ref: 4 });
        if (local && e.action) {
          const delay = 0.08 + (e.action === 'bolt' ? 0.12 : 0.04);
          if (e.clip > 0 || e.action === 'pump') this.mech(e.weapon, e.action === 'bolt' ? 'bolt' : 'pump', delay, e.action === 'bolt' ? S.boltCycle : S.pumpRack, 0.9);
        }
        break;
      }
      case 'reloadShell': if (local) this.mech(e.weapon, 'shell', 0, S.shellIn, 0.9); break;
      case 'reloadDone':
        if (local && this.cfg.weapons[e.weapon].reloadStyle === 'shell' && e.empty && this.cfg.weapons[e.weapon].action === 'pump') this.mech(e.weapon, 'pump', 0, S.pumpRack, 0.9);
        break;
      case 'grenadePull': if (local) A.play(S.grenadePin, {}, { gain: 0.8, reverb: 0.05 }); break;
      case 'grenadeThrow': if (local) A.play(S.grenadeThrow, {}, { gain: 0.8, reverb: 0.05 }); break;
      case 'projectileBounce': A.play(S.grenadeBounce, { speed: e.speed }, { pos: e.pos, ref: 2 }); break;
      case 'projectileStick': A.play(S.stickThunk, { flesh: e.zombieId != null }, { pos: e.pos, ref: 2 }); break;
      case 'explosion': {
        if (this.cfg.explosions[e.etype]?.energy) { A.play(S.fucciImpact, {}, { pos: e.pos, ref: 3, reverb: 0.4, gain: 0.9 }); break; }
        if (this.cfg.explosions[e.etype]?.small) { A.play(S.smallBoom, {}, { pos: e.pos, ref: 3, reverb: 0.3, gain: 0.8 }); break; }
        const p = sim.playerById(this.localId);
        const d = p ? Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) : 10;
        // close blasts are played unpanned and loud so they hit like they should
        if (d < 6) A.play(S.explosion, { big: e.radius / 4.5 }, { gain: 1.1, reverb: 0.5 });
        else A.play(S.explosion, { big: e.radius / 4.5 }, { pos: e.pos, ref: 6, reverb: 0.6 });
        break;
      }
      case 'dryFire': if (local) this.mech(e.weapon || this.localWeapon(), 'dry', 0, S.dryFire, 0.8); break;
      case 'reloadStart':
        if (local) {
          A.play(S.reloadCloth, {}, { gain: 0.7, reverb: 0.05 });
          const T = e.time;
          const style = this.cfg.weapons[e.weapon].reloadStyle;
          const at = (fn, frac, gain = 0.85) => A.play(fn, {}, { gain, delay: T * frac, reverb: 0.08 });
          const m = (part, frac, fallback, gain = 0.9) => this.mech(e.weapon, part, T * frac, fallback, gain);
          if (style === 'shell') { /* each shell plays on reloadShell */ }
          else if (style === 'belt') { at(S.beltOpen, 0.1); m('out', 0.22, S.magOut); m('in', 0.55, S.magIn); at(S.beltClose, 0.68, 1); m('bolt', 0.85, S.slideRelease); }
          else if (style === 'break') { at(S.breakOpen, 0.12); m('shell', 0.45, S.shellIn); m('shell', 0.6, S.shellIn); at(S.breakClose, 0.76, 1); }
          else if (style === 'cylinder') { m('open', 0.12, S.cylinderOut); m('eject', 0.2, S.shellsDrop, 0.8); m('shell', 0.5, S.shellIn, 0.7); m('shell', 0.6, S.shellIn, 0.7); m('close', 0.78, S.cylinderIn, 1); }
          else {
            m('out', 0.13, S.magOut, 0.85);
            if (e.empty) m('bolt', 0.77, S.slideRelease, 0.95);
          }
        }
        break;
      case 'reloadMagIn':
        if (local && this.cfg.weapons[e.weapon].reloadStyle === 'mag') this.mech(e.weapon, 'in', 0, S.magIn, 0.95);
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
        const b = sim.boxById(e.boxId).pos;
        if (local) A.play(S.purchase, {}, { gain: 0.7, reverb: 0.15 });
        A.play(S.boxOpen, {}, { pos: b, ref: 3 });
        A.play(S.musicBox, { duration: e.spinTime }, { pos: b, ref: 3, gain: 0.9, reverb: 0.5 });
        break;
      }
      case 'boxLanded': A.play(S.boxLand, {}, { pos: sim.boxById(e.boxId).pos, ref: 3, reverb: 0.5 }); break;
      case 'boxTaken': if (local) A.play(S.boxTake, {}, { gain: 0.9, reverb: 0.05 }); break;
      case 'boxExpired': A.play(S.boxShut, {}, { pos: sim.boxById(e.boxId).pos, ref: 3 }); break;
      case 'melee': if (local) A.play(S.knifeSwing, {}, { gain: 0.8, reverb: 0.05 }); break;
      case 'meleeHit': A.play(S.knifeHit, {}, local ? { gain: 1, reverb: 0.1 } : { pos: zpos(e.zombieId, 1.2) }); break;
      case 'zombieHit': {
        const pos = e.point;
        if (e.kind === 'knife') break;
        if (local && this.tickT <= 0 && this.cfg.hud.hitmarkers) { A.play(S.hitTick, { head: e.part === 'head' }, { gain: 0.7, reverb: 0 }); this.tickT = 0.045; }
        if (e.part === 'head') A.play(S.headshot, {}, { pos, gain: 1.1, ref: 4 });
        else A.play(S.fleshHit, {}, { pos, gain: 1, ref: 4 });
        break;
      }
      case 'zombieLimb': {
        const pos = zpos(e.id, 1.3);
        if (pos) A.play(S.gore, {}, { pos, ref: 3 });
        break;
      }
      case 'powerOn': A.play(S.powerOn, {}, { gain: 1, reverb: 0.8 }); break;
      // --- The Final Whistle
      case 'breakerThrown':
        A.play(S.leverPull, {}, { pos: e.pos, ref: 3, gain: 1.2, reverb: 0.3 });
        A.play(S.bang, {}, { pos: e.pos, ref: 4, gain: 0.7, reverb: 0.4, delay: 0.15 });
        break;
      case 'trophyPiece': A.play(S.stewItemGet, { count: e.count }, { gain: 0.8, reverb: 0.3, bus: 'music' }); break;
      case 'trophyPlaced': A.play(S.boxThud, {}, { pos: e.pos, ref: 5, gain: 1, reverb: 0.6 }); break;
      case 'madDogRising':
        A.play(S.madDogGrind, { duration: this.cfg.quest.madDogRiseTime + 1 }, { pos: e.pos, ref: 6, gain: 1.2, reverb: 0.7 });
        A.play(S.dogGrowl, {}, { pos: e.pos, ref: 6, gain: 1, reverb: 0.6, delay: 1.5 });
        break;
      case 'madDogRevealed':
        for (let i = 0; i < 3; i++) A.play(S.dogBark, {}, { pos: { ...e.pos, y: 2.2 }, ref: 7, gain: 1.2, reverb: 0.7, delay: i * 0.35 });
        break;
      case 'statueSoul': A.play(S.boxWhoosh, {}, { pos: e.from, ref: 4, gain: 0.45, reverb: 0.5 }); break;
      case 'statueAwake':
        A.play(S.thunder, { near: 0.5 }, { pos: { ...e.pos, y: 3 }, ref: 10, gain: 1, reverb: 0.8 });
        A.play(S.madDogGrind, { duration: 2.2 }, { pos: { ...e.pos, y: 3.5 }, ref: 6, gain: 1, reverb: 0.6, delay: 0.6 });
        break;
      case 'coinDrop': A.play(S.stickThunk, {}, { pos: e.pos, ref: 3, gain: 1, reverb: 0.4 }); break;
      case 'coinTaken': A.play(S.stewItemGet, { count: 3 }, { gain: 0.8, reverb: 0.4, bus: 'music' }); break;
      case 'coinPlaced':
        A.play(S.smallBoom, {}, { pos: e.pos, ref: 6, gain: 1.2, reverb: 0.8 });
        A.play(S.madDogGrind, { duration: this.cfg.quest.claddingTime }, { pos: { x: 0, y: 6.4, z: 0 }, ref: 9, gain: 1.4, reverb: 0.8, delay: 0.8 });
        break;
      case 'bossStart':
        A.play(S.roundStartSting, {}, { gain: 1.1, reverb: 0.8 });
        A.play(S.erikLaugh, {}, { pos: { x: 0, y: 6.2, z: 0 }, ref: 10, gain: 1.1, reverb: 0.8, bus: 'voice', delay: 0.4 });
        break;
      case 'playbook': A.play(S.trapBuzz, { duration: this.cfg.quest.boss.zoneWarn + this.cfg.quest.boss.zoneLive }, { gain: 0.35, reverb: 0.6 }); break;
      case 'eliteSpawn': A.play(S.zombieScream, {}, { gain: 1, reverb: 0.7 }); break;
      case 'ampDrop': A.play(S.stickThunk, {}, { pos: e.pos, ref: 4, gain: 1, reverb: 0.3 }); break;
      case 'ampTaken': A.play(S.stewItemGet, { count: 1 }, { gain: 0.8, reverb: 0.3, bus: 'music' }); break;
      case 'towerPowered':
        A.play(S.powerOn, {}, { pos: { ...e.pos, y: 2 }, ref: 8, gain: 0.9, reverb: 0.6 });
        break;
      case 'bossOverload': A.play(S.thunder, { near: 0.6 }, { gain: 1, reverb: 0.8 }); break;
      case 'wireHit': A.play(S.electrocute, {}, { pos: { x: 0, y: 4.7, z: 2 }, ref: 8, gain: 1.2, reverb: 0.6 }); break;
      case 'ritualStart':
        A.play(S.thunder, { near: 0.3 }, { pos: { ...e.pos, y: 2 }, ref: 8, gain: 0.8, reverb: 0.8 });
        A.play(S.erikLaugh, {}, { pos: { x: 0, y: 6.2, z: 0 }, ref: 10, gain: 0.9, reverb: 0.8, bus: 'voice', delay: 0.5 });
        break;
      case 'ritualFailed': A.play(S.powerupFizzle, {}, { gain: 1, reverb: 0.5 }); break;
      case 'ritualDone':
        A.play(S.powerupGrab, {}, { gain: 1, reverb: 0.6 });
        A.play(S.perkJingle, { notes: [392, 523, 659, 784, 1047] }, { gain: 0.8, reverb: 0.5, bus: 'music', delay: 0.3 });
        break;
      case 'erikRevealed': A.play(S.erikLaugh, {}, { pos: { x: 0, y: 6.2, z: 0 }, ref: 10, gain: 1.1, reverb: 0.8, bus: 'voice' }); break;
      case 'perkBought': {
        const m = sim.world.perkMachines.find((q) => q.id === e.machine);
        A.play(S.perkJingle, { notes: PERK_TUNES[e.perk] }, { pos: m ? { x: m.center.x, y: 1.6, z: m.center.z } : null, ref: 4, reverb: 0.4, bus: 'music' });
        break;
      }
      case 'perkDrink': if (local) A.play(S.perkDrink, {}, { gain: 0.9, reverb: 0.05 }); break;
      case 'madDogStart': {
        const md = sim.world.madDog;
        A.play(S.madDogGrind, { duration: this.cfg.madDog.workTime }, { pos: { x: md.x, y: md.y + 1.5, z: md.z }, ref: 5, reverb: 0.6, gain: 1.1 });
        break;
      }
      case 'madDogReady': {
        const md = sim.world.madDog;
        A.play(S.madDogReady, {}, { pos: { x: md.x, y: md.y + 1.5, z: md.z }, ref: 6, reverb: 0.7, gain: 1.1 });
        break;
      }
      case 'madDogTaken': if (local) A.play(S.madDogTake, {}, { gain: 0.9, reverb: 0.2 }); break;
      case 'trapOn': {
        const t = sim.traps.find((q) => q.id === e.id);
        if (!t) break;
        const c = { x: (t.box[0] + t.box[2]) / 2, y: 1.4, z: (t.box[1] + t.box[3]) / 2 };
        A.play(S.leverPull, {}, { pos: t.lever.pos, ref: 3 });
        A.play(S.trapBuzz, { duration: this.cfg.traps.activeTime }, { pos: c, ref: 3, reverb: 0.4 });
        break;
      }
      case 'playerDown': if (local) A.play(S.downed, {}, { gain: 1, reverb: 0.3 }); break;
      case 'playerRevived': if (local) A.play(S.revived, {}, { gain: 0.9, reverb: 0.2 }); break;
      case 'zombieRise': A.play(S.dirtRise, {}, { pos: e.pos, ref: 3 }); break;
      case 'powerupSpawn': A.play(S.powerupSpawn, {}, { pos: { x: e.pos.x, y: 1.1, z: e.pos.z }, ref: 3, reverb: 0.4 }); break;
      case 'powerupGrab': A.play(S.powerupGrab, { type: e.ptype }, { gain: 1, reverb: 0.5, bus: 'sfx' }); break;
      case 'powerupEnd': A.play(S.powerupEnd, {}, { gain: 0.9, reverb: 0.3 }); break;
      case 'powerupGone': if (!e.taken) A.play(S.powerupFizzle, {}, { gain: 0.6 }); break;
      case 'cheddarStart': {
        A.play(S.cheddarSting, {}, { bus: 'music', reverb: 0.7, gain: 1 });
        A.play(S.thunder, { near: 0.5 }, { gain: 0.9, reverb: 0.8, delay: 0.4 });
        const lp = A.listenerPos || { x: 0, z: 0 };
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          A.play(S.dogHowl, { f0: R(280, 380) }, { pos: { x: lp.x + Math.cos(a) * 25, y: 2, z: lp.z + Math.sin(a) * 25 }, ref: 8, reverb: 1, delay: 1 + i * 0.7 });
        }
        break;
      }
      case 'cheddarStrike':
        A.play(S.thunder, { near: 1 }, { pos: { x: e.pos.x, y: 4, z: e.pos.z }, ref: 10, reverb: 0.6, gain: 1.1 });
        A.play(S.dogGrowl, { f0: R(65, 90), dur: 0.8 }, { pos: { x: e.pos.x, y: 0.6, z: e.pos.z }, ref: 3, delay: 0.5 });
        break;
      case 'sawHit': A.play(S.sawCut, {}, { pos: e.pos, ref: 3 }); break;
      case 'sawRicochet': A.play(S.sawRicochet, {}, { pos: e.pos, ref: 3, reverb: 0.4 }); break;
      case 'sawStick': A.play(S.sawStick, {}, { pos: e.pos, ref: 3, reverb: 0.4 }); break;
      case 'stewBombLand': {
        A.play(S.stewBombLand, {}, { pos: e.pos, ref: 3 });
        A.play(S.stewBombTune, { duration: this.cfg.equipment.stewBomb.lureTime }, { pos: { x: e.pos.x, y: 0.4, z: e.pos.z }, ref: 4, reverb: 0.5, gain: 1.1 });
        break;
      }
      case 'boxBobble': {
        const b = sim.boxById(e.boxId).pos;
        A.play(S.erikLaugh, {}, { pos: b, ref: 4, reverb: 0.5, gain: 1.1, delay: 0.2 });
        A.play(S.boxWhoosh, {}, { pos: b, ref: 5, reverb: 0.5, delay: this.cfg.box.leaveTime * 0.4 });
        break;
      }
      case 'jukeboxPlay': case 'jukeboxStop': A.play(S.purchase, {}, { pos: { x: sim.mapData.jukebox.x, y: 1, z: sim.mapData.jukebox.z }, ref: 2, gain: 0.5 }); break;
      case 'valveTurned': A.play(S.steamHiss, { dur: 2.2 }, { pos: e.pos, ref: 3, reverb: 0.5, gain: 0.9 }); break;
      case 'cauldronBoil': A.play(S.cauldronBoil, {}, { pos: e.pos, ref: 5, reverb: 0.6, gain: 1.1 }); break;
      case 'cheddarTalk': A.play(S.cheddarVoice, { text: e.text, dur: e.dur }, { pos: e.pos, ref: 4, rolloff: 1.2, reverb: 0.35, bus: 'voice', gain: 1.1 }); break;
      case 'saleBoxArrive': A.play(S.boxThud, {}, { pos: sim.boxById(e.boxId).pos, ref: 5, reverb: 0.5, delay: this.cfg.box.arriveTime * 0.6 }); break;
      case 'saleBoxVanish': A.play(S.boxWhoosh, {}, { pos: sim.boxById(e.boxId).pos, ref: 4, reverb: 0.5 }); break;
      case 'boxMoved': A.play(S.boxThud, {}, { pos: sim.boxById(e.boxId).pos, ref: 5, reverb: 0.5, delay: this.cfg.box.arriveTime * 0.6 }); break;
      case 'cheddarEnd': A.play(S.roundEndSting, {}, { bus: 'music', reverb: 0.5, gain: 0.9 }); break;
      case 'zombieKilled':
        if (e.zombieType === 'cheddar') A.play(S.dogYelp, {}, { pos: { x: e.pos.x, y: 0.6, z: e.pos.z }, ref: 3 });
        if (e.kind === 'electric') A.play(S.electrocute, {}, { pos: { x: e.pos.x, y: 1.2, z: e.pos.z }, ref: 3 });
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
        const sz = sim.zombieById(e.id);
        if (sz && sz.type === 'cheddar') { A.play(S.dogBark, {}, { pos: { x: e.pos.x, y: 0.6, z: e.pos.z }, ref: 3 }); break; }
        const late = sim.rounds.round >= 6;
        A.play(S.zombieSnarl, { f0: R(late ? 150 : 110, late ? 220 : 160), dur: R(0.3, 0.5) }, { pos: { x: e.pos.x, y: 1.6, z: e.pos.z }, ref: 3 });
        break;
      }
      case 'playerHit': if (e.playerId === this.localId) A.play(S.playerHurt, {}, { gain: 1, reverb: 0.1 }); break;
      case 'playerJump': if (local) A.play(S.jump, {}, { gain: 0.8, reverb: 0.05 }); break;
      case 'playerLand': if (local && e.impact > 2) A.play(S.land, { impact: e.impact, surface: 'gym' }, { gain: 0.9, reverb: 0.1 }); break;
      case 'boardTorn': {
        const w = sim.windowById(e.windowId);
        if (!w) break;
        A.play(S.boardTear, {}, { pos: { x: w.center.x, y: 1.4, z: w.center.z }, ref: 4, gain: 1.1 });
        break;
      }
      case 'boardRepaired': {
        const w = sim.windowById(e.windowId);
        if (!w) break;
        A.play(S.boardRepair, {}, { pos: { x: w.center.x, y: 1.4, z: w.center.z }, ref: 4 });
        break;
      }
      case 'roundEnd': A.play(S.roundEndSting, {}, { bus: 'music', reverb: 0.5, gain: 0.9 }); break;
      case 'roundStart': A.play(S.roundStartSting, {}, { bus: 'music', reverb: 0.5, gain: 0.9 }); break;
      // --- Erik, the intercom, the Easter egg
      case 'erikSays': {
        const key = voiceKey('erik', e.text);
        if (key && A.hasSample(key)) A.play(S.paVoice, { key, chime: e.lead > 0 }, { bus: 'voice', reverb: 0.5, gain: 1 });
        else A.play(S.erikPA, { text: e.text, dur: e.dur, chime: e.lead > 0, angry: e.cat === 'song' || e.cat === 'pressureCooker' }, { bus: 'voice', reverb: 0.5, gain: 0.95 });
        this.talkUntil = A.now() + e.lead + e.dur;
        break;
      }
      case 'stewSays': {
        const key = voiceKey(e.who, e.text);
        if (key && A.hasSample(key)) A.play(S.liveVoice, { key }, { bus: 'voice', reverb: 0.15, gain: 1 });
        else A.play(S.stewTalk, { text: e.text, dur: e.dur }, { bus: 'voice', reverb: 0.15, gain: 0.9 });
        this.talkUntil = A.now() + e.dur;
        break;
      }
      case 'crewSays': {
        const v = (CREW[e.who] && CREW[e.who].voice) || {};
        const radio = this.localCharacter ? e.who !== this.localCharacter : e.radio;
        const key = voiceKey(e.who, e.text);
        if (key && A.hasSample(key)) A.play(S.liveVoice, { key, radio }, { bus: 'voice', reverb: radio ? 0.05 : 0.15, gain: 1 });
        else A.play(S.crewVoice, { text: e.text, dur: e.dur, f0: v.f0, grit: v.grit, radio }, { bus: 'voice', reverb: radio ? 0.05 : 0.15, gain: radio ? 0.8 : 0.9 });
        this.talkUntil = A.now() + e.dur;
        break;
      }
      case 'loreRead': if (local) A.play(S.paperRustle, {}, { gain: 0.8, reverb: 0.05 }); break;
      case 'stewItem': A.play(S.stewItemGet, { count: e.count }, { gain: 0.9, reverb: 0.3, bus: 'music' }); break;
      case 'stewSong':
        A.play(S.tapeClunk, {}, { gain: 1, reverb: 0.4 });
        this.stopSong();
        this.song = new StewSong(A);
        setTimeout(() => { if (this.song && !this.song.playing) this.song.start('music', 0.75); }, 600);
        break;
      case 'stewSongEnd': if (this.song && this.song.playing) this.song.stop(1.5); break;
    }
  }

  cheddarStep(z) {
    if (!this.A.ready) return;
    const lp = this.A.listenerPos;
    if (lp && Math.hypot(z.pos.x - lp.x, z.pos.z - lp.z) > 18) return;
    this.A.play(S.pawStep, {}, { pos: { x: z.pos.x, y: 0.1, z: z.pos.z }, ref: 1.5, rolloff: 1.4, gain: 0.8 });
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
    this.tickT -= dt;

    // duck the ambience while someone's talking
    const duck = A.now() < this.talkUntil ? 0.45 : 1;
    if (duck !== A.duck) {
      A.duck = duck;
      A.buses.ambient.gain.setTargetAtTime(A.volumes.ambient * duck, A.now(), 0.15);
    }

    this.updateMusic();

    // the cauldron bubbles away when you're near it
    const cd = sim.mapData.cauldron;
    if (cd && localPlayer) {
      const d = Math.hypot(localPlayer.pos.x - cd.x, localPlayer.pos.z - cd.z);
      this.blorpT = (this.blorpT ?? 0) - dt;
      if (d < 14 && this.blorpT <= 0) {
        this.blorpT = 0.18 + Math.random() * 0.5;
        A.play(S.stewBubble, {}, { pos: { x: cd.x + (Math.random() - 0.5), y: cd.rim, z: cd.z + (Math.random() - 0.5) }, ref: 1.5, rolloff: 1.4, reverb: 0.4, gain: 0.6, bus: 'ambient' });
      }
    }

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
          const dog = z.type === 'cheddar';
          const recipe = dog ? S.dogGrowl : aggressive && Math.random() < 0.7 ? S.zombieSnarl : S.zombieGroan;
          const late = Math.min(1, Math.max(0, (round - 3) / 10));
          const f0 = dog ? R(60, 95) : aggressive ? R(120, 180) * (1 + late * 0.4) : R(62, 100) * (1 + late * 0.25);
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
