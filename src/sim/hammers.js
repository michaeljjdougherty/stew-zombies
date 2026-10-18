// =============================================================================
// The War Hammers (Call of the Crust). Pit forges one from each titan's core;
// you take it from its socket on the Anvil. It comes off the Anvil upgraded
// (its "+": the Tempest, Thunder, Glacier and Inferno Hammers; there's no
// plain elemental one any more): a swing smashes everything just in front of
// you and its element comes out, Origins-staff style: a burst where its head
// lands, and something left behind (src/sim/gadgets.js runs those):
//   Fire       a burst of flame, and a pool of fire that burns down anything in it
//   Ice        everything round you frozen solid, and a blizzard that freezes and shatters more
//   Wind       a gale down the line you swung along, and a whirlwind where it lands
//   Lightning  the Wunderwaffe: a bolt into the first one in line, then a ball of
//              lightning jumping zombie to zombie, killing each (from its forging on)
// They're also the only thing that gets through The Schnitz's hold on Big
// Evil Zach (zachBoss.js), and only the upgraded ones, the right one for him.
// Numbers: CONFIG.crust.hammers.
// =============================================================================
import { damageZombie } from './zombies.js';
import { explode, spawnProjectile } from './projectiles.js';
import { windBlast } from './wind.js';
import { zachHammerHit } from './zachBoss.js';
import { DEG } from '../core/math.js';

const alive = (z) => z.state !== 'dead' && !(z.state === 'rising' && z.pos.y < -0.8);
const center = (z) => ({ x: z.pos.x, y: z.pos.y + (z.crawler ? 0.3 : 1.0), z: z.pos.z });

export const HAMMER_ELEMENTS = ['wind', 'lightning', 'ice', 'fire'];
export const HAMMER_IDS = { wind: 'Wind Hammer', lightning: 'Lightning Hammer', ice: 'Ice Hammer', fire: 'Fire Hammer' };

export function hammerSlam(sim, p, eye, dir, def, weapon, quick = false) {
  if (quick) { hammerSweep(sim, p, eye, dir, def, weapon); return; }
  const H = sim.cfg.crust.hammers, el = def.hammer, up = !!def.upgraded;
  const E = H.tempered[el];
  let fx = dir.x, fz = dir.z;
  const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
  const land = { x: p.pos.x + fx * H.landAt, y: p.pos.y + 0.15, z: p.pos.z + fz * H.landAt };

  // the smash: everything just in front of you
  const cosA = Math.cos(H.angle * DEG);
  const hits = [];
  for (const z of sim.zombies) {
    if (!alive(z)) continue;
    const dx = z.pos.x - p.pos.x, dz = z.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d > H.reach + 0.4 || Math.abs(z.pos.y - p.pos.y) > 2.4) continue;
    if (d > 0.8 && (dx * fx + dz * fz) / d < cosA) continue;
    const c = center(z);
    const ex = c.x - eye.x, ey = c.y - eye.y, ez = c.z - eye.z, el2 = Math.hypot(ex, ey, ez);
    if (el2 > 0.6 && sim.raycastWorld(eye, { x: ex / el2, y: ey / el2, z: ez / el2 }, el2 - 0.4, true)) continue;
    hits.push({ z, d, c });
  }
  hits.sort((a, b) => a.d - b.d);
  const maxKills = up ? (H.tempered.maxKills ?? H.maxKills) : H.maxKills;
  for (const { z, c } of hits.slice(0, maxKills)) {
    let kx = c.x - p.pos.x, kz = c.z - p.pos.z;
    const kl = Math.hypot(kx, kz) || 1; kx = kx / kl * 0.5 + fx * 0.5; kz = kz / kl * 0.5 + fz * 0.5;
    damageZombie(sim, z, 1e6, { playerId: p.id, part: 'torso', kind: 'hammer', dir: { x: kx, y: 0.45, z: kz }, point: c, force: 1, weapon, fling: { x: kx, z: kz, dist: 3.5, up: 1.6 } });
  }
  sim.emit('hammerSlam', { playerId: p.id, element: el, upgraded: up, pos: land, dir: { x: fx, z: fz }, smashed: Math.min(hits.length, maxKills), weapon });

  // the plain War Hammer: just the smash (Big Evil Zach shrugs it off)
  if (!E) { zachHammerHit(sim, p, el, land, { x: fx, z: fz }); return; }
  // an elemental hammer: its element goes off (at elementK of full strength);
  // tempered, at full strength, and it leaves something behind
  const k = up ? 1 : H.elementK;
  const leave = (type, o = {}) => {
    if (!up) return null;
    const pr = spawnProjectile(sim, type, land, { x: fx, y: 0, z: fz }, p.id, { gravity: 0, weapon }); pr.resting = true; pr.dir = { x: fx, z: fz }; Object.assign(pr, o); return pr;
  };
  if (el === 'fire') { explode(sim, { x: land.x, y: land.y + 0.5, z: land.z }, up ? E.blast : 'hammerFire', p.id); leave('hfire'); }
  else if (el === 'ice') {
    const near = [];
    for (const z of sim.zombies) {
      if (!alive(z)) continue;
      const d = Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z);
      if (d <= E.radius * k && Math.abs(z.pos.y - p.pos.y) < 3) near.push({ z, d });
    }
    near.sort((a, b) => a.d - b.d);
    const ids = [];
    for (const { z } of near.slice(0, Math.round(E.maxFrozen * k))) { z.frozen = E.freeze * k; ids.push(z.id); }
    sim.emit('hammerFreeze', { playerId: p.id, pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, radius: E.radius * k, ids });
    leave('hice');
  } else if (el === 'wind') { windBlast(sim, p, eye, { x: fx, y: 0, z: fz }, { wind: { ...E, range: E.range * k, maxKills: Math.round(E.maxKills * k) } }, weapon); leave('hwind'); }
  else if (el === 'lightning') {
    // the Wunderwaffe: a bolt down your aim into the first zombie in line, then a
    // ball of lightning jumping zombie to zombie, killing every one (gadgets.js);
    // `forged` of them before Pit tempers it, `chains` after
    const W = E.waffe, chains = up ? W.chains : W.forged;
    const from = { x: eye.x + dir.x * 0.8, y: eye.y + dir.y * 0.8 - 0.2, z: eye.z + dir.z * 0.8 };
    let first = null, bt = W.range;
    for (const z of sim.zombies) {
      if (!alive(z)) continue;
      const c = center(z);
      const vx = c.x - eye.x, vy = c.y - eye.y, vz = c.z - eye.z;
      const t = vx * dir.x + vy * dir.y + vz * dir.z;
      if (t < 0.3 || t > bt) continue;
      const off = Math.hypot(vx - dir.x * t, vy - dir.y * t, vz - dir.z * t);
      if (off > W.aim * Math.min(1, 0.4 + t / 10)) continue;   // (a fat bolt: it'll catch one a little off your aim)
      const el2 = Math.hypot(vx, vy, vz);
      if (sim.raycastWorld(eye, { x: vx / el2, y: vy / el2, z: vz / el2 }, el2 - 0.4, true)) continue;
      bt = t; first = z;
    }
    if (!first) {
      // nothing in line: it cracks off into whatever you're looking at
      const wall = sim.raycastWorld(eye, dir, W.range, true);
      const end = wall ? wall.point : { x: eye.x + dir.x * W.range, y: eye.y + dir.y * W.range, z: eye.z + dir.z * W.range };
      sim.emit('hammerChain', { playerId: p.id, points: [from, { ...end }] });
    } else {
      const c = center(first);
      damageZombie(sim, first, 1e6, { playerId: p.id, part: 'torso', kind: 'electric', dir: { x: 0, y: 1, z: 0 }, point: c, force: 1, weapon });
      sim.emit('hammerChain', { playerId: p.id, points: [from, c] });
      if (chains > 1) {
        const pr = spawnProjectile(sim, 'hbolt', c, { x: 0, y: 0, z: 0 }, p.id, { gravity: 0, weapon });
        Object.assign(pr, { resting: true, dir: { x: fx, z: fz }, chains, kills: 1, hit: [first.id], zap: W.every });
      }
    }
  }

  // Big Evil Zach (the finale): the only thing that gets through
  zachHammerHit(sim, p, el, land, { x: fx, z: fz }, up);
}

// The quick swing (right click): a sweep from left to right across you, the same
// on every hammer. No element, and it doesn't count against Big Evil Zach.
export function hammerSweep(sim, p, eye, dir, def, weapon) {
  const Q = sim.cfg.crust.hammers.quick;
  let fx = dir.x, fz = dir.z;
  const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
  const rx = -fz, rz = fx;   // (to your right)
  const cosA = Math.cos(Q.angle * DEG);
  const hits = [];
  for (const z of sim.zombies) {
    if (!alive(z)) continue;
    const dx = z.pos.x - p.pos.x, dz = z.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d > Q.reach + 0.4 || Math.abs(z.pos.y - p.pos.y) > 2.4) continue;
    if (d > 0.8 && (dx * fx + dz * fz) / d < cosA) continue;
    const c = center(z);
    const ex = c.x - eye.x, ey = c.y - eye.y, ez = c.z - eye.z, el2 = Math.hypot(ex, ey, ez);
    if (el2 > 0.6 && sim.raycastWorld(eye, { x: ex / el2, y: ey / el2, z: ez / el2 }, el2 - 0.4, true)) continue;
    hits.push({ z, d, c });
  }
  hits.sort((a, b) => a.d - b.d);
  for (const { z, c } of hits.slice(0, Q.maxKills)) {
    const kx = rx * 0.75 + fx * 0.25, kz = rz * 0.75 + fz * 0.25;
    damageZombie(sim, z, 1e6, { playerId: p.id, part: 'torso', kind: 'hammer', dir: { x: kx, y: 0.3, z: kz }, point: c, force: 1, weapon, fling: { x: kx, z: kz, dist: Q.fling, up: 1 } });
  }
  sim.emit('hammerSweep', { playerId: p.id, element: def.hammer, pos: { x: p.pos.x + fx * 1.4, y: p.pos.y + 1, z: p.pos.z + fz * 1.4 }, dir: { x: fx, z: fz }, smashed: Math.min(hits.length, Q.maxKills), weapon });
}
