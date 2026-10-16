// =============================================================================
// The Skin Shop: spend Stew Bucks on outfits for the crew. The character turns
// on the Showcase platform (src/render/showcase.js) wearing whatever skin you
// pick, so you can try anything on before you buy it. Pick who to try it on
// above the skins; buying a skin unlocks it for every character, and "Wear"
// puts it on the one you're looking at. The Bucks and skins are your career's
// (src/career/career.js), the skins themselves src/career/skins.js.
// Under the skins, the emotes (src/career/emotes.js): pick one and he does it
// on the platform; buy it once and the whole crew can do it from the wheel.
// =============================================================================
import { CONFIG } from '../config.js';
import { SKINS, SKIN_BY_ID, rarityOf } from '../career/skins.js';
import { EMOTES, EMOTE_BY_ID } from '../career/emotes.js';

const EM = 'emote:';   // (emote tiles' ids in the grid)
const emoteOf = (sel) => (typeof sel === 'string' && sel.startsWith(EM) ? EMOTE_BY_ID[sel.slice(EM.length)] : null);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class ShopUI {
  // h: { characters() -> [{ id, name }], current() -> character id, preview(charId, skinId|null),
  //      back(), sound('buy' | 'wear' | 'deny') }
  constructor(career, h) {
    this.career = career;
    this.h = h;
    this.char = null;
    this.sel = null;          // the skin you're looking at ('' = their own clothes)
    $('btn-sh-act').addEventListener('click', () => this.act());
    $('btn-sh-back').addEventListener('click', () => this.h.back());
  }

  open() {
    const list = this.h.characters();
    if (!list.some((c) => c.id === this.char)) this.char = this.h.current();
    if (!list.some((c) => c.id === this.char)) this.char = list[0] && list[0].id;
    this.sel = this.career.wornSkin(this.char) || '';
    this.buildChars(list);
    this.render();
    setTimeout(() => { const b = $('sh-grid').querySelector('[aria-selected="true"]'); if (b) b.focus({ preventScroll: true }); }, 30);
  }

  buildChars(list) {
    const box = $('sh-chars');
    box.textContent = '';
    for (const c of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cs-card'; b.setAttribute('role', 'tab'); b.dataset.id = c.id;
      b.innerHTML = `<b>${esc(c.name)}</b><span></span>`;
      b.addEventListener('click', () => { this.char = c.id; this.sel = this.career.wornSkin(c.id) || ''; this.render(); });
      box.appendChild(b);
    }
  }

  render() {
    const C = this.career;
    $('sh-bucks').textContent = String(C.bucks);
    for (const b of $('sh-chars').querySelectorAll('button')) {
      const worn = C.wornSkin(b.dataset.id);
      b.setAttribute('aria-selected', String(b.dataset.id === this.char));
      b.querySelector('span').textContent = worn ? SKIN_BY_ID[worn].name : 'Own clothes';
    }
    // the skins: their own clothes first, then the shop's
    const worn = C.wornSkin(this.char) || '';
    const grid = $('sh-grid');
    grid.textContent = '';
    const tile = (id, name, tag, color, state) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sh-skin ' + state; b.setAttribute('role', 'option'); b.dataset.id = id;
      b.style.setProperty('--rc', color);
      b.setAttribute('aria-selected', String(id === this.sel));
      b.innerHTML = `<b>${esc(name)}</b><small>${esc(tag)}</small>`;
      b.addEventListener('click', () => this.select(id));
      b.addEventListener('focus', () => this.select(id));
      grid.appendChild(b);
    };
    tile('', 'Own clothes', worn === '' ? 'Wearing' : 'Free', '#8a8170', worn === '' ? 'owned wearing' : 'owned');
    for (const s of SKINS) {
      const R = rarityOf(s), own = C.ownsSkin(s.id, this.char);
      const tag = s.id === worn ? 'Wearing' : own ? (s.unlock ? 'Unlocked' : 'Owned') : s.unlock ? this.unlockTag(s) : `${R.name} · ${R.price}`;
      tile(s.id, s.name, tag, R.color, own ? (s.id === worn ? 'owned wearing' : 'owned') : 'for-sale');
    }
    // the emotes
    const head = document.createElement('p');
    head.className = 'eyebrow'; head.textContent = 'Emotes';
    head.style.cssText = 'grid-column: 1 / -1; margin: 8px 0 0;';
    grid.appendChild(head);
    for (const e of EMOTES) {
      const R = CONFIG.shop.rarities[e.rarity] || CONFIG.shop.rarities.common, own = C.ownsEmote(e.id);
      tile(EM + e.id, e.name, e.free ? 'Free' : own ? 'Owned' : `${R.name} · ${R.price}`, R.color, own ? 'owned' : 'for-sale');
    }
    this.info();
  }

  // Looking at a skin: it goes on the character, and the button says what it'll do
  select(id) {
    if (this.sel === id) return;
    this.sel = id;
    for (const b of $('sh-grid').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.id === id));
    this.info();
  }

  info() {
    if (emoteOf(this.sel)) { this.emoteInfo(emoteOf(this.sel)); return; }
    const C = this.career, S = CONFIG.shop, worn = C.wornSkin(this.char) || '';
    const skin = SKIN_BY_ID[this.sel], name = this.charName();
    $('sh-name').textContent = skin ? skin.name : 'Own clothes';
    $('sh-name').classList.toggle('long', !!skin && skin.name.length > 24);
    const act = $('btn-sh-act');
    let blurb = skin ? skin.blurb : `${name}'s own outfit.`;
    if (!C.signedIn) { act.textContent = 'Sign in to buy skins'; act.setAttribute('aria-disabled', 'true'); }
    else if (this.sel === worn) { act.textContent = `${name} is wearing this`; act.setAttribute('aria-disabled', 'true'); }
    else if (!skin || C.ownsSkin(skin.id, this.char)) { act.textContent = `Wear on ${name}`; act.removeAttribute('aria-disabled'); }
    else if (skin.unlock) {
      act.textContent = this.unlockTag(skin);
      act.setAttribute('aria-disabled', 'true');
      if (skin.unlock.kind === 'kills') blurb += ` Unlock it for ${name} with ${skin.unlock.need} kills as ${name}: ${Math.min(C.charKills(this.char), skin.unlock.need)} so far.`;
    } else {
      const price = rarityOf(skin).price, short = price - C.bucks;
      act.textContent = `Buy for ${price} ${S.currency}`;
      act.setAttribute('aria-disabled', String(short > 0));
      if (short > 0) blurb += ` You need ${short} more.`;
    }
    $('sh-blurb').textContent = blurb;
    $('sh-earn').textContent = C.signedIn
      ? `Earn ${S.currency} by playing: ${S.perRound} for every round you survive, 1 for every ${S.killsPerBuck} kills, and ${S.perGamerscore} for every point of gamerscore an achievement is worth. A skin you buy fits the whole crew.`
      : `Playing as a guest: you can try skins on, but you need a username to earn ${S.currency} and buy them (Settings › Switch username).`;
    this.h.preview(this.char, this.sel || null);
  }

  // Looking at an emote: he does it (in whatever he's wearing)
  emoteInfo(e) {
    const C = this.career, S = CONFIG.shop, act = $('btn-sh-act');
    $('sh-name').textContent = e.name;
    $('sh-name').classList.toggle('long', e.name.length > 24);
    let blurb = e.blurb + ' Hold [B] in a game for the emote wheel.';
    if (C.ownsEmote(e.id)) { act.textContent = e.free ? 'Free for everyone' : 'Owned: on your emote wheel'; act.setAttribute('aria-disabled', 'true'); }
    else if (!C.signedIn) { act.textContent = 'Sign in to buy emotes'; act.setAttribute('aria-disabled', 'true'); }
    else {
      const price = C.emotePrice(e.id), short = price - C.bucks;
      act.textContent = `Buy for ${price} ${S.currency}`;
      act.setAttribute('aria-disabled', String(short > 0));
      if (short > 0) blurb += ` You need ${short} more.`;
    }
    $('sh-blurb').textContent = blurb;
    this.h.preview(this.char, this.career.wornSkin(this.char), e.act);
  }

  // (a controller's bumpers: the next or last character)
  cycleChar(dir) {
    const list = this.h.characters(), i = list.findIndex((c) => c.id === this.char);
    const c = list[(i + dir + list.length) % list.length];
    if (!c) return;
    this.char = c.id; this.sel = this.career.wornSkin(c.id) || '';
    this.render();
  }

  // how a skin that isn't for sale is unlocked
  unlockTag(s) { return s.unlock.kind === 'kills' ? `${s.unlock.need} kills as ${this.charName()}` : 'Free'; }

  charName() { const c = this.h.characters().find((x) => x.id === this.char); return c ? c.name : 'them'; }

  act() {
    const C = this.career, skin = SKIN_BY_ID[this.sel], emote = emoteOf(this.sel);
    if (!C.signedIn) { this.h.sound('deny'); return; }
    if (emote) {
      if (C.ownsEmote(emote.id)) return;
      const r = C.buyEmote(emote.id);
      this.h.sound(r.ok ? 'buy' : 'deny');
      if (r.ok) { this.render(); $('btn-sh-act').focus({ preventScroll: true }); }
      return;
    }
    if (skin && !C.ownsSkin(skin.id, this.char)) {
      const r = C.buySkin(skin.id);
      if (!r.ok) { this.h.sound('deny'); return; }
      this.h.sound('buy');
      C.wearSkin(this.char, skin.id);   // (bought it to wear it)
    } else {
      if (this.sel === (C.wornSkin(this.char) || '')) return;
      C.wearSkin(this.char, this.sel || null);
      this.h.sound('wear');
    }
    this.render();
    $('btn-sh-act').focus({ preventScroll: true });
  }
}
