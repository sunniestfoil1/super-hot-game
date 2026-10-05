import { spawnMuzzleFlashVfx } from './combatVfx';
import * as THREE from 'three';
import { Enemy, Bullet } from './types';
import { createGlbBulletGeometry } from './geometryLoader';
import { superhotSound } from '../audio/SuperhotAudio';

function playEnemyAction(enemy: Enemy, clip: THREE.AnimationClip | null, loop: boolean, fade: number) {
  if (!enemy.mixer || !clip) return;
  const action = enemy.mixer.clipAction(clip);
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  action.reset();
  action.fadeIn(fade);
  action.play();
  if (enemy.currentAction && enemy.currentAction !== action) {
    enemy.currentAction.fadeOut(fade);
  }
  enemy.currentAction = action;
}

function stopEnemyAction(enemy: Enemy, fade: number) {
  if (!enemy.mixer || !enemy.currentAction) return;
  enemy.currentAction.fadeOut(fade);
  enemy.currentAction = null;
}

const UPDATE_ENEMY_AI_VERSION = 'v1';

// Shared singletons to prevent WebGL shader compilation stutters and V8 GC freezes on enemy shots
const sharedEnemyBulletMat = new THREE.MeshStandardMaterial({
  color: 0xff0022,
  emissive: 0xff0033,
  emissiveIntensity: 1.5,
  metalness: 0.85,
  roughness: 0.2,
});

const _staticToPlayer = new THREE.Vector3();
const _staticToPlayerDir = new THREE.Vector3();
const _staticEnemyForward = new THREE.Vector3();

const sharedEnemyTrailLineMat = new THREE.LineBasicMaterial({
  color: 0xff2244,
  linewidth: 2,
});

interface UpdateEnemyAiContext {
  enemy: Enemy;
  gameDt: number;
  rawDt: number;
  currentTime: number;
  playerPos: THREE.Vector3;
  playerVel: THREE.Vector3;
  camDir: THREE.Vector3;
  wallBoxes: THREE.Box3[];
  gameState: 'menu' | 'playing' | 'cleared' | 'gameover';
  dtFactor: number;
  enemyActiveMat: THREE.Material;
  applyEnemyMaterial: (enemy: Enemy, mat: THREE.Material) => void;
  onPlayerHit: () => void;
  scene: THREE.Scene;
  bullets: Bullet[];
}

/**
 * SUPERHOT Canonical Enemy FSM (Finite State Machine):
 * 1. Pursuit (Aproximação direta via linha de visão e navegação linear)
 * 2. Attack (Para na distância de ataque, mira e dispara em cadência fixa)
 * 3. Stunned / Disarmed (Atordoado por arremesso, vulnerável)
 * 4. Death / Shatter (1-hit kill, substituído por cristais)
 * 
 * * Sem cobertura (não se esconde)
 * * Sem recarga
 * * Sem flanqueamento complexo ou fuga errática
 * * 100% determinístico e previsível como peça de puzzle temporal
 */
export const updateEnemyAi = (ctx: UpdateEnemyAiContext) => {
  const {
    enemy,
    gameDt,
    rawDt,
    currentTime,
    playerPos,
    wallBoxes,
    gameState,
    dtFactor,
    enemyActiveMat,
    applyEnemyMaterial,
    onPlayerHit,
    scene,
    bullets,
  } = ctx;

  if (!enemy.alive) return;

  // ==========================================
  // ESTADO 3: ATORDOADO / DESARMADO (STUNNED)
  // ==========================================
  if (enemy.state === 'stunned') {
    enemy.stunTimer -= gameDt;
    // Stagger / Hit Reaction: joga a cabeça e o tronco para trás por 0.8s
    const staggerEnvelope = Math.sin(Math.min(1, Math.max(0, enemy.stunTimer / 0.8)) * Math.PI);
    enemy.chest.rotation.x = -0.45 * staggerEnvelope;
    enemy.head.rotation.x = -0.6 * staggerEnvelope;
    enemy.leftUpperArm.rotation.x = 0.8 * staggerEnvelope;
    enemy.rightUpperArm.rotation.x = 0.8 * staggerEnvelope;

    if (enemy.stunTimer <= 0) {
      enemy.state = 'idle';
      enemy.head.rotation.x = 0;
      enemy.chest.rotation.x = 0;
      applyEnemyMaterial(enemy, enemyActiveMat);
    }
    return;
  }

  // Estado transitório de cambalear se uma perna foi fraturada
  if (enemy.state === 'stumbling') {
    enemy.stumbleTimer -= gameDt;
    if (enemy.stumbleTimer <= 0) {
      enemy.state = 'idle';
    }
    return;
  }

  // Vetor planar direto ao jogador (Navegação Linear Determinística sem alocação GC)
  _staticToPlayer.subVectors(playerPos, enemy.position);
  _staticToPlayer.y = 0;
  const dist = _staticToPlayer.length();
  
  if (dist > 0.0001) {
    _staticToPlayerDir.copy(_staticToPlayer).multiplyScalar(1 / dist);
  } else {
    _staticToPlayerDir.set(0, 0, 1);
  }

  const prevBoxing = enemy.isBoxing;
  enemy.isBoxing = enemy.spottedPlayer && dist <= 3.0;
  if (enemy.isBoxing && !prevBoxing) {
    enemy.boxCycle = 0;
  }

  if (enemy.mixer) {
    enemy.mixer.update(rawDt);
  }

  // ==========================================
  // DETECÇÃO VISUAL & REAÇÃO HUMANA PREVISÍVEL
  // ==========================================
  _staticEnemyForward.set(Math.sin(enemy.rotationY), 0, Math.cos(enemy.rotationY));
  const viewAngleDot = _staticEnemyForward.dot(_staticToPlayerDir);
  const inVisionCone = viewAngleDot > -0.1 || dist < 3.0; // Amplo campo de visão frontal

  // Audição: tiro disparado alerta imediatamente a presença
  if (enemy.alertSoundTimer > 0) {
    enemy.alertSoundTimer -= gameDt;
    enemy.spottedPlayer = true;
  }

  if (inVisionCone) {
    enemy.reactionTimer += gameDt;
    if (enemy.reactionTimer >= enemy.reactionTime) {
      enemy.spottedPlayer = true;
    }
  }

  // Rotação suave e direta orientando o corpo ao jogador
  if (dist > 0.1) {
    const desiredAngle = Math.atan2(_staticToPlayer.x, _staticToPlayer.z);
    let angleDiff = desiredAngle - enemy.rotationY;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const turnSpeed = enemy.spottedPlayer ? 5.0 : 2.5;
    enemy.rotationY += angleDiff * Math.min(1.0, turnSpeed * gameDt);
    enemy.root.rotation.y = enemy.rotationY;

    // Cabeça alinhada ao olhar
    const dy = playerPos.y - (enemy.position.y + 1.62);
    enemy.head.rotation.x = THREE.MathUtils.clamp(-Math.atan2(dy, dist), -0.5, 0.5);
    enemy.head.rotation.y = 0;
  }

  // ==========================================
  // ESTADO 1 & 2: PERSEGUIÇÃO E ATAQUE
  // ==========================================
  enemy.shootCooldown -= gameDt;

  if (!enemy.hasWeapon) {
    // --- COMBATE CORPO A CORPO (Sem Arma) ---
    if (enemy.spottedPlayer) {
      if (enemy.isBoxing) {
        // Silly Dancing aplicado como sexta animação (head + hand/wrist tracks only)
        if (enemy.mixer && enemy.sillyDanceClip) {
          playEnemyAction(enemy, enemy.sillyDanceClip, true, 0.25);
        }
        enemy.boxCycle += gameDt * 5.2;
        const t = enemy.boxCycle;
        const punchR = Math.max(0, Math.sin(t * Math.PI));
        const punchL = Math.max(0, Math.sin((t + 0.5) * Math.PI));

        enemy.chest.rotation.y = punchR * 0.25 - punchL * 0.25;
        enemy.chest.position.y = 1.25 - Math.max(punchR, punchL) * 0.04;

        enemy.rightUpperArm.rotation.x = -0.4 - punchR * 1.35;
        enemy.rightUpperArm.rotation.z = -punchR * 0.35;
        enemy.rightForearm.rotation.x = -0.2 - punchR * 1.1;

        enemy.leftUpperArm.rotation.x = -0.4 - punchL * 1.35;
        enemy.leftUpperArm.rotation.z = punchL * 0.35;
        enemy.leftForearm.rotation.x = -0.2 - punchL * 1.1;

        enemy.leftThigh.rotation.x = THREE.MathUtils.lerp(enemy.leftThigh.rotation.x, 0, 0.15);
        enemy.leftCalf.rotation.x = THREE.MathUtils.lerp(enemy.leftCalf.rotation.x, 0, 0.15);
        enemy.rightThigh.rotation.x = THREE.MathUtils.lerp(enemy.rightThigh.rotation.x, 0, 0.15);
        enemy.rightCalf.rotation.x = THREE.MathUtils.lerp(enemy.rightCalf.rotation.x, 0, 0.15);
        enemy.waist.rotation.y = THREE.MathUtils.lerp(enemy.waist.rotation.y, 0, 0.15);
      } else if (dist > 1.35 && gameState === 'playing') {
        // Animação de caminhada com animação do Shooter Pack se disponível
        if (enemy.mixer && enemy.walkingClip) {
          playEnemyAction(enemy, enemy.walkingClip, true, 0.25);
        }
        // Animação contínua de passos procedural
        enemy.walkCycle += gameDt * 6.5;
        const legSin = Math.sin(enemy.walkCycle);
        const legCos = Math.cos(enemy.walkCycle);

        enemy.leftThigh.rotation.x = legSin * 0.7;
        enemy.leftCalf.rotation.x = Math.max(0, -legSin * 0.85);
        enemy.rightThigh.rotation.x = -legSin * 0.7;
        enemy.rightCalf.rotation.x = Math.max(0, legSin * 0.85);

        enemy.waist.rotation.y = legSin * 0.08;
        enemy.chest.rotation.y = -legSin * 0.16;
        enemy.chest.position.y = 1.25 + Math.abs(legCos) * 0.04;

        enemy.leftUpperArm.rotation.x = 0.4 + legSin * 0.25;
        enemy.leftForearm.rotation.x = -0.6 + legCos * 0.2;
        enemy.rightUpperArm.rotation.x = 0.4 - legSin * 0.25;
        enemy.rightForearm.rotation.x = -0.6 - legCos * 0.2;
      } else if (dist <= 1.35 && gameState === 'playing') {
        // Pursuit: Avança em linha reta até o jogador
        const enemyNext = enemy.position.clone().addScaledVector(_staticToPlayerDir, enemy.walkSpeed * 1.35 * gameDt);
        let blocked = false;
        for (const box of wallBoxes) {
          if (
            enemyNext.x + 0.35 > box.min.x &&
            enemyNext.x - 0.35 < box.max.x &&
            enemyNext.z + 0.35 > box.min.z &&
            enemyNext.z - 0.35 < box.max.z
          ) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          enemy.position.copy(enemyNext);
        }

        // Animação contínua de passos
        enemy.walkCycle += gameDt * 6.5;
        const legSin = Math.sin(enemy.walkCycle);
        const legCos = Math.cos(enemy.walkCycle);

        enemy.leftThigh.rotation.x = legSin * 0.7;
        enemy.leftCalf.rotation.x = Math.max(0, -legSin * 0.85);
        enemy.rightThigh.rotation.x = -legSin * 0.7;
        enemy.rightCalf.rotation.x = Math.max(0, legSin * 0.85);

        enemy.waist.rotation.y = legSin * 0.08;
        enemy.chest.rotation.y = -legSin * 0.16;
        enemy.chest.position.y = 1.25 + Math.abs(legCos) * 0.04;

        enemy.leftUpperArm.rotation.x = 0.4 + legSin * 0.25;
        enemy.leftForearm.rotation.x = -0.6 + legCos * 0.2;
        enemy.rightUpperArm.rotation.x = 0.4 - legSin * 0.25;
        enemy.rightForearm.rotation.x = -0.6 - legCos * 0.2;
      } else if (dist <= 1.35 && gameState === 'playing') {
        // Attack: Parado na distância de ataque deferindo o soco
        enemy.punchAttackTimer += gameDt * 4.0;
        const punchPhase = Math.sin(enemy.punchAttackTimer * Math.PI);
        enemy.rightUpperArm.rotation.x = -0.5 - punchPhase * 1.2;
        enemy.rightForearm.rotation.x = -0.3 - punchPhase * 1.0;
        enemy.chest.rotation.y = punchPhase * 0.35;

        if (enemy.punchAttackTimer >= 1.0) {
          if (enemy.mixer && enemy.punchClip) {
            playEnemyAction(enemy, enemy.punchClip, false, 0.15);
          }
          onPlayerHit();
          enemy.punchAttackTimer = 0;
        }
      }
    } else {
      // Idle
      const breath = Math.sin(currentTime * 0.002) * 0.025;
      enemy.chest.position.y = 1.25 + breath;
      enemy.chest.rotation.x = breath * 0.3;
      enemy.leftThigh.rotation.x = THREE.MathUtils.lerp(enemy.leftThigh.rotation.x, 0, 0.1);
      enemy.leftCalf.rotation.x = THREE.MathUtils.lerp(enemy.leftCalf.rotation.x, 0, 0.1);
      enemy.rightThigh.rotation.x = THREE.MathUtils.lerp(enemy.rightThigh.rotation.x, 0, 0.1);
      enemy.rightCalf.rotation.x = THREE.MathUtils.lerp(enemy.rightCalf.rotation.x, 0, 0.1);

      if (enemy.isBoxing) {
        stopEnemyAction(enemy, 0.2);
      }
    }
  } else {
    // --- COMBATE ARMADO (Com Arma) ---
    // Distância de parada para disparo: ~8.0 metros
    const attackRange = 8.0;

    if (enemy.spottedPlayer) {
      if (enemy.isBoxing) {
        // Silly Dancing aplicado como sexta animação (head + hand/wrist tracks only)
        if (enemy.mixer && enemy.sillyDanceClip) {
          playEnemyAction(enemy, enemy.sillyDanceClip, true, 0.25);
        }
        enemy.boxCycle += gameDt * 5.2;
        const t = enemy.boxCycle;
        const punchR = Math.max(0, Math.sin(t * Math.PI));
        const punchL = Math.max(0, Math.sin((t + 0.5) * Math.PI));

        enemy.chest.rotation.y = punchR * 0.25 - punchL * 0.25;
        enemy.chest.position.y = 1.25 - Math.max(punchR, punchL) * 0.04;

        enemy.rightUpperArm.rotation.x = -0.4 - punchR * 1.35;
        enemy.rightUpperArm.rotation.z = -punchR * 0.35;
        enemy.rightForearm.rotation.x = -0.2 - punchR * 1.1;

        enemy.leftUpperArm.rotation.x = -0.4 - punchL * 1.35;
        enemy.leftUpperArm.rotation.z = punchL * 0.35;
        enemy.leftForearm.rotation.x = -0.2 - punchL * 1.1;

        enemy.leftThigh.rotation.x = THREE.MathUtils.lerp(enemy.leftThigh.rotation.x, 0, 0.15);
        enemy.leftCalf.rotation.x = THREE.MathUtils.lerp(enemy.leftCalf.rotation.x, 0, 0.15);
        enemy.rightThigh.rotation.x = THREE.MathUtils.lerp(enemy.rightThigh.rotation.x, 0, 0.15);
        enemy.rightCalf.rotation.x = THREE.MathUtils.lerp(enemy.rightCalf.rotation.x, 0, 0.15);
        enemy.waist.rotation.y = THREE.MathUtils.lerp(enemy.waist.rotation.y, 0, 0.15);
      } else if (dist > attackRange && gameState === 'playing') {
        // Animação de corrida com rifle se disponível
        if (enemy.mixer && enemy.rifleRunClip) {
          playEnemyAction(enemy, enemy.rifleRunClip, true, 0.25);
        }
        // Pursuit: Anda em linha reta até o alcance de tiro
        const enemyNext = enemy.position.clone().addScaledVector(_staticToPlayerDir, enemy.walkSpeed * gameDt);
        let blocked = false;
        for (const box of wallBoxes) {
          if (
            enemyNext.x + 0.35 > box.min.x &&
            enemyNext.x - 0.35 < box.max.x &&
            enemyNext.z + 0.35 > box.min.z &&
            enemyNext.z - 0.35 < box.max.z
          ) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          enemy.position.copy(enemyNext);
        }

        // Animação de caminhada armada
        enemy.walkCycle += gameDt * 5.5;
        const legSin = Math.sin(enemy.walkCycle);
        const legCos = Math.cos(enemy.walkCycle);

        enemy.leftThigh.rotation.x = legSin * 0.55;
        enemy.leftCalf.rotation.x = Math.max(0, -legSin * 0.65);
        enemy.rightThigh.rotation.x = -legSin * 0.55;
        enemy.rightCalf.rotation.x = Math.max(0, legSin * 0.65);

        enemy.waist.rotation.y = legSin * 0.06;
        enemy.chest.rotation.y = -legSin * 0.1;
        enemy.chest.position.y = 1.25 + Math.abs(legCos) * 0.03;
      } else {
        // Attack Range atingido: Para de andar no lugar e mantém postura firme de tiro
        enemy.leftThigh.rotation.x = THREE.MathUtils.lerp(enemy.leftThigh.rotation.x, 0, 0.1);
        enemy.leftCalf.rotation.x = THREE.MathUtils.lerp(enemy.leftCalf.rotation.x, 0, 0.1);
        enemy.rightThigh.rotation.x = THREE.MathUtils.lerp(enemy.rightThigh.rotation.x, 0, 0.1);
        enemy.rightCalf.rotation.x = THREE.MathUtils.lerp(enemy.rightCalf.rotation.x, 0, 0.1);
        enemy.waist.rotation.y = THREE.MathUtils.lerp(enemy.waist.rotation.y, 0, 0.1);
        enemy.chest.rotation.y = THREE.MathUtils.lerp(enemy.chest.rotation.y, 0, 0.1);
      }

      // Postura canônica de mira empunhando a arma em direção ao jogador
      enemy.rightUpperArm.rotation.x = -1.15;
      enemy.rightForearm.rotation.x = -0.35;
      enemy.leftUpperArm.rotation.x = -0.95;
      enemy.leftUpperArm.rotation.y = 0.45;
      enemy.leftForearm.rotation.x = -0.55;

      // Animação de idle com rifle se disponível
      if (enemy.mixer && enemy.rifleAimIdleClip) {
        playEnemyAction(enemy, enemy.rifleAimIdleClip, true, 0.25);
      }

      // --- DISPARO EM INTERVALO DE TEMPO FIXO E PREVISÍVEL ---
      if (enemy.hasWeapon && enemy.shootCooldown <= 0 && dist < 24.0 && gameState === 'playing') {
        enemy.rightUpperArm.rotation.x += 0.35; // Recuo visual

        // Animação de tiro de rifle se disponível
        if (enemy.mixer && enemy.rifleFireClip) {
          playEnemyAction(enemy, enemy.rifleFireClip, false, 0.15);
        }

        // Tiro direto em direção ao jogador (Determinístico para permitir esquiva tática)
        const targetPos = playerPos.clone().add(new THREE.Vector3(0, 0.1, 0));
        const shootDir = new THREE.Vector3()
          .subVectors(targetPos, enemy.position.clone().add(new THREE.Vector3(0, 1.25, 0)))
          .normalize();

        // Posição de spawn dos projéteis (na mão direita do inimigo)
        const spawnPos = enemy.position.clone().add(new THREE.Vector3(0, 1.15, 0)).addScaledVector(shootDir, 0.5);

        const isEnemyShotgun = enemy.weaponType === 'shotgun';
        const isEnemyUzi = enemy.weaponType === 'rifle';

        if (isEnemyShotgun) {
          // Escopeta Inimiga: Leque cônico simultâneo de 6 projéteis físicos vermelhos
          superhotSound.playShotgunBlast(dtFactor);
          enemy.shootCooldown = 3.2; // Cadência longa

          for (let p = 0; p < 6; p++) {
            const spreadAngle = 0.18;
            const pelletDir = shootDir.clone().add(new THREE.Vector3(
              (Math.random() - 0.5) * spreadAngle,
              (Math.random() - 0.5) * spreadAngle,
              (Math.random() - 0.5) * spreadAngle
            )).normalize();

            const pMesh = new THREE.Mesh(
              createGlbBulletGeometry(),
              sharedEnemyBulletMat
            );
            pMesh.scale.set(0.6, 0.6, 0.6);
            pMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), pelletDir);
            pMesh.position.copy(spawnPos);
            scene.add(pMesh);

            const trailLine = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints([spawnPos.clone(), spawnPos.clone().addScaledVector(pelletDir, -1.0)]),
              sharedEnemyTrailLineMat
            );
            scene.add(trailLine);

            spawnMuzzleFlashVfx(scene, spawnPos, shootDir);
            bullets.push({
              id: `e-pellet-${Date.now()}-${p}-${Math.random()}`,
              mesh: pMesh,
              trailMesh: trailLine,
              position: pMesh.position,
              direction: pelletDir,
              speed: 6.8, // Velocidade escalonada constante
              isEnemy: true,
              life: 6.0,
              prevPosition: spawnPos.clone(),
            });
          }
        } else if (isEnemyUzi) {
          // Uzi Inimiga: Rajada de 2 a 3 balas com dispersão dinâmica
          superhotSound.playEnemyGunshot(dtFactor);
          enemy.shootCooldown = 1.4;

          for (let u = 0; u < 2; u++) {
            const uziSpread = 0.05 * (u + 1); // Dispersão dinâmica crescente
            const burstDir = shootDir.clone().add(new THREE.Vector3(
              (Math.random() - 0.5) * uziSpread,
              (Math.random() - 0.5) * uziSpread,
              (Math.random() - 0.5) * uziSpread
            )).normalize();

            const uMesh = new THREE.Mesh(
              createGlbBulletGeometry(),
              sharedEnemyBulletMat
            );
            uMesh.scale.set(0.7, 0.7, 0.7);
            uMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), burstDir);
            const uSpawn = spawnPos.clone().addScaledVector(burstDir, u * 0.4);
            uMesh.position.copy(uSpawn);
            scene.add(uMesh);

            const trailLine = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints([uSpawn.clone(), uSpawn.clone().addScaledVector(burstDir, -1.2)]),
              sharedEnemyTrailLineMat
            );
            scene.add(trailLine);

            spawnMuzzleFlashVfx(scene, spawnPos, shootDir);
            bullets.push({
              id: `e-uzi-${Date.now()}-${u}-${Math.random()}`,
              mesh: uMesh,
              trailMesh: trailLine,
              position: uMesh.position,
              direction: burstDir,
              speed: 7.8,
              isEnemy: true,
              life: 6.5,
              prevPosition: uSpawn.clone(),
            });
          }
        } else {
          // Pistola Inimiga: Tiro direto determinístico
          superhotSound.playEnemyGunshot(dtFactor);
          enemy.shootCooldown = 2.4;

          const bMesh = new THREE.Mesh(
            createGlbBulletGeometry(),
            sharedEnemyBulletMat
          );
          bMesh.scale.set(0.75, 0.75, 0.75);
          bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), shootDir);
          bMesh.position.copy(spawnPos);
          scene.add(bMesh);

          const trailLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([spawnPos.clone(), spawnPos.clone().addScaledVector(shootDir, -1.2)]),
            sharedEnemyTrailLineMat
          );
          scene.add(trailLine);

          spawnMuzzleFlashVfx(scene, spawnPos, shootDir);
            bullets.push({
            id: `e-bullet-${Date.now()}-${Math.random()}`,
            mesh: bMesh,
            trailMesh: trailLine,
            position: bMesh.position,
            direction: shootDir,
            speed: 7.0, // Projétil tático
            isEnemy: true,
            life: 7.0,
            prevPosition: spawnPos.clone(),
          });
        }
      }
    } else {
      // Idle quando não alertado
      const breath = Math.sin(currentTime * 0.002) * 0.025;
      const lookAround = Math.sin(currentTime * 0.0009 + parseInt(enemy.id.replace('enemy-', '') || '0') * 1.5);
      enemy.chest.position.y = 1.25 + breath;
      enemy.head.rotation.y = lookAround * 0.45;
      enemy.head.rotation.x = Math.cos(currentTime * 0.001) * 0.08;
      enemy.rightUpperArm.rotation.x = -0.25;
      enemy.rightForearm.rotation.x = -0.15;
      enemy.leftUpperArm.rotation.x = 0.05;
      enemy.leftForearm.rotation.x = -0.1;

      stopEnemyAction(enemy, 0.2);
    }
  }

  // Suaviza transição de box -> estado normal
  if (!enemy.isBoxing) {
    enemy.rightUpperArm.rotation.x = THREE.MathUtils.lerp(enemy.rightUpperArm.rotation.x, enemy.rightUpperArm.rotation.x, 0.2);
    enemy.rightUpperArm.rotation.z = THREE.MathUtils.lerp(enemy.rightUpperArm.rotation.z, 0, 0.2);
    enemy.rightForearm.rotation.x = THREE.MathUtils.lerp(enemy.rightForearm.rotation.x, enemy.rightForearm.rotation.x, 0.2);
    enemy.leftUpperArm.rotation.x = THREE.MathUtils.lerp(enemy.leftUpperArm.rotation.x, enemy.leftUpperArm.rotation.x, 0.2);
    enemy.leftUpperArm.rotation.z = THREE.MathUtils.lerp(enemy.leftUpperArm.rotation.z, 0, 0.2);
    enemy.leftForearm.rotation.x = THREE.MathUtils.lerp(enemy.leftForearm.rotation.x, enemy.leftForearm.rotation.x, 0.2);
  }
};
