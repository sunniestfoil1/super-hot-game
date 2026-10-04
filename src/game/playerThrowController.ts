import * as THREE from 'three';
import { WeaponType, AirborneWeapon } from './types';
import { superhotSound } from '../audio/SuperhotAudio';
import { spawnAirborneWeapon } from './weaponSpawner';

interface PlayerThrowParams {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  currentWeapon: WeaponType;
  ammo: number;
  dtFactor: number;
  airborneWeapons: AirborneWeapon[];
  onDisarmed: () => void;
}

export function executePlayerThrowAction(params: PlayerThrowParams) {
  const { camera, scene, currentWeapon, ammo, dtFactor, airborneWeapons, onDisarmed } = params;

  onDisarmed();
  superhotSound.playThrow(dtFactor);

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const spawnPos = camera.position.clone().addScaledVector(dir, 0.5);
  const launchVel = dir.clone().multiplyScalar(22.0);

  const aw = spawnAirborneWeapon(scene, spawnPos, launchVel, currentWeapon, ammo, true);
  airborneWeapons.push(aw);
}
