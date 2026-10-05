import * as THREE from 'three';
import { WeaponType, Enemy } from './types';
import { SceneSetupResult } from './sceneSetup';

export interface ReplayFrame {
  gameplayTime: number;
  playerPos: THREE.Vector3;
  playerYaw: number;
  playerPitch: number;
  currentWeapon: WeaponType | null;
  isPunching: boolean;
  enemies: Array<{
    id: string;
    pos: THREE.Vector3;
    rotationY: number;
    alive: boolean;
    state: string;
    hasWeapon: boolean;
    weaponType?: WeaponType;
  }>;
  bullets: Array<{
    pos: THREE.Vector3;
    dir: THREE.Vector3;
    isEnemy: boolean;
  }>;
  airborneWeapons: Array<{
    pos: THREE.Vector3;
    type: WeaponType;
  }>;
}

export type ReplayCameraMode = 'first_person' | 'action_cam';

class ReplaySystem {
  private recordedFrames: ReplayFrame[] = [];
  private isRecording = false;
  private isReplaying = false;
  private playbackTime = 0;
  private playbackIndex = 0;
  private cameraMode: ReplayCameraMode = 'first_person';
  private recordTimer = 0;
  private totalGameplayDuration = 0;

  // Recorded mesh proxies for replay playback
  private replayEnemies: Map<string, THREE.Group> = new Map();
  private replayBullets: THREE.Mesh[] = [];
  private replayAirborne: THREE.Group[] = [];

  public startRecording() {
    this.recordedFrames = [];
    this.isRecording = true;
    this.isReplaying = false;
    this.playbackTime = 0;
    this.playbackIndex = 0;
    this.recordTimer = 0;
    this.totalGameplayDuration = 0;
  }

  public recordTick(state: any, rawDt: number) {
    if (!this.isRecording || state.gameState !== 'playing') return;

    this.recordTimer += rawDt;
    // Snapshot recorded every 0.033s (~30 FPS recording)
    if (this.recordTimer < 0.033) return;
    this.recordTimer = 0;

    this.totalGameplayDuration += rawDt;

    const frame: ReplayFrame = {
      gameplayTime: this.totalGameplayDuration,
      playerPos: state.pos.clone(),
      playerYaw: state.yaw,
      playerPitch: state.pitch,
      currentWeapon: state.currentWeapon,
      isPunching: state.isPunching || false,
      enemies: state.enemies.map((e: Enemy) => ({
        id: e.id,
        pos: e.position.clone(),
        rotationY: e.rotationY,
        alive: e.alive,
        state: e.state,
        hasWeapon: e.hasWeapon,
        weaponType: e.weaponType,
      })),
      bullets: state.bullets.map((b: any) => ({
        pos: b.position.clone(),
        dir: b.direction.clone(),
        isEnemy: b.isEnemy,
      })),
      airborneWeapons: state.airborneWeapons.map((aw: any) => ({
        pos: aw.position.clone(),
        type: aw.type,
      })),
    };

    this.recordedFrames.push(frame);
  }

  public stopRecording() {
    this.isRecording = false;
  }

  public getRecordedFrames(): ReplayFrame[] {
    return this.recordedFrames;
  }

  public getIsReplaying(): boolean {
    return this.isReplaying;
  }

  public getCameraMode(): ReplayCameraMode {
    return this.cameraMode;
  }

  public setCameraMode(mode: ReplayCameraMode) {
    this.cameraMode = mode;
  }

  public toggleCameraMode() {
    this.cameraMode = this.cameraMode === 'first_person' ? 'action_cam' : 'first_person';
  }

  public startPlayback() {
    if (this.recordedFrames.length === 0) return;
    this.isRecording = false;
    this.isReplaying = true;
    this.playbackTime = 0;
    this.playbackIndex = 0;
    this.cameraMode = 'first_person';
  }

  public updatePlayback(
    rawDt: number,
    sceneSetup: SceneSetupResult,
    playerPosRef: THREE.Vector3,
    onComplete: () => void
  ) {
    if (!this.isReplaying || this.recordedFrames.length === 0) return;

    // Playback advances at 1.0x REALTIME speed (60 FPS normal speed!)
    this.playbackTime += rawDt * 1.1;

    // Find frame matching playback time
    while (
      this.playbackIndex < this.recordedFrames.length - 1 &&
      this.recordedFrames[this.playbackIndex + 1].gameplayTime <= this.playbackTime
    ) {
      this.playbackIndex++;
    }

    if (this.playbackIndex >= this.recordedFrames.length - 1) {
      // Loop replay or complete after end
      this.playbackIndex = 0;
      this.playbackTime = 0;
    }

    const frame = this.recordedFrames[this.playbackIndex];
    if (!frame) return;

    // Update Player position reference for rendering
    playerPosRef.copy(frame.playerPos);

    const { camera } = sceneSetup;

    if (this.cameraMode === 'first_person') {
      camera.position.copy(frame.playerPos);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = frame.playerYaw;
      camera.rotation.x = frame.playerPitch;
      camera.rotation.z = 0;
    } else {
      // 3rd Person Action Camera (Cinematic Tracking Orbit)
      const lookDir = new THREE.Vector3(
        -Math.sin(frame.playerYaw) * Math.cos(frame.playerPitch),
        Math.sin(frame.playerPitch),
        -Math.cos(frame.playerYaw) * Math.cos(frame.playerPitch)
      ).normalize();

      const camOffset = new THREE.Vector3()
        .copy(lookDir)
        .multiplyScalar(-3.0)
        .add(new THREE.Vector3(0.6, 1.8, 0));

      const targetCamPos = frame.playerPos.clone().add(camOffset);
      camera.position.lerp(targetCamPos, 0.2);

      const lookTarget = frame.playerPos.clone().add(new THREE.Vector3(0, 1.2, 0)).add(lookDir.clone().multiplyScalar(2.0));
      camera.lookAt(lookTarget);
    }
  }

  public stopPlayback() {
    this.isReplaying = false;
    this.playbackTime = 0;
    this.playbackIndex = 0;
  }
}

export const replaySystem = new ReplaySystem();
