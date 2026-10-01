// =============================================================================
// Sound recipes. Each is (A, out, t, params) => duration in seconds.
// A = AudioEngine (for helpers), out = destination node, t = start time.
// =============================================================================

const R = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------------------
// Guns
// ---------------------------------------------------------------------------
export function gunshot(A, out, t, p = {}) {
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
  // machine guns get a mechanical rattle
  if (p.kind === 'smg' || p.kind === 'ar') {
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
  const tile = surface === 'tile' || surface === 'tile_big';
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
