import * as THREE from 'three';
import { AirborneWeapon, DroppedWeapon, Enemy, WeaponType } from './types';
import { superhotSound } from '../audio/SuperhotAudio';
import { createGlbShotgunGeometry, createGlbUziGeometry, createGlbBottleGeometry, createGlbKnifeGeometry, createGlbAshtrayGeometry } from './extraModelLoader';
import { createPistolInstance } from './pistolModel';

const blackWeaponMat = new THREE.MeshStandardMaterial({
  color: 0x2a2a2e,
  roughness: 0.5,
  metalness: 0.55,
});

const bottleMat = new THREE.MeshStandardMaterial({
  color: 0x228b22,
  roughness: 0.2,
  metalness: 0.1,
  transparent: true,
  opacity: 0.85,
});

const knifeMat = new THREE.MeshStandardMaterial({
  color: 0x44444c,
  roughness: 0.3,
  metalness: 0.8,
});

const ashtrayMat = new THREE.MeshStandardMaterial({
  color: 0x8899a6,
  roughness: 0.15,
  metalness: 0.2,
  transparent: true,
  opacity: 0.9,
});

function createWeaponMesh(type: WeaponType): THREE.Object3D {
  if (type === 'shotgun') {
    return new THREE.Mesh(createGlbShotgunGeometry(), blackWeaponMat);
  }
  if (type === 'rifle') {
    return new THREE.Mesh(createGlbUziGeometry(), blackWeaponMat);
  }
  if (type === 'bottle') {
    return new THREE.Mesh(createGlbBottleGeometry(), bottleMat);
  }
  if (type === 'knife') {
    return new THREE.Mesh(createGlbKnifeGeometry(), knifeMat);
  }
  if (type === 'ashtray') {
    return new THREE.Mesh(createGlbAshtrayGeometry(), ashtrayMat);
  }
  // Official pistol.glb only — no box fallback
  const pistol = createPistolInstance();
  if (pistol) return pistol.root;
  // Empty placeholder until GLB finishes loading (never the old box mesh)
  const pending = new THREE.Group();
  pending.name = 'weapon-pistol-pending';
  return pending;
}

export const spawnAirborneWeapon = (
  scene: THREE.Scene,
  pos: THREE.Vector3,
  velocity: THREE.Vector3,
  type: WeaponType,
  ammoCount: number,
  isThrownByPlayer: boolean
): AirborneWeapon => {
  const group = new THREE.Group();
  group.position.copy(pos);

  const body = createWeaponMesh(type);
  group.add(body);
  scene.add(group);

  return {
    id: `air-${Date.now()}-${Math.random()}`,
    group,
    position: group.position,
    velocity,
    angularVelocity: new THREE.Vector3(
      (Math.random() - 0.5) * 16,
      (Math.random() - 0.5) * 16,
      (Math.random() - 0.5) * 16
    ),
    type,
    ammo: ammoCount,
    life: 5.0,
    isThrownByPlayer,
    canCatch: true,
  };
};

export const spawnFloorWeapon = (
  scene: THREE.Scene,
  pos: THREE.Vector3,
  type: WeaponType,
  ammoCount: number,
  id: string
): DroppedWeapon => {
  const group = new THREE.Group();
  group.position.copy(pos);

  const body = createWeaponMesh(type);
  group.add(body);
  group.rotation.x = Math.PI / 2;
  group.rotation.z = Math.random() * Math.PI;

  scene.add(group);
  return { id, group, position: group.position, type, ammo: ammoCount };
};

export const disarmEnemyWeapon = (
  scene: THREE.Scene,
  enemy: Enemy,
  upwardForce = 4.2,
  dtFactor = 0.03,
  playerHeadPos?: THREE.Vector3
): AirborneWeapon | null => {
  if (!enemy.hasWeapon || !enemy.gunMesh) return null;
  const wType = enemy.weaponType || 'pistol';
  enemy.hasWeapon = false;
  if (enemy.gunMesh.parent) {
    enemy.gunMesh.parent.remove(enemy.gunMesh);
  } else {
    enemy.root.remove(enemy.gunMesh);
  }
  enemy.gunMesh = null;

  const spawnPos = enemy.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  let launchVel: THREE.Vector3;

  if (playerHeadPos) {
    const dirToHead = new THREE.Vector3().subVectors(playerHeadPos, spawnPos);
    const dist = dirToHead.length();
    dirToHead.normalize();

    const speed = Math.min(13.5, Math.max(7.0, dist * 1.6));
    launchVel = dirToHead.multiplyScalar(speed);
    launchVel.y += Math.min(2.8, dist * 0.22); // Parábola em direção à cabeça do jogador
  } else {
    launchVel = new THREE.Vector3(
      (Math.random() - 0.5) * 2.0,
      upwardForce,
      (Math.random() - 0.5) * 2.0
    );
  }

  superhotSound.playThrow(dtFactor);
  const ammo = (wType === 'bottle' || wType === 'knife') ? 1 : 3;
  return spawnAirborneWeapon(scene, spawnPos, launchVel, wType, ammo, false);
};
