// =============================================================================
// The jukebox in the Teachers' Lounge (next to Erik's PA microphone). Press
// [F] to put on a song, again for the other one, again to stop it. Everyone in
// the game hears the same song from the same spot.
// =============================================================================
const flatDist = (p, pos) => Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);

export function createJukebox(sim) {
  return sim.mapData.jukebox ? { song: null, startedAt: 0 } : null;
}

export function updateJukebox(sim) {
  const j = sim.jukebox;
  if (!j || j.song == null) return;
  const song = sim.cfg.jukebox.songs[j.song];
  if (sim.time - j.startedAt > song.duration + 0.5) {
    j.song = null;
    sim.emit('jukeboxStop', {});
  }
}

export class JukeboxInteractable {
  constructor(spot) {
    this.id = 'use_jukebox';
    this.kind = 'jukebox';
    this.requireLook = true;
    this.pos = { x: spot.x, y: 1.0, z: spot.z };
    this.stand = { x: spot.x + Math.sin(spot.yaw) * 0.9, z: spot.z + Math.cos(spot.yaw) * 0.9 };
  }
  get range() { return 1.6; }
  distanceTo(sim, p) { return flatDist(p, this.stand); }
  canUse(sim, p) { return p.alive && !p.downed; }
  next(sim) {
    const j = sim.jukebox, n = sim.cfg.jukebox.songs.length;
    return j.song == null ? 0 : j.song + 1 < n ? j.song + 1 : null;
  }
  prompt(sim) {
    const nx = this.next(sim);
    if (nx == null) return { text: 'Press [F] to stop the jukebox', cost: null };
    return { text: `Press [F] to play "${sim.cfg.jukebox.songs[nx].name}"`, cost: null, sub: 'jukebox' };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const j = sim.jukebox, nx = this.next(sim);
    j.song = nx; j.startedAt = sim.time;
    sim.emit(nx == null ? 'jukeboxStop' : 'jukeboxPlay', { song: nx, playerId: p.id });
  }
}
