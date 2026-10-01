// =============================================================================
// Recorded gun sounds. Gunshots and gun mechanics from "The Free Firearm
// Sound Library" by Still North Media (Ben Jaszczak, Brian Nelson, Kevin
// Heras, Matthew Nanney), released CC0 (public domain). Each gunshot was cut
// from the near-distance close-mic recordings; files live in assets/sfx/guns.
// =============================================================================

// sample key -> files (variants are picked at random)
export const GUN_SAMPLES = {
  p45: ["p45_1", "p45_2"],
  ppq: ["ppq_1", "ppq_2", "ppq_3"],
  bersa: ["bersa_1", "bersa_2"],
  rev38: ["rev38_1", "rev38_2"],
  smg9: ["smg9_1", "smg9_2", "smg9_3"],
  ppsh: ["ppsh_1", "ppsh_2", "ppsh_3", "ppsh_4"],
  ak: ["ak_1", "ak_2", "ak_3", "ak_4"],
  ar15: ["ar15_1", "ar15_2"],
  sks: ["sks_1", "sks_2", "sks_3", "sks_4"],
  r3006: ["r3006_1", "r3006_2"],
  tikka: ["tikka_1", "tikka_2"],
  mosin: ["mosin_1", "mosin_2", "mosin_3", "mosin_4"],
  blackout: ["blackout_1", "blackout_2"],
  sg12: ["sg12_1", "sg12_2"],
  nova: ["nova_1", "nova_2"],
  cd: ["cd_1", "cd_2"],
  mossberg: ["mossberg_1", "mossberg_2"],
  m_pistol_out: ["m_pistol_out"],
  m_pistol_in: ["m_pistol_in"],
  m_pistol_slide: ["m_pistol_slide"],
  m_pistol_dry: ["m_pistol_dry"],
  m_ak_out: ["m_ak_out"],
  m_ak_in: ["m_ak_in"],
  m_ak_bolt: ["m_ak_bolt"],
  m_ak_dry: ["m_ak_dry"],
  m_ar_out: ["m_ar_out"],
  m_ar_in: ["m_ar_in"],
  m_ar_bolt: ["m_ar_bolt"],
  m_smg_out: ["m_smg_out"],
  m_smg_in: ["m_smg_in"],
  m_smg_bolt: ["m_smg_bolt"],
  m_pump: ["m_pump"],
  m_shell: ["m_shell"],
  m_shell2: ["m_shell2"],
  m_bolt: ["m_bolt"],
  m_bolt_round: ["m_bolt_round"],
  m_cyl_open: ["m_cyl_open"],
  m_cyl_close: ["m_cyl_close"],
  m_cyl_eject: ["m_cyl_eject"],
  m_cyl_load: ["m_cyl_load"],
};

// Which recording each weapon fires with. rate = playback speed (pitch),
// gain = loudness, sub = extra synthesized low thump for weight.
export const GUN_VOICES = {
  M1912: { s: 'p45', gain: 0.9, sub: 0.5 },
  M15: { s: ['r3006', 'tikka'], gain: 1.0, rate: 1.04, sub: 0.7 },
  Olympus: { s: 'cd', gain: 1.1, rate: 0.96, sub: 1 },
  MP41: { s: 'smg9', gain: 0.85, sub: 0.35 },
  Pyton: { s: 'rev38', gain: 1.0, rate: 0.9, sub: 0.8 },
  Komando: { s: 'ar15', gain: 0.9, sub: 0.45 },
  Staykout: { s: ['sg12', 'nova'], gain: 1.1, sub: 1 },
  MP6K: { s: 'smg9', gain: 0.8, rate: 1.06, sub: 0.3 },
  MPK: { s: 'ppq', gain: 0.75, rate: 1.08, sub: 0.25 },
  PM64: { s: 'ppsh', gain: 0.75, rate: 1.12, sub: 0.25 },
  'AK-75u': { s: 'ak', gain: 0.9, rate: 1.03, sub: 0.45 },
  M17: { s: 'ar15', gain: 0.9, rate: 1.03, sub: 0.4 },
  CZ76: { s: 'ppq', gain: 0.85, sub: 0.35 },
  'CZ76 Dual': { s: 'ppq', gain: 0.8, sub: 0.3 },
  Spectur: { s: 'smg9', gain: 0.75, rate: 1.1, sub: 0.25 },
  FAMOS: { s: 'ar15', gain: 0.85, rate: 1.07, sub: 0.35 },
  AWG: { s: 'ar15', gain: 0.9, rate: 0.97, sub: 0.45 },
  Galill: { s: 'ak', gain: 0.9, rate: 0.98, sub: 0.5 },
  G12: { s: 'ar15', gain: 0.8, rate: 1.12, sub: 0.3 },
  'SPAZ-13': { s: 'nova', gain: 1.1, rate: 0.97, sub: 1 },
  HS11: { s: 'mossberg', gain: 1.05, sub: 0.9 },
  HK22: { s: 'sks', gain: 1.0, rate: 0.95, sub: 0.8 },
  RPKK: { s: 'ak', gain: 1.0, rate: 0.93, sub: 0.8 },
  Dragunoff: { s: 'mosin', gain: 1.1, rate: 1.0, sub: 1 },
  L97A1: { s: ['tikka', 'blackout'], gain: 1.15, rate: 0.95, sub: 1.1 },
};

// Reload / action mechanics by kind of gun.
export const MECH_SETS = {
  pistol: { out: 'm_pistol_out', in: 'm_pistol_in', bolt: 'm_pistol_slide', dry: 'm_pistol_dry' },
  ak: { out: 'm_ak_out', in: 'm_ak_in', bolt: 'm_ak_bolt', dry: 'm_ak_dry' },
  ar: { out: 'm_ar_out', in: 'm_ar_in', bolt: 'm_ar_bolt', dry: 'm_ak_dry' },
  smg: { out: 'm_smg_out', in: 'm_smg_in', bolt: 'm_smg_bolt', dry: 'm_pistol_dry' },
  shotgun: { pump: 'm_pump', shell: ['m_shell', 'm_shell2'], dry: 'm_ak_dry' },
  bolt: { bolt: 'm_bolt', shell: 'm_bolt_round', out: 'm_ak_out', in: 'm_ak_in', dry: 'm_ak_dry' },
  revolver: { open: 'm_cyl_open', close: 'm_cyl_close', eject: 'm_cyl_eject', shell: 'm_cyl_load', dry: 'm_pistol_dry' },
};

// Which mechanics set a weapon uses.
export function mechSetFor(id, def) {
  const base = id.replace(/\+$/, '');
  if (def.reloadStyle === 'cylinder') return MECH_SETS.revolver;
  if (def.class === 'shotgun') return MECH_SETS.shotgun;
  if (def.action === 'bolt' || def.class === 'sniper') return MECH_SETS.bolt;
  if (def.class === 'pistol') return MECH_SETS.pistol;
  if (def.class === 'smg') return /AK/.test(base) ? MECH_SETS.ak : MECH_SETS.smg;
  if (/AK|Galill|RPK|HK/.test(base)) return MECH_SETS.ak;
  return MECH_SETS.ar;
}

export const SAMPLE_BASE = 'assets/sfx/guns/';
