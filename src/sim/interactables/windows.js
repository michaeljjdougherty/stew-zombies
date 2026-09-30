// =============================================================================
// Boarded windows: zombies tear planks off, players hold USE to rebuild them.
// Every interactable follows the same small interface so doors, wall buys,
// perks, the box and the Mad Dog Machine can slot in later:
//   { id, kind, range, distanceTo(sim,p), canUse(sim,p), prompt(sim,p), use(sim,p,cmd,dt), release?(sim,p) }
// =============================================================================

export function createWindows(sim) {
  const max = sim.cfg.windows.boards;
  return sim.world.windows.map((anchor) => ({
    ...anchor,
    boards: max,
    maxBoards: max,
    queue: [],        // zombie ids waiting outside, front first
    climbing: null,   // zombie id currently climbing through
    rebuild: new Map(), // playerId -> seconds held
  }));
}

export class WindowInteractable {
  constructor(win) {
    this.win = win;
    this.id = 'use_' + win.id;
    this.kind = 'window';
    this.range = 0;
  }

  // Distance measured to a point just inside the window.
  distanceTo(sim, p) {
    this.range = sim.cfg.windows.rebuildRange;
    const w = this.win;
    const x = w.center.x + w.normal.x * 0.5, z = w.center.z + w.normal.z * 0.5;
    return Math.hypot(p.pos.x - x, p.pos.z - z);
  }

  canUse(sim, p) {
    return p.alive && this.win.boards < this.win.maxBoards;
  }

  prompt(sim, p) {
    const blocked = this.win.climbing !== null;
    return { text: blocked ? 'Barrier blocked' : 'Hold [F] to Rebuild Barrier', key: 'F', hold: true };
  }

  use(sim, p, cmd, dt) {
    const w = this.win;
    if (!cmd.use || w.climbing !== null || w.boards >= w.maxBoards) {
      w.rebuild.set(p.id, 0);
      p.rebuilding = false;
      return;
    }
    p.rebuilding = true;
    const t = (w.rebuild.get(p.id) || 0) + dt;
    if (t >= sim.cfg.windows.rebuildInterval) {
      w.boards++;
      w.rebuild.set(p.id, 0);
      const pts = sim.cfg.points;
      let awarded = 0;
      if (p.boardPointsThisRound < pts.boardRepairCapPerRound) {
        awarded = pts.boardRepair;
        p.boardPointsThisRound += awarded;
        sim.addPoints(p, awarded, 'board');
      }
      sim.emit('boardRepaired', { windowId: w.id, board: w.boards - 1, playerId: p.id, points: awarded });
    } else {
      w.rebuild.set(p.id, t);
    }
  }

  release(sim, p) {
    this.win.rebuild.set(p.id, 0);
    p.rebuilding = false;
  }
}
