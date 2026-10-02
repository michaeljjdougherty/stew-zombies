// =============================================================================
// Gamepad reader (standard mapping). Polled once per frame. Works out which
// kind of controller it is (Xbox / PlayStation) from the browser's id string,
// cleans up the sticks (radial dead zones) and reports button presses and
// releases since the last poll. Also drives rumble.
// =============================================================================

// Standard mapping button indices
export const BTN = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, HOME: 16, PAD: 17,
};

export function padType(id = '') {
  if (/xbox|xinput|045e/i.test(id)) return 'xbox';
  if (/playstation|dualshock|dualsense|054c|sony|ps[345]|wireless controller/i.test(id)) return 'ps';
  return 'xbox'; // Xbox, XInput and most others use Xbox-style labels
}

// Radial dead zone with rescale, then a response curve.
function stick(x, y, dead, curve = 1) {
  const m = Math.hypot(x, y);
  if (m < dead) return { x: 0, y: 0, m: 0 };
  const k = Math.min(1, (m - dead) / (1 - dead));
  const s = Math.pow(k, curve) / m;
  return { x: x * s, y: y * s, m: Math.pow(k, curve) };
}

export class Pads {
  constructor() {
    this.index = -1;
    this.type = 'xbox';
    this.prev = [];
    this.state = null;
    this.active = false;       // did the pad do anything this frame
    this.connected = false;
    window.addEventListener('gamepadconnected', (e) => { if (this.index < 0) this.index = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', (e) => { if (e.gamepad.index === this.index) { this.index = -1; this.prev = []; } });
  }

  current() {
    if (!navigator.getGamepads) return null;
    const list = navigator.getGamepads();
    let gp = this.index >= 0 ? list[this.index] : null;
    if (!gp || !gp.connected) {
      gp = null;
      // pick whichever pad is being used
      for (const g of list) {
        if (!g || !g.connected) continue;
        if (!gp) gp = g;
        if (g.buttons.some((b) => b.pressed) || g.axes.some((a) => Math.abs(a) > 0.5)) { gp = g; break; }
      }
      if (gp) this.index = gp.index;
    }
    return gp;
  }

  // Returns { buttons:[{pressed,value}], down(i), pressed(i), released(i), ls, rs, lt, rt } or null.
  poll() {
    const gp = this.current();
    this.connected = !!gp;
    if (!gp) { this.state = null; this.active = false; return null; }
    this.type = padType(gp.id);
    const b = gp.buttons.map((x) => ({ pressed: !!(x && (x.pressed || x.value > 0.5)), value: x ? x.value : 0 }));
    const prev = this.prev;
    const ax = gp.axes;
    const ls = stick(ax[0] || 0, ax[1] || 0, 0.17, 1.0);
    const rs = stick(ax[2] || 0, ax[3] || 0, 0.13, 1.0);
    const lt = b[BTN.LT] ? b[BTN.LT].value : 0, rt = b[BTN.RT] ? b[BTN.RT].value : 0;
    const anyPress = b.some((x, i) => x.pressed && !(prev[i] && prev[i].pressed));
    this.active = anyPress || ls.m > 0.25 || rs.m > 0.25 || lt > 0.3 || rt > 0.3;
    const st = {
      gp, buttons: b, ls, rs, lt, rt, type: this.type,
      down: (i) => !!(b[i] && b[i].pressed),
      pressed: (i) => !!(b[i] && b[i].pressed && !(prev[i] && prev[i].pressed)),
      released: (i) => !!(prev[i] && prev[i].pressed && !(b[i] && b[i].pressed)),
    };
    this.prev = b;
    this.state = st;
    return st;
  }

  rumble(strong = 0.5, weak = 0.5, ms = 120) {
    const gp = this.current();
    const act = gp && gp.vibrationActuator;
    if (!act || !act.playEffect) return;
    try { act.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) }).catch(() => {}); } catch (e) { /* not supported */ }
  }
}
