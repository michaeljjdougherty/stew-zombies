// =============================================================================
// Rigged zombie models (Mixamo characters and animations, converted by
// tools/zombies/ into a compact format in assets/zombies/):
//   <id>.json + <id>.bin   skeleton, quantized skinned meshes, materials
//   <id>_*.webp            textures (the ordinary people were zombified,
//                          and every zombie's eyes glow green)
//   anims.json + anims.bin the shared clips (walk, run, sprint, crawl, idle,
//                          attack, punch, hit reactions, five deaths)
//
// The models load in the background; until they arrive (or if they can't),
// the procedural zombies are drawn instead.
// =============================================================================
import * as THREE from 'three';

const BASE = 'assets/zombies/';

// which characters, and how often they turn up
export const ZOMBIE_CAST = [
  { id: 'ch10', weight: 1.2 },
  { id: 'cop', weight: 1 },
  { id: 'girl', weight: 1 },
  { id: 'yaku', weight: 1 },
  { id: 'ch01', weight: 1 },
  { id: 'ch22', weight: 1 },
  { id: 'ch31', weight: 1 },
  { id: 'remy', weight: 1 },
];

// bones the hit reactions are allowed to move (so they don't slide the legs)
const UPPER = /^(Spine|Spine1|Spine2|Neck|Head|LeftShoulder|RightShoulder|LeftArm|RightArm|LeftForeArm|RightForeArm|LeftHand|RightHand)$/;

// the binary half; hosts that won't serve .bin files get a base64 copy (.bin.json)
async function fetchBin(name) {
  try {
    const r = await fetch(BASE + name + '.bin');
    if (r.ok) return await r.arrayBuffer();
  } catch { /* try the other form */ }
  const r = await fetch(BASE + name + '.bin.json');
  if (!r.ok) throw new Error(name + '.bin ' + r.status);
  const s = atob((await r.json()).b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}

async function fetchPair(name) {
  const [j, b] = await Promise.all([
    fetch(BASE + name + '.json').then((r) => { if (!r.ok) throw new Error(name + '.json ' + r.status); return r.json(); }),
    fetchBin(name),
  ]);
  return [j, b];
}

function loadTexture(file, srgb) {
  return new Promise((res) => {
    new THREE.TextureLoader().load(BASE + file, (t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.flipY = true;
      t.anisotropy = 4;
      res(t);
    }, undefined, () => res(null));
  });
}

// --- one character: shared geometry and materials, cloned per zombie --------
class Template {
  constructor(meta, bin, textures) {
    this.meta = meta;
    this.id = meta.id;
    this.bones = meta.bones;
    const inv = new Float32Array(bin, meta.inverses, meta.bones.length * 16);
    this.inverses = meta.bones.map((_, i) => new THREE.Matrix4().fromArray(inv, i * 16));
    this.parts = meta.meshes.map((m) => {
      const g = new THREE.BufferGeometry();
      const vc = m.vertexCount;
      const qp = new Int16Array(bin, m.pos, vc * 3);
      const pos = new Float32Array(vc * 3);
      for (let i = 0; i < vc; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = m.min[k] + ((qp[i * 3 + k] + 32768) / 65535) * (m.max[k] - m.min[k]);
      const qn = new Int8Array(bin, m.nrm, vc * 4);
      const nrm = new Float32Array(vc * 3);
      for (let i = 0; i < vc; i++) for (let k = 0; k < 3; k++) nrm[i * 3 + k] = qn[i * 4 + k] / 127;
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(bin, m.uv, vc * 2), 2));
      g.setAttribute('skinIndex', new THREE.Uint8BufferAttribute(new Uint8Array(bin, m.si, vc * 4), 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(bin, m.sw, vc * 4), 4, true));
      g.setIndex(new THREE.BufferAttribute(m.index32 ? new Uint32Array(bin, m.index, m.indexCount) : new Uint16Array(bin, m.index, m.indexCount), 1));
      g.computeBoundingSphere();
      const mm = m.material;
      const mat = new THREE.MeshStandardMaterial({
        map: textures[mm.map] || null,
        normalMap: textures[mm.normalMap] || null,
        roughness: 0.82, metalness: 0,
        alphaTest: mm.alpha ? 0.45 : 0,
        side: mm.alpha ? THREE.DoubleSide : THREE.FrontSide,
      });
      if (mat.normalMap) mat.normalScale.set(0.8, 0.8);
      if (mm.emissiveMap && textures[mm.emissiveMap]) {
        // the eyes: green, bright enough to bloom
        mat.emissiveMap = textures[mm.emissiveMap];
        mat.emissive = new THREE.Color(0.22, 1.0, 0.16);
        mat.emissiveIntensity = 1.5;
      }
      return { geometry: g, material: mat };
    });
    this.headIndex = meta.bones.findIndex((b) => b.name === 'Head');
  }

  // A fresh skeleton and skinned meshes sharing this template's geometry.
  instance() {
    const bones = this.bones.map((b) => {
      const bone = new THREE.Bone();
      bone.name = b.name;
      bone.position.fromArray(b.pos);
      bone.quaternion.fromArray(b.quat);
      if (b.scl) bone.scale.fromArray(b.scl);
      return bone;
    });
    const root = new THREE.Group();
    const model = new THREE.Group();     // in hip-100 units; scaled to metres by the view
    root.add(model);
    this.bones.forEach((b, i) => { if (b.parent >= 0) bones[b.parent].add(bones[i]); else model.add(bones[i]); });
    const skeleton = new THREE.Skeleton(bones, this.inverses);
    const meshes = this.parts.map((p) => {
      const m = new THREE.SkinnedMesh(p.geometry, p.material);
      m.bind(skeleton, new THREE.Matrix4());
      m.frustumCulled = false;     // the bounds don't follow the animation
      model.add(m);
      return m;
    });
    const byName = Object.fromEntries(bones.map((b) => [b.name, b]));
    return { root, model, bones: byName, skeleton, meshes, template: this };
  }

  // where the eyes are, relative to the Head bone (for the glow sprites)
  get eyes() { return this.meta.eyes || []; }
}

// --- the shared clips ----------------------------------------------------------
function buildClips(meta, bin) {
  const clips = {};
  for (const c of meta.clips) {
    const tracks = [];
    for (const t of c.tracks) {
      const times = new Float32Array(bin, t.times, t.count);
      if (t.type === 'q') {
        const q = new Int16Array(bin, t.values, t.count * 4);
        tracks.push(new THREE.QuaternionKeyframeTrack(`${t.bone}.quaternion`, times, Float32Array.from(q, (x) => x / 32767)));
      } else {
        tracks.push(new THREE.VectorKeyframeTrack(`${t.bone}.position`, times, new Float32Array(bin, t.values, t.count * 3)));
      }
    }
    const clip = new THREE.AnimationClip(c.name, c.duration, tracks);
    clip.meta = c.meta;
    clips[c.name] = clip;
    if (/^hit/.test(c.name)) {
      // upper body only, so a flinch doesn't slide the feet
      const up = new THREE.AnimationClip(c.name + 'Upper', c.duration, tracks.filter((tr) => UPPER.test(tr.name.split('.')[0])));
      up.meta = c.meta;
      clips[up.name] = up;
    }
  }
  return clips;
}

export class ZombieModelLib {
  constructor() {
    this.templates = [];
    this.clips = null;
    this.ready = false;
    this.failed = false;
    this.promise = null;
  }

  load() {
    if (this.promise) return this.promise;
    this.promise = (async () => {
      try {
        const [am, ab] = await fetchPair('anims');
        this.clips = buildClips(am, ab);
        const loaded = await Promise.all(ZOMBIE_CAST.map(async (c) => {
          try {
            const [meta, bin] = await fetchPair(c.id);
            const files = [...new Set(meta.meshes.flatMap((m) => [m.material.map, m.material.normalMap, m.material.emissiveMap]).filter(Boolean))];
            const tex = {};
            await Promise.all(files.map(async (f) => { tex[f] = await loadTexture(f, !/_n\d/.test(f)); }));
            const t = new Template(meta, bin, tex);
            t.weight = c.weight;
            return t;
          } catch (e) { console.warn('zombie model', c.id, e.message); return null; }
        }));
        this.templates = loaded.filter(Boolean);
        this.ready = this.templates.length > 0;
        if (!this.ready) this.failed = true;
      } catch (e) {
        console.warn('zombie models unavailable:', e.message);
        this.failed = true;
      }
      return this;
    })();
    return this.promise;
  }

  // the clips, minus tracks for bones this character doesn't have (cached)
  clipsFor(t) {
    if (t.clips) return t.clips;
    const have = new Set(t.bones.map((b) => b.name));
    t.clips = {};
    for (const [name, c] of Object.entries(this.clips)) {
      const clip = new THREE.AnimationClip(name, c.duration, c.tracks.filter((tr) => have.has(tr.name.split('.')[0])));
      clip.meta = c.meta;
      t.clips[name] = clip;
    }
    return t.clips;
  }

  // a character for this zombie (r = 0..1, from its seed)
  pick(r) {
    const total = this.templates.reduce((s, t) => s + t.weight, 0);
    let x = r * total;
    for (const t of this.templates) { x -= t.weight; if (x <= 0) return t; }
    return this.templates[this.templates.length - 1];
  }
}

export const zombieModels = new ZombieModelLib();
