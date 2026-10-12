// =============================================================================
// Launchers (Call of the Crust): stand on the pad, press F, and you're flung
// in a long arc across the frozen sea to the pad on the other side. The hub
// has one on each of its four decks; each island has one back. Nothing can
// touch you in the air.
// =============================================================================

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

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
  canUse(sim, p) { return p.alive && !p.downed && !p.launch && !p.drinking && sim.time >= (p.launchReady || 0); }
  cost(sim) { return sim.mode === 'explore' ? 0 : sim.cfg.crust.launch.cost; }
  prompt(sim, p) { return { text: `Press [F] to launch to ${this.pad.label}`, cost: this.cost(sim) || null }; }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
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
    p.launchReady = sim.time + sim.cfg.crust.launch.cooldown;
    p.region = sim.nav.regionAt(p.pos, null);
    sim.emit('playerLaunchLand', { playerId: p.id, pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z } });
  }
}
