import { spawnMuzzleFlashVfx } from './combatVfx';
import * as THREE from 'three';
import { Bullet, Enemy, WeaponType } from './types';
import { createBulletMesh, createBulletTrail, updateBulletTrail } from './bulletVisuals';
import { superhotSound } from '../audio/SuperhotAudio';

interface FireWeaponParams {
  currentWeapon: WeaponType;
  ammo: number;
  shootCooldown: number;
  infiniteAmmo: boolean;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  playerWeaponGroup?: THREE.Group;
  muzzleFlash: THREE.PointLight;
  dtFactor: number;
  bullets: Bullet[];
  enemies: Enemy[];
  onAmmoChange: (newAmmo: number) => void;
  onActionKick: (timer: number) => void;
  onRecoil: (amount: number) => void;
  onCooldownChange: (cooldown: number) => void;
}

export const alertEnemiesBySound = (enemies: Enemy[], soundOrigin: THREE.Vector3, soundRadius = 45.0) => {
  enemies.forEach((enemy) => {
    if (enemy.alive) {
      const distToSound = enemy.position.distanceTo(soundOrigin);
      if (distToSound <= soundRadius) {
        enemy.alertSoundTimer = 4.0;
        enemy.lastHeardPos = soundOrigin.clone();
        enemy.alertState = 'alerted';
        enemy.reactionTimer = Math.max(enemy.reactionTimer, enemy.reactionTime * 0.8);
      }
    }
  });
};

export const firePlayerGuns = (params: FireWeaponParams) => {
  const {
    currentWeapon,
    ammo,
    shootCooldown,
    infiniteAmmo,
    camera,
    scene,
    playerWeaponGroup,
    muzzleFlash,
    dtFactor,
    bullets,
    enemies,
    onAmmoChange,
    onActionKick,
    onRecoil,
    onCooldownChange,
  } = params;

  if (ammo <= 0 || shootCooldown > 0) {
    if (ammo <= 0) superhotSound.playBulletWhiz();
    return;
  }

  if (!infiniteAmmo) {
    onAmmoChange(ammo - 1);
  }
  const isShotgun = currentWeapon === 'shotgun';
  const isRifle = currentWeapon === 'rifle'; // Mini UZI SMG

  // Dynamic procedural recoil kick and action time acceleration
  const recoilStrength = isShotgun ? 0.32 : isRifle ? 0.12 : 0.18;
  const kickTime = isShotgun ? 0.45 : isRifle ? 0.18 : 0.28;
  onActionKick(kickTime);
  onRecoil(recoilStrength);

  muzzleFlash.intensity = isShotgun ? 6.0 : isRifle ? 3.0 : 4.0;
  setTimeout(() => {
    if (muzzleFlash) muzzleFlash.intensity = 0;
  }, 50);

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  // Raycast do centro da mira da tela no espaço 3D para encontrar o ponto focal exato
  const raycaster = new THREE.Raycaster();
  raycaster.set(camera.position, dir);

  let targetPoint = camera.position.clone().addScaledVector(dir, 100.0);
  const hits = raycaster.intersectObjects(scene.children, true);

  for (const hit of hits) {
    if (hit.distance < 0.6) continue;

    let isPlayerObj = false;
    let curr: THREE.Object3D | null = hit.object;
    while (curr) {
      if (curr === playerWeaponGroup || curr.name?.includes('player') || curr.name?.includes('bullet')) {
        isPlayerObj = true;
        break;
      }
      curr = curr.parent;
    }
    if (!isPlayerObj) {
      targetPoint = hit.point.clone();
      break;
    }
  }

  // Posição física na boca do cano da arma no espaço 3D real
  const spawnPos = new THREE.Vector3();
  if (playerWeaponGroup) {
    playerWeaponGroup.getWorldPosition(spawnPos);
    spawnPos.addScaledVector(dir, 0.45);
  } else {
    spawnPos.copy(camera.position).addScaledVector(dir, 0.45);
  }

  // Direção convergente perfeita: da boca da arma direto para o ponto focal onde a mira aponta
  const aimDir = new THREE.Vector3().subVectors(targetPoint, spawnPos).normalize();

  alertEnemiesBySound(enemies, spawnPos, 45.0);
  spawnMuzzleFlashVfx(scene, spawnPos, aimDir);

  const bulletSpeed = isRifle ? 28.0 : 22.0;

  const pushBullet = (
    id: string,
    pos: THREE.Vector3,
    d: THREE.Vector3,
    scale: number,
    life: number,
    trailLen: number,
    isPellet = false
  ) => {
    const mesh = createBulletMesh(pos, d, scale);
    scene.add(mesh);
    const trail = createBulletTrail();
    updateBulletTrail(trail, pos, d, trailLen);
    scene.add(trail);
    bullets.push({
      id,
      mesh,
      trailMesh: trail,
      position: mesh.position,
      direction: d,
      speed: bulletSpeed,
      isEnemy: false,
      life,
      prevPosition: pos.clone(),
      isPellet,
    });
  };

  if (isShotgun) {
    onCooldownChange(0.85);
    superhotSound.playShotgunBlast(dtFactor);
    // Leque cônico de 7 projéteis físicos alinhados à mira
    for (let i = 0; i < 7; i++) {
      const spreadDir = aimDir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.14,
        (Math.random() - 0.5) * 0.14,
        (Math.random() - 0.5) * 0.14
      )).normalize();
      pushBullet(`p-pellet-${Date.now()}-${i}`, spawnPos.clone(), spreadDir, 0.26, 3.2, 1.0, true);
    }
  } else if (isRifle) {
    // Mini Uzi SMG: Cadência rápida automática (1 bala individual por tiro em sequência)
    onCooldownChange(0.09);
    superhotSound.playGunshot(dtFactor);
    const bloom = 0.014;
    const spreadDir = aimDir.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * bloom,
      (Math.random() - 0.5) * bloom,
      (Math.random() - 0.5) * bloom
    )).normalize();
    pushBullet(`p-uzi-${Date.now()}`, spawnPos.clone(), spreadDir, 0.15, 4.0, 1.2);
  } else {
    onCooldownChange(0.42);
    superhotSound.playGunshot(dtFactor);
    pushBullet(`p-bullet-${Date.now()}`, spawnPos.clone(), aimDir, 0.34, 4.5, 1.1);
  }
};
