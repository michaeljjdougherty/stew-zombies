// =============================================================================
// Controller menu navigation. Moves focus between the buttons, sliders and
// checkboxes of whichever screen is open, using the D-pad or left stick
// (spatially: "down" goes to the nearest thing below). A presses, B goes back,
// left/right nudges sliders, the right stick turns the characters on the
// character screens and scrolls long panels, and the bumpers flip tabs.
// =============================================================================
import { BTN } from '../input/gamepad.js';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), summary, [data-nav]';
const FIRST = 0.38, REPEAT = 0.11;

function visible(el) {
  if (!el.getClientRects().length) return false;
  const st = getComputedStyle(el);
  return st.visibility !== 'hidden' && st.display !== 'none' && !el.closest('[hidden]');
}

export class MenuNav {
  // handlers: { root() -> element|null, back(rootId) , start(rootId), bumper(rootId, dir), rotate(rootId, amount) }
  constructor(handlers) {
    this.h = handlers;
    this.dir = null;
    this.hold = 0;
    this.lastRoot = null;
    this.memory = new Map();   // where focus was on each screen, to come back to
    this.onRoot = null;        // (rootId|null) => void when the screen changes
  }

  items(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter((el) => visible(el) && !el.closest('details.locked'));
  }

  // Focus something sensible when a screen opens (or focus fell outside it).
  ensureFocus(root, force = false) {
    const a = document.activeElement;
    if (!force && a && a !== document.body && root.contains(a) && visible(a)) return a;
    const list = this.items(root);
    const first = root.querySelector('[data-nav-first]');
    const pick = (first && visible(first) && first)
      || list.find((el) => el.closest('.menu'))
      || list[0];
    if (pick) this.focus(pick);
    return pick;
  }

  focus(el) {
    if (this.lastRoot) this.memory.set(this.lastRoot.id, el);
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // Spatial move: nearest focusable in that direction, weighted against drifting sideways.
  move(root, dx, dy) {
    const cur = this.ensureFocus(root);
    if (!cur) return;
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of this.items(root)) {
      if (el === cur) continue;
      const b = el.getBoundingClientRect();
      const ex = b.left + b.width / 2, ey = b.top + b.height / 2;
      // distance along the direction, measured edge to edge so rows line up
      let along, side;
      if (dx) {
        along = dx > 0 ? b.left - r.right : r.left - b.right;
        if (dx > 0 ? ex <= cx + 1 : ex >= cx - 1) continue;
        side = Math.max(0, Math.abs(ey - cy) - (r.height + b.height) / 4);
      } else {
        along = dy > 0 ? b.top - r.bottom : r.top - b.bottom;
        if (dy > 0 ? ey <= cy + 1 : ey >= cy - 1) continue;
        side = Math.max(0, Math.abs(ex - cx) - (r.width + b.width) / 4);
      }
      const score = Math.max(0, along) + side * (dx ? 3 : 1.6);
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) this.focus(best);
    else if (dy) {
      // wrap around top <-> bottom in simple vertical menus
      const list = this.items(root);
      const sameCol = list.filter((el) => Math.abs(el.getBoundingClientRect().left - r.left) < 40);
      const wrap = dy > 0 ? sameCol[0] : sameCol[sameCol.length - 1];
      if (wrap && wrap !== cur && sameCol.length > 2) this.focus(wrap);
    }
  }

  nudgeRange(el, dir) {
    const step = parseFloat(el.step) || 1;
    const min = parseFloat(el.min), max = parseFloat(el.max);
    const big = (max - min) / step > 60 ? 2 : 1;
    const v = Math.min(max, Math.max(min, parseFloat(el.value) + dir * step * big));
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  press(el) {
    if (!el) return;
    if (el.tagName === 'INPUT' && el.type === 'range') return;
    el.click(); // checkboxes toggle and fire change; buttons fire click
  }

  // Called every frame while a menu is up. st = Pads.poll() result.
  frame(st, dt) {
    const root = this.h.root();
    if (root !== this.lastRoot) {
      const a = document.activeElement;
      if (this.lastRoot && a && this.lastRoot.contains(a)) this.memory.set(this.lastRoot.id, a);
      this.lastRoot = root; this.dir = null; this.hold = 0;
      if (this.onRoot) this.onRoot(root ? root.id : null);
      if (root && st) {
        const m = this.memory.get(root.id);
        if (m && root.contains(m) && visible(m)) this.focus(m); else this.ensureFocus(root, true);
      }
    }
    if (!root || !st) { this.dir = null; return; }
    const rootId = root.id;

    // direction from D-pad or left stick
    let d = null;
    if (st.down(BTN.UP)) d = 'up'; else if (st.down(BTN.DOWN)) d = 'down';
    else if (st.down(BTN.LEFT)) d = 'left'; else if (st.down(BTN.RIGHT)) d = 'right';
    else if (st.ls.m > 0.55) d = Math.abs(st.ls.x) > Math.abs(st.ls.y) ? (st.ls.x > 0 ? 'right' : 'left') : (st.ls.y > 0 ? 'down' : 'up');
    let fire = false;
    if (d !== this.dir) { this.dir = d; this.hold = 0; fire = !!d; }
    else if (d) { this.hold += dt; if (this.hold >= FIRST) { this.hold -= REPEAT; fire = true; } }
    if (fire) {
      const a = this.ensureFocus(root);
      const horiz = d === 'left' || d === 'right';
      if (a && horiz && a.tagName === 'INPUT' && a.type === 'range') this.nudgeRange(a, d === 'right' ? 1 : -1);
      else this.move(root, horiz ? (d === 'right' ? 1 : -1) : 0, horiz ? 0 : (d === 'down' ? 1 : -1));
    }

    if (st.pressed(BTN.A)) this.press(this.ensureFocus(root));
    if (st.pressed(BTN.B)) this.h.back(rootId);
    if (st.pressed(BTN.MENU)) this.h.start(rootId);
    if (st.pressed(BTN.VIEW) && this.h.view) this.h.view(rootId);
    if (st.pressed(BTN.LB)) this.h.bumper(rootId, -1);
    if (st.pressed(BTN.RB)) this.h.bumper(rootId, 1);

    // right stick: turn the characters, or scroll whatever panel is long
    const rx = st.rs.x, ry = st.rs.y;
    if (Math.abs(rx) > 0.01) this.h.rotate(rootId, rx * dt);
    if (Math.abs(ry) > 0.01) {
      const panel = root.querySelector('.xpanel, .rp') || (root.classList.contains('rp') ? root : null) || root;
      const sc = panel.scrollHeight > panel.clientHeight ? panel : root.querySelector('.rp');
      if (sc) sc.scrollTop += ry * dt * 900;
    }
  }
}
