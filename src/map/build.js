// =============================================================================
// Map builder: turns map data into collision boxes and structural pieces.
// Pure JS (no three.js) so the simulation and a future server can use it.
// =============================================================================
import { CONFIG } from '../config.js';

const box = (minX, minY, minZ, maxX, maxY, maxZ, kind = 'wall', extra = {}) =>
  ({ minX, minY, minZ, maxX, maxY, maxZ, kind, ...extra });

// A straight wall with rectangular openings cut into it.
// axis 'x': wall runs along X at fixed z. axis 'z': runs along Z at fixed x.
// `outward` = +1/-1: which side the thickness extends toward.
function wallWithOpenings({ axis, at, from, to, thickness, outward, height, openings }) {
  const pieces = [];
  const sorted = [...openings].sort((a, b) => a.center - b.center);
  const t0 = outward > 0 ? at : at - thickness;
  const t1 = outward > 0 ? at + thickness : at;
  const mk = (a0, a1, y0, y1, kind, extra) => (axis === 'x'
    ? box(a0, y0, t0, a1, y1, t1, kind, extra)
    : box(t0, y0, a0, t1, y1, a1, kind, extra));

  let cursor = from;
  for (const o of sorted) {
    const a = o.center - o.width / 2, b = o.center + o.width / 2;
    if (a > cursor) pieces.push(mk(cursor, a, 0, height, 'wall'));
    if (o.bottom > 0) pieces.push(mk(a, b, 0, o.bottom, 'sill', { openingId: o.id }));
    if (o.top < height) pieces.push(mk(a, b, o.top, height, 'lintel', { openingId: o.id }));
    cursor = b;
  }
  if (cursor < to) pieces.push(mk(cursor, to, 0, height, 'wall'));
  return pieces;
}

export function buildMap(map, cfg = CONFIG) {
  const { minX, maxX, minZ, maxZ } = map.bounds;
  const T = map.wallThickness;
  const H = map.height;
  const wcfg = cfg.windows;

  const openingsFor = (wall) => [
    ...map.windows.filter((w) => w.wall === wall).map((w) => ({
      id: w.id,
      center: wall === 'north' || wall === 'south' ? w.x : w.z,
      width: wcfg.width, bottom: wcfg.sillHeight, top: wcfg.topHeight,
    })),
    ...map.doors.filter((d) => d.wall === wall).map((d) => ({
      id: d.id,
      center: wall === 'north' || wall === 'south' ? d.x : d.z,
      width: d.width, bottom: 0, top: d.height,
    })),
  ];

  const walls = [
    ...wallWithOpenings({ axis: 'x', at: minZ, from: minX - T, to: maxX + T, thickness: T, outward: -1, height: H, openings: openingsFor('north') }),
    ...wallWithOpenings({ axis: 'x', at: maxZ, from: minX - T, to: maxX + T, thickness: T, outward: 1, height: H, openings: openingsFor('south') }),
    ...wallWithOpenings({ axis: 'z', at: minX, from: minZ, to: maxZ, thickness: T, outward: -1, height: H, openings: openingsFor('west') }),
    ...wallWithOpenings({ axis: 'z', at: maxX, from: minZ, to: maxZ, thickness: T, outward: 1, height: H, openings: openingsFor('east') }),
  ];

  // Bleachers: stacked tiers. Row 0 is the lowest and sticks out furthest.
  const bleacherBoxes = [];
  for (const b of map.bleachers) {
    const dir = b.side === 'north' ? 1 : -1;           // direction into room
    const wallZ = b.side === 'north' ? minZ : maxZ;
    const total = b.rows * b.depth;
    for (let i = 0; i < b.rows; i++) {
      const front = wallZ + dir * (total - i * b.depth);
      const z0 = Math.min(wallZ, front), z1 = Math.max(wallZ, front);
      bleacherBoxes.push(box(b.x0, i * b.rise, z0, b.x1, (i + 1) * b.rise, z1, 'bleacher', { row: i, side: b.side }));
    }
  }

  // Closed doors are solid until bought.
  const doorBoxes = map.doors.map((d) => {
    const half = d.width / 2;
    if (d.wall === 'east' || d.wall === 'west') {
      const x0 = d.wall === 'east' ? d.x : d.x - T;
      return box(x0, 0, d.z - half, x0 + T, d.height, d.z + half, 'door', { doorId: d.id });
    }
    const z0 = d.wall === 'south' ? d.z : d.z - T;
    return box(d.x - half, 0, z0, d.x + half, d.height, z0 + T, 'door', { doorId: d.id });
  });

  // Invisible blockers so players can't jump out of windows.
  const windowBlockers = map.windows.map((w) => {
    const half = wcfg.width / 2;
    const z0 = w.normal.z > 0 ? w.z - T : w.z; // the wall's thickness at this window
    return box(w.x - half, 0, z0, w.x + half, H, z0 + T, 'windowBlock', { windowId: w.id });
  });

  // Window gameplay anchors.
  const windows = map.windows.map((w) => {
    const n = w.normal;
    return {
      id: w.id,
      center: { x: w.x, y: 0, z: w.z },
      normal: { x: n.x, y: 0, z: n.z },
      // where a zombie stands outside to tear boards
      exterior: { x: w.x - n.x * (T + 0.55), y: 0, z: w.z - n.z * (T + 0.55) },
      // where a zombie lands after climbing in
      interior: { x: w.x + n.x * 0.9, y: 0, z: w.z + n.z * 0.9 },
    };
  });

  return {
    map,
    solids: [...walls, ...bleacherBoxes, ...doorBoxes], // block movement and bullets
    playerBlockers: windowBlockers,                        // block players only
    walls,
    bleacherBoxes,
    doorBoxes,
    windows,
    floorY: 0,
  };
}
