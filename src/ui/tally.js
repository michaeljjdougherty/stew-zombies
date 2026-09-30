// =============================================================================
// Round counter drawn as red, hand-scratched tally marks (numerals after 10).
// =============================================================================

function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Stroke paths for scratched numerals in a 0..1 box.
const DIGITS = {
  0: [[[0.5, 0], [0.15, 0.18], [0.08, 0.6], [0.38, 1], [0.8, 0.86], [0.92, 0.4], [0.62, 0.02], [0.45, 0.02]]],
  1: [[[0.28, 0.2], [0.55, 0]], [[0.55, 0], [0.5, 1]]],
  2: [[[0.1, 0.25], [0.35, 0.02], [0.72, 0.03], [0.88, 0.28], [0.75, 0.52], [0.1, 1], [0.95, 0.98]]],
  3: [[[0.1, 0.1], [0.5, 0], [0.88, 0.2], [0.5, 0.47]], [[0.5, 0.47], [0.92, 0.72], [0.55, 1], [0.1, 0.9]]],
  4: [[[0.72, 1], [0.7, 0]], [[0.7, 0], [0.05, 0.68], [0.95, 0.68]]],
  5: [[[0.9, 0.02], [0.18, 0]], [[0.18, 0], [0.12, 0.45], [0.6, 0.4], [0.92, 0.66], [0.6, 1], [0.08, 0.92]]],
  6: [[[0.82, 0.05], [0.32, 0.2], [0.1, 0.65], [0.4, 1], [0.86, 0.8], [0.72, 0.5], [0.15, 0.6]]],
  7: [[[0.05, 0.02], [0.95, 0]], [[0.95, 0], [0.38, 1]]],
  8: [[[0.5, 0.48], [0.15, 0.24], [0.5, 0], [0.86, 0.24], [0.5, 0.48], [0.1, 0.75], [0.5, 1], [0.9, 0.75], [0.5, 0.48]]],
  9: [[[0.86, 0.38], [0.5, 0.55], [0.14, 0.3], [0.5, 0], [0.86, 0.28]], [[0.86, 0.28], [0.78, 0.7], [0.4, 1]]],
};

export class TallyCounter {
  constructor(canvas, cfg) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.cfg = cfg;
    this.round = 0;
    this.shown = 0;
    this.anim = null;      // { kind: 'change', t, from, to }
    this.blink = false;
    this.t = 0;
    this.dirty = true;
  }

  setRound(r) {
    if (r === this.round) return;
    this.anim = { kind: 'change', t: 0, from: this.round, to: r };
    this.round = r;
    this.blink = false;
  }

  setBlink(on) { this.blink = on; this.dirty = true; }

  // Build the list of strokes for a round number.
  strokesFor(n) {
    const out = [];
    if (n <= 0) return out;
    const H = 110, top = 18;
    if (n <= this.cfg.hud.tallyUpTo) {
      let x = 18;
      for (let i = 0; i < n; i++) {
        const inGroup = i % 5;
        if (inGroup === 4) {
          const gx = x - 4 * 22 - 6;
          out.push({ pts: [[gx, top + H * 0.74], [x - 12, top + H * 0.22]], seed: 1000 + i, w: 9 });
        } else {
          out.push({ pts: [[x, top + 2], [x + 1.5, top + H]], seed: 1000 + i, w: 9 });
          x += 22;
        }
        if (inGroup === 4) x += 16;
      }
    } else {
      const s = String(n);
      let x = 14;
      const w = 62, h = H;
      for (let i = 0; i < s.length; i++) {
        for (const path of DIGITS[s[i]]) {
          out.push({ pts: path.map(([px, py]) => [x + px * w, top + py * h]), seed: n * 31 + i * 7 + path.length, w: 10 });
        }
        x += w + 18;
      }
    }
    return out;
  }

  drawStroke(g, st, progress, color) {
    const r = rand(st.seed);
    const pts = st.pts;
    // total length for progress
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const drawLen = total * progress;
    // several passes make it look carved/scratched
    const passes = [
      { off: 0, w: st.w, a: 1, col: color.dark },
      { off: -1.2, w: st.w * 0.65, a: 0.95, col: color.main },
      { off: 1, w: st.w * 0.3, a: 0.7, col: color.hi },
      { off: -2.5, w: 1.2, a: 0.6, col: color.main },
      { off: 2.8, w: 1, a: 0.5, col: color.dark },
    ];
    for (const p of passes) {
      g.strokeStyle = p.col;
      g.globalAlpha = p.a;
      g.lineWidth = p.w;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      let acc = 0;
      g.moveTo(pts[0][0] + p.off, pts[0][1]);
      for (let i = 1; i < pts.length && acc < drawLen; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        const segLen = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(2, Math.floor(segLen / 7));
        for (let k = 1; k <= steps; k++) {
          const t = k / steps;
          if (acc + segLen * t > drawLen) break;
          const jx = (r() - 0.5) * 2.4, jy = (r() - 0.5) * 2.4;
          g.lineTo(x0 + (x1 - x0) * t + p.off + jx, y0 + (y1 - y0) * t + jy);
        }
        acc += segLen;
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  draw(n, progress = 1, flash = 0, alpha = 1) {
    const g = this.g;
    const strokes = this.strokesFor(n);
    const color = flash > 0.5
      ? { dark: '#6e5a50', main: '#e8dcd0', hi: '#ffffff' }
      : { dark: '#3a0303', main: '#9c0e0b', hi: '#d8331f' };
    g.save();
    g.globalAlpha = alpha;
    const per = 1 / Math.max(1, strokes.length);
    strokes.forEach((st, i) => {
      const p = Math.max(0, Math.min(1, (progress - i * per) / per));
      if (p > 0) this.drawStroke(g, st, p, color);
    });
    g.restore();
  }

  update(dt) {
    this.t += dt;
    const g = this.g;
    const c = this.canvas;
    g.clearRect(0, 0, c.width, c.height);
    g.save();
    g.scale(c.width / 360, c.height / 150);
    if (this.anim) {
      const a = this.anim;
      a.t += dt;
      if (a.t < 1.4 && a.from > 0) {
        // old number flashes white and fades
        const flash = Math.floor(a.t * 6) % 2;
        this.draw(a.from, 1, flash, Math.max(0, 1 - a.t / 1.4));
      } else {
        const t = a.from > 0 ? a.t - 1.4 : a.t;
        this.draw(a.to, Math.min(1, t / 1.2), 0, 1);
        if (t > 1.2) this.anim = null;
      }
    } else if (this.round > 0) {
      const flash = this.blink ? Math.floor(this.t * 2.5) % 2 : 0;
      this.draw(this.round, 1, flash, 1);
    }
    g.restore();
  }
}
