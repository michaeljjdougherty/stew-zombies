// Emotes in the Skin Shop: two free for everyone, the rest bought with Stew
// Bucks, saved to the username (locally and online), and on the wheel after.
// Run: node tests/emoteshop_headless.mjs
import { Career } from '../src/career/career.js';
import { EMOTES, EMOTE_BY_ID } from '../src/career/emotes.js';
import { CONFIG } from '../src/config.js';

const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const settle = async (c) => { for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r, 0)); await c.flush(); } };
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
const R = CONFIG.shop.rarities;
const wheel = (c) => EMOTES.filter((e) => e.free || c.ownsEmote(e.id)).map((e) => e.id);

check(EMOTES.every((e) => R[e.rarity] && e.name && e.blurb && e.act), 'every emote has a rarity, a name, a blurb and an animation');
const paid = EMOTES.filter((e) => !e.free);
check(paid.length === 4 && EMOTE_BY_ID.jimmyShimmy.rarity === 'legendary', `four emotes for sale, the Jimmy Shimmy legendary (${R.legendary.price})`);

// a guest: the free ones only, can't buy
const G = new Career({}, { fetchFn: null, storage: store() });
check(wheel(G).join() === 'fingerGuns,bigWave', 'a guest\'s wheel: Finger Guns and Big Wave');
check(G.buyEmote('floss').code === 'guest', 'a guest can\'t buy');

// signed in, offline
const L = new Career({}, { fetchFn: null, storage: store() });
await L.signIn('Dancer');
check(L.buyEmote('floss').code === 'broke', 'not enough Stew Bucks: no sale');
L.addBucks(R.rare.price + 10);
check(L.buyEmote('floss').ok && L.bucks === 10 && L.ownsEmote('floss'), `bought The Floss for ${R.rare.price}`);
check(L.buyEmote('floss').code === 'owned' && L.buyEmote('bigWave').code === 'owned', 'can\'t buy one twice (or a free one)');
check(L.buyEmote('nope').code === 'unknown', 'an unknown emote can\'t be bought');
check(wheel(L).includes('floss') && !wheel(L).includes('jimmyShimmy'), 'it\'s on your wheel; the ones you haven\'t bought aren\'t');

// online: the purchase saves to the username and comes back on another device
const A = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: store() });
await A.signIn('Shimmy');
A.addBucks(R.legendary.price);
check(A.buyEmote('jimmyShimmy').ok, 'bought the Jimmy Shimmy online');
await settle(A);
const B = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: store() });
await B.signIn('Shimmy');
check(B.ownsEmote('jimmyShimmy') && B.bucks === 0, 'another device: it\'s yours there too, and the Bucks are spent');
check(!B.ownsEmote('floss'), '...and only what you bought');
console.log(process.exitCode ? '\nFAILED' : '\nall passed');
