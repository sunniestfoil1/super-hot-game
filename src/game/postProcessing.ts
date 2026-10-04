/**
 * SUPERHOT Post-Processing — minimal viable set
 * Mantém apenas bloom + vignette + AO leve para performance.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export interface PostProcessingResult {
  composer: EffectComposer;
  gtaoPass: GTAOPass | SSAOPass;
  bloomPass: UnrealBloomPass;
  vignettePass: any;
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
    (gtao as any).gtaoMaterial.uniforms['radius'].value = 0.45;
    (gtao as any).gtaoMaterial.uniforms['distanceExponent'].value = 1.0;
    (gtao as any).pdMaterial.uniforms['lumaPhi'].value = 10.0;
    (gtao as any).pdMaterial.uniforms['depthPhi'].value = 2.0;
    (gtao as any).pdMaterial.uniforms['normalPhi'].value = 3.0;
    composer.addPass(gtao);
    aoPass = gtao;
  } catch {
    const ssao = new SSAOPass(scene, camera, width, height);
    ssao.kernelRadius = 0.45;
    ssao.minDistance = 0.001;
    ssao.maxDistance = 0.08;
    composer.addPass(ssao);
    aoPass = ssao;
  }

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.22, 0.4, 0.82);
  composer.addPass(bloomPass);

  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.uniforms['offset'].value = 1.05;
  vignettePass.uniforms['darkness'].value = 1.05;
  composer.addPass(vignettePass);

  composer.addPass(new OutputPass());

  return {
    composer,
    gtaoPass: aoPass,
    bloomPass,
    vignettePass,
  };
};

export const resizePostProcessing = (
  result: PostProcessingResult,
  width: number,
  height: number
): void => {
  result.composer.setSize(width, height);
  result.bloomPass.setSize(width, height);
};
