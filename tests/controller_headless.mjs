// Controller headless test: gamepad -> commands, button prompts.
// Run: node tests/controller_headless.mjs
const listeners = {};
globalThis.window = { addEventListener: (t, f) => { (listeners[t] ||= []).push(f); } };
globalThis.document = { addEventListener() {}, pointerLockElement: null };
const pads = [];
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true });

const { CONFIG } = await import('../src/config.js');
const { Input } = await import('../src/input/input.js');
const { Pads, BTN, padType } = await import('../src/input/gamepad.js');
const G = await import('../src/input/glyphs.js');
const { DEFAULT_SETTINGS } = await import('../src/ui/settings.js');
const { GameSim } = await import('../src/sim/sim.js');
const { SCHOOL } = await import('../src/map/school.js');

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };

// a fake standard-mapping pad
const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', index: 0, connected: true, mapping: 'standard',
  axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
pads[0] = pad;
const press = (i, on = true) => { pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; };

check(padType(pad.id) === 'xbox', 'Xbox pad detected');
check(padType('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)') === 'ps', 'DualSense detected');
check(padType('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)') === 'ps', 'DualShock 4 detected');

const settings = { ...DEFAULT_SETTINGS };
const canvas = { addEventListener() {}, requestPointerLock() {} };
const input = new Input(canvas, CONFIG, settings);
input.enabled = true;
const P = new Pads();
const frame = (dt = 1 / 60) => { const st = P.poll(); input.padFrame(st, dt); return st; };

// stick dead zone
pad.axes = [0.1, -0.12, 0.08, 0.05];
frame();
let c = input.buildCommand();
check(c.moveX === 0 && c.moveY === 0, 'small stick drift is ignored');
check(!P.active, 'drift does not count as using the pad');

// move forward + strafe
pad.axes = [0.6, -0.8, 0, 0];
frame(); c = input.buildCommand();
check(c.moveY > 0.7 && c.moveX > 0.4, `left stick moves (x ${c.moveX.toFixed(2)}, y ${c.moveY.toFixed(2)})`);
check(P.active, 'stick counts as using the pad');

// sprint toggle with L3, cancelled when you stop pushing forward
press(BTN.LS); frame(); press(BTN.LS, false);
c = input.buildCommand();
check(c.sprint, 'L3 starts sprinting');
pad.axes = [0, 0, 0, 0]; frame(); c = input.buildCommand();
check(!c.sprint, 'letting go of the stick stops the sprint');

// look
const y0 = input.yaw;
pad.axes = [0, 0, 1, 0];
for (let i = 0; i < 30; i++) frame();
const turned = y0 - input.yaw;
check(turned > 0.8 && turned < 2.5, `right stick turns right (${turned.toFixed(2)} rad in 0.5s)`);
pad.axes = [0, 0, 0, -1];
const p0 = input.pitch; for (let i = 0; i < 10; i++) frame();
check(input.pitch > p0, 'pushing up looks up');
settings.invertY = true; const p1 = input.pitch; for (let i = 0; i < 10; i++) frame(); settings.invertY = false;
check(input.pitch < p1, 'invert Y flips it');
pad.axes = [0, 0, 0, 0]; frame();

// triggers
pad.buttons[BTN.RT] = { pressed: true, value: 0.9 }; pad.buttons[BTN.LT] = { pressed: true, value: 0.8 };
frame(); c = input.buildCommand();
check(c.fire && c.firePressed && c.ads && c.adsPressed, 'RT fires, LT aims (with press edges)');
frame(); c = input.buildCommand();
check(c.fire && !c.firePressed, 'holding RT: no repeat press');
press(BTN.RT, false); press(BTN.LT, false); frame(); c = input.buildCommand();
check(!c.fire && !c.ads, 'releasing triggers');

// X: reload when nothing to buy, use when there is
press(BTN.X); frame(); c = input.buildCommand();
check(c.reloadPressed && !c.usePressed, 'X reloads with nothing around');
press(BTN.X, false); frame(); input.buildCommand();
input.hasPrompt = () => true;
press(BTN.X); frame(); c = input.buildCommand();
check(c.usePressed && c.use && !c.reloadPressed, 'X buys when there is a prompt');
frame(); c = input.buildCommand();
check(c.use, 'holding X keeps using (rebuild / revive)');
press(BTN.X, false); frame(); c = input.buildCommand();
check(!c.use, 'letting go of X');
input.hasPrompt = () => false;

// face buttons, bumpers, sticks
press(BTN.A); frame(); c = input.buildCommand(); press(BTN.A, false); frame();
check(c.jumpPressed, 'A jumps');
press(BTN.B); frame(); press(BTN.B, false); frame(); c = input.buildCommand();
check(c.crouch, 'B toggles crouch on');
press(BTN.B); frame(); press(BTN.B, false); frame(); c = input.buildCommand();
check(!c.crouch, 'B toggles crouch off');
press(BTN.Y); frame(); c = input.buildCommand(); press(BTN.Y, false); frame();
check(c.weaponCycle !== 0, 'Y switches weapons');
press(BTN.RS); frame(); c = input.buildCommand(); press(BTN.RS, false); frame();
check(c.meleePressed, 'R3 knifes');
press(BTN.RB); frame(); c = input.buildCommand();
check(c.grenadePressed && c.grenade, 'RB throws a grenade (hold to cook)');
press(BTN.RB, false); frame(); c = input.buildCommand();
check(!c.grenade, 'releasing RB lets it go');
press(BTN.LB); frame(); c = input.buildCommand(); press(BTN.LB, false); frame(); input.buildCommand();
check(c.tacticalPressed, 'LB throws a Stew Bomb');

// aim assist slows the look over a target
input.assist = () => ({ yaw: input.yaw, pitch: input.pitch, angle: 0.005, radius: 0.03 });
pad.axes = [0, 0, 0.6, 0];
let ya = input.yaw; for (let i = 0; i < 20; i++) frame(); const slow = ya - input.yaw;
input.assist = () => null;
ya = input.yaw; for (let i = 0; i < 20; i++) frame(); const fast = ya - input.yaw;
check(slow < fast * 0.75, `aim assist slows the stick over a zombie (${slow.toFixed(3)} vs ${fast.toFixed(3)})`);
settings.aimAssist = false;
input.assist = () => ({ yaw: input.yaw, pitch: input.pitch, angle: 0.005, radius: 0.03 });
ya = input.yaw; for (let i = 0; i < 20; i++) frame(); const off = ya - input.yaw;
check(Math.abs(off - fast) < 1e-6, 'aim assist off: no slowdown');
settings.aimAssist = true; input.assist = () => null;
pad.axes = [0, 0, 0, 0]; frame();

// ADS snap
input.setLook(0, 0);
input.assist = () => ({ yaw: 0.06, pitch: 0.02, angle: 0.063, radius: 0.03 });
pad.buttons[BTN.LT] = { pressed: true, value: 1 };
for (let i = 0; i < 20; i++) frame();
check(Math.abs(input.yaw - 0.06) < 0.02 && input.pitch > 0.01, `aiming snaps onto a nearby zombie (yaw ${input.yaw.toFixed(3)})`);
press(BTN.LT, false); input.assist = () => null; frame(); input.buildCommand();

// keyboard still wins / mixes
input.keys.add('forward'); pad.axes = [0, 0.9, 0, 0]; frame(); c = input.buildCommand();
check(c.moveY === 1, 'keyboard movement takes priority over the stick');
input.keys.clear(); pad.axes = [0, 0, 0, 0]; frame();

// disconnect clears everything
pad.axes = [0, -1, 0, 0]; pad.buttons[BTN.RT] = { pressed: true, value: 1 }; frame();
pads[0] = null; frame(); c = input.buildCommand();
check(!c.fire && c.moveY === 0, 'unplugging the pad stops firing and moving');
pads[0] = pad; pad.axes = [0, 0, 0, 0]; press(BTN.RT, false);

// commands drive the sim: walk forward with the stick
{
  const sim = new GameSim({ map: SCHOOL, seed: 3, mode: 'explore' });
  const me = sim.addPlayer('p1', 'T');
  input.setLook(me.yaw, 0);
  const start = { ...me.pos };
  pad.axes = [0, -1, 0, 0];
  for (let i = 0; i < 60; i++) { frame(); sim.setInput('p1', input.buildCommand()); sim.step(1 / 60); sim.drainEvents(); }
  const moved = Math.hypot(me.pos.x - start.x, me.pos.z - start.z);
  check(moved > 2, `the player walks with the stick (${moved.toFixed(2)} m in 1s)`);
  pad.axes = [0, 0, 0, 0];
}

// prompts
check(G.glyphify('Press [F] to buy Quick Revive', 'kbm').includes('<kbd class="glyph key">F</kbd>'), 'keyboard prompt shows F');
check(G.glyphify('Press [F] to open door', 'xbox').includes('f-x') && G.glyphify('Press [F] to open door', 'xbox').includes('>X<'), 'Xbox prompt shows a blue X');
check(G.glyphify('Press [F] to open door', 'ps').includes('f-square'), 'PlayStation prompt shows square');
check(G.glyphify('Press [R] to reload', 'ps').includes('□'), 'PlayStation reload is square');
check(G.glyphify('<b>[F]</b>', 'kbm').startsWith('&lt;b&gt;'), 'prompt text is escaped');
check(G.glyphify('Mystery Box [Cost: 950]', 'xbox').includes('[Cost: 950]'), 'cost brackets are left alone');
check(G.controlsList('ps').includes('R2') && G.controlsList('xbox').includes('RT') && G.controlsList('kbm').includes('Shift'), 'controls list per device');
for (const dev of ['kbm', 'xbox', 'ps']) {
  const missing = ['use', 'reload', 'jump', 'crouch', 'sprint', 'melee', 'fire', 'ads', 'grenade', 'tactical', 'swap', 'pause', 'panel', 'zombies', 'move', 'look', 'confirm', 'back', 'rotate', 'prev', 'next'].filter((a) => !G.LABELS[dev][a]);
  check(!missing.length, `${dev}: every action has a label ${missing.join(',')}`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
