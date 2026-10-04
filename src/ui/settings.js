// Player settings, remembered in this browser when storage is available.
import { CONFIG } from '../config.js';

const KEY = 'stew-zombies-settings-v1';

export const DEFAULT_SETTINGS = {
  sensitivity: CONFIG.input.defaultSensitivity,
  adsSensitivity: CONFIG.input.defaultAdsSensitivity,
  fov: CONFIG.camera.defaultFov,
  invertY: false,
  master: CONFIG.audio.master,
  music: CONFIG.audio.music,
  voice: CONFIG.audio.voice,
  subtitles: true,
  padSensitivity: 1.0,
  aimAssist: true,
  rumble: true,
  padIcons: 'auto',
  character: 'kearns',
  name: '',               // shown to friends online
  shirt: 'sage',
  renderScale: CONFIG.graphics.renderScale,
  grain: true,
  bloom: true,
  ao: CONFIG.graphics.ao,
  reflections: CONFIG.graphics.reflections,
  showFps: false,
};

export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
  return { ...DEFAULT_SETTINGS, ...s };
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
}
