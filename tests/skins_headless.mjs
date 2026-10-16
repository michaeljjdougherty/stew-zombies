// The Stew Store's skins: every playable character has their own (and only they
// can wear them), everyone has the team kit with their own number, Sexy Fucci is
// Rocco's alone, and the skin you pick goes with you online (the lobby, the game,
// and everyone else's copy of you).
// Run: node tests/skins_headless.mjs
import { OnlineSession } from '../src/net/online.js';
import { SKINS, SKIN_BY_ID, fits, skinsFor, applySkin, TEAM_NUMBERS } from '../src/career/skins.js';
import { Career } from '../src/career/career.js';
import { CHARACTERS } from '../src/render/characters.js';
import { GEAR_KINDS } from '../src/render/costumes.js';
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { CONFIG } from '../src/config.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const store = () => { const mem = {}; return { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } }; };

// --- the catalogue ---
const crew = ['kearns', 'ryan', 'rocco', 'pit', 'james', 'kyle', 'brian', 'zach'];
for (const ch of crew) {
  const own = SKINS.filter((s) => s.only === ch);
  ok(own.length >= 3 || (ch === 'rocco' && own.length >= 2), `${CHARACTERS[ch].name} has their own skins (${own.map((s) => s.name).join(', ')})`);
}
ok(new Set(SKINS.map((s) => s.id)).size === SKINS.length, 'every skin id is different');
ok(SKINS.every((s) => !s.only || CHARACTERS[s.only]), 'every character-only skin names a real character');
ok(SKINS.every((s) => (s.look.gear || []).every((g) => GEAR_KINDS.includes(g.kind))), 'every piece of costume gear exists');
ok(!fits('fireChief', 'kearns') && fits('fireChief', 'ryan') && applySkin(CHARACTERS.kearns, 'kearns', 'fireChief') === CHARACTERS.kearns, 'Ryan\'s Fire Chief won\'t go on Kearns');
ok(fits('sexyFucci', 'rocco') && !fits('sexyFucci', 'ryan'), 'Sexy Fucci is Rocco\'s alone');
ok(crew.every((ch) => fits('jersey', ch) && fits('opal', ch)), 'the team kit and the Opal fit everyone');
const team = applySkin(CHARACTERS.kearns, 'kearns', 'jersey');
ok(team.top.number === TEAM_NUMBERS.kearns && team.shorts && applySkin(CHARACTERS.ryan, 'ryan', 'jersey').top.number === TEAM_NUMBERS.ryan, 'the team kit: jersey and shorts, with their own number');
ok(!Object.values(TEAM_NUMBERS).includes('8'), 'nobody wears Erik\'s 8');
ok(applySkin(CHARACTERS.ryan, 'ryan', 'madDog').chain === undefined && CHARACTERS.ryan.chain, 'a costume takes their chain off (and leaves the real one alone)');
ok(skinsFor('kearns').every((s) => !s.only || s.only === 'kearns'), 'the store only shows a character what fits them');
ok(SKINS.filter((s) => s.vault).every((s) => fits(s.id, 'kearns')), 'the old shop\'s outfits still fit whoever bought them');

// --- wearing: per character ---
const C = new Career({}, { fetchFn: null, storage: store() });
await C.signIn('Tester');
C.addBucks(5000);
ok(C.buySkin('fireChief').ok && !C.wearSkin('kearns', 'fireChief') && C.wearSkin('ryan', 'fireChief') && C.wornSkin('ryan') === 'fireChief', 'bought for Ryan, worn by Ryan, not Kearns');

// --- online: the lobby carries it ---
const host = new OnlineSession({ name: 'Host', character: 'ryan', skin: 'fireChief', local: true });
const code = await host.host();
ok(host.members[0].skin === 'fireChief', 'the host comes in wearing their skin');
const friend = new OnlineSession({ name: 'Friend', character: 'rocco', skin: 'sexyFucci', local: true });
let fl = null; friend.o.onLobby = (l) => { fl = l; };
await friend.join(code); await wait(150);
const fr = () => host.members.find((m) => m.id !== 'p1');
ok(fr().skin === 'sexyFucci' && fl.members.find((m) => m.id === 'p1').skin === 'fireChief', 'a friend\'s skin reaches the host, and the host\'s reaches the friend');
friend.pick('kearns', 'sexyFucci'); await wait(150);
ok(fr().character === 'kearns' && fr().skin === null, 'switching to Kearns: the Fucci doesn\'t come with him');
friend.setSkin('carrotFarmer'); await wait(150);
ok(fr().skin === 'carrotFarmer', 'picking a skin in the lobby');
friend.setSkin('fireChief'); await wait(150);
ok(fr().skin === null, 'someone else\'s skin is refused');
friend.setSkin('nonsense'); await wait(150);
ok(fr().skin === null, 'a made-up skin is refused');
friend.setSkin('jersey'); await wait(150);
let st = null; friend.o.onStart = (m) => { st = m; };
host.start(3); await wait(200);
ok(st && st.members.find((m) => m.id === fr().id).skin === 'jersey', 'the start carries everyone\'s skin');

// --- the game: each player has their skin ---
const sim = new GameSim({ map: SCHOOL, cfg: CONFIG, teamName: 'Stew', mode: 'zombies', seed: 3 });
for (const m of st.members) sim.addPlayer(m.id, m.name, { character: m.character, skin: m.skin });
ok(sim.players.map((p) => p.skin).join() === 'fireChief,jersey', 'each player in the game wears their skin');
friend.leave(); host.leave();

console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
