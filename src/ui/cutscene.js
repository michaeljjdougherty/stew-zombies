// =============================================================================
// The cutscenes' overlay: letterbox bars, subtitles, cuts and fades to black,
// and title cards. Driven by the cues of the ending (src/render/ending.js) and
// the intro (src/render/intro.js).
// =============================================================================
import { SCHNITZ_LINE, BRIAN_LINE, SCHNITZ_FAREWELL, FAREWELL_SECS } from '../render/ending.js';
import { INTRO_CARDS } from '../render/intro.js';

const MAP2_CARD = '<small>Stew Zombies</small><b>Map 2</b><span>The season isn\'t over</span>';
const NAMES = { kearns: 'Kearns', ryan: 'Ryan', pit: 'Pit', rocco: 'Rocco', erik: 'Erik', erikPA: 'Erik · PA', schnitz: 'The Schnitz' };

const $ = (id) => document.getElementById(id);

export class CutsceneUI {
  constructor() {
    this.root = $('cutscene');
    this.sub = this.root.querySelector('.csub');
    this.blackEl = this.root.querySelector('.black');
    this.cardEl = this.root.querySelector('.card');
    this.skipEl = this.root.querySelector('.skip');
    this.timer = null;
  }
  show(skipHtml = '') {
    this.root.hidden = false;
    this.root.classList.remove('on'); void this.root.offsetWidth; this.root.classList.add('on');
    this.blackEl.classList.remove('on', 'fade'); this.cardEl.classList.remove('on');
    this.cardEl.innerHTML = MAP2_CARD;
    this.sub.textContent = '';
    this.skipEl.innerHTML = skipHtml;
  }
  hide() { this.root.hidden = true; this.sub.textContent = ''; clearTimeout(this.timer); }
  say(who, text, secs = 3.5) {
    this.sub.innerHTML = `<b>${who}</b>${text}`;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.sub.textContent = ''; }, secs * 1000);
  }
  // black: true = cut (or fade) to black, false = fade back in
  black(on, fade = false) {
    this.blackEl.classList.toggle('fade', fade);
    this.blackEl.classList.toggle('on', on);
  }
  card(html) {
    if (html == null) { this.cardEl.classList.remove('on'); return; }
    this.cardEl.innerHTML = html;
    this.cardEl.classList.remove('on'); void this.cardEl.offsetWidth; this.cardEl.classList.add('on');
  }
  // A line from the intro.
  line(who, text, secs) { this.say(NAMES[who] || who, text, secs + 0.4); }
  introCue(name) {
    const esc = (x) => String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    if (INTRO_CARDS[name]) { const [a, b] = INTRO_CARDS[name]; this.black(true); this.card(`<small>${esc(b)}</small><b class="place">${esc(a)}</b>`); }
    else if (name.startsWith('fadeIn')) { this.card(null); this.black(false, true); }
    else if (name === 'black1' || name === 'black2') { this.sub.textContent = ''; this.black(true, true); }
    else if (name === 'black3') { this.sub.textContent = ''; this.black(true); }
    else if (name === 'title') this.card('<small>Story by James Amarante</small><b>Stew Zombies</b><span>Out of Bounds</span>');
  }
  cue(name) {
    if (name === 'schnitz') this.say('The Schnitz', SCHNITZ_LINE, 3.4);
    else if (name === 'schnitzFarewell') this.say('The Schnitz', SCHNITZ_FAREWELL, FAREWELL_SECS + 0.4);
    else if (name === 'brian') this.say('Brian Luke', BRIAN_LINE, 2.6);
    else if (name === 'black') { this.sub.textContent = ''; this.blackEl.classList.add('on'); }
    else if (name === 'card') this.cardEl.classList.add('on');
  }
}
