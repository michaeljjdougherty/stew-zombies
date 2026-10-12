// =============================================================================
// MAP DATA — Call of the Crust (Map 2). A frozen World War One battlefield on
// another planet: a loop of deep trenches round a cratered No Man's Land, a
// ruined farmhouse and barn, a bombed-out church, a stone workshop, and in the
// middle a huge excavation pit with something ancient glowing at the bottom.
// Far to the north, four enormous smoke stacks.
//
// Everything sits on the ground (y = 0): the trenches are corridors between
// earth walls (berms) taller than you, and the pit is ringed by a spoil bank
// you can climb (its rim is at y = 4). Built with src/map/layout.js; the
// renderer is src/render/crustWorld.js.
// Axes: +X east, +Y up, -Z north (toward the stacks). Metres.
//
//                     the four stacks, far off to the north
//      +==============N trench (jogs south round the workshop)==============+
//      |                 [ workshop ]                                        |
//      W     tank                          gun                            E  |
//      |  [farm]       (( excavation pit ))        [church + tower]          |
//      |  [barn]                                         wall               |
//      +=======S trench (jogs north in the middle)===========================+
//                               | communication trench
//                          [ command bunker ]  <- you start here
// =============================================================================
import { trenchLoop, carve, tile, autoPortals, regionAt, stairs, walls, doorway, boxOf, rect } from './layout.js';

const G = {
  trenchW: 3.6, berm: 2.0, bermH: 2.6,
  rimH: 4, rimT: 6,
};

// --- the trench loop ------------------------------------------------------------------
const LOOP = [
  [-60, 44], [-24, 44], [-24, 36], [24, 36], [24, 44], [60, 44],           // south (jogs north in the middle)
  [60, 14], [52, 14], [52, -14], [60, -14], [60, -52],                      // east (jogs in by the church)
  [26, -52], [26, -44], [-26, -44], [-26, -52], [-60, -52],                 // north (jogs south by the workshop)
  [-60, -14], [-52, -14], [-52, 14], [-60, 14],                             // west (jogs in by the farmhouse)
];
const loop = trenchLoop({ points: LOOP, width: G.trenchW, berm: G.berm, height: G.bermH, room: 'trench' });
// which stretch of trench an edge belongs to (for zones)
const sideOf = (e) => {
  const [p, q] = e.center, mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
  if (mz > 30) return 'trench_s';
  if (mz < -40) return 'trench_n';
  return mx < 0 ? 'trench_w' : 'trench_e';
};
loop.regions.forEach((r, i) => { r.room = sideOf(loop.edges[i]); r.id = `trench_${i}`; });

// Gaps in the inner berm out into No Man's Land: [x0, z0, x1, z1]
const EXITS = [
  [-42, 40.2, -39.6, 42.2], [-12, 32.2, -9.6, 34.2], [9.6, 32.2, 12, 34.2], [39.6, 40.2, 42, 42.2],   // south
  [56.2, 26, 58.2, 28.4], [48.2, -1.2, 50.2, 1.2], [56.2, -30, 58.2, -27.6],                           // east
  [40, -50.2, 42.4, -48.2], [-16, -42.2, -13.6, -40.2], [13.6, -42.2, 16, -40.2], [-42.4, -50.2, -40, -48.2], // north
  [-58.2, -30, -56.2, -27.6], [-50.2, -1.2, -48.2, 1.2], [-58.2, 26, -56.2, 28.4],                       // west
];
// Dugouts: niches cut into the outer berm, timber-roofed, a wall gun in each.
const DUGOUTS = [
  { id: 'dug_mp41', rect: [-44, 45.8, -41.4, 47.4], side: 's', weapon: 'MP41', zone: 'trench_s' },
  { id: 'dug_m15', rect: [-63.4, 24, -61.8, 26.6], side: 'w', weapon: 'M15', zone: 'trench_w' },
  { id: 'dug_staykout', rect: [61.8, -34, 63.4, -31.4], side: 'e', weapon: 'Staykout', zone: 'trench_e' },
  { id: 'dug_pm64', rect: [-12, -47.4, -9.4, -45.8], side: 'n', weapon: 'PM64', zone: 'trench_n' },
];

let berms = loop.berms;
for (const c of EXITS) berms = carve(berms, c);
for (const d of DUGOUTS) berms = carve(berms, d.rect);

// --- the communication trench down to the command bunker ---------------------------
const COMM = { rect: [-1.8, 37.8, 1.8, 54] };
berms = carve(berms, [-1.8, 37.8, 1.8, 39.8]);   // through the loop's outer berm
berms.push(
  { rect: [-3.8, 39.8, -1.8, 54], y1: G.bermH, face: { x: 1, z: 0 }, side: 'comm' },
  { rect: [1.8, 39.8, 3.8, 54], y1: G.bermH, face: { x: -1, z: 0 }, side: 'comm' },
);

// --- the command bunker (spawn) ---------------------------------------------------------
const BUNKER = { yard: [-9, 54, 9, 70], dugout: [-6, 64, 6, 70], wallH: 1.7, roofH: 2.5 };
const bunkerProps = [
  // sandbag walls round the yard (the communication trench comes in at the north)
  boxOf([-9.7, 53.3, -1.8, 54], 0, BUNKER.wallH, 'sandbags'), boxOf([1.8, 53.3, 9.7, 54], 0, BUNKER.wallH, 'sandbags'),
  boxOf([-9.7, 54, -9, 70.7], 0, BUNKER.wallH, 'sandbags'), boxOf([9, 54, 9.7, 70.7], 0, BUNKER.wallH, 'sandbags'),
  boxOf([-9.7, 70, 9.7, 70.7], 0, BUNKER.wallH, 'sandbags'),
  // the command dugout: timber walls, earth and iron on the roof, door facing north
  ...walls({ rect: BUNKER.dugout, t: 0.4, h: BUNKER.roofH, openings: [{ side: 'n', from: -1.5, to: 1.5 }, { side: 's', from: -6, to: 6 }], kind: 'timber' }),
  boxOf([-6.4, 63.6, 6.4, 70], BUNKER.roofH, BUNKER.roofH + 0.5, 'bunkerRoof'),
  boxOf([-1, 69.2, 1, 70], 0, 1.0, 'radio'),          // the field radio on its table
  boxOf([-4.6, 66, -2.8, 67.4], 0, 0.85, 'mapTable'),
];

// --- the buildings -------------------------------------------------------------------
// Ruined farmhouse: stone, burnt out, the roof half fallen in.
const FARM = { rect: [-44, -8, -30, 6], t: 0.6, h: 4.2 };
const farmOpen = [{ side: 'e', from: -2.2, to: 0.2 }, { side: 's', from: -38, to: -35.6 }, { side: 'n', from: -40, to: -37 }];
const farmWalls = walls({
  ...FARM, openings: farmOpen, kind: 'stone', style: 'farm',
  heights: { n: [[-44, -40, 4.2], [-37, -33, 2.4], [-33, -30, 3.6]], e: [[-7.4, -2.2, 3.4], [0.2, 5.4, 1.6]], s: [[-44, -38, 4.2], [-35.6, -30, 2.8]], w: 4.2 },
});
const BARN = { rect: [-45, 18, -33, 28], t: 0.35, h: 4.6 };
const barnOpen = [{ side: 'e', from: 21, to: 25 }, { side: 'n', from: -41, to: -38.6 }];
const barnWalls = walls({ ...BARN, openings: barnOpen, kind: 'planks', style: 'barn' });
// Bombed-out church: stone nave, west door under the tower, a bomb hole in the south wall.
const CHURCH = { rect: [30, -7, 44, 5], t: 0.8, h: 7.5, tower: [25, -12, 30, -7], towerH: 19 };
const churchOpen = [{ side: 'w', from: -2.2, to: 0.2 }, { side: 's', from: 36, to: 39 }];
const churchWalls = walls({ ...CHURCH, openings: churchOpen, kind: 'stone', style: 'church', heights: { s: [[30, 36, 7.5], [39, 41, 4.5], [41, 44, 7.5]] } });
// Stone workshop: forges along the back wall, doors south (to the pit), east and west.
const SHOP = { rect: [-9, -36, 9, -27], t: 0.6, h: 5 };
const shopOpen = [{ side: 's', from: -1.5, to: 1.5 }, { side: 'e', from: -33, to: -30.6 }, { side: 'w', from: -33, to: -30.6 }];
const shopWalls = walls({ ...SHOP, openings: shopOpen, kind: 'stone', style: 'workshop' });
const shopProps = [
  boxOf([-7.6, -35.4, -4.4, -34], 0, 1.1, 'forge'), boxOf([4.4, -35.4, 7.6, -34], 0, 1.1, 'forge'),
  boxOf([-1.4, -35.4, 1.4, -34.6], 0, 1.0, 'workbench'),
  boxOf([-8.4, -29.2, -6.8, -27.6], 0, 0.8, 'anvil'), boxOf([6.8, -29.2, 8.4, -27.6], 0, 0.8, 'anvil'),
];
const churchProps = [
  boxOf(CHURCH.tower, 0, CHURCH.towerH, 'tower'),
  boxOf([41.6, -2.2, 43.2, 0.2], 0, 1.1, 'altar'),
];
const farmProps = [boxOf([-41, -5, -37.5, -2], 0, 1.5, 'rubble'), boxOf([-35, 1, -32, 3.6], 0, 0.9, 'farmTable')];

// --- the excavation pit ------------------------------------------------------------------
// A spoil bank (the rim) round a pit dug down to the old stones. Cuts through
// the rim east and west lead in at ground level; stairs climb the outside of
// the rim (north, south) and scaffold stairs go down inside (north).
const PIT = { outer: [-18, -18, 18, 18], inner: [-12, -12, 12, 12], cutW: 5 };
const cut = (x0, x1) => [x0, -PIT.cutW / 2, x1, PIT.cutW / 2];
const RIM = [
  { id: 'rim_n', rect: [-18, -18, 18, -12] }, { id: 'rim_s', rect: [-18, 12, 18, 18] },
  { id: 'rim_wn', rect: [-18, -12, -12, -PIT.cutW / 2] }, { id: 'rim_ws', rect: [-18, PIT.cutW / 2, -12, 12] },
  { id: 'rim_en', rect: [12, -12, 18, -PIT.cutW / 2] }, { id: 'rim_es', rect: [12, PIT.cutW / 2, 18, 12] },
];
const rimProps = RIM.map((r) => boxOf(r.rect, 0, G.rimH, 'rim', { rim: r.id }));
const outerStairsN = stairs({ id: 'stairs_rim_n', rect: [10, -25, 13, -18], dir: 's', rise: 0.4, top: G.rimH, room: 'pit' });
const outerStairsS = stairs({ id: 'stairs_rim_s', rect: [-13, 18, -10, 25], dir: 'n', rise: 0.4, top: G.rimH, room: 'pit' });
const innerStairs = stairs({ id: 'stairs_pit', rect: [-9.5, -12, -6.5, -5], dir: 'n', rise: 0.4, top: G.rimH, room: 'pit' });
// the old stones at the bottom: four standing stones round a glowing altar
const STONES = [[-5, -5], [5, -5], [-5, 5], [5, 5]].map(([x, z]) => rect(x - 0.6, z - 0.6, x + 0.6, z + 0.6));
const ALTAR = [-1.5, -1.5, 1.5, 1.5];
const pitProps = [
  ...STONES.map((r, i) => boxOf(r, 0, 4.2, 'standingStone', { i })),
  boxOf(ALTAR, 0, 1.2, 'altarStone'),
];

// --- No Man's Land obstacles ----------------------------------------------------------
const WRECKS = [
  { kind: 'tank', rect: [-42, -35, -34.5, -30.5], yaw: 0.25 },
  { kind: 'fieldGun', rect: [33, -36, 37, -32], yaw: -0.6 },
  { kind: 'ruinWall', rect: [30, 24, 40, 25.2] },
];
const wreckProps = WRECKS.map((w) => boxOf(w.rect, 0, w.kind === 'ruinWall' ? 2.4 : w.kind === 'tank' ? 2.6 : 1.8, w.kind, { yaw: w.yaw || 0 }));

// --- nav regions ---------------------------------------------------------------------
const nmlRoom = (x, z) => (z < -8 ? (x < 0 ? 'nml_nw' : 'nml_ne') : (x < 0 ? 'nml_sw' : 'nml_se'));
const R = [];
R.push(...loop.regions);
// (each exit takes the zone of the trench it opens off)
const dist2 = (r, x, z) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3]));
EXITS.forEach((c, i) => {
  const cx = (c[0] + c[2]) / 2, cz = (c[1] + c[3]) / 2;
  const t = loop.regions.reduce((best, q) => (dist2(q.rect, cx, cz) < dist2(best.rect, cx, cz) ? q : best));
  R.push({ id: `exit_${i}`, rect: c, room: t.room, level: 0 });
});
for (const d of DUGOUTS) R.push({ id: d.id, rect: d.rect, room: d.id, level: 0 });
R.push({ id: 'comm', rect: COMM.rect, room: 'trench_s', level: 0 });
R.push(...tile({ area: BUNKER.yard, holes: [BUNKER.dugout], roomOf: () => 'bunker', prefix: 'yard' }));
R.push(...tile({ area: [-5.6, 64.4, 5.6, 70], holes: [[-1, 69.2, 1, 70], [-4.6, 66, -2.8, 67.4]], roomOf: () => 'bunker', prefix: 'dugout' }));
R.push({ id: 'bunker_door', rect: [-1.5, 64, 1.5, 64.4], room: 'bunker', level: 0 });
// No Man's Land: everything inside the loop that isn't a building, the pit or a wreck
const footprint = (r, m = 0) => [r[0] - m, r[1] - m, r[2] + m, r[3] + m];
const NML_HOLES = [PIT.outer, outerStairsN.region.rect, outerStairsS.region.rect, FARM.rect, BARN.rect, CHURCH.rect, CHURCH.tower, SHOP.rect, ...WRECKS.map((w) => w.rect)];
R.push(...tile({ poly: loop.bIn, holes: NML_HOLES, roomOf: nmlRoom, prefix: 'nml' }));
// building insides and their doorways
const inside = (b) => footprint(b.rect, -b.t);
R.push(...tile({ area: inside(FARM), holes: farmProps.map((p) => [p.box[0], p.box[2], p.box[3], p.box[5]]), roomOf: () => 'farmhouse', prefix: 'farm' }));
R.push(...farmOpen.map((o) => doorway(FARM.rect, FARM.t, o, 'farmhouse')));
R.push(...tile({ area: inside(BARN), roomOf: () => 'barn', prefix: 'barn' }));
R.push(...barnOpen.map((o) => doorway(BARN.rect, BARN.t, o, 'barn')));
R.push(...tile({ area: inside(CHURCH), holes: [[41.6, -2.2, 43.2, 0.2]], roomOf: () => 'church', prefix: 'church' }));
R.push(...churchOpen.map((o) => doorway(CHURCH.rect, CHURCH.t, o, 'church')));
R.push(...tile({ area: inside(SHOP), holes: shopProps.map((p) => [p.box[0], p.box[2], p.box[3], p.box[5]]), roomOf: () => 'workshop', prefix: 'shop' }));
R.push(...shopOpen.map((o) => doorway(SHOP.rect, SHOP.t, o, 'workshop')));
// the pit: floor, the cuts in, the rim on top, the stairs between
R.push(...tile({ area: PIT.inner, holes: [innerStairs.region.rect, ...STONES, ALTAR], roomOf: () => 'pit', prefix: 'pit' }));
R.push({ id: 'cut_w', rect: cut(-18, -12), room: 'pit', level: 0 }, { id: 'cut_e', rect: cut(12, 18), room: 'pit', level: 0 });
R.push(...RIM.map((r) => ({ ...r, room: 'rim', level: G.rimH })));
for (const s of [outerStairsN, outerStairsS, innerStairs]) R.push(s.region);

const PORTALS = autoPortals(R);
// stairs: bottom to the ground region there, top to the rim
for (const s of [outerStairsN, outerStairsS, innerStairs]) {
  const out = (e) => ({ x: e.axis === 'x' ? e.x : e.x, z: e.axis === 'z' ? e.z : e.z });
  const step = (e, d) => (e.axis === 'z' ? { x: e.x, z: e.z + d } : { x: e.x + d, z: e.z });
  // a point just past each end, to find what's there
  const sgn = { n: -1, s: 1, e: 1, w: -1 }[s.dir];
  const below = step(out(s.bottom), -sgn * 0.3), above = step(out(s.top), sgn * 0.3);
  const lo = regionAt(R, below.x, below.z, 0), hi = regionAt(R, above.x, above.z, G.rimH);
  if (lo) PORTALS.push({ a: s.region.id, b: lo.id, x: s.bottom.x, z: s.bottom.z, axis: s.bottom.axis, width: s.bottom.width });
  if (hi) PORTALS.push({ a: s.region.id, b: hi.id, x: s.top.x, z: s.top.z, axis: s.top.axis, width: s.top.width });
}

// --- ground spawns: zombies claw up out of the mud everywhere --------------------------
const SPAWN_ZONES = R.filter((r) => r.level === 0 && (r.id.startsWith('nml') || r.id.startsWith('trench_') || r.id.startsWith('pit')));
const GROUND = [];
{
  let k = 0;
  for (const r of SPAWN_ZONES) {
    const [x0, z0, x1, z1] = r.rect, w = x1 - x0, d = z1 - z0;
    if (w < 2.5 || d < 2.5) continue;
    const n = Math.max(1, Math.min(4, Math.floor((w * d) / 140)));
    for (let i = 0; i < n; i++) {
      // spread along the region, kept off its edges
      const t = (i + 0.5) / n;
      const x = w >= d ? x0 + 1 + t * (w - 2) : (x0 + x1) / 2 + ((k % 3) - 1) * Math.min(1, w / 2 - 1.2);
      const z = w >= d ? (z0 + z1) / 2 + ((k % 3) - 1) * Math.min(1, d / 2 - 1.2) : z0 + 1 + t * (d - 2);
      GROUND.push({ id: `mud_${k++}`, room: r.room, x: +x.toFixed(2), z: +z.toFixed(2) });
    }
  }
}

// --- rooms (zones) ---------------------------------------------------------------------
const room = (id, zone, r, extra = {}) => ({ id, zone, name: extra.name || id, outdoor: true, rect: r, height: 6, floor: 'mud', style: 'cliff', walls: {}, ceiling: 'none', litter: false, ...extra });
const ROOMS = [
  room('bunker', 'bunker', BUNKER.yard, { name: 'the Command Bunker' }),
  room('trench_s', 'trench_s', [-62, 32, 62, 48], { name: 'the South Trench' }),
  room('trench_n', 'trench_n', [-62, -56, 62, -40], { name: 'the North Trench' }),
  room('trench_w', 'trench_w', [-62, -54, -48, 46], { name: 'the West Trench' }),
  room('trench_e', 'trench_e', [48, -54, 62, 46], { name: 'the East Trench' }),
  ...DUGOUTS.map((d) => room(d.id, d.zone, d.rect, { name: 'a dugout' })),
  room('nml_nw', 'nml_nw', [-56, -48, 0, -8], { name: "No Man's Land" }),
  room('nml_ne', 'nml_ne', [0, -48, 56, -8], { name: "No Man's Land" }),
  room('nml_sw', 'nml_sw', [-56, -8, 0, 40], { name: "No Man's Land" }),
  room('nml_se', 'nml_se', [0, -8, 56, 40], { name: "No Man's Land" }),
  room('farmhouse', 'farmhouse', FARM.rect, { name: 'the Farmhouse' }),
  room('barn', 'farmhouse', BARN.rect, { name: 'the Barn' }),
  room('church', 'church', CHURCH.rect, { name: 'the Church' }),
  room('workshop', 'workshop', SHOP.rect, { name: 'the Workshop' }),
  room('pit', 'pit', PIT.inner, { name: 'the Excavation' }),
  room('rim', 'pit', PIT.outer, { name: 'the Excavation' }),
];

export const CRUST = {
  id: 'crust',
  name: 'Call of the Crust',
  wallThickness: 0.5,
  snow: true,              // the crust world: sky, snow, the stacks (src/render/crustWorld.js)
  customRender: true,      // crustWorld draws the ground, berms and buildings itself
  openField: true,         // a battlefield, not rooms: every zone is live, zombies rise near you
  pa: false,               // (The Schnitz's loudspeakers come later)
  fog: { color: '#2e343c', density: 0.0115 },
  playerSpawns: [
    { x: 0, z: 58, yaw: 0 }, { x: -2.2, z: 59.5, yaw: 0 }, { x: 2.2, z: 59.5, yaw: 0 }, { x: 0, z: 61, yaw: 0 },
  ],
  G, LOOP, loop, EXITS, DUGOUTS, BUNKER, COMM, FARM, BARN, CHURCH, SHOP, PIT, RIM, STONES, ALTAR, WRECKS,
  stairsList: [outerStairsN, outerStairsS, innerStairs],

  rooms: ROOMS,
  navRegions: R,
  portals: PORTALS,
  windows: [],
  doors: [],
  gaps: [],

  props: [
    ...berms.map((b) => boxOf(b.rect, 0, b.y1, 'berm', { face: b.face, stub: !!b.stub, side: b.side })),
    ...DUGOUTS.map((d) => boxOf(d.rect, G.bermH - 0.25, G.bermH, 'dugoutRoof', { dugout: d.id })),
    ...bunkerProps,
    ...farmWalls, ...farmProps, ...barnWalls,
    ...churchWalls, ...churchProps,
    ...shopWalls, ...shopProps,
    ...rimProps, ...pitProps,
    ...[outerStairsN, outerStairsS, innerStairs].flatMap((s) => s.boxes),
    ...wreckProps,
  ],

  groundSpawns: GROUND,

  // deep mud slows you down (not on the duckboards): circles { x, z, r }
  mud: [
    { x: -30, z: -20, r: 7 }, { x: 28, z: -22, r: 6 }, { x: -22, z: 28, r: 6.5 }, { x: 26, z: 28, r: 5.5 },
    { x: -48, z: 34, r: 4.5 }, { x: 46, z: -40, r: 5 }, { x: 0, z: 27, r: 4 }, { x: -24, z: -42, r: 4 },
    { x: 44, z: 12, r: 4.5 }, { x: -48, z: -32, r: 4 },
  ],
  // where the duckboards are laid (no slow-down): trench floors, the bunker, the pit, a few paths
  duckboards: [
    ...loop.regions.map((r) => r.rect), COMM.rect, BUNKER.yard, PIT.inner, cut(-18, -12), cut(12, 18),
    ...DUGOUTS.map((d) => d.rect),
    [-1.2, -27, 1.2, -18], [-32.5, -1.8, -18, -0.2], [18, -1.8, 30, -0.2],
  ],
  // shell craters dotting No Man's Land (looks only): { x, z, r }
  craters: [
    [-30, -20, 7], [28, -22, 6], [-22, 28, 6.5], [26, 28, 5.5], [-48, 34, 4.5], [46, -40, 5], [0, 27, 4],
    [-24, -42, 4], [44, 12, 4.5], [-48, -32, 4], [-12, -26, 2.5], [20, -30, 3], [-36, 14, 2.8], [38, 34, 3],
    [-6, 30, 2.4], [50, -24, 2.6], [-52, -44, 2.4], [16, 24, 2.2], [-20, 10, 2.6], [30, 12, 2.4],
  ].map(([x, z, r]) => ({ x, z, r })),

  wallBuys: [
    { weapon: 'Olympus', room: 'bunker', side: 'w', at: 59, y: 1.3 },
    { weapon: 'frag', room: 'bunker', side: 'e', at: 66, y: 1.25 },
    ...DUGOUTS.map((d) => ({ weapon: d.weapon, room: d.id, side: d.side, at: d.side === 'n' || d.side === 's' ? (d.rect[0] + d.rect[2]) / 2 : (d.rect[1] + d.rect[3]) / 2, y: 1.45 })),
  ],
  boxSpots: [
    { id: 'box_bunker', room: 'bunker', x: 8.4, z: 61, yaw: -Math.PI / 2, start: true },
    { id: 'box_church', room: 'church', x: 37, z: -5.9, yaw: 0 },
    { id: 'box_barn', room: 'barn', x: -44.3, z: 23, yaw: Math.PI / 2 },
    { id: 'box_pit', room: 'pit', x: 4, z: 11.4, yaw: Math.PI },
  ],

  // the four stacks, far off to the north (the final fight happens there, later)
  stacks: [
    { x: -22, z: -232, h: 120 }, { x: 22, z: -232, h: 118 },
    { x: -22, z: -276, h: 122 }, { x: 22, z: -276, h: 120 },
  ],
};
