// =============================================================================
// Power switch, perk machines, the Mad Dog Machine, electric traps and
// reviving a downed teammate. Same interface as windows.js.
// =============================================================================
import { hasPerk, perkCost, startDrinking } from '../perks.js';
import { reviveTimeFor, revive } from '../laststand.js';
import { cancelReload, giveWeapon } from '../weapons.js';
import { killZombie } from '../zombies.js';

function flatDist(p, pos) { return Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z); }
const up = (p) => p.alive && !p.downed;

function pay(sim, p, cost) {
  if (p.points < cost) { sim.emit('cantAfford', { playerId: p.id, cost }); return false; }
  sim.spendPoints(p, cost);
  return true;
}

// ---------------------------------------------------------------------------
export class PowerInteractable {
  constructor(sw) {
    this.sw = sw;
    this.id = 'use_power';
    this.kind = 'power';
    this.requireLook = true;
    this.pos = { x: sw.pos.x, y: sw.pos.y, z: sw.pos.z };
    this.stand = { x: sw.pos.x + sw.normal.x * 0.7, z: sw.pos.z + sw.normal.z * 0.7 };
  }
  get range() { return 1.6; }
  distanceTo(sim, p) { return flatDist(p, this.stand); }
  canUse(sim, p) { return up(p) && !sim.power; }
  prompt() { return { text: 'Press [F] to turn on the power', cost: null }; }
  use(sim, p, cmd) { if (cmd.usePressed) sim.turnOnPower(p); }
}

// ---------------------------------------------------------------------------
export class PerkInteractable {
  constructor(machine) {
    this.m = machine;
    this.id = 'use_' + machine.id;
    this.kind = 'perk';
    this.requireLook = true;
    this.pos = { x: machine.center.x, y: 1.3, z: machine.center.z };
    this.stand = machine.front;
  }
  get range() { return 1.5; }
  def(sim) { return sim.cfg.perks.list[this.m.perk]; }
  distanceTo(sim, p) { return flatDist(p, this.stand); }
  soloSoldOut(sim) {
    const d = this.def(sim);
    return sim.players.length === 1 && d.soloUses && (sim.perkBuys[this.m.perk] || 0) >= d.soloUses;
  }
  canUse(sim, p) { return up(p) && !p.drinking; }
  prompt(sim, p) {
    const d = this.def(sim);
    if (d.power && !sim.power) return { text: 'The power must be on', cost: null };
    if (this.soloSoldOut(sim)) return { text: `${d.name} is sold out`, cost: null };
    if (hasPerk(p, this.m.perk)) return { text: `You already have ${d.name}`, cost: null };
    if (p.perks.length >= sim.cfg.perks.limit) return { text: `You can only hold ${sim.cfg.perks.limit} perks`, cost: null };
    return { text: `Press [F] to buy ${d.name}`, cost: perkCost(sim, this.m.perk), sub: d.desc };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const d = this.def(sim);
    if ((d.power && !sim.power) || this.soloSoldOut(sim) || hasPerk(p, this.m.perk) || p.perks.length >= sim.cfg.perks.limit) {
      sim.emit('useDenied', { playerId: p.id });
      return;
    }
    if (!pay(sim, p, perkCost(sim, this.m.perk))) return;
    sim.perkBuys[this.m.perk] = (sim.perkBuys[this.m.perk] || 0) + 1;
    sim.emit('perkBought', { playerId: p.id, perk: this.m.perk, machine: this.m.id });
    startDrinking(sim, p, this.m.perk);
  }
}

// ---------------------------------------------------------------------------
// Mad Dog Machine: feed it a gun and 5000 points, it chews for a few seconds,
// and spits out the upgraded version. Only the owner can take it back.
export class MadDogInteractable {
  constructor(sim, md) {
    this.md = md;
    this.id = 'use_maddog';
    this.kind = 'maddog';
    this.requireLook = true;
    const fx = Math.sin(md.yaw), fz = Math.cos(md.yaw);
    this.pos = { x: md.x, y: md.y + 1.2, z: md.z };
    this.stand = { x: md.x + fx * 2.2, z: md.z + fz * 2.2 };
    this.state = 'idle';   // idle | working | ready
    this.timer = 0;
    this.ownerId = null;
    this.weapon = null;    // base id that went in
    this.slotRef = null;
  }
  get range() { return 1.7; }
  distanceTo(sim, p) { return flatDist(p, this.stand); }
  canUse(sim, p) {
    if (!up(p) || p.drinking) return false;
    // on the school it's under the gym floor until the trophy is put back together
    if (this.md.hidden && !(sim.quest && sim.quest.madDogRevealed)) return false;
    if (this.state === 'idle') return true;
    return true; // show "in use" / "take" prompts
  }
  prompt(sim, p) {
    if (!sim.power) return { text: 'The Mad Dog Machine needs power', cost: null };
    if (this.state === 'working') return { text: p.id === this.ownerId ? 'The Mad Dog is chewing on it...' : 'The Mad Dog is busy', cost: null };
    if (this.state === 'ready') {
      if (p.id !== this.ownerId) return { text: 'That one belongs to someone else', cost: null };
      return { text: `Press [F] to take ${sim.cfg.weapons[this.weapon + '+'].name}`, cost: null };
    }
    const slot = p.loadout.slots[p.loadout.current];
    if (!slot || slot.away) return { text: 'Hold a weapon to feed the Mad Dog', cost: null };
    const def = sim.cfg.weapons[slot.id];
    if (def.upgraded) return { text: `${def.name} is already upgraded`, cost: null };
    if (!sim.cfg.weapons[slot.id + '+']) return { text: 'The Mad Dog won\'t eat that', cost: null };
    return { text: `Press [F] to feed ${def.name} to the Mad Dog`, cost: sim.cfg.madDog.cost };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed || !sim.power) return;
    if (this.state === 'ready' && p.id === this.ownerId) { this.take(sim, p); return; }
    if (this.state !== 'idle') return;
    const w = p.loadout;
    const slot = w.slots[w.current];
    if (!slot || slot.away) return;
    const def = sim.cfg.weapons[slot.id];
    if (def.upgraded || !sim.cfg.weapons[slot.id + '+']) { sim.emit('useDenied', { playerId: p.id }); return; }
    if (!pay(sim, p, sim.cfg.madDog.cost)) return;
    if (w.reloading) cancelReload(sim, p);
    slot.away = true;
    this.state = 'working';
    this.timer = sim.cfg.madDog.workTime;
    this.ownerId = p.id;
    this.weapon = slot.id;
    this.slotRef = slot;
    w.adsAmount = 0;
    // switch to your other gun while this one is in the machine
    const other = w.slots.findIndex((s) => !s.away);
    if (other >= 0) {
      w.current = other;
      w.drawTimer = sim.cfg.weapons[w.slots[other].id].drawTime;
      sim.emit('weaponSwitch', { playerId: p.id, weapon: w.slots[other].id });
    }
    sim.emit('madDogStart', { playerId: p.id, weapon: this.weapon, upgraded: this.weapon + '+' });
  }
  take(sim, p) {
    const upId = this.weapon + '+';
    const def = sim.cfg.weapons[upId];
    const w = p.loadout;
    const lists = [w.slots, p.downed && p.downed.saved ? p.downed.saved.slots : []];
    let idx = -1;
    for (const list of lists) { const i = list.indexOf(this.slotRef); if (i >= 0 && list === w.slots) idx = i; }
    if (idx >= 0) {
      const s = w.slots[idx];
      s.id = upId; s.away = false; s.upgraded = true;
      s.clip = def.magSize; s.clipL = def.dual ? def.magSize : 0; s.reserve = def.reserve;
      w.current = idx;
      w.drawTimer = def.drawTime;
      w.adsAmount = 0;
      sim.emit('weaponGiven', { playerId: p.id, weapon: upId });
    } else {
      giveWeapon(sim, p, upId);
    }
    sim.emit('madDogTaken', { playerId: p.id, weapon: upId });
    this.state = 'idle';
    this.ownerId = null;
    this.weapon = null;
    this.slotRef = null;
  }
  update(sim, dt) {
    if (this.state !== 'working') return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.state = 'ready';
      sim.emit('madDogReady', { playerId: this.ownerId, weapon: this.weapon + '+' });
    }
  }
}

// ---------------------------------------------------------------------------
// Electric trap lever.
export class TrapInteractable {
  constructor(trap) {
    this.trap = trap;
    this.id = 'use_' + trap.id;
    this.kind = 'trap';
    this.requireLook = true;
    const l = trap.lever;
    this.pos = { x: l.pos.x, y: l.pos.y, z: l.pos.z };
    this.stand = { x: l.pos.x + l.normal.x * 0.7, z: l.pos.z + l.normal.z * 0.7 };
  }
  get range() { return 1.5; }
  distanceTo(sim, p) { return flatDist(p, this.stand); }
  canUse(sim, p) { return up(p); }
  prompt(sim) {
    const t = this.trap;
    if (!sim.power) return { text: 'The power must be on', cost: null };
    if (t.state === 'active') return { text: 'Trap is live', cost: null };
    if (t.state === 'cooldown') return { text: 'Trap is recharging', cost: null };
    return { text: 'Press [F] to activate the electric trap', cost: sim.cfg.traps.cost };
  }
  use(sim, p, cmd) {
    const t = this.trap;
    if (!cmd.usePressed || !sim.power || t.state !== 'idle') return;
    if (!pay(sim, p, sim.cfg.traps.cost)) return;
    t.state = 'active';
    t.timer = sim.cfg.traps.activeTime;
    t.ownerId = p.id;
    sim.emit('trapOn', { id: t.id, playerId: p.id });
  }
}

export function createTraps(sim) {
  return sim.world.traps.map((t) => ({ ...t, state: 'idle', timer: 0, ownerId: null }));
}

const inBox = (pos, b) => pos.x >= b[0] && pos.x <= b[2] && pos.z >= b[1] && pos.z <= b[3];

export function updateTraps(sim, dt) {
  const tc = sim.cfg.traps;
  for (const t of sim.traps) {
    if (t.state === 'idle') continue;
    t.timer -= dt;
    if (t.state === 'active') {
      for (const z of [...sim.zombies]) {
        if (z.state === 'dead' || z.state === 'dummy' || !inBox(z.pos, t.box)) continue;
        killZombie(sim, z, { kind: 'electric', part: 'torso', dir: { x: 0, y: 1, z: 0 }, playerId: null, trap: t.id });
      }
      for (const p of sim.players) {
        if (p.alive && !p.downed && inBox(p.pos, t.box)) sim.damagePlayer(p, tc.playerDps * dt, { pos: { x: p.pos.x, z: p.pos.z } });
      }
      if (t.timer <= 0) { t.state = 'cooldown'; t.timer = tc.cooldown; sim.emit('trapOff', { id: t.id }); }
    } else if (t.timer <= 0) {
      t.state = 'idle';
      sim.emit('trapReady', { id: t.id });
    }
  }
}

// ---------------------------------------------------------------------------
// Hold [F] over a downed teammate to pick them up.
export class ReviveInteractable {
  constructor() {
    this.id = 'use_revive';
    this.kind = 'revive';
    this.requireLook = false;
    this.pos = { x: 0, y: 0, z: 0 };
    this.target = null;
  }
  get range() { return 1.6; }
  nearestDowned(sim, p) {
    let best = null, bd = Infinity;
    for (const o of sim.players) {
      if (o === p || !o.alive || !o.downed) continue;
      const d = flatDist(p, o.pos);
      if (d < bd) { bd = d; best = o; }
    }
    return { o: best, d: bd };
  }
  distanceTo(sim, p) { return this.nearestDowned(sim, p).d; }
  canUse(sim, p) { return up(p); }
  prompt(sim, p) {
    const { o } = this.nearestDowned(sim, p);
    return { text: `Hold [F] to revive ${o ? o.name : ''}`, cost: null, hold: true };
  }
  use(sim, p, cmd, dt) {
    const { o } = this.nearestDowned(sim, p);
    if (!o) return;
    if (!cmd.use) { if (o.downed.reviverId === p.id) { o.downed.reviverId = null; o.downed.revive = 0; } p.reviving = null; return; }
    if (o.downed.reviverId && o.downed.reviverId !== p.id) return;
    o.downed.reviverId = p.id;
    o.downed.revive += dt;
    const need = reviveTimeFor(sim, p);
    p.reviving = { targetId: o.id, frac: Math.min(1, o.downed.revive / need) };
    if (o.downed.revive >= need) { p.reviving = null; revive(sim, o, p.id); }
  }
  release(sim, p) {
    for (const o of sim.players) if (o.downed && o.downed.reviverId === p.id) { o.downed.reviverId = null; o.downed.revive = 0; }
    p.reviving = null;
  }
}
