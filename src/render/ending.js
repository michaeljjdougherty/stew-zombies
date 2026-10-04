// =============================================================================
// Ending cutscene: "Out of Bounds" (story by James Amarante).
//
//   The Fall            the Press Box glass shatters; Erik tumbles out onto the court
//   The Confrontation   he struggles up; the squad surrounds him, guns raised
//   The Schnitz         the lights flicker and die; "This season isn't over yet."
//   The Vanishing Act   smoke erupts; lights back: Erik's gone, a scorched jersey,
//                       and the doors at the far end of the gym swing open into fog
//   The Reveal          past the doors there's no parking lot: the campus has been
//                       ripped out of Earth and anchored to an asteroid in deep space
//   The Arrival         a portal crackles open and Brian Luke steps through:
//                       "You guys coming?"
//   Slam to Black       title card for Map 2
//
// Drives its own camera and objects; the renderer hands it the frame.
// =============================================================================
import * as THREE from 'three';
import * as T from './textures.js';
import { buildCharacter, idleCharacter, LINEUP, CHARACTERS } from './characters.js';
import { buildGun } from './gunModels.js';
import { PRESS_BOX } from './storyProps.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, k) => a.clone().lerp(b, k);

// When things happen (seconds from the start).
export const BEATS = {
  fall: 0, land: 1.7, confront: 4, flicker: 9, dark: 10.2, schnitz: 10.8, smoke: 14, lightsBack: 15.6,
  doors: 16.6, walk: 18.5, space: 21.5, pullback: 23, portal: 27, brian: 28.6, line: 30.6, black: 33.2, card: 34, end: 39.5,
};
const ERIK_LAND = V(0, 0, 3.6);
const DOORS = { x: -12, z: 13 };   // the gym's exit doors (south wall, far end)

// --- textures -------------------------------------------------------------------
function nebulaTexture() {
  const W = 2048, H = 1024;
  const [c, g] = T.makeCanvas(W, H);
  g.fillStyle = '#020208'; g.fillRect(0, 0, W, H);
  let s = 77; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const blob = (x, y, rad, col) => { const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
  for (let i = 0; i < 40; i++) {
    const x = W * (0.25 + r() * 0.5), y = H * (0.3 + r() * 0.4);
    blob(x, y, 140 + r() * 360, ['rgba(150,60,200,0.42)', 'rgba(40,170,200,0.36)', 'rgba(230,80,150,0.3)', 'rgba(70,220,140,0.24)'][i % 4]);
  }
  for (let i = 0; i < 2600; i++) {
    const b = r(); g.fillStyle = `rgba(255,255,${200 + Math.floor(r() * 55)},${0.3 + b * 0.7})`;
    const sz = b > 0.985 ? 3 : b > 0.9 ? 2 : 1;
    g.fillRect(r() * W, r() * H, sz, sz);
  }
  const t = T.toTexture(c, { repeat: false });
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

function cosmicStoneTexture() {
  const S = 512;
  const [c, g] = T.makeCanvas(S, S);
  const n = T.noiseCanvas(S, 6, 5);
  g.drawImage(n, 0, 0);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = '#3a3448'; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
  // glowing veins
  let s = 9; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  g.strokeStyle = 'rgba(90,220,255,0.55)'; g.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    let x = r() * S, y = r() * S;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; g.lineTo(x, y); }
    g.stroke();
  }
  return T.toTexture(c);
}

function jerseyTexture() {
  const [c, g] = T.makeCanvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = '#1d5a2e';
  g.beginPath(); g.moveTo(70, 20); g.lineTo(100, 34); g.lineTo(156, 34); g.lineTo(186, 20); g.lineTo(226, 70); g.lineTo(196, 96); g.lineTo(186, 236); g.lineTo(70, 236); g.lineTo(60, 96); g.lineTo(30, 70); g.closePath(); g.fill();
  g.fillStyle = '#f0ead8'; g.font = '900 110px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('8', 128, 140);
  // scorched
  let s = 3; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < 30; i++) { const x = r() * 256, y = r() * 256, rad = 10 + r() * 40; const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, 'rgba(10,8,6,0.95)'); grd.addColorStop(1, 'rgba(10,8,6,0)'); g.globalCompositeOperation = 'source-atop'; g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  g.globalCompositeOperation = 'source-over';
  const grd = g.createRadialGradient(128, 140, 60, 128, 140, 200); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(20,12,6,0.9)');
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return T.toTexture(c, { repeat: false });
}

function scorchTexture() {
  const [c, g] = T.makeCanvas(256, 256);
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(8,6,4,0.95)'); grd.addColorStop(0.6, 'rgba(14,10,6,0.6)'); grd.addColorStop(1, 'rgba(14,10,6,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return T.toTexture(c, { repeat: false });
}

function portalTexture() {
  const [c, g] = T.makeCanvas(256, 256);
  const grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  grd.addColorStop(0, 'rgba(220,250,255,1)'); grd.addColorStop(0.35, 'rgba(80,170,255,0.9)'); grd.addColorStop(0.7, 'rgba(40,80,255,0.5)'); grd.addColorStop(1, 'rgba(20,40,200,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2;
  let s = 4; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < 18; i++) { let a = r() * 6.28, rad = 30; g.beginPath(); g.moveTo(128 + Math.cos(a) * rad, 128 + Math.sin(a) * rad); for (let k = 0; k < 6; k++) { a += (r() - 0.5) * 0.6; rad += 14; g.lineTo(128 + Math.cos(a) * rad, 128 + Math.sin(a) * rad); } g.stroke(); }
  return T.toTexture(c, { repeat: false, srgb: false });
}

// A crew member holding a gun up at Erik.
function armed(k, gunModel) {
  const gun = buildGun(gunModel).group;
  gun.scale.setScalar(1.35);
  k.armR.wrist.add(gun);
  gun.position.set(0, -0.1, 0.02);
  gun.rotation.set(-Math.PI / 2, 0, 0);
  return gun;
}
function aimPose(k, w) {
  // both arms up and forward at chest height, the gun level
  for (const a of [k.armR, k.armL]) {
    a.shoulder.rotation.x = -1.35 * w + a.shoulder.rotation.x * (1 - w);
    a.shoulder.rotation.z = a.side * 0.18 * w + a.shoulder.rotation.z * (1 - w) - a.side * 0.25 * w;
    a.elbow.rotation.x = -0.25 * w + a.elbow.rotation.x * (1 - w);
  }
}

export class Ending {
  constructor(renderer, sim, { character = 'kearns', shirt = 'sage' } = {}) {
    this.R = renderer;
    this.sim = sim;
    this.t = 0;
    this.done = false;
    this.cues = new Set();
    this.onCue = null;          // (name) => sounds and subtitles
    this.scene = renderer.scene;
    this.cam = renderer.camera;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    const qv = renderer.quest;
    // Erik: the one already in the booth
    if (!qv.erik) qv.buildErik();
    this.erik = qv.erik;
    qv.erikHeld = true;
    this.erikStart = this.erik.root.position.clone();
    // the squad: you and three of the crew
    // the squad: the four who were trapped in there (Brian's on the other side of the portal)
    const four = ['kearns', 'ryan', 'pit', 'rocco'];
    const ids = four.includes(character) ? [character, ...four.filter((id) => id !== character)] : four;
    const guns = ['M1912', 'MP41', 'Olympus', 'M15'];
    this.squad = ids.map((id, i) => {
      const k = buildCharacter(id, { shirt, detail: 0.7 });
      this.group.add(k.root);
      armed(k, guns[i % guns.length]);
      const a = Math.PI * 0.15 + (i / (ids.length - 1)) * Math.PI * 0.7;   // a ring on the south side
      const ring = V(ERIK_LAND.x + Math.cos(a) * 2.6, 0, ERIK_LAND.z + Math.sin(a) * 2.6);
      const from = V(ring.x * 1.6, 0, ERIK_LAND.z + 7 + i * 0.8);
      k.root.position.copy(from);
      k.root.visible = false;
      return { k, ring, from, id };
    });
    // the scorched jersey and the burn mark it leaves
    this.jersey = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: jerseyTexture(), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4 }));
    this.jersey.position.set(ERIK_LAND.x, 0.012, ERIK_LAND.z); this.jersey.rotation.y = 0.4; this.jersey.visible = false;
    this.group.add(this.jersey);
    this.scorch = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: scorchTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    this.scorch.position.set(ERIK_LAND.x, 0.01, ERIK_LAND.z); this.scorch.visible = false;
    this.group.add(this.scorch);
    // The Schnitz: two eyes in the dark
    const eyeTex = T.softDotTexture('rgba(160,255,140,1)', 'rgba(40,255,60,0)');
    this.eyes = [-1, 1].map((s) => {
      const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
      e.scale.set(0.9, 0.36, 1); e.position.set(ERIK_LAND.x + s * 0.7, 3.0, ERIK_LAND.z - 1.2); this.group.add(e); return e;
    });
    // the exit doors at the far end of the gym (south wall), with fog behind
    this.doors = this.buildDoors();
    this.space = null; // built when we get there
    this.erikSmoke = 0;
  }

  buildDoors() {
    const g = new THREE.Group(); g.position.set(DOORS.x, 0, DOORS.z - 0.06); this.group.add(g);
    const fog = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.7), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.8, 0.85), fog: false }));
    fog.position.set(0, 1.35, 0.03); fog.rotation.y = Math.PI; g.add(fog);
    const mat = new THREE.MeshStandardMaterial({ map: T.metalTexture({ color: '#4a4f52', rust: 0.3 }), roughness: 0.5, metalness: 0.5 });
    const leaves = [-1, 1].map((s) => {
      const hinge = new THREE.Group(); hinge.position.set(s * 1.15, 0, 0); g.add(hinge);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.13, 2.65, 0.06), mat);
      leaf.position.set(-s * 0.575, 1.33, 0); hinge.add(leaf);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.08), new THREE.MeshStandardMaterial({ color: '#b8b6b0', metalness: 0.9, roughness: 0.25 }));
      bar.position.set(-s * 0.55, 1.05, -0.06); hinge.add(bar);
      return { hinge, s };
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.2, 0.15) }));
    sign.position.set(0, 2.95, -0.02); sign.rotation.y = Math.PI; g.add(sign);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.14), mat); frame.position.set(0, 2.72, 0); g.add(frame);
    return { g, leaves, fog };
  }

  // The campus ripped out of Earth, on an asteroid, in deep space.
  buildSpace() {
    const sc = new THREE.Scene();
    const sky = nebulaTexture();
    sc.background = sky;
    sc.add(new THREE.HemisphereLight(0x8090ff, 0x3a2848, 1.8));
    const key = new THREE.DirectionalLight(0xd0e0ff, 3.6); key.position.set(80, 70, 90); sc.add(key);
    const rim = new THREE.DirectionalLight(0xff70d0, 2.4); rim.position.set(-70, 10, -80); sc.add(rim);
    // the asteroid: a big lumpy rock with a flat top the campus sits on
    const geo = new THREE.IcosahedronGeometry(1, 5);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      let k = 1 + 0.08 * Math.sin(x * 5 + z * 3) + 0.06 * Math.sin(y * 7 + x * 4) + 0.04 * Math.sin(z * 11 - y * 6);
      let py = y * k;
      if (py > 0.25) py = 0.25 + (py - 0.25) * 0.05;
      pos.setXYZ(i, x * k, py, z * k);
    }
    geo.computeVertexNormals();
    const stoneTex = cosmicStoneTexture(); stoneTex.repeat.set(28, 28);
    const stone = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95, emissive: new THREE.Color(0.25, 0.7, 0.9), emissiveMap: stoneTex, emissiveIntensity: 0.06 });
    const nearTex = cosmicStoneTexture(); nearTex.repeat.set(6, 6);
    const nearStone = new THREE.MeshStandardMaterial({ map: nearTex, roughness: 0.95, emissive: new THREE.Color(0.25, 0.7, 0.9), emissiveMap: nearTex, emissiveIntensity: 0.1 });
    const rock = new THREE.Mesh(geo, stone);
    rock.scale.set(95, 70, 120); rock.position.set(4, -17.5, -28);
    sc.add(rock);
    // the campus as it sits up there: dark buildings with a few lit windows
    const wallMat = new THREE.MeshStandardMaterial({ color: '#8a8078', roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#4a4642', roughness: 0.9 });
    const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 0.8) });
    for (const room of this.sim.mapData.rooms) {
      const [x0, z0, x1, z1] = room.rect;
      if (room.outdoor) continue;
      const h = room.height + 0.6;
      const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.6, h, z1 - z0 + 0.6), [wallMat, wallMat, roofMat, wallMat, wallMat, wallMat]);
      b.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); sc.add(b);
      for (let i = 0; i < 3; i++) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), winMat);
        w.position.set(x0 + (x1 - x0) * (0.2 + i * 0.3), h * 0.55, z1 + 0.31); sc.add(w);
      }
    }
    // the open exit doors in the gym's south wall, light spilling out
    const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.7), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 1.0) }));
    doorGlow.position.set(DOORS.x, 1.35, 13.32); sc.add(doorGlow);
    const spill = new THREE.PointLight(0xffe0b0, 30, 14, 1.6); spill.position.set(DOORS.x, 2, 14.5); sc.add(spill);
    // the ground right outside: cosmic stone where the parking lot should be
    const near = new THREE.Mesh(new THREE.CircleGeometry(40, 48).rotateX(-Math.PI / 2), nearStone);
    near.position.set(DOORS.x, 0.01, 30); sc.add(near);
    // a portal (opens later)
    const pmat = new THREE.MeshBasicMaterial({ map: portalTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0 });
    const portal = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), pmat);
    portal.position.set(DOORS.x + 0.5, 1.7, 24.5); sc.add(portal);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.07, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.2, 4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
    ring.position.copy(portal.position); sc.add(ring);
    const plight = new THREE.PointLight(0x6aaaff, 0, 16, 1.5); plight.position.set(DOORS.x + 0.5, 1.9, 23.2); sc.add(plight);
    // Brian Luke
    const brian = buildCharacter('brian', { detail: 0.8 });
    brian.root.position.set(DOORS.x + 0.5, 0, 24.6); brian.root.rotation.y = Math.PI; brian.root.visible = false;
    sc.add(brian.root);
    this.space = { sc, portal, ring, plight, brian };
    // the squad moves over
    for (const m of this.squad) sc.add(m.k.root);
  }

  cue(name) {
    if (this.cues.has(name)) return;
    this.cues.add(name);
    if (this.onCue) this.onCue(name);
  }

  skip() { if (this.t < BEATS.black) this.t = BEATS.black; }

  // Returns the scene to draw this frame.
  update(dt, time) {
    const B = BEATS;
    this.t += dt;
    const t = this.t;
    const R = this.R, map = R.map, fx = R.effects, qv = R.quest;
    const cam = this.cam;
    const erik = this.erik;
    if (t >= B.end) { this.done = true; }

    // --- The Fall
    if (t < B.confront) {
      this.cue('shatter');
      if (qv.pressBox) for (const p of qv.pressBox.panes) p.visible = false;
      if (!this.shards) {
        this.shards = true;
        for (let i = 0; i < 160; i++) {
          const side = Math.floor(Math.random() * 4);
          const x = side < 2 ? (Math.random() - 0.5) * 5 : (side === 2 ? 2.6 : -2.6);
          const z = side >= 2 ? (Math.random() - 0.5) * 3.4 : (side === 0 ? 1.85 : -1.85);
          fx.spawnParticle(V(x, PRESS_BOX.y0 + 0.4 + Math.random() * 1.6, z), V(x * 0.8 + (Math.random() - 0.5) * 2, Math.random() * 2, z * 1.2 + (Math.random() - 0.5) * 2), { life: 2.2, size: 0.02 + Math.random() * 0.03, color: [0.8, 0.95, 0.9], gravity: 9.8, drag: 0.2 });
        }
      }
      // Erik goes over the edge of the booth and rolls onto the floor
      const k = sm(0.2, B.land, t);
      const p = lerpV(this.erikStart, ERIK_LAND, k);
      p.y = this.erikStart.y * (1 - k * k) + 0;
      if (k > 0.97) this.cue('thud');
      erik.root.position.copy(p);
      erik.root.rotation.set(-k * Math.PI * 1.5, 0, k * 0.6);
      if (t > B.land) { erik.root.rotation.set(-Math.PI / 2, 0, 0.3); erik.root.position.y = 0.15; }
      const look = t < 1.2 ? V(0, 5.6, 1.4) : lerpV(V(0, 5.6, 1.4), V(0, 0.6, ERIK_LAND.z), sm(1.2, 2.4, t));
      cam.position.copy(lerpV(V(6.5, 2.0, 10.5), V(4.5, 1.7, 8.5), sm(0, 4, t)));
      cam.lookAt(look);
    }
    // --- The Confrontation
    else if (t < B.flicker) {
      const k = sm(B.confront, B.confront + 4, t);
      // up onto a knee, then up, hunched
      erik.root.position.copy(ERIK_LAND);
      erik.root.rotation.set(-Math.PI / 2 * (1 - k) + 0.25 * k, Math.PI, 0);
      erik.root.position.y = 0.15 * (1 - k);
      idleCharacter(erik, time);
      // the squad closes in
      for (const m of this.squad) {
        m.k.root.visible = true;
        const w = sm(B.confront, B.confront + 1.6, t);
        m.k.root.position.copy(lerpV(m.from, m.ring, w));
        m.k.root.lookAt(ERIK_LAND.x, 0, ERIK_LAND.z);
        idleCharacter(m.k, time);
        aimPose(m.k, sm(B.confront + 0.6, B.confront + 1.8, t));
      }
      const a = 0.6 + (t - B.confront) * 0.12;
      cam.position.set(ERIK_LAND.x + Math.cos(a) * 5.2, 1.5, ERIK_LAND.z + Math.sin(a) * 5.2);
      cam.lookAt(ERIK_LAND.x, 1.1, ERIK_LAND.z);
    }
    // --- The Schnitz intervenes
    else if (t < B.smoke) {
      idleCharacter(erik, time);
      for (const m of this.squad) { idleCharacter(m.k, time); aimPose(m.k, 1); }
      // flicker, then black
      const flick = t < B.dark ? (Math.sin(t * 47) > 0.2 ? 0 : 1) : 1;
      map.blackout = flick > 0;
      if (t >= B.dark) this.cue('lightsDie');
      if (t >= B.schnitz) this.cue('schnitz');
      const e = sm(B.schnitz - 0.4, B.schnitz + 0.8, t) * (1 - sm(B.smoke - 0.6, B.smoke, t));
      for (const s of this.eyes) s.material.opacity = e * (0.85 + Math.sin(time * 9) * 0.1);
      cam.position.set(ERIK_LAND.x + 1.2, 1.0, ERIK_LAND.z + 3.6);
      cam.lookAt(ERIK_LAND.x - 0.1, 2.4 + sm(B.dark, B.smoke, t) * 0.9, ERIK_LAND.z - 1);
    }
    // --- The Vanishing Act
    else if (t < B.walk) {
      this.cue('smoke');
      if (this.erikSmoke < 1) {
        this.erikSmoke = 1;
        for (let i = 0; i < 26; i++) fx.puff(V(ERIK_LAND.x + (Math.random() - 0.5) * 2.4, 0.3 + Math.random() * 1.5, ERIK_LAND.z + (Math.random() - 0.5) * 2.4), { color: 0x0c0c0e, size: 1.6, grow: 2.2, life: 3 + Math.random() * 1.5, alpha: 0.95, vel: V((Math.random() - 0.5) * 1.5, 0.6 + Math.random(), (Math.random() - 0.5) * 1.5), smoke: true, shade: false });
      }
      for (const s of this.eyes) s.material.opacity = 0;
      if (t >= B.lightsBack) {
        map.blackout = false;
        this.cue('lightsBack');
        erik.root.visible = false;
        this.jersey.visible = this.scorch.visible = true;
      }
      for (const m of this.squad) { idleCharacter(m.k, time); aimPose(m.k, 1 - sm(B.lightsBack + 0.5, B.lightsBack + 1.5, t)); }
      // the doors swing open into the fog
      const open = sm(B.doors, B.doors + 1.4, t);
      if (t >= B.doors) this.cue('doors');
      for (const L of this.doors.leaves) L.hinge.rotation.y = L.s * open * 1.6;
      if (t < B.doors) { cam.position.set(ERIK_LAND.x - 2.2, 1.65, ERIK_LAND.z + 4.2); cam.lookAt(ERIK_LAND.x, 0.2, ERIK_LAND.z); }
      else {
        // cut to the far end of the gym: the doors, straight on
        cam.position.set(DOORS.x - 0.3, 1.7, DOORS.z - 6.5 - (t - B.doors) * 0.3);
        cam.lookAt(DOORS.x, 1.5, DOORS.z);
      }
    }
    // --- The Reveal: the squad walks out; there's no parking lot
    else if (t < B.space) {
      for (const L of this.doors.leaves) L.hinge.rotation.y = L.s * 1.6;
      const k = sm(B.walk, B.space, t);
      this.squad.forEach((m, i) => {
        // round the end of the bleachers, then out through the doors
        const via = V(DOORS.x + (i - 1.5) * 0.7, 0, 6.5), to = V(DOORS.x + (i - 1.5) * 0.7, 0, DOORS.z - 1.2);
        m.k.root.position.copy(k < 0.55 ? lerpV(m.ring, via, sm(0, 0.55, k)) : lerpV(via, to, sm(0.55, 1, k)));
        m.k.root.lookAt(DOORS.x, 0, DOORS.z + 3);
        idleCharacter(m.k, time);
      });
      cam.position.set(DOORS.x + 0.4, 1.75, DOORS.z - 8.5 + k * 4.5);
      cam.lookAt(DOORS.x, 1.4, DOORS.z + 4);
    }
    // --- out in space
    else if (t < B.black) {
      if (!this.space) { this.buildSpace(); this.cue('space'); }
      const S = this.space;
      // the squad on the cosmic stone just outside the doors
      this.squad.forEach((m, i) => {
        const w = sm(B.space, B.space + 2.5, t);
        m.k.root.position.set(DOORS.x - 1.2 + i * 0.8, 0, DOORS.z + 1.5 + w * 2.2);
        m.k.root.rotation.set(0, 0, 0);
        idleCharacter(m.k, time);
        aimPose(m.k, sm(B.brian, B.brian + 0.6, t) * 0.6);
      });
      if (t < B.pullback) {
        // over their shoulders: the stone, then nothing but space
        cam.position.set(DOORS.x - 0.2, 1.8, DOORS.z + 0.2);
        cam.lookAt(DOORS.x + 1, 1.0 + (t - B.space) * 0.4, DOORS.z + 30);
      } else if (t < B.portal) {
        // pull up and back: the whole campus, anchored to an asteroid
        const k = sm(B.pullback, B.portal, t);
        cam.position.copy(lerpV(V(DOORS.x - 0.2, 1.8, DOORS.z + 0.2), V(DOORS.x + 150, 38, DOORS.z + 175), k));
        cam.lookAt(lerpV(V(DOORS.x + 1, 2.4, DOORS.z + 30), V(5, -12, -28), k));
      } else {
        // the portal and Brian
        const k = sm(B.portal, B.portal + 1.2, t);
        cam.position.copy(lerpV(V(DOORS.x + 150, 38, DOORS.z + 175), V(DOORS.x + 3.4, 1.65, DOORS.z + 2.2), sm(B.portal - 0.2, B.portal + 0.6, t)));
        cam.lookAt(DOORS.x + 0.2, 1.5, 22.5);
        if (t >= B.portal) this.cue('portal');
        S.portal.material.opacity = k;
        S.ring.material.opacity = k;
        S.portal.scale.setScalar(0.2 + k * 0.8 + Math.sin(time * 20) * 0.02);
        S.portal.rotation.z = time * 2;
        S.plight.intensity = 25 * k;
        S.portal.lookAt(cam.position.x, 1.7, cam.position.z); S.ring.lookAt(cam.position.x, 1.7, cam.position.z);
        if (t >= B.brian) {
          const w = sm(B.brian, B.brian + 1.6, t);
          S.brian.root.visible = true;
          S.brian.root.position.set(DOORS.x + 0.5, 0, 24.6 - w * 3.4);
          S.brian.root.lookAt(cam.position.x, 0, cam.position.z);
          idleCharacter(S.brian, time);
        }
        if (t >= B.line) this.cue('brian');
      }
      return S.sc;
    }
    // --- slam to black (the overlay shows the title card)
    else {
      this.cue('black');
      if (t >= B.card) this.cue('card');
      return this.space ? this.space.sc : this.scene;
    }
    return this.scene;
  }

  dispose() {
    this.R.map.blackout = false;
    this.scene.remove(this.group);
    if (this.R.quest) this.R.quest.erikHeld = false;
  }
}

export const SCHNITZ_LINE = 'This season isn\'t over yet.';
export const BRIAN_LINE = 'You guys coming?';
export { CHARACTERS };
