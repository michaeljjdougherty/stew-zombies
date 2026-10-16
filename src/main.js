// =============================================================================
// STEW ZOMBIES — entry point. Wires simulation, input, rendering, audio, UI.
//
// Loop: fixed-step simulation (CONFIG.sim.tickRate) + interpolated rendering.
// The local player is just one entry in sim.players; co-op will add more
// players fed by network commands instead of this keyboard.
// =============================================================================
import { powerAllOn } from './sim/crustPower.js';
import { CONFIG } from './config.js';
import { SCHOOL } from './map/school.js';
import { CRUST } from './map/crust.js';
// zombies maps by id (the map screen's ids). The firing range is its own mode.
const ZOMBIE_MAPS = { lastbell: SCHOOL, crust: CRUST };
import { RANGE } from './map/range.js';
import { spawnHorde, clearZombies, setRangeRound, rangeGive, rangeTogglePerk, rangeDrop, rangeCheddars, rangeStewBombs, rangeMaisyDogs, rangeLbds, rangeGear } from './sim/range.js';
import { RangeUI } from './ui/range.js';
import { GameSim } from './sim/sim.js';
import { GameRenderer } from './render/renderer.js';
import { Input } from './input/input.js';
import { AudioEngine } from './audio/audio.js';
import { SoundDirector } from './audio/director.js';
import { IdleBeats } from './audio/idleBeat.js';
import { EMOTES, EMOTE_BY_ID } from './career/emotes.js';
import { EmoteWheel } from './ui/emoteWheel.js';
import { sample } from './audio/sfx.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menu.js';
import { loadSettings, saveSettings } from './ui/settings.js';
import { loadProgress, saveProgress } from './ui/progress.js';
import { Extras } from './ui/extras.js';
import { CharSelect } from './ui/charselect.js';
import { LineupUI } from './ui/lineupui.js';
import { MenuMusic, StewSong } from './audio/music.js';
import { GUN_SAMPLES, SAMPLE_PACK } from './audio/gunSamples.js';
import { gumIconURL } from './render/gumIcons.js';
import { voiceSprites } from './lore/voice.js';
import { ExploreUI } from './ui/explore.js';
import { questSkipTo, QUEST_SKIPS, QUEST_STEPS } from './sim/quest.js';
import { exploreJumpToRound } from './sim/rounds.js';
import { wakeTitan, titanApproach } from './sim/crustEgg.js';
import { forgeAllNow } from './sim/forge.js';
import { startFinale } from './sim/zachBoss.js';
import { Pads, BTN } from './input/gamepad.js';
import { setDevice, applyGlyphs, controlsList, glyph, legend } from './input/glyphs.js';
import { MenuNav } from './ui/menunav.js';
import { PatchNotes } from './ui/patchNotes.js';
import { Splash } from './ui/splash.js';
import { Career } from './career/career.js';
import { CareerTracker } from './career/tracker.js';
import { SignInUI, AchievementToast, refreshProfileChip, renderCareer, GumsUI, giftToast } from './ui/careerUI.js';
import { FactoryUI } from './ui/factoryUI.js';
import { ShopUI } from './ui/shopUI.js';
import { StoreBlade } from './ui/storeBlade.js';
import { LoadoutPicker } from './ui/loadoutPicker.js';
import { applySkin, SKINS } from './career/skins.js';
import { MapSelect, MAPS } from './ui/mapselect.js';
import { CutsceneUI } from './ui/cutscene.js';
import { TrailerUI } from './ui/trailerUI.js';
import { TrailerSong } from './audio/trailerSong.js';
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

const TITLE_MAP = CONFIG.title.map;   // the map behind the title screen and the menus
// --- careers: a username, its stats, achievements and GobbleGum (src/career/) ---
const career = new Career(CONFIG.career);
const careerTracker = new CareerTracker(career);
let sim = makeSim('zombies', TITLE_MAP);
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
audio.preloadPack(SAMPLE_PACK, GUN_SAMPLES);
// Gear sounds (thunder gun, knife, launcher, blasts); each falls back to its built-in synth sound until loaded
audio.preload({ g_laser: ['g_laser'], g_launch: ['g_launch'], g_land: ['g_land'], g_thunder: ['g_thunder'], g_knife_swing: ['g_knife_swing'], g_knife_hit: ['g_knife_hit'], g_launcher: ['g_launcher'], g_ray: ['g_ray'], g_boom: ['g_boom'] }, 'assets/sfx/gear/');
audio.preload({ g_boom_small: ['g_boom_small'] }, 'assets/sfx/gear/', '.ogg');
audio.preload({ pageTurn: ['page_turn'] }, 'assets/sfx/ui/');   // (the title's blades turning, like pages)
audio.preloadSprite(CONFIG.crust.hammers.sound.url, CONFIG.crust.hammers.sound.segs);   // the War Hammers
for (const v of voiceSprites()) audio.preloadSprite(v.url, v.segs);   // recorded voice lines (src/lore/voiceLines.js)
// the Cheddars' "Wanna play 2K?", if a recording has been dropped in (CONFIG.cheddar.lineAudio)
if (CONFIG.cheddar.lineAudio) audio.preload({ cheddarLine: [CONFIG.cheddar.lineAudio] }, '', '');
const sound = new SoundDirector(audio, sim, CONFIG);
const idleBeats = new IdleBeats(audio, CONFIG);   // (James's bass beat while he twerks)
const emoteWheel = new EmoteWheel();
// the emotes on your wheel: the free ones and the ones you've bought (Skin Shop)
const ownedEmotes = () => EMOTES.filter((e) => e.free || (career.ownsEmote ? career.ownsEmote(e.id) : true));
sound.localId = localId;
const hud = new HUD(CONFIG);
hud.roomNames = Object.fromEntries(SCHOOL.rooms.map((r) => [r.id, r.id === 'quad' ? 'the Quad' : r.id === 'principal' ? "the teachers' lounge" : 'the ' + r.name.replace(/^The /, '')]));
hud.localId = localId;
hud.localName = CHARACTERS[playableCharacter()].name;

hud.onNoteRead = (id) => {
  if (!progress.notes.includes(id)) { progress.notes.push(id); saveProgress(progress); }
};
const titleMusic = new MenuMusic(audio, settings, CONFIG.audio.menuSong);   // (The Kettle Liturgy, or the original theme)
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
  maisyDogs: () => rangeMaisyDogs(sim, player),
  lbds: () => rangeLbds(sim, player),
  drop: (id) => rangeDrop(sim, player, id),
  clear: () => clearZombies(sim),
  close: () => closeRangePanel(),
});
rangeUI.localId = localId;

// Explore: the menu (B / View): any gun, any round, any part of the Easter egg
const exploreUI = new ExploreUI(CONFIG, {
  give: (id) => rangeGive(sim, player, id),
  gear: (id) => rangeGear(sim, player, id),
  round: (n) => { exploreJumpToRound(sim, n); updateExploreHud(); },
  zombies: (on) => { sim.setExploreZombies(on); updateExploreHud(); exploreUI.refresh(); },
  skip: (id) => exploreSkip(id),
  titan: (id) => exploreTitan(id),
  crust: (step) => exploreCrust(step),
  close: () => closeExplorePanel(),
});

// Call of the Crust: go straight to a titan and wake it (any one already up goes back to sleep).
function exploreTitan(id) {
  const E = sim.crustEgg;
  if (!E) return;
  const s = sim.mapData.titans.find((t) => t.id === id);
  if (E.active) { const T = E.titans[E.active]; Object.assign(T.pos, T.home); T.state = 'asleep'; T.act = null; E.active = null; E.hazards.length = 0; }
  const T = E.titans[id];
  if (T.state === 'dead') { T.state = 'asleep'; Object.assign(T.pos, T.home); }
  const p = player;
  // stand back from it on solid ground, facing it (the Captain: on the north shore; the Fiend: at a field gun)
  const at = titanApproach(sim, id);
  p.pos.x = at.x; p.pos.z = at.z; p.pos.y = at.y + 0.3;
  p.vel.x = p.vel.y = p.vel.z = 0; p.region = null;
  input.setLook(at.yaw, 0.15);
  wakeTitan(sim, id, p);
}

// Call of the Crust's egg past the titans: the four War Hammers on the Anvil, or straight to Big Evil Zach.
function exploreCrust(step) {
  const E = sim.crustEgg;
  if (!E || !E.forge) return;
  if (E.active) { const T = E.titans[E.active]; Object.assign(T.pos, T.home); T.state = 'asleep'; T.act = null; E.active = null; E.hazards.length = 0; }
  forgeAllNow(sim);
  const p = player, f = sim.mapData.forge;
  p.pos.x = 0; p.pos.z = 6.5; p.pos.y = f.y + 0.5; p.vel.x = p.vel.y = p.vel.z = 0; p.region = null;
  input.setLook(0, 0);
  if (step === 'zach') { E.forge.rung = true; startFinale(sim); }
}

// Jump to part of the egg. Going back (or redoing the part you're on) starts Explore over first.
function exploreSkip(id) {
  const s = QUEST_SKIPS.find((x) => x.id === id);
  if (!s || !sim.quest) return;
  if (QUEST_STEPS.indexOf(s.step) <= QUEST_STEPS.indexOf(sim.quest.step)) restart('explore');
  questSkipTo(sim, id, player);
}
renderer.rig.onFootstep = (sprint, speed) => sound.playerFootstep(sprint, speed);

// 'title' | 'play' | 'paused' | 'dying' | 'over' | 'ending'
let mode = 'title';
let dyingT = 0;
let endingAt = null;          // when the ending cutscene starts (after Erik's booth goes)
const cutsceneUI = new CutsceneUI();

// Who you're playing (Brian only once The Final Whistle is done).
function playableCharacter() {
  const id = settings.character;
  const ok = CHARACTERS[id] && (CHARACTERS[id].playable || (CHARACTERS[id].unlock === 'quest' && progress.questDone) || (CHARACTERS[id].rescue === 'crust' && progress.crustDone));
  return ok ? id : 'kearns';
}

// How you look: the character, wearing their skin from the Skin Shop (your
// arms in first person; the character screens show it on the platform)
function setLook(id) {
  renderer.setCharacter(id, settings.shirt);
  const skin = career.wornSkin(id);
  if (skin && CHARACTERS[id] && renderer.viewmodel && renderer.viewmodel.setCharacter) renderer.viewmodel.setCharacter(applySkin(CHARACTERS[id], id, skin));
}

function makeSim(gameMode, mapId = 'lastbell') {
  const s = new GameSim({ map: gameMode === 'range' ? RANGE : ZOMBIE_MAPS[mapId] || SCHOOL, cfg: CONFIG, teamName: 'Stew', mode: gameMode });
  s.addPlayer(localId, 'Stew', { character: playableCharacter(), gums: career.packForGame(), skin: career.wornSkin(playableCharacter()) });
  return s;
}

function applySettings(s) {
  saveSettings(s);
  renderer.applySettings(s);
  audio.setVolume('master', s.master);
  audio.setVolume('music', s.music);
  audio.setVolume('voice', s.voice);
  titleMusic.refresh();   // (the menu music picked in Settings)
  hud.subtitles = s.subtitles;
}

const menus = new Menus(settings, {
  play: () => openMapSelect(),
  range: () => { if (sim.mode !== 'range') restart('range'); startPlaying(); },
  explore: () => { if (sim.mode !== 'explore') restart('explore'); startPlaying(); },
  resume: () => startPlaying(),
  restart: () => {
    if (online) { if (online.isHost) { online.backToLobby(); showOnlineLobby(); } return; }
    restart(sim.mode === 'range' ? 'range' : sim.mode, sim.mapData.id); startPlaying();
  },
  online: () => openOnline(),
  quit: () => { if (online) leaveOnline(); restart('zombies', TITLE_MAP); updateExploreHud(); mode = 'title'; hud.show(false); menus.show('title'); input.releaseLock(); startTitleMusic(); },
  settingsChanged: (s) => { applySettings(s); if (device !== 'kbm') { device = null; setInputDevice(pads.type); } },
  extras: () => { menus.show('extras'); extras.open(); },
  trailer: (o = {}) => startTrailer(o),
  // the trailer's graphics: whatever was picked last time, else what suits this device
  trailerQuality: () => settings.trailerQuality || (isTouch() ? CONFIG.trailer.touchPreset : 'high'),
  extrasBack: () => { if (jukebox.playing) { jukebox.stop(0.5); startTitleMusic(); } menus.show('title'); },
  characters: () => { mode = 'charselect'; menus.show('charselect'); charSelect.open(); },
  career: () => { renderCareer(career); menus.show('career'); },
  // (the GobbleGum blade shows your pack and your Divinium)
  bladeOpened: (id, flip) => { if (id === 'gums') refreshGumBlade(); if (id === 'store') refreshStoreBlade(); if (flip && audio.ready) audio.play(sample, { key: 'pageTurn', gain: 0.8 }, { gain: 1, reverb: 0.05 }); },
});
const charSelect = new CharSelect(settings, {
  preview: (id, shirt) => { const S = renderer.getShowcase(); S.setEmote(null); S.setStyle(null); S.show(id, shirt, career.wornSkin(id)); },
  questDone: () => !!progress.questDone,
  crustDone: () => !!progress.crustDone,
  done: (s) => {
    saveSettings(s); renderer.showcase.hide();
    setLook(playableCharacter());
    hud.localName = CHARACTERS[playableCharacter()].name;
    if (sim.mode === 'zombies') restart('zombies', TITLE_MAP);   // the next game starts as them
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
  watchFilm: (name) => startFilm(name, 'extras'),   // (Call of the Crust's intro and ending)
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
  pick: (ch) => { if (online) online.pick(ch, career.wornSkin(ch)); },
  // your skin in the lobby: the ones you have that fit who you're playing (it's what you wear on them from now on)
  skins: (ch) => ownedSkins(ch),
  setSkin: (ch, id) => { if (career.wearSkin(ch, id || null) && online) online.setSkin(id || null); },
  setMap: (id) => { if (online) online.setMap(id); },
  setIntro: (on) => { if (online) online.setIntro(on); },
  start: () => { if (online) online.start(); },
  leave: () => { leaveOnline(); onlineUI.open(); },
  back: () => { mode = 'title'; menus.show('title'); },
});

function newSession(name) {
  if (online) leaveOnline();
  online = new OnlineSession({
    name, character: playableCharacter(), skin: career.wornSkin(playableCharacter()), brian: !!progress.questDone, local: NET_LOCAL, gums: career.packForGame(),
    onLobby: (lobby) => { if (online && !online.inGame) onlineUI.showLobby(lobby, online.isHost); },
    onStart: (st) => startOnlineGame(st),
    onGame: (from, m) => { if (m.t === 'introDone') { hostIntroDone(); return; } if (net.host) net.host.onMessage(from, m); else if (net.client) net.client.onMessage(m); else if (m.t === 's' && earlyState) earlyState.push(m); },
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
  restart('zombies', TITLE_MAP);
  mode = 'online';
  input.enabled = false; input.releaseLock();
  hud.show(false);
  menus.show('online');
  if (online) onlineUI.showLobby({ ...online.lobby(), you: online.you }, online.isHost);
  startTitleMusic();
}

// The game's starting: with the map's intro first (the host's call), everyone
// watches it; the host can skip it, and the game starts for everyone when the
// host's ends (friends whose copy finishes first wait for them).
let onlineStart = null, hostDoneIntro = false;
// (a friend: the host's game updates that come in before our copy of the game is
// up, kept for it: the first one is the whole picture)
let earlyState = null;
function startOnlineGame(st) {
  earlyState = online && !online.isHost ? [] : null;
  const intro = st.intro && (st.map === 'crust' || st.map === 'lastbell' || !st.map);
  if (!intro) { beginOnlineGame(st); return; }
  onlineStart = st; hostDoneIntro = false;
  if (st.map === 'crust') startFilm('intro', 'online'); else startIntro('online');
  if (!online.isHost) cutsceneUI.show('the host can skip');
}
// (a friend) the host's intro is over: in we go
function hostIntroDone() {
  hostDoneIntro = true;
  if (onlineStart && (mode === 'film' || mode === 'intro')) endOnlineIntro();
}
// skip a cutscene: online, only the host can skip the intro (for everyone)
function skipCutscene() {
  if (!renderer.ending) return;
  if ((filmThen === 'online' || introThen === 'online') && online && !online.isHost) return;
  renderer.ending.skip();
}
// the intro's over here: the host tells everyone and starts; a friend waits for the host
function endOnlineIntro() {
  if (!onlineStart) return false;
  if (online && online.isHost) online.send(null, { t: 'introDone' });
  else if (!hostDoneIntro) { if (!onlineStart.waiting) { onlineStart.waiting = true; cutsceneUI.line('', 'Waiting for the host…', 999); } return true; }
  const st = onlineStart; onlineStart = null;
  renderer.endEnding(); cutsceneUI.hide(); trailerUI.hide();
  filmThen = null; introThen = null;
  if (st.map === 'crust') { if (!progress.crustIntroSeen) { progress.crustIntroSeen = true; saveProgress(progress); } }
  else if (!progress.introSeen) { progress.introSeen = true; saveProgress(progress); }
  if (!online) { restart('zombies', TITLE_MAP); mode = 'title'; menus.show('title'); return false; }
  beginOnlineGame(st);
  return false;
}
function beginOnlineGame(st) {
  localId = st.you;
  // (the map the host picked: an older host never says, and that was always the school)
  const s = new GameSim({ map: ZOMBIE_MAPS[st.map] || SCHOOL, cfg: CONFIG, teamName: 'Stew', mode: 'zombies', seed: st.seed });
  for (const m of st.members) s.addPlayer(m.id, m.name, { character: m.character, gums: m.gums || null, skin: m.skin || null });
  stopOnlineGame();
  installSim(s);
  if (online.isHost) {
    net.host = new NetHost(sim, (to, m) => online && online.send(to, m));
    for (const p of st.peers) net.host.addRemote(p.peer, p.id);
  } else {
    net.client = new NetClient(sim, localId, (m) => online && online.send(null, m));
    if (earlyState) for (const m of earlyState) net.client.onMessage(m);
  }
  earlyState = null;
  // (who you are in this game: on the Crust, someone who picked Pit is someone else)
  const me = sim.playerById(localId);
  setLook(me.character);
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
  if (localId !== 'p1') { localId = 'p1'; restart('zombies', TITLE_MAP); }
  hud.localName = CHARACTERS[playableCharacter()].name;
  setLook(playableCharacter());
}

// the connection is gone (host left, kicked, network)
function onlineEnded(reason) {
  const wasPlaying = !!(net.host || net.client);
  online = null;
  stopOnlineGame();
  if (wasPlaying || mode !== 'online') {
    localId = 'p1';
    restart('zombies', TITLE_MAP);
    input.enabled = false; input.releaseLock();
    hud.show(false);
    if (renderer.ending) { renderer.endEnding(); cutsceneUI.hide(); }
  }
  hud.localName = CHARACTERS[playableCharacter()].name;
  setLook(playableCharacter());
  mode = 'online';
  menus.show('online');
  onlineUI.open();
  if (reason) onlineUI.status(reason, true);
  startTitleMusic();
}

let splash = null;   // the boot logo (made below, once the menus are wired up)
// Title theme: browsers only allow sound after the first click or key press.
function startTitleMusic() {
  if (splash && splash.active) return;   // (it starts once the logo's gone)
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
setLook(playableCharacter());
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
  hud.hardcore = settings.questHints === 'hardcore' && sim.mode !== 'explore';   // (Explore always shows the egg's steps)
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
    // Map 2: its own intro (the first time, or when asked for), then in
    if (id === 'crust') { if (withIntro) { startFilm('intro', 'play'); return; } restart('zombies', 'crust'); startPlaying(); return; }
    if (withIntro) { startIntro('play'); return; }
    if (sim.mode !== 'zombies' || sim.mapData.id !== 'lastbell') restart('zombies');
    startPlaying();
  },
  explore: (id) => { mapSelect.close(); restart('explore', id); startPlaying(); },
  watchIntro: (id) => { mapSelect.close(); if (id === 'crust') startFilm('intro', 'maps'); else startIntro('maps'); },
  back: () => { mapSelect.close(); menus.show('title'); },
  introSeen: (id) => (id === 'crust' ? !!progress.crustIntroSeen : !!progress.introSeen),
  hints: () => settings.questHints || 'walkthrough',
  setHints: (v) => { settings.questHints = v === 'hardcore' ? 'hardcore' : 'walkthrough'; saveSettings(settings); },
});
function openMapSelect() {
  menus.show('mapselect');
  mapSelect.open();
  loadout.render();
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

// The Call of the Crust trailer (Main menu > Watch Trailer): the real map, a
// scripted camera, the song. No HUD, no menus; the mouse brings up Skip.
const trailerUI = new TrailerUI(() => skipCutscene());
let trailerSong = null;
const isTouch = () => (window.matchMedia && matchMedia('(pointer: coarse)').matches) || /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
function startTrailer({ silent = false, recording = false, quality = null } = {}) {
  audio.init(); audio.applyVolumes();
  titleMusic.stop(0.4);
  if (jukebox.playing) jukebox.stop(0.3);
  restart('zombies', 'crust');
  menus.hideAll();
  mode = 'trailer';
  input.enabled = false;
  input.reset();
  input.releaseLock();
  hud.show(false);
  sim.rounds.phase = 'pregame'; sim.rounds.timer = 1e9;
  sim.power = true;
  powerAllOn(sim);
  // the picture: the graphics picked for it (remembered), full screen
  if (!recording) {
    if (quality) { settings.trailerQuality = quality; saveSettings(settings); }
    const q = quality || settings.trailerQuality || (isTouch() ? CONFIG.trailer.touchPreset : 'ultra');
    renderer.applySettings({ ...settings, ...CONFIG.graphics.presets[q] });
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }
  const T = renderer.startTrailer();
  T.recording = recording;
  trailerUI.show(CONFIG.trailer.letterbox);
  // iPhone: play the song even with the ringer on silent (it's a video, not a beep)
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
  if (!silent && audio.ctx) {
    // the song is the clock: the picture follows it (no seeking it back to the picture)
    const song = trailerSong = new TrailerSong(audio.ctx, CONFIG.trailer.song);
    song.setVolume(trailerVolume());
    const t0 = performance.now();
    T.clock = () => {
      if (song.playing) return song.time();
      if (song.loaded) { song.play(T.t); return T.t; }
      // (no song after a while: run on the frame clock)
      if (song.failed || performance.now() - t0 > CONFIG.trailer.songWait * 1000) { T.clock = null; return T.t; }
      return null;
    };
    T.onSeek = (t) => { if (song.loaded) song.play(t); };
  }
  return T;
}
const trailerVolume = () => Math.min(1, (settings.master ?? 1) * Math.max(0.6, settings.music ?? 1));
function updateTrailer() {
  const T = renderer.ending;
  if (!T) return;
  trailerUI.update(T, T.recording);
  // the song: in step with the picture, fading out at the end
  if (trailerSong) {
    const [f0, f1] = CONFIG.trailer.fadeOut;
    const k = Math.min(1, Math.max(0, (T.t - f0) / (f1 - f0)));
    const v = trailerVolume() * (1 - k);
    if (Math.abs(v - (trailerSong.vol ?? -1)) > 0.01) { trailerSong.vol = v; trailerSong.setVolume(v); }
  }
}
function finishTrailer() {
  renderer.endEnding();
  renderer.applySettings(settings);
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  trailerUI.hide();
  if (trailerSong) { trailerSong.stop(); trailerSong = null; }
  restart('zombies', TITLE_MAP);
  mode = 'title';
  menus.show('title');
  startTitleMusic();
}

function finishIntro() {
  if (introThen === 'online') { endOnlineIntro(); return; }
  renderer.endEnding();
  cutsceneUI.hide();
  if (!progress.introSeen) { progress.introSeen = true; saveProgress(progress); }
  const then = introThen; introThen = null;
  restart('zombies', then === 'play' ? 'lastbell' : TITLE_MAP);
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
    restart('zombies', TITLE_MAP);
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

// Call of the Crust's cutscenes (src/render/crustFilms.js), through the trailer's
// machinery: the intro before a game (or watched from the map screen), the
// ending once Zach's free. then: 'play' | 'maps' | 'victory'
let filmThen = null;
function startFilm(name, then) {
  if (renderer.ending) renderer.endEnding();
  audio.init(); audio.applyVolumes();
  titleMusic.stop(0.6);
  if (jukebox.playing) jukebox.stop(0.3);
  if (name === 'intro' || !sim.mapData.forge) restart('zombies', 'crust');   // (watched from somewhere else: the Crust first)
  else sim.zombies.length = 0;
  menus.hideAll();
  filmThen = then;
  mode = 'film';
  input.enabled = false;
  input.reset();
  input.releaseLock();
  hud.show(false);
  sim.rounds.phase = 'pregame'; sim.rounds.timer = 1e9;
  sim.power = true;
  if (name !== 'intro') powerAllOn(sim);   // (the Crust: every island lit, the launchers live; in the intro the power's still out)
  const T = renderer.startFilm(name);
  T.onLine = (who, text, secs) => { if (settings.subtitles !== false) trailerUI.say(who, text, secs + 0.4, T.t); sound.voiceLine(who, text, secs); };   // (the subtitles go on the trailer's overlay: the cutscene one's hidden under it)
  T.onCue = (n) => sound.cue(n);
  cutsceneUI.show(`${glyph('skip')} skip`);
  cutsceneUI.root.classList.remove('on');   // (the trailer overlay draws the bars; this one's just the words)
  trailerUI.show(CONFIG.crustFilms[name].letterbox);
  return T;
}
function finishFilm() {
  if (filmThen === 'online') { if (endOnlineIntro()) return; return; }
  renderer.endEnding();
  cutsceneUI.hide();
  trailerUI.hide();
  const then = filmThen; filmThen = null;
  if (then === 'victory') { showCrustVictory(); return; }
  if (then === 'extras') { restart('zombies', TITLE_MAP); mode = 'title'; menus.show('extras'); extras.open('story'); startTitleMusic(); return; }
  if (!progress.crustIntroSeen) { progress.crustIntroSeen = true; saveProgress(progress); }
  if (then === 'play') { restart('zombies', 'crust'); startPlaying(); return; }
  restart('zombies', TITLE_MAP);
  mode = 'title';
  if (then === 'maps') openMapSelect(); else menus.show('title');
  startTitleMusic();
}

// Call of the Crust is done: Zach's free (and playable from now on). The ending first.
function crustVictory() { startFilm('ending', 'victory'); }
function showCrustVictory() {
  mode = 'over';
  input.enabled = false;
  input.releaseLock();
  hud.show(false);
  const firstTime = !progress.crustDone;
  if (firstTime) { progress.crustDone = true; saveProgress(progress); }
  if (sim.mode === 'zombies' && sim.rounds.round > progress.bestRound) { progress.bestRound = sim.rounds.round; saveProgress(progress); }
  menus.showVictory(sim.rounds.round, player, firstTime, {
    eyebrow: 'Call of the Crust · complete',
    big: 'Zach is <em>back</em>. The Schnitz isn\'t done.',
    unlock: '<b style="color:#7fe08a">Zach is now playable.</b> Pick him under Characters.',
    note: 'Pit forged the War Hammers. To be continued.',
  });
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

function openExplorePanel() {
  if (mode !== 'play' || sim.mode !== 'explore') return;
  mode = 'panel';
  input.enabled = false;
  input.reset();
  input.releaseLock();
  exploreUI.open(sim, player);
}

function closeExplorePanel() {
  if (mode !== 'panel') return;
  exploreUI.close();
  startPlaying();
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

function restart(gameMode = sim.mode, mapId = 'lastbell') { installSim(makeSim(gameMode, mapId)); }

// Swap in a new game (a fresh solo one, or the one an online game starts with).
function installSim(s) {
  const mapChanged = s.mapData !== sim.mapData;
  sim = s;
  sound.sim = sim;   // (before the ambience restarts below: it reads the new map)
  player = sim.playerById(localId);
  renderer.localId = sound.localId = hud.localId = rangeUI.localId = localId;
  hud.localCharacter = sound.localCharacter = player.character;
  career.playingAs = player.character;   // (kills as them count toward their Opal skin)
  // (Call of the Crust: Pit's at his forge, so whoever picked him is someone else there)
  if (!renderer.character || renderer.character.id !== player.character) setLook(player.character);
  hud.localName = CHARACTERS[player.character] ? CHARACTERS[player.character].name : hud.localName;
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
    if (mode === 'play') { if (sim.mode === 'explore') openExplorePanel(); else openRangePanel(); }
    else if (mode === 'panel') { if (exploreUI.isOpen) closeExplorePanel(); else closeRangePanel(); }
  }
  if ((mode === 'ending' || mode === 'intro' || mode === 'trailer' || mode === 'film') && ['Escape', 'Space', 'Enter', 'KeyF'].includes(e.code) && !e.repeat) { skipCutscene(); return; }
  if (e.code === 'Escape' && mode === 'panel') { if (exploreUI.isOpen) closeExplorePanel(); else closeRangePanel(); return; }
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
  safely('career', () => careerTracker.tick(sim, localId, DT, { hardcore: !!hud.hardcore }));
  for (const e of events) safely('render:' + e.type, () => renderer.onEvents([e]));
  for (const e of events) {
    safely('career:' + e.type, () => careerTracker.onEvent(e, sim, localId));
    safely('sound:' + e.type, () => sound.onEvent(e));
    safely('hud:' + e.type, () => hud.onEvent(e));
    safely('range:' + e.type, () => rangeUI.onEvent(e));
    if (e.type === 'gameOver' && mode === 'play') { mode = 'dying'; dyingT = 0; }
    if ((e.type === 'erikSays' || e.type === 'schnitzSays') && e.cat === 'gameOver') gameOverLine = e.text;
    if (e.type === 'stewSong' && !progress.song) { progress.song = true; saveProgress(progress); }
    if (e.type === 'bossEnd') endingAt = time + 2.4;
    if (e.type === 'crustVictory' && mode === 'play') crustVictory();
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

const BACK_BUTTON = { shop: 'btn-sh-back', gums: 'btn-gums-back', factory: 'btn-mf-back', career: 'btn-career-back', mapselect: 'ms-back', online: 'btn-on-back', settings: 'btn-settings-back', pause: 'btn-resume', extras: 'btn-extras-back', charselect: 'btn-cs-back', lineup: 'lu-back', rangepanel: 'rp-close', explorepanel: 'ep-close' };
const EXTRA_TABS = ['story', 'notes', 'howto', 'jukebox', 'patch', 'credits'];
// --- careers: a username, its stats and achievements (src/career/; made up top) ---
const achToast = new AchievementToast(() => sound.achievement());
career.onUnlock = (a) => achToast.push(a);
career.onGift = (g) => achToast.push(giftToast(g));
// GobbleGum: the pack you take into games, and Dr. Monty's Factory
const gumsUI = new GumsUI(career, { back: () => menus.show('title') });
document.getElementById('btn-gums').addEventListener('click', () => { gumsUI.open(); menus.show('gums'); });
// Dr. Monty's Factory: its own screen (back goes to wherever you came from)
let factoryFrom = 'title';
const factoryUI = new FactoryUI(career, {
  back: () => { if (factoryFrom === 'gums') gumsUI.open(); menus.show(factoryFrom); if (factoryFrom === 'title') refreshGumBlade(); },
  sound: (stage, n) => sound.factory(stage, n),
});
const openFactory = (from) => { factoryFrom = from; menus.show('factory'); factoryUI.open(); };
document.getElementById('btn-gums-factory').addEventListener('click', () => openFactory('title'));
document.getElementById('btn-gm-factory').addEventListener('click', () => openFactory('gums'));
// The GobbleGum blade on the title: your five, and your vials
function refreshGumBlade() {
  const el = document.getElementById('b-pack');
  if (!el) return;
  const pack = career.gums.pack.join();
  if (el.dataset.pack !== pack) {   // (only when it's changed: no re-decoding the logos on every flip)
    el.dataset.pack = pack;
    el.innerHTML = career.gums.pack.map((id) => `<img alt="${CONFIG.gobblegum.gums[id].name}" title="${CONFIG.gobblegum.gums[id].name}" src="${gumIconURL(id, 116)}">`).join('');
  }
  document.getElementById('b-div').textContent = String(career.gums.divinium);
}
// The Stew Store: Stew Bucks for skins and emotes (its own blade on the title)
const shopUI = new ShopUI(career, {
  characters: () => Object.entries(CHARACTERS).filter(([id, c]) => c.playable || (c.unlock === 'quest' && progress.questDone) || (c.rescue === 'crust' && progress.crustDone)).map(([id, c]) => ({ id, name: c.name })),
  current: () => playableCharacter(),
  preview: (id, skin, act = null) => { const S = renderer.getShowcase(); S.setStyle('store'); S.show(id, settings.shirt, skin); S.setEmote(act); },
  thumb: (spec, done) => renderer.getShowcase().thumb(spec, done),
  back: () => { const S = renderer.showcase; S.hide(); S.setEmote(null); S.setStyle(null); setLook(playableCharacter()); mode = 'title'; menus.show('title'); refreshStoreBlade(); },
  sound: (k) => sound.factory(k === 'deny' ? 'deny' : 'open', 0),
});
const openShop = (tab, pick = null) => { mode = 'shop'; menus.show('shop'); shopUI.open(tab, pick); };
document.getElementById('btn-shop').addEventListener('click', () => openShop('skins'));
document.getElementById('btn-shop-emotes').addEventListener('click', () => openShop('emotes'));
document.getElementById('btn-shop-pass').addEventListener('click', () => openShop('pass'));
// "Playing as" on the map screen: who you are and what they're wearing (the same
// choices as Characters and the Stew Store)
const ownedSkins = (ch) => [{ id: '', name: 'Own clothes' }, ...SKINS.filter((s) => career.ownsSkin(s.id, ch)).map((s) => ({ id: s.id, name: s.name }))];
const loadout = new LoadoutPicker({
  characters: shopUI.h.characters,
  current: () => playableCharacter(),
  pickChar: (id) => { settings.character = id; saveSettings(settings); setLook(playableCharacter()); hud.localName = CHARACTERS[playableCharacter()].name; },
  skins: ownedSkins,
  worn: (ch) => career.wornSkin(ch) || '',
  pickSkin: (ch, id) => { career.wearSkin(ch, id || null); setLook(playableCharacter()); },
});
// (the Stew Store blade: your Bucks, and Featured today)
const storeBlade = new StoreBlade(career, { characters: shopUI.h.characters, thumb: shopUI.h.thumb, open: openShop });
function refreshStoreBlade() { storeBlade.refresh(); }
career.onSkinUnlock = (skin, ch) => achToast.push({ head: 'Skin unlocked', badge: CHARACTERS[ch] ? CHARACTERS[ch].name : 'New skin', title: skin.name });
// a Battle Pass tier: what it gave you
career.onPassTier = (t) => achToast.push({ head: `Battle Pass · Tier ${t.tier}`, badge: t.kind === 'bucks' ? `+${t.n}` : t.kind === 'emote' ? 'New emote' : 'New skin', title: t.kind === 'bucks' ? `${t.n} ${CONFIG.shop.currency}` : t.item ? t.item.name : 'Tier up' });
career.onBucks = (n, why) => {
  const C = CONFIG.shop;
  if (why === 'backpay') achToast.push({ head: 'Stew Store', badge: `${n} ${C.currency}`, title: 'For the achievements you already have' });
  else hud.toast(`+${n} ${C.currency}`, 'Spend them in the Stew Store', '#e8b13a', 2.6);
};
// Settings blade: switch username (then back to the title)
document.getElementById('btn-title-signin').addEventListener('click', () => {
  signIn.h.done = () => { afterSignIn(); refreshGumBlade(); menus.show('title'); };
  menus.show('signin'); signIn.open();
});
careerTracker.onDivinium = () => hud.toast('Liquid Divinium', '+1 vial · spend it at Dr. Monty\'s Factory', '#5ad1e8', 2.6);
career.onChange = () => { refreshProfileChip(career); if (menus.current === 'career') renderCareer(career); if (menus.blade === 'gums') refreshGumBlade(); if (menus.blade === 'store') refreshStoreBlade(); };
const signIn = new SignInUI(career, { done: () => {} });
function afterSignIn() {
  // your username is your name online too
  if (career.signedIn && settings.name !== career.profile.name) { settings.name = career.profile.name; saveSettings(settings); }
  refreshProfileChip(career);
  setLook(playableCharacter());   // (this username's skins)
}
$id('btn-career-back').addEventListener('click', () => menus.show('title'));
$id('btn-career-switch').addEventListener('click', () => {
  signIn.h.done = () => { afterSignIn(); renderCareer(career); menus.show('career'); };
  menus.show('signin'); signIn.open();
});
window.addEventListener('pagehide', () => career.flush());
refreshProfileChip(career);
const patchNotes = new PatchNotes();
const bootParams = new URLSearchParams(location.search);
splash = new Splash(CONFIG.splash, {
  // (inside the click / key press, so the browser lets the sound out)
  sound: () => { audio.init(); audio.applyVolumes(); sound.splash(CONFIG.splash.moans); },
  done: () => {
    startTitleMusic();
    if (bootParams.get('join')) return;
    // who's playing? (then the title, and any new patch notes)
    signIn.h.done = () => { afterSignIn(); menus.show('title'); patchNotes.maybeShow(); };
    menus.show('signin');
    signIn.open();
  },
});
const nav = new MenuNav({
  root: () => (splash.active ? $id('splash') : patchNotes.isOpen ? $id('patchnotes') : mode === 'panel' ? $id(exploreUI.isOpen ? 'explorepanel' : 'rangepanel') : menus.current ? $id(menus.current) : null),
  back: (id) => { if (id === 'splash') { splash.press(); return; } if (id === 'patchnotes') { patchNotes.close(); return; } const b = id === 'online' && !$id('on-lobby').hidden ? 'btn-on-leave' : BACK_BUTTON[id]; if (b) $id(b).click(); },
  start: (id) => { if (id === 'splash') splash.press(); else if (id === 'patchnotes') patchNotes.close(); else if (id === 'pause' || id === 'rangepanel' || id === 'explorepanel') $id(BACK_BUTTON[id]).click(); },
  view: (id) => { if (id === 'rangepanel') closeRangePanel(); else if (id === 'explorepanel') closeExplorePanel(); },
  bumper: (id, dir) => {
    if (id === 'title') menus.flipBlade(dir);
    else if (id === 'mapselect') { const ids = MAPS.map((m) => m.id); mapSelect.select(ids[(ids.indexOf(mapSelect.sel) + dir + ids.length) % ids.length]); }
    else if (id === 'extras') { const i = EXTRA_TABS.indexOf(extras.tab); extras.open(EXTRA_TABS[(i + dir + EXTRA_TABS.length) % EXTRA_TABS.length]); }
    else if (id === 'charselect') { const ids = Object.keys(SHIRT_COLORS); charSelect.shirt = ids[(ids.indexOf(charSelect.shirt) + dir + ids.length) % ids.length]; charSelect.refresh(); }
    else if (id === 'shop') shopUI.cycleChar(dir);
    else if (id === 'lineup') { const L = renderer.getLineup(); const n = LINEUP.length + 1; L.setFocus(((L.focus + 1 + dir + n) % n) - 1); lineupUI.refresh(); }
  },
  rotate: (id, a) => {
    if (id === 'charselect' || id === 'shop') renderer.showcase.turn(a);
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
  if ((mode === 'ending' || mode === 'intro' || mode === 'trailer' || mode === 'film') && st && (st.pressed(BTN.A) || st.pressed(BTN.B) || st.pressed(BTN.MENU))) skipCutscene();
  // menus first (no menu is up while playing, so this only tracks the screen)
  nav.frame(st, fdt);
  if (!st || !playing) { input.padFrame(null, fdt); return; }
  input.padFrame(st, fdt);
  // hold Back/View for the scoreboard (in the range and Explore it does their thing)
  if (sim.mode === 'zombies') { const sb = st.down(BTN.VIEW); if (sb !== padBoard) { padBoard = sb; hud.showScoreboard(sb || keyBoard); } }
  if (st.pressed(BTN.MENU)) { input.releaseLock(); pause(); }
  else if (st.pressed(BTN.VIEW) && sim.mode !== 'zombies') {
    if (sim.mode === 'range') openRangePanel();
    else if (sim.mode === 'explore') openExplorePanel();
  }
}

let capAt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  // Settings › Frame rate cap: skip display refreshes until the next frame is due
  const cap = settings.fpsCap | 0;
  if (cap > 0) {
    const iv = 1000 / cap;
    if (now - capAt < iv - 2) return;
    capAt = now - capAt > iv * 2 ? now : capAt + iv;
  }
  const fdt = Math.min(0.1, Math.max(0, (now - last) / 1000)); // rAF time can start before the clock we read at load
  last = now;
  time += fdt;
  padFrame(fdt);
  safely('emoteWheel', () => {
    const pick = emoteWheel.update(input, ownedEmotes(), mode === 'play' && !!player && player.alive && !player.downed);
    if (pick) input.pendingEmote = pick;
  });
  if (mode === 'play') renderer.frameTime(fdt, cap > 0 ? Math.min(cap, 60) : 60);   // auto resolution

  // (online the game goes on while you're in the pause menu)
  const onlineLive = !!(online && online.inGame && (mode === 'paused' || mode === 'over'));
  if (mode === 'play' || mode === 'dying' || mode === 'panel' || onlineLive) {
    acc += fdt;
    let steps = 0;
    while (acc >= DT && steps < CONFIG.sim.maxStepsPerFrame) {
      const cmd = input.buildCommand();
      tick(mode === 'play' ? cmd : mode === 'dying' || mode === 'panel' ? { ...cmd, fire: false, firePressed: false, moveX: 0, moveY: 0, away: true } : { ...emptyCommand(), yaw: input.yaw, pitch: input.pitch, away: true });
      acc -= DT;
      steps++;
    }
    if (steps >= CONFIG.sim.maxStepsPerFrame) acc = 0;
  }

  // the ending cutscene: Erik's booth is in pieces
  if (mode === 'play' && endingAt != null && time >= endingAt) startEnding();
  if (mode === 'ending' && renderer.ending && renderer.ending.done) finishEnding();
  if (mode === 'intro' && renderer.ending && renderer.ending.done) finishIntro();
  if (mode === 'trailer') { if (renderer.ending && renderer.ending.done) finishTrailer(); else updateTrailer(); }
  if (mode === 'film') { if (renderer.ending && renderer.ending.done) finishFilm(); else if (renderer.ending) trailerUI.update(renderer.ending, false); }

  if (mode === 'dying') {
    dyingT += fdt;
    if (dyingT > 2.2) {
      mode = 'over';
      input.enabled = false;
      input.releaseLock();
      hud.show(false);
      menus.showGameOver(sim.teamName, sim.rounds.round, player, gameOverLine, careerTracker.on && careerTracker.sim === sim ? careerTracker.divinium : 0);
      onlineOverButtons();
      if (sim.mode === 'zombies' && sim.rounds.round > progress.bestRound) { progress.bestRound = sim.rounds.round; saveProgress(progress); }
    }
  }

  const alpha = mode === 'play' || mode === 'dying' || mode === 'panel' || onlineLive ? acc / DT : 1;
  const look = { yaw: input.yaw, pitch: input.pitch, dx: input.frameDX, dy: input.frameDY };
  const worldDt = (mode === 'paused' || mode === 'over') && !onlineLive ? 0 : fdt;
  // (the Stew Store blade's pictures are drawn by the store's platform, one a frame, before the title's own frame)
  if (mode === 'title' && menus.blade === 'store' && renderer.showcase && renderer.showcase.thumbQueue.length) safely('thumbs', () => renderer.showcase.drawThumb());
  safely('render', () => renderer.render(worldDt, alpha, look, player, time, mode === 'title' || mode === 'online' ? 'title' : mode === 'charselect' || mode === 'shop' ? 'showcase' : mode === 'lineup' ? 'lineup' : mode === 'ending' || mode === 'intro' || mode === 'trailer' || mode === 'film' ? 'ending' : 'play'));
  safely('listener', () => audio.updateListener(renderer.camera));
  if (mode === 'play' || mode === 'dying' || mode === 'panel') safely('sound', () => sound.update(fdt, player));
  safely('idleBeat', () => idleBeats.update(sim, localId, (q) => (q.emote ? !!(EMOTE_BY_ID[q.emote] && EMOTE_BY_ID[q.emote].beat) : !!(q.idle && CHARACTERS[q.character] && CHARACTERS[q.character].idleBeat)), mode === 'play' || onlineLive));
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
  while (acc >= DT && steps < 20) { tick({ ...emptyCommand(), yaw: input.yaw, pitch: input.pitch, away: true }); acc -= DT; steps++; }
  if (steps >= 20) acc = 0;
  if (mode === 'dying') { dyingT += fdt; }
};

// Expose for debugging in the console.
window.STEW = {
  get sim() { return sim; }, renderer, CONFIG, input, rangeUI, hud, sound, audio, titleMusic, jukebox, progress, extras, menus, charSelect, lineupUI, career, careerTracker, achToast,
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
    // the trailer: start it (silent for recording), or render one frame of it at
    // time t (frame by frame, for a recorded export: call with rising t)
    trailer(opts = {}) { return startTrailer(opts); },
    // one of the Crust's cutscenes ('intro' | 'ending'), back to the title after
    film(name = 'intro') { startFilm(name, name === 'intro' ? 'maps' : 'victory'); return renderer.ending.C.end; },
    trailerFrame(t, dt = 1 / 30, draw = true) {
      const T = renderer.ending;
      if (!T || (mode !== 'trailer' && mode !== 'film')) return 'no trailer';
      T.t = t - dt;
      renderer.noDraw = !draw;   // (stepping through to a frame: the world moves on, nothing's drawn)
      renderer.render(dt, 1, { pitch: 0, yaw: 0, dx: 0, dy: 0 }, null, t, 'ending');
      renderer.noDraw = false;
      trailerUI.update(T, true);
      return T.shot ? T.shot.id : '';
    },
    // start a zombies game on a map straight away (tests: 'crust')
    play(mapId = 'lastbell') { menus.hideAll(); restart('zombies', mapId); startPlaying(); },
    // put the local player somewhere (tests, screenshots)
    put(x, z, yaw = 0, y = 0) { const p = sim.playerById(localId); p.pos.x = x; p.pos.z = z; p.pos.y = y; input.setLook(yaw, 0); },

  },
};
refreshGlyphs();
// an invite link (?join=CODE) opens the online screen with the code filled in
// the boot splash first (skipped for invite links and ?nosplash), then the patch notes
{
  const code = bootParams.get('join');
  if (code) { splash.finish(true); if (career.lastName) career.signIn(career.lastName).then(afterSignIn); openOnline(code); }
  else if (bootParams.has('nosplash')) splash.finish(true);
}
document.body.dataset.ready = '1';
// paint the zombie heads and outfits while the player is still on the title screen
setTimeout(() => renderer.zombies.kit.build(), 400);
