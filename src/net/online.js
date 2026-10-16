// =============================================================================
// An online session: the lobby (room code, who's in, who plays whom) and the
// pipe the game runs over once it starts.
//
//   host:   const s = new OnlineSession(opts); const code = await s.host();
//   friend: await s.join('K4T9');
//   lobby:  s.pick('ryan'); host: s.start();
//
// Up to four players, one character each. Player ids: the host is p1, friends
// get p2..p4 in the order they join.
// =============================================================================
import { hostPeer, joinPeer, localHost, localJoin } from './peer.js';
import { CONFIG } from '../config.js';
import { fits } from '../career/skins.js';

export const PROTOCOL = 2;   // (2: the lobby picks the map)
export const MAX_PLAYERS = 4;
export const LAUNCH = ['kearns', 'ryan', 'pit', 'rocco', 'james', 'kyle'];
const CODE_CHARS = 'BCDFGHJKMNPQRSTVWXZ23456789';

export function makeCode(rand = Math.random) {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return s;
}
export const mapInfo = (id) => CONFIG.onlineMaps.find((m) => m.id === id) || CONFIG.onlineMaps[0];
export const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

// A player's GobbleGum pack, as sent (src/career/career.js packForGame): only
// real gum ids, 5 at most, and whole numbers of Megas.
function cleanGums(g) {
  if (!g || !Array.isArray(g.pack)) return null;
  const G = CONFIG.gobblegum.gums;
  const pack = g.pack.filter((id) => typeof id === 'string' && G[id]).slice(0, CONFIG.gobblegum.packSize);
  const stock = {};
  for (const id of pack) { const n = Math.floor(Number(g.stock && g.stock[id]) || 0); if (n > 0) stock[id] = Math.min(n, 9999); }
  return { pack, stock };
}
// The skin they're wearing (src/career/skins.js): a real one that fits who they play, or none
const cleanSkin = (skin, ch) => (typeof skin === 'string' && skin.length <= 24 && fits(skin, ch) ? skin : null);

export class OnlineSession {
  // opts: { name, character, skin, brian (unlocked?), local (BroadcastChannel test mode),
  //         onLobby(lobby), onStart(start), onGame(from, msg), onPeerLeft(id), onEnd(reason) }
  constructor(opts) {
    this.o = opts;
    this.role = null;          // 'host' | 'friend'
    this.ep = null;
    this.code = null;
    this.members = [];         // [{ id, peer, name, character, skin, brian }]
    this.you = null;
    this.inGame = false;
    this.ended = false;
    this.map = CONFIG.onlineMaps[0].id;   // the map the host's picked
    this.intro = true;          // play the map's intro cutscene first (the host's call)
  }

  get isHost() { return this.role === 'host'; }

  // --- hosting ---------------------------------------------------------------
  async host() {
    this.role = 'host';
    for (let tries = 0; ; tries++) {
      this.code = makeCode();
      try {
        this.ep = this.o.local ? localHost(this.code) : await hostPeer(this.code);
        break;
      } catch (e) {
        if (e.type === 'unavailable-id' && tries < 4) continue;   // someone has that code: roll again
        throw e;
      }
    }
    this.you = 'p1';
    this.members = [{ id: 'p1', peer: null, name: this.o.name, character: this.o.character, skin: cleanSkin(this.o.skin, this.o.character), brian: !!this.o.brian, gums: cleanGums(this.o.gums) }];
    this.ep.onOpen = () => {};
    this.ep.onMessage = (from, m) => this.hostMessage(from, m);
    this.ep.onClose = (peer) => this.hostLost(peer);
    this.ep.onError = () => {};
    this.lobbyChanged();
    return this.code;
  }

  hostMessage(from, m) {
    if (m.t === 'hello') {
      if (m.v !== PROTOCOL) return this.refuse(from, 'Your copy of the game is a different version. Reload the page.');
      if (this.inGame) return this.refuse(from, 'That game has already started.');
      if (this.members.length >= MAX_PLAYERS) return this.refuse(from, 'That game is full (4 players).');
      if (this.members.some((x) => x.peer === from)) return;
      const ids = ['p2', 'p3', 'p4'];
      const id = ids.find((i) => !this.members.some((x) => x.id === i));
      const member = { id, peer: from, name: String(m.name || 'Friend').slice(0, 16), character: null, brian: !!m.brian, gums: cleanGums(m.gums) };
      member.character = this.freeCharacter(m.character, member);
      member.skin = cleanSkin(m.skin, member.character);
      this.members.push(member);
      this.lobbyChanged();
      return;
    }
    const member = this.members.find((x) => x.peer === from);
    if (!member) return;
    if (m.t === 'brian') {   // they just finished The Final Whistle
      if (!member.brian) { member.brian = true; this.lobbyChanged(); }
      return;
    }
    if (m.t === 'pick') {
      if (!this.inGame && this.canPlay(m.character, member)) { member.character = m.character; member.skin = cleanSkin(m.skin, m.character); this.lobbyChanged(); }
      return;
    }
    if (m.t === 'skin') {   // a different skin on the same character
      const skin = cleanSkin(m.skin, member.character);
      if (!this.inGame && skin !== member.skin) { member.skin = skin; this.lobbyChanged(); }
      return;
    }
    if (this.inGame && this.o.onGame) this.o.onGame(from, m);
  }

  refuse(peer, why) {
    this.ep.send(peer, { t: 'nope', why });
    setTimeout(() => this.ep.drop && this.ep.drop(peer), 500);
  }

  hostLost(peer) {
    const i = this.members.findIndex((x) => x.peer === peer);
    if (i < 0) return;
    const [m] = this.members.splice(i, 1);
    if (this.inGame) { if (this.o.onPeerLeft) this.o.onPeerLeft(m); }
    else this.lobbyChanged();
  }

  canPlay(ch, member) {
    if (!(LAUNCH.includes(ch) || (ch === 'brian' && member.brian))) return false;
    if (mapInfo(this.map).notPlayable?.includes(ch)) return false;   // (Pit, on the Crust)
    return !this.members.some((x) => x !== member && x.character === ch);
  }

  freeCharacter(want, member) {
    if (this.canPlay(want, member)) return want;
    return LAUNCH.find((c) => this.canPlay(c, member)) || (member.brian && this.canPlay('brian', member) ? 'brian' : null);
  }

  lobbyChanged() {
    const lobby = this.lobby();
    if (this.ep) for (const m of this.members) if (m.peer) this.ep.send(m.peer, { t: 'lobby', ...lobby, you: m.id });
    if (this.o.onLobby) this.o.onLobby({ ...lobby, you: this.you });
  }

  lobby() {
    return { code: this.code, map: this.map, intro: this.intro, members: this.members.map(({ id, name, character, skin, brian, gums }) => ({ id, name, character, skin: skin || null, brian, gums })) };
  }

  // the host: play the map's intro first, or not
  setIntro(on) {
    if (!this.isHost || this.inGame || this.intro === !!on) return;
    this.intro = !!on;
    this.lobbyChanged();
  }

  // the host picks the map (anyone now playing someone who isn't there gets moved)
  setMap(id) {
    if (!this.isHost || this.inGame || !CONFIG.onlineMaps.some((m) => m.id === id) || id === this.map) return;
    this.map = id;
    for (const m of this.members) if (m.character && !this.canPlay(m.character, m)) { m.character = null; m.character = this.freeCharacter(null, m); m.skin = cleanSkin(m.skin, m.character); }
    this.lobbyChanged();
  }

  // pick your character (in the skin you wear on them)
  pick(character, skin = null) {
    if (this.isHost) {
      const me = this.members[0];
      if (!this.inGame && this.canPlay(character, me)) { me.character = character; me.skin = cleanSkin(skin, character); this.lobbyChanged(); }
    } else if (this.ep) this.ep.send(this.ep.host, { t: 'pick', character, skin });
  }

  // pick your skin (on the character you've got)
  setSkin(skin) {
    if (this.isHost) {
      const me = this.members[0], s = me && cleanSkin(skin, me.character);
      if (me && !this.inGame && s !== me.skin) { me.skin = s; this.lobbyChanged(); }
    } else if (this.ep) this.ep.send(this.ep.host, { t: 'skin', skin });
  }

  // Brian just got unlocked on this browser (The Final Whistle is done): let
  // the lobby know, so he can be picked without leaving and coming back.
  unlockBrian() {
    this.o.brian = true;
    if (this.isHost) {
      const me = this.members[0];
      if (me && !me.brian) { me.brian = true; this.lobbyChanged(); }
    } else if (this.ep) this.ep.send(this.ep.host, { t: 'brian' });
  }

  start(seed = (Math.random() * 0xffffffff) >>> 0) {
    if (!this.isHost || this.inGame) return;
    this.inGame = true;
    const start = { t: 'start', seed, map: this.map, intro: this.intro, members: this.lobby().members };
    for (const m of this.members) if (m.peer) this.ep.send(m.peer, { ...start, you: m.id });
    if (this.o.onStart) this.o.onStart({ ...start, you: 'p1', peers: this.members.filter((m) => m.peer).map((m) => ({ peer: m.peer, id: m.id })) });
  }

  // back to the lobby after a game (host)
  backToLobby() {
    if (!this.isHost) return;
    this.inGame = false;
    for (const m of this.members) if (m.peer) this.ep.send(m.peer, { t: 'toLobby' });
    this.lobbyChanged();
  }

  // --- joining -------------------------------------------------------------
  async join(code) {
    this.role = 'friend';
    this.code = code;
    this.ep = this.o.local ? await localJoin(code) : await joinPeer(code);
    this.ep.onMessage = (from, m) => this.friendMessage(m);
    this.ep.onClose = () => this.end('The host left the game.');
    this.ep.onError = () => {};
    this.ep.send(this.ep.host, { t: 'hello', v: PROTOCOL, name: this.o.name, character: this.o.character, skin: this.o.skin || null, brian: !!this.o.brian, gums: cleanGums(this.o.gums) });
    // wait for the first lobby (or a no)
    await new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error('The host didn\'t answer.')), 12000);
      this.waitLobby = (err) => { clearTimeout(timer); this.waitLobby = null; if (err) rej(new Error(err)); else res(); };
    });
  }

  friendMessage(m) {
    switch (m.t) {
      case 'nope':
        if (this.waitLobby) this.waitLobby(m.why);
        this.end(m.why, true);
        return;
      case 'lobby':
        this.you = m.you;
        this.members = m.members;
        this.map = m.map || CONFIG.onlineMaps[0].id;
        this.intro = m.intro !== false;
        if (this.waitLobby) this.waitLobby();
        if (this.o.onLobby) this.o.onLobby({ code: this.code, map: this.map, intro: this.intro, members: m.members, you: m.you });
        return;
      case 'start':
        this.inGame = true;
        if (this.o.onStart) this.o.onStart(m);
        return;
      case 'toLobby':
        this.inGame = false;
        if (this.o.onToLobby) this.o.onToLobby();
        return;
      default:
        if (this.inGame && this.o.onGame) this.o.onGame('host', m);
    }
  }

  // --- the game's pipe ------------------------------------------------------------
  // host: to = a friend's peer id, or null for everyone. friend: always the host.
  send(to, msg) {
    if (!this.ep) return;
    if (this.isHost) this.ep.send(to, msg);
    else this.ep.send(this.ep.host, msg);
  }

  // host: kick a friend's connection (they dropped from the game)
  leave() { this.end(null, true); }

  end(reason, quiet = false) {
    if (this.ended) return;
    this.ended = true;
    if (this.ep) { try { this.ep.close(); } catch { /* already gone */ } }
    this.ep = null;
    if (!quiet || reason) { if (this.o.onEnd) this.o.onEnd(reason); }
  }
}
