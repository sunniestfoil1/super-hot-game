import { updateCombatVfx } from './combatVfx';
import { updateEmissiveDissolveGhosts } from './emissiveDissolveEffect';
import * as THREE from 'three';
import { Bullet, Enemy, GlassShard, AirborneWeapon, DroppedWeapon } from './types';
import { updateBulletsAndCollisions } from './bulletPhysics';
import { updateAirborneWeapons } from './weaponPhysics';
import { updateEnemyAi } from './enemyAi';
import { updatePlayerMovementAndWallrun } from './playerController';
import { animatePlayerArms } from './firstPersonArms';
import { shardPool } from './shatterEffect';
import { superhotSound } from '../audio/SuperhotAudio';
import { SceneSetupResult } from './sceneSetup';

const _tempToW = new THREE.Vector3();
const _tempCamDir = new THREE.Vector3();

export interface GameLoopContext {
  rawDt: number;
  currentTime: number;
  frameCounter: number;
  state: {
    gameState: 'menu' | 'playing' | 'cleared' | 'gameover';
    currentWeapon: any;
    ammo: number;
    dtFactor: number;
    targetDtFactor: number;
    actionKickTimer: number;
    clearSlowTimer: number;
    constructProgress: number;
    mouseDeltaMag: number;
    hotswitchCooldown: number;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    yaw: number;
    pitch: number;
    isGrounded: boolean;
    wallRun: any;
    keys: any;
    shootCooldown: number;
    recoilAmount: number;
    punchProgress: number;
    isPunching: boolean;
    punchType: any;
    currentEmote?: any;
    emoteProgress?: number;
    bullets: Bullet[];
    enemies: Enemy[];
    glassShards: GlassShard[];
    airborneWeapons: AirborneWeapon[];
    droppedWeapons: DroppedWeapon[];
    wallBoxes: THREE.Box3[];
    physicsMs?: number;
    renderMs?: number;
    audioMs?: number;
  };
  sceneSetup: SceneSetupResult;
  godMode: boolean;
  enemyActiveMat: THREE.Material;
  enemyStunnedMat: THREE.Material;
  applyEnemyMaterial: (enemy: Enemy, mat: THREE.Material) => void;
  disarmEnemy: (enemy: Enemy, force?: number) => void;
  shatterEnemy: (enemy: Enemy, dir: THREE.Vector3) => void;
  shatterLimb: (enemy: Enemy, isLeft: boolean) => void;
  spawnDroppedWeapon: (pos: THREE.Vector3, type: any, ammo: number, id: string) => void;
  triggerGameOver: () => void;
  isBasicaPreset?: boolean;
  onWeaponPickup: (type: any, ammo: number) => void;
  onCanCatchWeaponChange: (canCatch: boolean) => void;
  onCanPunchChange: (canPunch: boolean) => void;
  onCanHotswitchChange: (canHotswitch: boolean) => void;
  onDtFactorChange: (dt: number) => void;
  onHotswitchCooldownChange: (cd: number) => void;
}

export const runGamePhysicsTick = (ctx: GameLoopContext) => {
  const {
    rawDt,
    currentTime,
    frameCounter,
    state: s,
    sceneSetup,
    godMode,
    enemyActiveMat,
    enemyStunnedMat,
    applyEnemyMaterial,
    disarmEnemy,
    shatterEnemy,
    shatterLimb,
    spawnDroppedWeapon,
    triggerGameOver,
    onWeaponPickup,
    onCanCatchWeaponChange,
    onCanPunchChange,
    onCanHotswitchChange,
    onDtFactorChange,
    onHotswitchCooldownChange,
  } = ctx;

  const { scene, camera, renderer, playerWeaponGroup, playerLeftFistGroup, playerRightFistGroup } = sceneSetup;

  // 1. Time Equation
  const isMoving = s.keys.w || s.keys.s || s.keys.a || s.keys.d || s.keys.space;

  if (s.gameState === 'gameover') {
    s.targetDtFactor = 0;
    s.dtFactor = 0;
    s.vel.set(0, 0, 0);
  } else if (s.gameState === 'cleared') {
    if (s.clearSlowTimer > 0) {
      s.clearSlowTimer -= rawDt;
      s.targetDtFactor = 0.07;
      s.dtFactor = 0.07;
      s.vel.set(0, 0, 0);
    } else {
      s.targetDtFactor = 1.0;
      s.dtFactor = 1.0;
    }
  } else {
    const baseIdleRate = 0.03;
    const moveContribution = isMoving ? 1.0 : 0.0;
    const lookContribution = s.mouseDeltaMag;
    s.mouseDeltaMag = Math.max(0, s.mouseDeltaMag - rawDt * 1.5);

    s.targetDtFactor = Math.min(1.0, Math.max(baseIdleRate, Math.max(moveContribution, baseIdleRate + lookContribution)));

    if (s.actionKickTimer > 0) {
      s.actionKickTimer -= rawDt;
      s.targetDtFactor = Math.max(s.targetDtFactor, 0.85);
    }

    s.dtFactor += (s.targetDtFactor - s.dtFactor) * 0.16;
  }
  const gameDt = rawDt * s.dtFactor;

  superhotSound.updateTimeDilation(s.dtFactor);

  if (frameCounter % 6 === 0) {
    onDtFactorChange(s.dtFactor);
  }

  // 2. Camera Orientation
  camera.rotation.order = 'YXZ';
  camera.rotation.y = s.yaw;
  camera.rotation.x = s.pitch;
  camera.rotation.z = s.wallRun.tiltAngle;

  // Animate Arms & Fists
  animatePlayerArms({
    hasGun: s.currentWeapon !== null,
    weaponType: s.currentWeapon,
    playerWeaponGroup,
    playerLeftFistGroup,
    playerRightFistGroup,
    leftHandRig: sceneSetup.armHierarchy.leftHandRig,
    rightHandRig: sceneSetup.armHierarchy.rightHandRig,
    playerPistol: sceneSetup.playerPistol,
    isMoving,
    currentTime,
    rawDt,
    recoilAmount: s.recoilAmount,
    punchProgress: s.punchProgress,
    punchType: s.punchType,
    activeEmote: s.currentEmote ?? 'none',
    emoteProgress: s.emoteProgress ?? 0,
    onPunchProgressUpdate: (progress, punching) => {
      s.punchProgress = progress;
      s.isPunching = punching;
    },
    onRecoilUpdate: (rec) => {
      s.recoilAmount = rec;
    },
  });

  if (s.shootCooldown > 0) s.shootCooldown -= rawDt;

  // 3. Player Movement & Wallrun
  if (s.gameState === 'playing') {
    updatePlayerMovementAndWallrun({
      keys: s.keys,
      pos: s.pos,
      vel: s.vel,
      yaw: s.yaw,
      isGrounded: s.isGrounded,
      wallBoxes: s.wallBoxes,
      wallRun: s.wallRun,
      gameDt,
      rawDt,
      isMoving,
      onActionKick: (kick) => {
        s.actionKickTimer = kick;
      },
    });

    camera.position.copy(s.pos);

    // Weapon Catch / Pickup prompt check (Arma no ar ou no chão apenas quando olhando na direção dela)
    let canCatchTarget = false;
    camera.getWorldDirection(_tempCamDir);

    // 1. Armas no ar voando
    for (let awIdx = 0; awIdx < s.airborneWeapons.length; awIdx++) {
      const aw = s.airborneWeapons[awIdx];
      _tempToW.subVectors(aw.position, camera.position);
      if (_tempToW.length() < 3.4 && _tempCamDir.angleTo(_tempToW) < 0.75) {
        canCatchTarget = true;
        break;
      }
    }

    // 2. Armas no chão (Apenas se o jogador estiver olhando para baixo na direção da arma)
    if (!canCatchTarget) {
      for (let dwIdx = 0; dwIdx < s.droppedWeapons.length; dwIdx++) {
        const dw = s.droppedWeapons[dwIdx];
        _tempToW.subVectors(dw.position, camera.position);
        const dist = _tempToW.length();
        if (dist < 2.8 && _tempCamDir.angleTo(_tempToW) < 0.65) {
          canCatchTarget = true;
          break;
        }
      }
    }

    onCanCatchWeaponChange(canCatchTarget);

    // Punch reach prompt check
    let inPunchReach = false;

    if (s.currentWeapon === null) {
      for (let eIdx = 0; eIdx < s.enemies.length; eIdx++) {
        const e = s.enemies[eIdx];
        if (e.alive) {
          _tempToW.copy(e.position);
          _tempToW.y += 1.1;
          _tempToW.sub(camera.position);

          if (_tempToW.length() < 2.5 && _tempCamDir.angleTo(_tempToW) < 0.75) {
            inPunchReach = true;
            break;
          }
        }
      }
    }
    onCanPunchChange(inPunchReach);

    // HOTSWITCH target acquisition check
    let canHotswitch = false;
    if (s.hotswitchCooldown <= 0) {
      for (let eIdx = 0; eIdx < s.enemies.length; eIdx++) {
        const e = s.enemies[eIdx];
        if (e.alive) {
          _tempToW.copy(e.position);
          _tempToW.y += 1.2;
          _tempToW.sub(camera.position);

          const dist = _tempToW.length();
          if (dist > 1.5 && dist < 32.0 && _tempCamDir.angleTo(_tempToW) < 0.35) {
            canHotswitch = true;
            break;
          }
        }
      }
    }
    onCanHotswitchChange(canHotswitch);
  }

  // HOTSWITCH Cooldown Decay
  if (s.hotswitchCooldown > 0) {
    s.hotswitchCooldown = Math.max(0, s.hotswitchCooldown - rawDt);
    if (frameCounter % 6 === 0) {
      onHotswitchCooldownChange(s.hotswitchCooldown);
    }
  }

  const tPhysicsStart = performance.now();

  // 4. Bullets Update & Collisions
  updateCombatVfx(scene, gameDt);
  updateEmissiveDissolveGhosts(scene, gameDt);
  updateBulletsAndCollisions({
    bullets: s.bullets,
    enemies: s.enemies,
    airborneWeapons: s.airborneWeapons,
    wallBoxes: s.wallBoxes,
    playerPos: s.pos,
    gameDt,
    dtFactor: s.dtFactor,
    gameState: s.gameState,
    godMode,
    scene,
    shatterLimb,
    shatterEnemy,
    onPlayerHit: triggerGameOver,
  });

  // 5. Airborne Weapons
  updateAirborneWeapons({
    airborneWeapons: s.airborneWeapons,
    enemies: s.enemies,
    gameDt,
    dtFactor: s.dtFactor,
    scene,
    enemyStunnedMat,
    applyEnemyMaterial,
    disarmEnemy,
    shatterEnemy,
    spawnDroppedWeapon,
  });

  // 6. Enemies AI
  const camDirVector = new THREE.Vector3();
  camera.getWorldDirection(camDirVector);

  s.enemies.forEach((enemy) => {
    updateEnemyAi({
      enemy,
      gameDt,
      rawDt,
      currentTime,
      playerPos: s.pos,
      playerVel: s.vel,
      camDir: camDirVector,
      wallBoxes: s.wallBoxes,
      gameState: s.gameState,
      dtFactor: s.dtFactor,
      enemyActiveMat,
      applyEnemyMaterial,
      onPlayerHit: triggerGameOver,
      scene,
      bullets: s.bullets,
    });
  });

  // 7. Glass Shards (gravidade, colisão com parede/chão, atrito — não deslizam)
  for (let i = s.glassShards.length - 1; i >= 0; i--) {
    const shard = s.glassShards[i];
    const pos = shard.mesh.position;
    const grounded = pos.y <= 0.09;

    if (!grounded) {
      shard.velocity.y -= 9.0 * gameDt;
      shard.mesh.rotation.x += shard.rotVelocity.x * gameDt;
      shard.mesh.rotation.y += shard.rotVelocity.y * gameDt;
      shard.mesh.rotation.z += shard.rotVelocity.z * gameDt;
    }

    const prevX = pos.x;
    const prevZ = pos.z;
    pos.addScaledVector(shard.velocity, gameDt);

    // Otimização Broadphase: Só testa parede se o estilhaço estiver em movimento e abaixo do teto
    if (pos.y <= 4.0 && (shard.velocity.x * shard.velocity.x + shard.velocity.z * shard.velocity.z > 0.01)) {
      for (let wIdx = 0; wIdx < s.wallBoxes.length; wIdx++) {
        if (s.wallBoxes[wIdx].containsPoint(pos)) {
          pos.x = prevX;
          pos.z = prevZ;
          shard.velocity.x *= -0.25;
          shard.velocity.z *= -0.25;
          break;
        }
      }
    }

    if (pos.y <= 0.08) {
      pos.y = 0.08;
      shard.velocity.y = Math.abs(shard.velocity.y) > 0.8 ? -shard.velocity.y * 0.25 : 0;
      const friction = Math.max(0, 1 - 4.5 * gameDt);
      shard.velocity.x *= friction;
      shard.velocity.z *= friction;
      shard.rotVelocity.multiplyScalar(Math.max(0, 1 - 4.0 * gameDt));
    } else {
      const air = Math.max(0, 1 - 0.25 * gameDt);
      shard.velocity.x *= air;
      shard.velocity.z *= air;
    }

    shard.life -= gameDt;
    if (shard.life <= 0) {
      shardPool.recycleShard(shard);
      s.glassShards.splice(i, 1);
    }
  }

  updateEmissiveDissolveGhosts(scene, gameDt);

  s.physicsMs = performance.now() - tPhysicsStart;

  const tAudioStart = performance.now();
  superhotSound.updateTimeDilation(s.dtFactor);
  s.audioMs = performance.now() - tAudioStart;

  // Atualiza uniformes da transição cinematográfica Construct / Sketch-to-Reality
  if (s.constructProgress < 1.0) {
    s.constructProgress = Math.min(1.0, s.constructProgress + rawDt * 0.95);
  }

  // Accumulate WebGL render stats across all composer passes for accurate F8/F12 telemetry
  renderer.info.autoReset = false;
  renderer.info.reset();

  const tRenderStart = performance.now();
  // Render direct WebGL for 'basica' preset or through post-processing composer for higher presets
  if (sceneSetup.ensurePostProcessing && !ctx.isBasicaPreset) {
    const post = sceneSetup.ensurePostProcessing();
    if (post.constructPass) {
      post.constructPass.uniforms['progress'].value = s.constructProgress;
      post.constructPass.uniforms['time'].value = currentTime * 0.001;
    }
    post.composer.render();
  } else {
    renderer.render(scene, camera);
  }
  s.renderMs = performance.now() - tRenderStart;
};

