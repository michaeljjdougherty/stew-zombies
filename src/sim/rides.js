// =============================================================================
// Rides (Call of the Crust): ziplines and ice slides. A zipline you grab with
// [F] at the top and hang from all the way down; an ice slide takes you as
// soon as you step into its mouth. Either way your hands are free: shoot as
// you go. Jump to let go. Players only (zombies go round).
// =============================================================================

// The map's rides with their lengths worked out.
export function createRides(map) {
  return (map.rides || []).map((r) => {
    const pts = r.pts.map(([x, y, z]) => ({ x, y, z }));
    const seg = [];
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      seg.push({ a, b, l, s0: len });
      len += l;
    }
    return { ...r, pts, seg, len };
  });
}

// Where along the ride, s metres in: the point and the direction of travel.
export function ridePoint(ride, s) {
  s = Math.max(0, Math.min(ride.len, s));
  let g = ride.seg[ride.seg.length - 1];
  for (const q of ride.seg) if (s <= q.s0 + q.l) { g = q; break; }
  const t = g.l ? (s - g.s0) / g.l : 0;
  const d = { x: (g.b.x - g.a.x) / (g.l || 1), y: (g.b.y - g.a.y) / (g.l || 1), z: (g.b.z - g.a.z) / (g.l || 1) };
  return { x: g.a.x + (g.b.x - g.a.x) * t, y: g.a.y + (g.b.y - g.a.y) * t, z: g.a.z + (g.b.z - g.a.z) * t, d };
}

// The top of a zipline: [F] to grab it.
export class ZiplineInteractable {
  constructor(ride, cfg) {
    this.ride = ride;
    this.id = 'use_' + ride.id;
    this.kind = 'zipline';
    this.requireLook = false;
    const hang = cfg.crust.ride.hang;
    const p = ride.pts[0];
    this.pos = { x: p.x, y: p.y - hang, z: p.z };
  }
  get range() { return 2.0; }
  distanceTo(sim, p) { return Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z); }
  canUse(sim, p) { return p.alive && !p.downed && !p.ride && !p.launch && !p.drinking && sim.time >= (p.rideReady || 0); }
  prompt() { return { text: `Press [F] to ride the zipline${this.ride.label ? ' to ' + this.ride.label : ''}`, cost: null }; }
  use(sim, p, cmd) { if (cmd.usePressed) startRide(sim, p, this.ride); }
}

export function startRide(sim, p, ride) {
  const c = sim.cfg.crust.ride;
  p.ride = { id: ride.id, ride, s: 0, speed: ride.kind === 'zip' ? c.zipStart : c.slideMin };
  p.sprinting = false;
  p.grounded = false;
  sim.emit('rideStart', { playerId: p.id, ride: ride.id, kind: ride.kind });
}

// An ice slide takes you when you step into its mouth.
export function checkSlides(sim, p) {
  if (p.launch || p.downed || sim.time < (p.rideReady || 0)) return;
  for (const r of sim.rides) {
    if (r.kind !== 'slide') continue;
    const a = r.pts[0];
    if (Math.abs(p.pos.y - a.y) < 0.9 && Math.hypot(p.pos.x - a.x, p.pos.z - a.z) < (r.mouth || 1.2)) { startRide(sim, p, r); return; }
  }
}

function letGo(sim, p, push, up) {
  const R = p.ride;
  const at = ridePoint(R.ride, R.s);
  p.vel.x = at.d.x * R.speed * push; p.vel.z = at.d.z * R.speed * push; p.vel.y = up;
  p.grounded = false;
  p.ride = null;
  p.rideReady = sim.time + 0.8;
  p.region = sim.nav.regionAt(p.pos, p.region);
  sim.emit('rideEnd', { playerId: p.id, ride: R.id });
}

// One tick on the ride.
export function updateRide(sim, p, cmd, dt) {
  const c = sim.cfg.crust.ride;
  const R = p.ride, ride = R.ride;
  if (p.downed || !p.alive) { letGo(sim, p, 0.3, 0); return; }
  if (cmd.jumpPressed) { letGo(sim, p, 0.8, ride.kind === 'zip' ? 0 : 4); return; }
  if (ride.kind === 'zip') R.speed = Math.min(c.zipSpeed, R.speed + c.zipAccel * dt);
  else {
    // faster down the steep bits, a touch of drag
    const d = ridePoint(ride, R.s).d;
    R.speed = Math.max(c.slideMin, Math.min(c.slideMax, R.speed + (-d.y * 9.8 - c.slideDrag) * dt));
  }
  R.s += R.speed * dt;
  const at = ridePoint(ride, R.s);
  const y = ride.kind === 'zip' ? at.y - c.hang : at.y;
  p.vel.x = (at.x - p.pos.x) / dt; p.vel.y = (y - p.pos.y) / dt; p.vel.z = (at.z - p.pos.z) / dt;
  p.pos.x = at.x; p.pos.y = y; p.pos.z = at.z;
  p.grounded = false;
  if (R.s >= ride.len - 0.01) {
    // off the end: onto the deck (a zipline) or shot out across the snow (a slide)
    letGo(sim, p, ride.kind === 'zip' ? 0.3 : 0.6, 0);
    if (ride.kind === 'zip') p.grounded = false;
  }
}
