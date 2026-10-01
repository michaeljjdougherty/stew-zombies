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
    // Explosions can blow a zombie's legs off without killing it: it becomes a crawler.
    crawlerChance: 0.45,     // chance when an explosion takes off a big chunk of health
    crawlerDamageFrac: 0.3,  // fraction of max health a single blast must deal
    crawlSpeed: [0.65, 0.95],
    stuckTime: 0.6,          // seconds barely moving before a zombie sidesteps
    sidestepTime: 0.9,
    portalReach: 1.2,        // how close to a doorway before heading through
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
      upgrade: { name: 'Twin Stewpots', color: '#8a2be2', note: 'Mad Dog Machine (Phase 5): small explosive rounds.' },
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
      upgrade: { name: 'M15 Stewmaster', color: '#b8860b' },
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
      upgrade: { name: 'Olympus Rising', color: '#c0392b' },
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
      upgrade: { name: 'The Afterparty', color: '#2e8b57' },
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
      upgrade: { name: 'Pyton Supreme', color: '#6a0dad' },
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
      upgrade: { name: 'Komandant', color: '#1f6fb2' },
    },
    // ---- more wall weapons (their wall spots arrive with the Phase 4 rooms) --
    Staykout: gun('shotgun', {
      name: 'Staykout', cost: 1500, ammoCost: 750,
      action: 'pump', rpm: 72, damage: 72, pellets: 8, magSize: 6, reserve: 60,
      reloadStartTime: 0.4, shellTime: 0.52, reloadEndTime: 0.5,
      recoil: { pitch: 6, yaw: 1.5, viewKick: 2.3 },
      sound: { kind: 'shotgun', body: 1000, thump: 65, crack: 0.85, tail: 1.1, pitch: 0.78 },
      view: { model: 'pump', flash: 2.0 },
      upgrade: { name: 'Raid Night', color: '#a83232' },
    }),
    MP6K: gun('smg', {
      name: 'MP6K', cost: 1000, ammoCost: 500,
      rpm: 760, damage: 40, magSize: 30, reserve: 120, reloadTime: 2.3, reloadEmptyTime: 2.75,
      recoil: { pitch: 0.75, yaw: 0.55 },
      sound: { kind: 'smg', body: 2700, thump: 140, crack: 0.75, tail: 0.4, pitch: 1.12, mech: true },
      view: { model: 'mp6k', flash: 0.8 },
      upgrade: { name: 'Mini-Stew', color: '#3e7cb1' },
    }),
    MPK: gun('smg', {
      name: 'MPK', cost: 1100, ammoCost: 550,
      rpm: 960, damage: 38, magSize: 24, reserve: 168, reloadTime: 2.1, reloadEmptyTime: 2.55,
      spread: { perShot: 0.5 }, recoil: { pitch: 0.7, yaw: 0.7 },
      sound: { kind: 'smg', body: 3000, thump: 150, crack: 0.7, tail: 0.35, pitch: 1.25, mech: true },
      view: { model: 'mpk', flash: 0.75 },
      upgrade: { name: 'Hall Monitor', color: '#7b52ab' },
    }),
    PM64: gun('smg', {
      name: 'PM64', cost: 1000, ammoCost: 500,
      rpm: 1050, damage: 32, headMult: 2.4, magSize: 20, reserve: 160, reloadTime: 1.9, reloadEmptyTime: 2.3,
      range: 40, falloffStart: 10, falloffMinMult: 0.5,
      spread: { hipBase: 2.6, perShot: 0.55 }, recoil: { pitch: 0.65, yaw: 0.85 },
      sound: { kind: 'smg', body: 3200, thump: 160, crack: 0.65, tail: 0.3, pitch: 1.35, mech: true },
      view: { model: 'pm64', flash: 0.7 },
      upgrade: { name: 'Tiny Terror', color: '#c06c1e' },
    }),
    'AK-75u': gun('smg', {
      name: 'AK-75u', cost: 1200, ammoCost: 600,
      rpm: 800, damage: 56, headMult: 2.8, magSize: 20, reserve: 160, reloadTime: 2.3, reloadEmptyTime: 2.85,
      recoil: { pitch: 1.05, yaw: 0.6, viewKick: 0.75 },
      sound: { kind: 'ar', body: 2300, thump: 115, crack: 1.0, tail: 0.6, pitch: 1.0, mech: true },
      view: { model: 'ak75u', flash: 1.2 },
      upgrade: { name: 'AK-Stew', color: '#9c2a2a' },
    }),
    M17: gun('ar', {
      name: 'M17', cost: 1200, ammoCost: 600,
      fireMode: 'burst', burstCount: 3, burstDelay: 0.3, rpm: 900, damage: 72, magSize: 30, reserve: 120,
      reloadTime: 2.2, reloadEmptyTime: 2.7,
      spread: { hipBase: 2.4, perShot: 0.3, ads: 0.12, adsPerShot: 0.06 }, recoil: { pitch: 0.85, yaw: 0.3 },
      sound: { kind: 'ar', body: 2700, thump: 125, crack: 1.1, tail: 0.65, pitch: 1.05, mech: true },
      view: { model: 'm17', flash: 1.0 },
      upgrade: { name: 'Skull Burst', color: '#2f6f4f' },
    }),

    // ---- mystery box ----------------------------------------------------------
    CZ76: gun('pistol', {
      name: 'CZ76', boxOnly: true,
      rpm: 520, damage: 62, magSize: 12, reserve: 72, reloadTime: 1.6, reloadEmptyTime: 1.9,
      recoil: { pitch: 1.5 },
      sound: { kind: 'pistol', body: 2400, thump: 160, crack: 0.95, tail: 0.5, pitch: 1.08 },
      view: { model: 'cz76', flash: 0.9 },
      upgrade: { name: 'CZ Pro', color: '#5d6d7e' },
    }),
    'CZ76 Dual': gun('pistol', {
      name: 'CZ76 Dual Wield', boxOnly: true, dual: true,   // left click = right gun, right click = left gun
      rpm: 520, damage: 62, magSize: 12, reserve: 144, reloadTime: 2.1, reloadEmptyTime: 2.4,
      spread: { hipBase: 2.4 }, recoil: { pitch: 1.4 },
      sound: { kind: 'pistol', body: 2400, thump: 160, crack: 0.95, tail: 0.5, pitch: 1.08 },
      view: { model: 'cz76', flash: 0.9 },
      upgrade: { name: 'Dual CZ Pro', color: '#5d6d7e' },
    }),
    Spectur: gun('smg', {
      name: 'Spectur', boxOnly: true,
      rpm: 1000, damage: 46, magSize: 30, reserve: 180, reloadTime: 2.3, reloadEmptyTime: 2.8,
      recoil: { pitch: 0.8, yaw: 0.6 },
      sound: { kind: 'smg', body: 2800, thump: 140, crack: 0.8, tail: 0.4, pitch: 1.15, mech: true },
      view: { model: 'spectur', flash: 0.85 },
      upgrade: { name: 'Spectral Stew', color: '#5aa9c9' },
    }),
    FAMOS: gun('ar', {
      name: 'FAMOS', boxOnly: true,
      rpm: 930, damage: 70, magSize: 30, reserve: 210, reloadTime: 2.6, reloadEmptyTime: 3.1,
      recoil: { pitch: 1.05, yaw: 0.5 },
      sound: { kind: 'ar', body: 2600, thump: 120, crack: 1.0, tail: 0.6, pitch: 1.1, mech: true },
      view: { model: 'famos', flash: 1.0 },
      upgrade: { name: 'G16-SL Stew', color: '#2c3e50' },
    }),
    AWG: gun('ar', {
      name: 'AWG', boxOnly: true,
      rpm: 660, damage: 82, headMult: 3.5, magSize: 30, reserve: 210, reloadTime: 2.5, reloadEmptyTime: 3.0,
      adsFovMult: 0.5, adsTime: 0.26, scope: { sway: 0.08 },
      spread: { ads: 0.08, adsPerShot: 0.05 }, recoil: { pitch: 0.85, yaw: 0.35 },
      sound: { kind: 'ar', body: 2500, thump: 125, crack: 1.05, tail: 0.65, pitch: 1.0, mech: true },
      view: { model: 'awg', flash: 1.0 },
      upgrade: { name: 'AWG Overseer', color: '#3b5d3b' },
    }),
    Galill: gun('ar', {
      name: 'Galill', boxOnly: true,
      rpm: 700, damage: 92, headMult: 3, magSize: 35, reserve: 315, reloadTime: 2.7, reloadEmptyTime: 3.2,
      recoil: { pitch: 1.1, yaw: 0.45 },
      sound: { kind: 'ar', body: 2300, thump: 115, crack: 1.1, tail: 0.7, pitch: 0.95, mech: true },
      view: { model: 'galill', flash: 1.2 },
      upgrade: { name: 'Lamentation', color: '#8e2b2b' },
    }),
    G12: gun('ar', {
      name: 'G12', boxOnly: true,
      fireMode: 'burst', burstCount: 3, burstDelay: 0.24, rpm: 1500, damage: 84, magSize: 45, reserve: 270,
      reloadTime: 2.8, reloadEmptyTime: 3.2,
      spread: { perShot: 0.22, ads: 0.1, adsPerShot: 0.04 }, recoil: { pitch: 0.6, yaw: 0.25 },
      sound: { kind: 'ar', body: 3000, thump: 130, crack: 0.9, tail: 0.55, pitch: 1.2, mech: true },
      view: { model: 'g12', flash: 0.9 },
      upgrade: { name: 'G12 Futurist', color: '#4a90a4' },
    }),
    'SPAZ-13': gun('shotgun', {
      name: 'SPAZ-13', boxOnly: true,
      rpm: 260, damage: 76, pellets: 8, magSize: 8, reserve: 64,
      reloadStartTime: 0.35, shellTime: 0.42, reloadEndTime: 0.35,
      sound: { kind: 'shotgun', body: 1150, thump: 70, crack: 0.9, tail: 1.0, pitch: 0.85 },
      view: { model: 'spaz', flash: 1.9 },
      upgrade: { name: 'SPAZ-26', color: '#4d4d4d' },
    }),
    HS11: gun('shotgun', {
      name: 'HS11', boxOnly: true, dual: true,
      rpm: 300, damage: 66, pellets: 7, magSize: 6, reserve: 72, reloadStyle: 'mag', reloadTime: 3.0, reloadEmptyTime: 3.0,
      spread: { hipBase: 5.8 },
      sound: { kind: 'shotgun', body: 1200, thump: 75, crack: 0.9, tail: 0.95, pitch: 0.9 },
      view: { model: 'hs11', flash: 1.8 },
      upgrade: { name: 'Typhoid & Mary', color: '#6b3a5a' },
    }),
    HK22: gun('lmg', {
      name: 'HK22', boxOnly: true,
      rpm: 620, damage: 112, magSize: 125, reserve: 500, reloadTime: 5.6, reloadEmptyTime: 5.6,
      recoil: { pitch: 1.8, yaw: 1.1, viewKick: 1.2 },
      sound: { kind: 'lmg', body: 2100, thump: 105, crack: 1.15, tail: 0.85, pitch: 0.9, mech: true },
      view: { model: 'hk22', flash: 1.4 },
      upgrade: { name: 'H115 Oscillator', color: '#5a5a2a' },
    }),
    RPKK: gun('lmg', {
      name: 'RPKK', boxOnly: true,
      rpm: 650, damage: 96, magSize: 100, reserve: 400, reloadStyle: 'mag', reloadTime: 4.4, reloadEmptyTime: 4.8,
      recoil: { pitch: 1.3, yaw: 0.8 },
      sound: { kind: 'lmg', body: 2200, thump: 110, crack: 1.1, tail: 0.8, pitch: 0.95, mech: true },
      view: { model: 'rpkk', flash: 1.3 },
      upgrade: { name: "R115 Resonator", color: '#7a4b1e' },
    }),
    Dragunoff: gun('sniper', {
      name: 'Dragunoff', boxOnly: true,
      rpm: 230, damage: 420, headMult: 3, magSize: 10, reserve: 40, penetration: 3,
      reloadTime: 2.7, reloadEmptyTime: 3.2, adsFovMult: 0.36,
      sound: { kind: 'sniper', body: 1800, thump: 90, crack: 1.4, tail: 1.3, pitch: 0.9 },
      view: { model: 'dragunoff', flash: 1.5 },
      upgrade: { name: 'D115 Disassembler', color: '#6e4b2a' },
    }),
    L97A1: gun('sniper', {
      name: 'L97A1', boxOnly: true,
      action: 'bolt', rpm: 52, damage: 1100, headMult: 2, magSize: 5, reserve: 50, penetration: 5,
      reloadTime: 3.0, reloadEmptyTime: 3.6, adsFovMult: 0.28,
      recoil: { pitch: 6.5, viewKick: 2.6 },
      sound: { kind: 'sniper', body: 1600, thump: 80, crack: 1.5, tail: 1.5, pitch: 0.82 },
      view: { model: 'l97', flash: 1.6 },
      upgrade: { name: 'L115 Isolator', color: '#3d5c3d' },
    }),
    'China Pond': gun('launcher', {
      name: 'China Pond', boxOnly: true,
      action: 'pump', rpm: 60, damage: 0, magSize: 2, reserve: 20,
      projectile: { type: 'launcher', speed: 34, gravity: 9.8, explode: 'launcher' },
      sound: { kind: 'launcher', body: 600, thump: 60, crack: 0.3, tail: 0.6, pitch: 1 },
      view: { model: 'chinapond', flash: 1.2 },
      upgrade: { name: 'China Beach', color: '#2e5e8e' },
    }),
    'Kross-Bow': gun('launcher', {
      name: 'Kross-Bow', boxOnly: true,
      rpm: 70, damage: 0, magSize: 1, reserve: 10, reloadStyle: 'mag', reloadTime: 2.4, reloadEmptyTime: 2.4,
      adsFovMult: 0.5, scope: { sway: 0.1 },
      projectile: { type: 'bolt', speed: 55, gravity: 4, impactDamage: 120, fuse: 1.0, explode: 'bolt' },
      spread: { hipBase: 1.2, ads: 0.05 },
      sound: { kind: 'crossbow', body: 900, thump: 120, crack: 0.2, tail: 0.3, pitch: 1 },
      view: { model: 'krossbow', flash: 0 },
      upgrade: { name: 'Awful Lawton', color: '#8e6b2a' },
    }),
    'Ballistik Knife': gun('pistol', {
      name: 'Ballistik Knife', boxOnly: true,
      rpm: 60, damage: 0, magSize: 1, reserve: 5, reloadTime: 2.6, reloadEmptyTime: 2.6,
      meleeMult: 2,          // knife hits twice as hard while you hold it
      projectile: { type: 'blade', speed: 42, gravity: 3, impactDamage: 650, headMult: 2 },
      spread: { hipBase: 0.8, ads: 0.1 },
      sound: { kind: 'blade', body: 700, thump: 140, crack: 0.2, tail: 0.2, pitch: 1 },
      view: { model: 'bknife', flash: 0 },
      upgrade: { name: 'Krauss Refibrillator', color: '#7a1f1f' },
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
    },
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
  },

  // Explosion types: radius (m), damage at the center to zombies, and
  // selfDamage = damage to the player who caused it if they're at the center.
  explosions: {
    frag: { radius: 4.5, damage: 1100, selfDamage: 120, minFrac: 0.15, shake: 1.0 },
    launcher: { radius: 3.6, damage: 1300, selfDamage: 80, minFrac: 0.2, shake: 0.9 },
    bolt: { radius: 2.8, damage: 1000, selfDamage: 60, minFrac: 0.2, shake: 0.6 },
    cookedOff: { radius: 4.5, damage: 1100, selfDamage: 160, minFrac: 0.15, shake: 1.2 },
  },

  interaction: {
    range: 1.8,                // default reach for buyables
    lookAngle: 65,             // must be roughly facing it (degrees off-center)
  },

  // ---------------------------------------------------------------------------
  // Visuals
  // ---------------------------------------------------------------------------
  graphics: {
    renderScale: 1.0,
    maxPixelRatio: 1.5,
    fogColor: '#17140f',
    fogDensity: 0.034,
    exposure: 1.2,
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
    ambientLight: 0.32,      // pre-power base light
    viewmodelFov: 54,
    maxPointLights: 10,      // nearest lights are streamed into this many real lights
    maxSpotLights: 4,
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
