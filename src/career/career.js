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
import { CONFIG } from '../config.js';

const LS = 'stew-zombies-career-v1';
export const STAT_KEYS = ['kills', 'revives', 'rounds', 'headshots', 'downs', 'games', 'bestRound'];
const MAX_STATS = new Set(['bestRound']);   // kept as the highest, not added up

export const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16);
// The database key for a name: case doesn't matter, and only safe characters.
export const nameKey = (s) => cleanName(s).toLowerCase().replace(/[^a-z0-9_-]/g, '_');

const blankStats = () => Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
const blankPending = () => ({ inc: {}, max: {}, ach: {}, gums: {} });
// GobbleGum: Liquid Divinium, the Megas you own, and the pack of 5 you take into a game
const GG = () => CONFIG.gobblegum;
const isMegaId = (id) => { const d = GG().gums[id]; return !!d && d.tier !== 'classic' && d.tier !== 'whimsical'; };
const blankGums = () => ({ divinium: 0, megas: {}, pack: [...GG().defaultPack], started: false });

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
    if (offline) { this.status = 'offline'; this.changed(); return { ok: true, offline: true }; }
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
          pend.gums = { divinium: G.divinium, megas: { ...G.megas }, pack: [...G.pack], started: G.started };
          pend.fresh = true;
        }
        if (this.auth) pend.fresh = true;   // (stamp the account on it, so it's yours)
        this.status = 'online';
        this.giveStarter();
        this.saveLocal();
        this.changed();
        await this.flush();
      } catch (e) {
        this.status = 'offline';
        this.changed();
      }
    } else this.giveStarter();
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
    this.profile.stats[stat] = (this.profile.stats[stat] || 0) + n;
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
    if (!Object.keys(body).length && !p.fresh) return;
    body.name = this.profile.name;
    body.updated = { '.sv': 'timestamp' };
    if (this.auth) body.uid = this.auth.session.uid;   // (the rules: only this account can change this career)
    // what's being sent now comes off the pile only once it's gone through
    const sent = JSON.parse(JSON.stringify({ inc: p.inc, max: p.max, ach: p.ach, gums: pg }));
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
  const out = { name: (p && p.name) || name, stats: blankStats(), achievements: {}, gums: blankGums() };
  if (p && p.gums && typeof p.gums === 'object') {
    out.gums.divinium = Math.max(0, Math.floor(Number(p.gums.divinium) || 0));
    for (const [id, n] of Object.entries(p.gums.megas || {})) if (isMegaId(id) && Number(n) > 0) out.gums.megas[id] = Math.floor(Number(n));
    out.gums.pack = cleanPack(p.gums.pack, out.gums.megas);
    out.gums.started = !!p.gums.started;
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
