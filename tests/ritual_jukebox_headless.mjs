// The half-court ritual: ordinary zombies leave whoever holds the circle alone,
// the blue spirit zombies come for them. And the jukebox.
// Run: node tests/ritual_jukebox_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { spawnZombie } from '../src/sim/zombies.js';
import { worldState, applyMirror } from '../src/net/state.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const sim = new GameSim({ map: SCHOOL, seed: 9 });
const me = sim.addPlayer('p1', 'T');
me.maxHealth = me.health = 1e6;
sim.rounds.phase = 'test';
const step = (n, patch = {}) => { const ev = []; for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch }); sim.step(dt); ev.push(...sim.drainEvents()); } return ev; };

check(sim.cfg.quest.ritualCircle >= 3, `circle radius ${sim.cfg.quest.ritualCircle} m`);
const q = sim.quest; q.step = 'ritual';
const ball = q.ritual.balls[0];
q.ritual.active = ball.id; q.ritual.spawnT = 0.2; q.ritual.outside = 0;
me.pos.x = ball.x + 2.5; me.pos.z = ball.z; me.pos.y = 0;   // well inside the bigger circle
const normal = spawnZombie(sim, sim.windows[0], 3);
normal.state = 'chase'; normal.pos.x = ball.x + 5; normal.pos.z = ball.z; normal.pos.y = 0;
step(60);
check(ball.progress > 0.5, `standing ${2.5} m out still counts (progress ${ball.progress.toFixed(2)})`);
check(normal.targetId == null, 'an ordinary zombie ignores you in the circle');
const spirits = sim.zombies.filter((z) => z.ritual);
check(spirits.length > 0, `blue spirit zombies rise (${spirits.length})`);
step(240);
const chasing = sim.zombies.filter((z) => z.ritual && z.state === 'chase');
check(chasing.length > 0 && chasing.every((z) => z.targetId === 'p1'), 'spirit zombies come for you');
const fr = new GameSim({ map: SCHOOL, seed: 9 }); fr.addPlayer('p1', 'T'); fr.addPlayer('p2', 'F'); fr.replica = true;
applyMirror(fr, JSON.parse(JSON.stringify(worldState(sim))), 'p2');
check(fr.zombies.some((z) => z.ritual), 'the spirit flag reaches a friend online');
// ritual over: ordinary zombies come back for you
q.ritual.active = null;
step(30);
check(normal.targetId === 'p1', 'after the ritual, ordinary zombies chase you again');

// jukebox
const jb = sim.interactables.find((i) => i.id === 'use_jukebox');
check(!!jb && !!sim.jukebox, 'jukebox in the Teachers\' Lounge');
me.pos.x = jb.stand.x; me.pos.z = jb.stand.z;
me.yaw = Math.atan2(-(jb.pos.x - me.pos.x), -(jb.pos.z - me.pos.z)); me.pitch = -0.3;
step(3); let ev = step(1, { use: true, usePressed: true });
check(sim.jukebox.song === 0 && ev.some((e) => e.type === 'jukeboxPlay'), `plays "${sim.cfg.jukebox.songs[0].name}"`);
step(10); ev = step(1, { use: true, usePressed: true });
check(sim.jukebox.song === 1, `then "${sim.cfg.jukebox.songs[1].name}"`);
step(10); step(1, { use: true, usePressed: true });
check(sim.jukebox.song == null, 'then off');
step(10); step(1, { use: true, usePressed: true });
sim.jukebox.startedAt -= sim.cfg.jukebox.songs[0].duration + 1;
ev = step(2);
check(sim.jukebox.song == null && ev.some((e) => e.type === 'jukeboxStop'), 'stops by itself when the song ends');
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
