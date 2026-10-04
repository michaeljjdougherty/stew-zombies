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
    this.glyph = () => '<b>F</b>';   // set by main: shows the right button for the device
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
    const eb = $('x-ending');
    if (eb) eb.addEventListener('click', () => this.h.watchEnding());
  }

  story() {
    return `<h3>Stew Leonard High: Out of Bounds</h3>
      <p class="note">Story by James Amarante.</p>
      <p>The <b>Stew Leonards</b> were an unstoppable high school basketball team heading into the championship game off an undefeated season. But behind closed doors, friction brewed. Right before the final stretch, the team made a unanimous decision: they cut <b>Erik Madsen</b>. Number 8.</p>
      <p>Driven by resentment, Erik went looking for the power to take revenge on his former teammates. He found a dark entity known as <b>The Schnitz</b>. In exchange for his soul, The Schnitz gave him powers.</p>
      <h4>The outbreak</h4>
      <p>Moments before the championship tipped off, Erik struck. He stripped every Stew Leonard of their basketball talent and unleashed a horde of the undead on the gym and the campus around it.</p>
      <p>Trapped inside, the team has to fight through the horde, follow Erik's taunting voice over the intercom, take back what he stole, and expose him in the <b>Press Box</b> above the gym.</p>
      <h4>Erik on the PA</h4>
      <p>He'll talk to you the whole night. There's a PA handset in the teachers' lounge if you want to talk back.</p>
      <h4>The ending</h4>
      <p>Spoilers: this plays the "Out of Bounds" cutscene from the end of The Final Whistle.</p>
      <p><button class="sm" id="x-ending" type="button">Watch the ending</button></p>`;
  }

  notes() {
    const prog = this.h.progress();
    const found = new Set(prog.notes);
    const items = NOTES.map((n) => found.has(n.id)
      ? `<details><summary>${esc(n.title)}<span>${esc(n.where)}</span></summary><div class="body">${esc(n.text)}</div></details>`
      : `<details class="locked" onclick="return false"><summary>Not found yet<span>somewhere around the ${esc(n.where.toLowerCase())}</span></summary></details>`).join('');
    return `<h3>Notes found · ${found.size} of ${NOTES.length}</h3>
      <p>Notes are lying around the school. Walk up to one and press ${this.glyph('use')} to read it.</p>
      <div class="notes">${items}</div>`;
  }

  howto() {
    const c = this.cfg;
    const perks = Object.values(c.perks.list).map((d) => `<li><b style="color:${d.color}">${esc(d.name)}</b> (${d.cost}) — ${esc(d.desc)}${d.power ? '' : ' Works without power.'}</li>`).join('');
    const pus = Object.values(c.powerups.list).map((d) => `<li><b style="color:${d.color}">${esc(d.name)}</b> — ${esc(d.desc)}</li>`).join('');
    return `<h3>How to play</h3>
      <h4>Survive</h4>
      <p>Zombies come in rounds, each tougher than the last. They break in through the boarded windows; hold ${this.glyph('use')} at a window to nail the boards back up (it pays a little). Every hit earns points and kills earn more. Headshots and knife kills pay best.</p>
      <h4>Spend</h4>
      <ul>
        <li><b>Doors and debris</b> open new parts of the school. The <b>Mystery Box</b> (${c.box.cost}) gives a random weapon. Erik's bobblehead means it's about to move.</li>
        <li><b>Weapons on the walls</b> are always the same. Buy one again for more ammo.</li>
        <li>Throw the two main <b>breakers</b> (cafeteria and science lab) to turn the power back on: perks, electric traps and the gym lights.</li>
        <li>The <b>Mad Dog Machine</b> is under the gym floor. Put the championship trophy back together at center court to bring it up. It upgrades the gun in your hands for ${c.madDog.cost}: more damage, more ammo, a new name and a new look.</li>
      </ul>
      <h4>Perks (hold up to ${c.perks.limit})</h4><ul>${perks}</ul>
      <h4>Power-ups</h4><p>Zombies sometimes drop one. Walk over it to grab it.</p><ul>${pus}</ul>
      <h4>Cheddar Rounds</h4><p>Every few rounds Erik lets his dogs out. The whole pack comes for you; the last one drops Full Pantry.</p>
      <h4>Last stand</h4><p>When you go down you can still shoot with your pistol. In solo, Second Helping gets you back up.</p>
      <h4>The Final Whistle</h4><p>Erik is sealed in the Press Box above center court. Follow the objective in the top corner to take back what he stole and drag him out of there.</p>
      <h4>Secrets</h4><p>The night he was cut, Erik confiscated the team's ${STEW_ITEMS.length} good-luck charms and hid them around the school. Find them all.</p>`;
  }

  jukebox() {
    const prog = this.h.progress();
    const playing = this.h.songPlaying();
    return `<h3>Jukebox</h3>
      <p><b>"We Go Stew"</b> — Stew Jams, side A. ${prog.song ? 'Unlocked.' : 'Locked: find the three good-luck charms Erik hid around Stew Leonard High.'}</p>
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
      <p>Built with three.js and the Web Audio API. Every model, song and most sound effects are generated in code at load time, and so are the painted textures.</p>
      <p>Photo surfaces (brick, cinder block, tile, terrazzo, wood floors, carpet, concrete, ceiling tiles, grass): scanned materials from <b>ambientCG</b> by Lennart Demes, released to the public domain (CC0).</p>
      <p>Zombie characters and animations: <b>Mixamo</b> (Adobe), including Zombiegirl by W. Kurniawan, Yaku by J. Ignite and Copzombie by L. Actisdato. The ordinary-looking ones were zombified for the game.</p>
      <p>Gunshots and gun handling sounds: <b>The Free Firearm Sound Library</b> by Still North Media (Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew Nanney), released to the public domain (CC0).</p>
      <p>Voices are placeholders (synthesized babble with subtitles) until real recordings are dropped in.</p>
      <p>Story, "Out of Bounds" and "The Final Whistle": <b>James Amarante</b>.</p>
      <p>A fan-made game for friends. Stew Leonard High is a fictional school; this game isn't affiliated with or endorsed by any real business. All events are fictional.</p>`;
  }
}
