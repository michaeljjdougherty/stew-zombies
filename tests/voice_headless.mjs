// Every Erik line in the game has a recording, every recording is on disk, and
// the PA uses the recorded length.
import fs from 'node:fs';
import { PA_LINES, INTERCOM, INTERCOM_REPEAT } from '../src/lore/erik.js';
import { ERIK_ROASTS, TALKS, BANTER } from '../src/lore/crew.js';
import { VOICE_LINES } from '../src/lore/voiceLines.js';
import { recording, voiceManifest, VOICE_BASE } from '../src/lore/voice.js';

let fail = 0;
const check = (ok, msg) => { if (!ok) { fail++; console.error('FAIL', msg); } };
const erik = [];
for (const list of Object.values(PA_LINES)) erik.push(...(Array.isArray(list) ? list : Object.values(list)));
for (const list of Object.values(ERIK_ROASTS)) erik.push(...list);
for (const x of INTERCOM) erik.push(x.erik);
erik.push(...INTERCOM_REPEAT);
for (const list of Object.values(TALKS)) for (const l of list) if (l.who === 'erik') erik.push(l.text);
for (const conv of BANTER) for (const l of conv) if (l.who === 'erik') erik.push(l.text);
const intro = fs.readFileSync(new URL('../src/render/intro.js', import.meta.url), 'utf8');
for (const m of intro.matchAll(/who: '(erik|erikPA)', text: '((?:[^'\\]|\\.)*)'/g)) erik.push(m[2].replace(/\\'/g, "'"));
for (const t of Object.keys(VOICE_LINES.erik)) check(erik.includes(t), 'recording not used in the game: ' + t);
for (const t of erik) check(recording('erik', t), 'no recording for Erik line: ' + t);
const m = voiceManifest();
for (const [key, [path]] of Object.entries(m)) check(fs.existsSync(new URL('../' + VOICE_BASE + path + '.mp3', import.meta.url)), 'missing file ' + path);
for (const [who, by] of Object.entries(VOICE_LINES)) for (const [t, [f, d]] of Object.entries(by)) check(d > 0.3 && d < 12, `odd length ${f} ${d}`);
console.log(`voice: ${erik.length} Erik lines checked, ${Object.keys(m).length} recordings`);
if (fail) { console.error(fail, 'failures'); process.exit(1); }
console.log('voice OK');
