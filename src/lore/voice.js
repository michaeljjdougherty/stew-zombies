// =============================================================================
// Recorded voice lines: which lines have a real recording, and how long they
// run. The sim uses the length (so subtitles and who-talks-when match the
// recording); the sound director plays the file. Lines without one fall back
// to the synthesized placeholder voice. Pure data, safe in the sim.
// =============================================================================
import { VOICE_LINES } from './voiceLines.js';

export const VOICE_BASE = 'assets/voice/';

// [file, seconds] for this speaker's line, or null
export function recording(who, text) {
  const by = VOICE_LINES[who];
  return (by && text && by[text]) || null;
}

// how long the line runs when recorded (null if it isn't)
export const recordedDuration = (who, text) => { const r = recording(who, text); return r ? r[1] : null; };

// the sample key the audio engine knows it by
export const voiceKey = (who, text) => { const r = recording(who, text); return r ? 'vo:' + r[0] : null; };

// for AudioEngine.preload: { key: [path without .mp3] }
export function voiceManifest() {
  const m = {};
  for (const [who, by] of Object.entries(VOICE_LINES)) for (const [file] of Object.values(by)) m['vo:' + file] = [who + '/' + file];
  return m;
}
