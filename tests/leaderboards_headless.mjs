// The online leaderboards (src/career/leaderboards.js): finished games and
// career totals go up, the boards rank them (top 100, ties share a rank, your
// own rank when you're further down), guests and the dev account stay off,
// silly numbers are left out, and it all works without the database's index.
import { Career } from '../src/career/career.js';
import { CareerTracker } from '../src/career/tracker.js';
import { Leaderboards, ranked, roundBoard } from '../src/career/leaderboards.js';
import { CONFIG } from '../src/config.js';

const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const store = () => { const mem = {}; return { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } }; };

// a fake Firebase: Auth (PIN accounts) and the Realtime Database, with orderBy queries
const root = { players: {}, leaderboards: {} };
const accounts = {};
let indexed = true, down = false, uidN = 0;
const writes = [];
const tokenUid = (q) => { const m = /auth=([^&]+)/.exec(q || ''); return m ? decodeURIComponent(m[1]).replace('tok-', '') : null; };
const json = (j, ok = true, status = 200) => ({ ok, status, json: async () => j });
const fakeFetch = async (url, o = {}) => {
  if (down) throw new Error('offline');
  if (url.includes('identitytoolkit')) {
    const b = JSON.parse(o.body);
    if (url.includes('signUp')) {
      if (accounts[b.email]) return json({ error: { message: 'EMAIL_EXISTS' } }, false, 400);
      accounts[b.email] = { pw: b.password, uid: 'u' + (++uidN) };
    } else if (!accounts[b.email] || accounts[b.email].pw !== b.password) return json({ error: { message: 'INVALID_PASSWORD' } }, false, 400);
    const a = accounts[b.email];
    return json({ localId: a.uid, idToken: 'tok-' + a.uid, refreshToken: 'r', expiresIn: '3600' });
  }
  const [, path, q] = /firebaseio\.com\/(.*?)\.json(?:\?(.*))?$/.exec(url);
  const parts = path.split('/').map(decodeURIComponent);
  const top = root[parts[0]];
  if (o.method === 'PATCH') {
    const uid = tokenUid(q), key = parts[1];
    const node = top[key] || (top[key] = {});
    const body = JSON.parse(o.body);
    if (parts[0] === 'leaderboards') {
      // (the rules: only this career's own account, and the sanity caps)
      if (!uid || root.players[key]?.uid !== uid || body.uid !== uid) return json({ error: 'Permission denied' }, false, 401);
      for (const [k, v] of Object.entries(body)) if (!['name', 'uid', 't'].includes(k) && !(typeof v === 'number' && v >= 0 && v <= (k.endsWith('Solo') || k.endsWith('Coop') ? 255 : 1e7))) return json({ error: 'Permission denied' }, false, 401);
      writes.push({ key, body });
    }
    for (const [p, v] of Object.entries(body)) {
      const ps = p.split('/'); let obj = node; while (ps.length > 1) { const k = ps.shift(); obj = obj[k] || (obj[k] = {}); }
      const k = ps[0];
      if (v && v['.sv'] && v['.sv'].increment) obj[k] = (obj[k] || 0) + v['.sv'].increment; else if (v && v['.sv']) obj[k] = Date.now(); else obj[k] = v;
    }
    return json({});
  }
  if (parts.length > 1) return json(top[parts[1]] ?? null);
  const params = new URLSearchParams(q || '');
  if (params.has('orderBy')) {
    if (!indexed) return json({ error: 'Index not defined, add ".indexOn"' }, false, 400);
    const by = JSON.parse(params.get('orderBy'));
    let rows = Object.entries(top).filter(([, e]) => e[by] != null).sort((a, b) => a[1][by] - b[1][by]);
    if (params.has('startAt')) rows = rows.filter(([, e]) => e[by] >= Number(params.get('startAt')));
    if (params.has('limitToLast')) rows = rows.slice(-Number(params.get('limitToLast')));
    return json(Object.fromEntries(rows));
  }
  return json(top);
};

const cfg = { firebaseUrl: 'https://x.firebaseio.com', firebaseApiKey: 'k' };
async function player(name, pin = '1234') {
  const C = new Career(cfg, { fetchFn: fakeFetch, storage: store() });
  let r = await C.signIn(name, pin, { create: true });
  if (!r.ok) r = await C.signIn(name, pin);
  return { C, L: new Leaderboards(C) };
}

// a finished solo game on Stew Leonard High
const a = await player('Mike D');
for (let i = 0; i < 40; i++) a.C.add('kills');
a.C.add('headshots', 12); a.C.add('revives', 3); a.C.add('games');
await a.C.flush();
check(await a.L.finishGame({ map: 'lastbell', coop: false, round: 17 }), 'a finished game goes up');
let e = root.leaderboards.mike_d;
check(e && e.schoolSolo === 17 && e.kills === 40 && e.headshots === 12 && e.revives === 3 && e.games === 1 && e.uid === a.C.auth.session.uid && e.name === 'Mike D', 'the entry: ' + JSON.stringify(e));
check(e.schoolCoop == null && e.crustSolo == null, 'only the board that game was on gets a round');
// a worse game later doesn't lower your best; a co-op game is its own board
await a.L.finishGame({ map: 'lastbell', coop: false, round: 9 });
await a.L.finishGame({ map: 'lastbell', coop: true, round: 11 });
e = root.leaderboards.mike_d;
check(e.schoolSolo === 17 && e.schoolCoop === 11, 'best round kept (17), co-op apart (11)');
await a.L.finishGame({ map: 'crust', coop: true, round: 22 });
check(root.leaderboards.mike_d.crustCoop === 22, 'Call of the Crust co-op: 22');
check(roundBoard('range', false) === null, 'the Firing Range has no board');

// silly numbers stay off
const n0 = writes.length;
await a.L.finishGame({ map: 'lastbell', coop: false, round: 9999 });
check(root.leaderboards.mike_d.schoolSolo === 17 && writes.length === n0 + 1, 'round 9999 is left out (the rest still goes up)');

// more players, a tie, and the board
const b = await player('James'); b.C.add('kills', 90); b.C.add('games'); await b.L.finishGame({ map: 'lastbell', coop: false, round: 25 });
const c = await player('Kyle'); c.C.add('kills', 40); c.C.add('games'); await c.L.finishGame({ map: 'lastbell', coop: false, round: 17 });
let board = await a.L.board('schoolSolo', { fresh: true });
check(board.rows.map((r) => `${r.rank}:${r.name}:${r.v}`).join(' ') === '1:James:25 2:Mike D:17 2:Kyle:17', 'ranked, ties share a rank, first there listed first: ' + board.rows.map((r) => `${r.rank}:${r.name}`).join(' '));
check(board.you && board.you.rank === 2 && board.rows.find((r) => r.me).name === 'Mike D', 'your own rank, and your row marked');
board = await b.L.board('kills', { fresh: true });
check(board.rows[0].name === 'James' && board.rows[0].v === 90 && board.you.rank === 1, 'kills board: James first with 90');

// guests and PHAT CHOPS stay off
const g = new Career(cfg, { fetchFn: fakeFetch, storage: store() });
const gL = new Leaderboards(g);
check(!(await gL.finishGame({ map: 'lastbell', round: 30 })) && gL.whyNot === 'guest', 'a guest is not ranked');
const gb = await gL.board('schoolSolo', { fresh: true });
check(gb.rows.length === 3 && gb.you === null, 'a guest can still look at the boards');
const dev = await player('PHAT CHOPS');
check(dev.C.allAccess && dev.L.whyNot === 'dev', 'PHAT CHOPS is the dev account');
await dev.L.finishGame({ map: 'lastbell', round: 99 });
dev.C.add('kills', 500);
await dev.L.push();
check(!root.leaderboards.phat_chops, 'PHAT CHOPS never goes on the boards');

// someone else can't write your entry (the rules)
const mallory = await player('Mallory');
const real = mallory.C.key; mallory.C.key = 'james';
check(!(await mallory.L.push()) && root.leaderboards.james.kills === 90, "another account can't write James's entry");
mallory.C.key = real;

// the top 100, and where you are further down
const top = CONFIG.career.leaderboard.top;
for (let i = 0; i < top + 20; i++) root.leaderboards['bot' + i] = { name: 'Bot ' + i, kills: 1000 + i, t: i };
board = await a.L.board('kills', { fresh: true });
check(board.rows.length === top && board.rows[0].name === 'Bot ' + (top + 19), `the top ${top} only`);
check(board.you && board.you.rank === top + 20 + 2 && board.you.v === 40, `your rank further down: #${board.you && board.you.rank}`);

// no index in the rules yet: still works (every entry, sorted here)
indexed = false;
board = await a.L.board('kills', { fresh: true });
check(board.rows.length === top && board.you && board.you.rank === top + 22, 'without the index: same board, same rank');
indexed = true;
for (let i = 0; i < top + 20; i++) delete root.leaderboards['bot' + i];

// offline: a finished game waits, and goes up next time
down = true;
check(!(await a.L.finishGame({ map: 'crust', coop: false, round: 14 })), 'offline: nothing goes up');
let threw = false; try { await a.L.board('kills', { fresh: true }); } catch (err) { threw = err.code === 'offline'; }
check(threw, "offline: the board says it can't reach the database");
down = false;
await a.L.push();
check(root.leaderboards.mike_d.crustSolo === 14, 'back online: the game that waited goes up');

// the tracker: a game played to the end tells the leaderboards (solo or co-op, the map, the round)
const games = [];
const T = new CareerTracker(a.C);
T.onFinish = (x) => games.push(x);
const me = { id: 'p1', alive: true, loadout: { slots: [] } };
const sim = { mode: 'zombies', mapData: { id: 'lastbell' }, rounds: { round: 1 }, players: [me, { id: 'p2' }], playerById: () => me };
T.tick(sim, 'p1', 0.1);
T.onEvent({ type: 'gameOver', round: 12 }, sim, 'p1');
check(games.length === 1 && games[0].map === 'lastbell' && games[0].coop === true && games[0].round === 12, 'tracker: a finished co-op game ' + JSON.stringify(games[0]));
const range = { ...sim, mode: 'range' };
T.tick(range, 'p1', 0.1); T.onEvent({ type: 'gameOver', round: 3 }, range, 'p1');
check(games.length === 1, 'the Firing Range never counts');

// headshots can't be more than kills
check(ranked({ x: { name: 'X', kills: 5, headshots: 50 } }, 'headshots').length === 0, 'more headshots than kills is left out');
