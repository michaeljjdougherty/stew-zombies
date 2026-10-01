// =============================================================================
// MAP DATA — the JROTC firing range under Last Bell High.
// Used by Firing Range mode (main menu). Same format as school.js.
//
// Layout (top = north, downrange):
//
//   +-------------------------+  z = -58   sand berm
//   |   .   .   .   .   .     |
//   |   target dummies at     |  signs + floor lines at 10 / 25 / 50 m
//   |   5 to 50 m             |
//   |                         |
//   |==booth=|  walk  |=booth=|  z = 0     firing line (counters)
//   |  box     armory    frag |
//   +-------------------------+  z = 7
// =============================================================================

const T = 0.5;

const lanes = [-6.3, -3, 3, 6.3];
const fixtures = [];
// armory
for (const x of [-4.5, 0, 4.5]) for (const z of [2.2, 5.2]) fixtures.push({ x, y: 3.56, z, lit: true, flicker: x === 4.5 && z === 5.2 ? 0.7 : 0.08, kind: 'panel' });
// downrange: two rows of panels the whole way down
for (let z = -5; z >= -54; z -= 7) for (const x of [-4, 4]) fixtures.push({ x, y: 3.56, z, lit: true, flicker: z === -33 && x === 4 ? 0.85 : 0.1, kind: 'panel' });

export const RANGE = {
  id: 'range',
  name: 'Basement Range',
  wallThickness: T,

  playerSpawns: [
    { x: 0, z: 3, yaw: 0 },
    { x: -3, z: 3, yaw: 0 },
    { x: 3, z: 3, yaw: 0 },
    { x: 0, z: 5, yaw: 0 },
  ],

  rooms: [
    {
      id: 'range', zone: 'range', name: 'Firing Range',
      rect: [-8, -58, 8, 7], height: 3.6, floor: 'concrete', style: 'range', reverb: 0.75, litter: false,
      walls: { n: {}, s: {}, w: {}, e: {} },
      ceiling: 'drop',
      fixtures,
    },
  ],

  navRegions: [{ id: 'range', rect: [-8, -58, 8, 7], room: 'range' }],
  portals: [],
  windows: [],
  doors: [],
  gaps: [],

  props: [
    // firing line: two booth counters with a walkway down the middle
    { kind: 'counter', box: [-8, 0, -0.35, -1.3, 1.05, 0.35] },
    { kind: 'counter', box: [1.3, 0, -0.35, 8, 1.05, 0.35] },
    // booth dividers
    ...[-4.65, 4.65].map((x) => ({ kind: 'divider', box: [x - 0.04, 0, -1.6, x + 0.04, 1.9, 0.35] })),
    // sand berm at the far end
    { kind: 'berm', box: [-8, 0, -58, 8, 1.3, -55.4] },
    { kind: 'berm', box: [-8, 1.3, -58, 8, 2.4, -56.7] },
    // armory tables and the box
    { kind: 'table', box: [-3.6, 0, 5.7, -0.6, 0.78, 6.5] },
    { kind: 'table', box: [0.6, 0, 5.7, 3.6, 0.78, 6.5] },
    { kind: 'cabinets', box: [7.4, 0, 4.6, 8, 1.35, 6.8], face: 'w' },
    { kind: 'trash', box: [-7.5, 0, 6.2, -7, 0.9, 6.7] },
    { kind: 'boxBase', box: [-8, 0, 2.95, -7.43, 0.62, 4.05] },
  ],

  wallBuys: [
    { weapon: 'frag', room: 'range', side: 'e', at: 2.6, y: 1.4 },
  ],

  boxSpots: [
    { id: 'box_range', room: 'range', x: -7.7, z: 3.5, yaw: Math.PI / 2, start: true },
  ],

  // Target dummy spots (they stand back up after dying).
  targets: [
    { x: lanes[0], z: -6 }, { x: lanes[1], z: -10 }, { x: lanes[2], z: -10 }, { x: lanes[3], z: -6 },
    // a tight group for shotguns and explosives
    { x: -0.7, z: -16, strafe: 0.6 }, { x: 0.7, z: -16, strafe: 0.6 }, { x: -0.3, z: -17.3, strafe: 0.6 }, { x: 0.8, z: -17.6, strafe: 0.6 },
    { x: -4.2, z: -25 }, { x: 4.2, z: -25 },
    { x: -2, z: -38 }, { x: 2.5, z: -50 },
  ],

  // Where a called-in horde appears.
  hordeSpawns: [{ x: -4, z: -52 }, { x: 0, z: -53 }, { x: 4, z: -52 }],

  // Distance markers (metres from the firing line), on both walls and the floor.
  distanceMarks: [5, 10, 25, 50],

  emergencyLights: [{ x: 0, y: 3.2, z: 6.6 }],
};
