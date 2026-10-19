// =============================================================================
// MAP DATA — Firing Range (Map 3). The Black Ops training camp in the jungle:
// plywood shacks, tin roofs, a muddy creek through the middle, sandbags and
// the shooting lanes down the south end. The world is the downloaded Call of
// Duty: Mobile model (assets/firingrange/range.glb, built and repainted by
// tools/firingrange/build.mjs; drawn by src/render/firingRangeWorld.js).
//
// The ground is measured off the model (src/map/firingRangeGround.js) and
// turned into collision and nav by src/map/firingRangeKit.js, so everything
// below only says roughly where things go: each spot snaps to the nearest bit
// of open ground big enough for it, and wall guns find the nearest wall.
//
// Layout (top = north, -z). Axes and units as the school (+x east, metres):
//
//        sheds      long barracks        pond
//    +----------------------------------------------+
//    |  ~~~~~~~~~~~~ the creek ~~~~~~~~~~~~~~~~      |   barricades round the edge
//    |   spawn      the bunker       tin sheds    ~~~|
//    |       palm grove (rocks)    the yard          |
//    |                      +-----------------+      |
//    |                      |  shooting lanes |      |
//    +----------------------+-----------------+------+
// =============================================================================
import { buildGround, heightAt, GRID } from './firingRangeKit.js';
import { insidePoly } from './layout.js';
import { CONFIG } from '../config.js';

const T = 0.5;
const FR = CONFIG.firingRange;

// The edge of play: the camp's dirt inside the road and the hills.
const EDGE = [[-46, -58], [31, -60], [44, -50], [49, -30], [49, -8], [43, 2], [44, 40], [41, 56], [5, 56], [4, 28], [-15, 21], [-31, 14], [-40, 2], [-42, -20], [-46, -28]];
const START = { x: -12, z: -25 };
// (the fence across the yard into the shooting lanes has a gap in it)
const OPEN = [[16.5, 31, 21.5, 35]];

const G = buildGround({ play: (x, z) => insidePoly(EDGE, x, z), start: START, open: OPEN });
const { NX, NZ } = { NX: GRID.nx, NZ: GRID.nz };
const cellX = (i) => GRID.x0 + (i + 0.5) * GRID.cell, cellZ = (k) => GRID.z0 + (k + 0.5) * GRID.cell;

// --- how much open ground is round each cell (metres to the nearest thing you can't walk on)
const CLEAR = new Float32Array(NX * NZ).fill(1e9);
for (let c = 0; c < NX * NZ; c++) if (!G.walk[c]) CLEAR[c] = 0;
const DIAG = [[-1, 0, 1], [0, -1, 1], [-1, -1, 1.414], [1, -1, 1.414]];
for (let pass = 0; pass < 2; pass++) {
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) for (const [di, dk, w] of DIAG) { const ii = i + di, kk = k + dk; if (ii >= 0 && kk >= 0 && ii < NX && kk < NZ) CLEAR[k * NX + i] = Math.min(CLEAR[k * NX + i], CLEAR[kk * NX + ii] + w); }
  for (let k = NZ - 1; k >= 0; k--) for (let i = NX - 1; i >= 0; i--) for (const [di, dk, w] of DIAG) { const ii = i - di, kk = k - dk; if (ii >= 0 && kk >= 0 && ii < NX && kk < NZ) CLEAR[k * NX + i] = Math.min(CLEAR[k * NX + i], CLEAR[kk * NX + ii] + w); }
}
const taken = [];   // spots already used (machines don't stand on each other)
// The nearest open ground to (x, z) with r metres clear all round.
function spot(x, z, r = 1.6, keep = true) {
  let best = null, bd = Infinity;
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
    if (CLEAR[k * NX + i] * GRID.cell < r) continue;
    const sx = cellX(i), sz = cellZ(k), d = Math.hypot(sx - x, sz - z);
    if (d >= bd || taken.some((t) => Math.hypot(t.x - sx, t.z - sz) < t.r + r)) continue;
    bd = d; best = { x: sx, z: sz };
  }
  if (!best) throw new Error('firing range: no room near ' + x + ',' + z);
  if (keep) taken.push({ ...best, r });
  return { ...best, y: heightAt(best.x, best.z) };
}
const walkable = G.walkable;
// The nearest wall to an open spot: { x, z } on its face and the normal out of it.
function wallNear(x, z) {
  const s = spot(x, z, 1.2, false);
  let best = null;
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let d = 0.25; d < 6; d += 0.25) {
      const px = s.x + nx * d, pz = s.z + nz * d;
      if (walkable(px, pz)) continue;
      if (!G.solidAt(px, pz)) break;   // (the edge of play, not a wall)
      if (!best || d < best.d) best = { d, x: s.x + nx * (d - 0.3), z: s.z + nz * (d - 0.3), normal: { x: -nx, z: -nz } };
      break;
    }
  }
  if (!best) throw new Error('firing range: no wall near ' + x + ',' + z);
  return { x: best.x, z: best.z, y: heightAt(best.x, best.z), normal: best.normal };
}
// Facing from a spot toward a point, snapped to the nearest axis.
function face(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  return Math.abs(dx) > Math.abs(dz) ? { x: Math.sign(dx), z: 0 } : { x: 0, z: Math.sign(dz) };
}

// --- the barricades round the edge of the camp -------------------------------------
// Each is a window in a short stretch of invisible wall at the edge of play
// (a frame and planks drawn in the open, zombies climb in over the sill).
// side: which way the outside is. at: roughly where along the edge.
const BARRICADES = [
  { id: 'win_north_w', side: 'n', x: -14, z: -56 },
  { id: 'win_north_e', side: 'n', x: 6, z: -57 },
  { id: 'win_road', side: 'w', x: -44, z: -29 },
  { id: 'win_east_n', side: 'e', x: 47, z: -26 },
  { id: 'win_east_s', side: 'e', x: 43, z: 12 },
  { id: 'win_lanes_e', side: 'e', x: 41, z: 46 },
  { id: 'win_lanes_s', side: 's', x: 24, z: 54 },
  { id: 'win_grove', side: 's', x: -8, z: 9 },
];
const DIRS = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
const windowRooms = [], windows = [];
for (const b of BARRICADES) {
  const [ox, oz] = DIRS[b.side];
  // walk out from the spot to the last open ground before the edge
  const s = spot(b.x - ox * 3, b.z - oz * 3, 1.4, false);
  let px = s.x, pz = s.z;
  for (let d = 0; d < 20 && walkable(px + ox * 0.5, pz + oz * 0.5); d++) { px += ox * 0.5; pz += oz * 0.5; }
  // the wall's inside face: the outer edge of that last cell
  const wx = ox ? (ox > 0 ? Math.floor((px - GRID.x0) / GRID.cell + 1) * GRID.cell + GRID.x0 : Math.floor((px - GRID.x0) / GRID.cell) * GRID.cell + GRID.x0) : px;
  const wz = oz ? (oz > 0 ? Math.floor((pz - GRID.z0) / GRID.cell + 1) * GRID.cell + GRID.z0 : Math.floor((pz - GRID.z0) / GRID.cell) * GRID.cell + GRID.z0) : pz;
  const y = heightAt(px, pz);
  const at = ox ? pz : px, half = 1.6, deep = 3;
  const rect = b.side === 'n' ? [px - half, wz, px + half, wz + deep] : b.side === 's' ? [px - half, wz - deep, px + half, wz]
    : b.side === 'w' ? [wx, pz - half, wx + deep, pz + half] : [wx - deep, pz - half, wx, pz + half];
  const range = ox ? [pz - half, pz + half] : [px - half, px + half];
  windowRooms.push({
    id: 'barricade_' + b.id, zone: 'range', name: 'the Firing Range', virtual: true, outdoor: true,
    rect, y, height: 3, floor: 'dirt', style: 'invisible', ceiling: 'none', reverb: 0.3,
    walls: { [b.side]: { style: 'invisible', ranges: [range] } },
  });
  windows.push({ id: b.id, room: 'barricade_' + b.id, side: b.side, at, look: 'barricade' });
}

// --- spawns, machines, guns -----------------------------------------------------------
const spawnAt = spot(START.x, START.z, 2.6);
const playerSpawns = [[0, 0], [-1.6, 0.6], [1.6, 0.6], [0, 1.8]].map(([dx, dz]) => ({ x: spawnAt.x + dx, z: spawnAt.z + dz, y: heightAt(spawnAt.x + dx, spawnAt.z + dz), yaw: Math.PI }));
const CENTER = { x: 2, z: -22 };

// perk machines: back to a spot, facing the open ground (needs the power, except Second Helping)
const PERKS = [
  ['secondHelping', -16, -31],
  ['beefcakeBroth', 24, -6],
  ['hotPotHustle', -30, -45],
  ['doubleLadle', 36, -40],
  ['marathonMinestrone', 30, 22],
  ['phdGaylor', 20, 45],
];
const perkMachines = PERKS.map(([perk, x, z]) => {
  const s = spot(x, z, 1.9);
  const n = face(s, CENTER);
  return { perk, room: 'range', free: { x: s.x - n.x * 0.6, y: s.y, z: s.z - n.z * 0.6, normal: n } };
});

const madDogAt = spot(8, 18, 2.4);
const boxSpots = [
  ['box_spawn', -4, -29, true],
  ['box_creek', 18, -31],
  ['box_yard', -2, 26],
  ['box_lanes', 32, 40],
  ['box_north', -30, -52],
].map(([id, x, z, start]) => { const s = spot(x, z, 1.5); return { id, room: 'range', x: s.x, z: s.z, y: s.y, yaw: Math.abs(s.x - CENTER.x) > Math.abs(s.z - CENTER.z) ? Math.PI / 2 : 0, ...(start ? { start: true } : {}) }; });

const WALL_GUNS = [
  ['M15', -8, -30], ['Olympus', -22, -40], ['frag', -12, -34], ['MP41', 12, -40],
  ['PM64', 28, -16], ['Staykout', 38, 8], ['AK-75u', 8, 28], ['MP6K', -20, -52],
  ['M17', 24, 36], ['Peacekeeper', 14, 50], ['lbd', 36, -50],
];
const wallBuys = WALL_GUNS.map(([weapon, x, z]) => { const w = wallNear(x, z); return { weapon, room: 'range', zone: 'range', pos: { x: w.x, y: w.y + 1.45, z: w.z }, normal: w.normal }; });

// the power: on the wall of the bunker by the creek
const pw = wallNear(4, -30);
const powerRoom = {
  id: 'power', zone: 'range', name: 'the Firing Range', virtual: true, outdoor: true, y: pw.y, height: 3, walls: {}, style: 'invisible', ceiling: 'none',
  // (a room whose side lies along that wall: the switch is placed on its side)
  rect: pw.normal.x ? (pw.normal.x > 0 ? [pw.x, pw.z - 1, pw.x + 2, pw.z + 1] : [pw.x - 2, pw.z - 1, pw.x, pw.z + 1]) : (pw.normal.z > 0 ? [pw.x - 1, pw.z, pw.x + 1, pw.z + 2] : [pw.x - 1, pw.z - 2, pw.x + 1, pw.z]),
};
const powerSide = pw.normal.x > 0 ? 'w' : pw.normal.x < 0 ? 'e' : pw.normal.z > 0 ? 'n' : 's';

// zombies climbing out of the dirt: every so often over the open ground
const groundSpawns = [];
for (let z = GRID.z0 + 6; z < GRID.z0 + NZ * GRID.cell - 4; z += FR.groundSpawnSpacing) {
  for (let x = GRID.x0 + 6; x < GRID.x0 + NX * GRID.cell - 4; x += FR.groundSpawnSpacing) {
    let s = null;
    try { s = spot(x, z, 1.5, false); } catch { continue; }
    if (Math.hypot(s.x - x, s.z - z) > FR.groundSpawnSpacing / 2) continue;
    if (Math.hypot(s.x - spawnAt.x, s.z - spawnAt.z) < 10) continue;
    groundSpawns.push({ x: s.x, y: s.y, z: s.z, room: 'range', zone: 'range' });
  }
}

export const FIRING_RANGE = {
  id: 'firingrange',
  name: 'Firing Range',
  wallThickness: T,
  customRender: true,        // no rooms or walls drawn: the model is the world
  glbWorld: 'assets/firingrange/range.glb',   // (src/render/firingRangeWorld.js)
  openField: true,           // no doors: zombies come for you wherever you can be reached
  terrainBoxes: G.boxes,     // the ground, the walls and the edge of play (src/map/firingRangeKit.js)
  heightAt,
  fog: FR.fog,
  ambient: FR.ambient,
  brightness: FR.brightness,
  farPlane: FR.farPlane,
  playerSpawns,
  rooms: [
    { id: 'range', zone: 'range', name: 'the Firing Range', virtual: true, outdoor: true, rect: [GRID.x0, GRID.z0, GRID.x0 + NX * GRID.cell, GRID.z0 + NZ * GRID.cell], height: 12, floor: 'dirt', style: 'invisible', ceiling: 'none', reverb: 0.3, walls: {} },
    ...windowRooms,
    powerRoom,
  ],
  navRegions: G.regions,
  portals: G.portals,
  windows,
  doors: [],
  gaps: [],
  props: [],
  groundSpawns,
  wallBuys,
  boxSpots,
  perkMachines,
  powerSwitch: { room: 'power', side: powerSide, at: powerSide === 'n' || powerSide === 's' ? pw.x : pw.z, y: pw.y + 1.3 },
  madDog: { room: 'range', x: madDogAt.x, z: madDogAt.z, y: madDogAt.y, yaw: 0 },
  emergencyLights: [],
};
