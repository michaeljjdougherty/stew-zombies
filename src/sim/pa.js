// =============================================================================
// Erik on the PA. Watches the game's events and decides when Erik says
// something over the school speakers. Emits 'erikSays' with the line and how
// long it takes to say; the client plays the voice placeholder and subtitles.
//
// Uses its own RNG so talking never changes gameplay randomness.
// =============================================================================
import { RNG } from '../core/rng.js';
import { PA_LINES, INTERCOM, INTERCOM_REPEAT, lineDuration } from '../lore/erik.js';
import { CREW, ERIK_ROASTS, ROAST_CHANCE } from '../lore/crew.js';
import { recordedDuration } from '../lore/voice.js';
import { crewOnEvent } from './crew.js';

// Higher = more important. Important lines queue; optional ones are dropped
// if Erik is busy or cooling down.
const PRIORITY = {
  gameOver: 5, song: 5, songEnd: 4, intercom: 5, intro: 4, milestone: 3, cheddar: 3,
  power: 2, cheddarEnd: 2, down: 2, boxMoved: 1, madDog: 1, revived: 1, pressureCooker: 1,
  round: 0, roundEnd: 0, idle: 0,
  breaker: 2, breakersDone: 3, trophyPiece: 1, trophyPlaced: 3, statueFed: 2, coin: 3, cladding: 4,
  ritualStart: 3, ritualDone: 3, bossStart: 4, bossPhase2: 4, bossEnd: 5,
  // the crew (src/sim/crew.js)
  talk: 4, talkErik: 4, react: 3, radio: 3,
};

export function createPA(sim) {
  const c = sim.cfg.pa;
  const rng = new RNG((sim.seed ^ 0x51ed270b) >>> 0);
  return {
    enabled: c.enabled && (sim.mode === 'zombies' || sim.mode === 'explore'),
    rng,
    speaking: null,          // { cat, text, until }
    queue: [],               // [{ cat, text, at }]
    lastSpoke: -999,
    idleAt: rng.range(c.idleEvery[0], c.idleEvery[1]),
    used: {},                // cat -> Set of used indices
    intercomIndex: 0,
    intercomBusyUntil: 0,
    inbox: [],               // events since the last update
    kills: [],               // recent kill times (multi-kill barbs)
    madDogSeen: false,
    lines: 0,
  };
}

function pickLine(pa, cat, list) {
  const used = pa.used[cat] || (pa.used[cat] = new Set());
  if (used.size >= list.length) used.clear();
  let i;
  do { i = Math.floor(pa.rng.next() * list.length); } while (used.has(i));
  used.add(i);
  return list[i];
}

// Ask Erik to say a line from category `cat` (or a specific `text`).
export function paSay(sim, cat, { text = null, delay = 0, force = false, who = 'erik', radio = false, roastTarget = null } = {}) {
  const pa = sim.pa;
  if (!pa.enabled) return false;
  const pri = PRIORITY[cat] ?? 0;
  if (sim.stewEgg && sim.stewEgg.playing && pri < 5) return false;  // nobody talks over the song
  // now and then Erik picks on whoever you're playing instead
  if (!text && (cat === 'round' || cat === 'roundEnd' || cat === 'idle' || cat === 'down') && sim.players.length && pa.rng.chance(ROAST_CHANCE)) {
    const target = (cat === 'down' && roastTarget) || sim.players[Math.floor(pa.rng.next() * sim.players.length)];
    const ch = target.character;
    if (ERIK_ROASTS[ch]) text = pickLine(pa, 'roast_' + ch, ERIK_ROASTS[ch]);
  }
  if (!text) {
    const list = PA_LINES[cat];
    if (!list || !list.length) return false;
    text = pickLine(pa, cat, list);
  }
  const busy = pa.speaking || pa.queue.length;
  const cooling = sim.time - pa.lastSpoke < sim.cfg.pa.cooldown;
  if (!force && pri === 0 && (busy || cooling)) return false;
  if (!force && pri === 1 && busy) return false;
  if (pa.queue.length >= 3 && pri < 4) return false;
  pa.queue.push({ cat, text, at: sim.time + delay, pri, who, radio });
  pa.queue.sort((a, b) => b.pri - a.pri || a.at - b.at);
  return true;
}

// The intercom in the teachers' lounge: Stew says something, Erik answers.
export function intercomTalk(sim, p) {
  const pa = sim.pa;
  const ex = pa.intercomIndex < INTERCOM.length ? INTERCOM[pa.intercomIndex++] : null;
  const stewText = ex ? ex.stew : 'Erik? Hello?';
  const reply = ex ? ex.erik : INTERCOM_REPEAT[Math.floor(pa.rng.next() * INTERCOM_REPEAT.length)];
  // whoever you play says it into the handset (their recording, if there is one)
  const dur = recordedDuration(p.character, stewText) ?? lineDuration(stewText) * 0.8;
  sim.emit('stewSays', { playerId: p.id, who: p.character, text: stewText, dur, index: ex ? pa.intercomIndex - 1 : -1 });
  // Erik talks over whatever he was going to say next
  pa.queue = pa.queue.filter((q) => q.pri >= 4);
  paSay(sim, 'intercom', { text: reply, delay: dur + 0.5, force: true });
  pa.intercomBusyUntil = sim.time + dur + 0.5 + erikDuration(reply) + sim.cfg.pa.intercomCooldown;
}

export function intercomReady(sim) {
  return sim.pa.enabled && sim.time >= sim.pa.intercomBusyUntil && !(sim.stewEgg && sim.stewEgg.playing);
}

function chance(sim, cat) {
  const p = sim.cfg.pa.chance[cat];
  return p == null || sim.pa.rng.chance(p);
}

// React to this tick's events.
function onEvent(sim, e) {
  const pa = sim.pa, c = sim.cfg.pa;
  switch (e.type) {
    case 'roundStart':
      if (e.round === 1) paSay(sim, 'intro', { delay: c.introDelay });   // then the crew check in (crew.js)
      else if (PA_LINES.milestone[e.round]) paSay(sim, 'milestone', { text: PA_LINES.milestone[e.round], delay: 1.5 });
      else if (e.cheddar) paSay(sim, 'cheddar', { delay: 0.6 });
      else if (chance(sim, 'round')) paSay(sim, 'round', { delay: 2 });
      break;
    case 'roundEnd':
      if (e.cheddar) { if (chance(sim, 'cheddarEnd')) paSay(sim, 'cheddarEnd', { delay: 1 }); }
      else if (chance(sim, 'roundEnd')) paSay(sim, 'roundEnd', { delay: 1.5 });
      break;
    case 'powerOn': paSay(sim, 'power', { delay: 2.5 }); break;
    case 'boxMoved': if (chance(sim, 'boxMoved')) paSay(sim, 'boxMoved', { delay: 1 }); break;
    case 'madDogStart':
      if (!pa.madDogSeen || chance(sim, 'madDog')) paSay(sim, 'madDog', { delay: 0.8 });
      pa.madDogSeen = true;
      break;
    case 'playerDown': if (!e.final && chance(sim, 'down')) paSay(sim, 'down', { delay: 0.8, roastTarget: sim.players.find((p) => p.id === e.playerId) }); break;
    case 'playerRevived': if (chance(sim, 'revived')) paSay(sim, 'revived', { delay: 0.6 }); break;
    case 'zombieKilled': {
      pa.kills.push(sim.time);
      while (pa.kills.length && sim.time - pa.kills[0] > c.multiKillWindow) pa.kills.shift();
      if (pa.kills.length >= c.multiKill) { pa.kills.length = 0; if (chance(sim, 'pressureCooker')) paSay(sim, 'pressureCooker', { delay: 0.5 }); }
      break;
    }
    case 'stewSong': paSay(sim, 'song', { delay: 0.2, force: true }); break;
    case 'stewSongEnd': paSay(sim, 'songEnd', { delay: 0.8, force: true }); break;
    case 'gameOver': {
      // the game is over, so say it right now
      const text = pickLine(pa, 'gameOver', PA_LINES.gameOver);
      speak(sim, 'gameOver', text);
      break;
    }
  }
  if (sim.crew) crewOnEvent(sim, e);
}

// How long Erik takes to say it: the recording's length when there is one.
const erikDuration = (text) => recordedDuration('erik', text) ?? lineDuration(text);

// Lines over the PA start with the school chime; live intercom replies and
// his reaction to the song don't.
export const CHIME_TIME = 1.0;
function speak(sim, cat, text, who = 'erik', radio = false) {
  const pa = sim.pa;
  if (who !== 'erik') {
    // one of the crew, live or over a walkie
    const v = CREW[who] ? CREW[who].voice : { rate: 1 };
    const dur = recordedDuration(who, text) ?? lineDuration(text) / (v.rate || 1);
    pa.speaking = { cat, text, until: sim.time + dur + (radio ? 0.25 : 0), who };
    pa.lines++;
    sim.emit('crewSays', { who, text, dur, radio, cat, n: pa.lines });
    return;
  }
  const dur = erikDuration(text);
  const lead = cat === 'intercom' || cat === 'song' || cat === 'songEnd' || cat === 'talkErik' ? 0 : CHIME_TIME;
  pa.speaking = { cat, text, until: sim.time + lead + dur };
  pa.lines++;
  sim.emit('erikSays', { cat, text, dur, lead, n: pa.lines });
}

export function updatePA(sim, dt) {
  const pa = sim.pa;
  if (!pa.enabled) return;
  const events = pa.inbox;
  pa.inbox = [];
  for (const e of events) onEvent(sim, e);
  if (sim.gameOver) return;
  if (sim.quest && sim.quest.darkUntil > sim.time) return;   // nobody talks over The Schnitz

  if (pa.speaking && sim.time >= pa.speaking.until) {
    pa.speaking = null;
    pa.lastSpoke = sim.time;
    pa.idleAt = sim.time + pa.rng.range(sim.cfg.pa.idleEvery[0], sim.cfg.pa.idleEvery[1]);
  }
  if (!pa.speaking && pa.queue.length && sim.time - pa.lastSpoke >= sim.cfg.pa.gap) {
    const i = pa.queue.findIndex((q) => q.at <= sim.time);
    if (i >= 0) {
      const q = pa.queue.splice(i, 1)[0];
      if (!(sim.stewEgg && sim.stewEgg.playing && q.pri < 5)) speak(sim, q.cat, q.text, q.who, q.radio);
    }
  }
  // the odd random barb when he's been quiet a while (only once the game is going)
  if (!pa.speaking && !pa.queue.length && sim.rounds.round >= 2 && sim.time >= pa.idleAt) {
    paSay(sim, 'idle');
    pa.idleAt = sim.time + pa.rng.range(sim.cfg.pa.idleEvery[0], sim.cfg.pa.idleEvery[1]);
  }
}
