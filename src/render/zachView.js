// =============================================================================
// The finale's Big Evil Zach (src/sim/zachBoss.js): The Schnitz's Zach, huge,
// coming down out of the sky into the Anvil's pit; walking, stomping,
// swiping, calling his dead up, glowing the colour of the hammer he's open
// to, dropping to his knees and shrinking as the grip loosens. At the end
// The Schnitz tears out of him (a green shape rising and gone) and plain Zach
// is left kneeling in the pit, then up on his feet.
// The model: src/render/evilZach.js (and Zach's own from characters.js).
// =============================================================================
import * as THREE from 'three';
import * as TX from './textures.js';
import { buildEvilZach } from './evilZach.js';
import { buildCharacter, idleCharacter } from './characters.js';
import { HAMMER_COLORS } from './warHammer.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sm = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const lerp = (a, b, t) => a + (b - a) * t;

export class ZachView {
  constructor(scene, sim, cfg, map, effects) {
    this.scene = scene; this.sim = sim; this.cfg = cfg; this.map = map; this.effects = effects;
    this.group = new THREE.Group(); this.group.name = 'zach';
    scene.add(this.group);
    this.Z = null; this.plain = null;
    this.glowTex = TX.softDotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    // telegraphs: a ring round him (stomp), a sector in front (swipe)
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.25, 0.15), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }));
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.15, 0.1), transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }));
    this.ring.visible = this.fill.visible = false;
    this.group.add(this.ring, this.fill);
    this.sector = null;
    this.spirit = null;
    this.t = 0;
  }

  setSim(sim) {
    this.sim = sim;
    if (this.Z) this.Z.root.visible = false;
    if (this.plain) this.plain.root.visible = false;
    if (this.spirit) this.spirit.visible = false;
    this.ring.visible = this.fill.visible = false;
    if (this.sector) this.sector.visible = false;
  }

  F() { return this.sim && this.sim.crustEgg && this.sim.crustEgg.finale; }

  build() {
    if (this.Z) return;
    this.Z = buildEvilZach({ detail: 0.85 });
    this.group.add(this.Z.root);
    this.Z.root.visible = false;
    this.light = this.map.addVirtualLight({ x: 0, y: -50, z: 0 }, 0x50ff70, 22, 16, 1.4);
    this.light.live = true; this.light.noDim = true; this.light.level = 0;
    this.plain = buildCharacter('zach', { detail: 0.85 });
    this.plain.root.visible = false;
    this.group.add(this.plain.root);
    this.elColor = new THREE.Color();
  }

  update(dt, time) {
    const F = this.F();
    const on = F && F.state && F.state !== 'off';
    if (!on) { if (this.Z) { this.Z.root.visible = false; this.light.level = 0; } if (this.plain) this.plain.root.visible = false; this.ring.visible = this.fill.visible = false; if (this.sector) this.sector.visible = false; return; }
    this.build();
    this.t += dt;
    const c = this.cfg.crust.finale, Z = this.Z, k = Z;
    const freed = F.state === 'freed' || F.state === 'done';
    // --- plain Zach, once The Schnitz has let go
    if (freed) {
      Z.root.visible = this.ring.visible = this.fill.visible = false;
      if (this.sector) this.sector.visible = false;
      this.light.level = Math.max(0, this.light.level - dt);
      const P = this.plain;
      P.root.visible = true;
      P.root.position.set(F.pos.x, F.pos.y, F.pos.z);
      P.root.rotation.y = F.yaw;
      idleCharacter(P, time);
      // kneeling, then up
      const up = sm(5.5, 7.5, F.t);
      P.hips.position.y = lerp(0.5, 0.95, up);
      P.legL.hip.rotation.x = lerp(-1.4, 0, up); P.legL.knee.rotation.x = lerp(1.5, 0.05, up);
      P.legR.hip.rotation.x = lerp(0.25, 0, up); P.legR.knee.rotation.x = lerp(1.9, 0.05, up);
      P.torso.rotation.x += (1 - up) * 0.35;
      this.updateSpirit(dt);
      return;
    }
    // --- Big Evil Zach
    Z.root.visible = true;
    const scale = this.shown = lerp(this.shown || F.scale, F.scale, Math.min(1, dt * 1.5));
    Z.root.scale.setScalar(scale);
    let y = F.pos.y;
    if (F.state === 'descend') {
      const fall = sm(0, 1, F.t / c.descendTime);
      y += 70 * Math.pow(1 - fall, 2);
    }
    Z.root.position.set(F.pos.x, y, F.pos.z);
    Z.root.rotation.y = F.yaw;
    Z.update(dt, time);
    // the hammer he's open to: his aura and his light turn its colour
    const el = c.order[Math.min(3, F.phase)];
    this.elColor.set(HAMMER_COLORS[el]);
    Z.aura.material.color.copy(this.elColor).multiplyScalar(1.4);
    Z.aura.material.opacity = 0.28 + Math.sin(time * 3) * 0.08 + (this.flinch > 0 ? 0.4 : 0);
    this.light.color.copy(this.elColor).lerp(new THREE.Color(0x50ff70), 0.35);
    this.light.level = 1;
    this.light.pos.set(F.pos.x, F.pos.y + 1.78 * scale * 0.8, F.pos.z);
    // --- his body
    const walk = F.walking && F.state === 'fight' && !F.act;
    this.stride = (this.stride || 0) + dt * (walk ? 3.2 / Math.max(1, scale * 0.5) : 0);
    const s = Math.sin(this.stride), amp = walk ? 0.45 : 0;
    k.legL.hip.rotation.x = -s * amp; k.legR.hip.rotation.x = s * amp;
    k.legL.knee.rotation.x = Math.max(0, s) * amp * 1.4 + 0.05; k.legR.knee.rotation.x = Math.max(0, -s) * amp * 1.4 + 0.05;
    k.hips.position.y = 0.95 - Math.abs(s) * 0.03 * (walk ? 1 : 0);
    k.armL.shoulder.rotation.set(-0.25 + s * amp * 0.6, 0, 0.12); k.armR.shoulder.rotation.set(-0.25 - s * amp * 0.6, 0, -0.12);
    k.armL.elbow.rotation.x = -0.45; k.armR.elbow.rotation.x = -0.45;
    k.torso.rotation.x = 0.2;
    // footfalls shake the ground
    if (walk && Math.sign(s) !== this.lastSign) { this.lastSign = Math.sign(s); this.effects.puff(V(F.pos.x, F.pos.y + 0.2, F.pos.z), { color: 0x6a6258, size: 0.8 * scale / 3, grow: 2.2, life: 1.0, alpha: 0.35 }); }
    // attacks
    const a = F.act;
    this.ring.visible = this.fill.visible = false;
    if (this.sector) this.sector.visible = false;
    if (a && F.state === 'fight') {
      const w = Math.min(1, a.t / a.warn), hit = a.t >= a.warn ? sm(a.warn, a.warn + 0.15, a.t) * (1 - sm(a.warn + 0.3, a.warn + 0.7, a.t)) : 0;
      if (a.kind === 'stomp') {
        k.legR.hip.rotation.x = lerp(-1.3 * sm(0, 0.8, w), 0, hit); k.legR.knee.rotation.x = lerp(1.3 * sm(0, 0.8, w), 0.05, hit);
        k.armL.shoulder.rotation.x = -1.1 * w; k.armR.shoulder.rotation.x = -1.1 * w;
        if (a.t < a.warn) this.telegraph(F, c.stomp.radius, w);
      } else if (a.kind === 'swipe') {
        k.armR.shoulder.rotation.set(lerp(-2.4 * w, -1.2, hit), 0, lerp(-0.9 * w, 0.8, hit));
        k.torso.rotation.y = lerp(-0.5 * w, 0.6, hit);
        if (a.t < a.warn) this.telegraphSector(F, a.yaw, c.swipe.range, c.swipe.angle, w);
      } else {
        k.armL.shoulder.rotation.set(-2.8 * w, 0, 0.4 * w); k.armR.shoulder.rotation.set(-2.8 * w, 0, -0.4 * w);
        k.head.rotation.x = -0.5 * w;
      }
    } else k.torso.rotation.y = 0;
    // kneeling while the grip loosens
    if (F.state === 'kneel') {
      const kn = sm(0, 0.6, F.t) * (1 - sm(c.kneelTime - 0.8, c.kneelTime, F.t));
      k.hips.position.y = lerp(0.95, 0.5, kn);
      k.legL.hip.rotation.x = lerp(0, -1.4, kn); k.legL.knee.rotation.x = lerp(0.05, 1.5, kn);
      k.legR.hip.rotation.x = lerp(0, 0.25, kn); k.legR.knee.rotation.x = lerp(0.05, 1.9, kn);
      k.torso.rotation.x = lerp(0.2, 0.7, kn);
      k.armL.shoulder.rotation.set(-0.2, 0, 0.3 * kn); k.armR.shoulder.rotation.set(-0.2, 0, -0.3 * kn);
      if (Math.random() < dt * 10) this.effects.spawnParticle(V(F.pos.x, F.pos.y + 1.78 * scale * 0.6, F.pos.z), V((Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2), { life: 1.2, size: 0.05, color: [0.4, 3, 0.6], gravity: -1, drag: 0.4 });
    }
    // a right hit: he reels
    if (this.flinch > 0) { this.flinch -= dt; k.torso.rotation.x -= Math.sin(this.flinch * 12) * 0.12; k.head.rotation.x -= 0.2 * this.flinch; }
  }

  telegraph(F, r, w) {
    this.ring.visible = this.fill.visible = true;
    this.ring.position.set(F.pos.x, F.pos.y + 0.06, F.pos.z); this.ring.scale.setScalar(r);
    this.fill.position.set(F.pos.x, F.pos.y + 0.05, F.pos.z); this.fill.scale.setScalar(r * w);
    this.ring.material.opacity = 0.5 + Math.sin(this.t * 20) * 0.2;
  }
  telegraphSector(F, yaw, r, ang, w) {
    if (!this.sector) {
      const geo = new THREE.CircleGeometry(1, 32, -1, 2).rotateX(-Math.PI / 2);
      this.sector = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.2, 0.1), transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      this.group.add(this.sector);
    }
    const S = this.sector;
    const a = ang * Math.PI / 180;
    if (S.userData.ang !== a) { S.geometry.dispose(); S.geometry = new THREE.CircleGeometry(1, 32, -Math.PI / 2 - a, a * 2).rotateX(-Math.PI / 2); S.userData.ang = a; }
    S.visible = true;
    S.position.set(F.pos.x, F.pos.y + 0.07, F.pos.z);
    S.rotation.y = yaw;
    S.scale.setScalar(r * (0.3 + 0.7 * w));
    S.material.opacity = 0.25 + Math.sin(this.t * 20) * 0.12;
  }

  // The Schnitz leaving him: a green shape rising out of the pit and gone
  updateSpirit(dt) {
    if (!this.spirit) return;
    const s = this.spirit;
    s.userData.t += dt;
    const t = s.userData.t;
    s.position.y = s.userData.y0 + t * 4;
    s.material.opacity = Math.max(0, 0.9 * (1 - t / 4));
    s.scale.set(3 + t, 6 + t * 2, 1);
    s.visible = t < 4;
  }

  onEvent(e, R) {
    const fx = this.effects, F = this.F();
    switch (e.type) {
      case 'zachDescend': R.flash = Math.max(R.flash || 0, 0.4); break;
      case 'zachLand': {
        const p = V(e.pos.x, e.pos.y + 0.2, e.pos.z);
        for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; fx.puff(p.clone().add(V(Math.cos(a) * 2, 0, Math.sin(a) * 2)), { color: 0x7a7066, size: 1.6, grow: 3, life: 2, alpha: 0.5, vel: V(Math.cos(a) * 5, 0.6, Math.sin(a) * 5) }); }
        fx.energyBurst(p, '#50ff70', 5);
        R.shake(1.6, e.pos, 60);
        break;
      }
      case 'zachStomp': {
        const p = V(e.pos.x, e.pos.y + 0.15, e.pos.z);
        for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; fx.puff(p.clone().add(V(Math.cos(a) * e.radius * 0.5, 0, Math.sin(a) * e.radius * 0.5)), { color: 0x6a6258, size: 1.1, grow: 2.6, life: 1.4, alpha: 0.45, vel: V(Math.cos(a) * 7, 0.4, Math.sin(a) * 7) }); }
        R.shake(1.1, e.pos, 40);
        break;
      }
      case 'zachSwipe': R.shake(0.5, e.pos, 25); break;
      case 'zachHit': {
        this.flinch = 0.6;
        fx.energyBurst(e.pos ? { x: e.pos.x, y: e.pos.y + 2, z: e.pos.z } : F.pos, HAMMER_COLORS[e.element], 3);
        R.shake(0.6, e.pos, 30);
        break;
      }
      case 'zachShrug': {
        const p = V(e.pos.x, e.pos.y + 1.5, e.pos.z);
        for (let i = 0; i < 16; i++) fx.spawnParticle(p, V((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5), { life: 0.4, size: 0.02, color: [0.4, 3, 0.6], gravity: 8, drag: 0.6 });
        break;
      }
      case 'zachKneel': if (F) { fx.energyBurst({ x: F.pos.x, y: F.pos.y + 3, z: F.pos.z }, HAMMER_COLORS[e.element], 6); R.shake(1.2, F.pos, 50); } break;
      case 'zachRise': R.shake(0.6, F ? F.pos : null, 40); break;
      case 'zachSummon': if (F) fx.energyBurst({ x: F.pos.x, y: F.pos.y + 4, z: F.pos.z }, '#50ff70', 4); break;
      case 'schnitzTorn': {
        const p = V(e.pos.x, e.pos.y + 3, e.pos.z);
        fx.energyBurst(p, '#50ff70', 8);
        for (let i = 0; i < 30; i++) fx.puff(p.clone().add(V((Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4)), { color: 0x1a3a1c, size: 1.4, grow: 3, life: 3, alpha: 0.6, vel: V(0, 2 + Math.random() * 2, 0), shade: false });
        if (!this.spirit) {
          this.spirit = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(0.3, 2.4, 0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
          this.group.add(this.spirit);
        }
        this.spirit.position.set(e.pos.x, e.pos.y + 4, e.pos.z);
        this.spirit.userData = { t: 0, y0: e.pos.y + 4 };
        this.spirit.visible = true;
        R.flash = Math.max(R.flash || 0, 0.8);
        R.shake(1.4, e.pos, 60);
        break;
      }
    }
  }
}
