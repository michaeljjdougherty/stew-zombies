// =============================================================================
// Perks: what each one does, buying (with the drink), and losing them when
// you go down. Effects are read through perkMult()/hasPerk() wherever they
// apply (reload speed in weapons.js, health and sprint in player.js, ...).
// =============================================================================

export function hasPerk(p, id) { return p.perks.includes(id); }

// Product of a numeric field over every perk the player has (1 if none set it).
export function perkMult(sim, p, key) {
  let m = 1;
  for (const id of p.perks) {
    const v = sim.cfg.perks.list[id][key];
    if (typeof v === 'number') m *= v;
  }
  return m;
}

export function perkCost(sim, id) {
  const d = sim.cfg.perks.list[id];
  return sim.players.length > 1 && d.coopCost ? d.coopCost : d.cost;
}

// Start drinking (weapons are lowered until it's done).
export function startDrinking(sim, p, id) {
  if (p.loadout.reloading) sim.cancelReload(p);
  p.sprinting = false;
  p.loadout.adsAmount = 0;
  p.drinking = { perk: id, t: sim.cfg.perks.drinkTime };
  sim.emit('perkDrink', { playerId: p.id, perk: id });
}

export function updateDrinking(sim, p, dt) {
  if (!p.drinking) return;
  p.drinking.t -= dt;
  if (p.drinking.t > 0) return;
  const id = p.drinking.perk;
  p.drinking = null;
  givePerk(sim, p, id);
}

export function givePerk(sim, p, id) {
  if (hasPerk(p, id)) return;
  p.perks.push(id);
  applyPerkStats(sim, p);
  if (sim.cfg.perks.list[id].maxHealth) p.health = p.maxHealth;
  sim.emit('perkGained', { playerId: p.id, perk: id });
}

// Recompute stats that perks change.
export function applyPerkStats(sim, p) {
  let maxHealth = sim.cfg.player.maxHealth;
  for (const id of p.perks) maxHealth = Math.max(maxHealth, sim.cfg.perks.list[id].maxHealth || 0);
  p.maxHealth = maxHealth;
  p.health = Math.min(p.health, p.maxHealth);
}

export function loseAllPerks(sim, p) {
  if (!p.perks.length) return;
  const lost = [...p.perks];
  p.perks.length = 0;
  applyPerkStats(sim, p);
  sim.emit('perksLost', { playerId: p.id, perks: lost });
}
