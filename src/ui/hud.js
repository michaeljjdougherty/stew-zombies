// =============================================================================
// HUD: round tally, points (+popups), ammo, crosshair, hitmarker, prompts.
// Reads sim state; never changes it.
// =============================================================================
import { TallyCounter } from './tally.js';
import { powerupIconURL } from '../render/powerupIcons.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(cfg) {
    this.cfg = cfg;
    this.root = $('hud');
    this.tally = new TallyCounter($('tally'), cfg);
    this.el = {
      points: $('points'), popups: $('popups'), wname: $('wname'), clip: $('clip'), reserve: $('reserve'),
      ammo: $('ammo'), clipL: $('clipL'), grenades: $('grenades'), scope: $('scope'),
      promptsub: $('promptsub'), powerups: $('powerups'), perks: $('perks'), toast: $('toast'), downed: $('downed'), revive: $('revive'), cross: $('crosshair'), hit: $('hitmarker'), prompt: $('prompt'), hint: $('hint'), fps: $('fps'),
    };
    this.shownPoints = null;
    this.hitT = 0;
    this.fpsAcc = 0; this.fpsN = 0;
    this.localId = null;
    this.last = {};
  }

  // Big centered message (power on, new upgraded gun, perk).
  toast(t1, t2 = '', color = null, time = 3) {
    const el = this.el.toast;
    el.querySelector('.t1').textContent = t1;
    el.querySelector('.t2').textContent = t2;
    el.style.setProperty('--c', color || 'var(--brass)');
    el.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('on'), time * 1000);
  }

  show(on) { this.root.hidden = !on; if (!on) { this.el.scope.hidden = true; this.last.scope = true; } }

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
      case 'cantAfford':
        if (e.playerId === this.localId) {
          this.el.points.classList.remove('deny'); void this.el.points.offsetWidth; this.el.points.classList.add('deny');
        }
        break;
      case 'zombieHit':
        break;
      case 'shot':
        if (e.playerId === this.localId && this.cfg.hud.hitmarkers && e.impacts.some((h) => h.kind === 'zombie')) this.hitT = 0.12;
        break;
      case 'powerupGrab': {
        const d = this.cfg.powerups.list[e.ptype];
        this.toast(d.name, d.desc, d.color, 2.6);
        break;
      }
      case 'cheddarStart':
        this.toast('Cheddar Round', 'here, boy', '#ffb020', 4);
        break;
      case 'cheddarEnd':
        this.toast('Cheddar Round over', '', '#ffb020', 2.5);
        break;
      case 'boxBobble':
        if (e.playerId === this.localId) this.toast('Bye bye', 'the Mystery Box is moving · points refunded', '#7fcfff', 3);
        break;
      case 'boxMoved': {
        this.toast('The box has moved', this.roomNames && this.roomNames[e.room] ? 'look for the light in ' + this.roomNames[e.room] : 'look for the light', '#7fcfff', 3);
        break;
      }
      case 'powerOn':
        this.toast('The power is on', 'perks, traps and the Mad Dog Machine are live', '#ffd23a', 3.5);
        break;
      case 'perkGained':
        if (e.playerId === this.localId) { const d = this.cfg.perks.list[e.perk]; this.toast(d.name, d.desc, d.color, 3); }
        break;
      case 'madDogTaken':
        if (e.playerId === this.localId) { const d = this.cfg.weapons[e.weapon]; this.toast(d.name, 'upgraded by the Mad Dog', d.view.camo, 3.5); }
        break;
      case 'playerRevived':
        if (e.playerId === this.localId) this.toast(e.self ? 'Second helping' : 'Back on your feet', '', '#3fa9f5', 2);
        break;
      case 'meleeHit':
        if (e.playerId === this.localId && this.cfg.hud.hitmarkers) this.hitT = 0.12;
        break;
    }
  }

  popup(amount, reason) {
    const d = document.createElement('div');
    d.className = 'popup' + (reason === 'headshot' || reason === 'knife' ? ' big' : '') + (amount < 0 ? ' spend' : '');
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
    this.set('wcolor', this.el.wname.style, def.view.camo || '', 'color');
    this.set('clip', this.el.clip, String(slot.clip));
    this.set('clipL', this.el.clipL, def.dual ? String(slot.clipL) : '');
    this.set('grenades', this.el.grenades, '<b></b>'.repeat(Math.max(0, p.stewBombs || 0)) + '<i></i>'.repeat(Math.max(0, p.grenades)), 'innerHTML');
    const scoped = !!def.scope && w.adsAmount > 0.85 && p.alive;
    this.set('scope', this.el.scope, !scoped, 'hidden');
    this.set('reserve', this.el.reserve, String(slot.reserve));
    const low = slot.clip < def.magSize && slot.clip <= Math.ceil(def.magSize * this.cfg.hud.lowAmmoFraction);
    this.set('lowclass', this.el.ammo, low ? 'low' : '', 'className');

    // crosshair gap from current spread
    const hideCross = (w.adsAmount > 0.5 && !def.dual) || !!p.throwing || p.sprinting || !p.alive || p.melee.timer > 0;
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
    let prompt = p.prompt ? p.prompt.text + (p.prompt.cost != null ? ` [Cost: ${p.prompt.cost}]` : '') : '';
    if (p.rebuilding) prompt = 'Rebuilding barrier';
    this.set('prompt', this.el.prompt, prompt);
    this.set('promptsub', this.el.promptsub, p.prompt && p.prompt.sub ? p.prompt.sub : '');

    // timed power-ups
    const act = sim.powerups.active;
    const puKey = Object.entries(act).filter(([, t]) => t > 0).map(([k, t]) => k + ':' + Math.ceil(t)).join(',');
    if (puKey !== this.last.pu) {
      this.last.pu = puKey;
      this.el.powerups.textContent = '';
      for (const [k, t] of Object.entries(act)) {
        if (!(t > 0)) continue;
        const d = this.cfg.powerups.list[k];
        const el = document.createElement('div');
        el.className = 'pu' + (t < 6 ? ' low' : '');
        el.style.setProperty('--c', d.color);
        const img = document.createElement('img'); img.src = powerupIconURL(k, d.color); img.alt = d.name;
        const sec = document.createElement('span'); sec.textContent = String(Math.ceil(t));
        el.append(img, sec);
        this.el.powerups.appendChild(el);
      }
    }

    // perks
    const perkKey = p.perks.join(',');
    if (perkKey !== this.last.perks) {
      this.last.perks = perkKey;
      this.el.perks.textContent = '';
      for (const id of p.perks) {
        const d = this.cfg.perks.list[id];
        const i = document.createElement('div');
        i.className = 'perk'; i.title = d.name; i.textContent = d.glyph;
        i.style.setProperty('--c', d.color);
        this.el.perks.appendChild(i);
      }
    }

    // last stand
    const dn = p.downed;
    this.set('downedHidden', this.el.downed, !dn, 'hidden');
    if (dn) {
      const self = dn.selfRevive != null;
      const frac = self ? 1 - dn.selfRevive / this.cfg.perks.list.secondHelping.selfReviveTime : dn.bleed / this.cfg.lastStand.bleedOut;
      this.set('downedText', this.el.downed.querySelector('.small'), self ? 'Second Helping is getting you up' : dn.reviverId ? 'Being revived' : 'Bleeding out', 'textContent');
      this.el.downed.querySelector('.bar i').style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
      this.el.downed.querySelector('.bar i').style.background = self ? '#3fa9f5' : '';
    }
    this.set('reviveHidden', this.el.revive, !p.reviving, 'hidden');
    if (p.reviving) this.el.revive.querySelector('.bar i').style.width = `${p.reviving.frac * 100}%`;
    let hint = '';
    if (p.drinking) hint = '';
    else if (p.throwing && p.throwing.phase === 'cook') hint = `Cooking ${Math.max(0, this.cfg.equipment.frag.fuse - p.throwing.t).toFixed(1)}`;
    if (hint) { /* cooking */ }
    else if (slot.clip === 0 && slot.reserve === 0) hint = 'No ammo';
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
