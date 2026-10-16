// The Skin Shop: Stew Bucks from playing and achievements, buying and wearing
// skins, and all of it saved to the username (locally and online).
import { Career } from '../src/career/career.js';
import { CareerTracker } from '../src/career/tracker.js';
import { SKINS, SKIN_BY_ID, priceOf, applySkin } from '../src/career/skins.js';
import { ACH_BY_ID } from '../src/career/achievements.js';
import { CONFIG } from '../src/config.js';

// (a save already on its way: wait for it, then send what's left)
const settle = async (c) => { for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r, 0)); await c.flush(); } };
const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const S = CONFIG.shop;
const store = () => { const mem = {}; return { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } }; };
// a fake Firebase (the same as the career test's)
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

// --- the catalogue ---
check(SKINS.length >= 8 && SKINS.every((s) => S.rarities[s.rarity] && s.look && s.look.top && s.name && s.blurb), `${SKINS.length} skins, each with a rarity, a look and a blurb`);
check(new Set(SKINS.map((s) => s.id)).size === SKINS.length, 'skin ids are all different');
const kearns = { name: 'Kearns', top: { type: 'tee', color: 'shirt' }, layer: { type: 'zip', color: '#000' }, pants: 'jeans', shoes: 'sneaker', hair: { style: 'quiff', color: [1, 2, 3] }, watch: { side: 'left' } };
const tux = applySkin(kearns, 'kearns', 'tux');
check(tux.top.type === 'suit' && tux.layer === undefined && tux.pants === 'suit' && tux.shoes === 'dress' && tux.id === 'kearns', 'a skin swaps the outfit (tux: suit, no jacket, dress shoes)');
check(tux.watch === kearns.watch && tux.hair === kearns.hair && kearns.top.type === 'tee', 'it keeps their accessories and hair, and leaves the original alone');
check(applySkin(kearns, 'kearns', 'golden').hair.color !== kearns.hair.color, 'a skin can dye the hair (Golden Ladle)');
check(applySkin(kearns, 'kearns', 'nope') === kearns, 'an unknown skin: their own clothes');

// --- earning by playing ---
const L = new Career({}, { fetchFn: null, storage: store() });
const got = [];
L.onBucks = (n, why) => got.push([n, why]);
await L.signIn('Shopper');
check(L.bucks === 0, 'a new career starts with 0 ' + S.currency);
const T = new CareerTracker(L);
const me = { id: 'p1', alive: true, loadout: { slots: [] } };
const sim = { mode: 'zombies', rounds: { round: 1 }, playerById: () => me };
T.tick(sim, 'p1', 0.1);
for (let r = 1; r <= 3; r++) { T.onEvent({ type: 'roundStart', round: r }, sim, 'p1'); T.onEvent({ type: 'roundEnd', round: r }, sim, 'p1'); }
check(L.bucks === 3 * S.perRound, `3 rounds survived: ${L.bucks} (${S.perRound} a round)`);
for (let i = 0; i < S.killsPerBuck * 4 - 1; i++) T.onEvent({ type: 'zombieKilled', playerId: 'p1' }, sim, 'p1');
check(L.bucks === 3 * S.perRound + 3, `${S.killsPerBuck * 4 - 1} kills: 3 more`);
T.onEvent({ type: 'zombieKilled', playerId: 'p1' }, sim, 'p1');
check(L.bucks === 3 * S.perRound + 4, 'one more kill rounds it up to 4');
const guest = new Career({}, { fetchFn: null, storage: store() });
guest.addBucks(100);
check(guest.bucks === 0 && !guest.buySkin('jersey').ok && guest.buySkin('jersey').code === 'guest', 'a guest earns nothing and can\'t buy');

// --- achievements pay (any achievement, new ones included) ---
const before = L.bucks;
L.unlock('round10');
check(L.bucks === before + ACH_BY_ID.round10.g * S.perGamerscore && got.some(([n, w]) => w === 'achievement' && n === ACH_BY_ID.round10.g * S.perGamerscore), `an achievement pays its G x ${S.perGamerscore}`);
L.unlock('round10');
check(L.bucks === before + ACH_BY_ID.round10.g * S.perGamerscore, 'and only once');
check(L.payAchievements() === 0, 'paying again pays nothing');

// --- buying and wearing ---
const price = priceOf('jersey');
check(!L.buySkin('golden').ok && L.buySkin('golden').code === 'broke', 'can\'t buy what you can\'t afford');
L.addBucks(price + 5 - L.bucks);
check(L.buySkin('jersey').ok && L.bucks === 5 && L.ownsSkin('jersey'), `bought Game Day for ${price}`);
check(L.buySkin('jersey').code === 'owned', 'can\'t buy it twice');
check(L.wornSkin('kearns') === null && L.wearSkin('kearns', 'jersey') && L.wornSkin('kearns') === 'jersey', 'Kearns wears it');
check(!L.wearSkin('ryan', 'golden') && L.wornSkin('ryan') === null, 'can\'t wear one you don\'t own');
check(L.wearSkin('ryan', 'jersey') && L.wornSkin('ryan') === 'jersey', 'one skin fits the whole crew');
L.wearSkin('kearns', null);
check(L.wornSkin('kearns') === null && L.wornSkin('ryan') === 'jersey', 'back to his own clothes (Ryan keeps his)');

// --- saved: this browser, and online on another computer ---
const st = store();
const A = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: st });
const paid = [];
A.onBucks = (n, why) => paid.push([n, why]);
// an old career: achievements from before the shop existed
db.vet = { name: 'Vet', stats: { kills: 300 }, achievements: { kills250: 1, round10: 2 } };
await A.signIn('Vet');
const back = (ACH_BY_ID.kills250.g + ACH_BY_ID.round10.g) * S.perGamerscore;
check(A.bucks === back && paid.some(([n, w]) => w === 'backpay' && n === back), `an old career gets paid for the achievements it had (${back})`);
await A.flush();
check(db.vet.shop.bucks === back && db.vet.shop.paid.kills250 && db.vet.shop.paid.round10, 'the bucks and what\'s been paid go up to the database');
A.addBucks(1000);
check(A.buySkin('tux').ok, 'buys Black Tie');
A.wearSkin('pit', 'tux');
await settle(A);
check(db.vet.shop.owned.tux && db.vet.shop.wear.pit === 'tux' && db.vet.shop.bucks === back + 1000 - priceOf('tux'), 'the skin and who wears it go up too');
const B = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: store() });
let paidB = 0; B.onBucks = (n) => { paidB += n; };
await B.signIn('vet');
check(B.ownsSkin('tux') && B.wornSkin('pit') === 'tux' && B.bucks === A.bucks && paidB === 0, 'same username on another computer: same skins, same bucks, no paying twice');
B.wearSkin('pit', null);
await settle(B);
check(!db.vet.shop.wear || !db.vet.shop.wear.pit, 'taking it off goes up too');
// both computers earn at once
A.addBucks(7); B.addBucks(11);
await settle(A); await settle(B);
check(db.vet.shop.bucks === back + 1000 - priceOf('tux') + 18, 'two computers earning at once both count');
// offline: it waits in this browser
const C3 = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: async () => { throw new Error('offline'); }, storage: st });
await C3.signIn('Vet');
C3.addBucks(50); C3.buySkin('jersey'); C3.wearSkin('kearns', 'jersey'); await C3.flush();
check(C3.status === 'offline' && C3.ownsSkin('jersey'), 'offline: buys with the local copy');
const C4 = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: st });
await C4.signIn('Vet'); await settle(C4);
check(db.vet.shop.owned.jersey && db.vet.shop.wear.kearns === 'jersey' && C4.ownsSkin('tux') && C4.ownsSkin('jersey'), 'back online: what waited goes up, and nothing is lost');
check(Object.values(SKIN_BY_ID).every((s) => priceOf(s.id) > 0), 'every skin has a price');

// --- the special skins: Sexy Fucci (free) and the Opal (1000 kills as that character) ---
const OP = SKIN_BY_ID.opal;
check(OP.name === 'Pink Diamond Galaxy Opal Drippy Face Build Skin', 'the Opal skin has its full name');
const F = new Career({}, { fetchFn: null, storage: store() });
await F.signIn('Fresh');
check(F.ownsSkin('sexyFucci', 'rocco') && F.wearSkin('rocco', 'sexyFucci') && F.wornSkin('rocco') === 'sexyFucci', 'everyone has Sexy Fucci for Rocco, for free');
check(!F.ownsSkin('sexyFucci', 'ryan') && !F.wearSkin('ryan', 'sexyFucci') && F.wornSkin('ryan') === null, 'but only Rocco can wear it');
check(applySkin(kearns, 'kearns', 'sexyFucci') === kearns, 'on anyone else it does nothing');
check(!F.buySkin('sexyFucci').ok && !F.buySkin('opal').ok, 'neither is for sale');
check(!F.ownsSkin('opal', 'ryan') && !F.wearSkin('ryan', 'opal'), 'no Opal before the kills');
const unlockedSkins = [];
F.onSkinUnlock = (s, ch) => unlockedSkins.push(s.id + ':' + ch);
F.playingAs = 'ryan';
F.add('kills', OP.unlock.need - 1);
check(!F.ownsSkin('opal', 'ryan'), `${OP.unlock.need - 1} kills as Ryan: not yet`);
F.add('kills', 1);
check(F.ownsSkin('opal', 'ryan') && !F.ownsSkin('opal', 'kearns') && unlockedSkins.join() === 'opal:ryan', `${OP.unlock.need} kills as Ryan: Ryan's Opal (and only his), with a pop-up`);
const PC = new Career({}, { fetchFn: null, storage: store() });
await PC.signIn('PHAT CHOPS');
check(['kearns', 'ryan', 'pit', 'chops', 'james'].every((ch) => PC.ownsSkin('opal', ch)) && PC.wearSkin('pit', 'opal'), 'PHAT CHOPS has the Opal on every character');
// per-character kills sync like the rest
const K = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: store() });
await K.signIn('Killer'); K.playingAs = 'pit'; K.add('kills', 40); await settle(K);
check(db.killer.shop.kills.pit === 40, 'kills as each character go up to the database');
const op = applySkin(kearns, 'kearns', 'opal');
check(op.skinFx === 'opal' && op.armSkin && applySkin(kearns, 'rocco', 'sexyFucci').skinFx === 'bikini', 'the special skins carry their finish');

// --- the Stew Store blade's Featured today ---
const { featuredItems, dayNumber, untilTomorrow } = await import('../src/ui/storeBlade.js');
const crew = ['kearns', 'ryan', 'rocco', 'pit', 'james', 'kyle'].map((id) => ({ id, name: id }));
const today = featuredItems(dayNumber(new Date(2026, 9, 16, 12)), crew, null);
check(today.length === S.featured && today.filter((x) => x.kind === 'emote').length === 1, `Featured today: ${S.featured} items, one an emote`);
check(today.filter((x) => x.kind === 'skin').every((x) => SKIN_BY_ID[x.id] && !SKIN_BY_ID[x.id].unlock && !SKIN_BY_ID[x.id].vault && (!SKIN_BY_ID[x.id].only || SKIN_BY_ID[x.id].only === x.char)), 'only skins that are for sale, on someone who can wear them');
check(new Set(today.filter((x) => x.kind === 'skin').map((x) => x.char)).size === S.featured - 1, 'each on a different character');
check(JSON.stringify(featuredItems(dayNumber(new Date(2026, 9, 16, 1)), crew, null)) === JSON.stringify(today), 'the same all day');
const days = new Set(); for (let d = 0; d < 7; d++) days.add(JSON.stringify(featuredItems(dayNumber(new Date(2026, 9, 16 + d, 12)), crew, null)));
check(days.size >= 6, `a new set most days (${days.size} different in a week)`);
check(featuredItems(1, [{ id: 'kearns', name: 'Kearns' }], null).every((x) => x.char === 'kearns'), 'with only Kearns unlocked: all for Kearns');
check(untilTomorrow(new Date(2026, 9, 16, 22, 30)) === '1h 30m', 'new items in 1h 30m (at 10:30 pm)');
