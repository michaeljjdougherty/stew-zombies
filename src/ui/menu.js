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
    this.screens = ['title', 'mapselect', 'pause', 'settings', 'gameover', 'victory', 'extras', 'charselect', 'lineup', 'online'].map((id) => $(id));
    this.returnTo = 'title';

    $('btn-play').addEventListener('click', () => this.h.play());
    $('btn-online').addEventListener('click', () => this.h.online());
    $('btn-range').addEventListener('click', () => this.h.range());
    $('btn-explore').addEventListener('click', () => this.h.explore());
    $('btn-title-settings').addEventListener('click', () => this.openSettings('title'));
    $('btn-extras').addEventListener('click', () => this.h.extras());
    $('btn-chars').addEventListener('click', () => this.h.characters());
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

  showVictory(round, p, unlocked = false) {
    $('win-unlock').hidden = !unlocked;
    $('win-rounds').textContent = String(round);
    $('win-kills').textContent = String(p.kills);
    $('win-heads').textContent = String(p.headshots);
    $('win-points').textContent = String(p.points);
    this.show('victory');
  }

  showGameOver(team, round, p, erikLine = '') {
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
