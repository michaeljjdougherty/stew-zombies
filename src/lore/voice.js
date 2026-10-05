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

// For AudioEngine.preloadSprite: each speaker's lines live in one file,
// assets/voice/<speaker>.mp3. -> [{ url, segs: { key: [start, seconds] } }]
export function voiceSprites() {
  return Object.entries(VOICE_LINES).map(([who, by]) => {
    const segs = {};
    for (const [file, dur, start] of Object.values(by)) segs['vo:' + file] = [start, dur];
    return { url: VOICE_BASE + who + '.mp3', segs };
  });
}
