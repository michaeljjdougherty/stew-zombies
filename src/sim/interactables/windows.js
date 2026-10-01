// =============================================================================
// Boarded windows: zombies tear planks off, players hold USE to rebuild them.
// Every interactable follows the same small interface so doors, wall buys,
// perks, the box and the Mad Dog Machine can slot in later:
//   { id, kind, range, pos, requireLook, distanceTo(sim,p), canUse(sim,p),
//     prompt(sim,p), use(sim,p,cmd,dt), release?(sim,p), update?(sim,dt) }
// =============================================================================

export function createWindows(sim) {
  const max = sim.cfg.windows.boards;
  return sim.world.windows.map((anchor) => ({
    ...anchor,
    // fences have nothing to tear down: zombies just climb over
    boards: anchor.kind === 'fence' ? 0 : max,
    maxBoards: anchor.kind === 'fence' ? 0 : max,
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
    this.requireLook = false;
    this.pos = { x: win.center.x + win.normal.x * 0.5, y: 1.2, z: win.center.z + win.normal.z * 0.5 };
  }

  // Distance measured to a point just inside the window.
  distanceTo(sim, p) {
    this.range = sim.cfg.windows.rebuildRange;
    return Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
  }

  canUse(sim, p) {
    return p.alive && this.win.boards < this.win.maxBoards;
  }

  prompt(sim, p) {
    const blocked = this.win.climbing !== null;
    return { text: blocked ? 'Barrier blocked' : 'Hold [F] to rebuild barrier', cost: null, hold: true };
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
