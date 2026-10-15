// Adds every Call of the Crust line that isn't in the recording script yet to
// tools/voice/script.csv (Pit's forge and power lines, the crew's, the boys in
// the cage, Zach, the Schnitz, and both cutscenes), named <speaker>_crust_NNN,
// so they can be recorded and imported with tools/voice/import.py like the rest.
// Lines already in the script keep their names (the script's frozen).
// Usage: node tools/voice/crust_script.mjs   (prints what it added)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from '../../src/config.js';
import { PIT_FORGE, PIT_POWER, ZACH_FINALE } from '../../src/lore/crew.js';
import * as L from '../../src/lore/crustCrew.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(ROOT, 'tools/voice/script.csv');
// the TTS voice each speaker was sent out with (new speakers get their own)
const VOICE = { kearns: 'am_puck', ryan: 'am_fenrir', pit: 'am_michael', rocco: 'am_liam', brian: 'am_adam', schnitz: 'bm_george', zach: 'am_eric', chops: 'bm_daniel', regs: 'am_santa', p: 'bm_fable' };

const lines = [];   // [who, text] in the order they come up
const add = (who, text) => { if (typeof text === 'string' && text.trim()) lines.push([who, text]); };
const each = (v, who) => {
  if (typeof v === 'string') add(who, v);
  else if (Array.isArray(v)) v.forEach((x) => each(x, who));
  else if (v && typeof v === 'object' && 'text' in v) add(v.who, v.text);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) each(x, VOICE[k] ? k : who);
};
// the cutscenes first, then the game in roughly the order it happens
for (const f of ['intro', 'ending']) for (const l of CONFIG.crustFilms[f].lines) add(l.who, l.text);
each(L.SCHNITZ_PA, 'schnitz');
each(PIT_FORGE, 'pit'); each(PIT_POWER, 'pit');
each(L.CRUST_TALKS); each(L.CRUST_BANTER); each(L.CAGE_TALK);
each(L.CRUST_REACT); each(L.CRUST_RADIO); each(L.CRUST_FELL);
each(L.SCHNITZ_ROASTS, 'schnitz'); each(L.ZACH_TAUNTS, 'schnitz');
// the finale: the Schnitz through Zach, then Zach himself
each(ZACH_FINALE.descend, 'schnitz'); each(ZACH_FINALE.phase, 'schnitz'); each(ZACH_FINALE.freed, 'schnitz'); each(ZACH_FINALE.zach, 'zach');

// what's in the script already
const csv = fs.readFileSync(SCRIPT, 'utf8');
const parse = (s) => {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
};
const rows = parse(csv).slice(1);
const have = new Set(rows.map((r) => r[2].split('_')[0] + '|' + r[0]));
const used = new Set(rows.map((r) => r[2]));
const next = {};
const esc = (t) => (/[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t);
const out = [];
for (const [who, text] of lines) {
  if (!VOICE[who] || have.has(who + '|' + text)) continue;
  have.add(who + '|' + text);
  let name;
  do { next[who] = (next[who] || 0) + 1; name = `${who}_crust_${String(next[who]).padStart(3, '0')}`; } while (used.has(name));
  used.add(name);
  out.push(`${esc(text)},${VOICE[who]},${name}`);
}
if (out.length) fs.writeFileSync(SCRIPT, csv.replace(/\n?$/, '\n') + out.join('\n') + '\n');
const by = {};
for (const r of out) { const w = r.slice(r.lastIndexOf(',') + 1).split('_')[0]; by[w] = (by[w] || 0) + 1; }
console.log(`added ${out.length} lines to tools/voice/script.csv`, by);
