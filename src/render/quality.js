// =============================================================================
// Graphics quality: turns the Settings › Graphics choices into what each part
// of the renderer does (light counts, particle and mark budgets, model detail,
// resolution). The numbers behind each level live in CONFIG.graphics.
// =============================================================================
import { setRealGuns } from './gunModels.js';

const BASE = {};          // the config's own budgets, before any scaling

export function applyQuality(r, s) {
  const g = r.cfg.graphics;
  for (const k of ['maxBloodDecals', 'maxBulletHoles', 'maxBloodPools', 'corpseTime']) if (BASE[k] == null) BASE[k] = g[k];

  // effects: particles, dust, snow, blood and bullet marks, bodies
  const e = g.effectLevels[s.effects] || g.effectLevels.high;
  g.fxScale = e.fx;
  g.maxBloodDecals = Math.max(8, Math.round(BASE.maxBloodDecals * e.marks));
  g.maxBulletHoles = Math.max(10, Math.round(BASE.maxBulletHoles * e.marks));
  g.maxBloodPools = Math.max(3, Math.round(BASE.maxBloodPools * e.marks));
  g.corpseTime = Math.min(BASE.corpseTime, e.corpseTime);

  // dynamic lights
  const [np, ns] = g.lightLevels[s.lights] || g.lightLevels.high;
  g.activePointLights = Math.min(np, g.maxPointLights);
  g.activeSpotLights = Math.min(ns, g.maxSpotLights);

  for (const w of r.worlds ? r.worlds.values() : []) {
    if (w.map.setLightBudget) w.map.setLightBudget(g.activePointLights, g.activeSpotLights);
    if (w.effects.setDetail) w.effects.setDetail(g.fxScale);
    if (w.map.crust) w.map.crust.setDetail(g.fxScale);
    w.zombies.simple = s.zombieModels === 'simple';
  }

  // guns: the detailed (loaded) models or the built-in low-poly ones
  const real = s.gunModels !== 'simple';
  if (r.realGuns !== real) {
    const first = r.realGuns == null;
    r.realGuns = real;
    setRealGuns(real);
    if (!first && r.viewmodel.resetModels) r.viewmodel.resetModels();
  }
}

// Auto resolution: watches the frame time and nudges a multiplier on the
// render scale. Called once per drawn frame with that frame's length (s).
export class AutoRes {
  constructor(cfg) {
    this.c = cfg.graphics.autoRes;
    this.scale = 1;
    this.t = 0; this.n = 0; this.sum = 0;
  }

  reset() { this.scale = 1; this.t = 0; this.n = 0; this.sum = 0; }

  // returns true when the scale changed (the caller resizes)
  sample(dt, targetFps) {
    if (dt <= 0 || dt > 0.25) return false;          // a hitch or a hidden tab
    this.t += dt; this.n++; this.sum += dt;
    if (this.t < this.c.every) return false;
    const fps = this.n / this.sum;
    this.t = 0; this.n = 0; this.sum = 0;
    let s = this.scale;
    if (fps < targetFps * this.c.low) s = Math.max(this.c.min, s - this.c.step);
    else if (fps > targetFps * this.c.high) s = Math.min(1, s + this.c.step * 0.5);
    if (Math.abs(s - this.scale) < 0.001) return false;
    this.scale = s;
    return true;
  }
}
