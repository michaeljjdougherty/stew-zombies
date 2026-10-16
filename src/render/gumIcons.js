// =============================================================================
// GobbleGum logos: a round badge for each of the 64 gums, the way Black Ops 3
// draws them. The rim and the glow are the gum's tier colour (Classic blue,
// Whimsical pink, Mega purple, Rare Mega cyan, Ultra-Rare orange); inside, a
// white symbol for what it does (a skull, a clock, a perk bottle...), with a
// smaller one in the corner where it's two things at once. Painted on a canvas,
// used by the GobbleGum screen, the HUD and the ball in the machine's tray.
// =============================================================================
import { CONFIG } from '../config.js';

// Each gum: [main symbol, small corner symbol?]. Symbols are drawn below.
export const GUM_ICONS = {
  alchemicalAntithesis: ['coin', 'bullet'],
  alwaysDoneSwiftly: ['crosshair', 'speed'],
  anywhereButHere: ['swirl'],
  armamentalAccomplishment: ['gun', 'cycle'],
  armsGrace: ['gun', 'halo'],
  arsenalAccelerator: ['bolt', 'clock'],
  coagulant: ['drop', 'clock'],
  dangerClosest: ['bomb', 'shield'],
  firingOnAllCylinders: ['cylinder', 'speed'],
  impatient: ['hourglass'],
  inPlainSight: ['eyeShut'],
  luckyCrit: ['clover'],
  nowYouSeeMe: ['eye', 'target'],
  stockOption: ['bullets'],
  swordFlay: ['knife'],
  eyeCandy: ['brush'],
  newtonianNegation: ['skull', 'arrowUp'],
  projectileVomiting: ['burst', 'skull'],
  toneDeath: ['note', 'skull'],
  aftertaste: ['bottle', 'heart'],
  boardGames: ['planks'],
  boardToDeath: ['planks', 'skull'],
  bulletBoost: ['bullet', 'arrowUp'],
  burnedOut: ['flame'],
  cratePower: ['crate', 'bolt'],
  crawlSpace: ['hand'],
  deadOfNuclearWinter: ['radiation'],
  disorderlyCombat: ['dice'],
  ephemeralEnhancement: ['paw', 'clock'],
  headDrama: ['skull', 'target'],
  imFeelinLucky: ['question'],
  immolationLiquidation: ['tag', 'flame'],
  licensedContractor: ['hammer'],
  mindBlown: ['skullBurst'],
  nowhereButThere: ['cross', 'arrowRight'],
  popShocks: ['fist', 'bolt'],
  powerVacuum: ['magnet'],
  respinCycle: ['crate', 'cycle'],
  slaughterSlide: ['slide'],
  temporalGift: ['gift', 'clock'],
  unbearable: ['bear'],
  wallPower: ['gun', 'bolt'],
  whosKeepingScore: ['x2'],
  cacheBack: ['bullets', 'plus'],
  extraCredit: ['coin', 'plus'],
  fatalContraption: ['minigun'],
  fearInHeadlights: ['headlights'],
  idleEyes: ['eyeShut', 'zzz'],
  killJoy: ['skullBite'],
  killingTime: ['clock', 'skull'],
  nearDeathExperience: ['heart', 'cross'],
  phoenixUp: ['wings'],
  profitSharing: ['dollar', 'split'],
  roundRobbin: ['tally'],
  secretShopper: ['bag', 'bullet'],
  selfMedication: ['pill'],
  shoppingFree: ['cart'],
  sodaFountain: ['bottle', 'plus'],
  undeadManWalking: ['snail'],
  unquenchable: ['bottle', 'arrowUp'],
  flavorHexed: ['hex'],
  onTheHouse: ['house', 'bottle'],
  perkaholic: ['bottles'],
  reignDrops: ['crown'],
};

// --- the symbols: drawn white on a 100 x 100 box centred on 0,0 ------------------------
const S = {
  skull(g) {
    g.beginPath(); g.arc(0, -6, 30, Math.PI * 0.9, Math.PI * 2.1); g.lineTo(22, 22); g.lineTo(-22, 22); g.closePath(); g.fill();
    g.fillRect(-16, 18, 32, 14);
    cut(g, () => { g.beginPath(); g.arc(-12, -4, 8, 0, 7); g.arc(12, -4, 8, 0, 7); g.fill(); g.beginPath(); g.moveTo(0, 6); g.lineTo(-5, 14); g.lineTo(5, 14); g.fill(); for (const x of [-8, 0, 8]) g.fillRect(x - 1.5, 22, 3, 10); });
  },
  skullBite(g) { S.skull(g); cut(g, () => { for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-15 + i * 10, -36, 7, 0, 7); g.fill(); } }); },
  skullBurst(g) { g.save(); g.translate(0, 8); g.scale(0.8, 0.8); S.skull(g); g.restore(); for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.95 + i * Math.PI * 0.15; g.beginPath(); g.moveTo(Math.cos(a) * 30, -10 + Math.sin(a) * 30); g.lineTo(Math.cos(a) * 46, -10 + Math.sin(a) * 46); g.stroke(); } },
  clock(g) {
    g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 32, 0, 7); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -20); g.moveTo(0, 0); g.lineTo(14, 8); g.stroke();
    g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill();
  },
  hourglass(g) {
    g.fillRect(-24, -38, 48, 6); g.fillRect(-24, 32, 48, 6);
    g.lineWidth = 5; g.beginPath(); g.moveTo(-18, -32); g.lineTo(18, -32); g.lineTo(3, 0); g.lineTo(18, 32); g.lineTo(-18, 32); g.lineTo(-3, 0); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(-12, 30); g.lineTo(12, 30); g.lineTo(0, 16); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-8, -18); g.lineTo(8, -18); g.lineTo(0, -6); g.closePath(); g.fill();
  },
  bolt(g) { g.beginPath(); g.moveTo(8, -40); g.lineTo(-20, 6); g.lineTo(-2, 6); g.lineTo(-10, 40); g.lineTo(20, -8); g.lineTo(2, -8); g.closePath(); g.fill(); },
  crosshair(g) { g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 26, 0, 7); g.stroke(); for (const [x, y] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) { g.beginPath(); g.moveTo(x * 14, y * 14); g.lineTo(x * 40, y * 40); g.stroke(); } g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill(); },
  target(g) { S.crosshair(g); },
  bullet(g) { g.beginPath(); g.moveTo(-11, 36); g.lineTo(-11, -10); g.quadraticCurveTo(-11, -36, 0, -42); g.quadraticCurveTo(11, -36, 11, -10); g.lineTo(11, 36); g.closePath(); g.fill(); cut(g, () => g.fillRect(-11, 18, 22, 4)); },
  bullets(g) { for (const x of [-24, 0, 24]) { g.save(); g.translate(x, 0); g.scale(0.85, 0.85); S.bullet(g); g.restore(); } },
  heart(g) { g.beginPath(); g.moveTo(0, 34); g.bezierCurveTo(-46, 4, -26, -38, 0, -16); g.bezierCurveTo(26, -38, 46, 4, 0, 34); g.fill(); },
  bottle(g) {
    g.fillRect(-7, -42, 14, 8); g.fillRect(-5, -34, 10, 12);
    g.beginPath(); g.moveTo(-5, -22); g.quadraticCurveTo(-20, -14, -20, 4); g.lineTo(-20, 36); g.quadraticCurveTo(0, 42, 20, 36); g.lineTo(20, 4); g.quadraticCurveTo(20, -14, 5, -22); g.closePath(); g.fill();
    cut(g, () => g.fillRect(-14, 4, 28, 14));
  },
  bottles(g) { for (const [x, s] of [[-24, 0.7], [24, 0.7], [0, 0.9]]) { g.save(); g.translate(x, s === 0.9 ? -2 : 8); g.scale(s, s); S.bottle(g); g.restore(); } },
  fist(g) {
    for (let i = 0; i < 4; i++) roundRect(g, -26 + i * 13, -26, 12, 22, 5);
    roundRect(g, -28, -8, 54, 34, 9);
    g.beginPath(); g.moveTo(-28, 0); g.lineTo(-40, -10); g.lineTo(-36, 10); g.closePath(); g.fill();
  },
  knife(g) { g.save(); g.rotate(-0.8); g.beginPath(); g.moveTo(-6, -46); g.quadraticCurveTo(10, -30, 8, 8); g.lineTo(-6, 8); g.closePath(); g.fill(); g.fillRect(-14, 8, 28, 6); roundRect(g, -5, 14, 10, 30, 4); g.restore(); },
  flame(g) { g.beginPath(); g.moveTo(0, -44); g.bezierCurveTo(30, -10, 34, 10, 26, 24); g.quadraticCurveTo(14, 42, 0, 42); g.quadraticCurveTo(-14, 42, -26, 24); g.bezierCurveTo(-34, 6, -14, -4, -8, -24); g.quadraticCurveTo(-2, -10, 4, -14); g.quadraticCurveTo(8, -26, 0, -44); g.fill(); cut(g, () => { g.beginPath(); g.moveTo(0, 6); g.quadraticCurveTo(14, 20, 6, 34); g.quadraticCurveTo(0, 38, -6, 34); g.quadraticCurveTo(-12, 22, 0, 6); g.fill(); }); },
  eye(g) { g.beginPath(); g.moveTo(-42, 0); g.quadraticCurveTo(0, -36, 42, 0); g.quadraticCurveTo(0, 36, -42, 0); g.fill(); cut(g, () => { g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill(); }); g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill(); },
  eyeShut(g) { g.lineWidth = 7; g.beginPath(); g.moveTo(-40, -4); g.quadraticCurveTo(0, 28, 40, -4); g.stroke(); for (const x of [-26, -9, 9, 26]) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x * 1.2, 24); g.stroke(); } },
  dollar(g) { g.font = '900 86px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, 4); },
  coin(g) { g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill(); cut(g, () => { g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 26, 0, 7); g.stroke(); g.font = '900 40px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, 2); }); },
  shield(g) { g.beginPath(); g.moveTo(0, -40); g.lineTo(32, -28); g.quadraticCurveTo(32, 20, 0, 42); g.quadraticCurveTo(-32, 20, -32, -28); g.closePath(); g.fill(); },
  wings(g) {
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 4, 4); for (let i = 0; i < 4; i++) { g.quadraticCurveTo(s * (14 + i * 8), -30 + i * 6, s * (24 + i * 7), -38 + i * 14); g.lineTo(s * (12 + i * 7), -14 + i * 10); } g.lineTo(s * 4, 24); g.closePath(); g.fill(); }
    g.beginPath(); g.moveTo(0, -24); g.lineTo(6, 30); g.lineTo(-6, 30); g.closePath(); g.fill();
  },
  arrowUp(g) { g.beginPath(); g.moveTo(0, -42); g.lineTo(30, -6); g.lineTo(12, -6); g.lineTo(12, 40); g.lineTo(-12, 40); g.lineTo(-12, -6); g.lineTo(-30, -6); g.closePath(); g.fill(); },
  arrowRight(g) { g.save(); g.rotate(Math.PI / 2); S.arrowUp(g); g.restore(); },
  cycle(g) { g.lineWidth = 8; for (const s of [0, Math.PI]) { g.beginPath(); g.arc(0, 0, 28, s + 0.3, s + 2.6); g.stroke(); const a = s + 2.6; g.beginPath(); g.moveTo(Math.cos(a) * 28 + Math.cos(a + 1.6) * 12, Math.sin(a) * 28 + Math.sin(a + 1.6) * 12); g.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); g.lineTo(Math.cos(a) * 40, Math.sin(a) * 40); g.closePath(); g.fill(); } },
  crate(g) { g.fillRect(-34, -30, 68, 60); cut(g, () => { g.lineWidth = 5; g.strokeRect(-26, -22, 52, 44); g.beginPath(); g.moveTo(-26, -22); g.lineTo(26, 22); g.moveTo(26, -22); g.lineTo(-26, 22); g.stroke(); }); },
  planks(g) { for (const [y, r] of [[-22, -0.12], [0, 0.08], [22, -0.05]]) { g.save(); g.translate(0, y); g.rotate(r); g.fillRect(-40, -8, 80, 16); cut(g, () => { g.beginPath(); g.arc(-30, 0, 2.5, 0, 7); g.arc(30, 0, 2.5, 0, 7); g.fill(); }); g.restore(); } },
  gun(g) {
    g.fillRect(-42, -16, 72, 14); g.fillRect(30, -12, 12, 6);
    g.beginPath(); g.moveTo(-20, -2); g.lineTo(-4, -2); g.lineTo(-10, 30); g.lineTo(-24, 30); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-42, -16); g.lineTo(-48, 8); g.lineTo(-36, 8); g.lineTo(-30, -2); g.closePath(); g.fill();
    g.lineWidth = 4; g.beginPath(); g.arc(2, 2, 7, 0, Math.PI); g.stroke();
  },
  minigun(g) { for (const y of [-10, 0, 10]) g.fillRect(-10, y - 3, 54, 6); roundRect(g, -40, -18, 34, 36, 8); g.fillRect(-28, 18, 10, 18); },
  cylinder(g) { g.beginPath(); g.arc(0, 0, 36, 0, 7); g.fill(); cut(g, () => { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.beginPath(); g.arc(Math.cos(a) * 20, Math.sin(a) * 20, 8, 0, 7); g.fill(); } g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill(); }); },
  speed(g) { g.lineWidth = 7; for (const [y, l] of [[-18, 50], [0, 70], [18, 50]]) { g.beginPath(); g.moveTo(-l / 2, y); g.lineTo(l / 2, y); g.stroke(); } },
  halo(g) { g.lineWidth = 7; g.beginPath(); g.ellipse(0, 0, 34, 12, 0, 0, 7); g.stroke(); },
  plus(g) { g.fillRect(-10, -36, 20, 72); g.fillRect(-36, -10, 72, 20); },
  cross(g) { g.fillRect(-12, -38, 24, 76); g.fillRect(-38, -12, 76, 24); },
  question(g) { g.font = '900 96px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 6); },
  x2(g) { g.font = '900 72px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('x2', 0, 4); },
  zzz(g) { g.font = '900 54px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Z', 0, 0); },
  hex(g) { g.lineWidth = 7; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; g.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); } g.closePath(); g.stroke(); S.question2(g); },
  question2(g) { g.font = '900 52px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 4); },
  house(g) { g.beginPath(); g.moveTo(0, -40); g.lineTo(40, -4); g.lineTo(30, -4); g.lineTo(30, 36); g.lineTo(-30, 36); g.lineTo(-30, -4); g.lineTo(-40, -4); g.closePath(); g.fill(); cut(g, () => g.fillRect(-8, 12, 16, 24)); },
  gift(g) { g.fillRect(-32, -12, 64, 46); g.fillRect(-36, -24, 72, 14); cut(g, () => { g.fillRect(-4, -24, 8, 58); }); g.lineWidth = 6; g.beginPath(); g.ellipse(-12, -32, 12, 7, 0.4, 0, 7); g.ellipse(12, -32, 12, 7, -0.4, 0, 7); g.stroke(); },
  hammer(g) { g.save(); g.rotate(-0.6); g.fillRect(-6, -14, 12, 60); g.fillRect(-30, -36, 50, 22); g.beginPath(); g.moveTo(20, -36); g.lineTo(36, -42); g.lineTo(36, -10); g.lineTo(20, -14); g.fill(); g.restore(); },
  bomb(g) { g.beginPath(); g.arc(-4, 6, 30, 0, 7); g.fill(); g.fillRect(8, -30, 14, 12); g.lineWidth = 4; g.beginPath(); g.moveTo(16, -30); g.quadraticCurveTo(24, -44, 36, -38); g.stroke(); },
  burst(g) { g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 18 : 42; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); },
  dice(g) { roundRect(g, -34, -34, 68, 68, 12); cut(g, () => { for (const [x, y] of [[-18, -18], [18, 18], [0, 0], [18, -18], [-18, 18]]) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); } }); },
  swirl(g) { g.lineWidth = 7; g.beginPath(); for (let i = 0; i < 80; i++) { const a = i * 0.16, r = 2 + i * 0.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); },
  note(g) { g.beginPath(); g.ellipse(-14, 24, 14, 10, -0.4, 0, 7); g.fill(); g.fillRect(-2, -36, 7, 60); g.beginPath(); g.moveTo(5, -36); g.quadraticCurveTo(30, -26, 24, -2); g.quadraticCurveTo(22, -18, 5, -20); g.fill(); },
  drop(g) { g.beginPath(); g.moveTo(0, -42); g.bezierCurveTo(10, -20, 30, 0, 30, 14); g.arc(0, 14, 30, 0, Math.PI); g.bezierCurveTo(-30, 0, -10, -20, 0, -42); g.fill(); },
  brush(g) { g.save(); g.rotate(0.7); roundRect(g, -6, -46, 12, 50, 5); g.fillRect(-10, 4, 20, 10); g.beginPath(); g.moveTo(-10, 14); g.quadraticCurveTo(-12, 34, 0, 44); g.quadraticCurveTo(12, 34, 10, 14); g.fill(); g.restore(); },
  clover(g) { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.arc(Math.cos(a) * 16, Math.sin(a) * 16 - 4, 15, 0, 7); g.fill(); } g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6, 26, 16, 40); g.stroke(); },
  magnet(g) { g.lineWidth = 18; g.beginPath(); g.arc(0, 2, 24, Math.PI, 0); g.lineTo(24, 34); g.moveTo(-24, 2); g.lineTo(-24, 34); g.stroke(); cut(g, () => { g.fillRect(-36, 22, 24, 6); g.fillRect(12, 22, 24, 6); }); },
  cart(g) { g.lineWidth = 6; g.beginPath(); g.moveTo(-42, -30); g.lineTo(-30, -30); g.lineTo(-20, 16); g.lineTo(28, 16); g.stroke(); g.beginPath(); g.moveTo(-26, -16); g.lineTo(38, -16); g.lineTo(30, 6); g.lineTo(-22, 6); g.closePath(); g.fill(); for (const x of [-14, 22]) { g.beginPath(); g.arc(x, 30, 7, 0, 7); g.fill(); } },
  pill(g) { g.save(); g.rotate(-0.6); roundRect(g, -40, -16, 80, 32, 16); cut(g, () => g.fillRect(-2, -16, 4, 32)); g.restore(); },
  crown(g) { g.beginPath(); g.moveTo(-38, 26); g.lineTo(-38, -20); g.lineTo(-20, 2); g.lineTo(0, -32); g.lineTo(20, 2); g.lineTo(38, -20); g.lineTo(38, 26); g.closePath(); g.fill(); for (const x of [-38, 0, 38]) { g.beginPath(); g.arc(x, x ? -24 : -36, 6, 0, 7); g.fill(); } g.fillRect(-38, 30, 76, 8); },
  tally(g) { g.lineWidth = 7; for (const x of [-24, -10, 4, 18]) { g.beginPath(); g.moveTo(x, -30); g.lineTo(x, 30); g.stroke(); } g.beginPath(); g.moveTo(-34, 24); g.lineTo(30, -24); g.stroke(); },
  bear(g) { for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 24, -26, 12, 0, 7); g.fill(); } g.beginPath(); g.arc(0, 2, 34, 0, 7); g.fill(); cut(g, () => { g.beginPath(); g.arc(-12, -4, 5, 0, 7); g.arc(12, -4, 5, 0, 7); g.fill(); g.beginPath(); g.ellipse(0, 14, 12, 9, 0, 0, 7); g.fill(); }); g.beginPath(); g.arc(0, 11, 4, 0, 7); g.fill(); },
  hand(g) { g.fillRect(-46, 26, 92, 10); for (let i = 0; i < 4; i++) roundRect(g, -22 + i * 12, -40 + Math.abs(i - 1.5) * 6, 10, 34, 5); roundRect(g, -24, -12, 48, 40, 10); g.save(); g.translate(-24, 0); g.rotate(-0.6); roundRect(g, -6, -20, 11, 26, 5); g.restore(); },
  snail(g) { g.lineWidth = 6; g.beginPath(); for (let i = 0; i < 40; i++) { const a = i * 0.3, r = 2 + i * 0.6; g.lineTo(6 + Math.cos(a) * r, -6 + Math.sin(a) * r); } g.stroke(); g.beginPath(); g.moveTo(-40, 26); g.lineTo(34, 26); g.quadraticCurveTo(40, 18, 30, 16); g.lineTo(-30, 16); g.quadraticCurveTo(-40, 0, -34, -10); g.lineTo(-28, 16); g.closePath(); g.fill(); },
  radiation(g) { g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill(); for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 - Math.PI / 2; g.beginPath(); g.arc(0, 0, 40, a - 0.5, a + 0.5); g.arc(0, 0, 13, a + 0.5, a - 0.5, true); g.closePath(); g.fill(); } },
  bag(g) { g.beginPath(); g.moveTo(-30, -14); g.lineTo(30, -14); g.lineTo(36, 38); g.lineTo(-36, 38); g.closePath(); g.fill(); g.lineWidth = 6; g.beginPath(); g.arc(0, -14, 14, Math.PI, 0); g.stroke(); },
  tag(g) { g.save(); g.rotate(-0.4); g.beginPath(); g.moveTo(-40, -22); g.lineTo(22, -22); g.lineTo(42, 0); g.lineTo(22, 22); g.lineTo(-40, 22); g.closePath(); g.fill(); cut(g, () => { g.beginPath(); g.arc(26, 0, 5, 0, 7); g.fill(); }); g.restore(); },
  paw(g) { g.beginPath(); g.ellipse(0, 14, 22, 18, 0, 0, 7); g.fill(); for (const [x, y] of [[-24, -10], [-9, -24], [9, -24], [24, -10]]) { g.beginPath(); g.ellipse(x, y, 8, 10, 0, 0, 7); g.fill(); } },
  headlights(g) { for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 22, 0, 13, 0, 7); g.fill(); } g.globalAlpha = 0.5; g.beginPath(); g.moveTo(-34, -10); g.lineTo(-46, -36); g.lineTo(46, -36); g.lineTo(34, -10); g.closePath(); g.fill(); g.globalAlpha = 1; S.eyeSmall(g); },
  eyeSmall(g) { g.save(); g.translate(0, 28); g.scale(0.4, 0.4); S.eye(g); g.restore(); },
  slide(g) { g.beginPath(); g.moveTo(-40, 30); g.lineTo(20, 30); g.quadraticCurveTo(34, 26, 30, 14); g.lineTo(-30, 14); g.closePath(); g.fill(); g.beginPath(); g.arc(-26, 4, 9, 0, 7); g.fill(); for (const x of [-28, 34]) { g.save(); g.translate(x, -18); g.scale(0.45, 0.45); S.burst(g); g.restore(); } },
  split(g) { g.lineWidth = 7; g.beginPath(); g.moveTo(0, 30); g.lineTo(0, 0); g.lineTo(-26, -26); g.moveTo(0, 0); g.lineTo(26, -26); g.stroke(); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 34, -34); g.lineTo(s * 14, -30); g.lineTo(s * 30, -14); g.closePath(); g.fill(); } },
};

function cut(g, fn) { g.save(); g.globalCompositeOperation = 'destination-out'; fn(); g.restore(); }
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill(); }

// Draw a gum's badge into g, filling a size x size square.
export function drawGumIcon(g, id, size) {
  const G = CONFIG.gobblegum, d = G.gums[id];
  const col = d ? G.tiers[d.tier].color : '#888';
  const [main, corner] = GUM_ICONS[id] || ['question'];
  const r = size / 2;
  g.save();
  g.clearRect(0, 0, size, size);
  g.translate(r, r);
  // the badge: a dark core glowing in the tier colour, a bright rim, a sheen
  const bg = g.createRadialGradient(0, -r * 0.2, r * 0.1, 0, 0, r);
  bg.addColorStop(0, shade(col, 0.55)); bg.addColorStop(0.7, shade(col, 0.22)); bg.addColorStop(1, '#05040a');
  g.fillStyle = bg; g.beginPath(); g.arc(0, 0, r * 0.96, 0, 7); g.fill();
  g.lineWidth = r * 0.09; g.strokeStyle = col; g.beginPath(); g.arc(0, 0, r * 0.9, 0, 7); g.stroke();
  g.lineWidth = r * 0.025; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(0, 0, r * 0.82, 0, 7); g.stroke();
  // the symbol (on its own layer, so its cut-outs don't cut the badge)
  const c = document.createElement('canvas'); c.width = c.height = size;
  const s = c.getContext('2d');
  s.translate(r, r); s.scale(size / 160, size / 160);
  s.fillStyle = '#fff'; s.strokeStyle = '#fff'; s.lineCap = 'round'; s.lineJoin = 'round';
  s.save(); if (corner) s.translate(-6, -4); S[main] ? S[main](s) : S.question(s); s.restore();
  if (corner) { s.save(); s.translate(36, 36); s.scale(0.42, 0.42); S[corner] ? S[corner](s) : null; s.restore(); }
  g.shadowColor = col; g.shadowBlur = size * 0.08;
  g.drawImage(c, -r, -r);
  g.shadowBlur = 0;
  // a gloss across the top
  const gl = g.createLinearGradient(0, -r, 0, 0);
  gl.addColorStop(0, 'rgba(255,255,255,0.28)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.beginPath(); g.ellipse(0, -r * 0.45, r * 0.68, r * 0.36, 0, 0, 7); g.fill();
  g.restore();
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), R = (n >> 16) & 255, Gc = (n >> 8) & 255, B = n & 255;
  return `rgb(${Math.round(R * k)},${Math.round(Gc * k)},${Math.round(B * k)})`;
}

// A data URL of a gum's badge (cached), for the menus and the HUD.
const urls = new Map();
export function gumIconURL(id, size = 128) {
  const key = id + '@' + size;
  if (!urls.has(key)) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    drawGumIcon(c.getContext('2d'), id, size);
    urls.set(key, c.toDataURL());
  }
  return urls.get(key);
}

// A canvas of it (for a texture in the world)
export function gumIconCanvas(id, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  drawGumIcon(c.getContext('2d'), id, size);
  return c;
}
