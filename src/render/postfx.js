// =============================================================================
// Post-processing: bloom, then a late-2000s grade (desaturate, warm sepia,
// contrast), vignette, film grain, damage flash and screen tints.
// =============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    grain: { value: 0.07 },
    vignette: { value: 0.85 },
    sepia: { value: 0.22 },
    desat: { value: 0.38 },
    contrast: { value: 1.08 },
    damage: { value: 0 },
    lowHealth: { value: 0 },
    flash: { value: 0 },
    tint: { value: new THREE.Vector4(1, 0.85, 0.3, 0) }, // rgb + amount (for later: Cheddar haze)
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float time, grain, vignette, sepia, desat, contrast, damage, lowHealth, flash;
    uniform vec4 tint;
    uniform vec2 resolution;
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main() {
      vec2 uv = vUv;
      // slight chromatic fringe toward the edges
      vec2 dc = uv - 0.5;
      float edge = dot(dc, dc);
      float ca = 0.0016 * edge * 4.0 + damage * 0.004;
      vec3 c;
      c.r = texture2D(tDiffuse, uv + dc * ca).r;
      c.g = texture2D(tDiffuse, uv).g;
      c.b = texture2D(tDiffuse, uv - dc * ca).b;

      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, vec3(l), clamp(desat + lowHealth * 0.4, 0.0, 1.0));
      vec3 sep = vec3(l * 1.08 + 0.02, l * 0.96 + 0.01, l * 0.76);
      c = mix(c, sep, sepia);
      // lift blacks a hair toward olive, like old console gamma
      c = c + vec3(0.012, 0.012, 0.004) * (1.0 - l);
      c = (c - 0.5) * contrast + 0.5;

      // tints (Cheddar haze etc.)
      c = mix(c, c * 0.6 + tint.rgb * 0.5, tint.a);

      // vignette
      float d = length(dc * vec2(1.0, 0.85));
      float v = smoothstep(0.85, 0.25, d);
      c *= mix(1.0, v, vignette);

      // damage: red rim + desat
      float rim = smoothstep(0.25, 0.75, d);
      c = mix(c, vec3(0.35, 0.02, 0.01), rim * damage * 0.9);
      c = mix(c, vec3(0.25, 0.0, 0.0), rim * lowHealth * 0.55 * (0.75 + 0.25 * sin(time * 6.0)));

      // flash (nuke etc.)
      c = mix(c, vec3(1.0, 0.97, 0.9), flash);

      // film grain
      float n = hash(uv * resolution + fract(time * 13.7) * 100.0) - 0.5;
      c += n * grain * (0.6 + 0.8 * (1.0 - l));

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
    this.vmPass = new RenderPass(vmScene, vmCamera);
    this.vmPass.clear = false;
    this.vmPass.clearDepth = true;
    this.composer.addPass(this.vmPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), g.bloomStrength, g.bloomRadius, g.bloomThreshold);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    const u = this.grade.uniforms;
    u.grain.value = g.grain; u.vignette.value = g.vignette; u.sepia.value = g.sepia;
    u.desat.value = g.desaturate; u.contrast.value = g.contrast;
    this.composer.addPass(this.grade);
  }

  setSize(w, h, pr) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.grade.uniforms.resolution.value.set(w * pr, h * pr);
  }

  setGrain(on) { this.grade.uniforms.grain.value = on ? this.cfg.graphics.grain : 0; }
  setBloom(on) { this.bloom.enabled = on; }

  render(dt, state) {
    const u = this.grade.uniforms;
    u.time.value += dt;
    u.damage.value = state.damage;
    u.lowHealth.value = state.lowHealth;
    u.flash.value = state.flash || 0;
    this.composer.render(dt);
  }
}
