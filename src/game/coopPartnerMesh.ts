import * as THREE from 'three';
import { CoopPlayerData } from './coopNetwork';
import { createGlbPartGeometry } from './geometryLoader';
import { createPistolInstance } from './pistolModel';

export interface CoopPartnerMesh {
  group: THREE.Group;
  head: THREE.Mesh;
  neck: THREE.Mesh;
  chest: THREE.Mesh;
  waist: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  weaponMesh: THREE.Group;
  nameSprite: THREE.Sprite;
}

// Material Preto Metalico Cristalino (Pitch Black SUPERHOT Agent)
const partnerMatBlack = new THREE.MeshStandardMaterial({
  color: 0x111115,
  emissive: 0x151520,
  emissiveIntensity: 0.2,
  roughness: 0.3,
  metalness: 0.8,
  flatShading: true,
});

function createNicknameSprite(nickname: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = 'rgba(15, 15, 20, 0.85)';
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 48, 8);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 24px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(nickname, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.4, 0.35, 1);
  sprite.position.set(0, 1.95, 0); // Flutua logo acima da cabeça
  return sprite;
}

export function spawnCoopPartnerMesh(scene: THREE.Scene, isHostPartner?: boolean): CoopPartnerMesh {
  const group = new THREE.Group();
  const mat = partnerMatBlack;

  // 1. Head
  const headGeo = createGlbPartGeometry('head', () => new THREE.BoxGeometry(0.24, 0.24, 0.24));
  const head = new THREE.Mesh(headGeo, mat);
  head.position.set(0, 1.62, 0);
  group.add(head);

  // 2. Neck
  const neckGeo = createGlbPartGeometry('neck', () => new THREE.CylinderGeometry(0.06, 0.08, 0.12, 6));
  const neck = new THREE.Mesh(neckGeo, mat);
  neck.position.set(0, 1.50, 0);
  group.add(neck);

  // 3. Chest
  const chestGeo = createGlbPartGeometry('chest', () => new THREE.BoxGeometry(0.52, 0.38, 0.26));
  const chest = new THREE.Mesh(chestGeo, mat);
  chest.position.set(0, 1.25, 0);
  group.add(chest);

  // 4. Waist
  const waistGeo = createGlbPartGeometry('waist', () => new THREE.BoxGeometry(0.38, 0.32, 0.22));
  const waist = new THREE.Mesh(waistGeo, mat);
  waist.position.set(0, 0.95, 0);
  group.add(waist);

  // 5. Left Arm
  const leftUpperArmGeo = createGlbPartGeometry('leftUpperArm', () => new THREE.BoxGeometry(0.12, 0.32, 0.12));
  const leftArm = new THREE.Mesh(leftUpperArmGeo, mat);
  leftArm.position.set(-0.26, 1.35, 0);
  group.add(leftArm);

  // 6. Right Arm
  const rightUpperArmGeo = createGlbPartGeometry('rightUpperArm', () => new THREE.BoxGeometry(0.12, 0.32, 0.12));
  const rightArm = new THREE.Mesh(rightUpperArmGeo, mat);
  rightArm.position.set(0.26, 1.35, 0);
  group.add(rightArm);

  // 7. Left Leg
  const leftThighGeo = createGlbPartGeometry('leftThigh', () => new THREE.BoxGeometry(0.16, 0.42, 0.16));
  const leftLeg = new THREE.Mesh(leftThighGeo, mat);
  leftLeg.position.set(-0.14, 0.55, 0);
  group.add(leftLeg);

  // 8. Right Leg
  const rightThighGeo = createGlbPartGeometry('rightThigh', () => new THREE.BoxGeometry(0.16, 0.42, 0.16));
  const rightLeg = new THREE.Mesh(rightThighGeo, mat);
  rightLeg.position.set(0.14, 0.55, 0);
  group.add(rightLeg);

  // 9. Weapon Mesh (Pistol)
  let weaponMesh = new THREE.Group();
  const pistolInst = createPistolInstance();
  if (pistolInst) {
    weaponMesh = pistolInst.root;
    weaponMesh.scale.setScalar(0.85);
  }
  weaponMesh.position.set(0.28, 1.15, 0.25);
  weaponMesh.rotation.set(0.15, Math.PI, 0); // Apontando para frente na rotação normal
  group.add(weaponMesh);

  // 10. Nickname Badge Sprite
  const nameLabel = isHostPartner ? '[P1] HOST' : '[P2] AGENTE 2';
  const nameSprite = createNicknameSprite(nameLabel);
  group.add(nameSprite);

  scene.add(group);

  return {
    group,
    head,
    neck,
    chest,
    waist,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMesh,
    nameSprite,
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
