// Every source file parses (the headless tests only load the simulation, so a
// typo in a UI or render file would otherwise only show up as a blank page).
// Run: node tests/syntax_headless.mjs
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
walk('src');
let bad = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { bad++; console.log('FAIL ' + f + '\n' + String(e.stderr).split('\n').slice(0, 5).join('\n')); }
}
console.log(bad ? `\n${bad} FAILED` : `ok   all ${files.length} source files parse\n\nall passed`);
process.exit(bad ? 1 : 0);
