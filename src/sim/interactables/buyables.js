// =============================================================================
// Things you spend points on: doors/debris, wall weapons, the mystery box.
// Same interface as windows.js.
// =============================================================================
import { giveWeapon } from '../weapons.js';

function flatDist(p, pos) { return Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z); }

// Try to pay; tells the HUD if you can't.
function pay(sim, p, cost) {
  if (p.points < cost) { sim.emit('cantAfford', { playerId: p.id, cost }); return false; }
  sim.spendPoints(p, cost);
  return true;
}

// ---------------------------------------------------------------------------
export class DoorInteractable {
  constructor(door) {
    this.door = door;
    this.id = 'use_' + door.id;
    this.kind = door.kind;
    this.requireLook = true;
    this.pos = { x: door.center.x, y: 1.3, z: door.center.z };
  }
  get range() { return 2.1; }
  distanceTo(sim, p) {
    // distance to the doorway, measured across its width
    const d = this.door;
    // d.axis is the direction the wall runs; you stand off it along the other axis
    const across = d.axis === 'x' ? Math.abs(p.pos.x - d.center.x) : Math.abs(p.pos.z - d.center.z);
    const along = d.axis === 'x' ? Math.abs(p.pos.z - d.center.z) : Math.abs(p.pos.x - d.center.x);
    return Math.hypot(Math.max(0, across - d.width / 2), along);
  }
  cost(sim) { return sim.cfg.doors[this.door.id] ?? 1000; }
  canUse(sim, p) {
    return p.alive && !this.door.locked && !sim.doorOpen(this.door.id);
  }
  prompt(sim) {
    const c = this.cost(sim);
    return this.kind === 'debris'
      ? { text: `Press [F] to clear debris`, cost: c }
      : { text: `Press [F] to open door`, cost: c };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    if (pay(sim, p, this.cost(sim))) sim.openDoor(this.door.id, p);
  }
}

// ---------------------------------------------------------------------------
export class WallBuyInteractable {
  constructor(wb) {
    this.wb = wb;
    this.id = 'use_' + wb.id;
    this.kind = 'wallbuy';
    this.requireLook = true;
    this.pos = { x: wb.pos.x, y: wb.pos.y, z: wb.pos.z };
    this.stand = { x: wb.pos.x + wb.normal.x * 0.6, z: wb.pos.z + wb.normal.z * 0.6 };
  }
  get range() { return 1.6; }
  distanceTo(sim, p) { return flatDist(p, this.stand); }
  canUse(sim, p) { return p.alive; }
  // the base gun or its Mad Dog upgrade (not while it's inside the machine)
  owned(p) { return p.loadout.slots.find((s) => !s.away && (s.id === this.wb.weapon || s.id === this.wb.weapon + '+')) || null; }
  ammoCost(sim, s) { return s.id.endsWith('+') ? sim.cfg.madDog.ammoCost : sim.cfg.weapons[this.wb.weapon].ammoCost; }
  prompt(sim, p) {
    const eq = sim.cfg.equipment[this.wb.weapon];
    if (eq) {
      if (p.grenades >= eq.perPurchase) return { text: `${eq.name} are full`, cost: null };
      return { text: `Press [F] to buy ${eq.name}`, cost: eq.cost };
    }
    const def = sim.cfg.weapons[this.wb.weapon];
    const s = this.owned(p);
    if (s) {
      const sd = sim.cfg.weapons[s.id];
      if (s.clip >= sd.magSize && s.reserve >= sd.reserve) return { text: `${sd.name} ammo is full`, cost: null };
      return { text: `Press [F] for ${sd.upgraded ? 'upgraded ' : ''}${sd.name} ammo`, cost: this.ammoCost(sim, s) };
    }
    return { text: `Press [F] to buy ${def.name}`, cost: def.cost };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const eq = sim.cfg.equipment[this.wb.weapon];
    if (eq) {
      if (p.grenades >= eq.perPurchase) return;
      if (pay(sim, p, eq.cost)) {
        p.grenades = eq.perPurchase;
        p.grenadeMax = Math.max(p.grenadeMax, eq.perPurchase);
        sim.emit('wallBuy', { playerId: p.id, weapon: this.wb.weapon, equipment: true, id: this.wb.id });
      }
      return;
    }
    const def = sim.cfg.weapons[this.wb.weapon];
    const s = this.owned(p);
    if (s) {
      const sd = sim.cfg.weapons[s.id];
      if (s.clip >= sd.magSize && s.reserve >= sd.reserve) return;
      if (pay(sim, p, this.ammoCost(sim, s))) { giveWeapon(sim, p, s.id); sim.emit('wallBuy', { playerId: p.id, weapon: s.id, ammo: true, id: this.wb.id }); }
    } else if (pay(sim, p, def.cost)) {
      giveWeapon(sim, p, this.wb.weapon);
      sim.emit('wallBuy', { playerId: p.id, weapon: this.wb.weapon, ammo: false, id: this.wb.id });
    }
  }
}

// ---------------------------------------------------------------------------
// Mystery box: pay, it spins, lands on a weapon, the buyer takes it (or loses it).
export class BoxInteractable {
  constructor(sim) {
    this.id = 'use_box';
    this.kind = 'box';
    this.requireLook = true;
    const spots = sim.world.boxSpots;
    this.spot = spots.find((s) => s.start) || spots[0];
    this.phase = 'idle';   // idle | spinning | offering | closing
    this.timer = 0;
    this.weapon = null;
    this.buyerId = null;
    this.uses = 0;
    this.place();
  }
  place() {
    const s = this.spot;
    this.facing = { x: Math.sin(s.yaw), z: Math.cos(s.yaw) };
    this.pos = { x: s.x, y: 0.8, z: s.z };
    this.stand = { x: s.x + this.facing.x * 1.0, z: s.z + this.facing.z * 1.0 };
  }
  get range() { return 1.5; }
  distanceTo(sim, p) { return flatDist(p, this.stand); }
  canUse(sim, p) {
    if (!p.alive || p.drinking) return false;
    if (this.phase === 'idle') return true;
    return this.phase === 'offering' && p.id === this.buyerId;
  }
  prompt(sim) {
    if (this.phase === 'offering') return { text: `Press [F] to take ${sim.cfg.weapons[this.weapon].name}`, cost: null };
    return { text: 'Press [F] for the Mystery Box', cost: sim.cfg.box.cost };
  }
  pick(sim, p) {
    const w = sim.cfg.box.weights;
    const held = new Set(p.loadout.slots.map((s) => s.id.replace(/\+$/, '')));
    const pool = Object.entries(w).filter(([id]) => sim.cfg.weapons[id] && !held.has(id));
    const total = pool.reduce((a, [, v]) => a + v, 0);
    let r = sim.rng.next() * total;
    for (const [id, v] of pool) { r -= v; if (r <= 0) return id; }
    return pool.length ? pool[pool.length - 1][0] : 'M15';
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    if (this.phase === 'idle') {
      if (!pay(sim, p, sim.cfg.box.cost)) return;
      this.phase = 'spinning';
      this.timer = sim.cfg.box.spinTime;
      this.buyerId = p.id;
      this.weapon = this.pick(sim, p);
      this.uses++;
      sim.emit('boxOpen', { playerId: p.id, spot: this.spot.id, weapon: this.weapon, spinTime: this.timer });
    } else if (this.phase === 'offering' && p.id === this.buyerId) {
      giveWeapon(sim, p, this.weapon);
      sim.emit('boxTaken', { playerId: p.id, weapon: this.weapon });
      this.phase = 'closing';
      this.timer = sim.cfg.box.closeTime;
    }
  }
  update(sim, dt) {
    if (this.phase === 'idle') return;
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.phase === 'spinning') {
      this.phase = 'offering';
      this.timer = sim.cfg.box.offerTime;
      sim.emit('boxLanded', { weapon: this.weapon, playerId: this.buyerId });
    } else if (this.phase === 'offering') {
      this.phase = 'closing';
      this.timer = sim.cfg.box.closeTime;
      sim.emit('boxExpired', { weapon: this.weapon });
    } else if (this.phase === 'closing') {
      this.phase = 'idle';
      this.weapon = null;
      this.buyerId = null;
      sim.emit('boxClosed', {});
    }
  }
}
