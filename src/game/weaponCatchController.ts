import * as THREE from 'three';
import { AirborneWeapon, DroppedWeapon, WeaponType } from './types';
import { superhotSound } from '../audio/SuperhotAudio';

interface CatchParams {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  airborneWeapons: AirborneWeapon[];
  droppedWeapons?: DroppedWeapon[];
  onCaught: (type: WeaponType, ammo: number) => void;
}

export const attemptCatchMidAirWeapon = ({
  camera,
  scene,
  airborneWeapons,
  droppedWeapons = [],
  onCaught,
}: CatchParams): boolean => {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  // 1. Checagem de armas no ar (voando)
  let closestAirWeapon: AirborneWeapon | null = null;
  let closestAirDist = 3.4;
  let closestAirIdx = -1;

  airborneWeapons.forEach((aw, idx) => {
    const toWeapon = aw.position.clone().sub(camera.position);
    const dist = toWeapon.length();
    if (dist < closestAirDist && dir.angleTo(toWeapon) < 0.75) {
      closestAirWeapon = aw;
      closestAirDist = dist;
      closestAirIdx = idx;
    }
  });

  if (closestAirWeapon && closestAirIdx !== -1) {
    const caught = closestAirWeapon as AirborneWeapon;
    onCaught(caught.type, caught.ammo);
    superhotSound.playWeaponCatch();
    scene.remove(caught.group);
    airborneWeapons.splice(closestAirIdx, 1);
    return true;
  }

  // 2. Checagem de armas no chão (Apenas quando o jogador está Olhando para Baixo na direção da arma)
  let closestFloorWeapon: DroppedWeapon | null = null;
  let closestFloorDist = 2.8;
  let closestFloorIdx = -1;

  droppedWeapons.forEach((dw, idx) => {
    const toWeapon = dw.position.clone().sub(camera.position);
    const dist = toWeapon.length();
    if (dist < closestFloorDist && dir.angleTo(toWeapon) < 0.65) {
      closestFloorWeapon = dw;
      closestFloorDist = dist;
      closestFloorIdx = idx;
    }
  });

  if (closestFloorWeapon && closestFloorIdx !== -1) {
    const caught = closestFloorWeapon as DroppedWeapon;
    onCaught(caught.type, caught.ammo);
    superhotSound.playWeaponCatch();
    scene.remove(caught.group);
    droppedWeapons.splice(closestFloorIdx, 1);
    return true;
  }

  return false;
};
