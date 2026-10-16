// The Battle Pass: 20 tiers, pass XP from playing, its skins and emotes on
// every character, the Stew Bucks tiers paid once, and the XP saved online.
import { Career } from '../src/career/career.js';
import { CareerTracker } from '../src/career/tracker.js';
import { SKINS, SKIN_BY_ID, applySkin, skinsFor } from '../src/career/skins.js';
import { EMOTES, EMOTE_BY_ID } from '../src/career/emotes.js';
import { passTiers, tierOf, passProgress } from '../src/career/battlepass.js';
import { featuredItems } from '../src/ui/storeBlade.js';
import { CONFIG } from '../src/config.js';

const settle = async (c) => { for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r, 0)); await c.flush(); } };
const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const P = CONFIG.shop.pass;
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

// --- the tiers ---
const T = passTiers();
check(T.length === 20 && P.tiers === 20, '20 tiers');
check(T.every((t, i) => t.tier === i + 1 && t.kind !== 'none'), 'every tier has a prize');
const passSkins = SKINS.filter((s) => s.unlock && s.unlock.kind === 'pass'), passEmotes = EMOTES.filter((e) => e.pass);
check(passSkins.length === T.filter((t) => t.kind === 'skin').length && passEmotes.length === T.filter((t) => t.kind === 'emote').length, `${passSkins.length} skins and ${passEmotes.length} emotes, each on a tier of its own`);
check(passSkins.length >= 8 && passEmotes.length >= 3, 'new skins and new emotes in the pass');
const top = T[T.length - 1];
check(top.kind === 'skin' && top.item.name === 'Burger Bros', 'the top tier is Burger Bros');
const bb = SKIN_BY_ID.burgerBros.look;
check(bb.top.text.front === 'BURGER BROS' && bb.top.text.back === 'BURGER BROS' && bb.gear.some((g) => g.kind === 'visor' && g.text === 'BURGER BROS') && bb.gear.some((g) => g.kind === 'nameTag'), 'Burger Bros: the name front and back, on the visor and the name tag');
check(passSkins.every((s) => !s.only) && ['kearns', 'rocco', 'brian', 'chops', 'zach'].every((ch) => passSkins.every((s) => skinsFor(ch).includes(s))), 'every pass skin fits every character');
const kearns = { name: 'Kearns', top: { type: 'tee', color: 'shirt' }, pants: 'jeans', shoes: 'sneaker', hair: { color: [1, 2, 3] } };
check(applySkin(kearns, 'kearns', 'burgerBros').top.text.front === 'BURGER BROS' && applySkin(kearns, 'james', 'burgerBros').gear.length === 2, 'it goes on anyone');
check(tierOf(0) === 0 && tierOf(P.xpPerTier - 1) === 0 && tierOf(P.xpPerTier) === 1 && tierOf(1e9) === 20, 'a tier every ' + P.xpPerTier + ' XP, up to 20');
const g = passProgress(P.xpPerTier * 3 + 250);
check(g.tier === 3 && g.into === 250 && g.need === P.xpPerTier && !g.done && passProgress(1e9).done, 'progress: tier 3, 250 into the next');

// --- earning XP by playing ---
const L = new Career({}, { fetchFn: null, storage: store() });
const tiers = [];
L.onPassTier = (t) => tiers.push(t.tier);
await L.signIn('Passer');
check(L.passXp === 0 && L.passTier === 0, 'a new career: tier 0');
check(!L.ownsSkin('warmUp', 'kearns') && !L.ownsEmote('dab'), 'nothing from the pass yet');
const tr = new CareerTracker(L);
const me = { id: 'p1', alive: true, loadout: { slots: [] } };
const sim = { mode: 'zombies', rounds: { round: 1 }, playerById: () => me };
tr.tick(sim, 'p1', 0.1);
check(L.passXp === P.perGame, `a game: ${P.perGame} XP`);
tr.onEvent({ type: 'roundStart', round: 1 }, sim, 'p1'); tr.onEvent({ type: 'roundEnd', round: 1 }, sim, 'p1');
check(L.passXp === P.perGame + P.perRound, `a round: ${P.perRound} more`);
for (let i = 0; i < 10; i++) tr.onEvent({ type: 'zombieKilled', playerId: 'p1' }, sim, 'p1');
const xp = P.perGame + P.perRound + 10 * P.perKill;
check(L.passXp === xp, `10 kills: ${10 * P.perKill} more (${xp})`);

// --- reaching tiers ---
L.addPassXp(P.xpPerTier - xp);
check(L.passTier === 1 && L.ownsSkin('warmUp', 'kearns') && L.ownsSkin('warmUp', 'rocco') && tiers.join() === '1', 'tier 1: Warm Up, on everyone, with a pop-up');
check(L.wearSkin('brian', 'warmUp') && L.wornSkin('brian') === 'warmUp', 'Brian wears it');
check(!L.buySkin('warmUp').ok && !L.buySkin('burgerBros').ok && L.buyEmote('salute').code === 'unlock', 'pass items aren\'t for sale');
const bucks0 = L.bucks;
L.addPassXp(P.xpPerTier * 3);
check(L.passTier === 4 && tiers.join() === '1,2,3,4', 'three tiers at once: a pop-up for each');
check(L.bucks === bucks0 + P.bucks[2], `tier 2 paid ${P.bucks[2]} Bucks`);
check(L.ownsEmote('dab') && !L.ownsEmote('robot'), 'tier 4: the Dab (not the Robot yet)');
check(L.payPass() === 0 && L.bucks === bucks0 + P.bucks[2], 'Bucks tiers pay once');
L.addPassXp(P.xpPerTier * 100);
const allBucks = Object.values(P.bucks).reduce((a, b) => a + b, 0);
check(L.passTier === 20 && L.ownsSkin('burgerBros', 'pit') && L.ownsEmote('salute') && L.bucks === bucks0 + allBucks, `the whole pass: Burger Bros, every emote, ${allBucks} Bucks in all`);
check(featuredItems(5, [{ id: 'kearns', name: 'Kearns' }, { id: 'ryan', name: 'Ryan' }], null, 20).every((x) => (x.kind === 'emote' ? !EMOTE_BY_ID[x.id].pass : !SKIN_BY_ID[x.id].unlock)), 'the pass isn\'t in Featured today');
const guest = new Career({}, { fetchFn: null, storage: store() });
guest.addPassXp(1e6);
check(guest.passTier === 0 && !guest.ownsEmote('dab'), 'a guest earns no XP');

// --- saved online ---
const A = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: store() });
await A.signIn('Grinder');
A.addPassXp(P.xpPerTier * 2 + 40); await settle(A);
check(db.grinder.shop.passXp === P.xpPerTier * 2 + 40 && db.grinder.shop.paid.pass2, 'XP and the paid tier go up to the database');
const B = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: store() });
let paidB = 0; B.onBucks = (n) => { paidB += n; };
await B.signIn('grinder');
check(B.passTier === 2 && B.ownsSkin('warmUp', 'zach') && B.bucks === A.bucks && paidB === 0, 'another computer: same tier, same Bucks, no paying twice');
A.addPassXp(30); B.addPassXp(30); await settle(A); await settle(B);
check(db.grinder.shop.passXp === P.xpPerTier * 2 + 100, 'both computers earning XP at once both count');
// an older save from before the pass: no XP, nothing breaks
db.old = { name: 'Old', stats: { kills: 5 }, shop: { bucks: 50 } };
const O = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: store() });
await O.signIn('Old');
check(O.passXp === 0 && O.bucks === 50, 'a save from before the pass starts at tier 0');
