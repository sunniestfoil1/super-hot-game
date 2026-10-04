import * as THREE from 'three';

export interface ExtractedGlbPhysics {
  glbMeshes: THREE.Mesh[];
  wallBoxes: THREE.Box3[];
  floorBoxes: THREE.Box3[];
  stairBoxes: THREE.Box3[];
}

let activeGlbMeshes: THREE.Mesh[] = [];

/**
 * Extrator automático e universal de física/colisões para qualquer modelo 3D GLB.
 * Identifica malhas da cena, filtra elementos decorativos de objetos estruturais
 * e registra malhas reais para colisão de superfície de alta precisão.
 */
export function extractGlbColliders(glbGroup: THREE.Group): ExtractedGlbPhysics {
  const glbMeshes: THREE.Mesh[] = [];
  const wallBoxes: THREE.Box3[] = [];
  const floorBoxes: THREE.Box3[] = [];
  const stairBoxes: THREE.Box3[] = [];

  glbGroup.updateMatrixWorld(true);

  glbGroup.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) {
      const mesh = object as THREE.Mesh;
      if (!mesh.geometry) return;

      if (!mesh.geometry.boundingBox) {
        mesh.geometry.computeBoundingBox();
      }

      const localBb = mesh.geometry.boundingBox;
      if (!localBb) return;

      const worldBox = new THREE.Box3();
      worldBox.copy(localBb).applyMatrix4(mesh.matrixWorld);

      const dx = worldBox.max.x - worldBox.min.x;
      const dy = worldBox.max.y - worldBox.min.y;
      const dz = worldBox.max.z - worldBox.min.z;

      // Descartar elementos de partículas ou visualização irrelevantes
      if (dx < 0.1 && dy < 0.1 && dz < 0.1) return;

      // Adiciona a malha para raycasting de superfície preciso (janelas, portas, corredores e escadas)
      glbMeshes.push(mesh);

      // Se for um pilar ou obstáculo pequeno individual, registra box collider justo
      if (dy > 0.4 && dx < 3.5 && dz < 3.5) {
        wallBoxes.push(worldBox);
      } else if (dy < 0.4 && dx > 0.8 && dz > 0.8) {
        floorBoxes.push(worldBox);
      }
    }
  });

  activeGlbMeshes = glbMeshes;

  console.log(
    `[GLB PHYSICS EXTRACTOR] Registradas ${glbMeshes.length} malhas de superfície GLB para colisão dinâmica de faces.`
  );

  return { glbMeshes, wallBoxes, floorBoxes, stairBoxes };
}

export function getActiveGlbMeshes(): THREE.Mesh[] {
  return activeGlbMeshes;
}
