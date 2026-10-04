import * as THREE from 'three';
import { Enemy, WeaponType } from './types';
import { superhotSound } from '../audio/SuperhotAudio';

interface PunchExecutionParams {
  camera: THREE.PerspectiveCamera;
  dtFactor: number;
  enemies: Enemy[];
  punchComboIndex: number;
  enemyStunnedMat: THREE.Material;
  applyEnemyMaterial: (enemy: Enemy, mat: THREE.Material) => void;
  disarmEnemy: (enemy: Enemy, force?: number) => void;
  shatterEnemy: (enemy: Enemy, dir: THREE.Vector3) => void;
  onPunchStart: (type: 'jab' | 'cross' | 'hook' | 'uppercut', newComboIndex: number) => void;
}

export const executePlayerPunchAction = (params: PunchExecutionParams) => {
  const {
    camera,
    dtFactor,
    enemies,
    punchComboIndex,
    enemyStunnedMat,
    applyEnemyMaterial,
    disarmEnemy,
    shatterEnemy,
    onPunchStart,
  } = params;

  const comboTypes: ('jab' | 'cross' | 'hook' | 'uppercut')[] = ['jab', 'cross', 'hook', 'uppercut'];
  const pType = comboTypes[punchComboIndex % comboTypes.length];
  onPunchStart(pType, (punchComboIndex + 1) % comboTypes.length);

  superhotSound.playPunchSwing(dtFactor);

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const punchReach = pType === 'hook' ? 2.2 : pType === 'uppercut' ? 2.1 : 2.3;

  let hitEnemy: Enemy | null = null;
  for (const enemy of enemies) {
    if (enemy.alive) {
      const toEnemy = enemy.position.clone().add(new THREE.Vector3(0, 1.1, 0)).sub(camera.position);
      if (toEnemy.length() < punchReach) {
        const angle = dir.angleTo(toEnemy);
        if (angle < (pType === 'hook' ? 0.85 : 0.65)) {
          hitEnemy = enemy;
          break;
        }
      }
    }
  }

  if (hitEnemy) {
    hitEnemy.punchHitsReceived += 1;
    superhotSound.playPunchImpact(dtFactor);

    if (hitEnemy.hasWeapon) {
      disarmEnemy(hitEnemy, pType === 'uppercut' ? 6.5 : 4.8);
    }

    if (hitEnemy.punchHitsReceived >= 2 || pType === 'uppercut') {
      const shatterDir = dir.clone();
      if (pType === 'uppercut') shatterDir.y += 0.8;
      if (pType === 'hook') shatterDir.x += (punchComboIndex % 2 === 0 ? 0.6 : -0.6);
      shatterDir.normalize();
      shatterEnemy(hitEnemy, shatterDir);
    } else {
      hitEnemy.state = 'stunned';
      hitEnemy.stunTimer = 3.5;
      if (pType === 'hook') {
        hitEnemy.head.rotation.y = 0.55;
        hitEnemy.chest.rotation.z = -0.25;
      } else {
        hitEnemy.head.rotation.x = -0.35;
        hitEnemy.chest.rotation.x = -0.2;
      }
      applyEnemyMaterial(hitEnemy, enemyStunnedMat);
    }
  }
};
