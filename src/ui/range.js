// =============================================================================
// Firing range UI: the weapons & options panel (press B), the stats readout
// (last hit, DPS, time to kill, accuracy) and floating damage numbers.
// Reads sim events; changes the game only through the handlers it is given.
// =============================================================================
import * as THREE from 'three';
import { zombieHealthForRound } from '../config.js';

const $ = (id) => document.getElementById(id);

const GROUPS = [
  ['Pistols', (d) => d.class === 'pistol' && !d.projectile],
  ['SMGs', (d) => d.class === 'smg'],
  ['Rifles', (d) => d.class === 'ar' || d.class === 'rifle'],
  ['Shotguns', (d) => d.class === 'shotgun'],
  ['LMGs', (d) => d.class === 'lmg'],
  ['Snipers', (d) => d.class === 'sniper'],
  ['Special', (d) => !!d.projectile],
];

export function reloadSeconds(def) {
  if (def.reloadStyle === 'shell') return (def.reloadStartTime || 0) + def.shellTime * def.magSize + (def.reloadEndTime || 0);
  return def.reloadTime;
}

export function weaponStatLine(def, cfg) {
  const parts = [];
  if (def.projectile) {
    const ex = def.projectile.explode ? cfg.explosions[def.projectile.explode] : null;
    if (def.projectile.impactDamage) parts.push(`${def.projectile.impactDamage} hit`);
    if (ex) parts.push(`${ex.damage} blast · ${ex.radius} m`);
  } else {
    parts.push(`${def.damage}${def.pellets > 1 ? ` ×${def.pellets}` : ''} dmg`);
  }
  parts.push(`${def.rpm} rpm`);
  parts.push(`${def.magSize}${def.dual ? ' ×2' : ''} mag`);
  parts.push(`${reloadSeconds(def).toFixed(1)} s reload`);
  return parts.join(' · ');
}

export class RangeUI {
  constructor(cfg, handlers) {
    this.cfg = cfg;
    this.h = handlers; // { give(id), perk(id), setRound(n), setAmmo(b), setMoving(b), horde(), clear(), close() }
    this.localId = null;
    this.active = false;
    this.panel = $('rangepanel');
    this.hud = $('rangehud');
    this.nums = $('dmgnums');
    this.floaters = [];
    this.v = new THREE.Vector3();
    this.reset();
    this.buildPanel();
  }

  buildPanel() {
    const list = $('rp-weapons');
    list.textContent = '';
    const entries = Object.entries(this.cfg.weapons).filter(([id]) => !id.endsWith('+'));
    for (const [title, test] of GROUPS) {
      const ids = entries.filter(([, d]) => test(d)).map(([id]) => id);
      if (!ids.length) continue;
      const g = document.createElement('div');
      g.className = 'rp-group';
      const h = document.createElement('h3');
      h.textContent = title;
      g.appendChild(h);
      for (const id of ids) {
        const d = this.cfg.weapons[id];
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.id = id;
        const where = d.boxOnly ? 'Box' : d.cost ? `Wall ${d.cost}` : 'Start';
        b.innerHTML = `<span class="n"></span><span class="w"></span><span class="s"></span>`;
        b.querySelector('.n').textContent = d.name;
        b.querySelector('.w').textContent = where;
        b.querySelector('.s').textContent = weaponStatLine(d, this.cfg);
        b.addEventListener('click', () => { this.h.give(this.upgraded && this.cfg.weapons[id + '+'] ? id + '+' : id); this.refresh(); });
        g.appendChild(b);
      }
      list.appendChild(g);
    }
    $('rp-round-dec').addEventListener('click', () => { this.h.setRound(this.round - 1); this.refresh(); });
    $('rp-round-inc').addEventListener('click', () => { this.h.setRound(this.round + 1); this.refresh(); });
    $('rp-round-dec5').addEventListener('click', () => { this.h.setRound(this.round - 5); this.refresh(); });
    $('rp-round-inc5').addEventListener('click', () => { this.h.setRound(this.round + 5); this.refresh(); });
    $('rp-ammo').addEventListener('change', (e) => this.h.setAmmo(e.target.checked));
    $('rp-moving').addEventListener('change', (e) => this.h.setMoving(e.target.checked));
    $('rp-horde').addEventListener('click', () => { this.h.horde(); this.h.close(); });
    $('rp-clear').addEventListener('click', () => this.h.clear());
    $('rp-reset').addEventListener('click', () => { this.reset(); this.refresh(); });
    $('rp-close').addEventListener('click', () => this.h.close());
    this.upgraded = false;
    $('rp-upgraded').addEventListener('change', (e) => { this.upgraded = e.target.checked; this.refresh(); });
    for (const [id, d] of Object.entries(this.cfg.perks.list)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sm'; b.dataset.perk = id; b.textContent = d.name; b.title = d.desc;
      b.style.setProperty('--c', d.color);
      b.addEventListener('click', () => { this.h.perk(id); this.refresh(); });
      $('rp-perks').appendChild(b);
    }
  }

  // --- panel ----------------------------------------------------------------
  open(sim, p) {
    this.sim = sim; this.p = p;
    this.refresh();
    this.panel.hidden = false;
  }

  close() { this.panel.hidden = true; }

  get isOpen() { return !this.panel.hidden; }

  refresh() {
    const sim = this.sim, p = this.p;
    if (!sim || !p) return;
    this.round = sim.range.round;
    $('rp-round').textContent = String(this.round);
    $('rp-hp').textContent = `${zombieHealthForRound(this.round, this.cfg.zombie).toLocaleString()} health`;
    $('rp-ammo').checked = sim.range.infiniteAmmo;
    $('rp-moving').checked = sim.range.moving;
    const held = new Set(p.loadout.slots.map((s) => s.id.replace(/\+$/, '')));
    const cur = p.loadout.slots[p.loadout.current].id.replace(/\+$/, '');
    for (const b of $('rp-weapons').querySelectorAll('button')) {
      b.classList.toggle('held', held.has(b.dataset.id));
      b.classList.toggle('current', b.dataset.id === cur);
      const d = this.cfg.weapons[this.upgraded && this.cfg.weapons[b.dataset.id + '+'] ? b.dataset.id + '+' : b.dataset.id];
      b.querySelector('.n').textContent = d.name;
      b.querySelector('.n').style.color = d.view.camo || '';
      b.querySelector('.s').textContent = weaponStatLine(d, this.cfg);
    }
    for (const b of $('rp-perks').querySelectorAll('button')) b.classList.toggle('on', p.perks.includes(b.dataset.perk));
    $('rp-slots').textContent = p.loadout.slots.map((s, i) => `${i + 1}: ${this.cfg.weapons[s.id].name}`).join('   ');
  }

  // --- stats ------------------------------------------------------------------
  setActive(on) {
    this.active = on;
    this.hud.hidden = !on;
    document.body.classList.toggle('range-mode', on);
    if (!on) { this.close(); this.clearFloaters(); }
  }

  reset() {
    this.stats = { shots: 0, hitShots: 0, kills: 0, heads: 0, last: null, lastPart: '', ttk: null, best: 0 };
    this.recent = [];      // [time, damage] for DPS
    this.firstHit = new Map();
    this.lastShown = '';
  }

  onEvent(e) {
    if (!this.active) return;
    const mine = e.playerId === this.localId;
    switch (e.type) {
      case 'shot':
        if (!mine || e.projectile) break;
        this.stats.shots++;
        if (e.impacts.some((h) => h.kind === 'zombie')) this.stats.hitShots++;
        break;
      case 'zombieHit': {
        if (!mine || !(e.damage > 0)) break;
        const dmg = Math.round(e.damage);
        this.stats.last = dmg;
        this.stats.lastPart = e.part;
        this.recent.push([e.t, dmg]);
        if (!this.firstHit.has(e.id)) this.firstHit.set(e.id, e.t);
        if (e.point) this.floater(e.point, dmg, e.part === 'head' ? 'head' : e.kind === 'explosive' ? 'blast' : '', e.id);
        break;
      }
      case 'zombieKilled': {
        if (e.playerId !== this.localId) break;
        this.stats.kills++;
        if (e.headshot) this.stats.heads++;
        const t0 = this.firstHit.get(e.id);
        if (t0 != null) this.stats.ttk = e.t - t0;
        this.firstHit.delete(e.id);
        const f = this.floaters.findLast ? this.floaters.findLast((q) => q.zid === e.id) : null;
        if (f) f.el.classList.add('kill');
        break;
      }
    }
  }

  floater(point, dmg, kind, zid) {
    if (this.floaters.length > 40) { const old = this.floaters.shift(); old.el.remove(); }
    const el = document.createElement('div');
    el.className = 'dmg' + (kind ? ' ' + kind : '');
    el.textContent = String(dmg);
    this.nums.appendChild(el);
    this.floaters.push({ el, pos: new THREE.Vector3(point.x, point.y, point.z), t: 0, dx: (Math.random() - 0.5) * 30, zid });
  }

  clearFloaters() { for (const f of this.floaters) f.el.remove(); this.floaters.length = 0; }

  update(dt, sim, p, camera) {
    if (!this.active) return;
    // floating numbers
    const W = window.innerWidth, H = window.innerHeight;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t > 0.9) { f.el.remove(); this.floaters.splice(i, 1); continue; }
      this.v.copy(f.pos).project(camera);
      if (this.v.z > 1) { f.el.style.opacity = '0'; continue; }
      const x = (this.v.x + 1) / 2 * W + f.dx * f.t, y = (1 - this.v.y) / 2 * H - 50 * f.t;
      f.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      f.el.style.opacity = String(Math.min(1, (0.9 - f.t) * 3));
    }
    if (!sim || !p) return;
    // DPS over the last second
    const now = sim.time;
    while (this.recent.length && now - this.recent[0][0] > 1) this.recent.shift();
    const dps = this.recent.reduce((a, r) => a + r[1], 0);
    if (dps > this.stats.best) this.stats.best = dps;
    const s = this.stats;
    const acc = s.shots ? Math.round((s.hitShots / s.shots) * 100) + '%' : '—';
    const def = this.cfg.weapons[p.loadout.slots[p.loadout.current].id];
    const html = `<b>${def.name}</b> <span>${weaponStatLine(def, this.cfg)}</span><br>`
      + `Last hit <b>${s.last ?? '—'}</b>${s.last != null ? ` <span>${s.lastPart}</span>` : ''} · DPS <b>${Math.round(dps)}</b> <span>(best ${Math.round(s.best)})</span>`
      + ` · Time to kill <b>${s.ttk != null ? s.ttk.toFixed(2) + ' s' : '—'}</b><br>`
      + `Kills <b>${s.kills}</b> · Headshot kills <b>${s.heads}</b> · Accuracy <b>${acc}</b> · Zombie health <b>${zombieHealthForRound(sim.range.round, this.cfg.zombie).toLocaleString()}</b> <span>(round ${sim.range.round})</span>`;
    if (html !== this.lastShown) { $('rstats').innerHTML = html; this.lastShown = html; }
  }
}
