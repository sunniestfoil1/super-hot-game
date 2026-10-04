import * as THREE from 'three';

interface PlayerMovementContext {
  keys: { w: boolean; s: boolean; a: boolean; d: boolean; space: boolean };
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  isGrounded: boolean;
  wallBoxes: THREE.Box3[];
  wallRun: {
    isWallRunning: boolean;
    side: 'none' | 'left' | 'right' | 'none';
    wallNormal: THREE.Vector3;
    wallTangent: THREE.Vector3;
    tiltAngle: number;
    timeOnWall: number;
  };
  gameDt: number;
  rawDt: number;
  isMoving: boolean;
  onActionKick: (timer: number) => void;
}

export const updatePlayerMovementAndWallrun = (ctx: PlayerMovementContext) => {
  const { keys, pos, vel, yaw, wallBoxes, wallRun, gameDt, rawDt, isMoving, onActionKick } = ctx;

  const moveSpeed = 6.4;
  const moveVec = new THREE.Vector3();
  if (keys.w) moveVec.z -= 1;
  if (keys.s) moveVec.z += 1;
  if (keys.a) moveVec.x -= 1;
  if (keys.d) moveVec.x += 1;

  if (moveVec.lengthSq() > 0) {
    moveVec.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    vel.x = moveVec.x * moveSpeed;
    vel.z = moveVec.z * moveSpeed;
  } else {
    vel.x *= Math.pow(0.7, rawDt * 60);
    vel.z *= Math.pow(0.7, rawDt * 60);
  }

  // --- WALLRUN DETECTION ---
  const isAirborne = !ctx.isGrounded && pos.y > 1.8;
  let detectedWall = false;

  if (isAirborne && keys.w) {
    const checkDist = 0.95;
    for (const box of wallBoxes) {
      const nearXMin = Math.abs(pos.x - box.min.x) < checkDist && pos.z >= box.min.z && pos.z <= box.max.z;
      const nearXMax = Math.abs(pos.x - box.max.x) < checkDist && pos.z >= box.min.z && pos.z <= box.max.z;
      const nearZMin = Math.abs(pos.z - box.min.z) < checkDist && pos.x >= box.min.x && pos.x <= box.max.x;
      const nearZMax = Math.abs(pos.z - box.max.z) < checkDist && pos.x >= box.min.x && pos.x <= box.max.x;

      if (nearXMin || nearXMax || nearZMin || nearZMax) {
        detectedWall = true;
        wallRun.isWallRunning = true;

        if (nearXMin) wallRun.wallNormal.set(-1, 0, 0);
        else if (nearXMax) wallRun.wallNormal.set(1, 0, 0);
        else if (nearZMin) wallRun.wallNormal.set(0, 0, -1);
        else if (nearZMax) wallRun.wallNormal.set(0, 0, 1);

        wallRun.tiltAngle = THREE.MathUtils.lerp(wallRun.tiltAngle, 0.26, 0.15);

        if (!isMoving) {
          vel.set(0, 0, 0);
        } else {
          vel.y = -0.4 * gameDt;
        }
        break;
      }
    }
  }

  if (!detectedWall) {
    wallRun.isWallRunning = false;
    wallRun.tiltAngle = THREE.MathUtils.lerp(wallRun.tiltAngle, 0, 0.15);

    vel.y -= 14.0 * gameDt;

    if (keys.space && ctx.isGrounded) {
      vel.y = 5.4;
      ctx.isGrounded = false;
      onActionKick(0.2);
    }
  }

  const nextPos = pos.clone().addScaledVector(vel, gameDt);

  if (nextPos.y <= 1.7) {
    nextPos.y = 1.7;
    vel.y = 0;
    ctx.isGrounded = true;
  }

  // Collision with environment structures
  const pRad = 0.4;
  wallBoxes.forEach((box) => {
    if (
      nextPos.x + pRad > box.min.x &&
      nextPos.x - pRad < box.max.x &&
      pos.z + pRad > box.min.z &&
      pos.z - pRad < box.max.z &&
      pos.y > box.min.y &&
      pos.y < box.max.y + 1.8
    ) {
      nextPos.x = pos.x;
      vel.x = 0;
    }
    if (
      nextPos.x + pRad > box.min.x &&
      nextPos.x - pRad < box.max.x &&
      nextPos.z + pRad > box.min.z &&
      nextPos.z - pRad < box.max.z &&
      pos.y > box.min.y &&
      pos.y < box.max.y + 1.8
    ) {
      nextPos.z = pos.z;
      vel.z = 0;
    }
  });

  pos.copy(nextPos);
};
