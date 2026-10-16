// =============================================================================
// Teammates (online): the other players, drawn as their crew character
// holding their current gun. Simple procedural animation on the character rig:
// walking and sprinting strides, crouching, aiming up and down with the view,
// lowering the gun to reload or sprint, and sitting on the floor when downed.
// A name tag in their colour floats over each of them while you can see them
// (src/render/nameTag.js), and turns red (through walls) while they need a revive.
// =============================================================================
import * as THREE from 'three';
import { buildCharacter, rigidSkin, CHARACTERS } from './characters.js';
import { applySkin } from '../career/skins.js';
import { applySkinFx } from './skinFx.js';
import { proneLevel } from '../sim/player.js';
import { idleCharacter, idleAct, IDLE_ACTS, solveArm, orientHand, applyArm } from './characterAnim.js';
import { buildGun } from './gunModels.js';
import { NameTag, playerColor } from './nameTag.js';
import { HAND_POSES } from './hands.js';
import { EMOTE_BY_ID } from '../career/emotes.js';

const lerp = (a, b, k) => a + (b - a) * k;
function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
const approach = (v, t, rate, dt) => v + (t - v) * Math.min(1, rate * dt);
const sm = (x) => x * x * (3 - 2 * x);

// who they look like: the character and their skin (a change rebuilds them)
export const lookOf = (p) => p.character + ':' + (p.skin || '');

export class Teammate {
  constructor(scene, p, cfg) {
    this.cfg = cfg;
    this.id = p.id;
    this.character = p.character;
    this.look = lookOf(p);   // (in the skin they picked: src/career/skins.js)
    const def = p.skin && CHARACTERS[p.character] ? applySkin(CHARACTERS[p.character], p.character, p.skin) : null;
    const k = buildCharacter(def || p.character, { detail: 0.6 });
    if (def && def.skinFx) applySkinFx(k, def.skinFx, { light: false });
    this.k = rigidSkin(k);   // (one draw per material)
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
    this.nameTag = new NameTag(scene);
    this.tag = this.nameTag.sprite;   // (hide it with tag.visible = false after update)
    this.muzzlePos = new THREE.Vector3();
    this.tagHead = new THREE.Vector3(); this.tagChest = new THREE.Vector3();
  }

  setGun(id) {
    if (id === this.gunId) return;
    this.gunId = id;
    if (this.gun) { this.gun.group.parent.remove(this.gun.group); }
    const def = this.cfg.weapons[id];
    this.gun = buildGun(def && def.view ? def.view.model : 'pistol', { camo: def && def.view ? def.view.camo || null : null });
    const g = this.gun.group;
    // the gun hangs off the chest (in a holder that aims it); the hands reach
    // for its grips. The models point down -Z with the grip under the hand
    // position, so turn it round and put the grip at the holder's origin.
    const S = 1.15;
    g.scale.setScalar(S);
    const R = this.gun.right ? this.gun.right.pos : [0, -0.07, 0.07];
    const L = this.gun.left ? this.gun.left.pos : [-0.02, -0.08, 0.06];
    g.rotation.set(0, Math.PI, 0);
    g.position.set(R[0] * S, -R[1] * S, R[2] * S);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    if (!this.holder) { this.holder = new THREE.Group(); this.k.torso.add(this.holder); }
    this.holder.add(g);
    this.leftGrip = new THREE.Object3D();
    this.leftGrip.position.fromArray(L);
    g.add(this.leftGrip);
    this.pistol = def && def.class === 'pistol';
  }

  // their name in their colour (the scoreboard's), red while they need a revive
  setTag(p, color) {
    if (p.downed) this.nameTag.set(`${p.name} · down!`, '#ff5a40');
    else this.nameTag.set(p.name, color || '#f2ead8');
  }

  // sim: to check you can see them (no sim: always shown); color: their name's colour
  update(p, pos, yaw, pitch, dt, time, camera, sim = null, color = null) {
    const k = this.k;
    this.root.visible = p.alive;
    if (!p.alive) { this.nameTag.hide(); return; }
    const w = p.loadout;
    this.setGun(w.slots[w.current].id);
    this.setTag(p, color);

    // speed from how far they moved (smoothed)
    if (this.lastPos && dt > 0) {
      const d = Math.hypot(pos.x - this.lastPos.x, pos.z - this.lastPos.z) / dt;
      this.speed = approach(this.speed, Math.min(9, d), 10, dt);
    }
    this.lastPos = { x: pos.x, z: pos.z };
    const downed = !!p.downed;
    this.crouch = approach(this.crouch, p.crouching && !downed ? 1 : 0, 10, dt);
    this.down = approach(this.down, downed ? 1 : 0, 6, dt);
    // (flung off a launcher: flying, arms forward, like a dive held up in the air)
    this.dive = approach(this.dive || 0, downed ? 0 : p.dive ? 1 : p.launch ? this.cfg.crust.launch.flyLean : proneLevel(p, this.cfg), 12, dt);
    const sprint = p.sprinting && !downed;
    const busy = w.reloading || !!p.drinking || !!p.throwing || (p.melee && p.melee.timer > 0);
    // how high the gun is held: level when aiming, angled down to sprint or reload
    this.raise = approach(this.raise ?? 1.35, sprint ? 0.7 : busy ? 1.05 : 1.35, 8, dt);

    // (lying flat, the body's middle is where they are: it pivots from the feet, so shift it back)
    const back = this.cfg.player.prone.bodyOffset * Math.sin(1.3 * this.dive) / Math.sin(1.3);
    this.root.position.set(pos.x + Math.sin(yaw) * back, pos.y + 0.28 * this.dive, pos.z + Math.cos(yaw) * back);
    // a dolphin dive: flat out, face down, gun first
    this.root.rotation.set(1.3 * this.dive, yaw + Math.PI, 0, 'YXZ');

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

    // --- diving: legs out straight behind
    if (this.dive > 0.001) for (const [L] of legs) { L.hip.rotation.x = lerp(L.hip.rotation.x, 0.1, this.dive); L.knee.rotation.x = lerp(L.knee.rotation.x, 0.15, this.dive); }

    // --- on a zipline: hanging off the handle by one hand, legs swinging
    const onZip = !!(p.ride && (p.ride.zip || (p.ride.ride && p.ride.ride.kind === 'zip')));
    this.zip = approach(this.zip || 0, onZip ? 1 : 0, 12, dt);
    if (this.zip > 0.001) {
      legs.forEach(([L], i) => {
        L.hip.rotation.x = lerp(L.hip.rotation.x, -0.35 + Math.sin(time * 2.6 + i * 0.9) * 0.18, this.zip);
        L.knee.rotation.x = lerp(L.knee.rotation.x, 0.45 + Math.sin(time * 2.6 + i) * 0.12, this.zip);
      });
      k.torso.rotation.x = lerp(k.torso.rotation.x, -0.06, this.zip);
    }

    const pt = Math.max(-1.1, Math.min(1.1, pitch));
    // empty-handed (a cutscene: someone with no gun out), and what their arms are doing
    if (p.unarmed) {
      if (this.holder) this.holder.visible = false;
      if (this.handle) this.handle.visible = false;
      this.gesture(p, time);
    } else {
      if (this.holder) this.holder.visible = true;
      // --- the gun: held where they're looking, lowered to sprint or reload
      const lean = k.torso.rotation.x + k.hips.rotation.x + 1.3 * this.dive;   // the gun hangs off the torso: undo its lean (and a dive's)
      const sh = k.armR.shoulder.position, shY = k.armR.shoulderY;
      const lower = 1.35 - this.raise;                         // 0 aiming .. ~0.65 sprinting
      const H = this.holder;
      if (this.pistol) H.position.set(sh.x * 0.25, shY - 0.1 - lower * 0.12, 0.4 - lower * 0.12);
      else H.position.set(sh.x * 0.55, shY - 0.15 - lower * 0.1, 0.27 - lower * 0.06);
      H.rotation.set(-(pt + lean) + lower * 0.9, lower * 0.4, w.reloading ? 0.5 : 0);
      if (p.melee && p.melee.timer > 0) H.rotation.x += 0.5;
      this.root.updateMatrixWorld(true);
      // right hand on the grip, left hand under the barrel (or wrapped round a pistol)
      const grip = H.position.clone();
      const fore = k.torso.worldToLocal(this.leftGrip.getWorldPosition(new THREE.Vector3()));
      const fwd = new THREE.Vector3(0, 0, 1).applyEuler(H.rotation);
      const solR = solveArm(k.armR, grip, new THREE.Vector3(-0.9, -1, -0.3));
      applyArm(k.armR, solR, orientHand(k.armR, solR.q, solR.bend, new THREE.Vector3(0.8, -0.7, 0.1).add(fwd.clone().multiplyScalar(0.2)), new THREE.Vector3(1, 0, 0)), 1);
      if (this.handle && this.zip <= 0.5) this.handle.visible = false;
      if (this.zip > 0.5) {
        // the left hand up on the zipline's handle, over their head
        const up = new THREE.Vector3(k.armL.shoulder.position.x * 0.5, k.armL.shoulderY + 0.62, 0.06);
        const solL = solveArm(k.armL, up, new THREE.Vector3(1, 0, -0.4));
        applyArm(k.armL, solL, orientHand(k.armL, solL.q, solL.bend, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)), 1);
        if (!this.handle) {
          const iron = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.5, metalness: 0.7 });
          const red = new THREE.MeshStandardMaterial({ color: '#8a1c14', roughness: 0.6 });
          this.handle = new THREE.Group();
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8).rotateZ(Math.PI / 2), red); this.handle.add(bar);
          const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5), iron); strap.position.y = 0.15; this.handle.add(strap);
          const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12), iron); wheel.position.y = 0.32; wheel.rotation.y = Math.PI / 2; this.handle.add(wheel);
          k.torso.add(this.handle);
        }
        this.handle.position.copy(up).add(new THREE.Vector3(0, 0.04, 0));
        this.handle.visible = true;
      } else if (!(p.melee && p.melee.timer > 0)) {
        if (this.handle) this.handle.visible = false;
        const solL = solveArm(k.armL, fore, new THREE.Vector3(0.6, -1, -0.2));
        applyArm(k.armL, solL, orientHand(k.armL, solL.q, solL.bend, new THREE.Vector3(-1, 0.1, 0).add(fwd.clone().multiplyScalar(0.4)), new THREE.Vector3(0, 1, 0)), 1);
      } else {
        // knife: a quick jab with the left arm
        const m = Math.sin(Math.min(1, p.melee.timer / 0.5) * Math.PI);
        k.armL.shoulder.rotation.set(-1.5 * m, 0, 0.1); k.armL.elbow.rotation.set(-0.1, 0, 0);
      }

    }

    // look up and down with the head too
    k.head.rotation.x = -pt * 0.45;
    if (this.k.fxUpdate) this.k.fxUpdate(dt);   // (the Opal skin's shimmer)

    // an emote from the wheel, or standing still a while: their character's
    // idle act (James dances, Kyle crosses his arms). Snaps off the moment
    // they move or fire. (An emote keeps the way they faced when it started.)
    const emote = p.emote ? EMOTE_BY_ID[p.emote] : null;
    const name = emote ? emote.act : k.def.idleAct;
    const act = IDLE_ACTS[name];
    const still = !!(act && (emote || p.idle) && !downed && !p.unarmed);
    if (name !== this.actName) { this.actName = name; this.idleW = 0; }
    this.idleW = still ? approach(this.idleW || 0, 1, 3.5, dt) : 0;
    if (this.idleW > 0) {
      if (emote && p.emoteYaw != null) this.root.rotation.y = p.emoteYaw + Math.PI;
      if (act.turn) this.root.rotation.y += Math.PI * sm(this.idleW);
      if (act.hideGun && this.holder) this.holder.visible = this.idleW < 0.3;
      idleAct(k, name, time, sm(this.idleW));
    }

    // name tag over their head: only while you can see them, but a downed
    // teammate's shows through walls so you can find them to revive
    const headY = pos.y + (1.95 - 0.35 * c - 1.1 * dn) * (k.def.height || 1);
    this.tagHead.set(pos.x, headY + 0.28, pos.z);
    this.tagChest.set(pos.x, pos.y + (1.2 - 0.3 * c - 0.7 * dn) * (k.def.height || 1), pos.z);
    this.nameTag.place(this.tagHead, this.tagChest, camera, sim, dt, { always: downed });
  }

  // Arms with no gun in them: hanging, or cheering (both up, bouncing),
  // reaching (both straight out: a shove), flailing (falling), pointing.
  gesture(p, time) {
    const k = this.k, G = p.gesture;
    const arm = (a, x, z, el) => { a.shoulder.rotation.set(x, 0, z * a.side); a.elbow.rotation.set(el, 0, 0); };
    if (G === 'cheer') {
      const b = Math.sin(time * 9 + this.k.phase * 7);
      arm(k.armL, -2.7 - b * 0.15, 0.35, -0.3); arm(k.armR, -2.7 + b * 0.15, 0.35, -0.3);
      this.root.position.y += Math.max(0, b) * 0.08;
    } else if (G === 'reach') { arm(k.armL, -1.5, 0.05, -0.05); arm(k.armR, -1.5, 0.05, -0.05); }
    else if (G === 'flail') { arm(k.armL, -2.4 + Math.sin(time * 11) * 0.6, 0.6, -0.4); arm(k.armR, -2.4 + Math.sin(time * 13 + 1) * 0.6, 0.6, -0.4); }
    else if (G === 'point') { arm(k.armR, -1.55, 0.1, 0); arm(k.armL, 0.05, 0.08, -0.15); }
    else if (G === 'bars') { arm(k.armL, -1.9, 0.25, -0.9); arm(k.armR, -1.9 - Math.max(0, Math.sin(time * 7)) * 0.25, 0.25, -0.9); }
    else { arm(k.armL, 0.05, 0.08, -0.15); arm(k.armR, 0.05, 0.08, -0.15); }
  }

  muzzle() {
    if (!this.gun || !this.root.visible) return null;
    this.root.updateMatrixWorld(true);
    return this.gun.muzzle.getWorldPosition(this.muzzlePos);
  }

  dispose(scene) {
    scene.remove(this.root);
    this.nameTag.dispose();
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
      if (!v || v.look !== lookOf(p)) {
        if (v) v.dispose(this.scene);
        v = new Teammate(this.scene, p, this.cfg);
        this.views.set(p.id, v);
      }
      const a = this.prev.get(p.id) || { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch };
      const pos = { x: lerp(a.x, p.pos.x, alpha), y: lerp(a.y, p.pos.y, alpha), z: lerp(a.z, p.pos.z, alpha) };
      v.update(p, pos, lerpAngle(a.yaw, p.yaw, alpha), lerp(a.pitch, p.pitch, alpha), dt, time, camera, sim, playerColor(this.cfg, sim, p.id));
    }
    for (const [id, v] of this.views) if (!seen.has(id)) { v.dispose(this.scene); this.views.delete(id); this.prev.delete(id); }
  }

  // where a teammate's shot comes out (for the flash and tracer)
  muzzle(id) { const v = this.views.get(id); return v ? v.muzzle() : null; }

  clear() { for (const v of this.views.values()) v.dispose(this.scene); this.views.clear(); this.prev.clear(); }
}
