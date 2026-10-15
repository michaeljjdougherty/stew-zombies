// =============================================================================
// The trailer's song, and the trailer's clock. The song is decoded whole and
// played straight to the speakers through Web Audio (none of the game's mix in
// the way), and the picture follows *it*: the trailer's time is how far into
// the song the speakers are. A slow frame then just shows a later moment; the
// song never stops, skips or gets pulled back to meet the picture.
// =============================================================================
export class TrailerSong {
  constructor(ctx, url) {
    this.ctx = ctx;
    this.buffer = null;
    this.failed = false;
    this.src = null;
    this.startedAt = 0;
    this.out = ctx.createGain();
    this.out.connect(ctx.destination);
    this.ready = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('no song'))))
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buf) => { this.buffer = buf; return true; })
      .catch(() => { this.failed = true; return false; });
  }

  get loaded() { return !!this.buffer; }
  get playing() { return !!this.src; }

  // play from `offset` s into the song
  play(offset = 0) {
    if (!this.buffer) return;
    this.stopSource();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const s = this.ctx.createBufferSource();
    s.buffer = this.buffer;
    s.connect(this.out);
    const at = this.ctx.currentTime + 0.05;
    s.start(at, Math.max(0, offset));
    this.startedAt = at - Math.max(0, offset);
    this.src = s;
  }

  // how far into the song the speakers are (s), or null if it isn't playing
  time() {
    if (!this.src) return null;
    const lat = this.ctx.outputLatency || this.ctx.baseLatency || 0;
    return Math.max(0, this.ctx.currentTime - lat - this.startedAt);
  }

  setVolume(v) { this.out.gain.setTargetAtTime(Math.max(0, v), this.ctx.currentTime, 0.05); }

  stopSource() { if (this.src) { try { this.src.stop(); } catch { /* done */ } this.src.disconnect(); this.src = null; } }

  stop() { this.stopSource(); this.out.disconnect(); }
}
