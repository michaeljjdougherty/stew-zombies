// =============================================================================
// HUD: round tally, points (+popups), ammo, crosshair, hitmarker, prompts.
// Reads sim state; never changes it.
// =============================================================================
import { TallyCounter } from './tally.js';
import { glyphify, glyph } from '../input/glyphs.js';
import { powerupIconURL } from '../render/powerupIcons.js';
import { NOTES, STEW_ITEMS } from '../lore/erik.js';
import { questObjective } from '../sim/quest.js';
import { CREW } from '../lore/crew.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(cfg) {
    this.cfg = cfg;
    this.root = $('hud');
    this.tally = new TallyCounter($('tally'), cfg);
    this.el = {
      points: $('points'), popups: $('popups'), wname: $('wname'), clip: $('clip'), reserve: $('reserve'),
      ammo: $('ammo'), clipL: $('clipL'), grenades: $('grenades'), scope: $('scope'),
      promptsub: $('promptsub'), powerups: $('powerups'), perks: $('perks'), toast: $('toast'), downed: $('downed'), revive: $('revive'), cross: $('crosshair'), hit: $('hitmarker'), prompt: $('prompt'), hint: $('hint'), fps: $('fps'),
    };
    this.shownPoints = null;
    this.hitT = 0;
    this.fpsAcc = 0; this.fpsN = 0;
    this.localId = null;
    this.last = {};
    // Erik & friends
    this.subtitles = true;
    this.clock = 0;
    this.subQueue = [];      // { at, until, cls, who, text, el }
    this.paUntil = 0;
    this.noteOpen = null;
    this.hits = [];          // damage direction arcs { from, t, el }
    this.lyricSource = null; // () => current song line
    this.onNoteRead = null;
    this.el.quest = $('quest'); this.el.subs = $('subs'); this.el.pa = $('pa'); this.el.note = $('notecard'); this.el.eggs = $('eggs'); this.el.dmgdir = $('dmgdir');
  }

  // Big centered message (power on, new upgraded gun, perk).
  toast(t1, t2 = '', color = null, time = 3) {
    const el = this.el.toast;
    el.querySelector('.t1').textContent = t1;
    el.querySelector('.t2').textContent = t2;
    el.style.setProperty('--c', color || 'var(--brass)');
    el.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('on'), time * 1000);
  }

  show(on) { this.root.hidden = !on; if (!on) { this.el.scope.hidden = true; this.last.scope = true; } }

  reset() {
    this.tally.round = 0; this.tally.anim = null; this.tally.blink = false;
    for (const q of this.subQueue) if (q.el) q.el.remove();
    this.subQueue = [];
    this.el.subs.textContent = '';
    this.paUntil = 0;
    this.closeNote();
    for (const h of this.hits) h.el.remove();
    this.hits = [];
    this.el.eggs.hidden = true;
    for (const s of this.el.eggs.children) s.classList.remove('got');
    this.lastLyric = null;
    this.el.popups.textContent = '';
    this.shownPoints = null;
    this.last = {};
  }

  onEvent(e) {
    switch (e.type) {
      case 'roundStart': this.tally.setRound(e.round); break;
      case 'roundEnd': this.tally.setBlink(true); break;
      case 'points':
        if (e.playerId === this.localId) this.popup(e.amount, e.reason);
        break;
      case 'cantAfford':
        if (e.playerId === this.localId) {
          this.el.points.classList.remove('deny'); void this.el.points.offsetWidth; this.el.points.classList.add('deny');
        }
        break;
      case 'zombieHit':
        break;
      case 'shot':
        if (e.playerId === this.localId && this.cfg.hud.hitmarkers && e.impacts.some((h) => h.kind === 'zombie')) this.hitT = 0.12;
        break;
      case 'powerupGrab': {
        const d = this.cfg.powerups.list[e.ptype];
        this.toast(d.name, d.desc, d.color, 2.6);
        break;
      }
      case 'cheddarStart':
        this.toast('Cheddar Round', 'here, boy', '#ffb020', 4);
        break;
      case 'cheddarEnd':
        this.toast('Cheddar Round over', '', '#ffb020', 2.5);
        break;
      case 'boxBobble':
        if (e.playerId === this.localId) this.toast('Bye bye', 'the Mystery Box is moving · points refunded', '#7fcfff', 3);
        break;
      case 'boxMoved': {
        this.toast('The box has moved', this.roomNames && this.roomNames[e.room] ? 'look for the light in ' + this.roomNames[e.room] : 'look for the light', '#7fcfff', 3);
        break;
      }
      case 'powerOn':
        this.toast('The power is on', 'perks, traps and the lights are back', '#ffd23a', 3.5);
        break;
      case 'breakerThrown':
        if (e.count < e.total) this.toast('Main breaker thrown', `${e.count} of ${e.total}`, '#ffd23a', 2.6);
        break;
      case 'trophyPiece':
        this.toast(`Trophy piece ${e.count} of ${e.total}`, e.name, '#e8c060', 2.8);
        break;
      case 'madDogRevealed':
        this.toast('The Mad Dog Machine', 'up from under the gym floor', '#ff5030', 3.5);
        break;
      case 'statueAwake':
        this.toast('The statue is awake', 'its jaw is opening...', '#ff3020', 3);
        break;
      case 'coinTaken':
        this.toast('The Dark Schnitz Coin', e.playerId === this.localId ? 'you have it' : 'a teammate has it', '#7fe08a', 3);
        break;
      case 'erikRevealed':
        this.toast('Erik Madsen', 'sealed in the Press Box', '#7fe08a', 4);
        break;
      case 'bossStart':
        this.toast('The Intercom Showdown', 'Erik is calling the plays', '#ff4030', 4);
        break;
      case 'bossWave':
        if (e.wave > 1) this.toast(`Wave ${e.wave} of ${e.of}`, 'Zombie Defenders', '#ff4030', 2.4);
        break;
      case 'bossPhase':
        if (e.phase === 2) this.toast('Overcharge the system', 'take the amplifiers off his elites', '#7fe08a', 3.5);
        else this.toast('The speakers are howling', 'shoot the main soundboard wire!', '#7fe08a', 3.5);
        break;
      case 'ampTaken':
        if (e.playerId === this.localId) this.toast('Sound Amplifier', 'plug it into a speaker tower', '#7fe08a', 2.4);
        break;
      case 'towerPowered':
        this.toast(`Speaker tower ${e.count} of 4`, '', '#7fe08a', 2.2);
        break;
      case 'ritualStart':
        this.toast('Hold the circle', `${this.cfg.quest.ritualTime} seconds · don't leave it`, '#7fe08a', 3);
        break;
      case 'ritualFailed':
        this.toast('The circle went out', 'the ball drained again', '#c04040', 2.6);
        break;
      case 'ritualDone': {
        const what = { speed: 'faster on your feet', jump: 'higher off the ground', power: 'every hit hits harder', defense: 'hits hurt less' }[e.stat];
        const mine = !e.players || e.players.includes(this.localId);
        this.toast(e.stat.toUpperCase() + ' restored', mine ? what : 'a teammate got theirs back', '#ff9a30', 3.5);
        break;
      }
      case 'perkGained':
        if (e.playerId === this.localId) { const d = this.cfg.perks.list[e.perk]; this.toast(d.name, d.desc, d.color, 3); }
        break;
      case 'madDogTaken':
        if (e.playerId === this.localId) { const d = this.cfg.weapons[e.weapon]; this.toast(d.name, 'upgraded by the Mad Dog', d.view.camo, 3.5); }
        break;
      case 'playerRevived':
        if (e.playerId === this.localId) this.toast(e.self ? 'Second helping' : 'Back on your feet', '', '#3fa9f5', 2);
        break;
      case 'meleeHit':
        if (e.playerId === this.localId && this.cfg.hud.hitmarkers) this.hitT = 0.12;
        break;
      case 'erikSays':
        this.say('erik', 'Erik', e.text, e.lead || 0, e.dur);
        this.paUntil = this.clock + (e.lead || 0) + e.dur;
        break;
      case 'stewSays':
        if (e.playerId === this.localId) this.say('stew', this.localName || 'You', e.text, 0, e.dur);
        break;
      case 'valveTurned':
        if (e.count < e.total) this.toast(`Valve ${e.count} of ${e.total}`, 'something in the boiler room is heating up', '#ff7a3a', 2.4);
        break;
      case 'cauldronBoil':
        this.toast('The stew boils over!', `+${this.cfg.cauldron.points} for everyone`, '#ffb020', 3.5);
        break;
      case 'cheddarTalk':
        this.say('cheddar', 'Cheddar', e.text, 0, e.dur);
        break;
      case 'crewSays': {
        // whoever you're playing talks out loud; the rest are on the walkie
        const name = CREW[e.who] ? CREW[e.who].name : e.who;
        const radio = this.localCharacter ? e.who !== this.localCharacter : e.radio;   // (online: only your own lines are out loud)
        this.say(radio ? 'stew radio' : 'stew', radio ? `${name} · radio` : name, e.text, 0, e.dur);
        break;
      }
      case 'loreRead':
        if (e.playerId === this.localId) this.openNote(e.id);
        break;
      case 'stewItem': {
        this.el.eggs.hidden = false;
        const idx = STEW_ITEMS.findIndex((s) => s.id === e.id);
        if (idx >= 0) this.el.eggs.children[idx].classList.add('got');
        const it = STEW_ITEMS[idx];
        this.toast(`${e.count} of ${e.total}`, it ? it.name : e.name, '#f0d070', 3);
        break;
      }
      case 'stewSong':
        this.toast('We Go Stew', 'Stew Jams · side A', '#f0d070', 4);
        break;
      case 'playerDown':
        if (e.playerId !== this.localId && !e.final && this.names && this.names[e.playerId]) this.toast(`${this.names[e.playerId]} is down`, 'hold [F] on them to pick them up', '#ff5a40', 3);
        break;
      case 'playerDied':
        if (e.playerId !== this.localId && e.bledOut && this.names && this.names[e.playerId]) this.toast(`${this.names[e.playerId]} bled out`, 'they\'re back next round', '#ff5a40', 3);
        else if (e.playerId === this.localId && e.bledOut) this.toast('You bled out', 'you\'re back next round if your team survives', '#ff5a40', 6);
        break;
      case 'playerRespawn':
        if (e.playerId === this.localId) this.toast('Back in', 'you\'re back for this round', '#7fcfff', 3);
        break;
      case 'playerLeft':
        this.toast(`${e.name} left the game`, '', '#b8b0a0', 3);
        break;
      case 'playerHit':
        if (e.playerId === this.localId && e.from) this.hitFrom(e.from);
        break;
    }
  }

  // --- the scoreboard (hold Tab / Back) ---------------------------------------
  // "Spectating X" while dead online (p = the teammate, or null to hide)
  showSpectate(p, canCycle) {
    const el = document.getElementById('spectate'); if (!el) return;
    const g = glyph('fire');
    const key = p ? p.id + ':' + canCycle + ':' + g : '';
    if (key === this.last.spec) return; this.last.spec = key;
    el.hidden = !p;
    if (!p) return;
    const name = (CREW[p.character] && CREW[p.character].name) || p.name || p.id;
    el.querySelector('.who').textContent = name;
    el.querySelector('.how').innerHTML = canCycle ? `${g} next player · back next round` : 'Back next round';
  }

  showScoreboard(on) { this.scoreboardOn = !!on; const el = document.getElementById('scoreboard'); if (el) el.hidden = !on; if (on) this.last.sb = null; }

  updateScoreboard(sim, CH) {
    if (!this.scoreboardOn) return;
    const rows = [...sim.players].sort((a, b) => b.points - a.points);
    const key = sim.rounds.round + '|' + rows.map((q) => [q.id, q.points, q.kills, q.headshots, q.downs || 0, q.revives || 0, q.downed ? 'd' : q.alive ? 'a' : 'x'].join(',')).join(';');
    if (key === this.last.sb) return;
    this.last.sb = key;
    document.getElementById('sb-round').textContent = `Round ${Math.max(1, sim.rounds.round)}`;
    const tb = document.getElementById('sb-rows');
    tb.textContent = '';
    for (const q of rows) {
      const tr = document.createElement('tr');
      tr.className = [q.id === this.localId ? 'you' : '', q.downed ? 'down' : q.alive ? '' : 'out'].join(' ').trim();
      const name = document.createElement('td');
      name.textContent = q.name;
      const sub = document.createElement('small');
      sub.textContent = (CH && CH[q.character] ? CH[q.character].name : '') + (q.downed ? ' · down' : q.alive ? '' : ' · out');
      name.appendChild(sub);
      tr.appendChild(name);
      for (const v of [q.points, q.kills, q.headshots, q.downs || 0, q.revives || 0]) { const td = document.createElement('td'); td.textContent = String(v); tr.appendChild(td); }
      tb.appendChild(tr);
    }
    document.getElementById('sb-foot').textContent = sim.players.length > 1 ? 'Bleed out and you\'re back next round' : (sim.teamName || 'Stew') + ' · solo';
  }

  // --- teammates (online): names and points over yours ------------------------
  updateTeam(sim) {
    const others = sim.players.filter((q) => q.id !== this.localId);
    this.names = Object.fromEntries(sim.players.map((q) => [q.id, q.name]));
    const key = others.map((q) => `${q.id}:${q.name}:${q.points}:${q.downed ? 'd' : q.alive ? 'a' : 'x'}`).join('|');
    if (key === this.last.team) return;
    this.last.team = key;
    const el = this.el.team || (this.el.team = document.getElementById('team'));
    if (!el) return;
    el.hidden = !others.length;
    el.textContent = '';
    for (const q of others) {
      const row = document.createElement('div');
      row.className = q.downed ? 'down' : q.alive ? '' : 'out';
      const n = document.createElement('span'); n.textContent = q.name;
      const v = document.createElement('b'); v.textContent = q.downed ? 'down' : q.alive ? String(q.points) : 'out';
      row.append(n, v);
      el.appendChild(row);
    }
  }

  // --- subtitles ------------------------------------------------------------
  say(cls, who, text, delay, dur) {
    this.subQueue.push({ at: this.clock + delay, until: this.clock + delay + dur + 1.0, cls, who, text, el: null });
  }

  updateSubs(dt) {
    this.clock += dt;
    // show lines that are due
    for (const q of this.subQueue) {
      if (q.el || this.clock < q.at) continue;
      if (!this.subtitles) { q.until = -1; continue; }
      q.el = document.createElement('div');
      q.el.className = 'sub ' + q.cls;
      const b = document.createElement('b'); b.textContent = q.who;
      q.el.append(b, document.createTextNode(q.text));
      this.el.subs.appendChild(q.el);
    }
    // only the latest two stay on screen
    const shown = this.subQueue.filter((x) => x.el);
    for (let i = 0; i < shown.length - 2; i++) shown[i].until = -1;
    // fade out finished ones
    this.subQueue = this.subQueue.filter((q) => {
      if (q.until >= 0 && this.clock <= q.until) return true;
      if (q.el) { const el = q.el; el.classList.add('out'); setTimeout(() => el.remove(), 450); }
      return false;
    });
    this.set('pa', this.el.pa, this.clock < this.paUntil ? 'on' : '', 'className');
    // the song's lyrics
    const lyric = this.subtitles && this.lyricSource ? this.lyricSource() : null;
    if (lyric !== this.lastLyric) {
      this.lastLyric = lyric;
      if (this.lyricEl) { const el = this.lyricEl; el.classList.add('out'); setTimeout(() => el.remove(), 450); this.lyricEl = null; }
      if (lyric) {
        this.lyricEl = document.createElement('div');
        this.lyricEl.className = 'sub song';
        this.lyricEl.textContent = '♪ ' + lyric + ' ♪';
        this.el.subs.prepend(this.lyricEl);
      }
    }
  }

  // --- notes ------------------------------------------------------------------
  openNote(id) {
    const n = NOTES.find((x) => x.id === id);
    if (!n) return;
    if (this.noteOpen === id) { this.closeNote(); return; }
    this.noteOpen = id;
    const el = this.el.note;
    el.querySelector('h3').textContent = n.title;
    el.querySelector('.where').textContent = n.where;
    el.querySelector('.body').textContent = n.text;
    el.hidden = false;
    if (this.onNoteRead) this.onNoteRead(id);
  }

  closeNote() { this.noteOpen = null; this.el.note.hidden = true; }

  // --- damage direction --------------------------------------------------------
  hitFrom(from) {
    const el = document.createElement('div');
    el.className = 'arc';
    this.el.dmgdir.appendChild(el);
    this.hits.push({ from, t: 0, el });
    if (this.hits.length > 4) { const h = this.hits.shift(); h.el.remove(); }
  }

  updateHits(dt, p) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      h.t += dt;
      if (h.t > 1.1 || !p) { h.el.remove(); this.hits.splice(i, 1); continue; }
      const dx = h.from.x - p.pos.x, dz = h.from.z - p.pos.z;
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      const a = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
      h.el.style.setProperty('--a', `${a.toFixed(3)}rad`);
      h.el.style.setProperty('--o', String(Math.min(1, (1.1 - h.t) * 2.2).toFixed(2)));
    }
  }

  popup(amount, reason) {
    const d = document.createElement('div');
    d.className = 'popup' + (reason === 'headshot' || reason === 'knife' ? ' big' : '') + (amount < 0 ? ' spend' : '');
    d.textContent = (amount > 0 ? '+' : '') + amount;
    d.style.setProperty('--dx', `${Math.round(-30 - Math.random() * 70)}px`);
    d.style.setProperty('--dy', `${Math.round(-18 - Math.random() * 36)}px`);
    this.el.popups.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }

  set(key, el, value, prop = 'textContent') {
    if (this.last[key] === value) return;
    this.last[key] = value;
    el[prop] = value;
  }

  update(dt, sim, p, camera, showFps) {
    this.tally.update(dt);
    // the quest's current objective, top left
    const obj = sim.quest ? questObjective(sim) : null;
    if (obj !== this.last.objective) {
      this.last.objective = obj;
      this.el.quest.hidden = !obj;
      this.el.quest.querySelector('span').textContent = obj || '';
      this.el.quest.classList.remove('new'); void this.el.quest.offsetWidth; this.el.quest.classList.add('new');
    }
    this.updateSubs(dt);
    this.updateHits(dt, p);
    if (!p) return;
    // put the note down when you walk away from it
    if (this.noteOpen && !(p.useTarget && p.useTarget.noteId === this.noteOpen)) this.closeNote();

    this.updateTeam(sim);
    this.updateScoreboard(sim, CREW);
    // points count up quickly instead of snapping
    if (this.shownPoints === null) this.shownPoints = p.points;
    const diff = p.points - this.shownPoints;
    this.shownPoints += Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * Math.min(1, dt * 14)));
    if (Math.abs(p.points - this.shownPoints) < 1) this.shownPoints = p.points;
    this.set('points', this.el.points, String(Math.round(this.shownPoints)));

    // ammo
    const w = p.loadout;
    const slot = w.slots[w.current];
    const def = this.cfg.weapons[slot.id];
    this.set('wname', this.el.wname, def.name);
    this.set('wcolor', this.el.wname.style, def.view.camo || '', 'color');
    this.set('clip', this.el.clip, String(slot.clip));
    this.set('clipL', this.el.clipL, def.dual ? String(slot.clipL) : '');
    this.set('grenades', this.el.grenades, '<b></b>'.repeat(Math.max(0, p.stewBombs || 0)) + '<i></i>'.repeat(Math.max(0, p.grenades)), 'innerHTML');
    const scoped = !!def.scope && w.adsAmount > 0.85 && p.alive;
    this.set('scope', this.el.scope, !scoped, 'hidden');
    this.set('reserve', this.el.reserve, String(slot.reserve));
    const low = slot.clip < def.magSize && slot.clip <= Math.ceil(def.magSize * this.cfg.hud.lowAmmoFraction);
    this.set('lowclass', this.el.ammo, low ? 'low' : '', 'className');

    // crosshair gap from current spread
    const hideCross = (w.adsAmount > 0.5 && !def.dual) || !!p.throwing || p.sprinting || !p.alive || p.melee.timer > 0;
    this.set('crossHidden', this.el.cross, hideCross ? 'hidden' : '', 'className');
    if (!hideCross) {
      const spread = (w.spreadNow || 2) * Math.PI / 180;
      const h = window.innerHeight;
      const gap = Math.tan(spread) / Math.tan((camera.fov * Math.PI / 180) / 2) * (h / 2);
      this.el.cross.style.setProperty('--gap', `${Math.max(4, Math.min(80, gap)).toFixed(1)}px`);
    }

    // hitmarker
    this.hitT = Math.max(0, this.hitT - dt);
    this.set('hit', this.el.hit, this.hitT > 0 ? 'on' : '', 'className');

    // prompt & hints
    let prompt = p.prompt ? p.prompt.text + (p.prompt.cost != null ? ` [Cost: ${p.prompt.cost}]` : '') : '';
    if (p.rebuilding) prompt = 'Rebuilding barrier';
    this.set('prompt', this.el.prompt, prompt && glyphify(prompt), 'innerHTML');
    this.set('promptsub', this.el.promptsub, p.prompt && p.prompt.sub ? p.prompt.sub : '');

    // timed power-ups
    const act = sim.powerups.active;
    const puKey = Object.entries(act).filter(([, t]) => t > 0).map(([k, t]) => k + ':' + Math.ceil(t)).join(',');
    if (puKey !== this.last.pu) {
      this.last.pu = puKey;
      this.el.powerups.textContent = '';
      for (const [k, t] of Object.entries(act)) {
        if (!(t > 0)) continue;
        const d = this.cfg.powerups.list[k];
        const el = document.createElement('div');
        el.className = 'pu' + (t < 6 ? ' low' : '');
        el.style.setProperty('--c', d.color);
        const img = document.createElement('img'); img.src = powerupIconURL(k, d.color); img.alt = d.name;
        const sec = document.createElement('span'); sec.textContent = String(Math.ceil(t));
        el.append(img, sec);
        this.el.powerups.appendChild(el);
      }
    }

    // perks
    const perkKey = p.perks.join(',');
    if (perkKey !== this.last.perks) {
      this.last.perks = perkKey;
      this.el.perks.textContent = '';
      for (const id of p.perks) {
        const d = this.cfg.perks.list[id];
        const i = document.createElement('div');
        i.className = 'perk'; i.title = d.name; i.textContent = d.glyph;
        i.style.setProperty('--c', d.color);
        this.el.perks.appendChild(i);
      }
    }

    // last stand
    const dn = p.downed;
    this.set('downedHidden', this.el.downed, !dn, 'hidden');
    if (dn) {
      const self = dn.selfRevive != null;
      const frac = self ? 1 - dn.selfRevive / this.cfg.perks.list.secondHelping.selfReviveTime : dn.bleed / this.cfg.lastStand.bleedOut;
      this.set('downedText', this.el.downed.querySelector('.small'), self ? 'Second Helping is getting you up' : dn.reviverId ? 'Being revived' : 'Bleeding out', 'textContent');
      this.el.downed.querySelector('.bar i').style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
      this.el.downed.querySelector('.bar i').style.background = self ? '#3fa9f5' : '';
    }
    this.set('reviveHidden', this.el.revive, !p.reviving, 'hidden');
    if (p.reviving) this.el.revive.querySelector('.bar i').style.width = `${p.reviving.frac * 100}%`;
    let hint = '';
    if (p.drinking) hint = '';
    else if (p.throwing && p.throwing.phase === 'cook') hint = `Cooking ${Math.max(0, this.cfg.equipment.frag.fuse - p.throwing.t).toFixed(1)}`;
    if (hint) { /* cooking */ }
    else if (slot.clip === 0 && slot.reserve === 0) hint = 'No ammo';
    else if (w.reloading) hint = '';
    else if (low && slot.reserve > 0) hint = 'Press [R] to reload';
    else if (low) hint = 'Low ammo';
    this.set('hint', this.el.hint, hint && glyphify(hint), 'innerHTML');

    if (showFps) {
      this.fpsAcc += dt; this.fpsN++;
      if (this.fpsAcc > 0.5) { this.el.fps.textContent = `${Math.round(this.fpsN / this.fpsAcc)} fps`; this.fpsAcc = 0; this.fpsN = 0; }
    } else if (this.el.fps.textContent) this.el.fps.textContent = '';
  }
}
