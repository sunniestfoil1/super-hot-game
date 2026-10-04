import * as THREE from 'three';
import { AirborneWeapon, DroppedWeapon, Enemy, WeaponType } from './types';
import { superhotSound } from '../audio/SuperhotAudio';
import { createGlbShotgunGeometry, createGlbUziGeometry } from './extraModelLoader';
import { createPistolInstance } from './pistolModel';

const blackWeaponMat = new THREE.MeshStandardMaterial({
  color: 0x2a2a2e,
  roughness: 0.5,
  metalness: 0.55,
});

function createWeaponMesh(type: WeaponType): THREE.Object3D {
  if (type === 'shotgun') {
    return new THREE.Mesh(createGlbShotgunGeometry(), blackWeaponMat);
  }
  if (type === 'rifle') {
    return new THREE.Mesh(createGlbUziGeometry(), blackWeaponMat);
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
  dtFactor = 0.03
): AirborneWeapon | null => {
  if (!enemy.hasWeapon || !enemy.gunMesh) return null;
  enemy.hasWeapon = false;
  if (enemy.gunMesh.parent) {
    enemy.gunMesh.parent.remove(enemy.gunMesh);
  } else {
    enemy.root.remove(enemy.gunMesh);
  }
  enemy.gunMesh = null;

  const spawnPos = enemy.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  const launchVel = new THREE.Vector3(
    (Math.random() - 0.5) * 2.0,
    upwardForce,
    (Math.random() - 0.5) * 2.0
  );

  superhotSound.playThrow(dtFactor);
  return spawnAirborneWeapon(scene, spawnPos, launchVel, 'pistol', 3, false);
};
