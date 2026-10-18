// =============================================================================
// Skins: outfits for the crew, bought with Stew Bucks in the Skin Shop
// (src/ui/shopUI.js) and saved with your career (src/career/career.js).
//
// A skin swaps the outfit (top, jacket, pants or shorts, shoes, sometimes the
// hair colour) and can add costume gear (hats, hoods, tails: src/render/costumes.js);
// the face and body stay theirs. Prices come from the skin's rarity
// (CONFIG.shop.rarities).
//
// look: the parts of a character definition (src/render/characters.js) it
//   replaces. layer: null takes their jacket off; pants can be { color, stripe }.
// =============================================================================
import { CONFIG } from '../config.js';

// Every character has their own (`only`: nobody else can wear it), from their
// story; the team's basketball kit fits everyone (with their own number), and
// so does the Opal. The old shop's outfits that fitted everyone (`vault`) are
// kept for whoever bought them, but aren't sold any more.
const GREEN = '#1d5a2e', GOLD = '#d8b84a';
const ONESIE = (color, o = {}) => ({ top: { type: 'tee', color, ...o }, layer: null, pants: { color: o.legs || color }, chain: null });

export const SKINS = [
  // --- the team: everyone ------------------------------------------------------------
  { id: 'jersey', name: 'Stew Leonard High', rarity: 'common', team: true,
    blurb: 'The team\'s green-and-gold home kit, jersey and shorts, with their own number. Not Erik\'s.',
    look: { top: { type: 'tank', color: GREEN, trim: GOLD, number: '00' }, layer: null, shorts: { color: GREEN, stripe: GOLD }, shoes: 'whiteSneaker' } },

  // --- Kearns: the worst luck in the building --------------------------------------------
  { id: 'carrotFarmer', only: 'kearns', name: 'Carrot Farmer', rarity: 'common',
    blurb: 'Denim overalls, a straw hat and a carrot for later. He\'s heard the jokes. He grew the carrot anyway.',
    look: { top: { type: 'tee', color: '#a8352a', overalls: '#3d5a85' }, layer: null, pants: 'jeans', shoes: 'sneaker', gear: [{ kind: 'strawHat' }, { kind: 'carrot' }] } },
  { id: 'tomatoFoot', only: 'kearns', name: 'Tomato Foot', rarity: 'rare',
    blurb: 'Full tomato. If they\'re going to call him that, he\'s going to commit.',
    look: { ...ONESIE('#c42a20', { legs: '#2f6a2a' }), shoes: 'sneaker', gear: [{ kind: 'tomato' }, { kind: 'stemCap' }] } },
  { id: 'luckyCharm', only: 'kearns', name: 'Lucky Charm', rarity: 'legendary',
    blurb: 'A leprechaun\'s suit and a clover on the hat. It hasn\'t worked yet. Kearnita says give it time.',
    look: { top: { type: 'suit', color: '#1f6b35', shirt: '#f2f1ec', tie: GOLD }, layer: null, pants: { color: '#174f28' }, shoes: 'dress', gear: [{ kind: 'topHat', color: '#1f6b35', band: '#111', buckle: GOLD, clover: true }, { kind: 'clover' }] } },

  // --- Ryan: Mr. Strong Man, the original Mad Dog -----------------------------------------
  { id: 'madDog', only: 'ryan', name: 'Mad Dog', rarity: 'common',
    blurb: 'Floppy ears, spiked collar, a tag that says MAISY\'S DAD. The original.',
    look: { ...ONESIE('#8a6440', { belly: '#d8c09a', legs: '#7a5636' }), shoes: 'sneaker', gear: [{ kind: 'dogHood', color: '#8a6440' }, { kind: 'collar' }, { kind: 'tail', type: 'dog', color: '#8a6440' }] } },
  { id: 'strongMan', only: 'ryan', name: 'Strong Man', rarity: 'rare',
    blurb: 'A leopard-print circus singlet, a handlebar moustache and the barbell. Mr. Strong Man, as advertised.',
    look: { top: { type: 'tank', color: '#d8a24a', print: 'leopard' }, layer: null, pants: { color: '#141416' }, shoes: 'dress', gear: [{ kind: 'mustache' }, { kind: 'barbell' }] } },
  { id: 'fireChief', only: 'ryan', name: 'Fire Chief', rarity: 'legendary',
    blurb: 'Helmet, turnout coat, air tank. Strong enough to carry the whole Stew out of a burning school, and he\'d complain the whole way.',
    look: { top: { type: 'tee', color: '#2a2a2a' }, layer: { type: 'canvas', color: '#b58a3c', zipTo: 0.9, stripes: [{ v: 0.25, h: 0.06, color: '#e8ff4a' }, { v: 0.6, h: 0.06, color: '#d8dce0' }] },
      pants: { color: '#b58a3c', bands: [{ v: 0.15, h: 0.05, color: '#e8ff4a' }] }, shoes: 'dress', gear: [{ kind: 'fireHelmet', number: '1' }, { kind: 'airTank' }] } },

  // --- Rocco: such a little rascal ------------------------------------------------------
  { id: 'rankedUp', only: 'rocco', name: 'Ranked Up', rarity: 'common',
    blurb: 'Purple zip-up, RGB headset, GG on the shirt. He\'d rather be playing 2K. This is the closest he gets.',
    look: { top: { type: 'tee', color: '#16161c', text: { front: 'GG', back: '2K', color: '#b78cff' } }, layer: { type: 'zip', color: '#5a1ea8' }, pants: 'darkJeans', shoes: 'whiteSneaker', gear: [{ kind: 'headset', glow: '#b78cff' }] } },
  { id: 'lilRascal', only: 'rocco', name: 'Lil\' Rascal', rarity: 'rare',
    blurb: 'Red suit, little horns, pointy tail. "Well well well." Shut up, Lumpy.',
    look: { top: { type: 'suit', color: '#a3121a', shirt: '#111113', tie: '#111113' }, layer: null, pants: { color: '#7a0d12' }, shoes: 'dress', gear: [{ kind: 'horns' }, { kind: 'tail', type: 'devil', color: '#a3121a' }] } },

  // --- Pit: the ex-rapper, the horse guy, the smith ----------------------------------------
  { id: 'giddyUp', only: 'pit', name: 'Giddy Up', rarity: 'common',
    blurb: 'A horse hood with a mane and a tail. Ryan said don\'t do the horse thing. He did the horse thing.',
    look: { ...ONESIE('#8a5a34', { belly: '#c49a6a', legs: '#6a4426' }), shoes: 'dress', gear: [{ kind: 'horseHood' }, { kind: 'tail', type: 'horse', color: '#1e140c' }] } },
  { id: 'forgemaster', only: 'pit', name: 'Forgemaster', rarity: 'rare',
    blurb: 'Leather apron, welding goggles, a hammer on his back. What he learned at the Anvil while he was gone.',
    look: { top: { type: 'tee', color: '#24201c', apron: '#9a6434' }, layer: null, pants: 'darkJeans', shoes: 'dress', gear: [{ kind: 'goggles' }, { kind: 'hammer' }] } },
  { id: 'mcPit', only: 'pit', name: 'MC Pit', rarity: 'legendary',
    blurb: 'The red tracksuit from the diss track video, a bucket hat, shades and a whole lot of gold. Suspended, never sorry.',
    look: { top: { type: 'tee', color: '#f2f0ea', text: { front: 'DISS', color: '#b01c22', edge: '#111' } }, layer: { type: 'zip', color: '#b01c22', stripes: [{ v: 0.5, h: 0.04, color: '#f2f0ea' }] }, pants: { color: '#b01c22', stripe: '#f2f0ea' }, shoes: 'whiteSneaker',
      chain: { metal: 'gold', drop: 0.17 }, gear: [{ kind: 'bucketHat', color: '#f2f0ea' }, { kind: 'shades' }, { kind: 'medallion', letter: 'P' }] } },

  // --- James: calm, unbothered, dancing ---------------------------------------------------
  { id: 'timber', only: 'james', name: 'Timber', rarity: 'common',
    blurb: 'More plaid, a beanie and an axe. Still calm. Still that half smile.',
    look: { top: { type: 'tee', color: '#151517' }, layer: { type: 'flannel', color: '#8e2a22', check: '#1a0e0c', line: '#d8c8a8' }, pants: 'jeans', shoes: 'dress', gear: [{ kind: 'beanie', color: '#2a2a2e', pom: '#8e2a22' }, { kind: 'axe' }] } },
  { id: 'discoInferno', only: 'james', name: 'Disco Inferno', rarity: 'rare',
    blurb: 'A white suit, a gold shirt and aviators. Stand still and the Jimmy Shimmy hits different.',
    look: { top: { type: 'suit', color: '#f2f0ea', shirt: '#d8a030', tie: '#d8a030' }, layer: null, pants: { color: '#ece9e2' }, shoes: 'dress', gear: [{ kind: 'shades', aviator: true, lens: '#7a4a10', frame: '#d4a93c' }, { kind: 'medallion' }] } },
  { id: 'jurassicJimmy', only: 'james', name: 'Jurassic Jimmy', rarity: 'legendary',
    blurb: 'A whole dinosaur. Teeth, spikes, tail. He walks in, says nothing, and stands still.',
    look: { ...ONESIE('#2f8a3a', { belly: '#d8d06a', legs: '#2a7a34' }), shoes: 'sneaker', gear: [{ kind: 'dinoHood', color: '#2f8a3a' }, { kind: 'spikes' }, { kind: 'tail', type: 'dino', color: '#2f8a3a' }] } },

  // --- Kyle: judging you, and the smell ----------------------------------------------------
  { id: 'trashDay', only: 'kyle', name: 'Trash Day', rarity: 'common',
    blurb: 'A hi-vis vest and an orange cap. It explains the smell, mostly.',
    look: { top: { type: 'tee', color: '#5a5c60' }, layer: { type: 'zip', color: '#ff7a1a', short: true, stripes: [{ v: 0.35, h: 0.06, color: '#e8ecee' }, { v: 0.6, h: 0.06, color: '#e8ecee' }] }, pants: { color: '#2e3136' }, shoes: 'dress', gear: [{ kind: 'cap', color: '#ff7a1a', backwards: true }] } },
  { id: 'eauDeKyle', only: 'kyle', name: 'Eau de Kyle', rarity: 'rare',
    blurb: 'A skunk suit, stripe and all. Finally, an outfit that matches the smell.',
    look: { ...ONESIE('#151517', { backStripe: '#f2f0ea', belly: '#2a2a2e', legs: '#151517' }), shoes: 'dress', gear: [{ kind: 'skunkHood' }, { kind: 'tail', type: 'skunk', color: '#151517' }] } },
  { id: 'theJudgeSkin', only: 'kyle', name: 'Order in the Court', rarity: 'legendary',
    blurb: 'Black robes and a powdered wig. He was always judging you. Now it\'s official.',
    look: { top: { type: 'suit', color: '#101012', shirt: '#f6f5f1', bow: true }, layer: null, pants: 'suit', shoes: 'dress', gear: [{ kind: 'wig' }, { kind: 'jabot' }] } },

  // --- Brian: through the portal, never misses ---------------------------------------------
  { id: 'highNoon', only: 'brian', name: 'High Noon', rarity: 'common',
    blurb: 'Cowboy hat, bandana, a star on the vest. Never panics. Never misses.',
    look: { top: { type: 'tee', color: '#d8cbb0' }, layer: { type: 'camp', color: '#5a3a22', short: true }, pants: 'jeans', shoes: 'dress', gear: [{ kind: 'cowboyHat' }, { kind: 'bandana' }, { kind: 'star' }] } },
  { id: 'neverMisses', only: 'brian', name: 'Never Misses', rarity: 'rare',
    blurb: 'Black suit, black shirt, red tie, an earpiece and shades. A professional.',
    look: { top: { type: 'suit', color: '#0d0d0f', shirt: '#151517', tie: '#a3121a' }, layer: null, pants: 'suit', shoes: 'dress', gear: [{ kind: 'shades' }, { kind: 'earpiece' }] } },
  { id: 'portalHopper', only: 'brian', name: 'Portal Hopper', rarity: 'legendary',
    blurb: 'A white space suit and a bubble helmet. How he came through the portal, probably.',
    look: { ...ONESIE('#ecebe6', { text: { front: 'STEW', color: '#2a5ab0', edge: '#fff', v: 0.72, size: 34 }, stripes: [{ v: 0.3, h: 0.03, color: '#2a5ab0' }] }), shoes: 'whiteSneaker', gear: [{ kind: 'bubbleHelmet' }, { kind: 'lifePack' }] } },

  // --- Zach: cheerful, missing, found -------------------------------------------------------
  { id: 'partyAnimal', only: 'zach', name: 'Party Animal', rarity: 'common',
    blurb: 'A confetti tee and a party hat. Genuinely happy to be here. Genuinely.',
    look: { top: { type: 'tee', color: '#f6f2e6', print: 'confetti' }, layer: null, pants: 'lightJeans', shoes: 'whiteSneaker', gear: [{ kind: 'partyHat' }] } },
  { id: 'headOfStew', only: 'zach', name: 'Head of Stew', rarity: 'rare',
    blurb: 'Chef\'s whites, a tall hat and a red neckerchief. Somebody has to make the stew.',
    look: { top: { type: 'tee', color: '#f6f5f1' }, layer: { type: 'dress', color: '#f6f5f1', zipTo: 0.95, buttons: '#2a2a2a' }, pants: { color: '#2a2a2e' }, shoes: 'dress', gear: [{ kind: 'toque' }, { kind: 'bandana', color: '#c42a20' }] } },
  { id: 'haveYouSeenMe', only: 'zach', name: 'Have You Seen Me?', rarity: 'legendary',
    blurb: 'A milk carton with his own face on it. Last seen smiling. Found, still smiling.',
    look: { top: { type: 'tee', color: '#f6f5f1' }, layer: null, pants: 'jeans', shoes: 'whiteSneaker', gear: [{ kind: 'carton' }] } },

  // --- the old shop: everyone (kept for whoever bought them) ---------------------------
  { vault: true, id: 'lumberjack', name: 'Lumberjack', rarity: 'common', blurb: 'Red flannel over a black tee. Smells like campfire.',
    look: { top: { type: 'tee', color: '#151517' }, layer: { type: 'flannel', color: '#8e2a22', check: '#2a1210' }, pants: 'jeans', shoes: 'sneaker' } },
  { vault: true, id: 'midnight', name: 'Midnight', rarity: 'common', blurb: 'All black, zipped up. Good for sneaking past the Cheddar.',
    look: { top: { type: 'tee', color: '#0e0e10' }, layer: { type: 'zip', color: '#0b0b0d' }, pants: 'darkJeans', shoes: 'sneaker' } },
  { vault: true, id: 'beach', name: 'Spring Break', rarity: 'common', blurb: 'Orange camp shirt, white tank, light wash. Wrong season, right attitude.',
    look: { top: { type: 'tank', color: '#f1efe8' }, layer: { type: 'camp', color: '#d9772f', short: true }, pants: 'lightJeans', shoes: 'whiteSneaker' } },
  { vault: true, id: 'varsity', name: 'Varsity', rarity: 'rare', blurb: 'The Stew varsity tee under a forest-green zip-up.',
    look: { top: { type: 'tee', color: '#151517', print: 'varsity' }, layer: { type: 'zip', color: '#1d4a2a' }, pants: 'darkJeans', shoes: 'whiteSneaker' } },
  { vault: true, id: 'hazmat', name: 'Hazmat', rarity: 'rare', blurb: 'A yellow work jacket zipped to the chin. Nothing gets in.',
    look: { top: { type: 'tee', color: '#2a2a2a' }, layer: { type: 'canvas', color: '#d6b22a', zipTo: 0.85 }, pants: 'chinos', shoes: 'sneaker' } },
  { vault: true, id: 'iceCaves', name: 'Ice Caves', rarity: 'rare', blurb: 'A white sherpa fleece for the coldest island in the Crust.',
    look: { top: { type: 'tee', color: '#2f4a66' }, layer: { type: 'sherpa', color: '#e6ebee' }, pants: 'darkJeans', shoes: 'whiteSneaker' } },
  { vault: true, id: 'tux', name: 'Black Tie', rarity: 'rare', blurb: 'A tux with a bow tie, for prom night at Stew Leonard High.',
    look: { top: { type: 'suit', color: '#0e0e10', shirt: '#f2f1ec', bow: true }, layer: null, pants: 'suit', shoes: 'dress' } },
  { vault: true, id: 'bloodMoon', name: 'Blood Moon', rarity: 'legendary', blurb: 'A deep red suit with a black shirt and tie, and the hair to match.',
    look: { top: { type: 'suit', color: '#5a0e12', shirt: '#121214', tie: '#050506' }, layer: null, pants: 'suit', shoes: 'dress', hairColor: [26, 14, 12] } },
  { vault: true, id: 'golden', name: 'Golden Ladle', rarity: 'legendary', blurb: 'A gold suit and bleached hair. Everyone will know you can afford it.',
    look: { top: { type: 'suit', color: '#b28a2c', shirt: '#141416', tie: '#d8b84a' }, layer: null, pants: 'suit', shoes: 'dress', hairColor: [214, 186, 120] } },
  // --- the Battle Pass (src/career/battlepass.js): everyone, a tier each -------------
  { id: 'warmUp', name: 'Warm Up', rarity: 'common', unlock: { kind: 'pass', tier: 1 },
    blurb: 'A teal tracksuit with the stripes down the legs. Stretch first. Nobody ever stretches first.',
    look: { top: { type: 'tee', color: '#f2f0ea' }, layer: { type: 'zip', color: '#11807a', stripes: [{ v: 0.5, h: 0.04, color: '#f2f0ea' }] }, pants: { color: '#11807a', stripe: '#f2f0ea' }, shoes: 'whiteSneaker', gear: [{ kind: 'cap', color: '#0c5c58', backwards: true }] } },
  { id: 'nightShift', name: 'Night Shift', rarity: 'common', unlock: { kind: 'pass', tier: 3 },
    blurb: 'Hall monitor after dark: navy uniform, SECURITY on the back, shades indoors.',
    look: { top: { type: 'tee', color: '#1c2a48', text: { back: 'SECURITY', color: '#e8e4d6', size: 34 } }, layer: null, pants: { color: '#141a2a' }, shoes: 'dress', gear: [{ kind: 'cap', color: '#141c30' }, { kind: 'shades' }, { kind: 'earpiece' }] } },
  { id: 'skiLodge', name: 'Ski Lodge', rarity: 'common', unlock: { kind: 'pass', tier: 5 },
    blurb: 'A cream fleece, a red beanie and a scarf to match. Never once went skiing.',
    look: { top: { type: 'tee', color: '#a8261e' }, layer: { type: 'sherpa', color: '#efe6d2' }, pants: 'darkJeans', shoes: 'sneaker', gear: [{ kind: 'beanie', color: '#a8261e', pom: '#f2f0ea' }, { kind: 'bandana', color: '#a8261e' }] } },
  { id: 'lifeguard', name: 'Lifeguard', rarity: 'common', unlock: { kind: 'pass', tier: 7 },
    blurb: 'Red tank, red shorts, GUARD on the front. Nobody\'s drowning on their watch.',
    look: { top: { type: 'tank', color: '#d0202a', text: { front: 'GUARD', color: '#f2f0ea', edge: '#7a0e12', size: 40 } }, layer: null, shorts: { color: '#d0202a', stripe: '#f2f0ea' }, shoes: 'whiteSneaker', gear: [{ kind: 'bucketHat', color: '#f2f0ea' }, { kind: 'shades' }] } },
  { id: 'grillMaster', name: 'Grill Master', rarity: 'rare', unlock: { kind: 'pass', tier: 9 },
    blurb: 'Apron on, toque up, tongs somewhere. The backyard is a kitchen now.',
    look: { top: { type: 'tee', color: '#2a5a8a', apron: '#f2f0ea' }, layer: null, pants: 'chinos', shoes: 'sneaker', gear: [{ kind: 'toque' }, { kind: 'mustache' }] } },
  { id: 'leopardLounge', name: 'Leopard Lounge', rarity: 'rare', unlock: { kind: 'pass', tier: 11 },
    blurb: 'Leopard print, an open camp shirt and a gold medallion. The lounge opens at nine.',
    look: { top: { type: 'tee', color: '#d8a24a', print: 'leopard' }, layer: { type: 'camp', color: '#141416', short: true }, pants: { color: '#141416' }, shoes: 'dress', chain: { metal: 'gold', drop: 0.15 }, gear: [{ kind: 'shades', aviator: true, lens: '#3a2410', frame: '#d4a93c' }, { kind: 'medallion' }] } },
  { id: 'hotSauce', name: 'Hot Sauce', rarity: 'rare', unlock: { kind: 'pass', tier: 13 },
    blurb: 'Flame orange, HOT across the back and two little horns. Handle with gloves.',
    look: { top: { type: 'tee', color: '#2a0e0a', text: { front: 'HOT', back: 'HOT', color: '#ffb02a', edge: '#7a1a08' } }, layer: { type: 'zip', color: '#e8501a', stripes: [{ v: 0.3, h: 0.05, color: '#ffb02a' }] }, pants: { color: '#2a0e0a', stripe: '#e8501a' }, shoes: 'whiteSneaker', gear: [{ kind: 'horns', color: '#ff7a1a' }] } },
  { id: 'neonRave', name: 'Neon Rave', rarity: 'legendary', unlock: { kind: 'pass', tier: 15 },
    blurb: 'All black, RAVE in acid green, a glowing headset. The bass is louder than the zombies.',
    look: { top: { type: 'tee', color: '#0c0c10', print: 'confetti', text: { front: 'RAVE', back: 'RAVE', color: '#9bff2a', edge: '#0c0c10' } }, layer: null, pants: { color: '#0c0c10', stripe: '#9bff2a' }, shoes: 'whiteSneaker', gear: [{ kind: 'headset', glow: '#9bff2a' }, { kind: 'shades', lens: '#1a3a08' }] } },
  { id: 'velvetNight', name: 'Velvet Night', rarity: 'legendary', unlock: { kind: 'pass', tier: 17 },
    blurb: 'A deep purple velvet suit, gold on the tie and round the neck. Dressed for the after-party.',
    look: { top: { type: 'suit', color: '#3a1458', shirt: '#0e0e10', tie: '#d8b84a' }, layer: null, pants: { color: '#2a0e40' }, shoes: 'dress', chain: { metal: 'gold', drop: 0.12 }, gear: [{ kind: 'shades', aviator: true, lens: '#2a0e40', frame: '#d4a93c' }] } },
  { id: 'burgerBros', name: 'Burger Bros', rarity: 'legendary', unlock: { kind: 'pass', tier: 20 },
    blurb: 'The top of the pass: the red Burger Bros uniform, the visor and the name tag. Would you like fries with that?',
    look: { top: { type: 'tee', color: '#c8202a', text: { front: 'BURGER BROS', back: 'BURGER BROS', color: '#ffc72a', edge: '#5a1208', size: 22, v: 0.7 } }, layer: null, pants: { color: '#1a1a1e' }, shoes: 'sneaker', chain: null,
      gear: [{ kind: 'visor', color: '#c8202a', text: 'BURGER BROS' }, { kind: 'nameTag', text: 'BURGER BROS' }] } },

  // --- not for sale: `unlock` says how you get them -----------------------------------
  // free: every username has it. kills: `need` kills while playing as that
  // character unlocks it for them (and CONFIG.shop.opalAccounts have it on everyone).
  // fx: a finish applied after the character's built (src/render/skinFx.js).
  // only: the one character it's for (nobody else can wear it).
  // pass: the Battle Pass tier that unlocks it (above).
  // beta: given once to every account that signs in before CONFIG.shop.beta.until.
  { id: 'sexyFucci', name: 'Sexy Fucci', rarity: 'exclusive', unlock: { kind: 'free' }, fx: 'bikini', only: 'rocco',
    blurb: 'A Fucci bikini in black lacquer and gold, for Rocco and Rocco only. Free for playing Stew Zombies 2.0.',
    look: { top: { type: 'tank', color: '#111113' }, layer: null, pants: 'chinos', shoes: 'whiteSneaker' } },
  { id: 'opal', name: 'Pink Diamond Galaxy Opal Drippy Face Build Skin', rarity: 'exclusive', unlock: { kind: 'kills', need: 1000 }, fx: 'opal',
    blurb: 'Head to toe in glowing pink opal and diamond, with a galaxy swirling round them.',
    look: { top: { type: 'tee', color: '#ff7ad8' }, layer: null, pants: 'chinos', shoes: 'whiteSneaker', hairColor: [255, 170, 230], armSkin: [255, 160, 228] } },
  { id: 'betaTester', name: 'Beta Tester', rarity: 'exclusive', unlock: { kind: 'beta' }, fx: 'beta',
    blurb: 'Matte black techwear with neon circuits running through it, a HUD visor and BETA on the chest. For everyone who was here first.',
    look: { top: { type: 'tee', color: '#0b0b10', text: { front: 'BETA', back: 'TESTER', color: '#2af0ff', edge: '#ff2fd0', size: 52 } },
      layer: { type: 'zip', color: '#121218', stripes: [{ v: 0.5, h: 0.03, color: '#2af0ff' }] }, pants: { color: '#0b0b10', stripe: '#2af0ff' }, shoes: 'whiteSneaker', chain: null,
      gear: [{ kind: 'hud', color: '#2af0ff' }, { kind: 'headset', color: '#0b0b10', glow: '#ff2fd0' }] } },
];

// the team's numbers (Erik was number 8)
export const TEAM_NUMBERS = { kearns: '13', ryan: '33', rocco: '2', pit: '7', james: '23', kyle: '0', brian: '99', zach: '11', chops: '50', regs: '16', p: '4' };
// what the shop sells to a character: their own, the team's, the Opal (and what's in the vault, if they've got it)
export const skinsFor = (charId) => SKINS.filter((s) => fits(s.id, charId));

export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));
// Can this character wear it? (a skin with `only` is just for them)
export const fits = (skinId, charId) => !!SKIN_BY_ID[skinId] && (!SKIN_BY_ID[skinId].only || SKIN_BY_ID[skinId].only === charId);

export const rarityOf = (skin) => CONFIG.shop.rarities[skin.rarity] || CONFIG.shop.rarities.common;
export const priceOf = (id) => (SKIN_BY_ID[id] && !SKIN_BY_ID[id].unlock ? rarityOf(SKIN_BY_ID[id]).price : Infinity);

// A character definition wearing a skin: hand it to buildCharacter() in place
// of the id. (No skin, or one we don't know: their own outfit.)
export function applySkin(def, charId, skinId) {
  const s = SKIN_BY_ID[skinId];
  if (!def || !s || !fits(skinId, charId)) return def;
  const L = s.look, out = { ...def, id: charId, top: { ...L.top } };
  if ('layer' in L) out.layer = L.layer ? { ...L.layer } : undefined;
  if (L.pants) out.pants = L.pants;
  if (L.shoes) out.shoes = L.shoes;
  if (L.hairColor && def.hair) out.hair = { ...def.hair, color: L.hairColor };
  if (L.armSkin) out.armSkin = L.armSkin;   // (your arms in first person)
  if (L.shorts) out.shorts = L.shorts;
  if ('chain' in L) out.chain = L.chain || undefined;   // (null: their chain comes off)
  if (L.gear) out.gear = L.gear;   // (hats, hoods, tails: src/render/costumes.js)
  if (s.team) out.top.number = TEAM_NUMBERS[charId] || '00';
  if (s.fx) out.skinFx = s.fx;
  return out;
}
