// =============================================================================
// A name floating over someone's head (online teammates, Pit at his forge).
// It's only there while you can actually see them: a ray from the camera to
// their head and to their chest, and if the world blocks both the tag fades
// out instead of showing through the wall. About the same size on screen at
// any distance.
// =============================================================================
import * as THREE from 'three';

// each player's colour: the same one their name has on the scoreboard
// (by where they are in the player list, which every peer builds in the same order)
export function playerColor(cfg, sim, id) {
  const C = cfg.hud.playerColors;
  const i = sim.players.findIndex((q) => q.id === id);
  return C[Math.max(0, i) % C.length];
}

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

const tmp = { x: 0, y: 0, z: 0 };

export class NameTag {
  constructor(parent) {
    this.parent = parent;
    this.mat = new THREE.SpriteMaterial({ depthTest: false, depthWrite: false, transparent: true, fog: false, opacity: 0 });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.renderOrder = 999;
    this.sprite.visible = false;
    parent.add(this.sprite);
    this.key = '';
    this.seen = 0;          // 0..1, eased toward whether you can see them
    this.canSee = false;
    this.check = Math.random() * 0.1;   // (staggered, so the tags don't all cast on one frame)
  }

  set(text, color) {
    const key = text + '|' + color;
    if (key === this.key) return;
    this.key = key;
    if (this.mat.map) this.mat.map.dispose();
    this.mat.map = tagTexture(text, color);
    this.mat.needsUpdate = true;
  }

  hide() { this.sprite.visible = false; this.seen = 0; this.canSee = false; }

  // head: where the tag sits (world); chest: a second point to look for.
  // always: show it through walls anyway (a downed teammate you need to find).
  // sim: the world to check against (none: always shown).
  place(head, chest, camera, sim, dt, { always = false, maxOpacity = 0.95 } = {}) {
    const s = this.sprite;
    s.position.set(head.x, head.y, head.z);
    const cam = camera.position;
    const dist = cam.distanceTo(s.position);
    this.check -= dt;
    if (this.check <= 0) {
      this.check = 0.1;
      this.canSee = always || !sim || clear(sim, cam, head) || clear(sim, cam, chest);
    }
    this.seen += ((this.canSee ? 1 : 0) - this.seen) * Math.min(1, dt * 12);
    const sc = Math.max(0.45, Math.min(2.8, dist * 0.055));
    s.scale.set(sc * 2, sc * 0.5, 1);
    const fade = always ? 1 : Math.max(0.35, Math.min(maxOpacity, 1.2 - dist / 40));
    this.mat.opacity = fade * this.seen;
    s.visible = this.mat.opacity > 0.01;
  }

  dispose() {
    this.parent.remove(this.sprite);
    if (this.mat.map) this.mat.map.dispose();
    this.mat.dispose();
  }
}

// nothing solid between the camera and that point
function clear(sim, from, to) {
  tmp.x = to.x - from.x; tmp.y = to.y - from.y; tmp.z = to.z - from.z;
  const d = Math.hypot(tmp.x, tmp.y, tmp.z);
  if (d < 0.5) return true;
  tmp.x /= d; tmp.y /= d; tmp.z /= d;
  return !sim.raycastWorld(from, tmp, d - 0.3, true);
}
