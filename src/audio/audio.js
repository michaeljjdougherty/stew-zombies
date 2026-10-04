// =============================================================================
// Audio engine: Web Audio graph, 3D positional sources, generated reverb.
// All sounds are synthesized in code (see sfx.js). No audio files needed.
// =============================================================================

export class AudioEngine {
  constructor(cfg) {
    this.cfg = cfg;
    this.ctx = null;
    this.ready = false;
    this.tracked = new Map(); // id -> { panner, getPos, until }
    this.volumes = { master: cfg.audio.master, sfx: cfg.audio.sfx, ambient: cfg.audio.ambient, music: cfg.audio.music, voice: cfg.audio.voice ?? 1 };
  }

  // Must be called from a user gesture (click).
  init() {
    if (this.ctx) { this.ensureRunning(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.active = 0;
    this.buildGraph();
    // shared noise buffers
    this.noise = { white: this.makeNoise('white'), pink: this.makeNoise('pink'), brown: this.makeNoise('brown') };
    // distortion curves
    this.curves = {};
    this.applyVolumes();
    this.ready = true;
    this.decodePending();
    // browsers pause audio when the tab or the device sleeps; pick it back up
    const wake = () => this.ensureRunning();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    this.ctx.addEventListener && this.ctx.addEventListener('statechange', () => { if (this.ctx.state !== 'running' && !document.hidden) setTimeout(wake, 200); });
    this.watch = setInterval(() => this.checkHealth(), 2000);
  }

  // Keep the context running (after a tab switch, sleep, headphones change...).
  ensureRunning() {
    if (!this.ctx) return;
    if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {});
  }

  // If a bad value ever poisons the mix (NaN in a filter), every sound after it
  // is silent. Spot that and rebuild the output chain.
  checkHealth() {
    if (!this.ctx || !this.probe) return;
    this.ensureRunning();
    const buf = this.probeBuf || (this.probeBuf = new Float32Array(this.probe.fftSize));
    this.probe.getFloatTimeDomainData(buf);
    for (let i = 0; i < buf.length; i += 8) {
      if (!Number.isFinite(buf[i])) { console.warn('audio: the mix went bad, rebuilding it'); this.buildGraph(); this.applyVolumes(); return; }
    }
  }

  buildGraph() {
    const ctx = this.ctx;
    for (const n of [this.comp, this.master, this.reverb, this.reverbOut, this.probe, ...Object.values(this.buses || {})]) { try { n && n.disconnect(); } catch { /* gone */ } }
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 12; this.comp.ratio.value = 5;
    this.comp.attack.value = 0.003; this.comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.connect(this.comp);
    this.comp.connect(ctx.destination);

    this.buses = {};
    for (const k of ['sfx', 'ambient', 'music', 'voice']) {
      const g = ctx.createGain();
      g.connect(this.master);
      this.buses[k] = g;
    }

    // reverb (big gym)
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(this.cfg.audio.reverbSeconds, 2.6);
    this.reverbOut = ctx.createGain();
    this.reverbOut.gain.value = 0.9;
    this.reverb.connect(this.reverbOut);
    this.reverbOut.connect(this.master);
    this.probe = ctx.createAnalyser();
    this.probe.fftSize = 256;
    this.comp.connect(this.probe);
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.buses.sfx.gain.value = this.volumes.sfx;
    this.buses.ambient.gain.value = this.volumes.ambient;
    this.buses.music.gain.value = this.volumes.music;
    this.buses.voice.gain.value = this.volumes.voice;
    this.duck = 1;
  }

  setVolume(k, v) { this.volumes[k] = v; this.applyVolumes(); }

  // --- recorded samples -------------------------------------------------------
  // Start downloading right away (no AudioContext needed); decode once the
  // context exists. manifest: { key: [fileName, ...] }
  preload(manifest, base, ext = '.mp3') {
    this.samples = this.samples || {};
    this.pending = this.pending || [];
    for (const [key, files] of Object.entries(manifest)) {
      for (const f of files) {
        const job = { key, data: null };
        this.pending.push(job);
        fetch(base + f + ext).then((r) => (r.ok ? r.arrayBuffer() : null)).then((ab) => { job.data = ab; this.decodePending(); }).catch(() => { job.failed = true; });
      }
    }
  }

  decodePending() {
    if (!this.ctx || !this.pending) return;
    for (const job of this.pending) {
      if (!job.data || job.decoding) continue;
      job.decoding = true;
      const ab = job.data; job.data = null;
      this.ctx.decodeAudioData(ab).then((buf) => { (this.samples[job.key] ||= []).push(buf); }).catch(() => { job.failed = true; });
    }
  }

  hasSample(key) { return !!(this.samples && this.samples[key] && this.samples[key].length); }

  pickSample(key) {
    const list = this.samples && this.samples[key];
    if (!list || !list.length) return null;
    // avoid the same variant twice in a row
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && list[i] === this.lastSample?.[key]) i = (i + 1) % list.length;
    (this.lastSample ||= {})[key] = list[i];
    return list[i];
  }

  makeNoise(color) {
    const ctx = this.ctx, len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'white') d[i] = w;
      else if (color === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
      } else {
        last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5;
      }
    }
    return buf;
  }

  makeImpulse(seconds, decay) {
    const ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (t < 0.002 ? 0 : 1);
      }
      // sparse early reflections off the gym walls
      for (let k = 0; k < 14; k++) {
        const at = Math.floor(rate * (0.01 + Math.random() * 0.09));
        d[at] += (Math.random() * 2 - 1) * 0.8;
      }
    }
    return buf;
  }

  curve(amount) {
    const key = Math.round(amount * 100);
    if (this.curves[key]) return this.curves[key];
    const n = 1024, c = new Float32Array(n), k = amount * 100;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return (this.curves[key] = c);
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  // Listener follows the camera.
  updateListener(cam) {
    if (!this.ready) return;
    const l = this.ctx.listener;
    const p = cam.position;
    const f = { x: 0, y: 0, z: -1 }, u = { x: 0, y: 1, z: 0 };
    const q = cam.quaternion;
    const fw = rotate(f, q), up = rotate(u, q);
    const t = this.ctx.currentTime;
    if (![p.x, p.y, p.z, fw.x, fw.y, fw.z, up.x, up.y, up.z].every(Number.isFinite)) return;
    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, t, 0.01); l.positionY.setTargetAtTime(p.y, t, 0.01); l.positionZ.setTargetAtTime(p.z, t, 0.01);
      l.forwardX.setTargetAtTime(fw.x, t, 0.01); l.forwardY.setTargetAtTime(fw.y, t, 0.01); l.forwardZ.setTargetAtTime(fw.z, t, 0.01);
      l.upX.setTargetAtTime(up.x, t, 0.01); l.upY.setTargetAtTime(up.y, t, 0.01); l.upZ.setTargetAtTime(up.z, t, 0.01);
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(fw.x, fw.y, fw.z, up.x, up.y, up.z);
    }
    this.listenerPos = { x: p.x, y: p.y, z: p.z };

    // move tracked sources (e.g. a groaning zombie walking)
    for (const [id, tr] of this.tracked) {
      if (t > tr.until) { this.tracked.delete(id); continue; }
      const pos = tr.getPos();
      if (!pos) continue;
      setPannerPos(tr.panner, pos, t);
    }
  }

  // Output chain for a sound. pos = world position or null for 2D.
  output({ pos = null, bus = 'sfx', reverb = this.cfg.audio.reverbSend, gain = 1, ref = this.cfg.audio.refDistance, rolloff = this.cfg.audio.rolloff } = {}) {
    const ctx = this.ctx;
    const input = ctx.createGain();
    input.gain.value = Number.isFinite(gain) ? gain : 1;
    let panner = null;
    let send = Number.isFinite(reverb) ? reverb : 0;
    if (pos && !(Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z))) pos = null;
    if (pos) {
      panner = ctx.createPanner();
      // (HRTF sounds nicer but costs a lot per sound; with a horde and a few
      // guns going it overloads the audio thread and the sound breaks up)
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = ref;
      panner.rolloffFactor = rolloff;
      panner.maxDistance = this.cfg.audio.maxDistance;
      setPannerPos(panner, pos, ctx.currentTime, true);
      input.connect(panner);
      panner.connect(this.buses[bus]);
      // farther sounds are wetter: they "echo" in big rooms
      if (this.listenerPos) {
        const d = Math.hypot(pos.x - this.listenerPos.x, pos.y - this.listenerPos.y, pos.z - this.listenerPos.z);
        send = reverb * (0.6 + Math.min(2.2, d / 10));
      }
    } else {
      input.connect(this.buses[bus]);
    }
    send *= this.roomReverb ?? 1;
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      input.connect(s);
      s.connect(this.reverb);
    }
    return { input, panner };
  }

  // Play a synthesized recipe. recipe(A, destNode, startTime, params) -> duration (s)
  play(recipe, params = {}, opts = {}) {
    if (!this.ready) return null;
    // too much going on: drop far-off sounds first, then anything but your own
    const cap = this.cfg.audio.maxVoices ?? 64;
    if (this.active >= cap) {
      if (opts.pos || this.active >= cap * 1.5) return null;
    } else if (this.active >= cap * 0.7 && opts.pos && this.listenerPos) {
      const d = Math.hypot(opts.pos.x - this.listenerPos.x, opts.pos.z - this.listenerPos.z);
      if (d > 14) return null;
    }
    let out;
    try { out = this.output(opts); } catch (err) { console.warn('audio output', err); return null; }
    this.active++;
    const t = this.ctx.currentTime + (opts.delay || 0);
    let dur = 1;
    try { dur = recipe(this, out.input, t, params) || 1; } catch (err) { console.warn('sfx error', err); }
    if (!Number.isFinite(dur) || dur <= 0) dur = 1;
    setTimeout(() => { this.active = Math.max(0, this.active - 1); try { out.input.disconnect(); out.panner && out.panner.disconnect(); } catch (e) { /* already gone */ } }, (Math.min(dur, 60) + (opts.delay || 0) + 0.3) * 1000);
    if (opts.trackId != null && opts.getPos && out.panner) {
      this.tracked.set(opts.trackId, { panner: out.panner, getPos: opts.getPos, until: t + dur });
    }
    return out;
  }

  // --- small helpers used by recipes -----------------------------------------
  noiseSource(color = 'white', t = this.now(), dur = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise[color];
    src.loop = true;
    const off = Math.random() * 2;
    src.start(t, off);
    src.stop(t + dur + 0.05);
    return src;
  }

  osc(type, freq, t, dur) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  filter(type, freq, q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = Number.isFinite(freq) ? Math.min(Math.max(freq, 10), this.ctx.sampleRate * 0.45) : 1000;
    f.Q.value = Number.isFinite(q) ? q : 1;
    return f;
  }

  gain(v = 1) { const g = this.ctx.createGain(); g.gain.value = Number.isFinite(v) ? v : 0; return g; }

  // Percussive envelope on a gain node.
  env(g, t, attack, decay, peak = 1, sustain = 0, hold = 0) {
    const p = g.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + attack);
    if (hold > 0) p.setValueAtTime(peak, t + attack + hold);
    p.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + attack + hold + decay);
    if (sustain > 0) p.setValueAtTime(sustain, t + attack + hold + decay);
  }

  shaper(amount) {
    const s = this.ctx.createWaveShaper();
    s.curve = this.curve(amount);
    s.oversample = '2x';
    return s;
  }
}

function rotate(v, q) {
  // rotate vector v by quaternion q
  const ix = q.w * v.x + q.y * v.z - q.z * v.y;
  const iy = q.w * v.y + q.z * v.x - q.x * v.z;
  const iz = q.w * v.z + q.x * v.y - q.y * v.x;
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}

function setPannerPos(p, pos, t, immediate = false) {
  if (!(Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z))) return;
  if (p.positionX) {
    if (immediate) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else { p.positionX.setTargetAtTime(pos.x, t, 0.03); p.positionY.setTargetAtTime(pos.y, t, 0.03); p.positionZ.setTargetAtTime(pos.z, t, 0.03); }
  } else p.setPosition(pos.x, pos.y, pos.z);
}
