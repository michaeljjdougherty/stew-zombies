// =============================================================================
// The little bass beat that plays while James is twerking (his idle act, after
// standing still a few seconds: the sim's p.idle). Synthesized, a bar at a time,
// quiet. Your own plays in your ears; a teammate's comes from where they are.
// =============================================================================
const BPM = 105, BEAT = 60 / BPM, BAR = BEAT * 4;

// bass notes in the bar: [beat, Hz, length in beats]
const LINE = [[0, 82.4, 0.6], [0.75, 82.4, 0.4], [1.5, 98, 0.6], [2.5, 110, 0.4], [3, 82.4, 0.4], [3.5, 73.4, 0.4]];

function bar(A, out, t) {
  const ctx = A.ctx;
  // bass: a round triangle through a low-pass, a little glide into each note
  const lp = A.filter('lowpass', 420, 0.8); lp.connect(out);
  for (const [b, f, len] of LINE) {
    const at = t + b * BEAT, d = len * BEAT;
    const o = A.osc('triangle', f * 1.06, at, d);
    o.frequency.exponentialRampToValueAtTime(f, at + 0.05);
    const s = A.osc('sine', f / 2, at, d);
    const g = A.gain(0); A.env(g, at, 0.01, d, 0.55, 0.0001);
    o.connect(g); s.connect(g); g.connect(lp);
  }
  // kick on 1 and 3 (and the and of 3), clap on 2 and 4, soft hats
  for (const b of [0, 2, 2.5]) {
    const at = t + b * BEAT;
    const o = A.osc('sine', 120, at, 0.25);
    o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    const g = A.gain(0); A.env(g, at, 0.003, 0.22, 0.8); o.connect(g); g.connect(out);
  }
  for (const b of [1, 3]) {
    const at = t + b * BEAT;
    const n = A.noiseSource('white', at, 0.15);
    const bp = A.filter('bandpass', 1500, 1.2);
    const g = A.gain(0); A.env(g, at, 0.002, 0.12, 0.35);
    n.connect(bp); bp.connect(g); g.connect(out);
  }
  for (let b = 0; b < 4; b += 0.5) {
    const at = t + b * BEAT;
    const n = A.noiseSource('white', at, 0.05);
    const hp = A.filter('highpass', 7000, 0.7);
    const g = A.gain(0); A.env(g, at, 0.001, 0.035, b % 1 ? 0.06 : 0.1);
    n.connect(hp); hp.connect(g); g.connect(out);
  }
  void ctx;
  return BAR;
}

export class IdleBeats {
  constructor(audio, cfg) {
    this.A = audio;
    this.gain = (cfg && cfg.audio && cfg.audio.idleBeatGain) || 0.32;
    this.on = new Map();   // player id -> { next: when their next bar starts, outs: the bars playing }
  }

  // hasBeat(character) says whose idle act has a beat; on = we're in a game.
  update(sim, localId, hasBeat, on) {
    const A = this.A;
    if (!A || !A.ready || !sim) return;
    const now = A.now();
    for (const p of sim.players) {
      if (!(on && p.alive && p.idle && hasBeat(p.character))) { this.cut(p.id); continue; }
      let s = this.on.get(p.id);
      if (!s) this.on.set(p.id, s = { next: now + 0.05, outs: [] });
      if (s.next < now) s.next = now + 0.05;
      if (s.next - now > 0.3) continue;   // (the bar after next isn't due yet)
      const mine = p.id === localId;
      const out = A.play(bar, {}, { pos: mine ? null : { x: p.pos.x, y: p.pos.y + 1, z: p.pos.z }, bus: 'sfx', gain: this.gain * (mine ? 0.8 : 1), reverb: 0.1, delay: s.next - now });
      if (out) { s.outs.push(out); if (s.outs.length > 2) s.outs.shift(); }
      s.next += BAR;
    }
    for (const id of [...this.on.keys()]) if (!sim.players.some((p) => p.id === id)) this.cut(id);
  }

  // they moved or fired: the beat stops (a quick fade, no click)
  cut(id) {
    const s = this.on.get(id);
    if (!s) return;
    const t = this.A.now();
    for (const o of s.outs) { try { o.input.gain.cancelScheduledValues(t); o.input.gain.setTargetAtTime(0, t, 0.03); } catch (e) { /* already gone */ } }
    this.on.delete(id);
  }

  stop() { for (const id of [...this.on.keys()]) this.cut(id); }
}
