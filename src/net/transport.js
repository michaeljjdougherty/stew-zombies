// =============================================================================
// Ways for browsers to talk. All have the same shape:
//   endpoint.id                     who I am
//   endpoint.send(to, msg)          one peer (to = null: everyone)
//   endpoint.onMessage(from, msg)   set by the caller
//   endpoint.onOpen(peer) / onClose(peer)
//   endpoint.close()
// Messages are plain objects, sent as JSON.
//   - LoopbackHub: in one process with fake lag (headless tests)
//   - PeerTransport: the real thing, WebRTC through PeerJS (src/net/peer.js)
// =============================================================================

export class LoopbackHub {
  constructor({ latency = 4, jitter = 2, seed = 1 } = {}) {
    this.latency = latency; this.jitter = jitter;
    this.now = 0; this.queue = []; this.ends = new Map(); this.links = new Map();
    this.s = seed; this.bytes = 0;
  }
  rand() { this.s = (this.s * 1664525 + 1013904223) >>> 0; return this.s / 4294967296; }
  endpoint(id) {
    const hub = this;
    const ep = {
      id, peers: new Set(),
      onMessage: () => {}, onOpen: () => {}, onClose: () => {},
      send(to, msg) {
        const json = JSON.stringify(msg);
        for (const t of to == null ? [...ep.peers] : [to]) {
          hub.bytes += json.length;
          const key = id + '>' + t;
          const due = Math.max(hub.links.get(key) || 0, hub.now + hub.latency + Math.floor(hub.rand() * (hub.jitter + 1)));
          hub.links.set(key, due);
          hub.queue.push({ due, from: id, to: t, json });
        }
      },
      close() { for (const t of ep.peers) { const o = hub.ends.get(t); o.peers.delete(id); o.onClose(id); } ep.peers.clear(); },
    };
    this.ends.set(id, ep);
    return ep;
  }
  connect(a, b) {
    const A = this.ends.get(a), B = this.ends.get(b);
    A.peers.add(b); B.peers.add(a); A.onOpen(b); B.onOpen(a);
  }
  // advance one tick, delivering what's due
  tick() {
    this.now++;
    const due = this.queue.filter((m) => m.due <= this.now);
    this.queue = this.queue.filter((m) => m.due > this.now);
    for (const m of due) { const ep = this.ends.get(m.to); if (ep && ep.peers.has(m.from)) ep.onMessage(m.from, JSON.parse(m.json)); }
  }
}
