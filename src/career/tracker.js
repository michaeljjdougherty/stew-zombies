// =============================================================================
// Watches a game for the signed-in player and feeds their career: kills,
// revives, rounds survived and the rest, and the achievements that happen in
// the moment (round 10, a clean Cheddar round, the Fucci and the Chopper...).
// Only real zombies games count (not the Firing Range or Explore).
// Works the same on the host and on a friend's copy online: it only ever looks
// at the local player.
// =============================================================================
import { baseWeaponId } from '../config.js';

export class CareerTracker {
  constructor(career) {
    this.career = career;
    this.sim = null;
    this.on = false;
    this.checkT = 0;
    this.flushT = 0;
  }

  // Called every simulation step, before that step's events.
  tick(sim, localId, dt, { hardcore = false } = {}) {
    if (sim !== this.sim) {
      // a new game
      this.sim = sim;
      this.on = !!(this.career.signedIn && sim.mode === 'zombies');
      this.hardcore = hardcore;
      this.cheddarClean = null;
      this.counted = false;
    }
    if (!this.on) return;
    const C = this.career;
    if (!this.counted && sim.rounds && sim.rounds.round >= 1) { this.counted = true; C.add('games'); }
    // the Fucci Gun and the Chopper, both in your hands at once (either one Mad Dog'd counts)
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 0.5;
      const p = sim.playerById(localId);
      if (p && p.loadout && !C.has('fullyLoaded')) {
        const ids = new Set(p.loadout.slots.map((s) => s && s.id && baseWeaponId(s.id)));
        if (ids.has('Fucci Gun') && ids.has('The Chopper')) C.unlock('fullyLoaded');
      }
    }
    // save now and then (and online, send it up)
    this.flushT -= dt;
    if (this.flushT <= 0) { this.flushT = C.cfg.flushEvery || 15; C.flush(); }
  }

  onEvent(e, sim, localId) {
    if (!this.on || sim !== this.sim) return;
    const C = this.career;
    const me = sim.playerById(localId);
    const alive = !!(me && me.alive !== false);
    switch (e.type) {
      case 'zombieKilled':
        if (e.playerId === localId) { C.add('kills'); if (e.headshot) C.add('headshots'); }
        break;
      case 'playerRevived':
        if (e.by === localId && e.playerId !== localId && !e.self) C.add('revives');
        break;
      case 'playerDown':
        if (e.playerId === localId) { C.add('downs'); this.cheddarClean = false; }
        break;
      case 'roundStart':
        if (!alive) break;
        C.max('bestRound', e.round);
        if (e.round >= 10) C.unlock('round10');
        if (e.round >= 25) C.unlock('round25');
        this.cheddarClean = e.cheddar ? !(me && me.downed) : null;
        break;
      case 'roundEnd':
        if (alive) C.add('rounds');
        if (e.cheddar && this.cheddarClean && alive) C.unlock('cheddar');
        this.cheddarClean = null;
        break;
      case 'madDogTaken':
        if (e.playerId === localId) C.unlock('maddog');
        break;
      case 'bossEnd':
        // the whole squad finished it
        C.unlock('egg');
        if (this.hardcore) C.unlock('eggHardcore');
        break;
      case 'gameOver':
        C.flush();
        break;
    }
  }
}
