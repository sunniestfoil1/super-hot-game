import * as THREE from 'three';
import { Enemy, GlassShard } from './types';
import { superhotSound } from '../audio/SuperhotAudio';
import { spawnEnemyShatterShards } from './shatterEffect';

interface HotswitchExecutionParams {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  enemies: Enemy[];
  playerPos: THREE.Vector3;
  glassShards: GlassShard[];
  disarmEnemy: (enemy: Enemy, force?: number) => void;
  onSuccess: (targetEnemy: Enemy) => void;
}

export const executeHotswitchAction = (params: HotswitchExecutionParams): boolean => {
  const {
    camera,
    scene,
    enemies,
    playerPos,
    glassShards,
    disarmEnemy,
    onSuccess,
  } = params;

  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);

  let targetEnemy: Enemy | null = null;
  let minAngle = 0.35;

  for (const enemy of enemies) {
    if (enemy.alive) {
      const toEnemy = enemy.position.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(camera.position);
      const dist = toEnemy.length();
      if (dist > 1.5 && dist < 32.0) {
        const angle = camDir.angleTo(toEnemy);
        if (angle < minAngle) {
          minAngle = angle;
          targetEnemy = enemy;
        }
      }
    }
  }

  if (!targetEnemy) return false;

  superhotSound.playHotswitch();

  if (targetEnemy.hasWeapon) {
    disarmEnemy(targetEnemy, 2.0);
  }

  const oldPlayerPos = playerPos.clone();
  const mockOldPlayerEnemy: Enemy = {
    ...targetEnemy,
    position: oldPlayerPos,
  };
  const playerExplodeShards = spawnEnemyShatterShards(scene, mockOldPlayerEnemy, camDir.clone().negate());
  glassShards.push(...playerExplodeShards);

  targetEnemy.alive = false;
  scene.remove(targetEnemy.root);

  onSuccess(targetEnemy);
  return true;
};
