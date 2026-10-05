import * as THREE from 'three';
import { AirborneWeapon, Enemy, WeaponType } from './types';
import { superhotSound } from '../audio/SuperhotAudio';

interface UpdateAirborneWeaponsContext {
  airborneWeapons: AirborneWeapon[];
  enemies: Enemy[];
  gameDt: number;
  dtFactor: number;
  scene: THREE.Scene;
  enemyStunnedMat: THREE.Material;
  applyEnemyMaterial: (enemy: Enemy, mat: THREE.Material) => void;
  disarmEnemy: (enemy: Enemy, force?: number) => void;
  shatterEnemy: (enemy: Enemy, dir: THREE.Vector3) => void;
  spawnDroppedWeapon: (pos: THREE.Vector3, type: WeaponType, ammo: number, id: string) => void;
}

const _tempTarget = new THREE.Vector3();
const _tempHitDir = new THREE.Vector3();
const _tempFloorPos = new THREE.Vector3();

export const updateAirborneWeapons = (ctx: UpdateAirborneWeaponsContext) => {
  const {
    airborneWeapons,
    enemies,
    gameDt,
    dtFactor,
    scene,
    enemyStunnedMat,
    applyEnemyMaterial,
    disarmEnemy,
    shatterEnemy,
    spawnDroppedWeapon,
  } = ctx;

  for (let i = airborneWeapons.length - 1; i >= 0; i--) {
    const aw = airborneWeapons[i];
    aw.position.addScaledVector(aw.velocity, gameDt);
    aw.group.position.copy(aw.position);

    aw.group.rotation.x += aw.angularVelocity.x * gameDt;
    aw.group.rotation.y += aw.angularVelocity.y * gameDt;
    aw.group.rotation.z += aw.angularVelocity.z * gameDt;

    aw.velocity.y -= 9.8 * gameDt;
    aw.life -= gameDt;

    if (aw.isThrownByPlayer) {
      const isFragile = aw.type === 'ashtray' || aw.type === 'bottle';

      for (let eIdx = 0; eIdx < enemies.length; eIdx++) {
        const e = enemies[eIdx];
        _tempTarget.copy(e.position);
        _tempTarget.y += 1.1;

        if (e.alive && aw.position.distanceToSquared(_tempTarget) < 0.9025) {
          superhotSound.playPunchImpact(dtFactor);
          e.punchHitsReceived += 1;
          if (e.hasWeapon) {
            disarmEnemy(e, 4.5);
          }
          if (e.punchHitsReceived >= 2) {
            _tempHitDir.copy(aw.velocity).normalize();
            shatterEnemy(e, _tempHitDir);
          } else {
            e.state = 'stunned';
            e.stunTimer = 3.5;
            e.head.rotation.x = 0.45;
            applyEnemyMaterial(e, enemyStunnedMat);
          }

          if (isFragile) {
            superhotSound.playGlassShatter(dtFactor);
            scene.remove(aw.group);
            airborneWeapons.splice(i, 1);
            break;
          } else {
            aw.velocity.set((Math.random() - 0.5) * 2, 2.5, (Math.random() - 0.5) * 2);
            aw.isThrownByPlayer = false;
            break;
          }
        }
      }
    }

    if (aw.position.y <= 0.15 || aw.life <= 0) {
      const isFragile = aw.type === 'ashtray' || aw.type === 'bottle';
      if (aw.isThrownByPlayer && isFragile) {
        // Only breaks if thrown by player
        superhotSound.playGlassShatter(dtFactor);
      } else {
        // Falls or dropped gently without breaking
        _tempFloorPos.set(aw.position.x, 0.15, aw.position.z);
        spawnDroppedWeapon(_tempFloorPos, aw.type, aw.ammo, `floor-${i}`);
      }
      scene.remove(aw.group);
      airborneWeapons.splice(i, 1);
    }
  }
};
