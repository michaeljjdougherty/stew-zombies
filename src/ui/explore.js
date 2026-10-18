// =============================================================================
// Explore mode's menu (press B, or View on a controller): spawn in any gun,
// start any round, switch the zombies on or off, and jump to any part of
// the Easter egg. Changes the game only through the handlers it's given.
// =============================================================================
import { GROUPS, weaponStatLine } from './range.js';
import { QUEST_SKIPS, QUEST_STEPS } from '../sim/quest.js';

// The "Mad Dog'd" box gives a gun's upgraded twin, but never a War Hammer's:
// only Pit makes those (they're their own buttons). And the button a held
// weapon lights up.
const pick = (cfg, id, upgraded) => (upgraded && cfg.weapons[id + '+'] && !cfg.weapons[id].hammer ? id + '+' : id);
const button = (cfg, id) => (cfg.weapons[id] && cfg.weapons[id].hammer ? id : id.replace(/\+$/, ''));
// The Grenades row: the equipment, where it goes, and the player's count of it.
const GEAR = {
  frag: { slot: 'Lethal', have: 'grenades' },
  stewBomb: { slot: 'Tactical', have: 'stewBombs' },
  maisyDog: { slot: 'Tactical', have: 'maisyDogs' },
  lbd: { slot: 'Placed', have: 'lbds' },
};

const $ = (id) => document.getElementById(id);

export class ExploreUI {
  constructor(cfg, handlers) {
    this.cfg = cfg;
    this.h = handlers;   // { give(id), gear(id), round(n), zombies(on), skip(id), close() }
    this.panel = $('explorepanel');
    this.upgraded = false;
    this.round = 1;
    this.build();
  }

  build() {
    const list = $('ep-weapons');
    list.textContent = '';
    const entries = Object.entries(this.cfg.weapons).filter(([id, d]) => (!id.endsWith('+') || d.hammer) && !(d.hammer && d.hammer !== 'iron' && !d.upgraded) && !d.gumOnly);   // (an elemental hammer is its own button, only ever upgraded: Pit's, not the Mad Dog's)
    for (const [title, test] of GROUPS) {
      const ids = entries.filter(([, d]) => test(d)).map(([id]) => id);
      if (!ids.length) continue;
      const g = document.createElement('div');
      g.className = 'rp-group';
      const h = document.createElement('h3'); h.textContent = title; g.appendChild(h);
      for (const id of ids) {
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.id = id;
        b.innerHTML = '<span class="n"></span><span class="w"></span><span class="s"></span>';
        b.addEventListener('click', () => { this.h.give(pick(this.cfg, id, this.upgraded)); this.refresh(); });
        g.appendChild(b);
      }
      list.appendChild(g);
    }
    // the grenades: a full stack of whichever you pick (a Stew Bomb or a Maisy Dog
    // takes the [Q] slot from the other)
    const gear = Object.keys(GEAR).filter((k) => this.cfg.equipment[k]);
    if (gear.length && this.h.gear) {
      const g = document.createElement('div');
      g.className = 'rp-group';
      const h = document.createElement('h3'); h.textContent = 'Grenades'; g.appendChild(h);
      for (const k of gear) {
        const E = this.cfg.equipment[k];
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.gear = k;
        b.innerHTML = '<span class="n"></span><span class="w"></span><span class="s"></span>';
        b.querySelector('.n').textContent = E.name;
        b.querySelector('.w').textContent = GEAR[k].slot;
        b.querySelector('.s').textContent = `${E.perPurchase} of them`;
        b.addEventListener('click', () => { this.h.gear(k); this.refresh(); });
        g.appendChild(b);
      }
      list.appendChild(g);
    }
    $('ep-upgraded').addEventListener('change', (e) => { this.upgraded = e.target.checked; this.refresh(); });
    const bump = (d) => { this.round = Math.max(1, Math.min(100, this.round + d)); $('ep-round').textContent = String(this.round); };
    $('ep-round-dec5').addEventListener('click', () => bump(-5));
    $('ep-round-dec').addEventListener('click', () => bump(-1));
    $('ep-round-inc').addEventListener('click', () => bump(1));
    $('ep-round-inc5').addEventListener('click', () => bump(5));
    $('ep-round-go').addEventListener('click', () => { this.h.round(this.round); this.h.close(); });
    $('ep-zombies').addEventListener('change', (e) => this.h.zombies(e.target.checked));
    this.eggButtons('quest');
    $('ep-close').addEventListener('click', () => this.h.close());
  }

  // the egg's buttons: the school's quest steps, or Call of the Crust's titans
  eggButtons(mode, sim = null) {
    this.eggMode = mode;
    const egg = $('ep-egg');
    egg.textContent = '';
    if (mode === 'quest') {
      QUEST_SKIPS.forEach((s, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'sm'; b.dataset.skip = s.id;
        b.textContent = `${i + 1}. ${s.name}`;
        b.addEventListener('click', () => { this.h.skip(s.id); this.h.close(); });
        egg.appendChild(b);
      });
      return;
    }
    for (const id of Object.keys(sim.crustEgg.titans)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sm';
      b.textContent = 'Fight ' + sim.crustEgg.titans[id].name;
      b.addEventListener('click', () => { this.h.titan(id); this.h.close(); });
      egg.appendChild(b);
    }
    // the rest of the egg: all four War Hammers forged on the Anvil, then the finale
    for (const [label, step] of [['Forge all four War Hammers', 'hammers'], ['Fight Big Evil Zach', 'zach']]) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sm';
      b.textContent = label;
      b.addEventListener('click', () => { if (this.h.crust) this.h.crust(step); this.h.close(); });
      egg.appendChild(b);
    }
  }

  open(sim, p) {
    this.sim = sim; this.p = p;
    this.round = Math.max(1, sim.rounds.round || 1);
    $('ep-egg').parentElement.hidden = !sim.quest && !sim.crustEgg;   // (the egg skips are the school's; the titans are Call of the Crust's)
    const mode = sim.crustEgg ? 'titans' : 'quest';
    if (this.eggMode !== mode) this.eggButtons(mode, sim);
    this.refresh();
    this.panel.hidden = false;
  }

  close() { this.panel.hidden = true; }
  get isOpen() { return !this.panel.hidden; }

  refresh() {
    const sim = this.sim, p = this.p;
    if (!sim || !p) return;
    const held = new Set(p.loadout.slots.map((s) => button(this.cfg, s.id)));
    const cur = button(this.cfg, p.loadout.slots[p.loadout.current].id);
    for (const b of $('ep-weapons').querySelectorAll('button[data-gear]')) b.classList.toggle('held', (p[GEAR[b.dataset.gear].have] || 0) > 0);
    for (const b of $('ep-weapons').querySelectorAll('button[data-id]')) {
      const id = b.dataset.id;
      const d = this.cfg.weapons[pick(this.cfg, id, this.upgraded)];
      b.classList.toggle('held', held.has(id));
      b.classList.toggle('current', id === cur);
      b.querySelector('.n').textContent = d.name;
      b.querySelector('.n').style.color = d.view.camo || '';
      b.querySelector('.w').textContent = d.wonder ? 'Wonder' : d.boxOnly ? 'Box' : d.cost ? `Wall ${d.cost}` : 'Start';
      b.querySelector('.s').textContent = weaponStatLine(d, this.cfg);
    }
    $('ep-round').textContent = String(this.round);
    $('ep-now').textContent = sim.explore && sim.explore.zombies ? `now: round ${sim.rounds.round}` : 'zombies are off';
    $('ep-zombies').checked = !!(sim.explore && sim.explore.zombies);
    // the egg: where you are now
    const q = sim.quest;
    if (!q) { $('ep-slots').textContent = p.loadout.slots.map((s, i) => `${i + 1}: ${this.cfg.weapons[s.id].name}`).join('   '); return; }
    const now = q ? QUEST_STEPS.indexOf(q.step) : -1;
    for (const b of $('ep-egg').querySelectorAll('button')) {
      const s = QUEST_SKIPS.find((x) => x.id === b.dataset.skip);
      const i = QUEST_STEPS.indexOf(s.step);
      b.classList.toggle('done', i < now);
      b.classList.toggle('on', i === now && (s.id !== 'schnitz' || (q.chopper.built && !q.schnitz)) && (s.id !== 'chopper' || !q.chopper.built) && (s.id !== 'blast' || !!(q.boss && q.boss.phase === 3)) && (s.id !== 'boss' || !(q.boss && q.boss.phase === 3)));
    }
    $('ep-slots').textContent = p.loadout.slots.map((s, i) => `${i + 1}: ${this.cfg.weapons[s.id].name}`).join('   ');
  }
}
