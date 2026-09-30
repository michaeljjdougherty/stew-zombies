// =============================================================================
// Navigation. Phase 1 is a single open room, so zombies walk straight at you.
// Later phases add a zone/portal graph here (rooms connected through doorways
// and debris), and nextPoint() will return the next doorway on the way to the
// target. Zombie code only ever calls nextPoint(), so nothing else changes.
// =============================================================================

export class Nav {
  constructor(world) {
    this.world = world;
  }

  // Next point a zombie at `from` should walk toward to reach `to`.
  nextPoint(from, to) {
    return to;
  }
}
