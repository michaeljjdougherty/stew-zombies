// =============================================================================
// Career: each username's stats (kills, revives, rounds survived...) and
// achievements, kept across games.
//
// Saved in this browser always, and online too when CONFIG.career.firebaseUrl
// is set (a Firebase Realtime Database: plain REST, no SDK). Online, counters
// are sent as increments ("+12 kills"), so two games on two computers under
// the same name both count. If the database can't be reached, everything
// waits in this browser and goes up next time it can.
//
// With CONFIG.career.firebaseApiKey set, every username has a 4-digit PIN:
// you make one the first time you use a name, and need it to sign in as that
// name again (src/career/auth.js). Without it, a username is just a name.
// =============================================================================
import { ACHIEVEMENTS, ACH_BY_ID } from './achievements.js';
import { PinAuth, pinOk, pinHash } from './auth.js';
import { SKINS, SKIN_BY_ID, priceOf } from './skins.js';
import { CONFIG } from '../config.js';

const LS = 'stew-zombies-career-v1';
export const STAT_KEYS = ['kills', 'revives', 'rounds', 'headshots', 'downs', 'games', 'bestRound'];
const MAX_STATS = new Set(['bestRound']);   // kept as the highest, not added up

export const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16);
// The database key for a name: case doesn't matter, and only safe characters.
export const nameKey = (s) => cleanName(s).toLowerCase().replace(/[^a-z0-9_-]/g, '_');

const blankStats = () => Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
const blankPending = () => ({ inc: {}, max: {}, ach: {}, gums: {}, shop: {} });
// GobbleGum: Liquid Divinium, the Megas you own, and the pack of 5 you take into a game
const GG = () => CONFIG.gobblegum;
const isMegaId = (id) => { const d = GG().gums[id]; return !!d && d.tier !== 'classic' && d.tier !== 'whimsical'; };
const blankGums = () => ({ divinium: 0, megas: {}, pack: [...GG().defaultPack], started: false, gifts: {} });
// The Skin Shop: your Stew Bucks, the skins you own, which one each character
// wears, and the achievements that have paid out already
const SHOP = () => CONFIG.shop;
const blankShop = () => ({ bucks: 0, owned: {}, wear: {}, paid: {}, kills: {} });   // (kills: by character, for the skins kills unlock)

export class Career {
  constructor(cfg = {}, { fetchFn = typeof fetch === 'function' ? fetch.bind(globalThis) : null, storage = (() => { try { return globalThis.localStorage; } catch { return null; } })() } = {}) {
    this.cfg = cfg;
    this.url = String(cfg.firebaseUrl || '').trim().replace(/\/+$/, '');
    this.fetch = fetchFn;
    this.storage = storage;
    this.auth = this.url && cfg.firebaseApiKey ? new PinAuth(cfg.firebaseApiKey, fetchFn, cfg.timeout || 8) : null;
    this.db = this.loadLocal();
    this.profile = null;        // { name, stats, achievements: { id: time } }
    this.key = null;
    this.status = this.url ? 'connecting' : 'local';   // local | online | offline
    this.onUnlock = null;       // (achievement) => toast
    this.onChange = null;       // () => refresh the title chip / career screen
    this.onGift = null;         // ({ divinium, megas, each }) => the welcome gift's pop-up
    this.playingAs = null;      // the character you're playing as (main.js sets it each game), for per-character kills
    this.onSkinUnlock = null;   // (skin, charId) => a skin kills unlocked
    this.onBucks = null;        // (n, why) => Stew Bucks came in ('achievement' or 'backpay'; play's are quiet)
    this.flushing = false;
  }

  // --- this browser's copy ----------------------------------------------------
  loadLocal() {
    let d = null;
    try { d = JSON.parse(this.storage && this.storage.getItem(LS)); } catch { d = null; }
    d = d && typeof d === 'object' ? d : {};
    return { profiles: d.profiles || {}, pending: d.pending || {}, last: d.last || '', pins: d.pins || {} };
  }
  saveLocal() {
    if (this.profile) this.db.profiles[this.key] = this.profile;
    try { this.storage && this.storage.setItem(LS, JSON.stringify(this.db)); } catch { /* private window */ }
  }

  get lastName() { return this.db.last || ''; }
  get pinsOn() { return !!this.auth; }
  get signedIn() { return !!this.profile; }
  get gamerscore() { return this.profile ? scoreOf(this.profile) : 0; }
  pending() {
    const p = this.db.pending[this.key] || (this.db.pending[this.key] = blankPending());
    if (!p.gums) p.gums = {};
    if (!p.shop) p.shop = {};
    return p;
  }

  // --- the database -----------------------------------------------------------
  async request(method, key, body) {
    if (!this.url || !this.fetch) throw new Error('no database');
    let q = '';
    if (method !== 'GET' && this.auth) {
      const tok = await this.auth.token();
      if (!tok) throw new Error('not signed in');
      q = '?auth=' + encodeURIComponent(tok);
    }
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = ctl && setTimeout(() => ctl.abort(), (this.cfg.timeout || 6) * 1000);
    try {
      const r = await this.fetch(`${this.url}/players/${encodeURIComponent(key)}.json${q}`, {
        method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined, keepalive: method === 'PATCH',
      });
      if (!r.ok) throw new Error('database said ' + r.status);
      return await r.json();
    } finally { if (t) clearTimeout(t); }
  }

  // A quick look at a name before signing in: "welcome back" or "new player".
  async peek(name) {
    const key = nameKey(name);
    if (!key) return null;
    let p = this.db.profiles[key] || null;
    if (this.url) { try { const c = await this.request('GET', key); if (c) p = normalize(c, name); } catch { /* offline: the local copy will do */ } }
    return p ? { name: p.name, kills: p.stats.kills, rounds: p.stats.rounds, g: scoreOf(p) } : null;
  }

  // Every username so far (the database's, and this device's), A to Z, for the
  // sign-in screen: [{ name, g }]. Offline: just the ones this device knows.
  async listNames() {
    const all = new Map();
    for (const [key, p] of Object.entries(this.db.profiles)) all.set(key, { name: (p && p.name) || key, g: p ? scoreOf(p) : 0 });
    if (this.url && this.fetch) {
      try {
        const r = await this.fetch(`${this.url}/players.json`);
        const j = r.ok ? await r.json() : null;
        for (const [key, p] of Object.entries(j && typeof j === 'object' ? j : {})) if (p && typeof p === 'object') all.set(key, { name: cleanName(p.name) || key, g: scoreOf(p) });
      } catch { /* offline: this device's will do */ }
    }
    return [...all.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  }

  // Is this username taken (does it have a PIN)? { exists, claimed, offline }
  async lookup(rawName) {
    const key = nameKey(rawName);
    if (!key) return null;
    if (!this.url) return { exists: !!this.db.profiles[key], claimed: false, offline: false };
    try {
      const c = await this.request('GET', key);
      return { exists: !!c, claimed: !!(c && c.uid), offline: false };
    } catch {
      return { exists: !!this.db.profiles[key], claimed: !!this.db.pins[key], offline: true };
    }
  }

  // --- signing in -------------------------------------------------------------
  // With PINs on: signIn(name, pin, { create }) -> { ok, code } where code is
  // 'taken' (someone has that name: ask for its PIN), 'badpin', 'locked'
  // (too many tries), 'offline', 'setup' (Firebase sign-in isn't switched on).
  async signIn(rawName, pin = null, { create = false } = {}) {
    const name = cleanName(rawName);
    const key = nameKey(name);
    if (!key) return { ok: false, code: 'error' };
    if (this.profile && this.key !== key) await this.flush();   // (the last name's stats go up under its own sign-in)
    let offline = false;
    if (this.auth) {
      if (!pinOk(pin)) return { ok: false, code: 'badpin' };
      try {
        if (create) await this.auth.create(key, pin); else await this.auth.signIn(key, pin);
      } catch (e) {
        if (e.code !== 'offline') return { ok: false, code: e.code };
        // no connection: this browser can let you in if you've signed in here before
        const h = await pinHash(key, pin);
        if (this.db.pins[key] && this.db.pins[key] === h) offline = true;
        else return { ok: false, code: 'offline' };
      }
      this.db.pins[key] = await pinHash(key, pin);
    }
    this.key = key;
    this.profile = normalize(this.db.profiles[key], name);
    this.profile.name = name;
    this.db.last = name;
    this.saveLocal();
    this.changed();
    if (offline) { this.status = 'offline'; this.payAchievements(); this.changed(); return { ok: true, offline: true }; }
    if (this.url) {
      try {
        const cloud = await this.request('GET', key);
        const pend = this.pending();
        if (cloud) {
          // the database's numbers, plus anything from here that hasn't gone up yet
          const c = normalize(cloud, name);
          for (const [k, n] of Object.entries(pend.inc)) c.stats[k] = (c.stats[k] || 0) + n;
          for (const [k, v] of Object.entries(pend.max)) c.stats[k] = Math.max(c.stats[k] || 0, v);
          for (const [id, t] of Object.entries(this.profile.achievements)) if (!c.achievements[id]) { c.achievements[id] = t; pend.ach[id] = t; }
          // (GobbleGum: the database's, plus what's waiting here)
          const pg = pend.gums || {};
          c.gums.divinium = Math.max(0, c.gums.divinium + (pg.divinium || 0));
          for (const [id, n] of Object.entries(pg.megas || {})) c.gums.megas[id] = Math.max(0, (c.gums.megas[id] || 0) + n);
          if (pg.pack) c.gums.pack = [...pg.pack];
          if (pg.started) c.gums.started = true;
          for (const id of Object.keys(pg.gifts || {})) c.gums.gifts[id] = true;
          // (the Skin Shop: the same)
          const ps = pend.shop || {};
          c.shop.bucks = Math.max(0, c.shop.bucks + (ps.bucks || 0));
          for (const id of Object.keys(ps.owned || {})) if (SKIN_BY_ID[id]) c.shop.owned[id] = true;
          for (const [ch, id] of Object.entries(ps.wear || {})) { if (id) c.shop.wear[ch] = id; else delete c.shop.wear[ch]; }
          for (const id of Object.keys(ps.paid || {})) c.shop.paid[id] = true;
          for (const [ch, n] of Object.entries(ps.kills || {})) c.shop.kills[ch] = (c.shop.kills[ch] || 0) + n;
          c.name = name;
          this.profile = c;
        } else {
          // first time this name's been online: send up everything it has here
          pend.inc = {}; pend.max = {};
          for (const k of STAT_KEYS) {
            if (MAX_STATS.has(k)) { if (this.profile.stats[k]) pend.max[k] = this.profile.stats[k]; } else if (this.profile.stats[k]) pend.inc[k] = this.profile.stats[k];
          }
          pend.ach = { ...this.profile.achievements };
          const G = this.profile.gums;
          pend.gums = { divinium: G.divinium, megas: { ...G.megas }, pack: [...G.pack], started: G.started, gifts: { ...G.gifts } };
          const S = this.profile.shop;
          pend.shop = { bucks: S.bucks, owned: { ...S.owned }, wear: { ...S.wear }, paid: { ...S.paid }, kills: { ...S.kills } };
          pend.fresh = true;
        }
        if (this.auth) pend.fresh = true;   // (stamp the account on it, so it's yours)
        this.status = 'online';
        this.giveStarter();
        this.giveGift();
        this.payAchievements();
        this.saveLocal();
        this.changed();
        await this.flush();
      } catch (e) {
        this.status = 'offline';
        this.changed();
      }
    } else { this.giveStarter(); this.giveGift(); this.payAchievements(); }
    return { ok: true };
  }

  signOut() {
    this.flush();
    if (this.auth) this.auth.signOut();
    this.profile = null; this.key = null;
    this.changed();
  }

  // --- counting ---------------------------------------------------------------
  add(stat, n = 1) {
    if (!this.profile || !n) return;
    const was = this.profile.stats[stat] || 0;
    this.profile.stats[stat] = was + n;
    this.earn(stat, was, was + n);
    const p = this.pending();
    p.inc[stat] = (p.inc[stat] || 0) + n;
    this.checkStats();
    this.dirty = true;
  }

  max(stat, v) {
    if (!this.profile || !(v > (this.profile.stats[stat] || 0))) return;
    this.profile.stats[stat] = v;
    this.pending().max[stat] = v;
    this.dirty = true;
  }

  has(id) { return !!(this.profile && this.profile.achievements[id]); }

  unlock(id) {
    const a = ACH_BY_ID[id];
    if (!a || !this.profile || this.profile.achievements[id]) return false;
    const t = Date.now();
    this.profile.achievements[id] = t;
    this.pending().ach[id] = t;
    this.saveLocal();
    if (this.onUnlock) this.onUnlock(a);
    this.payAchievements('achievement');
    this.changed();
    this.flush();
    return true;
  }

  checkStats() {
    for (const a of ACHIEVEMENTS) if (a.kind === 'stat' && !this.has(a.id) && (this.profile.stats[a.stat] || 0) >= a.need) this.unlock(a.id);
  }

  // Save here, and send what's waiting up to the database.
  async flush() {
    if (!this.profile) return;
    if (this.dirty) { this.dirty = false; this.saveLocal(); this.changed(); }
    if (!this.url || this.flushing) return;
    if (this.auth && !this.auth.session) return;   // signed in offline: it all waits for next time
    const key = this.key, p = this.pending();
    const body = {};
    for (const [k, n] of Object.entries(p.inc)) if (n) body['stats/' + k] = { '.sv': { increment: n } };
    for (const [k, v] of Object.entries(p.max)) body['stats/' + k] = v;
    for (const [id, t] of Object.entries(p.ach)) body['achievements/' + id] = t;
    const pg = p.gums || {};
    if (pg.divinium) body['gums/divinium'] = { '.sv': { increment: pg.divinium } };
    for (const [id, n] of Object.entries(pg.megas || {})) if (n) body['gums/megas/' + id] = { '.sv': { increment: n } };
    if (pg.pack) body['gums/pack'] = pg.pack;
    if (pg.started) body['gums/started'] = true;
    for (const id of Object.keys(pg.gifts || {})) body['gums/gifts/' + id] = true;
    const ps = p.shop || {};
    if (ps.bucks) body['shop/bucks'] = { '.sv': { increment: ps.bucks } };
    for (const id of Object.keys(ps.owned || {})) body['shop/owned/' + id] = true;
    for (const [ch, id] of Object.entries(ps.wear || {})) body['shop/wear/' + ch] = id || null;
    for (const id of Object.keys(ps.paid || {})) body['shop/paid/' + id] = true;
    for (const [ch, n] of Object.entries(ps.kills || {})) if (n) body['shop/kills/' + ch] = { '.sv': { increment: n } };
    if (!Object.keys(body).length && !p.fresh) return;
    body.name = this.profile.name;
    body.updated = { '.sv': 'timestamp' };
    if (this.auth) body.uid = this.auth.session.uid;   // (the rules: only this account can change this career)
    // what's being sent now comes off the pile only once it's gone through
    const sent = JSON.parse(JSON.stringify({ inc: p.inc, max: p.max, ach: p.ach, gums: pg, shop: ps }));
    this.flushing = true;
    try {
      await this.request('PATCH', key, body);
      const now = this.db.pending[key] || blankPending();
      for (const [k, n] of Object.entries(sent.inc)) { now.inc[k] = (now.inc[k] || 0) - n; if (!now.inc[k]) delete now.inc[k]; }
      for (const [k, v] of Object.entries(sent.max)) if (now.max[k] === v) delete now.max[k];
      for (const id of Object.keys(sent.ach)) delete now.ach[id];
      const ng = now.gums || (now.gums = {}), sg = sent.gums || {};
      if (sg.divinium) { ng.divinium = (ng.divinium || 0) - sg.divinium; if (!ng.divinium) delete ng.divinium; }
      for (const [id, n] of Object.entries(sg.megas || {})) { if (!ng.megas) break; ng.megas[id] = (ng.megas[id] || 0) - n; if (!ng.megas[id]) delete ng.megas[id]; }
      if (sg.pack && JSON.stringify(ng.pack) === JSON.stringify(sg.pack)) delete ng.pack;
      if (sg.started) delete ng.started;
      for (const id of Object.keys(sg.gifts || {})) if (ng.gifts) delete ng.gifts[id];
      const ns = now.shop || (now.shop = {}), ss = sent.shop || {};
      if (ss.bucks) { ns.bucks = (ns.bucks || 0) - ss.bucks; if (!ns.bucks) delete ns.bucks; }
      for (const id of Object.keys(ss.owned || {})) if (ns.owned) delete ns.owned[id];
      for (const [ch, id] of Object.entries(ss.wear || {})) if (ns.wear && ns.wear[ch] === id) delete ns.wear[ch];
      for (const id of Object.keys(ss.paid || {})) if (ns.paid) delete ns.paid[id];
      for (const [ch, n] of Object.entries(ss.kills || {})) { if (!ns.kills) break; ns.kills[ch] = (ns.kills[ch] || 0) - n; if (!ns.kills[ch]) delete ns.kills[ch]; }
      delete now.fresh;
      this.status = 'online';
      this.saveLocal();
    } catch {
      this.status = 'offline';
    } finally {
      this.flushing = false;
      this.changed();
    }
  }

  // --- GobbleGum ------------------------------------------------------------------
  // Your Divinium, Megas and pack. Not signed in: the Classics, no Megas.
  get gums() {
    if (this.profile) return this.profile.gums;
    if (!this.guestGums) {
      let pack = null;
      try { pack = JSON.parse(this.storage && this.storage.getItem(LS + '-guestpack')); } catch { pack = null; }
      this.guestGums = { divinium: 0, megas: {}, pack: cleanPack(pack, {}, true), started: true };
    }
    return this.guestGums;
  }
  // What you've got: a Classic or Whimsical gum is always yours; a Mega, if you have any left.
  owns(id) { return !!GG().gums[id] && (!isMegaId(id) || (this.profile && (this.gums.megas[id] || 0) > 0)); }
  gumPending(kind, id, n) {
    const pg = this.pending().gums;
    if (kind === 'divinium') pg.divinium = (pg.divinium || 0) + n;
    else { pg.megas = pg.megas || {}; pg.megas[id] = (pg.megas[id] || 0) + n; }
  }
  setPack(pack) {
    const G = this.gums;
    G.pack = cleanPack(pack, G.megas, !this.profile);
    if (!this.profile) { try { this.storage && this.storage.setItem(LS + '-guestpack', JSON.stringify(G.pack)); } catch { /* */ } this.changed(); return G.pack; }
    this.pending().gums.pack = [...G.pack];
    this.saveLocal(); this.changed(); this.flush();
    return G.pack;
  }
  addDivinium(n) {
    if (!this.profile || !n) return;
    this.profile.gums.divinium = Math.max(0, this.profile.gums.divinium + n);
    this.gumPending('divinium', null, n);
    this.saveLocal(); this.changed();
  }
  addMega(id, n = 1) {
    if (!this.profile || !isMegaId(id)) return;
    const M = this.profile.gums.megas;
    M[id] = Math.max(0, (M[id] || 0) + n);
    if (!M[id]) delete M[id];
    this.gumPending('mega', id, n);
  }
  // One came out of a machine for you (a Mega's gone as it does)
  useMega(id) {
    if (!this.profile || !isMegaId(id) || !(this.profile.gums.megas[id] > 0)) return;
    this.addMega(id, -1);
    this.saveLocal(); this.changed();
  }
  // Dr. Monty's Factory: Divinium in, Megas out. vats: how many vats to power up
  // (1-3). Returns the gums you got (or null).
  openFactory(vats, rand = Math.random) {
    const F = GG().factory, deal = F.vats[vats - 1];
    if (!this.profile || !deal || this.profile.gums.divinium < deal.cost) return null;
    this.addDivinium(-deal.cost);
    const byTier = {};
    for (const [id, d] of Object.entries(GG().gums)) if (isMegaId(id)) (byTier[d.tier] = byTier[d.tier] || []).push(id);
    const got = [];
    for (let i = 0; i < deal.gums; i++) {
      let r = rand(), tier = 'mega';
      for (const [t, w] of Object.entries(F.odds)) { if (r < w) { tier = t; break; } r -= w; }
      const list = byTier[tier] || byTier.mega;
      const id = list[Math.floor(rand() * list.length)];
      this.addMega(id, 1);
      got.push(id);
    }
    this.saveLocal(); this.changed(); this.flush();
    return got;
  }
  // The pack you take into a game: { pack: [5 ids], stock: { megaId: how many you own } }
  packForGame() {
    const G = this.gums, stock = {};
    for (const id of G.pack) if (isMegaId(id)) stock[id] = G.megas[id] || 0;
    return { pack: [...G.pack], stock };
  }
  // A new career gets a few vials to start with (once)
  giveStarter() {
    if (!this.profile || this.profile.gums.started) return;
    this.profile.gums.started = true;
    this.pending().gums.started = true;
    this.addDivinium(GG().starter || 0);
  }

  // A welcome gift (CONFIG.gobblegum.gift), once per username, to anyone who
  // signs in before it runs out. Returns what was given, or null.
  giveGift(now = Date.now()) {
    const g = GG().gift;
    if (!this.profile || !g || !g.id || now > Date.parse(g.until) || this.profile.gums.gifts[g.id]) return null;
    this.profile.gums.gifts[g.id] = true;
    const pg = this.pending().gums;
    pg.gifts = { ...(pg.gifts || {}), [g.id]: true };
    if (g.divinium) this.addDivinium(g.divinium);
    let megas = 0;
    if (g.megas) for (const id of Object.keys(GG().gums)) if (isMegaId(id)) { this.addMega(id, g.megas); megas++; }
    this.saveLocal(); this.changed();
    const got = { divinium: g.divinium || 0, megas, each: g.megas || 0 };
    if (this.onGift) try { this.onGift(got); } catch (e) { console.warn('career', e); }
    return got;
  }

  // --- the Skin Shop ---------------------------------------------------------------
  // Your Stew Bucks and skins. Not signed in: none (a guest can look, not buy).
  get shop() { return this.profile ? this.profile.shop : (this.guestShop || (this.guestShop = blankShop())); }
  get bucks() { return this.shop.bucks; }
  // charId: who'd wear it (a skin that kills unlock is unlocked per character)
  ownsSkin(id, charId = null) {
    const s = SKIN_BY_ID[id];
    if (!this.profile || !s) return false;
    if (!s.unlock) return !!this.profile.shop.owned[id];
    if (s.unlock.kind === 'free') return true;
    if (s.unlock.kind === 'kills') return SHOP().opalAccounts.includes(this.key) || (!!charId && this.charKills(charId) >= s.unlock.need);
    return false;
  }
  // Kills while playing as a character (counted from when the shop arrived)
  charKills(charId) { return (this.profile && this.profile.shop.kills[charId]) || 0; }
  // The skin a character wears (null: their own clothes)
  wornSkin(charId) { const id = this.profile && this.profile.shop.wear[charId]; return id && this.ownsSkin(id, charId) ? id : null; }
  shopPending() { return this.pending().shop; }

  addBucks(n, why = null) {
    if (!this.profile || !n) return;
    const S = this.profile.shop;
    S.bucks = Math.max(0, S.bucks + n);
    const ps = this.shopPending();
    ps.bucks = (ps.bucks || 0) + n;
    this.dirty = true;
    if (n > 0 && why && this.onBucks) try { this.onBucks(n, why); } catch (e) { console.warn('career', e); }
  }

  // Playing pays: every round you survive, and every few kills.
  earn(stat, before, after) {
    const E = SHOP();
    if (stat === 'kills' && this.playingAs) {
      const K = this.profile.shop.kills, ch = this.playingAs, ps = this.shopPending();
      K[ch] = (K[ch] || 0) + (after - before);
      ps.kills = { ...(ps.kills || {}), [ch]: ((ps.kills || {})[ch] || 0) + (after - before) };
      for (const s of SKINS) if (s.unlock && s.unlock.kind === 'kills' && K[ch] >= s.unlock.need && K[ch] - (after - before) < s.unlock.need && this.onSkinUnlock) {
        try { this.onSkinUnlock(s, ch); } catch (e) { console.warn('career', e); }
      }
    }
    if (stat === 'rounds') this.addBucks((after - before) * E.perRound);
    else if (stat === 'kills' && E.killsPerBuck > 0) this.addBucks(Math.floor(after / E.killsPerBuck) - Math.floor(before / E.killsPerBuck));
  }

  // Every achievement you have pays out once (its G x perGamerscore): the
  // moment you get it, and ones from before the shop the first time you sign in.
  payAchievements(why = 'backpay') {
    if (!this.profile) return 0;
    const S = this.profile.shop, ps = this.shopPending();
    let n = 0;
    for (const id of Object.keys(this.profile.achievements)) {
      if (S.paid[id] || !ACH_BY_ID[id]) continue;
      S.paid[id] = true;
      ps.paid = { ...(ps.paid || {}), [id]: true };
      n += ACH_BY_ID[id].g * SHOP().perGamerscore;
    }
    if (n) { this.addBucks(n, why); this.saveLocal(); this.changed(); }
    return n;
  }

  // Buy a skin: { ok } or { ok: false, code: 'guest' | 'owned' | 'broke' | 'unknown' }
  buySkin(id) {
    if (!SKIN_BY_ID[id]) return { ok: false, code: 'unknown' };
    if (!this.profile) return { ok: false, code: 'guest' };
    if (SKIN_BY_ID[id].unlock) return { ok: false, code: 'unlock' };
    if (this.ownsSkin(id)) return { ok: false, code: 'owned' };
    const price = priceOf(id);
    if (this.profile.shop.bucks < price) return { ok: false, code: 'broke' };
    this.addBucks(-price);
    this.profile.shop.owned[id] = true;
    const ps = this.shopPending();
    ps.owned = { ...(ps.owned || {}), [id]: true };
    this.saveLocal(); this.changed(); this.flush();
    return { ok: true };
  }

  // Put a skin you own on a character (null: back to their own clothes)
  wearSkin(charId, id) {
    if (!this.profile || (id && !this.ownsSkin(id, charId))) return false;
    const W = this.profile.shop.wear;
    if (id) W[charId] = id; else delete W[charId];
    const ps = this.shopPending();
    ps.wear = { ...(ps.wear || {}), [charId]: id || '' };
    this.saveLocal(); this.changed(); this.flush();
    return true;
  }

  changed() { if (this.onChange) try { this.onChange(); } catch (e) { console.warn('career', e); } }
}

// A pack: 5 different gums you have (a Mega you've run out of can stay in it;
// it just won't come out of a machine). Guests: Classics and Whimsicals only.
export function cleanPack(pack, megas = {}, guest = false) {
  const G = GG(), out = [];
  for (const id of Array.isArray(pack) ? pack : []) {
    if (!G.gums[id] || out.includes(id) || (guest && isMegaId(id))) continue;
    out.push(id);
    if (out.length >= G.packSize) break;
  }
  for (const id of G.defaultPack) if (out.length < G.packSize && !out.includes(id)) out.push(id);
  return out;
}

function normalize(p, name) {
  const out = { name: (p && p.name) || name, stats: blankStats(), achievements: {}, gums: blankGums(), shop: blankShop() };
  if (p && p.shop && typeof p.shop === 'object') {
    out.shop.bucks = Math.max(0, Math.floor(Number(p.shop.bucks) || 0));
    for (const [id, v] of Object.entries(p.shop.owned || {})) if (v && SKIN_BY_ID[id]) out.shop.owned[id] = true;
    for (const [ch, id] of Object.entries(p.shop.wear || {})) if (id && SKIN_BY_ID[id]) out.shop.wear[ch] = id;
    for (const [id, v] of Object.entries(p.shop.paid || {})) if (v) out.shop.paid[id] = true;
    for (const [ch, n] of Object.entries(p.shop.kills || {})) if (Number(n) > 0) out.shop.kills[ch] = Math.floor(Number(n));
  }
  if (p && p.gums && typeof p.gums === 'object') {
    out.gums.divinium = Math.max(0, Math.floor(Number(p.gums.divinium) || 0));
    for (const [id, n] of Object.entries(p.gums.megas || {})) if (isMegaId(id) && Number(n) > 0) out.gums.megas[id] = Math.floor(Number(n));
    out.gums.pack = cleanPack(p.gums.pack, out.gums.megas);
    out.gums.started = !!p.gums.started;
    for (const [id, v] of Object.entries(p.gums.gifts || {})) if (v) out.gums.gifts[id] = true;
  }
  if (p && p.stats) for (const k of STAT_KEYS) out.stats[k] = Number(p.stats[k]) || 0;
  if (p && p.achievements) for (const [id, t] of Object.entries(p.achievements)) if (ACH_BY_ID[id]) out.achievements[id] = t;
  return out;
}

export function scoreOf(p) {
  let g = 0;
  for (const id of Object.keys(p.achievements || {})) g += ACH_BY_ID[id] ? ACH_BY_ID[id].g : 0;
  return g;
}
