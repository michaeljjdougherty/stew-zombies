// Phases 4 & 5 headless test: the full map, power, traps, perks, the Mad Dog
// Machine, last stand and revive, ground spawns, and pathing everywhere.
// Run: node tests/phase45_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG } from '../src/config.js';
import { giveWeapon } from '../src/sim/weapons.js';
import { makeZombie } from '../src/sim/zombies.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;

// ---------------------------------------------------------------------------
// 1. Map sanity
{
  const sim = new GameSim({ map: SCHOOL, seed: 1 });
  const W = sim.world;
  const inRoom = (x, z) => SCHOOL.rooms.find((r) => x > r.rect[0] && x < r.rect[2] && z > r.rect[1] && z < r.rect[3]);
  for (const w of W.windows) {
    const ext = inRoom(w.exterior.x, w.exterior.z), int = inRoom(w.interior.x, w.interior.z);
    check(!ext && int && int.id === w.room, `window ${w.id}: outside is outdoors (${ext ? ext.id : 'none'}), inside is ${int ? int.id : 'none'}`);
  }
  for (const g of W.groundSpawns) check(inRoom(g.x, g.z)?.id === g.room, `ground spawn ${g.id} inside ${g.room}`);
  // every door has a portal and every region is reachable with all doors open
  for (const d of W.doors) check(W.portals.some((p) => p.door === d.id), `door ${d.id} has a portal`);
  const adj = new Map();
  for (const p of W.portals) { (adj.get(p.a) || adj.set(p.a, []).get(p.a)).push(p.b); (adj.get(p.b) || adj.set(p.b, []).get(p.b)).push(p.a); }
  const seen = new Set(['court']); const q = ['court'];
  while (q.length) for (const n of adj.get(q.shift()) || []) if (!seen.has(n)) { seen.add(n); q.push(n); }
  check(seen.size === W.navRegions.length, `all ${W.navRegions.length} regions connected (${seen.size})`);
  // machines and wall buys aren't inside doorways or other solids' footprints
  for (const m of W.perkMachines) {
    const blocked = W.doors.some((d) => Math.abs(d.center.x - m.center.x) < d.width / 2 + 1 && Math.abs(d.center.z - m.center.z) < d.width / 2 + 1);
    check(!blocked, `perk machine ${m.perk} clear of doors (room ${m.room})`);
    check(inRoom(m.front.x, m.front.z)?.id === m.room, `perk machine ${m.perk} front is in its room`);
  }
  for (const wb of W.wallBuys) {
    const sx = wb.pos.x + wb.normal.x * 0.6, sz = wb.pos.z + wb.normal.z * 0.6;
    check(inRoom(sx, sz)?.id === wb.room || SCHOOL.rooms.find((r) => r.id === wb.room)?.outdoor || inRoom(sx, sz), `wall buy ${wb.weapon} stand point inside (${inRoom(sx, sz)?.id})`);
  }
  // nothing overlapping: rooms never overlap each other
  for (let i = 0; i < SCHOOL.rooms.length; i++) for (let j = i + 1; j < SCHOOL.rooms.length; j++) {
    const a = SCHOOL.rooms[i].rect, b = SCHOOL.rooms[j].rect;
    const ov = a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    if (ov) check(false, `rooms ${SCHOOL.rooms[i].id} and ${SCHOOL.rooms[j].id} overlap`);
  }
  check(true, `${SCHOOL.rooms.length} rooms, ${W.windows.length} windows/fences, ${W.doors.length} doors, ${W.perkMachines.length} perk machines`);
}

// ---------------------------------------------------------------------------
// Helpers for a solo game
function makeGame(seed = 7) {
  const sim = new GameSim({ map: SCHOOL, seed });
  const me = sim.addPlayer('p1', 'Tester');
  me.points = 200000;
  const log = [];
  const step = (patch = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: 0, ...patch });
      sim.step(dt);
      for (const e of sim.drainEvents()) log.push(e);
    }
  };
  const place = (x, z, lx, lz, y = 0) => { me.pos.x = x; me.pos.z = z; me.pos.y = y; me.vel.x = me.vel.z = 0; me.yaw = Math.atan2(-(lx - x), -(lz - z)); step({}, 2); };
  const use = () => { step({ usePressed: true, use: true }); step({}, 2); };
  const at = (it, y = 0) => place(it.stand.x, it.stand.z, it.pos.x, it.pos.z, y);
  return { sim, me, log, step, place, use, at };
}

// ---------------------------------------------------------------------------
// 2. Power, perks, Mad Dog, traps
{
  const { sim, me, log, step, place, use, at } = makeGame();
  for (const d of sim.world.doors) sim.openDoor(d.id);
  sim.rounds.timer = 1e9; // no zombies for now
  const perk = (id) => sim.interactables.find((i) => i.kind === 'perk' && i.m.perk === id);
  const md = sim.madDog;

  at(perk('beefcakeBroth'));
  check(/power/.test(me.prompt?.text || ''), 'perk needs power: ' + me.prompt?.text);
  use();
  check(!me.perks.length, 'no perk without power');

  const pw = sim.interactables.find((i) => i.kind === 'power');
  at(pw);
  check(/power/.test(me.prompt?.text || ''), 'power prompt: ' + me.prompt?.text);
  use();
  check(sim.power, 'power is on');
  check(log.some((e) => e.type === 'powerOn'), 'powerOn event');

  at(perk('beefcakeBroth'));
  check(/Beefcake Broth/.test(me.prompt?.text || '') && me.prompt.cost === 2500, 'beefcake prompt ' + me.prompt?.text + ' ' + me.prompt?.cost);
  const pts = me.points;
  use();
  check(me.drinking && me.drinking.perk === 'beefcakeBroth', 'drinking');
  step({ fire: true, firePressed: true }, 10);
  check(!log.some((e) => e.type === 'shot'), 'can\'t shoot while drinking');
  step({}, 150);
  check(me.perks.includes('beefcakeBroth') && me.maxHealth === 250 && me.points === pts - 2500, `beefcake: max health ${me.maxHealth}, points -${pts - me.points}`);

  // Hot Pot Hustle: half reload time
  at(perk('hotPotHustle')); use(); step({}, 150);
  me.loadout.slots[0].clip = 0;
  const n0 = log.length;
  step({ reloadPressed: true }); step({}, 2);
  const rs = log.slice(n0).find((e) => e.type === 'reloadStart');
  check(rs && Math.abs(rs.time - CONFIG.weapons.M1912.reloadEmptyTime * 0.5) < 0.01, `hot pot hustle halves reload (${rs && rs.time.toFixed(2)}s)`);
  step({}, 120);

  // Double Ladle: faster fire, double damage
  at(perk('doubleLadle')); use(); step({}, 150);
  check(me.perks.length === 3, 'three perks: ' + me.perks.join(','));
  at(perk('marathonMinestrone')); use(); step({}, 150);
  at(perk('secondHelping'));
  check(/only hold 4/.test(me.prompt?.text || ''), 'perk limit: ' + me.prompt?.text);

  // Mad Dog: feed the M1912
  at(md, 0.9);
  check(/feed M1912/.test(me.prompt?.text || '') && me.prompt.cost === 5000, 'mad dog prompt: ' + me.prompt?.text);
  giveWeapon(sim, me, 'M15'); step({}, 40);
  at(md, 0.9);
  use();
  check(md.state === 'working' && me.loadout.slots.find((s) => s.id === 'M15').away, 'M15 is in the machine');
  check(me.loadout.slots[me.loadout.current].id === 'M1912', 'switched to the pistol meanwhile');
  step({}, 60 * 4.5);
  check(md.state === 'ready', 'machine done');
  check(/Detention Hammer/.test(me.prompt?.text || ''), 'take prompt: ' + me.prompt?.text);
  use();
  const up = me.loadout.slots.find((s) => s.id === 'M15+');
  check(up && !up.away && me.loadout.slots[me.loadout.current] === up, 'got Detention Hammer in hand');
  check(CONFIG.weapons['M15+'].damage === CONFIG.weapons.M15.damage * 2, 'upgraded damage doubled');

  // upgraded ammo off the wall costs more
  const wb = sim.interactables.find((i) => i.kind === 'wallbuy' && i.wb.weapon === 'M15');
  up.reserve = 0; at(wb);
  check(/upgraded/.test(me.prompt?.text || '') && me.prompt.cost === CONFIG.madDog.ammoCost, 'upgraded ammo prompt: ' + me.prompt?.text + ' ' + me.prompt?.cost);
  use();
  check(up.reserve === CONFIG.weapons['M15+'].reserve, 'upgraded ammo refilled');

  // Double damage from Double Ladle: shoot a zombie point blank
  {
    const z = makeZombie(sim, { pos: { x: me.pos.x, z: me.pos.z - 3 }, health: 1e6, state: 'chase' });
    z.speed = 0; sim.zombies.push(z);
    me.yaw = 0; me.pitch = 0;
    me.loadout.current = me.loadout.slots.indexOf(up); me.loadout.drawTimer = 0;
    const n1 = log.length;
    for (let i = 0; i < 20 && !log.slice(n1).some((e) => e.type === 'zombieHit'); i++) step({ firePressed: true, fire: true, pitch: -0.05 }, 1), step({}, 3);
    const hit = log.slice(n1).find((e) => e.type === 'zombieHit');
    check(hit && hit.damage >= CONFIG.weapons['M15+'].damage * 2 * 0.75 * 0.99, `double ladle doubles damage (${hit && Math.round(hit.damage)} on ${hit && hit.part})`);
    z.state = 'dead'; sim.zombies.length = 0;
  }

  // Twin Stewpots: explosive rounds
  {
    giveWeapon(sim, me, 'M1912+'); step({}, 40);
    check(me.loadout.slots[me.loadout.current].id === 'M1912+' && CONFIG.weapons['M1912+'].dual, 'Twin Stewpots are dual pistols');
    const zs = [];
    for (let i = 0; i < 3; i++) { const z = makeZombie(sim, { pos: { x: me.pos.x - 0.6 + i * 0.6, z: me.pos.z - 8 }, health: 400, state: 'chase' }); z.speed = 0; zs.push(z); sim.zombies.push(z); }
    const n2 = log.length;
    for (let i = 0; i < 6; i++) { step({ firePressed: true, fire: true, pitch: -0.12 }); step({}, 6); }
    const ex = log.slice(n2).filter((e) => e.type === 'explosion' && e.etype === 'stewpot').length;
    const kills = log.slice(n2).filter((e) => e.type === 'zombieKilled').length;
    check(ex > 0 && kills >= 2, `explosive rounds: ${ex} blasts, ${kills} kills`);
    sim.zombies.length = 0;
  }

  // Electric trap
  {
    const trap = sim.traps.find((t) => t.id === 'trap_lab');
    const lever = sim.interactables.find((i) => i.kind === 'trap' && i.trap === trap);
    at(lever);
    check(/electric trap/.test(me.prompt?.text || ''), 'trap prompt: ' + me.prompt?.text);
    use();
    check(trap.state === 'active', 'trap active');
    const cx = (trap.box[0] + trap.box[2]) / 2, cz = (trap.box[1] + trap.box[3]) / 2;
    const z = makeZombie(sim, { pos: { x: cx, z: cz }, health: 1e5, state: 'chase' }); z.speed = 0; sim.zombies.push(z);
    step({}, 3);
    check(z.state === 'dead' && log.some((e) => e.type === 'zombieKilled' && e.kind === 'electric'), 'trap electrocutes a zombie');
    step({}, 60 * (CONFIG.traps.activeTime + 1));
    check(trap.state === 'cooldown', 'trap cooling down');
    step({}, 60 * (CONFIG.traps.cooldown + 1));
    check(trap.state === 'idle', 'trap ready again');
  }
}

// ---------------------------------------------------------------------------
// 3. Last stand (solo): Second Helping gets you back up; without it, game over
{
  const { sim, me, log, step, at, use } = makeGame(11);
  sim.rounds.timer = 1e9;
  const qr = sim.interactables.find((i) => i.kind === 'perk' && i.m.perk === 'secondHelping');
  at(qr);
  check(/Second Helping/.test(me.prompt?.text || '') && me.prompt.cost === 500, 'second helping works before power: ' + me.prompt?.text);
  use(); step({}, 150);
  check(me.perks.includes('secondHelping'), 'bought Second Helping');
  giveWeapon(sim, me, 'Olympus'); step({}, 40);
  sim.damagePlayer(me, 500, null);
  check(me.downed && me.alive, 'went down');
  check(me.loadout.slots.length === 1 && me.loadout.slots[0].id === 'M1912', 'last stand pistol');
  check(!me.perks.length, 'lost perks');
  step({}, 60 * 6);
  check(!me.downed && me.alive && me.loadout.slots.length === 2 && me.health === me.maxHealth, 'got back up with both weapons');
  check(!sim.gameOver, 'not game over');
  // buy it twice more, then it's sold out
  for (let i = 0; i < 2; i++) { at(qr); use(); step({}, 150); sim.damagePlayer(me, 500, null); step({}, 60 * 6); }
  at(qr);
  check(/sold out/.test(me.prompt?.text || ''), 'sold out after 3: ' + me.prompt?.text);
  sim.damagePlayer(me, 500, null);
  step({}, 2);
  check(!me.alive && sim.gameOver, 'down without Second Helping = game over');
}

// ---------------------------------------------------------------------------
// 4. Co-op revive
{
  const sim = new GameSim({ map: SCHOOL, seed: 5 });
  const a = sim.addPlayer('a', 'A'), b = sim.addPlayer('b', 'B');
  sim.rounds.timer = 1e9;
  const stepBoth = (pa = {}, pb = {}, n = 1) => { for (let i = 0; i < n; i++) { sim.setInput('a', { ...emptyCommand(), yaw: a.yaw, ...pa }); sim.setInput('b', { ...emptyCommand(), yaw: b.yaw, ...pb }); sim.step(dt); sim.drainEvents(); } };
  b.pos.x = a.pos.x + 1; b.pos.z = a.pos.z;
  sim.damagePlayer(a, 500, null);
  check(a.downed && a.downed.selfRevive == null, 'co-op: A is down (bleeding out)');
  stepBoth({}, {}, 60);
  check(a.downed.bleed < CONFIG.lastStand.bleedOut - 0.9, 'bleeding');
  stepBoth({}, { use: true, usePressed: true }, 1);
  check(b.prompt && /revive/.test(b.prompt.text), 'revive prompt: ' + (b.prompt && b.prompt.text));
  stepBoth({}, { use: true }, 60 * (CONFIG.lastStand.reviveTime + 0.2));
  check(!a.downed && a.alive, 'B revived A');
  sim.damagePlayer(a, 500, null); sim.damagePlayer(b, 500, null);
  stepBoth({}, {}, 2);
  check(sim.gameOver, 'both down = game over');
}

// ---------------------------------------------------------------------------
// 5. Pathing across the whole school, with ground spawns in the Quad
{
  const { sim, me, log, step, place } = makeGame(21);
  for (const d of sim.world.doors) sim.openDoor(d.id);
  sim.rounds.round = 8; sim.rounds.phase = 'intermission'; sim.rounds.timer = 0.1;
  function survive(x, z, seconds, label, y = 0) {
    place(x, z, x, z - 1, y);
    let maxStuck = 0, maxDoorway = 0;
    const stuck = new Map(), nearDoor = new Map();
    const start = log.length;
    for (let t = 0; t < seconds * 60; t++) {
      me.maxHealth = 1e9; me.health = 1e9;
      step({}, 1);
      for (const zb of sim.zombies) {
        if (zb.state !== 'chase') continue;
        const dist = Math.hypot(zb.pos.x - me.pos.x, zb.pos.z - me.pos.z);
        const s = (zb.moveSpeed < 0.15 && dist > 2) ? (stuck.get(zb.id) || 0) + dt : 0;
        stuck.set(zb.id, s); maxStuck = Math.max(maxStuck, s);
        const inDoor = sim.world.portals.some((pt) => Math.hypot(zb.pos.x - pt.x, zb.pos.z - pt.z) < 1.6) && dist > 2.5;
        let rec = nearDoor.get(zb.id);
        if (!rec || !inDoor || dist < rec.best - 0.5) rec = { best: dist, t: 0 }; else rec.t += dt;
        nearDoor.set(zb.id, rec); maxDoorway = Math.max(maxDoorway, rec.t);
      }
    }
    const L = log.slice(start);
    const hits = L.filter((e) => e.type === 'playerHit').length;
    const rises = L.filter((e) => e.type === 'zombieRise').length;
    check(hits > 0, `${label}: zombies reached player (${hits} hits, zones ${[...sim.activeZones()].join(',')}${rises ? `, ${rises} rose from the dirt` : ''})`);
    check(maxStuck < 6, `${label}: no zombie stuck > 6s (max ${maxStuck.toFixed(1)}s)`);
    check(maxDoorway < 4, `${label}: no doorway stall > 4s (max ${maxDoorway.toFixed(1)}s)`);
    for (const zb of sim.zombies) zb.state = 'dead';
    sim.zombies.length = 0;
    for (const w of sim.windows) { w.queue.length = 0; w.climbing = null; }
    return L;
  }
  const quadLog = survive(31, 8, 90, 'the Quad');
  check(quadLog.some((e) => e.type === 'zombieRise'), 'zombies rise out of the Quad planters');
  check(quadLog.some((e) => e.type === 'zombieEnter' && /fence/.test(e.windowId)), 'zombies climb the Quad fence');
  survive(4, -64, 90, 'auditorium floor');
  survive(4, -74.5, 60, 'auditorium stage', 0.9);
  survive(32, -61, 60, 'loading dock');
  survive(31, -46.5, 60, 'kitchen');
  survive(-24, -46, 60, 'library');
  survive(-24, -40, 60, 'library aisle');
  survive(-27, -56, 60, 'band room');
  survive(-24, -20, 60, 'science lab');
  survive(-24, -6, 60, 'locker rooms');
  survive(-22, 6, 60, 'boiler room');
}

process.exit(fails ? 1 : 0);
