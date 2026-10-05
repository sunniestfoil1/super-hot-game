import { spawnBulletImpactVfx } from './combatVfx';
import * as THREE from 'three';
import { Bullet, Enemy, AirborneWeapon, WeaponType } from './types';
import { superhotSound } from '../audio/SuperhotAudio';
import { createBulletTrail, updateBulletTrail } from './bulletVisuals';

interface UpdateBulletsContext {
  bullets: Bullet[];
  enemies: Enemy[];
  airborneWeapons: AirborneWeapon[];
  wallBoxes: THREE.Box3[];
  playerPos: THREE.Vector3;
  gameDt: number;
  dtFactor: number;
  gameState: 'menu' | 'playing' | 'cleared' | 'gameover';
  godMode: boolean;
  scene: THREE.Scene;
  shatterLimb: (enemy: Enemy, isLeft: boolean) => void;
  shatterEnemy: (enemy: Enemy, dir: THREE.Vector3) => void;
  onPlayerHit: () => void;
}

// Module-level static singletons to eliminate GC memory allocations per frame
const _staticRaycaster = new THREE.Raycaster();
const _staticTorsoBox = new THREE.Box3();
const _staticLimbBuffer: THREE.Mesh[] = [];
const _staticLegsBox = new THREE.Box3();
const _tempBulletMovement = new THREE.Vector3();
const _tempRayDir = new THREE.Vector3();
const _tempHeadCenter = new THREE.Vector3();
const _tempBoxCenter = new THREE.Vector3();
const _torsoSize = new THREE.Vector3(0.44, 0.55, 0.30);
const _legsSize = new THREE.Vector3(0.38, 0.95, 0.28);

export const updateBulletsAndCollisions = (ctx: UpdateBulletsContext) => {
  const {
    bullets,
    enemies,
    airborneWeapons,
    wallBoxes,
    playerPos,
    gameDt,
    dtFactor,
    gameState,
    godMode,
    scene,
    shatterLimb,
    shatterEnemy,
    onPlayerHit,
  } = ctx;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.position.addScaledVector(b.direction, b.speed * gameDt);
    b.mesh.position.copy(b.position);
    b.life -= gameDt;

    updateBulletTrail(b.trailMesh, b.position, b.direction, b.isEnemy ? 1.6 : 1.2);

    if (b.isEnemy && b.position.distanceTo(playerPos) < 1.1) {
      superhotSound.playBulletWhiz();
    }

    let hit = false;
    for (let w = 0; w < wallBoxes.length; w++) {
      if (wallBoxes[w].containsPoint(b.position)) {
        hit = true;
        _tempRayDir.copy(b.direction).negate();
        spawnBulletImpactVfx(scene, b.position, _tempRayDir);
        break;
      }
    }

    // Player bullet hits enemy (Real polygonal triangle raycasting)
    if (!b.isEnemy) {
      _tempBulletMovement.subVectors(b.position, b.prevPosition);
      const moveDist = _tempBulletMovement.length();
      if (moveDist > 0.0001) {
        _tempRayDir.copy(_tempBulletMovement).normalize();
        _staticRaycaster.set(b.prevPosition, _tempRayDir);
        _staticRaycaster.near = 0;
        _staticRaycaster.far = moveDist + 0.15;

        for (let eIdx = 0; eIdx < enemies.length; eIdx++) {
          const e = enemies[eIdx];
          if (e.alive) {
            // Broadphase Distance Check: Skip detailed raycast if bullet is far from enemy center
            const maxReach = moveDist + 2.2;
            if (b.position.distanceToSquared(e.position) > maxReach * maxReach) {
              continue;
            }

            _staticLimbBuffer.length = 0;
            if (e.head) _staticLimbBuffer.push(e.head);
            if (e.neck) _staticLimbBuffer.push(e.neck);
            if (e.chest) _staticLimbBuffer.push(e.chest);
            if (e.waist) _staticLimbBuffer.push(e.waist);
            if (e.leftUpperArm) _staticLimbBuffer.push(e.leftUpperArm);
            if (e.leftForearm) _staticLimbBuffer.push(e.leftForearm);
            if (e.rightUpperArm) _staticLimbBuffer.push(e.rightUpperArm);
            if (e.rightForearm) _staticLimbBuffer.push(e.rightForearm);
            if (e.leftThigh) _staticLimbBuffer.push(e.leftThigh);
            if (e.leftCalf) _staticLimbBuffer.push(e.leftCalf);
            if (e.rightThigh) _staticLimbBuffer.push(e.rightThigh);
            if (e.rightCalf) _staticLimbBuffer.push(e.rightCalf);

            const intersects = _staticRaycaster.intersectObjects(_staticLimbBuffer, false);
            if (intersects.length > 0) {
              hit = true;
              const hitPart = intersects[0].object;

              if (
                (hitPart === e.leftCalf || hitPart === e.rightCalf || hitPart === e.leftThigh || hitPart === e.rightThigh) &&
                !e.legShattered &&
                !b.isPellet
              ) {
                shatterLimb(e, hitPart === e.leftCalf || hitPart === e.leftThigh);
              } else {
                shatterEnemy(e, b.direction);
              }
              break;
            }
          }
        }
      }
    }
    b.prevPosition.copy(b.position);

    // Audio cue: bullet passing close to enemy
    if (!b.isEnemy) {
      for (let eIdx = 0; eIdx < enemies.length; eIdx++) {
        const e = enemies[eIdx];
        if (e.alive && b.position.distanceTo(e.position) < 3.8 && !e.spottedPlayer) {
          e.alertSoundTimer = 3.5;
          e.lastHeardPos = playerPos;
          e.alertState = 'alerted';
          e.reactionTimer = Math.max(e.reactionTimer, e.reactionTime * 0.7);
        }
      }
    }

    // Bullet vs Bullet interception
    if (!hit && !b.isEnemy) {
      for (let j = bullets.length - 1; j >= 0; j--) {
        const eb = bullets[j];
        if (eb.isEnemy && b.position.distanceTo(eb.position) < 0.35) {
          hit = true;
          scene.remove(eb.mesh);
          scene.remove(eb.trailMesh);
          bullets.splice(j, 1);
          superhotSound.playPunchImpact(dtFactor);
          break;
        }
      }
    }

    // Bullet blocked by thrown weapon
    if (!hit && b.isEnemy) {
      for (let aIdx = 0; aIdx < airborneWeapons.length; aIdx++) {
        if (b.position.distanceTo(airborneWeapons[aIdx].position) < 0.45) {
          hit = true;
          superhotSound.playPunchImpact(dtFactor);
          break;
        }
      }
    }

    // Hitbox Anatômica Completa do Jogador (Cabeça + Torso + Pernas)
    if (b.isEnemy && gameState === 'playing') {
      _tempBulletMovement.subVectors(b.position, b.prevPosition);
      const enemyMoveDist = _tempBulletMovement.length();

      _tempHeadCenter.copy(playerPos);
      _tempBoxCenter.copy(playerPos);
      _tempBoxCenter.y -= 0.45;
      _staticTorsoBox.setFromCenterAndSize(_tempBoxCenter, _torsoSize);

      _tempBoxCenter.copy(playerPos);
      _tempBoxCenter.y -= 1.20;
      _staticLegsBox.setFromCenterAndSize(_tempBoxCenter, _legsSize);

      const isNearPlayer = b.position.distanceToSquared(playerPos) < 0.64; // 0.8m radius

      let hitPlayer = isNearPlayer;
      if (enemyMoveDist > 0.0001) {
        _tempRayDir.copy(_tempBulletMovement).normalize();
        _staticRaycaster.set(b.prevPosition, _tempRayDir);
        _staticRaycaster.near = 0;
        _staticRaycaster.far = enemyMoveDist + 0.35;

        const headHitDist = _staticRaycaster.ray.distanceToPoint(_tempHeadCenter);
        const hitHead = headHitDist < 0.25;
        const hitTorso = _staticRaycaster.ray.intersectsBox(_staticTorsoBox);
        const hitLegs = _staticRaycaster.ray.intersectsBox(_staticLegsBox);

        if (hitHead || hitTorso || hitLegs) {
          hitPlayer = true;
        }
      }

      if (hitPlayer && !godMode) {
        hit = true;
        superhotSound.playPunchImpact(dtFactor);
        onPlayerHit();
      }
    }

    if (hit || b.life <= 0) {
      scene.remove(b.mesh);
      scene.remove(b.trailMesh);
      bullets.splice(i, 1);
    }
  }
};
