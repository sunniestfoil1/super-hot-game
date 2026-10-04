/**
 * SUPERHOT Post-Processing — limpeza visual
 * CA só nas bordas · DOF sutil · bloom contido · contraste local
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
      // 0 no centro → 1 nas bordas
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

export interface PostProcessingResult {
  composer: EffectComposer;
  bokehPass: BokehPass;
  gtaoPass: GTAOPass | SSAOPass;
  bloomPass: UnrealBloomPass;
  filmPass: FilmPass;
  sharpenPass: ShaderPass;
  vignettePass: ShaderPass;
  rgbShiftPass: ShaderPass;
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
    (gtao as any).gtaoMaterial.uniforms['distanceExponent'].value = 1.0;
    (gtao as any).pdMaterial.uniforms['lumaPhi'].value = 10.0;
    (gtao as any).pdMaterial.uniforms['depthPhi'].value = 2.0;
    (gtao as any).pdMaterial.uniforms['normalPhi'].value = 3.0;
    composer.addPass(gtao);
    aoPass = gtao;
  } catch {
    const ssao = new SSAOPass(scene, camera, width, height);
    ssao.kernelRadius = 0.55;
    ssao.minDistance = 0.001;
    ssao.maxDistance = 0.08;
    composer.addPass(ssao);
    aoPass = ssao;
  }

  // Bloom contido — só janelas / emissive inimigo
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.28, 0.4, 0.82);
  composer.addPass(bloomPass);

  // DOF sutil — centro nítido
  const bokehPass = new BokehPass(scene, camera, {
    focus: 12.0,
    aperture: 0.00004,
    maxblur: 0.002,
  });
  composer.addPass(bokehPass);

  const hueSatPass = new ShaderPass(HueSaturationShader);
  hueSatPass.uniforms['hue'].value = 0.0;
  hueSatPass.uniforms['saturation'].value = -0.22;
  composer.addPass(hueSatPass);

  // Exposure↓ contraste↑ via brightness/contrast
  const brightnessContrastPass = new ShaderPass(BrightnessContrastShader);
  brightnessContrastPass.uniforms['brightness'].value = -0.06;
  brightnessContrastPass.uniforms['contrast'].value = 0.14;
  composer.addPass(brightnessContrastPass);

  const sharpenPass = new ShaderPass(SharpenShader);
  sharpenPass.uniforms['resolution'].value.set(width, height);
  sharpenPass.uniforms['sharpness'].value = 0.28;
  composer.addPass(sharpenPass);

  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.uniforms['offset'].value = 1.05;
  vignettePass.uniforms['darkness'].value = 1.05;
  composer.addPass(vignettePass);

  // CA só nas bordas
  const rgbShiftPass = new ShaderPass(EdgeRGBShiftShader);
  rgbShiftPass.uniforms['amount'].value = 0.0022;
  rgbShiftPass.uniforms['angle'].value = 0.0;
  composer.addPass(rgbShiftPass);

  const filmPass = new FilmPass(0.015, false);
  composer.addPass(filmPass);

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
  };
};

export const resizePostProcessing = (
  result: PostProcessingResult,
  width: number,
  height: number
): void => {
  result.composer.setSize(width, height);
  result.bloomPass.setSize(width, height);
  result.sharpenPass.uniforms['resolution'].value.set(width, height);
};
