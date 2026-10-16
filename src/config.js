// =============================================================================
// STEW ZOMBIES — CONFIG
// Every number that affects feel and balance lives here. Tweak freely.
// Units: meters, seconds, degrees (unless noted), points.
// =============================================================================

// -----------------------------------------------------------------------------
// Weapon class defaults. Each weapon entry below starts from its class and then
// overrides whatever makes it different. Every value can be set per weapon.
// -----------------------------------------------------------------------------
const CLASS_DEFAULTS = {
  pistol: {
    fireMode: 'semi', headMult: 2.6, limbMult: 0.75, pellets: 1, penetration: 1, range: 70, falloffStart: 18, falloffMinMult: 0.65,
    reloadStyle: 'mag', reloadAddAt: 0.72, drawTime: 0.45, adsTime: 0.17, adsFovMult: 0.86, adsMoveMult: 0.6, moveSpeedMult: 1.0,
    spread: { hipBase: 1.9, hipMax: 5.5, perShot: 1.3, recovery: 7.5, ads: 0.18, adsPerShot: 0.25, moving: 1.4, air: 4.0, crouchMult: 0.8 },
    recoil: { pitch: 1.9, yaw: 0.55, recovery: 9, adsMult: 0.7, viewKick: 1 },
  },
  smg: {
    fireMode: 'auto', headMult: 2.6, limbMult: 0.8, pellets: 1, penetration: 1, range: 55, falloffStart: 14, falloffMinMult: 0.6,
    reloadStyle: 'mag', reloadAddAt: 0.66, drawTime: 0.5, adsTime: 0.2, adsFovMult: 0.84, adsMoveMult: 0.65, moveSpeedMult: 1.0,
    spread: { hipBase: 2.3, hipMax: 6.5, perShot: 0.42, recovery: 9, ads: 0.35, adsPerShot: 0.12, moving: 1.2, air: 4, crouchMult: 0.8 },
    recoil: { pitch: 0.9, yaw: 0.5, recovery: 10, adsMult: 0.6, viewKick: 0.6 },
  },
  ar: {
    fireMode: 'auto', headMult: 3, limbMult: 0.8, pellets: 1, penetration: 2, range: 85, falloffStart: 30, falloffMinMult: 0.75,
    reloadStyle: 'mag', reloadAddAt: 0.66, drawTime: 0.55, adsTime: 0.22, adsFovMult: 0.8, adsMoveMult: 0.6, moveSpeedMult: 0.95,
    spread: { hipBase: 2.6, hipMax: 7, perShot: 0.38, recovery: 8.5, ads: 0.22, adsPerShot: 0.09, moving: 1.5, air: 5, crouchMult: 0.8 },
    recoil: { pitch: 1.0, yaw: 0.45, recovery: 11, adsMult: 0.55, viewKick: 0.7 },
  },
  shotgun: {
    fireMode: 'semi', headMult: 1.6, limbMult: 0.9, pellets: 8, penetration: 1, range: 28, falloffStart: 6, falloffMinMult: 0.25,
    reloadStyle: 'shell', reloadAddAt: 0.7, drawTime: 0.6, adsTime: 0.22, adsFovMult: 0.88, adsMoveMult: 0.6, moveSpeedMult: 0.93,
    reloadStartTime: 0.35, shellTime: 0.48, reloadEndTime: 0.4,
    spread: { hipBase: 5.2, hipMax: 7, perShot: 0.8, recovery: 6, ads: 3.8, adsPerShot: 0.5, moving: 0.6, air: 2, crouchMult: 0.95 },
    recoil: { pitch: 5, yaw: 1.3, recovery: 6.5, adsMult: 0.8, viewKick: 2.0 },
  },
  lmg: {
    fireMode: 'auto', headMult: 2.5, limbMult: 0.85, pellets: 1, penetration: 3, range: 90, falloffStart: 40, falloffMinMult: 0.8,
    reloadStyle: 'belt', reloadAddAt: 0.78, drawTime: 0.85, adsTime: 0.34, adsFovMult: 0.8, adsMoveMult: 0.5, moveSpeedMult: 0.85,
    spread: { hipBase: 3.4, hipMax: 8.5, perShot: 0.45, recovery: 7, ads: 0.45, adsPerShot: 0.14, moving: 2.2, air: 6, crouchMult: 0.7 },
    recoil: { pitch: 1.5, yaw: 0.9, recovery: 8, adsMult: 0.65, viewKick: 1.0 },
  },
  sniper: {
    fireMode: 'semi', headMult: 2.5, limbMult: 0.9, pellets: 1, penetration: 4, range: 140, falloffStart: 120, falloffMinMult: 0.9,
    reloadStyle: 'mag', reloadAddAt: 0.68, drawTime: 0.75, adsTime: 0.3, adsFovMult: 0.3, adsMoveMult: 0.45, moveSpeedMult: 0.9,
    spread: { hipBase: 6.5, hipMax: 9, perShot: 2, recovery: 6, ads: 0.0, adsPerShot: 0.05, moving: 3, air: 8, crouchMult: 0.85 },
    recoil: { pitch: 5, yaw: 1, recovery: 5.5, adsMult: 0.8, viewKick: 2.2 },
    scope: { sway: 0.35 },   // degrees of scope sway
  },
  launcher: {
    fireMode: 'semi', headMult: 1, limbMult: 1, pellets: 1, penetration: 1, range: 60, falloffStart: 60, falloffMinMult: 1,
    reloadStyle: 'shell', reloadAddAt: 0.7, drawTime: 0.7, adsTime: 0.26, adsFovMult: 0.85, adsMoveMult: 0.55, moveSpeedMult: 0.9,
    reloadStartTime: 0.45, shellTime: 0.75, reloadEndTime: 0.5,
    spread: { hipBase: 1.5, hipMax: 4, perShot: 1, recovery: 5, ads: 0.4, adsPerShot: 0.3, moving: 1, air: 3, crouchMult: 0.9 },
    recoil: { pitch: 4, yaw: 1, recovery: 6, adsMult: 0.8, viewKick: 1.6 },
  },
};

function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? { ...a[k], ...v } : v;
  }
  return out;
}

// Build a weapon entry from its class defaults plus its own values.
function gun(cls, stats) {
  return merge(merge(CLASS_DEFAULTS[cls], { class: cls }), stats);
}

// A War Hammer (Call of the Crust): Pit forges one from each titan's core. Never in
// the box or on a wall: you take it from its socket on the Anvil. Every swing
// smashes what's in front of you and its element goes off where it lands
// (src/sim/hammers.js); no ammo, no sights: right click is a quick swing instead.
function warHammer(element, stats) {
  return gun('launcher', {
    hammer: element, wonder: true, noAds: true, infinite: true,
    fireMode: 'semi', rpm: 55, damage: 0, magSize: 1, reserve: 0,   // (rpm 55: back round 1.1 s after a charged slam; its special waits crust.hammers.charged.every)
    reloadStyle: 'mag', reloadTime: 1, drawTime: 0.8, moveSpeedMult: 0.82,
    spread: { hipBase: 0, hipMax: 0, perShot: 0, ads: 0, adsPerShot: 0 },
    recoil: { pitch: 0, yaw: 0, recovery: 6, adsMult: 1, viewKick: 0 },
    sound: { kind: 'hammer', element, body: 0, thump: 0, crack: 0, tail: 0, pitch: 1 },
    view: { model: 'warhammer_' + element, flash: 0 },
    ...stats,
  });
}

export const CONFIG = {
  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------
  sim: {
    tickRate: 60,            // fixed simulation steps per second
    maxStepsPerFrame: 5,     // avoid spiral of death on slow frames
  },

  // ---------------------------------------------------------------------------
  // Player movement & body
  // ---------------------------------------------------------------------------
  player: {
    radius: 0.34,
    height: 1.78,
    crouchHeight: 1.2,
    eyeHeight: 1.64,
    crouchEyeHeight: 1.12,
    stepHeight: 0.48,        // max ledge you walk up without jumping

    walkSpeed: 4.1,
    sprintSpeed: 6.5,
    crouchSpeedMult: 0.5,
    backpedalMult: 0.8,
    strafeMult: 0.9,

    groundAccel: 26,         // m/s², lower = heavier, more momentum
    groundDecel: 30,         // how fast you stop when letting go (m/s²)
    airAccel: 3.5,           // air control (low = committed jumps)
    gravity: 20,
    jumpHeight: 0.52,        // short, low hop
    jumpCooldown: 0.4,
    landSlowdownTime: 0.22,  // brief speed penalty after landing
    landSlowdownMult: 0.6,

    // dolphin dive: sprint, then crouch (or crouch just as you run off a ledge:
    // up to lipTime s after). You launch up and out (about 0.7 m up,
    // 4 m through the air), come down belly first with a thud, skid a short way,
    // then you're crouched. (A low hop and a long skid read as a slide.)
    dive: { speed: 8.2, up: 5.2, height: 0.7, airEyeHeight: 1.45, proneEyeHeight: 0.5, proneTime: 0.5, slideDecel: 24, cooldown: 0.6, lipTime: 0.2 },
    // crouch as in Black Ops: tap it to crouch, tap again to stand; hold it
    // (holdTime) to go prone. Prone: flat on your belly, and a dive ends in it.
    // Tap crouch to get up to a crouch, hold it (or jump, or sprint) to stand
    // (it takes getUpTime). You crawl at speedMult, and hold your aim steadier.
    prone: { height: 0.6, eyeHeight: 0.42, speedMult: 0.22, holdTime: 0.4, getUpTime: 0.4, minTime: 0.2, spreadMult: 0.6, swayMult: 0.5,
      reach: 0.95,           // m lying flat, your head's ahead of you (and your feet behind): kept out of walls and rails
      bodyOffset: 0.8,       // m the drawn body's middle sits at you (it lies along where you face, not from your feet)
      clearHeight: 0.35 },   // m up, where that's checked
    // falls hurt: landing faster than minImpact m/s (about a 3 m drop) costs perMs
    // health per m/s over it, up to max (PHD Gaylor: nothing)
    fallDamage: { minImpact: 11, perMs: 5.5, max: 80 },
    sprintDuration: 4.0,     // seconds of sprint from full stamina
    sprintRecoverRate: 0.8,  // stamina seconds recovered per second
    sprintMinToStart: 0.8,   // need this much stamina to start sprinting again
    sprintToFireDelay: 0.24, // delay before you can fire after sprint ends
    sprintTurnPenalty: 0,    // reserved

    maxHealth: 100,
    regenDelay: 3.5,         // seconds without damage before regen starts
    regenRate: 55,           // health per second once regen starts

    startPoints: 500,
    maxWeapons: 2,           // buying a third replaces the one in your hands
  },

  // ---------------------------------------------------------------------------
  // Camera feel
  // ---------------------------------------------------------------------------
  // gun recoil: the aim climbs while you hold the trigger, the camera punches
  // with every shot, and the gun kicks back in your hands
  recoil: {
    kickMult: 1.35,        // x every weapon's recoil.pitch / yaw
    holdRecovery: 0.3,     // recovery while still firing (so autos climb)
    holdTime: 0.16,        // seconds after a shot that counts as still firing
    maxPitch: 9,           // degrees the aim can climb
    punch: 1.0,            // camera punch per shot (visual only)
    gunKick: 1.7,          // viewmodel kick
  },
  camera: {
    defaultFov: 90,          // horizontal FOV, user adjustable in settings
    minFov: 65,
    maxFov: 110,
    sprintFovAdd: 4,
    pitchLimit: 88,
    eyeSmoothing: 14,        // smoothing for step-ups/crouch

    bobWalkAmp: 0.032,       // vertical bob meters
    bobSprintAmp: 0.068,
    bobWalkSide: 0.018,
    bobSprintSide: 0.04,
    bobStride: 1.75,         // meters per full step cycle (walk)
    bobSprintStride: 2.3,
    bobRollSprint: 0.9,      // degrees of roll while sprinting
    bobAdsMult: 0.25,

    landDip: 0.09,           // meters the view dips on landing
    landDipSpring: 90,
    landDipDamping: 11,
    // a dolphin dive's camera: nose up as you leave the ground, tipping down
    // as you fall (degrees), then a hard drop and a nod down when you hit
    dive: { launchPitch: 5, fallPitch: -10, tiltRate: 10, launchFov: 50, landDip: 6, landNod: 80, landShake: 0.35 },

    damageShake: 1.4,        // degrees
  },

  // ---------------------------------------------------------------------------
  // Mouse
  // ---------------------------------------------------------------------------
  input: {
    defaultSensitivity: 1.0,
    radiansPerPixel: 0.0021, // at sensitivity 1.0
    defaultAdsSensitivity: 0.7,
    // controller look: radians/second at full tilt (sensitivity 1)
    pad: {
      yawSpeed: 2.6,
      pitchSpeed: 2.1,
      curve: 1.9,            // stick response (higher = finer near the centre)
      boost: 1.6,            // extra turn speed after holding full tilt...
      boostTime: 0.35,       // ...for this long
      assistSlow: 0.55,      // aim assist: look speed over a target (hip)
      assistSlowAds: 0.42,   // ...and aiming down sights
      snapAngle: 7,          // ADS snaps to a target within this many degrees
      snapTime: 0.16,
      snapStrength: 0.75,
    },
    keys: {
      forward: ['KeyW', 'ArrowUp'],
      back: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      sprint: ['ShiftLeft', 'ShiftRight'],
      jump: ['Space'],
      crouch: ['KeyC'],
      reload: ['KeyR'],
      use: ['KeyF'],
      melee: ['KeyV', 'KeyE'],
      weapon1: ['Digit1'],
      weapon2: ['Digit2'],
      weapon3: ['Digit3'],
      grenade: ['KeyG'],
      tactical: ['KeyQ'],
      mine: ['KeyX'],
      gum: ['KeyH'],             // use your GobbleGum
    },
  },

  // ---------------------------------------------------------------------------
  // Knife
  // ---------------------------------------------------------------------------
  melee: {
    damage: 150,             // kills round 1 zombies in one stab
    range: 1.55,             // direct hit reach
    lungeRange: 3.2,         // will lunge toward zombies inside this distance
    lungeAngle: 28,          // degrees off-center the target may be
    lungeSpeed: 12,
    lungeMaxTime: 0.16,
    hitDelay: 0.09,          // stab lands this long after pressing (if no lunge)
    duration: 0.62,          // total knife animation lock
    cooldown: 0.66,
  },

  // ---------------------------------------------------------------------------
  // Points
  // ---------------------------------------------------------------------------
  points: {
    hit: 10,                 // any non-lethal hit
    kill: 60,                // body kill (includes the hit)
    headshotKill: 100,
    knifeKill: 130,
    boardRepair: 10,
    boardRepairCapPerRound: 500,
  },

  // ---------------------------------------------------------------------------
  // Rounds
  // ---------------------------------------------------------------------------
  rounds: {
    firstRoundDelay: 4.0,
    intermission: 10.0,      // break between rounds
    earlyCounts: [5, 7, 11, 15, 20], // solo zombie counts, rounds 1-5
    baseCount: 21,           // used from round 6 on
    hordePerPlayer: 5,
    lateRoundScale: 0.14,    // round >= 10 multiplier per round
    extraPlayerMult: 0.3,    // each extra player adds this fraction of base (4 players: x1.9)
    maxAlive: 20,            // cap of zombies on the map at once
    spawnIntervalStart: 2.0,
    spawnIntervalDecay: 0.95, // multiplied each round
    spawnIntervalMin: 0.35,
    firstSpawnDelay: 0.8,
    // zombies left far from everyone (another island, the far end of the map)
    // are pulled and come back up near the players, so a round never ends in a hunt
    recycle: {
      dist: 40,              // m from the nearest player (height difference counts) that's too far
      time: 8,               // s it has to stay that far
      lastFew: 4,            // once only this many are left (none still to come)...
      lastFewDist: 22,       // ...this is too far
      lastFewTime: 3,        // ...after this long
      seenDist: 60,          // in front of someone and nearer than this: left alone (nothing vanishes in plain sight)
      seenDot: 0.55,         // cos of the half-angle that counts as "in front of"
      closerBy: 8,           // only moved when the new spot is at least this much nearer someone
      tries: 8,              // spawn points looked at for a nearer one
      checkEvery: 0.5,       // s between checks
    },
  },

  // ---------------------------------------------------------------------------
  // Zombies
  // ---------------------------------------------------------------------------
  zombie: {
    radius: 0.36,
    height: 1.8,
    stepHeight: 0.5,
    dropChance: 0.25,        // share of plain walkers that will jump down a ledge after you (runners always do)
    deadEyeMask: [0.004, 0.06], // a dead zombie's eyes go black where its glow map is brighter than this (soft edge)

    healthBase: 150,
    healthAddPerRound: 100,
    healthAddUntilRound: 9,
    healthMultAfter: 1.1,    // per round after healthAddUntilRound

    walkSpeed: [0.85, 1.25],
    runSpeed: [2.4, 2.9],
    sprintSpeed: [3.9, 4.5],
    runnerStartRound: 3,
    runnerPerRound: 0.13,
    runnerMax: 0.85,
    sprinterStartRound: 7,
    sprinterPerRound: 0.1,
    sprinterMax: 0.9,

    turnRate: 6,             // radians/sec
    accel: 10,
    separationRadius: 0.85,
    separationStrength: 2.4,

    attackRange: 1.25,       // starts a swing inside this range
    attackHitRange: 1.75,    // swing connects if player is still inside this
    attackWindup: 0.42,
    attackRecover: 0.55,
    attackDamage: 50,        // 2 hits = down without health perk
    attackHeightTolerance: 1.3,

    outsideSpawnDist: [5, 9],  // how far outside a window they appear
    tearInterval: 1.15,      // seconds per board torn off
    climbTime: 1.25,
    windowAttackRange: 1.35, // player this close to a window gets swiped through it
    queueSpacing: 0.9,

    headshotMult: 2.5,       // default if the weapon doesn't say
    armLossFraction: 0.33,   // arm falls off after taking this fraction of max hp
    hitStun: 0.12,
    screamChance: { walker: 0.15, runner: 0.7, sprinter: 1.0 },
    // Explosions can blow a zombie's legs off without killing it: it becomes a crawler.
    crawlerChance: 0.45,     // chance when an explosion takes off a big chunk of health
    crawlerDamageFrac: 0.3,  // fraction of max health a single blast must deal
    crawlSpeed: [0.65, 0.95],
    stuckTime: 0.6,          // seconds barely moving before a zombie sidesteps
    sidestepTime: 0.9,
    portalReach: 1.2,        // how close to a doorway before heading through
    riseTime: 1.8,           // seconds to claw up out of the dirt
    fenceClimbMult: 1.5,     // fences take this much longer than windows
    riseDepth: 1.7,
    groundSpawnWeight: 0.7,  // relative to a window
  },

  // ---------------------------------------------------------------------------
  // Boarded windows
  // ---------------------------------------------------------------------------
  windows: {
    boards: 6,
    rebuildInterval: 0.6,    // seconds of holding use per plank
    rebuildRange: 1.9,
    width: 1.7,
    sillHeight: 0.62,
    topHeight: 2.35,
  },

  // ---------------------------------------------------------------------------
  // Weapons. Each weapon has its own entry. Angles in degrees.
  // ---------------------------------------------------------------------------
  weapons: {
    // ---- starting pistol ----------------------------------------------------
    M1912: {
      name: 'M1912',
      class: 'pistol',
      fireMode: 'semi',       // semi | auto | burst
      rpm: 420,               // max fire rate (for semi: how fast you can click)
      damage: 40,
      headMult: 2.6,
      limbMult: 0.75,
      pellets: 1,
      penetration: 1,         // zombies a bullet can pass through
      range: 70,
      falloffStart: 18,
      falloffMinMult: 0.65,
      magSize: 8,
      reserve: 80,
      reloadStyle: 'mag',     // mag | break | cylinder
      reloadTime: 1.55,       // partial mag
      reloadEmptyTime: 1.85,  // empty mag (slide locked back)
      reloadAddAt: 0.72,      // fraction of reload where ammo is added (cancel after this keeps ammo)
      drawTime: 0.45,
      adsTime: 0.17,
      adsFovMult: 0.86,
      adsMoveMult: 0.6,
      moveSpeedMult: 1.0,
      spread: { hipBase: 1.9, hipMax: 5.5, perShot: 1.3, recovery: 7.5, ads: 0.18, adsPerShot: 0.25, moving: 1.4, air: 4.0, crouchMult: 0.8 },
      recoil: { pitch: 1.9, yaw: 0.55, recovery: 9, adsMult: 0.7, viewKick: 1 },
      sound: { kind: 'pistol', body: 2200, thump: 150, crack: 0.9, tail: 0.5, pitch: 1.0 },
      view: { model: 'pistol', flash: 1 },
      upgrade: { name: 'Twin Stewpots', color: '#b03cff', dual: true, magSize: 6, reserve: 60, damage: 120, explosiveRounds: 'stewpot', note: 'Two pistols firing small explosive rounds.' },
    },

    // ---- wall weapons ---------------------------------------------------------
    M15: {
      name: 'M15',
      class: 'rifle',
      cost: 500, ammoCost: 250,
      fireMode: 'semi',
      rpm: 460,
      damage: 110,
      headMult: 2.2,
      limbMult: 0.8,
      pellets: 1,
      penetration: 2,
      range: 90,
      falloffStart: 40,
      falloffMinMult: 0.8,
      magSize: 8,
      reserve: 96,
      reloadStyle: 'mag',
      reloadTime: 2.2,
      reloadEmptyTime: 2.75,
      reloadAddAt: 0.68,
      drawTime: 0.6,
      adsTime: 0.24,
      adsFovMult: 0.78,
      adsMoveMult: 0.55,
      moveSpeedMult: 0.95,
      spread: { hipBase: 2.8, hipMax: 6.5, perShot: 1.6, recovery: 7, ads: 0.08, adsPerShot: 0.35, moving: 1.8, air: 5, crouchMult: 0.75 },
      recoil: { pitch: 2.6, yaw: 0.7, recovery: 8, adsMult: 0.65, viewKick: 1.3 },
      sound: { kind: 'rifle', body: 2600, thump: 120, crack: 1.25, tail: 0.85, pitch: 0.95, mech: true },
      view: { model: 'rifle', flash: 1.3 },
      upgrade: { name: 'Detention Hammer', color: '#d4a017', penetration: 4 },
    },

    Olympus: {
      name: 'Olympus',
      class: 'shotgun',
      cost: 1200, ammoCost: 600,
      fireMode: 'semi',
      rpm: 300,
      damage: 60,             // per pellet
      headMult: 1.6,
      limbMult: 0.9,
      pellets: 8,
      penetration: 1,
      range: 28,
      falloffStart: 6,
      falloffMinMult: 0.25,
      magSize: 2,
      reserve: 60,
      reloadStyle: 'break',
      reloadTime: 2.4,
      reloadEmptyTime: 2.4,
      reloadAddAt: 0.72,
      drawTime: 0.6,
      adsTime: 0.22,
      adsFovMult: 0.88,
      adsMoveMult: 0.6,
      moveSpeedMult: 0.93,
      spread: { hipBase: 5.2, hipMax: 7, perShot: 0.8, recovery: 6, ads: 3.8, adsPerShot: 0.5, moving: 0.6, air: 2, crouchMult: 0.95 },
      recoil: { pitch: 5.5, yaw: 1.4, recovery: 6.5, adsMult: 0.8, viewKick: 2.2 },
      sound: { kind: 'shotgun', body: 1100, thump: 70, crack: 0.8, tail: 1.1, pitch: 0.8 },
      view: { model: 'doubleBarrel', flash: 2.0 },
      upgrade: { name: 'Wrath of Olympus', color: '#e0402a', damageMult: 2.5, reserve: 100 },
    },

    MP41: {
      name: 'MP41',
      class: 'smg',
      cost: 1000, ammoCost: 500,
      fireMode: 'auto',
      rpm: 520,
      damage: 38,
      headMult: 2.6,
      limbMult: 0.8,
      pellets: 1,
      penetration: 1,
      range: 55,
      falloffStart: 14,
      falloffMinMult: 0.6,
      magSize: 32,
      reserve: 192,
      reloadStyle: 'mag',
      reloadTime: 2.3,
      reloadEmptyTime: 2.8,
      reloadAddAt: 0.66,
      drawTime: 0.5,
      adsTime: 0.2,
      adsFovMult: 0.84,
      adsMoveMult: 0.65,
      moveSpeedMult: 1.0,
      spread: { hipBase: 2.3, hipMax: 6.5, perShot: 0.42, recovery: 9, ads: 0.35, adsPerShot: 0.12, moving: 1.2, air: 4, crouchMult: 0.8 },
      recoil: { pitch: 0.9, yaw: 0.5, recovery: 10, adsMult: 0.6, viewKick: 0.6 },
      sound: { kind: 'smg', body: 2400, thump: 130, crack: 0.8, tail: 0.45, pitch: 1.05, mech: true },
      view: { model: 'smg', flash: 0.9 },
      upgrade: { name: 'Last Call', color: '#2ecc71', magSize: 50 },
    },

    // ---- mystery box weapons (the full list arrives in Phase 3) --------------
    Pyton: {
      name: 'Pyton',
      class: 'pistol',
      boxOnly: true,
      fireMode: 'semi',
      rpm: 240,
      damage: 180,
      headMult: 2.2,
      limbMult: 0.85,
      pellets: 1,
      penetration: 2,
      range: 70,
      falloffStart: 22,
      falloffMinMult: 0.7,
      magSize: 6,
      reserve: 72,
      reloadStyle: 'cylinder',
      reloadTime: 3.1,
      reloadEmptyTime: 3.1,
      reloadAddAt: 0.75,
      drawTime: 0.5,
      adsTime: 0.2,
      adsFovMult: 0.82,
      adsMoveMult: 0.6,
      moveSpeedMult: 1.0,
      spread: { hipBase: 2.4, hipMax: 6.5, perShot: 2.6, recovery: 6, ads: 0.15, adsPerShot: 0.5, moving: 1.5, air: 4, crouchMult: 0.8 },
      recoil: { pitch: 4.5, yaw: 1.0, recovery: 6.5, adsMult: 0.75, viewKick: 1.8 },
      sound: { kind: 'revolver', body: 1900, thump: 110, crack: 1.2, tail: 0.9, pitch: 0.85 },
      view: { model: 'revolver', flash: 1.5 },
      upgrade: { name: 'Venom King', color: '#9b30ff', damageMult: 2.5, penetration: 4 },
    },

    Komando: {
      name: 'Komando',
      class: 'ar',
      boxOnly: true,
      fireMode: 'auto',
      rpm: 760,
      damage: 80,
      headMult: 3,
      limbMult: 0.8,
      pellets: 1,
      penetration: 2,
      range: 80,
      falloffStart: 30,
      falloffMinMult: 0.75,
      magSize: 30,
      reserve: 300,
      reloadStyle: 'mag',
      reloadTime: 2.25,
      reloadEmptyTime: 2.7,
      reloadAddAt: 0.66,
      drawTime: 0.55,
      adsTime: 0.22,
      adsFovMult: 0.8,
      adsMoveMult: 0.6,
      moveSpeedMult: 0.95,
      spread: { hipBase: 2.6, hipMax: 7, perShot: 0.38, recovery: 8.5, ads: 0.22, adsPerShot: 0.09, moving: 1.5, air: 5, crouchMult: 0.8 },
      recoil: { pitch: 0.95, yaw: 0.45, recovery: 11, adsMult: 0.55, viewKick: 0.7 },
      sound: { kind: 'ar', body: 2500, thump: 125, crack: 1.0, tail: 0.6, pitch: 1.0, mech: true },
      view: { model: 'carbine', flash: 1.1 },
      upgrade: { name: 'Warmonger', color: '#2e86de' },
    },
    // ---- more wall weapons (their wall spots arrive with the Phase 4 rooms) --
    Staykout: gun('shotgun', {
      name: 'Staykout', cost: 1500, ammoCost: 750,
      action: 'pump', rpm: 72, damage: 72, pellets: 8, magSize: 6, reserve: 60,
      reloadStartTime: 0.4, shellTime: 0.52, reloadEndTime: 0.5,
      recoil: { pitch: 6, yaw: 1.5, viewKick: 2.3 },
      sound: { kind: 'shotgun', body: 1000, thump: 65, crack: 0.85, tail: 1.1, pitch: 0.78 },
      view: { model: 'pump', flash: 2.0 },
      upgrade: { name: 'Riot Act', color: '#e74c3c', damageMult: 2.5 },
    }),
    MP6K: gun('smg', {
      name: 'MP6K', cost: 1000, ammoCost: 500,
      rpm: 760, damage: 40, magSize: 30, reserve: 120, reloadTime: 2.3, reloadEmptyTime: 2.75,
      recoil: { pitch: 0.75, yaw: 0.55 },
      sound: { kind: 'smg', body: 2700, thump: 140, crack: 0.75, tail: 0.4, pitch: 1.12, mech: true },
      view: { model: 'mp6k', flash: 0.8 },
      upgrade: { name: 'Hornet\'s Nest', color: '#f1c40f' },
    }),
    MPK: gun('smg', {
      name: 'MPK', cost: 1100, ammoCost: 550,
      rpm: 960, damage: 38, magSize: 24, reserve: 168, reloadTime: 2.1, reloadEmptyTime: 2.55,
      spread: { perShot: 0.5 }, recoil: { pitch: 0.7, yaw: 0.7 },
      sound: { kind: 'smg', body: 3000, thump: 150, crack: 0.7, tail: 0.35, pitch: 1.25, mech: true },
      view: { model: 'mpk', flash: 0.75 },
      upgrade: { name: 'Buzzsaw Betty', color: '#a569ff', magSize: 40 },
    }),
    PM64: gun('smg', {
      name: 'PM64', cost: 1000, ammoCost: 500,
      rpm: 1050, damage: 32, headMult: 2.4, magSize: 20, reserve: 160, reloadTime: 1.9, reloadEmptyTime: 2.3,
      range: 40, falloffStart: 10, falloffMinMult: 0.5,
      spread: { hipBase: 2.6, perShot: 0.55 }, recoil: { pitch: 0.65, yaw: 0.85 },
      sound: { kind: 'smg', body: 3200, thump: 160, crack: 0.65, tail: 0.3, pitch: 1.35, mech: true },
      view: { model: 'pm64', flash: 0.7 },
      upgrade: { name: 'Pocket Apocalypse', color: '#ff7f24', magSize: 40 },
    }),
    'AK-75u': gun('smg', {
      name: 'AK-75u', cost: 1200, ammoCost: 600,
      rpm: 800, damage: 56, headMult: 2.8, magSize: 20, reserve: 160, reloadTime: 2.3, reloadEmptyTime: 2.85,
      recoil: { pitch: 1.05, yaw: 0.6, viewKick: 0.75 },
      sound: { kind: 'ar', body: 2300, thump: 115, crack: 1.0, tail: 0.6, pitch: 1.0, mech: true },
      view: { model: 'ak75u', flash: 1.2 },
      upgrade: { name: 'Siberian Howl', color: '#ff3b30' },
    }),
    M17: gun('ar', {
      name: 'M17', cost: 1200, ammoCost: 600,
      fireMode: 'burst', burstCount: 3, burstDelay: 0.3, rpm: 900, damage: 72, magSize: 30, reserve: 120,
      reloadTime: 2.2, reloadEmptyTime: 2.7,
      spread: { hipBase: 2.4, perShot: 0.3, ads: 0.12, adsPerShot: 0.06 }, recoil: { pitch: 0.85, yaw: 0.3 },
      sound: { kind: 'ar', body: 2700, thump: 125, crack: 1.1, tail: 0.65, pitch: 1.05, mech: true },
      view: { model: 'm17', flash: 1.0 },
      upgrade: { name: 'Triple Threat', color: '#1abc9c' },
    }),
    // Peacekeeper: between a submachine gun and a rifle. Fast, hits well, barely kicks.
    Peacekeeper: gun('smg', {
      name: 'Peacekeeper', cost: 1500, ammoCost: 750,
      rpm: 760, damage: 74, headMult: 2.8, range: 70, falloffStart: 22, falloffMinMult: 0.7, penetration: 2,
      magSize: 24, reserve: 240, reloadTime: 1.9, reloadEmptyTime: 2.35,
      drawTime: 0.4, adsTime: 0.15, adsFovMult: 0.82,
      spread: { hipBase: 2.0, hipMax: 5.5, perShot: 0.3, ads: 0.2, adsPerShot: 0.07 },
      recoil: { pitch: 0.6, yaw: 0.28, recovery: 12, adsMult: 0.55, viewKick: 0.5 },
      sound: { kind: 'smg', body: 2850, thump: 135, crack: 0.9, tail: 0.5, pitch: 1.12, mech: true },
      view: { model: 'peacekeeper', flash: 0.9 },
      upgrade: { name: 'Ceasefire', color: '#5ad7ff', magSize: 48, damageMult: 2.4 },
    }),

    // ---- mystery box ----------------------------------------------------------
    CZ76: gun('pistol', {
      name: 'CZ76', boxOnly: true,
      rpm: 520, damage: 62, magSize: 12, reserve: 72, reloadTime: 1.6, reloadEmptyTime: 1.9,
      recoil: { pitch: 1.5 },
      sound: { kind: 'pistol', body: 2400, thump: 160, crack: 0.95, tail: 0.5, pitch: 1.08 },
      view: { model: 'cz76', flash: 0.9 },
      upgrade: { name: 'Crimson Viper', color: '#ff2d55' },
    }),
    'CZ76 Dual': gun('pistol', {
      name: 'CZ76 Dual Wield', boxOnly: true, dual: true,   // left click = right gun, right click = left gun
      rpm: 520, damage: 62, magSize: 12, reserve: 144, reloadTime: 2.1, reloadEmptyTime: 2.4,
      spread: { hipBase: 2.4 }, recoil: { pitch: 1.4 },
      sound: { kind: 'pistol', body: 2400, thump: 160, crack: 0.95, tail: 0.5, pitch: 1.08 },
      view: { model: 'cz76', flash: 0.9 },
      upgrade: { name: 'Viper Twins', color: '#ff2d55' },
    }),
    Spectur: gun('smg', {
      name: 'Spectur', boxOnly: true,
      rpm: 1000, damage: 46, magSize: 30, reserve: 180, reloadTime: 2.3, reloadEmptyTime: 2.8,
      recoil: { pitch: 0.8, yaw: 0.6 },
      sound: { kind: 'smg', body: 2800, thump: 140, crack: 0.8, tail: 0.4, pitch: 1.15, mech: true },
      view: { model: 'spectur', flash: 0.85 },
      upgrade: { name: 'Phantom Shredder', color: '#5ad1ff' },
    }),
    FAMOS: gun('ar', {
      name: 'FAMOS', boxOnly: true,
      rpm: 930, damage: 70, magSize: 30, reserve: 210, reloadTime: 2.6, reloadEmptyTime: 3.1,
      recoil: { pitch: 1.05, yaw: 0.5 },
      sound: { kind: 'ar', body: 2600, thump: 120, crack: 1.0, tail: 0.6, pitch: 1.1, mech: true },
      view: { model: 'famos', flash: 1.0 },
      upgrade: { name: 'Burnout', color: '#ff6a00' },
    }),
    AWG: gun('ar', {
      name: 'AWG', boxOnly: true,
      rpm: 660, damage: 82, headMult: 3.5, magSize: 30, reserve: 210, reloadTime: 2.5, reloadEmptyTime: 3.0,
      adsFovMult: 0.5, adsTime: 0.26, scope: { sway: 0.08 },
      spread: { ads: 0.08, adsPerShot: 0.05 }, recoil: { pitch: 0.85, yaw: 0.35 },
      sound: { kind: 'ar', body: 2500, thump: 125, crack: 1.05, tail: 0.65, pitch: 1.0, mech: true },
      view: { model: 'awg', flash: 1.0 },
      upgrade: { name: 'Grim Overseer', color: '#7fff00', penetration: 4 },
    }),
    Galill: gun('ar', {
      name: 'Galill', boxOnly: true,
      rpm: 700, damage: 92, headMult: 3, magSize: 35, reserve: 315, reloadTime: 2.7, reloadEmptyTime: 3.2,
      recoil: { pitch: 1.1, yaw: 0.45 },
      sound: { kind: 'ar', body: 2300, thump: 115, crack: 1.1, tail: 0.7, pitch: 0.95, mech: true },
      view: { model: 'galill', flash: 1.2 },
      upgrade: { name: 'Desert Dirge', color: '#ffb347' },
    }),
    G12: gun('ar', {
      name: 'G12', boxOnly: true,
      fireMode: 'burst', burstCount: 3, burstDelay: 0.24, rpm: 1500, damage: 84, magSize: 45, reserve: 270,
      reloadTime: 2.8, reloadEmptyTime: 3.2,
      spread: { perShot: 0.22, ads: 0.1, adsPerShot: 0.04 }, recoil: { pitch: 0.6, yaw: 0.25 },
      sound: { kind: 'ar', body: 3000, thump: 130, crack: 0.9, tail: 0.55, pitch: 1.2, mech: true },
      view: { model: 'g12', flash: 0.9 },
      upgrade: { name: 'Caseless Carnage', color: '#00e5ff', magSize: 60 },
    }),
    'SPAZ-13': gun('shotgun', {
      name: 'SPAZ-13', boxOnly: true,
      rpm: 260, damage: 76, pellets: 8, magSize: 8, reserve: 64,
      reloadStartTime: 0.35, shellTime: 0.42, reloadEndTime: 0.35,
      sound: { kind: 'shotgun', body: 1150, thump: 70, crack: 0.9, tail: 1.0, pitch: 0.85 },
      view: { model: 'spaz', flash: 1.9 },
      upgrade: { name: 'Bloodbath 13', color: '#c0392b', damageMult: 2.5 },
    }),
    HS11: gun('shotgun', {
      name: 'HS11', boxOnly: true, dual: true,
      rpm: 300, damage: 66, pellets: 7, magSize: 6, reserve: 72, reloadStyle: 'mag', reloadTime: 3.0, reloadEmptyTime: 3.0,
      spread: { hipBase: 5.8 },
      sound: { kind: 'shotgun', body: 1200, thump: 75, crack: 0.9, tail: 0.95, pitch: 0.9 },
      view: { model: 'hs11', flash: 1.8 },
      upgrade: { name: 'Dead Ringers', color: '#d63384', damageMult: 2.5 },
    }),
    HK22: gun('lmg', {
      name: 'HK22', boxOnly: true,
      rpm: 620, damage: 112, magSize: 125, reserve: 500, reloadTime: 5.6, reloadEmptyTime: 5.6,
      recoil: { pitch: 1.8, yaw: 1.1, viewKick: 1.2 },
      sound: { kind: 'lmg', body: 2100, thump: 105, crack: 1.15, tail: 0.85, pitch: 0.9, mech: true },
      view: { model: 'hk22', flash: 1.4 },
      upgrade: { name: 'Steel Hurricane', color: '#bdc3c7', magSize: 175 },
    }),
    RPKK: gun('lmg', {
      name: 'RPKK', boxOnly: true,
      rpm: 650, damage: 96, magSize: 100, reserve: 400, reloadStyle: 'mag', reloadTime: 4.4, reloadEmptyTime: 4.8,
      recoil: { pitch: 1.3, yaw: 0.8 },
      sound: { kind: 'lmg', body: 2200, thump: 110, crack: 1.1, tail: 0.8, pitch: 0.95, mech: true },
      view: { model: 'rpkk', flash: 1.3 },
      upgrade: { name: 'Iron Tsunami', color: '#3498db', magSize: 150 },
    }),
    Dragunoff: gun('sniper', {
      name: 'Dragunoff', boxOnly: true,
      rpm: 230, damage: 420, headMult: 3, magSize: 10, reserve: 40, penetration: 3,
      reloadTime: 2.7, reloadEmptyTime: 3.2, adsFovMult: 0.36,
      sound: { kind: 'sniper', body: 1800, thump: 90, crack: 1.4, tail: 1.3, pitch: 0.9 },
      view: { model: 'dragunoff', flash: 1.5 },
      upgrade: { name: 'Cold Verdict', color: '#74b9ff', damageMult: 2.5, penetration: 6 },
    }),
    // (the id stays L97A1, so old saves and stats still find it)
    L97A1: gun('sniper', {
      name: 'L96A1', boxOnly: true,
      action: 'bolt', rpm: 52, damage: 1100, headMult: 2, magSize: 5, reserve: 50, penetration: 5,
      reloadTime: 3.0, reloadEmptyTime: 3.6, adsFovMult: 0.28, scope: { sway: 0.3 },
      recoil: { pitch: 6.5, viewKick: 2.6 },
      sound: { kind: 'sniper', body: 1600, thump: 80, crack: 1.5, tail: 1.5, pitch: 0.82 },
      view: { model: 'l97', flash: 1.6 },
      upgrade: { name: 'Final Exam', color: '#ff1744', damageMult: 3, magSize: 8, penetration: 9, explosiveRounds: 'sniperUp', note: 'Rounds that punch through a whole line and go off where they stop.' },
    }),
    // Desert Eagle: a hand cannon. Huge hits, huge kick, a 7-round magazine.
    'Desert Eagle': gun('pistol', {
      name: 'Desert Eagle', boxOnly: true,
      rpm: 200, damage: 240, headMult: 3.5, range: 80, falloffStart: 25, falloffMinMult: 0.75, penetration: 2,
      magSize: 7, reserve: 63, reloadTime: 1.75, reloadEmptyTime: 2.1, drawTime: 0.55, adsTime: 0.2,
      spread: { hipBase: 2.4, hipMax: 6.5, perShot: 2.6, recovery: 5.5, ads: 0.2, adsPerShot: 0.5 },
      recoil: { pitch: 6.2, yaw: 1.3, recovery: 5.5, adsMult: 0.85, viewKick: 2.8 },
      sound: { kind: 'pistol', body: 1500, thump: 85, crack: 1.4, tail: 1.1, pitch: 0.78 },
      view: { model: 'deagle', flash: 1.7 },
      upgrade: { name: 'Sandstorm', color: '#ffc21a', magSize: 10, damageMult: 2.2, explosiveRounds: 'eagleUp', note: 'Every shot blows up where it lands.' },
    }),
    // SCAR-H: slow for a rifle, but every round hits hard.
    'SCAR-H': gun('ar', {
      name: 'SCAR-H', boxOnly: true,
      rpm: 540, damage: 150, headMult: 3, range: 95, falloffStart: 35, magSize: 20, reserve: 240, penetration: 2,
      reloadTime: 2.5, reloadEmptyTime: 3.0,
      spread: { hipBase: 2.8, perShot: 0.5, ads: 0.2, adsPerShot: 0.12 },
      recoil: { pitch: 1.6, yaw: 0.6, recovery: 9.5, adsMult: 0.6, viewKick: 1.05 },
      sound: { kind: 'ar', body: 2000, thump: 105, crack: 1.25, tail: 0.85, pitch: 0.86, mech: true },
      view: { model: 'scarh', flash: 1.3 },
      upgrade: { name: 'Scar Tissue', color: '#ff4d6d', magSize: 40, damageMult: 2.4 },
    }),
    // M60: a belt of 100, heavy and slow, and it weighs you down.
    M60: gun('lmg', {
      name: 'M60', boxOnly: true,
      rpm: 540, damage: 140, headMult: 2.6, magSize: 100, reserve: 400, penetration: 3,
      reloadTime: 7.4, reloadEmptyTime: 7.9, drawTime: 1.0, adsTime: 0.46, adsMoveMult: 0.42, moveSpeedMult: 0.82,
      spread: { hipBase: 3.8, hipMax: 9, perShot: 0.5 },
      recoil: { pitch: 2.1, yaw: 1.25, recovery: 7, adsMult: 0.7, viewKick: 1.4 },
      sound: { kind: 'lmg', body: 1700, thump: 95, crack: 1.25, tail: 1.0, pitch: 0.8, mech: true },
      view: { model: 'm60', flash: 1.6 },
      upgrade: { name: 'Death Machine', color: '#ff9f1a', magSize: 200, reloadTime: 4.4, reloadEmptyTime: 4.8 },
    }),
    // The Death Machine power-up (Fatal Contraption's GobbleGum drop): a minigun
    // that never runs dry, yours for `powerups.list.deathMachine.time` s. You can't
    // put it away. (Not in the box or on a wall.)
    'Death Machine': gun('lmg', {
      name: 'Death Machine', boxOnly: true, gumOnly: true, deathMachine: true, infinite: true,
      rpm: 1100, damage: 300, headMult: 2, magSize: 999, reserve: 0, penetration: 4,
      drawTime: 0.4, adsTime: 0.3, adsMoveMult: 0.6, moveSpeedMult: 0.85,
      spread: { hipBase: 2.4, hipMax: 5, perShot: 0.15 },
      recoil: { pitch: 0.5, yaw: 0.6, recovery: 12, adsMult: 0.7, viewKick: 0.8 },
      sound: { kind: 'lmg', body: 2300, thump: 90, crack: 1.1, tail: 0.7, pitch: 1.15, mech: true },
      view: { model: 'm60', flash: 1.8, camo: '#3a3a3a' },
    }),
    'China Pond': gun('launcher', {
      name: 'China Pond', boxOnly: true,
      action: 'pump', rpm: 60, damage: 0, magSize: 2, reserve: 20,
      projectile: { type: 'launcher', speed: 34, gravity: 9.8, explode: 'launcher' },
      sound: { kind: 'launcher', body: 600, thump: 60, crack: 0.3, tail: 0.6, pitch: 1 },
      view: { model: 'chinapond', flash: 1.2 },
      upgrade: { name: 'Doomsday Dragon', color: '#ff4500', magSize: 3, reserve: 30, explodeUp: true },
    }),
    'Kross-Bow': gun('launcher', {
      name: 'Kross-Bow', boxOnly: true,
      rpm: 70, damage: 0, magSize: 1, reserve: 10, reloadStyle: 'mag', reloadTime: 2.4, reloadEmptyTime: 2.4,
      adsFovMult: 0.5, scope: { sway: 0.1 },
      projectile: { type: 'bolt', speed: 55, gravity: 4, impactDamage: 120, fuse: 1.0, explode: 'bolt' },
      spread: { hipBase: 1.2, ads: 0.05 },
      sound: { kind: 'crossbow', body: 900, thump: 120, crack: 0.2, tail: 0.3, pitch: 1 },
      view: { model: 'krossbow', flash: 0 },
      upgrade: { name: 'Hellhound\'s Fang', color: '#ff8c00', magSize: 1, reserve: 20, impactMult: 3, explodeUp: true },
    }),
    'Ballistik Knife': gun('pistol', {
      name: 'Ballistik Knife', boxOnly: true,
      rpm: 60, damage: 0, magSize: 1, reserve: 5, reloadTime: 2.6, reloadEmptyTime: 2.6,
      meleeMult: 2,          // knife hits twice as hard while you hold it
      projectile: { type: 'blade', speed: 42, gravity: 3, impactDamage: 650, headMult: 2 },
      spread: { hipBase: 0.8, ads: 0.1 },
      sound: { kind: 'blade', body: 700, thump: 140, crack: 0.2, tail: 0.2, pitch: 1 },
      view: { model: 'bknife', flash: 0 },
      upgrade: { name: 'Soul Splitter', color: '#e00000', magSize: 1, reserve: 12, impactMult: 3, meleeMult: 3 },
    }),

    // ---- wonder weapons (Mystery Box only) ------------------------------------
    // The Fucci Gun: a designer energy pistol. Gold rings of plasma that hit
    // hard and splash everything around the impact.
    'Fucci Gun': gun('pistol', {
      name: 'Fucci Gun', boxOnly: true, wonder: true,
      fireMode: 'semi', rpm: 190, damage: 0, magSize: 20, reserve: 160,
      reloadTime: 2.4, reloadEmptyTime: 2.6, drawTime: 0.55,
      projectile: { type: 'fucci', speed: 40, gravity: 0, impactDamage: 1000, headMult: 1.5, explode: 'fucci' },
      spread: { hipBase: 1.1, hipMax: 3, perShot: 0.6, ads: 0.15, adsPerShot: 0.15 },
      recoil: { pitch: 1.6, yaw: 0.3, recovery: 9, adsMult: 0.7, viewKick: 1 },
      sound: { kind: 'fucci', body: 0, thump: 0, crack: 0, tail: 0.4, pitch: 1 },
      view: { model: 'fucci', flash: 0.9, flashColor: '#ffcf4a' },
      upgrade: { name: 'Fucci Haute Couture', color: '#ff2fa0', magSize: 40, impactMult: 2, explodeUp: true },
    }),
    // The Scavenger: a bolt-action rifle firing explosive bolts. Each one sticks
    // in whatever it hits, glows, and goes off a second later: a huge blast that
    // clears a crowd (stand clear yourself).
    Scavenger: gun('sniper', {
      name: 'Scavenger', boxOnly: true, wonder: true,
      action: 'bolt', rpm: 38, damage: 0, magSize: 2, reserve: 12,
      reloadTime: 3.2, reloadEmptyTime: 3.7, drawTime: 0.8, adsFovMult: 0.32, scope: { sway: 0.3 },
      projectile: { type: 'scav', speed: 85, gravity: 1.5, impactDamage: 600, fuse: 1.1, explode: 'scav' },
      spread: { hipBase: 4, ads: 0, adsPerShot: 0 },
      recoil: { pitch: 6, yaw: 1.2, recovery: 5, adsMult: 0.85, viewKick: 2.6 },
      sound: { kind: 'sniper', body: 1400, thump: 70, crack: 1.0, tail: 1.4, pitch: 0.7 },
      view: { model: 'scav', flash: 1.4, flashColor: '#9dff6a' },
      upgrade: { name: 'Carrion Crown', color: '#ff5e00', magSize: 3, reserve: 24, impactMult: 2, explodeUp: true, thermal: true, note: 'Bigger blasts, and a thermal scope: the dead glow through fog and dark.' },
    }),
    // The Fucci Gun Mk 2: the sequel. A fast 3-round burst of energy beams,
    // dead straight, that drop zombies in one hit for the early rounds.
    'Fucci Gun Mk 2': gun('pistol', {
      name: 'Fucci Gun Mk 2', boxOnly: true, wonder: true,
      fireMode: 'burst', burstCount: 3, burstDelay: 0.32, rpm: 1000, damage: 0, magSize: 21, reserve: 210,
      reloadTime: 1.45, reloadEmptyTime: 1.65, drawTime: 0.5,
      projectile: { type: 'beam', speed: 110, gravity: 0, impactDamage: 1050, headMult: 1.5, life: 1.2 },
      spread: { hipBase: 1.2, hipMax: 3, perShot: 0.25, ads: 0.1, adsPerShot: 0.05 },
      recoil: { pitch: 0.9, yaw: 0.25, recovery: 10, adsMult: 0.6, viewKick: 0.6 },
      sound: { kind: 'beam', body: 0, thump: 0, crack: 0, tail: 0.3, pitch: 1.5, sample: 'g_laser', sampleGain: 0.55 },   // (a recorded laser: assets/sfx/gear)
      view: { model: 'fucci2', flash: 0.8, flashColor: '#7ae8ff' },
      upgrade: { name: 'Fucci Runway Edition', color: '#00ffc8', burstCount: 5, magSize: 40, impactMult: 2.2 },
    }),
    // The Chopper: a wonder weapon. Each shot is a wall of wind that kills
    // and throws every zombie in a wide cone in front of you.
    'The Chopper': gun('launcher', {
      name: 'The Chopper', boxOnly: true, wonder: true,
      fireMode: 'semi', rpm: 75, damage: 0, magSize: 2, reserve: 12,
      reloadStyle: 'mag', reloadTime: 2.6, reloadEmptyTime: 2.8, drawTime: 0.7,
      wind: { range: 11, angle: 22, near: 1.6, maxKills: 24 },
      spread: { hipBase: 0, hipMax: 0, perShot: 0, ads: 0 },
      recoil: { pitch: 5.5, yaw: 1.2, recovery: 5, adsMult: 0.9, viewKick: 3.2 },
      sound: { kind: 'wind', body: 0, thump: 0, crack: 0, tail: 1, pitch: 1 },
      view: { model: 'chopper', flash: 0 },
      upgrade: { name: 'The Meat Grinder', color: '#ff3b1f', magSize: 4, wind: { range: 14, angle: 27, near: 2.0, maxKills: 36 } },
    }),
    // The M2 Flamethrower (from the box): a jet of fire, no ammo, it overheats.
    // Whatever the stream touches catches and burns until it's dead
    // (src/sim/flame.js); the flame itself barely hurts.
    'M2 Flamethrower': gun('lmg', {
      name: 'M2 Flamethrower', boxOnly: true, infinite: true, noAds: true, wonder: true,
      fireMode: 'auto', rpm: 600, damage: 0, magSize: 1, reserve: 0, penetration: 1, reloadStyle: 'mag', reloadTime: 1, drawTime: 0.9, moveSpeedMult: 0.9,
      spread: { hipBase: 0, hipMax: 0, perShot: 0, recovery: 9, ads: 0, adsPerShot: 0, moving: 0, air: 0, crouchMult: 1 },
      recoil: { pitch: 0.05, yaw: 0.05, recovery: 9, adsMult: 1, viewKick: 0.1 },
      flame: {
        range: 8.5,            // m the jet reaches
        angle: 13,             // degrees either side of where you aim it catches
        near: 1.5,             // m: anything this close catches whatever the angle
        speed: 15,             // m/s the fire travels (how it looks)
        damage: 30,            // each burst (10 a second) to everything it's on
        maxTargets: 14,        // set alight in one burst
        burnKill: 3.2,         // s for the fire to burn one down from full health
      },
      heat: { up: 0.17, cool: 0.4, lock: 2.2 },   // a share of full a second firing, cooling; s locked out once it's overheated
      sound: { kind: 'flame', body: 0, thump: 0, crack: 0, tail: 0, pitch: 1 },
      view: { model: 'flamer', flash: 0 },
      upgrade: {
        name: "Dragon's Breath", color: '#ff5a1a',
        flame: { range: 11.5, angle: 17, near: 1.8, speed: 18, damage: 70, maxTargets: 22, burnKill: 1.8, look: 1.4 },
        heat: { up: 0.11, cool: 0.5, lock: 1.6 },
      },
    }),
    // The War Hammer: built from its four parts (one on each island) at the stand
    // on the Anvil's dais, one each. Plain iron: a titan's core turns it elemental.
    'War Hammer': warHammer('iron', { name: 'War Hammer' }),
    // The four elemental War Hammers (Pit tempers each into its "+" for a price)
    'Wind Hammer': warHammer('wind', { name: 'Wind Hammer', upgrade: { name: 'Tempest Hammer', color: '#bfffe0' } }),
    'Lightning Hammer': warHammer('lightning', { name: 'Lightning Hammer', upgrade: { name: 'Thunder Hammer', color: '#c79bff' } }),
    'Ice Hammer': warHammer('ice', { name: 'Ice Hammer', upgrade: { name: 'Glacier Hammer', color: '#9feaff' } }),
    'Fire Hammer': warHammer('fire', { name: 'Fire Hammer', upgrade: { name: 'Inferno Hammer', color: '#ffb02a' } }),
  },

  startingWeapon: 'M1912',

  // ---------------------------------------------------------------------------
  // Doors, debris and the mystery box
  // ---------------------------------------------------------------------------
  doors: {
    // Call of the Crust: the hub
    debris_hub_west: 750, debris_hub_south: 750, door_obs_w: 1000, door_obs_n: 1000,
    door_depot_n: 1000, door_depot_e: 1000, debris_camp_e: 1000, debris_camp_s: 1000,
    // the Ship Graveyard
    debris_ship_square: 1000, debris_ship_harbor: 1000, door_ship_netshed: 750, door_ship_trawler: 1000,
    door_ship_smokehouse: 750, door_ship_keeper: 750, door_ship_hold: 1250, door_ship_engine: 1250,
    // the Research Base
    door_res_airlock: 1000, door_res_decon: 750, door_res_gen: 1250, door_res_lab: 1000,
    door_res_server: 1000, door_res_dome: 1250, debris_res_tesla: 1250,
    // the Trench Front
    debris_tr_west: 1000, debris_tr_east: 1000, door_tr_bunker: 750, door_tr_hospital: 750,
    debris_tr_battery: 1000, debris_tr_farm: 1250,
    // the Ice Caves
    debris_cave_gallery: 1000, door_cave_summit: 1250, debris_cave_mine: 1000,
    door_hall: 750,
    door_cafe: 1000,
    debris_office: 1250,
    // west path
    door_locker: 1000,
    debris_boiler: 750,
    door_lab: 1000,
    debris_library: 1250,
    door_band: 1250,
    door_aud_band: 1500,
    // east path
    door_kitchen: 1250,
    door_dock: 1250,
    door_aud_dock: 1500,
    // the Quad
    door_quad_hall: 1000,
    door_quad_cafe: 1250,
    door_quad_office: 1250,
    openTime: 1.1,             // door swing / debris clear animation (zombies can path once started)
  },

  // The maps you can play online (the host picks one in the lobby: src/ui/online.js).
  // beta: marked BETA (still being worked on online); locked: the host needs the
  // developer code to pick it; notPlayable: characters you can't be there (they're
  // part of the map: Pit's at his forge on the Crust).
  onlineMaps: [
    { id: 'lastbell', name: 'The Last Bell' },
    { id: 'crust', name: 'Call of the Crust', beta: true, locked: true, notPlayable: ['pit'] },
  ],

  // ---------------------------------------------------------------------------
  // GobbleGum (src/sim/gums.js, the menu: src/ui/careerUI.js GumsUI). As in Black Ops 3:
  // you take a pack of 5 into a game; a GobbleGum machine gives you one of them
  // at random (500 the first time in a round, then 1000, then 2000: 3 a round).
  // Classics never run out. Megas are used up as they come out of the machine,
  // and come from Dr. Monty's Factory for Liquid Divinium, which you earn by
  // playing. Your pack, your Megas and your Divinium are your career's (your
  // username's). The gum you've got goes off one of four ways:
  //   activated  press [H] (D-pad down) to use it: `uses` times
  //   timed      starts as you chew it; lasts `time` s
  //   rounds     starts as you chew it; lasts `rounds` round ends
  //   special    sits there till the thing it's for happens (`uses` times)
  // A gum with `window` s: each use stays on that long.
  // ---------------------------------------------------------------------------
  gobblegum: {
    packSize: 5,
    costs: [500, 1000, 2000],    // the 1st, 2nd and 3rd gum in a round
    perRound: 3,
    dispenseTime: 2.2,           // s the machine churns
    offerTime: 6,                // s the gum sits in the tray for you
    chewTime: 0.8,               // s to chew it (your gun's down)
    // a machine stands `offset` m beside a perk machine (`half` its half-width), `perMap` at most;
    // it goes dark after a few uses (`awayTime` s till it's back)
    machine: { range: 1.7, uses: [3, 5], awayTime: 25, offset: 1.5, half: 0.4, perMap: 6 },
    // the machine (src/render/machinesView.js GumView): globe and gumball radius (m), how many
    // balls in it, its paint and its light
    // model: the gumball machine (stood `height` m tall; its chute `chute` of the way up),
    // badge: the size (m) of the gum's logo floating over the chute, `badgeUp` m above it
    look: { globe: 0.3, ball: 0.035, balls: 70, body: '#c8246e', light: '#ff7ad0', lightI: 6, model: 'assets/props/gumball.glb', height: 1.7, chute: 0.655, badge: 0.2, badgeUp: 0.22 },
    defaultPack: ['alwaysDoneSwiftly', 'stockOption', 'swordFlay', 'inPlainSight', 'coagulant'],
    // Liquid Divinium, at the end of a game you played (rounds you survived):
    // each round past `fromRound` a chance at a vial, one for sure every
    // `every` rounds, never more than `max` a game
    divinium: { fromRound: 2, chance: 0.1, every: 10, max: 5 },
    starter: 3,                  // vials a new career starts with
    // a welcome gift, once per username, for signing in before `until`: `divinium`
    // vials and `megas` of every Mega (Classics and Whimsicals never run out anyway)
    gift: { id: 'welcome-2026-10', until: '2026-10-30T23:59:59-04:00', divinium: 30, megas: 1 },
    // Dr. Monty's Factory (src/ui/factoryUI.js), as in Black Ops 3: three vats and
    // three buttons. Button n powers up n vats for vats[n-1].cost vials and they
    // brew vats[n-1].gums Megas between them (each one's tier by `odds`).
    // brew: s the vats bubble before their doors open; pop: s between gums coming out
    factory: {
      vats: [{ cost: 1, gums: 2 }, { cost: 2, gums: 4 }, { cost: 3, gums: 7 }],
      odds: { mega: 0.7, rare: 0.25, ultra: 0.05 },
      brew: 2.4, pop: 0.16,
    },
    tiers: {
      classic: { name: 'Classic', color: '#3a8de8' },
      whimsical: { name: 'Whimsical', color: '#e85ab4' },
      mega: { name: 'Mega', color: '#8e4ae0' },
      rare: { name: 'Rare Mega', color: '#5ad1e8' },
      ultra: { name: 'Ultra-Rare Mega', color: '#f09a2a' },
    },
    gums: {
      // --- Classics: never run out
      alchemicalAntithesis: { name: 'Alchemical Antithesis', tier: 'classic', kind: 'activated', uses: 1, window: 60, perAmmo: 10, desc: 'Every 10 points you earn is 1 round of stock ammo for the gun in your hands instead. Lasts 60 seconds.' },
      alwaysDoneSwiftly: { name: 'Always Done Swiftly', tier: 'classic', kind: 'rounds', rounds: 3, adsMult: 0.5, desc: 'Aim down sights faster, and walk at full speed while aiming. Lasts 3 rounds.' },
      anywhereButHere: { name: 'Anywhere But Here!', tier: 'classic', kind: 'activated', uses: 1, minFromZombies: 6, desc: 'Teleport to a random spot on the map.' },
      armamentalAccomplishment: { name: 'Armamental Accomplishment', tier: 'classic', kind: 'rounds', rounds: 3, drawMult: 0.5, regenMult: 0.5, desc: 'Switch weapons faster, and recover from taking damage faster. Lasts 3 rounds.' },
      armsGrace: { name: 'Arms Grace', tier: 'classic', kind: 'special', uses: 1, desc: 'Bleed out and you come back with the guns you had. Lasts till then.' },
      arsenalAccelerator: { name: 'Arsenal Accelerator', tier: 'classic', kind: 'timed', time: 600, fireMult: 1.5, desc: 'Wonder weapons and War Hammers fire and come back round 50% faster. Lasts 10 minutes.' },
      coagulant: { name: 'Coagulant', tier: 'classic', kind: 'timed', time: 1200, bleedMult: 3, desc: 'You take three times as long to bleed out. Lasts 20 minutes.' },
      dangerClosest: { name: 'Danger Closest', tier: 'classic', kind: 'rounds', rounds: 3, desc: 'No explosive damage to you at all. Lasts 3 rounds.' },
      firingOnAllCylinders: { name: 'Firing On All Cylinders', tier: 'classic', kind: 'rounds', rounds: 3, desc: 'Shoot while sprinting. Lasts 3 rounds.' },
      impatient: { name: 'Impatient', tier: 'classic', kind: 'special', uses: 1, after: 20, left: 3, desc: 'Bleed out and you\'re back near the end of the round, not at the start of the next. Lasts till then.' },
      inPlainSight: { name: 'In Plain Sight', tier: 'classic', kind: 'activated', uses: 2, window: 10, desc: 'The zombies ignore you for 10 seconds. 2 uses.' },
      luckyCrit: { name: 'Lucky Crit', tier: 'classic', kind: 'rounds', rounds: 1, aatMult: 2.5, desc: 'Your Mad Dog\'d guns\' bite (their alternate ammo) goes off far more often. Lasts 1 round.' },
      nowYouSeeMe: { name: 'Now You See Me', tier: 'classic', kind: 'activated', uses: 2, window: 10, desc: 'Every zombie comes for you for 10 seconds. 2 uses.' },
      stockOption: { name: 'Stock Option', tier: 'classic', kind: 'timed', time: 180, desc: 'Your ammo comes out of your stockpile, not your magazine. Lasts 3 minutes.' },
      swordFlay: { name: 'Sword Flay', tier: 'classic', kind: 'timed', time: 150, meleeMult: 5, desc: 'Your knife does 5 times the damage. Lasts 2.5 minutes.' },
      // (Whimsical: harmless fun, and never run out either)
      eyeCandy: { name: 'Eye Candy', tier: 'whimsical', kind: 'activated', uses: 4, camos: ['#ff3ba8', '#3bffd2', '#ffe23b', '#7a3bff', '#ff7a1a', '#46ff4a', '#1ab8ff', '#ffffff'], desc: 'Paint the gun in your hands a new colour. 4 uses.' },
      newtonianNegation: { name: 'Newtonian Negation', tier: 'whimsical', kind: 'timed', time: 1500, rise: 9, desc: 'Zombies you kill fall straight up. Lasts 25 minutes.' },
      projectileVomiting: { name: 'Projectile Vomiting', tier: 'whimsical', kind: 'rounds', rounds: 5, flingMult: 3, desc: 'Zombies killed by your explosives go flying a lot further. Lasts 5 rounds.' },
      toneDeath: { name: 'Tone Death', tier: 'whimsical', kind: 'special', uses: 25, desc: 'Silly sounds play when you kill zombies. 25 kills.' },
      // --- Megas: used up as they come out of the machine
      aftertaste: { name: 'Aftertaste', tier: 'mega', kind: 'rounds', rounds: 3, desc: 'Keep all your perks when you\'re revived. Lasts 3 rounds.' },
      boardGames: { name: 'Board Games', tier: 'mega', kind: 'rounds', rounds: 5, desc: 'Putting one board back puts every board back on that window. Lasts 5 rounds.' },
      boardToDeath: { name: 'Board to Death', tier: 'mega', kind: 'timed', time: 300, radius: 3.5, desc: 'Putting a board back kills every zombie near that window. Lasts 5 minutes.' },
      bulletBoost: { name: 'Bullet Boost', tier: 'mega', kind: 'activated', uses: 2, desc: 'Re-roll your Mad Dog\'d gun\'s bite (its alternate ammo). 2 uses.' },
      burnedOut: { name: 'Burned Out', tier: 'mega', kind: 'special', uses: 2, radius: 5, desc: 'The next time a zombie hits you, every zombie near you bursts into flames. 2 uses.' },
      cratePower: { name: 'Crate Power', tier: 'mega', kind: 'special', uses: 1, desc: 'The next gun you take out of the Mystery Box comes Mad Dog\'d.' },
      crawlSpace: { name: 'Crawl Space', tier: 'mega', kind: 'activated', uses: 1, radius: 25, desc: 'Every zombie near you loses its legs.' },
      deadOfNuclearWinter: { name: 'Dead of Nuclear Winter', tier: 'mega', kind: 'activated', uses: 1, drop: 'pressureCooker', desc: 'Drops a Pressure Cooker.' },
      disorderlyCombat: { name: 'Disorderly Combat', tier: 'mega', kind: 'timed', time: 300, every: 10, desc: 'A random gun in your hands every 10 seconds; yours back after. Lasts 5 minutes.' },
      ephemeralEnhancement: { name: 'Ephemeral Enhancement', tier: 'mega', kind: 'activated', uses: 2, window: 60, desc: 'The gun in your hands is Mad Dog\'d for 60 seconds. 2 uses.' },
      headDrama: { name: 'Head Drama', tier: 'mega', kind: 'rounds', rounds: 1, desc: 'Every bullet that hits a zombie hits it in the head. Lasts the rest of the round.' },
      imFeelinLucky: { name: 'I\'m Feelin\' Lucky', tier: 'mega', kind: 'activated', uses: 2, drop: 'random', desc: 'Drops a random power-up. 2 uses.' },
      immolationLiquidation: { name: 'Immolation Liquidation', tier: 'mega', kind: 'activated', uses: 3, drop: 'clearanceSale', desc: 'Drops a Clearance Sale. 3 uses.' },
      licensedContractor: { name: 'Licensed Contractor', tier: 'mega', kind: 'activated', uses: 3, drop: 'shopClass', desc: 'Drops a Shop Class. 3 uses.' },
      mindBlown: { name: 'Mind Blown', tier: 'mega', kind: 'activated', uses: 3, range: 40, desc: 'Pops the head off every zombie you can see. 3 uses.' },
      nowhereButThere: { name: 'Nowhere But There', tier: 'mega', kind: 'activated', uses: 2, desc: 'Teleport to a downed teammate. 2 uses.' },
      popShocks: { name: 'Pop Shocks', tier: 'mega', kind: 'special', uses: 5, radius: 4, desc: 'Your knife hits set off a shock that fries every zombie near the one you hit. 5 hits.' },
      powerVacuum: { name: 'Power Vacuum', tier: 'mega', kind: 'rounds', rounds: 1, chanceMult: 5, desc: 'Power-ups drop much more often. Lasts the rest of the round.' },
      respinCycle: { name: 'Respin Cycle', tier: 'mega', kind: 'activated', uses: 3, desc: 'The Mystery Box offering you a gun spins again. 3 uses.' },
      slaughterSlide: { name: 'Slaughter Slide', tier: 'mega', kind: 'special', uses: 6, explosion: 'gumSlide', side: 1.2, desc: 'Dolphin dive and two lethal blasts go off either side of you as you land. 6 dives.' },
      temporalGift: { name: 'Temporal Gift', tier: 'mega', kind: 'rounds', rounds: 1, durationMult: 2, desc: 'Power-ups last twice as long. Lasts the rest of the round.' },
      unbearable: { name: 'Unbearable', tier: 'mega', kind: 'special', uses: 1, desc: 'When Erik\'s bobblehead comes out of the Mystery Box for you, it spins again and the box stays put.' },
      wallPower: { name: 'Wall Power', tier: 'mega', kind: 'special', uses: 1, desc: 'The next gun you buy off a wall comes Mad Dog\'d.' },
      whosKeepingScore: { name: 'Who\'s Keeping Score?', tier: 'mega', kind: 'activated', uses: 2, drop: 'doubleDough', desc: 'Drops a Double Dough. 2 uses.' },
      // --- Rare Megas
      cacheBack: { name: 'Cache Back', tier: 'rare', kind: 'activated', uses: 1, drop: 'fullPantry', desc: 'Drops a Full Pantry.' },
      extraCredit: { name: 'Extra Credit', tier: 'rare', kind: 'activated', uses: 4, drop: 'extraCredit', desc: 'Drops a personal power-up worth 1250 points. 4 uses.' },
      fatalContraption: { name: 'Fatal Contraption', tier: 'rare', kind: 'activated', uses: 2, drop: 'deathMachine', desc: 'Drops a Death Machine. 2 uses.' },
      fearInHeadlights: { name: 'Fear in Headlights', tier: 'rare', kind: 'timed', time: 120, every: 0.2, dot: 0.6, range: 45, desc: 'Zombies anyone\'s looking at can\'t move. Lasts 2 minutes.' },
      idleEyes: { name: 'Idle Eyes', tier: 'rare', kind: 'activated', uses: 3, window: 30, desc: 'Every zombie ignores everybody for 30 seconds. 3 uses.' },
      killJoy: { name: 'Kill Joy', tier: 'rare', kind: 'activated', uses: 2, drop: 'oneBite', desc: 'Drops a One Bite. 2 uses.' },
      killingTime: { name: 'Killing Time', tier: 'rare', kind: 'activated', uses: 1, window: 20, desc: 'Every zombie freezes for 20 seconds; the ones you shoot blow up when it\'s over.' },
      nearDeathExperience: { name: 'Near Death Experience', tier: 'rare', kind: 'rounds', rounds: 3, range: 2.5, time: 0.6, desc: 'Revive, or be revived, just by being near each other. Lasts 3 rounds.' },
      phoenixUp: { name: 'Phoenix Up', tier: 'rare', kind: 'activated', uses: 1, desc: 'Revives every downed teammate, and they keep their perks.' },
      profitSharing: { name: 'Profit Sharing', tier: 'rare', kind: 'timed', time: 600, range: 12, desc: 'Points you earn go to everyone near you too, and theirs to you. Lasts 10 minutes.' },
      roundRobbin: { name: 'Round Robbin\'', tier: 'rare', kind: 'activated', uses: 1, points: 1600, desc: 'Ends the round; everyone gets 1600 points.' },
      secretShopper: { name: 'Secret Shopper', tier: 'rare', kind: 'timed', time: 600, desc: 'Any wall gun sells you ammo for the gun in your hands. Lasts 10 minutes.' },
      selfMedication: { name: 'Self Medication', tier: 'rare', kind: 'special', uses: 3, desc: 'Down? Kill a zombie and you get yourself back up, with your perks. 3 uses (and you get a last stand on your own).' },
      shoppingFree: { name: 'Shopping Free', tier: 'rare', kind: 'timed', time: 60, desc: 'Everything you buy is free. Lasts 60 seconds.' },
      sodaFountain: { name: 'Soda Fountain', tier: 'rare', kind: 'special', uses: 5, desc: 'Buy a perk, get another random one with it (past the limit). 5 perks.' },
      undeadManWalking: { name: 'Undead Man Walking', tier: 'rare', kind: 'timed', time: 240, speed: 1.0, desc: 'Every zombie slows to a shamble. Lasts 4 minutes.' },
      unquenchable: { name: 'Unquenchable', tier: 'rare', kind: 'activated', uses: 1, desc: 'You can hold one more perk.' },
      // --- Ultra-Rare Megas
      flavorHexed: { name: 'Flavor Hexed', tier: 'ultra', kind: 'activated', uses: 1, desc: 'Take a chance on a random Mega that isn\'t in your pack.' },
      onTheHouse: { name: 'On the House', tier: 'ultra', kind: 'activated', uses: 1, desc: 'A free random perk (past the limit).' },
      perkaholic: { name: 'Perkaholic', tier: 'ultra', kind: 'activated', uses: 1, desc: 'Every perk on the map.' },
      reignDrops: { name: 'Reign Drops', tier: 'ultra', kind: 'activated', uses: 2, spread: 2.2, desc: 'Drops one of every power-up. 2 uses.' },
    },
  },

  // Alternate ammo (a Mad Dog'd gun's bite): every upgraded gun has one, picked
  // at random as it comes out (and again if you pay to feed it back in). A hit
  // has `chance` of setting it off; then that gun's bite rests for `cooldown` s.
  aat: {
    chance: 0.15, cooldown: 5, rerollCost: 2500,
    types: {
      blastFurnace: { name: 'Blast Furnace', color: '#ff6a1a', radius: 4, burnKill: 3 },
      deadWire: { name: 'Dead Wire', color: '#5ad1ff', chains: 5, hop: 6 },
      thunderWall: { name: 'Thunder Wall', color: '#c8f0ff', range: 8, angle: 40, dist: 9, up: 3 },
    },
  },

  // The title screen (and the menus behind it): the map it shows, and the camera
  // drifting round it there: a slow circle (radius m, height m over center,
  // speed rad/s) round `center`, looking at `look` (+ a slow bob of `bob` m).
  title: {
    map: 'crust',
    cam: { center: [0, 0, 0], radius: 62, height: 30, speed: 0.022, look: [0, 7, 0], bob: 1.5, fov: 55 },
  },

  box: {
    cost: 950,
    spinTime: 4.2,             // how long it cycles before landing
    offerTime: 12,             // how long you have to take the weapon
    closeTime: 1.2,
    // Relative odds. Wall weapons can also come out of the box.
    // Relative odds for each weapon. Wall weapons can come out of the box too.
    weights: {
      M15: 0.6, Olympus: 0.6, MP41: 0.6, Staykout: 0.6, MP6K: 0.6, MPK: 0.6, PM64: 0.6, 'AK-75u': 0.6, M17: 0.6,
      Pyton: 1.2, CZ76: 0.9, 'CZ76 Dual': 0.8, Spectur: 1.1, Komando: 1.1, FAMOS: 1.1, AWG: 1, Galill: 0.9, G12: 1,
      'SPAZ-13': 1, HS11: 0.9, HK22: 0.9, RPKK: 0.9, Dragunoff: 0.9, L97A1: 0.8, 'China Pond': 0.9,
      'Kross-Bow': 0.9, 'Ballistik Knife': 0.6,
      'Fucci Gun': 0.5, 'The Chopper': 0.45, stewBomb: 0.7, maisyDog: 0.55,
      'Desert Eagle': 1, 'SCAR-H': 1, M60: 0.9, Scavenger: 0.4, 'Fucci Gun Mk 2': 0.45, Peacekeeper: 0.6, 'M2 Flamethrower': 0.6,
    },
    // The box leaves after this many pulls (random in the range): the last pull
    // is Erik's bobblehead, you get your points back, and it flies off to
    // another spot.
    moveAfter: [5, 9],
    firstMoveMin: 4,         // never leaves before this many pulls in a spot
    leaveTime: 5,            // seconds the bobblehead taunts you before it goes
    arriveTime: 2.5,
  },

  // ---------------------------------------------------------------------------
  // Grenades and explosions
  // ---------------------------------------------------------------------------
  equipment: {
    frag: {
      name: 'Frag Grenades',
      cost: 250,             // wall buy: fills you to `perPurchase` and raises your refill to it
      perPurchase: 4,
      startWith: 2,          // everyone spawns with this many
      refillEachRound: true, // topped back up at the start of every round
      fuse: 3.0,             // seconds after pulling the pin (hold G to cook)
      minCook: 0.15,
      throwSpeed: 15,
      throwUp: 3.2,          // extra upward speed
      gravity: 16,
      bounce: 0.35,          // energy kept on a bounce
      friction: 0.6,
      throwLock: 0.45,       // can't fire this long after a throw
      explode: 'frag',
      have: 'grenades', max: 'grenadeMax',   // (the player's count of them, and what it refills to)
    },
    // Stew Bombs (from the Mystery Box, [Q]): a pot of stew with a ladle that
    // bangs out a tune. Every zombie nearby comes to it, then it blows.
    stewBomb: {
      name: 'Stew Bombs',
      perPurchase: 3,
      lureTime: 7,           // seconds it draws zombies before exploding
      lureRadius: 32,        // zombies within this many metres come running
      throwSpeed: 13,
      throwUp: 3.4,
      gravity: 16,
      bounce: 0.2,
      friction: 0.5,
      explode: 'stewBomb',
    },
    // The Maisy Dog (from the Mystery Box, [Q], in place of Stew Bombs): a
    // little black sausage dog you throw. It lands, howls, and a black hole
    // opens over it: every zombie round it is dragged in and gone. Then the
    // hole takes the dog too.
    maisyDog: {
      name: 'Maisy Dogs',
      perPurchase: 3,
      throwSpeed: 12,
      throwUp: 3.4,
      gravity: 16,
      bounce: 0.25,
      friction: 0.5,
      armTime: 1.1,          // s from landing to the hole opening (she howls)
      holeTime: 6.5,         // s the hole stays open
      pullRadius: 11,        // m: zombies inside this are dragged in
      pullSpeed: [2.2, 8],   // m/s at the edge, and right by the hole
      killRadius: 1.3,       // m from the hole: gone
      maxKills: 48,          // per dog
      // dolphin dive into the hole and it spits you out somewhere else on the map
      // (Ascension's Gersh device): within radius m of it; invuln s safe once you land
      diveWarp: { radius: 2.4, invuln: 2 },
      holeY: 1.1,            // m: the hole hangs this high over her
    },
    // The LBD (wall buy, [X]): a sleeping baby you set down like a Bouncing
    // Betty. A zombie comes close, it wakes, pops up into the air and goes off.
    // You carry `perPurchase` and get them back every round.
    lbd: {
      name: 'LBDs',
      cost: 1000,
      perPurchase: 2,
      have: 'lbds', max: 'lbdMax',
      plantAt: 0.9,          // m in front of you it's set down
      plantLock: 0.6,        // s your hands are busy setting it down
      armTime: 1.2,          // s before it's live
      trigger: 2.4,          // m: a zombie this close sets it off
      popTime: 0.42,         // s from waking to the blast
      popHeight: 1.1,        // m it jumps
      maxPlaced: 12,         // per player: an older one goes when you set down more
      explode: 'lbd',
    },
  },

  // Explosion types: radius (m), damage at the center to zombies, and
  // selfDamage = damage to the player who caused it if they're at the center.
  explosions: {
    frag: { radius: 4.5, damage: 1100, selfDamage: 120, minFrac: 0.15, shake: 1.0 },
    gumSlide: { radius: 3.2, damage: 1e6, selfDamage: 0, minFrac: 1, shake: 0.6 },   // (Slaughter Slide: either side of your dive)
    shell: { radius: 4.5, damage: 900, selfDamage: 0, minFrac: 0.2, shake: 0.8 },   // (the Trench Front's guns)
    launcher: { radius: 3.6, damage: 1300, selfDamage: 80, minFrac: 0.2, shake: 0.9 },
    bolt: { radius: 2.8, damage: 1000, selfDamage: 60, minFrac: 0.2, shake: 0.6 },
    cookedOff: { radius: 4.5, damage: 1100, selfDamage: 160, minFrac: 0.15, shake: 1.2 },
    // Mad Dog upgrades
    stewpot: { radius: 2.2, damage: 650, selfDamage: 18, minFrac: 0.35, shake: 0.2, small: true },
    launcherUp: { radius: 5.2, damage: 4200, selfDamage: 80, minFrac: 0.25, shake: 1.2 },
    boltUp: { radius: 4.2, damage: 3600, selfDamage: 60, minFrac: 0.25, shake: 0.9 },
    fucci: { radius: 2.4, damage: 500, selfDamage: 22, minFrac: 0.35, shake: 0.15, energy: '#ffcf4a' },
    fucciUp: { radius: 3.0, damage: 1600, selfDamage: 22, minFrac: 0.35, shake: 0.2, energy: '#ff2fa0' },
    stewBomb: { radius: 5.5, damage: 3200, selfDamage: 50, minFrac: 0.3, shake: 1.0 },
    lbd: { radius: 5.2, damage: 4200, selfDamage: 0, minFrac: 0.35, shake: 0.9 },
    // PHD Gaylor's dolphin dive (off something high: the big one)
    phd: { radius: 4, damage: 3000, selfDamage: 0, minFrac: 0.5, shake: 0.7, energy: '#b04dff' },
    phdHigh: { radius: 6.5, damage: 6000, selfDamage: 0, minFrac: 0.35, shake: 1.3, energy: '#c870ff' },
    // the Fire Hammer's burst (and Pit's tempered one)
    hammerFire: { radius: 4.5, damage: 1e5, selfDamage: 0, minFrac: 1, shake: 0.9, energy: '#ff6a1a' },
    hammerFireUp: { radius: 6.5, damage: 1e5, selfDamage: 0, minFrac: 1, shake: 1.2, energy: '#ffb02a' },
    // the Scavenger's bolts (and its Mad Dog version's): they hurt you too, up close
    scav: { radius: 6, damage: 6000, selfDamage: 90, minFrac: 0.35, shake: 1.4 },
    scavUp: { radius: 8.5, damage: 16000, selfDamage: 90, minFrac: 0.35, shake: 1.7 },
    eagleUp: { radius: 2.4, damage: 900, selfDamage: 15, minFrac: 0.35, shake: 0.25, small: true },
    sniperUp: { radius: 3, damage: 2400, selfDamage: 20, minFrac: 0.35, shake: 0.35, small: true },
  },

  // ---------------------------------------------------------------------------
  // Power (boiler room)
  // ---------------------------------------------------------------------------
  power: {
    startsOn: false,
  },

  // ---------------------------------------------------------------------------
  // Electric traps (need power). Lever on one side of a doorway.
  // ---------------------------------------------------------------------------
  traps: {
    cost: 1000,
    activeTime: 25,          // seconds of electricity
    cooldown: 35,            // seconds before it can be bought again
    playerDps: 70,           // health per second to a player standing in it
    killPoints: 0,           // classic: trap kills give no points
  },

  // ---------------------------------------------------------------------------
  // Perk machines. `power: false` = works before the power is on.
  // ---------------------------------------------------------------------------
  perks: {
    limit: 4,                // how many perks one player can hold
    drinkTime: 2.1,          // can't shoot while drinking
    list: {
      secondHelping: {
        name: 'Second Helping', cost: 500, coopCost: 1500, color: '#3fa9f5', power: false, glyph: '+',
        desc: 'Solo: get back up on your own when you go down (3 uses). Co-op: revive teammates twice as fast.',
        soloUses: 3, selfReviveTime: 5, reviveMult: 0.5,
      },
      beefcakeBroth: {
        name: 'Beefcake Broth', cost: 2500, color: '#d0312d', power: true, glyph: 'B',
        desc: 'Thicker skin: 250 health instead of 100.', maxHealth: 250,
      },
      hotPotHustle: {
        name: 'Hot Pot Hustle', cost: 3000, color: '#2fbf71', power: true, glyph: 'H',
        desc: 'Reload twice as fast.', reloadMult: 0.5,
      },
      doubleLadle: {
        name: 'Double Ladle', cost: 2000, color: '#f2b705', power: true, glyph: '2',
        desc: 'Fire 33% faster, and every bullet hits twice as hard.', fireRateMult: 1.33, damageMult: 2,
      },
      phdGaylor: {
        name: 'PHD Gaylor', cost: 2000, color: '#9b4dff', power: true, glyph: 'P',
        desc: 'Your own explosions and falls can\'t hurt you, and a dolphin dive off a ledge lands with a purple blast (the higher, the bigger).',
        noSelfBlast: true, noFall: true, diveBlast: 'phd', diveBlastHigh: 'phdHigh', minDrop: 0.7, highDrop: 2.5,
      },
      marathonMinestrone: {
        name: 'Marathon Minestrone', cost: 2000, color: '#e8742c', power: true, glyph: 'M',
        desc: 'Sprint almost forever and move a little faster.', sprintMult: 3, speedMult: 1.07,
      },
      miltonKick: {
        name: 'Milton Kick', cost: 4000, color: '#3fdc5a', power: true, glyph: 'K',
        desc: 'Carry a third weapon. Go down and you lose it (the one in the third slot).',
        extraSlots: 1,
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Mad Dog Machine (upgrades your weapon; needs power)
  // ---------------------------------------------------------------------------
  madDog: {
    cost: 5000,
    workTime: 4.2,           // seconds the machine chews on your gun
    ammoCost: 4500,          // buying ammo for an upgraded gun off the wall
    // defaults for every upgrade (each weapon's `upgrade` entry can override)
    damageMult: 2,
    magMult: 1.5,
    reserveMult: 2,
    reloadMult: 0.9,
    penetrationAdd: 1,
  },

  // ---------------------------------------------------------------------------
  // Power-ups: dropped by zombies you kill inside the map. A drop happens when
  // the team's earned points pass the next threshold (each threshold is a bit
  // further away), plus a small random chance, up to `maxPerRound`.
  // ---------------------------------------------------------------------------
  powerups: {
    maxPerRound: 4,
    firstThreshold: 2000,
    thresholdGrowth: 1.14,
    randomChance: 0.02,
    life: 30,                // seconds a drop sits there before vanishing
    blinkAt: 8,              // starts blinking with this many seconds left
    pickupRange: 1.3,
    duration: 30,            // timed power-ups (One Bite, Double Dough, Clearance Sale)
    list: {
      fullPantry: { name: 'Full Pantry', desc: 'all ammo and grenades refilled', weight: 1, color: '#7cff7a' },
      oneBite: { name: 'One Bite', desc: 'everything dies in one hit', weight: 1, color: '#ff4a3a', timed: true },
      doubleDough: { name: 'Double Dough', desc: 'double points', weight: 1, color: '#ffd23a', timed: true },
      pressureCooker: { name: 'Pressure Cooker', desc: 'every zombie on the map is gone', weight: 0.7, color: '#ff8a1a', points: 400 },
      shopClass: { name: 'Shop Class', desc: 'every barrier rebuilt', weight: 0.6, color: '#c8a46a', points: 200 },
      clearanceSale: { name: 'Clearance Sale', desc: 'the Mystery Box costs 10', weight: 0.5, color: '#ff4fd8', timed: true, boxCost: 10 },
      // (GobbleGum only: never dropped by a zombie. personal: only the one who
      // chewed it can pick it up)
      extraCredit: { name: 'Extra Credit', desc: '1250 points, all yours', weight: 0, color: '#6affc8', gumOnly: true, personal: true, points: 1250 },
      deathMachine: { name: 'Death Machine', desc: 'a minigun that never runs dry', weight: 0, color: '#c8c8c8', gumOnly: true, weapon: 'Death Machine', time: 30 },
    },
  },

  // The jukebox in the Teachers' Lounge (assets/music/).
  jukebox: {
    songs: [
      { name: 'We Go Stewie', file: 'we_go_stewie', duration: 164.0 },
      { name: "That's That Marmaduke", file: 'thats_that_marmaduke', duration: 103.7 },
    ],
  },

  // The boiler room cauldron Easter egg (see src/sim/cauldron.js).
  cauldron: {
    points: 1000,            // to everyone still alive when it boils over
    powerup: 'doubleDough',
  },

  // ---------------------------------------------------------------------------
  // Cheddar Rounds: every few rounds a yellow haze rolls in and Erik's rabid
  // hounds ("Cheddars") come down with the lightning instead of zombies.
  // The last one killed leaves a Full Pantry behind.
  // ---------------------------------------------------------------------------
  cheddar: {
    firstRound: [5, 7],      // the first one lands on one of these rounds
    every: [4, 6],           // then again this many rounds later
    perPlayer: 6,            // hounds per player on the first Cheddar Round...
    addPerRound: 2,          // ...plus this many more each Cheddar Round after
    maxCount: 32,
    maxAlive: 8,
    health: [400, 900, 1600, 2200], // by Cheddar Round number (last value repeats +600)
    speed: [4.2, 4.9],       // a little slower than they were (5.2-6.0) so you can see them coming
    spawnInterval: [0.9, 1.8],
    spawnDist: [7, 15],      // lightning strikes this far from a player
    spawnTime: 0.9,          // seconds from the strike until it attacks
    radius: 0.38,
    height: 0.95,
    turnRate: 9,
    accel: 16,
    // A bite is a visible lunge: the hound stops short, coils back with its jaws open
    // (the windup), then springs at you. The bite only lands when the spring ends.
    attackRange: 1.6,
    attackHitRange: 1.9,
    attackWindup: 0.6,
    attackRecover: 0.6,
    attackDamage: 35,
    haze: 0.32,              // strength of the yellow screen tint
    preRoundTime: 4,         // haze and thunder before the first strike
    line: 'Wanna play 2K?',  // what they snarl at you (the subtitle / speech bubble)
    // A recording of the line. Drop an .mp3 at this path (in the project folder)
    // and the Cheddars use it instead of the built-in growl-voice. Until the
    // file is there, they keep the built-in voice.
    lineAudio: 'assets/voice/cheddar/wanna-play-2k.mp3',
    lineAudioGain: 1.0,      // louder/quieter for your recording
    lineAudioPitch: 1.0,     // < 1 makes it deeper and slower (0.85 = growlier), > 1 higher
    lineAudioGrowl: true,    // keep a bit of the throat-rattle growl under your recording
    talkEvery: [3.5, 7],     // seconds between one of them saying it
    talkRange: 14,           // only ones this close to a player talk
  },

  // ---------------------------------------------------------------------------
  // Career stats and achievements, saved per username (src/career/career.js)
  // ---------------------------------------------------------------------------
  career: {
    // The Firebase Realtime Database that keeps everyone's careers online, e.g.
    // 'https://stew-zombies-default-rtdb.firebaseio.com'. Empty: careers are
    // saved in each browser only.
    firebaseUrl: 'https://stew-zombies-default-rtdb.firebaseio.com',
    // The project's Web API key (Firebase console: Project settings > General).
    // With it, every username gets a 4-digit PIN (src/career/auth.js); empty:
    // no PINs, a username is just a name.
    firebaseApiKey: 'AIzaSyBWcSZYw4ggten1rslVhvi89zxEoBgZgvs',
    flushEvery: 15,          // seconds between saves during a game
    timeout: 6,              // give up on the database after this long (and save locally)
  },

  // ---------------------------------------------------------------------------
  // Call of the Crust (Map 2): numbers for the battlefield
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // The Call of the Crust trailer (src/render/trailer.js, src/ui/trailerUI.js):
  // Main menu > Watch Trailer. Everything before the drop is timed in seconds
  // (`at`, `len`); everything after it in beats from the drop (`beat`,
  // `beats`), so moving `drop` moves the whole second half with it.
  // Shots run back to back: each lasts until the next one starts.
  // ---------------------------------------------------------------------------
  trailer: {
    song: 'assets/music/design_in_malice.mp3',
    songWait: 8,             // s to wait for the song to load before running without it
    touchPreset: 'medium',   // the graphics on a phone or tablet (a computer gets ultra)
    drop: 20.18,             // s: where the beat drops in the song (trailerDropTime)
    bpm: 90,                 // the song's tempo after the drop (a beat = 60 / bpm s)
    fadeOut: [58, 60],       // s: the music fades out over this
    end: 60.5,               // s: the trailer's over
    fps: 30,                 // frames a second for a recorded export
    letterbox: 2.39,         // the picture's shape between the bars (2.39:1)
    exposure: 1.8,           // brighter than in play: it's lit like a film
    // the perk machines it shows off (rename them to the real ones when they're in)
    perks: [
      { key: 'trailerPerk1', name: 'PHD Gaylor', color: '#9b4dff', glyph: 'P' },
      { key: 'trailerPerk2', name: 'Milton Kick', color: '#3fdc5a', glyph: 'M' },
    ],
    // the guns in the "7 NEW GUNS" montage, and who fires each
    guns: [['Komando', 'ryan'], ['SPAZ-13', 'brian'], ['HK22', 'kearns'], ['Dragunoff', 'rocco'], ['Galill', 'rocco'], ['AK-75u', 'ryan'], ['L97A1', 'brian']],
    // everyone's gun when they're just fighting
    loadout: { rocco: 'Fucci Gun', brian: 'AK-75u', ryan: 'M17', kearns: 'M15' },
    // the launcher shot: the camera low at the pad's base (offset from the pad),
    // then craning up after Rocco (offset from him) over catchUp of the shot; it
    // drifts to look `ahead` (down, forward) of him as he goes; fov from, to;
    // light: the key light that goes up with him
    launchCam: { base: [2.4, 0.45, 3.3], chase: [1.1, 0.35, 3.0], catchUp: 0.16, ahead: [3, 10], fov: [50, 58], light: 2.2 },
    // where Zach roars and swings on the Research Base's helipad (x, z): clear of
    // the launcher and its power switch
    zachRoarAt: [117, 14.5],
    zachSwingAt: [116, 17],
    // the shots, in order (ids: see SHOTS in src/render/trailer.js)
    shots: [
      { id: 'black', at: 0 },
      { id: 'space', at: 1.0 },
      { id: 'black', at: 5.2 },
      { id: 'zachReveal', at: 7.8 },
      { id: 'black', at: 11.2 },
      { id: 'basePan', at: 13.0 },
      { id: 'black', at: 15.4 },
      { id: 'squadFog', at: 17.0 },
      { id: 'black', at: 18.9 },
      // ---- the drop ----
      { id: 'hubFly', beat: 0 },
      { id: 'roccoHero', beat: 4 },
      { id: 'diveBlast', beat: 7 },
      { id: 'gunMontage', beat: 10 },
      { id: 'flamer', beat: 13 },
      { id: 'titans', beat: 16 },
      { id: 'zipline', beat: 20 },
      { id: 'launchPad', beat: 22 },
      { id: 'perks', beat: 25 },
      { id: 'zachRoar', beat: 27 },
      { id: 'maisy', beat: 28.5 },
      { id: 'lbd', beat: 31 },
      { id: 'pitForge', beat: 33 },
      { id: 'hammers', beat: 35 },
      { id: 'zachStomp', beat: 39 },
      { id: 'kearnsHero', beat: 41 },
      { id: 'brianHero', beat: 44 },
      { id: 'zachSwing', beat: 47 },
      { id: 'finale', beat: 49 },
      { id: 'black', beat: 55 },
    ],
    // the words on screen. style: card (on black, fades), slam (on black, punches
    // in), overlay (slams over the action), name (a hero's name, beside them),
    // title (the last cards)
    cards: [
      { text: 'The Schnitz has taken possession of Crust.', style: 'card', at: 5.4, len: 2.2 },
      { text: 'To save him, and everyone else...', style: 'card', at: 11.3, len: 1.6 },
      { text: '...someone will have to make the ultimate sacrifice.', style: 'card', at: 15.5, len: 1.45 },
      { text: 'DOLPHIN DIVE', sub: 'WITH PHD GAYLOR', style: 'overlay', beat: 7, beats: 3 },
      { text: '7 NEW GUNS', style: 'overlay', beat: 10, beats: 3 },
      { text: 'M2 FLAMETHROWER', style: 'overlay', beat: 13, beats: 3 },
      { text: '4 TITANS', style: 'overlay', beat: 16, beats: 4 },
      { text: '2 NEW PERK MACHINES', style: 'overlay', beat: 25, beats: 2 },
      { text: '2 NEW EXPLOSIVES', sub: 'MAISY DOG · LBD', style: 'overlay', beat: 28.5, beats: 4.5 },
      { text: '4 WAR HAMMERS', sub: 'WITH ELEMENTAL UPGRADES', style: 'overlay', beat: 35, beats: 4 },
      { text: 'CALL OF THE CRUST', style: 'title', beat: 56, beats: 2 },
      { text: 'DROPPING THIS SATURDAY', style: 'title', beat: 58, beats: 1.9 },
    ],
  },

  // Call of the Crust's cutscenes (src/render/crustFilms.js): when each shot
  // starts (s), the words (who says what, when), sound cues and title cards.
  // A null in loadout: empty-handed.
  crustFilms: {
    intro: {
      end: 82.6, letterbox: 2.2,
      shots: [
        { id: 'black', at: 0 }, { id: 'arrive', at: 1.2 }, { id: 'getup', at: 8 }, { id: 'pit', at: 15.5 },
        { id: 'cage', at: 25 }, { id: 'schnitz', at: 33 }, { id: 'zach', at: 44 },
        { id: 'tour_ship', at: 48.5 }, { id: 'tour_research', at: 53 }, { id: 'tour_trench', at: 57.5 }, { id: 'tour_caves', at: 62 },
        { id: 'relays', at: 66.5 }, { id: 'plan', at: 72.5 }, { id: 'black', at: 79.6 },
      ],
      cards: [
        { text: 'Somewhere past the edge of everything', style: 'card', at: 0.1, len: 1.1 },
        { text: 'CALL OF THE CRUST', style: 'title', at: 79.7, len: 2.8 },
      ],
      cues: [{ at: 2, name: 'portal' }, { at: 34.5, name: 'schnitzEyes' }, { at: 45.6, name: 'roar' }],
      lines: [
        { at: 8.6, who: 'rocco', text: 'Well well well... where are we now?', dur: 2.2 },
        { at: 11.2, who: 'ryan', text: 'Space, boys. We\'re in space. Again.', dur: 2.2 },
        { at: 13.6, who: 'kearns', text: 'Of course we are.', dur: 1.5 },
        { at: 15.9, who: 'pit', text: 'Yo. Yo yo yo. You made it, man.', dur: 2.2 },
        { at: 18.4, who: 'kearns', text: 'Pit?! How are you even here?', dur: 2 },
        { at: 20.8, who: 'pit', text: 'Got here first, man. This rock\'s the Anvil. Been here a while.', dur: 3 },
        { at: 23.9, who: 'pit', text: 'I\'m a blacksmith now.', dur: 1.4 },
        { at: 25.6, who: 'chops', text: 'GUYS! UP HERE!', dur: 1.6 },
        { at: 27.6, who: 'regs', text: 'Get us down, man! It\'s really high!', dur: 2.2 },
        { at: 30.4, who: 'p', text: '...Sup.', dur: 1.2 },
        { at: 33.6, who: 'schnitz', text: 'You beat my Erik. Now you\'re in my house. Five islands. All mine.', dur: 3.3 },
        { at: 37, who: 'schnitz', text: 'Your Zach is mine. And these three... are mine.', dur: 3.2 },
        { at: 40.6, who: 'schnitz', text: 'The cage opens for one price. One of you goes over the edge. For all of them.', dur: 3.4 },
        { at: 45, who: 'schnitz', text: 'Come and take him back.', dur: 2 },
        { at: 48.9, who: 'pit', text: 'North\'s the Ship Graveyard. Wrecks, a lighthouse... and the Captain, asleep past the cliffs.', dur: 3.9 },
        { at: 53.3, who: 'pit', text: 'East, the Research Base. Everything sparks. And there\'s a robot. A big one.', dur: 3.6 },
        { at: 57.8, who: 'pit', text: 'South\'s the Trench Front. It\'s on fire, man. It\'s always on fire.', dur: 3.1 },
        { at: 61.0, who: 'kearns', text: 'Great.', dur: 0.8 },
        { at: 62.3, who: 'pit', text: 'West, the Ice Caves. There\'s a golem up top. Cold golem.', dur: 3.4 },
        { at: 66.8, who: 'pit', text: 'Only thing is... the power\'s out. Every launcher up on the rim blew a relay.', dur: 3.6 },
        { at: 70.6, who: 'ryan', text: 'So we pull \'em. You fix \'em.', dur: 1.6 },
        { at: 72.8, who: 'pit', text: 'Then the War Hammer. Four pieces, one on every island. Bring \'em to the stand.', dur: 3.6 },
        { at: 76.6, who: 'rocco', text: 'And then we hit the titans with hammers?', dur: 1.7 },
        { at: 78.4, who: 'brian', text: 'Then let\'s go.', dur: 1.1 },
      ],
      loadout: { kearns: 'M15', ryan: 'M17', rocco: 'Fucci Gun', brian: 'AK-75u' },
      crew: ['kearns', 'ryan', 'rocco', 'brian'],
    },
    ending: {
      end: 62, letterbox: 2.2,
      shots: [
        { id: 'freed', at: 0 }, { id: 'deal', at: 8 }, { id: 'step', at: 16.5 }, { id: 'push', at: 22 },
        { id: 'cheer', at: 29 }, { id: 'release', at: 36 }, { id: 'portal', at: 46 }, { id: 'black', at: 55.5 },
      ],
      cards: [
        { text: 'Where they ended up, nobody knows.', style: 'card', at: 55.7, len: 3 },
        { text: 'TO BE CONTINUED', style: 'title', at: 58.9, len: 3 },
      ],
      cues: [{ at: 2.2, name: 'tear' }, { at: 23.5, name: 'scream' }, { at: 37, name: 'chain' }, { at: 43, name: 'cageDoor' }],
      lines: [
        { at: 1, who: 'schnitz', text: 'Fine. Keep him.', dur: 1.6 },
        { at: 4.8, who: 'zach', text: '...Guys? Why\'s everybody holding hammers?', dur: 2.6 },
        { at: 8.5, who: 'schnitz', text: 'But a deal is a deal. One of you goes over the edge...', dur: 3 },
        { at: 11.8, who: 'schnitz', text: '...or they hang there forever.', dur: 2 },
        { at: 14.4, who: 'ryan', text: 'So... who\'s it gonna be?', dur: 1.8 },
        { at: 17.2, who: 'rocco', text: 'Well well well. It\'s a long way do—', dur: 2.6 },
        { at: 23.6, who: 'rocco', text: 'WAAAAAAAAH!', dur: 2.4 },
        { at: 31.3, who: 'ryan', text: 'STRONG MAN!', dur: 1.2 },
        { at: 32.6, who: 'pit', text: '(whinnies) ...sorry. Habit.', dur: 1.8 },
        { at: 34.4, who: 'kearns', text: 'Problem solved.', dur: 1.3 },
        { at: 36.4, who: 'schnitz', text: '...That works.', dur: 1.6 },
        { at: 40.4, who: 'regs', text: 'We\'re coming down! We\'re coming down!', dur: 1.8 },
        { at: 44.2, who: 'chops', text: 'Was that Rocco?', dur: 1.5 },
        { at: 45.8, who: 'kearns', text: 'Was who?', dur: 1 },
        { at: 47.2, who: 'zach', text: 'I\'m so happy to be here. Where\'s here?', dur: 2.2 },
        { at: 49.8, who: 'pit', text: 'Bye, Anvil. Bye, forge. I\'m gonna miss you, man.', dur: 2.6 },
        { at: 52.8, who: 'ryan', text: 'Maisy... daddy\'s coming home. Probably.', dur: 2.3 },
      ],
      loadout: { kearns: null, ryan: null, rocco: null, brian: null, zach: null, pit: null, chops: null, regs: null, p: null },
      crew: ['kearns', 'ryan', 'rocco', 'brian', 'zach', 'pit', 'chops', 'regs', 'p'],
    },
  },

  // How fire looks (src/render/flameFx.js): the flamethrower's stream and
  // anything alight
  flameLook: {
    maxPoints: 900,
    stream: { perShot: 30, spread: 0.13, size: 0.85, lead: 0.1, rise: 1.6, drag: 1.2 },
    burn: { rate: 55, size: 0.6, life: 0.6 },   // per burning zombie: points a second
    char: 0.25,              // a zombie burnt to death: its color times this
  },

  // How the Maisy Dog and the LBD look (src/render/gadgetView.js)
  gadgetLook: {
    maisy: { model: 'assets/props/maisydog.glb', length: 0.5, inHand: 0.32, howl: 0.9 },
    lbd: { model: 'assets/props/lbd.glb', length: 0.42, inHand: 0.26, blink: 1.6 },
    hole: {
      color: '#8a4dff', color2: '#3fb8ff',
      core: 0.5, disk: 2.3,         // m: the black core's radius, the swirl's
      spin: 4.5,                    // the swirl turning (rad/s)
      open: 0.5, close: 0.35,       // s to open up, and to snap shut
      motes: 90, reach: 6,          // streaks a second pulled in, from up to this far
      shrink: 0.7,                  // s a swallowed zombie takes to vanish into it
    },
  },

  // Big Evil Zach: what The Schnitz made of Zach (src/render/evilZach.js)
  bigZach: {
    scale: 2.6,              // x a normal character's size
    eyeGlow: [0.45, 3.4, 0.6],   // the Schnitz eyes' colour (HDR: they burn)
    lightRange: 9,           // m: the green light they throw
  },
  crust: {
    islandZombies: 0.45,     // share of the zombies on an island that are its own kind (lab zombies, skeletons...)
    // the mist round each island's rim and under it (colours: ATMOS in src/render/crustThemes.js)
    mist: {
      spacing: 6,            // m between puffs along an island's edge
      out: [1, 9],           // m out from the edge
      size: [12, 24],        // m across a puff
      layers: 3,             // puffs stacked at each spot on the edge
      below: [-14, 3],       // m below/above the edge's ground a puff sits
      under: 26,             // puffs drifting under each island
      near: [5, 20],         // m: puffs fade out closer than this to you (no fog in your face)
      drift: 2.2,            // m a puff wanders
    },
    // guard rails (src/map/terrain.js) round each island's rim, over nothing
    rails: {
      rimOnly: true,         // the ledges on an island are open: dive off any of them (false: railed, but for the marked dive spots)
      drop: 1.3,             // m: a ledge higher than this gets a rail (with rimOnly: false)
      h: 1.1,                // m: the rail's height (more than you can jump)
      t: 0.14,               // m: its thickness, on the high side of the edge
      diveR: 2.2,            // m: the gap left in the rail at a dive spot (radius, with rimOnly: false)
    },
    mudSpeed: 0.6,           // walking speed in deep mud (x); duckboards don't slow you
    spawnRadius: 42,         // zombies only rise this close to someone...
    spawnMin: 7,             // ...but not right on top of them
    fogDensity: 0.0115,
    thunderEvery: [7, 16],   // s between distant thunderclaps
    artilleryEvery: [3, 9],  // s between far-off shells landing
    brightness: 1.35,        // exposure x on this map (it read too dark)
    boxBeam: { height: 220, width: 3.2, opacity: 0.5 },   // the Mystery Box's beam out here: tall, wide, bright (see it from any island)
    stackDrawDistance: 150,  // the distant stacks are drawn at most this far away (scaled to look right)
    // the guns over the Trench Front's open ground
    shelling: {
      firstDelay: 1.6,       // s up top before the first shell comes in
      every: [1.4, 2.4],     // s between shells while you stay up there
      warn: 1.0,             // s from the whistle to the bang
      lead: 0.6,             // how much they aim where you're going
      spread: 2.2,           // m off target
      radius: 4.5,           // m
      damage: 85,            // to a player at the middle of it
      ceasefireCost: 1500,   // the field telephone
      ceasefire: 90,         // s of quiet
      cooldown: 45,          // s after that before you can call again
    },
    voidY: -30,              // fall below this (off an island, into space) and you're gone
    // the egg: each island's titan guards its War Hammer core (src/sim/crustEgg.js)
    egg: {
      reward: 2500,          // points to everyone still in the game when a titan falls
      carrySlow: 0.92,       // walking speed while you carry a core, the clapper, the cutters
      pushDecay: 4,          // how fast a shove (a gust, a slam) dies away (1/s)
      wakeTime: { ship: 5, research: 3.5, caves: 3.5, trench: 4 },   // s from waking it to the fight
      dyingTime: 4.5,        // s it takes to go down
      leash: 20,             // s with nobody on its island before it goes back to sleep
      // stuck, or you're somewhere it can't walk to: it leaps (the Fiend burrows) to open ground near you
      // (checkEvery s: if it's got less than checkDist m in that time, it's stuck too)
      leap: { stuck: 3.5, minDist: 3, maxDist: 30, height: 9, sink: 7, radius: 4.2, damage: 45, push: 8, checkEvery: 2.5, checkDist: 1.2 },
      // where bullets spark off them: [height up its body, radius] (m)
      // how each one's drawn (src/render/titanView.js): its eyes' glow (m up, m forward),
      // which way its model faces, its walk, how far it sinks to wake and kneel
      look: {
        ship: { eyeY: 8.5, eyeZ: 7.5, eyeSize: 7, light: 40, lightRange: 50, heat: 1.5, face: -Math.PI / 2 },
        research: { eyeY: 6.7, eyeZ: 2.6, eyeSize: 2.2, light: 18, lightRange: 22, heat: 1.2, face: Math.PI / 2, stride: 0.6, bob: 0.3, leanWalk: 0.05, roll: 0.04, wakeSink: 0.9, kneelSink: 0 },
        caves: { eyeY: 6.1, eyeZ: 1.0, eyeSize: 1.8, light: 14, lightRange: 18, heat: 1.0, face: 0, stride: 1.2, bob: 0.26, leanWalk: 0.08, roll: 0.06, wakeSink: 1.8, kneelSink: 2.3, heartY: 4.2, heartZ: 1.3 },
        trench: { eyeY: 8.3, eyeZ: 0.9, eyeSize: 3, light: 32, lightRange: 28, heat: 1.6, face: Math.PI / 2, stride: 1.0, bob: 0.35, leanWalk: 0.06, roll: 0.05, wakeSink: 0, kneelSink: 0 },
      },
      hitSpheres: { research: [[2.2, 1.9], [5.0, 2.4], [7.2, 2.2]], caves: [[2.0, 1.7], [4.4, 2.0], [6.4, 1.5]], trench: [[2.4, 2.0], [5.6, 2.5], [8.6, 1.8]] },
      // The Drowned Captain (Ship Graveyard): a giant pirate head that spits skeletons
      ship: {
        waves: [6, 9, 12, 16], perPlayer: 3,   // skeletons a wave (+ per extra player)
        spitEvery: [0.7, 1.4],  // s between skeletons out of its mouth
        flight: 1.3,            // s a skeleton flies before it lands
        maxUp: 14,              // skeletons up at once
        health: 0.9,            // x a zombie's health this round
        between: 7,             // s of quiet between waves
        inhaleEvery: [16, 24],  // s between its breaths
        inhaleWarn: 1.8,        // s of it rearing back first
        inhaleTime: 3.4,        // s it pulls at you (toward the edge)
        pull: 5.2,              // m/s at the edge of the island (less further off)
        reach: 75,              // m it pulls from
        exhaleTime: 1.0, push: 9, // and the gust back out
        rise: 7,                // m it comes up out of the dark when it wakes
        mouth: [0, 4.0, 9.5],   // its mouth, from where it sits (m: x, up, z)
        // once it's up it follows you through the air: dist m off, its base height m
        // over the ground (or you; never more than maxUp m over you), at up to
        // speed m/s, turning turn rad/s
        follow: { dist: 26, height: 3, maxUp: 9, clear: 7, speed: 6, ease: 0.8, turn: 0.9 },
        landReach: 70,          // m from it its crew can land
        landMin: 3,             // m from you, at the closest
      },
      // The Warden (Research Base): a shielded walker only the tesla coils can hurt
      research: {
        strikes: 4,             // coil strikes to overload it
        charge: 2.4,            // s to hold [F] at a coil's console to charge it
        coilRange: 7.5,         // m: a charged coil fires when the Warden walks this close
        recharge: 9,            // s before a coil can be charged again
        stun: 5,                // s it stands smoking after a strike
        speed: 2.7,             // m/s
        stompRange: 5.5, stompWarn: 0.9, stompDamage: 75, stompPush: 8,
        laserEvery: [6, 9], laserWarn: 1.3, laserLen: 32, laserWidth: 1.5, laserDamage: 60,
        addsEvery: 10, adds: 2, // lab zombies it calls in
        addsMax: 8,             // (no more than this many of them up at once)
        eyeHeight: 7.0,         // m: where the laser comes from
        leapTime: 1.8,          // s in the air on its jump jets
      },
      // The Glacier Golem (Ice Caves): only falling ice cracks it; a knife finishes the job
      caves: {
        hearts: 3,              // knife blows to its exposed heart
        fall: 0.9,              // s for an icicle cluster to come down
        hitRadius: 3.6,         // m from where it lands that it catches the golem
        crushRadius: 2.4, crushDamage: 70,   // (and anyone under it)
        stun: 7,                // s it kneels, heart showing
        regrow: 32,             // s for a cluster to grow back
        speed: 2.4,
        slamRange: 4.6, slamWarn: 1.0, slamDamage: 80, slamPush: 9,
        shardsEvery: [5, 8], shards: 3, shardWarn: 1.3, shardRadius: 2.0, shardDamage: 45,
        novaEvery: [14, 18], novaWarn: 1.2, novaRadius: 9, slow: 0.45, slowTime: 2.5,
        novaDamage: 15,
        riseTime: 1.6,          // s to get back up off its knees
        knifeReach: 2.2,        // m past its bulk you can reach the heart
        clusterRadius: 1.3,     // m: how big a target a cluster is
        leapTime: 2.0,
      },
      // The Molten Fiend (Trench Front): bullets do nothing; the field guns do
      trench: {
        hits: 5,                // field-gun shells to put it down
        flight: 1.8,            // s from the gun to the bang
        hitRadius: 4.2,         // m: where the shell lands vs where it is
        reload: 8,              // s between shots from one gun
        range: 90,              // m the guns reach
        speed: 2.3,
        lobEvery: [4.5, 7], lobs: 3, lobWarn: 1.5, lobRadius: 2.6, lobDamage: 55,
        burnTime: 6, burnRadius: 2.0, burnDps: 22,
        eruptEvery: [11, 15], eruptTime: 4.2, eruptRadius: 11, eruptDamage: 95,
        stagger: 2.2,           // s it reels after a shell
        hitPoints: 250,         // to whoever fired the shell
        handHeight: 8,          // m: where the magma comes from
        burrowTime: 2.6,        // s under the rock when it moves on
        groundY: 2.3,           // the battlefield's height (a shot at the sky comes down here)
      },
    },
    // Pit's forge at the Anvil (src/sim/forge.js): the titans' cores become the War Hammers
    // The Schnitz's cage (src/render/crustCage.js): Chops, Regs and P in an iron-barred
    // crate hanging out over the void past the north rim, on a chain up into a green whirl
    cage: {
      chain: 18,             // m of chain from the whirl down to the cage's roof
      size: [2.6, 2.3, 2.2], // m: wide, tall, deep
      barGap: 0.24,          // m between its bars
      linkStep: 0.19,        // m per chain link
      maxLinks: 400,
      whirl: 9,              // m across, the whirl at the top
      whirlColor: '#5aff70',
      sway: 0.035, swayRate: 0.6,   // rad, and how fast it swings
      detail: 0.7, boyScale: 0.92,  // the three inside
      light: 9, lightRange: 10, lightColor: '#b0ffc0',
    },
    // The War Hammer's four parts (src/sim/forge.js): one hidden on each island, at
    // one of its four spots (src/map/crust.js, picked each game), lying in the dirt
    // with nothing pointing it out; carry them back to the stand on the Anvil's dais. With all four on
    // it, everyone can take a War Hammer from it (one each).
    // the sky out in space (src/render/crustThemes.js spaceTexture): a calm one.
    // size: the texture (px, over the whole dome); stars: faint pinpricks (their
    // brightness from, to); bright: the few brighter ones; nebula: how strong its colour;
    // planetSpin: how fast the planets turn (rad/s; their clouds a touch faster)
    sky: { size: [4096, 2048], stars: 2600, faint: [0.25, 0.7], bright: 45, nebula: 0.75, planetSpin: { body: 0.045, clouds: 0.065 } },
    hammerParts: {
      parts: {
        trench: { id: 'head', name: 'Hammer Head' },
        ship: { id: 'haft', name: 'Haft' },
        research: { id: 'grip', name: 'Grip' },
        caves: { id: 'pommel', name: 'Pommel' },
      },
      pickupRange: 1.8,      // m: walk over a part to pick it up
      standRange: 2.4,       // m from the stand to put parts on it or take a hammer
    },
    // The boys in the Schnitz's cage shout down when you're up near it (src/sim/crew.js)
    cageTalk: {
      range: 30,             // m (flat) from the cage
      first: 40,             // s into the game before they start
      every: [35, 60],       // s between shouts
    },
    // Big Evil Zach (the Schnitz wearing him) taunts you through the fight
    zachTaunt: [16, 26],     // s between taunts
    // The power (src/sim/crustPower.js). Everything electric starts dead. The
    // Anvil's four launchers have each blown a relay: pull them from the junction
    // box beside each pad, take all four to Pit and he fixes the Anvil's power
    // (its launchers, its perk machine, its lights). Each other island has a
    // power switch by its launcher pad: flip it and that island's on.
    power: {
      launchersNeedPower: true,  // the Anvil's launchers don't fly until its power's on
      relayRange: 1.9,           // m from a junction box to pull its relay
      switchRange: 1.7,          // m from an island's power switch to flip it
      fixTime: 14,               // s Pit takes over the four relays
      boxOut: 3.6,               // m out to the side of a launcher pad its junction box stands
      switchOut: 4.4,            // m out to the side of an island's pad its power switch stands
      relayName: 'Burnt Relay',
      waveSpeed: 40,             // m/s the lights come on outward from the switch (or Pit)
    },
    forge: {
      pickupRange: 1.8,      // m: walk over a dropped core to pick it up
      benchRange: 2.6,       // m from Pit's bench to hand him things
      socketRange: 2.1,      // m from a socket on the Anvil to take or put back its hammer
      forgeTime: 22,         // s Pit takes over each War Hammer
      strikeEvery: 0.85,     // s between his hammer blows while he works (the sparks)
      temperTime: 9,         // s he takes over that
      introDelay: 9,         // s into the game before he says hello (after the Schnitz's welcome)
      idleEvery: 45,         // s at least between his "bring me a core" nudges
      nearPit: 30,           // m: further than this from him and you hear him on the walkie
      lineGap: 0.5,          // s between one of his lines and the next
    },
    // The War Hammers' trials (src/sim/hammerTrials.js): each element earns its "+"
    // on its own island, then Pit tempers it for free.
    trials: {
      // buoys: out m off the north shore, height m up; a gale reaches them within the
      // hammer's reach + its gale's range (+ slack m), angle degrees either side, reachUp m up or down
      wind: { out: 6, height: 2.2, slack: 1.5, angle: 40, reachUp: 6 },
      // charge every coil within time s of the first; then slam within near m of one
      lightning: { time: 60, near: 5 },
      // count zombies frozen or smashed in the Ice Caves; then slam within near m of the shrine
      ice: { count: 20, near: 5 },
      // craters to walk the Fire Hammer through (within margin m of the rim)
      fire: { craters: 3, margin: 0.6 },
    },
    // the War Hammers (src/sim/hammers.js): every swing smashes what's in front of
    // you. The War Hammer is plain iron; a titan's core makes it elemental (its
    // element goes off with every swing, at elementK of its full strength); Pit
    // tempers that into its "+" (inspired by the Origins staffs): full strength,
    // and each leaves something behind
    hammers: {
      elementK: 0.6,         // an untempered elemental hammer's element, x the tempered one's
      reach: 3.4,            // m in front of you a swing smashes
      angle: 70,             // degrees either side of where you look
      maxKills: 8,           // zombies one swing kills outright
      landAt: 2.2,           // m ahead of you the head comes down (where the element goes off)
      // two attacks. Left click / right trigger, the charged slam: wound up over your
      // shoulder (windup s, then it lands), the smash and the hammer's element; you're
      // slowed to slowMult for slowFor s from the click; any swing's back round after the
      // weapon's rpm (55: 1.1 s), but the next charged slam waits charged.every s (Double
      // Tap and Arsenal Accelerator bring it round faster; the HUD's bar shows it). Where
      // it lands the view nods down (nod, like a dive's landNod), dips (dip) and shakes.
      swing: { windup: 0.5, slowFor: 1.0, slowMult: 0.5, nod: 95, dip: 4, shake: 0.45 },
      charged: { every: 3.2 },
      // Right click / left trigger, the quick swing: a sweep from left to right across
      // you, the same on every hammer (no element, and Big Evil Zach shrugs it off).
      // Lands windup s after the click; the next one every `every` s. It smashes up to
      // maxKills within reach m and angle degrees either side, flinging them fling m
      // to the right; the view swings with it (yaw) and shakes a little.
      quick: { windup: 0.16, every: 0.7, slowFor: 0.3, reach: 3.0, angle: 80, maxKills: 4, fling: 3, yaw: 22, shake: 0.15 },
      titanDamage: 0,        // (the titans each have their own way down)
      tempered: {
        maxKills: 12,
        // a burst of flame, and a pool of fire where it landed: anything in it burns
        // down where it stands (killTime s, whatever the round), and anything that gets
        // out is still alight (burnKill s)
        fire: { blast: 'hammerFireUp', pool: { radius: 4.2, time: 7, killTime: 1.2, burnKill: 2.4, max: 30 } },
        // everything round you frozen solid (a frozen one shatters at the next hit), and a
        // blizzard left behind that freezes whatever comes in, and shatters it once it's
        // been in it shatterAfter s
        ice: { radius: 10, freeze: 9, maxFrozen: 40, storm: { radius: 5.5, time: 6, freeze: 3.5, shatterAfter: 1.2, max: 30 } },
        // a gale down the line you swung along, and a whirlwind where the head came
        // down (like the Origins wind staff's: it stays put, speed 0) dragging zombies
        // in and throwing them; one caught on something on the way is torn apart in grind s
        wind: { range: 16, angle: 36, near: 2.2, maxKills: 30, tornado: { speed: 0, time: 5, pull: 8, pullSpeed: [3, 9], catch: 1.5, grind: 2.5, max: 30 } },
        // a bolt jumping zombie to zombie, and a ball of lightning that drifts on,
        // striking anything near it
        lightning: { chains: 14, hop: 7.5, reach: 12, orb: { time: 6, speed: 1.8, height: 1.6, every: 0.3, reach: 7, max: 24 } },
      },
      // how they look (src/render/warHammer.js): the downloaded hammer, sized so the
      // haft's butt sits at z `butt` and the head's centre at z `headAt` (metres),
      // with its element going off round the head. A tempered hammer's element
      // runs `temperedPower` times harder.
      // in your hands, first person: its size (x the real thing) and where it sits
      // glow and dim: turned down that close to your eyes (glow: its glowing bits,
      // dim x its halo, element and skin's own light)
      fp: { scale: 0.52, hip: { x: 0.4, y: -0.55, z: -0.62, rx: -0.4, ry: 0.3, rz: 0.32 }, aim: { y: -0.46, z: -0.6 }, glow: 1.15, dim: 0.32 },
      // their recorded sounds, one file cut up: [start s, length s]
      sound: {
        url: 'assets/sfx/gear/g_hammers.mp3',
        segs: { g_ham_hit: [0.2, 1.725], g_ham_bass: [2.325, 1.2], g_ham_fire: [3.925, 2.2], g_ham_ice: [6.62, 0.58], g_ham_wind: [7.625, 2.0], g_ham_lightning: [10.025, 2.85] },
      },
      look: {
        model: 'assets/props/hammer.glb', butt: -0.22, headAt: 0.82,
        temperedPower: 1.8,
        // the head's iron once it's tempered (forged, it's the model's own plain iron)
        skin: {
          fire: { darken: 0.4, rough: 0.85, glow: '#ff5a10', power: 1.6, flicker: [7, 0.35, 17, 0.2] },        // charred, molten cracks
          lightning: { darken: 0.35, metal: 0.9, rough: 0.35, glow: '#b583ff', power: 1.1, flash: 3.2, flashOdds: 0.12 },  // black, violet veins
          wind: { color: '#7d8a84', metal: 0.6, rough: 0.55, glow: '#d8fff0', power: 0.7, stream: 0.35 },      // weathered, wind-lines streaming
          ice: { color: '#8eacc2', metal: 0.3, rough: 0.25, glow: '#2a6a90', power: 0.35, shell: [1.09, 1.12, 1.12], shellOpacity: 0.3 },  // frosted, in clear ice
        },
        heatGlow: 2.2,         // red-hot from the forge
        // a swing landing (src/render/forgeView.js slamElement): its burst of light x burst,
        // the lightning's screen flash (it whited the screen out) and its bolt's light
        slam: { burst: 0.6, flash: 0.14, boltLight: 140 },
        // what each tempered hammer leaves behind (src/render/hammerFxView.js)
        linger: {
          fadeIn: 0.35, fadeOut: 1.0,
          fire: { flamesPerSec: 70, emberPerSec: 30, flameSize: 0.9, flameLife: 0.9, discGlow: 1.6 },
          ice: { snowPerSec: 90, mistPerSec: 6, spikes: 9, spikeHeight: [0.5, 1.3], swirl: 2.2 },
          wind: { height: 6, radius: [0.35, 2.6], spin: 7, dustPerSec: 14, debrisPerSec: 40 },
          lightning: { core: 0.16, glow: 1.6, arcs: 4, arcReach: 0.9, sparksPerSec: 30 },
        },
        fire: { flames: 60, embers: 22, rise: 0.26, rate: 1.9, flameSize: 0.17, emberSize: 0.022, flicker: 0.35 },
        ice: { mist: 26, flakes: 22, orbit: 0.22, sink: 0.22, rate: 0.35, mistSize: 0.2, mistGlow: 0.22, flakeSize: 0.02 },
        wind: { motes: 40, radius: 0.2, spin: 5.5, drift: 0.5, size: 0.028, ribbons: 2, ribbonSpin: 3.2, ribbonGlow: 0.32 },
        lightning: { arcs: 6, segs: 8, reach: 0.32, every: 0.07, width: 0.035, sparks: 18, sparkSize: 0.03 },
      },
    },
    // the finale: ring the Anvil once all four hammers are forged, and Big Evil Zach
    // comes down into the pit (src/sim/zachBoss.js)
    finale: {
      order: ['wind', 'lightning', 'ice', 'fire'],   // the element he's open to, phase by phase
      hits: 3,               // right-hammer hits to break each phase (+1 for every player past two)
      descendTime: 5.5,      // s from the Anvil ringing to him landing
      kneelTime: 4.5,        // s on his knees after a phase breaks
      scale: [4.2, 3.6, 3.0, 2.6],   // how big he is in each phase (x a person: the Schnitz loosening its grip)
      radius: 1.6,           // m: what he moves as
      bulk: 2.6,             // m: how far he shoves you out of the way
      hitReach: 3.0,         // m past his edge a hammer swing still lands
      speed: [2.2, 2.6, 3.0, 3.4],   // m/s, phase by phase (he gets angrier)
      pitRadius: 13.5,       // m: he stays in the pit
      anvilRadius: 5.2,      // m: and off the Anvil
      band: 5.4,             // m either side of the Anvil (north-south): between the scaffold catwalks, which he's too tall for
      pitClear: 3.8,         // m: he keeps off Pit and his bench
      every: [2.4, 4.0],     // s between attacks
      stomp: { warn: 1.1, radius: 7, damage: 55, push: 9 },
      swipe: { warn: 0.8, range: 7.5, angle: 70, damage: 45, push: 11 },
      summon: { count: 5, every: 3, warn: 1.2 },   // his dead, up out of the pit floor (every third attack)
      healthMult: 1.6,       // the summoned dead: x a normal zombie's health this round
      bulletSparks: true,    // (bullets spark off The Schnitz's shield)
      freedTime: 13,         // s from the last phase breaking to the end
      hitPoints: 250,        // to whoever lands a right-hammer hit
    },
    // ziplines and ice slides
    ride: {
      hang: 2.0,             // m your feet hang below a zipline's cable
      cable: 2.3,            // m a zipline's cable runs over the ground at each end
      sag: 0.006,            // how far the drawn cable dips in the middle (x its length)
      zipStart: 4,           // m/s as you push off
      zipSpeed: 13,          // m/s top speed on a zipline
      zipAccel: 9,           // m/s² getting there
      slideMin: 6,           // m/s an ice slide never goes slower than
      slideMax: 17,          // m/s nor faster than
      slideDrag: 1.5,        // m/s² of friction on the ice
      handOver: 2,           // s (online) the host waits for a friend to say they're on a zipline it put them on
    },
    // the launchers between the hub and the islands
    launch: {
      cost: 0,               // points per launch (free while the map's being built)
      time: 3.4,             // s in the air
      apex: 34,              // m above the higher pad at the top of the arc
      flyLean: 0.8,          // how far over someone flying leans (1: flat out, as in a dive)
      range: 2.2,            // how close to the pad's middle you stand to use it
      cooldown: 30,          // s after landing before you can launch again (no bouncing back and forth)
      exploreCooldown: 1,    // (in Explore: next to none)
      lockInFight: true,     // a titan awake: its island's launcher is locked down till it's beaten
    },
    strandedTime: 5,         // s a zombie with no way to reach anyone waits before it's recycled near the players
  },

  // ---------------------------------------------------------------------------
  // Boot splash: the Tiger Fish Interactive logo (src/ui/splash.js)
  // ---------------------------------------------------------------------------
  splash: {
    hold: 4.0,               // seconds from the press to the fade
    fade: 0.9,               // fade into the title
    skipAfter: 0.8,          // a second press after this long skips the rest
    // the moans: [delay s, pitch Hz, length s, loudness]
    moans: [[0.1, 68, 2.4, 1.1], [0.55, 96, 1.7, 0.85], [1.2, 58, 2.8, 1.2], [1.9, 108, 1.5, 0.75], [2.5, 76, 2.1, 1.0]],
  },

  // ---------------------------------------------------------------------------
  // Last stand
  // ---------------------------------------------------------------------------
  lastStand: {
    bleedOut: 30,            // seconds a downed player lasts in co-op
    reviveTime: 4,           // seconds a teammate holds F to revive
    crawlSpeed: 0.9,
    eyeHeight: 0.55,
    reviveHealthFrac: 1,     // health after being revived
    reviveInvuln: 3,         // seconds you can't be hurt after getting back up
    tempPistol: 'M1912',     // what you get if you have no pistol
    tempPistolMags: 3,
  },

  interaction: {
    range: 1.8,                // default reach for buyables
    lookAngle: 65,             // must be roughly facing it (degrees off-center)
  },

  // ---------------------------------------------------------------------------
  // Firing range mode (main menu)
  // ---------------------------------------------------------------------------
  range: {
    startRound: 1,           // dummy and horde strength (zombie health for this round)
    maxRound: 50,
    respawnTime: 1.5,        // seconds before a dead target dummy stands back up
    hordeSize: 10,
    startPoints: 50000,      // for the box and wall buys; topped back up when low
  },

  // ---------------------------------------------------------------------------
  // "The Final Whistle" (the main quest on the school)
  // ---------------------------------------------------------------------------
  // the crew's chatter (src/sim/crew.js)
  crew: {
    reactCooldown: 9,     // s between one player's reactions
  },

  quest: {
    statueSouls: 16,      // kills near the mascot statue to wake it
    statueRadius: 8,      // m from the statue a kill has to be
    coinDropDelay: 2.4,   // s from the eyes lighting up to the coin falling out
    trophySettle: 2.0,    // s from placing the trophy to the stand moving
    madDogRiseTime: 3.5,  // s for the Mad Dog Machine to come up through the floor
    claddingTime: 9,      // s for the Press Box cladding to grind up
    ritualTime: 45,       // s to hold each half-court circle
    ritualCircle: 3.2,    // m, the circle's radius
    ritualLeaveTime: 4,   // s with nobody in the circle before it goes out
    ritualSpawnEvery: 1.3, // s between zombies clawing up during a ritual
    ritualMaxAlive: 22,
    // lifting the built Chopper: the lights go down and The Schnitz speaks.
    // Nothing attacks you in the dark.
    schnitz: { duration: 19, dim: 0.14 },
    // then: kill its infused zombies. Twice as tall, slower, 2.5x the health,
    // glowing green, clawing up out of the floor near you.
    infused: { kills: 50, scale: 2, health: 2.5, speed: 0.75, maxAlive: 4, perPlayer: 1, spawnEvery: 3.2, spawnDist: [6, 11] },
    // the talent each ball gives back (multipliers)
    boosts: { speed: 1.12, jump: 1.45, power: 1.25, defense: 0.75 },
    // the Intercom Showdown
    boss: {
      waves: 5,             // phase 1: waves of Zombie Defenders, each harder than the last
      // one entry per wave:
      waveSize: [10, 12, 15, 18, 22],          // zombies (solo)
      waveSizePerPlayer: [3, 3, 4, 5, 6],      // + this many per extra player
      waveHealth: [1, 1.15, 1.35, 1.6, 1.9],   // x their health
      waveSpawnEvery: [0.85, 0.75, 0.65, 0.55, 0.45],   // s between spawns
      spawnEvery: 0.8,      // (phase 2's stream runs off this)
      maxAlive: 24,
      defenderHealth: 1.3,  // x the round's zombie health
      eliteHealth: 7,       // phase 2 elites
      playEvery: 5.5,       // s between Erik's playbook diagrams
      zonesPerPlayer: 2,
      zoneWarn: 1.6,        // s a play glows faintly before it burns
      zoneLive: 2.2,
      zoneDps: 55,
      chopperHits: 3,       // phase 3: Chopper blasts on the Press Box to bring Erik down
      // what climbs out of the court during the fight: the rest are Zombie Defenders
      // (one entry per wave; phases 2 and 3 use the last wave's)
      mix: {
        spirit: [0.3, 0.34, 0.38, 0.4, 0.42],       // share that are blue ritual spirits
        infused: [0.18, 0.22, 0.25, 0.27, 0.3],     // share that are The Schnitz's green giants...
        infusedMax: [2, 3, 3, 4, 5],                // ...but never more than this many up at once
        infusedPerPlayer: 1,
        cheddar: [0, 0, 0, 0.14, 0.2],              // Cheddars join after wave 3, down in lightning
        cheddarMax: [0, 0, 0, 3, 4],
        cheddarPerPlayer: 1,
      },
      phase3Every: 2.4,     // s between spawns while you blast the Press Box
      phase3MaxAlive: 8,
    },
  },

  // ---------------------------------------------------------------------------
  // Visuals
  // ---------------------------------------------------------------------------
  graphics: {
    renderScale: 1.0,
    maxPixelRatio: 1.5,
    fogColor: '#121419',     // cold blue-grey murk
    fogDensity: 0.036,
    exposure: 1.25,
    // the eye adjusts: brighter exposure in the dark, lower once the power's on
    exposureDark: 1.5,
    exposureLit: 0.9,
    beamOpacity: 0.016,      // the haze under each ceiling light
    tubeGlow: 1.7,           // how hot the light panels themselves look
    bloomStrength: 0.5,      // soft halos round every light
    bloomRadius: 0.6,
    bloomThreshold: 1.1,     // only lights and glowing things bloom, not a lit surface
    minRoughness: 0.6,       // no mirror-shiny surfaces in the school (mapView.tameGloss)
    maxMetalness: 0.45,
    liveLightScale: 0.85,    // real-time lights on unbaked things (props, people), to sit with the baked rooms
    grain: 0.06,
    vignette: 0.9,
    desaturate: 0.3,
    contrast: 1.2,
    splitTone: 0.8,
    shadowTint: [0.84, 0.95, 1.12],
    highlightTint: [1.08, 0.98, 0.84],
    sharpen: 0.35,
    ao: true,                // screen-space ambient occlusion (Settings can turn it off)
    aoIntensity: 0.9,
    // Far detail (src/render/renderer.js farCull): anything so small at its distance
    // that it'd only be a speck isn't drawn. Culled once it's more than `ratio`
    // times its own radius away (about 3 pixels tall at 1080p and a `refFov`°
    // view; a scope's zoom brings it back), and never nearer than `minDist` m.
    // Glowing things (`glow`: how bright counts) are always drawn.
    farCull: { ratio: 750, refFov: 70, minDist: 25, glow: 0.6, rescan: 2 },
    dustCount: 700,
    maxBloodDecals: 70,
    maxBulletHoles: 90,
    corpseTime: 9,
    corpseSinkTime: 2.5,
    ambientLight: 0.32,      // pre-power base light
    viewmodelFov: 54,
    maxPointLights: 12,      // the light pool's size; Settings › Dynamic lights uses up to this many
    maxSpotLights: 4,
    bakeBudgetMs: 6,         // time per frame spent baking the lighting after a map loads
    reflections: true,       // puddles and blood pools mirror the room (a small cube map round the camera)
    reflectionSize: 128,     // cube map face size
    reflectionInterval: 0.2, // seconds between refreshes (one face is drawn per frame)
    maxBloodPools: 16,
    lightRange: 32,

    // ---- Settings › Graphics: what each choice means (src/render/quality.js)
    // Each preset sets every graphics option at once; touching one by hand
    // shows "Custom".
    presets: {
      low:    { renderScale: 0.6, autoRes: true,  sharpness: 1,   ao: false, bloom: false, reflections: false, grain: false, lights: 'low',    effects: 'low',    zombieModels: 'simple',   gunModels: 'simple' },
      medium: { renderScale: 0.8, autoRes: true,  sharpness: 1,   ao: false, bloom: true,  reflections: false, grain: true,  lights: 'medium', effects: 'medium', zombieModels: 'detailed', gunModels: 'detailed' },
      high:   { renderScale: 1.0, autoRes: false, sharpness: 1.5, ao: true,  bloom: true,  reflections: true,  grain: true,  lights: 'high',   effects: 'high',   zombieModels: 'detailed', gunModels: 'detailed' },
      ultra:  { renderScale: 1.0, autoRes: false, sharpness: 2,   ao: true,  bloom: true,  reflections: true,  grain: true,  lights: 'ultra',  effects: 'high',   zombieModels: 'detailed', gunModels: 'detailed' },
    },
    // Dynamic lights: how many real point / spot lights the nearest fixtures get
    lightLevels: { low: [4, 1], medium: [6, 2], high: [10, 4], ultra: [12, 4] },
    // Effects: share of particles, dust and snowflakes; share of blood/bullet
    // marks kept; how long bodies lie before sinking (s)
    effectLevels: {
      low:    { fx: 0.35, marks: 0.35, corpseTime: 4 },
      medium: { fx: 0.65, marks: 0.6,  corpseTime: 6 },
      high:   { fx: 1,    marks: 1,    corpseTime: 9 },
    },
    // Auto resolution: lowers the render scale while the frame rate is under
    // target and brings it back when there's room
    autoRes: { min: 0.5, low: 0.88, high: 0.97, every: 1.2, step: 0.08 },
    fpsCaps: [0, 144, 120, 60, 30],   // Settings › Frame rate cap (0 = off)
  },

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------
  audio: {
    // recorded songs: the menus' (Settings can bring back the original synth
    // theme) and Big Evil Zach's fight on Call of the Crust
    menuSong: 'assets/music/the_kettle_liturgy.mp3',
    zachSong: 'assets/music/tank.mp3',
    zachSongGain: 0.85,
    master: 0.8,
    sfx: 1.0,
    ambient: 0.7,
    music: 0.8,
    voice: 1.0,              // Erik on the PA, the intercom
    reverbSeconds: 2.8,      // big gym echo
    reverbSend: 0.28,
    refDistance: 2.2,
    rolloff: 1.15,
    maxDistance: 70,
    maxZombieVoices: 9,
    maxBuzzers: 6,           // flickering fixtures that get their own electrical buzz
    groanInterval: [2.2, 6.0],
  },

  // ---------------------------------------------------------------------------
  // Erik on the PA (lines live in src/lore/erik.js)
  // ---------------------------------------------------------------------------
  pa: {
    enabled: true,
    introDelay: 3.5,         // seconds after round 1 starts
    gap: 1.2,                // silence between two queued lines
    cooldown: 14,            // minimum seconds between optional lines
    chance: {                // odds that an optional event gets a comment
      round: 0.45, roundEnd: 0.35, boxMoved: 0.75, madDog: 0.5, down: 0.8,
      revived: 0.5, pressureCooker: 0.6, power: 1, cheddar: 1, cheddarEnd: 0.8,
    },
    idleEvery: [70, 120],    // random barb when he has been quiet this long
    multiKill: 6,            // kills within multiKillWindow -> "those were my guests!"
    multiKillWindow: 1.6,
    intercomRange: 1.5,
    intercomCooldown: 4,
  },

  // Explore mode: walk the school with endless points.
  explore: {
    points: 999999,
  },

  // The Stew song Easter egg: find the 3 Stew items.
  stewEgg: {
    itemRange: 1.3,
    songDelay: 2.2,          // after the third item: needle drop
  },

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------
  hud: {
    tallyUpTo: 10,           // tally marks up to this round, scratched numerals after
    hitmarkers: true,
    lowAmmoFraction: 0.25,
  },
};

// -----------------------------------------------------------------------------
// A buff across every gun (it was a bit too hard, especially with four):
// bullet damage and projectile impacts x GUN_BUFF, before the Mad Dog twins
// are made so the upgraded guns get it too.
// -----------------------------------------------------------------------------
export const GUN_BUFF = 1.2;
for (const d of Object.values(CONFIG.weapons)) {
  if (d.damage > 0) d.damage = Math.round(d.damage * GUN_BUFF);
  if (d.projectile && d.projectile.impactDamage) d.projectile.impactDamage = Math.round(d.projectile.impactDamage * GUN_BUFF);
}

// -----------------------------------------------------------------------------
// Mad Dog upgrades: every weapon gets an upgraded twin under the id "<id>+".
// The upgraded copy uses the weapon's `upgrade` entry (name, camo color and
// any stat overrides) on top of the CONFIG.madDog defaults.
// -----------------------------------------------------------------------------
const UPGRADE_KEYS = new Set(['name', 'color', 'note', 'damageMult', 'impactMult', 'explodeUp']);
for (const [id, d] of Object.entries(CONFIG.weapons)) {
  if (!d.upgrade || id.endsWith('+')) continue;
  const u = d.upgrade, md = CONFIG.madDog;
  const up = {
    ...d,
    name: u.name,
    upgraded: true,
    baseId: id,
    boxOnly: true,
    damage: Math.round(d.damage * (u.damageMult ?? md.damageMult)),
    magSize: Math.max(d.magSize, Math.round(d.magSize * md.magMult)),
    reserve: Math.round(d.reserve * md.reserveMult),
    reloadTime: d.reloadTime ? +(d.reloadTime * md.reloadMult).toFixed(2) : d.reloadTime,
    reloadEmptyTime: d.reloadEmptyTime ? +(d.reloadEmptyTime * md.reloadMult).toFixed(2) : d.reloadEmptyTime,
    shellTime: d.shellTime ? +(d.shellTime * md.reloadMult).toFixed(2) : d.shellTime,
    penetration: (d.penetration || 1) + md.penetrationAdd,
    sound: { ...d.sound, upgraded: true },
    view: { ...d.view, camo: u.color },
  };
  delete up.cost; delete up.ammoCost; delete up.upgrade;
  if (d.projectile) {
    up.projectile = { ...d.projectile };
    if (d.projectile.impactDamage) up.projectile.impactDamage = Math.round(d.projectile.impactDamage * (u.impactMult ?? 2));
    if (u.explodeUp && d.projectile.explode) up.projectile.explode = d.projectile.explode + 'Up';
  }
  for (const [k, v] of Object.entries(u)) if (!UPGRADE_KEYS.has(k)) up[k] = v;
  CONFIG.weapons[id + '+'] = up;
}

// The base weapon id of a (possibly upgraded) weapon id.
export const baseWeaponId = (id) => (id && id.endsWith('+') ? id.slice(0, -1) : id);

// Helper: zombie health for a given round (classic curve).
export function zombieHealthForRound(round, cfg = CONFIG.zombie) {
  let hp = cfg.healthBase;
  for (let r = 2; r <= round; r++) {
    if (r <= cfg.healthAddUntilRound) hp += cfg.healthAddPerRound;
    else hp *= cfg.healthMultAfter;
  }
  return Math.round(hp);
}

// Helper: how many zombies spawn in a round.
export function zombieCountForRound(round, players = 1, cfg = CONFIG.rounds) {
  let count;
  if (round <= cfg.earlyCounts.length) {
    count = cfg.earlyCounts[round - 1];
  } else {
    let mult = Math.max(1, round / 5);
    if (round >= 10) mult *= round * cfg.lateRoundScale;
    count = cfg.baseCount + cfg.hordePerPlayer * mult;
  }
  count *= 1 + (players - 1) * cfg.extraPlayerMult;
  return Math.floor(count);
}
