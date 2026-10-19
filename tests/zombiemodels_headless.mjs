// The converted zombie models and clips (assets/zombies): every character has
// the bones the animations drive, glowing eyes, and its texture files.
// Run: node tests/zombiemodels_headless.mjs
import { readFileSync, existsSync } from 'node:fs';

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const dir = new URL('../assets/zombies/', import.meta.url);
const src = readFileSync(new URL('../src/render/zombieModels.js', import.meta.url), 'utf8');
const cast = [...src.matchAll(/\{ id: '(\w+)', weight/g)].map((m) => m[1]);
// (a map's own, Bikini Bottom's fish: cartoons, no glowing eyes, scaled to `tall` in the game)
const tall = Object.fromEntries([...src.matchAll(/\{ id: '(\w+)', weight: [\d.]+, map: '\w+', tall: (\d+)/g)].map((m) => [m[1], +m[2]]));
check(cast.length === 16 && Object.keys(tall).length === 4, `16 characters in the cast, 4 of them Bikini Bottom's (${cast.join(', ')})`);

const anims = JSON.parse(readFileSync(new URL('anims.json', dir)));
const names = anims.clips.map((c) => c.name);
for (const n of ['walk', 'walk2', 'reach', 'run', 'sprint', 'crawl', 'idle', 'attack', 'punch', 'hit1', 'hit2', 'death1', 'death2', 'deathBack', 'deathFly', 'deathFront']) check(names.includes(n), `clip ${n}`);
const abin = readFileSync(new URL('anims.bin', dir));
check(anims.clips.every((c) => c.tracks.every((t) => t.values + t.count * (t.type === 'q' ? 8 : 12) <= abin.length)), 'clip data fits in anims.bin');
for (const n of ['walk', 'walk2', 'run', 'sprint', 'crawl']) { const c = anims.clips.find((x) => x.name === n); check(c.meta.speed > 0, `${n} knows its foot speed (${c.meta.speed})`); }
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
  if (!tall[id]) check(m.meshes.some((me) => me.material.emissiveMap) && (m.eyesLocal || []).length === 2, `${id}: green glowing eyes (emissive map + 2 glow points)`);
  const h = tall[id] || m.height;
  check(Math.abs(m.hipsY - 100) < 1e-6 && h > 150 && h < 200, `${id}: normalized (hips 100, ${h} tall in the game)`);
  const tris = m.meshes.reduce((s, me) => s + me.indexCount / 3, 0);
  check(tris < 70000, `${id}: ${tris} triangles`);
}
process.exit(fails ? 1 : 0);
