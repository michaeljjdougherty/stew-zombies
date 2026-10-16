// =============================================================================
// Watches a game for the signed-in player and feeds their career: kills,
// revives, rounds survived and the rest, and the achievements that happen in
// the moment (round 10, a clean Cheddar round, the Fucci and the Chopper...).
// Only real zombies games count (not the Firing Range or Explore).
// Works the same on the host and on a friend's copy online: it only ever looks
// at the local player.
// =============================================================================
import { baseWeaponId, CONFIG } from '../config.js';

export class CareerTracker {
  constructor(career) {
    this.career = career;
    this.sim = null;
    this.on = false;
    this.checkT = 0;
    this.flushT = 0;
    this.divinium = 0;
    this.onDivinium = null;     // (n) => tell the player they got a vial
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
      this.divinium = 0;         // vials of Liquid Divinium earned this game
      this.crust = !!(sim.mapData && sim.mapData.id === 'crust');
      this.launches = 0; this.flameKills = 0; this.hammerKills = 0;   // Call of the Crust, this game
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

  // Liquid Divinium: playing earns it. Each round you survive past
  // CONFIG.gobblegum.divinium.fromRound has a chance at a vial, and every
  // `every`th round is a sure one (up to `max` a game).
  maybeDivinium(round, sim) {
    const D = (sim.cfg || CONFIG).gobblegum.divinium;
    if (round < D.fromRound || this.divinium >= D.max) return;
    if (round % D.every === 0 || Math.random() < D.chance) {
      this.divinium++;
      this.career.addDivinium(1);
      if (this.onDivinium) this.onDivinium(this.divinium);
    }
  }

  onEvent(e, sim, localId) {
    if (!this.on || sim !== this.sim) return;
    const C = this.career;
    const me = sim.playerById(localId);
    const alive = !!(me && me.alive !== false);
    switch (e.type) {
      case 'zombieKilled':
        if (e.playerId === localId) {
          C.add('kills'); if (e.headshot) C.add('headshots');
          if (this.crust) this.crustKill(e, me);
        }
        break;
      case 'playerRevived':
        if (e.by === localId && e.playerId !== localId && !e.self) C.add('revives');
        break;
      case 'playerDown':
        if (e.playerId === localId) { C.add('downs'); this.cheddarClean = false; }
        break;
      // wall guns (and their ammo), wall grenades, doors and debris: all "Wall buys"
      case 'wallBuy':
        if (e.playerId === localId) C.add('wallBuys');
        break;
      case 'doorOpened':
        if (e.playerId === localId) C.add('wallBuys');
        break;
      case 'roundStart':
        if (!alive) break;
        C.max('bestRound', e.round);
        if (e.round >= 10) C.unlock('round10');
        if (e.round >= 25) C.unlock('round25');
        if (this.crust && e.round >= 15) C.unlock('crustRound15');
        if (this.crust && e.round >= 30) C.unlock('crustRound30');
        this.cheddarClean = e.cheddar ? !(me && me.downed) : null;
        break;
      case 'roundEnd':
        if (alive) C.add('rounds');
        if (alive) this.maybeDivinium(e.round, sim);
        if (e.cheddar && this.cheddarClean && alive) C.unlock('cheddar');
        this.cheddarClean = null;
        break;
      // GobbleGum: a Mega's used up as it comes out of the machine for you
      case 'gumDispensed':
        if (e.playerId === localId && e.mega) C.useMega(e.gum);
        break;
      case 'madDogTaken':
        if (e.playerId === localId) C.unlock('maddog');
        break;
      case 'bossEnd':
        // the whole squad finished it
        C.unlock('egg');
        if (this.hardcore) C.unlock('eggHardcore');
        break;
      // Call of the Crust (the whole squad shares the quest steps, like the egg)
      case 'islandPower':
        if (this.crust && e.count >= e.total) C.unlock('crustPower');
        break;
      case 'playerLaunch':
        if (this.crust && e.playerId === localId && ++this.launches >= 10) C.unlock('crustLaunch');
        break;
      case 'warHammerBuilt':
        if (this.crust) C.unlock('crustWarHammer');
        break;
      case 'hammerForged':
        if (this.crust && e.count >= 4) C.unlock('crustHammers');
        break;
      case 'titanDown':
        if (this.crust) C.unlock('crustTitan');
        break;
      case 'crustVictory':
        if (this.crust) C.unlock('crustVictory');
        break;
      case 'gameOver':
        C.flush();
        break;
    }
  }

  // A kill of yours on the Crust: the M2 Flamethrower's fire, or a War Hammer
  // (any element, tempered or not) in your hands.
  crustKill(e, me) {
    const s = me && me.loadout && me.loadout.slots[me.loadout.current];
    const gun = s && s.id ? baseWeaponId(s.id) : '';
    if (gun === 'M2 Flamethrower' && e.kind === 'fire' && ++this.flameKills >= 50) this.career.unlock('crustFlame');
    if (/Hammer$/.test(gun) && ++this.hammerKills >= 100) this.career.unlock('crustHammerTime');
  }
}
