// =============================================================================
// The GobbleGum screen (from the title): build your pack of 5, see every gum
// and how many of each Mega you own, and spend Liquid Divinium at Dr. Monty's
// Factory. Pick a slot in your pack, then a gum to put in it (one already in
// the pack swaps places). It all lives on your career (src/career/career.js):
// signed in, it follows your username; as a guest, Classics only.
// =============================================================================
import { CONFIG } from '../config.js';

const $ = (id) => document.getElementById(id);
const G = () => CONFIG.gobblegum;
const isMega = (id) => { const d = G().gums[id]; return d.tier !== 'classic' && d.tier !== 'whimsical'; };
const KIND = { activated: 'Activated · press [H]', timed: 'Timed', rounds: 'Lasts rounds', special: 'Goes off on its own' };

export class GumsUI {
  constructor(career, { back }) {
    this.career = career;
    this.slot = 0;          // the pack slot being filled
    this.focus = null;      // the gum whose details are showing
    $('btn-gums-back').addEventListener('click', () => back());
    $('btn-gm-single').addEventListener('click', () => this.factory('single'));
    $('btn-gm-bundle').addEventListener('click', () => this.factory('bundle'));
  }

  open() {
    this.slot = 0;
    this.focus = this.career.gums.pack[0];
    $('gm-reveal').textContent = '';
    this.render();
    const first = $('gm-pack').querySelector('button');
    if (first) first.focus();
  }

  ball(id, extra = '') {
    const d = G().gums[id];
    return `<span class="gm-ball" style="--c:${G().tiers[d.tier].color}"></span><span>${d.name}</span>${extra}`;
  }

  count(id) {
    if (!isMega(id)) return '∞';
    return '×' + (this.career.gums.megas[id] || 0);
  }

  render() {
    const C = this.career, gums = C.gums, cfg = G();
    $('gm-div').textContent = String(gums.divinium);
    $('gm-tip').textContent = C.signedIn
      ? 'Pick a slot, then a gum to put in it. Each machine in a game gives you one of these 5 at random. A Mega\'s used up as it comes out of the machine; Classics never run out.'
      : 'Playing as a guest: Classics only, and no Liquid Divinium. Sign in (Career) to earn vials and own Megas.';
    // the pack
    const pack = $('gm-pack');
    pack.textContent = '';
    gums.pack.forEach((id, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'gm-slot';
      b.style.setProperty('--c', cfg.tiers[cfg.gums[id].tier].color);
      b.setAttribute('aria-pressed', String(i === this.slot));
      b.innerHTML = this.ball(id, `<span class="gm-n">${this.count(id)}</span>`);
      b.addEventListener('click', () => { this.slot = i; this.focus = id; this.render(); pack.children[i].focus(); });
      b.addEventListener('focus', () => this.detail(id));
      pack.appendChild(b);
    });
    // everything, by tier
    const list = $('gm-list');
    list.textContent = '';
    for (const [tier, t] of Object.entries(cfg.tiers)) {
      const ids = Object.keys(cfg.gums).filter((id) => cfg.gums[id].tier === tier);
      if (!ids.length) continue;
      const h = document.createElement('h3'); h.className = 'gm-tier'; h.style.setProperty('--c', t.color);
      const owned = ids.filter((id) => C.owns(id)).length;
      h.textContent = `${t.name} · ${owned} of ${ids.length}`;
      const grid = document.createElement('div'); grid.className = 'gm-grid';
      for (const id of ids) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'gm-gum' + (gums.pack.includes(id) ? ' inpack' : '');
        b.style.setProperty('--c', t.color);
        b.setAttribute('aria-pressed', String(id === this.focus));
        const has = C.owns(id);
        b.innerHTML = this.ball(id, `<span class="gm-n">${has ? this.count(id) : isMega(id) ? 'none' : 'sign in'}</span>`);
        if (!has && !gums.pack.includes(id)) b.disabled = true;
        b.addEventListener('focus', () => this.detail(id));
        b.addEventListener('mouseenter', () => this.detail(id));
        b.addEventListener('click', () => this.put(id));
        grid.appendChild(b);
      }
      list.append(h, grid);
    }
    // the factory
    const F = cfg.factory, pct = (x) => Math.round(x * 100) + '%';
    $('gm-odds').textContent = `${pct(F.odds.mega)} Mega, ${pct(F.odds.rare)} Rare, ${pct(F.odds.ultra)} Ultra-Rare`;
    const sb = $('btn-gm-single'), bb = $('btn-gm-bundle');
    sb.textContent = `${F.single.cost} vial → ${F.single.gums} Megas`;
    bb.textContent = `${F.bundle.cost} vials → ${F.bundle.gums} Megas`;
    sb.disabled = !C.signedIn || gums.divinium < F.single.cost;
    bb.disabled = !C.signedIn || gums.divinium < F.bundle.cost;
    $('gm-factory').hidden = false;
    this.detail(this.focus || gums.pack[this.slot]);
  }

  detail(id) {
    const d = id && G().gums[id];
    const el = $('gm-detail');
    if (!d) { el.textContent = ''; return; }
    const t = G().tiers[d.tier];
    el.style.setProperty('--c', t.color);
    el.innerHTML = `<b>${d.name}</b> <small>${t.name} · ${KIND[d.kind]}${isMega(id) ? ' · you have ' + (this.career.gums.megas[id] || 0) : ''}</small><p>${d.desc}</p>`;
  }

  // Put a gum in the selected slot (one already in the pack swaps with it)
  put(id) {
    const C = this.career, pack = [...C.gums.pack];
    if (!C.owns(id) && !pack.includes(id)) return;
    const at = pack.indexOf(id);
    if (at >= 0) { [pack[at], pack[this.slot]] = [pack[this.slot], pack[at]]; }
    else pack[this.slot] = id;
    C.setPack(pack);
    this.focus = id;
    this.slot = (this.slot + 1) % G().packSize;
    this.render();
  }

  factory(kind) {
    const got = this.career.openFactory(kind);
    if (!got) return;
    this.render();
    const box = $('gm-reveal');
    box.textContent = '';
    got.forEach((id, i) => {
      const d = G().gums[id];
      const el = document.createElement('div');
      el.className = 'gm-gum';
      el.style.setProperty('--c', G().tiers[d.tier].color);
      el.style.animationDelay = (i * 0.18) + 's';
      el.innerHTML = this.ball(id, `<span class="gm-n">${G().tiers[d.tier].name}</span>`);
      box.appendChild(el);
    });
  }
}
