import * as THREE from 'three';
import { CoopPlayerData } from './coopNetwork';

export interface CoopPartnerMesh {
  group: THREE.Group;
  head: THREE.Mesh;
  chest: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  weaponMesh: THREE.Mesh;
}

// Material Preto Fosco Metálico (Sleek Pitch Black SUPERHOT Player Shadow)
const partnerMatBlack = new THREE.MeshStandardMaterial({
  color: 0x111115,
  emissive: 0x151520,
  emissiveIntensity: 0.2,
  roughness: 0.3,
  metalness: 0.8,
});

export function spawnCoopPartnerMesh(scene: THREE.Scene, isHostPartner?: boolean): CoopPartnerMesh {
  const group = new THREE.Group();
  const mat = partnerMatBlack;

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), mat);
  head.position.set(0, 1.62, 0);

  // Chest / Torso
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.25), mat);
  chest.position.set(0, 1.15, 0);

  // Arms
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), mat);
  leftArm.position.set(-0.32, 1.15, 0);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), mat);
  rightArm.position.set(0.32, 1.15, 0);

  // Legs
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.14), mat);
  leftLeg.position.set(-0.16, 0.38, 0);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.14), mat);
  rightLeg.position.set(0.16, 0.38, 0);

  // Weapon Mesh (Pistol)
  const weaponMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.12, 0.35),
    new THREE.MeshBasicMaterial({ color: 0x22222a })
  );
  weaponMesh.position.set(0.28, 1.05, -0.25);
  weaponMesh.visible = true;

  group.add(head, chest, leftArm, rightArm, leftLeg, rightLeg, weaponMesh);
  scene.add(group);

  return {
    group,
    head,
    chest,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMesh,
  };
}

export function updateCoopPartnerMesh(partner: CoopPartnerMesh, state: CoopPlayerData, gameDt: number) {
  // Posição no chão: a posição y do estado é a altura dos olhos (1.7m).
  // Subtraímos 1.7m para ancorar os pés exatamente no solo (Y = 0.0) sem flutuar no ar!
  const targetPos = new THREE.Vector3(
    state.pos[0],
    Math.max(0.0, state.pos[1] - 1.7),
    state.pos[2]
  );

  partner.group.position.lerp(targetPos, Math.min(1.0, gameDt * 28.0));
  partner.group.rotation.y = THREE.MathUtils.lerp(partner.group.rotation.y, state.yaw, Math.min(1.0, gameDt * 28.0));
  partner.head.rotation.x = state.pitch;

  partner.weaponMesh.visible = state.currentWeapon !== null;
}
