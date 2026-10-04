// =============================================================================
// Character select screen. The 3D view is the Showcase (src/render/showcase.js);
// this wires up the list, the shirt swatches and the buttons.
// =============================================================================
import { CHARACTERS, SHIRT_COLORS } from '../render/characters.js';

const $ = (id) => document.getElementById(id);

export class CharSelect {
  constructor(settings, handlers) {
    this.settings = settings;
    this.h = handlers; // { preview(id, shirt), done(), back() }
    this.pick = settings.character || 'kearns';
    this.shirt = settings.shirt || 'sage';
    const list = $('cs-list');
    this.cards = [];
    for (const [id, c] of Object.entries(CHARACTERS)) {
      if (!c.playable && !c.unlock) continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cs-card'; b.setAttribute('role', 'option'); b.dataset.id = id;
      b.innerHTML = '<b></b><span>Stew</span>';
      b.querySelector('b').textContent = c.name;
      b.addEventListener('click', () => { if (this.unlocked(id)) { this.pick = id; this.refresh(); } });
      list.appendChild(b);
      this.cards.push(b);
    }
    const sw = $('cs-swatches');
    for (const [id, s] of Object.entries(SHIRT_COLORS)) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.id = id; b.title = s.name; b.setAttribute('aria-label', s.name);
      b.style.setProperty('--c', s.hex);
      b.addEventListener('click', () => { this.shirt = id; this.refresh(); });
      sw.appendChild(b);
    }
    $('btn-cs-select').addEventListener('click', () => {
      this.settings.character = this.pick; this.settings.shirt = this.shirt;
      this.h.done(this.settings);
    });
    $('btn-cs-back').addEventListener('click', () => this.h.back());
    $('btn-cs-lineup').addEventListener('click', () => this.h.lineup());
  }

  unlocked(id) {
    const c = CHARACTERS[id];
    return !!(c && (c.playable || (c.unlock === 'quest' && this.h.questDone && this.h.questDone())));
  }

  open() {
    // Brian: locked until you've finished The Final Whistle
    for (const b of this.cards) {
      const id = b.dataset.id, ok = this.unlocked(id);
      b.classList.toggle('locked', !ok);
      b.querySelector('b').textContent = ok ? CHARACTERS[id].name : '???';
      b.querySelector('span').textContent = ok ? 'Stew' : 'Finish The Final Whistle';
    }
    this.pick = this.settings.character || 'kearns';
    if (!this.unlocked(this.pick)) this.pick = 'kearns';
    this.shirt = this.settings.shirt || 'sage';
    this.refresh();
  }

  refresh() {
    const c = CHARACTERS[this.pick];
    $('cs-name').textContent = c.name;
    $('cs-blurb').textContent = c.blurb;
    $('btn-cs-select').textContent = `Play as ${c.name}`;
    // only Kearns's T-shirt changes colour
    const sh = $('cs-swatches').parentElement;
    if (sh) sh.hidden = c.top.color !== 'shirt';
    for (const b of $('cs-list').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.id === this.pick));
    for (const b of $('cs-swatches').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.id === this.shirt));
    this.h.preview(this.pick, this.shirt);
  }
}
