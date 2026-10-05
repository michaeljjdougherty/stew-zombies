// =============================================================================
// Map builder: turns map data into collision boxes, openings and anchors.
// Pure JS (no three.js) so the simulation and a future server can use it.
// =============================================================================
import { CONFIG } from '../config.js';

const box = (minX, minY, minZ, maxX, maxY, maxZ, kind = 'wall', extra = {}) =>
  ({ minX, minY, minZ, maxX, maxY, maxZ, kind, ...extra });

// Geometry of one side of a room rectangle.
export function sideInfo(rect, side, T) {
  const [x0, z0, x1, z1] = rect;
  switch (side) {
    case 'n': return { axis: 'x', at: z0, outward: -1, from: x0 - T, to: x1 + T, normal: { x: 0, z: 1 } };
    case 's': return { axis: 'x', at: z1, outward: 1, from: x0 - T, to: x1 + T, normal: { x: 0, z: -1 } };
    case 'w': return { axis: 'z', at: x0, outward: -1, from: z0, to: z1, normal: { x: 1, z: 0 } };
    case 'e': return { axis: 'z', at: x1, outward: 1, from: z0, to: z1, normal: { x: -1, z: 0 } };
  }
  throw new Error('bad side ' + side);
}

// Point on the inside face of a wall, `at` metres along it.
export function wallPoint(rect, side, at) {
  const [x0, z0, x1, z1] = rect;
  if (side === 'n') return { x: at, z: z0 };
  if (side === 's') return { x: at, z: z1 };
  if (side === 'w') return { x: x0, z: at };
  return { x: x1, z: at };
}

// Box filling a wall's thickness over [a,b] along it, heights [y0,y1].
function slab(si, T, a, b, y0, y1, kind, extra) {
  const t0 = si.outward > 0 ? si.at : si.at - T;
  const t1 = t0 + T;
  return si.axis === 'x' ? box(a, y0, t0, b, y1, t1, kind, extra) : box(t0, y0, a, t1, y1, b, kind, extra);
}

function buildSide(room, side, spec, openings, T, pieces) {
  const si = sideInfo(room.rect, side, T);
  const H = spec.height ?? room.height;
  const ranges = spec.ranges ?? [[si.from, si.to]];
  const tag = { room: room.id, side, style: spec.style || room.style };
  if (tag.style === 'invisible') tag.ghost = true;   // blocks walking, not bullets or sight lines
  for (const [ra, rb] of ranges) {
    const ops = openings.filter((o) => o.center > ra && o.center < rb).sort((a, b) => a.center - b.center);
    let cursor = ra;
    for (const o of ops) {
      const a = o.center - o.width / 2, b = o.center + o.width / 2;
      if (a > cursor) pieces.push(slab(si, T, cursor, a, 0, H, 'wall', tag));
      if (o.bottom > 0) pieces.push(slab(si, T, a, b, 0, o.bottom, 'sill', { ...tag, openingId: o.id }));
      if (o.top < H) pieces.push(slab(si, T, a, b, o.top, H, 'lintel', { ...tag, openingId: o.id }));
      cursor = b;
    }
    if (cursor < rb) pieces.push(slab(si, T, cursor, rb, 0, H, 'wall', tag));
  }
}

export function buildMap(map, cfg = CONFIG) {
  const T = map.wallThickness;
  const wc = cfg.windows;
  const roomById = new Map(map.rooms.map((r) => [r.id, r]));

  // --- openings per room side
  const openings = new Map();
  const addOpening = (room, side, o) => {
    const k = room + ':' + side;
    if (!openings.has(k)) openings.set(k, []);
    openings.get(k).push(o);
  };
  for (const w of map.windows) addOpening(w.room, w.side, { id: w.id, center: w.at, width: wc.width, bottom: wc.sillHeight, top: wc.topHeight });
  for (const d of map.doors) addOpening(d.room, d.side, { id: d.id, center: d.at, width: d.width, bottom: 0, top: d.height });
  for (const [i, g] of (map.gaps || []).entries()) addOpening(g.room, g.side, { id: 'gap' + i, center: g.at, width: g.width, bottom: 0, top: g.height });

  // --- walls
  const walls = [];
  for (const room of map.rooms) {
    for (const side of ['n', 's', 'w', 'e']) {
      const spec = room.walls[side];
      if (!spec || spec.skip) continue;
      buildSide(room, side, spec, openings.get(room.id + ':' + side) || [], T, walls);
    }
  }

  // --- props (furniture etc.)
  const propBoxes = (map.props || []).map((p) => box(p.box[0], p.box[1], p.box[2], p.box[3], p.box[4], p.box[5], p.kind, { prop: p }));

  // --- pull-out bleachers along the court's long walls (stacked tiers you can climb)
  const bleacherBoxes = [];
  const court = roomById.get('court');
  for (const b of map.bleachers || []) {
    const dir = b.side === 'north' ? 1 : -1;
    const wallZ = b.side === 'north' ? court.rect[1] : court.rect[3];
    const total = b.rows * b.depth;
    for (let i = 0; i < b.rows; i++) {
      const front = wallZ + dir * (total - i * b.depth);
      bleacherBoxes.push(box(b.x0, i * b.rise, Math.min(wallZ, front), b.x1, (i + 1) * b.rise, Math.max(wallZ, front), 'bleacher', { row: i, side: b.side }));
    }
  }

  // --- doors (solid until opened)
  const doorBoxes = new Map();
  const doors = map.doors.map((d) => {
    const room = roomById.get(d.room);
    const si = sideInfo(room.rect, d.side, T);
    const b = slab(si, T, d.at - d.width / 2, d.at + d.width / 2, 0, d.height, 'door', { doorId: d.id });
    doorBoxes.set(d.id, b);
    const p = wallPoint(room.rect, d.side, d.at);
    const mid = { x: p.x - si.normal.x * T / 2, z: p.z - si.normal.z * T / 2 };
    return { ...d, box: b, center: mid, normal: si.normal, axis: si.axis };
  });

  // --- windows
  const windows = map.windows.map((w) => {
    const room = roomById.get(w.room);
    const si = sideInfo(room.rect, w.side, T);
    const c = wallPoint(room.rect, w.side, w.at);
    const n = si.normal;
    return {
      id: w.id, room: w.room, zone: room.zone, side: w.side, kind: w.kind || 'window',
      center: { x: c.x, y: 0, z: c.z },
      normal: { x: n.x, y: 0, z: n.z },
      exterior: { x: c.x - n.x * (T + 0.55), y: 0, z: c.z - n.z * (T + 0.55) },
      interior: { x: c.x + n.x * 0.9, y: 0, z: c.z + n.z * 0.9 },
      blocker: slab(si, T, w.at - wc.width / 2, w.at + wc.width / 2, 0, room.height, 'windowBlock', { windowId: w.id }),
    };
  });

  // --- wall weapons
  const wallBuys = (map.wallBuys || []).map((wb, i) => {
    const room = roomById.get(wb.room);
    const si = sideInfo(room.rect, wb.side, T);
    const p = wallPoint(room.rect, wb.side, wb.at);
    return { id: 'wall_' + wb.weapon + '_' + i, weapon: wb.weapon, room: wb.room, zone: room.zone, pos: { x: p.x, y: wb.y, z: p.z }, normal: si.normal };
  });

  // each box spot gets a collider; only the one the box is at is solid
  const boxSpots = (map.boxSpots || []).map((b) => {
    const along = Math.abs(Math.sin(b.yaw)) > 0.5; // box's long side runs along z
    const hw = 0.55, hd = 0.29;
    const hx = along ? hd : hw, hz = along ? hw : hd;
    return { ...b, zone: roomById.get(b.room).zone, collider: box(b.x - hx, 0, b.z - hz, b.x + hx, 0.62, b.z + hz, 'boxBase', { spot: b.id }) };
  });
  const startSpot = boxSpots.find((b) => b.start) || boxSpots[0];

  // A point on a wall's inside face plus the normal pointing into the room.
  const onWall = (a, inset = 0) => {
    const room = roomById.get(a.room);
    const si = sideInfo(room.rect, a.side, T);
    const p = wallPoint(room.rect, a.side, a.at);
    return { pos: { x: p.x + si.normal.x * inset, y: a.y ?? 0, z: p.z + si.normal.z * inset }, normal: si.normal, zone: room.zone, room: room.id };
  };

  // Perk machines: solid cabinets against the wall.
  const pm = cfg.perkMachine || { width: 1.3, depth: 0.9, height: 2.3 };
  const perkMachines = (map.perkMachines || []).map((m, i) => {
    const w = onWall(m);
    const n = w.normal;
    const cx = w.pos.x + n.x * pm.depth / 2, cz = w.pos.z + n.z * pm.depth / 2;
    const hx = n.x ? pm.depth / 2 : pm.width / 2, hz = n.z ? pm.depth / 2 : pm.width / 2;
    const b = box(cx - hx, 0, cz - hz, cx + hx, pm.height, cz + hz, 'perkMachine', { perk: m.perk });
    return { id: 'perk_' + m.perk + '_' + i, perk: m.perk, zone: w.zone, room: w.room, normal: n, center: { x: cx, y: 0, z: cz }, front: { x: cx + n.x * (pm.depth / 2 + 0.6), y: 1.2, z: cz + n.z * (pm.depth / 2 + 0.6) }, box: b };
  });

  const powerSwitch = map.powerSwitch ? onWall(map.powerSwitch, 0.05) : null;
  const madDog = map.madDog ? { ...map.madDog, zone: roomById.get(map.madDog.room).zone } : null;
  // the main quest (school only): wall-mounted breakers get real positions
  const quest = map.quest ? {
    ...map.quest,
    breakers: map.quest.breakers.map((b) => ({ ...b, ...onWall(b, 0.05) })),
  } : null;
  const traps = (map.traps || []).map((t) => ({ ...t, lever: onWall(t.lever, 0.05), zone: roomById.get(t.lever.room).zone }));
  const groundSpawns = (map.groundSpawns || []).map((g) => ({ ...g, zone: roomById.get(g.room).zone }));

  return {
    map,
    rooms: map.rooms,
    roomById,
    walls,
    propBoxes,
    bleacherBoxes,
    doors,
    doorBoxes,
    windows,
    wallBuys,
    boxSpots,
    perkMachines,
    powerSwitch,
    madDog,
    quest,
    traps,
    groundSpawns,
    // mutable collision lists
    solids: [...walls, ...propBoxes, ...bleacherBoxes, ...doorBoxes.values(), ...perkMachines.map((m) => m.box), ...(startSpot ? [startSpot.collider] : [])],
    playerBlockers: windows.map((w) => w.blocker),
    navRegions: map.navRegions,
    portals: map.portals,
    floorY: 0,
  };
}

// Remove an opened door's collider from the world.
export function openDoorCollision(world, doorId) {
  const b = world.doorBoxes.get(doorId);
  if (!b) return;
  world.solids = world.solids.filter((s) => s !== b);
}
