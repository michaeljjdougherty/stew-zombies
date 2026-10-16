// =============================================================================
// Dr. Monty's Factory, after Black Ops 3's: the Liquid Divinium sign and its
// counter on the left, three vats, and three buttons under them. Button n
// powers up n vats (CONFIG.gobblegum.factory.vats[n-1]: its cost in vials and
// how many Megas they brew between them). The vats bubble and spark, their
// copper doors open, and the gums are inside; the list underneath names them.
// The vials and the gums are your career's (src/career/career.js openFactory).
// =============================================================================
import { CONFIG } from '../config.js';
import { gumIconURL } from '../render/gumIcons.js';

const $ = (id) => document.getElementById(id);
const F = () => CONFIG.gobblegum.factory;
const LAMPS = ['#3ec24a', '#e0b22a', '#d8331f'];   // the buttons' lamps: green, amber, red
const TIER_RANK = { mega: 0, rare: 1, ultra: 2 };

export class FactoryUI {
  // h: { back(), sound(stage, n) }  stage: 'power' | 'open' | 'deny'
  constructor(career, h) {
    this.career = career;
    this.h = h;
    this.root = $('factory');
    this.plaque = $('mf-plaque');
    this.timers = [];
    this.busy = false;
    this.sel = 1;
    this.buildVats();
    this.buildButtons();
    $('btn-mf-back').addEventListener('click', () => { this.stop(); this.h.back(); });
  }

  buildVats() {
    const box = $('mf-vats');
    box.textContent = '';
    this.vats = [0, 1, 2].map((i) => {
      const v = document.createElement('div');
      v.className = 'mf-vat';
      v.innerHTML = `<div class="mf-top"><i class="mf-coil"></i><i class="mf-coil"></i><i class="mf-coil"></i></div>
        <div class="mf-label"><span>Vat ${i + 1}</span></div>
        <div class="mf-tank"><i class="mf-gauge g1"></i><i class="mf-gauge g2"></i>
          <div class="mf-port"><div class="mf-brew"><i></i><i></i><i></i><i></i><i></i><i></i></div>
            <div class="mf-gums"></div><div class="mf-door l"></div><div class="mf-door r"></div></div></div>
        <div class="mf-base"></div>`;
      box.appendChild(v);
      return v;
    });
  }

  buildButtons() {
    const box = $('mf-btns');
    box.textContent = '';
    this.btns = F().vats.map((deal, i) => {
      const n = i + 1;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mf-btn';
      b.style.setProperty('--lamp', LAMPS[i % LAMPS.length]);
      b.innerHTML = `<span class="mf-lamp"></span><span class="mf-num">${n}</span><small>${deal.cost} vial${deal.cost === 1 ? '' : 's'}</small>`;
      b.addEventListener('focus', () => this.preview(n));
      b.addEventListener('mouseenter', () => this.preview(n));
      b.addEventListener('click', () => this.power(n));
      box.appendChild(b);
      return b;
    });
    if (this.btns[0]) this.btns[0].dataset.navFirst = '';
  }

  open() {
    this.stop();
    for (const v of this.vats) { v.className = 'mf-vat'; v.querySelector('.mf-gums').textContent = ''; v.querySelector('.mf-label span').textContent = `Vat ${this.vats.indexOf(v) + 1}`; }
    $('mf-got').textContent = '';
    this.render();
    this.preview(1);
    setTimeout(() => this.btns[0] && this.btns[0].focus({ preventScroll: true }), 30);
  }

  stop() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.busy = false;
    this.root.classList.remove('busy');
  }

  // the counter: three glowing digits
  showCount(n) {
    const s = String(Math.max(0, Math.min(999, n))).padStart(3, '0');
    $('mf-count').innerHTML = [...s].map((d) => `<i>${d}</i>`).join('');
  }

  render() {
    const C = this.career, div = C.gums.divinium;
    this.showCount(div);
    F().vats.forEach((deal, i) => this.btns[i].setAttribute('aria-disabled', String(!C.signedIn || div < deal.cost)));
    const pct = (x) => Math.round(x * 100) + '%';
    $('mf-note').textContent = C.signedIn
      ? `Liquid Divinium in, Mega GobbleGums out: ${pct(F().odds.mega)} Mega, ${pct(F().odds.rare)} Rare, ${pct(F().odds.ultra)} Ultra-Rare. Earn vials by playing (the longer you last, the more).`
      : 'Playing as a guest: no Liquid Divinium. Sign in (Settings › Switch username) to earn vials and own Megas.';
  }

  say(text, bad = false) {
    this.plaque.textContent = text;
    this.plaque.classList.remove('bad');
    if (bad) { void this.plaque.offsetWidth; this.plaque.classList.add('bad'); }
  }

  // Hovering or picking a button: light that many vats' outlines, and the plaque says so
  preview(n) {
    if (this.busy) return;
    this.sel = n;
    const deal = F().vats[n - 1];
    this.btns.forEach((b, i) => b.classList.toggle('sel', i === n - 1));
    this.vats.forEach((v, i) => v.classList.toggle('armed', i < n));
    this.say(`Power up ${n} vat${n === 1 ? '' : 's'}.`);
    $('mf-deal').textContent = `${deal.cost} vial${deal.cost === 1 ? '' : 's'} → ${deal.gums} Mega GobbleGums`;
  }

  power(n) {
    if (this.busy) return;
    const C = this.career, deal = F().vats[n - 1];
    this.preview(n);
    if (!C.signedIn) { this.say('Sign in to use the factory.', true); this.h.sound('deny'); return; }
    if (C.gums.divinium < deal.cost) { this.say('Not enough Liquid Divinium.', true); this.h.sound('deny'); return; }
    const before = C.gums.divinium;
    const got = C.openFactory(n);
    if (!got) { this.say('The vats won\'t start. Try again.', true); this.h.sound('deny'); return; }
    this.busy = true;
    this.root.classList.add('busy');
    $('mf-got').textContent = '';
    // count the vials down into the vats
    for (let k = 1; k <= deal.cost; k++) this.later(k * 140, () => this.showCount(before - k));
    // share the gums out between the powered vats (3 vats, 7 gums: 3, 2, 2)
    const per = Array.from({ length: n }, () => []);
    got.forEach((id, i) => per[i % n].push(id));
    this.vats.forEach((v, i) => {
      v.className = 'mf-vat' + (i < n ? ' armed lit' : '');
      v.querySelector('.mf-gums').textContent = '';
      v.querySelector('.mf-label span').textContent = i < n ? 'Brewing…' : `Vat ${i + 1}`;
    });
    this.say(`Powering up ${n} vat${n === 1 ? '' : 's'}…`);
    this.h.sound('power', n);
    const brew = F().brew * 1000, pop = F().pop * 1000;
    let t = brew;
    per.forEach((ids, i) => {
      const v = this.vats[i];
      this.later(t, () => {
        v.classList.add('open');
        const g = CONFIG.gobblegum;
        const best = ids.reduce((a, id) => (TIER_RANK[g.gums[id].tier] > TIER_RANK[g.gums[a].tier] ? id : a), ids[0]);
        const tier = g.tiers[g.gums[best].tier];
        const label = v.querySelector('.mf-label');
        label.style.setProperty('--tc', tier.color);
        label.querySelector('span').textContent = tier.name;
        v.querySelector('.mf-gums').innerHTML = ids.map((id, k) => `<img alt="${g.gums[id].name}" title="${g.gums[id].name}" src="${gumIconURL(id, 128)}" style="animation-delay:${(0.35 + k * F().pop).toFixed(2)}s">`).join('');
        this.h.sound('open', i);
      });
      t += 380 + ids.length * pop;
    });
    this.later(t + 250, () => {
      const g = CONFIG.gobblegum;
      $('mf-got').innerHTML = got.map((id, k) => {
        const d = g.gums[id], tier = g.tiers[d.tier];
        return `<span class="mf-chip" style="--c:${tier.color};animation-delay:${(k * 0.06).toFixed(2)}s"><img alt="" src="${gumIconURL(id, 72)}"><span>${d.name}<small>${tier.name} · you have ${C.gums.megas[id] || 0}</small></span></span>`;
      }).join('');
      this.busy = false;
      this.root.classList.remove('busy');
      this.render();
      this.say(`${got.length} Mega GobbleGums! Power up again?`);
    });
  }

  later(ms, fn) { this.timers.push(setTimeout(fn, ms)); }
}
