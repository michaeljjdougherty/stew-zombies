// =============================================================================
// Menus: title, pause, settings, extras, game over. Plain DOM, wired with callbacks.
// =============================================================================
import { CONFIG } from '../config.js';
import { graphicsPreset, applyGraphicsPreset } from './settings.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(settings, handlers) {
    this.settings = settings;
    this.h = handlers; // { play, range, resume, restart, quit, settingsChanged }
    this.screens = ['title', 'mapselect', 'pause', 'settings', 'gameover', 'victory', 'extras', 'charselect', 'lineup', 'online', 'signin', 'career', 'gums', 'factory', 'shop'].map((id) => $(id));
    this.returnTo = 'title';

    $('btn-play').addEventListener('click', () => this.h.play());
    $('btn-online').addEventListener('click', () => this.h.online());
    $('btn-range').addEventListener('click', () => this.h.range());
    $('btn-explore').addEventListener('click', () => this.h.explore());
    $('btn-title-settings').addEventListener('click', () => this.openSettings('title'));
    $('btn-extras').addEventListener('click', () => this.h.extras());
    // the trailer: pick its graphics first (lower plays smoother on a slower machine)
    const pick = $('trailer-pick');
    $('btn-trailer').addEventListener('click', () => {
      pick.hidden = !pick.hidden;
      if (pick.hidden) return;
      const q = this.h.trailerQuality();
      for (const b of pick.querySelectorAll('button')) b.setAttribute('aria-current', String(b.dataset.q === q));
      const cur = pick.querySelector('button[aria-current="true"]');
      if (cur) cur.focus();
    });
    for (const b of pick.querySelectorAll('button')) b.addEventListener('click', () => { pick.hidden = true; this.h.trailer({ quality: b.dataset.q }); });
    $('btn-chars').addEventListener('click', () => this.h.characters());
    $('btn-career').addEventListener('click', () => this.h.career());
    $('btn-extras-back').addEventListener('click', () => this.h.extrasBack());
    $('btn-resume').addEventListener('click', () => this.h.resume());
    $('btn-pause-settings').addEventListener('click', () => this.openSettings('pause'));
    $('btn-restart').addEventListener('click', () => this.h.restart());
    $('btn-quit').addEventListener('click', () => this.h.quit());
    $('btn-settings-back').addEventListener('click', () => this.show(this.returnTo));
    $('btn-again').addEventListener('click', () => this.h.restart());
    $('btn-over-title').addEventListener('click', () => this.h.quit());
    $('btn-win-again').addEventListener('click', () => this.h.restart());
    $('btn-win-title').addEventListener('click', () => this.h.quit());

    this.bindSettings();
    this.bindBlades();
  }

  // --- the title's blades (Play, GobbleGum, Extras, Settings) ----------------------
  // One open at a time; the others stand as tabs either side. Clicking or focusing
  // a tab opens its blade; left/right (keyboard) and the bumpers (controller) flip.
  bindBlades() {
    this.blades = [...document.querySelectorAll('#blades .blade')];
    for (const b of this.blades) {
      const tab = b.querySelector('.blade-tab');
      tab.addEventListener('click', () => this.openBlade(b.dataset.blade, true));
      tab.addEventListener('focus', () => this.openBlade(b.dataset.blade));
    }
    window.addEventListener('keydown', (e) => {
      if (this.current !== 'title' || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      e.preventDefault();
      this.flipBlade(e.key === 'ArrowLeft' ? -1 : 1);
    });
    this.row = document.getElementById('blades');
    // (the sheet's place, again whenever the row changes size or comes back into view)
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => this.placeSheet()).observe(this.row);
    this.openBlade(this.blades[0].dataset.blade);
  }

  openBlade(id, focusIn = false) {
    if (this.blade === id && !focusIn) return;
    const flip = !!this.blade && this.blade !== id;
    this.blade = id;
    // the tabs glide to where they're going (where they were, then let go)
    const tabs = this.blades.map((b) => b.querySelector('.blade-tab'));
    const was = flip ? tabs.map((t) => t.getBoundingClientRect().left) : null;
    for (const b of this.blades) b.classList.toggle('open', b.dataset.blade === id);
    if (was) {
      tabs.forEach((t, i) => {
        const dx = was[i] - t.getBoundingClientRect().left;
        if (!dx) return;
        t.style.transition = 'none'; t.style.translate = `${dx}px 0`;
        void t.offsetWidth;
        t.style.transition = ''; t.style.translate = '';
      });
    }
    this.placeSheet();
    if (this.h.bladeOpened) this.h.bladeOpened(id, flip);
    if (focusIn) { const first = document.querySelector(`#blades .blade[data-blade="${id}"] .blade-body button`); if (first) first.focus({ preventScroll: true }); }
  }

  // The open page is one sheet that slides under the open blade's body (moving
  // it is cheap; re-drawing its burnt edge at a new size every frame wasn't).
  placeSheet() {
    const open = this.blades.find((b) => b.dataset.blade === this.blade);
    const body = open && open.querySelector('.blade-body');
    if (!body || !this.row) return;
    const row = this.row.getBoundingClientRect(), r = body.getBoundingClientRect(), o = open.getBoundingClientRect();
    if (!row.width || !r.width) return;   // (hidden)
    const x = Math.round(r.left - row.left - 6), w = Math.round(o.right - r.left + 6);
    if (!this.row.dataset.sheet) this.row.style.setProperty('--sheet-x', `${x}px`);   // (the first time: just be there)
    void this.row.offsetWidth;
    this.row.style.setProperty('--sheet-x', `${x}px`);
    if (this.row.style.getPropertyValue('--sheet-w') !== `${w}px`) this.row.style.setProperty('--sheet-w', `${w}px`);
    this.row.dataset.sheet = '1';
  }

  flipBlade(dir) {
    const ids = this.blades.map((b) => b.dataset.blade);
    const i = ids.indexOf(this.blade);
    this.openBlade(ids[(i + dir + ids.length) % ids.length], true);
  }

  show(id) {
    for (const s of this.screens) s.hidden = s.id !== id;
    this.current = id;
  }

  hideAll() { for (const s of this.screens) s.hidden = true; this.current = null; }

  openSettings(from) { this.returnTo = from; this.show('settings'); }

  bindSettings() {
    const s = this.settings;
    const refresh = [];      // re-read every control from s (after a preset)
    const changed = () => { this.h.settingsChanged(s); showPreset(); };
    const range = (id, key, fmt) => {
      const el = $(id), out = $(id + '-val');
      const show = () => { el.value = s[key]; out.textContent = fmt(s[key]); };
      show(); refresh.push(show);
      el.addEventListener('input', () => {
        s[key] = parseFloat(el.value);
        out.textContent = fmt(s[key]);
        changed();
      });
    };
    const check = (id, key) => {
      const el = $(id);
      const show = () => { el.checked = !!s[key]; };
      show(); refresh.push(show);
      el.addEventListener('change', () => { s[key] = el.checked; changed(); });
    };
    // a button that steps through choices: [value, label, note]
    const cycle = (id, key, opts) => {
      const btn = $(id), note = $(id + '-note');
      const find = () => Math.max(0, opts.findIndex(([v]) => v === s[key]));
      const show = () => { const o = opts[find()]; btn.textContent = o[1]; if (note) note.textContent = o[2] || ''; };
      show(); refresh.push(show);
      btn.addEventListener('click', () => { s[key] = opts[(find() + 1) % opts.length][0]; show(); changed(); });
    };
    $('set-fov').min = CONFIG.camera.minFov;
    $('set-fov').max = CONFIG.camera.maxFov;
    range('set-sens', 'sensitivity', (v) => v.toFixed(2));
    range('set-ads', 'adsSensitivity', (v) => v.toFixed(2));
    range('set-padsens', 'padSensitivity', (v) => v.toFixed(2));
    range('set-fov', 'fov', (v) => `${Math.round(v)}°`);
    range('set-vol', 'master', (v) => `${Math.round(v * 100)}%`);
    range('set-music', 'music', (v) => `${Math.round(v * 100)}%`);
    range('set-voice', 'voice', (v) => `${Math.round(v * 100)}%`);
    range('set-scale', 'renderScale', (v) => `${Math.round(v * 100)}%`);
    check('set-invert', 'invertY');
    check('set-grain', 'grain');
    check('set-bloom', 'bloom');
    check('set-ao', 'ao');
    check('set-refl', 'reflections');
    check('set-autores', 'autoRes');
    check('set-fps', 'showFps');
    check('set-subs', 'subtitles');
    check('set-assist', 'aimAssist');
    check('set-rumble', 'rumble');

    // --- graphics
    cycle('set-menumusic', 'menuMusic', [['kettle', 'The Kettle Liturgy', 'The Stew Zombies 2.0 theme'], ['classic', 'Original', 'The first game\'s theme']]);
    cycle('set-fpscap', 'fpsCap', CONFIG.graphics.fpsCaps.map((c) => [c, c ? `${c} fps` : 'Off', c ? (c <= 30 ? 'Steadier and cooler on weak machines' : 'Saves power and heat') : 'As fast as your screen allows']));
    cycle('set-sharp', 'sharpness', [
      [1, 'Standard', 'Big boost on Retina / 4K screens'],
      [1.5, 'Sharp', 'Crisper on high-res screens'],
      [2, 'Max', 'Full Retina detail (heavy)'],
    ]);
    cycle('set-lights', 'lights', [
      ['low', 'Low', '4 real lights near you'],
      ['medium', 'Medium', '6 real lights near you'],
      ['high', 'High', '10 real lights near you'],
      ['ultra', 'Ultra', '12 real lights near you'],
    ]);
    cycle('set-effects', 'effects', [
      ['low', 'Low', 'Fewer particles, snow and marks; bodies clear fast'],
      ['medium', 'Medium', 'Some particles, snow and marks'],
      ['high', 'High', 'Everything'],
    ]);
    cycle('set-zmodels', 'zombieModels', [
      ['detailed', 'Detailed', 'Full animated zombies'],
      ['simple', 'Simple', 'Low-poly zombies (from the next ones that spawn)'],
    ]);
    cycle('set-gmodels', 'gunModels', [
      ['detailed', 'Detailed', 'Full gun models'],
      ['simple', 'Simple', 'Low-poly guns'],
    ]);
    const PRESETS = [
      ['low', 'Low', 'Older laptops and Chromebooks'],
      ['medium', 'Medium', 'Most laptops'],
      ['high', 'High', 'Gaming PCs and newer Macs'],
      ['ultra', 'Ultra', 'Fast desktops'],
    ];
    const presetBtn = $('set-preset'), presetNote = $('set-preset-note');
    const showPreset = () => {
      const k = graphicsPreset(s);
      const o = PRESETS.find(([v]) => v === k);
      presetBtn.textContent = o ? o[1] : 'Custom';
      presetNote.textContent = o ? o[2] : 'Your own mix';
    };
    showPreset();
    presetBtn.addEventListener('click', () => {
      const i = PRESETS.findIndex(([v]) => v === graphicsPreset(s));   // Custom steps to Low
      applyGraphicsPreset(s, PRESETS[(i + 1) % PRESETS.length][0]);
      for (const f of refresh) f();
      changed();
    });

    // button prompts: Auto / Xbox / PlayStation
    const ICONS = [['auto', 'Auto'], ['xbox', 'Xbox'], ['ps', 'PlayStation']];
    const iconBtn = $('set-icons');
    const showIcons = () => { iconBtn.textContent = (ICONS.find(([k]) => k === s.padIcons) || ICONS[0])[1]; };
    showIcons();
    iconBtn.addEventListener('click', () => {
      const i = ICONS.findIndex(([k]) => k === s.padIcons);
      s.padIcons = ICONS[(i + 1) % ICONS.length][0];
      showIcons();
      this.h.settingsChanged(s);
    });
  }

  // (o: the map's own words: eyebrow, big, unlock, note; the school's are the defaults in index.html)
  showVictory(round, p, unlocked = false, o = {}) {
    if (!this.winDefaults) this.winDefaults = { eyebrow: $('win-eyebrow').innerHTML, big: $('win-big').innerHTML, unlock: $('win-unlock').innerHTML, note: $('win-note').innerHTML };
    for (const k of ['eyebrow', 'big', 'unlock', 'note']) $('win-' + k).innerHTML = o[k] ?? this.winDefaults[k];
    $('win-unlock').hidden = !unlocked;
    $('win-rounds').textContent = String(round);
    $('win-kills').textContent = String(p.kills);
    $('win-heads').textContent = String(p.headshots);
    $('win-points').textContent = String(p.points);
    this.show('victory');
  }

  showGameOver(team, round, p, erikLine = '', divinium = 0) {
    $('over-div').hidden = !divinium;
    $('over-div').textContent = divinium ? `+${divinium} Liquid Divinium` : '';
    $('over-erik').textContent = erikLine ? `“${erikLine}” — Erik, over the PA` : '';
    $('over-rounds').textContent = String(round);
    $('over-round-word').textContent = round === 1 ? 'round' : 'rounds';
    $('over-team').textContent = team;
    $('over-kills').textContent = String(p.kills);
    $('over-heads').textContent = String(p.headshots);
    $('over-knife').textContent = String(p.knifeKills);
    $('over-points').textContent = String(p.points);
    this.show('gameover');
  }
}
