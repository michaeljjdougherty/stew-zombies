// =============================================================================
// Call of the Crust: Pit at his forge, and everything the War Hammers do.
//   - Pit behind his bench by the Anvil: idling, or hammering at whatever's on
//     the bench (a hammer coming up red-hot, then its element's colour)
//   - the bench: a stone-and-oak table, a little anvil on it, a coal brazier
//   - the cores lying where the titans fell (a glow and a beam of light to
//     find them by)
//   - the War Hammers standing in the Anvil's sockets
//   - what a swing does: the element going off, frozen zombies in ice,
//     lightning jumping between them
// Reads sim.crustEgg (forge, cores); see src/sim/forge.js and hammers.js.
// =============================================================================
import * as THREE from 'three';
import * as TX from './textures.js';
import { buildCharacter, idleCharacter } from './characters.js';
import { buildWarHammer, HAMMER_COLORS } from './warHammer.js';
import { CORE_ELEMENT } from '../sim/forge.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ELS = ['wind', 'lightning', 'ice', 'fire'];
const sm = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

export class ForgeView {
  constructor(scene, sim, cfg, map, effects) {
    this.scene = scene; this.sim = sim; this.cfg = cfg; this.map = map; this.effects = effects;
    this.spec = sim.mapData.forge;
    this.group = new THREE.Group(); this.group.name = 'forge';
    scene.add(this.group);
    this.glowTex = TX.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.arcs = [];
    this.buildBench();
    this.buildPit();
    this.buildSockets();
    this.cores = new Map();
    this.ice = [];
    this.iceGeo = new THREE.CapsuleGeometry(0.42, 1.0, 4, 10);
    this.iceMat = new THREE.MeshStandardMaterial({ color: '#bfefff', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.45, emissive: new THREE.Color('#4aa8d8'), emissiveIntensity: 0.35, depthWrite: false });
    this.time = 0;
  }

  setSim(sim) {
    this.sim = sim;
    for (const c of this.cores.values()) this.group.remove(c.g);
    this.cores.clear();
    for (const a of this.arcs) this.group.remove(a.line);
    this.arcs = [];
  }

  F() { return this.sim && this.sim.crustEgg && this.sim.crustEgg.forge; }

  // --- the bench --------------------------------------------------------------
  buildBench() {
    const s = this.spec, [x0, z0, x1, z1] = s.bench, y = s.y;
    const g = new THREE.Group(); g.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); this.group.add(g);
    const w = x1 - x0, d = z1 - z0;
    const oak = new THREE.MeshStandardMaterial({ color: '#6a4a30', roughness: 0.85 });
    const stone = new THREE.MeshStandardMaterial({ color: '#5a5450', roughness: 0.95 });
    const iron = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.45, metalness: 0.85 });
    const add = (geo, mat, px, py, pz, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    add(new THREE.BoxGeometry(w, 0.12, d), oak, 0, 0.89, 0);                                  // top
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.22, 0.83, 0.22), stone, sx * (w / 2 - 0.15), 0.415, sz * (d / 2 - 0.15));
    add(new THREE.BoxGeometry(w - 0.3, 0.06, d - 0.3), oak, 0, 0.3, 0);                       // shelf
    // a little anvil to work on
    const an = new THREE.Group(); an.position.set(0, 0.95, -0.25); g.add(an);
    add(new THREE.BoxGeometry(0.22, 0.12, 0.3), iron, 0, 0.06, 0, an);
    add(new THREE.BoxGeometry(0.1, 0.1, 0.18), iron, 0, 0.17, 0, an);
    add(new THREE.BoxGeometry(0.28, 0.08, 0.38), iron, 0, 0.26, 0, an);
    const horn = add(new THREE.ConeGeometry(0.05, 0.2, 10), iron, 0, 0.26, -0.28, an); horn.rotation.x = -Math.PI / 2;
    this.workAt = V(g.position.x, y + 0.95 + 0.32, g.position.z - 0.25);
    // the coal brazier at the far end, glowing
    const br = add(new THREE.CylinderGeometry(0.19, 0.14, 0.16, 12), iron, 0, 1.03, d / 2 - 0.3);
    const coals = new THREE.Mesh(new THREE.CircleGeometry(0.17, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.7, 0.15), toneMapped: false }));
    coals.position.set(0, 1.115, d / 2 - 0.3); g.add(coals);
    this.coals = coals; void br;
    const hal = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(1.8, 0.6, 0.15), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
    hal.scale.setScalar(1.0); hal.position.set(0, 1.2, d / 2 - 0.3); g.add(hal);
    this.coalHalo = hal;
    this.coalAt = V(g.position.x, y + 1.15, g.position.z + d / 2 - 0.3);
    // tongs and a spare hammer lying on the top
    const tongs = add(new THREE.BoxGeometry(0.03, 0.02, 0.5), iron, 0.35, 0.96, 0.4); tongs.rotation.y = 0.3;
    // the forge's light
    this.light = this.map.addVirtualLight({ x: this.coalAt.x + 0.6, y: this.coalAt.y + 0.8, z: this.coalAt.z }, 0xff7a30, 9, 9, 1.6);
    this.light.live = true;
    // the hammer on the bench while he works on it (one per element, shown as needed)
    this.onBench = {};
    for (const el of ELS) {
      const H = buildWarHammer(el, { halo: true, glow: 1 });
      H.group.rotation.set(0, Math.PI / 2, 0);   // lying across the little anvil
      H.group.position.copy(this.workAt).add(V(-0.45, 0.02, 0));
      H.group.visible = false;
      this.group.add(H.group);
      this.onBench[el] = H;
    }
  }

  // --- Pit --------------------------------------------------------------------
  buildPit() {
    const s = this.spec.pit;
    const k = buildCharacter('pit', { detail: 0.85 });
    k.root.position.set(s.x, s.y, s.z);
    k.root.rotation.y = s.yaw + Math.PI;
    this.group.add(k.root);
    this.pit = k;
    // his smith's hammer
    const iron = new THREE.MeshStandardMaterial({ color: '#3a3a40', roughness: 0.4, metalness: 0.85 });
    const wood = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.8 });
    const h = new THREE.Group();
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.36, 8), wood); haft.position.y = -0.1; h.add(haft);
    const hd = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.14), iron); hd.position.y = -0.27; h.add(hd);
    h.rotation.x = Math.PI / 2;
    k.armR.wrist.add(h);
    h.position.set(0, -0.08, 0.02);
    this.smithHammer = h;
  }

  animatePit(t, F) {
    const k = this.pit;
    idleCharacter(k, t);
    const work = F && F.work;
    const blend = this.workBlend = (this.workBlend || 0) + ((work ? 1 : 0) - (this.workBlend || 0)) * 0.08;
    if (blend < 0.01) return;
    // hammering: the arm goes up, comes down on the beat
    const every = this.cfg.crust.forge.strikeEvery;
    const ph = work ? (work.t % every) / every : 0.9;
    const up = ph < 0.62 ? sm(0, 0.62, ph) : 1 - sm(0.62, 0.74, ph);
    const a = k.armR;
    a.shoulder.rotation.set(-(0.8 + up * 1.7) * blend + a.shoulder.rotation.x * (1 - blend), 0.2 * blend, 0.15 * blend);
    a.elbow.rotation.x = -(0.25 + up * 1.2) * blend + a.elbow.rotation.x * (1 - blend);
    // the left hand holds the work steady on the anvil
    const l = k.armL;
    l.shoulder.rotation.set(-0.9 * blend + l.shoulder.rotation.x * (1 - blend), -0.2 * blend, -0.1 * blend);
    l.elbow.rotation.x = -0.9 * blend + l.elbow.rotation.x * (1 - blend);
    k.torso.rotation.x += 0.18 * blend;
    k.head.rotation.x += 0.25 * blend;
  }

  // --- the Anvil's sockets ------------------------------------------------------
  buildSockets() {
    this.sockets = {};
    for (const el of ELS) {
      const s = this.spec.sockets[el];
      const H = buildWarHammer(el, { halo: true, glow: 2.6 });
      H.group.rotation.x = -Math.PI / 2;   // standing up, head high
      H.group.scale.setScalar(1.9);
      H.group.position.set(s.x, s.y + 0.1, s.z);
      H.group.visible = false;
      this.group.add(H.group);
      const light = this.map.addVirtualLight({ x: s.x * 1.3, y: s.y + 1.4, z: s.z * 1.3 }, new THREE.Color(HAMMER_COLORS[el]).getHex(), 10, 9, 1.6);
      light.live = true; light.level = 0;
      this.sockets[el] = { H, light, tempered: false };
    }
  }

  // --- each frame ---------------------------------------------------------------
  update(dt, time) {
    this.time += dt;
    const E = this.sim && this.sim.crustEgg, F = E && E.forge;
    this.animatePit(this.time, F);
    // the coals breathe; brighter while he works
    const work = F && F.work;
    const heat = 0.75 + Math.sin(this.time * 3.1) * 0.12 + Math.sin(this.time * 7.3) * 0.06 + (work ? 0.35 : 0);
    this.coalHalo.material.opacity = 0.45 * heat;
    this.light.intensity = 8 * heat;
    // what's on the bench
    for (const el of ELS) {
      const H = this.onBench[el], on = !!work && work.element === el;
      H.group.visible = on;
      if (!on) continue;
      const total = work.kind === 'forge' ? this.cfg.crust.forge.forgeTime : this.cfg.crust.forge.temperTime;
      const k = Math.min(1, work.t / total);
      // red-hot iron cooling into the element's own glow
      const hot = new THREE.Color(2.6, 0.7, 0.15), done = new THREE.Color(HAMMER_COLORS[el]).multiplyScalar(2.2);
      H.glowMat.color.copy(hot).lerp(done, sm(0.55, 1, k));
      H.group.scale.setScalar(work.kind === 'forge' ? 0.4 + 0.6 * sm(0, 0.6, k) : 1);
      if (H.halo) H.halo.material.opacity = 0.4 + 0.5 * k;
    }
    // the sockets
    for (const el of ELS) {
      const S = this.sockets[el], h = F && F.hammers[el];
      const show = !!(h && h.forged && !h.by);
      S.H.group.visible = show;
      S.light.level = show ? 1 : 0;
      if (show) {
        S.H.head.rotation.y = Math.sin(this.time * 0.8 + el.length) * 0.08;
        if (S.H.halo) S.H.halo.material.opacity = 0.65 + Math.sin(this.time * 2.2 + el.length) * 0.15;
        if (h.tempered !== S.tempered) { S.tempered = h.tempered; S.H.temper(h.tempered ? this.cfg.weapons[{ wind: 'Wind Hammer', lightning: 'Lightning Hammer', ice: 'Ice Hammer', fire: 'Fire Hammer' }[el] + '+'].view.camo : null); }
        if (Math.random() < dt * 3) { const p = S.H.head.getWorldPosition(V()); this.effects.spawnParticle(p, V((Math.random() - 0.5) * 0.6, 0.6 + Math.random(), (Math.random() - 0.5) * 0.6), { life: 0.8, size: 0.02, color: S.H.color.toArray().map((c) => c * 3), gravity: -0.5, drag: 0.6 }); }
      }
    }
    this.updateCores(dt, E);
    this.updateIce(E);
    this.updateArcs(dt);
  }

  // the cores lying about (and a beam of light up from each, to find them by)
  updateCores(dt, E) {
    const seen = new Set();
    if (E) for (const [id, k] of Object.entries(E.cores)) {
      if (!k || typeof k !== 'object' || k.state !== 'dropped') continue;
      seen.add(id);
      let c = this.cores.get(id);
      if (!c) c = this.makeCore(id, k.element || CORE_ELEMENT[id]);
      c.g.position.set(k.x, k.y, k.z);
      c.gem.position.y = 0.9 + Math.sin(this.time * 2) * 0.12;
      c.gem.rotation.y += dt * 1.6;
      c.halo.position.y = c.gem.position.y;
    }
    for (const [id, c] of this.cores) if (!seen.has(id)) { this.group.remove(c.g); this.map.removeVirtualLight(c.light); this.cores.delete(id); }
  }
  makeCore(id, el) {
    const col = new THREE.Color(HAMMER_COLORS[el]);
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.4), toneMapped: false }));
    g.add(gem);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
    halo.scale.setScalar(1.8); g.add(halo);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.8), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = 20; g.add(beam);
    this.group.add(g);
    const light = this.map.addVirtualLight({ x: 0, y: 0, z: 0 }, col.getHex(), 8, 8, 1.6); light.live = true;
    const c = { g, gem, halo, light };
    this.cores.set(id, c);
    return c;
  }

  // frozen zombies sit in a shell of ice
  updateIce(E) {
    const zs = this.sim ? this.sim.zombies.filter((z) => z.frozen > 0 && z.state !== 'dead') : [];
    while (this.ice.length < zs.length) { const m = new THREE.Mesh(this.iceGeo, this.iceMat); m.renderOrder = 3; this.group.add(m); this.ice.push(m); }
    this.ice.forEach((m, i) => {
      const z = zs[i];
      m.visible = !!z;
      if (!z) return;
      const s = (z.scale || 1) * (z.crawler ? 0.6 : 1);
      m.position.set(z.pos.x, z.pos.y + (z.crawler ? 0.35 : 0.92) * s, z.pos.z);
      m.scale.set(s, s * (z.crawler ? 0.5 : 1), s);
    });
    void E;
    // (each core's light follows it)
    for (const c of this.cores.values()) c.light.pos.set(c.g.position.x, c.g.position.y + 1, c.g.position.z);
  }

  // lightning jumping between them
  arc(points, color) {
    const pts = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = V(points[i].x, points[i].y, points[i].z), b = V(points[i + 1].x, points[i + 1].y, points[i + 1].z);
      const n = 8;
      for (let k = 0; k <= n; k++) {
        const p = a.clone().lerp(b, k / n);
        if (k > 0 && k < n) p.add(V((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5));
        pts.push(p);
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.frustumCulled = false;
    this.group.add(line);
    this.arcs.push({ line, life: 0.35 });
  }
  updateArcs(dt) {
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.life -= dt;
      a.line.material.opacity = Math.max(0, a.life / 0.35);
      if (a.life <= 0) { this.group.remove(a.line); a.line.geometry.dispose(); a.line.material.dispose(); this.arcs.splice(i, 1); }
    }
  }

  // --- events -------------------------------------------------------------------
  onEvent(e, R) {
    const fx = this.effects;
    switch (e.type) {
      case 'forgeStrike': {
        const p = this.workAt;
        const col = new THREE.Color(HAMMER_COLORS[e.element]).multiplyScalar(3).toArray();
        for (let i = 0; i < 14; i++) fx.spawnParticle(p, V((Math.random() - 0.5) * 3, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 3), { life: 0.3 + Math.random() * 0.4, size: 0.012, color: i % 3 ? [4, 2.2, 0.6] : col, gravity: 9, drag: 0.8 });
        break;
      }
      case 'hammerForged': case 'hammerTempered': {
        const s = this.spec.sockets[e.element];
        if (s) { fx.energyBurst({ x: s.x, y: s.y + 1, z: s.z }, HAMMER_COLORS[e.element], 2.2); R.shake(0.3, s, 20); }
        break;
      }
      case 'corePicked': case 'coreGiven': {
        const p = e.type === 'coreGiven' ? this.workAt : null;
        if (p) fx.energyBurst(p, HAMMER_COLORS[e.element], 1.4);
        break;
      }
      case 'titanCore': fx.energyBurst({ x: e.pos.x, y: e.pos.y + 1, z: e.pos.z }, HAMMER_COLORS[e.element], 3); break;
      case 'hammerSlam': {
        const p = V(e.pos.x, e.pos.y + 0.1, e.pos.z), col = HAMMER_COLORS[e.element];
        // the head hitting the ground
        for (let i = 0; i < 6; i++) fx.puff(p.clone().add(V((Math.random() - 0.5) * 1.2, 0.1, (Math.random() - 0.5) * 1.2)), { color: 0x8a8070, size: 0.5, grow: 2.2, life: 0.9, alpha: 0.4, vel: V((Math.random() - 0.5) * 2, 0.6, (Math.random() - 0.5) * 2) });
        fx.energyBurst(p, col, e.upgraded ? 2.6 : 1.8);
        if (e.element === 'fire') fx.explosion(p, e.upgraded ? 5 : 3.6);
        R.shake(e.playerId === R.localId ? 0.55 : 0.25, e.pos, 18);
        break;
      }
      case 'hammerFreeze': {
        const p = V(e.pos.x, e.pos.y + 0.2, e.pos.z);
        fx.energyBurst(p, HAMMER_COLORS.ice, e.radius * 0.6);
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, r = e.radius * (0.4 + Math.random() * 0.6);
          fx.puff(p.clone().add(V(Math.cos(a) * r, 0.2 + Math.random() * 0.8, Math.sin(a) * r)), { color: 0xdff4ff, size: 0.9, grow: 2.4, life: 1.6, alpha: 0.6, vel: V(0, 0.3, 0), shade: false });
        }
        break;
      }
      case 'zombieShatter': {
        const p = V(e.pos.x, e.pos.y + 1, e.pos.z);
        for (let i = 0; i < 26; i++) fx.spawnParticle(p, V((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6), { life: 0.6 + Math.random() * 0.5, size: 0.025, color: [1.6, 2.2, 2.8], gravity: 12, drag: 0.4 });
        break;
      }
      case 'hammerChain': {
        if (e.points.length > 1) { this.arc(e.points, HAMMER_COLORS.lightning); this.arc(e.points, '#ffffff'); }
        const last = e.points[e.points.length - 1];
        fx.lightning(e.points[0]);
        if (last) fx.energyBurst(last, HAMMER_COLORS.lightning, 1.2);
        break;
      }
    }
  }
}
