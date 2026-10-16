// Call of the Crust's dialogue: the Schnitz on the speakers, Pit at his forge,
// the crew on his walkies, the boys in the cage, Big Evil Zach. Everyone waits
// their turn (one line at a time), whoever you play talks out loud and the
// rest are on the radio. Run: node tests/crustdialogue_headless.mjs
import { CONFIG } from '../src/config.js';
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { CREW } from '../src/lore/crew.js';
import * as L from '../src/lore/crustCrew.js';
import { startFinale } from '../src/sim/zachBoss.js';
import { powerAllOn } from '../src/sim/crustPower.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

// --- the lines themselves: everyone's a real speaker, nothing's empty
{
  const all = [];
  const walk = (v, ctx) => {
    if (typeof v === 'string') all.push({ who: ctx, text: v });
    else if (Array.isArray(v)) v.forEach((x) => walk(x, ctx));
    else if (v && typeof v === 'object' && 'text' in v) all.push({ who: v.who, text: v.text });
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, CREW[k] ? k : ctx);
  };
  for (const k of ['CRUST_REACT', 'CRUST_RADIO', 'CRUST_FELL', 'CRUST_TALKS', 'CRUST_BANTER', 'CAGE_TALK']) walk(L[k], null);
  walk(L.SCHNITZ_PA, 'schnitz'); walk(L.SCHNITZ_ROASTS, 'schnitz'); walk(L.ZACH_TAUNTS, 'schnitz');
  const bad = all.filter((l) => !l.text || !l.text.trim() || !(CREW[l.who] || l.who === 'schnitz'));
  check(bad.length === 0, `${all.length} lines, every one said by someone real (${bad.map((b) => b.who + ': ' + b.text).slice(0, 3).join(' | ')})`);
  const speakers = new Set(all.map((l) => l.who));
  for (const w of ['kearns', 'ryan', 'rocco', 'brian', 'pit', 'chops', 'regs', 'p', 'schnitz']) check(speakers.has(w), `${w} has Crust lines`);
}

function game(seed = 2, character = 'kearns', map = CRUST) {
  const sim = new GameSim({ map, seed });
  const me = sim.addPlayer('p1', 'Tester', { character });
  me.health = me.maxHealth = 1e6;
  const said = [];
  const step = (secs) => {
    for (let i = 0; i < secs * 60; i++) {
      me.health = me.maxHealth;
      sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch });
      sim.step(dt);
      for (const e of sim.drainEvents()) if (e.type === 'crewSays' || e.type === 'schnitzSays' || e.type === 'erikSays') said.push({ t: sim.time, who: e.type === 'schnitzSays' ? 'schnitz' : e.type === 'erikSays' ? 'erik' : e.who, text: e.text, radio: !!e.radio, live: !!e.live, dur: e.dur });
    }
  };
  return { sim, me, said, step };
}
const has = (said, text) => said.some((s) => s.text === text);

// --- the opening: the Schnitz, then Pit, then everyone checks in
{
  const g = game(2, 'kearns');
  g.step(150);
  const first = g.said[0];
  check(first && first.who === 'schnitz' && L.SCHNITZ_PA.intro.includes(first.text), `the Schnitz welcomes you first: "${first && first.text}"`);
  check(g.said.some((s) => s.who === 'pit' && /relay/.test(s.text)), 'Pit tells you about the relays');
  const intro = L.CRUST_TALKS.intro;
  const heard = intro.filter((l) => has(g.said, l.text));
  check(heard.length === intro.length, `the whole check-in (${heard.length} of ${intro.length} lines)`);
  const mine = g.said.find((s) => s.who === 'kearns');
  check(mine && !mine.radio, 'your own character (Kearns) talks out loud');
  const ryan = g.said.find((s) => s.who === 'ryan');
  check(ryan && ryan.radio, '...the others are on the walkie');
  const chops = g.said.find((s) => s.who === 'chops');
  check(chops && chops.live && !chops.radio, '...the boys in the cage shout (no walkie)');
  // nobody talks over anybody
  let overlap = 0;
  for (let i = 1; i < g.said.length; i++) if (g.said[i].t < g.said[i - 1].t + g.said[i - 1].dur - 0.05) overlap++;
  check(overlap === 0, `one line at a time (${g.said.length} lines, ${overlap} overlapping)`);
  check(!g.said.some((s) => s.who === 'erik'), 'no Erik out here');
}

// --- the beats
{
  const g = game(3, 'ryan');
  powerAllOn(g.sim);
  g.sim.rounds.timer = 1e9;   // (just the talk: no zombies crowding you)
  g.step(150);   // (past the opening)
  const beats = [
    ['relayPulled', { id: 'relay_n', playerId: 'p1' }, 'relay'],
    ['islandPower', { island: 'hub', pos: { x: 0, z: 0 } }, 'power'],
    ['playerLaunch', { playerId: 'p1', from: { x: 0, z: -28 }, to: { x: 0, z: -114 } }, 'launch'],
    ['playerLaunchLand', { playerId: 'p1', pos: { x: 0, y: 0.8, z: -114 } }, 'land_ship'],
    ['partPicked', { id: 'haft', playerId: 'p1' }, 'part'],
    ['warHammerBuilt', { playerId: 'p1' }, 'hammer'],
    ['titanWake', { id: 'research', playerId: 'p1' }, 'wake_research'],
    ['titanDown', { id: 'research', name: 'The Warden' }, 'down_research'],
    ['hammerForged', { element: 'lightning', count: 1 }, 'forged'],
    ['hammersAll', {}, 'allForged'],
    ['shellIncoming', { pos: { x: 0, z: 140 } }, 'shells'],
    ['rideStart', { playerId: 'p1', kind: 'zip', ride: 'zip_caves' }, 'zip'],
  ];
  for (const [type, data, key] of beats) {
    g.sim.emit(type, data);
    g.step(40);
    const talk = L.CRUST_TALKS[key];
    const heard = talk.filter((l) => has(g.said, l.text)).length;
    check(heard === talk.length, `${type}: the "${key}" conversation (${heard} of ${talk.length})`);
  }
  // each beat only once
  const before = g.said.length;
  g.sim.emit('relayPulled', { id: 'relay_e', playerId: 'p1' });
  g.step(20);
  check(!g.said.slice(before).some((s) => L.CRUST_TALKS.relay.some((l) => l.text === s.text)), 'a beat\'s conversation only happens once');
}

// --- the boys in the cage shout down when you're up near it
{
  const g = game(4, 'rocco');
  g.step(150);
  const cage = CRUST.forge.cage;
  g.me.pos.x = cage.x; g.me.pos.z = cage.z + 14; g.me.pos.y = 9; g.me.region = null;
  const n = g.said.length;
  g.step(CONFIG.crust.cageTalk.every[1] + 10);
  const cageLines = new Set(L.CAGE_TALK.flat().map((l) => l.text));
  check(g.said.slice(n).some((s) => cageLines.has(s.text)), 'near the cage: Chops, Regs or P shout down');
}

// --- somebody goes over the edge
{
  const g = game(5, 'brian');
  g.step(150);
  const n = g.said.length;
  g.sim.emit('playerFell', { playerId: 'p1' });
  g.step(20);
  const after = g.said.slice(n);
  check(after.some((s) => s.who === 'schnitz' && L.SCHNITZ_PA.fell.includes(s.text)), 'the Schnitz notices');
  check(after.some((s) => L.CRUST_FELL.some((l) => l.text === s.text && l.who !== 'brian')), '...and someone else says so on the walkie');
}

// --- Big Evil Zach taunts you through the fight
{
  const g = game(6, 'kearns');
  powerAllOn(g.sim);
  g.step(150);
  startFinale(g.sim);
  g.step(CONFIG.crust.finale.descendTime + CONFIG.crust.zachTaunt[1] + 12);
  check(g.said.some((s) => s.who === 'schnitz' && L.ZACH_TAUNTS.includes(s.text)), 'the Schnitz taunts you through Zach');
  check(L.CRUST_TALKS.zach.every((l) => has(g.said, l.text)), 'the crew see Zach come down');
}

// --- the map: somewhere new, the island you're on
{
  const g = game(8, 'rocco');
  powerAllOn(g.sim);
  g.step(150);
  const go = (x, z, y) => { g.me.pos.x = x; g.me.pos.z = z; g.me.pos.y = y; g.me.region = null; g.me.launch = null; };
  // up the lighthouse (the gallery), onto the galleon
  for (const [zone, x, z, y] of [['lighthouseGallery', -37, -188, 9.3], ['galleon', 12, -157, 3.45], ['cavern', -152, 0, 1.0]]) {
    go(x, z, y);
    g.step(0.2);
    const there = g.sim.zoneOf(g.me.pos, g.me.region);
    g.step(14);
    const line = L.CRUST_PLACES[zone].rocco;
    check(there === zone && has(g.said, line), `${zone}: Rocco says "${line}" (in ${there})`);
  }
  // no school lines out here
  const crustText = new Set();
  const walk = (v) => { if (typeof v === 'string') crustText.add(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  for (const k of Object.keys(L)) walk(L[k]);
  walk(CONFIG.crustFilms);
  for (const k of ['PIT_FORGE', 'PIT_POWER', 'PIT_SHOT']) walk((await import('../src/lore/crew.js'))[k]);
  const stray = g.said.filter((s) => !crustText.has(s.text));
  check(stray.length === 0, `every line said out here is a Crust line (${stray.map((s) => s.text).slice(0, 2).join(' | ')})`);
  // a round starting with everyone on the Ship Graveyard: the Schnitz and the crew talk about it (sometimes)
  go(0, -114, 0.8);
  let heardIsland = false;
  for (let r = 0; r < 14 && !heardIsland; r++) {
    g.sim.emit('roundStart', { round: 40 + r });
    g.step(25);
    heardIsland = g.said.some((s) => L.SCHNITZ_PA.island.ship.includes(s.text) || Object.values(L.CRUST_ISLAND_REACT.ship).flat().includes(s.text));
  }
  check(heardIsland, 'a round on the Ship Graveyard: someone talks about the Graveyard');
}

// --- the school's the same as ever: Erik on the PA, the old check-in
{
  const g = game(7, 'kearns', SCHOOL);
  g.step(60);
  check(g.said.some((s) => s.who === 'erik'), 'the school: Erik\'s still on the PA');
  check(!g.said.some((s) => s.who === 'schnitz' || L.CRUST_TALKS.intro.some((l) => l.text === s.text)), '...and none of the Crust\'s lines');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
