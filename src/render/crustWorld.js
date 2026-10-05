// =============================================================================
// Call of the Crust: the snow world around the field. An open night sky full
// of stars, a galaxy band and planets; snow falling all the time; cliffs and
// pine forest round the field; frozen water to the north and, out across it,
// four red-and-white smokestacks on a lit-up power plant (after the Northport
// stacks). Also draws the field's props (the truck, crates, the fire barrel,
// rocks, pines, the sign).
//
// mapView calls crustMaterials() while it builds its materials and
// buildCrust() in place of the school's exterior; update() runs every frame.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';

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
    g.fillStyle = `rgba(225,232,242,${0.5 + r() * 0.4})`;
    g.beginPath(); g.ellipse(x, y, w, 3 + r() * 6, (r() - 0.5) * 0.3, 0, 7); g.fill();
  }
  // frost at the top
  const grd = g.createLinearGradient(0, 0, 0, H * 0.25);
  grd.addColorStop(0, 'rgba(230,236,246,0.9)'); grd.addColorStop(1, 'rgba(230,236,246,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H * 0.25);
  const t = T.toTexture(c); t.repeat.set(1 / 7, 1 / 7);
  return t;
}

// The night sky, wrapped round the world (equirectangular): stars, a galaxy
// band with nebulae, and a horizon that fades into the fog.
function skyTexture(fog) {
  const W = 2048, H = 1024, [c, g] = T.makeCanvas(W, H), r = R(2024);
  const sky = g.createLinearGradient(0, 0, 0, H / 2);
  sky.addColorStop(0, '#03040a'); sky.addColorStop(0.55, '#070b18'); sky.addColorStop(0.88, '#111a2c'); sky.addColorStop(1, fog);
  g.fillStyle = sky; g.fillRect(0, 0, W, H / 2);
  g.fillStyle = fog; g.fillRect(0, H / 2, W, H / 2);
  // the galaxy: a glowing band arcing across the sky
  const band = (x) => H * 0.24 + Math.sin(x / W * Math.PI * 2 + 0.6) * H * 0.13;
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 1400; i++) {
    const x = r() * W, y = band(x) + (r() - 0.5) * (40 + r() * 120), rad = 8 + r() * 46;
    const col = r() < 0.45 ? [120, 90, 255] : r() < 0.6 ? [255, 110, 170] : r() < 0.5 ? [90, 210, 255] : [255, 230, 200];
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${col},${0.05 + r() * 0.06})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // big soft nebulae
  for (const [x, y, rad, col] of [[300, 180, 260, '150,60,220'], [1300, 120, 300, '40,150,220'], [1750, 260, 220, '230,70,140'], [820, 300, 200, '60,200,190']]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${col},0.22)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = 'source-over';
  // dust lanes through the band
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = band(x) + (r() - 0.5) * 30, rad = 10 + r() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(4,4,10,0.35)'); gr.addColorStop(1, 'rgba(4,4,10,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // stars, thickest in the band
  for (let i = 0; i < 9000; i++) {
    const x = r() * W;
    const y = r() < 0.4 ? band(x) + (r() - 0.5) * 140 : r() * H * 0.48;
    const b = r(), s = b > 0.995 ? 2.4 : b > 0.96 ? 1.5 : 0.9;
    const tint = r() < 0.15 ? '200,220,255' : r() < 0.1 ? '255,220,190' : '255,255,255';
    g.fillStyle = `rgba(${tint},${0.35 + r() * 0.65 * (1 - y / (H * 0.55))})`;
    g.fillRect(x, y, s, s);
    if (b > 0.997) { g.fillStyle = `rgba(${tint},0.25)`; g.fillRect(x - 3, y + s / 2, 6 + s, 0.8); g.fillRect(x + s / 2, y - 3, 0.8, 6 + s); }
  }
  const t = T.toTexture(c, { repeat: false });
  return t;
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
  // the night side
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
  // seams between sections
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (const y of [0.1, 0.25, 0.42, 0.6, 0.8]) g.fillRect(0, y * H, W, 2);
  // grime running down from the top, rust streaks
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = 0.02 * H + r() * H * 0.5, len = 20 + r() * 260;
    const gr = g.createLinearGradient(0, y, 0, y + len);
    gr.addColorStop(0, `rgba(60,40,30,${0.15 + r() * 0.25})`); gr.addColorStop(1, 'rgba(60,40,30,0)');
    g.fillStyle = gr; g.fillRect(x, y, 1 + r() * 2.5, len);
  }
  return T.toTexture(c, { repeat: false });
}

// The plant's brown boiler houses: corrugated panels, a few lit windows.
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
  // an arrow pointing on, to the stacks
  g.beginPath(); g.moveTo(456, 60); g.lineTo(500, 86); g.lineTo(456, 112); g.closePath(); g.fill();
  g.fillRect(420, 78, 40, 16);
  // snow crusted along the top
  g.fillStyle = 'rgba(240,244,250,0.9)'; for (let x = 0; x < 512; x += 12) g.fillRect(x, 0, 12, 6 + Math.random() * 10);
  return T.toTexture(c, { repeat: false });
}

// --- materials (called from mapView.buildMaterials) --------------------------------------
export function crustMaterials(M, wallMats, applyBake) {
  const snow = new THREE.MeshStandardMaterial({ map: snowTexture(), color: '#ffffff', roughness: 0.95 });
  snow.bumpMap = snow.map; snow.bumpScale = 1.2;
  M.snow = applyBake(snow);
  const cliff = new THREE.MeshStandardMaterial({ map: cliffTexture(), roughness: 1 });
  cliff.bumpMap = cliff.map; cliff.bumpScale = 3;
  wallMats.cliff = applyBake(cliff);
}

// --- the world --------------------------------------------------------------------------
export function buildCrust(mv) {
  const map = mv.map, group = mv.group;
  const fog = map.fog ? map.fog.color : '#1c2534';
  const out = { mv };
  const snowMat = new THREE.MeshStandardMaterial({ color: '#d8e0ec', roughness: 0.95, emissive: new THREE.Color('#202a3c'), emissiveIntensity: 1 });
  const snowCap = new THREE.MeshStandardMaterial({ color: '#eef2f8', roughness: 0.9, emissive: new THREE.Color('#141a26') });
  const rockMat = new THREE.MeshStandardMaterial({ color: '#4c525a', roughness: 1, flatShading: true });
  const r = R(9);
  const [fx0, fz0, fx1, fz1] = map.rooms[0].rect;

  // --- the sky: a dome that follows the camera, with planets in it
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
      // the ring's texture runs across its width
      const uv = rg.geometry.attributes.uv, p = rg.geometry.attributes.position;
      for (let i = 0; i < uv.count; i++) { const rr = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (rr - size * 1.35) / (size * 0.95), 0.5); }
      rg.position.copy(d); rg.lookAt(0, 0, 0); rg.rotateX(1.15); rg.rotateZ(-0.35);
      rg.renderOrder = -9;
      sky.add(rg);
    }
    return m;
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

  // --- the ground out past the field: snow, rolling into hills, with the lake cut flat
  const ground = new THREE.PlaneGeometry(440, 440, 88, 88).rotateX(-Math.PI / 2);
  const gp = ground.attributes.position;
  const lake = (x, z) => z < -30 && z > -128 && Math.abs(x) < 190;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    const inField = x > fx0 - 3 && x < fx1 + 3 && z > fz0 - 3 && z < fz1 + 3;
    let h = 0;
    if (!inField && !lake(x, z)) {
      const edge = Math.min(Math.abs(x) - (fx1 + 3), z > 0 ? z - (fz1 + 3) : 1e9);
      h = (Math.sin(x * 0.05) * Math.cos(z * 0.043) * 0.5 + 0.5) * 9 + Math.sin(x * 0.13 + z * 0.07) * 1.5;
      h *= Math.min(1, Math.max(0, edge) / 25 + (z < -128 ? 0.2 : 0));
      if (z < -128) h *= 0.25;   // the far shore under the plant stays low
    }
    gp.setY(i, Math.max(0, h) - 0.03);
  }
  ground.computeVertexNormals();
  group.add(new THREE.Mesh(ground, snowMat));

  // the frozen water
  const iceTex = (() => {
    const [c, g] = T.makeCanvas(512, 512), rr = R(3);
    g.fillStyle = '#4c6276'; g.fillRect(0, 0, 512, 512);
    const n = T.noiseCanvas(512, 5, 4); g.globalAlpha = 0.25; g.drawImage(n, 0, 0); g.globalAlpha = 1;
    for (let i = 0; i < 60; i++) {
      let x = rr() * 512, y = rr() * 512; g.strokeStyle = `rgba(210,230,245,${0.2 + rr() * 0.3})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rr() - 0.5) * 70; y += (rr() - 0.5) * 70; g.lineTo(x, y); } g.stroke();
    }
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(220,230,240,${0.15 + rr() * 0.4})`; g.beginPath(); g.ellipse(rr() * 512, rr() * 512, 10 + rr() * 50, 4 + rr() * 16, rr() * 3, 0, 7); g.fill(); }
    const t = T.toTexture(c); t.repeat.set(14, 5); return t;
  })();
  const ice = new THREE.Mesh(new THREE.PlaneGeometry(380, 98).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: iceTex, roughness: 0.6, metalness: 0.1, emissive: new THREE.Color('#0e1622') }));
  ice.position.set(0, 0.01, -79);
  group.add(ice);

  // --- snowbanks along the open edges (where the invisible wall is)
  const bank = new THREE.SphereGeometry(1, 14, 8);
  for (const zEdge of [fz0 - 0.6, fz1 + 0.6]) {
    for (let x = fx0 - 1; x <= fx1 + 1; x += 2.6) {
      const m = new THREE.Mesh(bank, snowCap);
      m.position.set(x + (r() - 0.5) * 1.2, -0.2, zEdge + (zEdge < 0 ? -1 : 1) * r() * 0.8);
      m.scale.set(2.2 + r() * 1.2, 1.1 + r() * 0.7, 1.6 + r() * 0.6);
      group.add(m);
    }
  }
  // --- rocks and drifts along the cliffs, snow on their tops
  const boulder = (x, y, z, s) => {
    const geo = new THREE.DodecahedronGeometry(1, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 0.75 + r() * 0.5; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, rockMat);
    m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.set(r() * 3, r() * 3, r() * 3);
    group.add(m);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), snowCap);
    cap.position.set(x, y + s * 0.45, z); cap.scale.set(s * 0.95, s * 0.4, s * 0.95);
    group.add(cap);
  };
  for (const xs of [fx0, fx1]) {
    const dir = xs < 0 ? -1 : 1;
    for (let z = fz0 - 2; z <= fz1 + 2; z += 3 + r() * 2) {
      boulder(xs + dir * (0.3 + r() * 0.6), 0.3, z, 0.8 + r() * 1.1);           // at the foot of the cliff
      boulder(xs + dir * (1 + r() * 2), 7 + r() * 0.5, z + r(), 1.2 + r() * 1.6); // on top, breaking up the edge
    }
    // the cliff tops roll back into snowy hills
    const top = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, fz1 - fz0 + 8), snowCap);
    top.position.set(xs + dir * 7.3, 7.0, (fz0 + fz1) / 2); group.add(top);
  }

  // --- pine forest all round (not on the ice, not in the field)
  const trunk = new THREE.CylinderGeometry(0.15, 0.25, 2, 6);
  const needles = new THREE.ConeGeometry(1, 2.2, 8);
  const pineMat = new THREE.MeshStandardMaterial({ color: '#1e3326', roughness: 1, emissive: new THREE.Color('#05080a') });
  const barkMat = new THREE.MeshStandardMaterial({ color: '#2c2118', roughness: 1 });
  const spots = [];
  for (let i = 0; i < 520 && spots.length < 260; i++) {
    const a = r() * Math.PI * 2, d = 32 + r() * 150;
    const x = Math.cos(a) * d * 1.3, z = Math.sin(a) * d + 4;
    if (lake(x, z) || (z < -120 && Math.abs(x) < 70)) continue;
    if (x > fx0 - 2 && x < fx1 + 2 && z > fz0 - 2 && z < fz1 + 2) continue;
    spots.push([x, z, 0.8 + r() * 1.3]);
  }
  const tiers = 3;
  const tIm = new THREE.InstancedMesh(trunk, barkMat, spots.length);
  const nIm = new THREE.InstancedMesh(needles, pineMat, spots.length * tiers);
  const cIm = new THREE.InstancedMesh(needles, snowCap, spots.length * tiers);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  spots.forEach(([x, z, s], i) => {
    const base = Math.max(0, groundHeight(gp, x, z));
    m4.compose(ps.set(x, base + s, z), q.identity(), sc.set(s, s, s)); tIm.setMatrixAt(i, m4);
    for (let k = 0; k < tiers; k++) {
      const w = (1.6 - k * 0.4) * s, y = base + s * (1.8 + k * 1.3);
      m4.compose(ps.set(x, y, z), q.identity(), sc.set(w, s * 1.1, w)); nIm.setMatrixAt(i * tiers + k, m4);
      m4.compose(ps.set(x, y + 0.25 * s, z), q.identity(), sc.set(w * 0.82, s * 0.7, w * 0.82)); cIm.setMatrixAt(i * tiers + k, m4);
    }
  });
  group.add(tIm, nIm, cIm);

  // --- the plant across the water: four stacks and their boiler houses
  const plant = new THREE.Group();
  const stackHeads = [];
  map.stacks.forEach((s, i) => {
    const tex = stackTexture(11 + i);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.32 });
    const st = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 3.3, s.h, 32, 1, true), mat);
    st.position.set(s.x, s.h / 2, s.z);
    plant.add(st);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.1, 1.2, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#2a201c', roughness: 0.9, emissive: new THREE.Color('#120c0a') }));
    lip.position.set(s.x, s.h - 0.4, s.z); plant.add(lip);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(2.1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#050403' }));
    hole.position.set(s.x, s.h - 0.2, s.z); plant.add(hole);
    // a blinking red aviation light on top
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,90,70,1)', 'rgba(255,30,20,0)'), color: new THREE.Color(3, 0.4, 0.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    lamp.scale.setScalar(3.2); lamp.position.set(s.x, s.h + 0.8, s.z); plant.add(lamp);
    stackHeads.push({ lamp, phase: i * 0.37 });
    // the boiler house beside it, with lit windows
    const bt = buildingTexture(31 + i);
    const bmat = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.95, emissive: new THREE.Color('#ffd9b0'), emissiveMap: bt, emissiveIntensity: 0.12 });
    const bh = 30 + (i % 2) * 3;
    const b = new THREE.Mesh(new THREE.BoxGeometry(15, bh, 16), bmat);
    b.position.set(s.x + 10.5, bh / 2, s.z - 5); plant.add(b);
    // the lower grey works in front (precipitators, ducting)
    const low = new THREE.Mesh(new THREE.BoxGeometry(17, 9, 9), new THREE.MeshStandardMaterial({ color: '#6a6c6e', roughness: 0.9, emissive: new THREE.Color('#1a1c20') }));
    low.position.set(s.x + 6, 4.5, s.z + 9); plant.add(low);
    const duct = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 12), low.material);
    duct.position.set(s.x + 2.5, 11, s.z + 4); duct.rotation.x = -0.35; plant.add(duct);
    // windows: a few warm rectangles
    const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 0.6), fog: true });
    for (let k = 0; k < 9; k++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), win);
      w.position.set(s.x + 10.5 - 6 + (k % 3) * 6, 6 + Math.floor(k / 3) * 9 + r() * 2, s.z - 5 + 8.02); plant.add(w);
    }
  });
  // the long quay along the water, and some tanks
  const quay = new THREE.Mesh(new THREE.BoxGeometry(120, 2.2, 10), new THREE.MeshStandardMaterial({ color: '#58595a', roughness: 1, emissive: new THREE.Color('#14161a') }));
  quay.position.set(0, 1.1, -128); plant.add(quay);
  for (const [x, z, rad] of [[-48, -140, 4], [-55, -146, 3], [52, -132, 4.5], [60, -139, 3.5]]) {
    const tk = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, rad * 1.6, 24), new THREE.MeshStandardMaterial({ color: '#8a8c8a', roughness: 0.9, emissive: new THREE.Color('#1c1e22') }));
    tk.position.set(x, rad * 0.8, z); plant.add(tk);
  }
  // floodlights washing up the stacks
  for (const s of map.stacks) {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('rgba(255,230,190,0.9)', 'rgba(255,200,140,0)'), color: new THREE.Color(1.2, 1.0, 0.8), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(14, 10, 1); glow.position.set(s.x, 4, s.z + 3); plant.add(glow);
  }
  group.add(plant);
  out.stackHeads = stackHeads;
  // (far mountains behind the plant and round the sides, for the skyline)
  const mtnMat = new THREE.MeshStandardMaterial({ color: '#5f6c80', roughness: 1, flatShading: true, emissive: new THREE.Color('#121826') });
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (i - 7.5) * 0.36 + (r() - 0.5) * 0.15, d = 196;
    const h = 22 + r() * 30, w = 40 + r() * 30;
    // a ragged ridge, not a pyramid
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
    group.add(m);
  }

  // --- the field's props (collision comes from the map data)
  for (const b of mv.world.propBoxes) {
    const p = b.prop;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, w = b.maxX - b.minX, d = b.maxZ - b.minZ, h = b.maxY - b.minY;
    switch (p.kind) {
      case 'truck': group.add(truck(cx, cz, w, d, p.yaw || 0, snowCap)); break;
      case 'crate': {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), crateMat());
        m.position.set(cx, b.minY + h / 2, cz); m.rotation.y = 0.05; group.add(m);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.06, d * 0.96), snowCap);
        cap.position.set(cx, b.maxY + 0.03, cz); group.add(cap);
        break;
      }
      case 'barrel': out.fire = fireBarrel(mv, group, cx, cz, h); break;
      case 'rock': boulder(cx, 0.4, cz, Math.max(w, d) * 0.62); break;
      case 'pine': {
        const s = 1.9;
        const t = new THREE.Mesh(trunk, barkMat); t.position.set(cx, s, cz); t.scale.setScalar(s); group.add(t);
        for (let k = 0; k < 4; k++) {
          const ww = (1.8 - k * 0.38) * s, y = s * (1.6 + k * 1.15);
          const n = new THREE.Mesh(needles, pineMat); n.position.set(cx, y, cz); n.scale.set(ww, s * 1.1, ww); group.add(n);
          const c = new THREE.Mesh(needles, snowCap); c.position.set(cx, y + 0.3 * s, cz); c.scale.set(ww * 0.8, s * 0.65, ww * 0.8); group.add(c);
        }
        break;
      }
      case 'sign': {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.4, 0.16), barkMat);
        post.position.set(cx, 1.2, cz); group.add(post);
        const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.08), [barkMat, barkMat, barkMat, barkMat, new THREE.MeshStandardMaterial({ map: signTexture(p.text || ['THE STACKS', '']), roughness: 0.9 }), barkMat]);
        board.position.set(cx, 1.85, cz + 0.12); board.rotation.y = 0.08; group.add(board);
        break;
      }
      default: break;
    }
  }

  // --- snow falling, all the time, in a box round the camera
  const N = 3200, box = { x: 46, y: 22, z: 46 };
  const pos = new Float32Array(N * 3), drift = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (r() - 0.5) * box.x; pos[i * 3 + 1] = r() * box.y; pos[i * 3 + 2] = (r() - 0.5) * box.z; drift[i] = r() * 6.28; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flakes = new THREE.Points(sg, new THREE.PointsMaterial({ map: T.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: new THREE.Color(0.95, 0.97, 1.0), size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false }));
  flakes.frustumCulled = false;
  group.add(flakes);
  out.snow = { flakes, pos, drift, box, origin: new THREE.Vector3(), count: N };
  // Settings › Effects: fewer flakes on the lower levels
  out.setDetail = (f) => { out.snow.count = Math.max(200, Math.round(N * f)); sg.setDrawRange(0, out.snow.count); };

  out.update = (dt, eye, time) => updateCrust(out, dt, eye, time);
  return out;
}

function groundHeight(gp, x, z) {
  // nearest vertex of the 440 m, 88-segment ground grid
  const seg = 88, size = 440, step = size / seg;
  const ix = Math.round((x + size / 2) / step), iz = Math.round((z + size / 2) / step);
  if (ix < 0 || iz < 0 || ix > seg || iz > seg) return 0;
  return gp.getY(iz * (seg + 1) + ix);
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
  // drifted up against one side
  const drift = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), snowCap); drift.scale.set(L * 0.55, 0.6, 0.9); drift.position.set(0, 0, W / 2 + 0.3); g.add(drift);
  g.position.set(cx, 0, cz); g.rotation.set(0, yaw, 0.04);
  return g;
}

// A rusty drum with a fire going in it: warm light and sparks.
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

function updateCrust(W, dt, eye, time) {
  if (!eye) return;
  W.sky.position.copy(eye);
  // the snow box rides along with the camera; flakes wrap round inside it
  const S = W.snow, p = S.pos, b = S.box;
  // first frame: scatter them round wherever the camera is
  if (!S.placed) { for (let i = 0; i < p.length; i += 3) { p[i] += eye.x; p[i + 2] += eye.z; } S.placed = true; }
  const end = S.count * 3;
  for (let i = 0; i < end; i += 3) {
    const k = i / 3;
    p[i + 1] -= dt * (1.1 + (k % 7) * 0.12);
    p[i] += dt * (0.6 + Math.sin(time * 0.7 + S.drift[k]) * 0.5);
    p[i + 2] += dt * Math.cos(time * 0.5 + S.drift[k]) * 0.3;
    // keep each flake inside the box round the eye
    const lx = p[i] - eye.x, lz = p[i + 2] - eye.z;
    if (lx > b.x / 2) p[i] -= b.x; else if (lx < -b.x / 2) p[i] += b.x;
    if (lz > b.z / 2) p[i + 2] -= b.z; else if (lz < -b.z / 2) p[i + 2] += b.z;
    if (p[i + 1] < 0) p[i + 1] += b.y;
  }
  S.flakes.geometry.attributes.position.needsUpdate = true;
  // aviation lights blink; the barrel fire dances
  for (const h of W.stackHeads) h.lamp.material.opacity = (Math.sin((time + h.phase) * Math.PI) > 0.2 ? 1 : 0.15);
  const F = W.fire;
  if (F) {
    F.flames.forEach((s, i) => {
      const t = time * (3 + i * 0.7) + i * 1.7;
      s.position.set(F.cx + Math.sin(t) * 0.08, F.h + 0.15 + ((time * 0.9 + i * 0.21) % 1) * 0.55, F.cz + Math.cos(t * 1.3) * 0.08);
      const life = 1 - ((time * 0.9 + i * 0.21) % 1);
      s.scale.setScalar(0.55 * life + 0.15);
      s.material.opacity = life;
    });
    F.light.level = 0.8 + Math.sin(time * 13) * 0.1 + Math.sin(time * 7.3) * 0.1;
  }
}
