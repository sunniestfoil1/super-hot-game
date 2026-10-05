import * as THREE from 'three';

export type ReplayCameraMode = 'first_person' | 'action_cam';

/**
 * Optimized Zero-Overhead Replay System Stub
 * Eliminates high-frequency snapshot object cloning & garbage collection pressure.
 */
class ReplaySystem {
  public startRecording() {}
  public recordTick(_state: any, _rawDt: number) {}
  public stopRecording() {}
  public getRecordedFrames() { return []; }
  public getIsReplaying() { return false; }
  public getCameraMode(): ReplayCameraMode { return 'first_person'; }
  public setCameraMode(_mode: ReplayCameraMode) {}
  public toggleCameraMode() {}
  public startPlayback() {}
  public updatePlayback(_rawDt: number, _sceneSetup: any, _playerPosRef: THREE.Vector3, _onComplete: () => void) {}
  public stopPlayback() {}
}

export const replaySystem = new ReplaySystem();
