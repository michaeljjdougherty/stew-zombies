import { Career } from '../src/career/career.js';
import { CareerTracker } from '../src/career/tracker.js';
const mem = {}; const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
// a fake Firebase
const db = {};
const fakeFetch = async (url, o = {}) => {
  const key = decodeURIComponent(url.match(/players\/(.*)\.json/)[1]);
  if (o.method === 'GET') return { ok: true, json: async () => db[key] ?? null };
  const body = JSON.parse(o.body); const p = db[key] || (db[key] = {});
  for (const [path, v] of Object.entries(body)) {
    const parts = path.split('/'); let obj = p; while (parts.length > 1) { const k = parts.shift(); obj = obj[k] || (obj[k] = {}); }
    const k = parts[0];
    if (v && v['.sv'] && v['.sv'].increment) obj[k] = (obj[k] || 0) + v['.sv'].increment; else if (v && v['.sv']) obj[k] = Date.now(); else obj[k] = v;
  }
  return { ok: true, json: async () => ({}) };
};
const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const unlocked = [];
const C = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage });
C.onUnlock = (a) => unlocked.push(a.id);
await C.signIn('Mike D');
check(C.signedIn && C.key === 'mike_d' && C.status === 'online', 'signs in online as ' + C.key);
for (let i = 0; i < 250; i++) C.add('kills');
check(unlocked.includes('kills250'), '250 kills unlocks All You Can Eat');
await C.flush();
check(db.mike_d.stats.kills === 250 && db.mike_d.achievements.kills250, 'kills and the achievement go up to the database');
// a second computer, same name
const mem2 = {}; const st2 = { getItem: (k) => mem2[k] ?? null, setItem: (k, v) => { mem2[k] = v; } };
const C2 = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: st2 });
await C2.signIn('mike d');
check(C2.profile.stats.kills === 250 && C2.has('kills250'), 'same username elsewhere: stats and achievements come back');
C2.add('kills', 5); C.add('kills', 3);
await C2.flush(); await C.flush();
check(db.mike_d.stats.kills === 258, 'two computers at once both count (' + db.mike_d.stats.kills + ')');
// offline: waits, then goes up
const broken = async () => { throw new Error('offline'); };
const C3 = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: broken, storage });
await C3.signIn('Mike D');
check(C3.status === 'offline' && C3.profile.stats.kills >= 253, 'offline: keeps the local copy');
C3.add('revives', 2); await C3.flush();
const C4 = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage });
await C4.signIn('Mike D');
check(db.mike_d.stats.revives === 2, 'back online: what waited goes up (' + db.mike_d.stats.revives + ')');
// tracker
const unl2 = []; const L = new Career({}, { fetchFn: null, storage: { getItem: () => null, setItem() {} } });
L.onUnlock = (a) => unl2.push(a.id);
await L.signIn('Tester');
const T = new CareerTracker(L);
const me = { id: 'p1', alive: true, loadout: { slots: [{ id: 'Fucci Gun' }, { id: 'The Chopper+' }] } };
const sim = { mode: 'zombies', rounds: { round: 1 }, playerById: () => me };
T.tick(sim, 'p1', 1, { hardcore: true });
check(unl2.includes('fullyLoaded'), 'Fucci + Chopper: Fully Loaded');
T.onEvent({ type: 'roundStart', round: 10, cheddar: true }, sim, 'p1');
T.onEvent({ type: 'roundEnd', round: 10, cheddar: true }, sim, 'p1');
check(unl2.includes('round10') && unl2.includes('cheddar'), 'round 10 and a clean Cheddar round');
T.onEvent({ type: 'playerRevived', playerId: 'p2', by: 'p1' }, sim, 'p1');
T.onEvent({ type: 'zombieKilled', playerId: 'p1', headshot: true }, sim, 'p1');
T.onEvent({ type: 'zombieKilled', playerId: 'p2' }, sim, 'p1');
T.onEvent({ type: 'bossEnd' }, sim, 'p1');
check(L.profile.stats.revives === 1 && L.profile.stats.kills === 1 && L.profile.stats.headshots === 1 && L.profile.stats.rounds === 1 && L.profile.stats.games === 1 && L.profile.stats.bestRound === 10, 'stats: ' + JSON.stringify(L.profile.stats));
check(unl2.includes('egg') && unl2.includes('eggHardcore'), 'the egg, on Hardcore');
const T2 = new CareerTracker(L); const sim2 = { ...sim, mode: 'explore' };
T2.tick(sim2, 'p1', 1); T2.onEvent({ type: 'zombieKilled', playerId: 'p1' }, sim2, 'p1');
check(L.profile.stats.kills === 1, 'Explore doesn\'t count');
console.log(process.exitCode ? 'FAILED' : 'all career checks passed');

// in a real game: the tracker counts what the sim says happened
{
  const { GameSim } = await import('../src/sim/sim.js');
  const { SCHOOL } = await import('../src/map/school.js');
  const { emptyCommand } = await import('../src/sim/player.js');
  const { killZombie } = await import('../src/sim/zombies.js');
  const R = new Career({}, { fetchFn: null, storage: { getItem: () => null, setItem() {} } });
  await R.signIn('Real');
  const tr = new CareerTracker(R);
  const sim = new GameSim({ map: SCHOOL, seed: 5, mode: 'zombies' });
  const me = sim.addPlayer('p1', 'Real');
  me.health = me.maxHealth = 1e9;
  let kills = 0;
  for (let i = 0; i < 60 * 240 && sim.rounds.round < 4; i++) {
    sim.setInput('p1', emptyCommand());
    sim.step(1 / 60);
    tr.tick(sim, 'p1', 1 / 60);
    for (const z of [...sim.zombies]) if (z.state === 'chase') { killZombie(sim, z, { kind: 'bullet', part: 'head', headshot: true, playerId: 'p1' }); kills++; }
    for (const e of sim.drainEvents()) tr.onEvent(e, sim, 'p1');
  }
  const s = R.profile.stats;
  check(s.kills === kills && kills > 0, `real game: kills counted (${s.kills} of ${kills})`);
  check(s.rounds === sim.rounds.round - 1 && s.games === 1 && s.bestRound === sim.rounds.round, `real game: rounds ${s.rounds}, best ${s.bestRound}, games ${s.games}`);
  console.log(process.exitCode ? 'FAILED' : 'all career checks passed');
}

// PINs: a fake Firebase with sign-in and the database rules
{
  const accounts = {}; const pdb = {}; let tries = 0;
  const tokens = {};
  const ff = async (url, o = {}) => {
    const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (url.includes('identitytoolkit')) {
      const b = JSON.parse(o.body);
      if (url.includes('signUp')) {
        if (accounts[b.email]) return res(400, { error: { message: 'EMAIL_EXISTS' } });
        accounts[b.email] = { pw: b.password, uid: 'u' + Object.keys(accounts).length };
      } else {
        const a = accounts[b.email];
        if (!a || a.pw !== b.password) { tries++; return res(400, { error: { message: tries > 5 ? 'TOO_MANY_ATTEMPTS_TRY_LATER' : 'INVALID_LOGIN_CREDENTIALS' } }); }
      }
      const a = accounts[b.email]; const tok = 'tok-' + a.uid + '-' + Math.random(); tokens[tok] = a.uid;
      return res(200, { idToken: tok, refreshToken: 'r', expiresIn: '3600', localId: a.uid });
    }
    const m = url.match(/players\/([^.?]*)\.json(\?auth=(.*))?/); const key = decodeURIComponent(m[1]);
    if (o.method === 'GET') return res(200, pdb[key] ?? null);
    const uid = m[3] ? tokens[decodeURIComponent(m[3])] : null;
    const body = JSON.parse(o.body);
    const cur = pdb[key];
    // rules: signed in, the career is unclaimed or yours, and stays yours
    if (!uid || (cur && cur.uid && cur.uid !== uid) || (body.uid ?? (cur && cur.uid)) !== uid) return res(401, { error: 'Permission denied' });
    const p = pdb[key] || (pdb[key] = {});
    for (const [path, v] of Object.entries(body)) {
      const parts = path.split('/'); let obj = p; while (parts.length > 1) { const k = parts.shift(); obj = obj[k] || (obj[k] = {}); }
      const k = parts[0];
      if (v && v['.sv'] && v['.sv'].increment) obj[k] = (obj[k] || 0) + v['.sv'].increment; else if (v && v['.sv']) obj[k] = 1; else obj[k] = v;
    }
    return res(200, {});
  };
  const memA = {}; const stA = { getItem: (k) => memA[k] ?? null, setItem: (k, v) => { memA[k] = v; } };
  const cfgP = { firebaseUrl: 'https://x.firebaseio.com', firebaseApiKey: 'k' };
  const A = new Career(cfgP, { fetchFn: ff, storage: stA });
  check(A.pinsOn, 'PINs on with an API key');
  check((await A.lookup('Kearns')).claimed === false, 'a new name is free');
  let r = await A.signIn('Kearns', '4821', { create: true });
  check(r.ok && A.signedIn, 'new name: make a PIN, signed in');
  A.add('kills', 7); await A.flush();
  check(pdb.kearns && pdb.kearns.uid && pdb.kearns.stats.kills === 7, 'its career is stamped with the account and saved');
  check((await A.lookup('kearns')).claimed, 'now the name is taken');
  const memB = {}; const stB = { getItem: (k) => memB[k] ?? null, setItem: (k, v) => { memB[k] = v; } };
  const B = new Career(cfgP, { fetchFn: ff, storage: stB });
  r = await B.signIn('Kearns', '1111', { create: true });
  check(!r.ok && r.code === 'taken', 'someone else can\'t make a PIN for a taken name');
  r = await B.signIn('Kearns', '1111');
  check(!r.ok && r.code === 'badpin' && !B.signedIn, 'wrong PIN: not signed in');
  r = await B.signIn('Kearns', '4821');
  check(r.ok && B.profile.stats.kills === 7, 'right PIN on another computer: the career comes back');
  // a stranger signed in as themselves can't write to Kearns
  const Cx = new Career(cfgP, { fetchFn: ff, storage: { getItem: () => null, setItem() {} } });
  await Cx.signIn('Ryan', '2222', { create: true });
  Cx.key = 'kearns'; Cx.add('kills', 1000); await Cx.flush();
  check(pdb.kearns.stats.kills === 7, 'the rules keep other accounts off your career');
  // offline: this device knows the PIN
  const offl = async (url, o) => { throw new Error('net'); };
  const D = new Career(cfgP, { fetchFn: offl, storage: stA });
  r = await D.signIn('Kearns', '4821');
  check(r.ok && r.offline && D.signedIn, 'offline on a device you used: the PIN still works');
  r = await new Career(cfgP, { fetchFn: offl, storage: stA }).signIn('Kearns', '0000');
  check(!r.ok, 'offline with the wrong PIN: no');
  for (let i = 0; i < 6; i++) r = await B.signIn('Kearns', '9999');
  check(r.code === 'locked', 'too many wrong PINs: locked for a while');
  console.log(process.exitCode ? 'FAILED' : 'all career checks passed');
}
