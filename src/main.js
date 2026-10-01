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
import { TitleMusic, StewSong } from './audio/music.js';

const LOCAL_ID = 'p1';
const canvas = document.getElementById('game');
const settings = loadSettings();

let sim = makeSim('zombies');
let player = sim.playerById(LOCAL_ID);

const renderer = new GameRenderer(canvas, sim, CONFIG, settings);
renderer.localId = LOCAL_ID;
const input = new Input(canvas, CONFIG, settings);
input.adsActive = () => player && player.loadout.adsAmount > 0.5;
// scoped weapons slow the mouse by the zoom so aim feels the same
input.zoomScale = () => {
  if (!player || player.loadout.adsAmount < 0.5) return 1;
  const def = CONFIG.weapons[player.loadout.slots[player.loadout.current].id];
  return def.scope ? (def.adsFovMult ?? 1) : 1;
};
input.setLook(player.yaw, 0);
const audio = new AudioEngine(CONFIG);
const sound = new SoundDirector(audio, sim, CONFIG);
sound.localId = LOCAL_ID;
const hud = new HUD(CONFIG);
hud.roomNames = Object.fromEntries(SCHOOL.rooms.map((r) => [r.id, r.id === 'quad' ? 'the Quad' : r.id === 'principal' ? "the principal's office" : 'the ' + r.name.replace(/^The /, '')]));
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
  resume: () => startPlaying(),
  restart: () => { restart(); startPlaying(); },
  quit: () => { restart('zombies'); mode = 'title'; hud.show(false); menus.show('title'); input.releaseLock(); startTitleMusic(); },
  settingsChanged: (s) => applySettings(s),
  extras: () => { menus.show('extras'); extras.open(); },
  extrasBack: () => { if (jukebox.playing) { jukebox.stop(0.5); startTitleMusic(); } menus.show('title'); },
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
menus.show('title');

function startPlaying() {
  audio.init();
  audio.applyVolumes();
  titleMusic.stop(0.8);
  if (jukebox.playing) jukebox.stop(0.3);
  sound.startAmbience(renderer.map);
  input.enabled = true;
  input.reset();
  input.requestLock();
  menus.hideAll();
  hud.show(true);
  rangeUI.setActive(sim.mode === 'range');
  mode = 'play';
  document.getElementById('lockhint').hidden = true;
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
    document.getElementById('lockhint').hidden = false;
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
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const fdt = Math.min(0.1, (now - last) / 1000);
  last = now;
  time += fdt;

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
  renderer.render(worldDt, alpha, look, player, time, mode === 'title' ? 'title' : 'play');
  audio.updateListener(renderer.camera);
  if (mode === 'play' || mode === 'dying' || mode === 'panel') sound.update(fdt, player);
  hud.update(fdt, sim, player, renderer.camera, settings.showFps);
  rangeUI.update(fdt, sim, player, renderer.camera);
  if (menus.current === 'extras') extras.update();
  input.endFrame();
}
requestAnimationFrame(frame);

// Expose for debugging in the console.
window.STEW = {
  get sim() { return sim; }, renderer, CONFIG, input, rangeUI, hud, sound, audio, titleMusic, jukebox, progress, extras, menus,
  get mode() { return mode; },
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
document.body.dataset.ready = '1';
