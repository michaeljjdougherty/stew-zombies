// Call of the Crust (map 2): sculpted islands on many levels. Every part of
// each island can be reached from its launcher and you can always get back;
// you start at the bottom of the quarry pit; the ramps, stairs and spiral
// stairs carry you (and the zombies) up; ledges let you (and some zombies)
// jump down; the launchers fling you between islands; ziplines and ice slides
// carry you while you shoot. Run: node tests/crust_headless.mjs
import { CONFIG } from '../src/config.js';
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { makeZombie } from '../src/sim/zombies.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

// --- the map data: every island joins up, and nowhere is a trap
{
  const byId = new Map(CRUST.navRegions.map((r) => [r.id, r]));
  const out = new Map(CRUST.navRegions.map((r) => [r.id, []]));
  let bad = 0;
  for (const p of CRUST.portals) { if (!byId.has(p.a) || !byId.has(p.b)) { bad++; continue; } out.get(p.a).push(p); if (!p.oneWay) out.get(p.b).push(p); }
  check(bad === 0, 'every portal joins two real places');
  const reach = (a) => { const s = new Set([a]), st = [a]; while (st.length) { const c = st.pop(); for (const p of out.get(c)) { const n = p.a === c ? p.b : p.a; if (!s.has(n)) { s.add(n); st.push(n); } } } return s; };
  for (const T of CRUST.terrains) {
    const isl = CRUST.islands.find((i) => i.id === T.id);
    const pad = CRUST.launchers.find((l) => T.contains(l.x, l.z));
    const regs = CRUST.navRegions.filter((r) => T.contains((r.rect[0] + r.rect[2]) / 2, (r.rect[1] + r.rect[3]) / 2));
    const pr = regs.find((r) => pad.x >= r.rect[0] && pad.x <= r.rect[2] && pad.z >= r.rect[1] && pad.z <= r.rect[3] && Math.abs(r.y0 - pad.y) < 0.5);
    const from = reach(pr.id);
    // (single-cell slivers at the shore don't count)
    const big = (r) => (r.rect[2] - r.rect[0]) * (r.rect[3] - r.rect[1]) > 1.5;
    const lost = regs.filter((r) => big(r) && !from.has(r.id));
    const trapped = regs.filter((r) => from.has(r.id) && !reach(r.id).has(pr.id));
    check(lost.length === 0 && trapped.length === 0, `${isl.name}: all ${regs.length} places reachable from the launcher, none you can't get back from (${lost.length} out of reach, ${trapped.length} traps)`);
    const levels = new Set(regs.map((r) => Math.round(r.y1)));
    check(levels.size >= 4, `${isl.name}: built on many levels (${[...levels].sort((a, b) => a - b).join(', ')} m)`);
    check(CRUST.portals.some((p) => p.drop && byId.get(p.a) && regs.includes(byId.get(p.a))), `${isl.name}: has ledges to jump down from`);
  }
  check(CRUST.islands.filter((i) => i.element).map((i) => i.element).sort().join() === 'fire,ice,lightning,wind', 'one island for each element');
  check(!CRUST.structures.some((s) => /ladder/i.test(s.id)), 'no ladders (spiral stairs instead)');
}

function game(seed = 5, mode = 'zombies') {
  const sim = new GameSim({ map: CRUST, seed, mode });
  const me = sim.addPlayer('p1', 'Tester');
  const log = [];
  const step = (patch = {}, n = 1) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch }); sim.step(dt); log.push(...sim.drainEvents()); } };
  const put = (x, z, y = 0, yaw = 0) => { me.pos.x = x; me.pos.y = y + 0.05; me.pos.z = z; me.vel.x = me.vel.y = me.vel.z = 0; me.yaw = yaw; me.region = null; me.ride = null; step({}, 20); };
  const face = (pos) => { me.yaw = Math.atan2(-(pos.x - me.pos.x), -(pos.z - me.pos.z)); };
  const use = () => { step({}, 2); step({ use: true, usePressed: true, yaw: me.yaw }); step({}, 2); };
  // walk toward a point (steering each tick); returns when there or out of time
  const walk = (x, z, secs = 20, sprint = false) => {
    for (let i = 0; i < secs * 60; i++) {
      if (Math.hypot(me.pos.x - x, me.pos.z - z) < 0.5) return true;
      face({ x, z });
      step({ moveY: 1, sprint, yaw: me.yaw });
    }
    return false;
  };
  return { sim, me, log, step, put, face, use, walk };
}
const at = (deg, r) => [Math.cos(deg * Math.PI / 180) * r, Math.sin(deg * Math.PI / 180) * r];

// --- you start at the bottom of the pit, by the Anvil
{
  const { sim, me, log, step } = game();
  check(sim.zoneOf(me.pos) === 'pit' && me.pos.y < 0.5, `you start at the bottom of the quarry pit, on the Anvil's dais (${sim.zoneOf(me.pos)}, y ${me.pos.y.toFixed(1)})`);
  const pitGuns = sim.world.wallBuys.filter((w) => w.zone === 'pit');
  check(pitGuns.length === 2, `two guns on the pit's rock walls (${pitGuns.map((w) => w.weapon).join(', ')})`);
  check(CRUST.props.some((p) => p.kind === 'anvil' && p.blank), "the Anvil's four sockets are empty, waiting for the War Hammers");
  me.health = me.maxHealth = 1e9;
  step({}, 60 * 40);
  const rose = log.filter((e) => e.type === 'zombieRise');
  check(rose.length > 0 && rose.every((e) => sim.zoneOf(e.pos) === 'pit'), `zombies rise in the pit, nowhere else yet (${rose.length})`);
}

// --- out of the pit: clear the debris, up the ramp to the terrace, on up to the rim, jump back down
{
  const { sim, me, step, put, face, use, walk } = game();
  me.points = 1e6;
  const d = sim.world.doors.find((x) => x.id === 'debris_hub_west');
  put(d.x + 1.5, d.z, 0.4); face(d.center);
  use();
  check(sim.doorOpen('debris_hub_west'), 'clear the debris at the foot of the west ramp');
  // up the ramp, round the quarry wall
  let ok = true;
  for (let a = 100; a <= 140; a += 5) ok = walk(...at(a, 17.6), 8) && ok;
  for (let a = 145; a <= 160; a += 5) walk(...at(a, 19), 4);
  check(ok && Math.abs(me.pos.y - 4.5) < 0.4 && sim.zoneOf(me.pos) === 'terraceW', `walked up the ramp onto the west terrace (y ${me.pos.y.toFixed(2)}, ${sim.zoneOf(me.pos)})`);
  // round the terrace and across the catwalk to the east terrace
  for (let a = 165; a <= 205; a += 5) walk(...at(a, 19), 4);
  walk(-14, -9, 6); walk(14, -9, 12); walk(...at(345, 19.5), 4);
  check(Math.abs(me.pos.y - 4.5) < 0.3 && sim.zoneOf(me.pos) === 'terraceE', `over the scaffold catwalk to the east terrace (y ${me.pos.y.toFixed(2)}, ${sim.zoneOf(me.pos)})`);
  // up to the rim (back across, up the west terrace's ramp)
  walk(14, -9, 4); walk(-14, -9, 12); walk(...at(205, 19), 4);
  for (let a = 210; a <= 258; a += 4) walk(...at(a, 18.6), 6);
  walk(...at(266, 24.5), 6); walk(3, -28, 6);
  check(Math.abs(me.pos.y - 9) < 0.3 && sim.zoneOf(me.pos) === 'rim', `and on up to the rim (y ${me.pos.y.toFixed(2)}, ${sim.zoneOf(me.pos)})`);
  // round the rim, and jump off it onto the east terrace
  for (let a = 280; a <= 360; a += 10) walk(...at(a, 27), 6);
  for (let i = 0; i < 120 && me.pos.y > 5; i++) { face({ x: 0, z: 0 }); step({ moveY: 1, yaw: me.yaw }); }
  step({}, 40);
  check(Math.abs(me.pos.y - 4.5) < 0.3, `jumped off the rim, down onto the terrace (y ${me.pos.y.toFixed(2)})`);
}

// --- the launchers, there and back, landing at the right height
{
  const { sim, me, log, step, put } = game();
  for (const [pad, dest, island] of [['pad_hub_s', 'pad_trench', 'trench'], ['pad_hub_n', 'pad_ship', 'ship'], ['pad_hub_e', 'pad_research', 'research'], ['pad_hub_w', 'pad_caves', 'caves']]) {
    const P = CRUST.launchers.find((q) => q.id === pad), D = CRUST.launchers.find((q) => q.id === dest);
    put(P.x + 0.3, P.z + 0.3, P.y);
    check(me.prompt && /launch/i.test(me.prompt.text), `${pad}: "${me.prompt && me.prompt.text}"`);
    step({ use: true, usePressed: true, yaw: me.yaw });
    let top = 0, hurt = false;
    for (let i = 0; i < 60 * 5 && me.launch; i++) { step({}, 1); top = Math.max(top, me.pos.y); if (me.launch && me.launch.t > 1 && !hurt) { const h = me.health; sim.damagePlayer(me, 50, null); hurt = me.health !== h; } }
    const isl = CRUST.islands.find((i) => i.id === island);
    step({}, 10);
    check(!hurt && !me.launch && Math.hypot(me.pos.x - D.x, me.pos.z - D.z) < 0.5 && Math.abs(me.pos.y - D.y) < 0.2 && isl.rooms.includes(sim.roomAt(me.pos).id), `  flew to ${isl.name}, untouchable in the air (up to ${top.toFixed(0)} m)`);
    step({}, 90);
    put(D.x + 0.2, D.z - 0.2, D.y);
    step({ use: true, usePressed: true, yaw: me.yaw });
    for (let i = 0; i < 60 * 5 && me.launch; i++) step({}, 1);
    step({}, 10);
    check(Math.hypot(me.pos.x - P.x, me.pos.z - P.z) < 0.5 && Math.abs(me.pos.y - P.y) < 0.2, '  and back to the rim');
    step({}, 90);
  }
  check(log.some((e) => e.type === 'playerLaunch') && log.some((e) => e.type === 'playerLaunchLand'), 'launch and landing events');
}

// --- a zombie left behind on the hub gets recycled near you
{
  const { sim, me, log, step, put } = game(9);
  me.health = me.maxHealth = 1e9;
  const L = CRUST.launchers.find((q) => q.id === 'pad_caves');
  put(L.x - 4, L.z + 4, L.y);
  sim.rounds.phase = 'active'; sim.rounds.toSpawn = 0; sim.rounds.round = 3;
  const z = makeZombie(sim, { type: 'walker', pos: { x: -3, y: 0, z: 10 }, health: 1e6, state: 'chase' });
  sim.zombies.push(z);
  step({}, 60 * (sim.cfg.crust.strandedTime + 2));
  const rose = log.filter((e) => e.type === 'zombieRise');
  check(z.state === 'dead' && rose.length === 1 && Math.hypot(rose[0].pos.x - me.pos.x, rose[0].pos.z - me.pos.z) < 45, 'a zombie left on the hub rises again near you, on the Ice Caves');
}

// One zombie a long way off, everything open: does it get to you, up and down?
function chase(label, from, to, type = 'runner', secs = 150) {
  const { sim, me, step, put } = game(7);
  for (const d of CRUST.doors) sim.openDoor(d.id);
  sim.rounds.phase = 'pregame'; sim.rounds.timer = 1e9;
  me.health = me.maxHealth = 1e9;
  put(to.x, to.z, to.y ?? 0);
  const z = makeZombie(sim, { type, pos: { x: from.x, y: from.y ?? 0, z: from.z }, health: 1e6, state: 'chase' });
  sim.zombies.push(z);
  let t = 0, best = Infinity;
  for (; t < secs * 60; t++) {
    step({}, 1);
    const d = Math.hypot(z.pos.x - me.pos.x, z.pos.z - me.pos.z);
    best = Math.min(best, d + Math.abs(z.pos.y - me.pos.y));
    if (d < 2.2 && Math.abs(z.pos.y - me.pos.y) < 1.2) break;
  }
  check(t < secs * 60, `${label} (${(t / 60).toFixed(1)} s${t >= secs * 60 ? ', closest ' + best.toFixed(1) + ' m, stuck at ' + z.pos.x.toFixed(1) + ',' + z.pos.y.toFixed(1) + ',' + z.pos.z.toFixed(1) : ''})`);
}
chase('hub: up from the pit floor to the rim (ramps)', { x: -3, z: 10 }, { x: 0, z: -26, y: 9 }, 'walker');
chase('hub: down from the rim into the pit (jumps)', { x: 26, z: 4, y: 9 }, { x: -6, z: 10, y: 0 });
chase('hub: down from the rim into the pit (a walker goes round by the ramps)', { x: 26, z: 4, y: 9 }, { x: -6, z: 10, y: 0 }, 'walker');
chase('hub: out along the catwalk', { x: 12, z: 0 }, { x: 0, z: 9, y: 4.5 });
chase('ship: up the mesa road and the scaffold stairs to the lighthouse gallery', { x: -20, z: -140, y: 0.8 }, { x: -44.5, z: -188, y: 15.15 });
chase('ship: up the gangway and the stairs to the galleon\'s quarterdeck', { x: -6, z: -118, y: 0.8 }, { x: 4, z: -160, y: 6.3 });
chase('ship: onto the capsized hull up the snow drift', { x: 20, z: -130, y: 0.8 }, { x: 42.5, z: -170, y: 6.3 });
chase('ship: down through the hole into the capsized hull', { x: 42.5, z: -150, y: 6.3 }, { x: 42.5, z: -170, y: 0.8 });
chase('ship: onto the shed roofs up the pack ice', { x: -20, z: -125, y: 0.8 }, { x: -36, z: -152, y: 4.3 });
chase('research: up the radio mast to the top platform', { x: 120, z: -10, y: 0.8 }, { x: 184, z: -32.5, y: 17 });
chase('research: up the observatory ramp to the telescope', { x: 160, z: 30, y: 0.8 }, { x: 179, z: 14, y: 6 });
chase('research: up onto the tesla catwalks', { x: 140, z: 30, y: 0.8 }, { x: 160, z: 41.2, y: 4.2 });
chase('trenches: from the front line up to the fort roof', { x: -18, z: 175, y: 0 }, { x: -5, z: 145, y: 9 });
chase('trenches: up the radio lookout', { x: 30, z: 120, y: 2.2 }, { x: 1.5, z: 143.5, y: 16 });
chase('trenches: from the fort down into the trenches', { x: 0, z: 146, y: 2.2 }, { x: 14, z: 174.5, y: 0 });
chase('caves: up a toppled pillar onto the north shelf', { x: -118, z: 0, y: 0.8 }, { x: -150, z: -12, y: 5.5 });
chase('caves: up the frozen falls to the Wind Summit', { x: -150, z: 0, y: 1 }, { x: -172, z: -28, y: 10 });
chase('caves: from the summit down to the mine', { x: -170, z: -30, y: 10 }, { x: -146, z: 33, y: 1 });

// --- you stand on things at the right height
{
  const { me, put, step } = game();
  const spots = [['the rim', 0, -26, 9], ['the west terrace', -19, 0, 4.5], ['the lighthouse gallery', -44.5, -188, 15.15], ['the galleon\'s main deck', 20, -158, 3.7], ['the galleon\'s quarterdeck', 4, -160, 6.3], ['the mast\'s top platform', 184, -32.5, 17], ['the fort roof', -5, 145, 9], ['the Wind Summit', -172, -28, 10], ['a trench', 14, 174.5, 0]];
  for (const [name, x, z, y] of spots) { put(x, z, y + 0.4); step({}, 60); check(Math.abs(me.pos.y - y) < 0.15, `standing on ${name} (y ${me.pos.y.toFixed(2)})`); }
}

// --- guard rails: you can't walk off a ledge, but for the gaps left to dive off
{
  const { me, put, walk, step } = game();
  check(CRUST.rails.length > 100, `${CRUST.rails.length} stretches of guard rail round the ledges and decks`);
  for (const isl of CRUST.islands) {
    const ds = CRUST.dives.filter((d) => d.island === isl.id);
    const ok = ds.filter((d) => CRUST.portals.some((p) => p.drop && Math.hypot(p.x - d.x, p.z - d.z) < 3));
    check(ds.length >= 2 && ok.length === ds.length, `${isl.name}: ${ds.length} places to dive off (${ds.map((d) => d.y.toFixed(1) + ' m').join(', ')})`);
  }
  // the west terrace's lip, away from the dive: the rail holds you
  put(-19.5, 6, 4.5); walk(0, 6, 4); step({}, 30);
  check(Math.abs(me.pos.y - 4.5) < 0.3, `the rail along the terrace's lip stops you (y ${me.pos.y.toFixed(2)})`);
  // ...and at the dive spot you go over
  put(-19.5, -3.5, 4.5); walk(-8, -3.5, 4); step({}, 60);
  check(me.pos.y < 0.5, `at the gap you dive into the pit (y ${me.pos.y.toFixed(2)})`);
  // the galleon's bulwark, the lighthouse's walls
  put(17, -158, 3.7); walk(17, -148, 4); step({}, 30);
  check(Math.abs(me.pos.y - 3.7) < 0.3 && me.pos.z < -156, `the galleon's side keeps you on the deck (${me.pos.z.toFixed(1)}, y ${me.pos.y.toFixed(2)})`);
  put(8, -150, 0.4); walk(8, -170, 4);
  check(me.pos.z > -156, `you can't walk into the galleon's hull from the harbor (${me.pos.z.toFixed(1)})`);
  put(-44.5, -188, 15.15); walk(-36, -188, 6); step({}, 30);
  check(Math.abs(me.pos.y - 15.15) < 0.3 && Math.hypot(me.pos.x + 36, me.pos.z + 188) > 4.3, `the lighthouse's walls stop you on the gallery (${Math.hypot(me.pos.x + 36, me.pos.z + 188).toFixed(1)} m out)`);
  // under the porch: the iron piles are solid (walk straight at one)
  put(-25, -188, 9.4); walk(-36, -188, 6);
  check(Math.abs(me.pos.x - (-36 + 6.8)) > 0.55 && me.pos.x > -36 + 6.8, `nor can you walk through the lighthouse's piles (stopped ${(me.pos.x + 36 - 6.8).toFixed(2)} m from one)`);
}

// --- the zipline: grab it at the lighthouse gallery, shoot on the way down, land on the galleon's quarterdeck
{
  const { sim, me, log, step, put } = game();
  const R = CRUST.rides.find((r) => r.id === 'zip_lighthouse');
  put(R.pts[0][0] - 0.6, R.pts[0][2], 15.15);
  step({}, 3);
  check(me.prompt && /zipline/i.test(me.prompt.text), `the zipline: "${me.prompt && me.prompt.text}"`);
  step({ use: true, usePressed: true, yaw: me.yaw });
  check(!!me.ride, '  you grab it');
  const clip0 = me.loadout.slots[me.loadout.current].clip;
  step({ fire: true, firePressed: true }, 1); step({ fire: true }, 20);
  check(me.loadout.slots[me.loadout.current].clip < clip0, '  and shoot while you ride');
  for (let i = 0; i < 60 * 8 && me.ride; i++) step({}, 1);
  step({}, 60);
  check(!me.ride && Math.abs(me.pos.y - 6.3) < 0.2 && Math.hypot(me.pos.x - 4, me.pos.z + 160) < 3, `  off at the far end, on the galleon's quarterdeck (y ${me.pos.y.toFixed(2)})`);
  // let go half way: jump
  put(R.pts[0][0] - 0.6, R.pts[0][2], 15.15);
  step({ use: true, usePressed: true, yaw: me.yaw });
  step({}, 60);
  step({ jump: true, jumpPressed: true }); step({}, 3);
  check(!me.ride, '  jump to let go');
  for (let i = 0; i < 400 && !me.grounded; i++) step({}, 1);
  check(me.grounded, `  and you drop (to y ${me.pos.y.toFixed(1)})`);
  check(log.some((e) => e.type === 'rideStart') && log.some((e) => e.type === 'rideEnd'), '  ride events');
}

// --- the other ziplines: stand at the top, grab it, ride it all the way down, land on your feet
for (const id of ['zip_gallery', 'zip_mast', 'zip_trench', 'zip_caves']) {
  const { sim, me, step, put } = game();
  const R = CRUST.rides.find((r) => r.id === id);
  check(!!R, `zipline ${id}`);
  if (!R) continue;
  const [a, b] = [R.pts[0], R.pts[R.pts.length - 1]];
  const groundA = a[1] - CONFIG.crust.ride.cable, groundB = b[1] - CONFIG.crust.ride.cable;
  put(a[0], a[2], groundA);
  step({}, 20);
  check(Math.abs(me.pos.y - groundA) < 0.4, `  you can stand at its top (y ${me.pos.y.toFixed(2)} for ${groundA.toFixed(2)})`);
  check(me.prompt && /zipline/i.test(me.prompt.text), `  "${me.prompt && me.prompt.text}"`);
  step({ use: true, usePressed: true, yaw: me.yaw });
  let t = 0;
  for (; t < 60 * 12 && me.ride; t++) step({}, 1);
  step({}, 60);
  check(!me.ride && me.grounded && Math.abs(me.pos.y - groundB) < 0.5 && Math.hypot(me.pos.x - b[0], me.pos.z - b[2]) < 4.5, `  down in ${(t / 60).toFixed(1)} s, on the ground at the far end (y ${me.pos.y.toFixed(2)}, grounded ${me.grounded}, ${Math.hypot(me.pos.x - b[0], me.pos.z - b[2]).toFixed(1)} m off)`);
  check(me.alive && me.health === me.maxHealth, '  unhurt');
}

// --- no slide in the hub any more (the spawn is the forge)
check(!CRUST.rides.some((r) => r.id === 'slide_hub'), 'no ice slide in the hub');

// --- the guns on the walls and the box
{
  const { sim, me, step, face } = game();
  me.points = 50000;
  const wb = sim.interactables.find((i) => i.kind === 'wallbuy' && i.wb.weapon === 'M15');
  me.pos.x = wb.stand.x; me.pos.z = wb.stand.z; face(wb.pos);
  step({}, 2); step({ use: true, usePressed: true, yaw: me.yaw }); step({}, 2);
  check(me.loadout.slots.some((s) => s.id === 'M15'), 'bought the M15 off the pit wall');
  check(sim.world.wallBuys.length >= 20, `${sim.world.wallBuys.length} guns on the walls round the map`);
  const box = sim.box;
  me.pos.x = box.stand.x; me.pos.z = box.stand.z; me.pos.y = (box.spot.y || 0) + 0.05; face(box.pos);
  step({}, 2); step({ use: true, usePressed: true, yaw: me.yaw }); step({}, 2);
  check(box.phase === 'spinning' && box.spot.id !== 'box_pit', `the Mystery Box spins, up in ${box.spot.id} (not down in the pit where you spawn) (${box.phase})`);
  check(sim.world.boxSpots.length >= 9, `${sim.world.boxSpots.length} places the box can be`);
  check(sim.windows.length >= 6 && sim.windows.every((w) => w.boards === sim.cfg.windows.boards), `${sim.windows.length} boarded windows`);
}

// --- the mud in the dried harbor slows you
{
  const { me, step, put } = game();
  const run = (x, z) => { put(x, z, 0.4, Math.PI / 2); const x0 = me.pos.x; step({ moveY: 1, yaw: Math.PI / 2 }, 60); return Math.abs(me.pos.x - x0); };
  const slush = run(15, -172), ice = run(-2, -172);
  check(slush < ice * 0.8, `mud in the dried harbor slows you (${slush.toFixed(2)} m vs ${ice.toFixed(2)} m on firm ground)`);
}

// --- out in space: step off an edge and you're gone (solo: game over)
{
  const { sim, me, log, step, put } = game();
  check(CRUST.space && CRUST.terrains.every((t) => t.openEdges), 'the islands float in space (open edges, no fences)');
  put(0, 95, 2);   // (the gulf between the hub and the Trench Front)
  for (let i = 0; i < 60 * 6 && me.alive; i++) step({}, 1);
  check(!me.alive && log.some((e) => e.type === 'playerFell') && log.some((e) => e.type === 'playerDied' && e.fell), `fall off and you die (y ${me.pos.y.toFixed(0)})`);
  step({}, 30);
  check(sim.gameOver, '  solo: game over');
  const ex = game(5, 'explore');
  ex.put(0, -26, 9); ex.step({}, 30);
  ex.put(0, 95, 2);
  for (let i = 0; i < 60 * 6; i++) ex.step({}, 1);
  check(ex.me.alive && ex.me.pos.y > 5, `  Explore: you're put back where you last stood (y ${ex.me.pos.y.toFixed(1)})`);
}

// --- the Trench Front: up top is shelled, no-man's-land is wired off, the field telephone
{
  const { sim, me, log, step, put } = game();
  me.points = 50000;
  check(CRUST.doors.some((d) => d.id === 'gate_nml' && d.kind === 'gate'), "no-man's-land is wired off (a gate to open later)");
  check(CRUST.portals.filter((p) => p.door === 'gate_nml').length > 0, "  the zombies' ways into it are shut too");
  put(-10, 116, 2.3, -Math.PI / 2); step({}, 10);
  for (let i = 0; i < 60 * 3; i++) step({ moveY: 1, yaw: Math.PI / 2 }, 1);
  check(sim.zoneOf(me.pos, me.region) !== 'nomansland' && me.pos.x > -15.5, `  you can't walk out into it off the landing zone (stopped at x ${me.pos.x.toFixed(1)})`);
  put(-36, 138, 2.3); step({}, 30);
  const gp = sim.zoneOf(me.pos, me.region) === 'gunpitW' ? { x: -36, z: 138, y: 2.3 } : null;
  check(!!gp, `up in the west gun pit (${sim.zoneOf(me.pos, me.region)}, y ${me.pos.y.toFixed(2)})`);
  if (gp) {
    const hp0 = me.health; log.length = 0;
    put(gp.x, gp.z, gp.y);
    for (let i = 0; i < 60 * 6 && me.alive && !me.downed; i++) step({}, 1);
    check(log.some((e) => e.type === 'shellIncoming'), '  up in the gun pit the shells come in');
    check(log.some((e) => e.type === 'explosion') || me.health < hp0 || me.downed, `  and they hit (${me.downed ? 'downed' : 'health ' + me.health.toFixed(0)})`);
  }
  // safe down in the trench
  const g2 = game();
  g2.log.length = 0;
  g2.put(14, 174.5, 0);
  for (let i = 0; i < 60 * 5; i++) g2.step({}, 1);
  check(!g2.log.some((e) => e.type === 'shellIncoming'), '  down in the trenches no shells fall');
  // the field telephone
  const tel = sim.interactables.find((i) => i.kind === 'ceasefire');
  check(!!tel, 'a field telephone in the fort');
  if (tel && gp) {
    const g3 = game(); g3.me.points = 50000;
    g3.me.pos.x = tel.stand.x; g3.me.pos.z = tel.stand.z; g3.me.pos.y = tel.pos.y - 1.4; g3.face(tel.pos);
    g3.step({}, 2); g3.step({ use: true, usePressed: true, yaw: g3.me.yaw }); g3.step({}, 2);
    check(g3.me.points === 50000 - sim.cfg.crust.shelling.ceasefireCost && g3.log.some((e) => e.type === 'ceasefire'), `  call a ceasefire (${50000 - g3.me.points} pts)`);
    g3.log.length = 0;
    g3.put(gp.x, gp.z, gp.y);
    for (let i = 0; i < 60 * 5; i++) g3.step({}, 1);
    check(!g3.log.some((e) => e.type === 'shellIncoming'), '  and the guns go quiet');
  }
}

// --- Explore: endless points
{
  const { sim, me } = game(5, 'explore');
  check(me.points >= 999999 && sim.godMode, 'Explore: endless points, nothing can hurt you');
}

console.log(fails ? `\n${fails} FAILED` : '\nall crust checks passed');
process.exit(fails ? 1 : 0);
