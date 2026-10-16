// GobbleGum (src/sim/gums.js): the machines (one beside each perk machine,
// escalating cost, 3 a round, Megas used up as they come out), the four kinds
// of gum, and what every one of the 64 does. Also Mad Dog'd guns' bite
// (alternate ammo) and the career side (Divinium, Megas, the pack).
// Run: node tests/gums_headless.mjs
import { CONFIG } from '../src/config.js';
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { CRUST } from '../src/map/crust.js';
import { emptyCommand } from '../src/sim/player.js';
import { makeZombie, damageZombie } from '../src/sim/zombies.js';
import { givePerk } from '../src/sim/perks.js';
import { giveWeapon } from '../src/sim/weapons.js';
import { revive } from '../src/sim/laststand.js';
import { chewGum, useGum, gumOn, GumMachineInteractable, aatOnHit } from '../src/sim/gums.js';
import { Career, cleanPack } from '../src/career/career.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const GG = CONFIG.gobblegum;

function game({ map = SCHOOL, players = 1, gums = null } = {}) {
  const sim = new GameSim({ map, seed: 9 });
  const me = sim.addPlayer('p1', 'Tester', { gums });
  const buddy = players > 1 ? sim.addPlayer('p2', 'Buddy') : null;
  sim.rounds.timer = 1e9;
  const log = [];
  const cmds = {};
  const step = (patch = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      for (const p of sim.players) sim.setInput(p.id, { ...emptyCommand(), yaw: p.yaw, pitch: p.pitch, ...(p === me ? patch : cmds[p.id] || {}) });
      sim.step(dt);
      for (const e of sim.drainEvents()) log.push(e);
    }
  };
  me.pos.x = -2; me.pos.z = 0; me.pos.y = 0; me.points = 1e6;
  if (buddy) { buddy.pos.x = 0; buddy.pos.z = -4; buddy.pos.y = 0; }
  const zombie = (x, z, hp = 500) => { const q = makeZombie(sim, { pos: { x, y: 0, z }, health: hp }); sim.zombies.push(q); return q; };
  const ev = (type, f = () => true) => log.filter((e) => e.type === type && f(e));
  return { sim, me, buddy, log, step, zombie, ev };
}
const chew = (g, id, p = g.me) => { chewGum(g.sim, p, id); return p.gum; };
const use = (g, p = g.me) => useGum(g.sim, p);

// --- the machines ---------------------------------------------------------------
for (const map of [SCHOOL, CRUST]) {
  const sim = new GameSim({ map, seed: 3 });
  const M = sim.gums.machines;
  check(M.length >= Math.min(GG.machine.perMap, sim.world.perkMachines.length) - 1 && M.length <= GG.machine.perMap, `${map.id}: ${M.length} GobbleGum machines (${sim.world.perkMachines.length} perk machines)`);
  const zones = new Set(M.map((m) => m.zone));
  check(zones.size === M.length, `${map.id}: one per area (${[...zones].join(', ')})`);
  // each one solid, standing clear of everything else, with room in front
  let clear = true;
  for (const m of M) {
    const b = sim.world.solids.find((s) => s.kind === 'gumMachine' && Math.abs((s.minX + s.maxX) / 2 - m.pos.x) < 0.01 && Math.abs((s.minZ + s.maxZ) / 2 - m.pos.z) < 0.01);
    if (!b) { clear = false; continue; }
    for (const s of sim.world.solids) if (s !== b && s.minX < b.maxX && s.maxX > b.minX && s.minZ < b.maxZ && s.maxZ > b.minZ && s.minY < b.maxY && s.maxY > b.minY) clear = false;
  }
  check(clear, `${map.id}: every machine is solid and inside nothing else`);
}

{
  const g = game({ gums: { pack: ['stockOption', 'swordFlay', 'perkaholic', 'killJoy', 'coagulant'], stock: { perkaholic: 1, killJoy: 0 } } });
  const { sim, me, step } = g;
  check(me.gumPack.length === 5 && me.gumStock.perkaholic === 1 && me.gumStock.killJoy === 0, 'you bring your pack of 5 (and how many of each Mega)');
  const m = sim.gums.machines[0];
  const it = sim.interactables.find((i) => i instanceof GumMachineInteractable && i.m === m);
  me.pos.x = m.stand.x; me.pos.z = m.stand.z; me.pos.y = m.pos.y;
  me.yaw = Math.atan2(-(m.pos.x - me.pos.x), -(m.pos.z - me.pos.z));
  step({}, 2);
  check(me.useTarget === it, 'standing at a machine, it\'s what you\'d use');
  check(me.prompt && me.prompt.cost === GG.costs[0], `the first gum of a round costs ${GG.costs[0]}`);
  const buy = () => { const pts = me.points; step({ use: true, usePressed: true }); step({}, Math.ceil(GG.dispenseTime / dt) + 2); return pts - me.points; };
  const got = [];
  const paid = [buy()];
  check(m.state === 'offering' && m.buyerId === 'p1', 'it churns, then your gum sits in the tray');
  got.push(m.gum);
  step({ use: true, usePressed: true }); step({}, 2);
  check(me.gum && me.gum.id === got[0] && m.state === 'idle', `[F] again: you chew it (${me.gum && me.gum.id})`);
  paid.push(buy()); got.push(m.gum); step({ use: true, usePressed: true }); step({}, 2);
  // (a machine can go out of order after a few; the third from another if so)
  let m2 = m;
  if (m.state === 'away') { m2 = sim.gums.machines.find((q) => q.state === 'idle'); me.pos.x = m2.stand.x; me.pos.z = m2.stand.z; me.pos.y = m2.pos.y; me.yaw = Math.atan2(-(m2.pos.x - me.pos.x), -(m2.pos.z - me.pos.z)); step({}, 2); }
  const pts = me.points; step({ use: true, usePressed: true }); step({}, Math.ceil(GG.dispenseTime / dt) + 2); paid.push(pts - me.points); got.push(m2.gum);
  step({ use: true, usePressed: true }); step({}, 2);
  check(paid.join() === GG.costs.join(), `each one costs more: ${paid.join(', ')}`);
  const before = me.points; step({ use: true, usePressed: true }); step({}, 3);
  check(me.points === before && me.gumBuys === GG.perRound && m2.state !== 'dispensing', `no 4th this round (${GG.perRound} a round)`);
  check(!got.includes('killJoy'), 'a Mega you have none of never comes out');
  const megas = g.ev('gumDispensed', (e) => e.mega);
  check(megas.every((e) => e.gum === 'perkaholic') && me.gumStock.perkaholic === 1 - megas.length, `a Mega's used up as it comes out (${megas.length} Perkaholic, ${me.gumStock.perkaholic} left)`);
  sim.emit('roundStart', { round: 2 });
  check(me.gumBuys === 0, 'a new round: back to the first price');
  // the tray empties if you leave it
  me.gumStock.perkaholic = 0;
  const idle = sim.gums.machines.find((q) => q.state === 'idle');
  me.pos.x = idle.stand.x; me.pos.z = idle.stand.z; me.pos.y = idle.pos.y; me.yaw = Math.atan2(-(idle.pos.x - me.pos.x), -(idle.pos.z - me.pos.z));
  step({}, 2); step({ use: true, usePressed: true }); step({}, Math.ceil((GG.dispenseTime + GG.offerTime) / dt) + 4);
  check(g.ev('gumExpired').length === 1 && idle.state !== 'offering', 'left in the tray too long: it\'s gone');
}

{
  // a pack of just one Mega, two of it: two come out, then none
  const g = game({ gums: { pack: ['perkaholic'], stock: { perkaholic: 2 } } });
  const { sim, me } = g;
  const m = sim.gums.machines[0];
  const it = sim.interactables.find((i) => i instanceof GumMachineInteractable && i.m === m);
  const pull = () => { it.use(sim, me, { usePressed: true }); m.timer = 0; sim.step(dt); const ok = m.state === 'offering'; it.use(sim, me, { usePressed: true }); m.state = 'idle'; return ok; };
  const a = pull(), b = pull();
  const ev = sim.drainEvents().filter((e) => e.type === 'gumDispensed');
  it.use(sim, me, { usePressed: true });
  check(a && b && ev.length === 2 && ev.every((e) => e.mega) && me.gumStock.perkaholic === 0 && m.state === 'idle' && /empty/.test(it.prompt(sim, me).text), 'Megas run out: two Perkaholics, then your pack\'s empty');
}

// --- the four kinds -----------------------------------------------------------
{
  const g = game();
  chew(g, 'stockOption');
  g.step({}, Math.ceil(GG.gums.stockOption.time / dt) + 2);
  check(!g.me.gum, `timed: Stock Option runs out after ${GG.gums.stockOption.time} s`);
  chew(g, 'alwaysDoneSwiftly');
  for (let r = 0; r < GG.gums.alwaysDoneSwiftly.rounds; r++) g.sim.emit('roundEnd', { round: r + 1 });
  check(!g.me.gum, `rounds: Always Done Swiftly lasts ${GG.gums.alwaysDoneSwiftly.rounds} rounds`);
  chew(g, 'inPlainSight');
  check(use(g) && gumOn(g.me, 'inPlainSight') && g.me.gum.uses === 1, 'activated: [H] sets In Plain Sight off (1 use left)');
  g.step({}, Math.ceil(GG.gums.inPlainSight.window / dt) + 2);
  check(g.me.gum && !gumOn(g.me, 'inPlainSight'), '...for its 10 seconds');
  use(g); g.step({}, Math.ceil(GG.gums.inPlainSight.window / dt) + 2);
  check(!g.me.gum, '...and gone when it\'s used up');
  chew(g, 'toneDeath');
  check(gumOn(g.me, 'toneDeath'), 'special: Tone Death\'s on as soon as you chew it');
  chew(g, 'coagulant');
  check(g.me.gum.id === 'coagulant' && g.sim.events.filter((e) => e.type === 'gumEnded' && e.why === 'replaced').length === 1, 'a new gum replaces the one you had');
}

// --- [H] from the controls, and online from a friend's copy ---------------------
{
  const g = game();
  chew(g, 'idleEyes');
  g.step({ gumPressed: true });
  check(g.ev('gumUsed').length === 1 && g.sim.gums.idleUntil > g.sim.time, '[H] uses it');
  const rep = new GameSim({ map: SCHOOL, seed: 9 });
  const p = rep.addPlayer('p1', 'x');
  rep.replica = true;
  chew({ sim: rep, me: p }, 'idleEyes');
  rep.setInput('p1', { ...emptyCommand(), gumPressed: true });
  rep.netOut.length = 0;
  const { updatePlayer } = await import('../src/sim/player.js');
  updatePlayer(rep, p, { ...emptyCommand(), gumPressed: true }, dt);
  check(rep.netOut.some((a) => a.k === 'gum'), 'online, a friend\'s [H] goes to the host');
}

// --- every gum -------------------------------------------------------------------
const effects = {};
const T = (id, fn, players = 1) => { effects[id] = fn; fn.players = players; };

T('alchemicalAntithesis', (g) => { chew(g, 'alchemicalAntithesis'); use(g); const s = g.me.loadout.slots[0]; s.reserve = 0; const pts = g.me.points; g.sim.addPoints(g.me, 100, 'kill'); return g.me.points === pts && s.reserve === 100 / GG.gums.alchemicalAntithesis.perAmmo; });
T('alwaysDoneSwiftly', (g) => { chew(g, 'alwaysDoneSwiftly'); giveWeapon(g.sim, g.me, 'M15'); g.step({}, 60); let n = 0; while (g.me.loadout.adsAmount < 1 && n < 200) { g.step({ ads: true }); n++; } return n < Math.ceil(CONFIG.weapons.M15.adsTime / dt) * 0.7; });
T('anywhereButHere', (g) => { chew(g, 'anywhereButHere'); const a = { ...g.me.pos }; use(g); return Math.hypot(g.me.pos.x - a.x, g.me.pos.z - a.z) > 5 && g.sim.events.some((e) => e.type === 'gumTeleport'); });
T('armamentalAccomplishment', (g) => { chew(g, 'armamentalAccomplishment'); giveWeapon(g.sim, g.me, 'M15'); g.step({}, 90); g.step({ weaponSlot: 0 }); return Math.abs(g.me.loadout.drawTimer - CONFIG.weapons[g.me.loadout.slots[0].id].drawTime * 0.5) < 0.05; });
T('armsGrace', async (g) => { chew(g, 'armsGrace', g.me); giveWeapon(g.sim, g.me, 'M15'); g.me.health = 1; g.sim.damagePlayer(g.me, 999, null); g.step({}, Math.ceil(CONFIG.lastStand.bleedOut / dt) + 5); const kept = !g.me.alive && !!g.me.armsGrace; const { respawnTheFallen } = await import('../src/sim/rounds.js'); respawnTheFallen(g.sim); return kept && g.me.alive && g.me.loadout.slots.some((s) => s.id === 'M15'); }, 2);
T('arsenalAccelerator', (g) => { chew(g, 'arsenalAccelerator'); return gumOn(g.me, 'arsenalAccelerator'); });
T('coagulant', (g) => { chew(g, 'coagulant'); g.sim.damagePlayer(g.me, 999, null); return g.me.downed && g.me.downed.bleed === CONFIG.lastStand.bleedOut * GG.gums.coagulant.bleedMult; }, 2);
T('dangerClosest', (g) => { chew(g, 'dangerClosest'); const h = g.me.health; g.sim.damagePlayer(g.me, 50, { pos: g.me.pos, explosive: true }); return g.me.health === h; });
T('firingOnAllCylinders', (g) => { chew(g, 'firingOnAllCylinders'); g.step({}, 60); g.step({ sprint: true, moveY: 1 }, 30); const c = g.me.loadout.slots[0].clip; g.step({ sprint: true, moveY: 1, fire: true, firePressed: true }, 2); return g.me.sprinting && g.me.loadout.slots[0].clip < c; });
T('impatient', (g) => { chew(g, 'impatient'); g.sim.damagePlayer(g.me, 999, null); g.step({}, Math.ceil(CONFIG.lastStand.bleedOut / dt) + 5); const dead = !g.me.alive; g.step({}, Math.ceil(GG.gums.impatient.after / dt) + 5); return dead && g.me.alive && g.ev('playerRespawn', (e) => e.impatient).length === 1; }, 2);
T('inPlainSight', (g) => { const z = g.zombie(g.me.pos.x + 6, g.me.pos.z); chew(g, 'inPlainSight'); use(g); g.step({}, 120); return Math.hypot(z.pos.x - g.me.pos.x, z.pos.z - g.me.pos.z) > 5.5 || z.state !== 'chase'; });
T('luckyCrit', (g) => { giveWeapon(g.sim, g.me, 'M15+'); const s = g.me.loadout.slots.find((q) => q.id === 'M15+'); let base = 0, lucky = 0; for (let i = 0; i < 400; i++) { g.me.aatReady = {}; const z = g.zombie(30, 30, 1e9); const n = g.log.length; aatOnHit(g.sim, z, { weapon: s.id, kind: 'bullet' }, g.me); if (g.log.length > n || g.sim.events.some((e) => e.type === 'aatProc')) base++; g.sim.events.length = 0; } chew(g, 'luckyCrit'); for (let i = 0; i < 400; i++) { g.me.aatReady = {}; const z = g.zombie(30, 30, 1e9); aatOnHit(g.sim, z, { weapon: s.id, kind: 'bullet' }, g.me); if (g.sim.events.some((e) => e.type === 'aatProc')) lucky++; g.sim.events.length = 0; } return lucky > base * 1.6; });
T('nowYouSeeMe', (g) => { chew(g, 'nowYouSeeMe', g.buddy); use(g, g.buddy); const z = g.zombie(g.me.pos.x - 3, g.me.pos.z); g.buddy.pos.x = g.me.pos.x + 10; g.step({}, 90); return z.pos.x > g.me.pos.x - 3 + 0.5; }, 2);
T('stockOption', (g) => { chew(g, 'stockOption'); g.step({}, 60); const s = g.me.loadout.slots[0], c = s.clip, r = s.reserve; g.step({ fire: true, firePressed: true }, 2); return s.clip === c && s.reserve === r - 1; });
T('swordFlay', (g) => { chew(g, 'swordFlay'); const z = g.zombie(g.me.pos.x, g.me.pos.z - 1.2, 1e6); g.me.yaw = 0; g.step({ meleePressed: true }); g.step({}, 30); return 1e6 - z.health === CONFIG.melee.damage * GG.gums.swordFlay.meleeMult; });
T('eyeCandy', (g) => { chew(g, 'eyeCandy'); use(g); return !!g.me.loadout.slots[0].camo; });
T('newtonianNegation', (g) => { chew(g, 'newtonianNegation'); const z = g.zombie(30, 30, 10); damageZombie(g.sim, z, 100, { playerId: 'p1', part: 'torso', kind: 'bullet', dir: { x: 0, y: 0, z: 1 } }); const k = g.ev('zombieKilled')[0] || g.sim.events.find((e) => e.type === 'zombieKilled'); return !!(k && k.fling && k.fling.float); });
T('projectileVomiting', (g) => { chew(g, 'projectileVomiting'); const z = g.zombie(30, 30, 10); damageZombie(g.sim, z, 100, { playerId: 'p1', part: 'torso', kind: 'explosive', dir: { x: 1, y: 0, z: 0 } }); const k = g.sim.events.find((e) => e.type === 'zombieKilled'); return !!(k && k.fling && k.fling.dist >= 10); });
T('toneDeath', (g) => { chew(g, 'toneDeath'); const z = g.zombie(30, 30, 10); damageZombie(g.sim, z, 100, { playerId: 'p1', part: 'torso', kind: 'bullet', dir: { x: 1, y: 0, z: 0 } }); return g.sim.events.some((e) => e.type === 'gumToneDeath') && g.me.gum.uses === GG.gums.toneDeath.uses - 1; });
T('aftertaste', (g) => { chew(g, 'aftertaste', g.me); givePerk(g.sim, g.me, 'doubleLadle'); g.sim.damagePlayer(g.me, 999, null); revive(g.sim, g.me, 'p2'); return g.me.perks.includes('doubleLadle'); }, 2);
T('boardGames', (g) => { const w = g.sim.windows.find((q) => q.maxBoards > 0); w.boards = 0; chew(g, 'boardGames'); const { gumOnBoard } = g; w.boards = 1; g.sim.emit('noop'); return (async () => { const m = await import('../src/sim/gums.js'); m.gumOnBoard(g.sim, g.me, w); return w.boards === w.maxBoards; })(); });
T('boardToDeath', async (g) => { const w = g.sim.windows.find((q) => q.maxBoards > 0); const z = g.zombie(w.center.x - w.normal.x * 1.5, w.center.z - w.normal.z * 1.5); chew(g, 'boardToDeath'); (await import('../src/sim/gums.js')).gumOnBoard(g.sim, g.me, w); return z.state === 'dead'; });
T('bulletBoost', (g) => { giveWeapon(g.sim, g.me, 'M15+'); const s = g.me.loadout.slots[g.me.loadout.current], a = s.aat; chew(g, 'bulletBoost'); use(g); return !!a && s.aat && s.aat !== a; });
T('burnedOut', async (g) => { const z = g.zombie(g.me.pos.x + 2, g.me.pos.z, 1e6); chew(g, 'burnedOut'); (await import('../src/sim/gums.js')).gumOnHurt(g.sim, g.me); return !!z.burn || g.sim.events.some((e) => e.type === 'gumBurst'); });
T('cratePower', async (g) => { chew(g, 'cratePower'); const id = (await import('../src/sim/gums.js')).gumUpgradeBuy(g.sim, g.me, 'M15', 'box'); return id === 'M15+' && !g.me.gum; });
T('crawlSpace', (g) => { const z = g.zombie(g.me.pos.x + 4, g.me.pos.z); chew(g, 'crawlSpace'); use(g); return z.crawler; });
T('deadOfNuclearWinter', (g) => { chew(g, 'deadOfNuclearWinter'); use(g); return g.sim.powerups.drops.some((d) => d.type === 'pressureCooker'); });
T('disorderlyCombat', (g) => { const id = g.me.loadout.slots[0].id; chew(g, 'disorderlyCombat'); const a = g.me.loadout.slots[0].id; g.step({}, Math.ceil(GG.gums.disorderlyCombat.every / dt) + 2); const b = g.me.loadout.slots[0].id; g.step({}, Math.ceil(GG.gums.disorderlyCombat.time / dt)); return a !== id && b !== a && g.me.loadout.slots[0].id === id; });
T('ephemeralEnhancement', (g) => { giveWeapon(g.sim, g.me, 'M15'); chew(g, 'ephemeralEnhancement'); use(g); const up = g.me.loadout.slots[g.me.loadout.current].id; g.step({}, Math.ceil(GG.gums.ephemeralEnhancement.window / dt) + 2); return up === 'M15+' && g.me.loadout.slots.some((s) => s.id === 'M15'); });
T('headDrama', (g) => { chew(g, 'headDrama'); return gumOn(g.me, 'headDrama'); });
T('imFeelinLucky', (g) => { chew(g, 'imFeelinLucky'); use(g); return g.sim.powerups.drops.length === 1; });
T('immolationLiquidation', (g) => { chew(g, 'immolationLiquidation'); use(g); return g.sim.powerups.drops.some((d) => d.type === 'clearanceSale'); });
T('licensedContractor', (g) => { chew(g, 'licensedContractor'); use(g); return g.sim.powerups.drops.some((d) => d.type === 'shopClass'); });
T('mindBlown', (g) => { g.me.yaw = Math.PI / 2; const z = g.zombie(g.me.pos.x - 6, g.me.pos.z); chew(g, 'mindBlown'); use(g); return z.state === 'dead'; });
T('nowhereButThere', (g) => { g.buddy.pos.x = 20; g.sim.damagePlayer(g.buddy, 999, null); chew(g, 'nowhereButThere'); use(g); return Math.hypot(g.me.pos.x - g.buddy.pos.x, g.me.pos.z - g.buddy.pos.z) < 1.5; }, 2);
T('popShocks', (g) => { const z = g.zombie(g.me.pos.x, g.me.pos.z - 1.2, 1e6), o = g.zombie(g.me.pos.x + 1.5, g.me.pos.z - 1.5, 1e6); g.me.yaw = 0; chew(g, 'popShocks'); g.step({ meleePressed: true }); g.step({}, 30); return o.state === 'dead' && g.me.gum.uses === GG.gums.popShocks.uses - 1; });
T('powerVacuum', (g) => { chew(g, 'powerVacuum'); return gumOn(g.me, 'powerVacuum'); });
T('respinCycle', (g) => { const b = g.sim.box; b.phase = 'offering'; b.buyerId = 'p1'; b.weapon = 'M15'; chew(g, 'respinCycle'); use(g); return b.phase === 'spinning'; });
T('slaughterSlide', async (g) => { const z = g.zombie(g.me.pos.x + 1.2, g.me.pos.z, 1e5); g.me.yaw = 0; chew(g, 'slaughterSlide'); (await import('../src/sim/gums.js')).gumSlide(g.sim, g.me); return z.state === 'dead'; });
T('temporalGift', async (g) => { chew(g, 'temporalGift'); const { spawnPowerup } = await import('../src/sim/powerups.js'); spawnPowerup(g.sim, 'doubleDough', g.me.pos); g.step({}, 2); return Math.abs(g.sim.powerups.active.doubleDough - CONFIG.powerups.duration * 2) < 0.1; });
T('unbearable', async (g) => { chew(g, 'unbearable'); const b = g.sim.box; b.phase = 'spinning'; b.weapon = 'bobble'; b.buyerId = 'p1'; b.timer = 0.01; b.paid = 950; const spot = b.spot.id; g.step({}, 2); return b.phase === 'spinning' && b.weapon !== 'bobble' && b.spot.id === spot; });
T('wallPower', (g) => { chew(g, 'wallPower'); const wb = g.sim.interactables.find((i) => i.kind === 'wallbuy' && CONFIG.weapons[i.wb.weapon] && CONFIG.weapons[i.wb.weapon + '+']); wb.use(g.sim, g.me, { usePressed: true }); return g.me.loadout.slots.some((s) => s.id === wb.wb.weapon + '+' && s.aat); });
T('whosKeepingScore', (g) => { chew(g, 'whosKeepingScore'); use(g); return g.sim.powerups.drops.some((d) => d.type === 'doubleDough'); });
T('cacheBack', (g) => { chew(g, 'cacheBack'); use(g); return g.sim.powerups.drops.some((d) => d.type === 'fullPantry'); });
T('extraCredit', (g) => { chew(g, 'extraCredit'); use(g); const d = g.sim.powerups.drops[0]; g.buddy.pos.x = d.pos.x; g.buddy.pos.z = d.pos.z; g.step({}, 3); const still = g.sim.powerups.drops.length === 1; const pts = g.me.points; g.me.pos.x = d.pos.x; g.me.pos.z = d.pos.z; g.step({}, 3); return still && g.me.points - pts === 1250; }, 2);
T('fatalContraption', (g) => { chew(g, 'fatalContraption'); use(g); const d = g.sim.powerups.drops[0]; g.me.pos.x = d.pos.x; g.me.pos.z = d.pos.z; g.step({}, 3); const has = g.me.loadout.slots[g.me.loadout.current].id === 'Death Machine'; const c = g.me.loadout.slots[g.me.loadout.current].clip; g.step({ fire: true, firePressed: true }, 30); const inf = g.me.loadout.slots[g.me.loadout.current].clip === c; g.step({ weaponCycle: true }, 2); const stuck = g.me.loadout.slots[g.me.loadout.current].id === 'Death Machine'; g.step({}, Math.ceil(CONFIG.powerups.list.deathMachine.time / dt) + 2); return has && inf && stuck && !g.me.loadout.slots.some((s) => s.id === 'Death Machine'); });
T('fearInHeadlights', (g) => { g.me.yaw = Math.PI / 2; const z = g.zombie(g.me.pos.x - 8, g.me.pos.z); chew(g, 'fearInHeadlights'); g.step({}, 60); const x = z.pos.x; g.step({}, 60); return z.gumHeld && Math.abs(z.pos.x - x) < 0.01; });
T('idleEyes', (g) => { const z = g.zombie(g.me.pos.x + 5, g.me.pos.z); chew(g, 'idleEyes'); use(g); g.step({}, 120); return Math.hypot(z.pos.x - g.me.pos.x, z.pos.z - g.me.pos.z) > 4.5; });
T('killJoy', (g) => { chew(g, 'killJoy'); use(g); return g.sim.powerups.drops.some((d) => d.type === 'oneBite'); });
T('killingTime', (g) => { const z = g.zombie(g.me.pos.x + 6, g.me.pos.z, 1e6); chew(g, 'killingTime'); use(g); const x = z.pos.x; g.step({}, 60); const froze = Math.abs(z.pos.x - x) < 0.01; damageZombie(g.sim, z, 10, { playerId: 'p1', part: 'torso', kind: 'bullet', dir: { x: 1, y: 0, z: 0 } }); g.step({}, Math.ceil(GG.gums.killingTime.window / dt)); return froze && z.state === 'dead'; });
T('nearDeathExperience', (g) => { chew(g, 'nearDeathExperience'); g.sim.damagePlayer(g.buddy, 999, null); g.buddy.pos.x = g.me.pos.x + 1; g.buddy.pos.z = g.me.pos.z; g.step({}, Math.ceil(GG.gums.nearDeathExperience.time / dt) + 3); return !g.buddy.downed && g.buddy.alive; }, 2);
T('phoenixUp', (g) => { givePerk(g.sim, g.buddy, 'doubleLadle'); g.sim.damagePlayer(g.buddy, 999, null); chew(g, 'phoenixUp'); use(g); return !g.buddy.downed && g.buddy.perks.includes('doubleLadle'); }, 2);
T('profitSharing', (g) => { chew(g, 'profitSharing'); const b = g.buddy.points; g.sim.addPoints(g.me, 50, 'kill'); return g.buddy.points - b === 50; }, 2);
T('roundRobbin', (g) => { g.sim.rounds.phase = 'active'; g.sim.rounds.toSpawn = 5; g.zombie(30, 30); chew(g, 'roundRobbin'); const p = g.me.points; use(g); g.step({}, 2); return g.me.points - p >= GG.gums.roundRobbin.points && g.sim.zombies.length === 0; });
T('secretShopper', (g) => { chew(g, 'secretShopper'); const wb = g.sim.interactables.find((i) => i.kind === 'wallbuy' && CONFIG.weapons[i.wb.weapon] && i.wb.weapon !== g.me.loadout.slots[0].id); const s = g.me.loadout.slots[0]; s.reserve = 0; const pr = wb.prompt(g.sim, g.me); wb.use(g.sim, g.me, { usePressed: true }); return /ammo/.test(pr.text) && s.reserve === CONFIG.weapons[s.id].reserve && g.me.loadout.slots.length === 1; });
T('selfMedication', (g) => { chew(g, 'selfMedication'); givePerk(g.sim, g.me, 'doubleLadle'); g.sim.damagePlayer(g.me, 999, null); g.step({}, 5); const down = !!g.me.downed && !g.sim.gameOver; const z = g.zombie(30, 30, 10); damageZombie(g.sim, z, 100, { playerId: 'p1', part: 'torso', kind: 'bullet', dir: { x: 1, y: 0, z: 0 } }); return down && !g.me.downed && g.me.perks.includes('doubleLadle'); });
T('shoppingFree', (g) => { chew(g, 'shoppingFree'); const p = g.me.points; return g.sim.pay(g.me, 5000) && g.me.points === p; });
T('sodaFountain', (g) => { chew(g, 'sodaFountain'); g.me.drinking = { perk: 'doubleLadle', t: 0 }; g.step({}, 2); return g.me.perks.length === 2; });
T('undeadManWalking', (g) => { const z = g.zombie(g.me.pos.x + 12, g.me.pos.z); z.speed = 4; chew(g, 'undeadManWalking'); g.step({}, 60); const x = z.pos.x; g.step({}, 60); return x - z.pos.x <= GG.gums.undeadManWalking.speed * 1.05; });
T('unquenchable', (g) => { chew(g, 'unquenchable'); use(g); const { gumPerkLimit } = g; return g.me.perkBonus === 1; });
T('flavorHexed', (g) => { chew(g, 'flavorHexed'); use(g); return g.me.gum && g.me.gum.id !== 'flavorHexed' && CONFIG.gobblegum.gums[g.me.gum.id].tier !== 'classic'; });
T('onTheHouse', (g) => { chew(g, 'onTheHouse'); for (const id of ['doubleLadle', 'phdGaylor', 'miltonKick', 'secondHelping']) givePerk(g.sim, g.me, id); const n = g.me.perks.length; use(g); return g.me.perks.length === n + 1; });
T('perkaholic', (g) => { chew(g, 'perkaholic'); use(g); const all = new Set(g.sim.world.perkMachines.map((m) => m.perk)); return [...all].every((id) => g.me.perks.includes(id)); });
T('reignDrops', (g) => { chew(g, 'reignDrops'); use(g); return g.sim.powerups.drops.length === Object.keys(CONFIG.powerups.list).length; });

const all = Object.keys(GG.gums);
check(all.length === 64, `all 64 GobbleGums (${all.length})`);
for (const id of all) {
  const fn = effects[id];
  if (!fn) { check(false, `${GG.gums[id].name}: tested`); continue; }
  let ok = false, err = '';
  try { const g = game({ players: fn.players }); ok = await fn(g); } catch (e) { err = ' — ' + e.message; }
  check(ok === true, `${GG.gums[id].name}: ${GG.gums[id].desc}${err}`);
}

// --- Mad Dog'd guns: a bite, rerolled at the machine ------------------------------
{
  const g = game();
  giveWeapon(g.sim, g.me, 'M15+');
  const s = g.me.loadout.slots.find((q) => q.id === 'M15+');
  check(!!CONFIG.aat.types[s.aat], `a Mad Dog'd gun has a bite (${s.aat})`);
  for (const t of Object.keys(CONFIG.aat.types)) {
    const g2 = game();
    giveWeapon(g2.sim, g2.me, 'M15+');
    const s2 = g2.me.loadout.slots.find((q) => q.id === 'M15+');
    s2.aat = t; g2.me.yaw = Math.PI / 2;
    const z = g2.zombie(g2.me.pos.x - 2, g2.me.pos.z, 1e6), o = g2.zombie(g2.me.pos.x - 3, g2.me.pos.z + 1, 1e6);
    g2.sim.cfg.aat.chance = 1;
    aatOnHit(g2.sim, z, { weapon: 'M15+', kind: 'bullet' }, g2.me);
    g2.sim.cfg.aat.chance = CONFIG.aat.chance;
    if (t === 'blastFurnace') g2.step({}, Math.ceil(CONFIG.aat.types.blastFurnace.burnKill / dt) + 30);
    check(g2.sim.events.concat(g2.log).some((e) => e.type === 'aatProc' && e.aat === t) && (o.state === 'dead' || o.health < 1e6), `${CONFIG.aat.types[t].name}: goes off and takes the zombies near it`);
  }
  const md = g.sim.madDog;
  if (md) {
    g.sim.power = true;
    const before = s.aat;
    g.me.loadout.current = g.me.loadout.slots.indexOf(s);
    const pr = md.prompt(g.sim, g.me);
    md.use(g.sim, g.me, { usePressed: true });
    md.timer = 0; md.update(g.sim, 1);
    md.use(g.sim, g.me, { usePressed: true });
    const s3 = g.me.loadout.slots.find((q) => q.id === 'M15+');
    check(/new bite/.test(pr.text) && pr.cost === CONFIG.aat.rerollCost && s3 && s3.aat && s3.aat !== before, `the Mad Dog again: a new bite for ${CONFIG.aat.rerollCost} (${before} → ${s3 && s3.aat})`);
  }
}

// --- the career: Liquid Divinium, Megas and your pack, by username -----------------
const GIFT = GG.gift;
GG.gift = null;   // (the welcome gift is tested on its own, below)
{
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const C = new Career({}, { storage, fetchFn: null });
  check(C.gums.pack.length === 5 && C.gums.pack.every((id) => !['mega', 'rare', 'ultra'].includes(GG.gums[id].tier)), 'a guest: Classics only');
  C.setPack(['perkaholic', 'stockOption']);
  check(!C.gums.pack.includes('perkaholic'), '...a guest can\'t put a Mega in');
  await C.signIn('Gumball');
  check(C.gums.divinium === GG.starter, `a new career starts with ${GG.starter} vials`);
  const got = C.openFactory(1, (() => { let i = 0; return () => [0.1, 0.2, 0.95, 0.5][i++ % 4]; })());
  check(got && got.length === GG.factory.vats[0].gums && C.gums.divinium === GG.starter - GG.factory.vats[0].cost, `Dr. Monty's Factory: ${GG.factory.vats[0].cost} vial → ${got && got.join(', ')}`);
  C.setPack([got[0], 'stockOption', 'swordFlay', 'coagulant', 'inPlainSight']);
  const pk = C.packForGame();
  check(pk.pack[0] === got[0] && pk.stock[got[0]] >= 1, 'your pack goes into the game with how many of each Mega');
  const n = C.gums.megas[got[0]];
  C.useMega(got[0]);
  check((C.gums.megas[got[0]] || 0) === n - 1, 'one coming out of a machine is gone from your career');
  C.addDivinium(2);
  C.saveLocal();
  const C2 = new Career({}, { storage, fetchFn: null });
  await C2.signIn('gumball');
  check(C2.gums.divinium === C.gums.divinium && C2.gums.pack[0] === got[0] && (C2.gums.megas[got[0]] || 0) === n - 1, 'it\'s all kept under the username');
  check(cleanPack(['nope', 'stockOption', 'stockOption']).length === 5, 'a bad pack is fixed up (5 real, different gums)');
  // online: the increments that go up
  const sent = [];
  const fetchFn = async (url, o) => { sent.push({ url, o }); return { ok: true, json: async () => (o.method === 'GET' ? null : {}) }; };
  const C3 = new Career({ firebaseUrl: 'https://x.test' }, { storage: { getItem: () => null, setItem: () => {} }, fetchFn });
  await C3.signIn('Online Gum');
  C3.addDivinium(1); C3.addMega('perkaholic', 2); C3.setPack(['perkaholic']);
  await C3.flush();
  const body = sent.filter((s) => s.o.method === 'PATCH').map((s) => JSON.parse(s.o.body)).reduce((a, b) => ({ ...a, ...b }), {});
  check(body['gums/divinium'] && body['gums/megas/perkaholic'] && body['gums/megas/perkaholic']['.sv'].increment === 2 && Array.isArray(body['gums/pack']), 'online: Divinium and Megas go up as increments, the pack as it is');
}

// --- the welcome gift: once per username, while it lasts; and the list of names ----------
{
  const megaIds = Object.keys(GG.gums).filter((id) => !['classic', 'whimsical'].includes(GG.gums[id].tier));
  const future = new Date(Date.now() + 864e5).toISOString(), past = new Date(Date.now() - 864e5).toISOString();
  GG.gift = { ...GIFT, id: 'test-gift', until: future };
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const C = new Career({}, { storage, fetchFn: null });
  let shown = null; C.onGift = (g) => { shown = g; };
  await C.signIn('Gifted');
  check(C.gums.divinium === GG.starter + GIFT.divinium && megaIds.every((id) => C.gums.megas[id] === GIFT.megas), `the gift: ${GIFT.divinium} vials and ${GIFT.megas} of each of the ${megaIds.length} Megas`);
  check(shown && shown.divinium === GIFT.divinium && shown.megas === megaIds.length, 'and it says so');
  C.saveLocal();
  const C2 = new Career({}, { storage, fetchFn: null });
  await C2.signIn('Gifted');
  check(C2.gums.divinium === GG.starter + GIFT.divinium, 'only once per username');
  GG.gift = { ...GIFT, id: 'test-gift-2', until: past };
  const C3 = new Career({}, { storage: { getItem: () => null, setItem: () => {} }, fetchFn: null });
  await C3.signIn('Too Late');
  check(C3.gums.divinium === GG.starter && !Object.keys(C3.gums.megas).length, 'none once it has run out');
  // online: the gift's increments and its mark go up, and a career that has it already gets nothing
  GG.gift = { ...GIFT, id: 'test-gift', until: future };
  const sent = [];
  let cloud = null;
  const fetchFn = async (url, o = {}) => { sent.push({ url, o }); return { ok: true, json: async () => (o.method === 'PATCH' ? {} : url.endsWith('/players.json') ? { gifted: { name: 'Gifted' }, zed: { name: 'Zed', achievements: {} } } : cloud) }; };
  const C4 = new Career({ firebaseUrl: 'https://x.test' }, { storage: { getItem: () => null, setItem: () => {} }, fetchFn });
  await C4.signIn('Online Gift');
  const body = sent.filter((s) => s.o.method === 'PATCH').map((s) => JSON.parse(s.o.body)).reduce((a, b) => ({ ...a, ...b }), {});
  check(body['gums/gifts/test-gift'] === true && body['gums/megas/' + megaIds[0]], 'online: the gift goes up with a mark so it isn\'t given twice');
  cloud = { name: 'Had It', gums: { divinium: 4, started: true, gifts: { 'test-gift': true } } };
  const C5 = new Career({ firebaseUrl: 'https://x.test' }, { storage: { getItem: () => null, setItem: () => {} }, fetchFn });
  await C5.signIn('Had It');
  check(C5.gums.divinium === 4, 'a username that got it on another device doesn\'t get it again');
  const names = await C5.listNames();
  check(names.map((n) => n.name).join(',') === 'Gifted,Had It,Zed', 'the sign-in list: every username, A to Z');
  const C6 = new Career({ firebaseUrl: 'https://x.test' }, { storage, fetchFn: async () => { throw new Error('offline'); } });
  check((await C6.listNames()).some((n) => n.name === 'Gifted'), 'offline: the names this device knows');
  GG.gift = GIFT;
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
