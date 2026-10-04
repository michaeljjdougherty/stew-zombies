// =============================================================================
// The Play Online screen: your name, Host / Join, then the lobby (room code,
// who's in, who you're playing, Start). The connection itself is in
// src/net/online.js; this just draws it and passes clicks along.
// =============================================================================
import { CHARACTERS } from '../render/characters.js';
import { LAUNCH, MAX_PLAYERS, cleanCode } from '../net/online.js';

const $ = (id) => document.getElementById(id);

export class OnlineUI {
  // h: { host(name), join(name, code), pick(ch), start(), leave(), back(), questDone() }
  constructor(settings, h) {
    this.settings = settings;
    this.h = h;
    this.busy = false;
    this.lobbyState = null;
    $('on-name').addEventListener('input', () => { this.settings.name = $('on-name').value.trim().slice(0, 16); });
    $('on-code').addEventListener('input', () => { const el = $('on-code'); el.value = cleanCode(el.value); });
    $('on-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-on-join').click(); e.stopPropagation(); });
    $('on-name').addEventListener('keydown', (e) => e.stopPropagation());
    $('btn-on-host').addEventListener('click', () => this.act(() => this.h.host(this.name())));
    $('btn-on-join').addEventListener('click', () => {
      const code = cleanCode($('on-code').value);
      if (code.length !== 4) { this.status('Room codes are 4 letters and numbers.', true); $('on-code').focus(); return; }
      this.act(() => this.h.join(this.name(), code));
    });
    $('btn-on-go').addEventListener('click', () => this.h.start());
    $('btn-on-leave').addEventListener('click', () => this.h.leave());
    $('btn-on-back').addEventListener('click', () => this.h.back());
    $('btn-on-copy').addEventListener('click', () => this.copyInvite());
  }

  name() {
    const n = $('on-name').value.trim().slice(0, 16);
    return n || (CHARACTERS[this.settings.character] ? CHARACTERS[this.settings.character].name : 'Stew');
  }

  async act(fn) {
    if (this.busy) return;
    this.busy = true;
    this.setButtons(true);
    try { await fn(); } catch (e) { this.status(e.message || String(e), true); }
    this.busy = false;
    this.setButtons(false);
  }

  setButtons(off) { for (const id of ['btn-on-host', 'btn-on-join']) $(id).disabled = off; }

  // the first view (name + host/join)
  open(code = '') {
    $('on-name').value = this.settings.name || '';
    if (code) $('on-code').value = cleanCode(code);
    $('on-start').hidden = false;
    $('on-lobby').hidden = true;
    $('on-backnav').hidden = false;
    this.status(code ? 'Press Join to get in your friend\'s game.' : '');
  }

  status(text, err = false) {
    const el = $('on-status');
    el.textContent = text || '';
    el.classList.toggle('err', !!err);
  }

  // lobby: { code, members:[{id,name,character,brian}], you }, isHost
  showLobby(lobby, isHost) {
    this.lobbyState = lobby;
    $('on-start').hidden = true;
    $('on-lobby').hidden = false;
    $('on-backnav').hidden = true;
    $('on-code-show').textContent = lobby.code;
    const me = lobby.members.find((m) => m.id === lobby.you);

    const list = $('on-members');
    list.textContent = '';
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const m = lobby.members[i];
      const li = document.createElement('li');
      if (!m) { li.className = 'empty'; li.innerHTML = '<b>Open</b><span>waiting for a friend</span>'; list.appendChild(li); continue; }
      if (m.id === lobby.you) li.className = 'you';
      const b = document.createElement('b');
      b.textContent = m.name + (m.id === 'p1' ? ' (host)' : '') + (m.id === lobby.you ? ' (you)' : '');
      const sp = document.createElement('span');
      sp.textContent = m.character ? CHARACTERS[m.character].name : 'picking';
      li.append(b, sp);
      list.appendChild(li);
    }

    const chars = $('on-chars');
    const ids = [...LAUNCH, ...(me && me.brian ? ['brian'] : [])];
    if (chars.childElementCount !== ids.length) {
      chars.textContent = '';
      for (const id of ids) {
        const c = document.createElement('button');
        c.type = 'button'; c.className = 'cs-card'; c.dataset.id = id; c.setAttribute('role', 'option');
        c.innerHTML = '<b></b><span></span>';
        c.querySelector('b').textContent = CHARACTERS[id].name;
        c.addEventListener('click', () => this.h.pick(id));
        chars.appendChild(c);
      }
    }
    for (const c of chars.children) {
      const id = c.dataset.id;
      const who = lobby.members.find((m) => m.character === id);
      const mine = who && who.id === lobby.you;
      c.setAttribute('aria-selected', String(!!mine));
      c.disabled = !!who && !mine;
      c.querySelector('span').textContent = mine ? 'You' : who ? who.name : 'Open';
    }

    const go = $('btn-on-go');
    go.hidden = !isHost;
    go.disabled = !isHost || lobby.members.some((m) => !m.character);
    if (isHost) this.status(lobby.members.length > 1 ? 'Start whenever everyone\'s in.' : 'Send your friends the code or the invite link. You can also start on your own.');
    else this.status('Waiting for the host to start the game.');
  }

  async copyInvite() {
    const url = `${location.origin}${location.pathname}?join=${this.lobbyState ? this.lobbyState.code : ''}`;
    try { await navigator.clipboard.writeText(url); this.status('Invite link copied. Send it to your friends.'); }
    catch { this.status(`Invite link: ${url}`); }
  }
}
