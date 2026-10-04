// The converted zombie models and clips (assets/zombies): every character has
// the bones the animations drive, glowing eyes, and its texture files.
// Run: node tests/zombiemodels_headless.mjs
import { readFileSync, existsSync } from 'node:fs';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dir = new URL('../assets/zombies/', import.meta.url);
const src = readFileSync(new URL('../src/render/zombieModels.js', import.meta.url), 'utf8');
const cast = [...src.matchAll(/\{ id: '(\w+)', weight/g)].map((m) => m[1]);
check(cast.length === 8, `8 characters in the cast (${cast.join(', ')})`);

const anims = JSON.parse(readFileSync(new URL('anims.json', dir)));
const names = anims.clips.map((c) => c.name);
for (const n of ['walk', 'run', 'sprint', 'crawl', 'idle', 'attack', 'punch', 'hit1', 'hit2', 'death1', 'death2', 'deathBack', 'deathFly', 'deathFront']) check(names.includes(n), `clip ${n}`);
const abin = readFileSync(new URL('anims.bin', dir));
check(anims.clips.every((c) => c.tracks.every((t) => t.values + t.count * (t.type === 'q' ? 8 : 12) <= abin.length)), 'clip data fits in anims.bin');
for (const n of ['walk', 'run', 'sprint', 'crawl']) { const c = anims.clips.find((x) => x.name === n); check(c.meta.speed > 0, `${n} knows its foot speed (${c.meta.speed})`); }
const core = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];
const animBones = new Set(anims.clips.flatMap((c) => c.tracks.map((t) => t.bone)).filter((b) => !/Hand(Thumb|Index|Middle|Ring|Pinky)/.test(b)));

for (const id of cast) {
  const m = JSON.parse(readFileSync(new URL(`${id}.json`, dir)));
  const bin = readFileSync(new URL(`${id}.bin`, dir));
  const bones = new Set(m.bones.map((b) => b.name));
  check(core.every((b) => bones.has(b)), `${id}: has the core bones`);
  const missing = [...animBones].filter((b) => !bones.has(b));
  check(missing.length === 0, `${id}: every animated body bone is there${missing.length ? ' (missing ' + missing.join(',') + ')' : ''}`);
  check(m.meshes.every((me) => me.index + me.indexCount * (me.index32 ? 4 : 2) <= bin.length && me.sw + me.vertexCount * 4 <= bin.length), `${id}: mesh data fits in ${id}.bin`);
  const tex = m.meshes.flatMap((me) => [me.material.map, me.material.normalMap, me.material.emissiveMap]).filter(Boolean);
  check(tex.every((t) => existsSync(new URL(t, dir))), `${id}: all ${new Set(tex).size} textures exist`);
  check(m.meshes.some((me) => me.material.emissiveMap) && (m.eyesLocal || []).length === 2, `${id}: green glowing eyes (emissive map + 2 glow points)`);
  check(Math.abs(m.hipsY - 100) < 1e-6 && m.height > 150 && m.height < 200, `${id}: normalized (hips 100, ${m.height} tall)`);
  const tris = m.meshes.reduce((s, me) => s + me.indexCount / 3, 0);
  check(tris < 70000, `${id}: ${tris} triangles`);
}
process.exit(fails ? 1 : 0);
