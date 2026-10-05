// =============================================================================
// Sound recipes. Each is (A, out, t, params) => duration in seconds.
// A = AudioEngine (for helpers), out = destination node, t = start time.
// =============================================================================

const R = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------------------
// Guns
// ---------------------------------------------------------------------------
// A recorded sample (see gunSamples.js). p.key, p.rate.
export function sample(A, out, t, p = {}) {
  const key = Array.isArray(p.key) ? p.key[Math.floor(Math.random() * p.key.length)] : p.key;
  const buf = A.pickSample(key);
  if (!buf) return 0;
  const src = A.ctx.createBufferSource();
  src.buffer = buf;
  const rate = (p.rate || 1) * (p.vary === false ? 1 : R(0.97, 1.03));
  src.playbackRate.value = rate;
  const g = A.gain(p.gain ?? 1);
  src.connect(g); g.connect(out);
  src.start(t);
  return buf.duration / rate + 0.05;
}

// A real recorded gunshot with a little synthesized low end for weight.
function recordedShot(A, out, t, p) {
  const v = p.voice;
  const dur = sample(A, out, t, { key: v.s, rate: v.rate || 1, gain: v.gain ?? 1 });
  const sub = v.sub ?? 0.5;
  if (sub > 0) {
    const o = A.osc('sine', 120, t, 0.25);
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
    const g = A.gain(0); A.env(g, t, 0.001, 0.16, 0.55 * sub);
    o.connect(g); g.connect(out);
  }
  if (p.upgraded) {
    // Mad Dog guns: an extra electric snarl under the shot
    const z = A.osc('sawtooth', 900, t, 0.25);
    z.frequency.exponentialRampToValueAtTime(140, t + 0.2);
    const bp = A.filter('bandpass', 1400, 2.5);
    const g = A.gain(0); A.env(g, t, 0.002, 0.2, 0.18);
    z.connect(bp); bp.connect(g); g.connect(out);
  }
  return Math.max(dur, 0.6);
}

export function gunshot(A, out, t, p = {}) {
  if (p.voice && A.hasSample(Array.isArray(p.voice.s) ? p.voice.s[0] : p.voice.s)) return recordedShot(A, out, t, p);
  if (p.kind === 'launcher') return launcherFire(A, out, t, p);
  if (p.kind === 'crossbow') return crossbowFire(A, out, t, p);
  if (p.kind === 'blade') return bladeFire(A, out, t, p);
  if (p.kind === 'fucci') return fucciFire(A, out, t, p);
  if (p.kind === 'saw') return sawFire(A, out, t, p);
  if (p.kind === 'wind') return windFire(A, out, t, p);
  const pitch = (p.pitch || 1) * R(0.96, 1.04);
  const body = p.body || 2200, thumpF = p.thump || 140;
  const mix = A.gain(1);
  const drive = A.shaper(0.35);
  mix.connect(drive); drive.connect(out);

  // crack
  const n1 = A.noiseSource('white', t, 0.08);
  const hp = A.filter('highpass', 1800 * pitch, 0.7);
  const g1 = A.gain(0); A.env(g1, t, 0.0005, 0.035, 0.9 * (p.crack ?? 1));
  n1.connect(hp); hp.connect(g1); g1.connect(mix);

  // body
  const n2 = A.noiseSource('white', t, 0.3);
  const lp = A.filter('lowpass', body * 1.4 * pitch, 0.9);
  lp.frequency.setValueAtTime(body * 1.4 * pitch, t);
  lp.frequency.exponentialRampToValueAtTime(260, t + 0.16);
  const g2 = A.gain(0); A.env(g2, t, 0.001, 0.2, 1.0);
  n2.connect(lp); lp.connect(g2); g2.connect(mix);

  // thump
  const o = A.osc('sine', thumpF * 1.9 * pitch, t, 0.3);
  o.frequency.exponentialRampToValueAtTime(thumpF * 0.35, t + 0.12);
  const g3 = A.gain(0); A.env(g3, t, 0.001, 0.22, 1.3);
  o.connect(g3); g3.connect(mix);

  // room tail
  const n3 = A.noiseSource('pink', t, 0.9);
  const lp2 = A.filter('lowpass', 900, 0.5);
  const g4 = A.gain(0); A.env(g4, t + 0.01, 0.02, 0.7, 0.25 * (p.tail ?? 0.5));
  n3.connect(lp2); lp2.connect(g4); g4.connect(out);

  // shotguns and revolvers: a deeper, longer boom
  if (p.kind === 'shotgun' || p.kind === 'revolver') {
    const nb = A.noiseSource('brown', t, 0.6);
    const lpb = A.filter('lowpass', 380, 0.8);
    const gb = A.gain(0); A.env(gb, t, 0.002, p.kind === 'shotgun' ? 0.45 : 0.3, p.kind === 'shotgun' ? 1.3 : 0.8);
    nb.connect(lpb); lpb.connect(gb); gb.connect(mix);
  }
  // snipers: a hard supersonic crack and a long rolling tail
  if (p.kind === 'sniper') {
    const nc = A.noiseSource('white', t, 0.05);
    const hpc = A.filter('highpass', 3500, 0.7);
    const gc = A.gain(0); A.env(gc, t, 0.0003, 0.02, 1.1);
    nc.connect(hpc); hpc.connect(gc); gc.connect(mix);
    const nt = A.noiseSource('brown', t + 0.03, 1.6);
    const lpt = A.filter('lowpass', 500, 0.6);
    const gt = A.gain(0); A.env(gt, t + 0.03, 0.03, 1.4, 0.7);
    nt.connect(lpt); lpt.connect(gt); gt.connect(out);
  }
  // machine guns get a mechanical rattle (heavier on the LMGs)
  if (p.kind === 'lmg') {
    const nb = A.noiseSource('brown', t, 0.3);
    const lpb = A.filter('lowpass', 420, 0.8);
    const gb = A.gain(0); A.env(gb, t, 0.002, 0.2, 0.8);
    nb.connect(lpb); lpb.connect(gb); gb.connect(mix);
  }
  if (p.kind === 'smg' || p.kind === 'ar' || p.kind === 'lmg') {
    const nr = A.noiseSource('white', t + 0.025, 0.05);
    const bpr = A.filter('bandpass', 2600, 3);
    const gr = A.gain(0); A.env(gr, t + 0.025, 0.0005, 0.02, 0.28);
    nr.connect(bpr); bpr.connect(gr); gr.connect(out);
  }
  // slide / action clack
  if (p.kind === 'pistol' || p.kind === 'rifle') {
    const n4 = A.noiseSource('white', t + 0.04, 0.05);
    const bp = A.filter('bandpass', 3200, 4);
    const g5 = A.gain(0); A.env(g5, t + 0.045, 0.0005, 0.025, 0.35);
    n4.connect(bp); bp.connect(g5); g5.connect(out);
  }
  return 1.1;
}

export function dryFire(A, out, t) {
  const n = A.noiseSource('white', t, 0.05);
  const bp = A.filter('bandpass', 4200, 5);
  const g = A.gain(0); A.env(g, t, 0.0005, 0.02, 0.5);
  n.connect(bp); bp.connect(g); g.connect(out);
  const o = A.osc('square', 2400, t, 0.03);
  const g2 = A.gain(0); A.env(g2, t, 0.0005, 0.012, 0.08);
  o.connect(g2); g2.connect(out);
  return 0.2;
}

function click(A, out, t, freq, q, decay, peak, ring = 0) {
  const n = A.noiseSource('white', t, decay + 0.05);
  const bp = A.filter('bandpass', freq, q);
  const g = A.gain(0); A.env(g, t, 0.0005, decay, peak);
  n.connect(bp); bp.connect(g); g.connect(out);
  if (ring) {
    const o = A.osc('sine', ring, t, 0.2);
    const g2 = A.gain(0); A.env(g2, t, 0.0005, 0.09, peak * 0.15);
    o.connect(g2); g2.connect(out);
  }
}

export function reloadCloth(A, out, t) {
  const n = A.noiseSource('pink', t, 0.3);
  const bp = A.filter('bandpass', 900, 0.8);
  const g = A.gain(0); A.env(g, t, 0.06, 0.2, 0.15);
  n.connect(bp); bp.connect(g); g.connect(out);
  return 0.4;
}

export function magOut(A, out, t) {
  click(A, out, t, 2600, 3, 0.02, 0.5, 1900);
  // scrape
  const n = A.noiseSource('white', t + 0.02, 0.12);
  const bp = A.filter('bandpass', 1500, 2);
  bp.frequency.setValueAtTime(1300, t + 0.02); bp.frequency.linearRampToValueAtTime(2200, t + 0.1);
  const g = A.gain(0); A.env(g, t + 0.02, 0.01, 0.08, 0.18);
  n.connect(bp); bp.connect(g); g.connect(out);
  return 0.3;
}

export function magIn(A, out, t) {
  click(A, out, t, 1400, 1.5, 0.05, 0.8, 2600);
  const o = A.osc('sine', 190, t, 0.1);
  o.frequency.exponentialRampToValueAtTime(90, t + 0.06);
  const g = A.gain(0); A.env(g, t, 0.001, 0.06, 0.5);
  o.connect(g); g.connect(out);
  click(A, out, t + 0.03, 3400, 4, 0.015, 0.35);
  return 0.3;
}

export function slideRelease(A, out, t) {
  click(A, out, t, 2200, 2, 0.02, 0.5);
  click(A, out, t + 0.035, 3000, 2.5, 0.04, 0.8, 3300);
  return 0.3;
}

// ---------------------------------------------------------------------------
// Knife & hits
// ---------------------------------------------------------------------------
export function knifeSwing(A, out, t) {
  const n = A.noiseSource('white', t, 0.3);
  const bp = A.filter('bandpass', 500, 1.4);
  bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(2800, t + 0.16);
  const g = A.gain(0); A.env(g, t, 0.07, 0.14, 0.45);
  n.connect(bp); bp.connect(g); g.connect(out);
  return 0.4;
}

export function knifeHit(A, out, t) {
  // the slash
  const n = A.noiseSource('white', t, 0.12);
  const hp = A.filter('highpass', 2600, 0.8);
  const g = A.gain(0); A.env(g, t, 0.001, 0.07, 0.6);
  n.connect(hp); hp.connect(g); g.connect(out);
  // wet squelch
  const n2 = A.noiseSource('pink', t, 0.2);
  const bp = A.filter('bandpass', 650, 3);
  bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(300, t + 0.12);
  const g2 = A.gain(0); A.env(g2, t, 0.002, 0.13, 0.9);
  n2.connect(bp); bp.connect(g2); g2.connect(out);
  const o = A.osc('sine', 120, t, 0.15);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.1);
  const g3 = A.gain(0); A.env(g3, t, 0.001, 0.1, 0.8);
  o.connect(g3); g3.connect(out);
  return 0.4;
}

export function fleshHit(A, out, t, p = {}) {
  const o = A.osc('sine', R(85, 110), t, 0.12);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.08);
  const g = A.gain(0); A.env(g, t, 0.001, 0.08, 0.9 * (p.gain || 1));
  o.connect(g); g.connect(out);
  const n = A.noiseSource('pink', t, 0.12);
  const bp = A.filter('bandpass', R(380, 600), 2);
  const g2 = A.gain(0); A.env(g2, t, 0.001, 0.07, 0.7 * (p.gain || 1));
  n.connect(bp); bp.connect(g2); g2.connect(out);
  return 0.3;
}

export function headshot(A, out, t) {
  click(A, out, t, 6000, 0.7, 0.012, 0.7);
  const o = A.osc('sine', 760, t, 0.1);
  o.frequency.exponentialRampToValueAtTime(170, t + 0.06);
  const g = A.gain(0); A.env(g, t, 0.001, 0.06, 0.6);
  o.connect(g); g.connect(out);
  const n = A.noiseSource('pink', t + 0.01, 0.2);
  const bp = A.filter('bandpass', 1100, 2);
  bp.frequency.exponentialRampToValueAtTime(400, t + 0.15);
  const g2 = A.gain(0); A.env(g2, t + 0.01, 0.002, 0.14, 0.8);
  n.connect(bp); bp.connect(g2); g2.connect(out);
  return 0.4;
}

export function gore(A, out, t) {
  const n = A.noiseSource('brown', t, 0.4);
  const bp = A.filter('bandpass', 420, 1.5);
  bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(200, t + 0.3);
  const g = A.gain(0); A.env(g, t, 0.003, 0.3, 1.0);
  n.connect(bp); bp.connect(g); g.connect(out);
  return 0.5;
}

// ---------------------------------------------------------------------------
// Zombie voices (formant-filtered buzz)
// ---------------------------------------------------------------------------
function voice(A, out, t, { f0, dur, formants, grit = 0.4, breath = 0.25, vib = 5, vibDepth = 0.04, glide = 0, flutter = 0, peak = 0.5 }) {
  const ctx = A.ctx;
  const src = A.osc('sawtooth', f0, t, dur);
  src.frequency.setValueAtTime(f0, t);
  if (glide) src.frequency.linearRampToValueAtTime(f0 * glide, t + dur);
  // vibrato + wobble
  const lfo = A.osc('sine', vib, t, dur);
  const lfoG = A.gain(f0 * vibDepth);
  lfo.connect(lfoG); lfoG.connect(src.frequency);
  const jit = A.osc('triangle', R(1.5, 3.5), t, dur);
  const jitG = A.gain(f0 * 0.06);
  jit.connect(jitG); jitG.connect(src.frequency);

  const pre = A.gain(1);
  src.connect(pre);
  const nb = A.noiseSource('pink', t, dur);
  const nbG = A.gain(breath);
  nb.connect(nbG); nbG.connect(pre);

  const drive = A.shaper(grit);
  pre.connect(drive);
  const sum = A.gain(1);
  for (const [f, q, g, f2] of formants) {
    const bp = A.filter('bandpass', f, q);
    if (f2) { bp.frequency.setValueAtTime(f, t); bp.frequency.linearRampToValueAtTime(f2, t + dur * 0.8); }
    const fg = A.gain(g);
    drive.connect(bp); bp.connect(fg); fg.connect(sum);
  }
  const amp = A.gain(0);
  const p = amp.gain;
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + Math.min(0.2, dur * 0.25));
  p.setValueAtTime(peak * 0.8, t + dur * 0.7);
  p.linearRampToValueAtTime(0.0001, t + dur);
  if (flutter) {
    const am = A.osc('square', flutter, t, dur);
    const amG = A.gain(peak * 0.4);
    am.connect(amG); amG.connect(amp.gain);
  }
  sum.connect(amp); amp.connect(out);
  return dur + 0.1;
}

export function zombieGroan(A, out, t, p = {}) {
  const f0 = p.f0 || R(65, 105);
  const dur = p.dur || R(0.9, 2.2);
  const oo = [R(320, 420), R(700, 900), R(2300, 2600)];
  const aa = [R(650, 800), R(1050, 1250), R(2500, 2800)];
  const start = Math.random() < 0.5 ? oo : aa, end = start === oo ? aa : oo;
  return voice(A, out, t, {
    f0, dur, glide: R(0.8, 1.1), grit: 0.5, breath: 0.35, vib: R(4, 7), vibDepth: 0.05,
    formants: [[start[0], 7, 1.2, end[0]], [start[1], 9, 0.7, end[1]], [start[2], 10, 0.25, end[2]]],
    peak: 0.55 * (p.gain || 1),
  });
}

export function zombieSnarl(A, out, t, p = {}) {
  const f0 = p.f0 || R(110, 170);
  const dur = p.dur || R(0.35, 0.8);
  return voice(A, out, t, {
    f0, dur, glide: R(0.7, 1.3), grit: 0.9, breath: 0.6, vib: R(8, 12), vibDepth: 0.08, flutter: R(28, 45),
    formants: [[R(600, 800), 5, 1.2], [R(1200, 1500), 7, 0.8], [R(2600, 3000), 8, 0.4]],
    peak: 0.6 * (p.gain || 1),
  });
}

export function zombieScream(A, out, t, p = {}) {
  const dur = R(0.7, 1.1);
  const f0 = R(300, 420);
  const src = voice(A, out, t, {
    f0, dur, glide: R(1.6, 2.2), grit: 1.0, breath: 0.8, vib: 11, vibDepth: 0.1, flutter: R(30, 40),
    formants: [[900, 4, 1.2, 1100], [1700, 5, 1.0, 2100], [3000, 6, 0.6]],
    peak: 0.9 * (p.gain || 1),
  });
  return src;
}

export function zombieStep(A, out, t, p = {}) {
  const drag = p.walker;
  const n = A.noiseSource(drag ? 'pink' : 'brown', t, drag ? 0.35 : 0.15);
  const f = A.filter(drag ? 'bandpass' : 'lowpass', drag ? 900 : 500, drag ? 1 : 0.7);
  const g = A.gain(0);
  if (drag) A.env(g, t, 0.04, 0.22, 0.25);
  else A.env(g, t, 0.002, 0.09, 0.55);
  n.connect(f); f.connect(g); g.connect(out);
  return 0.5;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
export function footstep(A, out, t, p = {}) {
  const int = p.intensity || 1;
  const surface = p.surface || 'gym';
  const carpet = surface === 'carpet';
  const tile = surface === 'tile' || surface === 'tile_big' || surface === 'concrete';
  // heel thud
  const n = A.noiseSource('brown', t, 0.12);
  const lp = A.filter('lowpass', surface === 'gym' ? 520 : carpet ? 300 : 900, 0.8);
  const g = A.gain(0); A.env(g, t, 0.002, carpet ? 0.09 : 0.07, (carpet ? 0.35 : 0.55) * int);
  n.connect(lp); lp.connect(g); g.connect(out);
  // toe tap (clacky on tile, nearly silent on carpet)
  const n2 = A.noiseSource('white', t + 0.012, 0.03);
  const hp = A.filter(tile ? 'bandpass' : 'highpass', tile ? 3200 : 2200, tile ? 2 : 0.7);
  const g2 = A.gain(0); A.env(g2, t + 0.012, 0.001, tile ? 0.02 : 0.012, (carpet ? 0.02 : tile ? 0.3 : 0.14) * int);
  n2.connect(hp); hp.connect(g2); g2.connect(out);
  // grit crunch on tile (papers, broken glass)
  if (tile && Math.random() < 0.5) {
    for (let i = 0; i < 4; i++) {
      const tg = t + 0.01 + Math.random() * 0.05;
      const ng = A.noiseSource('white', tg, 0.02);
      const hg = A.filter('highpass', 4000, 1);
      const gg = A.gain(0); A.env(gg, tg, 0.0005, 0.006, 0.08 * int);
      ng.connect(hg); hg.connect(gg); gg.connect(out);
    }
  }
  // sneaker squeak on the court
  if (surface === 'gym' && Math.random() < (p.sprint ? 0.45 : 0.25)) {
    const d = R(0.06, 0.13), st = t + R(0.01, 0.04);
    const o = A.osc('sawtooth', R(1800, 2400), st, d);
    o.frequency.linearRampToValueAtTime(R(2600, 3400), st + d);
    const vib = A.osc('sine', R(35, 60), st, d);
    const vg = A.gain(90); vib.connect(vg); vg.connect(o.frequency);
    const bp = A.filter('bandpass', 2800, 3);
    const g3 = A.gain(0); A.env(g3, st, 0.01, d, 0.06 * int);
    o.connect(bp); bp.connect(g3); g3.connect(out);
  }
  return 0.3;
}

export function jump(A, out, t) {
  const n = A.noiseSource('pink', t, 0.15);
  const bp = A.filter('bandpass', 700, 1);
  const g = A.gain(0); A.env(g, t, 0.01, 0.1, 0.15);
  n.connect(bp); bp.connect(g); g.connect(out);
  return 0.3;
}

export function land(A, out, t, p = {}) {
  const k = Math.min(1.5, (p.impact || 4) / 5);
  const n = A.noiseSource('brown', t, 0.2);
  const lp = A.filter('lowpass', 400, 0.8);
  const g = A.gain(0); A.env(g, t, 0.002, 0.12, 0.8 * k);
  n.connect(lp); lp.connect(g); g.connect(out);
  footstep(A, out, t + 0.03, { intensity: 0.6, surface: p.surface });
  return 0.4;
}

export function playerHurt(A, out, t) {
  const o = A.osc('sine', 70, t, 0.4);
  o.frequency.exponentialRampToValueAtTime(35, t + 0.3);
  const g = A.gain(0); A.env(g, t, 0.002, 0.3, 1.0);
  o.connect(g); g.connect(out);
  const n = A.noiseSource('pink', t, 0.3);
  const bp = A.filter('bandpass', 350, 1);
  const g2 = A.gain(0); A.env(g2, t, 0.002, 0.2, 0.7);
  n.connect(bp); bp.connect(g2); g2.connect(out);
  // a sharp exhale
  const n2 = A.noiseSource('white', t + 0.05, 0.3);
  const bp2 = A.filter('bandpass', 1400, 1.5);
  const g3 = A.gain(0); A.env(g3, t + 0.05, 0.02, 0.22, 0.2);
  n2.connect(bp2); bp2.connect(g3); g3.connect(out);
  return 0.6;
}

export function heartbeat(A, out, t) {
  for (const [dt, v] of [[0, 1], [0.24, 0.7]]) {
    const o = A.osc('sine', 58, t + dt, 0.2);
    o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.12);
    const g = A.gain(0); A.env(g, t + dt, 0.005, 0.14, 0.9 * v);
    o.connect(g); g.connect(out);
  }
  return 0.6;
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------
export function boardTear(A, out, t) {
  // stress creak before the snap
  const cr = A.osc('sawtooth', R(70, 110), t, 0.25);
  const crf = A.filter('bandpass', 750, 6);
  const crg = A.gain(0); A.env(crg, t, 0.08, 0.1, 0.25);
  cr.connect(crf); crf.connect(crg); crg.connect(out);
  const tc = t + R(0.12, 0.2);
  // the crack
  const n = A.noiseSource('white', tc, 0.2);
  const bp = A.filter('bandpass', 1500, 0.8);
  const g = A.gain(0); A.env(g, tc, 0.0005, 0.1, 1.1);
  n.connect(bp); bp.connect(g); g.connect(out);
  // splinters
  for (let i = 0; i < 7; i++) {
    const ts = tc + R(0.005, 0.12);
    const ns = A.noiseSource('white', ts, 0.03);
    const hp = A.filter('highpass', R(2000, 5000), 1);
    const gs = A.gain(0); A.env(gs, ts, 0.0005, R(0.005, 0.02), R(0.2, 0.45));
    ns.connect(hp); hp.connect(gs); gs.connect(out);
  }
  // wood thunk
  const o = A.osc('sine', 230, tc, 0.2);
  o.frequency.exponentialRampToValueAtTime(120, tc + 0.12);
  const g2 = A.gain(0); A.env(g2, tc, 0.001, 0.14, 0.6);
  o.connect(g2); g2.connect(out);
  // board lands outside
  const tl = tc + R(0.4, 0.6);
  const nl = A.noiseSource('brown', tl, 0.15);
  const lp = A.filter('lowpass', 600, 1);
  const gl = A.gain(0); A.env(gl, tl, 0.002, 0.1, 0.35);
  nl.connect(lp); lp.connect(gl); gl.connect(out);
  return 1.0;
}

export function boardRepair(A, out, t) {
  // plank slaps into place
  const n = A.noiseSource('brown', t, 0.1);
  const lp = A.filter('lowpass', 800, 1);
  const g = A.gain(0); A.env(g, t, 0.002, 0.06, 0.6);
  n.connect(lp); lp.connect(g); g.connect(out);
  // hammer
  for (const dt of [0.08, 0.22, 0.34]) {
    const th = t + dt;
    const o = A.osc('triangle', R(360, 420), th, 0.1);
    o.frequency.exponentialRampToValueAtTime(260, th + 0.05);
    const g1 = A.gain(0); A.env(g1, th, 0.0008, 0.06, 0.6);
    o.connect(g1); g1.connect(out);
    click(A, out, th, 2600, 1.2, 0.015, 0.5, 1250);
  }
  return 0.7;
}

// ---------------------------------------------------------------------------
// Round stings
// ---------------------------------------------------------------------------
export function roundEndSting(A, out, t) {
  const notes = [73.42, 103.83, 174.61, 277.18]; // D2, G#2 (tritone), F3, C#4
  const lp = A.filter('lowpass', 1400, 0.7);
  lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(220, t + 5);
  const g = A.gain(0);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.22, t + 0.5);
  g.gain.setValueAtTime(0.22, t + 2.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
  lp.connect(g); g.connect(out);
  for (const f of notes) for (const d of [-4, 4]) {
    const o = A.osc('sawtooth', f, t, 5.6);
    o.detune.value = d + R(-2, 2);
    o.connect(lp);
  }
  // low boom
  const b = A.osc('sine', 48, t, 2);
  b.frequency.exponentialRampToValueAtTime(28, t + 1.5);
  const bg = A.gain(0); A.env(bg, t, 0.01, 1.6, 0.9);
  b.connect(bg); bg.connect(out);
  // a cold, slightly out-of-tune bell
  for (const [ratio, amp] of [[1, 0.25], [2.76, 0.12], [5.4, 0.06]]) {
    const o = A.osc('sine', 622 * ratio, t + 0.3, 3.5);
    const og = A.gain(0); A.env(og, t + 0.3, 0.002, 3.2, amp);
    o.connect(og); og.connect(out);
  }
  return 6;
}

export function roundStartSting(A, out, t) {
  // noise swell
  const sw = A.noiseSource('white', t, 0.7);
  const swf = A.filter('bandpass', 800, 0.7);
  swf.frequency.setValueAtTime(400, t); swf.frequency.exponentialRampToValueAtTime(5000, t + 0.6);
  const swg = A.gain(0);
  swg.gain.setValueAtTime(0.0001, t); swg.gain.exponentialRampToValueAtTime(0.35, t + 0.58); swg.gain.linearRampToValueAtTime(0, t + 0.62);
  sw.connect(swf); swf.connect(swg); swg.connect(out);

  const hits = [0.6, 1.05, 1.5];
  hits.forEach((h, i) => {
    const th = t + h;
    const b = A.osc('sine', 62, th, 1.2);
    b.frequency.exponentialRampToValueAtTime(30, th + 0.5);
    const bg = A.gain(0); A.env(bg, th, 0.002, 0.8, 0.9 + i * 0.15);
    b.connect(bg); bg.connect(out);
    const n = A.noiseSource('brown', th, 0.5);
    const nf = A.filter('lowpass', 260, 0.7);
    const ng = A.gain(0); A.env(ng, th, 0.002, 0.4, 0.9);
    n.connect(nf); nf.connect(ng); ng.connect(out);
  });
  // dissonant cluster stab with tremolo
  const tc = t + 1.5;
  const lp = A.filter('lowpass', 400, 2);
  lp.frequency.setValueAtTime(400, tc); lp.frequency.exponentialRampToValueAtTime(2600, tc + 0.3); lp.frequency.exponentialRampToValueAtTime(500, tc + 2.8);
  const g = A.gain(0); A.env(g, tc, 0.02, 2.6, 0.22);
  const trem = A.osc('sine', 9, tc, 3); const tg = A.gain(0.08);
  trem.connect(tg); tg.connect(g.gain);
  const drive = A.shaper(0.4);
  lp.connect(drive); drive.connect(g); g.connect(out);
  for (const f of [138.59, 146.83, 207.65, 220.0]) {
    const o = A.osc('sawtooth', f, tc, 3);
    o.detune.value = R(-8, 8);
    o.connect(lp);
  }
  // distant screech
  const s = A.osc('sawtooth', 1700, tc + 0.1, 1.6);
  s.frequency.linearRampToValueAtTime(2300, tc + 1.6);
  const sv = A.osc('sine', 7, tc, 1.8); const svg = A.gain(60); sv.connect(svg); svg.connect(s.frequency);
  const sf = A.filter('bandpass', 2000, 6);
  const sg = A.gain(0); A.env(sg, tc + 0.1, 0.3, 1.2, 0.04);
  s.connect(sf); sf.connect(sg); sg.connect(out);
  return 5;
}

// ---------------------------------------------------------------------------
// Ambient one-shots
// ---------------------------------------------------------------------------
export function drip(A, out, t) {
  const f = R(900, 1600);
  const o = A.osc('sine', f, t, 0.12);
  o.frequency.exponentialRampToValueAtTime(f * R(1.6, 2.2), t + 0.04);
  const g = A.gain(0); A.env(g, t, 0.001, 0.07, 0.25);
  o.connect(g); g.connect(out);
  return 0.3;
}

export function creak(A, out, t) {
  const dur = R(0.8, 2.0);
  const o = A.osc('sawtooth', R(50, 90), t, dur);
  o.frequency.linearRampToValueAtTime(R(60, 140), t + dur);
  const am = A.osc('square', R(12, 25), t, dur);
  const amg = A.gain(0.5);
  const g = A.gain(0);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + 0.2); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  am.connect(amg); amg.connect(g.gain);
  const bp = A.filter('bandpass', R(500, 900), 9);
  bp.frequency.linearRampToValueAtTime(R(400, 1100), t + dur);
  o.connect(bp); bp.connect(g); g.connect(out);
  return dur + 0.2;
}

export function bang(A, out, t) {
  const o = A.osc('sine', 70, t, 0.8);
  o.frequency.exponentialRampToValueAtTime(35, t + 0.4);
  const g = A.gain(0); A.env(g, t, 0.002, 0.6, 0.9);
  o.connect(g); g.connect(out);
  const n = A.noiseSource('brown', t, 0.6);
  const lp = A.filter('lowpass', 350, 0.7);
  const g2 = A.gain(0); A.env(g2, t, 0.002, 0.5, 0.9);
  n.connect(lp); lp.connect(g2); g2.connect(out);
  return 1;
}

export function uiClick(A, out, t) {
  click(A, out, t, 3000, 3, 0.02, 0.3);
  return 0.1;
}

// ---------------------------------------------------------------------------
// Phase 2: reload styles, buying, doors, the box
// ---------------------------------------------------------------------------
export function breakOpen(A, out, t) {
  click(A, out, t, 1600, 2, 0.04, 0.8, 900);          // lever & hinge
  const o = A.osc('sawtooth', 140, t + 0.02, 0.1);
  const f = A.filter('bandpass', 700, 5); const g = A.gain(0); A.env(g, t + 0.02, 0.01, 0.08, 0.2);
  o.connect(f); f.connect(g); g.connect(out);
  return 0.3;
}
export function shellIn(A, out, t) {
  click(A, out, t, 2200, 2, 0.03, 0.55, 1500);
  const n = A.noiseSource('pink', t, 0.06); const lp = A.filter('lowpass', 900, 1);
  const g = A.gain(0); A.env(g, t, 0.002, 0.04, 0.3); n.connect(lp); lp.connect(g); g.connect(out);
  return 0.2;
}
export function breakClose(A, out, t) {
  click(A, out, t, 1300, 1.2, 0.05, 1.0, 700);
  const o = A.osc('sine', 160, t, 0.1); o.frequency.exponentialRampToValueAtTime(80, t + 0.07);
  const g = A.gain(0); A.env(g, t, 0.001, 0.07, 0.6); o.connect(g); g.connect(out);
  return 0.3;
}
export function cylinderOut(A, out, t) {
  click(A, out, t, 3000, 3, 0.02, 0.5, 2400);
  // ratchet spin
  for (let i = 0; i < 6; i++) click(A, out, t + 0.05 + i * 0.025, 4200, 4, 0.006, 0.18);
  return 0.3;
}
export function shellsDrop(A, out, t) {
  for (let i = 0; i < 6; i++) {
    const tt = t + 0.25 + Math.random() * 0.25;
    const o = A.osc('sine', R(2800, 4200), tt, 0.1);
    const g = A.gain(0); A.env(g, tt, 0.001, 0.06, 0.12);
    o.connect(g); g.connect(out);
  }
  const n = A.noiseSource('white', t, 0.08); const bp = A.filter('bandpass', 2500, 2);
  const g = A.gain(0); A.env(g, t, 0.003, 0.06, 0.35); n.connect(bp); bp.connect(g); g.connect(out);
  return 0.7;
}
export function cylinderIn(A, out, t) {
  click(A, out, t, 1900, 1.5, 0.04, 0.9, 2100);
  return 0.3;
}
export function weaponSwitch(A, out, t) {
  const n = A.noiseSource('pink', t, 0.2); const bp = A.filter('bandpass', 800, 0.8);
  const g = A.gain(0); A.env(g, t, 0.04, 0.12, 0.14); n.connect(bp); bp.connect(g); g.connect(out);
  click(A, out, t + 0.14, 2600, 3, 0.02, 0.35, 1800);
  return 0.4;
}
export function purchase(A, out, t) {
  // old register: drawer clunk + two bright bell tones
  click(A, out, t, 900, 1, 0.05, 0.6);
  for (const [dt, f] of [[0.05, 1568], [0.13, 2093]]) {
    for (const [ratio, amp] of [[1, 0.25], [2.4, 0.08], [4.1, 0.04]]) {
      const o = A.osc('sine', f * ratio, t + dt, 0.9);
      const g = A.gain(0); A.env(g, t + dt, 0.002, 0.7, amp);
      o.connect(g); g.connect(out);
    }
  }
  return 1.2;
}
export function denied(A, out, t) {
  const o = A.osc('square', 110, t, 0.3);
  const lp = A.filter('lowpass', 700, 1);
  const g = A.gain(0); A.env(g, t, 0.005, 0.22, 0.25, 0, 0.05);
  o.connect(lp); lp.connect(g); g.connect(out);
  return 0.4;
}
export function doorOpen(A, out, t) {
  // chains drop, push bar clunk, hinges groan, doors bang against the wall
  for (let i = 0; i < 10; i++) click(A, out, t + Math.random() * 0.35, R(2500, 5000), 3, 0.02, 0.25, R(1800, 3500));
  click(A, out, t + 0.25, 700, 1, 0.06, 0.8);
  const cr = A.osc('sawtooth', 70, t + 0.3, 0.9); cr.frequency.linearRampToValueAtTime(110, t + 1.1);
  const am = A.osc('square', 18, t + 0.3, 0.9); const amg = A.gain(0.5);
  const crf = A.filter('bandpass', 650, 8); const crg = A.gain(0);
  crg.gain.setValueAtTime(0.0001, t + 0.3); crg.gain.linearRampToValueAtTime(0.35, t + 0.45); crg.gain.linearRampToValueAtTime(0.0001, t + 1.15);
  am.connect(amg); amg.connect(crg.gain);
  cr.connect(crf); crf.connect(crg); crg.connect(out);
  const tb = t + 1.05;
  const b = A.osc('sine', 80, tb, 0.6); b.frequency.exponentialRampToValueAtTime(40, tb + 0.4);
  const bg = A.gain(0); A.env(bg, tb, 0.002, 0.45, 0.9); b.connect(bg); bg.connect(out);
  click(A, out, tb, 1200, 0.8, 0.12, 0.9, 400);
  return 2;
}
export function debrisClear(A, out, t) {
  for (let i = 0; i < 16; i++) {
    const tt = t + Math.random() * 0.9;
    const n = A.noiseSource(Math.random() < 0.5 ? 'brown' : 'pink', tt, 0.15);
    const f = A.filter('bandpass', R(200, 1800), 1.2);
    const g = A.gain(0); A.env(g, tt, 0.003, R(0.05, 0.15), R(0.2, 0.6));
    n.connect(f); f.connect(g); g.connect(out);
  }
  const n = A.noiseSource('brown', t, 1.2); const lp = A.filter('lowpass', 250, 0.7);
  const g = A.gain(0); A.env(g, t, 0.1, 0.9, 0.5); n.connect(lp); lp.connect(g); g.connect(out);
  return 1.6;
}
export function boxOpen(A, out, t) {
  const cr = A.osc('sawtooth', 90, t, 0.5); cr.frequency.linearRampToValueAtTime(160, t + 0.45);
  const f = A.filter('bandpass', 900, 7); const g = A.gain(0); A.env(g, t, 0.05, 0.4, 0.25);
  cr.connect(f); f.connect(g); g.connect(out);
  click(A, out, t + 0.45, 1100, 1, 0.08, 0.6, 500);
  return 0.8;
}
// Wind-down music box tune (original melody) played while the box spins.
export function musicBox(A, out, t, p = {}) {
  const dur = p.duration || 4.2;
  const semis = [7, 12, 15, 14, 12, 7, 8, 7, 5, 3, 5, 7, 12, 10, 8, 7, 3, 2, 0];
  const base = 440 * Math.pow(2, 3 / 12); // C5
  let tt = t, step = 0.16, i = 0;
  while (tt < t + dur - 0.1) {
    const f = base * Math.pow(2, semis[i % semis.length] / 12);
    for (const [ratio, amp] of [[1, 0.22], [2, 0.06], [3.02, 0.035], [4.2, 0.02]]) {
      const o = A.osc('sine', f * ratio, tt, 1.2);
      const g = A.gain(0); A.env(g, tt, 0.002, 0.9, amp);
      o.connect(g); g.connect(out);
    }
    click(A, out, tt, 6000, 2, 0.004, 0.05);
    tt += step;
    step *= 1.035; // winding down
    i++;
  }
  return dur + 1.2;
}
export function boxLand(A, out, t) {
  for (const [ratio, amp] of [[1, 0.3], [2.76, 0.12], [5.4, 0.06]]) {
    const o = A.osc('sine', 988 * ratio, t, 2);
    const g = A.gain(0); A.env(g, t, 0.002, 1.6, amp);
    o.connect(g); g.connect(out);
  }
  return 2;
}
export function boxTake(A, out, t) {
  click(A, out, t, 1800, 1.5, 0.05, 0.7, 1300);
  click(A, out, t + 0.12, 2600, 2, 0.03, 0.5, 2000);
  return 0.4;
}
export function boxShut(A, out, t) {
  click(A, out, t, 600, 0.8, 0.12, 0.9, 200);
  const o = A.osc('sine', 90, t, 0.3); o.frequency.exponentialRampToValueAtTime(45, t + 0.2);
  const g = A.gain(0); A.env(g, t, 0.002, 0.2, 0.6); o.connect(g); g.connect(out);
  return 0.5;
}

// --- Phase 3: launchers, crossbow, ballistic knife, actions, grenades -------

function launcherFire(A, out, t) {
  // hollow "thoomp" plus a hiss
  const o = A.osc('sine', 120, t, 0.35);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
  const g = A.gain(0); A.env(g, t, 0.002, 0.3, 1.4);
  o.connect(g); g.connect(out);
  const n = A.noiseSource('brown', t, 0.4);
  const lp = A.filter('lowpass', 700, 0.7);
  const g2 = A.gain(0); A.env(g2, t, 0.002, 0.25, 0.9);
  n.connect(lp); lp.connect(g2); g2.connect(out);
  const h = A.noiseSource('white', t + 0.02, 0.5);
  const bp = A.filter('bandpass', 2500, 1.2);
  const g3 = A.gain(0); A.env(g3, t + 0.02, 0.02, 0.4, 0.2);
  h.connect(bp); bp.connect(g3); g3.connect(out);
  return 0.8;
}

function crossbowFire(A, out, t) {
  // string twang + limb thunk
  const o = A.osc('sawtooth', 190, t, 0.3);
  o.frequency.exponentialRampToValueAtTime(110, t + 0.2);
  const lp = A.filter('lowpass', 1400, 2);
  const g = A.gain(0); A.env(g, t, 0.001, 0.22, 0.45);
  o.connect(lp); lp.connect(g); g.connect(out);
  click(A, out, t, 900, 2, 0.05, 0.8, 140);
  const n = A.noiseSource('white', t + 0.01, 0.2);
  const bp = A.filter('bandpass', 4500, 1);
  const g2 = A.gain(0); A.env(g2, t + 0.01, 0.005, 0.15, 0.15);
  n.connect(bp); bp.connect(g2); g2.connect(out);
  return 0.5;
}

function bladeFire(A, out, t) {
  // spring release: sharp metallic pop then whistle
  click(A, out, t, 3000, 3, 0.03, 0.9, 1900);
  const o = A.osc('sine', 2400, t + 0.01, 0.25);
  o.frequency.exponentialRampToValueAtTime(1100, t + 0.22);
  const g = A.gain(0); A.env(g, t + 0.01, 0.01, 0.2, 0.08);
  o.connect(g); g.connect(out);
  return 0.4;
}

export function pumpRack(A, out, t) {
  click(A, out, t, 1600, 2.5, 0.05, 0.7);
  click(A, out, t + 0.03, 3400, 4, 0.02, 0.4);
  click(A, out, t + 0.18, 1300, 2.5, 0.06, 0.85, 220);
  return 0.4;
}

export function boltCycle(A, out, t) {
  click(A, out, t, 2600, 4, 0.03, 0.5);           // lift
  click(A, out, t + 0.12, 1900, 3, 0.05, 0.6);    // pull back
  click(A, out, t + 0.14, 5200, 6, 0.02, 0.25);   // case eject tink
  click(A, out, t + 0.32, 1700, 3, 0.05, 0.7);    // push forward
  click(A, out, t + 0.42, 2400, 4, 0.03, 0.55);   // lock down
  return 0.6;
}

export function beltOpen(A, out, t) {
  click(A, out, t, 1200, 2, 0.08, 0.7, 180);
  const n = A.noiseSource('white', t + 0.15, 0.35);
  const bp = A.filter('bandpass', 2800, 2);
  const g = A.gain(0); A.env(g, t + 0.15, 0.04, 0.3, 0.25);   // links rattle
  n.connect(bp); bp.connect(g); g.connect(out);
  return 0.6;
}

export function beltClose(A, out, t) {
  click(A, out, t, 900, 1.6, 0.1, 1.0, 140);
  return 0.4;
}

export function grenadePin(A, out, t) {
  click(A, out, t, 4200, 6, 0.03, 0.5, 2900);
  click(A, out, t + 0.12, 2600, 5, 0.04, 0.45, 1600); // spoon
  return 0.3;
}

export function grenadeThrow(A, out, t) {
  const n = A.noiseSource('pink', t, 0.3);
  const bp = A.filter('bandpass', 700, 0.8);
  bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(1400, t + 0.2);
  const g = A.gain(0); A.env(g, t, 0.05, 0.2, 0.5);
  n.connect(bp); bp.connect(g); g.connect(out);
  return 0.35;
}

export function grenadeBounce(A, out, t, p = {}) {
  const k = Math.min(1, (p.speed || 4) / 10);
  click(A, out, t, 1400, 3, 0.06, 0.35 + k * 0.5, 600);
  return 0.25;
}

export function explosion(A, out, t, p = {}) {
  const big = p.big ?? 1;
  const mix = A.gain(1);
  const drive = A.shaper(0.6);
  mix.connect(drive); drive.connect(out);
  // initial crack
  const n1 = A.noiseSource('white', t, 0.12);
  const g1 = A.gain(0); A.env(g1, t, 0.0005, 0.08, 1.2 * big);
  n1.connect(g1); g1.connect(mix);
  // body
  const n2 = A.noiseSource('brown', t, 2.2);
  const lp = A.filter('lowpass', 1800, 0.7);
  lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(120, t + 1.4);
  const g2 = A.gain(0); A.env(g2, t, 0.003, 1.6, 2.0 * big);
  n2.connect(lp); lp.connect(g2); g2.connect(mix);
  // sub thump
  const o = A.osc('sine', 85, t, 1.0);
  o.frequency.exponentialRampToValueAtTime(28, t + 0.8);
  const g3 = A.gain(0); A.env(g3, t, 0.003, 0.8, 2.2 * big);
  o.connect(g3); g3.connect(mix);
  // debris patter
  for (let i = 0; i < 7; i++) click(A, out, t + 0.25 + Math.random() * 0.9, 1500 + Math.random() * 2500, 3, 0.03, 0.08 + Math.random() * 0.1);
  return 2.4;
}

export function boltBeep(A, out, t) {
  const o = A.osc('square', 1850, t, 0.06);
  const g = A.gain(0); A.env(g, t, 0.002, 0.05, 0.12);
  o.connect(g); g.connect(out);
  return 0.08;
}

export function stickThunk(A, out, t, p = {}) {
  if (p.flesh) {
    const n = A.noiseSource('brown', t, 0.15);
    const lp = A.filter('lowpass', 600, 1);
    const g = A.gain(0); A.env(g, t, 0.002, 0.1, 0.9);
    n.connect(lp); lp.connect(g); g.connect(out);
  } else click(A, out, t, 800, 2, 0.08, 0.9, 260);
  return 0.3;
}

// --- Phases 4 & 5: power, perks, the Mad Dog Machine, traps, last stand -------

export function powerOn(A, out, t) {
  // big breaker clunk
  const n = A.noiseSource('brown', t, 0.4);
  const lp = A.filter('lowpass', 500, 1);
  const g = A.gain(0); A.env(g, t, 0.002, 0.3, 1.6);
  n.connect(lp); lp.connect(g); g.connect(out);
  click(A, out, t, 1200, 2, 0.08, 1.0, 140);
  // electrical surge rising into a hum
  const o = A.osc('sawtooth', 30, t + 0.1, 5);
  o.frequency.exponentialRampToValueAtTime(120, t + 2.2);
  const o2 = A.osc('square', 60, t + 0.1, 5);
  o2.frequency.exponentialRampToValueAtTime(240, t + 2.2);
  const bp = A.filter('lowpass', 300, 1.2);
  bp.frequency.exponentialRampToValueAtTime(1600, t + 2.4);
  const hg = A.gain(0);
  hg.gain.setValueAtTime(0.0001, t + 0.1);
  hg.gain.exponentialRampToValueAtTime(0.35, t + 2.3);
  hg.gain.exponentialRampToValueAtTime(0.0001, t + 5);
  o.connect(bp); o2.connect(bp); bp.connect(hg); hg.connect(out);
  // crackles
  for (let i = 0; i < 14; i++) click(A, out, t + 0.3 + Math.random() * 2.4, 3000 + Math.random() * 3000, 4, 0.02, 0.25 + Math.random() * 0.3);
  return 5.2;
}

// A short jingle per perk machine (melody in params.notes, Hz).
export function perkJingle(A, out, t, p = {}) {
  const notes = p.notes || [392, 494, 587, 784];
  const step = p.step || 0.16;
  const lp = A.filter('lowpass', 2600, 0.7);
  lp.connect(out);
  notes.forEach((f, i) => {
    const tt = t + i * step;
    for (const [type, mul, amp] of [['square', 1, 0.08], ['triangle', 2, 0.06]]) {
      const o = A.osc(type, f * mul, tt, step * 1.6);
      const g = A.gain(0); A.env(g, tt, 0.005, step * 1.4, amp);
      o.connect(g); g.connect(lp);
    }
  });
  // oom-pah bass
  notes.forEach((f, i) => {
    if (i % 2) return;
    const tt = t + i * step;
    const o = A.osc('sine', f / 4, tt, step * 1.5);
    const g = A.gain(0); A.env(g, tt, 0.005, step * 1.3, 0.3);
    o.connect(g); g.connect(out);
  });
  return notes.length * step + 0.4;
}

export function perkDrink(A, out, t) {
  click(A, out, t + 0.25, 3800, 5, 0.03, 0.6, 2400); // cap pops
  const fizz = A.noiseSource('white', t + 0.28, 0.4);
  const hp = A.filter('highpass', 5000, 0.7);
  const fg = A.gain(0); A.env(fg, t + 0.28, 0.01, 0.35, 0.18);
  fizz.connect(hp); hp.connect(fg); fg.connect(out);
  for (let i = 0; i < 3; i++) {   // gulps
    const tt = t + 0.75 + i * 0.32;
    const o = A.osc('sine', 180, tt, 0.15);
    o.frequency.exponentialRampToValueAtTime(90, tt + 0.12);
    const g = A.gain(0); A.env(g, tt, 0.01, 0.12, 0.5);
    o.connect(g); g.connect(out);
  }
  // [VOICE PLACEHOLDER: satisfied "ahh"] — a low, short burp-ish tone
  const b = A.osc('sawtooth', 85, t + 1.85, 0.3);
  b.frequency.linearRampToValueAtTime(70, t + 2.1);
  const blp = A.filter('lowpass', 420, 2);
  const bg = A.gain(0); A.env(bg, t + 1.85, 0.03, 0.25, 0.25);
  b.connect(blp); blp.connect(bg); bg.connect(out);
  click(A, out, t + 2.05, 2500, 3, 0.05, 0.4, 900); // bottle tossed
  return 2.4;
}

export function madDogGrind(A, out, t, p = {}) {
  const dur = p.duration || 4;
  const mix = A.gain(1);
  const drive = A.shaper(0.5);
  mix.connect(drive); drive.connect(out);
  // grinding gears
  const n = A.noiseSource('brown', t, dur);
  const bp = A.filter('bandpass', 260, 1.5);
  const lfo = A.osc('square', 9, t, dur);
  const lfoG = A.gain(120); lfo.connect(lfoG); lfoG.connect(bp.frequency);
  const g = A.gain(0);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.2);
  g.gain.setValueAtTime(0.9, t + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  n.connect(bp); bp.connect(g); g.connect(mix);
  // chomps
  for (let tt = t + 0.1; tt < t + dur - 0.2; tt += 0.7) {
    click(A, out, tt, 900, 1.5, 0.1, 0.9, 110);
    click(A, out, tt + 0.03, 4000, 5, 0.04, 0.3);
  }
  // [VOICE PLACEHOLDER: the dog growls]
  voice(A, out, t + 0.2, { f0: 70, dur: dur - 0.6, formants: [[300, 4, 1], [700, 5, 0.6], [1600, 6, 0.3]], grit: 0.85, breath: 0.4, vib: 11, vibDepth: 0.08, peak: 0.55 });
  return dur + 0.3;
}

export function madDogReady(A, out, t) {
  // [VOICE PLACEHOLDER: two big barks]
  for (const dt of [0, 0.32]) {
    voice(A, out, t + dt, { f0: 150, dur: 0.18, formants: [[500, 3, 1], [1200, 4, 0.8], [2500, 6, 0.3]], grit: 0.9, breath: 0.3, glide: 0.6, peak: 0.9 });
  }
  // bell ding
  for (const [ratio, amp] of [[1, 0.3], [2.4, 0.14], [4.1, 0.07]]) {
    const o = A.osc('sine', 880 * ratio, t + 0.75, 2);
    const g = A.gain(0); A.env(g, t + 0.75, 0.002, 1.8, amp);
    o.connect(g); g.connect(out);
  }
  return 2.8;
}

export function madDogTake(A, out, t) {
  const n = A.noiseSource('pink', t, 0.5);
  const bp = A.filter('bandpass', 600, 1);
  bp.frequency.exponentialRampToValueAtTime(3000, t + 0.4);
  const g = A.gain(0); A.env(g, t, 0.05, 0.35, 0.5);
  n.connect(bp); bp.connect(g); g.connect(out);
  click(A, out, t + 0.4, 1800, 3, 0.05, 0.7, 300);
  return 0.7;
}

export function trapBuzz(A, out, t, p = {}) {
  const dur = p.duration || 25;
  const o = A.osc('sawtooth', 120, t, dur);
  const o2 = A.osc('square', 180.5, t, dur);
  const bp = A.filter('bandpass', 900, 0.8);
  const lfo = A.osc('sine', 13, t, dur);
  const lg = A.gain(500); lfo.connect(lg); lg.connect(bp.frequency);
  const g = A.gain(0);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + 0.15);
  g.gain.setValueAtTime(0.35, t + dur - 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(bp); o2.connect(bp); bp.connect(g); g.connect(out);
  for (let tt = t; tt < t + dur; tt += 0.06 + Math.random() * 0.25) click(A, out, tt, 2500 + Math.random() * 4000, 3, 0.02, 0.15 + Math.random() * 0.25);
  return dur + 0.1;
}

export function electrocute(A, out, t) {
  for (let i = 0; i < 10; i++) click(A, out, t + i * 0.035 + Math.random() * 0.02, 3000 + Math.random() * 3000, 4, 0.03, 0.4);
  const n = A.noiseSource('white', t, 0.6);
  const hp = A.filter('highpass', 2500, 0.7);
  const g = A.gain(0); A.env(g, t + 0.1, 0.05, 0.5, 0.2);   // sizzle
  n.connect(hp); hp.connect(g); g.connect(out);
  return 0.8;
}

export function leverPull(A, out, t) {
  click(A, out, t, 1500, 2, 0.06, 0.8, 200);
  click(A, out, t + 0.12, 900, 1.5, 0.1, 0.9, 120);
  return 0.4;
}

export function downed(A, out, t) {
  const n = A.noiseSource('brown', t, 0.3);
  const lp = A.filter('lowpass', 300, 1);
  const g = A.gain(0); A.env(g, t, 0.002, 0.25, 1.1);
  n.connect(lp); lp.connect(g); g.connect(out);
  // a low dread chord
  for (const f of [55, 82.4, 116.5]) {
    const o = A.osc('sawtooth', f, t, 3);
    const flt = A.filter('lowpass', 400, 0.7);
    const og = A.gain(0); A.env(og, t, 0.3, 2.5, 0.12);
    o.connect(flt); flt.connect(og); og.connect(out);
  }
  return 3.2;
}

export function revived(A, out, t) {
  [392, 523, 659, 784].forEach((f, i) => {
    const o = A.osc('triangle', f, t + i * 0.08, 0.6);
    const g = A.gain(0); A.env(g, t + i * 0.08, 0.01, 0.5, 0.18);
    o.connect(g); g.connect(out);
  });
  return 1;
}

export function dirtRise(A, out, t) {
  const n = A.noiseSource('brown', t, 1.6);
  const bp = A.filter('bandpass', 350, 0.9);
  const g = A.gain(0); A.env(g, t, 0.1, 1.4, 0.6);
  n.connect(bp); bp.connect(g); g.connect(out);
  for (let i = 0; i < 8; i++) click(A, out, t + Math.random() * 1.4, 600 + Math.random() * 900, 1.5, 0.05, 0.15 + Math.random() * 0.2);
  return 1.7;
}

export function smallBoom(A, out, t) {
  const n = A.noiseSource('brown', t, 0.4);
  const lp = A.filter('lowpass', 1200, 0.8);
  lp.frequency.exponentialRampToValueAtTime(200, t + 0.3);
  const g = A.gain(0); A.env(g, t, 0.002, 0.3, 0.9);
  n.connect(lp); lp.connect(g); g.connect(out);
  const o = A.osc('sine', 110, t, 0.3);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
  const og = A.gain(0); A.env(og, t, 0.002, 0.25, 0.8);
  o.connect(og); og.connect(out);
  return 0.5;
}

// --- Phase 6: power-ups and Cheddar Rounds ------------------------------------

export function powerupSpawn(A, out, t) {
  [1318, 1568, 1976, 2637].forEach((f, i) => {
    const o = A.osc('sine', f, t + i * 0.05, 0.4);
    const g = A.gain(0); A.env(g, t + i * 0.05, 0.005, 0.35, 0.12);
    o.connect(g); g.connect(out);
  });
  return 0.7;
}

// [VOICE PLACEHOLDER: the announcer calls out the power-up's name]
function announcer(A, out, t, syllables = 3) {
  for (let i = 0; i < syllables; i++) {
    voice(A, out, t + i * 0.2, { f0: 95 + (i % 2) * 15, dur: 0.18, formants: [[650 - i * 60, 5, 1], [1150 + i * 120, 6, 0.6], [2500, 8, 0.25]], grit: 0.5, breath: 0.15, peak: 0.55 });
  }
}

export function powerupGrab(A, out, t, p = {}) {
  const type = p.type;
  // pickup swell
  const o = A.osc('triangle', 520, t, 0.5);
  o.frequency.exponentialRampToValueAtTime(1560, t + 0.35);
  const g = A.gain(0); A.env(g, t, 0.01, 0.45, 0.25);
  o.connect(g); g.connect(out);
  announcer(A, out, t + 0.35, type === 'pressureCooker' ? 4 : 3);
  if (type === 'pressureCooker') {
    const n = A.noiseSource('brown', t + 0.05, 2.5);
    const lp = A.filter('lowpass', 900, 0.7); lp.frequency.exponentialRampToValueAtTime(90, t + 2.2);
    const ng = A.gain(0); A.env(ng, t + 0.05, 0.01, 2.2, 1.8);
    n.connect(lp); lp.connect(ng); ng.connect(out);
    const s = A.osc('sine', 60, t, 2); s.frequency.exponentialRampToValueAtTime(25, t + 1.6);
    const sg = A.gain(0); A.env(sg, t, 0.01, 1.8, 1.6); s.connect(sg); sg.connect(out);
  } else if (type === 'doubleDough' || type === 'clearanceSale') {
    click(A, out, t + 0.05, 3200, 6, 0.04, 0.6, 2093);   // ka-
    click(A, out, t + 0.16, 4200, 6, 0.08, 0.7, 2637);   // -ching
  } else if (type === 'fullPantry') {
    for (let i = 0; i < 6; i++) click(A, out, t + 0.05 + i * 0.05, 2200 + i * 200, 4, 0.03, 0.4);
  } else if (type === 'shopClass') {
    for (const d of [0.05, 0.2, 0.35]) click(A, out, t + d, 2600, 1.2, 0.03, 0.6, 1250);
  } else if (type === 'oneBite') {
    click(A, out, t + 0.05, 700, 1.5, 0.12, 1.0, 120);
    voice(A, out, t + 0.1, { f0: 70, dur: 0.6, formants: [[300, 4, 1], [800, 5, 0.6]], grit: 0.9, breath: 0.4, vib: 9, vibDepth: 0.08, peak: 0.5 });
  }
  return 2.6;
}

export function powerupEnd(A, out, t) {
  [988, 784, 587].forEach((f, i) => {
    const o = A.osc('triangle', f, t + i * 0.1, 0.3);
    const g = A.gain(0); A.env(g, t + i * 0.1, 0.005, 0.25, 0.14);
    o.connect(g); g.connect(out);
  });
  return 0.6;
}

export function powerupFizzle(A, out, t) {
  const o = A.osc('sine', 900, t, 0.3);
  o.frequency.exponentialRampToValueAtTime(200, t + 0.25);
  const g = A.gain(0); A.env(g, t, 0.005, 0.25, 0.15);
  o.connect(g); g.connect(out);
  return 0.4;
}

export function thunder(A, out, t, p = {}) {
  const near = p.near ?? 1;
  // crack
  const c = A.noiseSource('white', t, 0.25);
  const hp = A.filter('highpass', 1200, 0.6);
  const cg = A.gain(0); A.env(cg, t, 0.002, 0.2, 1.2 * near);
  c.connect(hp); hp.connect(cg); cg.connect(out);
  // rolling rumble
  const n = A.noiseSource('brown', t + 0.05, 3.5);
  const lp = A.filter('lowpass', 500, 0.6);
  lp.frequency.exponentialRampToValueAtTime(90, t + 3);
  const g = A.gain(0); A.env(g, t + 0.05, 0.08, 3, 1.4);
  const lfo = A.osc('sine', 3.5, t, 3.5); const lg = A.gain(0.4); lfo.connect(lg); lg.connect(g.gain);
  n.connect(lp); lp.connect(g); g.connect(out);
  return 3.6;
}

// [VOICE PLACEHOLDER: hounds] growl / bark / yelp, formant-filtered buzz
export function dogGrowl(A, out, t, p = {}) {
  voice(A, out, t, { f0: p.f0 || 75, dur: p.dur || 0.9, formants: [[350, 4, 1], [900, 5, 0.6], [2200, 7, 0.25]], grit: 0.95, breath: 0.45, vib: 13, vibDepth: 0.1, peak: 0.5 });
  return (p.dur || 0.9) + 0.2;
}

export function dogBark(A, out, t) {
  voice(A, out, t, { f0: 210, dur: 0.14, formants: [[600, 3, 1], [1400, 4, 0.8], [2800, 6, 0.35]], grit: 0.95, breath: 0.3, glide: 0.55, peak: 0.85 });
  return 0.3;
}

export function dogYelp(A, out, t) {
  voice(A, out, t, { f0: 520, dur: 0.22, formants: [[900, 3, 1], [2000, 5, 0.6]], grit: 0.6, breath: 0.25, glide: 0.5, peak: 0.6 });
  const n = A.noiseSource('brown', t + 0.05, 0.5);
  const lp = A.filter('lowpass', 900, 0.8);
  const g = A.gain(0); A.env(g, t + 0.05, 0.005, 0.4, 0.8);
  n.connect(lp); lp.connect(g); g.connect(out);
  return 0.6;
}

export function dogHowl(A, out, t, p = {}) {
  const f = p.f0 || 330;
  voice(A, out, t, { f0: f, dur: 2.2, formants: [[700, 6, 1], [1100, 8, 0.5]], grit: 0.25, breath: 0.2, vib: 5, vibDepth: 0.03, glide: 1.25, peak: 0.45 });
  return 2.5;
}

export function pawStep(A, out, t) {
  click(A, out, t, 1100, 2, 0.03, 0.25);
  return 0.1;
}

export function cheddarSting(A, out, t) {
  // ominous low brass-ish chord rising, cut by a cymbal swell
  for (const [f, d] of [[55, 0], [82.4, 0.1], [98, 0.2], [146.8, 0.3]]) {
    const o = A.osc('sawtooth', f, t + d, 3.5);
    o.frequency.linearRampToValueAtTime(f * 1.06, t + 3);
    const lp = A.filter('lowpass', 600, 1); lp.frequency.linearRampToValueAtTime(1600, t + 2.5);
    const g = A.gain(0); A.env(g, t + d, 0.6, 2.8, 0.12);
    o.connect(lp); lp.connect(g); g.connect(out);
  }
  const n = A.noiseSource('white', t + 1.5, 2);
  const hp = A.filter('highpass', 6000, 0.7);
  const ng = A.gain(0); ng.gain.setValueAtTime(0.0001, t + 1.5); ng.gain.exponentialRampToValueAtTime(0.25, t + 3.2); ng.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
  n.connect(hp); hp.connect(ng); ng.connect(out);
  return 3.8;
}

// --- Phase 7: wonder weapons, Stew Bombs, the box moving ----------------------

function fucciFire(A, out, t, p = {}) {
  const up = p.upgraded ? 1.35 : 1;
  // a bright "pew" sweeping down, with a shimmering harmonic on top
  const o = A.osc('square', 1500 * up, t, 0.25);
  o.frequency.exponentialRampToValueAtTime(260 * up, t + 0.18);
  const lp = A.filter('lowpass', 3200, 2);
  const g = A.gain(0); A.env(g, t, 0.002, 0.2, 0.35);
  o.connect(lp); lp.connect(g); g.connect(out);
  const o2 = A.osc('sine', 3000 * up, t, 0.3);
  o2.frequency.exponentialRampToValueAtTime(900 * up, t + 0.25);
  const g2 = A.gain(0); A.env(g2, t, 0.002, 0.25, 0.15);
  o2.connect(g2); g2.connect(out);
  const n = A.noiseSource('white', t, 0.1);
  const bp = A.filter('bandpass', 5000, 2);
  const g3 = A.gain(0); A.env(g3, t, 0.001, 0.06, 0.25);
  n.connect(bp); bp.connect(g3); g3.connect(out);
  return 0.5;
}

export function fucciImpact(A, out, t) {
  const o = A.osc('sawtooth', 420, t, 0.4);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.3);
  const lp = A.filter('lowpass', 1800, 1.5);
  const g = A.gain(0); A.env(g, t, 0.002, 0.3, 0.5);
  o.connect(lp); lp.connect(g); g.connect(out);
  const n = A.noiseSource('pink', t, 0.3);
  const ng = A.gain(0); A.env(ng, t, 0.002, 0.25, 0.5);
  n.connect(ng); ng.connect(out);
  return 0.5;
}

// The Chopper: it sucks air in for a beat, then a wall of wind leaves the
// barrel - a sub-bass punch you feel, a tearing roar, and a long howl after.
function windFire(A, out, t, p = {}) {
  const low = p.upgraded ? 0.85 : 1;
  const bus = A.gain(1.6);
  const drive = A.shaper(0.45);
  bus.connect(drive); drive.connect(out);
  // the inhale
  const inh = A.noiseSource('pink', t, 0.16);
  const ibp = A.filter('bandpass', 600, 1.2); ibp.frequency.exponentialRampToValueAtTime(2400, t + 0.14);
  const ig = A.gain(0.0001); ig.gain.exponentialRampToValueAtTime(0.35, t + 0.13); ig.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  inh.connect(ibp); ibp.connect(ig); ig.connect(bus);
  const t0 = t + 0.14;
  // sub punch
  const sub = A.osc('sine', 78 * low, t0, 1.0); sub.frequency.exponentialRampToValueAtTime(26 * low, t0 + 0.7);
  const sg = A.gain(0); A.env(sg, t0, 0.005, 0.85, 1.6);
  sub.connect(sg); sg.connect(bus);
  const sub2 = A.osc('triangle', 150 * low, t0, 0.4); sub2.frequency.exponentialRampToValueAtTime(45 * low, t0 + 0.3);
  const s2g = A.gain(0); A.env(s2g, t0, 0.004, 0.32, 0.7);
  sub2.connect(s2g); s2g.connect(bus);
  // the crack at the front of it
  const cr = A.noiseSource('white', t0, 0.06);
  const chp = A.filter('highpass', 1800, 0.7);
  const cg = A.gain(0); A.env(cg, t0, 0.001, 0.05, 1.1);
  cr.connect(chp); chp.connect(cg); cg.connect(bus);
  // the roar: a noise wall sweeping down
  const roar = A.noiseSource('white', t0, 1.6);
  const rlp = A.filter('lowpass', 7000, 0.9); rlp.frequency.exponentialRampToValueAtTime(260, t0 + 1.4);
  const rg = A.gain(0); A.env(rg, t0, 0.01, 1.4, 1.0);
  roar.connect(rlp); rlp.connect(rg); rg.connect(bus);
  // the howl after it, wobbling
  const how = A.noiseSource('pink', t0 + 0.1, 2.4);
  const hbp = A.filter('bandpass', 900 * low, 3); hbp.frequency.exponentialRampToValueAtTime(320 * low, t0 + 2.4);
  const hg = A.gain(0); A.env(hg, t0 + 0.1, 0.25, 2.0, 0.5);
  const wob = A.osc('sine', 5.5, t0, 2.6); const wg = A.gain(220); wob.connect(wg); wg.connect(hbp.frequency);
  how.connect(hbp); hbp.connect(hg); hg.connect(bus);
  return 2.8;
}

function sawFire(A, out, t) {
  // motor rev up, then the launch thunk, then the blade's whine flying off
  const o = A.osc('sawtooth', 90, t, 0.6);
  o.frequency.exponentialRampToValueAtTime(420, t + 0.15);
  const lp = A.filter('lowpass', 1600, 1.5);
  const g = A.gain(0); A.env(g, t, 0.01, 0.4, 0.4);
  o.connect(lp); lp.connect(g); g.connect(out);
  click(A, out, t + 0.02, 700, 1.5, 0.08, 1.0, 140);
  const w = A.osc('square', 1800, t + 0.03, 0.8);
  w.frequency.exponentialRampToValueAtTime(1100, t + 0.8);
  const bp = A.filter('bandpass', 2200, 6);
  const wg = A.gain(0); A.env(wg, t + 0.03, 0.02, 0.7, 0.12);
  w.connect(bp); bp.connect(wg); wg.connect(out);
  return 0.9;
}

export function sawCut(A, out, t) {
  const n = A.noiseSource('white', t, 0.25);
  const bp = A.filter('bandpass', 2600, 2);
  bp.frequency.exponentialRampToValueAtTime(900, t + 0.2);
  const g = A.gain(0); A.env(g, t, 0.003, 0.2, 0.6);
  n.connect(bp); bp.connect(g); g.connect(out);
  const m = A.noiseSource('brown', t, 0.2);
  const lp = A.filter('lowpass', 500, 1);
  const mg = A.gain(0); A.env(mg, t, 0.003, 0.15, 0.6);
  m.connect(lp); lp.connect(mg); mg.connect(out);
  return 0.35;
}

export function sawRicochet(A, out, t) {
  click(A, out, t, 3400, 4, 0.05, 0.9, 1750);
  const o = A.osc('sine', 2600, t, 0.4);
  o.frequency.exponentialRampToValueAtTime(1500, t + 0.35);
  const g = A.gain(0); A.env(g, t, 0.002, 0.35, 0.15);
  o.connect(g); g.connect(out);
  return 0.5;
}

export function sawStick(A, out, t) {
  click(A, out, t, 1500, 2, 0.1, 1.0, 380);
  const o = A.osc('triangle', 380, t, 0.6);
  const lfo = A.osc('sine', 30, t, 0.6); const lg = A.gain(60); lfo.connect(lg); lg.connect(o.frequency);
  const g = A.gain(0); A.env(g, t, 0.002, 0.55, 0.25);   // twang
  o.connect(g); g.connect(out);
  return 0.7;
}

// The Stew Bomb's tune: a ladle banging the pot and a wonky little melody.
export function stewBombTune(A, out, t, p = {}) {
  const dur = p.duration || 7;
  const notes = [392, 440, 494, 392, 523, 494, 440, 330, 349, 392, 440, 349, 392, 330, 294, 262];
  const step = 0.22;
  for (let i = 0, tt = t; tt < t + dur - 0.1; i++, tt += step) {
    const f = notes[i % notes.length] * (1 + Math.floor(i / notes.length) * 0.06); // creeps sharp
    const o = A.osc('square', f, tt, step);
    const lp = A.filter('lowpass', 1400, 3);
    const g = A.gain(0); A.env(g, tt, 0.01, step * 0.9, 0.09);
    o.connect(lp); lp.connect(g); g.connect(out);
    if (i % 2 === 0) click(A, out, tt, 2400 + (i % 4) * 300, 8, 0.06, 0.6, 1900 + (i % 4) * 150); // clang
  }
  return dur + 0.2;
}

export function stewBombLand(A, out, t) {
  click(A, out, t, 1900, 5, 0.08, 0.8, 1300);
  click(A, out, t + 0.1, 2300, 6, 0.06, 0.5, 1600);
  return 0.4;
}

// [VOICE PLACEHOLDER: Erik laughing at you from the bobblehead]
export function erikLaugh(A, out, t) {
  for (let i = 0; i < 5; i++) {
    voice(A, out, t + i * 0.16, { f0: 150 - i * 8, dur: 0.12, formants: [[700, 5, 1], [1200, 6, 0.6], [2600, 8, 0.25]], grit: 0.35, breath: 0.3, peak: 0.5 });
  }
  return 1.1;
}

export function boxWhoosh(A, out, t) {
  const n = A.noiseSource('pink', t, 2.2);
  const bp = A.filter('bandpass', 300, 0.8);
  bp.frequency.exponentialRampToValueAtTime(2500, t + 2);
  const g = A.gain(0); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 1.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  n.connect(bp); bp.connect(g); g.connect(out);
  const o = A.osc('sine', 200, t, 2.2); o.frequency.exponentialRampToValueAtTime(900, t + 2.1);
  const og = A.gain(0); A.env(og, t, 1.2, 1, 0.15); o.connect(og); og.connect(out);
  return 2.4;
}

export function boxThud(A, out, t) {
  const n = A.noiseSource('brown', t, 0.5);
  const lp = A.filter('lowpass', 350, 1);
  const g = A.gain(0); A.env(g, t, 0.002, 0.45, 1.4);
  n.connect(lp); lp.connect(g); g.connect(out);
  click(A, out, t, 900, 1.5, 0.12, 0.8, 110);
  return 0.6;
}

// ---------------------------------------------------------------------------
// Erik on the PA, the intercom, the Easter egg
// ---------------------------------------------------------------------------

// School PA "bing-bong" before Erik talks.
export function paChime(A, out, t) {
  const notes = [[740, 0], [587, 0.42]];
  for (const [f, dt] of notes) {
    for (const [m, g, d] of [[1, 0.35, 1.4], [2.01, 0.1, 0.7], [3.02, 0.05, 0.4], [4.2, 0.03, 0.25]]) {
      const o = A.osc('sine', f * m, t + dt, d);
      const gg = A.gain(0); A.env(gg, t + dt, 0.004, d, g);
      o.connect(gg); gg.connect(out);
    }
  }
  return 2.0;
}

// The PA chain: tinny band-limited speaker with hum and crackle.
function paChain(A, out, t, dur, { hum = 0.02, crackle = 0.025, low = 420, high = 3300, honk = 7, grit = 0.25 } = {}) {
  const hp = A.filter('highpass', low, 0.8);
  const lp = A.filter('lowpass', high, 1.2);
  const pk = A.filter('peaking', 1700, 1.2); pk.gain.value = honk;
  const drive = A.shaper(grit);
  const g = A.gain(0.85);
  hp.connect(pk); pk.connect(drive); drive.connect(lp); lp.connect(g); g.connect(out);
  // mains hum
  const h = A.osc('sawtooth', 60, t, dur + 0.4);
  const hl = A.filter('lowpass', 300, 1);
  const hg = A.gain(0); hg.gain.setValueAtTime(0.0001, t); hg.gain.linearRampToValueAtTime(hum, t + 0.05); hg.gain.setValueAtTime(hum, t + dur + 0.2); hg.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
  h.connect(hl); hl.connect(hg); hg.connect(out);
  // crackle
  const n = A.noiseSource('white', t, dur + 0.4);
  const nh = A.filter('bandpass', 2400, 0.7);
  const ng = A.gain(0);
  const lfo = A.osc('square', 13, t, dur + 0.4);
  const lg = A.gain(crackle);
  lfo.connect(lg); lg.connect(ng.gain);
  n.connect(nh); nh.connect(ng); ng.connect(out);
  return hp;
}

const VOWELS = [
  [[730, 6, 1], [1090, 7, 0.55], [2440, 9, 0.22]],  // ah
  [[300, 6, 1], [2250, 9, 0.5], [3000, 10, 0.2]],   // ee
  [[330, 6, 1], [870, 7, 0.5], [2240, 9, 0.15]],    // oo
  [[530, 6, 1], [1840, 8, 0.5], [2480, 9, 0.2]],    // eh
  [[570, 6, 1], [840, 7, 0.55], [2410, 9, 0.18]],   // aw
  [[640, 6, 1], [1190, 7, 0.55], [2390, 9, 0.2]],   // uh
];

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// Turn a line of text into a babble of syllables that roughly follows it:
// one syllable per ~3 letters, pauses at punctuation, pitch falls through a
// sentence and jumps up on CAPS and "!". [VOICE PLACEHOLDER]
export function babble(A, out, t, { text = '', dur = 2, f0 = 135, grit = 0.35, peak = 0.55, whine = 1 } = {}) {
  let seed = hashStr(text);
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const tokens = text.split(/(\s+|[,.!?;:—…]+)/).filter((s) => s && s.trim());
  // syllables: [vowel, weight, pitchMul, gapAfter]
  const syl = [];
  let sentencePos = 0;
  for (const tok of tokens) {
    if (/^[,.!?;:—…]+$/.test(tok)) {
      if (syl.length) syl[syl.length - 1][3] += /[.!?…]/.test(tok) ? 0.35 : 0.18;
      if (/[!]/.test(tok) && syl.length) syl[syl.length - 1][2] *= 1.25;
      if (/[?]/.test(tok) && syl.length) syl[syl.length - 1][2] *= 1.3;
      if (/[.!?…]/.test(tok)) sentencePos = 0;
      continue;
    }
    const letters = tok.replace(/[^A-Za-z0-9']/g, '');
    const n = Math.max(1, Math.round(letters.length / 3));
    const loud = letters.length > 1 && letters === letters.toUpperCase() && /[A-Z]/.test(letters);
    for (let i = 0; i < n; i++) {
      const decl = 1.12 - Math.min(0.3, sentencePos * 0.025);
      syl.push([Math.floor(rnd() * VOWELS.length), 1 + rnd() * 0.6, decl * (loud ? 1.35 : 1) * (1 + (rnd() - 0.5) * 0.18), i === n - 1 ? 0.06 : 0.015]);
      sentencePos++;
    }
  }
  if (!syl.length) return 0.1;
  const total = syl.reduce((a, s) => a + s[1] * 0.16 + s[3], 0);
  const k = Math.max(0.6, Math.min(1.6, (dur - 0.2) / total));
  let tt = t + 0.05;
  for (const [v, w, pm, gap] of syl) {
    const d = w * 0.16 * k;
    const f = f0 * pm * whine;
    voice(A, out, tt, { f0: f, dur: d, formants: VOWELS[v], grit, breath: 0.12, vib: 5.5, vibDepth: 0.025, glide: 1 + (rnd() - 0.6) * 0.15, peak });
    // the odd consonant hiss
    if (rnd() < 0.35) {
      const ns = A.noiseSource('white', tt - 0.03, 0.05);
      const bp = A.filter('bandpass', 2800 + rnd() * 1500, 2);
      const ng = A.gain(0); A.env(ng, tt - 0.03, 0.005, 0.04, peak * 0.25);
      ns.connect(bp); bp.connect(ng); ng.connect(out);
    }
    tt += d + gap * k;
  }
  return tt - t + 0.2;
}

// [VOICE PLACEHOLDER: Erik Madsen over the school PA]
export function erikPA(A, out, t, p = {}) {
  const dur = p.dur || 3;
  const chime = p.chime !== false;
  const t0 = chime ? t + 1.0 : t;
  if (chime) paChime(A, out, t);
  const chain = paChain(A, out, t0, dur);
  // mic thump as he leans in
  const th = A.osc('sine', 90, t0 - 0.08, 0.12); th.frequency.exponentialRampToValueAtTime(40, t0 + 0.04);
  const tg = A.gain(0); A.env(tg, t0 - 0.08, 0.005, 0.1, 0.35); th.connect(tg); tg.connect(chain);
  babble(A, chain, t0, { text: p.text || '', dur, f0: 142, grit: 0.4, peak: 0.6, whine: p.angry ? 1.15 : 1 });
  return (t0 - t) + dur + 0.6;
}

// A recorded line over the school PA: the chime, the mic thump, then the
// recording through the speaker chain (a bit cleaner than the synth so every
// word comes through). p: { key, chime, gain, arena }
export function paVoice(A, out, t, p = {}) {
  const buf = A.pickSample(p.key);
  if (!buf) return 0;
  const chime = p.chime !== false;
  const t0 = chime ? t + 1.0 : t;
  if (chime) paChime(A, out, t);
  const dur = buf.duration;
  const chain = paChain(A, out, t0, dur, p.arena
    ? { low: 260, high: 5200, honk: 4, grit: 0.12, hum: 0.012, crackle: 0.012 }   // the gym's big speakers
    : { low: 330, high: 4300, honk: 5, grit: 0.16 });
  const th = A.osc('sine', 90, t0 - 0.08, 0.12); th.frequency.exponentialRampToValueAtTime(40, t0 + 0.04);
  const tg = A.gain(0); A.env(tg, t0 - 0.08, 0.005, 0.1, 0.35); th.connect(tg); tg.connect(chain);
  const src = A.ctx.createBufferSource();
  src.buffer = buf;
  const g = A.gain(p.gain ?? 0.8);
  src.connect(g); g.connect(chain);
  src.start(t0);
  return (t0 - t) + dur + 0.6;
}

// A recorded line said in person, or over a walkie-talkie (p.radio).
export function liveVoice(A, out, t, p = {}) {
  const buf = A.pickSample(p.key);
  if (!buf) return 0;
  const src = A.ctx.createBufferSource();
  src.buffer = buf;
  const dur = buf.duration;
  if (!p.radio) {
    const g = A.gain(p.gain ?? 0.9);
    src.connect(g); g.connect(out);
    src.start(t);
    return dur + 0.2;
  }
  const t0 = t + 0.12;
  const c1 = A.osc('square', 1650, t, 0.07); const cg = A.gain(0); A.env(cg, t, 0.002, 0.06, 0.12); c1.connect(cg); cg.connect(out);
  const hp = A.filter('highpass', 400, 0.7), lp = A.filter('lowpass', 3200, 0.9);
  const drive = A.shaper(0.35), g = A.gain(p.gain ?? 0.65);
  src.connect(hp); hp.connect(lp); lp.connect(drive); drive.connect(g); g.connect(out);
  src.start(t0);
  const n = A.noiseSource('white', t, dur + 0.3);
  const nf = A.filter('bandpass', 2200, 0.6), ng = A.gain(0);
  A.env(ng, t, 0.02, 0.2, 0.03, 0, dur);
  n.connect(nf); nf.connect(ng); ng.connect(out);
  const te = t0 + dur + 0.05;
  const c2 = A.osc('square', 1250, te, 0.08); const cg2 = A.gain(0); A.env(cg2, te, 0.002, 0.07, 0.1); c2.connect(cg2); cg2.connect(out);
  return dur + 0.4;
}

// [VOICE PLACEHOLDER: one of Stew talking into the principal's microphone]
export function stewTalk(A, out, t, p = {}) {
  const dur = p.dur || 2;
  const lp = A.filter('lowpass', 5000, 0.7);
  const boost = A.gain(2.6);
  lp.connect(boost); boost.connect(out);
  babble(A, lp, t, { text: p.text || '', dur, f0: 112, grit: 0.3, peak: 0.6 });
  return dur + 0.3;
}

export function paperRustle(A, out, t) {
  for (let i = 0; i < 3; i++) {
    const n = A.noiseSource('white', t + i * 0.07, 0.12);
    const bp = A.filter('bandpass', R(2500, 5000), 1.2);
    const g = A.gain(0); A.env(g, t + i * 0.07, 0.01, 0.1, 0.25);
    n.connect(bp); bp.connect(g); g.connect(out);
  }
  return 0.5;
}

// Picking up one of the three Stew items.
export function stewItemGet(A, out, t, p = {}) {
  const n = p.count || 1;
  const base = [330, 392, 494][Math.min(2, n - 1)];
  const notes = [1, 1.25, 1.5, 2];
  notes.forEach((m, i) => {
    const o = A.osc('square', base * m, t + i * 0.08, 0.3);
    const lp = A.filter('lowpass', 2200, 2);
    const g = A.gain(0); A.env(g, t + i * 0.08, 0.005, 0.28, 0.14);
    o.connect(lp); lp.connect(g); g.connect(out);
  });
  // power chord stab
  for (const m of [1, 1.5, 2]) {
    const o = A.osc('sawtooth', base / 2 * m, t + 0.34, 0.6);
    const sh = A.shaper(0.9);
    const lp = A.filter('lowpass', 2400, 1);
    const g = A.gain(0); A.env(g, t + 0.34, 0.005, 0.6, 0.12);
    o.connect(sh); sh.connect(lp); lp.connect(g); g.connect(out);
  }
  return 1.2;
}

// Needle drop / tape clunk before the song.
export function tapeClunk(A, out, t) {
  click(A, out, t, 600, 2, 0.08, 0.9, 140);
  click(A, out, t + 0.18, 1200, 3, 0.05, 0.6, 400);
  const n = A.noiseSource('pink', t + 0.25, 1.6);
  const bp = A.filter('bandpass', 1800, 0.6);
  const g = A.gain(0); g.gain.setValueAtTime(0.0001, t + 0.25); g.gain.linearRampToValueAtTime(0.05, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + 1.8);
  n.connect(bp); bp.connect(g); g.connect(out);
  return 2;
}

// Tiny tick when your bullets connect.
export function hitTick(A, out, t, p = {}) {
  click(A, out, t, p.head ? 3600 : 2800, 6, 0.03, p.head ? 0.35 : 0.22, p.head ? 2400 : 1900);
  return 0.08;
}

// Shared with the music (src/audio/music.js).
export { voice as singVoice, VOWELS };

// --- the ending ----------------------------------------------------------------
// The Press Box glass going: a crack, a burst, then tinkling shards.
export function glassShatter(A, out, t) {
  const n = A.noiseSource('white', t, 0.5);
  const hp = A.filter('highpass', 2500, 0.7);
  const g = A.gain(0); A.env(g, t, 0.001, 0.4, 1.2);
  n.connect(hp); hp.connect(g); g.connect(out);
  for (let i = 0; i < 26; i++) {
    const tt = t + 0.05 + Math.random() * 1.6;
    const o = A.osc('sine', 2500 + Math.random() * 4500, tt, 0.15);
    const og = A.gain(0); A.env(og, tt, 0.001, 0.12, 0.15 * (1 - (tt - t) / 2));
    o.connect(og); og.connect(out);
  }
  return 2;
}

// Every light in the building dying at once.
export function powerDown(A, out, t) {
  const o = A.osc('sawtooth', 120, t, 1.6);
  o.frequency.exponentialRampToValueAtTime(25, t + 1.5);
  const lp = A.filter('lowpass', 900, 1);
  lp.frequency.exponentialRampToValueAtTime(120, t + 1.5);
  const g = A.gain(0); A.env(g, t, 0.01, 1.4, 0.5);
  o.connect(lp); lp.connect(g); g.connect(out);
  const n = A.noiseSource('brown', t, 0.3);
  const ng = A.gain(0); A.env(ng, t, 0.002, 0.25, 0.8);
  n.connect(ng); ng.connect(out);
  return 1.8;
}

// The Schnitz: a deep, rattling voice from everywhere at once.
export function schnitzVoice(A, out, t, p = {}) {
  const dur = p.dur || 3;
  const drive = A.shaper(0.8);
  const lp = A.filter('lowpass', 1400, 0.8);
  const g = A.gain(2.2);
  drive.connect(lp); lp.connect(g); g.connect(out);
  babble(A, drive, t, { text: p.text || '', dur, f0: 52, grit: 0.95, peak: 0.7 });
  // a sub drone under it
  const o = A.osc('sine', 38, t, dur + 1);
  const og = A.gain(0); A.env(og, t, 0.4, dur, 0.6);
  o.connect(og); og.connect(out);
  return dur + 1;
}

// Wind across nothing at all.
export function spaceWind(A, out, t, p = {}) {
  const dur = p.dur || 10;
  const n = A.noiseSource('pink', t, dur);
  const bp = A.filter('bandpass', 400, 0.6);
  bp.frequency.linearRampToValueAtTime(900, t + dur * 0.5);
  bp.frequency.linearRampToValueAtTime(300, t + dur);
  const g = A.gain(0); A.env(g, t, 2, dur - 3, 0.25);
  n.connect(bp); bp.connect(g); g.connect(out);
  return dur;
}

// One of the crew talking: out loud, or squashed through a walkie-talkie with a
// chirp at each end and a bed of static.
export function crewVoice(A, out, t, p = {}) {
  const dur = p.dur || 2;
  if (!p.radio) {
    const lp = A.filter('lowpass', 5000, 0.7);
    const boost = A.gain(2.6);
    lp.connect(boost); boost.connect(out);
    babble(A, lp, t, { text: p.text || '', dur, f0: p.f0 || 115, grit: p.grit ?? 0.3, peak: 0.6 });
    return dur + 0.3;
  }
  const t0 = t + 0.12;
  // chirp in
  const c1 = A.osc('square', 1650, t, 0.07); const cg = A.gain(0); A.env(cg, t, 0.002, 0.06, 0.12); c1.connect(cg); cg.connect(out);
  const hp = A.filter('highpass', 420, 0.7), bp = A.filter('lowpass', 2900, 0.9);
  const drive = A.shaper(0.55), boost = A.gain(2.4);
  hp.connect(bp); bp.connect(drive); drive.connect(boost); boost.connect(out);
  babble(A, hp, t0, { text: p.text || '', dur, f0: p.f0 || 115, grit: p.grit ?? 0.3, peak: 0.6 });
  // static under it
  const n = A.noiseSource('white', t, dur + 0.3);
  const nf = A.filter('bandpass', 2200, 0.6), ng = A.gain(0);
  A.env(ng, t, 0.02, 0.2, 0.035, 0, dur);
  n.connect(nf); nf.connect(ng); ng.connect(out);
  // chirp out
  const te = t0 + dur + 0.05;
  const c2 = A.osc('square', 1250, te, 0.08); const cg2 = A.gain(0); A.env(cg2, te, 0.002, 0.07, 0.1); c2.connect(cg2); cg2.connect(out);
  return dur + 0.4;
}

// A Cheddar talking: a wet, snarling growl that somehow forms words.
// Achievement unlocked: a soft low thump, then two bright bell tones and a shimmer.
export function achievementChime(A, out, t) {
  const bell = (f, at, peak, len) => {
    for (const [mult, g] of [[1, 1], [2.01, 0.35], [3.0, 0.12]]) {
      const o = A.osc('sine', f * mult, t + at, len + 0.1);
      const e = A.gain(0); A.env(e, t + at, 0.006, len, peak * g);
      o.connect(e); e.connect(out);
    }
  };
  const th = A.osc('sine', 140, t, 0.3); th.frequency.exponentialRampToValueAtTime(60, t + 0.25);
  const tg = A.gain(0); A.env(tg, t, 0.005, 0.25, 0.5); th.connect(tg); tg.connect(out);
  bell(659.3, 0.04, 0.28, 0.5);    // E5
  bell(987.8, 0.16, 0.3, 1.1);     // B5
  const n = A.noiseSource('white', t + 0.16, 0.9);
  const hp = A.filter('highpass', 7000, 0.7);
  const ng = A.gain(0); A.env(ng, t + 0.16, 0.02, 0.8, 0.06);
  n.connect(hp); hp.connect(ng); ng.connect(out);
  return 1.4;
}

// A recorded "Wanna play 2K?" (CONFIG.cheddar.lineAudio), with a little of the
// growl under it so it still sounds like it came out of a hound.
export function cheddarClip(A, out, t, p = {}) {
  const buf = A.pickSample(p.key);
  if (!buf) return 0;
  const src = A.ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = p.rate || 1;
  const dur = buf.duration / (p.rate || 1);
  const g = A.gain(p.gain ?? 1);
  src.connect(g); g.connect(out);
  src.start(t);
  if (p.growl) {
    const n = A.noiseSource('brown', t, dur + 0.2);
    const bp = A.filter('bandpass', 260, 1.5);
    const ng = A.gain(0); A.env(ng, t, 0.05, dur, 0.3, 0, 0.1);
    const trem = A.ctx.createOscillator(); trem.frequency.value = 28; trem.start(t); trem.stop(t + dur + 0.3);
    const tg = A.gain(0.2); trem.connect(tg); tg.connect(ng.gain);
    n.connect(bp); bp.connect(ng); ng.connect(out);
  }
  return dur + 0.3;
}

export function cheddarVoice(A, out, t, p = {}) {
  const dur = p.dur || 1.3;
  const drive = A.shaper(0.9);
  const lp = A.filter('lowpass', 2600, 0.9);
  const g = A.gain(2.4);
  drive.connect(lp); lp.connect(g); g.connect(out);
  babble(A, drive, t, { text: p.text || '', dur, f0: 78 + Math.random() * 14, grit: 0.95, peak: 0.75 });
  // growl underneath: rumbling noise, tremolo like a throat rattle
  const n = A.noiseSource('brown', t, dur + 0.3);
  const bp = A.filter('bandpass', 260, 1.5);
  const ng = A.gain(0); A.env(ng, t, 0.05, dur, 0.55, 0, 0.1);
  const trem = A.ctx.createOscillator(); trem.frequency.value = 28; trem.start(t); trem.stop(t + dur + 0.4);
  const tg = A.gain(0.35); trem.connect(tg); tg.connect(ng.gain);
  n.connect(bp); bp.connect(ng); ng.connect(out);
  return dur + 0.4;
}

// --- the boiler room cauldron ---------------------------------------------------
// One thick bubble of stew: a low, wet "blorp".
export function stewBubble(A, out, t, p = {}) {
  const f = (p.f || 1) * (90 + Math.random() * 70);
  const o = A.osc('sine', f, t, 0.18);
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 2.6, t + 0.09);
  const g = A.gain(0); A.env(g, t, 0.01, 0.12, 0.35);
  const lp = A.filter('lowpass', 900, 3);
  o.connect(lp); lp.connect(g); g.connect(out);
  // the pop
  const n = A.noiseSource('pink', t + 0.08, 0.05);
  const bp = A.filter('bandpass', 700 + Math.random() * 600, 2);
  const ng = A.gain(0); A.env(ng, t + 0.08, 0.002, 0.04, 0.2);
  n.connect(bp); bp.connect(ng); ng.connect(out);
  return 0.3;
}

// Steam forcing its way out of a valve that's just been shot open.
export function steamHiss(A, out, t, p = {}) {
  const dur = p.dur || 2;
  const n = A.noiseSource('white', t, dur);
  const hp = A.filter('highpass', 2500, 0.7);
  const bp = A.filter('bandpass', 5200, 0.8);
  const g = A.gain(0);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.03);
  g.gain.setTargetAtTime(0.0001, t + dur * 0.4, dur * 0.25);
  n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out);
  // the wheel squealing round
  const o = A.osc('sawtooth', 620, t, 0.35);
  o.frequency.linearRampToValueAtTime(880, t + 0.3);
  const og = A.gain(0); A.env(og, t, 0.01, 0.3, 0.06);
  const obp = A.filter('bandpass', 1400, 6);
  o.connect(obp); obp.connect(og); og.connect(out);
  return dur + 0.2;
}

// All three valves open: the stew roars up and boils over.
export function cauldronBoil(A, out, t) {
  const n = A.noiseSource('brown', t, 4);
  const lp = A.filter('lowpass', 300, 0.8);
  lp.frequency.linearRampToValueAtTime(1400, t + 0.6);
  lp.frequency.linearRampToValueAtTime(400, t + 4);
  const g = A.gain(0); A.env(g, t, 0.15, 3.6, 1.1);
  n.connect(lp); lp.connect(g); g.connect(out);
  for (let i = 0; i < 26; i++) stewBubble(A, out, t + 0.1 + Math.random() * 3.2, { f: 0.8 + Math.random() * 0.8 });
  // a happy little brass sting
  [0, 4, 7, 12].forEach((s, i) => {
    const o = A.osc('sawtooth', 262 * Math.pow(2, s / 12), t + 0.3 + i * 0.09, 0.9);
    const f = A.filter('lowpass', 1800, 1);
    const og = A.gain(0); A.env(og, t + 0.3 + i * 0.09, 0.02, 0.8, 0.08);
    o.connect(f); f.connect(og); og.connect(out);
  });
  return 4.2;
}

// A packed gym: a roar that swells and settles, with whoops and whistles on top.
export function crowdCheer(A, out, t, p = {}) {
  const dur = p.dur || 8;
  for (const [f, q, lvl] of [[700, 0.7, 0.5], [1600, 0.9, 0.32], [3200, 1.2, 0.14]]) {
    const n = A.noiseSource('pink', t, dur + 0.5);
    const bp = A.filter('bandpass', f, q);
    const g = A.gain(0.0001);
    // roar in, then rolling swells
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(lvl, t + 1.2);
    for (let s = 1.2; s < dur - 1; s += 0.9 + Math.random() * 0.8) g.gain.linearRampToValueAtTime(lvl * (0.6 + Math.random() * 0.5), t + s);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(g); g.connect(out);
  }
  // whoops and whistles
  for (let i = 0; i < Math.floor(dur * 1.6); i++) {
    const s = t + 0.6 + Math.random() * (dur - 1.5);
    const f0 = 600 + Math.random() * 900;
    const o = A.osc(Math.random() < 0.5 ? 'sine' : 'triangle', f0, s, 0.5);
    o.frequency.linearRampToValueAtTime(f0 * (1.3 + Math.random() * 0.6), s + 0.25);
    o.frequency.linearRampToValueAtTime(f0 * 0.9, s + 0.45);
    const g = A.gain(0); A.env(g, s, 0.04, 0.4, 0.05 + Math.random() * 0.05);
    o.connect(g); g.connect(out);
  }
  return dur + 0.5;
}

// The same crowd, terrified: a high ragged scream that tears and falls away.
export function crowdScream(A, out, t, p = {}) {
  const dur = p.dur || 4;
  const n = A.noiseSource('white', t, dur);
  const bp = A.filter('bandpass', 2400, 1.4);
  bp.frequency.linearRampToValueAtTime(1500, t + dur);
  const trem = A.osc('sine', 9, t, dur); const tg = A.gain(0.35); trem.connect(tg);
  const g = A.gain(0.0001); tg.connect(g.gain);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.45, t + 0.25); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  n.connect(bp); bp.connect(g); g.connect(out);
  return dur;
}

// A referee's whistle: two sharp blasts.
export function refWhistle(A, out, t) {
  for (const [s, d] of [[0, 0.22], [0.32, 0.5]]) {
    const o = A.osc('sine', 3100, t + s, d);
    const lfo = A.osc('sine', 48, t + s, d); const lg = A.gain(70); lfo.connect(lg); lg.connect(o.frequency);
    const g = A.gain(0); A.env(g, t + s, 0.01, d, 0.25, 0, d - 0.08);
    o.connect(g); g.connect(out);
  }
  return 1;
}
