// =============================================================================
// The career's screens: signing in with a username, the Career screen (stats
// and achievements), the name on the title screen, and the "Achievement
// unlocked" pop-up during play (after the Xbox one: a circle, then the bar
// slides out with the gamerscore and the title).
// =============================================================================
import { ACHIEVEMENTS, TOTAL_G } from '../career/achievements.js';
import { cleanName } from '../career/career.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// --- Sign in ---------------------------------------------------------------------
export class SignInUI {
  // h: { done() } — after signing in (or playing as a guest)
  constructor(career, h) {
    this.career = career;
    this.h = h;
    this.input = $('si-name');
    this.status = $('si-status');
    this.btn = $('btn-si-go');
    $('si-form').addEventListener('submit', (e) => { e.preventDefault(); this.go(); });
    $('btn-si-guest').addEventListener('click', () => this.guest());
    this.input.addEventListener('input', () => { this.refreshButton(); clearTimeout(this.peekT); this.peekT = setTimeout(() => this.peek(), 450); });
  }

  open() {
    this.input.value = this.career.lastName || '';
    this.refreshButton();
    this.status.textContent = '';
    this.peek();
    setTimeout(() => { this.input.focus({ preventScroll: true }); this.input.select(); }, 30);
  }

  refreshButton() {
    const n = cleanName(this.input.value);
    this.btn.disabled = !n;
    this.btn.textContent = n ? `Sign in as ${n}` : 'Sign in';
  }

  async peek() {
    const n = cleanName(this.input.value);
    if (!n) { this.status.textContent = ''; return; }
    const ask = n;
    const p = await this.career.peek(n);
    if (cleanName(this.input.value) !== ask) return;   // typed on since
    this.status.innerHTML = p
      ? `Welcome back, <b>${esc(p.name)}</b>: ${fmt(p.kills)} kills · ${fmt(p.rounds)} rounds · ${fmt(p.g)}G`
      : `New here? <b>${esc(n)}</b> starts a fresh career.`;
  }

  async go() {
    const n = cleanName(this.input.value);
    if (!n) return;
    this.btn.disabled = true;
    this.status.textContent = 'Signing in…';
    await this.career.signIn(n);
    this.btn.disabled = false;
    this.h.done();
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
