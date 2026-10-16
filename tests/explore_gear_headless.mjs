// The Explore menu's Grenades row: each button hands you a full stack of that
// grenade, and you can throw (or set down) what it gave you.
// Run: node tests/explore_gear_headless.mjs
import { CONFIG } from '../src/config.js';
import { GameSim } from '../src/sim/sim.js';
import { CRUST } from '../src/map/crust.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { rangeGear } from '../src/sim/range.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };

// --- the sim side: a stack of each, and it throws
for (const [name, map] of [['school', SCHOOL], ['the Crust', CRUST]]) {
  for (const [id, have, cmd, ptype] of [
    ['frag', 'grenades', { grenade: true, grenadePressed: true }, 'frag'],
    ['stewBomb', 'stewBombs', { tactical: true, tacticalPressed: true }, 'stewbomb'],
    ['maisyDog', 'maisyDogs', { tactical: true, tacticalPressed: true }, 'maisy'],
    ['lbd', 'lbds', { minePressed: true }, 'lbd'],
  ]) {
    const sim = new GameSim({ map, seed: 3, mode: 'explore' });
    const me = sim.addPlayer('p1', 'T');
    const log = [];
    const step = (n, c = {}) => { for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...c }); sim.step(1 / 60); log.push(...sim.drainEvents()); } };
    step(30);
    me[have] = 0;
    rangeGear(sim, me, id);
    const n = me[have];
    check(n === CONFIG.equipment[id].perPurchase, `${name}: ${CONFIG.equipment[id].name} from the menu: ${n} of them`);
    step(1, cmd); step(90);
    const thrown = log.some((e) => e.type === 'projectileSpawn' && e.ptype === ptype);
    check(thrown && me[have] === n - 1, `${name}: ...and one goes (${ptype})`);
  }
}

// --- a Stew Bomb and a Maisy Dog share the [Q] slot: picking one takes the other
{
  const sim = new GameSim({ map: SCHOOL, seed: 3, mode: 'explore' });
  const me = sim.addPlayer('p1', 'T');
  rangeGear(sim, me, 'stewBomb'); rangeGear(sim, me, 'maisyDog');
  check(me.maisyDogs > 0 && me.stewBombs === 0, 'picking Maisy Dogs swaps out the Stew Bombs');
}

// --- the menu: a Grenades row, each button calls gear(id), and lights up once you have some
{
  const byId = new Map();
  const el = (tag = 'div') => {
    const e = {
      tag, children: [], dataset: {}, style: { setProperty() {} }, listeners: {}, hidden: true, textContent: '', checked: false,
      classList: { s: new Set(), toggle(c, on) { on ? this.s.add(c) : this.s.delete(c); }, add(c) { this.s.add(c); }, contains(c) { return this.s.has(c); } },
      appendChild(c) { this.children.push(c); return c; },
      addEventListener(t, f) { this.listeners[t] = f; },
      set innerHTML(h) { this.children = [...h.matchAll(/class="(\w+)"/g)].map((m) => { const c = el('span'); c.className = m[1]; return c; }); },
      querySelector(q) { return all(this).find((c) => c.className === q.slice(1)) || el(); },
      querySelectorAll(q) { const k = (q.match(/data-(\w+)/) || [])[1]; return all(this).filter((c) => c.tag === 'button' && (!k || c.dataset[k] != null)); },
    };
    return e;
  };
  const all = (e) => e.children.flatMap((c) => [c, ...all(c)]);
  globalThis.document = { getElementById: (id) => { if (!byId.has(id)) byId.set(id, el()); return byId.get(id); }, createElement: (t) => el(t) };
  const { ExploreUI } = await import('../src/ui/explore.js');
  const asked = [];
  const ui = new ExploreUI(CONFIG, { give() {}, gear: (id) => asked.push(id), round() {}, zombies() {}, skip() {}, titan() {}, crust() {}, close() {} });
  const list = byId.get('ep-weapons');
  const rows = list.children.filter((g) => g.children[0] && g.children[0].textContent === 'Grenades');
  check(rows.length === 1, 'the weapon menu has a Grenades row');
  const btns = rows[0] ? rows[0].children.filter((c) => c.tag === 'button') : [];
  check(btns.map((b) => b.dataset.gear).join() === 'frag,stewBomb,maisyDog,lbd', `...with ${btns.map((b) => b.querySelector('.n').textContent).join(', ')}`);
  for (const b of btns) b.listeners.click();
  check(asked.join() === 'frag,stewBomb,maisyDog,lbd', '...each one asks for its own grenade');
  const sim = new GameSim({ map: SCHOOL, seed: 3, mode: 'explore' });
  const me = sim.addPlayer('p1', 'T');
  rangeGear(sim, me, 'lbd');
  ui.sim = sim; ui.p = me; ui.refresh();
  const lit = btns.filter((b) => b.classList.contains('held')).map((b) => b.dataset.gear);
  check(lit.includes('lbd') && !lit.includes('maisyDog'), `...and the ones you have light up (${lit.join(', ')})`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
