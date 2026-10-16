// Call of the Crust's Easter egg, end to end: Pit at his forge (not playable),
// the titans' cores, the four War Hammers (and tempering), the Anvil, and
// Big Evil Zach.
// Run: node tests/crustquest_headless.mjs
import { powerAllOn } from '../src/sim/crustPower.js';
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { makeZombie } from '../src/sim/zombies.js';
import { giveWeapon } from '../src/sim/weapons.js';
import { wakeTitan } from '../src/sim/crustEgg.js';
import { dropCore, CORE_ELEMENT } from '../src/sim/forge.js';
import { HAMMER_IDS } from '../src/sim/hammers.js';
import { CONFIG } from '../src/config.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const F = CRUST.forge;

function game(seed = 3, character = 'kearns') {
  const sim = new GameSim({ map: CRUST, seed });
  powerAllOn(sim);   // (the power's its own test: crustpower_headless.mjs)
  const me = sim.addPlayer('p1', 'Tester', { character });
  sim.rounds.timer = 1e9;
  me.health = me.maxHealth = 1e6;
  const log = [];
  const step = (patch = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch });
      sim.step(dt);
      for (const e of sim.drainEvents()) log.push(e);
    }
  };
  const at = (x, z, lookX = null, lookZ = null) => {
    me.pos.x = x; me.pos.z = z; me.pos.y = F.y + 0.02; me.vel.x = me.vel.y = me.vel.z = 0;
    if (lookX != null) me.yaw = Math.atan2(-(lookX - x), -(lookZ - z));
    step({}, 2);
  };
  const use = () => { step({ use: true, usePressed: true }); step({}, 2); };
  const bench = () => at((F.bench[0] + F.bench[2]) / 2 + 1.6, (F.bench[1] + F.bench[3]) / 2, F.pit.x, F.pit.z);
  const socket = (el) => { const s = F.sockets[el]; const k = Math.hypot(s.x, s.z); at(s.x / k * 3.75, s.z / k * 3.75, s.x, s.z); };
  return { sim, me, log, step, at, use, bench, socket };
}
const E = (g) => g.sim.crustEgg;
const addZ = (g, x, z, hp = 3000) => { const zz = makeZombie(g.sim, { pos: { x, y: F.y, z }, health: hp, state: 'chase' }); zz.speed = 0; g.sim.zombies.push(zz); return zz; };
// (a swing winds up, lands, and the hammer comes back round: one whole swing)
const SWING = Math.ceil(60 * 60 / CONFIG.weapons['Fire Hammer'].rpm) + 2;
const swing = (g) => { g.step({ fire: true, firePressed: true }); g.step({}, SWING); };
const forgeAll = (g) => {
  for (const id of ['ship', 'research', 'caves', 'trench']) {
    dropCore(g.sim, id, { x: 4, y: F.y, z: 7 });
    g.at(4, 7); g.step({}, 2);
    g.bench(); g.use();
  }
  g.step({}, 60 * (CONFIG.crust.forge.forgeTime * 4 + 2));
};

// --- Pit isn't playable here: he's at his forge, and he says hello
{
  const g = game(3, 'pit');
  check(g.me.character !== 'pit', `picking Pit: you play ${g.me.character} instead`);
  g.step({}, 60 * (CONFIG.crust.forge.introDelay + 45));
  check(g.log.some((e) => e.type === 'crewSays' && e.who === 'pit' && /relay/.test(e.text)), 'Pit tells you about the burnt relays from his bench');
  check(g.log.some((e) => e.type === 'crewSays' && e.who === 'pit' && /War Hammer/.test(e.text)), '...and the War Hammer');
  const s2 = new GameSim({ map: CRUST, seed: 1 });
  const a = s2.addPlayer('a', 'A', { character: 'pit' }), b = s2.addPlayer('b', 'B', { character: 'kearns' });
  check(a.character !== 'pit' && b.character === 'kearns', `online: nobody plays Pit here (${a.character}, ${b.character})`);
}

// --- a titan falls, its core drops; pick it up, take it to Pit, he forges its hammer
{
  const g = game(4);
  check(wakeTitan(g.sim, 'research', g.me), 'the Warden wakes');
  const T = E(g).titans.research;
  T.state = 'fight'; T.done = T.of;
  g.step({}, 60 * (CONFIG.crust.egg.dyingTime + 1));
  const k = E(g).cores.research;
  check(T.state === 'dead' && k && k.state === 'dropped', 'it falls; its core drops');
  check(g.log.some((e) => e.type === 'titanCore' && e.element === 'lightning'), '...the Lightning core');
  g.me.pos.x = k.x; g.me.pos.z = k.z; g.me.pos.y = k.y + 0.05; g.step({}, 3);
  check(k.state === 'carried' && k.by === 'p1', 'walk over it: you carry it');
  g.bench();
  check(g.me.prompt && /give Pit the Lightning core/.test(g.me.prompt.text), `at Pit's bench: "${g.me.prompt && g.me.prompt.text}"`);
  g.use();
  check(E(g).forge.work && E(g).forge.work.element === 'lightning', 'Pit starts forging');
  g.step({}, 60 * 3);
  check(g.log.some((e) => e.type === 'forgeStrike'), '...hammer blows (the sparks)');
  g.step({}, 60 * CONFIG.crust.forge.forgeTime);
  check(E(g).forge.hammers.lightning.forged && g.log.some((e) => e.type === 'hammerForged'), 'the Lightning Hammer is forged, into its socket');
  g.socket('lightning');
  check(g.me.prompt && !/Press/.test(g.me.prompt.text) && /War Hammer/.test(g.me.prompt.sub || ''), `no War Hammer: "${g.me.prompt && g.me.prompt.text}" (${g.me.prompt && g.me.prompt.sub})`);
  giveWeapon(g.sim, g.me, 'War Hammer'); g.step({}, 40);
  g.socket('lightning');
  check(g.me.prompt && /take the Lightning Hammer/.test(g.me.prompt.text), `with one: "${g.me.prompt && g.me.prompt.text}"`);
  const n = g.me.loadout.slots.length;
  g.use();
  check(g.me.loadout.slots.some((s) => s.id === 'Lightning Hammer') && !g.me.loadout.slots.some((s) => s.id === 'War Hammer') && g.me.loadout.slots.length === n && E(g).forge.hammers.lightning.by === 'p1', 'your War Hammer becomes the Lightning Hammer');
  g.use();
  check(g.me.loadout.slots.some((s) => s.id === 'War Hammer') && E(g).forge.hammers.lightning.by === null, 'put it back: plain iron again');
  // a second core while he works: on the pile
}

// --- the War Hammer: four parts, one on each island; the stand at the Anvil; one each
{
  const g = game(8);
  const Fg = E(g).forge;
  check(Object.keys(Fg.parts).length === 4 && Object.values(Fg.parts).every((k) => k.state === 'lying'), 'four parts, lying out on the islands');
  check(new Set(Object.values(Fg.parts).map((k) => k.island)).size === 4, '...one on each');
  const stand = () => g.at(F.stand.x - 1.6, F.stand.z + 0.3, F.stand.x, F.stand.z);
  stand();
  check(g.me.prompt && /0 of 4/.test(g.me.prompt.text), `the stand: "${g.me.prompt && g.me.prompt.text}"`);
  let first = true;
  for (const [id, k] of Object.entries(Fg.parts)) {
    g.me.pos.x = k.x; g.me.pos.z = k.z; g.me.pos.y = k.y + 0.05; g.step({}, 3);
    check(k.state === 'carried' && k.by === 'p1', `walk over the ${id}: you carry it`);
    if (first) {
      first = false;
      const obj = g.sim.objective ? g.sim.objective('p1') : null;
      stand();
      check(g.me.prompt && /put the .* on the stand/.test(g.me.prompt.text), `back at the stand: "${g.me.prompt && g.me.prompt.text}"`);
    }
    stand(); g.use();
    check(k.state === 'placed', `...and onto the stand`);
  }
  check(g.log.some((e) => e.type === 'warHammerBuilt'), 'all four: the War Hammer is whole');
  stand();
  check(g.me.prompt && /take a War Hammer/.test(g.me.prompt.text), `"${g.me.prompt && g.me.prompt.text}"`);
  g.use(); g.step({}, 30);
  check(g.me.loadout.slots.some((s) => s.id === 'War Hammer'), 'you take one');
  stand();
  check(g.me.prompt && !/Press/.test(g.me.prompt.text), `one each: "${g.me.prompt && g.me.prompt.text}"`);
  const before = g.me.loadout.slots.filter((s) => s.id === 'War Hammer').length;
  g.use(); g.step({}, 5);
  check(g.me.loadout.slots.filter((s) => s.id === 'War Hammer').length === before, '...and not a second');
  // a teammate gets their own
  const b = g.sim.addPlayer('p2', 'B', { character: 'ryan' });
  b.pos.x = F.stand.x + 1.6; b.pos.z = F.stand.z + 0.3; b.pos.y = F.stand.y + 0.05;
  g.sim.setInput('p2', { ...emptyCommand(), use: true, usePressed: true, yaw: Math.atan2(1.6, -0.3) }); g.sim.step(1 / 60);
  for (let i = 0; i < 30; i++) { g.sim.setInput('p2', { ...emptyCommand() }); g.sim.step(1 / 60); }
  check(b.loadout.slots.some((s) => s.id === 'War Hammer'), 'a teammate takes their own');
  // carrying a part and going down: it goes back to its shrine
  const g2 = game(9);
  const [pid, k2] = Object.entries(E(g2).forge.parts)[0];
  g2.me.pos.x = k2.x; g2.me.pos.z = k2.z; g2.me.pos.y = k2.y + 0.05; g2.step({}, 3);
  g2.me.alive = false; g2.step({}, 2);
  check(k2.state === 'lying' && k2.x === k2.home.x, `die carrying the ${pid}: it's back at its shrine`);
}

// --- each hammer's swing: plain iron as forged, its element once Pit's tempered it
{
  const g = game(5);
  {
    giveWeapon(g.sim, g.me, 'War Hammer'); g.step({}, 50);
    g.at(0, 11, 0, 30);   // south of the dais, facing south
    const near = addZ(g, 0, 12.6), mid = addZ(g, 1.5, 15);
    const n0 = g.log.length;
    swing(g);
    const L = g.log.slice(n0);
    check(near.state === 'dead' && L.some((e) => e.type === 'hammerSlam' && e.element === 'iron'), 'the War Hammer: the swing smashes the one in front of you');
    check(!L.some((e) => ['explosion', 'hammerFreeze', 'windBlast', 'hammerChain'].includes(e.type)) && mid.state !== 'dead' && !(mid.frozen > 0) && !g.sim.projectiles.length, '  ...and that\'s all: plain iron');
  }
  for (const el of ['fire', 'ice', 'wind', 'lightning']) {
    g.sim.zombies.length = 0; g.sim.projectiles.length = 0;
    giveWeapon(g.sim, g.me, HAMMER_IDS[el]); g.step({}, 50);
    g.at(0, 11, 0, 30);   // south of the dais, facing south
    let near = addZ(g, 0, 12.6), mid = addZ(g, 1.5, 15), far = addZ(g, -3, 16.5);
    let n0 = g.log.length;
    swing(g);
    let L = g.log.slice(n0);
    check(near.state === 'dead' && L.some((e) => e.type === 'hammerSlam' && e.element === el && !e.upgraded), `${el}: the swing smashes the one in front of you`);
    const goesOff = { fire: 'explosion', ice: 'hammerFreeze', wind: 'windBlast', lightning: 'hammerChain' }[el];
    check(L.some((e) => e.type === goesOff) && !g.sim.projectiles.length, `  ...its element goes off (${goesOff}), but nothing's left behind until it's tempered`);
    // tempered
    g.sim.zombies.length = 0;
    giveWeapon(g.sim, g.me, HAMMER_IDS[el] + '+'); g.step({}, 50);
    g.at(0, 11, 0, 30);
    near = addZ(g, 0, 12.6); mid = addZ(g, 1.5, 15); far = addZ(g, -3, 16.5);
    n0 = g.log.length;
    swing(g);
    L = g.log.slice(n0);
    const left = g.sim.projectiles.find((p) => p.type === { fire: 'hfire', ice: 'hice', wind: 'hwind', lightning: 'hbolt' }[el]);
    check(near.state === 'dead' && !!left, `${el}+: smashes, and leaves its ${left && left.type} behind`);
    if (el === 'fire') {
      check(L.some((e) => e.type === 'explosion' && e.etype === 'hammerFireUp'), '  fire: a burst of flame where it lands');
      const walker = addZ(g, left.pos.x + 6, left.pos.z); walker.speed = 0;
      g.step({}, 5); walker.pos.x = left.pos.x + 1; g.step({}, 10);
      check(!!walker.burn, '  ...and one that walks into the pool catches');
      g.step({}, 60 * 4);
      check(walker.state === 'dead', '  ...and burns down');
    }
    if (el === 'ice') {
      check(mid.frozen > 0 && far.frozen > 0, '  ice: everything round you frozen');
      g.step({}, 60 * 1.5);
      check(mid.state === 'dead' && far.state === 'dead' && g.log.slice(n0).some((e) => e.type === 'zombieShatter'), '  ...and the blizzard shatters what\'s in it');
      const walker = addZ(g, left.pos.x + 9, left.pos.z); g.step({}, 5); walker.frozen = 0; walker.pos.x = left.pos.x + 2; g.step({}, 5);
      check(walker.frozen > 0, '  ...one that comes into the blizzard freezes too');
      giveWeapon(g.sim, g.me, 'M1912'); g.step({}, 40);
      const ice = addZ(g, 1.5, 15); ice.frozen = 3; g.step({}, 1);   // (one frozen by the swing, away from the blizzard)
      g.sim.projectiles.length = 0;
      g.at(0, 11, 1.5, 15); g.me.pitch = -0.12;
      const n1 = g.log.length;
      g.step({ fire: true, firePressed: true }); g.step({}, 3);
      check(ice.state === 'dead' && g.log.slice(n1).some((e) => e.type === 'zombieShatter'), '  ...and one pistol round shatters one');
    }
    if (el === 'wind') {
      check(L.some((e) => e.type === 'windBlast') && mid.state === 'dead', '  wind: a gale down the line');
      const z0 = L.find((e) => e.type === 'hammerSlam').pos.z;
      const side = addZ(g, left.pos.x + 3.5, left.pos.z - 1);
      g.step({}, 60 * 2);
      check(Math.abs(left.pos.z - z0) < 0.5 && side.state === 'dead', `  ...and a whirlwind stays where it landed (${(left.pos.z - z0).toFixed(1)} m), dragging one in`);
    }
    if (el === 'lightning') {
      check(L.some((e) => e.type === 'hammerChain' && e.points.length >= 3) && far.state === 'dead', '  lightning: a bolt jumping zombie to zombie');
      const later = addZ(g, left.pos.x + 4, left.pos.z + 3);
      g.step({}, 60);
      check(later.state === 'dead' && g.log.slice(n0).some((e) => e.type === 'hammerZap'), '  ...and the ball of lightning strikes one that comes near');
    }
    g.step({}, 60 * 8);
    check(!g.sim.projectiles.some((p) => p === left), '  ...then it\'s gone');
  }
  const d = CONFIG.weapons['Fire Hammer'];
  check(d.infinite && d.noAds && !CONFIG.box.weights['Fire Hammer'], 'no ammo, no sights, never in the box');
}

// --- tempering, and a hammer you lose goes home
{
  const g = game(6);
  forgeAll(g);
  check(['wind', 'lightning', 'ice', 'fire'].every((el) => E(g).forge.hammers[el].forged), 'all four forged');
  check(g.log.some((e) => e.type === 'hammersAll'), '...Pit tells you to ring the Anvil');
  giveWeapon(g.sim, g.me, 'War Hammer'); g.step({}, 40);
  g.socket('fire'); g.use();
  check(g.me.loadout.slots[g.me.loadout.current].id === 'Fire Hammer', 'take the Fire Hammer');
  g.me.points = 6000;
  g.bench();
  check(g.me.prompt && /isn't ready/.test(g.me.prompt.text) && /craters/.test(g.me.prompt.sub || ''), `before its trial: "${g.me.prompt && g.me.prompt.text}" (${g.me.prompt && g.me.prompt.sub})`);
  g.use();
  check(!E(g).forge.work, '...Pit won\'t take it yet');
  // its trial (hammerTrials.js has its own test): the craters on the Trench Front
  for (const k of E(g).trials.fire.craters.slice(0, CONFIG.crust.trials.fire.craters)) {
    g.me.pos.x = k.x; g.me.pos.z = k.z; g.me.pos.y = k.y + 0.05; g.step({}, 3);
  }
  check(E(g).trials.fire.state === 'done', 'the Fire Hammer\'s been through the craters');
  g.bench();
  check(g.me.prompt && /temper the Fire Hammer/.test(g.me.prompt.text) && g.me.prompt.cost === null, `"${g.me.prompt && g.me.prompt.text}" (free)`);
  g.use();
  check(g.me.points === 6000 && E(g).forge.work && E(g).forge.work.kind === 'temper', 'Pit takes it to temper, for nothing');
  g.step({}, 60 * (CONFIG.crust.forge.temperTime + 1));
  check(g.me.loadout.slots.some((s) => s.id === 'Fire Hammer+'), `it comes back the ${CONFIG.weapons['Fire Hammer+'].name}`);
  // lose it: two more guns on top (and no Milton Kick) push it out
  g.me.loadout.current = g.me.loadout.slots.findIndex((s) => s.id === 'Fire Hammer+');
  giveWeapon(g.sim, g.me, 'MP41'); g.step({}, 3);
  check(!g.me.loadout.slots.some((s) => s.id === 'Fire Hammer+') && E(g).forge.hammers.fire.by === null, 'swap it out for a gun: it goes back to its socket');
  check(E(g).forge.hammers.fire.tempered, '...tempered for the next one who takes it');
}

// --- ring the Anvil: Big Evil Zach
{
  const g = game(7);
  forgeAll(g);
  g.at(0, 4.4, 0, 0);
  check(g.me.prompt && /ring the Anvil/.test(g.me.prompt.text), `at the Anvil: "${g.me.prompt && g.me.prompt.text}"`);
  g.use();
  const Z = E(g).finale;
  check(Z.state === 'descend' && g.log.some((e) => e.type === 'schnitzSays'), 'it rings; The Schnitz brings him down');
  const round = g.sim.rounds.round, toSpawn = g.sim.rounds.toSpawn;
  g.step({}, 60 * (CONFIG.crust.finale.descendTime + 0.5));
  check(Z.state === 'fight', 'he lands in the pit');
  check(g.sim.rounds.round === round && g.sim.rounds.toSpawn === toSpawn, 'the rounds stop while he\'s here');
  // bullets spark off
  giveWeapon(g.sim, g.me, 'M1912'); g.step({}, 40);
  g.me.health = g.me.maxHealth = 1e6;
  const fight = (el, n) => {
    g.giveH = HAMMER_IDS[el];
    giveWeapon(g.sim, g.me, HAMMER_IDS[el]); g.step({}, 40);
    for (let i = 0; i < n; i++) {
      // stand right in front of him
      const a = Math.atan2(g.me.pos.x - Z.pos.x, g.me.pos.z - Z.pos.z);
      g.me.pos.x = Z.pos.x + Math.sin(a) * 3.2; g.me.pos.z = Z.pos.z + Math.cos(a) * 3.2; g.me.pos.y = Z.pos.y + 0.05;
      g.me.yaw = Math.atan2(-(Z.pos.x - g.me.pos.x), -(Z.pos.z - g.me.pos.z));
      g.step({ fire: true, firePressed: true }); g.step({}, SWING);
    }
  };
  const n0 = g.log.length;
  { const r = Math.hypot(Z.pos.x, Z.pos.z) || 1; g.me.pos.x = Z.pos.x * (1 + 4.6 / r); g.me.pos.z = Z.pos.z * (1 + 4.6 / r); g.me.pos.y = Z.pos.y + 0.05; g.me.yaw = Math.atan2(-(Z.pos.x - g.me.pos.x), -(Z.pos.z - g.me.pos.z)); g.me.pitch = 0.1; }
  g.step({ fire: true, firePressed: true }); g.step({}, 3);
  g.me.pitch = 0;
  check(g.log.slice(n0).some((e) => e.type === 'zachSpark'), 'bullets spark off him');
  fight('fire', 1);
  check(g.log.some((e) => e.type === 'zachShrug') && Z.hits === 0, 'the wrong hammer: nothing');
  const order = CONFIG.crust.finale.order;
  for (let ph = 0; ph < 4; ph++) {
    fight(order[ph], Z.need);
    check(Z.state === 'kneel' || Z.state === 'freed', `phase ${ph + 1}: the ${order[ph]} hammer puts him on his knees`);
    g.step({}, 60 * (CONFIG.crust.finale.kneelTime + 0.3));
    if (ph < 3) check(Z.state === 'fight' && Z.scale < CONFIG.crust.finale.scale[ph], `...he's up, smaller (x${Z.scale})`);
  }
  check(Z.state === 'freed' && g.log.some((e) => e.type === 'schnitzTorn'), 'after the fourth: The Schnitz tears out of him');
  g.step({}, 60 * (CONFIG.crust.finale.freedTime + 1));
  check(g.log.some((e) => e.type === 'crewSays' && e.who === 'zach'), 'Zach talks: he\'s Zach again');
  check(g.log.some((e) => e.type === 'crustVictory'), 'and that\'s the map done');
}

// --- he fights back
{
  const g = game(8);
  forgeAll(g);
  g.at(0, 4.4, 0, 0); g.use();
  g.step({}, 60 * (CONFIG.crust.finale.descendTime + 0.5));
  const Z = E(g).finale;
  g.me.health = g.me.maxHealth = 1000;
  g.me.pos.x = Z.pos.x + 3.5; g.me.pos.z = Z.pos.z; g.me.pos.y = Z.pos.y + 0.05;
  g.step({}, 60 * 12);
  const hurt = g.log.filter((e) => e.type === 'playerHit').reduce((a, e) => a + e.amount, 0);
  check(g.log.some((e) => e.type === 'zachAttack') && hurt > 0, `he stomps and swipes (${Math.round(hurt)} damage)`);
  check(g.log.some((e) => e.type === 'zachSummon') || g.log.filter((e) => e.type === 'zachAttack').length < 3, 'every third attack calls his dead up');
}

console.log(fails ? `\n${fails} FAILED` : '\nall Call of the Crust egg checks passed');
process.exit(fails ? 1 : 0);
