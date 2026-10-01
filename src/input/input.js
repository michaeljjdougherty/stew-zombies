// =============================================================================
// Keyboard + mouse -> input commands for the simulation.
// The client owns yaw/pitch (for instant mouse response); everything else is
// sampled into a command once per simulation tick.
// =============================================================================
import { emptyCommand } from '../sim/player.js';

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
    this.adsActive = () => false;
    this.zoomScale = () => 1;
    this.bind();
  }

  bind() {
    const map = this.cfg.input.keys;
    this.codeToAction = new Map();
    for (const [action, codes] of Object.entries(map)) for (const c of codes) this.codeToAction.set(c, action);

    window.addEventListener('keydown', (e) => {
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
      if (!this.enabled || (!this.locked && !this.fallbackLook)) return;
      if (performance.now() < this.ignoreMovesUntil) return; // browsers can send a jump right after locking
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return; // ignore spikes some browsers send
      const ads = this.adsActive() ? this.settings.adsSensitivity : 1;
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
    c.moveY = (k.has('forward') ? 1 : 0) - (k.has('back') ? 1 : 0);
    c.moveX = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    c.yaw = this.yaw;
    c.pitch = this.pitch;
    c.sprint = k.has('sprint');
    c.crouch = k.has('crouch');
    c.fire = this.mouse.left;
    c.ads = this.mouse.right;
    c.adsPressed = this.edges.has('ads');
    c.grenade = k.has('grenade');
    c.use = k.has('use');
    const e = this.edges;
    c.firePressed = e.has('fire');
    c.jumpPressed = e.has('jump');
    c.reloadPressed = e.has('reload');
    c.meleePressed = e.has('melee');
    c.usePressed = e.has('use');
    c.grenadePressed = e.has('grenade');
    c.tactical = k.has('tactical');
    c.tacticalPressed = e.has('tactical');
    c.weaponSlot = e.has('weapon1') ? 0 : e.has('weapon2') ? 1 : -1;
    c.weaponCycle = this.wheel !== 0 ? 1 : 0;
    this.wheel = 0;
    e.clear();
    return c;
  }

  endFrame() { this.frameDX = 0; this.frameDY = 0; }

  reset() { this.keys.clear(); this.edges.clear(); this.mouse.left = this.mouse.right = false; }
}
