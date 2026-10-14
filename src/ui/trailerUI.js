// =============================================================================
// The trailer's overlay: letterbox bars the whole way through, black behind the
// intro's text cards, the words themselves (fading in on black, slamming onto
// the action, a hero's name beside them), and a Skip button that only shows
// while the mouse is moving. Driven by the trailer's own clock (not the wall
// clock), so a recorded export comes out exactly like playback.
// =============================================================================
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class TrailerUI {
  constructor(onSkip) {
    const el = this.el = document.createElement('div');
    el.id = 'trailer-ui';
    el.innerHTML = `
      <div class="tr-black"></div>
      <div class="tr-card"><div class="tr-text"></div><div class="tr-sub"></div></div>
      <div class="tr-bar tr-top"></div><div class="tr-bar tr-bottom"></div>
      <button type="button" class="tr-skip">Skip ▸</button>`;
    document.body.appendChild(el);
    this.black = el.querySelector('.tr-black');
    this.card = el.querySelector('.tr-card');
    this.text = el.querySelector('.tr-text');
    this.sub = el.querySelector('.tr-sub');
    this.skipBtn = el.querySelector('.tr-skip');
    this.skipBtn.addEventListener('click', () => onSkip && onSkip());
    this.top = el.querySelector('.tr-top');
    this.bottom = el.querySelector('.tr-bottom');
    this.moved = -1e9;
    this.onMove = () => { this.moved = performance.now(); };
    window.addEventListener('mousemove', this.onMove);
    this.hide();
  }

  show(aspect = 2.39) {
    this.aspect = aspect;
    this.el.hidden = false;
    document.body.classList.add('trailer-on');
    this.moved = -1e9;
  }
  hide() { this.el.hidden = true; document.body.classList.remove('trailer-on'); }

  update(tr, recording = false) {
    const W = window.innerWidth, H = window.innerHeight;
    const bar = Math.max(0, (H - W / this.aspect) / 2);
    this.top.style.height = this.bottom.style.height = bar + 'px';
    const moving = !recording && performance.now() - this.moved < 2200;
    this.skipBtn.classList.toggle('on', moving);
    document.body.classList.toggle('trailer-moved', moving);
    const t = tr.t, C = tr.C;
    const cards = tr.times.cards.filter((c) => t >= c.t0 && t < c.t1);
    const c = cards[cards.length - 1];
    // black: the intro's cards, black shots, and the fade at the very end
    const endFade = sm(C.end - 1.2, C.end - 0.2, t);
    const blackCard = c && (c.style === 'card' || c.style === 'slam' || c.style === 'title');
    this.black.style.opacity = tr.black || blackCard ? 1 : endFade;
    if (!c) { this.card.style.opacity = 0; return; }
    const u = t - c.t0, d = c.t1 - c.t0;
    this.card.className = 'tr-card tr-' + c.style + (c.side ? ' tr-' + c.side : '');
    if (this.text.textContent !== c.text) this.text.textContent = c.text;
    const sub = c.sub || '';
    if (this.sub.textContent !== sub) this.sub.textContent = sub;
    let op = 1, sc = 1, x = 0, blur = 0;
    if (c.style === 'card') { op = sm(0, 0.45, u) * (1 - sm(d - 0.35, d, u)); sc = 1 + u * 0.015; }
    else if (c.style === 'slam' || c.style === 'overlay') {
      const k = sm(0, 0.12, u);
      sc = 1.7 - 0.7 * k; op = k * (1 - sm(d - 0.15, d, u));
      blur = (1 - k) * 8;
      if (c.style === 'overlay') x = Math.sin(u * 90) * 6 * (1 - sm(0.12, 0.3, u));
    } else if (c.style === 'name') {
      const k = sm(0, 0.25, u);
      op = k * (1 - sm(d - 0.25, d, u)); x = (1 - k) * (c.side === 'right' ? 60 : -60);
    } else if (c.style === 'title') { op = sm(0, 0.35, u) * (1 - sm(d - 0.3, d, u)); sc = 1.08 - sm(0, 0.6, u) * 0.08; }
    this.card.style.opacity = op;
    this.card.style.transform = `translateX(${x}px) scale(${sc})`;
    this.card.style.filter = blur ? `blur(${blur.toFixed(1)}px)` : '';
  }

  dispose() { window.removeEventListener('mousemove', this.onMove); this.el.remove(); }
}
