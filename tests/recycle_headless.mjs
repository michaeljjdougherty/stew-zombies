// Far-off zombies come back near the players: a round's zombie left far from
// everyone is pulled and comes straight back up near someone (keeping its
// health), never one somebody's looking at, never a quest's own; once the round
// is down to its last few, "far" is nearer and the wait shorter.
// Run: node tests/recycle_headless.mjs
import { CONFIG } from '../src/config.js';
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const rc = CONFIG.rounds.recycle;
const near = (sim, pos) => Math.min(...sim.players.filter((p) => p.alive).map((p) => Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) + Math.abs(p.pos.y - (pos.y || 0))));

function game(map, seed = 3) {
  const sim = new GameSim({ map, seed, mode: 'zombies' });
  const me = sim.addPlayer('p1', 'Tester');
  const log = [];
  const step = (n = 1) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch }); sim.step(dt); log.push(...sim.drainEvents()); } };
  me.invulnerable = true;
  return { sim, me, log, step };
}

// wait for a round with zombies out, then take one and put it far away
function setup(map, seed) {
  const G = game(map, seed);
  const { sim, me, step } = G;
  me.health = 1e9; me.maxHealth = 1e9;
  for (let i = 0; i < 60 * 30 && !sim.zombies.some((z) => z.recycle && z.state === 'chase'); i++) { step(); me.health = 1e9; }
  return G;
}

function farSpot(sim, me, d) {
  // the farthest ground spawn (or window) from the player, at least d away
  const pts = [...sim.world.groundSpawns, ...sim.windows.map((w) => w.exterior)];
  let best = null, bd = -1;
  for (const p of pts) { const q = Math.hypot(p.x - me.pos.x, p.z - me.pos.z); if (q > bd) { bd = q; best = p; } }
  return bd >= d ? best : null;
}

for (const [name, map] of [['Call of the Crust', CRUST], ['Last Bell', SCHOOL]]) {
  const { sim, me, log, step } = setup(map, 7);
  const z = sim.zombies.find((q) => q.recycle && q.state !== 'dead');
  check(!!z, `${name}: the round's zombies are marked as ones that can be moved`);
  if (!z) continue;
  const spot = farSpot(sim, me, rc.dist + 5);
  if (!spot) { console.log(`skip ${name}: nowhere ${rc.dist + 5} m away`); continue; }
  // face away from it so it isn't in sight
  me.yaw = Math.atan2(spot.x - me.pos.x, spot.z - me.pos.z);
  z.pos.x = spot.x; z.pos.z = spot.z; z.pos.y = spot.y || 0; z.region = sim.nav.regionAt(z.pos); z.health = Math.round(z.maxHealth * 0.5);
  const hp = z.health, before = near(sim, z.pos);
  log.length = 0;
  let moved = null;
  for (let i = 0; i < 60 * (rc.time + 3) && !moved; i++) {
    // hold it there (it'd walk toward you otherwise)
    if (z.state !== 'dead') { z.pos.x = spot.x; z.pos.z = spot.z; z.pos.y = spot.y || 0; }
    step(); me.health = 1e9;
    moved = log.find((e) => e.type === 'zombieRecycled' && e.from === z.id);
  }
  check(!!moved, `${name}: a zombie left ${before.toFixed(0)} m away is pulled (after ${rc.time} s)`);
  if (moved) {
    const n = sim.zombies.find((q) => q.id === moved.to);
    check(z.state === 'dead' && log.some((e) => e.type === 'zombieRemoved' && e.id === z.id) && !log.some((e) => e.type === 'zombieKilled' && e.id === z.id), `${name}: it's gone without dying (no corpse, no kill)`);
    check(!!n && near(sim, n.pos) <= before - rc.closerBy, `${name}: and back up ${n ? near(sim, n.pos).toFixed(0) : '?'} m from you`);
    check(!!n && n.health === hp && n.recycle, `${name}: with the health it had (${n && n.health} of ${hp})`);
    check(!sim.windows.some((w) => w.queue.includes(z.id) || w.climbing === z.id), `${name}: no window still holds its place`);
  }
}

// not one you're looking at
{
  const { sim, me, log, step } = setup(CRUST, 9);
  const z = sim.zombies.find((q) => q.recycle && q.state !== 'dead');
  const spot = [...sim.world.groundSpawns, ...sim.windows.map((w) => w.exterior)].find((p) => { const d = Math.hypot(p.x - me.pos.x, p.z - me.pos.z) + Math.abs((p.y || 0) - me.pos.y); return d > rc.dist + 3 && d < rc.seenDist - 3; });
  if (z && spot) {
    log.length = 0;
    for (let i = 0; i < 60 * (rc.time + 2); i++) {
      me.yaw = Math.atan2(-(spot.x - me.pos.x), -(spot.z - me.pos.z));
      if (z.state !== 'dead') { z.pos.x = spot.x; z.pos.z = spot.z; z.pos.y = spot.y || 0; }
      step(); me.health = 1e9;
    }
    check(!log.some((e) => e.type === 'zombieRecycled' && e.from === z.id), 'one in plain sight stays put');
  } else console.log('skip in-sight check (no spot in sight range)');
}

// quest/titan zombies (not the round's own) are never moved
{
  const { sim, me, log, step } = setup(CRUST, 11);
  const z = sim.zombies.find((q) => q.recycle && q.state !== 'dead');
  const spot = farSpot(sim, me, rc.dist + 5);
  if (z && spot) {
    z.recycle = false;
    me.yaw = Math.atan2(spot.x - me.pos.x, spot.z - me.pos.z);
    log.length = 0;
    for (let i = 0; i < 60 * (rc.time + 2); i++) { if (z.state !== 'dead') { z.pos.x = spot.x; z.pos.z = spot.z; z.pos.y = spot.y || 0; } step(); me.health = 1e9; }
    check(!log.some((e) => e.type === 'zombieRecycled' && e.from === z.id), "a zombie that isn't the round's own is left alone");
  }
}

// the last few: nearer counts as far, sooner
{
  const { sim, me, log, step } = setup(SCHOOL, 13);
  const R = sim.rounds;
  R.toSpawn = 0;
  for (const q of sim.zombies.slice(1)) q.state = 'dead';
  step();
  const z = sim.zombies.find((q) => q.state !== 'dead');
  // somewhere between lastFewDist and dist away
  const pts = [...sim.world.groundSpawns, ...sim.windows.map((w) => w.exterior)].filter((p) => { const d = Math.hypot(p.x - me.pos.x, p.z - me.pos.z); return d > rc.lastFewDist + 3 && d < rc.dist - 2; });
  if (z && z.recycle && pts.length) {
    const spot = pts[0];
    me.yaw = Math.atan2(spot.x - me.pos.x, spot.z - me.pos.z);
    log.length = 0;
    let moved = null, t = 0;
    for (let i = 0; i < 60 * (rc.lastFewTime + 2) && !moved; i++, t += dt) {
      if (z.state !== 'dead') { z.pos.x = spot.x; z.pos.z = spot.z; z.pos.y = spot.y || 0; z.region = sim.nav.regionAt(z.pos); }
      step(); me.health = 1e9;
      moved = log.find((e) => e.type === 'zombieRecycled' && e.from === z.id);
    }
    check(!!moved, `the last zombie of the round, ${Math.hypot(spot.x - me.pos.x, spot.z - me.pos.z).toFixed(0)} m off, is pulled in ${t.toFixed(1)} s`);
  } else console.log('skip last-few check (no spot at the right range)');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
