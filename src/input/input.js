// =============================================================================
// Keyboard + mouse -> input commands for the simulation.
// The client owns yaw/pitch (for instant mouse response); everything else is
// sampled into a command once per simulation tick.
// =============================================================================
import { emptyCommand } from '../sim/player.js';
import { BTN } from './gamepad.js';

export class Input {
  constructor(canvas, cfg, settings) {
    this.canvas = canvas;
    this.cfg = cfg;
    this.settings = settings;
    this.keys = new Set();
    this.mouse = { left: false, right: false };
    this.edges = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.frameDX = 0; this.frameDY = 0;
    this.wheel = 0;
    this.locked = false;
    this.ignoreMovesUntil = 0;
    this.enabled = false;
    this.onLockChange = null;
    this.adsAmount = () => 0;   // 0..1, how far the sights are up
    this.zoomScale = () => 1;
    // gamepad state (merged into each command)
    this.pad = { keys: new Set(), move: { x: 0, y: 0 }, fire: false, ads: false, sprint: false, crouch: false, held: 0, turnT: 0, snap: null, xDown: false, xUse: false };
    this.hasPrompt = () => false;   // is there something to buy/use right now?
    this.assist = () => null;       // aim assist target finder (set by main)
    this.onDevice = null;           // (device) => void, when keyboard/mouse is used
    this.bind();
  }

  bind() {
    const map = this.cfg.input.keys;
    this.codeToAction = new Map();
    for (const [action, codes] of Object.entries(map)) for (const c of codes) this.codeToAction.set(c, action);

    window.addEventListener('keydown', (e) => {
      if (this.onDevice) this.onDevice('kbm');
      if (!this.enabled) return;
      const a = this.codeToAction.get(e.code);
      if (a) {
        e.preventDefault();
        if (!this.keys.has(a)) this.edges.add(a);
        this.keys.add(a);
      }
    });
    window.addEventListener('keyup', (e) => {
      const a = this.codeToAction.get(e.code);
      if (a) this.keys.delete(a);
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });

    window.addEventListener('mousedown', () => { if (this.onDevice) this.onDevice('kbm'); });
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) { this.mouse.left = true; this.edges.add('fire'); }
      if (e.button === 2) { this.mouse.right = true; this.edges.add('ads'); }
      if (e.button === 3 || e.button === 4) this.edges.add('melee');
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { if (this.enabled) this.wheel += Math.sign(e.deltaY); }, { passive: true });

    window.addEventListener('mousemove', (e) => {
      if (this.onDevice && (Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) > 3)) this.onDevice('kbm');
      if (!this.enabled || (!this.locked && !this.fallbackLook)) return;
      if (performance.now() < this.ignoreMovesUntil) return; // browsers can send a jump right after locking
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return; // ignore spikes some browsers send
      const a = this.adsAmount();
      const ads = 1 + (this.settings.adsSensitivity - 1) * a;
      const k = this.cfg.input.radiansPerPixel * this.settings.sensitivity * ads * this.zoomScale();
      this.yaw -= dx * k;
      this.pitch -= dy * k * (this.settings.invertY ? -1 : 1);
      const lim = this.cfg.camera.pitchLimit * Math.PI / 180;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
      this.frameDX += dx; this.frameDY += dy;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.ignoreMovesUntil = performance.now() + 150;
      if (this.locked) this.fallbackLook = false;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      // Some embedded views refuse pointer lock: fall back to plain mouse-look.
      this.fallbackLook = true;
      if (this.onLockChange) this.onLockChange(false, true);
    });
  }

  requestLock() {
    try {
      const r = this.canvas.requestPointerLock({ unadjustedMovement: false });
      if (r && r.catch) r.catch(() => { this.fallbackLook = true; if (this.onLockChange) this.onLockChange(false, true); });
    } catch (e) {
      this.fallbackLook = true;
    }
  }

  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); this.fallbackLook = false; }

  setLook(yaw, pitch) { this.yaw = yaw; this.pitch = pitch; }

  held(a) { return this.keys.has(a); }

  // Called once per simulation tick.
  buildCommand() {
    const c = emptyCommand();
    const k = this.keys;
    const P = this.pad;
    c.moveY = (k.has('forward') ? 1 : 0) - (k.has('back') ? 1 : 0);
    c.moveX = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    if (!c.moveX && !c.moveY && (P.move.x || P.move.y)) { c.moveX = P.move.x; c.moveY = P.move.y; }
    c.yaw = this.yaw;
    c.pitch = this.pitch;
    c.sprint = k.has('sprint') || P.sprint;
    c.crouch = k.has('crouch') || P.crouch;
    c.fire = this.mouse.left || P.fire;
    c.ads = this.mouse.right || P.ads;
    c.adsPressed = this.edges.has('ads');
    c.grenade = k.has('grenade') || P.keys.has('grenade');
    c.use = k.has('use') || P.keys.has('use');
    const e = this.edges;
    c.firePressed = e.has('fire');
    c.jumpPressed = e.has('jump');
    c.reloadPressed = e.has('reload');
    c.meleePressed = e.has('melee');
    c.usePressed = e.has('use');
    c.grenadePressed = e.has('grenade');
    c.tactical = k.has('tactical') || P.keys.has('tactical');
    c.tacticalPressed = e.has('tactical');
    c.weaponSlot = e.has('weapon1') ? 0 : e.has('weapon2') ? 1 : -1;
    c.weaponCycle = this.wheel !== 0 ? 1 : 0;
    this.wheel = 0;
    e.clear();
    return c;
  }

  endFrame() { this.frameDX = 0; this.frameDY = 0; }

  reset() {
    this.keys.clear(); this.edges.clear(); this.mouse.left = this.mouse.right = false;
    const P = this.pad;
    P.keys.clear(); P.move.x = P.move.y = 0; P.fire = P.ads = P.sprint = P.crouch = false; P.snap = null; P.xDown = false;
  }

  // --- gamepad (called every frame while playing) ------------------------------
  // st: Pads.poll() result. Look is applied here per frame for smoothness.
  padFrame(st, dt) {
    const P = this.pad;
    if (!st || !this.enabled) { P.move.x = P.move.y = 0; P.fire = P.ads = false; P.keys.clear(); return; }
    const S = this.settings, cfg = this.cfg.input.pad;
    // movement: left stick (up is forward)
    P.move.x = st.ls.x; P.move.y = -st.ls.y;
    // sprint: click the left stick; stops when you stop pushing forward or aim
    if (st.pressed(BTN.LS)) { P.sprint = !P.sprint; if (P.sprint) P.crouch = false; }
    if (P.move.y < 0.3 || st.lt > 0.35) P.sprint = false;
    // crouch toggle; jumping stands you up
    if (st.pressed(BTN.B)) { P.crouch = !P.crouch; P.sprint = false; }
    if (st.pressed(BTN.A)) { this.edges.add('jump'); P.crouch = false; }
    // triggers
    const fireWas = P.fire, adsWas = P.ads;
    P.fire = st.rt > 0.35;
    P.ads = st.lt > 0.35;
    if (P.fire && !fireWas) this.edges.add('fire');
    if (P.ads && !adsWas) { this.edges.add('ads'); this.startSnap(); }
    // X: buy/use when there's something there (hold to keep using), otherwise reload
    if (st.pressed(BTN.X)) {
      P.xDown = true;
      if (this.hasPrompt()) { P.xUse = true; this.edges.add('use'); P.keys.add('use'); }
      else { P.xUse = false; this.edges.add('reload'); }
    }
    if (P.xDown && P.xUse && !P.keys.has('use')) P.keys.add('use');
    if (!st.down(BTN.X)) { P.xDown = false; P.xUse = false; P.keys.delete('use'); }
    if (st.pressed(BTN.Y)) this.wheel += 1;
    if (st.pressed(BTN.RS)) this.edges.add('melee');
    // grenades: hold to cook
    if (st.pressed(BTN.RB)) this.edges.add('grenade');
    if (st.down(BTN.RB)) P.keys.add('grenade'); else P.keys.delete('grenade');
    if (st.pressed(BTN.LB)) this.edges.add('tactical');
    if (st.down(BTN.LB)) P.keys.add('tactical'); else P.keys.delete('tactical');

    // --- look: right stick, with a response curve and a turn boost at full tilt
    const rx = st.rs.x, ry = st.rs.y;
    const mag = Math.hypot(rx, ry);
    const curved = Math.pow(mag, cfg.curve);
    if (mag > 0.94 && Math.abs(rx) > 0.85) P.turnT = Math.min(1, P.turnT + dt / cfg.boostTime); else P.turnT = Math.max(0, P.turnT - dt * 4);
    const boost = 1 + (cfg.boost - 1) * P.turnT * P.turnT;
    const a = this.adsAmount();
    const adsK = 1 + (S.adsSensitivity - 1) * a;
    // aim assist: slow down over a target
    let slow = 1;
    const target = S.aimAssist !== false ? this.assist() : null;
    if (target && target.angle < target.radius * 2.2) slow = a > 0.5 ? cfg.assistSlowAds : cfg.assistSlow;
    const k = (S.padSensitivity ?? 1) * adsK * this.zoomScale() * slow;
    if (mag > 0) {
      const dyaw = -(rx / mag) * curved * cfg.yawSpeed * k * boost * dt;
      const dpitch = -(ry / mag) * curved * cfg.pitchSpeed * k * dt * (S.invertY ? -1 : 1);
      this.yaw += dyaw; this.pitch += dpitch;
      // feed the gun sway the same way the mouse does
      const rpp = this.cfg.input.radiansPerPixel;
      this.frameDX += -dyaw / rpp; this.frameDY += -dpitch / rpp;
    }
    // ADS snap toward the target picked when the sights came up
    if (P.snap) {
      P.snap.t += dt;
      const f = Math.min(1, dt / Math.max(0.01, cfg.snapTime - P.snap.t + dt));
      let dy = P.snap.yaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * f * cfg.snapStrength;
      this.pitch += (P.snap.pitch - this.pitch) * f * cfg.snapStrength;
      if (P.snap.t >= cfg.snapTime || !P.ads) P.snap = null;
    }
    const lim = this.cfg.camera.pitchLimit * Math.PI / 180;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  startSnap() {
    if (this.settings.aimAssist === false) return;
    const t = this.assist();
    if (t && t.angle < this.cfg.input.pad.snapAngle * Math.PI / 180) this.pad.snap = { yaw: t.yaw, pitch: t.pitch, t: 0 };
  }
}
