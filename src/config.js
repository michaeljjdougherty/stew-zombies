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
      grenade: ['KeyG'],
      tactical: ['KeyQ'],
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
    L97A1: gun('sniper', {
      name: 'L97A1', boxOnly: true,
      action: 'bolt', rpm: 52, damage: 1100, headMult: 2, magSize: 5, reserve: 50, penetration: 5,
      reloadTime: 3.0, reloadEmptyTime: 3.6, adsFovMult: 0.28,
      recoil: { pitch: 6.5, viewKick: 2.6 },
      sound: { kind: 'sniper', body: 1600, thump: 80, crack: 1.5, tail: 1.5, pitch: 0.82 },
      view: { model: 'l97', flash: 1.6 },
      upgrade: { name: 'Final Exam', color: '#ff1744', damageMult: 3, magSize: 8, penetration: 8 },
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
    // The Chopper: a wonder weapon. Each shot is a wall of wind that kills
    // and throws every zombie in a wide cone in front of you.
    'The Chopper': gun('launcher', {
      name: 'The Chopper', boxOnly: true, wonder: true,
      fireMode: 'semi', rpm: 75, damage: 0, magSize: 2, reserve: 12,
      reloadStyle: 'mag', reloadTime: 2.6, reloadEmptyTime: 2.8, drawTime: 0.7,
      wind: { range: 13, angle: 30, near: 1.8, maxKills: 30 },
      spread: { hipBase: 0, hipMax: 0, perShot: 0, ads: 0 },
      recoil: { pitch: 5.5, yaw: 1.2, recovery: 5, adsMult: 0.9, viewKick: 3.2 },
      sound: { kind: 'wind', body: 0, thump: 0, crack: 0, tail: 1, pitch: 1 },
      view: { model: 'chopper', flash: 0 },
      upgrade: { name: 'The Meat Grinder', color: '#ff3b1f', magSize: 4, wind: { range: 17, angle: 36, near: 2.2, maxKills: 45 } },
    }),
  },

  startingWeapon: 'M1912',

  // ---------------------------------------------------------------------------
  // Doors, debris and the mystery box
  // ---------------------------------------------------------------------------
  doors: {
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
      'Fucci Gun': 0.5, 'The Chopper': 0.45, stewBomb: 0.7,
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
  },

  // Explosion types: radius (m), damage at the center to zombies, and
  // selfDamage = damage to the player who caused it if they're at the center.
  explosions: {
    frag: { radius: 4.5, damage: 1100, selfDamage: 120, minFrac: 0.15, shake: 1.0 },
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
      marathonMinestrone: {
        name: 'Marathon Minestrone', cost: 2000, color: '#e8742c', power: true, glyph: 'M',
        desc: 'Sprint almost forever and move a little faster.', sprintMult: 3, speedMult: 1.07,
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
    speed: [5.2, 6.0],
    spawnInterval: [0.9, 1.8],
    spawnDist: [7, 15],      // lightning strikes this far from a player
    spawnTime: 0.9,          // seconds from the strike until it attacks
    radius: 0.38,
    height: 0.95,
    turnRate: 9,
    accel: 16,
    attackRange: 1.15,
    attackHitRange: 1.5,
    attackWindup: 0.22,
    attackRecover: 0.45,
    attackDamage: 35,
    haze: 0.32,              // strength of the yellow screen tint
    preRoundTime: 4,         // haze and thunder before the first strike
    line: 'Wanna play 2K?',  // what they snarl at you
    talkEvery: [3.5, 7],     // seconds between one of them saying it
    talkRange: 14,           // only ones this close to a player talk
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
    // the talent each ball gives back (multipliers)
    boosts: { speed: 1.12, jump: 1.45, power: 1.25, defense: 0.75 },
    // the Intercom Showdown
    boss: {
      waves: 3,             // phase 1: waves of Zombie Defenders
      waveSize: 9,          // per wave (solo; +3 per extra player)
      spawnEvery: 0.8,
      maxAlive: 24,
      defenderHealth: 1.3,  // x the round's zombie health
      eliteHealth: 7,       // phase 2 elites
      playEvery: 5.5,       // s between Erik's playbook diagrams
      zonesPerPlayer: 2,
      zoneWarn: 1.6,        // s a play glows faintly before it burns
      zoneLive: 2.2,
      zoneDps: 55,
      chopperHits: 3,       // phase 3: Chopper blasts on the Press Box to bring Erik down
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
    dustCount: 700,
    maxBloodDecals: 70,
    maxBulletHoles: 90,
    corpseTime: 9,
    corpseSinkTime: 2.5,
    ambientLight: 0.32,      // pre-power base light
    viewmodelFov: 54,
    maxPointLights: 10,      // nearest lights are streamed into this many real lights
    maxSpotLights: 4,
    bakeBudgetMs: 6,         // time per frame spent baking the lighting after a map loads
    reflections: true,       // puddles and blood pools mirror the room (a small cube map round the camera)
    reflectionSize: 128,     // cube map face size
    reflectionInterval: 0.2, // seconds between refreshes (one face is drawn per frame)
    maxBloodPools: 16,
    lightRange: 32,
  },

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------
  audio: {
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
