// =============================================================================
// Post-processing: ambient occlusion (optional), bloom, then a 2010-console
// style grade, vignette, film grain, damage flash and screen tints.
// =============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

// The grade aims at the 2010 Treyarch zombies look: crushed, slightly cool
// shadows, warm practical light, a filmic S-curve, heavy-ish desaturation,
// a little sharpening, chromatic fringe at the edges, fine grain, vignette.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    grain: { value: 0.06 },
    vignette: { value: 0.9 },
    desat: { value: 0.32 },
    contrast: { value: 1.18 },
    shadowTint: { value: new THREE.Vector3(0.86, 0.96, 1.1) },
    highTint: { value: new THREE.Vector3(1.07, 0.99, 0.86) },
    split: { value: 0.75 },
    sharpen: { value: 0.35 },
    damage: { value: 0 },
    lowHealth: { value: 0 },
    brink: { value: 0 },
    flash: { value: 0 },
    tint: { value: new THREE.Vector4(1, 0.85, 0.3, 0) }, // rgb + amount (Cheddar haze)
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float time, grain, vignette, desat, contrast, split, sharpen, damage, lowHealth, brink, flash;
    uniform vec3 shadowTint, highTint;
    uniform vec4 tint;
    uniform vec2 resolution;
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    // smooth value noise, for the blood on the screen edges
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c2 = hash(i + vec2(0.0, 1.0)), d2 = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c2, d2, f.x), f.y);
    }
    float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.1 + 7.3) * 0.3 + vnoise(p * 4.3 + 3.1) * 0.15; }
    vec3 fetch(vec2 uv, vec2 dc, float ca) {
      return vec3(texture2D(tDiffuse, uv + dc * ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dc * ca).b);
    }
    void main() {
      vec2 uv = vUv;
      vec2 dc = uv - 0.5;
      float edge = dot(dc, dc);
      float ca = 0.0022 * edge * 4.0 + damage * 0.005;
      vec3 c = fetch(uv, dc, ca);
      // unsharp mask (crisp console-era edges)
      vec2 px = 1.0 / resolution;
      vec3 blur = (texture2D(tDiffuse, uv + vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, uv - vec2(px.x, 0.0)).rgb
                 + texture2D(tDiffuse, uv + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, uv - vec2(0.0, px.y)).rgb) * 0.25;
      c += (c - blur) * sharpen;

      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // desaturate (more when hurt)
      c = mix(c, vec3(l), clamp(desat + lowHealth * 0.45, 0.0, 1.0));
      // split tone: cool shadows, warm highlights
      float hi = smoothstep(0.18, 0.75, l);
      c *= mix(vec3(1.0), mix(shadowTint, highTint, hi), split);
      // filmic S-curve around mid grey, blacks crushed a touch
      c = max(c - 0.012, 0.0);
      vec3 s = c * c * (3.0 - 2.0 * c);
      c = mix(c, s, clamp(contrast - 1.0, 0.0, 1.0) * 1.6);
      c = (c - 0.5) * (1.0 + (contrast - 1.0) * 0.4) + 0.5;

      // tints (Cheddar haze etc.)
      c = mix(c, c * 0.6 + tint.rgb * 0.5, tint.a);

      // vignette
      float d = length(dc * vec2(1.0, 0.8));
      float v = smoothstep(0.9, 0.22, d);
      c *= mix(1.0, v, vignette);

      // damage: red rim + desat
      float rim = smoothstep(0.25, 0.75, d);
      c = mix(c, vec3(0.35, 0.02, 0.01), rim * damage * 0.9);
      c = mix(c, vec3(0.25, 0.0, 0.0), rim * lowHealth * 0.55 * (0.75 + 0.25 * sin(time * 6.0)));
      // one hit from going down: a thick red border that throbs like a heartbeat
      float beat = pow(0.5 + 0.5 * sin(time * 7.5), 6.0) + pow(0.5 + 0.5 * sin(time * 7.5 - 0.9), 10.0) * 0.6;
      float brinkEdge = smoothstep(0.24, 0.74, d);
      if (brink > 0.001) {
        // blood on the lens: splotchy clots creeping in from the edges, wet streaks running
        // down from the top, all pulsing with the heartbeat
        float pulse = 0.62 + 0.38 * beat;
        float edgeReach = brinkEdge * (0.85 + 0.15 * beat);
        float blot = fbm(uv * vec2(4.2, 3.0) + 5.0);
        float clots = smoothstep(0.42, 0.58, blot + edgeReach * 0.85);
        float fine = fbm(uv * vec2(14.0, 10.0) + 11.0);
        float spatter = smoothstep(0.58, 0.72, fine + edgeReach * 0.55) * edgeReach;
        float drip = vnoise(vec2(uv.x * 22.0, 3.0));
        float run = smoothstep(0.55, 0.78, drip) * smoothstep(0.55, 1.0, uv.y) * smoothstep(0.55, 0.95, uv.y + (drip - 0.5) * 0.5 + beat * 0.03);
        float blood = clamp(clots * edgeReach * 1.35 + spatter * 0.6 + run * 0.6 * brinkEdge, 0.0, 1.0) * brink;
        float wet = smoothstep(0.62, 0.9, fbm(uv * vec2(9.0, 6.0) + 21.0));   // glossy highlights on the clots
        vec3 bloodCol = mix(vec3(0.34, 0.0, 0.01), vec3(0.62, 0.03, 0.03), pulse * 0.6) + wet * vec3(0.18, 0.04, 0.04);
        c = mix(c, bloodCol, clamp(blood * (0.7 + 0.3 * pulse), 0.0, 0.95));
        c = mix(c, vec3(0.45, 0.0, 0.0), brinkEdge * brink * 0.18 * pulse);   // a faint red haze over the rest
      }

      // flash (Pressure Cooker etc.)
      c = mix(c, vec3(1.0, 0.97, 0.9), flash);

      // fine film grain, stronger in the darks
      float n = hash(uv * resolution + fract(time * 13.7) * 100.0) - 0.5;
      c += n * grain * (0.5 + 0.9 * (1.0 - clamp(l * 1.5, 0.0, 1.0)));

      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera, vmScene, vmCamera, cfg) {
    this.cfg = cfg;
    const g = cfg.graphics;
    // multisampled HDR target so edges stay clean through the post chain
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.mainPass = new RenderPass(scene, camera);
    this.composer.addPass(this.mainPass);
    // ambient occlusion on the world (not the gun), at half resolution
    this.ao = new GTAOPass(scene, camera, Math.max(1, size.x >> 1), Math.max(1, size.y >> 1));
    this.ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 12 });
    this.ao.blendIntensity = g.aoIntensity ?? 0.9;
    const aoSize = this.ao.setSize.bind(this.ao);
    this.ao.setSize = (w, h) => aoSize(Math.max(1, Math.ceil(w / 2)), Math.max(1, Math.ceil(h / 2)));
    this.ao.enabled = g.ao !== false;
    // Only solid things cast AO: hide light beams, glass, sprites, particles
    // and other see-through meshes from its depth/normal pass.
    const hidden = [];
    this.ao.overrideVisibility = function () {
      hidden.length = 0;
      this.scene.traverseVisible((o) => {
        const m = o.material;
        if (o.isPoints || o.isLine || o.isSprite || (m && (Array.isArray(m) ? m.some((x) => x.transparent) : m.transparent || m.isMeshBasicMaterial))) hidden.push(o);
      });
      for (const o of hidden) o.visible = false;
    };
    this.ao.restoreVisibility = function () { for (const o of hidden) o.visible = true; hidden.length = 0; };
    this.composer.addPass(this.ao);
    this.vmPass = new RenderPass(vmScene, vmCamera);
    this.vmPass.clear = false;
    this.vmPass.clearDepth = true;
    this.composer.addPass(this.vmPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), g.bloomStrength, g.bloomRadius, g.bloomThreshold);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    const u = this.grade.uniforms;
    u.grain.value = g.grain; u.vignette.value = g.vignette;
    u.desat.value = g.desaturate; u.contrast.value = g.contrast;
    u.split.value = g.splitTone; u.sharpen.value = g.sharpen;
    u.shadowTint.value.set(...g.shadowTint); u.highTint.value.set(...g.highlightTint);
    this.composer.addPass(this.grade);
  }

  setSize(w, h, pr) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.grade.uniforms.resolution.value.set(w * pr, h * pr);
  }

  setGrain(on) { this.grade.uniforms.grain.value = on ? this.cfg.graphics.grain : 0; }
  setBloom(on) { this.bloom.enabled = on; }
  setAO(on) { this.ao.enabled = !!on; }
  // the AO pass renders its own depth/normals from this scene
  setScene(scene) { this.mainPass.scene = scene; this.ao.scene = scene; }

  render(dt, state) {
    const u = this.grade.uniforms;
    u.time.value += dt;
    u.damage.value = state.damage;
    u.lowHealth.value = state.lowHealth;
    u.brink.value = state.brink || 0;
    u.flash.value = state.flash || 0;
    u.tint.value.w = state.tint || 0;
    this.composer.render(dt);
  }
}
