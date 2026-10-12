// =============================================================================
// Call of the Crust: the snow world round the map. An open night sky full of
// stars, a galaxy band and planets; snow falling all the time; snowy cliffs,
// hills and pine forest; the frozen sea to the north with a ship stuck in it;
// the lighthouse on its point; and, out across the ice, four red-and-white
// smokestacks on a lit-up power plant. Also dresses the rooms: snow on the
// cliff tops, sandbags and wire along the trenches, roofs on the huts, and
// the props (the truck, crates, fire barrels, rocks, pines, the boat...).
//
// mapView calls crustMaterials() while it builds its materials and
// buildCrust() in place of the school's exterior; update() runs every frame.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';
import * as CT from './crustTextures.js';

const R = (s) => { let x = s >>> 0 || 1; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; };

// --- textures -----------------------------------------------------------------------
function snowTexture() {
  const S = 512, [c, g] = T.makeCanvas(S, S), r = R(41);
  g.fillStyle = '#c3ccd9'; g.fillRect(0, 0, S, S);
  const n = T.noiseCanvas(S, 5, 6);
  g.globalAlpha = 0.22; g.drawImage(n, 0, 0); g.globalAlpha = 1;
  // wind ripples and footprints-ish dimples
  for (let i = 0; i < 260; i++) {
    const x = r() * S, y = r() * S, w = 10 + r() * 40;
    g.fillStyle = `rgba(150,170,200,${0.05 + r() * 0.08})`;
    g.beginPath(); g.ellipse(x, y, w, w * 0.18, 0.3, 0, 7); g.fill();
  }
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.5})`; g.fillRect(r() * S, r() * S, 1, 1); }
  const t = T.toTexture(c); t.repeat.set(0.25, 0.25);
  return t;
}

function cliffTexture() {
  const W = 512, H = 512, [c, g] = T.makeCanvas(W, H), r = R(77);
  g.fillStyle = '#4a5058'; g.fillRect(0, 0, W, H);
  const n = T.noiseCanvas(W, 6, 3);
  g.globalAlpha = 0.5; g.drawImage(n, 0, 0); g.globalAlpha = 1;
  // rock strata and cracks
  for (let i = 0; i < 40; i++) {
    let x = r() * W, y = r() * H; g.strokeStyle = `rgba(20,24,30,${0.3 + r() * 0.4})`; g.lineWidth = 1 + r() * 3;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (r() - 0.3) * 40; y += (r() - 0.5) * 18; g.lineTo(x, y); }
    g.stroke();
  }
  // snow caught on the ledges
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = r() * H, w = 20 + r() * 70;
    g.fillStyle = `rgba(225,232,242,${0.2 + r() * 0.3})`;
    g.beginPath(); g.ellipse(x, y, w, 2 + r() * 4, (r() - 0.5) * 0.3, 0, 7); g.fill();
  }
  // frost at the top
  const grd = g.createLinearGradient(0, 0, 0, H * 0.25);
  grd.addColorStop(0, 'rgba(230,236,246,0.9)'); grd.addColorStop(1, 'rgba(230,236,246,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H * 0.25);
  const t = T.toTexture(c); t.repeat.set(1 / 7, 1 / 7);
  return t;
}

// Round logs stacked up, dark chinking between them; snow on the ledges.
function logTexture() {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(57);
  const rows = 8, rh = S / rows;
  g.fillStyle = '#1a120c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < rows; i++) {
    const k = 0.8 + r() * 0.3;
    const gr = g.createLinearGradient(0, i * rh, 0, (i + 1) * rh);
    gr.addColorStop(0, `rgb(${70 * k},${52 * k},${36 * k})`); gr.addColorStop(0.45, `rgb(${110 * k},${84 * k},${58 * k})`); gr.addColorStop(1, `rgb(${46 * k},${33 * k},${22 * k})`);
    g.fillStyle = gr; g.fillRect(0, i * rh + 1.5, S, rh - 3);
    for (let j = 0; j < 6; j++) { g.strokeStyle = `rgba(30,18,10,${0.15 + r() * 0.2})`; g.lineWidth = 0.8; const y = i * rh + 4 + r() * (rh - 8); g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + (r() - 0.5) * 3); g.stroke(); }
    for (let x = 0; x < S; x += 3) { g.fillStyle = `rgba(225,232,242,${r() * 0.35})`; g.fillRect(x, i * rh + 1.5, 3, 1 + r() * 2); }
  }
  return T.toTexture(c);
}

// A rusted, riveted steel hull plate.
function hullTexture() {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(63);
  g.fillStyle = '#3c3836'; g.fillRect(0, 0, S, S);
  const n = T.noiseCanvas(S, 5, 4); g.globalAlpha = 0.35; g.drawImage(n, 0, 0); g.globalAlpha = 1;
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${110 + r() * 40},${50 + r() * 20},20,${0.1 + r() * 0.25})`; g.beginPath(); g.ellipse(r() * S, r() * S, 4 + r() * 24, 3 + r() * 10, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S; const gr = g.createLinearGradient(0, y, 0, y + 60); gr.addColorStop(0, 'rgba(120,56,24,0.35)'); gr.addColorStop(1, 'rgba(120,56,24,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + r() * 3, 60); }
  g.fillStyle = 'rgba(0,0,0,0.5)';
  for (const y of [0, 128]) g.fillRect(0, y, S, 3);
  for (const x of [0, 170]) g.fillRect(x, 0, 3, S);
  g.fillStyle = 'rgba(200,190,170,0.25)';
  for (const y of [6, 134]) for (let x = 4; x < S; x += 12) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
  return T.toTexture(c);
}

// Sea ice: dark, cracked, with snow drifting over it.
function iceTexture() {
  const [c, g] = T.makeCanvas(512, 512), rr = R(3);
  g.fillStyle = '#4c6276'; g.fillRect(0, 0, 512, 512);
  const n = T.noiseCanvas(512, 5, 4); g.globalAlpha = 0.25; g.drawImage(n, 0, 0); g.globalAlpha = 1;
  for (let i = 0; i < 60; i++) {
    let x = rr() * 512, y = rr() * 512; g.strokeStyle = `rgba(210,230,245,${0.2 + rr() * 0.3})`; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rr() - 0.5) * 70; y += (rr() - 0.5) * 70; g.lineTo(x, y); } g.stroke();
  }
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(220,230,240,${0.06 + rr() * 0.18})`; g.beginPath(); g.ellipse(rr() * 512, rr() * 512, 10 + rr() * 50, 4 + rr() * 16, rr() * 3, 0, 7); g.fill(); }
  return T.toTexture(c);
}

// The night sky, wrapped round the world (equirectangular): stars, a galaxy
// band with nebulae, and a horizon that fades into the fog.
function skyTexture(fog) {
  const W = 2048, H = 1024, [c, g] = T.makeCanvas(W, H), r = R(2024);
  const sky = g.createLinearGradient(0, 0, 0, H / 2);
  sky.addColorStop(0, '#03040a'); sky.addColorStop(0.55, '#070b18'); sky.addColorStop(0.88, '#111a2c'); sky.addColorStop(1, fog);
  g.fillStyle = sky; g.fillRect(0, 0, W, H / 2);
  g.fillStyle = fog; g.fillRect(0, H / 2, W, H / 2);
  const band = (x) => H * 0.24 + Math.sin(x / W * Math.PI * 2 + 0.6) * H * 0.13;
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 1400; i++) {
    const x = r() * W, y = band(x) + (r() - 0.5) * (40 + r() * 120), rad = 8 + r() * 46;
    const col = r() < 0.45 ? [120, 90, 255] : r() < 0.6 ? [255, 110, 170] : r() < 0.5 ? [90, 210, 255] : [255, 230, 200];
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${col},${0.05 + r() * 0.06})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (const [x, y, rad, col] of [[300, 180, 260, '150,60,220'], [1300, 120, 300, '40,150,220'], [1750, 260, 220, '230,70,140'], [820, 300, 200, '60,200,190']]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${col},0.22)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = band(x) + (r() - 0.5) * 30, rad = 10 + r() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(4,4,10,0.35)'); gr.addColorStop(1, 'rgba(4,4,10,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 9000; i++) {
    const x = r() * W;
    const y = r() < 0.4 ? band(x) + (r() - 0.5) * 140 : r() * H * 0.48;
    const b = r(), s = b > 0.995 ? 2.4 : b > 0.96 ? 1.5 : 0.9;
    const tint = r() < 0.15 ? '200,220,255' : r() < 0.1 ? '255,220,190' : '255,255,255';
    g.fillStyle = `rgba(${tint},${0.35 + r() * 0.65 * (1 - y / (H * 0.55))})`;
    g.fillRect(x, y, s, s);
    if (b > 0.997) { g.fillStyle = `rgba(${tint},0.25)`; g.fillRect(x - 3, y + s / 2, 6 + s, 0.8); g.fillRect(x + s / 2, y - 3, 0.8, 6 + s); }
  }
  return T.toTexture(c, { repeat: false });
}

// A planet face: colour bands, craters or swirls, lit from one side.
function planetTexture(kind) {
  const S = 512, [c, g] = T.makeCanvas(S, S), r = R(kind.length * 97);
  const pal = { ringed: ['#cfe6ff', '#8fa8e8', '#5a4fb0', '#2a2050'], red: ['#ffb08a', '#c4502c', '#7a2810', '#2a0a04'], moon: ['#eef2f6', '#b8c0c8', '#7a8590', '#30363e'] }[kind];
  const gr = g.createRadialGradient(S * 0.36, S * 0.34, S * 0.05, S * 0.5, S * 0.5, S * 0.52);
  gr.addColorStop(0, pal[0]); gr.addColorStop(0.45, pal[1]); gr.addColorStop(0.8, pal[2]); gr.addColorStop(1, pal[3]);
  g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.fill();
  g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.clip();
  if (kind === 'ringed') {
    for (let i = 0; i < 18; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(40,20,90,0.14)'; g.fillRect(0, i * S / 18 + r() * 8, S, 6 + r() * 18); }
    g.fillStyle = 'rgba(255,190,230,0.25)'; g.beginPath(); g.ellipse(S * 0.62, S * 0.6, 40, 20, 0, 0, 7); g.fill();
  } else {
    for (let i = 0; i < (kind === 'moon' ? 40 : 18); i++) {
      const x = r() * S, y = r() * S, cr = 6 + r() * (kind === 'moon' ? 28 : 18);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(x, y, cr, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2; g.beginPath(); g.arc(x - 1, y - 1, cr, 3.6, 5.6); g.stroke();
    }
  }
  const sh = g.createRadialGradient(S * 0.32, S * 0.3, S * 0.25, S * 0.4, S * 0.4, S * 0.78);
  sh.addColorStop(0, 'rgba(0,0,8,0)'); sh.addColorStop(1, 'rgba(0,0,8,0.85)');
  g.fillStyle = sh; g.fillRect(0, 0, S, S);
  g.restore();
  return T.toTexture(c, { repeat: false });
}

function ringTexture() {
  const [c, g] = T.makeCanvas(512, 8), r = R(5);
  for (let x = 0; x < 512; x++) {
    const k = x / 512;
    const a = (0.25 + r() * 0.5) * Math.sin(k * Math.PI) * (x % 37 < 4 ? 0.3 : 1);
    g.fillStyle = `rgba(${200 + r() * 40},${190 + r() * 40},255,${a})`; g.fillRect(x, 0, 1, 8);
  }
  return T.toTexture(c, { repeat: false });
}

// White stack with red bands at the top and a dark sooty cap; streaks of grime.
function stackTexture(seed) {
  const W = 64, H = 1024, [c, g] = T.makeCanvas(W, H), r = R(seed);
  g.fillStyle = '#e8e6e0'; g.fillRect(0, 0, W, H);
  const bands = [[0, 0.018, '#3a2a24'], [0.018, 0.06, '#e8e6e0'], [0.06, 0.1, '#a3202a'], [0.1, 0.15, '#e8e6e0'], [0.15, 0.19, '#a3202a'], [0.19, 0.25, '#e8e6e0'], [0.25, 0.3, '#a3202a']];
  for (const [a, b, col] of bands) { g.fillStyle = col; g.fillRect(0, a * H, W, (b - a) * H); }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (const y of [0.1, 0.25, 0.42, 0.6, 0.8]) g.fillRect(0, y * H, W, 2);
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = 0.02 * H + r() * H * 0.5, len = 20 + r() * 260;
    const gr = g.createLinearGradient(0, y, 0, y + len);
    gr.addColorStop(0, `rgba(60,40,30,${0.15 + r() * 0.25})`); gr.addColorStop(1, 'rgba(60,40,30,0)');
    g.fillStyle = gr; g.fillRect(x, y, 1 + r() * 2.5, len);
  }
  return T.toTexture(c, { repeat: false });
}

// The lighthouse: white with two red bands, weathered.
function lighthouseTexture() {
  const W = 128, H = 1024, [c, g] = T.makeCanvas(W, H), r = R(71);
  g.fillStyle = '#dcdad2'; g.fillRect(0, 0, W, H);
  for (const [a, b] of [[0.12, 0.3], [0.52, 0.7]]) { g.fillStyle = '#9a2228'; g.fillRect(0, a * H, W, (b - a) * H); }
  for (let i = 0; i < 80; i++) { const x = r() * W, y = r() * H, len = 20 + r() * 160; const gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, `rgba(70,60,50,${0.1 + r() * 0.2})`); gr.addColorStop(1, 'rgba(70,60,50,0)'); g.fillStyle = gr; g.fillRect(x, y, 1 + r() * 2, len); }
  g.fillStyle = '#1c1f24';
  for (const y of [0.36, 0.78]) g.fillRect(W * 0.45, y * H, W * 0.1, H * 0.035);
  return T.toTexture(c, { repeat: false });
}

// The plant's brown boiler houses: corrugated panels.
function buildingTexture(seed) {
  const W = 256, H = 512, [c, g] = T.makeCanvas(W, H), r = R(seed);
  g.fillStyle = '#9a6e48'; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 4) { g.fillStyle = x % 8 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'; g.fillRect(x, 0, 2, H); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(40,25,15,${0.08 + r() * 0.15})`; g.fillRect(r() * W, r() * H, 1 + r() * 4, 30 + r() * 200); }
  for (let y = 0; y < H; y += 64) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y, W, 2); }
  return T.toTexture(c, { repeat: false });
}

function signTexture(lines) {
  const [c, g] = T.makeCanvas(512, 256);
  g.fillStyle = '#5a3a20'; g.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y += 32) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, 512, 2); }
  g.fillStyle = '#f1e7cf'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 64px Impact, "Arial Black", sans-serif'; g.fillText(lines[0], 230, 86, 400);
  g.font = '700 34px "Arial Narrow", Arial, sans-serif'; g.fillText(lines[1] || '', 256, 176, 470);
  g.beginPath(); g.moveTo(456, 60); g.lineTo(500, 86); g.lineTo(456, 112); g.closePath(); g.fill();
  g.fillRect(420, 78, 40, 16);
  g.fillStyle = 'rgba(240,244,250,0.9)'; for (let x = 0; x < 512; x += 12) g.fillRect(x, 0, 12, 6 + Math.random() * 10);
  return T.toTexture(c, { repeat: false });
}

// --- materials (called from mapView.buildMaterials) --------------------------------------
// Floors: snow, ice (the lagoon), duckboards (trenches), deck plate (the hold).
// Walls: cliff, trench (plank revetment), cabin (logs), hull (riveted steel).
export function crustMaterials(M, wallMats, applyBake) {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.95, ...o });
  const rep = (t, s) => { t.repeat.set(s, s); return t; };
  const snow = std({ map: snowTexture(), color: '#b4bece' });
  snow.bumpMap = snow.map; snow.bumpScale = 1.2;
  M.snow = applyBake(snow);
  M.ice = applyBake(std({ map: rep(iceTexture(), 1 / 8), roughness: 0.55, metalness: 0.1, color: '#c4ccd8' }));
  M.duckboard = applyBake(std({ map: rep(CT.boardsTexture({ seed: 6, base: [84, 66, 46] }), 1 / 1.6) }));
  M.deck = applyBake(std({ map: rep(hullTexture(), 1 / 2.5), roughness: 0.8, metalness: 0.3 }));
  M.planks = applyBake(std({ map: rep(CT.boardsTexture({ seed: 9, base: [58, 44, 30] }), 1 / 2) }));
  M.hullCeil = applyBake(std({ map: rep(hullTexture(), 1 / 3), roughness: 0.85, metalness: 0.3, color: '#8a8480' }));
  const cliff = std({ map: cliffTexture(), roughness: 1 });
  cliff.bumpMap = cliff.map; cliff.bumpScale = 3;
  wallMats.cliff = applyBake(cliff);
  wallMats.trench = applyBake(std({ map: rep(CT.boardsTexture({ seed: 4, base: [76, 60, 42] }), 1 / 2.4) }));
  wallMats.cabin = applyBake(std({ map: rep(logTexture(), 1 / 2.2) }));
  wallMats.hull = applyBake(std({ map: rep(hullTexture(), 1 / 3), roughness: 0.8, metalness: 0.35 }));
}

// --- the world --------------------------------------------------------------------------
export function buildCrust(mv) {
  const map = mv.map, group = mv.group, world = mv.world;
  const fog = map.fog ? map.fog.color : '#1c2534';
  const out = { mv, fires: [], beams: [], smoke: [] };
  const r = R(9);
  const mats = {
    snow: new THREE.MeshStandardMaterial({ color: '#d8e0ec', roughness: 0.95, emissive: new THREE.Color('#202a3c'), emissiveIntensity: 1 }),
    snowCap: new THREE.MeshStandardMaterial({ color: '#eef2f8', roughness: 0.9, emissive: new THREE.Color('#141a26') }),
    rock: new THREE.MeshStandardMaterial({ color: '#4c525a', roughness: 1, flatShading: true }),
    pine: new THREE.MeshStandardMaterial({ color: '#1e3326', roughness: 1, emissive: new THREE.Color('#05080a') }),
    bark: new THREE.MeshStandardMaterial({ color: '#2c2118', roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.95 }),
    darkWood: new THREE.MeshStandardMaterial({ color: '#2a1e14', roughness: 1 }),
    sandbag: new THREE.MeshStandardMaterial({ map: CT.sandbagTexture(), roughness: 1 }),
    iron: new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.6, metalness: 0.6 }),
    hull: new THREE.MeshStandardMaterial({ map: hullTexture(), roughness: 0.8, metalness: 0.35 }),
    hullRed: new THREE.MeshStandardMaterial({ color: '#5a1c18', roughness: 0.85, metalness: 0.2 }),
    paint: new THREE.MeshStandardMaterial({ color: '#c8c4b8', roughness: 0.85 }),
    wire: new THREE.LineBasicMaterial({ color: '#16161a' }),
    ice: new THREE.MeshStandardMaterial({ color: '#9ec4dc', roughness: 0.25, metalness: 0.05, emissive: new THREE.Color('#123048'), transparent: true, opacity: 0.92, flatShading: true }),
    window: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.1, 0.55) }),
  };
  out.mats = mats;

  // the footprint of the map (everything inside it is flat)
  const B = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (const rm of map.rooms) { const [a, b, c, d] = rm.rect; B.x0 = Math.min(B.x0, a); B.z0 = Math.min(B.z0, b); B.x1 = Math.max(B.x1, c); B.z1 = Math.max(B.z1, d); }
  const sea = map.seaEdge ?? -84;
  const inRoom = (x, z, pad = 0) => map.rooms.some((rm) => x > rm.rect[0] - pad && x < rm.rect[2] + pad && z > rm.rect[1] - pad && z < rm.rect[3] + pad);

  buildSky(out, group, fog);
  buildGround(out, group, B, sea, mats);
  buildCliffs(out, group, world, map, r, mats);
  buildTrenches(group, world, map, r, mats);
  buildRoofs(out, group, map, mats);
  buildShip(out, group, map, r, mats);
  buildForest(out, group, B, sea, r, mats, inRoom);
  buildFar(out, group, map, r);
  buildProps(out, group, world, r, mats, mv);
  buildSnow(out, group, r);
  // slush on the lagoon (it slows you down): dark wet patches on the ice
  if (map.mud) {
    const slush = new THREE.MeshStandardMaterial({ color: '#3c4650', roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const m of map.mud) {
      const g = new THREE.CircleGeometry(m.r, 28).rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 1; i < p.count; i++) { const k = 0.85 + r() * 0.25; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
      const mesh = new THREE.Mesh(g, slush); mesh.position.set(m.x, 0.012, m.z); group.add(mesh);
    }
  }

  out.update = (dt, eye, time) => updateCrust(out, dt, eye, time);
  return out;
}

// --- the sky: a dome that follows the camera, with planets in it ---------------------------
function buildSky(out, group, fog) {
  const sky = new THREE.Group();
  sky.renderOrder = -10;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(205, 64, 32), new THREE.MeshBasicMaterial({ map: skyTexture(fog), side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -10;
  sky.add(dome);
  const planet = (kind, dir, size, ring = false) => {
    const d = new THREE.Vector3(...dir).normalize().multiplyScalar(190);
    const m = new THREE.Mesh(new THREE.CircleGeometry(size, 48), new THREE.MeshBasicMaterial({ map: planetTexture(kind), transparent: true, fog: false, depthWrite: false }));
    m.position.copy(d); m.lookAt(0, 0, 0);
    m.renderOrder = -9;
    sky.add(m);
    if (ring) {
      const rg = new THREE.Mesh(new THREE.RingGeometry(size * 1.35, size * 2.3, 96, 1), new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, side: THREE.DoubleSide, fog: false, depthWrite: false }));
      const uv = rg.geometry.attributes.uv, p = rg.geometry.attributes.position;
      for (let i = 0; i < uv.count; i++) { const rr = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (rr - size * 1.35) / (size * 0.95), 0.5); }
      rg.position.copy(d); rg.lookAt(0, 0, 0); rg.rotateX(1.15); rg.rotateZ(-0.35);
      rg.renderOrder = -9;
      sky.add(rg);
    }
  };
  planet('ringed', [0.75, 0.42, -0.6], 26, true);      // big ringed ice giant over the north-east
  planet('red', [-0.6, 0.7, -0.35], 9);                // a small red world high in the west
  planet('moon', [-0.35, 0.3, 0.88], 14);              // a cratered moon behind you
  group.add(sky);
  out.sky = sky;
  // moonlight for the things that aren't baked (zombies, props)
  const moon = new THREE.DirectionalLight(0x9fb4e0, 0.55);
  moon.position.set(-0.35, 0.6, 0.7).multiplyScalar(50);
  group.add(moon); group.add(moon.target);
}

// --- the ground: flat under the map, rolling into hills round it; the frozen sea north ----
function buildGround(out, group, B, sea, mats) {
  const cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  const size = 600, seg = 120;
  const ground = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const gp = ground.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i) + cx, z = gp.getZ(i) + cz;
    gp.setX(i, x); gp.setZ(i, z);
    const dx = Math.max(B.x0 - 4 - x, x - B.x1 - 4, 0), dz = Math.max(z - B.z1 - 4, 0);
    const edge = Math.hypot(dx, dz);
    let h = 0;
    if (z > sea + 2 && edge > 0) {
      h = (Math.sin(x * 0.05) * Math.cos(z * 0.043) * 0.5 + 0.5) * 12 + Math.sin(x * 0.13 + z * 0.07) * 1.5 + 4;
      h *= Math.min(1, edge / 22);
      h *= Math.min(1, (z - sea - 2) / 18);   // down to the shore
    }
    gp.setY(i, Math.max(0, h) - 0.04);
  }
  ground.computeVertexNormals();
  group.add(new THREE.Mesh(ground, mats.snow));
  out.groundAt = (x, z) => {
    const step = size / seg;
    const ix = Math.round((x - cx + size / 2) / step), iz = Math.round((z - cz + size / 2) / step);
    if (ix < 0 || iz < 0 || ix > seg || iz > seg) return 0;
    return gp.getY(iz * (seg + 1) + ix);
  };
  // the frozen sea
  const it = iceTexture(); it.repeat.set(20, 10);
  const ice = new THREE.Mesh(new THREE.PlaneGeometry(600, 300).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: it, roughness: 0.6, metalness: 0.1, emissive: new THREE.Color('#0e1622') }));
  ice.position.set(cx, -0.02, sea - 150);
  group.add(ice);
}

// Merge a list of non-indexed geometries (position + normal + uv).
function mergeAll(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += c;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
const flat = (g) => (g.index ? g.toNonIndexed() : g);
const OUTWARD = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };

// --- cliffs: snow on top, boulders along them; snowbanks along the sea edge ---------------
function buildCliffs(out, group, world, map, r, mats) {
  const caps = [], rocks = [];
  // how far the snowy top can run out from a wall before it would hang over another room
  const reach = (b) => {
    const [ox, oz] = OUTWARD[b.side];
    let e = 7;
    for (const rm of map.rooms) {
      if (rm.id === b.room) continue;
      const [x0, z0, x1, z1] = rm.rect;
      if (ox) {
        if (z1 <= b.minZ || z0 >= b.maxZ) continue;
        const d = ox > 0 ? x0 - b.maxX : b.minX - x1;
        if (d >= -0.01) e = Math.min(e, d - 0.55);
      } else {
        if (x1 <= b.minX || x0 >= b.maxX) continue;
        const d = oz > 0 ? z0 - b.maxZ : b.minZ - z1;
        if (d >= -0.01) e = Math.min(e, d - 0.55);
      }
    }
    return Math.max(0, e);
  };
  const boulder = (x, y, z, s) => {
    const geo = new THREE.DodecahedronGeometry(1, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 0.75 + r() * 0.5; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); }
    geo.computeVertexNormals();
    geo.rotateY(r() * 3); geo.scale(s, s, s); geo.translate(x, y, z);
    rocks.push(flat(geo));
    const cap = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4);
    cap.scale(s * 0.95, s * 0.4, s * 0.95); cap.translate(x, y + s * 0.45, z);
    caps.push(flat(cap));
  };
  out.boulder = boulder;
  for (const b of world.walls) {
    const rm = world.roomById.get(b.room);
    const st = b.style || rm.style;
    const [ox, oz] = OUTWARD[b.side];
    const along = ox === 0;
    const a0 = along ? b.minX : b.minZ, a1 = along ? b.maxX : b.maxZ;
    if (st === 'invisible') {
      for (let a = a0; a <= a1; a += 2.6) {
        const g = new THREE.SphereGeometry(1, 14, 8);
        g.scale(2.2 + r() * 1.2, 1.1 + r() * 0.7, 1.6 + r() * 0.6);
        const cx = along ? a + (r() - 0.5) * 1.2 : (b.minX + b.maxX) / 2 + ox * (0.8 + r() * 0.8);
        const cz = along ? (b.minZ + b.maxZ) / 2 + oz * (0.8 + r() * 0.8) : a + (r() - 0.5) * 1.2;
        g.translate(cx, -0.2, cz);
        caps.push(flat(g));
      }
      continue;
    }
    if (st !== 'cliff') continue;
    // the snowy top: over the wall and back from it
    const e = b.maxY >= 6 ? reach(b) : 0;
    let x0 = b.minX, x1 = b.maxX, z0 = b.minZ, z1 = b.maxZ;
    if (ox > 0) x1 += e; else if (ox < 0) x0 -= e;
    if (oz > 0) z1 += e; else if (oz < 0) z0 -= e;
    if (ox > 0) x0 -= 0.15; else if (ox < 0) x1 += 0.15;   // a lip over the inside face
    if (oz > 0) z0 -= 0.15; else if (oz < 0) z1 += 0.15;
    const g = new THREE.BoxGeometry(x1 - x0, 0.45, z1 - z0);
    g.translate((x0 + x1) / 2, b.maxY + 0.18, (z0 + z1) / 2);
    caps.push(flat(g));
    if (b.kind !== 'wall') continue;   // (not over the doorways)
    for (let a = a0 + 1; a < a1 - 1; a += 4 + r() * 4) {
      if (b.maxY >= 6) {
        const fx = along ? a : (ox > 0 ? b.maxX : b.minX) + ox * (0.4 + r() * 1.2);
        const fz = along ? (oz > 0 ? b.maxZ : b.minZ) + oz * (0.4 + r() * 1.2) : a;
        boulder(fx, b.maxY + 0.2, fz, 1.0 + r() * 1.4);
      }
      if (r() < 0.3) {
        const ix = along ? a : (ox > 0 ? b.minX : b.maxX) + ox * 0.05;
        const iz = along ? (oz > 0 ? b.minZ : b.maxZ) + oz * 0.05 : a;
        boulder(ix, 0.15, iz, 0.45 + r() * 0.4);
      }
    }
  }
  if (caps.length) group.add(new THREE.Mesh(mergeAll(caps), mats.snowCap));
  if (rocks.length) group.add(new THREE.Mesh(mergeAll(rocks), mats.rock));
}

// --- the trenches: posts, sandbags along the lip, wire on stakes, snow ----------------------
function buildTrenches(group, world, map, r, mats) {
  const posts = [], bags = [], snow = [], wire = [];
  const box = (list, x0, y0, z0, x1, y1, z1) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); list.push(flat(g)); };
  for (const b of world.walls) {
    const rm = world.roomById.get(b.room);
    if ((b.style || rm.style) !== 'trench') continue;
    const [ox, oz] = OUTWARD[b.side];
    const along = ox === 0;
    const a0 = along ? b.minX : b.minZ, a1 = along ? b.maxX : b.maxZ;
    const top = b.maxY;
    const px = along ? 0 : 0.12, pz = along ? 0.12 : 0;
    box(bags, b.minX - px, top, b.minZ - pz, b.maxX + px, top + 0.36, b.maxZ + pz);
    box(snow, b.minX - px * 0.8, top + 0.36, b.minZ - pz * 0.8, b.maxX + px * 0.8, top + 0.44, b.maxZ + pz * 0.8);
    if (b.kind !== 'wall') continue;
    // upright posts on the inside face
    const fx = ox > 0 ? b.minX : b.maxX, fz = oz > 0 ? b.minZ : b.maxZ;
    for (let a = a0 + 0.6; a < a1 - 0.3; a += 2.2) {
      if (along) box(posts, a - 0.08, 0, fz - oz * 0.06 - 0.05, a + 0.08, top + 0.1, fz - oz * 0.06 + 0.05);
      else box(posts, fx - ox * 0.06 - 0.05, 0, a - 0.08, fx - ox * 0.06 + 0.05, top + 0.1, a + 0.08);
    }
    // barbed wire on stakes, just back from the lip
    const ex = ox > 0 ? b.maxX + 0.5 : b.minX - 0.5, ez = oz > 0 ? b.maxZ + 0.5 : b.minZ - 0.5;
    let prev = null;
    for (let a = a0; a <= a1 + 0.01; a += 2.5) {
      const x = along ? a : ex, z = along ? ez : a;
      box(posts, x - 0.04, top - 0.2, z - 0.04, x + 0.04, top + 1.0, z + 0.04);
      if (prev) for (const h of [0.45, 0.8]) wire.push(prev.x, top + h + (r() - 0.5) * 0.1, prev.z, x, top + h + (r() - 0.5) * 0.1, z);
      prev = { x, z };
    }
  }
  if (posts.length) group.add(new THREE.Mesh(mergeAll(posts), mats.darkWood));
  if (bags.length) group.add(new THREE.Mesh(mergeAll(bags), mats.sandbag));
  if (snow.length) group.add(new THREE.Mesh(mergeAll(snow), mats.snowCap));
  if (wire.length) {
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    group.add(new THREE.LineSegments(wg, mats.wire));
  }
  // dugouts: sandbags piled on the roof, snow on them
  for (const rm of map.rooms) {
    if (rm.style !== 'trench' || rm.outdoor) continue;
    const [x0, z0, x1, z1] = rm.rect;
    const g = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 1, 0.4, z1 - z0 + 1), mats.sandbag);
    g.position.set((x0 + x1) / 2, rm.height + 0.45, (z0 + z1) / 2); group.add(g);
    const s = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.9, 0.08, z1 - z0 + 0.9), mats.snowCap);
    s.position.set((x0 + x1) / 2, rm.height + 0.69, (z0 + z1) / 2); group.add(s);
  }
}

// --- roofs on the huts (gabled, snowed on) and a smoking stone chimney -----------------------
function buildRoofs(out, group, map, mats) {
  const roofMat = new THREE.MeshStandardMaterial({ map: CT.boardsTexture({ seed: 21, base: [52, 40, 30] }), roughness: 1 });
  const gableMat = new THREE.MeshStandardMaterial({ map: CT.boardsTexture({ seed: 33, base: [70, 52, 36], vertical: true }), roughness: 1, side: THREE.DoubleSide });
  const stone = new THREE.MeshStandardMaterial({ map: CT.stoneTexture({ seed: 12 }), roughness: 1 });
  for (const rm of map.rooms) {
    if (rm.style !== 'cabin') continue;
    const [x0, z0, x1, z1] = rm.rect;
    const o = 0.7, H = rm.height + 0.25, rise = 1.8;
    const alongX = x1 - x0 >= z1 - z0;
    const L = (alongX ? x1 - x0 : z1 - z0) + 1 + 2 * o;     // ridge length (walls are 0.5 thick)
    const W = (alongX ? z1 - z0 : x1 - x0) + 1 + 2 * o;     // eave to eave
    const slope = Math.hypot(W / 2, rise), ang = Math.atan2(rise, W / 2);
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(L, 0.14, slope), roofMat);
      pl.position.set(0, H + rise / 2, s * W / 4); pl.rotation.x = s * ang;
      g.add(pl);
      const sn = new THREE.Mesh(new THREE.BoxGeometry(L * 0.98, 0.1, slope * 0.95), mats.snowCap);
      sn.position.set(0, H + rise / 2 + 0.12, s * W / 4); sn.rotation.x = s * ang;
      g.add(sn);
    }
    // the gable ends (triangles of boards)
    const hw = W / 2 - o;
    const tri = new THREE.Shape([new THREE.Vector2(-hw, 0), new THREE.Vector2(hw, 0), new THREE.Vector2(0, rise * hw / (W / 2))]);
    for (const s of [-1, 1]) {
      const ge = new THREE.Mesh(new THREE.ShapeGeometry(tri), gableMat);
      ge.rotation.y = Math.PI / 2; ge.position.set(s * (L / 2 - o), H, 0);
      g.add(ge);
    }
    g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    if (!alongX) g.rotation.y = Math.PI / 2;
    group.add(g);
    const chx = x1 - 1.4, chz = (z0 + z1) / 2 + 1.2;
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.8, 0.9), stone);
    ch.position.set(chx, H + 1.4, chz); group.add(ch);
    out.smoke.push({ x: chx, y: H + 2.9, z: chz, puffs: null });
  }
}

// --- the ship, frozen into the sea ice round its hold ---------------------------------------
function buildShip(out, group, map, r, mats) {
  const hold = map.rooms.find((q) => q.style === 'hull');
  if (!hold) return;
  const [x0, z0, x1, z1] = hold.rect;
  const Tw = map.wallThickness;
  const H = hold.height + 0.3;            // deck level (over the hold's ceiling)
  const ship = new THREE.Group();
  const zc = (z0 + z1) / 2, half = (z1 - z0) / 2 + Tw;
  const stern = x0 - 9, bowStart = x1 + 3, bow = x1 + 15;
  const plate = (xa, xb, ya, yb, zs) => { const m = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, yb - ya, 0.4), mats.hull); m.position.set((xa + xb) / 2, (ya + yb) / 2, zs); ship.add(m); };
  for (const s of [-1, 1]) {
    const zs = zc + s * (half + 0.2);
    plate(stern, x0 - Tw, -0.5, H + 1.1, zs);          // past the hold: full height
    plate(x1 + Tw, bowStart, -0.5, H + 1.1, zs);
    plate(x0 - Tw, x1 + Tw, hold.height, H + 1.1, zs);  // the bulwark above the hold's own walls
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(bowStart - stern, 0.5, 0.06), mats.hullRed);
    stripe.position.set((stern + bowStart) / 2, 0.35, zs + s * 0.23); ship.add(stripe);
  }
  const transom = new THREE.Mesh(new THREE.BoxGeometry(0.4, H + 1.6, half * 2 + 0.8), mats.hull);
  transom.position.set(stern - 0.2, (H + 1.1 - 0.5) / 2, zc); ship.add(transom);
  for (const s of [-1, 1]) {
    const dz = half + 0.2, dx = bow - bowStart, len = Math.hypot(dx, dz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, H + 2.4, 0.4), mats.hull);
    m.position.set((bowStart + bow) / 2, (H + 2.4) / 2 - 0.5, zc + s * dz / 2);
    m.rotation.y = s * Math.atan2(dz, dx);
    ship.add(m);
  }
  // the deck (a flat outline: squared stern, pointed bow)
  const shape = new THREE.Shape([
    new THREE.Vector2(stern, -(zc - half)), new THREE.Vector2(bowStart, -(zc - half)), new THREE.Vector2(bow, -zc),
    new THREE.Vector2(bowStart, -(zc + half)), new THREE.Vector2(stern, -(zc + half)),
  ]);
  const dg = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  const deck = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ color: '#4a3e34', roughness: 1, side: THREE.DoubleSide }));
  deck.position.y = H; ship.add(deck);
  const dsn = new THREE.Mesh(dg, mats.snowCap); dsn.position.y = H + 0.05; ship.add(dsn);
  // the bridge, a funnel, two masts with rigging
  const brX = stern + 7;
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(9, 4.2, half * 1.4), mats.paint);
  bridge.position.set(brX, H + 2.1, zc); ship.add(bridge);
  const top = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, half * 1.2), mats.paint);
  top.position.set(brX + 0.5, H + 5.3, zc); ship.add(top);
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), mats.window);
    w.position.set(brX - 1.7 + i * 1.1, H + 5.6, zc + s * (half * 0.6 + 0.02));
    if (s < 0) w.rotation.y = Math.PI;
    ship.add(w);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.15, half * 1.25), mats.snowCap); roof.position.set(brX + 0.5, H + 6.48, zc); ship.add(roof);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 6, 18), mats.hullRed);
  funnel.position.set(brX + 8, H + 3, zc); funnel.rotation.z = 0.1; ship.add(funnel);
  const rig = [];
  for (const mx of [brX + 17, x1 + 7]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 14, 8), mats.iron);
    mast.position.set(mx, H + 7, zc); ship.add(mast);
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, half * 1.6, 6).rotateX(Math.PI / 2), mats.iron);
    yard.position.set(mx, H + 11, zc); ship.add(yard);
    for (const s of [-1, 1]) rig.push(mx, H + 13.5, zc, mx - 3, H + 0.5, zc + s * half, mx, H + 13.5, zc, mx + 3, H + 0.5, zc + s * half);
  }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rig, 3));
  ship.add(new THREE.LineSegments(rg, mats.wire));
  // ice heaped against the hull
  for (let x = stern; x < bow - 4; x += 3) {
    for (const s of [-1, 1]) {
      const g = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mats.snowCap);
      g.scale.set(2 + r() * 1.5, 0.8 + r() * 0.8, 1.0 + r() * 0.5);
      g.position.set(x, -0.1, zc + s * (half + 2.2 + r()));
      ship.add(g);
    }
  }
  group.add(ship);
  out.smoke.push({ x: brX + 8.3, y: H + 6, z: zc, puffs: null, big: true });
}

// --- pine forest round the map (not on the sea, not on the map) -----------------------------
function buildForest(out, group, B, sea, r, mats, inRoom) {
  const trunk = new THREE.CylinderGeometry(0.15, 0.25, 2, 6);
  const needles = new THREE.ConeGeometry(1, 2.2, 8);
  out.trunk = trunk; out.needles = needles;
  const cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  const spots = [];
  for (let i = 0; i < 1200 && spots.length < 320; i++) {
    const x = cx + (r() - 0.5) * 300, z = cz + (r() - 0.5) * 280;
    if (z < sea + 6) continue;
    if (x > B.x0 - 3 && x < B.x1 + 3 && z > B.z0 - 3 && z < B.z1 + 3) continue;
    if (inRoom(x, z, 3)) continue;
    spots.push([x, z, 0.8 + r() * 1.3]);
  }
  const tiers = 3;
  const tIm = new THREE.InstancedMesh(trunk, mats.bark, spots.length);
  const nIm = new THREE.InstancedMesh(needles, mats.pine, spots.length * tiers);
  const cIm = new THREE.InstancedMesh(needles, mats.snowCap, spots.length * tiers);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  spots.forEach(([x, z, s], i) => {
    const base = Math.max(0, out.groundAt(x, z));
    m4.compose(ps.set(x, base + s, z), q.identity(), sc.set(s, s, s)); tIm.setMatrixAt(i, m4);
    for (let k = 0; k < tiers; k++) {
      const w = (1.6 - k * 0.4) * s, y = base + s * (1.8 + k * 1.3);
      m4.compose(ps.set(x, y, z), q.identity(), sc.set(w, s * 1.1, w)); nIm.setMatrixAt(i * tiers + k, m4);
      m4.compose(ps.set(x, y + 0.25 * s, z), q.identity(), sc.set(w * 0.82, s * 0.7, w * 0.82)); cIm.setMatrixAt(i * tiers + k, m4);
    }
  });
  group.add(tIm, nIm, cIm);
}

// --- far away: the plant and its four stacks; mountains all round ----------------------------
// (the plant is pulled in toward the eye so it's never past the far plane; the
// mountains ride along with you like the sky)
function buildFar(out, group, map, r) {
  const plant = new THREE.Group();
  const stackHeads = [];
  const sx = map.stacks.reduce((a, s) => a + s.x, 0) / map.stacks.length, sz = map.stacks.reduce((a, s) => a + s.z, 0) / map.stacks.length;
  map.stacks.forEach((s, i) => {
    const tex = stackTexture(11 + i);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.32 });
    const st = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 3.3, s.h, 32, 1, true), mat);
    st.position.set(s.x, s.h / 2, s.z); plant.add(st);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.1, 1.2, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#2a201c', roughness: 0.9, emissive: new THREE.Color('#120c0a') }));
    lip.position.set(s.x, s.h - 0.4, s.z); plant.add(lip);
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,90,70,1)', 'rgba(255,30,20,0)'), color: new THREE.Color(3, 0.4, 0.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    lamp.scale.setScalar(3.2); lamp.position.set(s.x, s.h + 0.8, s.z); plant.add(lamp);
    stackHeads.push({ lamp, phase: i * 0.37 });
    const bt = buildingTexture(31 + i);
    const bmat = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.95, emissive: new THREE.Color('#ffd9b0'), emissiveMap: bt, emissiveIntensity: 0.12 });
    const bh = 30 + (i % 2) * 3;
    const b = new THREE.Mesh(new THREE.BoxGeometry(15, bh, 16), bmat);
    b.position.set(s.x + 10.5, bh / 2, s.z - 5); plant.add(b);
    const low = new THREE.Mesh(new THREE.BoxGeometry(17, 9, 9), new THREE.MeshStandardMaterial({ color: '#6a6c6e', roughness: 0.9, emissive: new THREE.Color('#1a1c20') }));
    low.position.set(s.x + 6, 4.5, s.z + 9); plant.add(low);
    const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 0.6) });
    for (let k = 0; k < 9; k++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), win);
      w.position.set(s.x + 10.5 - 6 + (k % 3) * 6, 6 + Math.floor(k / 3) * 9 + r() * 2, s.z - 5 + 8.02); plant.add(w);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,230,190,0.9)', 'rgba(255,200,140,0)'), color: new THREE.Color(1.2, 1.0, 0.8), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(14, 10, 1); glow.position.set(s.x, 4, s.z + 3); plant.add(glow);
  });
  const quay = new THREE.Mesh(new THREE.BoxGeometry(120, 2.2, 10), new THREE.MeshStandardMaterial({ color: '#58595a', roughness: 1, emissive: new THREE.Color('#14161a') }));
  quay.position.set(sx, 1.1, sz + 22); plant.add(quay);
  for (const [dx, dz, rad] of [[-48, 4, 4], [-55, -2, 3], [52, 12, 4.5], [60, 5, 3.5]]) {
    const tk = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, rad * 1.6, 24), new THREE.MeshStandardMaterial({ color: '#8a8c8a', roughness: 0.9, emissive: new THREE.Color('#1c1e22') }));
    tk.position.set(sx + dx, rad * 0.8, sz + dz); plant.add(tk);
  }
  group.add(plant);
  out.plant = { group: plant, center: new THREE.Vector3(sx, 0, sz), D: 150 };
  out.stackHeads = stackHeads;

  const ring = new THREE.Group();
  const mtnMat = new THREE.MeshStandardMaterial({ color: '#5f6c80', roughness: 1, flatShading: true, emissive: new THREE.Color('#121826') });
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + (r() - 0.5) * 0.15, d = 196;
    const north = Math.max(0, -Math.sin(a));        // low out over the sea, so the stacks stand clear
    const h = (22 + r() * 30) * (1 - north * 0.7), w = 40 + r() * 30;
    const geo = new THREE.ConeGeometry(w, h, 9, 3);
    const gpos = geo.attributes.position;
    for (let k = 0; k < gpos.count; k++) {
      const y = gpos.getY(k);
      if (y > h / 2 - 0.01) continue;
      const j = 1 + (r() - 0.5) * 0.35;
      gpos.setXYZ(k, gpos.getX(k) * j, y + (y > -h / 2 + 0.01 ? (r() - 0.5) * h * 0.18 : 0), gpos.getZ(k) * j);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mtnMat);
    m.position.set(Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d);
    m.rotation.y = r() * 3;
    ring.add(m);
  }
  group.add(ring);
  out.ring = ring;
}

// --- the props (collision comes from the map data) -------------------------------------------
function buildProps(out, group, world, r, mats, mv) {
  for (const b of world.propBoxes) {
    const p = b.prop;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, w = b.maxX - b.minX, d = b.maxZ - b.minZ, h = b.maxY - b.minY;
    switch (p.kind) {
      case 'truck': group.add(truck(cx, cz, w, d, p.yaw || 0, mats.snowCap)); break;
      case 'crate': {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), crateMat());
        m.position.set(cx, b.minY + h / 2, cz); m.rotation.y = 0.05; group.add(m);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.06, d * 0.96), mats.snowCap);
        cap.position.set(cx, b.maxY + 0.03, cz); group.add(cap);
        break;
      }
      case 'barrel': out.fires.push(fireBarrel(mv, group, cx, cz, h)); break;
      case 'rock': {
        const g = new THREE.DodecahedronGeometry(1, 1);
        const pp = g.attributes.position;
        for (let i = 0; i < pp.count; i++) { const k = 0.8 + r() * 0.4; pp.setXYZ(i, pp.getX(i) * k, pp.getY(i) * k, pp.getZ(i) * k); }
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, mats.rock); m.scale.set(w * 0.6, h * 0.75, d * 0.6); m.position.set(cx, h * 0.38, cz); group.add(m);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), mats.snowCap);
        cap.scale.set(w * 0.45, h * 0.25, d * 0.45); cap.position.set(cx, h * 0.82, cz); group.add(cap);
        break;
      }
      case 'pine': {
        const s = 1.9;
        const t = new THREE.Mesh(out.trunk, mats.bark); t.position.set(cx, s, cz); t.scale.setScalar(s); group.add(t);
        for (let k = 0; k < 4; k++) {
          const ww = (1.8 - k * 0.38) * s, y = s * (1.6 + k * 1.15);
          const n = new THREE.Mesh(out.needles, mats.pine); n.position.set(cx, y, cz); n.scale.set(ww, s * 1.1, ww); group.add(n);
          const c = new THREE.Mesh(out.needles, mats.snowCap); c.position.set(cx, y + 0.3 * s, cz); c.scale.set(ww * 0.8, s * 0.65, ww * 0.8); group.add(c);
        }
        break;
      }
      case 'sign': {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.4, 0.16), mats.bark);
        post.position.set(cx, 1.2, cz); group.add(post);
        const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.08), [mats.bark, mats.bark, mats.bark, mats.bark, new THREE.MeshStandardMaterial({ map: signTexture(p.text || ['THE STACKS', '']), roughness: 0.9 }), mats.bark]);
        board.position.set(cx, 1.85, cz + 0.12); board.rotation.y = 0.08; group.add(board);
        break;
      }
      case 'lighthouse': out.beams.push(lighthouse(group, cx, cz, Math.min(w, d) / 2, h, mats, mv)); break;
      case 'iceberg': {
        const g = new THREE.DodecahedronGeometry(1, 0);
        const pp = g.attributes.position;
        for (let i = 0; i < pp.count; i++) { const k = 0.8 + r() * 0.4; pp.setXYZ(i, pp.getX(i) * k, pp.getY(i) * k, pp.getZ(i) * k); }
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, mats.ice);
        m.scale.set(w * 0.62, h * 0.75, d * 0.62); m.position.set(cx, h * 0.35, cz); m.rotation.y = r() * 3;
        group.add(m);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), mats.snowCap);
        cap.scale.set(w * 0.4, h * 0.2, d * 0.4); cap.position.set(cx, h * 0.85, cz); group.add(cap);
        break;
      }
      case 'boat': {
        // a rowboat pulled up and turned over, snowed on
        const g = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#3c4a52', roughness: 0.9 }));
        m.scale.set(w / 2, h, d / 2); m.position.set(cx, 0, cz); group.add(m);
        const s = new THREE.Mesh(g, mats.snowCap); s.scale.set(w * 0.42, h * 0.5, d * 0.42); s.position.set(cx, h * 0.62, cz); group.add(s);
        break;
      }
      case 'rack': {
        // a fish-drying rack: two A-frames and a pole, fish hanging off it
        const alongX = w > d, L = alongX ? w : d;
        for (const s of [-1, 1]) for (const k of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, h + 0.2, 0.08), mats.wood);
          leg.position.set(alongX ? cx + s * L / 2 : cx + k * 0.25, h / 2, alongX ? cz + k * 0.25 : cz + s * L / 2);
          if (alongX) leg.rotation.x = k * 0.16; else leg.rotation.z = k * 0.16;
          group.add(leg);
        }
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, L, 6), mats.wood);
        pole.position.set(cx, h, cz); if (alongX) pole.rotation.z = Math.PI / 2; else pole.rotation.x = Math.PI / 2;
        group.add(pole);
        const fish = new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.6, metalness: 0.3 });
        for (let a = -L / 2 + 0.3; a < L / 2; a += 0.35) {
          const f = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.12), fish);
          f.position.set(alongX ? cx + a : cx, h - 0.28, alongX ? cz : cz + a); f.rotation.y = r();
          group.add(f);
        }
        break;
      }
      default: break;
    }
  }
}

let crateTex = null;
function crateMat() {
  if (!crateTex) {
    const [c, g] = T.makeCanvas(128, 128);
    g.fillStyle = '#6a4a2a'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 21) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, y, 128, 2); }
    g.strokeStyle = '#3a2614'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
    g.beginPath(); g.moveTo(8, 8); g.lineTo(120, 120); g.stroke();
    crateTex = T.toTexture(c, { repeat: false });
  }
  return new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.95 });
}

// An old pickup frozen where it stopped, half buried.
function truck(cx, cz, w, d, yaw, snowCap) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: '#5a1e18', roughness: 0.85, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.6 });
  const L = w, W = d;
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, 0.8, W), paint); body.position.y = 0.75; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(L * 0.32, 0.8, W * 0.94), paint); cab.position.set(L * 0.1, 1.5, 0); g.add(cab);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(L * 0.33, 0.45, W * 0.96), dark); glass.position.set(L * 0.1, 1.55, 0); g.add(glass);
  for (const [x, z] of [[-L * 0.32, -W / 2], [-L * 0.32, W / 2], [L * 0.3, -W / 2], [L * 0.3, W / 2]]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14).rotateX(Math.PI / 2), dark); wh.position.set(x, 0.38, z); g.add(wh);
  }
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(L * 0.3, 0.12, W * 0.9), snowCap); s1.position.set(L * 0.1, 1.96, 0); g.add(s1);
  const s2 = new THREE.Mesh(new THREE.BoxGeometry(L * 0.55, 0.18, W * 0.95), snowCap); s2.position.set(-L * 0.22, 1.2, 0); g.add(s2);
  const drift = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), snowCap); drift.scale.set(L * 0.55, 0.6, 0.9); drift.position.set(0, 0, W / 2 + 0.3); g.add(drift);
  g.position.set(cx, 0, cz); g.rotation.set(0, yaw, 0.04);
  return g;
}

// A rusty drum with a fire going in it: warm light and flames.
function fireBarrel(mv, group, cx, cz, h) {
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, h, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.9, metalness: 0.3, side: THREE.DoubleSide }));
  drum.position.set(cx, h / 2, cz); group.add(drum);
  const coals = new THREE.Mesh(new THREE.CircleGeometry(0.31, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.7, 0.15) }));
  coals.position.set(cx, h - 0.12, cz); group.add(coals);
  const fm = T.softDotTexture('rgba(255,200,90,1)', 'rgba(255,80,10,0)');
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fm, color: new THREE.Color(2.4, 1.2, 0.35), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(cx, h + 0.1, cz); group.add(s); flames.push(s);
  }
  const light = mv.addVirtualLight({ x: cx, y: h + 0.5, z: cz }, 0xff8a40, 9, 9, 1.5);
  return { flames, light, cx, cz, h };
}

// The lighthouse: a banded tower on a stone base, a gallery, and the lamp
// room on top with its beam sweeping round over the sea.
function lighthouse(group, cx, cz, rad, h, mats, mv) {
  const g = new THREE.Group();
  const towerH = h - 4.5;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.08, 2.2, 24), new THREE.MeshStandardMaterial({ map: CT.stoneTexture({ seed: 44 }), roughness: 1 }));
  base.position.y = 1.1; g.add(base);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.62, rad * 0.9, towerH - 2.2, 28, 1, true), new THREE.MeshStandardMaterial({ map: lighthouseTexture(), roughness: 0.85 }));
  tower.position.y = 2.2 + (towerH - 2.2) / 2; g.add(tower);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.0), mats.darkWood);
  door.position.set(rad * 0.66, 3.2, rad * 0.66); door.rotation.y = Math.PI / 4; g.add(door);
  const gal = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.9, rad * 0.9, 0.25, 28), mats.iron);
  gal.position.y = towerH + 0.1; g.add(gal);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(rad * 0.88, 0.04, 6, 32).rotateX(Math.PI / 2), mats.iron);
  rail.position.y = towerH + 1.1; g.add(rail);
  const snow = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.88, rad * 0.88, 0.08, 28), mats.snowCap);
  snow.position.y = towerH + 0.27; g.add(snow);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.45, rad * 0.45, 2.4, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.25, roughness: 0.1, emissive: new THREE.Color('#ffd27a'), emissiveIntensity: 0.6, side: THREE.DoubleSide }));
  glass.position.y = towerH + 1.45; g.add(glass);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 1.8) }));
  lamp.position.y = towerH + 1.4; g.add(lamp);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(rad * 0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.hullRed);
  dome.position.y = towerH + 2.65; g.add(dome);
  // the beam: two long, soft cones swinging round
  const beamGeo = new THREE.ConeGeometry(5, 70, 24, 1, true).rotateZ(Math.PI / 2).translate(35, 0, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.8, 0.55), transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const pivot = new THREE.Group(); pivot.position.y = towerH + 1.4; g.add(pivot);
  for (const a of [0, Math.PI]) { const bm = new THREE.Mesh(beamGeo, beamMat); bm.rotation.y = a; pivot.add(bm); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,230,170,1)', 'rgba(255,200,120,0)'), color: new THREE.Color(2, 1.7, 1.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(6); halo.position.y = towerH + 1.4; g.add(halo);
  g.position.set(cx, 0, cz);
  group.add(g);
  // a lamp over the door, lighting the point
  mv.addVirtualLight({ x: cx + rad + 1, y: 3, z: cz + rad + 1 }, 0xffd9a0, 14, 12, 1.6);
  return { pivot, halo };
}

// --- snow falling, all the time, in a box round the camera -----------------------------------
function buildSnow(out, group, r) {
  const N = 3200, box = { x: 46, y: 22, z: 46 };
  const pos = new Float32Array(N * 3), drift = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (r() - 0.5) * box.x; pos[i * 3 + 1] = r() * box.y; pos[i * 3 + 2] = (r() - 0.5) * box.z; drift[i] = r() * 6.28; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flakes = new THREE.Points(sg, new THREE.PointsMaterial({ map: T.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: new THREE.Color(0.95, 0.97, 1.0), size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false }));
  flakes.frustumCulled = false;
  group.add(flakes);
  out.snow = { flakes, pos, drift, box, count: N };
  // Settings › Effects: fewer flakes on the lower levels
  out.setDetail = (f) => { out.snow.count = Math.max(200, Math.round(N * f)); sg.setDrawRange(0, out.snow.count); };
}

function updateCrust(W, dt, eye, time) {
  if (!eye) return;
  W.sky.position.copy(eye);
  W.ring.position.set(eye.x, 0, eye.z);
  // the plant: never further than D away (pulled in toward the eye, same size on screen)
  const P = W.plant, d = Math.hypot(P.center.x - eye.x, P.center.z - eye.z);
  const k = d > P.D ? P.D / d : 1;
  P.group.scale.setScalar(k);
  P.group.position.set(eye.x * (1 - k), eye.y * (1 - k), eye.z * (1 - k));
  // the snow box rides along with the camera; flakes wrap round inside it
  const S = W.snow, p = S.pos, b = S.box;
  if (!S.placed) { for (let i = 0; i < p.length; i += 3) { p[i] += eye.x; p[i + 2] += eye.z; } S.placed = true; }
  const end = S.count * 3;
  for (let i = 0; i < end; i += 3) {
    const kk = i / 3;
    p[i + 1] -= dt * (1.1 + (kk % 7) * 0.12);
    p[i] += dt * (0.6 + Math.sin(time * 0.7 + S.drift[kk]) * 0.5);
    p[i + 2] += dt * Math.cos(time * 0.5 + S.drift[kk]) * 0.3;
    const lx = p[i] - eye.x, lz = p[i + 2] - eye.z;
    if (lx > b.x / 2) p[i] -= b.x; else if (lx < -b.x / 2) p[i] += b.x;
    if (lz > b.z / 2) p[i + 2] -= b.z; else if (lz < -b.z / 2) p[i + 2] += b.z;
    if (p[i + 1] < 0) p[i + 1] += b.y;
  }
  S.flakes.geometry.attributes.position.needsUpdate = true;
  // aviation lights blink; the fires dance; the lighthouse turns
  for (const h of W.stackHeads) h.lamp.material.opacity = (Math.sin((time + h.phase) * Math.PI) > 0.2 ? 1 : 0.15);
  for (const F of W.fires) {
    F.flames.forEach((s, i) => {
      const t = time * (3 + i * 0.7) + i * 1.7;
      s.position.set(F.cx + Math.sin(t) * 0.08, F.h + 0.15 + ((time * 0.9 + i * 0.21) % 1) * 0.55, F.cz + Math.cos(t * 1.3) * 0.08);
      const life = 1 - ((time * 0.9 + i * 0.21) % 1);
      s.scale.setScalar(0.55 * life + 0.15);
      s.material.opacity = life;
    });
    F.light.level = 0.8 + Math.sin(time * 13) * 0.1 + Math.sin(time * 7.3) * 0.1;
  }
  for (const L of W.beams) { L.pivot.rotation.y = time * 0.5; L.halo.material.opacity = 0.7 + Math.sin(time) * 0.3; }
  // chimney and funnel smoke
  for (const sm of W.smoke) {
    if (!sm.puffs) {
      sm.puffs = [];
      const st = T.smokeTexture(5);
      for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, color: '#3a3a40', transparent: true, depthWrite: false, opacity: 0.5 })); W.mv.group.add(s); sm.puffs.push(s); }
    }
    const big = sm.big ? 2 : 1;
    sm.puffs.forEach((s, i) => {
      const ph = (time * 0.2 + i / 5) % 1;
      s.position.set(sm.x + ph * 2.5 * big, sm.y + ph * 5 * big, sm.z + ph * 0.8);
      s.scale.setScalar((0.8 + ph * 3) * big);
      s.material.opacity = 0.5 * (1 - ph);
    });
  }
}
