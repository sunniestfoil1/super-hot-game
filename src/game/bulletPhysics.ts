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
    for (const box of wallBoxes) {
      if (box.containsPoint(b.position)) {
        hit = true;
        spawnBulletImpactVfx(scene, b.position, b.direction.clone().negate());
        break;
      }
    }

    // Player bullet hits enemy (Real polygonal triangle raycasting)
    if (!b.isEnemy) {
      const bulletMovement = b.position.clone().sub(b.prevPosition);
      const moveDist = bulletMovement.length();
      if (moveDist > 0.0001) {
        const rayDir = bulletMovement.clone().normalize();
        const hitRay = new THREE.Raycaster(b.prevPosition, rayDir, 0, moveDist + 0.15);

        for (const e of enemies) {
          if (e.alive) {
            const limbMeshes = [
              e.head, e.neck, e.chest, e.waist,
              e.leftUpperArm, e.leftForearm, e.rightUpperArm, e.rightForearm,
              e.leftThigh, e.leftCalf, e.rightThigh, e.rightCalf,
            ];
            const intersects = hitRay.intersectObjects(limbMeshes, false);
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
                // Qualquer outro hit (ou pellet de escopeta) mata de vez
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
      for (const e of enemies) {
        if (e.alive && b.position.distanceTo(e.position) < 3.8 && !e.spottedPlayer) {
          e.alertSoundTimer = 3.5;
          e.lastHeardPos = playerPos.clone();
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
      for (const aw of airborneWeapons) {
        if (b.position.distanceTo(aw.position) < 0.45) {
          hit = true;
          superhotSound.playPunchImpact(dtFactor);
          break;
        }
      }
    }

    // Hitbox Anatômica Completa do Jogador (Cabeça + Torso + Pernas)
    if (b.isEnemy && gameState === 'playing') {
      const enemyBulletMovement = b.position.clone().sub(b.prevPosition);
      const enemyMoveDist = enemyBulletMovement.length();

      // Volumes Anatômicos Físicos do Jogador
      const headCenter = playerPos.clone(); // Olhos/Cabeça (y = playerPos.y = 1.70m)
      const torsoBox = new THREE.Box3().setFromCenterAndSize(
        playerPos.clone().setY(playerPos.y - 0.45),
        new THREE.Vector3(0.44, 0.55, 0.30)
      );
      const legsBox = new THREE.Box3().setFromCenterAndSize(
        playerPos.clone().setY(playerPos.y - 1.20),
        new THREE.Vector3(0.38, 0.95, 0.28)
      );

      if (enemyMoveDist > 0.0001) {
        const enemyRayDir = enemyBulletMovement.clone().normalize();
        const enemyHitRay = new THREE.Raycaster(b.prevPosition, enemyRayDir, 0, enemyMoveDist + 0.35);

        // Teste 1: Esfera da Cabeça (raio 0.20m)
        const headHitDist = enemyHitRay.ray.distanceToPoint(headCenter);
        const hitHead = headHitDist < 0.20;

        // Teste 2 e 3: Caixas 3D do Torso e Pernas
        const hitTorso = enemyHitRay.ray.intersectsBox(torsoBox);
        const hitLegs = enemyHitRay.ray.intersectsBox(legsBox);

        if (hitHead || hitTorso || hitLegs) {
          hit = true;
          if (!godMode) {
            onPlayerHit();
          } else {
            superhotSound.playWeaponCatch();
          }
        }
      } else {
        const hitHead = b.position.distanceTo(headCenter) < 0.20;
        const hitTorso = torsoBox.containsPoint(b.position);
        const hitLegs = legsBox.containsPoint(b.position);
        if (hitHead || hitTorso || hitLegs) {
          hit = true;
          if (!godMode) {
            onPlayerHit();
          } else {
            superhotSound.playWeaponCatch();
          }
        }
      }
    }

    if (hit || b.life <= 0) {
      scene.remove(b.mesh);
      scene.remove(b.trailMesh);
      bullets.splice(i, 1);
    }
  }
};

