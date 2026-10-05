import * as THREE from 'three';
import { createGlbBulletGeometry } from './geometryLoader';

const sharedBlackBulletMaterial = new THREE.MeshStandardMaterial({
  color: 0x111115,
  emissive: 0x050508,
  emissiveIntensity: 0.1,
  roughness: 0.4,
  metalness: 0.7,
});

const sharedLineTrailMaterial = new THREE.LineBasicMaterial({
  color: 0xff002b,
  linewidth: 2,
  transparent: true,
  opacity: 0.9,
});

/** Bala preta compacta (tamanho do dedo do personagem) usando material preto fosco. */
export function createBulletMesh(
  pos: THREE.Vector3,
  dir: THREE.Vector3,
  scale = 0.15
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

/** Rastro dinâmico em linha vermelha neon (estilo visual SUPERHOT original) */
export function createBulletTrail(): THREE.Line {
  const positions = new Float32Array(6); // 2 vertices * 3 coords
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const line = new THREE.Line(geometry, sharedLineTrailMaterial);
  line.frustumCulled = false;
  return line;
}

/** Atualiza os pontos de vértice da linha de rastro do projétil no espaço 3D */
export function updateBulletTrail(
  trail: THREE.Object3D,
  head: THREE.Vector3,
  dir: THREE.Vector3,
  length: number
) {
  const line = trail as THREE.Line;
  if (!line || !line.geometry) return;

  const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
  if (!posAttr) return;

  const array = posAttr.array as Float32Array;

  // Vértice 0: Posição atual da cabeça da bala
  array[0] = head.x;
  array[1] = head.y;
  array[2] = head.z;

  // Vértice 1: Cauda do rastro projetada para trás ao longo do vetor de direção
  array[3] = head.x - dir.x * length;
  array[4] = head.y - dir.y * length;
  array[5] = head.z - dir.z * length;

  posAttr.needsUpdate = true;
}
