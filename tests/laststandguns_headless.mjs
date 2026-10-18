// Going down: you keep your best last-stand gun, like Black Ops. A Fucci Gun
// (the Ray Gun) comes first, then the pistols, Mad Dog'd ones ahead.
// Run: node tests/laststandguns_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { goDown, revive } from '../src/sim/laststand.js';
import { makeSlot } from '../src/sim/weapons.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };

// two players (so going down is a last stand, not game over), `me` carrying `guns`
function down(guns) {
  const sim = new GameSim({ map: SCHOOL, seed: 5 });
  const me = sim.addPlayer('p1', 'A');
  sim.addPlayer('p2', 'B');
  me.loadout.slots = guns.map((id) => makeSlot(sim, id));
  me.loadout.current = 0;
  goDown(sim, me);
  return { sim, me, held: me.loadout.slots.map((s) => s.id) };
}

let r = down(['Galill', 'Fucci Gun']);
check(r.held.length === 1 && r.held[0] === 'Fucci Gun', `a Fucci Gun stays with you (${r.held})`);
r = down(['CZ76', 'Fucci Gun Mk 2']);
check(r.held[0] === 'Fucci Gun Mk 2', `the Mk 2 beats a pistol (${r.held})`);
r = down(['M1912', 'CZ76 Dual']);
check(r.held[0] === 'CZ76 Dual', `the dual CZ76s beat the M1912, whatever slot they're in (${r.held})`);
r = down(['Fucci Gun', 'M1912+']);
check(r.held[0] === 'M1912+', `a Mad Dog'd pistol beats a plain Fucci Gun (${r.held})`);
r = down(['Fucci Gun+', 'CZ76 Dual+']);
check(r.held[0] === 'Fucci Gun+', `upgraded against upgraded: the Fucci Gun first (${r.held})`);
r = down(['Galill', 'Ballistik Knife']);
check(r.held[0] === 'M1912' && r.me.loadout.slots[0].loaner, `no last-stand gun (the Ballistik Knife isn't one): a loaner M1912 (${r.held})`);
r = down(['Galill', 'Fucci Gun']);
revive(r.sim, r.me, 'p2');
check(r.me.loadout.slots.map((s) => s.id).join() === 'Galill,Fucci Gun', 'back up: both guns are back');

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
