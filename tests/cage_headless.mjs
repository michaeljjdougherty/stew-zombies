// The Schnitz's cage on the Crust: Chops, Regs, P, James and Kyle hanging over
// the Anvil (src/render/crustCage.js), calling out what's happening below
// (src/sim/crew.js cageCall) and having words when you shoot the cage
// (src/sim/cageShot.js). Whoever's being played isn't in there.
// Run: node tests/cage_headless.mjs
import { powerAllOn } from '../src/sim/crustPower.js';
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { cageShot, cageHitAt, cageBox } from '../src/sim/cageShot.js';
import { CAGED, CAGE_SHOT, CAGE_CALLS, CAGE_TALK } from '../src/lore/crustCrew.js';
import { CONFIG } from '../src/config.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

// --- who's in there, and what they say -------------------------------------
check(['chops', 'regs', 'p', 'james', 'kyle'].every((id) => CAGED.includes(id)), 'James and Kyle are in the cage with Chops, Regs and P');
for (const id of CAGED) for (const tier of ['first', 'again', 'lots']) check(!!CAGE_SHOT[tier][id], `${id} has a "${tier}" line for being shot at`);
const talkers = new Set(CAGE_TALK.flat().map((l) => l.who));
check(talkers.has('james') && talkers.has('kyle'), 'James and Kyle chat from the cage');
const pLines = [...CAGE_TALK.flat(), ...Object.values(CAGE_CALLS).flat()].filter((l) => l.who === 'p').map((l) => l.text);
check(pLines.length >= 5 && pLines.every((t) => !/forehead|^\.\.\.(Sup|Once|Sick|Nice|No)\./i.test(t)), 'P is all about food now, no more "...Sup."');
check(CONFIG.crustFilms.intro.lines.some((l) => l.who === 'james') && CONFIG.crustFilms.intro.lines.some((l) => l.who === 'kyle'), 'the intro has James and Kyle shouting down');
check(['james', 'kyle'].every((id) => CONFIG.crustFilms.ending.crew.includes(id)), 'and they come out of the cage in the ending');

// --- you can see it from the spawn ------------------------------------------
const b = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
{
  const sim = new GameSim({ map: CRUST, seed: 3 });
  Object.assign(b, cageBox(sim));
  const sp = CRUST.playerSpawns[0], mid = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: (b.minZ + b.maxZ) / 2 };
  const eye = { x: sp.x, y: 1.9, z: sp.z };
  const d = { x: mid.x - eye.x, y: mid.y - eye.y, z: mid.z - eye.z }, L = Math.hypot(d.x, d.y, d.z);
  for (const k of 'xyz') d[k] /= L;
  const up = Math.atan2(mid.y - eye.y, Math.hypot(mid.x - eye.x, mid.z - eye.z)) * 180 / Math.PI;
  check(L < 40 && up > 10 && up < 35, `from the first spawn it's ${L.toFixed(0)} m off, ${up.toFixed(0)}° up: in view looking ahead`);
  check(cageHitAt(sim, eye, d, 200) >= 0, "and nothing's in the way: you can shoot it from the spawn");
}

// --- shooting it ----------------------------------------------------------
function game(character, seed = 5) {
  const sim = new GameSim({ map: CRUST, seed });
  powerAllOn(sim);
  const me = sim.addPlayer('p1', 'Tester', { character });
  sim.rounds.timer = 1e9;
  me.health = me.maxHealth = 1e6;
  const said = [];
  const step = (patch = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch });
      sim.step(dt);
      for (const e of sim.drainEvents()) if (e.type === 'crewSays') said.push(e);
    }
  };
  // (until nobody's talking or waiting to)
  const quiet = () => { for (let i = 0; i < 6000 && (sim.pa.speaking || sim.pa.queue.length); i++) step(); };
  return { sim, me, said, step, quiet };
}
const SHOT = new Set(Object.values(CAGE_SHOT).flatMap((t) => Object.values(t)));
{
  const { sim, me, said, step, quiet } = game('kearns');
  step({}, 30);
  // stand under it on the dais and aim up at it
  me.pos.x = -3.6; me.pos.z = 6.6; me.pos.y = CRUST.forge.y; me.vel.x = me.vel.y = me.vel.z = 0;
  step({}, 2);
  const eye = sim.eyePosition(me), mid = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: (b.minZ + b.maxZ) / 2 };
  me.yaw = Math.atan2(-(mid.x - eye.x), -(mid.z - eye.z));
  me.pitch = Math.atan2(mid.y - eye.y, Math.hypot(mid.x - eye.x, mid.z - eye.z));
  step({}, 1);
  const shot = said.length;
  step({ fire: true, firePressed: true }); step({}, 300);
  const got = said.slice(shot).filter((e) => SHOT.has(e.text));
  check(got.length === 1 && CAGED.includes(got[0].who) && got[0].live, `shoot the cage: ${got[0] && got[0].who} shouts "${got[0] && got[0].text}"`);
  // spraying it: one line per gap, and they take turns
  for (let i = 0; i < 60; i++) { step({ fire: true, firePressed: true }); step({}, 5); }
  for (let i = 0; i < 10; i++) { quiet(); sim.time += CONFIG.crust.cageShot.gap + 1; cageShot(sim, me, sim.eyePosition(me), dirTo(sim.eyePosition(me), mid)); step({}, 60); }
  const all = said.filter((e) => SHOT.has(e.text));
  check(new Set(all.map((e) => e.who)).size >= 4, `they take turns: ${[...new Set(all.map((e) => e.who))].join(', ')}`);
  check(all.some((e) => Object.values(CAGE_SHOT.lots).includes(e.text)), 'keep at it and they get properly fed up');
  check(me.alive, 'nobody got hurt');
}
function dirTo(a, c) { const d = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z }, L = Math.hypot(d.x, d.y, d.z); return { x: d.x / L, y: d.y / L, z: d.z / L }; }

// --- playing James: he isn't in the cage, so he never shouts from it ---------
{
  const { sim, me, said, step, quiet } = game('james', 9);
  step({}, 30);
  me.pos.x = -3.6; me.pos.z = 6.6; me.pos.y = CRUST.forge.y;
  step({}, 2);
  const mid = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: (b.minZ + b.maxZ) / 2 };
  for (let i = 0; i < 12; i++) { quiet(); sim.time += CONFIG.crust.cageShot.gap + 1; cageShot(sim, me, sim.eyePosition(me), dirTo(sim.eyePosition(me), mid)); step({}, 60); }
  const all = said.filter((e) => SHOT.has(e.text));
  check(all.length >= 6 && all.every((e) => e.who !== 'james'), 'playing James: the others answer, James never shouts from the cage');
}

// --- callouts: things happening below ---------------------------------------
{
  const { sim, me, said, step, quiet } = game('kearns', 11);
  sim.cfg = { ...sim.cfg, crust: { ...sim.cfg.crust, cageTalk: { ...sim.cfg.crust.cageTalk, chance: 1, first: 1e9 } } };
  step({}, 30);
  me.pos.x = -3.6; me.pos.z = 6.6; me.pos.y = CRUST.forge.y;
  step({}, 600);
  const esc = (t) => t.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
  const CALL = (kind) => CAGE_CALLS[kind].map((l) => new RegExp('^' + esc(l.text).replace(/\\\{name\\\}/g, 'Kearns').replace(/\\\{round\\\}/g, '\\d+') + '$'));
  const heard = (kind, from) => said.slice(from).some((e) => CALL(kind).some((re) => re.test(e.text)));
  // someone goes down on the Anvil
  quiet(); let at = said.length;
  sim.emit('playerDown', { playerId: me.id }); step({}, 400);
  check(heard('down', at), 'someone goes down: the cage yells about it (by name)');
  // straight after, a dry fire: too soon for another callout
  quiet(); at = said.length;
  sim.emit('dryFire', { playerId: me.id }); step({}, 300);
  check(!heard('ammo', at), 'not another one straight away (a gap between callouts)');
  sim.time += CONFIG.crust.cageTalk.callGap + 1;
  quiet(); at = said.length;
  sim.emit('dryFire', { playerId: me.id }); step({}, 400);
  check(heard('ammo', at), 'later, out of ammo: they call that out too');
  // a new round
  sim.time += CONFIG.crust.cageTalk.callGap + 1;
  quiet(); at = said.length;
  sim.emit('roundStart', { round: 4 }); step({}, 900);
  check(heard('round', at), 'a new round: they shout about it');
  // out on another island they can't be heard
  sim.time += CONFIG.crust.cageTalk.kindGap + 1;
  const isl = sim.mapData.islands.find((i) => i.id !== 'hub'), [x0, z0, x1, z1] = isl.bounds;
  me.pos.x = (x0 + x1) / 2; me.pos.z = (z0 + z1) / 2;
  quiet(); at = said.length;
  sim.emit('playerDown', { playerId: me.id }); step({}, 400);
  check(!heard('down', at), `out on the ${isl.id}: the cage can't see you, so nothing`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
