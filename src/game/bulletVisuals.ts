import * as THREE from 'three';
import { createGlbBulletGeometry } from './geometryLoader';

const TRAIL_CORE_COLOR = 0xff002b;
const TRAIL_GLOW_COLOR = 0xff0033;
const UNIT_Y = new THREE.Vector3(0, 1, 0);

const coreTrailGeo = new THREE.CylinderGeometry(0.012, 0.004, 1, 8, 1, true);
const glowTrailGeo = new THREE.CylinderGeometry(0.028, 0.010, 1, 8, 1, true);

// Singletons de alta performance: Cabeça da bala PRETA FOSCA / METÁLICA (tamanho do dedo)
const sharedBlackBulletMaterial = new THREE.MeshStandardMaterial({
  color: 0x111115,
  emissive: 0x050508,
  emissiveIntensity: 0.1,
  roughness: 0.4,
  metalness: 0.7,
});

const sharedCoreTrailMat = new THREE.MeshBasicMaterial({
  color: 0xff002b,
  transparent: true,
  opacity: 1.0,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const sharedGlowTrailMat = new THREE.MeshBasicMaterial({
  color: TRAIL_GLOW_COLOR,
  transparent: true,
  opacity: 0.7,
  side: THREE.DoubleSide,
  depthWrite: false,
});

/** Bala preta compacta (tamanho do dedo do personagem) usando material preto fosco. */
export function createBulletMesh(
  pos: THREE.Vector3,
  dir: THREE.Vector3,
  scale = 0.15,
  color = TRAIL_CORE_COLOR
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    createGlbBulletGeometry(),
    sharedBlackBulletMaterial
  );
  mesh.scale.setScalar(scale);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
  mesh.position.copy(pos);
  return mesh;
}

/** Rastro de laser neon vermelho de 2 camadas atrás da bala preta */
export function createBulletTrail(): THREE.Group {
  const group = new THREE.Group();

  // Camada 1: Core fino vermelho neon intenso
  const coreMesh = new THREE.Mesh(coreTrailGeo, sharedCoreTrailMat);
  coreMesh.name = 'trail-core';
  coreMesh.frustumCulled = false;
  group.add(coreMesh);

  // Camada 2: Glow laser brilhante para o Bloom
  const glowMesh = new THREE.Mesh(glowTrailGeo, sharedGlowTrailMat);
  glowMesh.name = 'trail-glow';
  glowMesh.frustumCulled = false;
  group.add(glowMesh);

  return group;
}

/** Posiciona e escala o rastro de laser neon vermelho exatamente atrás da bala preta */
export function updateBulletTrail(
  trail: THREE.Object3D,
  head: THREE.Vector3,
  dir: THREE.Vector3,
  length: number
) {
  trail.position.copy(head).addScaledVector(dir, -length / 2);
  trail.quaternion.setFromUnitVectors(UNIT_Y, dir);
  trail.scale.set(1, length, 1);
}
