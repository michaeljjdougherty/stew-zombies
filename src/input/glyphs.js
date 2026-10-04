// =============================================================================
// Button prompts. Every place that shows a control (HUD prompts, hints, the
// controls list, menus) asks this module, so the prompts follow whatever the
// player last touched: keyboard & mouse, an Xbox pad or a PlayStation pad.
// =============================================================================

// device: 'kbm' | 'xbox' | 'ps'
export const LABELS = {
  kbm: {
    use: 'F', reload: 'R', jump: 'Space', crouch: 'C', sprint: 'Shift', melee: 'V · E', fire: 'Left click', ads: 'Right click',
    grenade: 'G', tactical: 'Q', swap: '1 · 2', pause: 'Esc', panel: 'B', zombies: 'Z', move: 'W A S D', look: 'Mouse',
    confirm: 'Enter', back: 'Esc', skip: 'Esc', rotate: 'Drag', prev: '←', next: '→', adjust: '← →', scroll: 'Wheel',
  },
  xbox: {
    use: 'X', reload: 'X', jump: 'A', crouch: 'B', sprint: 'LS', melee: 'RS', fire: 'RT', ads: 'LT',
    grenade: 'RB', tactical: 'LB', swap: 'Y', pause: 'Menu', panel: 'View', zombies: 'View', move: 'L-stick', look: 'R-stick',
    confirm: 'A', back: 'B', skip: 'A', rotate: 'R-stick', prev: 'LB', next: 'RB', adjust: 'D-pad ← →', scroll: 'R-stick',
  },
  ps: {
    use: '□', reload: '□', jump: '✕', crouch: '○', sprint: 'L3', melee: 'R3', fire: 'R2', ads: 'L2',
    grenade: 'R1', tactical: 'L1', swap: '△', pause: 'Options', panel: 'Create', zombies: 'Create', move: 'L-stick', look: 'R-stick',
    confirm: '✕', back: '○', skip: '✕', rotate: 'R-stick', prev: 'L1', next: 'R1', adjust: 'D-pad ← →', scroll: 'R-stick',
  },
};

// Face-button colours (Xbox letters, PlayStation shapes).
const FACE = {
  xbox: { A: 'a', B: 'b', X: 'x', Y: 'y' },
  ps: { '✕': 'cross', '○': 'circle', '□': 'square', '△': 'triangle' },
};

let device = 'kbm';
export const getDevice = () => device;
export function setDevice(d) { device = d; }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// HTML for one control.
export function glyph(action, dev = device) {
  const label = (LABELS[dev] || LABELS.kbm)[action] ?? action;
  if (dev === 'kbm') return `<kbd class="glyph key">${esc(label)}</kbd>`;
  const face = FACE[dev] && FACE[dev][label];
  if (face) return `<span class="glyph pad face ${dev} f-${face}" aria-label="${esc(label)}">${esc(label)}</span>`;
  return `<span class="glyph pad ${dev}">${esc(label)}</span>`;
}

// Plain-text label (for places that can't take HTML).
export const label = (action, dev = device) => (LABELS[dev] || LABELS.kbm)[action] ?? action;

// The sim and older UI text name keyboard keys in brackets ("Press [F] to
// open door"). Swap each one for the right glyph.
const KEY_TO_ACTION = { F: 'use', R: 'reload', B: 'panel', Z: 'zombies', G: 'grenade', Q: 'tactical', C: 'crouch', V: 'melee', Esc: 'pause' };
export function glyphify(text, dev = device) {
  return esc(text).replace(/\[(F|R|B|Z|G|Q|C|V|Esc)\]/g, (m, k) => glyph(KEY_TO_ACTION[k], dev));
}

// Elements marked data-glyph="action" show that control; data-glyph-text
// holds bracketed text to convert.
export function applyGlyphs(root = document) {
  for (const el of root.querySelectorAll('[data-glyph]')) el.innerHTML = glyph(el.dataset.glyph);
  for (const el of root.querySelectorAll('[data-glyph-text]')) el.innerHTML = glyphify(el.dataset.glyphText);
}

// The button legend along the bottom of each menu when using a controller.
const LEGEND = {
  title: [['confirm', 'Select']],
  gameover: [['confirm', 'Select']],
  pause: [['confirm', 'Select'], ['back', 'Resume']],
  settings: [['confirm', 'Select'], ['adjust', 'Adjust'], ['back', 'Back']],
  extras: [['confirm', 'Select'], ['prev', ''], ['next', 'Tabs'], ['scroll', 'Scroll'], ['back', 'Back']],
  charselect: [['confirm', 'Select'], ['prev', ''], ['next', 'T-shirt'], ['rotate', 'Turn'], ['back', 'Back']],
  lineup: [['confirm', 'Select'], ['prev', ''], ['next', 'Character'], ['rotate', 'Turn'], ['back', 'Back']],
  rangepanel: [['confirm', 'Select'], ['scroll', 'Scroll'], ['back', 'Close']],
};
export function legend(screen, dev = device) {
  const rows = LEGEND[screen];
  if (!rows || dev === 'kbm') return '';
  return rows.map(([a, t]) => `${glyph(a, dev)}${t ? `<span>${esc(t)}</span>` : ''}`).join('');
}

// The controls list for the title screen.
export function controlsList(dev = device) {
  const rows = dev === 'kbm' ? [
    ['move', 'Move'], ['look', 'Look · left click fires · right click aims'], ['sprint', 'Sprint (hold)'], ['jump', 'Jump'], ['crouch', 'Crouch'],
    ['reload', 'Reload (sprint to cancel)'], ['melee', 'Knife'], ['grenade', 'Frag grenade (hold to cook)'], ['tactical', 'Stew Bomb'],
    ['use', 'Buy and use things · hold to rebuild barriers'], ['swap', 'Switch weapons (or the wheel)'], ['zombies', 'Explore mode: zombies on / off'], ['pause', 'Pause'],
  ] : [
    ['move', 'Move'], ['look', 'Look'], ['fire', 'Fire'], ['ads', 'Aim down sights'], ['sprint', 'Sprint (click)'], ['jump', 'Jump'], ['crouch', 'Crouch (toggle)'],
    ['use', 'Buy and use things · reload when there\'s nothing to buy · hold to rebuild'], ['melee', 'Knife'], ['grenade', 'Frag grenade (hold to cook)'],
    ['tactical', 'Stew Bomb'], ['swap', 'Switch weapons'], ['zombies', 'Explore mode: zombies on / off · Firing range: weapons panel'], ['pause', 'Pause'],
  ];
  return rows.map(([a, t]) => `<dt>${glyph(a, dev)}</dt><dd>${esc(t)}</dd>`).join('');
}
