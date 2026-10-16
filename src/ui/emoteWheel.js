// =============================================================================
// The emote wheel: hold [B] (D-pad up on a controller), point at an emote with
// the mouse or the right stick, let go to do it. Only the emotes you own are on
// it (src/career/emotes.js). The emote itself is the sim's (p.emote); the
// camera pulls back to watch it (src/render/renderer.js).
// =============================================================================
const NS = 'http://www.w3.org/2000/svg';
const CSS = `
#emote-wheel { position: fixed; inset: 0; display: grid; place-items: center; pointer-events: none; z-index: 40; }
#emote-wheel[hidden] { display: none; }
#emote-wheel svg { width: min(62vmin, 440px); height: min(62vmin, 440px); overflow: visible; filter: drop-shadow(0 6px 24px rgba(0,0,0,.6)); }
#emote-wheel .ew-slice { fill: rgba(16,12,9,.82); stroke: rgba(217,180,90,.35); stroke-width: 1.5; transition: fill .08s; }
#emote-wheel .ew-slice.on { fill: rgba(150,104,34,.85); stroke: #e8c46a; }
#emote-wheel text { fill: #efe6d2; font-family: var(--display, Impact, sans-serif); font-size: 15px; letter-spacing: 1px; text-transform: uppercase; text-anchor: middle; dominant-baseline: middle; }
#emote-wheel .ew-hub { fill: rgba(10,8,6,.9); stroke: rgba(217,180,90,.5); stroke-width: 1.5; }
#emote-wheel .ew-name { font-size: 13px; fill: #e8b13a; }
#emote-wheel .ew-hint { font-size: 9px; fill: #9a8f7c; font-family: system-ui, sans-serif; letter-spacing: 1.5px; }
`;

export class EmoteWheel {
  constructor() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.root = document.createElement('div');
    this.root.id = 'emote-wheel'; this.root.hidden = true; this.root.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.root);
    this.list = [];
    this.key = '';
    this.sel = -1;
  }

  build(list) {
    const key = list.map((e) => e.id).join();
    if (key === this.key) return;
    this.key = key; this.list = list;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-200 -200 400 400');
    const n = Math.max(1, list.length), R = 190, r = 62;
    this.slices = list.map((e, i) => {
      const a0 = (i - 0.5) / n * Math.PI * 2 - Math.PI / 2, a1 = (i + 0.5) / n * Math.PI * 2 - Math.PI / 2;
      const P = (rad, a) => `${(Math.cos(a) * rad).toFixed(1)} ${(Math.sin(a) * rad).toFixed(1)}`;
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', n === 1
        ? `M ${R} 0 A ${R} ${R} 0 1 1 ${-R} 0 A ${R} ${R} 0 1 1 ${R} 0 Z`
        : `M ${P(r, a0)} L ${P(R, a0)} A ${R} ${R} 0 0 1 ${P(R, a1)} L ${P(r, a1)} A ${r} ${r} 0 0 0 ${P(r, a0)} Z`);
      path.setAttribute('class', 'ew-slice');
      svg.appendChild(path);
      const am = i / n * Math.PI * 2 - Math.PI / 2;
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', (Math.cos(am) * 128).toFixed(1)); t.setAttribute('y', (Math.sin(am) * 128).toFixed(1));
      const words = e.name.split(' ');
      if (words.length > 1 && e.name.length > 10) {
        words.forEach((w, j) => { const ts = document.createElementNS(NS, 'tspan'); ts.setAttribute('x', t.getAttribute('x')); ts.setAttribute('dy', j ? '1.15em' : `${-(words.length - 1) * 0.55}em`); ts.textContent = w; t.appendChild(ts); });
      } else t.textContent = e.name;
      svg.appendChild(t);
      return path;
    });
    const hub = document.createElementNS(NS, 'circle'); hub.setAttribute('r', String(r - 4)); hub.setAttribute('class', 'ew-hub'); svg.appendChild(hub);
    this.nameEl = document.createElementNS(NS, 'text'); this.nameEl.setAttribute('class', 'ew-name'); this.nameEl.setAttribute('y', '-6'); svg.appendChild(this.nameEl);
    const hint = document.createElementNS(NS, 'text'); hint.setAttribute('class', 'ew-hint'); hint.setAttribute('y', '14'); hint.textContent = 'LET GO TO EMOTE'; svg.appendChild(hint);
    this.root.textContent = '';
    this.root.appendChild(svg);
  }

  // Every frame. list: the emotes you own; active: you're in a game and can use it.
  // Returns the emote picked this frame (or null).
  update(input, list, active) {
    const W = input.emoteWheel;
    if (!active || !list.length) { if (W.open) this.close(input); return null; }
    const held = input.emoteHeld();
    if (!W.open) {
      if (!held) return null;
      this.build(list);
      W.open = true; W.x = 0; W.y = 0;
      this.sel = -1;
      this.root.hidden = false;
    }
    // what you're pointing at
    const n = this.list.length;
    let sel = -1;
    if (Math.hypot(W.x, W.y) > 30) {
      const a = Math.atan2(W.y, W.x) + Math.PI / 2;
      sel = ((Math.round(a / (Math.PI * 2) * n) % n) + n) % n;
    }
    if (sel !== this.sel) {
      this.sel = sel;
      this.slices.forEach((s, i) => s.classList.toggle('on', i === sel));
      this.nameEl.textContent = sel >= 0 ? '' : 'Emotes';
    }
    if (held) return null;
    const pick = sel >= 0 ? this.list[sel].id : null;
    this.close(input);
    return pick;
  }

  close(input) {
    input.emoteWheel.open = false;
    this.root.hidden = true;
    this.sel = -1;
  }
}
