// Wall buys: wall guns, their ammo, wall grenades, doors and debris all count
// towards the "Wall buys" column on the scoreboard and the career stat.
// Run: node tests/wallbuys_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { Career } from '../src/career/career.js';
import { CareerTracker } from '../src/career/tracker.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const use = { usePressed: true, use: true };

const sim = new GameSim({ map: SCHOOL, seed: 7 });
const me = sim.addPlayer('p1', 'T');
sim.rounds.phase = 'test';
check(me.wallBuys === 0, 'a new player starts on 0 wall buys');
me.points = 1e6;

// a wall gun, then its ammo
const gun = sim.interactables.find((i) => i.kind === 'wallbuy' && !sim.cfg.equipment[i.wb.weapon]);
gun.use(sim, me, use);
check(me.wallBuys === 1, `buying ${gun.wb.weapon} off the wall counts (${me.wallBuys})`);
const s = gun.owned(me); s.clip = 0;
gun.use(sim, me, use);
check(me.wallBuys === 2, 'buying its ammo counts too');
gun.use(sim, me, use);
check(me.wallBuys === 2, 'ammo already full: nothing bought, nothing counted');

// wall grenades
const frag = sim.interactables.find((i) => i.kind === 'wallbuy' && i.wb.weapon === 'frag');
me.grenades = 0;
frag.use(sim, me, use);
check(me.wallBuys === 3, 'wall grenades count');

// a door and some debris
const door = sim.interactables.find((i) => i.door && i.kind === 'door' && !i.door.locked);
const debris = sim.interactables.find((i) => i.door && i.kind === 'debris' && !i.door.locked);
door.use(sim, me, use);
debris.use(sim, me, use);
check(me.wallBuys === 5, `opening a door and clearing debris both count (${me.wallBuys})`);

// can't afford it: no count
me.points = 0;
const gun2 = sim.interactables.find((i) => i.kind === 'wallbuy' && !sim.cfg.equipment[i.wb.weapon] && i !== gun);
gun2.use(sim, me, use);
check(me.wallBuys === 5, "can't afford it: not counted");

// the career stat follows the same events, for the local player only
const L = new Career({}, { fetchFn: null, storage: { getItem: () => null, setItem() {} } });
await L.signIn('Tester');
const T = new CareerTracker(L);
const fake = { mode: 'zombies', rounds: { round: 1 }, playerById: () => ({ id: 'p1', alive: true, loadout: { slots: [] } }) };
T.tick(fake, 'p1', 0.1);
T.onEvent({ type: 'wallBuy', playerId: 'p1', weapon: 'M14', ammo: false }, fake, 'p1');
T.onEvent({ type: 'wallBuy', playerId: 'p1', weapon: 'M14', ammo: true }, fake, 'p1');
T.onEvent({ type: 'doorOpened', id: 'd1', kind: 'debris', playerId: 'p1' }, fake, 'p1');
T.onEvent({ type: 'wallBuy', playerId: 'p2', weapon: 'M14' }, fake, 'p1');
T.onEvent({ type: 'doorOpened', id: 'd2', kind: 'gate', playerId: null }, fake, 'p1');
check(L.profile.stats.wallBuys === 3, `career Wall buys: yours count, a teammate's and the quest's don't (${L.profile.stats.wallBuys})`);

process.exit(fails ? 1 : 0);
