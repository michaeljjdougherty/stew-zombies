// The D-pad on the HUD: what sits on each direction, and the LBD on D-pad right.
// Run: node tests/dpad_headless.mjs
import fs from 'fs';
import { CONFIG } from '../src/config.js';
import { dpadSlots } from '../src/ui/dpad.js';
import { LABELS } from '../src/input/glyphs.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

// no LBDs: nothing on the right, the emote wheel always on top
let S = dpadSlots({ lbds: 0, lbdMax: 0, gum: null }, CONFIG);
ok(!S.right && !S.down && !S.left, 'no gear: right, down and left are empty');
ok(S.up && S.up.kind === 'emote', 'the emote wheel sits on D-pad up');

// LBDs: on the right with the count
S = dpadSlots({ lbds: 2, lbdMax: 2 }, CONFIG);
ok(S.right && S.right.kind === 'lbd' && S.right.count === 2, 'LBDs show on D-pad right with their count (2)');
S = dpadSlots({ lbds: 0, lbdMax: 2 }, CONFIG);
ok(S.right && S.right.count === 0, 'used up this round: still shown, at 0');

// an activated gum shows on the bottom; other kinds don't (the button does nothing for them)
const act = Object.entries(CONFIG.gobblegum.gums).find(([, d]) => d.kind === 'activated');
const other = Object.entries(CONFIG.gobblegum.gums).find(([, d]) => d.kind !== 'activated');
S = dpadSlots({ gum: { id: act[0], kind: 'activated', uses: 3 } }, CONFIG);
ok(S.down && S.down.kind === 'gum' && S.down.id === act[0] && S.down.count === 3 && !S.down.on, `an activated gum (${act[1].name}) shows on D-pad down with its uses`);
S = dpadSlots({ gum: { id: act[0], kind: 'activated', uses: 2, on: true, onUntil: 10 } }, CONFIG);
ok(S.down && S.down.on, 'while it\'s going off it\'s marked on');
S = dpadSlots({ gum: { id: other[0], kind: other[1].kind } }, CONFIG);
ok(!S.down, `a ${other[1].kind} gum (${other[1].name}) leaves D-pad down empty`);

// the controls: the LBD moved to D-pad right
const src = fs.readFileSync('src/input/input.js', 'utf8');
ok(/BTN\.RIGHT\)\) this\.edges\.add\('mine'\)/.test(src), 'D-pad right sets down an LBD');
ok(!/BTN\.LEFT\)\) this\.edges\.add\('mine'\)/.test(src), 'D-pad left no longer does');
ok(LABELS.xbox.mine === 'D-pad →' && LABELS.ps.mine === 'D-pad →' && LABELS.kbm.mine === 'X', 'button prompts: D-pad → on a pad, X on keyboard');
ok(LABELS.kbm.emote === 'B' && LABELS.kbm.gum === 'H', 'keyboard badges: B for emotes, H for the gum');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
