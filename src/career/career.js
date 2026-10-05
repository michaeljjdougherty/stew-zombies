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
// There are no passwords: a username is just a name. Anyone who types yours
// plays as you. (It's a game for friends.)
// =============================================================================
import { ACHIEVEMENTS, ACH_BY_ID } from './achievements.js';

const LS = 'stew-zombies-career-v1';
export const STAT_KEYS = ['kills', 'revives', 'rounds', 'headshots', 'downs', 'games', 'bestRound'];
const MAX_STATS = new Set(['bestRound']);   // kept as the highest, not added up

export const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16);
// The database key for a name: case doesn't matter, and only safe characters.
export const nameKey = (s) => cleanName(s).toLowerCase().replace(/[^a-z0-9_-]/g, '_');

const blankStats = () => Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
const blankPending = () => ({ inc: {}, max: {}, ach: {} });

export class Career {
  constructor(cfg = {}, { fetchFn = typeof fetch === 'function' ? fetch.bind(globalThis) : null, storage = (() => { try { return globalThis.localStorage; } catch { return null; } })() } = {}) {
    this.cfg = cfg;
    this.url = String(cfg.firebaseUrl || '').trim().replace(/\/+$/, '');
    this.fetch = fetchFn;
    this.storage = storage;
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
    return { profiles: d.profiles || {}, pending: d.pending || {}, last: d.last || '' };
  }
  saveLocal() {
    if (this.profile) this.db.profiles[this.key] = this.profile;
    try { this.storage && this.storage.setItem(LS, JSON.stringify(this.db)); } catch { /* private window */ }
  }

  get lastName() { return this.db.last || ''; }
  get signedIn() { return !!this.profile; }
  get gamerscore() { return this.profile ? scoreOf(this.profile) : 0; }
  pending() { return this.db.pending[this.key] || (this.db.pending[this.key] = blankPending()); }

  // --- the database -----------------------------------------------------------
  async request(method, key, body) {
    if (!this.url || !this.fetch) throw new Error('no database');
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = ctl && setTimeout(() => ctl.abort(), (this.cfg.timeout || 6) * 1000);
    try {
      const r = await this.fetch(`${this.url}/players/${encodeURIComponent(key)}.json`, {
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

  // --- signing in -------------------------------------------------------------
  async signIn(rawName) {
    const name = cleanName(rawName);
    const key = nameKey(name);
    if (!key) return false;
    if (this.profile && this.key !== key) await this.flush();
    this.key = key;
    this.profile = normalize(this.db.profiles[key], name);
    this.profile.name = name;
    this.db.last = name;
    this.saveLocal();
    this.changed();
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
          c.name = name;
          this.profile = c;
        } else {
          // first time this name's been online: send up everything it has here
          pend.inc = {}; pend.max = {};
          for (const k of STAT_KEYS) {
            if (MAX_STATS.has(k)) { if (this.profile.stats[k]) pend.max[k] = this.profile.stats[k]; } else if (this.profile.stats[k]) pend.inc[k] = this.profile.stats[k];
          }
          pend.ach = { ...this.profile.achievements };
          pend.fresh = true;
        }
        this.status = 'online';
        this.saveLocal();
        this.changed();
        await this.flush();
      } catch (e) {
        this.status = 'offline';
        this.changed();
      }
    }
    return true;
  }

  signOut() {
    this.flush();
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
    const key = this.key, p = this.pending();
    const body = {};
    for (const [k, n] of Object.entries(p.inc)) if (n) body['stats/' + k] = { '.sv': { increment: n } };
    for (const [k, v] of Object.entries(p.max)) body['stats/' + k] = v;
    for (const [id, t] of Object.entries(p.ach)) body['achievements/' + id] = t;
    if (!Object.keys(body).length && !p.fresh) return;
    body.name = this.profile.name;
    body.updated = { '.sv': 'timestamp' };
    // what's being sent now comes off the pile only once it's gone through
    const sent = JSON.parse(JSON.stringify({ inc: p.inc, max: p.max, ach: p.ach }));
    this.flushing = true;
    try {
      await this.request('PATCH', key, body);
      const now = this.db.pending[key] || blankPending();
      for (const [k, n] of Object.entries(sent.inc)) { now.inc[k] = (now.inc[k] || 0) - n; if (!now.inc[k]) delete now.inc[k]; }
      for (const [k, v] of Object.entries(sent.max)) if (now.max[k] === v) delete now.max[k];
      for (const id of Object.keys(sent.ach)) delete now.ach[id];
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

  changed() { if (this.onChange) try { this.onChange(); } catch (e) { console.warn('career', e); } }
}

function normalize(p, name) {
  const out = { name: (p && p.name) || name, stats: blankStats(), achievements: {} };
  if (p && p.stats) for (const k of STAT_KEYS) out.stats[k] = Number(p.stats[k]) || 0;
  if (p && p.achievements) for (const [id, t] of Object.entries(p.achievements)) if (ACH_BY_ID[id]) out.achievements[id] = t;
  return out;
}

export function scoreOf(p) {
  let g = 0;
  for (const id of Object.keys(p.achievements || {})) g += ACH_BY_ID[id] ? ACH_BY_ID[id].g : 0;
  return g;
}
