// Idle acts: stand completely still for a few seconds and your character does
// their thing (James twerks, Kyle crosses his arms). Moving, firing, menus and
// cutscenes stop it; online, everyone else sees it. James and Kyle are playable.
// Run: node tests/idle_headless.mjs
import { GameSim } from '../src/sim/sim.js';
import { SCHOOL } from '../src/map/school.js';
import { emptyCommand } from '../src/sim/player.js';
import { CONFIG } from '../src/config.js';
import { NetHost } from '../src/net/host.js';
import { NetClient } from '../src/net/client.js';
import { LoopbackHub } from '../src/net/transport.js';
import { OnlineSession, LAUNCH } from '../src/net/online.js';
import { playerState } from '../src/net/state.js';
import { CREW } from '../src/lore/crew.js';
import { EMOTES, EMOTE_BY_ID } from '../src/career/emotes.js';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dt = 1 / 60;
const AFTER = CONFIG.player.idleAfter;

function game(character = 'james') {
  const sim = new GameSim({ map: SCHOOL, seed: 5 });
  const me = sim.addPlayer('p1', 'Tester', { character });
  sim.rounds.timer = 1e9;
  const step = (patch = {}, n = 1) => {
    for (let i = 0; i < n; i++) { sim.setInput('p1', { ...emptyCommand(), yaw: me.yaw, pitch: me.pitch, ...patch }); sim.step(dt); sim.drainEvents(); }
  };
  step({}, 30);   // (settle onto the floor)
  return { sim, me, step };
}

check(AFTER > 2 && AFTER < 4, `idle after about 3 s (${AFTER})`);

{
  const g = game();
  g.step({}, Math.round((AFTER - 0.6) * 60));
  check(!g.me.idle, 'not yet idle a moment before');
  g.step({}, 60);
  check(g.me.idle, 'standing completely still: idle');
  g.step({ yaw: g.me.yaw + 0.4, pitch: 0.2 }, 30);
  check(g.me.idle, 'looking around doesn\'t stop it');
  g.step({ moveY: 1 }, 1);
  check(!g.me.idle && g.me.idleT === 0, 'moving stops it at once');
  g.step({}, Math.round(AFTER * 60) + 5);
  check(g.me.idle, 'idle again after standing still again');
  g.step({ fire: true, firePressed: true }, 1);
  check(!g.me.idle, 'firing stops it');
  g.step({}, Math.round(AFTER * 60) + 5);
  g.step({ ads: true }, 1);
  check(!g.me.idle, 'aiming stops it');
  g.step({}, Math.round(AFTER * 60) + 5);
  g.step({ reloadPressed: true }, 1);
  check(!g.me.idle, 'reloading stops it');
  g.step({ away: true }, Math.round(AFTER * 60) * 2);
  check(!g.me.idle, 'never while you\'re in a menu or a cutscene');
  g.step({ crouch: true }, Math.round(AFTER * 60) * 2);
  check(!g.me.idle, 'not while crouched or prone');
}

// emotes from the wheel
{
  const g = game('kyle');
  g.step({ emote: 'jimmyShimmy' }, 1);
  check(g.me.emote === 'jimmyShimmy' && g.me.emoteYaw === g.me.yaw, 'an emote starts (anyone can do the Jimmy Shimmy)');
  g.step({ yaw: g.me.yaw + 1 }, 60);
  check(g.me.emote === 'jimmyShimmy' && !g.me.idle, 'it keeps going while you look around (and no idle act on top)');
  g.step({ moveX: 1 }, 1);
  check(g.me.emote === null, 'moving ends it');
  g.step({ emote: 'floss' }, 1); g.step({ fire: true, firePressed: true }, 1);
  check(g.me.emote === null, 'firing ends it');
  g.step({}, 10); g.step({ emote: 'floss' }, 1);
  g.step({}, Math.round((CONFIG.player.emote.maxTime + 0.5) * 60));
  check(g.me.emote === null, `it runs out after ${CONFIG.player.emote.maxTime} s`);
  g.step({ emote: 'floss', moveY: 1 }, 1);
  check(g.me.emote === null, 'not while you\'re moving');
  g.step({ emote: 'x'.repeat(40) }, 1);
  check(g.me.emote === null, 'a junk emote id is ignored');
}
check(EMOTES.length >= 5 && EMOTE_BY_ID.jimmyShimmy && EMOTE_BY_ID.jimmyShimmy.name === 'Jimmy Shimmy' && EMOTE_BY_ID.jimmyShimmy.beat, 'five or more emotes, the Jimmy Shimmy (with the beat) among them');
check(EMOTES.some((e) => e.free), 'some emotes are free');

// state that goes online: the flag, not the timer
{
  const g = game('kyle');
  g.step({}, Math.round(AFTER * 60) + 5);
  const s = playerState(g.me);
  check(s.idle === true && !('idleT' in s), 'the snapshot carries idle (not its timer)');
}

// online: a friend stands still, the host and the other friend both see it
{
  const hub = new LoopbackHub({ latency: 4, jitter: 2 });
  const ROSTER = [['h', 'Host', 'kearns'], ['a', 'Ann', 'james'], ['b', 'Bo', 'kyle']];
  const mk = () => { const s = new GameSim({ map: SCHOOL, seed: 9 }); for (const [id, n, c] of ROSTER) s.addPlayer(id, n, { character: c }); s.rounds.timer = 1e9; return s; };
  const hostSim = mk();
  const H = hub.endpoint('H');
  const host = new NetHost(hostSim, (to, m) => H.send(to, m));
  H.onMessage = (from, m) => host.onMessage(from, m);
  const C = {};
  for (const [peer, id] of [['A', 'a'], ['B', 'b']]) {
    const ep = hub.endpoint(peer);
    const sim = mk();
    const c = new NetClient(sim, id, (m) => ep.send('H', m));
    ep.onMessage = (from, m) => c.onMessage(m);
    hub.connect('H', peer);
    host.addRemote(peer, id);
    C[id] = { sim, c, cmd: { ...emptyCommand(), yaw: sim.playerById(id).yaw } };
  }
  const step = (n, patch = {}) => {
    for (let i = 0; i < n; i++) {
      hub.tick(); host.preStep();
      hostSim.setInput('h', { ...emptyCommand(), yaw: hostSim.playerById('h').yaw, moveX: (i % 2) ? 0.3 : -0.3 });
      hostSim.step(dt); host.postStep(hostSim.drainEvents());
      for (const id in C) C[id].c.tick({ ...C[id].cmd, ...(patch[id] || {}) }, dt);
    }
  };
  step(Math.round(AFTER * 60) + 60, { b: { moveY: 0.5 } });
  check(C.a.sim.playerById('a').idle, 'Ann (James) stood still: idle on her screen');
  check(hostSim.playerById('a').idle, '...the host sees it');
  check(C.b.sim.playerById('a').idle, '...and so does Bo');
  check(!C.a.sim.playerById('b').idle && !hostSim.playerById('b').idle, 'Bo kept walking: not idle anywhere');
  check(!C.a.sim.playerById('h').idle, 'the host is moving: not idle');
  step(30, { a: { fire: true, firePressed: true } });
  check(!hostSim.playerById('a').idle && !C.b.sim.playerById('a').idle, 'Ann fires: it stops for everyone');
  step(1, { b: { emote: 'jimmyShimmy' } });
  step(30);
  check(hostSim.playerById('b').emote === 'jimmyShimmy' && C.a.sim.playerById('b').emote === 'jimmyShimmy', 'Bo emotes: the host and Ann see it');
  check(Math.abs(C.a.sim.playerById('b').emoteYaw - C.b.sim.playerById('b').emoteYaw) < 1e-6, '...facing the way he started it');
  step(20, { b: { moveY: 1 } });
  check(!hostSim.playerById('b').emote && !C.a.sim.playerById('b').emote, 'Bo walks off: it ends for everyone');
}

// the crew list and the online lobby
check(CREW.james && CREW.kyle, 'James and Kyle have crew entries (names, voices)');
check(LAUNCH.includes('james') && LAUNCH.includes('kyle'), 'James and Kyle can be picked online');
{
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const host = new OnlineSession({ name: 'Host', character: 'james', brian: false, local: true });
  const code = await host.host();
  const friend = new OnlineSession({ name: 'Friend', character: 'kyle', brian: false, local: true });
  await friend.join(code);
  await wait(150);
  const fr = host.members.find((m) => m.id !== 'p1');
  check(host.members[0].character === 'james' && fr && fr.character === 'kyle', 'a lobby with James and Kyle');
  friend.pick('james'); await wait(150);
  check(fr.character === 'kyle', 'one James per lobby');
  host.close && host.close(); friend.close && friend.close();
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
