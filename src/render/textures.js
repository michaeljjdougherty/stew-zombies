// =============================================================================
// Procedural textures. Everything is painted on canvases at load time.
// =============================================================================
import * as THREE from 'three';

let maxAniso = 4;
export function setAnisotropy(n) { maxAniso = n; }

// Small seeded random so textures look the same every load.
let _s = 1337;
const rnd = () => { _s = (_s * 16807) % 2147483647; return (_s - 1) / 2147483646; };
const rr = (a, b) => a + (b - a) * rnd();
export const seedTextures = (s) => { _s = s; };

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function toTexture(c, { repeat = true, srgb = true, clampV = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = repeat && !clampV ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

// Tileable value-noise canvas (grayscale), fractal.
export function noiseCanvas(size = 256, octaves = 5, base = 4) {
  const [c, g] = makeCanvas(size, size);
  const img = g.createImageData(size, size);
  const acc = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = base << o;
    const grid = new Float32Array(cells * cells).map(() => rnd());
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * cells, y0 = Math.floor(gy), fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * cells, x0 = Math.floor(gx), fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const i00 = grid[(y0 % cells) * cells + (x0 % cells)];
        const i10 = grid[(y0 % cells) * cells + ((x0 + 1) % cells)];
        const i01 = grid[((y0 + 1) % cells) * cells + (x0 % cells)];
        const i11 = grid[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)];
        const v = (i00 * (1 - sx) + i10 * sx) * (1 - sy) + (i01 * (1 - sx) + i11 * sx) * sy;
        acc[y * size + x] += v * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < acc.length; i++) {
    const v = Math.floor((acc[i] / total) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Paint dirty blotches using a noise canvas as a stencil.
function grime(g, w, h, { alpha = 0.35, color = '#1a140c', scale = 1, mode = 'multiply' } = {}) {
  const n = noiseCanvas(256, 5, 3);
  g.save();
  g.globalCompositeOperation = mode;
  g.globalAlpha = alpha;
  g.drawImage(n, 0, 0, w * scale, h * scale);
  if (scale < 1) {
    for (let x = 0; x < w; x += w * scale) for (let y = 0; y < h; y += h * scale) g.drawImage(n, x, y, w * scale, h * scale);
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = alpha * 0.5;
  g.fillStyle = color;
  for (let i = 0; i < 40; i++) {
    const x = rr(0, w), y = rr(0, h), r = rr(4, w * 0.06);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, color);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function speckle(g, w, h, count, colors, size = [0.5, 2]) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[Math.floor(rnd() * colors.length)];
    g.globalAlpha = rr(0.1, 0.5);
    const s = rr(size[0], size[1]);
    g.fillRect(rr(0, w), rr(0, h), s, s);
  }
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Gym floor: worn maple planks. 1024px = 4m.
// ---------------------------------------------------------------------------
export function gymFloorTexture({ photo = false } = {}) {
  const S = 1024;
  const [c, g] = makeCanvas(S, S);
  const plankW = 26; // ~10cm
  if (photo) {
    // the photo supplies the strips; paint the varnish colour and its wear
    g.fillStyle = 'hsl(33,34%,50%)'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {
      const x = rr(0, S), y = rr(0, S), r = rr(40, 160);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const lite = rnd() < 0.5;
      grd.addColorStop(0, lite ? 'rgba(255,225,170,0.10)' : 'rgba(60,35,12,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  for (let y = 0; y < S && !photo; y += plankW) {
    let x = -rr(0, 400);
    while (x < S) {
      const len = rr(220, 520);
      const l = rr(46, 58), sat = rr(22, 32), hue = rr(28, 36);
      g.fillStyle = `hsl(${hue},${sat}%,${l}%)`;
      g.fillRect(x, y, len, plankW);
      // grain
      g.globalAlpha = 0.18;
      for (let k = 0; k < 6; k++) {
        g.strokeStyle = `hsl(${hue - 4},${sat + 5}%,${l - rr(8, 16)}%)`;
        g.lineWidth = rr(0.5, 1.5);
        g.beginPath();
        const yy = y + rr(2, plankW - 2);
        g.moveTo(x, yy);
        for (let xx = x; xx < x + len; xx += 30) g.lineTo(xx, yy + rr(-1.2, 1.2));
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(30,18,8,0.55)';
      g.fillRect(x, y, 1.5, plankW); // butt joint
      x += len;
    }
    g.fillStyle = 'rgba(25,15,6,0.5)';
    g.fillRect(0, y, S, 1.2); // seam
  }
  grime(g, S, S, { alpha: 0.35, color: '#20160a' });
  // scuff marks
  g.strokeStyle = 'rgba(20,20,20,0.35)';
  for (let i = 0; i < 70; i++) {
    g.lineWidth = rr(1, 3);
    g.beginPath();
    const x = rr(0, S), y = rr(0, S), a = rr(0, Math.PI * 2), l = rr(10, 60);
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  speckle(g, S, S, 3000, ['#1b130b', '#3a2c1c', '#d8c8a8']);
  const t = toTexture(c);
  t.repeat.set(1 / 4, 1 / 4); // 1 repeat per 4m (UVs are in meters)
  return t;
}

// Court lines, logo and big stains, laid over the planks. Covers the whole room.
export function courtOverlayTexture(map) {
  const W = 2048, H = Math.round(2048 * ((map.bounds.maxZ - map.bounds.minZ) / (map.bounds.maxX - map.bounds.minX)));
  const [c, g] = makeCanvas(W, H);
  const mx = W / (map.bounds.maxX - map.bounds.minX);
  const X = (x) => (x - map.bounds.minX) * mx;
  const Z = (z) => (z - map.bounds.minZ) * mx;
  g.clearRect(0, 0, W, H);

  const courtHalfL = 14, courtHalfW = 7.5;
  // painted key areas (school maroon)
  g.fillStyle = 'rgba(92,34,30,0.55)';
  g.fillRect(X(-courtHalfL), Z(-2.45), 5.8 * mx, 4.9 * mx);
  g.fillRect(X(courtHalfL - 5.8), Z(-2.45), 5.8 * mx, 4.9 * mx);
  // center circle fill
  g.beginPath(); g.arc(X(0), Z(0), 1.8 * mx, 0, Math.PI * 2); g.fill();

  g.strokeStyle = 'rgba(214,200,170,0.8)';
  g.lineWidth = 0.05 * mx;
  g.strokeRect(X(-courtHalfL), Z(-courtHalfW), courtHalfL * 2 * mx, courtHalfW * 2 * mx);
  g.beginPath(); g.moveTo(X(0), Z(-courtHalfW)); g.lineTo(X(0), Z(courtHalfW)); g.stroke();
  g.beginPath(); g.arc(X(0), Z(0), 1.8 * mx, 0, Math.PI * 2); g.stroke();
  for (const s of [-1, 1]) {
    const bx = s * courtHalfL;
    g.strokeRect(Math.min(X(bx), X(bx - s * 5.8)), Z(-2.45), 5.8 * mx, 4.9 * mx);
    g.beginPath(); g.arc(X(bx - s * 5.8), Z(0), 1.8 * mx, 0, Math.PI * 2); g.stroke();
    g.beginPath();
    const r3 = 6.75 * mx;
    const cx = X(bx - s * 1.575), cz = Z(0);
    if (s < 0) g.arc(cx, cz, r3, -Math.PI / 2 + 0.22, Math.PI / 2 - 0.22);
    else g.arc(cx, cz, r3, Math.PI / 2 + 0.22, Math.PI * 1.5 - 0.22);
    g.stroke();
  }
  // center logo
  g.save();
  g.translate(X(0), Z(0));
  g.fillStyle = 'rgba(180,150,70,0.55)';
  g.font = `900 ${1.1 * mx}px Impact, "Arial Black", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('STEW', 0, 0);
  g.restore();

  // wear on the paint: erase bits
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(0,0,0,${rr(0.2, 0.9)})`;
    g.fillRect(rr(0, W), rr(0, H), rr(1, 6), rr(1, 3));
  }
  g.globalCompositeOperation = 'source-over';

  // big water stains, blood trails and debris shadows
  for (let i = 0; i < 26; i++) {
    const x = rr(0, W), y = rr(0, H), r = rr(20, 140);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() < 0.3;
    grd.addColorStop(0, dark ? 'rgba(40,6,4,0.45)' : 'rgba(18,12,6,0.4)');
    grd.addColorStop(0.7, dark ? 'rgba(40,6,4,0.2)' : 'rgba(18,12,6,0.18)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(x, y, r, r * rr(0.4, 1), rr(0, 3), 0, Math.PI * 2); g.fill();
  }
  // dirt accumulating along the walls
  const edge = g.createLinearGradient(0, 0, 0, H);
  edge.addColorStop(0, 'rgba(10,8,5,0.6)'); edge.addColorStop(0.08, 'rgba(10,8,5,0)');
  edge.addColorStop(0.92, 'rgba(10,8,5,0)'); edge.addColorStop(1, 'rgba(10,8,5,0.6)');
  g.fillStyle = edge; g.fillRect(0, 0, W, H);
  const edgeX = g.createLinearGradient(0, 0, W, 0);
  edgeX.addColorStop(0, 'rgba(10,8,5,0.6)'); edgeX.addColorStop(0.06, 'rgba(10,8,5,0)');
  edgeX.addColorStop(0.94, 'rgba(10,8,5,0)'); edgeX.addColorStop(1, 'rgba(10,8,5,0.6)');
  g.fillStyle = edgeX; g.fillRect(0, 0, W, H);
  // paper litter
  for (let i = 0; i < 60; i++) {
    g.save();
    g.translate(rr(0, W), rr(0, H)); g.rotate(rr(0, 6.28));
    g.fillStyle = `rgba(${rr(170, 210)},${rr(165, 200)},${rr(140, 170)},0.8)`;
    g.fillRect(-10, -13, 20, 26);
    g.fillStyle = 'rgba(60,60,80,0.3)';
    for (let k = -9; k < 12; k += 4) g.fillRect(-7, k, 14, 1);
    g.restore();
  }
  const t = toTexture(c, { repeat: false });
  return t;
}

// ---------------------------------------------------------------------------
// Painted cinderblock wall. u: 4m per repeat, v: 0..1 = full wall height (9m).
// ---------------------------------------------------------------------------
export function wallTexture({ height = 9, lower = '#5b2c27', upper = '#8a8574', stripe = '#a78a3a', photo = false } = {}) {
  const W = 512, H = Math.round(512 * height / 4);
  const [c, g] = makeCanvas(W, H);
  const px = W / 4; // pixels per meter
  const band = 2.1;
  g.fillStyle = upper; g.fillRect(0, 0, W, H);
  g.fillStyle = lower; g.fillRect(0, H - band * px, W, band * px);
  g.fillStyle = stripe; g.fillRect(0, H - band * px - 0.12 * px, W, 0.12 * px);
  // blocks (the photo surface draws them when there is one)
  const bw = 0.4 * px, bh = 0.2 * px;
  for (let row = 0; row * bh < H && !photo; row++) {
    const off = (row % 2) * bw / 2;
    for (let x = -off; x < W; x += bw) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rr(0.01, 0.06)})`;
      g.fillRect(x + 1, row * bh + 1, bw - 2, bh - 2);
    }
    g.fillStyle = 'rgba(20,16,10,0.35)';
    g.fillRect(0, row * bh, W, 1.5);
    for (let x = -off; x < W; x += bw) g.fillRect(x, row * bh, 1.5, bh);
  }
  // peeling paint: patches of bare gray block with pale edges
  for (let i = 0; i < 14; i++) {
    const x = rr(0, W), y = rr(0, H), r = rr(6, 30);
    g.fillStyle = '#6e6c66';
    g.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.4) {
      const rad = r * rr(0.5, 1.2);
      g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.7);
    }
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(230,225,210,0.35)'; g.lineWidth = 1.2; g.stroke();
  }
  // drips / water streaks from the top
  for (let i = 0; i < 26; i++) {
    const x = rr(0, W), len = rr(H * 0.1, H * 0.6), w = rr(2, 10);
    const grd = g.createLinearGradient(0, 0, 0, len);
    grd.addColorStop(0, 'rgba(30,24,14,0.45)'); grd.addColorStop(1, 'rgba(30,24,14,0)');
    g.fillStyle = grd; g.fillRect(x, 0, w, len);
  }
  // rust streaks
  for (let i = 0; i < 8; i++) {
    const x = rr(0, W), y = rr(0, H * 0.6), len = rr(30, 160);
    const grd = g.createLinearGradient(0, y, 0, y + len);
    grd.addColorStop(0, 'rgba(110,50,20,0.4)'); grd.addColorStop(1, 'rgba(110,50,20,0)');
    g.fillStyle = grd; g.fillRect(x, y, rr(2, 5), len);
  }
  grime(g, W, H, { alpha: 0.3, color: '#1c1710' });
  // dirt kicked up along the floor
  const f = g.createLinearGradient(0, H - px * 1.2, 0, H);
  f.addColorStop(0, 'rgba(15,10,5,0)'); f.addColorStop(1, 'rgba(15,10,5,0.7)');
  g.fillStyle = f; g.fillRect(0, H - px * 1.2, W, px * 1.2);
  // soot toward ceiling
  const top = g.createLinearGradient(0, 0, 0, px * 2);
  top.addColorStop(0, 'rgba(8,6,4,0.75)'); top.addColorStop(1, 'rgba(8,6,4,0)');
  g.fillStyle = top; g.fillRect(0, 0, W, px * 2);
  speckle(g, W, H, 2500, ['#222', '#555', '#bbb']);
  // blood hand smears near the bottom
  for (let i = 0; i < 3; i++) {
    const x = rr(0, W), y = H - rr(1.0, 1.8) * px;
    g.fillStyle = 'rgba(70,8,6,0.55)';
    for (let k = 0; k < 4; k++) {
      g.fillRect(x + k * 5, y + rr(0, 4), 3, rr(20, 50));
    }
  }
  const t = toTexture(c, { clampV: true });
  t.repeat.set(1 / 4, 1 / height);
  return t;
}

export function ceilingTexture() {
  const S = 512;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#35332e'; g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 32) {
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x, 0, 10, S);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 10, 0, 2, S);
  }
  grime(g, S, S, { alpha: 0.45, color: '#0e0c09' });
  speckle(g, S, S, 1200, ['#111', '#4a453c']);
  const t = toTexture(c);
  t.repeat.set(1 / 3, 1 / 3);
  return t;
}

export function woodTexture({ base = [34, 28, 38], plank = 64, dark = false, photo = false } = {}) {
  const S = 512;
  const [c, g] = makeCanvas(S, S);
  if (photo) {
    // grain and seams come from the photo; paint the stain colour unevenly
    g.fillStyle = `hsl(${base[0]},${base[1]}%,${base[2] - (dark ? 12 : 0)}%)`; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 40; i++) {
      const x = rr(0, S), y = rr(0, S), r = rr(30, 120);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, rnd() < 0.5 ? 'rgba(255,230,190,0.08)' : 'rgba(20,10,4,0.14)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  for (let y = 0; y < S && !photo; y += plank) {
    const l = rr(base[2] - 6, base[2] + 4) - (dark ? 12 : 0);
    g.fillStyle = `hsl(${base[0] + rr(-3, 3)},${base[1]}%,${l}%)`;
    g.fillRect(0, y, S, plank);
    g.globalAlpha = 0.22;
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = `hsl(${base[0]},${base[1] + 8}%,${l - rr(8, 18)}%)`;
      g.lineWidth = rr(0.5, 2);
      g.beginPath();
      const yy = y + rr(2, plank - 2);
      g.moveTo(0, yy);
      for (let x = 0; x < S; x += 24) g.lineTo(x, yy + rr(-1.5, 1.5));
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(15,10,5,0.7)'; g.fillRect(0, y, S, 2);
    // knots
    if (rnd() < 0.5) {
      const kx = rr(0, S), ky = y + plank / 2;
      g.fillStyle = 'rgba(40,24,12,0.6)';
      g.beginPath(); g.ellipse(kx, ky, rr(4, 9), rr(2, 5), 0, 0, Math.PI * 2); g.fill();
    }
  }
  grime(g, S, S, { alpha: 0.4 });
  speckle(g, S, S, 1500, ['#120c06', '#6b5a44']);
  const t = toTexture(c);
  t.repeat.set(1 / 2, 1 / 2);
  return t;
}

export function metalTexture({ color = '#3b3d3a', rust = 0.4 } = {}) {
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = color; g.fillRect(0, 0, S, S);
  g.globalAlpha = 0.1;
  for (let i = 0; i < 200; i++) {
    g.strokeStyle = rnd() < 0.5 ? '#000' : '#fff';
    g.beginPath(); const y = rr(0, S); g.moveTo(0, y); g.lineTo(S, y + rr(-3, 3)); g.stroke();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 30 * rust; i++) {
    const x = rr(0, S), y = rr(0, S), r = rr(3, 24);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(105,52,24,0.75)'); grd.addColorStop(1, 'rgba(105,52,24,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  grime(g, S, S, { alpha: 0.35 });
  const t = toTexture(c);
  t.repeat.set(1, 1);
  return t;
}

export function plankTexture(variant = 0) {
  seedTextures(900 + variant * 31);
  const [c, g] = makeCanvas(256, 48);
  const l = rr(30, 42);
  g.fillStyle = `hsl(${rr(25, 35)},${rr(18, 28)}%,${l}%)`;
  g.fillRect(0, 0, 256, 48);
  g.globalAlpha = 0.3;
  for (let k = 0; k < 12; k++) {
    g.strokeStyle = `hsl(28,30%,${l - rr(10, 18)}%)`;
    g.lineWidth = rr(0.5, 2);
    g.beginPath();
    const y = rr(2, 46); g.moveTo(0, y);
    for (let x = 0; x < 256; x += 16) g.lineTo(x, y + rr(-1, 1));
    g.stroke();
  }
  g.globalAlpha = 1;
  grime(g, 256, 48, { alpha: 0.45 });
  // nail heads
  g.fillStyle = '#222';
  for (const x of [10, 246]) { g.beginPath(); g.arc(x, 14, 2.5, 0, 7); g.arc(x, 34, 2.5, 0, 7); g.fill(); }
  // splintered end
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(0, 0, 256, 2); g.fillRect(0, 46, 256, 2);
  return toTexture(c, { repeat: false });
}

// ---------------------------------------------------------------------------
// Big hanging team banner
// ---------------------------------------------------------------------------
export function bannerTexture(text = 'STEW') {
  seedTextures(4242);
  const W = 1024, H = 340;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#4a1c1a'; g.fillRect(0, 0, W, H);
  // fabric weave
  g.globalAlpha = 0.08;
  for (let y = 0; y < H; y += 3) { g.fillStyle = '#000'; g.fillRect(0, y, W, 1); }
  for (let x = 0; x < W; x += 3) { g.fillStyle = '#fff'; g.fillRect(x, 0, 1, H); }
  g.globalAlpha = 1;
  // border
  g.strokeStyle = '#a88a3c'; g.lineWidth = 10; g.strokeRect(18, 18, W - 36, H - 36);
  g.strokeStyle = '#a88a3c'; g.lineWidth = 3; g.strokeRect(34, 34, W - 68, H - 68);
  g.fillStyle = '#b8984a';
  g.font = '700 30px "Arial Narrow", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('H O M E   O F   T H E', W / 2, 78);
  g.font = '900 210px Impact, "Arial Black", sans-serif';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#1b0b0a'; g.fillText(text, W / 2 + 6, 290 + 6);
  g.fillStyle = '#c9a54e'; g.fillText(text, W / 2, 290);
  g.lineWidth = 4; g.strokeStyle = '#6d5424'; g.strokeText(text, W / 2, 290);
  // stars
  g.fillStyle = '#b8984a';
  for (const x of [120, W - 120]) star(g, x, H / 2 + 20, 40, 18);
  // stains, fading, scorch
  grime(g, W, H, { alpha: 0.5, color: '#120606' });
  for (let i = 0; i < 6; i++) {
    const x = rr(0, W), y = rr(0, H), r = rr(20, 70);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(50,5,5,0.6)'); grd.addColorStop(1, 'rgba(50,5,5,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // a torn corner and a slash
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(W, H); g.lineTo(W - 140, H); g.lineTo(W - 60, H - 40); g.lineTo(W - 20, H - 120); g.lineTo(W, H - 150); g.fill();
  g.beginPath(); g.moveTo(220, 120); g.lineTo(300, 200); g.lineTo(296, 206); g.lineTo(214, 126); g.fill();
  g.globalCompositeOperation = 'source-over';
  const t = toTexture(c, { repeat: false });
  return t;
}

function star(g, x, y, r1, r2) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + i * Math.PI / 5;
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath(); g.fill();
}

// ---------------------------------------------------------------------------
// Scoreboard (redrawn when the round changes)
// ---------------------------------------------------------------------------
export class ScoreboardTexture {
  constructor() {
    [this.canvas, this.g] = makeCanvas(1024, 470);
    this.texture = toTexture(this.canvas, { repeat: false });
    this.draw(0, 0);
  }
  draw(round, kills, flash = 0) {
    const g = this.g, W = 1024, H = 470;
    g.fillStyle = '#0c0b0a'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#3a3630'; g.lineWidth = 16; g.strokeRect(8, 8, W - 16, H - 16);
    g.fillStyle = '#c9c1ad'; g.font = '700 44px "Arial Narrow", Arial, sans-serif'; g.textAlign = 'center';
    g.fillText('STEW', 190, 80); g.fillText('ROUND', W / 2, 80); g.fillText('GUEST', W - 190, 80);
    ledNumber(g, String(kills % 1000).padStart(3, '0'), 190, 200, 44, flash);
    ledNumber(g, String(round).padStart(2, '0'), W / 2, 240, 88, flash);
    ledNumber(g, '---', W - 190, 200, 44, flash, true);
    g.fillStyle = '#c9c1ad'; g.font = '700 30px "Arial Narrow", Arial, sans-serif';
    g.fillText('KILLS', 190, 320); g.fillText('HOME OF THE STEW', W / 2, 430);
    // broken bulbs, dust
    g.globalAlpha = 0.5;
    for (let i = 0; i < 400; i++) { g.fillStyle = rnd() < 0.5 ? '#000' : '#2a2620'; g.fillRect(rr(0, W), rr(0, H), 3, 3); }
    g.globalAlpha = 1;
    this.texture.needsUpdate = true;
  }
}

// Seven-segment style digits made of round "bulbs".
const SEG = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g',
};
function ledNumber(g, str, cx, cy, size, flash, dim = false) {
  const w = size * 1.1, gap = size * 0.45;
  const total = str.length * w + (str.length - 1) * gap;
  let x = cx - total / 2;
  for (const ch of str) {
    const on = SEG[ch] || '';
    const segs = {
      a: [[0, 0], [1, 0]], b: [[1, 0], [1, 1]], c: [[1, 1], [1, 2]], d: [[0, 2], [1, 2]],
      e: [[0, 1], [0, 2]], f: [[0, 0], [0, 1]], g: [[0, 1], [1, 1]],
    };
    for (const [k, [[x0, y0], [x1, y1]]] of Object.entries(segs)) {
      const lit = on.includes(k);
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = x + (x0 + (x1 - x0) * t) * w, py = cy - size + (y0 + (y1 - y0) * t) * size;
        g.fillStyle = lit ? (dim ? '#5a1a10' : flash ? '#fff2d0' : '#ff3a1e') : '#1d1512';
        g.beginPath(); g.arc(px, py, size * 0.085, 0, 7); g.fill();
      }
    }
    x += w + gap;
  }
}

export function signTexture(text, { bg = '#0a0a0a', fg = '#ff2a1a', w = 256, h = 96, font = '900 64px Impact, "Arial Black", sans-serif' } = {}) {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  return toTexture(c, { repeat: false });
}

export function doorTexture(label) {
  seedTextures(label.length * 77);
  const W = 512, H = 640;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#4b4f47'; g.fillRect(0, 0, W, H);
  // two leaves
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(W / 2 - 2, 0, 4, H);
  for (const x of [40, W / 2 + 40]) {
    g.fillStyle = '#12110f'; g.fillRect(x + 40, 70, 96, 170); // small window
    g.strokeStyle = '#2a2a26'; g.lineWidth = 6; g.strokeRect(x + 40, 70, 96, 170);
    g.strokeStyle = 'rgba(160,160,150,0.3)'; g.lineWidth = 1;
    for (let k = 0; k < 170; k += 12) { g.beginPath(); g.moveTo(x + 40, 70 + k); g.lineTo(x + 136, 70 + k + 10); g.stroke(); }
  }
  // push bars
  g.fillStyle = '#8a8a82'; g.fillRect(30, 330, W / 2 - 60, 22); g.fillRect(W / 2 + 30, 330, W / 2 - 60, 22);
  grime(g, W, H, { alpha: 0.5 });
  metalScratches(g, W, H);
  // stenciled label
  g.fillStyle = 'rgba(210,200,170,0.75)';
  g.font = '900 44px Impact, "Arial Black", sans-serif'; g.textAlign = 'center';
  g.fillText(label, W / 2, 470);
  // bottom kick plate rust
  const rg = g.createLinearGradient(0, H - 80, 0, H);
  rg.addColorStop(0, 'rgba(90,45,20,0)'); rg.addColorStop(1, 'rgba(90,45,20,0.8)');
  g.fillStyle = rg; g.fillRect(0, H - 80, W, 80);
  return toTexture(c, { repeat: false });
}

function metalScratches(g, W, H) {
  g.strokeStyle = 'rgba(200,200,190,0.18)';
  for (let i = 0; i < 80; i++) {
    g.lineWidth = rr(0.5, 1.5);
    g.beginPath(); const x = rr(0, W), y = rr(0, H);
    g.moveTo(x, y); g.lineTo(x + rr(-30, 30), y + rr(-8, 8)); g.stroke();
  }
}

// ---------------------------------------------------------------------------
// Zombie skin & clothes
// ---------------------------------------------------------------------------
export function skinTexture(seed = 1) {
  seedTextures(seed * 97 + 11);
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  const base = `hsl(${rr(60, 95)},${rr(5, 12)}%,${rr(46, 58)}%)`;
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  grime(g, S, S, { alpha: 0.5, color: '#2a2a1c' });
  // veins
  g.strokeStyle = 'rgba(60,50,80,0.35)';
  for (let i = 0; i < 20; i++) {
    g.lineWidth = rr(0.5, 1.5);
    g.beginPath(); let x = rr(0, S), y = rr(0, S); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += rr(-20, 20); y += rr(-20, 20); g.lineTo(x, y); }
    g.stroke();
  }
  // bruises, sores, dried blood
  for (let i = 0; i < 10; i++) {
    const x = rr(0, S), y = rr(0, S), r = rr(5, 26);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const col = rnd() < 0.5 ? '70,20,15' : '60,55,40';
    grd.addColorStop(0, `rgba(${col},0.75)`); grd.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  speckle(g, S, S, 900, ['#2a2018', '#6a2a20', '#9a9a88']);
  return toTexture(c);
}

export function clothTexture(seed = 1, color = '#4a4a3a', { stripes = false } = {}) {
  seedTextures(seed * 131 + 7);
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = color; g.fillRect(0, 0, S, S);
  if (stripes) {
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = 0; y < S; y += 24) g.fillRect(0, y, S, 8);
  }
  g.globalAlpha = 0.06;
  for (let y = 0; y < S; y += 2) { g.fillStyle = '#000'; g.fillRect(0, y, S, 1); }
  g.globalAlpha = 1;
  grime(g, S, S, { alpha: 0.55, color: '#15100a' });
  // blood soaks
  for (let i = 0; i < 6; i++) {
    const x = rr(0, S), y = rr(0, S), r = rr(10, 50);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(70,4,4,0.85)'); grd.addColorStop(0.6, 'rgba(60,4,4,0.5)'); grd.addColorStop(1, 'rgba(60,4,4,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // tears: dark holes with ragged skin showing
  for (let i = 0; i < 7; i++) {
    const x = rr(0, S), y = rr(0, S), r = rr(5, 18);
    g.fillStyle = '#6f6e5c';
    g.beginPath();
    for (let a = 0; a < 6.28; a += 0.5) g.lineTo(x + Math.cos(a) * r * rr(0.4, 1.2), y + Math.sin(a) * r * rr(0.4, 1.2));
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.stroke();
  }
  return toTexture(c);
}

// ---------------------------------------------------------------------------
// Decals & particles
// ---------------------------------------------------------------------------
export function bloodSplatTexture(seed = 1) {
  seedTextures(seed * 53 + 3);
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  g.clearRect(0, 0, S, S);
  const cx = S / 2, cy = S / 2;
  const col = () => `rgba(${Math.floor(rr(70, 110))},${Math.floor(rr(2, 10))},${Math.floor(rr(2, 8))},${rr(0.75, 0.95)})`;
  g.fillStyle = col();
  g.beginPath();
  for (let a = 0; a < 6.28; a += 0.25) {
    const r = rr(30, 60);
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  for (let i = 0; i < 30; i++) {
    const a = rr(0, 6.28), d = rr(40, 120), r = rr(2, 12);
    g.fillStyle = col();
    g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, 0, 7); g.fill();
    // streak toward center
    g.strokeStyle = col(); g.lineWidth = r * 0.6;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); g.lineTo(cx + Math.cos(a) * (d - rr(10, 40)), cy + Math.sin(a) * (d - rr(10, 40))); g.stroke();
  }
  // darker wet center
  const grd = g.createRadialGradient(cx, cy, 0, cx, cy, 50);
  grd.addColorStop(0, 'rgba(30,0,0,0.6)'); grd.addColorStop(1, 'rgba(30,0,0,0)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
  return toTexture(c, { repeat: false });
}

export function bulletHoleTexture() {
  const S = 64;
  const [c, g] = makeCanvas(S, S);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.18, 'rgba(10,8,6,0.95)');
  grd.addColorStop(0.35, 'rgba(40,34,26,0.6)'); grd.addColorStop(1, 'rgba(40,34,26,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const a = rr(0, 6.28);
    g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.cos(a) * rr(10, 26), 32 + Math.sin(a) * rr(10, 26)); g.stroke();
  }
  return toTexture(c, { repeat: false });
}

export function softDotTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const S = 64;
  const [c, g] = makeCanvas(S, S);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return toTexture(c, { repeat: false, srgb: false });
}

export function muzzleFlashTexture() {
  const S = 128;
  const [c, g] = makeCanvas(S, S);
  g.translate(64, 64);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 60);
  grd.addColorStop(0, 'rgba(255,250,220,1)'); grd.addColorStop(0.2, 'rgba(255,200,90,0.9)');
  grd.addColorStop(0.5, 'rgba(255,120,30,0.35)'); grd.addColorStop(1, 'rgba(255,80,0,0)');
  g.fillStyle = grd;
  for (let i = 0; i < 5; i++) {
    g.rotate(Math.PI * 2 / 5 + rr(-0.2, 0.2));
    g.beginPath(); g.moveTo(0, -6); g.lineTo(rr(40, 62), 0); g.lineTo(0, 6); g.fill();
  }
  g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill();
  return toTexture(c, { repeat: false });
}

export function beamTexture() {
  const [c, g] = makeCanvas(64, 256);
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 256);
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.5, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = side; g.fillRect(0, 0, 64, 256);
  return toTexture(c, { repeat: false, srgb: false });
}

export function groundTexture() {
  seedTextures(77);
  const S = 512;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#2c2a20'; g.fillRect(0, 0, S, S);
  grime(g, S, S, { alpha: 0.6, color: '#12100a' });
  speckle(g, S, S, 6000, ['#3c3a2a', '#1a1a12', '#4a4430', '#2a3020'], [1, 3]);
  // dead grass tufts
  g.strokeStyle = 'rgba(90,86,50,0.5)';
  for (let i = 0; i < 400; i++) {
    const x = rr(0, S), y = rr(0, S);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(-3, 3), y - rr(3, 8)); g.stroke();
  }
  const t = toTexture(c);
  t.repeat.set(1 / 6, 1 / 6);
  return t;
}

export function gunMetalTexture(base = '#2c2d2e') {
  seedTextures(55);
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  g.globalAlpha = 0.12;
  for (let i = 0; i < 300; i++) {
    g.strokeStyle = rnd() < 0.5 ? '#000' : '#aaa';
    g.beginPath(); const y = rr(0, S); g.moveTo(0, y); g.lineTo(S, y + rr(-2, 2)); g.stroke();
  }
  g.globalAlpha = 1;
  // worn edges: bright scratches
  g.strokeStyle = 'rgba(190,190,180,0.25)';
  for (let i = 0; i < 60; i++) { g.lineWidth = rr(0.5, 1.2); g.beginPath(); const x = rr(0, S), y = rr(0, S); g.moveTo(x, y); g.lineTo(x + rr(-20, 20), y + rr(-4, 4)); g.stroke(); }
  grime(g, S, S, { alpha: 0.3 });
  return toTexture(c);
}

export function gloveTexture() {
  seedTextures(88);
  const S = 128;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#2e2a22'; g.fillRect(0, 0, S, S);
  grime(g, S, S, { alpha: 0.5 });
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  for (let y = 0; y < S; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  return toTexture(c);
}

export function sleeveTexture() {
  seedTextures(89);
  const S = 128;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#3d3f2c'; g.fillRect(0, 0, S, S);
  g.globalAlpha = 0.08;
  for (let y = 0; y < S; y += 2) { g.fillStyle = '#000'; g.fillRect(0, y, S, 1); }
  g.globalAlpha = 1;
  grime(g, S, S, { alpha: 0.55 });
  return toTexture(c);
}

// =============================================================================
// Phase 2: room surfaces, lockers, chalk outlines, mystery box
// =============================================================================

// Checkerboard linoleum with wear. tile = meters per tile; 1 repeat = 8 tiles.
export function linoleumTexture({ tile = 0.3, a = '#8f8a74', b = '#5e6a5a', seed = 5 } = {}) {
  seedTextures(seed);
  const S = 1024, n = 8, ts = S / n;
  const [c, g] = makeCanvas(S, S);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    g.fillStyle = (x + y) % 2 ? a : b;
    g.fillRect(x * ts, y * ts, ts, ts);
    g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,240'},${rr(0.02, 0.08)})`;
    g.fillRect(x * ts, y * ts, ts, ts);
    // marbled flecks
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,255,${rr(0.03, 0.1)})`; g.fillRect(x * ts + rr(0, ts), y * ts + rr(0, ts), rr(2, 8), rr(1, 3)); }
  }
  g.strokeStyle = 'rgba(20,18,12,0.5)'; g.lineWidth = 2;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * ts, 0); g.lineTo(i * ts, S); g.stroke(); g.beginPath(); g.moveTo(0, i * ts); g.lineTo(S, i * ts); g.stroke(); }
  // cracked and missing tiles
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rr(0, n)) * ts, y = Math.floor(rr(0, n)) * ts;
    if (rnd() < 0.4) { g.fillStyle = '#2f2a20'; g.fillRect(x + 2, y + 2, ts - 4, ts - 4); grimeRect(g, x, y, ts); }
    else {
      g.strokeStyle = 'rgba(15,12,8,0.7)'; g.lineWidth = 1.5; g.beginPath();
      let px = x + rr(0, ts), py = y; g.moveTo(px, py);
      for (let k = 0; k < 5; k++) { px += rr(-20, 20); py += ts / 5; g.lineTo(px, py); }
      g.stroke();
    }
  }
  grime(g, S, S, { alpha: 0.42, color: '#1a150c' });
  // scuffs and drag marks
  g.strokeStyle = 'rgba(15,15,15,0.3)';
  for (let i = 0; i < 90; i++) { g.lineWidth = rr(1, 3); g.beginPath(); const x = rr(0, S), y = rr(0, S); g.moveTo(x, y); g.lineTo(x + rr(-60, 60), y + rr(-10, 10)); g.stroke(); }
  speckle(g, S, S, 2500, ['#1b130b', '#3a2c1c', '#bdb6a0']);
  const t = toTexture(c);
  t.repeat.set(1 / (tile * n), 1 / (tile * n));
  return t;
}

function grimeRect(g, x, y, s) {
  g.fillStyle = 'rgba(60,50,30,0.5)';
  for (let k = 0; k < 20; k++) g.fillRect(x + rr(0, s), y + rr(0, s), rr(2, 6), rr(2, 6));
}

export function carpetTexture({ base = '#3e4653', seed = 8, photo = false } = {}) {
  seedTextures(seed);
  const S = 512;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (rnd() - 0.5) * 30;
    img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v;
  }
  g.putImageData(img, 0, 0);
  // subtle pattern
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 3;
  if (!photo) for (let x = 0; x < S; x += 64) for (let y = 0; y < S; y += 64) { g.strokeRect(x + 16, y + 16, 32, 32); }
  // stains
  for (let i = 0; i < 12; i++) {
    const x = rr(0, S), y = rr(0, S), r = rr(15, 60);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const col = rnd() < 0.3 ? '60,12,8' : '40,32,20';
    grd.addColorStop(0, `rgba(${col},0.55)`); grd.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, r, r * rr(0.5, 1), rr(0, 3), 0, 7); g.fill();
  }
  grime(g, S, S, { alpha: 0.3 });
  const t = toTexture(c);
  t.repeat.set(1 / 3, 1 / 3);
  return t;
}

// Generic interior wall. u: 4m per repeat, v: 0..1 = full wall height.
// lower: wainscot color & height, blocks: cinderblock joints, tiles: glossy tile wainscot
export function roomWallTexture({ height = 3.4, upper = '#8a8570', lower = '#445a4f', lowerH = 1.2, blocks = true, tiles = false, panel = false, stripe = null, seed = 3, photo = false } = {}) {
  seedTextures(seed);
  const W = 512, H = Math.max(256, Math.round(512 * height / 4));
  const [c, g] = makeCanvas(W, H);
  const px = W / 4;
  g.fillStyle = upper; g.fillRect(0, 0, W, H);
  const ly = H - lowerH * px;
  g.fillStyle = lower; g.fillRect(0, ly, W, lowerH * px);
  if (stripe) { g.fillStyle = stripe; g.fillRect(0, ly - 0.08 * px, W, 0.08 * px); }
  if (blocks && !photo) {
    const bw = 0.4 * px, bh = 0.2 * px;
    for (let row = 0; row * bh < H; row++) {
      const off = (row % 2) * bw / 2;
      g.fillStyle = 'rgba(20,16,10,0.3)';
      g.fillRect(0, H - row * bh, W, 1.5);
      for (let x = -off; x < W; x += bw) g.fillRect(x, H - (row + 1) * bh, 1.5, bh);
    }
  }
  if (tiles && !photo) {
    const t = 0.15 * px;
    for (let y = ly; y < H; y += t) for (let x = 0; x < W; x += t) {
      g.fillStyle = `rgba(255,255,255,${rr(0.02, 0.1)})`; g.fillRect(x + 1, y + 1, t - 2, t - 2);
      g.fillStyle = 'rgba(30,30,25,0.45)'; g.fillRect(x, y, t, 1.2); g.fillRect(x, y, 1.2, t);
      if (rnd() < 0.03) { g.fillStyle = 'rgba(40,36,28,0.9)'; g.fillRect(x + 1, y + 1, t - 2, t - 2); }
    }
  }
  if (panel) {
    // vertical wood paneling on the lower part (0.6m boards to match the photo's grain)
    for (let x = 0; x < W; x += (photo ? 0.6 : 0.3) * px) {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, ly, 2, H - ly);
      g.fillStyle = 'rgba(255,220,180,0.06)'; g.fillRect(x + 2, ly, (photo ? 0.6 : 0.3) * px - 4, H - ly);
    }
    g.fillStyle = '#3a2618'; g.fillRect(0, ly - 6, W, 8);
  }
  // water damage, peeling, drips
  for (let i = 0; i < 10; i++) {
    const x = rr(0, W), y = rr(0, ly), r = rr(6, 26);
    g.fillStyle = 'rgba(110,105,92,0.8)';
    g.beginPath(); for (let a = 0; a < 6.28; a += 0.5) g.lineTo(x + Math.cos(a) * r * rr(0.5, 1.2), y + Math.sin(a) * r * 0.7 * rr(0.5, 1.2)); g.closePath(); g.fill();
  }
  for (let i = 0; i < 18; i++) {
    const x = rr(0, W), len = rr(H * 0.1, H * 0.7);
    const grd = g.createLinearGradient(0, 0, 0, len);
    grd.addColorStop(0, 'rgba(40,32,18,0.45)'); grd.addColorStop(1, 'rgba(40,32,18,0)');
    g.fillStyle = grd; g.fillRect(x, 0, rr(2, 9), len);
  }
  grime(g, W, H, { alpha: 0.32 });
  const f = g.createLinearGradient(0, H - px * 0.6, 0, H);
  f.addColorStop(0, 'rgba(15,10,5,0)'); f.addColorStop(1, 'rgba(15,10,5,0.75)');
  g.fillStyle = f; g.fillRect(0, H - px * 0.6, W, px * 0.6);
  const top = g.createLinearGradient(0, 0, 0, px * 0.8);
  top.addColorStop(0, 'rgba(8,6,4,0.6)'); top.addColorStop(1, 'rgba(8,6,4,0)');
  g.fillStyle = top; g.fillRect(0, 0, W, px * 0.8);
  speckle(g, W, H, 1800, ['#222', '#555', '#bbb']);
  const t = toTexture(c, { clampV: true });
  t.repeat.set(1 / 4, 1 / height);
  return t;
}

export function brickTexture({ height = 9, photo = false } = {}) {
  seedTextures(21);
  const W = 512, H = Math.round(512 * height / 4);
  const [c, g] = makeCanvas(W, H);
  const px = W / 4, bw = 0.22 * px, bh = 0.075 * px;
  g.fillStyle = photo ? '#5a3e30' : '#3a3129'; g.fillRect(0, 0, W, H);
  if (photo) {
    // soot and rain streaks down the brick; the photo supplies the bricks
    for (let i = 0; i < 30; i++) {
      const x = rr(0, W), len = rr(H * 0.15, H * 0.8);
      const grd = g.createLinearGradient(0, 0, 0, len);
      grd.addColorStop(0, 'rgba(10,8,6,0.5)'); grd.addColorStop(1, 'rgba(10,8,6,0)');
      g.fillStyle = grd; g.fillRect(x, 0, rr(4, 18), len);
    }
    const f = g.createLinearGradient(0, H - px * 1.0, 0, H);
    f.addColorStop(0, 'rgba(12,10,6,0)'); f.addColorStop(1, 'rgba(12,10,6,0.6)');
    g.fillStyle = f; g.fillRect(0, H - px, W, px);
  }
  for (let row = 0; row * bh < H && !photo; row++) {
    const off = (row % 2) * bw / 2;
    for (let x = -off; x < W; x += bw) {
      g.fillStyle = `hsl(${rr(8, 20)},${rr(25, 40)}%,${rr(18, 28)}%)`;
      g.fillRect(x + 1, H - (row + 1) * bh + 1, bw - 2, bh - 2);
    }
  }
  grime(g, W, H, { alpha: 0.5 });
  const t = toTexture(c, { clampV: true });
  t.repeat.set(1 / 4, 1 / height);
  return t;
}

export function dropCeilingTexture({ seed = 12, photo = false } = {}) {
  seedTextures(seed);
  const S = 512; // 4m x 4m, tiles 0.6 x 1.2 (photo: 3.6m, 0.6m square tiles to match it)
  const [c, g] = makeCanvas(S, S);
  const span = photo ? 3.6 : 4;
  const px = S / span;
  g.fillStyle = '#9e9886'; g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) { const v = (rnd() - 0.5) * 18; img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v; }
  g.putImageData(img, 0, 0);
  const tw = 0.6 * px, th = (photo ? 0.6 : 1.2) * px;
  for (let x = 0; x < S - 1; x += tw) for (let y = 0; y < S - 1; y += th) {
    // water stains, a few tiles missing (dark void)
    const r = rnd();
    if (r < 0.08) { g.fillStyle = '#0d0b09'; g.fillRect(x + 2, y + 2, tw - 4, th - 4); }
    else if (r < 0.14) { g.fillStyle = '#0d0b09'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + tw, y); g.lineTo(x + tw * 0.2, y + th * 0.7); g.fill(); }
    else if (r < 0.4) {
      const cx = x + rr(0, tw), cy = y + rr(0, th), rad = rr(10, 40);
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grd.addColorStop(0, 'rgba(90,70,30,0.5)'); grd.addColorStop(0.8, 'rgba(90,70,30,0.25)'); grd.addColorStop(1, 'rgba(90,70,30,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, rad, 0, 7); g.fill();
    }
  }
  g.fillStyle = '#6b6a66';
  for (let x = 0; x < S; x += tw) g.fillRect(x - 1.5, 0, 3, S);
  for (let y = 0; y < S; y += th) g.fillRect(0, y - 1.5, S, 3);
  grime(g, S, S, { alpha: 0.35 });
  const t = toTexture(c);
  t.repeat.set(1 / span, 1 / span);
  return t;
}

export function lockerTexture({ color = '#3f5a6e', seed = 31 } = {}) {
  seedTextures(seed);
  const W = 512, H = 512; // 2m wide x 2m tall, 5 lockers
  const [c, g] = makeCanvas(W, H);
  const lw = W / 5;
  for (let i = 0; i < 5; i++) {
    const x = i * lw;
    const l = rr(-6, 6);
    g.fillStyle = color; g.fillRect(x, 0, lw, H);
    g.fillStyle = `rgba(${l > 0 ? '255,255,255' : '0,0,0'},${Math.abs(l) / 60})`; g.fillRect(x, 0, lw, H);
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, 0, 2.5, H);
    // vents
    for (const vy of [40, 70, H - 70]) for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x + 20, vy + k * 5, lw - 40, 2); }
    // handle & number plate
    g.fillStyle = '#9a9a92'; g.fillRect(x + lw - 22, H * 0.52, 8, 34);
    g.fillStyle = '#c8c4b0'; g.fillRect(x + lw / 2 - 12, 100, 24, 12);
    g.fillStyle = '#222'; g.font = '10px monospace'; g.textAlign = 'center'; g.fillText(String(100 + Math.floor(rnd() * 800)), x + lw / 2, 110);
    // dents and scratches, one hanging open (dark inside)
    if (rnd() < 0.15) { g.fillStyle = '#0c0c0c'; g.fillRect(x + 4, 4, lw - 8, H - 8); }
    for (let k = 0; k < 6; k++) { g.strokeStyle = 'rgba(210,210,200,0.25)'; g.beginPath(); const sx = x + rr(0, lw), sy = rr(0, H); g.moveTo(sx, sy); g.lineTo(sx + rr(-20, 20), sy + rr(-6, 6)); g.stroke(); }
  }
  // stickers / blood smear
  g.fillStyle = 'rgba(80,8,6,0.6)'; g.fillRect(rr(0, W), rr(H * 0.4, H * 0.7), rr(6, 12), rr(40, 120));
  grime(g, W, H, { alpha: 0.4 });
  const rust = g.createLinearGradient(0, H - 60, 0, H);
  rust.addColorStop(0, 'rgba(90,45,20,0)'); rust.addColorStop(1, 'rgba(90,45,20,0.7)');
  g.fillStyle = rust; g.fillRect(0, H - 60, W, 60);
  const t = toTexture(c);
  t.repeat.set(1 / 2, 1 / 2);
  return t;
}

export function cabinetTexture() {
  seedTextures(41);
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#6d6a5e'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += S / 4) {
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, y, S, 3);
    g.fillStyle = '#a8a494'; g.fillRect(S / 2 - 25, y + 22, 50, 8);
    g.fillStyle = '#ddd8c4'; g.fillRect(S / 2 - 15, y + 8, 30, 10);
  }
  grime(g, S, S, { alpha: 0.45 });
  const t = toTexture(c);
  t.repeat.set(1, 1 / 1.35);
  return t;
}

export function bookshelfTexture() {
  seedTextures(43);
  const S = 512;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#2c1d12'; g.fillRect(0, 0, S, S);
  for (let row = 0; row < 5; row++) {
    const y0 = row * S / 5;
    g.fillStyle = '#3d2a1a'; g.fillRect(0, y0 + S / 5 - 10, S, 10);
    let x = 4;
    while (x < S - 8) {
      const w = rr(8, 22), h = rr(S / 5 * 0.55, S / 5 * 0.85);
      if (rnd() < 0.12) { x += w * 2; continue; }
      g.fillStyle = `hsl(${rr(0, 360)},${rr(15, 35)}%,${rr(15, 32)}%)`;
      g.fillRect(x, y0 + S / 5 - 10 - h, w, h);
      g.fillStyle = 'rgba(220,200,150,0.25)'; g.fillRect(x + 2, y0 + S / 5 - 10 - h * 0.7, w - 4, 3);
      x += w + 1;
    }
  }
  grime(g, S, S, { alpha: 0.35 });
  return toTexture(c, { repeat: false });
}

// Chalk outline of a weapon, with its name and price, drawn on the wall.
export function chalkTexture(def, model) {
  seedTextures(def.name.length * 13);
  const W = 512, H = 256;
  const [c, g] = makeCanvas(W, H);
  g.clearRect(0, 0, W, H);
  g.strokeStyle = 'rgba(235,232,220,0.9)';
  g.lineCap = 'round'; g.lineJoin = 'round';
  const shapes = {
    pistol: [[150, 110], [350, 110], [350, 130], [270, 130], [262, 150], [240, 150], [250, 190], [215, 200], [205, 130], [150, 130]],
    rifle: [[40, 105], [300, 105], [300, 98], [470, 98], [470, 108], [320, 112], [300, 128], [260, 128], [250, 160], [230, 160], [225, 128], [130, 126], [60, 150], [40, 145]],
    doubleBarrel: [[40, 100], [470, 94], [470, 112], [240, 118], [180, 126], [120, 130], [60, 158], [40, 150]],
    smg: [[70, 100], [110, 100], [110, 108], [360, 108], [360, 100], [440, 100], [440, 116], [300, 122], [290, 200], [270, 200], [270, 124], [230, 124], [215, 170], [195, 170], [200, 124], [110, 116], [70, 116]],
  };
  const byClass = { pistol: 'pistol', smg: 'smg', shotgun: 'doubleBarrel', ar: 'rifle', lmg: 'rifle', sniper: 'rifle', launcher: 'rifle' };
  if (model === 'frag') {
    // two grenades side by side
    for (const cx of [210, 300]) {
      for (let pass = 0; pass < 3; pass++) {
        g.lineWidth = pass === 0 ? 5 : 2; g.globalAlpha = pass === 0 ? 0.5 : 0.8;
        g.beginPath(); g.ellipse(cx + rr(-2, 2), 150, 34, 42, 0, 0, 7); g.stroke();
        g.strokeRect(cx - 10, 96, 20, 14);
        g.beginPath(); g.moveTo(cx + 10, 100); g.lineTo(cx + 34, 128); g.stroke();
        g.beginPath(); g.arc(cx - 16, 96, 9, 0, 7); g.stroke();
      }
      g.globalAlpha = 0.3; g.lineWidth = 2;
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(cx - 30, 150 + k * 20); g.lineTo(cx + 30, 150 + k * 20); g.stroke(); }
    }
  }
  const pts = model === 'frag' ? [] : shapes[model] || shapes[byClass[def.class]] || shapes.rifle;
  for (let pass = 0; pass < 3 && pts.length; pass++) {
    g.lineWidth = pass === 0 ? 5 : 2;
    g.globalAlpha = pass === 0 ? 0.5 : 0.8;
    g.beginPath();
    pts.forEach(([x, y], i) => { const jx = x + rr(-2, 2), jy = y + rr(-2, 2); i ? g.lineTo(jx, jy) : g.moveTo(jx, jy); });
    g.closePath(); g.stroke();
  }
  // fill scribble
  g.globalAlpha = 0.18; g.lineWidth = 2;
  if (pts.length) for (let i = 0; i < 40; i++) { g.beginPath(); const x = rr(80, 440), y = rr(100, 125); g.moveTo(x, y); g.lineTo(x + rr(-30, 30), y + rr(-6, 6)); g.stroke(); }
  g.globalAlpha = 0.85;
  g.fillStyle = 'rgba(235,232,220,0.85)';
  g.font = '700 30px "Trebuchet MS", sans-serif'; g.textAlign = 'center';
  g.fillText(def.name.toUpperCase(), W / 2, 58);
  g.font = '700 26px "Trebuchet MS", sans-serif';
  g.fillText(String(def.cost), W / 2, 238);
  // smudge the chalk
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${rr(0.2, 0.8)})`; g.fillRect(rr(0, W), rr(0, H), rr(1, 3), rr(1, 3)); }
  g.globalCompositeOperation = 'source-over';
  return toTexture(c, { repeat: false });
}

export function mysteryBoxTexture({ side = true } = {}) {
  seedTextures(61);
  const W = 512, H = 256;
  const [c, g] = makeCanvas(W, H);
  // dark weathered crate planks
  for (let y = 0; y < H; y += 32) {
    g.fillStyle = `hsl(25,${rr(25, 35)}%,${rr(22, 30)}%)`; g.fillRect(0, y, W, 32);
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, y, W, 2);
    g.globalAlpha = 0.2;
    for (let k = 0; k < 6; k++) { g.strokeStyle = '#000'; g.beginPath(); const yy = y + rr(3, 29); g.moveTo(0, yy); g.lineTo(W, yy + rr(-2, 2)); g.stroke(); }
    g.globalAlpha = 1;
  }
  // iron corners
  g.fillStyle = '#2a2a28';
  for (const [x, y] of [[0, 0], [W - 40, 0], [0, H - 40], [W - 40, H - 40]]) g.fillRect(x, y, 40, 40);
  g.fillStyle = '#555';
  for (const [x, y] of [[12, 12], [W - 28, 12], [12, H - 28], [W - 28, H - 28]]) { g.beginPath(); g.arc(x + 8, y + 8, 4, 0, 7); g.fill(); }
  grime(g, W, H, { alpha: 0.4 });
  const t = toTexture(c, { repeat: false });
  return t;
}

// Glowing question marks (used as emissive map, black elsewhere).
export function questionMarkTexture() {
  const W = 512, H = 256;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.font = '900 170px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#8fd8ff'; g.shadowBlur = 24;
  g.fillStyle = '#bfe9ff';
  g.fillText('?', W * 0.3, H / 2 + 8);
  g.fillText('?', W * 0.7, H / 2 + 8);
  return toTexture(c, { repeat: false });
}

export function tableTopTexture() {
  seedTextures(71);
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#8c8878'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},0.05)`; g.fillRect(rr(0, S), rr(0, S), rr(2, 10), 1); }
  // gum, carved initials, stains
  g.strokeStyle = 'rgba(30,25,20,0.5)';
  for (let i = 0; i < 5; i++) { g.beginPath(); const x = rr(20, S - 20), y = rr(20, S - 20); g.moveTo(x, y); g.lineTo(x + rr(-15, 15), y + rr(-15, 15)); g.stroke(); }
  grime(g, S, S, { alpha: 0.4 });
  const t = toTexture(c);
  t.repeat.set(1 / 2, 1 / 2);
  return t;
}

export function steelTexture() {
  seedTextures(73);
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#8a8c88'; g.fillRect(0, 0, S, S);
  g.globalAlpha = 0.15;
  for (let i = 0; i < 300; i++) { g.strokeStyle = rnd() < 0.5 ? '#000' : '#fff'; g.beginPath(); const y = rr(0, S); g.moveTo(0, y); g.lineTo(S, y + rr(-1, 1)); g.stroke(); }
  g.globalAlpha = 1;
  grime(g, S, S, { alpha: 0.35 });
  const t = toTexture(c);
  t.repeat.set(1 / 1.5, 1 / 1.5);
  return t;
}

// A soft-edged irregular blob (pools, puddles). rgb is the fill; the edge fades.
// Built from overlapping radial gradients so the outline wobbles.
export function blobTexture(seed = 1, { rgb = [255, 255, 255], size = 256, lobes = 9, core = 1 } = {}) {
  seedTextures(seed * 97 + 11);
  const S = size;
  const [c, g] = makeCanvas(S, S);
  g.clearRect(0, 0, S, S);
  const [r, gg, b] = rgb;
  const blob = (x, y, rad, a) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(${r},${gg},${b},${a})`);
    grd.addColorStop(0.62, `rgba(${r},${gg},${b},${a})`);
    grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  };
  blob(S / 2, S / 2, S * 0.3, core);
  for (let i = 0; i < lobes; i++) {
    const a = rr(0, 6.28), d = rr(0.05, 0.2) * S;
    blob(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, rr(0.12, 0.22) * S, rr(0.7, 1));
  }
  return toTexture(c, { repeat: false, srgb: false });
}

// A wispy smoke puff: a handful of soft dots with some holes in it.
export function smokeTexture(seed = 1) {
  seedTextures(seed * 31 + 5);
  const S = 128;
  const [c, g] = makeCanvas(S, S);
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 22; i++) {
    const a = rr(0, 6.28), d = rr(0, 0.28) * S, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, rad = rr(0.1, 0.24) * S;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(255,255,255,${rr(0.25, 0.5)})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
  }
  // fade the square's corners right out
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S / 2);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
  return toTexture(c, { repeat: false, srgb: false });
}
