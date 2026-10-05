// Every Erik line in the game has a recording, every recording is on disk, and
// the PA uses the recorded length.
import fs from 'node:fs';
import { PA_LINES, INTERCOM, INTERCOM_REPEAT } from '../src/lore/erik.js';
import { ERIK_ROASTS, TALKS, BANTER, REACT, RADIO } from '../src/lore/crew.js';
import { VOICE_LINES } from '../src/lore/voiceLines.js';
import { recording, voiceSprites } from '../src/lore/voice.js';

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
// the crew: every recording matches a line they really say
const crew = {};
const say = (who, t) => (crew[who] ||= new Set()).add(t);
for (const by of Object.values(REACT)) for (const [who, list] of Object.entries(by)) list.forEach((t) => say(who, t));
for (const list of Object.values(RADIO)) for (const l of list) say(l.who, l.text);
for (const list of Object.values(TALKS)) for (const l of list) say(l.who, l.text);
for (const conv of BANTER) for (const l of conv) say(l.who, l.text);
for (const m of intro.matchAll(/who: '(\w+)', text: '((?:[^'\\]|\\.)*)'/g)) say(m[1], m[2].replace(/\\'/g, "'"));
for (const who of ['kearns', 'ryan', 'pit', 'rocco', 'brian']) { INTERCOM.forEach((x) => say(who, x.stew)); say(who, 'Erik? Hello?'); }
for (const [who, by] of Object.entries(VOICE_LINES)) {
  if (who === 'erik') continue;
  for (const t of Object.keys(by)) check(crew[who] && crew[who].has(t), `${who} recording not used in the game: ${t}`);
  const all = crew[who] ? [...crew[who]] : [];
  const missing = all.filter((t) => !by[t]);
  console.log(`voice: ${who} ${Object.keys(by).length}/${all.length} lines recorded` + (missing.length ? ` (still synth: ${missing.map((t) => JSON.stringify(t)).join(', ')})` : ''));
}
const sprites = voiceSprites();
let nrec = 0;
for (const { url, segs } of sprites) {
  check(fs.existsSync(new URL('../' + url, import.meta.url)), 'missing sprite ' + url);
  const list = Object.values(segs).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < list.length; i++) check(list[i][0] - (list[i - 1][0] + list[i - 1][1]) >= 0.3, url + ' lines too close together');
  nrec += list.length;
}
for (const [who, by] of Object.entries(VOICE_LINES)) for (const [t, [f, d]] of Object.entries(by)) check(d > 0.3 && d < 12, `odd length ${f} ${d}`);
console.log(`voice: ${erik.length} Erik lines checked, ${nrec} recordings`);
if (fail) { console.error(fail, 'failures'); process.exit(1); }
console.log('voice OK');
