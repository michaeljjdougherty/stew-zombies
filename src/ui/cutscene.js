// =============================================================================
// The ending's overlay: letterbox bars, subtitles, the hard cut to black and
// the Map 2 title card. Driven by the cutscene's cues (src/render/ending.js).
// =============================================================================
import { SCHNITZ_LINE, BRIAN_LINE } from '../render/ending.js';

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
    this.blackEl.classList.remove('on'); this.cardEl.classList.remove('on');
    this.sub.textContent = '';
    this.skipEl.innerHTML = skipHtml;
  }
  hide() { this.root.hidden = true; this.sub.textContent = ''; clearTimeout(this.timer); }
  say(who, text, secs = 3.5) {
    this.sub.innerHTML = `<b>${who}</b>${text}`;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.sub.textContent = ''; }, secs * 1000);
  }
  cue(name) {
    if (name === 'schnitz') this.say('The Schnitz', SCHNITZ_LINE, 3.4);
    else if (name === 'brian') this.say('Brian Luke', BRIAN_LINE, 2.6);
    else if (name === 'black') { this.sub.textContent = ''; this.blackEl.classList.add('on'); }
    else if (name === 'card') this.cardEl.classList.add('on');
  }
}
