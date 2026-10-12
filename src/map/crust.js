// =============================================================================
// MAP DATA — Call of the Crust (Map 2), early build.
// Laid out like Call of the Dead: a box canyon to start in, two ways out that
// you buy open, and a loop round the frozen shore between them; with narrow,
// Origins-style trenches cut through the snow on the west side. Night, snow,
// a sky full of planets, and four smokestacks out across the ice.
// Same format as school.js (rooms, walls, doors, windows, nav regions).
// Axes: +X east, +Y up, -Z north. Metres.
//
//            ~ ~ ~ frozen sea ~ ~ ~        the four stacks, ~150 m out
//   +----------------+---------------------------+-----------------+
//   | LIGHTHOUSE     |      THE LAGOON           |  THE SHORE   +--+--------+
//   |  POINT    [LH] |   (ice, slush slows you)  |              | SHIP'S    |
//   HUT [door]       |                           |              | HOLD      |
//   |                |                           |   [door] ----+-----------+
//   +---[debris]-----+---------------------------+                 |
//        |  |                                    |                 |
//    DUG-|T4|-DUG       (solid cliff)            +--[debris]--+----+
//    OUT |  |                                    | FISHING CAMP    [door] CABIN
//    +---+T3+                                    |                 |
//    |T2|                                        |                 |
//  DUG|  |                                       |                 |
//    |  +========T1========[debris] LANDING [debris]---------------+
//    +--+                         (spawn)        |
//                                 +--------------+
// =============================================================================

const T = 0.5;

// --- rooms -----------------------------------------------------------------------------
const outside = (id, zone, name, rect, walls, extra = {}) => ({ id, zone, name, outdoor: true, rect, height: 7, floor: 'snow', style: 'cliff', reverb: 0.3, litter: false, ceiling: 'none', walls, ...extra });
const trench = (id, rect, walls, extra = {}) => ({ id, zone: 'trenches', name: 'The Trenches', outdoor: true, rect, height: 2.6, floor: 'duckboard', style: 'trench', reverb: 0.35, litter: false, ceiling: 'none', walls, ...extra });
const inside = (id, zone, name, rect, walls, extra = {}) => ({ id, zone, name, rect, height: 3.2, floor: 'wood', style: 'cabin', ceilingMat: 'planks', reverb: 0.3, litter: false, walls, ...extra });

const ROOMS = [
  // The Landing: where you come down. A snowy box canyon, cliffs all round.
  outside('landing', 'landing', 'The Landing', [-12, 6, 12, 30], { n: {}, s: {}, w: {}, e: {} }, {
    fixtures: [
      { x: -8, y: 4.4, z: 26, lit: true, flicker: 0.1, kind: 'lamp' },
      { x: 9, y: 4.4, z: 10, lit: true, flicker: 0.5, kind: 'lamp' },
    ],
  }),

  // The trenches (Origins-narrow): west out of the Landing, north to the point.
  trench('t1', [-34, 10, -12.5, 12.6], { n: {}, s: {} }, { fixtures: [{ x: -23, y: 2.3, z: 12.3, lit: true, flicker: 0.3, kind: 'lamp' }] }),
  trench('t2', [-37.1, -22.6, -34.5, 12.6], { n: {}, s: {}, w: {}, e: {} }, { fixtures: [{ x: -36.8, y: 2.3, z: -10, lit: true, flicker: 0.2, kind: 'lamp' }] }),
  trench('t3', [-34, -22.6, -24, -20], { n: {}, s: {} }),
  trench('t4', [-23.5, -46, -20.9, -20], { w: {}, e: {}, s: {} }, { fixtures: [{ x: -21.2, y: 2.3, z: -40, lit: true, flicker: 0.15, kind: 'lamp' }] }),
  // dugouts off the trenches (roofed), each with a gun on the wall
  trench('dug_w', [-45, -5, -37.6, -1], { n: {}, s: {}, w: {} }, { name: 'West Dugout', ceiling: 'planks', ceilingMat: 'planks', height: 2.4, outdoor: false, fixtures: [{ x: -41, y: 2.1, z: -3, lit: true, flicker: 0.25, kind: 'hanging' }] }),
  trench('dug_e', [-20.4, -36, -15, -30], { n: {}, s: {}, e: {} }, { name: 'East Dugout', ceiling: 'planks', ceilingMat: 'planks', height: 2.4, outdoor: false, fixtures: [{ x: -17.7, y: 2.1, z: -33, lit: true, flicker: 0.1, kind: 'hanging' }] }),

  // Lighthouse Point: the lighthouse on its rock, and the keeper's hut in the cliff.
  outside('point', 'point', 'Lighthouse Point', [-56, -84, -16, -46.5], { n: { style: 'invisible' }, s: {}, w: {} }, {
    fixtures: [{ x: -30, y: 4.4, z: -60, lit: true, flicker: 0.05, kind: 'lamp' }],
  }),
  inside('hut', 'hut', "Keeper's Hut", [-68.5, -70, -56.5, -58], { n: {}, s: {}, w: {} }, {
    fixtures: [{ x: -62.5, y: 2.9, z: -64, lit: true, flicker: 0.4, kind: 'hanging' }],
  }),

  // The Lagoon: frozen over, but the slush in it holds you back.
  outside('lagoon', 'lagoon', 'The Lagoon', [-15.5, -84, 22, -46.5], { n: { style: 'invisible' }, s: {} }, { floor: 'ice' }),

  // The Fishing Camp: east out of the Landing. A cabin on its far side.
  outside('camp', 'camp', 'Fishing Camp', [12.5, -20, 44, 22], { n: {}, s: {}, w: { ranges: [[-20, 6]] }, e: {} }, {
    fixtures: [
      { x: 28, y: 4.4, z: 4, lit: true, flicker: 0.1, kind: 'lamp' },
      { x: 40, y: 4.4, z: -16, lit: true, flicker: 0.6, kind: 'lamp' },
    ],
  }),
  inside('cabin', 'cabin', 'The Cabin', [44.5, -12, 56, 0], { n: {}, s: {}, e: {} }, {
    fixtures: [{ x: 50, y: 2.9, z: -6, lit: true, flicker: 0.15, kind: 'hanging' }],
  }),

  // The Shore: the strip along the ice where the ship ran aground.
  outside('shore', 'shore', 'The Shore', [22.5, -84, 48, -20.5], { n: { style: 'invisible', ranges: [[22, 23.5], [46.5, 48.5]] }, s: { ranges: [[44.5, 48.5]] }, w: { ranges: [[-46.5, -20.5]] }, e: {} }, {
    fixtures: [{ x: 35, y: 4.4, z: -78, lit: true, flicker: 0.2, kind: 'lamp' }],
  }),
  // The ship's hold, down in the hull (the ship sits frozen in the ice).
  inside('hold', 'hold', "Ship's Hold", [24, -104, 46, -84.5], { n: {}, s: {}, w: {}, e: {} }, {
    height: 4.2, floor: 'deck', style: 'hull', ceilingMat: 'hullCeil', reverb: 0.8,
    fixtures: [
      { x: 30, y: 3.9, z: -94, lit: true, flicker: 0.3, kind: 'hanging' },
      { x: 40, y: 3.9, z: -94, lit: true, flicker: 0.05, kind: 'hanging' },
    ],
  }),
];

// --- doors (debris and doors you buy) --------------------------------------------------
const DOORS = [
  { id: 'debris_trench', kind: 'debris', room: 'landing', side: 'w', at: 11.3, width: 2.6, height: 2.6, zones: ['landing', 'trenches'], label: 'THE TRENCHES' },
  { id: 'debris_camp', kind: 'debris', room: 'landing', side: 'e', at: 13, width: 3.0, height: 3.2, zones: ['landing', 'camp'], label: 'FISHING CAMP' },
  { id: 'debris_point', kind: 'debris', room: 'point', side: 's', at: -22.2, width: 2.6, height: 2.6, zones: ['trenches', 'point'], label: 'LIGHTHOUSE POINT' },
  { id: 'door_hut', kind: 'door', room: 'point', side: 'w', at: -64, width: 2.0, height: 2.5, zones: ['point', 'hut'], label: "KEEPER'S HUT" },
  { id: 'door_cabin', kind: 'door', room: 'camp', side: 'e', at: -6, width: 2.0, height: 2.5, zones: ['camp', 'cabin'], label: 'THE CABIN' },
  { id: 'debris_shore', kind: 'debris', room: 'camp', side: 'n', at: 33, width: 3.0, height: 3.2, zones: ['camp', 'shore'], label: 'THE SHORE' },
  { id: 'door_hold', kind: 'door', room: 'hold', side: 's', at: 35, width: 2.4, height: 2.8, zones: ['shore', 'hold'], label: "SHIP'S HOLD" },
];
// always-open gaps in the trench walls (corners and dugouts)
const GAPS = [
  { room: 't2', side: 'e', at: 11.3, width: 2.6, height: 2.6, to: 't1' },
  { room: 't2', side: 'e', at: -21.3, width: 2.6, height: 2.6, to: 't3' },
  { room: 't4', side: 'w', at: -21.3, width: 2.6, height: 2.6, to: 't3' },
  { room: 't2', side: 'w', at: -3, width: 2.0, height: 2.2, to: 'dug_w' },
  { room: 't4', side: 'e', at: -33, width: 2.0, height: 2.2, to: 'dug_e' },
];
// where the doors lead (the room on the other side)
const DOOR_TO = { debris_trench: 't1', debris_camp: 'camp', debris_point: 't4', door_hut: 'hut', door_cabin: 'cabin', debris_shore: 'shore', door_hold: 'shore' };

// --- navigation: one region per room, portals at every opening -----------------------
function portalAt(roomId, side, at) {
  const r = ROOMS.find((q) => q.id === roomId).rect;
  if (side === 'n') return { x: at, z: r[1] - T / 2, axis: 'z' };
  if (side === 's') return { x: at, z: r[3] + T / 2, axis: 'z' };
  if (side === 'w') return { x: r[0] - T / 2, z: at, axis: 'x' };
  return { x: r[2] + T / 2, z: at, axis: 'x' };
}
const PORTALS = [
  ...DOORS.map((d) => ({ a: d.room, b: DOOR_TO[d.id], ...portalAt(d.room, d.side, d.at), width: d.width, door: d.id })),
  ...GAPS.map((g) => ({ a: g.room, b: g.to, ...portalAt(g.room, g.side, g.at), width: g.width })),
  // the open shoreline: the point, the lagoon and the shore run into each other
  { a: 'point', b: 'lagoon', x: -15.75, z: -65.25, axis: 'x', width: 37.5 },
  { a: 'lagoon', b: 'shore', x: 22.25, z: -65.25, axis: 'x', width: 37.5 },
];

// --- zombies claw up out of the snow (and the ice) --------------------------------------
function groundSpawns() {
  const out = [];
  const add = (room, x, z) => out.push({ id: `rise_${room}_${out.length}`, room, x, z });
  const grid = (room, xs, zs) => { for (const x of xs) for (const z of zs) add(room, x, z); };
  grid('landing', [-9, 0, 9], [9, 25]);
  for (const x of [-30, -20]) add('t1', x, 11.3);
  for (const z of [5, -8, -18]) add('t2', -35.8, z);
  add('t3', -29, -21.3);
  for (const z of [-26, -39]) add('t4', -22.2, z);
  for (const [x, z] of [[-42, -80], [-24, -80], [-50, -68], [-38, -68], [-24, -66], [-50, -52], [-38, -52]]) add('point', x, z);
  grid('lagoon', [-10, 4, 17], [-80, -64, -51]);
  grid('camp', [16, 28, 40], [-16, 0, 15]);
  grid('shore', [26, 36, 45], [-80, -60, -40, -25]);
  return out;
}

export const CRUST = {
  id: 'crust',
  name: 'Call of the Crust',
  wallThickness: T,
  snow: true,          // the snow world: sky, snowfall, stacks, props (src/render/crustWorld.js)
  pa: false,           // nobody on the speakers yet (The Shntitz comes later)
  fog: { color: '#1c2534', density: 0.0075 },

  playerSpawns: [
    { x: 0, z: 22, yaw: 0 },
    { x: -2, z: 23, yaw: 0 },
    { x: 2, z: 23, yaw: 0 },
    { x: 0, z: 24.5, yaw: 0 },
  ],

  rooms: ROOMS,
  navRegions: ROOMS.map((r) => ({ id: r.id, rect: r.rect, room: r.id })),
  portals: PORTALS,
  doors: DOORS,
  gaps: GAPS.map(({ to, ...g }) => g),

  // boarded windows the zombies tear their way in through
  windows: [
    { id: 'win_hut_n', room: 'hut', side: 'n', at: -63 },
    { id: 'win_hut_w', room: 'hut', side: 'w', at: -64 },
    { id: 'win_cabin_e', room: 'cabin', side: 'e', at: -6 },
    { id: 'win_cabin_n', room: 'cabin', side: 'n', at: 50 },
    { id: 'win_hold_w', room: 'hold', side: 'w', at: -95 },
    { id: 'win_hold_e', room: 'hold', side: 'e', at: -93 },
    { id: 'win_hold_n', room: 'hold', side: 'n', at: 35 },
  ],

  groundSpawns: groundSpawns(),

  // Solid things (drawn by crustWorld.js).
  props: [
    // the Landing
    { kind: 'truck', box: [-7.6, 0, 14.6, -2.6, 1.9, 17.1], yaw: 0.12 },
    { kind: 'barrel', box: [2.65, 0, 17.65, 3.35, 0.95, 18.35], fire: true },
    { kind: 'crate', box: [7, 0, 23, 8.2, 1.1, 24.2] },
    { kind: 'crate', box: [8.3, 0, 23.3, 9.3, 0.8, 24.3] },
    { kind: 'crate', box: [7.3, 1.1, 23.2, 8.0, 1.7, 23.9] },
    { kind: 'rock', box: [-11, 0, 26.5, -8.4, 1.5, 29] },
    { kind: 'sign', box: [4.85, 0, 7.15, 5.15, 2.4, 7.45], text: ['THE STACKS', 'ACROSS THE ICE'] },
    // Lighthouse Point
    { kind: 'lighthouse', box: [-55.5, 0, -83.5, -47.5, 24, -75.5] },
    { kind: 'rock', box: [-30, 0, -56, -27, 1.8, -53] },
    { kind: 'pine', box: [-52.3, 0, -52.3, -51.7, 7, -51.7] },
    // the Lagoon: ice heaves you can hide behind
    { kind: 'iceberg', box: [-4, 0, -72, 0, 2.2, -68] },
    { kind: 'iceberg', box: [10, 0, -58, 13, 1.6, -55] },
    // the Fishing Camp
    { kind: 'crate', box: [20, 0, 10, 21.2, 1.1, 11.2] },
    { kind: 'crate', box: [21.3, 0, 10.3, 22.3, 0.8, 11.3] },
    { kind: 'barrel', box: [30.65, 0, -8.35, 31.35, 0.95, -7.65], fire: true },
    { kind: 'rack', box: [17, 0, -14, 23, 1.9, -13.4] },
    { kind: 'pine', box: [41.2, 0, 17.2, 41.8, 7, 17.8] },
    { kind: 'rock', box: [14, 0, 18, 16.6, 1.3, 20.6] },
    // the Shore: a rowboat pulled up, crates off the ship
    { kind: 'boat', box: [40, 0, -50, 42, 0.9, -45] },
    { kind: 'crate', box: [27, 0, -36, 28.2, 1.1, -34.8] },
    { kind: 'rock', box: [44, 0, -30, 46.6, 1.7, -27.4] },
    // the hold: cargo
    { kind: 'crate', box: [26, 0, -101, 27.2, 1.1, -99.8] },
    { kind: 'crate', box: [26, 0, -99.6, 27.2, 1.1, -98.4] },
    { kind: 'crate', box: [26.2, 1.1, -100.6, 27.0, 1.8, -99.0] },
    { kind: 'crate', box: [43, 0, -90, 44.2, 1.1, -88.8] },
  ],

  // slush in the lagoon: circles { x, z, r } that slow you down
  mud: [
    { x: -6, z: -60, r: 6 }, { x: 8, z: -72, r: 7 }, { x: 16, z: -52, r: 4 }, { x: -10, z: -78, r: 4.5 },
  ],

  boxSpots: [
    { id: 'box_landing', room: 'landing', x: -4, z: 29.65, yaw: Math.PI, start: true },
    { id: 'box_hut', room: 'hut', x: -68.15, z: -61, yaw: Math.PI / 2 },
    { id: 'box_cabin', room: 'cabin', x: 55.65, z: -2, yaw: -Math.PI / 2 },
    { id: 'box_hold', room: 'hold', x: 30, z: -103.65, yaw: 0 },
  ],
  wallBuys: [
    { weapon: 'MP41', room: 'landing', side: 'n', at: -4, y: 1.5 },
    { weapon: 'frag', room: 'landing', side: 'n', at: 4, y: 1.4 },
    { weapon: 'M15', room: 'dug_w', side: 'w', at: -3, y: 1.45 },
    { weapon: 'Staykout', room: 'dug_e', side: 'e', at: -33, y: 1.45 },
    { weapon: 'PM64', room: 'hut', side: 's', at: -62, y: 1.45 },
    { weapon: 'MPK', room: 'cabin', side: 's', at: 50, y: 1.45 },
    { weapon: 'Olympus', room: 'hold', side: 'e', at: -100, y: 1.45 },
  ],

  // Out across the frozen sea: the four stacks and the plant they stand on.
  stacks: [
    { x: -33, z: -200, h: 92 },
    { x: -11, z: -195, h: 92 },
    { x: 11, z: -190, h: 90 },
    { x: 33, z: -185, h: 90 },
  ],
  // the shoreline: where the land ends and the frozen sea starts (z)
  seaEdge: -84,
};
