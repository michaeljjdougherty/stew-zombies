// =============================================================================
// Island kit: turns a short description of areas and the links between them
// into the school-format map data (rooms with their walls and openings, doors,
// windows, nav regions and portals, ground spawns). Used by Call of the Crust.
//
// Areas are rectangles 0.5 m apart (one wall's thickness): the kit finds which
// ones touch, decides who owns the wall between them (a hut owns its walls, a
// trench its revetment, a cliffside yard its rock), cuts the openings the links
// ask for, and gives every other edge the area's edge style (cliff, the sea's
// invisible edge, a building's outside wall).
// =============================================================================

const T = 0.5;

// Kinds of area: what they're made of, how high their walls are, who wins a shared wall.
export const KINDS = {
  yard: { outdoor: true, height: 7, floor: 'snow', style: 'cliff', edge: 'cliff', ceiling: 'none', rank: 1.5 },
  shore: { outdoor: true, height: 7, floor: 'snow', style: 'cliff', edge: 'invisible', ceiling: 'none', rank: 1 },
  ice: { outdoor: true, height: 7, floor: 'ice', style: 'cliff', edge: 'invisible', ceiling: 'none', rank: 1 },
  trench: { outdoor: true, height: 2.6, floor: 'duckboard', style: 'trench', edge: 'trench', ceiling: 'none', rank: 2 },
  arena: { outdoor: true, height: 3.4, floor: 'flagstone', style: 'stone', edge: 'stone', ceiling: 'none', rank: 4 },
  cabin: { outdoor: false, height: 3.2, floor: 'wood', style: 'cabin', edge: 'cabin', ceilingMat: 'planks', rank: 3 },
  hull: { outdoor: false, height: 4.2, floor: 'deck', style: 'hull', edge: 'hull', ceilingMat: 'hullCeil', rank: 3, reverb: 0.8 },
  lab: { outdoor: false, height: 3.4, floor: 'tile', style: 'lab', edge: 'lab', outStyle: 'tin', rank: 3 },
  hall: { outdoor: false, height: 3.4, floor: 'tile', style: 'hall', edge: 'hall', outStyle: 'tin', rank: 3 },
  tin: { outdoor: false, height: 5, floor: 'concrete', style: 'tin', edge: 'tin', ceiling: 'trusses', rank: 3, reverb: 0.7 },
  stone: { outdoor: false, height: 6, floor: 'flagstone', style: 'stone', edge: 'stone', ceilingMat: 'stoneCeil', rank: 3, reverb: 0.9 },
  bunker: { outdoor: false, height: 2.8, floor: 'concrete', style: 'bunker', edge: 'bunker', ceilingMat: 'bunkerCeil', rank: 3, reverb: 0.6 },
  dugout: { outdoor: false, height: 2.4, floor: 'duckboard', style: 'trench', edge: 'trench', ceilingMat: 'planks', rank: 3 },
  cave: { outdoor: false, height: 6, floor: 'ice', style: 'cliff', edge: 'cliff', ceilingMat: 'rock', rank: 3, cave: true, reverb: 1.0 },
};

// A rectangle from grid lines: cells i0..i1 (columns) and j0..j1 (rows), inclusive.
export function cell(X, Z, i0, j0, i1 = i0, j1 = j0) {
  return [X[i0] + T / 2, Z[j0] + T / 2, X[i1 + 1] - T / 2, Z[j1 + 1] - T / 2];
}

const close = (a, b) => Math.abs(a - b) < 0.02;

// Where two rooms touch: { aSide, bSide, axis, line, s0, s1 } or null.
function shared(A, B) {
  const [ax0, az0, ax1, az1] = A.rect, [bx0, bz0, bx1, bz1] = B.rect;
  const zs0 = Math.max(az0, bz0), zs1 = Math.min(az1, bz1), xs0 = Math.max(ax0, bx0), xs1 = Math.min(ax1, bx1);
  if (close(bx0 - ax1, T) && zs1 - zs0 > 0.05) return { aSide: 'e', bSide: 'w', cross: 'x', line: ax1 + T / 2, s0: zs0, s1: zs1 };
  if (close(ax0 - bx1, T) && zs1 - zs0 > 0.05) return { aSide: 'w', bSide: 'e', cross: 'x', line: ax0 - T / 2, s0: zs0, s1: zs1 };
  if (close(bz0 - az1, T) && xs1 - xs0 > 0.05) return { aSide: 's', bSide: 'n', cross: 'z', line: az1 + T / 2, s0: xs0, s1: xs1 };
  if (close(az0 - bz1, T) && xs1 - xs0 > 0.05) return { aSide: 'n', bSide: 's', cross: 'z', line: az0 - T / 2, s0: xs0, s1: xs1 };
  return null;
}

// The full run of a side, in its own coordinate (x for n/s, z for w/e).
function sideRun(rect, side) {
  const [x0, z0, x1, z1] = rect;
  return side === 'n' || side === 's' ? [x0 - T, x1 + T] : [z0, z1];
}

export function buildIslands(def) {
  const areas = def.areas.map((a) => {
    const k = KINDS[a.kind];
    if (!k) throw new Error('unknown kind ' + a.kind + ' for ' + a.id);
    const { rank, edge, ...kk } = k;
    return { zone: a.id, name: a.id, litter: false, reverb: 0.3, ...kk, rank: a.rank ?? rank, edge: a.edge ?? edge, ...a, walls: {} };
  });
  const byId = new Map(areas.map((a) => [a.id, a]));
  const ids = new Set();
  for (const a of areas) { if (ids.has(a.id)) throw new Error('duplicate area ' + a.id); ids.add(a.id); }
  // overlaps are mistakes
  for (let i = 0; i < areas.length; i++) for (let j = i + 1; j < areas.length; j++) {
    const A = areas[i].rect, B = areas[j].rect;
    if (A[0] < B[2] - 0.01 && B[0] < A[2] - 0.01 && A[1] < B[3] - 0.01 && B[1] < A[3] - 0.01) throw new Error(`areas overlap: ${areas[i].id} / ${areas[j].id}`);
  }

  // every touching pair
  const edges = [];
  for (let i = 0; i < areas.length; i++) for (let j = i + 1; j < areas.length; j++) {
    const s = shared(areas[i], areas[j]);
    if (s) edges.push({ a: areas[i], b: areas[j], ...s });
  }
  const edgeOf = (aId, bId) => {
    for (const e of edges) {
      if (e.a.id === aId && e.b.id === bId) return { ...e, flip: false };
      if (e.a.id === bId && e.b.id === aId) return { ...e, flip: true };
    }
    throw new Error(`link between areas that don't touch: ${aId} / ${bId}`);
  };
  // who owns each shared wall
  const linksFor = new Map();
  for (const l of def.links) {
    const e = edgeOf(l.a, l.b);
    const key = [e.a.id, e.b.id].join('|');
    if (!linksFor.has(key)) linksFor.set(key, []);
    linksFor.get(key).push(l);
  }
  for (const e of edges) {
    const ls = linksFor.get(e.a.id + '|' + e.b.id) || [];
    e.open = ls.some((l) => l.type === 'open');
    const forced = ls.find((l) => l.owner);
    e.owner = forced ? byId.get(forced.owner) : (e.b.rank > e.a.rank ? e.b : e.a);
    e.links = ls;
  }

  // walls: each side of each area, cut into pieces: shared (owned or not) or outer
  for (const A of areas) {
    for (const side of ['n', 's', 'w', 'e']) {
      const [f0, f1] = sideRun(A.rect, side);
      const spans = [];
      for (const e of edges) {
        const mine = e.a === A ? e.aSide : e.b === A ? e.bSide : null;
        if (mine !== side) continue;
        spans.push({ s0: e.s0, s1: e.s1, wall: !e.open && e.owner === A });
      }
      const cuts = new Set([f0, f1]);
      for (const sp of spans) { if (sp.s0 > f0 && sp.s0 < f1) cuts.add(sp.s0); if (sp.s1 > f0 && sp.s1 < f1) cuts.add(sp.s1); }
      const pts = [...cuts].sort((p, q) => p - q);
      const ranges = [];
      for (let k = 0; k < pts.length - 1; k++) {
        const p0 = pts[k], p1 = pts[k + 1], mid = (p0 + p1) / 2;
        if (p1 - p0 < 0.01) continue;
        const sp = spans.find((q) => mid > q.s0 && mid < q.s1);
        if (sp) { if (sp.wall) ranges.push({ from: p0, to: p1, style: A.style }); continue; }
        const st = (A.edges && A.edges[side]) || A.edge;
        if (st === 'none') continue;
        const h = A.edgeHeight && A.edgeHeight[side];
        ranges.push({ from: p0, to: p1, style: st, ...(h ? { height: h } : {}), ...(A.outStyle && st === A.style ? { outStyle: A.outStyle } : {}) });
      }
      // merge neighbouring pieces of the same style
      const merged = [];
      for (const r of ranges) {
        const last = merged[merged.length - 1];
        if (last && close(last.to, r.from) && last.style === r.style && last.height === r.height) last.to = r.to;
        else merged.push({ ...r });
      }
      if (merged.length) A.walls[side] = { ranges: merged };
    }
  }

  // openings and portals
  const doors = [], gaps = [], portals = [];
  for (const l of def.links) {
    const e = edgeOf(l.a, l.b);
    const along = e.s0 + (e.s1 - e.s0) * (l.t ?? 0.5);
    const pos = e.cross === 'x' ? { x: e.line, z: along } : { x: along, z: e.line };
    if (l.type === 'open') {
      portals.push({ a: e.a.id, b: e.b.id, ...pos, ...(e.cross === 'x' ? { z: (e.s0 + e.s1) / 2 } : { x: (e.s0 + e.s1) / 2 }), axis: e.cross, width: e.s1 - e.s0 });
      continue;
    }
    const owner = e.owner;
    const side = owner === e.a ? e.aSide : e.bSide;
    const width = Math.min(l.width ?? (l.type === 'gap' ? 2.4 : 2.6), e.s1 - e.s0 - 0.2);
    const height = l.height ?? Math.min(owner.height, l.type === 'gap' ? 3 : 3.2);
    if (l.type === 'door' || l.type === 'debris') {
      if (!l.id) throw new Error('door needs an id: ' + l.a + '/' + l.b);
      doors.push({ id: l.id, kind: l.type, room: owner.id, side, at: along, width, height, zones: [e.a.zone, e.b.zone], label: l.label || byId.get(owner === e.a ? e.b.id : e.a.id).name.toUpperCase() });
      portals.push({ a: e.a.id, b: e.b.id, ...pos, axis: e.cross, width, door: l.id });
    } else {
      gaps.push({ room: owner.id, side, at: along, width, height });
      portals.push({ a: e.a.id, b: e.b.id, ...pos, axis: e.cross, width });
    }
  }

  // windows: on an outside edge of an indoor area
  const at = (room, side, t) => { const [x0, z0, x1, z1] = room.rect; return side === 'n' || side === 's' ? x0 + (x1 - x0) * t : z0 + (z1 - z0) * t; };
  const windows = (def.windows || []).map((w, i) => ({ id: w.id || `win_${w.room}_${w.side}_${i}`, room: w.room, side: w.side, at: at(byId.get(w.room), w.side, w.t ?? 0.5) }));
  const wallBuys = (def.wallBuys || []).map((w) => ({ weapon: w.weapon, room: w.room, side: w.side, at: at(byId.get(w.room), w.side, w.t ?? 0.5), y: w.y ?? 1.45 }));

  // nav: one region per area unless it brings its own (round a big solid thing)
  const navRegions = [];
  for (const A of areas) {
    if (A.regions) { A.regions.forEach((r, i) => navRegions.push({ id: `${A.id}_${i}`, rect: r, room: A.id })); }
    else navRegions.push({ id: A.id, rect: A.rect, room: A.id });
  }
  // portals name areas; turn them into regions (the one each side that holds the point)
  const regionNear = (areaId, p) => {
    const A = byId.get(areaId);
    if (!A.regions) return areaId;
    let best = null, bd = Infinity;
    A.regions.forEach((r, i) => {
      const dx = Math.max(r[0] - p.x, 0, p.x - r[2]), dz = Math.max(r[1] - p.z, 0, p.z - r[3]);
      const d = Math.hypot(dx, dz);
      if (d < bd) { bd = d; best = `${A.id}_${i}`; }
    });
    return best;
  };
  const navPortals = portals.map((p) => ({ ...p, a: regionNear(p.a, p), b: regionNear(p.b, p) }));
  for (const A of areas) for (const p of A.innerPortals || []) navPortals.push({ ...p, a: `${A.id}_${p.a}`, b: `${A.id}_${p.b}` });

  // ground spawns: zombies claw up out of the snow and ice
  const props = def.props || [];
  const avoid = [...props.map((p) => p.box), ...(def.pads || []).map((p) => [p.x - 3, 0, p.z - 3, p.x + 3, 1, p.z + 3]), ...(def.keepClear || [])];
  const clear = (x, z) => !avoid.some((b) => x > b[0] - 1.4 && x < b[3] + 1.4 && z > b[2] - 1.4 && z < b[5] + 1.4);
  const inRegions = (A, x, z) => !A.regions || A.regions.some((r) => x > r[0] + 0.6 && x < r[2] - 0.6 && z > r[1] + 0.6 && z < r[3] - 0.6);
  const groundSpawns = [];
  for (const A of areas) {
    if (A.spawns === false) continue;
    if (!A.outdoor && !A.cave && !A.spawns) continue;
    const [x0, z0, x1, z1] = A.rect;
    const w = x1 - x0, d = z1 - z0;
    const step = A.spawnStep || (A.kind === 'trench' ? 9 : 11);
    const nx = Math.max(1, Math.round((w - 3) / step)), nz = Math.max(1, Math.round((d - 3) / step));
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const x = nx === 1 ? (x0 + x1) / 2 : x0 + 1.8 + (w - 3.6) * (i / (nx - 1));
      const z = nz === 1 ? (z0 + z1) / 2 : z0 + 1.8 + (d - 3.6) * (k / (nz - 1));
      if (!clear(x, z) || !inRegions(A, x, z)) continue;
      groundSpawns.push({ id: `rise_${A.id}_${groundSpawns.length}`, room: A.id, x: +x.toFixed(2), z: +z.toFixed(2) });
    }
  }

  const rooms = areas.map(({ rank, edge, edges: _e, edgeHeight: _h, regions: _r, innerPortals: _p, spawnStep: _s, spawns: _sp, ...r }) => r);
  return { rooms, doors, gaps, windows, wallBuys, navRegions, portals: navPortals, groundSpawns };
}
