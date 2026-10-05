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
  // more graphics (see CONFIG.graphics.presets)
  autoRes: false,           // drop the resolution when the frame rate dips
  fpsCap: 0,                // 0 = no cap
  sharpness: CONFIG.graphics.maxPixelRatio,   // pixel ratio cap on high-DPI screens
  lights: 'high',           // dynamic lights: low / medium / high / ultra
  effects: 'high',          // particles, dust, snow, marks, bodies: low / medium / high
  zombieModels: 'detailed', // 'simple' = the low-poly zombies, no skinning
  gunModels: 'detailed',    // 'simple' = the built-in low-poly guns
  questHints: 'walkthrough',   // the Easter egg: 'walkthrough' shows each step, 'hardcore' doesn't
};

export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
  return { ...DEFAULT_SETTINGS, ...s };
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
}

// Which preset the graphics options match right now ('custom' if none).
export function graphicsPreset(s) {
  for (const [k, p] of Object.entries(CONFIG.graphics.presets)) {
    if (Object.entries(p).every(([key, v]) => (typeof v === 'number' ? Math.abs(s[key] - v) < 0.001 : s[key] === v))) return k;
  }
  return 'custom';
}

export function applyGraphicsPreset(s, name) {
  const p = CONFIG.graphics.presets[name];
  if (p) Object.assign(s, p);
}
