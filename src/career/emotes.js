// =============================================================================
// Emotes: dances and taunts any character can do from the emote wheel
// (hold [B] / D-pad up, src/ui/emoteWheel.js). The camera pulls back so you
// can watch, and teammates see it online. Moving or firing ends it.
//
// act: the animation (IDLE_ACTS in src/render/characterAnim.js)
// beat: plays James's little bass beat (src/audio/idleBeat.js)
// free: everyone has it; the rest are bought with Stew Bucks, priced by rarity
// pass: the Battle Pass tier that unlocks it (not for sale; src/career/battlepass.js)
// =============================================================================
export const EMOTES = [
  { id: 'fingerGuns', name: 'Finger Guns', act: 'fingerGuns', rarity: 'common', free: true, blurb: 'Rocco\'s bounce, finger guns blazing.' },
  { id: 'bigWave', name: 'Big Wave', act: 'bigWave', rarity: 'common', free: true, blurb: 'A big friendly wave. Brian\'s, from across the portal.' },
  { id: 'slowClap', name: 'Slow Clap', act: 'slowClap', rarity: 'common', blurb: 'Wow. Great job. Really.' },
  { id: 'floss', name: 'The Floss', act: 'floss', rarity: 'rare', blurb: 'Arms one way, hips the other. Still.' },
  { id: 'theJudge', name: 'The Judge', act: 'judge', rarity: 'rare', blurb: 'Kyle\'s move: arms crossed, one brow up, the squint.' },
  { id: 'jimmyShimmy', name: 'Jimmy Shimmy', act: 'twerk', rarity: 'legendary', beat: true, blurb: 'James\'s move: turn round, hands on knees, and let the beat drop.' },
  // the Battle Pass
  { id: 'dab', name: 'The Dab', act: 'dab', rarity: 'common', pass: 4, blurb: 'Head down, arms out. Hit it, hold it.' },
  { id: 'robot', name: 'The Robot', act: 'robot', rarity: 'rare', pass: 10, blurb: 'Stiff arms, sharp angles, one beep at a time.' },
  { id: 'salute', name: 'Salute', act: 'salute', rarity: 'rare', pass: 16, blurb: 'Feet together, a sharp salute. Reporting for the next round.' },
];

export const EMOTE_BY_ID = Object.fromEntries(EMOTES.map((e) => [e.id, e]));
