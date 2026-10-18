// The Beta Tester skin: given once to every account that signs in before
// CONFIG.shop.beta.until, saved online, fits everyone, not for sale.
import { Career } from '../src/career/career.js';
import { SKIN_BY_ID, fits, priceOf } from '../src/career/skins.js';
import { CONFIG } from '../src/config.js';

const settle = async (c) => { for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r, 0)); await c.flush(); } };
const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const store = () => { const mem = {}; return { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } }; };
const db = {};
const fakeFetch = async (url, o = {}) => {
  const key = decodeURIComponent(url.match(/players\/(.*)\.json/)[1]);
  if (o.method === 'GET') return { ok: true, json: async () => (db[key] ? JSON.parse(JSON.stringify(db[key])) : null) };
  const body = JSON.parse(o.body); const p = db[key] || (db[key] = {});
  for (const [path, v] of Object.entries(body)) {
    const parts = path.split('/'); let obj = p; while (parts.length > 1) { const k = parts.shift(); obj = obj[k] || (obj[k] = {}); }
    const k = parts[0];
    if (v === null) delete obj[k];
    else if (v && v['.sv'] && v['.sv'].increment) obj[k] = (obj[k] || 0) + v['.sv'].increment; else if (v && v['.sv']) obj[k] = Date.now(); else obj[k] = v;
  }
  return { ok: true, json: async () => ({}) };
};

const B = CONFIG.shop.beta, S = SKIN_BY_ID[B.skin];
const end = Date.parse(B.until);
check(S && S.name === 'Beta Tester' && S.rarity === 'exclusive' && S.fx === 'beta', 'the Beta Tester skin: exclusive, with its own finish');
check(Number.isFinite(end) && new Date(end).toISOString().startsWith('2026-10-26'), 'it\'s given until the end of Sunday, October 25');
check(['kearns', 'rocco', 'brian', 'zach', 'chops'].every((c) => fits(S.id, c)), 'it fits every character');
check(priceOf(S.id) === Infinity, 'it isn\'t for sale');

// a guest: nothing
const G = new Career({}, { fetchFn: null, storage: store() });
check(!G.ownsSkin(S.id, 'kearns') && G.giveBeta(end - 1000) === null, 'a guest doesn\'t get it until they sign in');

// signed in during the week: given once, with the toast
const A = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: store() });
let toasts = 0; A.onBeta = () => toasts++;
await A.signIn('Early Bird'); await settle(A);
const now = Date.now();
if (now <= end) {
  check(A.ownsSkin(S.id, 'kearns') && A.ownsSkin(S.id, 'rocco') && toasts === 1, 'signing in this week gives it to you, with a "You\'re a Beta Tester!" toast');
  check(db.early_bird && db.early_bird.shop && db.early_bird.shop.owned && db.early_bird.shop.owned[S.id], 'it\'s saved to your account online');
  check(A.giveBeta() === null && toasts === 1, 'only once');
  check(A.wearSkin('james', S.id) && A.wornSkin('james') === S.id, 'you can wear it');
  const A2 = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: store() });
  let t2 = 0; A2.onBeta = () => t2++;
  await A2.signIn('early bird');
  check(A2.ownsSkin(S.id, 'pit') && t2 === 0, 'on another computer it\'s already yours (no second toast)');
} else console.log('(skipping the sign-in checks: the week is over)');

// after the week: not given, but kept by whoever has it
const L = new Career({}, { fetchFn: null, storage: store() });
await L.signIn('Latecomer');
L.profile.shop.owned = {};
check(L.giveBeta(end + 1000) === null && !L.ownsSkin(S.id, 'kearns'), 'signing in after the week: no skin');
check(L.giveBeta(end - 1000) && L.ownsSkin(S.id, 'kearns'), 'signing in on the last day: yours');
check(L.giveBeta(end + 1000) === null && L.ownsSkin(S.id, 'kearns'), 'and it stays yours after the week');

// PHAT CHOPS
const PC = new Career({}, { fetchFn: null, storage: store() });
await PC.signIn('PHAT CHOPS');
PC.profile.shop.owned = {};
check(PC.ownsSkin(S.id, 'chops') && PC.ownsSkin(S.id, 'kearns'), 'PHAT CHOPS owns it, like everything');
