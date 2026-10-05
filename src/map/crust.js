// =============================================================================
// MAP DATA — Call of the Crust (Map 2). Just the start for now: a big snowy
// field at night under an open sky full of planets, cliffs either side, and
// out across the frozen water to the north, four red-and-white smokestacks
// (after the Northport stacks) you'll eventually get to.
// Same format as school.js. Axes: +X east, +Y up, -Z north. Metres.
//
//            (frozen water)        the four stacks, ~120 m out
//   ............................................................
//   +=========== snowbank (no wall you can see) ===========+  z = -22
//   |  pine          sign          rock            pine    |
//   C                                                      C
//   L  wall gun     truck                         the box  L
//   I                   fire barrel                        I
//   F  rock                         crates                 F
//   F            players start here                pine    F
//   +=========== snowbank ==================================+  z = 24
// =============================================================================

const T = 0.5;

export const CRUST = {
  id: 'crust',
  name: 'Call of the Crust',
  wallThickness: T,
  snow: true,          // the snow world: sky, snowfall, stacks (src/render/crustWorld.js)
  pa: false,           // Erik isn't here
  fog: { color: '#1c2534', density: 0.0075 },

  playerSpawns: [
    { x: 0, z: 16, yaw: 0 },
    { x: -2, z: 17, yaw: 0 },
    { x: 2, z: 17, yaw: 0 },
    { x: 0, z: 18.5, yaw: 0 },
  ],

  rooms: [
    {
      id: 'field', zone: 'field', name: 'The Field', outdoor: true,
      rect: [-26, -22, 26, 24], height: 7, floor: 'snow', style: 'cliff', reverb: 0.25, litter: false,
      // rock cliffs east and west; open to the north (the stacks) and south,
      // where a snowbank and an invisible wall keep you in for now
      walls: { w: { style: 'cliff' }, e: { style: 'cliff' }, n: { style: 'invisible' }, s: { style: 'invisible' } },
      ceiling: 'none',
      fixtures: [
        { x: -15, y: 4.4, z: -12, lit: true, flicker: 0.15, kind: 'lamp' },
        { x: 15, y: 4.4, z: -13, lit: true, flicker: 0.05, kind: 'lamp' },
        { x: -16, y: 4.4, z: 11, lit: true, flicker: 0.6, kind: 'lamp' },
        { x: 15, y: 4.4, z: 13, lit: true, flicker: 0.1, kind: 'lamp' },
      ],
    },
  ],

  navRegions: [{ id: 'field', rect: [-26, -22, 26, 24], room: 'field' }],
  portals: [],
  windows: [],
  doors: [],
  gaps: [],

  // Zombies claw their way up out of the snow.
  groundSpawns: [
    { id: 'snow_nw', room: 'field', x: -20, z: -17 },
    { id: 'snow_n', room: 'field', x: 0, z: -19 },
    { id: 'snow_ne', room: 'field', x: 20, z: -17.5 },
    { id: 'snow_w', room: 'field', x: -22, z: 4 },
    { id: 'snow_e', room: 'field', x: 22, z: 7 },
    { id: 'snow_sw', room: 'field', x: -14, z: 21 },
    { id: 'snow_se', room: 'field', x: 17, z: 20.5 },
  ],

  // Solid things in the field (drawn by crustWorld.js).
  props: [
    { kind: 'truck', box: [-12.6, 0, -7.4, -7.6, 1.9, -4.9], yaw: 0.12 },
    { kind: 'crate', box: [6, 0, 8, 7.2, 1.1, 9.2] },
    { kind: 'crate', box: [7.3, 0, 8.3, 8.3, 0.8, 9.3] },
    { kind: 'crate', box: [6.3, 1.1, 8.2, 7.0, 1.7, 8.9] },
    { kind: 'barrel', box: [-3.35, 0, 4.65, -2.65, 0.95, 5.35], fire: true },
    { kind: 'rock', box: [14, 0, -12, 17, 1.6, -9.6] },
    { kind: 'rock', box: [-18.2, 0, 12, -15.6, 1.3, 14.4] },
    { kind: 'rock', box: [21.5, 0, -3.5, 24, 2.1, -0.8] },
    { kind: 'pine', box: [-20.3, 0, -10.3, -19.7, 7, -9.7] },
    { kind: 'pine', box: [19.2, 0, 15.2, 19.8, 7, 15.8] },
    { kind: 'pine', box: [-22.3, 0, -18.3, -21.7, 7, -17.7] },
    { kind: 'pine', box: [23.2, 0, -19.3, 23.8, 7, -18.7] },
    { kind: 'sign', box: [1.85, 0, -18.15, 2.15, 2.4, -17.85], text: ['THE STACKS', 'KEEP OFF THE ICE'] },
  ],

  // The box against the east cliff; a gun chalked on the west one.
  boxSpots: [
    { id: 'box_field', room: 'field', x: 25.25, z: 3, yaw: -Math.PI / 2, start: true },
  ],
  wallBuys: [
    { weapon: 'MP41', room: 'field', side: 'w', at: -2, y: 1.5 },
    { weapon: 'frag', room: 'field', side: 'w', at: 6, y: 1.4 },
  ],

  // Out across the frozen water: the four stacks and the plant they stand on.
  stacks: [
    { x: -33, z: -152, h: 88 },
    { x: -11, z: -147, h: 88 },
    { x: 11, z: -142, h: 86 },
    { x: 33, z: -137, h: 86 },
  ],
};
