// =============================================================================
// Call of the Crust: the power (src/sim/crustPower.js), drawn.
//   - beside each of the Anvil's launchers, its junction box on a post: door
//     hanging open, the relay in its clips (charred and spitting sparks while
//     it's blown, gone while someone has it, bright copper humming blue once
//     Pit's fixed it), a lamp on top (red, then green)
//   - the relays Pit's been given, lined up on his bench
//   - each island's power switch: a breaker panel on two legs, by its pad
//   - the Anvil's launcher pads, dark until the power's on
// Owned by ForgeView (it calls update / onEvent / setSim).
// =============================================================================
import * as THREE from 'three';
import * as TX from './textures.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const yawOf = (n) => Math.atan2(n.x, n.z);

function dangerSign() {
  const [c, g] = TX.makeCanvas(256, 96);
  g.fillStyle = '#d4a514'; g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#111'; g.font = '900 30px Impact, sans-serif'; g.textAlign = 'center';
  g.fillText('DANGER', 128, 38); g.font = '700 20px "Trebuchet MS", sans-serif'; g.fillText('HIGH VOLTAGE', 128, 72);
  return new THREE.MeshStandardMaterial({ map: TX.toTexture(c, { repeat: false }), roughness: 0.8 });
}

export class CrustPowerView {
  constructor(group, sim, cfg, map, effects) {
    this.group = group; this.sim = sim; this.cfg = cfg; this.map = map; this.effects = effects;
    this.time = 0;
    this.mats = {
      steel: new THREE.MeshStandardMaterial({ color: '#5a5e62', roughness: 0.5, metalness: 0.7 }),
      dark: new THREE.MeshStandardMaterial({ color: '#1a1b1c', roughness: 0.6, metalness: 0.5 }),
      paint: new THREE.MeshStandardMaterial({ color: '#4a5a4a', roughness: 0.65, metalness: 0.4 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#b8b6b0', roughness: 0.2, metalness: 0.9 }),
      ceramic: new THREE.MeshStandardMaterial({ color: '#e8e2d4', roughness: 0.35 }),
      copper: new THREE.MeshStandardMaterial({ color: '#c8743a', roughness: 0.3, metalness: 0.9, emissive: new THREE.Color('#5ab8ff'), emissiveIntensity: 0 }),
      char: new THREE.MeshStandardMaterial({ color: '#1c1612', roughness: 0.95 }),
      sign: dangerSign(),
    };
    this.glowTex = TX.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.boxes = (sim.mapData.relays || []).map((r) => this.buildBox(r));
    this.switches = (sim.mapData.powerSwitches || []).map((s) => this.buildSwitch(s));
    this.pads = null;   // (the Anvil's pads, found once the world's built)
  }

  setSim(sim) { this.sim = sim; for (const s of this.switches) s.t = 0; }

  P() { return this.sim && this.sim.crustEgg && this.sim.crustEgg.power; }

  // a relay: a ceramic barrel wound with copper, brass caps at each end
  relayMesh(burnt) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 14), burnt ? this.mats.char : this.mats.ceramic);
    g.add(body);
    const coil = burnt ? this.mats.char : this.mats.copper;
    for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.063, 0.011, 5, 14).rotateX(Math.PI / 2), coil); t.position.y = -0.07 + i * 0.035; g.add(t); }
    for (const y of [-0.11, 0.11]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), burnt ? this.mats.char : this.mats.chrome); cap.position.y = y; g.add(cap); }
    g.rotation.z = Math.PI / 2;   // lying across its clips
    return g;
  }

  // --- a junction box beside one of the Anvil's launchers -----------------------
  buildBox(r) {
    const g = new THREE.Group();
    g.position.set(r.x, r.y, r.z); g.rotation.y = yawOf(r.normal);
    this.group.add(g);
    const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    add(new THREE.CylinderGeometry(0.06, 0.08, 1.0, 8), this.mats.steel, 0, 0.5, -0.1);           // the post
    add(new THREE.BoxGeometry(0.34, 0.06, 0.34), this.mats.steel, 0, 0.03, -0.1);                 // its foot
    // the cabinet: a back, sides, top and bottom (the front's the open door)
    const W = 0.66, H = 0.82, D = 0.32, Y = 1.0 + H / 2;
    add(new THREE.BoxGeometry(W, H, 0.03), this.mats.paint, 0, Y, -D / 2);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.03, H, D), this.mats.paint, s * W / 2, Y, 0);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(W, 0.03, D), this.mats.paint, 0, Y + s * H / 2, 0);
    add(new THREE.BoxGeometry(W - 0.06, H - 0.06, 0.01), this.mats.dark, 0, Y, -D / 2 + 0.02);   // the inside, dark
    // the door, swung open on its left hinge, the sign on it
    const hinge = new THREE.Group(); hinge.position.set(-W / 2, Y, D / 2); hinge.rotation.y = -1.9; g.add(hinge);
    add(new THREE.BoxGeometry(W, H, 0.025), this.mats.paint, W / 2, 0, 0, hinge);
    const sign = add(new THREE.PlaneGeometry(0.46, 0.17), this.mats.sign, W / 2, 0.18, 0.014, hinge); sign.castShadow = false;
    // the relay's clips, and the relay in them
    for (const x of [-0.13, 0.13]) add(new THREE.BoxGeometry(0.03, 0.09, 0.05), this.mats.chrome, x, Y + 0.02, -0.04);
    const burnt = this.relayMesh(true); burnt.position.set(0, Y + 0.08, -0.04); g.add(burnt);
    const fixed = this.relayMesh(false); fixed.position.copy(burnt.position); fixed.visible = false; g.add(fixed);
    // the meters and cables under it
    add(new THREE.BoxGeometry(0.16, 0.12, 0.05), this.mats.dark, -0.17, Y - 0.24, -0.11);
    add(new THREE.BoxGeometry(0.16, 0.12, 0.05), this.mats.dark, 0.17, Y - 0.24, -0.11);
    add(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), this.mats.dark, 0.18, 0.5, -0.1);
    // the lamp on top
    const lamp = add(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.1, 0.1) }), 0, Y + H / 2 + 0.07, 0);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(1, 0.2, 0.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    halo.scale.setScalar(0.7); halo.position.copy(lamp.position); g.add(halo);
    // the relay's glow (sparks while it's blown, a blue hum once it's fixed)
    const at = V(0, Y + 0.08, 0.05).applyAxisAngle(V(0, 1, 0), g.rotation.y).add(g.position);
    const light = this.map.addVirtualLight({ x: at.x, y: at.y + 0.3, z: at.z }, 0x7fc8ff, 4, 5, 1.6); light.live = true; light.level = 0;
    return { r, g, burnt, fixed, lamp, halo, light, at, sparkT: Math.random() * 2 };
  }

  // --- an island's power switch: a breaker panel on two legs -------------------
  buildSwitch(s) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z); g.rotation.y = yawOf(s.normal);
    this.group.add(g);
    const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    for (const x of [-0.36, 0.36]) add(new THREE.BoxGeometry(0.08, 1.7, 0.08), this.mats.steel, x, 0.85, -0.14);
    add(new THREE.BoxGeometry(0.9, 1.1, 0.2), this.mats.paint, 0, 1.2, -0.04);
    const sign = add(new THREE.PlaneGeometry(0.62, 0.23), this.mats.sign, 0, 1.6, 0.065); sign.castShadow = false;
    // the lever
    const pivot = new THREE.Group(); pivot.position.set(0, 1.1, 0.08); g.add(pivot);
    add(new THREE.BoxGeometry(0.06, 0.5, 0.06), this.mats.chrome, 0, 0.24, 0, pivot);
    add(new THREE.SphereGeometry(0.065, 10, 8), new THREE.MeshStandardMaterial({ color: '#8a1410', roughness: 0.4 }), 0, 0.5, 0, pivot);
    add(new THREE.BoxGeometry(0.2, 0.1, 0.08), this.mats.dark, 0, 0, -0.02);
    const bulbs = [];
    for (const [x, col] of [[-0.28, [3, 0.2, 0.1]], [0.28, [0.2, 3, 0.4]]]) bulbs.push({ b: add(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.1, 0.1) }), x, 0.8, 0.07), col });
    // the cable off into the ground
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), this.mats.dark, 0.3, 0.35, -0.14);
    return { s, g, pivot, bulbs, t: 0 };
  }

  // --- each frame ---------------------------------------------------------------
  update(dt) {
    this.time += dt;
    const P = this.P(), t = this.time;
    if (!P) return;
    const hub = !!P.on.hub;
    for (const B of this.boxes) {
      const st = P.relays[B.r.id] ? P.relays[B.r.id].state : 'fixed';
      B.burnt.visible = st === 'blown';
      B.fixed.visible = st === 'fixed';
      // the lamp: red and blinking with the launcher dead; green once it's live
      const blink = Math.sin(t * 5 + B.r.x) > 0;
      const col = hub ? [0.2, 3, 0.4] : blink ? [3, 0.2, 0.1] : [0.25, 0.04, 0.03];
      B.lamp.material.color.setRGB(...col);
      B.halo.material.color.setRGB(col[0] / 3, col[1] / 3, col[2] / 3);
      B.halo.material.opacity = hub ? 0.6 : blink ? 0.7 : 0;
      // a fixed relay hums blue
      if (st === 'fixed') { this.mats.copper.emissiveIntensity = 0.5 + Math.sin(t * 9) * 0.15; B.light.level = 0.45 + Math.sin(t * 9 + B.r.z) * 0.08; }
      else if (st === 'blown') {
        // a blown one spits sparks now and then
        B.sparkT -= dt;
        B.light.level = Math.max(0, B.light.level - dt * 8);
        if (B.sparkT <= 0) {
          B.sparkT = 0.6 + Math.random() * 2.2;
          B.light.level = 1;
          const n = 6 + Math.floor(Math.random() * 8);
          for (let i = 0; i < n; i++) this.effects.spawnParticle(B.at, V((Math.random() - 0.5) * 2.4, 0.4 + Math.random() * 2, (Math.random() - 0.5) * 2.4), { life: 0.25 + Math.random() * 0.35, size: 0.01, color: i % 2 ? [3, 3.4, 4] : [4, 2.6, 0.8], gravity: 9, drag: 0.6 });
          if (Math.random() < 0.5) this.effects.puff(B.at.clone().add(V(0, 0.1, 0)), { color: 0x2a2a2a, size: 0.15, grow: 1.4, life: 1.2, alpha: 0.35, vel: V(0, 0.4, 0) });
        }
      } else B.light.level = 0;
    }
    // the switches: the lever throws, the bulbs go red to green
    for (const S of this.switches) {
      const on = !!P.on[S.s.island];
      S.t = on ? Math.min(1, S.t + dt * 2.5) : 0;
      S.pivot.rotation.x = 0.5 + S.t * 2.1;
      S.bulbs[0].b.material.color.setRGB(...(on ? [0.15, 0.05, 0.05] : S.bulbs[0].col.map((c) => c * (0.6 + 0.4 * Math.sin(t * 4)))));
      S.bulbs[1].b.material.color.setRGB(...(on ? S.bulbs[1].col : [0.05, 0.12, 0.06]));
    }
    this.updatePads(hub);
  }

  // the Anvil's launcher pads: dark (a faint flicker) until the power's on
  updatePads(hub) {
    const crust = this.map && this.map.crust;
    if (!this.pads && crust && crust.pads) this.pads = crust.pads.filter((p) => (this.sim.mapData.relays || []).some((r) => r.pad === p.id));
    if (!this.pads) return;
    for (const p of this.pads) {
      const k = hub ? 1 : (Math.random() < 0.04 ? 0.35 : 0.06);
      p.k = (p.k ?? k) + (k - (p.k ?? k)) * (hub ? 0.05 : 1);
      p.ring.material.color.copy(p.color).multiplyScalar(p.k);
      p.arrow.material.color.copy(p.color).multiplyScalar(p.k);
      p.inner.material.opacity = 0.25 * p.k;
      if (p.light) p.light.level = p.k;
    }
  }

  // the relays Pit's got, lined up on his bench (ForgeView passes where)
  benchRelays(at, P, F) {
    if (!this.onBench) {
      this.onBench = [];
      for (let i = 0; i < 4; i++) { const m = this.relayMesh(true); m.position.copy(at).add(V(-0.3 + i * 0.2, -0.24, 0.32)); m.rotation.set(0, Math.PI / 2, Math.PI / 2); this.group.add(m); this.onBench.push(m); }
    }
    const given = P ? Object.values(P.relays).filter((r) => r.state === 'given').length : 0;
    const working = !!(F && F.work && F.work.kind === 'power');
    this.onBench.forEach((m, i) => {
      m.visible = i < given;
      // (the one he's working on jumps a little with each blow)
      m.position.y = at.y - 0.24 + (working && given && i === Math.floor(F.work.t / 2) % given ? Math.abs(Math.sin(F.work.t * 3.7)) * 0.02 : 0);
    });
  }

  onEvent(e) {
    const fx = this.effects;
    if (e.type === 'relayPulled' && e.pos) {
      for (let i = 0; i < 18; i++) fx.spawnParticle(e.pos, V((Math.random() - 0.5) * 3, 0.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3), { life: 0.3 + Math.random() * 0.4, size: 0.012, color: [3, 3.4, 4], gravity: 9, drag: 0.6 });
    } else if (e.type === 'islandPower' && e.pos) {
      fx.energyBurst({ x: e.pos.x, y: (e.pos.y || 0) + 1.2, z: e.pos.z }, '#ffd23a', 2.2);
      if (e.island === 'hub') for (const B of this.boxes) fx.energyBurst(B.at, '#7fc8ff', 1.2);
    }
  }
}
