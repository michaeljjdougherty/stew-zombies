// =============================================================================
// Call of the Crust: each War Hammer part lying out on its island hums, louder
// the closer you get (so you can find it by ear). Stops once it's picked up.
// Run by the SoundDirector (src/audio/director.js). Numbers: CONFIG.crust.partHum.
// =============================================================================

export class PartHum {
  constructor(A, cfg) {
    this.A = A; this.cfg = cfg;
    this.hums = new Map();   // part id -> { out, g, nodes }
  }

  // a low ringing drone: two sines a fifth apart, beating slowly, with a breathy shimmer on top
  start(id, pos) {
    const A = this.A, ctx = A.ctx;
    const out = A.output({ pos, bus: 'ambient', reverb: 0.35, ref: 1, rolloff: 0 });
    const g = A.gain(0);
    g.connect(out.input);
    const nodes = [];
    const base = { head: 98, haft: 110, grip: 123.5, pommel: 130.8 }[id] || 110;
    for (const [f, v] of [[base, 0.5], [base * 1.5, 0.28], [base * 2.003, 0.14]]) {
      const o = ctx.createOscillator(); o.frequency.value = f; o.start();
      const og = A.gain(v); o.connect(og); og.connect(g); nodes.push(o);
    }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.7 + Math.random() * 0.3; lfo.start();
    const trem = A.gain(1); const lg = A.gain(0.35); lfo.connect(lg); lg.connect(trem.gain); nodes.push(lfo);
    const sh = ctx.createBufferSource(); sh.buffer = A.noise.pink; sh.loop = true; sh.start(0, Math.random() * 2); nodes.push(sh);
    const bp = A.filter('bandpass', base * 8, 6); const sg = A.gain(0.18);
    sh.connect(bp); bp.connect(sg); sg.connect(trem); trem.connect(g);
    return { out, g, nodes, pos };
  }

  stopOne(h) {
    try { h.g.gain.setTargetAtTime(0, this.A.now(), 0.15); } catch { /* gone */ }
    const at = this.A.now() + 0.8;
    for (const n of h.nodes) { try { n.stop(at); } catch { /* already stopped */ } }
  }

  update(sim, listener) {
    const F = sim.crustEgg && sim.crustEgg.forge;
    const c = this.cfg.crust.partHum;
    const seen = new Set();
    if (F && F.parts && listener) {
      for (const [id, k] of Object.entries(F.parts)) {
        if (k.state !== 'lying') continue;
        const d = Math.hypot(k.x - listener.x, k.y - listener.y, k.z - listener.z);
        let h = this.hums.get(id);
        if (d > c.range) { if (h) { this.stopOne(h); this.hums.delete(id); } continue; }
        seen.add(id);
        if (!h || h.pos.x !== k.x || h.pos.z !== k.z) {
          if (h) this.stopOne(h);
          h = this.start(id, { x: k.x, y: k.y + 0.3, z: k.z });
          this.hums.set(id, h);
        }
        // louder the closer you get: nothing at the edge of its range, full right on top of it
        const near = 1 - d / c.range;
        h.g.gain.setTargetAtTime(c.gain * near * near, this.A.now(), 0.1);
      }
    }
    for (const [id, h] of this.hums) if (!seen.has(id)) { this.stopOne(h); this.hums.delete(id); }
  }

  stop() {
    for (const h of this.hums.values()) this.stopOne(h);
    this.hums.clear();
  }
}
