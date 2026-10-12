// =============================================================================
// MAP DATA — Call of the Crust (Map 2).
//
// A frozen sea on a snow planet, and five islands in it. In the middle, the
// hub: you crash-land at the foot of THE ANVIL, a colossal ancient stone the
// four War Hammers will one day be brought back to. Round it, four launch
// decks fling you out across the ice to the four islands, one for each
// element, each with its own War Hammer to find, build and upgrade:
//
//                       SHIP GRAVEYARD  (Ice)
//                    lighthouse, frozen ships, a fishing village
//                                 ^
//                                 |
//   ICE CAVES  (Wind)  <-----   THE HUB   ----->  RESEARCH BASE  (Lightning)
//   caverns, a frozen lake,   the Anvil, the     labs and corridors, a radio
//   the wind summit           crash site         tower, the tesla yard
//                                 |
//                                 v
//                         TRENCH FRONT  (Fire)
//                   narrow trenches, bunkers, a crashed biplane, a burning farm
//
// (Later: build an island's War Hammer and an ice bridge forms back to the hub.)
// The rooms are laid out on grids (see islandKit.js), 0.5 m apart, one wall's
// thickness. Axes: +X east, +Y up, -Z north. Metres.
// =============================================================================
import { buildIslands, cell } from './islandKit.js';

const T = 0.5;
const box = (x0, z0, x1, z1, h = 1, y0 = 0) => [x0, y0, z0, x1, h, z1];

// --- THE HUB -----------------------------------------------------------------------------
//        Observatory | North Launch | Supply Depot
//        West Launch |  THE ANVIL   | East Launch
//        Crash Site  | South Launch | Dig Camp
const HX = [-34, -12, 12, 34], HZ = [-34, -12, 12, 34];
const ANVIL = [-11.75, -11.75, 11.75, 11.75];
const HUB = {
  areas: [
    { id: 'observatory', kind: 'stone', rect: cell(HX, HZ, 0, 0), name: 'Old Observatory' },
    { id: 'ndeck', kind: 'shore', rect: cell(HX, HZ, 1, 0), name: 'North Launch', zone: 'ndeck' },
    { id: 'depot', kind: 'tin', rect: cell(HX, HZ, 2, 0), name: 'Supply Depot' },
    { id: 'wdeck', kind: 'shore', rect: cell(HX, HZ, 0, 1), name: 'West Launch' },
    {
      id: 'anvil', kind: 'arena', rect: ANVIL, name: 'The Anvil',
      // round the great stone in the middle
      regions: [[-11.75, -11.75, 11.75, -6], [-11.75, 6, 11.75, 11.75], [-11.75, -6, -6, 6], [6, -6, 11.75, 6]],
      innerPortals: [
        { a: 0, b: 2, x: -8.9, z: -6, axis: 'z', width: 5.4 }, { a: 0, b: 3, x: 8.9, z: -6, axis: 'z', width: 5.4 },
        { a: 1, b: 2, x: -8.9, z: 6, axis: 'z', width: 5.4 }, { a: 1, b: 3, x: 8.9, z: 6, axis: 'z', width: 5.4 },
      ],
      fixtures: [{ x: -9, y: 3.2, z: -9, lit: true, flicker: 0.1, kind: 'lamp' }, { x: 9, y: 3.2, z: 9, lit: true, flicker: 0.1, kind: 'lamp' }],
    },
    { id: 'edeck', kind: 'shore', rect: cell(HX, HZ, 2, 1), name: 'East Launch' },
    { id: 'crash', kind: 'yard', rect: cell(HX, HZ, 0, 2), name: 'Crash Site', fixtures: [{ x: -30, y: 4.4, z: 30, lit: true, flicker: 0.2, kind: 'lamp' }] },
    { id: 'sdeck', kind: 'shore', rect: cell(HX, HZ, 1, 2), name: 'South Launch' },
    { id: 'digcamp', kind: 'yard', rect: cell(HX, HZ, 2, 2), name: 'Dig Camp', fixtures: [{ x: 30, y: 4.4, z: 16, lit: true, flicker: 0.4, kind: 'lamp' }] },
  ],
  links: [
    { a: 'crash', b: 'wdeck', type: 'debris', id: 'debris_hub_west', width: 3, t: 0.5 },
    { a: 'crash', b: 'sdeck', type: 'debris', id: 'debris_hub_south', width: 3, t: 0.5 },
    { a: 'anvil', b: 'wdeck', type: 'gap', width: 6 }, { a: 'anvil', b: 'ndeck', type: 'gap', width: 6 },
    { a: 'anvil', b: 'edeck', type: 'gap', width: 6 }, { a: 'anvil', b: 'sdeck', type: 'gap', width: 6 },
    { a: 'observatory', b: 'wdeck', type: 'door', id: 'door_obs_w' }, { a: 'observatory', b: 'ndeck', type: 'door', id: 'door_obs_n' },
    { a: 'depot', b: 'ndeck', type: 'door', id: 'door_depot_n' }, { a: 'depot', b: 'edeck', type: 'door', id: 'door_depot_e' },
    { a: 'digcamp', b: 'edeck', type: 'debris', id: 'debris_camp_e', width: 3 }, { a: 'digcamp', b: 'sdeck', type: 'debris', id: 'debris_camp_s', width: 3 },
  ],
  windows: [
    { room: 'observatory', side: 'n', t: 0.3 }, { room: 'observatory', side: 'w', t: 0.6 },
    { room: 'depot', side: 'n', t: 0.7 }, { room: 'depot', side: 'e', t: 0.4 },
  ],
  wallBuys: [
    { weapon: 'M15', room: 'crash', side: 'w', t: 0.4 },
    { weapon: 'frag', room: 'crash', side: 's', t: 0.3 },
    { weapon: 'MP41', room: 'observatory', side: 'n', t: 0.75 },
    { weapon: 'PM64', room: 'depot', side: 'n', t: 0.3 },
    { weapon: 'M17', room: 'digcamp', side: 'e', t: 0.6 },
  ],
  props: [
    // the Anvil: the great stone in the middle
    { kind: 'anvil', box: box(-5, -5, 5, 5, 22) },
    // the crash: what's left of the portal's landing, gouged into the snow
    { kind: 'wreck', box: box(-31, 15, -26, 19, 1.6) },
    { kind: 'wreck', box: box(-18, 27, -15, 31, 1.2) },
    { kind: 'barrel', box: box(-23.35, 27.65, -22.65, 28.35, 0.95), fire: true },
    { kind: 'crate', box: box(-32, 26, -30.8, 27.2, 1.1) },
    { kind: 'rock', box: box(-31.5, 30.5, -28.5, 33, 1.6) },
    // the dig camp
    { kind: 'tent', box: box(26, 24, 31, 29, 2.2) },
    { kind: 'tent', box: box(16, 27, 20, 31, 2.0) },
    { kind: 'crate', box: box(31, 15, 32.2, 16.2, 1.1) }, { kind: 'crate', box: box(31, 16.4, 32.2, 17.6, 0.8) },
    { kind: 'barrel', box: box(22.65, 19.65, 23.35, 20.35, 0.95), fire: true },
    // the observatory's telescope, the depot's shelves
    { kind: 'telescope', box: box(-30, -30, -25, -25, 4.5) },
    { kind: 'shelves', box: box(14, -33.5, 24, -32.6, 3.2) },
    { kind: 'shelves', box: box(32.6, -30, 33.5, -20, 3.2) },
    { kind: 'crate', box: box(26, -30, 27.2, -28.8, 1.1) }, { kind: 'crate', box: box(27.4, -30, 28.6, -28.8, 1.1) },
  ],
};

// --- SHIP GRAVEYARD (north, Ice) -------------------------------------------------------------
//   Lighthouse Rock          | Icebreaker Hold | Engine Room
//   Keeper's House | Boatyard | The Harbor (ice)| Harbor Mouth
//   Smokehouse     | Square   |                 |
//   Net Shed       | Frozen Pier (you land here)  | The Trawler
const SX = [-48, -30, -6, 18, 48], SZ = [-200, -178, -152, -128, -110];
const SHIP = {
  areas: [
    { id: 'rock', kind: 'yard', rect: cell(SX, SZ, 0, 0, 1, 0), name: 'Lighthouse Rock', edges: { n: 'invisible', w: 'invisible' } },
    { id: 'hold', kind: 'hull', rect: cell(SX, SZ, 2, 0), name: 'Icebreaker Hold', fixtures: [{ x: 6, y: 3.9, z: -189, lit: true, flicker: 0.3, kind: 'hanging' }] },
    { id: 'engine', kind: 'hull', rect: cell(SX, SZ, 3, 0), name: 'Engine Room', fixtures: [{ x: 33, y: 3.9, z: -189, lit: true, flicker: 0.6, kind: 'hanging' }] },
    { id: 'keeper', kind: 'cabin', rect: cell(SX, SZ, 0, 1), name: "Keeper's House", fixtures: [{ x: -39, y: 2.9, z: -165, lit: true, flicker: 0.2, kind: 'hanging' }] },
    { id: 'boatyard', kind: 'yard', rect: cell(SX, SZ, 1, 1), name: 'Boatyard' },
    { id: 'harbor', kind: 'ice', rect: cell(SX, SZ, 2, 1, 2, 2), name: 'The Harbor' },
    { id: 'harbormouth', kind: 'ice', rect: cell(SX, SZ, 3, 1, 3, 2), name: 'Harbor Mouth' },
    { id: 'smokehouse', kind: 'cabin', rect: cell(SX, SZ, 0, 2), name: 'Smokehouse', fixtures: [{ x: -39, y: 2.9, z: -140, lit: true, flicker: 0.1, kind: 'hanging' }] },
    { id: 'square', kind: 'yard', rect: cell(SX, SZ, 1, 2), name: 'Village Square', fixtures: [{ x: -18, y: 4.4, z: -140, lit: true, flicker: 0.15, kind: 'lamp' }] },
    { id: 'netshed', kind: 'cabin', rect: cell(SX, SZ, 0, 3), name: 'Net Shed', fixtures: [{ x: -39, y: 2.9, z: -119, lit: true, flicker: 0.3, kind: 'hanging' }] },
    { id: 'pier', kind: 'shore', rect: cell(SX, SZ, 1, 3, 2, 3), name: 'Frozen Pier', floor: 'planks', fixtures: [{ x: 10, y: 4.4, z: -125, lit: true, flicker: 0.1, kind: 'lamp' }] },
    { id: 'trawler', kind: 'hull', rect: cell(SX, SZ, 3, 3), name: 'The Trawler', fixtures: [{ x: 33, y: 3.9, z: -119, lit: true, flicker: 0.5, kind: 'hanging' }] },
  ],
  links: [
    { a: 'pier', b: 'square', type: 'debris', id: 'debris_ship_square', width: 3 },
    { a: 'pier', b: 'harbor', type: 'debris', id: 'debris_ship_harbor', width: 3 },
    { a: 'pier', b: 'netshed', type: 'door', id: 'door_ship_netshed' },
    { a: 'pier', b: 'trawler', type: 'door', id: 'door_ship_trawler' },
    { a: 'netshed', b: 'smokehouse', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'smokehouse', b: 'square', type: 'door', id: 'door_ship_smokehouse' },
    { a: 'square', b: 'boatyard', type: 'gap', width: 6 },
    { a: 'square', b: 'harbor', type: 'gap', width: 6 },
    { a: 'boatyard', b: 'keeper', type: 'door', id: 'door_ship_keeper' },
    { a: 'boatyard', b: 'rock', type: 'gap', width: 6 },
    { a: 'boatyard', b: 'harbor', type: 'gap', width: 6 },
    { a: 'keeper', b: 'rock', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'rock', b: 'hold', type: 'door', id: 'door_ship_hold' },
    { a: 'hold', b: 'engine', type: 'gap', width: 2.2 },
    { a: 'harbormouth', b: 'engine', type: 'door', id: 'door_ship_engine' },
    { a: 'harbor', b: 'harbormouth', type: 'open' },
    { a: 'harbormouth', b: 'trawler', type: 'gap', width: 2.4 },
  ],
  windows: [
    { room: 'keeper', side: 'w', t: 0.5 }, { room: 'smokehouse', side: 'w', t: 0.5 },
    { room: 'netshed', side: 'w', t: 0.5 }, { room: 'netshed', side: 's', t: 0.5 },
    { room: 'hold', side: 'n', t: 0.35 }, { room: 'engine', side: 'e', t: 0.5 },
    { room: 'trawler', side: 'e', t: 0.5 }, { room: 'trawler', side: 's', t: 0.35 },
  ],
  wallBuys: [
    { weapon: 'MP41', room: 'netshed', side: 'w', t: 0.15 },
    { weapon: 'PM64', room: 'smokehouse', side: 'w', t: 0.2 },
    { weapon: 'Staykout', room: 'keeper', side: 'w', t: 0.2 },
    { weapon: 'Olympus', room: 'hold', side: 'n', t: 0.75 },
    { weapon: 'MPK', room: 'trawler', side: 'e', t: 0.2 },
    { weapon: 'AK-75u', room: 'engine', side: 'n', t: 0.5 },
  ],
  props: [
    { kind: 'lighthouse', box: box(-47, -199, -39, -191, 24) },
    { kind: 'shrine', element: 'ice', box: box(-25, -190, -22, -187, 3.6) },
    { kind: 'rock', box: box(-36, -184, -33, -181, 1.8) },
    { kind: 'iceberg', box: box(0, -160, 4, -156, 2.4) },
    { kind: 'iceberg', box: box(10, -140, 13, -137, 1.8) },
    { kind: 'iceberg', box: box(36, -168, 40, -164, 2.6) },
    { kind: 'iceberg', box: box(28, -142, 31, -139, 1.6) },
    { kind: 'boat', box: box(-27, -170, -25, -164, 1.0) },
    { kind: 'boat', box: box(-12, -175, -10, -169, 1.0) },
    { kind: 'rack', box: box(-26, -150, -20, -149.4, 1.9) },
    { kind: 'rack', box: box(-26, -134, -20, -133.4, 1.9) },
    { kind: 'barrel', box: box(-17.35, -143.35, -16.65, -142.65, 0.95), fire: true },
    { kind: 'crate', box: box(-26, -116, -24.8, -114.8, 1.1) }, { kind: 'crate', box: box(-24.6, -116, -23.4, -114.8, 0.8) },
    { kind: 'crate', box: box(12, -125, 13.2, -123.8, 1.1) },
    { kind: 'crate', box: box(2, -199, 3.2, -197.8, 1.1) }, { kind: 'crate', box: box(3.4, -199, 4.6, -197.8, 1.1) },
    { kind: 'boiler', box: box(40, -198, 46, -192, 3.4) },
  ],
  ships: [
    { rooms: ['hold', 'engine'], bow: 'e', name: 'icebreaker' },
    { rooms: ['trawler'], bow: 'e', name: 'trawler' },
  ],
};

// --- RESEARCH BASE (east, Lightning) -----------------------------------------------------------
//            | Cold Storage | W | Generator Hall | E | Radio Yard
//   Helipad  | Decon Lab    | . | Main Lab       | . | Observatory Dome
//            | ============ Main Corridor ======================= |
//            | Mess Hall    | W | Server Room    | E | Tesla Yard
//            | Dormitory    | . | Garage         | . | Fuel Depot
const RX = [110, 124, 140, 143, 166, 169, 196], RZ = [-46, -21, 2, 5, 26, 46];
const RESEARCH = {
  areas: [
    { id: 'helipad', kind: 'shore', rect: cell(RX, RZ, 0, 0, 0, 4), name: 'Helipad', floor: 'concrete', fixtures: [{ x: 120, y: 4.4, z: -12, lit: true, flicker: 0.1, kind: 'lamp' }, { x: 120, y: 4.4, z: 18, lit: true, flicker: 0.3, kind: 'lamp' }] },
    { id: 'cold', kind: 'lab', rect: cell(RX, RZ, 1, 0), name: 'Cold Storage', style: 'kitchen', fixtures: [{ x: 132, y: 3.1, z: -33, lit: true, flicker: 0.5 }] },
    { id: 'decon', kind: 'lab', rect: cell(RX, RZ, 1, 1), name: 'Decon Lab', fixtures: [{ x: 132, y: 3.1, z: -10, lit: true, flicker: 0.2 }] },
    { id: 'spine', kind: 'hall', rect: cell(RX, RZ, 1, 2, 5, 2), name: 'Main Corridor', fixtures: [{ x: 132, y: 3.1, z: 3.5, lit: true, flicker: 0.3 }, { x: 155, y: 3.1, z: 3.5, lit: true, flicker: 0.1 }, { x: 182, y: 3.1, z: 3.5, lit: true, flicker: 0.7 }] },
    { id: 'mess', kind: 'lab', rect: cell(RX, RZ, 1, 3), name: 'Mess Hall', style: 'cafe', fixtures: [{ x: 132, y: 3.1, z: 15, lit: true, flicker: 0.1 }] },
    { id: 'dorm', kind: 'lab', rect: cell(RX, RZ, 1, 4), name: 'Dormitory', style: 'office', fixtures: [{ x: 132, y: 3.1, z: 36, lit: true, flicker: 0.4 }] },
    { id: 'corw', kind: 'hall', rect: cell(RX, RZ, 2, 0, 2, 1), name: 'West Corridor', fixtures: [{ x: 141.5, y: 3.1, z: -22, lit: true, flicker: 0.2 }] },
    { id: 'corw2', kind: 'hall', rect: cell(RX, RZ, 2, 3, 2, 4), name: 'West Corridor', fixtures: [{ x: 141.5, y: 3.1, z: 25, lit: true, flicker: 0.6 }] },
    { id: 'core', kind: 'hall', rect: cell(RX, RZ, 4, 0, 4, 1), name: 'East Corridor', fixtures: [{ x: 167.5, y: 3.1, z: -22, lit: true, flicker: 0.1 }] },
    { id: 'core2', kind: 'hall', rect: cell(RX, RZ, 4, 3, 4, 4), name: 'East Corridor', fixtures: [{ x: 167.5, y: 3.1, z: 25, lit: true, flicker: 0.3 }] },
    { id: 'genhall', kind: 'tin', rect: cell(RX, RZ, 3, 0), name: 'Generator Hall', fixtures: [{ x: 154, y: 4.6, z: -33, lit: true, flicker: 0.2, kind: 'hanging' }] },
    { id: 'mainlab', kind: 'lab', rect: cell(RX, RZ, 3, 1), name: 'Main Lab', fixtures: [{ x: 154, y: 3.1, z: -10, lit: true, flicker: 0.1 }] },
    { id: 'server', kind: 'lab', rect: cell(RX, RZ, 3, 3), name: 'Server Room', style: 'boiler', fixtures: [{ x: 154, y: 3.1, z: 15, lit: true, flicker: 0.6 }] },
    { id: 'garage', kind: 'tin', rect: cell(RX, RZ, 3, 4), name: 'Garage', fixtures: [{ x: 154, y: 4.6, z: 36, lit: true, flicker: 0.2, kind: 'hanging' }] },
    { id: 'radioyard', kind: 'yard', rect: cell(RX, RZ, 5, 0), name: 'Radio Yard', edges: { n: 'invisible', e: 'invisible' }, fixtures: [{ x: 172, y: 4.4, z: -24, lit: true, flicker: 0.2, kind: 'lamp' }] },
    { id: 'dome', kind: 'lab', rect: cell(RX, RZ, 5, 1), name: 'Observatory Dome', height: 5, fixtures: [{ x: 182, y: 4.7, z: -10, lit: true, flicker: 0.1 }] },
    { id: 'tesla', kind: 'yard', rect: cell(RX, RZ, 5, 3), name: 'Tesla Yard', edges: { e: 'invisible' }, fixtures: [{ x: 172, y: 4.4, z: 8, lit: true, flicker: 0.8, kind: 'lamp' }] },
    { id: 'fuel', kind: 'yard', rect: cell(RX, RZ, 5, 4), name: 'Fuel Depot', edges: { e: 'invisible', s: 'invisible' } },
  ],
  links: [
    { a: 'helipad', b: 'spine', type: 'door', id: 'door_res_airlock' },
    { a: 'helipad', b: 'decon', type: 'door', id: 'door_res_decon' },
    { a: 'cold', b: 'corw', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'decon', b: 'corw', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'decon', b: 'spine', type: 'gap', width: 1.6, height: 2.4, t: 0.7 },
    { a: 'mess', b: 'spine', type: 'gap', width: 1.6, height: 2.4, t: 0.6 },
    { a: 'mess', b: 'corw2', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'dorm', b: 'corw2', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'corw', b: 'spine', type: 'open' }, { a: 'corw2', b: 'spine', type: 'open' },
    { a: 'core', b: 'spine', type: 'open' }, { a: 'core2', b: 'spine', type: 'open' },
    { a: 'genhall', b: 'corw', type: 'door', id: 'door_res_gen' },
    { a: 'genhall', b: 'core', type: 'gap', width: 1.8, height: 2.6 },
    { a: 'mainlab', b: 'spine', type: 'door', id: 'door_res_lab' },
    { a: 'mainlab', b: 'corw', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'server', b: 'spine', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'server', b: 'core2', type: 'door', id: 'door_res_server' },
    { a: 'garage', b: 'corw2', type: 'gap', width: 2.4 },
    { a: 'garage', b: 'core2', type: 'gap', width: 2.4 },
    { a: 'radioyard', b: 'core', type: 'gap', width: 2, height: 2.6 },
    { a: 'dome', b: 'spine', type: 'door', id: 'door_res_dome' },
    { a: 'dome', b: 'core', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'tesla', b: 'core2', type: 'gap', width: 2, height: 2.6 },
    { a: 'tesla', b: 'spine', type: 'debris', id: 'debris_res_tesla', width: 2.4, height: 2.6 },
    { a: 'fuel', b: 'core2', type: 'gap', width: 2, height: 2.6 },
    { a: 'fuel', b: 'tesla', type: 'open' },
  ],
  windows: [
    { room: 'cold', side: 'n', t: 0.5 }, { room: 'genhall', side: 'n', t: 0.3 }, { room: 'genhall', side: 'n', t: 0.75 },
    { room: 'dorm', side: 's', t: 0.5 }, { room: 'garage', side: 's', t: 0.5 }, { room: 'dome', side: 'e', t: 0.5 },
  ],
  wallBuys: [
    { weapon: 'MP6K', room: 'cold', side: 'n', t: 0.85 },
    { weapon: 'PM64', room: 'mess', side: 'w', t: 0.5 },
    { weapon: 'M17', room: 'mainlab', side: 'n', t: 0.5 },
    { weapon: 'AK-75u', room: 'garage', side: 's', t: 0.2 },
    { weapon: 'Staykout', room: 'dome', side: 'e', t: 0.85 },
  ],
  props: [
    { kind: 'heliwreck', box: box(114, -36, 121, -28, 2.6) },
    { kind: 'radiotower', box: box(180, -39, 184, -35, 34) },
    { kind: 'dish', box: box(188, -30, 193, -25, 5) },
    { kind: 'generator', box: box(144.5, -44.5, 149.5, -41.5, 2.6) },
    { kind: 'generator', box: box(159.5, -44.5, 164.5, -41.5, 2.6) },
    { kind: 'labbench', box: box(150, -13, 159, -11.6, 1.0) },
    { kind: 'labbench', box: box(150, -6, 159, -4.6, 1.0) },
    { kind: 'servers', box: box(144.5, 7, 145.5, 24, 2.4) },
    { kind: 'servers', box: box(163.5, 7, 164.5, 24, 2.4) },
    { kind: 'telescope', box: box(180, -12, 185, -7, 4.2) },
    { kind: 'teslacoil', box: box(177, 13, 179, 15, 7) },
    { kind: 'teslacoil', box: box(188, 9, 190, 11, 7) },
    { kind: 'shrine', element: 'lightning', box: box(183, 17, 186, 20, 3.6) },
    { kind: 'fueltank', box: box(178, 34, 184, 40, 4) },
    { kind: 'fueltank', box: box(187, 30, 192, 35, 3.4) },
    { kind: 'snowcat', box: box(148, 36, 154, 39, 2.4) },
    { kind: 'crate', box: box(125, 40, 126.2, 41.2, 1.1) },
  ],
};

// --- TRENCH FRONT (south, Fire) ----------------------------------------------------------------
//   Landing Zone (you land here) across the north
//   ================== Front Line (trench) ====================
//   Bunker   |W| No Man's Land |C| Field Hospital |E| Battery
//   firestep |W|===== cross ===|C|==== cross =====|E| firestep
//   Dugout HQ|W| Crash Field   |C| Burning Farm   |E| Supply Dump
const TX = [-50, -30, -26.9, -6, -2.9, 18, 21.1, 50], TZ = [110, 126, 129.1, 150, 153.1, 174];
const TRENCH = {
  areas: [
    { id: 'lz', kind: 'shore', rect: cell(TX, TZ, 0, 0, 6, 0), name: 'Landing Zone', fixtures: [{ x: -20, y: 4.4, z: 122, lit: true, flicker: 0.2, kind: 'lamp' }, { x: 25, y: 4.4, z: 122, lit: true, flicker: 0.1, kind: 'lamp' }] },
    { id: 'front', kind: 'trench', rect: cell(TX, TZ, 0, 1, 6, 1), name: 'Front Line', fixtures: [{ x: -38, y: 2.3, z: 128.5, lit: true, flicker: 0.3, kind: 'lamp' }, { x: 8, y: 2.3, z: 128.5, lit: true, flicker: 0.2, kind: 'lamp' }, { x: 38, y: 2.3, z: 128.5, lit: true, flicker: 0.5, kind: 'lamp' }] },
    { id: 'sapw', kind: 'trench', rect: cell(TX, TZ, 1, 2, 1, 4), name: 'West Sap' },
    { id: 'comm', kind: 'trench', rect: cell(TX, TZ, 3, 2, 3, 4), name: 'Communication Trench', fixtures: [{ x: -3.2, y: 2.3, z: 140, lit: true, flicker: 0.2, kind: 'lamp' }] },
    { id: 'sape', kind: 'trench', rect: cell(TX, TZ, 5, 2, 5, 4), name: 'East Sap' },
    { id: 'stepw', kind: 'trench', rect: cell(TX, TZ, 0, 3), name: 'West Firestep' },
    { id: 'crossw', kind: 'trench', rect: cell(TX, TZ, 2, 3), name: 'Cross Trench' },
    { id: 'crosse', kind: 'trench', rect: cell(TX, TZ, 4, 3), name: 'Cross Trench' },
    { id: 'stepe', kind: 'trench', rect: cell(TX, TZ, 6, 3), name: 'East Firestep' },
    { id: 'bunker', kind: 'bunker', rect: cell(TX, TZ, 0, 2), name: 'Command Bunker', fixtures: [{ x: -40, y: 2.5, z: 139, lit: true, flicker: 0.4, kind: 'hanging' }] },
    { id: 'nml', kind: 'yard', rect: cell(TX, TZ, 2, 2), name: "No Man's Land", spawnStep: 8 },
    { id: 'hospital', kind: 'cabin', rect: cell(TX, TZ, 4, 2), name: 'Field Hospital', style: 'canvas', edge: 'canvas', fixtures: [{ x: 7.5, y: 2.9, z: 139, lit: true, flicker: 0.1, kind: 'hanging' }] },
    { id: 'battery', kind: 'yard', rect: cell(TX, TZ, 6, 2), name: 'Artillery Battery', edges: { e: 'invisible' } },
    { id: 'hq', kind: 'dugout', rect: cell(TX, TZ, 0, 4), name: 'Dugout HQ', height: 2.6, fixtures: [{ x: -40, y: 2.3, z: 163, lit: true, flicker: 0.3, kind: 'hanging' }] },
    { id: 'crashfield', kind: 'yard', rect: cell(TX, TZ, 2, 4), name: 'Crash Field' },
    { id: 'farm', kind: 'yard', rect: cell(TX, TZ, 4, 4), name: 'Burning Farm', fixtures: [{ x: 7.5, y: 4.4, z: 170, lit: true, flicker: 0.6, kind: 'lamp' }] },
    { id: 'dump', kind: 'yard', rect: cell(TX, TZ, 6, 4), name: 'Supply Dump', edges: { e: 'invisible' } },
  ],
  links: [
    { a: 'lz', b: 'front', type: 'debris', id: 'debris_tr_west', width: 3, t: 0.2 },
    { a: 'lz', b: 'front', type: 'debris', id: 'debris_tr_east', width: 3, t: 0.8 },
    { a: 'front', b: 'sapw', type: 'open' }, { a: 'front', b: 'comm', type: 'open' }, { a: 'front', b: 'sape', type: 'open' },
    { a: 'front', b: 'bunker', type: 'door', id: 'door_tr_bunker' },
    { a: 'front', b: 'hospital', type: 'door', id: 'door_tr_hospital' },
    { a: 'front', b: 'battery', type: 'debris', id: 'debris_tr_battery', width: 2.4 },
    { a: 'front', b: 'nml', type: 'gap', width: 2 },
    { a: 'sapw', b: 'bunker', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'sapw', b: 'stepw', type: 'open' }, { a: 'sapw', b: 'crossw', type: 'open' },
    { a: 'sapw', b: 'hq', type: 'gap', width: 1.6, height: 2.2 },
    { a: 'sapw', b: 'nml', type: 'gap', width: 2 },
    { a: 'sapw', b: 'crashfield', type: 'gap', width: 2 },
    { a: 'stepw', b: 'bunker', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'stepw', b: 'hq', type: 'gap', width: 1.6, height: 2.2 },
    { a: 'crossw', b: 'nml', type: 'gap', width: 2 },
    { a: 'crossw', b: 'crashfield', type: 'gap', width: 2 },
    { a: 'crossw', b: 'comm', type: 'open' },
    { a: 'comm', b: 'nml', type: 'gap', width: 2 },
    { a: 'comm', b: 'hospital', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'comm', b: 'crosse', type: 'open' },
    { a: 'comm', b: 'farm', type: 'debris', id: 'debris_tr_farm', width: 2.2 },
    { a: 'crosse', b: 'hospital', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'crosse', b: 'sape', type: 'open' },
    { a: 'sape', b: 'hospital', type: 'gap', width: 1.6, height: 2.4 },
    { a: 'sape', b: 'battery', type: 'gap', width: 2 },
    { a: 'sape', b: 'stepe', type: 'open' },
    { a: 'sape', b: 'dump', type: 'gap', width: 2 },
    { a: 'stepe', b: 'battery', type: 'gap', width: 2 },
    { a: 'stepe', b: 'dump', type: 'gap', width: 2 },
  ],
  windows: [
    { room: 'bunker', side: 'w', t: 0.5 }, { room: 'hq', side: 'w', t: 0.5 }, { room: 'hq', side: 's', t: 0.5 },
  ],
  wallBuys: [
    { weapon: 'MP41', room: 'bunker', side: 'w', t: 0.2 },
    { weapon: 'MPK', room: 'hospital', side: 's', t: 0.2 },
    { weapon: 'Staykout', room: 'hq', side: 'e', t: 0.2 },
    { weapon: 'AK-75u', room: 'battery', side: 'n', t: 0.3 },
    { weapon: 'M17', room: 'dump', side: 's', t: 0.5 },
  ],
  props: [
    { kind: 'biplane', box: box(-20, 160, -12, 168, 2.6) },
    { kind: 'shrine', element: 'fire', box: box(6, 162, 9, 165, 3.6) },
    { kind: 'ruinwall', box: box(-1.5, 156, 4, 156.6, 2.4) },
    { kind: 'ruinwall', box: box(12, 157, 12.6, 163, 1.8) },
    { kind: 'barrel', box: box(14.65, 168.65, 15.35, 169.35, 0.95), fire: true },
    { kind: 'barrel', box: box(-0.35, 166.65, 0.35, 167.35, 0.95), fire: true },
    { kind: 'fieldgun', box: box(28, 137, 33, 141, 1.8) },
    { kind: 'fieldgun', box: box(40, 134, 45, 138, 1.8) },
    { kind: 'crate', box: box(25, 145, 26.2, 146.2, 1.1) }, { kind: 'crate', box: box(26.4, 145, 27.6, 146.2, 1.1) },
    { kind: 'crate', box: box(30, 160, 31.2, 161.2, 1.1) }, { kind: 'crate', box: box(30, 161.4, 31.2, 162.6, 1.1) },
    { kind: 'crate', box: box(40, 165, 41.2, 166.2, 1.1) },
    { kind: 'tank', box: box(-24, 135, -16, 140, 2.4) },
    { kind: 'cots', box: box(1, 146.4, 14, 147.2, 0.7) },
    { kind: 'barrel', box: box(-38.35, 113.65, -37.65, 114.35, 0.95), fire: true },
    { kind: 'crate', box: box(30, 112, 31.2, 113.2, 1.1) },
  ],
  craters: [[-18, 143, 3], [-11, 134, 2.4], [-22, 147, 1.8], [-10, 170, 2.2], [40, 170, 2], [35, 155, 2.4]].map(([x, z, r]) => ({ x, z, r })),
};

// --- ICE CAVES (west, Wind) --------------------------------------------------------------------
//   Wind Summit (outside, the top)            | Wind Tunnel     | North Ledge
//   Frozen Lake |c| Crystal Cavern |t| Ice Gallery |   Cave Mouth (you land here)
//   Mine Works (outside)                      | Collapsed Mine  | South Ledge
const CX = [-196, -168, -165, -138, -135, -126, -110], CZ = [-48, -26, -23, 22, 25, 48];
const CAVES = {
  areas: [
    { id: 'mouth', kind: 'shore', rect: cell(CX, CZ, 5, 2), name: 'Cave Mouth', fixtures: [{ x: -122, y: 4.4, z: -15, lit: true, flicker: 0.1, kind: 'lamp' }] },
    { id: 'ledgen', kind: 'yard', rect: cell(CX, CZ, 5, 0, 5, 1), name: 'North Ledge', edges: { n: 'invisible', e: 'invisible' } },
    { id: 'ledges', kind: 'yard', rect: cell(CX, CZ, 5, 3, 5, 4), name: 'South Ledge', edges: { s: 'invisible', e: 'invisible' } },
    { id: 'gallery', kind: 'cave', rect: cell(CX, CZ, 4, 2), name: 'Ice Gallery', height: 5, spawnStep: 9 },
    { id: 'tunnel', kind: 'cave', rect: cell(CX, CZ, 3, 1, 3, 3), name: 'Ice Tunnel', height: 3.8, spawnStep: 12 },
    { id: 'crystal', kind: 'cave', rect: cell(CX, CZ, 2, 2), name: 'Crystal Cavern', height: 9 },
    { id: 'crawl', kind: 'cave', rect: cell(CX, CZ, 1, 2), name: 'Crawlway', height: 3.2, spawnStep: 14 },
    { id: 'lake', kind: 'cave', rect: cell(CX, CZ, 0, 2), name: 'Frozen Lake', height: 8 },
    { id: 'summit', kind: 'yard', rect: cell(CX, CZ, 0, 0, 2, 1), name: 'Wind Summit', edges: { n: 'invisible', w: 'invisible' } },
    { id: 'windtunnel', kind: 'cave', rect: cell(CX, CZ, 3, 0, 4, 0), name: 'Wind Tunnel', height: 5 },
    { id: 'mineworks', kind: 'yard', rect: cell(CX, CZ, 0, 3, 2, 4), name: 'Mine Works', edges: { s: 'invisible', w: 'invisible' }, fixtures: [{ x: -160, y: 4.4, z: 40, lit: true, flicker: 0.3, kind: 'lamp' }] },
    { id: 'mine', kind: 'cave', rect: cell(CX, CZ, 4, 3, 4, 4), name: 'Collapsed Mine', height: 4, floor: 'planks', fixtures: [{ x: -130.5, y: 3.6, z: 36, lit: true, flicker: 0.5, kind: 'hanging' }] },
  ],
  links: [
    { a: 'mouth', b: 'gallery', type: 'debris', id: 'debris_cave_gallery', width: 3 },
    { a: 'mouth', b: 'ledgen', type: 'gap', width: 6 },
    { a: 'mouth', b: 'ledges', type: 'gap', width: 6 },
    { a: 'ledgen', b: 'windtunnel', type: 'gap', width: 3 },
    { a: 'ledges', b: 'mine', type: 'gap', width: 3 },
    { a: 'gallery', b: 'tunnel', type: 'gap', width: 2.4, t: 0.2 },
    { a: 'gallery', b: 'tunnel', type: 'gap', width: 2.4, t: 0.8 },
    { a: 'tunnel', b: 'crystal', type: 'gap', width: 3, t: 0.3 },
    { a: 'tunnel', b: 'crystal', type: 'gap', width: 3, t: 0.75 },
    { a: 'tunnel', b: 'windtunnel', type: 'open' },
    { a: 'tunnel', b: 'mine', type: 'gap', width: 2 },
    { a: 'crystal', b: 'crawl', type: 'gap', width: 2.4 },
    { a: 'crawl', b: 'lake', type: 'gap', width: 2.4 },
    { a: 'crystal', b: 'summit', type: 'door', id: 'door_cave_summit' },
    { a: 'lake', b: 'summit', type: 'gap', width: 3 },
    { a: 'windtunnel', b: 'summit', type: 'gap', width: 3 },
    { a: 'crystal', b: 'mineworks', type: 'debris', id: 'debris_cave_mine', width: 3 },
    { a: 'lake', b: 'mineworks', type: 'gap', width: 3 },
  ],
  windows: [],
  wallBuys: [
    { weapon: 'MP41', room: 'gallery', side: 'e', t: 0.15 },
    { weapon: 'Olympus', room: 'crystal', side: 'w', t: 0.15 },
    { weapon: 'PM64', room: 'lake', side: 'w', t: 0.5 },
    { weapon: 'Staykout', room: 'mine', side: 'e', t: 0.2 },
    { weapon: 'M17', room: 'windtunnel', side: 'n', t: 0.5 },
  ],
  props: [
    { kind: 'shrine', element: 'wind', box: box(-169, -38, -166, -35, 3.6) },
    { kind: 'standing', box: box(-176, -42, -174.6, -40.6, 4.2) }, { kind: 'standing', box: box(-160.4, -42, -159, -40.6, 4.2) },
    { kind: 'standing', box: box(-176, -32.4, -174.6, -31, 4.2) }, { kind: 'standing', box: box(-160.4, -32.4, -159, -31, 4.2) },
    { kind: 'crystal', box: box(-162, -18, -160, -16, 3.2) }, { kind: 'crystal', box: box(-144, -10, -142, -8, 4.2) },
    { kind: 'crystal', box: box(-158, 6, -156, 8, 2.6) }, { kind: 'crystal', box: box(-146, 14, -144, 16, 3.6) },
    { kind: 'crystal', box: box(-152, -4, -150, -2, 5.2) },
    { kind: 'icefall', box: box(-195, -10, -191, -2, 8) },
    { kind: 'crystal', box: box(-187, 14, -185, 16, 2.4) },
    { kind: 'minecart', box: box(-131.6, 30, -129.4, 32.6, 1.4) },
    { kind: 'minecart', box: box(-160, 30, -157.4, 32.2, 1.4) },
    { kind: 'shed', box: box(-190, 38, -182, 46, 3.2) },
    { kind: 'crate', box: box(-150, 42, -148.8, 43.2, 1.1) }, { kind: 'crate', box: box(-148.6, 42, -147.4, 43.2, 0.8) },
    { kind: 'rock', box: box(-120, 30, -117, 33, 1.8) },
    { kind: 'rock', box: box(-122, -40, -119, -37, 2.2) },
  ],
};

// --- put it together -------------------------------------------------------------------------
const PARTS = [HUB, SHIP, RESEARCH, TRENCH, CAVES];
const ALL = buildIslands({
  areas: PARTS.flatMap((p) => p.areas),
  links: PARTS.flatMap((p) => p.links),
  windows: PARTS.flatMap((p) => p.windows),
  wallBuys: PARTS.flatMap((p) => p.wallBuys),
  props: PARTS.flatMap((p) => p.props),
  pads: null,
});

// the launchers: the hub's four decks and a pad on each island
export const LAUNCHERS = [
  { id: 'pad_hub_n', room: 'ndeck', x: 0, z: -28, to: 'pad_ship', label: 'the Ship Graveyard' },
  { id: 'pad_ship', room: 'pier', x: -6, z: -115, to: 'pad_hub_n', label: 'the Anvil' },
  { id: 'pad_hub_e', room: 'edeck', x: 28, z: 0, to: 'pad_research', label: 'the Research Base' },
  { id: 'pad_research', room: 'helipad', x: 114.5, z: 3.5, to: 'pad_hub_e', label: 'the Anvil' },
  { id: 'pad_hub_s', room: 'sdeck', x: 0, z: 28, to: 'pad_trench', label: 'the Trench Front' },
  { id: 'pad_trench', room: 'lz', x: 0, z: 115, to: 'pad_hub_s', label: 'the Anvil' },
  { id: 'pad_hub_w', room: 'wdeck', x: -28, z: 0, to: 'pad_caves', label: 'the Ice Caves' },
  { id: 'pad_caves', room: 'mouth', x: -114.5, z: 0, to: 'pad_hub_w', label: 'the Anvil' },
];

// keep zombies from clawing up right under a launcher, or in the Anvil's stone
const avoidSpawn = [...LAUNCHERS.map((p) => [p.x - 3.5, 0, p.z - 3.5, p.x + 3.5, 1, p.z + 3.5]), [-6.5, 0, -6.5, 6.5, 1, 6.5]];
const groundSpawns = ALL.groundSpawns.filter((g) => !avoidSpawn.some((b) => g.x > b[0] && g.x < b[3] && g.z > b[2] && g.z < b[5]));

export const ISLANDS = [
  { id: 'hub', name: 'The Anvil', element: null, rooms: HUB.areas.map((a) => a.id) },
  { id: 'ship', name: 'Ship Graveyard', element: 'ice', rooms: SHIP.areas.map((a) => a.id) },
  { id: 'research', name: 'Research Base', element: 'lightning', rooms: RESEARCH.areas.map((a) => a.id) },
  { id: 'trench', name: 'Trench Front', element: 'fire', rooms: TRENCH.areas.map((a) => a.id) },
  { id: 'caves', name: 'Ice Caves', element: 'wind', rooms: CAVES.areas.map((a) => a.id) },
];

export const CRUST = {
  id: 'crust',
  name: 'Call of the Crust',
  wallThickness: T,
  snow: true,          // the snow world: sky, snowfall, the sea, the islands (src/render/crustWorld.js)
  islands: ISLANDS,
  pa: false,           // nobody on the speakers yet (The Shntitz comes later)
  fog: { color: '#1c2534', density: 0.006 },
  farPlane: 320,
  lampScale: 0.55,     // (the lamps are bright on all this snow)

  playerSpawns: [
    { x: -23, z: 23, yaw: -0.785 },
    { x: -25, z: 23, yaw: -0.785 },
    { x: -23, z: 25, yaw: -0.785 },
    { x: -25, z: 25, yaw: -0.785 },
  ],

  rooms: ALL.rooms,
  navRegions: ALL.navRegions,
  portals: ALL.portals,
  doors: ALL.doors,
  gaps: ALL.gaps,
  windows: ALL.windows,
  wallBuys: ALL.wallBuys,
  groundSpawns,
  props: PARTS.flatMap((p) => p.props),
  launchers: LAUNCHERS,
  ships: SHIP.ships,
  craters: TRENCH.craters,

  // slush that slows you down: the harbor, the frozen lake
  mud: [
    { x: 4, z: -146, r: 6 }, { x: 30, z: -155, r: 7 }, { x: 14, z: -170, r: 4.5 }, { x: 40, z: -135, r: 4 },
    { x: -184, z: 5, r: 6 }, { x: -178, z: -14, r: 5 },
  ],

  boxSpots: [
    { id: 'box_crash', room: 'crash', x: -33.4, z: 20, yaw: Math.PI / 2, start: true },
    { id: 'box_depot', room: 'depot', x: 33.4, z: -16, yaw: -Math.PI / 2 },
    { id: 'box_keeper', room: 'keeper', x: -47.4, z: -170, yaw: Math.PI / 2 },
    { id: 'box_hold', room: 'hold', x: 6, z: -199.4, yaw: 0 },
    { id: 'box_server', room: 'server', x: 154, z: 25.4, yaw: Math.PI },
    { id: 'box_garage', room: 'garage', x: 165.4, z: 40, yaw: -Math.PI / 2 },
    { id: 'box_bunker', room: 'bunker', x: -49.4, z: 135, yaw: Math.PI / 2 },
    { id: 'box_farm', room: 'farm', x: 17.4, z: 168, yaw: -Math.PI / 2 },
    { id: 'box_crystal', room: 'crystal', x: -159, z: 21.4, yaw: Math.PI },
    { id: 'box_mineworks', room: 'mineworks', x: -170, z: 47.4, yaw: Math.PI },
  ],

  // Far off to the north, past the ship graveyard: the four stacks (the final fight).
  stacks: [
    { x: -33, z: -330, h: 96 },
    { x: -11, z: -325, h: 96 },
    { x: 11, z: -320, h: 94 },
    { x: 33, z: -315, h: 94 },
  ],
};
