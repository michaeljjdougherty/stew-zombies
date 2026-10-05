// =============================================================================
// The career's screens: signing in with a username, the Career screen (stats
// and achievements), the name on the title screen, and the "Achievement
// unlocked" pop-up during play (after the Xbox one: a circle, then the bar
// slides out with the gamerscore and the title).
// =============================================================================
import { ACHIEVEMENTS, TOTAL_G } from '../career/achievements.js';
import { cleanName } from '../career/career.js';
import { pinOk } from '../career/auth.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// --- Sign in ---------------------------------------------------------------------
// Username first. With PINs on (CONFIG.career.firebaseApiKey), the next step is
// the PIN: type yours, or make one if the name's new.
const PIN_ERRORS = {
  badpin: 'Wrong PIN. Try again.',
  locked: 'Too many wrong PINs. Wait a few minutes and try again.',
  offline: "Can't reach the server, and this name hasn't signed in on this device before. Try again, or play as a guest.",
  setup: "Sign-in isn't switched on in Firebase yet (Authentication > Email/Password).",
  error: 'Something went wrong signing in. Try again.',
};

export class SignInUI {
  // h: { done() } — after signing in (or playing as a guest)
  constructor(career, h) {
    this.career = career;
    this.h = h;
    this.input = $('si-name');
    this.status = $('si-status');
    this.btn = $('btn-si-go');
    this.pinForm = $('si-pinform');
    this.pin = $('si-pin'); this.pin2 = $('si-pin2'); this.pinBtn = $('btn-si-pin');
    $('si-form').addEventListener('submit', (e) => { e.preventDefault(); this.go(); });
    this.pinForm.addEventListener('submit', (e) => { e.preventDefault(); this.goPin(); });
    $('btn-si-back').addEventListener('click', () => this.nameStep());
    $('btn-si-guest').addEventListener('click', () => this.guest());
    this.input.addEventListener('input', () => { this.refreshButton(); clearTimeout(this.peekT); this.peekT = setTimeout(() => this.peek(), 450); });
    for (const el of [this.pin, this.pin2]) el.addEventListener('input', () => { el.value = el.value.replace(/\D/g, '').slice(0, 4); this.refreshPin(); });
  }

  open() {
    $('si-pintip').hidden = !this.career.pinsOn;
    this.input.value = this.career.lastName || '';
    this.nameStep();
    this.peek();
  }

  // step 1: the username
  nameStep() {
    this.pinForm.hidden = true;
    $('si-form').hidden = false;
    this.input.disabled = false;
    this.refreshButton();
    this.say('');
    setTimeout(() => { this.input.focus({ preventScroll: true }); this.input.select(); }, 30);
  }

  say(html, err = false) { this.status.innerHTML = html; this.status.classList.toggle('err', err); }

  refreshButton() {
    const n = cleanName(this.input.value);
    this.btn.disabled = !n;
    this.btn.textContent = !n ? 'Sign in' : this.career.pinsOn ? 'Next' : `Sign in as ${n}`;
  }

  async peek() {
    const n = cleanName(this.input.value);
    if (!n || !this.pinForm.hidden) { if (!n) this.say(''); return; }
    const ask = n;
    const p = await this.career.peek(n);
    if (cleanName(this.input.value) !== ask || !this.pinForm.hidden) return;   // typed on since
    this.say(p
      ? `Welcome back, <b>${esc(p.name)}</b>: ${fmt(p.kills)} kills · ${fmt(p.rounds)} rounds · ${fmt(p.g)}G`
      : `New here? <b>${esc(n)}</b> starts a fresh career.`);
  }

  async go() {
    const n = cleanName(this.input.value);
    if (!n) return;
    if (!this.career.pinsOn) {
      this.btn.disabled = true;
      this.say('Signing in…');
      await this.career.signIn(n);
      this.btn.disabled = false;
      this.h.done();
      return;
    }
    // step 2: the PIN
    this.btn.disabled = true;
    this.say('Checking the name…');
    const info = await this.career.lookup(n);
    this.btn.disabled = false;
    this.name = n;
    this.create = !(info && info.claimed);
    this.pinStep(info && info.offline);
  }

  pinStep(offline = false) {
    $('si-form').hidden = true;
    this.pinForm.hidden = false;
    this.pin.value = ''; this.pin2.value = '';
    this.pin2.hidden = !this.create;
    $('si-pinhead').innerHTML = this.create
      ? `<b>${esc(this.name)}</b> is new. Make a 4-digit PIN: you'll need it to sign in as ${esc(this.name)} from now on.`
      : `Enter the PIN for <b>${esc(this.name)}</b>.`;
    this.say(offline ? "Can't reach the server: if you've signed in on this device before, your PIN still works here." : '');
    this.refreshPin();
    setTimeout(() => this.pin.focus({ preventScroll: true }), 30);
  }

  refreshPin() {
    const ok = pinOk(this.pin.value) && (!this.create || pinOk(this.pin2.value));
    this.pinBtn.disabled = !ok;
    this.pinBtn.textContent = this.create ? 'Create' : 'Sign in';
  }

  async goPin() {
    const pin = this.pin.value;
    if (!pinOk(pin)) return;
    if (this.create && pin !== this.pin2.value) { this.say("Those PINs don't match.", true); this.pin2.value = ''; this.pin2.focus(); this.refreshPin(); return; }
    this.pinBtn.disabled = true;
    this.say(this.create ? 'Making your account…' : 'Signing in…');
    const r = await this.career.signIn(this.name, pin, { create: this.create });
    this.pinBtn.disabled = false;
    if (r.ok) {
      if (r.offline) this.say('Signed in on this device. Your stats will go up next time you are online.');
      this.h.done();
      return;
    }
    if (r.code === 'taken') {
      // someone made that name a moment ago (or it has a PIN this browser didn't know of)
      this.create = false;
      this.pinStep();
      this.say(`<b>${esc(this.name)}</b> already has a PIN. Enter it, or use a different username.`, true);
      return;
    }
    this.pin.value = ''; this.pin2.value = ''; this.refreshPin(); this.pin.focus();
    this.say(PIN_ERRORS[r.code] || PIN_ERRORS.error, true);
  }

  guest() {
    this.career.signOut();
    this.h.done();
  }
}

// --- The name on the title screen ------------------------------------------------
export function refreshProfileChip(career) {
  const el = $('profile-chip');
  if (!el) return;
  if (!career.signedIn) { el.innerHTML = 'Playing as a guest · <span class="pc-note">stats aren\'t saved</span>'; return; }
  const net = career.status === 'offline' ? ' · <span class="pc-note">offline: saving on this device</span>' : '';
  el.innerHTML = `<span class="pc-name">${esc(career.profile.name)}</span><span class="pc-g">${fmt(career.gamerscore)}G</span>${net}`;
}

// --- The Career screen -----------------------------------------------------------
export function renderCareer(career) {
  const p = career.profile;
  $('cr-name').textContent = p ? p.name : 'Guest';
  $('cr-g').textContent = p ? `${fmt(career.gamerscore)} / ${fmt(TOTAL_G)}G` : 'Sign in to keep stats';
  const s = p ? p.stats : {};
  const stats = [
    ['Kills', s.kills], ['Revives', s.revives], ['Rounds survived', s.rounds], ['Best round', s.bestRound],
    ['Headshots', s.headshots], ['Games', s.games], ['Times downed', s.downs],
  ];
  $('cr-stats').innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${fmt(v)}</dd></div>`).join('');
  const got = ACHIEVEMENTS.filter((a) => career.has(a.id)).length;
  $('cr-count').textContent = `${got} of ${ACHIEVEMENTS.length} unlocked`;
  $('cr-achs').innerHTML = ACHIEVEMENTS.map((a) => {
    const on = career.has(a.id);
    let prog = '';
    if (!on && a.kind === 'stat' && p) {
      const have = Math.min(a.need, s[a.stat] || 0);
      prog = `<span class="ca-prog"><i style="width:${(100 * have / a.need).toFixed(1)}%"></i></span><span class="ca-num">${fmt(have)} / ${fmt(a.need)}</span>`;
    }
    return `<li class="ca${on ? ' on' : ''}"><span class="ca-icon">${TROPHY}</span><span class="ca-body"><b>${esc(a.title)}</b><span>${esc(a.desc)}</span>${prog}</span><span class="ca-g">${a.g}G</span></li>`;
  }).join('');
}

// --- "Achievement unlocked" ------------------------------------------------------
const TROPHY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h10v2h3v3a5 5 0 0 1-4.6 5A5 5 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1A5 5 0 0 1 8.6 13 5 5 0 0 1 4 8V5h3V3zm0 4H6v1a3 3 0 0 0 1.2 2.4A6 6 0 0 1 7 9V7zm10 0v2c0 .5 0 .9-.2 1.4A3 3 0 0 0 18 8V7h-1z"/></svg>';

export class AchievementToast {
  constructor(onShow) {
    this.el = $('ach-toast');
    this.onShow = onShow;   // the chime
    this.queue = [];
    this.busy = false;
  }

  push(a) {
    this.queue.push(a);
    if (!this.busy) this.next();
  }

  next() {
    const a = this.queue.shift();
    if (!a) { this.busy = false; return; }
    this.busy = true;
    const el = this.el;
    el.querySelector('.at-icon').innerHTML = TROPHY;
    el.querySelector('.at-g').textContent = `${a.g}G`;
    el.querySelector('.at-title').textContent = a.title;
    el.hidden = false;
    el.classList.remove('show', 'hide'); void el.offsetWidth;
    el.classList.add('show');
    if (this.onShow) try { this.onShow(a); } catch { /* sound off */ }
    clearTimeout(this.t);
    this.t = setTimeout(() => {
      el.classList.add('hide');
      this.t = setTimeout(() => { el.hidden = true; el.classList.remove('show', 'hide'); this.t = setTimeout(() => this.next(), 350); }, 700);
    }, 5600);
  }
}
