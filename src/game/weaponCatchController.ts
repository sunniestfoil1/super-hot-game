import * as THREE from 'three';
import { AirborneWeapon, WeaponType } from './types';
import { superhotSound } from '../audio/SuperhotAudio';

interface CatchParams {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  airborneWeapons: AirborneWeapon[];
  onCaught: (type: WeaponType, ammo: number) => void;
}

export const attemptCatchMidAirWeapon = ({
  camera,
  scene,
  airborneWeapons,
  onCaught,
}: CatchParams): boolean => {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  let closestWeapon: AirborneWeapon | null = null;
  let closestDist = 3.4;
  let closestIdx = -1;

  airborneWeapons.forEach((aw, idx) => {
    const toWeapon = aw.position.clone().sub(camera.position);
    const dist = toWeapon.length();
    if (dist < closestDist && dir.angleTo(toWeapon) < 0.75) {
      closestWeapon = aw;
      closestDist = dist;
      closestIdx = idx;
    }
  });

  if (closestWeapon && closestIdx !== -1) {
    const caught = closestWeapon as AirborneWeapon;
    onCaught(caught.type, caught.ammo);
    superhotSound.playWeaponCatch();
    scene.remove(caught.group);
    airborneWeapons.splice(closestIdx, 1);
    return true;
  }
  return false;
};
