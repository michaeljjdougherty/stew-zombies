// =============================================================================
// Map select: a star chart you can drag and zoom. Since The Final Whistle the
// campus has been anchored to an asteroid out in deep space, so every map is
// its own world: Stew Leonard High on its rock (the real level, drawn from the
// map data), and planets for the maps that aren't out yet. Pick one from the
// list or its pin; Play starts it (with the intro the first time).
// =============================================================================
import { SCHOOL } from '../map/school.js';

const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The maps. Only the first one is playable for now.
export const MAPS = [
  {
    id: 'lastbell', name: 'Stew Leonard High', tag: 'Out of Bounds', ready: true, at: [4, -27], world: 'The asteroid',
    blurb: 'Championship night. Erik Madsen sealed himself in the Press Box over center court and let the dead in. Hold the school, turn the power back on, and drag him out of there.',
    facts: ['Map 1', '1–4 players', 'Story by James Amarante'],
  },
  {
    id: 'map2', name: 'Map 2', tag: 'Coming soon', ready: false, at: [820, -430], r: 170,
    blurb: 'The season isn\'t over.',
    facts: ['Through the portal', 'Brian knows the way'],
  },
  {
    id: 'ice', name: 'Classified', tag: 'Coming soon', ready: false, at: [-640, 330], r: 115,
    blurb: 'Something under the ice is still knocking.',
    facts: ['Coming soon'],
  },
  {
    id: 'red', name: 'Classified', tag: 'Coming soon', ready: false, at: [560, 420], r: 85,
    blurb: 'Kearnita would know what to do.',
    facts: ['Coming soon'],
  },
];

function rng(seed) { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const SUN = [-1150, -760];

function el(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}
function grad(defs, id, stops, { radial = true, cx = '50%', cy = '50%', r = '50%', fx, fy, x1, y1, x2, y2 } = {}) {
  const g = radial ? el('radialGradient', { id, cx, cy, r, ...(fx ? { fx, fy } : {}) }, defs) : el('linearGradient', { id, x1, y1, x2, y2 }, defs);
  for (const [o, c, a = 1] of stops) el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g);
  return g;
}
// where the light falls on a world at (x, y): the side facing the sun
function lit(x, y) {
  const dx = SUN[0] - x, dy = SUN[1] - y, l = Math.hypot(dx, dy);
  return { fx: `${50 + dx / l * 28}%`, fy: `${50 + dy / l * 28}%` };
}

function buildWorld(svg) {
  const defs = el('defs', {}, svg);
  grad(defs, 'ms-neb1', [['0%', '#6a2c8c', 0.45], ['100%', '#6a2c8c', 0]]);
  grad(defs, 'ms-neb2', [['0%', '#1f6f8b', 0.4], ['100%', '#1f6f8b', 0]]);
  grad(defs, 'ms-neb3', [['0%', '#8c2c4c', 0.3], ['100%', '#8c2c4c', 0]]);
  grad(defs, 'ms-sun', [['0%', '#fff6dc'], ['18%', '#ffd27a'], ['45%', '#ff8a3a', 0.35], ['100%', '#ff6a20', 0]]);
  grad(defs, 'ms-glow', [['0%', '#9ff6ff', 0.9], ['60%', '#4aa8ff', 0.35], ['100%', '#2050ff', 0]]);
  grad(defs, 'ms-shade', [['0%', '#000', 0], ['55%', '#000', 0.25], ['100%', '#000', 0.85]]);

  // far layer (moves slower: depth)
  const far = el('g', { id: 'ms-far' }, svg);
  const R = rng(5);
  for (const [x, y, r, g] of [[-500, -300, 700, 'ms-neb1'], [600, 300, 600, 'ms-neb2'], [200, -700, 500, 'ms-neb3'], [-900, 500, 500, 'ms-neb2'], [1100, -100, 400, 'ms-neb1']]) {
    el('ellipse', { cx: x, cy: y, rx: r * 1.4, ry: r, fill: `url(#${g})` }, far);
  }
  for (let i = 0; i < 900; i++) {
    const b = R();
    el('circle', { cx: (R() - 0.5) * 4200, cy: (R() - 0.5) * 2800, r: b > 0.985 ? 2.6 : b > 0.9 ? 1.6 : 0.9, class: 'ms-star', opacity: 0.3 + R() * 0.7 }, far);
  }

  const world = el('g', { id: 'ms-world' }, svg);
  // the sun, off in the corner, and the orbits round it
  el('circle', { cx: SUN[0], cy: SUN[1], r: 420, fill: 'url(#ms-sun)' }, world);
  for (const [rx, ry] of [[1500, 1060], [2050, 1420], [2500, 1700]]) el('ellipse', { cx: SUN[0], cy: SUN[1], rx, ry, class: 'ms-orbit' }, world);

  // --- the planets (coming soon)
  for (const m of MAPS) {
    if (m.ready) continue;
    const [x, y] = m.at, r = m.r;
    const L = lit(x, y);
    const g = el('g', { class: 'ms-planet' }, world);
    const id = 'ms-p-' + m.id;
    const pal = m.id === 'map2' ? ['#d7b6ff', '#8b5cc8', '#3a1f6a'] : m.id === 'ice' ? ['#f2fbff', '#a9d6ea', '#3c6a88'] : ['#ffb08a', '#c4502c', '#4a160c'];
    grad(defs, id, [['0%', pal[0]], ['45%', pal[1]], ['100%', pal[2]]], { fx: L.fx, fy: L.fy, cx: L.fx, cy: L.fy, r: '75%' });
    const clip = el('clipPath', { id: id + '-c' }, defs); el('circle', { cx: x, cy: y, r }, clip);
    if (m.id === 'map2') {
      // rings behind
      el('ellipse', { cx: x, cy: y, rx: r * 2.0, ry: r * 0.42, class: 'ms-ring back', transform: `rotate(-14 ${x} ${y})` }, g);
    }
    el('circle', { cx: x, cy: y, r: r * 1.12, fill: m.id === 'ice' ? 'rgba(200,240,255,.12)' : m.id === 'map2' ? 'rgba(180,140,255,.12)' : 'rgba(255,120,80,.1)' }, g);   // atmosphere
    el('circle', { cx: x, cy: y, r, fill: `url(#${id})` }, g);
    const surf = el('g', { 'clip-path': `url(#${id}-c)` }, g);
    const PR = rng(x + y);
    if (m.id === 'map2') {
      for (let i = -6; i <= 6; i++) el('rect', { x: x - r, y: y + i * r / 6 - 6, width: r * 2, height: 6 + PR() * 14, fill: PR() < 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(40,10,80,.18)', transform: `rotate(-14 ${x} ${y})` }, surf);
      el('ellipse', { cx: x + r * 0.3, cy: y + r * 0.25, rx: r * 0.22, ry: r * 0.12, fill: 'rgba(255,190,220,.35)', transform: `rotate(-14 ${x} ${y})` }, surf);
    } else if (m.id === 'ice') {
      for (let i = 0; i < 9; i++) { const a = PR() * 6.28, d = PR() * r; el('path', { d: `M${x + Math.cos(a) * d},${y + Math.sin(a) * d} l${(PR() - 0.5) * r},${(PR() - 0.5) * r * 0.6}`, class: 'ms-crack' }, surf); }
      el('ellipse', { cx: x, cy: y - r * 0.82, rx: r * 0.6, ry: r * 0.22, fill: 'rgba(255,255,255,.45)' }, surf);
    } else {
      for (let i = 0; i < 12; i++) { const a = PR() * 6.28, d = PR() * r * 0.9; el('circle', { cx: x + Math.cos(a) * d, cy: y + Math.sin(a) * d, r: 3 + PR() * 12, fill: 'rgba(60,10,0,.35)' }, surf); }
      el('path', { d: `M${x - r},${y + r * 0.1} q${r * 0.6},${-r * 0.3} ${r * 2},${r * 0.05}`, fill: 'none', stroke: 'rgba(80,20,5,.45)', 'stroke-width': 6 }, surf);
    }
    // night side
    const sh = id + '-s';
    grad(defs, sh, [['0%', '#000', 0], ['50%', '#000', 0.05], ['100%', '#02010a', 0.88]], { cx: L.fx, cy: L.fy, fx: L.fx, fy: L.fy, r: '85%' });
    el('circle', { cx: x, cy: y, r, fill: `url(#${sh})` }, g);
    if (m.id === 'map2') el('path', { d: ringFront(x, y, r), class: 'ms-ring', transform: `rotate(-14 ${x} ${y})` }, g);
  }

  // --- Brian's portal, and the way through it
  const P = [250, 70], M2 = MAPS[1].at;
  el('path', { d: `M${P[0]},${P[1]} C${P[0] + 260},${P[1] - 40} ${M2[0] - 320},${M2[1] + 260} ${M2[0] - 150},${M2[1] + 110}`, class: 'ms-route' }, world);
  el('circle', { cx: P[0], cy: P[1], r: 26, fill: 'url(#ms-glow)' }, world);
  el('circle', { cx: P[0], cy: P[1], r: 9, class: 'ms-portal' }, world);
  world.appendChild(label(P[0], P[1] + 26, 'Portal', 'small'));

  // --- the asteroid, with the school anchored on its flat top
  const rock = el('g', { class: 'ms-rock' }, world);
  const RR = rng(77);
  const pts = [];
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; const r = 150 * (0.82 + RR() * 0.18) * (1 + 0.1 * Math.sin(a * 3)); pts.push([4 + Math.cos(a) * r * 1.15, -27 + Math.sin(a) * r]); }
  const L = lit(4, -27);
  grad(defs, 'ms-rockg', [['0%', '#8a8098'], ['55%', '#4a4258'], ['100%', '#1a1624']], { cx: L.fx, cy: L.fy, fx: L.fx, fy: L.fy, r: '80%' });
  el('path', { d: 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L') + ' Z', fill: 'url(#ms-rockg)', class: 'ms-rockedge' }, rock);
  for (let i = 0; i < 16; i++) {
    const a = RR() * 6.28, d = 60 + RR() * 75, cr = 4 + RR() * 12;
    el('ellipse', { cx: 4 + Math.cos(a) * d * 1.1, cy: -27 + Math.sin(a) * d * 0.95, rx: cr, ry: cr * 0.8, class: 'ms-crater' }, rock);
  }
  for (let i = 0; i < 9; i++) {
    let x = 4 + (RR() - 0.5) * 260, y = -27 + (RR() - 0.5) * 220; let d = `M${x},${y}`;
    for (let k = 0; k < 6; k++) { x += (RR() - 0.5) * 40; y += (RR() - 0.5) * 40; d += ` L${x.toFixed(1)},${y.toFixed(1)}`; }
    el('path', { d, class: 'ms-vein' }, rock);
  }
  // the campus pad and the school (to scale, metres)
  el('ellipse', { cx: 4, cy: -27, rx: 70, ry: 66, class: 'ms-pad' }, rock);
  const school = el('g', { class: 'ms-school' }, rock);
  const roomLabels = el('g', { class: 'ms-roomlabels' }, rock);
  for (const room of SCHOOL.rooms) {
    const [x0, z0, x1, z1] = room.rect;
    el('rect', { x: x0, y: z0, width: x1 - x0, height: z1 - z0, class: room.outdoor ? 'ms-room out' : 'ms-room' }, school);
    roomLabels.appendChild(label((x0 + x1) / 2, (z0 + z1) / 2, room.name, 'room'));
  }
  // the gym's doors, open, light spilling out onto the stone
  el('ellipse', { cx: -12, cy: 19, rx: 9, ry: 5, fill: 'url(#ms-glow)', opacity: 0.5 }, rock);
  world.appendChild(label(4, -98, 'Stew Leonard High', 'campus'));
  // a few rocks drifting about
  for (let i = 0; i < 26; i++) {
    const a = RR() * 6.28, d = 230 + RR() * 900;
    const x = 4 + Math.cos(a) * d * 1.3, y = -27 + Math.sin(a) * d * 0.8, r = 2 + RR() * 9;
    el('circle', { cx: x, cy: y, r, class: 'ms-debris' }, world);
  }
  return { world, far, roomLabels };
}

// the front half of a tilted ring (the back half is drawn behind the planet)
function ringFront(x, y, r) {
  const rx = r * 2.0, ry = r * 0.42;
  return `M${x - rx},${y} A${rx},${ry} 0 0 0 ${x + rx},${y}`;
}

function label(x, y, text, kind) {
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('class', 'ms-label ' + kind);
  t.dataset.x = x; t.dataset.y = y;
  t.textContent = text;
  return t;
}

// --- the screen -------------------------------------------------------------------
export class MapSelect {
  // h: { play(mapId, withIntro), watchIntro(), back(), introSeen() }
  constructor(h) {
    this.h = h;
    this.view = $('ms-view');
    this.svg = $('ms-svg');
    this.pinsEl = $('ms-pins');
    const { world, far, roomLabels } = buildWorld(this.svg);
    this.world = world;
    this.far = far;
    this.roomLabels = roomLabels;
    this.labels = [...this.svg.querySelectorAll('.ms-label')];
    this.cam = { x: 30, y: -30, k: 2.2 };
    this.goal = null;
    this.sel = MAPS[0].id;
    this.buildList();
    this.buildPins();
    this.bindPointer();
    $('ms-zin').addEventListener('click', () => this.zoomBy(1.6));
    $('ms-zout').addEventListener('click', () => this.zoomBy(1 / 1.6));
    $('ms-home').addEventListener('click', () => this.flyTo(MAPS.find((m) => m.id === this.sel), true));
    $('ms-play').addEventListener('click', () => { const m = this.current(); if (m.ready) this.h.play(m.id, $('ms-intro').checked); });
    for (const r of document.querySelectorAll('input[name="ms-hints"]')) r.addEventListener('change', () => { if (r.checked && this.h.setHints) this.h.setHints(r.value); });
    $('ms-watch').addEventListener('click', () => this.h.watchIntro());
    $('ms-back').addEventListener('click', () => this.h.back());
    this.raf = null;
  }

  current() { return MAPS.find((m) => m.id === this.sel); }

  open() {
    $('ms-intro').checked = !this.h.introSeen();
    const hints = this.h.hints ? this.h.hints() : 'walkthrough';
    for (const r of document.querySelectorAll('input[name="ms-hints"]')) r.checked = r.value === hints;
    this.resize();
    // start on the whole system, then drift in to the selected world
    this.cam = { x: 0, y: -60, k: this.overviewK() };
    this.select(this.sel, true);
    this.loop();
  }
  close() { cancelAnimationFrame(this.raf); this.raf = null; this.last = 0; }

  fitK() {   // the asteroid (and the school on it) filling the view
    const r = this.view.getBoundingClientRect();
    return Math.max(0.5, Math.min(r.width / 420, r.height / 340));
  }
  overviewK() {
    const r = this.view.getBoundingClientRect();
    return Math.max(0.12, Math.min(r.width / 2600, r.height / 1700));
  }

  buildList() {
    const list = $('ms-list');
    list.textContent = '';
    for (const m of MAPS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ms-item' + (m.ready ? '' : ' soon'); b.dataset.map = m.id;
      b.innerHTML = `<b>${esc(m.name)}</b><span>${esc(m.tag)}</span>`;
      b.addEventListener('click', () => this.select(m.id));
      b.addEventListener('focus', () => this.select(m.id));
      list.appendChild(b);
    }
  }

  buildPins() {
    this.pins = MAPS.map((m) => {
      const p = document.createElement('button');
      p.type = 'button'; p.className = 'ms-pin' + (m.ready ? ' ready' : ' soon'); p.dataset.map = m.id;
      p.setAttribute('aria-label', m.ready ? m.name : `${m.name} (coming soon)`);
      p.innerHTML = m.ready
        ? '<i></i><em>Map 1</em>'
        : `<i><b>?</b></i><em>${m.id === 'map2' ? '???' : 'Coming soon'}</em>`;
      p.addEventListener('click', (e) => { e.stopPropagation(); this.select(m.id); });
      p.tabIndex = -1;   // the list is the keyboard / controller way in
      this.pinsEl.appendChild(p);
      return { m, p };
    });
  }

  // Pick a map: highlight it in the list and on the map, show its card, fly there.
  select(id, fly = true) {
    this.sel = id;
    const m = this.current();
    for (const b of $('ms-list').children) b.setAttribute('aria-current', String(b.dataset.map === id));
    for (const { m: pm, p } of this.pins) p.classList.toggle('on', pm.id === id);
    $('ms-name').textContent = m.name;
    $('ms-tag').textContent = m.tag;
    $('ms-blurb').textContent = m.blurb;
    $('ms-facts').innerHTML = m.facts.map((f) => `<li>${esc(f)}</li>`).join('');
    $('ms-card').classList.toggle('soon', !m.ready);
    $('ms-play').disabled = !m.ready;
    $('ms-play').textContent = m.ready ? 'Play' : 'Coming soon';
    $('ms-introrow').hidden = !m.ready;
    $('ms-moderow').hidden = !m.ready;
    if (fly) this.flyTo(m);
  }

  flyTo(m, home = false) {
    const fit = this.fitK();
    const k = m.ready ? fit * (home ? 1 : 1.1) : Math.min(fit, Math.min(this.vw || 800, this.vh || 600) / (m.r * (m.id === 'map2' ? 5.2 : 3.4)));
    this.goal = { x: m.at[0], y: m.at[1], k };
  }

  zoomBy(f, sx = null, sy = null) {
    const r = this.view.getBoundingClientRect();
    if (sx == null) { sx = r.width / 2; sy = r.height / 2; }
    // zoom about the point under the cursor (of wherever the camera is headed)
    const b = this.goal || this.cam;
    const wx = b.x + (sx - r.width / 2) / b.k, wy = b.y + (sy - r.height / 2) / b.k;
    const k = Math.max(0.08, Math.min(14, b.k * f));
    this.goal = { x: wx - (sx - r.width / 2) / k, y: wy - (sy - r.height / 2) / k, k };
  }

  toWorld(sx, sy) {
    const r = this.view.getBoundingClientRect();
    return { x: this.cam.x + (sx - r.width / 2) / this.cam.k, y: this.cam.y + (sy - r.height / 2) / this.cam.k };
  }
  toScreen(x, y) {
    return { x: (x - this.cam.x) * this.cam.k + this.vw / 2, y: (y - this.cam.y) * this.cam.k + this.vh / 2 };
  }

  bindPointer() {
    const v = this.view;
    const ptrs = new Map();
    let pinch = null;
    v.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.ms-pin, .ms-tools')) return;
      v.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.goal = null;
      v.classList.add('drag');
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: this.cam.k }; }
    });
    v.addEventListener('pointermove', (e) => {
      const r = v.getBoundingClientRect();
      const w = this.toWorld(e.clientX - r.left, e.clientY - r.top);
      $('ms-coord').textContent = `SECTOR 8 · ${(w.x / 10).toFixed(1)} · ${(-w.y / 10).toFixed(1)}`;
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      if (ptrs.size === 2 && pinch) {
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...ptrs.values()];
        this.cam.k = Math.max(0.08, Math.min(14, pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
        return;
      }
      this.cam.x -= (e.clientX - p.x) / this.cam.k;
      this.cam.y -= (e.clientY - p.y) / this.cam.k;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) v.classList.remove('drag'); };
    v.addEventListener('pointerup', up);
    v.addEventListener('pointercancel', up);
    v.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = v.getBoundingClientRect();
      this.zoomBy(Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    v.addEventListener('dblclick', (e) => { const r = v.getBoundingClientRect(); this.zoomBy(2, e.clientX - r.left, e.clientY - r.top); });
    window.addEventListener('resize', () => this.resize());
  }

  // Right stick pans, triggers zoom (called by the controller nav).
  padLook(x, y, zoom, dt) {
    this.goal = null;
    this.cam.x += x * dt * 420 / this.cam.k;
    this.cam.y += y * dt * 420 / this.cam.k;
    if (zoom) this.cam.k = Math.max(0.08, Math.min(14, this.cam.k * Math.exp(zoom * dt * 1.8)));
  }

  resize() {
    const r = this.view.getBoundingClientRect();
    this.vw = r.width; this.vh = r.height;
    this.svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
  }

  loop() {
    this.raf = requestAnimationFrame(() => this.loop());
    if (!this.vw) this.resize();
    const now = performance.now(), dt = Math.min(0.1, ((now - (this.last || now)) / 1000)); this.last = now;
    if (this.goal) {
      const c = this.cam, g = this.goal, a = 1 - Math.exp(-dt * 7);
      c.x += (g.x - c.x) * a; c.y += (g.y - c.y) * a;
      c.k *= Math.pow(g.k / c.k, a);
      if (Math.abs(g.x - c.x) < 0.05 && Math.abs(g.y - c.y) < 0.05 && Math.abs(g.k / c.k - 1) < 0.002) this.goal = null;
    }
    this.draw();
  }

  draw() {
    const c = this.cam, k = c.k;
    this.world.setAttribute('transform', `translate(${this.vw / 2 - c.x * k} ${this.vh / 2 - c.y * k}) scale(${k})`);
    // the stars and nebulae sit much further back: they move less
    const fk = 0.35 + k * 0.15, fp = 0.3;
    this.far.setAttribute('transform', `translate(${this.vw / 2 - c.x * fk * fp} ${this.vh / 2 - c.y * fk * fp}) scale(${fk})`);
    // labels stay the same size on screen
    for (const t of this.labels) {
      const x = +t.dataset.x, y = +t.dataset.y;
      t.setAttribute('x', x); t.setAttribute('y', y);
      const kind = t.classList;
      const size = kind.contains('room') ? 10.5 : kind.contains('campus') ? 14 : kind.contains('small') ? 10 : 11;
      t.setAttribute('font-size', size / k);
      const rot = t.dataset.rot;
      t.setAttribute('transform', rot ? `rotate(${rot} ${x} ${y})` : '');
    }
    this.roomLabels.style.opacity = Math.max(0, Math.min(1, (k - 4.5) / 2));
    this.svg.classList.toggle('far', k < 0.6);
    for (const { m, p } of this.pins) {
      const s = this.toScreen(m.at[0], m.at[1] - (m.r ? m.r * 1.02 : 0));   // planets: the pin sits on top
      p.style.transform = `translate(${s.x}px, ${s.y}px)`;
    }
  }
}
