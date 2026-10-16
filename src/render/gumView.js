// =============================================================================
// The GobbleGum machines: a gumball machine on a cast-iron stand, its glass
// globe full of gumballs in every tier's colour. It churns when you buy (the
// balls tumble, the crank turns), and your gum sits in the tray at the front
// till you take it. Out of order: dark, and the globe's nearly empty.
// Driven by sim.gums.machines (src/sim/gums.js); online, that's mirrored.
// Numbers: CONFIG.gobblegum.look.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';

const yawOf = (n) => Math.atan2(n.x, n.z);

function signTexture() {
  const [c, g] = T.makeCanvas(512, 128);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#3a0d2a'); gr.addColorStop(1, '#160410');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#f0c23a'; g.lineWidth = 6; g.strokeRect(5, 5, 502, 118);
  g.font = '900 66px Impact, "Arial Narrow Bold", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#000'; g.fillText('GOBBLEGUM', 259, 68);
  const tg = g.createLinearGradient(0, 30, 0, 100);
  tg.addColorStop(0, '#ffe8f6'); tg.addColorStop(0.5, '#ff6ac8'); tg.addColorStop(1, '#b02a86');
  g.fillStyle = tg; g.fillText('GOBBLEGUM', 256, 64);
  return T.toTexture(c, { repeat: false });
}

export class GumView {
  constructor(scene, sim, cfg, mapView) {
    this.scene = scene;
    this.sim = sim;
    this.cfg = cfg;
    this.mapView = mapView;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.time = 0;
    this.list = [];
    if (!sim.gums) return;
    const L = cfg.gobblegum.look;
    this.mats = {
      iron: new THREE.MeshStandardMaterial({ map: T.metalTexture({ color: '#2a1a22', rust: 0.3 }), roughness: 0.5, metalness: 0.6 }),
      paint: new THREE.MeshStandardMaterial({ color: L.body, roughness: 0.35, metalness: 0.3 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.18, metalness: 0.95 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#e8f4ff', roughness: 0.05, metalness: 0, transmission: 0.0, transparent: true, opacity: 0.22, depthWrite: false }),
      sign: new THREE.MeshStandardMaterial({ map: signTexture(), emissive: new THREE.Color('#ffffff'), emissiveMap: null, emissiveIntensity: 0, roughness: 0.4 }),
    };
    this.mats.sign.emissiveMap = this.mats.sign.map;
    this.ballGeo = new THREE.SphereGeometry(L.ball, 10, 8);
    const tiers = cfg.gobblegum.tiers;
    this.tierMats = Object.fromEntries(Object.entries(tiers).map(([k, t]) => [k, new THREE.MeshStandardMaterial({ color: t.color, emissive: new THREE.Color(t.color), emissiveIntensity: 0.25, roughness: 0.25, metalness: 0.1 })]));
    for (const m of sim.gums.machines) this.build(m);
  }

  build(m) {
    const L = this.cfg.gobblegum.look, M = this.mats;
    const g = new THREE.Group();
    g.position.set(m.pos.x, m.pos.y || 0, m.pos.z);
    g.rotation.y = yawOf(m.normal);
    this.group.add(g);
    // the stand: a fluted iron column on a round foot
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.1, 20), M.iron); foot.position.y = 0.05; g.add(foot);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.82, 12), M.iron); col.position.y = 0.5; g.add(col);
    // the body: a painted box with the coin slot, crank and tray
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.46), M.paint); body.position.y = 1.08; g.add(body);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.5), M.chrome); trim.position.y = 1.27; g.add(trim);
    const trim2 = trim.clone(); trim2.position.y = 0.9; g.add(trim2);
    const crankG = new THREE.Group(); crankG.position.set(0, 1.1, 0.24); g.add(crankG);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16), M.chrome); hub.rotation.x = Math.PI / 2; crankG.add(hub);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.025), M.chrome); arm.position.set(0.07, 0, 0.03); crankG.add(arm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), M.paint); knob.position.set(0.15, 0, 0.05); crankG.add(knob);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.12), M.chrome); tray.position.set(0, 0.95, 0.27); g.add(tray);
    // the globe and its gumballs
    const gy = 1.3 + L.globe;
    const globe = new THREE.Mesh(new THREE.SphereGeometry(L.globe, 24, 18), M.glass); globe.position.y = gy; globe.renderOrder = 2; g.add(globe);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.1, 20), M.paint); cap.position.y = gy + L.globe - 0.02; g.add(cap);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), M.chrome); top.position.y = gy + L.globe + 0.06; g.add(top);
    const balls = new THREE.Group(); balls.position.y = gy; g.add(balls);
    const tiers = Object.keys(this.tierMats), r = L.globe - L.ball * 1.1;
    let seed = (m.pos.x * 73 + m.pos.z * 31) | 0;
    const rnd = () => { seed = (seed * 16807 + 11) % 2147483647; return (seed & 0xffff) / 0x10000; };
    for (let i = 0; i < L.balls; i++) {
      // packed in the bottom two-thirds of the globe
      const a = rnd() * Math.PI * 2, y = -r + rnd() * r * 1.25, rr = Math.sqrt(Math.max(0, r * r - y * y)) * Math.sqrt(rnd());
      const b = new THREE.Mesh(this.ballGeo, this.tierMats[tiers[i % tiers.length]]);
      b.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
      b.userData.home = b.position.clone();
      balls.add(b);
    }
    // the sign on top
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.155), M.sign); sign.position.set(0, gy + L.globe + 0.22, 0); g.add(sign);
    const back = sign.clone(); back.rotation.y = Math.PI; g.add(back);
    // the gum you bought, in the tray
    const offer = new THREE.Mesh(new THREE.SphereGeometry(L.ball * 1.5, 14, 10), this.tierMats.classic);
    offer.position.set(0, 1.0, 0.27); offer.visible = false; g.add(offer);
    const lp = { x: m.pos.x + m.normal.x * 0.9, y: (m.pos.y || 0) + 1.7, z: m.pos.z + m.normal.z * 0.9 };
    const v = this.mapView.addVirtualLight(lp, new THREE.Color(L.light).getHex(), L.lightI, 5, 1.6);
    this.list.push({ m, g, balls, crankG, offer, v, level: 1, spin: 0 });
  }

  onEvent(e, effects) {
    if (e.type === 'gumTaken' || e.type === 'gumDispensed') {
      const gv = this.list.find((q) => q.m.id === e.machine);
      if (gv && effects) effects.puff(new THREE.Vector3(gv.g.position.x, gv.g.position.y + 1.6, gv.g.position.z), { color: 0xff8ad8, size: 0.25, grow: 2, life: 0.6, alpha: 0.4 });
    }
  }

  // a new game on the same map: the same machines, the new game's state
  reset(sim) {
    this.sim = sim;
    for (const gv of this.list) { const m = sim.gums && sim.gums.machines.find((q) => q.id === gv.m.id); if (m) gv.m = m; }
  }

  update(dt) {
    this.time += dt;
    const t = this.time, G = this.cfg.gobblegum;
    for (const gv of this.list) {
      const m = gv.m;
      const away = m.state === 'away', churn = m.state === 'dispensing';
      gv.level += ((away ? 0.08 : 1) - gv.level) * Math.min(1, dt * 3);
      gv.v.level = gv.level * (churn ? 1.3 + Math.sin(t * 30) * 0.3 : 1);
      this.mats.sign.emissiveIntensity = 0.9;
      // the balls: still, or tumbling while it churns; most gone while it's away
      gv.balls.children.forEach((b, i) => {
        const h = b.userData.home;
        b.visible = !away || i % 6 === 0;
        if (churn) b.position.set(h.x + Math.sin(t * 17 + i) * 0.03, h.y + Math.abs(Math.sin(t * 13 + i * 1.7)) * 0.06, h.z + Math.cos(t * 15 + i) * 0.03);
        else b.position.copy(h);
      });
      if (churn) gv.crankG.rotation.z -= dt * 6;
      // your gum in the tray (its tier's colour), bobbing
      const offer = m.state === 'offering' && m.gum && G.gums[m.gum];
      gv.offer.visible = !!offer;
      if (offer) {
        gv.offer.material = this.tierMats[G.gums[m.gum].tier] || this.tierMats.classic;
        gv.offer.position.y = 1.0 + Math.sin(t * 4) * 0.01;
        gv.offer.rotation.y += dt * 2;
      }
    }
  }
}
