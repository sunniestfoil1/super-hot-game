import * as THREE from 'three';
import { CoopPlayerData } from './coopNetwork';
import { createGlbBulletGeometry } from './geometryLoader';

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

const partnerMatHost = new THREE.MeshStandardMaterial({
  color: 0x00e5ff,
  emissive: 0x0088cc,
  emissiveIntensity: 0.8,
  roughness: 0.2,
  metalness: 0.8,
});

const partnerMatClient = new THREE.MeshStandardMaterial({
  color: 0x00ff88,
  emissive: 0x00cc66,
  emissiveIntensity: 0.8,
  roughness: 0.2,
  metalness: 0.8,
});

export function spawnCoopPartnerMesh(scene: THREE.Scene, isHostPartner: boolean): CoopPartnerMesh {
  const group = new THREE.Group();
  const mat = isHostPartner ? partnerMatHost : partnerMatClient;

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), mat);
  head.position.set(0, 1.62, 0);

  // Chest
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.25), mat);
  chest.position.set(0, 1.15, 0);

  // Arms
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), mat);
  leftArm.position.set(-0.32, 1.15, 0);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), mat);
  rightArm.position.set(0.32, 1.15, 0);

  // Legs
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.14), mat);
  leftLeg.position.set(-0.16, 0.40, 0);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.14), mat);
  rightLeg.position.set(0.16, 0.40, 0);

  // Weapon
  const weaponMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.12, 0.35),
    new THREE.MeshBasicMaterial({ color: 0x111115 })
  );
  weaponMesh.position.set(0.32, 0.95, -0.2);
  weaponMesh.visible = false;

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
  const targetPos = new THREE.Vector3(...state.pos);
  partner.group.position.lerp(targetPos, Math.min(1.0, gameDt * 25.0));
  partner.group.rotation.y = THREE.MathUtils.lerp(partner.group.rotation.y, state.yaw, Math.min(1.0, gameDt * 25.0));
  partner.head.rotation.x = state.pitch;

  partner.weaponMesh.visible = state.currentWeapon !== null;

  if (state.isMoving) {
    const legWalk = Math.sin(performance.now() * 0.012) * 0.4;
    partner.leftLeg.rotation.x = legWalk;
    partner.rightLeg.rotation.x = -legWalk;
    partner.leftArm.rotation.x = -legWalk * 0.8;
    partner.rightArm.rotation.x = legWalk * 0.8;
  } else {
    partner.leftLeg.rotation.x = 0;
    partner.rightLeg.rotation.x = 0;
    partner.leftArm.rotation.x = 0;
    partner.rightArm.rotation.x = 0;
  }
}
