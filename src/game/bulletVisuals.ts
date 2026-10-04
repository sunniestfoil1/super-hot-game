import * as THREE from 'three';
import { createGlbBulletGeometry } from './geometryLoader';

const TRAIL_CORE_COLOR = 0xff0033;
const TRAIL_GLOW_COLOR = 0xff2244;
const UNIT_Y = new THREE.Vector3(0, 1, 0);

const coreTrailGeo = new THREE.CylinderGeometry(0.008, 0.002, 1, 6, 1, true);
const glowTrailGeo = new THREE.CylinderGeometry(0.024, 0.008, 1, 8, 1, true);

// Singletons de alta performance para reutilização de shader/material
const sharedBulletMaterial = new THREE.MeshStandardMaterial({
  color: TRAIL_CORE_COLOR,
  emissive: TRAIL_CORE_COLOR,
  emissiveIntensity: 1.8,
  roughness: 0.1,
  metalness: 0.9,
});

const sharedCoreTrailMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.95,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const sharedGlowTrailMat = new THREE.MeshBasicMaterial({
  color: TRAIL_GLOW_COLOR,
  transparent: true,
  opacity: 0.55,
  side: THREE.DoubleSide,
  depthWrite: false,
});

/** Bala usando o GLB low_poly_bullet com material compartilhado. */
export function createBulletMesh(
  pos: THREE.Vector3,
  dir: THREE.Vector3,
  scale = 0.32,
  color = TRAIL_CORE_COLOR
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    createGlbBulletGeometry(),
    sharedBulletMaterial
  );
  mesh.scale.setScalar(scale);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
  mesh.position.copy(pos);
  return mesh;
}

/** Rastro de 2 Camadas com materiais compartilhados */
export function createBulletTrail(): THREE.Group {
  const group = new THREE.Group();

  // Camada 1: Core fino de alta intensidade
  const coreMesh = new THREE.Mesh(coreTrailGeo, sharedCoreTrailMat);
  coreMesh.name = 'trail-core';
  coreMesh.frustumCulled = false;
  group.add(coreMesh);

  // Camada 2: Glow translúcido expandido para o Bloom
  const glowMesh = new THREE.Mesh(glowTrailGeo, sharedGlowTrailMat);
  glowMesh.name = 'trail-glow';
  glowMesh.frustumCulled = false;
  group.add(glowMesh);

  return group;
}

/** Posiciona e escala o rastro de 2 camadas atrás da bala com gradiente e afunilamento */
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
