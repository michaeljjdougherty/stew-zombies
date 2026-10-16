// Lobby: Brian becomes pickable the moment someone in the lobby finishes The
// Final Whistle (host or friend), without leaving the session.
// Run: node tests/lobby_headless.mjs
import { OnlineSession } from '../src/net/online.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const host = new OnlineSession({ name: 'Host', character: 'kearns', brian: false, local: true });
const code = await host.host();
const friend = new OnlineSession({ name: 'Friend', character: 'ryan', brian: false, local: true });
let friendLobby = null;
friend.o.onLobby = (l) => { friendLobby = l; };
await friend.join(code);
await wait(150);
const fr = () => host.members.find((m) => m.id !== 'p1');
ok(host.members.length === 2 && !fr().brian, 'friend joined without Brian');
friend.pick('brian'); await wait(150);
ok(fr().character !== 'brian', 'locked Brian refused');

friend.unlockBrian(); await wait(150);
ok(fr().brian === true, 'friend unlocking Brian reaches the host');
ok(friendLobby && friendLobby.members.find((m) => m.id === friendLobby.you).brian, 'friend\'s lobby shows Brian unlocked');
friend.pick('brian'); await wait(150);
ok(fr().character === 'brian', 'friend can now pick Brian');

host.unlockBrian(); await wait(50);
ok(host.members[0].brian, 'host unlock updates their own slot');
host.pick('brian'); await wait(50);
ok(host.members[0].character !== 'brian', 'one Brian per lobby');
friend.pick('pit'); await wait(150);
host.pick('brian'); await wait(50);
ok(host.members[0].character === 'brian', 'host picks Brian once he is free');

// the intro cutscene: on by default; the host can switch it off; the start says so
ok(host.intro === true && friendLobby.intro !== false, 'the intro cutscene plays online by default');
host.setIntro(false); await wait(150);
ok(friendLobby.intro === false, 'the host switches it off: the friend\'s lobby says so');
// and each player's GobbleGum pack goes with them
ok(fr().gums === null || typeof fr().gums === 'object', 'a friend with no pack: fine');
let fs = null, hs = null;
friend.o.onStart = (m) => { fs = m; }; host.o.onStart = (m) => { hs = m; };
host.start(7); await wait(200);
ok(fs && fs.intro === false && hs && hs.intro === false, 'the start carries it (no intro this time)');
host.backToLobby && host.backToLobby(); await wait(100);
host.setIntro(true); await wait(150);
fs = null; host.start(8); await wait(200);
ok(fs && fs.intro === true, 'switched back on: the next start plays it');

friend.leave(); host.leave();
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
