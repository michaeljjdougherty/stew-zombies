// =============================================================================
// The crew talking: your character's reactions, the others answering over the
// walkie-talkies, and the story conversations at each beat of the game.
//
// Lines go through Erik's PA queue (src/sim/pa.js) so nobody talks over anybody.
// A line is said "live" by a player playing that character; anyone else is on
// the radio. Uses the PA's own RNG, so talking never changes gameplay.
// The words are in src/lore/crew.js (the school) and src/lore/crustCrew.js
// (Call of the Crust: the crew on Pit's walkies, Pit, the boys in the cage,
// and the Schnitz on the speakers).
// =============================================================================
import { REACT, REACT_CHANCE, RADIO, RADIO_CHANCE, TALKS, BANTER, BANTER_CHANCE, LAUNCH_CREW } from '../lore/crew.js';
import { CRUST_CREW, CRUST_VOICES, CAGED, CRUST_REACT, CRUST_REACT_CHANCE, CRUST_RADIO, CRUST_FELL, CRUST_TALKS, CRUST_BANTER, CAGE_TALK, CRUST_ISLAND_REACT, CRUST_PLACES, CRUST_ISLAND_BANTER } from '../lore/crustCrew.js';
import { paSay } from './pa.js';
import { islandAt } from './crustPower.js';

// Each map's lines: the school's, or the Crust's (all its own)
const SETS = {
  school: { members: LAUNCH_CREW, extra: [], talks: TALKS, banter: BANTER, react: REACT, chance: REACT_CHANCE, radio: RADIO },
  crust: { members: CRUST_CREW, extra: CRUST_VOICES, talks: CRUST_TALKS, banter: CRUST_BANTER, react: CRUST_REACT, chance: { ...REACT_CHANCE, ...CRUST_REACT_CHANCE }, radio: CRUST_RADIO },
};
// which island everyone (alive) is on, if they're all on the same one
function sharedIsland(sim) {
  let isl;
  for (const p of sim.players) {
    if (!p.alive || p.launch) continue;
    const i = islandAt(sim, p.pos);
    if (isl === undefined) isl = i; else if (i !== isl) return null;
  }
  return isl || null;
}

export function createCrew(sim) {
  const set = sim && sim.mapData.announcer === 'schnitz' ? 'crust' : 'school';
  return { set, lastReact: {}, kills: {}, said: new Set(), banterUsed: new Set(), talking: false, hurtAt: {}, cageAt: null, cageUsed: new Set(), landed: new Set(), places: new Set(), placeAt: 0 };
}
const S = (sim) => SETS[sim.crew.set];

const playing = (sim) => new Set(sim.players.map((p) => p.character));
const charOf = (sim, id) => { const p = sim.playerById(id); return p ? p.character : null; };

// A whole conversation, in order. Each line is live if someone is playing that
// character, otherwise it comes over the radio.
export function crewTalk(sim, key, lines = S(sim).talks[key], delay = 0.8) {
  const C = sim.crew;
  if (!sim.pa.enabled || !lines) return false;
  const set = S(sim), announcer = sim.pa.announcer;
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
    if (l.who !== announcer && !here.has(l.who) && !set.members.includes(l.who) && !set.extra.includes(l.who)) continue;
    const who = l.who;
    const shout = CAGED.includes(who);   // (the boys in the cage shout down: no walkies up there)
    paSay(sim, who === announcer ? 'talkErik' : 'talk', { text: l.text, delay: delay + i * 0.002, force: true, who, radio: who !== announcer && !shout && !here.has(who), live: shout });
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
  const set = S(sim);
  if (!who || !set.react[cat] || !set.react[cat][who]) return;
  if (pa.speaking && (pa.speaking.cat === 'talk' || pa.speaking.cat === 'talkErik')) return;
  if (pa.queue.some((q) => q.cat === 'talk')) return;
  if (sim.time - (C.lastReact[playerId] ?? -99) < sim.cfg.crew.reactCooldown) return;
  if (!pa.rng.chance(set.chance[cat] ?? 0.5)) return;
  let list = set.react[cat][who];
  // (out on the Crust, a round starting: mostly about the island you're on)
  if (C.set === 'crust' && cat === 'roundStart') {
    const p = sim.playerById(playerId), isl = p && islandAt(sim, p.pos);
    const by = isl && CRUST_ISLAND_REACT[isl] && CRUST_ISLAND_REACT[isl][who];
    if (by && pa.rng.chance(set.chance.islandRound)) list = by;
  }
  const text = pick(sim, list);
  if (!paSay(sim, 'react', { text, delay: 0.3, who, radio: false, force: true })) return;
  C.lastReact[playerId] = sim.time;
  // a reply over the radio from someone who isn't playing
  const here = playing(sim);
  const replies = (set.radio[cat] || []).filter((r) => r.who !== who && !here.has(r.who) && (!r.to || r.to === who) && (set.members.includes(r.who) || set.extra.includes(r.who)));
  if (replies.length && pa.rng.chance(RADIO_CHANCE)) {
    const r = pick(sim, replies);
    paSay(sim, 'radio', { text: r.text, delay: 0.31, force: true, who: r.who, radio: true });
  }
}

const GOOD_PULLS = new Set(['Fucci Gun', 'The Chopper', 'stewBomb', 'maisyDog']);

// Watch the game's events (called from the PA's inbox).
export function crewOnEvent(sim, e) {
  const C = sim.crew;
  switch (e.type) {
    case 'roundStart':
      // (out on the Crust, after Pit's hello)
      if (e.round === 1) { crewTalk(sim, 'intro', S(sim).talks.intro, sim.cfg.pa.introDelay + (C.set === 'crust' ? 2.5 : 0.5)); break; }
      if (e.cheddar) { if (!crewTalk(sim, 'cheddar', S(sim).talks.cheddar, 1.5)) for (const p of sim.players) react(sim, p.id, 'cheddar'); break; }
      { const p = sim.players[Math.floor(sim.pa.rng.next() * sim.players.length)]; if (p) react(sim, p.id, 'roundStart'); }
      break;
    case 'roundEnd': {
      if (e.cheddar || sim.rounds.round < 2) break;
      if (!sim.pa.rng.chance(BANTER_CHANCE)) break;
      // (out on the Crust, all of you on one island: something about it, if there's any left)
      const isl = C.set === 'crust' ? sharedIsland(sim) : null;
      const local = isl && CRUST_ISLAND_BANTER[isl] ? CRUST_ISLAND_BANTER[isl].map((b, i) => [isl + ':' + i, b]).filter(([k]) => !C.banterUsed.has(k)) : [];
      if (local.length) {
        const [k, b] = local[Math.floor(sim.pa.rng.next() * local.length)];
        C.banterUsed.add(k);
        crewTalk(sim, null, b, 2.5);
        break;
      }
      const banter = S(sim).banter;
      const left = banter.map((b, i) => i).filter((i) => !C.banterUsed.has(i));
      if (!left.length) break;
      const i = left[Math.floor(sim.pa.rng.next() * left.length)];
      C.banterUsed.add(i);
      crewTalk(sim, null, banter[i], 2.5);
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
  if (C.set === 'crust') crustOnEvent(sim, e);
}

// --- Call of the Crust ---------------------------------------------------------
function crustOnEvent(sim, e) {
  const C = sim.crew;
  switch (e.type) {
    case 'playerLaunch': if (!crewTalk(sim, 'launch', undefined, 2)) react(sim, e.playerId, 'launch'); break;
    case 'playerLaunchLand': {
      const isl = islandAt(sim, e.pos);
      if (isl && isl !== 'hub' && !C.landed.has(isl)) { C.landed.add(isl); crewTalk(sim, 'land_' + isl, undefined, 1.2); }
      break;
    }
    case 'relayPulled': crewTalk(sim, 'relay', undefined, 1.5); break;
    case 'islandPower': if (e.island === 'hub') crewTalk(sim, 'power', undefined, 5); break;
    case 'partPicked': crewTalk(sim, 'part', undefined, 3); break;
    case 'warHammerBuilt': crewTalk(sim, 'hammer', undefined, 6); break;
    case 'warHammerTaken': case 'hammerTaken': react(sim, e.playerId, 'hammer'); break;
    case 'titanWake': crewTalk(sim, 'wake_' + e.id, undefined, 1.5); break;
    case 'titanDown': crewTalk(sim, 'down_' + e.id, undefined, 3); break;
    case 'hammerForged': if (e.count === 1) crewTalk(sim, 'forged', undefined, 3); break;
    case 'hammerTempered': if (!crewTalk(sim, 'tempered', undefined, 2.5)) react(sim, e.playerId, 'hammer'); break;
    case 'hammersAll': crewTalk(sim, 'allForged', undefined, 6); break;
    case 'zachDescend': crewTalk(sim, 'zach', undefined, 4); break;
    case 'zachKneel': if (e.phase === 0) crewTalk(sim, 'zachHalf', undefined, 3.5); break;
    case 'shellIncoming': crewTalk(sim, 'shells', undefined, 0.3); break;
    case 'ceasefire': crewTalk(sim, 'ceasefire', undefined, 1.5); break;
    case 'rideStart': if (e.kind === 'zip' || e.kind === 'slide') { if (!crewTalk(sim, 'zip', undefined, 0.6)) react(sim, e.playerId, 'zip'); } break;
    case 'playerFell': {
      // over the edge for good: someone else says so on the walkie
      if (e.saved) break;
      const gone = charOf(sim, e.playerId), here = playing(sim);
      const alive = (ch) => sim.players.some((p) => p.character === ch && p.alive);
      const who = CRUST_FELL.filter((l) => l.who !== gone && (!here.has(l.who) || alive(l.who)));
      if (who.length) { const l = pick(sim, who); paSay(sim, 'radio', { text: l.text, delay: 2.4, force: true, who: l.who, radio: !here.has(l.who) }); }
      break;
    }
  }
}

// Each tick (from the PA): somewhere new, and the boys in the cage
export function updateCrew(sim) {
  const C = sim.crew, pa = sim.pa;
  if (C.set !== 'crust') return;
  updatePlaces(sim, C, pa);
  if (!sim.mapData.forge || !sim.mapData.forge.cage) return;
  const c = sim.cfg.crust.cageTalk, cage = sim.mapData.forge.cage;
  if (C.cageAt == null) C.cageAt = sim.time + c.first;
  if (sim.time < C.cageAt || pa.speaking || pa.queue.length) return;
  C.cageAt = sim.time + 1;   // (look again in a second)
  if (!sim.players.some((p) => p.alive && !p.launch && Math.hypot(p.pos.x - cage.x, p.pos.z - cage.z) < c.range)) return;
  if (sim.crustEgg && sim.crustEgg.finale && sim.crustEgg.finale.state !== 'off') return;   // (nobody chats through the finale)
  if (C.cageUsed.size >= CAGE_TALK.length) C.cageUsed.clear();
  const left = CAGE_TALK.map((l, i) => i).filter((i) => !C.cageUsed.has(i));
  const i = left[Math.floor(pa.rng.next() * left.length)];
  C.cageUsed.add(i);
  crewTalk(sim, null, CAGE_TALK[i], 0.3);
  C.cageAt = sim.time + pa.rng.range(c.every[0], c.every[1]);
}

// The first time anyone gets somewhere worth saying something about
function updatePlaces(sim, C, pa) {
  if (sim.time < C.placeAt) return;
  C.placeAt = sim.time + 0.5;
  if (pa.queue.length >= 3) return;
  const here = playing(sim);
  for (const p of sim.players) {
    if (!p.alive || p.launch || p.downed) continue;
    const zone = sim.zoneOf(p.pos, p.region);
    const P = zone && CRUST_PLACES[zone];
    if (!P || C.places.has(zone)) continue;
    C.places.add(zone);
    const text = P[p.character];
    if (!text) continue;
    paSay(sim, 'react', { text, delay: 0.4, force: true, who: p.character, radio: false });
    if (P.reply && P.reply.who !== p.character) paSay(sim, 'radio', { text: P.reply.text, delay: 0.45, force: true, who: P.reply.who, radio: !here.has(P.reply.who) });   // (Pit: live or radio by where you are, pa.js)
    return;   // (one at a time)
  }
}
