// =============================================================================
// MAP DATA — Bikini Bottom (Map 3). The town under the sea, from SpongeBob:
// Battle for Bikini Bottom: SpongeBob's pineapple, Squidward's head and
// Patrick's rock at the east end, the Krusty Krab and the Chum Bucket to the
// west, Sandy's treedome in the middle, the sand cliffs between, and the
// flowery sky over it all. The world is the downloaded model
// (assets/bikinibottom/town.glb, built by tools/bikinibottom/build.mjs; drawn
// by src/render/bikiniBottomWorld.js).
//
// The ground is measured off the model (src/map/bikiniBottomGround.js) and
// turned into collision and nav by src/map/bikiniBottomKit.js, so everything
// below only says roughly where things go: each spot snaps to the nearest bit
// of open ground big enough for it, and wall guns find the nearest wall.
//
// Layout (top = north, -z). Axes and units as the school (+x east, metres):
//
//         Krusty Krab      sand cliffs     Patrick's rock
//    +---------------------------------------------------+
//    |  Chum    the       fountain  Sandy's   Squidward's |   barricades round the edge
//    |  Bucket  roundabout  (spawn)  treedome  pineapple   |
//    +---------------------------------------------------+
//                  purple rocks       the drop-off
// =============================================================================
import { buildGround, heightAt, GRID } from './bikiniBottomKit.js';
import { insidePoly } from './layout.js';
import { CONFIG } from '../config.js';

const T = 0.5;
const BB = CONFIG.bikiniBottom;

// The edge of play: the sand loop inside the town's fence.
const EDGE = [[-80.5, -4.9], [-70.8, -15.7], [-61.7, -20.8], [-53.7, -24.8], [-31, -25.2], [-6, -27.7], [8.9, -28.2], [16.9, -26.5], [41.9, -20.8], [47.6, -18.6], [65.8, -12.9], [84, -4.9], [90.9, 4.2], [90.9, 17.9], [86.3, 27], [72.7, 31.6], [61.3, 29.3], [43.1, 24.7], [29.4, 14.5], [26, 24.7], [2.1, 29.3], [-13.9, 29.9], [-25.3, 24.7], [-48, 30.4], [-61.7, 28.1], [-74.2, 19], [-78.8, 8.8]];
const START = { x: -4, z: 7 };

const G = buildGround({ play: (x, z) => insidePoly(EDGE, x, z), start: START });
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
  if (!best) throw new Error('bikini bottom: no room near ' + x + ',' + z);
  if (keep) taken.push({ ...best, r });
  return { ...best, y: heightAt(best.x, best.z) };
}
const walkable = G.walkable;
// The nearest wall to (x, z): { x, z } on its face and the normal out of it
// (from open ground with room to stand, up to 14 m away).
function wallNear(x, z) {
  let best = null;
  const r = Math.ceil(14 / GRID.cell), [ci, ck] = [Math.floor((x - GRID.x0) / GRID.cell), Math.floor((z - GRID.z0) / GRID.cell)];
  for (let k = Math.max(0, ck - r); k <= Math.min(NZ - 1, ck + r); k++) for (let i = Math.max(0, ci - r); i <= Math.min(NX - 1, ci + r); i++) {
    if (CLEAR[k * NX + i] * GRID.cell < 1.2) continue;
    const sx = cellX(i), sz = cellZ(k), d0 = Math.hypot(sx - x, sz - z);
    if (best && d0 >= best.d0) continue;
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let d = 0.5; d <= 2; d += 0.25) {
        const px = sx + nx * d, pz = sz + nz * d;
        if (walkable(px, pz)) continue;
        if (G.solidAt(px, pz)) best = { d0, x: sx + nx * (d - 0.3), z: sz + nz * (d - 0.3), normal: { x: -nx, z: -nz } };
        break;   // (the edge of play, not a wall, if not solid)
      }
      if (best && best.d0 === d0) break;
    }
  }
  if (!best) throw new Error('bikini bottom: no wall near ' + x + ',' + z);
  return { x: best.x, z: best.z, y: heightAt(best.x, best.z), normal: best.normal };
}
// Facing from a spot toward a point, snapped to the nearest axis.
function face(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  return Math.abs(dx) > Math.abs(dz) ? { x: Math.sign(dx), z: 0 } : { x: 0, z: Math.sign(dz) };
}

// --- the barricades round the edge of town ------------------------------------------
// Each is a window in a short stretch of invisible wall at the edge of play
// (a frame and planks drawn in the open, zombies climb in over the sill).
// side: which way the outside is. at: roughly where along the edge.
const BARRICADES = [
  { id: 'win_west', side: 'w', x: -78, z: 4 },
  { id: 'win_krab', side: 'n', x: -50, z: -24 },
  { id: 'win_cliffs', side: 'n', x: 2, z: -27 },
  { id: 'win_rock', side: 'n', x: 44, z: -19 },
  { id: 'win_east', side: 'e', x: 90, z: 10 },
  { id: 'win_pineapple', side: 's', x: 74, z: 30 },
  { id: 'win_dropoff', side: 's', x: -6, z: 29 },
  { id: 'win_purple', side: 's', x: -48, z: 29 },
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
    id: 'barricade_' + b.id, zone: 'town', name: 'Bikini Bottom', virtual: true, outdoor: true,
    rect, y, height: 3, floor: 'sand', style: 'invisible', ceiling: 'none', reverb: 0.3,
    walls: { [b.side]: { style: 'invisible', ranges: [range] } },
  });
  windows.push({ id: b.id, room: 'barricade_' + b.id, side: b.side, at, look: 'barricade' });
}

// --- spawns, machines, guns -----------------------------------------------------------
const spawnAt = spot(START.x, START.z, 2.6);
const playerSpawns = [[0, 0], [-1.6, 0.6], [1.6, 0.6], [0, 1.8]].map(([dx, dz]) => ({ x: spawnAt.x + dx, z: spawnAt.z + dz, y: heightAt(spawnAt.x + dx, spawnAt.z + dz), yaw: Math.PI }));
const CENTER = { x: 5, z: 0 };

// perk machines: back to a spot, facing the open ground (needs the power, except Second Helping)
const PERKS = [
  ['secondHelping', -20, -4],
  ['beefcakeBroth', -62, 0],
  ['hotPotHustle', -30, 22],
  ['doubleLadle', 42, -6],
  ['marathonMinestrone', 60, 22],
  ['phdGaylor', 6, -22],
];
const perkMachines = PERKS.map(([perk, x, z]) => {
  const s = spot(x, z, 1.9);
  const n = face(s, CENTER);
  return { perk, room: 'town', free: { x: s.x - n.x * 0.6, y: s.y, z: s.z - n.z * 0.6, normal: n } };
});

const madDogAt = spot(48, 6, 2.4);
const boxSpots = [
  ['box_fountain', -4, 10, true],
  ['box_purple', -62, 16],
  ['box_cliffs', 24, -20],
  ['box_pineapple', 70, -4],
  ['box_krab', -52, -18],
].map(([id, x, z, start]) => { const s = spot(x, z, 1.5); return { id, room: 'town', x: s.x, z: s.z, y: s.y, yaw: Math.abs(s.x - CENTER.x) > Math.abs(s.z - CENTER.z) ? Math.PI / 2 : 0, ...(start ? { start: true } : {}) }; });

const WALL_GUNS = [
  ['M15', -40, -8], ['Olympus', -28, -16], ['frag', -6, -9], ['MP41', 7, 15],
  ['PM64', 20, 6], ['Staykout', 55, -3], ['AK-75u', 66, 6], ['MP6K', 74, 14],
  ['M17', -50, 9], ['Peacekeeper', -13, 18], ['lbd', 0, 6],
];
const wallBuys = WALL_GUNS.map(([weapon, x, z]) => { const w = wallNear(x, z); return { weapon, room: 'town', zone: 'town', pos: { x: w.x, y: w.y + 1.45, z: w.z }, normal: w.normal }; });

// the power: on the Krusty Krab's west wall
const pw = wallNear(-50, -15);
const powerRoom = {
  id: 'power', zone: 'town', name: 'Bikini Bottom', virtual: true, outdoor: true, y: pw.y, height: 3, walls: {}, style: 'invisible', ceiling: 'none',
  // (a room whose side lies along that wall: the switch is placed on its side)
  rect: pw.normal.x ? (pw.normal.x > 0 ? [pw.x, pw.z - 1, pw.x + 2, pw.z + 1] : [pw.x - 2, pw.z - 1, pw.x, pw.z + 1]) : (pw.normal.z > 0 ? [pw.x - 1, pw.z, pw.x + 1, pw.z + 2] : [pw.x - 1, pw.z - 2, pw.x + 1, pw.z]),
};
const powerSide = pw.normal.x > 0 ? 'w' : pw.normal.x < 0 ? 'e' : pw.normal.z > 0 ? 'n' : 's';

// zombies climbing out of the sand: every so often over the open ground
const groundSpawns = [];
for (let z = GRID.z0 + 6; z < GRID.z0 + NZ * GRID.cell - 4; z += BB.groundSpawnSpacing) {
  for (let x = GRID.x0 + 6; x < GRID.x0 + NX * GRID.cell - 4; x += BB.groundSpawnSpacing) {
    let s = null;
    try { s = spot(x, z, 1.5, false); } catch { continue; }
    if (Math.hypot(s.x - x, s.z - z) > BB.groundSpawnSpacing / 2) continue;
    if (Math.hypot(s.x - spawnAt.x, s.z - spawnAt.z) < 10) continue;
    groundSpawns.push({ x: s.x, y: s.y, z: s.z, room: 'town', zone: 'town' });
  }
}

export const BIKINI_BOTTOM = {
  id: 'bikinibottom',
  name: 'Bikini Bottom',
  wallThickness: T,
  customRender: true,        // no rooms or walls drawn: the model is the world
  glbWorld: 'assets/bikinibottom/town.glb',   // (src/render/bikiniBottomWorld.js)
  openField: true,           // no doors: zombies come for you wherever you can be reached
  terrainBoxes: G.boxes,     // the ground, the walls and the edge of play (src/map/bikiniBottomKit.js)
  heightAt,
  fog: BB.fog,
  ambient: BB.ambient,
  brightness: BB.brightness,
  farPlane: BB.farPlane,
  playerSpawns,
  rooms: [
    { id: 'town', zone: 'town', name: 'Bikini Bottom', virtual: true, outdoor: true, rect: [GRID.x0, GRID.z0, GRID.x0 + NX * GRID.cell, GRID.z0 + NZ * GRID.cell], height: 12, floor: 'sand', style: 'invisible', ceiling: 'none', reverb: 0.3, walls: {} },
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
  madDog: { room: 'town', x: madDogAt.x, z: madDogAt.z, y: madDogAt.y, yaw: 0 },
  emergencyLights: [],
};
