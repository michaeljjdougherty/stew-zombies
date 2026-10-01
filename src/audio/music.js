// =============================================================================
// Music, all synthesized: the title screen theme and the hidden Stew song
// ("We Go Stew", an original pop-punk tune unlocked by the Easter egg).
// Both use a small look-ahead scheduler on the Web Audio clock.
// Vocals are formant-synth placeholders; the lyrics show as subtitles.
// =============================================================================
import { singVoice, VOWELS } from './sfx.js';
import { SONG_BPM, SONG_BEATS, SONG_LYRICS } from '../lore/erik.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// --- drum kit ------------------------------------------------------------------
function kick(A, out, t, v = 1) {
  const o = A.osc('sine', 150, t, 0.45);
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const g = A.gain(0); A.env(g, t, 0.002, 0.38, 0.9 * v);
  o.connect(g); g.connect(out);
  const n = A.noiseSource('white', t, 0.02);
  const f = A.filter('highpass', 2500, 0.7);
  const ng = A.gain(0); A.env(ng, t, 0.0005, 0.015, 0.25 * v);
  n.connect(f); f.connect(ng); ng.connect(out);
}
function snare(A, out, t, v = 1) {
  const n = A.noiseSource('white', t, 0.25);
  const hp = A.filter('highpass', 1200, 0.7);
  const bp = A.filter('peaking', 3500, 1); bp.gain.value = 5;
  const g = A.gain(0); A.env(g, t, 0.001, 0.19, 0.42 * v);
  n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out);
  const o = A.osc('triangle', 195, t, 0.15);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  const og = A.gain(0); A.env(og, t, 0.001, 0.1, 0.45 * v);
  o.connect(og); og.connect(out);
}
function hat(A, out, t, v = 1, open = false) {
  const n = A.noiseSource('white', t, open ? 0.35 : 0.06);
  const hp = A.filter('highpass', 7500, 0.8);
  const g = A.gain(0); A.env(g, t, 0.0005, open ? 0.3 : 0.045, 0.16 * v);
  n.connect(hp); hp.connect(g); g.connect(out);
}
function crash(A, out, t, v = 1) {
  const n = A.noiseSource('white', t, 2.2);
  const hp = A.filter('highpass', 4200, 0.6);
  const g = A.gain(0); A.env(g, t, 0.002, 2.0, 0.22 * v);
  n.connect(hp); hp.connect(g); g.connect(out);
  for (const f of [5100, 6700, 8300]) {
    const o = A.osc('square', f, t, 1.2);
    const og = A.gain(0); A.env(og, t, 0.002, 1.0, 0.012 * v);
    o.connect(og); og.connect(out);
  }
}
function tom(A, out, t, f = 120, v = 1) {
  const o = A.osc('sine', f, t, 0.4);
  o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.3);
  const g = A.gain(0); A.env(g, t, 0.002, 0.32, 0.7 * v);
  o.connect(g); g.connect(out);
}

// --- guitars and bass ---------------------------------------------------------
// One power-chord hit (root, fifth, octave), distorted. mute = palm mute.
function powerChord(A, out, t, root, len, { mute = false, v = 1, detune = 0 } = {}) {
  const pre = A.gain(mute ? 0.8 : 1.1);
  for (const [iv, dt] of [[0, -6], [7, 5], [12, -3]]) {
    const o = A.osc('sawtooth', mtof(root + iv), t, len + 0.1);
    o.detune.value = dt + detune;
    o.connect(pre);
  }
  const sh = A.shaper(0.92);
  const lp = A.filter('lowpass', mute ? 820 : 3900, mute ? 1.4 : 0.8);
  const g = A.gain(0);
  if (mute) A.env(g, t, 0.003, Math.min(len, 0.13), 0.16 * v);
  else { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.15 * v, t + 0.006); g.gain.setValueAtTime(0.13 * v, t + len * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + len); }
  pre.connect(sh); sh.connect(lp); lp.connect(g); g.connect(out);
}
function bassNote(A, out, t, midi, len, v = 1) {
  const o = A.osc('sawtooth', mtof(midi), t, len + 0.05);
  const s = A.osc('sine', mtof(midi), t, len + 0.05);
  const lp = A.filter('lowpass', 520, 1.5);
  const g = A.gain(0); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32 * v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.08 * v, t + len);
  o.connect(lp); s.connect(lp); lp.connect(g); g.connect(out);
}
function leadNote(A, out, t, midi, len, v = 1, bend = 0) {
  const o = A.osc('sawtooth', mtof(midi), t, len + 0.05);
  if (bend) { o.frequency.setValueAtTime(mtof(midi - bend), t); o.frequency.linearRampToValueAtTime(mtof(midi), t + 0.08); }
  const vib = A.osc('sine', 5.5, t, len + 0.05); const vg = A.gain(0); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(mtof(midi) * 0.012, t + len);
  vib.connect(vg); vg.connect(o.frequency);
  const pre = A.gain(1.4);
  const sh = A.shaper(0.85);
  const lp = A.filter('lowpass', 3200, 1.2);
  const g = A.gain(0); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * v, t + 0.01); g.gain.setValueAtTime(0.08 * v, t + len * 0.85); g.gain.linearRampToValueAtTime(0.0001, t + len);
  o.connect(pre); pre.connect(sh); sh.connect(lp); lp.connect(g); g.connect(out);
}

// Vowel for a sung syllable, from its letters.
function vowelOf(s) {
  s = s.toLowerCase();
  if (/ee|ea|i(?!r)|y$/.test(s)) return VOWELS[1];
  if (/oo|ew|u|ou/.test(s)) return VOWELS[2];
  if (/o|aw|al/.test(s)) return VOWELS[4];
  if (/a/.test(s)) return VOWELS[0];
  if (/e/.test(s)) return VOWELS[3];
  return VOWELS[5];
}
function syllables(text) {
  const out = [];
  for (const w of text.replace(/[()!,.?']/g, ' ').split(/\s+/).filter(Boolean)) {
    const parts = w.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$|[^aeiouy](?=[^aeiouy]))?/gi) || [w];
    for (const p of parts) out.push(p);
  }
  return out;
}

// --- base scheduler ------------------------------------------------------------
class Sequencer {
  constructor(A) { this.A = A; this.timer = null; this.playing = false; }
  begin(bus, gain) {
    const A = this.A;
    this.bus = A.output({ bus, reverb: 0.12, gain });
    this.out = this.bus.input;
    this.t0 = A.now() + 0.15;
    this.step = 0;
    this.playing = true;
    this.timer = setInterval(() => this.pump(), 30);
    this.pump();
  }
  pump() {
    if (!this.playing) return;
    const now = this.A.now();
    while (this.playing && this.t0 + this.step * this.stepDur < now + 0.3) {
      this.schedule(this.step, this.t0 + this.step * this.stepDur);
      this.step++;
    }
  }
  stop(fade = 0.6) {
    if (!this.playing && !this.out) return;
    this.playing = false;
    clearInterval(this.timer);
    const out = this.out;
    if (out && this.A.ctx) {
      const t = this.A.now();
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0.0001, t + fade);
      setTimeout(() => { try { out.disconnect(); } catch (e) { /* gone */ } }, (fade + 0.2) * 1000);
    }
    this.out = null;
  }
  get elapsed() { return this.playing ? this.A.now() - this.t0 : -1; }
}

// =============================================================================
// "We Go Stew" — 152 bpm, E minor. Sections are in bars (4 beats).
// =============================================================================
const E2 = 40, C3 = 48, G2 = 43, D3 = 50, A2 = 45;
const VERSE = [E2, C3, G2, D3];
const CHORUS = [G2, D3, E2 + 12 - 12, C3];
// lead hook over 2 bars of 8ths (midi, null = rest)
const HOOK = [71, 74, 76, 74, 71, 69, 67, null, 69, 71, 69, 67, 64, null, 62, 64];
const VERSE_TUNE = [64, 64, 67, 67, 69, 67, 64, 62, 64, 64, 67, 69, 71, 69, 67, 67];
const VERSE_TUNE_B = [67, 67, 69, 71, 72, 71, 69, 67, 69, 69, 71, 72, 74, 72, 71, 71];

function section(bar) {
  if (bar < 2) return 'introMute';
  if (bar < 4) return 'introBuild';
  if (bar < 8) return 'intro';
  if (bar < 16) return 'verse';
  if (bar < 24) return 'chorus';
  if (bar < 32) return 'verse';
  if (bar < 40) return 'chorus';
  if (bar < 44) return 'breakdown';
  if (bar < 46) return 'build';
  if (bar < 54) return 'chorus';
  return 'end';
}

export class StewSong extends Sequencer {
  constructor(A) {
    super(A);
    this.stepDur = 60 / SONG_BPM / 2; // 8th notes
    this.totalSteps = SONG_BEATS * 2;
  }
  start(bus = 'music', gain = 1) {
    this.stop(0.05);
    this.begin(bus, gain);
  }
  // Current lyric line (or null) for subtitles.
  lyric() {
    const e = this.elapsed;
    if (e < 0) return null;
    const beat = e * SONG_BPM / 60;
    let cur = null;
    for (const l of SONG_LYRICS) if (beat >= l.at && beat < l.at + 8) cur = l.text;
    return cur;
  }
  get done() { return this.step >= this.totalSteps && this.elapsed > (this.totalSteps * this.stepDur + 2); }

  schedule(s, t) {
    const A = this.A, out = this.out, d = this.stepDur;
    if (s >= this.totalSteps) {
      if (this.elapsed > this.totalSteps * d + 3) this.stop(0.1);
      return;
    }
    const bar = Math.floor(s / 8), i = s % 8, beatInBar = Math.floor(i / 2), off = i % 2;
    const sec = section(bar);
    const chordBar = bar % 4;
    const verseRoot = VERSE[chordBar], chorusRoot = CHORUS[chordBar];

    // ---- drums
    if (sec === 'introBuild') {
      hat(A, out, t, 0.8);
      if (bar === 3 && i >= 4) { snare(A, out, t, 0.5 + (i - 4) * 0.15); snare(A, out, t + d / 2, 0.4 + (i - 4) * 0.15); }
    } else if (sec === 'intro' || sec === 'verse') {
      if (i === 0 || i === 4 || i === 5) kick(A, out, t);
      if (i === 2 || i === 6) snare(A, out, t);
      hat(A, out, t, off ? 0.6 : 1);
      if (i === 0 && (bar % 4 === 0)) crash(A, out, t, 0.8);
      if (bar % 8 === 7 && i >= 6) { tom(A, out, t, 150); tom(A, out, t + d / 2, 110); }
    } else if (sec === 'chorus') {
      // driving beat: kick on the beat, snare on the "and"
      if (!off) kick(A, out, t); else snare(A, out, t, 0.85);
      hat(A, out, t, 0.7, off === 1 && i === 7);
      if (i === 0 && bar % 2 === 0) crash(A, out, t);
      if (bar % 8 === 7 && i >= 4) { snare(A, out, t + d / 2, 0.7); }
    } else if (sec === 'breakdown') {
      if (i === 0 || i === 3) kick(A, out, t);
      if (i === 4) snare(A, out, t, 1.1);
      if (i === 0) crash(A, out, t, 0.6);
      if (i % 2 === 1) tom(A, out, t, 90, 0.6);
    } else if (sec === 'build') {
      const k = (s - 44 * 8) / 16;
      snare(A, out, t, 0.4 + k * 0.7); snare(A, out, t + d / 2, 0.35 + k * 0.7);
      if (i % 2 === 0) kick(A, out, t, 0.6 + k * 0.4);
    } else if (sec === 'end') {
      if (i === 0) { kick(A, out, t, 1.2); crash(A, out, t, 1.3); }
    }

    // ---- rhythm guitars (two, slightly different) and bass
    const g = (root, mute, v = 1) => {
      powerChord(A, out, t, root, mute ? d : d * 0.98, { mute, v, detune: -4 });
      powerChord(A, out, t + 0.006, root, mute ? d : d * 0.98, { mute, v: v * 0.9, detune: 5 });
    };
    if (sec === 'introMute' || sec === 'introBuild') {
      g(E2, true, i % 4 === 0 ? 1.2 : 0.9);
      if (sec === 'introBuild') bassNote(A, out, t, E2 - 12, d);
    } else if (sec === 'intro') {
      if (i === 0) g(verseRoot, false, 1.1); else if (i === 3 || i === 6) g(verseRoot, false, 0.9);
      else g(verseRoot, true, 0.6);
      bassNote(A, out, t, verseRoot - 12, d);
      const n = HOOK[(bar % 2) * 8 + i];
      if (n) leadNote(A, out, t, n, d * 0.95, 1, i === 0 ? 1 : 0);
    } else if (sec === 'verse') {
      g(verseRoot, true, i % 2 === 0 ? 1 : 0.8);
      bassNote(A, out, t, verseRoot - 12, d);
    } else if (sec === 'chorus') {
      if (i === 0 || i === 3 || i === 6) g(chorusRoot, false, 1.05);
      else g(chorusRoot, false, 0.75);
      bassNote(A, out, t, chorusRoot - 12, d, 1.1);
      // the hook answers the chant in the second half of each 2-bar phrase
      if (bar % 2 === 1) {
        const n = HOOK[8 + i];
        if (n) leadNote(A, out, t, n + 12 - 12, d * 0.95, 0.8);
      }
    } else if (sec === 'breakdown') {
      // gallop: 8th + two 16ths
      g(E2, true, 1.2);
      powerChord(A, out, t + d / 2, E2, d / 2, { mute: true, v: 0.9 });
      if (i === 0) bassNote(A, out, t, E2 - 12, d * 4);
    } else if (sec === 'build') {
      if (i === 0 && bar === 44) { powerChord(A, out, t, D3, d * 16, { v: 1 }); bassNote(A, out, t, D3 - 12, d * 16); }
    } else if (sec === 'end') {
      if (i === 0) { powerChord(A, out, t, E2, d * 8, { v: 1.2 }); powerChord(A, out, t + 0.01, E2, d * 8, { v: 1, detune: 7 }); bassNote(A, out, t, E2 - 12, d * 8, 1.2); }
    }

    // ---- vocals
    for (const l of SONG_LYRICS) {
      const at = l.at * 2; // in 8ths
      if (s !== at) continue;
      if (/^WE GO STEW/.test(l.text)) this.chant(t, /\(STEW!\)/.test(l.text));
      else this.sing(t, l.text, bar);
    }
  }

  // Gang vocal: "WE GO STEW! (STEW!)"
  chant(t, answer) {
    const A = this.A, out = this.out, d = this.stepDur;
    const parts = [['we', 71, 0, 1], ['go', 69, 1, 1], ['stew', 67, 2, 3.5]];
    if (answer) parts.push(['stew', 74, 6, 1.6]);
    for (const [w, m, at, len] of parts) {
      for (const [oct, det, delay, pk] of [[-12, -0.012, 0, 0.42], [-12, 0.01, 0.012, 0.36], [-24, 0, 0.02, 0.3], [0, 0.006, 0.008, 0.18]]) {
        const f = mtof(m + oct) * (1 + det);
        singVoice(A, out, t + at * d + delay, { f0: f, dur: len * d, formants: vowelOf(w), grit: 0.55, breath: 0.35, vib: 5, vibDepth: 0.02, peak: pk });
      }
      // the "st" of stew
      if (w === 'stew') {
        const n = A.noiseSource('white', t + at * d - 0.05, 0.07);
        const hp = A.filter('highpass', 4000, 0.8);
        const g = A.gain(0); A.env(g, t + at * d - 0.05, 0.01, 0.06, 0.2);
        n.connect(hp); hp.connect(g); g.connect(out);
      }
    }
  }

  // Lead vocal: one syllable per 8th note on a simple tune.
  sing(t, text, bar) {
    const A = this.A, out = this.out, d = this.stepDur;
    const syl = syllables(text);
    const tune = bar >= 24 && bar < 32 ? VERSE_TUNE_B : VERSE_TUNE;
    const slots = Math.min(15, syl.length);
    const per = slots < 8 ? 2 : 1;
    for (let k = 0; k < slots; k++) {
      const m = tune[k % tune.length] - 12;
      const last = k === slots - 1;
      const len = (last ? 2.5 : per * 0.92) * d;
      singVoice(A, out, t + k * per * d, { f0: mtof(m), dur: len, formants: vowelOf(syl[k]), grit: 0.45, breath: 0.2, vib: 5.5, vibDepth: last ? 0.03 : 0.012, peak: 0.45 });
      singVoice(A, out, t + k * per * d + 0.01, { f0: mtof(m) * 1.004, dur: len, formants: vowelOf(syl[k]), grit: 0.3, breath: 0.1, vib: 5, vibDepth: 0.01, peak: 0.15 });
    }
  }
}

// =============================================================================
// Title theme: slow, dark, a clean guitar arpeggio over a drone, and a
// music-box quote of the Stew song drifting in now and then.
// =============================================================================
const TITLE_CHORDS = [
  [40, 47, 52, 55, 59, 55, 52, 47],   // Em
  [36, 43, 48, 52, 55, 52, 48, 43],   // C
  [45, 52, 57, 60, 64, 60, 57, 52],   // Am
  [47, 54, 59, 63, 66, 63, 59, 54],   // B
];
const BOX_TUNE = [71, 69, 67, null, 74, null, 71, 69, 67, null, 64, null, 62, 64, null, null];

function pluck(A, out, t, midi, v = 1) {
  const f = mtof(midi);
  const o = A.osc('triangle', f, t, 1.6);
  const o2 = A.osc('sine', f * 2, t, 0.8);
  const lp = A.filter('lowpass', 2400, 0.7);
  lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 1.2);
  const g = A.gain(0); A.env(g, t, 0.003, 1.5, 0.12 * v);
  const g2 = A.gain(0); A.env(g2, t, 0.002, 0.4, 0.04 * v);
  o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(out);
}
function musicBox(A, out, t, midi, v = 1) {
  const f = mtof(midi + 12);
  for (const [m, a, dcy] of [[1, 0.06, 1.2], [3.01, 0.02, 0.4], [5.2, 0.008, 0.2]]) {
    const o = A.osc('sine', f * m, t, dcy + 0.1);
    o.detune.value = -18; // a little out of tune
    const g = A.gain(0); A.env(g, t, 0.002, dcy, a * v);
    o.connect(g); g.connect(out);
  }
}

export class TitleMusic extends Sequencer {
  constructor(A) { super(A); this.stepDur = 60 / 72 / 2; }
  start(bus = 'music', gain = 0.9) {
    if (this.playing) return;
    this.begin(bus, gain);
    // drone + crackle run continuously
    const A = this.A, ctx = A.ctx, t = this.t0;
    this.held = [];
    const lp = A.filter('lowpass', 180, 2);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; lfo.start(t);
    const lg = A.gain(90); lfo.connect(lg); lg.connect(lp.frequency);
    const dg = A.gain(0); dg.gain.setValueAtTime(0.0001, t); dg.gain.linearRampToValueAtTime(0.09, t + 4);
    for (const [m, dt] of [[28, -6], [28, 6], [35, 0]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt; o.start(t);
      o.connect(lp); this.held.push(o);
    }
    lp.connect(dg); dg.connect(this.out);
    const n = ctx.createBufferSource(); n.buffer = A.noise.white; n.loop = true; n.start(t);
    const nf = A.filter('bandpass', 3000, 0.5);
    const ng = A.gain(0.004);
    const cr = ctx.createBufferSource(); cr.buffer = A.noise.white; cr.loop = true; cr.playbackRate.value = 0.05; cr.start(t);
    const crg = A.gain(0.05); cr.connect(crg); crg.connect(ng.gain);
    n.connect(nf); nf.connect(ng); ng.connect(this.out);
    this.held.push(lfo, n, cr);
  }
  schedule(s, t) {
    const A = this.A, out = this.out;
    const bar = Math.floor(s / 8) % 16, i = s % 8;
    const chord = TITLE_CHORDS[Math.floor(s / 8) % 4];
    if (bar >= 1) pluck(A, out, t, chord[i] + 12, i === 0 ? 1.2 : 0.8);
    if (i === 0) pluck(A, out, t, chord[0], 1.3);
    // music box quote in bars 8-11 of each 16-bar cycle
    if (bar >= 8 && bar < 12) {
      const n = BOX_TUNE[((bar - 8) % 2) * 8 + i];
      if (n) musicBox(A, out, t, n);
    }
    // a low bell every 4 bars
    if (i === 0 && bar % 4 === 0) {
      const o = A.osc('sine', mtof(52), t, 4);
      const g = A.gain(0); A.env(g, t, 0.005, 3.6, 0.06);
      const o2 = A.osc('sine', mtof(52) * 2.76, t, 2);
      const g2 = A.gain(0); A.env(g2, t, 0.005, 1.8, 0.025);
      o.connect(g); g.connect(out); o2.connect(g2); g2.connect(out);
    }
  }
  stop(fade = 1.2) {
    const held = this.held || [];
    super.stop(fade);
    setTimeout(() => { for (const n of held) { try { n.stop(); } catch (e) { /* stopped */ } } }, (fade + 0.3) * 1000);
    this.held = [];
  }
}
