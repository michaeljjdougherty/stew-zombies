// =============================================================================
// Leaderboards: everyone's careers, ranked online (the Career screen's
// Leaderboards tab, src/ui/careerUI.js). The highest round on each map (solo
// and co-op apart) and the career totals: kills, headshots, revives, wall buys
// and games played.
//
// In the Firebase Realtime Database next to the careers, one entry a username:
//   leaderboards/<name key> = { name, uid, t, kills, headshots, revives,
//     wallBuys, games, schoolSolo, schoolCoop, crustSolo, crustCoop }
// Only signed-in players (with a PIN account) are on it: guests and the all-access dev
// accounts (PHAT CHOPS) never are. A score goes up only when a game is
// finished (game over), and the rules only let a career's own account write
// its entry (the rules to paste are in docs/LEADERBOARDS.md).
// Without the database's index the boards still work: they download every
// entry and sort them here.
// =============================================================================
import { CONFIG } from '../config.js';

export const BOARDS = [
  { id: 'schoolSolo', kind: 'round', map: 'lastbell', coop: false, label: 'Stew Leonard High', mode: 'Solo' },
  { id: 'schoolCoop', kind: 'round', map: 'lastbell', coop: true, label: 'Stew Leonard High', mode: 'Co-op' },
  { id: 'crustSolo', kind: 'round', map: 'crust', coop: false, label: 'Call of the Crust', mode: 'Solo' },
  { id: 'crustCoop', kind: 'round', map: 'crust', coop: true, label: 'Call of the Crust', mode: 'Co-op' },
  { id: 'kills', kind: 'total', stat: 'kills', label: 'Kills' },
  { id: 'headshots', kind: 'total', stat: 'headshots', label: 'Headshots' },
  { id: 'revives', kind: 'total', stat: 'revives', label: 'Revives' },
  { id: 'wallBuys', kind: 'total', stat: 'wallBuys', label: 'Wall buys' },
  { id: 'games', kind: 'total', stat: 'games', label: 'Games played' },
];
export const BOARD_BY_ID = Object.fromEntries(BOARDS.map((b) => [b.id, b]));
export const roundBoard = (map, coop) => BOARDS.find((b) => b.kind === 'round' && b.map === map && b.coop === !!coop) || null;

const LB = () => CONFIG.career.leaderboard;
const LS = 'stew-zombies-leaderboards-v1';
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0);

// The sanity caps: a number past these isn't sent (or shown).
export function saneScore(id, v, stats = null) {
  const b = BOARD_BY_ID[id];
  if (!b || !(v > 0) || !Number.isFinite(v)) return false;
  if (b.kind === 'round') return v <= LB().maxRound;
  if (v > LB().maxTotal) return false;
  if (id === 'headshots' && stats && v > (stats.kills || 0)) return false;   // (every headshot was a kill)
  return true;
}

export class Leaderboards {
  constructor(career) {
    this.career = career;
    this.cache = {};          // board id -> { at, result }
    this.pushing = false;
  }

  get url() { return this.career.url; }
  // Can you be on the boards? Signed in with a PIN account, and not a dev account.
  get counts() { const C = this.career; return !!(C.signedIn && C.url && C.auth && !C.allAccess); }
  // Why you're not on them (for the screen): 'guest' | 'dev' | 'local' | null
  get whyNot() {
    const C = this.career;
    if (!C.url || !C.auth) return 'local';
    if (!C.signedIn) return 'guest';
    if (C.allAccess) return 'dev';
    return null;
  }

  // The rounds from finished games that haven't gone up yet: { name key: { board id: round } }
  loadPending() { try { const d = JSON.parse(this.career.storage && this.career.storage.getItem(LS)); return d && typeof d === 'object' ? d : {}; } catch { return {}; } }
  savePending(d) { try { this.career.storage && this.career.storage.setItem(LS, JSON.stringify(d)); } catch { /* private window */ } }

  // A game just finished: the round you got to on that map (solo or co-op),
  // and your career totals, go up to the boards.
  finishGame({ map, coop = false, round = 0 } = {}) {
    if (!this.counts) return Promise.resolve(false);
    const b = roundBoard(map, coop), r = num(round);
    if (b && saneScore(b.id, r)) {
      const all = this.loadPending(), mine = all[this.career.key] || (all[this.career.key] = {});
      if (r > (mine[b.id] || 0)) { mine[b.id] = r; this.savePending(all); }
    }
    return this.push();
  }

  async req(method, path, { query = '', body = null } = {}) {
    const C = this.career;
    if (!C.url || !C.fetch) throw new Error('no database');
    let q = query;
    if (method !== 'GET') {
      const tok = C.auth && await C.auth.token();
      if (!tok) throw new Error('not signed in');
      q += (q ? '&' : '') + 'auth=' + encodeURIComponent(tok);
    }
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = ctl && setTimeout(() => ctl.abort(), (C.cfg.timeout || 6) * 1000);
    let r;
    try {
      r = await C.fetch(`${C.url}/leaderboards${path}.json${q ? '?' + q : ''}`, {
        method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined,
      });
    } catch (e) { const err = new Error('offline'); err.code = 'offline'; throw err; } finally { if (t) clearTimeout(t); }
    if (!r.ok) { const err = new Error('database said ' + r.status); err.code = 'refused'; err.status = r.status; throw err; }
    return await r.json();
  }

  // Send your entry up: your career totals as they are now, and your best
  // rounds (the higher of the database's and the finished games waiting here).
  async push() {
    const C = this.career;
    if (!this.counts || this.pushing || !C.auth.session) return false;
    const key = C.key;
    this.pushing = true;
    try {
      const cur = (await this.req('GET', '/' + encodeURIComponent(key))) || {};
      const all = this.loadPending(), waiting = { ...(all[key] || {}) };
      const stats = C.profile.stats, body = { name: C.profile.name, uid: C.auth.session.uid, t: { '.sv': 'timestamp' } };
      for (const b of BOARDS) {
        const v = b.kind === 'total' ? Math.max(num(stats[b.stat]), num(cur[b.id])) : Math.max(num(waiting[b.id]), num(cur[b.id]));
        if (saneScore(b.id, v, stats)) body[b.id] = v;
      }
      await this.req('PATCH', '/' + encodeURIComponent(key), { body });
      // (what went up comes off the pile; a better game since stays on it)
      const now = this.loadPending(), mine = now[key] || {};
      for (const [id, v] of Object.entries(waiting)) if (mine[id] === v) delete mine[id];
      if (!Object.keys(mine).length) delete now[key];
      this.savePending(now);
      this.cache = {};
      return true;
    } catch {
      return false;   // (offline: it waits here for the next finished game, or the next sign-in)
    } finally {
      this.pushing = false;
    }
  }

  // One board: { rows: [{ rank, name, v, me }] (the top CONFIG...top), you: { rank, v } | null, total }
  // Throws (err.code 'offline') when the database can't be reached.
  async board(id, { fresh = false } = {}) {
    const b = BOARD_BY_ID[id];
    if (!b) return { rows: [], you: null };
    const hit = this.cache[id];
    if (!fresh && hit && Date.now() - hit.at < LB().refresh * 1000) return hit.result;
    const top = LB().top, me = this.counts ? this.career.key : null;
    let list, whole = false;
    try {
      list = await this.req('GET', '', { query: `orderBy=${encodeURIComponent(JSON.stringify(id))}&limitToLast=${top}` });
    } catch (e) {
      if (e.code === 'offline') throw e;
      // (no index for it in the rules yet: every entry, sorted here)
      list = await this.req('GET', '');
      whole = true;
    }
    const rows = ranked(list, id);
    const result = { rows: rows.slice(0, top).map((r) => ({ ...r, me: r.key === me })), you: null };
    if (me) {
      const mine = rows.find((r) => r.key === me);
      if (mine) result.you = { rank: mine.rank, v: mine.v };
      else if (!whole) {
        // not in the top: how many are ahead of you
        const own = await this.req('GET', '/' + encodeURIComponent(me)).catch(() => null);
        const v = own && num(own[id]);
        if (v > 0 && saneScore(id, v)) {
          const ahead = await this.req('GET', '', { query: `orderBy=${encodeURIComponent(JSON.stringify(id))}&startAt=${v + 1}` }).catch(() => null);
          if (ahead) result.you = { rank: ranked(ahead, id).length + 1, v };
        }
      }
    }
    this.cache[id] = { at: Date.now(), result };
    return result;
  }
}

// Entries -> [{ key, name, v, rank }], best first. Ties share a rank (1, 2, 2, 4),
// and whoever got there first is listed first.
export function ranked(list, id) {
  const rows = [];
  for (const [key, e] of Object.entries(list && typeof list === 'object' ? list : {})) {
    if (!e || typeof e !== 'object') continue;
    const v = num(e[id]);
    if (!saneScore(id, v, BOARD_BY_ID[id].kind === 'total' ? e : null)) continue;
    rows.push({ key, name: String(e.name || key).slice(0, 16), v, t: num(e.t) });
  }
  rows.sort((a, b) => b.v - a.v || a.t - b.t || a.name.localeCompare(b.name));
  let rank = 0;
  rows.forEach((r, i) => { if (i === 0 || r.v !== rows[i - 1].v) rank = i + 1; r.rank = rank; });
  return rows;
}
