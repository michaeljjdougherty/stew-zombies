// =============================================================================
// Lineup screen UI: name tags over each character, a chip per character to
// fly the camera over, Face / Spin toggles, drag to rotate everyone.
// =============================================================================
import { CHARACTERS, LINEUP } from '../render/characters.js';

const $ = (id) => document.getElementById(id);

export class LineupUI {
  constructor(handlers) {
    this.h = handlers; // { lineup(), back() }
    this.tagEls = [];
    this.hint = 'Drag to turn them around. Pick someone to take a closer look.';
    const chips = $('lu-chips');
    const all = document.createElement('button');
    all.type = 'button'; all.textContent = 'Everyone'; all.setAttribute('role', 'tab'); all.dataset.i = '-1';
    chips.appendChild(all);
    LINEUP.forEach((id, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = CHARACTERS[id].name; b.setAttribute('role', 'tab'); b.dataset.i = String(i);
      if (CHARACTERS[id].villain) b.classList.add('villain');
      chips.appendChild(b);
      const t = document.createElement('span'); t.textContent = CHARACTERS[id].name;
      if (CHARACTERS[id].villain) t.classList.add('villain');
      $('lu-tags').appendChild(t); this.tagEls.push(t);
    });
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      this.h.lineup().setFocus(+b.dataset.i); this.refresh();
    });
    $('lu-face').addEventListener('click', () => {
      const L = this.h.lineup();
      if (L.focus < 0) L.setFocus(LINEUP.indexOf('kearns'));
      L.face = !L.face; this.refresh();
    });
    $('lu-spin').addEventListener('click', () => { const L = this.h.lineup(); L.autoSpin = !L.autoSpin; this.refresh(); });
    $('lu-back').addEventListener('click', () => this.h.back());
    // drag anywhere on the stage to turn them
    let drag = false, lastX = 0;
    const screen = $('lineup');
    screen.addEventListener('pointerdown', (e) => { if (e.target.closest('.panel-ui')) return; drag = true; lastX = e.clientX; screen.setPointerCapture(e.pointerId); });
    screen.addEventListener('pointermove', (e) => { if (!drag) return; this.h.lineup().drag(e.clientX - lastX); lastX = e.clientX; });
    screen.addEventListener('pointerup', () => { drag = false; });
    window.addEventListener('keydown', (e) => {
      if ($('lineup').hidden) return;
      const L = this.h.lineup();
      if (e.code === 'ArrowLeft') L.drag(-25);
      else if (e.code === 'ArrowRight') L.drag(25);
      else if (e.code === 'Escape') this.h.back();
    });
  }

  open() {
    const L = this.h.lineup();
    if (!L.built) {
      $('lu-status').textContent = 'Getting everyone in line…';
      // let the message paint before the (blocking) build
      setTimeout(() => { L.build(); this.showHint(); }, 60);
    } else this.showHint();
    this.refresh();
  }

  showHint() {
    if ($('lineup').hidden) return;
    if (this.h.lineup().built) $('lu-status').innerHTML = this.hint;
  }

  refresh() {
    const L = this.h.lineup();
    for (const b of $('lu-chips').querySelectorAll('button')) b.setAttribute('aria-selected', String(+b.dataset.i === L.focus));
    $('lu-face').setAttribute('aria-pressed', String(L.face && L.focus >= 0));
    $('lu-spin').setAttribute('aria-pressed', String(L.autoSpin));
  }

  // every frame while the screen is open
  update() {
    const L = this.h.lineup();
    if (!L.built) return;
    const tags = L.tags(window.innerWidth, window.innerHeight);
    tags.forEach((t, i) => {
      const el = this.tagEls[i];
      const hide = t.hidden || (L.focus >= 0 && L.face);
      el.hidden = hide;
      if (!hide) el.style.left = `${t.x.toFixed(0)}px`, el.style.top = `${t.y.toFixed(0)}px`;
    });
  }
}
