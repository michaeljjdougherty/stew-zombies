// Bikini Bottom's zombies (src/render/zombieModels.js, ZOMBIE_CAST map
// 'bikinibottom'): four fish from Sketchfab (CC BY 4.0, except Incidental 70's
// CC BY-NC 4.0; credits in src/ui/extras.js), through the zombie converter in
// tools/zombies/ (the three Mixamo-rigged fish as they are; the nerd fish rigged
// first by autorig.mjs). Then, to keep the file count down: no normal maps
// (they're cartoons), and a texture that's one flat colour becomes that colour.
//   node tools/bikinibottom/zombies.mjs <male_fish.glb> <nerd_2.glb> <incidental_90.glb> <incidental_70.glb> <work dir>
//   (needs tools/zombies' requirements: three, @gltf-transform, Python with Pillow and NumPy)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url).pathname, Z = ROOT + 'tools/zombies/';
const [male, nerd, f90, f70, work] = process.argv.slice(2);
const MODELS = work + '/models', PNG = work + '/png';
mkdirSync(MODELS, { recursive: true });
const run = (cmd, args) => console.log(execFileSync(cmd, args, { cwd: Z, encoding: 'utf8', maxBuffer: 1 << 26 }).trim().split('\n').pop());
run('node', ['autorig.mjs', nerd, work + '/nerd_rig.glb', ROOT + 'assets/zombies/ch10.json', '182']);
const SRC = { bbmale: male, bbnerd: work + '/nerd_rig.glb', bbfish90: f90, bbfish70: f70 };
for (const [id, src] of Object.entries(SRC)) run('node', ['--max-old-space-size=8000', 'conv_char.mjs', src, id, MODELS, PNG, '']);
run('python3', ['tex.py', MODELS, PNG, ...Object.keys(SRC)]);

// one flat colour? (the mean, if nothing strays far from it)
const flat = (file) => {
  const out = execFileSync('python3', ['-c', `
from PIL import Image; import numpy as np, sys
a = np.asarray(Image.open(sys.argv[1]).convert('RGB'), np.float32).reshape(-1, 3)
print('flat' if a.std(0).max() < 4 else 'tex', *[int(v) for v in a.mean(0)])`, file], { encoding: 'utf8' }).trim().split(' ');
  return out[0] === 'flat' ? '#' + out.slice(1).map((v) => (+v).toString(16).padStart(2, '0')).join('') : null;
};
for (const id of Object.keys(SRC)) {
  const j = JSON.parse(readFileSync(`${MODELS}/${id}.json`, 'utf8'));
  for (const m of j.meshes) {
    const M = m.material;
    M.normalMap = null;
    const c = M.map && flat(`${MODELS}/${M.map}`);
    if (c) { M.color = c; M.map = null; }
  }
  writeFileSync(`${ROOT}assets/zombies/${id}.json`, JSON.stringify(j));
  copyFileSync(`${MODELS}/${id}.bin`, `${ROOT}assets/zombies/${id}.bin`);
  const files = [...new Set(j.meshes.map((m) => m.material.map).filter(Boolean))];
  for (const f of files) copyFileSync(`${MODELS}/${f}`, `${ROOT}assets/zombies/${f}`);
  console.log(id, 'height', j.height.toFixed(0), 'files', 2 + files.length, files.join(' '));
}
