// =============================================================================
// Last stand: when your health hits zero you drop to the floor with a pistol.
//  - Solo with Second Helping: you get back up on your own after a moment.
//  - Solo without it: game over.
//  - Co-op: you bleed out unless a teammate holds [F] on you in time.
// You lose your perks either way.
// =============================================================================
import { hasPerk, loseAllPerks, perkMult } from './perks.js';
import { makeSlot, cancelReload } from './weapons.js';

// Health ran out.
export function goDown(sim, p) {
  const ls = sim.cfg.lastStand;
  const solo = sim.players.length === 1;
  const selfRevive = solo && hasPerk(p, 'secondHelping');
  p.sprinting = false;
  p.drinking = null;
  p.throwing = null;
  if (p.loadout.reloading) cancelReload(sim, p);

  if (solo && !selfRevive) {
    p.alive = false;
    p.health = 0;
    sim.emit('playerDown', { playerId: p.id, final: true });
    sim.emit('playerDied', { playerId: p.id });
    return;
  }

  p.downed = {
    t: 0,
    bleed: ls.bleedOut,
    selfRevive: selfRevive ? sim.cfg.perks.list.secondHelping.selfReviveTime : null,
    revive: 0,            // seconds a teammate has held [F]
    reviverId: null,
    saved: null,
  };
  p.health = 1;
  loseAllPerks(sim, p);
  giveLastStandPistol(sim, p);
  sim.emit('playerDown', { playerId: p.id, selfRevive: !!selfRevive });
}

// Swap to your best pistol (or a loaner) for the last stand.
function giveLastStandPistol(sim, p) {
  const ls = sim.cfg.lastStand;
  const w = p.loadout;
  p.downed.saved = { slots: w.slots, current: w.current };
  const pistols = w.slots.filter((s) => {
    const d = sim.cfg.weapons[s.id];
    return d.class === 'pistol' && !d.projectile && !s.away;
  });
  pistols.sort((a, b) => (sim.cfg.weapons[b.id].upgraded ? 1 : 0) - (sim.cfg.weapons[a.id].upgraded ? 1 : 0));
  let slot = pistols[0];
  if (!slot) {
    slot = makeSlot(sim, ls.tempPistol);
    slot.reserve = sim.cfg.weapons[ls.tempPistol].magSize * ls.tempPistolMags;
    slot.loaner = true;
  } else {
    const d = sim.cfg.weapons[slot.id];
    slot.reserve = Math.max(slot.reserve, d.magSize * 2);
  }
  w.slots = [slot];
  w.current = 0;
  w.adsAmount = 0;
  w.drawTimer = sim.cfg.weapons[slot.id].drawTime;
  sim.emit('weaponSwitch', { playerId: p.id, weapon: slot.id });
}

export function revive(sim, p, byId = null) {
  if (!p.downed) return;
  const saved = p.downed.saved;
  p.downed = null;
  const w = p.loadout;
  if (w.reloading) cancelReload(sim, p);
  if (saved) {
    w.slots = saved.slots;
    w.current = Math.min(saved.current, w.slots.length - 1);
  }
  w.drawTimer = sim.cfg.weapons[w.slots[w.current].id].drawTime;
  w.adsAmount = 0;
  p.health = p.maxHealth * sim.cfg.lastStand.reviveHealthFrac;
  p.lastDamageTime = sim.time;
  sim.emit('playerRevived', { playerId: p.id, by: byId, self: byId === p.id });
  sim.emit('weaponSwitch', { playerId: p.id, weapon: w.slots[w.current].id });
}

export function updateLastStand(sim, p, dt) {
  const d = p.downed;
  if (!d) return;
  d.t += dt;
  if (d.selfRevive != null) {
    d.selfRevive -= dt;
    if (d.selfRevive <= 0) revive(sim, p, p.id);
    return;
  }
  // a teammate's hold resets if they let go (handled by ReviveInteractable)
  if (d.reviverId == null) {
    d.bleed -= dt;
    if (d.bleed <= 0) {
      p.downed = null;
      p.alive = false;
      sim.emit('playerDied', { playerId: p.id, bledOut: true });
    }
  }
}

export function reviveTimeFor(sim, reviver) {
  return sim.cfg.lastStand.reviveTime * perkMult(sim, reviver, 'reviveMult');
}

// True while at least one player is still up (or about to get back up).
export function anyoneStanding(sim) {
  return sim.players.some((p) => p.alive && (!p.downed || p.downed.selfRevive != null));
}
