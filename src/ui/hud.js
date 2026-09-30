// =============================================================================
// HUD: round tally, points (+popups), ammo, crosshair, hitmarker, prompts.
// Reads sim state; never changes it.
// =============================================================================
import { TallyCounter } from './tally.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(cfg) {
    this.cfg = cfg;
    this.root = $('hud');
    this.tally = new TallyCounter($('tally'), cfg);
    this.el = {
      points: $('points'), popups: $('popups'), wname: $('wname'), clip: $('clip'), reserve: $('reserve'),
      ammo: $('ammo'), cross: $('crosshair'), hit: $('hitmarker'), prompt: $('prompt'), hint: $('hint'), fps: $('fps'),
    };
    this.shownPoints = null;
    this.hitT = 0;
    this.fpsAcc = 0; this.fpsN = 0;
    this.localId = null;
    this.last = {};
  }

  show(on) { this.root.hidden = !on; }

  reset() {
    this.tally.round = 0; this.tally.anim = null; this.tally.blink = false;
    this.el.popups.textContent = '';
    this.shownPoints = null;
    this.last = {};
  }

  onEvent(e) {
    switch (e.type) {
      case 'roundStart': this.tally.setRound(e.round); break;
      case 'roundEnd': this.tally.setBlink(true); break;
      case 'points':
        if (e.playerId === this.localId) this.popup(e.amount, e.reason);
        break;
      case 'zombieHit':
        break;
      case 'shot':
        if (e.playerId === this.localId && this.cfg.hud.hitmarkers && e.impacts.some((h) => h.kind === 'zombie')) this.hitT = 0.12;
        break;
      case 'meleeHit':
        if (e.playerId === this.localId && this.cfg.hud.hitmarkers) this.hitT = 0.12;
        break;
    }
  }

  popup(amount, reason) {
    const d = document.createElement('div');
    d.className = 'popup' + (reason === 'headshot' || reason === 'knife' ? ' big' : '');
    d.textContent = (amount > 0 ? '+' : '') + amount;
    d.style.setProperty('--dx', `${Math.round(-30 - Math.random() * 70)}px`);
    d.style.setProperty('--dy', `${Math.round(-18 - Math.random() * 36)}px`);
    this.el.popups.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }

  set(key, el, value, prop = 'textContent') {
    if (this.last[key] === value) return;
    this.last[key] = value;
    el[prop] = value;
  }

  update(dt, sim, p, camera, showFps) {
    this.tally.update(dt);
    if (!p) return;

    // points count up quickly instead of snapping
    if (this.shownPoints === null) this.shownPoints = p.points;
    const diff = p.points - this.shownPoints;
    this.shownPoints += Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * Math.min(1, dt * 14)));
    if (Math.abs(p.points - this.shownPoints) < 1) this.shownPoints = p.points;
    this.set('points', this.el.points, String(Math.round(this.shownPoints)));

    // ammo
    const w = p.loadout;
    const slot = w.slots[w.current];
    const def = this.cfg.weapons[slot.id];
    this.set('wname', this.el.wname, def.name);
    this.set('clip', this.el.clip, String(slot.clip));
    this.set('reserve', this.el.reserve, String(slot.reserve));
    const low = slot.clip <= Math.ceil(def.magSize * this.cfg.hud.lowAmmoFraction);
    this.set('lowclass', this.el.ammo, low ? 'low' : '', 'className');

    // crosshair gap from current spread
    const hideCross = w.adsAmount > 0.5 || p.sprinting || !p.alive || p.melee.timer > 0;
    this.set('crossHidden', this.el.cross, hideCross ? 'hidden' : '', 'className');
    if (!hideCross) {
      const spread = (w.spreadNow || 2) * Math.PI / 180;
      const h = window.innerHeight;
      const gap = Math.tan(spread) / Math.tan((camera.fov * Math.PI / 180) / 2) * (h / 2);
      this.el.cross.style.setProperty('--gap', `${Math.max(4, Math.min(80, gap)).toFixed(1)}px`);
    }

    // hitmarker
    this.hitT = Math.max(0, this.hitT - dt);
    this.set('hit', this.el.hit, this.hitT > 0 ? 'on' : '', 'className');

    // prompt & hints
    let prompt = p.prompt ? p.prompt.text : '';
    if (p.rebuilding) prompt = 'Rebuilding barrier';
    this.set('prompt', this.el.prompt, prompt);
    let hint = '';
    if (slot.clip === 0 && slot.reserve === 0) hint = 'No ammo';
    else if (w.reloading) hint = '';
    else if (low && slot.reserve > 0) hint = 'Press [R] to reload';
    else if (low) hint = 'Low ammo';
    this.set('hint', this.el.hint, hint);

    if (showFps) {
      this.fpsAcc += dt; this.fpsN++;
      if (this.fpsAcc > 0.5) { this.el.fps.textContent = `${Math.round(this.fpsN / this.fpsAcc)} fps`; this.fpsAcc = 0; this.fpsN = 0; }
    } else if (this.el.fps.textContent) this.el.fps.textContent = '';
  }
}
