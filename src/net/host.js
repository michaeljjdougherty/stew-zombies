// =============================================================================
// The host's side of an online game. The host's browser runs the real GameSim.
// Each friend's browser moves their own player and fires their own guns, and
// every few frames reports where they are, what they hit, what they threw and
// what sounds they made (NetClient). The host applies that, runs everything
// else (zombies, buying, perks, points, Erik), and sends everyone the changes.
// =============================================================================
import { emptyCommand } from '../sim/player.js';
import { damageZombie } from '../sim/zombies.js';
import { spawnProjectile, explode } from '../sim/projectiles.js';
import { questShot } from '../sim/quest.js';
import { worldState, diff, inventorySig } from './state.js';

export class NetHost {
  // send(peerId|null, msg): null = everyone
  constructor(sim, send, { every = 2 } = {}) {
    this.sim = sim;
    this.send = send;
    this.every = every;          // ticks between updates (2 = 30 a second)
    this.peers = new Map();      // peerId -> { playerId, inbox, use, usePressed, sig }
    this.last = {};
    this.events = [];
    this.ticks = 0;
  }

  addRemote(peerId, playerId) {
    const p = this.sim.playerById(playerId);
    p.remote = true; p.invRev = 0; p.tp = 0;
    this.peers.set(peerId, { playerId, inbox: [], use: false, usePressed: false, sig: '' });
  }

  removeRemote(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return null;
    this.peers.delete(peerId);
    return peer.playerId;
  }

  onMessage(peerId, msg) {
    const peer = this.peers.get(peerId);
    if (peer && msg.t === 'c') peer.inbox.push(msg);
  }

  // Before the host's sim.step: take in what each friend sent.
  preStep() {
    const sim = this.sim;
    for (const peer of this.peers.values()) {
      const p = sim.playerById(peer.playerId);
      if (!p) continue;
      if (peer.sigPost !== undefined && inventorySig(p) !== peer.sigPost) p.invRev++;   // changed between steps
      for (const m of peer.inbox) {
        if (m.st) this.applyReport(p, m.st);
        for (const a of m.act || []) this.applyAction(p, a);
        for (const e of m.ev || []) {
          const { type, t, ...rest } = e;
          sim.emit(type, { ...rest, playerId: p.id, echo: true });
        }
        peer.use = !!m.use;
        if (m.usePressed) peer.usePressed = true;
      }
      peer.inbox.length = 0;
      sim.setInput(p.id, { ...emptyCommand(), yaw: p.yaw, pitch: p.pitch, use: peer.use, usePressed: peer.usePressed });
      peer.usePressed = false;
      peer.sig = inventorySig(p);
    }
  }

  // After sim.step (events = what the step emitted).
  postStep(events) {
    const sim = this.sim;
    for (const e of events) this.events.push(e);
    // the host gave someone a gun, ammo, a pistol to go down with...
    for (const peer of this.peers.values()) {
      const p = sim.playerById(peer.playerId);
      if (!p) continue;
      const sig = inventorySig(p);
      if (sig !== peer.sig) p.invRev++;
      peer.sigPost = sig;
    }
    if (++this.ticks % this.every === 0) this.flush();
  }

  flush() {
    const S = worldState(this.sim);
    const patch = diff(this.last, S) || {};
    this.last = S;
    this.send(null, { t: 's', tick: this.sim.tick, p: patch, ev: this.events });
    this.events = [];
  }

  // Someone new (or reconnecting) needs the whole picture, not the changes.
  fullState() { return { t: 's', tick: this.sim.tick, p: { $full: true, ...this.last }, ev: [] }; }

  applyReport(p, st) {
    const sim = this.sim;
    Object.assign(p.pos, st.pos);
    Object.assign(p.vel, st.vel);
    p.yaw = st.yaw; p.pitch = st.pitch;
    p.crouching = st.cr; p.sprinting = st.sp; p.grounded = st.gr;
    p.moveSpeed = st.ms; p.height = st.h; p.stamina = st.sta;
    p.throwing = st.th; p.melee.timer = st.mt; p.melee.lunge = st.ml;
    p.distanceWalked = st.dw;
    const w = p.loadout;
    w.adsAmount = st.ads; w.reloading = st.rl;
    // what's in their guns, unless the host changed their guns since they last heard
    if (st.inv === p.invRev && st.slots.length === w.slots.length && st.slots.every((s, i) => s.id === w.slots[i].id)) {
      st.slots.forEach((s, i) => { const sl = w.slots[i]; sl.clip = s.clip; sl.clipL = s.clipL; sl.reserve = s.reserve; });
      w.current = Math.min(st.cur, w.slots.length - 1);
      p.grenades = st.g; p.stewBombs = st.sb;
    }
    p.region = sim.nav.regionAt(p.pos, p.region);
  }

  applyAction(p, a) {
    const sim = this.sim;
    if (!p.alive) return;
    switch (a.k) {
      case 'hit': {
        const z = sim.zombieById(a.zid);
        if (z) damageZombie(sim, z, a.dmg, { ...a.info, playerId: p.id });
        break;
      }
      case 'proj': spawnProjectile(sim, a.type, a.pos, a.vel, p.id, a.opts || {}); break;
      case 'boom': explode(sim, a.pos, a.kind, p.id); break;
      case 'quest': questShot(sim, a.id, p); break;
    }
  }
}
