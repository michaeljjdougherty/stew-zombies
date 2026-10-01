// =============================================================================
// Machines: perk machines, the power switch, electric traps and the Mad Dog
// Machine. Built from map data, driven by sim state and events.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';
import { BoxBatch, bx } from './geometry.js';
import { buildGun } from './gunModels.js';

const yawOf = (n) => Math.atan2(n.x, n.z);

// --- textures ----------------------------------------------------------------
function perkFrontTexture(def) {
  const W = 256, H = 448;
  const [c, g] = T.makeCanvas(W, H);
  const [ec, eg] = T.makeCanvas(W, H);
  const col = new THREE.Color(def.color);
  const dark = `rgb(${Math.round(col.r * 90)},${Math.round(col.g * 90)},${Math.round(col.b * 90)})`;
  g.fillStyle = dark; g.fillRect(0, 0, W, H);
  eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H);
  // chrome trim
  g.strokeStyle = '#b8b2a4'; g.lineWidth = 8; g.strokeRect(6, 6, W - 12, H - 12);
  // header sign
  for (const ctx of [g, eg]) {
    ctx.fillStyle = ctx === g ? '#1a1612' : '#000'; ctx.fillRect(18, 18, W - 36, 86);
    ctx.fillStyle = def.color;
    ctx.font = '900 30px Impact, "Arial Narrow Bold", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const words = def.name.toUpperCase().split(' ');
    if (words.length > 1) { ctx.fillText(words[0], W / 2, 45); ctx.fillText(words.slice(1).join(' '), W / 2, 78); }
    else ctx.fillText(words[0], W / 2, 61);
    // emblem: a soup bowl with a glyph
    ctx.lineWidth = 7; ctx.strokeStyle = def.color;
    ctx.beginPath(); ctx.arc(W / 2, 200, 62, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = ctx === g ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0)'; ctx.fill();
    ctx.fillStyle = def.color; ctx.font = '900 76px Impact, sans-serif';
    ctx.fillText(def.glyph || '?', W / 2, 205);
    // steam lines
    ctx.lineWidth = 4;
    for (const dx of [-24, 0, 24]) { ctx.beginPath(); ctx.moveTo(W / 2 + dx, 128); ctx.bezierCurveTo(W / 2 + dx + 10, 118, W / 2 + dx - 10, 110, W / 2 + dx, 98); ctx.stroke(); }
  }
  g.fillStyle = '#d8cfb8'; g.font = '700 15px "Trebuchet MS", sans-serif'; g.textAlign = 'center';
  g.fillText('ICE COLD · HOT STEW', W / 2, 296);
  g.fillText(def.cost + ' PTS', W / 2, 318);
  // dispenser slot
  g.fillStyle = '#060606'; g.fillRect(70, 360, 116, 54);
  g.strokeStyle = '#8a857a'; g.lineWidth = 4; g.strokeRect(70, 360, 116, 54);
  // rust and grime
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(${40 + Math.random() * 40},${20 + Math.random() * 20},10,${Math.random() * 0.35})`; g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 10, 2 + Math.random() * 6); }
  return { map: T.toTexture(c, { repeat: false }), glow: T.toTexture(ec, { repeat: false }) };
}

function hazardTexture() {
  const [c, g] = T.makeCanvas(128, 32);
  g.fillStyle = '#d4a514'; g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#111';
  for (let x = -32; x < 160; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32); g.fill(); }
  return T.toTexture(c);
}

function madDogSignTexture() {
  const [c, g] = T.makeCanvas(512, 128);
  g.fillStyle = '#120505'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#b8902a'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
  g.fillStyle = '#ff2a1a'; g.font = '900 64px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('MAD DOG', 256, 64);
  return T.toTexture(c, { repeat: false });
}

// =============================================================================
export class MachinesView {
  constructor(scene, sim, cfg, mapView) {
    this.scene = scene;
    this.sim = sim;
    this.cfg = cfg;
    this.mapView = mapView;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.time = 0;
    this.perks = [];
    this.traps = new Map();
    this.metal = new THREE.MeshStandardMaterial({ map: T.metalTexture({ color: '#3a3c3a', rust: 0.6 }), roughness: 0.6, metalness: 0.5 });
    this.darkMetal = new THREE.MeshStandardMaterial({ color: '#1c1d1c', roughness: 0.5, metalness: 0.6 });
    this.chrome = new THREE.MeshStandardMaterial({ color: '#b8b6b0', roughness: 0.2, metalness: 0.9 });
    this.hazard = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.7 });
    const W = sim.world;
    for (const m of W.perkMachines) this.buildPerk(m);
    if (W.powerSwitch) this.buildPower(W.powerSwitch);
    for (const t of sim.traps) this.buildTrap(t);
    if (W.madDog) this.buildMadDog(W.madDog);
  }

  // --- perk machines -----------------------------------------------------------
  buildPerk(m) {
    const def = this.cfg.perks.list[m.perk];
    const pm = this.cfg.perkMachine || { width: 1.3, depth: 0.9, height: 2.3 };
    const g = new THREE.Group();
    g.position.set(m.center.x, 0, m.center.z);
    g.rotation.y = yawOf(m.normal);
    this.group.add(g);
    const { map, glow } = perkFrontTexture(def);
    const front = new THREE.MeshStandardMaterial({ map, emissive: new THREE.Color(def.color), emissiveMap: glow, emissiveIntensity: 0, roughness: 0.55, metalness: 0.2 });
    const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(def.color).multiplyScalar(0.45), roughness: 0.55, metalness: 0.35 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(pm.width, pm.height, pm.depth), [body, body, this.darkMetal, body, front, body]);
    box.position.y = pm.height / 2;
    g.add(box);
    // marquee on top and a chrome kick plate
    const marquee = new THREE.Mesh(new THREE.BoxGeometry(pm.width + 0.06, 0.22, pm.depth * 0.6), [body, body, this.darkMetal, body, front, body]);
    marquee.geometry.attributes.uv.array.fill(0.5);
    marquee.position.set(0, pm.height + 0.11, -pm.depth * 0.15);
    g.add(marquee);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(pm.width + 0.04, 0.05, pm.depth + 0.04), this.chrome);
    lip.position.y = pm.height; g.add(lip);
    const kick = new THREE.Mesh(new THREE.BoxGeometry(pm.width + 0.02, 0.18, pm.depth + 0.02), this.chrome);
    kick.position.y = 0.09; g.add(kick);
    // a glowing bottle in the slot
    const bottleMat = new THREE.MeshStandardMaterial({ color: def.color, emissive: new THREE.Color(def.color), emissiveIntensity: 0, transparent: true, opacity: 0.85, roughness: 0.15 });
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.16, 10), bottleMat);
    bottle.position.set(0.05, 0.42, pm.depth / 2 - 0.05); g.add(bottle);
    const lightPos = { x: m.center.x + m.normal.x * 1.2, y: 1.6, z: m.center.z + m.normal.z * 1.2 };
    const v = this.mapView.addVirtualLight(lightPos, new THREE.Color(def.color).getHex(), 10, 6, 1.6);
    v.level = 0;
    this.perks.push({ m, def, front, bottleMat, g, v, shake: 0, level: 0, flick: 0 });
  }

  perkOn(pv) {
    if (pv.def.power && !this.sim.power) return false;
    if (pv.def.soloUses && this.sim.players.length === 1 && (this.sim.perkBuys[pv.m.perk] || 0) >= pv.def.soloUses) return false;
    return true;
  }

  // --- power switch ------------------------------------------------------------
  buildPower(sw) {
    const g = new THREE.Group();
    g.position.set(sw.pos.x, sw.pos.y, sw.pos.z);
    g.rotation.y = yawOf(sw.normal);
    this.group.add(g);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.22), this.metal);
    panel.position.set(0, 0.1, 0.11); g.add(panel);
    const [c, gg] = T.makeCanvas(256, 96);
    gg.fillStyle = '#d4a514'; gg.fillRect(0, 0, 256, 96);
    gg.fillStyle = '#111'; gg.font = '900 30px Impact, sans-serif'; gg.textAlign = 'center';
    gg.fillText('DANGER', 128, 38); gg.font = '700 20px "Trebuchet MS", sans-serif'; gg.fillText('HIGH VOLTAGE', 128, 72);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.26), new THREE.MeshStandardMaterial({ map: T.toTexture(c, { repeat: false }), roughness: 0.8 }));
    sign.position.set(0, 0.62, 0.225); g.add(sign);
    const pivot = new THREE.Group(); pivot.position.set(0, 0.05, 0.25); g.add(pivot);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.07), this.chrome); arm.position.y = 0.27; pivot.add(arm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: '#8a1410', roughness: 0.4 }));
    knob.position.y = 0.56; pivot.add(knob);
    pivot.rotation.x = 0.5;
    const bulbs = [];
    for (const [x, col] of [[-0.28, [3, 0.2, 0.1]], [0.28, [0.2, 3, 0.4]]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.1, 0.1) }));
      b.position.set(x, -0.38, 0.23); g.add(b);
      bulbs.push({ b, col });
    }
    // cables running up the wall
    for (const x of [-0.3, 0, 0.3]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 6), this.darkMetal);
      cable.position.set(x, 1.95, 0.05); g.add(cable);
    }
    this.power = { pivot, bulbs, t: this.sim.power ? 1 : 0 };
  }

  // --- electric traps ------------------------------------------------------------
  buildTrap(t) {
    const g = new THREE.Group();
    this.group.add(g);
    // lever box on the wall
    const l = t.lever;
    const lever = new THREE.Group();
    lever.position.set(l.pos.x, l.pos.y, l.pos.z); lever.rotation.y = yawOf(l.normal);
    g.add(lever);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.16), this.metal); box.position.z = 0.08; lever.add(box);
    const handle = new THREE.Group(); handle.position.set(0, 0, 0.18); lever.add(handle);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), this.chrome); h.position.y = 0.15; handle.add(h);
    handle.rotation.x = -0.5;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.1, 0.1) }));
    lamp.position.set(0, 0.36, 0.1); lever.add(lamp);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.08), this.hazard); stripe.position.set(0, -0.32, 0.165); lever.add(stripe);
    // emitters on each side of the doorway
    const [x0, z0, x1, z1] = t.box;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const ends = t.axis === 'x' ? [[x0 + 0.08, cz], [x1 - 0.08, cz]] : [[cx, z0 + 0.08], [cx, z1 - 0.08]];
    const emitters = [];
    for (const [x, z] of ends) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), this.darkMetal); post.position.set(x, 1.3, z); g.add(post);
      for (let i = 0; i < 4; i++) {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8a5a2a', metalness: 0.8, roughness: 0.3 }));
        coil.position.set(x, 0.5 + i * 0.6, z); g.add(coil);
      }
      emitters.push(new THREE.Vector3(x, 0, z));
    }
    // arcs: jagged line strips redrawn while live
    const arcMat = new THREE.LineBasicMaterial({ color: new THREE.Color(2.5, 3.2, 4.5), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const arcs = [];
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
      const line = new THREE.Line(geo, arcMat);
      line.visible = false; line.frustumCulled = false;
      g.add(line);
      arcs.push(line);
    }
    const v = this.mapView.addVirtualLight({ x: cx, y: 1.4, z: cz }, 0x88bbff, 30, 9, 1.4);
    v.level = 0;
    this.traps.set(t.id, { t, handle, lamp, emitters, arcs, v, regen: 0 });
  }

  // --- the Mad Dog Machine ---------------------------------------------------------
  buildMadDog(md) {
    const g = new THREE.Group();
    g.position.set(md.x, md.y, md.z);
    g.rotation.y = md.yaw;
    this.group.add(g);
    const M = this;
    const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    const red = new THREE.MeshStandardMaterial({ map: T.metalTexture({ color: '#5a1812', rust: 0.8 }), roughness: 0.55, metalness: 0.45 });
    // body: heavy riveted cabinet with hazard-striped base
    add(new THREE.BoxGeometry(2.6, 0.3, 2.4), M.hazard, 0, 0.15, 0);
    add(new THREE.BoxGeometry(2.4, 1.5, 2.2), M.metal, 0, 1.05, 0);
    add(new THREE.BoxGeometry(2.5, 0.12, 2.3), M.darkMetal, 0, 1.86, 0);
    for (const x of [-1.15, 1.15]) for (let y = 0.45; y < 1.8; y += 0.3) add(new THREE.SphereGeometry(0.03, 6, 4), M.chrome, x, y, 1.11);
    // feed slot with rollers
    add(new THREE.BoxGeometry(1.4, 0.36, 0.1), M.darkMetal, 0, 1.15, 1.11);
    const slot = add(new THREE.BoxGeometry(1.2, 0.2, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.0, 0.0) }), 0, 1.15, 1.13);
    const rollers = [];
    for (const y of [1.28, 1.02]) {
      const r = add(new THREE.CylinderGeometry(0.05, 0.05, 1.25, 10).rotateZ(Math.PI / 2), M.chrome, 0, y, 1.18);
      rollers.push(r);
    }
    // side gears
    const gears = [];
    for (const s of [-1, 1]) {
      const gear = new THREE.Group(); gear.position.set(s * 1.22, 1.1, 0.2); g.add(gear);
      add(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16).rotateZ(Math.PI / 2), M.darkMetal, 0, 0, 0, gear);
      for (let i = 0; i < 10; i++) {
        const tooth = add(new THREE.BoxGeometry(0.08, 0.14, 0.1), M.darkMetal, 0, 0, 0, gear);
        const a = (i / 10) * Math.PI * 2;
        tooth.position.set(0, Math.cos(a) * 0.5, Math.sin(a) * 0.5); tooth.rotation.x = a;
      }
      gears.push(gear);
    }
    // chimney
    const chimney = add(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 10), M.metal, -0.75, 2.35, -0.6);
    // the dog's head on top
    const head = new THREE.Group(); head.position.set(0, 2.2, 0.35); g.add(head);
    add(new THREE.BoxGeometry(1.15, 0.8, 0.9), red, 0, 0.35, 0, head);
    add(new THREE.BoxGeometry(0.62, 0.3, 0.6), red, 0, 0.17, 0.68, head); // snout
    add(new THREE.BoxGeometry(0.24, 0.13, 0.12), M.darkMetal, 0, 0.3, 0.99, head); // nose
    for (const s of [-1, 1]) {
      const ear = add(new THREE.ConeGeometry(0.2, 0.55, 4), red, s * 0.42, 0.95, -0.1, head);
      ear.rotation.set(-0.25, Math.PI / 4, s * 0.35);
      add(new THREE.BoxGeometry(0.34, 0.07, 0.08), M.darkMetal, s * 0.26, 0.78, 0.47, head).rotation.z = s * 0.45; // angry brow
    }
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.02, 0.02) });
    const eyes = [];
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.22, 0.16, 0.04), M.darkMetal, s * 0.26, 0.62, 0.455, head); // eye socket
      eyes.push(add(new THREE.SphereGeometry(0.085, 12, 8), eyeMat, s * 0.26, 0.62, 0.48, head));
    }
    // jaw with teeth
    const jaw = new THREE.Group(); jaw.position.set(0, 0.0, 0.4); head.add(jaw);
    add(new THREE.BoxGeometry(0.6, 0.12, 0.62), red, 0, -0.06, 0.28, jaw);
    const toothMat = new THREE.MeshStandardMaterial({ color: '#e8e0c8', roughness: 0.4 });
    for (let i = 0; i < 6; i++) {
      const t1 = add(new THREE.ConeGeometry(0.035, 0.12, 4), toothMat, -0.24 + i * 0.096, 0.04, 0.57, jaw);
      void t1;
      const t2 = add(new THREE.ConeGeometry(0.035, 0.12, 4), toothMat, -0.24 + i * 0.096, 0.03, 0.97, head);
      t2.position.y = 0.0; t2.rotation.x = Math.PI;
    }
    // collar with spikes and a nameplate
    add(new THREE.BoxGeometry(1.25, 0.14, 1.0), M.darkMetal, 0, -0.04, 0, head);
    for (let i = 0; i < 7; i++) add(new THREE.ConeGeometry(0.05, 0.16, 6), M.chrome, -0.54 + i * 0.18, -0.04, 0.55, head).rotation.x = Math.PI / 2;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.37), new THREE.MeshStandardMaterial({ map: madDogSignTexture(), emissive: 0xffffff, emissiveMap: madDogSignTexture(), emissiveIntensity: 0, roughness: 0.6 }));
    plate.position.set(0, 1.6, 1.111); g.add(plate);
    const v = this.mapView.addVirtualLight({ x: md.x + Math.sin(md.yaw) * 1.8, y: md.y + 2.4, z: md.z + Math.cos(md.yaw) * 1.8 }, 0xff3018, 22, 9, 1.5);
    v.level = 0;
    this.md = { g, head, jaw, eyes, eyeMat, gears, rollers, slot, chimney, plate, v, display: null, displayId: null, chew: 0, puff: 0, t: 0 };
  }

  // Show a gun (base or upgraded) floating in the feed slot.
  showGun(id) {
    const md = this.md;
    if (!md) return;
    if (md.display) { md.g.remove(md.display.group); md.display = null; md.displayId = null; }
    if (!id) return;
    const def = this.cfg.weapons[id];
    const gun = buildGun(def.view.model, { camo: def.view.camo || null });
    gun.group.scale.setScalar(2.2);
    gun.group.rotation.y = Math.PI / 2;
    md.g.add(gun.group);
    md.display = gun;
    md.displayId = id;
    md.displayT = 0;
  }

  onEvent(e, effects) {
    switch (e.type) {
      case 'perkBought': {
        const pv = this.perks.find((q) => q.m.id === e.machine);
        if (pv) pv.shake = 0.6;
        break;
      }
      case 'madDogStart':
        this.showGun(e.weapon);
        this.md.mode = 'in';
        break;
      case 'madDogReady':
        this.showGun(e.weapon);
        this.md.mode = 'out';
        if (effects) for (let i = 0; i < 3; i++) effects.puff(new THREE.Vector3(this.md.g.position.x, this.md.g.position.y + 1.2, this.md.g.position.z + 1.3), { color: 0x6a5a50, size: 0.5, grow: 2, life: 1.2, alpha: 0.5 });
        break;
      case 'madDogTaken':
        this.showGun(null);
        this.md.mode = null;
        break;
    }
  }

  reset(sim) {
    this.sim = sim;
    if (this.md) { this.showGun(null); this.md.mode = null; }
    if (this.power) this.power.t = sim.power ? 1 : 0;
  }

  update(dt) {
    this.time += dt;
    const t = this.time, sim = this.sim;
    // perk machines: glow when available, flicker on, shake when bought
    for (const pv of this.perks) {
      const on = this.perkOn(pv);
      const target = on ? 1 : 0;
      if (on && pv.level < 0.05 && target) pv.flick = 0.8;
      pv.level += (target - pv.level) * Math.min(1, dt * 3);
      let lv = pv.level;
      if (pv.flick > 0) { pv.flick -= dt; lv *= Math.random() < 0.5 ? 0.2 : 1; }
      pv.front.emissiveIntensity = lv * (1.3 + Math.sin(t * 2 + pv.m.center.x) * 0.15);
      pv.bottleMat.emissiveIntensity = lv * 1.2;
      pv.v.level = lv;
      if (pv.shake > 0) { pv.shake -= dt; pv.g.position.y = Math.sin(t * 60) * 0.01 * pv.shake; } else pv.g.position.y = 0;
    }
    // power switch
    if (this.power) {
      const P = this.power;
      P.t = Math.min(1, P.t + (sim.power ? dt * 2.5 : -1));
      if (!sim.power) P.t = 0;
      P.pivot.rotation.x = 0.5 + P.t * 2.1;
      P.bulbs[0].b.material.color.setRGB(...(sim.power ? [0.15, 0.05, 0.05] : P.bulbs[0].col.map((c) => c * (0.6 + 0.4 * Math.sin(t * 4)))));
      P.bulbs[1].b.material.color.setRGB(...(sim.power ? P.bulbs[1].col : [0.05, 0.12, 0.06]));
    }
    // traps
    for (const tv of this.traps.values()) {
      const st = tv.t.state;
      const live = st === 'active';
      tv.handle.rotation.x += ((live ? 0.6 : -0.5) - tv.handle.rotation.x) * Math.min(1, dt * 10);
      const lampCol = !sim.power ? [0.08, 0.08, 0.08] : st === 'idle' ? [0.2, 3, 0.4] : live ? [3, 2.2, 0.3] : [3, 0.2, 0.1];
      tv.lamp.material.color.setRGB(...lampCol);
      tv.regen -= dt;
      if (live && tv.regen <= 0) {
        tv.regen = 0.045;
        const [a, b] = tv.emitters;
        for (const line of tv.arcs) {
          line.visible = Math.random() < 0.8;
          const y0 = 0.3 + Math.random() * 2.2, y1 = 0.3 + Math.random() * 2.2;
          const arr = line.geometry.attributes.position.array;
          for (let i = 0; i < 14; i++) {
            const k = i / 13;
            const j = i === 0 || i === 13 ? 0 : 0.18;
            arr[i * 3] = a.x + (b.x - a.x) * k + (Math.random() - 0.5) * j;
            arr[i * 3 + 1] = y0 + (y1 - y0) * k + (Math.random() - 0.5) * j * 2;
            arr[i * 3 + 2] = a.z + (b.z - a.z) * k + (Math.random() - 0.5) * j;
          }
          line.geometry.attributes.position.needsUpdate = true;
        }
        tv.v.level = 0.4 + Math.random() * 0.8;
      } else if (!live) {
        for (const line of tv.arcs) line.visible = false;
        tv.v.level = 0;
      }
    }
    // Mad Dog Machine
    const md = this.md;
    if (md) {
      const powered = sim.power;
      const state = sim.madDog ? sim.madDog.state : 'idle';
      const working = state === 'working';
      const eyeGlow = powered ? (working ? 3 + Math.sin(t * 20) * 1.5 : 2.2 + Math.sin(t * 2) * 0.4) : 0.12;
      md.eyeMat.color.setRGB(eyeGlow, eyeGlow * 0.08, eyeGlow * 0.04);
      md.plate.material.emissiveIntensity = powered ? 0.9 : 0;
      md.v.level = powered ? (working ? 0.8 + Math.random() * 0.4 : 0.45) : 0;
      // jaw: idle snarl twitch, chomping while working
      const chomp = working ? Math.max(0, Math.sin(t * 9)) * 0.45 : powered ? 0.08 + Math.max(0, Math.sin(t * 0.7)) * 0.06 : 0.02;
      md.jaw.rotation.x = chomp;
      md.head.position.y = 2.2 + (working ? Math.sin(t * 18) * 0.015 : 0);
      for (const gear of md.gears) gear.rotation.x += dt * (working ? 6 : powered ? 0.4 : 0);
      for (const r of md.rollers) r.rotation.x += dt * (working ? 14 : 0);
      md.g.position.x = this.sim.world.madDog.x + (working ? (Math.random() - 0.5) * 0.012 : 0);
      // the gun: slides into the slot, or floats out of it glowing
      if (md.display) {
        md.displayT += dt;
        const gun = md.display.group;
        if (md.mode === 'in') {
          const k = Math.min(1, md.displayT / 1.0);
          gun.position.set(0, 1.15, 1.9 - k * 1.3);
          gun.visible = k < 1;
        } else {
          const k = Math.min(1, md.displayT / 1.2);
          gun.visible = true;
          gun.position.set(0, 1.15 + Math.sin(t * 2) * 0.04, 0.6 + k * 1.15);
          gun.rotation.y = Math.PI / 2 + Math.sin(t * 0.8) * 0.5;
        }
      }
    }
  }
}
