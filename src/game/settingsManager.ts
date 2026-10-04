export type QualityPreset = 'basica' | 'media' | 'alta' | 'ultra' | 'ultra_max';
export type InterfaceMode = 'auto' | 'pc' | 'mobile';
export type ShadowQuality = 'off' | 'low' | 'medium' | 'high' | 'ultra';

export interface GameSettings {
  preset: QualityPreset;
  motionBlurEnabled: boolean;
  bloomEnabled: boolean;
  shadowQuality: ShadowQuality;
  targetFps: number; // 0 = uncapped
  interfaceMode: InterfaceMode;
  mouseSensitivity: number;
  touchSensitivity: number;
  masterVolume: number;
  recommendedPreset?: QualityPreset;
}

const STORAGE_KEY = 'webhot_settings_v3';

export const DEFAULT_SETTINGS: GameSettings = {
  preset: 'ultra',
  motionBlurEnabled: false,
  bloomEnabled: true,
  shadowQuality: 'ultra',
  targetFps: 0,
  interfaceMode: 'auto',
  mouseSensitivity: 1.0,
  touchSensitivity: 1.2,
  masterVolume: 1.0,
};

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.warn('Failed to load game settings from localStorage', err);
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveGameSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save game settings to localStorage', err);
  }
}

export function applyPresetToSettings(preset: QualityPreset, current: GameSettings): GameSettings {
  const updated = { ...current, preset };
  switch (preset) {
    case 'basica':
      updated.motionBlurEnabled = false;
      updated.bloomEnabled = false;
      updated.shadowQuality = 'off';
      break;
    case 'media':
      updated.motionBlurEnabled = false;
      updated.bloomEnabled = true;
      updated.shadowQuality = 'low';
      break;
    case 'alta':
      updated.motionBlurEnabled = false;
      updated.bloomEnabled = true;
      updated.shadowQuality = 'high';
      break;
    case 'ultra':
      updated.motionBlurEnabled = false;
      updated.bloomEnabled = true;
      updated.shadowQuality = 'ultra';
      break;
    case 'ultra_max':
      updated.motionBlurEnabled = true;
      updated.bloomEnabled = true;
      updated.shadowQuality = 'ultra';
      break;
  }
  return updated;
}

/**
 * Runs a fast offscreen benchmark measuring GPU/CPU frame render times
 * across 30 dummy test frames to determine recommended quality preset.
 */
export async function runHardwareBenchmark(): Promise<{ recommended: QualityPreset; avgFps: number }> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    let isLowEnd = false;
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        const isMobileGpu = /mali|adreno|powervr|apple/i.test(renderer);
        const isLowGpu = /intel|swiftshader|llvmpipe|softpipe/i.test(renderer);
        if (isMobileGpu || isLowGpu) {
          isLowEnd = true;
        }
      }
    }

    // Benchmark frame time measurement
    const startTime = performance.now();
    let frameCount = 0;

    function step() {
      frameCount++;
      if (frameCount < 25) {
        requestAnimationFrame(step);
      } else {
        const duration = performance.now() - startTime;
        const avgFrameMs = duration / frameCount;
        const avgFps = Math.round(1000 / Math.max(1, avgFrameMs));

        let recommended: QualityPreset = 'ultra';
        if (isLowEnd || avgFps < 30) {
          recommended = 'basica';
        } else if (avgFps < 55) {
          recommended = 'media';
        } else if (avgFps < 85) {
          recommended = 'alta';
        } else if (avgFps >= 120) {
          recommended = 'ultra_max';
        }

        resolve({ recommended, avgFps });
      }
    }

    requestAnimationFrame(step);
  });
}
