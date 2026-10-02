// =============================================================================
// Menus: title, pause, settings, extras, game over. Plain DOM, wired with callbacks.
// =============================================================================
import { CONFIG } from '../config.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(settings, handlers) {
    this.settings = settings;
    this.h = handlers; // { play, range, resume, restart, quit, settingsChanged }
    this.screens = ['title', 'pause', 'settings', 'gameover', 'extras', 'charselect', 'lineup'].map((id) => $(id));
    this.returnTo = 'title';

    $('btn-play').addEventListener('click', () => this.h.play());
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
    const range = (id, key, fmt) => {
      const el = $(id), out = $(id + '-val');
      el.value = s[key];
      out.textContent = fmt(s[key]);
      el.addEventListener('input', () => {
        s[key] = parseFloat(el.value);
        out.textContent = fmt(s[key]);
        this.h.settingsChanged(s);
      });
    };
    const check = (id, key) => {
      const el = $(id);
      el.checked = !!s[key];
      el.addEventListener('change', () => { s[key] = el.checked; this.h.settingsChanged(s); });
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
    check('set-fps', 'showFps');
    check('set-subs', 'subtitles');
    check('set-assist', 'aimAssist');
    check('set-rumble', 'rumble');
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
