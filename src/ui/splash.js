// =============================================================================
// Boot splash: the Tiger Fish Interactive logo flickers on out of the dark
// while zombies moan, then fades into the title screen.
//
// Browsers won't play sound until the first click or key press, so the logo
// waits behind "Click or press any key"; that press starts the moans and the
// flicker. (The overlay itself is in index.html so it's up while the game loads.)
// =============================================================================
const $ = (id) => document.getElementById(id);

export class Splash {
  // h: { sound() — called inside the click/key press; done() — after the fade }
  constructor(cfg, h) {
    this.cfg = cfg;
    this.h = h;
    this.el = $('splash');
    this.hint = this.el && this.el.querySelector('.sp-hint');
    this.state = this.el ? 'waiting' : 'gone';
    if (!this.el) return;
    if (this.hint) this.hint.textContent = 'Click or press any key';
    this.el.focus({ preventScroll: true });
    // a press anywhere starts it (and, once it's going, skips it)
    this.onPress = (e) => {
      if (this.state === 'gone') return;
      if (e.type === 'keydown' && (e.repeat || e.key === 'Tab')) return;
      this.press();
      // keep the key from also driving the title menu underneath
      if (e.type === 'keydown') { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, this.onPress, { capture: true });
    this.el.addEventListener('click', () => this.press());   // (a controller's A clicks the focused overlay)
  }

  get active() { return this.state !== 'gone'; }

  press() {
    if (this.state === 'waiting') this.begin();
    else if (this.state === 'playing' && performance.now() - this.startedAt > this.cfg.skipAfter * 1000) this.finish();
  }

  begin() {
    this.state = 'playing';
    this.startedAt = performance.now();
    this.el.classList.add('go');
    try { this.h.sound(); } catch (e) { console.warn('splash sound', e); }
    this.timer = setTimeout(() => this.finish(), this.cfg.hold * 1000);
  }

  // Fade out to the title (also used to skip it outright: ?nosplash, invite links).
  finish(instant = false) {
    if (this.state === 'gone' || this.state === 'fading') return;
    clearTimeout(this.timer);
    this.state = 'fading';
    this.el.classList.add('out');
    const end = () => {
      this.state = 'gone';
      this.el.hidden = true;
      for (const ev of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(ev, this.onPress, { capture: true });
      this.h.done();
    };
    if (instant) end(); else setTimeout(end, this.cfg.fade * 1000);
  }
}
