// =============================================================================
// Character movement against axis-aligned boxes (players and zombies).
// Upright cylinder vs AABB with step-up, gravity, ground snapping and ceilings.
// =============================================================================

import { boxesNear } from './boxgrid.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// The floor under everything: y = 0, except out in space (Call of the Crust's
// islands float: miss the ground and you keep falling).
let FLOOR = 0;
export function setFloor(y) { FLOOR = y; }

function overlapsY(b, y, h) {
  return b.maxY > y + 0.02 && b.minY < y + h - 0.02;
}

// Push the circle (p.x, p.z, r) out of box b in the XZ plane. Returns true if it moved.
function pushOut(p, vel, r, b) {
  const cx = clamp(p.x, b.minX, b.maxX);
  const cz = clamp(p.z, b.minZ, b.maxZ);
  let dx = p.x - cx, dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  let nx, nz, push;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    nx = dx / d; nz = dz / d; push = r - d;
  } else {
    // center is inside the box: leave by the nearest face
    const opts = [
      [p.x - b.minX, -1, 0], [b.maxX - p.x, 1, 0],
      [p.z - b.minZ, 0, -1], [b.maxZ - p.z, 0, 1],
    ].sort((a, c) => a[0] - c[0]);
    nx = opts[0][1]; nz = opts[0][2]; push = opts[0][0] + r;
  }
  p.x += nx * push;
  p.z += nz * push;
  if (vel) {
    const vn = vel.x * nx + vel.z * nz;
    if (vn < 0) { vel.x -= vn * nx; vel.z -= vn * nz; }
  }
  return true;
}

function circleOverlapsXZ(x, z, r, b) {
  const cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ);
  const dx = x - cx, dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

// Highest box top underneath (x,z) that is at or below `maxY`.
export function groundHeight(x, z, r, maxY, boxLists, floorY = FLOOR) {
  let g = floorY;
  for (const list of boxLists) {
    for (const b of boxesNear(list, x, z, r)) {
      if (b.maxY <= maxY + 0.001 && b.maxY > g && circleOverlapsXZ(x, z, r, b)) g = b.maxY;
    }
  }
  return g;
}

/**
 * Move a body for one step.
 * body: { pos, vel, radius, height, grounded, stepHeight }
 * boxLists: array of arrays of boxes to collide with.
 * Returns { landed, impact } where impact is downward speed on landing.
 */
export function moveBody(body, dt, boxLists, gravity, floorY = FLOOR) {
  const p = body.pos, v = body.vel, r = body.radius, h = body.height;
  const wasGrounded = body.grounded;
  const startY = p.y;

  // --- horizontal, in substeps so fast lunges don't tunnel
  const dist = Math.hypot(v.x, v.z) * dt;
  const steps = Math.max(1, Math.ceil(dist / (r * 0.5)));
  const sdt = dt / steps;
  for (let s = 0; s < steps; s++) {
    p.x += v.x * sdt;
    p.z += v.z * sdt;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const list of boxLists) {
        for (const b of boxesNear(list, p.x, p.z, r)) {
          if (!overlapsY(b, p.y, h)) continue;
          if (!circleOverlapsXZ(p.x, p.z, r, b)) continue;
          const rise = b.maxY - p.y;
          if (wasGrounded && rise > 0 && rise <= body.stepHeight) {
            p.y = b.maxY; // step up onto it
            continue;
          }
          if (pushOut(p, v, r, b)) moved = true;
        }
      }
      if (!moved) break;
    }
  }

  // --- vertical
  const g = groundHeight(p.x, p.z, r * 0.85, Math.max(p.y, startY) + 0.05, boxLists, floorY);
  let landed = false, impact = 0;
  if (body.grounded && v.y <= 0 && p.y - g <= body.stepHeight + 0.02) {
    // stay glued to the ground when walking down steps
    p.y = g; v.y = 0;
  } else {
    v.y -= gravity * dt;
    let ny = p.y + v.y * dt;
    // ceilings
    if (v.y > 0) {
      for (const list of boxLists) for (const b of boxesNear(list, p.x, p.z, r)) {
        if (b.minY >= p.y + h - 0.05 && ny + h > b.minY && circleOverlapsXZ(p.x, p.z, r * 0.85, b)) {
          ny = b.minY - h; v.y = 0;
        }
      }
    }
    if (ny <= g) {
      if (!body.grounded) { landed = true; impact = -v.y; }
      ny = g; v.y = 0; body.grounded = true;
    } else {
      body.grounded = false;
    }
    p.y = ny;
  }
  return { landed, impact };
}

// Push a body back out of any wall it's been put into (it was shoved by something
// that isn't a wall: a titan's bulk). Sideways only; nothing it could step onto.
export function outOfWalls(body, boxLists) {
  const p = body.pos, r = body.radius, h = body.height;
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const list of boxLists) {
      for (const b of boxesNear(list, p.x, p.z, r)) {
        if (!overlapsY(b, p.y, h) || b.maxY - p.y <= (body.stepHeight || 0)) continue;
        if (pushOut(p, null, r, b)) moved = true;
      }
    }
    if (!moved) break;
  }
}

// Push circle A out of circle B (only A moves). Returns true if they overlapped.
export function separateCircles(a, ar, b, br, strength = 1) {
  const dx = a.x - b.x, dz = a.z - b.z;
  const d2 = dx * dx + dz * dz;
  const rr = ar + br;
  if (d2 >= rr * rr || d2 < 1e-10) return false;
  const d = Math.sqrt(d2);
  const push = (rr - d) * strength;
  a.x += (dx / d) * push;
  a.z += (dz / d) * push;
  return true;
}
