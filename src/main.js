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
import { PatchNotes } from './ui/patchNotes.js';
import { MapSelect, MAPS } from './ui/mapselect.js';
import { CutsceneUI } from './ui/cutscene.js';
import { LINEUP } from './render/characters.js';
import { SHIRT_COLORS, CHARACTERS } from './render/characters.js';
import { OnlineSession } from './net/online.js';
import { NetHost } from './net/host.js';
import { NetClient } from './net/client.js';
import { OnlineUI } from './ui/online.js';
import { emptyCommand } from './sim/player.js';

let localId = 'p1';            // online, friends are p2..p4
const canvas = document.getElementById('game');
const settings = loadSettings();

// Notes found, the Stew song, the quest (and Brian), remembered in this browser.
const progress = loadProgress();

let sim = makeSim('zombies');
let player = sim.playerById(localId);

const renderer = new GameRenderer(canvas, sim, CONFIG, settings);
renderer.localId = localId;
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
sound.localId = localId;
const hud = new HUD(CONFIG);
hud.roomNames = Object.fromEntries(SCHOOL.rooms.map((r) => [r.id, r.id === 'quad' ? 'the Quad' : r.id === 'principal' ? "the teachers' lounge" : 'the ' + r.name.replace(/^The /, '')]));
hud.localId = localId;
hud.localName = CHARACTERS[playableCharacter()].name;

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
rangeUI.localId = localId;
renderer.rig.onFootstep = (sprint, speed) => sound.playerFootstep(sprint, speed);

// 'title' | 'play' | 'paused' | 'dying' | 'over' | 'ending'
let mode = 'title';
let dyingT = 0;
let endingAt = null;          // when the ending cutscene starts (after Erik's booth goes)
const cutsceneUI = new CutsceneUI();

// Who you're playing (Brian only once The Final Whistle is done).
function playableCharacter() {
  const id = settings.character;
  const ok = CHARACTERS[id] && (CHARACTERS[id].playable || (CHARACTERS[id].unlock === 'quest' && progress.questDone));
  return ok ? id : 'kearns';
}

function makeSim(gameMode) {
  const s = new GameSim({ map: gameMode === 'range' ? RANGE : SCHOOL, cfg: CONFIG, teamName: 'Stew', mode: gameMode });
  s.addPlayer(localId, 'Stew', { character: playableCharacter() });
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
  play: () => openMapSelect(),
  range: () => { if (sim.mode !== 'range') restart('range'); startPlaying(); },
  explore: () => { if (sim.mode !== 'explore') restart('explore'); startPlaying(); },
  resume: () => startPlaying(),
  restart: () => {
    if (online) { if (online.isHost) { online.backToLobby(); showOnlineLobby(); } return; }
    restart(sim.mode === 'range' ? 'range' : sim.mode); startPlaying();
  },
  online: () => openOnline(),
  quit: () => { if (online) leaveOnline(); restart('zombies'); updateExploreHud(); mode = 'title'; hud.show(false); menus.show('title'); input.releaseLock(); startTitleMusic(); },
  settingsChanged: (s) => { applySettings(s); if (device !== 'kbm') { device = null; setInputDevice(pads.type); } },
  extras: () => { menus.show('extras'); extras.open(); },
  extrasBack: () => { if (jukebox.playing) { jukebox.stop(0.5); startTitleMusic(); } menus.show('title'); },
  characters: () => { mode = 'charselect'; menus.show('charselect'); charSelect.open(); },
});
const charSelect = new CharSelect(settings, {
  preview: (id, shirt) => renderer.getShowcase().show(id, shirt),
  questDone: () => !!progress.questDone,
  done: (s) => {
    saveSettings(s); renderer.showcase.hide();
    renderer.setCharacter(playableCharacter(), s.shirt);
    hud.localName = CHARACTERS[playableCharacter()].name;
    if (sim.mode === 'zombies') restart('zombies');   // the next game starts as them
    mode = 'title'; menus.show('title');
  },
  back: () => { renderer.showcase.hide(); mode = 'title'; menus.show('title'); },
  lineup: () => { renderer.showcase.hide(); mode = 'lineup'; menus.show('lineup'); lineupUI.open(); },
});
const lineupUI = new LineupUI({
  lineup: () => renderer.getLineup(),
  back: () => { mode = 'charselect'; menus.show('charselect'); charSelect.open(); },
});
const extras = new Extras(CONFIG, {
  progress: () => progress,
  watchEnding: () => watchEnding(),
  watchIntro: () => startIntro('extras'),
  playSong: () => { audio.init(); audio.applyVolumes(); titleMusic.stop(0.6); jukebox.start('music', 0.75); },
  stopSong: () => { jukebox.stop(0.5); startTitleMusic(); },
  songLyric: () => jukebox.lyric(),
  songPlaying: () => jukebox.playing,
});

// ---------------------------------------------------------------------------
// Online: host or join a lobby, then the same game with friends in it.
// The host's browser runs the game (NetHost); friends run a copy (NetClient).
// ---------------------------------------------------------------------------
const NET_LOCAL = new URLSearchParams(location.search).get('net') === 'local';   // tabs on one computer (testing)
let online = null;                       // OnlineSession while in a lobby or online game
const net = { host: null, client: null };

const onlineUI = new OnlineUI(settings, {
  host: async (name) => { saveSettings(settings); newSession(name); await online.host(); },
  join: async (name, code) => {
    saveSettings(settings); newSession(name);
    try { await online.join(code); } catch (e) { const o = online; online = null; if (o) o.leave(); throw e; }
  },
  pick: (ch) => { if (online) online.pick(ch); },
  start: () => { if (online) online.start(); },
  leave: () => { leaveOnline(); onlineUI.open(); },
  back: () => { mode = 'title'; menus.show('title'); },
});

function newSession(name) {
  if (online) leaveOnline();
  online = new OnlineSession({
    name, character: playableCharacter(), brian: !!progress.questDone, local: NET_LOCAL,
    onLobby: (lobby) => { if (online && !online.inGame) onlineUI.showLobby(lobby, online.isHost); },
    onStart: (st) => startOnlineGame(st),
    onGame: (from, m) => { if (net.host) net.host.onMessage(from, m); else if (net.client) net.client.onMessage(m); },
    onPeerLeft: (m) => teammateLeft(m),
    onToLobby: () => showOnlineLobby(),
    onEnd: (reason) => onlineEnded(reason),
  });
}

function openOnline(code = '') {
  mode = 'online';
  if (online && !online.inGame) { showOnlineLobby(); return; }
  menus.show('online');
  onlineUI.open(code);
}

// after a game: everyone back to the lobby
function showOnlineLobby() {
  stopOnlineGame();
  restart('zombies');
  mode = 'online';
  input.enabled = false; input.releaseLock();
  hud.show(false);
  menus.show('online');
  if (online) onlineUI.showLobby({ ...online.lobby(), you: online.you }, online.isHost);
  startTitleMusic();
}

function startOnlineGame(st) {
  localId = st.you;
  const s = new GameSim({ map: SCHOOL, cfg: CONFIG, teamName: 'Stew', mode: 'zombies', seed: st.seed });
  for (const m of st.members) s.addPlayer(m.id, m.name, { character: m.character });
  stopOnlineGame();
  installSim(s);
  if (online.isHost) {
    net.host = new NetHost(sim, (to, m) => online && online.send(to, m));
    for (const p of st.peers) net.host.addRemote(p.peer, p.id);
  } else {
    net.client = new NetClient(sim, localId, (m) => online && online.send(null, m));
  }
  const me = st.members.find((m) => m.id === localId);
  renderer.setCharacter(me.character, settings.shirt);
  hud.localName = CHARACTERS[me.character].name;
  startPlaying();
}

// game over / victory online: the host takes everyone back to the lobby
function onlineOverButtons() {
  for (const id of ['btn-again', 'btn-win-again']) {
    const b = $id(id);
    b.hidden = !!online && !online.isHost;
    b.textContent = online ? 'Back to the lobby' : 'Play again';
  }
  for (const id of ['btn-over-title', 'btn-win-title']) $id(id).textContent = online ? 'Leave the game' : 'Quit to title';
}

function stopOnlineGame() { net.host = null; net.client = null; }

// a friend dropped out mid-game (host)
function teammateLeft(m) {
  if (!net.host) return;
  net.host.removeRemote(m.peer);
  const p = sim.playerById(m.id);
  if (p) {
    if (p.useTarget && p.useTarget.release) p.useTarget.release(sim, p);
    sim.players = sim.players.filter((x) => x !== p);
    sim.emit('playerLeft', { playerId: m.id, name: m.name });
  }
}

function leaveOnline() {
  const o = online;
  online = null;
  stopOnlineGame();
  if (o) o.leave();
  if (localId !== 'p1') { localId = 'p1'; restart('zombies'); }
  hud.localName = CHARACTERS[playableCharacter()].name;
  renderer.setCharacter(playableCharacter(), settings.shirt);
}

// the connection is gone (host left, kicked, network)
function onlineEnded(reason) {
  const wasPlaying = !!(net.host || net.client);
  online = null;
  stopOnlineGame();
  if (wasPlaying || mode !== 'online') {
    localId = 'p1';
    restart('zombies');
    input.enabled = false; input.releaseLock();
    hud.show(false);
    if (renderer.ending) { renderer.endEnding(); cutsceneUI.hide(); }
  }
  hud.localName = CHARACTERS[playableCharacter()].name;
  renderer.setCharacter(playableCharacter(), settings.shirt);
  mode = 'online';
  menus.show('online');
  onlineUI.open();
  if (reason) onlineUI.status(reason, true);
  startTitleMusic();
}

// Title theme: browsers only allow sound after the first click or key press.
function startTitleMusic() {
  if (!audio.ready || (mode !== 'title' && mode !== 'over' && mode !== 'online') || jukebox.playing) return;
  titleMusic.start('music', 0.9);
}
const firstGesture = () => {
  if (mode !== 'title' && mode !== 'online') return;
  audio.init();
  audio.applyVolumes();
  startTitleMusic();
};
// Browsers only unlock sound on a real click, tap or key press (not a
// controller button), and a refresh locks it again. Listen on every event that
// counts, and start or wake the audio from inside it.
const unlockAudio = () => {
  if (!audio.ctx) { audio.init(); audio.applyVolumes(); startTitleMusic(); }
  else { audio.ensureRunning(); if (audio.ctx.state !== 'running') audio.ctx.resume().then(() => startTitleMusic()).catch(() => {}); }
};
for (const ev of ['pointerdown', 'pointerup', 'mousedown', 'click', 'touchend', 'keydown', 'keyup']) window.addEventListener(ev, unlockAudio, { capture: true });
// while the browser is still holding the sound back, say how to let it out
const soundHint = document.getElementById('sound-hint');
setInterval(() => {
  const locked = !audio.ctx || audio.ctx.state !== 'running';
  const show = locked && document.hasFocus() && (mode === 'title' || mode === 'online' || mode === 'play' || mode === 'paused');
  if (soundHint && soundHint.hidden === show) soundHint.hidden = !show;
}, 400);
applySettings(settings);
renderer.setCharacter(playableCharacter(), settings.shirt);
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

function startEnding() {
  endingAt = null;
  mode = 'ending';
  input.enabled = false;
  input.reset();
  input.releaseLock();
  hud.show(false);
  const E = renderer.startEnding({ ...settings, character: player ? player.character : settings.character });
  E.onCue = (n) => { sound.cue(n); cutsceneUI.cue(n); };
  cutsceneUI.show(`${glyph('skip')} skip`);
}

// From Extras: play the ending on its own, then back to the title.
let watchingEnding = false;
function watchEnding() {
  audio.init(); audio.applyVolumes();
  titleMusic.stop(0.6);
  if (jukebox.playing) jukebox.stop(0.3);
  restart('zombies');
  const q = sim.quest;
  if (q) { q.coin = 'placed'; q.cladding = 1; q.erikRevealed = true; q.step = 'ending'; }
  sim.power = true;
  renderer.map.powerOn(true);
  menus.hideAll();
  watchingEnding = true;
  startEnding();
}

// Play → the map screen.
const mapSelect = new MapSelect({
  play: (id, withIntro) => {
    mapSelect.close();
    if (withIntro) { startIntro('play'); return; }
    if (sim.mode !== 'zombies') restart('zombies');
    startPlaying();
  },
  watchIntro: () => { mapSelect.close(); startIntro('maps'); },
  back: () => { mapSelect.close(); menus.show('title'); },
  introSeen: () => !!progress.introSeen,
});
function openMapSelect() {
  menus.show('mapselect');
  mapSelect.open();
}

// The intro: Erik getting cut, the bargain, tip-off. Then the game starts
// (or, watched from Extras / the map screen, back to where you were).
let introThen = null;
function startIntro(then = 'play') {
  audio.init(); audio.applyVolumes();
  titleMusic.stop(0.6);
  if (jukebox.playing) jukebox.stop(0.3);
  restart('zombies');
  menus.hideAll();
  introThen = then;
  mode = 'intro';
  input.enabled = false;
  input.reset();
  input.releaseLock();
  hud.show(false);
  const I = renderer.startIntro({ ...settings, character: playableCharacter() });
  I.onCue = (n) => { sound.cue(n); cutsceneUI.introCue(n); };
  I.onLine = (who, text, secs) => { if (settings.subtitles !== false) cutsceneUI.line(who, text, secs); sound.voiceLine(who, text, secs); };
  cutsceneUI.show(`${glyph('skip')} skip`);
}

function finishIntro() {
  renderer.endEnding();
  cutsceneUI.hide();
  if (!progress.introSeen) { progress.introSeen = true; saveProgress(progress); }
  restart('zombies');
  const then = introThen; introThen = null;
  if (then === 'play') { startPlaying(); return; }
  mode = 'title';
  if (then === 'maps') openMapSelect(); else if (then === 'extras') { menus.show('extras'); extras.open('story'); } else menus.show('title');
  startTitleMusic();
}

function finishEnding() {
  renderer.endEnding();
  cutsceneUI.hide();
  if (watchingEnding) {
    watchingEnding = false;
    restart('zombies');
    mode = 'title';
    menus.show('title');
    startTitleMusic();
    return;
  }
  mode = 'over';
  input.enabled = false;
  const firstTime = !progress.questDone;
  if (firstTime) { progress.questDone = true; saveProgress(progress); }
  if (online) online.unlockBrian();   // pickable back in the lobby
  menus.showVictory(sim.rounds.round, player, firstTime);
  onlineOverButtons();
  startTitleMusic();
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
  keyBoard = padBoard = false; hud.showScoreboard(false);
  input.enabled = false;
  input.reset();
  $id('btn-restart').hidden = !!online;
  $id('pause-online').hidden = !online;
  menus.show('pause');
}

function restart(gameMode = sim.mode) { installSim(makeSim(gameMode)); }

// Swap in a new game (a fresh solo one, or the one an online game starts with).
function installSim(s) {
  const mapChanged = s.mapData !== sim.mapData;
  sim = s;
  player = sim.playerById(localId);
  renderer.localId = sound.localId = hud.localId = rangeUI.localId = localId;
  hud.localCharacter = sound.localCharacter = player.character;
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
  endingAt = null;
  if (renderer.ending) { renderer.endEnding(); cutsceneUI.hide(); }
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
// hold Tab for the scoreboard
window.addEventListener('keydown', (e) => { if (e.code === 'Tab' && (mode === 'play' || mode === 'dying')) { e.preventDefault(); if (!keyBoard) { keyBoard = true; hud.showScoreboard(true); } } });
window.addEventListener('keyup', (e) => { if (e.code === 'Tab' && keyBoard) { keyBoard = false; hud.showScoreboard(padBoard); } });
window.addEventListener('blur', () => { keyBoard = false; padBoard = false; hud.showScoreboard(false); });
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyB' && !e.repeat) {
    if (mode === 'play') openRangePanel();
    else if (mode === 'panel') closeRangePanel();
  }
  if ((mode === 'ending' || mode === 'intro') && ['Escape', 'Space', 'Enter', 'KeyF'].includes(e.code) && !e.repeat) { renderer.ending && renderer.ending.skip(); return; }
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
// One bad event or frame shouldn't stop the game: log it (once per kind) and carry on.
const reported = new Set();
function safely(label, fn) {
  try { return fn(); } catch (err) {
    const key = label + ':' + (err && err.message);
    if (!reported.has(key)) { reported.add(key); console.error(`[${label}]`, err); }
    return undefined;
  }
}

// Dead in an online game: watch a teammate who's still up. Fire / Jump cycles.
let specFire = false;
function updateSpectate(cmd) {
  const me = sim.playerById(localId);
  const live = online && online.inGame && me && !me.alive && sim.mode === 'zombies';
  if (!live) { if (renderer.spectate) { renderer.spectate = null; hud.showSpectate(null); } specFire = !!cmd.fire; return; }
  const alive = sim.players.filter((q) => q.id !== localId && q.alive);
  const fireEdge = cmd.fire && !specFire; specFire = !!cmd.fire;
  let i = alive.findIndex((q) => q.id === renderer.spectate);
  if (i < 0) i = 0; else if (fireEdge || cmd.jumpPressed || cmd.adsPressed) i = (i + 1) % alive.length;
  const t = alive[i] || null;
  renderer.spectate = t ? t.id : null;
  hud.showSpectate(t, alive.length > 1);
}

function tick(cmd) {
  safely('beginStep', () => renderer.beginStep(sim));
  safely('spectate', () => updateSpectate(cmd));
  let events = [];
  if (net.client) {
    // a friend's copy: move and shoot locally, mirror the host
    events = safely('client', () => net.client.tick({ ...cmd, ...debugHold }, DT)) || [];
    if (sim.netTeleport) { input.setLook(sim.netTeleport.yaw ?? input.yaw, 0); sim.netTeleport = null; }
  } else {
    if (net.host) safely('host', () => net.host.preStep());
    sim.setInput(localId, { ...cmd, ...debugHold });
    safely('sim', () => sim.step(DT));
    events = sim.drainEvents();
    if (net.host) safely('host', () => net.host.postStep(events));
  }
  for (const e of events) safely('render:' + e.type, () => renderer.onEvents([e]));
  for (const e of events) {
    safely('sound:' + e.type, () => sound.onEvent(e));
    safely('hud:' + e.type, () => hud.onEvent(e));
    safely('range:' + e.type, () => rangeUI.onEvent(e));
    if (e.type === 'gameOver' && mode === 'play') { mode = 'dying'; dyingT = 0; }
    if (e.type === 'erikSays' && e.cat === 'gameOver') gameOverLine = e.text;
    if (e.type === 'stewSong' && !progress.song) { progress.song = true; saveProgress(progress); }
    if (e.type === 'bossEnd') endingAt = time + 2.4;
    if (device !== 'kbm' && settings.rumble !== false) safely('rumble', () => rumbleFor(e));
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
    ? `${glyph('rotate')} turns him around · ${glyph('prev')}${glyph('next')} T-shirt colour. Brian unlocks when you finish The Final Whistle.`
    : 'Drag to turn him around. Brian unlocks when you finish The Final Whistle.';
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
  const local = e.playerId === localId;
  switch (e.type) {
    case 'shot': if (local) {
      const def = CONFIG.weapons[e.weapon] || {};
      const k = Math.min(1, 0.15 + (def.damage || 60) / 500);
      pads.rumble(k * 0.6, k, 50 + k * 60);
    } break;
    case 'meleeHit': if (local) pads.rumble(0.3, 0.5, 70); break;
    case 'playerHit': if (e.playerId === localId) pads.rumble(0.7, 0.4, 160); break;
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

const BACK_BUTTON = { mapselect: 'ms-back', online: 'btn-on-back', settings: 'btn-settings-back', pause: 'btn-resume', extras: 'btn-extras-back', charselect: 'btn-cs-back', lineup: 'lu-back', rangepanel: 'rp-close' };
const EXTRA_TABS = ['story', 'notes', 'howto', 'jukebox', 'patch', 'credits'];
const patchNotes = new PatchNotes();
const nav = new MenuNav({
  root: () => (patchNotes.isOpen ? $id('patchnotes') : mode === 'panel' ? $id('rangepanel') : menus.current ? $id(menus.current) : null),
  back: (id) => { if (id === 'patchnotes') { patchNotes.close(); return; } const b = id === 'online' && !$id('on-lobby').hidden ? 'btn-on-leave' : BACK_BUTTON[id]; if (b) $id(b).click(); },
  start: (id) => { if (id === 'patchnotes') patchNotes.close(); else if (id === 'pause' || id === 'rangepanel') $id(BACK_BUTTON[id]).click(); },
  view: (id) => { if (id === 'rangepanel') closeRangePanel(); },
  bumper: (id, dir) => {
    if (id === 'mapselect') { const ids = MAPS.map((m) => m.id); mapSelect.select(ids[(ids.indexOf(mapSelect.sel) + dir + ids.length) % ids.length]); }
    else if (id === 'extras') { const i = EXTRA_TABS.indexOf(extras.tab); extras.open(EXTRA_TABS[(i + dir + EXTRA_TABS.length) % EXTRA_TABS.length]); }
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
let padBoard = false, keyBoard = false;   // scoreboard held on the pad / keyboard
function padFrame(fdt) {
  const st = pads.poll();
  if (st && pads.active) {
    setInputDevice(pads.type);
    if (!padWoke || !audio.ready) { padWoke = true; firstGesture(); }
  }
  const playing = mode === 'play';
  if ((mode === 'ending' || mode === 'intro') && st && (st.pressed(BTN.A) || st.pressed(BTN.B) || st.pressed(BTN.MENU))) renderer.ending && renderer.ending.skip();
  // menus first (no menu is up while playing, so this only tracks the screen)
  nav.frame(st, fdt);
  if (!st || !playing) { input.padFrame(null, fdt); return; }
  input.padFrame(st, fdt);
  // hold Back/View for the scoreboard (in the range and Explore it does their thing)
  if (sim.mode === 'zombies') { const sb = st.down(BTN.VIEW); if (sb !== padBoard) { padBoard = sb; hud.showScoreboard(sb || keyBoard); } }
  if (st.pressed(BTN.MENU)) { input.releaseLock(); pause(); }
  else if (st.pressed(BTN.VIEW) && sim.mode !== 'zombies') {
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

  // (online the game goes on while you're in the pause menu)
  const onlineLive = !!(online && online.inGame && (mode === 'paused' || mode === 'over'));
  if (mode === 'play' || mode === 'dying' || mode === 'panel' || onlineLive) {
    acc += fdt;
    let steps = 0;
    while (acc >= DT && steps < CONFIG.sim.maxStepsPerFrame) {
      const cmd = input.buildCommand();
      tick(mode === 'play' ? cmd : mode === 'dying' || mode === 'panel' ? { ...cmd, fire: false, firePressed: false, moveX: 0, moveY: 0 } : { ...emptyCommand(), yaw: input.yaw, pitch: input.pitch });
      acc -= DT;
      steps++;
    }
    if (steps >= CONFIG.sim.maxStepsPerFrame) acc = 0;
  }

  // the ending cutscene: Erik's booth is in pieces
  if (mode === 'play' && endingAt != null && time >= endingAt) startEnding();
  if (mode === 'ending' && renderer.ending && renderer.ending.done) finishEnding();
  if (mode === 'intro' && renderer.ending && renderer.ending.done) finishIntro();

  if (mode === 'dying') {
    dyingT += fdt;
    if (dyingT > 2.2) {
      mode = 'over';
      input.enabled = false;
      input.releaseLock();
      hud.show(false);
      menus.showGameOver(sim.teamName, sim.rounds.round, player, gameOverLine);
      onlineOverButtons();
      if (sim.mode === 'zombies' && sim.rounds.round > progress.bestRound) { progress.bestRound = sim.rounds.round; saveProgress(progress); }
    }
  }

  const alpha = mode === 'play' || mode === 'dying' || mode === 'panel' || onlineLive ? acc / DT : 1;
  const look = { yaw: input.yaw, pitch: input.pitch, dx: input.frameDX, dy: input.frameDY };
  const worldDt = (mode === 'paused' || mode === 'over') && !onlineLive ? 0 : fdt;
  safely('render', () => renderer.render(worldDt, alpha, look, player, time, mode === 'title' || mode === 'online' ? 'title' : mode === 'charselect' ? 'showcase' : mode === 'lineup' ? 'lineup' : mode === 'ending' || mode === 'intro' ? 'ending' : 'play'));
  safely('listener', () => audio.updateListener(renderer.camera));
  if (mode === 'play' || mode === 'dying' || mode === 'panel') safely('sound', () => sound.update(fdt, player));
  safely('hud', () => hud.update(fdt, sim, player, renderer.camera, settings.showFps));
  rangeUI.update(fdt, sim, player, renderer.camera);
  if (menus.current === 'extras') extras.update();
  if (mode === 'lineup') lineupUI.update();
  input.endFrame();
}
requestAnimationFrame(frame);

// Online, the game can't stop when this tab is in the background (the browser
// stops drawing frames there): a tiny worker keeps the simulation ticking.
const pump = (() => {
  try { return new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 20);'], { type: 'text/javascript' }))); } catch { return null; }
})();
if (pump) pump.onmessage = () => {
  if (!document.hidden || !online || !online.inGame) return;
  if (!(mode === 'play' || mode === 'dying' || mode === 'paused' || mode === 'over' || mode === 'panel')) return;
  const now = performance.now();
  const fdt = Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  time += fdt;
  acc += fdt;
  let steps = 0;
  while (acc >= DT && steps < 20) { tick({ ...emptyCommand(), yaw: input.yaw, pitch: input.pitch }); acc -= DT; steps++; }
  if (steps >= 20) acc = 0;
  if (mode === 'dying') { dyingT += fdt; }
};

// Expose for debugging in the console.
window.STEW = {
  get sim() { return sim; }, renderer, CONFIG, input, rangeUI, hud, sound, audio, titleMusic, jukebox, progress, extras, menus, charSelect, lineupUI,
  get mode() { return mode; }, get online() { return online; }, net, pads, nav, get device() { return device; }, setInputDevice,
  debug: {
    // Run the simulation forward without rendering (for testing).
    run(seconds, patch = {}) {
      const n = Math.round(seconds / DT);
      for (let i = 0; i < n; i++) tick({ ...input.buildCommand(), ...patch, yaw: input.yaw, pitch: input.pitch });
    },
    look(yaw, pitch = 0) { input.setLook(yaw, pitch); },
    hold: debugHold, // e.g. STEW.debug.hold.ads = true
    // jump into the ending cutscene at `at` seconds (for testing)
    ending(at = 0) { if (mode !== 'ending') startEnding(); renderer.ending.t = at; },
    // jump into the intro at `at` seconds (for testing)
    intro(at = 0) { if (mode !== 'intro') startIntro('title'); renderer.ending.t = at; },

  },
};
refreshGlyphs();
// an invite link (?join=CODE) opens the online screen with the code filled in
{ const code = new URLSearchParams(location.search).get('join'); if (code) openOnline(code); else patchNotes.maybeShow(); }
document.body.dataset.ready = '1';
// paint the zombie heads and outfits while the player is still on the title screen
setTimeout(() => renderer.zombies.kit.build(), 400);
