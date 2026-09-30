// =============================================================================
// Menus: title, pause, settings, game over. Plain DOM, wired with callbacks.
// =============================================================================
import { CONFIG } from '../config.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(settings, handlers) {
    this.settings = settings;
    this.h = handlers; // { play, resume, restart, quit, settingsChanged }
    this.screens = ['title', 'pause', 'settings', 'gameover'].map((id) => $(id));
    this.returnTo = 'title';

    $('btn-play').addEventListener('click', () => this.h.play());
    $('btn-title-settings').addEventListener('click', () => this.openSettings('title'));
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
    range('set-fov', 'fov', (v) => `${Math.round(v)}°`);
    range('set-vol', 'master', (v) => `${Math.round(v * 100)}%`);
    range('set-music', 'music', (v) => `${Math.round(v * 100)}%`);
    range('set-scale', 'renderScale', (v) => `${Math.round(v * 100)}%`);
    check('set-invert', 'invertY');
    check('set-grain', 'grain');
    check('set-bloom', 'bloom');
    check('set-fps', 'showFps');
  }

  showGameOver(team, round, p) {
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
