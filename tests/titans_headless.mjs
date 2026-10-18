// Call of the Crust's titans (src/sim/crustEgg.js): each island's boss wakes,
// fights its own way, can only be beaten its own way, and goes down for good.
// Run: node tests/titans_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { killZombie } from '../src/sim/zombies.js';
import { groundHeight } from '../src/sim/physics.js';
import { captainMouth } from '../src/sim/crustEgg.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

function game(seed = 7) {
  const sim = new GameSim({ map: CRUST, seed });
  const me = sim.addPlayer('p1', 'Tester');
  me.health = me.maxHealth = 1e9;   // (the tests aren't about surviving)
  const log = [];
  let hold = {};
  const step = (patch = {}, n = 1) => { for (let i = 0; i < n; i++) { if (me.health < 1e8) me.health = 1e9; sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...hold, ...patch }); sim.step(dt); log.push(...sim.drainEvents()); } };
  const put = (x, z, y = null, yaw = 0) => { me.pos.x = x; me.pos.z = z; me.pos.y = (y ?? groundHeight(x, z, 0.3, 40, [sim.world.solids, sim.world.terrain])) + 0.05; me.vel.x = me.vel.y = me.vel.z = 0; me.yaw = yaw; me.region = null; me.grounded = false; step({}, 20); };
  const aim = (pos) => { const e = sim.eyePosition(me); const dx = pos.x - e.x, dy = pos.y - e.y, dz = pos.z - e.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
  const use = () => { step({}, 2); step({ use: true, usePressed: true }); step({}, 2); };
  const secs = (s, patch = {}) => step(patch, Math.round(s / dt));
  const has = (type, f = () => true) => log.some((e) => e.type === type && f(e));
  return { sim, me, log, step, put, aim, use, secs, has, setHold: (h) => { hold = h; } };
}

check(CRUST.titans.length === 4 && ['ship', 'research', 'caves', 'trench'].every((id) => CRUST.titans.some((t) => t.id === id)), 'four titans, one on each island');

// --- The Drowned Captain: waves of skeletons out of its mouth; its breath
{
  const g = game(11);
  const { sim, me } = g;
  const s = CRUST.titans.find((t) => t.id === 'ship');
  g.put(s.wake.x, s.wake.z + 1);
  check(me.prompt && /wake The Drowned Captain/.test(me.prompt.text), `at the north shore: "${me.prompt && me.prompt.text}"`);
  g.use();
  const T = sim.crustEgg.titans.ship;
  check(T.state === 'waking' && g.has('titanWake'), 'it wakes');
  g.secs(sim.cfg.crust.egg.wakeTime.ship + 3);
  check(T.state === 'fight' && g.has('titanWave', (e) => e.wave === 1), 'the first wave starts');
  check(sim.rounds.phase !== 'active' || sim.rounds.toSpawn >= 0, '(rounds held while it fights)');
  // let a few come down
  g.secs(6);
  const crew = sim.zombies.filter((z) => z.titan === 'ship');
  check(g.has('titanSpit') && crew.length > 0 && crew.every((z) => z.cast === 'skeleton'), `it spits skeletons (${crew.length} so far)`);
  const landed = sim.zombies.filter((z) => z.titan === 'ship' && z.state === 'chase');
  check(landed.length > 0 && landed.every((z) => sim.nav.regionAt(z.pos) != null && z.pos.z > -212), `they land on the island (${landed.length})`);
  // kill every wave as it comes
  let guard = 0;
  while (T.state === 'fight' && guard++ < 6000) {
    for (const z of sim.zombies) if (z.titan === 'ship' && z.state === 'chase') killZombie(sim, z, { playerId: 'p1' });
    g.step({}, 30);
  }
  check(g.log.filter((e) => e.type === 'titanWave' && e.cleared).length === 4, 'four waves held off');
  check(T.state === 'dying' || T.state === 'dead', 'the Captain goes down');
  const sawBreath = g.has('titanBreath', (e) => e.phase === 'in');
  check(sawBreath, 'it breathed in at least once');
  g.secs(sim.cfg.crust.egg.dyingTime + 0.5);
  check(T.state === 'dead' && sim.crustEgg.cores.ship && !sim.crustEgg.active && g.has('titanCore'), 'beaten: its core, and the rounds go on');
  check(g.has('points', (e) => e.reason === 'titan' && e.amount >= sim.cfg.crust.egg.reward), 'everyone gets the reward');
}

// --- it hangs in the air where you can see it, and follows you round the island
{
  const g = game(13);
  const { sim, me } = g;
  const s = CRUST.titans.find((t) => t.id === 'ship');
  g.put(s.wake.x, s.wake.z + 1); g.use();
  const T = sim.crustEgg.titans.ship, c = sim.cfg.crust.egg.ship;
  g.secs(sim.cfg.crust.egg.wakeTime.ship + 6);
  let M = captainMouth(sim, T);
  check(M.y > me.pos.y + 10, `its mouth's up over the shore, where you can see it (${(M.y - me.pos.y).toFixed(1)} m up)`);
  g.put(0, -160);
  g.secs(10);
  const d = Math.hypot(T.pos.x - me.pos.x, T.pos.z - me.pos.z);
  M = captainMouth(sim, T);
  check(Math.abs(d - c.follow.dist) < 4 && M.y > me.pos.y + 8, `it follows you through the air (${d.toFixed(1)} m off, mouth ${(M.y - me.pos.y).toFixed(1)} m up)`);
  const toYou = Math.atan2(me.pos.x - T.pos.x, me.pos.z - T.pos.z);
  check(Math.abs(Math.atan2(Math.sin(toYou - T.yaw), Math.cos(toYou - T.yaw))) < 0.3, 'it looks at you');
  g.secs(8);
  const crew = sim.zombies.filter((z) => z.titan === 'ship' && z.state === 'chase');
  check(crew.length > 0 && crew.every((z) => sim.nav.regionAt(z.pos) != null), `its crew land on the island near you (${crew.length})`);
}

// --- its breath pulls you toward it, then blows you back
{
  const g = game(12);
  const { sim, me } = g;
  const s = CRUST.titans.find((t) => t.id === 'ship');
  g.put(s.wake.x, s.wake.z + 1); g.use();
  const T = sim.crustEgg.titans.ship;
  g.secs(sim.cfg.crust.egg.wakeTime.ship + 2);
  g.put(0, -150);
  const z0 = me.pos.z;
  T.next.breath = sim.time; T.toSpit = Math.max(1, T.toSpit);
  g.secs(sim.cfg.crust.egg.ship.inhaleWarn + sim.cfg.crust.egg.ship.inhaleTime * 0.9);
  check(me.pos.z < z0 - 3, `the breath drags you toward the edge (${(z0 - me.pos.z).toFixed(1)} m)`);
  const z1 = me.pos.z;
  g.secs(sim.cfg.crust.egg.ship.inhaleTime * 0.1 + 1.2);
  check(me.pos.z > z1 + 1, `then blows you back (${(me.pos.z - z1).toFixed(1)} m)`);
}

// --- The Warden: bullets spark off; only a charged coil hurts it
{
  const g = game(21);
  const { sim, me } = g;
  const s = CRUST.titans.find((t) => t.id === 'research');
  const T = sim.crustEgg.titans.research;
  g.put(s.wake.x + 3.4, s.wake.z, null, Math.PI / 2);
  check(me.prompt && /wake The Warden/.test(me.prompt.text), `at the Warden: "${me.prompt && me.prompt.text}"`);
  g.use();
  g.secs(sim.cfg.crust.egg.wakeTime.research + 0.5);
  check(T.state === 'fight', 'the Warden is up');
  // shoot it: the bullets spark off
  g.put(T.pos.x + 3, T.pos.z + 11);
  g.aim({ x: T.pos.x, y: T.pos.y + 3.5, z: T.pos.z });
  const e0 = sim.eyePosition(me), tx = T.pos.x - e0.x, ty = T.pos.y + 3 - e0.y, tz = T.pos.z - e0.z, tl = Math.hypot(tx, ty, tz);
  const hits = sim.hitscan(e0, { x: tx / tl, y: ty / tl, z: tz / tl }, 50);
  g.step({ fire: true, firePressed: true }, 10);
  check(hits.length && hits[0].kind === 'world' && hits[0].surface === 'metal' && T.done === 0, `bullets spark off its shield (${JSON.stringify(hits[0] && { k: hits[0].kind, s: hits[0].surface, t: hits[0].t })}, ${tl.toFixed(1)})`);
  // it comes after you
  g.put(150, 24);
  const d0 = Math.hypot(T.pos.x - 150, T.pos.z - 24);
  g.secs(12);
  const d1 = Math.hypot(T.pos.x - 150, T.pos.z - 24);
  check(d1 < d0 - 15, `it walks after you (${d0.toFixed(0)} m -> ${d1.toFixed(0)} m)`);
  // charge a coil: hold F at its console
  const k = sim.crustEgg.coils[0];
  g.put(k.con.x, k.con.z + 0.2);
  check(me.prompt && /charge the tesla coil/.test(me.prompt.text), `at a coil's console: "${me.prompt && me.prompt.text}"`);
  g.secs(sim.cfg.crust.egg.research.charge + 0.3, { use: true });
  check(g.has('coilCharged'), `holding F charges the coil (${k.charge.toFixed(2)}, at ${me.pos.x.toFixed(1)},${me.pos.z.toFixed(1)}, prompt ${me.prompt && me.prompt.text}, warden ${T.pos.x.toFixed(0)},${T.pos.z.toFixed(0)})`);
  // lead it past
  let guard = 0;
  while (!g.has('coilStrike') && guard++ < 60) { g.put(k.x + 3, k.z - 4); g.secs(0.5); }
  check(g.has('coilStrike') && T.done === 1 && T.act && T.act.kind === 'struck', `the coil fires into it as it walks by (${T.done} of ${T.of})`);
  // and the rest
  for (let i = 1; i < T.of; i++) {
    const c = sim.crustEgg.coils[i];
    c.ready = true;
    T.act = null; T.pos.x = c.x + 3; T.pos.z = c.z; T.pos.y = c.con.y; g.secs(0.2);
  }
  check(T.state === 'dying' && g.has('titanDown'), 'four strikes overload it');
}

// --- The Glacier Golem: icicles, then the knife
{
  const g = game(31);
  const { sim, me } = g;
  const s = CRUST.titans.find((t) => t.id === 'caves');
  const T = sim.crustEgg.titans.caves;
  g.put(s.wake.x + 3, s.wake.z, null, Math.PI / 2);
  g.use();
  g.secs(sim.cfg.crust.egg.wakeTime.caves + 0.5);
  check(T.state === 'fight', 'the Golem is up');
  // lead it down into the cavern (it follows you down the frozen falls)
  g.put(-152, 0, 2);
  let guard = 0;
  while (Math.hypot(T.pos.x + 152, T.pos.z) > 8 && guard++ < 90) g.secs(1);
  check(Math.hypot(T.pos.x + 152, T.pos.z) <= 8, `it follows you down into the cavern (${guard} s)`);
  for (let i = 0; i < T.of; i++) {
    const k = sim.crustEgg.clusters.find((c) => c.state === 'hang');
    T.act = null; T.pos.x = k.x; T.pos.z = k.z; T.pos.y = 1; T.region = null;
    g.put(k.x + 6, k.z, 2);
    T.pos.x = k.x; T.pos.z = k.z;
    g.aim(k);
    g.step({ fire: true, firePressed: true }, 1); g.step({}, 4);
    check(k.state === 'fall', `a shot brings a cluster down (${i + 1})`);
    T.pos.x = k.x; T.pos.z = k.z;
    g.secs(sim.cfg.crust.egg.caves.fall + 0.1);
    check(T.act && T.act.kind === 'kneel', 'it lands on the Golem: it kneels');
    g.put(T.pos.x + 2.6, T.pos.z, T.pos.y, Math.PI / 2);
    g.step({ melee: true, meleePressed: true }, 1); g.secs(0.6);
    check(T.done === i + 1, `knife to the heart (${T.done} of ${T.of})`);
    g.secs(sim.cfg.crust.egg.caves.riseTime + 0.2);
  }
  check(T.state === 'dying', 'three blows to the heart: it shatters');
}

// --- The Molten Fiend: the field guns (hold F to sit in one, fire once and you're off)
{
  const g = game(41);
  const { sim, me } = g;
  const T = sim.crustEgg.titans.trench, c = sim.cfg.crust.egg.trench;
  const gun = sim.crustEgg.guns[1];
  const man = () => { g.put(gun.x - 2, gun.z - 2); g.secs(c.manHold + 0.2, { use: true }); g.step({}, 2); };
  const fire = () => { g.step({ fire: true, firePressed: true }); g.step({}, 2); };
  g.put(gun.x - 2, gun.z - 2);
  check(me.prompt && /Hold \[F\] to man the field gun/.test(me.prompt.text), `at a field gun: "${me.prompt && me.prompt.text}"`);
  g.use();
  check(!me.manning, 'a tap of F does nothing: you hold it');
  man();
  check(me.manning && me.manning.gun === gun.id && gun.by === 'p1' && Math.hypot(me.pos.x - gun.x, me.pos.z - gun.z) < 0.1, 'held F: you are sitting in the gun');
  check(me.prompt && /Fire/.test(me.prompt.text), `on the gun: "${me.prompt && me.prompt.text}"`);
  g.step({ moveY: 1, sprint: true }, 60);
  check(me.manning && Math.hypot(me.pos.x - gun.x, me.pos.z - gun.z) < 0.1, "you can't walk off with it");
  g.step({ jump: true, jumpPressed: true }); g.step({}, 2);
  check(!me.manning && gun.by === null, 'jump: off the gun without firing');
  man();
  g.aim({ x: T.home.x, y: c.groundY, z: T.home.z });
  fire();
  check(!me.manning && g.has('fieldGunFire', (e) => e.direct) && Math.hypot(me.pos.x - gun.x, me.pos.z - gun.z) > 1, 'one shot and you are booted off the gun');
  g.secs(1.5);
  check(T.state === 'waking', 'a shell into the crater wakes it');
  g.secs(sim.cfg.crust.egg.wakeTime.trench + 0.3);
  check(T.state === 'fight', 'the Fiend is up');
  check(me.prompt && /Reloading/.test(me.prompt.text), `the gun reloads after a shot: "${me.prompt && me.prompt.text}"`);
  // bullets do nothing
  const e = sim.eyePosition(me);
  const dx = T.pos.x - e.x, dy = T.pos.y + 4 - e.y, dz = T.pos.z - e.z, l = Math.hypot(dx, dy, dz);
  const hits = sim.hitscan(e, { x: dx / l, y: dy / l, z: dz / l }, 80);
  check(hits.length && hits[0].kind === 'world' && T.done === 0, 'bullets do nothing to it');
  // it comes for you
  T.next.erupt = T.next.lob = sim.time + 99;   // (just walking: no stopping to throw magma)
  const d0 = Math.hypot(T.pos.x - me.pos.x, T.pos.z - me.pos.z);
  g.secs(6);
  const d1 = Math.hypot(T.pos.x - me.pos.x, T.pos.z - me.pos.z);
  const leapIn = T.act && T.act.kind === 'leap' && Math.hypot(T.act.to.x - me.pos.x, T.act.to.z - me.pos.z) < d0;   // (blocked on the way: it burrows over to you)
  check(d1 < d0 - 5 || leapIn, `it wades across no man's land after you (${d0.toFixed(0)} m -> ${d1.toFixed(0)} m${leapIn ? ', then burrows closer' : ''})`);
  // aimed straight at its chest from the gun: a hit, five times
  for (let i = 0; i < T.of; i++) {
    gun.readyAt = 0; T.act = { kind: 'stagger', t: -99 }; T.vel.x = T.vel.z = 0;
    const was = { ...T.pos };
    man();
    T.pos.x = was.x; T.pos.z = was.z;
    g.aim({ x: T.pos.x, y: T.pos.y + 5.6, z: T.pos.z });
    fire();
    T.pos.x = was.x; T.pos.z = was.z; T.act = { kind: 'stagger', t: -99 };
    g.secs(1.2);
  }
  check(T.done === T.of && (T.state === 'dying' || T.state === 'dead'), `five shells put it down (${T.done})`);
}

// --- the Fiend never comes up out of the ground on top of you
{
  const g = game(43);
  const { sim, me } = g;
  const T = sim.crustEgg.titans.trench, L = sim.cfg.crust.egg.leap;
  const gun = sim.crustEgg.guns[0];
  sim.crustEgg.active = 'trench'; T.state = 'fight'; T.t = 0; T.of = 5; T.pos.y = sim.cfg.crust.egg.trench.groundY;
  T.next = { lob: sim.time + 999, erupt: sim.time + 999 };
  let worst = Infinity, leaps = 0;
  for (let i = 0; i < 12; i++) {
    const sp = sim.mapData.groundSpawns.filter((q) => Math.hypot(q.x - gun.x, q.z - gun.z) < 60)[i * 3 % 20];
    if (!sp) continue;
    g.put(sp.x, sp.z);
    T.act = null; T.stuckT = L.stuck + 1;
    g.step({}, 1);
    if (T.act && T.act.kind === 'leap') { leaps++; worst = Math.min(worst, Math.hypot(T.act.to.x - me.pos.x, T.act.to.z - me.pos.z)); T.act = null; }
  }
  check(leaps > 0 && worst >= L.clear - 0.01, `when it burrows it comes up at least ${L.clear} m from you (${leaps} leaps, closest ${worst.toFixed(1)} m)`);
}

// --- the Warden at the foot of the east catwalk's stairs (one foot on, one off,
// shuffling on the spot): it gets itself out (a leap) and comes after you
{
  const g = game(6);
  const { sim, me } = g;
  const s = CRUST.titans.find((t) => t.id === 'research');
  const T = sim.crustEgg.titans.research;
  g.put(s.wake.x + 3.4, s.wake.z, null, Math.PI / 2); g.use();
  g.secs(sim.cfg.crust.egg.wakeTime.research + 0.5);
  T.next.laser = sim.time + 99; T.next.adds = sim.time + 99;
  Object.assign(T.pos, { x: 167.87, y: 1.08, z: 19.96 }); T.region = null; T.act = null;
  g.put(145, 32, null);
  const d0 = Math.hypot(T.pos.x - me.pos.x, T.pos.z - me.pos.z);
  g.secs(12);
  const d1 = Math.hypot(T.pos.x - me.pos.x, T.pos.z - me.pos.z);
  check(d1 < d0 - 8, `it doesn't stay stuck on the stairs (${d0.toFixed(0)} m -> ${d1.toFixed(0)} m${g.has('titanLeap') ? ', it leapt' : ''})`);
}

// --- the Research Base's catwalks: the Warden walks on, along, off and under
// the long bridge to get to you (it used to stand stuck against it, too tall
// to go under its deck, or at the foot of its stairs by the garage and the dome)
{
  const cases = [
    // [warden x, y, z], [you x, y, z]
    [[159, 4.2, 41.2], [159, 0.8, 31]],    // off the bridge, down the stairs, back under the deck
    [[159, 4.2, 41.2], [140, 0.8, 36]],    // down the west stairs, past the garage
    [[159, 4.2, 41.2], [175, 0.8, 30]],    // down the east stairs, past the dome
    [[152, 4.2, 41.2], [168.8, 4.2, 32]],  // along the bridge and round onto the east deck
    [[155, 0.8, 38], [159, 4.2, 41.2]],    // from under the bridge up onto it
    [[159, 0.8, 27], [175, 0.8, 30]],      // out from under the decks
    [[149.2, 4.2, 26], [159, 0.8, 36]],    // off a deck to under the bridge
  ];
  const stuck = [];
  for (const [w, you] of cases) {
    const g = game(6);
    const { sim, me } = g;
    const s = CRUST.titans.find((t) => t.id === 'research');
    const T = sim.crustEgg.titans.research;
    g.put(s.wake.x + 3.4, s.wake.z, null, Math.PI / 2); g.use();
    g.secs(sim.cfg.crust.egg.wakeTime.research + 0.5);
    T.next.laser = sim.time + 99; T.next.adds = sim.time + 99;
    Object.assign(T.pos, { x: w[0], y: w[1], z: w[2] }); T.region = null; T.act = null;
    g.put(you[0], you[2], you[1]);
    let minD = Infinity;
    for (let f = 0; f < 60 * 25 && minD > 6; f++) { g.step(); minD = Math.min(minD, Math.hypot(T.pos.x - me.pos.x, T.pos.z - me.pos.z)); }
    if (minD > 6 || g.has('titanLeap')) stuck.push(`(${w}) to (${you}): got within ${minD.toFixed(1)} m${g.has('titanLeap') ? ', leapt' : ''}, at (${T.pos.x.toFixed(1)}, ${T.pos.y.toFixed(1)}, ${T.pos.z.toFixed(1)})`);
  }
  check(!stuck.length, `the Warden walks on, off and under the Research Base's bridge to you, no leaping (${cases.length - stuck.length} of ${cases.length}${stuck.length ? ': ' + stuck.join('; ') : ''})`);
}

// --- walk away and it goes back to sleep
{
  const g = game(51);
  const { sim } = g;
  const s = CRUST.titans.find((t) => t.id === 'research');
  g.put(s.wake.x + 3.4, s.wake.z, null, Math.PI / 2); g.use();
  g.secs(5);
  g.put(0, 0);
  g.secs(sim.cfg.crust.egg.leash + 1);
  const T = sim.crustEgg.titans.research;
  check(T.state === 'asleep' && !sim.crustEgg.active && g.has('titanRetreat'), 'nobody left on its island: it goes back to sleep');
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
