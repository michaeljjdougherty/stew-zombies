// =============================================================================
// The Arsenal blade on the title: every gun in the game (not the wonder
// weapons; the M2 Flamethrower and the Kross-Bow are Specials), by kind, and
// the skins each one can wear (src/career/gunSkins.js), drawn on that gun.
// Pick a gun, then a skin you own to put it on; one you don't own yet opens
// the Stew Store on it. What each gun wears is your career's.
// =============================================================================
import { CONFIG } from '../config.js';
import { ARSENAL_CLASSES, arsenalGuns, gunSkinsFor, gunSkinRarity, gunSkinPrice, GUN_SKIN_BY_ID } from '../career/gunSkins.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DEFAULT = { id: '', name: 'Factory', rarity: 'common' };   // (the gun's own finish, as a tile)

export class Arsenal {
  // h: { thumb(spec, done(url)), store(skinId) (opens the Stew Store on it), sound('wear' | 'deny') }
  constructor(career, h) {
    this.career = career;
    this.h = h;
    this.guns = arsenalGuns();
    this.gun = (this.guns.find((g) => g.id === 'SCAR-H') || this.guns[0]).id;
    this.focus = null;   // (a skin to point at: the store's "Equip in the Arsenal")
    this.built = false;
  }

  // open on one gun (and point at one of its skins)
  open(gun, skin = null) {
    if (this.guns.some((g) => g.id === gun)) this.gun = gun;
    this.focus = skin;
    this.refresh();
  }

  refresh() {
    if (!$('ar-guns')) return;
    if (!this.built) this.buildList();
    for (const b of $('ar-guns').querySelectorAll('button')) {
      b.setAttribute('aria-pressed', String(b.dataset.id === this.gun));
      b.classList.toggle('skinned', !!this.career.gunSkin(b.dataset.id));
    }
    this.renderSkins();
  }

  // the guns, a row of chips under each kind
  buildList() {
    const box = $('ar-guns');
    box.textContent = '';
    for (const c of ARSENAL_CLASSES) {
      const list = this.guns.filter((g) => g.cls === c.id);
      if (!list.length) continue;
      const h = document.createElement('p'); h.className = 'ar-head'; h.textContent = c.name; box.appendChild(h);
      const row = document.createElement('div'); row.className = 'ar-row'; box.appendChild(row);
      for (const g of list) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'ar-gun'; b.dataset.id = g.id; b.textContent = g.name;
        b.addEventListener('click', () => { this.gun = g.id; this.focus = null; this.refresh(); });
        row.appendChild(b);
      }
    }
    this.built = true;
  }

  renderSkins() {
    const C = this.career, gun = this.guns.find((g) => g.id === this.gun);
    if (!gun) return;
    const worn = C.gunSkin(gun.id) || '';
    $('ar-name').textContent = gun.name;
    $('ar-sub').textContent = worn ? `Wearing ${GUN_SKIN_BY_ID[worn].name}` : 'Factory finish';
    const box = $('ar-skins');
    const key = gun.id + '|' + worn + '|' + this.focus + '|' + gunSkinsFor(gun.id).map((s) => s.id + (C.ownsGunSkin(s.id, gun.id) ? '1' : '0')).join(',');
    if (box.dataset.key === key) return;   // (no redrawing the pictures for nothing)
    box.dataset.key = key;
    box.textContent = '';
    for (const s of [DEFAULT, ...gunSkinsFor(gun.id)]) box.appendChild(this.tile(gun, s, worn));
    $('ar-hint').textContent = C.signedIn ? 'Pick a skin you own to put it on. The rest are in the Stew Store and the Battle Pass. Pack-a-Punched guns keep their own camo.'
      : 'Sign in to put skins on your guns.';
  }

  tile(gun, s, worn) {
    const C = this.career, R = gunSkinRarity(s), own = !s.id || C.ownsGunSkin(s.id, gun.id);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'st-tile ar-tile'; b.dataset.id = s.id;
    b.style.setProperty('--rc', R.color);
    const label = s.id === worn ? 'Equipped' : own ? (s.id ? 'Owned' : 'Default') : null;
    const tag = label ? `<span class="st-own">${label}</span>`
      : s.unlock ? `<span class="st-lock">Pass tier ${s.unlock.tier}</span>` : `<span><i class="sh-coin" aria-hidden="true">$</i>${gunSkinPrice(s.id).toLocaleString()}</span>`;
    b.innerHTML = `<div class="st-art"></div>${s.only ? `<span class="st-flag">${esc(s.only)}</span>` : ''}<div class="st-info"><b>${esc(s.name)}</b>${tag}</div>`;
    b.setAttribute('aria-label', `${s.name} on the ${gun.name}, ${label || (s.unlock ? `Battle Pass tier ${s.unlock.tier}` : `${gunSkinPrice(s.id)} ${CONFIG.shop.currency}`)}`);
    b.setAttribute('aria-pressed', String(s.id === worn));
    if (this.focus && s.id === this.focus) b.classList.add('ar-focus');
    b.addEventListener('click', () => this.pick(gun, s));
    const art = b.querySelector('.st-art');
    if (this.h.thumb) this.h.thumb({ gun: gun.model, gunSkin: s.id || null, color: R.color }, (url) => { art.style.backgroundImage = `url(${url})`; art.classList.add('ready'); });
    return b;
  }

  pick(gun, s) {
    const C = this.career;
    if (s.id && !C.ownsGunSkin(s.id, gun.id)) { if (this.h.store) this.h.store(s.id); return; }   // (to buy it, or see its Battle Pass tier)
    if (!C.signedIn) { if (this.h.sound) this.h.sound('deny'); return; }
    if ((C.gunSkin(gun.id) || '') === s.id) return;
    C.wearGunSkin(gun.id, s.id || null);
    if (this.h.sound) this.h.sound('wear');
    this.focus = null;
    this.refresh();
  }
}
