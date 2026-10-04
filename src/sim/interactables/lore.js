// =============================================================================
// Story things you can use: Erik's intercom, notes lying around the school,
// and the three Stew items that unlock the Stew song. Same interface as
// windows.js. The map lists where they are (map.intercom, map.notes,
// map.stewItems); the words live in src/lore/erik.js.
// =============================================================================
import { NOTES, STEW_ITEMS, SONG_BEATS, SONG_BPM } from '../../lore/erik.js';
import { intercomTalk, intercomReady } from '../pa.js';

const flatDist = (p, pos) => Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
const up = (p) => p.alive && !p.downed;

export const SONG_SECONDS = (SONG_BEATS * 60) / SONG_BPM;

// ---------------------------------------------------------------------------
export class IntercomInteractable {
  constructor(spot) {
    this.id = 'use_intercom';
    this.kind = 'intercom';
    this.requireLook = true;
    this.pos = { x: spot.x, y: spot.y, z: spot.z };
  }
  get range() { return 1.5; }
  distanceTo(sim, p) { return flatDist(p, this.pos); }
  canUse(sim, p) { return up(p) && sim.pa.enabled; }
  prompt(sim) {
    if (!intercomReady(sim)) return { text: 'Erik is talking', cost: null };
    return { text: 'Press [F] to talk to Erik', cost: null, sub: 'PA handset: Erik is in the Press Box' };
  }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    if (!intercomReady(sim)) { sim.emit('useDenied', { playerId: p.id }); return; }
    intercomTalk(sim, p);
  }
}

// ---------------------------------------------------------------------------
export class NoteInteractable {
  constructor(spot) {
    this.note = NOTES.find((n) => n.id === spot.id);
    if (!this.note) throw new Error('unknown note ' + spot.id);
    this.id = 'note_' + spot.id;
    this.noteId = spot.id;
    this.kind = 'note';
    this.requireLook = true;
    this.pos = { x: spot.x, y: spot.y, z: spot.z };
  }
  get range() { return 1.4; }
  distanceTo(sim, p) { return flatDist(p, this.pos); }
  canUse(sim, p) { return up(p); }
  prompt() { return { text: `Press [F] to read: ${this.note.title}`, cost: null }; }
  use(sim, p, cmd) {
    if (cmd.usePressed) sim.emit('loreRead', { playerId: p.id, id: this.noteId, title: this.note.title });
  }
}

// ---------------------------------------------------------------------------
// The Stew song Easter egg.
export function createStewEgg() {
  return { found: [], playing: false, songAt: null, songUntil: null, played: false };
}

export class StewItemInteractable {
  constructor(spot) {
    this.item = STEW_ITEMS.find((s) => s.id === spot.id);
    if (!this.item) throw new Error('unknown Stew item ' + spot.id);
    this.id = 'stew_' + spot.id;
    this.itemId = spot.id;
    this.kind = 'stewItem';
    this.requireLook = true;
    this.pos = { x: spot.x, y: spot.y, z: spot.z };
  }
  get range() { return 1.3; }
  distanceTo(sim, p) { return flatDist(p, this.pos); }
  canUse(sim, p) { return up(p) && !sim.stewEgg.found.includes(this.itemId); }
  prompt() { return { text: `Press [F] to take the ${this.item.name}`, cost: null }; }
  use(sim, p, cmd) {
    if (!cmd.usePressed) return;
    const egg = sim.stewEgg;
    egg.found.push(this.itemId);
    sim.emit('stewItem', { playerId: p.id, id: this.itemId, name: this.item.name, count: egg.found.length, total: STEW_ITEMS.length, pos: { ...this.pos } });
    if (egg.found.length >= STEW_ITEMS.length && egg.songAt == null) egg.songAt = sim.time + sim.cfg.stewEgg.songDelay;
  }
}

export function updateStewEgg(sim) {
  const egg = sim.stewEgg;
  if (egg.songAt != null && !egg.playing && !egg.played && sim.time >= egg.songAt) {
    egg.playing = true;
    egg.songUntil = sim.time + SONG_SECONDS;
    sim.emit('stewSong', { duration: SONG_SECONDS });
  }
  if (egg.playing && sim.time >= egg.songUntil) {
    egg.playing = false;
    egg.played = true;
    sim.emit('stewSongEnd', {});
  }
}
