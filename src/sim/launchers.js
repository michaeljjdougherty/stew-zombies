// =============================================================================
// Launchers (Call of the Crust): stand on the pad, press F, and you're flung
// in a long arc across the frozen sea to the pad on the other side. The hub
// has one on each of its four decks; each island has one back. Nothing can
// touch you in the air.
// =============================================================================

import { islandAt } from './crustPower.js';

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// the Anvil's launchers are dead until its power's on (src/sim/crustPower.js)
function dead(sim, pad) {
  const P = sim.crustEgg && sim.crustEgg.power;
  if (!P || !sim.cfg.crust.power.launchersNeedPower) return false;
  const isl = islandAt(sim, pad);
  return isl === 'hub' && !P.on.hub;
}

// a titan's awake on this pad's island: its launcher's locked down till it's
// beaten (no flying off mid-fight). Returns the titan, or null.
function lockedBy(sim, pad) {
  const E = sim.crustEgg;
  if (!E || !E.active || !sim.cfg.crust.launch.lockInFight) return null;
  const T = E.titans[E.active];
  if (!T || (T.state !== 'waking' && T.state !== 'fight')) return null;
  return islandAt(sim, pad) === T.id ? T : null;
}

export class LaunchInteractable {
  constructor(pad, target) {
    this.pad = pad;
    this.target = target;
    this.id = 'use_' + pad.id;
    this.kind = 'launcher';
    this.requireLook = false;
    this.pos = { x: pad.x, y: (pad.y || 0) + 0.4, z: pad.z };
  }
  get range() { return this.cfgRange ?? 2.2; }
  distanceTo(sim, p) { this.cfgRange = sim.cfg.crust.launch.range; return flat(p.pos, this.pos); }
  canUse(sim, p) { return p.alive && !p.downed && !p.launch && !p.drinking; }
  cost(sim) { return sim.mode === 'explore' ? 0 : sim.cfg.crust.launch.cost; }
  prompt(sim, p) {
    if (dead(sim, this.pad)) {
      const r = sim.mapData.relays.find((q) => q.pad === this.pad.id), st = r && sim.crustEgg.power.relays[r.id].state;
      return { text: 'The launcher\'s dead', cost: null, sub: st === 'blown' ? 'Its relay\'s burnt out · pull it from the box beside the pad, take it to Pit' : 'Pit has to fix the relays' };
    }
    const T = lockedBy(sim, this.pad);
    if (T) return { text: 'The launcher\'s locked down', cost: null, sub: `${T.name} is awake · no way off till it's down` };
    const wait = (p.launchReady || 0) - sim.time;
    if (wait > 0) return { text: `The launcher's recharging · ${Math.ceil(wait)}s`, cost: null };
    return { text: `Press [F] to launch to ${this.pad.label}`, cost: this.cost(sim) || null };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    if (dead(sim, this.pad) || lockedBy(sim, this.pad) || sim.time < (p.launchReady || 0)) { sim.emit('useDenied', { playerId: p.id }); return; }
    const c = this.cost(sim);
    if (c) {
      if (p.points < c) { sim.emit('cantAfford', { playerId: p.id, cost: c }); return; }
      sim.spendPoints(p, c);
    }
    startLaunch(sim, p, this.pad, this.target);
  }
}

export function startLaunch(sim, p, from, to) {
  const L = sim.cfg.crust.launch;
  if (p.loadout && p.loadout.reloading) sim.cancelReload(p);
  p.launch = {
    from: { x: p.pos.x, y: p.pos.y, z: p.pos.z },
    to: { x: to.x, y: to.y || 0, z: to.z },
    t: 0, time: L.time, apex: L.apex,
    toId: to.id,
  };
  p.launchRev = (p.launchRev || 0) + 1;   // (online: tells a friend's browser to fly them)
  p.sprinting = false;
  sim.emit('playerLaunch', { playerId: p.id, from: { x: from.x, z: from.z }, to: { x: to.x, z: to.z }, time: L.time });
}

// One tick in the air: along the arc, no collision, nothing else.
export function updateLaunch(sim, p, dt) {
  const L = p.launch;
  L.t += dt;
  const u = Math.min(1, L.t / L.time);
  // ease the horizontal a little (a hard shove off the pad, a slow drift down)
  const e = 1 - Math.pow(1 - u, 1.6);
  const x = L.from.x + (L.to.x - L.from.x) * e;
  const z = L.from.z + (L.to.z - L.from.z) * e;
  const y = L.from.y + (L.to.y - L.from.y) * u + L.apex * 4 * u * (1 - u);
  p.vel.x = (x - p.pos.x) / dt; p.vel.y = (y - p.pos.y) / dt; p.vel.z = (z - p.pos.z) / dt;
  p.pos.x = x; p.pos.y = y; p.pos.z = z;
  p.grounded = false;
  p.moveSpeed = 0;
  if (u >= 1) {
    p.pos.x = L.to.x; p.pos.y = L.to.y; p.pos.z = L.to.z;
    p.vel.x = p.vel.y = p.vel.z = 0;
    p.grounded = true;
    p.launch = null;
    p.launchReady = sim.time + (sim.mode === 'explore' ? sim.cfg.crust.launch.exploreCooldown : sim.cfg.crust.launch.cooldown);
    p.region = sim.nav.regionAt(p.pos, null);
    sim.emit('playerLaunchLand', { playerId: p.id, pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z } });
  }
}

// =============================================================================
// Front doors (Bikini Bottom): stand at SpongeBob's door or the Krusty Krab's,
// press F, and you're inside (the insides are far off the map, out of sight);
// the door inside takes you back out. map.teleporters: { id, x, y, z, label,
// to: { x, y, z, yaw } }.
// =============================================================================
export class DoorTeleportInteractable {
  constructor(door) {
    this.door = door;
    this.id = 'use_' + door.id;
    this.kind = 'doorway';
    this.requireLook = false;
    this.pos = { x: door.x, y: (door.y || 0) + 1, z: door.z };
  }
  get range() { return this.cfgRange ?? 1.6; }
  distanceTo(sim, p) { this.cfgRange = sim.cfg.bikiniBottom.doorRange; return flat(p.pos, this.pos); }
  canUse(sim, p) { return p.alive && !p.downed && !p.launch && !p.drinking; }
  cost() { return 0; }
  prompt() { return { text: this.door.label, cost: null }; }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    if (p.loadout && p.loadout.reloading) sim.cancelReload(p);
    const to = this.door.to;
    p.pos.x = to.x; p.pos.y = to.y || 0; p.pos.z = to.z;
    p.vel.x = p.vel.y = p.vel.z = 0;
    p.yaw = to.yaw;
    p.region = sim.nav.regionAt(p.pos);
    p.tp = (p.tp || 0) + 1;   // (online: the host moved you)
    sim.emit('doorTeleport', { playerId: p.id, door: this.door.id, pos: { ...p.pos } });
    // (your own view turns to face the way in; a friend's turns with the move online)
    if (!p.remote) sim.netTeleport = { yaw: to.yaw };
  }
}
