// =============================================================================
// MAP DATA — Last Bell High
// Pure data read by both the simulation (collision, zones, spawns, pathing)
// and the renderer. Axes: +X east, +Y up, -Z north. Units in meters.
//
// Rooms are rectangles [minX, minZ, maxX, maxZ]. Walls are built around each
// room, 0.5m thick, extending OUTWARD from the rectangle. A side can be
// skipped or limited to ranges where a neighbouring room already owns it.
// Openings (windows, doors, debris, gaps) are cut into the owning wall.
//
// Layout (top = north):
//
//                 +-----------------------+
//                 |  CAFETERIA     |stage |
//                 +-----[door]------------+
//   +----------+  |H|
//   |          |  |A|
//   |  COURT   [==]L|      (courtyard)
//   |          |  |L|
//   +----------+  +[debris]---+--------+
//                 |  OFFICE   |principal|
//                 +-----------+---------+
// =============================================================================

const T = 0.5;

// Lit = on the emergency circuit before the power is on. flicker 0..1.
function fixtureRow(xs, zs, y, litEvery = 3, flickerSet = []) {
  const out = [];
  let i = 0;
  for (const z of zs) for (const x of xs) {
    const lit = i % litEvery === 0;
    out.push({ x, y, z, lit, flicker: flickerSet.includes(i) ? 0.8 : lit ? 0.12 : 0 });
    i++;
  }
  return out;
}

export const SCHOOL = {
  id: 'lastbell',
  name: 'Last Bell High',
  wallThickness: T,

  playerSpawns: [
    { x: 0, z: 2.5, yaw: 0 },
    { x: -2, z: 3.5, yaw: 0 },
    { x: 2, z: 3.5, yaw: 0 },
    { x: 0, z: 5, yaw: 0 },
  ],

  // ---------------------------------------------------------------------------
  rooms: [
    {
      id: 'court', zone: 'court', name: 'Basketball Court',
      rect: [-17, -13, 17, 13], height: 9, floor: 'gym', style: 'gym', reverb: 1.0,
      walls: { n: {}, s: {}, w: {}, e: {} },
      ceiling: 'trusses',
      fixtures: (() => {
        const out = [];
        const xs = [-11, -3.7, 3.7, 11], zs = [-6, 0, 6];
        let i = 0;
        for (const z of zs) for (const x of xs) {
          const lit = [1, 4, 6, 10].includes(i);
          out.push({ x, z, y: 7.8, lit, flicker: [4, 10].includes(i) ? 0.8 : lit ? 0.15 : 0, kind: 'hanging' });
          i++;
        }
        return out;
      })(),
    },
    {
      id: 'hall', zone: 'hall', name: 'Main Hallway',
      rect: [17.5, -22, 21.5, 16], height: 3.4, floor: 'tile', style: 'hall', reverb: 0.55,
      walls: { w: { ranges: [[-22, -13.5], [13.5, 16]] }, e: {}, n: { height: 5 }, s: {} },
      ceiling: 'drop',
      fixtures: fixtureRow([19.5], [-19, -15, -11, -7, -3, 1, 5, 9, 13], 3.36, 2, [3, 6]).map((f) => ({ ...f, kind: 'panel' })),
    },
    {
      id: 'office', zone: 'office', name: 'Front Office',
      rect: [17.5, 16.5, 25.25, 26], height: 3.2, floor: 'carpet', style: 'office', reverb: 0.25,
      walls: { n: { ranges: [[22, 25.75]] }, s: {}, w: {}, e: {} },
      ceiling: 'drop',
      fixtures: fixtureRow([19.8, 23.2], [19, 23.5], 3.16, 3, [2]).map((f) => ({ ...f, kind: 'panel' })),
    },
    {
      id: 'principal', zone: 'office', name: "Principal's Office",
      rect: [25.75, 16.5, 30, 26], height: 3.2, floor: 'carpet', style: 'principal', reverb: 0.2,
      walls: { n: { ranges: [[25.75, 30.5]] }, s: { ranges: [[25.75, 30.5]] }, e: {}, w: { skip: true } },
      ceiling: 'drop',
      fixtures: [{ x: 27.9, y: 3.16, z: 21, lit: true, flicker: 0.9, kind: 'panel' }],
    },
    {
      id: 'cafe', zone: 'cafeteria', name: 'Cafeteria',
      rect: [17.5, -40.5, 38, -22.5], height: 5, floor: 'tile_big', style: 'cafe', reverb: 0.8,
      walls: { s: { ranges: [[22, 38.5]] }, n: {}, w: {}, e: {} },
      ceiling: 'drop',
      fixtures: fixtureRow([20.5, 25.5, 30.5, 35.5], [-37, -31.5, -26], 4.96, 3, [5, 9]).map((f) => ({ ...f, kind: 'panel' })),
    },
  ],

  // Walkable areas for pathing. Checked in order (first match wins), so the
  // raised stage comes before the cafeteria floor around it.
  navRegions: [
    { id: 'court', rect: [-17, -13, 17, 13], room: 'court' },
    { id: 'hall', rect: [17.5, -22, 21.5, 16], room: 'hall' },
    { id: 'office', rect: [17.5, 16.5, 25.25, 26], room: 'office' },
    { id: 'principal', rect: [25.75, 16.5, 30, 26], room: 'principal' },
    { id: 'stage', rect: [33.5, -38, 38, -25], room: 'cafe' },
    { id: 'cafe', rect: [17.5, -40.5, 38, -22.5], room: 'cafe' },
  ],

  // Connections between nav regions. `door` = only passable once that door is open.
  // axis: the axis you cross the opening along.
  portals: [
    { a: 'court', b: 'hall', x: 17.25, z: 6, axis: 'x', width: 2.6, door: 'door_hall' },
    { a: 'hall', b: 'cafe', x: 19.5, z: -22.25, axis: 'z', width: 2.6, door: 'door_cafe' },
    { a: 'hall', b: 'office', x: 19.5, z: 16.25, axis: 'z', width: 3.0, door: 'debris_office' },
    { a: 'office', b: 'principal', x: 25.5, z: 22.65, axis: 'x', width: 1.3 },
    { a: 'cafe', b: 'stage', x: 33.3, z: -31, axis: 'x', width: 2.8 },
  ],

  // ---------------------------------------------------------------------------
  // Boarded windows: owning room + side + position along the wall.
  windows: [
    { id: 'win_nw', room: 'court', side: 'n', at: -14 },
    { id: 'win_ne', room: 'court', side: 'n', at: 14 },
    { id: 'win_sw', room: 'court', side: 's', at: -14 },
    { id: 'win_se', room: 'court', side: 's', at: 14 },
    { id: 'win_hall_n', room: 'hall', side: 'e', at: -8 },
    { id: 'win_hall_s', room: 'hall', side: 'e', at: 9 },
    { id: 'win_office', room: 'office', side: 's', at: 21 },
    { id: 'win_principal', room: 'principal', side: 'e', at: 20.5 },
    { id: 'win_cafe_n', room: 'cafe', side: 'n', at: 31 },
    { id: 'win_cafe_s', room: 'cafe', side: 's', at: 30 },
    { id: 'win_cafe_e', room: 'cafe', side: 'e', at: -39.3 },
  ],

  // Doors and debris. Prices are in CONFIG.doors.
  doors: [
    { id: 'door_hall', kind: 'door', room: 'court', side: 'e', at: 6, width: 2.6, height: 3.1, zones: ['court', 'hall'], label: 'MAIN HALL' },
    { id: 'door_cafe', kind: 'door', room: 'hall', side: 'n', at: 19.5, width: 2.6, height: 3.0, zones: ['hall', 'cafeteria'], label: 'CAFETERIA' },
    { id: 'debris_office', kind: 'debris', room: 'hall', side: 's', at: 19.5, width: 3.0, height: 3.0, zones: ['hall', 'office'], label: 'FRONT OFFICE' },
    { id: 'door_locker', kind: 'door', room: 'court', side: 'w', at: -6, width: 2.6, height: 3.1, zones: ['court', 'lockers'], label: 'LOCKER ROOMS', locked: true },
  ],

  // Plain openings (no door).
  gaps: [
    { room: 'office', side: 'e', at: 22.65, width: 1.3, height: 2.2 },
  ],

  // Solid furniture and fixtures: [minX, minY, minZ, maxX, maxY, maxZ].
  props: [
    // hallway lockers (west and east walls, with gaps for the door, windows, box and wall buy)
    ...[[-21.5, 4.2], [7.8, 15.5]].map(([z0, z1]) => ({ kind: 'lockers', box: [17.5, 0, z0, 17.95, 2.0, z1], face: 'e' })),
    ...[[-21.5, -9], [-7, -4], [-2, 2.1], [3.9, 8], [10, 15.5]].map(([z0, z1]) => ({ kind: 'lockers', box: [21.05, 0, z0, 21.5, 2.0, z1], face: 'w' })),
    { kind: 'trash', box: [17.95, 0, -17.4, 18.45, 0.9, -16.9] },
    // front office
    { kind: 'counter', box: [18.8, 0, 19.4, 23.4, 1.05, 20.0] },
    { kind: 'counter', box: [22.8, 0, 20.0, 23.4, 1.05, 22.2] },
    { kind: 'cabinets', box: [17.5, 0, 21.2, 18.1, 1.35, 25.2], face: 'e' },
    { kind: 'desk', box: [19.2, 0, 23.4, 20.9, 0.76, 24.3] },
    // principal's office
    { kind: 'desk', box: [27.2, 0, 18.3, 29.2, 0.78, 19.3], pa: true },
    { kind: 'shelf', box: [29.55, 0, 22.2, 30, 2.1, 25.5], face: 'w' },
    // cafeteria
    { kind: 'stage', box: [33.5, 0, -38, 38, 0.9, -25] },
    { kind: 'step', box: [32.6, 0, -32.4, 33.5, 0.45, -29.6] },
    { kind: 'counter', box: [18.4, 0, -40.5, 27.4, 1.0, -39.4], lunch: true },
    ...[-27.4, -31.4, -35.4].flatMap((z) => [21.6, 28.6].map((x) => ({ kind: 'table', box: [x - 2.6, 0, z - 0.45, x + 2.6, 0.76, z + 0.45] }))),
    // mystery box starting spot (solid)
    { kind: 'boxBase', box: [20.93, 0, -3.55, 21.5, 0.62, -2.45] },
  ],

  // Wall weapons: weapon id, owning room/side, position along the wall, height.
  wallBuys: [
    { weapon: 'M15', room: 'court', side: 'e', at: -5, y: 1.5 },
    { weapon: 'Olympus', room: 'hall', side: 'e', at: 3, y: 1.45 },
    { weapon: 'MP41', room: 'cafe', side: 'w', at: -31.4, y: 1.5 },
    { weapon: 'frag', room: 'court', side: 'w', at: 4, y: 1.4 },
  ],

  // Mystery box locations. `start` = where it is at the beginning.
  boxSpots: [
    { id: 'box_hall', room: 'hall', x: 21.2, z: -3, yaw: -Math.PI / 2, start: true },
  ],

  // --- court decoration ------------------------------------------------------
  bleachers: [
    { side: 'north', x0: -10.5, x1: 10.5, rows: 6, rise: 0.42, depth: 0.65 },
    { side: 'south', x0: -10.5, x1: 10.5, rows: 6, rise: 0.42, depth: 0.65 },
  ],
  hoops: [{ x: -17, z: 0, facing: 1 }, { x: 17, z: 0, facing: -1 }],
  banner: { x: 0, y: 5.7, z: -13, width: 11, height: 3.6, text: 'STEW' },
  scoreboard: { x: 0, y: 6.0, z: 13, width: 5.2, height: 2.4 },

  emergencyLights: [
    { x: 16.6, y: 3.9, z: 6 },
    { x: -16.6, y: 3.9, z: -6 },
    { x: 19.5, y: 3.4, z: -22.9 },
    { x: 19.5, y: 3.25, z: 15.6 },
    { x: 37.6, y: 4.3, z: -39.3 },
  ],
};

// Handy derived bounds for exterior dressing.
export function campusBounds(map) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const r of map.rooms) {
    minX = Math.min(minX, r.rect[0] - T); minZ = Math.min(minZ, r.rect[1] - T);
    maxX = Math.max(maxX, r.rect[2] + T); maxZ = Math.max(maxZ, r.rect[3] + T);
  }
  return { minX, minZ, maxX, maxZ };
}
