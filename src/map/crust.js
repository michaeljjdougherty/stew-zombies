// =============================================================================
// MAP DATA — Call of the Crust (Map 2).
//
// Five islands adrift in space, each on its own meteor with its own air, its
// own dead and its own War Hammer element (step off an edge and you're gone):
//
//                          SHIP GRAVEYARD  (Wind)
//          a lighthouse on a mesa, a zipline down to a wrecked galleon,
//          a capsized hull, wind turbines; a giant head sleeps past the cliffs
//                                   ^
//   ICE CAVES  (Ice)    <-----   THE ANVIL   ----->   RESEARCH BASE  (Lightning)
//   a great cavern, ice shelves   an ancient forge:   a radio mast, the observatory,
//   up toppled pillars, a frozen  a quarry pit with   tesla coils in a storm; the
//   waterfall up to the summit    torches and ruins   Warden powered down
//                                   |
//                                   v
//                           TRENCH FRONT  (Fire)
//          a molten battlefield: you keep to the trenches (up top is shelled
//          and wired off), the fort, the field guns, a crater with a fiend in it
//
// The ground is sculpted on a grid (src/map/terrain.js); buildings are rooms
// (src/map/islandKit.js) standing on it; decks, stairs and spiral stairs go on
// top. Launchers fling you between the Anvil's rim and each island. Later:
// beat an island's titan for its War Hammer core; ice bridges back to the hub.
// Axes: +X east, +Y up, -Z north. Metres.
// =============================================================================
import { buildIslands } from './islandKit.js';
import { Terrain, K, STEP, shape, arcPts, wobble, deck, flight, flightPortals, spiral } from './terrain.js';

const T = 0.5;
const R = (seed) => { let x = seed >>> 0 || 1; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; };

// --- the builder: one island at a time ------------------------------------------------------
class Isle {
  constructor(id, name, element, bounds) {
    this.id = id; this.name = name; this.element = element;
    this.t = new Terrain({ id, ...bounds });
    this.t.openEdges = true;   // (floating in space: nothing stops you walking off the edge)
    this.zones = new Map();       // zone id -> { name, reverb, fixtures }
    this.areas = []; this.links = []; this.windows = []; this.wallBuys = []; this.props = [];
    this.structs = []; this.joins = []; this.portalSpecs = []; this.freeDoors = []; this.rides = [];
    this.decor = []; this.boxSpots = []; this.pads = []; this.later = [];
  }
  zone(id, name, o = {}) { this.zones.set(id, { id, name, reverb: 0.3, fixtures: [], ...o }); return id; }
  lamp(zone, x, z, o = {}) { this.later.push(() => { const y = this.t.heightAt(x, z); this.zones.get(zone).fixtures.push({ x, y: y + (o.h ?? 4.4), z, lit: true, flicker: o.flicker ?? 0.2, kind: o.kind || 'lamp' }); }); }
  // a building (a room or several) standing on the ground
  room(a) { this.areas.push({ spawns: false, ...a }); return a.id; }
  // a deck, a flight, a spiral: boxes, regions, portals
  add(s, o = {}) { this.structs.push({ s, ...o }); return s; }
  prop(kind, x0, z0, x1, z1, h, o = {}) { this.props.push({ kind, x0, z0, x1, z1, h, ...o }); }
  // a downloaded model (src/render/crustModels.js); collide: [x, z, half w, half d, h] for a box round it
  model(spec, { collide } = {}) {
    (this.models ||= []).push(spec);
    if (collide) { const [x, z, hw, hd, h] = collide; this.prop('model', x - hw, z - hd, x + hw, z + hd, h); }
  }
  // a burning torch: its model, a box round it, its fire's light
  torch(zone, x, z, o = {}) {
    const h = o.h ?? 2.6;
    this.later.push(() => {
      const y = o.y ?? this.t.heightAt(x, z);
      this.model({ a: 'torch', x, y, z, yaw: x * 1.7, fit: { h }, look: { glowK: 0.25 } }, { collide: [x, z, 0.22, 0.22, h] });
      this.zones.get(zone).fixtures.push({ x, y: y + h - 0.15, z, lit: true, flicker: 0.6, kind: 'torch' });
    });
  }
  // a portal between whatever's at two points ([x, z, y]): `at` where it is
  portal(a, b, at, axis, width, o = {}) { this.portalSpecs.push({ a, b, at, axis, width, ...o }); }
}

// A deck with a hole in it (a hatch, a stairwell): up to four pieces round the hole.
function deckHole(id, outer, hole, y, o = {}) {
  const [x0, z0, x1, z1] = outer, [hx0, hz0, hx1, hz1] = hole;
  const out = [];
  const rails = o.rails || '';
  const pick = (want) => [...rails].filter((s) => want.includes(s)).join('');
  if (hz0 > z0) out.push(deck(id + '_n', [x0, z0, x1, hz0], y, { ...o, rails: pick('nwe') }));
  if (hz1 < z1) out.push(deck(id + '_s', [x0, hz1, x1, z1], y, { ...o, rails: pick('swe') }));
  if (hx0 > x0) out.push(deck(id + '_w', [x0, hz0, hx0, hz1], y, { ...o, rails: pick('w') }));
  if (hx1 < x1) out.push(deck(id + '_e', [hx1, hz0, x1, hz1], y, { ...o, rails: pick('e') }));
  return out;
}

// A deck with several holes cut out of it: the pieces left.
function deckCut(id, outer, holes, y, o = {}) {
  let rects = [outer];
  for (const [hx0, hz0, hx1, hz1] of holes) {
    const next = [];
    for (const r of rects) {
      const [x0, z0, x1, z1] = r;
      if (hx1 <= x0 || hx0 >= x1 || hz1 <= z0 || hz0 >= z1) { next.push(r); continue; }
      if (hz0 > z0) next.push([x0, z0, x1, hz0]);
      if (hz1 < z1) next.push([x0, hz1, x1, z1]);
      if (hx0 > x0) next.push([x0, Math.max(z0, hz0), hx0, Math.min(z1, hz1)]);
      if (hx1 < x1) next.push([hx1, Math.max(z0, hz0), x1, Math.min(z1, hz1)]);
    }
    rects = next;
  }
  return rects.map((r, i) => deck(`${id}_${i}`, r, y, o));
}

// Where a rock face is, marching from (x, z) along (dx, dz): a spot on it for a
// wall weapon, facing back the way you came.
function rockFace(t, x, z, dx, dz, y0, minH = 2.4) {
  let px = x, pz = z;
  for (let i = 0; i < 400; i++) {
    const nx = px + dx * 0.25, nz = pz + dz * 0.25;
    const k = t.kindAt(nx, nz);
    if (k === K.SEA) break;
    if (t.heightAt(nx, nz) > y0 + minH) {
      // snap to the cell edge
      const c = t.cell;
      const ex = dx > 0 ? Math.ceil((px - t.x0) / c) * c + t.x0 : dx < 0 ? Math.floor((px - t.x0) / c) * c + t.x0 : px;
      const ez = dz > 0 ? Math.ceil((pz - t.z0) / c) * c + t.z0 : dz < 0 ? Math.floor((pz - t.z0) / c) * c + t.z0 : pz;
      return { pos: { x: ex - dx * 0.04, y: y0 + 1.45, z: ez - dz * 0.04 }, normal: { x: -dx, z: -dz } };
    }
    px = nx; pz = nz;
  }
  throw new Error(`no rock face from ${x},${z}`);
}

const box6 = (x0, z0, x1, z1, y0, y1) => [x0, y0, z0, x1, y1, z1];

// =============================================================================
// THE ANVIL: a sunken quarry. You come to at the bottom of the pit, by the
// Anvil itself (its four sockets empty, waiting for the War Hammers), two
// guns chalked on the rock. Ramps wind up the quarry walls to two terraces,
// scaffold catwalks cross the pit between them, and the ramps go on up to
// the rim, a walkway round the top joining the four launch decks.
// =============================================================================
function hub() {
  const I = new Isle('hub', 'The Anvil', null, { x0: -52, z0: -52, x1: 52, z1: 52 });
  const t = I.t;
  const PIT = I.zone('pit', 'The Pit', { reverb: 0.7 });
  const TW = I.zone('terraceW', 'West Terrace');
  const TE = I.zone('terraceE', 'East Terrace');
  const RAMPS = I.zone('ramps', 'Quarry Ramps');
  const RIM = I.zone('rim', 'The Rim');
  const CATS = I.zone('scaffold', 'Scaffold Catwalks');
  const F = 0, TER = 4.5, RIMH = 9;
  // the island: rock rising out of the ice, falling away outside the rim
  t.paint(shape.circle(0, 0, 45, 2.5), { kind: K.ROCK, mat: 'rock', h: (x, z) => { const d = Math.hypot(x, z); return Math.max(0.8, Math.min(RIMH + 1.5, RIMH + 1.5 - Math.max(0, d - 31) * 0.95) + wobble(x, z, 0.8, 0.5)); } });
  // the quarry wall: falling steeply from the rim to the floor (step off the rim
  // anywhere and you'll tumble down it)
  t.paint(shape.ring(0, 0, 13, 23, 1.2), { kind: K.ROCK, mat: 'rock', h: (x, z) => Math.max(0.6, RIMH - 0.4 - (22.6 - Math.hypot(x, z)) * 1.3 + wobble(x, z, 0.5, 0.9)) });
  // the rim walkway, wider at the launch decks and the depot
  t.paint(shape.ring(0, 0, 22.5, 31, 1.4), { h: RIMH, zone: RIM });
  for (const [x, z] of [[0, -28], [28, 0], [0, 28], [-28, 0]]) t.paint(shape.circle(x, z, 6.5, 1), { h: RIMH, zone: RIM });
  t.paint(shape.circle(22, -22, 8.5, 1.2), { h: RIMH, zone: RIM });
  // the pit floor
  t.paint(shape.circle(0, 0, 15.5, 1.5), { h: F, zone: PIT, mat: 'snow' });
  t.paint(shape.circle(0, 0, 8.5, 0.6), { h: F, zone: PIT, mat: 'flagstone', spawn: false });
  // two terraces half way up, west and east: their outer edge is the rim's
  // cliff (jump down from the rim), their inner edge a drop to the floor
  t.paint(shape.arc(0, 0, 15.5, 22.6, 140, 220, 1.2), { h: TER, zone: TW, only: (k) => k === K.ROCK });
  t.paint(shape.arc(0, 0, 15.5, 22.6, 320, 40, 1.2), { h: TER, zone: TE, only: (k) => k === K.ROCK });
  // the ramps, winding up the walls: floor -> west terrace -> rim (north),
  // floor -> east terrace -> rim (south-east)
  // (the floor runs right up to the foot of each ramp)
  t.paint(shape.arc(0, 0, 11, 19.4, 82, 99), { h: F, zone: PIT, only: (k) => k === K.ROCK });
  t.paint(shape.arc(0, 0, 11, 19.4, 262, 279), { h: F, zone: PIT, only: (k) => k === K.ROCK });
  t.ramp(arcPts(0, 0, 17.6, 92, 142, F, TER, 6), 3.6, { zone: RAMPS, mat: 'snow' });
  t.ramp([...arcPts(0, 0, 18.6, 218, 258, TER, 8.3, 6), [Math.cos(266 * Math.PI / 180) * 24.5, Math.sin(266 * Math.PI / 180) * 24.5, RIMH]], 3.6, { zone: RAMPS, mat: 'snow' });
  t.ramp(arcPts(0, 0, 17.6, 272, 322, F, TER, 6), 3.6, { zone: RAMPS, mat: 'snow' });
  t.ramp([...arcPts(0, 0, 18.6, 38, 78, TER, 8.3, 6), [Math.cos(86 * Math.PI / 180) * 24.5, Math.sin(86 * Math.PI / 180) * 24.5, RIMH]], 3.6, { zone: RAMPS, mat: 'snow' });
  // the low ends of the floor ramps come out of a cutting (rubble either side):
  // the only way up is past the debris
  for (const [a0, a1] of [[101, 121], [281, 301]]) {
    t.paint(shape.arc(0, 0, 14.6, 15.9, a0, a1), { kind: K.ROCK, mat: 'rock', h: (x, z, old) => Math.max(old, 0) + 2.4, only: (k) => k !== K.SEA });
  }
  // an ice slide off the west rim down a chute into the pit
  I.rides.push({ id: 'slide_hub', kind: 'slide', mouth: 1.4, pts: [[-25.3, RIMH, -6.6], [-21.5, 7.6, -5.6], [-17.6, 4.9, -4.5], [-14.0, 2.0, -3.6], [-10.6, 0.25, -2.6], [-8.2, 0.05, -2.0]] });
  // scaffold catwalks across the pit between the terraces, north and south of the Anvil
  for (const [id, z] of [['cat_n', -9], ['cat_s', 9]]) {
    I.add(deck(id, [-19, z - 1.2, 19, z + 1.2], TER, { zone: CATS, look: 'scaffold' }), { connect: 'nswe' });
  }
  // debris across the bottoms of the ramps
  I.freeDoors.push({ id: 'debris_hub_west', kind: 'debris', x: Math.cos(100 * Math.PI / 180) * 17.6, z: Math.sin(100 * Math.PI / 180) * 17.6, axis: 'z', width: 4.4, height: 3.2, zones: [PIT, RAMPS], label: 'THE RAMPS' });
  I.freeDoors.push({ id: 'debris_hub_east', kind: 'debris', x: Math.cos(280 * Math.PI / 180) * 17.6, z: Math.sin(280 * Math.PI / 180) * 17.6, axis: 'z', width: 4.4, height: 3.2, zones: [PIT, RAMPS], label: 'THE RAMPS' });
  // the supply depot on the rim
  I.room({ id: 'depot', kind: 'tin', rect: [17, -26, 26, -19], y: RIMH, height: 4.2, name: 'Supply Depot', zone: 'depot', fixtures: [{ x: 21.5, y: RIMH + 3.9, z: -22.5, lit: true, flicker: 0.3, kind: 'hanging' }] });
  I.links.push({ a: 'depot', out: 's', t: 0.5, type: 'door', id: 'door_hub_depot', name: 'Supply Depot' });
  I.links.push({ a: 'depot', out: 'w', t: 0.5, type: 'gap', width: 2 });
  I.wallBuys.push({ weapon: 'PM64', room: 'depot', side: 'n', t: 0.5 });
  I.boxSpots.push({ id: 'box_depot', room: 'depot', x: 25.4, z: -22.5, yaw: -Math.PI / 2 });
  // in the pit: the Anvil (empty sockets), two guns on the rock, the box
  I.prop('anvil', -5, -5, 5, 5, 22, { blank: true });
  // a ring of rune stones round it
  const runes = ['Runic_1', 'Runic_2', 'Runic_3', 'Runic_4', 'Runic_5', 'Runic_6', 'Runic_7'];
  runes.forEach((k, i) => {
    const a = (i / runes.length) * Math.PI * 2 + 0.45, x = Math.cos(a) * 8.6, z = Math.sin(a) * 8.6;
    I.model({ a: 'stones', pick: [k], x, y: F, z, yaw: -a + Math.PI / 2, fit: { h: 2.6 }, look: { glow: '#5a4420' } }, { collide: [x, z, 0.6, 0.6, 2.6] });
  });
  const rh = R(9);
  for (let i = 0; i < 18; i++) {
    const a = rh() * Math.PI * 2, r = 32 + rh() * 8, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(Math.abs(x) - 28) < 8 && Math.abs(z) < 8 || Math.abs(Math.abs(z) - 28) < 8 && Math.abs(x) < 8) continue;
    I.model({ a: 'stones', pick: [['Big_2', 'Big_3', 'Big_4', 'BIG_1', 'Mid_1', 'Mid_2'][i % 6]], x, y: Math.max(F, t.heightAt(x, z)) - 0.6, z, yaw: rh() * 6, scale: 1.2 + rh() * 0.8, look: { tint: '#5a5660' } });
  }
  I.later.push(() => {
    I.wallBuys.push({ weapon: 'M15', zone: PIT, room: PIT, ...rockFace(t, -4, -8, 0, -1, F) });
    I.wallBuys.push({ weapon: 'MP41', zone: PIT, room: PIT, ...rockFace(t, 4, 8, 0, 1, F) });
  });
  I.boxSpots.push({ id: 'box_pit', room: PIT, x: -11, z: 7.5, yaw: Math.PI * 0.75, start: true });
  I.prop('wreck', 9, 9.5, 13, 12.5, 1.4);
  I.prop('barrel', 10.6, -11.4, 11.3, -10.7, 0.95, { fire: true });
  I.prop('crate', -12.6, -9, -11.4, -7.8, 1.1);
  I.prop('rock', 12, -3, 14, -1, 1.4);
  // the rim: the four decks, a few things lying about
  I.prop('crate', -27, 22, -25.8, 23.2, 1.1); I.prop('crate', -25.6, 22, -24.4, 23.2, 0.8);
  I.prop('barrel', 26.6, 20.6, 27.3, 21.3, 0.95, { fire: true });
  I.prop('tent', 18, 24, 22, 28, 2.0);
  I.lamp(PIT, -9.5, -9.5, { h: 3.6, flicker: 0.1 }); I.lamp(PIT, 9.5, 9.5, { h: 3.6, flicker: 0.15 });
  for (const [x, z] of [[4, -27], [27, 4], [-4, 27], [-27, -4]]) I.lamp(RIM, x, z, { flicker: 0.2 });
  I.pads.push({ id: 'pad_hub_n', x: 0, z: -28, to: 'pad_ship', label: 'the Ship Graveyard' });
  I.pads.push({ id: 'pad_hub_e', x: 28, z: 0, to: 'pad_research', label: 'the Research Base' });
  I.pads.push({ id: 'pad_hub_s', x: 0, z: 28, to: 'pad_trench', label: 'the Trench Front' });
  I.pads.push({ id: 'pad_hub_w', x: -28, z: 0, to: 'pad_caves', label: 'the Ice Caves' });
  // the ancient forge: torches round the pit floor and flanking the launch decks,
  // broken pillars on the terraces, rubble walls along the rim's edge, stone
  // arches standing out on the slopes, an old well in the pit
  const deg = (a) => a * Math.PI / 180;
  for (const a of [20, 120, 165, 195, 240, 300, 335]) I.torch(PIT, Math.cos(deg(a)) * 13.4, Math.sin(deg(a)) * 13.4);
  for (const a of [-13, 13, 77, 103, 167, 193, 257, 283]) I.torch(RIM, Math.cos(deg(a)) * 26.8, Math.sin(deg(a)) * 26.8, { h: 2.9 });
  for (const a of [172, 188, 352, 8]) {
    const x = Math.cos(deg(a)) * 20.4, z = Math.sin(deg(a)) * 20.4;
    I.model({ a: 'pillar', x, y: TER - 0.1, z, yaw: a, fit: { h: 5.5 + (a % 3) }, look: { tint: '#8a7e78' } }, { collide: [x, z, 0.85, 0.85, 7] });
  }
  I.later.push(() => {
    [[30, 'wall2'], [125, 'wall3'], [145, 'wall2'], [215, 'wall3'], [235, 'wall2'], [60, 'wall3']].forEach(([a, w], i) => {
      const x = Math.cos(deg(a)) * 31.4, z = Math.sin(deg(a)) * 31.4;
      I.model({ a: w, x, y: t.heightAt(x, z) - 0.35, z, yaw: -deg(a) + Math.PI / 2 + (i % 2 ? Math.PI : 0), fit: { len: 7.5 }, look: { tint: '#7a7070' } });
    });
    for (const [a, r] of [[135, 37], [225, 37], [45, 39]]) {
      const x = Math.cos(deg(a)) * r, z = Math.sin(deg(a)) * r;
      I.model({ a: 'gate', x, y: t.heightAt(x, z) - 0.6, z, yaw: -deg(a), fit: { h: 6.5 }, look: { tint: '#9a9088' } });
    }
    for (const [a, r] of [[160, 36], [205, 35]]) {
      const x = Math.cos(deg(a)) * r, z = Math.sin(deg(a)) * r;
      I.model({ a: 'wall1', x, y: t.heightAt(x, z) - 0.5, z, yaw: -deg(a) + Math.PI / 2, fit: { h: 3.6 }, look: { tint: '#857a74' } });
    }
  });
  I.model({ a: 'well', x: -11.5, y: F, z: -2, yaw: 0.4, fit: { h: 2.8 } }, { collide: [-11.5, -2, 1.5, 1.5, 2.2] });
  I.spawnAvoid = [[-6.5, -6.5, 6.5, 6.5]];
  I.openFall = shape.ring(0, 0, 12, 23.5);   // (no invisible wall at the top of the quarry's walls)
  I.playerSpawns = [{ x: -3, z: 11, yaw: Math.PI }, { x: 3, z: 11, yaw: Math.PI }, { x: -3, z: 13, yaw: Math.PI }, { x: 3, z: 13, yaw: Math.PI }];
  return I;
}

// =============================================================================
// SHIP GRAVEYARD (north, Wind): a windswept rock where the storm drops the
// ships it catches. Land on the pier. A fishing village to the west (debris
// heaped against the net shed: climb it onto the roofs); a mesa to the
// north-west with the old screw-pile lighthouse on it, a scaffold gallery
// round its lamp house and a zipline from there down onto the wrecked
// galleon in the dry harbor (its hold, hatches up to the deck, the gangway,
// stairs to the stern castle); to the east a capsized hull you can walk along
// and drop into; cargo containers spilled everywhere.
// =============================================================================
function ship() {
  const I = new Isle('ship', 'Ship Graveyard', 'wind', { x0: -60, z0: -212, x1: 60, z1: -104 });
  const t = I.t;
  const SHORE = I.zone('shore', 'The Shore');
  const PIER = I.zone('pier', 'The Pier');
  const VIL = I.zone('village', 'Fishing Village');
  const HAR = I.zone('harbor', 'The Dry Harbor');
  const PT = I.zone('point', 'Lighthouse Mesa');
  const WRK = I.zone('wreckyard', 'Wreck Yard');
  const SHIPZ = I.zone('galleon', 'The Galleon', { reverb: 0.5 });
  const HULLZ = I.zone('hulltop', 'The Capsized Hull');
  const LH = I.zone('lighthouseGallery', 'The Lighthouse');
  const G = 0.8, BAS = 0.4;
  t.paint(shape.poly([[-50, -200], [-10, -207], [30, -203], [52, -186], [55, -150], [49, -122], [20, -116], [9, -109], [-9, -109], [-20, -117], [-48, -124], [-56, -150], [-55, -180]], 2.5), { h: G, zone: SHORE });
  t.paint(shape.rect(-60, -162, -22, -110), { h: G, zone: VIL, only: (k) => k === K.GROUND });
  t.paint(shape.rect(30, -205, 60, -110), { h: G, zone: WRK, only: (k) => k === K.GROUND });
  t.paint(shape.ellipse(12, -160, 24, 15, 2), { h: BAS, zone: HAR, mat: 'mud' });
  // the dried harbor's bed: sucking mud in its low spots
  I.mud = [{ x: 18, z: -172, r: 5 }, { x: -4, z: -150, r: 4 }, { x: 26, z: -149, r: 3.5 }];
  t.paint(shape.rect(-8, -128, 8, -108), { h: G, zone: PIER, mat: 'planks', spawn: false });
  for (const [x, z, r, h] of [[-50, -168, 5, 4.5], [14, -204, 6, 6.5], [46, -194, 6.5, 7.5], [53, -168, 4, 4]]) {
    t.paint(shape.circle(x, z, r, 1.4), { kind: K.ROCK, mat: 'rock', h: (px, pz) => h + wobble(px, pz, 1.2, 0.8) - Math.hypot(px - x, pz - z) * 0.35 });
  }
  // the lighthouse mesa, a road winding up round it
  const LX = -36, LZ = -188, MESA = 9.4;
  t.paint(shape.circle(LX, LZ, 13.5, 1), { h: MESA, zone: PT });
  t.ramp(arcPts(LX, LZ, 15.1, 62, -42, G, MESA, 6), 3.8, { zone: PT });
  // debris heaped against the net shed: up onto the roofs
  t.ramp([[-36.5, -121, G], [-36.5, -132.5, 4.3]], 3, { zone: VIL, jag: 0.5 });
  // a drift of sand up onto the capsized hull's keel
  t.ramp([[42.5, -127, G], [42.5, -146.5, 6.3]], 3.4, { zone: WRK });

  // the village: the net shed and the smokehouse (flat roofs you can walk on)
  for (const [id, name, z0, z1, gun] of [['netshed', 'Net Shed', -142, -134, 'MP41'], ['smokehouse', 'Smokehouse', -156, -148, 'PM64']]) {
    I.room({ id, kind: 'cabin', rect: [-41, z0, -31, z1], y: G, height: 3.2, name, flatRoof: true, fixtures: [{ x: -36, y: G + 2.9, z: (z0 + z1) / 2, lit: true, flicker: 0.2, kind: 'hanging' }] });
    I.links.push({ a: id, out: 'e', t: 0.5, type: 'door', id: 'door_ship_' + id, name });
    I.windows.push({ room: id, side: 'w', t: 0.5 });
    I.wallBuys.push({ weapon: gun, room: id, side: 'n', t: 0.35 });
    I.add(deck(id + '_roof', [-42, z0 - 1, -30, z1 + 1], G + 3.5, { zone: VIL, look: 'planks' }), { connect: 'nswe' });
  }
  I.add(deck('plank_roofs', [-37.5, -147, -34.5, -143], G + 3.5, { zone: VIL, look: 'planks' }), { connect: 'we' });

  // the lighthouse on its mesa: the lamp house up on piles, a scaffold gallery round it
  const PORCH = MESA + 5.75;
  I.model({ a: 'lighthouse', x: LX, y: MESA, z: LZ, yaw: 0.3 }, { collide: [LX, LZ, 7.5, 7.5, 12] });
  for (const d of deckHole('gallery', [LX - 9.4, LZ - 9.4, LX + 9.4, LZ + 9.4], [LX - 7.6, LZ - 7.6, LX + 7.6, LZ + 7.6], PORCH, { zone: LH, rails: 'nswe', look: 'scaffold' })) I.add(d);
  I.add(deck('gallery_top', [LX - 11.2, LZ - 5.8, LX - 9.4, LZ - 4], PORCH, { zone: LH, rails: 'nw', look: 'scaffold' }));
  const gst = I.add(flight('gallery_stairs', [LX - 11.2, LZ - 4, LX - 9.4, LZ + 4], MESA, PORCH, 'n', { zone: LH, look: 'steel' }), { footprint: MESA });
  I.portalSpecs.push({ flight: gst, belowAt: [LX - 10.3, LZ + 4.6, MESA], aboveId: 'gallery_top' });
  I.decor.push({ kind: 'beacon', x: LX, y: MESA + 14.8, z: LZ });

  // the galleon, wrecked in the dry harbor: the hold, hatches to the main deck,
  // the gangway, stairs up to the stern castle (it lies east-west, bow east)
  const SX = 15, SZ = -160, SY = BAS + 0.3;            // where the model sits
  const HOLD = BAS, MAIN = SY + 3.0, AFT = SY + 7.75;
  I.model({ a: 'pirateship', x: SX, y: SY - 2.4, z: SZ, yaw: Math.PI / 2, look: { glow: '#3a3026' } });
  I.room({ id: 'hold', kind: 'hull', rect: [4, -162.5, 26, -157.5], y: HOLD, height: MAIN - 0.3 - HOLD, name: 'Galleon Hold', ceiling: 'none', edge: 'invisible', style: 'invisible', floor: 'deck', fixtures: [{ x: 10, y: HOLD + 2.8, z: -160, lit: true, flicker: 0.4, kind: 'hanging' }, { x: 20, y: HOLD + 2.8, z: -160, lit: true, flicker: 0.2, kind: 'hanging' }] });
  I.wallBuys.push({ weapon: 'Olympus', room: 'hold', side: 'n', t: 0.5 }, { weapon: 'Staykout', room: 'hold', side: 's', t: 0.5 });
  I.boxSpots.push({ id: 'box_hold', room: 'hold', x: 25.4, z: -160, yaw: -Math.PI / 2 });
  const hA = I.add(flight('hatch_a', [6, -160, 12, -157.5], HOLD, MAIN, 'e', { zone: SHIPZ, look: 'planks' }));
  const hB = I.add(flight('hatch_b', [18, -162.5, 24, -160], HOLD, MAIN, 'w', { zone: SHIPZ, look: 'planks' }));
  for (const d of deckCut('main', [2.5, -163.5, 27.5, -156.5], [[6, -160, 12, -157.5], [18, -162.5, 24, -160]], MAIN, { zone: SHIPZ, look: 'hidden' })) I.add(d, { connect: 'nswe' });
  I.joins.push(...flightPortals(hA, 'hold', null), ...flightPortals(hB, 'hold', null));
  I.add(deck('aft', [-2.5, -163, 2.5, -157], AFT, { zone: SHIPZ, look: 'hidden' }), { connect: 'nsw' });
  const ast = I.add(flight('aft_stairs', [2.5, -163, 9, -161], MAIN, AFT, 'w', { zone: SHIPZ, look: 'planks' }));
  I.portalSpecs.push({ flight: hA, aboveAt: [12.3, -158.7, MAIN] }, { flight: hB, aboveAt: [17.7, -161.3, MAIN] }, { flight: ast, belowAt: [9.3, -162, MAIN], aboveId: 'aft' });
  const gang = I.add(flight('gangway', [19, -156.5, 22, -150], HOLD, MAIN, 'n', { zone: SHIPZ, look: 'planks' }), { footprint: HOLD });
  I.portalSpecs.push({ flight: gang, belowAt: [20.5, -149.4, HOLD], aboveAt: [20.5, -157, MAIN] });
  // the zipline from the lighthouse gallery down onto the stern castle
  I.rides.push({ id: 'zip_lighthouse', kind: 'zip', label: 'the galleon', pts: [[LX + 8.5, PORCH + 2.2, LZ], [0, AFT + 2.35, SZ]] });

  // the capsized hull: walk along the keel, drop in through the hole
  const CY = G, KY = 6.3;
  I.room({ id: 'capsized', kind: 'hull', rect: [38, -178, 47, -148], y: CY, height: KY - 0.3 - CY, name: 'The Capsized Hull', ceiling: 'none', fixtures: [{ x: 42.5, y: CY + 4.6, z: -170, lit: true, flicker: 0.6, kind: 'hanging' }, { x: 42.5, y: CY + 4.6, z: -154, lit: true, flicker: 0.3, kind: 'hanging' }] });
  I.links.push({ a: 'capsized', out: 'w', t: 0.5, type: 'door', id: 'door_ship_capsized', name: 'The Hull' });
  I.wallBuys.push({ weapon: 'AK-75u', room: 'capsized', side: 'e', t: 0.3 });
  I.boxSpots.push({ id: 'box_capsized', room: 'capsized', x: 46.4, z: -158, yaw: -Math.PI / 2 });
  for (const d of deckHole('hull', [37, -179, 48, -147], [40.5, -165, 44.5, -161], KY, { zone: HULLZ, look: 'hullTop' })) I.add(d, { connect: 'nswe' });
  I.joins.push({ a: 'hull_n', b: 'capsized', x: 42.5, z: -165, axis: 'z', width: 4, dirAB: 1, drop: true, oneWay: true });
  I.joins.push({ a: 'hull_s', b: 'capsized', x: 42.5, z: -161, axis: 'z', width: 4, dirAB: -1, drop: true, oneWay: true });
  I.decor.push({ kind: 'capsized', rect: [37, -179, 48, -147], keelY: KY, hole: [40.5, -165, 44.5, -161] });

  // spilled cargo, rocks, wind-bent trees
  for (const [x, z, yaw, rows] of [[-12, -176, 0.25, [0, 1]], [32, -130, -0.4, [2]], [-4, -197, 1.2, [3, 4]], [28, -186, 0.9, [5]]]) {
    I.model({ a: 'containers', pick: rows.map((r) => ['Object_0', 'Object_12', 'Object_18', 'Object_21', 'Object_24', 'Object_38'][r]), x, y: BAS, z, yaw }, { collide: [x, z, 3.4, 3.4, 2.9] });
  }
  I.model({ a: 'containers', pick: ['Object_36', 'Object_37', 'Object_39'], x: -2, y: G, z: -132, yaw: 1.4, rz: 0.03 }, { collide: [-2, -132, 4, 6.2, 2.9] });
  const rr = R(17);
  for (const [x, z] of [[-48, -142], [-26, -128], [-50, -186], [34, -120], [50, -150], [-14, -200], [24, -198], [-46, -126]]) {
    I.model({ a: 'maple', x, y: G - 0.2, z, yaw: rr() * 6, fit: { h: 7 + rr() * 3 }, rz: 0.12, look: { tint: '#9a8a6a' } });
  }
  for (const [x, z, k] of [[-30, -200, 'Big_2'], [5, -205, 'Big_3'], [50, -134, 'Mid_2'], [-54, -158, 'BIG_1'], [-6, -112, 'Mid_3'], [40, -200, 'Big_5']]) I.model({ a: 'stones', pick: [k], x, y: G - 0.3, z, yaw: rr() * 6, scale: 1.3 });
  I.prop('rack', -27, -138, -21, -137.4, 1.9); I.prop('rack', -27, -146, -21, -145.4, 1.9);
  I.prop('barrel', -20.35, -128.35, -19.65, -127.65, 0.95, { fire: true });
  I.prop('crate', 5, -124, 6.2, -122.8, 1.1); I.prop('crate', 6.4, -124, 7.6, -122.8, 0.8);
  I.prop('shrine', -24, -164, -21, -161, 3.6, { element: 'wind' });
  I.prop('barrel', 33.65, -186.35, 34.35, -185.65, 0.95, { fire: true });
  I.lamp(PIER, 6, -118); I.lamp(VIL, -26, -140, { flicker: 0.15 }); I.lamp(PT, -30, -180, { flicker: 0.1 });
  I.lamp(WRK, 34, -140, { flicker: 0.3 }); I.lamp(HAR, -4, -168, { flicker: 0.2 });
  // wind turbines turning on the rocks, fencing along the village and the pier,
  // planks blown off the wrecks
  I.later.push(() => {
    for (const [x, z, h] of [[14, -204, 15], [46, -194, 17], [53, -168, 13], [-50, -168, 12]]) I.model({ a: 'turbine', anim: true, animSpeed: 0.7 + (x % 3) * 0.1, x, y: t.heightAt(x, z) - 0.3, z, yaw: 0.2, fit: { h } }, { collide: [x, z, 0.6, 0.6, h * 0.6] });
  });
  for (const [x, z, yaw] of [[-27, -120, 0], [-48, -132, 1.57], [11, -116, 0.3]]) I.model({ a: 'fence', x, y: G, z, yaw, fit: { h: 1.3 }, look: { tint: '#6a6058' } });
  for (const [x, z, yaw] of [[32, -152, 0.4], [24, -176, 2.1], [-14, -150, 1.1], [6, -186, 2.8]]) I.model({ a: 'planks', x, y: BAS + 0.05, z, yaw, fit: { len: 4.5 }, look: { tint: '#8a7a68' } });
  // the Drowned Captain, sleeping out in the dark past the north cliffs
  I.model({ a: 'pirathead', x: 9, y: -1.5, z: -221, yaw: -Math.PI / 2 + 0.15, rx: 0.1, fit: { h: 13 }, look: { glow: '#5a6a58' } });
  I.pads.push({ id: 'pad_ship', x: 0, z: -114, to: 'pad_hub_n', label: 'the Anvil' });
  return I;
}

// =============================================================================
// RESEARCH BASE (east, Lightning). Land on the helipad. The labs in the
// middle; a radio mast to the north-east with spiral stairs up through two
// platforms (jump off the lower one); the observatory dome with a ramp
// winding up round the telescope's plinth; tesla coils to the south with
// raised catwalks between them.
// =============================================================================
function research() {
  const I = new Isle('research', 'Research Base', 'lightning', { x0: 98, z0: -54, x1: 208, z1: 54 });
  const t = I.t;
  const CMP = I.zone('compound', 'The Compound');
  const HELI = I.zone('helipad', 'Helipad');
  const RADIO = I.zone('radioyard', 'Radio Yard');
  const EAST = I.zone('eastyard', 'East Yard');
  const TES = I.zone('teslayard', 'Tesla Yard');
  const MAST = I.zone('mast', 'Radio Mast');
  const RAMP = I.zone('domeramp', 'Observatory Ramp', { reverb: 0.8 });
  const CAT = I.zone('catwalks', 'Tesla Catwalks');
  const G = 0.8;
  t.paint(shape.poly([[108, -40], [130, -47], [170, -47], [199, -37], [201, 0], [199, 37], [170, 47], [130, 47], [108, 40], [104, 0]], 2.5), { h: G, zone: CMP });
  t.paint(shape.rect(98, -54, 124, 54), { h: G, zone: HELI, only: (k) => k === K.GROUND });
  t.paint(shape.rect(168, -54, 208, -4), { h: G, zone: RADIO, only: (k) => k === K.GROUND });
  t.paint(shape.rect(168, -4, 208, 54), { h: G, zone: EAST, only: (k) => k === K.GROUND });
  t.paint(shape.rect(124, 19, 168, 54), { h: G, zone: TES, only: (k) => k === K.GROUND });
  t.paint(shape.circle(113, 0, 7), { h: G, zone: HELI, mat: 'concrete', spawn: false });
  for (const [x, z, r, h] of [[196, -30, 5, 5], [130, -44, 4.5, 4], [196, 32, 5, 5.5], [110, 34, 4, 4]]) {
    t.paint(shape.circle(x, z, r, 1.2), { kind: K.ROCK, mat: 'rock', h: (px, pz) => h + wobble(px, pz, 1, 0.8) - Math.hypot(px - x, pz - z) * 0.4 });
  }

  // the labs
  I.room({ id: 'mainlab', kind: 'lab', rect: [128, -20, 148, -3], y: G, name: 'Main Lab', fixtures: [{ x: 138, y: G + 3.1, z: -11, lit: true, flicker: 0.1 }] });
  I.room({ id: 'genhall', kind: 'tin', rect: [148.5, -20, 166, -3], y: G, name: 'Generator Hall', fixtures: [{ x: 157, y: G + 4.6, z: -11, lit: true, flicker: 0.2, kind: 'hanging' }] });
  I.room({ id: 'spine', kind: 'hall', rect: [128, -2.5, 166, 2.5], y: G, name: 'Main Corridor', fixtures: [{ x: 134, y: G + 3.1, z: 0, lit: true, flicker: 0.3 }, { x: 147, y: G + 3.1, z: 0, lit: true, flicker: 0.1 }, { x: 160, y: G + 3.1, z: 0, lit: true, flicker: 0.6 }] });
  I.room({ id: 'mess', kind: 'lab', rect: [128, 3, 146, 18], y: G, name: 'Mess Hall', style: 'cafe', fixtures: [{ x: 137, y: G + 3.1, z: 10.5, lit: true, flicker: 0.1 }] });
  I.room({ id: 'garage', kind: 'tin', rect: [146.5, 3, 166, 18], y: G, name: 'Garage', fixtures: [{ x: 156, y: G + 4.6, z: 10.5, lit: true, flicker: 0.2, kind: 'hanging' }] });
  I.links.push(
    { a: 'spine', b: 'mainlab', type: 'door', id: 'door_res_lab', t: 0.5 },
    { a: 'spine', b: 'genhall', type: 'gap', width: 1.8, height: 2.6 },
    { a: 'mainlab', b: 'genhall', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'spine', b: 'mess', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'spine', b: 'garage', type: 'door', id: 'door_res_garage' },
    { a: 'mess', b: 'garage', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'spine', out: 'w', type: 'door', id: 'door_res_airlock', name: 'The Labs' },
    { a: 'spine', out: 'e', type: 'gap', width: 2.2, height: 2.6 },
    { a: 'garage', out: 's', type: 'gap', width: 3.2, height: 3.2, t: 0.6 },
    { a: 'genhall', out: 'n', type: 'door', id: 'door_res_gen', name: 'Generator Hall', t: 0.6 },
    { a: 'mess', out: 'w', type: 'gap', width: 1.6, height: 2.4, t: 0.7 },
  );
  I.windows.push({ room: 'mainlab', side: 'n', t: 0.25 }, { room: 'mess', side: 's', t: 0.4 }, { room: 'mainlab', side: 'w', t: 0.5 });
  I.wallBuys.push({ weapon: 'M17', room: 'mainlab', side: 'n', t: 0.6 }, { weapon: 'MP6K', room: 'genhall', side: 'e', t: 0.5 }, { weapon: 'PM64', room: 'mess', side: 'w', t: 0.3 }, { weapon: 'AK-75u', room: 'garage', side: 'e', t: 0.5 });
  I.boxSpots.push({ id: 'box_garage', room: 'garage', x: 165.4, z: 10.5, yaw: -Math.PI / 2 }, { id: 'box_gen', room: 'genhall', x: 157, z: -19.4, yaw: 0 });

  // the radio mast: spiral stairs up to two platforms
  const MX = 184, MZ = -28, P1 = 9.0, P2 = 17.0;
  const mA = I.add(spiral('mastA', MX, MZ, 7, G, P1, { zone: MAST, perFlight: (P1 - G) / 6, look: 'steel' }), { footprint: G, connectBottom: 'sw' });
  const mB = I.add(spiral('mastB', MX, MZ, 7, P1, P2, { zone: MAST, perFlight: (P2 - P1) / 6, look: 'steel', startSide: 'n', from: mA.top }));
  void mB;
  for (const d of deckHole('mast1', [MX - 6, MZ - 6, MX + 6, MZ + 6], [MX - 3.5, MZ - 3.5, MX + 3.5, MZ + 3.5], P1, { zone: MAST, look: 'grate' })) I.add(d, { connect: 'nswe' });
  for (const d of deckHole('mast2', [MX - 5, MZ - 5, MX + 5, MZ + 5], [MX - 3.5, MZ - 3.5, MX + 3.5, MZ + 3.5], P2, { zone: MAST, look: 'grate', rails: 'nswe' })) I.add(d);
  I.decor.push({ kind: 'mast', x: MX, z: MZ, size: 7, h: 34, y: G });

  // the observatory dome: a ramp winding up round the plinth to the telescope
  const DX = 181, DZ = 17, DT = 6.0;
  I.room({
    id: 'dome', kind: 'lab', rect: [172, 8, 190, 26], y: G, height: 9.5, name: 'Observatory Dome', ceiling: 'none',
    regions: [[172, 8, 190, 10], [172, 24, 190, 26], [172, 10, 174, 24], [188, 10, 190, 24]],
    innerPortals: [{ a: 0, b: 2, x: 173, z: 10, axis: 'z', width: 2 }, { a: 0, b: 3, x: 189, z: 10, axis: 'z', width: 2 }, { a: 1, b: 2, x: 173, z: 24, axis: 'z', width: 2 }, { a: 1, b: 3, x: 189, z: 24, axis: 'z', width: 2 }],
    fixtures: [{ x: 173.5, y: G + 3.4, z: 9.5, lit: true, flicker: 0.1 }, { x: 188.5, y: G + 3.4, z: 24.5, lit: true, flicker: 0.2 }],
  });
  I.links.push({ a: 'dome', out: 'w', t: 0.5, type: 'door', id: 'door_res_dome', name: 'Observatory' });
  I.windows.push({ room: 'dome', side: 'e', t: 0.5 });
  I.wallBuys.push({ weapon: 'Staykout', room: 'dome', side: 'n', t: 0.8 });
  const dr = I.add(spiral('domeramp', DX, DZ, 14, G, DT, { zone: RAMP, w: 2.2, perFlight: (DT - G) / 4, look: 'steel', summit: true }));
  I.joins.push({ a: 'dome_2', b: dr.bottom.id, x: 174, z: 22.9, axis: 'x', width: 2.2, dirAB: 1 });
  I.prop('telescope', DX - 2, DZ - 2, DX + 2, DZ + 2, 4.2, { y: DT });
  I.model({ a: 'dome', x: DX, y: G + 9.3, z: DZ, fit: { w: 19.6 }, look: { glow: '#20283a' } });

  // the tesla yard: coils, and catwalks up between them
  const CY = 4.2;
  for (const [id, x0, x1] of [['cat_w', 148, 150.4], ['cat_e', 167.6, 170]]) {
    I.add(deck(id, [x0, 25, x1, 40], CY, { zone: CAT, look: 'grate' }), { connect: 'nswe' });
    const f = I.add(flight(id + '_stairs', [x0, 20, x1, 25], G, CY, 's', { zone: CAT, look: 'steel' }), { footprint: G });
    I.portalSpecs.push({ flight: f, belowAt: [(x0 + x1) / 2, 19.4, G], aboveId: id });
  }
  I.add(deck('cat_s', [148, 40, 170, 42.4], CY, { zone: CAT, look: 'grate' }), { connect: 'nswe' });
  // the tesla coils (lightning arcs between them: src/render/crustTerrain.js 'storm')
  const coils = [[157, 31], [161, 36], [177, 32], [140, 40], [192, 20]];
  for (const [x, z] of coils) I.model({ a: 'tesla', x, y: G, z, yaw: x * 0.3, fit: { h: 8.5 }, look: { glow: '#3a3248' } }, { collide: [x, z, 1.6, 1.6, 8] });
  I.decor.push({ kind: 'storm', coils: coils.map(([x, z]) => [x, G + 8.3, z]), mast: [184, 34, -28] });
  // supply containers stacked round the yards
  for (const [x, z, yaw, rows] of [[176, -42, 0, [0, 1, 2]], [126, 30, 1.57, [3]], [194, -2, 1.57, [4]], [136, -38, 0.1, [5]]]) {
    I.model({ a: 'containers', pick: rows.map((r) => ['Object_0', 'Object_12', 'Object_18', 'Object_21', 'Object_24', 'Object_38'][r]), x, y: G, z, yaw }, { collide: [x, z, 3.4, 3.4, 2.9] });
  }
  for (const [x, z] of [[124, 18], [168, -46], [146, 44], [198, 10]]) I.model({ a: 'barrel', x, y: G, z, yaw: x, fit: { h: 1.1 } }, { collide: [x, z, 0.5, 0.5, 1.1] });
  I.prop('shrine', 175, 39, 178, 42, 3.6, { element: 'lightning' });

  // round about
  I.prop('heliwreck', 114, -34, 121, -26, 2.6);
  I.prop('fueltank', 182, 34, 188, 40, 4); I.prop('fueltank', 190, 27, 195, 32, 3.4);
  I.prop('generator', 150, -27, 155, -24, 2.6); I.prop('generator', 158, -27, 163, -24, 2.6);
  I.prop('dish', 192, -14, 197, -9, 5);
  I.prop('snowcat', 132, 30, 138, 33, 2.4);
  I.prop('crate', 125, 22, 126.2, 23.2, 1.1); I.prop('crate', 125, 23.4, 126.2, 24.6, 0.8);
  I.prop('barrel', 120.65, 12.65, 121.35, 13.35, 0.95, { fire: true });
  I.lamp(HELI, 118, -8); I.lamp(HELI, 118, 8, { flicker: 0.3 }); I.lamp(RADIO, 175, -18); I.lamp(TES, 140, 30, { flicker: 0.5 }); I.lamp(EAST, 194, 2, { flicker: 0.2 });
  // the Warden: the base's guard walker, powered down by the helipad
  I.model({ a: 'robot', x: 107, y: G, z: -20, yaw: Math.PI - 0.5, fit: { h: 7 }, look: { glowK: 0.25 } }, { collide: [107, -20, 2.6, 2.6, 6.5] });
  // cockroaches on the lab floors
  for (const [x0, z0, x1, z1, ph] of [[130, -18, 146, -5, 0], [130, 5, 144, 16, 1.7], [150, -18, 164, -5, 3.1], [130, -1.5, 164, 1.5, 0.6], [148, 5, 164, 16, 2.3], [174, 11, 186, 22, 4]]) {
    I.model({ a: 'roach', anim: true, clip: 'Crawl', x: x0, y: G + 0.02, z: z0, fit: { len: 0.22 }, path: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], speed: 0.9, phase: ph });
  }
  I.pads.push({ id: 'pad_research', x: 112, z: 0, to: 'pad_hub_e', label: 'the Anvil' });
  return I;
}

// =============================================================================
// TRENCH FRONT (south, Fire): a molten battlefield on a scorched meteor. The
// trenches are the way round: a traverse behind the landing zone, winding
// communication trenches, a zig-zag front line facing the void, saps out to
// firing pits. Most of the ground up top is no-man's-land, wired off and
// shelled (the Fire quest will open it); a few patches are safe (the landing
// zone, the fort's yard) or shelled but reachable (the gun pits, the saps).
// The fort in the middle: two floors, a roof to jump off, a radio lookout,
// and a field telephone that calls a ceasefire for a while.
// =============================================================================
function trench() {
  const I = new Isle('trench', 'Trench Front', 'fire', { x0: -60, z0: 102, x1: 60, z1: 196 });
  const t = I.t;
  const LZ = I.zone('lz', 'Landing Zone');
  const YARD = I.zone('fortyard', 'Fort Yard');
  const TR = I.zone('trenches', 'The Trenches');
  const NML = I.zone('nomansland', "No Man's Land");
  const GUNW = I.zone('gunpitW', 'West Gun Pit');
  const GUNE = I.zone('gunpitE', 'East Gun Pit');
  const SAPS = I.zone('saps', 'Forward Saps');
  const ROOF = I.zone('fortroof', 'The Fort Roof');
  const LOOK = I.zone('lookout', 'Radio Lookout');
  const G = 2.3, TF = 0;
  t.paint(shape.poly([[-50, 112], [-20, 108], [20, 108], [50, 112], [54, 140], [52, 170], [42, 184], [0, 191], [-42, 184], [-52, 170], [-54, 140]], 2), { h: G, zone: NML });
  // the patches up top you can stand on
  t.paint(shape.rect(-14, 108, 14, 122), { h: G, zone: LZ, only: (k) => k === K.GROUND });
  t.paint(shape.rect(-13, 134, 13, 156), { h: G, zone: YARD });
  t.paint(shape.rect(-41, 133, -31, 143), { h: G, zone: GUNW });
  t.paint(shape.rect(31, 133, 41, 143), { h: G, zone: GUNE });
  for (const [x0, z0, x1, z1] of [[-35, 178, -29, 183], [-3, 180, 3, 185], [29, 178, 35, 183]]) t.paint(shape.rect(x0, z0, x1, z1), { h: G, zone: SAPS });
  // the trenches: 2 m wide, square-cut (the trench kit's sections line them)
  const segs = [];
  const dig = (pts) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      t.paint(shape.rect(Math.min(ax, bx) - 1, Math.min(az, bz) - 1, Math.max(ax, bx) + 1, Math.max(az, bz) + 1), { h: TF, zone: TR, mat: 'duckboard' });
      segs.push([ax, az, bx, bz]);
    }
  };
  dig([[-36, 129], [36, 129]]);                                                     // the traverse behind the landing zone
  for (const sx of [-1, 1]) {
    dig([[24 * sx, 129], [24 * sx, 140], [30 * sx, 140], [30 * sx, 152], [24 * sx, 152], [24 * sx, 167]]);   // communication trenches
    dig([[24 * sx, 152], [20 * sx, 152]]);                                         // spur to the fort yard
  }
  const front = [[-44, 167], [-36, 167], [-36, 173], [-28, 173], [-28, 167], [-20, 167], [-20, 173], [-12, 173], [-12, 167], [-4, 167], [-4, 173], [4, 173], [4, 167], [12, 167], [12, 173], [20, 173], [20, 167], [28, 167], [28, 173], [36, 173], [36, 167], [44, 167]];
  dig(front);                                                                      // the front line, zig-zag
  for (const x of [-32, 0, 32]) dig([[x, 173], [x, 176]]);                         // saps
  // ramps: down from the landing zone, up into the yard, the gun pits, the saps
  t.ramp([[0, 121.5, G], [0, 128, TF]], 2, { zone: TR, mat: 'duckboard' });
  t.ramp([[0, 130, TF], [0, 135.5, G]], 2, { zone: TR, mat: 'duckboard' });
  for (const sx of [-1, 1]) {
    t.ramp([[19.5 * sx, 152, TF], [12.6 * sx, 152, G]], 2, { zone: TR, mat: 'duckboard' });
    t.ramp([[36 * sx, 129.5, TF], [36 * sx, 135.5, G]], 2, { zone: TR, mat: 'duckboard' });
  }
  for (const [x, z0, z1] of [[-32, 175.5, 181.5], [0, 175.5, 182], [32, 175.5, 181.5]]) t.ramp([[x, z0, TF], [x, z1, G]], 2, { zone: TR, mat: 'duckboard' });
  // lava in the cracks of no-man's-land
  for (const crack of [[[-48, 150], [-40, 156], [-34, 160], [-30, 164]], [[30, 120], [38, 124], [46, 132]], [[-8, 158], [-2, 162], [6, 161], [14, 158]], [[40, 150], [46, 156], [48, 162]], [[-46, 132], [-40, 124], [-30, 118]]]) {
    t.paint(shape.path(crack, 1.6, 0.4), { kind: K.ROCK, mat: 'lava', h: G - 0.5, only: (k, c) => k === K.GROUND && t.zone[c] === NML });
  }
  // no-man's-land is wired off (the Fire quest will open it)
  I.gated = { zone: NML, door: 'gate_nml' };
  I.shelled = [NML, GUNW, GUNE, SAPS];
  // the trench kit along every trench; the pillboxes, the tank, the dead trees
  for (const [ax, az, bx, bz] of segs) {
    const along = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(along / 3.25));
    const yaw = ax === bx ? 0 : Math.PI / 2;
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n;
      I.model({ a: 'trenchset', pick: ['Box019_Straight'], x: ax + (bx - ax) * u, y: TF - 0.05, z: az + (bz - az) * u, yaw, scale: [0.95, 1, along / n / 3.25 * 1.02] });
    }
  }
  for (const [x, z, yaw] of [[-16, 179, 0.1], [16, 180, -0.15], [44, 176, 0.4]]) I.model({ a: 'fieldbunker', x, y: G - 0.4, z, yaw, scale: 1 }, { collide: [x, z, 3.4, 5.6, 2.7] });
  I.model({ a: 'trenchset', pick: ['Object359_Bunker'], x: -44, y: G - 2.3, z: 148, yaw: Math.PI / 2 });
  I.model({ a: 'trenchset', pick: ['Sphere002_Bunker'], x: 44, y: G - 2.0, z: 150, yaw: -Math.PI / 2 });
  I.model({ a: 'tank', x: -36, y: G - 0.5, z: 152, yaw: 0.6, rz: 0.08, scale: 1.1 }, { collide: [-36, 152, 4, 4, 2.6] });
  I.model({ a: 'tent', x: -8, y: G, z: 113, yaw: 0.2, scale: 0.75 }, { collide: [-8, 113, 4.2, 4, 3] });
  const rr = R(41);
  for (let i = 0; i < 46; i++) {
    const x = -50 + rr() * 100, z = 112 + rr() * 74;
    if (t.kindAt(x, z) !== K.GROUND || t.zone[t.cellAt(x, z)] !== NML) continue;
    const kind = ['TreeBareTall', 'deadtreehero', 'deadtreewide'][i % 3];
    I.model({ a: 'trees', pick: [kind], x, y: G - 0.2, z, yaw: rr() * 6.28, fit: { h: 5 + rr() * 4 }, look: { tint: '#3a2c24', glowK: 0.05 } });
  }
  // the fort: two floors, a roof, a lookout
  const F1 = G, F2 = G + 3.5, RY = G + 6.8;
  I.room({
    id: 'fort1', kind: 'bunker', rect: [-8, 140, 8, 152], y: F1, height: 3.2, name: 'The Fort', ceiling: 'none',
    regions: [[-8, 141.6, 8, 152], [1.5, 140, 8, 141.6], [-8, 140, -6, 141.6]],
    innerPortals: [{ a: 0, b: 1, x: 4.75, z: 141.6, axis: 'z', width: 6.5 }, { a: 0, b: 2, x: -7, z: 141.6, axis: 'z', width: 2 }],
    fixtures: [{ x: -3, y: F1 + 2.9, z: 146, lit: true, flicker: 0.3, kind: 'hanging' }, { x: 5, y: F1 + 2.9, z: 149, lit: true, flicker: 0.1, kind: 'hanging' }],
  });
  I.room({
    id: 'fort2', kind: 'bunker', rect: [-8, 140, 8, 152], y: F2, height: RY - 0.3 - F2, name: 'Fort Upper Floor', ceiling: 'none', slab: false, upper: true, noFloor: true,
    regions: [[-8, 141.6, 8, 150.4], [1.5, 140, 8, 141.6], [-8, 150.4, 0, 152], [-8, 140, -6, 141.6]],
    innerPortals: [{ a: 0, b: 1, x: 4.75, z: 141.6, axis: 'z', width: 6.5 }, { a: 0, b: 2, x: -4, z: 150.4, axis: 'z', width: 8 }, { a: 0, b: 3, x: -7, z: 141.6, axis: 'z', width: 2 }],
    fixtures: [{ x: 0, y: F2 + 2.7, z: 146, lit: true, flicker: 0.2, kind: 'hanging' }],
  });
  I.links.push(
    { a: 'fort1', out: 'n', t: 0.8, type: 'door', id: 'door_tr_fort', name: 'The Fort' },
    { a: 'fort1', out: 'w', t: 0.7, type: 'gap', width: 1.8, height: 2.4 },
    { a: 'fort1', out: 'e', t: 0.7, type: 'gap', width: 1.8, height: 2.4 },
  );
  I.wallBuys.push({ weapon: 'MP41', room: 'fort1', side: 'e', t: 0.3 }, { weapon: 'Staykout', room: 'fort2', side: 'w', t: 0.5 });
  I.boxSpots.push({ id: 'box_fort', room: 'fort1', x: -7.4, z: 147, yaw: Math.PI / 2 });
  const s1 = I.add(flight('fort_stairs1', [-6, 140, 1.5, 141.6], F1, F2, 'e', { zone: 'fort1', look: 'concrete' }));
  I.joins.push(...flightPortals(s1, 'fort1_2', 'fort2_1'));
  for (const d of deckHole('fort2floor', [-8.5, 139.5, 8.5, 152.5], [-6, 140, 1.5, 141.6], F2, { zone: 'fort2', look: 'concrete' })) I.add(d, { noRegion: true });
  const s2 = I.add(flight('fort_stairs2', [0, 150.4, 7.5, 152], F2, RY, 'e', { zone: 'fort2', look: 'concrete' }));
  for (const d of deckHole('roof', [-9, 139, 9, 153], [0, 150.4, 7.5, 152], RY, { zone: ROOF, look: 'concrete' })) I.add(d, { connect: 'nswe' });
  I.joins.push(...flightPortals(s2, 'fort2_2', 'roof_e'));
  const lk = I.add(spiral('look', 4.5, 143.5, 5, RY, RY + 7, { zone: LOOK, w: 1.4, perFlight: 1.4, look: 'steel' }));
  I.joins.push(...flightPortals(lk.first, 'roof_n', null));
  for (const d of deckHole('lookout', [1, 140, 8, 147], [2, 141, 7, 146], RY + 7, { zone: LOOK, rails: 'nswe', look: 'grate' })) I.add(d);
  I.decor.push({ kind: 'fort', rect: [-9, 139, 9, 153], roofY: RY }, { kind: 'mast', x: 4.5, z: 143.5, size: 5, h: 12, y: RY + 7 });
  // the field telephone: call in a ceasefire
  I.ceasefire = { pos: { x: -7.95, y: F1 + 1.4, z: 144 }, normal: { x: 1, z: 0 }, room: 'fort1' };
  // a gun in the front line, guns in the pits
  I.later.push(() => I.wallBuys.push({ weapon: 'M17', zone: TR, room: TR, ...rockFace(t, -4, 171, 0, 1, TF, 1.6) }));
  I.prop('fieldgun', -39, 136, -34, 140, 1.8); I.prop('fieldgun', 34, 136, 39, 140, 1.8);
  I.prop('crate', -33, 141, -31.8, 142.2, 1.1); I.prop('crate', 31.8, 141, 33, 142.2, 1.1);
  I.prop('barrel', 10.65, 115.65, 11.35, 116.35, 0.95, { fire: true });
  I.prop('barrel', -11.35, 154.65, -10.65, 155.35, 0.95, { fire: true });
  I.prop('crate', 10, 118, 11.2, 119.2, 1.1); I.prop('crate', 11.4, 118, 12.6, 119.2, 0.8);
  I.prop('shrine', 9, 135, 12, 138, 3.6, { element: 'fire' });
  I.craters = [[-18, 143, 3], [-30, 120, 2.4], [-8, 162, 2], [36, 158, 2.6], [18, 118, 2.2], [-40, 165, 1.8], [44, 140, 2.4]].map(([x, z, r]) => ({ x, z, r, y: G }));
  I.lamp(LZ, -12, 116); I.lamp(LZ, 12, 120, { flicker: 0.15 }); I.lamp(YARD, -11, 137, { flicker: 0.3 }); I.lamp(YARD, 11, 155, { flicker: 0.2 });
  for (const [x, z, f] of [[-30, 129, 0.3], [10, 129, 0.2], [-24, 160, 0.3], [24, 145, 0.2], [-32, 173, 0.4], [0, 173, 0.2], [32, 173, 0.3], [-12, 167, 0.25], [16, 167, 0.3]]) I.lamp(TR, x, z, { h: 2.1, flicker: f });
  // the molten crater out in no-man's-land (something sleeps in it), a lava pool,
  // planks and log revetments round the trenches, rats running along them
  I.model({ a: 'lavafield', x: 40, y: G - 0.35, z: 118, yaw: 0.6, fit: { w: 10 } });
  I.model({ a: 'lavamonster', x: 40.5, y: G - 3.2, z: 118.5, yaw: Math.PI + 0.3, fit: { h: 7.5 }, look: { glowK: 0.4 } });
  I.model({ a: 'lavafield', x: -43, y: G - 0.35, z: 161, yaw: 2.2, fit: { w: 7 } });
  for (const [x, z, yaw] of [[-11, 119, 0.3], [9, 152, 1.9], [-10, 136, 2.6]]) I.model({ a: 'planks', x, y: G + 0.02, z, yaw, fit: { len: 3.6 }, look: { tint: '#5a4436' } });
  for (const [x, z, yaw] of [[-36, 137, 0.2], [36, 137, Math.PI - 0.2], [-1, 186, 0], [-32, 184, 0.3], [32, 184, -0.3]]) I.model({ a: 'woodscan', x, y: G - 0.15, z, yaw, fit: { w: 4.2 }, look: { tint: '#6a5040' } });
  for (const [path, ph] of [[[[-35, 129], [35, 129]], 0], [[[24, 140], [30, 140], [30, 152], [24, 152], [24, 166]], 2], [[[-44, 167], [-36, 167], [-36, 173], [-28, 173], [-28, 167], [-20, 167]], 5], [[[4, 167], [12, 167], [12, 173], [20, 173], [20, 167], [28, 167]], 1], [[[-24, 140], [-30, 140], [-30, 152], [-24, 152]], 7]]) {
    I.model({ a: 'rat', anim: true, x: path[0][0], y: TF + 0.02, z: path[0][1], fit: { len: 0.4 }, path, speed: 2.2, phase: ph, pingpong: true });
  }
  I.pads.push({ id: 'pad_trench', x: 0, z: 115, to: 'pad_hub_s', label: 'the Anvil' });
  return I;
}

// distance from a point to the edge of a polygon
function polyEdge(pts, x, z) {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    d = Math.min(d, Math.hypot(x - ax - dx * u, z - az - dz * u));
  }
  return d;
}

// =============================================================================
// ICE CAVES (west, Wind). Land on the beach at the cave mouth. In through the
// ice gallery to the great cavern: ice shelves up its north and south walls,
// toppled ice pillars leaning up onto them (and drops back down). West, the
// frozen lake under a hole in the roof where a frozen waterfall comes down:
// steps cut in the ice climb it, out onto a ledge to the Wind Summit. From
// the summit an ice slide runs down a gully to the beach. South, the old mine.
// =============================================================================
function caves() {
  const I = new Isle('caves', 'Ice Caves', 'ice', { x0: -212, z0: -58, x1: -100, z1: 58 });
  const t = I.t;
  const MOUTH = I.zone('mouth', 'Cave Mouth');
  const GAL = I.zone('gallery', 'Ice Gallery', { reverb: 1.0 });
  const CAV = I.zone('cavern', 'Great Cavern', { reverb: 1.0 });
  const SHN = I.zone('shelfN', 'North Shelf', { reverb: 1.0 });
  const SHS = I.zone('shelfS', 'South Shelf', { reverb: 1.0 });
  const LAKE = I.zone('lake', 'Frozen Lake', { reverb: 1.0 });
  const FALLS = I.zone('falls', 'Frozen Falls');
  const SUM = I.zone('summit', 'Wind Summit');
  const MINE = I.zone('mine', 'Collapsed Mine', { reverb: 0.9 });
  const WORKS = I.zone('mineworks', 'Mine Works');
  const F = 1.0, SH = 5.5, SUMH = 10;
  const outline = [[-108, -30], [-120, -47], [-160, -52], [-197, -45], [-205, 0], [-197, 45], [-160, 52], [-120, 47], [-108, 30], [-105, 0]];
  t.paint(shape.poly(outline, 3), { kind: K.ROCK, mat: 'rock', h: (x, z) => Math.max(1.2, Math.min(19, 1.5 + polyEdge(outline, x, z) * 1.4) + wobble(x, z, 2, 0.25)) });
  // the beach at the mouth
  t.paint(shape.ellipse(-114, 0, 9, 18, 2), { h: 0.8, zone: MOUTH });
  // in: the ice gallery, the great cavern
  t.paint(shape.path([[-119, 0], [-128, 3], [-137, -1]], 7, 1.2), { h: F, zone: GAL, mat: 'ice', ceil: 6.5 });
  t.paint(shape.ellipse(-152, 0, 16, 13, 3), { h: F, zone: CAV, mat: 'ice', ceil: 13 });
  // the ice shelves, and the toppled pillars up onto them
  t.paint(shape.ellipse(-153, -11, 13, 4.5, 1.2), { h: SH, zone: SHN, mat: 'ice', ceil: 13 });
  t.paint(shape.ellipse(-152, 11, 11, 4, 1.2), { h: SH, zone: SHS, mat: 'ice', ceil: 13 });
  // west to the frozen lake
  t.paint(shape.path([[-166, 1], [-174, 3]], 5, 0.8), { h: F, zone: LAKE, mat: 'ice', ceil: 6 });
  t.paint(shape.ellipse(-182, 4, 11, 10, 2.5), { h: F, zone: LAKE, mat: 'ice', ceil: 11 });
  // toppled ice pillars leaning up onto the shelves
  t.ramp([[-161.5, 4, F], [-157, -7.6, SH]], 2.6, { zone: CAV, mat: 'ice', ceil: 13 });
  t.ramp([[-139, -3, F], [-145, 8.2, SH]], 2.6, { zone: CAV, mat: 'ice', ceil: 13 });
  I.decor.push({ kind: 'pillar', a: [-161.8, F, 4.8], b: [-156.6, SH, -8.4], r: 1.5 }, { kind: 'pillar', a: [-138.6, F, -3.8], b: [-145.4, SH, 8.9], r: 1.5 });
  // the frozen falls: steps cut in the ice up through the hole in the roof
  t.ramp([[-180, -4, F], [-191, -7, 4.6], [-193, -13, 6.5], [-183, -17, 9.5], [-178, -24, SUMH]], 2.8, { zone: FALLS, mat: 'icesteps', smooth: false, quant: 0.35, ceil: 0 });
  t.paint(shape.circle(-188, -9, 6.5, 1.5), { kind: null, ceil: 0, only: (k) => k === K.GROUND });
  I.decor.push({ kind: 'icefall', x: -193, z: -10, y: F, h: SUMH + 4, w: 5 });
  t.paint(shape.ellipse(-172, -32, 15, 10, 2.5), { h: SUMH, zone: SUM });
  // an ice slide from the summit down a gully to the beach
  const slide = [[-158.5, SUMH, -33.5], [-150, 8.2, -36], [-138, 5.8, -32], [-126, 3.2, -24], [-118, 1.0, -13], [-116.5, 0.85, -10.5]];
  I.rides.push({ id: 'slide_summit', kind: 'slide', mouth: 1.6, pts: slide });
  t.paint(shape.path(slide.slice(0, 5).map((p) => [p[0], p[2]]), 3.2), { kind: K.ROCK, mat: 'ice', smooth: true, ceil: 0, h: (x, z) => {
    let best = Infinity, hh = 1;
    for (let i = 0; i < slide.length - 1; i++) {
      const [ax, ay, az] = slide[i], [bx, by, bz] = slide[i + 1];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = Math.hypot(x - ax - dx * u, z - az - dz * u);
      if (d < best) { best = d; hh = ay + (by - ay) * u; }
    }
    return hh - 0.15 + best * 0.25;
  }, only: (k) => k === K.ROCK });
  // south: the mine
  t.paint(shape.path([[-140, 6], [-134, 14], [-136, 24], [-142, 30]], 4, 0.8), { h: F, zone: MINE, mat: 'planks', ceil: 4.5 });
  t.paint(shape.ellipse(-146, 33, 8, 6, 2), { h: F, zone: MINE, mat: 'planks', ceil: 5 });
  t.paint(shape.path([[-150, 36], [-160, 43]], 4, 0.8), { h: F, zone: WORKS, ceil: 0 });
  t.paint(shape.ellipse(-168, 42, 9, 6, 2), { h: 0.8, zone: WORKS });

  // guns on the rock, the box
  I.later.push(() => {
    I.wallBuys.push({ weapon: 'MP41', zone: GAL, room: GAL, ...rockFace(t, -127, 3, 0, -1, F) });
    I.wallBuys.push({ weapon: 'Olympus', zone: CAV, room: CAV, ...rockFace(t, -156, 1, 0, 1, F) });
    I.wallBuys.push({ weapon: 'PM64', zone: LAKE, room: LAKE, ...rockFace(t, -182, 6, 0, 1, F) });
    I.wallBuys.push({ weapon: 'Staykout', zone: MINE, room: MINE, ...rockFace(t, -146, 33, 1, 0, F) });
    I.wallBuys.push({ weapon: 'M17', zone: SUM, room: SUM, ...rockFace(t, -172, -32, -1, 0, SUMH) });
  });
  I.boxSpots.push({ id: 'box_cavern', room: CAV, x: -146, z: -5, yaw: 0, y: F });
  I.boxSpots.push({ id: 'box_mineworks', room: WORKS, x: -168, z: 46.5, yaw: Math.PI, y: 0.8 });
  // crystals, the standing stones on the summit, the mine's carts
  for (const [x, z, h] of [[-160, -12, 3.2], [-146, -12, 4.2], [-158, 11, 2.6], [-145, 12, 3.6], [-152, -2, 5.2], [-186, 10, 2.4], [-130, 2, 2.2], [-176, -2, 3]]) I.prop('crystal', x - 1, z - 1, x + 1, z + 1, h);
  I.prop('shrine', -172, -35, -169, -32, 3.6, { element: 'ice' });
  // the ice: a glacier over the summit, a golem guarding the shrine, ice walls at
  // the mouth, formations in the cavern, icicles off every ceiling, snowy trees
  I.model({ a: 'glacier', x: -176, y: SUMH - 1.5, z: -46, yaw: 0.4, scale: 1.1 });
  I.model({ a: 'golem', x: -164.5, y: SUMH, z: -36.5, yaw: -2.4, fit: { h: 5.2 } }, { collide: [-164.5, -36.5, 1.6, 1.6, 5] });
  I.model({ a: 'icewall', pick: ['Object_0', 'Object_4', 'Object_7'], x: -112, y: 0.4, z: -21, yaw: 1.4, scale: 0.9 });
  I.model({ a: 'icewall', pick: ['Object_2', 'Object_5', 'Object_9'], x: -113, y: 0.4, z: 21, yaw: -1.5, scale: 0.9 });
  for (const [x, z, yaw] of [[-150, 3, 0.3], [-155, 4.5, 2.1], [-178, 8, 1.1]]) I.model({ a: 'iceformations', pick: ['Object_3'], x, y: F - 0.3, z, yaw, scale: 0.7 }, { collide: [x, z, 1.3, 1.3, 1.2] });
  I.later.push(() => {
    const r = R(23);
    for (let iz = 0; iz < t.nz; iz += 2) for (let ix = 0; ix < t.nx; ix += 2) {
      const c = t.i(ix, iz);
      if (t.kind[c] !== K.GROUND || !(t.ceil[c] > 0) || r() > 0.32) continue;
      I.model({ a: 'icicle', x: t.cx(ix) + r() - 0.5, y: t.ceil[c] - 1.6 - r() * 0.3, z: t.cz(iz) + r() - 0.5, yaw: r() * 6.28, scale: 0.7 + r() * 0.6 });
    }
  });
  const rt = R(5);
  for (const [x, z] of [[-110, -14], [-117, 12], [-108, 8], [-180, -24], [-160, -26], [-186, -36], [-168, 46], [-176, 38]]) {
    I.model({ a: 'trees', pick: [rt() > 0.4 ? 'snowtree' : 'snowbush'], x, y: t.heightAt(x, z) - 0.1, z, yaw: rt() * 6, fit: { h: 4 + rt() * 4 } });
  }
  for (const [x, z] of [[-178, -38], [-163, -38], [-178, -27], [-163, -27]]) I.prop('standing', x - 0.7, z - 0.7, x + 0.7, z + 0.7, 4.2);
  I.prop('minecart', -148.6, 30, -146.4, 32.6, 1.4);
  I.prop('shed', -174, 38, -168, 43, 3.2);
  I.prop('crate', -160, 44, -158.8, 45.2, 1.1);
  I.prop('rock', -120, 12, -117, 15, 1.8);
  I.lamp(MOUTH, -112, -12); I.lamp(MINE, -146, 30, { kind: 'hanging', h: 3.6, flicker: 0.5 }); I.lamp(WORKS, -164, 40, { flicker: 0.3 });
  I.pads.push({ id: 'pad_caves', x: -112, z: 0, to: 'pad_hub_w', label: 'the Anvil' });
  I.mud = [{ x: -184, z: 8, r: 5, y: F }, { x: -178, z: 0, r: 4, y: F }];
  return I;
}

// =============================================================================
// Putting it together
// =============================================================================
const ISLES = [hub(), ship(), research(), trench(), caves()];

// the buildings, all at once (their walls, doors, windows, nav)
const ROOMS = buildIslands({
  areas: ISLES.flatMap((I) => I.areas),
  links: ISLES.flatMap((I) => I.links),
  windows: ISLES.flatMap((I) => I.windows),
  wallBuys: ISLES.flatMap((I) => I.wallBuys),
  props: [],
});
for (const r of ROOMS.navRegions) { const rm = ROOMS.rooms.find((q) => q.id === r.room); r.y0 = r.y1 = rm.y || 0; }

const out = {
  rooms: [...ROOMS.rooms], navRegions: [...ROOMS.navRegions], portals: ROOMS.portals.filter((p) => p.b != null),
  doors: [...ROOMS.doors], wallBuys: [...ROOMS.wallBuys], groundSpawns: [], props: [], launchers: [], boxSpots: [],
  terrainBoxes: [], terrains: [], structures: [], rides: [], decor: [], mud: [], craters: [], islands: [], models: [], shelled: [], ceasefire: null,
};
const roomIsle = new Map(ISLES.flatMap((I) => I.areas.map((a) => [a.id, I])));

for (const I of ISLES) {
  const t = I.t;
  const pre = I.id + '_';
  // what stands on the ground: buildings, things on legs
  for (const a of I.areas) if (!a.upper) t.building(a.rect, a.y || 0);
  for (const { s, footprint } of I.structs) {
    if (footprint == null) continue;
    const r = s.rect || [s.cx - s.size / 2, s.cz - s.size / 2, s.cx + s.size / 2, s.cz + s.size / 2];
    t.paint(shape.rect(r[0] + 0.01, r[1] + 0.01, r[2] - 0.01, r[3] - 0.01), { h: footprint, kind: K.ROOM, spawn: false });
  }
  for (const d of I.freeDoors) t.block(d.x, d.z, d.axis, d.width);
  if (I.openFall) t.paint(I.openFall, { kind: null, only: (k, c) => { if (k === K.ROCK) t.noFence[c] = 1; return false; } });
  // big solid things on the ground: the nav goes round them
  for (const p of I.props) {
    if (p.y != null || Math.min(p.x1 - p.x0, p.z1 - p.z0) < 2.5) continue;
    t.paint(shape.rect(p.x0 - 0.3, p.z0 - 0.3, p.x1 + 0.3, p.z1 + 0.3), { kind: K.ROOM, spawn: false, only: (k) => k === K.GROUND });
  }
  for (const f of I.later) f();
  t.fillPits();
  // where a deck runs out over ground at its own height (a catwalk's ends on
  // the terraces), the deck owns that bit (no two places in one spot)
  for (const { s, connect } of I.structs) {
    if (!connect || !s.region) continue;
    const [x0, z0, x1, z1] = s.region.rect;
    t.paint(shape.rect(x0 + 0.01, z0 + 0.01, x1 - 0.01, z1 - 0.01), { kind: K.ROOM, spawn: false, only: (k, c) => k === K.GROUND && Math.abs(t.h[c] - s.region.y0) <= STEP + 0.05 });
  }
  // the ground's nav
  // wired-off ground (no-man's-land): an invisible fence wherever it meets
  // ground you can stand on at its own height, gone when its gate opens
  const gateBoxes = [];
  if (I.gated) {
    const { zone, door } = I.gated;
    const wire = [];
    for (let iz = 1; iz < t.nz - 1; iz++) for (let ix = 1; ix < t.nx - 1; ix++) {
      const c = t.i(ix, iz);
      if (t.kind[c] !== K.GROUND || t.zone[c] !== zone) continue;
      let edge = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = t.i(ix + dx, iz + dz);
        if (t.physWalk(n) && t.zone[n] !== zone && Math.abs(t.h[n] - t.h[c]) <= 1.2) edge = true;
      }
      if (!edge) continue;
      const x0 = t.x0 + ix * t.cell, z0 = t.z0 + iz * t.cell;
      gateBoxes.push({ minX: x0, maxX: x0 + t.cell, minZ: z0, maxZ: z0 + t.cell, minY: -1, maxY: t.h[c] + 3.5, kind: 'shore', ghost: true, gate: door, terrain: t.id });
      wire.push([x0 + t.cell / 2, t.h[c], z0 + t.cell / 2]);
    }
    I.decor.push({ kind: 'wire', pts: wire });
  }
  const tn = t.regions(pre);
  const regions = [...tn.regions], portals = [...tn.portals];
  // the raised things' nav
  const sregs = [];
  for (const { s, noRegion } of I.structs) {
    if (noRegion) continue;
    if (s.region) sregs.push(s.region);
    if (s.regions) sregs.push(...s.regions);
    if (s.portals) portals.push(...s.portals);
  }
  regions.push(...sregs);
  for (const { s, connect, connectBottom } of I.structs) {
    if (connect && s.region) portals.push(...t.connect(s.region, connect));
    if (connectBottom) portals.push(...t.connect(s.bottom, connectBottom));
  }
  // flat raised things that touch (deck to deck, landing to deck) join up
  const flat = sregs.filter((r) => r.y0 === r.y1);
  for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) {
    const A = flat[i], B = flat[j];
    if (Math.abs(A.y0 - B.y0) > 0.1) continue;
    const [ax0, az0, ax1, az1] = A.rect, [bx0, bz0, bx1, bz1] = B.rect;
    const ov = (a0, a1, b0, b1) => [Math.max(a0, b0), Math.min(a1, b1)];
    const near = (a, b) => Math.abs(a - b) < 0.02;
    let p = null;
    if (near(ax1, bx0) || near(ax0, bx1)) { const [s0, s1] = ov(az0, az1, bz0, bz1); if (s1 - s0 > 0.5) p = { x: near(ax1, bx0) ? ax1 : ax0, z: (s0 + s1) / 2, axis: 'x', width: s1 - s0, dirAB: near(ax1, bx0) ? 1 : -1 }; }
    else if (near(az1, bz0) || near(az0, bz1)) { const [s0, s1] = ov(ax0, ax1, bx0, bx1); if (s1 - s0 > 0.5) p = { x: (s0 + s1) / 2, z: near(az1, bz0) ? az1 : az0, axis: 'z', width: s1 - s0, dirAB: near(az1, bz0) ? 1 : -1 }; }
    if (p) portals.push({ a: A.id, b: B.id, ...p });
  }
  // what's at a point (for joining things up by where they are)
  const roomRegs = ROOMS.navRegions.filter((r) => roomIsle.get(r.room) === I);
  const at = (x, z, y) => {
    let best = null, bs = Infinity;
    const tr = t.regionAt(x, z);
    if (tr) { const s = Math.abs(y - t.heightAt(x, z)); if (s < bs) { bs = s; best = tr.id; } }
    for (const r of [...sregs, ...roomRegs]) {
      const [x0, z0, x1, z1] = r.rect;
      if (x < x0 - 0.01 || x > x1 + 0.01 || z < z0 - 0.01 || z > z1 + 0.01) continue;
      const s = y < r.y0 ? r.y0 - y : y > r.y1 ? y - r.y1 : 0;
      if (s < bs) { bs = s; best = r.id; }
    }
    if (bs > 1.2) throw new Error(`Call of the Crust: nothing to stand on at ${x}, ${z} (y ${y}) on ${I.id}`);
    return best;
  };
  for (const j of I.joins) portals.push(j);
  for (const ps of I.portalSpecs) {
    const below = ps.belowAt ? at(...ps.belowAt) : null;
    const above = ps.aboveId || (ps.aboveAt ? at(...ps.aboveAt) : null);
    portals.push(...flightPortals(ps.flight, below, above));
  }
  // the buildings' outside doors and gaps, onto whatever's out there
  for (const p of ROOMS.portals) {
    if (p.b != null || roomIsle.get(ROOMS.navRegions.find((r) => r.id === p.a).room) !== I) continue;
    const rm = ROOMS.rooms.find((q) => q.id === ROOMS.navRegions.find((r) => r.id === p.a).room);
    out.portals.push({ ...p, b: p.to || at(p.outside.x, p.outside.z, rm.y || 0) });
  }
  // debris piles on their own across a path
  for (const d of I.freeDoors) {
    const y = t.heightAt(d.x, d.z);
    const off = d.axis === 'z' ? [1.1, 0] : [0, 1.1];
    const a = at(d.x - off[0], d.z - off[1], t.heightAt(d.x - off[0], d.z - off[1]));
    const b = at(d.x + off[0], d.z + off[1], t.heightAt(d.x + off[0], d.z + off[1]));
    out.doors.push({ ...d, free: true, y, room: d.zones[0] });
    portals.push({ a, b, x: d.x, z: d.z, axis: d.axis === 'z' ? 'x' : 'z', width: d.width, door: d.id, dirAB: 1 });
  }
  // (every way into wired-off ground goes through its gate)
  if (I.gated) {
    const zoneOf = new Map(regions.map((r) => [r.id, r.zone]));
    for (const p of portals) if (zoneOf.get(p.a) === I.gated.zone || zoneOf.get(p.b) === I.gated.zone) p.door = I.gated.door;
    const far = regions.find((r) => r.zone === I.gated.zone);
    out.doors.push({ id: I.gated.door, kind: 'gate', free: true, locked: true, x: far.rect[0] + 0.5, z: far.rect[1] + 0.5, y: -50, axis: 'x', width: 0.2, height: 0.2, zones: [I.gated.zone, I.gated.zone], label: "NO MAN'S LAND" });
  }
  if (I.shelled) out.shelled.push(...I.shelled);
  if (I.ceasefire) out.ceasefire = I.ceasefire;
  out.models.push(...(I.models || []));
  // zombies claw up out of the snow and ice (not under a launcher, not in a prop)
  const avoid = [...I.pads.map((p) => [p.x - 3.5, p.z - 3.5, p.x + 3.5, p.z + 3.5]), ...(I.spawnAvoid || []), ...I.props.map((p) => [p.x0 - 1.2, p.z0 - 1.2, p.x1 + 1.2, p.z1 + 1.2])];
  const spawns = t.spawns('rise_' + pre, 9, avoid);
  // each zone is a room of its own (no walls): what the game calls where you are
  const zoneRooms = [];
  for (const [id, z] of I.zones) {
    const rs = regions.filter((r) => r.zone === id);
    if (!rs.length) continue;
    const rect = [Math.min(...rs.map((r) => r.rect[0])), Math.min(...rs.map((r) => r.rect[1])), Math.max(...rs.map((r) => r.rect[2])), Math.max(...rs.map((r) => r.rect[3]))];
    zoneRooms.push({ id, zone: id, name: z.name, virtual: true, outdoor: true, rect, y: Math.min(...rs.map((r) => r.y0)), height: 6, walls: {}, style: 'cliff', floor: 'snow', reverb: z.reverb, fixtures: z.fixtures, litter: false, cave: z.reverb >= 1 });
  }
  out.rooms.push(...zoneRooms);
  out.navRegions.push(...regions);
  out.portals.push(...portals);
  out.groundSpawns.push(...spawns);
  out.wallBuys.push(...I.wallBuys.filter((w) => w.pos));
  for (const p of I.props) {
    const y = p.y ?? t.heightAt((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2);
    out.props.push({ kind: p.kind, box: box6(p.x0, p.z0, p.x1, p.z1, y, y + p.h), ...(p.fire ? { fire: true } : {}), ...(p.element ? { element: p.element } : {}), ...(p.blank ? { blank: true } : {}) });
  }
  for (const pad of I.pads) {
    const y = t.heightAt(pad.x, pad.z);
    out.launchers.push({ ...pad, y, room: t.regionAt(pad.x, pad.z).zone });
  }
  for (const b of I.boxSpots) {
    const room = ROOMS.rooms.find((q) => q.id === b.room);
    out.boxSpots.push({ ...b, y: b.y ?? (room ? room.y || 0 : t.heightAt(b.x, b.z)) });
  }
  out.terrainBoxes.push(...t.boxes(), ...gateBoxes);
  for (const { s } of I.structs) {
    out.terrainBoxes.push(...s.boxes);
    out.structures.push({ island: I.id, id: s.id, look: s.look, boxes: s.boxes, rails: s.rails, rect: s.rect, y: s.y, kind: s.parts ? 'spiral' : s.dir ? 'flight' : 'deck', dir: s.dir, size: s.size, cx: s.cx, cz: s.cz, y0: s.y0, y1: s.y1 });
  }
  out.terrains.push(t);
  out.rides.push(...I.rides);
  out.decor.push(...I.decor.map((d) => ({ ...d, island: I.id })));
  out.mud.push(...(I.mud || []).map((m) => ({ ...m, y: m.y ?? t.heightAt(m.x, m.z) })));
  out.craters.push(...(I.craters || []));
  out.islands.push({ id: I.id, name: I.name, element: I.element, rooms: [...I.areas.map((a) => a.id), ...zoneRooms.map((r) => r.id)], bounds: [t.x0, t.z0, t.x0 + t.nx * t.cell, t.z0 + t.nz * t.cell] });
}

for (const L of out.launchers) {
  const D = out.launchers.find((q) => q.id === L.to);
  out.models.push({ a: 'launcher', x: L.x, y: L.y - 0.05, z: L.z, yaw: Math.atan2(D.x - L.x, D.z - L.z) + Math.PI / 2, fit: { len: 6.4 } });
}
export const LAUNCHERS = out.launchers;
export const ISLANDS = out.islands;
const HUB = ISLES[0];

export const CRUST = {
  id: 'crust',
  name: 'Call of the Crust',
  wallThickness: T,
  snow: true,          // the snow world: sky, snowfall, the sea (src/render/crustWorld.js)
  openField: true,     // no zones to open: zombies come for you wherever you can be reached
  space: true,         // the islands float in space: step off an edge and you're gone
  islands: ISLANDS,
  pa: false,           // nobody on the speakers yet (The Shntitz comes later)
  fog: { color: '#1c2534', density: 0.006 },
  farPlane: 320,
  lampScale: 0.55,     // (the lamps are bright on all this snow)
  ambient: 0.8,        // the night sky's light on everything
  playerSpawns: HUB.playerSpawns.map((p) => ({ ...p, y: HUB.t.heightAt(p.x, p.z) })),
  rooms: out.rooms,
  navRegions: out.navRegions,
  portals: out.portals,
  doors: out.doors,
  gaps: ROOMS.gaps,
  windows: ROOMS.windows,
  wallBuys: out.wallBuys,
  groundSpawns: out.groundSpawns,
  props: out.props,
  launchers: out.launchers,
  boxSpots: out.boxSpots,
  mud: out.mud,
  craters: out.craters,
  // the sculpted ground and what's built on it (src/map/terrain.js)
  terrains: out.terrains,
  terrainBoxes: out.terrainBoxes,
  structures: out.structures,
  rides: out.rides,
  decor: out.decor,
  models: out.models,            // the downloaded models (src/render/crustModels.js)
  shelled: out.shelled,          // zones the guns hit (src/sim/shelling.js)
  ceasefire: out.ceasefire,      // the field telephone in the fort
  // Far off to the north, past the ship graveyard: the four stacks (the final fight).
  stacks: [
    { x: -33, z: -330, h: 96 },
    { x: -11, z: -325, h: 96 },
    { x: 11, z: -320, h: 94 },
    { x: 33, z: -315, h: 94 },
  ],
};
void STEP;
