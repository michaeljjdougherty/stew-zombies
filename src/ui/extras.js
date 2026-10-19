// =============================================================================
// Extras screen: the story, notes you've found, how to play, the jukebox
// (the Stew song once you've unlocked it), patch notes and credits.
// =============================================================================
import { NOTES, STEW_ITEMS } from '../lore/erik.js';
import { PATCH, patchNotesHTML } from './patchNotes.js';

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
    const ib = $('x-intro');
    if (ib) ib.addEventListener('click', () => this.h.watchIntro());
    // Call of the Crust's films
    const ci = $('x-crust-intro');
    if (ci) ci.addEventListener('click', () => this.h.watchFilm('intro'));
    const ce = $('x-crust-ending');
    if (ce) ce.addEventListener('click', () => this.h.watchFilm('ending'));
  }

  story() {
    const crustDone = !!this.h.progress().crustDone;
    return `<h3>Map 1 · Stew Leonard High: Out of Bounds</h3>
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
      <p><button class="sm" id="x-intro" type="button">Watch the intro</button> <button class="sm" id="x-ending" type="button">Watch the ending</button></p>
      <h3 class="x-map2">Map 2 · Call of the Crust</h3>
      <p class="note">Story by Michael Dougherty.</p>
      <p>Erik is beaten, but the season isn't over. A portal throws the crew somewhere past the edge of everything: five islands floating in space, and every one of them belongs to <b>The Schnitz</b>.</p>
      <p>The hub is <b>the Anvil</b>, an ancient forge where <b>Pit</b> got to first. He's a blacksmith now. Over the Anvil hangs the Schnitz's cage, with <b>Chops</b>, <b>Regs</b>, <b>P</b>, <b>James</b> and <b>Kyle</b> inside it, shouting down at you. And the Schnitz has taken <b>Zach</b>.</p>
      <h4>The islands</h4>
      <p>Launchers on the Anvil's rim fling you to the other four: the <b>Ship Graveyard</b> (wrecks, a lighthouse, and the Captain asleep past the cliffs), the <b>Research Base</b> (everything sparks, and there's a big robot), the <b>Trench Front</b> (always on fire) and the <b>Ice Caves</b> (a cold golem up top).</p>
      <h4>The plan</h4>
      <p>The power's dead: every launcher blew a relay. Pull them for Pit to fix, bring back the four pieces of the <b>War Hammer</b>, then the titans' cores, and Pit will forge hammers that can take on the Schnitz and free Zach. The cage only opens for one price.</p>
      <h4>The ending</h4>
      <p>${crustDone ? 'Spoilers: this plays the ending of Call of the Crust.' : 'Free Zach to unlock the ending here.'}</p>
      <p><button class="sm" id="x-crust-intro" type="button">Watch the intro</button> <button class="sm" id="x-crust-ending" type="button" ${crustDone ? '' : 'disabled'}>Watch the ending</button></p>`;
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
      <h4>Secrets</h4><p>The night he was cut, Erik confiscated the team's ${STEW_ITEMS.length} good-luck charms and hid them around the school. Find them all.</p>
      <h3 class="x-map2">Call of the Crust</h3>
      <h4>Getting around</h4><p>Launch pads on the Anvil's rim fling you to the other islands once their relay's fixed (each one needs a moment to recharge). Ziplines and ice slides take you back. Dive and go prone to get out of trouble.</p>
      <h4>Power</h4><p>It starts dead. Pull each launcher's blown relay and bring it to Pit. Every island has its own power switch and its own perk machine.</p>
      <h4>The War Hammer</h4><p>Four pieces wait at shrines, one on each island. Build the hammer at the Anvil, give it the titans' elemental cores, and let Pit temper it.</p>
      <h4>GobbleGum</h4><p>Gum machines stand next to the perk machines. Build your pack of five from the title screen's GobbleGum blade, and press ${this.glyph('gum')} to use a gum that waits for you.</p>`;
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

  patch() {
    return `<h3>Patch notes · ${PATCH.date}</h3><div class="pn-body pn-inline">${patchNotesHTML()}</div>`;
  }

  credits() {
    return `<h3>Credits</h3>
      <p><b>Stew Zombies</b> — made for Stew.</p>
      <p>Built with three.js and the Web Audio API. The crew, the school, every song and most sound effects are generated in code at load time, and so are the painted textures.</p>
      <p>Photo surfaces (brick, cinder block, tile, terrazzo, wood floors, carpet, concrete, ceiling tiles, grass): scanned materials from <b>ambientCG</b> by Lennart Demes, released to the public domain (CC0).</p>
      <p>Zombie characters and animations: <b>Mixamo</b> (Adobe), including Zombiegirl by W. Kurniawan, Yaku by J. Ignite and Copzombie by L. Actisdato. The ordinary-looking ones were zombified for the game.</p>
      <p>Gun models from <b>Sketchfab</b> (CC BY 4.0 unless noted): 3D Gun Model by Nexor, Ak-74U by BRAIN_ZIP, AUG A3 by Lolik123654, China Lake Colored by TatumWilbanks, Crossbow by Adipriatna, FAMAS by Frostoise, L96A1 Sniper by Matrixxy, low-poly CZ 75 B by D_U, M14 Rifle and The Franchi SPAS-12 by Ecler, MP5K by Shorty_Digitan, Retro ray-gun by Daniel Santalla, RPK drum mag by Moonify, SAW-GUN by Chaise, Shotgun Benelli M90 (XM1014) by Nayo Skumfuk, Sites Spectre HC 9MM by graemebreezy, SVD Dragunov by neyr; Colt M1911 and Heckler &amp; Koch HK21 by ardickasaretas and Combat Knife by hamzagost32 (Sketchfab Standard license). Reduced in size for the game; guns without a model are still built in code.</p>
      <p>Props from <b>Sketchfab</b>, by their creators: Low-poly Juggernog machine (repainted for every perk), Minecraft Pack-a-Punch machine (repainted as the Mad Dog Machine), Jukebox, Golden Trophy, Mystery Box and Poison Glass Bottle (the perk drinks). Reduced in size for the game.</p>
      <p>First-person hands: 3D Rigged Hand by <b>Emma L. D. Lieker</b>, re-rigged for the game's grips.</p>
      <p>The Firing Range: "Call of duty: mobile Firing Range map" by <b>alljamimohammedrafi</b> on Sketchfab (CC BY-NC-SA 4.0), reduced in size and repainted for the game.</p>
      <p>The Cheddars: Skinless Hound by <b>Pigcraft</b> on Sketchfab (CC BY 4.0), recolored, thinned out and rigged for the game.</p>
      <p>Gunshots and gun handling sounds: <b>The Free Firearm Sound Library</b> by Still North Media (Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew Nanney), released to the public domain (CC0).</p>
      <p>Voices are placeholders (synthesized babble with subtitles) until real recordings are dropped in.</p>
      <p>Story: Stew Leonard High ("Out of Bounds" and "The Final Whistle") by <b>James Amarante</b>; Call of the Crust by <b>Michael Dougherty</b>.</p>
      <p>Music: "The Kettle Liturgy" (the Stew Zombies 2.0 menu theme); "Tank" by Mike Morasky from the <i>Left 4 Dead</i> soundtrack (Valve), for Big Evil Zach's fight.</p>
      <p>Gumball machine: "Gumball Machine (low poly)" from <b>Sketchfab</b>, by its creator. Launch, landing and laser sounds from the Pixabay / Freesound community.</p>
      <p>A fan-made game for friends. Stew Leonard High is a fictional school; this game isn't affiliated with or endorsed by any real business. All events are fictional.</p>`;
  }
}
