import * as THREE from 'three';
import { Bullet, Enemy, AirborneWeapon, WeaponType } from './types';
import { superhotSound } from '../audio/SuperhotAudio';

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

    const trailLen = b.isEnemy ? 1.4 : 0.8;
    const trailEnd = b.position.clone().addScaledVector(b.direction, -trailLen);
    (b.trailMesh as THREE.Line).geometry.setFromPoints([b.position.clone(), trailEnd]);

    if (b.isEnemy && b.position.distanceTo(playerPos) < 1.1) {
      superhotSound.playBulletWhiz();
    }

    let hit = false;
    for (const box of wallBoxes) {
      if (box.containsPoint(b.position)) {
        hit = true;
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
                !e.legShattered
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

    // Enemy bullet hits player
    if (b.isEnemy && gameState === 'playing' && b.position.distanceTo(playerPos) < 0.45) {
      hit = true;
      if (!godMode) {
        onPlayerHit();
      } else {
        superhotSound.playWeaponCatch();
      }
    }

    if (hit || b.life <= 0) {
      scene.remove(b.mesh);
      scene.remove(b.trailMesh);
      bullets.splice(i, 1);
    }
  }
};
