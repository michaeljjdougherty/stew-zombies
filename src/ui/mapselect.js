// =============================================================================
// Map select: a real-looking town map you can drag and zoom, with Stew Leonard
// High on it (drawn from the actual level) and pins for the maps that aren't
// out yet. Pick a map from the list or its pin; Play starts it (with the intro
// the first time).
// =============================================================================
import { SCHOOL } from '../map/school.js';

const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The maps. Only the first one is playable for now.
export const MAPS = [
  {
    id: 'lastbell', name: 'Stew Leonard High', tag: 'Out of Bounds', ready: true, at: [2, -27],
    blurb: 'Championship night. Erik Madsen sealed himself in the Press Box over center court and let the dead in. Hold the school, turn the power back on, and drag him out of there.',
    facts: ['Map 1', '1–4 players', 'Story by James Amarante'],
  },
  {
    id: 'map2', name: 'Map 2', tag: 'Coming soon', ready: false, at: [760, -470], far: true,
    blurb: 'The season isn\'t over.',
    facts: ['Somewhere past the parking lot', 'Way past'],
  },
  {
    id: 'creamery', name: 'Classified', tag: 'Coming soon', ready: false, at: [-470, 300],
    blurb: 'The old creamery out by Gravy Creek has been locked up for years. Something in the walk-in freezer is still knocking.',
    facts: ['Coming soon'],
  },
  {
    id: 'kearnita', name: 'Classified', tag: 'Coming soon', ready: false, at: [520, 330],
    blurb: 'Kearnita would know what to do.',
    facts: ['Coming soon'],
  },
];

// --- the town (metres; x east, y = the level's z, south) -------------------------
function rng(seed) { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const W0 = -760, W1 = 960, H0 = -640, H1 = 560;

function el(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// Roads: [points, width, name, kind]
const ROADS = [
  [[[W0, 105], [-200, 100], [0, 98], [220, 104], [W1, 120]], 16, 'Stew Leonard Way', 'major'],
  [[[-95, H0], [-92, -200], [-96, 100], [-110, 300], [-150, H1]], 13, 'Ladle Lane', 'major'],
  [[[W0, -420], [-300, -330], [100, -260], [420, -150], [W1, -60]], 20, 'Route 8', 'highway'],
  [[[260, H0], [255, -260], [250, 104], [240, H1]], 12, 'Dairy Road', 'major'],
  [[[-95, -150], [80, -152], [255, -150]], 9, 'Booster Ave', 'minor'],
  [[[-420, H0], [-410, -300], [-430, 100], [-440, H1]], 10, 'Broth Blvd', 'minor'],
  [[[W0, 300], [-430, 300], [-110, 290], [240, 310], [600, 330], [W1, 320]], 11, 'Gravy Creek Rd', 'minor'],
  [[[600, -300], [610, 120], [590, H1]], 10, 'Ladle Lane N', 'minor'],
  [[[-95, 200], [250, 205]], 8, '', 'minor'],
  [[[-420, -60], [-96, -50]], 8, 'Mascot St', 'minor'],
  [[[255, -40], [600, -30]], 8, 'Tip-Off Ct', 'minor'],
  [[[-560, H0], [-570, -420]], 8, '', 'minor'],
];
// Gravy Creek and the pond
const CREEK = [[W0, 380], [-560, 360], [-460, 410], [-300, 390], [-120, 430], [80, 420], [300, 460], [520, 440], [700, 480], [W1, 470]];

function path(points, close = false) {
  let d = '';
  points.forEach(([x, y], i) => {
    if (i === 0) { d += `M${x},${y}`; return; }
    const [px, py] = points[i - 1];
    const mx = (px + x) / 2, my = (py + y) / 2;
    d += i === 1 ? ` L${mx},${my}` : ` Q${px},${py} ${mx},${my}`;
    if (i === points.length - 1) d += ` L${x},${y}`;
  });
  return close ? d + ' Z' : d;
}

// Little building footprints on the town blocks (not on roads, water or campus).
function blocks(g) {
  const R = rng(19);
  const avoid = (x, y) => {
    if (x > -95 && x < 230 && y > -160 && y < 92) return true;   // the campus
    for (const [pts, w] of ROADS) {
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
        const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
        if (Math.hypot(ax + dx * k - x, ay + dy * k - y) < w / 2 + 16) return true;
      }
    }
    for (let i = 1; i < CREEK.length; i++) {
      const [ax, ay] = CREEK[i - 1], [bx, by] = CREEK[i];
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
      if (Math.hypot(ax + dx * k - x, ay + dy * k - y) < 40) return true;
    }
    return false;
  };
  for (let y = H0 + 30; y < H1 - 20; y += 34) {
    for (let x = W0 + 30; x < W1 - 20; x += 30 + R() * 16) {
      if (R() < 0.38) continue;
      const cx = x + R() * 8, cy = y + R() * 8;
      if (avoid(cx, cy)) continue;
      const w = 10 + R() * 16, h = 9 + R() * 14;
      el('rect', { x: cx - w / 2, y: cy - h / 2, width: w, height: h, class: 'ms-bld', transform: `rotate(${(R() - 0.5) * 6} ${cx} ${cy})` }, g);
    }
  }
}

function trees(g, x0, y0, x1, y1, n, seed) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) el('circle', { cx: x0 + R() * (x1 - x0), cy: y0 + R() * (y1 - y0), r: 3 + R() * 4, class: 'ms-tree' }, g);
}

function buildWorld(svg) {
  const world = el('g', { id: 'ms-world' }, svg);
  el('rect', { x: W0 - 400, y: H0 - 400, width: W1 - W0 + 800, height: H1 - H0 + 800, class: 'ms-land' }, world);
  // topographic contours
  const topo = el('g', { class: 'ms-topo' }, world);
  for (const [cx, cy, r0, n] of [[-480, -260, 40, 7], [640, 240, 30, 6], [-300, 470, 30, 4]]) {
    for (let i = 0; i < n; i++) {
      const r = r0 + i * 34, R = rng(cx + i * 7 + 1000);
      const pts = []; for (let a = 0; a < 16; a++) { const ang = (a / 16) * Math.PI * 2; const rr = r * (0.82 + R() * 0.3); pts.push([cx + Math.cos(ang) * rr * 1.3, cy + Math.sin(ang) * rr]); }
      pts.push(pts[0], pts[1]);
      el('path', { d: path(pts, true) }, topo);
    }
  }
  // parks
  for (const [x, y, w, h, name] of [[-380, -230, 240, 150, 'Schnitz Woods'], [300, 170, 180, 110, 'Booster Park'], [-700, 160, 200, 120, '']]) {
    el('rect', { x, y, width: w, height: h, rx: 18, class: 'ms-park' }, world);
    trees(world, x + 8, y + 8, x + w - 8, y + h - 8, Math.floor(w * h / 500), x * 3 + y);
    if (name) world.appendChild(label(x + w / 2, y + h / 2, name, 'park'));
  }
  // water
  el('path', { d: path(CREEK), class: 'ms-water-line' }, world);
  el('ellipse', { cx: -560, cy: 470, rx: 80, ry: 45, class: 'ms-water' }, world);
  world.appendChild(label(150, 450, 'Gravy Creek', 'water'));
  // town blocks
  blocks(el('g', {}, world));
  // roads (casing, then fill, then names)
  const rc = el('g', {}, world), rf = el('g', {}, world);
  for (const [pts, w, , kind] of ROADS) {
    el('path', { d: path(pts), class: 'ms-road-case ' + kind, 'stroke-width': w + 4 }, rc);
    el('path', { d: path(pts), class: 'ms-road ' + kind, 'stroke-width': w }, rf);
  }
  for (const [pts, , name] of ROADS) {
    if (!name) continue;
    const a = pts[Math.floor(pts.length / 2) - 1], b = pts[Math.floor(pts.length / 2)];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    const t = label((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, name, 'road');
    t.dataset.rot = ang > 90 || ang < -90 ? ang + 180 : ang;
    world.appendChild(t);
  }
  // the campus: grounds, field, parking, the school itself
  const campus = el('g', { class: 'ms-campus' }, world);
  el('rect', { x: -82, y: -142, width: 302, height: 228, rx: 6, class: 'ms-grounds' }, campus);
  el('rect', { x: 70, y: -128, width: 128, height: 70, rx: 34, class: 'ms-track' }, campus);
  el('rect', { x: 88, y: -116, width: 92, height: 46, class: 'ms-field' }, campus);
  for (let i = 1; i < 10; i++) el('line', { x1: 88 + i * 9.2, y1: -116, x2: 88 + i * 9.2, y2: -70, class: 'ms-yard' }, campus);
  el('rect', { x: -60, y: 32, width: 150, height: 46, class: 'ms-lot' }, campus);
  for (let i = 0; i < 25; i++) el('line', { x1: -56 + i * 6, y1: 34, x2: -56 + i * 6, y2: 46, class: 'ms-stall' }, campus);
  for (let i = 0; i < 25; i++) el('line', { x1: -56 + i * 6, y1: 64, x2: -56 + i * 6, y2: 76, class: 'ms-stall' }, campus);
  trees(campus, -78, -138, -40, -92, 16, 5);
  trees(campus, 140, 20, 215, 80, 22, 6);
  const school = el('g', { class: 'ms-school' }, campus);
  const roomLabels = el('g', { class: 'ms-roomlabels' }, campus);
  for (const room of SCHOOL.rooms) {
    const [x0, z0, x1, z1] = room.rect;
    el('rect', { x: x0, y: z0, width: x1 - x0, height: z1 - z0, class: room.outdoor ? 'ms-room out' : 'ms-room' }, school);
    const t = label((x0 + x1) / 2, (z0 + z1) / 2, room.name, 'room');
    roomLabels.appendChild(t);
  }
  campus.appendChild(label(40, -92, 'Stew Leonard High', 'campus'));
  campus.appendChild(label(134, -93, 'Field', 'small'));
  campus.appendChild(label(15, 55, 'Parking', 'small'));
  // neighborhoods
  for (const [x, y, n] of [[-600, -520, 'North Broth'], [520, -480, 'Dairy Flats'], [-620, 40, 'Ladle Hill'], [420, 30, 'Tip-Off'], [-260, 230, 'Creekside'], [560, 520, 'The Bottoms']]) world.appendChild(label(x, y, n, 'hood'));
  // the top-right corner: the paper's burned through, and there are stars behind it
  const burn = el('g', { class: 'ms-burn' }, world);
  const R = rng(88);
  const edge = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI / 2; const r = 230 + R() * 60; edge.push([W1 + 80 - Math.cos(a) * r * 1.4, H0 - 80 + Math.sin(a) * r]); }
  el('path', { d: `M${W1 + 400},${H0 - 400} L${edge[0][0]},${H0 - 400} ` + edge.map(([x, y]) => `L${x},${y}`).join(' ') + ` L${W1 + 400},${edge[14][1]} Z`, class: 'ms-hole' }, burn);
  el('path', { d: 'M' + edge.map(([x, y]) => `${x},${y}`).join(' L'), class: 'ms-char' }, burn);
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI / 2, r = R() * 260;
    el('circle', { cx: W1 + 80 - Math.cos(a) * r * 1.3, cy: H0 - 80 + Math.sin(a) * r * 0.9, r: 0.6 + R() * 1.8, class: 'ms-star' }, burn);
  }
  return { world, roomLabels };
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
    const { world, roomLabels } = buildWorld(this.svg);
    this.world = world;
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
    $('ms-watch').addEventListener('click', () => this.h.watchIntro());
    $('ms-back').addEventListener('click', () => this.h.back());
    this.raf = null;
  }

  current() { return MAPS.find((m) => m.id === this.sel); }

  open() {
    $('ms-intro').checked = !this.h.introSeen();
    this.select(this.sel, false);
    this.cam = { x: 30, y: -30, k: this.fitK() };
    this.resize();
    this.loop();
  }
  close() { cancelAnimationFrame(this.raf); this.raf = null; this.last = 0; }

  fitK() {
    const r = this.view.getBoundingClientRect();
    return Math.max(0.6, Math.min(r.width / 420, r.height / 300));
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
        : `<i><b>?</b></i><em>${m.far ? '???' : 'Coming soon'}</em>`;
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
    if (fly) this.flyTo(m);
  }

  flyTo(m, home = false) {
    const fit = this.fitK();
    const k = m.ready ? fit * (home ? 1 : 1.15) : m.far ? fit * 0.42 : fit * 0.6;
    this.goal = { x: m.at[0], y: m.at[1], k };
  }

  zoomBy(f, sx = null, sy = null) {
    const r = this.view.getBoundingClientRect();
    if (sx == null) { sx = r.width / 2; sy = r.height / 2; }
    // zoom about the point under the cursor (of wherever the camera is headed)
    const b = this.goal || this.cam;
    const wx = b.x + (sx - r.width / 2) / b.k, wy = b.y + (sy - r.height / 2) / b.k;
    const k = Math.max(0.35, Math.min(14, b.k * f));
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
      $('ms-coord').textContent = `${(41.12 - w.y / 111000).toFixed(4)}° N  ${(73.42 - w.x / 84000).toFixed(4)}° W`;
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      if (ptrs.size === 2 && pinch) {
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...ptrs.values()];
        this.cam.k = Math.max(0.35, Math.min(14, pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
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
    if (zoom) this.cam.k = Math.max(0.35, Math.min(14, this.cam.k * Math.exp(zoom * dt * 1.8)));
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
    // labels stay the same size on screen
    for (const t of this.labels) {
      const x = +t.dataset.x, y = +t.dataset.y;
      t.setAttribute('x', x); t.setAttribute('y', y);
      const kind = t.classList;
      const size = kind.contains('room') ? 10.5 : kind.contains('campus') ? 15 : kind.contains('hood') ? 13 : kind.contains('small') ? 10 : 11;
      t.setAttribute('font-size', size / k);
      const rot = t.dataset.rot;
      t.setAttribute('transform', rot ? `rotate(${rot} ${x} ${y})` : '');
    }
    this.roomLabels.style.opacity = Math.max(0, Math.min(1, (k - 4.5) / 2));
    this.svg.classList.toggle('far', k < 1.2);
    for (const { m, p } of this.pins) {
      const s = this.toScreen(m.at[0], m.at[1]);
      p.style.transform = `translate(${s.x}px, ${s.y}px)`;
    }
    $('ms-scale-txt').textContent = `${Math.round(100 / k)} m`;
  }
}
