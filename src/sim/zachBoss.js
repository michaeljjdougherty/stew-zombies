// =============================================================================
// The finale of Call of the Crust: Big Evil Zach. Once Pit has forged all four
// War Hammers, ring the Anvil and The Schnitz brings Zach down into the pit.
//
// The Schnitz's hold makes him untouchable: bullets spark off, blasts do
// nothing. Only a War Hammer gets through, and only the right one: he glows
// the colour of the element he's open to (wind, lightning, ice, fire, in
// turn). Land enough hits with that hammer (three, more with a bigger team)
// and he drops to his knees and shrinks as the grip loosens; then he's up and
// open to the next. After the fourth, The Schnitz tears itself out of him and
// Zach is just Zach again.
//
// He stomps (a ring round him), swipes (a cone in front), and every third
// attack calls his dead up out of the pit floor. Rounds stop while he's here.
// Plain data in sim.crustEgg.finale, like the titans. Numbers: CONFIG.crust.finale.
// =============================================================================
import { zombieHealthForRound } from '../config.js';
import { makeZombie, pickZombieType } from './zombies.js';
import { groundHeight } from './physics.js';
import { ZACH_FINALE, PIT_FORGE } from '../lore/crew.js';
import { ZACH_TAUNTS } from '../lore/crustCrew.js';
import { paSay } from './pa.js';
import { lineDuration } from '../lore/erik.js';
import { angleWrap } from '../core/math.js';
import { pitSay } from './forge.js';
import { kickUp } from './crustEgg.js';

const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const H = 1.78;   // a person's height: he's this x his scale
export const ZACH_H = H;

export function startFinale(sim) {
  const E = sim.crustEgg;
  if (!E || (E.finale && E.finale.state !== 'off')) return false;
  const c = sim.cfg.crust.finale, spec = sim.mapData.forge;
  const need = c.hits + Math.max(0, sim.players.length - 2);
  E.finale = {
    state: 'descend', t: 0, phase: 0, hits: 0, need,
    pos: { x: spec.zach.x, y: spec.zach.y, z: spec.zach.z }, yaw: 0,
    scale: c.scale[0], act: null, nextAt: sim.time + c.descendTime + 2, attacks: 0, said: 0,
  };
  sim.emit('zachDescend', { pos: { ...E.finale.pos } });
  schnitz(sim, ZACH_FINALE.descend, true);
  return true;
}

function schnitz(sim, text, shock = false) {
  const dur = lineDuration(text) * 1.25;
  sim.emit('schnitzSays', { text, dur, shock });
  // (everyone else waits until it's done: src/sim/pa.js)
  if (sim.pa && sim.pa.enabled) sim.pa.speaking = { cat: 'finale', text, until: Math.max(sim.time + dur, sim.pa.speaking ? sim.pa.speaking.until : 0), who: 'schnitz' };
}

export const finaleOn = (E) => !!(E && E.finale && E.finale.state !== 'off' && E.finale.state !== 'done');
export const zachElement = (sim) => { const F = sim.crustEgg && sim.crustEgg.finale; return F ? sim.cfg.crust.finale.order[Math.min(3, F.phase)] : null; };

// ---------------------------------------------------------------------------
export function updateZach(sim, dt) {
  const E = sim.crustEgg, F = E && E.finale;
  if (!F || F.state === 'off' || F.state === 'done') return;
  const c = sim.cfg.crust.finale;
  F.t += dt;
  // (he's solid: you can't walk through him. feelTitans, crustEgg.js)
  if (F.state === 'descend') {
    if (F.t >= c.descendTime) {
      F.state = 'fight'; F.t = 0;
      sim.emit('zachLand', { pos: { ...F.pos } });
      blast(sim, F.pos, c.stomp.radius, c.stomp.damage * 0.5, c.stomp.push);
    }
    return;
  }
  if (F.state === 'kneel') {
    if (F.t >= c.kneelTime) {
      F.phase++;
      if (F.phase >= 4) { freed(sim, F); return; }
      F.state = 'fight'; F.t = 0; F.hits = 0; F.scale = c.scale[F.phase]; F.act = null; F.nextAt = sim.time + 1.5;
      sim.emit('zachRise', { phase: F.phase, element: c.order[F.phase], scale: F.scale });
    }
    return;
  }
  if (F.state === 'freed') {
    const lines = ZACH_FINALE.zach;
    if (F.said < 1 && F.t > 4.5) { F.said = 1; zachSay(sim, lines[0]); }
    if (F.said < 2 && F.t > 7.5) { F.said = 2; zachSay(sim, lines[1]); }
    if (F.said < 3 && F.t > 10.5) { F.said = 3; pitSay(sim, PIT_FORGE.freed); }
    if (F.t >= c.freedTime) {
      F.state = 'done';
      sim.emit('crustVictory', { round: sim.rounds.round });
    }
    return;
  }
  // --- the fight
  // now and then the Schnitz, through him, has something to say
  const tt = sim.cfg.crust.zachTaunt;
  if (F.tauntAt == null) F.tauntAt = sim.time + tt[0];
  if (sim.time >= F.tauntAt) {
    F.taunts = (F.taunts || 0) + 1;
    const text = ZACH_TAUNTS[(F.taunts - 1) % ZACH_TAUNTS.length];
    if (sim.pa && sim.pa.enabled) paSay(sim, 'talkErik', { text, force: true, who: 'schnitz' }); else schnitz(sim, text);
    F.tauntAt = sim.time + tt[0] + ((F.taunts * 7) % 10) / 10 * (tt[1] - tt[0]);
  }
  const target = nearest(sim, F);
  const speed = c.speed[F.phase];
  if (F.act) { updateAct(sim, F, dt, c); return; }
  if (target) {
    const dx = target.pos.x - F.pos.x, dz = target.pos.z - F.pos.z, d = Math.hypot(dx, dz);
    // turn toward them
    const want = Math.atan2(dx, dz);
    F.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, angleWrap(want - F.yaw)));
    const stop = 3 + F.scale * 0.6;
    if (d > stop) { F.pos.x += (dx / d) * speed * dt; F.pos.z += (dz / d) * speed * dt; F.walking = true; } else F.walking = false;
    keepInPit(sim, F, c);
    if (sim.time >= F.nextAt) startAct(sim, F, c, d);
  } else F.walking = false;
}

// ---------------------------------------------------------------------------
function nearest(sim, F) {
  let best = null, bd = Infinity;
  for (const p of sim.players) {
    if (!p.alive || p.downed || Math.abs(p.pos.y - F.pos.y) > 6) continue;
    const d = d2(p.pos, F.pos);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function keepInPit(sim, F, c) {
  const spec = sim.mapData.forge, A = spec.anvil;
  let dx = F.pos.x - A.x, dz = F.pos.z - A.z, d = Math.hypot(dx, dz) || 1e-3;
  if (d > c.pitRadius) { F.pos.x = A.x + dx / d * c.pitRadius; F.pos.z = A.z + dz / d * c.pitRadius; }
  // (between the two scaffold catwalks: he's too tall to go under them)
  F.pos.z = Math.max(A.z - c.band, Math.min(A.z + c.band, F.pos.z));
  dx = F.pos.x - A.x; dz = F.pos.z - A.z; d = Math.hypot(dx, dz) || 1e-3;
  if (d < c.anvilRadius) { F.pos.x = A.x + dx / d * c.anvilRadius; F.pos.z = A.z + dz / d * c.anvilRadius; }
  // (and he leaves Pit be)
  const P = spec.pit, px = F.pos.x - P.x, pz = F.pos.z - P.z, pd = Math.hypot(px, pz) || 1e-3;
  if (pd < c.pitClear) { F.pos.x = P.x + px / pd * c.pitClear; F.pos.z = P.z + pz / pd * c.pitClear; }
  // (the pit floor's height where he stands)
  const g = groundHeight(F.pos.x, F.pos.z, 0.3, 3, [sim.world.terrain]);
  if (Number.isFinite(g) && g > -2) F.pos.y = g;
}

function startAct(sim, F, c, d) {
  F.attacks++;
  let kind;
  if (F.attacks % c.summon.every === 0) kind = 'summon';
  else if (d < c.swipe.range * 0.9) kind = sim.rng.chance(0.5) ? 'swipe' : 'stomp';
  else if (d < c.stomp.radius + 2) kind = 'stomp';
  else { F.attacks--; F.nextAt = sim.time + 0.5; return; }
  const warn = c[kind].warn;
  F.act = { kind, t: 0, warn, yaw: F.yaw };
  sim.emit('zachAttack', { kind, warn, pos: { ...F.pos }, yaw: F.yaw, radius: kind === 'stomp' ? c.stomp.radius : c.swipe.range, angle: c.swipe.angle });
}

function updateAct(sim, F, dt, c) {
  const a = F.act;
  a.t += dt;
  if (!a.done && a.t >= a.warn) {
    a.done = true;
    if (a.kind === 'stomp') { blast(sim, F.pos, c.stomp.radius, c.stomp.damage, c.stomp.push); sim.emit('zachStomp', { pos: { ...F.pos }, radius: c.stomp.radius }); }
    else if (a.kind === 'swipe') {
      const cosA = Math.cos(c.swipe.angle * Math.PI / 180), fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
      for (const p of sim.players) {
        if (!p.alive || p.downed || Math.abs(p.pos.y - F.pos.y) > H * F.scale * 0.75) continue;
        const dx = p.pos.x - F.pos.x, dz = p.pos.z - F.pos.z, d = Math.hypot(dx, dz);
        if (d > c.swipe.range || (d > 1 && (dx * fx + dz * fz) / d < cosA)) continue;
        sim.damagePlayer(p, c.swipe.damage, { pos: { x: F.pos.x, z: F.pos.z } });
        shove(p, F.pos, c.swipe.push);
      }
      sim.emit('zachSwipe', { pos: { ...F.pos }, yaw: a.yaw, range: c.swipe.range });
    } else summon(sim, F, c);
  }
  if (a.t >= a.warn + 0.7) {
    F.act = null;
    F.nextAt = sim.time + sim.rng.range(c.every[0], c.every[1]) * (1 - F.phase * 0.08);
  }
}

function shove(p, from, speed) {
  const dx = p.pos.x - from.x, dz = p.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
  p.shove = { x: (dx / l) * speed, z: (dz / l) * speed };
  kickUp(p, speed * 0.35);
}
function blast(sim, pos, r, dmg, push) {
  for (const p of sim.players) {
    if (!p.alive || p.downed || p.launch) continue;
    const d = d2(p.pos, pos);
    if (d > r || Math.abs(p.pos.y - pos.y) > 3.5) continue;
    sim.damagePlayer(p, dmg * (1 - 0.6 * (d / r)), { pos: { x: pos.x, z: pos.z } });
    shove(p, pos, push);
  }
}

// his dead claw up out of the pit floor round him
function summon(sim, F, c) {
  const zc = sim.cfg.zombie, round = Math.max(1, sim.rounds.round), A = sim.mapData.forge.anvil;
  let made = 0;
  for (let i = 0; i < c.summon.count * 3 && made < c.summon.count; i++) {
    const a = sim.rng.range(0, Math.PI * 2), r = sim.rng.range(c.anvilRadius + 1, c.pitRadius);
    const x = A.x + Math.cos(a) * r, z0 = A.z + Math.sin(a) * r;
    if (sim.players.some((p) => Math.hypot(p.pos.x - x, p.pos.z - z0) < 3)) continue;
    const g = groundHeight(x, z0, 0.3, 3, [sim.world.solids, sim.world.terrain]);
    if (!Number.isFinite(g) || g < -1 || g > 1.5) continue;
    const z = makeZombie(sim, { type: pickZombieType(sim, round), pos: { x, y: g - zc.riseDepth, z: z0 }, yaw: a + Math.PI, health: zombieHealthForRound(round, zc) * c.healthMult, state: 'rising' });
    z.riseBase = g; z.riseFrom = z.pos.y - g; z.zach = true;
    sim.zombies.push(z);
    sim.emit('zombieSpawn', { id: z.id, zombieType: z.type, pos: { ...z.pos }, windowId: null, rising: true });
    sim.emit('zombieRise', { id: z.id, pos: { x, y: g, z: z0 } });
    made++;
  }
  sim.emit('zachSummon', { count: made, pos: { ...F.pos } });
}

// ---------------------------------------------------------------------------
// A War Hammer swing (hammers.js): does it land on him, and is it the right one?
export function zachHammerHit(sim, p, element, land, dir, upgraded = false) {
  const E = sim.crustEgg, F = E && E.finale;
  if (!F || F.state !== 'fight') return false;
  const c = sim.cfg.crust.finale;
  const reach = c.hitReach + c.radius * F.scale / c.scale[3];
  const dx = F.pos.x - p.pos.x, dz = F.pos.z - p.pos.z, d = Math.hypot(dx, dz);
  if (Math.abs(p.pos.y - F.pos.y) > H * F.scale * 0.85) return false;   // (from the catwalks you can reach his head)
  if (d > reach || (d > 1 && (dx * dir.x + dz * dir.z) / d < 0.35)) return false;
  const want = c.order[F.phase];
  // (only an upgraded one, the Tempest, Thunder, Glacier or Inferno Hammer)
  if (element !== want || !upgraded) { sim.emit('zachShrug', { element, want, playerId: p.id, pos: { ...land } }); return false; }
  F.hits++;
  F.act = null;   // it staggers him out of whatever he was doing
  F.nextAt = sim.time + 1.2;
  sim.emit('zachHit', { element, hits: F.hits, need: F.need, playerId: p.id, pos: { ...land } });
  sim.addPoints(p, c.hitPoints, 'zach');
  if (F.hits >= F.need) {
    F.state = 'kneel'; F.t = 0;
    sim.emit('zachKneel', { phase: F.phase, element });
    if (F.phase < 3) schnitz(sim, ZACH_FINALE.phase[F.phase]);
  }
  return true;
}

function freed(sim, F) {
  F.state = 'freed'; F.t = 0; F.act = null; F.scale = 1;
  // his dead go with The Schnitz
  for (const z of sim.zombies) if (z.zach && z.state !== 'dead') z.state = 'dead';
  sim.emit('schnitzTorn', { pos: { ...F.pos } });
  schnitz(sim, ZACH_FINALE.freed, true);
}

function zachSay(sim, text) {
  sim.emit('crewSays', { who: 'zach', text, dur: lineDuration(text), radio: false, live: true, cat: 'finale' });
}

// What a bullet can hit: him (it sparks off The Schnitz's hold)
export function zachTargets(sim) {
  const F = sim.crustEgg && sim.crustEgg.finale;
  if (!F || !(F.state === 'fight' || F.state === 'kneel' || F.state === 'descend' && F.t > sim.cfg.crust.finale.descendTime - 1)) return [];
  const h = H * F.scale, k = F.state === 'kneel' ? 0.7 : 1;
  return [[0.3, 0.16], [0.58, 0.19], [0.86, 0.11]].map(([y, r]) => ({ id: 'zach', c: { x: F.pos.x, y: F.pos.y + y * h * k, z: F.pos.z }, r: r * h, surface: 'metal' }));
}

// The HUD's line
export function zachObjective(sim) {
  const F = sim.crustEgg && sim.crustEgg.finale;
  if (!F) return null;
  const el = sim.cfg.crust.finale.order[Math.min(3, F.phase)];
  const name = { wind: 'Wind', lightning: 'Lightning', ice: 'Ice', fire: 'Fire' }[el];
  if (F.state === 'descend') return 'Big Evil Zach is coming';
  if (F.state === 'fight') return `Hit Big Evil Zach with the ${name} Hammer · ${F.hits} of ${F.need}`;
  if (F.state === 'kneel') return 'The Schnitz is losing its grip';
  if (F.state === 'freed') return 'Zach is free';
  return null;
}
