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
    for (const [id, c] of Object.entries(CHARACTERS)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cs-card'; b.setAttribute('role', 'option'); b.dataset.id = id;
      b.innerHTML = '<b></b><span>Stew</span>';
      b.querySelector('b').textContent = c.name;
      b.addEventListener('click', () => { this.pick = id; this.refresh(); });
      list.appendChild(b);
    }
    // the rest of Stew are on their way
    for (const n of ['???', '???', '???']) {
      const b = document.createElement('div');
      b.className = 'cs-card locked'; b.innerHTML = `<b>${n}</b><span>Coming soon</span>`;
      list.appendChild(b);
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
  }

  open() {
    this.pick = this.settings.character || 'kearns';
    this.shirt = this.settings.shirt || 'sage';
    this.refresh();
  }

  refresh() {
    const c = CHARACTERS[this.pick];
    $('cs-name').textContent = c.name;
    $('cs-blurb').textContent = c.blurb;
    $('btn-cs-select').textContent = `Play as ${c.name}`;
    for (const b of $('cs-list').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.id === this.pick));
    for (const b of $('cs-swatches').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.id === this.shirt));
    this.h.preview(this.pick, this.shirt);
  }
}
