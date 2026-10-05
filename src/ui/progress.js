// What this browser has found so far: lore notes read, the Stew song unlocked.
// Kept in localStorage when it's available; everything works without it.
const KEY = 'stew-zombies-progress-v1';

export function loadProgress() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { p = {}; }
  // (questDone and introSeen were being dropped here, so Brian re-locked and
  // the intro played again after every reload)
  return { notes: Array.isArray(p.notes) ? p.notes : [], song: !!p.song, bestRound: p.bestRound | 0, questDone: !!p.questDone, introSeen: !!p.introSeen };
}

export function saveProgress(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* storage unavailable */ }
}
