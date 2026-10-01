// =============================================================================
// First-person camera: eye height smoothing, head bob, landing dip, recoil,
// damage shake, FOV (settings + ADS + sprint).
// =============================================================================
import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;

export class CameraRig {
  constructor(camera, cfg) {
    this.camera = camera;
    this.cfg = cfg;
    this.eyeY = cfg.player.eyeHeight;
    this.bobPhase = 0;
    this.bobAmp = 0;
    this.bobSide = 0;
    this.roll = 0;
    this.dip = 0; this.dipVel = 0;
    this.shake = 0;
    this.shakeT = 0;
    this.fovExtra = 0;
    this.hFov = cfg.camera.defaultFov;
    this.lastStep = 0;
    this.onFootstep = null;
    this.lastDist = null;
    camera.rotation.order = 'YXZ';
  }

  setFov(h) { this.hFov = h; }

  onEvent(e, localId) {
    if (e.playerId !== localId) return;
    if (e.type === 'playerLand') this.dipVel -= Math.min(2.2, e.impact * 0.3);
    if (e.type === 'playerHit') { this.shake = 1; }
  }

  // explosions shake the camera by distance (anyone's blast)
  explosion(e, pos) {
    const d = Math.hypot(e.pos.x - pos.x, e.pos.y - pos.y - 1.5, e.pos.z - pos.z);
    const k = (e.shake || 1) * Math.max(0, 1 - d / (e.radius * 4));
    this.shake = Math.min(1.6, Math.max(this.shake, k * 1.4));
  }

  // pos: interpolated player position; p: sim player; look: {yaw,pitch}
  update(dt, pos, p, look, aspect, def) {
    const c = this.cfg.camera, pc = this.cfg.player;
    const w = p.loadout;
    const targetEye = p.crouching ? pc.crouchEyeHeight : pc.eyeHeight;
    this.eyeY = lerp(this.eyeY, targetEye, 1 - Math.exp(-c.eyeSmoothing * dt));

    // smooth step-ups: follow pos.y with a little lag
    if (this.smoothY === undefined) this.smoothY = pos.y;
    this.smoothY = pos.y < this.smoothY ? pos.y : lerp(this.smoothY, pos.y, 1 - Math.exp(-18 * dt));
    if (!p.grounded) this.smoothY = pos.y;

    // head bob driven by distance travelled
    const speed = p.grounded ? p.moveSpeed : 0;
    const sprint = p.sprinting;
    const stride = sprint ? c.bobSprintStride : c.bobStride;
    if (this.lastDist === null) this.lastDist = p.distanceWalked;
    const dd = p.distanceWalked - this.lastDist;
    this.lastDist = p.distanceWalked;
    this.bobPhase += (dd / stride) * Math.PI * 2;
    const moving = Math.min(1, speed / 2.5);
    const adsK = lerp(1, c.bobAdsMult, w.adsAmount);
    const targetAmp = (sprint ? c.bobSprintAmp : c.bobWalkAmp) * moving * adsK;
    const targetSide = (sprint ? c.bobSprintSide : c.bobWalkSide) * moving * adsK;
    this.bobAmp = lerp(this.bobAmp, targetAmp, 1 - Math.exp(-8 * dt));
    this.bobSide = lerp(this.bobSide, targetSide, 1 - Math.exp(-8 * dt));
    this.roll = lerp(this.roll, sprint ? c.bobRollSprint * Math.PI / 180 : 0, 1 - Math.exp(-6 * dt));

    // footsteps land at the bottom of each bob
    const step = Math.floor(this.bobPhase / Math.PI);
    if (step !== this.lastStep && p.grounded && speed > 0.8 && this.onFootstep) this.onFootstep(sprint, speed);
    this.lastStep = step;

    const bobY = -Math.abs(Math.sin(this.bobPhase)) * this.bobAmp + this.bobAmp * 0.5;
    const bobX = Math.cos(this.bobPhase) * this.bobSide;

    // landing dip spring
    this.dipVel += (-this.dip * c.landDipSpring - this.dipVel * c.landDipDamping) * dt;
    this.dip += this.dipVel * dt;
    const dip = Math.max(-c.landDip * 2, this.dip * c.landDip);

    // damage shake
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.shakeT += dt * 40;
    const sh = this.shake * this.shake * c.damageShake * Math.PI / 180;

    const cam = this.camera;
    const yaw = look.yaw + w.recoilYaw + (w.swayYaw || 0) + Math.sin(this.shakeT * 1.3) * sh;
    const pitch = look.pitch + w.recoilPitch + (w.swayPitch || 0) + Math.sin(this.shakeT) * sh;
    // side bob is along the camera's right vector
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    cam.position.set(pos.x + rx * bobX, this.smoothY + this.eyeY + bobY + dip, pos.z + rz * bobX);
    cam.rotation.set(pitch, yaw, Math.cos(this.bobPhase) * this.roll + Math.sin(this.shakeT * 0.7) * sh * 0.5);

    // FOV
    this.fovExtra = lerp(this.fovExtra, sprint ? c.sprintFovAdd : 0, 1 - Math.exp(-6 * dt));
    const adsMult = lerp(1, def.adsFovMult ?? 0.85, w.adsAmount);
    const h = (this.hFov + this.fovExtra) * adsMult;
    const vFov = 2 * Math.atan(Math.tan((h * Math.PI / 180) / 2) / aspect) * 180 / Math.PI;
    if (Math.abs(cam.fov - vFov) > 0.01 || cam.aspect !== aspect) {
      cam.fov = vFov; cam.aspect = aspect; cam.updateProjectionMatrix();
    }
    return { phase: this.bobPhase, amp: this.bobAmp / Math.max(0.001, c.bobSprintAmp) * 0.06 };
  }
}
