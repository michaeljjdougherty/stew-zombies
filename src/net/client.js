// =============================================================================
// A friend's side of an online game. Their GameSim is a copy (sim.replica):
// it moves and shoots their own player right away, so controls feel local,
// and mirrors everything else from the host's updates. Zombies, projectiles
// and teammates are drawn a few frames in the past, smoothly between updates.
// =============================================================================
import { updatePlayer } from '../sim/player.js';
import { applyPatch, applyMirror, positionFrame, clean } from './state.js';

const lerp = (a, b, k) => a + (b - a) * k;
function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

export class NetClient {
  constructor(sim, localId, send, { every = 2, delay = 6 } = {}) {
    sim.replica = true;
    this.sim = sim;
    this.localId = localId;
    this.me = sim.playerById(localId);
    this.me.invRev = 0; this.me.tp = 0;
    this.send = send;
    this.every = every;
    this.delay = delay;          // ticks behind the host that others are drawn
    this.mirror = null;
    this.frames = [];
    this.inbox = [];
    this.est = null;             // the host's tick, as best we can tell
    this.ticks = 0;
    this.usePressed = false;
    this.act = [];
    this.ev = [];
  }

  get started() { return !!this.mirror; }

  onMessage(msg) { if (msg.t === 's') this.inbox.push(msg); }

  // One 60 Hz step. Returns the events to show/play this frame.
  tick(cmd, dt) {
    const sim = this.sim;
    this.ticks++;
    if (this.est != null) this.est++;
    const out = [];
    let fresh = false;
    for (const m of this.inbox) {
      if (m.p.$full || !this.mirror) { delete m.p.$full; this.mirror = {}; this.frames.length = 0; }
      applyPatch(this.mirror, m.p);
      this.frames.push(positionFrame(this.mirror, this.localId));
      if (this.frames.length > 40) this.frames.shift();
      if (this.est == null || Math.abs(m.tick - this.est) > 20) this.est = m.tick;
      else this.est += (m.tick - this.est) * 0.1;
      for (const e of m.ev) if (!(e.echo && e.playerId === this.localId)) out.push(e);
      fresh = true;
    }
    this.inbox.length = 0;
    if (!this.mirror) return out;
    if (fresh) applyMirror(sim, this.mirror, this.localId);
    this.interpolate();
    sim.time = this.mirror.time + (this.est - this.mirror.tick) * dt;

    // you
    const me = this.me;
    if (sim.netTeleport) { cmd = { ...cmd, yaw: sim.netTeleport.yaw ?? cmd.yaw }; }
    sim.setInput(me.id, cmd);
    updatePlayer(sim, me, cmd, dt);
    me.region = sim.nav.regionAt(me.pos, me.region);
    const mine = sim.drainEvents();
    for (const e of mine) out.push(e);

    // tell the host
    for (const a of sim.netOut) this.act.push(a);
    sim.netOut.length = 0;
    for (const e of mine) this.ev.push(e);
    if (cmd.usePressed) this.usePressed = true;
    if (this.ticks % this.every === 0) {
      this.send({ t: 'c', st: this.report(), use: !!cmd.use, usePressed: this.usePressed, act: clean(this.act), ev: clean(this.ev) });
      this.act = []; this.ev = []; this.usePressed = false;
    }
    return out;
  }

  report() {
    const p = this.me, w = p.loadout;
    return clean({
      pos: p.pos, vel: p.vel, yaw: p.yaw, pitch: p.pitch,
      cr: p.crouching, sp: p.sprinting, gr: p.grounded, ms: p.moveSpeed, h: p.height, sta: p.stamina,
      th: p.throwing, mt: p.melee.timer, ml: p.melee.lunge, dw: p.distanceWalked,
      ads: w.adsAmount, rl: w.reloading,
      inv: p.invRev, cur: w.current, slots: w.slots.map((s) => ({ id: s.id, clip: s.clip, clipL: s.clipL || 0, reserve: s.reserve })),
      g: p.grenades, sb: p.stewBombs,
    });
  }

  // Put zombies, projectiles and teammates where they were `delay` ticks ago.
  interpolate() {
    const F = this.frames;
    if (!F.length) return;
    const rt = this.est - this.delay;
    let a = null, b = null;
    for (const f of F) { if (f.tick <= rt) a = f; else { b = f; break; } }
    if (!a) a = b; if (!b) b = a;
    const k = b.tick > a.tick ? Math.min(1, Math.max(0, (rt - a.tick) / (b.tick - a.tick))) : 0;
    const place = (obj, key, pitch) => {
      let pa = a.e.get(key), pb = b.e.get(key);
      if (!pa && !pb) return;         // newer than anything we're drawing yet: leave it where it spawned
      if (!pa) pa = pb; if (!pb) pb = pa;
      obj.pos.x = lerp(pa[0], pb[0], k); obj.pos.y = lerp(pa[1], pb[1], k); obj.pos.z = lerp(pa[2], pb[2], k);
      if (obj.yaw !== undefined) obj.yaw = lerpAngle(pa[3], pb[3], k);
      if (pitch) obj.pitch = lerp(pa[4], pb[4], k);
    };
    for (const z of this.sim.zombies) place(z, 'z' + z.id, false);
    for (const p of this.sim.projectiles) place(p, 'j' + p.id, false);
    for (const p of this.sim.players) if (p.id !== this.localId) place(p, 'p' + p.id, true);
  }
}
