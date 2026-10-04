// =============================================================================
// The crew talking: your character's reactions, the others answering over the
// walkie-talkies, and the story conversations at each beat of the game.
//
// Lines go through Erik's PA queue (src/sim/pa.js) so nobody talks over anybody.
// A line is said "live" by a player playing that character; anyone else is on
// the radio. Uses the PA's own RNG, so talking never changes gameplay.
// The words are in src/lore/crew.js.
// =============================================================================
import { REACT, REACT_CHANCE, RADIO, RADIO_CHANCE, TALKS, BANTER, BANTER_CHANCE, LAUNCH_CREW } from '../lore/crew.js';
import { paSay } from './pa.js';

export function createCrew() {
  return { lastReact: {}, kills: {}, said: new Set(), banterUsed: new Set(), talking: false, hurtAt: {} };
}

const playing = (sim) => new Set(sim.players.map((p) => p.character));
const charOf = (sim, id) => { const p = sim.playerById(id); return p ? p.character : null; };

// A whole conversation, in order. Each line is live if someone is playing that
// character, otherwise it comes over the radio.
export function crewTalk(sim, key, lines = TALKS[key], delay = 0.8) {
  const C = sim.crew;
  if (!sim.pa.enabled || !lines) return false;
  if (key && C.said.has(key)) return false;
  if (key) C.said.add(key);
  // a new story beat cuts off whatever conversation hadn't got going yet
  sim.pa.queue = sim.pa.queue.filter((q) => q.cat !== 'talk' && q.cat !== 'talkErik' && q.cat !== 'react' && q.cat !== 'radio');
  const here = playing(sim);
  const solo = sim.players.length === 1 ? sim.players[0].character : null;
  let i = 0;
  for (const l of lines) {
    if (l.onlyAs && solo !== l.onlyAs) continue;
    if (l.skipAs && solo === l.skipAs) continue;
    // a crew member who isn't in the four (Brian, before he's played) stays quiet
    if (l.who !== 'erik' && !here.has(l.who) && !LAUNCH_CREW.includes(l.who)) continue;
    const who = l.who;
    paSay(sim, who === 'erik' ? 'talkErik' : 'talk', { text: l.text, delay: delay + i * 0.002, force: true, who, radio: who !== 'erik' && !here.has(who) });
    i++;
  }
  return true;
}

function pick(sim, list) { return list[Math.floor(sim.pa.rng.next() * list.length)]; }

// Your character says something about what just happened, and maybe someone
// on the walkie answers.
function react(sim, playerId, cat) {
  const C = sim.crew, pa = sim.pa;
  const who = charOf(sim, playerId);
  if (!who || !REACT[cat] || !REACT[cat][who]) return;
  if (pa.speaking && (pa.speaking.cat === 'talk' || pa.speaking.cat === 'talkErik')) return;
  if (pa.queue.some((q) => q.cat === 'talk')) return;
  if (sim.time - (C.lastReact[playerId] ?? -99) < sim.cfg.crew.reactCooldown) return;
  if (!pa.rng.chance(REACT_CHANCE[cat] ?? 0.5)) return;
  const text = pick(sim, REACT[cat][who]);
  if (!paSay(sim, 'react', { text, delay: 0.3, who, radio: false, force: true })) return;
  C.lastReact[playerId] = sim.time;
  // a reply over the radio from someone who isn't playing
  const here = playing(sim);
  const replies = (RADIO[cat] || []).filter((r) => r.who !== who && !here.has(r.who) && (!r.to || r.to === who));
  if (replies.length && pa.rng.chance(RADIO_CHANCE)) {
    const r = pick(sim, replies);
    paSay(sim, 'radio', { text: r.text, delay: 0.31, force: true, who: r.who, radio: true });
  }
}

const GOOD_PULLS = new Set(['Fucci Gun', 'The Chopper', 'stewBomb']);

// Watch the game's events (called from the PA's inbox).
export function crewOnEvent(sim, e) {
  const C = sim.crew;
  switch (e.type) {
    case 'roundStart':
      if (e.round === 1) { crewTalk(sim, 'intro', TALKS.intro, sim.cfg.pa.introDelay + 0.5); break; }
      if (e.cheddar) { if (!crewTalk(sim, 'cheddar', TALKS.cheddar, 1.5)) for (const p of sim.players) react(sim, p.id, 'cheddar'); break; }
      { const p = sim.players[Math.floor(sim.pa.rng.next() * sim.players.length)]; if (p) react(sim, p.id, 'roundStart'); }
      break;
    case 'roundEnd': {
      if (e.cheddar || sim.rounds.round < 2) break;
      if (!sim.pa.rng.chance(BANTER_CHANCE)) break;
      const left = BANTER.map((b, i) => i).filter((i) => !C.banterUsed.has(i));
      if (!left.length) break;
      const i = left[Math.floor(sim.pa.rng.next() * left.length)];
      C.banterUsed.add(i);
      crewTalk(sim, null, BANTER[i], 2.5);
      break;
    }
    case 'zombieKilled': {
      if (!e.playerId) break;
      const k = C.kills[e.playerId] || (C.kills[e.playerId] = []);
      k.push(sim.time);
      while (k.length && sim.time - k[0] > 1.6) k.shift();
      if (k.length >= 3) { k.length = 0; react(sim, e.playerId, 'multiKill'); }
      else if (e.kind === 'knife') react(sim, e.playerId, 'knife');
      break;
    }
    case 'playerDown': if (!e.final) react(sim, e.playerId, 'down'); break;
    case 'playerRevived': react(sim, e.playerId, 'revived'); break;
    case 'dryFire': react(sim, e.playerId, 'dryFire'); break;
    case 'playerHit': {
      const p = sim.playerById(e.playerId);
      if (p && p.health < p.maxHealth * 0.4 && sim.time - (C.hurtAt[p.id] ?? -99) > 20) { C.hurtAt[p.id] = sim.time; react(sim, p.id, 'hurt'); }
      break;
    }
    case 'boxLanded': if (e.playerId && GOOD_PULLS.has(e.weapon)) react(sim, e.playerId, 'boxGood'); break;
    case 'boxBobble': if (e.playerId) react(sim, e.playerId, 'boxBad'); break;
    case 'perkBought': react(sim, e.playerId, 'perk'); break;
    case 'madDogTaken': react(sim, e.playerId, 'upgrade'); break;
    // the story
    case 'breakerThrown': crewTalk(sim, 'power', TALKS.power, 2); break;
    case 'trophyPiece': crewTalk(sim, 'trophy', TALKS.trophy, 2.5); break;
    case 'madDogRevealed': crewTalk(sim, 'madDog', TALKS.madDog, 1); break;
    case 'statueAwake': crewTalk(sim, 'coin', TALKS.coin, 3); break;
    case 'erikRevealed': crewTalk(sim, 'cladding', TALKS.cladding, 1.5); break;
    case 'ritualDone': crewTalk(sim, 'ritual', TALKS.ritual, 2.5); break;
    case 'bossStart': crewTalk(sim, 'boss', TALKS.boss, 4); break;
  }
}
