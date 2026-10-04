// Convert Mixamo animation FBXs into one compact clip pack:
//   <out>/anims.json  clips: name, duration, fps, tracks (bone, type, offset), meta
//   <out>/anims.bin   quaternions as int16 (x32767), hip positions as float32
// Hip positions are normalized to a 100-unit hip height (like the models).
// Locomotion loops lose their forward drift (the game moves the zombie) and
// record how fast the feet travel, so playback speed can match the sim.
import { loadFBX, THREE } from './fbxload.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const [inDir, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const norm = (n) => n.replace(/^mixamorig\d*:?/, '');

// name in the game <- file, and how to treat its root motion
const CLIPS = [
  ['walk', 'Zombie Walk', 'loop'],
  ['run', 'Zombie Running', 'loop'],
  ['sprint', 'Two Cycle Sprint', 'loop'],
  ['crawl', 'Zombie Crawl', 'loop'],
  ['idle', 'Zombie Idle', 'inplace'],
  ['attack', 'Zombie Attack', 'inplace'],
  ['punch', 'Zombie Punching', 'inplace'],
  ['hit1', 'Zombie Reaction Hit', 'inplace'],
  ['hit2', 'Zombie Reaction Hit (1)', 'inplace'],
  ['death1', 'Zombie Death', 'death'],
  ['death2', 'Zombie Dying', 'death'],
  ['deathBack', 'Falling Back Death', 'death'],
  ['deathFly', 'Flying Back Death', 'death'],
  ['deathFront', 'Death From The Front', 'death'],
];

const chunks = [];
let offset = 0;
const push = (typed) => { const pad = (4 - (offset % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; } const b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength); chunks.push(b); const at = offset; offset += b.length; return at; };
const clips = [];
for (const [name, file, kind] of CLIPS) {
  const g = loadFBX(`${inDir}/${file}.fbx`);
  g.updateMatrixWorld(true);
  let hips = null;
  g.traverse((o) => { if (!hips && o.isBone && norm(o.name) === 'Hips') hips = o; });
  const rest = new THREE.Vector3().setFromMatrixPosition(hips.matrixWorld).y;
  const k = 100 / rest;
  const clip = g.animations.find((a) => a.tracks.length > 0);
  const tracks = [];
  const meta = { kind, rigHips: +rest.toFixed(2) };
  for (const t of clip.tracks) {
    const [node, prop] = t.name.split('.');
    const bone = norm(node);
    if (prop === 'quaternion') {
      const q = new Int16Array(t.values.length);
      for (let i = 0; i < q.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, t.values[i])) * 32767);
      tracks.push({ bone, type: 'q', count: t.times.length, times: push(new Float32Array(t.times)), values: push(q) });
    } else if (prop === 'position' && bone === 'Hips') {
      const v = Float32Array.from(t.values, (x) => x * k);
      const n = t.times.length, T = t.times[n - 1] || 1;
      const x0 = v[0], z0 = v[2], x1 = v[(n - 1) * 3], z1 = v[(n - 1) * 3 + 2];
      meta.drift = [+(x1 - x0).toFixed(2), +(z1 - z0).toFixed(2)];
      meta.fall = [+(x1 - x0).toFixed(2), +(v[(n - 1) * 3 + 1]).toFixed(2), +(z1 - z0).toFixed(2)];
      if (kind === 'loop') {
        // feet speed (units per second, hips at 100), then remove the drift
        meta.speed = +(Math.hypot(x1 - x0, z1 - z0) / T).toFixed(2);
        for (let i = 0; i < n; i++) { const f = t.times[i] / T; v[i * 3] -= x0 + (x1 - x0) * f; v[i * 3 + 2] -= z0 + (z1 - z0) * f; }
      } else if (kind === 'inplace') {
        for (let i = 0; i < n; i++) { v[i * 3] -= x0; v[i * 3 + 2] -= z0; }
      } else {
        for (let i = 0; i < n; i++) { v[i * 3] -= x0; v[i * 3 + 2] -= z0; }
      }
      tracks.push({ bone, type: 'p', count: n, times: push(new Float32Array(t.times)), values: push(v) });
    }
  }
  clips.push({ name, file, duration: +clip.duration.toFixed(4), tracks, meta });
  console.log(name, clip.duration.toFixed(2), tracks.length, JSON.stringify(meta));
}
writeFileSync(`${outDir}/anims.bin`, Buffer.concat(chunks));
writeFileSync(`${outDir}/anims.json`, JSON.stringify({ clips }));
console.log('bin', offset);
