import * as THREE from 'three';
import { Bullet, Enemy, WeaponType } from './types';
import { createGlbBulletGeometry } from './geometryLoader';
import { superhotSound } from '../audio/SuperhotAudio';

interface FireWeaponParams {
  currentWeapon: WeaponType;
  ammo: number;
  shootCooldown: number;
  infiniteAmmo: boolean;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
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
  const spawnPos = camera.position.clone().addScaledVector(dir, 0.45);

  alertEnemiesBySound(enemies, spawnPos, 45.0);

  const bulletSpeed = isRifle ? 26.0 : 22.0;
  const bulletGeo = createGlbBulletGeometry();

  if (isShotgun) {
    // Escopeta: Maior tempo de espera do jogo (0.85s) para compensar a grande área de dispersão
    onCooldownChange(0.85);
    superhotSound.playShotgunBlast(dtFactor);

    // Shotgun: Disparo simultâneo de projéteis físicos com rastro ciano-azul
    for (let i = 0; i < 7; i++) {
      const spreadDir = dir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.16,
        (Math.random() - 0.5) * 0.16,
        (Math.random() - 0.5) * 0.16
      )).normalize();

      const bMesh = new THREE.Mesh(
        bulletGeo,
        new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          emissive: 0x0284c7,
          emissiveIntensity: 1.0,
          metalness: 0.85,
          roughness: 0.2
        })
      );
      bMesh.scale.set(0.55, 0.55, 0.55);
      bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), spreadDir);
      bMesh.position.copy(spawnPos);
      scene.add(bMesh);

      const trailLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([spawnPos.clone(), spawnPos.clone().addScaledVector(spreadDir, -0.75)]),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
      );
      scene.add(trailLine);

      bullets.push({
        id: `p-pellet-${Date.now()}-${i}`,
        mesh: bMesh,
        trailMesh: trailLine,
        position: bMesh.position,
        direction: spreadDir,
        speed: bulletSpeed,
        isEnemy: false,
        life: 3.2,
        prevPosition: spawnPos.clone(),
      });
    }
  } else if (isRifle) {
    // Mini UZI SMG: Cadência de 10 a 12 balas/s com rajada rápida de 3 projéteis
    const burstCount = Math.min(3, ammo);
    if (!infiniteAmmo && burstCount > 1) {
      onAmmoChange(ammo - burstCount);
    }
    // Intervalo de cadência pós-rajada (0.18s)
    onCooldownChange(0.18);
    superhotSound.playGunshot(dtFactor);

    for (let bIdx = 0; bIdx < burstCount; bIdx++) {
      const burstDelayOffset = bIdx * 0.04;
      const burstDir = dir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.04,
        (Math.random() - 0.5) * 0.04,
        (Math.random() - 0.5) * 0.04
      )).normalize();

      const bMesh = new THREE.Mesh(
        bulletGeo,
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 1.2,
          metalness: 0.85,
          roughness: 0.2
        })
      );
      bMesh.scale.set(0.68, 0.68, 0.68);
      bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), burstDir);
      // Espaçamento físico entre balas dentro da rajada
      const bSpawnPos = spawnPos.clone().addScaledVector(burstDir, burstDelayOffset * 10);
      bMesh.position.copy(bSpawnPos);
      scene.add(bMesh);

      const trailLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([bSpawnPos.clone(), bSpawnPos.clone().addScaledVector(burstDir, -0.95)]),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
      );
      scene.add(trailLine);

      bullets.push({
        id: `p-uzi-${Date.now()}-${bIdx}`,
        mesh: bMesh,
        trailMesh: trailLine,
        position: bMesh.position,
        direction: burstDir,
        speed: bulletSpeed,
        isEnemy: false,
        life: 4.0,
        prevPosition: bSpawnPos.clone(),
      });
    }
  } else {
    // Pistola: Intervalo de 0.42s entre cada disparo
    onCooldownChange(0.42);
    superhotSound.playGunshot(dtFactor);

    const bMesh = new THREE.Mesh(
      bulletGeo,
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x0284c7,
        emissiveIntensity: 1.0,
        metalness: 0.85,
        roughness: 0.2
      })
    );
    bMesh.scale.set(0.8, 0.8, 0.8);
    bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir.clone().normalize());
    bMesh.position.copy(spawnPos);
    scene.add(bMesh);

    const trailLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([spawnPos.clone(), spawnPos.clone().addScaledVector(dir, -0.8)]),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
    );
    scene.add(trailLine);

    bullets.push({
      id: `p-bullet-${Date.now()}`,
      mesh: bMesh,
      trailMesh: trailLine,
      position: bMesh.position,
      direction: dir.normalize(),
      speed: bulletSpeed,
      isEnemy: false,
      life: 4.5,
      prevPosition: spawnPos.clone(),
    });
  }
};
