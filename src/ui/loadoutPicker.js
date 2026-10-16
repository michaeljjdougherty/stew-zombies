// =============================================================================
// "Playing as": a compact character and skin picker on the map screen, so you
// can change who you are and what they're wearing right before you play. It
// uses the same saved choices as Characters and the Stew Store (the settings'
// character, and the skin your career has on them), so they all stay in step.
// Skins: just the ones you own that fit them (their own clothes first).
// =============================================================================
const $ = (id) => document.getElementById(id);

export class LoadoutPicker {
  // h: { characters() -> [{ id, name }], current() -> id, pickChar(id), skins(id) -> [{ id, name }], worn(id) -> skin id | '', pickSkin(charId, skinId) }
  constructor(h, ids = { chars: 'ms-who-chars', skins: 'ms-who-skins', hint: 'ms-who-hint' }) {
    this.h = h;
    this.ids = ids;
  }

  render() {
    const cur = this.h.current();
    this.row($(this.ids.chars), this.h.characters(), cur, (id) => { this.h.pickChar(id); this.render(); });
    const skins = this.h.skins(cur);
    this.row($(this.ids.skins), skins, this.h.worn(cur) || '', (id) => { this.h.pickSkin(cur, id); this.render(); });
    const hint = $(this.ids.hint);
    if (hint) hint.textContent = skins.length > 1 ? '' : 'Get skins in the Stew Store.';
  }

  // one row of chips (rebuilt only when what's in it changes)
  row(box, list, sel, pick) {
    if (!box) return;
    const key = list.map((x) => x.id).join();
    if (box.dataset.key !== key) {
      box.dataset.key = key;
      box.textContent = '';
      for (const it of list) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'ms-chip'; b.dataset.id = it.id; b.setAttribute('role', 'radio');
        b.textContent = it.name;
        b.addEventListener('click', () => pick(it.id));
        box.appendChild(b);
      }
    }
    for (const b of box.children) b.setAttribute('aria-checked', String(b.dataset.id === sel));
  }
}
