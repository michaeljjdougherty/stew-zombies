// =============================================================================
// Call of the Crust's cutscenes, played by the trailer's machinery
// (src/render/trailer.js) on the real map. Timings, lines and cues are in
// CONFIG.crustFilms; the choreography is here.
//
// THE INTRO ("You Made It, Man")
//   arrive    a portal tears open over the Anvil's dais; Stew drop out of it
//   getup     they pick themselves up: space, again
//   pit       Pit's at a forge. Pit's a blacksmith now
//   cage      out past the north rim, hanging over nothing: Chops, Regs and P
//             in a cage on a chain
//   schnitz   up the chain to a green whirl, and the Schnitz's eyes open round
//             it: Zach is its, the boys are its, and the cage opens for one
//             price. Somebody goes over the edge
//   zach      Big Evil Zach, out in the dark
//   tour_*    Pit names the islands, a slow look at each from the air: the
//             Ship Graveyard, the Research Base, the Trench Front, the Ice
//             Caves (and each one's titan)
//   relays    the north launcher, dead: its junction box spitting sparks. The
//             power's out; every launcher blew a relay
//   plan      Pit: then the War Hammer's four pieces; Brian: then let's go
//
// THE ENDING ("A Deal's a Deal")
//   freed     the last hammer lands; the Schnitz lets go of Zach
//   deal      the north ledge, the cage over the void: one of you, or they
//             hang there forever
//   step      Rocco steps up to the edge to take a look
//   push      Kearns shoves him off. He's gone
//   cheer     a beat of silence. Then everybody's thrilled
//   release   "...That works." The cage comes down; the boys walk out
//   portal    a portal opens; they all go through (Pit says bye to his forge).
//             Where to, nobody knows
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k;
const lerpV = (a, b, k) => a.clone().lerp(b, k);

// --- a portal: a swirling blue-white disc in a bright ring --------------------------
function portalTexture() {
  const [c, g] = T.makeCanvas(256, 256);
  const grd = g.createRadialGradient(128, 128, 14, 128, 128, 128);
  grd.addColorStop(0, 'rgba(230,255,240,1)'); grd.addColorStop(0.3, 'rgba(110,255,150,0.95)'); grd.addColorStop(0.65, 'rgba(40,160,90,0.55)'); grd.addColorStop(1, 'rgba(20,80,50,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2;
  let s = 9; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < 20; i++) { let a = r() * 6.28, rad = 24; g.beginPath(); g.moveTo(128 + Math.cos(a) * rad, 128 + Math.sin(a) * rad); for (let k = 0; k < 7; k++) { a += 0.35 + (r() - 0.5) * 0.3; rad += 13; g.lineTo(128 + Math.cos(a) * rad, 128 + Math.sin(a) * rad); } g.stroke(); }
  return T.toTexture(c, { repeat: false, srgb: false });
}
let portalTex = null;
function makePortal(radius, color = '#7dffa0') {
  portalTex = portalTex || portalTexture();
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshBasicMaterial({ map: portalTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0, toneMapped: false }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.03, radius * 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, toneMapped: false }));
  g.add(disc, ring);
  g.userData = { disc, ring, open: 0 };
  return g;
}
// open: 0 shut .. 1 wide open
function setPortal(P, open, time) {
  const U = P.userData;
  U.open = open;
  const s = Math.max(0.001, open);
  P.scale.setScalar(s * (1 + Math.sin(time * 7) * 0.02));
  U.disc.material.opacity = Math.min(1, open * 1.4);
  U.ring.material.opacity = Math.min(1, open * 1.6);
  U.disc.rotation.z = time * 1.8;
  P.visible = open > 0.002;
}

// The Schnitz's eyes: two huge green slits in the sky
function makeEyes(tex) {
  const g = new THREE.Group();
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false, color: new THREE.Color(0.7, 2.2, 0.9) }));
    e.scale.set(7, 2.6, 1); e.position.set(s * 5.2, 0, 0); g.add(e);
    return e;
  });
  g.userData.eyes = eyes;
  return g;
}

// Where things are (from the map), filled in when a film starts.
function places(Tr) {
  const F = Tr.sim.mapData.forge;
  return {
    dais: F.y ?? 0.3,
    pit: F.pit, zach: F.zach, cage: F.cage, ledge: F.cage && F.cage.ledge,
    worldCage: Tr.R.forge && Tr.R.forge.cage,
  };
}
const crewFace = (Tr, id, x, z) => Tr.face(id, x, z);
// walk someone from a to b over k (0..1), facing where they're going
function walk(Tr, id, a, b, k, o = {}) {
  const x = lerp(a[0], b[0], k), z = lerp(a[1], b[1], k);
  const A = Tr.pose(id, { x, z, ...o });
  if (k > 0 && k < 1) A.yaw = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
  return A;
}
const camAt = (Tr, x, z, up) => Tr.ground(x, z) + up;
// A slow aerial drift over one island: from c0 to c1, looking from l0 to l1
function tour(c0, c1, l0, l1, fov) {
  return {
    frame(Tr, u, d, k) {
      Tr.far = 600;
      for (const id of ['kearns', 'ryan', 'rocco', 'brian']) Tr.hide(id);
      const e = sm(0, 1, k);
      const c = lerpV(V(...c0), V(...c1), e), l = lerpV(V(...l0), V(...l1), e);
      Tr.light(0.6, '#e8f0ff', [c.x, c.y + 10, c.z]);
      Tr.look(c.x, Math.max(c.y, Tr.ground(c.x, c.z) + 4), c.z, l.x, l.y, l.z, fov);
    },
  };
}

// ============================================================================
// THE INTRO
// ============================================================================
const LAND = { kearns: [-1.8, 5.5], ryan: [-0.6, 6.25], rocco: [0.7, 6.25], brian: [1.9, 5.5] };
const PORTAL_IN = V(0, 6.6, 6.2);

export const INTRO_SHOTS = {
  black: {},

  arrive: {
    enter(Tr) {
      Tr.portal = Tr.prop(makePortal(2.2));
      Tr.portal.position.copy(PORTAL_IN);
      Tr.portal.rotation.x = -Math.PI / 2 + 0.25;   // (facing down onto the dais, tipped toward us)
    },
    frame(Tr, u, d, k) {
      const P = places(Tr);
      const open = sm(0.08, 0.2, k) * (1 - sm(0.82, 0.95, k));
      setPortal(Tr.portal, open, Tr.t);
      if (open > 0.5 && !Tr.flashed) { Tr.flashed = true; Tr.fx.energyBurst(PORTAL_IN.clone(), '#7dffa0', 4); Tr.R.flash = Math.max(Tr.R.flash || 0, 0.3); }
      if (k < 0.05) Tr.flashed = false;
      // out they come, one after another, and hit the deck
      ['kearns', 'ryan', 'rocco', 'brian'].forEach((id, i) => {
        const t0 = 0.26 + i * 0.09, f = sm(t0, t0 + 0.13, k);
        if (k < t0) { Tr.hide(id); return; }
        const [lx, lz] = LAND[id];
        const x = lerp(PORTAL_IN.x + (i - 1.5) * 0.4, lx, f), z = lerp(PORTAL_IN.z, lz, f);
        const y = lerp(PORTAL_IN.y - 0.8, P.dais, f * f);
        const A = Tr.pose(id, { x, z, y, dive: f < 1, crouch: f >= 1 });
        A.yaw = Math.PI + (i - 1.5) * 0.4;
        if (f < 1) A.spin = { x: 1.2 + f * 2.4 + i, y: A.yaw, z: (i - 1.5) * 0.4 };
        if (f >= 1 && !Tr['thud' + i]) { Tr['thud' + i] = true; Tr.fx.puff(V(lx, P.dais + 0.1, lz), { color: 0x8a8070, size: 0.6, grow: 2.2, life: 0.9, alpha: 0.5 }); Tr.shake = Math.max(Tr.shake, 0.6); if (Tr.onCue) Tr.onCue('thud'); }
        if (k < t0 + 0.01) Tr['thud' + i] = false;
      });
      Tr.light(0.9, '#c8ffd8', [2, 9, 14]);
      // from the side of the dais: up at the portal, then down with them as they come out of it
      const look = lerpV(V(0, 5.2, 6.1), V(0, 1.0, 5.9), sm(0.25, 0.7, k));
      Tr.look(lerp(6.0, 5.6, k), camAt(Tr, 5.8, 3.3, 1.2), 3.3, look.x, look.y, look.z, 64);
    },
  },

  getup: {
    frame(Tr, u, d, k) {
      const P = places(Tr);
      ['kearns', 'ryan', 'rocco', 'brian'].forEach((id, i) => {
        const [x, z] = LAND[id];
        const up = sm(0.04 + i * 0.05, 0.22 + i * 0.05, k);
        const A = Tr.pose(id, { x, z, y: P.dais, crouch: up < 0.6, gesture: id === 'rocco' && k > 0.3 && k < 0.6 ? 'point' : null });
        A.yaw = Math.PI + (i - 1.5) * 0.35 + Math.sin(Tr.t * 0.6 + i) * 0.25 * up;
        A.pitch = 0.25 * up;   // (looking up at the sky)
      });
      Tr.light(0.8, '#e0e8ff', [6, 6, 2]);
      Tr.look(lerp(6.2, 5.6, k), camAt(Tr, 6.2, 3.2, 1.5), lerp(3.4, 3.8, k), 0, 1.3, 5.9, 48);
    },
  },

  pit: {
    frame(Tr, u, d, k) {
      const P = places(Tr);
      ['kearns', 'ryan', 'rocco', 'brian'].forEach((id) => {
        const [x, z] = LAND[id];
        Tr.pose(id, { x, z, y: P.dais, gesture: id === 'kearns' && k > 0.3 && k < 0.5 ? 'point' : null });
        crewFace(Tr, id, P.pit.x, P.pit.z);
      });
      Tr.light(0.7, '#ffc898', [-4, 5, 7]);
      // past them onto Pit at his bench, then in on him
      const c = lerpV(V(-0.4, 1.75, 7.0), V(-4.7, 1.65, 4.4), sm(0.1, 0.6, k));
      Tr.look(c.x, Math.max(c.y, camAt(Tr, c.x, c.z, 1.4)), c.z, P.pit.x, P.pit.y + 1.5, P.pit.z, lerp(44, 34, k));
    },
  },

  cage: {
    frame(Tr, u, d, k) {
      const P = places(Tr), C = P.worldCage;
      if (!C) return;
      const f = C.floorPos(V(0, 0, 0));
      Tr.far = 420;
      Tr.light(1.2, '#d8ffe0', [2, 20, -24]);   // (from behind the camera, onto the cage's front)
      // from the north launch deck, a long lens out over the void
      const cz = lerp(-31.5, -33.5, k);
      Tr.look(lerp(1.4, 0.4, k), camAt(Tr, 0.6, cz, 1.6), cz, f.x, f.y + 1.2, f.z, lerp(20, 15, k));
    },
  },

  schnitz: {
    enter(Tr) {
      const P = places(Tr);
      Tr.eyesG = Tr.prop(makeEyes(Tr.glowTex));
      Tr.eyesG.position.set(P.cage.x, P.cage.y + 2.5, P.cage.z - 2);
    },
    frame(Tr, u, d, k) {
      const P = places(Tr), C = P.worldCage;
      if (!C) return;
      const f = C.floorPos(V(0, 0, 0));
      Tr.far = 420;
      // up the chain to the whirl, where its eyes open
      const look = lerpV(V(f.x, f.y + 2, f.z), V(P.cage.x, P.cage.y + 1.5, P.cage.z), sm(0, 0.35, k));
      const e = sm(0.25, 0.4, k) * (0.85 + Math.sin(Tr.t * 9) * 0.1);
      for (const s of Tr.eyesG.userData.eyes) s.material.opacity = e;
      Tr.light(0.6, '#a0ffb0', [P.cage.x, P.cage.y - 6, P.cage.z + 12]);
      Tr.shake = Math.max(Tr.shake, 0.15);
      Tr.look(0.4, camAt(Tr, 0.4, -33.5, 1.6), -33.5, look.x, look.y, look.z, lerp(26, 34, k));
    },
  },

  zach: {
    frame(Tr, u, d, k) {
      Tr.far = 420;
      // out in the dark past the cage, huge, green-lit
      const roar = sm(0.35, 0.5, k) * (1 - sm(0.85, 1, k));
      const Z = Tr.zachAt(0, -84, { y: 6, yaw: 0, size: 3.4, headX: -0.1 - roar * 0.5, lean: 0.25 - roar * 0.35 });
      Tr.zachLight.level = 1;
      if (roar > 0.5 && !Tr.roared) { Tr.roared = true; Tr.fx.energyBurst(V(0, 20, -82), '#5aff70', 6); Tr.shake = 1.2; }
      if (k < 0.1) Tr.roared = false;
      Tr.light(0.5, '#90ffa0', [0, 30, -60]);
      Tr.look(lerp(-1.2, 0.6, k), camAt(Tr, 0, -33.5, 1.6), -33.5, 0, 17, -84, lerp(40, 34, k));
    },
  },

  // Pit names the islands: a long slow look at each from the air, its titan asleep
  tour_ship: tour([30, 30, -110], [18, 26, -118], [0, 2, -178], [6, 0, -190], 52),
  tour_research: tour([122, 9, 3], [119, 7, -4], [114, 4.5, -20], [114, 5, -21], 50),
  tour_trench: tour([-30, 24, 112], [-24, 21, 108], [6, 2, 148], [18, 0, 138], 54),
  tour_caves: tour([-149, 33, -27], [-152, 30, -30], [-165, 12, -37], [-166, 12, -39], 46),

  // the north launcher, dead, its junction box spitting sparks
  relays: {
    frame(Tr, u, d, k) {
      const r = Tr.sim.mapData.relays && Tr.sim.mapData.relays[0];
      if (!r) return;
      for (const id of ['kearns', 'ryan', 'rocco', 'brian']) Tr.hide(id);
      Tr.light(0.7, '#c8d8ff', [r.x + 3, r.y + 4, r.z + 2]);
      const c = lerpV(V(r.x + 1.6, r.y + 1.5, r.z + 0.8), V(r.x + 3.6, r.y + 2.2, r.z + 3.4), sm(0.05, 0.9, k));
      const l = lerpV(V(r.x, r.y + 1.3, r.z), V(r.x + 1.5, r.y + 0.9, r.z - 0.6), sm(0.05, 0.9, k));
      Tr.look(c.x, c.y, c.z, l.x, l.y, l.z, lerp(40, 52, k));
    },
  },

  plan: {
    frame(Tr, u, d, k) {
      const P = places(Tr);
      ['kearns', 'ryan', 'rocco', 'brian'].forEach((id) => {
        const [x, z] = LAND[id];
        Tr.pose(id, { x, z, y: P.dais });
        crewFace(Tr, id, P.pit.x, P.pit.z);
      });
      if (k > 0.55) { Tr.face('brian', 0, 30); }
      Tr.light(0.8, '#ffd0a8', [-5, 6, 8]);
      Tr.look(lerp(-5.2, -4.6, k), camAt(Tr, -5.2, 6.4, 1.55), 6.4, 0.2, 1.4, 5.7, 44);
    },
  },
};

// ============================================================================
// THE ENDING
// ============================================================================
const ROW = { pit: -3.6, kearns: -2.2, ryan: -0.8, rocco: 0.6, brian: 2.0, zach: 3.4 };   // x along the ledge
const ROWZ = -41.8;
const ELEMENTS = { kearns: 'fire', ryan: 'wind', rocco: 'ice', brian: 'lightning' };

export const ENDING_SHOTS = {
  black: {},

  freed: {
    frame(Tr, u, d, k) {
      const P = places(Tr), zx = P.zach.x, zz = P.zach.z;
      const around = { kearns: [6.0, 3.2], ryan: [6.2, -3.4], rocco: [12.8, 3.6], brian: [13.0, -3.0] };
      for (const [id, [x, z]] of Object.entries(around)) {
        Tr.pose(id, { x, z, unarmed: false });
        Tr.giveHammer(id, ELEMENTS[id]);
        crewFace(Tr, id, zx, zz);
      }
      // the Schnitz tears itself out of him and he's just Zach again
      const out = sm(0.25, 0.5, k);
      if (out < 1) {
        // hunched over, head down, shrinking as it leaves him
        Tr.zachAt(zx, zz, { yaw: Math.atan2(-0.5 - zx, 9.5 - zz), size: lerp(1.7, 0.6, out), headX: 0.45, lean: 0.6 });
        Tr.zachLight.level = 1 - out;
        Tr.hide('zach');
      } else {
        Tr.zach.root.visible = false;
        const A = Tr.pose('zach', { x: zx, z: zz, unarmed: true, gesture: k > 0.6 ? 'point' : null });
        Tr.face('zach', 2.5, 7);
        A.pitch = 0.1;
      }
      if (out > 0.2 && !Tr.tore) { Tr.tore = true; Tr.fx.energyBurst(V(zx, 3, zz), '#5aff70', 7); Tr.R.flash = Math.max(Tr.R.flash || 0, 0.5); Tr.shake = 1.4; if (Tr.onCue) Tr.onCue('tear'); }
      if (k < 0.1) Tr.tore = false;
      Tr.light(0.8, '#c0ffc8', [zx - 4, 7, zz + 6]);
      Tr.look(lerp(2.3, 2.8, k), camAt(Tr, 2.5, 4.8, 1.7), 4.8, zx, lerp(3.2, 1.4, out), zz, 50);
    },
  },

  deal: {
    frame(Tr, u, d, k) {
      const P = places(Tr), C = P.worldCage;
      Tr.far = 420;
      for (const [id, x] of Object.entries(ROW)) { Tr.pose(id, { x, z: ROWZ, gesture: id === 'ryan' && k > 0.6 ? 'point' : null }); Tr.face(id, x * 0.3, -60); }
      if (k > 0.65) Tr.face('ryan', ROW.kearns, ROWZ);
      Tr.light(1.1, '#d0e4ff', [3, 6, -52]);
      // from out over the void, looking back at them on the ledge (the cage is behind us)
      Tr.look(lerp(3.4, 2.6, k), 1.3, -48.2, 0.2, 1.9, -41.8, lerp(48, 42, k));
    },
  },

  step: {
    frame(Tr, u, d, k) {
      for (const [id, x] of Object.entries(ROW)) if (id !== 'rocco' && id !== 'kearns') { Tr.pose(id, { x, z: ROWZ }); Tr.face(id, 1, -46); }
      walk(Tr, 'rocco', [ROW.rocco, ROWZ], [0.2, -43.8], sm(0.05, 0.45, k));
      if (k >= 0.45) { Tr.crew.rocco.yaw = 0; Tr.crew.rocco.pitch = -0.6; }   // (looking down over the edge)
      walk(Tr, 'kearns', [ROW.kearns, ROWZ], [0.2, -42.4], sm(0.55, 0.95, k));
      Tr.light(0.8, '#d8e4ff', [6, 6, -40]);
      Tr.look(lerp(6.4, 5.6, k), camAt(Tr, 6.4, -42.6, 1.25), -42.6, 0.8, 1.5, -43.2, 42);
    },
  },

  push: {
    frame(Tr, u, d, k) {
      for (const [id, x] of Object.entries(ROW)) if (id !== 'rocco' && id !== 'kearns') { Tr.pose(id, { x, z: ROWZ }); Tr.face(id, 1, -46); }
      // the shove
      const lunge = sm(0.08, 0.18, k), back = sm(0.4, 0.7, k);
      Tr.pose('kearns', { x: lerp(0.2, 0.3, lunge) - back * 0.3, z: lerp(-42.4, -43.2, lunge) + back * 0.5, gesture: k > 0.06 && k < 0.35 ? 'reach' : null });
      Tr.crew.kearns.yaw = 0;
      // and over he goes, arms going, down and away into the dark
      const f = Math.max(0, (k - 0.14) / 0.86);
      const tt = f * d * 0.86;
      const A = Tr.pose('rocco', { x: 0.2 + tt * 0.1, z: -43.8 - Math.min(3, tt * 2.8) - tt * 0.3, y: 0.8 + tt * 1.5 - 1.6 * tt * tt, gesture: f > 0 ? 'flail' : null });
      A.yaw = 0;
      if (f > 0) A.spin = { x: 0.6 + tt * 2.2, y: 0, z: Math.sin(tt * 3) * 0.4 };
      if (f > 0 && !Tr.shoved) { Tr.shoved = true; if (Tr.onCue) Tr.onCue('shove'); }
      if (k < 0.05) Tr.shoved = false;
      Tr.light(0.8, '#d8e4ff', [5, 6, -40]);
      // side on as it happens; then down after him: the camera drops with him a
      // moment, then lets him go, tumbling away into the dark
      const r = Tr.crew.rocco.pos;
      if (k <= 0.34) Tr.look(5.6, camAt(Tr, 5.6, -42.6, 1.25), -42.6, 0.4, 1.4, -43.6, 42);
      else {
        const hold = Math.min(tt, 2.2), hy = 0.8 + hold * 1.5 - 1.6 * hold * hold;
        Tr.look(r.x + 2.4, hy + 3.4, -52, r.x, r.y + 0.7, r.z, 46);
        Tr.light(1.1, '#e0e8ff', [r.x + 4, hy + 6, -40]);
      }
    },
  },

  cheer: {
    frame(Tr, u, d, k) {
      Tr.hide('rocco');
      const go = k > 0.3;
      for (const [id, x] of Object.entries(ROW)) {
        if (id === 'rocco') continue;
        Tr.pose(id, { x: id === 'kearns' ? 0.5 : x, z: id === 'kearns' ? -42.7 : ROWZ, gesture: go ? 'cheer' : null });
        Tr.face(id, 0.5, -49);
        Tr.crew[id].pitch = go ? -0.15 : 0.35;
      }
      Tr.light(0.9, '#ffe8c8', [0, 6, -48]);
      // out over the void, looking back at them
      Tr.look(lerp(0.4, 0.8, k), 2.4, -49.5, 0.2, 1.6, -42, lerp(46, 40, k));
    },
  },

  release: {
    frame(Tr, u, d, k) {
      const P = places(Tr), C = P.worldCage;
      Tr.far = 420;
      if (!C) return;
      C.held = true;
      // the cage comes down out of the dark and sets down on the ledge
      const L = Tr.cfg.crust.cage, H = L.size[1];
      const down = sm(0.08, 0.55, k);
      const top = V(P.cage.x, P.cage.y, P.cage.z), set = V(P.ledge.x, P.ledge.y + C.len + H + 0.3, P.ledge.z);
      C.pivot.position.copy(lerpV(top, set, down));
      C.sway = 1 - down;
      C.doorOpen = sm(0.62, 0.72, k);
      C.update(Tr.dt, Tr.t);
      // everyone backs up the slope out of its way
      for (const [id, x] of Object.entries(ROW)) {
        if (id === 'rocco') continue;
        Tr.pose(id, { x: x * 1.25, z: lerp(id === 'kearns' ? -42.7 : ROWZ, -39.2, sm(0.05, 0.35, k)) });
        Tr.face(id, 0, -43);
      }
      // the boys walk out
      const free = k > 0.7;
      for (const b of C.boys) b.k.root.visible = !free;
      const boys = { chops: [-0.7, -1.8], regs: [0.1, -0.2], p: [0.9, 1.6] };
      for (const [id, [x0, xe]] of Object.entries(boys)) {
        if (!free) { Tr.hide(id); continue; }
        const f = sm(0.7 + (id === 'regs' ? 0.04 : id === 'p' ? 0.08 : 0), 0.95, k);
        walk(Tr, id, [x0, P.ledge.z], [xe, -40.6], f);
        if (f >= 1) Tr.face(id, 0, -38);
      }
      Tr.light(0.9, '#c8ffd8', [6, 7, -38]);
      Tr.look(lerp(7.6, 6.6, k), camAt(Tr, 7.6, -37.6, 1.6), -37.6, 0, lerp(8, 1.6, down), lerp(-48, -42, down), 50);
    },
  },

  portal: {
    enter(Tr) {
      Tr.portal = Tr.prop(makePortal(1.6));
      Tr.portal.position.set(-6.2, 2.4, -40.8);
      Tr.portal.rotation.y = Math.PI / 2;   // (facing along the ledge)
    },
    frame(Tr, u, d, k) {
      const P = places(Tr), C = P.worldCage;
      if (C) { C.held = true; C.update(Tr.dt, Tr.t); for (const b of C.boys) b.k.root.visible = false; }
      const open = sm(0.02, 0.12, k) * (1 - sm(0.8, 0.9, k));
      setPortal(Tr.portal, open, Tr.t);
      if (open > 0.5 && !Tr.flashed) { Tr.flashed = true; Tr.fx.energyBurst(Tr.portal.position.clone(), '#7dffa0', 3); if (Tr.onCue) Tr.onCue('portal'); }
      if (k < 0.02) Tr.flashed = false;
      // in they go, one by one
      const order = ['brian', 'ryan', 'chops', 'regs', 'p', 'zach', 'pit', 'kearns'];
      const from = { pit: [ROW.pit * 1.25, -39.2], kearns: [ROW.kearns * 1.25, -39.2], ryan: [ROW.ryan * 1.25, -39.2], brian: [ROW.brian * 1.25, -39.2], zach: [ROW.zach * 1.25, -39.2], chops: [-1.8, -40.6], regs: [-0.2, -40.6], p: [1.6, -40.6] };
      order.forEach((id, i) => {
        const t0 = 0.12 + i * 0.07, f = sm(t0, t0 + 0.16, k);
        if (f >= 1) { Tr.hide(id); return; }
        const [x, z] = from[id];
        walk(Tr, id, [x, z], [-6.0, -40.8], f, { gesture: id === 'kearns' && f > 0.4 ? 'point' : null });
        if (f <= 0) Tr.face(id, -6, -40.8);
      });
      Tr.light(0.9, '#b0ffc8', [-3, 5, -37]);
      Tr.look(lerp(3.6, 2.4, k), camAt(Tr, 3.6, -36.8, 1.7), -36.8, -3.4, 1.7, -41, lerp(52, 46, k));
    },
  },
};

// Hand the world's cage back as it was (and the boys in it) when a film ends.
export function restoreCage(Tr) {
  const C = Tr.R.forge && Tr.R.forge.cage, P = Tr.sim.mapData.forge.cage;
  if (!C || !P) return;
  C.held = false; C.sway = 1; C.doorOpen = 0;
  C.pivot.position.set(P.x, P.y, P.z);
  for (const b of C.boys) b.k.root.visible = true;
}
