// Plain-object vector math used by the simulation (no three.js dependency).
export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const dist2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const scale = (a, s) => v3(a.x * s, a.y * s, a.z * s);
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const norm = (a) => { const l = len(a) || 1; return v3(a.x / l, a.y / l, a.z / l); };
export const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

export function angleWrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Player look direction. yaw=0 looks toward -Z, positive pitch looks up.
export function lookDir(yaw, pitch) {
  const cp = Math.cos(pitch);
  return v3(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}

// Random direction inside a cone of `angle` radians around `dir`.
export function coneDir(dir, angle, rng) {
  if (angle <= 0) return dir;
  const up = Math.abs(dir.y) < 0.99 ? v3(0, 1, 0) : v3(1, 0, 0);
  const r = norm(cross(dir, up));
  const u = cross(r, dir);
  const a = angle * Math.sqrt(rng.next());
  const t = rng.next() * Math.PI * 2;
  const s = Math.sin(a);
  return norm(v3(
    dir.x * Math.cos(a) + (r.x * Math.cos(t) + u.x * Math.sin(t)) * s,
    dir.y * Math.cos(a) + (r.y * Math.cos(t) + u.y * Math.sin(t)) * s,
    dir.z * Math.cos(a) + (r.z * Math.cos(t) + u.z * Math.sin(t)) * s,
  ));
}

// Ray vs axis-aligned box. Returns {t, normal} or null.
export function rayAABB(o, d, b, maxT = Infinity) {
  let tmin = 0, tmax = maxT, nAxis = -1, nSign = 0;
  const axes = ['x', 'y', 'z'];
  const mins = [b.minX, b.minY, b.minZ];
  const maxs = [b.maxX, b.maxY, b.maxZ];
  for (let i = 0; i < 3; i++) {
    const k = axes[i];
    if (Math.abs(d[k]) < 1e-9) {
      if (o[k] < mins[i] || o[k] > maxs[i]) return null;
    } else {
      let t1 = (mins[i] - o[k]) / d[k];
      let t2 = (maxs[i] - o[k]) / d[k];
      let sign = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; sign = 1; }
      if (t1 > tmin) { tmin = t1; nAxis = i; nSign = sign; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  if (nAxis < 0) return null; // origin inside box
  const normal = v3(0, 0, 0);
  normal[axes[nAxis]] = nSign;
  return { t: tmin, normal };
}

// Ray vs capsule (segment pa-pb, radius r). d must be normalized. Returns t or -1.
export function rayCapsule(o, d, pa, pb, r) {
  const ba = sub(pb, pa), oa = sub(o, pa);
  const baba = dot(ba, ba), bard = dot(ba, d), baoa = dot(ba, oa);
  const rdoa = dot(d, oa), oaoa = dot(oa, oa);
  const a = baba - bard * bard;
  let b = baba * rdoa - baoa * bard;
  let c = baba * oaoa - baoa * baoa - r * r * baba;
  let h = b * b - a * c;
  if (a > 1e-9 && h >= 0) {
    const t = (-b - Math.sqrt(h)) / a;
    const y = baoa + t * bard;
    if (y > 0 && y < baba) return t;
  }
  // caps
  let best = -1;
  for (const p of [pa, pb]) {
    const t = raySphere(o, d, p, r);
    if (t >= 0 && (best < 0 || t < best)) best = t;
  }
  return best;
}

export function raySphere(o, d, c, r) {
  const oc = sub(o, c);
  const b = dot(oc, d);
  const cc = dot(oc, oc) - r * r;
  const h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : -1;
}

// Rotate local (x,z) offset by yaw (model faces +Z at yaw 0).
export function rotY(x, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
}
