// Gun skins: the catalogue, buying them with Stew Bucks, the Battle Pass's,
// putting one on a gun (only the guns it fits), the Arsenal's guns, and all of
// it saved online.
import { Career } from '../src/career/career.js';
import { GUN_SKINS, GUN_SKIN_BY_ID, gunSkinPrice, gunSkinFits, gunSkinsFor, arsenalGuns, SHOWCASE_GUN } from '../src/career/gunSkins.js';
import { passTiers } from '../src/career/battlepass.js';
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

// --- the catalogue ---
const W = CONFIG.weapons;
check(GUN_SKINS.length >= 20 && new Set(GUN_SKINS.map((s) => s.id)).size === GUN_SKINS.length, `${GUN_SKINS.length} gun skins, all different`);
check(GUN_SKINS.every((s) => CONFIG.shop.rarities[s.rarity] && s.name && s.blurb && s.look && s.look.kind && s.look.colors.length >= 2), 'each has a rarity, a name, a blurb and a pattern');
check(['gold', 'diamond', 'darkMatter'].every((id) => GUN_SKIN_BY_ID[id]), 'Gold, Diamond and Dark Matter are in');
const one = GUN_SKINS.filter((s) => s.only);
check(one.length >= 5 && one.every((s) => W[s.only] && !W[s.only].upgraded), `${one.length} are made for one gun, each a real one`);
check(gunSkinFits('gold', 'M1912') && gunSkinFits('pinkEagle', 'Desert Eagle') && !gunSkinFits('pinkEagle', 'M1912'), 'one made for a gun fits only that gun; the rest fit any');
check(W[SHOWCASE_GUN] && W[SHOWCASE_GUN].view.model === 'scarh', 'the store shows them on the SCAR-H');

// --- the Arsenal's guns ---
const A = arsenalGuns(), ids = A.map((g) => g.id);
check(!A.some((g) => W[g.id].wonder && g.id !== 'M2 Flamethrower'), 'no wonder weapons in the Arsenal');
check(A.find((g) => g.id === 'M2 Flamethrower').cls === 'special' && A.find((g) => g.id === 'Kross-Bow').cls === 'special', 'the M2 Flamethrower is a Special, with the Kross-Bow');
check(!ids.some((id) => id.endsWith('+')) && !ids.includes('Death Machine') && ids.includes('SCAR-H') && ids.includes('M1912'), 'no Pack-a-Punched copies or power-ups; the real guns are all there');
check(one.every((s) => ids.includes(s.only)), 'every gun a skin is made for is in the Arsenal');
check(gunSkinsFor('Dragunoff').some((s) => s.id === 'ghillie') && !gunSkinsFor('SCAR-H').some((s) => s.id === 'ghillie'), 'each gun lists the skins that fit it');

// --- buying and wearing ---
const L = new Career({}, { fetchFn: null, storage: store() });
await L.signIn('Gunner');
check(!L.ownsGunSkin('woodland') && L.gunSkin('M1912') === null, 'a new career: no gun skins');
check(L.buyGunSkin('gold').code === 'broke', 'can\'t buy what you can\'t afford');
L.addBucks(gunSkinPrice('gold') + gunSkinPrice('pinkEagle'));
check(L.buyGunSkin('gold').ok && L.ownsGunSkin('gold') && L.buyGunSkin('gold').code === 'owned', `bought Gold for ${gunSkinPrice('gold')}, once`);
check(L.wearGunSkin('SCAR-H', 'gold') && L.wearGunSkin('M1912', 'gold') && L.gunSkin('SCAR-H') === 'gold' && L.gunSkin('M1912') === 'gold', 'one gun skin goes on as many guns as you like');
check(L.buyGunSkin('pinkEagle').ok && !L.wearGunSkin('M1912', 'pinkEagle') && L.wearGunSkin('Desert Eagle', 'pinkEagle'), 'one made for the Desert Eagle only goes on the Desert Eagle');
check(!L.wearGunSkin('M15', 'darkMatter') && L.gunSkin('M15') === null, 'can\'t put on one you don\'t own');
L.wearGunSkin('M1912', null);
check(L.gunSkin('M1912') === null && L.gunSkin('SCAR-H') === 'gold', 'back to its own finish (the SCAR keeps Gold)');
check(L.buyGunSkin('neonGrid').code === 'unlock', 'the Battle Pass\'s aren\'t for sale');
const guest = new Career({}, { fetchFn: null, storage: store() });
check(guest.buyGunSkin('woodland').code === 'guest' && !guest.wearGunSkin('M1912', 'woodland'), 'a guest can\'t buy or wear one');

// --- the Battle Pass ---
const T = passTiers().filter((t) => t.kind === 'gunSkin');
check(T.length === 3 && T.every((t) => !t.item.only), `${T.length} gun skins in the Battle Pass, every gun`);
check(!L.ownsGunSkin('neonGrid'), 'not before its tier');
L.addPassXp(CONFIG.shop.pass.xpPerTier * T[0].tier);
check(L.ownsGunSkin(T[0].id) && L.wearGunSkin('MP41', T[0].id), `tier ${T[0].tier}: ${T[0].item.name}, on any gun`);

// --- saved online, and PHAT CHOPS ---
const B1 = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: store() });
await B1.signIn('Collector'); B1.addBucks(5000); B1.buyGunSkin('damascus'); B1.wearGunSkin('HK22', 'damascus'); await settle(B1);
check(db.collector.shop.guns.damascus && db.collector.shop.gunWear.HK22 === 'damascus', 'gun skins and what each gun wears go up to the database');
const B2 = new Career({ firebaseUrl: 'https://x.firebaseio.com' }, { fetchFn: fakeFetch, storage: store() });
await B2.signIn('collector');
check(B2.ownsGunSkin('damascus') && B2.gunSkin('HK22') === 'damascus', 'another computer: the same');
B2.wearGunSkin('HK22', null); await settle(B2);
check(!db.collector.shop.gunWear || !db.collector.shop.gunWear.HK22, 'taking it off goes up too');
const PC = new Career({}, { fetchFn: null, storage: store() });
await PC.signIn('PHAT CHOPS');
check(GUN_SKINS.every((s) => PC.ownsGunSkin(s.id, s.only || 'SCAR-H')) && PC.wearGunSkin('M2 Flamethrower', 'dragonScale'), 'PHAT CHOPS has every gun skin');

// --- online: your friends see the skin on the gun you're holding ---
const { OnlineSession, PROTOCOL } = await import('../src/net/online.js');
const OS = new OnlineSession({ name: 'Host', character: 'kearns', gunSkins: { 'SCAR-H': 'varsityScar', 'Desert Eagle': 'gold', MP41: 'pinkEagle', Nope: 'gold' } });
OS.role = 'host'; OS.you = 'p1'; OS.ep = { send() {} };
OS.members = [{ id: 'p1', peer: null, name: 'Host', character: 'kearns', skin: null, brian: false, gums: null }];
OS.setGunSkins({ 'SCAR-H': 'varsityScar', 'Desert Eagle': 'gold', MP41: 'pinkEagle', Nope: 'gold' });
check(JSON.stringify(OS.lobby().members[0].gunSkins) === JSON.stringify({ 'SCAR-H': 'varsityScar', 'Desert Eagle': 'gold' }), 'the host\'s gun skins are in the lobby (only real guns, skins that fit them)');
OS.hostMessage('peer2', { t: 'hello', v: PROTOCOL, name: 'Friend', character: 'ryan', gunSkins: { 'AK-75u': 'carbon', 'SCAR-H': 'pinkEagle' } });
const fr = OS.lobby().members.find((m) => m.id === 'p2');
check(fr && fr.gunSkins && fr.gunSkins['AK-75u'] === 'carbon' && !fr.gunSkins['SCAR-H'], 'a friend\'s gun skins come with their hello, checked the same way');
OS.hostMessage('peer2', { t: 'gunSkins', gunSkins: { 'SCAR-H': 'molten' } });
check(OS.lobby().members.find((m) => m.id === 'p2').gunSkins['SCAR-H'] === 'molten', 'changing one in the lobby reaches the host');
const { GameSim } = await import('../src/sim/sim.js');
const { SCHOOL } = await import('../src/map/school.js');
const GS = new GameSim({ map: SCHOOL, cfg: CONFIG, teamName: 'Stew', mode: 'zombies', seed: 1 });
const gp = GS.addPlayer('p2', 'Friend', { character: 'ryan', gunSkins: { 'SCAR-H': 'molten' } });
check(gp.gunSkins && gp.gunSkins['SCAR-H'] === 'molten', 'the game keeps each player\'s gun skins (for drawing their gun)');
