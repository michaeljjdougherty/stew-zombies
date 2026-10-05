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

friend.leave(); host.leave();
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
