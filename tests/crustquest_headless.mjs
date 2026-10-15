// Call of the Crust's Easter egg, end to end: Pit at his forge (not playable),
// the titans' cores, the four War Hammers (and tempering), the Anvil, and
// Big Evil Zach.
// Run: node tests/crustquest_headless.mjs
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
const swing = (g) => { g.step({ fire: true, firePressed: true }); g.step({}, 70); };
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
  g.step({}, 60 * (CONFIG.crust.forge.introDelay + 6));
  check(g.log.some((e) => e.type === 'crewSays' && e.who === 'pit' && /Anvil/.test(e.text)), 'Pit says hello from his bench');
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
  check(g.me.prompt && /take the Lightning Hammer/.test(g.me.prompt.text), `at its socket: "${g.me.prompt && g.me.prompt.text}"`);
  g.use();
  check(g.me.loadout.slots.some((s) => s.id === 'Lightning Hammer') && E(g).forge.hammers.lightning.by === 'p1', 'you have the Lightning Hammer');
  // a second core while he works: on the pile
}

// --- each hammer's swing
{
  const g = game(5);
  for (const el of ['fire', 'ice', 'wind', 'lightning']) {
    g.sim.zombies.length = 0;
    giveWeapon(g.sim, g.me, HAMMER_IDS[el]); g.step({}, 50);
    g.at(0, 11, 0, 30);   // south of the dais, facing south
    const near = addZ(g, 0, 12.6), mid = addZ(g, 1.5, 15), far = addZ(g, -3, 16.5);
    const n0 = g.log.length;
    swing(g);
    const L = g.log.slice(n0);
    check(near.state === 'dead' && L.some((e) => e.type === 'hammerSlam' && e.element === el), `${el}: the swing smashes the one in front of you`);
    if (el === 'fire') check(L.some((e) => e.type === 'explosion' && e.etype === 'hammerFire'), 'fire: a burst of flame where it lands');
    if (el === 'ice') {
      check(mid.frozen > 0 && far.frozen > 0, 'ice: everything round you frozen');
      const x = mid.pos.x;
      g.step({}, 30);
      check(mid.pos.x === x && mid.state !== 'dead', '...frozen solid');
      giveWeapon(g.sim, g.me, 'M1912'); g.step({}, 40);
      g.at(0, 11, 1.5, 15); g.me.pitch = -0.12;
      g.step({ fire: true, firePressed: true }); g.step({}, 3);
      check(mid.state === 'dead' && g.log.slice(n0).some((e) => e.type === 'zombieShatter'), '...and one pistol round shatters one');
    }
    if (el === 'wind') check(L.some((e) => e.type === 'windBlast') && mid.state === 'dead', 'wind: a gale down the line');
    if (el === 'lightning') check(L.some((e) => e.type === 'hammerChain' && e.points.length >= 3) && far.state === 'dead', 'lightning: a bolt jumping zombie to zombie');
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
  g.socket('fire'); g.use();
  check(g.me.loadout.slots[g.me.loadout.current].id === 'Fire Hammer', 'take the Fire Hammer');
  g.me.points = 6000;
  g.bench();
  check(g.me.prompt && /temper the Fire Hammer/.test(g.me.prompt.text) && g.me.prompt.cost === CONFIG.crust.forge.temperCost, `"${g.me.prompt && g.me.prompt.text}" (${g.me.prompt && g.me.prompt.cost})`);
  g.use();
  check(g.me.points === 1000 && E(g).forge.work && E(g).forge.work.kind === 'temper', 'Pit takes it to temper');
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
      g.step({ fire: true, firePressed: true }); g.step({}, 58);
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
