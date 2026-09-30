// =============================================================================
// MAP DATA — Basketball court (spawn room)
// Pure data. Both the simulation (collision, spawns) and the renderer read it.
// Axes: +X east, +Y up, -Z north. Units in meters.
// =============================================================================

const W = 17;    // half-width  (x)
const D = 13;    // half-depth  (z)
const H = 9;     // ceiling height

export const COURT = {
  id: 'court',
  name: 'Basketball Court',
  floor: 'gym',                       // footstep surface
  bounds: { minX: -W, maxX: W, minZ: -D, maxZ: D },
  height: H,
  wallThickness: 0.5,

  playerSpawns: [
    { x: 0, z: 2.5, yaw: 0 },
    { x: -2, z: 3.5, yaw: 0 },
    { x: 2, z: 3.5, yaw: 0 },
    { x: 0, z: 5, yaw: 0 },
  ],

  // Boarded windows. `normal` points INTO the room.
  windows: [
    { id: 'win_nw', wall: 'north', x: -14, z: -D, normal: { x: 0, z: 1 } },
    { id: 'win_ne', wall: 'north', x: 14, z: -D, normal: { x: 0, z: 1 } },
    { id: 'win_sw', wall: 'south', x: -14, z: D, normal: { x: 0, z: -1 } },
    { id: 'win_se', wall: 'south', x: 14, z: D, normal: { x: 0, z: -1 } },
  ],

  // Chained doors to future areas (made buyable in Phase 2).
  doors: [
    { id: 'door_hall', wall: 'east', x: W, z: 6, width: 2.6, height: 3.1, label: 'MAIN HALL', leadsTo: 'hallway' },
    { id: 'door_locker', wall: 'west', x: -W, z: -6, width: 2.6, height: 3.1, label: 'LOCKER ROOMS', leadsTo: 'lockers' },
  ],

  // Pull-out bleachers along both long walls.
  bleachers: [
    { side: 'north', x0: -10.5, x1: 10.5, rows: 6, rise: 0.42, depth: 0.65 },
    { side: 'south', x0: -10.5, x1: 10.5, rows: 6, rise: 0.42, depth: 0.65 },
  ],

  hoops: [
    { x: -W, z: 0, facing: 1 },
    { x: W, z: 0, facing: -1 },
  ],

  banner: { wall: 'north', x: 0, y: 5.7, width: 11, height: 3.6, text: 'STEW' },
  scoreboard: { wall: 'south', x: 0, y: 6.0, width: 5.2, height: 2.4 },

  // Ceiling fluorescent fixtures. `lit` = on the emergency circuit before power.
  // `flicker` 0..1 = how unstable it is.
  fixtures: (() => {
    const out = [];
    const xs = [-11, -3.7, 3.7, 11];
    const zs = [-6, 0, 6];
    let i = 0;
    for (const z of zs) for (const x of xs) {
      const lit = [1, 4, 6, 10].includes(i);
      const flicker = [4, 10].includes(i) ? 0.8 : lit ? 0.15 : 0;
      out.push({ x, z, y: H - 1.2, lit, flicker });
      i++;
    }
    return out;
  })(),

  // Red emergency lights above doors, moonlight spilling through windows.
  emergencyLights: [
    { x: W - 0.4, y: 3.9, z: 6 },
    { x: -W + 0.4, y: 3.9, z: -6 },
  ],
};
