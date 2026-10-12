// =============================================================================
// Call of the Crust: painted textures for the frozen battlefield (all drawn on
// canvases, no image files). Mud with snow, trench planks, sandbags, field
// stone, church stone, stained glass, scorched brick, rusted iron, glowing
// runes, and the overcast alien sky with its two moons and green streaks.
// =============================================================================
import * as T from './textures.js';

export const R = (s) => { let x = s >>> 0 || 1; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; };
const tex = (c, repeat = true, srgb = true) => T.toTexture(c, { repeat, srgb });

// Churned black-brown mud, frozen, with snow lying in the hollows and boot prints.
export function mudTexture({ snow = 0.35, seed = 11, size = 512 } = {}) {
  const S = size, [c, g] = T.makeCanvas(S, S), r = R(seed);
  g.fillStyle = '#4a3b2e'; g.fillRect(0, 0, S, S);
  const n = T.noiseCanvas(S, 6, 5);
  g.globalAlpha = 0.55; g.globalCompositeOperation = 'multiply'; g.drawImage(n, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // wet, darker smears and lighter dried clods
  for (let i = 0; i < 420; i++) {
    const x = r() * S, y = r() * S, w = 4 + r() * 30;
    g.fillStyle = r() < 0.55 ? `rgba(20,14,10,${0.15 + r() * 0.3})` : `rgba(110,90,70,${0.08 + r() * 0.16})`;
    g.beginPath(); g.ellipse(x, y, w, w * (0.3 + r() * 0.5), r() * 3, 0, 7); g.fill();
  }
  // boot prints and ruts
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, a = r() * 6.28;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = 'rgba(15,10,6,0.35)'; g.beginPath(); g.ellipse(0, 0, 5, 11, 0, 0, 7); g.fill();
    g.restore();
  }
  // snow: lying in patches, dusted over everything
  if (snow > 0) {
    // (soft-edged drifts in finer noise, so it reads as snow in the ruts, not cow hide)
    const sn = T.noiseCanvas(S, 6, 6);
    const [mc, mg] = T.makeCanvas(S, S);
    mg.drawImage(sn, 0, 0);
    const img = mg.getImageData(0, 0, S, S), d = img.data;
    const cut = 1 - snow;
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] / 255;
      const a = Math.max(0, Math.min(1, (v - cut) / 0.3));
      d[i] = 214; d[i + 1] = 221; d[i + 2] = 230; d[i + 3] = a * a * (3 - 2 * a) * 205;
    }
    mg.putImageData(img, 0, 0);
    g.drawImage(mc, 0, 0);
    for (let i = 0; i < 3500; i++) { g.fillStyle = `rgba(235,240,248,${r() * 0.55})`; g.fillRect(r() * S, r() * S, 1 + r(), 1 + r()); }
  }
  return tex(c);
}

// Wet black mud and an icy puddle skin (crater bottoms).
export function puddleTexture() {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(7);
  const gr = g.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S / 2);
  gr.addColorStop(0, '#1a1e24'); gr.addColorStop(0.55, '#20201e'); gr.addColorStop(0.8, '#2c241c'); gr.addColorStop(1, 'rgba(44,36,28,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    let x = S / 2 + (r() - 0.5) * S * 0.6, y = S / 2 + (r() - 0.5) * S * 0.6;
    g.strokeStyle = `rgba(190,205,220,${0.08 + r() * 0.15})`; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  return tex(c, false);
}

// Horizontal boards with posts showing between (trench revetments, duckboards, barn).
export function boardsTexture({ base = [70, 54, 38], seed = 3, vertical = false, gaps = true } = {}) {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(seed);
  const boards = 8, bh = S / boards;
  for (let i = 0; i < boards; i++) {
    const k = 0.75 + r() * 0.35;
    g.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`;
    if (vertical) g.fillRect(i * bh, 0, bh, S); else g.fillRect(0, i * bh, S, bh);
    // grain
    for (let j = 0; j < 10; j++) {
      g.strokeStyle = `rgba(20,12,6,${0.08 + r() * 0.15})`; g.lineWidth = 0.6 + r();
      g.beginPath();
      if (vertical) { const x = i * bh + r() * bh; g.moveTo(x, 0); g.bezierCurveTo(x + r() * 4 - 2, S * 0.3, x + r() * 4 - 2, S * 0.6, x, S); }
      else { const y = i * bh + r() * bh; g.moveTo(0, y); g.bezierCurveTo(S * 0.3, y + r() * 4 - 2, S * 0.6, y + r() * 4 - 2, S, y); }
      g.stroke();
    }
    if (gaps) { g.fillStyle = 'rgba(8,5,3,0.75)'; if (vertical) g.fillRect(i * bh, 0, 2, S); else g.fillRect(0, i * bh, S, 2); }
  }
  // mud splashed up from the bottom, frost on top
  const mud = g.createLinearGradient(0, S, 0, S * 0.55);
  mud.addColorStop(0, 'rgba(40,30,22,0.75)'); mud.addColorStop(1, 'rgba(40,30,22,0)');
  if (!vertical) { g.fillStyle = mud; g.fillRect(0, S * 0.55, S, S * 0.45); }
  for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(210,220,232,${r() * 0.18})`; g.fillRect(r() * S, r() * S, 1, 1); }
  return tex(c);
}

// Rows of burlap sandbags.
export function sandbagTexture() {
  // (one tile is 2 m square in the world: bags half a metre long, 25 cm high)
  const W = 256, H = 256, [c, g] = T.makeCanvas(W, H), r = R(21);
  g.fillStyle = '#3e3628'; g.fillRect(0, 0, W, H);
  const rows = 8, rh = H / rows;
  for (let j = 0; j < rows; j++) {
    const off = (j % 2 ? 32 : 0) + Math.floor(r() * 10);
    for (let x = -64 + off; x < W + 64; x += 64) {
      const k = 0.8 + r() * 0.3;
      const gr = g.createRadialGradient(x + 32, j * rh + rh * 0.4, 4, x + 32, j * rh + rh / 2, 40);
      gr.addColorStop(0, `rgb(${124 * k},${110 * k},${82 * k})`); gr.addColorStop(1, `rgb(${62 * k},${54 * k},${40 * k})`);
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(x + 32, j * rh + rh / 2, 31, rh / 2 - 1, 0, 0, 7); g.fill();
      // stitching and the tied end
      g.strokeStyle = 'rgba(40,32,20,0.6)'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(x + 6, j * rh + rh / 2); g.lineTo(x + 58, j * rh + rh / 2); g.stroke(); g.setLineDash([]);
    }
  }
  for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(r() * W, r() * H, 1, 1); }
  // snow along the tops of the bags
  for (let j = 0; j < rows; j++) for (let x = 0; x < W; x += 3) { g.fillStyle = `rgba(230,236,244,${0.35 + r() * 0.4})`; g.fillRect(x, j * rh + 1, 3, 1 + r() * 3); }
  return tex(c);
}

// Stone walls: rough fieldstone (farm), dressed blocks (church, workshop).
export function stoneTexture({ dressed = false, base = [96, 92, 86], seed = 31, burnt = 0 } = {}) {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(seed);
  g.fillStyle = `rgb(${base[0] * 0.45},${base[1] * 0.45},${base[2] * 0.45})`; g.fillRect(0, 0, S, S);
  if (dressed) {
    const rows = 8, rh = S / rows;
    for (let j = 0; j < rows; j++) {
      let x = j % 2 ? -rh : 0;
      while (x < S) {
        const w = rh * (1.4 + r() * 1.2), k = 0.75 + r() * 0.35;
        g.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`;
        g.fillRect(x + 1.5, j * rh + 1.5, w - 3, rh - 3);
        x += w;
      }
    }
  } else {
    for (let i = 0; i < 160; i++) {
      const x = r() * S, y = r() * S, w = 10 + r() * 22, k = 0.7 + r() * 0.45;
      g.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`;
      g.beginPath(); g.ellipse(x, y, w, w * (0.5 + r() * 0.3), r() * 0.6, 0, 7); g.fill();
    }
  }
  const n = T.noiseCanvas(S, 5, 6);
  g.globalAlpha = 0.35; g.globalCompositeOperation = 'multiply'; g.drawImage(n, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // soot and scorching (burnt down from the top)
  if (burnt) {
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, `rgba(12,10,8,${0.75 * burnt})`); gr.addColorStop(0.6, `rgba(12,10,8,${0.25 * burnt})`); gr.addColorStop(1, 'rgba(12,10,8,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }
  // damp stains
  for (let i = 0; i < 18; i++) {
    const x = r() * S, y = r() * S * 0.5, len = 30 + r() * 140;
    const gr = g.createLinearGradient(0, y, 0, y + len);
    gr.addColorStop(0, `rgba(20,24,20,${0.1 + r() * 0.15})`); gr.addColorStop(1, 'rgba(20,24,20,0)');
    g.fillStyle = gr; g.fillRect(x, y, 2 + r() * 6, len);
  }
  return tex(c);
}

// A pointed window of coloured glass, lead lines, some panes blown out.
export function stainedGlassTexture(seed = 5) {
  const W = 128, H = 256, [c, g] = T.makeCanvas(W, H), r = R(seed);
  g.clearRect(0, 0, W, H);
  g.save();
  g.beginPath(); g.moveTo(8, H); g.lineTo(8, H * 0.35); g.quadraticCurveTo(8, 6, W / 2, 4); g.quadraticCurveTo(W - 8, 6, W - 8, H * 0.35); g.lineTo(W - 8, H); g.closePath();
  g.clip();
  const cols = ['#8a1a20', '#1d3c8a', '#c09a20', '#2a6a38', '#6a2a7a', '#b04a18'];
  for (let y = 0; y < H; y += 18) for (let x = 0; x < W; x += 18) {
    const broken = r() < 0.28;
    g.fillStyle = broken ? '#050506' : cols[Math.floor(r() * cols.length)];
    g.fillRect(x + (r() - 0.5) * 6, y + (r() - 0.5) * 6, 18 + r() * 6, 18 + r() * 6);
  }
  // lead
  g.strokeStyle = '#141414'; g.lineWidth = 3;
  for (let y = 0; y < H; y += 18) { g.beginPath(); g.moveTo(0, y + r() * 4); g.lineTo(W, y + r() * 4); g.stroke(); }
  for (let x = 0; x < W; x += 18) { g.beginPath(); g.moveTo(x + r() * 4, 0); g.lineTo(x + r() * 4, H); g.stroke(); }
  g.restore();
  g.strokeStyle = '#2a2622'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(8, H); g.lineTo(8, H * 0.35); g.quadraticCurveTo(8, 6, W / 2, 4); g.quadraticCurveTo(W - 8, 6, W - 8, H * 0.35); g.lineTo(W - 8, H); g.stroke();
  return tex(c, false);
}

// Scorched dark brick for the stacks, glowing hot toward the top.
export function stackBrickTexture(seed = 9) {
  const W = 128, H = 1024, [c, g] = T.makeCanvas(W, H), r = R(seed);
  g.fillStyle = '#1e1714'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 6) {
    const off = (y / 6) % 2 ? 8 : 0;
    for (let x = -off; x < W; x += 16) {
      const k = 0.6 + r() * 0.5;
      g.fillStyle = `rgb(${70 * k},${36 * k},${26 * k})`;
      g.fillRect(x + 1, y + 1, 14, 4);
    }
  }
  // soot running down, and heat glow round the top
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = r() * H * 0.6, len = 60 + r() * 400;
    const gr = g.createLinearGradient(0, y, 0, y + len);
    gr.addColorStop(0, `rgba(6,4,4,${0.3 + r() * 0.4})`); gr.addColorStop(1, 'rgba(6,4,4,0)');
    g.fillStyle = gr; g.fillRect(x, y, 2 + r() * 6, len);
  }
  const hot = g.createLinearGradient(0, 0, 0, H * 0.12);
  hot.addColorStop(0, 'rgba(255,120,40,0.55)'); hot.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = hot; g.fillRect(0, 0, W, H * 0.12);
  // iron bands
  g.fillStyle = 'rgba(20,18,18,0.9)';
  for (const y of [0.04, 0.2, 0.38, 0.56, 0.74, 0.9]) g.fillRect(0, y * H, W, 5);
  return tex(c, false);
}

// Rusted plate iron (the tank, the field gun, corrugated roofs).
export function rustTexture({ corrugated = false, seed = 13, base = [74, 52, 36] } = {}) {
  const S = 256, [c, g] = T.makeCanvas(S, S), r = R(seed);
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, S, S);
  const n = T.noiseCanvas(S, 6, 4);
  g.globalAlpha = 0.6; g.globalCompositeOperation = 'multiply'; g.drawImage(n, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  for (let i = 0; i < 220; i++) {
    const x = r() * S, y = r() * S, w = 3 + r() * 16;
    g.fillStyle = r() < 0.5 ? `rgba(140,70,30,${0.15 + r() * 0.3})` : `rgba(30,26,24,${0.15 + r() * 0.3})`;
    g.beginPath(); g.ellipse(x, y, w, w * 0.7, r() * 3, 0, 7); g.fill();
  }
  if (corrugated) for (let x = 0; x < S; x += 8) { g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x, 0, 3, S); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 4, 0, 3, S); }
  else for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(20,16,14,0.6)'; g.beginPath(); g.arc(r() * S, r() * S, 2, 0, 7); g.fill(); }   // rivets
  return tex(c);
}

// Glowing runes cut into dark basalt (the old stones in the pit).
export function runeTexture(seed = 17, glow = '#5dffc8') {
  const W = 128, H = 512, [c, g] = T.makeCanvas(W, H), r = R(seed);
  g.fillStyle = '#16181c'; g.fillRect(0, 0, W, H);
  const n = T.noiseCanvas(W, 5, 4);
  g.globalAlpha = 0.5; for (let y = 0; y < H; y += W) g.drawImage(n, 0, y); g.globalAlpha = 1;
  g.strokeStyle = glow; g.lineWidth = 3; g.shadowColor = glow; g.shadowBlur = 10;
  for (let y = 40; y < H - 30; y += 46) {
    const x = W / 2 + (r() - 0.5) * 20;
    g.beginPath();
    const kind = Math.floor(r() * 4);
    if (kind === 0) { g.moveTo(x - 14, y - 14); g.lineTo(x, y + 14); g.lineTo(x + 14, y - 14); }
    else if (kind === 1) { g.arc(x, y, 12, 0.4, 5.6); g.moveTo(x, y - 18); g.lineTo(x, y + 18); }
    else if (kind === 2) { g.moveTo(x - 14, y); g.lineTo(x + 14, y); g.moveTo(x - 8, y - 14); g.lineTo(x + 8, y + 14); g.moveTo(x + 8, y - 14); g.lineTo(x - 8, y + 14); }
    else { g.rect(x - 10, y - 12, 20, 24); g.moveTo(x - 10, y); g.lineTo(x + 10, y); }
    g.stroke();
  }
  return tex(c, false);
}

// The sky: low overcast, grey and cold, torn in places; strange green streaks
// running through the clouds. (The moons are separate, in front.)
export function overcastSkyTexture(fog) {
  const W = 2048, H = 1024, [c, g] = T.makeCanvas(W, H), r = R(808);
  const sky = g.createLinearGradient(0, 0, 0, H / 2);
  sky.addColorStop(0, '#1b2028'); sky.addColorStop(0.5, '#2c333d'); sky.addColorStop(0.85, '#3a414b'); sky.addColorStop(1, fog);
  g.fillStyle = sky; g.fillRect(0, 0, W, H / 2);
  g.fillStyle = fog; g.fillRect(0, H / 2, W, H / 2);
  // cloud masses: big soft lumps, lighter on top
  for (let i = 0; i < 900; i++) {
    const y = Math.pow(r(), 0.8) * H * 0.48, x = r() * W, rad = 30 + r() * 140 * (0.4 + y / H);
    const l = 40 + r() * 40 + (1 - y / (H / 2)) * -10;
    const gr = g.createRadialGradient(x, y - rad * 0.2, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${l + 14},${l + 18},${l + 24},${0.08 + r() * 0.1})`); gr.addColorStop(1, `rgba(${l},${l + 4},${l + 10},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // breaks in the cloud, a few stars through them
  for (let i = 0; i < 14; i++) {
    const x = r() * W, y = H * (0.05 + r() * 0.25), rw = 80 + r() * 200, rh = 14 + r() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, rw);
    gr.addColorStop(0, 'rgba(6,8,14,0.55)'); gr.addColorStop(1, 'rgba(6,8,14,0)');
    g.save(); g.scale(1, rh / rw); g.fillStyle = gr; g.fillRect(x - rw, (y * rw) / rh - rw, rw * 2, rw * 2); g.restore();
    for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(230,236,255,${r() * 0.7})`; g.fillRect(x + (r() - 0.5) * rw * 1.2, y + (r() - 0.5) * rh * 1.2, 1.2, 1.2); }
  }
  // the green streaks: long glowing ribbons through the clouds
  g.globalCompositeOperation = 'lighter';
  for (let s = 0; s < 6; s++) {
    let x = r() * W, y = H * (0.08 + r() * 0.28);
    const len = 500 + r() * 700, ang = (r() - 0.5) * 0.5;
    for (let k = 0; k < len; k += 6) {
      x += Math.cos(ang) * 6; y += Math.sin(ang) * 6 + Math.sin(k * 0.01 + s) * 1.6;
      const rad = 10 + Math.sin(k * 0.02 + s * 2) * 6 + r() * 6;
      const a = 0.05 * Math.sin((k / len) * Math.PI);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(110,255,150,${a * 1.6})`); gr.addColorStop(1, 'rgba(60,255,120,0)');
      g.fillStyle = gr; g.fillRect((x % W + W) % W - rad, y - rad, rad * 2, rad * 2);
    }
  }
  g.globalCompositeOperation = 'source-over';
  return tex(c, false);
}

// A moon face, pale and cratered, lit from one side.
export function moonTexture(seed = 3, tint = [236, 238, 232]) {
  const S = 512, [c, g] = T.makeCanvas(S, S), r = R(seed);
  const [a, b, d] = tint;
  const gr = g.createRadialGradient(S * 0.38, S * 0.36, S * 0.05, S / 2, S / 2, S * 0.5);
  gr.addColorStop(0, `rgb(${a},${b},${d})`); gr.addColorStop(0.6, `rgb(${a * 0.78},${b * 0.78},${d * 0.8})`); gr.addColorStop(1, `rgb(${a * 0.45},${b * 0.46},${d * 0.5})`);
  g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.fill();
  g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.clip();
  // maria and craters
  for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(80,84,90,0.18)'; g.beginPath(); g.ellipse(r() * S, r() * S, 40 + r() * 90, 30 + r() * 60, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, cr = 3 + r() * 22;
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.arc(x, y, cr, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x - 1, y - 1, cr, 3.6, 5.6); g.stroke();
  }
  const sh = g.createRadialGradient(S * 0.3, S * 0.28, S * 0.3, S * 0.4, S * 0.4, S * 0.82);
  sh.addColorStop(0, 'rgba(10,12,18,0)'); sh.addColorStop(1, 'rgba(10,12,18,0.8)');
  g.fillStyle = sh; g.fillRect(0, 0, S, S);
  g.restore();
  return tex(c, false);
}

// The radio set's front: dials, switches, a lit valve window.
export function radioTexture() {
  const W = 256, H = 128, [c, g] = T.makeCanvas(W, H);
  g.fillStyle = '#3a3a2c'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1a1a14'; g.lineWidth = 4; g.strokeRect(4, 4, W - 8, H - 8);
  for (const [x, y, rad] of [[50, 60, 24], [120, 60, 18], [180, 46, 14]]) {
    g.fillStyle = '#d8d2b8'; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rad * 0.7, y - rad * 0.5); g.stroke();
  }
  g.fillStyle = '#ffb040'; g.fillRect(160, 80, 50, 16);
  g.fillStyle = '#111'; for (let x = 30; x < 240; x += 26) g.fillRect(x, 100, 8, 14);
  return tex(c, false);
}
