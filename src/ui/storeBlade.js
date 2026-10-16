// =============================================================================
// The Stew Store blade on the title: your Stew Bucks, the way in, and
// "Featured today", a few items from the store (src/ui/shopUI.js) drawn as its
// big rarity tiles. A new set every day (everyone sees the same ones), with
// what you don't own yet first. Picking one opens the store on it.
// =============================================================================
import { CONFIG } from '../config.js';
import { SKINS, rarityOf, priceOf } from '../career/skins.js';
import { EMOTES } from '../career/emotes.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// today, as a number (local midnight to midnight)
export const dayNumber = (now = new Date()) => Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);

function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (list, R) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// The day's featured items: [{ kind: 'skin', id, char } | { kind: 'emote', id, char }].
// Skins that are for sale (one per character where it can), and an emote you pay for.
// chars: the characters you can play; career: to put what you don't own first.
export function featuredItems(day, chars, career, n = CONFIG.shop.featured) {
  const R = rng(day), ids = chars.map((c) => c.id);
  if (!ids.length) return [];
  const forSale = SKINS.filter((s) => !s.vault && !s.unlock && Number.isFinite(priceOf(s.id)) && (!s.only || ids.includes(s.only)));
  const skins = shuffle(forSale, R).map((s) => ({ kind: 'skin', id: s.id, char: s.only || ids[Math.floor(R() * ids.length)] }));
  const emotes = shuffle(EMOTES.filter((e) => !e.free), R).map((e) => ({ kind: 'emote', id: e.id, char: ids[Math.floor(R() * ids.length)] }));
  const owned = (it) => (career ? (it.kind === 'skin' ? career.ownsSkin(it.id, it.char) : career.ownsEmote(it.id)) : false);
  const fresh = (list) => [...list.filter((x) => !owned(x)), ...list.filter(owned)];
  const out = [], used = new Set();
  const e = fresh(emotes)[0];
  const pool = fresh(skins), want = n - (e ? 1 : 0);
  for (const it of pool) if (out.length < want && !used.has(it.char)) { out.push(it); used.add(it.char); }   // (a different character each)
  for (const it of pool) if (out.length < want && !out.includes(it)) out.push(it);   // (then whatever's left)
  if (e) out.push(e);
  return out.slice(0, n);
}

// When the featured items change (local midnight): "New items in 5h 12m"
export function untilTomorrow(now = new Date()) {
  const next = new Date(now); next.setHours(24, 0, 0, 0);
  const m = Math.max(1, Math.ceil((next - now) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export class StoreBlade {
  // h: { characters() -> [{ id, name }], thumb(spec, done(url)), open(tab, pick) }
  constructor(career, h) {
    this.career = career;
    this.h = h;
    this.box = document.getElementById('b-featured');
    this.when = document.getElementById('b-featured-when');
    this.key = '';
  }

  refresh() {
    const C = this.career;
    document.getElementById('b-bucks').textContent = C.bucks.toLocaleString();
    if (!this.box) return;
    const chars = this.h.characters(), day = dayNumber();
    const items = featuredItems(day, chars, C);
    if (this.when) this.when.textContent = `New items in ${untilTomorrow()}`;
    // (only rebuilt when something's changed: no redrawing the pictures on every flip)
    const key = day + '|' + items.map((it) => `${it.kind}:${it.id}:${it.char}:${this.state(it).text}`).join(',');
    if (key === this.key) return;
    this.key = key;
    this.box.textContent = '';
    for (const it of items) this.box.appendChild(this.tile(it, chars));
  }

  state(it) {
    const C = this.career;
    if (it.kind === 'emote') return C.ownsEmote(it.id) ? { own: true, text: 'Owned' } : { text: C.emotePrice(it.id).toLocaleString() };
    if (C.wornSkin(it.char) === it.id) return { own: true, text: 'Equipped' };
    return C.ownsSkin(it.id, it.char) ? { own: true, text: 'Owned' } : { text: priceOf(it.id).toLocaleString() };
  }

  tile(it, chars) {
    const item = it.kind === 'emote' ? EMOTES.find((e) => e.id === it.id) : SKINS.find((s) => s.id === it.id);
    const R = it.kind === 'emote' ? (CONFIG.shop.rarities[item.rarity] || CONFIG.shop.rarities.common) : rarityOf(item);
    const who = (chars.find((c) => c.id === it.char) || {}).name || '';
    const st = this.state(it);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'st-tile b-feat';
    b.style.setProperty('--rc', R.color);
    const tag = st.own ? `<span class="st-own">${esc(st.text)}</span>` : `<span><i class="sh-coin" aria-hidden="true">$</i>${esc(st.text)}</span>`;
    b.innerHTML = `<div class="st-art"></div><span class="st-flag">${it.kind === 'emote' ? 'Emote' : esc(who)}</span><div class="st-info"><b>${esc(item.name)}</b>${tag}</div>`;
    b.setAttribute('aria-label', `${item.name}${it.kind === 'skin' ? ` for ${who}` : ', an emote'}, ${R.name}, ${st.own ? st.text : `${st.text} ${CONFIG.shop.currency}`}`);
    b.addEventListener('click', () => this.h.open(it.kind === 'emote' ? 'emotes' : 'skins', it));
    const art = b.querySelector('.st-art');
    const spec = it.kind === 'emote' ? { char: it.char, skin: this.career.wornSkin(it.char), act: item.act, color: R.color } : { char: it.char, skin: it.id, color: R.color };
    if (this.h.thumb) this.h.thumb(spec, (url) => { art.style.backgroundImage = `url(${url})`; art.classList.add('ready'); });
    return b;
  }
}
