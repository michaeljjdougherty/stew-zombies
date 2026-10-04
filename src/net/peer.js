// =============================================================================
// Browser connections.
//
// PeerJS (loaded from a CDN only when you go online) sets up WebRTC data
// channels between browsers. Its free public server only introduces the
// browsers to each other; the game itself goes straight between them.
// The host takes the peer id "stew-zombies-<CODE>", so friends can find it
// from the room code.
//
// For testing on one computer, `?net=local` swaps PeerJS for a
// BroadcastChannel between tabs of the same browser.
//
// Both give an endpoint: { id, send(to|null, msg), onMessage(from, msg),
// onOpen(peer), onClose(peer), close() }. Big messages are split in pieces.
// =============================================================================

const PEERJS_URLS = [
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
];
const PREFIX = 'stew-zombies-';
const CHUNK = 16000;
// public STUN servers find a direct route between home networks
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];

let peerjs = null;
function loadPeerJS() {
  if (peerjs) return peerjs;
  peerjs = (async () => {
    const have = () => window.Peer || (window.peerjs && window.peerjs.Peer);
    for (const url of PEERJS_URLS) {
      if (have()) break;
      await new Promise((res) => {
        const s = document.createElement('script');
        s.src = url; s.async = true;
        s.onload = res; s.onerror = res;
        document.head.appendChild(s);
      });
    }
    const P = have();
    if (!P) { peerjs = null; throw new Error('Couldn\'t load the online library. Check your internet connection.'); }
    return P;
  })();
  return peerjs;
}

// --- splitting and joining big messages -------------------------------------
function packer(rawSend) {
  let seq = 0;
  return (msg) => {
    const s = JSON.stringify(msg);
    if (s.length <= CHUNK) { rawSend(s); return; }
    const id = ++seq, n = Math.ceil(s.length / CHUNK);
    for (let i = 0; i < n; i++) rawSend(JSON.stringify({ t: '~', id, i, n, s: s.slice(i * CHUNK, (i + 1) * CHUNK) }));
  };
}
function unpacker(deliver) {
  const parts = new Map();
  return (raw) => {
    let m;
    try { m = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
    if (m && m.t === '~') {
      let p = parts.get(m.id);
      if (!p) { p = []; parts.set(m.id, p); }
      p[m.i] = m.s;
      if (p.filter((x) => x !== undefined).length === m.n) { parts.delete(m.id); deliver(JSON.parse(p.join(''))); }
      return;
    }
    deliver(m);
  };
}

function baseEndpoint(id) {
  return { id, onMessage: () => {}, onOpen: () => {}, onClose: () => {}, onError: () => {} };
}

const friendly = (err) => {
  const t = err && err.type;
  if (t === 'peer-unavailable') return 'No game with that code. Check it with whoever is hosting.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Couldn\'t reach the online server. Check your internet connection.';
  if (t === 'browser-incompatible') return 'This browser can\'t play online. Try Chrome, Edge, Firefox or Safari.';
  return (err && err.message) || 'Something went wrong with the connection.';
};

// --- PeerJS -------------------------------------------------------------------
function wrapConn(ep, conns, conn) {
  // ('open' can fire more than once for the same connection: wire it up once)
  if (conn._stewWired) return false;
  conn._stewWired = true;
  const send = packer((s) => { try { conn.send(s); } catch { /* closed */ } });
  const recv = unpacker((m) => ep.onMessage(conn.peer, m));
  conns.set(conn.peer, { conn, send });
  conn.on('data', recv);
  conn.on('close', () => { if (conns.delete(conn.peer)) ep.onClose(conn.peer); });
  conn.on('error', () => { if (conns.delete(conn.peer)) ep.onClose(conn.peer); });
  return true;
}

function peerEndpoint(peer, conns) {
  const ep = baseEndpoint(peer.id);
  ep.send = (to, msg) => {
    if (to == null) { for (const c of conns.values()) c.send(msg); return; }
    const c = conns.get(to); if (c) c.send(msg);
  };
  ep.drop = (to) => { const c = conns.get(to); if (c) { conns.delete(to); c.conn.close(); } };
  ep.close = () => { for (const c of conns.values()) c.conn.close(); conns.clear(); peer.destroy(); };
  peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* gone */ } });
  return ep;
}

// Host: take the room code's id and wait for friends.
export async function hostPeer(code) {
  const Peer = await loadPeerJS();
  const peer = new Peer(PREFIX + code, { config: { iceServers: ICE }, debug: 0 });
  const conns = new Map();
  await new Promise((res, rej) => {
    peer.on('open', res);
    peer.on('error', (e) => rej(Object.assign(new Error(friendly(e)), { type: e.type })));
  });
  const ep = peerEndpoint(peer, conns);
  peer.on('connection', (conn) => {
    conn.on('open', () => { if (wrapConn(ep, conns, conn)) ep.onOpen(conn.peer); });
  });
  peer.on('error', (e) => ep.onError(friendly(e)));
  return ep;
}

// Friend: connect to the host's code.
export async function joinPeer(code) {
  const Peer = await loadPeerJS();
  const peer = new Peer({ config: { iceServers: ICE }, debug: 0 });
  const conns = new Map();
  await new Promise((res, rej) => {
    peer.on('open', res);
    peer.on('error', (e) => rej(new Error(friendly(e))));
  });
  const ep = peerEndpoint(peer, conns);
  await new Promise((res, rej) => {
    const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'raw' });
    const timer = setTimeout(() => rej(new Error('The host didn\'t answer. Check the code, or ask them to host again.')), 15000);
    peer.on('error', (e) => { clearTimeout(timer); rej(new Error(friendly(e))); });
    conn.on('open', () => { clearTimeout(timer); wrapConn(ep, conns, conn); res(); });
  });
  ep.host = PREFIX + code;
  peer.on('error', (e) => ep.onError(friendly(e)));
  return ep;
}

// --- one computer, several tabs (testing) -------------------------------------
export function localHost(code) { return localEndpoint(code, 'host'); }
export async function localJoin(code) {
  const ep = localEndpoint(code, 'p' + Math.random().toString(36).slice(2, 8));
  ep.host = 'host';
  ep.hello();
  return ep;
}
function localEndpoint(code, id) {
  const bc = new BroadcastChannel(PREFIX + code);
  const ep = baseEndpoint(id);
  const known = new Set();
  const recv = new Map();
  const post = (to, msg) => packer((s) => bc.postMessage({ from: id, to, s }))(msg);
  ep.send = (to, msg) => { if (to == null) for (const k of known) post(k, msg); else post(to, msg); };
  ep.hello = () => { bc.postMessage({ from: id, to: 'host', hello: true }); };
  ep.drop = (to) => { known.delete(to); bc.postMessage({ from: id, to, bye: true }); };
  ep.close = () => { for (const k of known) bc.postMessage({ from: id, to: k, bye: true }); known.clear(); bc.close(); };
  bc.onmessage = (ev) => {
    const d = ev.data;
    if (d.to !== id) return;
    if (d.bye) { if (known.delete(d.from)) ep.onClose(d.from); return; }
    if (!known.has(d.from)) {
      known.add(d.from);
      if (d.hello) bc.postMessage({ from: id, to: d.from, hello: true });
      ep.onOpen(d.from);
      if (d.hello) return;
    }
    if (d.hello) return;
    let u = recv.get(d.from);
    if (!u) { u = unpacker((m) => ep.onMessage(d.from, m)); recv.set(d.from, u); }
    u(d.s);
  };
  return ep;
}
