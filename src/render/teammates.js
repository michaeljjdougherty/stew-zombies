// =============================================================================
// Teammates (online): the other players, drawn as their crew character
// holding their current gun. Simple procedural animation on the character rig:
// walking and sprinting strides, crouching, aiming up and down with the view,
// lowering the gun to reload or sprint, and sitting on the floor when downed.
// A name tag floats over each of them (through walls, so you can find them),
// and turns red while they need a revive.
// =============================================================================
import * as THREE from 'three';
import { buildCharacter } from './characters.js';
import { idleCharacter } from './characterAnim.js';
import { buildGun } from './gunModels.js';
import { HAND_POSES } from './hands.js';

const lerp = (a, b, k) => a + (b - a) * k;
function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
const approach = (v, t, rate, dt) => v + (t - v) * Math.min(1, rate * dt);

function tagTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '600 30px system-ui, -apple-system, Segoe UI, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.strokeText(text, 128, 34);
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Teammate {
  constructor(scene, p, cfg) {
    this.cfg = cfg;
    this.id = p.id;
    this.character = p.character;
    this.k = buildCharacter(p.character, { detail: 0.6 });
    this.root = this.k.root;
    scene.add(this.root);
    this.handHome = [this.k.armL, this.k.armR].map((a) => a.handGroup.quaternion.clone());
    this.gunId = null;
    this.gun = null;
    this.stride = 0;
    this.speed = 0;
    this.crouch = 0;
    this.down = 0;
    this.raise = 1.35;
    this.lastPos = null;
    this.tagMat = new THREE.SpriteMaterial({ depthTest: false, depthWrite: false, transparent: true, fog: false });
    this.tag = new THREE.Sprite(this.tagMat);
    this.tag.renderOrder = 999;
    scene.add(this.tag);
    this.tagKey = '';
    this.muzzlePos = new THREE.Vector3();
  }

  setGun(id) {
    if (id === this.gunId) return;
    this.gunId = id;
    if (this.gun) { this.gun.group.parent.remove(this.gun.group); }
    const def = this.cfg.weapons[id];
    this.gun = buildGun(def && def.view ? def.view.model : 'pistol', { camo: def && def.view ? def.view.camo || null : null });
    const g = this.gun.group;
    g.scale.setScalar(1.35);
    g.position.set(0, -0.1, 0.02);
    g.rotation.set(-Math.PI / 2, 0, 0);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.k.armR.wrist.add(g);
  }

  setTag(p) {
    const downed = !!p.downed;
    const key = p.name + '|' + downed;
    if (key === this.tagKey) return;
    this.tagKey = key;
    if (this.tagMat.map) this.tagMat.map.dispose();
    this.tagMat.map = tagTexture(downed ? `${p.name} · down!` : p.name, downed ? '#ff5a40' : '#f2ead8');
    this.tagMat.needsUpdate = true;
  }

  update(p, pos, yaw, pitch, dt, time, camera) {
    const k = this.k;
    this.root.visible = p.alive;
    this.tag.visible = p.alive;
    if (!p.alive) return;
    const w = p.loadout;
    this.setGun(w.slots[w.current].id);
    this.setTag(p);

    // speed from how far they moved (smoothed)
    if (this.lastPos && dt > 0) {
      const d = Math.hypot(pos.x - this.lastPos.x, pos.z - this.lastPos.z) / dt;
      this.speed = approach(this.speed, Math.min(9, d), 10, dt);
    }
    this.lastPos = { x: pos.x, z: pos.z };
    const downed = !!p.downed;
    this.crouch = approach(this.crouch, p.crouching && !downed ? 1 : 0, 10, dt);
    this.down = approach(this.down, downed ? 1 : 0, 6, dt);
    const sprint = p.sprinting && !downed;
    const busy = w.reloading || !!p.drinking || !!p.throwing || (p.melee && p.melee.timer > 0);
    // how high the gun is held: level when aiming, angled down to sprint or reload
    this.raise = approach(this.raise ?? 1.35, sprint ? 0.7 : busy ? 1.05 : 1.35, 8, dt);

    this.root.position.set(pos.x, pos.y, pos.z);
    this.root.rotation.set(0, yaw + Math.PI, 0);

    // breathing, blinking, the face (then the body is posed over it; no
    // gestures, their hands are full)
    if (k.anim) k.anim.gStart = Infinity;
    idleCharacter(k, time);
    [k.armL, k.armR].forEach((a, i) => { a.handGroup.quaternion.copy(this.handHome[i]); a.wrist.rotation.set(0, 0, 0); if (a.hand && a.hand.set) a.hand.set(HAND_POSES.fist); });

    // --- legs: a stride cycle that follows how fast they're going
    const moving = Math.min(1, this.speed / 1.5);
    this.stride += dt * (2.2 + this.speed * 1.25) * (moving > 0.05 ? 1 : 0);
    const amp = (sprint ? 0.75 : 0.42) * moving;
    const s = Math.sin(this.stride);
    const legs = [[k.legL, s], [k.legR, -s]];
    for (const [L, ph] of legs) {
      L.hip.rotation.x = -ph * amp;
      L.knee.rotation.x = Math.max(0, ph) * amp * 1.5 + 0.05;
      L.ankle.rotation.x = 0;
    }
    k.hips.position.y = 0.95 - Math.abs(s) * 0.03 * moving;
    k.hips.rotation.x = 0;
    k.torso.rotation.x = sprint ? 0.18 : 0.04 * moving;

    // --- crouching
    const c = this.crouch;
    if (c > 0.001) {
      k.hips.position.y -= 0.33 * c;
      for (const [L] of legs) { L.hip.rotation.x = lerp(L.hip.rotation.x, -1.15, c); L.knee.rotation.x = lerp(L.knee.rotation.x, 1.75, c); L.ankle.rotation.x = lerp(0, -0.55, c); }
      k.torso.rotation.x += 0.22 * c;
    }

    // --- downed: sitting back on the floor, legs out, pistol up
    const dn = this.down;
    if (dn > 0.001) {
      k.hips.position.y = lerp(k.hips.position.y, 0.2, dn);
      k.hips.rotation.x = lerp(k.hips.rotation.x, -0.35, dn);
      for (const [L, ph] of legs) {
        L.hip.rotation.x = lerp(L.hip.rotation.x, -1.25 + ph * 0.12 * moving, dn);
        L.knee.rotation.x = lerp(L.knee.rotation.x, 0.25, dn);
      }
      k.torso.rotation.x = lerp(k.torso.rotation.x, -0.25, dn);
    }

    // --- arms: holding the gun up where they're looking
    const pt = Math.max(-1.1, Math.min(1.1, pitch)) * (sprint ? 0.2 : 1);
    const lean = k.torso.rotation.x + k.hips.rotation.x;   // (the arms hang off the torso: undo its lean)
    for (const a of [k.armR, k.armL]) {
      const left = a === k.armL;
      a.shoulder.rotation.x = -this.raise - pt - lean + (left ? 0.08 : 0);
      a.shoulder.rotation.z = a.side * (left ? -0.32 : -0.05);
      a.shoulder.rotation.y = left ? -0.35 : 0.05;
      a.elbow.rotation.set(left ? -0.55 : -0.2, 0, 0);
    }
    // reloading: the gun dips and tilts
    if (w.reloading) { k.armR.elbow.rotation.x -= 0.25 + Math.sin(time * 9) * 0.05; k.armR.wrist.rotation.z = 0.6; }
    else k.armR.wrist.rotation.z = 0;
    // knife: a quick jab with the left arm
    if (p.melee && p.melee.timer > 0) { const m = Math.sin(Math.min(1, p.melee.timer / 0.5) * Math.PI); k.armL.shoulder.rotation.x = -1.5 * m; k.armL.elbow.rotation.x = -0.1; }

    // look up and down with the head too
    k.head.rotation.x = -pt * 0.45;

    // name tag over their head, about the same size on screen at any distance
    const headY = pos.y + (1.95 - 0.35 * c - 1.1 * dn) * (k.def.height || 1);
    this.tag.position.set(pos.x, headY + 0.28, pos.z);
    const dist = camera.position.distanceTo(this.tag.position);
    const sc = Math.max(0.45, Math.min(2.8, dist * 0.055));
    this.tag.scale.set(sc * 2, sc * 0.5, 1);
    this.tagMat.opacity = downed ? 1 : Math.max(0.35, Math.min(0.95, 1.2 - dist / 40));
  }

  muzzle() {
    if (!this.gun || !this.root.visible) return null;
    this.root.updateMatrixWorld(true);
    return this.gun.muzzle.getWorldPosition(this.muzzlePos);
  }

  dispose(scene) {
    scene.remove(this.root);
    scene.remove(this.tag);
    if (this.tagMat.map) this.tagMat.map.dispose();
    this.tagMat.dispose();
  }
}

export class TeammateViews {
  constructor(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    this.views = new Map();
    this.prev = new Map();
  }

  beginStep(sim, localId) {
    for (const p of sim.players) if (p.id !== localId) this.prev.set(p.id, { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch });
  }

  update(sim, localId, dt, alpha, time, camera) {
    const seen = new Set();
    for (const p of sim.players) {
      if (p.id === localId) continue;
      seen.add(p.id);
      let v = this.views.get(p.id);
      if (!v || v.character !== p.character) {
        if (v) v.dispose(this.scene);
        v = new Teammate(this.scene, p, this.cfg);
        this.views.set(p.id, v);
      }
      const a = this.prev.get(p.id) || { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch };
      const pos = { x: lerp(a.x, p.pos.x, alpha), y: lerp(a.y, p.pos.y, alpha), z: lerp(a.z, p.pos.z, alpha) };
      v.update(p, pos, lerpAngle(a.yaw, p.yaw, alpha), lerp(a.pitch, p.pitch, alpha), dt, time, camera);
    }
    for (const [id, v] of this.views) if (!seen.has(id)) { v.dispose(this.scene); this.views.delete(id); this.prev.delete(id); }
  }

  // where a teammate's shot comes out (for the flash and tracer)
  muzzle(id) { const v = this.views.get(id); return v ? v.muzzle() : null; }

  clear() { for (const v of this.views.values()) v.dispose(this.scene); this.views.clear(); this.prev.clear(); }
}
