// Bikini Bottom's crew (src/render/characters.js, CHARACTERS.spongebob and
// the rest): SpongeBob, Patrick, Squidward and Sandy, from downloaded models
// (Sketchfab, CC BY 4.0; credits in src/ui/extras.js), packed into one file,
// assets/bikinibottom/cast.glb, one node each by id. Each is posed as it was
// downloaded (any skin baked in), stood on y = 0 facing +z, centred, scaled to
// its height in metres, cut down in triangles and its textures shrunk.
//   node tools/bikinibottom/cast.mjs <spongebob.glb> <patrick.glb> <squidward.glb> <sandy.glb> <chum_bucket_helmet.glb>
//   (needs @gltf-transform/core, /functions, /extensions, meshoptimizer and sharp resolvable)
import { Document, NodeIO, getBounds } from '@gltf-transform/core';
import { flatten, clearNodeTransform, meshopt, prune, dedup, join, mergeDocuments, unpartition, weld, simplify, textureCompress, metalRough } from '@gltf-transform/functions';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { bakeSkins } from './skin.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const SRC = process.argv.slice(2);

// id, height (m), turn (radians about y, to face +z), dropped parts, triangles kept, texture size
const CAST = [
  { id: 'spongebob', height: 1.35, turn: 0, tex: 128 },
  { id: 'patrick', height: 1.75, turn: 0, keep: 0.4, tex: 512 },
  { id: 'squidward', height: 1.95, turn: 0, tex: 64 },
  // (the black outline shell round Sandy draws solid black in the game)
  { id: 'sandy', height: 1.75, turn: 0, drop: /^Body_6$/, keep: 0.25, tex: 512 },
  // the Chum Bucket helmet the bucket-headed zombies wear (src/render/zombieView.js):
  // 1 tall, open end down on y = 0, round the y axis (not centred on its bounds: the visor sticks out)
  { id: 'bucket', height: 1, turn: 0, keep: 0.03, error: 0.02, tex: 256, axis: true },
];

const out = new Document();
out.createBuffer();
out.createExtension(EXTTextureWebP);
const scene = out.createScene('cast');
for (let i = 0; i < CAST.length; i++) {
  const C = CAST[i], d = await io.read(SRC[i]), r = d.getRoot();
  for (const a of r.listAnimations()) a.dispose();
  // (Sandy's colours are in the old specular-glossiness kind of material; and nobody here is metal)
  await d.transform(metalRough());
  for (const m of r.listMaterials()) m.setMetallicFactor(0).setMetallicRoughnessTexture(null).setRoughnessFactor(0.8);
  bakeSkins(d);
  await d.transform(flatten());
  for (const n of r.listNodes()) if (n.getMesh()) { if (C.drop && C.drop.test(n.getName())) n.setMesh(null); else clearNodeTransform(n); }
  await d.transform(prune());
  // stand it up: feet on y = 0, centred, its height, turned to face +z
  const b = getBounds(r.listScenes()[0]);
  const s = C.height / (b.max[1] - b.min[1]), cx = C.axis ? 0 : (b.min[0] + b.max[0]) / 2, cz = C.axis ? 0 : (b.min[2] + b.max[2]) / 2;
  const q = [0, Math.sin(C.turn / 2), 0, Math.cos(C.turn / 2)];
  for (const n of r.listNodes()) if (n.getMesh()) {
    n.setTranslation([-cx * s, -b.min[1] * s, -cz * s]).setScale([s, s, s]); clearNodeTransform(n);
    n.setRotation(q); clearNodeTransform(n);
  }
  await d.transform(weld());
  if (C.keep) await d.transform(simplify({ simplifier: MeshoptSimplifier, ratio: C.keep, error: C.error || 0.004 }));
  await d.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [C.tex, C.tex], quality: 82 }));
  const map = mergeDocuments(out, d);
  const holder = out.createNode(C.id);
  for (const sc of r.listScenes()) { const s2 = map.get(sc); for (const n of s2.listChildren()) { s2.removeChild(n); holder.addChild(n); } s2.dispose(); }
  scene.addChild(holder);
}
out.getRoot().setDefaultScene(scene);
await MeshoptEncoder.ready;
await out.transform(unpartition(), prune(), dedup(), join({ keepNamed: false }), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(ROOT + 'assets/bikinibottom/cast.glb', out);
for (const h of scene.listChildren()) {
  let t = 0; h.traverse((n) => { const m = n.getMesh(); if (m) for (const p of m.listPrimitives()) t += p.getIndices().getCount() / 3; });
  console.log(h.getName(), 'tris', t);
}
