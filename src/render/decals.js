// =============================================================================
// Posters, banners, notes and graffiti, painted on canvases. Every picture is
// drawn here in code; map data says where they go (map.decals).
// =============================================================================
import { makeCanvas, toTexture } from './textures.js';

let _s = 99;
const rnd = () => { _s = (_s * 16807) % 2147483647; return (_s - 1) / 2147483646; };
const rr = (a, b) => a + (b - a) * rnd();

const IMPACT = 'Impact, "Arial Black", "Helvetica Neue", sans-serif';
const NARROW = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const HAND = '"Bradley Hand", "Segoe Print", "Comic Sans MS", "Marker Felt", cursive';
const CHALK = '"Chalkboard SE", "Comic Sans MS", "Segoe Print", cursive';

// --- shared ageing ------------------------------------------------------------
function paper(g, W, H, base = '#e8e0c8') {
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  // fibres and blotches
  for (let i = 0; i < W * H / 260; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(90,70,40,0.05)' : 'rgba(255,255,240,0.05)';
    g.fillRect(rr(0, W), rr(0, H), rr(1, 4), rr(1, 4));
  }
}

function age(g, W, H, amount = 1) {
  // yellowed edges
  const grd = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
  grd.addColorStop(0, 'rgba(120,90,30,0)');
  grd.addColorStop(1, `rgba(110,80,30,${0.35 * amount})`);
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // water stains
  for (let i = 0; i < 4 * amount; i++) {
    const x = rr(0, W), y = rr(0, H), r = rr(W * 0.05, W * 0.22);
    g.strokeStyle = `rgba(110,80,40,${rr(0.08, 0.2)})`; g.lineWidth = rr(1, 3);
    g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    g.fillStyle = 'rgba(120,90,40,0.06)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // dirt specks and a bloody smear or two
  for (let i = 0; i < 160 * amount; i++) {
    g.fillStyle = `rgba(30,20,10,${rr(0.05, 0.25)})`;
    g.fillRect(rr(0, W), rr(0, H), rr(1, 3), rr(1, 3));
  }
  if (rnd() < 0.5 * amount) {
    const x = rr(0, W), y = rr(0, H);
    g.fillStyle = 'rgba(80,8,6,0.45)';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(x + i * 8, y + i * 3, rr(4, 12), rr(10, 30), rr(-0.5, 0.5), 0, 7); g.fill(); }
  }
  // creases
  g.strokeStyle = 'rgba(60,40,20,0.12)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, H * rr(0.3, 0.7)); g.lineTo(W, H * rr(0.3, 0.7)); g.stroke();
}

function tape(g, x, y, w = 60, h = 22, a = 0) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = 'rgba(230,225,190,0.55)'; g.fillRect(-w / 2, -h / 2, w, h);
  g.restore();
}

function tear(g, W, H) {
  g.globalCompositeOperation = 'destination-out';
  const corner = Math.floor(rr(0, 4));
  const cx = corner % 2 ? W : 0, cy = corner > 1 ? H : 0;
  g.beginPath(); g.moveTo(cx, cy);
  const sx = cx ? -1 : 1, sy = cy ? -1 : 1;
  g.lineTo(cx + sx * rr(30, 90), cy);
  g.lineTo(cx + sx * rr(10, 30), cy + sy * rr(10, 30));
  g.lineTo(cx, cy + sy * rr(30, 80));
  g.fill();
  g.globalCompositeOperation = 'source-over';
}

function text(g, str, x, y, font, color, align = 'center', maxW = 0) {
  g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic';
  if (maxW) g.fillText(str, x, y, maxW); else g.fillText(str, x, y);
}

// Spray paint: soft overspray halo, then drips running down.
function spray(g, str, x, y, size, color, { rot = 0, drips = 10, font = IMPACT } = {}) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.font = `900 ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const w = g.measureText(str).width;
  g.shadowColor = color; g.shadowBlur = size * 0.12;
  g.fillStyle = color; g.globalAlpha = 0.9;
  g.fillText(str, 0, 0);
  g.shadowBlur = 0; g.globalAlpha = 1;
  g.fillText(str, 0, 0);
  // drips
  g.fillStyle = color;
  for (let i = 0; i < drips; i++) {
    const dx = rr(-w / 2 + size * 0.1, w / 2 - size * 0.1), len = rr(size * 0.15, size * 0.8), dw = rr(2, size * 0.05);
    g.fillRect(dx, -size * 0.05, dw, len);
    g.beginPath(); g.arc(dx + dw / 2, len, dw * 0.9, 0, 7); g.fill();
  }
  // speckle
  g.globalAlpha = 0.5;
  for (let i = 0; i < 200; i++) g.fillRect(rr(-w / 2 - 20, w / 2 + 20), rr(-size, size * 0.2), 1.5, 1.5);
  g.restore();
}

// Erik's school-picture face: side part, glasses, too many teeth.
function erikFace(g, cx, cy, s, { graffiti = false } = {}) {
  g.save(); g.translate(cx, cy);
  // shoulders + blazer + tie
  g.fillStyle = '#23304a'; g.beginPath(); g.ellipse(0, s * 1.15, s * 0.95, s * 0.55, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#e9e4d6'; g.beginPath(); g.moveTo(-s * 0.18, s * 0.62); g.lineTo(s * 0.18, s * 0.62); g.lineTo(0, s * 0.95); g.fill();
  g.fillStyle = '#8a1a14'; g.beginPath(); g.moveTo(-s * 0.06, s * 0.66); g.lineTo(s * 0.06, s * 0.66); g.lineTo(s * 0.04, s * 1.0); g.lineTo(-s * 0.04, s * 1.0); g.fill();
  // head
  g.fillStyle = '#d9b08a'; g.beginPath(); g.ellipse(0, 0, s * 0.45, s * 0.56, 0, 0, 7); g.fill();
  // hair, hard side part
  g.fillStyle = '#5a3a1c';
  g.beginPath(); g.ellipse(0, -s * 0.32, s * 0.48, s * 0.3, 0, Math.PI, 0); g.fill();
  g.beginPath(); g.moveTo(-s * 0.48, -s * 0.3); g.quadraticCurveTo(-s * 0.1, -s * 0.5, s * 0.48, -s * 0.18); g.lineTo(s * 0.48, -s * 0.36); g.fill();
  g.strokeStyle = '#d9b08a'; g.lineWidth = s * 0.02; g.beginPath(); g.moveTo(-s * 0.2, -s * 0.58); g.lineTo(-s * 0.16, -s * 0.36); g.stroke();
  // glasses
  g.strokeStyle = '#1a1a1a'; g.lineWidth = s * 0.035;
  for (const sx of [-1, 1]) { g.beginPath(); g.rect(sx * s * 0.2 - s * 0.13, -s * 0.1, s * 0.26, s * 0.17); g.stroke(); }
  g.beginPath(); g.moveTo(-s * 0.07, -s * 0.03); g.lineTo(s * 0.07, -s * 0.03); g.stroke();
  g.fillStyle = '#1a1a1a';
  for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * s * 0.2, -s * 0.02, s * 0.035, 0, 7); g.fill(); }
  // big grin
  g.fillStyle = '#5a1810'; g.beginPath(); g.ellipse(0, s * 0.25, s * 0.22, s * 0.11, 0, 0, Math.PI); g.fill();
  g.fillStyle = '#f3efe0'; g.fillRect(-s * 0.2, s * 0.25, s * 0.4, s * 0.05);
  if (graffiti) {
    // drawn-on moustache, horns and a speech bubble
    g.strokeStyle = '#111'; g.lineWidth = s * 0.05; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-s * 0.25, s * 0.2); g.quadraticCurveTo(-s * 0.1, s * 0.08, 0, s * 0.17); g.quadraticCurveTo(s * 0.1, s * 0.08, s * 0.25, s * 0.2); g.stroke();
    g.beginPath(); g.moveTo(-s * 0.3, -s * 0.5); g.lineTo(-s * 0.38, -s * 0.85); g.lineTo(-s * 0.16, -s * 0.58); g.stroke();
    g.beginPath(); g.moveTo(s * 0.3, -s * 0.5); g.lineTo(s * 0.38, -s * 0.85); g.lineTo(s * 0.16, -s * 0.58); g.stroke();
  }
  g.restore();
}

// --- the posters ----------------------------------------------------------------
const PAINTERS = {
  vote(g, W, H, d) {
    paper(g, W, H, '#ece6d2');
    g.fillStyle = '#1f3566'; g.fillRect(0, 0, W, H * 0.16);
    g.fillStyle = '#9a1f18'; g.fillRect(0, H * 0.16, W, H * 0.025);
    text(g, 'VOTE', W / 2, H * 0.125, `900 ${H * 0.11}px ${IMPACT}`, '#f4efe0');
    g.fillStyle = '#c9c3ae'; g.fillRect(W * 0.14, H * 0.22, W * 0.72, H * 0.42);
    g.save(); g.beginPath(); g.rect(W * 0.14, H * 0.22, W * 0.72, H * 0.42); g.clip();
    erikFace(g, W / 2, H * 0.43, H * 0.17, { graffiti: d.graffiti });
    g.restore();
    text(g, 'ERIK MADSEN', W / 2, H * 0.73, `900 ${H * 0.085}px ${IMPACT}`, '#1f3566', 'center', W * 0.92);
    text(g, 'FOR CLASS PRESIDENT', W / 2, H * 0.8, `700 ${H * 0.045}px ${NARROW}`, '#9a1f18', 'center', W * 0.9);
    text(g, 'Order. Discipline. Hot Lunch.', W / 2, H * 0.87, `italic ${H * 0.036}px ${SERIF}`, '#333', 'center', W * 0.9);
    g.fillStyle = '#1f3566'; g.fillRect(0, H * 0.93, W, H * 0.07);
    age(g, W, H);
    if (d.graffiti) {
      spray(g, 'STEW', W * 0.5, H * 0.66, H * 0.2, '#c8261c', { rot: -0.22, drips: 9 });
      spray(g, 'WAS HERE', W * 0.55, H * 0.9, H * 0.07, '#111', { rot: -0.08, drips: 4, font: HAND });
    }
    tape(g, W * 0.12, 10, 70, 22, -0.4); tape(g, W * 0.88, 10, 70, 22, 0.4);
    if (rnd() < 0.6) tear(g, W, H);
  },
  pennant(g, W, H) {
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#6a1714';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(W, H / 2); g.lineTo(0, H); g.closePath(); g.fill();
    g.fillStyle = '#e2c46a'; g.fillRect(0, 0, W * 0.07, H);
    g.save(); g.beginPath(); g.moveTo(0, 0); g.lineTo(W, H / 2); g.lineTo(0, H); g.closePath(); g.clip();
    text(g, 'GO MAD DOGS', W * 0.42, H * 0.6, `900 ${H * 0.28}px ${IMPACT}`, '#e2c46a');
    // paw
    g.fillStyle = '#e2c46a';
    g.beginPath(); g.ellipse(W * 0.13, H * 0.55, H * 0.08, H * 0.07, 0, 0, 7); g.fill();
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(W * 0.13 + (i - 1.5) * H * 0.055, H * 0.42 - Math.abs(i - 1.5) * -H * 0.02, H * 0.028, 0, 7); g.fill(); }
    age(g, W, H, 0.6);
    g.restore();
  },
  reunion(g, W, H) {
    // butcher paper, hand painted
    paper(g, W, H, '#d9cfb0');
    const cols = ['#9a1f18', '#1f3566', '#a8781c', '#2a5a2a'];
    const str = "WELCOME BACK CLASS OF '16!";
    g.font = `900 ${H * 0.42}px ${HAND}`;
    const total = g.measureText(str).width;
    let x = W / 2 - Math.min(total, W * 0.94) / 2;
    const k = Math.min(1, (W * 0.94) / total);
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const w = g.measureText(ch).width * k;
      g.save(); g.translate(x + w / 2, H * 0.55 + Math.sin(i * 1.7) * H * 0.04); g.rotate(rr(-0.08, 0.08));
      text(g, ch, 0, 0, `900 ${H * 0.42 * k}px ${HAND}`, cols[i % cols.length]);
      g.restore();
      x += w;
    }
    text(g, '10 YEAR REUNION  ★  TONIGHT  ★  DINNER IN THE CAFETERIA', W / 2, H * 0.86, `700 ${H * 0.11}px ${NARROW}`, '#3a2c1a', 'center', W * 0.92);
    // streamer scallops
    g.fillStyle = '#9a1f18';
    for (let i = 0; i < W; i += H * 0.3) { g.beginPath(); g.arc(i + H * 0.15, 0, H * 0.15, 0, Math.PI); g.fill(); }
    age(g, W, H, 0.8);
    // a long rip and a bloody handprint
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo(W * 0.7, H); g.lineTo(W * 0.73, H * 0.45); g.lineTo(W * 0.76, H * 0.7); g.lineTo(W * 0.79, H); g.fill();
    g.globalCompositeOperation = 'source-over';
    hand(g, W * 0.3, H * 0.5, H * 0.32);
  },
  noRunning(g, W, H) {
    paper(g, W, H, '#f0e9cf');
    g.strokeStyle = '#9a1f18'; g.lineWidth = H * 0.04; g.strokeRect(H * 0.05, H * 0.05, W - H * 0.1, H - H * 0.1);
    text(g, 'NO RUNNING', W / 2, H * 0.36, `900 ${H * 0.22}px ${IMPACT}`, '#9a1f18', 'center', W * 0.86);
    text(g, 'IN THE HALLS', W / 2, H * 0.55, `900 ${H * 0.13}px ${IMPACT}`, '#222', 'center', W * 0.8);
    text(g, 'Violators WILL be reported.', W / 2, H * 0.71, `italic ${H * 0.07}px ${SERIF}`, '#333', 'center', W * 0.8);
    text(g, '— E. Madsen, Hall Monitor', W / 2, H * 0.84, `${H * 0.065}px ${HAND}`, '#1f3566', 'center', W * 0.8);
    age(g, W, H);
    text(g, 'lol', W * 0.82, H * 0.24, `${H * 0.09}px ${HAND}`, '#111');
    tape(g, W / 2, 6, 60, 18, 0.1);
  },
  menu(g, W, H) {
    // chalkboard in a wood frame
    g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1e2a22'; g.fillRect(H * 0.06, H * 0.06, W - H * 0.12, H - H * 0.12);
    g.globalAlpha = 0.12; g.fillStyle = '#fff';
    for (let i = 0; i < 30; i++) g.fillRect(rr(0, W), rr(0, H), rr(30, 160), rr(8, 30));
    g.globalAlpha = 1;
    const c = 'rgba(235,235,225,0.9)';
    text(g, "TODAY'S LUNCH", W / 2, H * 0.22, `${H * 0.13}px ${CHALK}`, c);
    text(g, 'STEW', W / 2, H * 0.52, `900 ${H * 0.3}px ${CHALK}`, '#e8c070');
    text(g, "Chef's special — Erik's recipe!", W / 2, H * 0.68, `${H * 0.075}px ${CHALK}`, c);
    text(g, 'Seconds: STEW   •   Dessert: also stew', W / 2, H * 0.82, `${H * 0.065}px ${CHALK}`, c);
    // a smiley that someone gave fangs
    g.strokeStyle = c; g.lineWidth = 3;
    g.beginPath(); g.arc(W * 0.86, H * 0.4, H * 0.08, 0, 7); g.stroke();
    g.beginPath(); g.arc(W * 0.86, H * 0.42, H * 0.045, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = c; g.fillRect(W * 0.86 - 10, H * 0.38, 4, 4); g.fillRect(W * 0.86 + 6, H * 0.38, 4, 4);
    g.globalAlpha = 0.25; g.fillStyle = '#000';
    for (let i = 0; i < 200; i++) g.fillRect(rr(0, W), rr(0, H), 2, 2);
    g.globalAlpha = 1;
  },
  batch7(g, W, H) {
    g.fillStyle = '#efd94a'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 0, W, H * 0.15);
    text(g, 'BATCH 7', W / 2, H * 0.4, `700 ${H * 0.26}px ${HAND}`, '#1a1a6a');
    text(g, "ERIK'S!! DO NOT", W / 2, H * 0.64, `${H * 0.14}px ${HAND}`, '#1a1a6a', 'center', W * 0.9);
    text(g, 'EAT. SERIOUSLY.', W / 2, H * 0.84, `${H * 0.14}px ${HAND}`, '#1a1a6a', 'center', W * 0.9);
    g.strokeStyle = '#1a1a6a'; g.lineWidth = 3; g.beginPath(); g.moveTo(W * 0.2, H * 0.47); g.lineTo(W * 0.8, H * 0.47); g.stroke();
  },
  scienceFair(g, W, H) {
    paper(g, W, H, '#e4ead8');
    g.fillStyle = '#2a5a2a'; g.fillRect(0, 0, W, H * 0.14);
    text(g, 'SCIENCE FAIR 2015', W / 2, H * 0.1, `900 ${H * 0.07}px ${IMPACT}`, '#e8f0d8', 'center', W * 0.9);
    text(g, '1st PLACE', W / 2, H * 0.24, `900 ${H * 0.07}px ${IMPACT}`, '#9a1f18');
    // ribbon
    g.fillStyle = '#2050a0'; g.beginPath(); g.arc(W * 0.8, H * 0.3, H * 0.07, 0, 7); g.fill();
    g.fillRect(W * 0.77, H * 0.33, W * 0.025, H * 0.12); g.fillRect(W * 0.805, H * 0.33, W * 0.025, H * 0.12);
    text(g, '1', W * 0.8, H * 0.325, `900 ${H * 0.07}px ${IMPACT}`, '#f0d070');
    text(g, 'Erik Madsen', W / 2, H * 0.36, `700 ${H * 0.06}px ${SERIF}`, '#111');
    text(g, '"Re-Animating Amphibians:', W / 2, H * 0.46, `italic ${H * 0.045}px ${SERIF}`, '#222', 'center', W * 0.9);
    text(g, 'A Study in Batch Chemistry"', W / 2, H * 0.52, `italic ${H * 0.045}px ${SERIF}`, '#222', 'center', W * 0.9);
    // frog sketch
    g.save(); g.translate(W / 2, H * 0.7); g.strokeStyle = '#2a5a2a'; g.lineWidth = 3; g.fillStyle = '#7aa04a';
    g.beginPath(); g.ellipse(0, 0, W * 0.18, H * 0.07, 0, 0, 7); g.fill(); g.stroke();
    for (const sx of [-1, 1]) {
      g.beginPath(); g.arc(sx * W * 0.08, -H * 0.06, H * 0.03, 0, 7); g.fillStyle = '#fff'; g.fill(); g.stroke();
      g.fillStyle = '#111'; g.beginPath(); g.arc(sx * W * 0.08, -H * 0.06, H * 0.012, 0, 7); g.fill();
      g.fillStyle = '#7aa04a';
    }
    g.beginPath(); g.moveTo(-W * 0.06, H * 0.02); g.lineTo(W * 0.06, H * 0.02); g.stroke();
    g.restore();
    text(g, '(it moved)', W / 2, H * 0.88, `${H * 0.05}px ${HAND}`, '#9a1f18');
    age(g, W, H);
    tape(g, 12, 12, 50, 18, -0.8); tape(g, W - 12, 12, 50, 18, 0.8);
  },
  read(g, W, H) {
    paper(g, W, H, '#20304a');
    text(g, 'READ.', W / 2, H * 0.3, `900 ${H * 0.2}px ${IMPACT}`, '#f0c040');
    // open book
    g.fillStyle = '#efe8d0';
    g.beginPath(); g.moveTo(W / 2, H * 0.48); g.quadraticCurveTo(W * 0.3, H * 0.4, W * 0.14, H * 0.46); g.lineTo(W * 0.14, H * 0.7); g.quadraticCurveTo(W * 0.3, H * 0.64, W / 2, H * 0.72); g.fill();
    g.beginPath(); g.moveTo(W / 2, H * 0.48); g.quadraticCurveTo(W * 0.7, H * 0.4, W * 0.86, H * 0.46); g.lineTo(W * 0.86, H * 0.7); g.quadraticCurveTo(W * 0.7, H * 0.64, W / 2, H * 0.72); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const y = H * (0.5 + i * 0.035); g.beginPath(); g.moveTo(W * 0.2, y); g.lineTo(W * 0.44, y + 4); g.moveTo(W * 0.56, y + 4); g.lineTo(W * 0.8, y); g.stroke(); }
    text(g, "It's never too late.", W / 2, H * 0.84, `italic ${H * 0.06}px ${SERIF}`, '#efe8d0', 'center', W * 0.9);
    age(g, W, H, 0.7);
  },
  concert(g, W, H) {
    paper(g, W, H, '#efe2c2');
    text(g, 'SPRING CONCERT', W / 2, H * 0.12, `900 ${H * 0.075}px ${IMPACT}`, '#3a1a50', 'center', W * 0.9);
    text(g, 'featuring', W / 2, H * 0.21, `italic ${H * 0.045}px ${SERIF}`, '#333');
    text(g, 'STEW', W / 2, H * 0.38, `900 ${H * 0.18}px ${IMPACT}`, '#c8261c');
    text(g, 'JAMS', W / 2, H * 0.52, `900 ${H * 0.13}px ${IMPACT}`, '#1a1a1a');
    // four stick figures with instruments
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const x = W * (0.2 + i * 0.2), y = H * 0.68;
      g.beginPath(); g.arc(x, y - 18, 8, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x, y + 14); g.moveTo(x - 10, y); g.lineTo(x + 10, y); g.moveTo(x, y + 14); g.lineTo(x - 8, y + 28); g.moveTo(x, y + 14); g.lineTo(x + 8, y + 28); g.stroke();
    }
    text(g, 'Gym · Friday · 7 PM', W / 2, H * 0.86, `700 ${H * 0.045}px ${NARROW}`, '#333');
    age(g, W, H);
    // CANCELLED stamp
    g.save(); g.translate(W / 2, H * 0.55); g.rotate(-0.35);
    g.strokeStyle = 'rgba(170,20,15,0.85)'; g.lineWidth = 6; g.strokeRect(-W * 0.44, -H * 0.07, W * 0.88, H * 0.13);
    text(g, 'CANCELLED', 0, H * 0.04, `900 ${H * 0.1}px ${IMPACT}`, 'rgba(170,20,15,0.85)', 'center', W * 0.82);
    text(g, 'by order of the class president', 0, H * 0.1, `700 ${H * 0.03}px ${NARROW}`, 'rgba(170,20,15,0.85)');
    g.restore();
    tape(g, W / 2, 8, 70, 20, 0.05);
  },
  graffitiStew(g, W, H) {
    g.clearRect(0, 0, W, H);
    spray(g, 'STEW', W * 0.48, H * 0.66, H * 0.62, '#3aa040', { rot: -0.06, drips: 14 });
    spray(g, '4 LIFE', W * 0.78, H * 0.92, H * 0.2, '#e8e0d0', { rot: -0.1, drips: 5, font: HAND });
    // crown over the S
    g.strokeStyle = '#e0c040'; g.lineWidth = H * 0.03; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(W * 0.13, H * 0.2); g.lineTo(W * 0.16, H * 0.05); g.lineTo(W * 0.2, H * 0.15); g.lineTo(W * 0.24, H * 0.03); g.lineTo(W * 0.27, H * 0.15); g.lineTo(W * 0.31, H * 0.05); g.lineTo(W * 0.33, H * 0.2); g.closePath(); g.stroke();
  },
  monitor(g, W, H) {
    // gold frame
    g.fillStyle = '#8a6a2a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#c9a54e'; g.fillRect(W * 0.04, W * 0.04, W * 0.92, H - W * 0.08);
    g.fillStyle = '#ece6d2'; g.fillRect(W * 0.08, W * 0.08, W * 0.84, H - W * 0.16);
    text(g, 'HALL MONITOR', W / 2, H * 0.16, `900 ${H * 0.065}px ${IMPACT}`, '#1f3566', 'center', W * 0.8);
    text(g, 'OF THE MONTH', W / 2, H * 0.23, `700 ${H * 0.045}px ${NARROW}`, '#9a1f18');
    g.fillStyle = '#9fa0a0'; g.fillRect(W * 0.2, H * 0.27, W * 0.6, H * 0.43);
    g.save(); g.beginPath(); g.rect(W * 0.2, H * 0.27, W * 0.6, H * 0.43); g.clip();
    erikFace(g, W / 2, H * 0.47, H * 0.15);
    g.restore();
    text(g, 'Erik Madsen', W / 2, H * 0.79, `700 ${H * 0.055}px ${SERIF}`, '#111');
    text(g, 'Every month, 2012 – 2016', W / 2, H * 0.86, `italic ${H * 0.04}px ${SERIF}`, '#333', 'center', W * 0.8);
    age(g, W, H, 0.5);
    // cracked glass
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5;
    const cx = W * 0.7, cy = H * 0.35;
    for (let i = 0; i < 7; i++) { const a = rr(0, 6.3), l = rr(30, 120); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); g.stroke(); }
  },
  madDogsBanner(g, W, H) {
    g.fillStyle = '#4a1c1a'; g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.08;
    for (let y = 0; y < H; y += 3) { g.fillStyle = '#000'; g.fillRect(0, y, W, 1); }
    g.globalAlpha = 1;
    g.strokeStyle = '#a88a3c'; g.lineWidth = 8; g.strokeRect(14, 14, W - 28, H - 28);
    text(g, 'LAST BELL', W / 2, H * 0.3, `700 ${H * 0.14}px ${NARROW}`, '#b8984a');
    text(g, 'MAD DOGS', W / 2 + 5, H * 0.8 + 5, `900 ${H * 0.5}px ${IMPACT}`, '#1b0b0a');
    text(g, 'MAD DOGS', W / 2, H * 0.8, `900 ${H * 0.5}px ${IMPACT}`, '#c9a54e');
    // snarling dog heads at each end
    for (const sx of [0.1, 0.9]) dogHead(g, W * sx, H * 0.55, H * 0.32, sx > 0.5);
    age(g, W, H, 0.6);
  },
  talentShow(g, W, H) {
    paper(g, W, H, '#f0d8c0');
    g.fillStyle = '#7a1a3a'; g.fillRect(0, 0, W, H * 0.3);
    // spotlight
    const grd = g.createRadialGradient(W / 2, H * 0.15, 5, W / 2, H * 0.15, W * 0.5);
    grd.addColorStop(0, 'rgba(255,240,180,0.6)'); grd.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H * 0.3);
    text(g, 'REUNION', W / 2, H * 0.13, `900 ${H * 0.08}px ${IMPACT}`, '#f0d070');
    text(g, 'TALENT SHOW', W / 2, H * 0.24, `900 ${H * 0.09}px ${IMPACT}`, '#fff', 'center', W * 0.9);
    text(g, 'Hosted by', W / 2, H * 0.38, `italic ${H * 0.04}px ${SERIF}`, '#333');
    text(g, 'ERIK MADSEN', W / 2, H * 0.46, `900 ${H * 0.07}px ${IMPACT}`, '#7a1a3a', 'center', W * 0.9);
    const acts = ['Erik Madsen — recorder solo', 'Erik Madsen — dramatic reading', 'Erik Madsen — slideshow', '"Stew" — NOT INVITED'];
    acts.forEach((a, i) => text(g, a, W / 2, H * (0.58 + i * 0.07), `${H * 0.038}px ${NARROW}`, i === 3 ? '#9a1f18' : '#222', 'center', W * 0.9));
    text(g, 'Auditorium · 8 PM', W / 2, H * 0.92, `700 ${H * 0.04}px ${NARROW}`, '#333');
    age(g, W, H);
    tape(g, 14, 14, 50, 18, -0.7); tape(g, W - 14, 14, 50, 18, 0.7);
  },
  graffitiWeGo(g, W, H) {
    g.clearRect(0, 0, W, H);
    spray(g, 'WE GO', W * 0.34, H * 0.42, H * 0.34, '#d84a20', { rot: -0.05, drips: 8 });
    spray(g, 'STEW!', W * 0.6, H * 0.88, H * 0.46, '#e8d040', { rot: -0.04, drips: 12 });
    // arrow pointing at the hall door
    g.strokeStyle = '#e8e0d0'; g.lineWidth = H * 0.04; g.lineCap = 'round';
    g.beginPath(); g.moveTo(W * 0.72, H * 0.25); g.quadraticCurveTo(W * 0.85, H * 0.1, W * 0.97, H * 0.28); g.stroke();
    g.beginPath(); g.moveTo(W * 0.97, H * 0.28); g.lineTo(W * 0.9, H * 0.25); g.moveTo(W * 0.97, H * 0.28); g.lineTo(W * 0.96, H * 0.18); g.stroke();
  },
};

function hand(g, x, y, s) {
  g.fillStyle = 'rgba(100,10,8,0.7)';
  g.beginPath(); g.ellipse(x, y, s * 0.3, s * 0.36, 0.2, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) {
    g.save(); g.translate(x - s * 0.22 + i * s * 0.15, y - s * 0.3); g.rotate(-0.2 + i * 0.12);
    g.beginPath(); g.ellipse(0, -s * 0.2, s * 0.06, s * 0.22, 0, 0, 7); g.fill(); g.restore();
  }
  g.beginPath(); g.ellipse(x + s * 0.35, y, s * 0.06, s * 0.18, -0.9, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) g.fillRect(x + rr(-s * 0.2, s * 0.2), y + s * 0.3, 3, rr(s * 0.1, s * 0.5));
}

function dogHead(g, x, y, s, flip) {
  g.save(); g.translate(x, y); if (flip) g.scale(-1, 1);
  g.fillStyle = '#c9a54e';
  g.beginPath();
  g.moveTo(-s * 0.5, -s * 0.2); g.lineTo(-s * 0.35, -s * 0.75); g.lineTo(-s * 0.1, -s * 0.35);
  g.lineTo(s * 0.15, -s * 0.4); g.lineTo(s * 0.6, -s * 0.05); g.lineTo(s * 0.62, s * 0.15);
  g.lineTo(s * 0.2, s * 0.25); g.lineTo(s * 0.55, s * 0.35); g.lineTo(s * 0.1, s * 0.5); g.lineTo(-s * 0.45, s * 0.35);
  g.closePath(); g.fill();
  g.fillStyle = '#4a1c1a'; g.beginPath(); g.arc(s * 0.05, -s * 0.15, s * 0.07, 0, 7); g.fill();
  g.fillStyle = '#f0e8d0';
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(s * (0.2 + i * 0.09), s * 0.24); g.lineTo(s * (0.24 + i * 0.09), s * 0.34); g.lineTo(s * (0.28 + i * 0.09), s * 0.24); g.fill(); }
  g.restore();
}

// Public: a texture for one decal. `transparent` tells the caller to blend.
export function decalTexture(d) {
  _s = 1000 + Math.abs(d.seed ?? Math.round((d.at ?? d.x ?? 0) * 97 + (d.y ?? 0) * 13)) % 9000;
  const ppm = d.kind.startsWith('graffiti') || d.kind === 'reunion' || d.kind === 'madDogsBanner' ? 300 : 620;
  const W = Math.min(2048, Math.round(d.w * ppm)), H = Math.min(1024, Math.round(d.h * ppm));
  const [c, g] = makeCanvas(W, H);
  const paint = PAINTERS[d.kind];
  if (!paint) throw new Error('unknown decal ' + d.kind);
  paint(g, W, H, d);
  return { texture: toTexture(c, { repeat: false }), transparent: true };
}

// --- notes on desks (small paper with a title and scribbles) --------------------
export function noteTexture(note, { flyer = false } = {}) {
  _s = 7 + note.id.length * 131 + note.id.charCodeAt(0);
  const W = 360, H = 460;
  const [c, g] = makeCanvas(W, H);
  if (flyer) {
    paper(g, W, H, '#f4e8b8');
    g.fillStyle = '#9a1f18'; g.fillRect(0, 0, W, H * 0.2);
    text(g, 'LAST BELL HIGH', W / 2, H * 0.08, `700 ${H * 0.045}px ${NARROW}`, '#f4e8b8');
    text(g, '10-YEAR REUNION', W / 2, H * 0.17, `900 ${H * 0.07}px ${IMPACT}`, '#fff', 'center', W * 0.9);
    text(g, 'TONIGHT', W / 2, H * 0.32, `900 ${H * 0.09}px ${IMPACT}`, '#1f3566');
    text(g, 'Dinner: Reunion Stew!', W / 2, H * 0.42, `italic ${H * 0.045}px ${SERIF}`, '#222');
    // pot drawing
    g.fillStyle = '#333'; g.beginPath(); g.ellipse(W / 2, H * 0.58, W * 0.2, H * 0.08, 0, 0, Math.PI); g.fill();
    g.fillRect(W * 0.3, H * 0.5, W * 0.4, H * 0.08);
    g.strokeStyle = '#999'; g.lineWidth = 3;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(W * (0.42 + i * 0.08), H * 0.48); g.quadraticCurveTo(W * (0.38 + i * 0.08), H * 0.43, W * (0.43 + i * 0.08), H * 0.38); g.stroke(); }
    text(g, 'Organised by Erik Madsen', W / 2, H * 0.74, `${H * 0.038}px ${NARROW}`, '#333');
    text(g, 'Stew NOT invited. — E.M.', W / 2, H * 0.88, `${H * 0.05}px ${HAND}`, '#9a1f18', 'center', W * 0.9);
    age(g, W, H);
    tape(g, W / 2, 8, 70, 20, 0.08);
  } else {
    paper(g, W, H, note.id === 'detention' ? '#f0c8c8' : note.id === 'recipe' ? '#f4f0e0' : note.id === 'labnotes' ? '#e8eef0' : '#ece4cc');
    if (note.id === 'labnotes' || note.id === 'recipe') {
      g.strokeStyle = 'rgba(60,90,160,0.35)'; g.lineWidth = 1.5;
      for (let y = H * 0.18; y < H; y += H * 0.055) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.strokeStyle = 'rgba(180,40,40,0.4)'; g.beginPath(); g.moveTo(W * 0.12, 0); g.lineTo(W * 0.12, H); g.stroke();
    }
    text(g, note.title.toUpperCase(), W / 2, H * 0.12, `900 ${H * 0.06}px ${note.id === 'detention' ? IMPACT : NARROW}`, '#2a2014', 'center', W * 0.9);
    // scribbled lines from the note's own words
    const words = note.text.replace(/\n/g, ' ').split(' ');
    let line = '', y = H * 0.22;
    g.font = `${H * 0.036}px ${HAND}`;
    for (const w of words) {
      if (g.measureText(line + w).width > W * 0.78) {
        text(g, line, W * 0.15, y, `${H * 0.036}px ${HAND}`, '#1a1a4a', 'left');
        line = ''; y += H * 0.055;
        if (y > H * 0.94) break;
      }
      line += w + ' ';
    }
    if (y <= H * 0.94) text(g, line, W * 0.15, y, `${H * 0.036}px ${HAND}`, '#1a1a4a', 'left');
    age(g, W, H, 0.8);
  }
  return toTexture(c, { repeat: false });
}

// Label on the Stew can / mixtape.
export function labelTexture(kind) {
  _s = kind === 'can' ? 77 : 78;
  if (kind === 'can') {
    const W = 512, H = 160;
    const [c, g] = makeCanvas(W, H);
    g.fillStyle = '#a8261c'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e8d6a0'; g.fillRect(0, H * 0.2, W, H * 0.6);
    for (const x of [W * 0.25, W * 0.75]) {
      text(g, 'STEW', x, H * 0.66, `900 ${H * 0.42}px ${IMPACT}`, '#a8261c');
    }
    text(g, 'HEARTY', W * 0.5, H * 0.16, `700 ${H * 0.12}px ${NARROW}`, '#f0e0b0');
    text(g, 'NET WT 15 OZ', W * 0.5, H * 0.95, `700 ${H * 0.1}px ${NARROW}`, '#f0e0b0');
    age(g, W, H, 0.6);
    return toTexture(c, { repeat: false });
  }
  const W = 256, H = 128;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#efe8d4'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c8261c'; g.fillRect(0, 0, W, H * 0.18);
  text(g, 'STEW JAMS', W / 2, H * 0.55, `${H * 0.3}px ${HAND}`, '#1a1a1a', 'center', W * 0.9);
  text(g, 'side A — DO NOT TAPE OVER', W / 2, H * 0.82, `${H * 0.11}px ${HAND}`, '#1a1a6a', 'center', W * 0.9);
  return toTexture(c, { repeat: false });
}

// Speaker grille.
export function grilleTexture() {
  const W = 128, H = 96;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#c8c0a8'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a2824';
  for (let y = 10; y < H - 8; y += 7) for (let x = 10; x < W - 8; x += 7) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(60,40,20,0.25)';
  for (let i = 0; i < 80; i++) g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  return toTexture(c, { repeat: false });
}
