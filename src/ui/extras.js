// =============================================================================
// Extras screen: the story, notes you've found, how to play, the jukebox
// (the Stew song once you've unlocked it) and credits.
// =============================================================================
import { NOTES, STEW_ITEMS } from '../lore/erik.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Extras {
  constructor(cfg, handlers) {
    this.cfg = cfg;
    this.h = handlers; // { progress(), playSong(), stopSong(), songLyric(), songPlaying() }
    this.panel = $('x-panel');
    this.tab = 'story';
    for (const b of $('x-menu').querySelectorAll('button[data-x]')) {
      b.addEventListener('click', () => this.open(b.dataset.x));
    }
  }

  open(tab = this.tab) {
    this.tab = tab;
    for (const b of $('x-menu').querySelectorAll('button[data-x]')) b.setAttribute('aria-current', String(b.dataset.x === tab));
    this.panel.innerHTML = this[tab]();
    this.panel.scrollTop = 0;
    if (tab === 'jukebox') this.bindJukebox();
  }

  story() {
    return `<h3>Last Bell High</h3>
      <p>Senior year, four friends everyone just called <b>Stew</b> pulled off the Great Stew Incident: the fire alarm went off in the middle of the class president's big speech, and a goat got loose in the cafeteria wearing his sash.</p>
      <p>The class president was <b>Erik Madsen</b>. Hall monitor. Science fair champion. Owner of three very loyal dogs. He did not think it was funny.</p>
      <p>Ten years later, Erik organised the reunion. He cooked the dinner himself: a big pot of stew, with a whole jar of something from the science lab stirred in. Four hundred guests had seconds.</p>
      <p>Stew showed up late. The doors are chained, the power's been cut, and every speaker in the school belongs to Erik.</p>
      <h4>Erik on the PA</h4>
      <p>He'll talk to you the whole night. If you find his microphone in the principal's office, you can talk back.</p>`;
  }

  notes() {
    const prog = this.h.progress();
    const found = new Set(prog.notes);
    const items = NOTES.map((n) => found.has(n.id)
      ? `<details><summary>${esc(n.title)}<span>${esc(n.where)}</span></summary><div class="body">${esc(n.text)}</div></details>`
      : `<details class="locked" onclick="return false"><summary>Not found yet<span>somewhere around the ${esc(n.where.toLowerCase())}</span></summary></details>`).join('');
    return `<h3>Notes found · ${found.size} of ${NOTES.length}</h3>
      <p>Notes are lying around the school. Walk up to one and press <b>F</b> to read it.</p>
      <div class="notes">${items}</div>`;
  }

  howto() {
    const c = this.cfg;
    const perks = Object.values(c.perks.list).map((d) => `<li><b style="color:${d.color}">${esc(d.name)}</b> (${d.cost}) — ${esc(d.desc)}${d.power ? '' : ' Works without power.'}</li>`).join('');
    const pus = Object.values(c.powerups.list).map((d) => `<li><b style="color:${d.color}">${esc(d.name)}</b> — ${esc(d.desc)}</li>`).join('');
    return `<h3>How to play</h3>
      <h4>Survive</h4>
      <p>Zombies come in rounds, each tougher than the last. They break in through the boarded windows; hold <b>F</b> at a window to nail the boards back up (it pays a little). Every hit earns points and kills earn more. Headshots and knife kills pay best.</p>
      <h4>Spend</h4>
      <ul>
        <li><b>Doors and debris</b> open new parts of the school. The <b>Mystery Box</b> (${c.box.cost}) gives a random weapon. Erik's bobblehead means it's about to move.</li>
        <li><b>Weapons on the walls</b> are always the same. Buy one again for more ammo.</li>
        <li>Turn on the <b>power</b> in the boiler room to wake up perks, electric traps and the Mad Dog Machine.</li>
        <li>The <b>Mad Dog Machine</b> on the auditorium stage upgrades the gun in your hands for ${c.madDog.cost}: more damage, more ammo, a new name and a new look.</li>
      </ul>
      <h4>Perks (hold up to ${c.perks.limit})</h4><ul>${perks}</ul>
      <h4>Power-ups</h4><p>Zombies sometimes drop one. Walk over it to grab it.</p><ul>${pus}</ul>
      <h4>Cheddar Rounds</h4><p>Every few rounds Erik lets his dogs out. The whole pack comes for you; the last one drops Full Pantry.</p>
      <h4>Last stand</h4><p>When you go down you can still shoot with your pistol. In solo, Second Helping gets you back up.</p>
      <h4>Secrets</h4><p>Erik confiscated three things from Stew a long time ago and hid them around the school. Find all ${STEW_ITEMS.length}.</p>`;
  }

  jukebox() {
    const prog = this.h.progress();
    const playing = this.h.songPlaying();
    return `<h3>Jukebox</h3>
      <p><b>"We Go Stew"</b> — Stew Jams, side A. ${prog.song ? 'Unlocked.' : 'Locked: find the three things Erik hid around Last Bell High.'}</p>
      <div class="jukebox">
        <button class="sm" id="jb-play" type="button" ${prog.song ? '' : 'disabled'}>${playing ? 'Stop' : 'Play'}</button>
        <div id="lyric"></div>
      </div>
      <p class="note">Music volume is in Settings.</p>`;
  }

  bindJukebox() {
    const b = $('jb-play');
    if (!b) return;
    b.addEventListener('click', () => {
      if (this.h.songPlaying()) { this.h.stopSong(); b.textContent = 'Play'; }
      else { this.h.playSong(); b.textContent = 'Stop'; }
    });
  }

  // called every frame while the Extras screen is open
  update() {
    if (this.tab !== 'jukebox') return;
    const el = $('lyric'), b = $('jb-play');
    if (!el) return;
    const l = this.h.songLyric() || '';
    if (el.textContent !== l) el.textContent = l;
    if (b && !this.h.songPlaying() && b.textContent === 'Stop') b.textContent = 'Play';
  }

  credits() {
    return `<h3>Credits</h3>
      <p><b>Stew Zombies</b> — made for Stew.</p>
      <p>Built with three.js and the Web Audio API. Every model, texture, sound effect and song in the game is generated in code at load time: no image or audio files.</p>
      <p>Voices are placeholders (synthesized babble with subtitles) until real recordings are dropped in.</p>
      <p>All characters, places and events are fictional. No goats were harmed.</p>`;
  }
}
