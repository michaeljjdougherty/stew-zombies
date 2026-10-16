// =============================================================================
// The Stew Store (after Fortnite's Item Shop): spend Stew Bucks on skins and
// emotes. Big rarity tiles on the left, each with a picture of the item drawn
// by the Showcase (src/render/showcase.js); the character tries on whatever you
// pick in the middle of the screen; what it is and the buy button on the right.
//
// Skins: every character has their own (pick whose along the top), plus the
// team kit and the specials (src/career/skins.js); "Equip" puts one on them.
// Emotes (src/career/emotes.js): buy one once and the whole crew can do it from
// the wheel. The Bucks, skins and emotes are your career's (src/career/career.js).
// =============================================================================
import { CONFIG } from '../config.js';
import { SKIN_BY_ID, rarityOf, skinsFor } from '../career/skins.js';
import { EMOTES, EMOTE_BY_ID } from '../career/emotes.js';

const EM = 'emote:';   // (emote tiles' ids in the grid)
const emoteOf = (sel) => (typeof sel === 'string' && sel.startsWith(EM) ? EMOTE_BY_ID[sel.slice(EM.length)] : null);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const OWN = { name: 'Default', rarity: 'common' };   // (their own clothes, as a tile)

export class ShopUI {
  // h: { characters() -> [{ id, name }], current() -> character id, preview(charId, skinId|null, act|null),
  //      thumb({ char, skin, act, color }, done(url)), back(), sound('buy' | 'wear' | 'deny') }
  constructor(career, h) {
    this.career = career;
    this.h = h;
    this.char = null;
    this.tab = 'skins';
    this.sel = null;          // what you're looking at ('' = their own clothes, 'emote:<id>' = an emote)
    $('btn-sh-act').addEventListener('click', () => this.act());
    $('btn-sh-back').addEventListener('click', () => this.h.back());
    for (const b of document.querySelectorAll('.st-tabs button')) b.addEventListener('click', () => this.setTab(b.dataset.tab));
  }

  open(tab = 'skins') {
    const list = this.h.characters();
    if (!list.some((c) => c.id === this.char)) this.char = this.h.current();
    if (!list.some((c) => c.id === this.char)) this.char = list[0] && list[0].id;
    this.buildChars(list);
    this.setTab(tab, true);
  }

  setTab(tab, force = false) {
    if (this.tab === tab && !force) return;
    this.tab = tab;
    for (const b of document.querySelectorAll('.st-tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    this.sel = tab === 'emotes' ? EM + EMOTES[0].id : this.career.wornSkin(this.char) || '';
    this.render();
    setTimeout(() => { const b = $('sh-grid').querySelector('[aria-selected="true"]'); if (b) b.focus({ preventScroll: true }); }, 30);
  }

  buildChars(list) {
    const box = $('sh-chars');
    box.textContent = '';
    for (const c of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.id = c.id;
      b.textContent = c.name;
      b.addEventListener('click', () => this.pickChar(c.id));
      box.appendChild(b);
    }
  }

  pickChar(id) {
    if (this.char === id) return;
    this.char = id;
    if (this.tab === 'skins') this.sel = this.career.wornSkin(id) || '';
    this.render();
  }

  render() {
    const C = this.career;
    $('sh-bucks').textContent = C.bucks.toLocaleString();
    $('sh-chars').hidden = this.tab !== 'skins';
    for (const b of $('sh-chars').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.id === this.char));
    const grid = $('sh-grid');
    grid.textContent = '';
    const head = (text) => { const p = document.createElement('p'); p.className = 'st-head'; p.textContent = text; grid.appendChild(p); };
    if (this.tab === 'skins') {
      const worn = C.wornSkin(this.char) || '';
      const all = skinsFor(this.char).filter((s) => !s.vault || C.ownsSkin(s.id, this.char));
      const theirs = all.filter((s) => s.only === this.char), team = all.filter((s) => s.team);
      const special = all.filter((s) => !s.only && !s.team && !s.vault), vault = all.filter((s) => s.vault);
      head(`${this.charName()}'s skins`);
      this.tile('', OWN, worn === '' ? { flag: 'Equipped', own: true } : { own: true });
      for (const s of theirs) this.skinTile(s, worn);
      head('The team');
      for (const s of team) this.skinTile(s, worn);
      if (special.length) { head('Specials'); for (const s of special) this.skinTile(s, worn); }
      if (vault.length) { head('From the vault'); for (const s of vault) this.skinTile(s, worn); }
    } else {
      head('Emotes: every character can do them');
      for (const e of EMOTES) {
        const own = C.ownsEmote(e.id);
        this.tile(EM + e.id, e, own ? { own: true, label: e.free ? 'Free' : 'Owned' } : { price: C.emotePrice(e.id) });
      }
    }
    this.info();
  }

  skinTile(s, worn) {
    const C = this.career, own = C.ownsSkin(s.id, this.char);
    const st = own ? { own: true, label: s.unlock ? 'Unlocked' : 'Owned' } : s.unlock ? { lock: this.unlockTag(s) } : { price: rarityOf(s).price };
    if (s.id === worn) st.flag = 'Equipped';
    this.tile(s.id, s, st);
  }

  // one tile: the rarity's colour, a picture of it (drawn when it's ready), the name and price
  tile(id, item, st) {
    const R = CONFIG.shop.rarities[item.rarity] || CONFIG.shop.rarities.common;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'st-tile'; b.setAttribute('role', 'option'); b.dataset.id = id;
    b.style.setProperty('--rc', R.color);
    b.setAttribute('aria-selected', String(id === this.sel));
    const tag = st.price != null ? `<span><i class="sh-coin" aria-hidden="true">$</i>${st.price.toLocaleString()}</span>`
      : st.lock ? `<span class="st-lock">${esc(st.lock)}</span>` : `<span class="st-own">${esc(st.label || 'Owned')}</span>`;
    b.innerHTML = `<div class="st-art"></div>${st.flag ? `<span class="st-flag">${esc(st.flag)}</span>` : ''}<div class="st-info"><b>${esc(item.name)}</b>${tag}</div>`;
    b.setAttribute('aria-label', `${item.name}, ${R.name}${st.price != null ? `, ${st.price} ${CONFIG.shop.currency}` : ''}`);
    b.addEventListener('click', () => this.select(id));
    b.addEventListener('focus', () => this.select(id));
    b.addEventListener('dblclick', () => this.act());
    $('sh-grid').appendChild(b);
    const e = emoteOf(id), art = b.querySelector('.st-art');
    const spec = e ? { char: this.char, skin: this.career.wornSkin(this.char), act: e.act, color: R.color } : { char: this.char, skin: id || null, color: R.color };
    if (this.h.thumb) this.h.thumb(spec, (url) => { art.style.backgroundImage = `url(${url})`; art.classList.add('ready'); });
  }

  // Looking at something: it goes on the character, and the button says what it'll do
  select(id) {
    if (this.sel === id) return;
    this.sel = id;
    for (const b of $('sh-grid').querySelectorAll('.st-tile')) b.setAttribute('aria-selected', String(b.dataset.id === id));
    this.info();
  }

  detail(item) {
    const R = CONFIG.shop.rarities[item.rarity] || CONFIG.shop.rarities.common;
    $('sh-rarity').textContent = R.name;
    $('sh-rarity').style.setProperty('--rc', R.color);
    $('sh-name').textContent = item.name;
    $('sh-name').classList.toggle('long', item.name.length > 22);
  }

  button(text, enabled) {
    const act = $('btn-sh-act');
    act.textContent = text;
    if (enabled) act.removeAttribute('aria-disabled'); else act.setAttribute('aria-disabled', 'true');
  }

  info() {
    if (emoteOf(this.sel)) { this.emoteInfo(emoteOf(this.sel)); return; }
    const C = this.career, S = CONFIG.shop, worn = C.wornSkin(this.char) || '';
    const skin = SKIN_BY_ID[this.sel], name = this.charName();
    this.detail(skin || OWN);
    let blurb = skin ? skin.blurb : `${name} in their own clothes.`;
    if (!C.signedIn) this.button('Sign in to buy', false);
    else if (this.sel === worn) this.button('Equipped', false);
    else if (!skin || C.ownsSkin(skin.id, this.char)) this.button(`Equip on ${name}`, true);
    else if (skin.unlock) {
      this.button(this.unlockTag(skin), false);
      if (skin.unlock.kind === 'kills') blurb += ` Unlock it for ${name} with ${skin.unlock.need} kills as ${name}: ${Math.min(C.charKills(this.char), skin.unlock.need)} so far.`;
    } else {
      const price = rarityOf(skin).price, short = price - C.bucks;
      this.button(`Purchase · ${price.toLocaleString()}`, short <= 0);
      if (short > 0) blurb += ` You need ${short.toLocaleString()} more ${S.currency}.`;
    }
    $('sh-blurb').textContent = blurb;
    this.earn();
    this.h.preview(this.char, this.sel || null, null);
  }

  // Looking at an emote: they do it (in whatever they're wearing)
  emoteInfo(e) {
    const C = this.career, S = CONFIG.shop;
    this.detail(e);
    let blurb = e.blurb + ' Hold [B] in a game for the emote wheel.';
    if (C.ownsEmote(e.id)) this.button(e.free ? 'Free for everyone' : 'Owned: on your wheel', false);
    else if (!C.signedIn) this.button('Sign in to buy', false);
    else {
      const price = C.emotePrice(e.id), short = price - C.bucks;
      this.button(`Purchase · ${price.toLocaleString()}`, short <= 0);
      if (short > 0) blurb += ` You need ${short.toLocaleString()} more ${S.currency}.`;
    }
    $('sh-blurb').textContent = blurb;
    this.earn();
    this.h.preview(this.char, C.wornSkin(this.char), e.act);
  }

  earn() {
    const C = this.career, S = CONFIG.shop;
    $('sh-earn').textContent = C.signedIn
      ? `Earn ${S.currency} by playing: ${S.perRound} for every round you survive, 1 for every ${S.killsPerBuck} kills, and ${S.perGamerscore} for every point of gamerscore an achievement is worth.`
      : `Playing as a guest: you can try everything on, but you need a username to earn ${S.currency} and buy (Settings › Switch username).`;
  }

  // (a controller's bumpers: the next or last character)
  cycleChar(dir) {
    const list = this.h.characters(), i = list.findIndex((c) => c.id === this.char);
    const c = list[(i + dir + list.length) % list.length];
    if (c) this.pickChar(c.id);
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
      if (r.ok) { this.render(); this.refocus(); }
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
    this.refocus();
  }

  refocus() { const b = $('sh-grid').querySelector('[aria-selected="true"]'); if (b) b.focus({ preventScroll: true }); }
}
