// =============================================================================
// Call of the Crust: the snow world. An open night sky full of stars, a galaxy
// band and planets; snow falling all the time; the frozen sea with five islands
// in it, their land rising behind the rooms' walls; the Anvil in the middle of
// the hub; launcher pads glowing in the colour of where they send you; ships
// frozen in the ice, a lighthouse, a research base's radio tower and tesla
// coils, trenches with sandbags and wire, glowing ice caves; and far off to the
// north, four red-and-white smokestacks on a lit-up power plant.
//
// mapView calls crustMaterials() while it builds its materials and
// buildCrust() in place of the school's exterior; update() runs every frame.
// =============================================================================
import * as THREE from 'three';
import { buildGround, buildStructures, buildRides, buildDecor, buildPines } from './crustTerrain.js';
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
    g.fillStyle = `rgba(225,232,242,${0.1 + r() * 0.18})`;
    g.beginPath(); g.ellipse(x, y, w * 0.7, 1.5 + r() * 3, (r() - 0.5) * 0.3, 0, 7); g.fill();
  }
  // frost at the top
  const grd = g.createLinearGradient(0, 0, 0, H * 0.25);
  grd.addColorStop(0, 'rgba(230,236,246,0.55)'); grd.addColorStop(1, 'rgba(230,236,246,0)');
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

// More surfaces for the islands: ancient dressed stone (the Anvil, the
// observatory), corrugated tin (the depot, the research base), poured concrete
// (bunkers), canvas (the field hospital), flagstones underfoot.
function tinTexture() {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(83);
  g.fillStyle = '#5c6066'; g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 8) { const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0.10)'); g.fillStyle = gr; g.fillRect(x, 0, 8, S); }
  for (let i = 0; i < 50; i++) { const x = r() * S, y = r() * S; const gr = g.createLinearGradient(0, y, 0, y + 80); gr.addColorStop(0, 'rgba(120,60,30,0.3)'); gr.addColorStop(1, 'rgba(120,60,30,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + r() * 4, 80); }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 126, S, 3);
  for (let x = 0; x < S; x += 3) { g.fillStyle = `rgba(230,236,244,${r() * 0.5})`; g.fillRect(x, 0, 3, 2 + r() * 3); }
  return T.toTexture(c);
}
function concreteTexture(seed = 91) {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(seed);
  g.fillStyle = '#6a6862'; g.fillRect(0, 0, S, S);
  const n = T.noiseCanvas(S, 6, 5); g.globalAlpha = 0.4; g.drawImage(n, 0, 0); g.globalAlpha = 1;
  g.fillStyle = 'rgba(0,0,0,0.25)'; for (const y of [64, 128, 192]) g.fillRect(0, y, S, 2);
  for (let i = 0; i < 30; i++) { const x = r() * S, y = r() * S; const gr = g.createLinearGradient(0, y, 0, y + 60); gr.addColorStop(0, 'rgba(30,30,28,0.25)'); gr.addColorStop(1, 'rgba(30,30,28,0)'); g.fillStyle = gr; g.fillRect(x, y, 3 + r() * 6, 60); }
  return T.toTexture(c);
}
function canvasTexture() {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(17);
  g.fillStyle = '#7a7458'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`; g.fillRect(0, i, S, 1); g.fillRect(i, 0, 1, S); }
  for (let i = 0; i < 20; i++) { g.fillStyle = `rgba(60,50,30,${0.1 + r() * 0.15})`; g.beginPath(); g.ellipse(r() * S, r() * S, 10 + r() * 30, 6 + r() * 14, r() * 3, 0, 7); g.fill(); }
  // a red cross on it
  g.fillStyle = 'rgba(150,30,30,0.85)'; g.fillRect(S / 2 - 12, S / 2 - 40, 24, 80); g.fillRect(S / 2 - 40, S / 2 - 12, 80, 24);
  return T.toTexture(c);
}
function flagstoneTexture() {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(29);
  g.fillStyle = '#2c2c2e'; g.fillRect(0, 0, S, S);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const k = 0.75 + r() * 0.3;
    g.fillStyle = `rgb(${92 * k},${92 * k},${96 * k})`;
    g.fillRect(i * 64 + 2 + r() * 3, j * 64 + 2 + r() * 3, 60 - r() * 4, 60 - r() * 4);
  }
  const n = T.noiseCanvas(S, 5, 6); g.globalAlpha = 0.3; g.globalCompositeOperation = 'multiply'; g.drawImage(n, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(230,236,244,${r() * 0.3})`; g.fillRect(r() * S, r() * S, 1 + r() * 2, 1); }
  return T.toTexture(c);
}

// --- materials (called from mapView.buildMaterials) --------------------------------------
// Floors: snow, ice, duckboards, deck plate, planks, flagstones.
// Walls: cliff (rock), trench (plank revetment), cabin (logs), hull (riveted
// steel), stone (dressed blocks), tin (corrugated), bunker (concrete), canvas.
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
  M.flagstone = applyBake(std({ map: rep(flagstoneTexture(), 1 / 4) }));
  M.hullCeil = applyBake(std({ map: rep(hullTexture(), 1 / 3), roughness: 0.85, metalness: 0.3, color: '#8a8480' }));
  M.rock = applyBake(std({ map: cliffTexture(), roughness: 1, color: '#9aa2ae' }));
  M.stoneCeil = applyBake(std({ map: rep(CT.stoneTexture({ dressed: true, base: [84, 82, 80], seed: 66 }), 1 / 3) }));
  M.bunkerCeil = applyBake(std({ map: rep(concreteTexture(95), 1 / 3), color: '#8a8880' }));
  const cliff = std({ map: cliffTexture(), roughness: 1, color: '#848c98' });
  cliff.bumpMap = cliff.map; cliff.bumpScale = 3;
  wallMats.cliff = applyBake(cliff);
  wallMats.trench = applyBake(std({ map: rep(CT.boardsTexture({ seed: 4, base: [76, 60, 42] }), 1 / 2.4) }));
  wallMats.cabin = applyBake(std({ map: rep(logTexture(), 1 / 2.2) }));
  wallMats.hull = applyBake(std({ map: rep(hullTexture(), 1 / 3), roughness: 0.8, metalness: 0.35 }));
  wallMats.stone = applyBake(std({ map: rep(CT.stoneTexture({ dressed: true, base: [104, 100, 96], seed: 61 }), 1 / 2.5) }));
  wallMats.tin = applyBake(std({ map: rep(tinTexture(), 1 / 3), roughness: 0.7, metalness: 0.4 }));
  wallMats.bunker = applyBake(std({ map: rep(concreteTexture(), 1 / 3) }));
  wallMats.canvas = applyBake(std({ map: rep(canvasTexture(), 1 / 4), side: THREE.DoubleSide }));
}

// The element colours: Fire, Ice, Wind, Lightning.
export const ELEMENT = {
  fire: { color: new THREE.Color(3.0, 1.1, 0.25), light: 0xff7a30, name: 'Fire' },
  ice: { color: new THREE.Color(0.5, 1.6, 3.0), light: 0x7ad0ff, name: 'Ice' },
  wind: { color: new THREE.Color(1.4, 2.6, 1.6), light: 0xb8ffd0, name: 'Wind' },
  lightning: { color: new THREE.Color(2.0, 0.9, 3.2), light: 0xc49aff, name: 'Lightning' },
};

// --- the world --------------------------------------------------------------------------
export function buildCrust(mv) {
  const map = mv.map, group = mv.group, world = mv.world;
  const fog = map.fog ? map.fog.color : '#1c2534';
  const out = { mv, fires: [], beams: [], smoke: [], glows: [], spin: [] };
  const r = R(9);
  const mats = {
    snow: new THREE.MeshStandardMaterial({ color: '#d8e0ec', roughness: 0.95, emissive: new THREE.Color('#202a3c'), emissiveIntensity: 1 }),
    terrain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, emissive: new THREE.Color('#121a28'), flatShading: false }),
    snowCap: new THREE.MeshStandardMaterial({ color: '#eef2f8', roughness: 0.9, emissive: new THREE.Color('#141a26') }),
    rock: new THREE.MeshStandardMaterial({ color: '#4c525a', roughness: 1, flatShading: true }),
    stone: new THREE.MeshStandardMaterial({ map: CT.stoneTexture({ dressed: true, base: [96, 94, 92], seed: 71 }), roughness: 1 }),
    darkStone: new THREE.MeshStandardMaterial({ color: '#2e3036', roughness: 1 }),
    pine: new THREE.MeshStandardMaterial({ color: '#1e3326', roughness: 1, emissive: new THREE.Color('#05080a') }),
    bark: new THREE.MeshStandardMaterial({ color: '#2c2118', roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.95 }),
    darkWood: new THREE.MeshStandardMaterial({ color: '#2a1e14', roughness: 1 }),
    sandbag: new THREE.MeshStandardMaterial({ map: CT.sandbagTexture(), roughness: 1 }),
    iron: new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.6, metalness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: '#6a6e74', roughness: 0.5, metalness: 0.6 }),
    hull: new THREE.MeshStandardMaterial({ map: hullTexture(), roughness: 0.8, metalness: 0.35 }),
    hullRed: new THREE.MeshStandardMaterial({ color: '#5a1c18', roughness: 0.85, metalness: 0.2 }),
    paint: new THREE.MeshStandardMaterial({ color: '#c8c4b8', roughness: 0.85 }),
    olive: new THREE.MeshStandardMaterial({ color: '#4a4c32', roughness: 0.9, metalness: 0.2 }),
    white: new THREE.MeshStandardMaterial({ color: '#d8d8d4', roughness: 0.6, metalness: 0.2 }),
    wire: new THREE.LineBasicMaterial({ color: '#16161a' }),
    ice: new THREE.MeshStandardMaterial({ color: '#9ec4dc', roughness: 0.25, metalness: 0.05, emissive: new THREE.Color('#123048'), transparent: true, opacity: 0.92, flatShading: true }),
    window: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.1, 0.55) }),
    canvas: new THREE.MeshStandardMaterial({ map: canvasTexture(), roughness: 1, side: THREE.DoubleSide }),
    screen: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.2, 0.8) }),
  };
  out.mats = mats;
  // (the sculpted islands are lit live: give their things a little moonlight of their own)
  if (map.terrains) for (const m of Object.values(mats)) {
    if (!m.isMeshStandardMaterial || (m.emissive && m.emissive.getHex() !== 0)) continue;
    if (m.map) { m.emissiveMap = m.map; m.emissive = new THREE.Color('#34383f'); } else m.emissive = m.color.clone().multiplyScalar(0.22);
  }
  const isl = islandsOf(map);

  buildSky(out, group, fog);
  buildSea(out, group, isl);
  if (map.terrains) {
    // the sculpted islands (src/render/crustTerrain.js)
    buildGround(out, group, map, mv.mats, mv.wallMats);
    buildStructures(out, group, map, mats, mv.mats, mv.wallMats);
    buildRides(out, group, map, mats);
    buildPines(out, group, map, mats);
  } else {
    for (const I of isl) buildTerrain(out, group, I, map, mats, R(I.rooms.length * 31 + 7));
    buildEdges(out, group, world, mats, r);
    buildTrenches(group, world, map, r, mats);
    for (const s of map.ships || []) buildShip(out, group, map, s, r, mats);
    buildForest(out, group, isl, map, r, mats);
  }
  buildRoofs(out, group, map, mats);
  // moonlight on the buildings' outsides (they're baked; the open ground isn't)
  if (map.terrains) for (const rm of map.rooms) {
    if (rm.virtual) continue;
    const [x0, z0, x1, z1] = rm.rect, y = (rm.y || 0) + Math.max(7, rm.height + 3);
    for (const [x, z] of [[x0 - 4, z0 - 4], [x1 + 4, z1 + 4]]) mv.addVirtualLight({ x, y, z }, 0x8098c8, 140, 26, 1.15);
  }
  buildFar(out, group, map, r);
  buildProps(out, group, world, r, mats, mv);
  if (map.terrains) buildDecor(out, group, map, mats, mv);
  for (const L of map.launchers || []) buildPad(out, group, L, map, mats, mv);
  buildSnow(out, group, r);
  // slush (it slows you down): dark wet patches on the ice
  if (map.mud) {
    const slush = new THREE.MeshStandardMaterial({ color: '#3c4650', roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const m of map.mud) {
      const g = new THREE.CircleGeometry(m.r, 28).rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 1; i < p.count; i++) { const k = 0.85 + r() * 0.25; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
      const mesh = new THREE.Mesh(g, slush); mesh.position.set(m.x, (m.y || 0) + 0.012, m.z); group.add(mesh);
    }
  }
  // shell craters (looks only)
  for (const c of map.craters || []) {
    const g = new THREE.CircleGeometry(c.r, 20).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 1, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(c.x, (c.y || 0) + 0.012, c.z); group.add(m);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(c.r, 0.25, 6, 20).rotateX(Math.PI / 2), mats.snowCap);
    rim.scale.y = 0.6; rim.position.set(c.x, (c.y || 0) + 0.05, c.z); group.add(rim);
  }

  out.update = (dt, eye, time) => updateCrust(out, dt, eye, time);
  return out;
}

// The islands: which rooms are on which, their bounds, how mountainous.
function islandsOf(map) {
  const list = map.islands || [{ id: 'all', rooms: map.rooms.map((r) => r.id) }];
  return list.map((I) => {
    const rooms = map.rooms.filter((r) => I.rooms.includes(r.id));
    const B = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
    for (const rm of rooms) { const [a, b, c, d] = rm.rect; B.x0 = Math.min(B.x0, a); B.z0 = Math.min(B.z0, b); B.x1 = Math.max(B.x1, c); B.z1 = Math.max(B.z1, d); }
    return { ...I, rooms, B, mountain: I.id === 'caves' ? 1 : I.id === 'hub' ? 0.35 : 0.3 };
  });
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
  planet('ringed', [0.75, 0.42, -0.6], 26, true);
  planet('red', [-0.6, 0.7, -0.35], 9);
  planet('moon', [-0.35, 0.3, 0.88], 14);
  group.add(sky);
  out.sky = sky;
  const moon = new THREE.DirectionalLight(0x9fb4e0, 0.55);
  moon.position.set(-0.35, 0.6, 0.7).multiplyScalar(50);
  group.add(moon); group.add(moon.target);
}

// --- the frozen sea, out to the horizon, cracked between the islands -------------------------
function buildSea(out, group, isl) {
  const it = iceTexture(); it.repeat.set(36, 36);
  const ice = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: it, roughness: 0.6, metalness: 0.1, emissive: new THREE.Color('#0e1622') }));
  ice.position.set(0, -0.03, -40);
  group.add(ice);
  // dark open-water cracks running between the islands (looks only)
  const crack = new THREE.MeshBasicMaterial({ color: '#06090e', transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const r = R(404);
  const hub = isl.find((i) => i.id === 'hub');
  for (const I of isl) {
    if (I === hub || !hub) continue;
    const a = { x: (hub.B.x0 + hub.B.x1) / 2, z: (hub.B.z0 + hub.B.z1) / 2 }, b = { x: (I.B.x0 + I.B.x1) / 2, z: (I.B.z0 + I.B.z1) / 2 };
    // a jagged lead of open water alongside the line between them
    const side = { x: -(b.z - a.z), z: b.x - a.x }; const sl = Math.hypot(side.x, side.z); side.x /= sl; side.z /= sl;
    let px = a.x + side.x * 22, pz = a.z + side.z * 22;
    for (let k = 0; k < 14; k++) {
      const t = (k + 1) / 14;
      const nx = a.x + (b.x - a.x) * t + side.x * (22 + (r() - 0.5) * 16), nz = a.z + (b.z - a.z) * t + side.z * (22 + (r() - 0.5) * 16);
      const len = Math.hypot(nx - px, nz - pz);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6 + r() * 1.4, len).rotateX(-Math.PI / 2), crack);
      m.position.set((px + nx) / 2, -0.02, (pz + nz) / 2); m.rotation.y = Math.atan2(nx - px, nz - pz);
      group.add(m);
      px = nx; pz = nz;
    }
  }
}

// --- each island's land: flat where the rooms are, rising behind their walls,
//     sloping down into the sea at the edges; mountains over the caves -------------------------
function wallAt(room, side, a) {
  const spec = room.walls && room.walls[side];
  if (!spec || !spec.ranges) return { style: null, height: room.height };
  for (const rg of spec.ranges) {
    const [f, t] = Array.isArray(rg) ? rg : [rg.from, rg.to];
    if (a >= f - 0.01 && a <= t + 0.01) return { style: rg.style || room.style, height: rg.height ?? room.height };
  }
  return { style: null, height: room.height };
}
function buildTerrain(out, group, I, map, mats, r) {
  const M = 16, step = 0.5;
  const x0 = I.B.x0 - M, z0 = I.B.z0 - M, x1 = I.B.x1 + M, z1 = I.B.z1 + M;
  const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
  const geo = new THREE.PlaneGeometry(nx * step, nz * step, nx, nz).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cx = x0 + nx * step / 2, cz = z0 + nz * step / 2;
  const rooms = I.rooms;
  const carve = (rm) => (rm.cave ? rm.height + 0.7 : -0.08);
  const noise = (x, z) => Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.093) * 0.5 + Math.sin(x * 0.31 + z * 0.27) * 0.25 + Math.sin(x * 0.7 - z * 0.53) * 0.12;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx, z = pos.getZ(i) + cz;
    pos.setX(i, x); pos.setZ(i, z);
    let h;
    const inside = rooms.find((rm) => x >= rm.rect[0] && x <= rm.rect[2] && z >= rm.rect[1] && z <= rm.rect[3]);
    if (inside) h = carve(inside);
    else {
      // nearest room, and the wall facing this way
      let best = null, bd = Infinity, wall = null;
      let lowNear = Infinity;
      for (const rm of rooms) {
        const [a0, b0, a1, b1] = rm.rect;
        const dx = Math.max(a0 - x, 0, x - a1), dz = Math.max(b0 - z, 0, z - b1);
        const d = Math.hypot(dx, dz);
        if (d <= 0.55) lowNear = Math.min(lowNear, carve(rm));
        if (d < bd) {
          bd = d; best = rm;
          const side = dx >= dz ? (x < a0 ? 'w' : 'e') : (z < b0 ? 'n' : 's');
          wall = wallAt(rm, side, side === 'n' || side === 's' ? x : z);
        }
      }
      if (lowNear < Infinity) h = lowNear;                        // inside a wall
      else {
        const shore = wall.style === 'invisible';
        const Hn = shore ? 0.35 : best.cave ? best.height + 0.7 : (wall.height ?? best.height);
        h = Hn + (shore ? 0 : I.mountain * Math.min(bd, 26) * 0.55) + noise(x, z) * (shore ? 0.3 : 1.2 + I.mountain * 3);
        // close in behind a low wall (a trench, a hut): don't tower over it
        if (!shore && bd < 3) h = Math.min(h, Hn + bd * 1.2);
        if (shore) h = 0.35 - Math.min(bd, 10) * 0.08 + noise(x, z) * 0.25;
      }
      // down into the sea past the edge of the island
      const ex = Math.max(I.B.x0 - x, 0, x - I.B.x1), ez = Math.max(I.B.z0 - z, 0, z - I.B.z1);
      const e = Math.hypot(ex, ez);
      if (e > 0) h = h * Math.max(0, 1 - e / (M - 2)) - e * 0.12;
    }
    pos.setY(i, h < -0.05 && !inside ? Math.min(h, -0.6) : h);
  }
  geo.computeVertexNormals();
  // snow on the flats, grey rock on the steep bits
  const nrm = geo.attributes.normal, col = new Float32Array(pos.count * 3);
  const snow = new THREE.Color('#dfe6f0'), rock = new THREE.Color('#545a64'), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const k = Math.min(1, Math.max(0, (nrm.getY(i) - 0.55) / 0.3));
    tmp.copy(rock).lerp(snow, k);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, mats.terrain);
  group.add(mesh);
  I.heightAt = (x, z) => {
    const ix = Math.round((x - x0) / step), iz = Math.round((z - z0) / step);
    if (ix < 0 || iz < 0 || ix > nx || iz > nz) return -1;
    return pos.getY(iz * (nx + 1) + ix);
  };
}

// --- snowbanks along the sea edges; a few boulders at the foot of the cliffs ------------------
function buildEdges(out, group, world, mats, r) {
  const caps = [], rocks = [];
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
        g.scale(2.2 + r() * 1.2, 1.0 + r() * 0.7, 1.6 + r() * 0.6);
        const cx = along ? a + (r() - 0.5) * 1.2 : (b.minX + b.maxX) / 2 + ox * (0.9 + r() * 0.8);
        const cz = along ? (b.minZ + b.maxZ) / 2 + oz * (0.9 + r() * 0.8) : a + (r() - 0.5) * 1.2;
        g.translate(cx, -0.25, cz);
        caps.push(flat(g));
      }
      continue;
    }
    if (st !== 'cliff' || b.kind !== 'wall' || rm.cave) continue;
    for (let a = a0 + 1.5; a < a1 - 1.5; a += 5 + r() * 6) {
      if (r() > 0.4) continue;
      const ix = along ? a : (ox > 0 ? b.minX : b.maxX) + ox * 0.05;
      const iz = along ? (oz > 0 ? b.minZ : b.maxZ) + oz * 0.05 : a;
      boulder(ix, 0.15, iz, 0.45 + r() * 0.45);
    }
  }
  if (caps.length) group.add(new THREE.Mesh(mergeAll(caps), mats.snowCap));
  if (rocks.length) group.add(new THREE.Mesh(mergeAll(rocks), mats.rock));
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

// --- the trenches: posts, sandbags along the lip, wire on stakes, snow ----------------------
function buildTrenches(group, world, map, r, mats) {
  const posts = [], bags = [], snow = [], wire = [];
  const box = (list, x0, y0, z0, x1, y1, z1) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); list.push(flat(g)); };
  for (const b of world.walls) {
    const rm = world.roomById.get(b.room);
    if ((b.style || rm.style) !== 'trench' || b.maxY > 3) continue;
    const [ox, oz] = OUTWARD[b.side];
    const along = ox === 0;
    const a0 = along ? b.minX : b.minZ, a1 = along ? b.maxX : b.maxZ;
    const top = b.maxY;
    const px = along ? 0 : 0.12, pz = along ? 0.12 : 0;
    box(bags, b.minX - px, top, b.minZ - pz, b.maxX + px, top + 0.36, b.maxZ + pz);
    box(snow, b.minX - px * 0.8, top + 0.36, b.minZ - pz * 0.8, b.maxX + px * 0.8, top + 0.44, b.maxZ + pz * 0.8);
    if (b.kind !== 'wall') continue;
    const fx = ox > 0 ? b.minX : b.maxX, fz = oz > 0 ? b.minZ : b.maxZ;
    for (let a = a0 + 0.6; a < a1 - 0.3; a += 2.2) {
      if (along) box(posts, a - 0.08, 0, fz - oz * 0.06 - 0.05, a + 0.08, top + 0.1, fz - oz * 0.06 + 0.05);
      else box(posts, fx - ox * 0.06 - 0.05, 0, a - 0.08, fx - ox * 0.06 + 0.05, top + 0.1, a + 0.08);
    }
    if (!rm.outdoor) continue;   // (no wire on a dugout's walls)
    const ex = ox > 0 ? b.maxX + 0.6 : b.minX - 0.6, ez = oz > 0 ? b.maxZ + 0.6 : b.minZ - 0.6;
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
  // dugouts and bunkers: sandbags piled on the roof, snow on them
  for (const rm of map.rooms) {
    if (!(rm.kind === 'dugout' || rm.kind === 'bunker')) continue;
    const [x0, z0, x1, z1] = rm.rect;
    const g = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 1, 0.5, z1 - z0 + 1), mats.sandbag);
    g.position.set((x0 + x1) / 2, rm.height + 0.5, (z0 + z1) / 2); group.add(g);
    const s = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.9, 0.1, z1 - z0 + 0.9), mats.snowCap);
    s.position.set((x0 + x1) / 2, rm.height + 0.8, (z0 + z1) / 2); group.add(s);
  }
}

// --- roofs: gabled and snowed-on over the huts (canvas over the hospital), a
//     snowy cap on every other building, a smoking chimney on the huts --------------------------
function buildRoofs(out, group, map, mats) {
  const roofMat = new THREE.MeshStandardMaterial({ map: CT.boardsTexture({ seed: 21, base: [52, 40, 30] }), roughness: 1 });
  const gableMat = new THREE.MeshStandardMaterial({ map: CT.boardsTexture({ seed: 33, base: [70, 52, 36], vertical: true }), roughness: 1, side: THREE.DoubleSide });
  const stone = new THREE.MeshStandardMaterial({ map: CT.stoneTexture({ seed: 12 }), roughness: 1 });
  for (const rm of map.rooms) {
    const [x0, z0, x1, z1] = rm.rect;
    // (zones, open-topped hulls and towers, walkable roofs: none)
    if (rm.virtual || rm.flatRoof || rm.ceiling === 'none') continue;
    const Y = rm.y || 0;
    if (rm.style === 'cabin' || rm.style === 'canvas') {
      const canvas = rm.style === 'canvas';
      const o = 0.7, H = Y + rm.height + 0.25, rise = canvas ? 2.2 : 1.8;
      const alongX = x1 - x0 >= z1 - z0;
      const L = (alongX ? x1 - x0 : z1 - z0) + 1 + 2 * o;
      const W = (alongX ? z1 - z0 : x1 - x0) + 1 + 2 * o;
      const slope = Math.hypot(W / 2, rise), ang = Math.atan2(rise, W / 2);
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        const pl = new THREE.Mesh(new THREE.BoxGeometry(L, 0.14, slope), canvas ? mats.canvas : roofMat);
        pl.position.set(0, H + rise / 2, s * W / 4); pl.rotation.x = s * ang;
        g.add(pl);
        const sn = new THREE.Mesh(new THREE.BoxGeometry(L * 0.98, 0.1, slope * 0.95), mats.snowCap);
        sn.position.set(0, H + rise / 2 + 0.12, s * W / 4); sn.rotation.x = s * ang;
        g.add(sn);
      }
      const hw = W / 2 - o;
      const tri = new THREE.Shape([new THREE.Vector2(-hw, 0), new THREE.Vector2(hw, 0), new THREE.Vector2(0, rise * hw / (W / 2))]);
      for (const s of [-1, 1]) {
        const ge = new THREE.Mesh(new THREE.ShapeGeometry(tri), canvas ? mats.canvas : gableMat);
        ge.rotation.y = Math.PI / 2; ge.position.set(s * (L / 2 - o), H, 0);
        g.add(ge);
      }
      g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      if (!alongX) g.rotation.y = Math.PI / 2;
      group.add(g);
      if (!canvas) {
        const chx = x1 - 1.4, chz = (z0 + z1) / 2 + 1.2;
        const ch = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.8, 0.9), stone);
        ch.position.set(chx, H + 1.4, chz); group.add(ch);
        out.smoke.push({ x: chx, y: H + 2.9, z: chz, puffs: null });
      }
    } else if (!rm.outdoor && !rm.cave && rm.style !== 'hull' && rm.kind !== 'dugout' && rm.kind !== 'bunker') {
      // a flat roof with snow on it (over the ceiling slab)
      const s = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 1, 0.12, z1 - z0 + 1), mats.snowCap);
      s.position.set((x0 + x1) / 2, Y + rm.height + (rm.ceiling === 'trusses' ? 0.36 : 0.31), (z0 + z1) / 2); group.add(s);
    }
  }
}

// --- a ship frozen into the sea ice round its rooms -----------------------------------------
function buildShip(out, group, map, S, r, mats) {
  const rooms = S.rooms.map((id) => map.rooms.find((q) => q.id === id)).filter(Boolean);
  if (!rooms.length) return;
  const x0 = Math.min(...rooms.map((q) => q.rect[0])), z0 = Math.min(...rooms.map((q) => q.rect[1]));
  const x1 = Math.max(...rooms.map((q) => q.rect[2])), z1 = Math.max(...rooms.map((q) => q.rect[3]));
  const Tw = map.wallThickness;
  const Hh = Math.max(...rooms.map((q) => q.height));
  const H = Hh + 0.3;
  const ship = new THREE.Group();
  const zc = (z0 + z1) / 2, half = (z1 - z0) / 2 + Tw;
  const big = x1 - x0 > 30;
  const stern = x0 - (big ? 9 : 4), bowStart = x1 + Tw, bow = x1 + (big ? 14 : 9);
  const plate = (xa, xb, ya, yb, zs) => { const m = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, yb - ya, 0.4), mats.hull); m.position.set((xa + xb) / 2, (ya + yb) / 2, zs); ship.add(m); };
  for (const s of [-1, 1]) {
    const zs = zc + s * (half + 0.2);
    plate(stern, x0 - Tw, -0.5, H + 1.1, zs);
    plate(x0 - Tw, x1 + Tw, Hh, H + 1.1, zs);
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
  const shape = new THREE.Shape([
    new THREE.Vector2(stern, -(zc - half)), new THREE.Vector2(bowStart, -(zc - half)), new THREE.Vector2(bow, -zc),
    new THREE.Vector2(bowStart, -(zc + half)), new THREE.Vector2(stern, -(zc + half)),
  ]);
  const dg = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  const deck = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ color: '#4a3e34', roughness: 1, side: THREE.DoubleSide }));
  deck.position.y = H; ship.add(deck);
  const dsn = new THREE.Mesh(dg, mats.snowCap); dsn.position.y = H + 0.05; ship.add(dsn);
  const brX = stern + (big ? 7 : 4);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(big ? 9 : 5, 4.2, half * 1.4), mats.paint);
  bridge.position.set(brX, H + 2.1, zc); ship.add(bridge);
  const top = new THREE.Mesh(new THREE.BoxGeometry(big ? 6 : 4, 2.2, half * 1.2), mats.paint);
  top.position.set(brX + 0.5, H + 5.3, zc); ship.add(top);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), mats.window);
    w.position.set(brX - 1.6 + i * 1.1, H + 5.6, zc + s * (half * 0.6 + 0.02));
    if (s < 0) w.rotation.y = Math.PI;
    ship.add(w);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry((big ? 6 : 4) + 0.3, 0.15, half * 1.25), mats.snowCap); roof.position.set(brX + 0.5, H + 6.48, zc); ship.add(roof);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 6, 18), mats.hullRed);
  funnel.position.set(brX + (big ? 8 : 5), H + 3, zc); funnel.rotation.z = 0.1; ship.add(funnel);
  const rig = [];
  for (const mx of big ? [brX + 17, x1 + 7] : [x1 + 3]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 14, 8), mats.iron);
    mast.position.set(mx, H + 7, zc); ship.add(mast);
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, half * 1.6, 6).rotateX(Math.PI / 2), mats.iron);
    yard.position.set(mx, H + 11, zc); ship.add(yard);
    for (const s of [-1, 1]) rig.push(mx, H + 13.5, zc, mx - 3, H + 0.5, zc + s * half, mx, H + 13.5, zc, mx + 3, H + 0.5, zc + s * half);
  }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rig, 3));
  ship.add(new THREE.LineSegments(rg, mats.wire));
  group.add(ship);
  out.smoke.push({ x: brX + (big ? 8.3 : 5.3), y: H + 6, z: zc, puffs: null, big: true });
}

// --- pines on the high ground of each island ---------------------------------------------
function buildForest(out, group, isl, map, r, mats) {
  const trunk = new THREE.CylinderGeometry(0.15, 0.25, 2, 6);
  const needles = new THREE.ConeGeometry(1, 2.2, 8);
  out.trunk = trunk; out.needles = needles;
  const spots = [];
  for (const I of isl) {
    const want = I.id === 'caves' ? 30 : 45;
    let got = 0;
    for (let i = 0; i < 1500 && got < want; i++) {
      const x = I.B.x0 - 10 + r() * (I.B.x1 - I.B.x0 + 20), z = I.B.z0 - 10 + r() * (I.B.z1 - I.B.z0 + 20);
      if (map.rooms.some((rm) => x > rm.rect[0] - 2.5 && x < rm.rect[2] + 2.5 && z > rm.rect[1] - 2.5 && z < rm.rect[3] + 2.5)) continue;
      const h = I.heightAt ? I.heightAt(x, z) : 0;
      if (h < 1.5) continue;
      spots.push([x, z, 0.8 + r() * 1.2, h]);
      got++;
    }
  }
  const tiers = 3;
  const tIm = new THREE.InstancedMesh(trunk, mats.bark, spots.length);
  const nIm = new THREE.InstancedMesh(needles, mats.pine, spots.length * tiers);
  const cIm = new THREE.InstancedMesh(needles, mats.snowCap, spots.length * tiers);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  spots.forEach(([x, z, s, base], i) => {
    m4.compose(ps.set(x, base + s, z), q.identity(), sc.set(s, s, s)); tIm.setMatrixAt(i, m4);
    for (let k = 0; k < tiers; k++) {
      const w = (1.6 - k * 0.4) * s, y = base + s * (1.8 + k * 1.3);
      m4.compose(ps.set(x, y, z), q.identity(), sc.set(w, s * 1.1, w)); nIm.setMatrixAt(i * tiers + k, m4);
      m4.compose(ps.set(x, y + 0.25 * s, z), q.identity(), sc.set(w * 0.82, s * 0.7, w * 0.82)); cIm.setMatrixAt(i * tiers + k, m4);
    }
  });
  group.add(tIm, nIm, cIm);
}

// --- far away: the plant and its four stacks (the final fight); mountains all round -----------
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
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,230,190,0.9)', 'rgba(255,200,140,0)'), color: new THREE.Color(1.2, 1.0, 0.8), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(14, 10, 1); glow.position.set(s.x, 4, s.z + 3); plant.add(glow);
  });
  group.add(plant);
  out.plant = { group: plant, center: new THREE.Vector3(sx, 0, sz), D: 230 };
  out.stackHeads = stackHeads;

  const ring = new THREE.Group();
  const mtnMat = new THREE.MeshStandardMaterial({ color: '#5f6c80', roughness: 1, flatShading: true, emissive: new THREE.Color('#121826'), fog: false });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + (r() - 0.5) * 0.15, d = 300;
    const north = Math.max(0, -Math.sin(a));
    const h = (34 + r() * 40) * (1 - north * 0.6), w = 50 + r() * 40;
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

// --- a launcher pad: a steel disc, a glowing ring in the colour of where it sends you ----------
function buildPad(out, group, L, map, mats, mv) {
  const dest = map.launchers.find((q) => q.id === L.to);
  const isl = (map.islands || []).find((i) => i.rooms.includes(dest.room));
  const el = isl && isl.element ? ELEMENT[isl.element] : { color: new THREE.Color(2.4, 2.0, 1.2), light: 0xffd9a0 };
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.12, 32), mats.steel); disc.position.y = 0.06; g.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.07, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: el.color }));
  ring.position.y = 0.14; g.add(ring);
  const inner = new THREE.Mesh(new THREE.RingGeometry(0.4, 1.6, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: el.color, transparent: true, opacity: 0.25, depthWrite: false }));
  inner.position.y = 0.13; g.add(inner);
  // four pylons, and an arrow on the deck pointing the way you'll go
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    const py = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.4, 0.25), mats.iron); py.position.set(Math.cos(a) * 2.7, 0.7, Math.sin(a) * 2.7); g.add(py);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: el.color })); lamp.position.set(Math.cos(a) * 2.7, 1.45, Math.sin(a) * 2.7); g.add(lamp);
  }
  const dir = Math.atan2(dest.x - L.x, dest.z - L.z);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 3).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: el.color }));
  arrow.scale.y = 0.15; arrow.position.set(Math.sin(dir) * 1.1, 0.15, Math.cos(dir) * 1.1); arrow.rotation.y = dir; g.add(arrow);
  g.position.set(L.x, L.y || 0, L.z);
  group.add(g);
  out.spin.push({ obj: inner, rate: 0.8 });
  mv.addVirtualLight({ x: L.x, y: (L.y || 0) + 1.2, z: L.z }, el.light, 10, 9, 1.6);
}
// --- the props (collision comes from the map data) -------------------------------------------
function buildProps(out, root, world, r, mats, mv0) {
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  for (const b of world.propBoxes) {
    const p = b.prop;
    // each prop stands where it stands (on a rim, a deck, a plinth): built at
    // its foot, lifted there
    const base = b.minY;
    const group = new THREE.Group(); group.position.y = base; root.add(group);
    const mv = base ? { addVirtualLight: (q, ...a) => mv0.addVirtualLight({ ...q, y: q.y + base }, ...a) } : mv0;
    const add = (geo, mat, x, y, z, ry = 0, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, w = b.maxX - b.minX, d = b.maxZ - b.minZ, h = b.maxY - b.minY;
    const alongX = w >= d, L = Math.max(w, d), Wd = Math.min(w, d), ry = alongX ? 0 : Math.PI / 2;
    switch (p.kind) {
      case 'truck': group.add(truck(cx, cz, w, d, p.yaw || 0, mats.snowCap)); break;
      case 'crate': {
        add(B(w, h, d), crateMat(), cx, h / 2, cz, 0.05);
        add(B(w * 0.96, 0.06, d * 0.96), mats.snowCap, cx, h + 0.03, cz);
        break;
      }
      case 'barrel': out.fires.push(fireBarrel(mv, group, cx, cz, h)); break;
      case 'rock': {
        const g = new THREE.DodecahedronGeometry(1, 1);
        const pp = g.attributes.position;
        for (let i = 0; i < pp.count; i++) { const k = 0.8 + r() * 0.4; pp.setXYZ(i, pp.getX(i) * k, pp.getY(i) * k, pp.getZ(i) * k); }
        g.computeVertexNormals();
        const m = add(g, mats.rock, cx, h * 0.38, cz); m.scale.set(w * 0.6, h * 0.75, d * 0.6);
        const cap = add(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), mats.snowCap, cx, h * 0.82, cz); cap.scale.set(w * 0.45, h * 0.25, d * 0.45);
        break;
      }
      case 'pine': {
        const s = 1.9;
        add(out.trunk, mats.bark, cx, s, cz).scale.setScalar(s);
        for (let k = 0; k < 4; k++) {
          const ww = (1.8 - k * 0.38) * s, y = s * (1.6 + k * 1.15);
          add(out.needles, mats.pine, cx, y, cz).scale.set(ww, s * 1.1, ww);
          add(out.needles, mats.snowCap, cx, y + 0.3 * s, cz).scale.set(ww * 0.8, s * 0.65, ww * 0.8);
        }
        break;
      }
      case 'sign': {
        add(B(0.16, 2.4, 0.16), mats.bark, cx, 1.2, cz);
        const board = new THREE.Mesh(B(2.2, 1.1, 0.08), [mats.bark, mats.bark, mats.bark, mats.bark, new THREE.MeshStandardMaterial({ map: signTexture(p.text || ['THE STACKS', '']), roughness: 0.9 }), mats.bark]);
        board.position.set(cx, 1.85, cz + 0.12); board.rotation.y = 0.08; group.add(board);
        break;
      }
      case 'lighthouse': out.beams.push(lighthouse(group, cx, cz, Math.min(w, d) / 2, h, mats, mv)); break;
      case 'iceberg': {
        const g = new THREE.DodecahedronGeometry(1, 0);
        const pp = g.attributes.position;
        for (let i = 0; i < pp.count; i++) { const k = 0.8 + r() * 0.4; pp.setXYZ(i, pp.getX(i) * k, pp.getY(i) * k, pp.getZ(i) * k); }
        g.computeVertexNormals();
        const m = add(g, mats.ice, cx, h * 0.35, cz, r() * 3); m.scale.set(w * 0.62, h * 0.75, d * 0.62);
        add(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), mats.snowCap, cx, h * 0.85, cz).scale.set(w * 0.4, h * 0.2, d * 0.4);
        break;
      }
      case 'boat': {
        const g = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        add(g, new THREE.MeshStandardMaterial({ color: '#3c4a52', roughness: 0.9 }), cx, 0, cz).scale.set(w / 2, h, d / 2);
        add(g, mats.snowCap, cx, h * 0.62, cz).scale.set(w * 0.42, h * 0.5, d * 0.42);
        break;
      }
      case 'rack': {
        for (const s of [-1, 1]) for (const k of [-1, 1]) {
          const leg = add(B(0.08, h + 0.2, 0.08), mats.wood, alongX ? cx + s * L / 2 : cx + k * 0.25, h / 2, alongX ? cz + k * 0.25 : cz + s * L / 2);
          if (alongX) leg.rotation.x = k * 0.16; else leg.rotation.z = k * 0.16;
        }
        const pole = add(new THREE.CylinderGeometry(0.04, 0.04, L, 6), mats.wood, cx, h, cz);
        if (alongX) pole.rotation.z = Math.PI / 2; else pole.rotation.x = Math.PI / 2;
        const fish = new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.6, metalness: 0.3 });
        for (let a = -L / 2 + 0.3; a < L / 2; a += 0.35) add(B(0.05, 0.42, 0.12), fish, alongX ? cx + a : cx, h - 0.28, alongX ? cz : cz + a, r());
        break;
      }
      case 'anvil': buildAnvil(out, group, cx, cz, w, h, mats, mv, p.blank); break;
      case 'shrine': buildShrine(out, group, cx, cz, h, p.element, mats, mv); break;
      case 'wreck': {
        // twisted plates from whatever came through the portal with them
        for (let k = 0; k < 5; k++) {
          const m = add(B(1 + r() * (L * 0.6), 0.12, 0.6 + r() * Wd * 0.6), mats.iron, cx + (r() - 0.5) * w * 0.6, 0.3 + r() * h * 0.7, cz + (r() - 0.5) * d * 0.6, r() * 3);
          m.rotation.x = (r() - 0.5) * 1.4; m.rotation.z = (r() - 0.5) * 1.2;
        }
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(120,255,160,1)', 'rgba(40,200,120,0)'), color: new THREE.Color(0.6, 2.2, 1.0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.scale.setScalar(2.2); glow.position.set(cx, 0.6, cz); group.add(glow);
        out.glows.push({ s: glow, base: 2.2, rate: 3 + r() * 2 });
        break;
      }
      case 'tent': {
        const g = new THREE.Group();
        const slope = Math.hypot(Wd / 2, h), ang = Math.atan2(h, Wd / 2);
        for (const s of [-1, 1]) {
          const pl = new THREE.Mesh(B(L, 0.05, slope), mats.canvas); pl.position.set(0, h / 2, s * Wd / 4); pl.rotation.x = s * ang; g.add(pl);
          const sn = new THREE.Mesh(B(L * 0.95, 0.06, slope * 0.6), mats.snowCap); sn.position.set(0, h * 0.72, s * Wd / 6); sn.rotation.x = s * ang; g.add(sn);
        }
        g.position.set(cx, 0, cz); g.rotation.y = ry; group.add(g);
        break;
      }
      case 'telescope': {
        add(new THREE.CylinderGeometry(1.3, 1.6, 0.8, 16), mats.stone, cx, 0.4, cz);
        const tube = add(new THREE.CylinderGeometry(0.45, 0.6, 5.2, 18), new THREE.MeshStandardMaterial({ color: '#8a6a3a', roughness: 0.4, metalness: 0.8 }), cx, 2.6, cz);
        tube.rotation.z = 0.7; tube.rotation.y = 0.6;
        break;
      }
      case 'shelves': {
        const g = new THREE.Group();
        for (const y of [0.05, 1.0, 2.0, 3.0]) { const s = new THREE.Mesh(B(L, 0.06, Wd), mats.steel); s.position.y = y; g.add(s); }
        for (let a = -L / 2; a <= L / 2 + 0.01; a += L / Math.max(1, Math.round(L / 2.5))) for (const k of [-1, 1]) { const u = new THREE.Mesh(B(0.06, h, 0.06), mats.steel); u.position.set(a, h / 2, k * Wd / 2); g.add(u); }
        for (let i = 0; i < Math.round(L * 1.5); i++) { const c = new THREE.Mesh(B(0.5 + r() * 0.4, 0.4 + r() * 0.3, Wd * 0.8), crateMat()); c.position.set(-L / 2 + 0.4 + r() * (L - 0.8), [0.3, 1.25, 2.25][Math.floor(r() * 3)], 0); g.add(c); }
        g.position.set(cx, 0, cz); g.rotation.y = ry; group.add(g);
        break;
      }
      case 'boiler': {
        const t = add(new THREE.CylinderGeometry(Wd / 2, Wd / 2, L, 20), mats.hullRed, cx, h / 2, cz); t.rotation.z = Math.PI / 2; t.rotation.y = ry;
        add(new THREE.CylinderGeometry(0.3, 0.3, 3, 10), mats.iron, cx, h + 1.2, cz);
        break;
      }
      case 'heliwreck': {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 3.2, 6, 12).rotateZ(Math.PI / 2), mats.olive); body.position.set(0, 1.2, 0); body.rotation.x = 0.25; g.add(body);
        const boom = new THREE.Mesh(B(4.2, 0.4, 0.4), mats.olive); boom.position.set(-3.6, 1.6, 0.5); boom.rotation.z = 0.12; boom.rotation.y = 0.3; g.add(boom);
        for (let k = 0; k < 3; k++) { const bl = new THREE.Mesh(B(4.5, 0.05, 0.25), mats.iron); bl.position.set(0.5, 2.6 - k * 0.2, 0); bl.rotation.set((r() - 0.5) * 0.6, k * 2.1, (r() - 0.5) * 0.5); g.add(bl); }
        const sn = new THREE.Mesh(B(3, 0.1, 1.6), mats.snowCap); sn.position.set(0.3, 2.35, 0); g.add(sn);
        g.position.set(cx, 0, cz); g.rotation.y = alongX ? 0 : Math.PI / 2; group.add(g);
        break;
      }
      case 'radiotower': {
        const g = new THREE.Group();
        const lines = [];
        const base = Math.min(w, d) / 2, topW = 0.4;
        const corner = (k, y) => { const s = base + (topW - base) * (y / h); return [(k & 1 ? 1 : -1) * s, y, (k & 2 ? 1 : -1) * s]; };
        for (let k = 0; k < 4; k++) { const a = corner(k, 0), b2 = corner(k, h); lines.push(...a, ...b2); }
        for (let y = 0; y < h; y += 2.5) for (const [k1, k2] of [[0, 1], [1, 3], [3, 2], [2, 0]]) { lines.push(...corner(k1, y), ...corner(k2, y + 2.5)); lines.push(...corner(k1, y + 2.5), ...corner(k2, y + 2.5)); }
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
        g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#8a2a22' })));
        const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,80,60,1)', 'rgba(255,20,10,0)'), color: new THREE.Color(3, 0.4, 0.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        lamp.scale.setScalar(2.4); lamp.position.y = h + 0.5; g.add(lamp);
        out.stackHeads.push({ lamp, phase: 0.5 });
        g.position.set(cx, 0, cz); group.add(g);
        break;
      }
      case 'dish': {
        add(new THREE.CylinderGeometry(0.25, 0.4, h * 0.6, 10), mats.steel, cx, h * 0.3, cz);
        const bowl = add(new THREE.SphereGeometry(L / 2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3.2), mats.white, cx, h * 0.62, cz);
        bowl.rotation.x = -1.0; bowl.material.side = THREE.DoubleSide;
        break;
      }
      case 'generator': {
        add(B(w, h * 0.8, d), mats.olive, cx, h * 0.4, cz);
        add(B(w * 0.3, h * 0.5, d * 0.9), new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.5 }), cx - w * 0.3, h * 0.45, cz);
        add(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8), mats.iron, cx + w * 0.3, h + 0.3, cz);
        break;
      }
      case 'labbench': {
        add(B(w, 0.1, d), mats.white, cx, h, cz);
        add(B(w * 0.96, h - 0.1, d * 0.9), mats.steel, cx, (h - 0.1) / 2, cz);
        for (let i = 0; i < 5; i++) { const f = add(new THREE.CylinderGeometry(0.07, 0.1, 0.3, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3 + r(), 1.4, 0.6 + r()) }), cx - w / 2 + 0.6 + r() * (w - 1.2), h + 0.2, cz + (r() - 0.5) * d * 0.6); void f; }
        break;
      }
      case 'servers': {
        const g = new THREE.Group();
        const n = Math.max(1, Math.round(L / 1.1));
        for (let i = 0; i < n; i++) {
          const rack = new THREE.Mesh(B(1.0, h, Wd), new THREE.MeshStandardMaterial({ color: '#1a1c20', roughness: 0.5, metalness: 0.4 }));
          rack.position.set(-L / 2 + 0.55 + i * (L - 1.1) / Math.max(1, n - 1), h / 2, 0); g.add(rack);
          for (let k = 0; k < 6; k++) { const led = new THREE.Mesh(B(0.05, 0.05, 0.02), mats.screen); led.position.set(rack.position.x - 0.3 + r() * 0.6, 0.4 + k * 0.32, Wd / 2 + 0.01); g.add(led); }
        }
        g.position.set(cx, 0, cz); g.rotation.y = ry; group.add(g);
        break;
      }
      case 'teslacoil': {
        add(new THREE.CylinderGeometry(w * 0.5, w * 0.6, 0.6, 16), mats.iron, cx, 0.3, cz);
        add(new THREE.CylinderGeometry(w * 0.22, w * 0.28, h - 1.6, 14), new THREE.MeshStandardMaterial({ color: '#b87333', roughness: 0.35, metalness: 0.9 }), cx, 0.6 + (h - 1.6) / 2, cz);
        add(new THREE.TorusGeometry(w * 0.45, w * 0.16, 10, 24).rotateX(Math.PI / 2), mats.steel, cx, h - 0.8, cz);
        const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(220,190,255,1)', 'rgba(150,90,255,0)'), color: new THREE.Color(2, 1.2, 3.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        spark.scale.setScalar(2.4); spark.position.set(cx, h - 0.6, cz); group.add(spark);
        out.glows.push({ s: spark, base: 2.4, rate: 17, crackle: true });
        mv.addVirtualLight({ x: cx, y: h - 0.6, z: cz }, 0xb58aff, 12, 10, 1.6);
        break;
      }
      case 'fueltank': {
        const t = add(new THREE.CylinderGeometry(Wd / 2 * 0.95, Wd / 2 * 0.95, L, 20), mats.white, cx, h / 2 + 0.2, cz); t.rotation.z = Math.PI / 2; t.rotation.y = ry;
        add(B(L * 0.9, 0.1, Wd * 0.7), mats.snowCap, cx, h + 0.15, cz, ry);
        break;
      }
      case 'snowcat': {
        const g = new THREE.Group();
        for (const s of [-1, 1]) { const tr = new THREE.Mesh(B(L, 0.8, 0.7), mats.iron); tr.position.set(0, 0.4, s * (Wd / 2 - 0.35)); g.add(tr); }
        const body = new THREE.Mesh(B(L * 0.9, 0.9, Wd * 0.9), new THREE.MeshStandardMaterial({ color: '#b8401c', roughness: 0.8 })); body.position.y = 1.25; g.add(body);
        const cab = new THREE.Mesh(B(L * 0.4, 0.9, Wd * 0.85), body.material); cab.position.set(L * 0.2, 2.0, 0); g.add(cab);
        const sn = new THREE.Mesh(B(L * 0.4, 0.1, Wd * 0.8), mats.snowCap); sn.position.set(L * 0.2, 2.5, 0); g.add(sn);
        g.position.set(cx, 0, cz); g.rotation.y = ry; group.add(g);
        break;
      }
      case 'biplane': {
        const g = new THREE.Group();
        const body = new THREE.Mesh(B(L * 0.75, 1.0, 1.0), new THREE.MeshStandardMaterial({ color: '#5a4a30', roughness: 0.9 })); body.position.set(0, 0.8, 0); body.rotation.z = -0.18; g.add(body);
        const wingMat = new THREE.MeshStandardMaterial({ color: '#6a2a20', roughness: 0.9 });
        const w1 = new THREE.Mesh(B(1.6, 0.08, Wd * 1.0), wingMat); w1.position.set(L * 0.12, 0.7, 0); w1.rotation.x = 0.12; g.add(w1);
        const w2 = new THREE.Mesh(B(1.6, 0.08, Wd * 0.55), wingMat); w2.position.set(L * 0.12, 2.0, Wd * 0.18); w2.rotation.x = -0.4; w2.rotation.z = 0.2; g.add(w2);
        const tail = new THREE.Mesh(B(0.9, 0.9, 0.1), wingMat); tail.position.set(-L * 0.38, 1.4, 0); g.add(tail);
        const prop = new THREE.Mesh(B(0.1, 2.2, 0.18), mats.darkWood); prop.position.set(L * 0.4, 0.5, 0); prop.rotation.x = 1.1; g.add(prop);
        g.position.set(cx, 0, cz); g.rotation.y = alongX ? 0 : Math.PI / 2; group.add(g);
        out.fires.push(fireBarrel(mv, group, cx + 0.8, cz + 0.4, 0.6));
        break;
      }
      case 'ruinwall': {
        const n = Math.max(2, Math.round(L / 0.7));
        for (let i = 0; i < n; i++) {
          const hh = h * (0.4 + r() * 0.6);
          add(B(L / n * 0.98, hh, Wd), mats.stone, alongX ? b.minX + (i + 0.5) * L / n : cx, hh / 2, alongX ? cz : b.minZ + (i + 0.5) * L / n);
        }
        break;
      }
      case 'fieldgun': {
        const g = new THREE.Group();
        for (const s of [-1, 1]) { const wh = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 6, 16), mats.darkWood); wh.position.set(0, 0.65, s * 0.9); g.add(wh); }
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, L * 0.8, 10), mats.iron); barrel.rotation.z = Math.PI / 2 - 0.35; barrel.position.set(L * 0.15, 1.2, 0); g.add(barrel);
        const shield = new THREE.Mesh(B(0.1, 1.0, 1.8), mats.olive); shield.position.set(0.2, 1.0, 0); g.add(shield);
        const trail = new THREE.Mesh(B(L * 0.5, 0.12, 0.2), mats.olive); trail.position.set(-L * 0.25, 0.35, 0); trail.rotation.z = 0.2; g.add(trail);
        g.position.set(cx, 0, cz); g.rotation.y = alongX ? 0 : Math.PI / 2; group.add(g);
        break;
      }
      case 'tank': {
        const sh = new THREE.Shape([new THREE.Vector2(-L / 2, 0.3), new THREE.Vector2(-L / 2 + 1.2, 0), new THREE.Vector2(L / 2 - 1.2, 0), new THREE.Vector2(L / 2, 0.6), new THREE.Vector2(L / 2 - 0.6, h), new THREE.Vector2(-L / 2 + 0.6, h)]);
        const geo = new THREE.ExtrudeGeometry(sh, { depth: Wd, bevelEnabled: false }).translate(0, 0, -Wd / 2);
        const m = add(geo, mats.olive, cx, 0, cz, ry);
        void m;
        add(B(L * 0.5, 0.12, Wd * 0.8), mats.snowCap, cx, h + 0.06, cz, ry);
        break;
      }
      case 'cots': {
        const n = Math.max(1, Math.round(L / 2.3));
        for (let i = 0; i < n; i++) {
          const a = -L / 2 + (i + 0.5) * L / n;
          add(B(alongX ? 0.8 : Wd, h * 0.4, alongX ? Wd : 0.8), mats.olive, alongX ? cx + a : cx, h * 0.5, alongX ? cz : cz + a);
          add(B(alongX ? 0.85 : Wd * 0.9, 0.08, alongX ? Wd * 0.9 : 0.85), new THREE.MeshStandardMaterial({ color: '#8a7a5a', roughness: 1 }), alongX ? cx + a : cx, h * 0.72, alongX ? cz : cz + a);
        }
        break;
      }
      case 'standing': {
        const g = new THREE.BoxGeometry(w, h, d, 1, 3, 1);
        const pp = g.attributes.position;
        for (let i = 0; i < pp.count; i++) { if (pp.getY(i) > 0) { pp.setX(i, pp.getX(i) * 0.75); pp.setZ(i, pp.getZ(i) * 0.75); } }
        g.computeVertexNormals();
        add(g, new THREE.MeshStandardMaterial({ map: CT.runeTexture(31 + Math.floor(cx), '#b8ffd0'), emissive: new THREE.Color('#ffffff'), emissiveMap: CT.runeTexture(31 + Math.floor(cx), '#b8ffd0'), emissiveIntensity: 0.8, roughness: 1 }), cx, h / 2, cz);
        add(B(w * 0.8, 0.1, d * 0.8), mats.snowCap, cx, h + 0.05, cz);
        break;
      }
      case 'crystal': {
        const cm = new THREE.MeshStandardMaterial({ color: '#8fe0ff', roughness: 0.15, metalness: 0.1, emissive: new THREE.Color('#2a9adf'), emissiveIntensity: 1.2, transparent: true, opacity: 0.88, flatShading: true });
        for (let k = 0; k < 5; k++) {
          const s = h * (0.45 + r() * 0.55);
          const c = add(new THREE.OctahedronGeometry(1, 0), cm, cx + (r() - 0.5) * w * 0.5, s * 0.45, cz + (r() - 0.5) * d * 0.5, r() * 3);
          c.scale.set(w * 0.22, s * 0.6, d * 0.22); c.rotation.z = (r() - 0.5) * 0.5;
        }
        mv.addVirtualLight({ x: cx, y: h * 0.6, z: cz }, 0x7ad0ff, 26, 15, 1.5);
        break;
      }
      case 'icefall': {
        const g = new THREE.CylinderGeometry(1, 1.2, 1, 14, 6, true);
        const pp = g.attributes.position;
        for (let i = 0; i < pp.count; i++) { const k = 0.8 + r() * 0.35; pp.setX(i, pp.getX(i) * k); pp.setZ(i, pp.getZ(i) * k); }
        g.computeVertexNormals();
        const m = add(g, mats.ice, cx, h / 2, cz); m.scale.set(w / 2, h, d / 2);
        add(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.ice, cx, 0, cz).scale.set(w * 0.9, 0.6, d * 0.7);
        break;
      }
      case 'minecart': {
        add(B(w, h * 0.7, d), mats.iron, cx, h * 0.55, cz);
        for (const s of [-1, 1]) for (const k of [-1, 1]) add(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10).rotateX(Math.PI / 2), mats.darkWood, cx + s * w * 0.35, 0.2, cz + k * d * 0.5);
        add(B(w * 0.85, 0.25, d * 0.85), mats.rock, cx, h * 0.92, cz);
        // the rails it sits on
        for (const s of [-1, 1]) add(B(alongX ? L + 6 : 0.08, 0.06, alongX ? 0.08 : L + 6), mats.iron, alongX ? cx : cx + s * 0.45, 0.03, alongX ? cz + s * 0.45 : cz);
        break;
      }
      case 'shed': {
        add(B(w, h, d), new THREE.MeshStandardMaterial({ map: tinTexture(), roughness: 0.7, metalness: 0.4 }), cx, h / 2, cz);
        add(B(w + 0.6, 0.15, d + 0.6), mats.snowCap, cx, h + 0.08, cz);
        add(B(1.2, 2.0, 0.05), mats.darkWood, cx + w / 2 - 1.2, 1.0, cz + d / 2 + 0.03);
        break;
      }
      default: break;
    }
  }
}

// THE ANVIL: a stepped stone base, a great anvil of black iron on a carved
// pillar, and four sockets glowing with the four elements (each facing the
// island its War Hammer comes from). The rituals will come together here.
function buildAnvil(out, group, cx, cz, w, h, mats, mv, blank = false) {
  const g = new THREE.Group();
  const tiers = [[w, 1.6], [w * 0.82, 1.4], [w * 0.64, 1.2]];
  let y = 0;
  for (const [s, th] of tiers) { const t = new THREE.Mesh(new THREE.BoxGeometry(s, th, s), mats.stone); t.position.y = y + th / 2; g.add(t); y += th; const sn = new THREE.Mesh(new THREE.BoxGeometry(s * 0.98, 0.08, s * 0.98), mats.snowCap); sn.position.y = y + 0.02; g.add(sn); }
  const rune = CT.runeTexture(77, '#ffd27a');
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.36, h * 0.42, w * 0.36), new THREE.MeshStandardMaterial({ map: rune, emissive: new THREE.Color('#ffffff'), emissiveMap: rune, emissiveIntensity: 0.9, roughness: 1 }));
  pillar.position.y = y + h * 0.21; g.add(pillar);
  y += h * 0.42;
  // the anvil itself: feet, waist, face and horn
  const iron = new THREE.MeshStandardMaterial({ color: '#1e2024', roughness: 0.45, metalness: 0.9 });
  const feet = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.0, w * 0.42), iron); feet.position.y = y + 0.5; g.add(feet);
  const waist = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, 1.8, w * 0.26), iron); waist.position.y = y + 1.9; g.add(waist);
  const face = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 1.5, w * 0.34), iron); face.position.y = y + 3.55; g.add(face);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(w * 0.17, w * 0.45, 16).rotateZ(-Math.PI / 2), iron); horn.position.set(w * 0.43 + w * 0.22, y + 3.7, 0); g.add(horn);
  const sn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.1, w * 0.32), mats.snowCap); sn.position.y = y + 4.33; g.add(sn);
  // the four sockets (N ice, E lightning, S fire, W wind)
  const socket = [['ice', 0, -1], ['lightning', 1, 0], ['fire', 0, 1], ['wind', -1, 0]];
  for (const [el, sx, sz] of socket) {
    const E = ELEMENT[el];
    const px = sx * w * 0.41, pz = sz * w * 0.41, py = 3.2;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.5, 12), iron); cup.position.set(px, py, pz); g.add(cup);
    if (blank) {
      // empty: a dark socket waiting for its War Hammer, a faint rune of its element
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#030304' }));
      hole.position.set(px, py + 0.26, pz); g.add(hole);
      const rune = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: E.color.clone().multiplyScalar(0.18) }));
      rune.position.set(px, py + 0.27, pz); g.add(rune);
      continue;
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: E.color })); gem.position.set(px, py + 0.6, pz); g.add(gem);
    out.spin.push({ obj: gem, rate: 1.2 });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: E.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(2.4); halo.position.set(px, py + 0.6, pz); g.add(halo);
    out.glows.push({ s: halo, base: 2.4, rate: 1.5 });
    mv.addVirtualLight({ x: cx + px * 1.25, y: py + 0.6, z: cz + pz * 1.25 }, E.light, 14, 12, 1.6);
  }
  g.position.set(cx, 0, cz);
  group.add(g);
  // a ring of runes cut into the floor round it
  const ringTex = CT.runeTexture(19, '#ffd27a');
  const ring = new THREE.Mesh(new THREE.RingGeometry(w * 0.62, w * 0.7, 64, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex, color: new THREE.Color(1.4, 1.1, 0.6), transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  ring.position.set(cx, 0.02, cz); group.add(ring);
  out.spin.push({ obj: ring, rate: 0.05 });
}

// An element's shrine: a dark obelisk with the element burning in it.
function buildShrine(out, group, cx, cz, h, element, mats, mv) {
  const E = ELEMENT[element] || ELEMENT.fire;
  const g = new THREE.BoxGeometry(1.2, h, 1.2, 1, 2, 1);
  const pp = g.attributes.position;
  for (let i = 0; i < pp.count; i++) if (pp.getY(i) > 0) { pp.setX(i, pp.getX(i) * 0.6); pp.setZ(i, pp.getZ(i) * 0.6); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mats.darkStone); m.position.set(cx, h / 2, cz); group.add(m);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.4, 8), mats.stone); base.position.set(cx, 0.2, cz); group.add(base);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshBasicMaterial({ color: E.color })); gem.position.set(cx, h + 0.6, cz); group.add(gem);
  out.spin.push({ obj: gem, rate: 0.9, bob: h + 0.6 });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: E.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(3); halo.position.set(cx, h + 0.6, cz); group.add(halo);
  out.glows.push({ s: halo, base: 3, rate: 2 });
  mv.addVirtualLight({ x: cx, y: h + 0.6, z: cz }, E.light, 16, 12, 1.6);
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
  if (!S.placed) { for (let i = 0; i < p.length; i += 3) { p[i] += eye.x; p[i + 2] += eye.z; p[i + 1] += eye.y - 4; } S.placed = true; }
  const end = S.count * 3;
  for (let i = 0; i < end; i += 3) {
    const kk = i / 3;
    p[i + 1] -= dt * (1.1 + (kk % 7) * 0.12);
    p[i] += dt * (0.6 + Math.sin(time * 0.7 + S.drift[kk]) * 0.5);
    p[i + 2] += dt * Math.cos(time * 0.5 + S.drift[kk]) * 0.3;
    const lx = p[i] - eye.x, lz = p[i + 2] - eye.z, ly = p[i + 1] - eye.y;
    if (lx > b.x / 2) p[i] -= b.x; else if (lx < -b.x / 2) p[i] += b.x;
    if (lz > b.z / 2) p[i + 2] -= b.z; else if (lz < -b.z / 2) p[i + 2] += b.z;
    if (ly < -8) p[i + 1] += b.y; else if (ly > b.y - 8) p[i + 1] -= b.y;
  }
  S.flakes.geometry.attributes.position.needsUpdate = true;
  // aviation lights blink; the fires dance; the lighthouse turns; things glow and spin
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
  for (const s of W.spin) { s.obj.rotation.y += dt * s.rate; if (s.bob) s.obj.position.y = s.bob + Math.sin(time * 1.4) * 0.15; }
  for (const gl of W.glows) {
    const f = gl.crackle ? (Math.sin(time * gl.rate) > 0.3 ? 1 : 0.35) * (0.7 + Math.random() * 0.5) : 0.8 + Math.sin(time * gl.rate) * 0.2;
    gl.s.scale.setScalar(gl.base * f);
  }
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
