import * as THREE from 'three';
import { Bullet, Enemy, GlassShard, AirborneWeapon, DroppedWeapon } from './types';
import { updateBulletsAndCollisions } from './bulletPhysics';
import { updateAirborneWeapons } from './weaponPhysics';
import { updateEnemyAi } from './enemyAi';
import { updatePlayerMovementAndWallrun } from './playerController';
import { animatePlayerArms } from './firstPersonArms';
import { superhotSound } from '../audio/SuperhotAudio';
import { SceneSetupResult } from './sceneSetup';

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
  onWeaponPickup: (type: any, ammo: number) => void;
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
    s.targetDtFactor = 1.0;
    s.dtFactor = 1.0;
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

    // Ground weapon pickup check
    for (let i = s.droppedWeapons.length - 1; i >= 0; i--) {
      const dw = s.droppedWeapons[i];
      if (s.pos.distanceTo(dw.position) < 1.4 && s.currentWeapon === null) {
        onWeaponPickup(dw.type, dw.ammo);
        s.currentWeapon = dw.type;
        s.ammo = dw.ammo;
        s.actionKickTimer = 0.2;
        superhotSound.playWeaponCatch();
        scene.remove(dw.group);
        s.droppedWeapons.splice(i, 1);
        break;
      }
    }

    // Punch reach prompt check
    let inPunchReach = false;
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);

    if (s.currentWeapon === null) {
      for (const e of s.enemies) {
        if (e.alive) {
          const toE = e.position.clone().add(new THREE.Vector3(0, 1.1, 0)).sub(camera.position);
          if (toE.length() < 2.5 && camDir.angleTo(toE) < 0.75) {
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
      for (const e of s.enemies) {
        if (e.alive) {
          const toE = e.position.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(camera.position);
          const dist = toE.length();
          if (dist > 1.5 && dist < 32.0 && camDir.angleTo(toE) < 0.35) {
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

  // 4. Bullets Update & Collisions
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

  // 7. Glass Shards
  for (let i = s.glassShards.length - 1; i >= 0; i--) {
    const shard = s.glassShards[i];
    shard.velocity.y -= 7.5 * gameDt;
    shard.mesh.position.addScaledVector(shard.velocity, gameDt);
    shard.mesh.rotation.x += shard.rotVelocity.x * gameDt;
    shard.mesh.rotation.y += shard.rotVelocity.y * gameDt;
    shard.mesh.rotation.z += shard.rotVelocity.z * gameDt;

    if (shard.mesh.position.y <= 0.08) {
      shard.mesh.position.y = 0.08;
      shard.velocity.y = -shard.velocity.y * 0.35;
    }

    shard.life -= gameDt;
    if (shard.life <= 0) {
      scene.remove(shard.mesh);
      s.glassShards.splice(i, 1);
    }
  }

  // Render through post-processing composer instead of raw renderer
  if (sceneSetup.ensurePostProcessing) {
    sceneSetup.ensurePostProcessing().composer.render();
  } else {
    renderer.render(scene, camera);
  }
};
