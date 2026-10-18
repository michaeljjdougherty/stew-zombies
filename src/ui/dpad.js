// =============================================================================
// The D-pad, bottom right (like Black Ops 1): what each D-pad direction gives
// you right now. Right: your LBDs and how many are left. Down: the GobbleGum
// you set off yourself. Up: the emote wheel. On keyboard & mouse the cross
// goes and each one shows its key instead. Reads the player; never changes it.
// =============================================================================
import { gumIconURL } from '../render/gumIcons.js';
import { glyph } from '../input/glyphs.js';

const CSS = `
#dpad { position: relative; width: 92px; height: 92px; margin-top: 2px; }
#dpad[hidden] { display: none; }
#dpad .dp-ring { position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, rgba(20,14,10,.55) 0 58%, rgba(10,6,4,.75) 70%); box-shadow: 0 0 0 1.5px rgba(160,40,24,.55), 0 0 14px rgba(120,20,10,.45) inset; }
#dpad .dp-cross { position: absolute; left: 50%; top: 50%; width: 34px; height: 34px; margin: -17px; filter: drop-shadow(0 1px 1px #000); }
#dpad .dp-cross::before, #dpad .dp-cross::after { content: ""; position: absolute; border-radius: 3px; background: linear-gradient(135deg, #cfc8b8, #7c776c); }
#dpad .dp-cross::before { left: 11px; right: 11px; top: 0; bottom: 0; }
#dpad .dp-cross::after { top: 11px; bottom: 11px; left: 0; right: 0; }
body[data-input="kbm"] #dpad .dp-cross { display: none; }
#dpad .dp-slot { position: absolute; width: 30px; height: 30px; margin: -15px; display: grid; place-items: center; }
#dpad .dp-slot[hidden] { display: none; }
#dpad .dp-up { left: 50%; top: 15px; }
#dpad .dp-down { left: 50%; top: 77px; }
#dpad .dp-left { left: 15px; top: 50%; }
#dpad .dp-right { left: 77px; top: 50%; }
#dpad .dp-key { position: absolute; right: -6px; bottom: -5px; font-size: 10px; display: none; }
#dpad .dp-key kbd.glyph.key { padding: 1px 3px; }
body[data-input="kbm"] #dpad .dp-key { display: block; }
#dpad .dp-n { position: absolute; right: -4px; bottom: -4px; font: 700 11px var(--mono, monospace); color: var(--ink, #efe6d2); text-shadow: 0 1px 2px #000, 0 0 4px #000; }
body[data-input="kbm"] #dpad .dp-n { right: auto; left: -4px; }
#dpad .dp-slot.empty .dp-ico { opacity: .35; filter: grayscale(1); }
/* the LBD: the same sleeping baby as the gear row */
#dpad .dp-lbd { width: 16px; height: 17px; border-radius: 50% 50% 45% 45%; background: #e3c1a6; box-shadow: 0 1px 0 #000, inset 0 -6px 0 #f1ede6; position: relative; }
#dpad .dp-lbd::before { content: ""; position: absolute; left: 5px; top: 5px; width: 5px; height: 5px; border-radius: 50%; background: #d23a2a; }
#dpad .dp-gum { width: 24px; height: 24px; border-radius: 50%; background: var(--icon) center / cover no-repeat; box-shadow: 0 0 8px var(--c), 0 1px 2px #000; }
#dpad .dp-slot.on .dp-gum { animation: dpPulse .8s ease-in-out infinite alternate; }
@keyframes dpPulse { to { box-shadow: 0 0 16px var(--c), 0 1px 2px #000; } }
#dpad .dp-emote { width: 20px; height: 20px; color: #e8c46a; filter: drop-shadow(0 1px 1px #000); }
`;

// The emote wheel's mark: a little face.
const EMOTE_SVG = '<svg class="dp-ico dp-emote" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><path d="M6.3 11.6c1 1.6 2.2 2.3 3.7 2.3s2.7-.7 3.7-2.3"/><circle cx="7.2" cy="7.8" r=".6" fill="currentColor"/><circle cx="12.8" cy="7.8" r=".6" fill="currentColor"/></svg>';

// What sits on each direction (null = nothing there). Kept apart from the DOM
// so the headless tests can check it.
//   right  { kind: 'lbd', count }                 you've got LBDs (count 0 = used up this round)
//   down   { kind: 'gum', id, count, on }         an activated GobbleGum (count: uses left)
//   up     { kind: 'emote' }                      the emote wheel (always)
export function dpadSlots(p, cfg) {
  const out = { up: null, down: null, left: null, right: null };
  if (!p) return out;
  if ((p.lbds || 0) > 0 || (p.lbdMax || 0) > 0) out.right = { kind: 'lbd', count: Math.max(0, p.lbds || 0) };
  const g = p.gum, d = g && cfg.gobblegum && cfg.gobblegum.gums[g.id];
  if (d && g.kind === 'activated') out.down = { kind: 'gum', id: g.id, count: Math.max(0, g.uses || 0), on: !!(g.on && g.onUntil) };
  out.up = { kind: 'emote' };
  return out;
}

export class DPad {
  constructor(cfg, parent) {
    this.cfg = cfg;
    if (!document.getElementById('dpad-css')) {
      const st = document.createElement('style'); st.id = 'dpad-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    this.root = document.createElement('div');
    this.root.id = 'dpad';
    this.root.innerHTML = '<div class="dp-ring"></div><div class="dp-cross"></div>'
      + ['up', 'down', 'left', 'right'].map((s) => `<div class="dp-slot dp-${s}" hidden></div>`).join('');
    (parent || document.body).appendChild(this.root);
    this.slot = {};
    for (const s of ['up', 'down', 'left', 'right']) this.slot[s] = this.root.querySelector('.dp-' + s);
    this.last = {};
  }

  // device: 'kbm' | 'xbox' | 'ps' (the key badges only show on keyboard)
  update(p, device) {
    const S = dpadSlots(p, this.cfg);
    const G = this.cfg.gobblegum;
    for (const dir of ['up', 'down', 'left', 'right']) {
      const s = S[dir];
      const key = s ? `${s.kind}|${s.count ?? ''}|${s.id ?? ''}|${s.on ?? ''}|${device}` : '';
      if (key === this.last[dir]) continue;
      this.last[dir] = key;
      const el = this.slot[dir];
      el.hidden = !s;
      if (!s) { el.innerHTML = ''; continue; }
      const action = s.kind === 'lbd' ? 'mine' : s.kind === 'gum' ? 'gum' : 'emote';
      let ico = '';
      if (s.kind === 'lbd') ico = `<div class="dp-ico dp-lbd"></div><span class="dp-n">${s.count}</span>`;
      else if (s.kind === 'gum') {
        const d = G.gums[s.id];
        ico = `<div class="dp-ico dp-gum" style="--icon:url(${gumIconURL(s.id, 64)});--c:${G.tiers[d.tier].color}"></div><span class="dp-n">${s.count}</span>`;
      } else ico = EMOTE_SVG;
      el.innerHTML = ico + `<span class="dp-key">${glyph(action, 'kbm')}</span>`;
      el.classList.toggle('empty', s.kind === 'lbd' && s.count === 0);
      el.classList.toggle('on', !!s.on);
      el.title = s.kind === 'lbd' ? `LBD × ${s.count}` : s.kind === 'gum' ? G.gums[s.id].name : 'Emotes';
    }
  }
}
