// =============================================================================
// STEW ZOMBIES — CONFIG
// Every number that affects feel and balance lives here. Tweak freely.
// Units: meters, seconds, degrees (unless noted), points.
// =============================================================================

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

    sprintDuration: 4.0,     // seconds of sprint from full stamina
    sprintRecoverRate: 0.8,  // stamina seconds recovered per second
    sprintMinToStart: 0.8,   // need this much stamina to start sprinting again
    sprintToFireDelay: 0.24, // delay before you can fire after sprint ends
    sprintTurnPenalty: 0,    // reserved

    maxHealth: 100,
    regenDelay: 3.5,         // seconds without damage before regen starts
    regenRate: 55,           // health per second once regen starts

    startPoints: 500,
  },

  // ---------------------------------------------------------------------------
  // Camera feel
  // ---------------------------------------------------------------------------
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

    damageShake: 1.4,        // degrees
  },

  // ---------------------------------------------------------------------------
  // Mouse
  // ---------------------------------------------------------------------------
  input: {
    defaultSensitivity: 1.0,
    radiansPerPixel: 0.0021, // at sensitivity 1.0
    defaultAdsSensitivity: 0.7,
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
      grenade: ['KeyG'],
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
    earlyCounts: [6, 8, 13, 18, 24], // solo zombie counts, rounds 1-5
    baseCount: 24,           // used from round 6 on
    hordePerPlayer: 6,
    lateRoundScale: 0.15,    // round >= 10 multiplier per round
    extraPlayerMult: 0.5,    // each extra player adds this fraction of base
    maxAlive: 24,            // cap of zombies on the map at once
    spawnIntervalStart: 2.0,
    spawnIntervalDecay: 0.95, // multiplied each round
    spawnIntervalMin: 0.35,
    firstSpawnDelay: 0.8,
  },

  // ---------------------------------------------------------------------------
  // Zombies
  // ---------------------------------------------------------------------------
  zombie: {
    radius: 0.36,
    height: 1.8,
    stepHeight: 0.5,

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
    M1912: {
      name: 'M1912',
      class: 'pistol',
      fireMode: 'semi',       // semi | auto | burst
      rpm: 420,               // max fire rate for semi (how fast you can click)
      damage: 40,
      headMult: 2.6,
      limbMult: 0.75,
      pellets: 1,
      range: 70,
      falloffStart: 18,
      falloffMinMult: 0.65,
      magSize: 8,
      reserve: 80,
      reloadTime: 1.55,       // partial mag
      reloadEmptyTime: 1.85,  // empty mag (slide locked back)
      reloadAddAt: 0.72,      // fraction of reload where ammo is added (cancel after this keeps ammo)
      drawTime: 0.45,
      adsTime: 0.17,
      adsFovMult: 0.86,
      adsMoveMult: 0.6,
      moveSpeedMult: 1.0,
      spread: {
        hipBase: 1.9,
        hipMax: 5.5,
        perShot: 1.3,
        recovery: 7.5,        // degrees per second
        ads: 0.18,
        adsPerShot: 0.25,
        moving: 1.4,
        air: 4.0,
        crouchMult: 0.8,
      },
      recoil: {
        pitch: 1.9,           // view kick up per shot
        yaw: 0.55,            // random left/right range
        recovery: 9,          // how fast the view settles back (per second)
        adsMult: 0.7,
      },
      sound: { kind: 'pistol', body: 2200, thump: 150, crack: 0.9, tail: 0.5, pitch: 1.0 },
      view: { metal: '#2c2d2e', grip: '#4a3424' },
      upgrade: {
        name: 'Twin Stewpots',
        color: '#8a2be2',
        note: 'Upgraded in the Mad Dog Machine (Phase 5): small explosive rounds.',
      },
    },
  },

  startingWeapon: 'M1912',

  // ---------------------------------------------------------------------------
  // Visuals
  // ---------------------------------------------------------------------------
  graphics: {
    renderScale: 1.0,
    maxPixelRatio: 1.5,
    fogColor: '#17140f',
    fogDensity: 0.042,
    exposure: 1.05,
    bloomStrength: 0.62,
    bloomRadius: 0.55,
    bloomThreshold: 0.82,
    grain: 0.075,
    vignette: 0.85,
    sepia: 0.22,
    desaturate: 0.38,
    contrast: 1.08,
    dustCount: 700,
    maxBloodDecals: 70,
    maxBulletHoles: 90,
    corpseTime: 9,
    corpseSinkTime: 2.5,
    ambientLight: 0.2,       // pre-power base light
    viewmodelFov: 54,
  },

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------
  audio: {
    master: 0.8,
    sfx: 1.0,
    ambient: 0.7,
    music: 0.8,
    reverbSeconds: 2.8,      // big gym echo
    reverbSend: 0.28,
    refDistance: 2.2,
    rolloff: 1.15,
    maxDistance: 70,
    maxZombieVoices: 9,
    groanInterval: [2.2, 6.0],
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
