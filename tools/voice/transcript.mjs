// Every voice line in both maps, in roughly the order a game plays them, as JSON
// (who, the line, which part of the game, when it plays). tools/voice/sheet.py
// turns it into the recording spreadsheet.
// Usage: node tools/voice/transcript.mjs > lines.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const imp = (p) => import(pathToFileURL(path.join(R, p)).href);
const E = await imp('src/lore/erik.js');
const C = await imp('src/lore/crew.js');
const K = await imp('src/lore/crustCrew.js');
// (intro.js needs three.js, so read its INTRO_LINES table as text)
const introSrc = fs.readFileSync(path.join(R, 'src/render/intro.js'), 'utf8');
const INTRO_LINES = eval(introSrc.match(/export const INTRO_LINES = (\[[\s\S]*?\n\]);/)[1]);
const { CONFIG } = await imp('src/config.js');

const rows = [];
let map = '';
const add = (part, when, who, text, note = '') => {
  if (typeof text !== 'string' || !text.trim()) return;
  if (who === 'erikPA') { who = 'erik'; note = note || 'over the PA'; }
  rows.push({ map, part, when, who, text, note });
};
const list = (part, when, who, arr, note) => (Array.isArray(arr) ? arr : [arr]).forEach((t) => add(part, when, who, t, note));
const convo = (part, when, arr) => arr.forEach((l) => add(part, when, l.who, l.text,
  [l.to && `answers ${cap(l.to)}`, l.onlyAs && `only when playing ${cap(l.onlyAs)}`, l.skipAs && `not when playing ${cap(l.skipAs)}`].filter(Boolean).join('; ')));
const cap = (s) => s[0].toUpperCase() + s.slice(1);
// category -> character -> [lines]
const byChar = (part, when, o, note) => { for (const [who, ls] of Object.entries(o || {})) list(part, when, who, ls, note); };

const REACT_WHEN = {
  roundStart: 'A round starts', multiKill: 'Several kills at once', knife: 'A knife kill', down: 'Going down',
  revived: 'Getting revived', dryFire: 'Out of ammo', hurt: 'Getting hit', boxGood: 'Good gun from the box',
  boxBad: 'Bad gun from the box', perk: 'Buying a perk', upgrade: 'Upgrading a gun', cheddar: 'The Cheddars show up',
  launch: 'Riding a launch pad', hammer: 'Swinging a War Hammer', zip: 'Riding a zipline', islandRound: 'Round starts on this island',
};
const ISLAND = { hub: 'The Anvil', ship: 'Ship Graveyard', research: 'Research Base', trench: 'Trench Front', caves: 'Ice Caves' };
const ELEM = { wind: 'Wind', lightning: 'Lightning', ice: 'Ice', fire: 'Fire' };

// ============================ STEW LEONARD HIGH ============================
map = 'Stew Leonard High';
const P = E.PA_LINES, T = C.TALKS;
INTRO_LINES.forEach((l) => add('1. Intro cutscene', 'Opening cutscene', l.who, l.text));
list('2. Round 1', 'Erik opens the game', 'erik', P.intro);
convo('2. Round 1', 'Everyone checks in on the walkies', T.intro);
list('3. Erik on the PA (any round)', 'Start of a round', 'erik', P.round);
for (const [r, t] of Object.entries(P.milestone)) add('3. Erik on the PA (any round)', `Reaching round ${r}`, 'erik', t);
list('3. Erik on the PA (any round)', 'End of a round', 'erik', P.roundEnd);
list('3. Erik on the PA (any round)', 'Now and then (idle)', 'erik', P.idle);
for (const [who, ls] of Object.entries(C.ERIK_ROASTS)) list('3. Erik on the PA (any round)', `Roasting ${cap(who)}`, 'erik', ls, `when someone plays ${cap(who)}`);
list('3. Erik on the PA (any round)', 'Someone goes down', 'erik', P.down);
list('3. Erik on the PA (any round)', 'Someone gets revived', 'erik', P.revived);
list('3. Erik on the PA (any round)', 'Pressure Cooker', 'erik', P.pressureCooker);
list('3. Erik on the PA (any round)', 'The box moves', 'erik', P.boxMoved);
for (const [cat, o] of Object.entries(C.REACT)) byChar('4. Crew reactions (said out loud)', REACT_WHEN[cat] || cat, o);
for (const [cat, ls] of Object.entries(C.RADIO)) convo('5. Crew answering on the walkie', REACT_WHEN[cat] || cat, ls);
C.BANTER.forEach((cv, i) => convo('6. Crew banter between rounds', `Conversation ${i + 1}`, cv));
list('7. The Cheddars (hellhounds)', 'The Cheddars arrive', 'erik', P.cheddar);
convo('7. The Cheddars (hellhounds)', 'The Cheddars arrive', T.cheddar);
add('7. The Cheddars (hellhounds)', 'A Cheddar snarls at you', 'cheddar', CONFIG.cheddar.line, 'speech bubble');
list('7. The Cheddars (hellhounds)', 'The last Cheddar dies', 'erik', P.cheddarEnd);
list('8. Power', 'Someone throws a breaker', 'erik', P.breaker);
list('8. Power', 'Both breakers thrown', 'erik', P.breakersDone);
list('8. Power', 'The power comes on', 'erik', P.power);
convo('8. Power', 'The power comes on', T.power);
for (const ex of E.INTERCOM) {
  for (const who of ['kearns', 'ryan', 'pit', 'rocco', 'brian']) add('9. The intercom (teachers\' lounge)', 'You press the intercom', who, ex.stew, 'whoever you play says this');
  add('9. The intercom (teachers\' lounge)', 'Erik answers', 'erik', ex.erik);
}
for (const who of ['kearns', 'ryan', 'pit', 'rocco', 'brian']) add('9. The intercom (teachers\' lounge)', 'Pressing it again after all 8', who, 'Erik? Hello?', 'whoever you play says this');
list('9. The intercom (teachers\' lounge)', 'Erik answers (repeat)', 'erik', E.INTERCOM_REPEAT);
list('10. The quest', 'Picking up a trophy piece', 'erik', P.trophyPiece);
list('10. The quest', 'The trophy goes back together', 'erik', P.trophyPlaced);
convo('10. The quest', 'The trophy goes back together', T.trophy);
list('10. The quest', 'The Mad Dog machine', 'erik', P.madDog);
convo('10. The quest', 'The Mad Dog machine', T.madDog);
list('10. The quest', 'Feeding the statue', 'erik', P.statueFed);
list('10. The quest', 'Taking the Dark Schnitz Coin', 'erik', P.coin);
convo('10. The quest', 'Taking the Dark Schnitz Coin', T.coin);
list('10. The quest', 'Opening the Press Box cladding', 'erik', P.cladding);
convo('10. The quest', 'Opening the Press Box cladding', T.cladding);
list('10. The quest', 'Starting a ritual circle', 'erik', P.ritualStart);
convo('10. The quest', 'Starting a ritual circle', T.ritual);
list('10. The quest', 'A ritual circle is done', 'erik', P.ritualDone);
E.SCHNITZ_LINES.chopper.forEach((l) => add('10. The quest', 'Lifting the Chopper (lights go out)', 'schnitz', l.text));
add('10. The quest', 'The 50th infused zombie goes down', 'schnitz', E.SCHNITZ_LINES.infusedDone);
list('11. The Erik boss fight', 'The fight starts', 'erik', P.bossStart);
convo('11. The Erik boss fight', 'The fight starts', T.boss);
list('11. The Erik boss fight', 'Phase 2', 'erik', P.bossPhase2);
list('11. The Erik boss fight', 'Erik is beaten', 'erik', P.bossEnd);
list('12. The Stew song Easter egg', 'The song starts', 'erik', P.song);
list('12. The Stew song Easter egg', 'The song ends', 'erik', P.songEnd);
add('13. Ending cutscene', 'Ending cutscene', 'schnitz', E.SCHNITZ_LINES.ending);
add('13. Ending cutscene', 'Ending cutscene (out in space)', 'schnitz', E.SCHNITZ_LINES.farewell);
add('13. Ending cutscene', 'Ending cutscene (the portal)', 'brian', 'You guys coming?');
list('14. Game over', 'Everyone is down', 'erik', P.gameOver);

// ============================ CALL OF THE CRUST ============================
map = 'Call of the Crust';
const S = K.SCHNITZ_PA, CT = K.CRUST_TALKS, F = C.PIT_FORGE, PW = C.PIT_POWER, Z = C.ZACH_FINALE;
CONFIG.crustFilms.intro.lines.forEach((l) => add('1. Intro cutscene', 'Opening cutscene', l.who, l.text));
list('2. Round 1', 'The Schnitz opens the game', 'schnitz', S.intro);
convo('2. Round 1', 'Everyone checks in on Pit\'s walkies', CT.intro);
list('3. The Schnitz on the speakers (any round)', 'Start of a round', 'schnitz', S.round);
for (const [r, t] of Object.entries(S.milestone)) add('3. The Schnitz on the speakers (any round)', `Reaching round ${r}`, 'schnitz', t);
list('3. The Schnitz on the speakers (any round)', 'End of a round', 'schnitz', S.roundEnd);
for (const [isl, ls] of Object.entries(S.island)) list('3. The Schnitz on the speakers (any round)', `Round start, everyone on ${ISLAND[isl]}`, 'schnitz', ls);
list('3. The Schnitz on the speakers (any round)', 'Now and then (idle)', 'schnitz', S.idle);
for (const [who, ls] of Object.entries(K.SCHNITZ_ROASTS)) list('3. The Schnitz on the speakers (any round)', `Roasting ${cap(who)}`, 'schnitz', ls, `when someone plays ${cap(who)}`);
list('3. The Schnitz on the speakers (any round)', 'Someone goes down', 'schnitz', S.down);
list('3. The Schnitz on the speakers (any round)', 'Someone gets revived', 'schnitz', S.revived);
list('3. The Schnitz on the speakers (any round)', 'Pressure Cooker', 'schnitz', S.pressureCooker);
list('3. The Schnitz on the speakers (any round)', 'The box moves', 'schnitz', S.boxMoved);
list('3. The Schnitz on the speakers (any round)', 'Someone falls off an island', 'schnitz', S.fell);
for (const [cat, o] of Object.entries(K.CRUST_REACT)) byChar('4. Crew reactions (said out loud)', REACT_WHEN[cat] || cat, o);
for (const [isl, o] of Object.entries(K.CRUST_ISLAND_REACT)) byChar('4. Crew reactions (said out loud)', `Landing on / round on ${ISLAND[isl]}`, o);
for (const [cat, ls] of Object.entries(K.CRUST_RADIO)) convo('5. Crew answering on the walkie', REACT_WHEN[cat] || cat, ls);
convo('5. Crew answering on the walkie', 'Someone falls off for good', K.CRUST_FELL);
K.CRUST_BANTER.forEach((cv, i) => convo('6. Crew banter between rounds', `Conversation ${i + 1}`, cv));
for (const [isl, cvs] of Object.entries(K.CRUST_ISLAND_BANTER)) cvs.forEach((cv, i) => convo('6. Crew banter between rounds', `On ${ISLAND[isl]}, conversation ${i + 1}`, cv));
K.CAGE_TALK.forEach((cv, i) => convo('7. The boys in the cage', `Near the cage, ${i + 1}`, cv));
list('8. The Cheddars (hellhounds)', 'The Cheddars arrive', 'schnitz', S.cheddar);
convo('8. The Cheddars (hellhounds)', 'The Cheddars arrive', CT.cheddar);
add('8. The Cheddars (hellhounds)', 'A Cheddar snarls at you', 'cheddar', CONFIG.cheddar.line, 'speech bubble (same as the school)');
list('8. The Cheddars (hellhounds)', 'The last Cheddar dies', 'schnitz', S.cheddarEnd);
add('9. Power', 'Picking up the first relay', 'pit', PW.firstPulled);
convo('9. Power', 'Picking up a relay', CT.relay);
list('9. Power', 'Handing Pit a relay', 'pit', PW.given);
list('9. Power', 'All four relays in', 'pit', PW.allIn);
add('9. Power', 'Talking to Pit while he works', 'pit', PW.busy);
list('9. Power', 'The Anvil\'s power comes on', 'pit', PW.fixed);
convo('9. Power', 'The Anvil\'s power comes on', CT.power);
list('9. Power', 'Pit nudging you (no power yet)', 'pit', PW.nudge);
for (const [isl, t] of Object.entries(PW.island)) add('9. Power', `${ISLAND[isl]} switch flipped`, 'pit', t);
convo('10. Getting around', 'First launch pad ride', CT.launch);
convo('10. Getting around', 'First zipline ride', CT.zip);
for (const isl of ['ship', 'research', 'trench', 'caves']) convo('10. Getting around', `First landing on ${ISLAND[isl]}`, CT['land_' + isl]);
for (const [place, o] of Object.entries(K.CRUST_PLACES)) {
  const { reply, ...lines } = o;
  for (const [who, t] of Object.entries(lines)) add('10. Getting around', `Reaching a spot: ${place}`, who, t, 'whoever you play says this');
  if (reply) add('10. Getting around', `Reaching a spot: ${place}`, reply.who, reply.text, 'answers on the walkie');
}
convo('10. Getting around', 'The Trench Front shelling', CT.shells);
convo('10. Getting around', 'Calling the ceasefire', CT.ceasefire);
list('11. The War Hammers', 'Meeting Pit at the forge', 'pit', F.intro);
for (const [part, t] of Object.entries(F.partPicked)) add('11. The War Hammers', `Picking up the hammer ${part}`, 'pit', t);
convo('11. The War Hammers', 'Picking up a hammer part', CT.part);
add('11. The War Hammers', 'Placing a part at the Anvil', 'pit', F.partPlaced);
list('11. The War Hammers', 'A War Hammer is built', 'pit', F.hammerBuilt);
convo('11. The War Hammers', 'A War Hammer is built', CT.hammer);
for (const isl of ['ship', 'research', 'caves', 'trench']) convo('11. The War Hammers', `A titan wakes (${ISLAND[isl]})`, CT['wake_' + isl]);
for (const isl of ['ship', 'research', 'caves', 'trench']) convo('11. The War Hammers', `A titan goes down (${ISLAND[isl]})`, CT['down_' + isl]);
for (const [isl, t] of Object.entries(F.coreDropped)) add('11. The War Hammers', `A titan drops its core (${ISLAND[isl]})`, 'pit', t);
for (const [el, t] of Object.entries(F.given)) add('11. The War Hammers', `Giving Pit the ${ELEM[el]} core`, 'pit', t);
add('11. The War Hammers', 'Pit already has one on the fire', 'pit', F.queued);
for (const [el, t] of Object.entries(F.forged)) add('11. The War Hammers', `${ELEM[el]} hammer forged`, 'pit', t);
convo('11. The War Hammers', 'A hammer is forged', CT.forged);
list('11. The War Hammers', 'All four hammers forged', 'pit', F.allForged);
convo('11. The War Hammers', 'All four hammers forged', CT.allForged);
list('11. The War Hammers', 'Pit nudging you', 'pit', F.nudge);
add('11. The War Hammers', 'Tempering starts', 'pit', F.temperStart);
for (const [el, t] of Object.entries(F.tempered)) add('11. The War Hammers', `${ELEM[el]} hammer tempered`, 'pit', t);
convo('11. The War Hammers', 'A hammer is tempered', CT.tempered);
add('12. Big Evil Zach', 'The ring is ready', 'pit', F.ring);
convo('12. Big Evil Zach', 'Zach arrives', CT.zach);
add('12. Big Evil Zach', 'Zach descends', 'schnitz', Z.descend, 'the Schnitz, speaking through Zach');
list('12. Big Evil Zach', 'Zach hits a new phase', 'schnitz', Z.phase, 'the Schnitz, speaking through Zach');
list('12. Big Evil Zach', 'Taunts during the fight', 'schnitz', K.ZACH_TAUNTS, 'the Schnitz, speaking through Zach');
convo('12. Big Evil Zach', 'Zach is at half health', CT.zachHalf);
add('12. Big Evil Zach', 'The Schnitz lets go', 'schnitz', Z.freed);
list('12. Big Evil Zach', 'Zach is himself again', 'zach', Z.zach);
add('12. Big Evil Zach', 'Zach is freed', 'pit', F.freed);
CONFIG.crustFilms.ending.lines.forEach((l) => add('13. Ending cutscene', 'Ending cutscene', l.who, l.text));
list('14. Game over', 'Everyone is down', 'schnitz', S.gameOver);

console.log(JSON.stringify(rows));
