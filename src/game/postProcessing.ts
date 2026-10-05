/**
 * SUPERHOT Post-Processing Engine
 * Ultra-Optimized Single-Pass Composite Shader Architecture
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { GameSettings } from './settingsManager';

/** High performance motion blur for camera/player velocity */
export const MotionBlurShader = {
  name: 'MotionBlurShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    velocity: { value: new THREE.Vector2(0, 0) },
    enabled: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 velocity;
    uniform float enabled;
    varying vec2 vUv;
    void main() {
      if (enabled < 0.5 || length(velocity) < 0.0001) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }
      vec4 color = vec4(0.0);
      vec2 vel = clamp(velocity, vec2(-0.025), vec2(0.025));
      for (int i = 0; i < 7; i++) {
        float t = float(i) / 6.0 - 0.5;
        color += texture2D(tDiffuse, vUv + vel * t);
      }
      gl_FragColor = color / 7.0;
    }
  `,
};

/**
 * Unified High-Performance Superhot Composite Shader
 * Fuses Hue/Sat, Brightness/Contrast, Sharpen, Vignette, and Edge Chromatic Aberration
 * into ONE SINGLE full-screen render pass, saving 5 full-screen render target swaps per frame!
 */
export const SuperhotCompositeShader = {
  name: 'SuperhotCompositeShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1280, 720) },
    sharpness: { value: 0.15 },
    sharpenEnabled: { value: 1.0 },
    saturation: { value: -0.08 },
    brightness: { value: 0.01 },
    contrast: { value: 0.06 },
    vignetteOffset: { value: 1.25 },
    vignetteDarkness: { value: 0.45 },
    vignetteEnabled: { value: 1.0 },
    rgbShiftAmount: { value: 0.0008 },
    rgbShiftAngle: { value: 0.0 },
    rgbShiftEnabled: { value: 0.0 },
    progress: { value: 1.0 },
    time: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float sharpness;
    uniform float sharpenEnabled;
    uniform float saturation;
    uniform float brightness;
    uniform float contrast;
    uniform float vignetteOffset;
    uniform float vignetteDarkness;
    uniform float vignetteEnabled;
    uniform float rgbShiftAmount;
    uniform float rgbShiftAngle;
    uniform float rgbShiftEnabled;
    varying vec2 vUv;

    vec3 applyHueSat(vec3 rgb, float sat) {
      float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
      return mix(vec3(luma), rgb, 1.0 + sat);
    }

    void main() {
      vec2 texel = 1.0 / resolution;
      vec4 color = texture2D(tDiffuse, vUv);

      // 1. Edge RGB Chromatic Aberration
      if (rgbShiftEnabled > 0.5 && rgbShiftAmount > 0.0) {
        float dist = length(vUv - vec2(0.5));
        float edge = smoothstep(0.28, 0.72, dist);
        vec2 offset = rgbShiftAmount * edge * vec2(cos(rgbShiftAngle), sin(rgbShiftAngle));
        float r = texture2D(tDiffuse, vUv + offset).r;
        float g = color.g;
        float b = texture2D(tDiffuse, vUv - offset).b;
        color.rgb = vec3(r, g, b);
      }

      // 2. Sharpening Filter
      if (sharpenEnabled > 0.5 && sharpness > 0.0) {
        vec4 top    = texture2D(tDiffuse, vUv + vec2(0.0,  texel.y));
        vec4 bottom = texture2D(tDiffuse, vUv + vec2(0.0, -texel.y));
        vec4 left   = texture2D(tDiffuse, vUv + vec2(-texel.x, 0.0));
        vec4 right  = texture2D(tDiffuse, vUv + vec2( texel.x, 0.0));
        color = clamp(color + sharpness * (4.0 * color - top - bottom - left - right), 0.0, 1.0);
      }

      // 3. Hue / Saturation
      if (abs(saturation) > 0.001) {
        color.rgb = applyHueSat(color.rgb, saturation);
      }

      // 4. Brightness & Contrast
      if (abs(brightness) > 0.001 || abs(contrast) > 0.001) {
        color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5 + brightness;
      }

      // 5. Vignette Shading
      if (vignetteEnabled > 0.5) {
        vec2 uv = (vUv - 0.5) * vignetteOffset;
        float vecDist = length(uv);
        color.rgb = mix(color.rgb, vec3(0.0), smoothstep(0.5, 1.5, vecDist * vignetteDarkness));
      }

      gl_FragColor = color;
    }
  `,
};

export interface PostProcessingResult {
  composer: EffectComposer;
  bokehPass: BokehPass;
  gtaoPass: GTAOPass | SSAOPass;
  bloomPass: UnrealBloomPass;
  filmPass: FilmPass;
  sharpenPass: ShaderPass;
  vignettePass: ShaderPass;
  rgbShiftPass: ShaderPass;
  constructPass: ShaderPass;
  compositePass: ShaderPass;
  motionBlurPass: ShaderPass;
}

export const initPostProcessing = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number
): PostProcessingResult => {
  const composer = new EffectComposer(renderer);

  composer.addPass(new RenderPass(scene, camera));

  let aoPass: GTAOPass | SSAOPass;
  try {
    const gtao = new GTAOPass(scene, camera, width, height);
    gtao.output = GTAOPass.OUTPUT.Default;
    (gtao as any).gtaoMaterial.uniforms['radius'].value = 0.55;
    composer.addPass(gtao);
    aoPass = gtao;
  } catch {
    const ssao = new SSAOPass(scene, camera, width, height);
    ssao.kernelRadius = 0.55;
    composer.addPass(ssao);
    aoPass = ssao;
  }

  // Motion Blur Pass
  const motionBlurPass = new ShaderPass(MotionBlurShader);
  motionBlurPass.uniforms['enabled'].value = 0.0;
  composer.addPass(motionBlurPass);

  // Bloom Pass
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.18, 0.35, 0.88);
  composer.addPass(bloomPass);

  // DOF Bokeh Pass
  const bokehPass = new BokehPass(scene, camera, {
    focus: 10.0,
    aperture: 0.000015,
    maxblur: 0.001,
  });
  composer.addPass(bokehPass);

  // Film Pass
  const filmPass = new FilmPass(0.005, false);
  composer.addPass(filmPass);

  // Unified High-Performance Superhot Composite Shader Pass (Fuses 5 passes into 1)
  const compositePass = new ShaderPass(SuperhotCompositeShader);
  compositePass.uniforms['resolution'].value.set(width, height);
  composer.addPass(compositePass);

  composer.addPass(new OutputPass());

  return {
    composer,
    bokehPass,
    gtaoPass: aoPass,
    bloomPass,
    filmPass,
    sharpenPass: compositePass,
    vignettePass: compositePass,
    rgbShiftPass: compositePass,
    constructPass: compositePass,
    compositePass,
    motionBlurPass,
  };
};

export const resizePostProcessing = (
  result: PostProcessingResult,
  width: number,
  height: number
): void => {
  result.composer.setSize(width, height);
  result.bloomPass.setSize(width, height);
  if (result.compositePass) {
    result.compositePass.uniforms['resolution'].value.set(width, height);
  }
};

export const applyPostProcessingPreset = (
  result: PostProcessingResult,
  settings: GameSettings
): void => {
  const p = settings.preset;

  if (result.bloomPass) {
    result.bloomPass.enabled = settings.bloomEnabled && p !== 'basica';
  }
  if (result.motionBlurPass) {
    result.motionBlurPass.uniforms['enabled'].value = (settings.motionBlurEnabled && p !== 'basica') ? 1.0 : 0.0;
  }
  if (result.gtaoPass) {
    result.gtaoPass.enabled = p === 'ultra' || p === 'ultra_max';
  }
  if (result.bokehPass) {
    result.bokehPass.enabled = p === 'ultra_max';
  }
  if (result.filmPass) {
    result.filmPass.enabled = p === 'ultra' || p === 'ultra_max';
  }
  if (result.compositePass) {
    result.compositePass.uniforms['sharpenEnabled'].value = (p === 'alta' || p === 'ultra' || p === 'ultra_max') ? 1.0 : 0.0;
    result.compositePass.uniforms['rgbShiftEnabled'].value = p === 'ultra_max' ? 1.0 : 0.0;
  }
};
