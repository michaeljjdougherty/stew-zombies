// =============================================================================
// MAP DATA — Stew Leonard High
// Pure data read by both the simulation (collision, zones, spawns, pathing)
// and the renderer. Axes: +X east, +Y up, -Z north. Units in meters.
//
// Rooms are rectangles [minX, minZ, maxX, maxZ]. Walls are built around each
// room, 0.5m thick, extending OUTWARD from the rectangle. A side can be
// skipped or limited to ranges where a neighbouring room already owns it.
// Openings (windows, doors, debris, gaps) are cut into the owning wall.
//
// Layout (top = north). Two paths from the court meet at the auditorium:
//
//   +--------------+------------------------------------+
//   | BAND & ART   |        AUDITORIUM (stage, Mad Dog) |----------+
//   +---[door]-----+                                    |  LOADING |
//   |              +------------------------------------+   DOCK   |
//   |   LIBRARY    |                                 +---[door]----+
//   |              |                                 |  KITCHEN  |
//   +---[debris]---+          (yard)                 +--[door]---+-+
//   | SCIENCE LAB  |                     +-----------+  CAFETERIA   |
//   +---[door]-----+-------------------+ |H|---------+-----[door]---+-+
//   | LOCKER ROOMS [door]   COURT      [==]A|                         |
//   +--[debris]----+                   | |L[door]    THE QUAD       |
//   | BOILER ROOM  |                   | |L|        (fountain)      |
//   +--------------+-------------------+ +[debris]-[door]---+-------+
//                                        | OFFICE  |principal|
//                                        +---------+---------+
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
  name: 'Stew Leonard High',
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
        // the Press Box's floodlight over center court (needs the power)
        out.push({ x: 0, z: 0, y: 4.9, lit: false, flicker: 0.1, kind: 'panel' });
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
      id: 'principal', zone: 'office', name: "Teachers' Lounge",
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

    // --- east path -----------------------------------------------------------
    {
      id: 'kitchen', zone: 'kitchen', name: 'Kitchen',
      rect: [24, -52, 38, -41], height: 3.2, floor: 'tile', style: 'kitchen', reverb: 0.5,
      walls: { n: {}, s: { skip: true }, w: {}, e: {} },
      ceiling: 'drop',
      fixtures: fixtureRow([27.5, 34.5], [-49, -44], 3.16, 3, [1]).map((f) => ({ ...f, kind: 'panel' })),
    },
    {
      id: 'dock', zone: 'dock', name: 'Loading Dock', outdoor: true,
      rect: [22, -70, 42, -52.5], height: 3.4, floor: 'asphalt', style: 'exterior', reverb: 0.35,
      walls: { s: { ranges: [[21.5, 23.5], [38.5, 42.5]] }, w: { skip: true }, n: { style: 'fence', height: 3.2 }, e: { style: 'fence', height: 3.2 } },
      ceiling: 'none',
      fixtures: [
        { x: 24.5, y: 4.4, z: -55, lit: true, flicker: 0.6, kind: 'lamp' },
        { x: 40, y: 4.4, z: -67.5, lit: false, flicker: 0, kind: 'lamp' },
      ],
    },
    {
      id: 'auditorium', zone: 'auditorium', name: 'Auditorium',
      rect: [-13.5, -80, 21.5, -52], height: 8, floor: 'wood', style: 'auditorium', reverb: 1.1,
      walls: { w: { ranges: [[-80, -62]] }, e: {}, n: {}, s: {} },
      ceiling: 'trusses',
      fixtures: (() => {
        const out = [];
        let i = 0;
        for (const z of [-75, -66, -58]) for (const x of [-6, 4, 14]) {
          const lit = i === 1 || i === 7;
          out.push({ x, z, y: 7, lit, flicker: i === 7 ? 0.7 : lit ? 0.15 : 0, kind: 'hanging' });
          i++;
        }
        return out;
      })(),
    },

    // --- west path -----------------------------------------------------------
    {
      id: 'lockers', zone: 'lockers', name: 'Locker Rooms',
      rect: [-31, -13, -17.5, 1], height: 3.4, floor: 'tile', style: 'lockerroom', reverb: 0.7,
      walls: { n: {}, s: {}, w: {}, e: { skip: true } },
      ceiling: 'drop',
      fixtures: fixtureRow([-27.5, -21], [-10, -3], 3.36, 3, [3]).map((f) => ({ ...f, kind: 'panel' })),
    },
    {
      id: 'boiler', zone: 'boiler', name: 'Boiler Room',
      rect: [-31, 1.5, -17.5, 12], height: 3.6, floor: 'concrete', style: 'boiler', reverb: 0.9,
      walls: { n: { skip: true }, e: { skip: true }, s: {}, w: {} },
      ceiling: 'trusses',
      fixtures: [
        { x: -22, y: 3.5, z: 4, lit: true, flicker: 0.85, kind: 'panel' },
        { x: -19.6, y: 3.5, z: 8.6, lit: true, flicker: 0.2, kind: 'panel' },
        { x: -28, y: 3.5, z: 10, lit: false, flicker: 0, kind: 'panel' },
      ],
    },
    {
      id: 'lab', zone: 'lab', name: 'Science Lab',
      rect: [-31, -28, -17.5, -13.5], height: 3.4, floor: 'tile', style: 'lab', reverb: 0.45,
      walls: { n: {}, s: { skip: true }, w: {}, e: {} },
      ceiling: 'drop',
      fixtures: fixtureRow([-27.5, -21], [-25, -17], 3.36, 3, [2]).map((f) => ({ ...f, kind: 'panel' })),
    },
    {
      id: 'library', zone: 'library', name: 'Library',
      rect: [-34, -50, -14, -28.5], height: 4.5, floor: 'carpet', style: 'library', reverb: 0.3,
      walls: { n: {}, s: { ranges: [[-34.5, -31.5], [-17, -13.5]] }, w: {}, e: {} },
      ceiling: 'drop',
      fixtures: fixtureRow([-30, -24, -18], [-46, -39.5, -33], 4.46, 4, [4]).map((f) => ({ ...f, kind: 'panel' })),
    },
    {
      id: 'band', zone: 'band', name: 'Band & Art Rooms',
      rect: [-34, -62, -14, -50.5], height: 3.4, floor: 'wood', style: 'band', reverb: 0.55,
      walls: { n: {}, s: { skip: true }, w: {}, e: {} },
      ceiling: 'drop',
      fixtures: fixtureRow([-29, -19], [-59, -54], 3.36, 3, [2]).map((f) => ({ ...f, kind: 'panel' })),
    },

    // --- the Quad (outdoor courtyard for running trains) ---------------------
    {
      id: 'quad', zone: 'quad', name: 'The Quad', outdoor: true,
      rect: [22, -22, 40, 16], height: 4, floor: 'grass', style: 'exterior', reverb: 0.3,
      walls: { n: { ranges: [[38.5, 40.5]] }, s: { ranges: [[30.5, 40.5]] }, w: { skip: true }, e: { style: 'fence', height: 3.2 } },
      ceiling: 'none',
      fixtures: [
        { x: 24.2, y: 4.4, z: -19.5, lit: true, flicker: 0.5, kind: 'lamp' },
        { x: 38, y: 4.4, z: -6, lit: false, flicker: 0, kind: 'lamp' },
        { x: 24.2, y: 4.4, z: 13, lit: false, flicker: 0, kind: 'lamp' },
        { x: 38, y: 4.4, z: 12, lit: false, flicker: 0, kind: 'lamp' },
      ],
    },
  ],

  // Walkable areas for pathing. Checked in order (first match wins), so raised
  // stages come before the floor around them.
  navRegions: [
    { id: 'court', rect: [-17, -13, 17, 13], room: 'court' },
    { id: 'hall', rect: [17.5, -22, 21.5, 16], room: 'hall' },
    // the front counter splits the office; get around it at either end
    { id: 'office', rect: [17.5, 16.5, 25.25, 19.4], room: 'office' },
    { id: 'office_back', rect: [17.5, 19.4, 25.25, 26], room: 'office' },
    { id: 'principal', rect: [25.75, 16.5, 30, 26], room: 'principal' },
    { id: 'stage', rect: [33.5, -38, 38, -25], room: 'cafe' },
    { id: 'cafe', rect: [17.5, -40.5, 38, -22.5], room: 'cafe' },
    { id: 'quad', rect: [22, -22, 40, 16], room: 'quad' },
    { id: 'kitchen', rect: [24, -52, 38, -41], room: 'kitchen' },
    { id: 'dock', rect: [22, -70, 42, -52.5], room: 'dock' },
    { id: 'aud_stage', rect: [-8, -80, 16, -72], room: 'auditorium' },
    { id: 'auditorium', rect: [-13.5, -80, 21.5, -52], room: 'auditorium' },
    { id: 'lockers', rect: [-31, -13, -17.5, 1], room: 'lockers' },
    { id: 'boiler', rect: [-31, 1.5, -17.5, 12], room: 'boiler' },
    { id: 'lab', rect: [-31, -28, -17.5, -13.5], room: 'lab' },
    { id: 'library', rect: [-34, -50, -14, -28.5], room: 'library' },
    { id: 'band', rect: [-34, -62, -14, -50.5], room: 'band' },
  ],

  // Connections between nav regions. `door` = only passable once that door is open.
  // axis: the axis you cross the opening along.
  portals: [
    { a: 'court', b: 'hall', x: 17.25, z: 6, axis: 'x', width: 2.6, door: 'door_hall' },
    { a: 'hall', b: 'cafe', x: 19.5, z: -22.25, axis: 'z', width: 2.6, door: 'door_cafe' },
    { a: 'hall', b: 'office', x: 19.5, z: 16.25, axis: 'z', width: 3.0, door: 'debris_office' },
    { a: 'office', b: 'office_back', x: 18.15, z: 19.7, axis: 'z', width: 1.2 },
    { a: 'office', b: 'office_back', x: 24.3, z: 19.7, axis: 'z', width: 1.8 },
    { a: 'office_back', b: 'principal', x: 25.5, z: 22.65, axis: 'x', width: 1.3 },
    { a: 'cafe', b: 'stage', x: 33.3, z: -31, axis: 'x', width: 2.8 },
    // the Quad
    { a: 'hall', b: 'quad', x: 21.75, z: 9, axis: 'x', width: 2.6, door: 'door_quad_hall' },
    { a: 'cafe', b: 'quad', x: 30, z: -22.25, axis: 'z', width: 2.6, door: 'door_quad_cafe' },
    { a: 'office', b: 'quad', x: 24, z: 16.25, axis: 'z', width: 2.2, door: 'door_quad_office' },
    // east path
    { a: 'cafe', b: 'kitchen', x: 31, z: -40.75, axis: 'z', width: 2.6, door: 'door_kitchen' },
    { a: 'kitchen', b: 'dock', x: 33, z: -52.25, axis: 'z', width: 2.4, door: 'door_dock' },
    { a: 'dock', b: 'auditorium', x: 21.75, z: -61, axis: 'x', width: 2.8, door: 'door_aud_dock' },
    // west path
    { a: 'court', b: 'lockers', x: -17.25, z: -6, axis: 'x', width: 2.6, door: 'door_locker' },
    { a: 'lockers', b: 'boiler', x: -25, z: 1.25, axis: 'z', width: 2.6, door: 'debris_boiler' },
    { a: 'lockers', b: 'lab', x: -24, z: -13.25, axis: 'z', width: 2.6, door: 'door_lab' },
    { a: 'lab', b: 'library', x: -24, z: -28.25, axis: 'z', width: 2.6, door: 'debris_library' },
    { a: 'library', b: 'band', x: -24, z: -50.25, axis: 'z', width: 2.6, door: 'door_band' },
    { a: 'band', b: 'auditorium', x: -13.75, z: -56, axis: 'x', width: 2.8, door: 'door_aud_band' },
    // stage steps
    { a: 'auditorium', b: 'aud_stage', x: -5.5, z: -72, axis: 'z', width: 3 },
    { a: 'auditorium', b: 'aud_stage', x: 13.5, z: -72, axis: 'z', width: 3 },
  ],

  // ---------------------------------------------------------------------------
  // Boarded windows: owning room + side + position along the wall.
  // kind 'fence' = an outdoor chain-link fence zombies climb over (no boards).
  windows: [
    { id: 'win_nw', room: 'court', side: 'n', at: -14 },
    { id: 'win_ne', room: 'court', side: 'n', at: 14 },
    { id: 'win_sw', room: 'court', side: 's', at: -14 },
    { id: 'win_se', room: 'court', side: 's', at: 14 },
    { id: 'win_office', room: 'office', side: 's', at: 21 },
    { id: 'win_principal', room: 'principal', side: 'e', at: 20.5 },
    { id: 'win_cafe_e', room: 'cafe', side: 'e', at: -39.3 },
    // east path
    { id: 'win_kitchen', room: 'kitchen', side: 'e', at: -46.5 },
    { id: 'fence_dock_n1', room: 'dock', side: 'n', at: 27, kind: 'fence' },
    { id: 'fence_dock_n2', room: 'dock', side: 'n', at: 37, kind: 'fence' },
    { id: 'fence_dock_e', room: 'dock', side: 'e', at: -62, kind: 'fence' },
    { id: 'win_aud_s1', room: 'auditorium', side: 's', at: -8 },
    { id: 'win_aud_s2', room: 'auditorium', side: 's', at: 14 },
    { id: 'win_aud_w', room: 'auditorium', side: 'w', at: -76 },
    { id: 'win_aud_e', room: 'auditorium', side: 'e', at: -75 },
    { id: 'win_aud_n', room: 'auditorium', side: 'n', at: -11 },
    // west path
    { id: 'win_lockers_1', room: 'lockers', side: 'w', at: -10 },
    { id: 'win_lockers_2', room: 'lockers', side: 'w', at: -1 },
    { id: 'win_boiler_s', room: 'boiler', side: 's', at: -24 },
    { id: 'win_boiler_w', room: 'boiler', side: 'w', at: 3.5 },
    { id: 'win_lab', room: 'lab', side: 'w', at: -22 },
    { id: 'win_library_1', room: 'library', side: 'w', at: -45 },
    { id: 'win_library_2', room: 'library', side: 'w', at: -34 },
    { id: 'win_library_e', room: 'library', side: 'e', at: -41 },
    { id: 'win_band_n', room: 'band', side: 'n', at: -28 },
    { id: 'win_band_w', room: 'band', side: 'w', at: -56 },
    // the Quad: climb-over fence on the open east side
    { id: 'fence_quad_1', room: 'quad', side: 'e', at: -12, kind: 'fence' },
    { id: 'fence_quad_2', room: 'quad', side: 'e', at: 5, kind: 'fence' },
  ],

  // Zombies can also claw their way up out of the dirt here (outdoor areas).
  groundSpawns: [
    { id: 'dirt_quad_ne', room: 'quad', x: 38.2, z: -20.2 },
    { id: 'dirt_quad_se', room: 'quad', x: 38.2, z: 14.2 },
    { id: 'dirt_quad_nw', room: 'quad', x: 23.8, z: -20.2 },
    { id: 'dirt_dock', room: 'dock', x: 40, z: -68 },
  ],

  // Doors and debris. Prices are in CONFIG.doors.
  doors: [
    { id: 'door_hall', kind: 'door', room: 'court', side: 'e', at: 6, width: 2.6, height: 3.1, zones: ['court', 'hall'], label: 'MAIN HALL' },
    { id: 'door_cafe', kind: 'door', room: 'hall', side: 'n', at: 19.5, width: 2.6, height: 3.0, zones: ['hall', 'cafeteria'], label: 'CAFETERIA' },
    { id: 'debris_office', kind: 'debris', room: 'hall', side: 's', at: 19.5, width: 3.0, height: 3.0, zones: ['hall', 'office'], label: 'FRONT OFFICE' },
    // the Quad
    { id: 'door_quad_hall', kind: 'door', room: 'hall', side: 'e', at: 9, width: 2.6, height: 3.0, zones: ['hall', 'quad'], label: 'THE QUAD' },
    { id: 'door_quad_cafe', kind: 'door', room: 'cafe', side: 's', at: 30, width: 2.6, height: 3.0, zones: ['cafeteria', 'quad'], label: 'THE QUAD' },
    { id: 'door_quad_office', kind: 'door', room: 'office', side: 'n', at: 24, width: 2.2, height: 2.9, zones: ['office', 'quad'], label: 'THE QUAD' },
    // east path
    { id: 'door_kitchen', kind: 'door', room: 'cafe', side: 'n', at: 31, width: 2.6, height: 3.0, zones: ['cafeteria', 'kitchen'], label: 'KITCHEN' },
    { id: 'door_dock', kind: 'door', room: 'kitchen', side: 'n', at: 33, width: 2.4, height: 2.9, zones: ['kitchen', 'dock'], label: 'LOADING DOCK' },
    { id: 'door_aud_dock', kind: 'door', room: 'auditorium', side: 'e', at: -61, width: 2.8, height: 3.2, zones: ['dock', 'auditorium'], label: 'AUDITORIUM' },
    // west path
    { id: 'door_locker', kind: 'door', room: 'court', side: 'w', at: -6, width: 2.6, height: 3.1, zones: ['court', 'lockers'], label: 'LOCKER ROOMS' },
    { id: 'debris_boiler', kind: 'debris', room: 'lockers', side: 's', at: -25, width: 2.6, height: 3.0, zones: ['lockers', 'boiler'], label: 'BOILER ROOM' },
    { id: 'door_lab', kind: 'door', room: 'lockers', side: 'n', at: -24, width: 2.6, height: 3.0, zones: ['lockers', 'lab'], label: 'SCIENCE LAB' },
    { id: 'debris_library', kind: 'debris', room: 'lab', side: 'n', at: -24, width: 2.6, height: 3.0, zones: ['lab', 'library'], label: 'LIBRARY' },
    { id: 'door_band', kind: 'door', room: 'library', side: 'n', at: -24, width: 2.6, height: 3.0, zones: ['library', 'band'], label: 'BAND & ART' },
    { id: 'door_aud_band', kind: 'door', room: 'band', side: 'e', at: -56, width: 2.8, height: 3.1, zones: ['band', 'auditorium'], label: 'AUDITORIUM' },
  ],

  // Plain openings (no door).
  gaps: [
    { room: 'office', side: 'e', at: 22.65, width: 1.3, height: 2.2 },
  ],

  // Solid furniture and fixtures: [minX, minY, minZ, maxX, maxY, maxZ].
  props: [
    // hallway lockers (west and east walls, with gaps for the doors, box and wall buy)
    ...[[-21.5, 4.2], [7.8, 15.5]].map(([z0, z1]) => ({ kind: 'lockers', box: [17.5, 0, z0, 17.95, 2.0, z1], face: 'e' })),
    ...[[-21.5, -4], [-2, 2.1], [3.9, 7.5], [10.5, 15.5]].map(([z0, z1]) => ({ kind: 'lockers', box: [21.05, 0, z0, 21.5, 2.0, z1], face: 'w' })),
    { kind: 'trash', box: [17.95, 0, -17.4, 18.45, 0.9, -16.9] },
    // front office
    { kind: 'counter', box: [18.8, 0, 19.4, 23.4, 1.05, 20.0] },
    { kind: 'cabinets', box: [17.5, 0, 21.2, 18.1, 1.35, 25.2], face: 'e' },
    { kind: 'desk', box: [19.2, 0, 23.4, 20.9, 0.76, 24.3] },
    // teachers' lounge (the old principal's office)
    { kind: 'desk', box: [27.2, 0, 18.3, 29.2, 0.78, 19.3], pa: true },
    { kind: 'shelf', box: [29.55, 0, 22.2, 30, 2.1, 25.5], face: 'w' },
    // cafeteria
    { kind: 'stage', box: [33.5, 0, -38, 38, 0.9, -25] },
    { kind: 'step', box: [32.6, 0, -32.4, 33.5, 0.45, -29.6] },
    { kind: 'counter', box: [18.4, 0, -40.5, 27.4, 1.0, -39.4], lunch: true },
    ...[-27.4, -31.4, -35.4].flatMap((z) => [21.6, 28.6].map((x) => ({ kind: 'table', box: [x - 2.6, 0, z - 0.45, x + 2.6, 0.76, z + 0.45] }))),

    // kitchen
    { kind: 'counter', box: [24, 0, -50.5, 24.75, 0.95, -42], steel: true },
    { kind: 'stove', box: [25, 0, -52, 30.5, 0.95, -51.25] },
    { kind: 'counter', box: [27, 0, -47.6, 33, 0.95, -45.8], steel: true },
    { kind: 'fridge', box: [37.2, 0, -44.2, 38, 2.1, -41.2] },
    // loading dock
    { kind: 'bus', box: [29.2, 0, -67.2, 31.8, 2.8, -57.6] },
    { kind: 'dumpster', box: [38.2, 0, -56.2, 40.6, 1.4, -54.4] },
    { kind: 'dumpster', box: [23, 0, -69.5, 24.8, 1.4, -67.3] },
    // auditorium
    { kind: 'stage', box: [-8, 0, -80, 16, 0.9, -72], curtains: true },
    { kind: 'step', box: [-7, 0, -72, -4, 0.45, -71.2] },
    { kind: 'step', box: [12, 0, -72, 15, 0.45, -71.2] },
    { kind: 'booth', box: [2, 0, -63, 7, 1.25, -59] },
    { kind: 'seats', box: [-10.5, 0, -69, -6.5, 0.85, -58] },
    { kind: 'seats', box: [14.5, 0, -69, 18.5, 0.85, -58] },
    { kind: 'madDogBase', box: [2.6, 0.9, -78.4, 5.4, 3.3, -75.8] },
    // locker rooms
    ...[[-31, -26.6], [-23.4, -17.5]].map(([x0, x1]) => ({ kind: 'lockers', box: [x0, 0, 0.55, x1, 2.0, 1], face: 'n' })),
    { kind: 'lockers', box: [-20.2, 0, -13, -17.5, 2.0, -12.55], face: 's' },
    { kind: 'bench', box: [-29, 0, -8.6, -20, 0.45, -8.2] },
    { kind: 'bench', box: [-29, 0, -4.4, -20, 0.45, -4.0] },
    // boiler room
    { kind: 'boiler', box: [-29.5, 0, 5, -24.5, 3.0, 9.5] },
    { kind: 'pipes', box: [-31, 0, 10.6, -26, 1.2, 12] },
    // science lab
    { kind: 'labBench', box: [-28.5, 0, -24.4, -22.5, 0.92, -23.4] },
    { kind: 'labBench', box: [-28.5, 0, -19.6, -22.5, 0.92, -18.6] },
    { kind: 'cabinets', box: [-31, 0, -28, -26.6, 1.9, -27.4], face: 's', glow: true },
    { kind: 'cabinets', box: [-21.4, 0, -28, -17.5, 1.9, -27.4], face: 's', glow: true },
    // library: two rows of shelves to loop around, a desk by the door
    { kind: 'shelfRow', box: [-29, 0, -42.6, -19, 2.3, -41.8] },
    { kind: 'shelfRow', box: [-29, 0, -37.4, -19, 2.3, -36.6] },
    { kind: 'shelf', box: [-34, 0, -41, -33.4, 2.3, -36], face: 'e' },
    { kind: 'desk', box: [-20.5, 0, -31.8, -17, 0.95, -30.8] },
    { kind: 'table', box: [-18.4, 0, -47.6, -15.8, 0.76, -45.8] },
    // band & art
    { kind: 'piano', box: [-32.6, 0, -61, -30, 1.1, -59.4] },
    { kind: 'step', box: [-33, 0, -55, -27, 0.3, -53.6], riser: true },
    { kind: 'divider', box: [-24.1, 0, -62, -23.9, 1.3, -57.5] },
    { kind: 'easel', box: [-20.5, 0, -57.2, -19.7, 1.7, -56.6] },
    { kind: 'easel', box: [-17.6, 0, -55.4, -16.8, 1.7, -54.8] },
    { kind: 'table', box: [-22, 0, -53.4, -17, 0.76, -52.4] },
    // the Quad: dead fountain on a raised planter, benches at the edges
    { kind: 'planter', box: [27, 0, -7, 35, 0.6, 1], fountain: true },
    { kind: 'bench', box: [22.6, 0, -16, 23.1, 0.45, -13] },
    { kind: 'bench', box: [22.6, 0, 1, 23.1, 0.45, 4] },
    { kind: 'bench', box: [33, 0, 15.3, 36, 0.45, 15.8] },

    // Stew Leonard High dressing (src/render/storyProps.js): fiberglass dairy
    // cows, the animatronic cow band on the cafeteria stage, the Rule #1 rock
    { kind: 'cow', box: [35.3, 0, -24.3, 37.6, 1.85, -23.0], yaw: Math.PI, plinth: true },
    { kind: 'cow', box: [32.8, 0, 9.0, 35.1, 1.85, 10.2], yaw: Math.PI, plinth: true },
    { kind: 'animatronic', box: [34.6, 0.9, -35.2, 37.6, 3.0, -33.4], yaw: Math.PI },
    { kind: 'animatronic', box: [34.6, 0.9, -29.6, 37.6, 3.0, -27.8], yaw: Math.PI },
    { kind: 'rock', box: [25.4, 0, 12.4, 27.6, 1.1, 13.6] },
  ],

  // Wall weapons: weapon id, owning room/side, position along the wall, height.
  wallBuys: [
    { weapon: 'M15', room: 'court', side: 'e', at: -5, y: 1.5 },
    { weapon: 'Olympus', room: 'hall', side: 'e', at: 3, y: 1.45 },
    { weapon: 'MP41', room: 'cafe', side: 'w', at: -31.4, y: 1.5 },
    { weapon: 'frag', room: 'court', side: 'w', at: 4, y: 1.4 },
    { weapon: 'PM64', room: 'quad', side: 'n', at: 25, y: 1.5 },
    { weapon: 'Staykout', room: 'dock', side: 's', at: 26.5, y: 1.5 },
    { weapon: 'MP6K', room: 'lockers', side: 'n', at: -28.5, y: 1.5 },
    { weapon: 'AK-75u', room: 'lab', side: 'w', at: -16, y: 1.5 },
    { weapon: 'M17', room: 'library', side: 'e', at: -32.5, y: 1.5 },
    { weapon: 'MPK', room: 'band', side: 's', at: -30, y: 1.5 },
  ],

  // Mystery box locations. `start` = where it is at the beginning. The box
  // sits against a wall, facing `yaw` (its front points into the room).
  boxSpots: [
    { id: 'box_hall', room: 'hall', x: 21.2, z: -3, yaw: -Math.PI / 2, start: true },
    { id: 'box_quad', room: 'quad', x: 35, z: -21.7, yaw: 0 },
    { id: 'box_dock', room: 'dock', x: 36.5, z: -52.8, yaw: Math.PI },
    { id: 'box_library', room: 'library', x: -33.7, z: -48, yaw: Math.PI / 2 },
    { id: 'box_auditorium', room: 'auditorium', x: 9, z: -52.3, yaw: Math.PI },
  ],

  // Power switch (boiler room) and what needs it.
  powerSwitch: { room: 'boiler', side: 'e', at: 8, y: 1.3 },

  // Perk machines against a wall.
  perkMachines: [
    { perk: 'secondHelping', room: 'court', side: 'w', at: 9 },
    { perk: 'beefcakeBroth', room: 'cafe', side: 'w', at: -24.6 },
    { perk: 'hotPotHustle', room: 'lab', side: 'e', at: -21 },
    { perk: 'doubleLadle', room: 'band', side: 'n', at: -18 },
    { perk: 'marathonMinestrone', room: 'auditorium', side: 'w', at: -66 },
  ],

  // The Mad Dog Machine, center stage in the auditorium, facing the seats.
  madDog: { room: 'auditorium', x: 4, z: -77.1, y: 0.9, yaw: 0 },

  // Electric traps across doorways. Box = the deadly area [minX, minZ, maxX, maxZ].
  traps: [
    { id: 'trap_lab', box: [-25.3, -14.6, -22.7, -11.9], axis: 'x', lever: { room: 'lockers', side: 'n', at: -20.8, y: 1.3 }, label: 'Science Lab' },
    { id: 'trap_dock', box: [31.8, -53.6, 34.2, -50.9], axis: 'x', lever: { room: 'kitchen', side: 'n', at: 36, y: 1.3 }, label: 'Loading Dock' },
  ],

  // --- story ---------------------------------------------------------------
  // The PA handset on the teachers' lounge table: talk back to Erik.
  intercom: { x: 28.0, y: 1.08, z: 18.8 },

  // Notes to read (words in src/lore/erik.js). `wall` = pinned to a wall
  // facing `yaw`; otherwise lying flat on whatever is under it.
  notes: [
    { id: 'flyer', x: 16.98, y: 1.55, z: 10, yaw: -Math.PI / 2, wall: true },
    { id: 'detention', x: 20.1, y: 0.765, z: 23.85, yaw: 0.3 },
    { id: 'labnotes', x: -25.6, y: 0.925, z: -23.9, yaw: -0.2 },
    { id: 'recipe', x: 29.4, y: 0.955, z: -46.7, yaw: 0.5 },
    { id: 'boiler', x: -27.6, y: 1.205, z: 11.0, yaw: 0.1 },
    { id: 'library', x: -18.2, y: 0.955, z: -31.3, yaw: -0.4 },
    { id: 'maddog', x: 6.7, y: 0.905, z: -76.4, yaw: 0.25 },
    { id: 'contract', x: 28.75, y: 0.785, z: 18.75, yaw: -0.35 },
  ],

  // The three Stew items for the song Easter egg. Small and easy to miss.
  stewItems: [
    { id: 'ladle', x: 26.1, y: 0.955, z: -51.62, yaw: 0.4 },
    { id: 'tape', x: -30.45, y: 1.105, z: -59.85, yaw: -0.7 },
    { id: 'can', x: -18.9, y: 2.0, z: -12.78, yaw: 0 },
  ],

  // Wall-mounted PA speakers (Erik's voice; the light comes on when he talks).
  paSpeakers: [
    { room: 'court', side: 'e', at: -11, y: 6.6 },
    { room: 'court', side: 'w', at: 11, y: 6.6 },
    { room: 'hall', side: 'e', at: -12, y: 2.9 },
    { room: 'office', side: 's', at: 21, y: 2.7 },
    { room: 'principal', side: 's', at: 28, y: 2.7 },
    { room: 'cafe', side: 'e', at: -23.5, y: 4.2 },
    { room: 'kitchen', side: 'w', at: -44, y: 2.7 },
    { room: 'auditorium', side: 'e', at: -70, y: 6.2 },
    { room: 'auditorium', side: 'w', at: -60, y: 6.2 },
    { room: 'lockers', side: 'e', at: -10, y: 2.9 },
    { room: 'boiler', side: 'n', at: -20, y: 3.0 },
    { room: 'lab', side: 'e', at: -26, y: 2.9 },
    { room: 'library', side: 'w', at: -30, y: 3.8 },
    { room: 'band', side: 'n', at: -28, y: 2.9 },
    { room: 'quad', side: 'w', at: 11, y: 3.3, horn: true },
  ],

  // Posters, banners and graffiti (drawn in code: src/render/decals.js).
  decals: [
    { kind: 'vote', room: 'court', side: 'e', at: -10, y: 1.75, w: 0.9, h: 1.25, graffiti: true },
    { kind: 'pennant', room: 'court', side: 'w', at: -10.5, y: 2.6, w: 2.2, h: 0.9 },
    { kind: 'reunion', room: 'court', side: 's', at: -9.5, y: 6.2, w: 6, h: 1.3 },
    { kind: 'noRunning', room: 'hall', side: 'w', at: -10, y: 2.6, w: 0.85, h: 0.6 },
    { kind: 'vote', room: 'hall', side: 'e', at: 12.5, y: 2.6, w: 0.6, h: 0.82 },
    { kind: 'menu', room: 'cafe', side: 'n', at: 22.9, y: 2.75, w: 2.6, h: 1.15 },
    { kind: 'reunion', room: 'cafe', side: 's', at: 24.75, y: 3.6, w: 6, h: 1.1 },
    { kind: 'sourMilk', x: 37.185, y: 1.45, z: -42.6, yaw: -Math.PI / 2, w: 0.32, h: 0.26 },
    { kind: 'scienceFair', room: 'lab', side: 'w', at: -25.6, y: 1.75, w: 0.85, h: 1.1 },
    { kind: 'read', room: 'library', side: 'e', at: -36.5, y: 1.9, w: 0.8, h: 1.1 },
    { kind: 'concert', room: 'band', side: 's', at: -20, y: 1.7, w: 0.85, h: 1.15 },
    { kind: 'graffitiStew', room: 'lockers', side: 'w', at: -5.5, y: 1.5, w: 2.4, h: 1.1 },
    { kind: 'monitor', room: 'office', side: 'w', at: 23.2, y: 2.05, w: 0.6, h: 0.75 },
    { kind: 'vote', room: 'principal', side: 'w', at: 18.6, y: 1.7, w: 0.6, h: 0.82 },
    { kind: 'madDogsBanner', x: 4, y: 5.1, z: -79.38, yaw: 0, w: 8, h: 1.6 }, // on the back curtain
    { kind: 'talentShow', room: 'auditorium', side: 's', at: 2, y: 2.2, w: 0.9, h: 1.25 },
    { kind: 'graffitiWeGo', room: 'quad', side: 'w', at: -7, y: 1.5, w: 3.4, h: 1.3 },
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
    { x: -18, y: 3.2, z: 2.2 },
    { x: -24, y: 3.2, z: -27.6 },
    { x: 31, y: 3.0, z: -41.2 },
    { x: -14.2, y: 3.0, z: -56 },
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
