// Phase 8 headless test: Erik on the PA, the intercom, lore notes, the Stew
// song Easter egg. Run: node tests/phase8_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { RANGE } from '../src/map/range.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG } from '../src/config.js';
import { INTERCOM, NOTES, STEW_ITEMS, PA_LINES, SONG_LYRICS, SONG_BEATS } from '../src/lore/erik.js';
import { SONG_SECONDS } from '../src/sim/interactables/lore.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

function game(seed = 3, { god = true, open = true, map = SCHOOL, mode = 'zombies', calm = false } = {}) {
  const sim = new GameSim({ map, seed, mode });
  const me = sim.addPlayer('p1', 'Tester');
  me.points = 1e6;
  if (god) me.health = me.maxHealth = 1e9;
  if (open) for (const d of sim.world.doors) sim.openDoor(d.id);
  const log = [];
  const step = (patch = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch });
      sim.step(dt);
      if (calm) sim.zombies.length = 0; // nobody shoving the tester around
      for (const e of sim.drainEvents()) log.push(e);
    }
  };
  const place = (x, z, yaw = 0, pitch = 0, y = 0) => { me.pos.x = x; me.pos.z = z; me.pos.y = y; me.vel.x = me.vel.z = 0; me.yaw = yaw; me.pitch = pitch; step({}, 2); };
  // stand ~0.85 m from a spot, facing it, from whichever side is free
  const approach = (spot, id) => {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      for (const r of [0.8, 1.0, 0.65]) {
        const x = spot.x + Math.sin(a) * r, z = spot.z + Math.cos(a) * r;
        const yaw = Math.atan2(x - spot.x, z - spot.z); // facing the spot: forward = (-sin, -cos)
        place(x, z, yaw, 0, spot.standY || 0);
        if (me.useTarget && me.useTarget.id === id) return true;
      }
    }
    return false;
  };
  return { sim, me, log, step, place, approach };
}
const said = (log, cat) => log.filter((e) => e.type === 'erikSays' && (!cat || e.cat === cat));

// --- 1. Intro over the PA when round 1 starts
{
  const { sim, log, step } = game(5, { open: false });
  step({}, 60 * 12);
  const intro = said(log, 'intro');
  check(intro.length === 1, 'Erik says one intro line in the first round');
  check(intro[0] && PA_LINES.intro.includes(intro[0].text), 'the intro line comes from the script');
  check(intro[0] && intro[0].lead === 1 && intro[0].dur > 2, 'PA lines start with the chime and take time to say');
  check(!!sim.pa.speaking || sim.pa.lines === 1, 'the PA tracks who is talking');
}

// --- 2. Talking never changes the game's randomness
{
  const a = game(77, { open: false }), b = game(77, { open: false });
  b.sim.pa.enabled = false;
  a.step({}, 60 * 40); b.step({}, 60 * 40);
  const pos = (s) => s.zombies.map((z) => `${z.id}:${z.pos.x.toFixed(3)},${z.pos.z.toFixed(3)}`).join('|');
  check(said(a.log).length >= 1 && said(b.log).length === 0, 'one game has Erik, the other is silent');
  check(pos(a.sim) === pos(b.sim) && a.sim.zombies.length > 0, 'zombies are identical with and without the PA');
}

// --- 3. Power, milestones, game over
{
  const { sim, log, step } = game(9);
  step({}, 60 * 8); // let the intro play out
  sim.turnOnPower(sim.players[0]);
  step({}, 60 * 12);
  check(said(log, 'power').length === 1, 'Erik complains when the power comes on');
}
{
  const { sim, me, log, step } = game(10, { god: false });
  step({}, 60);
  me.health = 1;
  sim.perkBuys = {};
  // a zombie kills the player
  sim.damagePlayer(me, 500, { pos: { x: me.pos.x + 1, z: me.pos.z } });
  step({}, 60 * 12);
  const go = log.findIndex((e) => e.type === 'gameOver');
  check(go >= 0, 'the game ends');
  const line = said(log, 'gameOver');
  check(line.length === 1 && PA_LINES.gameOver.includes(line[0].text), 'Erik has the last word at game over');
  check(line.length && line[0].t === log[go].t, '...in the same tick the game ends');
}

// --- 4. The intercom in the principal's office
{
  const { sim, me, log, step, approach } = game(11, { calm: true });
  step({}, 60 * 10);
  check(approach(SCHOOL.intercom, 'use_intercom'), 'you can reach the PA microphone');
  check(/talk to Erik/.test(me.prompt && me.prompt.text), `prompt: "${me.prompt && me.prompt.text}"`);
  const n0 = log.length;
  step({ usePressed: true }); step({}, 2);
  const after = log.slice(n0);
  check(after.some((e) => e.type === 'stewSays' && e.text === INTERCOM[0].stew), 'Stew says the first line');
  step({}, 60 * 2);
  step({ usePressed: true }); step({}, 2);
  check(log.slice(n0).some((e) => e.type === 'useDenied'), 'the mic is busy while Erik answers');
  step({}, 60 * 14);
  const replies = said(log.slice(n0), 'intercom');
  check(replies.length === 1 && replies[0].text === INTERCOM[0].erik && replies[0].lead === 0, 'Erik answers live (no chime)');
  step({ usePressed: true }); step({}, 60 * 14);
  check(said(log.slice(n0), 'intercom').some((e) => e.text === INTERCOM[1].erik), 'the next press gets the next exchange');
  // run through them all; afterwards he repeats short brush-offs
  for (let i = 0; i < INTERCOM.length + 2; i++) { step({ usePressed: true }); step({}, 60 * 16); }
  const all = said(log.slice(n0), 'intercom');
  check(all.some((e) => e.text === INTERCOM[INTERCOM.length - 1].erik), 'the last exchange hints at the Easter egg');
  check(all.length >= INTERCOM.length + 1, `Erik keeps answering after the script runs out (${all.length})`);
}

// --- 5. Every note can be reached and read
{
  const { sim, me, log, step, approach } = game(12);
  for (const n of SCHOOL.notes) {
    const ok = approach(n.id === 'maddog' ? { ...n, standY: 0.9 } : n, 'note_' + n.id);
    check(ok, `note "${n.id}" can be reached`);
    if (!ok) continue;
    const n0 = log.length;
    step({ usePressed: true }); step({}, 1);
    check(log.slice(n0).some((e) => e.type === 'loreRead' && e.id === n.id), `reading "${n.id}" sends loreRead`);
  }
  check(SCHOOL.notes.length === NOTES.length, 'every note in the script is placed on the map');
}

// --- 6. The Stew song Easter egg
{
  const { sim, me, log, step, approach } = game(13);
  step({}, 60 * 10);
  for (const [i, s] of SCHOOL.stewItems.entries()) {
    const ok = approach(s, 'stew_' + s.id);
    check(ok, `Stew item "${s.id}" can be reached`);
    const n0 = log.length;
    step({ usePressed: true }); step({}, 2);
    const ev = log.slice(n0).find((e) => e.type === 'stewItem');
    check(ev && ev.count === i + 1 && ev.total === STEW_ITEMS.length, `picking it up counts ${i + 1} of ${STEW_ITEMS.length}`);
    step({ usePressed: true }); step({}, 2);
    check(log.filter((e) => e.type === 'stewItem' && e.id === s.id).length === 1, '...and only once');
  }
  check(!log.some((e) => e.type === 'stewSong'), 'the song waits a moment after the last item');
  step({}, Math.ceil(60 * (CONFIG.stewEgg.songDelay + 0.2)));
  const song = log.find((e) => e.type === 'stewSong');
  check(!!song && Math.abs(song.duration - SONG_SECONDS) < 1e-6, `the song starts (${SONG_SECONDS.toFixed(1)} s)`);
  const t0 = sim.time;
  const before = said(log).filter((e) => e.cat !== 'song').length;
  sim.turnOnPower(me); // would normally get a line
  step({}, 60 * 25);
  check(said(log, 'song').length === 1, 'Erik freaks out about the tape');
  check(said(log).filter((e) => e.cat !== 'song').length === before, 'nobody else talks over the song');
  step({}, Math.ceil(60 * (SONG_SECONDS - (sim.time - t0) + 0.5)));
  check(log.some((e) => e.type === 'stewSongEnd'), 'the song ends');
  step({}, 60 * 6);
  check(said(log, 'songEnd').length === 1, 'Erik admits it is catchy');
  check(sim.snapshot().stewEgg.found.length === 3, 'the snapshot carries the Easter egg state');
}

// --- 7. Firing range: Erik stays out of it
{
  const { log, step } = game(14, { map: RANGE, mode: 'range', open: false });
  step({}, 60 * 30);
  check(said(log).length === 0, 'no PA in the firing range');
}

// --- 8. Script sanity
{
  check(SONG_LYRICS.every((l, i) => i === 0 || l.at > SONG_LYRICS[i - 1].at) && SONG_LYRICS.at(-1).at + 8 <= SONG_BEATS, 'lyrics are in order and inside the song');
  check(Object.values(PA_LINES).every((v) => (Array.isArray(v) ? v.length : Object.keys(v).length) > 0), 'every PA category has lines');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
