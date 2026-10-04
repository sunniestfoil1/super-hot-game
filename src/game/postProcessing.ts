/**
 * SUPERHOT Post-Processing
 * Motion Blur, CA, Bloom, Film Pass, and Quality Preset Controls
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
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { HueSaturationShader } from 'three/examples/jsm/shaders/HueSaturationShader.js';
import { BrightnessContrastShader } from 'three/examples/jsm/shaders/BrightnessContrastShader.js';

const SharpenShader = {
  name: 'SharpenShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1280, 720) },
    sharpness: { value: 0.28 },
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
    varying vec2 vUv;
    void main() {
      vec2 texel = 1.0 / resolution;
      vec4 center = texture2D(tDiffuse, vUv);
      vec4 top    = texture2D(tDiffuse, vUv + vec2(0.0,  texel.y));
      vec4 bottom = texture2D(tDiffuse, vUv + vec2(0.0, -texel.y));
      vec4 left   = texture2D(tDiffuse, vUv + vec2(-texel.x, 0.0));
      vec4 right  = texture2D(tDiffuse, vUv + vec2( texel.x, 0.0));
      vec4 sharpened = center + sharpness * (4.0 * center - top - bottom - left - right);
      gl_FragColor = clamp(sharpened, 0.0, 1.0);
    }
  `,
};

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

/** Chromatic aberration ONLY at screen edges (not center). */
const EdgeRGBShiftShader = {
  name: 'EdgeRGBShiftShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    amount: { value: 0.0025 },
    angle: { value: 0.0 },
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
    uniform float amount;
    uniform float angle;
    varying vec2 vUv;
    void main() {
      float dist = length(vUv - vec2(0.5));
      float edge = smoothstep(0.28, 0.72, dist);
      vec2 offset = amount * edge * vec2(cos(angle), sin(angle));
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

/** Matrix Construct / Sketch-To-Reality Loading Transition Shader */
const ConstructLoadingShader = {
  name: 'ConstructLoadingShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
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
    uniform float progress;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec4 sceneColor = texture2D(tDiffuse, vUv);

      if (progress >= 0.999) {
        gl_FragColor = sceneColor;
        return;
      }

      vec2 texel = vec2(0.001, 0.001);
      vec4 cTop    = texture2D(tDiffuse, vUv + vec2(0.0,  texel.y));
      vec4 cBottom = texture2D(tDiffuse, vUv + vec2(0.0, -texel.y));
      vec4 cLeft   = texture2D(tDiffuse, vUv + vec2(-texel.x, 0.0));
      vec4 cRight  = texture2D(tDiffuse, vUv + vec2( texel.x, 0.0));

      float edge = length((4.0 * sceneColor - cTop - cBottom - cLeft - cRight).rgb);
      float outline = smoothstep(0.06, 0.20, edge);

      vec3 constructWhite = vec3(0.95, 0.95, 0.96);
      vec3 sketchLine = mix(constructWhite, vec3(0.20, 0.22, 0.26), outline);

      float renderPhase = smoothstep(0.0, 0.95, progress);
      vec3 finalColor = mix(sketchLine, sceneColor.rgb, renderPhase);

      gl_FragColor = vec4(finalColor, 1.0);
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

  // Bloom
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.18, 0.35, 0.88);
  composer.addPass(bloomPass);

  // DOF
  const bokehPass = new BokehPass(scene, camera, {
    focus: 10.0,
    aperture: 0.000015,
    maxblur: 0.001,
  });
  composer.addPass(bokehPass);

  const hueSatPass = new ShaderPass(HueSaturationShader);
  hueSatPass.uniforms['hue'].value = 0.0;
  hueSatPass.uniforms['saturation'].value = -0.08;
  composer.addPass(hueSatPass);

  const brightnessContrastPass = new ShaderPass(BrightnessContrastShader);
  brightnessContrastPass.uniforms['brightness'].value = 0.01;
  brightnessContrastPass.uniforms['contrast'].value = 0.06;
  composer.addPass(brightnessContrastPass);

  const sharpenPass = new ShaderPass(SharpenShader);
  sharpenPass.uniforms['resolution'].value.set(width, height);
  sharpenPass.uniforms['sharpness'].value = 0.15;
  composer.addPass(sharpenPass);

  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.uniforms['offset'].value = 1.25;
  vignettePass.uniforms['darkness'].value = 0.45;
  composer.addPass(vignettePass);

  const rgbShiftPass = new ShaderPass(EdgeRGBShiftShader);
  rgbShiftPass.uniforms['amount'].value = 0.0008;
  rgbShiftPass.uniforms['angle'].value = 0.0;
  composer.addPass(rgbShiftPass);

  const filmPass = new FilmPass(0.005, false);
  composer.addPass(filmPass);

  const constructPass = new ShaderPass(ConstructLoadingShader);
  constructPass.uniforms['progress'].value = 1.0;
  constructPass.uniforms['time'].value = 0.0;
  composer.addPass(constructPass);

  composer.addPass(new OutputPass());

  return {
    composer,
    bokehPass,
    gtaoPass: aoPass,
    bloomPass,
    filmPass,
    sharpenPass,
    vignettePass,
    rgbShiftPass,
    constructPass,
    motionBlurPass,
  };
};

import { GameSettings } from './settingsManager';

export const resizePostProcessing = (
  result: PostProcessingResult,
  width: number,
  height: number
): void => {
  result.composer.setSize(width, height);
  result.bloomPass.setSize(width, height);
  result.sharpenPass.uniforms['resolution'].value.set(width, height);
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
  if (result.sharpenPass) {
    result.sharpenPass.enabled = p === 'alta' || p === 'ultra' || p === 'ultra_max';
  }
  if (result.rgbShiftPass) {
    result.rgbShiftPass.enabled = p === 'ultra_max';
  }
};
