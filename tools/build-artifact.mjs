// Builds a page fragment for publishing as a hosted claude.ai artifact.
// (The artifact host adds its own <html>/<head>/<body> skeleton.)
// Usage: node tools/build-artifact.mjs  -> dist/artifact.html + dist/files.json
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pick = (re) => (html.match(re) || [''])[0];
const title = pick(/<title>[\s\S]*?<\/title>/);
const style = pick(/<style>[\s\S]*?<\/style>/);
const importmap = pick(/<script type="importmap">[\s\S]*?<\/script>/);
const body = (html.match(/<body>([\s\S]*)<\/body>/) || ['', ''])[1];
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/artifact.html'), [title, style, importmap, body].join('\n'));

const files = {};
const walk = (d) => {
  for (const f of fs.readdirSync(path.join(root, d))) {
    const rel = path.join(d, f);
    if (fs.statSync(path.join(root, rel)).isDirectory()) walk(rel);
    else if (rel.endsWith('.js')) files[rel] = rel;
  }
};
walk('src');
fs.writeFileSync(path.join(root, 'dist/files.json'), JSON.stringify(files, null, 2));
console.log('wrote dist/artifact.html and', Object.keys(files).length, 'files');
