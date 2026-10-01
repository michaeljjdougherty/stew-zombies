// Phase 3 headless test: every weapon fires, reloads and behaves; grenades,
// explosions, crawlers, dual wield, burst, shell reloads, projectiles.
// Run: node tests/phase3_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { giveWeapon } from '../src/sim/weapons.js';
import { spawnZombie } from '../src/sim/zombies.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

function setup(seed = 7) {
  const sim = new GameSim({ map: SCHOOL, seed });
  const me = sim.addPlayer('p1', 'T');
  me.maxHealth = me.health = 1e6;
  sim.rounds.phase = 'test'; // stop the round manager from spawning
  return { sim, me };
}
function run(sim, me, n, patch = {}) {
  const ev = [];
  for (let i = 0; i < n; i++) {
    sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...(typeof patch === 'function' ? patch(i) : patch) });
    sim.step(dt);
    ev.push(...sim.drainEvents());
  }
  return ev;
}
// Put a still zombie in front of the player (facing them).
function dummy(sim, me, dist = 6, hp = 1e6) {
  const win = sim.windows[0];
  const z = spawnZombie(sim, win, 1);
  z.state = 'chase'; z.speed = 0; z.health = z.maxHealth = hp;
  z.pos.x = me.pos.x; z.pos.z = me.pos.z - dist; z.pos.y = 0; z.yaw = 0;
  const qi = win.queue.indexOf(z.id); if (qi >= 0) win.queue.splice(qi, 1);
  z.attack.phase = 'recover'; z.attack.t = 1e9; // never swings
  return z;
}
function aimAt(me, sim, z, y = 1.25) {
  const eye = sim.eyePosition(me);
  const dx = z.pos.x - eye.x, dz = z.pos.z - eye.z, dy = z.pos.y + y - eye.y;
  me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}

// --- every weapon: empty a magazine, reload, verify ammo bookkeeping
const ids = Object.keys((await import('../src/config.js')).CONFIG.weapons);
for (const id of ids) {
  const { sim, me } = setup();
  me.pos.x = 0; me.pos.z = 4;
  const z = dummy(sim, me, 6);
  giveWeapon(sim, me, id);
  const def = sim.cfg.weapons[id];
  run(sim, me, Math.ceil(def.drawTime * 60) + 2);
  aimAt(me, sim, z);
  const startReserve = me.loadout.slots[me.loadout.current].reserve;
  let shots = 0, hits = 0, explosions = 0;
  // hold fire (and the left trigger for dual wield) long enough to empty the mag(s)
  const evs = run(sim, me, 60 * 22, (i) => ({ fire: true, firePressed: i % 2 === 0, ads: !!def.dual, adsPressed: def.dual && i % 2 === 1 }));
  for (const e of evs) { if (e.type === 'shot') shots++; if (e.type === 'zombieHit') hits++; if (e.type === 'explosion') explosions++; }
  const slot = me.loadout.slots[me.loadout.current];
  const mags = def.dual ? 2 : 1;
  const expectShots = Math.min(def.magSize * mags + startReserve, def.magSize * mags * 2);
  check(shots >= def.magSize * mags, `${id}: fired ${shots} shots (mag ${def.magSize}${def.dual ? ' x2' : ''}), hit ${hits}${explosions ? ', ' + explosions + ' explosions' : ''}`);
  check(hits > 0, `${id}: hit the target`);
  // (holding fire interrupts shell reloads as soon as a shell is in, so count shells for those)
  const reloads = evs.filter((e) => e.type === (def.reloadStyle === 'shell' ? 'reloadShell' : 'reloadDone')).length;
  check(reloads >= 1, `${id}: reloaded (${reloads}x ${def.reloadStyle === 'shell' ? 'shells' : ''}, style ${def.reloadStyle})`);
  const total = slot.clip + (slot.clipL || 0) + slot.reserve;
  check(total === def.magSize * mags + startReserve - shots, `${id}: ammo adds up (${total} left)`);
  void expectShots;
}

// --- burst: one click = 3 shots
{
  const { sim, me } = setup();
  giveWeapon(sim, me, 'M17'); run(sim, me, 60);
  const evs = run(sim, me, 30, (i) => ({ firePressed: i === 0, fire: i < 2 }));
  check(evs.filter((e) => e.type === 'shot').length === 3, 'M17 burst fires exactly 3 rounds per click');
}

// --- shell reload can be interrupted by firing
{
  const { sim, me } = setup();
  giveWeapon(sim, me, 'Staykout'); run(sim, me, 60);
  run(sim, me, 60 * 3, (i) => ({ firePressed: i % 30 === 0, fire: i % 30 === 0 }));   // fire a few
  const slot = me.loadout.slots[me.loadout.current];
  slot.clip = 2;
  run(sim, me, 2, { reloadPressed: true });
  run(sim, me, 60);                              // a shell or two goes in
  const mid = slot.clip;
  const evs = run(sim, me, 3, { firePressed: true, fire: true });
  check(mid > 2 && evs.some((e) => e.type === 'reloadCancel') && evs.some((e) => e.type === 'shot'), `Staykout shell reload (${mid} in) interrupted by firing`);
}

// --- grenade: throw kills a crowd, cooked too long hurts you
{
  const { sim, me } = setup();
  me.pos.x = 0; me.pos.z = 6; me.yaw = 0; me.pitch = 0.1;
  const zs = [0, 1, 2, 3, 4].map((i) => dummy(sim, me, 30, 300));
  const before = me.grenades;
  run(sim, me, 1, { grenadePressed: true, grenade: true });
  run(sim, me, 20, { grenade: true });
  let evs = run(sim, me, 60 * 1.5);
  // crowd the zombies around wherever it landed
  const g = sim.projectiles.find((p) => p.type === 'frag');
  zs.forEach((z, i) => { z.pos.x = g.pos.x + Math.cos(i * 1.3) * 1.6; z.pos.z = g.pos.z + Math.sin(i * 1.3) * 1.6; });
  evs = evs.concat(run(sim, me, 60 * 2));
  const killed = evs.filter((e) => e.type === 'zombieKilled').length;
  check(me.grenades === before - 1, `grenade used (${before} -> ${me.grenades})`);
  check(evs.some((e) => e.type === 'explosion'), 'grenade exploded');
  check(killed >= 3, `grenade killed ${killed}/5 zombies`);
  void zs;
  const hp = me.health;
  run(sim, me, 1, { grenadePressed: true, grenade: true });
  run(sim, me, 60 * 3.2, { grenade: true });
  check(me.health < hp, `holding a grenade too long hurts (took ${(hp - me.health).toFixed(0)})`);
}

// --- explosions make crawlers sometimes
{
  let crawlers = 0;
  for (let seed = 1; seed < 30; seed++) {
    const { sim, me } = setup(seed);
    me.pos.z = 6;
    const z = dummy(sim, me, 5, 2000);
    const { explode } = await import('../src/sim/projectiles.js');
    explode(sim, { x: z.pos.x, y: 0.3, z: z.pos.z + 1 }, 'frag', 'p1');
    if (z.crawler) crawlers++;
  }
  check(crawlers > 3, `explosions turned ${crawlers}/29 tough zombies into crawlers`);
}

// --- crossbow bolt sticks then explodes
{
  const { sim, me } = setup();
  me.pos.z = 4;
  const z = dummy(sim, me, 8, 200);
  giveWeapon(sim, me, 'Kross-Bow'); run(sim, me, 60);
  aimAt(me, sim, z);
  const evs = run(sim, me, 90, (i) => ({ firePressed: i === 0, fire: i === 0 }));
  const stick = evs.find((e) => e.type === 'projectileStick');
  const boom = evs.find((e) => e.type === 'explosion');
  check(stick && stick.zombieId === z.id, 'crossbow bolt stuck in the zombie');
  check(boom && boom.t - stick.t > 0.9, `bolt exploded ${(boom ? boom.t - stick.t : 0).toFixed(2)}s after sticking`);
}

// --- grenade launcher hurts you up close
{
  const { sim, me } = setup();
  me.pos.z = 0; me.pos.x = 0;
  giveWeapon(sim, me, 'China Pond'); run(sim, me, 60);
  me.yaw = 0; me.pitch = -1.2;   // shoot at your own feet
  const hp = me.health;
  run(sim, me, 30, (i) => ({ firePressed: i === 0, fire: i === 0 }));
  check(me.health < hp, `China Pond at point blank hurts the shooter (took ${(hp - me.health).toFixed(0)})`);
}

// --- ballistic knife: one-hit kill early, stronger knife while held
{
  const { sim, me } = setup();
  me.pos.z = 4;
  const z = dummy(sim, me, 7, 400);
  giveWeapon(sim, me, 'Ballistik Knife'); run(sim, me, 60);
  aimAt(me, sim, z);
  const evs = run(sim, me, 60, (i) => ({ firePressed: i === 0, fire: i === 0 }));
  check(evs.some((e) => e.type === 'zombieKilled'), 'ballistik knife blade kills a round-4 zombie in one hit');
  const z2 = dummy(sim, me, 1.2, 280);
  aimAt(me, sim, z2);
  const ev2 = run(sim, me, 40, (i) => ({ meleePressed: i === 0 }));
  check(ev2.some((e) => e.type === 'zombieKilled'), 'knife with the ballistik knife out one-shots a 280hp zombie (normal knife does 150)');
}

// --- frag wall buy and round refill
{
  const { sim, me } = setup();
  me.points = 5000;
  const wb = sim.interactables.find((i) => i.kind === 'wallbuy' && i.wb.weapon === 'frag');
  me.pos.x = wb.stand.x; me.pos.z = wb.stand.z; me.yaw = Math.atan2(-(wb.pos.x - me.pos.x), -(wb.pos.z - me.pos.z));
  run(sim, me, 2);
  check(me.prompt && /Frag/.test(me.prompt.text), 'frag wall buy prompt: ' + (me.prompt && me.prompt.text));
  run(sim, me, 1, { usePressed: true, use: true });
  check(me.grenades === 4 && me.points === 4750, `bought frags (${me.grenades}, ${me.points} pts)`);
  me.grenades = 0;
  sim.rounds.phase = 'intermission'; sim.rounds.timer = 0;
  run(sim, me, 2);
  check(me.grenades === 4, 'grenades refilled at the start of the round');
}

process.exit(fails ? 1 : 0);
