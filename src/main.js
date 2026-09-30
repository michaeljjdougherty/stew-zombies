// =============================================================================
// STEW ZOMBIES — entry point. Wires simulation, input, rendering, audio, UI.
//
// Loop: fixed-step simulation (CONFIG.sim.tickRate) + interpolated rendering.
// The local player is just one entry in sim.players; co-op will add more
// players fed by network commands instead of this keyboard.
// =============================================================================
import { CONFIG } from './config.js';
import { COURT } from './map/court.js';
import { GameSim } from './sim/sim.js';
import { GameRenderer } from './render/renderer.js';
import { Input } from './input/input.js';
import { AudioEngine } from './audio/audio.js';
import { SoundDirector } from './audio/director.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menu.js';
import { loadSettings, saveSettings } from './ui/settings.js';

const LOCAL_ID = 'p1';
const canvas = document.getElementById('game');
const settings = loadSettings();

let sim = makeSim();
let player = sim.playerById(LOCAL_ID);

const renderer = new GameRenderer(canvas, sim, CONFIG, settings);
renderer.localId = LOCAL_ID;
const input = new Input(canvas, CONFIG, settings);
input.adsActive = () => player && player.loadout.adsAmount > 0.5;
input.setLook(player.yaw, 0);
const audio = new AudioEngine(CONFIG);
const sound = new SoundDirector(audio, sim, CONFIG);
sound.localId = LOCAL_ID;
const hud = new HUD(CONFIG);
hud.localId = LOCAL_ID;

renderer.zombies.onFootstep = (z) => sound.zombieFootstep(z);
renderer.rig.onFootstep = (sprint, speed) => sound.playerFootstep(sprint, speed);

// 'title' | 'play' | 'paused' | 'dying' | 'over'
let mode = 'title';
let dyingT = 0;

function makeSim() {
  const s = new GameSim({ map: COURT, cfg: CONFIG, teamName: 'Stew' });
  s.addPlayer(LOCAL_ID, 'Stew');
  return s;
}

function applySettings(s) {
  saveSettings(s);
  renderer.applySettings(s);
  audio.setVolume('master', s.master);
  audio.setVolume('music', s.music);
}

const menus = new Menus(settings, {
  play: () => startPlaying(),
  resume: () => startPlaying(),
  restart: () => { restart(); startPlaying(); },
  quit: () => { restart(); mode = 'title'; hud.show(false); menus.show('title'); input.releaseLock(); },
  settingsChanged: (s) => applySettings(s),
});
applySettings(settings);
menus.show('title');

function startPlaying() {
  audio.init();
  audio.applyVolumes();
  sound.startAmbience(renderer.map);
  input.enabled = true;
  input.reset();
  input.requestLock();
  menus.hideAll();
  hud.show(true);
  mode = 'play';
  document.getElementById('lockhint').hidden = true;
}

function pause() {
  if (mode !== 'play') return;
  mode = 'paused';
  input.enabled = false;
  input.reset();
  menus.show('pause');
}

function restart() {
  sim = makeSim();
  player = sim.playerById(LOCAL_ID);
  renderer.setSim(sim);
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

function frame(now) {
  requestAnimationFrame(frame);
  const fdt = Math.min(0.1, (now - last) / 1000);
  last = now;
  time += fdt;

  if (mode === 'play' || mode === 'dying') {
    acc += fdt;
    let steps = 0;
    while (acc >= DT && steps < CONFIG.sim.maxStepsPerFrame) {
      renderer.beginStep(sim);
      sim.setInput(LOCAL_ID, mode === 'play' ? input.buildCommand() : { ...input.buildCommand(), fire: false, firePressed: false, moveX: 0, moveY: 0 });
      sim.step(DT);
      const events = sim.drainEvents();
      renderer.onEvents(events);
      for (const e of events) {
        sound.onEvent(e);
        hud.onEvent(e);
        if (e.type === 'playerDown' && e.playerId === LOCAL_ID) { mode = 'dying'; dyingT = 0; }
      }
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
      menus.showGameOver(sim.teamName, sim.rounds.round, player);
    }
  }

  const alpha = mode === 'play' || mode === 'dying' ? acc / DT : 1;
  const look = { yaw: input.yaw, pitch: input.pitch, dx: input.frameDX, dy: input.frameDY };
  const worldDt = mode === 'paused' || mode === 'over' ? 0 : fdt;
  renderer.render(worldDt, alpha, look, player, time, mode === 'title' ? 'title' : 'play');
  audio.updateListener(renderer.camera);
  if (mode === 'play' || mode === 'dying') sound.update(fdt, player);
  hud.update(fdt, sim, player, renderer.camera, settings.showFps);
  input.endFrame();
}
requestAnimationFrame(frame);

// Expose for debugging in the console.
window.STEW = { get sim() { return sim; }, renderer, CONFIG };
document.body.dataset.ready = '1';
