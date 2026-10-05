import * as THREE from 'three';
import { getActiveGlbMeshes } from './glbCollisionExtractor';

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

const downRaycaster = new THREE.Raycaster();
const horizontalRaycaster = new THREE.Raycaster();
const rayDirs: THREE.Vector3[] = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0.707, 0, 0.707),
  new THREE.Vector3(-0.707, 0, 0.707),
  new THREE.Vector3(0.707, 0, -0.707),
  new THREE.Vector3(-0.707, 0, -0.707),
];

const _staticMoveVec = new THREE.Vector3();
const _staticAxisY = new THREE.Vector3(0, 1, 0);
const _staticDownDir = new THREE.Vector3(0, -1, 0);
const _staticNextPos = new THREE.Vector3();
const _staticRayOrigin = new THREE.Vector3();
const _staticWorldNormal = new THREE.Vector3();
const _staticHorizNormal = new THREE.Vector3();

export const updatePlayerMovementAndWallrun = (ctx: PlayerMovementContext) => {
  const { keys, pos, vel, yaw, wallBoxes, wallRun, gameDt, rawDt, isMoving, onActionKick } = ctx;

  const moveSpeed = 4.8;
  _staticMoveVec.set(0, 0, 0);
  if (keys.w) _staticMoveVec.z -= 1;
  if (keys.s) _staticMoveVec.z += 1;
  if (keys.a) _staticMoveVec.x -= 1;
  if (keys.d) _staticMoveVec.x += 1;

  if (_staticMoveVec.lengthSq() > 0) {
    _staticMoveVec.normalize().applyAxisAngle(_staticAxisY, yaw);
    vel.x = _staticMoveVec.x * moveSpeed;
    vel.z = _staticMoveVec.z * moveSpeed;
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

    // Salto realista (30% da altura do personagem = ~0.52m de elevação) apenas quando no chão
    if (keys.space && ctx.isGrounded && !wallRun.isWallRunning) {
      vel.y = 3.6;
      ctx.isGrounded = false;
      keys.space = false;
      onActionKick(0.25);
    }
  }

  _staticNextPos.copy(pos).addScaledVector(vel, gameDt);

  // 1. DYNAMIC FLOOR & STAIR CLIMBING (Apenas superfícies horizontais e degraus válidos)
  const currentFeetY = pos.y - 1.7;
  let targetFloorY = 1.7; // Altura padrão dos olhos em Y=0
  const maxStepHeight = 0.45; // Altura máxima de degrau que o jogador pode subir sem pular

  const glbMeshes = getActiveGlbMeshes();
  if (glbMeshes.length > 0) {
    _staticRayOrigin.set(_staticNextPos.x, pos.y + 0.5, _staticNextPos.z);
    downRaycaster.set(_staticRayOrigin, _staticDownDir);
    downRaycaster.far = 4.5;

    const floorHits = downRaycaster.intersectObjects(glbMeshes, false);
    for (const hit of floorHits) {
      if (!hit.face) continue;

      // Normal da superfície em coordenadas do mundo (sem clone)
      _staticWorldNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize();

      // Só aceita como chão se a superfície for predominantemente HORIZONTAL (normal.y > 0.55)
      if (_staticWorldNormal.y > 0.55) {
        const hitFeetY = hit.point.y;
        // Só permite subir se a nova altura do chão for no máximo maxStepHeight (0.45m) acima dos pés atuais
        if (hitFeetY <= currentFeetY + maxStepHeight && hitFeetY >= currentFeetY - 2.5) {
          const exactFloorEyeY = hitFeetY + 1.7;
          if (exactFloorEyeY > targetFloorY - 2.0) {
            targetFloorY = exactFloorEyeY;
          }
          break; // O primeiro ponto válido apontando para cima é o chão de apoio
        }
      }
    }
  }

  // Fallback para caixas de colisão de plataformas estruturais (apenas se forem pisos/plataformas finas)
  for (let bIdx = 0; bIdx < wallBoxes.length; bIdx++) {
    const box = wallBoxes[bIdx];
    const isFloorBox = box.max.y - box.min.y < 0.45; // Apenas caixas de piso
    if (!isFloorBox) continue; // Ignora paredes verticais/altas no cálculo de chão

    const inX = _staticNextPos.x + 0.35 >= box.min.x && _staticNextPos.x - 0.35 <= box.max.x;
    const inZ = _staticNextPos.z + 0.35 >= box.min.z && _staticNextPos.z - 0.35 <= box.max.z;
    if (inX && inZ) {
      const topFeetY = box.max.y;
      if (topFeetY <= currentFeetY + maxStepHeight && topFeetY >= currentFeetY - 1.5) {
        const topEyeHeight = topFeetY + 1.7;
        if (topEyeHeight > targetFloorY) {
          targetFloorY = topEyeHeight;
        }
      }
    }
  }

  // Apenas toca o chão e trava no piso se o jogador estiver caindo/descendo (vel.y <= 0)
  if (vel.y <= 0 && _staticNextPos.y <= targetFloorY) {
    _staticNextPos.y = targetFloorY;
    vel.y = 0;
    ctx.isGrounded = true;
  } else if (_staticNextPos.y > targetFloorY + 0.05) {
    ctx.isGrounded = false;
  }

  // 2. GLB MESH FACE RAYCASTING FOR WALLS, DOORS, WINDOWS & PILLARS WITH WALL SLIDING
  const pRad = 0.38; // Raio do cilindro de colisão do jogador

  if (glbMeshes.length > 0) {
    const bodyCheckHeights = [pos.y - 1.2, pos.y - 0.5];

    for (let hIdx = 0; hIdx < bodyCheckHeights.length; hIdx++) {
      const checkY = bodyCheckHeights[hIdx];
      _staticRayOrigin.set(_staticNextPos.x, checkY, _staticNextPos.z);

      for (let dIdx = 0; dIdx < rayDirs.length; dIdx++) {
        const dir = rayDirs[dIdx];
        horizontalRaycaster.set(_staticRayOrigin, dir);
        horizontalRaycaster.far = pRad + 0.15;

        const wallHits = horizontalRaycaster.intersectObjects(glbMeshes, false);
        if (wallHits.length > 0) {
          const hit = wallHits[0];
          if (hit.distance < pRad && hit.face) {
            // Normal da face atingida em coordenadas mundiais
            _staticWorldNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize();

            // Repulsa EXCLUSIVAMENTE horizontal no plano X/Z
            _staticHorizNormal.set(_staticWorldNormal.x, 0, _staticWorldNormal.z);
            if (_staticHorizNormal.lengthSq() > 0.001) {
              _staticHorizNormal.normalize();
              const penetration = pRad - hit.distance;
              _staticNextPos.addScaledVector(_staticHorizNormal, penetration);

              // WALL SLIDING: remove a componente de velocidade perpendicular à parede
              const normalVel = vel.dot(_staticHorizNormal);
              if (normalVel < 0) {
                vel.addScaledVector(_staticHorizNormal, -normalVel);
              }
            }
          }
        }
      }
    }
  }

  // 3. COLLISION RESOLUTION COM PILARES E OBSTÁCULOS ESTRUTURAIS
  const playerFeetY = pos.y - 1.65;
  const playerHeadY = pos.y + 0.1;

  wallBoxes.forEach((box) => {
    // Ignorar se o box é chão (horizontal fino)
    if (box.max.y - box.min.y < 0.4) return;
    if (playerFeetY >= box.max.y - 0.05 || playerHeadY <= box.min.y) return;

    const isOverlappingX = _staticNextPos.x + pRad > box.min.x && _staticNextPos.x - pRad < box.max.x;
    const isOverlappingZ = _staticNextPos.z + pRad > box.min.z && _staticNextPos.z - pRad < box.max.z;

    if (isOverlappingX && isOverlappingZ) {
      const penXMin = Math.abs((_staticNextPos.x + pRad) - box.min.x);
      const penXMax = Math.abs(box.max.x - (_staticNextPos.x - pRad));
      const penZMin = Math.abs((_staticNextPos.z + pRad) - box.min.z);
      const penZMax = Math.abs(box.max.z - (_staticNextPos.z - pRad));

      const minPenX = Math.min(penXMin, penXMax);
      const minPenZ = Math.min(penZMin, penZMax);

      if (minPenX < minPenZ) {
        if (penXMin < penXMax) {
          _staticNextPos.x = box.min.x - pRad;
        } else {
          _staticNextPos.x = box.max.x + pRad;
        }
        vel.x = 0;
      } else {
        if (penZMin < penZMax) {
          _staticNextPos.z = box.min.z - pRad;
        } else {
          _staticNextPos.z = box.max.z + pRad;
        }
        vel.z = 0;
      }
    }
  });

  pos.copy(_staticNextPos);
};
