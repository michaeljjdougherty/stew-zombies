// =============================================================================
// STEW ZOMBIES — entry point. Wires simulation, input, rendering, audio, UI.
//
// Loop: fixed-step simulation (CONFIG.sim.tickRate) + interpolated rendering.
// The local player is just one entry in sim.players; co-op will add more
// players fed by network commands instead of this keyboard.
// =============================================================================
import { CONFIG } from './config.js';
import { SCHOOL } from './map/school.js';
import { RANGE } from './map/range.js';
import { spawnHorde, clearZombies, setRangeRound, rangeGive, rangeTogglePerk, rangeDrop, rangeCheddars, rangeStewBombs } from './sim/range.js';
import { RangeUI } from './ui/range.js';
import { GameSim } from './sim/sim.js';
import { GameRenderer } from './render/renderer.js';
import { Input } from './input/input.js';
import { AudioEngine } from './audio/audio.js';
import { SoundDirector } from './audio/director.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menu.js';
import { loadSettings, saveSettings } from './ui/settings.js';
import { loadProgress, saveProgress } from './ui/progress.js';
import { Extras } from './ui/extras.js';
import { CharSelect } from './ui/charselect.js';
import { LineupUI } from './ui/lineupui.js';
import { TitleMusic, StewSong } from './audio/music.js';
import { GUN_SAMPLES, SAMPLE_BASE } from './audio/gunSamples.js';
import { Pads, BTN } from './input/gamepad.js';
import { setDevice, applyGlyphs, controlsList, glyph, legend } from './input/glyphs.js';
import { MenuNav } from './ui/menunav.js';
import { LINEUP } from './render/characters.js';
import { SHIRT_COLORS } from './render/characters.js';

const LOCAL_ID = 'p1';
const canvas = document.getElementById('game');
const settings = loadSettings();

let sim = makeSim('zombies');
let player = sim.playerById(LOCAL_ID);

const renderer = new GameRenderer(canvas, sim, CONFIG, settings);
renderer.localId = LOCAL_ID;
const input = new Input(canvas, CONFIG, settings);
input.adsAmount = () => (renderer.aim ? renderer.aim.ads : 0);
// scoped weapons slow the mouse by the zoom so aim feels the same
input.zoomScale = () => {
  if (!player || !renderer.aim) return 1;
  const def = CONFIG.weapons[player.loadout.slots[player.loadout.current].id];
  return def.scope ? 1 + ((def.adsFovMult ?? 1) - 1) * renderer.aim.ads : 1;
};
input.setLook(player.yaw, 0);
const audio = new AudioEngine(CONFIG);
audio.preload(GUN_SAMPLES, SAMPLE_BASE);
const sound = new SoundDirector(audio, sim, CONFIG);
sound.localId = LOCAL_ID;
const hud = new HUD(CONFIG);
hud.roomNames = Object.fromEntries(SCHOOL.rooms.map((r) => [r.id, r.id === 'quad' ? 'the Quad' : r.id === 'principal' ? "the teachers' lounge" : 'the ' + r.name.replace(/^The /, '')]));
hud.localId = LOCAL_ID;

// Notes found and the Stew song unlock, remembered in this browser.
const progress = loadProgress();
hud.onNoteRead = (id) => {
  if (!progress.notes.includes(id)) { progress.notes.push(id); saveProgress(progress); }
};
const titleMusic = new TitleMusic(audio);
const jukebox = new StewSong(audio);
hud.lyricSource = () => (sound.song ? sound.song.lyric() : jukebox.playing ? jukebox.lyric() : null);
let gameOverLine = '';

renderer.zombies.onFootstep = (z) => sound.zombieFootstep(z);
renderer.onCheddarStep = (z) => sound.cheddarStep(z);
renderer.cheddars.onFootstep = renderer.onCheddarStep;

// Firing range: weapons & options panel, stats, damage numbers
const rangeUI = new RangeUI(CONFIG, {
  give: (id) => rangeGive(sim, player, id),
  perk: (id) => rangeTogglePerk(sim, player, id),
  setRound: (n) => setRangeRound(sim, n),
  setAmmo: (on) => { sim.range.infiniteAmmo = on; },
  setMoving: (on) => { sim.range.moving = on; },
  horde: () => spawnHorde(sim),
  cheddars: () => rangeCheddars(sim),
  stewBombs: () => rangeStewBombs(sim, player),
  drop: (id) => rangeDrop(sim, player, id),
  clear: () => clearZombies(sim),
  close: () => closeRangePanel(),
});
rangeUI.localId = LOCAL_ID;
renderer.rig.onFootstep = (sprint, speed) => sound.playerFootstep(sprint, speed);

// 'title' | 'play' | 'paused' | 'dying' | 'over'
let mode = 'title';
let dyingT = 0;

function makeSim(gameMode) {
  const s = new GameSim({ map: gameMode === 'range' ? RANGE : SCHOOL, cfg: CONFIG, teamName: 'Stew', mode: gameMode });
  s.addPlayer(LOCAL_ID, 'Stew');
  return s;
}

function applySettings(s) {
  saveSettings(s);
  renderer.applySettings(s);
  audio.setVolume('master', s.master);
  audio.setVolume('music', s.music);
  audio.setVolume('voice', s.voice);
  hud.subtitles = s.subtitles;
}

const menus = new Menus(settings, {
  play: () => { if (sim.mode !== 'zombies') restart('zombies'); startPlaying(); },
  range: () => { if (sim.mode !== 'range') restart('range'); startPlaying(); },
  explore: () => { if (sim.mode !== 'explore') restart('explore'); startPlaying(); },
  resume: () => startPlaying(),
  restart: () => { restart(); startPlaying(); },
  quit: () => { restart('zombies'); updateExploreHud(); mode = 'title'; hud.show(false); menus.show('title'); input.releaseLock(); startTitleMusic(); },
  settingsChanged: (s) => { applySettings(s); if (device !== 'kbm') { device = null; setInputDevice(pads.type); } },
  extras: () => { menus.show('extras'); extras.open(); },
  extrasBack: () => { if (jukebox.playing) { jukebox.stop(0.5); startTitleMusic(); } menus.show('title'); },
  characters: () => { mode = 'charselect'; menus.show('charselect'); charSelect.open(); },
});
const charSelect = new CharSelect(settings, {
  preview: (id, shirt) => renderer.getShowcase().show(id, shirt),
  done: (s) => { saveSettings(s); renderer.showcase.hide(); renderer.setCharacter(s.character, s.shirt); mode = 'title'; menus.show('title'); },
  back: () => { renderer.showcase.hide(); mode = 'title'; menus.show('title'); },
  lineup: () => { renderer.showcase.hide(); mode = 'lineup'; menus.show('lineup'); lineupUI.open(); },
});
const lineupUI = new LineupUI({
  lineup: () => renderer.getLineup(),
  back: () => { mode = 'charselect'; menus.show('charselect'); charSelect.open(); },
});
const extras = new Extras(CONFIG, {
  progress: () => progress,
  playSong: () => { audio.init(); audio.applyVolumes(); titleMusic.stop(0.6); jukebox.start('music', 0.75); },
  stopSong: () => { jukebox.stop(0.5); startTitleMusic(); },
  songLyric: () => jukebox.lyric(),
  songPlaying: () => jukebox.playing,
});

// Title theme: browsers only allow sound after the first click or key press.
function startTitleMusic() {
  if (!audio.ready || (mode !== 'title' && mode !== 'over') || jukebox.playing) return;
  titleMusic.start('music', 0.9);
}
const firstGesture = () => {
  if (mode !== 'title') return;
  audio.init();
  audio.applyVolumes();
  startTitleMusic();
};
window.addEventListener('pointerdown', firstGesture);
window.addEventListener('keydown', firstGesture);
applySettings(settings);
renderer.setCharacter(settings.character, settings.shirt);
menus.show('title');

function startPlaying() {
  audio.init();
  audio.applyVolumes();
  titleMusic.stop(0.8);
  if (jukebox.playing) jukebox.stop(0.3);
  sound.startAmbience(renderer.map);
  input.enabled = true;
  input.reset();
  if (device === 'kbm') input.requestLock();
  menus.hideAll();
  hud.show(true);
  rangeUI.setActive(sim.mode === 'range');
  updateExploreHud();
  mode = 'play';
  document.getElementById('lockhint').hidden = true;
}

function updateExploreHud() {
  const el = document.getElementById('explorehud');
  el.hidden = sim.mode !== 'explore';
  if (sim.mode === 'explore') {
    const b = document.getElementById('ex-z');
    b.textContent = sim.explore.zombies ? 'on' : 'off';
    b.className = sim.explore.zombies ? 'on' : '';
  }
}

function openRangePanel() {
  if (mode !== 'play' || sim.mode !== 'range') return;
  mode = 'panel';
  input.enabled = false;
  input.reset();
  input.releaseLock();
  rangeUI.open(sim, player);
}

function closeRangePanel() {
  if (mode !== 'panel') return;
  rangeUI.close();
  startPlaying();
}

function pause() {
  if (mode !== 'play') return;
  mode = 'paused';
  input.enabled = false;
  input.reset();
  menus.show('pause');
}

function restart(gameMode = sim.mode) {
  const mapChanged = gameMode !== sim.mode;
  sim = makeSim(gameMode);
  player = sim.playerById(LOCAL_ID);
  renderer.setSim(sim);
  if (mapChanged) {
    renderer.zombies.onFootstep = (z) => sound.zombieFootstep(z);
    sound.stopAmbience();
    if (audio.ready) sound.startAmbience(renderer.map);
  }
  rangeUI.reset();
  rangeUI.setActive(false);
  sound.stopSong();
  gameOverLine = '';
  sound.sim = sim;
  sound.groanTimers.clear();
  hud.reset();
  input.setLook(player.yaw, 0);
  dyingT = 0;
}

input.onLockChange = (locked, failed) => {
  if (failed) {
    // pointer lock unavailable: keep playing with free mouse-look
    document.getElementById('lockhint').hidden = device !== 'kbm';
    return;
  }
  if (!locked && mode === 'play') pause();
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyB' && !e.repeat) {
    if (mode === 'play') openRangePanel();
    else if (mode === 'panel') closeRangePanel();
  }
  if (e.code === 'Escape' && mode === 'panel') { closeRangePanel(); return; }
  if (e.code === 'Escape' && mode === 'play' && input.fallbackLook) pause();
  if (e.code === 'KeyP' && mode === 'play') { input.releaseLock(); pause(); }
  if (e.code === 'KeyZ' && !e.repeat && mode === 'play' && sim.mode === 'explore') { sim.setExploreZombies(!sim.explore.zombies); updateExploreHud(); }
});
canvas.addEventListener('click', () => { if (mode === 'play' && !input.locked && !input.fallbackLook) input.requestLock(); });

// ---------------------------------------------------------------------------
// main loop
// ---------------------------------------------------------------------------
const DT = 1 / CONFIG.sim.tickRate;
let acc = 0;
let last = performance.now();
let time = 0;

// One simulation tick with the local player's command, then fan out events.
const debugHold = {};
function tick(cmd) {
  renderer.beginStep(sim);
  sim.setInput(LOCAL_ID, { ...cmd, ...debugHold });
  sim.step(DT);
  const events = sim.drainEvents();
  renderer.onEvents(events);
  for (const e of events) {
    sound.onEvent(e);
    hud.onEvent(e);
    rangeUI.onEvent(e);
    if (e.type === 'gameOver' && mode === 'play') { mode = 'dying'; dyingT = 0; }
    if (e.type === 'erikSays' && e.cat === 'gameOver') gameOverLine = e.text;
    if (e.type === 'stewSong' && !progress.song) { progress.song = true; saveProgress(progress); }
    if (device !== 'kbm' && settings.rumble !== false) rumbleFor(e);
  }
}

// ---------------------------------------------------------------------------
// controller: which device is in use, button prompts, rumble, menu navigation
// ---------------------------------------------------------------------------
const pads = new Pads();
let device = 'kbm';
const $id = (id) => document.getElementById(id);

function setInputDevice(d) {
  if (d !== 'kbm' && settings.padIcons && settings.padIcons !== 'auto') d = settings.padIcons;
  if (d === device) return;
  device = d;
  setDevice(d);
  refreshGlyphs();
}
input.onDevice = (d) => setInputDevice(d);

function refreshGlyphs() {
  document.body.dataset.input = device;
  applyGlyphs(document);
  $id('keys-list').innerHTML = controlsList(device);
  const pad = device !== 'kbm';
  $id('cs-hint').innerHTML = pad
    ? `${glyph('rotate')} turns him around · ${glyph('prev')}${glyph('next')} T-shirt colour. More of Stew to come.`
    : 'Drag to turn him around. More of Stew to come.';
  lineupUI.hint = pad
    ? `${glyph('rotate')} turns them · ${glyph('prev')}${glyph('next')} picks someone to look at closer`
    : 'Drag to turn them around. Pick someone to take a closer look.';
  lineupUI.showHint();
  extras.glyph = glyph;
  if (menus.current === 'extras' && (extras.tab === 'notes' || extras.tab === 'howto')) {
    const top = extras.panel.scrollTop; extras.open(extras.tab); extras.panel.scrollTop = top;
  }
  hud.last.prompt = hud.last.hint = undefined; // redraw prompts with the new buttons
  showLegend(nav.lastRoot ? nav.lastRoot.id : null);
  if (pad) $id('lockhint').hidden = true;
}

function rumbleFor(e) {
  const local = e.playerId === LOCAL_ID;
  switch (e.type) {
    case 'shot': if (local) {
      const def = CONFIG.weapons[e.weapon] || {};
      const k = Math.min(1, 0.15 + (def.damage || 60) / 500);
      pads.rumble(k * 0.6, k, 50 + k * 60);
    } break;
    case 'meleeHit': if (local) pads.rumble(0.3, 0.5, 70); break;
    case 'playerHit': if (e.playerId === LOCAL_ID) pads.rumble(0.7, 0.4, 160); break;
    case 'playerDown': if (local) pads.rumble(1, 0.8, 450); break;
    case 'explosion': if (player && e.pos) {
      const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
      if (d < 16) pads.rumble(1 - d / 16, 0.8 * (1 - d / 16), 280);
    } break;
    case 'powerupGrab': pads.rumble(0.2, 0.4, 120); break;
    case 'playerLand': if (local && e.impact > 4) pads.rumble(0.25, 0.1, 60); break;
  }
}

// aim assist: the zombie closest to the crosshair, if it's in sight
input.hasPrompt = () => !!(player && (player.prompt || player.rebuilding));
input.assist = () => {
  if (!player || !sim.zombies.length) return null;
  const eye = sim.eyePosition(player);
  let best = null;
  for (const z of sim.zombies) {
    if (z.state === 'dead' || z.state === 'waiting') continue;
    const ty = z.pos.y + (z.crawler ? 0.35 : 1.35);
    const dx = z.pos.x - eye.x, dy = ty - eye.y, dz = z.pos.z - eye.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 30 || dist < 0.4) continue;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, dist);
    let dyaw = yaw - input.yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const angle = Math.hypot(dyaw, pitch - input.pitch);
    if (angle > 0.35) continue;
    const radius = Math.atan2(0.45, dist);
    const l = Math.hypot(dx, dy, dz);
    if (sim.raycastWorld(eye, { x: dx / l, y: dy / l, z: dz / l }, l - 0.3, true)) continue;
    if (!best || angle / radius < best.angle / best.radius) best = { yaw, pitch, angle, radius };
  }
  return best;
};

const BACK_BUTTON = { settings: 'btn-settings-back', pause: 'btn-resume', extras: 'btn-extras-back', charselect: 'btn-cs-back', lineup: 'lu-back', rangepanel: 'rp-close' };
const EXTRA_TABS = ['story', 'notes', 'howto', 'jukebox', 'credits'];
const nav = new MenuNav({
  root: () => (mode === 'panel' ? $id('rangepanel') : menus.current ? $id(menus.current) : null),
  back: (id) => { const b = BACK_BUTTON[id]; if (b) $id(b).click(); },
  start: (id) => { if (id === 'pause' || id === 'rangepanel') $id(BACK_BUTTON[id]).click(); },
  view: (id) => { if (id === 'rangepanel') closeRangePanel(); },
  bumper: (id, dir) => {
    if (id === 'extras') { const i = EXTRA_TABS.indexOf(extras.tab); extras.open(EXTRA_TABS[(i + dir + EXTRA_TABS.length) % EXTRA_TABS.length]); }
    else if (id === 'charselect') { const ids = Object.keys(SHIRT_COLORS); charSelect.shirt = ids[(ids.indexOf(charSelect.shirt) + dir + ids.length) % ids.length]; charSelect.refresh(); }
    else if (id === 'lineup') { const L = renderer.getLineup(); const n = LINEUP.length + 1; L.setFocus(((L.focus + 1 + dir + n) % n) - 1); lineupUI.refresh(); }
  },
  rotate: (id, a) => {
    if (id === 'charselect') renderer.showcase.turn(a);
    else if (id === 'lineup') renderer.getLineup().drag(a * 420);
  },
});

function showLegend(id) {
  const html = legend(id, device);
  const bar = $id('padbar');
  bar.innerHTML = html;
  bar.hidden = !html;
  bar.className = id ? 'on-' + id : '';
}
nav.onRoot = (id) => showLegend(id);

let padWoke = false;
function padFrame(fdt) {
  const st = pads.poll();
  if (st && pads.active) {
    setInputDevice(pads.type);
    if (!padWoke || !audio.ready) { padWoke = true; firstGesture(); }
  }
  const playing = mode === 'play';
  // menus first (no menu is up while playing, so this only tracks the screen)
  nav.frame(st, fdt);
  if (!st || !playing) { input.padFrame(null, fdt); return; }
  input.padFrame(st, fdt);
  if (st.pressed(BTN.MENU)) { input.releaseLock(); pause(); }
  else if (st.pressed(BTN.VIEW)) {
    if (sim.mode === 'range') openRangePanel();
    else if (sim.mode === 'explore') { sim.setExploreZombies(!sim.explore.zombies); updateExploreHud(); }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const fdt = Math.min(0.1, Math.max(0, (now - last) / 1000)); // rAF time can start before the clock we read at load
  last = now;
  time += fdt;
  padFrame(fdt);

  if (mode === 'play' || mode === 'dying' || mode === 'panel') {
    acc += fdt;
    let steps = 0;
    while (acc >= DT && steps < CONFIG.sim.maxStepsPerFrame) {
      const cmd = input.buildCommand();
      tick(mode === 'play' ? cmd : { ...cmd, fire: false, firePressed: false, moveX: 0, moveY: 0 });
      acc -= DT;
      steps++;
    }
    if (steps >= CONFIG.sim.maxStepsPerFrame) acc = 0;
  }

  if (mode === 'dying') {
    dyingT += fdt;
    if (dyingT > 2.2) {
      mode = 'over';
      input.enabled = false;
      input.releaseLock();
      hud.show(false);
      menus.showGameOver(sim.teamName, sim.rounds.round, player, gameOverLine);
      if (sim.mode === 'zombies' && sim.rounds.round > progress.bestRound) { progress.bestRound = sim.rounds.round; saveProgress(progress); }
    }
  }

  const alpha = mode === 'play' || mode === 'dying' || mode === 'panel' ? acc / DT : 1;
  const look = { yaw: input.yaw, pitch: input.pitch, dx: input.frameDX, dy: input.frameDY };
  const worldDt = mode === 'paused' || mode === 'over' ? 0 : fdt;
  renderer.render(worldDt, alpha, look, player, time, mode === 'title' ? 'title' : mode === 'charselect' ? 'showcase' : mode === 'lineup' ? 'lineup' : 'play');
  audio.updateListener(renderer.camera);
  if (mode === 'play' || mode === 'dying' || mode === 'panel') sound.update(fdt, player);
  hud.update(fdt, sim, player, renderer.camera, settings.showFps);
  rangeUI.update(fdt, sim, player, renderer.camera);
  if (menus.current === 'extras') extras.update();
  if (mode === 'lineup') lineupUI.update();
  input.endFrame();
}
requestAnimationFrame(frame);

// Expose for debugging in the console.
window.STEW = {
  get sim() { return sim; }, renderer, CONFIG, input, rangeUI, hud, sound, audio, titleMusic, jukebox, progress, extras, menus, charSelect, lineupUI,
  get mode() { return mode; }, pads, nav, get device() { return device; }, setInputDevice,
  debug: {
    // Run the simulation forward without rendering (for testing).
    run(seconds, patch = {}) {
      const n = Math.round(seconds / DT);
      for (let i = 0; i < n; i++) tick({ ...input.buildCommand(), ...patch, yaw: input.yaw, pitch: input.pitch });
    },
    look(yaw, pitch = 0) { input.setLook(yaw, pitch); },
    hold: debugHold, // e.g. STEW.debug.hold.ads = true

  },
};
refreshGlyphs();
document.body.dataset.ready = '1';
// paint the zombie heads and outfits while the player is still on the title screen
setTimeout(() => renderer.zombies.kit.build(), 400);
