// Packs the recorded gun sounds (sfx-src/guns/*.mp3, as they are, byte for byte)
// into one file the game downloads once: assets/sfx/guns_pack.mp3. (The
// claude.ai artifact can only hold so many files; this is 80 of them in one.)
// Layout: 4 bytes (little-endian) = length of a JSON header, the header
// { "name": [offset, length], ... } (offsets after the header), then the mp3s.
// The game cuts it back up (src/audio/audio.js preloadPack).
// Usage: node tools/pack-sounds.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'sfx-src/guns');
const out = path.join(root, 'assets/sfx/guns_pack.mp3');
const files = fs.readdirSync(src).filter((f) => f.endsWith('.mp3')).sort();
const index = {}, parts = [];
let off = 0;
for (const f of files) {
  const b = fs.readFileSync(path.join(src, f));
  index[f.replace(/\.mp3$/, '')] = [off, b.length];
  parts.push(b); off += b.length;
}
const head = Buffer.from(JSON.stringify(index));
const len = Buffer.alloc(4); len.writeUInt32LE(head.length, 0);
fs.writeFileSync(out, Buffer.concat([len, head, ...parts]));
console.log('packed', files.length, 'sounds,', off, 'bytes ->', path.relative(root, out));
